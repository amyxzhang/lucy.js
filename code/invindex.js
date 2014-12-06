
/*
Constructs an InvIndex for full-text search.
*/

var InvIndex = function(objStore, name, field, dbconn) {

	this.objectStore = objStore;
	this.name = name;
	this.unique = false;
	this.transaction = objStore.transaction;
	
	this.indexField = field;
	
	createIndex(this, dbconn);
	
    // Perform index search for a phrase
    this.get = function(text) {
    	var ret = new IDBIndexRequest(this.objectStore, this.transaction);
    	var result_id;
    	var objStore = this.objectStore;
    	
    	var tokenCount = Lucy.tokenize(text);
    	for (var token in tokenCount) {
    		var request = this.index.get(token);
    		request.onerror = function(evt) {
    			console.log(evt, token);
    			ret.result = evt.result;
    		};
    		request.onsuccess = function(evt) {
    			var result = request.result.ids;
    			console.log(result);
    			for (var i=0; i<result.length; i++) {
    				result_id = result[i];
    			}
   				
   				var request_text = objStore.get(result_id);
   				request_text.onerror = function(evt) {
    				console.log(evt, token);
    				return evt;
    			};
    			request_text.onsuccess = function(evt) {
    				console.log(request_text);
    				if (request_text.result){
    					ret.result = request_text.result;
    					ret.onsuccess();
    				} else {
    					ret.result = evt;
    				}
    			};
    			
   				
    		};
    	}
    	return ret;
    };

    // Tokenize and normalize data before insertion.
    this.insert = function(text) {
    	var tokenCount = Lucy.tokenize(text);
				
		for (var token in tokenCount) {
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
				
				for (var token in tokenCount) {
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
