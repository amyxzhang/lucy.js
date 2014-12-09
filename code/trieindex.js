
/*
Constructs a TrieIndex for prefix/suffix search.
*/

var TrieIndex = function(objStore, name, field, mode, maxDepth) {
	var me = this;

	this.objectStore = objStore; // overriden before index is used
    this.transaction = objStore && objStore.transaction; // overriden before index is used
	this.unique = false;
	this.indexField = field;
    this.mode = mode;
    this.name = name;
    this.indexName = this.name + "_index";
    this.maxDepth = -1;
    if (maxDepth) {
        this.maxDepth = maxDepth;
    }

    function hasMaxDepth() {
        return me.maxDepth != -1;
    }
	
    // Perform prefix search
    // Return list of document objects with matches
    this.get = function(text) {
        var trieIndex = this.index.index(this.indexName);
        var docIdsDict = {};

        var ret = new IDBIndexRequest(this.objectStore, this.transaction);

        var tokenCount = Lucy.tokenize(text, {disableStemming: true});
        var finishCounter = {count: Object.keys(tokenCount.tokens).length};
        
        for (token in tokenCount.tokens) {
            var weight = tokenCount.tokens[token];
            
            if (this.mode == "suffix") {
                token = reverse(token);
            }
            
            searchHelper(trieIndex, docIdsDict, token, weight, 0, ret, this.objectStore, finishCounter);
        }
        
        return ret;
    };

    function searchHelper(metaIndex, docIdsDict, token, weight, parentId, ret, objStore, finishCounter) {
        if (token.length == 0) {
            finishCounter.count--;
            
            if (finishCounter.count == 0) {
                populateResultText(docIdsDict, ret, objStore);
            }
        }

        var c = token.charAt(0);
        var request = metaIndex.get([parentId, c]);
        (function(metaIndex, token, weight, parentId, ret, objStore, finishCounter) {        
            request.onsuccess = function(evt) {
                if (evt.target.result) {
                    var result = evt.target.result;
                    if (token.length == 1) {
                        finishCounter.count--;
                        
                        for (var i=0; i<result.docIds.length; i++) {
                            docId = result.docIds[i];
                            
                            docIdsDict[docId] = docIdsDict[docId] || 0;
                            docIdsDict[docId] += weight;
                        }
                        
                        if (finishCounter.count == 0) {
                            populateResultText(docIdsDict, ret, objStore);
                        }
                    } else if (Object.keys(result.wordMap).length != 0) { // reached maxDepth
                        finishCounter.count--;
                        var rem = token.substring(1);
                        for (var key in result.wordMap) {
                            if (key.indexOf(rem) == 0) {
                                var matches = result.wordMap[key];
                                for (var i=0; i < matches.length; i++) {
                                    var m = matches[i];
                                    docIdsDict[m] = docIdsDict[docId] || 0;
                                    docIdsDict[m] += weight;
                                }
                            }
                        }
                        if (finishCounter.count == 0) {
                            populateResultText(docIdsDict, ret, objStore);
                        }
                    } else {
                        searchHelper(metaIndex, docIdsDict, token.substring(1), weight, result.id, ret, objStore, finishCounter);
                    }
                } else {
                    finishCounter.count--;
                    
                    if (finishCounter.count == 0) {
						populateResultText(docIdsDict, ret, objStore);
					}
                }
            };
            
            request.onerror = function(evt) {
    			console.log(evt, token);
    			ret.onerror();
    		};
        })(metaIndex, token, weight, parentId, ret, objStore, finishCounter);
    }

    function populateResultText(docIdsDict, ret, objStore) {
        var resultsDict = {};
        var finish_counter = { count: Object.keys(docIdsDict).length };
        
        if (finish_counter.count == 0) {
            ret.result = [];
            ret.onsuccess();
        }
        
        for (var docId in docIdsDict) {
            (function(docId) {
                var requestText = objStore.get(docId);
                
                requestText.onerror = function(evt) {
                    console.log(evt);
                    ret.onerror();
                };
                
                requestText.onsuccess = function(evt) {
                    if (evt.target.result){
                        var score = docIdsDict[docId];
                        resultsDict[docId] = evt.target.result;
                        resultsDict[docId].score = score;
                        finish_counter.count--;
                    }
                    if (finish_counter.count == 0) {
                        ret.result = Lucy.convert_dict(resultsDict);
                        ret.onsuccess();
                    }
                };
            })(docId);
        }
    }

    var reverse = function(text) {
        return text.split("").reverse().join("");
    }

    // Tokenize and normalize data before insertion.
    this.insert = function(text, docId) {
        //tokenize string
        var tokens = Object.keys(Lucy.tokenize(text, {disableStemming: true}).tokens);
        
        if (me.mode == "suffix") {
        	tokens = tokens.map(function (token) { return reverse(token); });
        }
        
        indexToken(docId, tokens, 1);
    };

    function indexToken(docId, tokens, parentId, cursor, depth) {
        if (tokens.length == 0) {
            if (cursor) {
                cursor.continue();
            }
            return;
        }
        
        token = tokens[0];
        
        if (token.length == 0) {
            tokens.shift(); // Remove first word from list of tokens
            
            return indexToken(docId, tokens, 0, cursor, 1);
        }
        
        var c = token.charAt(0);
        var getter = me.index.get([parentId, c]);
        
        getter.onsuccess = function(evt) {
            var object = evt.target.result || {parent_char: [parentId, c], docIds: [], wordMap: {}};
            
            if (object.docIds.indexOf(docId) == -1) {
            	object.docIds.push(docId);
            }

            if (hasMaxDepth() && depth >= me.maxDepth) {
                var rem = token.slice(1);
                if (rem in object.wordMap) {
                    if (object.wordMap[rem].indexOf(docId) == -1) {
                        object.wordMap[rem].push(docId);
                    }
                } else {
                    object.wordMap[rem] = [docId];
                }
            }
                            
            var insertion = me.store.put(object);
            
            insertion.onerror = function(evt) {
                console.log("Insertion error", evt, object);
            };
            
            insertion.onsuccess = function(evt) {
                tokens[0] = token.slice(1); // Remove first character
                if (hasMaxDepth()) {
                    if (depth < me.maxDepth) {
                        depth = depth+1; // Increment depth
                        indexToken(docId, tokens, evt.target.result, cursor, depth);
                    } else {
                        // max depth reached
                        tokens.shift();
                        indexToken(docId, tokens, 0, cursor, 1);
                    }
                } else {
                    indexToken(docId, tokens, evt.target.result, cursor, depth);
                }
            };
        };
        
        getter.onerror = function(evt) {
            console.log(evt, c, parentId);
        };
    }
    
    this.build = function(db) {
    	// create object store for trie
    	this.store = db.createObjectStore(name, { keyPath: "id", autoIncrement: true, ifExists: "replace" });
    	console.log("Created Index object store");

        // create index on the object store
        this.index = me.store.createIndex(me.indexName, "parent_char", { unique:true, multiEntry:false });
        console.log("Created index for trie");
        var rootNode = {"id": 0, "parent_char": [-1, ''], "docIds": []};
        
        var insertion = me.store.add(rootNode);
        insertion.onerror = function(evt) {
            console.log("Failed to insert root node", evt, rootNode);
        };

    	var keyval = this.objectStore.keyPath;
    	
    	console.log("Iterating through " + me.objectStore.name + " entries...");
    	
    	// iterate through objectstore
    	var opencursor = this.objectStore.openCursor();
    	
		opencursor.onsuccess = function (evt) {
			
			var cursor = evt.target.result;
			
			if (cursor) {
				var text = cursor.value[me.indexField];
				var docId = cursor.value[keyval];

                // tokenize string
				var tokens = Object.keys(Lucy.tokenize(text, {disableStemming: true}).tokens);
				
                if (me.mode == "suffix") {
                	tokens = tokens.map(function (token) { return reverse(token); });
                }
                
                indexToken(docId, tokens, 0, cursor, 1);
                
			} else {
				console.log("All entries indexed.");        
			}
			
		};
        
		opencursor.onerror = function (evt) {
			console.log(evt);
		};
	};	
	
};