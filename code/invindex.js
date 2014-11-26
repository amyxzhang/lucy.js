
/*
Constructs an InvertedIndex for full-text search.
data - array of strings to be indexed
*/

var InvIndex = function(objStore, name, field, dbconn) {
	
	this.objectStore = objStore;
	this.name = name;
	this.unique = false;
	
	this.dbconn = dbconn;
	this.indexField = field;
	
	createIndex();
	
    // Perform index search for a tokenized word
    this.get = function(word) {
    	console.log("NEVER HERE");
        return null;
    };

    // Tokenize and normalize data before insertion.
    this.insert = function(text) {};

    return this;
    
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
	
	function indexToken(id, token, count) {	
		
		var getter = index.get(token);
		getter.onsuccess = function(evt) {
			var cursor = getter.result;
			if (cursor) {
				var update_obj = getter.result;
	  			var ids = update_obj.ids;
	  			ids.push(id);
				var insertion = index.put(update_obj);
				insertion.onerror = function(evt) {
					console.log(evt, update_obj);
				};
			} else {
				var ids = [];
				ids.push(id);
				var insert_obj = {"token": token, "ids": ids};
				console.log(insert_obj);
				var insertion = index.add(insert_obj);
				insertion.onerror = function(evt) {
					console.log(evt, insert_obj);
				};
			}
  			
		};
		getter.onerror = function(evt) {
			console.log(evt, token);
		};
	}
    
    function createIndex() {
    	
    	//create inverted index for field
    	this.index = dbconn.createObjectStore(name, { keyPath: "token" });

    	var keyval = objectStore.keyPath;
    	
    	//iterate through objectstore
    	var opencursor = objectStore.openCursor();
		opencursor.onsuccess = function (evt) {
			var cursor = evt.target.result;
			if (cursor) {
				var value = cursor.value[indexField];
				var id = cursor.value[keyval];
				//tokenize string
				var tokenCount = basictokenize(value);
				
				for (var token in tokenCount) {
					indexToken(id, token, tokenCount[token]);
				}

				cursor.continue();
			} else {
				console.log("All entries displayed");
			}
		};
		
		opencursor.onerror = function (evt) {
			console.log(evt);
		};
	};	
    	
};
