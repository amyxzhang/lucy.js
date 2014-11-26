
var databaseName = "LucyTest";
var dataFile = "data/tweets.json";
var currentDBVersion = 1;

function $(expr, con) {
	return typeof expr === 'string'? (con || document).querySelector(expr) : expr;
}

function $$(expr, con) {
	return Array.prototype.slice.call((con || document).querySelectorAll(expr));
}

$('#import-data').onclick = function () {
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
	
	var DBOpenRequest = indexedDB.open(databaseName, ++currentDBVersion);

	DBOpenRequest.onupgradeneeded = function(evt) {
		var transaction = evt.target.transaction;
		
		// table to create index on
		var objectStore = transaction.objectStore("tweets");
		
		IndexedFields["tweets"] = "text";
		
		// field to create index on
		objectStore.createIndex("tweet_text", "text", {type: "inverted", dbconn: evt.target.result});
		
	};
	
	DBOpenRequest.onsuccess = function(evt) {
		evt.target.result.close();
		console.log('Finished creating index');
	};

};