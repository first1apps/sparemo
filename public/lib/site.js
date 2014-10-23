
// Site
(function($) {

	// Site
	var site = {}

	// Init
	////////
	site.init = $;

	// Routes
	//////////
	site.routes = {
		lib: {
			
		}
	}

	// Route
	/////////


	// Debug
	/////////
	site.debug = (function() {
		var debug$, count, init, debug;

		debug$ = $('<div style="position: absolute; top: 0; left: 0; z-index:3000; color: white; background: black; width:100px;"></div>');
		count = 0;

		init = function() {
			init = $.noop;
			$(function() {
				debug$.prependTo('body');
			})
		}

		debug = function(msg) {
			init();
			count++;
			debug$.prepend("<div>"+ count +": "+ msg +"</div>");
		}

		return debug;
	})();


	// Socket
	//////////
	site.socket = {};
	site.socket.create = function(url) {
		return new (window['MozWebSocket'] ? MozWebSocket : WebSocket)(url);
	}

	// Export
	//////////
	window.site = site;
})(jQuery);



