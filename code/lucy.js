
/*
 * Lucy.js
 * 
 */

// Imported objectStores
ImportedObjectStores = {};

// Store mapping between objectStore and indexed field
IndexedFields = {};

(function() {
	
    // Store mapping between index name and index objects
    IDBObjectStore.prototype.textSearchIndexes = {};

    // Intercept insertion/update/delete methods
    var _put = IDBObjectStore.prototype.put;
    var _add = IDBObjectStore.prototype.add;
    var _delete = IDBObjectStore.prototype.delete;
    
    /*
    Intercept put  
    Insert/update item into all indexes in this.textSearchIndexes
    Raise DOMException with type DataError if key invalid
    */  
    IDBObjectStore.prototype.put = function(item, optionalKey) {
        return _put.apply(this, arguments);
    };

    /*
    Intercept add  
    Insert item into all indexes in this.textSearchIndexes
    Raise DOMException with type DataError if key invalid
    */    
    IDBObjectStore.prototype.add = function(item, optionalKey) {
        return _add.apply(this, arguments);
    };

    /*
    Intercept delete
    Remove record from all indexes in this.textSearchIndexes
    Raise DOMException with type DataError if key invalid
    */
    IDBObjectStore.prototype.delete = function(recordKey) {
        return _delete.apply(this, arguments);
    };

    // Intercept index creation/deletion
    var _createIndex = IDBObjectStore.prototype.createIndex;
    var _deleteIndex = IDBObjectStore.prototype.deleteIndex;

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
    IDBObjectStore.prototype.createIndex = function(indexName, keypath, optionalArgs) {
        if (indexName in this.textSearchIndexes) {
            // ConstraintError
        }
        if (optionalArgs && optionalArgs["type"] && optionalArgs["dbconn"]) {
            // build the appropriate index using the builder functions below
            // add new index to this.textSearchIndexes
            var dbconn = optionalArgs["dbconn"];
            if (optionalArgs["type"] == "inverted") {
            	return buildInvertedIndex(this, indexName, keypath, dbconn);
            }
        } else {
            return _createIndex.apply(this, arguments);
        }
    };

    /*
    Intercept deleteIndex
    If the index is a text search index, remove it from this.textSearchIndexes
    Otherwise, call the original deleteIndex method
    */
    IDBObjectStore.prototype.deleteIndex = function(indexName) {
        if (indexName in this.textSearchIndexes) {
            delete this.textSearchIndexes[indexName];
        } else {
            return _deleteIndex.apply(this, arguments);
        }
    };

    // Index builder methods that do any necessary pre-processing
    // of data before calling index object constructors.

    /*
    Creates a prefix tree index for pattern-matching.
    name - str name of the index to be created (stored in textSearchIndexes)
    returns TrieIndex object
    */
    var buildPrefixTree = function(name) {
        return null;
    };

    /*
    Builds a suffix tree index for pattern-matching by inserting reversed strings into prefix tree
    name - str name of the index to be created
    returns TrieIndex object
    */
    var buildSuffixTree = function(name) {
        return null;
    };

    /*
    Builds an inverted index for full-text searches.
    name - str name of the index to be created
    returns InvertedIndex object
    */
    var buildInvertedIndex = function(objStore, name, field, dbconn) {
    	var invIndex = InvIndex.apply(this, arguments);
		return invIndex;
    };

    /*
    Builds a B+ tree index for full-text searches
    name - str name of the index to be created
    returns BTreeIndex object
    */
    var buildBTreeIndex = function(name) {
        return null;
    };
    
})();