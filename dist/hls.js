(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hls = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);

    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        var exp = cache[key].exports;
        // Using babel as a transpiler to use esmodule, the export will always
        // be an object with the default export as a property of it. To ensure
        // the existing api and babel esmodule exports are both supported we
        // check for both
        if (exp === fn || exp.default === fn) {
            wkey = key;
            break;
        }
    }

    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);

    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'], (
            // try to call default if defined to also support babel esmodule
            // exports
            'var f = require(' + stringify(wkey) + ');' +
            '(f.default ? f.default : f)(self);'
        )),
        scache
    ];

    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;

    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    return new Worker(URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _bufferHelper = require('../helper/buffer-helper');

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _errors = require('../errors');

var _logger = require('../utils/logger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * simple ABR Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *  - compute next level based on last fragment bw heuristics
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *  - implement an abandon rules triggered if we have less than 2 frag buffered and if computed bw shows that we risk buffer stalling
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

var AbrController = function (_EventHandler) {
  _inherits(AbrController, _EventHandler);

  function AbrController(hls) {
    _classCallCheck(this, AbrController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AbrController).call(this, hls, _events2.default.FRAG_LOADING, _events2.default.FRAG_LOAD_PROGRESS, _events2.default.FRAG_LOADED, _events2.default.ERROR));

    _this.lastfetchlevel = 0;
    _this._autoLevelCapping = -1;
    _this._nextAutoLevel = -1;
    _this.hls = hls;
    _this.onCheck = _this.abandonRulesCheck.bind(_this);
    return _this;
  }

  _createClass(AbrController, [{
    key: 'destroy',
    value: function destroy() {
      this.clearTimer();
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(data) {
      this.timer = setInterval(this.onCheck, 100);
      this.fragCurrent = data.frag;
    }
  }, {
    key: 'onFragLoadProgress',
    value: function onFragLoadProgress(data) {
      var stats = data.stats;
      // only update stats if first frag loading
      // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
      // and leading to wrong bw estimation
      if (stats.aborted === undefined && data.frag.loadCounter === 1) {
        this.lastfetchduration = (performance.now() - stats.trequest) / 1000;
        this.lastfetchlevel = data.frag.level;
        this.lastbw = stats.loaded * 8 / this.lastfetchduration;
        //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
      }
    }
  }, {
    key: 'abandonRulesCheck',
    value: function abandonRulesCheck() {
      /*
        monitor fragment retrieval time...
        we compute expected time of arrival of the complete fragment.
        we compare it to expected time of buffer starvation
      */
      var hls = this.hls,
          v = hls.media,
          frag = this.fragCurrent;
      /* only monitor frag retrieval time if
      (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
      if (v && (!v.paused || !v.readyState) && frag.autoLevel && frag.level) {
        var requestDelay = performance.now() - frag.trequest;
        // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
        if (requestDelay > 500 * frag.duration) {
          var loadRate = Math.max(1, frag.loaded * 1000 / requestDelay); // byte/s; at least 1 byte/s to avoid division by zero
          if (frag.expectedLen < frag.loaded) {
            frag.expectedLen = frag.loaded;
          }
          var pos = v.currentTime;
          var fragLoadedDelay = (frag.expectedLen - frag.loaded) / loadRate;
          var bufferStarvationDelay = _bufferHelper2.default.bufferInfo(v, pos, hls.config.maxBufferHole).end - pos;
          // consider emergency switch down only if we have less than 2 frag buffered AND
          // time to finish loading current fragment is bigger than buffer starvation delay
          // ie if we risk buffer starvation if bw does not increase quickly
          if (bufferStarvationDelay < 2 * frag.duration && fragLoadedDelay > bufferStarvationDelay) {
            var fragLevelNextLoadedDelay = void 0,
                nextLoadLevel = void 0;
            // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
            // we start from current level - 1 and we step down , until we find a matching level
            for (nextLoadLevel = frag.level - 1; nextLoadLevel >= 0; nextLoadLevel--) {
              // compute time to load next fragment at lower level
              // 0.8 : consider only 80% of current bw to be conservative
              // 8 = bits per byte (bps/Bps)
              fragLevelNextLoadedDelay = frag.duration * hls.levels[nextLoadLevel].bitrate / (8 * 0.8 * loadRate);
              _logger.logger.log('fragLoadedDelay/bufferStarvationDelay/fragLevelNextLoadedDelay[' + nextLoadLevel + '] :' + fragLoadedDelay.toFixed(1) + '/' + bufferStarvationDelay.toFixed(1) + '/' + fragLevelNextLoadedDelay.toFixed(1));
              if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
                // we found a lower level that be rebuffering free with current estimated bw !
                break;
              }
            }
            // only emergency switch down if it takes less time to load new fragment at lowest level instead
            // of finishing loading current one ...
            if (fragLevelNextLoadedDelay < fragLoadedDelay) {
              // ensure nextLoadLevel is not negative
              nextLoadLevel = Math.max(0, nextLoadLevel);
              // force next load level in auto mode
              hls.nextLoadLevel = nextLoadLevel;
              // abort fragment loading ...
              _logger.logger.warn('loading too slow, abort fragment loading and switch to level ' + nextLoadLevel);
              //abort fragment loading
              frag.loader.abort();
              this.clearTimer();
              hls.trigger(_events2.default.FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag });
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded() {
      // stop monitoring bw once frag loaded
      this.clearTimer();
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      // stop timer in case of frag loading error
      switch (data.details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
          this.clearTimer();
          break;
        default:
          break;
      }
    }
  }, {
    key: 'clearTimer',
    value: function clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/

  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this._autoLevelCapping;
    }

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    ,
    set: function set(newLevel) {
      this._autoLevelCapping = newLevel;
    }
  }, {
    key: 'nextAutoLevel',
    get: function get() {
      var lastbw = this.lastbw,
          hls = this.hls,
          adjustedbw,
          i,
          maxAutoLevel;
      if (this._autoLevelCapping === -1) {
        maxAutoLevel = hls.levels.length - 1;
      } else {
        maxAutoLevel = this._autoLevelCapping;
      }

      if (this._nextAutoLevel !== -1) {
        var nextLevel = Math.min(this._nextAutoLevel, maxAutoLevel);
        if (nextLevel === this.lastfetchlevel) {
          this._nextAutoLevel = -1;
        } else {
          return nextLevel;
        }
      }

      // follow algorithm captured from stagefright :
      // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
      // Pick the highest bandwidth stream below or equal to estimated bandwidth.
      for (i = 0; i <= maxAutoLevel; i++) {
        // consider only 80% of the available bandwidth, but if we are switching up,
        // be even more conservative (70%) to avoid overestimating and immediately
        // switching back.
        if (i <= this.lastfetchlevel) {
          adjustedbw = 0.8 * lastbw;
        } else {
          adjustedbw = 0.7 * lastbw;
        }
        if (adjustedbw < hls.levels[i].bitrate) {
          return Math.max(0, i - 1);
        }
      }
      return i - 1;
    },
    set: function set(nextLevel) {
      this._nextAutoLevel = nextLevel;
    }
  }]);

  return AbrController;
}(_eventHandler2.default);

exports.default = AbrController;

},{"../errors":20,"../event-handler":21,"../events":22,"../helper/buffer-helper":23,"../utils/logger":36}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Buffer Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var BufferController = function (_EventHandler) {
  _inherits(BufferController, _EventHandler);

  function BufferController(hls) {
    _classCallCheck(this, BufferController);

    // Source Buffer listeners

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(BufferController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.BUFFER_RESET, _events2.default.BUFFER_APPENDING, _events2.default.BUFFER_CODECS, _events2.default.BUFFER_EOS, _events2.default.BUFFER_FLUSHING));

    _this.onsbue = _this.onSBUpdateEnd.bind(_this);
    _this.onsbe = _this.onSBUpdateError.bind(_this);
    return _this;
  }

  _createClass(BufferController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      // setup the media source
      var ms = this.mediaSource = new MediaSource();
      //Media Source listeners
      this.onmso = this.onMediaSourceOpen.bind(this);
      this.onmse = this.onMediaSourceEnded.bind(this);
      this.onmsc = this.onMediaSourceClose.bind(this);
      ms.addEventListener('sourceopen', this.onmso);
      ms.addEventListener('sourceended', this.onmse);
      ms.addEventListener('sourceclose', this.onmsc);
      // link video and media Source
      media.src = URL.createObjectURL(ms);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      var ms = this.mediaSource;
      if (ms) {
        if (ms.readyState === 'open') {
          try {
            // endOfStream could trigger exception if any sourcebuffer is in updating state
            // we don't really care about checking sourcebuffer state here,
            // as we are anyway detaching the MediaSource
            // let's just avoid this exception to propagate
            ms.endOfStream();
          } catch (err) {
            _logger.logger.warn('onMediaDetaching:' + err.message + ' while calling endOfStream');
          }
        }
        ms.removeEventListener('sourceopen', this.onmso);
        ms.removeEventListener('sourceended', this.onmse);
        ms.removeEventListener('sourceclose', this.onmsc);
        // unlink MediaSource from video tag
        this.media.src = '';
        this.media.removeAttribute('src');
        this.mediaSource = null;
        this.media = null;
        this.pendingTracks = null;
        this.sourceBuffer = null;
      }
      this.onmso = this.onmse = this.onmsc = null;
      this.hls.trigger(_events2.default.MEDIA_DETACHED);
    }
  }, {
    key: 'onMediaSourceOpen',
    value: function onMediaSourceOpen() {
      _logger.logger.log('media source opened');
      this.hls.trigger(_events2.default.MEDIA_ATTACHED, { media: this.media });
      // once received, don't listen anymore to sourceopen event
      this.mediaSource.removeEventListener('sourceopen', this.onmso);
      // if any buffer codecs pending, treat it here.
      var pendingTracks = this.pendingTracks;
      if (pendingTracks) {
        this.onBufferCodecs(pendingTracks);
        this.pendingTracks = null;
        this.doAppending();
      }
    }
  }, {
    key: 'onMediaSourceClose',
    value: function onMediaSourceClose() {
      _logger.logger.log('media source closed');
    }
  }, {
    key: 'onMediaSourceEnded',
    value: function onMediaSourceEnded() {
      _logger.logger.log('media source ended');
    }
  }, {
    key: 'onSBUpdateEnd',
    value: function onSBUpdateEnd() {

      if (this._needsFlush) {
        this.doFlush();
      }

      if (this._needsEos) {
        this.onBufferEos();
      }

      this.hls.trigger(_events2.default.BUFFER_APPENDED);

      this.doAppending();
    }
  }, {
    key: 'onSBUpdateError',
    value: function onSBUpdateError(event) {
      _logger.logger.error('sourceBuffer error:' + event);
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false });
      // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
    }
  }, {
    key: 'onBufferReset',
    value: function onBufferReset() {
      var sourceBuffer = this.sourceBuffer;
      if (sourceBuffer) {
        for (var type in sourceBuffer) {
          var sb = sourceBuffer[type];
          try {
            this.mediaSource.removeSourceBuffer(sb);
            sb.removeEventListener('updateend', this.onsbue);
            sb.removeEventListener('error', this.onsbe);
          } catch (err) {}
        }
        this.sourceBuffer = null;
      }
      this.flushRange = [];
      this.appended = 0;
    }
  }, {
    key: 'onBufferCodecs',
    value: function onBufferCodecs(tracks) {
      var sb, trackName, track, codec, mimeType;

      if (!this.media) {
        this.pendingTracks = tracks;
        return;
      }

      if (!this.sourceBuffer) {
        var sourceBuffer = {},
            mediaSource = this.mediaSource;
        for (trackName in tracks) {
          track = tracks[trackName];
          // use levelCodec as first priority
          codec = track.levelCodec || track.codec;
          mimeType = track.container + ';codecs=' + codec;
          _logger.logger.log('creating sourceBuffer with mimeType:' + mimeType);
          sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
          sb.addEventListener('updateend', this.onsbue);
          sb.addEventListener('error', this.onsbe);
        }
        this.sourceBuffer = sourceBuffer;
      }
    }
  }, {
    key: 'onBufferAppending',
    value: function onBufferAppending(data) {
      if (!this.segments) {
        this.segments = [data];
      } else {
        this.segments.push(data);
      }
      this.doAppending();
    }
  }, {
    key: 'onBufferAppendFail',
    value: function onBufferAppendFail(data) {
      _logger.logger.error('sourceBuffer error:' + data.event);
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false, frag: this.fragCurrent });
    }
  }, {
    key: 'onBufferEos',
    value: function onBufferEos() {
      var sb = this.sourceBuffer,
          mediaSource = this.mediaSource;
      if (!mediaSource || mediaSource.readyState !== 'open') {
        return;
      }
      if (!(sb.audio && sb.audio.updating || sb.video && sb.video.updating)) {
        _logger.logger.log('all media data available, signal endOfStream() to MediaSource and stop loading fragment');
        //Notify the media element that it now has all of the media data
        mediaSource.endOfStream();
        this._needsEos = false;
      } else {
        this._needsEos = true;
      }
    }
  }, {
    key: 'onBufferFlushing',
    value: function onBufferFlushing(data) {
      this.flushRange.push({ start: data.startOffset, end: data.endOffset });
      // attempt flush immediatly
      this.flushBufferCounter = 0;
      this.doFlush();
    }
  }, {
    key: 'doFlush',
    value: function doFlush() {
      // loop through all buffer ranges to flush
      while (this.flushRange.length) {
        var range = this.flushRange[0];
        // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
        if (this.flushBuffer(range.start, range.end)) {
          // range flushed, remove from flush array
          this.flushRange.shift();
          this.flushBufferCounter = 0;
        } else {
          this._needsFlush = true;
          // avoid looping, wait for SB update end to retrigger a flush
          return;
        }
      }
      if (this.flushRange.length === 0) {
        // everything flushed
        this._needsFlush = false;

        // let's recompute this.appended, which is used to avoid flush looping
        var appended = 0;
        var sourceBuffer = this.sourceBuffer;
        if (sourceBuffer) {
          for (var type in sourceBuffer) {
            appended += sourceBuffer[type].buffered.length;
          }
        }
        this.appended = appended;
        this.hls.trigger(_events2.default.BUFFER_FLUSHED);
      }
    }
  }, {
    key: 'doAppending',
    value: function doAppending() {
      var hls = this.hls,
          sourceBuffer = this.sourceBuffer,
          segments = this.segments;
      if (sourceBuffer) {
        if (this.media.error) {
          segments = [];
          _logger.logger.error('trying to append although a media error occured, flush segment and abort');
          return;
        }
        for (var type in sourceBuffer) {
          if (sourceBuffer[type].updating) {
            //logger.log('sb update in progress');
            return;
          }
        }
        if (segments.length) {
          var segment = segments.shift();
          try {
            //logger.log(`appending ${segment.type} SB, size:${segment.data.length});
            // if (sourceBuffer.firstLoaded && !sourceBuffer.video.updating) {
            // sourceBuffer[segment.type].timestampOffset += 10;
            // }
            sourceBuffer[segment.type].appendBuffer(segment.data);
            sourceBuffer.firstLoaded = true;

            // setTimeout( function() {
            // 	sourceBuffer[segment.type].timestampOffset = 15;
            // }, 5);

            console.info(segment);
            this.appendError = 0;
            this.appended++;
          } catch (err) {
            // in case any error occured while appending, put back segment in segments table
            _logger.logger.error('error while trying to append buffer:' + err.message);
            segments.unshift(segment);
            var event = { type: _errors.ErrorTypes.MEDIA_ERROR };
            if (err.code !== 22) {
              if (this.appendError) {
                this.appendError++;
              } else {
                this.appendError = 1;
              }
              event.details = _errors.ErrorDetails.BUFFER_APPEND_ERROR;
              event.frag = this.fragCurrent;
              /* with UHD content, we could get loop of quota exceeded error until
                browser is able to evict some data from sourcebuffer. retrying help recovering this
              */
              if (this.appendError > hls.config.appendErrorMaxRetry) {
                _logger.logger.log('fail ' + hls.config.appendErrorMaxRetry + ' times to append segment in sourceBuffer');
                segments = [];
                event.fatal = true;
                hls.trigger(_events2.default.ERROR, event);
                return;
              } else {
                event.fatal = false;
                hls.trigger(_events2.default.ERROR, event);
              }
            } else {
              // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
              // let's stop appending any segments, and report BUFFER_FULL_ERROR error
              segments = [];
              event.details = _errors.ErrorDetails.BUFFER_FULL_ERROR;
              hls.trigger(_events2.default.ERROR, event);
            }
          }
        }
      }
    }

    /*
      flush specified buffered range,
      return true once range has been flushed.
      as sourceBuffer.remove() is asynchronous, flushBuffer will be retriggered on sourceBuffer update end
    */

  }, {
    key: 'flushBuffer',
    value: function flushBuffer(startOffset, endOffset) {
      var sb, i, bufStart, bufEnd, flushStart, flushEnd;
      //logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime + '/' + startOffset + '/' + endOffset);
      // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
      if (this.flushBufferCounter < this.appended && this.sourceBuffer) {
        for (var type in this.sourceBuffer) {
          sb = this.sourceBuffer[type];
          if (!sb.updating) {
            for (i = 0; i < sb.buffered.length; i++) {
              bufStart = sb.buffered.start(i);
              bufEnd = sb.buffered.end(i);
              // workaround firefox not able to properly flush multiple buffered range.
              if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1 && endOffset === Number.POSITIVE_INFINITY) {
                flushStart = startOffset;
                flushEnd = endOffset;
              } else {
                flushStart = Math.max(bufStart, startOffset);
                flushEnd = Math.min(bufEnd, endOffset);
              }
              /* sometimes sourcebuffer.remove() does not flush
                 the exact expected time range.
                 to avoid rounding issues/infinite loop,
                 only flush buffer range of length greater than 500ms.
              */
              if (Math.min(flushEnd, bufEnd) - flushStart > 0.5) {
                this.flushBufferCounter++;
                _logger.logger.log('flush ' + type + ' [' + flushStart + ',' + flushEnd + '], of [' + bufStart + ',' + bufEnd + '], pos:' + this.media.currentTime);
                sb.remove(flushStart, flushEnd);
                return false;
              }
            }
          } else {
            //logger.log('abort ' + type + ' append in progress');
            // this will abort any appending in progress
            //sb.abort();
            _logger.logger.warn('cannot flush, sb updating in progress');
            return false;
          }
        }
      } else {
        _logger.logger.warn('abort flushing too many retries');
      }
      _logger.logger.log('buffer flushed');
      // everything flushed !
      return true;
    }
  }]);

  return BufferController;
}(_eventHandler2.default);

exports.default = BufferController;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/logger":36}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * cap stream level to media size dimension controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var CapLevelController = function (_EventHandler) {
  _inherits(CapLevelController, _EventHandler);

  function CapLevelController(hls) {
    _classCallCheck(this, CapLevelController);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CapLevelController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MANIFEST_PARSED));
  }

  _createClass(CapLevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.hls.config.capLevelToPlayerSize) {
        this.media = null;
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        if (this.timer) {
          this.timer = clearInterval(this.timer);
        }
      }
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      this.media = data.media instanceof HTMLVideoElement ? data.media : null;
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      if (this.hls.config.capLevelToPlayerSize) {
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        this.levels = data.levels;
        this.hls.firstLevel = this.getMaxLevel(data.firstLevel);
        clearInterval(this.timer);
        this.timer = setInterval(this.detectPlayerSize.bind(this), 1000);
        this.detectPlayerSize();
      }
    }
  }, {
    key: 'detectPlayerSize',
    value: function detectPlayerSize() {
      if (this.media) {
        var levelsLength = this.levels ? this.levels.length : 0;
        if (levelsLength) {
          this.hls.autoLevelCapping = this.getMaxLevel(levelsLength - 1);
          if (this.hls.autoLevelCapping > this.autoLevelCapping) {
            // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
            // usually happen when the user go to the fullscreen mode.
            this.hls.streamController.nextLevelSwitch();
          }
          this.autoLevelCapping = this.hls.autoLevelCapping;
        }
      }
    }

    /*
    * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
    */

  }, {
    key: 'getMaxLevel',
    value: function getMaxLevel(capLevelIndex) {
      var result = void 0,
          i = void 0,
          level = void 0,
          mWidth = this.mediaWidth,
          mHeight = this.mediaHeight,
          lWidth = 0,
          lHeight = 0;

      for (i = 0; i <= capLevelIndex; i++) {
        level = this.levels[i];
        result = i;
        lWidth = level.width;
        lHeight = level.height;
        if (mWidth <= lWidth || mHeight <= lHeight) {
          break;
        }
      }
      return result;
    }
  }, {
    key: 'contentScaleFactor',
    get: function get() {
      var pixelRatio = 1;
      try {
        pixelRatio = window.devicePixelRatio;
      } catch (e) {}
      return pixelRatio;
    }
  }, {
    key: 'mediaWidth',
    get: function get() {
      var width = void 0;
      if (this.media) {
        width = this.media.width || this.media.clientWidth || this.media.offsetWidth;
        width *= this.contentScaleFactor;
      }
      return width;
    }
  }, {
    key: 'mediaHeight',
    get: function get() {
      var height = void 0;
      if (this.media) {
        height = this.media.height || this.media.clientHeight || this.media.offsetHeight;
        height *= this.contentScaleFactor;
      }
      return height;
    }
  }]);

  return CapLevelController;
}(_eventHandler2.default);

exports.default = CapLevelController;

},{"../event-handler":21,"../events":22}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Level Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var LevelController = function (_EventHandler) {
  _inherits(LevelController, _EventHandler);

  function LevelController(hls) {
    _classCallCheck(this, LevelController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(LevelController).call(this, hls, _events2.default.MANIFEST_LOADED, _events2.default.LEVEL_LOADED, _events2.default.ERROR));

    _this.ontick = _this.tick.bind(_this);
    _this._manualLevel = _this._autoLevelCapping = -1;
    return _this;
  }

  _createClass(LevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.timer) {
        clearInterval(this.timer);
      }
      this._manualLevel = -1;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      this.canload = true;
      // speed up live playlist refresh if timer exists
      if (this.timer) {
        this.tick();
      }
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      this.canload = false;
    }
  }, {
    key: 'onManifestLoaded',
    value: function onManifestLoaded(data) {
      var levels0 = [],
          levels = [],
          bitrateStart,
          i,
          bitrateSet = {},
          videoCodecFound = false,
          audioCodecFound = false,
          hls = this.hls;

      // regroup redundant level together
      data.levels.forEach(function (level) {
        if (level.videoCodec) {
          videoCodecFound = true;
        }
        if (level.audioCodec) {
          audioCodecFound = true;
        }
        var redundantLevelId = bitrateSet[level.bitrate];
        if (redundantLevelId === undefined) {
          bitrateSet[level.bitrate] = levels0.length;
          level.url = [level.url];
          level.urlId = 0;
          levels0.push(level);
        } else {
          levels0[redundantLevelId].url.push(level.url);
        }
      });

      // remove audio-only level if we also have levels with audio+video codecs signalled
      if (videoCodecFound && audioCodecFound) {
        levels0.forEach(function (level) {
          if (level.videoCodec) {
            levels.push(level);
          }
        });
      } else {
        levels = levels0;
      }

      // only keep level with supported audio/video codecs
      levels = levels.filter(function (level) {
        var checkSupportedAudio = function checkSupportedAudio(codec) {
          return MediaSource.isTypeSupported('audio/mp4;codecs=' + codec);
        };
        var checkSupportedVideo = function checkSupportedVideo(codec) {
          return MediaSource.isTypeSupported('video/mp4;codecs=' + codec);
        };
        var audioCodec = level.audioCodec,
            videoCodec = level.videoCodec;

        return (!audioCodec || checkSupportedAudio(audioCodec)) && (!videoCodec || checkSupportedVideo(videoCodec));
      });

      if (levels.length) {
        // start bitrate is the first bitrate of the manifest
        bitrateStart = levels[0].bitrate;
        // sort level on bitrate
        levels.sort(function (a, b) {
          return a.bitrate - b.bitrate;
        });
        this._levels = levels;
        // find index of first level in sorted levels
        for (i = 0; i < levels.length; i++) {
          if (levels[i].bitrate === bitrateStart) {
            this._firstLevel = i;
            _logger.logger.log('manifest loaded,' + levels.length + ' level(s) found, first bitrate:' + bitrateStart);
            break;
          }
        }
        hls.trigger(_events2.default.MANIFEST_PARSED, { levels: this._levels, firstLevel: this._firstLevel, stats: data.stats });
      } else {
        hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR, fatal: true, url: hls.url, reason: 'no level with compatible codecs found in manifest' });
      }
      return;
    }
  }, {
    key: 'setLevelInternal',
    value: function setLevelInternal(newLevel) {
      // check if level idx is valid
      if (newLevel >= 0 && newLevel < this._levels.length) {
        // stopping live reloading timer if any
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        this._level = newLevel;
        _logger.logger.log('switching to level ' + newLevel);
        this.hls.trigger(_events2.default.LEVEL_SWITCH, { level: newLevel });
        var level = this._levels[newLevel];
        // check if we need to load playlist for this level
        if (level.details === undefined || level.details.live === true) {
          // level not retrieved yet, or live playlist we need to (re)load it
          _logger.logger.log('(re)loading playlist for level ' + newLevel);
          var urlId = level.urlId;
          this.hls.trigger(_events2.default.LEVEL_LOADING, { url: level.url[urlId], level: newLevel, id: urlId });
        }
      } else {
        // invalid level id given, trigger error
        this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.OTHER_ERROR, details: _errors.ErrorDetails.LEVEL_SWITCH_ERROR, level: newLevel, fatal: false, reason: 'invalid level idx' });
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      if (data.fatal) {
        return;
      }

      var details = data.details,
          hls = this.hls,
          levelId,
          level;
      // try to recover not fatal errors
      switch (details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          levelId = data.frag.level;
          break;
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
          levelId = data.level;
          break;
        default:
          break;
      }
      /* try to switch to a redundant stream if any available.
       * if no redundant stream available, emergency switch down (if in auto mode and current level not 0)
       * otherwise, we cannot recover this network error ...
       * don't raise FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT as fatal, as it is handled by mediaController
       */
      if (levelId !== undefined) {
        level = this._levels[levelId];
        if (level.urlId < level.url.length - 1) {
          level.urlId++;
          level.details = undefined;
          _logger.logger.warn('level controller,' + details + ' for level ' + levelId + ': switching to redundant stream id ' + level.urlId);
        } else {
          // we could try to recover if in auto mode and current level not lowest level (0)
          var recoverable = this._manualLevel === -1 && levelId;
          if (recoverable) {
            _logger.logger.warn('level controller,' + details + ': emergency switch-down for next fragment');
            hls.abrController.nextAutoLevel = 0;
          } else if (level && level.details && level.details.live) {
            _logger.logger.warn('level controller,' + details + ' on live stream, discard');
            // FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT are handled by mediaController
          } else if (details !== _errors.ErrorDetails.FRAG_LOAD_ERROR && details !== _errors.ErrorDetails.FRAG_LOAD_TIMEOUT) {
              _logger.logger.error('cannot recover ' + details + ' error');
              this._level = undefined;
              // stopping live reloading timer if any
              if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
              }
              // redispatch same error but with fatal set to true
              data.fatal = true;
              hls.trigger(event, data);
            }
        }
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(this.ontick, 1000 * data.details.targetduration / 3);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }, {
    key: 'tick',
    value: function tick() {
      var levelId = this._level;
      if (levelId !== undefined && this.canload) {
        var level = this._levels[levelId],
            urlId = level.urlId;
        var totalDuration = 0;
        for (var f in level.details.fragments) {
          totalDuration = level.details.fragments[f].endPTS;
        }
        this.hls.trigger(_events2.default.LEVEL_LOADING, { url: level.url[urlId], level: levelId, id: urlId, totalDuration: totalDuration || 0 });
      }
    }
  }, {
    key: 'levels',
    get: function get() {
      return this._levels;
    }
  }, {
    key: 'level',
    get: function get() {
      return this._level;
    },
    set: function set(newLevel) {
      if (this._level !== newLevel || this._levels[newLevel].details === undefined) {
        this.setLevelInternal(newLevel);
      }
    }
  }, {
    key: 'manualLevel',
    get: function get() {
      return this._manualLevel;
    },
    set: function set(newLevel) {
      this._manualLevel = newLevel;
      if (newLevel !== -1) {
        this.level = newLevel;
      }
    }
  }, {
    key: 'firstLevel',
    get: function get() {
      return this._firstLevel;
    },
    set: function set(newLevel) {
      this._firstLevel = newLevel;
    }
  }, {
    key: 'startLevel',
    get: function get() {
      if (this._startLevel === undefined) {
        return this._firstLevel;
      } else {
        return this._startLevel;
      }
    },
    set: function set(newLevel) {
      this._startLevel = newLevel;
    }
  }, {
    key: 'nextLoadLevel',
    get: function get() {
      if (this._manualLevel !== -1) {
        return this._manualLevel;
      } else {
        return this.hls.abrController.nextAutoLevel;
      }
    },
    set: function set(nextLevel) {
      this.level = nextLevel;
      if (this._manualLevel === -1) {
        this.hls.abrController.nextAutoLevel = nextLevel;
      }
    }
  }]);

  return LevelController;
}(_eventHandler2.default);

exports.default = LevelController;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/logger":36}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _demuxer = require('../demux/demuxer');

var _demuxer2 = _interopRequireDefault(_demuxer);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _binarySearch = require('../utils/binary-search');

var _binarySearch2 = _interopRequireDefault(_binarySearch);

var _bufferHelper = require('../helper/buffer-helper');

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _levelHelper = require('../helper/level-helper');

var _levelHelper2 = _interopRequireDefault(_levelHelper);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Stream Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var State = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  IDLE: 'IDLE',
  PAUSED: 'PAUSED',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
  WAITING_LEVEL: 'WAITING_LEVEL',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  ENDED: 'ENDED',
  ERROR: 'ERROR'
};

var StreamController = function (_EventHandler) {
  _inherits(StreamController, _EventHandler);

  function StreamController(hls) {
    _classCallCheck(this, StreamController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StreamController).call(this, hls, _events2.default.MEDIA_ATTACHED, _events2.default.MEDIA_DETACHING, _events2.default.MANIFEST_LOADING, _events2.default.MANIFEST_PARSED, _events2.default.LEVEL_LOADED, _events2.default.KEY_LOADED, _events2.default.FRAG_LOADED, _events2.default.FRAG_LOAD_EMERGENCY_ABORTED, _events2.default.FRAG_PARSING_INIT_SEGMENT, _events2.default.FRAG_PARSING_DATA, _events2.default.FRAG_PARSED, _events2.default.ERROR, _events2.default.BUFFER_APPENDED, _events2.default.BUFFER_FLUSHED));

    _this.config = hls.config;
    _this.audioCodecSwap = false;
    _this.ticks = 0;
    _this.ontick = _this.tick.bind(_this);
    return _this;
  }

  _createClass(StreamController, [{
    key: 'destroy',
    value: function destroy() {
      this.stopLoad();
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
      this.state = State.STOPPED;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      var startPosition = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      if (this.levels) {
        var media = this.media,
            lastCurrentTime = this.lastCurrentTime;
        this.stopLoad();
        this.demuxer = new _demuxer2.default(this.hls);
        if (!this.timer) {
          this.timer = setInterval(this.ontick, 100);
        }
        this.level = -1;
        this.fragLoadError = 0;
        if (media && lastCurrentTime) {
          _logger.logger.log('configure startPosition @' + lastCurrentTime);
          if (!this.lastPaused) {
            _logger.logger.log('resuming video');
            media.play();
          }
          this.state = State.IDLE;
        } else {
          this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
          this.state = State.STARTING;
        }
        this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
        this.tick();
      } else {
        _logger.logger.warn('cannot start loading as manifest not parsed yet');
        this.state = State.STOPPED;
      }
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      var frag = this.fragCurrent;
      if (frag) {
        if (frag.loader) {
          frag.loader.abort();
        }
        this.fragCurrent = null;
      }
      this.fragPrevious = null;
      if (this.demuxer) {
        this.demuxer.destroy();
        this.demuxer = null;
      }
      this.state = State.STOPPED;
    }
  }, {
    key: 'tick',
    value: function tick() {
      this.ticks++;
      if (this.ticks === 1) {
        this.doTick();
        if (this.ticks > 1) {
          setTimeout(this.tick, 1);
        }
        this.ticks = 0;
      }
    }
  }, {
    key: 'doTick',
    value: function doTick() {
      var _this2 = this;

      var pos,
          level,
          levelDetails,
          hls = this.hls,
          config = hls.config;
      switch (this.state) {
        case State.ERROR:
        //don't do anything in error state to avoid breaking further ...
        case State.PAUSED:
          //don't do anything in paused state either ...
          break;
        case State.STARTING:
          // determine load level
          this.startLevel = hls.startLevel;
          if (this.startLevel === -1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            this.startLevel = 0;
            this.fragBitrateTest = true;
          }
          // set new level to playlist loader : this will trigger start level load
          this.level = hls.nextLoadLevel = this.startLevel;
          this.state = State.WAITING_LEVEL;
          this.loadedmetadata = false;
          break;
        case State.IDLE:
          // if video not attached AND
          // start fragment already requested OR start frag prefetch disable
          // exit loop
          // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
          if (!this.media && (this.startFragRequested || !config.startFragPrefetch)) {
            break;
          }
          // determine next candidate fragment to be loaded, based on current position and
          //  end of buffer position
          //  ensure 60s of buffer upfront
          // if we have not yet loaded any fragment, start loading from start position
          if (this.loadedmetadata) {
            pos = this.media.currentTime;
          } else {
            pos = this.nextLoadPosition;
          }
          // determine next load level
          if (this.startFragRequested === false) {
            level = this.startLevel;
          } else {
            // we are not at playback start, get next load level from level Controller
            level = hls.nextLoadLevel;
          }
          var bufferInfo = _bufferHelper2.default.bufferInfo(this.media, pos, config.maxBufferHole),
              bufferLen = bufferInfo.len,
              bufferEnd = bufferInfo.end,
              fragPrevious = this.fragPrevious,
              maxBufLen;
          // console.info(bufferInfo);
          // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
          if (this.levels[level].hasOwnProperty('bitrate')) {
            maxBufLen = Math.max(8 * config.maxBufferSize / this.levels[level].bitrate, config.maxBufferLength);
            maxBufLen = Math.min(maxBufLen, config.maxMaxBufferLength);
          } else {
            maxBufLen = config.maxBufferLength;
          }
          // if buffer length is less than maxBufLen try to load a new fragment
          if (bufferLen < maxBufLen) {
            // set next load level : this will trigger a playlist load if needed
            hls.nextLoadLevel = level;
            this.level = level;
            levelDetails = this.levels[level].details;
            // if level info not retrieved yet, switch state and wait for level retrieval
            // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
            // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
            if (typeof levelDetails === 'undefined' || levelDetails.live && this.levelLastLoaded !== level) {
              this.state = State.WAITING_LEVEL;
              break;
            }
            // find fragment index, contiguous with end of buffer position
            var fragments = levelDetails.fragments,
                fragLen = fragments.length,
                start = fragments[0].start,
                end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration,
                frag = void 0;

            // in case of live playlist we need to ensure that requested position is not located before playlist start
            if (levelDetails.live) {
              // check if requested position is within seekable boundaries :
              //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.media.seeking}`);
              var maxLatency = config.liveMaxLatencyDuration !== undefined ? config.liveMaxLatencyDuration : config.liveMaxLatencyDurationCount * levelDetails.targetduration;

              if (bufferEnd < Math.max(start, end - maxLatency)) {
                var targetLatency = config.liveSyncDuration !== undefined ? config.liveSyncDuration : config.liveSyncDurationCount * levelDetails.targetduration;
                this.seekAfterBuffered = start + Math.max(0, levelDetails.totalduration - targetLatency);
                _logger.logger.log('buffer end: ' + bufferEnd + ' is located too far from the end of live sliding playlist, media position will be reseted to: ' + this.seekAfterBuffered.toFixed(3));
                bufferEnd = this.seekAfterBuffered;
              }
              if (this.startFragRequested && !levelDetails.PTSKnown) {
                /* we are switching level on live playlist, but we don't have any PTS info for that quality level ...
                   try to load frag matching with next SN.
                   even if SN are not synchronized between playlists, loading this frag will help us
                   compute playlist sliding and find the right one after in case it was not the right consecutive one */
                if (fragPrevious) {
                  var targetSN = fragPrevious.sn + 1;
                  if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
                    frag = fragments[targetSN - levelDetails.startSN];
                    _logger.logger.log('live playlist, switching playlist, load frag with next SN: ' + frag.sn);
                  }
                }
                if (!frag) {
                  /* we have no idea about which fragment should be loaded.
                     so let's load mid fragment. it will help computing playlist sliding and find the right one
                  */
                  frag = fragments[Math.min(fragLen - 1, Math.round(fragLen / 2))];
                  _logger.logger.log('live playlist, switching playlist, unknown, load middle frag : ' + frag.sn);
                }
              }
            } else {
              // VoD playlist: if bufferEnd before start of playlist, load first fragment
              if (bufferEnd < start) {
                frag = fragments[0];
              }
            }
            if (!frag) {
              (function () {
                var foundFrag = void 0;
                var maxFragLookUpTolerance = config.maxFragLookUpTolerance;
                if (bufferEnd < end) {
                  if (bufferEnd > end - maxFragLookUpTolerance) {
                    maxFragLookUpTolerance = 0;
                  }
                  foundFrag = _binarySearch2.default.search(fragments, function (candidate) {
                    // offset should be within fragment boundary - config.maxFragLookUpTolerance
                    // this is to cope with situations like
                    // bufferEnd = 9.991
                    // frag[Ø] : [0,10]
                    // frag[1] : [10,20]
                    // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
                    //              frag start               frag start+duration
                    //                  |-----------------------------|
                    //              <--->                         <--->
                    //  ...--------><-----------------------------><---------....
                    // previous frag         matching fragment         next frag
                    //  return -1             return 0                 return 1
                    // logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start - maxFragLookUpTolerance}/${(candidate.start+candidate.duration - maxFragLookUpTolerance)}/${bufferEnd}`);
                    if (candidate.start + candidate.duration - maxFragLookUpTolerance <= bufferEnd) {
                      return 1;
                    } else if (candidate.start - maxFragLookUpTolerance > bufferEnd) {
                      return -1;
                    }
                    // console.info(candidate);
                    return 0;
                  });
                  // console.info(foundFrag);
                } else {
                    // reach end of playlist
                    foundFrag = fragments[fragLen - 1];
                  }
                if (foundFrag) {
                  frag = foundFrag;
                  start = foundFrag.start;
                  //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
                  if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
                    if (frag.sn < levelDetails.endSN) {
                      frag = fragments[frag.sn + 1 - levelDetails.startSN];
                      _logger.logger.log('SN just loaded, load next one: ' + frag.sn);
                    } else {
                      // have we reached end of VOD playlist ?
                      if (!levelDetails.live) {
                        _this2.hls.trigger(_events2.default.BUFFER_EOS);
                        _this2.state = State.ENDED;
                      }
                      frag = null;
                    }
                  }
                }
              })();
            }
            if (frag) {
              //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
              if (frag.decryptdata.uri != null && frag.decryptdata.key == null) {
                _logger.logger.log('Loading key for ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level);
                this.state = State.KEY_LOADING;
                hls.trigger(_events2.default.KEY_LOADING, { frag: frag });
              } else {
                _logger.logger.log('Loading ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
                frag.autoLevel = hls.autoLevelEnabled;
                if (this.levels.length > 1) {
                  frag.expectedLen = Math.round(frag.duration * this.levels[level].bitrate / 8);
                  frag.trequest = performance.now();
                }
                // ensure that we are not reloading the same fragments in loop ...
                if (this.fragLoadIdx !== undefined) {
                  this.fragLoadIdx++;
                } else {
                  this.fragLoadIdx = 0;
                }
                if (frag.loadCounter) {
                  frag.loadCounter++;
                  var maxThreshold = config.fragLoadingLoopThreshold;
                  // if this frag has already been loaded 3 times, and if it has been reloaded recently
                  if (frag.loadCounter > maxThreshold && Math.abs(this.fragLoadIdx - frag.loadIdx) < maxThreshold) {
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: frag });
                    return;
                  }
                } else {
                  frag.loadCounter = 1;
                }
                frag.loadIdx = this.fragLoadIdx;
                this.fragCurrent = frag;
                this.startFragRequested = true;
                hls.trigger(_events2.default.FRAG_LOADING, { frag: frag });
                this.state = State.FRAG_LOADING;
              }
            }
          }
          break;
        case State.WAITING_LEVEL:
          level = this.levels[this.level];
          // check if playlist is already loaded
          if (level && level.details) {
            this.state = State.IDLE;
          }
          break;
        case State.FRAG_LOADING_WAITING_RETRY:
          var now = performance.now();
          var retryDate = this.retryDate;
          var media = this.media;
          var isSeeking = media && media.seeking;
          // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
          if (!retryDate || now >= retryDate || isSeeking) {
            _logger.logger.log('mediaController: retryDate reached, switch back to IDLE state');
            this.state = State.IDLE;
          }
          break;
        case State.STOPPED:
        case State.FRAG_LOADING:
        case State.PARSING:
        case State.PARSED:
        case State.ENDED:
          break;
        default:
          break;
      }
      // check buffer
      this._checkBuffer();
      // check/update current fragment
      this._checkFragmentChanged();
    }
  }, {
    key: 'getBufferRange',
    value: function getBufferRange(position) {
      var i,
          range,
          bufferRange = this.bufferRange;
      if (bufferRange) {
        for (i = bufferRange.length - 1; i >= 0; i--) {
          range = bufferRange[i];
          if (position >= range.start && position <= range.end) {
            return range;
          }
        }
      }
      return null;
    }
  }, {
    key: 'followingBufferRange',
    value: function followingBufferRange(range) {
      if (range) {
        // try to get range of next fragment (500ms after this range)
        return this.getBufferRange(range.end + 0.5);
      }
      return null;
    }
  }, {
    key: 'isBuffered',
    value: function isBuffered(position) {
      var v = this.media,
          buffered = v.buffered;
      for (var i = 0; i < buffered.length; i++) {
        if (position >= buffered.start(i) && position <= buffered.end(i)) {
          return true;
        }
      }
      return false;
    }
  }, {
    key: '_checkFragmentChanged',
    value: function _checkFragmentChanged() {
      var rangeCurrent,
          currentTime,
          video = this.media;
      if (video && video.seeking === false) {
        currentTime = video.currentTime;
        /* if video element is in seeked state, currentTime can only increase.
          (assuming that playback rate is positive ...)
          As sometimes currentTime jumps back to zero after a
          media decode error, check this, to avoid seeking back to
          wrong position after a media decode error
        */
        if (currentTime > video.playbackRate * this.lastCurrentTime) {
          this.lastCurrentTime = currentTime;
        }
        if (this.isBuffered(currentTime)) {
          rangeCurrent = this.getBufferRange(currentTime);
        } else if (this.isBuffered(currentTime + 0.1)) {
          /* ensure that FRAG_CHANGED event is triggered at startup,
            when first video frame is displayed and playback is paused.
            add a tolerance of 100ms, in case current position is not buffered,
            check if current pos+100ms is buffered and use that buffer range
            for FRAG_CHANGED event reporting */
          rangeCurrent = this.getBufferRange(currentTime + 0.1);
        }
        if (rangeCurrent) {
          var fragPlaying = rangeCurrent.frag;
          if (fragPlaying !== this.fragPlaying) {
            this.fragPlaying = fragPlaying;
            this.hls.trigger(_events2.default.FRAG_CHANGED, { frag: fragPlaying });
          }
        }
      }
    }

    /*
      on immediate level switch :
       - pause playback if playing
       - cancel any pending load request
       - and trigger a buffer flush
    */

  }, {
    key: 'immediateLevelSwitch',
    value: function immediateLevelSwitch() {
      _logger.logger.log('immediateLevelSwitch');
      if (!this.immediateSwitch) {
        this.immediateSwitch = true;
        this.previouslyPaused = this.media.paused;
        this.media.pause();
      }
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && fragCurrent.loader) {
        fragCurrent.loader.abort();
      }
      this.fragCurrent = null;
      // flush everything
      this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY });
      this.state = State.PAUSED;
      // increase fragment load Index to avoid frag loop loading error after buffer flush
      this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      // speed up switching, trigger timer function
      this.tick();
    }

    /*
       on immediate level switch end, after new fragment has been buffered :
        - nudge video decoder by slightly adjusting video currentTime
        - resume the playback if needed
    */

  }, {
    key: 'immediateLevelSwitchEnd',
    value: function immediateLevelSwitchEnd() {
      this.immediateSwitch = false;
      this.media.currentTime -= 0.0001;
      if (!this.previouslyPaused) {
        this.media.play();
      }
    }
  }, {
    key: 'nextLevelSwitch',
    value: function nextLevelSwitch() {
      /* try to switch ASAP without breaking video playback :
         in order to ensure smooth but quick level switching,
        we need to find the next flushable buffer range
        we should take into account new segment fetch time
      */
      var fetchdelay, currentRange, nextRange;
      currentRange = this.getBufferRange(this.media.currentTime);
      if (currentRange && currentRange.start > 1) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: currentRange.start - 1 });
        this.state = State.PAUSED;
      }
      if (!this.media.paused) {
        // add a safety delay of 1s
        var nextLevelId = this.hls.nextLoadLevel,
            nextLevel = this.levels[nextLevelId],
            fragLastKbps = this.fragLastKbps;
        if (fragLastKbps && this.fragCurrent) {
          fetchdelay = this.fragCurrent.duration * nextLevel.bitrate / (1000 * fragLastKbps) + 1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      //logger.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      nextRange = this.getBufferRange(this.media.currentTime + fetchdelay);
      if (nextRange) {
        // we can flush buffer range following this one without stalling playback
        nextRange = this.followingBufferRange(nextRange);
        if (nextRange) {
          // flush position is the start position of this new buffer
          this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: nextRange.start, endOffset: Number.POSITIVE_INFINITY });
          this.state = State.PAUSED;
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          var fragCurrent = this.fragCurrent;
          if (fragCurrent && fragCurrent.loader) {
            fragCurrent.loader.abort();
          }
          this.fragCurrent = null;
          // increase fragment load Index to avoid frag loop loading error after buffer flush
          this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
        }
      }
    }
  }, {
    key: 'onMediaAttached',
    value: function onMediaAttached(data) {
      var media = this.media = data.media;
      this.onvseeking = this.onMediaSeeking.bind(this);
      this.onvseeked = this.onMediaSeeked.bind(this);
      this.onvended = this.onMediaEnded.bind(this);
      media.addEventListener('seeking', this.onvseeking);
      media.addEventListener('seeked', this.onvseeked);
      media.addEventListener('ended', this.onvended);
      if (this.levels && this.config.autoStartLoad) {
        this.hls.startLoad();
      }
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      var media = this.media;
      if (media && media.ended) {
        _logger.logger.log('MSE detaching and video ended, reset startPosition');
        this.startPosition = this.lastCurrentTime = 0;
      }

      // reset fragment loading counter on MSE detaching to avoid reporting FRAG_LOOP_LOADING_ERROR after error recovery
      var levels = this.levels;
      if (levels) {
        // reset fragment load counter
        levels.forEach(function (level) {
          if (level.details) {
            level.details.fragments.forEach(function (fragment) {
              fragment.loadCounter = undefined;
            });
          }
        });
      }
      // remove video listeners
      if (media) {
        media.removeEventListener('seeking', this.onvseeking);
        media.removeEventListener('seeked', this.onvseeked);
        media.removeEventListener('ended', this.onvended);
        this.onvseeking = this.onvseeked = this.onvended = null;
      }
      this.media = null;
      this.loadedmetadata = false;
      this.stopLoad();
    }
  }, {
    key: 'onMediaSeeking',
    value: function onMediaSeeking() {
      if (this.state === State.FRAG_LOADING) {
        // check if currently loaded fragment is inside buffer.
        //if outside, cancel fragment loading, otherwise do nothing
        if (_bufferHelper2.default.bufferInfo(this.media, this.media.currentTime, this.config.maxBufferHole).len === 0) {
          _logger.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
          var fragCurrent = this.fragCurrent;
          if (fragCurrent) {
            if (fragCurrent.loader) {
              fragCurrent.loader.abort();
            }
            this.fragCurrent = null;
          }
          this.fragPrevious = null;
          // switch to IDLE state to load new fragment
          this.state = State.IDLE;
        }
      } else if (this.state === State.ENDED) {
        // switch to IDLE state to check for potential new fragment
        this.state = State.IDLE;
      }
      if (this.media) {
        this.lastCurrentTime = this.media.currentTime;
      }
      // avoid reporting fragment loop loading error in case user is seeking several times on same position
      if (this.fragLoadIdx !== undefined) {
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      }
      // tick to speed up processing
      this.tick();
    }
  }, {
    key: 'onMediaSeeked',
    value: function onMediaSeeked() {
      // tick to speed up FRAGMENT_PLAYING triggering
      this.tick();
    }
  }, {
    key: 'onMediaEnded',
    value: function onMediaEnded() {
      _logger.logger.log('media ended');
      // reset startPosition and lastCurrentTime to restart playback @ stream beginning
      this.startPosition = this.lastCurrentTime = 0;
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      // reset buffer on manifest loading
      _logger.logger.log('trigger BUFFER_RESET');
      this.hls.trigger(_events2.default.BUFFER_RESET);
      this.bufferRange = [];
      this.stalled = false;
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      var aac = false,
          heaac = false,
          codec;
      data.levels.forEach(function (level) {
        // detect if we have different kind of audio codecs used amongst playlists
        codec = level.audioCodec;
        if (codec) {
          if (codec.indexOf('mp4a.40.2') !== -1) {
            aac = true;
          }
          if (codec.indexOf('mp4a.40.5') !== -1) {
            heaac = true;
          }
        }
      });
      this.audioCodecSwitch = aac && heaac;
      if (this.audioCodecSwitch) {
        _logger.logger.log('both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC');
      }
      this.levels = data.levels;
      this.startLevelLoaded = false;
      this.startFragRequested = false;
      if (this.config.autoStartLoad) {
        this.hls.startLoad();
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      var newDetails = data.details,
          newLevelId = data.level,
          curLevel = this.levels[newLevelId],
          duration = newDetails.totalduration,
          sliding = 0;

      _logger.logger.log('level ' + newLevelId + ' loaded [' + newDetails.startSN + ',' + newDetails.endSN + '],duration:' + duration);
      this.levelLastLoaded = newLevelId;

      if (newDetails.live) {
        var curDetails = curLevel.details;
        if (curDetails) {
          // we already have details for that level, merge them
          _levelHelper2.default.mergeDetails(curDetails, newDetails);
          sliding = newDetails.fragments[0].start;
          if (newDetails.PTSKnown) {
            _logger.logger.log('live playlist sliding:' + sliding.toFixed(3));
          } else {
            _logger.logger.log('live playlist - outdated PTS, unknown sliding');
          }
        } else {
          newDetails.PTSKnown = false;
          _logger.logger.log('live playlist - first load, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
      }
      // override level info
      curLevel.details = newDetails;
      this.hls.trigger(_events2.default.LEVEL_UPDATED, { details: newDetails, level: newLevelId });

      // compute start position
      if (this.startFragRequested === false) {
        // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
        if (newDetails.live) {
          var targetLatency = this.config.liveSyncDuration !== undefined ? this.config.liveSyncDuration : this.config.liveSyncDurationCount * newDetails.targetduration;
          // targetLatency = 15;
          this.startPosition = Math.max(0, sliding + duration - targetLatency);
        }
        this.nextLoadPosition = this.startPosition;
      }
      // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
      if (this.state === State.WAITING_LEVEL) {
        this.state = State.IDLE;
      }
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onKeyLoaded',
    value: function onKeyLoaded() {
      if (this.state === State.KEY_LOADING) {
        this.state = State.IDLE;
        this.tick();
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var fragCurrent = this.fragCurrent;
      if (this.state === State.FRAG_LOADING && fragCurrent && data.frag.level === fragCurrent.level && data.frag.sn === fragCurrent.sn) {
        if (this.fragBitrateTest === true) {
          // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
          this.state = State.IDLE;
          this.fragBitrateTest = false;
          data.stats.tparsed = data.stats.tbuffered = performance.now();
          this.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: data.stats, frag: fragCurrent });
        } else {
          this.state = State.PARSING;
          // transmux the MPEG-TS data to ISO-BMFF segments
          this.stats = data.stats;
          var currentLevel = this.levels[this.level],
              details = currentLevel.details,
              duration = details.totalduration,
              start = fragCurrent.start,
              level = fragCurrent.level,
              sn = fragCurrent.sn,
              audioCodec = currentLevel.audioCodec || this.config.defaultAudioCodec;
          if (this.audioCodecSwap) {
            _logger.logger.log('swapping playlist audio codec');
            if (audioCodec === undefined) {
              audioCodec = this.lastAudioCodec;
            }
            if (audioCodec) {
              if (audioCodec.indexOf('mp4a.40.5') !== -1) {
                audioCodec = 'mp4a.40.2';
              } else {
                audioCodec = 'mp4a.40.5';
              }
            }
          }
          this.pendingAppending = 0;
          // logger.log(`Demuxing ${sn} of [${details.startSN} ,${details.endSN}],level ${level}`);
          // 		var re = /(\d+)_\d+.ts/;
          // 		var t0 = 0;
          // 		var m = re.exec(fragCurrent.url);
          // 		var t0 = (m && m[1]) ? parseInt( m[1] )/1000 : 0;
          //
          this.demuxer.push(data.payload, audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata, start);
        }
      }
      this.fragLoadError = 0;
    }
  }, {
    key: 'onFragParsingInitSegment',
    value: function onFragParsingInitSegment(data) {
      if (this.state === State.PARSING) {
        var tracks = data.tracks,
            trackName,
            track;

        // include levelCodec in audio and video tracks
        track = tracks.audio;
        if (track) {
          var audioCodec = this.levels[this.level].audioCodec,
              ua = navigator.userAgent.toLowerCase();
          if (audioCodec && this.audioCodecSwap) {
            _logger.logger.log('swapping playlist audio codec');
            if (audioCodec.indexOf('mp4a.40.5') !== -1) {
              audioCodec = 'mp4a.40.2';
            } else {
              audioCodec = 'mp4a.40.5';
            }
          }
          // in case AAC and HE-AAC audio codecs are signalled in manifest
          // force HE-AAC , as it seems that most browsers prefers that way,
          // except for mono streams OR on FF
          // these conditions might need to be reviewed ...
          if (this.audioCodecSwitch) {
            // don't force HE-AAC if mono stream
            if (track.metadata.channelCount !== 1 &&
            // don't force HE-AAC if firefox
            ua.indexOf('firefox') === -1) {
              audioCodec = 'mp4a.40.5';
            }
          }
          // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
          if (ua.indexOf('android') !== -1) {
            audioCodec = 'mp4a.40.2';
            _logger.logger.log('Android: force audio codec to' + audioCodec);
          }
          track.levelCodec = audioCodec;
        }
        track = tracks.video;
        if (track) {
          track.levelCodec = this.levels[this.level].videoCodec;
        }

        // if remuxer specify that a unique track needs to generated,
        // let's merge all tracks together
        if (data.unique) {
          var mergedTrack = {
            codec: '',
            levelCodec: ''
          };
          for (trackName in data.tracks) {
            track = tracks[trackName];
            mergedTrack.container = track.container;
            if (mergedTrack.codec) {
              mergedTrack.codec += ',';
              mergedTrack.levelCodec += ',';
            }
            if (track.codec) {
              mergedTrack.codec += track.codec;
            }
            if (track.levelCodec) {
              mergedTrack.levelCodec += track.levelCodec;
            }
          }
          tracks = { audiovideo: mergedTrack };
        }
        this.hls.trigger(_events2.default.BUFFER_CODECS, tracks);
        // loop through tracks that are going to be provided to bufferController
        for (trackName in tracks) {
          track = tracks[trackName];
          _logger.logger.log('track:' + trackName + ',container:' + track.container + ',codecs[level/parsed]=[' + track.levelCodec + '/' + track.codec + ']');
          var initSegment = track.initSegment;
          if (initSegment) {
            this.pendingAppending++;
            this.hls.trigger(_events2.default.BUFFER_APPENDING, { type: trackName, data: initSegment });
          }
        }
        //trigger handler right now
        this.tick();
      }
    }
  }, {
    key: 'onFragParsingData',
    value: function onFragParsingData(data) {
      var _this3 = this;

      if (this.state === State.PARSING) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level],
            frag = this.fragCurrent;

        _logger.logger.log('parsed ' + data.type + ',PTS:[' + data.startPTS.toFixed(3) + ',' + data.endPTS.toFixed(3) + '],DTS:[' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '],nb:' + data.nb);

        var drift = _levelHelper2.default.updateFragPTS(level.details, frag.sn, data.startPTS, data.endPTS),
            hls = this.hls;
        hls.trigger(_events2.default.LEVEL_PTS_UPDATED, { details: level.details, level: this.level, drift: drift });

        [data.data1, data.data2].forEach(function (buffer) {
          if (buffer) {
            _this3.pendingAppending++;
            hls.trigger(_events2.default.BUFFER_APPENDING, { type: data.type, data: buffer });
          }
        });

        this.nextLoadPosition = data.endPTS;
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: frag });

        //trigger handler right now
        this.tick();
      } else {
        _logger.logger.warn('not in PARSING state but ' + this.state + ', ignoring FRAG_PARSING_DATA event');
      }
    }
  }, {
    key: 'onFragParsed',
    value: function onFragParsed() {
      if (this.state === State.PARSING) {
        this.stats.tparsed = performance.now();
        this.state = State.PARSED;
        this._checkAppendedParsed();
      }
    }
  }, {
    key: 'onBufferAppended',
    value: function onBufferAppended() {
      switch (this.state) {
        case State.PARSING:
        case State.PARSED:
          this.pendingAppending--;
          this._checkAppendedParsed();
          break;
        default:
          break;
      }
    }
  }, {
    key: '_checkAppendedParsed',
    value: function _checkAppendedParsed() {
      //trigger handler right now
      if (this.state === State.PARSED && this.pendingAppending === 0) {
        var frag = this.fragCurrent,
            stats = this.stats;
        if (frag) {
          this.fragPrevious = frag;
          stats.tbuffered = performance.now();
          this.fragLastKbps = Math.round(8 * stats.length / (stats.tbuffered - stats.tfirst));
          this.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: stats, frag: frag });
          // console.info(stats);
          // console.info(frag);
          _logger.logger.log('media buffered : ' + this.timeRangesToString(this.media.buffered));
          this.state = State.IDLE;
        }
        this.tick();
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      switch (data.details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
          if (!data.fatal) {
            var loadError = this.fragLoadError;
            if (loadError) {
              loadError++;
            } else {
              loadError = 1;
            }
            if (loadError <= this.config.fragLoadingMaxRetry) {
              this.fragLoadError = loadError;
              // reset load counter to avoid frag loop loading error
              data.frag.loadCounter = 0;
              // exponential backoff capped to 64s
              var delay = Math.min(Math.pow(2, loadError - 1) * this.config.fragLoadingRetryDelay, 64000);
              _logger.logger.warn('mediaController: frag loading failed, retry in ' + delay + ' ms');
              this.retryDate = performance.now() + delay;
              // retry loading state
              this.state = State.FRAG_LOADING_WAITING_RETRY;
            } else {
              _logger.logger.error('mediaController: ' + data.details + ' reaches max retry, redispatch as fatal ...');
              // redispatch same error but with fatal set to true
              data.fatal = true;
              this.hls.trigger(_events2.default.ERROR, data);
              this.state = State.ERROR;
            }
          }
          break;
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          // if fatal error, stop processing, otherwise move to IDLE to retry loading
          _logger.logger.warn('mediaController: ' + data.details + ' while loading frag,switch to ' + (data.fatal ? 'ERROR' : 'IDLE') + ' state ...');
          this.state = data.fatal ? State.ERROR : State.IDLE;
          break;
        case _errors.ErrorDetails.BUFFER_FULL_ERROR:
          // trigger a smooth level switch to empty buffers
          // also reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
          this.config.maxMaxBufferLength /= 2;
          _logger.logger.warn('reduce max buffer length to ' + this.config.maxMaxBufferLength + 's and trigger a nextLevelSwitch to flush old buffer and fix QuotaExceededError');
          this.nextLevelSwitch();
          break;
        default:
          break;
      }
    }
  }, {
    key: '_checkBuffer',
    value: function _checkBuffer() {
      var media = this.media;
      if (media) {
        // compare readyState
        var readyState = media.readyState;
        // if ready state different from HAVE_NOTHING (numeric value 0), we are allowed to seek
        if (readyState) {
          var targetSeekPosition, currentTime;
          // if seek after buffered defined, let's seek if within acceptable range
          var seekAfterBuffered = this.seekAfterBuffered;
          if (seekAfterBuffered) {
            if (media.duration >= seekAfterBuffered) {
              targetSeekPosition = seekAfterBuffered;
              this.seekAfterBuffered = undefined;
            }
          } else {
            currentTime = media.currentTime;
            var loadedmetadata = this.loadedmetadata;

            // adjust currentTime to start position on loaded metadata
            if (!loadedmetadata && media.buffered.length) {
              this.loadedmetadata = true;
              // only adjust currentTime if not equal to 0
              if (!currentTime && currentTime !== this.startPosition) {
                targetSeekPosition = this.startPosition;
              }
            }
          }
          if (targetSeekPosition) {
            currentTime = targetSeekPosition;
            _logger.logger.log('target seek position:' + targetSeekPosition);
          }
          var bufferInfo = _bufferHelper2.default.bufferInfo(media, currentTime, 0),
              expectedPlaying = !(media.paused || media.ended || media.seeking || readyState < 2),
              jumpThreshold = 0.4,
              // tolerance needed as some browsers stalls playback before reaching buffered range end
          playheadMoving = currentTime > media.playbackRate * this.lastCurrentTime;

          if (this.stalled && playheadMoving) {
            this.stalled = false;
            _logger.logger.log('playback not stuck anymore @' + currentTime);
          }
          // check buffer upfront
          // if less than 200ms is buffered, and media is expected to play but playhead is not moving,
          // and we have a new buffer range available upfront, let's seek to that one
          if (bufferInfo.len <= jumpThreshold) {
            if (playheadMoving || !expectedPlaying) {
              // playhead moving or media not playing
              jumpThreshold = 0;
            } else {
              // playhead not moving AND media expected to play
              if (!this.stalled) {
                _logger.logger.log('playback seems stuck @' + currentTime);
                this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_STALLED_ERROR, fatal: false });
                this.stalled = true;
              }
            }
            // if we are below threshold, try to jump if next buffer range is close
            if (bufferInfo.len <= jumpThreshold) {
              // no buffer available @ currentTime, check if next buffer is close (within a config.maxSeekHole second range)
              var nextBufferStart = bufferInfo.nextStart,
                  delta = nextBufferStart - currentTime;
              if (nextBufferStart && delta < this.config.maxSeekHole && delta > 0 && !media.seeking) {
                // next buffer is close ! adjust currentTime to nextBufferStart
                // this will ensure effective video decoding
                _logger.logger.log('adjust currentTime from ' + media.currentTime + ' to next buffered @ ' + nextBufferStart);
                media.currentTime = nextBufferStart;
                this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_SEEK_OVER_HOLE, fatal: false });
              }
            }
          } else {
            if (targetSeekPosition && media.currentTime !== targetSeekPosition) {
              _logger.logger.log('adjust currentTime from ' + media.currentTime + ' to ' + targetSeekPosition);
              media.currentTime = targetSeekPosition;
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoadEmergencyAborted',
    value: function onFragLoadEmergencyAborted() {
      debugger;
      this.state = State.IDLE;
      this.tick();
    }
  }, {
    key: 'onBufferFlushed',
    value: function onBufferFlushed() {
      /* after successful buffer flushing, rebuild buffer Range array
        loop through existing buffer range and check if
        corresponding range is still buffered. only push to new array already buffered range
      */
      var newRange = [],
          range,
          i;
      for (i = 0; i < this.bufferRange.length; i++) {
        range = this.bufferRange[i];
        if (this.isBuffered((range.start + range.end) / 2)) {
          newRange.push(range);
        }
      }
      this.bufferRange = newRange;

      // handle end of immediate switching if needed
      if (this.immediateSwitch) {
        this.immediateLevelSwitchEnd();
      }
      // move to IDLE once flush complete. this should trigger new fragment loading
      this.state = State.IDLE;
      // reset reference to frag
      this.fragPrevious = null;
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      this.audioCodecSwap = !this.audioCodecSwap;
    }
  }, {
    key: 'timeRangesToString',
    value: function timeRangesToString(r) {
      var log = '',
          len = r.length;
      for (var i = 0; i < len; i++) {
        log += '[' + r.start(i) + ',' + r.end(i) + ']';
      }
      return log;
    }
  }, {
    key: 'currentLevel',
    get: function get() {
      if (this.media) {
        var range = this.getBufferRange(this.media.currentTime);
        if (range) {
          return range.frag.level;
        }
      }
      return -1;
    }
  }, {
    key: 'nextBufferRange',
    get: function get() {
      if (this.media) {
        // first get end range of current fragment
        return this.followingBufferRange(this.getBufferRange(this.media.currentTime));
      } else {
        return null;
      }
    }
  }, {
    key: 'nextLevel',
    get: function get() {
      var range = this.nextBufferRange;
      if (range) {
        return range.frag.level;
      } else {
        return -1;
      }
    }
  }]);

  return StreamController;
}(_eventHandler2.default);

exports.default = StreamController;

},{"../demux/demuxer":16,"../errors":20,"../event-handler":21,"../events":22,"../helper/buffer-helper":23,"../helper/level-helper":24,"../utils/binary-search":34,"../utils/logger":36}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _cea708Interpreter = require('../utils/cea-708-interpreter');

var _cea708Interpreter2 = _interopRequireDefault(_cea708Interpreter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Timeline Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var TimelineController = function (_EventHandler) {
  _inherits(TimelineController, _EventHandler);

  function TimelineController(hls) {
    _classCallCheck(this, TimelineController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TimelineController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.FRAG_PARSING_USERDATA, _events2.default.MANIFEST_LOADING, _events2.default.FRAG_LOADED));

    _this.hls = hls;
    _this.config = hls.config;

    if (_this.config.enableCEA708Captions) {
      _this.cea708Interpreter = new _cea708Interpreter2.default();
    }
    return _this;
  }

  _createClass(TimelineController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      this.cea708Interpreter.attach(media);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      this.cea708Interpreter.detach();
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      this.lastPts = Number.POSITIVE_INFINITY;
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var pts = data.frag.start; //Number.POSITIVE_INFINITY;

      // if this is a frag for a previously loaded timerange, remove all captions
      // TODO: consider just removing captions for the timerange
      if (pts <= this.lastPts) {
        this.cea708Interpreter.clear();
      }

      this.lastPts = pts;
    }
  }, {
    key: 'onFragParsingUserdata',
    value: function onFragParsingUserdata(data) {
      // push all of the CEA-708 messages into the interpreter
      // immediately. It will create the proper timestamps based on our PTS value
      for (var i = 0; i < data.samples.length; i++) {
        this.cea708Interpreter.push(data.samples[i].pts, data.samples[i].bytes);
      }
    }
  }]);

  return TimelineController;
}(_eventHandler2.default);

exports.default = TimelineController;

},{"../event-handler":21,"../events":22,"../utils/cea-708-interpreter":35}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 *
 * This file contains an adaptation of the AES decryption algorithm
 * from the Standford Javascript Cryptography Library. That work is
 * covered by the following copyright and permissions notice:
 *
 * Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
 * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * The views and conclusions contained in the software and documentation
 * are those of the authors and should not be interpreted as representing
 * official policies, either expressed or implied, of the authors.
 */

var AES = function () {

  /**
   * Schedule out an AES key for both encryption and decryption. This
   * is a low-level class. Use a cipher mode to do bulk encryption.
   *
   * @constructor
   * @param key {Array} The key as an array of 4, 6 or 8 words.
   */

  function AES(key) {
    _classCallCheck(this, AES);

    /**
     * The expanded S-box and inverse S-box tables. These will be computed
     * on the client so that we don't have to send them down the wire.
     *
     * There are two tables, _tables[0] is for encryption and
     * _tables[1] is for decryption.
     *
     * The first 4 sub-tables are the expanded S-box with MixColumns. The
     * last (_tables[01][4]) is the S-box itself.
     *
     * @private
     */
    this._tables = [[[], [], [], [], []], [[], [], [], [], []]];

    this._precompute();

    var i,
        j,
        tmp,
        encKey,
        decKey,
        sbox = this._tables[0][4],
        decTable = this._tables[1],
        keyLen = key.length,
        rcon = 1;

    if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
      throw new Error('Invalid aes key size=' + keyLen);
    }

    encKey = key.slice(0);
    decKey = [];
    this._key = [encKey, decKey];

    // schedule encryption keys
    for (i = keyLen; i < 4 * keyLen + 28; i++) {
      tmp = encKey[i - 1];

      // apply sbox
      if (i % keyLen === 0 || keyLen === 8 && i % keyLen === 4) {
        tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255];

        // shift rows and add rcon
        if (i % keyLen === 0) {
          tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
          rcon = rcon << 1 ^ (rcon >> 7) * 283;
        }
      }

      encKey[i] = encKey[i - keyLen] ^ tmp;
    }

    // schedule decryption keys
    for (j = 0; i; j++, i--) {
      tmp = encKey[j & 3 ? i : i - 4];
      if (i <= 4 || j < 4) {
        decKey[j] = tmp;
      } else {
        decKey[j] = decTable[0][sbox[tmp >>> 24]] ^ decTable[1][sbox[tmp >> 16 & 255]] ^ decTable[2][sbox[tmp >> 8 & 255]] ^ decTable[3][sbox[tmp & 255]];
      }
    }
  }

  /**
   * Expand the S-box tables.
   *
   * @private
   */


  _createClass(AES, [{
    key: '_precompute',
    value: function _precompute() {
      var encTable = this._tables[0],
          decTable = this._tables[1],
          sbox = encTable[4],
          sboxInv = decTable[4],
          i,
          x,
          xInv,
          d = [],
          th = [],
          x2,
          x4,
          x8,
          s,
          tEnc,
          tDec;

      // Compute double and third tables
      for (i = 0; i < 256; i++) {
        th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i;
      }

      for (x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
        // Compute sbox
        s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
        s = s >> 8 ^ s & 255 ^ 99;
        sbox[x] = s;
        sboxInv[s] = x;

        // Compute MixColumns
        x8 = d[x4 = d[x2 = d[x]]];
        tDec = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
        tEnc = d[s] * 0x101 ^ s * 0x1010100;

        for (i = 0; i < 4; i++) {
          encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
          decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8;
        }
      }

      // Compactify. Considerable speedup on Firefox.
      for (i = 0; i < 5; i++) {
        encTable[i] = encTable[i].slice(0);
        decTable[i] = decTable[i].slice(0);
      }
    }

    /**
     * Decrypt 16 bytes, specified as four 32-bit words.
     * @param encrypted0 {number} the first word to decrypt
     * @param encrypted1 {number} the second word to decrypt
     * @param encrypted2 {number} the third word to decrypt
     * @param encrypted3 {number} the fourth word to decrypt
     * @param out {Int32Array} the array to write the decrypted words
     * into
     * @param offset {number} the offset into the output array to start
     * writing results
     * @return {Array} The plaintext.
     */

  }, {
    key: 'decrypt',
    value: function decrypt(encrypted0, encrypted1, encrypted2, encrypted3, out, offset) {
      var key = this._key[1],

      // state variables a,b,c,d are loaded with pre-whitened data
      a = encrypted0 ^ key[0],
          b = encrypted3 ^ key[1],
          c = encrypted2 ^ key[2],
          d = encrypted1 ^ key[3],
          a2,
          b2,
          c2,
          nInnerRounds = key.length / 4 - 2,
          // key.length === 2 ?
      i,
          kIndex = 4,
          table = this._tables[1],


      // load up the tables
      table0 = table[0],
          table1 = table[1],
          table2 = table[2],
          table3 = table[3],
          sbox = table[4];

      // Inner rounds. Cribbed from OpenSSL.
      for (i = 0; i < nInnerRounds; i++) {
        a2 = table0[a >>> 24] ^ table1[b >> 16 & 255] ^ table2[c >> 8 & 255] ^ table3[d & 255] ^ key[kIndex];
        b2 = table0[b >>> 24] ^ table1[c >> 16 & 255] ^ table2[d >> 8 & 255] ^ table3[a & 255] ^ key[kIndex + 1];
        c2 = table0[c >>> 24] ^ table1[d >> 16 & 255] ^ table2[a >> 8 & 255] ^ table3[b & 255] ^ key[kIndex + 2];
        d = table0[d >>> 24] ^ table1[a >> 16 & 255] ^ table2[b >> 8 & 255] ^ table3[c & 255] ^ key[kIndex + 3];
        kIndex += 4;
        a = a2;b = b2;c = c2;
      }

      // Last round.
      for (i = 0; i < 4; i++) {
        out[(3 & -i) + offset] = sbox[a >>> 24] << 24 ^ sbox[b >> 16 & 255] << 16 ^ sbox[c >> 8 & 255] << 8 ^ sbox[d & 255] ^ key[kIndex++];
        a2 = a;a = b;b = c;c = d;d = a2;
      }
    }
  }]);

  return AES;
}();

exports.default = AES;

},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * This file contains an adaptation of the AES decryption algorithm
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * from the Standford Javascript Cryptography Library. That work is
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * covered by the following copyright and permissions notice:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * All rights reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Redistribution and use in source and binary forms, with or without
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * modification, are permitted provided that the following conditions are
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * met:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * 1. Redistributions of source code must retain the above copyright
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    notice, this list of conditions and the following disclaimer.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * 2. Redistributions in binary form must reproduce the above
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    copyright notice, this list of conditions and the following
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    disclaimer in the documentation and/or other materials provided
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    with the distribution.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR CONTRIBUTORS BE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * The views and conclusions contained in the software and documentation
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * are those of the authors and should not be interpreted as representing
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * official policies, either expressed or implied, of the authors.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _aes = require('./aes');

var _aes2 = _interopRequireDefault(_aes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AES128Decrypter = function () {
  function AES128Decrypter(key, initVector) {
    _classCallCheck(this, AES128Decrypter);

    this.key = key;
    this.iv = initVector;
  }

  /**
   * Convert network-order (big-endian) bytes into their little-endian
   * representation.
   */


  _createClass(AES128Decrypter, [{
    key: 'ntoh',
    value: function ntoh(word) {
      return word << 24 | (word & 0xff00) << 8 | (word & 0xff0000) >> 8 | word >>> 24;
    }

    /**
     * Decrypt bytes using AES-128 with CBC and PKCS#7 padding.
     * @param encrypted {Uint8Array} the encrypted bytes
     * @param key {Uint32Array} the bytes of the decryption key
     * @param initVector {Uint32Array} the initialization vector (IV) to
     * use for the first round of CBC.
     * @return {Uint8Array} the decrypted bytes
     *
     * @see http://en.wikipedia.org/wiki/Advanced_Encryption_Standard
     * @see http://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Cipher_Block_Chaining_.28CBC.29
     * @see https://tools.ietf.org/html/rfc2315
     */

  }, {
    key: 'doDecrypt',
    value: function doDecrypt(encrypted, key, initVector) {
      var
      // word-level access to the encrypted bytes
      encrypted32 = new Int32Array(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength >> 2),
          decipher = new _aes2.default(Array.prototype.slice.call(key)),


      // byte and word-level access for the decrypted output
      decrypted = new Uint8Array(encrypted.byteLength),
          decrypted32 = new Int32Array(decrypted.buffer),


      // temporary variables for working with the IV, encrypted, and
      // decrypted data
      init0,
          init1,
          init2,
          init3,
          encrypted0,
          encrypted1,
          encrypted2,
          encrypted3,


      // iteration variable
      wordIx;

      // pull out the words of the IV to ensure we don't modify the
      // passed-in reference and easier access
      init0 = ~ ~initVector[0];
      init1 = ~ ~initVector[1];
      init2 = ~ ~initVector[2];
      init3 = ~ ~initVector[3];

      // decrypt four word sequences, applying cipher-block chaining (CBC)
      // to each decrypted block
      for (wordIx = 0; wordIx < encrypted32.length; wordIx += 4) {
        // convert big-endian (network order) words into little-endian
        // (javascript order)
        encrypted0 = ~ ~this.ntoh(encrypted32[wordIx]);
        encrypted1 = ~ ~this.ntoh(encrypted32[wordIx + 1]);
        encrypted2 = ~ ~this.ntoh(encrypted32[wordIx + 2]);
        encrypted3 = ~ ~this.ntoh(encrypted32[wordIx + 3]);

        // decrypt the block
        decipher.decrypt(encrypted0, encrypted1, encrypted2, encrypted3, decrypted32, wordIx);

        // XOR with the IV, and restore network byte-order to obtain the
        // plaintext
        decrypted32[wordIx] = this.ntoh(decrypted32[wordIx] ^ init0);
        decrypted32[wordIx + 1] = this.ntoh(decrypted32[wordIx + 1] ^ init1);
        decrypted32[wordIx + 2] = this.ntoh(decrypted32[wordIx + 2] ^ init2);
        decrypted32[wordIx + 3] = this.ntoh(decrypted32[wordIx + 3] ^ init3);

        // setup the IV for the next round
        init0 = encrypted0;
        init1 = encrypted1;
        init2 = encrypted2;
        init3 = encrypted3;
      }

      return decrypted;
    }
  }, {
    key: 'localDecrypt',
    value: function localDecrypt(encrypted, key, initVector, decrypted) {
      var bytes = this.doDecrypt(encrypted, key, initVector);
      decrypted.set(bytes, encrypted.byteOffset);
    }
  }, {
    key: 'decrypt',
    value: function decrypt(encrypted) {
      var step = 4 * 8000,

      //encrypted32 = new Int32Array(encrypted.buffer),
      encrypted32 = new Int32Array(encrypted),
          decrypted = new Uint8Array(encrypted.byteLength),
          i = 0;

      // split up the encryption job and do the individual chunks asynchronously
      var key = this.key;
      var initVector = this.iv;
      this.localDecrypt(encrypted32.subarray(i, i + step), key, initVector, decrypted);

      for (i = step; i < encrypted32.length; i += step) {
        initVector = new Uint32Array([this.ntoh(encrypted32[i - 4]), this.ntoh(encrypted32[i - 3]), this.ntoh(encrypted32[i - 2]), this.ntoh(encrypted32[i - 1])]);
        this.localDecrypt(encrypted32.subarray(i, i + step), key, initVector, decrypted);
      }

      return decrypted;
    }
  }]);

  return AES128Decrypter;
}();

exports.default = AES128Decrypter;

},{"./aes":9}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * AES128 decryption.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _aes128Decrypter = require('./aes128-decrypter');

var _aes128Decrypter2 = _interopRequireDefault(_aes128Decrypter);

var _errors = require('../errors');

var _logger = require('../utils/logger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Decrypter = function () {
  function Decrypter(hls) {
    _classCallCheck(this, Decrypter);

    this.hls = hls;
    try {
      var browserCrypto = window ? window.crypto : crypto;
      this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
      this.disableWebCrypto = !this.subtle;
    } catch (e) {
      this.disableWebCrypto = true;
    }
  }

  _createClass(Decrypter, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'decrypt',
    value: function decrypt(data, key, iv, callback) {
      if (this.disableWebCrypto && this.hls.config.enableSoftwareAES) {
        this.decryptBySoftware(data, key, iv, callback);
      } else {
        this.decryptByWebCrypto(data, key, iv, callback);
      }
    }
  }, {
    key: 'decryptByWebCrypto',
    value: function decryptByWebCrypto(data, key, iv, callback) {
      var _this = this;

      _logger.logger.log('decrypting by WebCrypto API');

      this.subtle.importKey('raw', key, { name: 'AES-CBC', length: 128 }, false, ['decrypt']).then(function (importedKey) {
        _this.subtle.decrypt({ name: 'AES-CBC', iv: iv.buffer }, importedKey, data).then(callback).catch(function (err) {
          _this.onWebCryptoError(err, data, key, iv, callback);
        });
      }).catch(function (err) {
        _this.onWebCryptoError(err, data, key, iv, callback);
      });
    }
  }, {
    key: 'decryptBySoftware',
    value: function decryptBySoftware(data, key8, iv8, callback) {
      _logger.logger.log('decrypting by JavaScript Implementation');

      var view = new DataView(key8.buffer);
      var key = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      view = new DataView(iv8.buffer);
      var iv = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      var decrypter = new _aes128Decrypter2.default(key, iv);
      callback(decrypter.decrypt(data).buffer);
    }
  }, {
    key: 'onWebCryptoError',
    value: function onWebCryptoError(err, data, key, iv, callback) {
      if (this.hls.config.enableSoftwareAES) {
        _logger.logger.log('disabling to use WebCrypto API');
        this.disableWebCrypto = true;
        this.decryptBySoftware(data, key, iv, callback);
      } else {
        _logger.logger.error('decrypting error : ' + err.message);
        this.hls.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_DECRYPT_ERROR, fatal: true, reason: err.message });
      }
    }
  }]);

  return Decrypter;
}();

exports.default = Decrypter;

},{"../errors":20,"../utils/logger":36,"./aes128-decrypter":10}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * AAC demuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _logger = require('../utils/logger');

var _id = require('../demux/id3');

var _id2 = _interopRequireDefault(_id);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AACDemuxer = function () {
  function AACDemuxer(observer, remuxerClass) {
    _classCallCheck(this, AACDemuxer);

    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.remuxer = new this.remuxerClass(observer);
    this._aacTrack = { container: 'audio/adts', type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
  }

  _createClass(AACDemuxer, [{
    key: 'push',


    // feed incoming data to the front of the parsing pipeline
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var track = this._aacTrack,
          id3 = new _id2.default(data),
          pts = 90 * id3.timeStamp,
          config,
          frameLength,
          frameDuration,
          frameIndex,
          offset,
          headerLength,
          stamp,
          len,
          aacSample;
      // look for ADTS header (0xFFFx)
      for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
        if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }

      if (!track.audiosamplerate) {
        config = _adts2.default.getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.duration = duration;
        _logger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;
      while (offset + 5 < len) {
        // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
        headerLength = !!(data[offset + 1] & 0x01) ? 7 : 9;
        // retrieve frame size
        frameLength = (data[offset + 3] & 0x03) << 11 | data[offset + 4] << 3 | (data[offset + 5] & 0xE0) >>> 5;
        frameLength -= headerLength;
        //stamp = pes.pts;

        if (frameLength > 0 && offset + headerLength + frameLength <= len) {
          stamp = pts + frameIndex * frameDuration;
          //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
          aacSample = { unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp };
          track.samples.push(aacSample);
          track.len += frameLength;
          offset += frameLength + headerLength;
          frameIndex++;
          // look for ADTS header (0xFFFx)
          for (; offset < len - 1; offset++) {
            if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
              break;
            }
          }
        } else {
          break;
        }
      }
      this.remuxer.remux(this._aacTrack, { samples: [] }, { samples: [{ pts: pts, dts: pts, unit: id3.payload }] }, { samples: [] }, timeOffset);
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }], [{
    key: 'probe',
    value: function probe(data) {
      // check if data contains ID3 timestamp and ADTS sync worc
      var id3 = new _id2.default(data),
          offset,
          len;
      if (id3.hasTimeStamp) {
        // look for ADTS header (0xFFFx)
        for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
          if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
            //logger.log('ADTS sync word found !');
            return true;
          }
        }
      }
      return false;
    }
  }]);

  return AACDemuxer;
}();

exports.default = AACDemuxer;

},{"../demux/id3":18,"../utils/logger":36,"./adts":13}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *  ADTS parser helper
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = require('../utils/logger');

var _errors = require('../errors');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ADTS = function () {
  function ADTS() {
    _classCallCheck(this, ADTS);
  }

  _createClass(ADTS, null, [{
    key: 'getAudioConfig',
    value: function getAudioConfig(observer, data, offset, audioCodec) {
      var adtsObjectType,
          // :int
      adtsSampleingIndex,
          // :int
      adtsExtensionSampleingIndex,
          // :int
      adtsChanelConfig,
          // :int
      config,
          userAgent = navigator.userAgent.toLowerCase(),
          adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
      // byte 2
      adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
      adtsSampleingIndex = (data[offset + 2] & 0x3C) >>> 2;
      if (adtsSampleingIndex > adtsSampleingRates.length - 1) {
        observer.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'invalid ADTS sampling index:' + adtsSampleingIndex });
        return;
      }
      adtsChanelConfig = (data[offset + 2] & 0x01) << 2;
      // byte 3
      adtsChanelConfig |= (data[offset + 3] & 0xC0) >>> 6;
      _logger.logger.log('manifest codec:' + audioCodec + ',ADTS data:type:' + adtsObjectType + ',sampleingIndex:' + adtsSampleingIndex + '[' + adtsSampleingRates[adtsSampleingIndex] + 'Hz],channelConfig:' + adtsChanelConfig);
      // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
      if (userAgent.indexOf('firefox') !== -1) {
        if (adtsSampleingIndex >= 6) {
          adtsObjectType = 5;
          config = new Array(4);
          // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
          // there is a factor 2 between frame sample rate and output sample rate
          // multiply frequency by 2 (see table below, equivalent to substract 3)
          adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
        } else {
          adtsObjectType = 2;
          config = new Array(2);
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        }
        // Android : always use AAC
      } else if (userAgent.indexOf('android') !== -1) {
          adtsObjectType = 2;
          config = new Array(2);
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        } else {
          /*  for other browsers (chrome ...)
              always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
          */
          adtsObjectType = 5;
          config = new Array(4);
          // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
          if (audioCodec && (audioCodec.indexOf('mp4a.40.29') !== -1 || audioCodec.indexOf('mp4a.40.5') !== -1) || !audioCodec && adtsSampleingIndex >= 6) {
            // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
            // there is a factor 2 between frame sample rate and output sample rate
            // multiply frequency by 2 (see table below, equivalent to substract 3)
            adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
          } else {
            // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
            // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
            if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && adtsSampleingIndex >= 6 && adtsChanelConfig === 1 || !audioCodec && adtsChanelConfig === 1) {
              adtsObjectType = 2;
              config = new Array(2);
            }
            adtsExtensionSampleingIndex = adtsSampleingIndex;
          }
        }
      /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
          ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
        Audio Profile / Audio Object Type
        0: Null
        1: AAC Main
        2: AAC LC (Low Complexity)
        3: AAC SSR (Scalable Sample Rate)
        4: AAC LTP (Long Term Prediction)
        5: SBR (Spectral Band Replication)
        6: AAC Scalable
       sampling freq
        0: 96000 Hz
        1: 88200 Hz
        2: 64000 Hz
        3: 48000 Hz
        4: 44100 Hz
        5: 32000 Hz
        6: 24000 Hz
        7: 22050 Hz
        8: 16000 Hz
        9: 12000 Hz
        10: 11025 Hz
        11: 8000 Hz
        12: 7350 Hz
        13: Reserved
        14: Reserved
        15: frequency is written explictly
        Channel Configurations
        These are the channel configurations:
        0: Defined in AOT Specifc Config
        1: 1 channel: front-center
        2: 2 channels: front-left, front-right
      */
      // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
      config[0] = adtsObjectType << 3;
      // samplingFrequencyIndex
      config[0] |= (adtsSampleingIndex & 0x0E) >> 1;
      config[1] |= (adtsSampleingIndex & 0x01) << 7;
      // channelConfiguration
      config[1] |= adtsChanelConfig << 3;
      if (adtsObjectType === 5) {
        // adtsExtensionSampleingIndex
        config[1] |= (adtsExtensionSampleingIndex & 0x0E) >> 1;
        config[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
        // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
        //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
        config[2] |= 2 << 2;
        config[3] = 0;
      }
      return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: 'mp4a.40.' + adtsObjectType };
    }
  }]);

  return ADTS;
}();

exports.default = ADTS;

},{"../errors":20,"../utils/logger":36}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*  inline demuxer.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('../errors');

var _aacdemuxer = require('../demux/aacdemuxer');

var _aacdemuxer2 = _interopRequireDefault(_aacdemuxer);

var _tsdemuxer = require('../demux/tsdemuxer');

var _tsdemuxer2 = _interopRequireDefault(_tsdemuxer);

var _mp4Remuxer = require('../remux/mp4-remuxer');

var _mp4Remuxer2 = _interopRequireDefault(_mp4Remuxer);

var _passthroughRemuxer = require('../remux/passthrough-remuxer');

var _passthroughRemuxer2 = _interopRequireDefault(_passthroughRemuxer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DemuxerInline = function () {
  function DemuxerInline(hls, typeSupported) {
    _classCallCheck(this, DemuxerInline);

    this.hls = hls;
    this.typeSupported = typeSupported;
  }

  _createClass(DemuxerInline, [{
    key: 'destroy',
    value: function destroy() {
      var demuxer = this.demuxer;
      if (demuxer) {
        demuxer.destroy();
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0) {
      var demuxer = this.demuxer;
      if (!demuxer) {
        var hls = this.hls;
        // probe for content type
        if (_tsdemuxer2.default.probe(data)) {
          if (this.typeSupported.mp2t === true) {
            demuxer = new _tsdemuxer2.default(hls, _passthroughRemuxer2.default);
          } else {
            demuxer = new _tsdemuxer2.default(hls, _mp4Remuxer2.default);
          }
        } else if (_aacdemuxer2.default.probe(data)) {
          demuxer = new _aacdemuxer2.default(hls, _mp4Remuxer2.default);
        } else {
          hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
          return;
        }
        this.demuxer = demuxer;
      }
      demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
    }
  }]);

  return DemuxerInline;
}();

exports.default = DemuxerInline;

},{"../demux/aacdemuxer":12,"../demux/tsdemuxer":19,"../errors":20,"../events":22,"../remux/mp4-remuxer":31,"../remux/passthrough-remuxer":32}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _demuxerInline = require('../demux/demuxer-inline');

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DemuxerWorker = function DemuxerWorker(self) {
  // observer setup
  var observer = new _events4.default();
  observer.trigger = function trigger(event) {
    for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      data[_key - 1] = arguments[_key];
    }

    observer.emit.apply(observer, [event, event].concat(data));
  };

  observer.off = function off(event) {
    for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      data[_key2 - 1] = arguments[_key2];
    }

    observer.removeListener.apply(observer, [event].concat(data));
  };
  self.addEventListener('message', function (ev) {
    var data = ev.data;
    //console.log('demuxer cmd:' + data.cmd);
    switch (data.cmd) {
      case 'init':
        self.demuxer = new _demuxerInline2.default(observer, data.typeSupported);
        break;
      case 'demux':
        self.demuxer.push(new Uint8Array(data.data), data.audioCodec, data.videoCodec, data.timeOffset, data.cc, data.level, data.sn, data.duration);
        break;
      default:
        break;
    }
  });

  // listen to events triggered by Demuxer
  observer.on(_events2.default.FRAG_PARSING_INIT_SEGMENT, function (ev, data) {
    self.postMessage({ event: ev, tracks: data.tracks, unique: data.unique });
  });

  observer.on(_events2.default.FRAG_PARSING_DATA, function (ev, data) {
    var objData = { event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, data1: data.data1.buffer, data2: data.data2.buffer, nb: data.nb };
    // pass data1/data2 as transferable object (no copy)
    self.postMessage(objData, [objData.data1, objData.data2]);
  });

  observer.on(_events2.default.FRAG_PARSED, function (event) {
    self.postMessage({ event: event });
  });

  observer.on(_events2.default.ERROR, function (event, data) {
    self.postMessage({ event: event, data: data });
  });

  observer.on(_events2.default.FRAG_PARSING_METADATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });

  observer.on(_events2.default.FRAG_PARSING_USERDATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });
}; /* demuxer web worker.
    *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
    *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
    */

exports.default = DemuxerWorker;

},{"../demux/demuxer-inline":14,"../events":22,"events":1}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _demuxerInline = require('../demux/demuxer-inline');

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _demuxerWorker = require('../demux/demuxer-worker');

var _demuxerWorker2 = _interopRequireDefault(_demuxerWorker);

var _logger = require('../utils/logger');

var _decrypter = require('../crypt/decrypter');

var _decrypter2 = _interopRequireDefault(_decrypter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Demuxer = function () {
  function Demuxer(hls) {
    _classCallCheck(this, Demuxer);

    this.hls = hls;
    var typeSupported = {
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mp2t: hls.config.enableMP2TPassThrough && MediaSource.isTypeSupported('video/mp2t')
    };
    if (hls.config.enableWorker && typeof Worker !== 'undefined') {
      _logger.logger.log('demuxing in webworker');
      try {
        var work = require('webworkify');
        this.w = work(_demuxerWorker2.default);
        this.onwmsg = this.onWorkerMessage.bind(this);
        this.w.addEventListener('message', this.onwmsg);
        this.w.postMessage({ cmd: 'init', typeSupported: typeSupported });
      } catch (err) {
        _logger.logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
        this.demuxer = new _demuxerInline2.default(hls, typeSupported);
      }
    } else {
      this.demuxer = new _demuxerInline2.default(hls, typeSupported);
    }
    this.demuxInitialized = true;
  }

  _createClass(Demuxer, [{
    key: 'destroy',
    value: function destroy() {
      if (this.w) {
        this.w.removeEventListener('message', this.onwmsg);
        this.w.terminate();
        this.w = null;
      } else {
        this.demuxer.destroy();
        this.demuxer = null;
      }
      if (this.decrypter) {
        this.decrypter.destroy();
        this.decrypter = null;
      }
    }
  }, {
    key: 'pushDecrypted',
    value: function pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0) {
      console.log('pushDecrypted t0: ' + t0);
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn: sn, duration: duration }, [data]);
      } else {
        this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata, t0) {
      if (data.byteLength > 0 && decryptdata != null && decryptdata.key != null && decryptdata.method === 'AES-128') {
        if (this.decrypter == null) {
          this.decrypter = new _decrypter2.default(this.hls);
        }

        var localthis = this;
        this.decrypter.decrypt(data, decryptdata.key, decryptdata.iv, function (decryptedData) {
          localthis.pushDecrypted(decryptedData, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
        });
      } else {
        this.pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
      }
    }
  }, {
    key: 'onWorkerMessage',
    value: function onWorkerMessage(ev) {
      var data = ev.data;
      //console.log('onWorkerMessage:' + data.event);
      switch (data.event) {
        case _events2.default.FRAG_PARSING_INIT_SEGMENT:
          var obj = {};
          obj.tracks = data.tracks;
          obj.unique = data.unique;
          this.hls.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, obj);
          break;
        case _events2.default.FRAG_PARSING_DATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_DATA, {
            data1: new Uint8Array(data.data1),
            data2: new Uint8Array(data.data2),
            startPTS: data.startPTS,
            endPTS: data.endPTS,
            startDTS: data.startDTS,
            endDTS: data.endDTS,
            type: data.type,
            nb: data.nb
          });
          break;
        case _events2.default.FRAG_PARSING_METADATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_METADATA, {
            samples: data.samples
          });
          break;
        case _events2.default.FRAG_PARSING_USERDATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_USERDATA, {
            samples: data.samples
          });
          break;
        default:
          this.hls.trigger(data.event, data.data);
          break;
      }
    }
  }]);

  return Demuxer;
}();

exports.default = Demuxer;

},{"../crypt/decrypter":11,"../demux/demuxer-inline":14,"../demux/demuxer-worker":15,"../events":22,"../utils/logger":36,"webworkify":2}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ExpGolomb = function () {
  function ExpGolomb(data) {
    _classCallCheck(this, ExpGolomb);

    this.data = data;
    // the number of bytes left to examine in this.data
    this.bytesAvailable = this.data.byteLength;
    // the current word being examined
    this.word = 0; // :uint
    // the number of bits left to examine in the current word
    this.bitsAvailable = 0; // :uint
  }

  // ():void


  _createClass(ExpGolomb, [{
    key: 'loadWord',
    value: function loadWord() {
      var position = this.data.byteLength - this.bytesAvailable,
          workingBytes = new Uint8Array(4),
          availableBytes = Math.min(4, this.bytesAvailable);
      if (availableBytes === 0) {
        throw new Error('no bytes available');
      }
      workingBytes.set(this.data.subarray(position, position + availableBytes));
      this.word = new DataView(workingBytes.buffer).getUint32(0);
      // track the amount of this.data that has been processed
      this.bitsAvailable = availableBytes * 8;
      this.bytesAvailable -= availableBytes;
    }

    // (count:int):void

  }, {
    key: 'skipBits',
    value: function skipBits(count) {
      var skipBytes; // :int
      if (this.bitsAvailable > count) {
        this.word <<= count;
        this.bitsAvailable -= count;
      } else {
        count -= this.bitsAvailable;
        skipBytes = count >> 3;
        count -= skipBytes >> 3;
        this.bytesAvailable -= skipBytes;
        this.loadWord();
        this.word <<= count;
        this.bitsAvailable -= count;
      }
    }

    // (size:int):uint

  }, {
    key: 'readBits',
    value: function readBits(size) {
      var bits = Math.min(this.bitsAvailable, size),
          // :uint
      valu = this.word >>> 32 - bits; // :uint
      if (size > 32) {
        _logger.logger.error('Cannot read more than 32 bits at a time');
      }
      this.bitsAvailable -= bits;
      if (this.bitsAvailable > 0) {
        this.word <<= bits;
      } else if (this.bytesAvailable > 0) {
        this.loadWord();
      }
      bits = size - bits;
      if (bits > 0) {
        return valu << bits | this.readBits(bits);
      } else {
        return valu;
      }
    }

    // ():uint

  }, {
    key: 'skipLZ',
    value: function skipLZ() {
      var leadingZeroCount; // :uint
      for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
        if (0 !== (this.word & 0x80000000 >>> leadingZeroCount)) {
          // the first bit of working word is 1
          this.word <<= leadingZeroCount;
          this.bitsAvailable -= leadingZeroCount;
          return leadingZeroCount;
        }
      }
      // we exhausted word and still have not found a 1
      this.loadWord();
      return leadingZeroCount + this.skipLZ();
    }

    // ():void

  }, {
    key: 'skipUEG',
    value: function skipUEG() {
      this.skipBits(1 + this.skipLZ());
    }

    // ():void

  }, {
    key: 'skipEG',
    value: function skipEG() {
      this.skipBits(1 + this.skipLZ());
    }

    // ():uint

  }, {
    key: 'readUEG',
    value: function readUEG() {
      var clz = this.skipLZ(); // :uint
      return this.readBits(clz + 1) - 1;
    }

    // ():int

  }, {
    key: 'readEG',
    value: function readEG() {
      var valu = this.readUEG(); // :int
      if (0x01 & valu) {
        // the number is odd if the low order bit is set
        return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
      } else {
          return -1 * (valu >>> 1); // divide by two then make it negative
        }
    }

    // Some convenience functions
    // :Boolean

  }, {
    key: 'readBoolean',
    value: function readBoolean() {
      return 1 === this.readBits(1);
    }

    // ():int

  }, {
    key: 'readUByte',
    value: function readUByte() {
      return this.readBits(8);
    }

    // ():int

  }, {
    key: 'readUShort',
    value: function readUShort() {
      return this.readBits(16);
    }
    // ():int

  }, {
    key: 'readUInt',
    value: function readUInt() {
      return this.readBits(32);
    }

    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */

  }, {
    key: 'skipScalingList',
    value: function skipScalingList(count) {
      var lastScale = 8,
          nextScale = 8,
          j,
          deltaScale;
      for (j = 0; j < count; j++) {
        if (nextScale !== 0) {
          deltaScale = this.readEG();
          nextScale = (lastScale + deltaScale + 256) % 256;
        }
        lastScale = nextScale === 0 ? lastScale : nextScale;
      }
    }

    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */

  }, {
    key: 'readSPS',
    value: function readSPS() {
      var frameCropLeftOffset = 0,
          frameCropRightOffset = 0,
          frameCropTopOffset = 0,
          frameCropBottomOffset = 0,
          sarScale = 1,
          profileIdc,
          profileCompat,
          levelIdc,
          numRefFramesInPicOrderCntCycle,
          picWidthInMbsMinus1,
          picHeightInMapUnitsMinus1,
          frameMbsOnlyFlag,
          scalingListCount,
          i;
      this.readUByte();
      profileIdc = this.readUByte(); // profile_idc
      profileCompat = this.readBits(5); // constraint_set[0-4]_flag, u(5)
      this.skipBits(3); // reserved_zero_3bits u(3),
      levelIdc = this.readUByte(); //level_idc u(8)
      this.skipUEG(); // seq_parameter_set_id
      // some profiles have more optional data we don't need
      if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
        var chromaFormatIdc = this.readUEG();
        if (chromaFormatIdc === 3) {
          this.skipBits(1); // separate_colour_plane_flag
        }
        this.skipUEG(); // bit_depth_luma_minus8
        this.skipUEG(); // bit_depth_chroma_minus8
        this.skipBits(1); // qpprime_y_zero_transform_bypass_flag
        if (this.readBoolean()) {
          // seq_scaling_matrix_present_flag
          scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
          for (i = 0; i < scalingListCount; i++) {
            if (this.readBoolean()) {
              // seq_scaling_list_present_flag[ i ]
              if (i < 6) {
                this.skipScalingList(16);
              } else {
                this.skipScalingList(64);
              }
            }
          }
        }
      }
      this.skipUEG(); // log2_max_frame_num_minus4
      var picOrderCntType = this.readUEG();
      if (picOrderCntType === 0) {
        this.readUEG(); //log2_max_pic_order_cnt_lsb_minus4
      } else if (picOrderCntType === 1) {
          this.skipBits(1); // delta_pic_order_always_zero_flag
          this.skipEG(); // offset_for_non_ref_pic
          this.skipEG(); // offset_for_top_to_bottom_field
          numRefFramesInPicOrderCntCycle = this.readUEG();
          for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
            this.skipEG(); // offset_for_ref_frame[ i ]
          }
        }
      this.skipUEG(); // max_num_ref_frames
      this.skipBits(1); // gaps_in_frame_num_value_allowed_flag
      picWidthInMbsMinus1 = this.readUEG();
      picHeightInMapUnitsMinus1 = this.readUEG();
      frameMbsOnlyFlag = this.readBits(1);
      if (frameMbsOnlyFlag === 0) {
        this.skipBits(1); // mb_adaptive_frame_field_flag
      }
      this.skipBits(1); // direct_8x8_inference_flag
      if (this.readBoolean()) {
        // frame_cropping_flag
        frameCropLeftOffset = this.readUEG();
        frameCropRightOffset = this.readUEG();
        frameCropTopOffset = this.readUEG();
        frameCropBottomOffset = this.readUEG();
      }
      if (this.readBoolean()) {
        // vui_parameters_present_flag
        if (this.readBoolean()) {
          // aspect_ratio_info_present_flag
          var sarRatio = void 0;
          var aspectRatioIdc = this.readUByte();
          switch (aspectRatioIdc) {
            case 1:
              sarRatio = [1, 1];break;
            case 2:
              sarRatio = [12, 11];break;
            case 3:
              sarRatio = [10, 11];break;
            case 4:
              sarRatio = [16, 11];break;
            case 5:
              sarRatio = [40, 33];break;
            case 6:
              sarRatio = [24, 11];break;
            case 7:
              sarRatio = [20, 11];break;
            case 8:
              sarRatio = [32, 11];break;
            case 9:
              sarRatio = [80, 33];break;
            case 10:
              sarRatio = [18, 11];break;
            case 11:
              sarRatio = [15, 11];break;
            case 12:
              sarRatio = [64, 33];break;
            case 13:
              sarRatio = [160, 99];break;
            case 14:
              sarRatio = [4, 3];break;
            case 15:
              sarRatio = [3, 2];break;
            case 16:
              sarRatio = [2, 1];break;
            case 255:
              {
                sarRatio = [this.readUByte() << 8 | this.readUByte(), this.readUByte() << 8 | this.readUByte()];
                break;
              }
          }
          if (sarRatio) {
            sarScale = sarRatio[0] / sarRatio[1];
          }
        }
      }
      return {
        width: Math.ceil(((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2) * sarScale),
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset)
      };
    }
  }, {
    key: 'readSliceType',
    value: function readSliceType() {
      // skip NALu type
      this.readUByte();
      // discard first_mb_in_slice
      this.readUEG();
      // return slice_type
      return this.readUEG();
    }
  }]);

  return ExpGolomb;
}();

exports.default = ExpGolomb;

},{"../utils/logger":36}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * ID3 parser
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

//import Hex from '../utils/hex';

var ID3 = function () {
  function ID3(data) {
    _classCallCheck(this, ID3);

    this._hasTimeStamp = false;
    var offset = 0,
        byte1,
        byte2,
        byte3,
        byte4,
        tagSize,
        endPos,
        header,
        len;
    do {
      header = this.readUTF(data, offset, 3);
      offset += 3;
      // first check for ID3 header
      if (header === 'ID3') {
        // skip 24 bits
        offset += 3;
        // retrieve tag(s) length
        byte1 = data[offset++] & 0x7f;
        byte2 = data[offset++] & 0x7f;
        byte3 = data[offset++] & 0x7f;
        byte4 = data[offset++] & 0x7f;
        tagSize = (byte1 << 21) + (byte2 << 14) + (byte3 << 7) + byte4;
        endPos = offset + tagSize;
        //logger.log(`ID3 tag found, size/end: ${tagSize}/${endPos}`);

        // read ID3 tags
        this._parseID3Frames(data, offset, endPos);
        offset = endPos;
      } else if (header === '3DI') {
        // http://id3.org/id3v2.4.0-structure chapter 3.4.   ID3v2 footer
        offset += 7;
        _logger.logger.log('3DI footer found, end: ' + offset);
      } else {
        offset -= 3;
        len = offset;
        if (len) {
          //logger.log(`ID3 len: ${len}`);
          if (!this.hasTimeStamp) {
            _logger.logger.warn('ID3 tag found, but no timestamp');
          }
          this._length = len;
          this._payload = data.subarray(0, len);
        }
        return;
      }
    } while (true);
  }

  _createClass(ID3, [{
    key: 'readUTF',
    value: function readUTF(data, start, len) {

      var result = '',
          offset = start,
          end = start + len;
      do {
        result += String.fromCharCode(data[offset++]);
      } while (offset < end);
      return result;
    }
  }, {
    key: '_parseID3Frames',
    value: function _parseID3Frames(data, offset, endPos) {
      var tagId, tagLen, tagStart, tagFlags, timestamp;
      while (offset + 8 <= endPos) {
        tagId = this.readUTF(data, offset, 4);
        offset += 4;

        tagLen = data[offset++] << 24 + data[offset++] << 16 + data[offset++] << 8 + data[offset++];

        tagFlags = data[offset++] << 8 + data[offset++];

        tagStart = offset;
        //logger.log("ID3 tag id:" + tagId);
        switch (tagId) {
          case 'PRIV':
            //logger.log('parse frame:' + Hex.hexDump(data.subarray(offset,endPos)));
            // owner should be "com.apple.streaming.transportStreamTimestamp"
            if (this.readUTF(data, offset, 44) === 'com.apple.streaming.transportStreamTimestamp') {
              offset += 44;
              // smelling even better ! we found the right descriptor
              // skip null character (string end) + 3 first bytes
              offset += 4;

              // timestamp is 33 bit expressed as a big-endian eight-octet number, with the upper 31 bits set to zero.
              var pts33Bit = data[offset++] & 0x1;
              this._hasTimeStamp = true;

              timestamp = ((data[offset++] << 23) + (data[offset++] << 15) + (data[offset++] << 7) + data[offset++]) / 45;

              if (pts33Bit) {
                timestamp += 47721858.84; // 2^32 / 90
              }
              timestamp = Math.round(timestamp);
              _logger.logger.trace('ID3 timestamp found: ' + timestamp);
              this._timeStamp = timestamp;
            }
            break;
          default:
            break;
        }
      }
    }
  }, {
    key: 'hasTimeStamp',
    get: function get() {
      return this._hasTimeStamp;
    }
  }, {
    key: 'timeStamp',
    get: function get() {
      return this._timeStamp;
    }
  }, {
    key: 'length',
    get: function get() {
      return this._length;
    }
  }, {
    key: 'payload',
    get: function get() {
      return this._payload;
    }
  }]);

  return ID3;
}();

exports.default = ID3;

},{"../utils/logger":36}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * highly optimized TS demuxer:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * parse PAT, PMT
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * extract PES packet from audio and video PIDs
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * trigger the remuxer upon parsing completion
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * it also controls the remuxing process :
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

// import Hex from '../utils/hex';


var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _expGolomb = require('./exp-golomb');

var _expGolomb2 = _interopRequireDefault(_expGolomb);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TSDemuxer = function () {
  function TSDemuxer(observer, remuxerClass) {
    _classCallCheck(this, TSDemuxer);

    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.lastCC = 0;
    this.remuxer = new this.remuxerClass(observer);
  }

  _createClass(TSDemuxer, [{
    key: 'switchLevel',
    value: function switchLevel() {
      this.pmtParsed = false;
      this._pmtId = -1;
      this.lastAacPTS = null;
      this.aacOverFlow = null;
      this._avcTrack = { container: 'video/mp2t', type: 'video', id: -1, sequenceNumber: 0, samples: [], len: 0, nbNalu: 0 };
      this._aacTrack = { container: 'video/mp2t', type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._id3Track = { type: 'id3', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._txtTrack = { type: 'text', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this.remuxer.switchLevel();
    }
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this.switchLevel();
      this.remuxer.insertDiscontinuity();
    }

    // feed incoming data to the front of the parsing pipeline

  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0) {
      console.log('tsdemuxer t0: ' + t0);
      var avcData,
          aacData,
          id3Data,
          start,
          len = data.length,
          stt,
          pid,
          atf,
          offset,
          codecsOnly = this.remuxer.passthrough;

      this.audioCodec = audioCodec;
      this.videoCodec = videoCodec;
      this.timeOffset = timeOffset;
      this._duration = duration;
      this.contiguous = false;
      if (cc !== this.lastCC) {
        _logger.logger.log('discontinuity detected');
        this.insertDiscontinuity();
        this.lastCC = cc;
      } else if (level !== this.lastLevel) {
        _logger.logger.log('level switch detected');
        this.switchLevel();
        this.lastLevel = level;
      } else if (sn === this.lastSN + 1) {
        this.contiguous = true;
      }
      this.lastSN = sn;

      if (!this.contiguous) {
        // flush any partial content
        this.aacOverFlow = null;
      }

      var pmtParsed = this.pmtParsed,
          avcId = this._avcTrack.id,
          aacId = this._aacTrack.id,
          id3Id = this._id3Track.id;

      // don't parse last TS packet if incomplete
      len -= len % 188;
      // loop through TS packets
      for (start = 0; start < len; start += 188) {
        if (data[start] === 0x47) {
          stt = !!(data[start + 1] & 0x40);
          // pid is a 13-bit field starting at the last bit of TS[1]
          pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
          atf = (data[start + 3] & 0x30) >> 4;
          // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
          if (atf > 1) {
            offset = start + 5 + data[start + 4];
            // continue if there is only adaptation field
            if (offset === start + 188) {
              continue;
            }
          } else {
            offset = start + 4;
          }
          if (pmtParsed) {
            if (pid === avcId) {
              if (stt) {
                if (avcData) {
                  this._parseAVCPES(this._parsePES(avcData));
                  if (codecsOnly) {
                    // if we have video codec info AND
                    // if audio PID is undefined OR if we have audio codec info,
                    // we have all codec info !
                    if (this._avcTrack.codec && (aacId === -1 || this._aacTrack.codec)) {
                      this.remux(data, t0);
                      return;
                    }
                  }
                }
                avcData = { data: [], size: 0 };
              }
              if (avcData) {
                avcData.data.push(data.subarray(offset, start + 188));
                avcData.size += start + 188 - offset;
              }
            } else if (pid === aacId) {
              if (stt) {
                if (aacData) {
                  this._parseAACPES(this._parsePES(aacData));
                  if (codecsOnly) {
                    // here we now that we have audio codec info
                    // if video PID is undefined OR if we have video codec info,
                    // we have all codec infos !
                    if (this._aacTrack.codec && (avcId === -1 || this._avcTrack.codec)) {
                      this.remux(data, t0);
                      return;
                    }
                  }
                }
                aacData = { data: [], size: 0 };
              }
              if (aacData) {
                aacData.data.push(data.subarray(offset, start + 188));
                aacData.size += start + 188 - offset;
              }
            } else if (pid === id3Id) {
              if (stt) {
                if (id3Data) {
                  this._parseID3PES(this._parsePES(id3Data));
                }
                id3Data = { data: [], size: 0 };
              }
              if (id3Data) {
                id3Data.data.push(data.subarray(offset, start + 188));
                id3Data.size += start + 188 - offset;
              }
            }
          } else {
            if (stt) {
              offset += data[offset] + 1;
            }
            if (pid === 0) {
              this._parsePAT(data, offset);
            } else if (pid === this._pmtId) {
              this._parsePMT(data, offset);
              pmtParsed = this.pmtParsed = true;
              avcId = this._avcTrack.id;
              aacId = this._aacTrack.id;
              id3Id = this._id3Track.id;
            }
          }
        } else {
          this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47' });
        }
      }
      // parse last PES packet
      if (avcData) {
        this._parseAVCPES(this._parsePES(avcData));
      }
      if (aacData) {
        this._parseAACPES(this._parsePES(aacData));
      }
      if (id3Data) {
        this._parseID3PES(this._parsePES(id3Data));
      }
      this.remux(null, t0);
    }
  }, {
    key: 'remux',
    value: function remux(data, t0) {
      console.log('tsdemuxer passing t0 to remux: ' + t0);
      this.remuxer.remux(this._aacTrack, this._avcTrack, this._id3Track, this._txtTrack, this.timeOffset, this.contiguous, data, t0);
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.switchLevel();
      this._initPTS = this._initDTS = undefined;
      this._duration = 0;
    }
  }, {
    key: '_parsePAT',
    value: function _parsePAT(data, offset) {
      // skip the PSI header and parse the first PMT entry
      this._pmtId = (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
      //logger.log('PMT PID:'  + this._pmtId);
    }
  }, {
    key: '_parsePMT',
    value: function _parsePMT(data, offset) {
      var sectionLength, tableEnd, programInfoLength, pid;
      sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
      tableEnd = offset + 3 + sectionLength - 4;
      // to determine where the table is, we have to figure out how
      // long the program info descriptors are
      programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
      // advance the offset to the first entry in the mapping table
      offset += 12 + programInfoLength;
      while (offset < tableEnd) {
        pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
        switch (data[offset]) {
          // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
          case 0x0f:
            //logger.log('AAC PID:'  + pid);
            this._aacTrack.id = pid;
            break;
          // Packetized metadata (ID3)
          case 0x15:
            //logger.log('ID3 PID:'  + pid);
            this._id3Track.id = pid;
            break;
          // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
          case 0x1b:
            //logger.log('AVC PID:'  + pid);
            this._avcTrack.id = pid;
            break;
          default:
            _logger.logger.log('unkown stream type:' + data[offset]);
            break;
        }
        // move to the next table entry
        // skip past the elementary stream descriptors, if present
        offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
      }
    }
  }, {
    key: '_parsePES',
    value: function _parsePES(stream) {
      var i = 0,
          frag,
          pesFlags,
          pesPrefix,
          pesLen,
          pesHdrLen,
          pesData,
          pesPts,
          pesDts,
          payloadStartOffset,
          data = stream.data;
      //retrieve PTS/DTS from first fragment
      frag = data[0];
      pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
      if (pesPrefix === 1) {
        pesLen = (frag[4] << 8) + frag[5];
        pesFlags = frag[7];
        if (pesFlags & 0xC0) {
          /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
              as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
              as Bitwise operators treat their operands as a sequence of 32 bits */
          pesPts = (frag[9] & 0x0E) * 536870912 + // 1 << 29
          (frag[10] & 0xFF) * 4194304 + // 1 << 22
          (frag[11] & 0xFE) * 16384 + // 1 << 14
          (frag[12] & 0xFF) * 128 + // 1 << 7
          (frag[13] & 0xFE) / 2;
          // check if greater than 2^32 -1
          if (pesPts > 4294967295) {
            // decrement 2^33
            pesPts -= 8589934592;
          }
          if (pesFlags & 0x40) {
            pesDts = (frag[14] & 0x0E) * 536870912 + // 1 << 29
            (frag[15] & 0xFF) * 4194304 + // 1 << 22
            (frag[16] & 0xFE) * 16384 + // 1 << 14
            (frag[17] & 0xFF) * 128 + // 1 << 7
            (frag[18] & 0xFE) / 2;
            // check if greater than 2^32 -1
            if (pesDts > 4294967295) {
              // decrement 2^33
              pesDts -= 8589934592;
            }
          } else {
            pesDts = pesPts;
          }
        }
        pesHdrLen = frag[8];
        payloadStartOffset = pesHdrLen + 9;

        stream.size -= payloadStartOffset;
        //reassemble PES packet
        pesData = new Uint8Array(stream.size);
        while (data.length) {
          frag = data.shift();
          var len = frag.byteLength;
          if (payloadStartOffset) {
            if (payloadStartOffset > len) {
              // trim full frag if PES header bigger than frag
              payloadStartOffset -= len;
              continue;
            } else {
              // trim partial frag if PES header smaller than frag
              frag = frag.subarray(payloadStartOffset);
              len -= payloadStartOffset;
              payloadStartOffset = 0;
            }
          }
          pesData.set(frag, i);
          i += len;
        }
        return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
      } else {
        return null;
      }
    }
  }, {
    key: '_parseAVCPES',
    value: function _parseAVCPES(pes) {
      var _this = this;

      var track = this._avcTrack,
          samples = track.samples,
          units = this._parseAVCNALu(pes.data),
          units2 = [],
          debug = false,
          key = false,
          length = 0,
          expGolombDecoder,
          avcSample,
          push,
          i;
      // no NALu found
      if (units.length === 0 && samples.length > 0) {
        // append pes.data to previous NAL unit
        var lastavcSample = samples[samples.length - 1];
        var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
        var tmp = new Uint8Array(lastUnit.data.byteLength + pes.data.byteLength);
        tmp.set(lastUnit.data, 0);
        tmp.set(pes.data, lastUnit.data.byteLength);
        lastUnit.data = tmp;
        lastavcSample.units.length += pes.data.byteLength;
        track.len += pes.data.byteLength;
      }
      //free pes.data to save up some memory
      pes.data = null;
      var debugString = '';

      units.forEach(function (unit) {
        switch (unit.type) {
          //NDR
          case 1:
            push = true;
            if (debug) {
              debugString += 'NDR ';
            }
            break;
          //IDR
          case 5:
            push = true;
            if (debug) {
              debugString += 'IDR ';
            }
            key = true;
            break;
          //SEI
          case 6:
            push = true;
            if (debug) {
              debugString += 'SEI ';
            }
            expGolombDecoder = new _expGolomb2.default(unit.data);

            // skip frameType
            expGolombDecoder.readUByte();

            var payloadType = expGolombDecoder.readUByte();

            // TODO: there can be more than one payload in an SEI packet...
            // TODO: need to read type and size in a while loop to get them all
            if (payloadType === 4) {
              var payloadSize = 0;

              do {
                payloadSize = expGolombDecoder.readUByte();
              } while (payloadSize === 255);

              var countryCode = expGolombDecoder.readUByte();

              if (countryCode === 181) {
                var providerCode = expGolombDecoder.readUShort();

                if (providerCode === 49) {
                  var userStructure = expGolombDecoder.readUInt();

                  if (userStructure === 0x47413934) {
                    var userDataType = expGolombDecoder.readUByte();

                    // Raw CEA-608 bytes wrapped in CEA-708 packet
                    if (userDataType === 3) {
                      var firstByte = expGolombDecoder.readUByte();
                      var secondByte = expGolombDecoder.readUByte();

                      var totalCCs = 31 & firstByte;
                      var byteArray = [firstByte, secondByte];

                      for (i = 0; i < totalCCs; i++) {
                        // 3 bytes per CC
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                      }

                      _this._txtTrack.samples.push({ type: 3, pts: pes.pts, bytes: byteArray });
                    }
                  }
                }
              }
            }
            break;
          //SPS
          case 7:
            push = true;
            if (debug) {
              debugString += 'SPS ';
            }
            if (!track.sps) {
              expGolombDecoder = new _expGolomb2.default(unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.sps = [unit.data];
              track.duration = _this._duration;
              var codecarray = unit.data.subarray(1, 4);
              var codecstring = 'avc1.';
              for (i = 0; i < 3; i++) {
                var h = codecarray[i].toString(16);
                if (h.length < 2) {
                  h = '0' + h;
                }
                codecstring += h;
              }
              track.codec = codecstring;
            }
            break;
          //PPS
          case 8:
            push = true;
            if (debug) {
              debugString += 'PPS ';
            }
            if (!track.pps) {
              track.pps = [unit.data];
            }
            break;
          case 9:
            push = false;
            if (debug) {
              debugString += 'AUD ';
            }
            break;
          default:
            push = false;
            debugString += 'unknown NAL ' + unit.type + ' ';
            break;
        }
        if (push) {
          units2.push(unit);
          length += unit.data.byteLength;
        }
      });
      if (debug || debugString.length) {
        _logger.logger.log(debugString);
      }
      //build sample from PES
      // Annex B to MP4 conversion to be done
      if (units2.length) {
        // only push AVC sample if keyframe already found. browsers expect a keyframe at first to start decoding
        if (key === true || track.sps) {
          avcSample = { units: { units: units2, length: length }, pts: pes.pts, dts: pes.dts, key: key };
          samples.push(avcSample);
          track.len += length;
          track.nbNalu += units2.length;
        }
      }
    }
  }, {
    key: '_parseAVCNALu',
    value: function _parseAVCNALu(array) {
      var i = 0,
          len = array.byteLength,
          value,
          overflow,
          state = 0;
      var units = [],
          unit,
          unitType,
          lastUnitStart,
          lastUnitType;
      //logger.log('PES:' + Hex.hexDump(array));
      while (i < len) {
        value = array[i++];
        // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
        switch (state) {
          case 0:
            if (value === 0) {
              state = 1;
            }
            break;
          case 1:
            if (value === 0) {
              state = 2;
            } else {
              state = 0;
            }
            break;
          case 2:
          case 3:
            if (value === 0) {
              state = 3;
            } else if (value === 1 && i < len) {
              unitType = array[i] & 0x1f;
              //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
              if (lastUnitStart) {
                unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
                //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                units.push(unit);
              } else {
                // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                overflow = i - state - 1;
                if (overflow) {
                  var track = this._avcTrack,
                      samples = track.samples;
                  //logger.log('first NALU found with overflow:' + overflow);
                  if (samples.length) {
                    var lastavcSample = samples[samples.length - 1],
                        lastUnits = lastavcSample.units.units,
                        lastUnit = lastUnits[lastUnits.length - 1],
                        tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                    tmp.set(lastUnit.data, 0);
                    tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                    lastUnit.data = tmp;
                    lastavcSample.units.length += overflow;
                    track.len += overflow;
                  }
                }
              }
              lastUnitStart = i;
              lastUnitType = unitType;
              state = 0;
            } else {
              state = 0;
            }
            break;
          default:
            break;
        }
      }
      if (lastUnitStart) {
        unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType };
        units.push(unit);
        //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
      }
      return units;
    }
  }, {
    key: '_parseAACPES',
    value: function _parseAACPES(pes) {
      var track = this._aacTrack,
          data = pes.data,
          pts = pes.pts,
          startOffset = 0,
          duration = this._duration,
          audioCodec = this.audioCodec,
          aacOverFlow = this.aacOverFlow,
          lastAacPTS = this.lastAacPTS,
          config,
          frameLength,
          frameDuration,
          frameIndex,
          offset,
          headerLength,
          stamp,
          len,
          aacSample;
      if (aacOverFlow) {
        var tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
        tmp.set(aacOverFlow, 0);
        tmp.set(data, aacOverFlow.byteLength);
        //logger.log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
        data = tmp;
      }
      // look for ADTS header (0xFFFx)
      for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
        if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }
      // if ADTS header does not start straight from the beginning of the PES payload, raise an error
      if (offset) {
        var reason, fatal;
        if (offset < len - 1) {
          reason = 'AAC PES did not start with ADTS header,offset:' + offset;
          fatal = false;
        } else {
          reason = 'no ADTS header found in AAC PES';
          fatal = true;
        }
        this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason });
        if (fatal) {
          return;
        }
      }
      if (!track.audiosamplerate) {
        config = _adts2.default.getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.duration = duration;
        _logger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;

      // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
      // first sample PTS should be equal to last sample PTS + frameDuration
      if (aacOverFlow && lastAacPTS) {
        var newPTS = lastAacPTS + frameDuration;
        if (Math.abs(newPTS - pts) > 1) {
          _logger.logger.log('AAC: align PTS for overlapping frames by ' + Math.round((newPTS - pts) / 90));
          pts = newPTS;
        }
      }

      while (offset + 5 < len) {
        // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
        headerLength = !!(data[offset + 1] & 0x01) ? 7 : 9;
        // retrieve frame size
        frameLength = (data[offset + 3] & 0x03) << 11 | data[offset + 4] << 3 | (data[offset + 5] & 0xE0) >>> 5;
        frameLength -= headerLength;
        //stamp = pes.pts;

        if (frameLength > 0 && offset + headerLength + frameLength <= len) {
          stamp = pts + frameIndex * frameDuration;
          //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
          aacSample = { unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp };
          track.samples.push(aacSample);
          track.len += frameLength;
          offset += frameLength + headerLength;
          frameIndex++;
          // look for ADTS header (0xFFFx)
          for (; offset < len - 1; offset++) {
            if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
              break;
            }
          }
        } else {
          break;
        }
      }
      if (offset < len) {
        aacOverFlow = data.subarray(offset, len);
        //logger.log(`AAC: overflow detected:${len-offset}`);
      } else {
          aacOverFlow = null;
        }
      this.aacOverFlow = aacOverFlow;
      this.lastAacPTS = stamp;
    }
  }, {
    key: '_parseID3PES',
    value: function _parseID3PES(pes) {
      this._id3Track.samples.push(pes);
    }
  }], [{
    key: 'probe',
    value: function probe(data) {
      // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
      if (data.length >= 3 * 188 && data[0] === 0x47 && data[188] === 0x47 && data[2 * 188] === 0x47) {
        return true;
      } else {
        return false;
      }
    }
  }]);

  return TSDemuxer;
}();

exports.default = TSDemuxer;

},{"../errors":20,"../events":22,"../utils/logger":36,"./adts":13,"./exp-golomb":17}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var ErrorTypes = exports.ErrorTypes = {
  // Identifier for a network error (loading error / timeout ...)
  NETWORK_ERROR: 'networkError',
  // Identifier for a media Error (video/parsing/mediasource error)
  MEDIA_ERROR: 'mediaError',
  // Identifier for all other errors
  OTHER_ERROR: 'otherError'
};

var ErrorDetails = exports.ErrorDetails = {
  // Identifier for a manifest load error - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_ERROR: 'manifestLoadError',
  // Identifier for a manifest load timeout - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeOut',
  // Identifier for a manifest parsing error - data: { url : faulty URL, reason : error reason}
  MANIFEST_PARSING_ERROR: 'manifestParsingError',
  // Identifier for a manifest with only incompatible codecs error - data: { url : faulty URL, reason : error reason}
  MANIFEST_INCOMPATIBLE_CODECS_ERROR: 'manifestIncompatibleCodecsError',
  // Identifier for playlist load error - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_ERROR: 'levelLoadError',
  // Identifier for playlist load timeout - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_TIMEOUT: 'levelLoadTimeOut',
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_SWITCH_ERROR: 'levelSwitchError',
  // Identifier for fragment load error - data: { frag : fragment object, response : XHR response}
  FRAG_LOAD_ERROR: 'fragLoadError',
  // Identifier for fragment loop loading error - data: { frag : fragment object}
  FRAG_LOOP_LOADING_ERROR: 'fragLoopLoadingError',
  // Identifier for fragment load timeout error - data: { frag : fragment object}
  FRAG_LOAD_TIMEOUT: 'fragLoadTimeOut',
  // Identifier for a fragment decryption error event - data: parsing error description
  FRAG_DECRYPT_ERROR: 'fragDecryptError',
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR: 'fragParsingError',
  // Identifier for decrypt key load error - data: { frag : fragment object, response : XHR response}
  KEY_LOAD_ERROR: 'keyLoadError',
  // Identifier for decrypt key load timeout error - data: { frag : fragment object}
  KEY_LOAD_TIMEOUT: 'keyLoadTimeOut',
  // Identifier for a buffer append error - data: append error description
  BUFFER_APPEND_ERROR: 'bufferAppendError',
  // Identifier for a buffer appending error event - data: appending error description
  BUFFER_APPENDING_ERROR: 'bufferAppendingError',
  // Identifier for a buffer stalled error event
  BUFFER_STALLED_ERROR: 'bufferStalledError',
  // Identifier for a buffer full event
  BUFFER_FULL_ERROR: 'bufferFullError',
  // Identifier for a buffer seek over hole event
  BUFFER_SEEK_OVER_HOLE: 'bufferSeekOverHole'
};

},{}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
*
* All objects in the event handling chain should inherit from this class
*
*/

//import {logger} from './utils/logger';

var EventHandler = function () {
  function EventHandler(hls) {
    _classCallCheck(this, EventHandler);

    this.hls = hls;
    this.onEvent = this.onEvent.bind(this);

    for (var _len = arguments.length, events = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      events[_key - 1] = arguments[_key];
    }

    this.handledEvents = events;
    this.useGenericHandler = true;

    this.registerListeners();
  }

  _createClass(EventHandler, [{
    key: 'destroy',
    value: function destroy() {
      this.unregisterListeners();
    }
  }, {
    key: 'isEventHandler',
    value: function isEventHandler() {
      return _typeof(this.handledEvents) === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
    }
  }, {
    key: 'registerListeners',
    value: function registerListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          if (event === 'hlsEventGeneric') {
            throw new Error('Forbidden event name: ' + event);
          }
          this.hls.on(event, this.onEvent);
        }.bind(this));
      }
    }
  }, {
    key: 'unregisterListeners',
    value: function unregisterListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          this.hls.off(event, this.onEvent);
        }.bind(this));
      }
    }

    /*
    * arguments: event (string), data (any)
    */

  }, {
    key: 'onEvent',
    value: function onEvent(event, data) {
      this.onEventGeneric(event, data);
    }
  }, {
    key: 'onEventGeneric',
    value: function onEventGeneric(event, data) {
      var eventToFunction = function eventToFunction(event, data) {
        var funcName = 'on' + event.replace('hls', '');
        if (typeof this[funcName] !== 'function') {
          throw new Error('Event ' + event + ' has no generic handler in this ' + this.constructor.name + ' class (tried ' + funcName + ')');
        }
        return this[funcName].bind(this, data);
      };
      eventToFunction.call(this, event, data).call();
    }
  }]);

  return EventHandler;
}();

exports.default = EventHandler;

},{}],22:[function(require,module,exports){
'use strict';

module.exports = {
  // fired before MediaSource is attaching to media element - data: { media }
  MEDIA_ATTACHING: 'hlsMediaAttaching',
  // fired when MediaSource has been succesfully attached to media element - data: { }
  MEDIA_ATTACHED: 'hlsMediaAttached',
  // fired before detaching MediaSource from media element - data: { }
  MEDIA_DETACHING: 'hlsMediaDetaching',
  // fired when MediaSource has been detached from media element - data: { }
  MEDIA_DETACHED: 'hlsMediaDetached',
  // fired when we buffer is going to be resetted
  BUFFER_RESET: 'hlsBufferReset',
  // fired when we know about the codecs that we need buffers for to push into - data: {tracks : { container, codec, levelCodec, initSegment, metadata }}
  BUFFER_CODECS: 'hlsBufferCodecs',
  // fired when we append a segment to the buffer - data: { segment: segment object }
  BUFFER_APPENDING: 'hlsBufferAppending',
  // fired when we are done with appending a media segment to the buffer
  BUFFER_APPENDED: 'hlsBufferAppended',
  // fired when the stream is finished and we want to notify the media buffer that there will be no more data
  BUFFER_EOS: 'hlsBufferEos',
  // fired when the media buffer should be flushed - data {startOffset, endOffset}
  BUFFER_FLUSHING: 'hlsBufferFlushing',
  // fired when the media has been flushed
  BUFFER_FLUSHED: 'hlsBufferFlushed',
  // fired to signal that a manifest loading starts - data: { url : manifestURL}
  MANIFEST_LOADING: 'hlsManifestLoading',
  // fired after manifest has been loaded - data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  MANIFEST_LOADED: 'hlsManifestLoaded',
  // fired after manifest has been parsed - data: { levels : [available quality levels] , firstLevel : index of first quality level appearing in Manifest}
  MANIFEST_PARSED: 'hlsManifestParsed',
  // fired when a level playlist loading starts - data: { url : level URL  level : id of level being loaded}
  LEVEL_LOADING: 'hlsLevelLoading',
  // fired when a level playlist loading finishes - data: { details : levelDetails object, level : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  LEVEL_LOADED: 'hlsLevelLoaded',
  // fired when a level's details have been updated based on previous details, after it has been loaded. - data: { details : levelDetails object, level : id of updated level }
  LEVEL_UPDATED: 'hlsLevelUpdated',
  // fired when a level's PTS information has been updated after parsing a fragment - data: { details : levelDetails object, level : id of updated level, drift: PTS drift observed when parsing last fragment }
  LEVEL_PTS_UPDATED: 'hlsLevelPtsUpdated',
  // fired when a level switch is requested - data: { level : id of new level }
  LEVEL_SWITCH: 'hlsLevelSwitch',
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING: 'hlsFragLoading',
  // fired when a fragment loading is progressing - data: { frag : fragment object, { trequest, tfirst, loaded}}
  FRAG_LOAD_PROGRESS: 'hlsFragLoadProgress',
  // Identifier for fragment load aborting for emergency switch down - data: {frag : fragment object}
  FRAG_LOAD_EMERGENCY_ABORTED: 'hlsFragLoadEmergencyAborted',
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED: 'hlsFragLoaded',
  // fired when Init Segment has been extracted from fragment - data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT: 'hlsFragParsingInitSegment',
  // fired when parsing sei text is completed - data: { samples : [ sei samples pes ] }
  FRAG_PARSING_USERDATA: 'hlsFragParsingUserdata',
  // fired when parsing id3 is completed - data: { samples : [ id3 samples pes ] }
  FRAG_PARSING_METADATA: 'hlsFragParsingMetadata',
  // fired when data have been extracted from fragment - data: { data1 : moof MP4 box or TS fragments, data2 : mdat MP4 box or null}
  FRAG_PARSING_DATA: 'hlsFragParsingData',
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: 'hlsFragParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: 'hlsFragBuffered',
  // fired when fragment matching with current media position is changing - data : { frag : fragment object }
  FRAG_CHANGED: 'hlsFragChanged',
  // Identifier for a FPS drop event - data: {curentDropped, currentDecoded, totalDroppedFrames}
  FPS_DROP: 'hlsFpsDrop',
  // Identifier for an error event - data: { type : error type, details : error details, fatal : if true, hls.js cannot/will not try to recover, if false, hls.js will try to recover,other error specific data}
  ERROR: 'hlsError',
  // fired when hls.js instance starts destroying. Different from MEDIA_DETACHED as one could want to detach and reattach a media to the instance of hls.js to handle mid-rolls for example
  DESTROYING: 'hlsDestroying',
  // fired when a decrypt key loading starts - data: { frag : fragment object}
  KEY_LOADING: 'hlsKeyLoading',
  // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length}}
  KEY_LOADED: 'hlsKeyLoaded'
};

},{}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Buffer Helper class, providing methods dealing buffer length retrieval
*/

var BufferHelper = function () {
  function BufferHelper() {
    _classCallCheck(this, BufferHelper);
  }

  _createClass(BufferHelper, null, [{
    key: "bufferInfo",
    value: function bufferInfo(media, pos, maxHoleDuration) {
      if (media) {
        var vbuffered = media.buffered,
            buffered = [],
            i;
        for (i = 0; i < vbuffered.length; i++) {
          buffered.push({ start: vbuffered.start(i), end: vbuffered.end(i) });
        }
        return this.bufferedInfo(buffered, pos, maxHoleDuration);
      } else {
        return { len: 0, start: 0, end: 0, nextStart: undefined };
      }
    }
  }, {
    key: "bufferedInfo",
    value: function bufferedInfo(buffered, pos, maxHoleDuration) {
      var buffered2 = [],

      // bufferStart and bufferEnd are buffer boundaries around current video position
      bufferLen,
          bufferStart,
          bufferEnd,
          bufferStartNext,
          i;
      // sort on buffer.start/smaller end (IE does not always return sorted buffered range)
      buffered.sort(function (a, b) {
        var diff = a.start - b.start;
        if (diff) {
          return diff;
        } else {
          return b.end - a.end;
        }
      });
      // there might be some small holes between buffer time range
      // consider that holes smaller than maxHoleDuration are irrelevant and build another
      // buffer time range representations that discards those holes
      for (i = 0; i < buffered.length; i++) {
        var buf2len = buffered2.length;
        if (buf2len) {
          var buf2end = buffered2[buf2len - 1].end;
          // if small hole (value between 0 or maxHoleDuration ) or overlapping (negative)
          if (buffered[i].start - buf2end < maxHoleDuration) {
            // merge overlapping time ranges
            // update lastRange.end only if smaller than item.end
            // e.g.  [ 1, 15] with  [ 2,8] => [ 1,15] (no need to modify lastRange.end)
            // whereas [ 1, 8] with  [ 2,15] => [ 1,15] ( lastRange should switch from [1,8] to [1,15])
            if (buffered[i].end > buf2end) {
              buffered2[buf2len - 1].end = buffered[i].end;
            }
          } else {
            // big hole
            buffered2.push(buffered[i]);
          }
        } else {
          // first value
          buffered2.push(buffered[i]);
        }
      }
      for (i = 0, bufferLen = 0, bufferStart = bufferEnd = pos; i < buffered2.length; i++) {
        var start = buffered2[i].start,
            end = buffered2[i].end;
        //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
        if (pos + maxHoleDuration >= start && pos < end) {
          // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
          bufferStart = start;
          bufferEnd = end;
          bufferLen = bufferEnd - pos;
        } else if (pos + maxHoleDuration < start) {
          bufferStartNext = start;
          break;
        }
      }
      // if( bufferStart == bufferEnd && bufferEnd != 0) { debugger; }
      return { len: bufferLen, start: bufferStart, end: bufferEnd, nextStart: bufferStartNext };
    }
  }]);

  return BufferHelper;
}();

exports.default = BufferHelper;

},{}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Level Helper class, providing methods dealing with playlist sliding and drift
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LevelHelper = function () {
  function LevelHelper() {
    _classCallCheck(this, LevelHelper);
  }

  _createClass(LevelHelper, null, [{
    key: 'mergeDetails',
    value: function mergeDetails(oldDetails, newDetails) {
      var start = Math.max(oldDetails.startSN, newDetails.startSN) - newDetails.startSN,
          end = Math.min(oldDetails.endSN, newDetails.endSN) - newDetails.startSN,
          delta = newDetails.startSN - oldDetails.startSN,
          oldfragments = oldDetails.fragments,
          newfragments = newDetails.fragments,
          ccOffset = 0,
          PTSFrag;

      // check if old/new playlists have fragments in common
      if (end < start) {
        newDetails.PTSKnown = false;
        return;
      }
      // loop through overlapping SN and update startPTS , cc, and duration if any found
      for (var i = start; i <= end; i++) {
        var oldFrag = oldfragments[delta + i],
            newFrag = newfragments[i];
        ccOffset = oldFrag.cc - newFrag.cc;
        if (!isNaN(oldFrag.startPTS)) {
          newFrag.start = newFrag.startPTS = oldFrag.startPTS;
          newFrag.endPTS = oldFrag.endPTS;
          newFrag.duration = oldFrag.duration;
          PTSFrag = newFrag;
        }
      }

      if (ccOffset) {
        _logger.logger.log('discontinuity sliding from playlist, take drift into account');
        for (i = 0; i < newfragments.length; i++) {
          newfragments[i].cc += ccOffset;
        }
      }

      // if at least one fragment contains PTS info, recompute PTS information for all fragments
      if (PTSFrag) {
        LevelHelper.updateFragPTS(newDetails, PTSFrag.sn, PTSFrag.startPTS, PTSFrag.endPTS);
      } else {
        // adjust start by sliding offset
        var sliding = oldfragments[delta].start;
        for (i = 0; i < newfragments.length; i++) {
          newfragments[i].start += sliding;
        }
      }
      // if we are here, it means we have fragments overlapping between
      // old and new level. reliable PTS info is thus relying on old level
      newDetails.PTSKnown = oldDetails.PTSKnown;
      return;
    }
  }, {
    key: 'updateFragPTS',
    value: function updateFragPTS(details, sn, startPTS, endPTS) {
      var fragIdx, fragments, frag, i;
      // exit if sn out of range
      if (sn < details.startSN || sn > details.endSN) {
        return 0;
      }
      fragIdx = sn - details.startSN;
      fragments = details.fragments;
      frag = fragments[fragIdx];

      var prevFrag = fragments[fragIdx - 1];
      var nextFrag = fragments[fragIdx + 1];

      if (!isNaN(frag.startPTS)) {
        startPTS = Math.min(startPTS, frag.startPTS);
        endPTS = Math.max(endPTS, frag.endPTS);
      }

      if (prevFrag && Math.abs(prevFrag.start - startPTS) > 100) {
        startPTS = prevFrag.start + prevFrag.duration;
        // if (frag.duration > 100) debugger;
        endPTS = startPTS + frag.duration;
        console.info(frag.sn + ':  ' + startPTS + ' -> ' + endPTS + ' | ' + frag.duration);
        // debugger;
      } else if (nextFrag && Math.abs(nextFrag.start - startPTS) > 100) {
          // startPTS = nextFrag.start + nextFrag.duration;
          // endPTS = startPTS + frag.duration;
          // console.log(frag.sn + ':  ' + startPTS + ' -> ' + endPTS + ' | ' + frag.duration);
          // debugger;
        }

      if (Math.abs(startPTS - endPTS) > 100) {
        var old_endPTS = endPTS;
        endPTS = startPTS + frag.duration;
        console.info('adjusting endPTS: ' + old_endPTS + ' -> ' + endPTS);
      }

      var drift = startPTS - frag.start;

      frag.start = frag.startPTS = startPTS;
      frag.endPTS = endPTS;
      frag.duration = endPTS - startPTS;

      // if (frag.duration > 100) debugger;

      // adjust fragment PTS/duration from seqnum-1 to frag 0
      for (i = fragIdx; i > 0; i--) {
        LevelHelper.updatePTS(fragments, i, i - 1);
      }

      // adjust fragment PTS/duration from seqnum to last frag
      for (i = fragIdx; i < fragments.length - 1; i++) {
        LevelHelper.updatePTS(fragments, i, i + 1);
      }
      details.PTSKnown = true;
      //logger.log(`                                            frag start/end:${startPTS.toFixed(3)}/${endPTS.toFixed(3)}`);

      return drift;
    }
  }, {
    key: 'updatePTS',
    value: function updatePTS(fragments, fromIdx, toIdx) {
      var fragFrom = fragments[fromIdx],
          fragTo = fragments[toIdx],
          fragToPTS = fragTo.startPTS;
      // if we know startPTS[toIdx]
      if (!isNaN(fragToPTS)) {
        // update fragment duration.
        // it helps to fix drifts between playlist reported duration and fragment real duration
        if (toIdx > fromIdx) {
          fragFrom.duration = fragToPTS - fragFrom.start;
          if (fragFrom.duration < 0) {
            _logger.logger.error('negative duration computed for frag ' + fragFrom.sn + ',level ' + fragFrom.level + ', there should be some duration drift between playlist and fragment!');
            debugger;
          }
        } else {
          fragTo.duration = fragFrom.start - fragToPTS;
          if (fragTo.duration < 0) {
            _logger.logger.error('negative duration computed for frag ' + fragTo.sn + ',level ' + fragTo.level + ', there should be some duration drift between playlist and fragment!');
            debugger;
          }
        }
      } else {
        // we dont know startPTS[toIdx]
        if (toIdx > fromIdx) {
          fragTo.start = fragFrom.start + fragFrom.duration;
        } else {
          fragTo.start = fragFrom.start - fragTo.duration;
        }
      }
    }
  }]);

  return LevelHelper;
}();

exports.default = LevelHelper;

},{"../utils/logger":36}],25:[function(require,module,exports){
/**
 * HLS interface
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
//import FPSController from './controller/fps-controller';


var _events = require('./events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('./errors');

var _playlistLoader = require('./loader/playlist-loader');

var _playlistLoader2 = _interopRequireDefault(_playlistLoader);

var _fragmentLoader = require('./loader/fragment-loader');

var _fragmentLoader2 = _interopRequireDefault(_fragmentLoader);

var _abrController = require('./controller/abr-controller');

var _abrController2 = _interopRequireDefault(_abrController);

var _bufferController = require('./controller/buffer-controller');

var _bufferController2 = _interopRequireDefault(_bufferController);

var _capLevelController = require('./controller/cap-level-controller');

var _capLevelController2 = _interopRequireDefault(_capLevelController);

var _streamController = require('./controller/stream-controller');

var _streamController2 = _interopRequireDefault(_streamController);

var _levelController = require('./controller/level-controller');

var _levelController2 = _interopRequireDefault(_levelController);

var _timelineController = require('./controller/timeline-controller');

var _timelineController2 = _interopRequireDefault(_timelineController);

var _logger = require('./utils/logger');

var _xhrLoader = require('./utils/xhr-loader');

var _xhrLoader2 = _interopRequireDefault(_xhrLoader);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

var _keyLoader = require('./loader/key-loader');

var _keyLoader2 = _interopRequireDefault(_keyLoader);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Hls = function () {
  _createClass(Hls, null, [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
    }
  }, {
    key: 'Events',
    get: function get() {
      return _events2.default;
    }
  }, {
    key: 'ErrorTypes',
    get: function get() {
      return _errors.ErrorTypes;
    }
  }, {
    key: 'ErrorDetails',
    get: function get() {
      return _errors.ErrorDetails;
    }
  }, {
    key: 'DefaultConfig',
    get: function get() {
      if (!Hls.defaultConfig) {
        Hls.defaultConfig = {
          autoStartLoad: true,
          debug: true,
          capLevelToPlayerSize: false,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 5,
          maxSeekHole: 2,
          maxFragLookUpTolerance: 0.2,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
          liveSyncDuration: undefined,
          liveMaxLatencyDuration: undefined,
          maxMaxBufferLength: 600,
          enableWorker: true,
          enableSoftwareAES: true,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 1,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 1000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 20,
          fragLoadingRetryDelay: 1000,
          fragLoadingLoopThreshold: 3,
          startFragPrefetch: false,
          // fpsDroppedMonitoringPeriod: 5000,
          // fpsDroppedMonitoringThreshold: 0.2,
          appendErrorMaxRetry: 3,
          loader: _xhrLoader2.default,
          fLoader: undefined,
          pLoader: undefined,
          abrController: _abrController2.default,
          bufferController: _bufferController2.default,
          capLevelController: _capLevelController2.default,
          streamController: _streamController2.default,
          timelineController: _timelineController2.default,
          enableCEA708Captions: true,
          enableMP2TPassThrough: false
        };
      }
      return Hls.defaultConfig;
    },
    set: function set(defaultConfig) {
      Hls.defaultConfig = defaultConfig;
    }
  }]);

  function Hls() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Hls);

    var defaultConfig = Hls.DefaultConfig;

    if ((config.liveSyncDurationCount || config.liveMaxLatencyDurationCount) && (config.liveSyncDuration || config.liveMaxLatencyDuration)) {
      throw new Error('Illegal hls.js config: don\'t mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration');
    }

    for (var prop in defaultConfig) {
      if (prop in config) {
        continue;
      }
      config[prop] = defaultConfig[prop];
    }

    if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be gt "liveSyncDurationCount"');
    }

    if (config.liveMaxLatencyDuration !== undefined && (config.liveMaxLatencyDuration <= config.liveSyncDuration || config.liveSyncDuration === undefined)) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be gt "liveSyncDuration"');
    }

    (0, _logger.enableLogs)(config.debug);
    this.config = config;
    // observer setup
    var observer = this.observer = new _events4.default();
    observer.trigger = function trigger(event) {
      for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        data[_key - 1] = arguments[_key];
      }

      observer.emit.apply(observer, [event, event].concat(data));
    };

    observer.off = function off(event) {
      for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        data[_key2 - 1] = arguments[_key2];
      }

      observer.removeListener.apply(observer, [event].concat(data));
    };
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
    this.trigger = observer.trigger.bind(observer);
    this.playlistLoader = new _playlistLoader2.default(this);
    this.fragmentLoader = new _fragmentLoader2.default(this);
    this.levelController = new _levelController2.default(this);
    this.abrController = new config.abrController(this);
    this.bufferController = new config.bufferController(this);
    this.capLevelController = new config.capLevelController(this);
    this.streamController = new config.streamController(this);
    this.timelineController = new config.timelineController(this);
    this.keyLoader = new _keyLoader2.default(this);
    //this.fpsController = new FPSController(this);
  }

  _createClass(Hls, [{
    key: 'destroy',
    value: function destroy() {
      _logger.logger.log('destroy');
      this.trigger(_events2.default.DESTROYING);
      this.detachMedia();
      this.playlistLoader.destroy();
      this.fragmentLoader.destroy();
      this.levelController.destroy();
      this.bufferController.destroy();
      this.capLevelController.destroy();
      this.streamController.destroy();
      this.timelineController.destroy();
      this.keyLoader.destroy();
      //this.fpsController.destroy();
      this.url = null;
      this.observer.removeAllListeners();
    }
  }, {
    key: 'attachMedia',
    value: function attachMedia(media) {
      _logger.logger.log('attachMedia');
      this.media = media;
      this.trigger(_events2.default.MEDIA_ATTACHING, { media: media });
    }
  }, {
    key: 'detachMedia',
    value: function detachMedia() {
      _logger.logger.log('detachMedia');
      this.trigger(_events2.default.MEDIA_DETACHING);
      this.media = null;
    }
  }, {
    key: 'loadSource',
    value: function loadSource(url) {
      _logger.logger.log('loadSource:' + url);
      this.url = url;
      // when attaching to a source URL, trigger a playlist load
      this.trigger(_events2.default.MANIFEST_LOADING, { url: url });
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      var startPosition = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      _logger.logger.log('startLoad');
      this.levelController.startLoad();
      this.streamController.startLoad(startPosition);
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      _logger.logger.log('stopLoad');
      this.levelController.stopLoad();
      this.streamController.stopLoad();
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      _logger.logger.log('swapAudioCodec');
      this.streamController.swapAudioCodec();
    }
  }, {
    key: 'recoverMediaError',
    value: function recoverMediaError() {
      _logger.logger.log('recoverMediaError');
      var media = this.media;
      this.detachMedia();
      this.attachMedia(media);
    }

    /** Return all quality levels **/

  }, {
    key: 'levels',
    get: function get() {
      return this.levelController.levels;
    }

    /** Return current playback quality level **/

  }, {
    key: 'currentLevel',
    get: function get() {
      return this.streamController.currentLevel;
    }

    /* set quality level immediately (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set currentLevel:' + newLevel);
      this.loadLevel = newLevel;
      this.streamController.immediateLevelSwitch();
    }

    /** Return next playback quality level (quality level of next fragment) **/

  }, {
    key: 'nextLevel',
    get: function get() {
      return this.streamController.nextLevel;
    }

    /* set quality level for next fragment (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set nextLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
      this.streamController.nextLevelSwitch();
    }

    /** Return the quality level of current/last loaded fragment **/

  }, {
    key: 'loadLevel',
    get: function get() {
      return this.levelController.level;
    }

    /* set quality level for current/next loaded fragment (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set loadLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
    }

    /** Return the quality level of next loaded fragment **/

  }, {
    key: 'nextLoadLevel',
    get: function get() {
      return this.levelController.nextLoadLevel;
    }

    /** set quality level of next loaded fragment **/
    ,
    set: function set(level) {
      this.levelController.nextLoadLevel = level;
    }

    /** Return first level (index of first level referenced in manifest)
    **/

  }, {
    key: 'firstLevel',
    get: function get() {
      return this.levelController.firstLevel;
    }

    /** set first level (index of first level referenced in manifest)
    **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set firstLevel:' + newLevel);
      this.levelController.firstLevel = newLevel;
    }

    /** Return start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/

  }, {
    key: 'startLevel',
    get: function get() {
      return this.levelController.startLevel;
    }

    /** set  start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set startLevel:' + newLevel);
      this.levelController.startLevel = newLevel;
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/

  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this.abrController.autoLevelCapping;
    }

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set autoLevelCapping:' + newLevel);
      this.abrController.autoLevelCapping = newLevel;
    }

    /* check if we are in automatic level selection mode */

  }, {
    key: 'autoLevelEnabled',
    get: function get() {
      return this.levelController.manualLevel === -1;
    }

    /* return manual level */

  }, {
    key: 'manualLevel',
    get: function get() {
      return this.levelController.manualLevel;
    }
  }]);

  return Hls;
}();

exports.default = Hls;

},{"./controller/abr-controller":3,"./controller/buffer-controller":4,"./controller/cap-level-controller":5,"./controller/level-controller":6,"./controller/stream-controller":7,"./controller/timeline-controller":8,"./errors":20,"./events":22,"./loader/fragment-loader":27,"./loader/key-loader":28,"./loader/playlist-loader":29,"./utils/logger":36,"./utils/xhr-loader":38,"events":1}],26:[function(require,module,exports){
'use strict';

// This is mostly for support of the es6 module export
// syntax with the babel compiler, it looks like it doesnt support
// function exports like we are used to in node/commonjs
module.exports = require('./hls.js').default;

},{"./hls.js":25}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Fragment Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var FragmentLoader = function (_EventHandler) {
  _inherits(FragmentLoader, _EventHandler);

  function FragmentLoader(hls) {
    _classCallCheck(this, FragmentLoader);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(FragmentLoader).call(this, hls, _events2.default.FRAG_LOADING));
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(data) {
      var frag = data.frag;
      this.frag = frag;
      this.frag.loaded = 0;
      var config = this.hls.config;
      frag.loader = this.loader = typeof config.fLoader !== 'undefined' ? new config.fLoader(config) : new config.loader(config);
      this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, 1, 0, this.loadprogress.bind(this), frag);
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var payload = event.currentTarget.response;
      stats.length = payload.byteLength;
      // detach fragment loader on load success
      this.frag.loader = undefined;
      this.hls.trigger(_events2.default.FRAG_LOADED, { payload: payload, frag: this.frag, stats: stats });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event, stats) {
      this.frag.loaded = stats.loaded;
      this.hls.trigger(_events2.default.FRAG_LOAD_PROGRESS, { frag: this.frag, stats: stats });
    }
  }]);

  return FragmentLoader;
}(_eventHandler2.default);

exports.default = FragmentLoader;

},{"../errors":20,"../event-handler":21,"../events":22}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Decrypt key Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var KeyLoader = function (_EventHandler) {
  _inherits(KeyLoader, _EventHandler);

  function KeyLoader(hls) {
    _classCallCheck(this, KeyLoader);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(KeyLoader).call(this, hls, _events2.default.KEY_LOADING));

    _this.decryptkey = null;
    _this.decrypturl = null;
    return _this;
  }

  _createClass(KeyLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onKeyLoading',
    value: function onKeyLoading(data) {
      var frag = this.frag = data.frag,
          decryptdata = frag.decryptdata,
          uri = decryptdata.uri;
      // if uri is different from previous one or if decrypt key not retrieved yet
      if (uri !== this.decrypturl || this.decryptkey === null) {
        var config = this.hls.config;
        frag.loader = this.loader = new config.loader(config);
        this.decrypturl = uri;
        this.decryptkey = null;
        frag.loader.load(uri, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this), frag);
      } else if (this.decryptkey) {
        // we already loaded this key, return it
        decryptdata.key = this.decryptkey;
        this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
      }
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event) {
      var frag = this.frag;
      this.decryptkey = frag.decryptdata.key = new Uint8Array(event.currentTarget.response);
      // detach fragment loader on load success
      frag.loader = undefined;
      this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress() {}
  }]);

  return KeyLoader;
}(_eventHandler2.default);

exports.default = KeyLoader;

},{"../errors":20,"../event-handler":21,"../events":22}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

var _url = require('../utils/url');

var _url2 = _interopRequireDefault(_url);

var _attrList = require('../utils/attr-list');

var _attrList2 = _interopRequireDefault(_attrList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Playlist Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

//import {logger} from '../utils/logger';

var PlaylistLoader = function (_EventHandler) {
  _inherits(PlaylistLoader, _EventHandler);

  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(PlaylistLoader).call(this, hls, _events2.default.MANIFEST_LOADING, _events2.default.LEVEL_LOADING));
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.url = this.id = null;
      this.totalDuration = 0;
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading(data) {
      this.load(data.url, null);
    }
  }, {
    key: 'onLevelLoading',
    value: function onLevelLoading(data) {
      this.load(data.url, data.level, data.id);
      this.totalDuration = data.totalDuration || 0;
      console.info(data);
    }
  }, {
    key: 'load',
    value: function load(url, id1, id2) {
      var config = this.hls.config,
          retry,
          timeout,
          retryDelay;
      this.url = url;
      this.id = id1;
      this.id2 = id2;
      if (this.id === null) {
        retry = config.manifestLoadingMaxRetry;
        timeout = config.manifestLoadingTimeOut;
        retryDelay = config.manifestLoadingRetryDelay;
      } else {
        retry = config.levelLoadingMaxRetry;
        timeout = config.levelLoadingTimeOut;
        retryDelay = config.levelLoadingRetryDelay;
      }
      this.loader = typeof config.pLoader !== 'undefined' ? new config.pLoader(config) : new config.loader(config);
      this.loader.load(url, '', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), timeout, retry, retryDelay);
    }
  }, {
    key: 'resolve',
    value: function resolve(url, baseUrl) {
      return _url2.default.buildAbsoluteURL(baseUrl, url);
    }
  }, {
    key: 'parseMasterPlaylist',
    value: function parseMasterPlaylist(string, baseurl) {
      var levels = [],
          result = void 0;

      // https://regex101.com is your friend
      var re = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
      while ((result = re.exec(string)) != null) {
        var level = {};

        var attrs = level.attrs = new _attrList2.default(result[1]);
        level.url = this.resolve(result[2], baseurl);

        var resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }
        level.bitrate = attrs.decimalInteger('BANDWIDTH');
        level.name = attrs.NAME;

        var codecs = attrs.CODECS;
        if (codecs) {
          codecs = codecs.split(',');
          for (var i = 0; i < codecs.length; i++) {
            var codec = codecs[i];
            if (codec.indexOf('avc1') !== -1) {
              level.videoCodec = this.avc1toavcoti(codec);
            } else {
              level.audioCodec = codec;
            }
          }
        }

        levels.push(level);
      }
      return levels;
    }
  }, {
    key: 'avc1toavcoti',
    value: function avc1toavcoti(codec) {
      var result,
          avcdata = codec.split('.');
      if (avcdata.length > 2) {
        result = avcdata.shift() + '.';
        result += parseInt(avcdata.shift()).toString(16);
        result += ('000' + parseInt(avcdata.shift()).toString(16)).substr(-4);
      } else {
        result = codec;
      }
      return result;
    }
  }, {
    key: 'cloneObj',
    value: function cloneObj(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  }, {
    key: 'parseLevelPlaylist',
    value: function parseLevelPlaylist(string, baseurl, id) {
      var currentSN = 0,
          totalduration = 0,
          level = { url: baseurl, fragments: [], live: true, startSN: 0 },
          levelkey = { method: null, key: null, iv: null, uri: null },
          cc = 0,
          programDateTime = null,
          frag = null,
          result,
          regexp,
          byteRangeEndOffset,
          byteRangeStartOffset,
          nextTimestamp;

      var re = /(\d+)_\d+.ts/;

      regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT-X-(KEY):(.*))|(?:#EXT(INF):([\d\.]+)[^\r\n]*([\r\n]+[^#|\r\n]+)?)|(?:#EXT-X-(BYTERANGE):([\d]+[@[\d]*)]*[\r\n]+([^#|\r\n]+)?|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DIS)CONTINUITY))|(?:#EXT-X-(PROGRAM-DATE-TIME):(.*))/g;
      while ((result = regexp.exec(string)) !== null) {
        result.shift();
        result = result.filter(function (n) {
          return n !== undefined;
        });
        switch (result[0]) {
          case 'MEDIA-SEQUENCE':
            currentSN = level.startSN = parseInt(result[1]);
            break;
          case 'TARGETDURATION':
            level.targetduration = parseFloat(result[1]);
            break;
          case 'ENDLIST':
            level.live = false;
            break;
          case 'DIS':
            cc++;
            break;
          case 'BYTERANGE':
            var params = result[1].split('@');
            if (params.length === 1) {
              byteRangeStartOffset = byteRangeEndOffset;
            } else {
              byteRangeStartOffset = parseInt(params[1]);
            }
            byteRangeEndOffset = parseInt(params[0]) + byteRangeStartOffset;
            if (frag && !frag.url) {
              frag.byteRangeStartOffset = byteRangeStartOffset;
              frag.byteRangeEndOffset = byteRangeEndOffset;
              frag.url = this.resolve(result[2], baseurl);
            }
            break;
          case 'INF':
            var duration = parseFloat(result[1]);
            if (!isNaN(duration)) {
              var fragdecryptdata,
                  sn = currentSN++;
              if (levelkey.method && levelkey.uri && !levelkey.iv) {
                fragdecryptdata = this.cloneObj(levelkey);
                var uint8View = new Uint8Array(16);
                for (var i = 12; i < 16; i++) {
                  uint8View[i] = sn >> 8 * (15 - i) & 0xff;
                }
                fragdecryptdata.iv = uint8View;
              } else {
                fragdecryptdata = levelkey;
              }
              var url = result[2] ? this.resolve(result[2], baseurl) : null;

              var match = re.exec(url);
              var timestamp = match && match[1] ? match[1] : null;

              // if (timestamp && nextTimestamp) {
              // 	timestamp = parseInt( timestamp );
              // 	if ( timestamp - nextTimestamp > 2000 ) {
              // 		console.log( timestamp + ' ' + nextTimestamp + ' ' + url );
              // 		cc++;
              // 	}
              // }

              nextTimestamp = timestamp + duration * 1000;

              frag = { url: url, duration: duration, start: totalduration, sn: sn, level: id, cc: cc, byteRangeStartOffset: byteRangeStartOffset, byteRangeEndOffset: byteRangeEndOffset, decryptdata: fragdecryptdata, programDateTime: programDateTime };
              level.fragments.push(frag);
              totalduration += duration;
              byteRangeStartOffset = null;
              programDateTime = null;
            }
            break;
          case 'KEY':
            // https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4
            var decryptparams = result[1];
            var keyAttrs = new _attrList2.default(decryptparams);
            var decryptmethod = keyAttrs.enumeratedString('METHOD'),
                decrypturi = keyAttrs.URI,
                decryptiv = keyAttrs.hexadecimalInteger('IV');
            if (decryptmethod) {
              levelkey = { method: null, key: null, iv: null, uri: null };
              if (decrypturi && decryptmethod === 'AES-128') {
                levelkey.method = decryptmethod;
                // URI to get the key
                levelkey.uri = this.resolve(decrypturi, baseurl);
                levelkey.key = null;
                // Initialization Vector (IV)
                levelkey.iv = decryptiv;
              }
            }
            break;
          case 'PROGRAM-DATE-TIME':
            programDateTime = new Date(Date.parse(result[1]));
            break;
          default:
            break;
        }
      }
      //logger.log('found ' + level.fragments.length + ' fragments');
      if (frag && !frag.url) {
        level.fragments.pop();
        totalduration -= frag.duration;
      }
      level.totalduration = totalduration;
      level.endSN = currentSN - 1;

      if (level.live) {
        var endPTS;
        for (var i in level.fragments) {
          var f = level.fragments[i];
          f.start = parseInt(this.totalDuration);
          console.info("start: " + f.start + "  endPTS: " + endPTS);
          endPTS = f.endPTS;
        }
        level.totalduration = endPTS ? endPTS : level.totalduration + this.totalDuration;
        console.info(level);
      }
      return level;
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var target = event.currentTarget,
          string = target.responseText,
          url = target.responseURL,
          id = this.id,
          id2 = this.id2,
          hls = this.hls,
          levels;
      // responseURL not supported on some browsers (it is used to detect URL redirection)
      if (url === undefined) {
        // fallback to initial URL
        url = this.url;
      }
      stats.tload = performance.now();
      stats.mtime = new Date(target.getResponseHeader('Last-Modified'));
      if (string.indexOf('#EXTM3U') === 0) {
        if (string.indexOf('#EXTINF:') > 0) {
          // 1 level playlist
          // if first request, fire manifest loaded event, level will be reloaded afterwards
          // (this is to have a uniform logic for 1 level/multilevel playlists)
          if (this.id === null) {
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: [{ url: url }], url: url, stats: stats });
          } else {
            var levelDetails = this.parseLevelPlaylist(string, url, id);
            stats.tparsed = performance.now();
            hls.trigger(_events2.default.LEVEL_LOADED, { details: levelDetails, level: id, id: id2, stats: stats });
          }
        } else {
          levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: levels, url: url, stats: stats });
          } else {
            hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no level found in manifest' });
          }
        }
      } else {
        hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no EXTM3U delimiter' });
      }
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      var details, fatal;
      if (this.id === null) {
        details = _errors.ErrorDetails.MANIFEST_LOAD_ERROR;
        fatal = true;
      } else {
        details = _errors.ErrorDetails.LEVEL_LOAD_ERROR;
        fatal = false;
      }
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, response: event.currentTarget, level: this.id, id: this.id2 });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      var details, fatal;
      if (this.id === null) {
        details = _errors.ErrorDetails.MANIFEST_LOAD_TIMEOUT;
        fatal = true;
      } else {
        details = _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT;
        fatal = false;
      }
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, level: this.id, id: this.id2 });
    }
  }]);

  return PlaylistLoader;
}(_eventHandler2.default);

exports.default = PlaylistLoader;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/attr-list":33,"../utils/url":37}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Generate MP4 Box
*/

//import Hex from '../utils/hex';

var MP4 = function () {
  function MP4() {
    _classCallCheck(this, MP4);
  }

  _createClass(MP4, null, [{
    key: 'init',
    value: function init() {
      MP4.types = {
        avc1: [], // codingname
        avcC: [],
        btrt: [],
        dinf: [],
        dref: [],
        esds: [],
        ftyp: [],
        hdlr: [],
        mdat: [],
        mdhd: [],
        mdia: [],
        mfhd: [],
        minf: [],
        moof: [],
        moov: [],
        mp4a: [],
        mvex: [],
        mvhd: [],
        sdtp: [],
        stbl: [],
        stco: [],
        stsc: [],
        stsd: [],
        stsz: [],
        stts: [],
        tfdt: [],
        tfhd: [],
        traf: [],
        trak: [],
        trun: [],
        trex: [],
        tkhd: [],
        vmhd: [],
        smhd: []
      };

      var i;
      for (i in MP4.types) {
        if (MP4.types.hasOwnProperty(i)) {
          MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
        }
      }

      var videoHdlr = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
      ]);

      var audioHdlr = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
      ]);

      MP4.HDLR_TYPES = {
        'video': videoHdlr,
        'audio': audioHdlr
      };

      var dref = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // entry_count
      0x00, 0x00, 0x00, 0x0c, // entry_size
      0x75, 0x72, 0x6c, 0x20, // 'url' type
      0x00, // version 0
      0x00, 0x00, 0x01 // entry_flags
      ]);

      var stco = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00 // entry_count
      ]);

      MP4.STTS = MP4.STSC = MP4.STCO = stco;

      MP4.STSZ = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // sample_size
      0x00, 0x00, 0x00, 0x00]);
      // sample_count
      MP4.VMHD = new Uint8Array([0x00, // version
      0x00, 0x00, 0x01, // flags
      0x00, 0x00, // graphicsmode
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // opcolor
      ]);
      MP4.SMHD = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, // balance
      0x00, 0x00 // reserved
      ]);

      MP4.STSD = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01]); // entry_count

      var majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
      var avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
      var minorVersion = new Uint8Array([0, 0, 0, 1]);

      MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
      MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
    }
  }, {
    key: 'box',
    value: function box(type) {
      var payload = Array.prototype.slice.call(arguments, 1),
          size = 8,
          i = payload.length,
          len = i,
          result;
      // calculate the total size we need to allocate
      while (i--) {
        size += payload[i].byteLength;
      }
      result = new Uint8Array(size);
      result[0] = size >> 24 & 0xff;
      result[1] = size >> 16 & 0xff;
      result[2] = size >> 8 & 0xff;
      result[3] = size & 0xff;
      result.set(type, 4);
      // copy the payload into the result
      for (i = 0, size = 8; i < len; i++) {
        // copy payload[i] array @ offset size
        result.set(payload[i], size);
        size += payload[i].byteLength;
      }
      return result;
    }
  }, {
    key: 'hdlr',
    value: function hdlr(type) {
      return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
    }
  }, {
    key: 'mdat',
    value: function mdat(data) {
      return MP4.box(MP4.types.mdat, data);
    }
  }, {
    key: 'mdhd',
    value: function mdhd(timescale, duration) {
      duration *= timescale;
      return MP4.box(MP4.types.mdhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x02, // creation_time
      0x00, 0x00, 0x00, 0x03, // modification_time
      timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, // timescale
      duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x55, 0xc4, // 'und' language (undetermined)
      0x00, 0x00]));
    }
  }, {
    key: 'mdia',
    value: function mdia(track) {
      return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    }
  }, {
    key: 'mfhd',
    value: function mfhd(sequenceNumber) {
      return MP4.box(MP4.types.mfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, // flags
      sequenceNumber >> 24, sequenceNumber >> 16 & 0xFF, sequenceNumber >> 8 & 0xFF, sequenceNumber & 0xFF]));
    }
  }, {
    key: 'minf',
    // sequence_number
    value: function minf(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
      } else {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
      }
    }
  }, {
    key: 'moof',
    value: function moof(sn, baseMediaDecodeTime, track) {
      return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
    }
    /**
     * @param tracks... (optional) {array} the tracks associated with this movie
     */

  }, {
    key: 'moov',
    value: function moov(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trak(tracks[i]);
      }

      return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
    }
  }, {
    key: 'mvex',
    value: function mvex(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trex(tracks[i]);
      }
      return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
    }
  }, {
    key: 'mvhd',
    value: function mvhd(timescale, duration) {
      duration *= timescale;
      var bytes = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // creation_time
      0x00, 0x00, 0x00, 0x02, // modification_time
      timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, // timescale
      duration >> 24 & 0xFF, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x00, 0x01, 0x00, 0x00, // 1.0 rate
      0x01, 0x00, // 1.0 volume
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      0xff, 0xff, 0xff, 0xff // next_track_ID
      ]);
      return MP4.box(MP4.types.mvhd, bytes);
    }
  }, {
    key: 'sdtp',
    value: function sdtp(track) {
      var samples = track.samples || [],
          bytes = new Uint8Array(4 + samples.length),
          flags,
          i;
      // leave the full box header (4 bytes) all zero
      // write the sample table
      for (i = 0; i < samples.length; i++) {
        flags = samples[i].flags;
        bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
      }

      return MP4.box(MP4.types.sdtp, bytes);
    }
  }, {
    key: 'stbl',
    value: function stbl(track) {
      return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
    }
  }, {
    key: 'avc1',
    value: function avc1(track) {
      var sps = [],
          pps = [],
          i,
          data,
          len;
      // assemble the SPSs

      for (i = 0; i < track.sps.length; i++) {
        data = track.sps[i];
        len = data.byteLength;
        sps.push(len >>> 8 & 0xFF);
        sps.push(len & 0xFF);
        sps = sps.concat(Array.prototype.slice.call(data)); // SPS
      }

      // assemble the PPSs
      for (i = 0; i < track.pps.length; i++) {
        data = track.pps[i];
        len = data.byteLength;
        pps.push(len >>> 8 & 0xFF);
        pps.push(len & 0xFF);
        pps = pps.concat(Array.prototype.slice.call(data));
      }

      var avcc = MP4.box(MP4.types.avcC, new Uint8Array([0x01, // version
      sps[3], // profile
      sps[4], // profile compat
      sps[5], // level
      0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
      0xE0 | track.sps.length // 3bit reserved (111) + numOfSequenceParameterSets
      ].concat(sps).concat([track.pps.length // numOfPictureParameterSets
      ]).concat(pps))),
          // "PPS"
      width = track.width,
          height = track.height;
      //console.log('avcc:' + Hex.hexDump(avcc));
      return MP4.box(MP4.types.avc1, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, // pre_defined
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      width >> 8 & 0xFF, width & 0xff, // width
      height >> 8 & 0xFF, height & 0xff, // height
      0x00, 0x48, 0x00, 0x00, // horizresolution
      0x00, 0x48, 0x00, 0x00, // vertresolution
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // frame_count
      0x12, 0x64, 0x61, 0x69, 0x6C, //dailymotion/hls.js
      0x79, 0x6D, 0x6F, 0x74, 0x69, 0x6F, 0x6E, 0x2F, 0x68, 0x6C, 0x73, 0x2E, 0x6A, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // compressorname
      0x00, 0x18, // depth = 24
      0x11, 0x11]), // pre_defined = -1
      avcc, MP4.box(MP4.types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
      0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
      0x00, 0x2d, 0xc6, 0xc0])) // avgBitrate
      );
    }
  }, {
    key: 'esds',
    value: function esds(track) {
      var configlen = track.config.length;
      return new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags

      0x03, // descriptor_type
      0x17 + configlen, // length
      0x00, 0x01, //es_id
      0x00, // stream_priority

      0x04, // descriptor_type
      0x0f + configlen, // length
      0x40, //codec : mpeg4_audio
      0x15, // stream_type
      0x00, 0x00, 0x00, // buffer_size
      0x00, 0x00, 0x00, 0x00, // maxBitrate
      0x00, 0x00, 0x00, 0x00, // avgBitrate

      0x05 // descriptor_type
      ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
    }
  }, {
    key: 'mp4a',
    value: function mp4a(track) {
      var audiosamplerate = track.audiosamplerate;
      return MP4.box(MP4.types.mp4a, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, track.channelCount, // channelcount
      0x00, 0x10, // sampleSize:16bits
      0x00, 0x00, 0x00, 0x00, // reserved2
      audiosamplerate >> 8 & 0xFF, audiosamplerate & 0xff, //
      0x00, 0x00]), MP4.box(MP4.types.esds, MP4.esds(track)));
    }
  }, {
    key: 'stsd',
    value: function stsd(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
      } else {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
      }
    }
  }, {
    key: 'tkhd',
    value: function tkhd(track) {
      var id = track.id,
          duration = track.duration * track.timescale,
          width = track.width,
          height = track.height;
      return MP4.box(MP4.types.tkhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x07, // flags
      0x00, 0x00, 0x00, 0x00, // creation_time
      0x00, 0x00, 0x00, 0x00, // modification_time
      id >> 24 & 0xFF, id >> 16 & 0xFF, id >> 8 & 0xFF, id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x00, // reserved
      duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, // layer
      0x00, 0x00, // alternate_group
      0x00, 0x00, // non-audio track volume
      0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      width >> 8 & 0xFF, width & 0xFF, 0x00, 0x00, // width
      height >> 8 & 0xFF, height & 0xFF, 0x00, 0x00 // height
      ]));
    }
  }, {
    key: 'traf',
    value: function traf(track, baseMediaDecodeTime) {
      var sampleDependencyTable = MP4.sdtp(track),
          id = track.id;
      return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF])), // track_ID
      MP4.box(MP4.types.tfdt, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      baseMediaDecodeTime >> 24, baseMediaDecodeTime >> 16 & 0XFF, baseMediaDecodeTime >> 8 & 0XFF, baseMediaDecodeTime & 0xFF])), // baseMediaDecodeTime
      MP4.trun(track, sampleDependencyTable.length + 16 + // tfhd
      16 + // tfdt
      8 + // traf header
      16 + // mfhd
      8 + // moof header
      8), // mdat header
      sampleDependencyTable);
    }

    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */

  }, {
    key: 'trak',
    value: function trak(track) {
      track.duration = track.duration || 0xffffffff;
      return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    }
  }, {
    key: 'trex',
    value: function trex(track) {
      var id = track.id;
      return MP4.box(MP4.types.trex, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x01, // default_sample_description_index
      0x00, 0x00, 0x00, 0x00, // default_sample_duration
      0x00, 0x00, 0x00, 0x00, // default_sample_size
      0x00, 0x01, 0x00, 0x01 // default_sample_flags
      ]));
    }
  }, {
    key: 'trun',
    value: function trun(track, offset) {
      var samples = track.samples || [],
          len = samples.length,
          arraylen = 12 + 16 * len,
          array = new Uint8Array(arraylen),
          i,
          sample,
          duration,
          size,
          flags,
          cts;
      offset += 8 + arraylen;
      array.set([0x00, // version 0
      0x00, 0x0f, 0x01, // flags
      len >>> 24 & 0xFF, len >>> 16 & 0xFF, len >>> 8 & 0xFF, len & 0xFF, // sample_count
      offset >>> 24 & 0xFF, offset >>> 16 & 0xFF, offset >>> 8 & 0xFF, offset & 0xFF // data_offset
      ], 0);
      for (i = 0; i < len; i++) {
        sample = samples[i];
        duration = sample.duration;
        size = sample.size;
        flags = sample.flags;
        cts = sample.cts;
        array.set([duration >>> 24 & 0xFF, duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, // sample_duration
        size >>> 24 & 0xFF, size >>> 16 & 0xFF, size >>> 8 & 0xFF, size & 0xFF, // sample_size
        flags.isLeading << 2 | flags.dependsOn, flags.isDependedOn << 6 | flags.hasRedundancy << 4 | flags.paddingValue << 1 | flags.isNonSync, flags.degradPrio & 0xF0 << 8, flags.degradPrio & 0x0F, // sample_flags
        cts >>> 24 & 0xFF, cts >>> 16 & 0xFF, cts >>> 8 & 0xFF, cts & 0xFF // sample_composition_time_offset
        ], 12 + 16 * i);
      }
      return MP4.box(MP4.types.trun, array);
    }
  }, {
    key: 'initSegment',
    value: function initSegment(tracks) {
      if (!MP4.types) {
        MP4.init();
      }
      var movie = MP4.moov(tracks),
          result;
      result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
      result.set(MP4.FTYP);
      result.set(movie, MP4.FTYP.byteLength);
      return result;
    }
  }]);

  return MP4;
}();

exports.default = MP4;

},{}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * fMP4 remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _logger = require('../utils/logger');

var _mp4Generator = require('../remux/mp4-generator');

var _mp4Generator2 = _interopRequireDefault(_mp4Generator);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MP4Remuxer = function () {
  function MP4Remuxer(observer) {
    _classCallCheck(this, MP4Remuxer);

    this.observer = observer;
    this.ISGenerated = false;
    this.PES2MP4SCALEFACTOR = 4;
    this.PES_TIMESCALE = 90000;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
  }

  _createClass(MP4Remuxer, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this._initPTS = this._initDTS = this.nextAacPts = this.nextAvcDts = undefined;
    }
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'remux',
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, data, t0) {
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        this.generateIS(audioTrack, videoTrack, timeOffset, t0);
      }
      if (this.ISGenerated) {
        //logger.log('nb AVC samples:' + videoTrack.samples.length);
        if (videoTrack.samples.length) {
          this.remuxVideo(videoTrack, timeOffset, contiguous, t0);
        }
        //logger.log('nb AAC samples:' + audioTrack.samples.length);
        if (audioTrack.samples.length) {
          this.remuxAudio(audioTrack, timeOffset, contiguous);
        }
        //logger.log('nb ID3 samples:' + audioTrack.samples.length);
        if (id3Track.samples.length) {
          this.remuxID3(id3Track, timeOffset);
        }
        //logger.log('nb ID3 samples:' + audioTrack.samples.length);
        if (textTrack.samples.length) {
          this.remuxText(textTrack, timeOffset);
        }
      }
      //notify end of parsing
      this.observer.trigger(_events2.default.FRAG_PARSED);
    }
  }, {
    key: 'generateIS',
    value: function generateIS(audioTrack, videoTrack, timeOffset, t0) {
      var observer = this.observer,
          audioSamples = audioTrack.samples,
          videoSamples = videoTrack.samples,
          pesTimeScale = this.PES_TIMESCALE,
          tracks = {},
          data = { tracks: tracks, unique: false },
          computePTSDTS = this._initPTS === undefined,
          initPTS,
          initDTS;

      if (computePTSDTS) {
        initPTS = initDTS = Infinity;
      }
      if (audioTrack.config && audioSamples.length) {
        audioTrack.timescale = audioTrack.audiosamplerate;
        // MP4 duration (track duration in seconds multiplied by timescale) is coded on 32 bits
        // we know that each AAC sample contains 1024 frames....
        // in order to avoid overflowing the 32 bit counter for large duration, we use smaller timescale (timescale/gcd)
        // we just need to ensure that AAC sample duration will still be an integer (will be 1024/gcd)
        if (audioTrack.timescale * audioTrack.duration > Math.pow(2, 32)) {
          (function () {
            var greatestCommonDivisor = function greatestCommonDivisor(a, b) {
              if (!b) {
                return a;
              }
              return greatestCommonDivisor(b, a % b);
            };
            audioTrack.timescale = audioTrack.audiosamplerate / greatestCommonDivisor(audioTrack.audiosamplerate, 1024);
          })();
        }
        _logger.logger.log('audio mp4 timescale :' + audioTrack.timescale);
        tracks.audio = {
          container: 'audio/mp4',
          codec: audioTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([audioTrack]),
          metadata: {
            channelCount: audioTrack.channelCount
          }
        };
        if (computePTSDTS) {
          // remember first PTS of this demuxing context. for audio, PTS + DTS ...
          // initPTS = initDTS = audioSamples[0].pts - pesTimeScale * timeOffset;
          initPTS = initDTS = t0 * pesTimeScale;
          // if (timeOffset != t0) debugger;
        }
      }

      if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
        videoTrack.timescale = this.MP4_TIMESCALE;
        tracks.video = {
          container: 'video/mp4',
          codec: videoTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([videoTrack]),
          metadata: {
            width: videoTrack.width,
            height: videoTrack.height
          }
        };
        if (computePTSDTS) {
          initPTS = Math.min(initPTS, videoSamples[0].pts - pesTimeScale * timeOffset);
          initDTS = Math.min(initDTS, videoSamples[0].dts - pesTimeScale * timeOffset);
        }
      }

      if (!Object.keys(tracks)) {
        observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found' });
      } else {
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
        this.ISGenerated = true;
        if (computePTSDTS) {
          // this._initPTS = t0*pesTimeScale;//initPTS;
          // this._initDTS = t0*pesTimeScale;//initDTS;

          console.info("!!");
          this._initPTS = initPTS;
          this._initDTS = initDTS;
          console.info('initPTS: ' + initPTS + ' t0*90000: ' + t0 * 90000);
        }
      }
    }
  }, {
    key: 'remuxVideo',
    value: function remuxVideo(track, timeOffset, contiguous, t0) {
      var offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          mp4SampleDuration,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastPTS,
          lastDTS,
          inputSamples = track.samples,
          outputSamples = [];

      // PTS is coded on 33bits, and can loop from -2^32 to 2^32
      // PTSNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
      var nextAvcDts = void 0;
      if (contiguous) {
        // if parsed fragment is contiguous with last one, let's use last DTS value as reference
        nextAvcDts = this.nextAvcDts;
      } else {
        // if not contiguous, let's use target timeOffset
        nextAvcDts = t0 * pesTimeScale;
      }

      // compute first DTS and last DTS, normalize them against reference value
      var sample = inputSamples[0];
      // firstDTS =  Math.max(this._PTSNormalize(sample.dts,nextAvcDts) - this._initDTS,0);
      // firstPTS =  Math.max(this._PTSNormalize(sample.pts,nextAvcDts) - this._initDTS,0);

      firstDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);
      firstPTS = Math.max(this._PTSNormalize(sample.pts, nextAvcDts) - this._initDTS, 0);

      var firstSampleDTS = sample.dts;
      firstPTS = firstDTS = Math.round(t0 * pesTimeScale);
      console.info('firstPTS #1: ' + firstPTS);

      // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
      //     let delta = Math.round((firstDTS - nextAvcDts) / 90);
      //
      //     // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
      //     if (contiguous || Math.abs(delta) < 600) {
      //       if (delta) {
      //         if (delta > 1) {
      //           logger.log(`AVC:${delta} ms hole between fragments detected,filling it`);
      //         } else if (delta < -1) {
      //           logger.log(`AVC:${(-delta)} ms overlapping between fragments detected`);
      //         }
      //         // remove hole/gap : set DTS to next expected DTS
      //         firstDTS = inputSamples[0].dts = nextAvcDts;
      //         // offset PTS as well, ensure that PTS is smaller or equal than new DTS
      //         firstPTS = inputSamples[0].pts = Math.max(firstPTS - delta, nextAvcDts);
      //         logger.log(`Video/PTS/DTS adjusted: ${firstPTS}/${firstDTS},delta:${delta}`);
      //       }
      //     }
      // 	console.info( 'firstPTS #2: ' + firstPTS );

      // sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
      // let's signal the same sample duration for all samples
      // set this constant duration as being the avg delta between consecutive DTS.
      sample = inputSamples[inputSamples.length - 1];
      lastDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);

      lastDTS = sample.dts - firstSampleDTS + firstPTS;
      mp4SampleDuration = Math.round((lastDTS - firstDTS) / (pes2mp4ScaleFactor * (inputSamples.length - 1)));

      if (lastDTS <= firstDTS) {
        debugger;
        lastDTS = firstDTS;
        mp4SampleDuration = 0;
        console.warn('lastDTS < firstDTS');
      };
      console.info('( lastDTS - firstDTS ) / 90000 : ' + (lastDTS - firstDTS) / 90000);
      var oldPTS = firstPTS;
      // firstPTS = firstDTS = Math.round(t0*90000);
      console.log('firstPTS: ' + oldPTS + ' -> ' + t0 * 90000);
      if (Math.abs(oldPTS - firstPTS) > 10000) console.warn('this could have caused a fragLoop error');

      // normalize all PTS/DTS now ...
      for (var i = 0; i < inputSamples.length; i++) {
        var _sample = inputSamples[i];
        // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
        _sample.dts = firstDTS + i * pes2mp4ScaleFactor * mp4SampleDuration;
        // we normalize PTS against nextAvcDts, we also substract initDTS (some streams don't start @ PTS O)
        // and we ensure that computed value is greater or equal than sample DTS
        // sample.pts = Math.max(this._PTSNormalize(sample.pts,nextAvcDts) - this._initDTS, sample.dts);
        _sample.pts = _sample.dts;
      }
      lastPTS = inputSamples[inputSamples.length - 1].pts;

      /* concatenate the video data and construct the mdat in place
        (need 8 more bytes to fill length and mpdat type) */
      mdat = new Uint8Array(track.len + 4 * track.nbNalu + 8);
      var view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_mp4Generator2.default.types.mdat, 4);
      while (inputSamples.length) {
        var avcSample = inputSamples.shift(),
            mp4SampleLength = 0;
        // convert NALU bitstream to MP4 format (prepend NALU with size field)
        while (avcSample.units.units.length) {
          var unit = avcSample.units.units.shift();
          view.setUint32(offset, unit.data.byteLength);
          offset += 4;
          mdat.set(unit.data, offset);
          offset += unit.data.byteLength;
          mp4SampleLength += 4 + unit.data.byteLength;
        }
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
        outputSamples.push({
          size: mp4SampleLength,
          // constant duration
          duration: mp4SampleDuration,
          // set composition time offset as a multiple of sample duration
          cts: Math.max(0, mp4SampleDuration * Math.round((avcSample.pts - avcSample.dts) / (pes2mp4ScaleFactor * mp4SampleDuration))),
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: avcSample.key ? 2 : 1,
            isNonSync: avcSample.key ? 0 : 1
          }
        });
      }
      // next AVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
      this.nextAvcDts = lastDTS + mp4SampleDuration * pes2mp4ScaleFactor;
      track.len = 0;
      track.nbNalu = 0;
      if (outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        var flags = outputSamples[0].flags;
        // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
        // https://code.google.com/p/chromium/issues/detail?id=229412
        flags.dependsOn = 2;
        flags.isNonSync = 0;
      }
      track.samples = outputSamples;
      // if (firstDTS/pesTimeScale > 100000) { debugger; }
      moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];
      this.observer.trigger(_events2.default.FRAG_PARSING_DATA, {
        data1: moof,
        data2: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: (lastPTS + pes2mp4ScaleFactor * mp4SampleDuration) / pesTimeScale,
        startDTS: firstDTS / pesTimeScale,
        endDTS: this.nextAvcDts / pesTimeScale,
        type: 'video',
        nb: outputSamples.length
      });
    }
  }, {
    key: 'remuxAudio',
    value: function remuxAudio(track, timeOffset, contiguous) {
      var view,
          offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          expectedSampleDuration = track.timescale * 1024 / track.audiosamplerate,
          aacSample,
          mp4Sample,
          unit,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          samples = [],
          samples0 = [];

      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });
      samples0 = track.samples;

      while (samples0.length) {
        aacSample = samples0.shift();
        unit = aacSample.unit;
        pts = aacSample.pts - this._initDTS;
        dts = aacSample.dts - this._initDTS;
        //logger.log(`Audio/PTS:${Math.round(pts/90)}`);
        // if not first sample
        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          // let's compute sample duration.
          // sample Duration should be close to expectedSampleDuration
          mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (Math.abs(mp4Sample.duration - expectedSampleDuration) > expectedSampleDuration / 10) {
            // more than 10% diff between sample duration and expectedSampleDuration .... lets log that
            _logger.logger.trace('invalid AAC sample duration at PTS ' + Math.round(pts / 90) + ',should be 1024,found :' + Math.round(mp4Sample.duration * track.audiosamplerate / track.timescale));
          }
          // always adjust sample duration to avoid av sync issue
          mp4Sample.duration = expectedSampleDuration;
          dtsnorm = expectedSampleDuration * pes2mp4ScaleFactor + lastDTS;
        } else {
          var nextAacPts = void 0,
              delta = void 0;
          if (contiguous) {
            nextAacPts = this.nextAacPts;
          } else {
            nextAacPts = timeOffset * pesTimeScale;
          }
          ptsnorm = this._PTSNormalize(pts, nextAacPts);
          dtsnorm = this._PTSNormalize(dts, nextAacPts);
          delta = Math.round(1000 * (ptsnorm - nextAacPts) / pesTimeScale);
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (contiguous || Math.abs(delta) < 600) {
            // log delta
            if (delta) {
              if (delta > 0) {
                _logger.logger.log(delta + ' ms hole between AAC samples detected,filling it');
                // if we have frame overlap, overlapping for more than half a frame duraion
              } else if (delta < -12) {
                  // drop overlapping audio frames... browser will deal with it
                  _logger.logger.log(-delta + ' ms overlapping between AAC samples detected, drop frame');
                  track.len -= unit.byteLength;
                  continue;
                }
              // set DTS to next DTS
              ptsnorm = dtsnorm = nextAacPts;
            }
          }
          // remember first PTS of our aacSamples, ensure value is positive
          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
          if (track.len > 0) {
            /* concatenate the audio data and construct the mdat in place
              (need 8 more bytes to fill length and mdat type) */
            mdat = new Uint8Array(track.len + 8);
            view = new DataView(mdat.buffer);
            view.setUint32(0, mdat.byteLength);
            mdat.set(_mp4Generator2.default.types.mdat, 4);
          } else {
            // no audio samples
            return;
          }
        }
        mdat.set(unit, offset);
        offset += unit.byteLength;
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${aacSample.pts}/${aacSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(aacSample.pts/4294967296).toFixed(3)}');
        mp4Sample = {
          size: unit.byteLength,
          cts: 0,
          duration: 0,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: 1
          }
        };
        samples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      var lastSampleDuration = 0;
      var nbSamples = samples.length;
      //set last sample duration as being identical to previous sample
      if (nbSamples >= 2) {
        lastSampleDuration = samples[nbSamples - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
      if (nbSamples) {
        // next aac sample PTS should be equal to last sample PTS + duration
        this.nextAacPts = ptsnorm + pes2mp4ScaleFactor * lastSampleDuration;
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
        track.len = 0;
        track.samples = samples;
        moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
        track.samples = [];
        this.observer.trigger(_events2.default.FRAG_PARSING_DATA, {
          data1: moof,
          data2: mdat,
          startPTS: firstPTS / pesTimeScale,
          endPTS: this.nextAacPts / pesTimeScale,
          startDTS: firstDTS / pesTimeScale,
          endDTS: (dtsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
          type: 'audio',
          nb: nbSamples
        });
      }
    }
  }, {
    key: 'remuxID3',
    value: function remuxID3(track, timeOffset) {
      var length = track.samples.length,
          sample;
      // consume samples
      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];
          // setting id3 pts, dts to relative time
          // using this._initPTS and this._initDTS to calculate relative time
          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
          sample.dts = (sample.dts - this._initDTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2.default.FRAG_PARSING_METADATA, {
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: 'remuxText',
    value: function remuxText(track, timeOffset) {
      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });

      var length = track.samples.length,
          sample;
      // consume samples
      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];
          // setting text pts, dts to relative time
          // using this._initPTS and this._initDTS to calculate relative time
          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2.default.FRAG_PARSING_USERDATA, {
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: '_PTSNormalize',
    value: function _PTSNormalize(value, reference) {
      var offset;
      if (reference === undefined) {
        return value;
      }
      if (reference < value) {
        // - 2^33
        offset = -8589934592;
      } else {
        // + 2^33
        offset = 8589934592;
      }
      /* PTS is 33bit (from 0 to 2^33 -1)
        if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
        PTS looping occured. fill the gap */
      while (Math.abs(value - reference) > 4294967296) {
        value += offset;
      }
      return value;
    }
  }, {
    key: 'passthrough',
    get: function get() {
      return false;
    }
  }]);

  return MP4Remuxer;
}();

exports.default = MP4Remuxer;

},{"../errors":20,"../events":22,"../remux/mp4-generator":30,"../utils/logger":36}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * passthrough remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */


var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PassThroughRemuxer = function () {
  function PassThroughRemuxer(observer) {
    _classCallCheck(this, PassThroughRemuxer);

    this.observer = observer;
    this.ISGenerated = false;
  }

  _createClass(PassThroughRemuxer, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {}
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'remux',
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, rawData) {
      var observer = this.observer;
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        var tracks = {},
            data = { tracks: tracks, unique: true },
            track = videoTrack,
            codec = track.codec;

        if (codec) {
          data.tracks.video = {
            container: track.container,
            codec: codec,
            metadata: {
              width: track.width,
              height: track.height
            }
          };
        }

        track = audioTrack;
        codec = track.codec;
        if (codec) {
          data.tracks.audio = {
            container: track.container,
            codec: codec,
            metadata: {
              channelCount: track.channelCount
            }
          };
        }
        this.ISGenerated = true;
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
      }
      observer.trigger(_events2.default.FRAG_PARSING_DATA, {
        data1: rawData,
        startPTS: timeOffset,
        startDTS: timeOffset,
        type: 'audiovideo',
        nb: 1
      });
    }
  }, {
    key: 'passthrough',
    get: function get() {
      return true;
    }
  }]);

  return PassThroughRemuxer;
}();

exports.default = PassThroughRemuxer;

},{"../events":22}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js

var AttrList = function () {
  function AttrList(attrs) {
    _classCallCheck(this, AttrList);

    if (typeof attrs === 'string') {
      attrs = AttrList.parseAttrList(attrs);
    }
    for (var attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        this[attr] = attrs[attr];
      }
    }
  }

  _createClass(AttrList, [{
    key: 'decimalInteger',
    value: function decimalInteger(attrName) {
      var intValue = parseInt(this[attrName], 10);
      if (intValue > Number.MAX_SAFE_INTEGER) {
        return Infinity;
      }
      return intValue;
    }
  }, {
    key: 'hexadecimalInteger',
    value: function hexadecimalInteger(attrName) {
      if (this[attrName]) {
        var stringValue = (this[attrName] || '0x').slice(2);
        stringValue = (stringValue.length & 1 ? '0' : '') + stringValue;

        var value = new Uint8Array(stringValue.length / 2);
        for (var i = 0; i < stringValue.length / 2; i++) {
          value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
        }
        return value;
      } else {
        return null;
      }
    }
  }, {
    key: 'hexadecimalIntegerAsNumber',
    value: function hexadecimalIntegerAsNumber(attrName) {
      var intValue = parseInt(this[attrName], 16);
      if (intValue > Number.MAX_SAFE_INTEGER) {
        return Infinity;
      }
      return intValue;
    }
  }, {
    key: 'decimalFloatingPoint',
    value: function decimalFloatingPoint(attrName) {
      return parseFloat(this[attrName]);
    }
  }, {
    key: 'enumeratedString',
    value: function enumeratedString(attrName) {
      return this[attrName];
    }
  }, {
    key: 'decimalResolution',
    value: function decimalResolution(attrName) {
      var res = /^(\d+)x(\d+)$/.exec(this[attrName]);
      if (res === null) {
        return undefined;
      }
      return {
        width: parseInt(res[1], 10),
        height: parseInt(res[2], 10)
      };
    }
  }], [{
    key: 'parseAttrList',
    value: function parseAttrList(input) {
      var re = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g;
      var match,
          attrs = {};
      while ((match = re.exec(input)) !== null) {
        var value = match[2],
            quote = '"';

        if (value.indexOf(quote) === 0 && value.lastIndexOf(quote) === value.length - 1) {
          value = value.slice(1, -1);
        }
        attrs[match[1]] = value;
      }
      return attrs;
    }
  }]);

  return AttrList;
}();

exports.default = AttrList;

},{}],34:[function(require,module,exports){
"use strict";

var BinarySearch = {
    /**
     * Searches for an item in an array which matches a certain condition.
     * This requires the condition to only match one item in the array,
     * and for the array to be ordered.
     *
     * @param {Array} list The array to search.
     * @param {Function} comparisonFunction
     *      Called and provided a candidate item as the first argument.
     *      Should return:
     *          > -1 if the item should be located at a lower index than the provided item.
     *          > 1 if the item should be located at a higher index than the provided item.
     *          > 0 if the item is the item you're looking for.
     *
     * @return {*} The object if it is found or null otherwise.
     */
    search: function search(list, comparisonFunction) {
        var minIndex = 0;
        var maxIndex = list.length - 1;
        var currentIndex = null;
        var currentElement = null;

        while (minIndex <= maxIndex) {
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            currentElement = list[currentIndex];

            var comparisonResult = comparisonFunction(currentElement);
            if (comparisonResult > 0) {
                minIndex = currentIndex + 1;
            } else if (comparisonResult < 0) {
                maxIndex = currentIndex - 1;
            } else {
                return currentElement;
            }
        }

        return null;
    }
};

module.exports = BinarySearch;

},{}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * CEA-708 interpreter
*/

var CEA708Interpreter = function () {
  function CEA708Interpreter() {
    _classCallCheck(this, CEA708Interpreter);
  }

  _createClass(CEA708Interpreter, [{
    key: 'attach',
    value: function attach(media) {
      this.media = media;
      this.display = [];
      this.memory = [];
    }
  }, {
    key: 'detach',
    value: function detach() {
      this.clear();
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: '_createCue',
    value: function _createCue() {
      var VTTCue = window.VTTCue || window.TextTrackCue;

      var cue = this.cue = new VTTCue(-1, -1, '');
      cue.text = '';
      cue.pauseOnExit = false;

      // make sure it doesn't show up before it's ready
      cue.startTime = Number.MAX_VALUE;

      // show it 'forever' once we do show it
      // (we'll set the end time once we know it later)
      cue.endTime = Number.MAX_VALUE;

      this.memory.push(cue);
    }
  }, {
    key: 'clear',
    value: function clear() {
      var textTrack = this._textTrack;
      if (textTrack && textTrack.cues) {
        while (textTrack.cues.length > 0) {
          textTrack.removeCue(textTrack.cues[0]);
        }
      }
    }
  }, {
    key: 'push',
    value: function push(timestamp, bytes) {
      if (!this.cue) {
        this._createCue();
      }

      var count = bytes[0] & 31;
      var position = 2;
      var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;

      for (var j = 0; j < count; j++) {
        tmpByte = bytes[position++];
        ccbyte1 = 0x7F & bytes[position++];
        ccbyte2 = 0x7F & bytes[position++];
        ccValid = (4 & tmpByte) === 0 ? false : true;
        ccType = 3 & tmpByte;

        if (ccbyte1 === 0 && ccbyte2 === 0) {
          continue;
        }

        if (ccValid) {
          if (ccType === 0) // || ccType === 1
            {
              // Standard Characters
              if (0x20 & ccbyte1 || 0x40 & ccbyte1) {
                this.cue.text += this._fromCharCode(ccbyte1) + this._fromCharCode(ccbyte2);
              }
              // Special Characters
              else if ((ccbyte1 === 0x11 || ccbyte1 === 0x19) && ccbyte2 >= 0x30 && ccbyte2 <= 0x3F) {
                  // extended chars, e.g. musical note, accents
                  switch (ccbyte2) {
                    case 48:
                      this.cue.text += '®';
                      break;
                    case 49:
                      this.cue.text += '°';
                      break;
                    case 50:
                      this.cue.text += '½';
                      break;
                    case 51:
                      this.cue.text += '¿';
                      break;
                    case 52:
                      this.cue.text += '™';
                      break;
                    case 53:
                      this.cue.text += '¢';
                      break;
                    case 54:
                      this.cue.text += '';
                      break;
                    case 55:
                      this.cue.text += '£';
                      break;
                    case 56:
                      this.cue.text += '♪';
                      break;
                    case 57:
                      this.cue.text += ' ';
                      break;
                    case 58:
                      this.cue.text += 'è';
                      break;
                    case 59:
                      this.cue.text += 'â';
                      break;
                    case 60:
                      this.cue.text += 'ê';
                      break;
                    case 61:
                      this.cue.text += 'î';
                      break;
                    case 62:
                      this.cue.text += 'ô';
                      break;
                    case 63:
                      this.cue.text += 'û';
                      break;
                  }
                }
              if ((ccbyte1 === 0x11 || ccbyte1 === 0x19) && ccbyte2 >= 0x20 && ccbyte2 <= 0x2F) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x20:
                    // White
                    break;
                  case 0x21:
                    // White Underline
                    break;
                  case 0x22:
                    // Green
                    break;
                  case 0x23:
                    // Green Underline
                    break;
                  case 0x24:
                    // Blue
                    break;
                  case 0x25:
                    // Blue Underline
                    break;
                  case 0x26:
                    // Cyan
                    break;
                  case 0x27:
                    // Cyan Underline
                    break;
                  case 0x28:
                    // Red
                    break;
                  case 0x29:
                    // Red Underline
                    break;
                  case 0x2A:
                    // Yellow
                    break;
                  case 0x2B:
                    // Yellow Underline
                    break;
                  case 0x2C:
                    // Magenta
                    break;
                  case 0x2D:
                    // Magenta Underline
                    break;
                  case 0x2E:
                    // Italics
                    break;
                  case 0x2F:
                    // Italics Underline
                    break;
                }
              }
              if ((ccbyte1 === 0x14 || ccbyte1 === 0x1C) && ccbyte2 >= 0x20 && ccbyte2 <= 0x2F) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x20:
                    // TODO: shouldn't affect roll-ups...
                    this._clearActiveCues(timestamp);
                    // RCL: Resume Caption Loading
                    // begin pop on
                    break;
                  case 0x21:
                    // BS: Backspace
                    this.cue.text = this.cue.text.substr(0, this.cue.text.length - 1);
                    break;
                  case 0x22:
                    // AOF: reserved (formerly alarm off)
                    break;
                  case 0x23:
                    // AON: reserved (formerly alarm on)
                    break;
                  case 0x24:
                    // DER: Delete to end of row
                    break;
                  case 0x25:
                    // RU2: roll-up 2 rows
                    //this._rollup(2);
                    break;
                  case 0x26:
                    // RU3: roll-up 3 rows
                    //this._rollup(3);
                    break;
                  case 0x27:
                    // RU4: roll-up 4 rows
                    //this._rollup(4);
                    break;
                  case 0x28:
                    // FON: Flash on
                    break;
                  case 0x29:
                    // RDC: Resume direct captioning
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2A:
                    // TR: Text Restart
                    break;
                  case 0x2B:
                    // RTD: Resume Text Display
                    break;
                  case 0x2C:
                    // EDM: Erase Displayed Memory
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2D:
                    // CR: Carriage Return
                    // only affects roll-up
                    //this._rollup(1);
                    break;
                  case 0x2E:
                    // ENM: Erase non-displayed memory
                    this._text = '';
                    break;
                  case 0x2F:
                    this._flipMemory(timestamp);
                    // EOC: End of caption
                    // hide any displayed captions and show any hidden one
                    break;
                }
              }
              if ((ccbyte1 === 0x17 || ccbyte1 === 0x1F) && ccbyte2 >= 0x21 && ccbyte2 <= 0x23) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x21:
                    // TO1: tab offset 1 column
                    break;
                  case 0x22:
                    // TO1: tab offset 2 column
                    break;
                  case 0x23:
                    // TO1: tab offset 3 column
                    break;
                }
              } else {
                // Probably a pre-amble address code
              }
            }
        }
      }
    }
  }, {
    key: '_fromCharCode',
    value: function _fromCharCode(tmpByte) {
      switch (tmpByte) {
        case 42:
          return 'á';

        case 2:
          return 'á';

        case 2:
          return 'é';

        case 4:
          return 'í';

        case 5:
          return 'ó';

        case 6:
          return 'ú';

        case 3:
          return 'ç';

        case 4:
          return '÷';

        case 5:
          return 'Ñ';

        case 6:
          return 'ñ';

        case 7:
          return '█';

        default:
          return String.fromCharCode(tmpByte);
      }
    }
  }, {
    key: '_flipMemory',
    value: function _flipMemory(timestamp) {
      this._clearActiveCues(timestamp);
      this._flushCaptions(timestamp);
    }
  }, {
    key: '_flushCaptions',
    value: function _flushCaptions(timestamp) {
      if (!this._has708) {
        this._textTrack = this.media.addTextTrack('captions', 'English', 'en');
        this._has708 = true;
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.memory[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var memoryItem = _step.value;

          memoryItem.startTime = timestamp;
          this._textTrack.addCue(memoryItem);
          this.display.push(memoryItem);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      this.memory = [];
      this.cue = null;
    }
  }, {
    key: '_clearActiveCues',
    value: function _clearActiveCues(timestamp) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.display[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var displayItem = _step2.value;

          displayItem.endTime = timestamp;
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      this.display = [];
    }

    /*  _rollUp(n)
      {
        // TODO: implement roll-up captions
      }
    */

  }, {
    key: '_clearBufferedCues',
    value: function _clearBufferedCues() {
      //remove them all...
    }
  }]);

  return CEA708Interpreter;
}();

exports.default = CEA708Interpreter;

},{}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

function noop() {}

var fakeLogger = {
  trace: noop,
  debug: noop,
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};

var exportedLogger = fakeLogger;

//let lastCallTime;
// function formatMsgWithTimeInfo(type, msg) {
//   const now = Date.now();
//   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
//   lastCallTime = now;
//   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
//   return msg;
// }

function formatMsg(type, msg) {
  msg = '[' + type + '] > ' + msg;
  return msg;
}

function consolePrintFn(type) {
  var func = window.console[type];
  if (func) {
    return function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      if (args[0]) {
        args[0] = formatMsg(type, args[0]);
      }
      func.apply(window.console, args);
    };
  }
  return noop;
}

function exportLoggerFunctions(debugConfig) {
  for (var _len2 = arguments.length, functions = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    functions[_key2 - 1] = arguments[_key2];
  }

  functions.forEach(function (type) {
    exportedLogger[type] = debugConfig[type] ? debugConfig[type].bind(debugConfig) : consolePrintFn(type);
  });
}

var enableLogs = exports.enableLogs = function enableLogs(debugConfig) {
  if (debugConfig === true || (typeof debugConfig === 'undefined' ? 'undefined' : _typeof(debugConfig)) === 'object') {
    exportLoggerFunctions(debugConfig,
    // Remove out from list here to hard-disable a log-level
    //'trace',
    'debug', 'log', 'info', 'warn', 'error');
    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log();
    } catch (e) {
      exportedLogger = fakeLogger;
    }
  } else {
    exportedLogger = fakeLogger;
  }
};

var logger = exports.logger = exportedLogger;

},{}],37:[function(require,module,exports){
'use strict';

var URLHelper = {

  // build an absolute URL from a relative one using the provided baseURL
  // if relativeURL is an absolute URL it will be returned as is.
  buildAbsoluteURL: function buildAbsoluteURL(baseURL, relativeURL) {
    // remove any remaining space and CRLF
    relativeURL = relativeURL.trim();
    if (/^[a-z]+:/i.test(relativeURL)) {
      // complete url, not relative
      return relativeURL;
    }

    var relativeURLQuery = null;
    var relativeURLHash = null;

    var relativeURLHashSplit = /^([^#]*)(.*)$/.exec(relativeURL);
    if (relativeURLHashSplit) {
      relativeURLHash = relativeURLHashSplit[2];
      relativeURL = relativeURLHashSplit[1];
    }
    var relativeURLQuerySplit = /^([^\?]*)(.*)$/.exec(relativeURL);
    if (relativeURLQuerySplit) {
      relativeURLQuery = relativeURLQuerySplit[2];
      relativeURL = relativeURLQuerySplit[1];
    }

    var baseURLHashSplit = /^([^#]*)(.*)$/.exec(baseURL);
    if (baseURLHashSplit) {
      baseURL = baseURLHashSplit[1];
    }
    var baseURLQuerySplit = /^([^\?]*)(.*)$/.exec(baseURL);
    if (baseURLQuerySplit) {
      baseURL = baseURLQuerySplit[1];
    }

    var baseURLDomainSplit = /^((([a-z]+):)?\/\/[a-z0-9\.\-_~]+(:[0-9]+)?\/)(.*)$/i.exec(baseURL);
    var baseURLProtocol = baseURLDomainSplit[3];
    var baseURLDomain = baseURLDomainSplit[1];
    var baseURLPath = baseURLDomainSplit[5];

    var builtURL = null;
    if (/^\/\//.test(relativeURL)) {
      builtURL = baseURLProtocol + '://' + URLHelper.buildAbsolutePath('', relativeURL.substring(2));
    } else if (/^\//.test(relativeURL)) {
      builtURL = baseURLDomain + URLHelper.buildAbsolutePath('', relativeURL.substring(1));
    } else {
      builtURL = URLHelper.buildAbsolutePath(baseURLDomain + baseURLPath, relativeURL);
    }

    // put the query and hash parts back
    if (relativeURLQuery) {
      builtURL += relativeURLQuery;
    }
    if (relativeURLHash) {
      builtURL += relativeURLHash;
    }
    return builtURL;
  },

  // build an absolute path using the provided basePath
  // adapted from https://developer.mozilla.org/en-US/docs/Web/API/document/cookie#Using_relative_URLs_in_the_path_parameter
  // this does not handle the case where relativePath is "/" or "//". These cases should be handled outside this.
  buildAbsolutePath: function buildAbsolutePath(basePath, relativePath) {
    var sRelPath = relativePath;
    var nUpLn,
        sDir = '',
        sPath = basePath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, '$1'));
    for (var nEnd, nStart = 0; nEnd = sPath.indexOf('/../', nStart), nEnd > -1; nStart = nEnd + nUpLn) {
      nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
      sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp('(?:\\\/+[^\\\/]*){0,' + (nUpLn - 1) / 3 + '}$'), '/');
    }
    return sDir + sPath.substr(nStart);
  }
};

module.exports = URLHelper;

},{}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * XHR based logger
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var XhrLoader = function () {
  function XhrLoader(config) {
    _classCallCheck(this, XhrLoader);

    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  _createClass(XhrLoader, [{
    key: 'destroy',
    value: function destroy() {
      this.abort();
      this.loader = null;
    }
  }, {
    key: 'abort',
    value: function abort() {
      var loader = this.loader,
          timeoutHandle = this.timeoutHandle;
      if (loader && loader.readyState !== 4) {
        this.stats.aborted = true;
        loader.abort();
      }
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    }
  }, {
    key: 'load',
    value: function load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay) {
      var onProgress = arguments.length <= 8 || arguments[8] === undefined ? null : arguments[8];
      var frag = arguments.length <= 9 || arguments[9] === undefined ? null : arguments[9];

      this.url = url;
      if (frag && !isNaN(frag.byteRangeStartOffset) && !isNaN(frag.byteRangeEndOffset)) {
        this.byteRange = frag.byteRangeStartOffset + '-' + (frag.byteRangeEndOffset - 1);
      }
      this.responseType = responseType;
      this.onSuccess = onSuccess;
      this.onProgress = onProgress;
      this.onTimeout = onTimeout;
      this.onError = onError;
      this.stats = { trequest: performance.now(), retry: 0 };
      this.timeout = timeout;
      this.maxRetry = maxRetry;
      this.retryDelay = retryDelay;
      this.loadInternal();
    }
  }, {
    key: 'loadInternal',
    value: function loadInternal() {
      var xhr;

      if (typeof XDomainRequest !== 'undefined') {
        xhr = this.loader = new XDomainRequest();
      } else {
        xhr = this.loader = new XMLHttpRequest();
      }

      xhr.onloadend = this.loadend.bind(this);
      xhr.onprogress = this.loadprogress.bind(this);

      xhr.open('GET', this.url, true);
      if (this.byteRange) {
        xhr.setRequestHeader('Range', 'bytes=' + this.byteRange);
      }
      xhr.responseType = this.responseType;
      this.stats.tfirst = null;
      this.stats.loaded = 0;
      if (this.xhrSetup) {
        this.xhrSetup(xhr, this.url);
      }
      this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this), this.timeout);
      xhr.send();
    }
  }, {
    key: 'loadend',
    value: function loadend(event) {
      var xhr = event.currentTarget,
          status = xhr.status,
          stats = this.stats;
      // don't proceed if xhr has been aborted
      if (!stats.aborted) {
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300) {
          window.clearTimeout(this.timeoutHandle);
          stats.tload = performance.now();
          this.onSuccess(event, stats);
        } else {
          // error ...
          if (stats.retry < this.maxRetry) {
            _logger.logger.warn(status + ' while loading ' + this.url + ', retrying in ' + this.retryDelay + '...');
            this.destroy();
            window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, 64000);
            stats.retry++;
          } else {
            window.clearTimeout(this.timeoutHandle);
            _logger.logger.error(status + ' while loading ' + this.url);
            this.onError(event);
          }
        }
      }
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(event) {
      _logger.logger.warn('timeout while loading ' + this.url);
      this.onTimeout(event, this.stats);
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event) {
      var stats = this.stats;
      if (stats.tfirst === null) {
        stats.tfirst = performance.now();
      }
      stats.loaded = event.loaded;
      if (this.onProgress) {
        this.onProgress(event, stats);
      }
    }
  }]);

  return XhrLoader;
}();

exports.default = XhrLoader;

},{"../utils/logger":36}]},{},[26])(26)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwic3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCJzcmMvY29udHJvbGxlci9idWZmZXItY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL2NhcC1sZXZlbC1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlci5qcyIsInNyYy9jcnlwdC9hZXMuanMiLCJzcmMvY3J5cHQvYWVzMTI4LWRlY3J5cHRlci5qcyIsInNyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCJzcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsInNyYy9kZW11eC9hZHRzLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXIuanMiLCJzcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsInNyYy9kZW11eC9pZDMuanMiLCJzcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9ldmVudC1oYW5kbGVyLmpzIiwic3JjL2V2ZW50cy5qcyIsInNyYy9oZWxwZXIvYnVmZmVyLWhlbHBlci5qcyIsInNyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwic3JjL2hscy5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwic3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwic3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCJzcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsInNyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsInNyYy9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyLmpzIiwic3JjL3V0aWxzL2F0dHItbGlzdC5qcyIsInNyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwic3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCJzcmMvdXRpbHMvbG9nZ2VyLmpzIiwic3JjL3V0aWxzL3VybC5qcyIsInNyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtB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QUFOLEdBTitCO1dBQWpDLE1BT087QUFDTCxtQkFBTyxZQUFQLENBQW9CLEtBQUssYUFBTCxDQUFwQixDQURLO0FBRUwsMkJBQU8sS0FBUCxDQUFnQiw2QkFBd0IsS0FBSyxHQUFMLENBQXhDLENBRks7QUFHTCxpQkFBSyxPQUFMLENBQWEsS0FBYixFQUhLO1dBUFA7U0FOQTtPQUZKOzs7O2dDQXdCVSxPQUFPO0FBQ2pCLHFCQUFPLElBQVAsNEJBQXFDLEtBQUssR0FBTCxDQUFyQyxDQURpQjtBQUVqQixXQUFLLFNBQUwsQ0FBZSxLQUFmLEVBQXNCLEtBQUssS0FBTCxDQUF0QixDQUZpQjs7OztpQ0FLTixPQUFPO0FBQ2xCLFVBQUksUUFBUSxLQUFLLEtBQUwsQ0FETTtBQUVsQixVQUFJLE1BQU0sTUFBTixLQUFpQixJQUFqQixFQUF1QjtBQUN6QixjQUFNLE1BQU4sR0FBZSxZQUFZLEdBQVosRUFBZixDQUR5QjtPQUEzQjtBQUdBLFlBQU0sTUFBTixHQUFlLE1BQU0sTUFBTixDQUxHO0FBTWxCLFVBQUksS0FBSyxVQUFMLEVBQWlCO0FBQ25CLGFBQUssVUFBTCxDQUFnQixLQUFoQixFQUF1QixLQUF2QixFQURtQjtPQUFyQjs7OztTQTVHRTs7O2tCQWtIUyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICB2YXIgZXhwID0gY2FjaGVba2V5XS5leHBvcnRzO1xuICAgICAgICAvLyBVc2luZyBiYWJlbCBhcyBhIHRyYW5zcGlsZXIgdG8gdXNlIGVzbW9kdWxlLCB0aGUgZXhwb3J0IHdpbGwgYWx3YXlzXG4gICAgICAgIC8vIGJlIGFuIG9iamVjdCB3aXRoIHRoZSBkZWZhdWx0IGV4cG9ydCBhcyBhIHByb3BlcnR5IG9mIGl0LiBUbyBlbnN1cmVcbiAgICAgICAgLy8gdGhlIGV4aXN0aW5nIGFwaSBhbmQgYmFiZWwgZXNtb2R1bGUgZXhwb3J0cyBhcmUgYm90aCBzdXBwb3J0ZWQgd2VcbiAgICAgICAgLy8gY2hlY2sgZm9yIGJvdGhcbiAgICAgICAgaWYgKGV4cCA9PT0gZm4gfHwgZXhwLmRlZmF1bHQgPT09IGZuKSB7XG4gICAgICAgICAgICB3a2V5ID0ga2V5O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCAoXG4gICAgICAgICAgICAvLyB0cnkgdG8gY2FsbCBkZWZhdWx0IGlmIGRlZmluZWQgdG8gYWxzbyBzdXBwb3J0IGJhYmVsIGVzbW9kdWxlXG4gICAgICAgICAgICAvLyBleHBvcnRzXG4gICAgICAgICAgICAndmFyIGYgPSByZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKTsnICtcbiAgICAgICAgICAgICcoZi5kZWZhdWx0ID8gZi5kZWZhdWx0IDogZikoc2VsZik7J1xuICAgICAgICApKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcblxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuXG4gICAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3cubW96VVJMIHx8IHdpbmRvdy5tc1VSTDtcblxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwiLypcbiAqIHNpbXBsZSBBQlIgQ29udHJvbGxlclxuICogIC0gY29tcHV0ZSBuZXh0IGxldmVsIGJhc2VkIG9uIGxhc3QgZnJhZ21lbnQgYncgaGV1cmlzdGljc1xuICogIC0gaW1wbGVtZW50IGFuIGFiYW5kb24gcnVsZXMgdHJpZ2dlcmVkIGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBidWZmZXJlZCBhbmQgaWYgY29tcHV0ZWQgYncgc2hvd3MgdGhhdCB3ZSByaXNrIGJ1ZmZlciBzdGFsbGluZ1xuICovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCBCdWZmZXJIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2J1ZmZlci1oZWxwZXInO1xuaW1wb3J0IHtFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgQWJyQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5GUkFHX0xPQURJTkcsXG4gICAgICAgICAgICAgICBFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsXG4gICAgICAgICAgICAgICBFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgICAgICAgICAgIEV2ZW50LkVSUk9SKTtcbiAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gMDtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IC0xO1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25DaGVjayA9IHRoaXMuYWJhbmRvblJ1bGVzQ2hlY2suYmluZCh0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGVhclRpbWVyKCk7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbkZyYWdMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbkNoZWNrLCAxMDApO1xuICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBkYXRhLmZyYWc7XG4gIH1cblxuICBvbkZyYWdMb2FkUHJvZ3Jlc3MoZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgLy8gb25seSB1cGRhdGUgc3RhdHMgaWYgZmlyc3QgZnJhZyBsb2FkaW5nXG4gICAgLy8gaWYgc2FtZSBmcmFnIGlzIGxvYWRlZCBtdWx0aXBsZSB0aW1lcywgaXQgbWlnaHQgYmUgaW4gYnJvd3NlciBjYWNoZSwgYW5kIGxvYWRlZCBxdWlja2x5XG4gICAgLy8gYW5kIGxlYWRpbmcgdG8gd3JvbmcgYncgZXN0aW1hdGlvblxuICAgIGlmIChzdGF0cy5hYm9ydGVkID09PSB1bmRlZmluZWQgJiYgZGF0YS5mcmFnLmxvYWRDb3VudGVyID09PSAxKSB7XG4gICAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhdHMudHJlcXVlc3QpIC8gMTAwMDtcbiAgICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICB0aGlzLmxhc3RidyA9IChzdGF0cy5sb2FkZWQgKiA4KSAvIHRoaXMubGFzdGZldGNoZHVyYXRpb247XG4gICAgICAvL2NvbnNvbGUubG9nKGBmZXRjaER1cmF0aW9uOiR7dGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbn0sYnc6JHsodGhpcy5sYXN0YncvMTAwMCkudG9GaXhlZCgwKX0vJHtzdGF0cy5hYm9ydGVkfWApO1xuICAgIH1cbiAgfVxuXG4gIGFiYW5kb25SdWxlc0NoZWNrKCkge1xuICAgIC8qXG4gICAgICBtb25pdG9yIGZyYWdtZW50IHJldHJpZXZhbCB0aW1lLi4uXG4gICAgICB3ZSBjb21wdXRlIGV4cGVjdGVkIHRpbWUgb2YgYXJyaXZhbCBvZiB0aGUgY29tcGxldGUgZnJhZ21lbnQuXG4gICAgICB3ZSBjb21wYXJlIGl0IHRvIGV4cGVjdGVkIHRpbWUgb2YgYnVmZmVyIHN0YXJ2YXRpb25cbiAgICAqL1xuICAgIGxldCBobHMgPSB0aGlzLmhscywgdiA9IGhscy5tZWRpYSxmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAvKiBvbmx5IG1vbml0b3IgZnJhZyByZXRyaWV2YWwgdGltZSBpZlxuICAgICh2aWRlbyBub3QgcGF1c2VkIE9SIGZpcnN0IGZyYWdtZW50IGJlaW5nIGxvYWRlZChyZWFkeSBzdGF0ZSA9PT0gSEFWRV9OT1RISU5HID0gMCkpIEFORCBhdXRvc3dpdGNoaW5nIGVuYWJsZWQgQU5EIG5vdCBsb3dlc3QgbGV2ZWwgKD0+IG1lYW5zIHRoYXQgd2UgaGF2ZSBzZXZlcmFsIGxldmVscykgKi9cbiAgICBpZiAodiAmJiAoIXYucGF1c2VkIHx8ICF2LnJlYWR5U3RhdGUpICYmIGZyYWcuYXV0b0xldmVsICYmIGZyYWcubGV2ZWwpIHtcbiAgICAgIGxldCByZXF1ZXN0RGVsYXkgPSBwZXJmb3JtYW5jZS5ub3coKSAtIGZyYWcudHJlcXVlc3Q7XG4gICAgICAvLyBtb25pdG9yIGZyYWdtZW50IGxvYWQgcHJvZ3Jlc3MgYWZ0ZXIgaGFsZiBvZiBleHBlY3RlZCBmcmFnbWVudCBkdXJhdGlvbix0byBzdGFiaWxpemUgYml0cmF0ZVxuICAgICAgaWYgKHJlcXVlc3REZWxheSA+ICg1MDAgKiBmcmFnLmR1cmF0aW9uKSkge1xuICAgICAgICBsZXQgbG9hZFJhdGUgPSBNYXRoLm1heCgxLGZyYWcubG9hZGVkICogMTAwMCAvIHJlcXVlc3REZWxheSk7IC8vIGJ5dGUvczsgYXQgbGVhc3QgMSBieXRlL3MgdG8gYXZvaWQgZGl2aXNpb24gYnkgemVyb1xuICAgICAgICBpZiAoZnJhZy5leHBlY3RlZExlbiA8IGZyYWcubG9hZGVkKSB7XG4gICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IGZyYWcubG9hZGVkO1xuICAgICAgICB9XG4gICAgICAgIGxldCBwb3MgPSB2LmN1cnJlbnRUaW1lO1xuICAgICAgICBsZXQgZnJhZ0xvYWRlZERlbGF5ID0gKGZyYWcuZXhwZWN0ZWRMZW4gLSBmcmFnLmxvYWRlZCkgLyBsb2FkUmF0ZTtcbiAgICAgICAgbGV0IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA9IEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHYscG9zLGhscy5jb25maWcubWF4QnVmZmVySG9sZSkuZW5kIC0gcG9zO1xuICAgICAgICAvLyBjb25zaWRlciBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gb25seSBpZiB3ZSBoYXZlIGxlc3MgdGhhbiAyIGZyYWcgYnVmZmVyZWQgQU5EXG4gICAgICAgIC8vIHRpbWUgdG8gZmluaXNoIGxvYWRpbmcgY3VycmVudCBmcmFnbWVudCBpcyBiaWdnZXIgdGhhbiBidWZmZXIgc3RhcnZhdGlvbiBkZWxheVxuICAgICAgICAvLyBpZSBpZiB3ZSByaXNrIGJ1ZmZlciBzdGFydmF0aW9uIGlmIGJ3IGRvZXMgbm90IGluY3JlYXNlIHF1aWNrbHlcbiAgICAgICAgaWYgKGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA8IDIqZnJhZy5kdXJhdGlvbiAmJiBmcmFnTG9hZGVkRGVsYXkgPiBidWZmZXJTdGFydmF0aW9uRGVsYXkpIHtcbiAgICAgICAgICBsZXQgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5LCBuZXh0TG9hZExldmVsO1xuICAgICAgICAgIC8vIGxldHMgaXRlcmF0ZSB0aHJvdWdoIGxvd2VyIGxldmVsIGFuZCB0cnkgdG8gZmluZCB0aGUgYmlnZ2VzdCBvbmUgdGhhdCBjb3VsZCBhdm9pZCByZWJ1ZmZlcmluZ1xuICAgICAgICAgIC8vIHdlIHN0YXJ0IGZyb20gY3VycmVudCBsZXZlbCAtIDEgYW5kIHdlIHN0ZXAgZG93biAsIHVudGlsIHdlIGZpbmQgYSBtYXRjaGluZyBsZXZlbFxuICAgICAgICAgIGZvciAobmV4dExvYWRMZXZlbCA9IGZyYWcubGV2ZWwgLSAxIDsgbmV4dExvYWRMZXZlbCA+PTAgOyBuZXh0TG9hZExldmVsLS0pIHtcbiAgICAgICAgICAgIC8vIGNvbXB1dGUgdGltZSB0byBsb2FkIG5leHQgZnJhZ21lbnQgYXQgbG93ZXIgbGV2ZWxcbiAgICAgICAgICAgIC8vIDAuOCA6IGNvbnNpZGVyIG9ubHkgODAlIG9mIGN1cnJlbnQgYncgdG8gYmUgY29uc2VydmF0aXZlXG4gICAgICAgICAgICAvLyA4ID0gYml0cyBwZXIgYnl0ZSAoYnBzL0JwcylcbiAgICAgICAgICAgIGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA9IGZyYWcuZHVyYXRpb24gKiBobHMubGV2ZWxzW25leHRMb2FkTGV2ZWxdLmJpdHJhdGUgLyAoOCAqIDAuOCAqIGxvYWRSYXRlKTtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYGZyYWdMb2FkZWREZWxheS9idWZmZXJTdGFydmF0aW9uRGVsYXkvZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5WyR7bmV4dExvYWRMZXZlbH1dIDoke2ZyYWdMb2FkZWREZWxheS50b0ZpeGVkKDEpfS8ke2J1ZmZlclN0YXJ2YXRpb25EZWxheS50b0ZpeGVkKDEpfS8ke2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheS50b0ZpeGVkKDEpfWApO1xuICAgICAgICAgICAgaWYgKGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA8IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSkge1xuICAgICAgICAgICAgICAvLyB3ZSBmb3VuZCBhIGxvd2VyIGxldmVsIHRoYXQgYmUgcmVidWZmZXJpbmcgZnJlZSB3aXRoIGN1cnJlbnQgZXN0aW1hdGVkIGJ3ICFcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIG9ubHkgZW1lcmdlbmN5IHN3aXRjaCBkb3duIGlmIGl0IHRha2VzIGxlc3MgdGltZSB0byBsb2FkIG5ldyBmcmFnbWVudCBhdCBsb3dlc3QgbGV2ZWwgaW5zdGVhZFxuICAgICAgICAgIC8vIG9mIGZpbmlzaGluZyBsb2FkaW5nIGN1cnJlbnQgb25lIC4uLlxuICAgICAgICAgIGlmIChmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkgPCBmcmFnTG9hZGVkRGVsYXkpIHtcbiAgICAgICAgICAgIC8vIGVuc3VyZSBuZXh0TG9hZExldmVsIGlzIG5vdCBuZWdhdGl2ZVxuICAgICAgICAgICAgbmV4dExvYWRMZXZlbCA9IE1hdGgubWF4KDAsbmV4dExvYWRMZXZlbCk7XG4gICAgICAgICAgICAvLyBmb3JjZSBuZXh0IGxvYWQgbGV2ZWwgaW4gYXV0byBtb2RlXG4gICAgICAgICAgICBobHMubmV4dExvYWRMZXZlbCA9IG5leHRMb2FkTGV2ZWw7XG4gICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYGxvYWRpbmcgdG9vIHNsb3csIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgYW5kIHN3aXRjaCB0byBsZXZlbCAke25leHRMb2FkTGV2ZWx9YCk7XG4gICAgICAgICAgICAvL2Fib3J0IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoKSB7XG4gICAgLy8gc3RvcCBtb25pdG9yaW5nIGJ3IG9uY2UgZnJhZyBsb2FkZWRcbiAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgfVxuXG4gIG9uRXJyb3IoZGF0YSkge1xuICAgIC8vIHN0b3AgdGltZXIgaW4gY2FzZSBvZiBmcmFnIGxvYWRpbmcgZXJyb3JcbiAgICBzd2l0Y2goZGF0YS5kZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgICAgdGhpcy5jbGVhclRpbWVyKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiBjbGVhclRpbWVyKCkge1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidywgaGxzID0gdGhpcy5obHMsYWRqdXN0ZWRidywgaSwgbWF4QXV0b0xldmVsO1xuICAgIGlmICh0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID09PSAtMSkge1xuICAgICAgbWF4QXV0b0xldmVsID0gaGxzLmxldmVscy5sZW5ndGggLSAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9uZXh0QXV0b0xldmVsICE9PSAtMSkge1xuICAgICAgdmFyIG5leHRMZXZlbCA9IE1hdGgubWluKHRoaXMuX25leHRBdXRvTGV2ZWwsbWF4QXV0b0xldmVsKTtcbiAgICAgIGlmIChuZXh0TGV2ZWwgPT09IHRoaXMubGFzdGZldGNobGV2ZWwpIHtcbiAgICAgICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IC0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5leHRMZXZlbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmb2xsb3cgYWxnb3JpdGhtIGNhcHR1cmVkIGZyb20gc3RhZ2VmcmlnaHQgOlxuICAgIC8vIGh0dHBzOi8vYW5kcm9pZC5nb29nbGVzb3VyY2UuY29tL3BsYXRmb3JtL2ZyYW1ld29ya3MvYXYvKy9tYXN0ZXIvbWVkaWEvbGlic3RhZ2VmcmlnaHQvaHR0cGxpdmUvTGl2ZVNlc3Npb24uY3BwXG4gICAgLy8gUGljayB0aGUgaGlnaGVzdCBiYW5kd2lkdGggc3RyZWFtIGJlbG93IG9yIGVxdWFsIHRvIGVzdGltYXRlZCBiYW5kd2lkdGguXG4gICAgZm9yIChpID0gMDsgaSA8PSBtYXhBdXRvTGV2ZWw7IGkrKykge1xuICAgIC8vIGNvbnNpZGVyIG9ubHkgODAlIG9mIHRoZSBhdmFpbGFibGUgYmFuZHdpZHRoLCBidXQgaWYgd2UgYXJlIHN3aXRjaGluZyB1cCxcbiAgICAvLyBiZSBldmVuIG1vcmUgY29uc2VydmF0aXZlICg3MCUpIHRvIGF2b2lkIG92ZXJlc3RpbWF0aW5nIGFuZCBpbW1lZGlhdGVseVxuICAgIC8vIHN3aXRjaGluZyBiYWNrLlxuICAgICAgaWYgKGkgPD0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC44ICogbGFzdGJ3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuNyAqIGxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmIChhZGp1c3RlZGJ3IDwgaGxzLmxldmVsc1tpXS5iaXRyYXRlKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBpIC0gMSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpIC0gMTtcbiAgfVxuXG4gIHNldCBuZXh0QXV0b0xldmVsKG5leHRMZXZlbCkge1xuICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSBuZXh0TGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQWJyQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIEJ1ZmZlciBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5cbmNsYXNzIEJ1ZmZlckNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1FRElBX0FUVEFDSElORyxcbiAgICAgIEV2ZW50Lk1FRElBX0RFVEFDSElORyxcbiAgICAgIEV2ZW50LkJVRkZFUl9SRVNFVCxcbiAgICAgIEV2ZW50LkJVRkZFUl9BUFBFTkRJTkcsXG4gICAgICBFdmVudC5CVUZGRVJfQ09ERUNTLFxuICAgICAgRXZlbnQuQlVGRkVSX0VPUyxcbiAgICAgIEV2ZW50LkJVRkZFUl9GTFVTSElORyk7XG5cbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNCVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU0JVcGRhdGVFcnJvci5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgIC8vIGxpbmsgdmlkZW8gYW5kIG1lZGlhIFNvdXJjZVxuICAgIG1lZGlhLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwobXMpO1xuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmIChtcykge1xuICAgICAgaWYgKG1zLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIGVuZE9mU3RyZWFtIGNvdWxkIHRyaWdnZXIgZXhjZXB0aW9uIGlmIGFueSBzb3VyY2VidWZmZXIgaXMgaW4gdXBkYXRpbmcgc3RhdGVcbiAgICAgICAgICAvLyB3ZSBkb24ndCByZWFsbHkgY2FyZSBhYm91dCBjaGVja2luZyBzb3VyY2VidWZmZXIgc3RhdGUgaGVyZSxcbiAgICAgICAgICAvLyBhcyB3ZSBhcmUgYW55d2F5IGRldGFjaGluZyB0aGUgTWVkaWFTb3VyY2VcbiAgICAgICAgICAvLyBsZXQncyBqdXN0IGF2b2lkIHRoaXMgZXhjZXB0aW9uIHRvIHByb3BhZ2F0ZVxuICAgICAgICAgIG1zLmVuZE9mU3RyZWFtKCk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYG9uTWVkaWFEZXRhY2hpbmc6JHtlcnIubWVzc2FnZX0gd2hpbGUgY2FsbGluZyBlbmRPZlN0cmVhbWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAgIC8vIHVubGluayBNZWRpYVNvdXJjZSBmcm9tIHZpZGVvIHRhZ1xuICAgICAgdGhpcy5tZWRpYS5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWEucmVtb3ZlQXR0cmlidXRlKCdzcmMnKTtcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSBudWxsO1xuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTUVESUFfREVUQUNIRUQpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIG9wZW5lZCcpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNIRUQsIHsgbWVkaWEgOiB0aGlzLm1lZGlhIH0pO1xuICAgIC8vIG9uY2UgcmVjZWl2ZWQsIGRvbid0IGxpc3RlbiBhbnltb3JlIHRvIHNvdXJjZW9wZW4gZXZlbnRcbiAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAvLyBpZiBhbnkgYnVmZmVyIGNvZGVjcyBwZW5kaW5nLCB0cmVhdCBpdCBoZXJlLlxuICAgIHZhciBwZW5kaW5nVHJhY2tzID0gdGhpcy5wZW5kaW5nVHJhY2tzO1xuICAgIGlmIChwZW5kaW5nVHJhY2tzKSB7XG4gICAgICB0aGlzLm9uQnVmZmVyQ29kZWNzKHBlbmRpbmdUcmFja3MpO1xuICAgICAgdGhpcy5wZW5kaW5nVHJhY2tzID0gbnVsbDtcbiAgICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgICB9XG4gIH1cblxuICBvbk1lZGlhU291cmNlQ2xvc2UoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGNsb3NlZCcpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBlbmRlZCcpO1xuICB9XG5cblxuICBvblNCVXBkYXRlRW5kKCkge1xuXG4gICAgaWYgKHRoaXMuX25lZWRzRmx1c2gpIHtcbiAgICAgIHRoaXMuZG9GbHVzaCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9uZWVkc0Vvcykge1xuICAgICAgdGhpcy5vbkJ1ZmZlckVvcygpO1xuICAgIH1cblxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVOREVEKTtcblxuICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgfVxuXG4gIG9uU0JVcGRhdGVFcnJvcihldmVudCkge1xuICAgIGxvZ2dlci5lcnJvcihgc291cmNlQnVmZmVyIGVycm9yOiR7ZXZlbnR9YCk7XG4gICAgLy8gYWNjb3JkaW5nIHRvIGh0dHA6Ly93d3cudzMub3JnL1RSL21lZGlhLXNvdXJjZS8jc291cmNlYnVmZmVyLWFwcGVuZC1lcnJvclxuICAgIC8vIHRoaXMgZXJyb3IgbWlnaHQgbm90IGFsd2F5cyBiZSBmYXRhbCAoaXQgaXMgZmF0YWwgaWYgZGVjb2RlIGVycm9yIGlzIHNldCwgaW4gdGhhdCBjYXNlXG4gICAgLy8gaXQgd2lsbCBiZSBmb2xsb3dlZCBieSBhIG1lZGlhRWxlbWVudCBlcnJvciAuLi4pXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5ESU5HX0VSUk9SLCBmYXRhbDogZmFsc2V9KTtcbiAgICAvLyB3ZSBkb24ndCBuZWVkIHRvIGRvIG1vcmUgdGhhbiB0aGF0LCBhcyBhY2NvcmRpbiB0byB0aGUgc3BlYywgdXBkYXRlZW5kIHdpbGwgYmUgZmlyZWQganVzdCBhZnRlclxuICB9XG5cbiAgb25CdWZmZXJSZXNldCgpIHtcbiAgICB2YXIgc291cmNlQnVmZmVyID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICB2YXIgc2IgPSBzb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuZmx1c2hSYW5nZSA9IFtdO1xuICAgIHRoaXMuYXBwZW5kZWQgPSAwO1xuICB9XG5cbiAgb25CdWZmZXJDb2RlY3ModHJhY2tzKSB7XG4gICAgdmFyIHNiLHRyYWNrTmFtZSx0cmFjaywgY29kZWMsIG1pbWVUeXBlO1xuXG4gICAgaWYgKCF0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSB0cmFja3M7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgdmFyIHNvdXJjZUJ1ZmZlciA9IHt9LCBtZWRpYVNvdXJjZSA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgICBmb3IgKHRyYWNrTmFtZSBpbiB0cmFja3MpIHtcbiAgICAgICAgdHJhY2sgPSB0cmFja3NbdHJhY2tOYW1lXTtcbiAgICAgICAgLy8gdXNlIGxldmVsQ29kZWMgYXMgZmlyc3QgcHJpb3JpdHlcbiAgICAgICAgY29kZWMgPSB0cmFjay5sZXZlbENvZGVjIHx8IHRyYWNrLmNvZGVjO1xuICAgICAgICBtaW1lVHlwZSA9IGAke3RyYWNrLmNvbnRhaW5lcn07Y29kZWNzPSR7Y29kZWN9YDtcbiAgICAgICAgbG9nZ2VyLmxvZyhgY3JlYXRpbmcgc291cmNlQnVmZmVyIHdpdGggbWltZVR5cGU6JHttaW1lVHlwZX1gKTtcbiAgICAgICAgc2IgPSBzb3VyY2VCdWZmZXJbdHJhY2tOYW1lXSA9IG1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcihtaW1lVHlwZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gc291cmNlQnVmZmVyO1xuICAgIH1cbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kaW5nKGRhdGEpIHtcbiAgICBpZiAoIXRoaXMuc2VnbWVudHMpIHtcbiAgICAgIHRoaXMuc2VnbWVudHMgPSBbIGRhdGEgXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZWdtZW50cy5wdXNoKGRhdGEpO1xuICAgIH1cbiAgICB0aGlzLmRvQXBwZW5kaW5nKCk7XG4gIH1cblxuICBvbkJ1ZmZlckFwcGVuZEZhaWwoZGF0YSkge1xuICAgIGxvZ2dlci5lcnJvcihgc291cmNlQnVmZmVyIGVycm9yOiR7ZGF0YS5ldmVudH1gKTtcbiAgICAvLyBhY2NvcmRpbmcgdG8gaHR0cDovL3d3dy53My5vcmcvVFIvbWVkaWEtc291cmNlLyNzb3VyY2VidWZmZXItYXBwZW5kLWVycm9yXG4gICAgLy8gdGhpcyBlcnJvciBtaWdodCBub3QgYWx3YXlzIGJlIGZhdGFsIChpdCBpcyBmYXRhbCBpZiBkZWNvZGUgZXJyb3IgaXMgc2V0LCBpbiB0aGF0IGNhc2VcbiAgICAvLyBpdCB3aWxsIGJlIGZvbGxvd2VkIGJ5IGEgbWVkaWFFbGVtZW50IGVycm9yIC4uLilcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnQ3VycmVudH0pO1xuICB9XG5cbiAgb25CdWZmZXJFb3MoKSB7XG4gICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIsIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICBpZiAoIW1lZGlhU291cmNlIHx8IG1lZGlhU291cmNlLnJlYWR5U3RhdGUgIT09ICdvcGVuJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoISgoc2IuYXVkaW8gJiYgc2IuYXVkaW8udXBkYXRpbmcpIHx8IChzYi52aWRlbyAmJiBzYi52aWRlby51cGRhdGluZykpKSB7XG4gICAgICBsb2dnZXIubG9nKCdhbGwgbWVkaWEgZGF0YSBhdmFpbGFibGUsIHNpZ25hbCBlbmRPZlN0cmVhbSgpIHRvIE1lZGlhU291cmNlIGFuZCBzdG9wIGxvYWRpbmcgZnJhZ21lbnQnKTtcbiAgICAgIC8vTm90aWZ5IHRoZSBtZWRpYSBlbGVtZW50IHRoYXQgaXQgbm93IGhhcyBhbGwgb2YgdGhlIG1lZGlhIGRhdGFcbiAgICAgIG1lZGlhU291cmNlLmVuZE9mU3RyZWFtKCk7XG4gICAgICB0aGlzLl9uZWVkc0VvcyA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9uZWVkc0VvcyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJGbHVzaGluZyhkYXRhKSB7XG4gICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goe3N0YXJ0OiBkYXRhLnN0YXJ0T2Zmc2V0LCBlbmQ6IGRhdGEuZW5kT2Zmc2V0fSk7XG4gICAgLy8gYXR0ZW1wdCBmbHVzaCBpbW1lZGlhdGx5XG4gICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgIHRoaXMuZG9GbHVzaCgpO1xuICB9XG5cbiAgZG9GbHVzaCgpIHtcbiAgICAvLyBsb29wIHRocm91Z2ggYWxsIGJ1ZmZlciByYW5nZXMgdG8gZmx1c2hcbiAgICB3aGlsZSh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmZsdXNoUmFuZ2VbMF07XG4gICAgICAvLyBmbHVzaEJ1ZmZlciB3aWxsIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzIGFuZCBmbHVzaCBBdWRpby9WaWRlbyBCdWZmZXJcbiAgICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyKHJhbmdlLnN0YXJ0LCByYW5nZS5lbmQpKSB7XG4gICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5zaGlmdCgpO1xuICAgICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9uZWVkc0ZsdXNoID0gdHJ1ZTtcbiAgICAgICAgLy8gYXZvaWQgbG9vcGluZywgd2FpdCBmb3IgU0IgdXBkYXRlIGVuZCB0byByZXRyaWdnZXIgYSBmbHVzaFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWRcbiAgICAgIHRoaXMuX25lZWRzRmx1c2ggPSBmYWxzZTtcblxuICAgICAgLy8gbGV0J3MgcmVjb21wdXRlIHRoaXMuYXBwZW5kZWQsIHdoaWNoIGlzIHVzZWQgdG8gYXZvaWQgZmx1c2ggbG9vcGluZ1xuICAgICAgdmFyIGFwcGVuZGVkID0gMDtcbiAgICAgIHZhciBzb3VyY2VCdWZmZXIgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICAgIGlmIChzb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgZm9yICh2YXIgdHlwZSBpbiBzb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICBhcHBlbmRlZCArPSBzb3VyY2VCdWZmZXJbdHlwZV0uYnVmZmVyZWQubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmFwcGVuZGVkID0gYXBwZW5kZWQ7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSEVEKTtcbiAgICB9XG4gIH1cblxuICBkb0FwcGVuZGluZygpIHtcbiAgICB2YXIgaGxzID0gdGhpcy5obHMsIHNvdXJjZUJ1ZmZlciA9IHRoaXMuc291cmNlQnVmZmVyLCBzZWdtZW50cyA9IHRoaXMuc2VnbWVudHM7XG4gICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgaWYgKHRoaXMubWVkaWEuZXJyb3IpIHtcbiAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgbG9nZ2VyLmVycm9yKCd0cnlpbmcgdG8gYXBwZW5kIGFsdGhvdWdoIGEgbWVkaWEgZXJyb3Igb2NjdXJlZCwgZmx1c2ggc2VnbWVudCBhbmQgYWJvcnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgdHlwZSBpbiBzb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgaWYgKHNvdXJjZUJ1ZmZlclt0eXBlXS51cGRhdGluZykge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc2IgdXBkYXRlIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBzZWdtZW50ID0gc2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coYGFwcGVuZGluZyAke3NlZ21lbnQudHlwZX0gU0IsIHNpemU6JHtzZWdtZW50LmRhdGEubGVuZ3RofSk7XG5cdFx0ICAvLyBpZiAoc291cmNlQnVmZmVyLmZpcnN0TG9hZGVkICYmICFzb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpIHsgXG5cdFx0ICBcdC8vIHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLnRpbWVzdGFtcE9mZnNldCArPSAxMDtcblx0XHQgIC8vIH1cbiAgICAgICAgICBzb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS5hcHBlbmRCdWZmZXIoc2VnbWVudC5kYXRhKTtcblx0XHQgIHNvdXJjZUJ1ZmZlci5maXJzdExvYWRlZCA9IHRydWU7XG5cblx0XHQgIC8vIHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdCAgLy8gXHRzb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS50aW1lc3RhbXBPZmZzZXQgPSAxNTtcblx0XHQgIC8vIH0sIDUpO1xuXG5cdFx0ICBjb25zb2xlLmluZm8oc2VnbWVudCk7XG4gICAgICAgICAgdGhpcy5hcHBlbmRFcnJvciA9IDA7XG4gICAgICAgICAgdGhpcy5hcHBlbmRlZCsrO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIC8vIGluIGNhc2UgYW55IGVycm9yIG9jY3VyZWQgd2hpbGUgYXBwZW5kaW5nLCBwdXQgYmFjayBzZWdtZW50IGluIHNlZ21lbnRzIHRhYmxlXG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBlcnJvciB3aGlsZSB0cnlpbmcgdG8gYXBwZW5kIGJ1ZmZlcjoke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgIHNlZ21lbnRzLnVuc2hpZnQoc2VnbWVudCk7XG4gICAgICAgICAgdmFyIGV2ZW50ID0ge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1J9O1xuICAgICAgICAgIGlmKGVyci5jb2RlICE9PSAyMikge1xuICAgICAgICAgICAgaWYgKHRoaXMuYXBwZW5kRXJyb3IpIHtcbiAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcisrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvciA9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBldmVudC5kZXRhaWxzID0gRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRfRVJST1I7XG4gICAgICAgICAgICBldmVudC5mcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgICAgIC8qIHdpdGggVUhEIGNvbnRlbnQsIHdlIGNvdWxkIGdldCBsb29wIG9mIHF1b3RhIGV4Y2VlZGVkIGVycm9yIHVudGlsXG4gICAgICAgICAgICAgIGJyb3dzZXIgaXMgYWJsZSB0byBldmljdCBzb21lIGRhdGEgZnJvbSBzb3VyY2VidWZmZXIuIHJldHJ5aW5nIGhlbHAgcmVjb3ZlcmluZyB0aGlzXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKHRoaXMuYXBwZW5kRXJyb3IgPiBobHMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnkpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmFpbCAke2hscy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeX0gdGltZXMgdG8gYXBwZW5kIHNlZ21lbnQgaW4gc291cmNlQnVmZmVyYCk7XG4gICAgICAgICAgICAgIHNlZ21lbnRzID0gW107XG4gICAgICAgICAgICAgIGV2ZW50LmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSBmYWxzZTtcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gUXVvdGFFeGNlZWRlZEVycm9yOiBodHRwOi8vd3d3LnczLm9yZy9UUi9odG1sNS9pbmZyYXN0cnVjdHVyZS5odG1sI3F1b3RhZXhjZWVkZWRlcnJvclxuICAgICAgICAgICAgLy8gbGV0J3Mgc3RvcCBhcHBlbmRpbmcgYW55IHNlZ21lbnRzLCBhbmQgcmVwb3J0IEJVRkZFUl9GVUxMX0VSUk9SIGVycm9yXG4gICAgICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICAgICAgZXZlbnQuZGV0YWlscyA9IEVycm9yRGV0YWlscy5CVUZGRVJfRlVMTF9FUlJPUjtcbiAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLGV2ZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAgIGZsdXNoIHNwZWNpZmllZCBidWZmZXJlZCByYW5nZSxcbiAgICByZXR1cm4gdHJ1ZSBvbmNlIHJhbmdlIGhhcyBiZWVuIGZsdXNoZWQuXG4gICAgYXMgc291cmNlQnVmZmVyLnJlbW92ZSgpIGlzIGFzeW5jaHJvbm91cywgZmx1c2hCdWZmZXIgd2lsbCBiZSByZXRyaWdnZXJlZCBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlIGVuZFxuICAqL1xuICBmbHVzaEJ1ZmZlcihzdGFydE9mZnNldCwgZW5kT2Zmc2V0KSB7XG4gICAgdmFyIHNiLCBpLCBidWZTdGFydCwgYnVmRW5kLCBmbHVzaFN0YXJ0LCBmbHVzaEVuZDtcbiAgICAvL2xvZ2dlci5sb2coJ2ZsdXNoQnVmZmVyLHBvcy9zdGFydC9lbmQ6ICcgKyB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lICsgJy8nICsgc3RhcnRPZmZzZXQgKyAnLycgKyBlbmRPZmZzZXQpO1xuICAgIC8vIHNhZmVndWFyZCB0byBhdm9pZCBpbmZpbml0ZSBsb29waW5nIDogZG9uJ3QgdHJ5IHRvIGZsdXNoIG1vcmUgdGhhbiB0aGUgbmIgb2YgYXBwZW5kZWQgc2VnbWVudHNcbiAgICBpZiAodGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPCB0aGlzLmFwcGVuZGVkICYmIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IgKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIGlmICghc2IudXBkYXRpbmcpIHtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2IuYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGJ1ZlN0YXJ0ID0gc2IuYnVmZmVyZWQuc3RhcnQoaSk7XG4gICAgICAgICAgICBidWZFbmQgPSBzYi5idWZmZXJlZC5lbmQoaSk7XG4gICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZpcmVmb3ggbm90IGFibGUgdG8gcHJvcGVybHkgZmx1c2ggbXVsdGlwbGUgYnVmZmVyZWQgcmFuZ2UuXG4gICAgICAgICAgICBpZiAobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEgJiYgZW5kT2Zmc2V0ID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IHN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IGVuZE9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBNYXRoLm1heChidWZTdGFydCwgc3RhcnRPZmZzZXQpO1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IE1hdGgubWluKGJ1ZkVuZCwgZW5kT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIHNvbWV0aW1lcyBzb3VyY2VidWZmZXIucmVtb3ZlKCkgZG9lcyBub3QgZmx1c2hcbiAgICAgICAgICAgICAgIHRoZSBleGFjdCBleHBlY3RlZCB0aW1lIHJhbmdlLlxuICAgICAgICAgICAgICAgdG8gYXZvaWQgcm91bmRpbmcgaXNzdWVzL2luZmluaXRlIGxvb3AsXG4gICAgICAgICAgICAgICBvbmx5IGZsdXNoIGJ1ZmZlciByYW5nZSBvZiBsZW5ndGggZ3JlYXRlciB0aGFuIDUwMG1zLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChNYXRoLm1pbihmbHVzaEVuZCxidWZFbmQpIC0gZmx1c2hTdGFydCA+IDAuNSApIHtcbiAgICAgICAgICAgICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIrKztcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmx1c2ggJHt0eXBlfSBbJHtmbHVzaFN0YXJ0fSwke2ZsdXNoRW5kfV0sIG9mIFske2J1ZlN0YXJ0fSwke2J1ZkVuZH1dLCBwb3M6JHt0aGlzLm1lZGlhLmN1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICBzYi5yZW1vdmUoZmx1c2hTdGFydCwgZmx1c2hFbmQpO1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnYWJvcnQgJyArIHR5cGUgKyAnIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAgIC8vIHRoaXMgd2lsbCBhYm9ydCBhbnkgYXBwZW5kaW5nIGluIHByb2dyZXNzXG4gICAgICAgICAgLy9zYi5hYm9ydCgpO1xuICAgICAgICAgIGxvZ2dlci53YXJuKCdjYW5ub3QgZmx1c2gsIHNiIHVwZGF0aW5nIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKCdhYm9ydCBmbHVzaGluZyB0b28gbWFueSByZXRyaWVzJyk7XG4gICAgfVxuICAgIGxvZ2dlci5sb2coJ2J1ZmZlciBmbHVzaGVkJyk7XG4gICAgLy8gZXZlcnl0aGluZyBmbHVzaGVkICFcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCdWZmZXJDb250cm9sbGVyO1xuIiwiLypcbiAqIGNhcCBzdHJlYW0gbGV2ZWwgdG8gbWVkaWEgc2l6ZSBkaW1lbnNpb24gY29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuXG5jbGFzcyBDYXBMZXZlbENvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXHRjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsXG4gICAgICBFdmVudC5NRURJQV9BVFRBQ0hJTkcsXG4gICAgICBFdmVudC5NQU5JRkVTVF9QQVJTRUQpOyAgIFxuXHR9XG5cdFxuXHRkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmhscy5jb25maWcuY2FwTGV2ZWxUb1BsYXllclNpemUpIHtcbiAgICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICAgICAgdGhpcy5hdXRvTGV2ZWxDYXBwaW5nID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICAgdGhpcy50aW1lciA9IGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cdCAgXG5cdG9uTWVkaWFBdHRhY2hpbmcoZGF0YSkge1xuICAgIHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhIGluc3RhbmNlb2YgSFRNTFZpZGVvRWxlbWVudCA/IGRhdGEubWVkaWEgOiBudWxsOyAgXG4gIH1cblxuICBvbk1hbmlmZXN0UGFyc2VkKGRhdGEpIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmNhcExldmVsVG9QbGF5ZXJTaXplKSB7XG4gICAgICB0aGlzLmF1dG9MZXZlbENhcHBpbmcgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgICB0aGlzLmxldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgICAgdGhpcy5obHMuZmlyc3RMZXZlbCA9IHRoaXMuZ2V0TWF4TGV2ZWwoZGF0YS5maXJzdExldmVsKTtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5kZXRlY3RQbGF5ZXJTaXplLmJpbmQodGhpcyksIDEwMDApO1xuICAgICAgdGhpcy5kZXRlY3RQbGF5ZXJTaXplKCk7XG4gICAgfVxuICB9XG4gIFxuICBkZXRlY3RQbGF5ZXJTaXplKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICBsZXQgbGV2ZWxzTGVuZ3RoID0gdGhpcy5sZXZlbHMgPyB0aGlzLmxldmVscy5sZW5ndGggOiAwO1xuICAgICAgaWYgKGxldmVsc0xlbmd0aCkge1xuICAgICAgICB0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nID0gdGhpcy5nZXRNYXhMZXZlbChsZXZlbHNMZW5ndGggLSAxKTtcbiAgICAgICAgaWYgKHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmcgPiB0aGlzLmF1dG9MZXZlbENhcHBpbmcpIHtcbiAgICAgICAgICAvLyBpZiBhdXRvIGxldmVsIGNhcHBpbmcgaGFzIGEgaGlnaGVyIHZhbHVlIGZvciB0aGUgcHJldmlvdXMgb25lLCBmbHVzaCB0aGUgYnVmZmVyIHVzaW5nIG5leHRMZXZlbFN3aXRjaFxuICAgICAgICAgIC8vIHVzdWFsbHkgaGFwcGVuIHdoZW4gdGhlIHVzZXIgZ28gdG8gdGhlIGZ1bGxzY3JlZW4gbW9kZS5cbiAgICAgICAgICB0aGlzLmhscy5zdHJlYW1Db250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYXV0b0xldmVsQ2FwcGluZyA9IHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmc7ICAgICAgICBcbiAgICAgIH0gIFxuICAgIH1cbiAgfVxuICBcbiAgLypcbiAgKiByZXR1cm5zIGxldmVsIHNob3VsZCBiZSB0aGUgb25lIHdpdGggdGhlIGRpbWVuc2lvbnMgZXF1YWwgb3IgZ3JlYXRlciB0aGFuIHRoZSBtZWRpYSAocGxheWVyKSBkaW1lbnNpb25zIChzbyB0aGUgdmlkZW8gd2lsbCBiZSBkb3duc2NhbGVkKVxuICAqL1xuICBnZXRNYXhMZXZlbChjYXBMZXZlbEluZGV4KSB7XG4gICAgbGV0IHJlc3VsdCxcbiAgICAgICAgaSxcbiAgICAgICAgbGV2ZWwsXG4gICAgICAgIG1XaWR0aCA9IHRoaXMubWVkaWFXaWR0aCxcbiAgICAgICAgbUhlaWdodCA9IHRoaXMubWVkaWFIZWlnaHQsXG4gICAgICAgIGxXaWR0aCA9IDAsXG4gICAgICAgIGxIZWlnaHQgPSAwO1xuICAgICAgICBcbiAgICBmb3IgKGkgPSAwOyBpIDw9IGNhcExldmVsSW5kZXg7IGkrKykge1xuICAgICAgbGV2ZWwgPSB0aGlzLmxldmVsc1tpXTtcbiAgICAgIHJlc3VsdCA9IGk7XG4gICAgICBsV2lkdGggPSBsZXZlbC53aWR0aDtcbiAgICAgIGxIZWlnaHQgPSBsZXZlbC5oZWlnaHQ7XG4gICAgICBpZiAobVdpZHRoIDw9IGxXaWR0aCB8fCBtSGVpZ2h0IDw9IGxIZWlnaHQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBcbiAgZ2V0IGNvbnRlbnRTY2FsZUZhY3RvcigpIHtcbiAgICBsZXQgcGl4ZWxSYXRpbyA9IDE7XG4gICAgdHJ5IHtcbiAgICAgIHBpeGVsUmF0aW8gPSAgd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gICAgfSBjYXRjaChlKSB7fVxuICAgIHJldHVybiBwaXhlbFJhdGlvO1xuICB9XG4gIFxuICBnZXQgbWVkaWFXaWR0aCgpIHtcbiAgICBsZXQgd2lkdGg7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHdpZHRoID0gdGhpcy5tZWRpYS53aWR0aCB8fCB0aGlzLm1lZGlhLmNsaWVudFdpZHRoIHx8IHRoaXMubWVkaWEub2Zmc2V0V2lkdGg7XG4gICAgICB3aWR0aCAqPSB0aGlzLmNvbnRlbnRTY2FsZUZhY3RvcjtcbiAgICB9XG4gICAgcmV0dXJuIHdpZHRoO1xuICB9XG4gIFxuICBnZXQgbWVkaWFIZWlnaHQoKSB7XG4gICAgbGV0IGhlaWdodDtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgaGVpZ2h0ID0gdGhpcy5tZWRpYS5oZWlnaHQgfHwgdGhpcy5tZWRpYS5jbGllbnRIZWlnaHQgfHwgdGhpcy5tZWRpYS5vZmZzZXRIZWlnaHQ7XG4gICAgICBoZWlnaHQgKj0gdGhpcy5jb250ZW50U2NhbGVGYWN0b3I7IFxuICAgIH1cbiAgICByZXR1cm4gaGVpZ2h0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENhcExldmVsQ29udHJvbGxlcjsiLCIvKlxuICogTGV2ZWwgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgTGV2ZWxDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsXG4gICAgICBFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICBFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICBFdmVudC5FUlJPUik7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSAtMTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICB0aGlzLmNhbmxvYWQgPSB0cnVlO1xuICAgIC8vIHNwZWVkIHVwIGxpdmUgcGxheWxpc3QgcmVmcmVzaCBpZiB0aW1lciBleGlzdHNcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgdGhpcy5jYW5sb2FkID0gZmFsc2U7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgbGV2ZWxzMCA9IFtdLCBsZXZlbHMgPSBbXSwgYml0cmF0ZVN0YXJ0LCBpLCBiaXRyYXRlU2V0ID0ge30sIHZpZGVvQ29kZWNGb3VuZCA9IGZhbHNlLCBhdWRpb0NvZGVjRm91bmQgPSBmYWxzZSwgaGxzID0gdGhpcy5obHM7XG5cbiAgICAvLyByZWdyb3VwIHJlZHVuZGFudCBsZXZlbCB0b2dldGhlclxuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICB2aWRlb0NvZGVjRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYobGV2ZWwuYXVkaW9Db2RlYykge1xuICAgICAgICBhdWRpb0NvZGVjRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdmFyIHJlZHVuZGFudExldmVsSWQgPSBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdO1xuICAgICAgaWYgKHJlZHVuZGFudExldmVsSWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdID0gbGV2ZWxzMC5sZW5ndGg7XG4gICAgICAgIGxldmVsLnVybCA9IFtsZXZlbC51cmxdO1xuICAgICAgICBsZXZlbC51cmxJZCA9IDA7XG4gICAgICAgIGxldmVsczAucHVzaChsZXZlbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMwW3JlZHVuZGFudExldmVsSWRdLnVybC5wdXNoKGxldmVsLnVybCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyByZW1vdmUgYXVkaW8tb25seSBsZXZlbCBpZiB3ZSBhbHNvIGhhdmUgbGV2ZWxzIHdpdGggYXVkaW8rdmlkZW8gY29kZWNzIHNpZ25hbGxlZFxuICAgIGlmKHZpZGVvQ29kZWNGb3VuZCAmJiBhdWRpb0NvZGVjRm91bmQpIHtcbiAgICAgIGxldmVsczAuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAgIGlmKGxldmVsLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXZlbHMgPSBsZXZlbHMwO1xuICAgIH1cblxuICAgIC8vIG9ubHkga2VlcCBsZXZlbCB3aXRoIHN1cHBvcnRlZCBhdWRpby92aWRlbyBjb2RlY3NcbiAgICBsZXZlbHMgPSBsZXZlbHMuZmlsdGVyKGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgICB2YXIgY2hlY2tTdXBwb3J0ZWRBdWRpbyA9IGZ1bmN0aW9uKGNvZGVjKSB7IHJldHVybiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoYGF1ZGlvL21wNDtjb2RlY3M9JHtjb2RlY31gKTt9O1xuICAgICAgdmFyIGNoZWNrU3VwcG9ydGVkVmlkZW8gPSBmdW5jdGlvbihjb2RlYykgeyByZXR1cm4gTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKGB2aWRlby9tcDQ7Y29kZWNzPSR7Y29kZWN9YCk7fTtcbiAgICAgIHZhciBhdWRpb0NvZGVjID0gbGV2ZWwuYXVkaW9Db2RlYywgdmlkZW9Db2RlYyA9IGxldmVsLnZpZGVvQ29kZWM7XG5cbiAgICAgIHJldHVybiAoIWF1ZGlvQ29kZWMgfHwgY2hlY2tTdXBwb3J0ZWRBdWRpbyhhdWRpb0NvZGVjKSkgJiZcbiAgICAgICAgICAgICAoIXZpZGVvQ29kZWMgfHwgY2hlY2tTdXBwb3J0ZWRWaWRlbyh2aWRlb0NvZGVjKSk7XG4gICAgfSk7XG5cbiAgICBpZihsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgICAgYml0cmF0ZVN0YXJ0ID0gbGV2ZWxzWzBdLmJpdHJhdGU7XG4gICAgICAvLyBzb3J0IGxldmVsIG9uIGJpdHJhdGVcbiAgICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLmJpdHJhdGUgLSBiLmJpdHJhdGU7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX2xldmVscyA9IGxldmVscztcbiAgICAgIC8vIGZpbmQgaW5kZXggb2YgZmlyc3QgbGV2ZWwgaW4gc29ydGVkIGxldmVsc1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBpO1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGxvYWRlZCwke2xldmVscy5sZW5ndGh9IGxldmVsKHMpIGZvdW5kLCBmaXJzdCBiaXRyYXRlOiR7Yml0cmF0ZVN0YXJ0fWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHtsZXZlbHM6IHRoaXMuX2xldmVscywgZmlyc3RMZXZlbDogdGhpcy5fZmlyc3RMZXZlbCwgc3RhdHM6IGRhdGEuc3RhdHN9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfSU5DT01QQVRJQkxFX0NPREVDU19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogaGxzLnVybCwgcmVhc29uOiAnbm8gbGV2ZWwgd2l0aCBjb21wYXRpYmxlIGNvZGVjcyBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWxzO1xuICB9XG5cbiAgZ2V0IGxldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbDtcbiAgfVxuXG4gIHNldCBsZXZlbChuZXdMZXZlbCkge1xuICAgIGlmICh0aGlzLl9sZXZlbCAhPT0gbmV3TGV2ZWwgfHwgdGhpcy5fbGV2ZWxzW25ld0xldmVsXS5kZXRhaWxzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCk7XG4gICAgfVxuICB9XG5cbiBzZXRMZXZlbEludGVybmFsKG5ld0xldmVsKSB7XG4gICAgLy8gY2hlY2sgaWYgbGV2ZWwgaWR4IGlzIHZhbGlkXG4gICAgaWYgKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLl9sZXZlbHMubGVuZ3RoKSB7XG4gICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2xldmVsID0gbmV3TGV2ZWw7XG4gICAgICBsb2dnZXIubG9nKGBzd2l0Y2hpbmcgdG8gbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7bGV2ZWw6IG5ld0xldmVsfSk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdO1xuICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gbG9hZCBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbFxuICAgICAgaWYgKGxldmVsLmRldGFpbHMgPT09IHVuZGVmaW5lZCB8fCBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpIHtcbiAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIG9yIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byAocmUpbG9hZCBpdFxuICAgICAgICBsb2dnZXIubG9nKGAocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgICAgdmFyIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywge3VybDogbGV2ZWwudXJsW3VybElkXSwgbGV2ZWw6IG5ld0xldmVsLCBpZDogdXJsSWR9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk9USEVSX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTEVWRUxfU1dJVENIX0VSUk9SLCBsZXZlbDogbmV3TGV2ZWwsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgfVxuIH1cblxuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICB9XG5cbiAgc2V0IG1hbnVhbExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICBpZiAobmV3TGV2ZWwgIT09IC0xKSB7XG4gICAgICB0aGlzLmxldmVsID0gbmV3TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gIH1cblxuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIGlmICh0aGlzLl9zdGFydExldmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhcnRMZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX3N0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIG9uRXJyb3IoZGF0YSkge1xuICAgIGlmKGRhdGEuZmF0YWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZGV0YWlscyA9IGRhdGEuZGV0YWlscywgaGxzID0gdGhpcy5obHMsIGxldmVsSWQsIGxldmVsO1xuICAgIC8vIHRyeSB0byByZWNvdmVyIG5vdCBmYXRhbCBlcnJvcnNcbiAgICBzd2l0Y2goZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgIGxldmVsSWQgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGxldmVsSWQgPSBkYXRhLmxldmVsO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvKiB0cnkgdG8gc3dpdGNoIHRvIGEgcmVkdW5kYW50IHN0cmVhbSBpZiBhbnkgYXZhaWxhYmxlLlxuICAgICAqIGlmIG5vIHJlZHVuZGFudCBzdHJlYW0gYXZhaWxhYmxlLCBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gKGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgMClcbiAgICAgKiBvdGhlcndpc2UsIHdlIGNhbm5vdCByZWNvdmVyIHRoaXMgbmV0d29yayBlcnJvciAuLi5cbiAgICAgKiBkb24ndCByYWlzZSBGUkFHX0xPQURfRVJST1IgYW5kIEZSQUdfTE9BRF9USU1FT1VUIGFzIGZhdGFsLCBhcyBpdCBpcyBoYW5kbGVkIGJ5IG1lZGlhQ29udHJvbGxlclxuICAgICAqL1xuICAgIGlmIChsZXZlbElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdO1xuICAgICAgaWYgKGxldmVsLnVybElkIDwgKGxldmVsLnVybC5sZW5ndGggLSAxKSkge1xuICAgICAgICBsZXZlbC51cmxJZCsrO1xuICAgICAgICBsZXZlbC5kZXRhaWxzID0gdW5kZWZpbmVkO1xuICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9IGZvciBsZXZlbCAke2xldmVsSWR9OiBzd2l0Y2hpbmcgdG8gcmVkdW5kYW50IHN0cmVhbSBpZCAke2xldmVsLnVybElkfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2UgY291bGQgdHJ5IHRvIHJlY292ZXIgaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCBsb3dlc3QgbGV2ZWwgKDApXG4gICAgICAgIGxldCByZWNvdmVyYWJsZSA9ICgodGhpcy5fbWFudWFsTGV2ZWwgPT09IC0xKSAmJiBsZXZlbElkKTtcbiAgICAgICAgaWYgKHJlY292ZXJhYmxlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfTogZW1lcmdlbmN5IHN3aXRjaC1kb3duIGZvciBuZXh0IGZyYWdtZW50YCk7XG4gICAgICAgICAgaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbCA9IDA7XG4gICAgICAgIH0gZWxzZSBpZihsZXZlbCAmJiBsZXZlbC5kZXRhaWxzICYmIGxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gb24gbGl2ZSBzdHJlYW0sIGRpc2NhcmRgKTtcbiAgICAgICAgLy8gRlJBR19MT0FEX0VSUk9SIGFuZCBGUkFHX0xPQURfVElNRU9VVCBhcmUgaGFuZGxlZCBieSBtZWRpYUNvbnRyb2xsZXJcbiAgICAgICAgfSBlbHNlIGlmIChkZXRhaWxzICE9PSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SICYmIGRldGFpbHMgIT09IEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgY2Fubm90IHJlY292ZXIgJHtkZXRhaWxzfSBlcnJvcmApO1xuICAgICAgICAgIHRoaXMuX2xldmVsID0gdW5kZWZpbmVkO1xuICAgICAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHJlZGlzcGF0Y2ggc2FtZSBlcnJvciBidXQgd2l0aCBmYXRhbCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgIGRhdGEuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgIGhscy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheWxpc3QgaXMgYSBsaXZlIHBsYXlsaXN0XG4gICAgaWYgKGRhdGEuZGV0YWlscy5saXZlICYmICF0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0IHdlIHdpbGwgaGF2ZSB0byByZWxvYWQgaXQgcGVyaW9kaWNhbGx5XG4gICAgICAvLyBzZXQgcmVsb2FkIHBlcmlvZCB0byBwbGF5bGlzdCB0YXJnZXQgZHVyYXRpb25cbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwMCAqIGRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbi8zKTtcbiAgICB9XG4gICAgaWYgKCFkYXRhLmRldGFpbHMubGl2ZSAmJiB0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBwbGF5bGlzdCBpcyBub3QgbGl2ZSBhbmQgdGltZXIgaXMgYXJtZWQgOiBzdG9wcGluZyBpdFxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdmFyIGxldmVsSWQgPSB0aGlzLl9sZXZlbDtcbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkICYmIHRoaXMuY2FubG9hZCkge1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdLCB1cmxJZCA9IGxldmVsLnVybElkO1xuXHQgIHZhciB0b3RhbER1cmF0aW9uID0gMDtcblx0ICBmb3IgKHZhciBmIGluIGxldmVsLmRldGFpbHMuZnJhZ21lbnRzICkge1xuXHRcdCAgdG90YWxEdXJhdGlvbiA9IGxldmVsLmRldGFpbHMuZnJhZ21lbnRzW2ZdLmVuZFBUUztcblx0ICB9XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBsZXZlbElkLCBpZDogdXJsSWQsIHRvdGFsRHVyYXRpb246IHRvdGFsRHVyYXRpb24gfHwgMH0pO1xuICAgIH1cbiAgfVxuXG4gIGdldCBuZXh0TG9hZExldmVsKCkge1xuICAgIGlmICh0aGlzLl9tYW51YWxMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICByZXR1cm4gdGhpcy5obHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBuZXh0TG9hZExldmVsKG5leHRMZXZlbCkge1xuICAgIHRoaXMubGV2ZWwgPSBuZXh0TGV2ZWw7XG4gICAgaWYgKHRoaXMuX21hbnVhbExldmVsID09PSAtMSkge1xuICAgICAgdGhpcy5obHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsID0gbmV4dExldmVsO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbENvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBTdHJlYW0gQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IERlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvZGVtdXhlcic7XG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBCaW5hcnlTZWFyY2ggZnJvbSAnLi4vdXRpbHMvYmluYXJ5LXNlYXJjaCc7XG5pbXBvcnQgQnVmZmVySGVscGVyIGZyb20gJy4uL2hlbHBlci9idWZmZXItaGVscGVyJztcbmltcG9ydCBMZXZlbEhlbHBlciBmcm9tICcuLi9oZWxwZXIvbGV2ZWwtaGVscGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jb25zdCBTdGF0ZSA9IHtcbiAgU1RPUFBFRCA6ICdTVE9QUEVEJyxcbiAgU1RBUlRJTkcgOiAnU1RBUlRJTkcnLFxuICBJRExFIDogJ0lETEUnLFxuICBQQVVTRUQgOiAnUEFVU0VEJyxcbiAgS0VZX0xPQURJTkcgOiAnS0VZX0xPQURJTkcnLFxuICBGUkFHX0xPQURJTkcgOiAnRlJBR19MT0FESU5HJyxcbiAgRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlkgOiAnRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlknLFxuICBXQUlUSU5HX0xFVkVMIDogJ1dBSVRJTkdfTEVWRUwnLFxuICBQQVJTSU5HIDogJ1BBUlNJTkcnLFxuICBQQVJTRUQgOiAnUEFSU0VEJyxcbiAgRU5ERUQgOiAnRU5ERUQnLFxuICBFUlJPUiA6ICdFUlJPUidcbn07XG5cbmNsYXNzIFN0cmVhbUNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1FRElBX0FUVEFDSEVELFxuICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BRElORyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX1BBUlNFRCxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgIEV2ZW50LktFWV9MT0FERUQsXG4gICAgICBFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgIEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCxcbiAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsXG4gICAgICBFdmVudC5GUkFHX1BBUlNJTkdfREFUQSxcbiAgICAgIEV2ZW50LkZSQUdfUEFSU0VELFxuICAgICAgRXZlbnQuRVJST1IsXG4gICAgICBFdmVudC5CVUZGRVJfQVBQRU5ERUQsXG4gICAgICBFdmVudC5CVUZGRVJfRkxVU0hFRCk7XG5cbiAgICB0aGlzLmNvbmZpZyA9IGhscy5jb25maWc7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dhcCA9IGZhbHNlO1xuICAgIHRoaXMudGlja3MgPSAwO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcExvYWQoKTtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RPUFBFRDtcbiAgfVxuXG4gIHN0YXJ0TG9hZChzdGFydFBvc2l0aW9uPTApIHtcbiAgICBpZiAodGhpcy5sZXZlbHMpIHtcbiAgICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEsIGxhc3RDdXJyZW50VGltZSA9IHRoaXMubGFzdEN1cnJlbnRUaW1lO1xuICAgICAgdGhpcy5zdG9wTG9hZCgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXIodGhpcy5obHMpO1xuICAgICAgaWYgKCF0aGlzLnRpbWVyKSB7XG4gICAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGV2ZWwgPSAtMTtcbiAgICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gICAgICBpZiAobWVkaWEgJiYgbGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYGNvbmZpZ3VyZSBzdGFydFBvc2l0aW9uIEAke2xhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgICAgaWYgKCF0aGlzLmxhc3RQYXVzZWQpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdyZXN1bWluZyB2aWRlbycpO1xuICAgICAgICAgIG1lZGlhLnBsYXkoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy5zdGFydFBvc2l0aW9uID8gdGhpcy5zdGFydFBvc2l0aW9uIDogc3RhcnRQb3NpdGlvbjtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUQVJUSU5HO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oJ2Nhbm5vdCBzdGFydCBsb2FkaW5nIGFzIG1hbmlmZXN0IG5vdCBwYXJzZWQgeWV0Jyk7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RPUFBFRDtcbiAgICB9XG4gIH1cblxuICBzdG9wTG9hZCgpIHtcbiAgICB2YXIgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKGZyYWcpIHtcbiAgICAgIGlmIChmcmFnLmxvYWRlcikge1xuICAgICAgICBmcmFnLmxvYWRlci5hYm9ydCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgICBpZiAodGhpcy5kZW11eGVyKSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHRoaXMudGlja3MrKztcbiAgICBpZiAodGhpcy50aWNrcyA9PT0gMSkge1xuICAgICAgdGhpcy5kb1RpY2soKTtcbiAgICAgIGlmICh0aGlzLnRpY2tzID4gMSkge1xuICAgICAgICBzZXRUaW1lb3V0KHRoaXMudGljaywgMSk7XG4gICAgICB9XG4gICAgICB0aGlzLnRpY2tzID0gMDtcbiAgICB9XG4gIH1cblxuICBkb1RpY2soKSB7XG4gICAgdmFyIHBvcywgbGV2ZWwsIGxldmVsRGV0YWlscywgaGxzID0gdGhpcy5obHMsIGNvbmZpZyA9IGhscy5jb25maWc7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU3RhdGUuRVJST1I6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gZXJyb3Igc3RhdGUgdG8gYXZvaWQgYnJlYWtpbmcgZnVydGhlciAuLi5cbiAgICAgIGNhc2UgU3RhdGUuUEFVU0VEOlxuICAgICAgICAvL2Rvbid0IGRvIGFueXRoaW5nIGluIHBhdXNlZCBzdGF0ZSBlaXRoZXIgLi4uXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5TVEFSVElORzpcbiAgICAgICAgLy8gZGV0ZXJtaW5lIGxvYWQgbGV2ZWxcbiAgICAgICAgdGhpcy5zdGFydExldmVsID0gaGxzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdCaXRyYXRlVGVzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBzdGFydCBsZXZlbCBsb2FkXG4gICAgICAgIHRoaXMubGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLldBSVRJTkdfTEVWRUw7XG4gICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLklETEU6XG4gICAgICAgIC8vIGlmIHZpZGVvIG5vdCBhdHRhY2hlZCBBTkRcbiAgICAgICAgLy8gc3RhcnQgZnJhZ21lbnQgYWxyZWFkeSByZXF1ZXN0ZWQgT1Igc3RhcnQgZnJhZyBwcmVmZXRjaCBkaXNhYmxlXG4gICAgICAgIC8vIGV4aXQgbG9vcFxuICAgICAgICAvLyA9PiBpZiBtZWRpYSBub3QgYXR0YWNoZWQgYnV0IHN0YXJ0IGZyYWcgcHJlZmV0Y2ggaXMgZW5hYmxlZCBhbmQgc3RhcnQgZnJhZyBub3QgcmVxdWVzdGVkIHlldCwgd2Ugd2lsbCBub3QgZXhpdCBsb29wXG4gICAgICAgIGlmICghdGhpcy5tZWRpYSAmJlxuICAgICAgICAgICh0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCB8fCAhY29uZmlnLnN0YXJ0RnJhZ1ByZWZldGNoKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYgKHRoaXMubG9hZGVkbWV0YWRhdGEpIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvcyA9IHRoaXMubmV4dExvYWRQb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBsb2FkIGxldmVsXG4gICAgICAgIGlmICh0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBsZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3ZSBhcmUgbm90IGF0IHBsYXliYWNrIHN0YXJ0LCBnZXQgbmV4dCBsb2FkIGxldmVsIGZyb20gbGV2ZWwgQ29udHJvbGxlclxuICAgICAgICAgIGxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWw7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSBCdWZmZXJIZWxwZXIuYnVmZmVySW5mbyh0aGlzLm1lZGlhLHBvcyxjb25maWcubWF4QnVmZmVySG9sZSksXG4gICAgICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJJbmZvLmxlbixcbiAgICAgICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLFxuICAgICAgICAgICAgZnJhZ1ByZXZpb3VzID0gdGhpcy5mcmFnUHJldmlvdXMsXG4gICAgICAgICAgICBtYXhCdWZMZW47XG5cdFx0Ly8gY29uc29sZS5pbmZvKGJ1ZmZlckluZm8pO1xuICAgICAgICAvLyBjb21wdXRlIG1heCBCdWZmZXIgTGVuZ3RoIHRoYXQgd2UgY291bGQgZ2V0IGZyb20gdGhpcyBsb2FkIGxldmVsLCBiYXNlZCBvbiBsZXZlbCBiaXRyYXRlLiBkb24ndCBidWZmZXIgbW9yZSB0aGFuIDYwIE1CIGFuZCBtb3JlIHRoYW4gMzBzXG4gICAgICAgIGlmICgodGhpcy5sZXZlbHNbbGV2ZWxdKS5oYXNPd25Qcm9wZXJ0eSgnYml0cmF0ZScpKSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5tYXgoOCAqIGNvbmZpZy5tYXhCdWZmZXJTaXplIC8gdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUsIGNvbmZpZy5tYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWluKG1heEJ1ZkxlbiwgY29uZmlnLm1heE1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gY29uZmlnLm1heEJ1ZmZlckxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBidWZmZXIgbGVuZ3RoIGlzIGxlc3MgdGhhbiBtYXhCdWZMZW4gdHJ5IHRvIGxvYWQgYSBuZXcgZnJhZ21lbnRcbiAgICAgICAgaWYgKGJ1ZmZlckxlbiA8IG1heEJ1Zkxlbikge1xuICAgICAgICAgIC8vIHNldCBuZXh0IGxvYWQgbGV2ZWwgOiB0aGlzIHdpbGwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWQgaWYgbmVlZGVkXG4gICAgICAgICAgaGxzLm5leHRMb2FkTGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgICAgbGV2ZWxEZXRhaWxzID0gdGhpcy5sZXZlbHNbbGV2ZWxdLmRldGFpbHM7XG4gICAgICAgICAgLy8gaWYgbGV2ZWwgaW5mbyBub3QgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBlbnN1cmUgdGhhdCBuZXcgcGxheWxpc3QgaGFzIGJlZW4gcmVmcmVzaGVkIHRvIGF2b2lkIGxvYWRpbmcvdHJ5IHRvIGxvYWRcbiAgICAgICAgICAvLyBhIHVzZWxlc3MgYW5kIG91dGRhdGVkIGZyYWdtZW50ICh0aGF0IG1pZ2h0IGV2ZW4gaW50cm9kdWNlIGxvYWQgZXJyb3IgaWYgaXQgaXMgYWxyZWFkeSBvdXQgb2YgdGhlIGxpdmUgcGxheWxpc3QpXG4gICAgICAgICAgaWYgKHR5cGVvZiBsZXZlbERldGFpbHMgPT09ICd1bmRlZmluZWQnIHx8IGxldmVsRGV0YWlscy5saXZlICYmIHRoaXMubGV2ZWxMYXN0TG9hZGVkICE9PSBsZXZlbCkge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLldBSVRJTkdfTEVWRUw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZmluZCBmcmFnbWVudCBpbmRleCwgY29udGlndW91cyB3aXRoIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgICBsZXQgZnJhZ21lbnRzID0gbGV2ZWxEZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgICAgICAgZnJhZ0xlbiA9IGZyYWdtZW50cy5sZW5ndGgsXG4gICAgICAgICAgICAgIHN0YXJ0ID0gZnJhZ21lbnRzWzBdLnN0YXJ0LFxuICAgICAgICAgICAgICBlbmQgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXS5zdGFydCArIGZyYWdtZW50c1tmcmFnTGVuLTFdLmR1cmF0aW9uLFxuICAgICAgICAgICAgICBmcmFnO1xuXG4gICAgICAgICAgICAvLyBpbiBjYXNlIG9mIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byBlbnN1cmUgdGhhdCByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgbm90IGxvY2F0ZWQgYmVmb3JlIHBsYXlsaXN0IHN0YXJ0XG4gICAgICAgICAgaWYgKGxldmVsRGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgd2l0aGluIHNlZWthYmxlIGJvdW5kYXJpZXMgOlxuICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBzdGFydC9wb3MvYnVmRW5kL3NlZWtpbmc6JHtzdGFydC50b0ZpeGVkKDMpfS8ke3Bvcy50b0ZpeGVkKDMpfS8ke2J1ZmZlckVuZC50b0ZpeGVkKDMpfS8ke3RoaXMubWVkaWEuc2Vla2luZ31gKTtcbiAgICAgICAgICAgIGxldCBtYXhMYXRlbmN5ID0gY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uIDogY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCpsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb247XG5cbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBNYXRoLm1heChzdGFydCwgZW5kIC0gbWF4TGF0ZW5jeSkpIHtcbiAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0TGF0ZW5jeSA9IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uICE9PSB1bmRlZmluZWQgPyBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiA6IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb247XG4gICAgICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHN0YXJ0ICsgTWF0aC5tYXgoMCwgbGV2ZWxEZXRhaWxzLnRvdGFsZHVyYXRpb24gLSB0YXJnZXRMYXRlbmN5KTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBidWZmZXIgZW5kOiAke2J1ZmZlckVuZH0gaXMgbG9jYXRlZCB0b28gZmFyIGZyb20gdGhlIGVuZCBvZiBsaXZlIHNsaWRpbmcgcGxheWxpc3QsIG1lZGlhIHBvc2l0aW9uIHdpbGwgYmUgcmVzZXRlZCB0bzogJHt0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgICAgICAgICAgYnVmZmVyRW5kID0gdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCAmJiAhbGV2ZWxEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgICAgIC8qIHdlIGFyZSBzd2l0Y2hpbmcgbGV2ZWwgb24gbGl2ZSBwbGF5bGlzdCwgYnV0IHdlIGRvbid0IGhhdmUgYW55IFBUUyBpbmZvIGZvciB0aGF0IHF1YWxpdHkgbGV2ZWwgLi4uXG4gICAgICAgICAgICAgICAgIHRyeSB0byBsb2FkIGZyYWcgbWF0Y2hpbmcgd2l0aCBuZXh0IFNOLlxuICAgICAgICAgICAgICAgICBldmVuIGlmIFNOIGFyZSBub3Qgc3luY2hyb25pemVkIGJldHdlZW4gcGxheWxpc3RzLCBsb2FkaW5nIHRoaXMgZnJhZyB3aWxsIGhlbHAgdXNcbiAgICAgICAgICAgICAgICAgY29tcHV0ZSBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmUgYWZ0ZXIgaW4gY2FzZSBpdCB3YXMgbm90IHRoZSByaWdodCBjb25zZWN1dGl2ZSBvbmUgKi9cbiAgICAgICAgICAgICAgaWYgKGZyYWdQcmV2aW91cykge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXRTTiA9IGZyYWdQcmV2aW91cy5zbiArIDE7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFNOID49IGxldmVsRGV0YWlscy5zdGFydFNOICYmIHRhcmdldFNOIDw9IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1t0YXJnZXRTTiAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgbG9hZCBmcmFnIHdpdGggbmV4dCBTTjogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgICAgICAvKiB3ZSBoYXZlIG5vIGlkZWEgYWJvdXQgd2hpY2ggZnJhZ21lbnQgc2hvdWxkIGJlIGxvYWRlZC5cbiAgICAgICAgICAgICAgICAgICBzbyBsZXQncyBsb2FkIG1pZCBmcmFnbWVudC4gaXQgd2lsbCBoZWxwIGNvbXB1dGluZyBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmVcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbTWF0aC5taW4oZnJhZ0xlbiAtIDEsIE1hdGgucm91bmQoZnJhZ0xlbiAvIDIpKV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCB1bmtub3duLCBsb2FkIG1pZGRsZSBmcmFnIDogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFZvRCBwbGF5bGlzdDogaWYgYnVmZmVyRW5kIGJlZm9yZSBzdGFydCBvZiBwbGF5bGlzdCwgbG9hZCBmaXJzdCBmcmFnbWVudFxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgbGV0IGZvdW5kRnJhZztcbiAgICAgICAgICAgIGxldCBtYXhGcmFnTG9va1VwVG9sZXJhbmNlID0gY29uZmlnLm1heEZyYWdMb29rVXBUb2xlcmFuY2U7XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgZW5kKSB7XG4gICAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPiBlbmQgLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlKSB7XG4gICAgICAgICAgICAgICAgbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gQmluYXJ5U2VhcmNoLnNlYXJjaChmcmFnbWVudHMsIChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBvZmZzZXQgc2hvdWxkIGJlIHdpdGhpbiBmcmFnbWVudCBib3VuZGFyeSAtIGNvbmZpZy5tYXhGcmFnTG9va1VwVG9sZXJhbmNlXG4gICAgICAgICAgICAgICAgLy8gdGhpcyBpcyB0byBjb3BlIHdpdGggc2l0dWF0aW9ucyBsaWtlXG4gICAgICAgICAgICAgICAgLy8gYnVmZmVyRW5kID0gOS45OTFcbiAgICAgICAgICAgICAgICAvLyBmcmFnW8OYXSA6IFswLDEwXVxuICAgICAgICAgICAgICAgIC8vIGZyYWdbMV0gOiBbMTAsMjBdXG4gICAgICAgICAgICAgICAgLy8gYnVmZmVyRW5kIGlzIHdpdGhpbiBmcmFnWzBdIHJhbmdlIC4uLiBhbHRob3VnaCB3aGF0IHdlIGFyZSBleHBlY3RpbmcgaXMgdG8gcmV0dXJuIGZyYWdbMV0gaGVyZVxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgZnJhZyBzdGFydCAgICAgICAgICAgICAgIGZyYWcgc3RhcnQrZHVyYXRpb25cbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICB8LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18XG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICA8LS0tPiAgICAgICAgICAgICAgICAgICAgICAgICA8LS0tPlxuICAgICAgICAgICAgICAgICAgICAvLyAgLi4uLS0tLS0tLS0+PC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tPjwtLS0tLS0tLS0uLi4uXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZXZpb3VzIGZyYWcgICAgICAgICBtYXRjaGluZyBmcmFnbWVudCAgICAgICAgIG5leHQgZnJhZ1xuICAgICAgICAgICAgICAgICAgICAvLyAgcmV0dXJuIC0xICAgICAgICAgICAgIHJldHVybiAwICAgICAgICAgICAgICAgICByZXR1cm4gMVxuICAgICAgICAgICAgICAgIC8vIGxvZ2dlci5sb2coYGxldmVsL3NuL3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtjYW5kaWRhdGUuc259LyR7Y2FuZGlkYXRlLnN0YXJ0IC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZX0vJHsoY2FuZGlkYXRlLnN0YXJ0K2NhbmRpZGF0ZS5kdXJhdGlvbiAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2UpfS8ke2J1ZmZlckVuZH1gKTtcbiAgICAgICAgICAgICAgICBpZiAoKGNhbmRpZGF0ZS5zdGFydCArIGNhbmRpZGF0ZS5kdXJhdGlvbiAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2UpIDw9IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNhbmRpZGF0ZS5zdGFydCAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgPiBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgICAgICB9XG5cdFx0XHQgIFx0Ly8gY29uc29sZS5pbmZvKGNhbmRpZGF0ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICAgIH0pO1xuXHRcdFx0ICAvLyBjb25zb2xlLmluZm8oZm91bmRGcmFnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb3VuZEZyYWcpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZvdW5kRnJhZztcbiAgICAgICAgICAgICAgc3RhcnQgPSBmb3VuZEZyYWcuc3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRU9TKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVOREVEO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWcpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuICAgICAgICAgICAgaWYgKChmcmFnLmRlY3J5cHRkYXRhLnVyaSAhPSBudWxsKSAmJiAoZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyBrZXkgZm9yICR7ZnJhZy5zbn0gb2YgWyR7bGV2ZWxEZXRhaWxzLnN0YXJ0U059ICwke2xldmVsRGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5LRVlfTE9BRElORztcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBMb2FkaW5nICR7ZnJhZy5zbn0gb2YgWyR7bGV2ZWxEZXRhaWxzLnN0YXJ0U059ICwke2xldmVsRGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9LCBjdXJyZW50VGltZToke3Bvc30sYnVmZmVyRW5kOiR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgICAgICAgIGZyYWcuYXV0b0xldmVsID0gaGxzLmF1dG9MZXZlbEVuYWJsZWQ7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmxldmVscy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IE1hdGgucm91bmQoZnJhZy5kdXJhdGlvbiAqIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlIC8gOCk7XG4gICAgICAgICAgICAgICAgZnJhZy50cmVxdWVzdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGFyZSBub3QgcmVsb2FkaW5nIHRoZSBzYW1lIGZyYWdtZW50cyBpbiBsb29wIC4uLlxuICAgICAgICAgICAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCsrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHggPSAwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyKSB7XG4gICAgICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIGxldCBtYXhUaHJlc2hvbGQgPSBjb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgZnJhZyBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZCAzIHRpbWVzLCBhbmQgaWYgaXQgaGFzIGJlZW4gcmVsb2FkZWQgcmVjZW50bHlcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlciA+IG1heFRocmVzaG9sZCAmJiAoTWF0aC5hYnModGhpcy5mcmFnTG9hZElkeCAtIGZyYWcubG9hZElkeCkgPCBtYXhUaHJlc2hvbGQpKSB7XG4gICAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIgPSAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWcubG9hZElkeCA9IHRoaXMuZnJhZ0xvYWRJZHg7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBmcmFnO1xuICAgICAgICAgICAgICB0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRElORywge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLldBSVRJTkdfTEVWRUw6XG4gICAgICAgIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkXG4gICAgICAgIGlmIChsZXZlbCAmJiBsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZOlxuICAgICAgICB2YXIgbm93ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHZhciByZXRyeURhdGUgPSB0aGlzLnJldHJ5RGF0ZTtcbiAgICAgICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICAgICAgdmFyIGlzU2Vla2luZyA9IG1lZGlhICYmIG1lZGlhLnNlZWtpbmc7XG4gICAgICAgIC8vIGlmIGN1cnJlbnQgdGltZSBpcyBndCB0aGFuIHJldHJ5RGF0ZSwgb3IgaWYgbWVkaWEgc2Vla2luZyBsZXQncyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGlmKCFyZXRyeURhdGUgfHwgKG5vdyA+PSByZXRyeURhdGUpIHx8IGlzU2Vla2luZykge1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1lZGlhQ29udHJvbGxlcjogcmV0cnlEYXRlIHJlYWNoZWQsIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGVgKTtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RPUFBFRDpcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTSU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTRUQ6XG4gICAgICBjYXNlIFN0YXRlLkVOREVEOlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjayBidWZmZXJcbiAgICB0aGlzLl9jaGVja0J1ZmZlcigpO1xuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG5cblxuXG4gIGdldEJ1ZmZlclJhbmdlKHBvc2l0aW9uKSB7XG4gICAgdmFyIGksIHJhbmdlLFxuICAgICAgICBidWZmZXJSYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2U7XG4gICAgaWYgKGJ1ZmZlclJhbmdlKSB7XG4gICAgICBmb3IgKGkgPSBidWZmZXJSYW5nZS5sZW5ndGggLSAxOyBpID49MDsgaS0tKSB7XG4gICAgICAgIHJhbmdlID0gYnVmZmVyUmFuZ2VbaV07XG4gICAgICAgIGlmIChwb3NpdGlvbiA+PSByYW5nZS5zdGFydCAmJiBwb3NpdGlvbiA8PSByYW5nZS5lbmQpIHtcbiAgICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgICAgaWYgKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICAvLyBmaXJzdCBnZXQgZW5kIHJhbmdlIG9mIGN1cnJlbnQgZnJhZ21lbnRcbiAgICAgIHJldHVybiB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmb2xsb3dpbmdCdWZmZXJSYW5nZShyYW5nZSkge1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgLy8gdHJ5IHRvIGdldCByYW5nZSBvZiBuZXh0IGZyYWdtZW50ICg1MDBtcyBhZnRlciB0aGlzIHJhbmdlKVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyUmFuZ2UocmFuZ2UuZW5kICsgMC41KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHZhciByYW5nZSA9IHRoaXMubmV4dEJ1ZmZlclJhbmdlO1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLm1lZGlhLCBidWZmZXJlZCA9IHYuYnVmZmVyZWQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHBvc2l0aW9uID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvc2l0aW9uIDw9IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCkge1xuICAgIHZhciByYW5nZUN1cnJlbnQsIGN1cnJlbnRUaW1lLCB2aWRlbyA9IHRoaXMubWVkaWE7XG4gICAgaWYgKHZpZGVvICYmIHZpZGVvLnNlZWtpbmcgPT09IGZhbHNlKSB7XG4gICAgICBjdXJyZW50VGltZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgLyogaWYgdmlkZW8gZWxlbWVudCBpcyBpbiBzZWVrZWQgc3RhdGUsIGN1cnJlbnRUaW1lIGNhbiBvbmx5IGluY3JlYXNlLlxuICAgICAgICAoYXNzdW1pbmcgdGhhdCBwbGF5YmFjayByYXRlIGlzIHBvc2l0aXZlIC4uLilcbiAgICAgICAgQXMgc29tZXRpbWVzIGN1cnJlbnRUaW1lIGp1bXBzIGJhY2sgdG8gemVybyBhZnRlciBhXG4gICAgICAgIG1lZGlhIGRlY29kZSBlcnJvciwgY2hlY2sgdGhpcywgdG8gYXZvaWQgc2Vla2luZyBiYWNrIHRvXG4gICAgICAgIHdyb25nIHBvc2l0aW9uIGFmdGVyIGEgbWVkaWEgZGVjb2RlIGVycm9yXG4gICAgICAqL1xuICAgICAgaWYoY3VycmVudFRpbWUgPiB2aWRlby5wbGF5YmFja1JhdGUqdGhpcy5sYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSBjdXJyZW50VGltZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUpKSB7XG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUgKyAwLjEpKSB7XG4gICAgICAgIC8qIGVuc3VyZSB0aGF0IEZSQUdfQ0hBTkdFRCBldmVudCBpcyB0cmlnZ2VyZWQgYXQgc3RhcnR1cCxcbiAgICAgICAgICB3aGVuIGZpcnN0IHZpZGVvIGZyYW1lIGlzIGRpc3BsYXllZCBhbmQgcGxheWJhY2sgaXMgcGF1c2VkLlxuICAgICAgICAgIGFkZCBhIHRvbGVyYW5jZSBvZiAxMDBtcywgaW4gY2FzZSBjdXJyZW50IHBvc2l0aW9uIGlzIG5vdCBidWZmZXJlZCxcbiAgICAgICAgICBjaGVjayBpZiBjdXJyZW50IHBvcysxMDBtcyBpcyBidWZmZXJlZCBhbmQgdXNlIHRoYXQgYnVmZmVyIHJhbmdlXG4gICAgICAgICAgZm9yIEZSQUdfQ0hBTkdFRCBldmVudCByZXBvcnRpbmcgKi9cbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSArIDAuMSk7XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2VDdXJyZW50KSB7XG4gICAgICAgIHZhciBmcmFnUGxheWluZyA9IHJhbmdlQ3VycmVudC5mcmFnO1xuICAgICAgICBpZiAoZnJhZ1BsYXlpbmcgIT09IHRoaXMuZnJhZ1BsYXlpbmcpIHtcbiAgICAgICAgICB0aGlzLmZyYWdQbGF5aW5nID0gZnJhZ1BsYXlpbmc7XG4gICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0NIQU5HRUQsIHtmcmFnOiBmcmFnUGxheWluZ30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIDpcbiAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgIC0gY2FuY2VsIGFueSBwZW5kaW5nIGxvYWQgcmVxdWVzdFxuICAgICAtIGFuZCB0cmlnZ2VyIGEgYnVmZmVyIGZsdXNoXG4gICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGxvZ2dlci5sb2coJ2ltbWVkaWF0ZUxldmVsU3dpdGNoJyk7XG4gICAgaWYgKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy5tZWRpYS5wYXVzZWQ7XG4gICAgICB0aGlzLm1lZGlhLnBhdXNlKCk7XG4gICAgfVxuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIC8vIGZsdXNoIGV2ZXJ5dGhpbmdcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiAwLCBlbmRPZmZzZXQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICAvKlxuICAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAgIC0gbnVkZ2UgdmlkZW8gZGVjb2RlciBieSBzbGlnaHRseSBhZGp1c3RpbmcgdmlkZW8gY3VycmVudFRpbWVcbiAgICAgIC0gcmVzdW1lIHRoZSBwbGF5YmFjayBpZiBuZWVkZWRcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lIC09IDAuMDAwMTtcbiAgICBpZiAoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy5tZWRpYS5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LCBjdXJyZW50UmFuZ2UsIG5leHRSYW5nZTtcbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgIGlmIChjdXJyZW50UmFuZ2UgJiYgY3VycmVudFJhbmdlLnN0YXJ0ID4gMSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiAwLCBlbmRPZmZzZXQ6IGN1cnJlbnRSYW5nZS5zdGFydCAtIDF9KTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgfVxuICAgIGlmICghdGhpcy5tZWRpYS5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgdmFyIG5leHRMZXZlbElkID0gdGhpcy5obHMubmV4dExvYWRMZXZlbCxuZXh0TGV2ZWwgPSB0aGlzLmxldmVsc1tuZXh0TGV2ZWxJZF0sIGZyYWdMYXN0S2JwcyA9IHRoaXMuZnJhZ0xhc3RLYnBzO1xuICAgICAgaWYgKGZyYWdMYXN0S2JwcyAmJiB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSB0aGlzLmZyYWdDdXJyZW50LmR1cmF0aW9uICogbmV4dExldmVsLmJpdHJhdGUgLyAoMTAwMCAqIGZyYWdMYXN0S2JwcykgKyAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAvLyB3ZSBjYW4gZmx1c2ggYnVmZmVyIHJhbmdlIGZvbGxvd2luZyB0aGlzIG9uZSB3aXRob3V0IHN0YWxsaW5nIHBsYXliYWNrXG4gICAgICBuZXh0UmFuZ2UgPSB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKG5leHRSYW5nZSk7XG4gICAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAgIC8vIGZsdXNoIHBvc2l0aW9uIGlzIHRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGlzIG5ldyBidWZmZXJcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRkxVU0hJTkcsIHtzdGFydE9mZnNldDogbmV4dFJhbmdlLnN0YXJ0LCBlbmRPZmZzZXQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFVU0VEO1xuICAgICAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgd2UgY2FuIGFsc28gY2FuY2VsIGFueSBsb2FkaW5nL2RlbXV4aW5nIGluIHByb2dyZXNzLCBhcyB0aGV5IGFyZSB1c2VsZXNzXG4gICAgICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAgICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hlZChkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbk1lZGlhU2Vla2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252c2Vla2VkID0gdGhpcy5vbk1lZGlhU2Vla2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZlbmRlZCA9IHRoaXMub25NZWRpYUVuZGVkLmJpbmQodGhpcyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgIG1lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgaWYodGhpcy5sZXZlbHMgJiYgdGhpcy5jb25maWcuYXV0b1N0YXJ0TG9hZCkge1xuICAgICAgdGhpcy5obHMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmIChtZWRpYSAmJiBtZWRpYS5lbmRlZCkge1xuICAgICAgbG9nZ2VyLmxvZygnTVNFIGRldGFjaGluZyBhbmQgdmlkZW8gZW5kZWQsIHJlc2V0IHN0YXJ0UG9zaXRpb24nKTtcbiAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkaW5nIGNvdW50ZXIgb24gTVNFIGRldGFjaGluZyB0byBhdm9pZCByZXBvcnRpbmcgRlJBR19MT09QX0xPQURJTkdfRVJST1IgYWZ0ZXIgZXJyb3IgcmVjb3ZlcnlcbiAgICB2YXIgbGV2ZWxzID0gdGhpcy5sZXZlbHM7XG4gICAgaWYgKGxldmVscykge1xuICAgICAgLy8gcmVzZXQgZnJhZ21lbnQgbG9hZCBjb3VudGVyXG4gICAgICAgIGxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgICBpZihsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgICBsZXZlbC5kZXRhaWxzLmZyYWdtZW50cy5mb3JFYWNoKGZyYWdtZW50ID0+IHtcbiAgICAgICAgICAgICAgZnJhZ21lbnQubG9hZENvdW50ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyc1xuICAgIGlmIChtZWRpYSkge1xuICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgID0gdGhpcy5vbnZlbmRlZCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICB0aGlzLnN0b3BMb2FkKCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2luZygpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYgKEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHRoaXMubWVkaWEsdGhpcy5tZWRpYS5jdXJyZW50VGltZSx0aGlzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICBpZiAoZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkVOREVEKSB7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGNoZWNrIGZvciBwb3RlbnRpYWwgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICAvLyBhdm9pZCByZXBvcnRpbmcgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIGluIGNhc2UgdXNlciBpcyBzZWVraW5nIHNldmVyYWwgdGltZXMgb24gc2FtZSBwb3NpdGlvblxuICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgZW5kZWQnKTtcbiAgICAvLyByZXNldCBzdGFydFBvc2l0aW9uIGFuZCBsYXN0Q3VycmVudFRpbWUgdG8gcmVzdGFydCBwbGF5YmFjayBAIHN0cmVhbSBiZWdpbm5pbmdcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gIH1cblxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKCkge1xuICAgIC8vIHJlc2V0IGJ1ZmZlciBvbiBtYW5pZmVzdCBsb2FkaW5nXG4gICAgbG9nZ2VyLmxvZygndHJpZ2dlciBCVUZGRVJfUkVTRVQnKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9SRVNFVCk7XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIHRoaXMuc3RhbGxlZCA9IGZhbHNlO1xuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgdmFyIGFhYyA9IGZhbHNlLCBoZWFhYyA9IGZhbHNlLCBjb2RlYztcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICBjb2RlYyA9IGxldmVsLmF1ZGlvQ29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgIGhlYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3aXRjaCA9IChhYWMgJiYgaGVhYWMpO1xuICAgIGlmICh0aGlzLmF1ZGlvQ29kZWNTd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBsZXZlbCBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLmhscy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgbmV3RGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGR1cmF0aW9uID0gbmV3RGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICBzbGlkaW5nID0gMDtcblxuICAgIGxvZ2dlci5sb2coYGxldmVsICR7bmV3TGV2ZWxJZH0gbG9hZGVkIFske25ld0RldGFpbHMuc3RhcnRTTn0sJHtuZXdEZXRhaWxzLmVuZFNOfV0sZHVyYXRpb246JHtkdXJhdGlvbn1gKTtcbiAgICB0aGlzLmxldmVsTGFzdExvYWRlZCA9IG5ld0xldmVsSWQ7XG5cbiAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgY3VyRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICBpZiAoY3VyRGV0YWlscykge1xuICAgICAgICAvLyB3ZSBhbHJlYWR5IGhhdmUgZGV0YWlscyBmb3IgdGhhdCBsZXZlbCwgbWVyZ2UgdGhlbVxuICAgICAgICBMZXZlbEhlbHBlci5tZXJnZURldGFpbHMoY3VyRGV0YWlscyxuZXdEZXRhaWxzKTtcbiAgICAgICAgc2xpZGluZyA9IG5ld0RldGFpbHMuZnJhZ21lbnRzWzBdLnN0YXJ0O1xuICAgICAgICBpZiAobmV3RGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke3NsaWRpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gb3V0ZGF0ZWQgUFRTLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gZmlyc3QgbG9hZCwgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGN1ckxldmVsLmRldGFpbHMgPSBuZXdEZXRhaWxzO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfVVBEQVRFRCwgeyBkZXRhaWxzOiBuZXdEZXRhaWxzLCBsZXZlbDogbmV3TGV2ZWxJZCB9KTtcblxuICAgIC8vIGNvbXB1dGUgc3RhcnQgcG9zaXRpb25cbiAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBzZXQgc3RhcnQgcG9zaXRpb24gdG8gYmUgZnJhZ21lbnQgTi10aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKHVzdWFsbHkgMylcbiAgICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgbGV0IHRhcmdldExhdGVuY3kgPSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uICE9PSB1bmRlZmluZWQgPyB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uIDogdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbmV3RGV0YWlscy50YXJnZXRkdXJhdGlvbjtcblx0XHQvLyB0YXJnZXRMYXRlbmN5ID0gMTU7XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IE1hdGgubWF4KDAsIHNsaWRpbmcgKyBkdXJhdGlvbiAtIHRhcmdldExhdGVuY3kpO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgIH1cbiAgICAvLyBvbmx5IHN3aXRjaCBiYXRjayB0byBJRExFIHN0YXRlIGlmIHdlIHdlcmUgd2FpdGluZyBmb3IgbGV2ZWwgdG8gc3RhcnQgZG93bmxvYWRpbmcgYSBuZXcgZnJhZ21lbnRcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuV0FJVElOR19MRVZFTCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25LZXlMb2FkZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLktFWV9MT0FESU5HKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZChkYXRhKSB7XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HICYmXG4gICAgICAgIGZyYWdDdXJyZW50ICYmXG4gICAgICAgIGRhdGEuZnJhZy5sZXZlbCA9PT0gZnJhZ0N1cnJlbnQubGV2ZWwgJiZcbiAgICAgICAgZGF0YS5mcmFnLnNuID09PSBmcmFnQ3VycmVudC5zbikge1xuICAgICAgaWYgKHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB0aGlzLmZyYWdCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHtzdGF0czogZGF0YS5zdGF0cywgZnJhZzogZnJhZ0N1cnJlbnR9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTSU5HO1xuICAgICAgICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgICAgIHRoaXMuc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgICAgICB2YXIgY3VycmVudExldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgICAgICBkZXRhaWxzID0gY3VycmVudExldmVsLmRldGFpbHMsXG4gICAgICAgICAgICBkdXJhdGlvbiA9IGRldGFpbHMudG90YWxkdXJhdGlvbixcbiAgICAgICAgICAgIHN0YXJ0ID0gZnJhZ0N1cnJlbnQuc3RhcnQsXG4gICAgICAgICAgICBsZXZlbCA9IGZyYWdDdXJyZW50LmxldmVsLFxuICAgICAgICAgICAgc24gPSBmcmFnQ3VycmVudC5zbixcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSBjdXJyZW50TGV2ZWwuYXVkaW9Db2RlYyB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0QXVkaW9Db2RlYztcbiAgICAgICAgaWYodGhpcy5hdWRpb0NvZGVjU3dhcCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3N3YXBwaW5nIHBsYXlsaXN0IGF1ZGlvIGNvZGVjJyk7XG4gICAgICAgICAgaWYoYXVkaW9Db2RlYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gdGhpcy5sYXN0QXVkaW9Db2RlYztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoYXVkaW9Db2RlYykge1xuICAgICAgICAgICAgaWYoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkge1xuICAgICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZyA9IDA7XG4gICAgICAgIC8vIGxvZ2dlci5sb2coYERlbXV4aW5nICR7c259IG9mIFske2RldGFpbHMuc3RhcnRTTn0gLCR7ZGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4vLyBcdFx0dmFyIHJlID0gLyhcXGQrKV9cXGQrLnRzLztcbi8vIFx0XHR2YXIgdDAgPSAwO1xuLy8gXHRcdHZhciBtID0gcmUuZXhlYyhmcmFnQ3VycmVudC51cmwpO1xuLy8gXHRcdHZhciB0MCA9IChtICYmIG1bMV0pID8gcGFyc2VJbnQoIG1bMV0gKS8xMDAwIDogMDtcbi8vXG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCwgYXVkaW9Db2RlYywgY3VycmVudExldmVsLnZpZGVvQ29kZWMsIHN0YXJ0LCBmcmFnQ3VycmVudC5jYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgZnJhZ0N1cnJlbnQuZGVjcnlwdGRhdGEsIHN0YXJ0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5mcmFnTG9hZEVycm9yID0gMDtcbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdJbml0U2VnbWVudChkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHZhciB0cmFja3MgPSBkYXRhLnRyYWNrcywgdHJhY2tOYW1lLCB0cmFjaztcblxuICAgICAgLy8gaW5jbHVkZSBsZXZlbENvZGVjIGluIGF1ZGlvIGFuZCB2aWRlbyB0cmFja3NcbiAgICAgIHRyYWNrID0gdHJhY2tzLmF1ZGlvO1xuICAgICAgaWYodHJhY2spIHtcbiAgICAgICAgdmFyIGF1ZGlvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLFxuICAgICAgICAgICAgdWEgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmKGF1ZGlvQ29kZWMgJiYgdGhpcy5hdWRpb0NvZGVjU3dhcCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3N3YXBwaW5nIHBsYXlsaXN0IGF1ZGlvIGNvZGVjJyk7XG4gICAgICAgICAgaWYoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGluIGNhc2UgQUFDIGFuZCBIRS1BQUMgYXVkaW8gY29kZWNzIGFyZSBzaWduYWxsZWQgaW4gbWFuaWZlc3RcbiAgICAgICAgLy8gZm9yY2UgSEUtQUFDICwgYXMgaXQgc2VlbXMgdGhhdCBtb3N0IGJyb3dzZXJzIHByZWZlcnMgdGhhdCB3YXksXG4gICAgICAgIC8vIGV4Y2VwdCBmb3IgbW9ubyBzdHJlYW1zIE9SIG9uIEZGXG4gICAgICAgIC8vIHRoZXNlIGNvbmRpdGlvbnMgbWlnaHQgbmVlZCB0byBiZSByZXZpZXdlZCAuLi5cbiAgICAgICAgaWYgKHRoaXMuYXVkaW9Db2RlY1N3aXRjaCkge1xuICAgICAgICAgICAgLy8gZG9uJ3QgZm9yY2UgSEUtQUFDIGlmIG1vbm8gc3RyZWFtXG4gICAgICAgICAgIGlmKHRyYWNrLm1ldGFkYXRhLmNoYW5uZWxDb3VudCAhPT0gMSAmJlxuICAgICAgICAgICAgLy8gZG9uJ3QgZm9yY2UgSEUtQUFDIGlmIGZpcmVmb3hcbiAgICAgICAgICAgIHVhLmluZGV4T2YoJ2ZpcmVmb3gnKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBIRS1BQUMgaXMgYnJva2VuIG9uIEFuZHJvaWQsIGFsd2F5cyBzaWduYWwgYXVkaW8gY29kZWMgYXMgQUFDIGV2ZW4gaWYgdmFyaWFudCBtYW5pZmVzdCBzdGF0ZXMgb3RoZXJ3aXNlXG4gICAgICAgIGlmKHVhLmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgQW5kcm9pZDogZm9yY2UgYXVkaW8gY29kZWMgdG9gICsgYXVkaW9Db2RlYyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJhY2subGV2ZWxDb2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgICB9XG4gICAgICB0cmFjayA9IHRyYWNrcy52aWRlbztcbiAgICAgIGlmKHRyYWNrKSB7XG4gICAgICAgIHRyYWNrLmxldmVsQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjO1xuICAgICAgfVxuXG4gICAgICAvLyBpZiByZW11eGVyIHNwZWNpZnkgdGhhdCBhIHVuaXF1ZSB0cmFjayBuZWVkcyB0byBnZW5lcmF0ZWQsXG4gICAgICAvLyBsZXQncyBtZXJnZSBhbGwgdHJhY2tzIHRvZ2V0aGVyXG4gICAgICBpZiAoZGF0YS51bmlxdWUpIHtcbiAgICAgICAgdmFyIG1lcmdlZFRyYWNrID0ge1xuICAgICAgICAgICAgY29kZWMgOiAnJyxcbiAgICAgICAgICAgIGxldmVsQ29kZWMgOiAnJ1xuICAgICAgICAgIH07XG4gICAgICAgIGZvciAodHJhY2tOYW1lIGluIGRhdGEudHJhY2tzKSB7XG4gICAgICAgICAgdHJhY2sgPSB0cmFja3NbdHJhY2tOYW1lXTtcbiAgICAgICAgICBtZXJnZWRUcmFjay5jb250YWluZXIgPSB0cmFjay5jb250YWluZXI7XG4gICAgICAgICAgaWYgKG1lcmdlZFRyYWNrLmNvZGVjKSB7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5jb2RlYyArPSAgJywnO1xuICAgICAgICAgICAgbWVyZ2VkVHJhY2subGV2ZWxDb2RlYyArPSAgJywnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZih0cmFjay5jb2RlYykge1xuICAgICAgICAgICAgbWVyZ2VkVHJhY2suY29kZWMgKz0gIHRyYWNrLmNvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodHJhY2subGV2ZWxDb2RlYykge1xuICAgICAgICAgICAgbWVyZ2VkVHJhY2subGV2ZWxDb2RlYyArPSAgdHJhY2subGV2ZWxDb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdHJhY2tzID0geyBhdWRpb3ZpZGVvIDogbWVyZ2VkVHJhY2sgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0NPREVDUyx0cmFja3MpO1xuICAgICAgLy8gbG9vcCB0aHJvdWdoIHRyYWNrcyB0aGF0IGFyZSBnb2luZyB0byBiZSBwcm92aWRlZCB0byBidWZmZXJDb250cm9sbGVyXG4gICAgICBmb3IgKHRyYWNrTmFtZSBpbiB0cmFja3MpIHtcbiAgICAgICAgdHJhY2sgPSB0cmFja3NbdHJhY2tOYW1lXTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgdHJhY2s6JHt0cmFja05hbWV9LGNvbnRhaW5lcjoke3RyYWNrLmNvbnRhaW5lcn0sY29kZWNzW2xldmVsL3BhcnNlZF09WyR7dHJhY2subGV2ZWxDb2RlY30vJHt0cmFjay5jb2RlY31dYCk7XG4gICAgICAgIHZhciBpbml0U2VnbWVudCA9IHRyYWNrLmluaXRTZWdtZW50O1xuICAgICAgICBpZiAoaW5pdFNlZ21lbnQpIHtcbiAgICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmcrKztcbiAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9BUFBFTkRJTkcsIHt0eXBlOiB0cmFja05hbWUsIGRhdGE6IGluaXRTZWdtZW50fSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnUGFyc2luZ0RhdGEoZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgICAgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG5cbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCAke2RhdGEudHlwZX0sUFRTOlske2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0sJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfV0sRFRTOlske2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfV0sbmI6JHtkYXRhLm5ifWApO1xuXG4gICAgICB2YXIgZHJpZnQgPSBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKGxldmVsLmRldGFpbHMsZnJhZy5zbixkYXRhLnN0YXJ0UFRTLGRhdGEuZW5kUFRTKSxcbiAgICAgICAgICBobHMgPSB0aGlzLmhscztcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1BUU19VUERBVEVELCB7ZGV0YWlsczogbGV2ZWwuZGV0YWlscywgbGV2ZWw6IHRoaXMubGV2ZWwsIGRyaWZ0OiBkcmlmdH0pO1xuXG4gICAgICBbZGF0YS5kYXRhMSwgZGF0YS5kYXRhMl0uZm9yRWFjaChidWZmZXIgPT4ge1xuICAgICAgICBpZiAoYnVmZmVyKSB7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nKys7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVORElORywge3R5cGU6IGRhdGEudHlwZSwgZGF0YTogYnVmZmVyfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSBkYXRhLmVuZFBUUztcbiAgICAgIHRoaXMuYnVmZmVyUmFuZ2UucHVzaCh7dHlwZTogZGF0YS50eXBlLCBzdGFydDogZGF0YS5zdGFydFBUUywgZW5kOiBkYXRhLmVuZFBUUywgZnJhZzogZnJhZ30pO1xuXG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2Fybihgbm90IGluIFBBUlNJTkcgc3RhdGUgYnV0ICR7dGhpcy5zdGF0ZX0sIGlnbm9yaW5nIEZSQUdfUEFSU0lOR19EQVRBIGV2ZW50YCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnUGFyc2VkKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTRUQ7XG4gICAgICB0aGlzLl9jaGVja0FwcGVuZGVkUGFyc2VkKCk7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRlZCgpIHtcbiAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0lORzpcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0VEOlxuICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmctLTtcbiAgICAgICAgdGhpcy5fY2hlY2tBcHBlbmRlZFBhcnNlZCgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIF9jaGVja0FwcGVuZGVkUGFyc2VkKCkge1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTRUQgJiYgdGhpcy5wZW5kaW5nQXBwZW5kaW5nID09PSAwKSAge1xuICAgICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50LCBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgICBpZiAoZnJhZykge1xuICAgICAgICB0aGlzLmZyYWdQcmV2aW91cyA9IGZyYWc7XG4gICAgICAgIHN0YXRzLnRidWZmZXJlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLmZyYWdMYXN0S2JwcyA9IE1hdGgucm91bmQoOCAqIHN0YXRzLmxlbmd0aCAvIChzdGF0cy50YnVmZmVyZWQgLSBzdGF0cy50Zmlyc3QpKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IHN0YXRzLCBmcmFnOiBmcmFnfSk7XG5cdFx0Ly8gY29uc29sZS5pbmZvKHN0YXRzKTtcblx0XHQvLyBjb25zb2xlLmluZm8oZnJhZyk7XG4gICAgICAgIGxvZ2dlci5sb2coYG1lZGlhIGJ1ZmZlcmVkIDogJHt0aGlzLnRpbWVSYW5nZXNUb1N0cmluZyh0aGlzLm1lZGlhLmJ1ZmZlcmVkKX1gKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkVycm9yKGRhdGEpIHtcbiAgICBzd2l0Y2goZGF0YS5kZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgICAgaWYoIWRhdGEuZmF0YWwpIHtcbiAgICAgICAgICB2YXIgbG9hZEVycm9yID0gdGhpcy5mcmFnTG9hZEVycm9yO1xuICAgICAgICAgIGlmKGxvYWRFcnJvcikge1xuICAgICAgICAgICAgbG9hZEVycm9yKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcj0xO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAobG9hZEVycm9yIDw9IHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnkpIHtcbiAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IGxvYWRFcnJvcjtcbiAgICAgICAgICAgIC8vIHJlc2V0IGxvYWQgY291bnRlciB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvclxuICAgICAgICAgICAgZGF0YS5mcmFnLmxvYWRDb3VudGVyID0gMDtcbiAgICAgICAgICAgIC8vIGV4cG9uZW50aWFsIGJhY2tvZmYgY2FwcGVkIHRvIDY0c1xuICAgICAgICAgICAgdmFyIGRlbGF5ID0gTWF0aC5taW4oTWF0aC5wb3coMixsb2FkRXJyb3ItMSkqdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LDY0MDAwKTtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6IGZyYWcgbG9hZGluZyBmYWlsZWQsIHJldHJ5IGluICR7ZGVsYXl9IG1zYCk7XG4gICAgICAgICAgICB0aGlzLnJldHJ5RGF0ZSA9IHBlcmZvcm1hbmNlLm5vdygpICsgZGVsYXk7XG4gICAgICAgICAgICAvLyByZXRyeSBsb2FkaW5nIHN0YXRlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgbWVkaWFDb250cm9sbGVyOiAke2RhdGEuZGV0YWlsc30gcmVhY2hlcyBtYXggcmV0cnksIHJlZGlzcGF0Y2ggYXMgZmF0YWwgLi4uYCk7XG4gICAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICAgIGRhdGEuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAvLyBpZiBmYXRhbCBlcnJvciwgc3RvcCBwcm9jZXNzaW5nLCBvdGhlcndpc2UgbW92ZSB0byBJRExFIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgbG9nZ2VyLndhcm4oYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHdoaWxlIGxvYWRpbmcgZnJhZyxzd2l0Y2ggdG8gJHtkYXRhLmZhdGFsID8gJ0VSUk9SJyA6ICdJRExFJ30gc3RhdGUgLi4uYCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBkYXRhLmZhdGFsID8gU3RhdGUuRVJST1IgOiBTdGF0ZS5JRExFO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkJVRkZFUl9GVUxMX0VSUk9SOlxuICAgICAgICAvLyB0cmlnZ2VyIGEgc21vb3RoIGxldmVsIHN3aXRjaCB0byBlbXB0eSBidWZmZXJzXG4gICAgICAgIC8vIGFsc28gcmVkdWNlIG1heCBidWZmZXIgbGVuZ3RoIGFzIGl0IG1pZ2h0IGJlIHRvbyBoaWdoLiB3ZSBkbyB0aGlzIHRvIGF2b2lkIGxvb3AgZmx1c2hpbmcgLi4uXG4gICAgICAgIHRoaXMuY29uZmlnLm1heE1heEJ1ZmZlckxlbmd0aC89MjtcbiAgICAgICAgbG9nZ2VyLndhcm4oYHJlZHVjZSBtYXggYnVmZmVyIGxlbmd0aCB0byAke3RoaXMuY29uZmlnLm1heE1heEJ1ZmZlckxlbmd0aH1zIGFuZCB0cmlnZ2VyIGEgbmV4dExldmVsU3dpdGNoIHRvIGZsdXNoIG9sZCBidWZmZXIgYW5kIGZpeCBRdW90YUV4Y2VlZGVkRXJyb3JgKTtcbiAgICAgICAgdGhpcy5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuX2NoZWNrQnVmZmVyKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYobWVkaWEpIHtcbiAgICAgIC8vIGNvbXBhcmUgcmVhZHlTdGF0ZVxuICAgICAgdmFyIHJlYWR5U3RhdGUgPSBtZWRpYS5yZWFkeVN0YXRlO1xuICAgICAgLy8gaWYgcmVhZHkgc3RhdGUgZGlmZmVyZW50IGZyb20gSEFWRV9OT1RISU5HIChudW1lcmljIHZhbHVlIDApLCB3ZSBhcmUgYWxsb3dlZCB0byBzZWVrXG4gICAgICBpZihyZWFkeVN0YXRlKSB7XG4gICAgICAgIHZhciB0YXJnZXRTZWVrUG9zaXRpb24sIGN1cnJlbnRUaW1lO1xuICAgICAgICAvLyBpZiBzZWVrIGFmdGVyIGJ1ZmZlcmVkIGRlZmluZWQsIGxldCdzIHNlZWsgaWYgd2l0aGluIGFjY2VwdGFibGUgcmFuZ2VcbiAgICAgICAgdmFyIHNlZWtBZnRlckJ1ZmZlcmVkID0gdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZDtcbiAgICAgICAgaWYoc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICBpZihtZWRpYS5kdXJhdGlvbiA+PSBzZWVrQWZ0ZXJCdWZmZXJlZCkge1xuICAgICAgICAgICAgdGFyZ2V0U2Vla1Bvc2l0aW9uID0gc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgICAgICB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50VGltZSA9IG1lZGlhLmN1cnJlbnRUaW1lO1xuICAgICAgICAgIHZhciBsb2FkZWRtZXRhZGF0YSA9IHRoaXMubG9hZGVkbWV0YWRhdGE7XG5cbiAgICAgICAgICAvLyBhZGp1c3QgY3VycmVudFRpbWUgdG8gc3RhcnQgcG9zaXRpb24gb24gbG9hZGVkIG1ldGFkYXRhXG4gICAgICAgICAgaWYoIWxvYWRlZG1ldGFkYXRhICYmIG1lZGlhLmJ1ZmZlcmVkLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgICAgICAgICAvLyBvbmx5IGFkanVzdCBjdXJyZW50VGltZSBpZiBub3QgZXF1YWwgdG8gMFxuICAgICAgICAgICAgaWYgKCFjdXJyZW50VGltZSAmJiBjdXJyZW50VGltZSAhPT0gdGhpcy5zdGFydFBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgIHRhcmdldFNlZWtQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRhcmdldFNlZWtQb3NpdGlvbikge1xuICAgICAgICAgIGN1cnJlbnRUaW1lID0gdGFyZ2V0U2Vla1Bvc2l0aW9uO1xuICAgICAgICAgIGxvZ2dlci5sb2coYHRhcmdldCBzZWVrIHBvc2l0aW9uOiR7dGFyZ2V0U2Vla1Bvc2l0aW9ufWApO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8obWVkaWEsY3VycmVudFRpbWUsMCksXG4gICAgICAgICAgICBleHBlY3RlZFBsYXlpbmcgPSAhKG1lZGlhLnBhdXNlZCB8fCBtZWRpYS5lbmRlZCB8fCBtZWRpYS5zZWVraW5nIHx8IHJlYWR5U3RhdGUgPCAyKSxcbiAgICAgICAgICAgIGp1bXBUaHJlc2hvbGQgPSAwLjQsIC8vIHRvbGVyYW5jZSBuZWVkZWQgYXMgc29tZSBicm93c2VycyBzdGFsbHMgcGxheWJhY2sgYmVmb3JlIHJlYWNoaW5nIGJ1ZmZlcmVkIHJhbmdlIGVuZFxuICAgICAgICAgICAgcGxheWhlYWRNb3ZpbmcgPSBjdXJyZW50VGltZSA+IG1lZGlhLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZTtcblxuICAgICAgICBpZiAodGhpcy5zdGFsbGVkICYmIHBsYXloZWFkTW92aW5nKSB7XG4gICAgICAgICAgdGhpcy5zdGFsbGVkID0gZmFsc2U7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgcGxheWJhY2sgbm90IHN0dWNrIGFueW1vcmUgQCR7Y3VycmVudFRpbWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2hlY2sgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgbGVzcyB0aGFuIDIwMG1zIGlzIGJ1ZmZlcmVkLCBhbmQgbWVkaWEgaXMgZXhwZWN0ZWQgdG8gcGxheSBidXQgcGxheWhlYWQgaXMgbm90IG1vdmluZyxcbiAgICAgICAgLy8gYW5kIHdlIGhhdmUgYSBuZXcgYnVmZmVyIHJhbmdlIGF2YWlsYWJsZSB1cGZyb250LCBsZXQncyBzZWVrIHRvIHRoYXQgb25lXG4gICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICBpZihwbGF5aGVhZE1vdmluZyB8fCAhZXhwZWN0ZWRQbGF5aW5nKSB7XG4gICAgICAgICAgICAvLyBwbGF5aGVhZCBtb3Zpbmcgb3IgbWVkaWEgbm90IHBsYXlpbmdcbiAgICAgICAgICAgIGp1bXBUaHJlc2hvbGQgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBwbGF5aGVhZCBub3QgbW92aW5nIEFORCBtZWRpYSBleHBlY3RlZCB0byBwbGF5XG4gICAgICAgICAgICBpZighdGhpcy5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYHBsYXliYWNrIHNlZW1zIHN0dWNrIEAke2N1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9TVEFMTEVEX0VSUk9SLCBmYXRhbDogZmFsc2V9KTtcbiAgICAgICAgICAgICAgdGhpcy5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgd2UgYXJlIGJlbG93IHRocmVzaG9sZCwgdHJ5IHRvIGp1bXAgaWYgbmV4dCBidWZmZXIgcmFuZ2UgaXMgY2xvc2VcbiAgICAgICAgICBpZihidWZmZXJJbmZvLmxlbiA8PSBqdW1wVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAvLyBubyBidWZmZXIgYXZhaWxhYmxlIEAgY3VycmVudFRpbWUsIGNoZWNrIGlmIG5leHQgYnVmZmVyIGlzIGNsb3NlICh3aXRoaW4gYSBjb25maWcubWF4U2Vla0hvbGUgc2Vjb25kIHJhbmdlKVxuICAgICAgICAgICAgdmFyIG5leHRCdWZmZXJTdGFydCA9IGJ1ZmZlckluZm8ubmV4dFN0YXJ0LCBkZWx0YSA9IG5leHRCdWZmZXJTdGFydC1jdXJyZW50VGltZTtcbiAgICAgICAgICAgIGlmKG5leHRCdWZmZXJTdGFydCAmJlxuICAgICAgICAgICAgICAgKGRlbHRhIDwgdGhpcy5jb25maWcubWF4U2Vla0hvbGUpICYmXG4gICAgICAgICAgICAgICAoZGVsdGEgPiAwKSAgJiZcbiAgICAgICAgICAgICAgICFtZWRpYS5zZWVraW5nKSB7XG4gICAgICAgICAgICAgIC8vIG5leHQgYnVmZmVyIGlzIGNsb3NlICEgYWRqdXN0IGN1cnJlbnRUaW1lIHRvIG5leHRCdWZmZXJTdGFydFxuICAgICAgICAgICAgICAvLyB0aGlzIHdpbGwgZW5zdXJlIGVmZmVjdGl2ZSB2aWRlbyBkZWNvZGluZ1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBhZGp1c3QgY3VycmVudFRpbWUgZnJvbSAke21lZGlhLmN1cnJlbnRUaW1lfSB0byBuZXh0IGJ1ZmZlcmVkIEAgJHtuZXh0QnVmZmVyU3RhcnR9YCk7XG4gICAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gbmV4dEJ1ZmZlclN0YXJ0O1xuICAgICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9TRUVLX09WRVJfSE9MRSwgZmF0YWw6IGZhbHNlfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0YXJnZXRTZWVrUG9zaXRpb24gJiYgbWVkaWEuY3VycmVudFRpbWUgIT09IHRhcmdldFNlZWtQb3NpdGlvbikge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYWRqdXN0IGN1cnJlbnRUaW1lIGZyb20gJHttZWRpYS5jdXJyZW50VGltZX0gdG8gJHt0YXJnZXRTZWVrUG9zaXRpb259YCk7XG4gICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IHRhcmdldFNlZWtQb3NpdGlvbjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCgpIHtcblx0ICBkZWJ1Z2dlcjtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uQnVmZmVyRmx1c2hlZCgpIHtcbiAgICAvKiBhZnRlciBzdWNjZXNzZnVsIGJ1ZmZlciBmbHVzaGluZywgcmVidWlsZCBidWZmZXIgUmFuZ2UgYXJyYXlcbiAgICAgIGxvb3AgdGhyb3VnaCBleGlzdGluZyBidWZmZXIgcmFuZ2UgYW5kIGNoZWNrIGlmXG4gICAgICBjb3JyZXNwb25kaW5nIHJhbmdlIGlzIHN0aWxsIGJ1ZmZlcmVkLiBvbmx5IHB1c2ggdG8gbmV3IGFycmF5IGFscmVhZHkgYnVmZmVyZWQgcmFuZ2VcbiAgICAqL1xuICAgIHZhciBuZXdSYW5nZSA9IFtdLHJhbmdlLGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmICh0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKSAvIDIpKSB7XG4gICAgICAgIG5ld1JhbmdlLnB1c2gocmFuZ2UpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gbmV3UmFuZ2U7XG5cbiAgICAvLyBoYW5kbGUgZW5kIG9mIGltbWVkaWF0ZSBzd2l0Y2hpbmcgaWYgbmVlZGVkXG4gICAgaWYgKHRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgfVxuICAgIC8vIG1vdmUgdG8gSURMRSBvbmNlIGZsdXNoIGNvbXBsZXRlLiB0aGlzIHNob3VsZCB0cmlnZ2VyIG5ldyBmcmFnbWVudCBsb2FkaW5nXG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgLy8gcmVzZXQgcmVmZXJlbmNlIHRvIGZyYWdcbiAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gIH1cblxuICBzd2FwQXVkaW9Db2RlYygpIHtcbiAgICB0aGlzLmF1ZGlvQ29kZWNTd2FwID0gIXRoaXMuYXVkaW9Db2RlY1N3YXA7XG4gIH1cblxuICB0aW1lUmFuZ2VzVG9TdHJpbmcocikge1xuICAgIHZhciBsb2cgPSAnJywgbGVuID0gci5sZW5ndGg7XG4gICAgZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG4gICAgICBsb2cgKz0gJ1snICsgci5zdGFydChpKSArICcsJyArIHIuZW5kKGkpICsgJ10nO1xuICAgIH1cbiAgICByZXR1cm4gbG9nO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW1Db250cm9sbGVyO1xuXG4iLCIvKlxuICogVGltZWxpbmUgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IENFQTcwOEludGVycHJldGVyIGZyb20gJy4uL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXInO1xuXG5jbGFzcyBUaW1lbGluZUNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50Lk1FRElBX0RFVEFDSElORyxcbiAgICAgICAgICAgICAgICBFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsXG4gICAgICAgICAgICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BRElORyxcbiAgICAgICAgICAgICAgICBFdmVudC5GUkFHX0xPQURFRCk7XG5cbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLmNvbmZpZyA9IGhscy5jb25maWc7XG5cbiAgICBpZiAodGhpcy5jb25maWcuZW5hYmxlQ0VBNzA4Q2FwdGlvbnMpXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlciA9IG5ldyBDRUE3MDhJbnRlcnByZXRlcigpO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1lZGlhQXR0YWNoaW5nKGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLmF0dGFjaChtZWRpYSk7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuZGV0YWNoKCk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZygpXG4gIHtcbiAgICB0aGlzLmxhc3RQdHMgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoZGF0YSlcbiAge1xuICAgIHZhciBwdHMgPSBkYXRhLmZyYWcuc3RhcnQ7IC8vTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXG4gICAgLy8gaWYgdGhpcyBpcyBhIGZyYWcgZm9yIGEgcHJldmlvdXNseSBsb2FkZWQgdGltZXJhbmdlLCByZW1vdmUgYWxsIGNhcHRpb25zXG4gICAgLy8gVE9ETzogY29uc2lkZXIganVzdCByZW1vdmluZyBjYXB0aW9ucyBmb3IgdGhlIHRpbWVyYW5nZVxuICAgIGlmIChwdHMgPD0gdGhpcy5sYXN0UHRzKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuY2xlYXIoKTtcbiAgICB9XG5cbiAgICB0aGlzLmxhc3RQdHMgPSBwdHM7XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nVXNlcmRhdGEoZGF0YSkge1xuICAgIC8vIHB1c2ggYWxsIG9mIHRoZSBDRUEtNzA4IG1lc3NhZ2VzIGludG8gdGhlIGludGVycHJldGVyXG4gICAgLy8gaW1tZWRpYXRlbHkuIEl0IHdpbGwgY3JlYXRlIHRoZSBwcm9wZXIgdGltZXN0YW1wcyBiYXNlZCBvbiBvdXIgUFRTIHZhbHVlXG4gICAgZm9yICh2YXIgaT0wOyBpPGRhdGEuc2FtcGxlcy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLnB1c2goZGF0YS5zYW1wbGVzW2ldLnB0cywgZGF0YS5zYW1wbGVzW2ldLmJ5dGVzKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGltZWxpbmVDb250cm9sbGVyO1xuIiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cbmNsYXNzIEFFUyB7XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlIG91dCBhbiBBRVMga2V5IGZvciBib3RoIGVuY3J5cHRpb24gYW5kIGRlY3J5cHRpb24uIFRoaXNcbiAgICogaXMgYSBsb3ctbGV2ZWwgY2xhc3MuIFVzZSBhIGNpcGhlciBtb2RlIHRvIGRvIGJ1bGsgZW5jcnlwdGlvbi5cbiAgICpcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSBrZXkge0FycmF5fSBUaGUga2V5IGFzIGFuIGFycmF5IG9mIDQsIDYgb3IgOCB3b3Jkcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGtleSkge1xuICAgIC8qKlxuICAgICAqIFRoZSBleHBhbmRlZCBTLWJveCBhbmQgaW52ZXJzZSBTLWJveCB0YWJsZXMuIFRoZXNlIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBvbiB0aGUgY2xpZW50IHNvIHRoYXQgd2UgZG9uJ3QgaGF2ZSB0byBzZW5kIHRoZW0gZG93biB0aGUgd2lyZS5cbiAgICAgKlxuICAgICAqIFRoZXJlIGFyZSB0d28gdGFibGVzLCBfdGFibGVzWzBdIGlzIGZvciBlbmNyeXB0aW9uIGFuZFxuICAgICAqIF90YWJsZXNbMV0gaXMgZm9yIGRlY3J5cHRpb24uXG4gICAgICpcbiAgICAgKiBUaGUgZmlyc3QgNCBzdWItdGFibGVzIGFyZSB0aGUgZXhwYW5kZWQgUy1ib3ggd2l0aCBNaXhDb2x1bW5zLiBUaGVcbiAgICAgKiBsYXN0IChfdGFibGVzWzAxXVs0XSkgaXMgdGhlIFMtYm94IGl0c2VsZi5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5fdGFibGVzID0gW1tbXSxbXSxbXSxbXSxbXV0sW1tdLFtdLFtdLFtdLFtdXV07XG5cbiAgICB0aGlzLl9wcmVjb21wdXRlKCk7XG5cbiAgICB2YXIgaSwgaiwgdG1wLFxuICAgIGVuY0tleSwgZGVjS2V5LFxuICAgIHNib3ggPSB0aGlzLl90YWJsZXNbMF1bNF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIGtleUxlbiA9IGtleS5sZW5ndGgsIHJjb24gPSAxO1xuXG4gICAgaWYgKGtleUxlbiAhPT0gNCAmJiBrZXlMZW4gIT09IDYgJiYga2V5TGVuICE9PSA4KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYWVzIGtleSBzaXplPScgKyBrZXlMZW4pO1xuICAgIH1cblxuICAgIGVuY0tleSA9IGtleS5zbGljZSgwKTtcbiAgICBkZWNLZXkgPSBbXTtcbiAgICB0aGlzLl9rZXkgPSBbZW5jS2V5LCBkZWNLZXldO1xuXG4gICAgLy8gc2NoZWR1bGUgZW5jcnlwdGlvbiBrZXlzXG4gICAgZm9yIChpID0ga2V5TGVuOyBpIDwgNCAqIGtleUxlbiArIDI4OyBpKyspIHtcbiAgICAgIHRtcCA9IGVuY0tleVtpLTFdO1xuXG4gICAgICAvLyBhcHBseSBzYm94XG4gICAgICBpZiAoaSVrZXlMZW4gPT09IDAgfHwgKGtleUxlbiA9PT0gOCAmJiBpJWtleUxlbiA9PT0gNCkpIHtcbiAgICAgICAgdG1wID0gc2JveFt0bXA+Pj4yNF08PDI0IF4gc2JveFt0bXA+PjE2JjI1NV08PDE2IF4gc2JveFt0bXA+PjgmMjU1XTw8OCBeIHNib3hbdG1wJjI1NV07XG5cbiAgICAgICAgLy8gc2hpZnQgcm93cyBhbmQgYWRkIHJjb25cbiAgICAgICAgaWYgKGkla2V5TGVuID09PSAwKSB7XG4gICAgICAgICAgdG1wID0gdG1wPDw4IF4gdG1wPj4+MjQgXiByY29uPDwyNDtcbiAgICAgICAgICByY29uID0gcmNvbjw8MSBeIChyY29uPj43KSoyODM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZW5jS2V5W2ldID0gZW5jS2V5W2kta2V5TGVuXSBeIHRtcDtcbiAgICB9XG5cbiAgICAvLyBzY2hlZHVsZSBkZWNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGogPSAwOyBpOyBqKyssIGktLSkge1xuICAgICAgdG1wID0gZW5jS2V5W2omMyA/IGkgOiBpIC0gNF07XG4gICAgICBpZiAoaTw9NCB8fCBqPDQpIHtcbiAgICAgICAgZGVjS2V5W2pdID0gdG1wO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVjS2V5W2pdID0gZGVjVGFibGVbMF1bc2JveFt0bXA+Pj4yNCAgICAgIF1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsxXVtzYm94W3RtcD4+MTYgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzJdW3Nib3hbdG1wPj44ICAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbM11bc2JveFt0bXAgICAgICAmIDI1NV1dO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHBhbmQgdGhlIFMtYm94IHRhYmxlcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcmVjb21wdXRlKCkge1xuICAgIHZhciBlbmNUYWJsZSA9IHRoaXMuX3RhYmxlc1swXSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAgc2JveCA9IGVuY1RhYmxlWzRdLCBzYm94SW52ID0gZGVjVGFibGVbNF0sXG4gICAgaSwgeCwgeEludiwgZD1bXSwgdGg9W10sIHgyLCB4NCwgeDgsIHMsIHRFbmMsIHREZWM7XG5cbiAgICAvLyBDb21wdXRlIGRvdWJsZSBhbmQgdGhpcmQgdGFibGVzXG4gICAgZm9yIChpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gICAgICB0aFsoIGRbaV0gPSBpPDwxIF4gKGk+PjcpKjI4MyApXmldPWk7XG4gICAgfVxuXG4gICAgZm9yICh4ID0geEludiA9IDA7ICFzYm94W3hdOyB4IF49IHgyIHx8IDEsIHhJbnYgPSB0aFt4SW52XSB8fCAxKSB7XG4gICAgICAvLyBDb21wdXRlIHNib3hcbiAgICAgIHMgPSB4SW52IF4geEludjw8MSBeIHhJbnY8PDIgXiB4SW52PDwzIF4geEludjw8NDtcbiAgICAgIHMgPSBzPj44IF4gcyYyNTUgXiA5OTtcbiAgICAgIHNib3hbeF0gPSBzO1xuICAgICAgc2JveEludltzXSA9IHg7XG5cbiAgICAgIC8vIENvbXB1dGUgTWl4Q29sdW1uc1xuICAgICAgeDggPSBkW3g0ID0gZFt4MiA9IGRbeF1dXTtcbiAgICAgIHREZWMgPSB4OCoweDEwMTAxMDEgXiB4NCoweDEwMDAxIF4geDIqMHgxMDEgXiB4KjB4MTAxMDEwMDtcbiAgICAgIHRFbmMgPSBkW3NdKjB4MTAxIF4gcyoweDEwMTAxMDA7XG5cbiAgICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgZW5jVGFibGVbaV1beF0gPSB0RW5jID0gdEVuYzw8MjQgXiB0RW5jPj4+ODtcbiAgICAgICAgZGVjVGFibGVbaV1bc10gPSB0RGVjID0gdERlYzw8MjQgXiB0RGVjPj4+ODtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb21wYWN0aWZ5LiBDb25zaWRlcmFibGUgc3BlZWR1cCBvbiBGaXJlZm94LlxuICAgIGZvciAoaSA9IDA7IGkgPCA1OyBpKyspIHtcbiAgICAgIGVuY1RhYmxlW2ldID0gZW5jVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgICBkZWNUYWJsZVtpXSA9IGRlY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IDE2IGJ5dGVzLCBzcGVjaWZpZWQgYXMgZm91ciAzMi1iaXQgd29yZHMuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQwIHtudW1iZXJ9IHRoZSBmaXJzdCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDEge251bWJlcn0gdGhlIHNlY29uZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDIge251bWJlcn0gdGhlIHRoaXJkIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMyB7bnVtYmVyfSB0aGUgZm91cnRoIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gb3V0IHtJbnQzMkFycmF5fSB0aGUgYXJyYXkgdG8gd3JpdGUgdGhlIGRlY3J5cHRlZCB3b3Jkc1xuICAgKiBpbnRvXG4gICAqIEBwYXJhbSBvZmZzZXQge251bWJlcn0gdGhlIG9mZnNldCBpbnRvIHRoZSBvdXRwdXQgYXJyYXkgdG8gc3RhcnRcbiAgICogd3JpdGluZyByZXN1bHRzXG4gICAqIEByZXR1cm4ge0FycmF5fSBUaGUgcGxhaW50ZXh0LlxuICAgKi9cbiAgZGVjcnlwdChlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLCBvdXQsIG9mZnNldCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9rZXlbMV0sXG4gICAgLy8gc3RhdGUgdmFyaWFibGVzIGEsYixjLGQgYXJlIGxvYWRlZCB3aXRoIHByZS13aGl0ZW5lZCBkYXRhXG4gICAgYSA9IGVuY3J5cHRlZDAgXiBrZXlbMF0sXG4gICAgYiA9IGVuY3J5cHRlZDMgXiBrZXlbMV0sXG4gICAgYyA9IGVuY3J5cHRlZDIgXiBrZXlbMl0sXG4gICAgZCA9IGVuY3J5cHRlZDEgXiBrZXlbM10sXG4gICAgYTIsIGIyLCBjMixcblxuICAgIG5Jbm5lclJvdW5kcyA9IGtleS5sZW5ndGggLyA0IC0gMiwgLy8ga2V5Lmxlbmd0aCA9PT0gMiA/XG4gICAgaSxcbiAgICBrSW5kZXggPSA0LFxuICAgIHRhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuXG4gICAgLy8gbG9hZCB1cCB0aGUgdGFibGVzXG4gICAgdGFibGUwICAgID0gdGFibGVbMF0sXG4gICAgdGFibGUxICAgID0gdGFibGVbMV0sXG4gICAgdGFibGUyICAgID0gdGFibGVbMl0sXG4gICAgdGFibGUzICAgID0gdGFibGVbM10sXG4gICAgc2JveCAgPSB0YWJsZVs0XTtcblxuICAgIC8vIElubmVyIHJvdW5kcy4gQ3JpYmJlZCBmcm9tIE9wZW5TU0wuXG4gICAgZm9yIChpID0gMDsgaSA8IG5Jbm5lclJvdW5kczsgaSsrKSB7XG4gICAgICBhMiA9IHRhYmxlMFthPj4+MjRdIF4gdGFibGUxW2I+PjE2ICYgMjU1XSBeIHRhYmxlMltjPj44ICYgMjU1XSBeIHRhYmxlM1tkICYgMjU1XSBeIGtleVtrSW5kZXhdO1xuICAgICAgYjIgPSB0YWJsZTBbYj4+PjI0XSBeIHRhYmxlMVtjPj4xNiAmIDI1NV0gXiB0YWJsZTJbZD4+OCAmIDI1NV0gXiB0YWJsZTNbYSAmIDI1NV0gXiBrZXlba0luZGV4ICsgMV07XG4gICAgICBjMiA9IHRhYmxlMFtjPj4+MjRdIF4gdGFibGUxW2Q+PjE2ICYgMjU1XSBeIHRhYmxlMlthPj44ICYgMjU1XSBeIHRhYmxlM1tiICYgMjU1XSBeIGtleVtrSW5kZXggKyAyXTtcbiAgICAgIGQgID0gdGFibGUwW2Q+Pj4yNF0gXiB0YWJsZTFbYT4+MTYgJiAyNTVdIF4gdGFibGUyW2I+PjggJiAyNTVdIF4gdGFibGUzW2MgJiAyNTVdIF4ga2V5W2tJbmRleCArIDNdO1xuICAgICAga0luZGV4ICs9IDQ7XG4gICAgICBhPWEyOyBiPWIyOyBjPWMyO1xuICAgIH1cblxuICAgIC8vIExhc3Qgcm91bmQuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgb3V0WygzICYgLWkpICsgb2Zmc2V0XSA9XG4gICAgICAgIHNib3hbYT4+PjI0ICAgICAgXTw8MjQgXlxuICAgICAgICBzYm94W2I+PjE2ICAmIDI1NV08PDE2IF5cbiAgICAgICAgc2JveFtjPj44ICAgJiAyNTVdPDw4ICBeXG4gICAgICAgIHNib3hbZCAgICAgICYgMjU1XSAgICAgXlxuICAgICAgICBrZXlba0luZGV4KytdO1xuICAgICAgYTI9YTsgYT1iOyBiPWM7IGM9ZDsgZD1hMjtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTO1xuIiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cblxuaW1wb3J0IEFFUyBmcm9tICcuL2Flcyc7XG5cbmNsYXNzIEFFUzEyOERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3Ioa2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgdGhpcy5pdiA9IGluaXRWZWN0b3I7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBuZXR3b3JrLW9yZGVyIChiaWctZW5kaWFuKSBieXRlcyBpbnRvIHRoZWlyIGxpdHRsZS1lbmRpYW5cbiAgICogcmVwcmVzZW50YXRpb24uXG4gICAqL1xuICBudG9oKHdvcmQpIHtcbiAgICByZXR1cm4gKHdvcmQgPDwgMjQpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMCkgPDwgOCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwMDApID4+IDgpIHxcbiAgICAgICh3b3JkID4+PiAyNCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IGJ5dGVzIHVzaW5nIEFFUy0xMjggd2l0aCBDQkMgYW5kIFBLQ1MjNyBwYWRkaW5nLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkIHtVaW50OEFycmF5fSB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAqIEBwYXJhbSBrZXkge1VpbnQzMkFycmF5fSB0aGUgYnl0ZXMgb2YgdGhlIGRlY3J5cHRpb24ga2V5XG4gICAqIEBwYXJhbSBpbml0VmVjdG9yIHtVaW50MzJBcnJheX0gdGhlIGluaXRpYWxpemF0aW9uIHZlY3RvciAoSVYpIHRvXG4gICAqIHVzZSBmb3IgdGhlIGZpcnN0IHJvdW5kIG9mIENCQy5cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIGRlY3J5cHRlZCBieXRlc1xuICAgKlxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQWR2YW5jZWRfRW5jcnlwdGlvbl9TdGFuZGFyZFxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmxvY2tfY2lwaGVyX21vZGVfb2Zfb3BlcmF0aW9uI0NpcGhlcl9CbG9ja19DaGFpbmluZ18uMjhDQkMuMjlcbiAgICogQHNlZSBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjMxNVxuICAgKi9cbiAgZG9EZWNyeXB0KGVuY3J5cHRlZCwga2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdmFyXG4gICAgICAvLyB3b3JkLWxldmVsIGFjY2VzcyB0byB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0LCBlbmNyeXB0ZWQuYnl0ZUxlbmd0aCA+PiAyKSxcblxuICAgIGRlY2lwaGVyID0gbmV3IEFFUyhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChrZXkpKSxcblxuICAgIC8vIGJ5dGUgYW5kIHdvcmQtbGV2ZWwgYWNjZXNzIGZvciB0aGUgZGVjcnlwdGVkIG91dHB1dFxuICAgIGRlY3J5cHRlZCA9IG5ldyBVaW50OEFycmF5KGVuY3J5cHRlZC5ieXRlTGVuZ3RoKSxcbiAgICBkZWNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGRlY3J5cHRlZC5idWZmZXIpLFxuXG4gICAgLy8gdGVtcG9yYXJ5IHZhcmlhYmxlcyBmb3Igd29ya2luZyB3aXRoIHRoZSBJViwgZW5jcnlwdGVkLCBhbmRcbiAgICAvLyBkZWNyeXB0ZWQgZGF0YVxuICAgIGluaXQwLCBpbml0MSwgaW5pdDIsIGluaXQzLFxuICAgIGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsXG5cbiAgICAvLyBpdGVyYXRpb24gdmFyaWFibGVcbiAgICB3b3JkSXg7XG5cbiAgICAvLyBwdWxsIG91dCB0aGUgd29yZHMgb2YgdGhlIElWIHRvIGVuc3VyZSB3ZSBkb24ndCBtb2RpZnkgdGhlXG4gICAgLy8gcGFzc2VkLWluIHJlZmVyZW5jZSBhbmQgZWFzaWVyIGFjY2Vzc1xuICAgIGluaXQwID0gfn5pbml0VmVjdG9yWzBdO1xuICAgIGluaXQxID0gfn5pbml0VmVjdG9yWzFdO1xuICAgIGluaXQyID0gfn5pbml0VmVjdG9yWzJdO1xuICAgIGluaXQzID0gfn5pbml0VmVjdG9yWzNdO1xuXG4gICAgLy8gZGVjcnlwdCBmb3VyIHdvcmQgc2VxdWVuY2VzLCBhcHBseWluZyBjaXBoZXItYmxvY2sgY2hhaW5pbmcgKENCQylcbiAgICAvLyB0byBlYWNoIGRlY3J5cHRlZCBibG9ja1xuICAgIGZvciAod29yZEl4ID0gMDsgd29yZEl4IDwgZW5jcnlwdGVkMzIubGVuZ3RoOyB3b3JkSXggKz0gNCkge1xuICAgICAgLy8gY29udmVydCBiaWctZW5kaWFuIChuZXR3b3JrIG9yZGVyKSB3b3JkcyBpbnRvIGxpdHRsZS1lbmRpYW5cbiAgICAgIC8vIChqYXZhc2NyaXB0IG9yZGVyKVxuICAgICAgZW5jcnlwdGVkMCA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeF0pO1xuICAgICAgZW5jcnlwdGVkMSA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDFdKTtcbiAgICAgIGVuY3J5cHRlZDIgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAyXSk7XG4gICAgICBlbmNyeXB0ZWQzID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgM10pO1xuXG4gICAgICAvLyBkZWNyeXB0IHRoZSBibG9ja1xuICAgICAgZGVjaXBoZXIuZGVjcnlwdChlbmNyeXB0ZWQwLFxuICAgICAgICAgIGVuY3J5cHRlZDEsXG4gICAgICAgICAgZW5jcnlwdGVkMixcbiAgICAgICAgICBlbmNyeXB0ZWQzLFxuICAgICAgICAgIGRlY3J5cHRlZDMyLFxuICAgICAgICAgIHdvcmRJeCk7XG5cbiAgICAgIC8vIFhPUiB3aXRoIHRoZSBJViwgYW5kIHJlc3RvcmUgbmV0d29yayBieXRlLW9yZGVyIHRvIG9idGFpbiB0aGVcbiAgICAgIC8vIHBsYWludGV4dFxuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4XSAgICAgPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4XSBeIGluaXQwKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdIF4gaW5pdDEpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gXiBpbml0Mik7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSBeIGluaXQzKTtcblxuICAgICAgLy8gc2V0dXAgdGhlIElWIGZvciB0aGUgbmV4dCByb3VuZFxuICAgICAgaW5pdDAgPSBlbmNyeXB0ZWQwO1xuICAgICAgaW5pdDEgPSBlbmNyeXB0ZWQxO1xuICAgICAgaW5pdDIgPSBlbmNyeXB0ZWQyO1xuICAgICAgaW5pdDMgPSBlbmNyeXB0ZWQzO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cblxuICBsb2NhbERlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMuZG9EZWNyeXB0KGVuY3J5cHRlZCxcbiAgICAgICAga2V5LFxuICAgICAgICBpbml0VmVjdG9yKTtcbiAgICBkZWNyeXB0ZWQuc2V0KGJ5dGVzLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCk7XG4gIH1cblxuICBkZWNyeXB0KGVuY3J5cHRlZCkge1xuICAgIHZhclxuICAgICAgc3RlcCA9IDQgKiA4MDAwLFxuICAgIC8vZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyKSxcbiAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZCksXG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGkgPSAwO1xuXG4gICAgLy8gc3BsaXQgdXAgdGhlIGVuY3J5cHRpb24gam9iIGFuZCBkbyB0aGUgaW5kaXZpZHVhbCBjaHVua3MgYXN5bmNocm9ub3VzbHlcbiAgICB2YXIga2V5ID0gdGhpcy5rZXk7XG4gICAgdmFyIGluaXRWZWN0b3IgPSB0aGlzLml2O1xuICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuXG4gICAgZm9yIChpID0gc3RlcDsgaSA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgaSArPSBzdGVwKSB7XG4gICAgICBpbml0VmVjdG9yID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDRdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDNdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDJdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDFdKVxuICAgICAgXSk7XG4gICAgICB0aGlzLmxvY2FsRGVjcnlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUzEyOERlY3J5cHRlcjtcbiIsIi8qXG4gKiBBRVMxMjggZGVjcnlwdGlvbi5cbiAqL1xuXG5pbXBvcnQgQUVTMTI4RGVjcnlwdGVyIGZyb20gJy4vYWVzMTI4LWRlY3J5cHRlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBicm93c2VyQ3J5cHRvID0gd2luZG93ID8gd2luZG93LmNyeXB0byA6IGNyeXB0bztcbiAgICAgIHRoaXMuc3VidGxlID0gYnJvd3NlckNyeXB0by5zdWJ0bGUgfHwgYnJvd3NlckNyeXB0by53ZWJraXRTdWJ0bGU7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSAhdGhpcy5zdWJ0bGU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgZGVjcnlwdChkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmRpc2FibGVXZWJDcnlwdG8gJiYgdGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIGRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgV2ViQ3J5cHRvIEFQSScpO1xuXG4gICAgdGhpcy5zdWJ0bGUuaW1wb3J0S2V5KCdyYXcnLCBrZXksIHsgbmFtZSA6ICdBRVMtQ0JDJywgbGVuZ3RoIDogMTI4IH0sIGZhbHNlLCBbJ2RlY3J5cHQnXSkuXG4gICAgICB0aGVuKChpbXBvcnRlZEtleSkgPT4ge1xuICAgICAgICB0aGlzLnN1YnRsZS5kZWNyeXB0KHsgbmFtZSA6ICdBRVMtQ0JDJywgaXYgOiBpdi5idWZmZXIgfSwgaW1wb3J0ZWRLZXksIGRhdGEpLlxuICAgICAgICAgIHRoZW4oY2FsbGJhY2spLlxuICAgICAgICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KS5cbiAgICBjYXRjaCAoKGVycikgPT4ge1xuICAgICAgdGhpcy5vbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0pO1xuICB9XG5cbiAgZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5OCwgaXY4LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgSmF2YVNjcmlwdCBJbXBsZW1lbnRhdGlvbicpO1xuXG4gICAgdmFyIHZpZXcgPSBuZXcgRGF0YVZpZXcoa2V5OC5idWZmZXIpO1xuICAgIHZhciBrZXkgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcoaXY4LmJ1ZmZlcik7XG4gICAgdmFyIGl2ID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDQpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig4KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMTIpXG4gICAgXSk7XG5cbiAgICB2YXIgZGVjcnlwdGVyID0gbmV3IEFFUzEyOERlY3J5cHRlcihrZXksIGl2KTtcbiAgICBjYWxsYmFjayhkZWNyeXB0ZXIuZGVjcnlwdChkYXRhKS5idWZmZXIpO1xuICB9XG5cbiAgb25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzYWJsaW5nIHRvIHVzZSBXZWJDcnlwdG8gQVBJJyk7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgbG9nZ2VyLmVycm9yKGBkZWNyeXB0aW5nIGVycm9yIDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0RFQ1JZUFRfRVJST1IsIGZhdGFsIDogdHJ1ZSwgcmVhc29uIDogZXJyLm1lc3NhZ2V9KTtcbiAgICB9XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEZWNyeXB0ZXI7XG4iLCIvKipcbiAqIEFBQyBkZW11eGVyXG4gKi9cbmltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBJRDMgZnJvbSAnLi4vZGVtdXgvaWQzJztcblxuIGNsYXNzIEFBQ0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLnJlbXV4ZXIgPSBuZXcgdGhpcy5yZW11eGVyQ2xhc3Mob2JzZXJ2ZXIpO1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge2NvbnRhaW5lciA6ICdhdWRpby9hZHRzJywgdHlwZTogJ2F1ZGlvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9iZShkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgZGF0YSBjb250YWlucyBJRDMgdGltZXN0YW1wIGFuZCBBRFRTIHN5bmMgd29yY1xuICAgIHZhciBpZDMgPSBuZXcgSUQzKGRhdGEpLCBvZmZzZXQsbGVuO1xuICAgIGlmKGlkMy5oYXNUaW1lU3RhbXApIHtcbiAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICBmb3IgKG9mZnNldCA9IGlkMy5sZW5ndGgsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgICBpZiAoKGRhdGFbb2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbb2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FEVFMgc3luYyB3b3JkIGZvdW5kICEnKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBpZDMgPSBuZXcgSUQzKGRhdGEpLFxuICAgICAgICBwdHMgPSA5MCppZDMudGltZVN0YW1wLFxuICAgICAgICBjb25maWcsIGZyYW1lTGVuZ3RoLCBmcmFtZUR1cmF0aW9uLCBmcmFtZUluZGV4LCBvZmZzZXQsIGhlYWRlckxlbmd0aCwgc3RhbXAsIGxlbiwgYWFjU2FtcGxlO1xuICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgZm9yIChvZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgb2Zmc2V0IDwgbGVuIC0gMTsgb2Zmc2V0KyspIHtcbiAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIGZyYW1lSW5kZXggPSAwO1xuICAgIGZyYW1lRHVyYXRpb24gPSAxMDI0ICogOTAwMDAgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgd2hpbGUgKChvZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gVGhlIHByb3RlY3Rpb24gc2tpcCBiaXQgdGVsbHMgdXMgaWYgd2UgaGF2ZSAyIGJ5dGVzIG9mIENSQyBkYXRhIGF0IHRoZSBlbmQgb2YgdGhlIEFEVFMgaGVhZGVyXG4gICAgICBoZWFkZXJMZW5ndGggPSAoISEoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgZnJhbWVMZW5ndGggPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSkgfFxuICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0ICsgNF0gPDwgMykgfFxuICAgICAgICAgICAgICAgICAgICAoKGRhdGFbb2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBmcmFtZUxlbmd0aCAgLT0gaGVhZGVyTGVuZ3RoO1xuICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG5cbiAgICAgIGlmICgoZnJhbWVMZW5ndGggPiAwKSAmJiAoKG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSA8PSBsZW4pKSB7XG4gICAgICAgIHN0YW1wID0gcHRzICsgZnJhbWVJbmRleCAqIGZyYW1lRHVyYXRpb247XG4gICAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3RvdGFsL3B0czoke29mZnNldCtoZWFkZXJMZW5ndGh9LyR7ZnJhbWVMZW5ndGh9LyR7ZGF0YS5ieXRlTGVuZ3RofS8keyhzdGFtcC85MCkudG9GaXhlZCgwKX1gKTtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoLCBvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCksIHB0czogc3RhbXAsIGR0czogc3RhbXB9O1xuICAgICAgICB0cmFjay5zYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGZyYW1lTGVuZ3RoO1xuICAgICAgICBvZmZzZXQgKz0gZnJhbWVMZW5ndGggKyBoZWFkZXJMZW5ndGg7XG4gICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBvZmZzZXQgPCAobGVuIC0gMSk7IG9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVtvZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLHtzYW1wbGVzIDogW119LCB7c2FtcGxlcyA6IFsgeyBwdHM6IHB0cywgZHRzIDogcHRzLCB1bml0IDogaWQzLnBheWxvYWR9IF19LCB7IHNhbXBsZXM6IFtdIH0sIHRpbWVPZmZzZXQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEFBQ0RlbXV4ZXI7XG4iLCIvKipcbiAqICBBRFRTIHBhcnNlciBoZWxwZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIEFEVFMge1xuXG4gIHN0YXRpYyBnZXRBdWRpb0NvbmZpZyhvYnNlcnZlciwgZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwLFxuICAgICAgICAgICAgMTEwMjUsIDgwMDAsXG4gICAgICAgICAgICA3MzUwXTtcbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhW29mZnNldCArIDJdICYgMHgzQykgPj4+IDIpO1xuICAgIGlmKGFkdHNTYW1wbGVpbmdJbmRleCA+IGFkdHNTYW1wbGVpbmdSYXRlcy5sZW5ndGgtMSkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCByZWFzb246IGBpbnZhbGlkIEFEVFMgc2FtcGxpbmcgaW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9YH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhW29mZnNldCArIDJdICYgMHgwMSkgPDwgMik7XG4gICAgLy8gYnl0ZSAzXG4gICAgYWR0c0NoYW5lbENvbmZpZyB8PSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweEMwKSA+Pj4gNik7XG4gICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgY29kZWM6JHthdWRpb0NvZGVjfSxBRFRTIGRhdGE6dHlwZToke2FkdHNPYmplY3RUeXBlfSxzYW1wbGVpbmdJbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1bJHthZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XX1Iel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG4gICAgLy8gZmlyZWZveDogZnJlcSBsZXNzIHRoYW4gMjRrSHogPSBBQUMgU0JSIChIRS1BQUMpXG4gICAgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICAgIC8vIEFuZHJvaWQgOiBhbHdheXMgdXNlIEFBQ1xuICAgIH0gZWxzZSBpZiAodXNlckFnZW50LmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogIGZvciBvdGhlciBicm93c2VycyAoY2hyb21lIC4uLilcbiAgICAgICAgICBhbHdheXMgZm9yY2UgYXVkaW8gdHlwZSB0byBiZSBIRS1BQUMgU0JSLCBhcyBzb21lIGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaCBwcm9wZXJseSAobGlrZSBDaHJvbWUgLi4uKVxuICAgICAgKi9cbiAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMgb3IgSEUtQUFDdjIpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYgKChhdWRpb0NvZGVjICYmICgoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjI5JykgIT09IC0xKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpKSkgfHxcbiAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpKSB7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEFBQykgQU5EIChmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6IEFORCBuYiBjaGFubmVsIGlzIDEpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIGFuZCBtb25vIGF1ZGlvKVxuICAgICAgICAvLyBDaHJvbWUgZmFpbHMgdG8gcGxheSBiYWNrIHdpdGggbG93IGZyZXF1ZW5jeSBBQUMgTEMgbW9ubyB3aGVuIGluaXRpYWxpemVkIHdpdGggSEUtQUFDLiAgVGhpcyBpcyBub3QgYSBwcm9ibGVtIHdpdGggc3RlcmVvLlxuICAgICAgICBpZiAoYXVkaW9Db2RlYyAmJiBhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSAmJiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYgJiYgYWR0c0NoYW5lbENvbmZpZyA9PT0gMSkgfHxcbiAgICAgICAgICAgICghYXVkaW9Db2RlYyAmJiBhZHRzQ2hhbmVsQ29uZmlnID09PSAxKSkge1xuICAgICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIH1cbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICAgIElTTyAxNDQ5Ni0zIChBQUMpLnBkZiAtIFRhYmxlIDEuMTMg4oCUIFN5bnRheCBvZiBBdWRpb1NwZWNpZmljQ29uZmlnKClcbiAgICAgIEF1ZGlvIFByb2ZpbGUgLyBBdWRpbyBPYmplY3QgVHlwZVxuICAgICAgMDogTnVsbFxuICAgICAgMTogQUFDIE1haW5cbiAgICAgIDI6IEFBQyBMQyAoTG93IENvbXBsZXhpdHkpXG4gICAgICAzOiBBQUMgU1NSIChTY2FsYWJsZSBTYW1wbGUgUmF0ZSlcbiAgICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgICAgNTogU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKVxuICAgICAgNjogQUFDIFNjYWxhYmxlXG4gICAgIHNhbXBsaW5nIGZyZXFcbiAgICAgIDA6IDk2MDAwIEh6XG4gICAgICAxOiA4ODIwMCBIelxuICAgICAgMjogNjQwMDAgSHpcbiAgICAgIDM6IDQ4MDAwIEh6XG4gICAgICA0OiA0NDEwMCBIelxuICAgICAgNTogMzIwMDAgSHpcbiAgICAgIDY6IDI0MDAwIEh6XG4gICAgICA3OiAyMjA1MCBIelxuICAgICAgODogMTYwMDAgSHpcbiAgICAgIDk6IDEyMDAwIEh6XG4gICAgICAxMDogMTEwMjUgSHpcbiAgICAgIDExOiA4MDAwIEh6XG4gICAgICAxMjogNzM1MCBIelxuICAgICAgMTM6IFJlc2VydmVkXG4gICAgICAxNDogUmVzZXJ2ZWRcbiAgICAgIDE1OiBmcmVxdWVuY3kgaXMgd3JpdHRlbiBleHBsaWN0bHlcbiAgICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAgIDA6IERlZmluZWQgaW4gQU9UIFNwZWNpZmMgQ29uZmlnXG4gICAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgICAqL1xuICAgIC8vIGF1ZGlvT2JqZWN0VHlwZSA9IHByb2ZpbGUgPT4gcHJvZmlsZSwgdGhlIE1QRUctNCBBdWRpbyBPYmplY3QgVHlwZSBtaW51cyAxXG4gICAgY29uZmlnWzBdID0gYWR0c09iamVjdFR5cGUgPDwgMztcbiAgICAvLyBzYW1wbGluZ0ZyZXF1ZW5jeUluZGV4XG4gICAgY29uZmlnWzBdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgIGNvbmZpZ1sxXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAvLyBjaGFubmVsQ29uZmlndXJhdGlvblxuICAgIGNvbmZpZ1sxXSB8PSBhZHRzQ2hhbmVsQ29uZmlnIDw8IDM7XG4gICAgaWYgKGFkdHNPYmplY3RUeXBlID09PSA1KSB7XG4gICAgICAvLyBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXhcbiAgICAgIGNvbmZpZ1sxXSB8PSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICAgIGNvbmZpZ1syXSA9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgICAgLy8gYWR0c09iamVjdFR5cGUgKGZvcmNlIHRvIDIsIGNocm9tZSBpcyBjaGVja2luZyB0aGF0IG9iamVjdCB0eXBlIGlzIGxlc3MgdGhhbiA1ID8/P1xuICAgICAgLy8gICAgaHR0cHM6Ly9jaHJvbWl1bS5nb29nbGVzb3VyY2UuY29tL2Nocm9taXVtL3NyYy5naXQvKy9tYXN0ZXIvbWVkaWEvZm9ybWF0cy9tcDQvYWFjLmNjXG4gICAgICBjb25maWdbMl0gfD0gMiA8PCAyO1xuICAgICAgY29uZmlnWzNdID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIHtjb25maWc6IGNvbmZpZywgc2FtcGxlcmF0ZTogYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF0sIGNoYW5uZWxDb3VudDogYWR0c0NoYW5lbENvbmZpZywgY29kZWM6ICgnbXA0YS40MC4nICsgYWR0c09iamVjdFR5cGUpfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRFRTO1xuIiwiLyogIGlubGluZSBkZW11eGVyLlxuICogICBwcm9iZSBmcmFnbWVudHMgYW5kIGluc3RhbnRpYXRlIGFwcHJvcHJpYXRlIGRlbXV4ZXIgZGVwZW5kaW5nIG9uIGNvbnRlbnQgdHlwZSAoVFNEZW11eGVyLCBBQUNEZW11eGVyLCAuLi4pXG4gKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBBQUNEZW11eGVyIGZyb20gJy4uL2RlbXV4L2FhY2RlbXV4ZXInO1xuaW1wb3J0IFRTRGVtdXhlciBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuaW1wb3J0IE1QNFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvbXA0LXJlbXV4ZXInO1xuaW1wb3J0IFBhc3NUaHJvdWdoUmVtdXhlciBmcm9tICcuLi9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyJztcblxuY2xhc3MgRGVtdXhlcklubGluZSB7XG5cbiAgY29uc3RydWN0b3IoaGxzLHR5cGVTdXBwb3J0ZWQpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLnR5cGVTdXBwb3J0ZWQgPSB0eXBlU3VwcG9ydGVkO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoZGVtdXhlcikge1xuICAgICAgZGVtdXhlci5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoIWRlbXV4ZXIpIHtcbiAgICAgIHZhciBobHMgPSB0aGlzLmhscztcbiAgICAgIC8vIHByb2JlIGZvciBjb250ZW50IHR5cGVcbiAgICAgIGlmIChUU0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgaWYgKHRoaXMudHlwZVN1cHBvcnRlZC5tcDJ0ID09PSB0cnVlKSB7XG4gICAgICAgICAgZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoaGxzLFBhc3NUaHJvdWdoUmVtdXhlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYoQUFDRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBkZW11eGVyID0gbmV3IEFBQ0RlbXV4ZXIoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogJ25vIGRlbXV4IG1hdGNoaW5nIHdpdGggY29udGVudCBmb3VuZCd9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eGVyID0gZGVtdXhlcjtcbiAgICB9XG4gICAgZGVtdXhlci5wdXNoKGRhdGEsYXVkaW9Db2RlYyx2aWRlb0NvZGVjLHRpbWVPZmZzZXQsY2MsbGV2ZWwsc24sZHVyYXRpb24sIHQwKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVySW5saW5lO1xuIiwiLyogZGVtdXhlciB3ZWIgd29ya2VyLlxuICogIC0gbGlzdGVuIHRvIHdvcmtlciBtZXNzYWdlLCBhbmQgdHJpZ2dlciBEZW11eGVySW5saW5lIHVwb24gcmVjZXB0aW9uIG9mIEZyYWdtZW50cy5cbiAqICAtIHByb3ZpZGVzIE1QNCBCb3hlcyBiYWNrIHRvIG1haW4gdGhyZWFkIHVzaW5nIFt0cmFuc2ZlcmFibGUgb2JqZWN0c10oaHR0cHM6Ly9kZXZlbG9wZXJzLmdvb2dsZS5jb20vd2ViL3VwZGF0ZXMvMjAxMS8xMi9UcmFuc2ZlcmFibGUtT2JqZWN0cy1MaWdodG5pbmctRmFzdCkgaW4gb3JkZXIgdG8gbWluaW1pemUgbWVzc2FnZSBwYXNzaW5nIG92ZXJoZWFkLlxuICovXG5cbiBpbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuXG52YXIgRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gIC8vIG9ic2VydmVyIHNldHVwXG4gIHZhciBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuXG4gIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gIH07XG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgIHZhciBkYXRhID0gZXYuZGF0YTtcbiAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZGF0YS5jbWQpO1xuICAgIHN3aXRjaCAoZGF0YS5jbWQpIHtcbiAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICBzZWxmLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShvYnNlcnZlciwgZGF0YS50eXBlU3VwcG9ydGVkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YSksIGRhdGEuYXVkaW9Db2RlYywgZGF0YS52aWRlb0NvZGVjLCBkYXRhLnRpbWVPZmZzZXQsIGRhdGEuY2MsIGRhdGEubGV2ZWwsIGRhdGEuc24sIGRhdGEuZHVyYXRpb24pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgRGVtdXhlclxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldiwgdHJhY2tzIDogZGF0YS50cmFja3MsIHVuaXF1ZSA6IGRhdGEudW5pcXVlIH0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXYsIHR5cGU6IGRhdGEudHlwZSwgc3RhcnRQVFM6IGRhdGEuc3RhcnRQVFMsIGVuZFBUUzogZGF0YS5lbmRQVFMsIHN0YXJ0RFRTOiBkYXRhLnN0YXJ0RFRTLCBlbmREVFM6IGRhdGEuZW5kRFRTLCBkYXRhMTogZGF0YS5kYXRhMS5idWZmZXIsIGRhdGEyOiBkYXRhLmRhdGEyLmJ1ZmZlciwgbmI6IGRhdGEubmJ9O1xuICAgIC8vIHBhc3MgZGF0YTEvZGF0YTIgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsIFtvYmpEYXRhLmRhdGExLCBvYmpEYXRhLmRhdGEyXSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCBmdW5jdGlvbihldmVudCkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudH0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnQsIGRhdGE6IGRhdGF9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldmVudCwgc2FtcGxlczogZGF0YS5zYW1wbGVzfTtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xuXG59O1xuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyV29ya2VyO1xuXG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbmltcG9ydCBEZW11eGVyV29ya2VyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItd29ya2VyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IERlY3J5cHRlciBmcm9tICcuLi9jcnlwdC9kZWNyeXB0ZXInO1xuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB2YXIgdHlwZVN1cHBvcnRlZCA9IHtcbiAgICAgIG1wNCA6IE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0JyksXG4gICAgICBtcDJ0IDogaGxzLmNvbmZpZy5lbmFibGVNUDJUUGFzc1Rocm91Z2ggJiYgTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDJ0JylcbiAgICB9O1xuICAgIGlmIChobHMuY29uZmlnLmVuYWJsZVdvcmtlciAmJiAodHlwZW9mKFdvcmtlcikgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICBsb2dnZXIubG9nKCdkZW11eGluZyBpbiB3ZWJ3b3JrZXInKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgd29yayA9IHJlcXVpcmUoJ3dlYndvcmtpZnknKTtcbiAgICAgICAgICB0aGlzLncgPSB3b3JrKERlbXV4ZXJXb3JrZXIpO1xuICAgICAgICAgIHRoaXMub253bXNnID0gdGhpcy5vbldvcmtlck1lc3NhZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgICB0aGlzLncuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgICAgICB0aGlzLncucG9zdE1lc3NhZ2Uoe2NtZDogJ2luaXQnLCB0eXBlU3VwcG9ydGVkIDogdHlwZVN1cHBvcnRlZH0pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcignZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIERlbXV4ZXJXb3JrZXIsIGZhbGxiYWNrIG9uIERlbXV4ZXJJbmxpbmUnKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsdHlwZVN1cHBvcnRlZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyx0eXBlU3VwcG9ydGVkKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmRlY3J5cHRlcikge1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKSB7XG5cdCAgY29uc29sZS5sb2coJ3B1c2hEZWNyeXB0ZWQgdDA6ICcgKyB0MCk7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdkZW11eCcsIGRhdGE6IGRhdGEsIGF1ZGlvQ29kZWM6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQ6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWw6IGxldmVsLCBzbiA6IHNuLCBkdXJhdGlvbjogZHVyYXRpb259LCBbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBkZWNyeXB0ZGF0YSwgdDApIHtcbiAgICBpZiAoKGRhdGEuYnl0ZUxlbmd0aCA+IDApICYmIChkZWNyeXB0ZGF0YSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEua2V5ICE9IG51bGwpICYmIChkZWNyeXB0ZGF0YS5tZXRob2QgPT09ICdBRVMtMTI4JykpIHtcbiAgICAgIGlmICh0aGlzLmRlY3J5cHRlciA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuZGVjcnlwdGVyID0gbmV3IERlY3J5cHRlcih0aGlzLmhscyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBsb2NhbHRoaXMgPSB0aGlzO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVjcnlwdChkYXRhLCBkZWNyeXB0ZGF0YS5rZXksIGRlY3J5cHRkYXRhLml2LCBmdW5jdGlvbihkZWNyeXB0ZWREYXRhKXtcbiAgICAgICAgbG9jYWx0aGlzLnB1c2hEZWNyeXB0ZWQoZGVjcnlwdGVkRGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKTtcbiAgICB9XG4gIH1cblxuICBvbldvcmtlck1lc3NhZ2UoZXYpIHtcbiAgICB2YXIgZGF0YSA9IGV2LmRhdGE7XG4gICAgLy9jb25zb2xlLmxvZygnb25Xb3JrZXJNZXNzYWdlOicgKyBkYXRhLmV2ZW50KTtcbiAgICBzd2l0Y2goZGF0YS5ldmVudCkge1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOlxuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai50cmFja3MgPSBkYXRhLnRyYWNrcztcbiAgICAgICAgb2JqLnVuaXF1ZSA9IGRhdGEudW5pcXVlO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIG9iaik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgZGF0YTE6IG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YTEpLFxuICAgICAgICAgIGRhdGEyOiBuZXcgVWludDhBcnJheShkYXRhLmRhdGEyKSxcbiAgICAgICAgICBzdGFydFBUUzogZGF0YS5zdGFydFBUUyxcbiAgICAgICAgICBlbmRQVFM6IGRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTOiBkYXRhLnN0YXJ0RFRTLFxuICAgICAgICAgIGVuZERUUzogZGF0YS5lbmREVFMsXG4gICAgICAgICAgdHlwZTogZGF0YS50eXBlLFxuICAgICAgICAgIG5iOiBkYXRhLm5iXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoZGF0YS5ldmVudCwgZGF0YS5kYXRhKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXI7XG5cbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLmRhdGFcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gMDsgLy8gOnVpbnRcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgbG9hZFdvcmQoKSB7XG4gICAgdmFyXG4gICAgICBwb3NpdGlvbiA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy5ieXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLmJ5dGVzQXZhaWxhYmxlKTtcbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy5kYXRhLnN1YmFycmF5KHBvc2l0aW9uLCBwb3NpdGlvbiArIGF2YWlsYWJsZUJ5dGVzKSk7XG4gICAgdGhpcy53b3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcbiAgICAvLyB0cmFjayB0aGUgYW1vdW50IG9mIHRoaXMuZGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IGF2YWlsYWJsZUJ5dGVzO1xuICB9XG5cbiAgLy8gKGNvdW50OmludCk6dm9pZFxuICBza2lwQml0cyhjb3VudCkge1xuICAgIHZhciBza2lwQnl0ZXM7IC8vIDppbnRcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvdW50IC09IHRoaXMuYml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG4gICAgICBjb3VudCAtPSAoc2tpcEJ5dGVzID4+IDMpO1xuICAgICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy5iaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmQgPj4+ICgzMiAtIGJpdHMpOyAvLyA6dWludFxuICAgIGlmIChzaXplID4gMzIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignQ2Fubm90IHJlYWQgbW9yZSB0aGFuIDMyIGJpdHMgYXQgYSB0aW1lJyk7XG4gICAgfVxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBiaXRzO1xuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ5dGVzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIH1cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTFooKSB7XG4gICAgdmFyIGxlYWRpbmdaZXJvQ291bnQ7IC8vIDp1aW50XG4gICAgZm9yIChsZWFkaW5nWmVyb0NvdW50ID0gMDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMuYml0c0F2YWlsYWJsZTsgKytsZWFkaW5nWmVyb0NvdW50KSB7XG4gICAgICBpZiAoMCAhPT0gKHRoaXMud29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmQgYW5kIHN0aWxsIGhhdmUgbm90IGZvdW5kIGEgMVxuICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudCArIHRoaXMuc2tpcExaKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgcmVhZFVFRygpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTFooKTsgLy8gOnVpbnRcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyhjbHogKyAxKSAtIDE7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZEVHKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVUVHKCk7IC8vIDppbnRcbiAgICBpZiAoMHgwMSAmIHZhbHUpIHtcbiAgICAgIC8vIHRoZSBudW1iZXIgaXMgb2RkIGlmIHRoZSBsb3cgb3JkZXIgYml0IGlzIHNldFxuICAgICAgcmV0dXJuICgxICsgdmFsdSkgPj4+IDE7IC8vIGFkZCAxIHRvIG1ha2UgaXQgZXZlbiwgYW5kIGRpdmlkZSBieSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMSAqICh2YWx1ID4+PiAxKTsgLy8gZGl2aWRlIGJ5IHR3byB0aGVuIG1ha2UgaXQgbmVnYXRpdmVcbiAgICB9XG4gIH1cblxuICAvLyBTb21lIGNvbnZlbmllbmNlIGZ1bmN0aW9uc1xuICAvLyA6Qm9vbGVhblxuICByZWFkQm9vbGVhbigpIHtcbiAgICByZXR1cm4gMSA9PT0gdGhpcy5yZWFkQml0cygxKTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVUJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVTaG9ydCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cygxNik7XG4gIH1cbiAgICAvLyAoKTppbnRcbiAgcmVhZFVJbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMzIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRUcoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU1BTKCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHNhclNjYWxlID0gMSxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdCxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAyNDQgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gNDQgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDgzICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4NiAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTE4IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyOCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgaWYgKGNocm9tYUZvcm1hdElkYyA9PT0gMykge1xuICAgICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBzZXBhcmF0ZV9jb2xvdXJfcGxhbmVfZmxhZ1xuICAgICAgfVxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVFRygpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgIC8vIHZ1aV9wYXJhbWV0ZXJzX3ByZXNlbnRfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgICAvLyBhc3BlY3RfcmF0aW9faW5mb19wcmVzZW50X2ZsYWdcbiAgICAgICAgbGV0IHNhclJhdGlvO1xuICAgICAgICBjb25zdCBhc3BlY3RSYXRpb0lkYyA9IHRoaXMucmVhZFVCeXRlKCk7XG4gICAgICAgIHN3aXRjaCAoYXNwZWN0UmF0aW9JZGMpIHtcbiAgICAgICAgICBjYXNlIDE6IHNhclJhdGlvID0gWzEsMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjogc2FyUmF0aW8gPSBbMTIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDM6IHNhclJhdGlvID0gWzEwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA0OiBzYXJSYXRpbyA9IFsxNiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNTogc2FyUmF0aW8gPSBbNDAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDY6IHNhclJhdGlvID0gWzI0LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA3OiBzYXJSYXRpbyA9IFsyMCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgODogc2FyUmF0aW8gPSBbMzIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDk6IHNhclJhdGlvID0gWzgwLDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMDogc2FyUmF0aW8gPSBbMTgsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDExOiBzYXJSYXRpbyA9IFsxNSwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTI6IHNhclJhdGlvID0gWzY0LDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMzogc2FyUmF0aW8gPSBbMTYwLDk5XTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNDogc2FyUmF0aW8gPSBbNCwzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNTogc2FyUmF0aW8gPSBbMywyXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNjogc2FyUmF0aW8gPSBbMiwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyNTU6IHtcbiAgICAgICAgICAgIHNhclJhdGlvID0gW3RoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCksIHRoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCldO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzYXJSYXRpbykge1xuICAgICAgICAgIHNhclNjYWxlID0gc2FyUmF0aW9bMF0gLyBzYXJSYXRpb1sxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IE1hdGguY2VpbCgoKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMikgKiBzYXJTY2FsZSksXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtICgoZnJhbWVNYnNPbmx5RmxhZz8gMiA6IDQpICogKGZyYW1lQ3JvcFRvcE9mZnNldCArIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCkpXG4gICAgfTtcbiAgfVxuXG4gIHJlYWRTbGljZVR5cGUoKSB7XG4gICAgLy8gc2tpcCBOQUx1IHR5cGVcbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIC8vIGRpc2NhcmQgZmlyc3RfbWJfaW5fc2xpY2VcbiAgICB0aGlzLnJlYWRVRUcoKTtcbiAgICAvLyByZXR1cm4gc2xpY2VfdHlwZVxuICAgIHJldHVybiB0aGlzLnJlYWRVRUcoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIElEMyBwYXJzZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4vL2ltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcblxuIGNsYXNzIElEMyB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IGZhbHNlO1xuICAgIHZhciBvZmZzZXQgPSAwLCBieXRlMSxieXRlMixieXRlMyxieXRlNCx0YWdTaXplLGVuZFBvcyxoZWFkZXIsbGVuO1xuICAgICAgZG8ge1xuICAgICAgICBoZWFkZXIgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsMyk7XG4gICAgICAgIG9mZnNldCs9MztcbiAgICAgICAgICAvLyBmaXJzdCBjaGVjayBmb3IgSUQzIGhlYWRlclxuICAgICAgICAgIGlmIChoZWFkZXIgPT09ICdJRDMnKSB7XG4gICAgICAgICAgICAgIC8vIHNraXAgMjQgYml0c1xuICAgICAgICAgICAgICBvZmZzZXQgKz0gMztcbiAgICAgICAgICAgICAgLy8gcmV0cmlldmUgdGFnKHMpIGxlbmd0aFxuICAgICAgICAgICAgICBieXRlMSA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTIgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUzID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlNCA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgdGFnU2l6ZSA9IChieXRlMSA8PCAyMSkgKyAoYnl0ZTIgPDwgMTQpICsgKGJ5dGUzIDw8IDcpICsgYnl0ZTQ7XG4gICAgICAgICAgICAgIGVuZFBvcyA9IG9mZnNldCArIHRhZ1NpemU7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIHRhZyBmb3VuZCwgc2l6ZS9lbmQ6ICR7dGFnU2l6ZX0vJHtlbmRQb3N9YCk7XG5cbiAgICAgICAgICAgICAgLy8gcmVhZCBJRDMgdGFnc1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM0ZyYW1lcyhkYXRhLCBvZmZzZXQsZW5kUG9zKTtcbiAgICAgICAgICAgICAgb2Zmc2V0ID0gZW5kUG9zO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaGVhZGVyID09PSAnM0RJJykge1xuICAgICAgICAgICAgICAvLyBodHRwOi8vaWQzLm9yZy9pZDN2Mi40LjAtc3RydWN0dXJlIGNoYXB0ZXIgMy40LiAgIElEM3YyIGZvb3RlclxuICAgICAgICAgICAgICBvZmZzZXQgKz0gNztcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYDNESSBmb290ZXIgZm91bmQsIGVuZDogJHtvZmZzZXR9YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2Zmc2V0IC09IDM7XG4gICAgICAgICAgICAgIGxlbiA9IG9mZnNldDtcbiAgICAgICAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyBsZW46ICR7bGVufWApO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNUaW1lU3RhbXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oJ0lEMyB0YWcgZm91bmQsIGJ1dCBubyB0aW1lc3RhbXAnKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGVuZ3RoID0gbGVuO1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BheWxvYWQgPSBkYXRhLnN1YmFycmF5KDAsbGVuKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgIH0gd2hpbGUgKHRydWUpO1xuICB9XG5cbiAgcmVhZFVURihkYXRhLHN0YXJ0LGxlbikge1xuXG4gICAgdmFyIHJlc3VsdCA9ICcnLG9mZnNldCA9IHN0YXJ0LCBlbmQgPSBzdGFydCArIGxlbjtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhW29mZnNldCsrXSk7XG4gICAgfSB3aGlsZShvZmZzZXQgPCBlbmQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBfcGFyc2VJRDNGcmFtZXMoZGF0YSxvZmZzZXQsZW5kUG9zKSB7XG4gICAgdmFyIHRhZ0lkLHRhZ0xlbix0YWdTdGFydCx0YWdGbGFncyx0aW1lc3RhbXA7XG4gICAgd2hpbGUob2Zmc2V0ICsgOCA8PSBlbmRQb3MpIHtcbiAgICAgIHRhZ0lkID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQpO1xuICAgICAgb2Zmc2V0ICs9NDtcblxuICAgICAgdGFnTGVuID0gZGF0YVtvZmZzZXQrK10gPDwgMjQgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDE2ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnRmxhZ3MgPSBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdTdGFydCA9IG9mZnNldDtcbiAgICAgIC8vbG9nZ2VyLmxvZyhcIklEMyB0YWcgaWQ6XCIgKyB0YWdJZCk7XG4gICAgICBzd2l0Y2godGFnSWQpIHtcbiAgICAgICAgY2FzZSAnUFJJVic6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3BhcnNlIGZyYW1lOicgKyBIZXguaGV4RHVtcChkYXRhLnN1YmFycmF5KG9mZnNldCxlbmRQb3MpKSk7XG4gICAgICAgICAgICAvLyBvd25lciBzaG91bGQgYmUgXCJjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcFwiXG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQ0KSA9PT0gJ2NvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wJykge1xuICAgICAgICAgICAgICAgIG9mZnNldCs9NDQ7XG4gICAgICAgICAgICAgICAgLy8gc21lbGxpbmcgZXZlbiBiZXR0ZXIgISB3ZSBmb3VuZCB0aGUgcmlnaHQgZGVzY3JpcHRvclxuICAgICAgICAgICAgICAgIC8vIHNraXAgbnVsbCBjaGFyYWN0ZXIgKHN0cmluZyBlbmQpICsgMyBmaXJzdCBieXRlc1xuICAgICAgICAgICAgICAgIG9mZnNldCs9IDQ7XG5cbiAgICAgICAgICAgICAgICAvLyB0aW1lc3RhbXAgaXMgMzMgYml0IGV4cHJlc3NlZCBhcyBhIGJpZy1lbmRpYW4gZWlnaHQtb2N0ZXQgbnVtYmVyLCB3aXRoIHRoZSB1cHBlciAzMSBiaXRzIHNldCB0byB6ZXJvLlxuICAgICAgICAgICAgICAgIHZhciBwdHMzM0JpdCAgPSBkYXRhW29mZnNldCsrXSAmIDB4MTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gKChkYXRhW29mZnNldCsrXSA8PCAyMykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgMTUpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8ICA3KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdKSAvNDU7XG5cbiAgICAgICAgICAgICAgICBpZiAocHRzMzNCaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wICAgKz0gNDc3MjE4NTguODQ7IC8vIDJeMzIgLyA5MFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSBNYXRoLnJvdW5kKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLnRyYWNlKGBJRDMgdGltZXN0YW1wIGZvdW5kOiAke3RpbWVzdGFtcH1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lU3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBoYXNUaW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc1RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCB0aW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCBsZW5ndGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xlbmd0aDtcbiAgfVxuXG4gIGdldCBwYXlsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXlsb2FkO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSUQzO1xuXG4iLCIvKipcbiAqIGhpZ2hseSBvcHRpbWl6ZWQgVFMgZGVtdXhlcjpcbiAqIHBhcnNlIFBBVCwgUE1UXG4gKiBleHRyYWN0IFBFUyBwYWNrZXQgZnJvbSBhdWRpbyBhbmQgdmlkZW8gUElEc1xuICogZXh0cmFjdCBBVkMvSDI2NCBOQUwgdW5pdHMgYW5kIEFBQy9BRFRTIHNhbXBsZXMgZnJvbSBQRVMgcGFja2V0XG4gKiB0cmlnZ2VyIHRoZSByZW11eGVyIHVwb24gcGFyc2luZyBjb21wbGV0aW9uXG4gKiBpdCBhbHNvIHRyaWVzIHRvIHdvcmthcm91bmQgYXMgYmVzdCBhcyBpdCBjYW4gYXVkaW8gY29kZWMgc3dpdGNoIChIRS1BQUMgdG8gQUFDIGFuZCB2aWNlIHZlcnNhKSwgd2l0aG91dCBoYXZpbmcgdG8gcmVzdGFydCB0aGUgTWVkaWFTb3VyY2UuXG4gKiBpdCBhbHNvIGNvbnRyb2xzIHRoZSByZW11eGluZyBwcm9jZXNzIDpcbiAqIHVwb24gZGlzY29udGludWl0eSBvciBsZXZlbCBzd2l0Y2ggZGV0ZWN0aW9uLCBpdCB3aWxsIGFsc28gbm90aWZpZXMgdGhlIHJlbXV4ZXIgc28gdGhhdCBpdCBjYW4gcmVzZXQgaXRzIHN0YXRlLlxuKi9cblxuIGltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5sYXN0Q0MgPSAwO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGEgVFMgZnJhZ21lbnQgc2hvdWxkIGNvbnRhaW4gYXQgbGVhc3QgMyBUUyBwYWNrZXRzLCBhIFBBVCwgYSBQTVQsIGFuZCBvbmUgUElELCBlYWNoIHN0YXJ0aW5nIHdpdGggMHg0N1xuICAgIGlmIChkYXRhLmxlbmd0aCA+PSAzKjE4OCAmJiBkYXRhWzBdID09PSAweDQ3ICYmIGRhdGFbMTg4XSA9PT0gMHg0NyAmJiBkYXRhWzIqMTg4XSA9PT0gMHg0Nykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLnBtdFBhcnNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3BtdElkID0gLTE7XG4gICAgdGhpcy5sYXN0QWFjUFRTID0gbnVsbDtcbiAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHtjb250YWluZXIgOiAndmlkZW8vbXAydCcsIHR5cGU6ICd2aWRlbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMCwgbmJOYWx1IDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7Y29udGFpbmVyIDogJ3ZpZGVvL21wMnQnLCB0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX2lkM1RyYWNrID0ge3R5cGU6ICdpZDMnLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX3R4dFRyYWNrID0ge3R5cGU6ICd0ZXh0JywgaWQ6IC0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlczogW10sIGxlbjogMH07XG4gICAgdGhpcy5yZW11eGVyLnN3aXRjaExldmVsKCk7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLnJlbXV4ZXIuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCkge1xuXHQgIGNvbnNvbGUubG9nKCd0c2RlbXV4ZXIgdDA6ICcgKyB0MCk7XG4gICAgdmFyIGF2Y0RhdGEsIGFhY0RhdGEsIGlkM0RhdGEsXG4gICAgICAgIHN0YXJ0LCBsZW4gPSBkYXRhLmxlbmd0aCwgc3R0LCBwaWQsIGF0Ziwgb2Zmc2V0LFxuICAgICAgICBjb2RlY3NPbmx5ID0gdGhpcy5yZW11eGVyLnBhc3N0aHJvdWdoO1xuXG4gICAgdGhpcy5hdWRpb0NvZGVjID0gYXVkaW9Db2RlYztcbiAgICB0aGlzLnZpZGVvQ29kZWMgPSB2aWRlb0NvZGVjO1xuICAgIHRoaXMudGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICB0aGlzLmNvbnRpZ3VvdXMgPSBmYWxzZTtcbiAgICBpZiAoY2MgIT09IHRoaXMubGFzdENDKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNjb250aW51aXR5IGRldGVjdGVkJyk7XG4gICAgICB0aGlzLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgICAgIHRoaXMubGFzdENDID0gY2M7XG4gICAgfSBlbHNlIGlmIChsZXZlbCAhPT0gdGhpcy5sYXN0TGV2ZWwpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2xldmVsIHN3aXRjaCBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgICAgdGhpcy5sYXN0TGV2ZWwgPSBsZXZlbDtcbiAgICB9IGVsc2UgaWYgKHNuID09PSAodGhpcy5sYXN0U04rMSkpIHtcbiAgICAgIHRoaXMuY29udGlndW91cyA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubGFzdFNOID0gc247XG5cbiAgICBpZighdGhpcy5jb250aWd1b3VzKSB7XG4gICAgICAvLyBmbHVzaCBhbnkgcGFydGlhbCBjb250ZW50XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQsXG4gICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQsXG4gICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQsXG4gICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG5cbiAgICAvLyBkb24ndCBwYXJzZSBsYXN0IFRTIHBhY2tldCBpZiBpbmNvbXBsZXRlXG4gICAgbGVuIC09IGxlbiAlIDE4ODtcbiAgICAvLyBsb29wIHRocm91Z2ggVFMgcGFja2V0c1xuICAgIGZvciAoc3RhcnQgPSAwOyBzdGFydCA8IGxlbjsgc3RhcnQgKz0gMTg4KSB7XG4gICAgICBpZiAoZGF0YVtzdGFydF0gPT09IDB4NDcpIHtcbiAgICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCArIDFdICYgMHg0MCk7XG4gICAgICAgIC8vIHBpZCBpcyBhIDEzLWJpdCBmaWVsZCBzdGFydGluZyBhdCB0aGUgbGFzdCBiaXQgb2YgVFNbMV1cbiAgICAgICAgcGlkID0gKChkYXRhW3N0YXJ0ICsgMV0gJiAweDFmKSA8PCA4KSArIGRhdGFbc3RhcnQgKyAyXTtcbiAgICAgICAgYXRmID0gKGRhdGFbc3RhcnQgKyAzXSAmIDB4MzApID4+IDQ7XG4gICAgICAgIC8vIGlmIGFuIGFkYXB0aW9uIGZpZWxkIGlzIHByZXNlbnQsIGl0cyBsZW5ndGggaXMgc3BlY2lmaWVkIGJ5IHRoZSBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLlxuICAgICAgICBpZiAoYXRmID4gMSkge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNSArIGRhdGFbc3RhcnQgKyA0XTtcbiAgICAgICAgICAvLyBjb250aW51ZSBpZiB0aGVyZSBpcyBvbmx5IGFkYXB0YXRpb24gZmllbGRcbiAgICAgICAgICBpZiAob2Zmc2V0ID09PSAoc3RhcnQgKyAxODgpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQgKyA0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwbXRQYXJzZWQpIHtcbiAgICAgICAgICBpZiAocGlkID09PSBhdmNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICAgICAgICAgICAgICBpZiAoY29kZWNzT25seSkge1xuICAgICAgICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSB2aWRlbyBjb2RlYyBpbmZvIEFORFxuICAgICAgICAgICAgICAgICAgLy8gaWYgYXVkaW8gUElEIGlzIHVuZGVmaW5lZCBPUiBpZiB3ZSBoYXZlIGF1ZGlvIGNvZGVjIGluZm8sXG4gICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGFsbCBjb2RlYyBpbmZvICFcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hdmNUcmFjay5jb2RlYyAmJiAoYWFjSWQgPT09IC0xIHx8IHRoaXMuX2FhY1RyYWNrLmNvZGVjKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbXV4KGRhdGEsIHQwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhdmNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhdmNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGFhY0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgICAgICAgICAgICAgIGlmIChjb2RlY3NPbmx5KSB7XG4gICAgICAgICAgICAgICAgICAvLyBoZXJlIHdlIG5vdyB0aGF0IHdlIGhhdmUgYXVkaW8gY29kZWMgaW5mb1xuICAgICAgICAgICAgICAgICAgLy8gaWYgdmlkZW8gUElEIGlzIHVuZGVmaW5lZCBPUiBpZiB3ZSBoYXZlIHZpZGVvIGNvZGVjIGluZm8sXG4gICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGFsbCBjb2RlYyBpbmZvcyAhXG4gICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYWFjVHJhY2suY29kZWMgJiYgKGF2Y0lkID09PSAtMSB8fCB0aGlzLl9hdmNUcmFjay5jb2RlYykpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW11eChkYXRhLCB0MCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYWFjRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgICAgICAgICBhYWNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgYWFjRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSBpZDNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZDNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgIGlkM0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBpZDNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocGlkID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQ7XG4gICAgICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkO1xuICAgICAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ1RTIHBhY2tldCBkaWQgbm90IHN0YXJ0IHdpdGggMHg0Nyd9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcGFyc2UgbGFzdCBQRVMgcGFja2V0XG4gICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICB9XG4gICAgdGhpcy5yZW11eChudWxsLCB0MCk7XG4gIH1cblxuICByZW11eChkYXRhLCB0MCkge1xuXHQgIGNvbnNvbGUubG9nKCd0c2RlbXV4ZXIgcGFzc2luZyB0MCB0byByZW11eDogJyArIHQwKTtcbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2ssIHRoaXMuX2F2Y1RyYWNrLCB0aGlzLl9pZDNUcmFjaywgdGhpcy5fdHh0VHJhY2ssIHRoaXMudGltZU9mZnNldCwgdGhpcy5jb250aWd1b3VzLCBkYXRhLCB0MCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgcGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBQYWNrZXRpemVkIG1ldGFkYXRhIChJRDMpXG4gICAgICAgIGNhc2UgMHgxNTpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0lEMyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2lkM1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCwgZnJhZywgcGVzRmxhZ3MsIHBlc1ByZWZpeCwgcGVzTGVuLCBwZXNIZHJMZW4sIHBlc0RhdGEsIHBlc1B0cywgcGVzRHRzLCBwYXlsb2FkU3RhcnRPZmZzZXQsIGRhdGEgPSBzdHJlYW0uZGF0YTtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBkYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZiAocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8qIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICAgICAgYXMgUFRTIC8gRFRTIGlzIDMzIGJpdCB3ZSBjYW5ub3QgdXNlIGJpdHdpc2Ugb3BlcmF0b3IgaW4gSlMsXG4gICAgICAgICAgICBhcyBCaXR3aXNlIG9wZXJhdG9ycyB0cmVhdCB0aGVpciBvcGVyYW5kcyBhcyBhIHNlcXVlbmNlIG9mIDMyIGJpdHMgKi9cbiAgICAgICAgcGVzUHRzID0gKGZyYWdbOV0gJiAweDBFKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgIChmcmFnWzEwXSAmIDB4RkYpICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAoZnJhZ1sxMl0gJiAweEZGKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgKGZyYWdbMTNdICYgMHhGRSkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNQdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIGlmIChwZXNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgICBwZXNEdHMgPSAoZnJhZ1sxNF0gJiAweDBFICkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAgIChmcmFnWzE1XSAmIDB4RkYgKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgICAoZnJhZ1sxN10gJiAweEZGICkgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgICAgKGZyYWdbMThdICYgMHhGRSApIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzRHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlc0R0cyA9IHBlc1B0cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVzSGRyTGVuID0gZnJhZ1s4XTtcbiAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IHBlc0hkckxlbiArIDk7XG5cbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgd2hpbGUgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBkYXRhLnNoaWZ0KCk7XG4gICAgICAgIHZhciBsZW4gPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICAgIGlmIChwYXlsb2FkU3RhcnRPZmZzZXQpIHtcbiAgICAgICAgICBpZiAocGF5bG9hZFN0YXJ0T2Zmc2V0ID4gbGVuKSB7XG4gICAgICAgICAgICAvLyB0cmltIGZ1bGwgZnJhZyBpZiBQRVMgaGVhZGVyIGJpZ2dlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldC09bGVuO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRyaW0gcGFydGlhbCBmcmFnIGlmIFBFUyBoZWFkZXIgc21hbGxlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIGZyYWcgPSBmcmFnLnN1YmFycmF5KHBheWxvYWRTdGFydE9mZnNldCk7XG4gICAgICAgICAgICBsZW4tPXBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpKz1sZW47XG4gICAgICB9XG4gICAgICByZXR1cm4ge2RhdGE6IHBlc0RhdGEsIHB0czogcGVzUHRzLCBkdHM6IHBlc0R0cywgbGVuOiBwZXNMZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VBVkNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSksXG4gICAgICAgIHVuaXRzMiA9IFtdLFxuICAgICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgICBrZXkgPSBmYWxzZSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgZXhwR29sb21iRGVjb2RlcixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBwdXNoLFxuICAgICAgICBpO1xuICAgIC8vIG5vIE5BTHUgZm91bmRcbiAgICBpZiAodW5pdHMubGVuZ3RoID09PSAwICYmIHNhbXBsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYXBwZW5kIHBlcy5kYXRhIHRvIHByZXZpb3VzIE5BTCB1bml0XG4gICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBwZXMuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwgMCk7XG4gICAgICB0bXAuc2V0KHBlcy5kYXRhLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB0cmFjay5sZW4gKz0gcGVzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdmFyIGRlYnVnU3RyaW5nID0gJyc7XG5cbiAgICB1bml0cy5mb3JFYWNoKHVuaXQgPT4ge1xuICAgICAgc3dpdGNoKHVuaXQudHlwZSkge1xuICAgICAgICAvL05EUlxuICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdORFIgJztcbiAgICAgICAgICAgfVxuICAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnSURSICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU0VJXG4gICAgICAgIGNhc2UgNjpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NFSSAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuXG4gICAgICAgICAgLy8gc2tpcCBmcmFtZVR5cGVcbiAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgdmFyIHBheWxvYWRUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIC8vIFRPRE86IHRoZXJlIGNhbiBiZSBtb3JlIHRoYW4gb25lIHBheWxvYWQgaW4gYW4gU0VJIHBhY2tldC4uLlxuICAgICAgICAgIC8vIFRPRE86IG5lZWQgdG8gcmVhZCB0eXBlIGFuZCBzaXplIGluIGEgd2hpbGUgbG9vcCB0byBnZXQgdGhlbSBhbGxcbiAgICAgICAgICBpZiAocGF5bG9hZFR5cGUgPT09IDQpXG4gICAgICAgICAge1xuICAgICAgICAgICAgdmFyIHBheWxvYWRTaXplID0gMDtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICBwYXlsb2FkU2l6ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAocGF5bG9hZFNpemUgPT09IDI1NSk7XG5cbiAgICAgICAgICAgIHZhciBjb3VudHJ5Q29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgIGlmIChjb3VudHJ5Q29kZSA9PT0gMTgxKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB2YXIgcHJvdmlkZXJDb2RlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVVNob3J0KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyQ29kZSA9PT0gNDkpXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2YXIgdXNlclN0cnVjdHVyZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVJbnQoKTtcblxuICAgICAgICAgICAgICAgIGlmICh1c2VyU3RydWN0dXJlID09PSAweDQ3NDEzOTM0KVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHZhciB1c2VyRGF0YVR5cGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAvLyBSYXcgQ0VBLTYwOCBieXRlcyB3cmFwcGVkIGluIENFQS03MDggcGFja2V0XG4gICAgICAgICAgICAgICAgICBpZiAodXNlckRhdGFUeXBlID09PSAzKVxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmlyc3RCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlY29uZEJ5dGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciB0b3RhbENDcyA9IDMxICYgZmlyc3RCeXRlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYnl0ZUFycmF5ID0gW2ZpcnN0Qnl0ZSwgc2Vjb25kQnl0ZV07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChpPTA7IGk8dG90YWxDQ3M7IGkrKylcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIDMgYnl0ZXMgcGVyIENDXG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90eHRUcmFjay5zYW1wbGVzLnB1c2goe3R5cGU6IDMsIHB0czogcGVzLnB0cywgYnl0ZXM6IGJ5dGVBcnJheX0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TUFNcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnU1BTICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKCF0cmFjay5zcHMpIHtcbiAgICAgICAgICAgIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU1BTKCk7XG4gICAgICAgICAgICB0cmFjay53aWR0aCA9IGNvbmZpZy53aWR0aDtcbiAgICAgICAgICAgIHRyYWNrLmhlaWdodCA9IGNvbmZpZy5oZWlnaHQ7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB2YXIgY29kZWNhcnJheSA9IHVuaXQuZGF0YS5zdWJhcnJheSgxLCA0KTtcbiAgICAgICAgICAgIHZhciBjb2RlY3N0cmluZyA9ICdhdmMxLic7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBoID0gY29kZWNhcnJheVtpXS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICBoID0gJzAnICsgaDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb2RlY3N0cmluZyArPSBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhY2suY29kZWMgPSBjb2RlY3N0cmluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vUFBTXG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1BQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXRyYWNrLnBwcykge1xuICAgICAgICAgICAgdHJhY2sucHBzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDk6XG4gICAgICAgICAgcHVzaCA9IGZhbHNlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnQVVEICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAndW5rbm93biBOQUwgJyArIHVuaXQudHlwZSArICcgJztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmKHB1c2gpIHtcbiAgICAgICAgdW5pdHMyLnB1c2godW5pdCk7XG4gICAgICAgIGxlbmd0aCs9dW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYoZGVidWcgfHwgZGVidWdTdHJpbmcubGVuZ3RoKSB7XG4gICAgICBsb2dnZXIubG9nKGRlYnVnU3RyaW5nKTtcbiAgICB9XG4gICAgLy9idWlsZCBzYW1wbGUgZnJvbSBQRVNcbiAgICAvLyBBbm5leCBCIHRvIE1QNCBjb252ZXJzaW9uIHRvIGJlIGRvbmVcbiAgICBpZiAodW5pdHMyLmxlbmd0aCkge1xuICAgICAgLy8gb25seSBwdXNoIEFWQyBzYW1wbGUgaWYga2V5ZnJhbWUgYWxyZWFkeSBmb3VuZC4gYnJvd3NlcnMgZXhwZWN0IGEga2V5ZnJhbWUgYXQgZmlyc3QgdG8gc3RhcnQgZGVjb2RpbmdcbiAgICAgIGlmIChrZXkgPT09IHRydWUgfHwgdHJhY2suc3BzICkge1xuICAgICAgICBhdmNTYW1wbGUgPSB7dW5pdHM6IHsgdW5pdHMgOiB1bml0czIsIGxlbmd0aCA6IGxlbmd0aH0sIHB0czogcGVzLnB0cywgZHRzOiBwZXMuZHRzLCBrZXk6IGtleX07XG4gICAgICAgIHNhbXBsZXMucHVzaChhdmNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gbGVuZ3RoO1xuICAgICAgICB0cmFjay5uYk5hbHUgKz0gdW5pdHMyLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsIGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsIHZhbHVlLCBvdmVyZmxvdywgc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCwgbGFzdFVuaXRUeXBlO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmKCB2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSAxICYmIGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgaSAtIHN0YXRlIC0gMSksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzO1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdHMgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLFxuICAgICAgICAgICAgICAgICAgICAgIGxhc3RVbml0ID0gbGFzdFVuaXRzW2xhc3RVbml0cy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLCBvdmVyZmxvdyksIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB0cmFjay5sZW4gKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuaXRzO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBkYXRhID0gcGVzLmRhdGEsXG4gICAgICAgIHB0cyA9IHBlcy5wdHMsXG4gICAgICAgIHN0YXJ0T2Zmc2V0ID0gMCxcbiAgICAgICAgZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbixcbiAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMuYXVkaW9Db2RlYyxcbiAgICAgICAgYWFjT3ZlckZsb3cgPSB0aGlzLmFhY092ZXJGbG93LFxuICAgICAgICBsYXN0QWFjUFRTID0gdGhpcy5sYXN0QWFjUFRTLFxuICAgICAgICBjb25maWcsIGZyYW1lTGVuZ3RoLCBmcmFtZUR1cmF0aW9uLCBmcmFtZUluZGV4LCBvZmZzZXQsIGhlYWRlckxlbmd0aCwgc3RhbXAsIGxlbiwgYWFjU2FtcGxlO1xuICAgIGlmIChhYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGFhY092ZXJGbG93LmJ5dGVMZW5ndGggKyBkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldChhYWNPdmVyRmxvdywgMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsIGFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgLy9sb2dnZXIubG9nKGBBQUM6IGFwcGVuZCBvdmVyZmxvd2luZyAke2FhY092ZXJGbG93LmJ5dGVMZW5ndGh9IGJ5dGVzIHRvIGJlZ2lubmluZyBvZiBuZXcgUEVTYCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAob2Zmc2V0ID0gc3RhcnRPZmZzZXQsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChvZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKG9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke29mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmF0YWwsIHJlYXNvbjogcmVhc29ufSk7XG4gICAgICBpZiAoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIGZyYW1lSW5kZXggPSAwO1xuICAgIGZyYW1lRHVyYXRpb24gPSAxMDI0ICogOTAwMDAgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG5cbiAgICAvLyBpZiBsYXN0IEFBQyBmcmFtZSBpcyBvdmVyZmxvd2luZywgd2Ugc2hvdWxkIGVuc3VyZSB0aW1lc3RhbXBzIGFyZSBjb250aWd1b3VzOlxuICAgIC8vIGZpcnN0IHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGZyYW1lRHVyYXRpb25cbiAgICBpZihhYWNPdmVyRmxvdyAmJiBsYXN0QWFjUFRTKSB7XG4gICAgICB2YXIgbmV3UFRTID0gbGFzdEFhY1BUUytmcmFtZUR1cmF0aW9uO1xuICAgICAgaWYoTWF0aC5hYnMobmV3UFRTLXB0cykgPiAxKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYEFBQzogYWxpZ24gUFRTIGZvciBvdmVybGFwcGluZyBmcmFtZXMgYnkgJHtNYXRoLnJvdW5kKChuZXdQVFMtcHRzKS85MCl9YCk7XG4gICAgICAgIHB0cz1uZXdQVFM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKChvZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gVGhlIHByb3RlY3Rpb24gc2tpcCBiaXQgdGVsbHMgdXMgaWYgd2UgaGF2ZSAyIGJ5dGVzIG9mIENSQyBkYXRhIGF0IHRoZSBlbmQgb2YgdGhlIEFEVFMgaGVhZGVyXG4gICAgICBoZWFkZXJMZW5ndGggPSAoISEoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgZnJhbWVMZW5ndGggPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSkgfFxuICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0ICsgNF0gPDwgMykgfFxuICAgICAgICAgICAgICAgICAgICAoKGRhdGFbb2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBmcmFtZUxlbmd0aCAgLT0gaGVhZGVyTGVuZ3RoO1xuICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG5cbiAgICAgIGlmICgoZnJhbWVMZW5ndGggPiAwKSAmJiAoKG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSA8PSBsZW4pKSB7XG4gICAgICAgIHN0YW1wID0gcHRzICsgZnJhbWVJbmRleCAqIGZyYW1lRHVyYXRpb247XG4gICAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3RvdGFsL3B0czoke29mZnNldCtoZWFkZXJMZW5ndGh9LyR7ZnJhbWVMZW5ndGh9LyR7ZGF0YS5ieXRlTGVuZ3RofS8keyhzdGFtcC85MCkudG9GaXhlZCgwKX1gKTtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoLCBvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCksIHB0czogc3RhbXAsIGR0czogc3RhbXB9O1xuICAgICAgICB0cmFjay5zYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGZyYW1lTGVuZ3RoO1xuICAgICAgICBvZmZzZXQgKz0gZnJhbWVMZW5ndGggKyBoZWFkZXJMZW5ndGg7XG4gICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBvZmZzZXQgPCAobGVuIC0gMSk7IG9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVtvZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9mZnNldCA8IGxlbikge1xuICAgICAgYWFjT3ZlckZsb3cgPSBkYXRhLnN1YmFycmF5KG9mZnNldCwgbGVuKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDOiBvdmVyZmxvdyBkZXRlY3RlZDoke2xlbi1vZmZzZXR9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hYWNPdmVyRmxvdyA9IGFhY092ZXJGbG93O1xuICAgIHRoaXMubGFzdEFhY1BUUyA9IHN0YW1wO1xuICB9XG5cbiAgX3BhcnNlSUQzUEVTKHBlcykge1xuICAgIHRoaXMuX2lkM1RyYWNrLnNhbXBsZXMucHVzaChwZXMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcblxuIiwiZXhwb3J0IGNvbnN0IEVycm9yVHlwZXMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbmV0d29yayBlcnJvciAobG9hZGluZyBlcnJvciAvIHRpbWVvdXQgLi4uKVxuICBORVRXT1JLX0VSUk9SOiAnbmV0d29ya0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtZWRpYSBFcnJvciAodmlkZW8vcGFyc2luZy9tZWRpYXNvdXJjZSBlcnJvcilcbiAgTUVESUFfRVJST1I6ICdtZWRpYUVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYWxsIG90aGVyIGVycm9yc1xuICBPVEhFUl9FUlJPUjogJ290aGVyRXJyb3InXG59O1xuXG5leHBvcnQgY29uc3QgRXJyb3JEZXRhaWxzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX0VSUk9SOiAnbWFuaWZlc3RMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfVElNRU9VVDogJ21hbmlmZXN0TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IHBhcnNpbmcgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfUEFSU0lOR19FUlJPUjogJ21hbmlmZXN0UGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCB3aXRoIG9ubHkgaW5jb21wYXRpYmxlIGNvZGVjcyBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVhc29uIDogZXJyb3IgcmVhc29ufVxuICBNQU5JRkVTVF9JTkNPTVBBVElCTEVfQ09ERUNTX0VSUk9SOiAnbWFuaWZlc3RJbmNvbXBhdGlibGVDb2RlY3NFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SOiAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQ6ICdsZXZlbExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9TV0lUQ0hfRVJST1I6ICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUjogJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOiAnZnJhZ0xvb3BMb2FkaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9USU1FT1VUOiAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBkZWNyeXB0aW9uIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0RFQ1JZUFRfRVJST1I6ICdmcmFnRGVjcnlwdEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1I6ICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEtFWV9MT0FEX0VSUk9SOiAna2V5TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRF9USU1FT1VUOiAna2V5TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmQgZXJyb3IgLSBkYXRhOiBhcHBlbmQgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORF9FUlJPUjogJ2J1ZmZlckFwcGVuZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRJTkdfRVJST1I6ICdidWZmZXJBcHBlbmRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHN0YWxsZWQgZXJyb3IgZXZlbnRcbiAgQlVGRkVSX1NUQUxMRURfRVJST1I6ICdidWZmZXJTdGFsbGVkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBmdWxsIGV2ZW50XG4gIEJVRkZFUl9GVUxMX0VSUk9SOiAnYnVmZmVyRnVsbEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgc2VlayBvdmVyIGhvbGUgZXZlbnRcbiAgQlVGRkVSX1NFRUtfT1ZFUl9IT0xFOiAnYnVmZmVyU2Vla092ZXJIb2xlJ1xufTtcbiIsIi8qXG4qXG4qIEFsbCBvYmplY3RzIGluIHRoZSBldmVudCBoYW5kbGluZyBjaGFpbiBzaG91bGQgaW5oZXJpdCBmcm9tIHRoaXMgY2xhc3NcbipcbiovXG5cbi8vaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMsIC4uLmV2ZW50cykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25FdmVudCA9IHRoaXMub25FdmVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZEV2ZW50cyA9IGV2ZW50cztcbiAgICB0aGlzLnVzZUdlbmVyaWNIYW5kbGVyID0gdHJ1ZTtcblxuICAgIHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy51bnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBpc0V2ZW50SGFuZGxlcigpIHtcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuaGFuZGxlZEV2ZW50cyA9PT0gJ29iamVjdCcgJiYgdGhpcy5oYW5kbGVkRXZlbnRzLmxlbmd0aCAmJiB0eXBlb2YgdGhpcy5vbkV2ZW50ID09PSAnZnVuY3Rpb24nO1xuICB9XG5cbiAgcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ID09PSAnaGxzRXZlbnRHZW5lcmljJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRm9yYmlkZGVuIGV2ZW50IG5hbWU6ICcgKyBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5obHMub24oZXZlbnQsIHRoaXMub25FdmVudCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHVucmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdGhpcy5obHMub2ZmKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAqIGFyZ3VtZW50czogZXZlbnQgKHN0cmluZyksIGRhdGEgKGFueSlcbiAgKi9cbiAgb25FdmVudChldmVudCwgZGF0YSkge1xuICAgIHRoaXMub25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpO1xuICB9XG5cbiAgb25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgZXZlbnRUb0Z1bmN0aW9uID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIHZhciBmdW5jTmFtZSA9ICdvbicgKyBldmVudC5yZXBsYWNlKCdobHMnLCAnJyk7XG4gICAgICBpZiAodHlwZW9mIHRoaXNbZnVuY05hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgJHtldmVudH0gaGFzIG5vIGdlbmVyaWMgaGFuZGxlciBpbiB0aGlzICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBjbGFzcyAodHJpZWQgJHtmdW5jTmFtZX0pYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1tmdW5jTmFtZV0uYmluZCh0aGlzLCBkYXRhKTtcbiAgICB9O1xuICAgIGV2ZW50VG9GdW5jdGlvbi5jYWxsKHRoaXMsIGV2ZW50LCBkYXRhKS5jYWxsKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXZlbnRIYW5kbGVyOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAvLyBmaXJlZCBiZWZvcmUgTWVkaWFTb3VyY2UgaXMgYXR0YWNoaW5nIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhIH1cbiAgTUVESUFfQVRUQUNISU5HOiAnaGxzTWVkaWFBdHRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfQVRUQUNIRUQ6ICdobHNNZWRpYUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgYmVmb3JlIGRldGFjaGluZyBNZWRpYVNvdXJjZSBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNISU5HOiAnaGxzTWVkaWFEZXRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIGRldGFjaGVkIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hFRDogJ2hsc01lZGlhRGV0YWNoZWQnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGJ1ZmZlciBpcyBnb2luZyB0byBiZSByZXNldHRlZFxuICBCVUZGRVJfUkVTRVQ6ICdobHNCdWZmZXJSZXNldCcsXG4gIC8vIGZpcmVkIHdoZW4gd2Uga25vdyBhYm91dCB0aGUgY29kZWNzIHRoYXQgd2UgbmVlZCBidWZmZXJzIGZvciB0byBwdXNoIGludG8gLSBkYXRhOiB7dHJhY2tzIDogeyBjb250YWluZXIsIGNvZGVjLCBsZXZlbENvZGVjLCBpbml0U2VnbWVudCwgbWV0YWRhdGEgfX1cbiAgQlVGRkVSX0NPREVDUzogJ2hsc0J1ZmZlckNvZGVjcycsXG4gIC8vIGZpcmVkIHdoZW4gd2UgYXBwZW5kIGEgc2VnbWVudCB0byB0aGUgYnVmZmVyIC0gZGF0YTogeyBzZWdtZW50OiBzZWdtZW50IG9iamVjdCB9XG4gIEJVRkZFUl9BUFBFTkRJTkc6ICdobHNCdWZmZXJBcHBlbmRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGFyZSBkb25lIHdpdGggYXBwZW5kaW5nIGEgbWVkaWEgc2VnbWVudCB0byB0aGUgYnVmZmVyXG4gIEJVRkZFUl9BUFBFTkRFRDogJ2hsc0J1ZmZlckFwcGVuZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgc3RyZWFtIGlzIGZpbmlzaGVkIGFuZCB3ZSB3YW50IHRvIG5vdGlmeSB0aGUgbWVkaWEgYnVmZmVyIHRoYXQgdGhlcmUgd2lsbCBiZSBubyBtb3JlIGRhdGFcbiAgQlVGRkVSX0VPUzogJ2hsc0J1ZmZlckVvcycsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIG1lZGlhIGJ1ZmZlciBzaG91bGQgYmUgZmx1c2hlZCAtIGRhdGEge3N0YXJ0T2Zmc2V0LCBlbmRPZmZzZXR9XG4gIEJVRkZFUl9GTFVTSElORzogJ2hsc0J1ZmZlckZsdXNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgbWVkaWEgaGFzIGJlZW4gZmx1c2hlZFxuICBCVUZGRVJfRkxVU0hFRDogJ2hsc0J1ZmZlckZsdXNoZWQnLFxuICAvLyBmaXJlZCB0byBzaWduYWwgdGhhdCBhIG1hbmlmZXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBtYW5pZmVzdFVSTH1cbiAgTUFOSUZFU1RfTE9BRElORzogJ2hsc01hbmlmZXN0TG9hZGluZycsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIGZpcnN0TGV2ZWwgOiBpbmRleCBvZiBmaXJzdCBxdWFsaXR5IGxldmVsIGFwcGVhcmluZyBpbiBNYW5pZmVzdH1cbiAgTUFOSUZFU1RfUEFSU0VEOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IGxldmVsIFVSTCAgbGV2ZWwgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkc6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRDogJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgZGV0YWlscyBoYXZlIGJlZW4gdXBkYXRlZCBiYXNlZCBvbiBwcmV2aW91cyBkZXRhaWxzLCBhZnRlciBpdCBoYXMgYmVlbiBsb2FkZWQuIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsIH1cbiAgTEVWRUxfVVBEQVRFRDogJ2hsc0xldmVsVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIFBUUyBpbmZvcm1hdGlvbiBoYXMgYmVlbiB1cGRhdGVkIGFmdGVyIHBhcnNpbmcgYSBmcmFnbWVudCAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCwgZHJpZnQ6IFBUUyBkcmlmdCBvYnNlcnZlZCB3aGVuIHBhcnNpbmcgbGFzdCBmcmFnbWVudCB9XG4gIExFVkVMX1BUU19VUERBVEVEOiAnaGxzTGV2ZWxQdHNVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgc2VpIHRleHQgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBzZWkgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19VU0VSREFUQTogJ2hsc0ZyYWdQYXJzaW5nVXNlcmRhdGEnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgaWQzIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgaWQzIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfTUVUQURBVEE6ICdobHNGcmFnUGFyc2luZ01ldGFkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBkYXRhIGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgZGF0YTEgOiBtb29mIE1QNCBib3ggb3IgVFMgZnJhZ21lbnRzLCBkYXRhMiA6IG1kYXQgTVA0IGJveCBvciBudWxsfVxuICBGUkFHX1BBUlNJTkdfREFUQTogJ2hsc0ZyYWdQYXJzaW5nRGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcGFyc2luZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB1bmRlZmluZWRcbiAgRlJBR19QQVJTRUQ6ICdobHNGcmFnUGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCByZW11eGVkIE1QNCBib3hlcyBoYXZlIGFsbCBiZWVuIGFwcGVuZGVkIGludG8gU291cmNlQnVmZmVyIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIHRwYXJzZWQsIHRidWZmZXJlZCwgbGVuZ3RofSB9XG4gIEZSQUdfQlVGRkVSRUQ6ICdobHNGcmFnQnVmZmVyZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IG1hdGNoaW5nIHdpdGggY3VycmVudCBtZWRpYSBwb3NpdGlvbiBpcyBjaGFuZ2luZyAtIGRhdGEgOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QgfVxuICBGUkFHX0NIQU5HRUQ6ICdobHNGcmFnQ2hhbmdlZCcsXG4gICAgLy8gSWRlbnRpZmllciBmb3IgYSBGUFMgZHJvcCBldmVudCAtIGRhdGE6IHtjdXJlbnREcm9wcGVkLCBjdXJyZW50RGVjb2RlZCwgdG90YWxEcm9wcGVkRnJhbWVzfVxuICBGUFNfRFJPUDogJ2hsc0Zwc0Ryb3AnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbiBlcnJvciBldmVudCAtIGRhdGE6IHsgdHlwZSA6IGVycm9yIHR5cGUsIGRldGFpbHMgOiBlcnJvciBkZXRhaWxzLCBmYXRhbCA6IGlmIHRydWUsIGhscy5qcyBjYW5ub3Qvd2lsbCBub3QgdHJ5IHRvIHJlY292ZXIsIGlmIGZhbHNlLCBobHMuanMgd2lsbCB0cnkgdG8gcmVjb3ZlcixvdGhlciBlcnJvciBzcGVjaWZpYyBkYXRhfVxuICBFUlJPUjogJ2hsc0Vycm9yJyxcbiAgLy8gZmlyZWQgd2hlbiBobHMuanMgaW5zdGFuY2Ugc3RhcnRzIGRlc3Ryb3lpbmcuIERpZmZlcmVudCBmcm9tIE1FRElBX0RFVEFDSEVEIGFzIG9uZSBjb3VsZCB3YW50IHRvIGRldGFjaCBhbmQgcmVhdHRhY2ggYSBtZWRpYSB0byB0aGUgaW5zdGFuY2Ugb2YgaGxzLmpzIHRvIGhhbmRsZSBtaWQtcm9sbHMgZm9yIGV4YW1wbGVcbiAgREVTVFJPWUlORzogJ2hsc0Rlc3Ryb3lpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEtFWV9MT0FESU5HOiAnaGxzS2V5TG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBkZWNyeXB0IGtleSBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGtleSBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEtFWV9MT0FERUQ6ICdobHNLZXlMb2FkZWQnLFxufTtcbiIsIi8qKlxuICogQnVmZmVyIEhlbHBlciBjbGFzcywgcHJvdmlkaW5nIG1ldGhvZHMgZGVhbGluZyBidWZmZXIgbGVuZ3RoIHJldHJpZXZhbFxuKi9cblxuXG5jbGFzcyBCdWZmZXJIZWxwZXIge1xuXG4gIHN0YXRpYyBidWZmZXJJbmZvKG1lZGlhLCBwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgaWYgKG1lZGlhKSB7XG4gICAgICB2YXIgdmJ1ZmZlcmVkID0gbWVkaWEuYnVmZmVyZWQsIGJ1ZmZlcmVkID0gW10saTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB2YnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYnVmZmVyZWQucHVzaCh7c3RhcnQ6IHZidWZmZXJlZC5zdGFydChpKSwgZW5kOiB2YnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5idWZmZXJlZEluZm8oYnVmZmVyZWQscG9zLG1heEhvbGVEdXJhdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7bGVuOiAwLCBzdGFydDogMCwgZW5kOiAwLCBuZXh0U3RhcnQgOiB1bmRlZmluZWR9IDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pIHtcbiAgICB2YXIgYnVmZmVyZWQyID0gW10sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlckxlbixidWZmZXJTdGFydCwgYnVmZmVyRW5kLGJ1ZmZlclN0YXJ0TmV4dCxpO1xuICAgIC8vIHNvcnQgb24gYnVmZmVyLnN0YXJ0L3NtYWxsZXIgZW5kIChJRSBkb2VzIG5vdCBhbHdheXMgcmV0dXJuIHNvcnRlZCBidWZmZXJlZCByYW5nZSlcbiAgICBidWZmZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICB2YXIgZGlmZiA9IGEuc3RhcnQgLSBiLnN0YXJ0O1xuICAgICAgaWYgKGRpZmYpIHtcbiAgICAgICAgcmV0dXJuIGRpZmY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYi5lbmQgLSBhLmVuZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiBtYXhIb2xlRHVyYXRpb24gYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvciAoaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJ1ZjJsZW4gPSBidWZmZXJlZDIubGVuZ3RoO1xuICAgICAgaWYoYnVmMmxlbikge1xuICAgICAgICB2YXIgYnVmMmVuZCA9IGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kO1xuICAgICAgICAvLyBpZiBzbWFsbCBob2xlICh2YWx1ZSBiZXR3ZWVuIDAgb3IgbWF4SG9sZUR1cmF0aW9uICkgb3Igb3ZlcmxhcHBpbmcgKG5lZ2F0aXZlKVxuICAgICAgICBpZigoYnVmZmVyZWRbaV0uc3RhcnQgLSBidWYyZW5kKSA8IG1heEhvbGVEdXJhdGlvbikge1xuICAgICAgICAgIC8vIG1lcmdlIG92ZXJsYXBwaW5nIHRpbWUgcmFuZ2VzXG4gICAgICAgICAgLy8gdXBkYXRlIGxhc3RSYW5nZS5lbmQgb25seSBpZiBzbWFsbGVyIHRoYW4gaXRlbS5lbmRcbiAgICAgICAgICAvLyBlLmcuICBbIDEsIDE1XSB3aXRoICBbIDIsOF0gPT4gWyAxLDE1XSAobm8gbmVlZCB0byBtb2RpZnkgbGFzdFJhbmdlLmVuZClcbiAgICAgICAgICAvLyB3aGVyZWFzIFsgMSwgOF0gd2l0aCAgWyAyLDE1XSA9PiBbIDEsMTVdICggbGFzdFJhbmdlIHNob3VsZCBzd2l0Y2ggZnJvbSBbMSw4XSB0byBbMSwxNV0pXG4gICAgICAgICAgaWYoYnVmZmVyZWRbaV0uZW5kID4gYnVmMmVuZCkge1xuICAgICAgICAgICAgYnVmZmVyZWQyW2J1ZjJsZW4gLSAxXS5lbmQgPSBidWZmZXJlZFtpXS5lbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGJpZyBob2xlXG4gICAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmaXJzdCB2YWx1ZVxuICAgICAgICBidWZmZXJlZDIucHVzaChidWZmZXJlZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zOyBpIDwgYnVmZmVyZWQyLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3RhcnQgPSAgYnVmZmVyZWQyW2ldLnN0YXJ0LFxuICAgICAgICAgIGVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQ7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA+PSBzdGFydCAmJiBwb3MgPCBlbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGVuZDtcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfSBlbHNlIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA8IHN0YXJ0KSB7XG4gICAgICAgIGJ1ZmZlclN0YXJ0TmV4dCA9IHN0YXJ0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cdC8vIGlmKCBidWZmZXJTdGFydCA9PSBidWZmZXJFbmQgJiYgYnVmZmVyRW5kICE9IDApIHsgZGVidWdnZXI7IH1cbiAgICByZXR1cm4ge2xlbjogYnVmZmVyTGVuLCBzdGFydDogYnVmZmVyU3RhcnQsIGVuZDogYnVmZmVyRW5kLCBuZXh0U3RhcnQgOiBidWZmZXJTdGFydE5leHR9O1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVySGVscGVyO1xuIiwiLyoqXG4gKiBMZXZlbCBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgd2l0aCBwbGF5bGlzdCBzbGlkaW5nIGFuZCBkcmlmdFxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIExldmVsSGVscGVyIHtcblxuICBzdGF0aWMgbWVyZ2VEZXRhaWxzKG9sZERldGFpbHMsbmV3RGV0YWlscykge1xuICAgIHZhciBzdGFydCA9IE1hdGgubWF4KG9sZERldGFpbHMuc3RhcnRTTixuZXdEZXRhaWxzLnN0YXJ0U04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZW5kID0gTWF0aC5taW4ob2xkRGV0YWlscy5lbmRTTixuZXdEZXRhaWxzLmVuZFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGRlbHRhID0gbmV3RGV0YWlscy5zdGFydFNOIC0gb2xkRGV0YWlscy5zdGFydFNOLFxuICAgICAgICBvbGRmcmFnbWVudHMgPSBvbGREZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgbmV3ZnJhZ21lbnRzID0gbmV3RGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIGNjT2Zmc2V0ID0wLFxuICAgICAgICBQVFNGcmFnO1xuXG4gICAgLy8gY2hlY2sgaWYgb2xkL25ldyBwbGF5bGlzdHMgaGF2ZSBmcmFnbWVudHMgaW4gY29tbW9uXG4gICAgaWYgKCBlbmQgPCBzdGFydCkge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBsb29wIHRocm91Z2ggb3ZlcmxhcHBpbmcgU04gYW5kIHVwZGF0ZSBzdGFydFBUUyAsIGNjLCBhbmQgZHVyYXRpb24gaWYgYW55IGZvdW5kXG4gICAgZm9yKHZhciBpID0gc3RhcnQgOyBpIDw9IGVuZCA7IGkrKykge1xuICAgICAgdmFyIG9sZEZyYWcgPSBvbGRmcmFnbWVudHNbZGVsdGEraV0sXG4gICAgICAgICAgbmV3RnJhZyA9IG5ld2ZyYWdtZW50c1tpXTtcbiAgICAgIGNjT2Zmc2V0ID0gb2xkRnJhZy5jYyAtIG5ld0ZyYWcuY2M7XG4gICAgICBpZiAoIWlzTmFOKG9sZEZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICAgIG5ld0ZyYWcuc3RhcnQgPSBuZXdGcmFnLnN0YXJ0UFRTID0gb2xkRnJhZy5zdGFydFBUUztcbiAgICAgICAgbmV3RnJhZy5lbmRQVFMgPSBvbGRGcmFnLmVuZFBUUztcbiAgICAgICAgbmV3RnJhZy5kdXJhdGlvbiA9IG9sZEZyYWcuZHVyYXRpb247XG4gICAgICAgIFBUU0ZyYWcgPSBuZXdGcmFnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGNjT2Zmc2V0KSB7XG4gICAgICBsb2dnZXIubG9nKGBkaXNjb250aW51aXR5IHNsaWRpbmcgZnJvbSBwbGF5bGlzdCwgdGFrZSBkcmlmdCBpbnRvIGFjY291bnRgKTtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5jYyArPSBjY09mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiBhdCBsZWFzdCBvbmUgZnJhZ21lbnQgY29udGFpbnMgUFRTIGluZm8sIHJlY29tcHV0ZSBQVFMgaW5mb3JtYXRpb24gZm9yIGFsbCBmcmFnbWVudHNcbiAgICBpZihQVFNGcmFnKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKG5ld0RldGFpbHMsUFRTRnJhZy5zbixQVFNGcmFnLnN0YXJ0UFRTLFBUU0ZyYWcuZW5kUFRTKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYWRqdXN0IHN0YXJ0IGJ5IHNsaWRpbmcgb2Zmc2V0XG4gICAgICB2YXIgc2xpZGluZyA9IG9sZGZyYWdtZW50c1tkZWx0YV0uc3RhcnQ7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uc3RhcnQgKz0gc2xpZGluZztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2UgYXJlIGhlcmUsIGl0IG1lYW5zIHdlIGhhdmUgZnJhZ21lbnRzIG92ZXJsYXBwaW5nIGJldHdlZW5cbiAgICAvLyBvbGQgYW5kIG5ldyBsZXZlbC4gcmVsaWFibGUgUFRTIGluZm8gaXMgdGh1cyByZWx5aW5nIG9uIG9sZCBsZXZlbFxuICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBvbGREZXRhaWxzLlBUU0tub3duO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVGcmFnUFRTKGRldGFpbHMsc24sc3RhcnRQVFMsZW5kUFRTKSB7XG4gICAgdmFyIGZyYWdJZHgsIGZyYWdtZW50cywgZnJhZywgaTtcbiAgICAvLyBleGl0IGlmIHNuIG91dCBvZiByYW5nZVxuICAgIGlmIChzbiA8IGRldGFpbHMuc3RhcnRTTiB8fCBzbiA+IGRldGFpbHMuZW5kU04pIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBmcmFnSWR4ID0gc24gLSBkZXRhaWxzLnN0YXJ0U047XG4gICAgZnJhZ21lbnRzID0gZGV0YWlscy5mcmFnbWVudHM7XG4gICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcblxuXHR2YXIgcHJldkZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCAtIDFdO1xuXHR2YXIgbmV4dEZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCArIDFdO1xuXG4gICAgaWYoIWlzTmFOKGZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICBzdGFydFBUUyA9IE1hdGgubWluKHN0YXJ0UFRTLGZyYWcuc3RhcnRQVFMpO1xuICAgICAgZW5kUFRTID0gTWF0aC5tYXgoZW5kUFRTLCBmcmFnLmVuZFBUUyk7XG4gICAgfVxuXG5cdGlmKCBwcmV2RnJhZyAmJiBNYXRoLmFicyhwcmV2RnJhZy5zdGFydCAtIHN0YXJ0UFRTKSA+IDEwMCkge1xuXHRcdHN0YXJ0UFRTID0gcHJldkZyYWcuc3RhcnQgKyBwcmV2RnJhZy5kdXJhdGlvbjtcblx0XHQvLyBpZiAoZnJhZy5kdXJhdGlvbiA+IDEwMCkgZGVidWdnZXI7XG5cdFx0ZW5kUFRTID0gc3RhcnRQVFMgKyBmcmFnLmR1cmF0aW9uO1xuXHRcdGNvbnNvbGUuaW5mbyhmcmFnLnNuICsgJzogICcgKyBzdGFydFBUUyArICcgLT4gJyArIGVuZFBUUyArICcgfCAnICsgZnJhZy5kdXJhdGlvbik7XG5cdFx0Ly8gZGVidWdnZXI7XG5cdH0gZWxzZSBpZiggbmV4dEZyYWcgJiYgTWF0aC5hYnMobmV4dEZyYWcuc3RhcnQgLSBzdGFydFBUUykgPiAxMDApIHtcblx0XHQvLyBzdGFydFBUUyA9IG5leHRGcmFnLnN0YXJ0ICsgbmV4dEZyYWcuZHVyYXRpb247XG5cdFx0Ly8gZW5kUFRTID0gc3RhcnRQVFMgKyBmcmFnLmR1cmF0aW9uO1xuXHRcdC8vIGNvbnNvbGUubG9nKGZyYWcuc24gKyAnOiAgJyArIHN0YXJ0UFRTICsgJyAtPiAnICsgZW5kUFRTICsgJyB8ICcgKyBmcmFnLmR1cmF0aW9uKTtcblx0XHQvLyBkZWJ1Z2dlcjtcblx0fVxuXG4gICBpZiggTWF0aC5hYnMoc3RhcnRQVFMgLSBlbmRQVFMpID4gMTAwKSB7XG5cdCAgIHZhciBvbGRfZW5kUFRTID0gZW5kUFRTO1xuXHQgICBlbmRQVFMgPSBzdGFydFBUUyArIGZyYWcuZHVyYXRpb247XG5cdCAgIGNvbnNvbGUuaW5mbygnYWRqdXN0aW5nIGVuZFBUUzogJyArIG9sZF9lbmRQVFMgKyAnIC0+ICcgKyBlbmRQVFMpO1xuICAgfVxuXG4gICAgdmFyIGRyaWZ0ID0gc3RhcnRQVFMgLSBmcmFnLnN0YXJ0O1xuXG4gICAgZnJhZy5zdGFydCA9IGZyYWcuc3RhcnRQVFMgPSBzdGFydFBUUztcbiAgICBmcmFnLmVuZFBUUyA9IGVuZFBUUztcbiAgICBmcmFnLmR1cmF0aW9uID0gZW5kUFRTIC0gc3RhcnRQVFM7XG5cblx0Ly8gaWYgKGZyYWcuZHVyYXRpb24gPiAxMDApIGRlYnVnZ2VyO1xuXHRcbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtLTEgdG8gZnJhZyAwXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA+IDAgOyBpLS0pIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpLTEpO1xuICAgIH1cblxuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0gdG8gbGFzdCBmcmFnXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA8IGZyYWdtZW50cy5sZW5ndGggLSAxIDsgaSsrKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaSsxKTtcbiAgICB9XG4gICAgZGV0YWlscy5QVFNLbm93biA9IHRydWU7XG4gICAgLy9sb2dnZXIubG9nKGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYWcgc3RhcnQvZW5kOiR7c3RhcnRQVFMudG9GaXhlZCgzKX0vJHtlbmRQVFMudG9GaXhlZCgzKX1gKTtcblxuICAgIHJldHVybiBkcmlmdDtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVQVFMoZnJhZ21lbnRzLGZyb21JZHgsIHRvSWR4KSB7XG4gICAgdmFyIGZyYWdGcm9tID0gZnJhZ21lbnRzW2Zyb21JZHhdLGZyYWdUbyA9IGZyYWdtZW50c1t0b0lkeF0sIGZyYWdUb1BUUyA9IGZyYWdUby5zdGFydFBUUztcbiAgICAvLyBpZiB3ZSBrbm93IHN0YXJ0UFRTW3RvSWR4XVxuICAgIGlmKCFpc05hTihmcmFnVG9QVFMpKSB7XG4gICAgICAvLyB1cGRhdGUgZnJhZ21lbnQgZHVyYXRpb24uXG4gICAgICAvLyBpdCBoZWxwcyB0byBmaXggZHJpZnRzIGJldHdlZW4gcGxheWxpc3QgcmVwb3J0ZWQgZHVyYXRpb24gYW5kIGZyYWdtZW50IHJlYWwgZHVyYXRpb25cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ0Zyb20uZHVyYXRpb24gPSBmcmFnVG9QVFMtZnJhZ0Zyb20uc3RhcnQ7XG4gICAgICAgIGlmKGZyYWdGcm9tLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yIGZyYWcgJHtmcmFnRnJvbS5zbn0sbGV2ZWwgJHtmcmFnRnJvbS5sZXZlbH0sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuXHRcdCAgZGVidWdnZXI7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5kdXJhdGlvbiA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvUFRTO1xuICAgICAgICBpZihmcmFnVG8uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgZnJhZyAke2ZyYWdUby5zbn0sbGV2ZWwgJHtmcmFnVG8ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcblx0XHQgIGRlYnVnZ2VyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdlIGRvbnQga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgKyBmcmFnRnJvbS5kdXJhdGlvbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvLmR1cmF0aW9uO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbEhlbHBlcjtcbiIsIi8qKlxuICogSExTIGludGVyZmFjZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBBYnJDb250cm9sbGVyIGZyb20gICAgJy4vY29udHJvbGxlci9hYnItY29udHJvbGxlcic7XG5pbXBvcnQgQnVmZmVyQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL2J1ZmZlci1jb250cm9sbGVyJztcbmltcG9ydCBDYXBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9jYXAtbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQgU3RyZWFtQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCBUaW1lbGluZUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL3RpbWVsaW5lLWNvbnRyb2xsZXInO1xuLy9pbXBvcnQgRlBTQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvZnBzLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsIGVuYWJsZUxvZ3N9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgZnJvbSAnLi91dGlscy94aHItbG9hZGVyJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCBLZXlMb2FkZXIgZnJvbSAnLi9sb2FkZXIva2V5LWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIHdpbmRvdy5NZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgc3RhdGljIGdldCBEZWZhdWx0Q29uZmlnKCkge1xuICAgIGlmKCFIbHMuZGVmYXVsdENvbmZpZykge1xuICAgICAgIEhscy5kZWZhdWx0Q29uZmlnID0ge1xuICAgICAgICAgIGF1dG9TdGFydExvYWQ6IHRydWUsXG4gICAgICAgICAgZGVidWc6IHRydWUsXG4gICAgICAgICAgY2FwTGV2ZWxUb1BsYXllclNpemU6IGZhbHNlLFxuICAgICAgICAgIG1heEJ1ZmZlckxlbmd0aDogMzAsXG4gICAgICAgICAgbWF4QnVmZmVyU2l6ZTogNjAgKiAxMDAwICogMTAwMCxcbiAgICAgICAgICBtYXhCdWZmZXJIb2xlOiA1LFxuICAgICAgICAgIG1heFNlZWtIb2xlOiAyLFxuICAgICAgICAgIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgOiAwLjIsXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbkNvdW50OjMsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50OiBJbmZpbml0eSxcbiAgICAgICAgICBsaXZlU3luY0R1cmF0aW9uOiB1bmRlZmluZWQsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgIG1heE1heEJ1ZmZlckxlbmd0aDogNjAwLFxuICAgICAgICAgIGVuYWJsZVdvcmtlcjogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVTb2Z0d2FyZUFFUzogdHJ1ZSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeTogMSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ1RpbWVPdXQ6IDEwMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ01heFJldHJ5OiA0LFxuICAgICAgICAgIGxldmVsTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0OiAyMDAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ01heFJldHJ5OiAyMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkOiAzLFxuICAgICAgICAgIHN0YXJ0RnJhZ1ByZWZldGNoIDogZmFsc2UsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2Q6IDUwMDAsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQ6IDAuMixcbiAgICAgICAgICBhcHBlbmRFcnJvck1heFJldHJ5OiAzLFxuICAgICAgICAgIGxvYWRlcjogWGhyTG9hZGVyLFxuICAgICAgICAgIGZMb2FkZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgYWJyQ29udHJvbGxlciA6IEFickNvbnRyb2xsZXIsXG4gICAgICAgICAgYnVmZmVyQ29udHJvbGxlciA6IEJ1ZmZlckNvbnRyb2xsZXIsXG4gICAgICAgICAgY2FwTGV2ZWxDb250cm9sbGVyIDogQ2FwTGV2ZWxDb250cm9sbGVyLFxuICAgICAgICAgIHN0cmVhbUNvbnRyb2xsZXI6IFN0cmVhbUNvbnRyb2xsZXIsXG4gICAgICAgICAgdGltZWxpbmVDb250cm9sbGVyOiBUaW1lbGluZUNvbnRyb2xsZXIsXG4gICAgICAgICAgZW5hYmxlQ0VBNzA4Q2FwdGlvbnM6IHRydWUsXG4gICAgICAgICAgZW5hYmxlTVAyVFBhc3NUaHJvdWdoIDogZmFsc2VcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIEhscy5kZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgc3RhdGljIHNldCBEZWZhdWx0Q29uZmlnKGRlZmF1bHRDb25maWcpIHtcbiAgICBIbHMuZGVmYXVsdENvbmZpZyA9IGRlZmF1bHRDb25maWc7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgIHZhciBkZWZhdWx0Q29uZmlnID0gSGxzLkRlZmF1bHRDb25maWc7XG5cbiAgICBpZiAoKGNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgfHwgY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCkgJiYgKGNvbmZpZy5saXZlU3luY0R1cmF0aW9uIHx8IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IGRvblxcJ3QgbWl4IHVwIGxpdmVTeW5jRHVyYXRpb25Db3VudC9saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgYW5kIGxpdmVTeW5jRHVyYXRpb24vbGl2ZU1heExhdGVuY3lEdXJhdGlvbicpO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gZGVmYXVsdENvbmZpZykge1xuICAgICAgICBpZiAocHJvcCBpbiBjb25maWcpIHsgY29udGludWU7IH1cbiAgICAgICAgY29uZmlnW3Byb3BdID0gZGVmYXVsdENvbmZpZ1twcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCAhPT0gdW5kZWZpbmVkICYmIGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgPD0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50XCIgbXVzdCBiZSBndCBcImxpdmVTeW5jRHVyYXRpb25Db3VudFwiJyk7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uICE9PSB1bmRlZmluZWQgJiYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uIDw9IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uIHx8IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uID09PSB1bmRlZmluZWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgaGxzLmpzIGNvbmZpZzogXCJsaXZlTWF4TGF0ZW5jeUR1cmF0aW9uXCIgbXVzdCBiZSBndCBcImxpdmVTeW5jRHVyYXRpb25cIicpO1xuICAgIH1cblxuICAgIGVuYWJsZUxvZ3MoY29uZmlnLmRlYnVnKTtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICAvLyBvYnNlcnZlciBzZXR1cFxuICAgIHZhciBvYnNlcnZlciA9IHRoaXMub2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcblxuICAgIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCAuLi5kYXRhKTtcbiAgICB9O1xuICAgIHRoaXMub24gPSBvYnNlcnZlci5vbi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLm9mZiA9IG9ic2VydmVyLm9mZi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnRyaWdnZXIgPSBvYnNlcnZlci50cmlnZ2VyLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBuZXcgUGxheWxpc3RMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlciA9IG5ldyBGcmFnbWVudExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG5ldyBMZXZlbENvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5hYnJDb250cm9sbGVyID0gbmV3IGNvbmZpZy5hYnJDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYnVmZmVyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmNhcExldmVsQ29udHJvbGxlciA9IG5ldyBjb25maWcuY2FwTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlciA9IG5ldyBjb25maWcuc3RyZWFtQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnRpbWVsaW5lQ29udHJvbGxlciA9IG5ldyBjb25maWcudGltZWxpbmVDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMua2V5TG9hZGVyID0gbmV3IEtleUxvYWRlcih0aGlzKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlciA9IG5ldyBGUFNDb250cm9sbGVyKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBsb2dnZXIubG9nKCdkZXN0cm95Jyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50LkRFU1RST1lJTkcpO1xuICAgIHRoaXMuZGV0YWNoTWVkaWEoKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmNhcExldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnRpbWVsaW5lQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5rZXlMb2FkZXIuZGVzdHJveSgpO1xuICAgIC8vdGhpcy5mcHNDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gICAgdGhpcy5vYnNlcnZlci5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGF0dGFjaE1lZGlhKG1lZGlhKSB7XG4gICAgbG9nZ2VyLmxvZygnYXR0YWNoTWVkaWEnKTtcbiAgICB0aGlzLm1lZGlhID0gbWVkaWE7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0FUVEFDSElORywge21lZGlhOiBtZWRpYX0pO1xuICB9XG5cbiAgZGV0YWNoTWVkaWEoKSB7XG4gICAgbG9nZ2VyLmxvZygnZGV0YWNoTWVkaWEnKTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUVESUFfREVUQUNISU5HKTtcbiAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgfVxuXG4gIGxvYWRTb3VyY2UodXJsKSB7XG4gICAgbG9nZ2VyLmxvZyhgbG9hZFNvdXJjZToke3VybH1gKTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHt1cmw6IHVybH0pO1xuICB9XG5cbiAgc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb249MCkge1xuICAgIGxvZ2dlci5sb2coJ3N0YXJ0TG9hZCcpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TG9hZCgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zdGFydExvYWQoc3RhcnRQb3NpdGlvbik7XG4gIH1cblxuICBzdG9wTG9hZCgpIHtcbiAgICBsb2dnZXIubG9nKCdzdG9wTG9hZCcpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0b3BMb2FkKCk7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLnN0b3BMb2FkKCk7XG4gIH1cblxuICBzd2FwQXVkaW9Db2RlYygpIHtcbiAgICBsb2dnZXIubG9nKCdzd2FwQXVkaW9Db2RlYycpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zd2FwQXVkaW9Db2RlYygpO1xuICB9XG5cbiAgcmVjb3Zlck1lZGlhRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZygncmVjb3Zlck1lZGlhRXJyb3InKTtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIHRoaXMuZGV0YWNoTWVkaWEoKTtcbiAgICB0aGlzLmF0dGFjaE1lZGlhKG1lZGlhKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gYWxsIHF1YWxpdHkgbGV2ZWxzICoqL1xuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbHM7XG4gIH1cblxuICAvKiogUmV0dXJuIGN1cnJlbnQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAqKi9cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5zdHJlYW1Db250cm9sbGVyLmN1cnJlbnRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGltbWVkaWF0ZWx5ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGN1cnJlbnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBjdXJyZW50TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtQ29udHJvbGxlci5uZXh0TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBuZXh0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgbmV4dExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIGN1cnJlbnQvbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIGN1cnJlbnQvbmV4dCBsb2FkZWQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbG9hZExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGxvYWRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgc2V0IG5leHRMb2FkTGV2ZWwobGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgZmlyc3RMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsO1xuICB9XG5cbiAgLyoqIHNldCAgc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IHN0YXJ0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgYXV0b0xldmVsQ2FwcGluZzoke25ld0xldmVsfWApO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiBjaGVjayBpZiB3ZSBhcmUgaW4gYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBtb2RlICovXG4gIGdldCBhdXRvTGV2ZWxFbmFibGVkKCkge1xuICAgIHJldHVybiAodGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPT09IC0xKTtcbiAgfVxuXG4gIC8qIHJldHVybiBtYW51YWwgbGV2ZWwgKi9cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBIbHM7XG4iLCIvLyBUaGlzIGlzIG1vc3RseSBmb3Igc3VwcG9ydCBvZiB0aGUgZXM2IG1vZHVsZSBleHBvcnRcbi8vIHN5bnRheCB3aXRoIHRoZSBiYWJlbCBjb21waWxlciwgaXQgbG9va3MgbGlrZSBpdCBkb2VzbnQgc3VwcG9ydFxuLy8gZnVuY3Rpb24gZXhwb3J0cyBsaWtlIHdlIGFyZSB1c2VkIHRvIGluIG5vZGUvY29tbW9uanNcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9obHMuanMnKS5kZWZhdWx0O1xuXG4iLCIvKlxuICogRnJhZ21lbnQgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgRnJhZ21lbnRMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuRlJBR19MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSBkYXRhLmZyYWc7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gMDtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLmZMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcuZkxvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKGZyYWcudXJsLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgMSwgMCwgdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKSwgZnJhZyk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgcGF5bG9hZCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2U7XG4gICAgc3RhdHMubGVuZ3RoID0gcGF5bG9hZC5ieXRlTGVuZ3RoO1xuICAgIC8vIGRldGFjaCBmcmFnbWVudCBsb2FkZXIgb24gbG9hZCBzdWNjZXNzXG4gICAgdGhpcy5mcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BREVELCB7cGF5bG9hZDogcGF5bG9hZCwgZnJhZzogdGhpcy5mcmFnLCBzdGF0czogc3RhdHN9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnfSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IHN0YXRzLmxvYWRlZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywge2ZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRnJhZ21lbnRMb2FkZXI7XG4iLCIvKlxuICogRGVjcnlwdCBrZXkgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgS2V5TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LktFWV9MT0FESU5HKTtcbiAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgIHRoaXMuZGVjcnlwdHVybCA9IG51bGw7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uS2V5TG9hZGluZyhkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWcgPSBkYXRhLmZyYWcsXG4gICAgICAgIGRlY3J5cHRkYXRhID0gZnJhZy5kZWNyeXB0ZGF0YSxcbiAgICAgICAgdXJpID0gZGVjcnlwdGRhdGEudXJpO1xuICAgICAgICAvLyBpZiB1cmkgaXMgZGlmZmVyZW50IGZyb20gcHJldmlvdXMgb25lIG9yIGlmIGRlY3J5cHQga2V5IG5vdCByZXRyaWV2ZWQgeWV0XG4gICAgICBpZiAodXJpICE9PSB0aGlzLmRlY3J5cHR1cmwgfHwgdGhpcy5kZWNyeXB0a2V5ID09PSBudWxsKSB7XG4gICAgICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgICAgICB0aGlzLmRlY3J5cHR1cmwgPSB1cmk7XG4gICAgICAgIHRoaXMuZGVjcnlwdGtleSA9IG51bGw7XG4gICAgICAgIGZyYWcubG9hZGVyLmxvYWQodXJpLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnksIGNvbmZpZy5mcmFnTG9hZGluZ1JldHJ5RGVsYXksIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmRlY3J5cHRrZXkpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBsb2FkZWQgdGhpcyBrZXksIHJldHVybiBpdFxuICAgICAgICBkZWNyeXB0ZGF0YS5rZXkgPSB0aGlzLmRlY3J5cHRrZXk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgIH1cbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWc7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPSBuZXcgVWludDhBcnJheShldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlKTtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIGZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZywgcmVzcG9uc2U6IGV2ZW50fSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgS2V5TG9hZGVyO1xuIiwiLyoqXG4gKiBQbGF5bGlzdCBMb2FkZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IFVSTEhlbHBlciBmcm9tICcuLi91dGlscy91cmwnO1xuaW1wb3J0IEF0dHJMaXN0IGZyb20gJy4uL3V0aWxzL2F0dHItbGlzdCc7XG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBQbGF5bGlzdExvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BRElORyxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURJTkcpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcblx0dGhpcy50b3RhbER1cmF0aW9uID0gMDtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsIG51bGwpO1xuICB9XG5cbiAgb25MZXZlbExvYWRpbmcoZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgZGF0YS5sZXZlbCwgZGF0YS5pZCk7XG5cdHRoaXMudG90YWxEdXJhdGlvbiA9IGRhdGEudG90YWxEdXJhdGlvbiB8fCAwO1xuXHRjb25zb2xlLmluZm8oIGRhdGEgKTtcbiAgfVxuXG4gIGxvYWQodXJsLCBpZDEsIGlkMikge1xuICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWcsXG4gICAgICAgIHJldHJ5LFxuICAgICAgICB0aW1lb3V0LFxuICAgICAgICByZXRyeURlbGF5O1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuaWQgPSBpZDE7XG4gICAgdGhpcy5pZDIgPSBpZDI7XG4gICAgaWYodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgcmV0cnkgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk7XG4gICAgICB0aW1lb3V0ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1RpbWVPdXQ7XG4gICAgICByZXRyeURlbGF5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLmxldmVsTG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5sZXZlbExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5sZXZlbExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH1cbiAgICB0aGlzLmxvYWRlciA9IHR5cGVvZihjb25maWcucExvYWRlcikgIT09ICd1bmRlZmluZWQnID8gbmV3IGNvbmZpZy5wTG9hZGVyKGNvbmZpZykgOiBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCAnJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIHRpbWVvdXQsIHJldHJ5LCByZXRyeURlbGF5KTtcbiAgfVxuXG4gIHJlc29sdmUodXJsLCBiYXNlVXJsKSB7XG4gICAgcmV0dXJuIFVSTEhlbHBlci5idWlsZEFic29sdXRlVVJMKGJhc2VVcmwsIHVybCk7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgYmFzZXVybCkge1xuICAgIGxldCBsZXZlbHMgPSBbXSwgcmVzdWx0O1xuXG4gICAgLy8gaHR0cHM6Ly9yZWdleDEwMS5jb20gaXMgeW91ciBmcmllbmRcbiAgICBjb25zdCByZSA9IC8jRVhULVgtU1RSRUFNLUlORjooW15cXG5cXHJdKilbXFxyXFxuXSsoW15cXHJcXG5dKykvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlLmV4ZWMoc3RyaW5nKSkgIT0gbnVsbCl7XG4gICAgICBjb25zdCBsZXZlbCA9IHt9O1xuXG4gICAgICB2YXIgYXR0cnMgPSBsZXZlbC5hdHRycyA9IG5ldyBBdHRyTGlzdChyZXN1bHRbMV0pO1xuICAgICAgbGV2ZWwudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG5cbiAgICAgIHZhciByZXNvbHV0aW9uID0gYXR0cnMuZGVjaW1hbFJlc29sdXRpb24oJ1JFU09MVVRJT04nKTtcbiAgICAgIGlmKHJlc29sdXRpb24pIHtcbiAgICAgICAgbGV2ZWwud2lkdGggPSByZXNvbHV0aW9uLndpZHRoO1xuICAgICAgICBsZXZlbC5oZWlnaHQgPSByZXNvbHV0aW9uLmhlaWdodDtcbiAgICAgIH1cbiAgICAgIGxldmVsLmJpdHJhdGUgPSBhdHRycy5kZWNpbWFsSW50ZWdlcignQkFORFdJRFRIJyk7XG4gICAgICBsZXZlbC5uYW1lID0gYXR0cnMuTkFNRTtcblxuICAgICAgdmFyIGNvZGVjcyA9IGF0dHJzLkNPREVDUztcbiAgICAgIGlmKGNvZGVjcykge1xuICAgICAgICBjb2RlY3MgPSBjb2RlY3Muc3BsaXQoJywnKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2RlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBjb2RlYyA9IGNvZGVjc1tpXTtcbiAgICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignYXZjMScpICE9PSAtMSkge1xuICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV2ZWwuYXVkaW9Db2RlYyA9IGNvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBhdmMxdG9hdmNvdGkoY29kZWMpIHtcbiAgICB2YXIgcmVzdWx0LCBhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZiAoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMDAnICsgcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNikpLnN1YnN0cigtNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGNvZGVjO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgY2xvbmVPYmoob2JqKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZCkge1xuICAgIHZhciBjdXJyZW50U04gPSAwLFxuICAgICAgICB0b3RhbGR1cmF0aW9uID0gMCxcbiAgICAgICAgbGV2ZWwgPSB7dXJsOiBiYXNldXJsLCBmcmFnbWVudHM6IFtdLCBsaXZlOiB0cnVlLCBzdGFydFNOOiAwfSxcbiAgICAgICAgbGV2ZWxrZXkgPSB7bWV0aG9kIDogbnVsbCwga2V5IDogbnVsbCwgaXYgOiBudWxsLCB1cmkgOiBudWxsfSxcbiAgICAgICAgY2MgPSAwLFxuICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsLFxuICAgICAgICBmcmFnID0gbnVsbCxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICByZWdleHAsXG4gICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCxcbiAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQsXG5cdFx0bmV4dFRpbWVzdGFtcDtcblxuXHR2YXIgcmUgPSAgLyhcXGQrKV9cXGQrLnRzLztcblxuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVC1YLShLRVkpOiguKikpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSooW1xcclxcbl0rW14jfFxcclxcbl0rKT8pfCg/OiNFWFQtWC0oQllURVJBTkdFKTooW1xcZF0rW0BbXFxkXSopXSpbXFxyXFxuXSsoW14jfFxcclxcbl0rKT98KD86I0VYVC1YLShFTkRMSVNUKSl8KD86I0VYVC1YLShESVMpQ09OVElOVUlUWSkpfCg/OiNFWFQtWC0oUFJPR1JBTS1EQVRFLVRJTUUpOiguKikpL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCkge1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4pIHsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpOyB9KTtcbiAgICAgIHN3aXRjaCAocmVzdWx0WzBdKSB7XG4gICAgICAgIGNhc2UgJ01FRElBLVNFUVVFTkNFJzpcbiAgICAgICAgICBjdXJyZW50U04gPSBsZXZlbC5zdGFydFNOID0gcGFyc2VJbnQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnVEFSR0VURFVSQVRJT04nOlxuICAgICAgICAgIGxldmVsLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBsZXZlbC5saXZlID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0RJUyc6XG4gICAgICAgICAgY2MrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnQllURVJBTkdFJzpcbiAgICAgICAgICB2YXIgcGFyYW1zID0gcmVzdWx0WzFdLnNwbGl0KCdAJyk7XG4gICAgICAgICAgaWYgKHBhcmFtcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1swXSkgKyBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICBpZiAoZnJhZyAmJiAhZnJhZy51cmwpIHtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGlmICghaXNOYU4oZHVyYXRpb24pKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ2RlY3J5cHRkYXRhLFxuICAgICAgICAgICAgICAgIHNuID0gY3VycmVudFNOKys7XG4gICAgICAgICAgICBpZiAobGV2ZWxrZXkubWV0aG9kICYmIGxldmVsa2V5LnVyaSAmJiAhbGV2ZWxrZXkuaXYpIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gdGhpcy5jbG9uZU9iaihsZXZlbGtleSk7XG4gICAgICAgICAgICAgIHZhciB1aW50OFZpZXcgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxMjsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgICAgICAgICB1aW50OFZpZXdbaV0gPSAoc24gPj4gOCooMTUtaSkpICYgMHhmZjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEuaXYgPSB1aW50OFZpZXc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSBsZXZlbGtleTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB1cmwgPSByZXN1bHRbMl0gPyB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKSA6IG51bGw7XG5cblx0XHRcdHZhciBtYXRjaCA9IHJlLmV4ZWMoIHVybCApO1xuXHRcdFx0dmFyIHRpbWVzdGFtcCA9IChtYXRjaCAmJiBtYXRjaFsxXSkgPyBtYXRjaFsxXSA6IG51bGw7XG5cblx0XHRcdC8vIGlmICh0aW1lc3RhbXAgJiYgbmV4dFRpbWVzdGFtcCkge1xuXHRcdFx0Ly8gXHR0aW1lc3RhbXAgPSBwYXJzZUludCggdGltZXN0YW1wICk7XG5cdFx0XHQvLyBcdGlmICggdGltZXN0YW1wIC0gbmV4dFRpbWVzdGFtcCA+IDIwMDAgKSB7XG5cdFx0XHQvLyBcdFx0Y29uc29sZS5sb2coIHRpbWVzdGFtcCArICcgJyArIG5leHRUaW1lc3RhbXAgKyAnICcgKyB1cmwgKTtcblx0XHRcdC8vIFx0XHRjYysrO1xuXHRcdFx0Ly8gXHR9XG5cdFx0XHQvLyB9XG5cblx0XHRcdG5leHRUaW1lc3RhbXAgPSB0aW1lc3RhbXAgKyBkdXJhdGlvbioxMDAwO1xuXG5cbiAgICAgICAgICAgIGZyYWcgPSB7dXJsOiB1cmwsIGR1cmF0aW9uOiBkdXJhdGlvbiwgc3RhcnQ6IHRvdGFsZHVyYXRpb24sIHNuOiBzbiwgbGV2ZWw6IGlkLCBjYzogY2MsIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0OiBieXRlUmFuZ2VTdGFydE9mZnNldCwgYnl0ZVJhbmdlRW5kT2Zmc2V0OiBieXRlUmFuZ2VFbmRPZmZzZXQsIGRlY3J5cHRkYXRhIDogZnJhZ2RlY3J5cHRkYXRhLCBwcm9ncmFtRGF0ZVRpbWU6IHByb2dyYW1EYXRlVGltZX07XG4gICAgICAgICAgICBsZXZlbC5mcmFnbWVudHMucHVzaChmcmFnKTtcbiAgICAgICAgICAgIHRvdGFsZHVyYXRpb24gKz0gZHVyYXRpb247XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IG51bGw7XG4gICAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnS0VZJzpcbiAgICAgICAgICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvZHJhZnQtcGFudG9zLWh0dHAtbGl2ZS1zdHJlYW1pbmctMDgjc2VjdGlvbi0zLjQuNFxuICAgICAgICAgIHZhciBkZWNyeXB0cGFyYW1zID0gcmVzdWx0WzFdO1xuICAgICAgICAgIHZhciBrZXlBdHRycyA9IG5ldyBBdHRyTGlzdChkZWNyeXB0cGFyYW1zKTtcbiAgICAgICAgICB2YXIgZGVjcnlwdG1ldGhvZCA9IGtleUF0dHJzLmVudW1lcmF0ZWRTdHJpbmcoJ01FVEhPRCcpLFxuICAgICAgICAgICAgICBkZWNyeXB0dXJpID0ga2V5QXR0cnMuVVJJLFxuICAgICAgICAgICAgICBkZWNyeXB0aXYgPSBrZXlBdHRycy5oZXhhZGVjaW1hbEludGVnZXIoJ0lWJyk7XG4gICAgICAgICAgaWYgKGRlY3J5cHRtZXRob2QpIHtcbiAgICAgICAgICAgIGxldmVsa2V5ID0geyBtZXRob2Q6IG51bGwsIGtleTogbnVsbCwgaXY6IG51bGwsIHVyaTogbnVsbCB9O1xuICAgICAgICAgICAgaWYgKChkZWNyeXB0dXJpKSAmJiAoZGVjcnlwdG1ldGhvZCA9PT0gJ0FFUy0xMjgnKSkge1xuICAgICAgICAgICAgICBsZXZlbGtleS5tZXRob2QgPSBkZWNyeXB0bWV0aG9kO1xuICAgICAgICAgICAgICAvLyBVUkkgdG8gZ2V0IHRoZSBrZXlcbiAgICAgICAgICAgICAgbGV2ZWxrZXkudXJpID0gdGhpcy5yZXNvbHZlKGRlY3J5cHR1cmksIGJhc2V1cmwpO1xuICAgICAgICAgICAgICBsZXZlbGtleS5rZXkgPSBudWxsO1xuICAgICAgICAgICAgICAvLyBJbml0aWFsaXphdGlvbiBWZWN0b3IgKElWKVxuICAgICAgICAgICAgICBsZXZlbGtleS5pdiA9IGRlY3J5cHRpdjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1BST0dSQU0tREFURS1USU1FJzpcbiAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBuZXcgRGF0ZShEYXRlLnBhcnNlKHJlc3VsdFsxXSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZvdW5kICcgKyBsZXZlbC5mcmFnbWVudHMubGVuZ3RoICsgJyBmcmFnbWVudHMnKTtcbiAgICBpZihmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgbGV2ZWwuZnJhZ21lbnRzLnBvcCgpO1xuICAgICAgdG90YWxkdXJhdGlvbi09ZnJhZy5kdXJhdGlvbjtcbiAgICB9XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuXG5cdGlmIChsZXZlbC5saXZlKSB7XG5cdFx0dmFyIGVuZFBUUztcblx0XHRmb3IgKHZhciBpIGluIGxldmVsLmZyYWdtZW50cykge1xuXHRcdFx0dmFyIGYgPSBsZXZlbC5mcmFnbWVudHNbaV07XG5cdFx0XHRmLnN0YXJ0ID0gcGFyc2VJbnQoIHRoaXMudG90YWxEdXJhdGlvbiApO1xuXHRcdFx0Y29uc29sZS5pbmZvKFwic3RhcnQ6IFwiICsgZi5zdGFydCArIFwiICBlbmRQVFM6IFwiICsgZW5kUFRTKTtcblx0XHRcdGVuZFBUUyA9IGYuZW5kUFRTO1xuXHRcdH1cblx0XHRsZXZlbC50b3RhbGR1cmF0aW9uID0gZW5kUFRTID8gZW5kUFRTIDogbGV2ZWwudG90YWxkdXJhdGlvbiArIHRoaXMudG90YWxEdXJhdGlvbjtcblx0XHRjb25zb2xlLmluZm8obGV2ZWwpO1xuXHR9XG4gICAgcmV0dXJuIGxldmVsO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHRhcmdldCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQsXG4gICAgICAgIHN0cmluZyA9IHRhcmdldC5yZXNwb25zZVRleHQsXG4gICAgICAgIHVybCA9IHRhcmdldC5yZXNwb25zZVVSTCxcbiAgICAgICAgaWQgPSB0aGlzLmlkLFxuICAgICAgICBpZDIgPSB0aGlzLmlkMixcbiAgICAgICAgaGxzID0gdGhpcy5obHMsXG4gICAgICAgIGxldmVscztcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZiAodXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGluaXRpYWwgVVJMXG4gICAgICB1cmwgPSB0aGlzLnVybDtcbiAgICB9XG4gICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBzdGF0cy5tdGltZSA9IG5ldyBEYXRlKHRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcbiAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBbe3VybDogdXJsfV0sIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgbGV2ZWxEZXRhaWxzID0gdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCB1cmwsIGlkKTtcbiAgICAgICAgICBzdGF0cy50cGFyc2VkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELCB7ZGV0YWlsczogbGV2ZWxEZXRhaWxzLCBsZXZlbDogaWQsIGlkOiBpZDIsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMgPSB0aGlzLnBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCB1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZiAobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogbGV2ZWxzLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gbGV2ZWwgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIEVYVE0zVSBkZWxpbWl0ZXInfSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgdmFyIGRldGFpbHMsIGZhdGFsO1xuICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLk1BTklGRVNUX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCByZXNwb25zZTogZXZlbnQuY3VycmVudFRhcmdldCwgbGV2ZWw6IHRoaXMuaWQsIGlkOiB0aGlzLmlkMn0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdmFyIGRldGFpbHMsIGZhdGFsO1xuICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLk1BTklGRVNUX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgbGV2ZWw6IHRoaXMuaWQsIGlkOiB0aGlzLmlkMn0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBsYXlsaXN0TG9hZGVyO1xuIiwiLyoqXG4gKiBHZW5lcmF0ZSBNUDQgQm94XG4qL1xuXG4vL2ltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcbmNsYXNzIE1QNCB7XG4gIHN0YXRpYyBpbml0KCkge1xuICAgIE1QNC50eXBlcyA9IHtcbiAgICAgIGF2YzE6IFtdLCAvLyBjb2RpbmduYW1lXG4gICAgICBhdmNDOiBbXSxcbiAgICAgIGJ0cnQ6IFtdLFxuICAgICAgZGluZjogW10sXG4gICAgICBkcmVmOiBbXSxcbiAgICAgIGVzZHM6IFtdLFxuICAgICAgZnR5cDogW10sXG4gICAgICBoZGxyOiBbXSxcbiAgICAgIG1kYXQ6IFtdLFxuICAgICAgbWRoZDogW10sXG4gICAgICBtZGlhOiBbXSxcbiAgICAgIG1maGQ6IFtdLFxuICAgICAgbWluZjogW10sXG4gICAgICBtb29mOiBbXSxcbiAgICAgIG1vb3Y6IFtdLFxuICAgICAgbXA0YTogW10sXG4gICAgICBtdmV4OiBbXSxcbiAgICAgIG12aGQ6IFtdLFxuICAgICAgc2R0cDogW10sXG4gICAgICBzdGJsOiBbXSxcbiAgICAgIHN0Y286IFtdLFxuICAgICAgc3RzYzogW10sXG4gICAgICBzdHNkOiBbXSxcbiAgICAgIHN0c3o6IFtdLFxuICAgICAgc3R0czogW10sXG4gICAgICB0ZmR0OiBbXSxcbiAgICAgIHRmaGQ6IFtdLFxuICAgICAgdHJhZjogW10sXG4gICAgICB0cmFrOiBbXSxcbiAgICAgIHRydW46IFtdLFxuICAgICAgdHJleDogW10sXG4gICAgICB0a2hkOiBbXSxcbiAgICAgIHZtaGQ6IFtdLFxuICAgICAgc21oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHZpZGVvSGRsciA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LCAvLyBoYW5kbGVyX3R5cGU6ICd2aWRlJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgIDB4NmYsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdWaWRlb0hhbmRsZXInXG4gICAgXSk7XG5cbiAgICB2YXIgYXVkaW9IZGxyID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzMsIDB4NmYsIDB4NzUsIDB4NmUsIC8vIGhhbmRsZXJfdHlwZTogJ3NvdW4nXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDUzLCAweDZmLCAweDc1LCAweDZlLFxuICAgICAgMHg2NCwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1NvdW5kSGFuZGxlcidcbiAgICBdKTtcblxuICAgIE1QNC5IRExSX1RZUEVTID0ge1xuICAgICAgJ3ZpZGVvJzogdmlkZW9IZGxyLFxuICAgICAgJ2F1ZGlvJzogYXVkaW9IZGxyXG4gICAgfTtcblxuICAgIHZhciBkcmVmID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZW50cnlfY291bnRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MGMsIC8vIGVudHJ5X3NpemVcbiAgICAgIDB4NzUsIDB4NzIsIDB4NmMsIDB4MjAsIC8vICd1cmwnIHR5cGVcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSAvLyBlbnRyeV9mbGFnc1xuICAgIF0pO1xuXG4gICAgdmFyIHN0Y28gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuXG4gICAgTVA0LlNUVFMgPSBNUDQuU1RTQyA9IE1QNC5TVENPID0gc3RjbztcblxuICAgIE1QNC5TVFNaID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfY291bnRcbiAgICBdKTtcbiAgICBNUDQuVk1IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBncmFwaGljc21vZGVcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCAvLyBvcGNvbG9yXG4gICAgXSk7XG4gICAgTVA0LlNNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gYmFsYW5jZVxuICAgICAgMHgwMCwgMHgwMCAvLyByZXNlcnZlZFxuICAgIF0pO1xuXG4gICAgTVA0LlNUU0QgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxXSk7Ly8gZW50cnlfY291bnRcblxuICAgIHZhciBtYWpvckJyYW5kID0gbmV3IFVpbnQ4QXJyYXkoWzEwNSwxMTUsMTExLDEwOV0pOyAvLyBpc29tXG4gICAgdmFyIGF2YzFCcmFuZCA9IG5ldyBVaW50OEFycmF5KFs5NywxMTgsOTksNDldKTsgLy8gYXZjMVxuICAgIHZhciBtaW5vclZlcnNpb24gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuXG4gICAgTVA0LkZUWVAgPSBNUDQuYm94KE1QNC50eXBlcy5mdHlwLCBtYWpvckJyYW5kLCBtaW5vclZlcnNpb24sIG1ham9yQnJhbmQsIGF2YzFCcmFuZCk7XG4gICAgTVA0LkRJTkYgPSBNUDQuYm94KE1QNC50eXBlcy5kaW5mLCBNUDQuYm94KE1QNC50eXBlcy5kcmVmLCBkcmVmKSk7XG4gIH1cblxuICBzdGF0aWMgYm94KHR5cGUpIHtcbiAgdmFyXG4gICAgcGF5bG9hZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG4gICAgc2l6ZSA9IDgsXG4gICAgaSA9IHBheWxvYWQubGVuZ3RoLFxuICAgIGxlbiA9IGksXG4gICAgcmVzdWx0O1xuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgc2l6ZSB3ZSBuZWVkIHRvIGFsbG9jYXRlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHNpemUpO1xuICAgIHJlc3VsdFswXSA9IChzaXplID4+IDI0KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzFdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgICByZXN1bHRbMl0gPSAoc2l6ZSA+PiA4KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzNdID0gc2l6ZSAgJiAweGZmO1xuICAgIHJlc3VsdC5zZXQodHlwZSwgNCk7XG4gICAgLy8gY29weSB0aGUgcGF5bG9hZCBpbnRvIHRoZSByZXN1bHRcbiAgICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAvLyBjb3B5IHBheWxvYWRbaV0gYXJyYXkgQCBvZmZzZXQgc2l6ZVxuICAgICAgcmVzdWx0LnNldChwYXlsb2FkW2ldLCBzaXplKTtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgc3RhdGljIGhkbHIodHlwZSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5oZGxyLCBNUDQuSERMUl9UWVBFU1t0eXBlXSk7XG4gIH1cblxuICBzdGF0aWMgbWRhdChkYXRhKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kYXQsIGRhdGEpO1xuICB9XG5cbiAgc3RhdGljIG1kaGQodGltZXNjYWxlLCBkdXJhdGlvbikge1xuICAgIGR1cmF0aW9uICo9IHRpbWVzY2FsZTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMywgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgICAgMHgwMCwgMHgwMFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGlhKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaWEsIE1QNC5tZGhkKHRyYWNrLnRpbWVzY2FsZSwgdHJhY2suZHVyYXRpb24pLCBNUDQuaGRscih0cmFjay50eXBlKSwgTVA0Lm1pbmYodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyBtZmhkKHNlcXVlbmNlTnVtYmVyKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1maGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDI0KSxcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAxNikgJiAweEZGLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+ICA4KSAmIDB4RkYsXG4gICAgICBzZXF1ZW5jZU51bWJlciAmIDB4RkYsIC8vIHNlcXVlbmNlX251bWJlclxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtaW5mKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy5zbWhkLCBNUDQuU01IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMudm1oZCwgTVA0LlZNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgbW9vZihzbiwgYmFzZU1lZGlhRGVjb2RlVGltZSwgdHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubW9vZiwgTVA0Lm1maGQoc24pLCBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLnRpbWVzY2FsZSwgdHJhY2tzWzBdLmR1cmF0aW9uKV0uY29uY2F0KGJveGVzKS5jb25jYXQoTVA0Lm12ZXgodHJhY2tzKSkpO1xuICB9XG5cbiAgc3RhdGljIG12ZXgodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmV4KHRyYWNrc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubXZleF0uY29uY2F0KGJveGVzKSk7XG4gIH1cblxuICBzdGF0aWMgbXZoZCh0aW1lc2NhbGUsZHVyYXRpb24pIHtcbiAgICBkdXJhdGlvbio9dGltZXNjYWxlO1xuICAgIHZhclxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgICAoZHVyYXRpb24gPj4gMjQpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAgIDB4MDEsIDB4MDAsIC8vIDEuMCB2b2x1bWVcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweGZmLCAweGZmLCAweGZmLCAweGZmIC8vIG5leHRfdHJhY2tfSURcbiAgICAgIF0pO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tdmhkLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc2R0cCh0cmFjaykge1xuICAgIHZhclxuICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgICBmbGFncyxcbiAgICAgIGk7XG4gICAgLy8gbGVhdmUgdGhlIGZ1bGwgYm94IGhlYWRlciAoNCBieXRlcykgYWxsIHplcm9cbiAgICAvLyB3cml0ZSB0aGUgc2FtcGxlIHRhYmxlXG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZsYWdzID0gc2FtcGxlc1tpXS5mbGFncztcbiAgICAgIGJ5dGVzW2kgKyA0XSA9IChmbGFncy5kZXBlbmRzT24gPDwgNCkgfFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDIpIHxcbiAgICAgICAgKGZsYWdzLmhhc1JlZHVuZGFuY3kpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zZHRwLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc3RibCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdGJsLCBNUDQuc3RzZCh0cmFjayksIE1QNC5ib3goTVA0LnR5cGVzLnN0dHMsIE1QNC5TVFRTKSwgTVA0LmJveChNUDQudHlwZXMuc3RzYywgTVA0LlNUU0MpLCBNUDQuYm94KE1QNC50eXBlcy5zdHN6LCBNUDQuU1RTWiksIE1QNC5ib3goTVA0LnR5cGVzLnN0Y28sIE1QNC5TVENPKSk7XG4gIH1cblxuICBzdGF0aWMgYXZjMSh0cmFjaykge1xuICAgIHZhciBzcHMgPSBbXSwgcHBzID0gW10sIGksIGRhdGEsIGxlbjtcbiAgICAvLyBhc3NlbWJsZSB0aGUgU1BTc1xuXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnNwcy5sZW5ndGg7IGkrKykge1xuICAgICAgZGF0YSA9IHRyYWNrLnNwc1tpXTtcbiAgICAgIGxlbiA9IGRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIHNwcy5wdXNoKChsZW4gPj4+IDgpICYgMHhGRik7XG4gICAgICBzcHMucHVzaCgobGVuICYgMHhGRikpO1xuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkYXRhKSk7IC8vIFNQU1xuICAgIH1cblxuICAgIC8vIGFzc2VtYmxlIHRoZSBQUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnBwcy5sZW5ndGg7IGkrKykge1xuICAgICAgZGF0YSA9IHRyYWNrLnBwc1tpXTtcbiAgICAgIGxlbiA9IGRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIHBwcy5wdXNoKChsZW4gPj4+IDgpICYgMHhGRik7XG4gICAgICBwcHMucHVzaCgobGVuICYgMHhGRikpO1xuICAgICAgcHBzID0gcHBzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkYXRhKSk7XG4gICAgfVxuXG4gICAgdmFyIGF2Y2MgPSBNUDQuYm94KE1QNC50eXBlcy5hdmNDLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAxLCAgIC8vIHZlcnNpb25cbiAgICAgICAgICAgIHNwc1szXSwgLy8gcHJvZmlsZVxuICAgICAgICAgICAgc3BzWzRdLCAvLyBwcm9maWxlIGNvbXBhdFxuICAgICAgICAgICAgc3BzWzVdLCAvLyBsZXZlbFxuICAgICAgICAgICAgMHhmYyB8IDMsIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgICAweEUwIHwgdHJhY2suc3BzLmxlbmd0aCAvLyAzYml0IHJlc2VydmVkICgxMTEpICsgbnVtT2ZTZXF1ZW5jZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgIHdpZHRoID0gdHJhY2sud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHRyYWNrLmhlaWdodDtcbiAgICAvL2NvbnNvbGUubG9nKCdhdmNjOicgKyBIZXguaGV4RHVtcChhdmNjKSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmF2YzEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgKHdpZHRoID4+IDgpICYgMHhGRixcbiAgICAgICAgd2lkdGggJiAweGZmLCAvLyB3aWR0aFxuICAgICAgICAoaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgICAgaGVpZ2h0ICYgMHhmZiwgLy8gaGVpZ2h0XG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIGhvcml6cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyB2ZXJ0cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBmcmFtZV9jb3VudFxuICAgICAgICAweDEyLFxuICAgICAgICAweDY0LCAweDYxLCAweDY5LCAweDZDLCAvL2RhaWx5bW90aW9uL2hscy5qc1xuICAgICAgICAweDc5LCAweDZELCAweDZGLCAweDc0LFxuICAgICAgICAweDY5LCAweDZGLCAweDZFLCAweDJGLFxuICAgICAgICAweDY4LCAweDZDLCAweDczLCAweDJFLFxuICAgICAgICAweDZBLCAweDczLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBjb21wcmVzc29ybmFtZVxuICAgICAgICAweDAwLCAweDE4LCAgIC8vIGRlcHRoID0gMjRcbiAgICAgICAgMHgxMSwgMHgxMV0pLCAvLyBwcmVfZGVmaW5lZCA9IC0xXG4gICAgICAgICAgYXZjYyxcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5idHJ0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAwLCAweDFjLCAweDljLCAweDgwLCAvLyBidWZmZXJTaXplREJcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzAsIC8vIG1heEJpdHJhdGVcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzBdKSkgLy8gYXZnQml0cmF0ZVxuICAgICAgICAgICk7XG4gIH1cblxuICBzdGF0aWMgZXNkcyh0cmFjaykge1xuICAgIHZhciBjb25maWdsZW4gPSB0cmFjay5jb25maWcubGVuZ3RoO1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG5cbiAgICAgIDB4MDMsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgxNytjb25maWdsZW4sIC8vIGxlbmd0aFxuICAgICAgMHgwMCwgMHgwMSwgLy9lc19pZFxuICAgICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAgIDB4MDQsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgwZitjb25maWdsZW4sIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFtjb25maWdsZW5dKS5jb25jYXQodHJhY2suY29uZmlnKS5jb25jYXQoWzB4MDYsIDB4MDEsIDB4MDJdKSk7IC8vIEdBU3BlY2lmaWNDb25maWcpKTsgLy8gbGVuZ3RoICsgYXVkaW8gY29uZmlnIGRlc2NyaXB0b3JcbiAgfVxuXG4gIHN0YXRpYyBtcDRhKHRyYWNrKSB7XG4gICAgdmFyIGF1ZGlvc2FtcGxlcmF0ZSA9IHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tcDRhLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIHRyYWNrLmNoYW5uZWxDb3VudCwgLy8gY2hhbm5lbGNvdW50XG4gICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWQyXG4gICAgICAoYXVkaW9zYW1wbGVyYXRlID4+IDgpICYgMHhGRixcbiAgICAgIGF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAweDAwLCAweDAwXSksXG4gICAgICBNUDQuYm94KE1QNC50eXBlcy5lc2RzLCBNUDQuZXNkcyh0cmFjaykpKTtcbiAgfVxuXG4gIHN0YXRpYyBzdHNkKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0Lm1wNGEodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNELCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgdmFyIGlkID0gdHJhY2suaWQsXG4gICAgICAgIGR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24qdHJhY2sudGltZXNjYWxlLFxuICAgICAgICB3aWR0aCA9IHRyYWNrLndpZHRoLFxuICAgICAgICBoZWlnaHQgPSB0cmFjay5oZWlnaHQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwNywgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAoaWQgPj4gMjQpICYgMHhGRixcbiAgICAgIChpZCA+PiAxNikgJiAweEZGLFxuICAgICAgKGlkID4+IDgpICYgMHhGRixcbiAgICAgIGlkICYgMHhGRiwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbGF5ZXJcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGFsdGVybmF0ZV9ncm91cFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgKHdpZHRoID4+IDgpICYgMHhGRixcbiAgICAgIHdpZHRoICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHdpZHRoXG4gICAgICAoaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgIGhlaWdodCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwIC8vIGhlaWdodFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpIHtcbiAgICB2YXIgc2FtcGxlRGVwZW5kZW5jeVRhYmxlID0gTVA0LnNkdHAodHJhY2spLFxuICAgICAgICBpZCA9IHRyYWNrLmlkO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFmLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGlkID4+IDI0KSxcbiAgICAgICAgICAgICAgICAgKGlkID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChpZCA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChpZCAmIDB4RkYpIC8vIHRyYWNrX0lEXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmR0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PjI0KSxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYpIC8vIGJhc2VNZWRpYURlY29kZVRpbWVcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC50cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmhkXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIHRyYWYgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gbWZoZFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDgpLCAgLy8gbWRhdCBoZWFkZXJcbiAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gICAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSBhIHRyYWNrIGRlZmluaXRpb25cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIHRyYWNrIGJveFxuICAgKi9cbiAgc3RhdGljIHRyYWsodHJhY2spIHtcbiAgICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWssIE1QNC50a2hkKHRyYWNrKSwgTVA0Lm1kaWEodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmV4KHRyYWNrKSB7XG4gICAgdmFyIGlkID0gdHJhY2suaWQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyZXgsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgKGlkID4+IDI0KSxcbiAgICAgKGlkID4+IDE2KSAmIDBYRkYsXG4gICAgIChpZCA+PiA4KSAmIDBYRkYsXG4gICAgIChpZCAmIDB4RkYpLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZGVmYXVsdF9zYW1wbGVfZGVzY3JpcHRpb25faW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX2R1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAxIC8vIGRlZmF1bHRfc2FtcGxlX2ZsYWdzXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRydW4odHJhY2ssIG9mZnNldCkge1xuICAgIHZhciBzYW1wbGVzPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgICBsZW4gPSBzYW1wbGVzLmxlbmd0aCxcbiAgICAgICAgYXJyYXlsZW4gPSAxMiArICgxNiAqIGxlbiksXG4gICAgICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlsZW4pLFxuICAgICAgICBpLHNhbXBsZSxkdXJhdGlvbixzaXplLGZsYWdzLGN0cztcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5bGVuO1xuICAgIGFycmF5LnNldChbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MGYsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAobGVuID4+PiAyNCkgJiAweEZGLFxuICAgICAgKGxlbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChsZW4gPj4+IDgpICYgMHhGRixcbiAgICAgIGxlbiAmIDB4RkYsIC8vIHNhbXBsZV9jb3VudFxuICAgICAgKG9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICBvZmZzZXQgJiAweEZGIC8vIGRhdGFfb2Zmc2V0XG4gICAgXSwwKTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgICBkdXJhdGlvbiA9IHNhbXBsZS5kdXJhdGlvbjtcbiAgICAgIHNpemUgPSBzYW1wbGUuc2l6ZTtcbiAgICAgIGZsYWdzID0gc2FtcGxlLmZsYWdzO1xuICAgICAgY3RzID0gc2FtcGxlLmN0cztcbiAgICAgIGFycmF5LnNldChbXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4+IDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgICAgKHNpemUgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzaXplID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2l6ZSA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzaXplICYgMHhGRiwgLy8gc2FtcGxlX3NpemVcbiAgICAgICAgKGZsYWdzLmlzTGVhZGluZyA8PCAyKSB8IGZsYWdzLmRlcGVuZHNPbixcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCA2KSB8XG4gICAgICAgICAgKGZsYWdzLmhhc1JlZHVuZGFuY3kgPDwgNCkgfFxuICAgICAgICAgIChmbGFncy5wYWRkaW5nVmFsdWUgPDwgMSkgfFxuICAgICAgICAgIGZsYWdzLmlzTm9uU3luYyxcbiAgICAgICAgZmxhZ3MuZGVncmFkUHJpbyAmIDB4RjAgPDwgOCxcbiAgICAgICAgZmxhZ3MuZGVncmFkUHJpbyAmIDB4MEYsIC8vIHNhbXBsZV9mbGFnc1xuICAgICAgICAoY3RzID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoY3RzID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoY3RzID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIGN0cyAmIDB4RkYgLy8gc2FtcGxlX2NvbXBvc2l0aW9uX3RpbWVfb2Zmc2V0XG4gICAgICBdLDEyKzE2KmkpO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJ1biwgYXJyYXkpO1xuICB9XG5cbiAgc3RhdGljIGluaXRTZWdtZW50KHRyYWNrcykge1xuICAgIGlmICghTVA0LnR5cGVzKSB7XG4gICAgICBNUDQuaW5pdCgpO1xuICAgIH1cbiAgICB2YXIgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLCByZXN1bHQ7XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuIiwiLyoqXG4gKiBmTVA0IHJlbXV4ZXJcbiovXG5cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBNUDQgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgTVA0UmVtdXhlciB7XG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiA9IDQ7XG4gICAgdGhpcy5QRVNfVElNRVNDQUxFID0gOTAwMDA7XG4gICAgdGhpcy5NUDRfVElNRVNDQUxFID0gdGhpcy5QRVNfVElNRVNDQUxFIC8gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gIH1cblxuICBnZXQgcGFzc3Rocm91Z2goKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIGluc2VydERpc2NvbnRpbnVpdHkoKSB7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB0aGlzLm5leHRBYWNQdHMgPSB0aGlzLm5leHRBdmNEdHMgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICByZW11eChhdWRpb1RyYWNrLHZpZGVvVHJhY2ssaWQzVHJhY2ssdGV4dFRyYWNrLHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMsIGRhdGEsIHQwKSB7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmICghdGhpcy5JU0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5nZW5lcmF0ZUlTKGF1ZGlvVHJhY2ssdmlkZW9UcmFjayx0aW1lT2Zmc2V0LCB0MCk7XG5cdH1cblx0aWYgKHRoaXMuSVNHZW5lcmF0ZWQpIHtcblx0XHQvL2xvZ2dlci5sb2coJ25iIEFWQyBzYW1wbGVzOicgKyB2aWRlb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcblx0XHRpZiAodmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuXHRcdCAgdGhpcy5yZW11eFZpZGVvKHZpZGVvVHJhY2ssdGltZU9mZnNldCxjb250aWd1b3VzLCB0MCk7XG5cdFx0fVxuXHRcdC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuXHRcdGlmIChhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG5cdFx0ICB0aGlzLnJlbXV4QXVkaW8oYXVkaW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMpO1xuXHRcdH1cblx0XHQvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcblx0XHRpZiAoaWQzVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcblx0XHQgIHRoaXMucmVtdXhJRDMoaWQzVHJhY2ssdGltZU9mZnNldCk7XG5cdFx0fVxuXHRcdC8vbG9nZ2VyLmxvZygnbmIgSUQzIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuXHRcdGlmICh0ZXh0VHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcblx0XHQgIHRoaXMucmVtdXhUZXh0KHRleHRUcmFjayx0aW1lT2Zmc2V0KTtcblx0XHR9XG5cdH1cbiAgICAvL25vdGlmeSBlbmQgb2YgcGFyc2luZ1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gIH1cblxuICBnZW5lcmF0ZUlTKGF1ZGlvVHJhY2ssdmlkZW9UcmFjayx0aW1lT2Zmc2V0LCB0MCkge1xuICAgIHZhciBvYnNlcnZlciA9IHRoaXMub2JzZXJ2ZXIsXG4gICAgICAgIGF1ZGlvU2FtcGxlcyA9IGF1ZGlvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgdmlkZW9TYW1wbGVzID0gdmlkZW9UcmFjay5zYW1wbGVzLFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHRyYWNrcyA9IHt9LFxuICAgICAgICBkYXRhID0geyB0cmFja3MgOiB0cmFja3MsIHVuaXF1ZSA6IGZhbHNlIH0sXG4gICAgICAgIGNvbXB1dGVQVFNEVFMgPSAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSxcbiAgICAgICAgaW5pdFBUUywgaW5pdERUUztcblxuICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICBpbml0UFRTID0gaW5pdERUUyA9IEluZmluaXR5O1xuICAgIH1cbiAgICBpZiAoYXVkaW9UcmFjay5jb25maWcgJiYgYXVkaW9TYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYXVkaW9UcmFjay50aW1lc2NhbGUgPSBhdWRpb1RyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgIC8vIE1QNCBkdXJhdGlvbiAodHJhY2sgZHVyYXRpb24gaW4gc2Vjb25kcyBtdWx0aXBsaWVkIGJ5IHRpbWVzY2FsZSkgaXMgY29kZWQgb24gMzIgYml0c1xuICAgICAgLy8gd2Uga25vdyB0aGF0IGVhY2ggQUFDIHNhbXBsZSBjb250YWlucyAxMDI0IGZyYW1lcy4uLi5cbiAgICAgIC8vIGluIG9yZGVyIHRvIGF2b2lkIG92ZXJmbG93aW5nIHRoZSAzMiBiaXQgY291bnRlciBmb3IgbGFyZ2UgZHVyYXRpb24sIHdlIHVzZSBzbWFsbGVyIHRpbWVzY2FsZSAodGltZXNjYWxlL2djZClcbiAgICAgIC8vIHdlIGp1c3QgbmVlZCB0byBlbnN1cmUgdGhhdCBBQUMgc2FtcGxlIGR1cmF0aW9uIHdpbGwgc3RpbGwgYmUgYW4gaW50ZWdlciAod2lsbCBiZSAxMDI0L2djZClcbiAgICAgIGlmIChhdWRpb1RyYWNrLnRpbWVzY2FsZSAqIGF1ZGlvVHJhY2suZHVyYXRpb24gPiBNYXRoLnBvdygyLCAzMikpIHtcbiAgICAgICAgbGV0IGdyZWF0ZXN0Q29tbW9uRGl2aXNvciA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIGlmICggISBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZ3JlYXRlc3RDb21tb25EaXZpc29yKGIsIGEgJSBiKTtcbiAgICAgICAgfTtcbiAgICAgICAgYXVkaW9UcmFjay50aW1lc2NhbGUgPSBhdWRpb1RyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAvIGdyZWF0ZXN0Q29tbW9uRGl2aXNvcihhdWRpb1RyYWNrLmF1ZGlvc2FtcGxlcmF0ZSwxMDI0KTtcbiAgICAgIH1cbiAgICAgIGxvZ2dlci5sb2cgKCdhdWRpbyBtcDQgdGltZXNjYWxlIDonKyBhdWRpb1RyYWNrLnRpbWVzY2FsZSk7XG4gICAgICB0cmFja3MuYXVkaW8gPSB7XG4gICAgICAgIGNvbnRhaW5lciA6ICdhdWRpby9tcDQnLFxuICAgICAgICBjb2RlYyA6ICBhdWRpb1RyYWNrLmNvZGVjLFxuICAgICAgICBpbml0U2VnbWVudCA6IE1QNC5pbml0U2VnbWVudChbYXVkaW9UcmFja10pLFxuICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICBjaGFubmVsQ291bnQgOiBhdWRpb1RyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dC4gZm9yIGF1ZGlvLCBQVFMgKyBEVFMgLi4uXG4gICAgICAgIC8vIGluaXRQVFMgPSBpbml0RFRTID0gYXVkaW9TYW1wbGVzWzBdLnB0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgIGluaXRQVFMgPSBpbml0RFRTID0gdDAgKiBwZXNUaW1lU2NhbGU7XG5cdFx0Ly8gaWYgKHRpbWVPZmZzZXQgIT0gdDApIGRlYnVnZ2VyO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh2aWRlb1RyYWNrLnNwcyAmJiB2aWRlb1RyYWNrLnBwcyAmJiB2aWRlb1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB2aWRlb1RyYWNrLnRpbWVzY2FsZSA9IHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgICAgIHRyYWNrcy52aWRlbyA9IHtcbiAgICAgICAgY29udGFpbmVyIDogJ3ZpZGVvL21wNCcsXG4gICAgICAgIGNvZGVjIDogIHZpZGVvVHJhY2suY29kZWMsXG4gICAgICAgIGluaXRTZWdtZW50IDogTVA0LmluaXRTZWdtZW50KFt2aWRlb1RyYWNrXSksXG4gICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgIHdpZHRoIDogdmlkZW9UcmFjay53aWR0aCxcbiAgICAgICAgICBoZWlnaHQgOiB2aWRlb1RyYWNrLmhlaWdodFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgICAgaW5pdFBUUyA9IE1hdGgubWluKGluaXRQVFMsdmlkZW9TYW1wbGVzWzBdLnB0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQpO1xuICAgICAgICBpbml0RFRTID0gTWF0aC5taW4oaW5pdERUUyx2aWRlb1NhbXBsZXNbMF0uZHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoIU9iamVjdC5rZXlzKHRyYWNrcykpIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdubyBhdWRpby92aWRlbyBzYW1wbGVzIGZvdW5kJ30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsZGF0YSk7XG4gICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICAgIC8vIHRoaXMuX2luaXRQVFMgPSB0MCpwZXNUaW1lU2NhbGU7Ly9pbml0UFRTO1xuICAgICAgICAvLyB0aGlzLl9pbml0RFRTID0gdDAqcGVzVGltZVNjYWxlOy8vaW5pdERUUztcblxuXHRcdCAgY29uc29sZS5pbmZvKFwiISFcIik7XG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSBpbml0UFRTO1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gaW5pdERUUztcblx0XHRjb25zb2xlLmluZm8oJ2luaXRQVFM6ICcgKyBpbml0UFRTICsgJyB0MCo5MDAwMDogJyArIHQwKjkwMDAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZW11eFZpZGVvKHRyYWNrLCB0aW1lT2Zmc2V0LCBjb250aWd1b3VzLCB0MCkge1xuICAgIHZhciBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBtcDRTYW1wbGVEdXJhdGlvbixcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLFxuICAgICAgICBsYXN0UFRTLCBsYXN0RFRTLFxuICAgICAgICBpbnB1dFNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICBvdXRwdXRTYW1wbGVzID0gW107XG5cbiAgLy8gUFRTIGlzIGNvZGVkIG9uIDMzYml0cywgYW5kIGNhbiBsb29wIGZyb20gLTJeMzIgdG8gMl4zMlxuICAvLyBQVFNOb3JtYWxpemUgd2lsbCBtYWtlIFBUUy9EVFMgdmFsdWUgbW9ub3RvbmljLCB3ZSB1c2UgbGFzdCBrbm93biBEVFMgdmFsdWUgYXMgcmVmZXJlbmNlIHZhbHVlXG4gICBsZXQgbmV4dEF2Y0R0cztcbiAgICBpZiAoY29udGlndW91cykge1xuICAgICAgLy8gaWYgcGFyc2VkIGZyYWdtZW50IGlzIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZSwgbGV0J3MgdXNlIGxhc3QgRFRTIHZhbHVlIGFzIHJlZmVyZW5jZVxuICAgICAgbmV4dEF2Y0R0cyA9IHRoaXMubmV4dEF2Y0R0cztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaWYgbm90IGNvbnRpZ3VvdXMsIGxldCdzIHVzZSB0YXJnZXQgdGltZU9mZnNldFxuICAgICAgbmV4dEF2Y0R0cyA9IHQwKnBlc1RpbWVTY2FsZTtcbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGZpcnN0IERUUyBhbmQgbGFzdCBEVFMsIG5vcm1hbGl6ZSB0aGVtIGFnYWluc3QgcmVmZXJlbmNlIHZhbHVlXG4gICAgbGV0IHNhbXBsZSA9IGlucHV0U2FtcGxlc1swXTtcbiAgICAvLyBmaXJzdERUUyA9ICBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLmR0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG4gICAgLy8gZmlyc3RQVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuXG4gICAgZmlyc3REVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuICAgIGZpcnN0UFRTID0gIE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUucHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcblxuXHR2YXIgZmlyc3RTYW1wbGVEVFMgPSBzYW1wbGUuZHRzO1xuXHRmaXJzdFBUUyA9IGZpcnN0RFRTID0gTWF0aC5yb3VuZCh0MCAqIHBlc1RpbWVTY2FsZSk7XG5cdGNvbnNvbGUuaW5mbyggJ2ZpcnN0UFRTICMxOiAnICsgZmlyc3RQVFMgKTtcblxuICAgIC8vIGNoZWNrIHRpbWVzdGFtcCBjb250aW51aXR5IGFjY3Jvc3MgY29uc2VjdXRpdmUgZnJhZ21lbnRzICh0aGlzIGlzIHRvIHJlbW92ZSBpbnRlci1mcmFnbWVudCBnYXAvaG9sZSlcbi8vICAgICBsZXQgZGVsdGEgPSBNYXRoLnJvdW5kKChmaXJzdERUUyAtIG5leHRBdmNEdHMpIC8gOTApO1xuLy9cbi8vICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4vLyAgICAgaWYgKGNvbnRpZ3VvdXMgfHwgTWF0aC5hYnMoZGVsdGEpIDwgNjAwKSB7XG4vLyAgICAgICBpZiAoZGVsdGEpIHtcbi8vICAgICAgICAgaWYgKGRlbHRhID4gMSkge1xuLy8gICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzoke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbi8vICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4vLyAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7KC1kZWx0YSl9IG1zIG92ZXJsYXBwaW5nIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkYCk7XG4vLyAgICAgICAgIH1cbi8vICAgICAgICAgLy8gcmVtb3ZlIGhvbGUvZ2FwIDogc2V0IERUUyB0byBuZXh0IGV4cGVjdGVkIERUU1xuLy8gICAgICAgICBmaXJzdERUUyA9IGlucHV0U2FtcGxlc1swXS5kdHMgPSBuZXh0QXZjRHRzO1xuLy8gICAgICAgICAvLyBvZmZzZXQgUFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IFBUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IERUU1xuLy8gICAgICAgICBmaXJzdFBUUyA9IGlucHV0U2FtcGxlc1swXS5wdHMgPSBNYXRoLm1heChmaXJzdFBUUyAtIGRlbHRhLCBuZXh0QXZjRHRzKTtcbi8vICAgICAgICAgbG9nZ2VyLmxvZyhgVmlkZW8vUFRTL0RUUyBhZGp1c3RlZDogJHtmaXJzdFBUU30vJHtmaXJzdERUU30sZGVsdGE6JHtkZWx0YX1gKTtcbi8vICAgICAgIH1cbi8vICAgICB9XG4vLyBcdGNvbnNvbGUuaW5mbyggJ2ZpcnN0UFRTICMyOiAnICsgZmlyc3RQVFMgKTtcblxuXHQvLyBzYW1wbGUgZHVyYXRpb24gKGFzIGV4cGVjdGVkIGJ5IHRydW4gTVA0IGJveGVzKSwgc2hvdWxkIGJlIHRoZSBkZWx0YSBiZXR3ZWVuIHNhbXBsZSBEVFNcbiAgICAvLyBsZXQncyBzaWduYWwgdGhlIHNhbWUgc2FtcGxlIGR1cmF0aW9uIGZvciBhbGwgc2FtcGxlc1xuICAgIC8vIHNldCB0aGlzIGNvbnN0YW50IGR1cmF0aW9uIGFzIGJlaW5nIHRoZSBhdmcgZGVsdGEgYmV0d2VlbiBjb25zZWN1dGl2ZSBEVFMuXG4gICAgc2FtcGxlID0gaW5wdXRTYW1wbGVzW2lucHV0U2FtcGxlcy5sZW5ndGgtMV07XG4gICAgbGFzdERUUyA9IE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUuZHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcblxuXHRsYXN0RFRTID0gKHNhbXBsZS5kdHMgLSBmaXJzdFNhbXBsZURUUykgKyBmaXJzdFBUUztcbiAgICBtcDRTYW1wbGVEdXJhdGlvbiA9IE1hdGgucm91bmQoKGxhc3REVFMtZmlyc3REVFMpLyhwZXMybXA0U2NhbGVGYWN0b3IqKGlucHV0U2FtcGxlcy5sZW5ndGgtMSkpKTtcblxuXHRpZiAobGFzdERUUyA8PSBmaXJzdERUUykge1xuXHRcdGRlYnVnZ2VyO1xuXHRcdGxhc3REVFMgPSBmaXJzdERUUztcblx0XHRtcDRTYW1wbGVEdXJhdGlvbiA9IDA7XG5cdFx0Y29uc29sZS53YXJuKCdsYXN0RFRTIDwgZmlyc3REVFMnKTtcblx0fTtcblx0Y29uc29sZS5pbmZvKCAnKCBsYXN0RFRTIC0gZmlyc3REVFMgKSAvIDkwMDAwIDogJyArIChsYXN0RFRTIC0gZmlyc3REVFMpLzkwMDAwKTtcblx0dmFyIG9sZFBUUyA9IGZpcnN0UFRTO1xuXHQvLyBmaXJzdFBUUyA9IGZpcnN0RFRTID0gTWF0aC5yb3VuZCh0MCo5MDAwMCk7XG5cdGNvbnNvbGUubG9nKCdmaXJzdFBUUzogJyAgKyBvbGRQVFMgKyAnIC0+ICcgKyB0MCo5MDAwMCk7XG5cdGlmICggTWF0aC5hYnMob2xkUFRTIC0gZmlyc3RQVFMpID4gMTAwMDAgKSBjb25zb2xlLndhcm4oJ3RoaXMgY291bGQgaGF2ZSBjYXVzZWQgYSBmcmFnTG9vcCBlcnJvcicpO1xuXG5cbiAgICAvLyBub3JtYWxpemUgYWxsIFBUUy9EVFMgbm93IC4uLlxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRTYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgc2FtcGxlID0gaW5wdXRTYW1wbGVzW2ldO1xuICAgICAgLy8gc2FtcGxlIERUUyBpcyBjb21wdXRlZCB1c2luZyBhIGNvbnN0YW50IGRlY29kaW5nIG9mZnNldCAobXA0U2FtcGxlRHVyYXRpb24pIGJldHdlZW4gc2FtcGxlc1xuICAgICAgc2FtcGxlLmR0cyA9IGZpcnN0RFRTICsgaSpwZXMybXA0U2NhbGVGYWN0b3IqbXA0U2FtcGxlRHVyYXRpb247XG4gICAgICAvLyB3ZSBub3JtYWxpemUgUFRTIGFnYWluc3QgbmV4dEF2Y0R0cywgd2UgYWxzbyBzdWJzdHJhY3QgaW5pdERUUyAoc29tZSBzdHJlYW1zIGRvbid0IHN0YXJ0IEAgUFRTIE8pXG4gICAgICAvLyBhbmQgd2UgZW5zdXJlIHRoYXQgY29tcHV0ZWQgdmFsdWUgaXMgZ3JlYXRlciBvciBlcXVhbCB0aGFuIHNhbXBsZSBEVFNcbiAgICAgIC8vIHNhbXBsZS5wdHMgPSBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLnB0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsIHNhbXBsZS5kdHMpO1xuXHQgIHNhbXBsZS5wdHMgPSBzYW1wbGUuZHRzO1xuICAgIH1cbiAgICBsYXN0UFRTID0gaW5wdXRTYW1wbGVzW2lucHV0U2FtcGxlcy5sZW5ndGgtMV0ucHRzO1xuXG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyAoNCAqIHRyYWNrLm5iTmFsdSkgKyA4KTtcbiAgICBsZXQgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgd2hpbGUgKGlucHV0U2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGxldCBhdmNTYW1wbGUgPSBpbnB1dFNhbXBsZXMuc2hpZnQoKSxcbiAgICAgICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuICAgICAgLy8gY29udmVydCBOQUxVIGJpdHN0cmVhbSB0byBNUDQgZm9ybWF0IChwcmVwZW5kIE5BTFUgd2l0aCBzaXplIGZpZWxkKVxuICAgICAgd2hpbGUgKGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIob2Zmc2V0LCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIG9mZnNldCArPSA0O1xuICAgICAgICBtZGF0LnNldCh1bml0LmRhdGEsIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoICs9IDQgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGF2Y1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG91dHB1dFNhbXBsZXMucHVzaCh7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgIC8vIGNvbnN0YW50IGR1cmF0aW9uXG4gICAgICAgIGR1cmF0aW9uOiBtcDRTYW1wbGVEdXJhdGlvbixcbiAgICAgICAgLy8gc2V0IGNvbXBvc2l0aW9uIHRpbWUgb2Zmc2V0IGFzIGEgbXVsdGlwbGUgb2Ygc2FtcGxlIGR1cmF0aW9uXG4gICAgICAgIGN0czogTWF0aC5tYXgoMCxtcDRTYW1wbGVEdXJhdGlvbipNYXRoLnJvdW5kKChhdmNTYW1wbGUucHRzIC0gYXZjU2FtcGxlLmR0cykvKHBlczJtcDRTY2FsZUZhY3RvciptcDRTYW1wbGVEdXJhdGlvbikpKSxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT24gOiBhdmNTYW1wbGUua2V5ID8gMiA6IDEsXG4gICAgICAgICAgaXNOb25TeW5jIDogYXZjU2FtcGxlLmtleSA/IDAgOiAxXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBuZXh0IEFWQyBzYW1wbGUgRFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBEVFMgKyBsYXN0IHNhbXBsZSBkdXJhdGlvbiAoaW4gUEVTIHRpbWVzY2FsZSlcbiAgICB0aGlzLm5leHRBdmNEdHMgPSBsYXN0RFRTICsgbXA0U2FtcGxlRHVyYXRpb24qcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgdHJhY2submJOYWx1ID0gMDtcbiAgICBpZihvdXRwdXRTYW1wbGVzLmxlbmd0aCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignY2hyb21lJykgPiAtMSkge1xuICAgICAgbGV0IGZsYWdzID0gb3V0cHV0U2FtcGxlc1swXS5mbGFncztcbiAgICAvLyBjaHJvbWUgd29ya2Fyb3VuZCwgbWFyayBmaXJzdCBzYW1wbGUgYXMgYmVpbmcgYSBSYW5kb20gQWNjZXNzIFBvaW50IHRvIGF2b2lkIHNvdXJjZWJ1ZmZlciBhcHBlbmQgaXNzdWVcbiAgICAvLyBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MjI5NDEyXG4gICAgICBmbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICB9XG4gICAgdHJhY2suc2FtcGxlcyA9IG91dHB1dFNhbXBsZXM7XG5cdC8vIGlmIChmaXJzdERUUy9wZXNUaW1lU2NhbGUgPiAxMDAwMDApIHsgZGVidWdnZXI7IH1cbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICBkYXRhMTogbW9vZixcbiAgICAgIGRhdGEyOiBtZGF0LFxuICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kUFRTOiAobGFzdFBUUyArIHBlczJtcDRTY2FsZUZhY3RvciAqIG1wNFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZERUUzogdGhpcy5uZXh0QXZjRHRzIC8gcGVzVGltZVNjYWxlLFxuICAgICAgdHlwZTogJ3ZpZGVvJyxcbiAgICAgIG5iOiBvdXRwdXRTYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgcmVtdXhBdWRpbyh0cmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgdmFyIHZpZXcsXG4gICAgICAgIG9mZnNldCA9IDgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbiA9IHRyYWNrLnRpbWVzY2FsZSAqIDEwMjQgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGUsXG4gICAgICAgIGFhY1NhbXBsZSwgbXA0U2FtcGxlLFxuICAgICAgICB1bml0LFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsIGxhc3REVFMsXG4gICAgICAgIHB0cywgZHRzLCBwdHNub3JtLCBkdHNub3JtLFxuICAgICAgICBzYW1wbGVzID0gW10sXG4gICAgICAgIHNhbXBsZXMwID0gW107XG5cbiAgICB0cmFjay5zYW1wbGVzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgcmV0dXJuIChhLnB0cy1iLnB0cyk7XG4gICAgfSk7XG4gICAgc2FtcGxlczAgPSB0cmFjay5zYW1wbGVzO1xuXG4gICAgd2hpbGUgKHNhbXBsZXMwLmxlbmd0aCkge1xuICAgICAgYWFjU2FtcGxlID0gc2FtcGxlczAuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIHB0cyA9IGFhY1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYWFjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvL2xvZ2dlci5sb2coYEF1ZGlvL1BUUzoke01hdGgucm91bmQocHRzLzkwKX1gKTtcbiAgICAgIC8vIGlmIG5vdCBmaXJzdCBzYW1wbGVcbiAgICAgIGlmIChsYXN0RFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3REVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdERUUyk7XG4gICAgICAgIC8vIGxldCdzIGNvbXB1dGUgc2FtcGxlIGR1cmF0aW9uLlxuICAgICAgICAvLyBzYW1wbGUgRHVyYXRpb24gc2hvdWxkIGJlIGNsb3NlIHRvIGV4cGVjdGVkU2FtcGxlRHVyYXRpb25cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0RFRTKSAvIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICAgICAgaWYoTWF0aC5hYnMobXA0U2FtcGxlLmR1cmF0aW9uIC0gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbikgPiBleHBlY3RlZFNhbXBsZUR1cmF0aW9uLzEwKSB7XG4gICAgICAgICAgLy8gbW9yZSB0aGFuIDEwJSBkaWZmIGJldHdlZW4gc2FtcGxlIGR1cmF0aW9uIGFuZCBleHBlY3RlZFNhbXBsZUR1cmF0aW9uIC4uLi4gbGV0cyBsb2cgdGhhdFxuICAgICAgICAgIGxvZ2dlci50cmFjZShgaW52YWxpZCBBQUMgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUyAke01hdGgucm91bmQocHRzLzkwKX0sc2hvdWxkIGJlIDEwMjQsZm91bmQgOiR7TWF0aC5yb3VuZChtcDRTYW1wbGUuZHVyYXRpb24qdHJhY2suYXVkaW9zYW1wbGVyYXRlL3RyYWNrLnRpbWVzY2FsZSl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYWx3YXlzIGFkanVzdCBzYW1wbGUgZHVyYXRpb24gdG8gYXZvaWQgYXYgc3luYyBpc3N1ZVxuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBleHBlY3RlZFNhbXBsZUR1cmF0aW9uO1xuICAgICAgICBkdHNub3JtID0gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbiAqIHBlczJtcDRTY2FsZUZhY3RvciArIGxhc3REVFM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgbmV4dEFhY1B0cywgZGVsdGE7XG4gICAgICAgIGlmIChjb250aWd1b3VzKSB7XG4gICAgICAgICAgbmV4dEFhY1B0cyA9IHRoaXMubmV4dEFhY1B0cztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXh0QWFjUHRzID0gdGltZU9mZnNldCpwZXNUaW1lU2NhbGU7XG4gICAgICAgIH1cbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbmV4dEFhY1B0cyk7XG4gICAgICAgIGRlbHRhID0gTWF0aC5yb3VuZCgxMDAwICogKHB0c25vcm0gLSBuZXh0QWFjUHRzKSAvIHBlc1RpbWVTY2FsZSk7XG4gICAgICAgIC8vIGlmIGZyYWdtZW50IGFyZSBjb250aWd1b3VzLCBvciBkZWx0YSBsZXNzIHRoYW4gNjAwbXMsIGVuc3VyZSB0aGVyZSBpcyBubyBvdmVybGFwL2hvbGUgYmV0d2VlbiBmcmFnbWVudHNcbiAgICAgICAgaWYgKGNvbnRpZ3VvdXMgfHwgTWF0aC5hYnMoZGVsdGEpIDwgNjAwKSB7XG4gICAgICAgICAgLy8gbG9nIGRlbHRhXG4gICAgICAgICAgaWYgKGRlbHRhKSB7XG4gICAgICAgICAgICBpZiAoZGVsdGEgPiAwKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYCR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBBQUMgc2FtcGxlcyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgZnJhbWUgb3ZlcmxhcCwgb3ZlcmxhcHBpbmcgZm9yIG1vcmUgdGhhbiBoYWxmIGEgZnJhbWUgZHVyYWlvblxuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xMikge1xuICAgICAgICAgICAgICAvLyBkcm9wIG92ZXJsYXBwaW5nIGF1ZGlvIGZyYW1lcy4uLiBicm93c2VyIHdpbGwgZGVhbCB3aXRoIGl0XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYCR7KC1kZWx0YSl9IG1zIG92ZXJsYXBwaW5nIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsIGRyb3AgZnJhbWVgKTtcbiAgICAgICAgICAgICAgdHJhY2subGVuIC09IHVuaXQuYnl0ZUxlbmd0aDtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBzZXQgRFRTIHRvIG5leHQgRFRTXG4gICAgICAgICAgICBwdHNub3JtID0gZHRzbm9ybSA9IG5leHRBYWNQdHM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYWFjU2FtcGxlcywgZW5zdXJlIHZhbHVlIGlzIHBvc2l0aXZlXG4gICAgICAgIGZpcnN0UFRTID0gTWF0aC5tYXgoMCwgcHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCwgZHRzbm9ybSk7XG4gICAgICAgIGlmKHRyYWNrLmxlbiA+IDApIHtcbiAgICAgICAgICAvKiBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAgICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1kYXQgdHlwZSkgKi9cbiAgICAgICAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgOCk7XG4gICAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgICAgICAgdmlldy5zZXRVaW50MzIoMCwgbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gbm8gYXVkaW8gc2FtcGxlc1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbWRhdC5zZXQodW5pdCwgb2Zmc2V0KTtcbiAgICAgIG9mZnNldCArPSB1bml0LmJ5dGVMZW5ndGg7XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YWFjU2FtcGxlLnB0c30vJHthYWNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhYWNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IHVuaXQuYnl0ZUxlbmd0aCxcbiAgICAgICAgY3RzOiAwLFxuICAgICAgICBkdXJhdGlvbjowLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRQcmlvOiAwLFxuICAgICAgICAgIGRlcGVuZHNPbjogMSxcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdERUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIHZhciBsYXN0U2FtcGxlRHVyYXRpb24gPSAwO1xuICAgIHZhciBuYlNhbXBsZXMgPSBzYW1wbGVzLmxlbmd0aDtcbiAgICAvL3NldCBsYXN0IHNhbXBsZSBkdXJhdGlvbiBhcyBiZWluZyBpZGVudGljYWwgdG8gcHJldmlvdXMgc2FtcGxlXG4gICAgaWYgKG5iU2FtcGxlcyA+PSAyKSB7XG4gICAgICBsYXN0U2FtcGxlRHVyYXRpb24gPSBzYW1wbGVzW25iU2FtcGxlcyAtIDJdLmR1cmF0aW9uO1xuICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gbGFzdFNhbXBsZUR1cmF0aW9uO1xuICAgIH1cbiAgICBpZiAobmJTYW1wbGVzKSB7XG4gICAgICAvLyBuZXh0IGFhYyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgICAgdGhpcy5uZXh0QWFjUHRzID0gcHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTL1BUU2VuZDonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApICsgJy8nICsgdGhpcy5uZXh0QWFjRHRzLnRvRml4ZWQoMCkpO1xuICAgICAgdHJhY2subGVuID0gMDtcbiAgICAgIHRyYWNrLnNhbXBsZXMgPSBzYW1wbGVzO1xuICAgICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gcGVzMm1wNFNjYWxlRmFjdG9yLCB0cmFjayk7XG4gICAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgICAgZGF0YTE6IG1vb2YsXG4gICAgICAgIGRhdGEyOiBtZGF0LFxuICAgICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIGVuZFBUUzogdGhpcy5uZXh0QWFjUHRzIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIGVuZERUUzogKGR0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb24pIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICB0eXBlOiAnYXVkaW8nLFxuICAgICAgICBuYjogbmJTYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZW11eElEMyh0cmFjayx0aW1lT2Zmc2V0KSB7XG4gICAgdmFyIGxlbmd0aCA9IHRyYWNrLnNhbXBsZXMubGVuZ3RoLCBzYW1wbGU7XG4gICAgLy8gY29uc3VtZSBzYW1wbGVzXG4gICAgaWYobGVuZ3RoKSB7XG4gICAgICBmb3IodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgc2FtcGxlID0gdHJhY2suc2FtcGxlc1tpbmRleF07XG4gICAgICAgIC8vIHNldHRpbmcgaWQzIHB0cywgZHRzIHRvIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgLy8gdXNpbmcgdGhpcy5faW5pdFBUUyBhbmQgdGhpcy5faW5pdERUUyB0byBjYWxjdWxhdGUgcmVsYXRpdmUgdGltZVxuICAgICAgICBzYW1wbGUucHRzID0gKChzYW1wbGUucHRzIC0gdGhpcy5faW5pdFBUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgICBzYW1wbGUuZHRzID0gKChzYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICBzYW1wbGVzOnRyYWNrLnNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgfVxuXG4gIHJlbXV4VGV4dCh0cmFjayx0aW1lT2Zmc2V0KSB7XG4gICAgdHJhY2suc2FtcGxlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiAoYS5wdHMtYi5wdHMpO1xuICAgIH0pO1xuXG4gICAgdmFyIGxlbmd0aCA9IHRyYWNrLnNhbXBsZXMubGVuZ3RoLCBzYW1wbGU7XG4gICAgLy8gY29uc3VtZSBzYW1wbGVzXG4gICAgaWYobGVuZ3RoKSB7XG4gICAgICBmb3IodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgc2FtcGxlID0gdHJhY2suc2FtcGxlc1tpbmRleF07XG4gICAgICAgIC8vIHNldHRpbmcgdGV4dCBwdHMsIGR0cyB0byByZWxhdGl2ZSB0aW1lXG4gICAgICAgIC8vIHVzaW5nIHRoaXMuX2luaXRQVFMgYW5kIHRoaXMuX2luaXREVFMgdG8gY2FsY3VsYXRlIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgc2FtcGxlLnB0cyA9ICgoc2FtcGxlLnB0cyAtIHRoaXMuX2luaXRQVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIHtcbiAgICAgICAgc2FtcGxlczp0cmFjay5zYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gIH1cblxuICBfUFRTTm9ybWFsaXplKHZhbHVlLCByZWZlcmVuY2UpIHtcbiAgICB2YXIgb2Zmc2V0O1xuICAgIGlmIChyZWZlcmVuY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICBpZiAocmVmZXJlbmNlIDwgdmFsdWUpIHtcbiAgICAgIC8vIC0gMl4zM1xuICAgICAgb2Zmc2V0ID0gLTg1ODk5MzQ1OTI7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vICsgMl4zM1xuICAgICAgb2Zmc2V0ID0gODU4OTkzNDU5MjtcbiAgICB9XG4gICAgLyogUFRTIGlzIDMzYml0IChmcm9tIDAgdG8gMl4zMyAtMSlcbiAgICAgIGlmIGRpZmYgYmV0d2VlbiB2YWx1ZSBhbmQgcmVmZXJlbmNlIGlzIGJpZ2dlciB0aGFuIGhhbGYgb2YgdGhlIGFtcGxpdHVkZSAoMl4zMikgdGhlbiBpdCBtZWFucyB0aGF0XG4gICAgICBQVFMgbG9vcGluZyBvY2N1cmVkLiBmaWxsIHRoZSBnYXAgKi9cbiAgICB3aGlsZSAoTWF0aC5hYnModmFsdWUgLSByZWZlcmVuY2UpID4gNDI5NDk2NzI5Nikge1xuICAgICAgICB2YWx1ZSArPSBvZmZzZXQ7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNFJlbXV4ZXI7XG4iLCIvKipcbiAqIHBhc3N0aHJvdWdoIHJlbXV4ZXJcbiovXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcblxuY2xhc3MgUGFzc1Rocm91Z2hSZW11eGVyIHtcbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgZ2V0IHBhc3N0aHJvdWdoKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIGluc2VydERpc2NvbnRpbnVpdHkoKSB7XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICByZW11eChhdWRpb1RyYWNrLHZpZGVvVHJhY2ssaWQzVHJhY2ssdGV4dFRyYWNrLHRpbWVPZmZzZXQscmF3RGF0YSkge1xuICAgIHZhciBvYnNlcnZlciA9IHRoaXMub2JzZXJ2ZXI7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmICghdGhpcy5JU0dlbmVyYXRlZCkge1xuICAgICAgdmFyIHRyYWNrcyA9IHt9LFxuICAgICAgICAgIGRhdGEgPSB7IHRyYWNrcyA6IHRyYWNrcywgdW5pcXVlIDogdHJ1ZSB9LFxuICAgICAgICAgIHRyYWNrID0gdmlkZW9UcmFjayxcbiAgICAgICAgICBjb2RlYyA9IHRyYWNrLmNvZGVjO1xuXG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgZGF0YS50cmFja3MudmlkZW8gPSB7XG4gICAgICAgICAgY29udGFpbmVyIDogdHJhY2suY29udGFpbmVyLFxuICAgICAgICAgIGNvZGVjIDogIGNvZGVjLFxuICAgICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgICAgd2lkdGggOiB0cmFjay53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodCA6IHRyYWNrLmhlaWdodFxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgdHJhY2sgPSBhdWRpb1RyYWNrO1xuICAgICAgY29kZWMgPSB0cmFjay5jb2RlYztcbiAgICAgIGlmIChjb2RlYykge1xuICAgICAgICBkYXRhLnRyYWNrcy5hdWRpbyA9IHtcbiAgICAgICAgICBjb250YWluZXIgOiB0cmFjay5jb250YWluZXIsXG4gICAgICAgICAgY29kZWMgOiAgY29kZWMsXG4gICAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgICBjaGFubmVsQ291bnQgOiB0cmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxkYXRhKTtcbiAgICB9XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgZGF0YTE6IHJhd0RhdGEsXG4gICAgICBzdGFydFBUUzogdGltZU9mZnNldCxcbiAgICAgIHN0YXJ0RFRTOiB0aW1lT2Zmc2V0LFxuICAgICAgdHlwZTogJ2F1ZGlvdmlkZW8nLFxuICAgICAgbmI6IDFcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQYXNzVGhyb3VnaFJlbXV4ZXI7XG4iLCJcbi8vIGFkYXB0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20va2Fub25naWwvbm9kZS1tM3U4cGFyc2UvYmxvYi9tYXN0ZXIvYXR0cmxpc3QuanNcbmNsYXNzIEF0dHJMaXN0IHtcblxuICBjb25zdHJ1Y3RvcihhdHRycykge1xuICAgIGlmICh0eXBlb2YgYXR0cnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICBhdHRycyA9IEF0dHJMaXN0LnBhcnNlQXR0ckxpc3QoYXR0cnMpO1xuICAgIH1cbiAgICBmb3IodmFyIGF0dHIgaW4gYXR0cnMpe1xuICAgICAgaWYoYXR0cnMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgdGhpc1thdHRyXSA9IGF0dHJzW2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGRlY2ltYWxJbnRlZ2VyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTApO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGlmKHRoaXNbYXR0ck5hbWVdKSB7XG4gICAgICBsZXQgc3RyaW5nVmFsdWUgPSAodGhpc1thdHRyTmFtZV0gfHwgJzB4Jykuc2xpY2UoMik7XG4gICAgICBzdHJpbmdWYWx1ZSA9ICgoc3RyaW5nVmFsdWUubGVuZ3RoICYgMSkgPyAnMCcgOiAnJykgKyBzdHJpbmdWYWx1ZTtcblxuICAgICAgY29uc3QgdmFsdWUgPSBuZXcgVWludDhBcnJheShzdHJpbmdWYWx1ZS5sZW5ndGggLyAyKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nVmFsdWUubGVuZ3RoIC8gMjsgaSsrKSB7XG4gICAgICAgIHZhbHVlW2ldID0gcGFyc2VJbnQoc3RyaW5nVmFsdWUuc2xpY2UoaSAqIDIsIGkgKiAyICsgMiksIDE2KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgaGV4YWRlY2ltYWxJbnRlZ2VyQXNOdW1iZXIoYXR0ck5hbWUpIHtcbiAgICBjb25zdCBpbnRWYWx1ZSA9IHBhcnNlSW50KHRoaXNbYXR0ck5hbWVdLCAxNik7XG4gICAgaWYgKGludFZhbHVlID4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHtcbiAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICB9XG4gICAgcmV0dXJuIGludFZhbHVlO1xuICB9XG5cbiAgZGVjaW1hbEZsb2F0aW5nUG9pbnQoYXR0ck5hbWUpIHtcbiAgICByZXR1cm4gcGFyc2VGbG9hdCh0aGlzW2F0dHJOYW1lXSk7XG4gIH1cblxuICBlbnVtZXJhdGVkU3RyaW5nKGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXNbYXR0ck5hbWVdO1xuICB9XG5cbiAgZGVjaW1hbFJlc29sdXRpb24oYXR0ck5hbWUpIHtcbiAgICBjb25zdCByZXMgPSAvXihcXGQrKXgoXFxkKykkLy5leGVjKHRoaXNbYXR0ck5hbWVdKTtcbiAgICBpZiAocmVzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IHBhcnNlSW50KHJlc1sxXSwgMTApLFxuICAgICAgaGVpZ2h0OiBwYXJzZUludChyZXNbMl0sIDEwKVxuICAgIH07XG4gIH1cblxuICBzdGF0aWMgcGFyc2VBdHRyTGlzdChpbnB1dCkge1xuICAgIGNvbnN0IHJlID0gL1xccyooLis/KVxccyo9KCg/OlxcXCIuKj9cXFwiKXwuKj8pKD86LHwkKS9nO1xuICAgIHZhciBtYXRjaCwgYXR0cnMgPSB7fTtcbiAgICB3aGlsZSAoKG1hdGNoID0gcmUuZXhlYyhpbnB1dCkpICE9PSBudWxsKSB7XG4gICAgICB2YXIgdmFsdWUgPSBtYXRjaFsyXSwgcXVvdGUgPSAnXCInO1xuXG4gICAgICBpZiAodmFsdWUuaW5kZXhPZihxdW90ZSkgPT09IDAgJiZcbiAgICAgICAgICB2YWx1ZS5sYXN0SW5kZXhPZihxdW90ZSkgPT09ICh2YWx1ZS5sZW5ndGgtMSkpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5zbGljZSgxLCAtMSk7XG4gICAgICB9XG4gICAgICBhdHRyc1ttYXRjaFsxXV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGF0dHJzO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXR0ckxpc3Q7XG4iLCJ2YXIgQmluYXJ5U2VhcmNoID0ge1xuICAgIC8qKlxuICAgICAqIFNlYXJjaGVzIGZvciBhbiBpdGVtIGluIGFuIGFycmF5IHdoaWNoIG1hdGNoZXMgYSBjZXJ0YWluIGNvbmRpdGlvbi5cbiAgICAgKiBUaGlzIHJlcXVpcmVzIHRoZSBjb25kaXRpb24gdG8gb25seSBtYXRjaCBvbmUgaXRlbSBpbiB0aGUgYXJyYXksXG4gICAgICogYW5kIGZvciB0aGUgYXJyYXkgdG8gYmUgb3JkZXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGxpc3QgVGhlIGFycmF5IHRvIHNlYXJjaC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb21wYXJpc29uRnVuY3Rpb25cbiAgICAgKiAgICAgIENhbGxlZCBhbmQgcHJvdmlkZWQgYSBjYW5kaWRhdGUgaXRlbSBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAgICogICAgICBTaG91bGQgcmV0dXJuOlxuICAgICAqICAgICAgICAgID4gLTEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBsb3dlciBpbmRleCB0aGFuIHRoZSBwcm92aWRlZCBpdGVtLlxuICAgICAqICAgICAgICAgID4gMSBpZiB0aGUgaXRlbSBzaG91bGQgYmUgbG9jYXRlZCBhdCBhIGhpZ2hlciBpbmRleCB0aGFuIHRoZSBwcm92aWRlZCBpdGVtLlxuICAgICAqICAgICAgICAgID4gMCBpZiB0aGUgaXRlbSBpcyB0aGUgaXRlbSB5b3UncmUgbG9va2luZyBmb3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHsqfSBUaGUgb2JqZWN0IGlmIGl0IGlzIGZvdW5kIG9yIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHNlYXJjaDogZnVuY3Rpb24obGlzdCwgY29tcGFyaXNvbkZ1bmN0aW9uKSB7XG4gICAgICAgIHZhciBtaW5JbmRleCA9IDA7XG4gICAgICAgIHZhciBtYXhJbmRleCA9IGxpc3QubGVuZ3RoIC0gMTtcbiAgICAgICAgdmFyIGN1cnJlbnRJbmRleCA9IG51bGw7XG4gICAgICAgIHZhciBjdXJyZW50RWxlbWVudCA9IG51bGw7XG4gICAgIFxuICAgICAgICB3aGlsZSAobWluSW5kZXggPD0gbWF4SW5kZXgpIHtcbiAgICAgICAgICAgIGN1cnJlbnRJbmRleCA9IChtaW5JbmRleCArIG1heEluZGV4KSAvIDIgfCAwO1xuICAgICAgICAgICAgY3VycmVudEVsZW1lbnQgPSBsaXN0W2N1cnJlbnRJbmRleF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBjb21wYXJpc29uUmVzdWx0ID0gY29tcGFyaXNvbkZ1bmN0aW9uKGN1cnJlbnRFbGVtZW50KTtcbiAgICAgICAgICAgIGlmIChjb21wYXJpc29uUmVzdWx0ID4gMCkge1xuICAgICAgICAgICAgICAgIG1pbkluZGV4ID0gY3VycmVudEluZGV4ICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7XG4gICAgICAgICAgICAgICAgbWF4SW5kZXggPSBjdXJyZW50SW5kZXggLSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRFbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgIFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJpbmFyeVNlYXJjaDtcbiIsIi8qXG4gKiBDRUEtNzA4IGludGVycHJldGVyXG4qL1xuXG5jbGFzcyBDRUE3MDhJbnRlcnByZXRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cblxuICBhdHRhY2gobWVkaWEpIHtcbiAgICB0aGlzLm1lZGlhID0gbWVkaWE7XG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gICAgdGhpcy5tZW1vcnkgPSBbXTtcbiAgfVxuXG4gIGRldGFjaCgpXG4gIHtcbiAgICB0aGlzLmNsZWFyKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgX2NyZWF0ZUN1ZSgpXG4gIHtcbiAgICB2YXIgVlRUQ3VlID0gd2luZG93LlZUVEN1ZSB8fCB3aW5kb3cuVGV4dFRyYWNrQ3VlO1xuXG4gICAgdmFyIGN1ZSA9IHRoaXMuY3VlID0gbmV3IFZUVEN1ZSgtMSwgLTEsICcnKTtcbiAgICBjdWUudGV4dCA9ICcnO1xuICAgIGN1ZS5wYXVzZU9uRXhpdCA9IGZhbHNlO1xuXG4gICAgLy8gbWFrZSBzdXJlIGl0IGRvZXNuJ3Qgc2hvdyB1cCBiZWZvcmUgaXQncyByZWFkeVxuICAgIGN1ZS5zdGFydFRpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXG4gICAgLy8gc2hvdyBpdCAnZm9yZXZlcicgb25jZSB3ZSBkbyBzaG93IGl0XG4gICAgLy8gKHdlJ2xsIHNldCB0aGUgZW5kIHRpbWUgb25jZSB3ZSBrbm93IGl0IGxhdGVyKVxuICAgIGN1ZS5lbmRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIHRoaXMubWVtb3J5LnB1c2goY3VlKTtcbiAgfVxuXG4gIGNsZWFyKClcbiAge1xuICAgIHZhciB0ZXh0VHJhY2sgPSB0aGlzLl90ZXh0VHJhY2s7XG4gICAgaWYgKHRleHRUcmFjayAmJiB0ZXh0VHJhY2suY3VlcylcbiAgICB7XG4gICAgICB3aGlsZSAodGV4dFRyYWNrLmN1ZXMubGVuZ3RoID4gMClcbiAgICAgIHtcbiAgICAgICAgdGV4dFRyYWNrLnJlbW92ZUN1ZSh0ZXh0VHJhY2suY3Vlc1swXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVzaCh0aW1lc3RhbXAsIGJ5dGVzKVxuICB7XG4gICAgaWYgKCF0aGlzLmN1ZSlcbiAgICB7XG4gICAgICB0aGlzLl9jcmVhdGVDdWUoKTtcbiAgICB9XG5cbiAgICB2YXIgY291bnQgPSBieXRlc1swXSAmIDMxO1xuICAgIHZhciBwb3NpdGlvbiA9IDI7XG4gICAgdmFyIHRtcEJ5dGUsIGNjYnl0ZTEsIGNjYnl0ZTIsIGNjVmFsaWQsIGNjVHlwZTtcblxuICAgIGZvciAodmFyIGo9MDsgajxjb3VudDsgaisrKVxuICAgIHtcbiAgICAgIHRtcEJ5dGUgPSBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjYnl0ZTEgPSAweDdGICYgYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUyID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NWYWxpZCA9ICgoNCAmIHRtcEJ5dGUpID09PSAwID8gZmFsc2UgOiB0cnVlKTtcbiAgICAgIGNjVHlwZSA9ICgzICYgdG1wQnl0ZSk7XG5cbiAgICAgIGlmIChjY2J5dGUxID09PSAwICYmIGNjYnl0ZTIgPT09IDApXG4gICAgICB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2NWYWxpZClcbiAgICAgIHtcbiAgICAgICAgaWYgKGNjVHlwZSA9PT0gMCkgLy8gfHwgY2NUeXBlID09PSAxXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBTdGFuZGFyZCBDaGFyYWN0ZXJzXG4gICAgICAgICAgaWYgKDB4MjAgJiBjY2J5dGUxIHx8IDB4NDAgJiBjY2J5dGUxKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gdGhpcy5fZnJvbUNoYXJDb2RlKGNjYnl0ZTEpICsgdGhpcy5fZnJvbUNoYXJDb2RlKGNjYnl0ZTIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTcGVjaWFsIENoYXJhY3RlcnNcbiAgICAgICAgICBlbHNlIGlmICgoY2NieXRlMSA9PT0gMHgxMSB8fCBjY2J5dGUxID09PSAweDE5KSAmJiBjY2J5dGUyID49IDB4MzAgJiYgY2NieXRlMiA8PSAweDNGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIGV4dGVuZGVkIGNoYXJzLCBlLmcuIG11c2ljYWwgbm90ZSwgYWNjZW50c1xuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDQ4OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8KuJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA0OTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCsCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTA6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwr0nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUxOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8K/JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MjpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfihKInO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUzOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8KiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NDpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICcnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU1OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8KjJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NjpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfimaonO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU3OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJyAnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU4OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OoJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1OTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjA6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6onO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYxOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OuJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MjpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDtCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjM6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw7snO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoKGNjYnl0ZTEgPT09IDB4MTEgfHwgY2NieXRlMSA9PT0gMHgxOSkgJiYgY2NieXRlMiA+PSAweDIwICYmIGNjYnl0ZTIgPD0gMHgyRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBNaWQtcm93IGNvZGVzOiBjb2xvci91bmRlcmxpbmVcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSAweDIwOlxuICAgICAgICAgICAgICAgIC8vIFdoaXRlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICAvLyBXaGl0ZSBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIyOlxuICAgICAgICAgICAgICAgIC8vIEdyZWVuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMzpcbiAgICAgICAgICAgICAgICAvLyBHcmVlbiBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI0OlxuICAgICAgICAgICAgICAgIC8vIEJsdWVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI1OlxuICAgICAgICAgICAgICAgIC8vIEJsdWUgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNjpcbiAgICAgICAgICAgICAgICAvLyBDeWFuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNzpcbiAgICAgICAgICAgICAgICAvLyBDeWFuIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjg6XG4gICAgICAgICAgICAgICAgLy8gUmVkXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICAgICAgICAvLyBSZWQgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQTpcbiAgICAgICAgICAgICAgICAvLyBZZWxsb3dcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJCOlxuICAgICAgICAgICAgICAgIC8vIFllbGxvdyBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJDOlxuICAgICAgICAgICAgICAgIC8vIE1hZ2VudGFcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJEOlxuICAgICAgICAgICAgICAgIC8vIE1hZ2VudGEgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRTpcbiAgICAgICAgICAgICAgICAvLyBJdGFsaWNzXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRjpcbiAgICAgICAgICAgICAgICAvLyBJdGFsaWNzIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoKGNjYnl0ZTEgPT09IDB4MTQgfHwgY2NieXRlMSA9PT0gMHgxQykgJiYgY2NieXRlMiA+PSAweDIwICYmIGNjYnl0ZTIgPD0gMHgyRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBNaWQtcm93IGNvZGVzOiBjb2xvci91bmRlcmxpbmVcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSAweDIwOlxuICAgICAgICAgICAgICAgIC8vIFRPRE86IHNob3VsZG4ndCBhZmZlY3Qgcm9sbC11cHMuLi5cbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICAvLyBSQ0w6IFJlc3VtZSBDYXB0aW9uIExvYWRpbmdcbiAgICAgICAgICAgICAgICAvLyBiZWdpbiBwb3Agb25cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIxOlxuICAgICAgICAgICAgICAgIC8vIEJTOiBCYWNrc3BhY2VcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ID0gdGhpcy5jdWUudGV4dC5zdWJzdHIoMCwgdGhpcy5jdWUudGV4dC5sZW5ndGgtMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBBT0Y6IHJlc2VydmVkIChmb3JtZXJseSBhbGFybSBvZmYpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMzpcbiAgICAgICAgICAgICAgICAvLyBBT046IHJlc2VydmVkIChmb3JtZXJseSBhbGFybSBvbilcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI0OlxuICAgICAgICAgICAgICAgIC8vIERFUjogRGVsZXRlIHRvIGVuZCBvZiByb3dcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI1OlxuICAgICAgICAgICAgICAgIC8vIFJVMjogcm9sbC11cCAyIHJvd3NcbiAgICAgICAgICAgICAgICAvL3RoaXMuX3JvbGx1cCgyKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI2OlxuICAgICAgICAgICAgICAgIC8vIFJVMzogcm9sbC11cCAzIHJvd3NcbiAgICAgICAgICAgICAgICAvL3RoaXMuX3JvbGx1cCgzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI3OlxuICAgICAgICAgICAgICAgIC8vIFJVNDogcm9sbC11cCA0IHJvd3NcbiAgICAgICAgICAgICAgICAvL3RoaXMuX3JvbGx1cCg0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIC8vIEZPTjogRmxhc2ggb25cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI5OlxuICAgICAgICAgICAgICAgIC8vIFJEQzogUmVzdW1lIGRpcmVjdCBjYXB0aW9uaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQTpcbiAgICAgICAgICAgICAgICAvLyBUUjogVGV4dCBSZXN0YXJ0XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQjpcbiAgICAgICAgICAgICAgICAvLyBSVEQ6IFJlc3VtZSBUZXh0IERpc3BsYXlcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJDOlxuICAgICAgICAgICAgICAgIC8vIEVETTogRXJhc2UgRGlzcGxheWVkIE1lbW9yeVxuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkQ6XG4gICAgICAgICAgICAgICAgLy8gQ1I6IENhcnJpYWdlIFJldHVyblxuICAgICAgICAgICAgICAgIC8vIG9ubHkgYWZmZWN0cyByb2xsLXVwXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRTpcbiAgICAgICAgICAgICAgICAvLyBFTk06IEVyYXNlIG5vbi1kaXNwbGF5ZWQgbWVtb3J5XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dCA9ICcnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgdGhpcy5fZmxpcE1lbW9yeSh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIC8vIEVPQzogRW5kIG9mIGNhcHRpb25cbiAgICAgICAgICAgICAgICAvLyBoaWRlIGFueSBkaXNwbGF5ZWQgY2FwdGlvbnMgYW5kIHNob3cgYW55IGhpZGRlbiBvbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDE3IHx8IGNjYnl0ZTEgPT09IDB4MUYpICYmIGNjYnl0ZTIgPj0gMHgyMSAmJiBjY2J5dGUyIDw9IDB4MjMpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMSBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIyOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAyIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDMgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gUHJvYmFibHkgYSBwcmUtYW1ibGUgYWRkcmVzcyBjb2RlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2Zyb21DaGFyQ29kZSh0bXBCeXRlKVxuICB7XG4gICAgc3dpdGNoICh0bXBCeXRlKVxuICAgIHtcbiAgICAgIGNhc2UgNDI6XG4gICAgICAgIHJldHVybiAnw6EnO1xuXG4gICAgICBjYXNlIDI6XG4gICAgICAgIHJldHVybiAnw6EnO1xuXG4gICAgICBjYXNlIDI6XG4gICAgICAgIHJldHVybiAnw6knO1xuXG4gICAgICBjYXNlIDQ6XG4gICAgICAgIHJldHVybiAnw60nO1xuXG4gICAgICBjYXNlIDU6XG4gICAgICAgIHJldHVybiAnw7MnO1xuXG4gICAgICBjYXNlIDY6XG4gICAgICAgIHJldHVybiAnw7onO1xuXG4gICAgICBjYXNlIDM6XG4gICAgICAgIHJldHVybiAnw6cnO1xuXG4gICAgICBjYXNlIDQ6XG4gICAgICAgIHJldHVybiAnw7cnO1xuXG4gICAgICBjYXNlIDU6XG4gICAgICAgIHJldHVybiAnw5EnO1xuXG4gICAgICBjYXNlIDY6XG4gICAgICAgIHJldHVybiAnw7EnO1xuXG4gICAgICBjYXNlIDc6XG4gICAgICAgIHJldHVybiAn4paIJztcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUodG1wQnl0ZSk7XG4gICAgfVxuICB9XG5cbiAgX2ZsaXBNZW1vcnkodGltZXN0YW1wKVxuICB7XG4gICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgdGhpcy5fZmx1c2hDYXB0aW9ucyh0aW1lc3RhbXApO1xuICB9XG5cbiAgX2ZsdXNoQ2FwdGlvbnModGltZXN0YW1wKVxuICB7XG4gICAgaWYgKCF0aGlzLl9oYXM3MDgpXG4gICAge1xuICAgICAgdGhpcy5fdGV4dFRyYWNrID0gdGhpcy5tZWRpYS5hZGRUZXh0VHJhY2soJ2NhcHRpb25zJywgJ0VuZ2xpc2gnLCAnZW4nKTtcbiAgICAgIHRoaXMuX2hhczcwOCA9IHRydWU7XG4gICAgfVxuXG4gICAgZm9yKGxldCBtZW1vcnlJdGVtIG9mIHRoaXMubWVtb3J5KVxuICAgIHtcbiAgICAgIG1lbW9yeUl0ZW0uc3RhcnRUaW1lID0gdGltZXN0YW1wO1xuICAgICAgdGhpcy5fdGV4dFRyYWNrLmFkZEN1ZShtZW1vcnlJdGVtKTtcbiAgICAgIHRoaXMuZGlzcGxheS5wdXNoKG1lbW9yeUl0ZW0pO1xuICAgIH1cblxuICAgIHRoaXMubWVtb3J5ID0gW107XG4gICAgdGhpcy5jdWUgPSBudWxsO1xuICB9XG5cbiAgX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApXG4gIHtcbiAgICBmb3IgKGxldCBkaXNwbGF5SXRlbSBvZiB0aGlzLmRpc3BsYXkpXG4gICAge1xuICAgICAgZGlzcGxheUl0ZW0uZW5kVGltZSA9IHRpbWVzdGFtcDtcbiAgICB9XG5cbiAgICB0aGlzLmRpc3BsYXkgPSBbXTtcbiAgfVxuXG4vKiAgX3JvbGxVcChuKVxuICB7XG4gICAgLy8gVE9ETzogaW1wbGVtZW50IHJvbGwtdXAgY2FwdGlvbnNcbiAgfVxuKi9cbiAgX2NsZWFyQnVmZmVyZWRDdWVzKClcbiAge1xuICAgIC8vcmVtb3ZlIHRoZW0gYWxsLi4uXG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBDRUE3MDhJbnRlcnByZXRlcjtcblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxuY29uc3QgZmFrZUxvZ2dlciA9IHtcbiAgdHJhY2U6IG5vb3AsXG4gIGRlYnVnOiBub29wLFxuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xuXG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG4vL2xldCBsYXN0Q2FsbFRpbWU7XG4vLyBmdW5jdGlvbiBmb3JtYXRNc2dXaXRoVGltZUluZm8odHlwZSwgbXNnKSB7XG4vLyAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4vLyAgIGNvbnN0IGRpZmYgPSBsYXN0Q2FsbFRpbWUgPyAnKycgKyAobm93IC0gbGFzdENhbGxUaW1lKSA6ICcwJztcbi8vICAgbGFzdENhbGxUaW1lID0gbm93O1xuLy8gICBtc2cgPSAobmV3IERhdGUobm93KSkudG9JU09TdHJpbmcoKSArICcgfCBbJyArICB0eXBlICsgJ10gPiAnICsgbXNnICsgJyAoICcgKyBkaWZmICsgJyBtcyApJztcbi8vICAgcmV0dXJuIG1zZztcbi8vIH1cblxuZnVuY3Rpb24gZm9ybWF0TXNnKHR5cGUsIG1zZykge1xuICBtc2cgPSAnWycgKyAgdHlwZSArICddID4gJyArIG1zZztcbiAgcmV0dXJuIG1zZztcbn1cblxuZnVuY3Rpb24gY29uc29sZVByaW50Rm4odHlwZSkge1xuICBjb25zdCBmdW5jID0gd2luZG93LmNvbnNvbGVbdHlwZV07XG4gIGlmIChmdW5jKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIGlmKGFyZ3NbMF0pIHtcbiAgICAgICAgYXJnc1swXSA9IGZvcm1hdE1zZyh0eXBlLCBhcmdzWzBdKTtcbiAgICAgIH1cbiAgICAgIGZ1bmMuYXBwbHkod2luZG93LmNvbnNvbGUsIGFyZ3MpO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIG5vb3A7XG59XG5cbmZ1bmN0aW9uIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZywgLi4uZnVuY3Rpb25zKSB7XG4gIGZ1bmN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBleHBvcnRlZExvZ2dlclt0eXBlXSA9IGRlYnVnQ29uZmlnW3R5cGVdID8gZGVidWdDb25maWdbdHlwZV0uYmluZChkZWJ1Z0NvbmZpZykgOiBjb25zb2xlUHJpbnRGbih0eXBlKTtcbiAgfSk7XG59XG5cbmV4cG9ydCB2YXIgZW5hYmxlTG9ncyA9IGZ1bmN0aW9uKGRlYnVnQ29uZmlnKSB7XG4gIGlmIChkZWJ1Z0NvbmZpZyA9PT0gdHJ1ZSB8fCB0eXBlb2YgZGVidWdDb25maWcgPT09ICdvYmplY3QnKSB7XG4gICAgZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLFxuICAgICAgLy8gUmVtb3ZlIG91dCBmcm9tIGxpc3QgaGVyZSB0byBoYXJkLWRpc2FibGUgYSBsb2ctbGV2ZWxcbiAgICAgIC8vJ3RyYWNlJyxcbiAgICAgICdkZWJ1ZycsXG4gICAgICAnbG9nJyxcbiAgICAgICdpbmZvJyxcbiAgICAgICd3YXJuJyxcbiAgICAgICdlcnJvcidcbiAgICApO1xuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgfVxufTtcblxuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiIsInZhciBVUkxIZWxwZXIgPSB7XG5cbiAgLy8gYnVpbGQgYW4gYWJzb2x1dGUgVVJMIGZyb20gYSByZWxhdGl2ZSBvbmUgdXNpbmcgdGhlIHByb3ZpZGVkIGJhc2VVUkxcbiAgLy8gaWYgcmVsYXRpdmVVUkwgaXMgYW4gYWJzb2x1dGUgVVJMIGl0IHdpbGwgYmUgcmV0dXJuZWQgYXMgaXMuXG4gIGJ1aWxkQWJzb2x1dGVVUkw6IGZ1bmN0aW9uKGJhc2VVUkwsIHJlbGF0aXZlVVJMKSB7XG4gICAgLy8gcmVtb3ZlIGFueSByZW1haW5pbmcgc3BhY2UgYW5kIENSTEZcbiAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMLnRyaW0oKTtcbiAgICBpZiAoL15bYS16XSs6L2kudGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIC8vIGNvbXBsZXRlIHVybCwgbm90IHJlbGF0aXZlXG4gICAgICByZXR1cm4gcmVsYXRpdmVVUkw7XG4gICAgfVxuXG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnkgPSBudWxsO1xuICAgIHZhciByZWxhdGl2ZVVSTEhhc2ggPSBudWxsO1xuXG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTEhhc2hTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxIYXNoID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxRdWVyeSA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxIYXNoU3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgYmFzZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMRG9tYWluU3BsaXQgPSAvXigoKFthLXpdKyk6KT9cXC9cXC9bYS16MC05XFwuXFwtX35dKyg6WzAtOV0rKT9cXC8pKC4qKSQvaS5leGVjKGJhc2VVUkwpO1xuICAgIHZhciBiYXNlVVJMUHJvdG9jb2wgPSBiYXNlVVJMRG9tYWluU3BsaXRbM107XG4gICAgdmFyIGJhc2VVUkxEb21haW4gPSBiYXNlVVJMRG9tYWluU3BsaXRbMV07XG4gICAgdmFyIGJhc2VVUkxQYXRoID0gYmFzZVVSTERvbWFpblNwbGl0WzVdO1xuXG4gICAgdmFyIGJ1aWx0VVJMID0gbnVsbDtcbiAgICBpZiAoL15cXC9cXC8vLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxQcm90b2NvbCsnOi8vJytVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoJycsIHJlbGF0aXZlVVJMLnN1YnN0cmluZygyKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKC9eXFwvLy50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgYnVpbHRVUkwgPSBiYXNlVVJMRG9tYWluK1VSTEhlbHBlci5idWlsZEFic29sdXRlUGF0aCgnJywgcmVsYXRpdmVVUkwuc3Vic3RyaW5nKDEpKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBidWlsdFVSTCA9IFVSTEhlbHBlci5idWlsZEFic29sdXRlUGF0aChiYXNlVVJMRG9tYWluK2Jhc2VVUkxQYXRoLCByZWxhdGl2ZVVSTCk7XG4gICAgfVxuXG4gICAgLy8gcHV0IHRoZSBxdWVyeSBhbmQgaGFzaCBwYXJ0cyBiYWNrXG4gICAgaWYgKHJlbGF0aXZlVVJMUXVlcnkpIHtcbiAgICAgIGJ1aWx0VVJMICs9IHJlbGF0aXZlVVJMUXVlcnk7XG4gICAgfVxuICAgIGlmIChyZWxhdGl2ZVVSTEhhc2gpIHtcbiAgICAgIGJ1aWx0VVJMICs9IHJlbGF0aXZlVVJMSGFzaDtcbiAgICB9XG4gICAgcmV0dXJuIGJ1aWx0VVJMO1xuICB9LFxuXG4gIC8vIGJ1aWxkIGFuIGFic29sdXRlIHBhdGggdXNpbmcgdGhlIHByb3ZpZGVkIGJhc2VQYXRoXG4gIC8vIGFkYXB0ZWQgZnJvbSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvZG9jdW1lbnQvY29va2llI1VzaW5nX3JlbGF0aXZlX1VSTHNfaW5fdGhlX3BhdGhfcGFyYW1ldGVyXG4gIC8vIHRoaXMgZG9lcyBub3QgaGFuZGxlIHRoZSBjYXNlIHdoZXJlIHJlbGF0aXZlUGF0aCBpcyBcIi9cIiBvciBcIi8vXCIuIFRoZXNlIGNhc2VzIHNob3VsZCBiZSBoYW5kbGVkIG91dHNpZGUgdGhpcy5cbiAgYnVpbGRBYnNvbHV0ZVBhdGg6IGZ1bmN0aW9uKGJhc2VQYXRoLCByZWxhdGl2ZVBhdGgpIHtcbiAgICB2YXIgc1JlbFBhdGggPSByZWxhdGl2ZVBhdGg7XG4gICAgdmFyIG5VcExuLCBzRGlyID0gJycsIHNQYXRoID0gYmFzZVBhdGgucmVwbGFjZSgvW15cXC9dKiQvLCBzUmVsUGF0aC5yZXBsYWNlKC8oXFwvfF4pKD86XFwuP1xcLyspKy9nLCAnJDEnKSk7XG4gICAgZm9yICh2YXIgbkVuZCwgblN0YXJ0ID0gMDsgbkVuZCA9IHNQYXRoLmluZGV4T2YoJy8uLi8nLCBuU3RhcnQpLCBuRW5kID4gLTE7IG5TdGFydCA9IG5FbmQgKyBuVXBMbikge1xuICAgICAgblVwTG4gPSAvXlxcLyg/OlxcLlxcLlxcLykqLy5leGVjKHNQYXRoLnNsaWNlKG5FbmQpKVswXS5sZW5ndGg7XG4gICAgICBzRGlyID0gKHNEaXIgKyBzUGF0aC5zdWJzdHJpbmcoblN0YXJ0LCBuRW5kKSkucmVwbGFjZShuZXcgUmVnRXhwKCcoPzpcXFxcXFwvK1teXFxcXFxcL10qKXswLCcgKyAoKG5VcExuIC0gMSkgLyAzKSArICd9JCcpLCAnLycpO1xuICAgIH1cbiAgICByZXR1cm4gc0RpciArIHNQYXRoLnN1YnN0cihuU3RhcnQpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVSTEhlbHBlcjtcbiIsIi8qKlxuICogWEhSIGJhc2VkIGxvZ2dlclxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIFhockxvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgaWYgKGNvbmZpZyAmJiBjb25maWcueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAgPSBjb25maWcueGhyU2V0dXA7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmFib3J0KCk7XG4gICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICB9XG5cbiAgYWJvcnQoKSB7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMubG9hZGVyLFxuICAgICAgICB0aW1lb3V0SGFuZGxlID0gdGhpcy50aW1lb3V0SGFuZGxlO1xuICAgIGlmIChsb2FkZXIgJiYgbG9hZGVyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMuc3RhdHMuYWJvcnRlZCA9IHRydWU7XG4gICAgICBsb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgaWYgKHRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dEhhbmRsZSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZCh1cmwsIHJlc3BvbnNlVHlwZSwgb25TdWNjZXNzLCBvbkVycm9yLCBvblRpbWVvdXQsIHRpbWVvdXQsIG1heFJldHJ5LCByZXRyeURlbGF5LCBvblByb2dyZXNzID0gbnVsbCwgZnJhZyA9IG51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICBpZiAoZnJhZyAmJiAhaXNOYU4oZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCkgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0KSkge1xuICAgICAgICB0aGlzLmJ5dGVSYW5nZSA9IGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgKyAnLScgKyAoZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQtMSk7XG4gICAgfVxuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25Qcm9ncmVzcyA9IG9uUHJvZ3Jlc3M7XG4gICAgdGhpcy5vblRpbWVvdXQgPSBvblRpbWVvdXQ7XG4gICAgdGhpcy5vbkVycm9yID0gb25FcnJvcjtcbiAgICB0aGlzLnN0YXRzID0ge3RyZXF1ZXN0OiBwZXJmb3JtYW5jZS5ub3coKSwgcmV0cnk6IDB9O1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcbiAgfVxuXG4gIGxvYWRJbnRlcm5hbCgpIHtcbiAgICB2YXIgeGhyO1xuXG4gICAgaWYgKHR5cGVvZiBYRG9tYWluUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYRG9tYWluUmVxdWVzdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB9XG5cbiAgICB4aHIub25sb2FkZW5kID0gdGhpcy5sb2FkZW5kLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuXG4gICAgeGhyLm9wZW4oJ0dFVCcsIHRoaXMudXJsLCB0cnVlKTtcbiAgICBpZiAodGhpcy5ieXRlUmFuZ2UpIHtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdSYW5nZScsICdieXRlcz0nICsgdGhpcy5ieXRlUmFuZ2UpO1xuICAgIH1cbiAgICB4aHIucmVzcG9uc2VUeXBlID0gdGhpcy5yZXNwb25zZVR5cGU7XG4gICAgdGhpcy5zdGF0cy50Zmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc3RhdHMubG9hZGVkID0gMDtcbiAgICBpZiAodGhpcy54aHJTZXR1cCkge1xuICAgICAgdGhpcy54aHJTZXR1cCh4aHIsIHRoaXMudXJsKTtcbiAgICB9XG4gICAgdGhpcy50aW1lb3V0SGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aGlzLnRpbWVvdXQpO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBsb2FkZW5kKGV2ZW50KSB7XG4gICAgdmFyIHhociA9IGV2ZW50LmN1cnJlbnRUYXJnZXQsXG4gICAgICAgIHN0YXR1cyA9IHhoci5zdGF0dXMsXG4gICAgICAgIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICAvLyBkb24ndCBwcm9jZWVkIGlmIHhociBoYXMgYmVlbiBhYm9ydGVkXG4gICAgaWYgKCFzdGF0cy5hYm9ydGVkKSB7XG4gICAgICAgIC8vIGh0dHAgc3RhdHVzIGJldHdlZW4gMjAwIHRvIDI5OSBhcmUgYWxsIHN1Y2Nlc3NmdWxcbiAgICAgICAgaWYgKHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwKSAge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBzdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIHRoaXMub25TdWNjZXNzKGV2ZW50LCBzdGF0cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBlcnJvciAuLi5cbiAgICAgICAgaWYgKHN0YXRzLnJldHJ5IDwgdGhpcy5tYXhSZXRyeSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGAke3N0YXR1c30gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfSwgcmV0cnlpbmcgaW4gJHt0aGlzLnJldHJ5RGVsYXl9Li4uYCk7XG4gICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkSW50ZXJuYWwuYmluZCh0aGlzKSwgdGhpcy5yZXRyeURlbGF5KTtcbiAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICAgICAgdGhpcy5yZXRyeURlbGF5ID0gTWF0aC5taW4oMiAqIHRoaXMucmV0cnlEZWxheSwgNjQwMDApO1xuICAgICAgICAgIHN0YXRzLnJldHJ5Kys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgICAgICAgdGhpcy5vbkVycm9yKGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxvYWR0aW1lb3V0KGV2ZW50KSB7XG4gICAgbG9nZ2VyLndhcm4oYHRpbWVvdXQgd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICB0aGlzLm9uVGltZW91dChldmVudCwgdGhpcy5zdGF0cyk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgIGlmIChzdGF0cy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHN0YXRzLnRmaXJzdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cbiAgICBzdGF0cy5sb2FkZWQgPSBldmVudC5sb2FkZWQ7XG4gICAgaWYgKHRoaXMub25Qcm9ncmVzcykge1xuICAgICAgdGhpcy5vblByb2dyZXNzKGV2ZW50LCBzdGF0cyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFhockxvYWRlcjtcbiJdfQ==
