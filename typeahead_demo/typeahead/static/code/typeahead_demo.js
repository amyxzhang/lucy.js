
function now() {
	return self.performance? performance.now() : Date.now();
}

var databaseName = "LucyTest";
var dataFile = "data/tweets2.json";
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

$('#delete-data').click( function () {
	indexedDB.deleteDatabase(databaseName);
	
	$.ajax({
	    url: "delete_tweets",
	    success: function(){
	      console.log("Everything deleted");
	    }
	});
});

//Send all data to server
$('#send-data1').click( function () {
			
	$.ajax({
	    url: "insert_tweets1",
	    
	    success: function(){
	      console.log("Everything inserted");
	    }
	});
	
});
 
$('#the-basics .typeahead').typeahead({
  hint: true,
  highlight: true,
  minLength: 1
},
{
  name: 'states',
  displayKey: 'value',
  source: function (query, process) {
  	return $.get('/search/' + query, {}, function (data) {
  		console.log(data);
            return process(data.options);
        });
  }
});


$('#import-data').click(function () {
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
});

$('#build-inv-index').click(function () {
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
});

$('#build-prefix-index').click(function () {
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
});

$('#build-suffix-index').click( function () {
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
			console.log('yolo');
		evt.target.result.close();
		console.log('Finished creating index.');
	};

});

function search(db, query, objectStore) {
	var startTime = now();
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
	var request = index.get(query.replace(/%/g, ''));
	
	request.onerror = function(evt) {
		console.error(evt, query);
	};
	
	request.onsuccess = function(evt) {
		$('.search-results .count').textContent = request.result.length + ' ';
		$('.search-results .duration').textContent = (now() - startTime).toFixed(2) + 'ms';
		
		if (request.result.length == 0) {
			var result = "No results";
		} else {
			var result = request.result.reduce(function(prev, tweet) {
				return prev + '<li><a href="http://twitter.com/' + tweet.username + '" class="user">' + tweet.username + '</a>: ' + tweet.text + 
				       '<a href="http://twitter.com/' + tweet.username + '/' + 'status/' + tweet.id + '" class="date">' + tweet.date +
				       "</a> Score: " + Math.round(tweet.score *100)/100 + "</li>";
			}, '');
		}
		
		$('.search-results ul').innerHTML = result;
	};
}


// TODO This needs to use the other types of indices as well.
$(".search").submit( function () {
	
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
});


