
function now() {
	return self.performance? performance.now() : Date.now();
}

var databaseName = "LucyTest";
var dataFile = "data/xad";
var currentDBVersion;

var search_setting;

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
	search_setting = 1;	
	$.ajax({
	    url: "insert_tweets1",
	    success: function(){
	      console.log("Everything inserted");
	    }
	});
});

//get all data from client
$('#send-data2').click( function () {
	search_setting = 2;		
	$.ajax({
	    url: "get_tweets",
	    success: function(data){
	    	var ret = indexedDB.import_data(databaseName, data);
	    	
	    	ret.onsuccess = function () {
	     		console.log("Everything inserted");
	     		build_invindex();
	     };
	    }
	});
});


build_invindex = function () {
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

$(".search").submit(function(evt) {
	evt.preventDefault();
  	var start = (new Date()).getTime();
  	console.log(search_setting);
  	
  	var query = $('#search-query').val();
  	
  	if (search_setting === 1) {
	  	$.get('/search_fulltext/' + query, {}, function (data) {
	        var res = data.options;
	        var stop = ((new Date()).getTime() - start) + 'ms';
	        console.log(stop);
	        
	        console.log(res);
	        $('.search-results .count').text(res.length + ' ');
			$('.search-results .duration').text(stop);
			
			if (res.length == 0) {
				var result = "No results";
			} else {
				var result = res.reduce(function(prev, tweet) {
					return prev + "<li>" + tweet.value + "</li>";
				}, '');
			}
			
			$('.search-results ul').html(result);
	        
	        
	    });
	}
	if (search_setting === 2) {
		var index_res = search_client(query);

		index_res.onsuccess = function() {
			console.log(index_res);
			
			var res = index_res.result.options;
			var stop = ((new Date()).getTime() - start) + 'ms';
	        $('.search-results .count').text(res.length + ' ');
			$('.search-results .duration').text(stop);
			
			if (res.length == 0) {
				var result = "No results";
			} else {
				var result = res.reduce(function(prev, tweet) {
					return prev + "<li>" + tweet.value + "</li>";
				}, '');
			}
			
			$('.search-results ul').html(result);
	        
	        
		};

	}
	return false;
});

search_client = function(searchQuery) {
	var ret = {
		onsuccess: function(){},
	};
	
	var DBOpenRequest = indexedDB.open(databaseName, currentDBVersion);
	
	DBOpenRequest.onsuccess = function(evt) {
		var db = event.target.result;
		
	
		var transaction = db.transaction(["tweets", 'tweets_text'], "readonly");
		var objectStore = transaction.objectStore("tweets");

		var index = objectStore.index("text", "inverted");
	
		// get returns a single entry (one with lowest key value)
		var request = index.get(searchQuery);
	
		request.onerror = function(evt) {
			console.error(evt, searchQuery);
		};
	
		request.onsuccess = function(evt) {
			var res = {options: []};
			
			for (tweet in request.result) {
				res.options.push({value: request.result[tweet].text});
			}
			ret.result = res;
			ret.onsuccess();
	
		};
		db.close();
		
	};
	
	DBOpenRequest.onerror = function(evt) {
		console.log(evt);
	};
	
	return ret;
};


