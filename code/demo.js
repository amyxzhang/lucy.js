function $(expr, con) {
	return typeof expr === 'string'? (con || document).querySelector(expr) : expr;
}

function $$(expr, con) {
	return Array.prototype.slice.call((con || document).querySelectorAll(expr));
}

$('#import-data').onclick = function () {
	var loadingStatus = $('.loading-status');
	var importData = indexedDB.import("LucyTest", "data/tweets.json");
	
	importData.onstatusupdate = function (status) {
		console.log(status);
		loadingStatus.textContent = status;
	};
	
	importData.onsuccess = function () {
		loadingStatus.textContent = '';
	}	
};