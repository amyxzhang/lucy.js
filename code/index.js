/*
Constructs an InvertedIndex for full-text search.
data - array of strings to be indexed
*/
var InvertedIndex = function(data) {
    // Perform index search for a tokenized word
    this.get = function(word) {
        return null;
    };

    // Tokenize and normalize data before insertion.
    this.insert = function(text) {};

    return this;
};

/*
Constructs a TrieIndex for pattern-matching.
data - array of strings to be indexed
*/
var TrieIndex = function(data) {
    // Perform pattern-matching (prefix/suffix search), return whole string
    this.get = function(pattern) {
        return null;
    };

    // Normalize data before insertion (no tokenization for pattern-matching)
    this.insert = function(text) {};

    return this;
};

/*
Constructs a BTreeIndex for full-text search.
data - array of strings to be indexed
*/
var BTreeIndex = function(data) {
    // Perform index search for a tokenized word
    this.get = function(word) {
        return null;
    };

    // Normalize and tokenize data before insertion.
    this.insert = function(text) {};
    return this;
};