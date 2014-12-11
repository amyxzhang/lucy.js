/*
 * Lucy.js
 * 
 */

var SUPPORTED_LANGUAGES = [
	'english',  'danish', 'dutch',
	'finnish', 'french', 'german',
	'hungarian', 'italian', 'norwegian',
	'portuguese', 'russian', 'spanish',
	'swedish', 'romanian', 'turkish'];

/*
 * Static class for general purpose natural language processing functions 
 * 
 */

self.Lucy = {};

Lucy.init = function(db) {
	// Fetch all indices from database
	this.indexCache = {};

	if (db.objectStoreNames.contains('__LucyIndices')) {
		var cursor = db.transaction("__LucyIndices", "readonly").objectStore("__LucyIndices").openCursor();
		
		cursor.onsuccess = function (evt) {
			var cursor = evt.target.result;
			
			if (cursor) {
				var val = cursor.value;
				
				if (val.type == 'inverted') {
					var index = new InvIndex(db.transaction(val.store).objectStore(val.store), val.name, val.path);
				}
				else {
					var index = new TrieIndex(db.transaction(val.store).objectStore(val.store), val.name, val.path, val.type);
				}

				Lucy.indexCache[val.type] = Lucy.indexCache[val.type] || {};
				Lucy.indexCache[val.type][val.name] = index;
				
				cursor.continue();
			}
			else {
				db.close();
			}
		};
	}
}

Lucy.language = "english";

// potential options:
// disableStemming
// enablePosition

Lucy.tokenize = function(string, options) {
	options = options || {};
	options.disableStemming = !!options.disableStemming;
	options.enablePosition = !!options.enablePosition;
    options.allowStopWords = !!options.allowStopWords;
	
	string = string.toLowerCase();
	var tokens = string.match(/\w+/g);
	
	var tokenCount = {length: 0, tokens: {}};
	var stopwordCount = {length: 0, tokens: {}};
	
	if (!options.disableStemming) {
		var stemmer = Lucy.stemmer(Lucy.language);
	}

	for (var i=0; i<tokens.length; i++) {
		var stem = options.disableStemming? tokens[i] : stemmer(tokens[i]);
		
        if (options.allowStopWords) {
            var count = tokenCount;
        } else {
            var count = Lucy.isStopWord(tokens[i])? stopwordCount : tokenCount;
        }
		
		
		if (!options.enablePosition) {
			count.tokens[stem] = count.tokens[stem] || 0;
			count.tokens[stem]++;
		} else {
			count.tokens[stem] = count.tokens[stem] || [];
			count.tokens[stem].push(i);
		}
		
		count.length++;
	}
	
	return tokenCount.length > 0? tokenCount: stopwordCount;
};

// optionalArgs.types
//  1 - include document length (after tokenization)
//  2 - include number of uniqueWords
Lucy.normalize = function(objectStore, indexField, optionalArgs) {
    var keyval = objectStore.keyPath;
    var opencursor = objectStore.openCursor();
    opencursor.onsuccess = function (evt) {	
        var cursor = evt.target.result;
        
        if (cursor) {
            var updateObj = cursor.value;
            var text = updateObj[indexField];
            var types = optionalArgs.types;
            if (optionalArgs && types) {
                var metadata = Lucy.getTextMetadata(text);
                if (1 in types)
                    updateObj.length = metadata.length;
                if (2 in types)
                    updateObj.uniqueWords = metadata.uniqueWords;
                var insertion = objectStore.put(updateObj);
				insertion.onerror = function(evt) {
					console.log(evt, updateObj);
				};
            }            
            cursor.continue();
        } else {
            console.log("All text normalized.");        
        } 
    };
    
    opencursor.onerror = function (evt) {
        console.log(evt);
    };
};

Lucy.getTextMetadata = function(text) {
    var metadata = {uniqueWords: 0, length: 0};
    var tokenCount = Lucy.tokenize(text);
    metadata.uniqueWords = Object.keys(tokenCount.tokens).length;
    metadata.length = tokenCount.length;
    return metadata;
}

Lucy.isStopWord = function(word) {
	return Lucy.stopwords.indexOf(word) > -1;
};

Lucy.stemmer = function(language) {
	var snowball = new Snowball(language);
	return function(word) {
		snowball.setCurrent(word);
		snowball.stem();
		return snowball.getCurrent();
	};
};

// convert dictionary to ordered list, reverse score
Lucy.convert_dict = function(dict) {
	var olist = [];
	for (var item in dict) {
		olist.push(dict[item]);
	}
	
	return olist.sort(function (a, b) {
		return b.score - a.score;
	});
};

// weighting taking into account position
Lucy.calculateCoverDensity = function(results, norm_level) {
	for (var doc_id in results) {
		Lucy.normalizeWeights(results[doc_id], norm_level);
		var positions = results[doc_id].positions;
		
		var total_iscore = 0.0;
		for (var token1 in positions) {
			for (var token2 in positions) {
				if (token1 === token2) continue;
				var last_pos1 = positions[token1][positions[token1].length-1];
				var first_pos2 = positions[token2][0];
				if (last_pos1 < first_pos2) {
					var iscore = 16.0/(first_pos2 - last_pos1 +1);
					if ((first_pos2 - last_pos1 +1) > 16.0) iscore = 1.0;
					total_iscore += iscore;
				} else continue;
			}
		}
		results[doc_id].score += total_iscore;
	}
};

// normal weighting without taking into account position
Lucy.calculateWeight = function(results, norm_level) {
	for (var doc_id in results) {
		Lucy.normalizeWeights(results[doc_id], norm_level);
	}
};

// normalization levels:
// 0: do no normalization
// 1: divide by document length
// 2: divide by unique number of words in document
Lucy.normalizeWeights = function(doc_obj, norm_level) {
	var rank = doc_obj.score;
	if (norm_level === 0) {
		return;
	} else if (norm_level === 1) {
		doc_obj.score = rank*1.0/doc_obj.length;
	} else if (norm_level === 2) {
		doc_obj.score = rank*1.0/doc_obj.uniqueWords;
	}
};

Lucy.baselineSearch = function(db, query, objectStoreName) {
    var transaction = db.transaction([objectStoreName], "readonly");
    var objectStore = transaction.objectStore(objectStoreName);
    var opencursor = objectStore.openCursor();
    var matches = [];
    var ret = new IDBIndexRequest(objectStore, transaction);
    ret.result = [];
    opencursor.onsuccess = function (evt) {
        var cursor = evt.target.result; 
        if (cursor) {
            var text = cursor.value["text"];
            var docId = cursor.value["id"];
            var queryText = query.replace(/%/g, '');

            // tokenize string
            var tokens = Object.keys(Lucy.tokenize(queryText, {disableStemming: true, allowStopWords: true}).tokens);
            for (var i=0; i<tokens.length; i++) {
                if (text.indexOf(tokens[i]) != -1) {
                    ret.result.push(cursor.value);
                    break;
                }
            }
            cursor.continue(); 
        } else {
            ret.onsuccess();
        }
    };
    
    opencursor.onerror = function (evt) {
        console.log(evt);
        ret.onerror();
    };

    return ret;
};


/*
 * Extends IDBRequest
 * 
 */
var IDBIndexRequest = function(objStore, transaction) {
	this.onsuccess = function(){};
	this.onerror = function(){};
	this.source = objStore;
	this.transaction = transaction;
	this.result = undefined;
};

IDBIndexRequest.prototype = IDBRequest;

Lucy.helpers = {
	createObjectStoreIfNotExists: function (transaction, name, optionalParameters) {
		var db = transaction.db;
		
		if (db.objectStoreNames.contains(name)) {
			return transaction.objectStore(name);
		}
		
		return db.createObjectStore(name, optionalParameters);
	}
};


/*
 * Intercept functions of IDBObjectStore
 */

(function() {

/**
 * Helper method: Create an object store or replace the existing one if it exists
 */
var _createObjectStore = IDBDatabase.prototype.createObjectStore;
IDBDatabase.prototype.createObjectStore = function(name, optionalParameters) {
	if (this.objectStoreNames.contains(name)) {
		// Already exists
		if (optionalParameters.ifExists == "replace") { // replace
			// OS already exists, drop it
			this.deleteObjectStore(name);
		}
		else if (optionalParameters.ifExists == "silent") {
			return null;
		}
	}
	
	return _createObjectStore.apply(this, arguments);
};

/*
Intercept put  
Raise DOMException with type DataError if key invalid
*/
var _put = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function(item, optionalKey) {
	// TODO
    return _put.apply(this, arguments);
};

/*
Intercept add  
Raise DOMException with type DataError if key invalid
*/
var _add = IDBObjectStore.prototype.add;
IDBObjectStore.prototype.add = function(item, optionalKey) {
	// TODO
    return _add.apply(this, arguments);
};

/*
Intercept delete
Raise DOMException with type DataError if key invalid
*/
var _delete = IDBObjectStore.prototype.delete;
IDBObjectStore.prototype.delete = function(recordKey) {
	// TODO
    return _delete.apply(this, arguments);
};

/*
Intercept index  
Return index associated with this field
Raise DOMException with type DataError if key invalid
*/
var _index = IDBObjectStore.prototype.index;
IDBObjectStore.prototype.index = function(field, type) {
	
	if (type) {
		var transaction = this.transaction;
		
		// Is it cached?
		var cached = false;
		var indexCache = Lucy.indexCache[type]
		for (var indexName in indexCache) {
			var index = indexCache[indexName];
			
			if (index && index.objectStore.name == this.name &&
			    index.indexField == field) {
			    // Found it!
			    var cached = true;
			}
		}
		
		if (!cached) {
			// Fetch from database
			throw new Error("Your index is not cached yo");
		}
		
		index.objectStore = this;
		index.transaction = transaction;

		index.index = transaction.objectStore(index.name);
		
		return index;
	}
	
    return _index.apply(this, arguments);
};

/*
Intercept createIndex
indexName - str name for the new index
keypath - the key path to use for the index
optionalArgs - optional configuration for index
    unique (preexisting option)
    multiEntry (preexisting option)
    type (new option) - specifies which type of index to create
        ("inverted", "prefix", "suffix", or "btree" allowed)
Raise DOMException with type DataError if key invalid
Raise DOMException with type ConstraintError if indexName invalid
*/
var _createIndex = IDBObjectStore.prototype.createIndex;
IDBObjectStore.prototype.createIndex = function(indexName, keypath, optionalArgs) {
	var db = optionalArgs.db;
	var type = optionalArgs.type;
	
    if (optionalArgs && type && db) {
    	// It’s a Lucy index!
        var language = optionalArgs["language"];
        if (!language || (SUPPORTED_LANGUAGES.indexOf(language) <= -1)) {
        	language = "english";
        }
        Lucy.language = language = language.toLowerCase();
        
        switch (type) {
        	case "inverted":
        		var index = new InvIndex(this, indexName, keypath, language);
        		break;
        	case "prefix":
        	case "suffix":
        		var index = new TrieIndex(this, indexName, keypath, optionalArgs.type);
        }
        
        index.build(db);
        
        var metaStore = Lucy.helpers.createObjectStoreIfNotExists(this.transaction, '__LucyIndices', { keyPath: ["store", "path", "type"] });
        
        metaStore.put({
        	store: this.name,
        	path: keypath,
        	type: type,
        	name: indexName
        });
        
        Lucy.indexCache[type] = Lucy.indexCache[type] || {};
        Lucy.indexCache[type][indexName] = index;
    } else {
        return _createIndex.apply(this, arguments);
    }
};

/*
Intercept deleteIndex
Otherwise, call the original deleteIndex method
*/
var _deleteIndex = IDBObjectStore.prototype.deleteIndex;
IDBObjectStore.prototype.deleteIndex = function(indexName) {
	// TODO as we don't seem to be calling this anywhere right now
	// (the previous impl wouldn't work anymore now that index info is persistent)
    return _deleteIndex.apply(this, arguments);
};

})();