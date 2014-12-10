
/*
Constructs a TrieIndex for prefix/suffix search.
*/

var TrieIndex = function(objStore, name, field, mode, maxDepth) {
	var me = this;

	this.objectStore = objStore; // overriden before index is used
	this.transaction = objStore && objStore.transaction; // overriden before index is used
	this.indexField = field;
	this.mode = mode;
	this.name = name;

	// Perform prefix search
	// Return list of document objects with matches
	this.get = function(text) {
		var docIdsDict = {};
		
		this.store = this.transaction.objectStore(this.name);

		var ret = new IDBIndexRequest(this.objectStore, this.transaction);

		var tokenCount = Lucy.tokenize(text, {disableStemming: true});
		var finishCounter = {count: Object.keys(tokenCount.tokens).length};
		
		for (token in tokenCount.tokens) {
			var weight = tokenCount.tokens[token];
			
			if (this.mode == "suffix") {
				token = reverse(token);
			}
			
			getToken(token, docIdsDict, {count: 0}, ret);
		}
		
		return ret;
	};
	
	// Search for one single prefix
	function getToken(token, docIdsDict, pendingPaths, ret) {
		pendingPaths = pendingPaths || {count: 0};
		var getter = me.store.get(token);
		
		getter.onsuccess = function (evt) {
			var node = evt.target.result;
			
			if (!node) {
				populateResultText(docIdsDict, ret, me.objectStore);
				return;
			}
			
			// If this node has docIds, add them to the results
			if (node.docIds) {
				for (var i=0; i<node.docIds.length; i++) {
					var weight = 1; // TODO
					docIdsDict[node.docIds[i]] = weight;
				}
			}
			
			if (node.children) {
				// MOAR paths to follow!
				pendingPaths.count += node.children.length - 1;
				
				for (var i=0; i<node.children.length; i++) {
					var prefix = token + node.children[i];
					
					getToken(prefix, docIdsDict, pendingPaths, ret);
				}
			}
			else {
				// We’re at the end of this path
				pendingPaths.count--;
				
				if (pendingPaths.count === 0) {
					// We’ve explored the entire subtree, time for results yo!
					console.log(docIdsDict);
					populateResultText(docIdsDict, ret, me.objectStore);
				}
			}
			
		};
	}

	function populateResultText(docIdsDict, ret, objStore) {
		var resultsDict = {};
		var finish_counter = { count: Object.keys(docIdsDict).length };
		
		if (finish_counter.count == 0) {
			ret.result = [];
			ret.onsuccess();
		}
		
		for (var docId in docIdsDict) {
			(function(docId) {
				var requestText = objStore.get(docId);
				
				requestText.onerror = function(evt) {
					console.log(evt);
					ret.onerror();
				};
				
				requestText.onsuccess = function(evt) {
					if (evt.target.result){
						var score = docIdsDict[docId];
						
						resultsDict[docId] = evt.target.result;
						resultsDict[docId].score = score;
						
						finish_counter.count--;
					}
					
					if (finish_counter.count == 0) {
						ret.result = Lucy.convert_dict(resultsDict);
						ret.onsuccess();
					}
				};
			})(docId);
		}
	}

	var reverse = function(text) {
		return text.split("").reverse().join("");
	}

	this.insert = function(text, docId) {
		// TODO, but it should probably call indexDocument() somewhere
	};
	
	// Add a single node to the index
	function addNode(token, docId, child) {
		var getter = me.store.get(token);
		
		getter.onsuccess = function(evt) {
			var node = evt.target.result || { prefix: token };
			var insert = false;
			
			if (child) {
				// It’s an internal node!
				// Children: Characters that could follow
				node.children = node.children || [];
				
				if (node.children.indexOf(child) === -1) {
					node.children.push(child);
					insert = true;
				}
			}
			else {
				// It’s a leaf!
				// DocIds: Documents that contain this word as a whole token
				node.docIds = node.docIds || [];
				
				if (node.docIds.indexOf(docId) === -1) {
					node.docIds.push(docId);
					insert = true;
				}
			}
	
			if (insert) {
				var insertion = me.store.put(node);
				
				// TODO retry or something
				insertion.onerror = me.onerror;
			}
		};
		
		getter.onerror = me.onerror;
	}
	
	// Add a document to the index
	function indexDocument(document) {
		var text = document[me.indexField];
		var docId = document[me.objectStore.keyPath];

		// tokenize string
		var tokens = Object.keys(Lucy.tokenize(text, {disableStemming: true}).tokens);
		
		if (me.mode == "suffix") {
			tokens = tokens.map(function (token) { return reverse(token); });
		}
		
		tokens.forEach(function(token) {
			var child = null;
			
			// Add prefixes for every letter in the token
			// We start from the entire token and progressively chop off its last character
			while (token.length > 0) {
				addNode(token, docId, child);
				
				child = token[token.length - 1];
				token = token.slice(0, token.length - 1);
			}
		});
	}

	this.build = function(db) {
		// create object store for trie
		this.store = db.createObjectStore(name, { keyPath: "prefix", ifExists: "replace" });

		console.log("Iterating through " + me.objectStore.name + " entries...");
		
		// iterate through objectstore
		var opencursor = this.objectStore.openCursor();
		
		opencursor.onsuccess = function (evt) {
			
			var cursor = evt.target.result;
			
			if (cursor) {
				indexDocument(cursor.value);
				
				// At this point, we’ve initiated requests to index all tokens in this document
				// (even if they haven't completed yet, cause async), so let’s move on to the next document, chop chop!
				cursor.continue();
			} else {
				console.log("All entries indexed.");		
			}
			
		};
		
		opencursor.onerror = me.onerror;
	};	
	
	// Generic error handler, so we don't litter our code with separate ones all over
	this.onerror = function (evt) {
		console.error(this.error, evt, this);
	}
};