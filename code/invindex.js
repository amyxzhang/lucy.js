
/*
Constructs an InvIndex for full-text search.
*/

var InvIndex = function(objStore, name, field, dbconn, language) {

	this.objectStore = objStore;
	this.name = name;
	this.unique = false;
	this.transaction = objStore.transaction;
	
	this.language = language;
	this.indexField = field;
	
	createIndex(this, dbconn);
	
    // Perform index search for a phrase
    this.get = function(text) {
    	var ret = new IDBIndexRequest(this.objectStore, this.transaction);
    	var result_ids;
    	var objStore = this.objectStore;
    	
    	var tokenCount = Lucy.tokenize(text);
    	
    	ret.result = [];
		var counter = 0;
    	for (var token in tokenCount.tokens) {
    		var request = this.index.get(token);
    		counter++;
    		
    		request.onerror = function(evt) {
    			console.log(evt, token);
    			ret.result = evt.result;
    			ret.onerror();
    		};
    		request.onsuccess = function(evt) {
				if (request.result) {
					var result_ids = request.result.ids;
					for (var j=0; j<result_ids.length; j++) {
	    				var request_text = objStore.get(result_ids[j]);
		    			request_text.onerror = function(evt) {
			    			console.log(evt, token);
			    			ret.onerror();
			    		};
		    			request_text.onsuccess = function(evt) {
		    				if (evt.srcElement.result){
		    					ret.result.push(evt.srcElement.result);
		    				}
		    				if (counter == tokenCount.length && j == result_ids.length) {
								ret.onsuccess();
							}
		    			};
	    			}
				} else {
					if (counter == tokenCount.length) {
						ret.onsuccess();
					}
				}
    		};
    	}
    	return ret;
    };

    // Tokenize and normalize data before insertion.
    this.insert = function(text) {
    	var tokenCount = Lucy.tokenize(text);
		var tokens = tokenCount.tokens;
		
		for (var token in tokens) {
			indexToken(id, token, tokenCount[token]);
		}
    };
	
	function indexToken(invindex, id, token, count) {	
		var getter = invindex.index.get(token);
		getter.onsuccess = function(evt) {
			var cursor = getter.result;
			if (cursor) {
				var update_obj = getter.result;
	  			var ids = update_obj.ids;
	  			ids.push(id);
				var insertion = invindex.index.put(update_obj);
				insertion.onerror = function(evt) {
					console.log(evt, update_obj);
				};
			} else {
				var ids = [];
				ids.push(id);
				var insert_obj = {"token": token, "ids": ids};
				var insertion = invindex.index.add(insert_obj);
				insertion.onerror = function(evt) {
					console.log(evt, insert_obj);
				};
			}
  			
		};
		getter.onerror = function(evt) {
			console.log(evt, token);
		};
	}
    
    function createIndex(invindex, dbconn) {
    	
    	//create inverted index for field
    	invindex.index = dbconn.createObjectStore(name, { keyPath: "token" });
    	console.log("Created Index object store");

    	var keyval = invindex.objectStore.keyPath;
    	
    	console.log("Iterating through " + invindex.objectStore.name + " entries...");
    	//iterate through objectstore
    	var opencursor = invindex.objectStore.openCursor();
		opencursor.onsuccess = function (evt) {
			var cursor = evt.target.result;
			if (cursor) {
				var value = cursor.value[invindex.indexField];
				var id = cursor.value[keyval];
				//tokenize string
				var tokenCount = Lucy.tokenize(value);
				
				var tokens = tokenCount.tokens;
				for (var token in tokens) {
					indexToken(invindex, id, token, tokenCount[token]);
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
