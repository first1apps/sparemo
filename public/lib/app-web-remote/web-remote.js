(function($) {

  function MovementSystem(vectorQueueSize, speed, ppsUnit) {
    vectorQueueSize = Math.max(2, vectorQueueSize || 2);
    speed = speed || 1;
    ppsUnit = 325;

    var ms = {};
    ms.d0 = [ 0, 0, 0 ]; // [ dx, dy, t ]
    ms.distances = [];
    for(var i = 0; i < vectorQueueSize; i++) {
      ms.distances[i] = ms.d0;
    }

    ms.move = function( dx, dy, t ) {
      ms.distances.shift();
      ms.distances.push([ dx, dy, t ]);
    }
    ms.speeds = function( steps ) { // [[ dx, dy, dt, pixels, pixels/s ], ...]
      steps = Math.min(steps || 1, vectorQueueSize);
      var iSteps = steps + 2;
      var results = [];
      var v1 = null;
      var v2 = ms.distances[ vectorQueueSize - 1 ]
      for( var i = 2; i < iSteps; i++ ) {
        v1 = v2;
        v2 = ms.distances[ vectorQueueSize - i ]
        var v = ms.speed( v1, v2 );
        results.push( v );
      }

      return results;
    }

    ms.speed = function( v1, v2 ) {
      var dt = v1[ 2 ] - v2[ 2 ];
      var dx = v1[ 0 ];
      var dy = v1[ 1 ];

      var pixels = Math.sqrt( dx*dx + dy*dy );
      if(pixels == 0) {
        return [ dx, dy, 0, 0 ];

      } else {
        var pixelsPerSecond = pixels * 1000 / dt;
        var vs = [ dx, dy, pixels, pixelsPerSecond ];       
        return vs;
      }
    }

    ms.lastVector = function() {
      return ms.distances[ vectorQueueSize - 1 ];
    }
    ms.lastVector2 = function() {
      return ms.distances[ vectorQueueSize - 2 ];
    }

    ms.lastSpeed = function() {
      return ms.speed( ms.lastVector(), ms.lastVector2() );
    }

    ms.adjusted = function() {
      var v = ms.lastSpeed();
      var m = 1;
      var v2 = [ v[ 0 ] * m , v[ 1 ] * m, v[ 2 ]];
        return v2;
      console.log(v2);
      return [0, 0, 0];
//      var pps = v[ 3 ];
//      var multi = pps / ppsUnit;
//
//      var v = ms.lastVector();
//      var v2 = [ multi * v[ 0 ], multi * v[ 1 ], v[ 2 ] ];
//
//      return v2;
    }

    return ms;
  }

  // Web Remote
  site.webRemote = (function(){
    var MR = {};

    // Socket
    MR.socketUrl =  null;
    MR.setSocketUrl = function(url) {
      MR.socketUrl = url
      MR.resetSocket();
    };
    MR._socket = null;
    MR.socket = function() {
      var s = MR._socket;
      if(s == null) {
        return MR.resetSocket();
      } else {
        return s;
      }
    };
    MR.closeSocket = function() {
      if(MR._socket !== null) {
        try {
          MR._socket.close()
        } catch(e){}
      }      
    };
    MR.resetSocket = function() {
      MR.closeSocket();

      MR._socket = site.socket.create(MR.socketUrl);
      MR._socket.onmessage = MR.receive

      return MR._socket
    };

    MR.sendTimer = 0;
    MR.sendDelay = 20;
    MR.startSendTimer = function() {
      clearTimeout( MR.sendTimer );
      MR.sendTimer = setTimeout( function() {
        MR.sendNow();
        MR.startSendTimer();
      }, MR.sendDelay );
    }
    MR.sendNow = function() {
      var q = MR.send.queue;
      MR.send.queue = {};
      MR.send(q);
    }
    MR.send = function(jsonData) {
      if( $.isEmptyObject( jsonData )) return;
      MR.socket().send(JSON.stringify(jsonData));
    }; 
    MR.send.queue = {};
    MR.send.move = function( x, y ) {
      var mm2 = MR.send.queue.mm;
      var mm = ( mm2 && [ x + mm2[ 0 ], y + mm2[ 1 ]] ) || [ x, y ] ;
      console.log("!", mm)
      MR.send.queue.mm = mm;
    };
    MR.send.press = function(button) {
      MR.send.queue.mp = button;
    }
    MR.send.release = function(button) {
      MR.send.queue.mr = button;
    }
    MR.send.click = function(button) {
      MR.send.queue.mc = button;
    }
    MR.send.keypress = function(keycode) {
      MR.send.queue.kp = keycode;
    }
    MR.send.keyrelease = function(keycode) {
      MR.send.queue.kr = keycode;
    }

    MR.send.textChanges = function(changes) {
      var tc = {};
      if(changes.backspaces != 0)
        tc.b = changes.backspaces;
      if(changes.insertions != "" && changes.insertions != null)
        tc.i = changes.insertions;
      if(changes.deletions != 0)
        tc.d = changes.deletions;
      MR.send( {tc: tc} );
    }

    MR.receive = function(ev) {
      var data = JSON.parse(ev.data);
    };


    // Attaches events to an element
    MR.attach = function($container) {
      MR.startSendTimer();

      var $mousepad = $container.find('.app-remote-mousepad');
      var $keypad = $container.find('.app-remote-keypad');
      var $keypadToggler = $container.find('#keyboardTrigger');

      var pos = {x: 0, y: 0};
      var touching = false;
      var moving = false;
      var dragging = false;

      var movementMultiplier = 1;

      var lastPressTime = 0;
      var lastReleaseTime = 0;
      var lastTapTime = 0;
      var lastTapTimeThreshold = 180;

      var movementSystem = MovementSystem();

      function time() {
        return (new Date()).getTime();
      }

      var getMousePos = function(event) {
        var ev = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : event;
        return {x: ev.pageX, y: ev.pageY};
      }

      function justPressed(timeStamp) {
        lastPressTime = time();
        setTouching(true);
      }
      function justReleased() {
        lastReleaseTime = time();
        if( ! moving) {
          // Press + Release => Simple Tap
          justTapped();
        }
        setTouching(false);
      }
      function justTapped() {
        lastTapTime = time();
      }

      function setTouching(bool) {
        if(touching == bool) return;
        touching = bool;
        setMoving(false)
      }
      function setMoving(bool) {
        if(moving == bool) return;
        moving = bool;
        if( moving ) {
          if( ! dragging && (lastPressTime - lastTapTime) < lastTapTimeThreshold )  {
            // Tap -> Press -> Move => Drag
            setDragging(true);
          }
        } else {
          setDragging(false);
        }
      }
      function setDragging(bool) {
        if(dragging == bool) return;
        dragging = bool;
        MR.send[bool ? "press" : "release"](1);
      }

      //Enable swiping...
      $mousepad.swipe({
        tap:function(event, target) {
          if( ! moving) {
            MR.send.click(1);
          }
        },
        doubleTap:function(event, target) {
          if( ! moving) {
            MR.send.click(1);
            MR.send.click(1);
          }
        },
        swipeStatus:function(event, phase, direction, distance, duration, fingers)
        {
          if(phase == "start") {
            pos = getMousePos(event);
            justPressed();
          }
          if(phase == "move") {
            if( ! moving) {
              if (touching) {
                //movementSystem.start();
                setMoving(true);
              }
            }

            //console.log(distance, duration, fingers)
            
            if(moving) {
              var newPos = getMousePos(event);
              var dx = newPos.x - pos.x;
              var dy = newPos.y - pos.y;

              movementSystem.move( dx, dy, event.timeStamp );
              var adj = movementSystem.adjusted();
              // console.log(" ", [dx, dy]);
              // console.log("-", [Math.round(adj[0]), Math.round(adj[1])]);
              MR.send.move(adj[0], adj[1]);
              pos = newPos;
            }

          }
          if(phase == "end") {
            //movementSystem.end();
            justReleased()
          }
        },
        // longTap:function(event, target) {
        // },
        // swipe:function(event, target) {
        // },
        threshold:50
      });

      // Keypad Focus Toggler
      $keypadToggler.focusToggler({ target: $keypad });

      // Keypad Events
      $keypad
        .on('keydown', function(event) {
          if(event.keyCode) {
            MR.send.keypress(event.keyCode);
          }
          event.preventDefault();
        })
        .on('keyup', function(event) {
          if(event.keyCode) {
            MR.send.keyrelease(event.keyCode);
          }
          event.preventDefault();
        });

      // Keypad Text Input Changes
      $keypad
        .textInputChanges()
        .on('text-input-change', function(ev, changes) {
          MR.send.textChanges(changes);
        });

    };


    return MR;
  })();
  

})(jQuery);

