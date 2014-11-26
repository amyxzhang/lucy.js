
var databaseName = "LucyTest";
var dataFile = "data/tweets.json";
var currentDBVersion;

loadDBVersion();

function $(expr, con) {
	return typeof expr === 'string'? (con || document).querySelector(expr) : expr;
}

function $$(expr, con) {
	return Array.prototype.slice.call((con || document).querySelectorAll(expr));
}

function loadDBVersion() {
	var key = databaseName + "version";
	if (localStorage.getItem(key)) {
		currentDBVersion = localStorage.getItem(key);
	} else {
		currentDBVersion = 1;
	}
}

function incrementDBVersion() {
	var key = databaseName + "version";
	localStorage.setItem(key, ++currentDBVersion);
}

function resetDBVersion() {
	var key = databaseName + "version";
	currentDBVersion = 1;
	localStorage.setItem(key, 1);
}

$('#import-data').onclick = function () {
	resetDBVersion();
	
	var loadingStatus = $('.loading-status');
	var importData = indexedDB.import(databaseName, dataFile);
	
	importData.onstatusupdate = function (status) {
		console.log(status);
		loadingStatus.textContent = status;
	};
	
	importData.onsuccess = function () {
		loadingStatus.textContent = '';
	};	
};

$('#build-index').onclick = function () {
	var loadingStatus = $('.loading-status');
	
	incrementDBVersion();
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);

	DBOpenRequest.onupgradeneeded = function(evt) {
		var transaction = evt.target.transaction;
		
		// table to create index on
		var objectStore = transaction.objectStore("tweets");
		
		// field to create index on
		objectStore.createIndex("tweet_text", "text", {type: "inverted", dbconn: evt.target.result});
	};
	
	DBOpenRequest.onsuccess = function(evt) {
		evt.target.result.close();
		console.log('Finished creating index.');
	};

};


$("#submit-search").onclick = function () {
	
	var searchQuery = $('#search-query').value;
	
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);
	DBOpenRequest.onsuccess = function(evt) {
		var db = event.target.result;
		var transaction = db.transaction(["tweets"], "readonly");
		var objectStore = transaction.objectStore("tweets");
		
		var index = objectStore.index("text");
		
		//get returns a single entry (one with lowest key value)
		var request = index.get(searchQuery);
		request.onerror = function(evt) {
			console.log(evt, searchQuery);
		};
		request.onsuccess = function(evt) {
			console.log(evt);
			var searchResults = $('.search-results');
			searchResults.textContent = evt;
		};
		
		evt.target.result.close();
	};
	DBOpenRequest.onerror = function(evt) {
		console.log(evt);
	};
	return false;
};


