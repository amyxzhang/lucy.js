
/*
Constructs a TrieIndex for prefix/suffix search.
*/

var TrieIndex = function(objStore, name, field, mode, dbconn) {

	this.objectStore = objStore;
    this.transaction = objStore.transaction;
	this.name = name;
	this.unique = false;
	this.indexField = field;
    this.mode = mode;
	createIndex(this, dbconn);
	
    // Perform prefix search
    // Return list of document objects with matches
    this.get = function(text) {
        if (this.mode == "suffix") {
            text = reverse(text);
        }
        var trieIndex = this.index.index(this.indexName);
        var docIds = [];

        var ret = new IDBIndexRequest(this.objectStore, this.transaction);
        ret.result = [];
        searchHelper(trieIndex, docIds, text, 0, ret, this.objectStore);
        return ret;
    };

    function searchHelper(trieIndex, docIds, token, parentId, ret, objStore) {
        console.log("token:", token, "parentId:", parentId);
        if (token.length == 0)
            ret.onsuccess();
        var c = token.charAt(0);
        var request = trieIndex.get([parentId, c]);
        (function(trieIndex, docIds, token, parentId, ret, objStore) {
            request.onsuccess = function(evt) {
                if (evt.target.result) {
                    var result = evt.target.result;
                    if (token.length == 1) {
                        console.log(result.docIds);
                        docIds.push.apply(docIds, result.docIds);
                        populateResultText(docIds, ret, objStore);
                    } else {
                        searchHelper(trieIndex, docIds, token.substring(1), result.id, ret, objStore);
                    }
                } else {
                    ret.onsuccess();
                }
            };
            request.onerror = function(evt) {
    			console.log(evt, token);
    			ret.onerror();
    		};
        })(trieIndex, docIds, token, parentId, ret, objStore);
    }

    function populateResultText(docIds, ret, objStore) {
        var results = [];
        var finish_counter = docIds.length;
        for (var i=0; i<docIds.length; i++) {
            docId = docIds[i];
            finish_counter--;
            var requestText = objStore.get(docId);
            requestText.onerror = function(evt) {
                console.log(evt, text);
                ret.onerror();
            };
            requestText.onsuccess = function(evt) {
                console.log(requestText);
                if (evt.target.result){
                    results.push(evt.target.result);
                }
                if (finish_counter == 0) {
                    ret.result = results;
                    ret.onsuccess();
                }
            };
        }
    }

    var reverse = function(text) {
        return text.split("").reverse().join("");
    }

    // Tokenize and normalize data before insertion.
    this.insert = function(text, docId) {
        var tokenCount = basictokenize(text);
		for (var token in tokenCount) {
			indexToken(trieIndex, docId, text);
		}
    };

    function basictokenize(s) {
		s = s.toLowerCase();
		var tokens = s.match(/\w+/g);
		
		var tokenCount = {};
		for (var i=0; i<tokens.length; i++) {
			if (tokens[i] in tokenCount) {
				tokenCount[tokens[i]]++;
			} else {
				tokenCount[tokens[i]] = 1;
			}
		}
		
		return tokenCount;
	}

    function indexToken(trieindex, docId, tokens, parentId, cursor) {
        if (tokens.length == 0) {
            cursor.continue();
            return;
        }
        token = tokens[0];
        if (token.length == 0) {
            tokens.shift();
            return indexToken(trieindex, docId, tokens, 0, cursor);
        }
        if (this.mode == "suffix") {
            token = reverse(token);
        }
        var c = token.charAt(0);
        var getter = trieindex.index.get([parentId, c]);
        (function(trieindex, docId, token, parentId, cursor) {
            getter.onsuccess = function(evt) {
                var result = evt.target.result;
                if (result) {
                    var update_obj = result;
                    var docIds = update_obj.docIds;
                    if (docIds.indexOf(docId) <= -1)
                        docIds.push(docId);
                    var insertion = trieindex.store.put(update_obj);
                    insertion.onerror = function(evt) {
                        console.log(evt, update_obj);
                    };
                    insertion.onsuccess = function(evt) {
                        tokens[0] = token.substring(1);
                        indexToken(trieindex, docId, tokens, evt.target.result, cursor);
                    };
                } else {
                    var docIds = [];
                    docIds.push(docId);
                    var insert_obj = {"parent_char": [parentId, c], "docIds": docIds};
                    var insertion = trieindex.store.add(insert_obj);
                    insertion.onerror = function(evt) {
                        console.log("insertion error", evt, insert_obj);
                    };
                    insertion.onsuccess = function(evt) {
                        tokens[0] = token.substring(1);
                        indexToken(trieindex, docId, tokens, evt.target.result, cursor);
                    };
                }
            };
            getter.onerror = function(evt) {
                console.log(evt, c, parentId);
            };
        })(trieindex, docId, token, parentId, cursor);
    }
    
    function createIndex(trieindex, dbconn) {
    	
    	// create object store for trie
    	trieindex.store = dbconn.createObjectStore(name, { keyPath: "id", autoIncrement:true });
    	console.log("Created Index object store");

        // create index on the object store
        trieindex.indexName = name + "_index";
        trieindex.index = trieindex.store.createIndex(trieindex.indexName, "parent_char", { unique:true, multiEntry:false });
        console.log("Created index for trie");
        var root_node = {"id": 0, "parent_char": [-1, ''], "docIds": []};
        var insertion = trieindex.store.add(root_node);
        insertion.onerror = function(evt) {
            console.log("Failed to insert root node", evt, root_node);
        };

    	var keyval = trieindex.objectStore.keyPath;
    	
    	console.log("Iterating through " + trieindex.objectStore.name + " entries...");
    	//iterate through objectstore
    	var opencursor = trieindex.objectStore.openCursor();
		opencursor.onsuccess = function (evt) {
			var cursor = evt.target.result;
			if (cursor) {
				var text = cursor.value[trieindex.indexField];
				var docId = cursor.value[keyval];

                //tokenize string
				var tokenCount = basictokenize(text);
                indexToken(trieindex, docId, Object.keys(tokenCount), 0, cursor);
			} else {
				console.log("All entries indexed.");        
			}
		};
        
		opencursor.onerror = function (evt) {
			console.log(evt);
		};
	};	
	
};
