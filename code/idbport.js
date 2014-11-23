indexedDB.import = function (database, src) {
	// Get file first
	var xhr = new XMLHttpRequest(src);
	
	xhr.open("GET", src);
	
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status < 400) {
			var data = JSON.parse(xhr.responseText);
			
			// Data should be an object with object store names -> arrays with values
			self.db = undefined;
			
			indexedDB.deleteDatabase(database).onsuccess = function(evt) {
				
				var DBOpenRequest = indexedDB.open(database);
				
				DBOpenRequest.onsuccess = function (evt) {
					Object.keys(data).forEach(function(id) {
						if (id != "__meta") {
							var transaction = db.transaction(id, "readwrite").objectStore(id);
							
							data[id].forEach(function(o) {
								try { 
									transaction.add(o);
								}
								catch (e) {
									console.error(e, o);
								}
							});
						}
					});
				};
				
				DBOpenRequest.onupgradeneeded = function (evt) {
					db = this.result;
					console.log("DBOpenRequest.onupgradeneeded", db);
					Object.keys(data).forEach(function(id) {
						if (id != "__meta") {
							db.createObjectStore(id, data['__meta'][id]);
						}
					});
				};
			};
		}
	};
	
	xhr.send();
};