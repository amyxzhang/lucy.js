
/*
Constructs an InvIndex for full-text search.
*/


var InvIndex = function(objStore, name, field, language) {
	var me = this;
	
	this.objectStore = objStore;
	this.transaction = objStore && objStore.transaction;
	
	this.name = name;
	this.language = language;
	this.indexField = field;
	this.unique = false;
	this.normalization = 1;
	this.enablePosition = true;
	
    // Perform index search for a phrase
    this.get = function(text) {
    	var ret = new IDBIndexRequest(this.objectStore, this.transaction);
    	var result_ids;
    	
    	var tokenCount = Lucy.tokenize(text);
    	
    	var result_dict = {};
    	
    	var finish_counter = {count: 0};
    	for (var token in tokenCount.tokens) {
    		finish_counter[token] = undefined;
    		finish_counter.count++;
    	}
    	    	
		var check_done = function() {
			for (var vals in finish_counter) {
				if (finish_counter[vals] != 0) {
					return false;
				}
			}
			if (finish_counter.count == 0) {
				return true;
			} else {
				return false;
			}
		};

    	for (var token in tokenCount.tokens) {
    		var request = this.index.get(token);
    		
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
						var split = result_ids[j].split(':');
						var doc_id = split[0];
						
						var request_text = me.objectStore.get(split[0]);
	    				var doc_positions = split.length == 2? split[1] : undefined;
	    				
						if (doc_id in result_dict) {
							result_dict[doc_id].score = result_dict[doc_id].score? result_dict[doc_id].score + 1 : 1;
							result_dict[doc_id].positions = result_dict[doc_id].positions || {};
							if (me.enablePosition) {
	    						result_dict[doc_id].positions[curr_token] = doc_positions;
	    					}
	    					finish_counter[curr_token]--;
							continue;
						} else {
							result_dict[doc_id] = {};
						}

		    			request_text.onerror = function(evt) {
			    			console.log(evt, token);
			    			ret.onerror();
			    		};
		    			
		    			request_text.onsuccess = function(evt) {
		    				finish_counter[curr_token]--;
		    				var result = evt.srcElement.result;

		    				if (result){
		    					result.score = result_dict[result.id].score? result_dict[result.id].score + 1 : 1;
		    					result.positions = result_dict[result.id].positions || {};
		    					
		    					if (me.enablePosition) {
	    							result.positions[curr_token] = doc_positions;
	    						}
		    					result_dict[result.id] = result; 					
		    				}
		    				if (check_done()) {
		    					if (me.enablePosition) {
		    						Lucy.calculateCoverDensity(result_dict, me.normalization);
		    					} else {
		    						Lucy.calculateWeight(result_dict, me.normalization);
		    					}
		    					
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
    	var tokenCount = Lucy.tokenize(text, {enablePosition: this.enablePosition});
		var tokens = tokenCount.tokens;
		
		for (var token in tokens) {
			indexToken(id, token, tokenCount[token]);
		}
    };
	
	function indexToken(id, token, count) {	
		var getter = me.index.get(token);
		
		getter.onsuccess = function(evt) {
			var cursor = getter.result;
			var concatCounts = "";
			
			if (me.enablePosition) {
				concatCounts += count[0];
				for (var i=1; i<count.length; i++) {
					concatCounts += "," + count[i];
				}
			}
			
			if (cursor) {
				var update_obj = getter.result;
	  			var ids = update_obj.ids;
	  			if (me.enablePosition) {
	  				ids.push(id + ":" + concatCounts);
	  			} else {
	  				ids.push(id);
	  			}
				var insertion = me.index.put(update_obj);
				insertion.onerror = function(evt) {
					console.log(evt, update_obj);
				};
			} else {
				if (me.enablePosition) {
					var insert_obj = {"token": token, "ids": [id + ":" + concatCounts]};
				} else {
					var insert_obj = {"token": token, "ids": [id]};
				}
				
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
    
    this.build = function(db) {
    	Lucy.normalize(this.objectStore, me.indexField, {types: [1,2]});  
    	
    	//create inverted index for field
    	this.index = db.createObjectStore(name, { keyPath: "token", ifExists: "replace" });
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
				var tokenCount = Lucy.tokenize(value, {enablePosition: me.enablePosition});
				
				var tokens = tokenCount.tokens;
				for (var token in tokens) {
					indexToken(id, token, tokenCount.tokens[token]);
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
