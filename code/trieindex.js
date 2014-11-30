
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
                if (request.result) {
                    docIds = request.result.docIds;
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
                if (requestText.result){
                    results.append(requestText.result);
                }
            };
        }
        return results;
    };

    var reverse = function(text) {
        return text.split("").reverse().join("");
    }

    // Normalize data before insertion.
    this.insert = function(text, docId) {
        // TODO: normalize data
    	indexText(trieindex, docId text);
    };
	
	function indexText(trieindex, docId, text) {
        if (this.mode == "suffix") {
            text = reverse(text);
        }
        var parentId = 0;
        for (var i=0; i<text.length; i++) {
            var c = text.charAt(i);
            var getter = trieindex.index.get([parentId, c]);
            getter.onsuccess = function(evt) {
                var cursor = getter.result;
                if (cursor) {
                    var update_obj = getter.result;
                    var docIds = update_obj.docIds;
                    docIds.push(docId);
                    var insertion = trieindex.store.put(update_obj);
                    insertion.onerror = function(evt) {
                        console.log(evt, update_obj);
                    };
                    parentId = update_obj.id
				} else {
                    var docIds = [];
                    docIds.push(docId);
                    var insert_obj = {"parentId": parentId, "char": c, "docIds": docIds};
                    var insertion = trieindex.store.add(insert_obj);
                    insertion.onerror = function(evt) {
                        console.log(evt, insert_obj);
                    };
                    parentId = insert_obj.id
                }
            };
            getter.onerror = function(evt) {
                console.log(evt, text);
                break;
            };
        }
	}
    
    function createIndex(trieindex, dbconn) {
    	
    	// create object store for trie
    	trieindex.store = dbconn.createObjectStore(name, { keyPath: "id", autoIncrement:true });
    	console.log("Created Index object store");

        // create index on the object store
        trieindex.index = store.createIndex(name, ["parentId", "char"], { unique:true });
        var root_node = {"id": 0, "parentId": -1, "char": '', "docIds": []};
        var insertion = trieindex.index.add(root_node);
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
				indexText(trieindex, docId, text);
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
