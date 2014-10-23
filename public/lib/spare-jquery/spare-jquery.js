/*!
 * SpareJs jQuery:
 *   Text Input Changes
 *   Select Range
 *   Focus Toggle and Toggler
 *
 * Copyright 2013 Franklin Davenport
 * Released under the MIT license
 *
 * Date: 2013-04-14
 * Version: 0.1.1
 */

( function( $ ) {

  /**
   * Spare jQuery
   * 
   * Functions used throught the Spare jQuery library
   */
  $.spare = ( function() {
    var spare = {};

    /**
     * Data Handler
     *
     * Returns a function for getting / manipulating a {@code dataAttr} data attribute for given elements.
     * eg: <code>
     *   var _d = $.spare.dataHandler( 'my-plugin')
     *
     *   // Get - 1 param
     *   _d( $ele ) == $ele.data( 'my-plugin')
     *   _d( $ele ).foo = "bar"
     *
     *   // Set - 2 params
     *   _d( $ele, {foo: "bar"} ) // 2 Param - sets the value
     *
     *   // Extend and Get - 4 params
     *   _d( $ele, true, {option: "a"}, overridingOptions)
     * </code>
     */
    spare.dataHandler = function( dataAttr ) {
      function _d( $ele, val, initData, postData ) {
        if( arguments.length == 1 ) {
          return $ele.data( dataAttr );
        } else if( arguments.length == 2 ) {
          return $ele.data( dataAttr, val );
        } else if( arguments.length > 2 && typeof val === "boolean" ) {
          var extendArgs = [val];
          var data = _d( $ele );
          if( ! data ) {
            extendArgs.push({});
            $.merge( extendArgs, initData );
          }
          extendArgs.push( data );
          $.merge( extendArgs, postData );
          data = $.extend.apply( $, extendArgs ); 
          _d( $ele, data );
          return data;
        }
      }
      return _d;
    };

    /** Reports errors to the console or discards if console is null */
    spare.errorLog = (console && console.error) || $.noop;

    /** Returns arguments with first {@code count} args chopped off */
    spare.argumentSlice = function(args, count) {
      return Array.prototype.slice.call( arguments, count );
    }

    /**
     * Plugin
     * 
     * Proxy to {@code spare.pluginMethods}
     *
     * @param {string} name The name of the plugin
     * @param {string} defaultMethodName The name of the function to be ran 
     *    when no params are given
     * @param {function} getMethods Returns methods that the plugin performs
     */
    spare.plugin = function( name, defaultMethodName, getMethods ) {
      var methods = getMethods( $ );
      return spare.pluginMethods( name, methods[defaultMethodName], methods );
    }

    /**
     * Plugin Methods
     * 
     * Provides a typical jQuery Plugin function for routing to a method
     * eg, <code>
     *   var methods = { init: ..., aMethod: ... }
     *   $.fn.myPlugin = spare.pluginMethods( methods, methods.init );
     *   $(...).myPlugin();
     *   $(...).myPlugin('aMethod');
     * </code>
     *
     * @param {string} name The name of the plugin
     * @param {function} defaultMethod Reference to the function to be ran 
     *    when no params are given
     * @param {object} methods Contains methods that the plugin performs
     */
    spare.pluginMethods = function( name, defaultMethod, methods ) {
      return function( method ) {
        if( arguments.length == 0 ) {
          return defaultMethod.call( this );
        } else if ( methods[ method ] ) {
          return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
          return methods.init.apply( this, arguments );
        } else {
          $.error( 'Method ' +  method + ' does not exist on '+ name );
        }
      }
    };

    /**
     * Style Js Code
     * Adds spaces between brackets and words in the given code
     *
     * Status: Alpha
     *
     * Warning! This will likely return broken javascript if it contains any
     *   strings or regular expressions with parens, brackets, or curly braces
     *
     * eg, <code>
     *   function(a,b){return {x:1, y:[2]}}
     *   becomes
     *   function( a, b ){ return { x:1, y:[ 2 ]}}
     * </code>
    */
    spare.styleJsCode = function(code) {
      return code
        .replace(/([\(\{\[]+)(?!^|$|[\s\n\(\)\{\}\[\]])/gi, "$1!")
        .replace(/([\)\}\]]+)(?!^|$|[\s\n\(\)\{\}\[\]])/gi, "$!1");
    };

    return spare;
  })();

})( jQuery );




/**
 * Text Input Changes
 *
 * Attach to an input element to capture backspaces, deletions, and character insertions.
 * This is useful when the regular key events don't work properly (eg, Chrome on Android - 04/2013)
 * Listen for the "text-input-change" with a param like:
 *   { backspaces: 0, deletions: 1, insertions: "abc" }
 *
 * Warning: This plugin will overwrite the text in the input box with "\\\\\\\\////////", When the input
 *          is focused, a timer will check the input's value against "\\\\\\\\////////" to detect changes.
 *
 * Example:
 *  $( 'input.capture-changes' ).textInputChanges()
 *    .on( 'text-input-change', function(ev, changes) { ... } );
 *
 * Call the flush method to trigger the "text-input-change" immediately
 *   $(...).textInputChanges( 'flush' )
 */
jQuery.fn.textInputChanges =
  jQuery.spare.plugin('textInputChanges', 'init', function( $ ) {

    // Default Options
    var defaultOps = {
      listener: {
        delay: 90
      },
      input: {
        charLeft: "\\",
        charRight: "/",
        charRepeat: 15,
        left: "",
        right: "",
        default: ""
      }
    }
    var inputOps = defaultOps.input;

    inputOps.left = repeatString(inputOps.charLeft, inputOps.charRepeat);
    inputOps.right = repeatString(inputOps.charRight, inputOps.charRepeat);
    inputOps.default = inputOps.left + inputOps.right;

    // Data Handler
    var _d = $.spare.dataHandler('text-input-changes');

    // Listener Timing
    function listenerStart( $input ) {
      _d( $input ).listenerRunning = true;
      inputReset( $input );
      listenerRunSleep( $input );
    }
    function listenerStop( $input ) {
      _d( $input ).listenerRunning = false;
    }
    function listenerRunSleep( $input ) {
      var data = _d( $input );
      if( data.listenerRunning ) {
        try {
          listenerRun( $input );
        } catch(e) { $.spare.errorLog(e); }

        clearTimeout( data.listener.timeout );
        data.listener.timeout = setTimeout( function() {
          listenerRunSleep( $input )
        }, data.listener.delay );
      }
    }

    // Listener Function
    function listenerRun( $input ) {
      var iVal = inputFlush( $input );
      if( iVal != inputOps.default && iVal != null ) {
        inputReset( $input );
        var charMatch = iVal.match( /^(\\*)([^\\\/]*)(\/*)$/ )

        var backspaces = inputOps.charRepeat - charMatch[1].length
        var deletions = inputOps.charRepeat - charMatch[3].length;
        var insertions = repeatString( inputOps.charLeft, -backspaces ) +
          charMatch[2] + repeatString(inputOps.charRight, -deletions);

        $input.trigger('text-input-change', {
          backspaces: Math.max( 0, backspaces ),
          insertions: insertions,
          deletions: Math.max( 0, deletions )
        });
      }
    }

    // Input Handling
    function inputReset( $input ) {
      $input.val( inputOps.default );
      $input.selectRange( inputOps.charRepeat, inputOps.charRepeat );
    }

    function inputFlush( $input ) {
      var fVal = $input.val();
      inputReset( $input );
      return fVal;
    }

    // Methods
    var methods = {};

    // Init
    methods.init = function( ops ) {
      this.each( function() {
        var $input = $( this );

        // Update/Init Data
        _d( $input, true, [defaultOps], [ops] );

        // Bind Events
        $input.on( 'focus', function() {
          listenerStart( $input );
        });
        $input.on( 'click', function() {
           inputReset( $input );
        });
        $input.on( 'blur', function() {
           listenerStop( $input );
        });
      });
      return this;
    };

    // Flush, triggers the change event and resets
    methods.flush = function() {
      return inputFlush( this );
    };


    // Misc Functions
    function repeatString( rs, count ) {
      return new Array( count + 1 ).join( rs );
    }

    return methods;
  });



/**
 * Select Range
 *
 * Selects a range of characters or moves the cursor
 * in a text input or textarea
 */
jQuery.fn.selectRange = function( start, end ) {
  return this.each( function() {
    if ( this.setSelectionRange ) {
      this.focus();
      this.setSelectionRange( start, end );
    } else if ( this.createTextRange ) {
      var range = this.createTextRange();
      range.collapse( true );
      range.moveEnd( 'character', end );
      range.moveStart( 'character', start );
      range.select();
    }
  });
};




/**
 * Focus Toggle
 * Useful when creating a toggle button to focus/blur an element.
 * Clicking on the toggle button will instantly blur the any other element,
 * so we can't rely on $(this).is(":focus") to determine when to focus and blur.
 * Instead this relies on a timer and a threshold.
 *
 * Initialize with $(...).focusToggle()
 * Then call via $(...).focusToggle('toggle')
 */
jQuery.fn.focusToggle =
  jQuery.spare.plugin( 'focusToggle', 'toggle', function( $ ) {

    // Default Options
    var defaultOps = {
      delayThreshold: 250,
      lastBlurred : 0
    }

    // Data Handler
    var _d = $.spare.dataHandler( 'focus-toggle' );

    // Events
    function blurred() {
      _d( $( this ) ).lastBlurred = new Date().getTime();
    } 

    // Methods
    var methods = {};

    // Init
    methods.init = function(ops) {
      this.each( function() {
        var $ele = $( this )

        // Update/Init Data
        var data = _d( $ele, true, [ defaultOps ], [ ops ] );
        if( ! data.initialized ) {
          $ele.on( 'blur', blurred );
          data.initialized = true;
        }
      });
      return this;
    };

      // Toggle
    methods.toggle = function( toggleBegan ) {
      methods.init.apply( this );
      var data = _d(this);
      var now = new Date().getTime();
      toggleBegan = Math.min( now, toggleBegan || now );
      var lastBlurredDelta = toggleBegan - data.lastBlurred;
      if( ! this.is( ':focus' ) && lastBlurredDelta > data.delayThreshold) {
        // This isn't focused and there has been an acceptible amout of time
        // since this was blurred
        this.focus();
      } else {
        this.blur();
      }
      return this;
    };

    return methods;
  });



/**
 * Focus Toggler
 *
 * On click, will toggle focus on another element.
 * Won't accept focus on mousedown or touch
 * Works alongside the Focus Toggle Plugin.
 */
jQuery.fn.focusToggler =
  jQuery.spare.plugin('focusToggler', 'init', function( $ ) {

    var _ns = ".focusToggler";

    var methods = {}
    methods.init = function( ops ) {
      this.each( function() {
        var $ele = $( this );
        var $target = $( ops.target );

        $ele.off( _ns );
        $ele.on( 'mousedown touch', function(event) {
          event.preventDefault();
        })
        $ele.on( 'click' + _ns, function() {
          $target.focusToggle('toggle');
        });
        $target.focusToggle('init');
      });

    };
    return methods;
  });
