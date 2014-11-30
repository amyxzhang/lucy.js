
/*
Constructs a TrieIndex for prefix/suffix search.
*/

var TrieIndex = function(objStore, name, field, mode, dbconn) {

	this.objectStore = objStore;
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
        var docIds;
    	var objStore = this.objectStore;
    	
        var parentId = 0;
    	for (var i=0; i<text.length; i++) {
            var c = text.charAt(i);
    		var request = this.index.get([parentId, c]);
    		request.onerror = function(evt) {
    			console.log(evt, text);
    			return evt;
    		};
    		request.onsuccess = function(evt) {
                if (evt.target.result) {
                    docIds = evt.target.result.docIds;
                    console.log(docIds);
                } else {
                    return [];
                }
            };
        }
        var results = [];
        for (var i=0; i<docIds.length; i++) {
            docId = docIds[i];
            console.log(docId);
            var requestText = objStore.get(docId);
            requestText.onerror = function(evt) {
                console.log(evt, text);
                return evt;
            };
            requestText.onsuccess = function(evt) {
                console.log(requestText);
                if (evt.target.result){
                    results.append(evt.target.result);
                }
            };
        }
        return results;
    };

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
	
	function indexToken(trieindex, docId, token) {
        if (this.mode == "suffix") {
            token = reverse(token);
        }
        indexTokenHelper(trieindex, docId, token, 0);
	}

    function indexTokenHelper(trieindex, docId, token, parentId) {
        if (token.length == 0)
            return;
        var c = token.charAt(0);
        var getter = trieindex.index.get([parentId, c]);
        (function(trieindex, docId, token, parentId) {
            getter.onsuccess = function(evt) {
                var cursor = evt.target.result;
                if (cursor) {
                    var update_obj = cursor;
                    var docIds = update_obj.docIds;
                    docIds.push(docId);
                    var insertion = trieindex.store.put(update_obj);
                    insertion.onerror = function(evt) {
                        console.log(evt, update_obj);
                    };
                    insertion.onsuccess = function(evt) {
                        indexTokenHelper(trieindex, docId, token.substring(1), evt.target.result);
                    };
                } else {
                    var docIds = [];
                    docIds.push(docId);
                    var insert_obj = {"parentId": parentId, "char": c, "docIds": docIds};
                    var insertion = trieindex.store.add(insert_obj);
                    insertion.onerror = function(evt) {
                        console.log(evt, insert_obj);
                    };
                    insertion.onsuccess = function(evt) {
                        indexTokenHelper(trieindex, docId, token.substring(1), evt.target.result);
                    };
                }
            };
            getter.onerror = function(evt) {
                console.log(evt, token);
            };
        })(trieindex, docId, token, parentId);
    }
    
    function createIndex(trieindex, dbconn) {
    	
    	// create object store for trie
    	trieindex.store = dbconn.createObjectStore(name, { keyPath: "id", autoIncrement:true });
    	console.log("Created Index object store");

        // create index on the object store
        trieindex.index = trieindex.store.createIndex(name, ["parentId", "char"], { unique:true });
        console.log("Created index for trie");
        var root_node = {"id": 0, "parentId": -1, "char": '', "docIds": []};
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
                for (var token in tokenCount) {
					indexToken(trieindex, docId, token);
				}
				cursor.continue();
			} else {
				console.log("All entries indexed.");
			}
		};
		
		opencursor.onerror = function (evt) {
			console.log(evt);
		};
	};	
	
};
