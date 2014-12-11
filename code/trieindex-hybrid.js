
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
		
		var pendingPaths = {count: 0}
		
		for (token in tokenCount.tokens) {
			var weight = tokenCount.tokens[token];
			
			if (this.mode == "suffix") {
				token = reverse(token);
			}
			
			pendingPaths.count++;
			
			getToken(token, docIdsDict, pendingPaths, ret);
		}
		
		return ret;
	};
	
	// Search for one single prefix
	function getToken(token, docIdsDict, pendingPaths, ret) {
		pendingPaths = pendingPaths || {count: 1};
		var getter = me.store.get(token);
		
		getter.onsuccess = function (evt) {
			var node = evt.target.result;
			
			if (!node) {
				pendingPaths.count--;
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
				// DocIds: Documents that contain this word *as a whole token*
				// Notice that the same document cannot add both docIds and
				// children to the same node for the same token
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
		var cursor = this.objectStore.openCursor();
		
		cursor.onsuccess = function (evt) {
			var cursor = evt.target.result;
			
			if (cursor) {
				indexDocument(cursor.value);
				
				// At this point, we’ve initiated requests to index all tokens in this document
				// (even if they haven't completed yet, cause async), so let’s move on to the next document, chop chop!
				cursor.continue();
			} else {
				console.log("All entries indexed.");
				//me.shrink();	
			}
			
		};
		
		cursor.onerror = me.onerror;
	};
	
	this.shrink = function () {
		console.log('Begin trie shrinking…');
		
		var cursor = this.store.openCursor();
		
		cursor.onsuccess = function (evt) {
			var cursor = evt.target.result;
			
			if (cursor) {
				var node = cursor.value;
				
				if (node.children && node.children.length == 1 && !node.docIds) {
					// Collapse this node with its child
					var parentStep = -(node.parent || 1); // Characters to remove to reach parent key
					var parentPointer = node.prefix.slice(parentStep); // The pointer the parent has to reach this node
					var parentPrefix = node.prefix.substr(0, node.prefix.length + parentStep);
					var childPrefix = node.prefix + node.children[0];
					
					//if (/^james/.test(node.prefix)) {
						//console.log(node.prefix, parentPrefix, childPrefix, parentStep, parentPointer);
					//}
					
					// Go to parent and modify the pointer to this child to point to the grandchild instead
					me.store.get(parentPrefix).onsuccess = function (evt) {
						var parent = evt.target.result;
						
						if (parent && parent.children) {
							var i = parent.children.indexOf(parentPointer);
							
							if (i > -1) {
								parent.children[i] = parentPointer + node.children[0];
								
								me.store.put(parent).onsuccess = function () {
									// Go to child and increment its parent step
									me.store.get(childPrefix).onsuccess = function (evt) {
										var child = evt.target.result;
										
										if (child) {
											child.parent = child.parent + 1 || 2;
											
											if (node.parent > 1) child.parent += node.parent - 1;
											
											me.store.put(child).onsuccess = function (evt) {
												// These steps cannot be done in parallel, because
												// then subsequent shrinkage fails, because nodes cannot
												// locate their parent without correct parent step info
												cursor.continue();
											}
										}
									}
								}
							}
							else {
								//throw new Error("Can't find " + node.prefix + " in the children of " + parentPrefix);
								cursor.continue();
							}
						}
						else {
							//throw new Error("Can't find parent of " + node.prefix + ". I tried " + parentPrefix + " but no avail");
							cursor.continue();
						}
					}
					
					// Delete this node, as it’s not needed any more
					me.store.delete(node.prefix);
				}
				else {
					cursor.continue();
				}
			} else {
				// cursor done
				console.log('Shrinkage done!');	
			}
			
		};
		
		cursor.onerror = me.onerror;
	}
	
	// Generic error handler, so we don't litter our code with separate ones all over
	this.onerror = function (evt) {
		console.error(this.error, evt, this);
	}
};