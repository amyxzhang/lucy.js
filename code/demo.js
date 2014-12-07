
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
	var me = this;
	resetDBVersion();
	
	var loadingStatus = $('.loading-status');
	var importData = indexedDB.import(databaseName, dataFile);
	
	importData.onstatusupdate = function (status) {
		console.log(status);
		loadingStatus.textContent = status;
	};
	
	importData.onsuccess = function () {
		loadingStatus.textContent = '';
		me.classList.add('done');
	};	
};

$('#build-inv-index').onclick = function () {
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

$('#build-prefix-index').onclick = function () {
	var loadingStatus = $('.loading-status');
	
	incrementDBVersion();
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);

	DBOpenRequest.onupgradeneeded = function(evt) {
		var transaction = evt.target.transaction;
		
		// table to create index on
		var objectStore = transaction.objectStore("tweets");
		
		// field to create index on
		objectStore.createIndex("tweet_text_prefix", "text", {type: "prefix", dbconn: evt.target.result});
	};
	
	DBOpenRequest.onsuccess = function(evt) {
		evt.target.result.close();
		console.log('Finished creating index.');
	};

};

$('#build-suffix-index').onclick = function () {
	var loadingStatus = $('.loading-status');
	
	incrementDBVersion();
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);

	DBOpenRequest.onupgradeneeded = function(evt) {
		var transaction = evt.target.transaction;
		
		// table to create index on
		var objectStore = transaction.objectStore("tweets");
		
		// field to create index on
		objectStore.createIndex("tweet_text_suffix", "text", {type: "suffix", dbconn: evt.target.result});
	};
	
	DBOpenRequest.onsuccess = function(evt) {
		evt.target.result.close();
		console.log('Finished creating index.');
	};

};


// TODO This needs to use the other types of indices as well.
$(".search").onsubmit = function () {
	
	var searchQuery = $('#search-query', this).value;
	
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);
	DBOpenRequest.onsuccess = function(evt) {
		var db = event.target.result;
		var transaction = db.transaction(["tweets", "tweet_text"], "readonly");
		var objectStore = transaction.objectStore("tweets");
		
		var index = objectStore.index("text");
		
		// get returns a single entry (one with lowest key value)
		var request = index.get(searchQuery);
		
		request.onerror = function(evt) {
			console.log(evt, searchQuery);
		};
		
		request.onsuccess = function(evt) {
			if (request.result.length == 0) {
				var result = "No results";
			} else {
				var result = request.result.reduce(function(prev, tweet) {
					return prev + '<li><a href="http://twitter.com/' + tweet.username + '" class="user">' + tweet.username + '</a>: ' + tweet.text + 
					       '<a href="http://twitter.com/' + tweet.username + '/' + 'status/' + tweet.id + '" class="date">' + tweet.date +
					       "</a></li>";
				}, '');
			}
			
			$('.search-results ul').innerHTML = result;
		};
		
		evt.target.result.close();
	};
	
	DBOpenRequest.onerror = function(evt) {
		console.log(evt);
	};
	
	return false;
};


