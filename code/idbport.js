indexedDB.import = function (database, src, callback) {
	var ret = {
		// Caller will override these if needed
		onstatusupdate: function(){},
		onsuccess: function(){},
		onerror: function(){}
	};

	// Get file first
	var xhr = new XMLHttpRequest(src);
	
	xhr.open("GET", src);
	
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status < 400) {
			ret.onstatusupdate("Loaded JSON file");
			
			var data = JSON.parse(xhr.responseText);
			
			ret.onstatusupdate("Parsed JSON file");
			
			// Data should be an object with object store names as keys and arrays as values.
			// A special __meta key at the root level defines keypaths, autoincrement behavior etc for every object store
			self.db = undefined;
			
			indexedDB.deleteDatabase(database).onsuccess = function(evt) {
				var DBOpenRequest = indexedDB.open(database);
				
				DBOpenRequest.onsuccess = function (evt) {
					Object.keys(data).forEach(function(id) {
						if (id != "__meta") {
							var count = data[id].length;
							
							ret.onstatusupdate("Loading data in " + id + " (" + count + " objects total)…");
							
							var transaction = db.transaction(id, "readwrite").objectStore(id);
							
							data[id].forEach(function(o, i) {
								if ((i+1) % ~~(count/10) === 0 && count > 100) {
									// For large datasets, offer feedback every 10% of imported data
									ret.onstatusupdate("Loading data in " + id + " (" + (i+1) + " of " + count + ")…");
								}
								
								try { 
									transaction.add(o);
								}
								catch (e) {
									console.error(e, o);
								}
							});
							
							ret.onstatusupdate("Loaded data in " + id + ".");
						}
					});
					
					ret.onsuccess();
					
					evt.target.result.close();
				};
				
				DBOpenRequest.onupgradeneeded = function (evt) {
					db = this.result;
					ret.onstatusupdate("Creating object stores…");
					
					Object.keys(data).forEach(function(id) {
						if (id != "__meta") {
							db.createObjectStore(id, data['__meta'][id]);
						}
					});
					
					ret.onstatusupdate("Created object stores.");
				};
			};
		}
	};
	
	xhr.send();
	
	return ret;
};