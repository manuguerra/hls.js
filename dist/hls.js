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

            _logger.logger.info(segment);
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
              var k;
              var end_pos;

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

                  // adjust quick load seek position if it is close to the end of fragment
                  k = config.quickLoadSeekThreshold;
                  end_pos = (1 - k) * frag.duration + frag.start;

                  if (!_this2.initial_seek) {
                    _this2.initial_seek = bufferEnd > end_pos ? end_pos : bufferEnd;
                  }

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
                _logger.logger.info('Loading key for ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level);
                this.state = State.KEY_LOADING;
                hls.trigger(_events2.default.KEY_LOADING, { frag: frag });
              } else {
                _logger.logger.info('Loading ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
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
          _logger.logger.info('seeking outside of buffer while fragment load in progress, cancel fragment load');
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

        _logger.logger.info('parsed ' + data.type + ',PTS:[' + data.startPTS.toFixed(3) + ',' + data.endPTS.toFixed(3) + '],DTS:[' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '],nb:' + data.nb);

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
          _logger.logger.info('media buffered : ' + this.timeRangesToString(this.media.buffered));
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

            // adjust quick load seek position if necessary
            if (this.initial_seek) {
              _logger.logger.info('adjusting initial seek: before/after: ' + targetSeekPosition + ' / ' + this.initial_seek);
              targetSeekPosition = this.initial_seek;
            }

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
        self.demuxer.push(new Uint8Array(data.data), data.audioCodec, data.videoCodec, data.timeOffset, data.cc, data.level, data.sn, data.duration, data.t0);
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
      _logger.logger.info('pushDecrypted t0: ' + t0);
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn: sn, duration: duration, t0: t0 }, [data]);
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
      _logger.logger.info('tsdemuxer t0: ' + t0);
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

      var firstFrame = true;
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
                  var isFrameOkForChromeOSX = this._parseAVCPES(this._parsePES(avcData), firstFrame);
                  if (isFrameOkForChromeOSX) {
                    firstFrame = false;
                  }
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
      _logger.logger.info('tsdemuxer passing t0 to remux: ' + t0);
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
    value: function _parseAVCPES(pes, firstFrame) {
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

      var types = '';
      var shouldExit = false;

      var SEICounter = 0;

      units.forEach(function (unit) {
        if (shouldExit) return;
        types += ' ' + unit.type;
        switch (unit.type) {
          //NDR
          case 1:
            if (firstFrame && navigator.appVersion.indexOf("Mac") > -1 && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {

              console.warn('first frame with ' + unit.type + '; skipping to prevent chrome hardware decoder issue on osx');
              push = false;
              shouldExit = true;
              return false;
              break;
            }
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
            SEICounter++;
            if (firstFrame && navigator.appVersion.indexOf("Mac") > -1 && navigator.userAgent.toLowerCase().indexOf('chrome') > -1 && SEICounter > 1) {
              console.warn('first frame with ' + unit.type + '; skipping to prevent chrome hardware decoder issue on osx');
              push = false;
              shouldExit = true;
              return false;
              break;
            }
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

      if (firstFrame) {
        types = '** ' + types;
        console.info(types + '');
      }

      if (shouldExit) {
        console.warn('skipping frame');
        return false;
      }

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
      return true;
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
        // var oldEndPTS = endPTS;
        endPTS = startPTS + frag.duration;
        // console.info('adjusting endPTS: ' + oldEndPTS + ' -> ' + endPTS);
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
          }
        } else {
          fragTo.duration = fragFrom.start - fragToPTS;
          if (fragTo.duration < 0) {
            _logger.logger.error('negative duration computed for frag ' + fragTo.sn + ',level ' + fragTo.level + ', there should be some duration drift between playlist and fragment!');
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
          enableMP2TPassThrough: false,
          quickLoadSeekThreshold: 1 / 3
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
          endPTS = f.endPTS;
        }
        level.totalduration = endPTS ? endPTS : level.totalduration + this.totalDuration;
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

          this._initPTS = initPTS;
          this._initDTS = initDTS;
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
      _logger.logger.info('firstPTS #1: ' + firstPTS);

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
        lastDTS = firstDTS;
        mp4SampleDuration = 0;
        console.warn('lastDTS < firstDTS');
      }
      _logger.logger.info('( lastDTS - firstDTS ) / 90000 : ' + (lastDTS - firstDTS) / 90000);
      var oldPTS = firstPTS;
      // firstPTS = firstDTS = Math.round(t0*90000);
      _logger.logger.info('firstPTS: ' + oldPTS + ' -> ' + t0 * 90000);
      if (Math.abs(oldPTS - firstPTS) > 10000) {
        console.warn('this could have caused a fragLoop error');
      }

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
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
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
          if (Math.abs(mp4Sample.duration - expectedSampleDuration) > expectedSampleDuration / 10) {}
          // more than 10% diff between sample duration and expectedSampleDuration .... lets log that
          // logger.trace(`invalid AAC sample duration at PTS ${Math.round(pts/90)},should be 1024,found :${Math.round(mp4Sample.duration*track.audiosamplerate/track.timescale)}`);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwic3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCJzcmMvY29udHJvbGxlci9idWZmZXItY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL2NhcC1sZXZlbC1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlci5qcyIsInNyYy9jcnlwdC9hZXMuanMiLCJzcmMvY3J5cHQvYWVzMTI4LWRlY3J5cHRlci5qcyIsInNyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCJzcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsInNyYy9kZW11eC9hZHRzLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXIuanMiLCJzcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsInNyYy9kZW11eC9pZDMuanMiLCJzcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9ldmVudC1oYW5kbGVyLmpzIiwic3JjL2V2ZW50cy5qcyIsInNyYy9oZWxwZXIvYnVmZmVyLWhlbHBlci5qcyIsInNyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwic3JjL2hscy5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwic3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwic3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCJzcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsInNyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsInNyYy9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyLmpzIiwic3JjL3V0aWxzL2F0dHItbGlzdC5qcyIsInNyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwic3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCJzcmMvdXRpbHMvbG9nZ2VyLmpzIiwic3JjL3V0aWxzL3VybC5qcyIsInNyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtB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LENBQWhEOztBQUgrQixnQkFLL0IsQ0FBSyxVQUFMLEdBQWtCLEtBQUssR0FBTCxDQUFTLElBQUksS0FBSyxVQUFMLEVBQWlCLEtBQTlCLENBQWxCLENBTCtCO0FBTS9CLGtCQUFNLEtBQU4sR0FOK0I7V0FBakMsTUFPTztBQUNMLG1CQUFPLFlBQVAsQ0FBb0IsS0FBSyxhQUFMLENBQXBCLENBREs7QUFFTCwyQkFBTyxLQUFQLENBQWdCLDZCQUF3QixLQUFLLEdBQUwsQ0FBeEMsQ0FGSztBQUdMLGlCQUFLLE9BQUwsQ0FBYSxLQUFiLEVBSEs7V0FQUDtTQU5BO09BRko7Ozs7Z0NBd0JVLE9BQU87QUFDakIscUJBQU8sSUFBUCw0QkFBcUMsS0FBSyxHQUFMLENBQXJDLENBRGlCO0FBRWpCLFdBQUssU0FBTCxDQUFlLEtBQWYsRUFBc0IsS0FBSyxLQUFMLENBQXRCLENBRmlCOzs7O2lDQUtOLE9BQU87QUFDbEIsVUFBSSxRQUFRLEtBQUssS0FBTCxDQURNO0FBRWxCLFVBQUksTUFBTSxNQUFOLEtBQWlCLElBQWpCLEVBQXVCO0FBQ3pCLGNBQU0sTUFBTixHQUFlLFlBQVksR0FBWixFQUFmLENBRHlCO09BQTNCO0FBR0EsWUFBTSxNQUFOLEdBQWUsTUFBTSxNQUFOLENBTEc7QUFNbEIsVUFBSSxLQUFLLFVBQUwsRUFBaUI7QUFDbkIsYUFBSyxVQUFMLENBQWdCLEtBQWhCLEVBQXVCLEtBQXZCLEVBRG1CO09BQXJCOzs7O1NBNUdFOzs7a0JBa0hTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIHZhciBleHAgPSBjYWNoZVtrZXldLmV4cG9ydHM7XG4gICAgICAgIC8vIFVzaW5nIGJhYmVsIGFzIGEgdHJhbnNwaWxlciB0byB1c2UgZXNtb2R1bGUsIHRoZSBleHBvcnQgd2lsbCBhbHdheXNcbiAgICAgICAgLy8gYmUgYW4gb2JqZWN0IHdpdGggdGhlIGRlZmF1bHQgZXhwb3J0IGFzIGEgcHJvcGVydHkgb2YgaXQuIFRvIGVuc3VyZVxuICAgICAgICAvLyB0aGUgZXhpc3RpbmcgYXBpIGFuZCBiYWJlbCBlc21vZHVsZSBleHBvcnRzIGFyZSBib3RoIHN1cHBvcnRlZCB3ZVxuICAgICAgICAvLyBjaGVjayBmb3IgYm90aFxuICAgICAgICBpZiAoZXhwID09PSBmbiB8fCBleHAuZGVmYXVsdCA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG5cbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sIChcbiAgICAgICAgICAgIC8vIHRyeSB0byBjYWxsIGRlZmF1bHQgaWYgZGVmaW5lZCB0byBhbHNvIHN1cHBvcnQgYmFiZWwgZXNtb2R1bGVcbiAgICAgICAgICAgIC8vIGV4cG9ydHNcbiAgICAgICAgICAgICd2YXIgZiA9IHJlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpOycgK1xuICAgICAgICAgICAgJyhmLmRlZmF1bHQgPyBmLmRlZmF1bHQgOiBmKShzZWxmKTsnXG4gICAgICAgICkpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG5cbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogc2ltcGxlIEFCUiBDb250cm9sbGVyXG4gKiAgLSBjb21wdXRlIG5leHQgbGV2ZWwgYmFzZWQgb24gbGFzdCBmcmFnbWVudCBidyBoZXVyaXN0aWNzXG4gKiAgLSBpbXBsZW1lbnQgYW4gYWJhbmRvbiBydWxlcyB0cmlnZ2VyZWQgaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGJ1ZmZlcmVkIGFuZCBpZiBjb21wdXRlZCBidyBzaG93cyB0aGF0IHdlIHJpc2sgYnVmZmVyIHN0YWxsaW5nXG4gKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IEJ1ZmZlckhlbHBlciBmcm9tICcuLi9oZWxwZXIvYnVmZmVyLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBBYnJDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgICAgICAgICAgRXZlbnQuRVJST1IpO1xuICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSAwO1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbkNoZWNrID0gdGhpcy5hYmFuZG9uUnVsZXNDaGVjay5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9uQ2hlY2ssIDEwMCk7XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IGRhdGEuZnJhZztcbiAgfVxuXG4gIG9uRnJhZ0xvYWRQcm9ncmVzcyhkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAvLyBvbmx5IHVwZGF0ZSBzdGF0cyBpZiBmaXJzdCBmcmFnIGxvYWRpbmdcbiAgICAvLyBpZiBzYW1lIGZyYWcgaXMgbG9hZGVkIG11bHRpcGxlIHRpbWVzLCBpdCBtaWdodCBiZSBpbiBicm93c2VyIGNhY2hlLCBhbmQgbG9hZGVkIHF1aWNrbHlcbiAgICAvLyBhbmQgbGVhZGluZyB0byB3cm9uZyBidyBlc3RpbWF0aW9uXG4gICAgaWYgKHN0YXRzLmFib3J0ZWQgPT09IHVuZGVmaW5lZCAmJiBkYXRhLmZyYWcubG9hZENvdW50ZXIgPT09IDEpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAocGVyZm9ybWFuY2Uubm93KCkgLSBzdGF0cy50cmVxdWVzdCkgLyAxMDAwO1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgIHRoaXMubGFzdGJ3ID0gKHN0YXRzLmxvYWRlZCAqIDgpIC8gdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbjtcbiAgICAgIC8vY29uc29sZS5sb2coYGZldGNoRHVyYXRpb246JHt0aGlzLmxhc3RmZXRjaGR1cmF0aW9ufSxidzokeyh0aGlzLmxhc3Ridy8xMDAwKS50b0ZpeGVkKDApfS8ke3N0YXRzLmFib3J0ZWR9YCk7XG4gICAgfVxuICB9XG5cbiAgYWJhbmRvblJ1bGVzQ2hlY2soKSB7XG4gICAgLypcbiAgICAgIG1vbml0b3IgZnJhZ21lbnQgcmV0cmlldmFsIHRpbWUuLi5cbiAgICAgIHdlIGNvbXB1dGUgZXhwZWN0ZWQgdGltZSBvZiBhcnJpdmFsIG9mIHRoZSBjb21wbGV0ZSBmcmFnbWVudC5cbiAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICovXG4gICAgbGV0IGhscyA9IHRoaXMuaGxzLCB2ID0gaGxzLm1lZGlhLGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIC8qIG9ubHkgbW9uaXRvciBmcmFnIHJldHJpZXZhbCB0aW1lIGlmXG4gICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKHJlYWR5IHN0YXRlID09PSBIQVZFX05PVEhJTkcgPSAwKSkgQU5EIGF1dG9zd2l0Y2hpbmcgZW5hYmxlZCBBTkQgbm90IGxvd2VzdCBsZXZlbCAoPT4gbWVhbnMgdGhhdCB3ZSBoYXZlIHNldmVyYWwgbGV2ZWxzKSAqL1xuICAgIGlmICh2ICYmICghdi5wYXVzZWQgfHwgIXYucmVhZHlTdGF0ZSkgJiYgZnJhZy5hdXRvTGV2ZWwgJiYgZnJhZy5sZXZlbCkge1xuICAgICAgbGV0IHJlcXVlc3REZWxheSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gZnJhZy50cmVxdWVzdDtcbiAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICBpZiAocmVxdWVzdERlbGF5ID4gKDUwMCAqIGZyYWcuZHVyYXRpb24pKSB7XG4gICAgICAgIGxldCBsb2FkUmF0ZSA9IE1hdGgubWF4KDEsZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5KTsgLy8gYnl0ZS9zOyBhdCBsZWFzdCAxIGJ5dGUvcyB0byBhdm9pZCBkaXZpc2lvbiBieSB6ZXJvXG4gICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gZnJhZy5sb2FkZWQ7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHBvcyA9IHYuY3VycmVudFRpbWU7XG4gICAgICAgIGxldCBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICBsZXQgYnVmZmVyU3RhcnZhdGlvbkRlbGF5ID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odixwb3MsaGxzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5lbmQgLSBwb3M7XG4gICAgICAgIC8vIGNvbnNpZGVyIGVtZXJnZW5jeSBzd2l0Y2ggZG93biBvbmx5IGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBidWZmZXJlZCBBTkRcbiAgICAgICAgLy8gdGltZSB0byBmaW5pc2ggbG9hZGluZyBjdXJyZW50IGZyYWdtZW50IGlzIGJpZ2dlciB0aGFuIGJ1ZmZlciBzdGFydmF0aW9uIGRlbGF5XG4gICAgICAgIC8vIGllIGlmIHdlIHJpc2sgYnVmZmVyIHN0YXJ2YXRpb24gaWYgYncgZG9lcyBub3QgaW5jcmVhc2UgcXVpY2tseVxuICAgICAgICBpZiAoYnVmZmVyU3RhcnZhdGlvbkRlbGF5IDwgMipmcmFnLmR1cmF0aW9uICYmIGZyYWdMb2FkZWREZWxheSA+IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSkge1xuICAgICAgICAgIGxldCBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXksIG5leHRMb2FkTGV2ZWw7XG4gICAgICAgICAgLy8gbGV0cyBpdGVyYXRlIHRocm91Z2ggbG93ZXIgbGV2ZWwgYW5kIHRyeSB0byBmaW5kIHRoZSBiaWdnZXN0IG9uZSB0aGF0IGNvdWxkIGF2b2lkIHJlYnVmZmVyaW5nXG4gICAgICAgICAgLy8gd2Ugc3RhcnQgZnJvbSBjdXJyZW50IGxldmVsIC0gMSBhbmQgd2Ugc3RlcCBkb3duICwgdW50aWwgd2UgZmluZCBhIG1hdGNoaW5nIGxldmVsXG4gICAgICAgICAgZm9yIChuZXh0TG9hZExldmVsID0gZnJhZy5sZXZlbCAtIDEgOyBuZXh0TG9hZExldmVsID49MCA7IG5leHRMb2FkTGV2ZWwtLSkge1xuICAgICAgICAgICAgLy8gY29tcHV0ZSB0aW1lIHRvIGxvYWQgbmV4dCBmcmFnbWVudCBhdCBsb3dlciBsZXZlbFxuICAgICAgICAgICAgLy8gMC44IDogY29uc2lkZXIgb25seSA4MCUgb2YgY3VycmVudCBidyB0byBiZSBjb25zZXJ2YXRpdmVcbiAgICAgICAgICAgIC8vIDggPSBiaXRzIHBlciBieXRlIChicHMvQnBzKVxuICAgICAgICAgICAgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5ID0gZnJhZy5kdXJhdGlvbiAqIGhscy5sZXZlbHNbbmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogMC44ICogbG9hZFJhdGUpO1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZnJhZ0xvYWRlZERlbGF5L2J1ZmZlclN0YXJ2YXRpb25EZWxheS9mcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXlbJHtuZXh0TG9hZExldmVsfV0gOiR7ZnJhZ0xvYWRlZERlbGF5LnRvRml4ZWQoMSl9LyR7YnVmZmVyU3RhcnZhdGlvbkRlbGF5LnRvRml4ZWQoMSl9LyR7ZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5LnRvRml4ZWQoMSl9YCk7XG4gICAgICAgICAgICBpZiAoZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5IDwgYnVmZmVyU3RhcnZhdGlvbkRlbGF5KSB7XG4gICAgICAgICAgICAgIC8vIHdlIGZvdW5kIGEgbG93ZXIgbGV2ZWwgdGhhdCBiZSByZWJ1ZmZlcmluZyBmcmVlIHdpdGggY3VycmVudCBlc3RpbWF0ZWQgYncgIVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gb25seSBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gaWYgaXQgdGFrZXMgbGVzcyB0aW1lIHRvIGxvYWQgbmV3IGZyYWdtZW50IGF0IGxvd2VzdCBsZXZlbCBpbnN0ZWFkXG4gICAgICAgICAgLy8gb2YgZmluaXNoaW5nIGxvYWRpbmcgY3VycmVudCBvbmUgLi4uXG4gICAgICAgICAgaWYgKGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA8IGZyYWdMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgLy8gZW5zdXJlIG5leHRMb2FkTGV2ZWwgaXMgbm90IG5lZ2F0aXZlXG4gICAgICAgICAgICBuZXh0TG9hZExldmVsID0gTWF0aC5tYXgoMCxuZXh0TG9hZExldmVsKTtcbiAgICAgICAgICAgIC8vIGZvcmNlIG5leHQgbG9hZCBsZXZlbCBpbiBhdXRvIG1vZGVcbiAgICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbmV4dExvYWRMZXZlbDtcbiAgICAgICAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgLi4uXG4gICAgICAgICAgICBsb2dnZXIud2FybihgbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZyBhbmQgc3dpdGNoIHRvIGxldmVsICR7bmV4dExvYWRMZXZlbH1gKTtcbiAgICAgICAgICAgIC8vYWJvcnQgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZCgpIHtcbiAgICAvLyBzdG9wIG1vbml0b3JpbmcgYncgb25jZSBmcmFnIGxvYWRlZFxuICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgLy8gc3RvcCB0aW1lciBpbiBjYXNlIG9mIGZyYWcgbG9hZGluZyBlcnJvclxuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuIGNsZWFyVGltZXIoKSB7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LCBobHMgPSB0aGlzLmhscyxhZGp1c3RlZGJ3LCBpLCBtYXhBdXRvTGV2ZWw7XG4gICAgaWYgKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSBobHMubGV2ZWxzLmxlbmd0aCAtIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25leHRBdXRvTGV2ZWwgIT09IC0xKSB7XG4gICAgICB2YXIgbmV4dExldmVsID0gTWF0aC5taW4odGhpcy5fbmV4dEF1dG9MZXZlbCxtYXhBdXRvTGV2ZWwpO1xuICAgICAgaWYgKG5leHRMZXZlbCA9PT0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV4dExldmVsO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IgKGkgPSAwOyBpIDw9IG1heEF1dG9MZXZlbDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZiAoaSA8PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjggKiBsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43ICogbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYgKGFkanVzdGVkYncgPCBobHMubGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIGkgLSAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGkgLSAxO1xuICB9XG5cbiAgc2V0IG5leHRBdXRvTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBYnJDb250cm9sbGVyO1xuXG4iLCIvKlxuICogQnVmZmVyIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cblxuY2xhc3MgQnVmZmVyQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgRXZlbnQuQlVGRkVSX1JFU0VULFxuICAgICAgRXZlbnQuQlVGRkVSX0FQUEVORElORyxcbiAgICAgIEV2ZW50LkJVRkZFUl9DT0RFQ1MsXG4gICAgICBFdmVudC5CVUZGRVJfRU9TLFxuICAgICAgRXZlbnQuQlVGRkVSX0ZMVVNISU5HKTtcblxuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU0JVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25TQlVwZGF0ZUVycm9yLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2UgPSBuZXcgTWVkaWFTb3VyY2UoKTtcbiAgICAvL01lZGlhIFNvdXJjZSBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbk1lZGlhU291cmNlT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTWVkaWFTb3VyY2VFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2MgPSB0aGlzLm9uTWVkaWFTb3VyY2VDbG9zZS5iaW5kKHRoaXMpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgbWVkaWEuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYgKG1zKSB7XG4gICAgICBpZiAobXMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gZW5kT2ZTdHJlYW0gY291bGQgdHJpZ2dlciBleGNlcHRpb24gaWYgYW55IHNvdXJjZWJ1ZmZlciBpcyBpbiB1cGRhdGluZyBzdGF0ZVxuICAgICAgICAgIC8vIHdlIGRvbid0IHJlYWxseSBjYXJlIGFib3V0IGNoZWNraW5nIHNvdXJjZWJ1ZmZlciBzdGF0ZSBoZXJlLFxuICAgICAgICAgIC8vIGFzIHdlIGFyZSBhbnl3YXkgZGV0YWNoaW5nIHRoZSBNZWRpYVNvdXJjZVxuICAgICAgICAgIC8vIGxldCdzIGp1c3QgYXZvaWQgdGhpcyBleGNlcHRpb24gdG8gcHJvcGFnYXRlXG4gICAgICAgICAgbXMuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIud2Fybihgb25NZWRpYURldGFjaGluZzoke2Vyci5tZXNzYWdlfSB3aGlsZSBjYWxsaW5nIGVuZE9mU3RyZWFtYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB0aGlzLm1lZGlhLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYS5yZW1vdmVBdHRyaWJ1dGUoJ3NyYycpO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IG51bGw7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hFRCk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hFRCwgeyBtZWRpYSA6IHRoaXMubWVkaWEgfSk7XG4gICAgLy8gb25jZSByZWNlaXZlZCwgZG9uJ3QgbGlzdGVuIGFueW1vcmUgdG8gc291cmNlb3BlbiBldmVudFxuICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIC8vIGlmIGFueSBidWZmZXIgY29kZWNzIHBlbmRpbmcsIHRyZWF0IGl0IGhlcmUuXG4gICAgdmFyIHBlbmRpbmdUcmFja3MgPSB0aGlzLnBlbmRpbmdUcmFja3M7XG4gICAgaWYgKHBlbmRpbmdUcmFja3MpIHtcbiAgICAgIHRoaXMub25CdWZmZXJDb2RlY3MocGVuZGluZ1RyYWNrcyk7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSBudWxsO1xuICAgICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cblxuXG4gIG9uU0JVcGRhdGVFbmQoKSB7XG5cbiAgICBpZiAodGhpcy5fbmVlZHNGbHVzaCkge1xuICAgICAgdGhpcy5kb0ZsdXNoKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25lZWRzRW9zKSB7XG4gICAgICB0aGlzLm9uQnVmZmVyRW9zKCk7XG4gICAgfVxuXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ERUQpO1xuXG4gICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICB9XG5cbiAgb25TQlVwZGF0ZUVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICAvLyBhY2NvcmRpbmcgdG8gaHR0cDovL3d3dy53My5vcmcvVFIvbWVkaWEtc291cmNlLyNzb3VyY2VidWZmZXItYXBwZW5kLWVycm9yXG4gICAgLy8gdGhpcyBlcnJvciBtaWdodCBub3QgYWx3YXlzIGJlIGZhdGFsIChpdCBpcyBmYXRhbCBpZiBkZWNvZGUgZXJyb3IgaXMgc2V0LCBpbiB0aGF0IGNhc2VcbiAgICAvLyBpdCB3aWxsIGJlIGZvbGxvd2VkIGJ5IGEgbWVkaWFFbGVtZW50IGVycm9yIC4uLilcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiBmYWxzZX0pO1xuICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gZG8gbW9yZSB0aGFuIHRoYXQsIGFzIGFjY29yZGluIHRvIHRoZSBzcGVjLCB1cGRhdGVlbmQgd2lsbCBiZSBmaXJlZCBqdXN0IGFmdGVyXG4gIH1cblxuICBvbkJ1ZmZlclJlc2V0KCkge1xuICAgIHZhciBzb3VyY2VCdWZmZXIgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYik7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5hcHBlbmRlZCA9IDA7XG4gIH1cblxuICBvbkJ1ZmZlckNvZGVjcyh0cmFja3MpIHtcbiAgICB2YXIgc2IsdHJhY2tOYW1lLHRyYWNrLCBjb2RlYywgbWltZVR5cGU7XG5cbiAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IHRyYWNrcztcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB2YXIgc291cmNlQnVmZmVyID0ge30sIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgIGZvciAodHJhY2tOYW1lIGluIHRyYWNrcykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICAvLyB1c2UgbGV2ZWxDb2RlYyBhcyBmaXJzdCBwcmlvcml0eVxuICAgICAgICBjb2RlYyA9IHRyYWNrLmxldmVsQ29kZWMgfHwgdHJhY2suY29kZWM7XG4gICAgICAgIG1pbWVUeXBlID0gYCR7dHJhY2suY29udGFpbmVyfTtjb2RlY3M9JHtjb2RlY31gO1xuICAgICAgICBsb2dnZXIubG9nKGBjcmVhdGluZyBzb3VyY2VCdWZmZXIgd2l0aCBtaW1lVHlwZToke21pbWVUeXBlfWApO1xuICAgICAgICBzYiA9IHNvdXJjZUJ1ZmZlclt0cmFja05hbWVdID0gbWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKG1pbWVUeXBlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBzb3VyY2VCdWZmZXI7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRpbmcoZGF0YSkge1xuICAgIGlmICghdGhpcy5zZWdtZW50cykge1xuICAgICAgdGhpcy5zZWdtZW50cyA9IFsgZGF0YSBdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlZ21lbnRzLnB1c2goZGF0YSk7XG4gICAgfVxuICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kRmFpbChkYXRhKSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtkYXRhLmV2ZW50fWApO1xuICAgIC8vIGFjY29yZGluZyB0byBodHRwOi8vd3d3LnczLm9yZy9UUi9tZWRpYS1zb3VyY2UvI3NvdXJjZWJ1ZmZlci1hcHBlbmQtZXJyb3JcbiAgICAvLyB0aGlzIGVycm9yIG1pZ2h0IG5vdCBhbHdheXMgYmUgZmF0YWwgKGl0IGlzIGZhdGFsIGlmIGRlY29kZSBlcnJvciBpcyBzZXQsIGluIHRoYXQgY2FzZVxuICAgIC8vIGl0IHdpbGwgYmUgZm9sbG93ZWQgYnkgYSBtZWRpYUVsZW1lbnQgZXJyb3IgLi4uKVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fSk7XG4gIH1cblxuICBvbkJ1ZmZlckVvcygpIHtcbiAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlciwgbWVkaWFTb3VyY2UgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmICghbWVkaWFTb3VyY2UgfHwgbWVkaWFTb3VyY2UucmVhZHlTdGF0ZSAhPT0gJ29wZW4nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghKChzYi5hdWRpbyAmJiBzYi5hdWRpby51cGRhdGluZykgfHwgKHNiLnZpZGVvICYmIHNiLnZpZGVvLnVwZGF0aW5nKSkpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2FsbCBtZWRpYSBkYXRhIGF2YWlsYWJsZSwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2UgYW5kIHN0b3AgbG9hZGluZyBmcmFnbWVudCcpO1xuICAgICAgLy9Ob3RpZnkgdGhlIG1lZGlhIGVsZW1lbnQgdGhhdCBpdCBub3cgaGFzIGFsbCBvZiB0aGUgbWVkaWEgZGF0YVxuICAgICAgbWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBvbkJ1ZmZlckZsdXNoaW5nKGRhdGEpIHtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IGRhdGEuc3RhcnRPZmZzZXQsIGVuZDogZGF0YS5lbmRPZmZzZXR9KTtcbiAgICAvLyBhdHRlbXB0IGZsdXNoIGltbWVkaWF0bHlcbiAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgdGhpcy5kb0ZsdXNoKCk7XG4gIH1cblxuICBkb0ZsdXNoKCkge1xuICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgaWYgKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpIHtcbiAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnNoaWZ0KCk7XG4gICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX25lZWRzRmx1c2ggPSB0cnVlO1xuICAgICAgICAvLyBhdm9pZCBsb29waW5nLCB3YWl0IGZvciBTQiB1cGRhdGUgZW5kIHRvIHJldHJpZ2dlciBhIGZsdXNoXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZFxuICAgICAgdGhpcy5fbmVlZHNGbHVzaCA9IGZhbHNlO1xuXG4gICAgICAvLyBsZXQncyByZWNvbXB1dGUgdGhpcy5hcHBlbmRlZCwgd2hpY2ggaXMgdXNlZCB0byBhdm9pZCBmbHVzaCBsb29waW5nXG4gICAgICB2YXIgYXBwZW5kZWQgPSAwO1xuICAgICAgdmFyIHNvdXJjZUJ1ZmZlciA9IHRoaXMuc291cmNlQnVmZmVyO1xuICAgICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIGFwcGVuZGVkICs9IHNvdXJjZUJ1ZmZlclt0eXBlXS5idWZmZXJlZC5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuYXBwZW5kZWQgPSBhcHBlbmRlZDtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNIRUQpO1xuICAgIH1cbiAgfVxuXG4gIGRvQXBwZW5kaW5nKCkge1xuICAgIHZhciBobHMgPSB0aGlzLmhscywgc291cmNlQnVmZmVyID0gdGhpcy5zb3VyY2VCdWZmZXIsIHNlZ21lbnRzID0gdGhpcy5zZWdtZW50cztcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBpZiAodGhpcy5tZWRpYS5lcnJvcikge1xuICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ3RyeWluZyB0byBhcHBlbmQgYWx0aG91Z2ggYSBtZWRpYSBlcnJvciBvY2N1cmVkLCBmbHVzaCBzZWdtZW50IGFuZCBhYm9ydCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBpZiAoc291cmNlQnVmZmVyW3R5cGVdLnVwZGF0aW5nKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiB1cGRhdGUgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHNlZ21lbnQgPSBzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9KTtcblx0XHQgIC8vIGlmIChzb3VyY2VCdWZmZXIuZmlyc3RMb2FkZWQgJiYgIXNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykgeyBcblx0XHQgIFx0Ly8gc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0udGltZXN0YW1wT2Zmc2V0ICs9IDEwO1xuXHRcdCAgLy8gfVxuICAgICAgICAgIHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuXHRcdCAgc291cmNlQnVmZmVyLmZpcnN0TG9hZGVkID0gdHJ1ZTtcblxuXHRcdCAgLy8gc2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0ICAvLyBcdHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLnRpbWVzdGFtcE9mZnNldCA9IDE1O1xuXHRcdCAgLy8gfSwgNSk7XG5cblx0XHQgIGxvZ2dlci5pbmZvKHNlZ21lbnQpO1xuICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAwO1xuICAgICAgICAgIHRoaXMuYXBwZW5kZWQrKztcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBzZWdtZW50cyB0YWJsZVxuICAgICAgICAgIGxvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICBzZWdtZW50cy51bnNoaWZ0KHNlZ21lbnQpO1xuICAgICAgICAgIHZhciBldmVudCA9IHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SfTtcbiAgICAgICAgICBpZihlcnIuY29kZSAhPT0gMjIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yKSB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXZlbnQuZGV0YWlscyA9IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5EX0VSUk9SO1xuICAgICAgICAgICAgZXZlbnQuZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgICAgICAvKiB3aXRoIFVIRCBjb250ZW50LCB3ZSBjb3VsZCBnZXQgbG9vcCBvZiBxdW90YSBleGNlZWRlZCBlcnJvciB1bnRpbFxuICAgICAgICAgICAgICBicm93c2VyIGlzIGFibGUgdG8gZXZpY3Qgc29tZSBkYXRhIGZyb20gc291cmNlYnVmZmVyLiByZXRyeWluZyBoZWxwIHJlY292ZXJpbmcgdGhpc1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yID4gaGxzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5KSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZhaWwgJHtobHMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnl9IHRpbWVzIHRvIGFwcGVuZCBzZWdtZW50IGluIHNvdXJjZUJ1ZmZlcmApO1xuICAgICAgICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV2ZW50LmZhdGFsID0gZmFsc2U7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFF1b3RhRXhjZWVkZWRFcnJvcjogaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvaW5mcmFzdHJ1Y3R1cmUuaHRtbCNxdW90YWV4Y2VlZGVkZXJyb3JcbiAgICAgICAgICAgIC8vIGxldCdzIHN0b3AgYXBwZW5kaW5nIGFueSBzZWdtZW50cywgYW5kIHJlcG9ydCBCVUZGRVJfRlVMTF9FUlJPUiBlcnJvclxuICAgICAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgICAgIGV2ZW50LmRldGFpbHMgPSBFcnJvckRldGFpbHMuQlVGRkVSX0ZVTExfRVJST1I7XG4gICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUixldmVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICBmbHVzaCBzcGVjaWZpZWQgYnVmZmVyZWQgcmFuZ2UsXG4gICAgcmV0dXJuIHRydWUgb25jZSByYW5nZSBoYXMgYmVlbiBmbHVzaGVkLlxuICAgIGFzIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBpcyBhc3luY2hyb25vdXMsIGZsdXNoQnVmZmVyIHdpbGwgYmUgcmV0cmlnZ2VyZWQgb24gc291cmNlQnVmZmVyIHVwZGF0ZSBlbmRcbiAgKi9cbiAgZmx1c2hCdWZmZXIoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkge1xuICAgIHZhciBzYiwgaSwgYnVmU3RhcnQsIGJ1ZkVuZCwgZmx1c2hTdGFydCwgZmx1c2hFbmQ7XG4gICAgLy9sb2dnZXIubG9nKCdmbHVzaEJ1ZmZlcixwb3Mvc3RhcnQvZW5kOiAnICsgdGhpcy5tZWRpYS5jdXJyZW50VGltZSArICcvJyArIHN0YXJ0T2Zmc2V0ICsgJy8nICsgZW5kT2Zmc2V0KTtcbiAgICAvLyBzYWZlZ3VhcmQgdG8gYXZvaWQgaW5maW5pdGUgbG9vcGluZyA6IGRvbid0IHRyeSB0byBmbHVzaCBtb3JlIHRoYW4gdGhlIG5iIG9mIGFwcGVuZGVkIHNlZ21lbnRzXG4gICAgaWYgKHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyIDwgdGhpcy5hcHBlbmRlZCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yICh2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICBpZiAoIXNiLnVwZGF0aW5nKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHNiLmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBidWZTdGFydCA9IHNiLmJ1ZmZlcmVkLnN0YXJ0KGkpO1xuICAgICAgICAgICAgYnVmRW5kID0gc2IuYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmaXJlZm94IG5vdCBhYmxlIHRvIHByb3Blcmx5IGZsdXNoIG11bHRpcGxlIGJ1ZmZlcmVkIHJhbmdlLlxuICAgICAgICAgICAgaWYgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xICYmIGVuZE9mZnNldCA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBzdGFydE9mZnNldDtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBlbmRPZmZzZXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gTWF0aC5tYXgoYnVmU3RhcnQsIHN0YXJ0T2Zmc2V0KTtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBNYXRoLm1pbihidWZFbmQsIGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAoTWF0aC5taW4oZmx1c2hFbmQsYnVmRW5kKSAtIGZsdXNoU3RhcnQgPiAwLjUgKSB7XG4gICAgICAgICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZsdXNoICR7dHlwZX0gWyR7Zmx1c2hTdGFydH0sJHtmbHVzaEVuZH1dLCBvZiBbJHtidWZTdGFydH0sJHtidWZFbmR9XSwgcG9zOiR7dGhpcy5tZWRpYS5jdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgc2IucmVtb3ZlKGZsdXNoU3RhcnQsIGZsdXNoRW5kKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fib3J0ICcgKyB0eXBlICsgJyBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICAvLyB0aGlzIHdpbGwgYWJvcnQgYW55IGFwcGVuZGluZyBpbiBwcm9ncmVzc1xuICAgICAgICAgIC8vc2IuYWJvcnQoKTtcbiAgICAgICAgICBsb2dnZXIud2FybignY2Fubm90IGZsdXNoLCBzYiB1cGRhdGluZyBpbiBwcm9ncmVzcycpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignYWJvcnQgZmx1c2hpbmcgdG9vIG1hbnkgcmV0cmllcycpO1xuICAgIH1cbiAgICBsb2dnZXIubG9nKCdidWZmZXIgZmx1c2hlZCcpO1xuICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZCAhXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVyQ29udHJvbGxlcjtcbiIsIi8qXG4gKiBjYXAgc3RyZWFtIGxldmVsIHRvIG1lZGlhIHNpemUgZGltZW5zaW9uIGNvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcblxuY2xhc3MgQ2FwTGV2ZWxDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblx0Y29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VEKTsgICBcblx0fVxuXHRcblx0ZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmNhcExldmVsVG9QbGF5ZXJTaXplKSB7XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMuYXV0b0xldmVsQ2FwcGluZyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgIHRoaXMudGltZXIgPSBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXHQgIFxuXHRvbk1lZGlhQXR0YWNoaW5nKGRhdGEpIHtcbiAgICB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYSBpbnN0YW5jZW9mIEhUTUxWaWRlb0VsZW1lbnQgPyBkYXRhLm1lZGlhIDogbnVsbDsgIFxuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5jYXBMZXZlbFRvUGxheWVyU2l6ZSkge1xuICAgICAgdGhpcy5hdXRvTGV2ZWxDYXBwaW5nID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICAgIHRoaXMuaGxzLmZpcnN0TGV2ZWwgPSB0aGlzLmdldE1heExldmVsKGRhdGEuZmlyc3RMZXZlbCk7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMuZGV0ZWN0UGxheWVyU2l6ZS5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICAgIHRoaXMuZGV0ZWN0UGxheWVyU2l6ZSgpO1xuICAgIH1cbiAgfVxuICBcbiAgZGV0ZWN0UGxheWVyU2l6ZSgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgbGV0IGxldmVsc0xlbmd0aCA9IHRoaXMubGV2ZWxzID8gdGhpcy5sZXZlbHMubGVuZ3RoIDogMDtcbiAgICAgIGlmIChsZXZlbHNMZW5ndGgpIHtcbiAgICAgICAgdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZyA9IHRoaXMuZ2V0TWF4TGV2ZWwobGV2ZWxzTGVuZ3RoIC0gMSk7XG4gICAgICAgIGlmICh0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nID4gdGhpcy5hdXRvTGV2ZWxDYXBwaW5nKSB7XG4gICAgICAgICAgLy8gaWYgYXV0byBsZXZlbCBjYXBwaW5nIGhhcyBhIGhpZ2hlciB2YWx1ZSBmb3IgdGhlIHByZXZpb3VzIG9uZSwgZmx1c2ggdGhlIGJ1ZmZlciB1c2luZyBuZXh0TGV2ZWxTd2l0Y2hcbiAgICAgICAgICAvLyB1c3VhbGx5IGhhcHBlbiB3aGVuIHRoZSB1c2VyIGdvIHRvIHRoZSBmdWxsc2NyZWVuIG1vZGUuXG4gICAgICAgICAgdGhpcy5obHMuc3RyZWFtQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmF1dG9MZXZlbENhcHBpbmcgPSB0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nOyAgICAgICAgXG4gICAgICB9ICBcbiAgICB9XG4gIH1cbiAgXG4gIC8qXG4gICogcmV0dXJucyBsZXZlbCBzaG91bGQgYmUgdGhlIG9uZSB3aXRoIHRoZSBkaW1lbnNpb25zIGVxdWFsIG9yIGdyZWF0ZXIgdGhhbiB0aGUgbWVkaWEgKHBsYXllcikgZGltZW5zaW9ucyAoc28gdGhlIHZpZGVvIHdpbGwgYmUgZG93bnNjYWxlZClcbiAgKi9cbiAgZ2V0TWF4TGV2ZWwoY2FwTGV2ZWxJbmRleCkge1xuICAgIGxldCByZXN1bHQsXG4gICAgICAgIGksXG4gICAgICAgIGxldmVsLFxuICAgICAgICBtV2lkdGggPSB0aGlzLm1lZGlhV2lkdGgsXG4gICAgICAgIG1IZWlnaHQgPSB0aGlzLm1lZGlhSGVpZ2h0LFxuICAgICAgICBsV2lkdGggPSAwLFxuICAgICAgICBsSGVpZ2h0ID0gMDtcbiAgICAgICAgXG4gICAgZm9yIChpID0gMDsgaSA8PSBjYXBMZXZlbEluZGV4OyBpKyspIHtcbiAgICAgIGxldmVsID0gdGhpcy5sZXZlbHNbaV07XG4gICAgICByZXN1bHQgPSBpO1xuICAgICAgbFdpZHRoID0gbGV2ZWwud2lkdGg7XG4gICAgICBsSGVpZ2h0ID0gbGV2ZWwuaGVpZ2h0O1xuICAgICAgaWYgKG1XaWR0aCA8PSBsV2lkdGggfHwgbUhlaWdodCA8PSBsSGVpZ2h0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgXG4gIGdldCBjb250ZW50U2NhbGVGYWN0b3IoKSB7XG4gICAgbGV0IHBpeGVsUmF0aW8gPSAxO1xuICAgIHRyeSB7XG4gICAgICBwaXhlbFJhdGlvID0gIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuICAgIH0gY2F0Y2goZSkge31cbiAgICByZXR1cm4gcGl4ZWxSYXRpbztcbiAgfVxuICBcbiAgZ2V0IG1lZGlhV2lkdGgoKSB7XG4gICAgbGV0IHdpZHRoO1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB3aWR0aCA9IHRoaXMubWVkaWEud2lkdGggfHwgdGhpcy5tZWRpYS5jbGllbnRXaWR0aCB8fCB0aGlzLm1lZGlhLm9mZnNldFdpZHRoO1xuICAgICAgd2lkdGggKj0gdGhpcy5jb250ZW50U2NhbGVGYWN0b3I7XG4gICAgfVxuICAgIHJldHVybiB3aWR0aDtcbiAgfVxuICBcbiAgZ2V0IG1lZGlhSGVpZ2h0KCkge1xuICAgIGxldCBoZWlnaHQ7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIGhlaWdodCA9IHRoaXMubWVkaWEuaGVpZ2h0IHx8IHRoaXMubWVkaWEuY2xpZW50SGVpZ2h0IHx8IHRoaXMubWVkaWEub2Zmc2V0SGVpZ2h0O1xuICAgICAgaGVpZ2h0ICo9IHRoaXMuY29udGVudFNjYWxlRmFjdG9yOyBcbiAgICB9XG4gICAgcmV0dXJuIGhlaWdodDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDYXBMZXZlbENvbnRyb2xsZXI7IiwiLypcbiAqIExldmVsIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIExldmVsQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuRVJST1IpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMuX21hbnVhbExldmVsID0gLTE7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgdGhpcy5jYW5sb2FkID0gdHJ1ZTtcbiAgICAvLyBzcGVlZCB1cCBsaXZlIHBsYXlsaXN0IHJlZnJlc2ggaWYgdGltZXIgZXhpc3RzXG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIHN0b3BMb2FkKCkge1xuICAgIHRoaXMuY2FubG9hZCA9IGZhbHNlO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChkYXRhKSB7XG4gICAgdmFyIGxldmVsczAgPSBbXSwgbGV2ZWxzID0gW10sIGJpdHJhdGVTdGFydCwgaSwgYml0cmF0ZVNldCA9IHt9LCB2aWRlb0NvZGVjRm91bmQgPSBmYWxzZSwgYXVkaW9Db2RlY0ZvdW5kID0gZmFsc2UsIGhscyA9IHRoaXMuaGxzO1xuXG4gICAgLy8gcmVncm91cCByZWR1bmRhbnQgbGV2ZWwgdG9nZXRoZXJcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIGlmKGxldmVsLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgdmlkZW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmKGxldmVsLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgYXVkaW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHZhciByZWR1bmRhbnRMZXZlbElkID0gYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXTtcbiAgICAgIGlmIChyZWR1bmRhbnRMZXZlbElkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXSA9IGxldmVsczAubGVuZ3RoO1xuICAgICAgICBsZXZlbC51cmwgPSBbbGV2ZWwudXJsXTtcbiAgICAgICAgbGV2ZWwudXJsSWQgPSAwO1xuICAgICAgICBsZXZlbHMwLnB1c2gobGV2ZWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzMFtyZWR1bmRhbnRMZXZlbElkXS51cmwucHVzaChsZXZlbC51cmwpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gcmVtb3ZlIGF1ZGlvLW9ubHkgbGV2ZWwgaWYgd2UgYWxzbyBoYXZlIGxldmVscyB3aXRoIGF1ZGlvK3ZpZGVvIGNvZGVjcyBzaWduYWxsZWRcbiAgICBpZih2aWRlb0NvZGVjRm91bmQgJiYgYXVkaW9Db2RlY0ZvdW5kKSB7XG4gICAgICBsZXZlbHMwLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV2ZWxzID0gbGV2ZWxzMDtcbiAgICB9XG5cbiAgICAvLyBvbmx5IGtlZXAgbGV2ZWwgd2l0aCBzdXBwb3J0ZWQgYXVkaW8vdmlkZW8gY29kZWNzXG4gICAgbGV2ZWxzID0gbGV2ZWxzLmZpbHRlcihmdW5jdGlvbihsZXZlbCkge1xuICAgICAgdmFyIGNoZWNrU3VwcG9ydGVkQXVkaW8gPSBmdW5jdGlvbihjb2RlYykgeyByZXR1cm4gTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKGBhdWRpby9tcDQ7Y29kZWNzPSR7Y29kZWN9YCk7fTtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZFZpZGVvID0gZnVuY3Rpb24oY29kZWMpIHsgcmV0dXJuIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZChgdmlkZW8vbXA0O2NvZGVjcz0ke2NvZGVjfWApO307XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IGxldmVsLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSBsZXZlbC52aWRlb0NvZGVjO1xuXG4gICAgICByZXR1cm4gKCFhdWRpb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkQXVkaW8oYXVkaW9Db2RlYykpICYmXG4gICAgICAgICAgICAgKCF2aWRlb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkVmlkZW8odmlkZW9Db2RlYykpO1xuICAgIH0pO1xuXG4gICAgaWYobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgICAgLy8gc29ydCBsZXZlbCBvbiBiaXRyYXRlXG4gICAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5iaXRyYXRlIC0gYi5iaXRyYXRlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG4gICAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBsb2FkZWQsJHtsZXZlbHMubGVuZ3RofSBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZToke2JpdHJhdGVTdGFydH1gKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB7bGV2ZWxzOiB0aGlzLl9sZXZlbHMsIGZpcnN0TGV2ZWw6IHRoaXMuX2ZpcnN0TGV2ZWwsIHN0YXRzOiBkYXRhLnN0YXRzfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX0lOQ09NUEFUSUJMRV9DT0RFQ1NfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IGhscy51cmwsIHJlYXNvbjogJ25vIGxldmVsIHdpdGggY29tcGF0aWJsZSBjb2RlY3MgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVscztcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZiAodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsIHx8IHRoaXMuX2xldmVsc1tuZXdMZXZlbF0uZGV0YWlscyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpO1xuICAgIH1cbiAgfVxuXG4gc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCkge1xuICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgIGlmIChuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgbG9nZ2VyLmxvZyhgc3dpdGNoaW5nIHRvIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1NXSVRDSCwge2xldmVsOiBuZXdMZXZlbH0pO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgIGlmIChsZXZlbC5kZXRhaWxzID09PSB1bmRlZmluZWQgfHwgbGV2ZWwuZGV0YWlscy5saXZlID09PSB0cnVlKSB7XG4gICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgbG9nZ2VyLmxvZyhgKHJlKWxvYWRpbmcgcGxheWxpc3QgZm9yIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICAgIHZhciB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBuZXdMZXZlbCwgaWQ6IHVybElkfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmFsaWQgbGV2ZWwgaWQgZ2l2ZW4sIHRyaWdnZXIgZXJyb3JcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5PVEhFUl9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkxFVkVMX1NXSVRDSF9FUlJPUiwgbGV2ZWw6IG5ld0xldmVsLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ2ludmFsaWQgbGV2ZWwgaWR4J30pO1xuICAgIH1cbiB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgaWYgKG5ld0xldmVsICE9PSAtMSkge1xuICAgICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICB9XG5cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkVycm9yKGRhdGEpIHtcbiAgICBpZihkYXRhLmZhdGFsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGRldGFpbHMgPSBkYXRhLmRldGFpbHMsIGhscyA9IHRoaXMuaGxzLCBsZXZlbElkLCBsZXZlbDtcbiAgICAvLyB0cnkgdG8gcmVjb3ZlciBub3QgZmF0YWwgZXJyb3JzXG4gICAgc3dpdGNoKGRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX1RJTUVPVVQ6XG4gICAgICAgICBsZXZlbElkID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgICBsZXZlbElkID0gZGF0YS5sZXZlbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLyogdHJ5IHRvIHN3aXRjaCB0byBhIHJlZHVuZGFudCBzdHJlYW0gaWYgYW55IGF2YWlsYWJsZS5cbiAgICAgKiBpZiBubyByZWR1bmRhbnQgc3RyZWFtIGF2YWlsYWJsZSwgZW1lcmdlbmN5IHN3aXRjaCBkb3duIChpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IDApXG4gICAgICogb3RoZXJ3aXNlLCB3ZSBjYW5ub3QgcmVjb3ZlciB0aGlzIG5ldHdvcmsgZXJyb3IgLi4uXG4gICAgICogZG9uJ3QgcmFpc2UgRlJBR19MT0FEX0VSUk9SIGFuZCBGUkFHX0xPQURfVElNRU9VVCBhcyBmYXRhbCwgYXMgaXQgaXMgaGFuZGxlZCBieSBtZWRpYUNvbnRyb2xsZXJcbiAgICAgKi9cbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXTtcbiAgICAgIGlmIChsZXZlbC51cmxJZCA8IChsZXZlbC51cmwubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgbGV2ZWwudXJsSWQrKztcbiAgICAgICAgbGV2ZWwuZGV0YWlscyA9IHVuZGVmaW5lZDtcbiAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBmb3IgbGV2ZWwgJHtsZXZlbElkfTogc3dpdGNoaW5nIHRvIHJlZHVuZGFudCBzdHJlYW0gaWQgJHtsZXZlbC51cmxJZH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIGNvdWxkIHRyeSB0byByZWNvdmVyIGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgbG93ZXN0IGxldmVsICgwKVxuICAgICAgICBsZXQgcmVjb3ZlcmFibGUgPSAoKHRoaXMuX21hbnVhbExldmVsID09PSAtMSkgJiYgbGV2ZWxJZCk7XG4gICAgICAgIGlmIChyZWNvdmVyYWJsZSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc306IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgICAgICAgIGhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWwgPSAwO1xuICAgICAgICB9IGVsc2UgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9IG9uIGxpdmUgc3RyZWFtLCBkaXNjYXJkYCk7XG4gICAgICAgIC8vIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXJlIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICAgIH0gZWxzZSBpZiAoZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiAmJiBkZXRhaWxzICE9PSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGNhbm5vdCByZWNvdmVyICR7ZGV0YWlsc30gZXJyb3JgKTtcbiAgICAgICAgICB0aGlzLl9sZXZlbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICBobHMudHJpZ2dlcihldmVudCwgZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IHBsYXlsaXN0IGlzIGEgbGl2ZSBwbGF5bGlzdFxuICAgIGlmIChkYXRhLmRldGFpbHMubGl2ZSAmJiAhdGhpcy50aW1lcikge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCB3ZSB3aWxsIGhhdmUgdG8gcmVsb2FkIGl0IHBlcmlvZGljYWxseVxuICAgICAgLy8gc2V0IHJlbG9hZCBwZXJpb2QgdG8gcGxheWxpc3QgdGFyZ2V0IGR1cmF0aW9uXG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMDAgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24vMyk7XG4gICAgfVxuICAgIGlmICghZGF0YS5kZXRhaWxzLmxpdmUgJiYgdGhpcy50aW1lcikge1xuICAgICAgLy8gcGxheWxpc3QgaXMgbm90IGxpdmUgYW5kIHRpbWVyIGlzIGFybWVkIDogc3RvcHBpbmcgaXRcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBsZXZlbElkID0gdGhpcy5fbGV2ZWw7XG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCAmJiB0aGlzLmNhbmxvYWQpIHtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXSwgdXJsSWQgPSBsZXZlbC51cmxJZDtcblx0ICB2YXIgdG90YWxEdXJhdGlvbiA9IDA7XG5cdCAgZm9yICh2YXIgZiBpbiBsZXZlbC5kZXRhaWxzLmZyYWdtZW50cyApIHtcblx0XHQgIHRvdGFsRHVyYXRpb24gPSBsZXZlbC5kZXRhaWxzLmZyYWdtZW50c1tmXS5lbmRQVFM7XG5cdCAgfVxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbGV2ZWxJZCwgaWQ6IHVybElkLCB0b3RhbER1cmF0aW9uOiB0b3RhbER1cmF0aW9uIHx8IDB9KTtcbiAgICB9XG4gIH1cblxuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgbmV4dExvYWRMZXZlbChuZXh0TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsID0gbmV4dExldmVsO1xuICAgIGlmICh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpIHtcbiAgICAgIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxDb250cm9sbGVyO1xuXG4iLCIvKlxuICogU3RyZWFtIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBEZW11eGVyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXInO1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgQmluYXJ5U2VhcmNoIGZyb20gJy4uL3V0aWxzL2JpbmFyeS1zZWFyY2gnO1xuaW1wb3J0IEJ1ZmZlckhlbHBlciBmcm9tICcuLi9oZWxwZXIvYnVmZmVyLWhlbHBlcic7XG5pbXBvcnQgTGV2ZWxIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2xldmVsLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY29uc3QgU3RhdGUgPSB7XG4gIFNUT1BQRUQgOiAnU1RPUFBFRCcsXG4gIFNUQVJUSU5HIDogJ1NUQVJUSU5HJyxcbiAgSURMRSA6ICdJRExFJyxcbiAgUEFVU0VEIDogJ1BBVVNFRCcsXG4gIEtFWV9MT0FESU5HIDogJ0tFWV9MT0FESU5HJyxcbiAgRlJBR19MT0FESU5HIDogJ0ZSQUdfTE9BRElORycsXG4gIEZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZIDogJ0ZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZJyxcbiAgV0FJVElOR19MRVZFTCA6ICdXQUlUSU5HX0xFVkVMJyxcbiAgUEFSU0lORyA6ICdQQVJTSU5HJyxcbiAgUEFSU0VEIDogJ1BBUlNFRCcsXG4gIEVOREVEIDogJ0VOREVEJyxcbiAgRVJST1IgOiAnRVJST1InXG59O1xuXG5jbGFzcyBTdHJlYW1Db250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsXG4gICAgICBFdmVudC5NRURJQV9BVFRBQ0hFRCxcbiAgICAgIEV2ZW50Lk1FRElBX0RFVEFDSElORyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICBFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICBFdmVudC5LRVlfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19MT0FERUQsXG4gICAgICBFdmVudC5GUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQsXG4gICAgICBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsXG4gICAgICBFdmVudC5GUkFHX1BBUlNFRCxcbiAgICAgIEV2ZW50LkVSUk9SLFxuICAgICAgRXZlbnQuQlVGRkVSX0FQUEVOREVELFxuICAgICAgRXZlbnQuQlVGRkVSX0ZMVVNIRUQpO1xuXG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSBmYWxzZTtcbiAgICB0aGlzLnRpY2tzID0gMDtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3BMb2FkKCk7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG4gIH1cblxuICBzdGFydExvYWQoc3RhcnRQb3NpdGlvbj0wKSB7XG4gICAgaWYgKHRoaXMubGV2ZWxzKSB7XG4gICAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhLCBsYXN0Q3VycmVudFRpbWUgPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMuc3RvcExvYWQoKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVyKHRoaXMuaGxzKTtcbiAgICAgIGlmICghdGhpcy50aW1lcikge1xuICAgICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxldmVsID0gLTE7XG4gICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSAwO1xuICAgICAgaWYgKG1lZGlhICYmIGxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGBjb25maWd1cmUgc3RhcnRQb3NpdGlvbiBAJHtsYXN0Q3VycmVudFRpbWV9YCk7XG4gICAgICAgIGlmICghdGhpcy5sYXN0UGF1c2VkKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygncmVzdW1pbmcgdmlkZW8nKTtcbiAgICAgICAgICBtZWRpYS5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbiA/IHRoaXMuc3RhcnRQb3NpdGlvbiA6IHN0YXJ0UG9zaXRpb247XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVEFSVElORztcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKCdjYW5ub3Qgc3RhcnQgbG9hZGluZyBhcyBtYW5pZmVzdCBub3QgcGFyc2VkIHlldCcpO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG4gICAgfVxuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnKSB7XG4gICAgICBpZiAoZnJhZy5sb2FkZXIpIHtcbiAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgaWYgKHRoaXMuZGVtdXhlcikge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB0aGlzLnRpY2tzKys7XG4gICAgaWYgKHRoaXMudGlja3MgPT09IDEpIHtcbiAgICAgIHRoaXMuZG9UaWNrKCk7XG4gICAgICBpZiAodGhpcy50aWNrcyA+IDEpIHtcbiAgICAgICAgc2V0VGltZW91dCh0aGlzLnRpY2ssIDEpO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrcyA9IDA7XG4gICAgfVxuICB9XG5cbiAgZG9UaWNrKCkge1xuICAgIHZhciBwb3MsIGxldmVsLCBsZXZlbERldGFpbHMsIGhscyA9IHRoaXMuaGxzLCBjb25maWcgPSBobHMuY29uZmlnO1xuICAgIHN3aXRjaCh0aGlzLnN0YXRlKSB7XG4gICAgICBjYXNlIFN0YXRlLkVSUk9SOlxuICAgICAgICAvL2Rvbid0IGRvIGFueXRoaW5nIGluIGVycm9yIHN0YXRlIHRvIGF2b2lkIGJyZWFraW5nIGZ1cnRoZXIgLi4uXG4gICAgICBjYXNlIFN0YXRlLlBBVVNFRDpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBwYXVzZWQgc3RhdGUgZWl0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IGhscy5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5JRExFOlxuICAgICAgICAvLyBpZiB2aWRlbyBub3QgYXR0YWNoZWQgQU5EXG4gICAgICAgIC8vIHN0YXJ0IGZyYWdtZW50IGFscmVhZHkgcmVxdWVzdGVkIE9SIHN0YXJ0IGZyYWcgcHJlZmV0Y2ggZGlzYWJsZVxuICAgICAgICAvLyBleGl0IGxvb3BcbiAgICAgICAgLy8gPT4gaWYgbWVkaWEgbm90IGF0dGFjaGVkIGJ1dCBzdGFydCBmcmFnIHByZWZldGNoIGlzIGVuYWJsZWQgYW5kIHN0YXJ0IGZyYWcgbm90IHJlcXVlc3RlZCB5ZXQsIHdlIHdpbGwgbm90IGV4aXQgbG9vcFxuICAgICAgICBpZiAoIXRoaXMubWVkaWEgJiZcbiAgICAgICAgICAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgfHwgIWNvbmZpZy5zdGFydEZyYWdQcmVmZXRjaCkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgbGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gd2UgYXJlIG5vdCBhdCBwbGF5YmFjayBzdGFydCwgZ2V0IG5leHQgbG9hZCBsZXZlbCBmcm9tIGxldmVsIENvbnRyb2xsZXJcbiAgICAgICAgICBsZXZlbCA9IGhscy5uZXh0TG9hZExldmVsO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odGhpcy5tZWRpYSxwb3MsY29uZmlnLm1heEJ1ZmZlckhvbGUpLFxuICAgICAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sXG4gICAgICAgICAgICBidWZmZXJFbmQgPSBidWZmZXJJbmZvLmVuZCxcbiAgICAgICAgICAgIGZyYWdQcmV2aW91cyA9IHRoaXMuZnJhZ1ByZXZpb3VzLFxuICAgICAgICAgICAgbWF4QnVmTGVuO1xuXHRcdC8vIGNvbnNvbGUuaW5mbyhidWZmZXJJbmZvKTtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICBpZiAoKHRoaXMubGV2ZWxzW2xldmVsXSkuaGFzT3duUHJvcGVydHkoJ2JpdHJhdGUnKSkge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWF4KDggKiBjb25maWcubWF4QnVmZmVyU2l6ZSAvIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLCBjb25maWcubWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1pbihtYXhCdWZMZW4sIGNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IGNvbmZpZy5tYXhCdWZmZXJMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmIChidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICAvLyBzZXQgbmV4dCBsb2FkIGxldmVsIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICAgIGxldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGluZm8gbm90IHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgZW5zdXJlIHRoYXQgbmV3IHBsYXlsaXN0IGhhcyBiZWVuIHJlZnJlc2hlZCB0byBhdm9pZCBsb2FkaW5nL3RyeSB0byBsb2FkXG4gICAgICAgICAgLy8gYSB1c2VsZXNzIGFuZCBvdXRkYXRlZCBmcmFnbWVudCAodGhhdCBtaWdodCBldmVuIGludHJvZHVjZSBsb2FkIGVycm9yIGlmIGl0IGlzIGFscmVhZHkgb3V0IG9mIHRoZSBsaXZlIHBsYXlsaXN0KVxuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJyB8fCBsZXZlbERldGFpbHMubGl2ZSAmJiB0aGlzLmxldmVsTGFzdExvYWRlZCAhPT0gbGV2ZWwpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgICAgICAgIGZyYWdMZW4gPSBmcmFnbWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgICBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCxcbiAgICAgICAgICAgICAgZW5kID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV0uc3RhcnQgKyBmcmFnbWVudHNbZnJhZ0xlbi0xXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgZnJhZztcblxuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmIChsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLm1lZGlhLnNlZWtpbmd9YCk7XG4gICAgICAgICAgICBsZXQgbWF4TGF0ZW5jeSA9IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uICE9PSB1bmRlZmluZWQgPyBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiA6IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQqbGV2ZWxEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuXG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgTWF0aC5tYXgoc3RhcnQsIGVuZCAtIG1heExhdGVuY3kpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHRhcmdldExhdGVuY3kgPSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gOiBjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbGV2ZWxEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQgPSBzdGFydCArIE1hdGgubWF4KDAsIGxldmVsRGV0YWlscy50b3RhbGR1cmF0aW9uIC0gdGFyZ2V0TGF0ZW5jeSk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYnVmZmVyIGVuZDogJHtidWZmZXJFbmR9IGlzIGxvY2F0ZWQgdG9vIGZhciBmcm9tIHRoZSBlbmQgb2YgbGl2ZSBzbGlkaW5nIHBsYXlsaXN0LCBtZWRpYSBwb3NpdGlvbiB3aWxsIGJlIHJlc2V0ZWQgdG86ICR7dGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICAgIGJ1ZmZlckVuZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgJiYgIWxldmVsRGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgICAgICAvKiB3ZSBhcmUgc3dpdGNoaW5nIGxldmVsIG9uIGxpdmUgcGxheWxpc3QsIGJ1dCB3ZSBkb24ndCBoYXZlIGFueSBQVFMgaW5mbyBmb3IgdGhhdCBxdWFsaXR5IGxldmVsIC4uLlxuICAgICAgICAgICAgICAgICB0cnkgdG8gbG9hZCBmcmFnIG1hdGNoaW5nIHdpdGggbmV4dCBTTi5cbiAgICAgICAgICAgICAgICAgZXZlbiBpZiBTTiBhcmUgbm90IHN5bmNocm9uaXplZCBiZXR3ZWVuIHBsYXlsaXN0cywgbG9hZGluZyB0aGlzIGZyYWcgd2lsbCBoZWxwIHVzXG4gICAgICAgICAgICAgICAgIGNvbXB1dGUgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lIGFmdGVyIGluIGNhc2UgaXQgd2FzIG5vdCB0aGUgcmlnaHQgY29uc2VjdXRpdmUgb25lICovXG4gICAgICAgICAgICAgIGlmIChmcmFnUHJldmlvdXMpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0U04gPSBmcmFnUHJldmlvdXMuc24gKyAxO1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRTTiA+PSBsZXZlbERldGFpbHMuc3RhcnRTTiAmJiB0YXJnZXRTTiA8PSBsZXZlbERldGFpbHMuZW5kU04pIHtcbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbdGFyZ2V0U04gLSBsZXZlbERldGFpbHMuc3RhcnRTTl07XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIGxvYWQgZnJhZyB3aXRoIG5leHQgU046ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICAgICAgLyogd2UgaGF2ZSBubyBpZGVhIGFib3V0IHdoaWNoIGZyYWdtZW50IHNob3VsZCBiZSBsb2FkZWQuXG4gICAgICAgICAgICAgICAgICAgc28gbGV0J3MgbG9hZCBtaWQgZnJhZ21lbnQuIGl0IHdpbGwgaGVscCBjb21wdXRpbmcgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lXG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW01hdGgubWluKGZyYWdMZW4gLSAxLCBNYXRoLnJvdW5kKGZyYWdMZW4gLyAyKSldO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgdW5rbm93biwgbG9hZCBtaWRkbGUgZnJhZyA6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBWb0QgcGxheWxpc3Q6IGlmIGJ1ZmZlckVuZCBiZWZvcmUgc3RhcnQgb2YgcGxheWxpc3QsIGxvYWQgZmlyc3QgZnJhZ21lbnRcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBzdGFydCkge1xuICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgIGxldCBmb3VuZEZyYWc7XG4gICAgICAgICAgICBsZXQgbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSA9IGNvbmZpZy5tYXhGcmFnTG9va1VwVG9sZXJhbmNlO1xuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IGVuZCkge1xuICAgICAgICAgICAgICBpZiAoYnVmZmVyRW5kID4gZW5kIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSkge1xuICAgICAgICAgICAgICAgIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgPSAwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvdW5kRnJhZyA9IEJpbmFyeVNlYXJjaC5zZWFyY2goZnJhZ21lbnRzLCAoY2FuZGlkYXRlKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gb2Zmc2V0IHNob3VsZCBiZSB3aXRoaW4gZnJhZ21lbnQgYm91bmRhcnkgLSBjb25maWcubWF4RnJhZ0xvb2tVcFRvbGVyYW5jZVxuICAgICAgICAgICAgICAgIC8vIHRoaXMgaXMgdG8gY29wZSB3aXRoIHNpdHVhdGlvbnMgbGlrZVxuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlckVuZCA9IDkuOTkxXG4gICAgICAgICAgICAgICAgLy8gZnJhZ1vDmF0gOiBbMCwxMF1cbiAgICAgICAgICAgICAgICAvLyBmcmFnWzFdIDogWzEwLDIwXVxuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlckVuZCBpcyB3aXRoaW4gZnJhZ1swXSByYW5nZSAuLi4gYWx0aG91Z2ggd2hhdCB3ZSBhcmUgZXhwZWN0aW5nIGlzIHRvIHJldHVybiBmcmFnWzFdIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgIGZyYWcgc3RhcnQgICAgICAgICAgICAgICBmcmFnIHN0YXJ0K2R1cmF0aW9uXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgPC0tLT4gICAgICAgICAgICAgICAgICAgICAgICAgPC0tLT5cbiAgICAgICAgICAgICAgICAgICAgLy8gIC4uLi0tLS0tLS0tPjwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLT48LS0tLS0tLS0tLi4uLlxuICAgICAgICAgICAgICAgICAgICAvLyBwcmV2aW91cyBmcmFnICAgICAgICAgbWF0Y2hpbmcgZnJhZ21lbnQgICAgICAgICBuZXh0IGZyYWdcbiAgICAgICAgICAgICAgICAgICAgLy8gIHJldHVybiAtMSAgICAgICAgICAgICByZXR1cm4gMCAgICAgICAgICAgICAgICAgcmV0dXJuIDFcbiAgICAgICAgICAgICAgICAvLyBsb2dnZXIubG9nKGBsZXZlbC9zbi9zdGFydC9lbmQvYnVmRW5kOiR7bGV2ZWx9LyR7Y2FuZGlkYXRlLnNufS8ke2NhbmRpZGF0ZS5zdGFydCAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2V9LyR7KGNhbmRpZGF0ZS5zdGFydCtjYW5kaWRhdGUuZHVyYXRpb24gLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlKX0vJHtidWZmZXJFbmR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKChjYW5kaWRhdGUuc3RhcnQgKyBjYW5kaWRhdGUuZHVyYXRpb24gLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlKSA8PSBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChjYW5kaWRhdGUuc3RhcnQgLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuXHRcdFx0ICBcdC8vIGNvbnNvbGUuaW5mbyhjYW5kaWRhdGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICB9KTtcblx0XHRcdCAgLy8gY29uc29sZS5pbmZvKGZvdW5kRnJhZyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyByZWFjaCBlbmQgb2YgcGxheWxpc3RcbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZm91bmRGcmFnKSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmb3VuZEZyYWc7XG4gICAgICAgICAgICAgIHN0YXJ0ID0gZm91bmRGcmFnLnN0YXJ0O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBhZGp1c3QgcXVpY2sgbG9hZCBzZWVrIHBvc2l0aW9uIGlmIGl0IGlzIGNsb3NlIHRvIHRoZSBlbmQgb2YgZnJhZ21lbnRcbiAgICAgICAgICAgICAgdmFyIGsgPSBjb25maWcucXVpY2tMb2FkU2Vla1RocmVzaG9sZDtcbiAgICAgICAgICAgICAgdmFyIGVuZF9wb3MgPSAoMS1rKSpmcmFnLmR1cmF0aW9uICsgZnJhZy5zdGFydDtcbiAgICAgICAgICAgICAgaWYgKCF0aGlzLmluaXRpYWxfc2Vlaykge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5pdGlhbF9zZWVrID0gKGJ1ZmZlckVuZCA+IGVuZF9wb3MgPyBlbmRfcG9zIDogYnVmZmVyRW5kKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRU9TKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVOREVEO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWcpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuICAgICAgICAgICAgaWYgKChmcmFnLmRlY3J5cHRkYXRhLnVyaSAhPSBudWxsKSAmJiAoZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYExvYWRpbmcga2V5IGZvciAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuS0VZX0xPQURJTkc7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYExvYWRpbmcgJHtmcmFnLnNufSBvZiBbJHtsZXZlbERldGFpbHMuc3RhcnRTTn0gLCR7bGV2ZWxEZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH0sIGN1cnJlbnRUaW1lOiR7cG9zfSxidWZmZXJFbmQ6JHtidWZmZXJFbmQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgZnJhZy5hdXRvTGV2ZWwgPSBobHMuYXV0b0xldmVsRW5hYmxlZDtcbiAgICAgICAgICAgICAgaWYgKHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gTWF0aC5yb3VuZChmcmFnLmR1cmF0aW9uICogdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUgLyA4KTtcbiAgICAgICAgICAgICAgICBmcmFnLnRyZXF1ZXN0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gZW5zdXJlIHRoYXQgd2UgYXJlIG5vdCByZWxvYWRpbmcgdGhlIHNhbWUgZnJhZ21lbnRzIGluIGxvb3AgLi4uXG4gICAgICAgICAgICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4Kys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgbGV0IG1heFRocmVzaG9sZCA9IGNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBmcmFnIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkIDMgdGltZXMsIGFuZCBpZiBpdCBoYXMgYmVlbiByZWxvYWRlZCByZWNlbnRseVxuICAgICAgICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyID4gbWF4VGhyZXNob2xkICYmIChNYXRoLmFicyh0aGlzLmZyYWdMb2FkSWR4IC0gZnJhZy5sb2FkSWR4KSA8IG1heFRocmVzaG9sZCkpIHtcbiAgICAgICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlciA9IDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZy5sb2FkSWR4ID0gdGhpcy5mcmFnTG9hZElkeDtcbiAgICAgICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IGZyYWc7XG4gICAgICAgICAgICAgIHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRlJBR19MT0FESU5HO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuV0FJVElOR19MRVZFTDpcbiAgICAgICAgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgaWYgKGxldmVsICYmIGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlk6XG4gICAgICAgIHZhciBub3cgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdmFyIHJldHJ5RGF0ZSA9IHRoaXMucmV0cnlEYXRlO1xuICAgICAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgICAgICB2YXIgaXNTZWVraW5nID0gbWVkaWEgJiYgbWVkaWEuc2Vla2luZztcbiAgICAgICAgLy8gaWYgY3VycmVudCB0aW1lIGlzIGd0IHRoYW4gcmV0cnlEYXRlLCBvciBpZiBtZWRpYSBzZWVraW5nIGxldCdzIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgaWYoIXJldHJ5RGF0ZSB8fCAobm93ID49IHJldHJ5RGF0ZSkgfHwgaXNTZWVraW5nKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWVkaWFDb250cm9sbGVyOiByZXRyeURhdGUgcmVhY2hlZCwgc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZWApO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5TVE9QUEVEOlxuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNFRDpcbiAgICAgIGNhc2UgU3RhdGUuRU5ERUQ6XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIGNoZWNrIGJ1ZmZlclxuICAgIHRoaXMuX2NoZWNrQnVmZmVyKCk7XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICB9XG5cblxuXG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSwgcmFuZ2UsXG4gICAgICAgIGJ1ZmZlclJhbmdlID0gdGhpcy5idWZmZXJSYW5nZTtcbiAgICBpZiAoYnVmZmVyUmFuZ2UpIHtcbiAgICAgIGZvciAoaSA9IGJ1ZmZlclJhbmdlLmxlbmd0aCAtIDE7IGkgPj0wOyBpLS0pIHtcbiAgICAgICAgcmFuZ2UgPSBidWZmZXJSYW5nZVtpXTtcbiAgICAgICAgaWYgKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGdldCBuZXh0QnVmZmVyUmFuZ2UoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICAvLyB0cnkgdG8gZ2V0IHJhbmdlIG9mIG5leHQgZnJhZ21lbnQgKDUwMG1zIGFmdGVyIHRoaXMgcmFuZ2UpXG4gICAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXJSYW5nZShyYW5nZS5lbmQgKyAwLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcy5uZXh0QnVmZmVyUmFuZ2U7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMubWVkaWEsIGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWUsIHZpZGVvID0gdGhpcy5tZWRpYTtcbiAgICBpZiAodmlkZW8gJiYgdmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgIGN1cnJlbnRUaW1lID0gdmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAvKiBpZiB2aWRlbyBlbGVtZW50IGlzIGluIHNlZWtlZCBzdGF0ZSwgY3VycmVudFRpbWUgY2FuIG9ubHkgaW5jcmVhc2UuXG4gICAgICAgIChhc3N1bWluZyB0aGF0IHBsYXliYWNrIHJhdGUgaXMgcG9zaXRpdmUgLi4uKVxuICAgICAgICBBcyBzb21ldGltZXMgY3VycmVudFRpbWUganVtcHMgYmFjayB0byB6ZXJvIGFmdGVyIGFcbiAgICAgICAgbWVkaWEgZGVjb2RlIGVycm9yLCBjaGVjayB0aGlzLCB0byBhdm9pZCBzZWVraW5nIGJhY2sgdG9cbiAgICAgICAgd3JvbmcgcG9zaXRpb24gYWZ0ZXIgYSBtZWRpYSBkZWNvZGUgZXJyb3JcbiAgICAgICovXG4gICAgICBpZihjdXJyZW50VGltZSA+IHZpZGVvLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSArIDAuMSkpIHtcbiAgICAgICAgLyogZW5zdXJlIHRoYXQgRlJBR19DSEFOR0VEIGV2ZW50IGlzIHRyaWdnZXJlZCBhdCBzdGFydHVwLFxuICAgICAgICAgIHdoZW4gZmlyc3QgdmlkZW8gZnJhbWUgaXMgZGlzcGxheWVkIGFuZCBwbGF5YmFjayBpcyBwYXVzZWQuXG4gICAgICAgICAgYWRkIGEgdG9sZXJhbmNlIG9mIDEwMG1zLCBpbiBjYXNlIGN1cnJlbnQgcG9zaXRpb24gaXMgbm90IGJ1ZmZlcmVkLFxuICAgICAgICAgIGNoZWNrIGlmIGN1cnJlbnQgcG9zKzEwMG1zIGlzIGJ1ZmZlcmVkIGFuZCB1c2UgdGhhdCBidWZmZXIgcmFuZ2VcbiAgICAgICAgICBmb3IgRlJBR19DSEFOR0VEIGV2ZW50IHJlcG9ydGluZyAqL1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lICsgMC4xKTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZUN1cnJlbnQpIHtcbiAgICAgICAgdmFyIGZyYWdQbGF5aW5nID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICAgIGlmIChmcmFnUGxheWluZyAhPT0gdGhpcy5mcmFnUGxheWluZykge1xuICAgICAgICAgIHRoaXMuZnJhZ1BsYXlpbmcgPSBmcmFnUGxheWluZztcbiAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQ0hBTkdFRCwge2ZyYWc6IGZyYWdQbGF5aW5nfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggOlxuICAgICAtIHBhdXNlIHBsYXliYWNrIGlmIHBsYXlpbmdcbiAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgIC0gYW5kIHRyaWdnZXIgYSBidWZmZXIgZmx1c2hcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKSB7XG4gICAgbG9nZ2VyLmxvZygnaW1tZWRpYXRlTGV2ZWxTd2l0Y2gnKTtcbiAgICBpZiAoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLm1lZGlhLnBhdXNlZDtcbiAgICAgIHRoaXMubWVkaWEucGF1c2UoKTtcbiAgICB9XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNISU5HLCB7c3RhcnRPZmZzZXQ6IDAsIGVuZE9mZnNldDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBVVNFRDtcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIC8qXG4gICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgICAgLSBudWRnZSB2aWRlbyBkZWNvZGVyIGJ5IHNsaWdodGx5IGFkanVzdGluZyB2aWRlbyBjdXJyZW50VGltZVxuICAgICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMubWVkaWEuY3VycmVudFRpbWUgLT0gMC4wMDAxO1xuICAgIGlmICghdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLm1lZGlhLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksIGN1cnJlbnRSYW5nZSwgbmV4dFJhbmdlO1xuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgaWYgKGN1cnJlbnRSYW5nZSAmJiBjdXJyZW50UmFuZ2Uuc3RhcnQgPiAxKSB7XG4gICAgLy8gZmx1c2ggYnVmZmVyIHByZWNlZGluZyBjdXJyZW50IGZyYWdtZW50IChmbHVzaCB1bnRpbCBjdXJyZW50IGZyYWdtZW50IHN0YXJ0IG9mZnNldClcbiAgICAvLyBtaW51cyAxcyB0byBhdm9pZCB2aWRlbyBmcmVlemluZywgdGhhdCBjb3VsZCBoYXBwZW4gaWYgd2UgZmx1c2gga2V5ZnJhbWUgb2YgY3VycmVudCB2aWRlbyAuLi5cbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNISU5HLCB7c3RhcnRPZmZzZXQ6IDAsIGVuZE9mZnNldDogY3VycmVudFJhbmdlLnN0YXJ0IC0gMX0pO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBVVNFRDtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm1lZGlhLnBhdXNlZCkge1xuICAgICAgLy8gYWRkIGEgc2FmZXR5IGRlbGF5IG9mIDFzXG4gICAgICB2YXIgbmV4dExldmVsSWQgPSB0aGlzLmhscy5uZXh0TG9hZExldmVsLG5leHRMZXZlbCA9IHRoaXMubGV2ZWxzW25leHRMZXZlbElkXSwgZnJhZ0xhc3RLYnBzID0gdGhpcy5mcmFnTGFzdEticHM7XG4gICAgICBpZiAoZnJhZ0xhc3RLYnBzICYmIHRoaXMuZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IHRoaXMuZnJhZ0N1cnJlbnQuZHVyYXRpb24gKiBuZXh0TGV2ZWwuYml0cmF0ZSAvICgxMDAwICogZnJhZ0xhc3RLYnBzKSArIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZmV0Y2hkZWxheTonK2ZldGNoZGVsYXkpO1xuICAgIC8vIGZpbmQgYnVmZmVyIHJhbmdlIHRoYXQgd2lsbCBiZSByZWFjaGVkIG9uY2UgbmV3IGZyYWdtZW50IHdpbGwgYmUgZmV0Y2hlZFxuICAgIG5leHRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSArIGZldGNoZGVsYXkpO1xuICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgICAgLy8gZmx1c2ggcG9zaXRpb24gaXMgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoaXMgbmV3IGJ1ZmZlclxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZE9mZnNldDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgICAgIC8vIGlmIHdlIGFyZSBoZXJlLCB3ZSBjYW4gYWxzbyBjYW5jZWwgYW55IGxvYWRpbmcvZGVtdXhpbmcgaW4gcHJvZ3Jlc3MsIGFzIHRoZXkgYXJlIHVzZWxlc3NcbiAgICAgICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgICAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYUF0dGFjaGVkKGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9uTWVkaWFTZWVraW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9uTWVkaWFTZWVrZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udmVuZGVkID0gdGhpcy5vbk1lZGlhRW5kZWQuYmluZCh0aGlzKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLmhscy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYgKG1lZGlhICYmIG1lZGlhLmVuZGVkKSB7XG4gICAgICBsb2dnZXIubG9nKCdNU0UgZGV0YWNoaW5nIGFuZCB2aWRlbyBlbmRlZCwgcmVzZXQgc3RhcnRQb3NpdGlvbicpO1xuICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgIH1cblxuICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWRpbmcgY291bnRlciBvbiBNU0UgZGV0YWNoaW5nIHRvIGF2b2lkIHJlcG9ydGluZyBGUkFHX0xPT1BfTE9BRElOR19FUlJPUiBhZnRlciBlcnJvciByZWNvdmVyeVxuICAgIHZhciBsZXZlbHMgPSB0aGlzLmxldmVscztcbiAgICBpZiAobGV2ZWxzKSB7XG4gICAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkIGNvdW50ZXJcbiAgICAgICAgbGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICAgIGlmKGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICAgIGxldmVsLmRldGFpbHMuZnJhZ21lbnRzLmZvckVhY2goZnJhZ21lbnQgPT4ge1xuICAgICAgICAgICAgICBmcmFnbWVudC5sb2FkQ291bnRlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJzXG4gICAgaWYgKG1lZGlhKSB7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsIHRoaXMub252c2Vla2VkKTtcbiAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCAgPSB0aGlzLm9udmVuZGVkID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgIHRoaXMuc3RvcExvYWQoKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVraW5nKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnRseSBsb2FkZWQgZnJhZ21lbnQgaXMgaW5zaWRlIGJ1ZmZlci5cbiAgICAgIC8vaWYgb3V0c2lkZSwgY2FuY2VsIGZyYWdtZW50IGxvYWRpbmcsIG90aGVyd2lzZSBkbyBub3RoaW5nXG4gICAgICBpZiAoQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odGhpcy5tZWRpYSx0aGlzLm1lZGlhLmN1cnJlbnRUaW1lLHRoaXMuY29uZmlnLm1heEJ1ZmZlckhvbGUpLmxlbiA9PT0gMCkge1xuICAgICAgICBsb2dnZXIuaW5mbygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICBpZiAoZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkVOREVEKSB7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGNoZWNrIGZvciBwb3RlbnRpYWwgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICAvLyBhdm9pZCByZXBvcnRpbmcgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIGluIGNhc2UgdXNlciBpcyBzZWVraW5nIHNldmVyYWwgdGltZXMgb24gc2FtZSBwb3NpdGlvblxuICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgZW5kZWQnKTtcbiAgICAvLyByZXNldCBzdGFydFBvc2l0aW9uIGFuZCBsYXN0Q3VycmVudFRpbWUgdG8gcmVzdGFydCBwbGF5YmFjayBAIHN0cmVhbSBiZWdpbm5pbmdcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gIH1cblxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKCkge1xuICAgIC8vIHJlc2V0IGJ1ZmZlciBvbiBtYW5pZmVzdCBsb2FkaW5nXG4gICAgbG9nZ2VyLmxvZygndHJpZ2dlciBCVUZGRVJfUkVTRVQnKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9SRVNFVCk7XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIHRoaXMuc3RhbGxlZCA9IGZhbHNlO1xuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgdmFyIGFhYyA9IGZhbHNlLCBoZWFhYyA9IGZhbHNlLCBjb2RlYztcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICBjb2RlYyA9IGxldmVsLmF1ZGlvQ29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgIGhlYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3aXRjaCA9IChhYWMgJiYgaGVhYWMpO1xuICAgIGlmICh0aGlzLmF1ZGlvQ29kZWNTd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBsZXZlbCBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLmhscy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgbmV3RGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGR1cmF0aW9uID0gbmV3RGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICBzbGlkaW5nID0gMDtcblxuICAgIGxvZ2dlci5sb2coYGxldmVsICR7bmV3TGV2ZWxJZH0gbG9hZGVkIFske25ld0RldGFpbHMuc3RhcnRTTn0sJHtuZXdEZXRhaWxzLmVuZFNOfV0sZHVyYXRpb246JHtkdXJhdGlvbn1gKTtcbiAgICB0aGlzLmxldmVsTGFzdExvYWRlZCA9IG5ld0xldmVsSWQ7XG5cbiAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgY3VyRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICBpZiAoY3VyRGV0YWlscykge1xuICAgICAgICAvLyB3ZSBhbHJlYWR5IGhhdmUgZGV0YWlscyBmb3IgdGhhdCBsZXZlbCwgbWVyZ2UgdGhlbVxuICAgICAgICBMZXZlbEhlbHBlci5tZXJnZURldGFpbHMoY3VyRGV0YWlscyxuZXdEZXRhaWxzKTtcbiAgICAgICAgc2xpZGluZyA9IG5ld0RldGFpbHMuZnJhZ21lbnRzWzBdLnN0YXJ0O1xuICAgICAgICBpZiAobmV3RGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke3NsaWRpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gb3V0ZGF0ZWQgUFRTLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gZmlyc3QgbG9hZCwgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGN1ckxldmVsLmRldGFpbHMgPSBuZXdEZXRhaWxzO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfVVBEQVRFRCwgeyBkZXRhaWxzOiBuZXdEZXRhaWxzLCBsZXZlbDogbmV3TGV2ZWxJZCB9KTtcblxuICAgIC8vIGNvbXB1dGUgc3RhcnQgcG9zaXRpb25cbiAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBzZXQgc3RhcnQgcG9zaXRpb24gdG8gYmUgZnJhZ21lbnQgTi10aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKHVzdWFsbHkgMylcbiAgICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgbGV0IHRhcmdldExhdGVuY3kgPSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uICE9PSB1bmRlZmluZWQgPyB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uIDogdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbmV3RGV0YWlscy50YXJnZXRkdXJhdGlvbjtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCwgc2xpZGluZyArIGR1cmF0aW9uIC0gdGFyZ2V0TGF0ZW5jeSk7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbktleUxvYWRlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuS0VZX0xPQURJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcgJiZcbiAgICAgICAgZnJhZ0N1cnJlbnQgJiZcbiAgICAgICAgZGF0YS5mcmFnLmxldmVsID09PSBmcmFnQ3VycmVudC5sZXZlbCAmJlxuICAgICAgICBkYXRhLmZyYWcuc24gPT09IGZyYWdDdXJyZW50LnNuKSB7XG4gICAgICBpZiAodGhpcy5mcmFnQml0cmF0ZVRlc3QgPT09IHRydWUpIHtcbiAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSAuLi4gd2UganVzdCBsb2FkZWQgYSBmcmFnbWVudCB0byBkZXRlcm1pbmUgYWRlcXVhdGUgc3RhcnQgYml0cmF0ZSBhbmQgaW5pdGlhbGl6ZSBhdXRvc3dpdGNoIGFsZ29cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID0gZmFsc2U7XG4gICAgICAgIGRhdGEuc3RhdHMudHBhcnNlZCA9IGRhdGEuc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBkYXRhLnN0YXRzLCBmcmFnOiBmcmFnQ3VycmVudH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICAgIGRldGFpbHMgPSBjdXJyZW50TGV2ZWwuZGV0YWlscyxcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICAgICAgc3RhcnQgPSBmcmFnQ3VycmVudC5zdGFydCxcbiAgICAgICAgICAgIGxldmVsID0gZnJhZ0N1cnJlbnQubGV2ZWwsXG4gICAgICAgICAgICBzbiA9IGZyYWdDdXJyZW50LnNuLFxuICAgICAgICAgICAgYXVkaW9Db2RlYyA9IGN1cnJlbnRMZXZlbC5hdWRpb0NvZGVjIHx8IHRoaXMuY29uZmlnLmRlZmF1bHRBdWRpb0NvZGVjO1xuICAgICAgICBpZih0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSB0aGlzLmxhc3RBdWRpb0NvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nID0gMDtcbiAgICAgICAgLy8gbG9nZ2VyLmxvZyhgRGVtdXhpbmcgJHtzbn0gb2YgWyR7ZGV0YWlscy5zdGFydFNOfSAsJHtkZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH1gKTtcbi8vIFx0XHR2YXIgcmUgPSAvKFxcZCspX1xcZCsudHMvO1xuLy8gXHRcdHZhciB0MCA9IDA7XG4vLyBcdFx0dmFyIG0gPSByZS5leGVjKGZyYWdDdXJyZW50LnVybCk7XG4vLyBcdFx0dmFyIHQwID0gKG0gJiYgbVsxXSkgPyBwYXJzZUludCggbVsxXSApLzEwMDAgOiAwO1xuLy9cbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLCBhdWRpb0NvZGVjLCBjdXJyZW50TGV2ZWwudmlkZW9Db2RlYywgc3RhcnQsIGZyYWdDdXJyZW50LmNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBmcmFnQ3VycmVudC5kZWNyeXB0ZGF0YSwgc3RhcnQpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSAwO1xuICB9XG5cbiAgb25GcmFnUGFyc2luZ0luaXRTZWdtZW50KGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdmFyIHRyYWNrcyA9IGRhdGEudHJhY2tzLCB0cmFja05hbWUsIHRyYWNrO1xuXG4gICAgICAvLyBpbmNsdWRlIGxldmVsQ29kZWMgaW4gYXVkaW8gYW5kIHZpZGVvIHRyYWNrc1xuICAgICAgdHJhY2sgPSB0cmFja3MuYXVkaW87XG4gICAgICBpZih0cmFjaykge1xuICAgICAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsXG4gICAgICAgICAgICB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYoYXVkaW9Db2RlYyAmJiB0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gaW4gY2FzZSBBQUMgYW5kIEhFLUFBQyBhdWRpbyBjb2RlY3MgYXJlIHNpZ25hbGxlZCBpbiBtYW5pZmVzdFxuICAgICAgICAvLyBmb3JjZSBIRS1BQUMgLCBhcyBpdCBzZWVtcyB0aGF0IG1vc3QgYnJvd3NlcnMgcHJlZmVycyB0aGF0IHdheSxcbiAgICAgICAgLy8gZXhjZXB0IGZvciBtb25vIHN0cmVhbXMgT1Igb24gRkZcbiAgICAgICAgLy8gdGhlc2UgY29uZGl0aW9ucyBtaWdodCBuZWVkIHRvIGJlIHJldmlld2VkIC4uLlxuICAgICAgICBpZiAodGhpcy5hdWRpb0NvZGVjU3dpdGNoKSB7XG4gICAgICAgICAgICAvLyBkb24ndCBmb3JjZSBIRS1BQUMgaWYgbW9ubyBzdHJlYW1cbiAgICAgICAgICAgaWYodHJhY2subWV0YWRhdGEuY2hhbm5lbENvdW50ICE9PSAxICYmXG4gICAgICAgICAgICAvLyBkb24ndCBmb3JjZSBIRS1BQUMgaWYgZmlyZWZveFxuICAgICAgICAgICAgdWEuaW5kZXhPZignZmlyZWZveCcpID09PSAtMSkge1xuICAgICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEhFLUFBQyBpcyBicm9rZW4gb24gQW5kcm9pZCwgYWx3YXlzIHNpZ25hbCBhdWRpbyBjb2RlYyBhcyBBQUMgZXZlbiBpZiB2YXJpYW50IG1hbmlmZXN0IHN0YXRlcyBvdGhlcndpc2VcbiAgICAgICAgaWYodWEuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICBsb2dnZXIubG9nKGBBbmRyb2lkOiBmb3JjZSBhdWRpbyBjb2RlYyB0b2AgKyBhdWRpb0NvZGVjKTtcbiAgICAgICAgfVxuICAgICAgICB0cmFjay5sZXZlbENvZGVjID0gYXVkaW9Db2RlYztcbiAgICAgIH1cbiAgICAgIHRyYWNrID0gdHJhY2tzLnZpZGVvO1xuICAgICAgaWYodHJhY2spIHtcbiAgICAgICAgdHJhY2subGV2ZWxDb2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWM7XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIHJlbXV4ZXIgc3BlY2lmeSB0aGF0IGEgdW5pcXVlIHRyYWNrIG5lZWRzIHRvIGdlbmVyYXRlZCxcbiAgICAgIC8vIGxldCdzIG1lcmdlIGFsbCB0cmFja3MgdG9nZXRoZXJcbiAgICAgIGlmIChkYXRhLnVuaXF1ZSkge1xuICAgICAgICB2YXIgbWVyZ2VkVHJhY2sgPSB7XG4gICAgICAgICAgICBjb2RlYyA6ICcnLFxuICAgICAgICAgICAgbGV2ZWxDb2RlYyA6ICcnXG4gICAgICAgICAgfTtcbiAgICAgICAgZm9yICh0cmFja05hbWUgaW4gZGF0YS50cmFja3MpIHtcbiAgICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICAgIG1lcmdlZFRyYWNrLmNvbnRhaW5lciA9IHRyYWNrLmNvbnRhaW5lcjtcbiAgICAgICAgICBpZiAobWVyZ2VkVHJhY2suY29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmNvZGVjICs9ICAnLCc7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5sZXZlbENvZGVjICs9ICAnLCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKHRyYWNrLmNvZGVjKSB7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5jb2RlYyArPSAgdHJhY2suY29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0cmFjay5sZXZlbENvZGVjKSB7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5sZXZlbENvZGVjICs9ICB0cmFjay5sZXZlbENvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0cmFja3MgPSB7IGF1ZGlvdmlkZW8gOiBtZXJnZWRUcmFjayB9O1xuICAgICAgfVxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQ09ERUNTLHRyYWNrcyk7XG4gICAgICAvLyBsb29wIHRocm91Z2ggdHJhY2tzIHRoYXQgYXJlIGdvaW5nIHRvIGJlIHByb3ZpZGVkIHRvIGJ1ZmZlckNvbnRyb2xsZXJcbiAgICAgIGZvciAodHJhY2tOYW1lIGluIHRyYWNrcykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICBsb2dnZXIubG9nKGB0cmFjazoke3RyYWNrTmFtZX0sY29udGFpbmVyOiR7dHJhY2suY29udGFpbmVyfSxjb2RlY3NbbGV2ZWwvcGFyc2VkXT1bJHt0cmFjay5sZXZlbENvZGVjfS8ke3RyYWNrLmNvZGVjfV1gKTtcbiAgICAgICAgdmFyIGluaXRTZWdtZW50ID0gdHJhY2suaW5pdFNlZ21lbnQ7XG4gICAgICAgIGlmIChpbml0U2VnbWVudCkge1xuICAgICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZysrO1xuICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVORElORywge3R5cGU6IHRyYWNrTmFtZSwgZGF0YTogaW5pdFNlZ21lbnR9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nRGF0YShkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMudHBhcnNlMiA9IERhdGUubm93KCk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcblxuICAgICAgbG9nZ2VyLmluZm8oYHBhcnNlZCAke2RhdGEudHlwZX0sUFRTOlske2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0sJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfV0sRFRTOlske2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfV0sbmI6JHtkYXRhLm5ifWApO1xuXG4gICAgICB2YXIgZHJpZnQgPSBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKGxldmVsLmRldGFpbHMsZnJhZy5zbixkYXRhLnN0YXJ0UFRTLGRhdGEuZW5kUFRTKSxcbiAgICAgICAgICBobHMgPSB0aGlzLmhscztcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1BUU19VUERBVEVELCB7ZGV0YWlsczogbGV2ZWwuZGV0YWlscywgbGV2ZWw6IHRoaXMubGV2ZWwsIGRyaWZ0OiBkcmlmdH0pO1xuXG4gICAgICBbZGF0YS5kYXRhMSwgZGF0YS5kYXRhMl0uZm9yRWFjaChidWZmZXIgPT4ge1xuICAgICAgICBpZiAoYnVmZmVyKSB7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nKys7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVORElORywge3R5cGU6IGRhdGEudHlwZSwgZGF0YTogYnVmZmVyfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSBkYXRhLmVuZFBUUztcbiAgICAgIHRoaXMuYnVmZmVyUmFuZ2UucHVzaCh7dHlwZTogZGF0YS50eXBlLCBzdGFydDogZGF0YS5zdGFydFBUUywgZW5kOiBkYXRhLmVuZFBUUywgZnJhZzogZnJhZ30pO1xuXG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2Fybihgbm90IGluIFBBUlNJTkcgc3RhdGUgYnV0ICR7dGhpcy5zdGF0ZX0sIGlnbm9yaW5nIEZSQUdfUEFSU0lOR19EQVRBIGV2ZW50YCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnUGFyc2VkKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTRUQ7XG4gICAgICB0aGlzLl9jaGVja0FwcGVuZGVkUGFyc2VkKCk7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRlZCgpIHtcbiAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0lORzpcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0VEOlxuICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmctLTtcbiAgICAgICAgdGhpcy5fY2hlY2tBcHBlbmRlZFBhcnNlZCgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIF9jaGVja0FwcGVuZGVkUGFyc2VkKCkge1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTRUQgJiYgdGhpcy5wZW5kaW5nQXBwZW5kaW5nID09PSAwKSAge1xuICAgICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50LCBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgICBpZiAoZnJhZykge1xuICAgICAgICB0aGlzLmZyYWdQcmV2aW91cyA9IGZyYWc7XG4gICAgICAgIHN0YXRzLnRidWZmZXJlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLmZyYWdMYXN0S2JwcyA9IE1hdGgucm91bmQoOCAqIHN0YXRzLmxlbmd0aCAvIChzdGF0cy50YnVmZmVyZWQgLSBzdGF0cy50Zmlyc3QpKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IHN0YXRzLCBmcmFnOiBmcmFnfSk7XG5cdFx0Ly8gY29uc29sZS5pbmZvKHN0YXRzKTtcblx0XHQvLyBjb25zb2xlLmluZm8oZnJhZyk7XG4gICAgICAgIGxvZ2dlci5pbmZvKGBtZWRpYSBidWZmZXJlZCA6ICR7dGhpcy50aW1lUmFuZ2VzVG9TdHJpbmcodGhpcy5tZWRpYS5idWZmZXJlZCl9YCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGlmKCFkYXRhLmZhdGFsKSB7XG4gICAgICAgICAgdmFyIGxvYWRFcnJvciA9IHRoaXMuZnJhZ0xvYWRFcnJvcjtcbiAgICAgICAgICBpZihsb2FkRXJyb3IpIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcisrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkRXJyb3I9MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGxvYWRFcnJvciA8PSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5KSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSBsb2FkRXJyb3I7XG4gICAgICAgICAgICAvLyByZXNldCBsb2FkIGNvdW50ZXIgdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3JcbiAgICAgICAgICAgIGRhdGEuZnJhZy5sb2FkQ291bnRlciA9IDA7XG4gICAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmIGNhcHBlZCB0byA2NHNcbiAgICAgICAgICAgIHZhciBkZWxheSA9IE1hdGgubWluKE1hdGgucG93KDIsbG9hZEVycm9yLTEpKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiBmcmFnIGxvYWRpbmcgZmFpbGVkLCByZXRyeSBpbiAke2RlbGF5fSBtc2ApO1xuICAgICAgICAgICAgdGhpcy5yZXRyeURhdGUgPSBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5O1xuICAgICAgICAgICAgLy8gcmV0cnkgbG9hZGluZyBzdGF0ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHJlYWNoZXMgbWF4IHJldHJ5LCByZWRpc3BhdGNoIGFzIGZhdGFsIC4uLmApO1xuICAgICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGRhdGEpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IFN0YXRlLkVSUk9SIDogU3RhdGUuSURMRTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5CVUZGRVJfRlVMTF9FUlJPUjpcbiAgICAgICAgLy8gdHJpZ2dlciBhIHNtb290aCBsZXZlbCBzd2l0Y2ggdG8gZW1wdHkgYnVmZmVyc1xuICAgICAgICAvLyBhbHNvIHJlZHVjZSBtYXggYnVmZmVyIGxlbmd0aCBhcyBpdCBtaWdodCBiZSB0b28gaGlnaC4gd2UgZG8gdGhpcyB0byBhdm9pZCBsb29wIGZsdXNoaW5nIC4uLlxuICAgICAgICB0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgvPTI7XG4gICAgICAgIGxvZ2dlci53YXJuKGByZWR1Y2UgbWF4IGJ1ZmZlciBsZW5ndGggdG8gJHt0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGh9cyBhbmQgdHJpZ2dlciBhIG5leHRMZXZlbFN3aXRjaCB0byBmbHVzaCBvbGQgYnVmZmVyIGFuZCBmaXggUXVvdGFFeGNlZWRlZEVycm9yYCk7XG4gICAgICAgIHRoaXMubmV4dExldmVsU3dpdGNoKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbl9jaGVja0J1ZmZlcigpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmKG1lZGlhKSB7XG4gICAgICAvLyBjb21wYXJlIHJlYWR5U3RhdGVcbiAgICAgIHZhciByZWFkeVN0YXRlID0gbWVkaWEucmVhZHlTdGF0ZTtcbiAgICAgIC8vIGlmIHJlYWR5IHN0YXRlIGRpZmZlcmVudCBmcm9tIEhBVkVfTk9USElORyAobnVtZXJpYyB2YWx1ZSAwKSwgd2UgYXJlIGFsbG93ZWQgdG8gc2Vla1xuICAgICAgaWYocmVhZHlTdGF0ZSkge1xuICAgICAgICB2YXIgdGFyZ2V0U2Vla1Bvc2l0aW9uLCBjdXJyZW50VGltZTtcbiAgICAgICAgLy8gaWYgc2VlayBhZnRlciBidWZmZXJlZCBkZWZpbmVkLCBsZXQncyBzZWVrIGlmIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgIHZhciBzZWVrQWZ0ZXJCdWZmZXJlZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgIGlmKHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgaWYobWVkaWEuZHVyYXRpb24gPj0gc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICAgIHRhcmdldFNlZWtQb3NpdGlvbiA9IHNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3VycmVudFRpbWUgPSBtZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgICB2YXIgbG9hZGVkbWV0YWRhdGEgPSB0aGlzLmxvYWRlZG1ldGFkYXRhO1xuXG4gICAgICAgICAgLy8gYWRqdXN0IGN1cnJlbnRUaW1lIHRvIHN0YXJ0IHBvc2l0aW9uIG9uIGxvYWRlZCBtZXRhZGF0YVxuICAgICAgICAgIGlmKCFsb2FkZWRtZXRhZGF0YSAmJiBtZWRpYS5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgICAgICAgICAgLy8gb25seSBhZGp1c3QgY3VycmVudFRpbWUgaWYgbm90IGVxdWFsIHRvIDBcbiAgICAgICAgICAgIGlmICghY3VycmVudFRpbWUgJiYgY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgICAgICAgICB0YXJnZXRTZWVrUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0YXJnZXRTZWVrUG9zaXRpb24pIHtcblxuICAgICAgICAgIC8vIGFkanVzdCBxdWljayBsb2FkIHNlZWsgcG9zaXRpb24gaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgaWYgKHRoaXMuaW5pdGlhbF9zZWVrKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5pbmZvKCdhZGp1c3RpbmcgaW5pdGlhbCBzZWVrOiBiZWZvcmUvYWZ0ZXI6ICcgKyB0YXJnZXRTZWVrUG9zaXRpb24gKyAnIC8gJyArIHRoaXMuaW5pdGlhbF9zZWVrKTtcbiAgICAgICAgICAgICAgdGFyZ2V0U2Vla1Bvc2l0aW9uID0gdGhpcy5pbml0aWFsX3NlZWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY3VycmVudFRpbWUgPSB0YXJnZXRTZWVrUG9zaXRpb247XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgdGFyZ2V0IHNlZWsgcG9zaXRpb246JHt0YXJnZXRTZWVrUG9zaXRpb259YCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSBCdWZmZXJIZWxwZXIuYnVmZmVySW5mbyhtZWRpYSxjdXJyZW50VGltZSwwKSxcbiAgICAgICAgICAgIGV4cGVjdGVkUGxheWluZyA9ICEobWVkaWEucGF1c2VkIHx8IG1lZGlhLmVuZGVkIHx8IG1lZGlhLnNlZWtpbmcgfHwgcmVhZHlTdGF0ZSA8IDIpLFxuICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDAuNCwgLy8gdG9sZXJhbmNlIG5lZWRlZCBhcyBzb21lIGJyb3dzZXJzIHN0YWxscyBwbGF5YmFjayBiZWZvcmUgcmVhY2hpbmcgYnVmZmVyZWQgcmFuZ2UgZW5kXG4gICAgICAgICAgICBwbGF5aGVhZE1vdmluZyA9IGN1cnJlbnRUaW1lID4gbWVkaWEucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lO1xuXG4gICAgICAgIGlmICh0aGlzLnN0YWxsZWQgJiYgcGxheWhlYWRNb3ZpbmcpIHtcbiAgICAgICAgICB0aGlzLnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBwbGF5YmFjayBub3Qgc3R1Y2sgYW55bW9yZSBAJHtjdXJyZW50VGltZX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjaGVjayBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiBsZXNzIHRoYW4gMjAwbXMgaXMgYnVmZmVyZWQsIGFuZCBtZWRpYSBpcyBleHBlY3RlZCB0byBwbGF5IGJ1dCBwbGF5aGVhZCBpcyBub3QgbW92aW5nLFxuICAgICAgICAvLyBhbmQgd2UgaGF2ZSBhIG5ldyBidWZmZXIgcmFuZ2UgYXZhaWxhYmxlIHVwZnJvbnQsIGxldCdzIHNlZWsgdG8gdGhhdCBvbmVcbiAgICAgICAgaWYoYnVmZmVySW5mby5sZW4gPD0ganVtcFRocmVzaG9sZCkge1xuICAgICAgICAgIGlmKHBsYXloZWFkTW92aW5nIHx8ICFleHBlY3RlZFBsYXlpbmcpIHtcbiAgICAgICAgICAgIC8vIHBsYXloZWFkIG1vdmluZyBvciBtZWRpYSBub3QgcGxheWluZ1xuICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHBsYXloZWFkIG5vdCBtb3ZpbmcgQU5EIG1lZGlhIGV4cGVjdGVkIHRvIHBsYXlcbiAgICAgICAgICAgIGlmKCF0aGlzLnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgcGxheWJhY2sgc2VlbXMgc3R1Y2sgQCR7Y3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX1NUQUxMRURfRVJST1IsIGZhdGFsOiBmYWxzZX0pO1xuICAgICAgICAgICAgICB0aGlzLnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpZiB3ZSBhcmUgYmVsb3cgdGhyZXNob2xkLCB0cnkgdG8ganVtcCBpZiBuZXh0IGJ1ZmZlciByYW5nZSBpcyBjbG9zZVxuICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgIC8vIG5vIGJ1ZmZlciBhdmFpbGFibGUgQCBjdXJyZW50VGltZSwgY2hlY2sgaWYgbmV4dCBidWZmZXIgaXMgY2xvc2UgKHdpdGhpbiBhIGNvbmZpZy5tYXhTZWVrSG9sZSBzZWNvbmQgcmFuZ2UpXG4gICAgICAgICAgICB2YXIgbmV4dEJ1ZmZlclN0YXJ0ID0gYnVmZmVySW5mby5uZXh0U3RhcnQsIGRlbHRhID0gbmV4dEJ1ZmZlclN0YXJ0LWN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgaWYobmV4dEJ1ZmZlclN0YXJ0ICYmXG4gICAgICAgICAgICAgICAoZGVsdGEgPCB0aGlzLmNvbmZpZy5tYXhTZWVrSG9sZSkgJiZcbiAgICAgICAgICAgICAgIChkZWx0YSA+IDApICAmJlxuICAgICAgICAgICAgICAgIW1lZGlhLnNlZWtpbmcpIHtcbiAgICAgICAgICAgICAgLy8gbmV4dCBidWZmZXIgaXMgY2xvc2UgISBhZGp1c3QgY3VycmVudFRpbWUgdG8gbmV4dEJ1ZmZlclN0YXJ0XG4gICAgICAgICAgICAgIC8vIHRoaXMgd2lsbCBlbnN1cmUgZWZmZWN0aXZlIHZpZGVvIGRlY29kaW5nXG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7bWVkaWEuY3VycmVudFRpbWV9IHRvIG5leHQgYnVmZmVyZWQgQCAke25leHRCdWZmZXJTdGFydH1gKTtcbiAgICAgICAgICAgICAgbWVkaWEuY3VycmVudFRpbWUgPSBuZXh0QnVmZmVyU3RhcnQ7XG4gICAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX1NFRUtfT1ZFUl9IT0xFLCBmYXRhbDogZmFsc2V9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHRhcmdldFNlZWtQb3NpdGlvbiAmJiBtZWRpYS5jdXJyZW50VGltZSAhPT0gdGFyZ2V0U2Vla1Bvc2l0aW9uKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGBhZGp1c3QgY3VycmVudFRpbWUgZnJvbSAke21lZGlhLmN1cnJlbnRUaW1lfSB0byAke3RhcmdldFNlZWtQb3NpdGlvbn1gKTtcbiAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gdGFyZ2V0U2Vla1Bvc2l0aW9uO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkKCkge1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25CdWZmZXJGbHVzaGVkKCkge1xuICAgIC8qIGFmdGVyIHN1Y2Nlc3NmdWwgYnVmZmVyIGZsdXNoaW5nLCByZWJ1aWxkIGJ1ZmZlciBSYW5nZSBhcnJheVxuICAgICAgbG9vcCB0aHJvdWdoIGV4aXN0aW5nIGJ1ZmZlciByYW5nZSBhbmQgY2hlY2sgaWZcbiAgICAgIGNvcnJlc3BvbmRpbmcgcmFuZ2UgaXMgc3RpbGwgYnVmZmVyZWQuIG9ubHkgcHVzaCB0byBuZXcgYXJyYXkgYWxyZWFkeSBidWZmZXJlZCByYW5nZVxuICAgICovXG4gICAgdmFyIG5ld1JhbmdlID0gW10scmFuZ2UsaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5idWZmZXJSYW5nZS5sZW5ndGg7IGkrKykge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZCgocmFuZ2Uuc3RhcnQgKyByYW5nZS5lbmQpIC8gMikpIHtcbiAgICAgICAgbmV3UmFuZ2UucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBuZXdSYW5nZTtcblxuICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICBpZiAodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgIHRoaXMuaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKTtcbiAgICB9XG4gICAgLy8gbW92ZSB0byBJRExFIG9uY2UgZmx1c2ggY29tcGxldGUuIHRoaXMgc2hvdWxkIHRyaWdnZXIgbmV3IGZyYWdtZW50IGxvYWRpbmdcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAvLyByZXNldCByZWZlcmVuY2UgdG8gZnJhZ1xuICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgfVxuXG4gIHN3YXBBdWRpb0NvZGVjKCkge1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSAhdGhpcy5hdWRpb0NvZGVjU3dhcDtcbiAgfVxuXG4gIHRpbWVSYW5nZXNUb1N0cmluZyhyKSB7XG4gICAgdmFyIGxvZyA9ICcnLCBsZW4gPSByLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcbiAgICAgIGxvZyArPSAnWycgKyByLnN0YXJ0KGkpICsgJywnICsgci5lbmQoaSkgKyAnXSc7XG4gICAgfVxuICAgIHJldHVybiBsb2c7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbUNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBUaW1lbGluZSBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQgQ0VBNzA4SW50ZXJwcmV0ZXIgZnJvbSAnLi4vdXRpbHMvY2VhLTcwOC1pbnRlcnByZXRlcic7XG5cbmNsYXNzIFRpbWVsaW5lQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5NRURJQV9BVFRBQ0hJTkcsXG4gICAgICAgICAgICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSxcbiAgICAgICAgICAgICAgICBFdmVudC5NQU5JRkVTVF9MT0FESU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BREVEKTtcblxuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcblxuICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVDRUE3MDhDYXB0aW9ucylcbiAgICB7XG4gICAgICB0aGlzLmNlYTcwOEludGVycHJldGVyID0gbmV3IENFQTcwOEludGVycHJldGVyKCk7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuYXR0YWNoKG1lZGlhKTtcbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5kZXRhY2goKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKClcbiAge1xuICAgIHRoaXMubGFzdFB0cyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZChkYXRhKVxuICB7XG4gICAgdmFyIHB0cyA9IGRhdGEuZnJhZy5zdGFydDsgLy9OdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgICAvLyBpZiB0aGlzIGlzIGEgZnJhZyBmb3IgYSBwcmV2aW91c2x5IGxvYWRlZCB0aW1lcmFuZ2UsIHJlbW92ZSBhbGwgY2FwdGlvbnNcbiAgICAvLyBUT0RPOiBjb25zaWRlciBqdXN0IHJlbW92aW5nIGNhcHRpb25zIGZvciB0aGUgdGltZXJhbmdlXG4gICAgaWYgKHB0cyA8PSB0aGlzLmxhc3RQdHMpXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5jbGVhcigpO1xuICAgIH1cblxuICAgIHRoaXMubGFzdFB0cyA9IHB0cztcbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdVc2VyZGF0YShkYXRhKSB7XG4gICAgLy8gcHVzaCBhbGwgb2YgdGhlIENFQS03MDggbWVzc2FnZXMgaW50byB0aGUgaW50ZXJwcmV0ZXJcbiAgICAvLyBpbW1lZGlhdGVseS4gSXQgd2lsbCBjcmVhdGUgdGhlIHByb3BlciB0aW1lc3RhbXBzIGJhc2VkIG9uIG91ciBQVFMgdmFsdWVcbiAgICBmb3IgKHZhciBpPTA7IGk8ZGF0YS5zYW1wbGVzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIucHVzaChkYXRhLnNhbXBsZXNbaV0ucHRzLCBkYXRhLnNhbXBsZXNbaV0uYnl0ZXMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUaW1lbGluZUNvbnRyb2xsZXI7XG4iLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuY2xhc3MgQUVTIHtcblxuICAvKipcbiAgICogU2NoZWR1bGUgb3V0IGFuIEFFUyBrZXkgZm9yIGJvdGggZW5jcnlwdGlvbiBhbmQgZGVjcnlwdGlvbi4gVGhpc1xuICAgKiBpcyBhIGxvdy1sZXZlbCBjbGFzcy4gVXNlIGEgY2lwaGVyIG1vZGUgdG8gZG8gYnVsayBlbmNyeXB0aW9uLlxuICAgKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIGtleSB7QXJyYXl9IFRoZSBrZXkgYXMgYW4gYXJyYXkgb2YgNCwgNiBvciA4IHdvcmRzLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioa2V5KSB7XG4gICAgLyoqXG4gICAgICogVGhlIGV4cGFuZGVkIFMtYm94IGFuZCBpbnZlcnNlIFMtYm94IHRhYmxlcy4gVGhlc2Ugd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIG9uIHRoZSBjbGllbnQgc28gdGhhdCB3ZSBkb24ndCBoYXZlIHRvIHNlbmQgdGhlbSBkb3duIHRoZSB3aXJlLlxuICAgICAqXG4gICAgICogVGhlcmUgYXJlIHR3byB0YWJsZXMsIF90YWJsZXNbMF0gaXMgZm9yIGVuY3J5cHRpb24gYW5kXG4gICAgICogX3RhYmxlc1sxXSBpcyBmb3IgZGVjcnlwdGlvbi5cbiAgICAgKlxuICAgICAqIFRoZSBmaXJzdCA0IHN1Yi10YWJsZXMgYXJlIHRoZSBleHBhbmRlZCBTLWJveCB3aXRoIE1peENvbHVtbnMuIFRoZVxuICAgICAqIGxhc3QgKF90YWJsZXNbMDFdWzRdKSBpcyB0aGUgUy1ib3ggaXRzZWxmLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl90YWJsZXMgPSBbW1tdLFtdLFtdLFtdLFtdXSxbW10sW10sW10sW10sW11dXTtcblxuICAgIHRoaXMuX3ByZWNvbXB1dGUoKTtcblxuICAgIHZhciBpLCBqLCB0bXAsXG4gICAgZW5jS2V5LCBkZWNLZXksXG4gICAgc2JveCA9IHRoaXMuX3RhYmxlc1swXVs0XSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAga2V5TGVuID0ga2V5Lmxlbmd0aCwgcmNvbiA9IDE7XG5cbiAgICBpZiAoa2V5TGVuICE9PSA0ICYmIGtleUxlbiAhPT0gNiAmJiBrZXlMZW4gIT09IDgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhZXMga2V5IHNpemU9JyArIGtleUxlbik7XG4gICAgfVxuXG4gICAgZW5jS2V5ID0ga2V5LnNsaWNlKDApO1xuICAgIGRlY0tleSA9IFtdO1xuICAgIHRoaXMuX2tleSA9IFtlbmNLZXksIGRlY0tleV07XG5cbiAgICAvLyBzY2hlZHVsZSBlbmNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGkgPSBrZXlMZW47IGkgPCA0ICoga2V5TGVuICsgMjg7IGkrKykge1xuICAgICAgdG1wID0gZW5jS2V5W2ktMV07XG5cbiAgICAgIC8vIGFwcGx5IHNib3hcbiAgICAgIGlmIChpJWtleUxlbiA9PT0gMCB8fCAoa2V5TGVuID09PSA4ICYmIGkla2V5TGVuID09PSA0KSkge1xuICAgICAgICB0bXAgPSBzYm94W3RtcD4+PjI0XTw8MjQgXiBzYm94W3RtcD4+MTYmMjU1XTw8MTYgXiBzYm94W3RtcD4+OCYyNTVdPDw4IF4gc2JveFt0bXAmMjU1XTtcblxuICAgICAgICAvLyBzaGlmdCByb3dzIGFuZCBhZGQgcmNvblxuICAgICAgICBpZiAoaSVrZXlMZW4gPT09IDApIHtcbiAgICAgICAgICB0bXAgPSB0bXA8PDggXiB0bXA+Pj4yNCBeIHJjb248PDI0O1xuICAgICAgICAgIHJjb24gPSByY29uPDwxIF4gKHJjb24+PjcpKjI4MztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlbmNLZXlbaV0gPSBlbmNLZXlbaS1rZXlMZW5dIF4gdG1wO1xuICAgIH1cblxuICAgIC8vIHNjaGVkdWxlIGRlY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaiA9IDA7IGk7IGorKywgaS0tKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaiYzID8gaSA6IGkgLSA0XTtcbiAgICAgIGlmIChpPD00IHx8IGo8NCkge1xuICAgICAgICBkZWNLZXlbal0gPSB0bXA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWNLZXlbal0gPSBkZWNUYWJsZVswXVtzYm94W3RtcD4+PjI0ICAgICAgXV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzFdW3Nib3hbdG1wPj4xNiAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMl1bc2JveFt0bXA+PjggICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVszXVtzYm94W3RtcCAgICAgICYgMjU1XV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4cGFuZCB0aGUgUy1ib3ggdGFibGVzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3ByZWNvbXB1dGUoKSB7XG4gICAgdmFyIGVuY1RhYmxlID0gdGhpcy5fdGFibGVzWzBdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBzYm94ID0gZW5jVGFibGVbNF0sIHNib3hJbnYgPSBkZWNUYWJsZVs0XSxcbiAgICBpLCB4LCB4SW52LCBkPVtdLCB0aD1bXSwgeDIsIHg0LCB4OCwgcywgdEVuYywgdERlYztcblxuICAgIC8vIENvbXB1dGUgZG91YmxlIGFuZCB0aGlyZCB0YWJsZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgMjU2OyBpKyspIHtcbiAgICAgIHRoWyggZFtpXSA9IGk8PDEgXiAoaT4+NykqMjgzICleaV09aTtcbiAgICB9XG5cbiAgICBmb3IgKHggPSB4SW52ID0gMDsgIXNib3hbeF07IHggXj0geDIgfHwgMSwgeEludiA9IHRoW3hJbnZdIHx8IDEpIHtcbiAgICAgIC8vIENvbXB1dGUgc2JveFxuICAgICAgcyA9IHhJbnYgXiB4SW52PDwxIF4geEludjw8MiBeIHhJbnY8PDMgXiB4SW52PDw0O1xuICAgICAgcyA9IHM+PjggXiBzJjI1NSBeIDk5O1xuICAgICAgc2JveFt4XSA9IHM7XG4gICAgICBzYm94SW52W3NdID0geDtcblxuICAgICAgLy8gQ29tcHV0ZSBNaXhDb2x1bW5zXG4gICAgICB4OCA9IGRbeDQgPSBkW3gyID0gZFt4XV1dO1xuICAgICAgdERlYyA9IHg4KjB4MTAxMDEwMSBeIHg0KjB4MTAwMDEgXiB4MioweDEwMSBeIHgqMHgxMDEwMTAwO1xuICAgICAgdEVuYyA9IGRbc10qMHgxMDEgXiBzKjB4MTAxMDEwMDtcblxuICAgICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICBlbmNUYWJsZVtpXVt4XSA9IHRFbmMgPSB0RW5jPDwyNCBeIHRFbmM+Pj44O1xuICAgICAgICBkZWNUYWJsZVtpXVtzXSA9IHREZWMgPSB0RGVjPDwyNCBeIHREZWM+Pj44O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbXBhY3RpZnkuIENvbnNpZGVyYWJsZSBzcGVlZHVwIG9uIEZpcmVmb3guXG4gICAgZm9yIChpID0gMDsgaSA8IDU7IGkrKykge1xuICAgICAgZW5jVGFibGVbaV0gPSBlbmNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICAgIGRlY1RhYmxlW2ldID0gZGVjVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERlY3J5cHQgMTYgYnl0ZXMsIHNwZWNpZmllZCBhcyBmb3VyIDMyLWJpdCB3b3Jkcy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZDAge251bWJlcn0gdGhlIGZpcnN0IHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMSB7bnVtYmVyfSB0aGUgc2Vjb25kIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMiB7bnVtYmVyfSB0aGUgdGhpcmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQzIHtudW1iZXJ9IHRoZSBmb3VydGggd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBvdXQge0ludDMyQXJyYXl9IHRoZSBhcnJheSB0byB3cml0ZSB0aGUgZGVjcnlwdGVkIHdvcmRzXG4gICAqIGludG9cbiAgICogQHBhcmFtIG9mZnNldCB7bnVtYmVyfSB0aGUgb2Zmc2V0IGludG8gdGhlIG91dHB1dCBhcnJheSB0byBzdGFydFxuICAgKiB3cml0aW5nIHJlc3VsdHNcbiAgICogQHJldHVybiB7QXJyYXl9IFRoZSBwbGFpbnRleHQuXG4gICAqL1xuICBkZWNyeXB0KGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsIG91dCwgb2Zmc2V0KSB7XG4gICAgdmFyIGtleSA9IHRoaXMuX2tleVsxXSxcbiAgICAvLyBzdGF0ZSB2YXJpYWJsZXMgYSxiLGMsZCBhcmUgbG9hZGVkIHdpdGggcHJlLXdoaXRlbmVkIGRhdGFcbiAgICBhID0gZW5jcnlwdGVkMCBeIGtleVswXSxcbiAgICBiID0gZW5jcnlwdGVkMyBeIGtleVsxXSxcbiAgICBjID0gZW5jcnlwdGVkMiBeIGtleVsyXSxcbiAgICBkID0gZW5jcnlwdGVkMSBeIGtleVszXSxcbiAgICBhMiwgYjIsIGMyLFxuXG4gICAgbklubmVyUm91bmRzID0ga2V5Lmxlbmd0aCAvIDQgLSAyLCAvLyBrZXkubGVuZ3RoID09PSAyID9cbiAgICBpLFxuICAgIGtJbmRleCA9IDQsXG4gICAgdGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG5cbiAgICAvLyBsb2FkIHVwIHRoZSB0YWJsZXNcbiAgICB0YWJsZTAgICAgPSB0YWJsZVswXSxcbiAgICB0YWJsZTEgICAgPSB0YWJsZVsxXSxcbiAgICB0YWJsZTIgICAgPSB0YWJsZVsyXSxcbiAgICB0YWJsZTMgICAgPSB0YWJsZVszXSxcbiAgICBzYm94ICA9IHRhYmxlWzRdO1xuXG4gICAgLy8gSW5uZXIgcm91bmRzLiBDcmliYmVkIGZyb20gT3BlblNTTC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbklubmVyUm91bmRzOyBpKyspIHtcbiAgICAgIGEyID0gdGFibGUwW2E+Pj4yNF0gXiB0YWJsZTFbYj4+MTYgJiAyNTVdIF4gdGFibGUyW2M+PjggJiAyNTVdIF4gdGFibGUzW2QgJiAyNTVdIF4ga2V5W2tJbmRleF07XG4gICAgICBiMiA9IHRhYmxlMFtiPj4+MjRdIF4gdGFibGUxW2M+PjE2ICYgMjU1XSBeIHRhYmxlMltkPj44ICYgMjU1XSBeIHRhYmxlM1thICYgMjU1XSBeIGtleVtrSW5kZXggKyAxXTtcbiAgICAgIGMyID0gdGFibGUwW2M+Pj4yNF0gXiB0YWJsZTFbZD4+MTYgJiAyNTVdIF4gdGFibGUyW2E+PjggJiAyNTVdIF4gdGFibGUzW2IgJiAyNTVdIF4ga2V5W2tJbmRleCArIDJdO1xuICAgICAgZCAgPSB0YWJsZTBbZD4+PjI0XSBeIHRhYmxlMVthPj4xNiAmIDI1NV0gXiB0YWJsZTJbYj4+OCAmIDI1NV0gXiB0YWJsZTNbYyAmIDI1NV0gXiBrZXlba0luZGV4ICsgM107XG4gICAgICBrSW5kZXggKz0gNDtcbiAgICAgIGE9YTI7IGI9YjI7IGM9YzI7XG4gICAgfVxuXG4gICAgLy8gTGFzdCByb3VuZC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICBvdXRbKDMgJiAtaSkgKyBvZmZzZXRdID1cbiAgICAgICAgc2JveFthPj4+MjQgICAgICBdPDwyNCBeXG4gICAgICAgIHNib3hbYj4+MTYgICYgMjU1XTw8MTYgXlxuICAgICAgICBzYm94W2M+PjggICAmIDI1NV08PDggIF5cbiAgICAgICAgc2JveFtkICAgICAgJiAyNTVdICAgICBeXG4gICAgICAgIGtleVtrSW5kZXgrK107XG4gICAgICBhMj1hOyBhPWI7IGI9YzsgYz1kOyBkPWEyO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRVM7XG4iLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuXG5pbXBvcnQgQUVTIGZyb20gJy4vYWVzJztcblxuY2xhc3MgQUVTMTI4RGVjcnlwdGVyIHtcblxuICBjb25zdHJ1Y3RvcihrZXksIGluaXRWZWN0b3IpIHtcbiAgICB0aGlzLmtleSA9IGtleTtcbiAgICB0aGlzLml2ID0gaW5pdFZlY3RvcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IG5ldHdvcmstb3JkZXIgKGJpZy1lbmRpYW4pIGJ5dGVzIGludG8gdGhlaXIgbGl0dGxlLWVuZGlhblxuICAgKiByZXByZXNlbnRhdGlvbi5cbiAgICovXG4gIG50b2god29yZCkge1xuICAgIHJldHVybiAod29yZCA8PCAyNCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwKSA8PCA4KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDAwMCkgPj4gOCkgfFxuICAgICAgKHdvcmQgPj4+IDI0KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERlY3J5cHQgYnl0ZXMgdXNpbmcgQUVTLTEyOCB3aXRoIENCQyBhbmQgUEtDUyM3IHBhZGRpbmcuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQge1VpbnQ4QXJyYXl9IHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICogQHBhcmFtIGtleSB7VWludDMyQXJyYXl9IHRoZSBieXRlcyBvZiB0aGUgZGVjcnlwdGlvbiBrZXlcbiAgICogQHBhcmFtIGluaXRWZWN0b3Ige1VpbnQzMkFycmF5fSB0aGUgaW5pdGlhbGl6YXRpb24gdmVjdG9yIChJVikgdG9cbiAgICogdXNlIGZvciB0aGUgZmlyc3Qgcm91bmQgb2YgQ0JDLlxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgZGVjcnlwdGVkIGJ5dGVzXG4gICAqXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BZHZhbmNlZF9FbmNyeXB0aW9uX1N0YW5kYXJkXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CbG9ja19jaXBoZXJfbW9kZV9vZl9vcGVyYXRpb24jQ2lwaGVyX0Jsb2NrX0NoYWluaW5nXy4yOENCQy4yOVxuICAgKiBAc2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMzE1XG4gICAqL1xuICBkb0RlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IpIHtcbiAgICB2YXJcbiAgICAgIC8vIHdvcmQtbGV2ZWwgYWNjZXNzIHRvIHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkLmJ1ZmZlciwgZW5jcnlwdGVkLmJ5dGVPZmZzZXQsIGVuY3J5cHRlZC5ieXRlTGVuZ3RoID4+IDIpLFxuXG4gICAgZGVjaXBoZXIgPSBuZXcgQUVTKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGtleSkpLFxuXG4gICAgLy8gYnl0ZSBhbmQgd29yZC1sZXZlbCBhY2Nlc3MgZm9yIHRoZSBkZWNyeXB0ZWQgb3V0cHV0XG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGRlY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZGVjcnlwdGVkLmJ1ZmZlciksXG5cbiAgICAvLyB0ZW1wb3JhcnkgdmFyaWFibGVzIGZvciB3b3JraW5nIHdpdGggdGhlIElWLCBlbmNyeXB0ZWQsIGFuZFxuICAgIC8vIGRlY3J5cHRlZCBkYXRhXG4gICAgaW5pdDAsIGluaXQxLCBpbml0MiwgaW5pdDMsXG4gICAgZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMyxcblxuICAgIC8vIGl0ZXJhdGlvbiB2YXJpYWJsZVxuICAgIHdvcmRJeDtcblxuICAgIC8vIHB1bGwgb3V0IHRoZSB3b3JkcyBvZiB0aGUgSVYgdG8gZW5zdXJlIHdlIGRvbid0IG1vZGlmeSB0aGVcbiAgICAvLyBwYXNzZWQtaW4gcmVmZXJlbmNlIGFuZCBlYXNpZXIgYWNjZXNzXG4gICAgaW5pdDAgPSB+fmluaXRWZWN0b3JbMF07XG4gICAgaW5pdDEgPSB+fmluaXRWZWN0b3JbMV07XG4gICAgaW5pdDIgPSB+fmluaXRWZWN0b3JbMl07XG4gICAgaW5pdDMgPSB+fmluaXRWZWN0b3JbM107XG5cbiAgICAvLyBkZWNyeXB0IGZvdXIgd29yZCBzZXF1ZW5jZXMsIGFwcGx5aW5nIGNpcGhlci1ibG9jayBjaGFpbmluZyAoQ0JDKVxuICAgIC8vIHRvIGVhY2ggZGVjcnlwdGVkIGJsb2NrXG4gICAgZm9yICh3b3JkSXggPSAwOyB3b3JkSXggPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IHdvcmRJeCArPSA0KSB7XG4gICAgICAvLyBjb252ZXJ0IGJpZy1lbmRpYW4gKG5ldHdvcmsgb3JkZXIpIHdvcmRzIGludG8gbGl0dGxlLWVuZGlhblxuICAgICAgLy8gKGphdmFzY3JpcHQgb3JkZXIpXG4gICAgICBlbmNyeXB0ZWQwID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4XSk7XG4gICAgICBlbmNyeXB0ZWQxID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgMV0pO1xuICAgICAgZW5jcnlwdGVkMiA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDJdKTtcbiAgICAgIGVuY3J5cHRlZDMgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAzXSk7XG5cbiAgICAgIC8vIGRlY3J5cHQgdGhlIGJsb2NrXG4gICAgICBkZWNpcGhlci5kZWNyeXB0KGVuY3J5cHRlZDAsXG4gICAgICAgICAgZW5jcnlwdGVkMSxcbiAgICAgICAgICBlbmNyeXB0ZWQyLFxuICAgICAgICAgIGVuY3J5cHRlZDMsXG4gICAgICAgICAgZGVjcnlwdGVkMzIsXG4gICAgICAgICAgd29yZEl4KTtcblxuICAgICAgLy8gWE9SIHdpdGggdGhlIElWLCBhbmQgcmVzdG9yZSBuZXR3b3JrIGJ5dGUtb3JkZXIgdG8gb2J0YWluIHRoZVxuICAgICAgLy8gcGxhaW50ZXh0XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXhdICAgICA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXhdIF4gaW5pdDApO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gXiBpbml0MSk7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSBeIGluaXQyKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdIF4gaW5pdDMpO1xuXG4gICAgICAvLyBzZXR1cCB0aGUgSVYgZm9yIHRoZSBuZXh0IHJvdW5kXG4gICAgICBpbml0MCA9IGVuY3J5cHRlZDA7XG4gICAgICBpbml0MSA9IGVuY3J5cHRlZDE7XG4gICAgICBpbml0MiA9IGVuY3J5cHRlZDI7XG4gICAgICBpbml0MyA9IGVuY3J5cHRlZDM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY3J5cHRlZDtcbiAgfVxuXG4gIGxvY2FsRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKSB7XG4gICAgdmFyIGJ5dGVzID0gdGhpcy5kb0RlY3J5cHQoZW5jcnlwdGVkLFxuICAgICAgICBrZXksXG4gICAgICAgIGluaXRWZWN0b3IpO1xuICAgIGRlY3J5cHRlZC5zZXQoYnl0ZXMsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0KTtcbiAgfVxuXG4gIGRlY3J5cHQoZW5jcnlwdGVkKSB7XG4gICAgdmFyXG4gICAgICBzdGVwID0gNCAqIDgwMDAsXG4gICAgLy9lbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIpLFxuICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkKSxcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgaSA9IDA7XG5cbiAgICAvLyBzcGxpdCB1cCB0aGUgZW5jcnlwdGlvbiBqb2IgYW5kIGRvIHRoZSBpbmRpdmlkdWFsIGNodW5rcyBhc3luY2hyb25vdXNseVxuICAgIHZhciBrZXkgPSB0aGlzLmtleTtcbiAgICB2YXIgaW5pdFZlY3RvciA9IHRoaXMuaXY7XG4gICAgdGhpcy5sb2NhbERlY3J5cHQoZW5jcnlwdGVkMzIuc3ViYXJyYXkoaSwgaSArIHN0ZXApLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCk7XG5cbiAgICBmb3IgKGkgPSBzdGVwOyBpIDwgZW5jcnlwdGVkMzIubGVuZ3RoOyBpICs9IHN0ZXApIHtcbiAgICAgIGluaXRWZWN0b3IgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gNF0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gM10pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMl0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMV0pXG4gICAgICBdKTtcbiAgICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTMTI4RGVjcnlwdGVyO1xuIiwiLypcbiAqIEFFUzEyOCBkZWNyeXB0aW9uLlxuICovXG5cbmltcG9ydCBBRVMxMjhEZWNyeXB0ZXIgZnJvbSAnLi9hZXMxMjgtZGVjcnlwdGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJyb3dzZXJDcnlwdG8gPSB3aW5kb3cgPyB3aW5kb3cuY3J5cHRvIDogY3J5cHRvO1xuICAgICAgdGhpcy5zdWJ0bGUgPSBicm93c2VyQ3J5cHRvLnN1YnRsZSB8fCBicm93c2VyQ3J5cHRvLndlYmtpdFN1YnRsZTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9ICF0aGlzLnN1YnRsZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBkZWNyeXB0KGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuZGlzYWJsZVdlYkNyeXB0byAmJiB0aGlzLmhscy5jb25maWcuZW5hYmxlU29mdHdhcmVBRVMpIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBXZWJDcnlwdG8gQVBJJyk7XG5cbiAgICB0aGlzLnN1YnRsZS5pbXBvcnRLZXkoJ3JhdycsIGtleSwgeyBuYW1lIDogJ0FFUy1DQkMnLCBsZW5ndGggOiAxMjggfSwgZmFsc2UsIFsnZGVjcnlwdCddKS5cbiAgICAgIHRoZW4oKGltcG9ydGVkS2V5KSA9PiB7XG4gICAgICAgIHRoaXMuc3VidGxlLmRlY3J5cHQoeyBuYW1lIDogJ0FFUy1DQkMnLCBpdiA6IGl2LmJ1ZmZlciB9LCBpbXBvcnRlZEtleSwgZGF0YSkuXG4gICAgICAgICAgdGhlbihjYWxsYmFjaykuXG4gICAgICAgICAgY2F0Y2ggKChlcnIpID0+IHtcbiAgICAgICAgICAgIHRoaXMub25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLlxuICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSk7XG4gIH1cblxuICBkZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXk4LCBpdjgsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBKYXZhU2NyaXB0IEltcGxlbWVudGF0aW9uJyk7XG5cbiAgICB2YXIgdmlldyA9IG5ldyBEYXRhVmlldyhrZXk4LmJ1ZmZlcik7XG4gICAgdmFyIGtleSA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhpdjguYnVmZmVyKTtcbiAgICB2YXIgaXYgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZhciBkZWNyeXB0ZXIgPSBuZXcgQUVTMTI4RGVjcnlwdGVyKGtleSwgaXYpO1xuICAgIGNhbGxiYWNrKGRlY3J5cHRlci5kZWNyeXB0KGRhdGEpLmJ1ZmZlcik7XG4gIH1cblxuICBvbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNhYmxpbmcgdG8gdXNlIFdlYkNyeXB0byBBUEknKTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBsb2dnZXIuZXJyb3IoYGRlY3J5cHRpbmcgZXJyb3IgOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfREVDUllQVF9FUlJPUiwgZmF0YWwgOiB0cnVlLCByZWFzb24gOiBlcnIubWVzc2FnZX0pO1xuICAgIH1cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlY3J5cHRlcjtcbiIsIi8qKlxuICogQUFDIGRlbXV4ZXJcbiAqL1xuaW1wb3J0IEFEVFMgZnJvbSAnLi9hZHRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IElEMyBmcm9tICcuLi9kZW11eC9pZDMnO1xuXG4gY2xhc3MgQUFDRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIscmVtdXhlckNsYXNzKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMucmVtdXhlckNsYXNzID0gcmVtdXhlckNsYXNzO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7Y29udGFpbmVyIDogJ2F1ZGlvL2FkdHMnLCB0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICB9XG5cbiAgc3RhdGljIHByb2JlKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBkYXRhIGNvbnRhaW5zIElEMyB0aW1lc3RhbXAgYW5kIEFEVFMgc3luYyB3b3JjXG4gICAgdmFyIGlkMyA9IG5ldyBJRDMoZGF0YSksIG9mZnNldCxsZW47XG4gICAgaWYoaWQzLmhhc1RpbWVTdGFtcCkge1xuICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgIGZvciAob2Zmc2V0ID0gaWQzLmxlbmd0aCwgbGVuID0gZGF0YS5sZW5ndGg7IG9mZnNldCA8IGxlbiAtIDE7IG9mZnNldCsrKSB7XG4gICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQURUUyBzeW5jIHdvcmQgZm91bmQgIScpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGlkMyA9IG5ldyBJRDMoZGF0YSksXG4gICAgICAgIHB0cyA9IDkwKmlkMy50aW1lU3RhbXAsXG4gICAgICAgIGNvbmZpZywgZnJhbWVMZW5ndGgsIGZyYW1lRHVyYXRpb24sIGZyYW1lSW5kZXgsIG9mZnNldCwgaGVhZGVyTGVuZ3RoLCBzdGFtcCwgbGVuLCBhYWNTYW1wbGU7XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKG9mZnNldCA9IGlkMy5sZW5ndGgsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdHJhY2suYXVkaW9zYW1wbGVyYXRlKSB7XG4gICAgICBjb25maWcgPSBBRFRTLmdldEF1ZGlvQ29uZmlnKHRoaXMub2JzZXJ2ZXIsZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgZnJhbWVJbmRleCA9IDA7XG4gICAgZnJhbWVEdXJhdGlvbiA9IDEwMjQgKiA5MDAwMCAvIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICB3aGlsZSAoKG9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyBUaGUgcHJvdGVjdGlvbiBza2lwIGJpdCB0ZWxscyB1cyBpZiB3ZSBoYXZlIDIgYnl0ZXMgb2YgQ1JDIGRhdGEgYXQgdGhlIGVuZCBvZiB0aGUgQURUUyBoZWFkZXJcbiAgICAgIGhlYWRlckxlbmd0aCA9ICghIShkYXRhW29mZnNldCArIDFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBmcmFtZUxlbmd0aCA9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MDMpIDw8IDExKSB8XG4gICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQgKyA0XSA8PCAzKSB8XG4gICAgICAgICAgICAgICAgICAgICgoZGF0YVtvZmZzZXQgKyA1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGZyYW1lTGVuZ3RoICAtPSBoZWFkZXJMZW5ndGg7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcblxuICAgICAgaWYgKChmcmFtZUxlbmd0aCA+IDApICYmICgob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpIDw9IGxlbikpIHtcbiAgICAgICAgc3RhbXAgPSBwdHMgKyBmcmFtZUluZGV4ICogZnJhbWVEdXJhdGlvbjtcbiAgICAgICAgLy9sb2dnZXIubG9nKGBBQUMgZnJhbWUsIG9mZnNldC9sZW5ndGgvdG90YWwvcHRzOiR7b2Zmc2V0K2hlYWRlckxlbmd0aH0vJHtmcmFtZUxlbmd0aH0vJHtkYXRhLmJ5dGVMZW5ndGh9LyR7KHN0YW1wLzkwKS50b0ZpeGVkKDApfWApO1xuICAgICAgICBhYWNTYW1wbGUgPSB7dW5pdDogZGF0YS5zdWJhcnJheShvZmZzZXQgKyBoZWFkZXJMZW5ndGgsIG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSwgcHRzOiBzdGFtcCwgZHRzOiBzdGFtcH07XG4gICAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gZnJhbWVMZW5ndGg7XG4gICAgICAgIG9mZnNldCArPSBmcmFtZUxlbmd0aCArIGhlYWRlckxlbmd0aDtcbiAgICAgICAgZnJhbWVJbmRleCsrO1xuICAgICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgICBmb3IgKCA7IG9mZnNldCA8IChsZW4gLSAxKTsgb2Zmc2V0KyspIHtcbiAgICAgICAgICBpZiAoKGRhdGFbb2Zmc2V0XSA9PT0gMHhmZikgJiYgKChkYXRhW29mZnNldCArIDFdICYgMHhmMCkgPT09IDB4ZjApKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2sse3NhbXBsZXMgOiBbXX0sIHtzYW1wbGVzIDogWyB7IHB0czogcHRzLCBkdHMgOiBwdHMsIHVuaXQgOiBpZDMucGF5bG9hZH0gXX0sIHsgc2FtcGxlczogW10gfSwgdGltZU9mZnNldCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUFDRGVtdXhlcjtcbiIsIi8qKlxuICogIEFEVFMgcGFyc2VyIGhlbHBlclxuICovXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgQURUUyB7XG5cbiAgc3RhdGljIGdldEF1ZGlvQ29uZmlnKG9ic2VydmVyLCBkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpIHtcbiAgICB2YXIgYWR0c09iamVjdFR5cGUsIC8vIDppbnRcbiAgICAgICAgYWR0c1NhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzQ2hhbmVsQ29uZmlnLCAvLyA6aW50XG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgdXNlckFnZW50ID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBhZHRzU2FtcGxlaW5nUmF0ZXMgPSBbXG4gICAgICAgICAgICA5NjAwMCwgODgyMDAsXG4gICAgICAgICAgICA2NDAwMCwgNDgwMDAsXG4gICAgICAgICAgICA0NDEwMCwgMzIwMDAsXG4gICAgICAgICAgICAyNDAwMCwgMjIwNTAsXG4gICAgICAgICAgICAxNjAwMCwgMTIwMDAsXG4gICAgICAgICAgICAxMTAyNSwgODAwMCxcbiAgICAgICAgICAgIDczNTBdO1xuICAgIC8vIGJ5dGUgMlxuICAgIGFkdHNPYmplY3RUeXBlID0gKChkYXRhW29mZnNldCArIDJdICYgMHhDMCkgPj4+IDYpICsgMTtcbiAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgaWYoYWR0c1NhbXBsZWluZ0luZGV4ID4gYWR0c1NhbXBsZWluZ1JhdGVzLmxlbmd0aC0xKSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogYGludmFsaWQgQURUUyBzYW1wbGluZyBpbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1gfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4QzApID4+PiA2KTtcbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfUh6XSxjaGFubmVsQ29uZmlnOiR7YWR0c0NoYW5lbENvbmZpZ31gKTtcbiAgICAvLyBmaXJlZm94OiBmcmVxIGxlc3MgdGhhbiAyNGtIeiA9IEFBQyBTQlIgKEhFLUFBQylcbiAgICBpZiAodXNlckFnZW50LmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEpIHtcbiAgICAgIGlmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgICAgLy8gQW5kcm9pZCA6IGFsd2F5cyB1c2UgQUFDXG4gICAgfSBlbHNlIGlmICh1c2VyQWdlbnQuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICAvKiAgZm9yIG90aGVyIGJyb3dzZXJzIChjaHJvbWUgLi4uKVxuICAgICAgICAgIGFsd2F5cyBmb3JjZSBhdWRpbyB0eXBlIHRvIGJlIEhFLUFBQyBTQlIsIGFzIHNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoIHByb3Blcmx5IChsaWtlIENocm9tZSAuLi4pXG4gICAgICAqL1xuICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEhFLUFBQyBvciBIRS1BQUN2MikgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgQU5EIGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHopXG4gICAgICBpZiAoKGF1ZGlvQ29kZWMgJiYgKChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMjknKSAhPT0gLTEpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkpKSB8fFxuICAgICAgICAgICghYXVkaW9Db2RlYyAmJiBhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikpIHtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgQUFDKSBBTkQgKGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHogQU5EIG5iIGNoYW5uZWwgaXMgMSkgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgYW5kIG1vbm8gYXVkaW8pXG4gICAgICAgIC8vIENocm9tZSBmYWlscyB0byBwbGF5IGJhY2sgd2l0aCBsb3cgZnJlcXVlbmN5IEFBQyBMQyBtb25vIHdoZW4gaW5pdGlhbGl6ZWQgd2l0aCBIRS1BQUMuICBUaGlzIGlzIG5vdCBhIHByb2JsZW0gd2l0aCBzdGVyZW8uXG4gICAgICAgIGlmIChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xICYmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNiAmJiBhZHRzQ2hhbmVsQ29uZmlnID09PSAxKSB8fFxuICAgICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNDaGFuZWxDb25maWcgPT09IDEpKSB7XG4gICAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAgICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZiAoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4ge2NvbmZpZzogY29uZmlnLCBzYW1wbGVyYXRlOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50OiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYzogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFEVFM7XG4iLCIvKiAgaW5saW5lIGRlbXV4ZXIuXG4gKiAgIHByb2JlIGZyYWdtZW50cyBhbmQgaW5zdGFudGlhdGUgYXBwcm9wcmlhdGUgZGVtdXhlciBkZXBlbmRpbmcgb24gY29udGVudCB0eXBlIChUU0RlbXV4ZXIsIEFBQ0RlbXV4ZXIsIC4uLilcbiAqL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IEFBQ0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvYWFjZGVtdXhlcic7XG5pbXBvcnQgVFNEZW11eGVyIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG5pbXBvcnQgTVA0UmVtdXhlciBmcm9tICcuLi9yZW11eC9tcDQtcmVtdXhlcic7XG5pbXBvcnQgUGFzc1Rocm91Z2hSZW11eGVyIGZyb20gJy4uL3JlbXV4L3Bhc3N0aHJvdWdoLXJlbXV4ZXInO1xuXG5jbGFzcyBEZW11eGVySW5saW5lIHtcblxuICBjb25zdHJ1Y3RvcihobHMsdHlwZVN1cHBvcnRlZCkge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMudHlwZVN1cHBvcnRlZCA9IHR5cGVTdXBwb3J0ZWQ7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmIChkZW11eGVyKSB7XG4gICAgICBkZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCkge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmICghZGVtdXhlcikge1xuICAgICAgdmFyIGhscyA9IHRoaXMuaGxzO1xuICAgICAgLy8gcHJvYmUgZm9yIGNvbnRlbnQgdHlwZVxuICAgICAgaWYgKFRTRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBpZiAodGhpcy50eXBlU3VwcG9ydGVkLm1wMnQgPT09IHRydWUpIHtcbiAgICAgICAgICBkZW11eGVyID0gbmV3IFRTRGVtdXhlcihobHMsUGFzc1Rocm91Z2hSZW11eGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZW11eGVyID0gbmV3IFRTRGVtdXhlcihobHMsTVA0UmVtdXhlcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZihBQUNEZW11eGVyLnByb2JlKGRhdGEpKSB7XG4gICAgICAgIGRlbXV4ZXIgPSBuZXcgQUFDRGVtdXhlcihobHMsTVA0UmVtdXhlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgcmVhc29uOiAnbm8gZGVtdXggbWF0Y2hpbmcgd2l0aCBjb250ZW50IGZvdW5kJ30pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBkZW11eGVyO1xuICAgIH1cbiAgICBkZW11eGVyLnB1c2goZGF0YSxhdWRpb0NvZGVjLHZpZGVvQ29kZWMsdGltZU9mZnNldCxjYyxsZXZlbCxzbixkdXJhdGlvbiwgdDApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJJbmxpbmU7XG4iLCIvKiBkZW11eGVyIHdlYiB3b3JrZXIuXG4gKiAgLSBsaXN0ZW4gdG8gd29ya2VyIG1lc3NhZ2UsIGFuZCB0cmlnZ2VyIERlbXV4ZXJJbmxpbmUgdXBvbiByZWNlcHRpb24gb2YgRnJhZ21lbnRzLlxuICogIC0gcHJvdmlkZXMgTVA0IEJveGVzIGJhY2sgdG8gbWFpbiB0aHJlYWQgdXNpbmcgW3RyYW5zZmVyYWJsZSBvYmplY3RzXShodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDExLzEyL1RyYW5zZmVyYWJsZS1PYmplY3RzLUxpZ2h0bmluZy1GYXN0KSBpbiBvcmRlciB0byBtaW5pbWl6ZSBtZXNzYWdlIHBhc3Npbmcgb3ZlcmhlYWQuXG4gKi9cblxuIGltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbnZhciBEZW11eGVyV29ya2VyID0gZnVuY3Rpb24gKHNlbGYpIHtcbiAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgdmFyIG9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG4gIH07XG5cbiAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCAuLi5kYXRhKTtcbiAgfTtcbiAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBkYXRhLmNtZCk7XG4gICAgc3dpdGNoIChkYXRhLmNtZCkge1xuICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKG9ic2VydmVyLCBkYXRhLnR5cGVTdXBwb3J0ZWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgc2VsZi5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhKSwgZGF0YS5hdWRpb0NvZGVjLCBkYXRhLnZpZGVvQ29kZWMsIGRhdGEudGltZU9mZnNldCwgZGF0YS5jYywgZGF0YS5sZXZlbCwgZGF0YS5zbiwgZGF0YS5kdXJhdGlvbiwgZGF0YS50MCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9KTtcblxuICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBEZW11eGVyXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2LCB0cmFja3MgOiBkYXRhLnRyYWNrcywgdW5pcXVlIDogZGF0YS51bmlxdWUgfSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldiwgdHlwZTogZGF0YS50eXBlLCBzdGFydFBUUzogZGF0YS5zdGFydFBUUywgZW5kUFRTOiBkYXRhLmVuZFBUUywgc3RhcnREVFM6IGRhdGEuc3RhcnREVFMsIGVuZERUUzogZGF0YS5lbmREVFMsIGRhdGExOiBkYXRhLmRhdGExLmJ1ZmZlciwgZGF0YTI6IGRhdGEuZGF0YTIuYnVmZmVyLCBuYjogZGF0YS5uYn07XG4gICAgLy8gcGFzcyBkYXRhMS9kYXRhMiBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSwgW29iakRhdGEuZGF0YTEsIG9iakRhdGEuZGF0YTJdKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50fSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudCwgZGF0YTogZGF0YX0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZlbnQsIHNhbXBsZXM6IGRhdGEuc2FtcGxlc307XG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgfSk7XG5cbn07XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJXb3JrZXI7XG5cbiIsImltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IERlbXV4ZXJJbmxpbmUgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci1pbmxpbmUnO1xuaW1wb3J0IERlbXV4ZXJXb3JrZXIgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci13b3JrZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgRGVjcnlwdGVyIGZyb20gJy4uL2NyeXB0L2RlY3J5cHRlcic7XG5cbmNsYXNzIERlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHZhciB0eXBlU3VwcG9ydGVkID0ge1xuICAgICAgbXA0IDogTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQnKSxcbiAgICAgIG1wMnQgOiBobHMuY29uZmlnLmVuYWJsZU1QMlRQYXNzVGhyb3VnaCAmJiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wMnQnKVxuICAgIH07XG4gICAgaWYgKGhscy5jb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ2RlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnaW5pdCcsIHR5cGVTdXBwb3J0ZWQgOiB0eXBlU3VwcG9ydGVkfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKCdlcnJvciB3aGlsZSBpbml0aWFsaXppbmcgRGVtdXhlcldvcmtlciwgZmFsbGJhY2sgb24gRGVtdXhlcklubGluZScpO1xuICAgICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyx0eXBlU3VwcG9ydGVkKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUoaGxzLHR5cGVTdXBwb3J0ZWQpO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eEluaXRpYWxpemVkID0gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgdGhpcy53LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICB0aGlzLncudGVybWluYXRlKCk7XG4gICAgICB0aGlzLncgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZGVjcnlwdGVyKSB7XG4gICAgICB0aGlzLmRlY3J5cHRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlY3J5cHRlciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHVzaERlY3J5cHRlZChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApIHtcblx0bG9nZ2VyLmluZm8oJ3B1c2hEZWNyeXB0ZWQgdDA6ICcgKyB0MCk7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdkZW11eCcsIGRhdGE6IGRhdGEsIGF1ZGlvQ29kZWM6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQ6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWw6IGxldmVsLCBzbiA6IHNuLCBkdXJhdGlvbjogZHVyYXRpb24sIHQwOiB0MH0sIFtkYXRhXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEpLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGRlY3J5cHRkYXRhLCB0MCkge1xuICAgIGlmICgoZGF0YS5ieXRlTGVuZ3RoID4gMCkgJiYgKGRlY3J5cHRkYXRhICE9IG51bGwpICYmIChkZWNyeXB0ZGF0YS5rZXkgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLm1ldGhvZCA9PT0gJ0FFUy0xMjgnKSkge1xuICAgICAgaWYgKHRoaXMuZGVjcnlwdGVyID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5kZWNyeXB0ZXIgPSBuZXcgRGVjcnlwdGVyKHRoaXMuaGxzKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGxvY2FsdGhpcyA9IHRoaXM7XG4gICAgICB0aGlzLmRlY3J5cHRlci5kZWNyeXB0KGRhdGEsIGRlY3J5cHRkYXRhLmtleSwgZGVjcnlwdGRhdGEuaXYsIGZ1bmN0aW9uKGRlY3J5cHRlZERhdGEpe1xuICAgICAgICBsb2NhbHRoaXMucHVzaERlY3J5cHRlZChkZWNyeXB0ZWREYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHVzaERlY3J5cHRlZChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIHZhciBkYXRhID0gZXYuZGF0YTtcbiAgICAvL2NvbnNvbGUubG9nKCdvbldvcmtlck1lc3NhZ2U6JyArIGRhdGEuZXZlbnQpO1xuICAgIHN3aXRjaChkYXRhLmV2ZW50KSB7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLnRyYWNrcyA9IGRhdGEudHJhY2tzO1xuICAgICAgICBvYmoudW5pcXVlID0gZGF0YS51bmlxdWU7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBkYXRhMTogbmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhMSksXG4gICAgICAgICAgZGF0YTI6IG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YTIpLFxuICAgICAgICAgIHN0YXJ0UFRTOiBkYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUzogZGF0YS5lbmRQVFMsXG4gICAgICAgICAgc3RhcnREVFM6IGRhdGEuc3RhcnREVFMsXG4gICAgICAgICAgZW5kRFRTOiBkYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlOiBkYXRhLnR5cGUsXG4gICAgICAgICAgbmI6IGRhdGEubmJcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQTpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIHtcbiAgICAgICAgICBzYW1wbGVzOiBkYXRhLnNhbXBsZXNcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQTpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIHtcbiAgICAgICAgICBzYW1wbGVzOiBkYXRhLnNhbXBsZXNcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihkYXRhLmV2ZW50LCBkYXRhLmRhdGEpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcjtcblxuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2Rpbmcgc2NoZW1lIHVzZWQgYnkgaDI2NC5cbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMuZGF0YVxuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JkID0gMDsgLy8gOnVpbnRcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJpdHMgbGVmdCB0byBleGFtaW5lIGluIHRoZSBjdXJyZW50IHdvcmRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGggLSB0aGlzLmJ5dGVzQXZhaWxhYmxlLFxuICAgICAgd29ya2luZ0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCksXG4gICAgICBhdmFpbGFibGVCeXRlcyA9IE1hdGgubWluKDQsIHRoaXMuYnl0ZXNBdmFpbGFibGUpO1xuICAgIGlmIChhdmFpbGFibGVCeXRlcyA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdubyBieXRlcyBhdmFpbGFibGUnKTtcbiAgICB9XG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLmRhdGEuc3ViYXJyYXkocG9zaXRpb24sIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy5kYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gYXZhaWxhYmxlQnl0ZXMgKiA4O1xuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH1cblxuICAvLyAoY291bnQ6aW50KTp2b2lkXG4gIHNraXBCaXRzKGNvdW50KSB7XG4gICAgdmFyIHNraXBCeXRlczsgLy8gOmludFxuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9IGVsc2Uge1xuICAgICAgY291bnQgLT0gdGhpcy5iaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgPj4gMztcbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgPj4gMyk7XG4gICAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gKHNpemU6aW50KTp1aW50XG4gIHJlYWRCaXRzKHNpemUpIHtcbiAgICB2YXJcbiAgICAgIGJpdHMgPSBNYXRoLm1pbih0aGlzLmJpdHNBdmFpbGFibGUsIHNpemUpLCAvLyA6dWludFxuICAgICAgdmFsdSA9IHRoaXMud29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG4gICAgaWYgKHNpemUgPiAzMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29yZCA8PD0gYml0cztcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuICAgIGJpdHMgPSBzaXplIC0gYml0cztcbiAgICBpZiAoYml0cyA+IDApIHtcbiAgICAgIHJldHVybiB2YWx1IDw8IGJpdHMgfCB0aGlzLnJlYWRCaXRzKGJpdHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsdTtcbiAgICB9XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHNraXBMWigpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwOyBsZWFkaW5nWmVyb0NvdW50IDwgdGhpcy5iaXRzQXZhaWxhYmxlOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JkICYgKDB4ODAwMDAwMDAgPj4+IGxlYWRpbmdaZXJvQ291bnQpKSkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgYml0IG9mIHdvcmtpbmcgd29yZCBpcyAxXG4gICAgICAgIHRoaXMud29yZCA8PD0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cbiAgICAvLyB3ZSBleGhhdXN0ZWQgd29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTFooKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcFVFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVUVHKCkge1xuICAgIHZhciBjbHogPSB0aGlzLnNraXBMWigpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRUcoKSB7XG4gICAgdmFyIHZhbHUgPSB0aGlzLnJlYWRVRUcoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVQnl0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyg4KTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVVNob3J0KCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDE2KTtcbiAgfVxuICAgIC8vICgpOmludFxuICByZWFkVUludCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cygzMik7XG4gIH1cblxuICAvKipcbiAgICogQWR2YW5jZSB0aGUgRXhwR29sb21iIGRlY29kZXIgcGFzdCBhIHNjYWxpbmcgbGlzdC4gVGhlIHNjYWxpbmdcbiAgICogbGlzdCBpcyBvcHRpb25hbGx5IHRyYW5zbWl0dGVkIGFzIHBhcnQgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXJcbiAgICogc2V0IGFuZCBpcyBub3QgcmVsZXZhbnQgdG8gdHJhbnNtdXhpbmcuXG4gICAqIEBwYXJhbSBjb3VudCB7bnVtYmVyfSB0aGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhpcyBzY2FsaW5nIGxpc3RcbiAgICogQHNlZSBSZWNvbW1lbmRhdGlvbiBJVFUtVCBILjI2NCwgU2VjdGlvbiA3LjMuMi4xLjEuMVxuICAgKi9cbiAgc2tpcFNjYWxpbmdMaXN0KGNvdW50KSB7XG4gICAgdmFyXG4gICAgICBsYXN0U2NhbGUgPSA4LFxuICAgICAgbmV4dFNjYWxlID0gOCxcbiAgICAgIGosXG4gICAgICBkZWx0YVNjYWxlO1xuICAgIGZvciAoaiA9IDA7IGogPCBjb3VudDsgaisrKSB7XG4gICAgICBpZiAobmV4dFNjYWxlICE9PSAwKSB7XG4gICAgICAgIGRlbHRhU2NhbGUgPSB0aGlzLnJlYWRFRygpO1xuICAgICAgICBuZXh0U2NhbGUgPSAobGFzdFNjYWxlICsgZGVsdGFTY2FsZSArIDI1NikgJSAyNTY7XG4gICAgICB9XG4gICAgICBsYXN0U2NhbGUgPSAobmV4dFNjYWxlID09PSAwKSA/IGxhc3RTY2FsZSA6IG5leHRTY2FsZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVhZCBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgYW5kIHJldHVybiBzb21lIGludGVyZXN0aW5nIHZpZGVvXG4gICAqIHByb3BlcnRpZXMuIEEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBpcyB0aGUgSDI2NCBtZXRhZGF0YSB0aGF0XG4gICAqIGRlc2NyaWJlcyB0aGUgcHJvcGVydGllcyBvZiB1cGNvbWluZyB2aWRlbyBmcmFtZXMuXG4gICAqIEBwYXJhbSBkYXRhIHtVaW50OEFycmF5fSB0aGUgYnl0ZXMgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0XG4gICAqIEByZXR1cm4ge29iamVjdH0gYW4gb2JqZWN0IHdpdGggY29uZmlndXJhdGlvbiBwYXJzZWQgZnJvbSB0aGVcbiAgICogc2VxdWVuY2UgcGFyYW1ldGVyIHNldCwgaW5jbHVkaW5nIHRoZSBkaW1lbnNpb25zIG9mIHRoZVxuICAgKiBhc3NvY2lhdGVkIHZpZGVvIGZyYW1lcy5cbiAgICovXG4gIHJlYWRTUFMoKSB7XG4gICAgdmFyXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSAwLFxuICAgICAgc2FyU2NhbGUgPSAxLFxuICAgICAgcHJvZmlsZUlkYyxwcm9maWxlQ29tcGF0LGxldmVsSWRjLFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlLCBwaWNXaWR0aEluTWJzTWludXMxLFxuICAgICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSxcbiAgICAgIGZyYW1lTWJzT25seUZsYWcsXG4gICAgICBzY2FsaW5nTGlzdENvdW50LFxuICAgICAgaTtcbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIHByb2ZpbGVJZGMgPSB0aGlzLnJlYWRVQnl0ZSgpOyAvLyBwcm9maWxlX2lkY1xuICAgIHByb2ZpbGVDb21wYXQgPSB0aGlzLnJlYWRCaXRzKDUpOyAvLyBjb25zdHJhaW50X3NldFswLTRdX2ZsYWcsIHUoNSlcbiAgICB0aGlzLnNraXBCaXRzKDMpOyAvLyByZXNlcnZlZF96ZXJvXzNiaXRzIHUoMyksXG4gICAgbGV2ZWxJZGMgPSB0aGlzLnJlYWRVQnl0ZSgpOyAvL2xldmVsX2lkYyB1KDgpXG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIHNlcV9wYXJhbWV0ZXJfc2V0X2lkXG4gICAgLy8gc29tZSBwcm9maWxlcyBoYXZlIG1vcmUgb3B0aW9uYWwgZGF0YSB3ZSBkb24ndCBuZWVkXG4gICAgaWYgKHByb2ZpbGVJZGMgPT09IDEwMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTIyIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDI0NCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA0NCAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gODMgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDg2ICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTggfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTI4KSB7XG4gICAgICB2YXIgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2x1bWFfbWludXM4XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIGxvZzJfbWF4X2ZyYW1lX251bV9taW51czRcbiAgICB2YXIgcGljT3JkZXJDbnRUeXBlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVUVHKCk7IC8vbG9nMl9tYXhfcGljX29yZGVyX2NudF9sc2JfbWludXM0XG4gICAgfSBlbHNlIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDEpIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRlbHRhX3BpY19vcmRlcl9hbHdheXNfemVyb19mbGFnXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbWF4X251bV9yZWZfZnJhbWVzXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZ2Fwc19pbl9mcmFtZV9udW1fdmFsdWVfYWxsb3dlZF9mbGFnXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgLy8gdnVpX3BhcmFtZXRlcnNfcHJlc2VudF9mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7XG4gICAgICAgIC8vIGFzcGVjdF9yYXRpb19pbmZvX3ByZXNlbnRfZmxhZ1xuICAgICAgICBsZXQgc2FyUmF0aW87XG4gICAgICAgIGNvbnN0IGFzcGVjdFJhdGlvSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICAgICAgc3dpdGNoIChhc3BlY3RSYXRpb0lkYykge1xuICAgICAgICAgIGNhc2UgMTogc2FyUmF0aW8gPSBbMSwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyOiBzYXJSYXRpbyA9IFsxMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzogc2FyUmF0aW8gPSBbMTAsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6IHNhclJhdGlvID0gWzE2LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA1OiBzYXJSYXRpbyA9IFs0MCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNjogc2FyUmF0aW8gPSBbMjQsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDc6IHNhclJhdGlvID0gWzIwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA4OiBzYXJSYXRpbyA9IFszMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgOTogc2FyUmF0aW8gPSBbODAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEwOiBzYXJSYXRpbyA9IFsxOCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTE6IHNhclJhdGlvID0gWzE1LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMjogc2FyUmF0aW8gPSBbNjQsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEzOiBzYXJSYXRpbyA9IFsxNjAsOTldOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE0OiBzYXJSYXRpbyA9IFs0LDNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE1OiBzYXJSYXRpbyA9IFszLDJdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE2OiBzYXJSYXRpbyA9IFsyLDFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDI1NToge1xuICAgICAgICAgICAgc2FyUmF0aW8gPSBbdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKSwgdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNhclJhdGlvKSB7XG4gICAgICAgICAgc2FyU2NhbGUgPSBzYXJSYXRpb1swXSAvIHNhclJhdGlvWzFdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogTWF0aC5jZWlsKCgoKHBpY1dpZHRoSW5NYnNNaW51czEgKyAxKSAqIDE2KSAtIGZyYW1lQ3JvcExlZnRPZmZzZXQgKiAyIC0gZnJhbWVDcm9wUmlnaHRPZmZzZXQgKiAyKSAqIHNhclNjYWxlKSxcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKChmcmFtZU1ic09ubHlGbGFnPyAyIDogNCkgKiAoZnJhbWVDcm9wVG9wT2Zmc2V0ICsgZnJhbWVDcm9wQm90dG9tT2Zmc2V0KSlcbiAgICB9O1xuICB9XG5cbiAgcmVhZFNsaWNlVHlwZSgpIHtcbiAgICAvLyBza2lwIE5BTHUgdHlwZVxuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgLy8gZGlzY2FyZCBmaXJzdF9tYl9pbl9zbGljZVxuICAgIHRoaXMucmVhZFVFRygpO1xuICAgIC8vIHJldHVybiBzbGljZV90eXBlXG4gICAgcmV0dXJuIHRoaXMucmVhZFVFRygpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV4cEdvbG9tYjtcbiIsIi8qKlxuICogSUQzIHBhcnNlclxuICovXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuXG4gY2xhc3MgSUQzIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5faGFzVGltZVN0YW1wID0gZmFsc2U7XG4gICAgdmFyIG9mZnNldCA9IDAsIGJ5dGUxLGJ5dGUyLGJ5dGUzLGJ5dGU0LHRhZ1NpemUsZW5kUG9zLGhlYWRlcixsZW47XG4gICAgICBkbyB7XG4gICAgICAgIGhlYWRlciA9IHRoaXMucmVhZFVURihkYXRhLG9mZnNldCwzKTtcbiAgICAgICAgb2Zmc2V0Kz0zO1xuICAgICAgICAgIC8vIGZpcnN0IGNoZWNrIGZvciBJRDMgaGVhZGVyXG4gICAgICAgICAgaWYgKGhlYWRlciA9PT0gJ0lEMycpIHtcbiAgICAgICAgICAgICAgLy8gc2tpcCAyNCBiaXRzXG4gICAgICAgICAgICAgIG9mZnNldCArPSAzO1xuICAgICAgICAgICAgICAvLyByZXRyaWV2ZSB0YWcocykgbGVuZ3RoXG4gICAgICAgICAgICAgIGJ5dGUxID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlMiA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTMgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGU0ID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICB0YWdTaXplID0gKGJ5dGUxIDw8IDIxKSArIChieXRlMiA8PCAxNCkgKyAoYnl0ZTMgPDwgNykgKyBieXRlNDtcbiAgICAgICAgICAgICAgZW5kUG9zID0gb2Zmc2V0ICsgdGFnU2l6ZTtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBJRDMgdGFnIGZvdW5kLCBzaXplL2VuZDogJHt0YWdTaXplfS8ke2VuZFBvc31gKTtcblxuICAgICAgICAgICAgICAvLyByZWFkIElEMyB0YWdzXG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlSUQzRnJhbWVzKGRhdGEsIG9mZnNldCxlbmRQb3MpO1xuICAgICAgICAgICAgICBvZmZzZXQgPSBlbmRQb3M7XG4gICAgICAgICAgfSBlbHNlIGlmIChoZWFkZXIgPT09ICczREknKSB7XG4gICAgICAgICAgICAgIC8vIGh0dHA6Ly9pZDMub3JnL2lkM3YyLjQuMC1zdHJ1Y3R1cmUgY2hhcHRlciAzLjQuICAgSUQzdjIgZm9vdGVyXG4gICAgICAgICAgICAgIG9mZnNldCArPSA3O1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgM0RJIGZvb3RlciBmb3VuZCwgZW5kOiAke29mZnNldH1gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvZmZzZXQgLT0gMztcbiAgICAgICAgICAgICAgbGVuID0gb2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIGxlbjogJHtsZW59YCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhc1RpbWVTdGFtcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIud2FybignSUQzIHRhZyBmb3VuZCwgYnV0IG5vIHRpbWVzdGFtcCcpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZW5ndGggPSBsZW47XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcGF5bG9hZCA9IGRhdGEuc3ViYXJyYXkoMCxsZW4pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgfSB3aGlsZSAodHJ1ZSk7XG4gIH1cblxuICByZWFkVVRGKGRhdGEsc3RhcnQsbGVuKSB7XG5cbiAgICB2YXIgcmVzdWx0ID0gJycsb2Zmc2V0ID0gc3RhcnQsIGVuZCA9IHN0YXJ0ICsgbGVuO1xuICAgIGRvIHtcbiAgICAgIHJlc3VsdCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFbb2Zmc2V0KytdKTtcbiAgICB9IHdoaWxlKG9mZnNldCA8IGVuZCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIF9wYXJzZUlEM0ZyYW1lcyhkYXRhLG9mZnNldCxlbmRQb3MpIHtcbiAgICB2YXIgdGFnSWQsdGFnTGVuLHRhZ1N0YXJ0LHRhZ0ZsYWdzLHRpbWVzdGFtcDtcbiAgICB3aGlsZShvZmZzZXQgKyA4IDw9IGVuZFBvcykge1xuICAgICAgdGFnSWQgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsNCk7XG4gICAgICBvZmZzZXQgKz00O1xuXG4gICAgICB0YWdMZW4gPSBkYXRhW29mZnNldCsrXSA8PCAyNCArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10gPDwgMTYgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDggK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdGbGFncyA9IGRhdGFbb2Zmc2V0KytdIDw8IDggK1xuICAgICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK107XG5cbiAgICAgIHRhZ1N0YXJ0ID0gb2Zmc2V0O1xuICAgICAgLy9sb2dnZXIubG9nKFwiSUQzIHRhZyBpZDpcIiArIHRhZ0lkKTtcbiAgICAgIHN3aXRjaCh0YWdJZCkge1xuICAgICAgICBjYXNlICdQUklWJzpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncGFyc2UgZnJhbWU6JyArIEhleC5oZXhEdW1wKGRhdGEuc3ViYXJyYXkob2Zmc2V0LGVuZFBvcykpKTtcbiAgICAgICAgICAgIC8vIG93bmVyIHNob3VsZCBiZSBcImNvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wXCJcbiAgICAgICAgICAgIGlmICh0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsNDQpID09PSAnY29tLmFwcGxlLnN0cmVhbWluZy50cmFuc3BvcnRTdHJlYW1UaW1lc3RhbXAnKSB7XG4gICAgICAgICAgICAgICAgb2Zmc2V0Kz00NDtcbiAgICAgICAgICAgICAgICAvLyBzbWVsbGluZyBldmVuIGJldHRlciAhIHdlIGZvdW5kIHRoZSByaWdodCBkZXNjcmlwdG9yXG4gICAgICAgICAgICAgICAgLy8gc2tpcCBudWxsIGNoYXJhY3RlciAoc3RyaW5nIGVuZCkgKyAzIGZpcnN0IGJ5dGVzXG4gICAgICAgICAgICAgICAgb2Zmc2V0Kz0gNDtcblxuICAgICAgICAgICAgICAgIC8vIHRpbWVzdGFtcCBpcyAzMyBiaXQgZXhwcmVzc2VkIGFzIGEgYmlnLWVuZGlhbiBlaWdodC1vY3RldCBudW1iZXIsIHdpdGggdGhlIHVwcGVyIDMxIGJpdHMgc2V0IHRvIHplcm8uXG4gICAgICAgICAgICAgICAgdmFyIHB0czMzQml0ICA9IGRhdGFbb2Zmc2V0KytdICYgMHgxO1xuICAgICAgICAgICAgICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSAoKGRhdGFbb2Zmc2V0KytdIDw8IDIzKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCsrXSA8PCAxNSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgIDcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10pIC80NTtcblxuICAgICAgICAgICAgICAgIGlmIChwdHMzM0JpdCkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXAgICArPSA0NzcyMTg1OC44NDsgLy8gMl4zMiAvIDkwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCA9IE1hdGgucm91bmQodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIudHJhY2UoYElEMyB0aW1lc3RhbXAgZm91bmQ6ICR7dGltZXN0YW1wfWApO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RpbWVTdGFtcCA9IHRpbWVzdGFtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IGhhc1RpbWVTdGFtcCgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzVGltZVN0YW1wO1xuICB9XG5cbiAgZ2V0IHRpbWVTdGFtcCgpIHtcbiAgICByZXR1cm4gdGhpcy5fdGltZVN0YW1wO1xuICB9XG5cbiAgZ2V0IGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGVuZ3RoO1xuICB9XG5cbiAgZ2V0IHBheWxvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BheWxvYWQ7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBJRDM7XG5cbiIsIi8qKlxuICogaGlnaGx5IG9wdGltaXplZCBUUyBkZW11eGVyOlxuICogcGFyc2UgUEFULCBQTVRcbiAqIGV4dHJhY3QgUEVTIHBhY2tldCBmcm9tIGF1ZGlvIGFuZCB2aWRlbyBQSURzXG4gKiBleHRyYWN0IEFWQy9IMjY0IE5BTCB1bml0cyBhbmQgQUFDL0FEVFMgc2FtcGxlcyBmcm9tIFBFUyBwYWNrZXRcbiAqIHRyaWdnZXIgdGhlIHJlbXV4ZXIgdXBvbiBwYXJzaW5nIGNvbXBsZXRpb25cbiAqIGl0IGFsc28gdHJpZXMgdG8gd29ya2Fyb3VuZCBhcyBiZXN0IGFzIGl0IGNhbiBhdWRpbyBjb2RlYyBzd2l0Y2ggKEhFLUFBQyB0byBBQUMgYW5kIHZpY2UgdmVyc2EpLCB3aXRob3V0IGhhdmluZyB0byByZXN0YXJ0IHRoZSBNZWRpYVNvdXJjZS5cbiAqIGl0IGFsc28gY29udHJvbHMgdGhlIHJlbXV4aW5nIHByb2Nlc3MgOlxuICogdXBvbiBkaXNjb250aW51aXR5IG9yIGxldmVsIHN3aXRjaCBkZXRlY3Rpb24sIGl0IHdpbGwgYWxzbyBub3RpZmllcyB0aGUgcmVtdXhlciBzbyB0aGF0IGl0IGNhbiByZXNldCBpdHMgc3RhdGUuXG4qL1xuXG4gaW1wb3J0IEFEVFMgZnJvbSAnLi9hZHRzJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXhwR29sb21iIGZyb20gJy4vZXhwLWdvbG9tYic7XG4vLyBpbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG4gaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLmxhc3RDQyA9IDA7XG4gICAgdGhpcy5yZW11eGVyID0gbmV3IHRoaXMucmVtdXhlckNsYXNzKG9ic2VydmVyKTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9iZShkYXRhKSB7XG4gICAgLy8gYSBUUyBmcmFnbWVudCBzaG91bGQgY29udGFpbiBhdCBsZWFzdCAzIFRTIHBhY2tldHMsIGEgUEFULCBhIFBNVCwgYW5kIG9uZSBQSUQsIGVhY2ggc3RhcnRpbmcgd2l0aCAweDQ3XG4gICAgaWYgKGRhdGEubGVuZ3RoID49IDMqMTg4ICYmIGRhdGFbMF0gPT09IDB4NDcgJiYgZGF0YVsxODhdID09PSAweDQ3ICYmIGRhdGFbMioxODhdID09PSAweDQ3KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSAtMTtcbiAgICB0aGlzLmxhc3RBYWNQVFMgPSBudWxsO1xuICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIHRoaXMuX2F2Y1RyYWNrID0ge2NvbnRhaW5lciA6ICd2aWRlby9tcDJ0JywgdHlwZTogJ3ZpZGVvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwLCBuYk5hbHUgOiAwfTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHtjb250YWluZXIgOiAndmlkZW8vbXAydCcsIHR5cGU6ICdhdWRpbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gICAgdGhpcy5faWQzVHJhY2sgPSB7dHlwZTogJ2lkMycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gICAgdGhpcy5fdHh0VHJhY2sgPSB7dHlwZTogJ3RleHQnLCBpZDogLTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzOiBbXSwgbGVuOiAwfTtcbiAgICB0aGlzLnJlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgfVxuXG4gIGluc2VydERpc2NvbnRpbnVpdHkoKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgIHRoaXMucmVtdXhlci5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKSB7XG4gICAgbG9nZ2VyLmluZm8oJ3RzZGVtdXhlciB0MDogJyArIHQwKTtcbiAgICB2YXIgYXZjRGF0YSwgYWFjRGF0YSwgaWQzRGF0YSxcbiAgICAgICAgc3RhcnQsIGxlbiA9IGRhdGEubGVuZ3RoLCBzdHQsIHBpZCwgYXRmLCBvZmZzZXQsXG4gICAgICAgIGNvZGVjc09ubHkgPSB0aGlzLnJlbXV4ZXIucGFzc3Rocm91Z2g7XG5cbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgIHRoaXMuY29udGlndW91cyA9IGZhbHNlO1xuICAgIGlmIChjYyAhPT0gdGhpcy5sYXN0Q0MpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2NvbnRpbnVpdHkgZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICAgICAgdGhpcy5sYXN0Q0MgPSBjYztcbiAgICB9IGVsc2UgaWYgKGxldmVsICE9PSB0aGlzLmxhc3RMZXZlbCkge1xuICAgICAgbG9nZ2VyLmxvZygnbGV2ZWwgc3dpdGNoIGRldGVjdGVkJyk7XG4gICAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgICB0aGlzLmxhc3RMZXZlbCA9IGxldmVsO1xuICAgIH0gZWxzZSBpZiAoc24gPT09ICh0aGlzLmxhc3RTTisxKSkge1xuICAgICAgdGhpcy5jb250aWd1b3VzID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5sYXN0U04gPSBzbjtcblxuICAgIGlmKCF0aGlzLmNvbnRpZ3VvdXMpIHtcbiAgICAgIC8vIGZsdXNoIGFueSBwYXJ0aWFsIGNvbnRlbnRcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCxcbiAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZCxcbiAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZCxcbiAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcblxuXHR2YXIgZmlyc3RGcmFtZSA9IHRydWU7XG4gICAgLy8gZG9uJ3QgcGFyc2UgbGFzdCBUUyBwYWNrZXQgaWYgaW5jb21wbGV0ZVxuICAgIGxlbiAtPSBsZW4gJSAxODg7XG4gICAgLy8gbG9vcCB0aHJvdWdoIFRTIHBhY2tldHNcbiAgICBmb3IgKHN0YXJ0ID0gMDsgc3RhcnQgPCBsZW47IHN0YXJ0ICs9IDE4OCkge1xuICAgICAgaWYgKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQgKyAxXSAmIDB4NDApO1xuICAgICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCArIDFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0ICsgMl07XG4gICAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0ICsgM10gJiAweDMwKSA+PiA0O1xuICAgICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgICAgaWYgKGF0ZiA+IDEpIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDUgKyBkYXRhW3N0YXJ0ICsgNF07XG4gICAgICAgICAgLy8gY29udGludWUgaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgICAgaWYgKG9mZnNldCA9PT0gKHN0YXJ0ICsgMTg4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocG10UGFyc2VkKSB7XG4gICAgICAgICAgaWYgKHBpZCA9PT0gYXZjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgICB2YXIgaXNGcmFtZU9rRm9yQ2hyb21lT1NYID0gdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSksIGZpcnN0RnJhbWUpO1xuXHRcdFx0XHRpZiAoaXNGcmFtZU9rRm9yQ2hyb21lT1NYKSB7IGZpcnN0RnJhbWUgPSBmYWxzZTsgfVxuICAgICAgICAgICAgICAgIGlmIChjb2RlY3NPbmx5KSB7XG4gICAgICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIHZpZGVvIGNvZGVjIGluZm8gQU5EXG4gICAgICAgICAgICAgICAgICAvLyBpZiBhdWRpbyBQSUQgaXMgdW5kZWZpbmVkIE9SIGlmIHdlIGhhdmUgYXVkaW8gY29kZWMgaW5mbyxcbiAgICAgICAgICAgICAgICAgIC8vIHdlIGhhdmUgYWxsIGNvZGVjIGluZm8gIVxuICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F2Y1RyYWNrLmNvZGVjICYmIChhYWNJZCA9PT0gLTEgfHwgdGhpcy5fYWFjVHJhY2suY29kZWMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVtdXgoZGF0YSwgdDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF2Y0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgYXZjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gYWFjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvZGVjc09ubHkpIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhlcmUgd2Ugbm93IHRoYXQgd2UgaGF2ZSBhdWRpbyBjb2RlYyBpbmZvXG4gICAgICAgICAgICAgICAgICAvLyBpZiB2aWRlbyBQSUQgaXMgdW5kZWZpbmVkIE9SIGlmIHdlIGhhdmUgdmlkZW8gY29kZWMgaW5mbyxcbiAgICAgICAgICAgICAgICAgIC8vIHdlIGhhdmUgYWxsIGNvZGVjIGluZm9zICFcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hYWNUcmFjay5jb2RlYyAmJiAoYXZjSWQgPT09IC0xIHx8IHRoaXMuX2F2Y1RyYWNrLmNvZGVjKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbXV4KGRhdGEsIHQwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhYWNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgIGFhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhYWNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGlkM0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlkM0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgaWQzRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGlkM0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgb2Zmc2V0ICs9IGRhdGFbb2Zmc2V0XSArIDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwaWQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUEFUKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IHRoaXMuX3BtdElkKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBNVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgICAgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQgPSB0cnVlO1xuICAgICAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZDtcbiAgICAgICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQ7XG4gICAgICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnVFMgcGFja2V0IGRpZCBub3Qgc3RhcnQgd2l0aCAweDQ3J30pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBwYXJzZSBsYXN0IFBFUyBwYWNrZXRcbiAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgIH1cbiAgICB0aGlzLnJlbXV4KG51bGwsIHQwKTtcbiAgfVxuXG4gIHJlbXV4KGRhdGEsIHQwKSB7XG5cdGxvZ2dlci5pbmZvKCd0c2RlbXV4ZXIgcGFzc2luZyB0MCB0byByZW11eDogJyArIHQwKTtcbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2ssIHRoaXMuX2F2Y1RyYWNrLCB0aGlzLl9pZDNUcmFjaywgdGhpcy5fdHh0VHJhY2ssIHRoaXMudGltZU9mZnNldCwgdGhpcy5jb250aWd1b3VzLCBkYXRhLCB0MCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgcGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBQYWNrZXRpemVkIG1ldGFkYXRhIChJRDMpXG4gICAgICAgIGNhc2UgMHgxNTpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0lEMyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2lkM1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCwgZnJhZywgcGVzRmxhZ3MsIHBlc1ByZWZpeCwgcGVzTGVuLCBwZXNIZHJMZW4sIHBlc0RhdGEsIHBlc1B0cywgcGVzRHRzLCBwYXlsb2FkU3RhcnRPZmZzZXQsIGRhdGEgPSBzdHJlYW0uZGF0YTtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBkYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZiAocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8qIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICAgICAgYXMgUFRTIC8gRFRTIGlzIDMzIGJpdCB3ZSBjYW5ub3QgdXNlIGJpdHdpc2Ugb3BlcmF0b3IgaW4gSlMsXG4gICAgICAgICAgICBhcyBCaXR3aXNlIG9wZXJhdG9ycyB0cmVhdCB0aGVpciBvcGVyYW5kcyBhcyBhIHNlcXVlbmNlIG9mIDMyIGJpdHMgKi9cbiAgICAgICAgcGVzUHRzID0gKGZyYWdbOV0gJiAweDBFKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgIChmcmFnWzEwXSAmIDB4RkYpICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAoZnJhZ1sxMl0gJiAweEZGKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgKGZyYWdbMTNdICYgMHhGRSkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNQdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIGlmIChwZXNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgICBwZXNEdHMgPSAoZnJhZ1sxNF0gJiAweDBFICkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAgIChmcmFnWzE1XSAmIDB4RkYgKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgICAoZnJhZ1sxN10gJiAweEZGICkgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgICAgKGZyYWdbMThdICYgMHhGRSApIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzRHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlc0R0cyA9IHBlc1B0cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVzSGRyTGVuID0gZnJhZ1s4XTtcbiAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IHBlc0hkckxlbiArIDk7XG5cbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgd2hpbGUgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBkYXRhLnNoaWZ0KCk7XG4gICAgICAgIHZhciBsZW4gPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICAgIGlmIChwYXlsb2FkU3RhcnRPZmZzZXQpIHtcbiAgICAgICAgICBpZiAocGF5bG9hZFN0YXJ0T2Zmc2V0ID4gbGVuKSB7XG4gICAgICAgICAgICAvLyB0cmltIGZ1bGwgZnJhZyBpZiBQRVMgaGVhZGVyIGJpZ2dlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldC09bGVuO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRyaW0gcGFydGlhbCBmcmFnIGlmIFBFUyBoZWFkZXIgc21hbGxlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIGZyYWcgPSBmcmFnLnN1YmFycmF5KHBheWxvYWRTdGFydE9mZnNldCk7XG4gICAgICAgICAgICBsZW4tPXBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpKz1sZW47XG4gICAgICB9XG4gICAgICByZXR1cm4ge2RhdGE6IHBlc0RhdGEsIHB0czogcGVzUHRzLCBkdHM6IHBlc0R0cywgbGVuOiBwZXNMZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VBVkNQRVMocGVzLCBmaXJzdEZyYW1lKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSksXG4gICAgICAgIHVuaXRzMiA9IFtdLFxuICAgICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgICBrZXkgPSBmYWxzZSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgZXhwR29sb21iRGVjb2RlcixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBwdXNoLFxuICAgICAgICBpO1xuICAgIC8vIG5vIE5BTHUgZm91bmRcbiAgICBpZiAodW5pdHMubGVuZ3RoID09PSAwICYmIHNhbXBsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYXBwZW5kIHBlcy5kYXRhIHRvIHByZXZpb3VzIE5BTCB1bml0XG4gICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBwZXMuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwgMCk7XG4gICAgICB0bXAuc2V0KHBlcy5kYXRhLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB0cmFjay5sZW4gKz0gcGVzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdmFyIGRlYnVnU3RyaW5nID0gJyc7XG5cblx0dmFyIHR5cGVzID0gJyc7XG5cdHZhciBzaG91bGRFeGl0ID0gZmFsc2U7XG5cblx0dmFyIFNFSUNvdW50ZXIgPSAwO1xuXG4gICAgdW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcblx0XHRpZiAoc2hvdWxkRXhpdCkgcmV0dXJuO1xuXHRcdHR5cGVzICs9ICcgJyArIHVuaXQudHlwZTtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9ORFJcbiAgICAgICAgIGNhc2UgMTpcblx0XHQgICBpZiggZmlyc3RGcmFtZSAmJlxuXHRcdFx0ICAgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSA+IC0xICYmIFxuXHRcdFx0ICAgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTFcblx0XHQgICApIHsgXG5cblx0XHRcdCAgIGNvbnNvbGUud2FybignZmlyc3QgZnJhbWUgd2l0aCAnICsgdW5pdC50eXBlICsgJzsgc2tpcHBpbmcgdG8gcHJldmVudCBjaHJvbWUgaGFyZHdhcmUgZGVjb2RlciBpc3N1ZSBvbiBvc3gnKTsgXG5cdFx0XHQgICBwdXNoID0gZmFsc2U7XG5cdFx0XHQgICBzaG91bGRFeGl0ID0gdHJ1ZTtcblx0XHRcdCAgIHJldHVybiBmYWxzZTtcblx0XHRcdCAgIGJyZWFrO1xuXHRcdCAgIH1cbiAgICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnTkRSICc7XG4gICAgICAgICAgIH1cbiAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0lEUiAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NFSVxuICAgICAgICBjYXNlIDY6XG5cdFx0ICAgU0VJQ291bnRlcisrO1xuXHRcdCAgIGlmKCBmaXJzdEZyYW1lICYmIFxuXHRcdFx0ICAgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSA+IC0xICYmIFxuXHRcdFx0ICAgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEgJiZcblx0XHRcdCAgIFNFSUNvdW50ZXIgPiAxXG5cdFx0ICAgKSB7IFxuXHRcdFx0ICAgIGNvbnNvbGUud2FybignZmlyc3QgZnJhbWUgd2l0aCAnICsgdW5pdC50eXBlICsgJzsgc2tpcHBpbmcgdG8gcHJldmVudCBjaHJvbWUgaGFyZHdhcmUgZGVjb2RlciBpc3N1ZSBvbiBvc3gnKTsgXG5cdFx0XHQgICAgcHVzaCA9IGZhbHNlO1xuXHRcdFx0XHRzaG91bGRFeGl0ID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0ICAgIGJyZWFrO1xuXHRcdCAgICB9XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTRUkgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcblxuICAgICAgICAgIC8vIHNraXAgZnJhbWVUeXBlXG4gICAgICAgICAgZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIHZhciBwYXlsb2FkVHlwZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAvLyBUT0RPOiB0aGVyZSBjYW4gYmUgbW9yZSB0aGFuIG9uZSBwYXlsb2FkIGluIGFuIFNFSSBwYWNrZXQuLi5cbiAgICAgICAgICAvLyBUT0RPOiBuZWVkIHRvIHJlYWQgdHlwZSBhbmQgc2l6ZSBpbiBhIHdoaWxlIGxvb3AgdG8gZ2V0IHRoZW0gYWxsXG4gICAgICAgICAgaWYgKHBheWxvYWRUeXBlID09PSA0KVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHZhciBwYXlsb2FkU2l6ZSA9IDA7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgcGF5bG9hZFNpemUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHBheWxvYWRTaXplID09PSAyNTUpO1xuXG4gICAgICAgICAgICB2YXIgY291bnRyeUNvZGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoY291bnRyeUNvZGUgPT09IDE4MSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdmFyIHByb3ZpZGVyQ29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVTaG9ydCgpO1xuXG4gICAgICAgICAgICAgIGlmIChwcm92aWRlckNvZGUgPT09IDQ5KVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmFyIHVzZXJTdHJ1Y3R1cmUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVSW50KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAodXNlclN0cnVjdHVyZSA9PT0gMHg0NzQxMzkzNClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB2YXIgdXNlckRhdGFUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgLy8gUmF3IENFQS02MDggYnl0ZXMgd3JhcHBlZCBpbiBDRUEtNzA4IHBhY2tldFxuICAgICAgICAgICAgICAgICAgaWYgKHVzZXJEYXRhVHlwZSA9PT0gMylcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpcnN0Qnl0ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZWNvbmRCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgdG90YWxDQ3MgPSAzMSAmIGZpcnN0Qnl0ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJ5dGVBcnJheSA9IFtmaXJzdEJ5dGUsIHNlY29uZEJ5dGVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaT0wOyBpPHRvdGFsQ0NzOyBpKyspXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyAzIGJ5dGVzIHBlciBDQ1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHh0VHJhY2suc2FtcGxlcy5wdXNoKHt0eXBlOiAzLCBwdHM6IHBlcy5wdHMsIGJ5dGVzOiBieXRlQXJyYXl9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNQUygpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgdmFyIGNvZGVjYXJyYXkgPSB1bml0LmRhdGEuc3ViYXJyYXkoMSwgNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgPSAnYXZjMS4nO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdQUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA5OlxuICAgICAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0FVRCAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBwdXNoID0gZmFsc2U7XG4gICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ3Vua25vd24gTkFMICcgKyB1bml0LnR5cGUgKyAnICc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZihwdXNoKSB7XG4gICAgICAgIHVuaXRzMi5wdXNoKHVuaXQpO1xuICAgICAgICBsZW5ndGgrPXVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgIH0pO1xuXG5cdGlmIChmaXJzdEZyYW1lKSB7IFxuXHRcdHR5cGVzID0gJyoqICcgKyB0eXBlczsgXG5cdFx0Y29uc29sZS5pbmZvKHR5cGVzICsgJycpO1xuXHR9XG5cblx0aWYgKHNob3VsZEV4aXQpIHtcblx0XHRjb25zb2xlLndhcm4oJ3NraXBwaW5nIGZyYW1lJyk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cbiAgICBpZihkZWJ1ZyB8fCBkZWJ1Z1N0cmluZy5sZW5ndGgpIHtcbiAgICAgIGxvZ2dlci5sb2coZGVidWdTdHJpbmcpO1xuICAgIH1cbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGlmICh1bml0czIubGVuZ3RoKSB7XG4gICAgICAvLyBvbmx5IHB1c2ggQVZDIHNhbXBsZSBpZiBrZXlmcmFtZSBhbHJlYWR5IGZvdW5kLiBicm93c2VycyBleHBlY3QgYSBrZXlmcmFtZSBhdCBmaXJzdCB0byBzdGFydCBkZWNvZGluZ1xuICAgICAgaWYgKGtleSA9PT0gdHJ1ZSB8fCB0cmFjay5zcHMgKSB7XG4gICAgICAgIGF2Y1NhbXBsZSA9IHt1bml0czogeyB1bml0cyA6IHVuaXRzMiwgbGVuZ3RoIDogbGVuZ3RofSwgcHRzOiBwZXMucHRzLCBkdHM6IHBlcy5kdHMsIGtleToga2V5fTtcbiAgICAgICAgc2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBsZW5ndGg7XG4gICAgICAgIHRyYWNrLm5iTmFsdSArPSB1bml0czIubGVuZ3RoO1xuICAgICAgfVxuICAgIH1cblx0cmV0dXJuIHRydWU7XG4gIH1cblxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsIGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsIHZhbHVlLCBvdmVyZmxvdywgc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCwgbGFzdFVuaXRUeXBlO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmKCB2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSAxICYmIGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgaSAtIHN0YXRlIC0gMSksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzO1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdHMgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLFxuICAgICAgICAgICAgICAgICAgICAgIGxhc3RVbml0ID0gbGFzdFVuaXRzW2xhc3RVbml0cy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLCBvdmVyZmxvdyksIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB0cmFjay5sZW4gKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuaXRzO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBkYXRhID0gcGVzLmRhdGEsXG4gICAgICAgIHB0cyA9IHBlcy5wdHMsXG4gICAgICAgIHN0YXJ0T2Zmc2V0ID0gMCxcbiAgICAgICAgZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbixcbiAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMuYXVkaW9Db2RlYyxcbiAgICAgICAgYWFjT3ZlckZsb3cgPSB0aGlzLmFhY092ZXJGbG93LFxuICAgICAgICBsYXN0QWFjUFRTID0gdGhpcy5sYXN0QWFjUFRTLFxuICAgICAgICBjb25maWcsIGZyYW1lTGVuZ3RoLCBmcmFtZUR1cmF0aW9uLCBmcmFtZUluZGV4LCBvZmZzZXQsIGhlYWRlckxlbmd0aCwgc3RhbXAsIGxlbiwgYWFjU2FtcGxlO1xuICAgIGlmIChhYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGFhY092ZXJGbG93LmJ5dGVMZW5ndGggKyBkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldChhYWNPdmVyRmxvdywgMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsIGFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgLy9sb2dnZXIubG9nKGBBQUM6IGFwcGVuZCBvdmVyZmxvd2luZyAke2FhY092ZXJGbG93LmJ5dGVMZW5ndGh9IGJ5dGVzIHRvIGJlZ2lubmluZyBvZiBuZXcgUEVTYCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAob2Zmc2V0ID0gc3RhcnRPZmZzZXQsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChvZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKG9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke29mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmF0YWwsIHJlYXNvbjogcmVhc29ufSk7XG4gICAgICBpZiAoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIGZyYW1lSW5kZXggPSAwO1xuICAgIGZyYW1lRHVyYXRpb24gPSAxMDI0ICogOTAwMDAgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG5cbiAgICAvLyBpZiBsYXN0IEFBQyBmcmFtZSBpcyBvdmVyZmxvd2luZywgd2Ugc2hvdWxkIGVuc3VyZSB0aW1lc3RhbXBzIGFyZSBjb250aWd1b3VzOlxuICAgIC8vIGZpcnN0IHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGZyYW1lRHVyYXRpb25cbiAgICBpZihhYWNPdmVyRmxvdyAmJiBsYXN0QWFjUFRTKSB7XG4gICAgICB2YXIgbmV3UFRTID0gbGFzdEFhY1BUUytmcmFtZUR1cmF0aW9uO1xuICAgICAgaWYoTWF0aC5hYnMobmV3UFRTLXB0cykgPiAxKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYEFBQzogYWxpZ24gUFRTIGZvciBvdmVybGFwcGluZyBmcmFtZXMgYnkgJHtNYXRoLnJvdW5kKChuZXdQVFMtcHRzKS85MCl9YCk7XG4gICAgICAgIHB0cz1uZXdQVFM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKChvZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gVGhlIHByb3RlY3Rpb24gc2tpcCBiaXQgdGVsbHMgdXMgaWYgd2UgaGF2ZSAyIGJ5dGVzIG9mIENSQyBkYXRhIGF0IHRoZSBlbmQgb2YgdGhlIEFEVFMgaGVhZGVyXG4gICAgICBoZWFkZXJMZW5ndGggPSAoISEoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgZnJhbWVMZW5ndGggPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSkgfFxuICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0ICsgNF0gPDwgMykgfFxuICAgICAgICAgICAgICAgICAgICAoKGRhdGFbb2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBmcmFtZUxlbmd0aCAgLT0gaGVhZGVyTGVuZ3RoO1xuICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG5cbiAgICAgIGlmICgoZnJhbWVMZW5ndGggPiAwKSAmJiAoKG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSA8PSBsZW4pKSB7XG4gICAgICAgIHN0YW1wID0gcHRzICsgZnJhbWVJbmRleCAqIGZyYW1lRHVyYXRpb247XG4gICAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3RvdGFsL3B0czoke29mZnNldCtoZWFkZXJMZW5ndGh9LyR7ZnJhbWVMZW5ndGh9LyR7ZGF0YS5ieXRlTGVuZ3RofS8keyhzdGFtcC85MCkudG9GaXhlZCgwKX1gKTtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoLCBvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCksIHB0czogc3RhbXAsIGR0czogc3RhbXB9O1xuICAgICAgICB0cmFjay5zYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGZyYW1lTGVuZ3RoO1xuICAgICAgICBvZmZzZXQgKz0gZnJhbWVMZW5ndGggKyBoZWFkZXJMZW5ndGg7XG4gICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBvZmZzZXQgPCAobGVuIC0gMSk7IG9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVtvZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9mZnNldCA8IGxlbikge1xuICAgICAgYWFjT3ZlckZsb3cgPSBkYXRhLnN1YmFycmF5KG9mZnNldCwgbGVuKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDOiBvdmVyZmxvdyBkZXRlY3RlZDoke2xlbi1vZmZzZXR9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hYWNPdmVyRmxvdyA9IGFhY092ZXJGbG93O1xuICAgIHRoaXMubGFzdEFhY1BUUyA9IHN0YW1wO1xuICB9XG5cbiAgX3BhcnNlSUQzUEVTKHBlcykge1xuICAgIHRoaXMuX2lkM1RyYWNrLnNhbXBsZXMucHVzaChwZXMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcblxuIiwiZXhwb3J0IGNvbnN0IEVycm9yVHlwZXMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbmV0d29yayBlcnJvciAobG9hZGluZyBlcnJvciAvIHRpbWVvdXQgLi4uKVxuICBORVRXT1JLX0VSUk9SOiAnbmV0d29ya0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtZWRpYSBFcnJvciAodmlkZW8vcGFyc2luZy9tZWRpYXNvdXJjZSBlcnJvcilcbiAgTUVESUFfRVJST1I6ICdtZWRpYUVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYWxsIG90aGVyIGVycm9yc1xuICBPVEhFUl9FUlJPUjogJ290aGVyRXJyb3InXG59O1xuXG5leHBvcnQgY29uc3QgRXJyb3JEZXRhaWxzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX0VSUk9SOiAnbWFuaWZlc3RMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfVElNRU9VVDogJ21hbmlmZXN0TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IHBhcnNpbmcgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfUEFSU0lOR19FUlJPUjogJ21hbmlmZXN0UGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCB3aXRoIG9ubHkgaW5jb21wYXRpYmxlIGNvZGVjcyBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVhc29uIDogZXJyb3IgcmVhc29ufVxuICBNQU5JRkVTVF9JTkNPTVBBVElCTEVfQ09ERUNTX0VSUk9SOiAnbWFuaWZlc3RJbmNvbXBhdGlibGVDb2RlY3NFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SOiAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQ6ICdsZXZlbExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9TV0lUQ0hfRVJST1I6ICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUjogJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOiAnZnJhZ0xvb3BMb2FkaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9USU1FT1VUOiAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBkZWNyeXB0aW9uIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0RFQ1JZUFRfRVJST1I6ICdmcmFnRGVjcnlwdEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1I6ICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEtFWV9MT0FEX0VSUk9SOiAna2V5TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRF9USU1FT1VUOiAna2V5TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmQgZXJyb3IgLSBkYXRhOiBhcHBlbmQgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORF9FUlJPUjogJ2J1ZmZlckFwcGVuZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRJTkdfRVJST1I6ICdidWZmZXJBcHBlbmRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHN0YWxsZWQgZXJyb3IgZXZlbnRcbiAgQlVGRkVSX1NUQUxMRURfRVJST1I6ICdidWZmZXJTdGFsbGVkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBmdWxsIGV2ZW50XG4gIEJVRkZFUl9GVUxMX0VSUk9SOiAnYnVmZmVyRnVsbEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgc2VlayBvdmVyIGhvbGUgZXZlbnRcbiAgQlVGRkVSX1NFRUtfT1ZFUl9IT0xFOiAnYnVmZmVyU2Vla092ZXJIb2xlJ1xufTtcbiIsIi8qXG4qXG4qIEFsbCBvYmplY3RzIGluIHRoZSBldmVudCBoYW5kbGluZyBjaGFpbiBzaG91bGQgaW5oZXJpdCBmcm9tIHRoaXMgY2xhc3NcbipcbiovXG5cbi8vaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMsIC4uLmV2ZW50cykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25FdmVudCA9IHRoaXMub25FdmVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZEV2ZW50cyA9IGV2ZW50cztcbiAgICB0aGlzLnVzZUdlbmVyaWNIYW5kbGVyID0gdHJ1ZTtcblxuICAgIHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy51bnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBpc0V2ZW50SGFuZGxlcigpIHtcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuaGFuZGxlZEV2ZW50cyA9PT0gJ29iamVjdCcgJiYgdGhpcy5oYW5kbGVkRXZlbnRzLmxlbmd0aCAmJiB0eXBlb2YgdGhpcy5vbkV2ZW50ID09PSAnZnVuY3Rpb24nO1xuICB9XG5cbiAgcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ID09PSAnaGxzRXZlbnRHZW5lcmljJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRm9yYmlkZGVuIGV2ZW50IG5hbWU6ICcgKyBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5obHMub24oZXZlbnQsIHRoaXMub25FdmVudCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHVucmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdGhpcy5obHMub2ZmKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAqIGFyZ3VtZW50czogZXZlbnQgKHN0cmluZyksIGRhdGEgKGFueSlcbiAgKi9cbiAgb25FdmVudChldmVudCwgZGF0YSkge1xuICAgIHRoaXMub25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpO1xuICB9XG5cbiAgb25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgZXZlbnRUb0Z1bmN0aW9uID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIHZhciBmdW5jTmFtZSA9ICdvbicgKyBldmVudC5yZXBsYWNlKCdobHMnLCAnJyk7XG4gICAgICBpZiAodHlwZW9mIHRoaXNbZnVuY05hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgJHtldmVudH0gaGFzIG5vIGdlbmVyaWMgaGFuZGxlciBpbiB0aGlzICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBjbGFzcyAodHJpZWQgJHtmdW5jTmFtZX0pYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1tmdW5jTmFtZV0uYmluZCh0aGlzLCBkYXRhKTtcbiAgICB9O1xuICAgIGV2ZW50VG9GdW5jdGlvbi5jYWxsKHRoaXMsIGV2ZW50LCBkYXRhKS5jYWxsKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXZlbnRIYW5kbGVyOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAvLyBmaXJlZCBiZWZvcmUgTWVkaWFTb3VyY2UgaXMgYXR0YWNoaW5nIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhIH1cbiAgTUVESUFfQVRUQUNISU5HOiAnaGxzTWVkaWFBdHRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfQVRUQUNIRUQ6ICdobHNNZWRpYUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgYmVmb3JlIGRldGFjaGluZyBNZWRpYVNvdXJjZSBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNISU5HOiAnaGxzTWVkaWFEZXRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIGRldGFjaGVkIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hFRDogJ2hsc01lZGlhRGV0YWNoZWQnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGJ1ZmZlciBpcyBnb2luZyB0byBiZSByZXNldHRlZFxuICBCVUZGRVJfUkVTRVQ6ICdobHNCdWZmZXJSZXNldCcsXG4gIC8vIGZpcmVkIHdoZW4gd2Uga25vdyBhYm91dCB0aGUgY29kZWNzIHRoYXQgd2UgbmVlZCBidWZmZXJzIGZvciB0byBwdXNoIGludG8gLSBkYXRhOiB7dHJhY2tzIDogeyBjb250YWluZXIsIGNvZGVjLCBsZXZlbENvZGVjLCBpbml0U2VnbWVudCwgbWV0YWRhdGEgfX1cbiAgQlVGRkVSX0NPREVDUzogJ2hsc0J1ZmZlckNvZGVjcycsXG4gIC8vIGZpcmVkIHdoZW4gd2UgYXBwZW5kIGEgc2VnbWVudCB0byB0aGUgYnVmZmVyIC0gZGF0YTogeyBzZWdtZW50OiBzZWdtZW50IG9iamVjdCB9XG4gIEJVRkZFUl9BUFBFTkRJTkc6ICdobHNCdWZmZXJBcHBlbmRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGFyZSBkb25lIHdpdGggYXBwZW5kaW5nIGEgbWVkaWEgc2VnbWVudCB0byB0aGUgYnVmZmVyXG4gIEJVRkZFUl9BUFBFTkRFRDogJ2hsc0J1ZmZlckFwcGVuZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgc3RyZWFtIGlzIGZpbmlzaGVkIGFuZCB3ZSB3YW50IHRvIG5vdGlmeSB0aGUgbWVkaWEgYnVmZmVyIHRoYXQgdGhlcmUgd2lsbCBiZSBubyBtb3JlIGRhdGFcbiAgQlVGRkVSX0VPUzogJ2hsc0J1ZmZlckVvcycsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIG1lZGlhIGJ1ZmZlciBzaG91bGQgYmUgZmx1c2hlZCAtIGRhdGEge3N0YXJ0T2Zmc2V0LCBlbmRPZmZzZXR9XG4gIEJVRkZFUl9GTFVTSElORzogJ2hsc0J1ZmZlckZsdXNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgbWVkaWEgaGFzIGJlZW4gZmx1c2hlZFxuICBCVUZGRVJfRkxVU0hFRDogJ2hsc0J1ZmZlckZsdXNoZWQnLFxuICAvLyBmaXJlZCB0byBzaWduYWwgdGhhdCBhIG1hbmlmZXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBtYW5pZmVzdFVSTH1cbiAgTUFOSUZFU1RfTE9BRElORzogJ2hsc01hbmlmZXN0TG9hZGluZycsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIGZpcnN0TGV2ZWwgOiBpbmRleCBvZiBmaXJzdCBxdWFsaXR5IGxldmVsIGFwcGVhcmluZyBpbiBNYW5pZmVzdH1cbiAgTUFOSUZFU1RfUEFSU0VEOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IGxldmVsIFVSTCAgbGV2ZWwgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkc6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRDogJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgZGV0YWlscyBoYXZlIGJlZW4gdXBkYXRlZCBiYXNlZCBvbiBwcmV2aW91cyBkZXRhaWxzLCBhZnRlciBpdCBoYXMgYmVlbiBsb2FkZWQuIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsIH1cbiAgTEVWRUxfVVBEQVRFRDogJ2hsc0xldmVsVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIFBUUyBpbmZvcm1hdGlvbiBoYXMgYmVlbiB1cGRhdGVkIGFmdGVyIHBhcnNpbmcgYSBmcmFnbWVudCAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCwgZHJpZnQ6IFBUUyBkcmlmdCBvYnNlcnZlZCB3aGVuIHBhcnNpbmcgbGFzdCBmcmFnbWVudCB9XG4gIExFVkVMX1BUU19VUERBVEVEOiAnaGxzTGV2ZWxQdHNVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgc2VpIHRleHQgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBzZWkgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19VU0VSREFUQTogJ2hsc0ZyYWdQYXJzaW5nVXNlcmRhdGEnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgaWQzIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgaWQzIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfTUVUQURBVEE6ICdobHNGcmFnUGFyc2luZ01ldGFkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBkYXRhIGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgZGF0YTEgOiBtb29mIE1QNCBib3ggb3IgVFMgZnJhZ21lbnRzLCBkYXRhMiA6IG1kYXQgTVA0IGJveCBvciBudWxsfVxuICBGUkFHX1BBUlNJTkdfREFUQTogJ2hsc0ZyYWdQYXJzaW5nRGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcGFyc2luZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB1bmRlZmluZWRcbiAgRlJBR19QQVJTRUQ6ICdobHNGcmFnUGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCByZW11eGVkIE1QNCBib3hlcyBoYXZlIGFsbCBiZWVuIGFwcGVuZGVkIGludG8gU291cmNlQnVmZmVyIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIHRwYXJzZWQsIHRidWZmZXJlZCwgbGVuZ3RofSB9XG4gIEZSQUdfQlVGRkVSRUQ6ICdobHNGcmFnQnVmZmVyZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IG1hdGNoaW5nIHdpdGggY3VycmVudCBtZWRpYSBwb3NpdGlvbiBpcyBjaGFuZ2luZyAtIGRhdGEgOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QgfVxuICBGUkFHX0NIQU5HRUQ6ICdobHNGcmFnQ2hhbmdlZCcsXG4gICAgLy8gSWRlbnRpZmllciBmb3IgYSBGUFMgZHJvcCBldmVudCAtIGRhdGE6IHtjdXJlbnREcm9wcGVkLCBjdXJyZW50RGVjb2RlZCwgdG90YWxEcm9wcGVkRnJhbWVzfVxuICBGUFNfRFJPUDogJ2hsc0Zwc0Ryb3AnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbiBlcnJvciBldmVudCAtIGRhdGE6IHsgdHlwZSA6IGVycm9yIHR5cGUsIGRldGFpbHMgOiBlcnJvciBkZXRhaWxzLCBmYXRhbCA6IGlmIHRydWUsIGhscy5qcyBjYW5ub3Qvd2lsbCBub3QgdHJ5IHRvIHJlY292ZXIsIGlmIGZhbHNlLCBobHMuanMgd2lsbCB0cnkgdG8gcmVjb3ZlcixvdGhlciBlcnJvciBzcGVjaWZpYyBkYXRhfVxuICBFUlJPUjogJ2hsc0Vycm9yJyxcbiAgLy8gZmlyZWQgd2hlbiBobHMuanMgaW5zdGFuY2Ugc3RhcnRzIGRlc3Ryb3lpbmcuIERpZmZlcmVudCBmcm9tIE1FRElBX0RFVEFDSEVEIGFzIG9uZSBjb3VsZCB3YW50IHRvIGRldGFjaCBhbmQgcmVhdHRhY2ggYSBtZWRpYSB0byB0aGUgaW5zdGFuY2Ugb2YgaGxzLmpzIHRvIGhhbmRsZSBtaWQtcm9sbHMgZm9yIGV4YW1wbGVcbiAgREVTVFJPWUlORzogJ2hsc0Rlc3Ryb3lpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEtFWV9MT0FESU5HOiAnaGxzS2V5TG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBkZWNyeXB0IGtleSBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGtleSBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEtFWV9MT0FERUQ6ICdobHNLZXlMb2FkZWQnLFxufTtcbiIsIi8qKlxuICogQnVmZmVyIEhlbHBlciBjbGFzcywgcHJvdmlkaW5nIG1ldGhvZHMgZGVhbGluZyBidWZmZXIgbGVuZ3RoIHJldHJpZXZhbFxuKi9cblxuXG5jbGFzcyBCdWZmZXJIZWxwZXIge1xuXG4gIHN0YXRpYyBidWZmZXJJbmZvKG1lZGlhLCBwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgaWYgKG1lZGlhKSB7XG4gICAgICB2YXIgdmJ1ZmZlcmVkID0gbWVkaWEuYnVmZmVyZWQsIGJ1ZmZlcmVkID0gW10saTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB2YnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYnVmZmVyZWQucHVzaCh7c3RhcnQ6IHZidWZmZXJlZC5zdGFydChpKSwgZW5kOiB2YnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5idWZmZXJlZEluZm8oYnVmZmVyZWQscG9zLG1heEhvbGVEdXJhdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7bGVuOiAwLCBzdGFydDogMCwgZW5kOiAwLCBuZXh0U3RhcnQgOiB1bmRlZmluZWR9IDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pIHtcbiAgICB2YXIgYnVmZmVyZWQyID0gW10sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlckxlbixidWZmZXJTdGFydCwgYnVmZmVyRW5kLGJ1ZmZlclN0YXJ0TmV4dCxpO1xuICAgIC8vIHNvcnQgb24gYnVmZmVyLnN0YXJ0L3NtYWxsZXIgZW5kIChJRSBkb2VzIG5vdCBhbHdheXMgcmV0dXJuIHNvcnRlZCBidWZmZXJlZCByYW5nZSlcbiAgICBidWZmZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICB2YXIgZGlmZiA9IGEuc3RhcnQgLSBiLnN0YXJ0O1xuICAgICAgaWYgKGRpZmYpIHtcbiAgICAgICAgcmV0dXJuIGRpZmY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYi5lbmQgLSBhLmVuZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiBtYXhIb2xlRHVyYXRpb24gYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvciAoaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJ1ZjJsZW4gPSBidWZmZXJlZDIubGVuZ3RoO1xuICAgICAgaWYoYnVmMmxlbikge1xuICAgICAgICB2YXIgYnVmMmVuZCA9IGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kO1xuICAgICAgICAvLyBpZiBzbWFsbCBob2xlICh2YWx1ZSBiZXR3ZWVuIDAgb3IgbWF4SG9sZUR1cmF0aW9uICkgb3Igb3ZlcmxhcHBpbmcgKG5lZ2F0aXZlKVxuICAgICAgICBpZigoYnVmZmVyZWRbaV0uc3RhcnQgLSBidWYyZW5kKSA8IG1heEhvbGVEdXJhdGlvbikge1xuICAgICAgICAgIC8vIG1lcmdlIG92ZXJsYXBwaW5nIHRpbWUgcmFuZ2VzXG4gICAgICAgICAgLy8gdXBkYXRlIGxhc3RSYW5nZS5lbmQgb25seSBpZiBzbWFsbGVyIHRoYW4gaXRlbS5lbmRcbiAgICAgICAgICAvLyBlLmcuICBbIDEsIDE1XSB3aXRoICBbIDIsOF0gPT4gWyAxLDE1XSAobm8gbmVlZCB0byBtb2RpZnkgbGFzdFJhbmdlLmVuZClcbiAgICAgICAgICAvLyB3aGVyZWFzIFsgMSwgOF0gd2l0aCAgWyAyLDE1XSA9PiBbIDEsMTVdICggbGFzdFJhbmdlIHNob3VsZCBzd2l0Y2ggZnJvbSBbMSw4XSB0byBbMSwxNV0pXG4gICAgICAgICAgaWYoYnVmZmVyZWRbaV0uZW5kID4gYnVmMmVuZCkge1xuICAgICAgICAgICAgYnVmZmVyZWQyW2J1ZjJsZW4gLSAxXS5lbmQgPSBidWZmZXJlZFtpXS5lbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGJpZyBob2xlXG4gICAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmaXJzdCB2YWx1ZVxuICAgICAgICBidWZmZXJlZDIucHVzaChidWZmZXJlZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zOyBpIDwgYnVmZmVyZWQyLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3RhcnQgPSAgYnVmZmVyZWQyW2ldLnN0YXJ0LFxuICAgICAgICAgIGVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQ7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA+PSBzdGFydCAmJiBwb3MgPCBlbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGVuZDtcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfSBlbHNlIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA8IHN0YXJ0KSB7XG4gICAgICAgIGJ1ZmZlclN0YXJ0TmV4dCA9IHN0YXJ0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cdC8vIGlmKCBidWZmZXJTdGFydCA9PSBidWZmZXJFbmQgJiYgYnVmZmVyRW5kICE9IDApIHsgZGVidWdnZXI7IH1cbiAgICByZXR1cm4ge2xlbjogYnVmZmVyTGVuLCBzdGFydDogYnVmZmVyU3RhcnQsIGVuZDogYnVmZmVyRW5kLCBuZXh0U3RhcnQgOiBidWZmZXJTdGFydE5leHR9O1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVySGVscGVyO1xuIiwiLyoqXG4gKiBMZXZlbCBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgd2l0aCBwbGF5bGlzdCBzbGlkaW5nIGFuZCBkcmlmdFxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIExldmVsSGVscGVyIHtcblxuICBzdGF0aWMgbWVyZ2VEZXRhaWxzKG9sZERldGFpbHMsbmV3RGV0YWlscykge1xuICAgIHZhciBzdGFydCA9IE1hdGgubWF4KG9sZERldGFpbHMuc3RhcnRTTixuZXdEZXRhaWxzLnN0YXJ0U04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZW5kID0gTWF0aC5taW4ob2xkRGV0YWlscy5lbmRTTixuZXdEZXRhaWxzLmVuZFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGRlbHRhID0gbmV3RGV0YWlscy5zdGFydFNOIC0gb2xkRGV0YWlscy5zdGFydFNOLFxuICAgICAgICBvbGRmcmFnbWVudHMgPSBvbGREZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgbmV3ZnJhZ21lbnRzID0gbmV3RGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIGNjT2Zmc2V0ID0wLFxuICAgICAgICBQVFNGcmFnO1xuXG4gICAgLy8gY2hlY2sgaWYgb2xkL25ldyBwbGF5bGlzdHMgaGF2ZSBmcmFnbWVudHMgaW4gY29tbW9uXG4gICAgaWYgKCBlbmQgPCBzdGFydCkge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBsb29wIHRocm91Z2ggb3ZlcmxhcHBpbmcgU04gYW5kIHVwZGF0ZSBzdGFydFBUUyAsIGNjLCBhbmQgZHVyYXRpb24gaWYgYW55IGZvdW5kXG4gICAgZm9yKHZhciBpID0gc3RhcnQgOyBpIDw9IGVuZCA7IGkrKykge1xuICAgICAgdmFyIG9sZEZyYWcgPSBvbGRmcmFnbWVudHNbZGVsdGEraV0sXG4gICAgICAgICAgbmV3RnJhZyA9IG5ld2ZyYWdtZW50c1tpXTtcbiAgICAgIGNjT2Zmc2V0ID0gb2xkRnJhZy5jYyAtIG5ld0ZyYWcuY2M7XG4gICAgICBpZiAoIWlzTmFOKG9sZEZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICAgIG5ld0ZyYWcuc3RhcnQgPSBuZXdGcmFnLnN0YXJ0UFRTID0gb2xkRnJhZy5zdGFydFBUUztcbiAgICAgICAgbmV3RnJhZy5lbmRQVFMgPSBvbGRGcmFnLmVuZFBUUztcbiAgICAgICAgbmV3RnJhZy5kdXJhdGlvbiA9IG9sZEZyYWcuZHVyYXRpb247XG4gICAgICAgIFBUU0ZyYWcgPSBuZXdGcmFnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGNjT2Zmc2V0KSB7XG4gICAgICBsb2dnZXIubG9nKGBkaXNjb250aW51aXR5IHNsaWRpbmcgZnJvbSBwbGF5bGlzdCwgdGFrZSBkcmlmdCBpbnRvIGFjY291bnRgKTtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5jYyArPSBjY09mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiBhdCBsZWFzdCBvbmUgZnJhZ21lbnQgY29udGFpbnMgUFRTIGluZm8sIHJlY29tcHV0ZSBQVFMgaW5mb3JtYXRpb24gZm9yIGFsbCBmcmFnbWVudHNcbiAgICBpZihQVFNGcmFnKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKG5ld0RldGFpbHMsUFRTRnJhZy5zbixQVFNGcmFnLnN0YXJ0UFRTLFBUU0ZyYWcuZW5kUFRTKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYWRqdXN0IHN0YXJ0IGJ5IHNsaWRpbmcgb2Zmc2V0XG4gICAgICB2YXIgc2xpZGluZyA9IG9sZGZyYWdtZW50c1tkZWx0YV0uc3RhcnQ7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uc3RhcnQgKz0gc2xpZGluZztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2UgYXJlIGhlcmUsIGl0IG1lYW5zIHdlIGhhdmUgZnJhZ21lbnRzIG92ZXJsYXBwaW5nIGJldHdlZW5cbiAgICAvLyBvbGQgYW5kIG5ldyBsZXZlbC4gcmVsaWFibGUgUFRTIGluZm8gaXMgdGh1cyByZWx5aW5nIG9uIG9sZCBsZXZlbFxuICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBvbGREZXRhaWxzLlBUU0tub3duO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVGcmFnUFRTKGRldGFpbHMsc24sc3RhcnRQVFMsZW5kUFRTKSB7XG4gICAgdmFyIGZyYWdJZHgsIGZyYWdtZW50cywgZnJhZywgaTtcbiAgICAvLyBleGl0IGlmIHNuIG91dCBvZiByYW5nZVxuICAgIGlmIChzbiA8IGRldGFpbHMuc3RhcnRTTiB8fCBzbiA+IGRldGFpbHMuZW5kU04pIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBmcmFnSWR4ID0gc24gLSBkZXRhaWxzLnN0YXJ0U047XG4gICAgZnJhZ21lbnRzID0gZGV0YWlscy5mcmFnbWVudHM7XG4gICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcblxuXHR2YXIgcHJldkZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCAtIDFdO1xuXHR2YXIgbmV4dEZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCArIDFdO1xuXG4gICAgaWYoIWlzTmFOKGZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICBzdGFydFBUUyA9IE1hdGgubWluKHN0YXJ0UFRTLGZyYWcuc3RhcnRQVFMpO1xuICAgICAgZW5kUFRTID0gTWF0aC5tYXgoZW5kUFRTLCBmcmFnLmVuZFBUUyk7XG4gICAgfVxuXG5cdGlmKCBwcmV2RnJhZyAmJiBNYXRoLmFicyhwcmV2RnJhZy5zdGFydCAtIHN0YXJ0UFRTKSA+IDEwMCkge1xuXHRcdHN0YXJ0UFRTID0gcHJldkZyYWcuc3RhcnQgKyBwcmV2RnJhZy5kdXJhdGlvbjtcblx0XHQvLyBpZiAoZnJhZy5kdXJhdGlvbiA+IDEwMCkgZGVidWdnZXI7XG5cdFx0ZW5kUFRTID0gc3RhcnRQVFMgKyBmcmFnLmR1cmF0aW9uO1xuXHRcdGNvbnNvbGUuaW5mbyhmcmFnLnNuICsgJzogICcgKyBzdGFydFBUUyArICcgLT4gJyArIGVuZFBUUyArICcgfCAnICsgZnJhZy5kdXJhdGlvbik7XG5cdFx0Ly8gZGVidWdnZXI7XG5cdH0gZWxzZSBpZiggbmV4dEZyYWcgJiYgTWF0aC5hYnMobmV4dEZyYWcuc3RhcnQgLSBzdGFydFBUUykgPiAxMDApIHtcblx0XHQvLyBzdGFydFBUUyA9IG5leHRGcmFnLnN0YXJ0ICsgbmV4dEZyYWcuZHVyYXRpb247XG5cdFx0Ly8gZW5kUFRTID0gc3RhcnRQVFMgKyBmcmFnLmR1cmF0aW9uO1xuXHRcdC8vIGNvbnNvbGUubG9nKGZyYWcuc24gKyAnOiAgJyArIHN0YXJ0UFRTICsgJyAtPiAnICsgZW5kUFRTICsgJyB8ICcgKyBmcmFnLmR1cmF0aW9uKTtcblx0XHQvLyBkZWJ1Z2dlcjtcblx0fVxuXG4gICBpZiggTWF0aC5hYnMoc3RhcnRQVFMgLSBlbmRQVFMpID4gMTAwKSB7XG5cdCAgIC8vIHZhciBvbGRFbmRQVFMgPSBlbmRQVFM7XG5cdCAgIGVuZFBUUyA9IHN0YXJ0UFRTICsgZnJhZy5kdXJhdGlvbjtcblx0ICAgLy8gY29uc29sZS5pbmZvKCdhZGp1c3RpbmcgZW5kUFRTOiAnICsgb2xkRW5kUFRTICsgJyAtPiAnICsgZW5kUFRTKTtcbiAgIH1cblxuICAgIHZhciBkcmlmdCA9IHN0YXJ0UFRTIC0gZnJhZy5zdGFydDtcblxuICAgIGZyYWcuc3RhcnQgPSBmcmFnLnN0YXJ0UFRTID0gc3RhcnRQVFM7XG4gICAgZnJhZy5lbmRQVFMgPSBlbmRQVFM7XG4gICAgZnJhZy5kdXJhdGlvbiA9IGVuZFBUUyAtIHN0YXJ0UFRTO1xuXG5cdC8vIGlmIChmcmFnLmR1cmF0aW9uID4gMTAwKSBkZWJ1Z2dlcjtcblx0XG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bS0xIHRvIGZyYWcgMFxuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPiAwIDsgaS0tKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaS0xKTtcbiAgICB9XG5cbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtIHRvIGxhc3QgZnJhZ1xuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPCBmcmFnbWVudHMubGVuZ3RoIC0gMSA7IGkrKykge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGkrMSk7XG4gICAgfVxuICAgIGRldGFpbHMuUFRTS25vd24gPSB0cnVlO1xuICAgIC8vbG9nZ2VyLmxvZyhgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFnIHN0YXJ0L2VuZDoke3N0YXJ0UFRTLnRvRml4ZWQoMyl9LyR7ZW5kUFRTLnRvRml4ZWQoMyl9YCk7XG5cbiAgICByZXR1cm4gZHJpZnQ7XG4gIH1cblxuICBzdGF0aWMgdXBkYXRlUFRTKGZyYWdtZW50cyxmcm9tSWR4LCB0b0lkeCkge1xuICAgIHZhciBmcmFnRnJvbSA9IGZyYWdtZW50c1tmcm9tSWR4XSxmcmFnVG8gPSBmcmFnbWVudHNbdG9JZHhdLCBmcmFnVG9QVFMgPSBmcmFnVG8uc3RhcnRQVFM7XG4gICAgLy8gaWYgd2Uga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICBpZighaXNOYU4oZnJhZ1RvUFRTKSkge1xuICAgICAgLy8gdXBkYXRlIGZyYWdtZW50IGR1cmF0aW9uLlxuICAgICAgLy8gaXQgaGVscHMgdG8gZml4IGRyaWZ0cyBiZXR3ZWVuIHBsYXlsaXN0IHJlcG9ydGVkIGR1cmF0aW9uIGFuZCBmcmFnbWVudCByZWFsIGR1cmF0aW9uXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdGcm9tLmR1cmF0aW9uID0gZnJhZ1RvUFRTLWZyYWdGcm9tLnN0YXJ0O1xuICAgICAgICBpZihmcmFnRnJvbS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciBmcmFnICR7ZnJhZ0Zyb20uc259LGxldmVsICR7ZnJhZ0Zyb20ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ1RvLmR1cmF0aW9uID0gZnJhZ0Zyb20uc3RhcnQgLSBmcmFnVG9QVFM7XG4gICAgICAgIGlmKGZyYWdUby5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciBmcmFnICR7ZnJhZ1RvLnNufSxsZXZlbCAke2ZyYWdUby5sZXZlbH0sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdlIGRvbnQga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgKyBmcmFnRnJvbS5kdXJhdGlvbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvLmR1cmF0aW9uO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbEhlbHBlcjtcbiIsIi8qKlxuICogSExTIGludGVyZmFjZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBBYnJDb250cm9sbGVyIGZyb20gICAgJy4vY29udHJvbGxlci9hYnItY29udHJvbGxlcic7XG5pbXBvcnQgQnVmZmVyQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL2J1ZmZlci1jb250cm9sbGVyJztcbmltcG9ydCBDYXBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9jYXAtbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQgU3RyZWFtQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCBUaW1lbGluZUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL3RpbWVsaW5lLWNvbnRyb2xsZXInO1xuLy9pbXBvcnQgRlBTQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvZnBzLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsIGVuYWJsZUxvZ3N9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgZnJvbSAnLi91dGlscy94aHItbG9hZGVyJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCBLZXlMb2FkZXIgZnJvbSAnLi9sb2FkZXIva2V5LWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIHdpbmRvdy5NZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgc3RhdGljIGdldCBEZWZhdWx0Q29uZmlnKCkge1xuICAgIGlmKCFIbHMuZGVmYXVsdENvbmZpZykge1xuICAgICAgIEhscy5kZWZhdWx0Q29uZmlnID0ge1xuICAgICAgICAgIGF1dG9TdGFydExvYWQ6IHRydWUsXG4gICAgICAgICAgZGVidWc6IHRydWUsXG4gICAgICAgICAgY2FwTGV2ZWxUb1BsYXllclNpemU6IGZhbHNlLFxuICAgICAgICAgIG1heEJ1ZmZlckxlbmd0aDogMzAsXG4gICAgICAgICAgbWF4QnVmZmVyU2l6ZTogNjAgKiAxMDAwICogMTAwMCxcbiAgICAgICAgICBtYXhCdWZmZXJIb2xlOiA1LFxuICAgICAgICAgIG1heFNlZWtIb2xlOiAyLFxuICAgICAgICAgIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgOiAwLjIsXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbkNvdW50OjMsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50OiBJbmZpbml0eSxcbiAgICAgICAgICBsaXZlU3luY0R1cmF0aW9uOiB1bmRlZmluZWQsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgIG1heE1heEJ1ZmZlckxlbmd0aDogNjAwLFxuICAgICAgICAgIGVuYWJsZVdvcmtlcjogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVTb2Z0d2FyZUFFUzogdHJ1ZSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeTogMSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ1RpbWVPdXQ6IDEwMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ01heFJldHJ5OiA0LFxuICAgICAgICAgIGxldmVsTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0OiAyMDAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ01heFJldHJ5OiAyMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkOiAzLFxuICAgICAgICAgIHN0YXJ0RnJhZ1ByZWZldGNoIDogZmFsc2UsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2Q6IDUwMDAsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQ6IDAuMixcbiAgICAgICAgICBhcHBlbmRFcnJvck1heFJldHJ5OiAzLFxuICAgICAgICAgIGxvYWRlcjogWGhyTG9hZGVyLFxuICAgICAgICAgIGZMb2FkZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgYWJyQ29udHJvbGxlciA6IEFickNvbnRyb2xsZXIsXG4gICAgICAgICAgYnVmZmVyQ29udHJvbGxlciA6IEJ1ZmZlckNvbnRyb2xsZXIsXG4gICAgICAgICAgY2FwTGV2ZWxDb250cm9sbGVyIDogQ2FwTGV2ZWxDb250cm9sbGVyLFxuICAgICAgICAgIHN0cmVhbUNvbnRyb2xsZXI6IFN0cmVhbUNvbnRyb2xsZXIsXG4gICAgICAgICAgdGltZWxpbmVDb250cm9sbGVyOiBUaW1lbGluZUNvbnRyb2xsZXIsXG4gICAgICAgICAgZW5hYmxlQ0VBNzA4Q2FwdGlvbnM6IHRydWUsXG4gICAgICAgICAgZW5hYmxlTVAyVFBhc3NUaHJvdWdoIDogZmFsc2UsXG4gICAgICAgICAgcXVpY2tMb2FkU2Vla1RocmVzaG9sZDogMS8zXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBIbHMuZGVmYXVsdENvbmZpZztcbiAgfVxuXG4gIHN0YXRpYyBzZXQgRGVmYXVsdENvbmZpZyhkZWZhdWx0Q29uZmlnKSB7XG4gICAgSGxzLmRlZmF1bHRDb25maWcgPSBkZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICB2YXIgZGVmYXVsdENvbmZpZyA9IEhscy5EZWZhdWx0Q29uZmlnO1xuXG4gICAgaWYgKChjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50IHx8IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQpICYmIChjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBkb25cXCd0IG1peCB1cCBsaXZlU3luY0R1cmF0aW9uQ291bnQvbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IGFuZCBsaXZlU3luY0R1cmF0aW9uL2xpdmVNYXhMYXRlbmN5RHVyYXRpb24nKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGRlZmF1bHRDb25maWcpIHtcbiAgICAgICAgaWYgKHByb3AgaW4gY29uZmlnKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgIGNvbmZpZ1twcm9wXSA9IGRlZmF1bHRDb25maWdbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgIT09IHVuZGVmaW5lZCAmJiBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IDw9IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBcImxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudFwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uQ291bnRcIicpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvblwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uXCInKTtcbiAgICB9XG5cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG5cbiAgICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy50cmlnZ2VyID0gb2JzZXJ2ZXIudHJpZ2dlci5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYWJyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmJ1ZmZlckNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmNhcExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnN0cmVhbUNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnRpbWVsaW5lQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmtleUxvYWRlciA9IG5ldyBLZXlMb2FkZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVzdHJveScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5ERVNUUk9ZSU5HKTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMua2V5TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIHRoaXMub2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hNZWRpYShtZWRpYSkge1xuICAgIGxvZ2dlci5sb2coJ2F0dGFjaE1lZGlhJyk7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHttZWRpYTogbWVkaWF9KTtcbiAgfVxuXG4gIGRldGFjaE1lZGlhKCkge1xuICAgIGxvZ2dlci5sb2coJ2RldGFjaE1lZGlhJyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSElORyk7XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FESU5HLCB7dXJsOiB1cmx9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZChzdGFydFBvc2l0aW9uPTApIHtcbiAgICBsb2dnZXIubG9nKCdzdGFydExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExvYWQoKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb24pO1xuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RvcExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3dhcEF1ZGlvQ29kZWMnKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3dhcEF1ZGlvQ29kZWMoKTtcbiAgfVxuXG4gIHJlY292ZXJNZWRpYUVycm9yKCkge1xuICAgIGxvZ2dlci5sb2coJ3JlY292ZXJNZWRpYUVycm9yJyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5hdHRhY2hNZWRpYShtZWRpYSk7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgY3VycmVudExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sb2FkTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gbmV4dCBwbGF5YmFjayBxdWFsaXR5IGxldmVsIChxdWFsaXR5IGxldmVsIG9mIG5leHQgZnJhZ21lbnQpICoqL1xuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbmV4dExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IG5leHRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBsb2FkTGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIHNldCBuZXh0TG9hZExldmVsKGxldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGZpcnN0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBzdGFydExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiLy8gVGhpcyBpcyBtb3N0bHkgZm9yIHN1cHBvcnQgb2YgdGhlIGVzNiBtb2R1bGUgZXhwb3J0XG4vLyBzeW50YXggd2l0aCB0aGUgYmFiZWwgY29tcGlsZXIsIGl0IGxvb2tzIGxpa2UgaXQgZG9lc250IHN1cHBvcnRcbi8vIGZ1bmN0aW9uIGV4cG9ydHMgbGlrZSB3ZSBhcmUgdXNlZCB0byBpbiBub2RlL2NvbW1vbmpzXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vaGxzLmpzJykuZGVmYXVsdDtcblxuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEZyYWdtZW50TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIDEsIDAsIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIERlY3J5cHQga2V5IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEtleUxvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5LRVlfTE9BRElORyk7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gbnVsbDtcbiAgICB0aGlzLmRlY3J5cHR1cmwgPSBudWxsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbktleUxvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnID0gZGF0YS5mcmFnLFxuICAgICAgICBkZWNyeXB0ZGF0YSA9IGZyYWcuZGVjcnlwdGRhdGEsXG4gICAgICAgIHVyaSA9IGRlY3J5cHRkYXRhLnVyaTtcbiAgICAgICAgLy8gaWYgdXJpIGlzIGRpZmZlcmVudCBmcm9tIHByZXZpb3VzIG9uZSBvciBpZiBkZWNyeXB0IGtleSBub3QgcmV0cmlldmVkIHlldFxuICAgICAgaWYgKHVyaSAhPT0gdGhpcy5kZWNyeXB0dXJsIHx8IHRoaXMuZGVjcnlwdGtleSA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgICAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICAgICAgdGhpcy5kZWNyeXB0dXJsID0gdXJpO1xuICAgICAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgICAgICBmcmFnLmxvYWRlci5sb2FkKHVyaSwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5kZWNyeXB0a2V5KSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbG9hZGVkIHRoaXMga2V5LCByZXR1cm4gaXRcbiAgICAgICAgZGVjcnlwdGRhdGEua2V5ID0gdGhpcy5kZWNyeXB0a2V5O1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICB9XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IGZyYWcuZGVjcnlwdGRhdGEua2V5ID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZSk7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICBmcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcblxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEtleUxvYWRlcjtcbiIsIi8qKlxuICogUGxheWxpc3QgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBVUkxIZWxwZXIgZnJvbSAnLi4vdXRpbHMvdXJsJztcbmltcG9ydCBBdHRyTGlzdCBmcm9tICcuLi91dGlscy9hdHRyLWxpc3QnO1xuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgUGxheWxpc3RMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5MRVZFTF9MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG5cdHRoaXMudG90YWxEdXJhdGlvbiA9IDA7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBudWxsKTtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsIGRhdGEubGV2ZWwsIGRhdGEuaWQpO1xuXHR0aGlzLnRvdGFsRHVyYXRpb24gPSBkYXRhLnRvdGFsRHVyYXRpb24gfHwgMDtcbiAgfVxuXG4gIGxvYWQodXJsLCBpZDEsIGlkMikge1xuICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWcsXG4gICAgICAgIHJldHJ5LFxuICAgICAgICB0aW1lb3V0LFxuICAgICAgICByZXRyeURlbGF5O1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuaWQgPSBpZDE7XG4gICAgdGhpcy5pZDIgPSBpZDI7XG4gICAgaWYodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgcmV0cnkgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk7XG4gICAgICB0aW1lb3V0ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1RpbWVPdXQ7XG4gICAgICByZXRyeURlbGF5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLmxldmVsTG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5sZXZlbExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5sZXZlbExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH1cbiAgICB0aGlzLmxvYWRlciA9IHR5cGVvZihjb25maWcucExvYWRlcikgIT09ICd1bmRlZmluZWQnID8gbmV3IGNvbmZpZy5wTG9hZGVyKGNvbmZpZykgOiBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCAnJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIHRpbWVvdXQsIHJldHJ5LCByZXRyeURlbGF5KTtcbiAgfVxuXG4gIHJlc29sdmUodXJsLCBiYXNlVXJsKSB7XG4gICAgcmV0dXJuIFVSTEhlbHBlci5idWlsZEFic29sdXRlVVJMKGJhc2VVcmwsIHVybCk7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgYmFzZXVybCkge1xuICAgIGxldCBsZXZlbHMgPSBbXSwgcmVzdWx0O1xuXG4gICAgLy8gaHR0cHM6Ly9yZWdleDEwMS5jb20gaXMgeW91ciBmcmllbmRcbiAgICBjb25zdCByZSA9IC8jRVhULVgtU1RSRUFNLUlORjooW15cXG5cXHJdKilbXFxyXFxuXSsoW15cXHJcXG5dKykvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlLmV4ZWMoc3RyaW5nKSkgIT0gbnVsbCl7XG4gICAgICBjb25zdCBsZXZlbCA9IHt9O1xuXG4gICAgICB2YXIgYXR0cnMgPSBsZXZlbC5hdHRycyA9IG5ldyBBdHRyTGlzdChyZXN1bHRbMV0pO1xuICAgICAgbGV2ZWwudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG5cbiAgICAgIHZhciByZXNvbHV0aW9uID0gYXR0cnMuZGVjaW1hbFJlc29sdXRpb24oJ1JFU09MVVRJT04nKTtcbiAgICAgIGlmKHJlc29sdXRpb24pIHtcbiAgICAgICAgbGV2ZWwud2lkdGggPSByZXNvbHV0aW9uLndpZHRoO1xuICAgICAgICBsZXZlbC5oZWlnaHQgPSByZXNvbHV0aW9uLmhlaWdodDtcbiAgICAgIH1cbiAgICAgIGxldmVsLmJpdHJhdGUgPSBhdHRycy5kZWNpbWFsSW50ZWdlcignQkFORFdJRFRIJyk7XG4gICAgICBsZXZlbC5uYW1lID0gYXR0cnMuTkFNRTtcblxuICAgICAgdmFyIGNvZGVjcyA9IGF0dHJzLkNPREVDUztcbiAgICAgIGlmKGNvZGVjcykge1xuICAgICAgICBjb2RlY3MgPSBjb2RlY3Muc3BsaXQoJywnKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2RlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBjb2RlYyA9IGNvZGVjc1tpXTtcbiAgICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignYXZjMScpICE9PSAtMSkge1xuICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV2ZWwuYXVkaW9Db2RlYyA9IGNvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBhdmMxdG9hdmNvdGkoY29kZWMpIHtcbiAgICB2YXIgcmVzdWx0LCBhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZiAoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMDAnICsgcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNikpLnN1YnN0cigtNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGNvZGVjO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgY2xvbmVPYmoob2JqKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZCkge1xuICAgIHZhciBjdXJyZW50U04gPSAwLFxuICAgICAgICB0b3RhbGR1cmF0aW9uID0gMCxcbiAgICAgICAgbGV2ZWwgPSB7dXJsOiBiYXNldXJsLCBmcmFnbWVudHM6IFtdLCBsaXZlOiB0cnVlLCBzdGFydFNOOiAwfSxcbiAgICAgICAgbGV2ZWxrZXkgPSB7bWV0aG9kIDogbnVsbCwga2V5IDogbnVsbCwgaXYgOiBudWxsLCB1cmkgOiBudWxsfSxcbiAgICAgICAgY2MgPSAwLFxuICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsLFxuICAgICAgICBmcmFnID0gbnVsbCxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICByZWdleHAsXG4gICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCxcbiAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQsXG5cdFx0bmV4dFRpbWVzdGFtcDtcblxuXHR2YXIgcmUgPSAgLyhcXGQrKV9cXGQrLnRzLztcblxuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVC1YLShLRVkpOiguKikpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSooW1xcclxcbl0rW14jfFxcclxcbl0rKT8pfCg/OiNFWFQtWC0oQllURVJBTkdFKTooW1xcZF0rW0BbXFxkXSopXSpbXFxyXFxuXSsoW14jfFxcclxcbl0rKT98KD86I0VYVC1YLShFTkRMSVNUKSl8KD86I0VYVC1YLShESVMpQ09OVElOVUlUWSkpfCg/OiNFWFQtWC0oUFJPR1JBTS1EQVRFLVRJTUUpOiguKikpL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCkge1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4pIHsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpOyB9KTtcbiAgICAgIHN3aXRjaCAocmVzdWx0WzBdKSB7XG4gICAgICAgIGNhc2UgJ01FRElBLVNFUVVFTkNFJzpcbiAgICAgICAgICBjdXJyZW50U04gPSBsZXZlbC5zdGFydFNOID0gcGFyc2VJbnQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnVEFSR0VURFVSQVRJT04nOlxuICAgICAgICAgIGxldmVsLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBsZXZlbC5saXZlID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0RJUyc6XG4gICAgICAgICAgY2MrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnQllURVJBTkdFJzpcbiAgICAgICAgICB2YXIgcGFyYW1zID0gcmVzdWx0WzFdLnNwbGl0KCdAJyk7XG4gICAgICAgICAgaWYgKHBhcmFtcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1swXSkgKyBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICBpZiAoZnJhZyAmJiAhZnJhZy51cmwpIHtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGlmICghaXNOYU4oZHVyYXRpb24pKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ2RlY3J5cHRkYXRhLFxuICAgICAgICAgICAgICAgIHNuID0gY3VycmVudFNOKys7XG4gICAgICAgICAgICBpZiAobGV2ZWxrZXkubWV0aG9kICYmIGxldmVsa2V5LnVyaSAmJiAhbGV2ZWxrZXkuaXYpIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gdGhpcy5jbG9uZU9iaihsZXZlbGtleSk7XG4gICAgICAgICAgICAgIHZhciB1aW50OFZpZXcgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxMjsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgICAgICAgICB1aW50OFZpZXdbaV0gPSAoc24gPj4gOCooMTUtaSkpICYgMHhmZjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEuaXYgPSB1aW50OFZpZXc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSBsZXZlbGtleTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB1cmwgPSByZXN1bHRbMl0gPyB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKSA6IG51bGw7XG5cblx0XHRcdHZhciBtYXRjaCA9IHJlLmV4ZWMoIHVybCApO1xuXHRcdFx0dmFyIHRpbWVzdGFtcCA9IChtYXRjaCAmJiBtYXRjaFsxXSkgPyBtYXRjaFsxXSA6IG51bGw7XG5cblx0XHRcdC8vIGlmICh0aW1lc3RhbXAgJiYgbmV4dFRpbWVzdGFtcCkge1xuXHRcdFx0Ly8gXHR0aW1lc3RhbXAgPSBwYXJzZUludCggdGltZXN0YW1wICk7XG5cdFx0XHQvLyBcdGlmICggdGltZXN0YW1wIC0gbmV4dFRpbWVzdGFtcCA+IDIwMDAgKSB7XG5cdFx0XHQvLyBcdFx0Y29uc29sZS5sb2coIHRpbWVzdGFtcCArICcgJyArIG5leHRUaW1lc3RhbXAgKyAnICcgKyB1cmwgKTtcblx0XHRcdC8vIFx0XHRjYysrO1xuXHRcdFx0Ly8gXHR9XG5cdFx0XHQvLyB9XG5cblx0XHRcdG5leHRUaW1lc3RhbXAgPSB0aW1lc3RhbXAgKyBkdXJhdGlvbioxMDAwO1xuXG4gICAgICAgICAgICBmcmFnID0ge3VybDogdXJsLCBkdXJhdGlvbjogZHVyYXRpb24sIHN0YXJ0OiB0b3RhbGR1cmF0aW9uLCBzbjogc24sIGxldmVsOiBpZCwgY2M6IGNjLCBieXRlUmFuZ2VTdGFydE9mZnNldDogYnl0ZVJhbmdlU3RhcnRPZmZzZXQsIGJ5dGVSYW5nZUVuZE9mZnNldDogYnl0ZVJhbmdlRW5kT2Zmc2V0LCBkZWNyeXB0ZGF0YSA6IGZyYWdkZWNyeXB0ZGF0YSwgcHJvZ3JhbURhdGVUaW1lOiBwcm9ncmFtRGF0ZVRpbWV9O1xuICAgICAgICAgICAgbGV2ZWwuZnJhZ21lbnRzLnB1c2goZnJhZyk7XG4gICAgICAgICAgICB0b3RhbGR1cmF0aW9uICs9IGR1cmF0aW9uO1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBudWxsO1xuICAgICAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0tFWSc6XG4gICAgICAgICAgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL2RyYWZ0LXBhbnRvcy1odHRwLWxpdmUtc3RyZWFtaW5nLTA4I3NlY3Rpb24tMy40LjRcbiAgICAgICAgICB2YXIgZGVjcnlwdHBhcmFtcyA9IHJlc3VsdFsxXTtcbiAgICAgICAgICB2YXIga2V5QXR0cnMgPSBuZXcgQXR0ckxpc3QoZGVjcnlwdHBhcmFtcyk7XG4gICAgICAgICAgdmFyIGRlY3J5cHRtZXRob2QgPSBrZXlBdHRycy5lbnVtZXJhdGVkU3RyaW5nKCdNRVRIT0QnKSxcbiAgICAgICAgICAgICAgZGVjcnlwdHVyaSA9IGtleUF0dHJzLlVSSSxcbiAgICAgICAgICAgICAgZGVjcnlwdGl2ID0ga2V5QXR0cnMuaGV4YWRlY2ltYWxJbnRlZ2VyKCdJVicpO1xuICAgICAgICAgIGlmIChkZWNyeXB0bWV0aG9kKSB7XG4gICAgICAgICAgICBsZXZlbGtleSA9IHsgbWV0aG9kOiBudWxsLCBrZXk6IG51bGwsIGl2OiBudWxsLCB1cmk6IG51bGwgfTtcbiAgICAgICAgICAgIGlmICgoZGVjcnlwdHVyaSkgJiYgKGRlY3J5cHRtZXRob2QgPT09ICdBRVMtMTI4JykpIHtcbiAgICAgICAgICAgICAgbGV2ZWxrZXkubWV0aG9kID0gZGVjcnlwdG1ldGhvZDtcbiAgICAgICAgICAgICAgLy8gVVJJIHRvIGdldCB0aGUga2V5XG4gICAgICAgICAgICAgIGxldmVsa2V5LnVyaSA9IHRoaXMucmVzb2x2ZShkZWNyeXB0dXJpLCBiYXNldXJsKTtcbiAgICAgICAgICAgICAgbGV2ZWxrZXkua2V5ID0gbnVsbDtcbiAgICAgICAgICAgICAgLy8gSW5pdGlhbGl6YXRpb24gVmVjdG9yIChJVilcbiAgICAgICAgICAgICAgbGV2ZWxrZXkuaXYgPSBkZWNyeXB0aXY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdQUk9HUkFNLURBVEUtVElNRSc6XG4gICAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbmV3IERhdGUoRGF0ZS5wYXJzZShyZXN1bHRbMV0pKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmb3VuZCAnICsgbGV2ZWwuZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgaWYoZnJhZyAmJiAhZnJhZy51cmwpIHtcbiAgICAgIGxldmVsLmZyYWdtZW50cy5wb3AoKTtcbiAgICAgIHRvdGFsZHVyYXRpb24tPWZyYWcuZHVyYXRpb247XG4gICAgfVxuICAgIGxldmVsLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIGxldmVsLmVuZFNOID0gY3VycmVudFNOIC0gMTtcblxuXHRpZiAobGV2ZWwubGl2ZSkge1xuXHRcdHZhciBlbmRQVFM7XG5cdFx0Zm9yICh2YXIgaSBpbiBsZXZlbC5mcmFnbWVudHMpIHtcblx0XHRcdHZhciBmID0gbGV2ZWwuZnJhZ21lbnRzW2ldO1xuXHRcdFx0Zi5zdGFydCA9IHBhcnNlSW50KCB0aGlzLnRvdGFsRHVyYXRpb24gKTtcblx0XHRcdGVuZFBUUyA9IGYuZW5kUFRTO1xuXHRcdH1cblx0XHRsZXZlbC50b3RhbGR1cmF0aW9uID0gZW5kUFRTID8gZW5kUFRTIDogbGV2ZWwudG90YWxkdXJhdGlvbiArIHRoaXMudG90YWxEdXJhdGlvbjtcblx0fVxuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciB0YXJnZXQgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdHJpbmcgPSB0YXJnZXQucmVzcG9uc2VUZXh0LFxuICAgICAgICB1cmwgPSB0YXJnZXQucmVzcG9uc2VVUkwsXG4gICAgICAgIGlkID0gdGhpcy5pZCxcbiAgICAgICAgaWQyID0gdGhpcy5pZDIsXG4gICAgICAgIGhscyA9IHRoaXMuaGxzLFxuICAgICAgICBsZXZlbHM7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYgKHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWxsYmFjayB0byBpbml0aWFsIFVSTFxuICAgICAgdXJsID0gdGhpcy51cmw7XG4gICAgfVxuICAgIHN0YXRzLnRsb2FkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZSh0YXJnZXQuZ2V0UmVzcG9uc2VIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnKSk7XG4gICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdFxuICAgICAgICAvLyBpZiBmaXJzdCByZXF1ZXN0LCBmaXJlIG1hbmlmZXN0IGxvYWRlZCBldmVudCwgbGV2ZWwgd2lsbCBiZSByZWxvYWRlZCBhZnRlcndhcmRzXG4gICAgICAgIC8vICh0aGlzIGlzIHRvIGhhdmUgYSB1bmlmb3JtIGxvZ2ljIGZvciAxIGxldmVsL211bHRpbGV2ZWwgcGxheWxpc3RzKVxuICAgICAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogW3t1cmw6IHVybH1dLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGxldmVsRGV0YWlscyA9IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgdXJsLCBpZCk7XG4gICAgICAgICAgc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCwge2RldGFpbHM6IGxldmVsRGV0YWlscywgbGV2ZWw6IGlkLCBpZDogaWQyLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgdXJsKTtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgaWYgKGxldmVscy5sZW5ndGgpIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IGxldmVscywgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6IGV2ZW50LmN1cnJlbnRUYXJnZXQsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5bGlzdExvYWRlcjtcbiIsIi8qKlxuICogR2VuZXJhdGUgTVA0IEJveFxuKi9cblxuLy9pbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG5jbGFzcyBNUDQge1xuICBzdGF0aWMgaW5pdCgpIHtcbiAgICBNUDQudHlwZXMgPSB7XG4gICAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgICAgYXZjQzogW10sXG4gICAgICBidHJ0OiBbXSxcbiAgICAgIGRpbmY6IFtdLFxuICAgICAgZHJlZjogW10sXG4gICAgICBlc2RzOiBbXSxcbiAgICAgIGZ0eXA6IFtdLFxuICAgICAgaGRscjogW10sXG4gICAgICBtZGF0OiBbXSxcbiAgICAgIG1kaGQ6IFtdLFxuICAgICAgbWRpYTogW10sXG4gICAgICBtZmhkOiBbXSxcbiAgICAgIG1pbmY6IFtdLFxuICAgICAgbW9vZjogW10sXG4gICAgICBtb292OiBbXSxcbiAgICAgIG1wNGE6IFtdLFxuICAgICAgbXZleDogW10sXG4gICAgICBtdmhkOiBbXSxcbiAgICAgIHNkdHA6IFtdLFxuICAgICAgc3RibDogW10sXG4gICAgICBzdGNvOiBbXSxcbiAgICAgIHN0c2M6IFtdLFxuICAgICAgc3RzZDogW10sXG4gICAgICBzdHN6OiBbXSxcbiAgICAgIHN0dHM6IFtdLFxuICAgICAgdGZkdDogW10sXG4gICAgICB0ZmhkOiBbXSxcbiAgICAgIHRyYWY6IFtdLFxuICAgICAgdHJhazogW10sXG4gICAgICB0cnVuOiBbXSxcbiAgICAgIHRyZXg6IFtdLFxuICAgICAgdGtoZDogW10sXG4gICAgICB2bWhkOiBbXSxcbiAgICAgIHNtaGQ6IFtdXG4gICAgfTtcblxuICAgIHZhciBpO1xuICAgIGZvciAoaSBpbiBNUDQudHlwZXMpIHtcbiAgICAgIGlmIChNUDQudHlwZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgTVA0LnR5cGVzW2ldID0gW1xuICAgICAgICAgIGkuY2hhckNvZGVBdCgwKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMSksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDIpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgzKVxuICAgICAgICBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB2aWRlb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgdmFyIGF1ZGlvSGRsciA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG5cbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6IHZpZGVvSGRscixcbiAgICAgICdhdWRpbyc6IGF1ZGlvSGRsclxuICAgIH07XG5cbiAgICB2YXIgZHJlZiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcblxuICAgIHZhciBzdGNvID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAgLy8gZW50cnlfY291bnRcbiAgICBdKTtcblxuICAgIE1QNC5TVFRTID0gTVA0LlNUU0MgPSBNUDQuU1RDTyA9IHN0Y287XG5cbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICB2YXIgbWFqb3JCcmFuZCA9IG5ldyBVaW50OEFycmF5KFsxMDUsMTE1LDExMSwxMDldKTsgLy8gaXNvbVxuICAgIHZhciBhdmMxQnJhbmQgPSBuZXcgVWludDhBcnJheShbOTcsMTE4LDk5LDQ5XSk7IC8vIGF2YzFcbiAgICB2YXIgbWlub3JWZXJzaW9uID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDAsIDAsIDFdKTtcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgbWFqb3JCcmFuZCwgbWlub3JWZXJzaW9uLCBtYWpvckJyYW5kLCBhdmMxQnJhbmQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgZHJlZikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSA4LFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICBsZW4gPSBpLFxuICAgIHJlc3VsdDtcbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICByZXN1bHRbMF0gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAgIHJlc3VsdFsxXSA9IChzaXplID4+IDE2KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzJdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICAgIHJlc3VsdFszXSA9IHNpemUgICYgMHhmZjtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBsZW47IGkrKykge1xuICAgICAgLy8gY29weSBwYXlsb2FkW2ldIGFycmF5IEAgb2Zmc2V0IHNpemVcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKHRpbWVzY2FsZSwgZHVyYXRpb24pIHtcbiAgICBkdXJhdGlvbiAqPSB0aW1lc2NhbGU7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay50aW1lc2NhbGUsIHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsIE1QNC5tZmhkKHNuKSwgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS50aW1lc2NhbGUsIHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQodGltZXNjYWxlLGR1cmF0aW9uKSB7XG4gICAgZHVyYXRpb24qPXRpbWVzY2FsZTtcbiAgICB2YXJcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgICAgKGR1cmF0aW9uID4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuICAgIC8vIGxlYXZlIHRoZSBmdWxsIGJveCBoZWFkZXIgKDQgYnl0ZXMpIGFsbCB6ZXJvXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCwgTVA0LnN0c2QodHJhY2spLCBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSwgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLCBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpLCBkYXRhLCBsZW47XG4gICAgLy8gYXNzZW1ibGUgdGhlIFNQU3NcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5zcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBzcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpOyAvLyBTUFNcbiAgICB9XG5cbiAgICAvLyBhc3NlbWJsZSB0aGUgUFBTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5wcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5wcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBwcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHBwcyA9IHBwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpO1xuICAgIH1cblxuICAgIHZhciBhdmNjID0gTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgICAvLyB2ZXJzaW9uXG4gICAgICAgICAgICBzcHNbM10sIC8vIHByb2ZpbGVcbiAgICAgICAgICAgIHNwc1s0XSwgLy8gcHJvZmlsZSBjb21wYXRcbiAgICAgICAgICAgIHNwc1s1XSwgLy8gbGV2ZWxcbiAgICAgICAgICAgIDB4ZmMgfCAzLCAvLyBsZW5ndGhTaXplTWludXNPbmUsIGhhcmQtY29kZWQgdG8gNCBieXRlc1xuICAgICAgICAgICAgMHhFMCB8IHRyYWNrLnNwcy5sZW5ndGggLy8gM2JpdCByZXNlcnZlZCAoMTExKSArIG51bU9mU2VxdWVuY2VQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXS5jb25jYXQoc3BzKS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2sucHBzLmxlbmd0aCAvLyBudW1PZlBpY3R1cmVQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHBwcykpKSwgLy8gXCJQUFNcIlxuICAgICAgICB3aWR0aCA9IHRyYWNrLndpZHRoLFxuICAgICAgICBoZWlnaHQgPSB0cmFjay5oZWlnaHQ7XG4gICAgLy9jb25zb2xlLmxvZygnYXZjYzonICsgSGV4LmhleER1bXAoYXZjYykpO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHdpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIGhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMixcbiAgICAgICAgMHg2NCwgMHg2MSwgMHg2OSwgMHg2QywgLy9kYWlseW1vdGlvbi9obHMuanNcbiAgICAgICAgMHg3OSwgMHg2RCwgMHg2RiwgMHg3NCxcbiAgICAgICAgMHg2OSwgMHg2RiwgMHg2RSwgMHgyRixcbiAgICAgICAgMHg2OCwgMHg2QywgMHg3MywgMHgyRSxcbiAgICAgICAgMHg2QSwgMHg3MywgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgICAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIGF2Y2MsXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICB2YXIgY29uZmlnbGVuID0gdHJhY2suY29uZmlnLmxlbmd0aDtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4MDAsIDB4MDEsIC8vZXNfaWRcbiAgICAgIDB4MDAsIC8vIHN0cmVhbV9wcmlvcml0eVxuXG4gICAgICAweDA0LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MGYrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICBdLmNvbmNhdChbY29uZmlnbGVuXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgIHZhciBhdWRpb3NhbXBsZXJhdGUgPSB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkMlxuICAgICAgKGF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICBhdWRpb3NhbXBsZXJhdGUgJiAweGZmLCAvL1xuICAgICAgMHgwMCwgMHgwMF0pLFxuICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkLFxuICAgICAgICBkdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uKnRyYWNrLnRpbWVzY2FsZSxcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKGlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gMTYpICYgMHhGRixcbiAgICAgIChpZCA+PiA4KSAmIDB4RkYsXG4gICAgICBpZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB3aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICBoZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKSxcbiAgICAgICAgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChpZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLCBNUDQudGtoZCh0cmFjayksIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgIChpZCA+PiAyNCksXG4gICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAoaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcz0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgICAgbGVuID0gc2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIGFycmF5bGVuID0gMTIgKyAoMTYgKiBsZW4pLFxuICAgICAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5bGVuKSxcbiAgICAgICAgaSxzYW1wbGUsZHVyYXRpb24sc2l6ZSxmbGFncyxjdHM7XG4gICAgb2Zmc2V0ICs9IDggKyBhcnJheWxlbjtcbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKGxlbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChsZW4gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiA4KSAmIDB4RkYsXG4gICAgICBsZW4gJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgZHVyYXRpb24gPSBzYW1wbGUuZHVyYXRpb247XG4gICAgICBzaXplID0gc2FtcGxlLnNpemU7XG4gICAgICBmbGFncyA9IHNhbXBsZS5mbGFncztcbiAgICAgIGN0cyA9IHNhbXBsZS5jdHM7XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoZHVyYXRpb24gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChmbGFncy5pc0xlYWRpbmcgPDwgMikgfCBmbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBmbGFncy5pc05vblN5bmMsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweEYwIDw8IDgsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKGN0cyA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBjdHMgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcbiAgICBpZiAoIU1QNC50eXBlcykge1xuICAgICAgTVA0LmluaXQoKTtcbiAgICB9XG4gICAgdmFyIG1vdmllID0gTVA0Lm1vb3YodHJhY2tzKSwgcmVzdWx0O1xuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KE1QNC5GVFlQLmJ5dGVMZW5ndGggKyBtb3ZpZS5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KE1QNC5GVFlQKTtcbiAgICByZXN1bHQuc2V0KG1vdmllLCBNUDQuRlRZUC5ieXRlTGVuZ3RoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNDtcbiIsIi8qKlxuICogZk1QNCByZW11eGVyXG4qL1xuXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgTVA0IGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIE1QNFJlbXV4ZXIge1xuICBjb25zdHJ1Y3RvcihvYnNlcnZlcikge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gICAgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IgPSA0O1xuICAgIHRoaXMuUEVTX1RJTUVTQ0FMRSA9IDkwMDAwO1xuICAgIHRoaXMuTVA0X1RJTUVTQ0FMRSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSAvIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SO1xuICB9XG5cbiAgZ2V0IHBhc3N0aHJvdWdoKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdGhpcy5uZXh0QWFjUHRzID0gdGhpcy5uZXh0QXZjRHRzID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzLCBkYXRhLCB0MCkge1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCwgdDApO1xuXHR9XG5cdGlmICh0aGlzLklTR2VuZXJhdGVkKSB7XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBBVkMgc2FtcGxlczonICsgdmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcblx0XHQgIHRoaXMucmVtdXhWaWRlbyh2aWRlb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cywgdDApO1xuXHRcdH1cblx0XHQvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcblx0XHRpZiAoYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuXHRcdCAgdGhpcy5yZW11eEF1ZGlvKGF1ZGlvVHJhY2ssdGltZU9mZnNldCxjb250aWd1b3VzKTtcblx0XHR9XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBJRDMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKGlkM1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG5cdFx0ICB0aGlzLnJlbXV4SUQzKGlkM1RyYWNrLHRpbWVPZmZzZXQpO1xuXHRcdH1cblx0XHQvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcblx0XHRpZiAodGV4dFRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG5cdFx0ICB0aGlzLnJlbXV4VGV4dCh0ZXh0VHJhY2ssdGltZU9mZnNldCk7XG5cdFx0fVxuXHR9XG4gICAgLy9ub3RpZnkgZW5kIG9mIHBhcnNpbmdcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCwgdDApIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyLFxuICAgICAgICBhdWRpb1NhbXBsZXMgPSBhdWRpb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIHZpZGVvU2FtcGxlcyA9IHZpZGVvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICB0cmFja3MgPSB7fSxcbiAgICAgICAgZGF0YSA9IHsgdHJhY2tzIDogdHJhY2tzLCB1bmlxdWUgOiBmYWxzZSB9LFxuICAgICAgICBjb21wdXRlUFRTRFRTID0gKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCksXG4gICAgICAgIGluaXRQVFMsIGluaXREVFM7XG5cbiAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgaW5pdFBUUyA9IGluaXREVFMgPSBJbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGF1ZGlvVHJhY2suY29uZmlnICYmIGF1ZGlvU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF1ZGlvVHJhY2sudGltZXNjYWxlID0gYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICAvLyBNUDQgZHVyYXRpb24gKHRyYWNrIGR1cmF0aW9uIGluIHNlY29uZHMgbXVsdGlwbGllZCBieSB0aW1lc2NhbGUpIGlzIGNvZGVkIG9uIDMyIGJpdHNcbiAgICAgIC8vIHdlIGtub3cgdGhhdCBlYWNoIEFBQyBzYW1wbGUgY29udGFpbnMgMTAyNCBmcmFtZXMuLi4uXG4gICAgICAvLyBpbiBvcmRlciB0byBhdm9pZCBvdmVyZmxvd2luZyB0aGUgMzIgYml0IGNvdW50ZXIgZm9yIGxhcmdlIGR1cmF0aW9uLCB3ZSB1c2Ugc21hbGxlciB0aW1lc2NhbGUgKHRpbWVzY2FsZS9nY2QpXG4gICAgICAvLyB3ZSBqdXN0IG5lZWQgdG8gZW5zdXJlIHRoYXQgQUFDIHNhbXBsZSBkdXJhdGlvbiB3aWxsIHN0aWxsIGJlIGFuIGludGVnZXIgKHdpbGwgYmUgMTAyNC9nY2QpXG4gICAgICBpZiAoYXVkaW9UcmFjay50aW1lc2NhbGUgKiBhdWRpb1RyYWNrLmR1cmF0aW9uID4gTWF0aC5wb3coMiwgMzIpKSB7XG4gICAgICAgIGxldCBncmVhdGVzdENvbW1vbkRpdmlzb3IgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgICBpZiAoICEgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGdyZWF0ZXN0Q29tbW9uRGl2aXNvcihiLCBhICUgYik7XG4gICAgICAgIH07XG4gICAgICAgIGF1ZGlvVHJhY2sudGltZXNjYWxlID0gYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGUgLyBncmVhdGVzdENvbW1vbkRpdmlzb3IoYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGUsMTAyNCk7XG4gICAgICB9XG4gICAgICBsb2dnZXIubG9nICgnYXVkaW8gbXA0IHRpbWVzY2FsZSA6JysgYXVkaW9UcmFjay50aW1lc2NhbGUpO1xuICAgICAgdHJhY2tzLmF1ZGlvID0ge1xuICAgICAgICBjb250YWluZXIgOiAnYXVkaW8vbXA0JyxcbiAgICAgICAgY29kZWMgOiAgYXVkaW9UcmFjay5jb2RlYyxcbiAgICAgICAgaW5pdFNlZ21lbnQgOiBNUDQuaW5pdFNlZ21lbnQoW2F1ZGlvVHJhY2tdKSxcbiAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgY2hhbm5lbENvdW50IDogYXVkaW9UcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHQuIGZvciBhdWRpbywgUFRTICsgRFRTIC4uLlxuICAgICAgICAvLyBpbml0UFRTID0gaW5pdERUUyA9IGF1ZGlvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICBpbml0UFRTID0gaW5pdERUUyA9IHQwICogcGVzVGltZVNjYWxlO1xuXHRcdC8vIGlmICh0aW1lT2Zmc2V0ICE9IHQwKSBkZWJ1Z2dlcjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodmlkZW9UcmFjay5zcHMgJiYgdmlkZW9UcmFjay5wcHMgJiYgdmlkZW9TYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdmlkZW9UcmFjay50aW1lc2NhbGUgPSB0aGlzLk1QNF9USU1FU0NBTEU7XG4gICAgICB0cmFja3MudmlkZW8gPSB7XG4gICAgICAgIGNvbnRhaW5lciA6ICd2aWRlby9tcDQnLFxuICAgICAgICBjb2RlYyA6ICB2aWRlb1RyYWNrLmNvZGVjLFxuICAgICAgICBpbml0U2VnbWVudCA6IE1QNC5pbml0U2VnbWVudChbdmlkZW9UcmFja10pLFxuICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICB3aWR0aCA6IHZpZGVvVHJhY2sud2lkdGgsXG4gICAgICAgICAgaGVpZ2h0IDogdmlkZW9UcmFjay5oZWlnaHRcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICAgIGluaXRQVFMgPSBNYXRoLm1pbihpbml0UFRTLHZpZGVvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0KTtcbiAgICAgICAgaW5pdERUUyA9IE1hdGgubWluKGluaXREVFMsdmlkZW9TYW1wbGVzWzBdLmR0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKCFPYmplY3Qua2V5cyh0cmFja3MpKSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnbm8gYXVkaW8vdmlkZW8gc2FtcGxlcyBmb3VuZCd9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULGRhdGEpO1xuICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgICAvLyB0aGlzLl9pbml0UFRTID0gdDAqcGVzVGltZVNjYWxlOy8vaW5pdFBUUztcbiAgICAgICAgLy8gdGhpcy5faW5pdERUUyA9IHQwKnBlc1RpbWVTY2FsZTsvL2luaXREVFM7XG5cbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IGluaXRQVFM7XG4gICAgICAgIHRoaXMuX2luaXREVFMgPSBpbml0RFRTO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJlbXV4VmlkZW8odHJhY2ssIHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMsIHQwKSB7XG4gICAgdmFyIG9mZnNldCA9IDgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgcGVzMm1wNFNjYWxlRmFjdG9yID0gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsXG4gICAgICAgIG1wNFNhbXBsZUR1cmF0aW9uLFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsXG4gICAgICAgIGxhc3RQVFMsIGxhc3REVFMsXG4gICAgICAgIGlucHV0U2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMsXG4gICAgICAgIG91dHB1dFNhbXBsZXMgPSBbXTtcblxuICAvLyBQVFMgaXMgY29kZWQgb24gMzNiaXRzLCBhbmQgY2FuIGxvb3AgZnJvbSAtMl4zMiB0byAyXjMyXG4gIC8vIFBUU05vcm1hbGl6ZSB3aWxsIG1ha2UgUFRTL0RUUyB2YWx1ZSBtb25vdG9uaWMsIHdlIHVzZSBsYXN0IGtub3duIERUUyB2YWx1ZSBhcyByZWZlcmVuY2UgdmFsdWVcbiAgIGxldCBuZXh0QXZjRHRzO1xuICAgIGlmIChjb250aWd1b3VzKSB7XG4gICAgICAvLyBpZiBwYXJzZWQgZnJhZ21lbnQgaXMgY29udGlndW91cyB3aXRoIGxhc3Qgb25lLCBsZXQncyB1c2UgbGFzdCBEVFMgdmFsdWUgYXMgcmVmZXJlbmNlXG4gICAgICBuZXh0QXZjRHRzID0gdGhpcy5uZXh0QXZjRHRzO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpZiBub3QgY29udGlndW91cywgbGV0J3MgdXNlIHRhcmdldCB0aW1lT2Zmc2V0XG4gICAgICBuZXh0QXZjRHRzID0gdDAqcGVzVGltZVNjYWxlO1xuICAgIH1cblxuICAgIC8vIGNvbXB1dGUgZmlyc3QgRFRTIGFuZCBsYXN0IERUUywgbm9ybWFsaXplIHRoZW0gYWdhaW5zdCByZWZlcmVuY2UgdmFsdWVcbiAgICBsZXQgc2FtcGxlID0gaW5wdXRTYW1wbGVzWzBdO1xuICAgIC8vIGZpcnN0RFRTID0gIE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUuZHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcbiAgICAvLyBmaXJzdFBUUyA9ICBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLnB0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG5cbiAgICBmaXJzdERUUyA9ICBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLmR0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG4gICAgZmlyc3RQVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuXG5cdHZhciBmaXJzdFNhbXBsZURUUyA9IHNhbXBsZS5kdHM7XG5cdGZpcnN0UFRTID0gZmlyc3REVFMgPSBNYXRoLnJvdW5kKHQwICogcGVzVGltZVNjYWxlKTtcblx0bG9nZ2VyLmluZm8oICdmaXJzdFBUUyAjMTogJyArIGZpcnN0UFRTICk7XG5cbiAgICAvLyBjaGVjayB0aW1lc3RhbXAgY29udGludWl0eSBhY2Nyb3NzIGNvbnNlY3V0aXZlIGZyYWdtZW50cyAodGhpcyBpcyB0byByZW1vdmUgaW50ZXItZnJhZ21lbnQgZ2FwL2hvbGUpXG4vLyAgICAgbGV0IGRlbHRhID0gTWF0aC5yb3VuZCgoZmlyc3REVFMgLSBuZXh0QXZjRHRzKSAvIDkwKTtcbi8vXG4vLyAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuLy8gICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuLy8gICAgICAgaWYgKGRlbHRhKSB7XG4vLyAgICAgICAgIGlmIChkZWx0YSA+IDEpIHtcbi8vICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4vLyAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMSkge1xuLy8gICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuLy8gICAgICAgICB9XG4vLyAgICAgICAgIC8vIHJlbW92ZSBob2xlL2dhcCA6IHNldCBEVFMgdG8gbmV4dCBleHBlY3RlZCBEVFNcbi8vICAgICAgICAgZmlyc3REVFMgPSBpbnB1dFNhbXBsZXNbMF0uZHRzID0gbmV4dEF2Y0R0cztcbi8vICAgICAgICAgLy8gb2Zmc2V0IFBUUyBhcyB3ZWxsLCBlbnN1cmUgdGhhdCBQVFMgaXMgc21hbGxlciBvciBlcXVhbCB0aGFuIG5ldyBEVFNcbi8vICAgICAgICAgZmlyc3RQVFMgPSBpbnB1dFNhbXBsZXNbMF0ucHRzID0gTWF0aC5tYXgoZmlyc3RQVFMgLSBkZWx0YSwgbmV4dEF2Y0R0cyk7XG4vLyAgICAgICAgIGxvZ2dlci5sb2coYFZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6ICR7Zmlyc3RQVFN9LyR7Zmlyc3REVFN9LGRlbHRhOiR7ZGVsdGF9YCk7XG4vLyAgICAgICB9XG4vLyAgICAgfVxuLy8gXHRjb25zb2xlLmluZm8oICdmaXJzdFBUUyAjMjogJyArIGZpcnN0UFRTICk7XG5cblx0Ly8gc2FtcGxlIGR1cmF0aW9uIChhcyBleHBlY3RlZCBieSB0cnVuIE1QNCBib3hlcyksIHNob3VsZCBiZSB0aGUgZGVsdGEgYmV0d2VlbiBzYW1wbGUgRFRTXG4gICAgLy8gbGV0J3Mgc2lnbmFsIHRoZSBzYW1lIHNhbXBsZSBkdXJhdGlvbiBmb3IgYWxsIHNhbXBsZXNcbiAgICAvLyBzZXQgdGhpcyBjb25zdGFudCBkdXJhdGlvbiBhcyBiZWluZyB0aGUgYXZnIGRlbHRhIGJldHdlZW4gY29uc2VjdXRpdmUgRFRTLlxuICAgIHNhbXBsZSA9IGlucHV0U2FtcGxlc1tpbnB1dFNhbXBsZXMubGVuZ3RoLTFdO1xuICAgIGxhc3REVFMgPSBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLmR0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG5cblx0bGFzdERUUyA9IChzYW1wbGUuZHRzIC0gZmlyc3RTYW1wbGVEVFMpICsgZmlyc3RQVFM7XG4gICAgbXA0U2FtcGxlRHVyYXRpb24gPSBNYXRoLnJvdW5kKChsYXN0RFRTLWZpcnN0RFRTKS8ocGVzMm1wNFNjYWxlRmFjdG9yKihpbnB1dFNhbXBsZXMubGVuZ3RoLTEpKSk7XG5cblx0aWYgKGxhc3REVFMgPD0gZmlyc3REVFMpIHtcblx0XHRsYXN0RFRTID0gZmlyc3REVFM7XG5cdFx0bXA0U2FtcGxlRHVyYXRpb24gPSAwO1xuXHRcdGNvbnNvbGUud2FybignbGFzdERUUyA8IGZpcnN0RFRTJyk7XG5cdH1cblx0bG9nZ2VyLmluZm8oICcoIGxhc3REVFMgLSBmaXJzdERUUyApIC8gOTAwMDAgOiAnICsgKGxhc3REVFMgLSBmaXJzdERUUykvOTAwMDApO1xuXHR2YXIgb2xkUFRTID0gZmlyc3RQVFM7XG5cdC8vIGZpcnN0UFRTID0gZmlyc3REVFMgPSBNYXRoLnJvdW5kKHQwKjkwMDAwKTtcblx0bG9nZ2VyLmluZm8oJ2ZpcnN0UFRTOiAnICArIG9sZFBUUyArICcgLT4gJyArIHQwKjkwMDAwKTtcblx0aWYgKCBNYXRoLmFicyhvbGRQVFMgLSBmaXJzdFBUUykgPiAxMDAwMCApIHsgY29uc29sZS53YXJuKCd0aGlzIGNvdWxkIGhhdmUgY2F1c2VkIGEgZnJhZ0xvb3AgZXJyb3InKTsgfVxuXG5cbiAgICAvLyBub3JtYWxpemUgYWxsIFBUUy9EVFMgbm93IC4uLlxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRTYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgc2FtcGxlID0gaW5wdXRTYW1wbGVzW2ldO1xuICAgICAgLy8gc2FtcGxlIERUUyBpcyBjb21wdXRlZCB1c2luZyBhIGNvbnN0YW50IGRlY29kaW5nIG9mZnNldCAobXA0U2FtcGxlRHVyYXRpb24pIGJldHdlZW4gc2FtcGxlc1xuICAgICAgc2FtcGxlLmR0cyA9IGZpcnN0RFRTICsgaSpwZXMybXA0U2NhbGVGYWN0b3IqbXA0U2FtcGxlRHVyYXRpb247XG4gICAgICAvLyB3ZSBub3JtYWxpemUgUFRTIGFnYWluc3QgbmV4dEF2Y0R0cywgd2UgYWxzbyBzdWJzdHJhY3QgaW5pdERUUyAoc29tZSBzdHJlYW1zIGRvbid0IHN0YXJ0IEAgUFRTIE8pXG4gICAgICAvLyBhbmQgd2UgZW5zdXJlIHRoYXQgY29tcHV0ZWQgdmFsdWUgaXMgZ3JlYXRlciBvciBlcXVhbCB0aGFuIHNhbXBsZSBEVFNcbiAgICAgIC8vIHNhbXBsZS5wdHMgPSBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLnB0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsIHNhbXBsZS5kdHMpO1xuXHQgIHNhbXBsZS5wdHMgPSBzYW1wbGUuZHRzO1xuICAgIH1cbiAgICBsYXN0UFRTID0gaW5wdXRTYW1wbGVzW2lucHV0U2FtcGxlcy5sZW5ndGgtMV0ucHRzO1xuXG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyAoNCAqIHRyYWNrLm5iTmFsdSkgKyA4KTtcbiAgICBsZXQgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgd2hpbGUgKGlucHV0U2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGxldCBhdmNTYW1wbGUgPSBpbnB1dFNhbXBsZXMuc2hpZnQoKSxcbiAgICAgICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuICAgICAgLy8gY29udmVydCBOQUxVIGJpdHN0cmVhbSB0byBNUDQgZm9ybWF0IChwcmVwZW5kIE5BTFUgd2l0aCBzaXplIGZpZWxkKVxuICAgICAgd2hpbGUgKGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIob2Zmc2V0LCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIG9mZnNldCArPSA0O1xuICAgICAgICBtZGF0LnNldCh1bml0LmRhdGEsIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoICs9IDQgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGF2Y1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG91dHB1dFNhbXBsZXMucHVzaCh7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgIC8vIGNvbnN0YW50IGR1cmF0aW9uXG4gICAgICAgIGR1cmF0aW9uOiBtcDRTYW1wbGVEdXJhdGlvbixcbiAgICAgICAgLy8gc2V0IGNvbXBvc2l0aW9uIHRpbWUgb2Zmc2V0IGFzIGEgbXVsdGlwbGUgb2Ygc2FtcGxlIGR1cmF0aW9uXG4gICAgICAgIGN0czogTWF0aC5tYXgoMCxtcDRTYW1wbGVEdXJhdGlvbipNYXRoLnJvdW5kKChhdmNTYW1wbGUucHRzIC0gYXZjU2FtcGxlLmR0cykvKHBlczJtcDRTY2FsZUZhY3RvciptcDRTYW1wbGVEdXJhdGlvbikpKSxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT24gOiBhdmNTYW1wbGUua2V5ID8gMiA6IDEsXG4gICAgICAgICAgaXNOb25TeW5jIDogYXZjU2FtcGxlLmtleSA/IDAgOiAxXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBuZXh0IEFWQyBzYW1wbGUgRFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBEVFMgKyBsYXN0IHNhbXBsZSBkdXJhdGlvbiAoaW4gUEVTIHRpbWVzY2FsZSlcbiAgICB0aGlzLm5leHRBdmNEdHMgPSBsYXN0RFRTICsgbXA0U2FtcGxlRHVyYXRpb24qcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgdHJhY2submJOYWx1ID0gMDtcbiAgICBpZihvdXRwdXRTYW1wbGVzLmxlbmd0aCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignY2hyb21lJykgPiAtMSkge1xuICAgICAgbGV0IGZsYWdzID0gb3V0cHV0U2FtcGxlc1swXS5mbGFncztcbiAgICAvLyBjaHJvbWUgd29ya2Fyb3VuZCwgbWFyayBmaXJzdCBzYW1wbGUgYXMgYmVpbmcgYSBSYW5kb20gQWNjZXNzIFBvaW50IHRvIGF2b2lkIHNvdXJjZWJ1ZmZlciBhcHBlbmQgaXNzdWVcbiAgICAvLyBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MjI5NDEyXG4gICAgICBmbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICB9XG4gICAgdHJhY2suc2FtcGxlcyA9IG91dHB1dFNhbXBsZXM7XG5cdC8vIGlmIChmaXJzdERUUy9wZXNUaW1lU2NhbGUgPiAxMDAwMDApIHsgZGVidWdnZXI7IH1cbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICBkYXRhMTogbW9vZixcbiAgICAgIGRhdGEyOiBtZGF0LFxuICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kUFRTOiAobGFzdFBUUyArIHBlczJtcDRTY2FsZUZhY3RvciAqIG1wNFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZERUUzogdGhpcy5uZXh0QXZjRHRzIC8gcGVzVGltZVNjYWxlLFxuICAgICAgdHlwZTogJ3ZpZGVvJyxcbiAgICAgIG5iOiBvdXRwdXRTYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgcmVtdXhBdWRpbyh0cmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgdmFyIHZpZXcsXG4gICAgICAgIG9mZnNldCA9IDgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbiA9IHRyYWNrLnRpbWVzY2FsZSAqIDEwMjQgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGUsXG4gICAgICAgIGFhY1NhbXBsZSwgbXA0U2FtcGxlLFxuICAgICAgICB1bml0LFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsIGxhc3REVFMsXG4gICAgICAgIHB0cywgZHRzLCBwdHNub3JtLCBkdHNub3JtLFxuICAgICAgICBzYW1wbGVzID0gW10sXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBzYW1wbGVzMCA9IFtdO1xuXG4gICAgdHJhY2suc2FtcGxlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiAoYS5wdHMtYi5wdHMpO1xuICAgIH0pO1xuICAgIHNhbXBsZXMwID0gdHJhY2suc2FtcGxlcztcblxuICAgIHdoaWxlIChzYW1wbGVzMC5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHNhbXBsZXMwLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBwdHMgPSBhYWNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGFhY1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKGBBdWRpby9QVFM6JHtNYXRoLnJvdW5kKHB0cy85MCl9YCk7XG4gICAgICAvLyBpZiBub3QgZmlyc3Qgc2FtcGxlXG4gICAgICBpZiAobGFzdERUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBsYXN0RFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIGxhc3REVFMpO1xuICAgICAgICAvLyBsZXQncyBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbi5cbiAgICAgICAgLy8gc2FtcGxlIER1cmF0aW9uIHNob3VsZCBiZSBjbG9zZSB0byBleHBlY3RlZFNhbXBsZUR1cmF0aW9uXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdERUUykgLyBwZXMybXA0U2NhbGVGYWN0b3I7XG4gICAgICAgIGlmKE1hdGguYWJzKG1wNFNhbXBsZS5kdXJhdGlvbiAtIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24pID4gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbi8xMCkge1xuICAgICAgICAgIC8vIG1vcmUgdGhhbiAxMCUgZGlmZiBiZXR3ZWVuIHNhbXBsZSBkdXJhdGlvbiBhbmQgZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbiAuLi4uIGxldHMgbG9nIHRoYXRcbiAgICAgICAgICAvLyBsb2dnZXIudHJhY2UoYGludmFsaWQgQUFDIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMgJHtNYXRoLnJvdW5kKHB0cy85MCl9LHNob3VsZCBiZSAxMDI0LGZvdW5kIDoke01hdGgucm91bmQobXA0U2FtcGxlLmR1cmF0aW9uKnRyYWNrLmF1ZGlvc2FtcGxlcmF0ZS90cmFjay50aW1lc2NhbGUpfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFsd2F5cyBhZGp1c3Qgc2FtcGxlIGR1cmF0aW9uIHRvIGF2b2lkIGF2IHN5bmMgaXNzdWVcbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbjtcbiAgICAgICAgZHRzbm9ybSA9IGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gKiBwZXMybXA0U2NhbGVGYWN0b3IgKyBsYXN0RFRTO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IG5leHRBYWNQdHMsIGRlbHRhO1xuICAgICAgICBpZiAoY29udGlndW91cykge1xuICAgICAgICAgIG5leHRBYWNQdHMgPSB0aGlzLm5leHRBYWNQdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV4dEFhY1B0cyA9IHRpbWVPZmZzZXQqcGVzVGltZVNjYWxlO1xuICAgICAgICB9XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gbmV4dEFhY1B0cykgLyBwZXNUaW1lU2NhbGUpO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIC8vIGxvZyBkZWx0YVxuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIGZyYW1lIG92ZXJsYXAsIG92ZXJsYXBwaW5nIGZvciBtb3JlIHRoYW4gaGFsZiBhIGZyYW1lIGR1cmFpb25cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMTIpIHtcbiAgICAgICAgICAgICAgLy8gZHJvcCBvdmVybGFwcGluZyBhdWRpbyBmcmFtZXMuLi4gYnJvd3NlciB3aWxsIGRlYWwgd2l0aCBpdFxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAkeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLCBkcm9wIGZyYW1lYCk7XG4gICAgICAgICAgICAgIHRyYWNrLmxlbiAtPSB1bml0LmJ5dGVMZW5ndGg7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IGR0c25vcm0gPSBuZXh0QWFjUHRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgICBpZih0cmFjay5sZW4gPiAwKSB7XG4gICAgICAgICAgLyogY29uY2F0ZW5hdGUgdGhlIGF1ZGlvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtZGF0IHR5cGUpICovXG4gICAgICAgICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRyYWNrLmxlbiArIDgpO1xuICAgICAgICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgICAgICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vIGF1ZGlvIHNhbXBsZXNcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1kYXQuc2V0KHVuaXQsIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2FhY1NhbXBsZS5wdHN9LyR7YWFjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYWFjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGN0czogMCxcbiAgICAgICAgZHVyYXRpb246MCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3REVFMgPSBkdHNub3JtO1xuICAgIH1cbiAgICB2YXIgbGFzdFNhbXBsZUR1cmF0aW9uID0gMDtcbiAgICB2YXIgbmJTYW1wbGVzID0gc2FtcGxlcy5sZW5ndGg7XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmIChuYlNhbXBsZXMgPj0gMikge1xuICAgICAgbGFzdFNhbXBsZUR1cmF0aW9uID0gc2FtcGxlc1tuYlNhbXBsZXMgLSAyXS5kdXJhdGlvbjtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICB9XG4gICAgaWYgKG5iU2FtcGxlcykge1xuICAgICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICAgIHRoaXMubmV4dEFhY1B0cyA9IHB0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcbiAgICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICAgIGRhdGExOiBtb29mLFxuICAgICAgICBkYXRhMjogbWRhdCxcbiAgICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmRQVFM6IHRoaXMubmV4dEFhY1B0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgc3RhcnREVFM6IGZpcnN0RFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmREVFM6IChkdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgdHlwZTogJ2F1ZGlvJyxcbiAgICAgICAgbmI6IG5iU2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmVtdXhJRDModHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIGlkMyBwdHMsIGR0cyB0byByZWxhdGl2ZSB0aW1lXG4gICAgICAgIC8vIHVzaW5nIHRoaXMuX2luaXRQVFMgYW5kIHRoaXMuX2luaXREVFMgdG8gY2FsY3VsYXRlIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgc2FtcGxlLnB0cyA9ICgoc2FtcGxlLnB0cyAtIHRoaXMuX2luaXRQVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgICAgc2FtcGxlLmR0cyA9ICgoc2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIHtcbiAgICAgICAgc2FtcGxlczp0cmFjay5zYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gIH1cblxuICByZW11eFRleHQodHJhY2ssdGltZU9mZnNldCkge1xuICAgIHRyYWNrLnNhbXBsZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gKGEucHRzLWIucHRzKTtcbiAgICB9KTtcblxuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIHRleHQgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgX1BUU05vcm1hbGl6ZSh2YWx1ZSwgcmVmZXJlbmNlKSB7XG4gICAgdmFyIG9mZnNldDtcbiAgICBpZiAocmVmZXJlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHJlZmVyZW5jZSA8IHZhbHVlKSB7XG4gICAgICAvLyAtIDJeMzNcbiAgICAgIG9mZnNldCA9IC04NTg5OTM0NTkyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyArIDJeMzNcbiAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDRSZW11eGVyO1xuIiwiLyoqXG4gKiBwYXNzdGhyb3VnaCByZW11eGVyXG4qL1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNsYXNzIFBhc3NUaHJvdWdoUmVtdXhlciB7XG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGdldCBwYXNzdGhyb3VnaCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LHJhd0RhdGEpIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyO1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHZhciB0cmFja3MgPSB7fSxcbiAgICAgICAgICBkYXRhID0geyB0cmFja3MgOiB0cmFja3MsIHVuaXF1ZSA6IHRydWUgfSxcbiAgICAgICAgICB0cmFjayA9IHZpZGVvVHJhY2ssXG4gICAgICAgICAgY29kZWMgPSB0cmFjay5jb2RlYztcblxuICAgICAgaWYgKGNvZGVjKSB7XG4gICAgICAgIGRhdGEudHJhY2tzLnZpZGVvID0ge1xuICAgICAgICAgIGNvbnRhaW5lciA6IHRyYWNrLmNvbnRhaW5lcixcbiAgICAgICAgICBjb2RlYyA6ICBjb2RlYyxcbiAgICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICAgIHdpZHRoIDogdHJhY2sud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQgOiB0cmFjay5oZWlnaHRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHRyYWNrID0gYXVkaW9UcmFjaztcbiAgICAgIGNvZGVjID0gdHJhY2suY29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgZGF0YS50cmFja3MuYXVkaW8gPSB7XG4gICAgICAgICAgY29udGFpbmVyIDogdHJhY2suY29udGFpbmVyLFxuICAgICAgICAgIGNvZGVjIDogIGNvZGVjLFxuICAgICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgICAgY2hhbm5lbENvdW50IDogdHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsZGF0YSk7XG4gICAgfVxuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIGRhdGExOiByYXdEYXRhLFxuICAgICAgc3RhcnRQVFM6IHRpbWVPZmZzZXQsXG4gICAgICBzdGFydERUUzogdGltZU9mZnNldCxcbiAgICAgIHR5cGU6ICdhdWRpb3ZpZGVvJyxcbiAgICAgIG5iOiAxXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGFzc1Rocm91Z2hSZW11eGVyO1xuIiwiXG4vLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2thbm9uZ2lsL25vZGUtbTN1OHBhcnNlL2Jsb2IvbWFzdGVyL2F0dHJsaXN0LmpzXG5jbGFzcyBBdHRyTGlzdCB7XG5cbiAgY29uc3RydWN0b3IoYXR0cnMpIHtcbiAgICBpZiAodHlwZW9mIGF0dHJzID09PSAnc3RyaW5nJykge1xuICAgICAgYXR0cnMgPSBBdHRyTGlzdC5wYXJzZUF0dHJMaXN0KGF0dHJzKTtcbiAgICB9XG4gICAgZm9yKHZhciBhdHRyIGluIGF0dHJzKXtcbiAgICAgIGlmKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIHRoaXNbYXR0cl0gPSBhdHRyc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDEwKTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBpZih0aGlzW2F0dHJOYW1lXSkge1xuICAgICAgbGV0IHN0cmluZ1ZhbHVlID0gKHRoaXNbYXR0ck5hbWVdIHx8ICcweCcpLnNsaWNlKDIpO1xuICAgICAgc3RyaW5nVmFsdWUgPSAoKHN0cmluZ1ZhbHVlLmxlbmd0aCAmIDEpID8gJzAnIDogJycpICsgc3RyaW5nVmFsdWU7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gbmV3IFVpbnQ4QXJyYXkoc3RyaW5nVmFsdWUubGVuZ3RoIC8gMik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDI7IGkrKykge1xuICAgICAgICB2YWx1ZVtpXSA9IHBhcnNlSW50KHN0cmluZ1ZhbHVlLnNsaWNlKGkgKiAyLCBpICogMiArIDIpLCAxNik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlckFzTnVtYmVyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTYpO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGRlY2ltYWxGbG9hdGluZ1BvaW50KGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpc1thdHRyTmFtZV0pO1xuICB9XG5cbiAgZW51bWVyYXRlZFN0cmluZyhhdHRyTmFtZSkge1xuICAgIHJldHVybiB0aGlzW2F0dHJOYW1lXTtcbiAgfVxuXG4gIGRlY2ltYWxSZXNvbHV0aW9uKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgcmVzID0gL14oXFxkKyl4KFxcZCspJC8uZXhlYyh0aGlzW2F0dHJOYW1lXSk7XG4gICAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBwYXJzZUludChyZXNbMV0sIDEwKSxcbiAgICAgIGhlaWdodDogcGFyc2VJbnQocmVzWzJdLCAxMClcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIHBhcnNlQXR0ckxpc3QoaW5wdXQpIHtcbiAgICBjb25zdCByZSA9IC9cXHMqKC4rPylcXHMqPSgoPzpcXFwiLio/XFxcIil8Lio/KSg/Oix8JCkvZztcbiAgICB2YXIgbWF0Y2gsIGF0dHJzID0ge307XG4gICAgd2hpbGUgKChtYXRjaCA9IHJlLmV4ZWMoaW5wdXQpKSAhPT0gbnVsbCkge1xuICAgICAgdmFyIHZhbHVlID0gbWF0Y2hbMl0sIHF1b3RlID0gJ1wiJztcblxuICAgICAgaWYgKHZhbHVlLmluZGV4T2YocXVvdGUpID09PSAwICYmXG4gICAgICAgICAgdmFsdWUubGFzdEluZGV4T2YocXVvdGUpID09PSAodmFsdWUubGVuZ3RoLTEpKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc2xpY2UoMSwgLTEpO1xuICAgICAgfVxuICAgICAgYXR0cnNbbWF0Y2hbMV1dID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBhdHRycztcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0dHJMaXN0O1xuIiwidmFyIEJpbmFyeVNlYXJjaCA9IHtcbiAgICAvKipcbiAgICAgKiBTZWFyY2hlcyBmb3IgYW4gaXRlbSBpbiBhbiBhcnJheSB3aGljaCBtYXRjaGVzIGEgY2VydGFpbiBjb25kaXRpb24uXG4gICAgICogVGhpcyByZXF1aXJlcyB0aGUgY29uZGl0aW9uIHRvIG9ubHkgbWF0Y2ggb25lIGl0ZW0gaW4gdGhlIGFycmF5LFxuICAgICAqIGFuZCBmb3IgdGhlIGFycmF5IHRvIGJlIG9yZGVyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBsaXN0IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY29tcGFyaXNvbkZ1bmN0aW9uXG4gICAgICogICAgICBDYWxsZWQgYW5kIHByb3ZpZGVkIGEgY2FuZGlkYXRlIGl0ZW0gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgICAqICAgICAgU2hvdWxkIHJldHVybjpcbiAgICAgKiAgICAgICAgICA+IC0xIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgbG93ZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBoaWdoZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDAgaWYgdGhlIGl0ZW0gaXMgdGhlIGl0ZW0geW91J3JlIGxvb2tpbmcgZm9yLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Kn0gVGhlIG9iamVjdCBpZiBpdCBpcyBmb3VuZCBvciBudWxsIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZWFyY2g6IGZ1bmN0aW9uKGxpc3QsIGNvbXBhcmlzb25GdW5jdGlvbikge1xuICAgICAgICB2YXIgbWluSW5kZXggPSAwO1xuICAgICAgICB2YXIgbWF4SW5kZXggPSBsaXN0Lmxlbmd0aCAtIDE7XG4gICAgICAgIHZhciBjdXJyZW50SW5kZXggPSBudWxsO1xuICAgICAgICB2YXIgY3VycmVudEVsZW1lbnQgPSBudWxsO1xuICAgICBcbiAgICAgICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgICAgICBjdXJyZW50SW5kZXggPSAobWluSW5kZXggKyBtYXhJbmRleCkgLyAyIHwgMDtcbiAgICAgICAgICAgIGN1cnJlbnRFbGVtZW50ID0gbGlzdFtjdXJyZW50SW5kZXhdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgY29tcGFyaXNvblJlc3VsdCA9IGNvbXBhcmlzb25GdW5jdGlvbihjdXJyZW50RWxlbWVudCk7XG4gICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHtcbiAgICAgICAgICAgICAgICBtaW5JbmRleCA9IGN1cnJlbnRJbmRleCArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkge1xuICAgICAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50RWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICBcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCaW5hcnlTZWFyY2g7XG4iLCIvKlxuICogQ0VBLTcwOCBpbnRlcnByZXRlclxuKi9cblxuY2xhc3MgQ0VBNzA4SW50ZXJwcmV0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgYXR0YWNoKG1lZGlhKSB7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICAgIHRoaXMubWVtb3J5ID0gW107XG4gIH1cblxuICBkZXRhY2goKVxuICB7XG4gICAgdGhpcy5jbGVhcigpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIF9jcmVhdGVDdWUoKVxuICB7XG4gICAgdmFyIFZUVEN1ZSA9IHdpbmRvdy5WVFRDdWUgfHwgd2luZG93LlRleHRUcmFja0N1ZTtcblxuICAgIHZhciBjdWUgPSB0aGlzLmN1ZSA9IG5ldyBWVFRDdWUoLTEsIC0xLCAnJyk7XG4gICAgY3VlLnRleHQgPSAnJztcbiAgICBjdWUucGF1c2VPbkV4aXQgPSBmYWxzZTtcblxuICAgIC8vIG1ha2Ugc3VyZSBpdCBkb2Vzbid0IHNob3cgdXAgYmVmb3JlIGl0J3MgcmVhZHlcbiAgICBjdWUuc3RhcnRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIC8vIHNob3cgaXQgJ2ZvcmV2ZXInIG9uY2Ugd2UgZG8gc2hvdyBpdFxuICAgIC8vICh3ZSdsbCBzZXQgdGhlIGVuZCB0aW1lIG9uY2Ugd2Uga25vdyBpdCBsYXRlcilcbiAgICBjdWUuZW5kVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XG5cbiAgICB0aGlzLm1lbW9yeS5wdXNoKGN1ZSk7XG4gIH1cblxuICBjbGVhcigpXG4gIHtcbiAgICB2YXIgdGV4dFRyYWNrID0gdGhpcy5fdGV4dFRyYWNrO1xuICAgIGlmICh0ZXh0VHJhY2sgJiYgdGV4dFRyYWNrLmN1ZXMpXG4gICAge1xuICAgICAgd2hpbGUgKHRleHRUcmFjay5jdWVzLmxlbmd0aCA+IDApXG4gICAgICB7XG4gICAgICAgIHRleHRUcmFjay5yZW1vdmVDdWUodGV4dFRyYWNrLmN1ZXNbMF0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1c2godGltZXN0YW1wLCBieXRlcylcbiAge1xuICAgIGlmICghdGhpcy5jdWUpXG4gICAge1xuICAgICAgdGhpcy5fY3JlYXRlQ3VlKCk7XG4gICAgfVxuXG4gICAgdmFyIGNvdW50ID0gYnl0ZXNbMF0gJiAzMTtcbiAgICB2YXIgcG9zaXRpb24gPSAyO1xuICAgIHZhciB0bXBCeXRlLCBjY2J5dGUxLCBjY2J5dGUyLCBjY1ZhbGlkLCBjY1R5cGU7XG5cbiAgICBmb3IgKHZhciBqPTA7IGo8Y291bnQ7IGorKylcbiAgICB7XG4gICAgICB0bXBCeXRlID0gYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUxID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMiA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjVmFsaWQgPSAoKDQgJiB0bXBCeXRlKSA9PT0gMCA/IGZhbHNlIDogdHJ1ZSk7XG4gICAgICBjY1R5cGUgPSAoMyAmIHRtcEJ5dGUpO1xuXG4gICAgICBpZiAoY2NieXRlMSA9PT0gMCAmJiBjY2J5dGUyID09PSAwKVxuICAgICAge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNjVmFsaWQpXG4gICAgICB7XG4gICAgICAgIGlmIChjY1R5cGUgPT09IDApIC8vIHx8IGNjVHlwZSA9PT0gMVxuICAgICAgICB7XG4gICAgICAgICAgLy8gU3RhbmRhcmQgQ2hhcmFjdGVyc1xuICAgICAgICAgIGlmICgweDIwICYgY2NieXRlMSB8fCAweDQwICYgY2NieXRlMSlcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUxKSArIHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3BlY2lhbCBDaGFyYWN0ZXJzXG4gICAgICAgICAgZWxzZSBpZiAoKGNjYnl0ZTEgPT09IDB4MTEgfHwgY2NieXRlMSA9PT0gMHgxOSkgJiYgY2NieXRlMiA+PSAweDMwICYmIGNjYnl0ZTIgPD0gMHgzRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBleHRlbmRlZCBjaGFycywgZS5nLiBtdXNpY2FsIG5vdGUsIGFjY2VudHNcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSA0ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNDk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwrAnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8K9JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCvyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4oSiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTY6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4pmqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICcgJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDqCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6InO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw7QnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYzOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8O7JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBXaGl0ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGUgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBHcmVlblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBCbHVlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBCbHVlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gQ3lhblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gQ3lhbiBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIC8vIFJlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUmVkIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQjpcbiAgICAgICAgICAgICAgICAvLyBZZWxsb3cgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljcyBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDE0IHx8IGNjYnl0ZTEgPT09IDB4MUMpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBzaG91bGRuJ3QgYWZmZWN0IHJvbGwtdXBzLi4uXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gUkNMOiBSZXN1bWUgQ2FwdGlvbiBMb2FkaW5nXG4gICAgICAgICAgICAgICAgLy8gYmVnaW4gcG9wIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICAvLyBCUzogQmFja3NwYWNlXG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCA9IHRoaXMuY3VlLnRleHQuc3Vic3RyKDAsIHRoaXMuY3VlLnRleHQubGVuZ3RoLTEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gQU9GOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb2ZmKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gQU9OOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb24pXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBERVI6IERlbGV0ZSB0byBlbmQgb2Ygcm93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBSVTI6IHJvbGwtdXAgMiByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNjpcbiAgICAgICAgICAgICAgICAvLyBSVTM6IHJvbGwtdXAgMyByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNzpcbiAgICAgICAgICAgICAgICAvLyBSVTQ6IHJvbGwtdXAgNCByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoNCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICAgICAgICAvLyBGT046IEZsYXNoIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICAgICAgICAvLyBSREM6IFJlc3VtZSBkaXJlY3QgY2FwdGlvbmluZ1xuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gVFI6IFRleHQgUmVzdGFydFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgLy8gUlREOiBSZXN1bWUgVGV4dCBEaXNwbGF5XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBFRE06IEVyYXNlIERpc3BsYXllZCBNZW1vcnlcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJEOlxuICAgICAgICAgICAgICAgIC8vIENSOiBDYXJyaWFnZSBSZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGFmZmVjdHMgcm9sbC11cFxuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gRU5NOiBFcmFzZSBub24tZGlzcGxheWVkIG1lbW9yeVxuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJGOlxuICAgICAgICAgICAgICAgIHRoaXMuX2ZsaXBNZW1vcnkodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICAvLyBFT0M6IEVuZCBvZiBjYXB0aW9uXG4gICAgICAgICAgICAgICAgLy8gaGlkZSBhbnkgZGlzcGxheWVkIGNhcHRpb25zIGFuZCBzaG93IGFueSBoaWRkZW4gb25lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNyB8fCBjY2J5dGUxID09PSAweDFGKSAmJiBjY2J5dGUyID49IDB4MjEgJiYgY2NieXRlMiA8PSAweDIzKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDEgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMiBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAzIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFByb2JhYmx5IGEgcHJlLWFtYmxlIGFkZHJlc3MgY29kZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mcm9tQ2hhckNvZGUodG1wQnl0ZSlcbiAge1xuICAgIHN3aXRjaCAodG1wQnl0ZSlcbiAgICB7XG4gICAgICBjYXNlIDQyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OpJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8OtJztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8OzJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8O6JztcblxuICAgICAgY2FzZSAzOlxuICAgICAgICByZXR1cm4gJ8OnJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8O3JztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8ORJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8OxJztcblxuICAgICAgY2FzZSA3OlxuICAgICAgICByZXR1cm4gJ+KWiCc7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHRtcEJ5dGUpO1xuICAgIH1cbiAgfVxuXG4gIF9mbGlwTWVtb3J5KHRpbWVzdGFtcClcbiAge1xuICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgIHRoaXMuX2ZsdXNoQ2FwdGlvbnModGltZXN0YW1wKTtcbiAgfVxuXG4gIF9mbHVzaENhcHRpb25zKHRpbWVzdGFtcClcbiAge1xuICAgIGlmICghdGhpcy5faGFzNzA4KVxuICAgIHtcbiAgICAgIHRoaXMuX3RleHRUcmFjayA9IHRoaXMubWVkaWEuYWRkVGV4dFRyYWNrKCdjYXB0aW9ucycsICdFbmdsaXNoJywgJ2VuJyk7XG4gICAgICB0aGlzLl9oYXM3MDggPSB0cnVlO1xuICAgIH1cblxuICAgIGZvcihsZXQgbWVtb3J5SXRlbSBvZiB0aGlzLm1lbW9yeSlcbiAgICB7XG4gICAgICBtZW1vcnlJdGVtLnN0YXJ0VGltZSA9IHRpbWVzdGFtcDtcbiAgICAgIHRoaXMuX3RleHRUcmFjay5hZGRDdWUobWVtb3J5SXRlbSk7XG4gICAgICB0aGlzLmRpc3BsYXkucHVzaChtZW1vcnlJdGVtKTtcbiAgICB9XG5cbiAgICB0aGlzLm1lbW9yeSA9IFtdO1xuICAgIHRoaXMuY3VlID0gbnVsbDtcbiAgfVxuXG4gIF9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKVxuICB7XG4gICAgZm9yIChsZXQgZGlzcGxheUl0ZW0gb2YgdGhpcy5kaXNwbGF5KVxuICAgIHtcbiAgICAgIGRpc3BsYXlJdGVtLmVuZFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gIH1cblxuLyogIF9yb2xsVXAobilcbiAge1xuICAgIC8vIFRPRE86IGltcGxlbWVudCByb2xsLXVwIGNhcHRpb25zXG4gIH1cbiovXG4gIF9jbGVhckJ1ZmZlcmVkQ3VlcygpXG4gIHtcbiAgICAvL3JlbW92ZSB0aGVtIGFsbC4uLlxuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ0VBNzA4SW50ZXJwcmV0ZXI7XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbmNvbnN0IGZha2VMb2dnZXIgPSB7XG4gIHRyYWNlOiBub29wLFxuICBkZWJ1Zzogbm9vcCxcbiAgbG9nOiBub29wLFxuICB3YXJuOiBub29wLFxuICBpbmZvOiBub29wLFxuICBlcnJvcjogbm9vcFxufTtcblxubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuLy9sZXQgbGFzdENhbGxUaW1lO1xuLy8gZnVuY3Rpb24gZm9ybWF0TXNnV2l0aFRpbWVJbmZvKHR5cGUsIG1zZykge1xuLy8gICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuLy8gICBjb25zdCBkaWZmID0gbGFzdENhbGxUaW1lID8gJysnICsgKG5vdyAtIGxhc3RDYWxsVGltZSkgOiAnMCc7XG4vLyAgIGxhc3RDYWxsVGltZSA9IG5vdztcbi8vICAgbXNnID0gKG5ldyBEYXRlKG5vdykpLnRvSVNPU3RyaW5nKCkgKyAnIHwgWycgKyAgdHlwZSArICddID4gJyArIG1zZyArICcgKCAnICsgZGlmZiArICcgbXMgKSc7XG4vLyAgIHJldHVybiBtc2c7XG4vLyB9XG5cbmZ1bmN0aW9uIGZvcm1hdE1zZyh0eXBlLCBtc2cpIHtcbiAgbXNnID0gJ1snICsgIHR5cGUgKyAnXSA+ICcgKyBtc2c7XG4gIHJldHVybiBtc2c7XG59XG5cbmZ1bmN0aW9uIGNvbnNvbGVQcmludEZuKHR5cGUpIHtcbiAgY29uc3QgZnVuYyA9IHdpbmRvdy5jb25zb2xlW3R5cGVdO1xuICBpZiAoZnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBpZihhcmdzWzBdKSB7XG4gICAgICAgIGFyZ3NbMF0gPSBmb3JtYXRNc2codHlwZSwgYXJnc1swXSk7XG4gICAgICB9XG4gICAgICBmdW5jLmFwcGx5KHdpbmRvdy5jb25zb2xlLCBhcmdzKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiBub29wO1xufVxuXG5mdW5jdGlvbiBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsIC4uLmZ1bmN0aW9ucykge1xuICBmdW5jdGlvbnMuZm9yRWFjaChmdW5jdGlvbih0eXBlKSB7XG4gICAgZXhwb3J0ZWRMb2dnZXJbdHlwZV0gPSBkZWJ1Z0NvbmZpZ1t0eXBlXSA/IGRlYnVnQ29uZmlnW3R5cGVdLmJpbmQoZGVidWdDb25maWcpIDogY29uc29sZVByaW50Rm4odHlwZSk7XG4gIH0pO1xufVxuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Z0NvbmZpZykge1xuICBpZiAoZGVidWdDb25maWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnQ29uZmlnID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZyxcbiAgICAgIC8vIFJlbW92ZSBvdXQgZnJvbSBsaXN0IGhlcmUgdG8gaGFyZC1kaXNhYmxlIGEgbG9nLWxldmVsXG4gICAgICAvLyd0cmFjZScsXG4gICAgICAnZGVidWcnLFxuICAgICAgJ2xvZycsXG4gICAgICAnaW5mbycsXG4gICAgICAnd2FybicsXG4gICAgICAnZXJyb3InXG4gICAgKTtcbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGFsbG93IHRvIHVzZSBiaW5kIG9uIGNvbnNvbGUgb2JqZWN0IGFueXdheVxuICAgIC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgZXhwb3J0ZWRMb2dnZXIubG9nKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5cbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iLCJ2YXIgVVJMSGVscGVyID0ge1xuXG4gIC8vIGJ1aWxkIGFuIGFic29sdXRlIFVSTCBmcm9tIGEgcmVsYXRpdmUgb25lIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlVVJMXG4gIC8vIGlmIHJlbGF0aXZlVVJMIGlzIGFuIGFic29sdXRlIFVSTCBpdCB3aWxsIGJlIHJldHVybmVkIGFzIGlzLlxuICBidWlsZEFic29sdXRlVVJMOiBmdW5jdGlvbihiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xuICAgIC8vIHJlbW92ZSBhbnkgcmVtYWluaW5nIHNwYWNlIGFuZCBDUkxGXG4gICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTC50cmltKCk7XG4gICAgaWYgKC9eW2Etel0rOi9pLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICAvLyBjb21wbGV0ZSB1cmwsIG5vdCByZWxhdGl2ZVxuICAgICAgcmV0dXJuIHJlbGF0aXZlVVJMO1xuICAgIH1cblxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5ID0gbnVsbDtcbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoID0gbnVsbDtcblxuICAgIHZhciByZWxhdGl2ZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoU3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMSGFzaCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMUXVlcnkgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMSGFzaFNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIGJhc2VVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTERvbWFpblNwbGl0ID0gL14oKChbYS16XSspOik/XFwvXFwvW2EtejAtOVxcLlxcLV9+XSsoOlswLTldKyk/XFwvKSguKikkL2kuZXhlYyhiYXNlVVJMKTtcbiAgICB2YXIgYmFzZVVSTFByb3RvY29sID0gYmFzZVVSTERvbWFpblNwbGl0WzNdO1xuICAgIHZhciBiYXNlVVJMRG9tYWluID0gYmFzZVVSTERvbWFpblNwbGl0WzFdO1xuICAgIHZhciBiYXNlVVJMUGF0aCA9IGJhc2VVUkxEb21haW5TcGxpdFs1XTtcblxuICAgIHZhciBidWlsdFVSTCA9IG51bGw7XG4gICAgaWYgKC9eXFwvXFwvLy50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgYnVpbHRVUkwgPSBiYXNlVVJMUHJvdG9jb2wrJzovLycrVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMikpO1xuICAgIH1cbiAgICBlbHNlIGlmICgvXlxcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbitVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoJycsIHJlbGF0aXZlVVJMLnN1YnN0cmluZygxKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgYnVpbHRVUkwgPSBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoYmFzZVVSTERvbWFpbitiYXNlVVJMUGF0aCwgcmVsYXRpdmVVUkwpO1xuICAgIH1cblxuICAgIC8vIHB1dCB0aGUgcXVlcnkgYW5kIGhhc2ggcGFydHMgYmFja1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5KSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoKSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTEhhc2g7XG4gICAgfVxuICAgIHJldHVybiBidWlsdFVSTDtcbiAgfSxcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlUGF0aFxuICAvLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL2RvY3VtZW50L2Nvb2tpZSNVc2luZ19yZWxhdGl2ZV9VUkxzX2luX3RoZV9wYXRoX3BhcmFtZXRlclxuICAvLyB0aGlzIGRvZXMgbm90IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSByZWxhdGl2ZVBhdGggaXMgXCIvXCIgb3IgXCIvL1wiLiBUaGVzZSBjYXNlcyBzaG91bGQgYmUgaGFuZGxlZCBvdXRzaWRlIHRoaXMuXG4gIGJ1aWxkQWJzb2x1dGVQYXRoOiBmdW5jdGlvbihiYXNlUGF0aCwgcmVsYXRpdmVQYXRoKSB7XG4gICAgdmFyIHNSZWxQYXRoID0gcmVsYXRpdmVQYXRoO1xuICAgIHZhciBuVXBMbiwgc0RpciA9ICcnLCBzUGF0aCA9IGJhc2VQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgJyQxJykpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKCcvLi4vJywgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cCgnKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCwnICsgKChuVXBMbiAtIDEpIC8gMykgKyAnfSQnKSwgJy8nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVUkxIZWxwZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLmxvYWRlcixcbiAgICAgICAgdGltZW91dEhhbmRsZSA9IHRoaXMudGltZW91dEhhbmRsZTtcbiAgICBpZiAobG9hZGVyICYmIGxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgbG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGlmICh0aW1lb3V0SGFuZGxlKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwsIGZyYWcgPSBudWxsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgaWYgKGZyYWcgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQpICYmICFpc05hTihmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCkpIHtcbiAgICAgICAgdGhpcy5ieXRlUmFuZ2UgPSBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ICsgJy0nICsgKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0LTEpO1xuICAgIH1cbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHt0cmVxdWVzdDogcGVyZm9ybWFuY2Uubm93KCksIHJldHJ5OiAwfTtcbiAgICB0aGlzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHRoaXMubWF4UmV0cnkgPSBtYXhSZXRyeTtcbiAgICB0aGlzLnJldHJ5RGVsYXkgPSByZXRyeURlbGF5O1xuICAgIHRoaXMubG9hZEludGVybmFsKCk7XG4gIH1cblxuICBsb2FkSW50ZXJuYWwoKSB7XG4gICAgdmFyIHhocjtcblxuICAgIGlmICh0eXBlb2YgWERvbWFpblJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgfVxuXG4gICAgeGhyLm9ubG9hZGVuZCA9IHRoaXMubG9hZGVuZC5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcblxuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgaWYgKHRoaXMuYnl0ZVJhbmdlKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHRoaXMuYnl0ZVJhbmdlKTtcbiAgICB9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgaWYgKHRoaXMueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAoeGhyLCB0aGlzLnVybCk7XG4gICAgfVxuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy50aW1lb3V0KTtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZGVuZChldmVudCkge1xuICAgIHZhciB4aHIgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdGF0dXMgPSB4aHIuc3RhdHVzLFxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgLy8gZG9uJ3QgcHJvY2VlZCBpZiB4aHIgaGFzIGJlZW4gYWJvcnRlZFxuICAgIGlmICghc3RhdHMuYWJvcnRlZCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
