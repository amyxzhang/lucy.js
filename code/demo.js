function $(expr, con) {
	return typeof expr === 'string'? (con || document).querySelector(expr) : expr;
}

function $$(expr, con) {
	return Array.prototype.slice.call((con || document).querySelectorAll(expr));
}

function now() {
	return self.performance? performance.now() : Date.now();
}

var databaseName = "LucyTest";
var dataFile = "data/tweets.json";
var currentDBVersion;

(function() {
	// Init
	loadDBVersion();
	
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);
	
	DBOpenRequest.onsuccess = function(evt) {
		Lucy.init(evt.target.result);
	};
})();

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
	incrementDBVersion();
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);

	DBOpenRequest.onupgradeneeded = function(evt) {
		var transaction = evt.target.transaction;
		
		// table to create index on
		var objectStore = transaction.objectStore("tweets");
		
		// field to create index on
		objectStore.createIndex("tweets_text", "text", {type: "inverted", db: evt.target.result});
	};
	
	DBOpenRequest.onsuccess = function(evt) {
		evt.target.result.close();
		console.log('Finished creating index.');
	};
};

$('#build-prefix-index').onclick = function () {
	incrementDBVersion();
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);

	DBOpenRequest.onupgradeneeded = function(evt) {
		var transaction = evt.target.transaction;
		
		// table to create index on
		var objectStore = transaction.objectStore("tweets");
		
		// field to create index on
		objectStore.createIndex("tweets_text_prefix", "text", {type: "prefix", db: evt.target.result});
	};
	
	DBOpenRequest.onsuccess = function(evt) {
		evt.target.result.close();
		console.log('Finished creating index.');
	};
	
	DBOpenRequest.onblocked = function (evt) {
		console.error('Database is blocked yo!');
	}
};

$('#build-suffix-index').onclick = function () {
	incrementDBVersion();
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);

	DBOpenRequest.onupgradeneeded = function(evt) {
		var transaction = evt.target.transaction;
		
		// table to create index on
		var objectStore = transaction.objectStore("tweets");
		
		// field to create index on
		objectStore.createIndex("tweets_text_suffix", "text", {type: "suffix", db: evt.target.result});
	};
	
	DBOpenRequest.onsuccess = function(evt) {
		evt.target.result.close();
		console.log('Finished creating index.');
	};

};

function search(db, query, objectStore, optionalArgs) {
	var startTime = now();
    var request;
    
    if (optionalArgs && optionalArgs.noIndex) {
        // optional arg to revert to a baseline search of objectStore
        request = Lucy.baselineSearch(db, query, objectStore);
    } else {
        var type = "inverted";
        var indexName = objectStore + '_text';
        
        if (/%$/.test(query)) { // Ends with %?
            // Prefix search
            type = "prefix";
            indexName += '_' + type;
        }
        else if (query.indexOf('%') === 0) { // Starts with %?
            // Suffix search
            type = "suffix"
            indexName += '_' + type;
        }
        
        var transaction = db.transaction([objectStore, indexName], "readonly");
        var objectStore = transaction.objectStore("tweets");

        var index = objectStore.index("text", type);
        
        // get returns a single entry (one with lowest key value)
        request = index.get(query.replace(/%/g, ''));
    }
	
	request.onerror = function(evt) {
		console.error(evt, query);
	};
	
	request.onsuccess = function(evt) {
		var duration = now() - startTime;
		$('.search-results .duration').textContent = duration.toFixed(2) + 'ms';
		$('.search-results .count').textContent = request.result.length + ' ';
		
		if (request.result.length == 0) {
			var result = "No results";
		} else {
			var result = request.result.reduce(function(prev, tweet) {
				return prev + '<article><a href="http://twitter.com/' + tweet.username + '" class="user">' + tweet.username + '</a>: ' + tweet.text + 
				       '<footer><a href="http://twitter.com/' + tweet.username + '/' + 'status/' + tweet.id + '" class="date">' + tweet.date +
				       '</a> <strong class="score">' + Math.round(tweet.score * 100)/100 + "</strong></article>";
			}, '');
		}
		
		$('.search-results div').innerHTML = result;
	};
}


// TODO This needs to use the other types of indices as well.
$(".search").onsubmit = function () {
	
	var searchQuery = $('#search-query', this).value;
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);
	
	DBOpenRequest.onsuccess = function(evt) {
		var db = event.target.result;
		
		search(db, searchQuery, 'tweets');
				
		db.close();
	};
	
	DBOpenRequest.onerror = function(evt) {
		console.log(evt);
	};
	
	return false;
};


