
/*
Constructs an InvIndex for full-text search.
*/


var InvIndex = function(objStore, name, field, dbconn, language) {
	var me = this;
	
	this.objectStore = objStore;
	this.transaction = objStore && objStore.transaction;
	
	this.name = name;
	this.language = language;
	this.indexField = field;
	this.unique = false;
	
    // Perform index search for a phrase
    this.get = function(text) {
    	var ret = new IDBIndexRequest(this.objectStore, this.transaction);
    	var result_ids;
    	var objStore = this.objectStore;
    	
    	var tokenCount = Lucy.tokenize(text);
    	
    	var result_dict = {};
    	
    	var finish_counter = {count: 0};
    	for (var token in tokenCount.tokens) {
    		finish_counter[token] = undefined;
    		finish_counter.count++;
    	}
    	
		var check_done = function() {
			if (finish_counter.count == 0) return true;
			for (var vals in finish_counter) {
				if (finish_counter[vals] != 0) {
					return false;
				}
			}
			return true;
		};

    	for (var token in tokenCount.tokens) {
    		var request = this.index.get(token);
    		var weight = tokenCount.tokens[token];
    		request.onerror = function(evt) {
    			console.log(evt, token);
    			ret.result = evt.result;
    			ret.onerror();
    		};
    		request.onsuccess = function(evt) {
    			finish_counter.count--;
				if (evt.srcElement.result) {
					var curr_token = evt.srcElement.result.token;
					var result_ids = evt.srcElement.result.ids;
					
					finish_counter[curr_token] = result_ids.length;
					
					for (var j=0; j<result_ids.length; j++) {
	    				var request_text = objStore.get(result_ids[j]);
	    				
		    			request_text.onerror = function(evt) {
			    			console.log(evt, token);
			    			ret.onerror();
			    		};
		    			
		    			request_text.onsuccess = function(evt) {
		    				finish_counter[curr_token]--;
		    				var result = evt.srcElement.result;
		    				if (result){
		    					if (result.id in result_dict) {
		    						result_dict[result.id].score += weight;
		    					} else {
			    					result_dict[result.id] = result;
			    					result_dict[result.id].score = weight;
			    				}
		    				}
		    				if (check_done()) {
		    					ret.result = Lucy.convert_dict(result_dict);
								ret.onsuccess();
							}
		    			};
	    			}
				} else {
					if (check_done()) {
						ret.result = Lucy.convert_dict(result_dict);
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
	
	function indexToken(id, token, count) {	
		var getter = me.index.get(token);
		
		getter.onsuccess = function(evt) {
			var cursor = getter.result;
			
			if (cursor) {
				var update_obj = getter.result;
	  			var ids = update_obj.ids;
	  			ids.push(id);
				var insertion = me.index.put(update_obj);
				insertion.onerror = function(evt) {
					console.log(evt, update_obj);
				};
			} else {
				var insert_obj = {"token": token, "ids": [id]};
				var insertion = me.index.add(insert_obj);

				insertion.onerror = function(evt) {
					console.log(evt, insert_obj);
				};
			}
  			
		};
		
		getter.onerror = function(evt) {
			console.log(evt, token);
		};
	}
    
    this.build = function() {
    	
    	//create inverted index for field
    	this.index = dbconn.createObjectStore(name, { keyPath: "token" });
    	console.log("Created Index object store");

    	var keyval = this.objectStore.keyPath;
    	
    	console.log("Iterating through " + this.objectStore.name + " entries...");
    	
    	//iterate through objectstore
    	var opencursor = this.objectStore.openCursor();
		opencursor.onsuccess = function (evt) {
			var cursor = evt.target.result;
			if (cursor) {
				var value = cursor.value[me.indexField];
				var id = cursor.value[keyval];
				//tokenize string
				var tokenCount = Lucy.tokenize(value);
				
				var tokens = tokenCount.tokens;
				for (var token in tokens) {
					indexToken(id, token, tokenCount[token]);
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
