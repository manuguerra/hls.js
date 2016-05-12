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
                hls.trigger(_events2.default.FRAG_LOADING, { frag: frag, creds: this.creds });
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
    value: function onManifestLoading(data) {
      // reset buffer on manifest loading
      _logger.logger.log('trigger BUFFER_RESET');
      this.hls.trigger(_events2.default.BUFFER_RESET);
      this.bufferRange = [];
      this.stalled = false;
      this.creds = data.creds;
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
    value: function loadSource(url, creds) {
      _logger.logger.log('loadSource:' + url);
      this.url = url;
      // when attaching to a source URL, trigger a playlist load
      this.trigger(_events2.default.MANIFEST_LOADING, { url: url, creds: creds });
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
      this.loader.load(frag.url, data.creds, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, 1, 0, this.loadprogress.bind(this), frag);
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
      this.creds = data.creds;
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
      this.loader.load(url, this.creds, '', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), timeout, retry, retryDelay);
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
    value: function load(url, creds, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay) {
      var onProgress = arguments.length <= 9 || arguments[9] === undefined ? null : arguments[9];
      var frag = arguments.length <= 10 || arguments[10] === undefined ? null : arguments[10];

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
      this.creds = creds;
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
      if (this.creds) {
        if (!this.creds.username) {
          console.warn('got credentials, but no username');
        }
        if (!this.creds.password) {
          console.warn('got credentials, but no password');
        }
        xhr.setRequestHeader('Authorization', 'Basic ' + btoa(this.creds.username + ':' + this.creds.password));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwic3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCJzcmMvY29udHJvbGxlci9idWZmZXItY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL2NhcC1sZXZlbC1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlci5qcyIsInNyYy9jcnlwdC9hZXMuanMiLCJzcmMvY3J5cHQvYWVzMTI4LWRlY3J5cHRlci5qcyIsInNyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCJzcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsInNyYy9kZW11eC9hZHRzLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXIuanMiLCJzcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsInNyYy9kZW11eC9pZDMuanMiLCJzcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9ldmVudC1oYW5kbGVyLmpzIiwic3JjL2V2ZW50cy5qcyIsInNyYy9oZWxwZXIvYnVmZmVyLWhlbHBlci5qcyIsInNyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwic3JjL2hscy5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwic3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwic3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCJzcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsInNyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsInNyYy9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyLmpzIiwic3JjL3V0aWxzL2F0dHItbGlzdC5qcyIsInNyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwic3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCJzcmMvdXRpbHMvbG9nZ2VyLmpzIiwic3JjL3V0aWxzL3VybC5qcyIsInNyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtB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QjtBQUUvQixpQkFBSyxPQUFMLEdBRitCO0FBRy9CLG1CQUFPLFVBQVAsQ0FBa0IsS0FBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLElBQXZCLENBQWxCLEVBQWdELEtBQUssVUFBTCxDQUFoRDs7QUFIK0IsZ0JBSy9CLENBQUssVUFBTCxHQUFrQixLQUFLLEdBQUwsQ0FBUyxJQUFJLEtBQUssVUFBTCxFQUFpQixLQUE5QixDQUFsQixDQUwrQjtBQU0vQixrQkFBTSxLQUFOLEdBTitCO1dBQWpDLE1BT087QUFDTCxtQkFBTyxZQUFQLENBQW9CLEtBQUssYUFBTCxDQUFwQixDQURLO0FBRUwsMkJBQU8sS0FBUCxDQUFnQiw2QkFBd0IsS0FBSyxHQUFMLENBQXhDLENBRks7QUFHTCxpQkFBSyxPQUFMLENBQWEsS0FBYixFQUhLO1dBUFA7U0FOQTtPQUZKOzs7O2dDQXdCVSxPQUFPO0FBQ2pCLHFCQUFPLElBQVAsNEJBQXFDLEtBQUssR0FBTCxDQUFyQyxDQURpQjtBQUVqQixXQUFLLFNBQUwsQ0FBZSxLQUFmLEVBQXNCLEtBQUssS0FBTCxDQUF0QixDQUZpQjs7OztpQ0FLTixPQUFPO0FBQ2xCLFVBQUksUUFBUSxLQUFLLEtBQUwsQ0FETTtBQUVsQixVQUFJLE1BQU0sTUFBTixLQUFpQixJQUFqQixFQUF1QjtBQUN6QixjQUFNLE1BQU4sR0FBZSxZQUFZLEdBQVosRUFBZixDQUR5QjtPQUEzQjtBQUdBLFlBQU0sTUFBTixHQUFlLE1BQU0sTUFBTixDQUxHO0FBTWxCLFVBQUksS0FBSyxVQUFMLEVBQWlCO0FBQ25CLGFBQUssVUFBTCxDQUFnQixLQUFoQixFQUF1QixLQUF2QixFQURtQjtPQUFyQjs7OztTQWxIRTs7O2tCQXdIUyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICB2YXIgZXhwID0gY2FjaGVba2V5XS5leHBvcnRzO1xuICAgICAgICAvLyBVc2luZyBiYWJlbCBhcyBhIHRyYW5zcGlsZXIgdG8gdXNlIGVzbW9kdWxlLCB0aGUgZXhwb3J0IHdpbGwgYWx3YXlzXG4gICAgICAgIC8vIGJlIGFuIG9iamVjdCB3aXRoIHRoZSBkZWZhdWx0IGV4cG9ydCBhcyBhIHByb3BlcnR5IG9mIGl0LiBUbyBlbnN1cmVcbiAgICAgICAgLy8gdGhlIGV4aXN0aW5nIGFwaSBhbmQgYmFiZWwgZXNtb2R1bGUgZXhwb3J0cyBhcmUgYm90aCBzdXBwb3J0ZWQgd2VcbiAgICAgICAgLy8gY2hlY2sgZm9yIGJvdGhcbiAgICAgICAgaWYgKGV4cCA9PT0gZm4gfHwgZXhwLmRlZmF1bHQgPT09IGZuKSB7XG4gICAgICAgICAgICB3a2V5ID0ga2V5O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCAoXG4gICAgICAgICAgICAvLyB0cnkgdG8gY2FsbCBkZWZhdWx0IGlmIGRlZmluZWQgdG8gYWxzbyBzdXBwb3J0IGJhYmVsIGVzbW9kdWxlXG4gICAgICAgICAgICAvLyBleHBvcnRzXG4gICAgICAgICAgICAndmFyIGYgPSByZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKTsnICtcbiAgICAgICAgICAgICcoZi5kZWZhdWx0ID8gZi5kZWZhdWx0IDogZikoc2VsZik7J1xuICAgICAgICApKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcblxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuXG4gICAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3cubW96VVJMIHx8IHdpbmRvdy5tc1VSTDtcblxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwiLypcbiAqIHNpbXBsZSBBQlIgQ29udHJvbGxlclxuICogIC0gY29tcHV0ZSBuZXh0IGxldmVsIGJhc2VkIG9uIGxhc3QgZnJhZ21lbnQgYncgaGV1cmlzdGljc1xuICogIC0gaW1wbGVtZW50IGFuIGFiYW5kb24gcnVsZXMgdHJpZ2dlcmVkIGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBidWZmZXJlZCBhbmQgaWYgY29tcHV0ZWQgYncgc2hvd3MgdGhhdCB3ZSByaXNrIGJ1ZmZlciBzdGFsbGluZ1xuICovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCBCdWZmZXJIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2J1ZmZlci1oZWxwZXInO1xuaW1wb3J0IHtFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgQWJyQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5GUkFHX0xPQURJTkcsXG4gICAgICAgICAgICAgICBFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsXG4gICAgICAgICAgICAgICBFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgICAgICAgICAgIEV2ZW50LkVSUk9SKTtcbiAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gMDtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IC0xO1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25DaGVjayA9IHRoaXMuYWJhbmRvblJ1bGVzQ2hlY2suYmluZCh0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGVhclRpbWVyKCk7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbkZyYWdMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbkNoZWNrLCAxMDApO1xuICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBkYXRhLmZyYWc7XG4gIH1cblxuICBvbkZyYWdMb2FkUHJvZ3Jlc3MoZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgLy8gb25seSB1cGRhdGUgc3RhdHMgaWYgZmlyc3QgZnJhZyBsb2FkaW5nXG4gICAgLy8gaWYgc2FtZSBmcmFnIGlzIGxvYWRlZCBtdWx0aXBsZSB0aW1lcywgaXQgbWlnaHQgYmUgaW4gYnJvd3NlciBjYWNoZSwgYW5kIGxvYWRlZCBxdWlja2x5XG4gICAgLy8gYW5kIGxlYWRpbmcgdG8gd3JvbmcgYncgZXN0aW1hdGlvblxuICAgIGlmIChzdGF0cy5hYm9ydGVkID09PSB1bmRlZmluZWQgJiYgZGF0YS5mcmFnLmxvYWRDb3VudGVyID09PSAxKSB7XG4gICAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhdHMudHJlcXVlc3QpIC8gMTAwMDtcbiAgICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICB0aGlzLmxhc3RidyA9IChzdGF0cy5sb2FkZWQgKiA4KSAvIHRoaXMubGFzdGZldGNoZHVyYXRpb247XG4gICAgICAvL2NvbnNvbGUubG9nKGBmZXRjaER1cmF0aW9uOiR7dGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbn0sYnc6JHsodGhpcy5sYXN0YncvMTAwMCkudG9GaXhlZCgwKX0vJHtzdGF0cy5hYm9ydGVkfWApO1xuICAgIH1cbiAgfVxuXG4gIGFiYW5kb25SdWxlc0NoZWNrKCkge1xuICAgIC8qXG4gICAgICBtb25pdG9yIGZyYWdtZW50IHJldHJpZXZhbCB0aW1lLi4uXG4gICAgICB3ZSBjb21wdXRlIGV4cGVjdGVkIHRpbWUgb2YgYXJyaXZhbCBvZiB0aGUgY29tcGxldGUgZnJhZ21lbnQuXG4gICAgICB3ZSBjb21wYXJlIGl0IHRvIGV4cGVjdGVkIHRpbWUgb2YgYnVmZmVyIHN0YXJ2YXRpb25cbiAgICAqL1xuICAgIGxldCBobHMgPSB0aGlzLmhscywgdiA9IGhscy5tZWRpYSxmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAvKiBvbmx5IG1vbml0b3IgZnJhZyByZXRyaWV2YWwgdGltZSBpZlxuICAgICh2aWRlbyBub3QgcGF1c2VkIE9SIGZpcnN0IGZyYWdtZW50IGJlaW5nIGxvYWRlZChyZWFkeSBzdGF0ZSA9PT0gSEFWRV9OT1RISU5HID0gMCkpIEFORCBhdXRvc3dpdGNoaW5nIGVuYWJsZWQgQU5EIG5vdCBsb3dlc3QgbGV2ZWwgKD0+IG1lYW5zIHRoYXQgd2UgaGF2ZSBzZXZlcmFsIGxldmVscykgKi9cbiAgICBpZiAodiAmJiAoIXYucGF1c2VkIHx8ICF2LnJlYWR5U3RhdGUpICYmIGZyYWcuYXV0b0xldmVsICYmIGZyYWcubGV2ZWwpIHtcbiAgICAgIGxldCByZXF1ZXN0RGVsYXkgPSBwZXJmb3JtYW5jZS5ub3coKSAtIGZyYWcudHJlcXVlc3Q7XG4gICAgICAvLyBtb25pdG9yIGZyYWdtZW50IGxvYWQgcHJvZ3Jlc3MgYWZ0ZXIgaGFsZiBvZiBleHBlY3RlZCBmcmFnbWVudCBkdXJhdGlvbix0byBzdGFiaWxpemUgYml0cmF0ZVxuICAgICAgaWYgKHJlcXVlc3REZWxheSA+ICg1MDAgKiBmcmFnLmR1cmF0aW9uKSkge1xuICAgICAgICBsZXQgbG9hZFJhdGUgPSBNYXRoLm1heCgxLGZyYWcubG9hZGVkICogMTAwMCAvIHJlcXVlc3REZWxheSk7IC8vIGJ5dGUvczsgYXQgbGVhc3QgMSBieXRlL3MgdG8gYXZvaWQgZGl2aXNpb24gYnkgemVyb1xuICAgICAgICBpZiAoZnJhZy5leHBlY3RlZExlbiA8IGZyYWcubG9hZGVkKSB7XG4gICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IGZyYWcubG9hZGVkO1xuICAgICAgICB9XG4gICAgICAgIGxldCBwb3MgPSB2LmN1cnJlbnRUaW1lO1xuICAgICAgICBsZXQgZnJhZ0xvYWRlZERlbGF5ID0gKGZyYWcuZXhwZWN0ZWRMZW4gLSBmcmFnLmxvYWRlZCkgLyBsb2FkUmF0ZTtcbiAgICAgICAgbGV0IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA9IEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHYscG9zLGhscy5jb25maWcubWF4QnVmZmVySG9sZSkuZW5kIC0gcG9zO1xuICAgICAgICAvLyBjb25zaWRlciBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gb25seSBpZiB3ZSBoYXZlIGxlc3MgdGhhbiAyIGZyYWcgYnVmZmVyZWQgQU5EXG4gICAgICAgIC8vIHRpbWUgdG8gZmluaXNoIGxvYWRpbmcgY3VycmVudCBmcmFnbWVudCBpcyBiaWdnZXIgdGhhbiBidWZmZXIgc3RhcnZhdGlvbiBkZWxheVxuICAgICAgICAvLyBpZSBpZiB3ZSByaXNrIGJ1ZmZlciBzdGFydmF0aW9uIGlmIGJ3IGRvZXMgbm90IGluY3JlYXNlIHF1aWNrbHlcbiAgICAgICAgaWYgKGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA8IDIqZnJhZy5kdXJhdGlvbiAmJiBmcmFnTG9hZGVkRGVsYXkgPiBidWZmZXJTdGFydmF0aW9uRGVsYXkpIHtcbiAgICAgICAgICBsZXQgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5LCBuZXh0TG9hZExldmVsO1xuICAgICAgICAgIC8vIGxldHMgaXRlcmF0ZSB0aHJvdWdoIGxvd2VyIGxldmVsIGFuZCB0cnkgdG8gZmluZCB0aGUgYmlnZ2VzdCBvbmUgdGhhdCBjb3VsZCBhdm9pZCByZWJ1ZmZlcmluZ1xuICAgICAgICAgIC8vIHdlIHN0YXJ0IGZyb20gY3VycmVudCBsZXZlbCAtIDEgYW5kIHdlIHN0ZXAgZG93biAsIHVudGlsIHdlIGZpbmQgYSBtYXRjaGluZyBsZXZlbFxuICAgICAgICAgIGZvciAobmV4dExvYWRMZXZlbCA9IGZyYWcubGV2ZWwgLSAxIDsgbmV4dExvYWRMZXZlbCA+PTAgOyBuZXh0TG9hZExldmVsLS0pIHtcbiAgICAgICAgICAgIC8vIGNvbXB1dGUgdGltZSB0byBsb2FkIG5leHQgZnJhZ21lbnQgYXQgbG93ZXIgbGV2ZWxcbiAgICAgICAgICAgIC8vIDAuOCA6IGNvbnNpZGVyIG9ubHkgODAlIG9mIGN1cnJlbnQgYncgdG8gYmUgY29uc2VydmF0aXZlXG4gICAgICAgICAgICAvLyA4ID0gYml0cyBwZXIgYnl0ZSAoYnBzL0JwcylcbiAgICAgICAgICAgIGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA9IGZyYWcuZHVyYXRpb24gKiBobHMubGV2ZWxzW25leHRMb2FkTGV2ZWxdLmJpdHJhdGUgLyAoOCAqIDAuOCAqIGxvYWRSYXRlKTtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYGZyYWdMb2FkZWREZWxheS9idWZmZXJTdGFydmF0aW9uRGVsYXkvZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5WyR7bmV4dExvYWRMZXZlbH1dIDoke2ZyYWdMb2FkZWREZWxheS50b0ZpeGVkKDEpfS8ke2J1ZmZlclN0YXJ2YXRpb25EZWxheS50b0ZpeGVkKDEpfS8ke2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheS50b0ZpeGVkKDEpfWApO1xuICAgICAgICAgICAgaWYgKGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA8IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSkge1xuICAgICAgICAgICAgICAvLyB3ZSBmb3VuZCBhIGxvd2VyIGxldmVsIHRoYXQgYmUgcmVidWZmZXJpbmcgZnJlZSB3aXRoIGN1cnJlbnQgZXN0aW1hdGVkIGJ3ICFcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIG9ubHkgZW1lcmdlbmN5IHN3aXRjaCBkb3duIGlmIGl0IHRha2VzIGxlc3MgdGltZSB0byBsb2FkIG5ldyBmcmFnbWVudCBhdCBsb3dlc3QgbGV2ZWwgaW5zdGVhZFxuICAgICAgICAgIC8vIG9mIGZpbmlzaGluZyBsb2FkaW5nIGN1cnJlbnQgb25lIC4uLlxuICAgICAgICAgIGlmIChmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkgPCBmcmFnTG9hZGVkRGVsYXkpIHtcbiAgICAgICAgICAgIC8vIGVuc3VyZSBuZXh0TG9hZExldmVsIGlzIG5vdCBuZWdhdGl2ZVxuICAgICAgICAgICAgbmV4dExvYWRMZXZlbCA9IE1hdGgubWF4KDAsbmV4dExvYWRMZXZlbCk7XG4gICAgICAgICAgICAvLyBmb3JjZSBuZXh0IGxvYWQgbGV2ZWwgaW4gYXV0byBtb2RlXG4gICAgICAgICAgICBobHMubmV4dExvYWRMZXZlbCA9IG5leHRMb2FkTGV2ZWw7XG4gICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYGxvYWRpbmcgdG9vIHNsb3csIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgYW5kIHN3aXRjaCB0byBsZXZlbCAke25leHRMb2FkTGV2ZWx9YCk7XG4gICAgICAgICAgICAvL2Fib3J0IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoKSB7XG4gICAgLy8gc3RvcCBtb25pdG9yaW5nIGJ3IG9uY2UgZnJhZyBsb2FkZWRcbiAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgfVxuXG4gIG9uRXJyb3IoZGF0YSkge1xuICAgIC8vIHN0b3AgdGltZXIgaW4gY2FzZSBvZiBmcmFnIGxvYWRpbmcgZXJyb3JcbiAgICBzd2l0Y2goZGF0YS5kZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgICAgdGhpcy5jbGVhclRpbWVyKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiBjbGVhclRpbWVyKCkge1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidywgaGxzID0gdGhpcy5obHMsYWRqdXN0ZWRidywgaSwgbWF4QXV0b0xldmVsO1xuICAgIGlmICh0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID09PSAtMSkge1xuICAgICAgbWF4QXV0b0xldmVsID0gaGxzLmxldmVscy5sZW5ndGggLSAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9uZXh0QXV0b0xldmVsICE9PSAtMSkge1xuICAgICAgdmFyIG5leHRMZXZlbCA9IE1hdGgubWluKHRoaXMuX25leHRBdXRvTGV2ZWwsbWF4QXV0b0xldmVsKTtcbiAgICAgIGlmIChuZXh0TGV2ZWwgPT09IHRoaXMubGFzdGZldGNobGV2ZWwpIHtcbiAgICAgICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IC0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5leHRMZXZlbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmb2xsb3cgYWxnb3JpdGhtIGNhcHR1cmVkIGZyb20gc3RhZ2VmcmlnaHQgOlxuICAgIC8vIGh0dHBzOi8vYW5kcm9pZC5nb29nbGVzb3VyY2UuY29tL3BsYXRmb3JtL2ZyYW1ld29ya3MvYXYvKy9tYXN0ZXIvbWVkaWEvbGlic3RhZ2VmcmlnaHQvaHR0cGxpdmUvTGl2ZVNlc3Npb24uY3BwXG4gICAgLy8gUGljayB0aGUgaGlnaGVzdCBiYW5kd2lkdGggc3RyZWFtIGJlbG93IG9yIGVxdWFsIHRvIGVzdGltYXRlZCBiYW5kd2lkdGguXG4gICAgZm9yIChpID0gMDsgaSA8PSBtYXhBdXRvTGV2ZWw7IGkrKykge1xuICAgIC8vIGNvbnNpZGVyIG9ubHkgODAlIG9mIHRoZSBhdmFpbGFibGUgYmFuZHdpZHRoLCBidXQgaWYgd2UgYXJlIHN3aXRjaGluZyB1cCxcbiAgICAvLyBiZSBldmVuIG1vcmUgY29uc2VydmF0aXZlICg3MCUpIHRvIGF2b2lkIG92ZXJlc3RpbWF0aW5nIGFuZCBpbW1lZGlhdGVseVxuICAgIC8vIHN3aXRjaGluZyBiYWNrLlxuICAgICAgaWYgKGkgPD0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC44ICogbGFzdGJ3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuNyAqIGxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmIChhZGp1c3RlZGJ3IDwgaGxzLmxldmVsc1tpXS5iaXRyYXRlKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBpIC0gMSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpIC0gMTtcbiAgfVxuXG4gIHNldCBuZXh0QXV0b0xldmVsKG5leHRMZXZlbCkge1xuICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSBuZXh0TGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQWJyQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIEJ1ZmZlciBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5cbmNsYXNzIEJ1ZmZlckNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1FRElBX0FUVEFDSElORyxcbiAgICAgIEV2ZW50Lk1FRElBX0RFVEFDSElORyxcbiAgICAgIEV2ZW50LkJVRkZFUl9SRVNFVCxcbiAgICAgIEV2ZW50LkJVRkZFUl9BUFBFTkRJTkcsXG4gICAgICBFdmVudC5CVUZGRVJfQ09ERUNTLFxuICAgICAgRXZlbnQuQlVGRkVSX0VPUyxcbiAgICAgIEV2ZW50LkJVRkZFUl9GTFVTSElORyk7XG5cbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNCVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU0JVcGRhdGVFcnJvci5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgIC8vIGxpbmsgdmlkZW8gYW5kIG1lZGlhIFNvdXJjZVxuICAgIG1lZGlhLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwobXMpO1xuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmIChtcykge1xuICAgICAgaWYgKG1zLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIGVuZE9mU3RyZWFtIGNvdWxkIHRyaWdnZXIgZXhjZXB0aW9uIGlmIGFueSBzb3VyY2VidWZmZXIgaXMgaW4gdXBkYXRpbmcgc3RhdGVcbiAgICAgICAgICAvLyB3ZSBkb24ndCByZWFsbHkgY2FyZSBhYm91dCBjaGVja2luZyBzb3VyY2VidWZmZXIgc3RhdGUgaGVyZSxcbiAgICAgICAgICAvLyBhcyB3ZSBhcmUgYW55d2F5IGRldGFjaGluZyB0aGUgTWVkaWFTb3VyY2VcbiAgICAgICAgICAvLyBsZXQncyBqdXN0IGF2b2lkIHRoaXMgZXhjZXB0aW9uIHRvIHByb3BhZ2F0ZVxuICAgICAgICAgIG1zLmVuZE9mU3RyZWFtKCk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYG9uTWVkaWFEZXRhY2hpbmc6JHtlcnIubWVzc2FnZX0gd2hpbGUgY2FsbGluZyBlbmRPZlN0cmVhbWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAgIC8vIHVubGluayBNZWRpYVNvdXJjZSBmcm9tIHZpZGVvIHRhZ1xuICAgICAgdGhpcy5tZWRpYS5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWEucmVtb3ZlQXR0cmlidXRlKCdzcmMnKTtcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSBudWxsO1xuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTUVESUFfREVUQUNIRUQpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIG9wZW5lZCcpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNIRUQsIHsgbWVkaWEgOiB0aGlzLm1lZGlhIH0pO1xuICAgIC8vIG9uY2UgcmVjZWl2ZWQsIGRvbid0IGxpc3RlbiBhbnltb3JlIHRvIHNvdXJjZW9wZW4gZXZlbnRcbiAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAvLyBpZiBhbnkgYnVmZmVyIGNvZGVjcyBwZW5kaW5nLCB0cmVhdCBpdCBoZXJlLlxuICAgIHZhciBwZW5kaW5nVHJhY2tzID0gdGhpcy5wZW5kaW5nVHJhY2tzO1xuICAgIGlmIChwZW5kaW5nVHJhY2tzKSB7XG4gICAgICB0aGlzLm9uQnVmZmVyQ29kZWNzKHBlbmRpbmdUcmFja3MpO1xuICAgICAgdGhpcy5wZW5kaW5nVHJhY2tzID0gbnVsbDtcbiAgICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgICB9XG4gIH1cblxuICBvbk1lZGlhU291cmNlQ2xvc2UoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGNsb3NlZCcpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBlbmRlZCcpO1xuICB9XG5cblxuICBvblNCVXBkYXRlRW5kKCkge1xuXG4gICAgaWYgKHRoaXMuX25lZWRzRmx1c2gpIHtcbiAgICAgIHRoaXMuZG9GbHVzaCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9uZWVkc0Vvcykge1xuICAgICAgdGhpcy5vbkJ1ZmZlckVvcygpO1xuICAgIH1cblxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVOREVEKTtcblxuICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgfVxuXG4gIG9uU0JVcGRhdGVFcnJvcihldmVudCkge1xuICAgIGxvZ2dlci5lcnJvcihgc291cmNlQnVmZmVyIGVycm9yOiR7ZXZlbnR9YCk7XG4gICAgLy8gYWNjb3JkaW5nIHRvIGh0dHA6Ly93d3cudzMub3JnL1RSL21lZGlhLXNvdXJjZS8jc291cmNlYnVmZmVyLWFwcGVuZC1lcnJvclxuICAgIC8vIHRoaXMgZXJyb3IgbWlnaHQgbm90IGFsd2F5cyBiZSBmYXRhbCAoaXQgaXMgZmF0YWwgaWYgZGVjb2RlIGVycm9yIGlzIHNldCwgaW4gdGhhdCBjYXNlXG4gICAgLy8gaXQgd2lsbCBiZSBmb2xsb3dlZCBieSBhIG1lZGlhRWxlbWVudCBlcnJvciAuLi4pXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5ESU5HX0VSUk9SLCBmYXRhbDogZmFsc2V9KTtcbiAgICAvLyB3ZSBkb24ndCBuZWVkIHRvIGRvIG1vcmUgdGhhbiB0aGF0LCBhcyBhY2NvcmRpbiB0byB0aGUgc3BlYywgdXBkYXRlZW5kIHdpbGwgYmUgZmlyZWQganVzdCBhZnRlclxuICB9XG5cbiAgb25CdWZmZXJSZXNldCgpIHtcbiAgICB2YXIgc291cmNlQnVmZmVyID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICB2YXIgc2IgPSBzb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuZmx1c2hSYW5nZSA9IFtdO1xuICAgIHRoaXMuYXBwZW5kZWQgPSAwO1xuICB9XG5cbiAgb25CdWZmZXJDb2RlY3ModHJhY2tzKSB7XG4gICAgdmFyIHNiLHRyYWNrTmFtZSx0cmFjaywgY29kZWMsIG1pbWVUeXBlO1xuXG4gICAgaWYgKCF0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSB0cmFja3M7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgdmFyIHNvdXJjZUJ1ZmZlciA9IHt9LCBtZWRpYVNvdXJjZSA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgICBmb3IgKHRyYWNrTmFtZSBpbiB0cmFja3MpIHtcbiAgICAgICAgdHJhY2sgPSB0cmFja3NbdHJhY2tOYW1lXTtcbiAgICAgICAgLy8gdXNlIGxldmVsQ29kZWMgYXMgZmlyc3QgcHJpb3JpdHlcbiAgICAgICAgY29kZWMgPSB0cmFjay5sZXZlbENvZGVjIHx8IHRyYWNrLmNvZGVjO1xuICAgICAgICBtaW1lVHlwZSA9IGAke3RyYWNrLmNvbnRhaW5lcn07Y29kZWNzPSR7Y29kZWN9YDtcbiAgICAgICAgbG9nZ2VyLmxvZyhgY3JlYXRpbmcgc291cmNlQnVmZmVyIHdpdGggbWltZVR5cGU6JHttaW1lVHlwZX1gKTtcbiAgICAgICAgc2IgPSBzb3VyY2VCdWZmZXJbdHJhY2tOYW1lXSA9IG1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcihtaW1lVHlwZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gc291cmNlQnVmZmVyO1xuICAgIH1cbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kaW5nKGRhdGEpIHtcbiAgICBpZiAoIXRoaXMuc2VnbWVudHMpIHtcbiAgICAgIHRoaXMuc2VnbWVudHMgPSBbIGRhdGEgXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZWdtZW50cy5wdXNoKGRhdGEpO1xuICAgIH1cbiAgICB0aGlzLmRvQXBwZW5kaW5nKCk7XG4gIH1cblxuICBvbkJ1ZmZlckFwcGVuZEZhaWwoZGF0YSkge1xuICAgIGxvZ2dlci5lcnJvcihgc291cmNlQnVmZmVyIGVycm9yOiR7ZGF0YS5ldmVudH1gKTtcbiAgICAvLyBhY2NvcmRpbmcgdG8gaHR0cDovL3d3dy53My5vcmcvVFIvbWVkaWEtc291cmNlLyNzb3VyY2VidWZmZXItYXBwZW5kLWVycm9yXG4gICAgLy8gdGhpcyBlcnJvciBtaWdodCBub3QgYWx3YXlzIGJlIGZhdGFsIChpdCBpcyBmYXRhbCBpZiBkZWNvZGUgZXJyb3IgaXMgc2V0LCBpbiB0aGF0IGNhc2VcbiAgICAvLyBpdCB3aWxsIGJlIGZvbGxvd2VkIGJ5IGEgbWVkaWFFbGVtZW50IGVycm9yIC4uLilcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnQ3VycmVudH0pO1xuICB9XG5cbiAgb25CdWZmZXJFb3MoKSB7XG4gICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIsIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICBpZiAoIW1lZGlhU291cmNlIHx8IG1lZGlhU291cmNlLnJlYWR5U3RhdGUgIT09ICdvcGVuJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoISgoc2IuYXVkaW8gJiYgc2IuYXVkaW8udXBkYXRpbmcpIHx8IChzYi52aWRlbyAmJiBzYi52aWRlby51cGRhdGluZykpKSB7XG4gICAgICBsb2dnZXIubG9nKCdhbGwgbWVkaWEgZGF0YSBhdmFpbGFibGUsIHNpZ25hbCBlbmRPZlN0cmVhbSgpIHRvIE1lZGlhU291cmNlIGFuZCBzdG9wIGxvYWRpbmcgZnJhZ21lbnQnKTtcbiAgICAgIC8vTm90aWZ5IHRoZSBtZWRpYSBlbGVtZW50IHRoYXQgaXQgbm93IGhhcyBhbGwgb2YgdGhlIG1lZGlhIGRhdGFcbiAgICAgIG1lZGlhU291cmNlLmVuZE9mU3RyZWFtKCk7XG4gICAgICB0aGlzLl9uZWVkc0VvcyA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9uZWVkc0VvcyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJGbHVzaGluZyhkYXRhKSB7XG4gICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goe3N0YXJ0OiBkYXRhLnN0YXJ0T2Zmc2V0LCBlbmQ6IGRhdGEuZW5kT2Zmc2V0fSk7XG4gICAgLy8gYXR0ZW1wdCBmbHVzaCBpbW1lZGlhdGx5XG4gICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgIHRoaXMuZG9GbHVzaCgpO1xuICB9XG5cbiAgZG9GbHVzaCgpIHtcbiAgICAvLyBsb29wIHRocm91Z2ggYWxsIGJ1ZmZlciByYW5nZXMgdG8gZmx1c2hcbiAgICB3aGlsZSh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmZsdXNoUmFuZ2VbMF07XG4gICAgICAvLyBmbHVzaEJ1ZmZlciB3aWxsIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzIGFuZCBmbHVzaCBBdWRpby9WaWRlbyBCdWZmZXJcbiAgICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyKHJhbmdlLnN0YXJ0LCByYW5nZS5lbmQpKSB7XG4gICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5zaGlmdCgpO1xuICAgICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9uZWVkc0ZsdXNoID0gdHJ1ZTtcbiAgICAgICAgLy8gYXZvaWQgbG9vcGluZywgd2FpdCBmb3IgU0IgdXBkYXRlIGVuZCB0byByZXRyaWdnZXIgYSBmbHVzaFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWRcbiAgICAgIHRoaXMuX25lZWRzRmx1c2ggPSBmYWxzZTtcblxuICAgICAgLy8gbGV0J3MgcmVjb21wdXRlIHRoaXMuYXBwZW5kZWQsIHdoaWNoIGlzIHVzZWQgdG8gYXZvaWQgZmx1c2ggbG9vcGluZ1xuICAgICAgdmFyIGFwcGVuZGVkID0gMDtcbiAgICAgIHZhciBzb3VyY2VCdWZmZXIgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICAgIGlmIChzb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgZm9yICh2YXIgdHlwZSBpbiBzb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICBhcHBlbmRlZCArPSBzb3VyY2VCdWZmZXJbdHlwZV0uYnVmZmVyZWQubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmFwcGVuZGVkID0gYXBwZW5kZWQ7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSEVEKTtcbiAgICB9XG4gIH1cblxuICBkb0FwcGVuZGluZygpIHtcbiAgICB2YXIgaGxzID0gdGhpcy5obHMsIHNvdXJjZUJ1ZmZlciA9IHRoaXMuc291cmNlQnVmZmVyLCBzZWdtZW50cyA9IHRoaXMuc2VnbWVudHM7XG4gICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgaWYgKHRoaXMubWVkaWEuZXJyb3IpIHtcbiAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgbG9nZ2VyLmVycm9yKCd0cnlpbmcgdG8gYXBwZW5kIGFsdGhvdWdoIGEgbWVkaWEgZXJyb3Igb2NjdXJlZCwgZmx1c2ggc2VnbWVudCBhbmQgYWJvcnQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yICh2YXIgdHlwZSBpbiBzb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgaWYgKHNvdXJjZUJ1ZmZlclt0eXBlXS51cGRhdGluZykge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc2IgdXBkYXRlIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBzZWdtZW50ID0gc2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coYGFwcGVuZGluZyAke3NlZ21lbnQudHlwZX0gU0IsIHNpemU6JHtzZWdtZW50LmRhdGEubGVuZ3RofSk7XG5cdFx0ICAvLyBpZiAoc291cmNlQnVmZmVyLmZpcnN0TG9hZGVkICYmICFzb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpIHsgXG5cdFx0ICBcdC8vIHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLnRpbWVzdGFtcE9mZnNldCArPSAxMDtcblx0XHQgIC8vIH1cbiAgICAgICAgICBzb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS5hcHBlbmRCdWZmZXIoc2VnbWVudC5kYXRhKTtcblx0XHQgIHNvdXJjZUJ1ZmZlci5maXJzdExvYWRlZCA9IHRydWU7XG5cblx0XHQgIC8vIHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkge1xuXHRcdCAgLy8gXHRzb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS50aW1lc3RhbXBPZmZzZXQgPSAxNTtcblx0XHQgIC8vIH0sIDUpO1xuXG5cdFx0ICBsb2dnZXIuaW5mbyhzZWdtZW50KTtcbiAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMDtcbiAgICAgICAgICB0aGlzLmFwcGVuZGVkKys7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgLy8gaW4gY2FzZSBhbnkgZXJyb3Igb2NjdXJlZCB3aGlsZSBhcHBlbmRpbmcsIHB1dCBiYWNrIHNlZ21lbnQgaW4gc2VnbWVudHMgdGFibGVcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGVycm9yIHdoaWxlIHRyeWluZyB0byBhcHBlbmQgYnVmZmVyOiR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgc2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICB2YXIgZXZlbnQgPSB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUn07XG4gICAgICAgICAgaWYoZXJyLmNvZGUgIT09IDIyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvcikge1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LmRldGFpbHMgPSBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORF9FUlJPUjtcbiAgICAgICAgICAgIGV2ZW50LmZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICAgICAgLyogd2l0aCBVSEQgY29udGVudCwgd2UgY291bGQgZ2V0IGxvb3Agb2YgcXVvdGEgZXhjZWVkZWQgZXJyb3IgdW50aWxcbiAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvciA+IGhscy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsICR7aGxzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5fSB0aW1lcyB0byBhcHBlbmQgc2VnbWVudCBpbiBzb3VyY2VCdWZmZXJgKTtcbiAgICAgICAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IGZhbHNlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBRdW90YUV4Y2VlZGVkRXJyb3I6IGh0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1L2luZnJhc3RydWN0dXJlLmh0bWwjcXVvdGFleGNlZWRlZGVycm9yXG4gICAgICAgICAgICAvLyBsZXQncyBzdG9wIGFwcGVuZGluZyBhbnkgc2VnbWVudHMsIGFuZCByZXBvcnQgQlVGRkVSX0ZVTExfRVJST1IgZXJyb3JcbiAgICAgICAgICAgIHNlZ21lbnRzID0gW107XG4gICAgICAgICAgICBldmVudC5kZXRhaWxzID0gRXJyb3JEZXRhaWxzLkJVRkZFUl9GVUxMX0VSUk9SO1xuICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsZXZlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAgZmx1c2ggc3BlY2lmaWVkIGJ1ZmZlcmVkIHJhbmdlLFxuICAgIHJldHVybiB0cnVlIG9uY2UgcmFuZ2UgaGFzIGJlZW4gZmx1c2hlZC5cbiAgICBhcyBzb3VyY2VCdWZmZXIucmVtb3ZlKCkgaXMgYXN5bmNocm9ub3VzLCBmbHVzaEJ1ZmZlciB3aWxsIGJlIHJldHJpZ2dlcmVkIG9uIHNvdXJjZUJ1ZmZlciB1cGRhdGUgZW5kXG4gICovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsIGksIGJ1ZlN0YXJ0LCBidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmcgOiBkb24ndCB0cnkgdG8gZmx1c2ggbW9yZSB0aGFuIHRoZSBuYiBvZiBhcHBlbmRlZCBzZWdtZW50c1xuICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA8IHRoaXMuYXBwZW5kZWQgJiYgdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvciAodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgaWYgKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYnVmU3RhcnQgPSBzYi5idWZmZXJlZC5zdGFydChpKTtcbiAgICAgICAgICAgIGJ1ZkVuZCA9IHNiLmJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZmlyZWZveCBub3QgYWJsZSB0byBwcm9wZXJseSBmbHVzaCBtdWx0aXBsZSBidWZmZXJlZCByYW5nZS5cbiAgICAgICAgICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiBlbmRPZmZzZXQgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gZW5kT2Zmc2V0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IE1hdGgubWF4KGJ1ZlN0YXJ0LCBzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLCBlbmRPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc29tZXRpbWVzIHNvdXJjZWJ1ZmZlci5yZW1vdmUoKSBkb2VzIG5vdCBmbHVzaFxuICAgICAgICAgICAgICAgdGhlIGV4YWN0IGV4cGVjdGVkIHRpbWUgcmFuZ2UuXG4gICAgICAgICAgICAgICB0byBhdm9pZCByb3VuZGluZyBpc3N1ZXMvaW5maW5pdGUgbG9vcCxcbiAgICAgICAgICAgICAgIG9ubHkgZmx1c2ggYnVmZmVyIHJhbmdlIG9mIGxlbmd0aCBncmVhdGVyIHRoYW4gNTAwbXMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKE1hdGgubWluKGZsdXNoRW5kLGJ1ZkVuZCkgLSBmbHVzaFN0YXJ0ID4gMC41ICkge1xuICAgICAgICAgICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmbHVzaCAke3R5cGV9IFske2ZsdXNoU3RhcnR9LCR7Zmx1c2hFbmR9XSwgb2YgWyR7YnVmU3RhcnR9LCR7YnVmRW5kfV0sIHBvczoke3RoaXMubWVkaWEuY3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHNiLnJlbW92ZShmbHVzaFN0YXJ0LCBmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oJ2Nhbm5vdCBmbHVzaCwgc2IgdXBkYXRpbmcgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oJ2Fib3J0IGZsdXNoaW5nIHRvbyBtYW55IHJldHJpZXMnKTtcbiAgICB9XG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG4iLCIvKlxuICogY2FwIHN0cmVhbSBsZXZlbCB0byBtZWRpYSBzaXplIGRpbWVuc2lvbiBjb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5cbmNsYXNzIENhcExldmVsQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cdGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1FRElBX0FUVEFDSElORyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX1BBUlNFRCk7ICAgXG5cdH1cblx0XG5cdGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5jYXBMZXZlbFRvUGxheWVyU2l6ZSkge1xuICAgICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgICB0aGlzLmF1dG9MZXZlbENhcHBpbmcgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgICB0aGlzLnRpbWVyID0gY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblx0ICBcblx0b25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdGhpcy5tZWRpYSA9IGRhdGEubWVkaWEgaW5zdGFuY2VvZiBIVE1MVmlkZW9FbGVtZW50ID8gZGF0YS5tZWRpYSA6IG51bGw7ICBcbiAgfVxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZGF0YSkge1xuICAgIGlmICh0aGlzLmhscy5jb25maWcuY2FwTGV2ZWxUb1BsYXllclNpemUpIHtcbiAgICAgIHRoaXMuYXV0b0xldmVsQ2FwcGluZyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgICB0aGlzLmhscy5maXJzdExldmVsID0gdGhpcy5nZXRNYXhMZXZlbChkYXRhLmZpcnN0TGV2ZWwpO1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLmRldGVjdFBsYXllclNpemUuYmluZCh0aGlzKSwgMTAwMCk7XG4gICAgICB0aGlzLmRldGVjdFBsYXllclNpemUoKTtcbiAgICB9XG4gIH1cbiAgXG4gIGRldGVjdFBsYXllclNpemUoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIGxldCBsZXZlbHNMZW5ndGggPSB0aGlzLmxldmVscyA/IHRoaXMubGV2ZWxzLmxlbmd0aCA6IDA7XG4gICAgICBpZiAobGV2ZWxzTGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmcgPSB0aGlzLmdldE1heExldmVsKGxldmVsc0xlbmd0aCAtIDEpO1xuICAgICAgICBpZiAodGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZyA+IHRoaXMuYXV0b0xldmVsQ2FwcGluZykge1xuICAgICAgICAgIC8vIGlmIGF1dG8gbGV2ZWwgY2FwcGluZyBoYXMgYSBoaWdoZXIgdmFsdWUgZm9yIHRoZSBwcmV2aW91cyBvbmUsIGZsdXNoIHRoZSBidWZmZXIgdXNpbmcgbmV4dExldmVsU3dpdGNoXG4gICAgICAgICAgLy8gdXN1YWxseSBoYXBwZW4gd2hlbiB0aGUgdXNlciBnbyB0byB0aGUgZnVsbHNjcmVlbiBtb2RlLlxuICAgICAgICAgIHRoaXMuaGxzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hdXRvTGV2ZWxDYXBwaW5nID0gdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZzsgICAgICAgIFxuICAgICAgfSAgXG4gICAgfVxuICB9XG4gIFxuICAvKlxuICAqIHJldHVybnMgbGV2ZWwgc2hvdWxkIGJlIHRoZSBvbmUgd2l0aCB0aGUgZGltZW5zaW9ucyBlcXVhbCBvciBncmVhdGVyIHRoYW4gdGhlIG1lZGlhIChwbGF5ZXIpIGRpbWVuc2lvbnMgKHNvIHRoZSB2aWRlbyB3aWxsIGJlIGRvd25zY2FsZWQpXG4gICovXG4gIGdldE1heExldmVsKGNhcExldmVsSW5kZXgpIHtcbiAgICBsZXQgcmVzdWx0LFxuICAgICAgICBpLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAgbVdpZHRoID0gdGhpcy5tZWRpYVdpZHRoLFxuICAgICAgICBtSGVpZ2h0ID0gdGhpcy5tZWRpYUhlaWdodCxcbiAgICAgICAgbFdpZHRoID0gMCxcbiAgICAgICAgbEhlaWdodCA9IDA7XG4gICAgICAgIFxuICAgIGZvciAoaSA9IDA7IGkgPD0gY2FwTGV2ZWxJbmRleDsgaSsrKSB7XG4gICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW2ldO1xuICAgICAgcmVzdWx0ID0gaTtcbiAgICAgIGxXaWR0aCA9IGxldmVsLndpZHRoO1xuICAgICAgbEhlaWdodCA9IGxldmVsLmhlaWdodDtcbiAgICAgIGlmIChtV2lkdGggPD0gbFdpZHRoIHx8IG1IZWlnaHQgPD0gbEhlaWdodCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9ICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIFxuICBnZXQgY29udGVudFNjYWxlRmFjdG9yKCkge1xuICAgIGxldCBwaXhlbFJhdGlvID0gMTtcbiAgICB0cnkge1xuICAgICAgcGl4ZWxSYXRpbyA9ICB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgICB9IGNhdGNoKGUpIHt9XG4gICAgcmV0dXJuIHBpeGVsUmF0aW87XG4gIH1cbiAgXG4gIGdldCBtZWRpYVdpZHRoKCkge1xuICAgIGxldCB3aWR0aDtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgd2lkdGggPSB0aGlzLm1lZGlhLndpZHRoIHx8IHRoaXMubWVkaWEuY2xpZW50V2lkdGggfHwgdGhpcy5tZWRpYS5vZmZzZXRXaWR0aDtcbiAgICAgIHdpZHRoICo9IHRoaXMuY29udGVudFNjYWxlRmFjdG9yO1xuICAgIH1cbiAgICByZXR1cm4gd2lkdGg7XG4gIH1cbiAgXG4gIGdldCBtZWRpYUhlaWdodCgpIHtcbiAgICBsZXQgaGVpZ2h0O1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICBoZWlnaHQgPSB0aGlzLm1lZGlhLmhlaWdodCB8fCB0aGlzLm1lZGlhLmNsaWVudEhlaWdodCB8fCB0aGlzLm1lZGlhLm9mZnNldEhlaWdodDtcbiAgICAgIGhlaWdodCAqPSB0aGlzLmNvbnRlbnRTY2FsZUZhY3RvcjsgXG4gICAgfVxuICAgIHJldHVybiBoZWlnaHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ2FwTGV2ZWxDb250cm9sbGVyOyIsIi8qXG4gKiBMZXZlbCBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBMZXZlbENvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgIEV2ZW50LkVSUk9SKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgc3RhcnRMb2FkKCkge1xuICAgIHRoaXMuY2FubG9hZCA9IHRydWU7XG4gICAgLy8gc3BlZWQgdXAgbGl2ZSBwbGF5bGlzdCByZWZyZXNoIGlmIHRpbWVyIGV4aXN0c1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBzdG9wTG9hZCgpIHtcbiAgICB0aGlzLmNhbmxvYWQgPSBmYWxzZTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZGF0YSkge1xuICAgIHZhciBsZXZlbHMwID0gW10sIGxldmVscyA9IFtdLCBiaXRyYXRlU3RhcnQsIGksIGJpdHJhdGVTZXQgPSB7fSwgdmlkZW9Db2RlY0ZvdW5kID0gZmFsc2UsIGF1ZGlvQ29kZWNGb3VuZCA9IGZhbHNlLCBobHMgPSB0aGlzLmhscztcblxuICAgIC8vIHJlZ3JvdXAgcmVkdW5kYW50IGxldmVsIHRvZ2V0aGVyXG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgIHZpZGVvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZihsZXZlbC5hdWRpb0NvZGVjKSB7XG4gICAgICAgIGF1ZGlvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICB2YXIgcmVkdW5kYW50TGV2ZWxJZCA9IGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV07XG4gICAgICBpZiAocmVkdW5kYW50TGV2ZWxJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSBsZXZlbHMwLmxlbmd0aDtcbiAgICAgICAgbGV2ZWwudXJsID0gW2xldmVsLnVybF07XG4gICAgICAgIGxldmVsLnVybElkID0gMDtcbiAgICAgICAgbGV2ZWxzMC5wdXNoKGxldmVsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVsczBbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHJlbW92ZSBhdWRpby1vbmx5IGxldmVsIGlmIHdlIGFsc28gaGF2ZSBsZXZlbHMgd2l0aCBhdWRpbyt2aWRlbyBjb2RlY3Mgc2lnbmFsbGVkXG4gICAgaWYodmlkZW9Db2RlY0ZvdW5kICYmIGF1ZGlvQ29kZWNGb3VuZCkge1xuICAgICAgbGV2ZWxzMC5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldmVscyA9IGxldmVsczA7XG4gICAgfVxuXG4gICAgLy8gb25seSBrZWVwIGxldmVsIHdpdGggc3VwcG9ydGVkIGF1ZGlvL3ZpZGVvIGNvZGVjc1xuICAgIGxldmVscyA9IGxldmVscy5maWx0ZXIoZnVuY3Rpb24obGV2ZWwpIHtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZEF1ZGlvID0gZnVuY3Rpb24oY29kZWMpIHsgcmV0dXJuIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZChgYXVkaW8vbXA0O2NvZGVjcz0ke2NvZGVjfWApO307XG4gICAgICB2YXIgY2hlY2tTdXBwb3J0ZWRWaWRlbyA9IGZ1bmN0aW9uKGNvZGVjKSB7IHJldHVybiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoYHZpZGVvL21wNDtjb2RlY3M9JHtjb2RlY31gKTt9O1xuICAgICAgdmFyIGF1ZGlvQ29kZWMgPSBsZXZlbC5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gbGV2ZWwudmlkZW9Db2RlYztcblxuICAgICAgcmV0dXJuICghYXVkaW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZEF1ZGlvKGF1ZGlvQ29kZWMpKSAmJlxuICAgICAgICAgICAgICghdmlkZW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZFZpZGVvKHZpZGVvQ29kZWMpKTtcbiAgICB9KTtcblxuICAgIGlmKGxldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0YXJ0IGJpdHJhdGUgaXMgdGhlIGZpcnN0IGJpdHJhdGUgb2YgdGhlIG1hbmlmZXN0XG4gICAgICBiaXRyYXRlU3RhcnQgPSBsZXZlbHNbMF0uYml0cmF0ZTtcbiAgICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgICAgbGV2ZWxzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEuYml0cmF0ZSAtIGIuYml0cmF0ZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fbGV2ZWxzID0gbGV2ZWxzO1xuICAgICAgLy8gZmluZCBpbmRleCBvZiBmaXJzdCBsZXZlbCBpbiBzb3J0ZWQgbGV2ZWxzXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChsZXZlbHNbaV0uYml0cmF0ZSA9PT0gYml0cmF0ZVN0YXJ0KSB7XG4gICAgICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IGk7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgbG9hZGVkLCR7bGV2ZWxzLmxlbmd0aH0gbGV2ZWwocykgZm91bmQsIGZpcnN0IGJpdHJhdGU6JHtiaXRyYXRlU3RhcnR9YCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwge2xldmVsczogdGhpcy5fbGV2ZWxzLCBmaXJzdExldmVsOiB0aGlzLl9maXJzdExldmVsLCBzdGF0czogZGF0YS5zdGF0c30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9JTkNPTVBBVElCTEVfQ09ERUNTX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiBobHMudXJsLCByZWFzb246ICdubyBsZXZlbCB3aXRoIGNvbXBhdGlibGUgY29kZWNzIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYgKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCB8fCB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdLmRldGFpbHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zZXRMZXZlbEludGVybmFsKG5ld0xldmVsKTtcbiAgICB9XG4gIH1cblxuIHNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpIHtcbiAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICBpZiAobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMuX2xldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgIGxvZ2dlci5sb2coYHN3aXRjaGluZyB0byBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9TV0lUQ0gsIHtsZXZlbDogbmV3TGV2ZWx9KTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tuZXdMZXZlbF07XG4gICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICBpZiAobGV2ZWwuZGV0YWlscyA9PT0gdW5kZWZpbmVkIHx8IGxldmVsLmRldGFpbHMubGl2ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgb3IgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIChyZSlsb2FkIGl0XG4gICAgICAgIGxvZ2dlci5sb2coYChyZSlsb2FkaW5nIHBsYXlsaXN0IGZvciBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICB2YXIgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbmV3TGV2ZWwsIGlkOiB1cmxJZH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuT1RIRVJfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5MRVZFTF9TV0lUQ0hfRVJST1IsIGxldmVsOiBuZXdMZXZlbCwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICB9XG4gfVxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIGlmIChuZXdMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB9XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgaWYoZGF0YS5mYXRhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkZXRhaWxzID0gZGF0YS5kZXRhaWxzLCBobHMgPSB0aGlzLmhscywgbGV2ZWxJZCwgbGV2ZWw7XG4gICAgLy8gdHJ5IHRvIHJlY292ZXIgbm90IGZhdGFsIGVycm9yc1xuICAgIHN3aXRjaChkZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAgbGV2ZWxJZCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgICAgbGV2ZWxJZCA9IGRhdGEubGV2ZWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8qIHRyeSB0byBzd2l0Y2ggdG8gYSByZWR1bmRhbnQgc3RyZWFtIGlmIGFueSBhdmFpbGFibGUuXG4gICAgICogaWYgbm8gcmVkdW5kYW50IHN0cmVhbSBhdmFpbGFibGUsIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAoaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCAwKVxuICAgICAqIG90aGVyd2lzZSwgd2UgY2Fubm90IHJlY292ZXIgdGhpcyBuZXR3b3JrIGVycm9yIC4uLlxuICAgICAqIGRvbid0IHJhaXNlIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXMgZmF0YWwsIGFzIGl0IGlzIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICovXG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZiAobGV2ZWwudXJsSWQgPCAobGV2ZWwudXJsLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZiAocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICBobHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsID0gMDtcbiAgICAgICAgfSBlbHNlIGlmKGxldmVsICYmIGxldmVsLmRldGFpbHMgJiYgbGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBvbiBsaXZlIHN0cmVhbSwgZGlzY2FyZGApO1xuICAgICAgICAvLyBGUkFHX0xPQURfRVJST1IgYW5kIEZSQUdfTE9BRF9USU1FT1VUIGFyZSBoYW5kbGVkIGJ5IG1lZGlhQ29udHJvbGxlclxuICAgICAgICB9IGVsc2UgaWYgKGRldGFpbHMgIT09IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IgJiYgZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBjYW5ub3QgcmVjb3ZlciAke2RldGFpbHN9IGVycm9yYCk7XG4gICAgICAgICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZiAoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwICogZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uLzMpO1xuICAgIH1cbiAgICBpZiAoIWRhdGEuZGV0YWlscy5saXZlICYmIHRoaXMudGltZXIpIHtcbiAgICAgIC8vIHBsYXlsaXN0IGlzIG5vdCBsaXZlIGFuZCB0aW1lciBpcyBhcm1lZCA6IHN0b3BwaW5nIGl0XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgbGV2ZWxJZCA9IHRoaXMuX2xldmVsO1xuICAgIGlmIChsZXZlbElkICE9PSB1bmRlZmluZWQgJiYgdGhpcy5jYW5sb2FkKSB7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF0sIHVybElkID0gbGV2ZWwudXJsSWQ7XG5cdCAgdmFyIHRvdGFsRHVyYXRpb24gPSAwO1xuXHQgIGZvciAodmFyIGYgaW4gbGV2ZWwuZGV0YWlscy5mcmFnbWVudHMgKSB7XG5cdFx0ICB0b3RhbER1cmF0aW9uID0gbGV2ZWwuZGV0YWlscy5mcmFnbWVudHNbZl0uZW5kUFRTO1xuXHQgIH1cbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywge3VybDogbGV2ZWwudXJsW3VybElkXSwgbGV2ZWw6IGxldmVsSWQsIGlkOiB1cmxJZCwgdG90YWxEdXJhdGlvbjogdG90YWxEdXJhdGlvbiB8fCAwfSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX21hbnVhbExldmVsICE9PSAtMSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgIHJldHVybiB0aGlzLmhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IG5leHRMb2FkTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5sZXZlbCA9IG5leHRMZXZlbDtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgPT09IC0xKSB7XG4gICAgICB0aGlzLmhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWwgPSBuZXh0TGV2ZWw7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFN0cmVhbSBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRGVtdXhlciBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IEJpbmFyeVNlYXJjaCBmcm9tICcuLi91dGlscy9iaW5hcnktc2VhcmNoJztcbmltcG9ydCBCdWZmZXJIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2J1ZmZlci1oZWxwZXInO1xuaW1wb3J0IExldmVsSGVscGVyIGZyb20gJy4uL2hlbHBlci9sZXZlbC1oZWxwZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNvbnN0IFN0YXRlID0ge1xuICBTVE9QUEVEIDogJ1NUT1BQRUQnLFxuICBTVEFSVElORyA6ICdTVEFSVElORycsXG4gIElETEUgOiAnSURMRScsXG4gIFBBVVNFRCA6ICdQQVVTRUQnLFxuICBLRVlfTE9BRElORyA6ICdLRVlfTE9BRElORycsXG4gIEZSQUdfTE9BRElORyA6ICdGUkFHX0xPQURJTkcnLFxuICBGUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWSA6ICdGUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWScsXG4gIFdBSVRJTkdfTEVWRUwgOiAnV0FJVElOR19MRVZFTCcsXG4gIFBBUlNJTkcgOiAnUEFSU0lORycsXG4gIFBBUlNFRCA6ICdQQVJTRUQnLFxuICBFTkRFRCA6ICdFTkRFRCcsXG4gIEVSUk9SIDogJ0VSUk9SJ1xufTtcblxuY2xhc3MgU3RyZWFtQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNIRUQsXG4gICAgICBFdmVudC5NRURJQV9ERVRBQ0hJTkcsXG4gICAgICBFdmVudC5NQU5JRkVTVF9MT0FESU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuS0VZX0xPQURFRCxcbiAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxcbiAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLFxuICAgICAgRXZlbnQuRlJBR19QQVJTRUQsXG4gICAgICBFdmVudC5FUlJPUixcbiAgICAgIEV2ZW50LkJVRkZFUl9BUFBFTkRFRCxcbiAgICAgIEV2ZW50LkJVRkZFUl9GTFVTSEVEKTtcblxuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICB0aGlzLmF1ZGlvQ29kZWNTd2FwID0gZmFsc2U7XG4gICAgdGhpcy50aWNrcyA9IDA7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdG9wTG9hZCgpO1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICB9XG5cbiAgc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb249MCkge1xuICAgIGlmICh0aGlzLmxldmVscykge1xuICAgICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSwgbGFzdEN1cnJlbnRUaW1lID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICB0aGlzLnN0b3BMb2FkKCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcih0aGlzLmhscyk7XG4gICAgICBpZiAoIXRoaXMudGltZXIpIHtcbiAgICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgICAgfVxuICAgICAgdGhpcy5sZXZlbCA9IC0xO1xuICAgICAgdGhpcy5mcmFnTG9hZEVycm9yID0gMDtcbiAgICAgIGlmIChtZWRpYSAmJiBsYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgbG9nZ2VyLmxvZyhgY29uZmlndXJlIHN0YXJ0UG9zaXRpb24gQCR7bGFzdEN1cnJlbnRUaW1lfWApO1xuICAgICAgICBpZiAoIXRoaXMubGFzdFBhdXNlZCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3Jlc3VtaW5nIHZpZGVvJyk7XG4gICAgICAgICAgbWVkaWEucGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb24gPyB0aGlzLnN0YXJ0UG9zaXRpb24gOiBzdGFydFBvc2l0aW9uO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RBUlRJTkc7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgbWFuaWZlc3Qgbm90IHBhcnNlZCB5ZXQnKTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICAgIH1cbiAgfVxuXG4gIHN0b3BMb2FkKCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZykge1xuICAgICAgaWYgKGZyYWcubG9hZGVyKSB7XG4gICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgIGlmICh0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RPUFBFRDtcbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdGhpcy50aWNrcysrO1xuICAgIGlmICh0aGlzLnRpY2tzID09PSAxKSB7XG4gICAgICB0aGlzLmRvVGljaygpO1xuICAgICAgaWYgKHRoaXMudGlja3MgPiAxKSB7XG4gICAgICAgIHNldFRpbWVvdXQodGhpcy50aWNrLCAxKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGlja3MgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGRvVGljaygpIHtcbiAgICB2YXIgcG9zLCBsZXZlbCwgbGV2ZWxEZXRhaWxzLCBobHMgPSB0aGlzLmhscywgY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgY2FzZSBTdGF0ZS5QQVVTRUQ6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gcGF1c2VkIHN0YXRlIGVpdGhlciAuLi5cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlNUQVJUSU5HOlxuICAgICAgICAvLyBkZXRlcm1pbmUgbG9hZCBsZXZlbFxuICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSBobHMuc3RhcnRMZXZlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyAtMSA6IGd1ZXNzIHN0YXJ0IExldmVsIGJ5IGRvaW5nIGEgYml0cmF0ZSB0ZXN0IGJ5IGxvYWRpbmcgZmlyc3QgZnJhZ21lbnQgb2YgbG93ZXN0IHF1YWxpdHkgbGV2ZWxcbiAgICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSAwO1xuICAgICAgICAgIHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgbmV3IGxldmVsIHRvIHBsYXlsaXN0IGxvYWRlciA6IHRoaXMgd2lsbCB0cmlnZ2VyIHN0YXJ0IGxldmVsIGxvYWRcbiAgICAgICAgdGhpcy5sZXZlbCA9IGhscy5uZXh0TG9hZExldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuV0FJVElOR19MRVZFTDtcbiAgICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuSURMRTpcbiAgICAgICAgLy8gaWYgdmlkZW8gbm90IGF0dGFjaGVkIEFORFxuICAgICAgICAvLyBzdGFydCBmcmFnbWVudCBhbHJlYWR5IHJlcXVlc3RlZCBPUiBzdGFydCBmcmFnIHByZWZldGNoIGRpc2FibGVcbiAgICAgICAgLy8gZXhpdCBsb29wXG4gICAgICAgIC8vID0+IGlmIG1lZGlhIG5vdCBhdHRhY2hlZCBidXQgc3RhcnQgZnJhZyBwcmVmZXRjaCBpcyBlbmFibGVkIGFuZCBzdGFydCBmcmFnIG5vdCByZXF1ZXN0ZWQgeWV0LCB3ZSB3aWxsIG5vdCBleGl0IGxvb3BcbiAgICAgICAgaWYgKCF0aGlzLm1lZGlhICYmXG4gICAgICAgICAgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkIHx8ICFjb25maWcuc3RhcnRGcmFnUHJlZmV0Y2gpKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgY2FuZGlkYXRlIGZyYWdtZW50IHRvIGJlIGxvYWRlZCwgYmFzZWQgb24gY3VycmVudCBwb3NpdGlvbiBhbmRcbiAgICAgICAgLy8gIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgLy8gIGVuc3VyZSA2MHMgb2YgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBub3QgeWV0IGxvYWRlZCBhbnkgZnJhZ21lbnQsIHN0YXJ0IGxvYWRpbmcgZnJvbSBzdGFydCBwb3NpdGlvblxuICAgICAgICBpZiAodGhpcy5sb2FkZWRtZXRhZGF0YSkge1xuICAgICAgICAgIHBvcyA9IHRoaXMubWVkaWEuY3VycmVudFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5uZXh0TG9hZFBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGxvYWQgbGV2ZWxcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHRoaXMubWVkaWEscG9zLGNvbmZpZy5tYXhCdWZmZXJIb2xlKSxcbiAgICAgICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLFxuICAgICAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVySW5mby5lbmQsXG4gICAgICAgICAgICBmcmFnUHJldmlvdXMgPSB0aGlzLmZyYWdQcmV2aW91cyxcbiAgICAgICAgICAgIG1heEJ1Zkxlbjtcblx0XHQvLyBjb25zb2xlLmluZm8oYnVmZmVySW5mbyk7XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYgKCh0aGlzLmxldmVsc1tsZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1heCg4ICogY29uZmlnLm1heEJ1ZmZlclNpemUgLyB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSwgY29uZmlnLm1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5taW4obWF4QnVmTGVuLCBjb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBjb25maWcubWF4QnVmZmVyTGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGJ1ZmZlciBsZW5ndGggaXMgbGVzcyB0aGFuIG1heEJ1ZkxlbiB0cnkgdG8gbG9hZCBhIG5ldyBmcmFnbWVudFxuICAgICAgICBpZiAoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgLy8gc2V0IG5leHQgbG9hZCBsZXZlbCA6IHRoaXMgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZCBpZiBuZWVkZWRcbiAgICAgICAgICBobHMubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICAgICAgICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICBsZXZlbERldGFpbHMgPSB0aGlzLmxldmVsc1tsZXZlbF0uZGV0YWlscztcbiAgICAgICAgICAvLyBpZiBsZXZlbCBpbmZvIG5vdCByZXRyaWV2ZWQgeWV0LCBzd2l0Y2ggc3RhdGUgYW5kIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIGVuc3VyZSB0aGF0IG5ldyBwbGF5bGlzdCBoYXMgYmVlbiByZWZyZXNoZWQgdG8gYXZvaWQgbG9hZGluZy90cnkgdG8gbG9hZFxuICAgICAgICAgIC8vIGEgdXNlbGVzcyBhbmQgb3V0ZGF0ZWQgZnJhZ21lbnQgKHRoYXQgbWlnaHQgZXZlbiBpbnRyb2R1Y2UgbG9hZCBlcnJvciBpZiBpdCBpcyBhbHJlYWR5IG91dCBvZiB0aGUgbGl2ZSBwbGF5bGlzdClcbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcgfHwgbGV2ZWxEZXRhaWxzLmxpdmUgJiYgdGhpcy5sZXZlbExhc3RMb2FkZWQgIT09IGxldmVsKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBmaW5kIGZyYWdtZW50IGluZGV4LCBjb250aWd1b3VzIHdpdGggZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAgIGxldCBmcmFnbWVudHMgPSBsZXZlbERldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICAgICAgICBmcmFnTGVuID0gZnJhZ21lbnRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgc3RhcnQgPSBmcmFnbWVudHNbMF0uc3RhcnQsXG4gICAgICAgICAgICAgIGVuZCA9IGZyYWdtZW50c1tmcmFnTGVuLTFdLnN0YXJ0ICsgZnJhZ21lbnRzW2ZyYWdMZW4tMV0uZHVyYXRpb24sXG4gICAgICAgICAgICAgIGZyYWc7XG5cbiAgICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICBpZiAobGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHJlcXVlc3RlZCBwb3NpdGlvbiBpcyB3aXRoaW4gc2Vla2FibGUgYm91bmRhcmllcyA6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coYHN0YXJ0L3Bvcy9idWZFbmQvc2Vla2luZzoke3N0YXJ0LnRvRml4ZWQoMyl9LyR7cG9zLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9LyR7dGhpcy5tZWRpYS5zZWVraW5nfWApO1xuICAgICAgICAgICAgbGV0IG1heExhdGVuY3kgPSBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb24gOiBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50KmxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbjtcblxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IE1hdGgubWF4KHN0YXJ0LCBlbmQgLSBtYXhMYXRlbmN5KSkge1xuICAgICAgICAgICAgICAgIGxldCB0YXJnZXRMYXRlbmN5ID0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uIDogY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAqIGxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbjtcbiAgICAgICAgICAgICAgICB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkID0gc3RhcnQgKyBNYXRoLm1heCgwLCBsZXZlbERldGFpbHMudG90YWxkdXJhdGlvbiAtIHRhcmdldExhdGVuY3kpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIHRvbyBmYXIgZnJvbSB0aGUgZW5kIG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyQnVmZmVyZWQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkICYmICFsZXZlbERldGFpbHMuUFRTS25vd24pIHtcbiAgICAgICAgICAgICAgLyogd2UgYXJlIHN3aXRjaGluZyBsZXZlbCBvbiBsaXZlIHBsYXlsaXN0LCBidXQgd2UgZG9uJ3QgaGF2ZSBhbnkgUFRTIGluZm8gZm9yIHRoYXQgcXVhbGl0eSBsZXZlbCAuLi5cbiAgICAgICAgICAgICAgICAgdHJ5IHRvIGxvYWQgZnJhZyBtYXRjaGluZyB3aXRoIG5leHQgU04uXG4gICAgICAgICAgICAgICAgIGV2ZW4gaWYgU04gYXJlIG5vdCBzeW5jaHJvbml6ZWQgYmV0d2VlbiBwbGF5bGlzdHMsIGxvYWRpbmcgdGhpcyBmcmFnIHdpbGwgaGVscCB1c1xuICAgICAgICAgICAgICAgICBjb21wdXRlIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZSBhZnRlciBpbiBjYXNlIGl0IHdhcyBub3QgdGhlIHJpZ2h0IGNvbnNlY3V0aXZlIG9uZSAqL1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldFNOID0gZnJhZ1ByZXZpb3VzLnNuICsgMTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U04gPj0gbGV2ZWxEZXRhaWxzLnN0YXJ0U04gJiYgdGFyZ2V0U04gPD0gbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW3RhcmdldFNOIC0gbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCBsb2FkIGZyYWcgd2l0aCBuZXh0IFNOOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgICAgIC8qIHdlIGhhdmUgbm8gaWRlYSBhYm91dCB3aGljaCBmcmFnbWVudCBzaG91bGQgYmUgbG9hZGVkLlxuICAgICAgICAgICAgICAgICAgIHNvIGxldCdzIGxvYWQgbWlkIGZyYWdtZW50LiBpdCB3aWxsIGhlbHAgY29tcHV0aW5nIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tNYXRoLm1pbihmcmFnTGVuIC0gMSwgTWF0aC5yb3VuZChmcmFnTGVuIC8gMikpXTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIHVua25vd24sIGxvYWQgbWlkZGxlIGZyYWcgOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVm9EIHBsYXlsaXN0OiBpZiBidWZmZXJFbmQgYmVmb3JlIHN0YXJ0IG9mIHBsYXlsaXN0LCBsb2FkIGZpcnN0IGZyYWdtZW50XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgc3RhcnQpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICBsZXQgZm91bmRGcmFnO1xuICAgICAgICAgICAgbGV0IG1heEZyYWdMb29rVXBUb2xlcmFuY2UgPSBjb25maWcubWF4RnJhZ0xvb2tVcFRvbGVyYW5jZTtcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBlbmQpIHtcbiAgICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA+IGVuZCAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2UpIHtcbiAgICAgICAgICAgICAgICBtYXhGcmFnTG9va1VwVG9sZXJhbmNlID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBCaW5hcnlTZWFyY2guc2VhcmNoKGZyYWdtZW50cywgKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5IC0gY29uZmlnLm1heEZyYWdMb29rVXBUb2xlcmFuY2VcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIHRvIGNvcGUgd2l0aCBzaXR1YXRpb25zIGxpa2VcbiAgICAgICAgICAgICAgICAvLyBidWZmZXJFbmQgPSA5Ljk5MVxuICAgICAgICAgICAgICAgIC8vIGZyYWdbw5hdIDogWzAsMTBdXG4gICAgICAgICAgICAgICAgLy8gZnJhZ1sxXSA6IFsxMCwyMF1cbiAgICAgICAgICAgICAgICAvLyBidWZmZXJFbmQgaXMgd2l0aGluIGZyYWdbMF0gcmFuZ2UgLi4uIGFsdGhvdWdoIHdoYXQgd2UgYXJlIGV4cGVjdGluZyBpcyB0byByZXR1cm4gZnJhZ1sxXSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICBmcmFnIHN0YXJ0ICAgICAgICAgICAgICAgZnJhZyBzdGFydCtkdXJhdGlvblxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgIHwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgIDwtLS0+ICAgICAgICAgICAgICAgICAgICAgICAgIDwtLS0+XG4gICAgICAgICAgICAgICAgICAgIC8vICAuLi4tLS0tLS0tLT48LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0+PC0tLS0tLS0tLS4uLi5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJldmlvdXMgZnJhZyAgICAgICAgIG1hdGNoaW5nIGZyYWdtZW50ICAgICAgICAgbmV4dCBmcmFnXG4gICAgICAgICAgICAgICAgICAgIC8vICByZXR1cm4gLTEgICAgICAgICAgICAgcmV0dXJuIDAgICAgICAgICAgICAgICAgIHJldHVybiAxXG4gICAgICAgICAgICAgICAgLy8gbG9nZ2VyLmxvZyhgbGV2ZWwvc24vc3RhcnQvZW5kL2J1ZkVuZDoke2xldmVsfS8ke2NhbmRpZGF0ZS5zbn0vJHtjYW5kaWRhdGUuc3RhcnQgLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlfS8keyhjYW5kaWRhdGUuc3RhcnQrY2FuZGlkYXRlLmR1cmF0aW9uIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSl9LyR7YnVmZmVyRW5kfWApO1xuICAgICAgICAgICAgICAgIGlmICgoY2FuZGlkYXRlLnN0YXJ0ICsgY2FuZGlkYXRlLmR1cmF0aW9uIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSkgPD0gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2FuZGlkYXRlLnN0YXJ0IC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSA+IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgICAgIH1cblx0XHRcdCAgXHQvLyBjb25zb2xlLmluZm8oY2FuZGlkYXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgICAgfSk7XG5cdFx0XHQgIC8vIGNvbnNvbGUuaW5mbyhmb3VuZEZyYWcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gcmVhY2ggZW5kIG9mIHBsYXlsaXN0XG4gICAgICAgICAgICAgIGZvdW5kRnJhZyA9IGZyYWdtZW50c1tmcmFnTGVuLTFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZvdW5kRnJhZykge1xuICAgICAgICAgICAgICBmcmFnID0gZm91bmRGcmFnO1xuICAgICAgICAgICAgICBzdGFydCA9IGZvdW5kRnJhZy5zdGFydDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIFNOIG1hdGNoaW5nIHdpdGggcG9zOicgKyAgYnVmZmVyRW5kICsgJzonICsgZnJhZy5zbik7XG4gICAgICAgICAgICAgIGlmIChmcmFnUHJldmlvdXMgJiYgZnJhZy5sZXZlbCA9PT0gZnJhZ1ByZXZpb3VzLmxldmVsICYmIGZyYWcuc24gPT09IGZyYWdQcmV2aW91cy5zbikge1xuICAgICAgICAgICAgICAgIGlmIChmcmFnLnNuIDwgbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWcuc24gKyAxIC0gbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgU04ganVzdCBsb2FkZWQsIGxvYWQgbmV4dCBvbmU6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gaGF2ZSB3ZSByZWFjaGVkIGVuZCBvZiBWT0QgcGxheWxpc3QgP1xuICAgICAgICAgICAgICAgICAgaWYgKCFsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9FT1MpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRU5ERUQ7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBmcmFnID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZykge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBsb2FkaW5nIGZyYWcgJyArIGkgKycscG9zL2J1ZkVuZDonICsgcG9zLnRvRml4ZWQoMykgKyAnLycgKyBidWZmZXJFbmQudG9GaXhlZCgzKSk7XG4gICAgICAgICAgICBpZiAoKGZyYWcuZGVjcnlwdGRhdGEudXJpICE9IG51bGwpICYmIChmcmFnLmRlY3J5cHRkYXRhLmtleSA9PSBudWxsKSkge1xuICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgTG9hZGluZyBrZXkgZm9yICR7ZnJhZy5zbn0gb2YgWyR7bGV2ZWxEZXRhaWxzLnN0YXJ0U059ICwke2xldmVsRGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5LRVlfTE9BRElORztcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgTG9hZGluZyAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgY3VycmVudFRpbWU6JHtwb3N9LGJ1ZmZlckVuZDoke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICBmcmFnLmF1dG9MZXZlbCA9IGhscy5hdXRvTGV2ZWxFbmFibGVkO1xuICAgICAgICAgICAgICBpZiAodGhpcy5sZXZlbHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBNYXRoLnJvdW5kKGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSAvIDgpO1xuICAgICAgICAgICAgICAgIGZyYWcudHJlcXVlc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBhcmUgbm90IHJlbG9hZGluZyB0aGUgc2FtZSBmcmFnbWVudHMgaW4gbG9vcCAuLi5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlcikge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIrKztcbiAgICAgICAgICAgICAgICBsZXQgbWF4VGhyZXNob2xkID0gY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGlzIGZyYWcgaGFzIGFscmVhZHkgYmVlbiBsb2FkZWQgMyB0aW1lcywgYW5kIGlmIGl0IGhhcyBiZWVuIHJlbG9hZGVkIHJlY2VudGx5XG4gICAgICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIgPiBtYXhUaHJlc2hvbGQgJiYgKE1hdGguYWJzKHRoaXMuZnJhZ0xvYWRJZHggLSBmcmFnLmxvYWRJZHgpIDwgbWF4VGhyZXNob2xkKSkge1xuICAgICAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyID0gMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcmFnLmxvYWRJZHggPSB0aGlzLmZyYWdMb2FkSWR4O1xuICAgICAgICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gZnJhZztcbiAgICAgICAgICAgICAgdGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURJTkcsIHtmcmFnOiBmcmFnLCBjcmVkczogdGhpcy5jcmVkc30pO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRlJBR19MT0FESU5HO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuV0FJVElOR19MRVZFTDpcbiAgICAgICAgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgaWYgKGxldmVsICYmIGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlk6XG4gICAgICAgIHZhciBub3cgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdmFyIHJldHJ5RGF0ZSA9IHRoaXMucmV0cnlEYXRlO1xuICAgICAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgICAgICB2YXIgaXNTZWVraW5nID0gbWVkaWEgJiYgbWVkaWEuc2Vla2luZztcbiAgICAgICAgLy8gaWYgY3VycmVudCB0aW1lIGlzIGd0IHRoYW4gcmV0cnlEYXRlLCBvciBpZiBtZWRpYSBzZWVraW5nIGxldCdzIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgaWYoIXJldHJ5RGF0ZSB8fCAobm93ID49IHJldHJ5RGF0ZSkgfHwgaXNTZWVraW5nKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWVkaWFDb250cm9sbGVyOiByZXRyeURhdGUgcmVhY2hlZCwgc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZWApO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5TVE9QUEVEOlxuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNFRDpcbiAgICAgIGNhc2UgU3RhdGUuRU5ERUQ6XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIGNoZWNrIGJ1ZmZlclxuICAgIHRoaXMuX2NoZWNrQnVmZmVyKCk7XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICB9XG5cblxuXG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSwgcmFuZ2UsXG4gICAgICAgIGJ1ZmZlclJhbmdlID0gdGhpcy5idWZmZXJSYW5nZTtcbiAgICBpZiAoYnVmZmVyUmFuZ2UpIHtcbiAgICAgIGZvciAoaSA9IGJ1ZmZlclJhbmdlLmxlbmd0aCAtIDE7IGkgPj0wOyBpLS0pIHtcbiAgICAgICAgcmFuZ2UgPSBidWZmZXJSYW5nZVtpXTtcbiAgICAgICAgaWYgKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGdldCBuZXh0QnVmZmVyUmFuZ2UoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICAvLyB0cnkgdG8gZ2V0IHJhbmdlIG9mIG5leHQgZnJhZ21lbnQgKDUwMG1zIGFmdGVyIHRoaXMgcmFuZ2UpXG4gICAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXJSYW5nZShyYW5nZS5lbmQgKyAwLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcy5uZXh0QnVmZmVyUmFuZ2U7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMubWVkaWEsIGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWUsIHZpZGVvID0gdGhpcy5tZWRpYTtcbiAgICBpZiAodmlkZW8gJiYgdmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgIGN1cnJlbnRUaW1lID0gdmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAvKiBpZiB2aWRlbyBlbGVtZW50IGlzIGluIHNlZWtlZCBzdGF0ZSwgY3VycmVudFRpbWUgY2FuIG9ubHkgaW5jcmVhc2UuXG4gICAgICAgIChhc3N1bWluZyB0aGF0IHBsYXliYWNrIHJhdGUgaXMgcG9zaXRpdmUgLi4uKVxuICAgICAgICBBcyBzb21ldGltZXMgY3VycmVudFRpbWUganVtcHMgYmFjayB0byB6ZXJvIGFmdGVyIGFcbiAgICAgICAgbWVkaWEgZGVjb2RlIGVycm9yLCBjaGVjayB0aGlzLCB0byBhdm9pZCBzZWVraW5nIGJhY2sgdG9cbiAgICAgICAgd3JvbmcgcG9zaXRpb24gYWZ0ZXIgYSBtZWRpYSBkZWNvZGUgZXJyb3JcbiAgICAgICovXG4gICAgICBpZihjdXJyZW50VGltZSA+IHZpZGVvLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSArIDAuMSkpIHtcbiAgICAgICAgLyogZW5zdXJlIHRoYXQgRlJBR19DSEFOR0VEIGV2ZW50IGlzIHRyaWdnZXJlZCBhdCBzdGFydHVwLFxuICAgICAgICAgIHdoZW4gZmlyc3QgdmlkZW8gZnJhbWUgaXMgZGlzcGxheWVkIGFuZCBwbGF5YmFjayBpcyBwYXVzZWQuXG4gICAgICAgICAgYWRkIGEgdG9sZXJhbmNlIG9mIDEwMG1zLCBpbiBjYXNlIGN1cnJlbnQgcG9zaXRpb24gaXMgbm90IGJ1ZmZlcmVkLFxuICAgICAgICAgIGNoZWNrIGlmIGN1cnJlbnQgcG9zKzEwMG1zIGlzIGJ1ZmZlcmVkIGFuZCB1c2UgdGhhdCBidWZmZXIgcmFuZ2VcbiAgICAgICAgICBmb3IgRlJBR19DSEFOR0VEIGV2ZW50IHJlcG9ydGluZyAqL1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lICsgMC4xKTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZUN1cnJlbnQpIHtcbiAgICAgICAgdmFyIGZyYWdQbGF5aW5nID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICAgIGlmIChmcmFnUGxheWluZyAhPT0gdGhpcy5mcmFnUGxheWluZykge1xuICAgICAgICAgIHRoaXMuZnJhZ1BsYXlpbmcgPSBmcmFnUGxheWluZztcbiAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQ0hBTkdFRCwge2ZyYWc6IGZyYWdQbGF5aW5nfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggOlxuICAgICAtIHBhdXNlIHBsYXliYWNrIGlmIHBsYXlpbmdcbiAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgIC0gYW5kIHRyaWdnZXIgYSBidWZmZXIgZmx1c2hcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKSB7XG4gICAgbG9nZ2VyLmxvZygnaW1tZWRpYXRlTGV2ZWxTd2l0Y2gnKTtcbiAgICBpZiAoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLm1lZGlhLnBhdXNlZDtcbiAgICAgIHRoaXMubWVkaWEucGF1c2UoKTtcbiAgICB9XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNISU5HLCB7c3RhcnRPZmZzZXQ6IDAsIGVuZE9mZnNldDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBVVNFRDtcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIC8qXG4gICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgICAgLSBudWRnZSB2aWRlbyBkZWNvZGVyIGJ5IHNsaWdodGx5IGFkanVzdGluZyB2aWRlbyBjdXJyZW50VGltZVxuICAgICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMubWVkaWEuY3VycmVudFRpbWUgLT0gMC4wMDAxO1xuICAgIGlmICghdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLm1lZGlhLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksIGN1cnJlbnRSYW5nZSwgbmV4dFJhbmdlO1xuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgaWYgKGN1cnJlbnRSYW5nZSAmJiBjdXJyZW50UmFuZ2Uuc3RhcnQgPiAxKSB7XG4gICAgLy8gZmx1c2ggYnVmZmVyIHByZWNlZGluZyBjdXJyZW50IGZyYWdtZW50IChmbHVzaCB1bnRpbCBjdXJyZW50IGZyYWdtZW50IHN0YXJ0IG9mZnNldClcbiAgICAvLyBtaW51cyAxcyB0byBhdm9pZCB2aWRlbyBmcmVlemluZywgdGhhdCBjb3VsZCBoYXBwZW4gaWYgd2UgZmx1c2gga2V5ZnJhbWUgb2YgY3VycmVudCB2aWRlbyAuLi5cbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNISU5HLCB7c3RhcnRPZmZzZXQ6IDAsIGVuZE9mZnNldDogY3VycmVudFJhbmdlLnN0YXJ0IC0gMX0pO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBVVNFRDtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm1lZGlhLnBhdXNlZCkge1xuICAgICAgLy8gYWRkIGEgc2FmZXR5IGRlbGF5IG9mIDFzXG4gICAgICB2YXIgbmV4dExldmVsSWQgPSB0aGlzLmhscy5uZXh0TG9hZExldmVsLG5leHRMZXZlbCA9IHRoaXMubGV2ZWxzW25leHRMZXZlbElkXSwgZnJhZ0xhc3RLYnBzID0gdGhpcy5mcmFnTGFzdEticHM7XG4gICAgICBpZiAoZnJhZ0xhc3RLYnBzICYmIHRoaXMuZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IHRoaXMuZnJhZ0N1cnJlbnQuZHVyYXRpb24gKiBuZXh0TGV2ZWwuYml0cmF0ZSAvICgxMDAwICogZnJhZ0xhc3RLYnBzKSArIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZmV0Y2hkZWxheTonK2ZldGNoZGVsYXkpO1xuICAgIC8vIGZpbmQgYnVmZmVyIHJhbmdlIHRoYXQgd2lsbCBiZSByZWFjaGVkIG9uY2UgbmV3IGZyYWdtZW50IHdpbGwgYmUgZmV0Y2hlZFxuICAgIG5leHRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSArIGZldGNoZGVsYXkpO1xuICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgICAgLy8gZmx1c2ggcG9zaXRpb24gaXMgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoaXMgbmV3IGJ1ZmZlclxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZE9mZnNldDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgICAgIC8vIGlmIHdlIGFyZSBoZXJlLCB3ZSBjYW4gYWxzbyBjYW5jZWwgYW55IGxvYWRpbmcvZGVtdXhpbmcgaW4gcHJvZ3Jlc3MsIGFzIHRoZXkgYXJlIHVzZWxlc3NcbiAgICAgICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgICAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYUF0dGFjaGVkKGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9uTWVkaWFTZWVraW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9uTWVkaWFTZWVrZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udmVuZGVkID0gdGhpcy5vbk1lZGlhRW5kZWQuYmluZCh0aGlzKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLmhscy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYgKG1lZGlhICYmIG1lZGlhLmVuZGVkKSB7XG4gICAgICBsb2dnZXIubG9nKCdNU0UgZGV0YWNoaW5nIGFuZCB2aWRlbyBlbmRlZCwgcmVzZXQgc3RhcnRQb3NpdGlvbicpO1xuICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgIH1cblxuICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWRpbmcgY291bnRlciBvbiBNU0UgZGV0YWNoaW5nIHRvIGF2b2lkIHJlcG9ydGluZyBGUkFHX0xPT1BfTE9BRElOR19FUlJPUiBhZnRlciBlcnJvciByZWNvdmVyeVxuICAgIHZhciBsZXZlbHMgPSB0aGlzLmxldmVscztcbiAgICBpZiAobGV2ZWxzKSB7XG4gICAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkIGNvdW50ZXJcbiAgICAgICAgbGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICAgIGlmKGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICAgIGxldmVsLmRldGFpbHMuZnJhZ21lbnRzLmZvckVhY2goZnJhZ21lbnQgPT4ge1xuICAgICAgICAgICAgICBmcmFnbWVudC5sb2FkQ291bnRlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJzXG4gICAgaWYgKG1lZGlhKSB7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsIHRoaXMub252c2Vla2VkKTtcbiAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCAgPSB0aGlzLm9udmVuZGVkID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgIHRoaXMuc3RvcExvYWQoKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVraW5nKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnRseSBsb2FkZWQgZnJhZ21lbnQgaXMgaW5zaWRlIGJ1ZmZlci5cbiAgICAgIC8vaWYgb3V0c2lkZSwgY2FuY2VsIGZyYWdtZW50IGxvYWRpbmcsIG90aGVyd2lzZSBkbyBub3RoaW5nXG4gICAgICBpZiAoQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odGhpcy5tZWRpYSx0aGlzLm1lZGlhLmN1cnJlbnRUaW1lLHRoaXMuY29uZmlnLm1heEJ1ZmZlckhvbGUpLmxlbiA9PT0gMCkge1xuICAgICAgICBsb2dnZXIuaW5mbygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICBpZiAoZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkVOREVEKSB7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGNoZWNrIGZvciBwb3RlbnRpYWwgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICAvLyBhdm9pZCByZXBvcnRpbmcgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIGluIGNhc2UgdXNlciBpcyBzZWVraW5nIHNldmVyYWwgdGltZXMgb24gc2FtZSBwb3NpdGlvblxuICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgZW5kZWQnKTtcbiAgICAvLyByZXNldCBzdGFydFBvc2l0aW9uIGFuZCBsYXN0Q3VycmVudFRpbWUgdG8gcmVzdGFydCBwbGF5YmFjayBAIHN0cmVhbSBiZWdpbm5pbmdcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gIH1cblxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGRhdGEpIHtcbiAgICAvLyByZXNldCBidWZmZXIgb24gbWFuaWZlc3QgbG9hZGluZ1xuICAgIGxvZ2dlci5sb2coJ3RyaWdnZXIgQlVGRkVSX1JFU0VUJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfUkVTRVQpO1xuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBbXTtcbiAgICB0aGlzLnN0YWxsZWQgPSBmYWxzZTtcblx0dGhpcy5jcmVkcyA9IGRhdGEuY3JlZHM7XG4gIH1cblxuICBvbk1hbmlmZXN0UGFyc2VkKGRhdGEpIHtcbiAgICB2YXIgYWFjID0gZmFsc2UsIGhlYWFjID0gZmFsc2UsIGNvZGVjO1xuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgLy8gZGV0ZWN0IGlmIHdlIGhhdmUgZGlmZmVyZW50IGtpbmQgb2YgYXVkaW8gY29kZWNzIHVzZWQgYW1vbmdzdCBwbGF5bGlzdHNcbiAgICAgIGNvZGVjID0gbGV2ZWwuYXVkaW9Db2RlYztcbiAgICAgIGlmIChjb2RlYykge1xuICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xKSB7XG4gICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSB7XG4gICAgICAgICAgaGVhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dpdGNoID0gKGFhYyAmJiBoZWFhYyk7XG4gICAgaWYgKHRoaXMuYXVkaW9Db2RlY1N3aXRjaCkge1xuICAgICAgbG9nZ2VyLmxvZygnYm90aCBBQUMvSEUtQUFDIGF1ZGlvIGZvdW5kIGluIGxldmVsczsgZGVjbGFyaW5nIGxldmVsIGNvZGVjIGFzIEhFLUFBQycpO1xuICAgIH1cbiAgICB0aGlzLmxldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuaGxzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZGF0YSkge1xuICAgIHZhciBuZXdEZXRhaWxzID0gZGF0YS5kZXRhaWxzLFxuICAgICAgICBuZXdMZXZlbElkID0gZGF0YS5sZXZlbCxcbiAgICAgICAgY3VyTGV2ZWwgPSB0aGlzLmxldmVsc1tuZXdMZXZlbElkXSxcbiAgICAgICAgZHVyYXRpb24gPSBuZXdEZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgIHNsaWRpbmcgPSAwO1xuXG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgJHtuZXdMZXZlbElkfSBsb2FkZWQgWyR7bmV3RGV0YWlscy5zdGFydFNOfSwke25ld0RldGFpbHMuZW5kU059XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuICAgIHRoaXMubGV2ZWxMYXN0TG9hZGVkID0gbmV3TGV2ZWxJZDtcblxuICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgIHZhciBjdXJEZXRhaWxzID0gY3VyTGV2ZWwuZGV0YWlscztcbiAgICAgIGlmIChjdXJEZXRhaWxzKSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgaGF2ZSBkZXRhaWxzIGZvciB0aGF0IGxldmVsLCBtZXJnZSB0aGVtXG4gICAgICAgIExldmVsSGVscGVyLm1lcmdlRGV0YWlscyhjdXJEZXRhaWxzLG5ld0RldGFpbHMpO1xuICAgICAgICBzbGlkaW5nID0gbmV3RGV0YWlscy5mcmFnbWVudHNbMF0uc3RhcnQ7XG4gICAgICAgIGlmIChuZXdEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOiR7c2xpZGluZy50b0ZpeGVkKDMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBvdXRkYXRlZCBQVFMsIHVua25vd24gc2xpZGluZycpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBmaXJzdCBsb2FkLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgY3VyTGV2ZWwuZGV0YWlscyA9IG5ld0RldGFpbHM7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9VUERBVEVELCB7IGRldGFpbHM6IG5ld0RldGFpbHMsIGxldmVsOiBuZXdMZXZlbElkIH0pO1xuXG4gICAgLy8gY29tcHV0ZSBzdGFydCBwb3NpdGlvblxuICAgIGlmICh0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIHNldCBzdGFydCBwb3NpdGlvbiB0byBiZSBmcmFnbWVudCBOLXRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAodXN1YWxseSAzKVxuICAgICAgaWYgKG5ld0RldGFpbHMubGl2ZSkge1xuICAgICAgICBsZXQgdGFyZ2V0TGF0ZW5jeSA9IHRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IHRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gOiB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBuZXdEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSBNYXRoLm1heCgwLCBzbGlkaW5nICsgZHVyYXRpb24gLSB0YXJnZXRMYXRlbmN5KTtcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgLy8gb25seSBzd2l0Y2ggYmF0Y2sgdG8gSURMRSBzdGF0ZSBpZiB3ZSB3ZXJlIHdhaXRpbmcgZm9yIGxldmVsIHRvIHN0YXJ0IGRvd25sb2FkaW5nIGEgbmV3IGZyYWdtZW50XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLldBSVRJTkdfTEVWRUwpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uS2V5TG9hZGVkKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5LRVlfTE9BRElORykge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoZGF0YSkge1xuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkZSQUdfTE9BRElORyAmJlxuICAgICAgICBmcmFnQ3VycmVudCAmJlxuICAgICAgICBkYXRhLmZyYWcubGV2ZWwgPT09IGZyYWdDdXJyZW50LmxldmVsICYmXG4gICAgICAgIGRhdGEuZnJhZy5zbiA9PT0gZnJhZ0N1cnJlbnQuc24pIHtcbiAgICAgIGlmICh0aGlzLmZyYWdCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSBmYWxzZTtcbiAgICAgICAgZGF0YS5zdGF0cy50cGFyc2VkID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IGRhdGEuc3RhdHMsIGZyYWc6IGZyYWdDdXJyZW50fSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFSU0lORztcbiAgICAgICAgLy8gdHJhbnNtdXggdGhlIE1QRUctVFMgZGF0YSB0byBJU08tQk1GRiBzZWdtZW50c1xuICAgICAgICB0aGlzLnN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAgICAgdmFyIGN1cnJlbnRMZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgICAgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLFxuICAgICAgICAgICAgZHVyYXRpb24gPSBkZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgICAgICBzdGFydCA9IGZyYWdDdXJyZW50LnN0YXJ0LFxuICAgICAgICAgICAgbGV2ZWwgPSBmcmFnQ3VycmVudC5sZXZlbCxcbiAgICAgICAgICAgIHNuID0gZnJhZ0N1cnJlbnQuc24sXG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gY3VycmVudExldmVsLmF1ZGlvQ29kZWMgfHwgdGhpcy5jb25maWcuZGVmYXVsdEF1ZGlvQ29kZWM7XG4gICAgICAgIGlmKHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdzd2FwcGluZyBwbGF5bGlzdCBhdWRpbyBjb2RlYycpO1xuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMubGFzdEF1ZGlvQ29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgICAgIGlmKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHtcbiAgICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmcgPSAwO1xuICAgICAgICAvLyBsb2dnZXIubG9nKGBEZW11eGluZyAke3NufSBvZiBbJHtkZXRhaWxzLnN0YXJ0U059ICwke2RldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuLy8gXHRcdHZhciByZSA9IC8oXFxkKylfXFxkKy50cy87XG4vLyBcdFx0dmFyIHQwID0gMDtcbi8vIFx0XHR2YXIgbSA9IHJlLmV4ZWMoZnJhZ0N1cnJlbnQudXJsKTtcbi8vIFx0XHR2YXIgdDAgPSAobSAmJiBtWzFdKSA/IHBhcnNlSW50KCBtWzFdICkvMTAwMCA6IDA7XG4vL1xuICAgICAgICB0aGlzLmRlbXV4ZXIucHVzaChkYXRhLnBheWxvYWQsIGF1ZGlvQ29kZWMsIGN1cnJlbnRMZXZlbC52aWRlb0NvZGVjLCBzdGFydCwgZnJhZ0N1cnJlbnQuY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGZyYWdDdXJyZW50LmRlY3J5cHRkYXRhLCBzdGFydCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nSW5pdFNlZ21lbnQoZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB2YXIgdHJhY2tzID0gZGF0YS50cmFja3MsIHRyYWNrTmFtZSwgdHJhY2s7XG5cbiAgICAgIC8vIGluY2x1ZGUgbGV2ZWxDb2RlYyBpbiBhdWRpbyBhbmQgdmlkZW8gdHJhY2tzXG4gICAgICB0cmFjayA9IHRyYWNrcy5hdWRpbztcbiAgICAgIGlmKHRyYWNrKSB7XG4gICAgICAgIHZhciBhdWRpb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYyxcbiAgICAgICAgICAgIHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZihhdWRpb0NvZGVjICYmIHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdzd2FwcGluZyBwbGF5bGlzdCBhdWRpbyBjb2RlYycpO1xuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBpbiBjYXNlIEFBQyBhbmQgSEUtQUFDIGF1ZGlvIGNvZGVjcyBhcmUgc2lnbmFsbGVkIGluIG1hbmlmZXN0XG4gICAgICAgIC8vIGZvcmNlIEhFLUFBQyAsIGFzIGl0IHNlZW1zIHRoYXQgbW9zdCBicm93c2VycyBwcmVmZXJzIHRoYXQgd2F5LFxuICAgICAgICAvLyBleGNlcHQgZm9yIG1vbm8gc3RyZWFtcyBPUiBvbiBGRlxuICAgICAgICAvLyB0aGVzZSBjb25kaXRpb25zIG1pZ2h0IG5lZWQgdG8gYmUgcmV2aWV3ZWQgLi4uXG4gICAgICAgIGlmICh0aGlzLmF1ZGlvQ29kZWNTd2l0Y2gpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGZvcmNlIEhFLUFBQyBpZiBtb25vIHN0cmVhbVxuICAgICAgICAgICBpZih0cmFjay5tZXRhZGF0YS5jaGFubmVsQ291bnQgIT09IDEgJiZcbiAgICAgICAgICAgIC8vIGRvbid0IGZvcmNlIEhFLUFBQyBpZiBmaXJlZm94XG4gICAgICAgICAgICB1YS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSEUtQUFDIGlzIGJyb2tlbiBvbiBBbmRyb2lkLCBhbHdheXMgc2lnbmFsIGF1ZGlvIGNvZGVjIGFzIEFBQyBldmVuIGlmIHZhcmlhbnQgbWFuaWZlc3Qgc3RhdGVzIG90aGVyd2lzZVxuICAgICAgICBpZih1YS5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICAgIGxvZ2dlci5sb2coYEFuZHJvaWQ6IGZvcmNlIGF1ZGlvIGNvZGVjIHRvYCArIGF1ZGlvQ29kZWMpO1xuICAgICAgICB9XG4gICAgICAgIHRyYWNrLmxldmVsQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgICAgfVxuICAgICAgdHJhY2sgPSB0cmFja3MudmlkZW87XG4gICAgICBpZih0cmFjaykge1xuICAgICAgICB0cmFjay5sZXZlbENvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYztcbiAgICAgIH1cblxuICAgICAgLy8gaWYgcmVtdXhlciBzcGVjaWZ5IHRoYXQgYSB1bmlxdWUgdHJhY2sgbmVlZHMgdG8gZ2VuZXJhdGVkLFxuICAgICAgLy8gbGV0J3MgbWVyZ2UgYWxsIHRyYWNrcyB0b2dldGhlclxuICAgICAgaWYgKGRhdGEudW5pcXVlKSB7XG4gICAgICAgIHZhciBtZXJnZWRUcmFjayA9IHtcbiAgICAgICAgICAgIGNvZGVjIDogJycsXG4gICAgICAgICAgICBsZXZlbENvZGVjIDogJydcbiAgICAgICAgICB9O1xuICAgICAgICBmb3IgKHRyYWNrTmFtZSBpbiBkYXRhLnRyYWNrcykge1xuICAgICAgICAgIHRyYWNrID0gdHJhY2tzW3RyYWNrTmFtZV07XG4gICAgICAgICAgbWVyZ2VkVHJhY2suY29udGFpbmVyID0gdHJhY2suY29udGFpbmVyO1xuICAgICAgICAgIGlmIChtZXJnZWRUcmFjay5jb2RlYykge1xuICAgICAgICAgICAgbWVyZ2VkVHJhY2suY29kZWMgKz0gICcsJztcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmxldmVsQ29kZWMgKz0gICcsJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYodHJhY2suY29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmNvZGVjICs9ICB0cmFjay5jb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHRyYWNrLmxldmVsQ29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmxldmVsQ29kZWMgKz0gIHRyYWNrLmxldmVsQ29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRyYWNrcyA9IHsgYXVkaW92aWRlbyA6IG1lcmdlZFRyYWNrIH07XG4gICAgICB9XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9DT0RFQ1MsdHJhY2tzKTtcbiAgICAgIC8vIGxvb3AgdGhyb3VnaCB0cmFja3MgdGhhdCBhcmUgZ29pbmcgdG8gYmUgcHJvdmlkZWQgdG8gYnVmZmVyQ29udHJvbGxlclxuICAgICAgZm9yICh0cmFja05hbWUgaW4gdHJhY2tzKSB7XG4gICAgICAgIHRyYWNrID0gdHJhY2tzW3RyYWNrTmFtZV07XG4gICAgICAgIGxvZ2dlci5sb2coYHRyYWNrOiR7dHJhY2tOYW1lfSxjb250YWluZXI6JHt0cmFjay5jb250YWluZXJ9LGNvZGVjc1tsZXZlbC9wYXJzZWRdPVske3RyYWNrLmxldmVsQ29kZWN9LyR7dHJhY2suY29kZWN9XWApO1xuICAgICAgICB2YXIgaW5pdFNlZ21lbnQgPSB0cmFjay5pbml0U2VnbWVudDtcbiAgICAgICAgaWYgKGluaXRTZWdtZW50KSB7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nKys7XG4gICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ESU5HLCB7dHlwZTogdHJhY2tOYW1lLCBkYXRhOiBpbml0U2VnbWVudH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdEYXRhKGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy50cGFyc2UyID0gRGF0ZS5ub3coKTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuXG4gICAgICBsb2dnZXIuaW5mbyhgcGFyc2VkICR7ZGF0YS50eXBlfSxQVFM6WyR7ZGF0YS5zdGFydFBUUy50b0ZpeGVkKDMpfSwke2RhdGEuZW5kUFRTLnRvRml4ZWQoMyl9XSxEVFM6WyR7ZGF0YS5zdGFydERUUy50b0ZpeGVkKDMpfS8ke2RhdGEuZW5kRFRTLnRvRml4ZWQoMyl9XSxuYjoke2RhdGEubmJ9YCk7XG5cbiAgICAgIHZhciBkcmlmdCA9IExldmVsSGVscGVyLnVwZGF0ZUZyYWdQVFMobGV2ZWwuZGV0YWlscyxmcmFnLnNuLGRhdGEuc3RhcnRQVFMsZGF0YS5lbmRQVFMpLFxuICAgICAgICAgIGhscyA9IHRoaXMuaGxzO1xuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfUFRTX1VQREFURUQsIHtkZXRhaWxzOiBsZXZlbC5kZXRhaWxzLCBsZXZlbDogdGhpcy5sZXZlbCwgZHJpZnQ6IGRyaWZ0fSk7XG5cbiAgICAgIFtkYXRhLmRhdGExLCBkYXRhLmRhdGEyXS5mb3JFYWNoKGJ1ZmZlciA9PiB7XG4gICAgICAgIGlmIChidWZmZXIpIHtcbiAgICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmcrKztcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ESU5HLCB7dHlwZTogZGF0YS50eXBlLCBkYXRhOiBidWZmZXJ9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IGRhdGEuZW5kUFRTO1xuICAgICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0OiBkYXRhLnN0YXJ0UFRTLCBlbmQ6IGRhdGEuZW5kUFRTLCBmcmFnOiBmcmFnfSk7XG5cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKGBub3QgaW4gUEFSU0lORyBzdGF0ZSBidXQgJHt0aGlzLnN0YXRlfSwgaWdub3JpbmcgRlJBR19QQVJTSU5HX0RBVEEgZXZlbnRgKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNFRDtcbiAgICAgIHRoaXMuX2NoZWNrQXBwZW5kZWRQYXJzZWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkJ1ZmZlckFwcGVuZGVkKCkge1xuICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5QQVJTSU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTRUQ6XG4gICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZy0tO1xuICAgICAgICB0aGlzLl9jaGVja0FwcGVuZGVkUGFyc2VkKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgX2NoZWNrQXBwZW5kZWRQYXJzZWQoKSB7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNFRCAmJiB0aGlzLnBlbmRpbmdBcHBlbmRpbmcgPT09IDApICB7XG4gICAgICB2YXIgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQsIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICAgIGlmIChmcmFnKSB7XG4gICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gZnJhZztcbiAgICAgICAgc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuZnJhZ0xhc3RLYnBzID0gTWF0aC5yb3VuZCg4ICogc3RhdHMubGVuZ3RoIC8gKHN0YXRzLnRidWZmZXJlZCAtIHN0YXRzLnRmaXJzdCkpO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHtzdGF0czogc3RhdHMsIGZyYWc6IGZyYWd9KTtcblx0XHQvLyBjb25zb2xlLmluZm8oc3RhdHMpO1xuXHRcdC8vIGNvbnNvbGUuaW5mbyhmcmFnKTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYG1lZGlhIGJ1ZmZlcmVkIDogJHt0aGlzLnRpbWVSYW5nZXNUb1N0cmluZyh0aGlzLm1lZGlhLmJ1ZmZlcmVkKX1gKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkVycm9yKGRhdGEpIHtcbiAgICBzd2l0Y2goZGF0YS5kZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgICAgaWYoIWRhdGEuZmF0YWwpIHtcbiAgICAgICAgICB2YXIgbG9hZEVycm9yID0gdGhpcy5mcmFnTG9hZEVycm9yO1xuICAgICAgICAgIGlmKGxvYWRFcnJvcikge1xuICAgICAgICAgICAgbG9hZEVycm9yKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcj0xO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAobG9hZEVycm9yIDw9IHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnkpIHtcbiAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IGxvYWRFcnJvcjtcbiAgICAgICAgICAgIC8vIHJlc2V0IGxvYWQgY291bnRlciB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvclxuICAgICAgICAgICAgZGF0YS5mcmFnLmxvYWRDb3VudGVyID0gMDtcbiAgICAgICAgICAgIC8vIGV4cG9uZW50aWFsIGJhY2tvZmYgY2FwcGVkIHRvIDY0c1xuICAgICAgICAgICAgdmFyIGRlbGF5ID0gTWF0aC5taW4oTWF0aC5wb3coMixsb2FkRXJyb3ItMSkqdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LDY0MDAwKTtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6IGZyYWcgbG9hZGluZyBmYWlsZWQsIHJldHJ5IGluICR7ZGVsYXl9IG1zYCk7XG4gICAgICAgICAgICB0aGlzLnJldHJ5RGF0ZSA9IHBlcmZvcm1hbmNlLm5vdygpICsgZGVsYXk7XG4gICAgICAgICAgICAvLyByZXRyeSBsb2FkaW5nIHN0YXRlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgbWVkaWFDb250cm9sbGVyOiAke2RhdGEuZGV0YWlsc30gcmVhY2hlcyBtYXggcmV0cnksIHJlZGlzcGF0Y2ggYXMgZmF0YWwgLi4uYCk7XG4gICAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICAgIGRhdGEuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAvLyBpZiBmYXRhbCBlcnJvciwgc3RvcCBwcm9jZXNzaW5nLCBvdGhlcndpc2UgbW92ZSB0byBJRExFIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgbG9nZ2VyLndhcm4oYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHdoaWxlIGxvYWRpbmcgZnJhZyxzd2l0Y2ggdG8gJHtkYXRhLmZhdGFsID8gJ0VSUk9SJyA6ICdJRExFJ30gc3RhdGUgLi4uYCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBkYXRhLmZhdGFsID8gU3RhdGUuRVJST1IgOiBTdGF0ZS5JRExFO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkJVRkZFUl9GVUxMX0VSUk9SOlxuICAgICAgICAvLyB0cmlnZ2VyIGEgc21vb3RoIGxldmVsIHN3aXRjaCB0byBlbXB0eSBidWZmZXJzXG4gICAgICAgIC8vIGFsc28gcmVkdWNlIG1heCBidWZmZXIgbGVuZ3RoIGFzIGl0IG1pZ2h0IGJlIHRvbyBoaWdoLiB3ZSBkbyB0aGlzIHRvIGF2b2lkIGxvb3AgZmx1c2hpbmcgLi4uXG4gICAgICAgIHRoaXMuY29uZmlnLm1heE1heEJ1ZmZlckxlbmd0aC89MjtcbiAgICAgICAgbG9nZ2VyLndhcm4oYHJlZHVjZSBtYXggYnVmZmVyIGxlbmd0aCB0byAke3RoaXMuY29uZmlnLm1heE1heEJ1ZmZlckxlbmd0aH1zIGFuZCB0cmlnZ2VyIGEgbmV4dExldmVsU3dpdGNoIHRvIGZsdXNoIG9sZCBidWZmZXIgYW5kIGZpeCBRdW90YUV4Y2VlZGVkRXJyb3JgKTtcbiAgICAgICAgdGhpcy5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuX2NoZWNrQnVmZmVyKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYobWVkaWEpIHtcbiAgICAgIC8vIGNvbXBhcmUgcmVhZHlTdGF0ZVxuICAgICAgdmFyIHJlYWR5U3RhdGUgPSBtZWRpYS5yZWFkeVN0YXRlO1xuICAgICAgLy8gaWYgcmVhZHkgc3RhdGUgZGlmZmVyZW50IGZyb20gSEFWRV9OT1RISU5HIChudW1lcmljIHZhbHVlIDApLCB3ZSBhcmUgYWxsb3dlZCB0byBzZWVrXG4gICAgICBpZihyZWFkeVN0YXRlKSB7XG4gICAgICAgIHZhciB0YXJnZXRTZWVrUG9zaXRpb24sIGN1cnJlbnRUaW1lO1xuICAgICAgICAvLyBpZiBzZWVrIGFmdGVyIGJ1ZmZlcmVkIGRlZmluZWQsIGxldCdzIHNlZWsgaWYgd2l0aGluIGFjY2VwdGFibGUgcmFuZ2VcbiAgICAgICAgdmFyIHNlZWtBZnRlckJ1ZmZlcmVkID0gdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZDtcbiAgICAgICAgaWYoc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICBpZihtZWRpYS5kdXJhdGlvbiA+PSBzZWVrQWZ0ZXJCdWZmZXJlZCkge1xuICAgICAgICAgICAgdGFyZ2V0U2Vla1Bvc2l0aW9uID0gc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgICAgICB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50VGltZSA9IG1lZGlhLmN1cnJlbnRUaW1lO1xuICAgICAgICAgIHZhciBsb2FkZWRtZXRhZGF0YSA9IHRoaXMubG9hZGVkbWV0YWRhdGE7XG5cbiAgICAgICAgICAvLyBhZGp1c3QgY3VycmVudFRpbWUgdG8gc3RhcnQgcG9zaXRpb24gb24gbG9hZGVkIG1ldGFkYXRhXG4gICAgICAgICAgaWYoIWxvYWRlZG1ldGFkYXRhICYmIG1lZGlhLmJ1ZmZlcmVkLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgICAgICAgICAvLyBvbmx5IGFkanVzdCBjdXJyZW50VGltZSBpZiBub3QgZXF1YWwgdG8gMFxuICAgICAgICAgICAgaWYgKCFjdXJyZW50VGltZSAmJiBjdXJyZW50VGltZSAhPT0gdGhpcy5zdGFydFBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgIHRhcmdldFNlZWtQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRhcmdldFNlZWtQb3NpdGlvbikge1xuICAgICAgICAgIGN1cnJlbnRUaW1lID0gdGFyZ2V0U2Vla1Bvc2l0aW9uO1xuICAgICAgICAgIGxvZ2dlci5sb2coYHRhcmdldCBzZWVrIHBvc2l0aW9uOiR7dGFyZ2V0U2Vla1Bvc2l0aW9ufWApO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8obWVkaWEsY3VycmVudFRpbWUsMCksXG4gICAgICAgICAgICBleHBlY3RlZFBsYXlpbmcgPSAhKG1lZGlhLnBhdXNlZCB8fCBtZWRpYS5lbmRlZCB8fCBtZWRpYS5zZWVraW5nIHx8IHJlYWR5U3RhdGUgPCAyKSxcbiAgICAgICAgICAgIGp1bXBUaHJlc2hvbGQgPSAwLjQsIC8vIHRvbGVyYW5jZSBuZWVkZWQgYXMgc29tZSBicm93c2VycyBzdGFsbHMgcGxheWJhY2sgYmVmb3JlIHJlYWNoaW5nIGJ1ZmZlcmVkIHJhbmdlIGVuZFxuICAgICAgICAgICAgcGxheWhlYWRNb3ZpbmcgPSBjdXJyZW50VGltZSA+IG1lZGlhLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZTtcblxuICAgICAgICBpZiAodGhpcy5zdGFsbGVkICYmIHBsYXloZWFkTW92aW5nKSB7XG4gICAgICAgICAgdGhpcy5zdGFsbGVkID0gZmFsc2U7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgcGxheWJhY2sgbm90IHN0dWNrIGFueW1vcmUgQCR7Y3VycmVudFRpbWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2hlY2sgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgbGVzcyB0aGFuIDIwMG1zIGlzIGJ1ZmZlcmVkLCBhbmQgbWVkaWEgaXMgZXhwZWN0ZWQgdG8gcGxheSBidXQgcGxheWhlYWQgaXMgbm90IG1vdmluZyxcbiAgICAgICAgLy8gYW5kIHdlIGhhdmUgYSBuZXcgYnVmZmVyIHJhbmdlIGF2YWlsYWJsZSB1cGZyb250LCBsZXQncyBzZWVrIHRvIHRoYXQgb25lXG4gICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICBpZihwbGF5aGVhZE1vdmluZyB8fCAhZXhwZWN0ZWRQbGF5aW5nKSB7XG4gICAgICAgICAgICAvLyBwbGF5aGVhZCBtb3Zpbmcgb3IgbWVkaWEgbm90IHBsYXlpbmdcbiAgICAgICAgICAgIGp1bXBUaHJlc2hvbGQgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBwbGF5aGVhZCBub3QgbW92aW5nIEFORCBtZWRpYSBleHBlY3RlZCB0byBwbGF5XG4gICAgICAgICAgICBpZighdGhpcy5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYHBsYXliYWNrIHNlZW1zIHN0dWNrIEAke2N1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9TVEFMTEVEX0VSUk9SLCBmYXRhbDogZmFsc2V9KTtcbiAgICAgICAgICAgICAgdGhpcy5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgd2UgYXJlIGJlbG93IHRocmVzaG9sZCwgdHJ5IHRvIGp1bXAgaWYgbmV4dCBidWZmZXIgcmFuZ2UgaXMgY2xvc2VcbiAgICAgICAgICBpZihidWZmZXJJbmZvLmxlbiA8PSBqdW1wVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAvLyBubyBidWZmZXIgYXZhaWxhYmxlIEAgY3VycmVudFRpbWUsIGNoZWNrIGlmIG5leHQgYnVmZmVyIGlzIGNsb3NlICh3aXRoaW4gYSBjb25maWcubWF4U2Vla0hvbGUgc2Vjb25kIHJhbmdlKVxuICAgICAgICAgICAgdmFyIG5leHRCdWZmZXJTdGFydCA9IGJ1ZmZlckluZm8ubmV4dFN0YXJ0LCBkZWx0YSA9IG5leHRCdWZmZXJTdGFydC1jdXJyZW50VGltZTtcbiAgICAgICAgICAgIGlmKG5leHRCdWZmZXJTdGFydCAmJlxuICAgICAgICAgICAgICAgKGRlbHRhIDwgdGhpcy5jb25maWcubWF4U2Vla0hvbGUpICYmXG4gICAgICAgICAgICAgICAoZGVsdGEgPiAwKSAgJiZcbiAgICAgICAgICAgICAgICFtZWRpYS5zZWVraW5nKSB7XG4gICAgICAgICAgICAgIC8vIG5leHQgYnVmZmVyIGlzIGNsb3NlICEgYWRqdXN0IGN1cnJlbnRUaW1lIHRvIG5leHRCdWZmZXJTdGFydFxuICAgICAgICAgICAgICAvLyB0aGlzIHdpbGwgZW5zdXJlIGVmZmVjdGl2ZSB2aWRlbyBkZWNvZGluZ1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBhZGp1c3QgY3VycmVudFRpbWUgZnJvbSAke21lZGlhLmN1cnJlbnRUaW1lfSB0byBuZXh0IGJ1ZmZlcmVkIEAgJHtuZXh0QnVmZmVyU3RhcnR9YCk7XG4gICAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gbmV4dEJ1ZmZlclN0YXJ0O1xuICAgICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9TRUVLX09WRVJfSE9MRSwgZmF0YWw6IGZhbHNlfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0YXJnZXRTZWVrUG9zaXRpb24gJiYgbWVkaWEuY3VycmVudFRpbWUgIT09IHRhcmdldFNlZWtQb3NpdGlvbikge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYWRqdXN0IGN1cnJlbnRUaW1lIGZyb20gJHttZWRpYS5jdXJyZW50VGltZX0gdG8gJHt0YXJnZXRTZWVrUG9zaXRpb259YCk7XG4gICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IHRhcmdldFNlZWtQb3NpdGlvbjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCgpIHtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uQnVmZmVyRmx1c2hlZCgpIHtcbiAgICAvKiBhZnRlciBzdWNjZXNzZnVsIGJ1ZmZlciBmbHVzaGluZywgcmVidWlsZCBidWZmZXIgUmFuZ2UgYXJyYXlcbiAgICAgIGxvb3AgdGhyb3VnaCBleGlzdGluZyBidWZmZXIgcmFuZ2UgYW5kIGNoZWNrIGlmXG4gICAgICBjb3JyZXNwb25kaW5nIHJhbmdlIGlzIHN0aWxsIGJ1ZmZlcmVkLiBvbmx5IHB1c2ggdG8gbmV3IGFycmF5IGFscmVhZHkgYnVmZmVyZWQgcmFuZ2VcbiAgICAqL1xuICAgIHZhciBuZXdSYW5nZSA9IFtdLHJhbmdlLGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmICh0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKSAvIDIpKSB7XG4gICAgICAgIG5ld1JhbmdlLnB1c2gocmFuZ2UpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gbmV3UmFuZ2U7XG5cbiAgICAvLyBoYW5kbGUgZW5kIG9mIGltbWVkaWF0ZSBzd2l0Y2hpbmcgaWYgbmVlZGVkXG4gICAgaWYgKHRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgfVxuICAgIC8vIG1vdmUgdG8gSURMRSBvbmNlIGZsdXNoIGNvbXBsZXRlLiB0aGlzIHNob3VsZCB0cmlnZ2VyIG5ldyBmcmFnbWVudCBsb2FkaW5nXG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgLy8gcmVzZXQgcmVmZXJlbmNlIHRvIGZyYWdcbiAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gIH1cblxuICBzd2FwQXVkaW9Db2RlYygpIHtcbiAgICB0aGlzLmF1ZGlvQ29kZWNTd2FwID0gIXRoaXMuYXVkaW9Db2RlY1N3YXA7XG4gIH1cblxuICB0aW1lUmFuZ2VzVG9TdHJpbmcocikge1xuICAgIHZhciBsb2cgPSAnJywgbGVuID0gci5sZW5ndGg7XG4gICAgZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG4gICAgICBsb2cgKz0gJ1snICsgci5zdGFydChpKSArICcsJyArIHIuZW5kKGkpICsgJ10nO1xuICAgIH1cbiAgICByZXR1cm4gbG9nO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW1Db250cm9sbGVyO1xuXG4iLCIvKlxuICogVGltZWxpbmUgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IENFQTcwOEludGVycHJldGVyIGZyb20gJy4uL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXInO1xuXG5jbGFzcyBUaW1lbGluZUNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50Lk1FRElBX0RFVEFDSElORyxcbiAgICAgICAgICAgICAgICBFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsXG4gICAgICAgICAgICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BRElORyxcbiAgICAgICAgICAgICAgICBFdmVudC5GUkFHX0xPQURFRCk7XG5cbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLmNvbmZpZyA9IGhscy5jb25maWc7XG5cbiAgICBpZiAodGhpcy5jb25maWcuZW5hYmxlQ0VBNzA4Q2FwdGlvbnMpXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlciA9IG5ldyBDRUE3MDhJbnRlcnByZXRlcigpO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1lZGlhQXR0YWNoaW5nKGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLmF0dGFjaChtZWRpYSk7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuZGV0YWNoKCk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZygpXG4gIHtcbiAgICB0aGlzLmxhc3RQdHMgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoZGF0YSlcbiAge1xuICAgIHZhciBwdHMgPSBkYXRhLmZyYWcuc3RhcnQ7IC8vTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXG4gICAgLy8gaWYgdGhpcyBpcyBhIGZyYWcgZm9yIGEgcHJldmlvdXNseSBsb2FkZWQgdGltZXJhbmdlLCByZW1vdmUgYWxsIGNhcHRpb25zXG4gICAgLy8gVE9ETzogY29uc2lkZXIganVzdCByZW1vdmluZyBjYXB0aW9ucyBmb3IgdGhlIHRpbWVyYW5nZVxuICAgIGlmIChwdHMgPD0gdGhpcy5sYXN0UHRzKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuY2xlYXIoKTtcbiAgICB9XG5cbiAgICB0aGlzLmxhc3RQdHMgPSBwdHM7XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nVXNlcmRhdGEoZGF0YSkge1xuICAgIC8vIHB1c2ggYWxsIG9mIHRoZSBDRUEtNzA4IG1lc3NhZ2VzIGludG8gdGhlIGludGVycHJldGVyXG4gICAgLy8gaW1tZWRpYXRlbHkuIEl0IHdpbGwgY3JlYXRlIHRoZSBwcm9wZXIgdGltZXN0YW1wcyBiYXNlZCBvbiBvdXIgUFRTIHZhbHVlXG4gICAgZm9yICh2YXIgaT0wOyBpPGRhdGEuc2FtcGxlcy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLnB1c2goZGF0YS5zYW1wbGVzW2ldLnB0cywgZGF0YS5zYW1wbGVzW2ldLmJ5dGVzKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGltZWxpbmVDb250cm9sbGVyO1xuIiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cbmNsYXNzIEFFUyB7XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlIG91dCBhbiBBRVMga2V5IGZvciBib3RoIGVuY3J5cHRpb24gYW5kIGRlY3J5cHRpb24uIFRoaXNcbiAgICogaXMgYSBsb3ctbGV2ZWwgY2xhc3MuIFVzZSBhIGNpcGhlciBtb2RlIHRvIGRvIGJ1bGsgZW5jcnlwdGlvbi5cbiAgICpcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSBrZXkge0FycmF5fSBUaGUga2V5IGFzIGFuIGFycmF5IG9mIDQsIDYgb3IgOCB3b3Jkcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGtleSkge1xuICAgIC8qKlxuICAgICAqIFRoZSBleHBhbmRlZCBTLWJveCBhbmQgaW52ZXJzZSBTLWJveCB0YWJsZXMuIFRoZXNlIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBvbiB0aGUgY2xpZW50IHNvIHRoYXQgd2UgZG9uJ3QgaGF2ZSB0byBzZW5kIHRoZW0gZG93biB0aGUgd2lyZS5cbiAgICAgKlxuICAgICAqIFRoZXJlIGFyZSB0d28gdGFibGVzLCBfdGFibGVzWzBdIGlzIGZvciBlbmNyeXB0aW9uIGFuZFxuICAgICAqIF90YWJsZXNbMV0gaXMgZm9yIGRlY3J5cHRpb24uXG4gICAgICpcbiAgICAgKiBUaGUgZmlyc3QgNCBzdWItdGFibGVzIGFyZSB0aGUgZXhwYW5kZWQgUy1ib3ggd2l0aCBNaXhDb2x1bW5zLiBUaGVcbiAgICAgKiBsYXN0IChfdGFibGVzWzAxXVs0XSkgaXMgdGhlIFMtYm94IGl0c2VsZi5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5fdGFibGVzID0gW1tbXSxbXSxbXSxbXSxbXV0sW1tdLFtdLFtdLFtdLFtdXV07XG5cbiAgICB0aGlzLl9wcmVjb21wdXRlKCk7XG5cbiAgICB2YXIgaSwgaiwgdG1wLFxuICAgIGVuY0tleSwgZGVjS2V5LFxuICAgIHNib3ggPSB0aGlzLl90YWJsZXNbMF1bNF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIGtleUxlbiA9IGtleS5sZW5ndGgsIHJjb24gPSAxO1xuXG4gICAgaWYgKGtleUxlbiAhPT0gNCAmJiBrZXlMZW4gIT09IDYgJiYga2V5TGVuICE9PSA4KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYWVzIGtleSBzaXplPScgKyBrZXlMZW4pO1xuICAgIH1cblxuICAgIGVuY0tleSA9IGtleS5zbGljZSgwKTtcbiAgICBkZWNLZXkgPSBbXTtcbiAgICB0aGlzLl9rZXkgPSBbZW5jS2V5LCBkZWNLZXldO1xuXG4gICAgLy8gc2NoZWR1bGUgZW5jcnlwdGlvbiBrZXlzXG4gICAgZm9yIChpID0ga2V5TGVuOyBpIDwgNCAqIGtleUxlbiArIDI4OyBpKyspIHtcbiAgICAgIHRtcCA9IGVuY0tleVtpLTFdO1xuXG4gICAgICAvLyBhcHBseSBzYm94XG4gICAgICBpZiAoaSVrZXlMZW4gPT09IDAgfHwgKGtleUxlbiA9PT0gOCAmJiBpJWtleUxlbiA9PT0gNCkpIHtcbiAgICAgICAgdG1wID0gc2JveFt0bXA+Pj4yNF08PDI0IF4gc2JveFt0bXA+PjE2JjI1NV08PDE2IF4gc2JveFt0bXA+PjgmMjU1XTw8OCBeIHNib3hbdG1wJjI1NV07XG5cbiAgICAgICAgLy8gc2hpZnQgcm93cyBhbmQgYWRkIHJjb25cbiAgICAgICAgaWYgKGkla2V5TGVuID09PSAwKSB7XG4gICAgICAgICAgdG1wID0gdG1wPDw4IF4gdG1wPj4+MjQgXiByY29uPDwyNDtcbiAgICAgICAgICByY29uID0gcmNvbjw8MSBeIChyY29uPj43KSoyODM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZW5jS2V5W2ldID0gZW5jS2V5W2kta2V5TGVuXSBeIHRtcDtcbiAgICB9XG5cbiAgICAvLyBzY2hlZHVsZSBkZWNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGogPSAwOyBpOyBqKyssIGktLSkge1xuICAgICAgdG1wID0gZW5jS2V5W2omMyA/IGkgOiBpIC0gNF07XG4gICAgICBpZiAoaTw9NCB8fCBqPDQpIHtcbiAgICAgICAgZGVjS2V5W2pdID0gdG1wO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVjS2V5W2pdID0gZGVjVGFibGVbMF1bc2JveFt0bXA+Pj4yNCAgICAgIF1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsxXVtzYm94W3RtcD4+MTYgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzJdW3Nib3hbdG1wPj44ICAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbM11bc2JveFt0bXAgICAgICAmIDI1NV1dO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHBhbmQgdGhlIFMtYm94IHRhYmxlcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcmVjb21wdXRlKCkge1xuICAgIHZhciBlbmNUYWJsZSA9IHRoaXMuX3RhYmxlc1swXSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAgc2JveCA9IGVuY1RhYmxlWzRdLCBzYm94SW52ID0gZGVjVGFibGVbNF0sXG4gICAgaSwgeCwgeEludiwgZD1bXSwgdGg9W10sIHgyLCB4NCwgeDgsIHMsIHRFbmMsIHREZWM7XG5cbiAgICAvLyBDb21wdXRlIGRvdWJsZSBhbmQgdGhpcmQgdGFibGVzXG4gICAgZm9yIChpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gICAgICB0aFsoIGRbaV0gPSBpPDwxIF4gKGk+PjcpKjI4MyApXmldPWk7XG4gICAgfVxuXG4gICAgZm9yICh4ID0geEludiA9IDA7ICFzYm94W3hdOyB4IF49IHgyIHx8IDEsIHhJbnYgPSB0aFt4SW52XSB8fCAxKSB7XG4gICAgICAvLyBDb21wdXRlIHNib3hcbiAgICAgIHMgPSB4SW52IF4geEludjw8MSBeIHhJbnY8PDIgXiB4SW52PDwzIF4geEludjw8NDtcbiAgICAgIHMgPSBzPj44IF4gcyYyNTUgXiA5OTtcbiAgICAgIHNib3hbeF0gPSBzO1xuICAgICAgc2JveEludltzXSA9IHg7XG5cbiAgICAgIC8vIENvbXB1dGUgTWl4Q29sdW1uc1xuICAgICAgeDggPSBkW3g0ID0gZFt4MiA9IGRbeF1dXTtcbiAgICAgIHREZWMgPSB4OCoweDEwMTAxMDEgXiB4NCoweDEwMDAxIF4geDIqMHgxMDEgXiB4KjB4MTAxMDEwMDtcbiAgICAgIHRFbmMgPSBkW3NdKjB4MTAxIF4gcyoweDEwMTAxMDA7XG5cbiAgICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgZW5jVGFibGVbaV1beF0gPSB0RW5jID0gdEVuYzw8MjQgXiB0RW5jPj4+ODtcbiAgICAgICAgZGVjVGFibGVbaV1bc10gPSB0RGVjID0gdERlYzw8MjQgXiB0RGVjPj4+ODtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb21wYWN0aWZ5LiBDb25zaWRlcmFibGUgc3BlZWR1cCBvbiBGaXJlZm94LlxuICAgIGZvciAoaSA9IDA7IGkgPCA1OyBpKyspIHtcbiAgICAgIGVuY1RhYmxlW2ldID0gZW5jVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgICBkZWNUYWJsZVtpXSA9IGRlY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IDE2IGJ5dGVzLCBzcGVjaWZpZWQgYXMgZm91ciAzMi1iaXQgd29yZHMuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQwIHtudW1iZXJ9IHRoZSBmaXJzdCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDEge251bWJlcn0gdGhlIHNlY29uZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDIge251bWJlcn0gdGhlIHRoaXJkIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMyB7bnVtYmVyfSB0aGUgZm91cnRoIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gb3V0IHtJbnQzMkFycmF5fSB0aGUgYXJyYXkgdG8gd3JpdGUgdGhlIGRlY3J5cHRlZCB3b3Jkc1xuICAgKiBpbnRvXG4gICAqIEBwYXJhbSBvZmZzZXQge251bWJlcn0gdGhlIG9mZnNldCBpbnRvIHRoZSBvdXRwdXQgYXJyYXkgdG8gc3RhcnRcbiAgICogd3JpdGluZyByZXN1bHRzXG4gICAqIEByZXR1cm4ge0FycmF5fSBUaGUgcGxhaW50ZXh0LlxuICAgKi9cbiAgZGVjcnlwdChlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLCBvdXQsIG9mZnNldCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9rZXlbMV0sXG4gICAgLy8gc3RhdGUgdmFyaWFibGVzIGEsYixjLGQgYXJlIGxvYWRlZCB3aXRoIHByZS13aGl0ZW5lZCBkYXRhXG4gICAgYSA9IGVuY3J5cHRlZDAgXiBrZXlbMF0sXG4gICAgYiA9IGVuY3J5cHRlZDMgXiBrZXlbMV0sXG4gICAgYyA9IGVuY3J5cHRlZDIgXiBrZXlbMl0sXG4gICAgZCA9IGVuY3J5cHRlZDEgXiBrZXlbM10sXG4gICAgYTIsIGIyLCBjMixcblxuICAgIG5Jbm5lclJvdW5kcyA9IGtleS5sZW5ndGggLyA0IC0gMiwgLy8ga2V5Lmxlbmd0aCA9PT0gMiA/XG4gICAgaSxcbiAgICBrSW5kZXggPSA0LFxuICAgIHRhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuXG4gICAgLy8gbG9hZCB1cCB0aGUgdGFibGVzXG4gICAgdGFibGUwICAgID0gdGFibGVbMF0sXG4gICAgdGFibGUxICAgID0gdGFibGVbMV0sXG4gICAgdGFibGUyICAgID0gdGFibGVbMl0sXG4gICAgdGFibGUzICAgID0gdGFibGVbM10sXG4gICAgc2JveCAgPSB0YWJsZVs0XTtcblxuICAgIC8vIElubmVyIHJvdW5kcy4gQ3JpYmJlZCBmcm9tIE9wZW5TU0wuXG4gICAgZm9yIChpID0gMDsgaSA8IG5Jbm5lclJvdW5kczsgaSsrKSB7XG4gICAgICBhMiA9IHRhYmxlMFthPj4+MjRdIF4gdGFibGUxW2I+PjE2ICYgMjU1XSBeIHRhYmxlMltjPj44ICYgMjU1XSBeIHRhYmxlM1tkICYgMjU1XSBeIGtleVtrSW5kZXhdO1xuICAgICAgYjIgPSB0YWJsZTBbYj4+PjI0XSBeIHRhYmxlMVtjPj4xNiAmIDI1NV0gXiB0YWJsZTJbZD4+OCAmIDI1NV0gXiB0YWJsZTNbYSAmIDI1NV0gXiBrZXlba0luZGV4ICsgMV07XG4gICAgICBjMiA9IHRhYmxlMFtjPj4+MjRdIF4gdGFibGUxW2Q+PjE2ICYgMjU1XSBeIHRhYmxlMlthPj44ICYgMjU1XSBeIHRhYmxlM1tiICYgMjU1XSBeIGtleVtrSW5kZXggKyAyXTtcbiAgICAgIGQgID0gdGFibGUwW2Q+Pj4yNF0gXiB0YWJsZTFbYT4+MTYgJiAyNTVdIF4gdGFibGUyW2I+PjggJiAyNTVdIF4gdGFibGUzW2MgJiAyNTVdIF4ga2V5W2tJbmRleCArIDNdO1xuICAgICAga0luZGV4ICs9IDQ7XG4gICAgICBhPWEyOyBiPWIyOyBjPWMyO1xuICAgIH1cblxuICAgIC8vIExhc3Qgcm91bmQuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgb3V0WygzICYgLWkpICsgb2Zmc2V0XSA9XG4gICAgICAgIHNib3hbYT4+PjI0ICAgICAgXTw8MjQgXlxuICAgICAgICBzYm94W2I+PjE2ICAmIDI1NV08PDE2IF5cbiAgICAgICAgc2JveFtjPj44ICAgJiAyNTVdPDw4ICBeXG4gICAgICAgIHNib3hbZCAgICAgICYgMjU1XSAgICAgXlxuICAgICAgICBrZXlba0luZGV4KytdO1xuICAgICAgYTI9YTsgYT1iOyBiPWM7IGM9ZDsgZD1hMjtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTO1xuIiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cblxuaW1wb3J0IEFFUyBmcm9tICcuL2Flcyc7XG5cbmNsYXNzIEFFUzEyOERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3Ioa2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgdGhpcy5pdiA9IGluaXRWZWN0b3I7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBuZXR3b3JrLW9yZGVyIChiaWctZW5kaWFuKSBieXRlcyBpbnRvIHRoZWlyIGxpdHRsZS1lbmRpYW5cbiAgICogcmVwcmVzZW50YXRpb24uXG4gICAqL1xuICBudG9oKHdvcmQpIHtcbiAgICByZXR1cm4gKHdvcmQgPDwgMjQpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMCkgPDwgOCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwMDApID4+IDgpIHxcbiAgICAgICh3b3JkID4+PiAyNCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IGJ5dGVzIHVzaW5nIEFFUy0xMjggd2l0aCBDQkMgYW5kIFBLQ1MjNyBwYWRkaW5nLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkIHtVaW50OEFycmF5fSB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAqIEBwYXJhbSBrZXkge1VpbnQzMkFycmF5fSB0aGUgYnl0ZXMgb2YgdGhlIGRlY3J5cHRpb24ga2V5XG4gICAqIEBwYXJhbSBpbml0VmVjdG9yIHtVaW50MzJBcnJheX0gdGhlIGluaXRpYWxpemF0aW9uIHZlY3RvciAoSVYpIHRvXG4gICAqIHVzZSBmb3IgdGhlIGZpcnN0IHJvdW5kIG9mIENCQy5cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIGRlY3J5cHRlZCBieXRlc1xuICAgKlxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQWR2YW5jZWRfRW5jcnlwdGlvbl9TdGFuZGFyZFxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmxvY2tfY2lwaGVyX21vZGVfb2Zfb3BlcmF0aW9uI0NpcGhlcl9CbG9ja19DaGFpbmluZ18uMjhDQkMuMjlcbiAgICogQHNlZSBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjMxNVxuICAgKi9cbiAgZG9EZWNyeXB0KGVuY3J5cHRlZCwga2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdmFyXG4gICAgICAvLyB3b3JkLWxldmVsIGFjY2VzcyB0byB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0LCBlbmNyeXB0ZWQuYnl0ZUxlbmd0aCA+PiAyKSxcblxuICAgIGRlY2lwaGVyID0gbmV3IEFFUyhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChrZXkpKSxcblxuICAgIC8vIGJ5dGUgYW5kIHdvcmQtbGV2ZWwgYWNjZXNzIGZvciB0aGUgZGVjcnlwdGVkIG91dHB1dFxuICAgIGRlY3J5cHRlZCA9IG5ldyBVaW50OEFycmF5KGVuY3J5cHRlZC5ieXRlTGVuZ3RoKSxcbiAgICBkZWNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGRlY3J5cHRlZC5idWZmZXIpLFxuXG4gICAgLy8gdGVtcG9yYXJ5IHZhcmlhYmxlcyBmb3Igd29ya2luZyB3aXRoIHRoZSBJViwgZW5jcnlwdGVkLCBhbmRcbiAgICAvLyBkZWNyeXB0ZWQgZGF0YVxuICAgIGluaXQwLCBpbml0MSwgaW5pdDIsIGluaXQzLFxuICAgIGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsXG5cbiAgICAvLyBpdGVyYXRpb24gdmFyaWFibGVcbiAgICB3b3JkSXg7XG5cbiAgICAvLyBwdWxsIG91dCB0aGUgd29yZHMgb2YgdGhlIElWIHRvIGVuc3VyZSB3ZSBkb24ndCBtb2RpZnkgdGhlXG4gICAgLy8gcGFzc2VkLWluIHJlZmVyZW5jZSBhbmQgZWFzaWVyIGFjY2Vzc1xuICAgIGluaXQwID0gfn5pbml0VmVjdG9yWzBdO1xuICAgIGluaXQxID0gfn5pbml0VmVjdG9yWzFdO1xuICAgIGluaXQyID0gfn5pbml0VmVjdG9yWzJdO1xuICAgIGluaXQzID0gfn5pbml0VmVjdG9yWzNdO1xuXG4gICAgLy8gZGVjcnlwdCBmb3VyIHdvcmQgc2VxdWVuY2VzLCBhcHBseWluZyBjaXBoZXItYmxvY2sgY2hhaW5pbmcgKENCQylcbiAgICAvLyB0byBlYWNoIGRlY3J5cHRlZCBibG9ja1xuICAgIGZvciAod29yZEl4ID0gMDsgd29yZEl4IDwgZW5jcnlwdGVkMzIubGVuZ3RoOyB3b3JkSXggKz0gNCkge1xuICAgICAgLy8gY29udmVydCBiaWctZW5kaWFuIChuZXR3b3JrIG9yZGVyKSB3b3JkcyBpbnRvIGxpdHRsZS1lbmRpYW5cbiAgICAgIC8vIChqYXZhc2NyaXB0IG9yZGVyKVxuICAgICAgZW5jcnlwdGVkMCA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeF0pO1xuICAgICAgZW5jcnlwdGVkMSA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDFdKTtcbiAgICAgIGVuY3J5cHRlZDIgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAyXSk7XG4gICAgICBlbmNyeXB0ZWQzID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgM10pO1xuXG4gICAgICAvLyBkZWNyeXB0IHRoZSBibG9ja1xuICAgICAgZGVjaXBoZXIuZGVjcnlwdChlbmNyeXB0ZWQwLFxuICAgICAgICAgIGVuY3J5cHRlZDEsXG4gICAgICAgICAgZW5jcnlwdGVkMixcbiAgICAgICAgICBlbmNyeXB0ZWQzLFxuICAgICAgICAgIGRlY3J5cHRlZDMyLFxuICAgICAgICAgIHdvcmRJeCk7XG5cbiAgICAgIC8vIFhPUiB3aXRoIHRoZSBJViwgYW5kIHJlc3RvcmUgbmV0d29yayBieXRlLW9yZGVyIHRvIG9idGFpbiB0aGVcbiAgICAgIC8vIHBsYWludGV4dFxuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4XSAgICAgPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4XSBeIGluaXQwKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdIF4gaW5pdDEpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gXiBpbml0Mik7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSBeIGluaXQzKTtcblxuICAgICAgLy8gc2V0dXAgdGhlIElWIGZvciB0aGUgbmV4dCByb3VuZFxuICAgICAgaW5pdDAgPSBlbmNyeXB0ZWQwO1xuICAgICAgaW5pdDEgPSBlbmNyeXB0ZWQxO1xuICAgICAgaW5pdDIgPSBlbmNyeXB0ZWQyO1xuICAgICAgaW5pdDMgPSBlbmNyeXB0ZWQzO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cblxuICBsb2NhbERlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMuZG9EZWNyeXB0KGVuY3J5cHRlZCxcbiAgICAgICAga2V5LFxuICAgICAgICBpbml0VmVjdG9yKTtcbiAgICBkZWNyeXB0ZWQuc2V0KGJ5dGVzLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCk7XG4gIH1cblxuICBkZWNyeXB0KGVuY3J5cHRlZCkge1xuICAgIHZhclxuICAgICAgc3RlcCA9IDQgKiA4MDAwLFxuICAgIC8vZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyKSxcbiAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZCksXG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGkgPSAwO1xuXG4gICAgLy8gc3BsaXQgdXAgdGhlIGVuY3J5cHRpb24gam9iIGFuZCBkbyB0aGUgaW5kaXZpZHVhbCBjaHVua3MgYXN5bmNocm9ub3VzbHlcbiAgICB2YXIga2V5ID0gdGhpcy5rZXk7XG4gICAgdmFyIGluaXRWZWN0b3IgPSB0aGlzLml2O1xuICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuXG4gICAgZm9yIChpID0gc3RlcDsgaSA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgaSArPSBzdGVwKSB7XG4gICAgICBpbml0VmVjdG9yID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDRdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDNdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDJdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDFdKVxuICAgICAgXSk7XG4gICAgICB0aGlzLmxvY2FsRGVjcnlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUzEyOERlY3J5cHRlcjtcbiIsIi8qXG4gKiBBRVMxMjggZGVjcnlwdGlvbi5cbiAqL1xuXG5pbXBvcnQgQUVTMTI4RGVjcnlwdGVyIGZyb20gJy4vYWVzMTI4LWRlY3J5cHRlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBicm93c2VyQ3J5cHRvID0gd2luZG93ID8gd2luZG93LmNyeXB0byA6IGNyeXB0bztcbiAgICAgIHRoaXMuc3VidGxlID0gYnJvd3NlckNyeXB0by5zdWJ0bGUgfHwgYnJvd3NlckNyeXB0by53ZWJraXRTdWJ0bGU7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSAhdGhpcy5zdWJ0bGU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgZGVjcnlwdChkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmRpc2FibGVXZWJDcnlwdG8gJiYgdGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIGRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgV2ViQ3J5cHRvIEFQSScpO1xuXG4gICAgdGhpcy5zdWJ0bGUuaW1wb3J0S2V5KCdyYXcnLCBrZXksIHsgbmFtZSA6ICdBRVMtQ0JDJywgbGVuZ3RoIDogMTI4IH0sIGZhbHNlLCBbJ2RlY3J5cHQnXSkuXG4gICAgICB0aGVuKChpbXBvcnRlZEtleSkgPT4ge1xuICAgICAgICB0aGlzLnN1YnRsZS5kZWNyeXB0KHsgbmFtZSA6ICdBRVMtQ0JDJywgaXYgOiBpdi5idWZmZXIgfSwgaW1wb3J0ZWRLZXksIGRhdGEpLlxuICAgICAgICAgIHRoZW4oY2FsbGJhY2spLlxuICAgICAgICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KS5cbiAgICBjYXRjaCAoKGVycikgPT4ge1xuICAgICAgdGhpcy5vbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0pO1xuICB9XG5cbiAgZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5OCwgaXY4LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgSmF2YVNjcmlwdCBJbXBsZW1lbnRhdGlvbicpO1xuXG4gICAgdmFyIHZpZXcgPSBuZXcgRGF0YVZpZXcoa2V5OC5idWZmZXIpO1xuICAgIHZhciBrZXkgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcoaXY4LmJ1ZmZlcik7XG4gICAgdmFyIGl2ID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDQpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig4KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMTIpXG4gICAgXSk7XG5cbiAgICB2YXIgZGVjcnlwdGVyID0gbmV3IEFFUzEyOERlY3J5cHRlcihrZXksIGl2KTtcbiAgICBjYWxsYmFjayhkZWNyeXB0ZXIuZGVjcnlwdChkYXRhKS5idWZmZXIpO1xuICB9XG5cbiAgb25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzYWJsaW5nIHRvIHVzZSBXZWJDcnlwdG8gQVBJJyk7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgbG9nZ2VyLmVycm9yKGBkZWNyeXB0aW5nIGVycm9yIDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0RFQ1JZUFRfRVJST1IsIGZhdGFsIDogdHJ1ZSwgcmVhc29uIDogZXJyLm1lc3NhZ2V9KTtcbiAgICB9XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEZWNyeXB0ZXI7XG4iLCIvKipcbiAqIEFBQyBkZW11eGVyXG4gKi9cbmltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBJRDMgZnJvbSAnLi4vZGVtdXgvaWQzJztcblxuIGNsYXNzIEFBQ0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLnJlbXV4ZXIgPSBuZXcgdGhpcy5yZW11eGVyQ2xhc3Mob2JzZXJ2ZXIpO1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge2NvbnRhaW5lciA6ICdhdWRpby9hZHRzJywgdHlwZTogJ2F1ZGlvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9iZShkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgZGF0YSBjb250YWlucyBJRDMgdGltZXN0YW1wIGFuZCBBRFRTIHN5bmMgd29yY1xuICAgIHZhciBpZDMgPSBuZXcgSUQzKGRhdGEpLCBvZmZzZXQsbGVuO1xuICAgIGlmKGlkMy5oYXNUaW1lU3RhbXApIHtcbiAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICBmb3IgKG9mZnNldCA9IGlkMy5sZW5ndGgsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgICBpZiAoKGRhdGFbb2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbb2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FEVFMgc3luYyB3b3JkIGZvdW5kICEnKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBpZDMgPSBuZXcgSUQzKGRhdGEpLFxuICAgICAgICBwdHMgPSA5MCppZDMudGltZVN0YW1wLFxuICAgICAgICBjb25maWcsIGZyYW1lTGVuZ3RoLCBmcmFtZUR1cmF0aW9uLCBmcmFtZUluZGV4LCBvZmZzZXQsIGhlYWRlckxlbmd0aCwgc3RhbXAsIGxlbiwgYWFjU2FtcGxlO1xuICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgZm9yIChvZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgb2Zmc2V0IDwgbGVuIC0gMTsgb2Zmc2V0KyspIHtcbiAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIGZyYW1lSW5kZXggPSAwO1xuICAgIGZyYW1lRHVyYXRpb24gPSAxMDI0ICogOTAwMDAgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgd2hpbGUgKChvZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gVGhlIHByb3RlY3Rpb24gc2tpcCBiaXQgdGVsbHMgdXMgaWYgd2UgaGF2ZSAyIGJ5dGVzIG9mIENSQyBkYXRhIGF0IHRoZSBlbmQgb2YgdGhlIEFEVFMgaGVhZGVyXG4gICAgICBoZWFkZXJMZW5ndGggPSAoISEoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgZnJhbWVMZW5ndGggPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSkgfFxuICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0ICsgNF0gPDwgMykgfFxuICAgICAgICAgICAgICAgICAgICAoKGRhdGFbb2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBmcmFtZUxlbmd0aCAgLT0gaGVhZGVyTGVuZ3RoO1xuICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG5cbiAgICAgIGlmICgoZnJhbWVMZW5ndGggPiAwKSAmJiAoKG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSA8PSBsZW4pKSB7XG4gICAgICAgIHN0YW1wID0gcHRzICsgZnJhbWVJbmRleCAqIGZyYW1lRHVyYXRpb247XG4gICAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3RvdGFsL3B0czoke29mZnNldCtoZWFkZXJMZW5ndGh9LyR7ZnJhbWVMZW5ndGh9LyR7ZGF0YS5ieXRlTGVuZ3RofS8keyhzdGFtcC85MCkudG9GaXhlZCgwKX1gKTtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoLCBvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCksIHB0czogc3RhbXAsIGR0czogc3RhbXB9O1xuICAgICAgICB0cmFjay5zYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGZyYW1lTGVuZ3RoO1xuICAgICAgICBvZmZzZXQgKz0gZnJhbWVMZW5ndGggKyBoZWFkZXJMZW5ndGg7XG4gICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBvZmZzZXQgPCAobGVuIC0gMSk7IG9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVtvZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLHtzYW1wbGVzIDogW119LCB7c2FtcGxlcyA6IFsgeyBwdHM6IHB0cywgZHRzIDogcHRzLCB1bml0IDogaWQzLnBheWxvYWR9IF19LCB7IHNhbXBsZXM6IFtdIH0sIHRpbWVPZmZzZXQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEFBQ0RlbXV4ZXI7XG4iLCIvKipcbiAqICBBRFRTIHBhcnNlciBoZWxwZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIEFEVFMge1xuXG4gIHN0YXRpYyBnZXRBdWRpb0NvbmZpZyhvYnNlcnZlciwgZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwLFxuICAgICAgICAgICAgMTEwMjUsIDgwMDAsXG4gICAgICAgICAgICA3MzUwXTtcbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhW29mZnNldCArIDJdICYgMHgzQykgPj4+IDIpO1xuICAgIGlmKGFkdHNTYW1wbGVpbmdJbmRleCA+IGFkdHNTYW1wbGVpbmdSYXRlcy5sZW5ndGgtMSkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCByZWFzb246IGBpbnZhbGlkIEFEVFMgc2FtcGxpbmcgaW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9YH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhW29mZnNldCArIDJdICYgMHgwMSkgPDwgMik7XG4gICAgLy8gYnl0ZSAzXG4gICAgYWR0c0NoYW5lbENvbmZpZyB8PSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweEMwKSA+Pj4gNik7XG4gICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgY29kZWM6JHthdWRpb0NvZGVjfSxBRFRTIGRhdGE6dHlwZToke2FkdHNPYmplY3RUeXBlfSxzYW1wbGVpbmdJbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1bJHthZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XX1Iel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG4gICAgLy8gZmlyZWZveDogZnJlcSBsZXNzIHRoYW4gMjRrSHogPSBBQUMgU0JSIChIRS1BQUMpXG4gICAgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICAgIC8vIEFuZHJvaWQgOiBhbHdheXMgdXNlIEFBQ1xuICAgIH0gZWxzZSBpZiAodXNlckFnZW50LmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogIGZvciBvdGhlciBicm93c2VycyAoY2hyb21lIC4uLilcbiAgICAgICAgICBhbHdheXMgZm9yY2UgYXVkaW8gdHlwZSB0byBiZSBIRS1BQUMgU0JSLCBhcyBzb21lIGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaCBwcm9wZXJseSAobGlrZSBDaHJvbWUgLi4uKVxuICAgICAgKi9cbiAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMgb3IgSEUtQUFDdjIpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYgKChhdWRpb0NvZGVjICYmICgoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjI5JykgIT09IC0xKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpKSkgfHxcbiAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpKSB7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEFBQykgQU5EIChmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6IEFORCBuYiBjaGFubmVsIGlzIDEpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIGFuZCBtb25vIGF1ZGlvKVxuICAgICAgICAvLyBDaHJvbWUgZmFpbHMgdG8gcGxheSBiYWNrIHdpdGggbG93IGZyZXF1ZW5jeSBBQUMgTEMgbW9ubyB3aGVuIGluaXRpYWxpemVkIHdpdGggSEUtQUFDLiAgVGhpcyBpcyBub3QgYSBwcm9ibGVtIHdpdGggc3RlcmVvLlxuICAgICAgICBpZiAoYXVkaW9Db2RlYyAmJiBhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSAmJiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYgJiYgYWR0c0NoYW5lbENvbmZpZyA9PT0gMSkgfHxcbiAgICAgICAgICAgICghYXVkaW9Db2RlYyAmJiBhZHRzQ2hhbmVsQ29uZmlnID09PSAxKSkge1xuICAgICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIH1cbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICAgIElTTyAxNDQ5Ni0zIChBQUMpLnBkZiAtIFRhYmxlIDEuMTMg4oCUIFN5bnRheCBvZiBBdWRpb1NwZWNpZmljQ29uZmlnKClcbiAgICAgIEF1ZGlvIFByb2ZpbGUgLyBBdWRpbyBPYmplY3QgVHlwZVxuICAgICAgMDogTnVsbFxuICAgICAgMTogQUFDIE1haW5cbiAgICAgIDI6IEFBQyBMQyAoTG93IENvbXBsZXhpdHkpXG4gICAgICAzOiBBQUMgU1NSIChTY2FsYWJsZSBTYW1wbGUgUmF0ZSlcbiAgICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgICAgNTogU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKVxuICAgICAgNjogQUFDIFNjYWxhYmxlXG4gICAgIHNhbXBsaW5nIGZyZXFcbiAgICAgIDA6IDk2MDAwIEh6XG4gICAgICAxOiA4ODIwMCBIelxuICAgICAgMjogNjQwMDAgSHpcbiAgICAgIDM6IDQ4MDAwIEh6XG4gICAgICA0OiA0NDEwMCBIelxuICAgICAgNTogMzIwMDAgSHpcbiAgICAgIDY6IDI0MDAwIEh6XG4gICAgICA3OiAyMjA1MCBIelxuICAgICAgODogMTYwMDAgSHpcbiAgICAgIDk6IDEyMDAwIEh6XG4gICAgICAxMDogMTEwMjUgSHpcbiAgICAgIDExOiA4MDAwIEh6XG4gICAgICAxMjogNzM1MCBIelxuICAgICAgMTM6IFJlc2VydmVkXG4gICAgICAxNDogUmVzZXJ2ZWRcbiAgICAgIDE1OiBmcmVxdWVuY3kgaXMgd3JpdHRlbiBleHBsaWN0bHlcbiAgICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAgIDA6IERlZmluZWQgaW4gQU9UIFNwZWNpZmMgQ29uZmlnXG4gICAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgICAqL1xuICAgIC8vIGF1ZGlvT2JqZWN0VHlwZSA9IHByb2ZpbGUgPT4gcHJvZmlsZSwgdGhlIE1QRUctNCBBdWRpbyBPYmplY3QgVHlwZSBtaW51cyAxXG4gICAgY29uZmlnWzBdID0gYWR0c09iamVjdFR5cGUgPDwgMztcbiAgICAvLyBzYW1wbGluZ0ZyZXF1ZW5jeUluZGV4XG4gICAgY29uZmlnWzBdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgIGNvbmZpZ1sxXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAvLyBjaGFubmVsQ29uZmlndXJhdGlvblxuICAgIGNvbmZpZ1sxXSB8PSBhZHRzQ2hhbmVsQ29uZmlnIDw8IDM7XG4gICAgaWYgKGFkdHNPYmplY3RUeXBlID09PSA1KSB7XG4gICAgICAvLyBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXhcbiAgICAgIGNvbmZpZ1sxXSB8PSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICAgIGNvbmZpZ1syXSA9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgICAgLy8gYWR0c09iamVjdFR5cGUgKGZvcmNlIHRvIDIsIGNocm9tZSBpcyBjaGVja2luZyB0aGF0IG9iamVjdCB0eXBlIGlzIGxlc3MgdGhhbiA1ID8/P1xuICAgICAgLy8gICAgaHR0cHM6Ly9jaHJvbWl1bS5nb29nbGVzb3VyY2UuY29tL2Nocm9taXVtL3NyYy5naXQvKy9tYXN0ZXIvbWVkaWEvZm9ybWF0cy9tcDQvYWFjLmNjXG4gICAgICBjb25maWdbMl0gfD0gMiA8PCAyO1xuICAgICAgY29uZmlnWzNdID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIHtjb25maWc6IGNvbmZpZywgc2FtcGxlcmF0ZTogYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF0sIGNoYW5uZWxDb3VudDogYWR0c0NoYW5lbENvbmZpZywgY29kZWM6ICgnbXA0YS40MC4nICsgYWR0c09iamVjdFR5cGUpfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRFRTO1xuIiwiLyogIGlubGluZSBkZW11eGVyLlxuICogICBwcm9iZSBmcmFnbWVudHMgYW5kIGluc3RhbnRpYXRlIGFwcHJvcHJpYXRlIGRlbXV4ZXIgZGVwZW5kaW5nIG9uIGNvbnRlbnQgdHlwZSAoVFNEZW11eGVyLCBBQUNEZW11eGVyLCAuLi4pXG4gKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBBQUNEZW11eGVyIGZyb20gJy4uL2RlbXV4L2FhY2RlbXV4ZXInO1xuaW1wb3J0IFRTRGVtdXhlciBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuaW1wb3J0IE1QNFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvbXA0LXJlbXV4ZXInO1xuaW1wb3J0IFBhc3NUaHJvdWdoUmVtdXhlciBmcm9tICcuLi9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyJztcblxuY2xhc3MgRGVtdXhlcklubGluZSB7XG5cbiAgY29uc3RydWN0b3IoaGxzLHR5cGVTdXBwb3J0ZWQpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLnR5cGVTdXBwb3J0ZWQgPSB0eXBlU3VwcG9ydGVkO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoZGVtdXhlcikge1xuICAgICAgZGVtdXhlci5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoIWRlbXV4ZXIpIHtcbiAgICAgIHZhciBobHMgPSB0aGlzLmhscztcbiAgICAgIC8vIHByb2JlIGZvciBjb250ZW50IHR5cGVcbiAgICAgIGlmIChUU0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgaWYgKHRoaXMudHlwZVN1cHBvcnRlZC5tcDJ0ID09PSB0cnVlKSB7XG4gICAgICAgICAgZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoaGxzLFBhc3NUaHJvdWdoUmVtdXhlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYoQUFDRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBkZW11eGVyID0gbmV3IEFBQ0RlbXV4ZXIoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogJ25vIGRlbXV4IG1hdGNoaW5nIHdpdGggY29udGVudCBmb3VuZCd9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eGVyID0gZGVtdXhlcjtcbiAgICB9XG4gICAgZGVtdXhlci5wdXNoKGRhdGEsYXVkaW9Db2RlYyx2aWRlb0NvZGVjLHRpbWVPZmZzZXQsY2MsbGV2ZWwsc24sZHVyYXRpb24sIHQwKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVySW5saW5lO1xuIiwiLyogZGVtdXhlciB3ZWIgd29ya2VyLlxuICogIC0gbGlzdGVuIHRvIHdvcmtlciBtZXNzYWdlLCBhbmQgdHJpZ2dlciBEZW11eGVySW5saW5lIHVwb24gcmVjZXB0aW9uIG9mIEZyYWdtZW50cy5cbiAqICAtIHByb3ZpZGVzIE1QNCBCb3hlcyBiYWNrIHRvIG1haW4gdGhyZWFkIHVzaW5nIFt0cmFuc2ZlcmFibGUgb2JqZWN0c10oaHR0cHM6Ly9kZXZlbG9wZXJzLmdvb2dsZS5jb20vd2ViL3VwZGF0ZXMvMjAxMS8xMi9UcmFuc2ZlcmFibGUtT2JqZWN0cy1MaWdodG5pbmctRmFzdCkgaW4gb3JkZXIgdG8gbWluaW1pemUgbWVzc2FnZSBwYXNzaW5nIG92ZXJoZWFkLlxuICovXG5cbiBpbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuXG52YXIgRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gIC8vIG9ic2VydmVyIHNldHVwXG4gIHZhciBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuXG4gIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gIH07XG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgIHZhciBkYXRhID0gZXYuZGF0YTtcbiAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZGF0YS5jbWQpO1xuICAgIHN3aXRjaCAoZGF0YS5jbWQpIHtcbiAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICBzZWxmLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShvYnNlcnZlciwgZGF0YS50eXBlU3VwcG9ydGVkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YSksIGRhdGEuYXVkaW9Db2RlYywgZGF0YS52aWRlb0NvZGVjLCBkYXRhLnRpbWVPZmZzZXQsIGRhdGEuY2MsIGRhdGEubGV2ZWwsIGRhdGEuc24sIGRhdGEuZHVyYXRpb24sIGRhdGEudDApO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgRGVtdXhlclxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldiwgdHJhY2tzIDogZGF0YS50cmFja3MsIHVuaXF1ZSA6IGRhdGEudW5pcXVlIH0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXYsIHR5cGU6IGRhdGEudHlwZSwgc3RhcnRQVFM6IGRhdGEuc3RhcnRQVFMsIGVuZFBUUzogZGF0YS5lbmRQVFMsIHN0YXJ0RFRTOiBkYXRhLnN0YXJ0RFRTLCBlbmREVFM6IGRhdGEuZW5kRFRTLCBkYXRhMTogZGF0YS5kYXRhMS5idWZmZXIsIGRhdGEyOiBkYXRhLmRhdGEyLmJ1ZmZlciwgbmI6IGRhdGEubmJ9O1xuICAgIC8vIHBhc3MgZGF0YTEvZGF0YTIgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsIFtvYmpEYXRhLmRhdGExLCBvYmpEYXRhLmRhdGEyXSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCBmdW5jdGlvbihldmVudCkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudH0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnQsIGRhdGE6IGRhdGF9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldmVudCwgc2FtcGxlczogZGF0YS5zYW1wbGVzfTtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xuXG59O1xuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyV29ya2VyO1xuXG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbmltcG9ydCBEZW11eGVyV29ya2VyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItd29ya2VyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IERlY3J5cHRlciBmcm9tICcuLi9jcnlwdC9kZWNyeXB0ZXInO1xuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB2YXIgdHlwZVN1cHBvcnRlZCA9IHtcbiAgICAgIG1wNCA6IE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0JyksXG4gICAgICBtcDJ0IDogaGxzLmNvbmZpZy5lbmFibGVNUDJUUGFzc1Rocm91Z2ggJiYgTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDJ0JylcbiAgICB9O1xuICAgIGlmIChobHMuY29uZmlnLmVuYWJsZVdvcmtlciAmJiAodHlwZW9mKFdvcmtlcikgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICBsb2dnZXIubG9nKCdkZW11eGluZyBpbiB3ZWJ3b3JrZXInKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgd29yayA9IHJlcXVpcmUoJ3dlYndvcmtpZnknKTtcbiAgICAgICAgICB0aGlzLncgPSB3b3JrKERlbXV4ZXJXb3JrZXIpO1xuICAgICAgICAgIHRoaXMub253bXNnID0gdGhpcy5vbldvcmtlck1lc3NhZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgICB0aGlzLncuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgICAgICB0aGlzLncucG9zdE1lc3NhZ2Uoe2NtZDogJ2luaXQnLCB0eXBlU3VwcG9ydGVkIDogdHlwZVN1cHBvcnRlZH0pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcignZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIERlbXV4ZXJXb3JrZXIsIGZhbGxiYWNrIG9uIERlbXV4ZXJJbmxpbmUnKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsdHlwZVN1cHBvcnRlZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyx0eXBlU3VwcG9ydGVkKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmRlY3J5cHRlcikge1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKSB7XG5cdGxvZ2dlci5pbmZvKCdwdXNoRGVjcnlwdGVkIHQwOiAnICsgdDApO1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnZGVtdXgnLCBkYXRhOiBkYXRhLCBhdWRpb0NvZGVjOiBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjOiB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0OiB0aW1lT2Zmc2V0LCBjYzogY2MsIGxldmVsOiBsZXZlbCwgc24gOiBzbiwgZHVyYXRpb246IGR1cmF0aW9uLCB0MDogdDB9LCBbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBkZWNyeXB0ZGF0YSwgdDApIHtcbiAgICBpZiAoKGRhdGEuYnl0ZUxlbmd0aCA+IDApICYmIChkZWNyeXB0ZGF0YSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEua2V5ICE9IG51bGwpICYmIChkZWNyeXB0ZGF0YS5tZXRob2QgPT09ICdBRVMtMTI4JykpIHtcbiAgICAgIGlmICh0aGlzLmRlY3J5cHRlciA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuZGVjcnlwdGVyID0gbmV3IERlY3J5cHRlcih0aGlzLmhscyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBsb2NhbHRoaXMgPSB0aGlzO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVjcnlwdChkYXRhLCBkZWNyeXB0ZGF0YS5rZXksIGRlY3J5cHRkYXRhLml2LCBmdW5jdGlvbihkZWNyeXB0ZWREYXRhKXtcbiAgICAgICAgbG9jYWx0aGlzLnB1c2hEZWNyeXB0ZWQoZGVjcnlwdGVkRGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKTtcbiAgICB9XG4gIH1cblxuICBvbldvcmtlck1lc3NhZ2UoZXYpIHtcbiAgICB2YXIgZGF0YSA9IGV2LmRhdGE7XG4gICAgLy9jb25zb2xlLmxvZygnb25Xb3JrZXJNZXNzYWdlOicgKyBkYXRhLmV2ZW50KTtcbiAgICBzd2l0Y2goZGF0YS5ldmVudCkge1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOlxuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai50cmFja3MgPSBkYXRhLnRyYWNrcztcbiAgICAgICAgb2JqLnVuaXF1ZSA9IGRhdGEudW5pcXVlO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIG9iaik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgZGF0YTE6IG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YTEpLFxuICAgICAgICAgIGRhdGEyOiBuZXcgVWludDhBcnJheShkYXRhLmRhdGEyKSxcbiAgICAgICAgICBzdGFydFBUUzogZGF0YS5zdGFydFBUUyxcbiAgICAgICAgICBlbmRQVFM6IGRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTOiBkYXRhLnN0YXJ0RFRTLFxuICAgICAgICAgIGVuZERUUzogZGF0YS5lbmREVFMsXG4gICAgICAgICAgdHlwZTogZGF0YS50eXBlLFxuICAgICAgICAgIG5iOiBkYXRhLm5iXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoZGF0YS5ldmVudCwgZGF0YS5kYXRhKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXI7XG5cbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLmRhdGFcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gMDsgLy8gOnVpbnRcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgbG9hZFdvcmQoKSB7XG4gICAgdmFyXG4gICAgICBwb3NpdGlvbiA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy5ieXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLmJ5dGVzQXZhaWxhYmxlKTtcbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy5kYXRhLnN1YmFycmF5KHBvc2l0aW9uLCBwb3NpdGlvbiArIGF2YWlsYWJsZUJ5dGVzKSk7XG4gICAgdGhpcy53b3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcbiAgICAvLyB0cmFjayB0aGUgYW1vdW50IG9mIHRoaXMuZGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IGF2YWlsYWJsZUJ5dGVzO1xuICB9XG5cbiAgLy8gKGNvdW50OmludCk6dm9pZFxuICBza2lwQml0cyhjb3VudCkge1xuICAgIHZhciBza2lwQnl0ZXM7IC8vIDppbnRcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvdW50IC09IHRoaXMuYml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG4gICAgICBjb3VudCAtPSAoc2tpcEJ5dGVzID4+IDMpO1xuICAgICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy5iaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmQgPj4+ICgzMiAtIGJpdHMpOyAvLyA6dWludFxuICAgIGlmIChzaXplID4gMzIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignQ2Fubm90IHJlYWQgbW9yZSB0aGFuIDMyIGJpdHMgYXQgYSB0aW1lJyk7XG4gICAgfVxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBiaXRzO1xuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ5dGVzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIH1cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTFooKSB7XG4gICAgdmFyIGxlYWRpbmdaZXJvQ291bnQ7IC8vIDp1aW50XG4gICAgZm9yIChsZWFkaW5nWmVyb0NvdW50ID0gMDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMuYml0c0F2YWlsYWJsZTsgKytsZWFkaW5nWmVyb0NvdW50KSB7XG4gICAgICBpZiAoMCAhPT0gKHRoaXMud29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmQgYW5kIHN0aWxsIGhhdmUgbm90IGZvdW5kIGEgMVxuICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudCArIHRoaXMuc2tpcExaKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgcmVhZFVFRygpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTFooKTsgLy8gOnVpbnRcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyhjbHogKyAxKSAtIDE7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZEVHKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVUVHKCk7IC8vIDppbnRcbiAgICBpZiAoMHgwMSAmIHZhbHUpIHtcbiAgICAgIC8vIHRoZSBudW1iZXIgaXMgb2RkIGlmIHRoZSBsb3cgb3JkZXIgYml0IGlzIHNldFxuICAgICAgcmV0dXJuICgxICsgdmFsdSkgPj4+IDE7IC8vIGFkZCAxIHRvIG1ha2UgaXQgZXZlbiwgYW5kIGRpdmlkZSBieSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMSAqICh2YWx1ID4+PiAxKTsgLy8gZGl2aWRlIGJ5IHR3byB0aGVuIG1ha2UgaXQgbmVnYXRpdmVcbiAgICB9XG4gIH1cblxuICAvLyBTb21lIGNvbnZlbmllbmNlIGZ1bmN0aW9uc1xuICAvLyA6Qm9vbGVhblxuICByZWFkQm9vbGVhbigpIHtcbiAgICByZXR1cm4gMSA9PT0gdGhpcy5yZWFkQml0cygxKTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVUJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVTaG9ydCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cygxNik7XG4gIH1cbiAgICAvLyAoKTppbnRcbiAgcmVhZFVJbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMzIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRUcoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU1BTKCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHNhclNjYWxlID0gMSxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdCxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAyNDQgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gNDQgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDgzICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4NiAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTE4IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyOCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgaWYgKGNocm9tYUZvcm1hdElkYyA9PT0gMykge1xuICAgICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBzZXBhcmF0ZV9jb2xvdXJfcGxhbmVfZmxhZ1xuICAgICAgfVxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVFRygpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgIC8vIHZ1aV9wYXJhbWV0ZXJzX3ByZXNlbnRfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgICAvLyBhc3BlY3RfcmF0aW9faW5mb19wcmVzZW50X2ZsYWdcbiAgICAgICAgbGV0IHNhclJhdGlvO1xuICAgICAgICBjb25zdCBhc3BlY3RSYXRpb0lkYyA9IHRoaXMucmVhZFVCeXRlKCk7XG4gICAgICAgIHN3aXRjaCAoYXNwZWN0UmF0aW9JZGMpIHtcbiAgICAgICAgICBjYXNlIDE6IHNhclJhdGlvID0gWzEsMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjogc2FyUmF0aW8gPSBbMTIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDM6IHNhclJhdGlvID0gWzEwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA0OiBzYXJSYXRpbyA9IFsxNiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNTogc2FyUmF0aW8gPSBbNDAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDY6IHNhclJhdGlvID0gWzI0LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA3OiBzYXJSYXRpbyA9IFsyMCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgODogc2FyUmF0aW8gPSBbMzIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDk6IHNhclJhdGlvID0gWzgwLDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMDogc2FyUmF0aW8gPSBbMTgsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDExOiBzYXJSYXRpbyA9IFsxNSwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTI6IHNhclJhdGlvID0gWzY0LDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMzogc2FyUmF0aW8gPSBbMTYwLDk5XTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNDogc2FyUmF0aW8gPSBbNCwzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNTogc2FyUmF0aW8gPSBbMywyXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNjogc2FyUmF0aW8gPSBbMiwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyNTU6IHtcbiAgICAgICAgICAgIHNhclJhdGlvID0gW3RoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCksIHRoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCldO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzYXJSYXRpbykge1xuICAgICAgICAgIHNhclNjYWxlID0gc2FyUmF0aW9bMF0gLyBzYXJSYXRpb1sxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IE1hdGguY2VpbCgoKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMikgKiBzYXJTY2FsZSksXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtICgoZnJhbWVNYnNPbmx5RmxhZz8gMiA6IDQpICogKGZyYW1lQ3JvcFRvcE9mZnNldCArIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCkpXG4gICAgfTtcbiAgfVxuXG4gIHJlYWRTbGljZVR5cGUoKSB7XG4gICAgLy8gc2tpcCBOQUx1IHR5cGVcbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIC8vIGRpc2NhcmQgZmlyc3RfbWJfaW5fc2xpY2VcbiAgICB0aGlzLnJlYWRVRUcoKTtcbiAgICAvLyByZXR1cm4gc2xpY2VfdHlwZVxuICAgIHJldHVybiB0aGlzLnJlYWRVRUcoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIElEMyBwYXJzZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4vL2ltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcblxuIGNsYXNzIElEMyB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IGZhbHNlO1xuICAgIHZhciBvZmZzZXQgPSAwLCBieXRlMSxieXRlMixieXRlMyxieXRlNCx0YWdTaXplLGVuZFBvcyxoZWFkZXIsbGVuO1xuICAgICAgZG8ge1xuICAgICAgICBoZWFkZXIgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsMyk7XG4gICAgICAgIG9mZnNldCs9MztcbiAgICAgICAgICAvLyBmaXJzdCBjaGVjayBmb3IgSUQzIGhlYWRlclxuICAgICAgICAgIGlmIChoZWFkZXIgPT09ICdJRDMnKSB7XG4gICAgICAgICAgICAgIC8vIHNraXAgMjQgYml0c1xuICAgICAgICAgICAgICBvZmZzZXQgKz0gMztcbiAgICAgICAgICAgICAgLy8gcmV0cmlldmUgdGFnKHMpIGxlbmd0aFxuICAgICAgICAgICAgICBieXRlMSA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTIgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUzID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlNCA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgdGFnU2l6ZSA9IChieXRlMSA8PCAyMSkgKyAoYnl0ZTIgPDwgMTQpICsgKGJ5dGUzIDw8IDcpICsgYnl0ZTQ7XG4gICAgICAgICAgICAgIGVuZFBvcyA9IG9mZnNldCArIHRhZ1NpemU7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIHRhZyBmb3VuZCwgc2l6ZS9lbmQ6ICR7dGFnU2l6ZX0vJHtlbmRQb3N9YCk7XG5cbiAgICAgICAgICAgICAgLy8gcmVhZCBJRDMgdGFnc1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM0ZyYW1lcyhkYXRhLCBvZmZzZXQsZW5kUG9zKTtcbiAgICAgICAgICAgICAgb2Zmc2V0ID0gZW5kUG9zO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaGVhZGVyID09PSAnM0RJJykge1xuICAgICAgICAgICAgICAvLyBodHRwOi8vaWQzLm9yZy9pZDN2Mi40LjAtc3RydWN0dXJlIGNoYXB0ZXIgMy40LiAgIElEM3YyIGZvb3RlclxuICAgICAgICAgICAgICBvZmZzZXQgKz0gNztcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYDNESSBmb290ZXIgZm91bmQsIGVuZDogJHtvZmZzZXR9YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2Zmc2V0IC09IDM7XG4gICAgICAgICAgICAgIGxlbiA9IG9mZnNldDtcbiAgICAgICAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyBsZW46ICR7bGVufWApO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNUaW1lU3RhbXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oJ0lEMyB0YWcgZm91bmQsIGJ1dCBubyB0aW1lc3RhbXAnKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGVuZ3RoID0gbGVuO1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BheWxvYWQgPSBkYXRhLnN1YmFycmF5KDAsbGVuKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgIH0gd2hpbGUgKHRydWUpO1xuICB9XG5cbiAgcmVhZFVURihkYXRhLHN0YXJ0LGxlbikge1xuXG4gICAgdmFyIHJlc3VsdCA9ICcnLG9mZnNldCA9IHN0YXJ0LCBlbmQgPSBzdGFydCArIGxlbjtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhW29mZnNldCsrXSk7XG4gICAgfSB3aGlsZShvZmZzZXQgPCBlbmQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBfcGFyc2VJRDNGcmFtZXMoZGF0YSxvZmZzZXQsZW5kUG9zKSB7XG4gICAgdmFyIHRhZ0lkLHRhZ0xlbix0YWdTdGFydCx0YWdGbGFncyx0aW1lc3RhbXA7XG4gICAgd2hpbGUob2Zmc2V0ICsgOCA8PSBlbmRQb3MpIHtcbiAgICAgIHRhZ0lkID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQpO1xuICAgICAgb2Zmc2V0ICs9NDtcblxuICAgICAgdGFnTGVuID0gZGF0YVtvZmZzZXQrK10gPDwgMjQgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDE2ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnRmxhZ3MgPSBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdTdGFydCA9IG9mZnNldDtcbiAgICAgIC8vbG9nZ2VyLmxvZyhcIklEMyB0YWcgaWQ6XCIgKyB0YWdJZCk7XG4gICAgICBzd2l0Y2godGFnSWQpIHtcbiAgICAgICAgY2FzZSAnUFJJVic6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3BhcnNlIGZyYW1lOicgKyBIZXguaGV4RHVtcChkYXRhLnN1YmFycmF5KG9mZnNldCxlbmRQb3MpKSk7XG4gICAgICAgICAgICAvLyBvd25lciBzaG91bGQgYmUgXCJjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcFwiXG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQ0KSA9PT0gJ2NvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wJykge1xuICAgICAgICAgICAgICAgIG9mZnNldCs9NDQ7XG4gICAgICAgICAgICAgICAgLy8gc21lbGxpbmcgZXZlbiBiZXR0ZXIgISB3ZSBmb3VuZCB0aGUgcmlnaHQgZGVzY3JpcHRvclxuICAgICAgICAgICAgICAgIC8vIHNraXAgbnVsbCBjaGFyYWN0ZXIgKHN0cmluZyBlbmQpICsgMyBmaXJzdCBieXRlc1xuICAgICAgICAgICAgICAgIG9mZnNldCs9IDQ7XG5cbiAgICAgICAgICAgICAgICAvLyB0aW1lc3RhbXAgaXMgMzMgYml0IGV4cHJlc3NlZCBhcyBhIGJpZy1lbmRpYW4gZWlnaHQtb2N0ZXQgbnVtYmVyLCB3aXRoIHRoZSB1cHBlciAzMSBiaXRzIHNldCB0byB6ZXJvLlxuICAgICAgICAgICAgICAgIHZhciBwdHMzM0JpdCAgPSBkYXRhW29mZnNldCsrXSAmIDB4MTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gKChkYXRhW29mZnNldCsrXSA8PCAyMykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgMTUpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8ICA3KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdKSAvNDU7XG5cbiAgICAgICAgICAgICAgICBpZiAocHRzMzNCaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wICAgKz0gNDc3MjE4NTguODQ7IC8vIDJeMzIgLyA5MFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSBNYXRoLnJvdW5kKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLnRyYWNlKGBJRDMgdGltZXN0YW1wIGZvdW5kOiAke3RpbWVzdGFtcH1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lU3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBoYXNUaW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc1RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCB0aW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCBsZW5ndGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xlbmd0aDtcbiAgfVxuXG4gIGdldCBwYXlsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXlsb2FkO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSUQzO1xuXG4iLCIvKipcbiAqIGhpZ2hseSBvcHRpbWl6ZWQgVFMgZGVtdXhlcjpcbiAqIHBhcnNlIFBBVCwgUE1UXG4gKiBleHRyYWN0IFBFUyBwYWNrZXQgZnJvbSBhdWRpbyBhbmQgdmlkZW8gUElEc1xuICogZXh0cmFjdCBBVkMvSDI2NCBOQUwgdW5pdHMgYW5kIEFBQy9BRFRTIHNhbXBsZXMgZnJvbSBQRVMgcGFja2V0XG4gKiB0cmlnZ2VyIHRoZSByZW11eGVyIHVwb24gcGFyc2luZyBjb21wbGV0aW9uXG4gKiBpdCBhbHNvIHRyaWVzIHRvIHdvcmthcm91bmQgYXMgYmVzdCBhcyBpdCBjYW4gYXVkaW8gY29kZWMgc3dpdGNoIChIRS1BQUMgdG8gQUFDIGFuZCB2aWNlIHZlcnNhKSwgd2l0aG91dCBoYXZpbmcgdG8gcmVzdGFydCB0aGUgTWVkaWFTb3VyY2UuXG4gKiBpdCBhbHNvIGNvbnRyb2xzIHRoZSByZW11eGluZyBwcm9jZXNzIDpcbiAqIHVwb24gZGlzY29udGludWl0eSBvciBsZXZlbCBzd2l0Y2ggZGV0ZWN0aW9uLCBpdCB3aWxsIGFsc28gbm90aWZpZXMgdGhlIHJlbXV4ZXIgc28gdGhhdCBpdCBjYW4gcmVzZXQgaXRzIHN0YXRlLlxuKi9cblxuIGltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5sYXN0Q0MgPSAwO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGEgVFMgZnJhZ21lbnQgc2hvdWxkIGNvbnRhaW4gYXQgbGVhc3QgMyBUUyBwYWNrZXRzLCBhIFBBVCwgYSBQTVQsIGFuZCBvbmUgUElELCBlYWNoIHN0YXJ0aW5nIHdpdGggMHg0N1xuICAgIGlmIChkYXRhLmxlbmd0aCA+PSAzKjE4OCAmJiBkYXRhWzBdID09PSAweDQ3ICYmIGRhdGFbMTg4XSA9PT0gMHg0NyAmJiBkYXRhWzIqMTg4XSA9PT0gMHg0Nykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLnBtdFBhcnNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3BtdElkID0gLTE7XG4gICAgdGhpcy5sYXN0QWFjUFRTID0gbnVsbDtcbiAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHtjb250YWluZXIgOiAndmlkZW8vbXAydCcsIHR5cGU6ICd2aWRlbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMCwgbmJOYWx1IDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7Y29udGFpbmVyIDogJ3ZpZGVvL21wMnQnLCB0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX2lkM1RyYWNrID0ge3R5cGU6ICdpZDMnLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX3R4dFRyYWNrID0ge3R5cGU6ICd0ZXh0JywgaWQ6IC0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlczogW10sIGxlbjogMH07XG4gICAgdGhpcy5yZW11eGVyLnN3aXRjaExldmVsKCk7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLnJlbXV4ZXIuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCkge1xuICAgIGxvZ2dlci5pbmZvKCd0c2RlbXV4ZXIgdDA6ICcgKyB0MCk7XG4gICAgdmFyIGF2Y0RhdGEsIGFhY0RhdGEsIGlkM0RhdGEsXG4gICAgICAgIHN0YXJ0LCBsZW4gPSBkYXRhLmxlbmd0aCwgc3R0LCBwaWQsIGF0Ziwgb2Zmc2V0LFxuICAgICAgICBjb2RlY3NPbmx5ID0gdGhpcy5yZW11eGVyLnBhc3N0aHJvdWdoO1xuXG4gICAgdGhpcy5hdWRpb0NvZGVjID0gYXVkaW9Db2RlYztcbiAgICB0aGlzLnZpZGVvQ29kZWMgPSB2aWRlb0NvZGVjO1xuICAgIHRoaXMudGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICB0aGlzLmNvbnRpZ3VvdXMgPSBmYWxzZTtcbiAgICBpZiAoY2MgIT09IHRoaXMubGFzdENDKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNjb250aW51aXR5IGRldGVjdGVkJyk7XG4gICAgICB0aGlzLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgICAgIHRoaXMubGFzdENDID0gY2M7XG4gICAgfSBlbHNlIGlmIChsZXZlbCAhPT0gdGhpcy5sYXN0TGV2ZWwpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2xldmVsIHN3aXRjaCBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgICAgdGhpcy5sYXN0TGV2ZWwgPSBsZXZlbDtcbiAgICB9IGVsc2UgaWYgKHNuID09PSAodGhpcy5sYXN0U04rMSkpIHtcbiAgICAgIHRoaXMuY29udGlndW91cyA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubGFzdFNOID0gc247XG5cbiAgICBpZighdGhpcy5jb250aWd1b3VzKSB7XG4gICAgICAvLyBmbHVzaCBhbnkgcGFydGlhbCBjb250ZW50XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQsXG4gICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQsXG4gICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQsXG4gICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG5cblx0dmFyIGZpcnN0RnJhbWUgPSB0cnVlO1xuICAgIC8vIGRvbid0IHBhcnNlIGxhc3QgVFMgcGFja2V0IGlmIGluY29tcGxldGVcbiAgICBsZW4gLT0gbGVuICUgMTg4O1xuICAgIC8vIGxvb3AgdGhyb3VnaCBUUyBwYWNrZXRzXG4gICAgZm9yIChzdGFydCA9IDA7IHN0YXJ0IDwgbGVuOyBzdGFydCArPSAxODgpIHtcbiAgICAgIGlmIChkYXRhW3N0YXJ0XSA9PT0gMHg0Nykge1xuICAgICAgICBzdHQgPSAhIShkYXRhW3N0YXJ0ICsgMV0gJiAweDQwKTtcbiAgICAgICAgLy8gcGlkIGlzIGEgMTMtYml0IGZpZWxkIHN0YXJ0aW5nIGF0IHRoZSBsYXN0IGJpdCBvZiBUU1sxXVxuICAgICAgICBwaWQgPSAoKGRhdGFbc3RhcnQgKyAxXSAmIDB4MWYpIDw8IDgpICsgZGF0YVtzdGFydCArIDJdO1xuICAgICAgICBhdGYgPSAoZGF0YVtzdGFydCArIDNdICYgMHgzMCkgPj4gNDtcbiAgICAgICAgLy8gaWYgYW4gYWRhcHRpb24gZmllbGQgaXMgcHJlc2VudCwgaXRzIGxlbmd0aCBpcyBzcGVjaWZpZWQgYnkgdGhlIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuXG4gICAgICAgIGlmIChhdGYgPiAxKSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQgKyA1ICsgZGF0YVtzdGFydCArIDRdO1xuICAgICAgICAgIC8vIGNvbnRpbnVlIGlmIHRoZXJlIGlzIG9ubHkgYWRhcHRhdGlvbiBmaWVsZFxuICAgICAgICAgIGlmIChvZmZzZXQgPT09IChzdGFydCArIDE4OCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBtdFBhcnNlZCkge1xuICAgICAgICAgIGlmIChwaWQgPT09IGF2Y0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdmFyIGlzRnJhbWVPa0ZvckNocm9tZU9TWCA9IHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpLCBmaXJzdEZyYW1lKTtcblx0XHRcdFx0aWYgKGlzRnJhbWVPa0ZvckNocm9tZU9TWCkgeyBmaXJzdEZyYW1lID0gZmFsc2U7IH1cbiAgICAgICAgICAgICAgICBpZiAoY29kZWNzT25seSkge1xuICAgICAgICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSB2aWRlbyBjb2RlYyBpbmZvIEFORFxuICAgICAgICAgICAgICAgICAgLy8gaWYgYXVkaW8gUElEIGlzIHVuZGVmaW5lZCBPUiBpZiB3ZSBoYXZlIGF1ZGlvIGNvZGVjIGluZm8sXG4gICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGFsbCBjb2RlYyBpbmZvICFcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hdmNUcmFjay5jb2RlYyAmJiAoYWFjSWQgPT09IC0xIHx8IHRoaXMuX2FhY1RyYWNrLmNvZGVjKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbXV4KGRhdGEsIHQwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhdmNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhdmNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGFhY0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgICAgICAgICAgICAgIGlmIChjb2RlY3NPbmx5KSB7XG4gICAgICAgICAgICAgICAgICAvLyBoZXJlIHdlIG5vdyB0aGF0IHdlIGhhdmUgYXVkaW8gY29kZWMgaW5mb1xuICAgICAgICAgICAgICAgICAgLy8gaWYgdmlkZW8gUElEIGlzIHVuZGVmaW5lZCBPUiBpZiB3ZSBoYXZlIHZpZGVvIGNvZGVjIGluZm8sXG4gICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGFsbCBjb2RlYyBpbmZvcyAhXG4gICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYWFjVHJhY2suY29kZWMgJiYgKGF2Y0lkID09PSAtMSB8fCB0aGlzLl9hdmNUcmFjay5jb2RlYykpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW11eChkYXRhLCB0MCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYWFjRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgICAgICAgICBhYWNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgYWFjRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSBpZDNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZDNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgIGlkM0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBpZDNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocGlkID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQ7XG4gICAgICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkO1xuICAgICAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ1RTIHBhY2tldCBkaWQgbm90IHN0YXJ0IHdpdGggMHg0Nyd9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcGFyc2UgbGFzdCBQRVMgcGFja2V0XG4gICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICB9XG4gICAgdGhpcy5yZW11eChudWxsLCB0MCk7XG4gIH1cblxuICByZW11eChkYXRhLCB0MCkge1xuXHRsb2dnZXIuaW5mbygndHNkZW11eGVyIHBhc3NpbmcgdDAgdG8gcmVtdXg6ICcgKyB0MCk7XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLCB0aGlzLl9hdmNUcmFjaywgdGhpcy5faWQzVHJhY2ssIHRoaXMuX3R4dFRyYWNrLCB0aGlzLnRpbWVPZmZzZXQsIHRoaXMuY29udGlndW91cywgZGF0YSwgdDApO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSAwO1xuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsIG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsIG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLCB0YWJsZUVuZCwgcHJvZ3JhbUluZm9MZW5ndGgsIHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMTFdO1xuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gUGFja2V0aXplZCBtZXRhZGF0YSAoSUQzKVxuICAgICAgICBjYXNlIDB4MTU6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdJRDMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9pZDNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsIGZyYWcsIHBlc0ZsYWdzLCBwZXNQcmVmaXgsIHBlc0xlbiwgcGVzSGRyTGVuLCBwZXNEYXRhLCBwZXNQdHMsIHBlc0R0cywgcGF5bG9hZFN0YXJ0T2Zmc2V0LCBkYXRhID0gc3RyZWFtLmRhdGE7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYgKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvKiBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgICAgIGFzIFBUUyAvIERUUyBpcyAzMyBiaXQgd2UgY2Fubm90IHVzZSBiaXR3aXNlIG9wZXJhdG9yIGluIEpTLFxuICAgICAgICAgICAgYXMgQml0d2lzZSBvcGVyYXRvcnMgdHJlYXQgdGhlaXIgb3BlcmFuZHMgYXMgYSBzZXF1ZW5jZSBvZiAzMiBiaXRzICovXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAoZnJhZ1sxMF0gJiAweEZGKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAoZnJhZ1sxMV0gJiAweEZFKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgKGZyYWdbMTJdICYgMHhGRikgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgIChmcmFnWzEzXSAmIDB4RkUpIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNQdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzUHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApICogNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgICAoZnJhZ1sxNV0gJiAweEZGICkgKiA0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgICAoZnJhZ1sxNl0gJiAweEZFICkgKiAxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgICAgKGZyYWdbMTddICYgMHhGRiApICogMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAgIChmcmFnWzE4XSAmIDB4RkUgKSAvIDI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzRHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgIHBlc0R0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4gKyA5O1xuXG4gICAgICBzdHJlYW0uc2l6ZSAtPSBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAvL3JlYXNzZW1ibGUgUEVTIHBhY2tldFxuICAgICAgcGVzRGF0YSA9IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKTtcbiAgICAgIHdoaWxlIChkYXRhLmxlbmd0aCkge1xuICAgICAgICBmcmFnID0gZGF0YS5zaGlmdCgpO1xuICAgICAgICB2YXIgbGVuID0gZnJhZy5ieXRlTGVuZ3RoO1xuICAgICAgICBpZiAocGF5bG9hZFN0YXJ0T2Zmc2V0KSB7XG4gICAgICAgICAgaWYgKHBheWxvYWRTdGFydE9mZnNldCA+IGxlbikge1xuICAgICAgICAgICAgLy8gdHJpbSBmdWxsIGZyYWcgaWYgUEVTIGhlYWRlciBiaWdnZXIgdGhhbiBmcmFnXG4gICAgICAgICAgICBwYXlsb2FkU3RhcnRPZmZzZXQtPWxlbjtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB0cmltIHBhcnRpYWwgZnJhZyBpZiBQRVMgaGVhZGVyIHNtYWxsZXIgdGhhbiBmcmFnXG4gICAgICAgICAgICBmcmFnID0gZnJhZy5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgICAgICAgbGVuLT1wYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSs9bGVuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtkYXRhOiBwZXNEYXRhLCBwdHM6IHBlc1B0cywgZHRzOiBwZXNEdHMsIGxlbjogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcywgZmlyc3RGcmFtZSkge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyxcbiAgICAgICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpLFxuICAgICAgICB1bml0czIgPSBbXSxcbiAgICAgICAgZGVidWcgPSBmYWxzZSxcbiAgICAgICAga2V5ID0gZmFsc2UsXG4gICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgIGV4cEdvbG9tYkRlY29kZXIsXG4gICAgICAgIGF2Y1NhbXBsZSxcbiAgICAgICAgcHVzaCxcbiAgICAgICAgaTtcbiAgICAvLyBubyBOQUx1IGZvdW5kXG4gICAgaWYgKHVuaXRzLmxlbmd0aCA9PT0gMCAmJiBzYW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFwcGVuZCBwZXMuZGF0YSB0byBwcmV2aW91cyBOQUwgdW5pdFxuICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgcGVzLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgdG1wLnNldChwZXMuZGF0YSwgbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgdHJhY2subGVuICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHZhciBkZWJ1Z1N0cmluZyA9ICcnO1xuXG5cdHZhciB0eXBlcyA9ICcnO1xuXHR2YXIgc2hvdWxkRXhpdCA9IGZhbHNlO1xuXG5cdHZhciBTRUlDb3VudGVyID0gMDtcblxuICAgIHVuaXRzLmZvckVhY2godW5pdCA9PiB7XG5cdFx0aWYgKHNob3VsZEV4aXQpIHJldHVybjtcblx0XHR0eXBlcyArPSAnICcgKyB1bml0LnR5cGU7XG4gICAgICBzd2l0Y2godW5pdC50eXBlKSB7XG4gICAgICAgIC8vTkRSXG4gICAgICAgICBjYXNlIDE6XG5cdFx0ICAgaWYoIGZpcnN0RnJhbWUgJiZcblx0XHRcdCAgIG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJNYWNcIikgPiAtMSAmJiBcblx0XHRcdCAgIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdjaHJvbWUnKSA+IC0xXG5cdFx0ICAgKSB7IFxuXG5cdFx0XHQgICBjb25zb2xlLndhcm4oJ2ZpcnN0IGZyYW1lIHdpdGggJyArIHVuaXQudHlwZSArICc7IHNraXBwaW5nIHRvIHByZXZlbnQgY2hyb21lIGhhcmR3YXJlIGRlY29kZXIgaXNzdWUgb24gb3N4Jyk7IFxuXHRcdFx0ICAgcHVzaCA9IGZhbHNlO1xuXHRcdFx0ICAgc2hvdWxkRXhpdCA9IHRydWU7XG5cdFx0XHQgICByZXR1cm4gZmFsc2U7XG5cdFx0XHQgICBicmVhaztcblx0XHQgICB9XG4gICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ05EUiAnO1xuICAgICAgICAgICB9XG4gICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL0lEUlxuICAgICAgICBjYXNlIDU6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdJRFIgJztcbiAgICAgICAgICB9XG4gICAgICAgICAga2V5ID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TRUlcbiAgICAgICAgY2FzZSA2OlxuXHRcdCAgIFNFSUNvdW50ZXIrKztcblx0XHQgICBpZiggZmlyc3RGcmFtZSAmJiBcblx0XHRcdCAgIG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJNYWNcIikgPiAtMSAmJiBcblx0XHRcdCAgIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdjaHJvbWUnKSA+IC0xICYmXG5cdFx0XHQgICBTRUlDb3VudGVyID4gMVxuXHRcdCAgICkgeyBcblx0XHRcdCAgICBjb25zb2xlLndhcm4oJ2ZpcnN0IGZyYW1lIHdpdGggJyArIHVuaXQudHlwZSArICc7IHNraXBwaW5nIHRvIHByZXZlbnQgY2hyb21lIGhhcmR3YXJlIGRlY29kZXIgaXNzdWUgb24gb3N4Jyk7IFxuXHRcdFx0ICAgIHB1c2ggPSBmYWxzZTtcblx0XHRcdFx0c2hvdWxkRXhpdCA9IHRydWU7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdCAgICBicmVhaztcblx0XHQgICAgfVxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnU0VJICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG5cbiAgICAgICAgICAvLyBza2lwIGZyYW1lVHlwZVxuICAgICAgICAgIGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICB2YXIgcGF5bG9hZFR5cGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgLy8gVE9ETzogdGhlcmUgY2FuIGJlIG1vcmUgdGhhbiBvbmUgcGF5bG9hZCBpbiBhbiBTRUkgcGFja2V0Li4uXG4gICAgICAgICAgLy8gVE9ETzogbmVlZCB0byByZWFkIHR5cGUgYW5kIHNpemUgaW4gYSB3aGlsZSBsb29wIHRvIGdldCB0aGVtIGFsbFxuICAgICAgICAgIGlmIChwYXlsb2FkVHlwZSA9PT0gNClcbiAgICAgICAgICB7XG4gICAgICAgICAgICB2YXIgcGF5bG9hZFNpemUgPSAwO1xuXG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgIHBheWxvYWRTaXplID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChwYXlsb2FkU2l6ZSA9PT0gMjU1KTtcblxuICAgICAgICAgICAgdmFyIGNvdW50cnlDb2RlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgaWYgKGNvdW50cnlDb2RlID09PSAxODEpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHZhciBwcm92aWRlckNvZGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVU2hvcnQoKTtcblxuICAgICAgICAgICAgICBpZiAocHJvdmlkZXJDb2RlID09PSA0OSlcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZhciB1c2VyU3RydWN0dXJlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUludCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHVzZXJTdHJ1Y3R1cmUgPT09IDB4NDc0MTM5MzQpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdmFyIHVzZXJEYXRhVHlwZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgIC8vIFJhdyBDRUEtNjA4IGJ5dGVzIHdyYXBwZWQgaW4gQ0VBLTcwOCBwYWNrZXRcbiAgICAgICAgICAgICAgICAgIGlmICh1c2VyRGF0YVR5cGUgPT09IDMpXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmaXJzdEJ5dGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2Vjb25kQnl0ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHRvdGFsQ0NzID0gMzEgJiBmaXJzdEJ5dGU7XG4gICAgICAgICAgICAgICAgICAgIHZhciBieXRlQXJyYXkgPSBbZmlyc3RCeXRlLCBzZWNvbmRCeXRlXTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGk9MDsgaTx0b3RhbENDczsgaSsrKVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gMyBieXRlcyBwZXIgQ0NcbiAgICAgICAgICAgICAgICAgICAgICBieXRlQXJyYXkucHVzaChleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICBieXRlQXJyYXkucHVzaChleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICBieXRlQXJyYXkucHVzaChleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3R4dFRyYWNrLnNhbXBsZXMucHVzaCh7dHlwZTogMywgcHRzOiBwZXMucHRzLCBieXRlczogYnl0ZUFycmF5fSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NQU1xuICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoIXRyYWNrLnNwcykge1xuICAgICAgICAgICAgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTUFMoKTtcbiAgICAgICAgICAgIHRyYWNrLndpZHRoID0gY29uZmlnLndpZHRoO1xuICAgICAgICAgICAgdHJhY2suaGVpZ2h0ID0gY29uZmlnLmhlaWdodDtcbiAgICAgICAgICAgIHRyYWNrLnNwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgICAgdHJhY2suZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsIDQpO1xuICAgICAgICAgICAgdmFyIGNvZGVjc3RyaW5nID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIGggPSBjb2RlY2FycmF5W2ldLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICAgICAgaWYgKGgubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgIGggPSAnMCcgKyBoO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvZGVjc3RyaW5nICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFjay5jb2RlYyA9IGNvZGVjc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9QUFNcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnUFBTICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghdHJhY2sucHBzKSB7XG4gICAgICAgICAgICB0cmFjay5wcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgOTpcbiAgICAgICAgICBwdXNoID0gZmFsc2U7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdBVUQgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcHVzaCA9IGZhbHNlO1xuICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICd1bmtub3duIE5BTCAnICsgdW5pdC50eXBlICsgJyAnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYocHVzaCkge1xuICAgICAgICB1bml0czIucHVzaCh1bml0KTtcbiAgICAgICAgbGVuZ3RoKz11bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICB9KTtcblxuXHRpZiAoZmlyc3RGcmFtZSkgeyBcblx0XHR0eXBlcyA9ICcqKiAnICsgdHlwZXM7IFxuXHRcdGNvbnNvbGUuaW5mbyh0eXBlcyArICcnKTtcblx0fVxuXG5cdGlmIChzaG91bGRFeGl0KSB7XG5cdFx0Y29uc29sZS53YXJuKCdza2lwcGluZyBmcmFtZScpO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG4gICAgaWYoZGVidWcgfHwgZGVidWdTdHJpbmcubGVuZ3RoKSB7XG4gICAgICBsb2dnZXIubG9nKGRlYnVnU3RyaW5nKTtcbiAgICB9XG4gICAgLy9idWlsZCBzYW1wbGUgZnJvbSBQRVNcbiAgICAvLyBBbm5leCBCIHRvIE1QNCBjb252ZXJzaW9uIHRvIGJlIGRvbmVcbiAgICBpZiAodW5pdHMyLmxlbmd0aCkge1xuICAgICAgLy8gb25seSBwdXNoIEFWQyBzYW1wbGUgaWYga2V5ZnJhbWUgYWxyZWFkeSBmb3VuZC4gYnJvd3NlcnMgZXhwZWN0IGEga2V5ZnJhbWUgYXQgZmlyc3QgdG8gc3RhcnQgZGVjb2RpbmdcbiAgICAgIGlmIChrZXkgPT09IHRydWUgfHwgdHJhY2suc3BzICkge1xuICAgICAgICBhdmNTYW1wbGUgPSB7dW5pdHM6IHsgdW5pdHMgOiB1bml0czIsIGxlbmd0aCA6IGxlbmd0aH0sIHB0czogcGVzLnB0cywgZHRzOiBwZXMuZHRzLCBrZXk6IGtleX07XG4gICAgICAgIHNhbXBsZXMucHVzaChhdmNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gbGVuZ3RoO1xuICAgICAgICB0cmFjay5uYk5hbHUgKz0gdW5pdHMyLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9XG5cdHJldHVybiB0cnVlO1xuICB9XG5cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLCBsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLCB2YWx1ZSwgb3ZlcmZsb3csIHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsIGxhc3RVbml0VHlwZTtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZiAodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gMSAmJiBpIDwgbGVuKSB7XG4gICAgICAgICAgICB1bml0VHlwZSA9IGFycmF5W2ldICYgMHgxZjtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBOQUxVIEAgb2Zmc2V0OicgKyBpICsgJyx0eXBlOicgKyB1bml0VHlwZSk7XG4gICAgICAgICAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0ge2RhdGE6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsIGkgLSBzdGF0ZSAtIDEpLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcztcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXRzID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdCA9IGxhc3RVbml0c1tsYXN0VW5pdHMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLCAwKTtcbiAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCwgb3ZlcmZsb3cpLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgdHJhY2subGVuICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgbGVuKSwgdHlwZTogbGFzdFVuaXRUeXBlfTtcbiAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiB1bml0cztcbiAgfVxuXG4gIF9wYXJzZUFBQ1BFUyhwZXMpIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgZGF0YSA9IHBlcy5kYXRhLFxuICAgICAgICBwdHMgPSBwZXMucHRzLFxuICAgICAgICBzdGFydE9mZnNldCA9IDAsXG4gICAgICAgIGR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb24sXG4gICAgICAgIGF1ZGlvQ29kZWMgPSB0aGlzLmF1ZGlvQ29kZWMsXG4gICAgICAgIGFhY092ZXJGbG93ID0gdGhpcy5hYWNPdmVyRmxvdyxcbiAgICAgICAgbGFzdEFhY1BUUyA9IHRoaXMubGFzdEFhY1BUUyxcbiAgICAgICAgY29uZmlnLCBmcmFtZUxlbmd0aCwgZnJhbWVEdXJhdGlvbiwgZnJhbWVJbmRleCwgb2Zmc2V0LCBoZWFkZXJMZW5ndGgsIHN0YW1wLCBsZW4sIGFhY1NhbXBsZTtcbiAgICBpZiAoYWFjT3ZlckZsb3cpIHtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShhYWNPdmVyRmxvdy5ieXRlTGVuZ3RoICsgZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQoYWFjT3ZlckZsb3csIDApO1xuICAgICAgdG1wLnNldChkYXRhLCBhYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDOiBhcHBlbmQgb3ZlcmZsb3dpbmcgJHthYWNPdmVyRmxvdy5ieXRlTGVuZ3RofSBieXRlcyB0byBiZWdpbm5pbmcgb2YgbmV3IFBFU2ApO1xuICAgICAgZGF0YSA9IHRtcDtcbiAgICB9XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKG9mZnNldCA9IHN0YXJ0T2Zmc2V0LCBsZW4gPSBkYXRhLmxlbmd0aDsgb2Zmc2V0IDwgbGVuIC0gMTsgb2Zmc2V0KyspIHtcbiAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgQURUUyBoZWFkZXIgZG9lcyBub3Qgc3RhcnQgc3RyYWlnaHQgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGF5bG9hZCwgcmFpc2UgYW4gZXJyb3JcbiAgICBpZiAob2Zmc2V0KSB7XG4gICAgICB2YXIgcmVhc29uLCBmYXRhbDtcbiAgICAgIGlmIChvZmZzZXQgPCBsZW4gLSAxKSB7XG4gICAgICAgIHJlYXNvbiA9IGBBQUMgUEVTIGRpZCBub3Qgc3RhcnQgd2l0aCBBRFRTIGhlYWRlcixvZmZzZXQ6JHtvZmZzZXR9YDtcbiAgICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlYXNvbiA9ICdubyBBRFRTIGhlYWRlciBmb3VuZCBpbiBBQUMgUEVTJztcbiAgICAgICAgZmF0YWwgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhdGFsLCByZWFzb246IHJlYXNvbn0pO1xuICAgICAgaWYgKGZhdGFsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IEFEVFMuZ2V0QXVkaW9Db25maWcodGhpcy5vYnNlcnZlcixkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpO1xuICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBmcmFtZUluZGV4ID0gMDtcbiAgICBmcmFtZUR1cmF0aW9uID0gMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuXG4gICAgLy8gaWYgbGFzdCBBQUMgZnJhbWUgaXMgb3ZlcmZsb3dpbmcsIHdlIHNob3VsZCBlbnN1cmUgdGltZXN0YW1wcyBhcmUgY29udGlndW91czpcbiAgICAvLyBmaXJzdCBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBmcmFtZUR1cmF0aW9uXG4gICAgaWYoYWFjT3ZlckZsb3cgJiYgbGFzdEFhY1BUUykge1xuICAgICAgdmFyIG5ld1BUUyA9IGxhc3RBYWNQVFMrZnJhbWVEdXJhdGlvbjtcbiAgICAgIGlmKE1hdGguYWJzKG5ld1BUUy1wdHMpID4gMSkge1xuICAgICAgICBsb2dnZXIubG9nKGBBQUM6IGFsaWduIFBUUyBmb3Igb3ZlcmxhcHBpbmcgZnJhbWVzIGJ5ICR7TWF0aC5yb3VuZCgobmV3UFRTLXB0cykvOTApfWApO1xuICAgICAgICBwdHM9bmV3UFRTO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlICgob2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIFRoZSBwcm90ZWN0aW9uIHNraXAgYml0IHRlbGxzIHVzIGlmIHdlIGhhdmUgMiBieXRlcyBvZiBDUkMgZGF0YSBhdCB0aGUgZW5kIG9mIHRoZSBBRFRTIGhlYWRlclxuICAgICAgaGVhZGVyTGVuZ3RoID0gKCEhKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGZyYW1lTGVuZ3RoID0gKChkYXRhW29mZnNldCArIDNdICYgMHgwMykgPDwgMTEpIHxcbiAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCArIDRdIDw8IDMpIHxcbiAgICAgICAgICAgICAgICAgICAgKChkYXRhW29mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgZnJhbWVMZW5ndGggIC09IGhlYWRlckxlbmd0aDtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuXG4gICAgICBpZiAoKGZyYW1lTGVuZ3RoID4gMCkgJiYgKChvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCkgPD0gbGVuKSkge1xuICAgICAgICBzdGFtcCA9IHB0cyArIGZyYW1lSW5kZXggKiBmcmFtZUR1cmF0aW9uO1xuICAgICAgICAvL2xvZ2dlci5sb2coYEFBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC90b3RhbC9wdHM6JHtvZmZzZXQraGVhZGVyTGVuZ3RofS8ke2ZyYW1lTGVuZ3RofS8ke2RhdGEuYnl0ZUxlbmd0aH0vJHsoc3RhbXAvOTApLnRvRml4ZWQoMCl9YCk7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KG9mZnNldCArIGhlYWRlckxlbmd0aCwgb2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBmcmFtZUxlbmd0aDtcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lTGVuZ3RoICsgaGVhZGVyTGVuZ3RoO1xuICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICAgIGZvciAoIDsgb2Zmc2V0IDwgKGxlbiAtIDEpOyBvZmZzZXQrKykge1xuICAgICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoKGRhdGFbb2Zmc2V0ICsgMV0gJiAweGYwKSA9PT0gMHhmMCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvZmZzZXQgPCBsZW4pIHtcbiAgICAgIGFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShvZmZzZXQsIGxlbik7XG4gICAgICAvL2xvZ2dlci5sb2coYEFBQzogb3ZlcmZsb3cgZGV0ZWN0ZWQ6JHtsZW4tb2Zmc2V0fWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBhYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBhYWNPdmVyRmxvdztcbiAgICB0aGlzLmxhc3RBYWNQVFMgPSBzdGFtcDtcbiAgfVxuXG4gIF9wYXJzZUlEM1BFUyhwZXMpIHtcbiAgICB0aGlzLl9pZDNUcmFjay5zYW1wbGVzLnB1c2gocGVzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG5cbiIsImV4cG9ydCBjb25zdCBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUjogJ25ldHdvcmtFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWVkaWEgRXJyb3IgKHZpZGVvL3BhcnNpbmcvbWVkaWFzb3VyY2UgZXJyb3IpXG4gIE1FRElBX0VSUk9SOiAnbWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1I6ICdvdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IGNvbnN0IEVycm9yRGV0YWlscyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9FUlJPUjogJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQ6ICdtYW5pZmVzdExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBwYXJzaW5nIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZWFzb24gOiBlcnJvciByZWFzb259XG4gIE1BTklGRVNUX1BBUlNJTkdfRVJST1I6ICdtYW5pZmVzdFBhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3Qgd2l0aCBvbmx5IGluY29tcGF0aWJsZSBjb2RlY3MgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfSU5DT01QQVRJQkxFX0NPREVDU19FUlJPUjogJ21hbmlmZXN0SW5jb21wYXRpYmxlQ29kZWNzRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUjogJ2xldmVsTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgcGxheWxpc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9USU1FT1VUOiAnbGV2ZWxMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfU1dJVENIX0VSUk9SOiAnbGV2ZWxTd2l0Y2hFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBGUkFHX0xPQURfRVJST1I6ICdmcmFnTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPT1BfTE9BRElOR19FUlJPUjogJ2ZyYWdMb29wTG9hZGluZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfVElNRU9VVDogJ2ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgZGVjcnlwdGlvbiBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19ERUNSWVBUX0VSUk9SOiAnZnJhZ0RlY3J5cHRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SOiAnZnJhZ1BhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBLRVlfTE9BRF9FUlJPUjogJ2tleUxvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgdGltZW91dCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgS0VZX0xPQURfVElNRU9VVDogJ2tleUxvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kIGVycm9yIC0gZGF0YTogYXBwZW5kIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRfRVJST1I6ICdidWZmZXJBcHBlbmRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIGFwcGVuZGluZyBlcnJvciBldmVudCAtIGRhdGE6IGFwcGVuZGluZyBlcnJvciBkZXNjcmlwdGlvblxuICBCVUZGRVJfQVBQRU5ESU5HX0VSUk9SOiAnYnVmZmVyQXBwZW5kaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBzdGFsbGVkIGVycm9yIGV2ZW50XG4gIEJVRkZFUl9TVEFMTEVEX0VSUk9SOiAnYnVmZmVyU3RhbGxlZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgZnVsbCBldmVudFxuICBCVUZGRVJfRlVMTF9FUlJPUjogJ2J1ZmZlckZ1bGxFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHNlZWsgb3ZlciBob2xlIGV2ZW50XG4gIEJVRkZFUl9TRUVLX09WRVJfSE9MRTogJ2J1ZmZlclNlZWtPdmVySG9sZSdcbn07XG4iLCIvKlxuKlxuKiBBbGwgb2JqZWN0cyBpbiB0aGUgZXZlbnQgaGFuZGxpbmcgY2hhaW4gc2hvdWxkIGluaGVyaXQgZnJvbSB0aGlzIGNsYXNzXG4qXG4qL1xuXG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzLCAuLi5ldmVudHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9uRXZlbnQgPSB0aGlzLm9uRXZlbnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLmhhbmRsZWRFdmVudHMgPSBldmVudHM7XG4gICAgdGhpcy51c2VHZW5lcmljSGFuZGxlciA9IHRydWU7XG5cbiAgICB0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMudW5yZWdpc3Rlckxpc3RlbmVycygpO1xuICB9XG5cbiAgaXNFdmVudEhhbmRsZXIoKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGlzLmhhbmRsZWRFdmVudHMgPT09ICdvYmplY3QnICYmIHRoaXMuaGFuZGxlZEV2ZW50cy5sZW5ndGggJiYgdHlwZW9mIHRoaXMub25FdmVudCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIHJlZ2lzdGVyTGlzdGVuZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRXZlbnRIYW5kbGVyKCkpIHtcbiAgICAgIHRoaXMuaGFuZGxlZEV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCA9PT0gJ2hsc0V2ZW50R2VuZXJpYycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvcmJpZGRlbiBldmVudCBuYW1lOiAnICsgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGxzLm9uKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB1bnJlZ2lzdGVyTGlzdGVuZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRXZlbnRIYW5kbGVyKCkpIHtcbiAgICAgIHRoaXMuaGFuZGxlZEV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuaGxzLm9mZihldmVudCwgdGhpcy5vbkV2ZW50KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgKiBhcmd1bWVudHM6IGV2ZW50IChzdHJpbmcpLCBkYXRhIChhbnkpXG4gICovXG4gIG9uRXZlbnQoZXZlbnQsIGRhdGEpIHtcbiAgICB0aGlzLm9uRXZlbnRHZW5lcmljKGV2ZW50LCBkYXRhKTtcbiAgfVxuXG4gIG9uRXZlbnRHZW5lcmljKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGV2ZW50VG9GdW5jdGlvbiA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICB2YXIgZnVuY05hbWUgPSAnb24nICsgZXZlbnQucmVwbGFjZSgnaGxzJywgJycpO1xuICAgICAgaWYgKHR5cGVvZiB0aGlzW2Z1bmNOYW1lXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50ICR7ZXZlbnR9IGhhcyBubyBnZW5lcmljIGhhbmRsZXIgaW4gdGhpcyAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gY2xhc3MgKHRyaWVkICR7ZnVuY05hbWV9KWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXNbZnVuY05hbWVdLmJpbmQodGhpcywgZGF0YSk7XG4gICAgfTtcbiAgICBldmVudFRvRnVuY3Rpb24uY2FsbCh0aGlzLCBldmVudCwgZGF0YSkuY2FsbCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV2ZW50SGFuZGxlcjsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgLy8gZmlyZWQgYmVmb3JlIE1lZGlhU291cmNlIGlzIGF0dGFjaGluZyB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyBtZWRpYSB9XG4gIE1FRElBX0FUVEFDSElORzogJ2hsc01lZGlhQXR0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0FUVEFDSEVEOiAnaGxzTWVkaWFBdHRhY2hlZCcsXG4gIC8vIGZpcmVkIGJlZm9yZSBkZXRhY2hpbmcgTWVkaWFTb3VyY2UgZnJvbSBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0RFVEFDSElORzogJ2hsc01lZGlhRGV0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBkZXRhY2hlZCBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNIRUQ6ICdobHNNZWRpYURldGFjaGVkJyxcbiAgLy8gZmlyZWQgd2hlbiB3ZSBidWZmZXIgaXMgZ29pbmcgdG8gYmUgcmVzZXR0ZWRcbiAgQlVGRkVSX1JFU0VUOiAnaGxzQnVmZmVyUmVzZXQnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGtub3cgYWJvdXQgdGhlIGNvZGVjcyB0aGF0IHdlIG5lZWQgYnVmZmVycyBmb3IgdG8gcHVzaCBpbnRvIC0gZGF0YToge3RyYWNrcyA6IHsgY29udGFpbmVyLCBjb2RlYywgbGV2ZWxDb2RlYywgaW5pdFNlZ21lbnQsIG1ldGFkYXRhIH19XG4gIEJVRkZFUl9DT0RFQ1M6ICdobHNCdWZmZXJDb2RlY3MnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGFwcGVuZCBhIHNlZ21lbnQgdG8gdGhlIGJ1ZmZlciAtIGRhdGE6IHsgc2VnbWVudDogc2VnbWVudCBvYmplY3QgfVxuICBCVUZGRVJfQVBQRU5ESU5HOiAnaGxzQnVmZmVyQXBwZW5kaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiB3ZSBhcmUgZG9uZSB3aXRoIGFwcGVuZGluZyBhIG1lZGlhIHNlZ21lbnQgdG8gdGhlIGJ1ZmZlclxuICBCVUZGRVJfQVBQRU5ERUQ6ICdobHNCdWZmZXJBcHBlbmRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIHN0cmVhbSBpcyBmaW5pc2hlZCBhbmQgd2Ugd2FudCB0byBub3RpZnkgdGhlIG1lZGlhIGJ1ZmZlciB0aGF0IHRoZXJlIHdpbGwgYmUgbm8gbW9yZSBkYXRhXG4gIEJVRkZFUl9FT1M6ICdobHNCdWZmZXJFb3MnLFxuICAvLyBmaXJlZCB3aGVuIHRoZSBtZWRpYSBidWZmZXIgc2hvdWxkIGJlIGZsdXNoZWQgLSBkYXRhIHtzdGFydE9mZnNldCwgZW5kT2Zmc2V0fVxuICBCVUZGRVJfRkxVU0hJTkc6ICdobHNCdWZmZXJGbHVzaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIG1lZGlhIGhhcyBiZWVuIGZsdXNoZWRcbiAgQlVGRkVSX0ZMVVNIRUQ6ICdobHNCdWZmZXJGbHVzaGVkJyxcbiAgLy8gZmlyZWQgdG8gc2lnbmFsIHRoYXQgYSBtYW5pZmVzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbWFuaWZlc3RVUkx9XG4gIE1BTklGRVNUX0xPQURJTkc6ICdobHNNYW5pZmVzdExvYWRpbmcnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBsb2FkZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgdXJsIDogbWFuaWZlc3RVUkwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9fVxuICBNQU5JRkVTVF9MT0FERUQ6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIHBhcnNlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCBmaXJzdExldmVsIDogaW5kZXggb2YgZmlyc3QgcXVhbGl0eSBsZXZlbCBhcHBlYXJpbmcgaW4gTWFuaWZlc3R9XG4gIE1BTklGRVNUX1BBUlNFRDogJ2hsc01hbmlmZXN0UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBsZXZlbCBVUkwgIGxldmVsIDogaWQgb2YgbGV2ZWwgYmVpbmcgbG9hZGVkfVxuICBMRVZFTF9MT0FESU5HOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgZmluaXNoZXMgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIGxvYWRlZCBsZXZlbCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX0gfVxuICBMRVZFTF9MT0FERUQ6ICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIGRldGFpbHMgaGF2ZSBiZWVuIHVwZGF0ZWQgYmFzZWQgb24gcHJldmlvdXMgZGV0YWlscywgYWZ0ZXIgaXQgaGFzIGJlZW4gbG9hZGVkLiAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCB9XG4gIExFVkVMX1VQREFURUQ6ICdobHNMZXZlbFVwZGF0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwncyBQVFMgaW5mb3JtYXRpb24gaGFzIGJlZW4gdXBkYXRlZCBhZnRlciBwYXJzaW5nIGEgZnJhZ21lbnQgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIHVwZGF0ZWQgbGV2ZWwsIGRyaWZ0OiBQVFMgZHJpZnQgb2JzZXJ2ZWQgd2hlbiBwYXJzaW5nIGxhc3QgZnJhZ21lbnQgfVxuICBMRVZFTF9QVFNfVVBEQVRFRDogJ2hsc0xldmVsUHRzVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBzd2l0Y2ggaXMgcmVxdWVzdGVkIC0gZGF0YTogeyBsZXZlbCA6IGlkIG9mIG5ldyBsZXZlbCB9XG4gIExFVkVMX1NXSVRDSDogJ2hsc0xldmVsU3dpdGNoJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURJTkc6ICdobHNGcmFnTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIHByb2dyZXNzaW5nIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCB7IHRyZXF1ZXN0LCB0Zmlyc3QsIGxvYWRlZH19XG4gIEZSQUdfTE9BRF9QUk9HUkVTUzogJ2hsc0ZyYWdMb2FkUHJvZ3Jlc3MnLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIGFib3J0aW5nIGZvciBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gLSBkYXRhOiB7ZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVEOiAnaGxzRnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDogZnJhZ21lbnQgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBGUkFHX0xPQURFRDogJ2hsc0ZyYWdMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIEluaXQgU2VnbWVudCBoYXMgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vdiA6IG1vb3YgTVA0IGJveCwgY29kZWNzIDogY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnR9XG4gIEZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6ICdobHNGcmFnUGFyc2luZ0luaXRTZWdtZW50JyxcbiAgLy8gZmlyZWQgd2hlbiBwYXJzaW5nIHNlaSB0ZXh0IGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgc2VpIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfVVNFUkRBVEE6ICdobHNGcmFnUGFyc2luZ1VzZXJkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBwYXJzaW5nIGlkMyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IHNhbXBsZXMgOiBbIGlkMyBzYW1wbGVzIHBlcyBdIH1cbiAgRlJBR19QQVJTSU5HX01FVEFEQVRBOiAnaGxzRnJhZ1BhcnNpbmdNZXRhZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZGF0YSBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IGRhdGExIDogbW9vZiBNUDQgYm94IG9yIFRTIGZyYWdtZW50cywgZGF0YTIgOiBtZGF0IE1QNCBib3ggb3IgbnVsbH1cbiAgRlJBR19QQVJTSU5HX0RBVEE6ICdobHNGcmFnUGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEOiAnaGxzRnJhZ1BhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEOiAnaGxzRnJhZ0J1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgbWVkaWEgcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEOiAnaGxzRnJhZ0NoYW5nZWQnLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgRlBTIGRyb3AgZXZlbnQgLSBkYXRhOiB7Y3VyZW50RHJvcHBlZCwgY3VycmVudERlY29kZWQsIHRvdGFsRHJvcHBlZEZyYW1lc31cbiAgRlBTX0RST1A6ICdobHNGcHNEcm9wJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYW4gZXJyb3IgZXZlbnQgLSBkYXRhOiB7IHR5cGUgOiBlcnJvciB0eXBlLCBkZXRhaWxzIDogZXJyb3IgZGV0YWlscywgZmF0YWwgOiBpZiB0cnVlLCBobHMuanMgY2Fubm90L3dpbGwgbm90IHRyeSB0byByZWNvdmVyLCBpZiBmYWxzZSwgaGxzLmpzIHdpbGwgdHJ5IHRvIHJlY292ZXIsb3RoZXIgZXJyb3Igc3BlY2lmaWMgZGF0YX1cbiAgRVJST1I6ICdobHNFcnJvcicsXG4gIC8vIGZpcmVkIHdoZW4gaGxzLmpzIGluc3RhbmNlIHN0YXJ0cyBkZXN0cm95aW5nLiBEaWZmZXJlbnQgZnJvbSBNRURJQV9ERVRBQ0hFRCBhcyBvbmUgY291bGQgd2FudCB0byBkZXRhY2ggYW5kIHJlYXR0YWNoIGEgbWVkaWEgdG8gdGhlIGluc3RhbmNlIG9mIGhscy5qcyB0byBoYW5kbGUgbWlkLXJvbGxzIGZvciBleGFtcGxlXG4gIERFU1RST1lJTkc6ICdobHNEZXN0cm95aW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRElORzogJ2hsc0tleUxvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBrZXkgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBLRVlfTE9BREVEOiAnaGxzS2V5TG9hZGVkJyxcbn07XG4iLCIvKipcbiAqIEJ1ZmZlciBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgYnVmZmVyIGxlbmd0aCByZXRyaWV2YWxcbiovXG5cblxuY2xhc3MgQnVmZmVySGVscGVyIHtcblxuICBzdGF0aWMgYnVmZmVySW5mbyhtZWRpYSwgcG9zLG1heEhvbGVEdXJhdGlvbikge1xuICAgIGlmIChtZWRpYSkge1xuICAgICAgdmFyIHZidWZmZXJlZCA9IG1lZGlhLmJ1ZmZlcmVkLCBidWZmZXJlZCA9IFtdLGk7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGJ1ZmZlcmVkLnB1c2goe3N0YXJ0OiB2YnVmZmVyZWQuc3RhcnQoaSksIGVuZDogdmJ1ZmZlcmVkLmVuZChpKX0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge2xlbjogMCwgc3RhcnQ6IDAsIGVuZDogMCwgbmV4dFN0YXJ0IDogdW5kZWZpbmVkfSA7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGJ1ZmZlcmVkSW5mbyhidWZmZXJlZCxwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJMZW4sYnVmZmVyU3RhcnQsIGJ1ZmZlckVuZCxidWZmZXJTdGFydE5leHQsaTtcbiAgICAvLyBzb3J0IG9uIGJ1ZmZlci5zdGFydC9zbWFsbGVyIGVuZCAoSUUgZG9lcyBub3QgYWx3YXlzIHJldHVybiBzb3J0ZWQgYnVmZmVyZWQgcmFuZ2UpXG4gICAgYnVmZmVyZWQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgdmFyIGRpZmYgPSBhLnN0YXJ0IC0gYi5zdGFydDtcbiAgICAgIGlmIChkaWZmKSB7XG4gICAgICAgIHJldHVybiBkaWZmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGIuZW5kIC0gYS5lbmQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gbWF4SG9sZUR1cmF0aW9uIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBidWYybGVuID0gYnVmZmVyZWQyLmxlbmd0aDtcbiAgICAgIGlmKGJ1ZjJsZW4pIHtcbiAgICAgICAgdmFyIGJ1ZjJlbmQgPSBidWZmZXJlZDJbYnVmMmxlbiAtIDFdLmVuZDtcbiAgICAgICAgLy8gaWYgc21hbGwgaG9sZSAodmFsdWUgYmV0d2VlbiAwIG9yIG1heEhvbGVEdXJhdGlvbiApIG9yIG92ZXJsYXBwaW5nIChuZWdhdGl2ZSlcbiAgICAgICAgaWYoKGJ1ZmZlcmVkW2ldLnN0YXJ0IC0gYnVmMmVuZCkgPCBtYXhIb2xlRHVyYXRpb24pIHtcbiAgICAgICAgICAvLyBtZXJnZSBvdmVybGFwcGluZyB0aW1lIHJhbmdlc1xuICAgICAgICAgIC8vIHVwZGF0ZSBsYXN0UmFuZ2UuZW5kIG9ubHkgaWYgc21hbGxlciB0aGFuIGl0ZW0uZW5kXG4gICAgICAgICAgLy8gZS5nLiAgWyAxLCAxNV0gd2l0aCAgWyAyLDhdID0+IFsgMSwxNV0gKG5vIG5lZWQgdG8gbW9kaWZ5IGxhc3RSYW5nZS5lbmQpXG4gICAgICAgICAgLy8gd2hlcmVhcyBbIDEsIDhdIHdpdGggIFsgMiwxNV0gPT4gWyAxLDE1XSAoIGxhc3RSYW5nZSBzaG91bGQgc3dpdGNoIGZyb20gWzEsOF0gdG8gWzEsMTVdKVxuICAgICAgICAgIGlmKGJ1ZmZlcmVkW2ldLmVuZCA+IGJ1ZjJlbmQpIHtcbiAgICAgICAgICAgIGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kID0gYnVmZmVyZWRbaV0uZW5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBiaWcgaG9sZVxuICAgICAgICAgIGJ1ZmZlcmVkMi5wdXNoKGJ1ZmZlcmVkW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZmlyc3QgdmFsdWVcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvczsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0YXJ0ID0gIGJ1ZmZlcmVkMltpXS5zdGFydCxcbiAgICAgICAgICBlbmQgPSBidWZmZXJlZDJbaV0uZW5kO1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPj0gc3RhcnQgJiYgcG9zIDwgZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IHN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBlbmQ7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH0gZWxzZSBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPCBzdGFydCkge1xuICAgICAgICBidWZmZXJTdGFydE5leHQgPSBzdGFydDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXHQvLyBpZiggYnVmZmVyU3RhcnQgPT0gYnVmZmVyRW5kICYmIGJ1ZmZlckVuZCAhPSAwKSB7IGRlYnVnZ2VyOyB9XG4gICAgcmV0dXJuIHtsZW46IGJ1ZmZlckxlbiwgc3RhcnQ6IGJ1ZmZlclN0YXJ0LCBlbmQ6IGJ1ZmZlckVuZCwgbmV4dFN0YXJ0IDogYnVmZmVyU3RhcnROZXh0fTtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckhlbHBlcjtcbiIsIi8qKlxuICogTGV2ZWwgSGVscGVyIGNsYXNzLCBwcm92aWRpbmcgbWV0aG9kcyBkZWFsaW5nIHdpdGggcGxheWxpc3Qgc2xpZGluZyBhbmQgZHJpZnRcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBMZXZlbEhlbHBlciB7XG5cbiAgc3RhdGljIG1lcmdlRGV0YWlscyhvbGREZXRhaWxzLG5ld0RldGFpbHMpIHtcbiAgICB2YXIgc3RhcnQgPSBNYXRoLm1heChvbGREZXRhaWxzLnN0YXJ0U04sbmV3RGV0YWlscy5zdGFydFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGVuZCA9IE1hdGgubWluKG9sZERldGFpbHMuZW5kU04sbmV3RGV0YWlscy5lbmRTTiktbmV3RGV0YWlscy5zdGFydFNOLFxuICAgICAgICBkZWx0YSA9IG5ld0RldGFpbHMuc3RhcnRTTiAtIG9sZERldGFpbHMuc3RhcnRTTixcbiAgICAgICAgb2xkZnJhZ21lbnRzID0gb2xkRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIG5ld2ZyYWdtZW50cyA9IG5ld0RldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICBjY09mZnNldCA9MCxcbiAgICAgICAgUFRTRnJhZztcblxuICAgIC8vIGNoZWNrIGlmIG9sZC9uZXcgcGxheWxpc3RzIGhhdmUgZnJhZ21lbnRzIGluIGNvbW1vblxuICAgIGlmICggZW5kIDwgc3RhcnQpIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gbG9vcCB0aHJvdWdoIG92ZXJsYXBwaW5nIFNOIGFuZCB1cGRhdGUgc3RhcnRQVFMgLCBjYywgYW5kIGR1cmF0aW9uIGlmIGFueSBmb3VuZFxuICAgIGZvcih2YXIgaSA9IHN0YXJ0IDsgaSA8PSBlbmQgOyBpKyspIHtcbiAgICAgIHZhciBvbGRGcmFnID0gb2xkZnJhZ21lbnRzW2RlbHRhK2ldLFxuICAgICAgICAgIG5ld0ZyYWcgPSBuZXdmcmFnbWVudHNbaV07XG4gICAgICBjY09mZnNldCA9IG9sZEZyYWcuY2MgLSBuZXdGcmFnLmNjO1xuICAgICAgaWYgKCFpc05hTihvbGRGcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgICBuZXdGcmFnLnN0YXJ0ID0gbmV3RnJhZy5zdGFydFBUUyA9IG9sZEZyYWcuc3RhcnRQVFM7XG4gICAgICAgIG5ld0ZyYWcuZW5kUFRTID0gb2xkRnJhZy5lbmRQVFM7XG4gICAgICAgIG5ld0ZyYWcuZHVyYXRpb24gPSBvbGRGcmFnLmR1cmF0aW9uO1xuICAgICAgICBQVFNGcmFnID0gbmV3RnJhZztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihjY09mZnNldCkge1xuICAgICAgbG9nZ2VyLmxvZyhgZGlzY29udGludWl0eSBzbGlkaW5nIGZyb20gcGxheWxpc3QsIHRha2UgZHJpZnQgaW50byBhY2NvdW50YCk7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uY2MgKz0gY2NPZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaWYgYXQgbGVhc3Qgb25lIGZyYWdtZW50IGNvbnRhaW5zIFBUUyBpbmZvLCByZWNvbXB1dGUgUFRTIGluZm9ybWF0aW9uIGZvciBhbGwgZnJhZ21lbnRzXG4gICAgaWYoUFRTRnJhZykge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlRnJhZ1BUUyhuZXdEZXRhaWxzLFBUU0ZyYWcuc24sUFRTRnJhZy5zdGFydFBUUyxQVFNGcmFnLmVuZFBUUyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGFkanVzdCBzdGFydCBieSBzbGlkaW5nIG9mZnNldFxuICAgICAgdmFyIHNsaWRpbmcgPSBvbGRmcmFnbWVudHNbZGVsdGFdLnN0YXJ0O1xuICAgICAgZm9yKGkgPSAwIDsgaSA8IG5ld2ZyYWdtZW50cy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgbmV3ZnJhZ21lbnRzW2ldLnN0YXJ0ICs9IHNsaWRpbmc7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHdlIGFyZSBoZXJlLCBpdCBtZWFucyB3ZSBoYXZlIGZyYWdtZW50cyBvdmVybGFwcGluZyBiZXR3ZWVuXG4gICAgLy8gb2xkIGFuZCBuZXcgbGV2ZWwuIHJlbGlhYmxlIFBUUyBpbmZvIGlzIHRodXMgcmVseWluZyBvbiBvbGQgbGV2ZWxcbiAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gb2xkRGV0YWlscy5QVFNLbm93bjtcbiAgICByZXR1cm47XG4gIH1cblxuICBzdGF0aWMgdXBkYXRlRnJhZ1BUUyhkZXRhaWxzLHNuLHN0YXJ0UFRTLGVuZFBUUykge1xuICAgIHZhciBmcmFnSWR4LCBmcmFnbWVudHMsIGZyYWcsIGk7XG4gICAgLy8gZXhpdCBpZiBzbiBvdXQgb2YgcmFuZ2VcbiAgICBpZiAoc24gPCBkZXRhaWxzLnN0YXJ0U04gfHwgc24gPiBkZXRhaWxzLmVuZFNOKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgZnJhZ0lkeCA9IHNuIC0gZGV0YWlscy5zdGFydFNOO1xuICAgIGZyYWdtZW50cyA9IGRldGFpbHMuZnJhZ21lbnRzO1xuICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeF07XG5cblx0dmFyIHByZXZGcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHggLSAxXTtcblx0dmFyIG5leHRGcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHggKyAxXTtcblxuICAgIGlmKCFpc05hTihmcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgc3RhcnRQVFMgPSBNYXRoLm1pbihzdGFydFBUUyxmcmFnLnN0YXJ0UFRTKTtcbiAgICAgIGVuZFBUUyA9IE1hdGgubWF4KGVuZFBUUywgZnJhZy5lbmRQVFMpO1xuICAgIH1cblxuXHRpZiggcHJldkZyYWcgJiYgTWF0aC5hYnMocHJldkZyYWcuc3RhcnQgLSBzdGFydFBUUykgPiAxMDApIHtcblx0XHRzdGFydFBUUyA9IHByZXZGcmFnLnN0YXJ0ICsgcHJldkZyYWcuZHVyYXRpb247XG5cdFx0Ly8gaWYgKGZyYWcuZHVyYXRpb24gPiAxMDApIGRlYnVnZ2VyO1xuXHRcdGVuZFBUUyA9IHN0YXJ0UFRTICsgZnJhZy5kdXJhdGlvbjtcblx0XHRjb25zb2xlLmluZm8oZnJhZy5zbiArICc6ICAnICsgc3RhcnRQVFMgKyAnIC0+ICcgKyBlbmRQVFMgKyAnIHwgJyArIGZyYWcuZHVyYXRpb24pO1xuXHRcdC8vIGRlYnVnZ2VyO1xuXHR9IGVsc2UgaWYoIG5leHRGcmFnICYmIE1hdGguYWJzKG5leHRGcmFnLnN0YXJ0IC0gc3RhcnRQVFMpID4gMTAwKSB7XG5cdFx0Ly8gc3RhcnRQVFMgPSBuZXh0RnJhZy5zdGFydCArIG5leHRGcmFnLmR1cmF0aW9uO1xuXHRcdC8vIGVuZFBUUyA9IHN0YXJ0UFRTICsgZnJhZy5kdXJhdGlvbjtcblx0XHQvLyBjb25zb2xlLmxvZyhmcmFnLnNuICsgJzogICcgKyBzdGFydFBUUyArICcgLT4gJyArIGVuZFBUUyArICcgfCAnICsgZnJhZy5kdXJhdGlvbik7XG5cdFx0Ly8gZGVidWdnZXI7XG5cdH1cblxuICAgaWYoIE1hdGguYWJzKHN0YXJ0UFRTIC0gZW5kUFRTKSA+IDEwMCkge1xuXHQgICAvLyB2YXIgb2xkRW5kUFRTID0gZW5kUFRTO1xuXHQgICBlbmRQVFMgPSBzdGFydFBUUyArIGZyYWcuZHVyYXRpb247XG5cdCAgIC8vIGNvbnNvbGUuaW5mbygnYWRqdXN0aW5nIGVuZFBUUzogJyArIG9sZEVuZFBUUyArICcgLT4gJyArIGVuZFBUUyk7XG4gICB9XG5cbiAgICB2YXIgZHJpZnQgPSBzdGFydFBUUyAtIGZyYWcuc3RhcnQ7XG5cbiAgICBmcmFnLnN0YXJ0ID0gZnJhZy5zdGFydFBUUyA9IHN0YXJ0UFRTO1xuICAgIGZyYWcuZW5kUFRTID0gZW5kUFRTO1xuICAgIGZyYWcuZHVyYXRpb24gPSBlbmRQVFMgLSBzdGFydFBUUztcblxuXHQvLyBpZiAoZnJhZy5kdXJhdGlvbiA+IDEwMCkgZGVidWdnZXI7XG5cdFxuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0tMSB0byBmcmFnIDBcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpID4gMCA7IGktLSkge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGktMSk7XG4gICAgfVxuXG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bSB0byBsYXN0IGZyYWdcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpIDwgZnJhZ21lbnRzLmxlbmd0aCAtIDEgOyBpKyspIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpKzEpO1xuICAgIH1cbiAgICBkZXRhaWxzLlBUU0tub3duID0gdHJ1ZTtcbiAgICAvL2xvZ2dlci5sb2coYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhZyBzdGFydC9lbmQ6JHtzdGFydFBUUy50b0ZpeGVkKDMpfS8ke2VuZFBUUy50b0ZpeGVkKDMpfWApO1xuXG4gICAgcmV0dXJuIGRyaWZ0O1xuICB9XG5cbiAgc3RhdGljIHVwZGF0ZVBUUyhmcmFnbWVudHMsZnJvbUlkeCwgdG9JZHgpIHtcbiAgICB2YXIgZnJhZ0Zyb20gPSBmcmFnbWVudHNbZnJvbUlkeF0sZnJhZ1RvID0gZnJhZ21lbnRzW3RvSWR4XSwgZnJhZ1RvUFRTID0gZnJhZ1RvLnN0YXJ0UFRTO1xuICAgIC8vIGlmIHdlIGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgaWYoIWlzTmFOKGZyYWdUb1BUUykpIHtcbiAgICAgIC8vIHVwZGF0ZSBmcmFnbWVudCBkdXJhdGlvbi5cbiAgICAgIC8vIGl0IGhlbHBzIHRvIGZpeCBkcmlmdHMgYmV0d2VlbiBwbGF5bGlzdCByZXBvcnRlZCBkdXJhdGlvbiBhbmQgZnJhZ21lbnQgcmVhbCBkdXJhdGlvblxuICAgICAgaWYgKHRvSWR4ID4gZnJvbUlkeCkge1xuICAgICAgICBmcmFnRnJvbS5kdXJhdGlvbiA9IGZyYWdUb1BUUy1mcmFnRnJvbS5zdGFydDtcbiAgICAgICAgaWYoZnJhZ0Zyb20uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgZnJhZyAke2ZyYWdGcm9tLnNufSxsZXZlbCAke2ZyYWdGcm9tLmxldmVsfSwgdGhlcmUgc2hvdWxkIGJlIHNvbWUgZHVyYXRpb24gZHJpZnQgYmV0d2VlbiBwbGF5bGlzdCBhbmQgZnJhZ21lbnQhYCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5kdXJhdGlvbiA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvUFRTO1xuICAgICAgICBpZihmcmFnVG8uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgZnJhZyAke2ZyYWdUby5zbn0sbGV2ZWwgJHtmcmFnVG8ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyB3ZSBkb250IGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0ICsgZnJhZ0Zyb20uZHVyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uc3RhcnQgPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUby5kdXJhdGlvbjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxIZWxwZXI7XG4iLCIvKipcbiAqIEhMUyBpbnRlcmZhY2VcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEZyYWdtZW50TG9hZGVyIGZyb20gJy4vbG9hZGVyL2ZyYWdtZW50LWxvYWRlcic7XG5pbXBvcnQgQWJyQ29udHJvbGxlciBmcm9tICAgICcuL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXInO1xuaW1wb3J0IEJ1ZmZlckNvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgQ2FwTGV2ZWxDb250cm9sbGVyIGZyb20gICcuL2NvbnRyb2xsZXIvY2FwLWxldmVsLWNvbnRyb2xsZXInO1xuaW1wb3J0IFN0cmVhbUNvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9zdHJlYW0tY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyIGZyb20gICcuL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQgVGltZWxpbmVDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci90aW1lbGluZS1jb250cm9sbGVyJztcbi8vaW1wb3J0IEZQU0NvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL2Zwcy1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLCBlbmFibGVMb2dzfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgWGhyTG9hZGVyIGZyb20gJy4vdXRpbHMveGhyLWxvYWRlcic7XG5pbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgS2V5TG9hZGVyIGZyb20gJy4vbG9hZGVyL2tleS1sb2FkZXInO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiB3aW5kb3cuTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQ7IGNvZGVjcz1cImF2YzEuNDJFMDFFLG1wNGEuNDAuMlwiJykpO1xuICB9XG5cbiAgc3RhdGljIGdldCBFdmVudHMoKSB7XG4gICAgcmV0dXJuIEV2ZW50O1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvclR5cGVzKCkge1xuICAgIHJldHVybiBFcnJvclR5cGVzO1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvckRldGFpbHMoKSB7XG4gICAgcmV0dXJuIEVycm9yRGV0YWlscztcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRGVmYXVsdENvbmZpZygpIHtcbiAgICBpZighSGxzLmRlZmF1bHRDb25maWcpIHtcbiAgICAgICBIbHMuZGVmYXVsdENvbmZpZyA9IHtcbiAgICAgICAgICBhdXRvU3RhcnRMb2FkOiB0cnVlLFxuICAgICAgICAgIGRlYnVnOiB0cnVlLFxuICAgICAgICAgIGNhcExldmVsVG9QbGF5ZXJTaXplOiBmYWxzZSxcbiAgICAgICAgICBtYXhCdWZmZXJMZW5ndGg6IDMwLFxuICAgICAgICAgIG1heEJ1ZmZlclNpemU6IDYwICogMTAwMCAqIDEwMDAsXG4gICAgICAgICAgbWF4QnVmZmVySG9sZTogNSxcbiAgICAgICAgICBtYXhTZWVrSG9sZTogMixcbiAgICAgICAgICBtYXhGcmFnTG9va1VwVG9sZXJhbmNlIDogMC4yLFxuICAgICAgICAgIGxpdmVTeW5jRHVyYXRpb25Db3VudDozLFxuICAgICAgICAgIGxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudDogSW5maW5pdHksXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgIGxpdmVNYXhMYXRlbmN5RHVyYXRpb246IHVuZGVmaW5lZCxcbiAgICAgICAgICBtYXhNYXhCdWZmZXJMZW5ndGg6IDYwMCxcbiAgICAgICAgICBlbmFibGVXb3JrZXI6IHRydWUsXG4gICAgICAgICAgZW5hYmxlU29mdHdhcmVBRVM6IHRydWUsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nVGltZU91dDogMTAwMDAsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk6IDEsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdNYXhSZXRyeTogNCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGZyYWdMb2FkaW5nVGltZU91dDogMjAwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeTogMjAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDogMyxcbiAgICAgICAgICBzdGFydEZyYWdQcmVmZXRjaCA6IGZhbHNlLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nUGVyaW9kOiA1MDAwLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nVGhyZXNob2xkOiAwLjIsXG4gICAgICAgICAgYXBwZW5kRXJyb3JNYXhSZXRyeTogMyxcbiAgICAgICAgICBsb2FkZXI6IFhockxvYWRlcixcbiAgICAgICAgICBmTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgcExvYWRlcjogdW5kZWZpbmVkLFxuICAgICAgICAgIGFickNvbnRyb2xsZXIgOiBBYnJDb250cm9sbGVyLFxuICAgICAgICAgIGJ1ZmZlckNvbnRyb2xsZXIgOiBCdWZmZXJDb250cm9sbGVyLFxuICAgICAgICAgIGNhcExldmVsQ29udHJvbGxlciA6IENhcExldmVsQ29udHJvbGxlcixcbiAgICAgICAgICBzdHJlYW1Db250cm9sbGVyOiBTdHJlYW1Db250cm9sbGVyLFxuICAgICAgICAgIHRpbWVsaW5lQ29udHJvbGxlcjogVGltZWxpbmVDb250cm9sbGVyLFxuICAgICAgICAgIGVuYWJsZUNFQTcwOENhcHRpb25zOiB0cnVlLFxuICAgICAgICAgIGVuYWJsZU1QMlRQYXNzVGhyb3VnaCA6IGZhbHNlXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBIbHMuZGVmYXVsdENvbmZpZztcbiAgfVxuXG4gIHN0YXRpYyBzZXQgRGVmYXVsdENvbmZpZyhkZWZhdWx0Q29uZmlnKSB7XG4gICAgSGxzLmRlZmF1bHRDb25maWcgPSBkZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICB2YXIgZGVmYXVsdENvbmZpZyA9IEhscy5EZWZhdWx0Q29uZmlnO1xuXG4gICAgaWYgKChjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50IHx8IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQpICYmIChjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBkb25cXCd0IG1peCB1cCBsaXZlU3luY0R1cmF0aW9uQ291bnQvbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IGFuZCBsaXZlU3luY0R1cmF0aW9uL2xpdmVNYXhMYXRlbmN5RHVyYXRpb24nKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGRlZmF1bHRDb25maWcpIHtcbiAgICAgICAgaWYgKHByb3AgaW4gY29uZmlnKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgIGNvbmZpZ1twcm9wXSA9IGRlZmF1bHRDb25maWdbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgIT09IHVuZGVmaW5lZCAmJiBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IDw9IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBcImxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudFwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uQ291bnRcIicpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvblwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uXCInKTtcbiAgICB9XG5cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG5cbiAgICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy50cmlnZ2VyID0gb2JzZXJ2ZXIudHJpZ2dlci5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYWJyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmJ1ZmZlckNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmNhcExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnN0cmVhbUNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnRpbWVsaW5lQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmtleUxvYWRlciA9IG5ldyBLZXlMb2FkZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVzdHJveScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5ERVNUUk9ZSU5HKTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMua2V5TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIHRoaXMub2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hNZWRpYShtZWRpYSkge1xuICAgIGxvZ2dlci5sb2coJ2F0dGFjaE1lZGlhJyk7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHttZWRpYTogbWVkaWF9KTtcbiAgfVxuXG4gIGRldGFjaE1lZGlhKCkge1xuICAgIGxvZ2dlci5sb2coJ2RldGFjaE1lZGlhJyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSElORyk7XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gIH1cblxuICBsb2FkU291cmNlKHVybCwgY3JlZHMpIHtcbiAgICBsb2dnZXIubG9nKGBsb2FkU291cmNlOiR7dXJsfWApO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywge3VybDogdXJsLCBjcmVkczogY3JlZHN9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZChzdGFydFBvc2l0aW9uPTApIHtcbiAgICBsb2dnZXIubG9nKCdzdGFydExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExvYWQoKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb24pO1xuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RvcExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3dhcEF1ZGlvQ29kZWMnKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3dhcEF1ZGlvQ29kZWMoKTtcbiAgfVxuXG4gIHJlY292ZXJNZWRpYUVycm9yKCkge1xuICAgIGxvZ2dlci5sb2coJ3JlY292ZXJNZWRpYUVycm9yJyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5hdHRhY2hNZWRpYShtZWRpYSk7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgY3VycmVudExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sb2FkTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gbmV4dCBwbGF5YmFjayBxdWFsaXR5IGxldmVsIChxdWFsaXR5IGxldmVsIG9mIG5leHQgZnJhZ21lbnQpICoqL1xuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbmV4dExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IG5leHRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBsb2FkTGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIHNldCBuZXh0TG9hZExldmVsKGxldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGZpcnN0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBzdGFydExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiLy8gVGhpcyBpcyBtb3N0bHkgZm9yIHN1cHBvcnQgb2YgdGhlIGVzNiBtb2R1bGUgZXhwb3J0XG4vLyBzeW50YXggd2l0aCB0aGUgYmFiZWwgY29tcGlsZXIsIGl0IGxvb2tzIGxpa2UgaXQgZG9lc250IHN1cHBvcnRcbi8vIGZ1bmN0aW9uIGV4cG9ydHMgbGlrZSB3ZSBhcmUgdXNlZCB0byBpbiBub2RlL2NvbW1vbmpzXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vaGxzLmpzJykuZGVmYXVsdDtcblxuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEZyYWdtZW50TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgZGF0YS5jcmVkcywgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIDEsIDAsIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIERlY3J5cHQga2V5IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEtleUxvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5LRVlfTE9BRElORyk7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gbnVsbDtcbiAgICB0aGlzLmRlY3J5cHR1cmwgPSBudWxsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbktleUxvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnID0gZGF0YS5mcmFnLFxuICAgICAgICBkZWNyeXB0ZGF0YSA9IGZyYWcuZGVjcnlwdGRhdGEsXG4gICAgICAgIHVyaSA9IGRlY3J5cHRkYXRhLnVyaTtcbiAgICAgICAgLy8gaWYgdXJpIGlzIGRpZmZlcmVudCBmcm9tIHByZXZpb3VzIG9uZSBvciBpZiBkZWNyeXB0IGtleSBub3QgcmV0cmlldmVkIHlldFxuICAgICAgaWYgKHVyaSAhPT0gdGhpcy5kZWNyeXB0dXJsIHx8IHRoaXMuZGVjcnlwdGtleSA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgICAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICAgICAgdGhpcy5kZWNyeXB0dXJsID0gdXJpO1xuICAgICAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgICAgICBmcmFnLmxvYWRlci5sb2FkKHVyaSwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5kZWNyeXB0a2V5KSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbG9hZGVkIHRoaXMga2V5LCByZXR1cm4gaXRcbiAgICAgICAgZGVjcnlwdGRhdGEua2V5ID0gdGhpcy5kZWNyeXB0a2V5O1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICB9XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IGZyYWcuZGVjcnlwdGRhdGEua2V5ID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZSk7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICBmcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcblxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEtleUxvYWRlcjtcbiIsIi8qKlxuICogUGxheWxpc3QgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBVUkxIZWxwZXIgZnJvbSAnLi4vdXRpbHMvdXJsJztcbmltcG9ydCBBdHRyTGlzdCBmcm9tICcuLi91dGlscy9hdHRyLWxpc3QnO1xuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgUGxheWxpc3RMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5MRVZFTF9MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG5cdHRoaXMudG90YWxEdXJhdGlvbiA9IDA7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhkYXRhKSB7XG5cdHRoaXMuY3JlZHMgPSBkYXRhLmNyZWRzO1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgbnVsbCk7XG4gIH1cblxuICBvbkxldmVsTG9hZGluZyhkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBkYXRhLmxldmVsLCBkYXRhLmlkKTtcblx0dGhpcy50b3RhbER1cmF0aW9uID0gZGF0YS50b3RhbER1cmF0aW9uIHx8IDA7XG4gIH1cblxuICBsb2FkKHVybCwgaWQxLCBpZDIpIHtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnLFxuICAgICAgICByZXRyeSxcbiAgICAgICAgdGltZW91dCxcbiAgICAgICAgcmV0cnlEZWxheTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gaWQxO1xuICAgIHRoaXMuaWQyID0gaWQyO1xuICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXRyeSA9IGNvbmZpZy5sZXZlbExvYWRpbmdNYXhSZXRyeTtcbiAgICAgIHRpbWVvdXQgPSBjb25maWcubGV2ZWxMb2FkaW5nVGltZU91dDtcbiAgICAgIHJldHJ5RGVsYXkgPSBjb25maWcubGV2ZWxMb2FkaW5nUmV0cnlEZWxheTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLnBMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcucExvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgdGhpcy5jcmVkcywgJycsIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0LCByZXRyeSwgcmV0cnlEZWxheSk7XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHJldHVybiBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVVSTChiYXNlVXJsLCB1cmwpO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwpIHtcbiAgICBsZXQgbGV2ZWxzID0gW10sIHJlc3VsdDtcblxuICAgIC8vIGh0dHBzOi8vcmVnZXgxMDEuY29tIGlzIHlvdXIgZnJpZW5kXG4gICAgY29uc3QgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSopW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgY29uc3QgbGV2ZWwgPSB7fTtcblxuICAgICAgdmFyIGF0dHJzID0gbGV2ZWwuYXR0cnMgPSBuZXcgQXR0ckxpc3QocmVzdWx0WzFdKTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuXG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGF0dHJzLmRlY2ltYWxSZXNvbHV0aW9uKCdSRVNPTFVUSU9OJyk7XG4gICAgICBpZihyZXNvbHV0aW9uKSB7XG4gICAgICAgIGxldmVsLndpZHRoID0gcmVzb2x1dGlvbi53aWR0aDtcbiAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcmVzb2x1dGlvbi5oZWlnaHQ7XG4gICAgICB9XG4gICAgICBsZXZlbC5iaXRyYXRlID0gYXR0cnMuZGVjaW1hbEludGVnZXIoJ0JBTkRXSURUSCcpO1xuICAgICAgbGV2ZWwubmFtZSA9IGF0dHJzLk5BTUU7XG5cbiAgICAgIHZhciBjb2RlY3MgPSBhdHRycy5DT0RFQ1M7XG4gICAgICBpZihjb2RlY3MpIHtcbiAgICAgICAgY29kZWNzID0gY29kZWNzLnNwbGl0KCcsJyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgY29kZWMgPSBjb2RlY3NbaV07XG4gICAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGxldmVsLnZpZGVvQ29kZWMgPSB0aGlzLmF2YzF0b2F2Y290aShjb2RlYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCwgYXZjZGF0YSA9IGNvZGVjLnNwbGl0KCcuJyk7XG4gICAgaWYgKGF2Y2RhdGEubGVuZ3RoID4gMikge1xuICAgICAgcmVzdWx0ID0gYXZjZGF0YS5zaGlmdCgpICsgJy4nO1xuICAgICAgcmVzdWx0ICs9IHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpO1xuICAgICAgcmVzdWx0ICs9ICgnMDAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGNsb25lT2JqKG9iaikge1xuICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9iaikpO1xuICB9XG5cbiAgcGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgYmFzZXVybCwgaWQpIHtcbiAgICB2YXIgY3VycmVudFNOID0gMCxcbiAgICAgICAgdG90YWxkdXJhdGlvbiA9IDAsXG4gICAgICAgIGxldmVsID0ge3VybDogYmFzZXVybCwgZnJhZ21lbnRzOiBbXSwgbGl2ZTogdHJ1ZSwgc3RhcnRTTjogMH0sXG4gICAgICAgIGxldmVsa2V5ID0ge21ldGhvZCA6IG51bGwsIGtleSA6IG51bGwsIGl2IDogbnVsbCwgdXJpIDogbnVsbH0sXG4gICAgICAgIGNjID0gMCxcbiAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbnVsbCxcbiAgICAgICAgZnJhZyA9IG51bGwsXG4gICAgICAgIHJlc3VsdCxcbiAgICAgICAgcmVnZXhwLFxuICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQsXG4gICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LFxuXHRcdG5leHRUaW1lc3RhbXA7XG5cblx0dmFyIHJlID0gIC8oXFxkKylfXFxkKy50cy87XG5cbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQtWC0oS0VZKTooLiopKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qKFtcXHJcXG5dK1teI3xcXHJcXG5dKyk/KXwoPzojRVhULVgtKEJZVEVSQU5HRSk6KFtcXGRdK1tAW1xcZF0qKV0qW1xcclxcbl0rKFteI3xcXHJcXG5dKyk/fCg/OiNFWFQtWC0oRU5ETElTVCkpfCg/OiNFWFQtWC0oRElTKUNPTlRJTlVJVFkpKXwoPzojRVhULVgtKFBST0dSQU0tREFURS1USU1FKTooLiopKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmVnZXhwLmV4ZWMoc3RyaW5nKSkgIT09IG51bGwpIHtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKSB7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTsgfSk7XG4gICAgICBzd2l0Y2ggKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdESVMnOlxuICAgICAgICAgIGNjKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0JZVEVSQU5HRSc6XG4gICAgICAgICAgdmFyIHBhcmFtcyA9IHJlc3VsdFsxXS5zcGxpdCgnQCcpO1xuICAgICAgICAgIGlmIChwYXJhbXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMF0pICsgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgaWYgKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdJTkYnOlxuICAgICAgICAgIHZhciBkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBpZiAoIWlzTmFOKGR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGZyYWdkZWNyeXB0ZGF0YSxcbiAgICAgICAgICAgICAgICBzbiA9IGN1cnJlbnRTTisrO1xuICAgICAgICAgICAgaWYgKGxldmVsa2V5Lm1ldGhvZCAmJiBsZXZlbGtleS51cmkgJiYgIWxldmVsa2V5Lml2KSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IHRoaXMuY2xvbmVPYmoobGV2ZWxrZXkpO1xuICAgICAgICAgICAgICB2YXIgdWludDhWaWV3ID0gbmV3IFVpbnQ4QXJyYXkoMTYpO1xuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTI7IGkgPCAxNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdWludDhWaWV3W2ldID0gKHNuID4+IDgqKDE1LWkpKSAmIDB4ZmY7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhLml2ID0gdWludDhWaWV3O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gbGV2ZWxrZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgdXJsID0gcmVzdWx0WzJdID8gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCkgOiBudWxsO1xuXG5cdFx0XHR2YXIgbWF0Y2ggPSByZS5leGVjKCB1cmwgKTtcblx0XHRcdHZhciB0aW1lc3RhbXAgPSAobWF0Y2ggJiYgbWF0Y2hbMV0pID8gbWF0Y2hbMV0gOiBudWxsO1xuXG5cdFx0XHQvLyBpZiAodGltZXN0YW1wICYmIG5leHRUaW1lc3RhbXApIHtcblx0XHRcdC8vIFx0dGltZXN0YW1wID0gcGFyc2VJbnQoIHRpbWVzdGFtcCApO1xuXHRcdFx0Ly8gXHRpZiAoIHRpbWVzdGFtcCAtIG5leHRUaW1lc3RhbXAgPiAyMDAwICkge1xuXHRcdFx0Ly8gXHRcdGNvbnNvbGUubG9nKCB0aW1lc3RhbXAgKyAnICcgKyBuZXh0VGltZXN0YW1wICsgJyAnICsgdXJsICk7XG5cdFx0XHQvLyBcdFx0Y2MrKztcblx0XHRcdC8vIFx0fVxuXHRcdFx0Ly8gfVxuXG5cdFx0XHRuZXh0VGltZXN0YW1wID0gdGltZXN0YW1wICsgZHVyYXRpb24qMTAwMDtcblxuICAgICAgICAgICAgZnJhZyA9IHt1cmw6IHVybCwgZHVyYXRpb246IGR1cmF0aW9uLCBzdGFydDogdG90YWxkdXJhdGlvbiwgc246IHNuLCBsZXZlbDogaWQsIGNjOiBjYywgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ6IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LCBieXRlUmFuZ2VFbmRPZmZzZXQ6IGJ5dGVSYW5nZUVuZE9mZnNldCwgZGVjcnlwdGRhdGEgOiBmcmFnZGVjcnlwdGRhdGEsIHByb2dyYW1EYXRlVGltZTogcHJvZ3JhbURhdGVUaW1lfTtcbiAgICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKGZyYWcpO1xuICAgICAgICAgICAgdG90YWxkdXJhdGlvbiArPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdLRVknOlxuICAgICAgICAgIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9kcmFmdC1wYW50b3MtaHR0cC1saXZlLXN0cmVhbWluZy0wOCNzZWN0aW9uLTMuNC40XG4gICAgICAgICAgdmFyIGRlY3J5cHRwYXJhbXMgPSByZXN1bHRbMV07XG4gICAgICAgICAgdmFyIGtleUF0dHJzID0gbmV3IEF0dHJMaXN0KGRlY3J5cHRwYXJhbXMpO1xuICAgICAgICAgIHZhciBkZWNyeXB0bWV0aG9kID0ga2V5QXR0cnMuZW51bWVyYXRlZFN0cmluZygnTUVUSE9EJyksXG4gICAgICAgICAgICAgIGRlY3J5cHR1cmkgPSBrZXlBdHRycy5VUkksXG4gICAgICAgICAgICAgIGRlY3J5cHRpdiA9IGtleUF0dHJzLmhleGFkZWNpbWFsSW50ZWdlcignSVYnKTtcbiAgICAgICAgICBpZiAoZGVjcnlwdG1ldGhvZCkge1xuICAgICAgICAgICAgbGV2ZWxrZXkgPSB7IG1ldGhvZDogbnVsbCwga2V5OiBudWxsLCBpdjogbnVsbCwgdXJpOiBudWxsIH07XG4gICAgICAgICAgICBpZiAoKGRlY3J5cHR1cmkpICYmIChkZWNyeXB0bWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICAgICAgICAgIGxldmVsa2V5Lm1ldGhvZCA9IGRlY3J5cHRtZXRob2Q7XG4gICAgICAgICAgICAgIC8vIFVSSSB0byBnZXQgdGhlIGtleVxuICAgICAgICAgICAgICBsZXZlbGtleS51cmkgPSB0aGlzLnJlc29sdmUoZGVjcnlwdHVyaSwgYmFzZXVybCk7XG4gICAgICAgICAgICAgIGxldmVsa2V5LmtleSA9IG51bGw7XG4gICAgICAgICAgICAgIC8vIEluaXRpYWxpemF0aW9uIFZlY3RvciAoSVYpXG4gICAgICAgICAgICAgIGxldmVsa2V5Lml2ID0gZGVjcnlwdGl2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnUFJPR1JBTS1EQVRFLVRJTUUnOlxuICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG5ldyBEYXRlKERhdGUucGFyc2UocmVzdWx0WzFdKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGlmKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICBsZXZlbC5mcmFnbWVudHMucG9wKCk7XG4gICAgICB0b3RhbGR1cmF0aW9uLT1mcmFnLmR1cmF0aW9uO1xuICAgIH1cbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG5cblx0aWYgKGxldmVsLmxpdmUpIHtcblx0XHR2YXIgZW5kUFRTO1xuXHRcdGZvciAodmFyIGkgaW4gbGV2ZWwuZnJhZ21lbnRzKSB7XG5cdFx0XHR2YXIgZiA9IGxldmVsLmZyYWdtZW50c1tpXTtcblx0XHRcdGYuc3RhcnQgPSBwYXJzZUludCggdGhpcy50b3RhbER1cmF0aW9uICk7XG5cdFx0XHRlbmRQVFMgPSBmLmVuZFBUUztcblx0XHR9XG5cdFx0bGV2ZWwudG90YWxkdXJhdGlvbiA9IGVuZFBUUyA/IGVuZFBUUyA6IGxldmVsLnRvdGFsZHVyYXRpb24gKyB0aGlzLnRvdGFsRHVyYXRpb247XG5cdH1cbiAgICByZXR1cm4gbGV2ZWw7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgdGFyZ2V0ID0gZXZlbnQuY3VycmVudFRhcmdldCxcbiAgICAgICAgc3RyaW5nID0gdGFyZ2V0LnJlc3BvbnNlVGV4dCxcbiAgICAgICAgdXJsID0gdGFyZ2V0LnJlc3BvbnNlVVJMLFxuICAgICAgICBpZCA9IHRoaXMuaWQsXG4gICAgICAgIGlkMiA9IHRoaXMuaWQyLFxuICAgICAgICBobHMgPSB0aGlzLmhscyxcbiAgICAgICAgbGV2ZWxzO1xuICAgIC8vIHJlc3BvbnNlVVJMIG5vdCBzdXBwb3J0ZWQgb24gc29tZSBicm93c2VycyAoaXQgaXMgdXNlZCB0byBkZXRlY3QgVVJMIHJlZGlyZWN0aW9uKVxuICAgIGlmICh1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICBzdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIHN0YXRzLm10aW1lID0gbmV3IERhdGUodGFyZ2V0LmdldFJlc3BvbnNlSGVhZGVyKCdMYXN0LU1vZGlmaWVkJykpO1xuICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVE0zVScpID09PSAwKSB7XG4gICAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRJTkY6JykgPiAwKSB7XG4gICAgICAgIC8vIDEgbGV2ZWwgcGxheWxpc3RcbiAgICAgICAgLy8gaWYgZmlyc3QgcmVxdWVzdCwgZmlyZSBtYW5pZmVzdCBsb2FkZWQgZXZlbnQsIGxldmVsIHdpbGwgYmUgcmVsb2FkZWQgYWZ0ZXJ3YXJkc1xuICAgICAgICAvLyAodGhpcyBpcyB0byBoYXZlIGEgdW5pZm9ybSBsb2dpYyBmb3IgMSBsZXZlbC9tdWx0aWxldmVsIHBsYXlsaXN0cylcbiAgICAgICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IFt7dXJsOiB1cmx9XSwgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBsZXZlbERldGFpbHMgPSB0aGlzLnBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIHVybCwgaWQpO1xuICAgICAgICAgIHN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsIHtkZXRhaWxzOiBsZXZlbERldGFpbHMsIGxldmVsOiBpZCwgaWQ6IGlkMiwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVscyA9IHRoaXMucGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIHVybCk7XG4gICAgICAgIC8vIG11bHRpIGxldmVsIHBsYXlsaXN0LCBwYXJzZSBsZXZlbCBpbmZvXG4gICAgICAgIGlmIChsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBsZXZlbHMsIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBsZXZlbCBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gRVhUTTNVIGRlbGltaXRlcid9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIHJlc3BvbnNlOiBldmVudC5jdXJyZW50VGFyZ2V0LCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCIvKipcbiAqIEdlbmVyYXRlIE1QNCBCb3hcbiovXG5cbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdmlkZW9IZGxyID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcblxuICAgIHZhciBhdWRpb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTMsIDB4NmYsIDB4NzUsIDB4NmUsXG4gICAgICAweDY0LCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOiB2aWRlb0hkbHIsXG4gICAgICAnYXVkaW8nOiBhdWRpb0hkbHJcbiAgICB9O1xuXG4gICAgdmFyIGRyZWYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG5cbiAgICB2YXIgc3RjbyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG5cbiAgICBNUDQuU1RUUyA9IE1QNC5TVFNDID0gTVA0LlNUQ08gPSBzdGNvO1xuXG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5WTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGdyYXBoaWNzbW9kZVxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwIC8vIG9wY29sb3JcbiAgICBdKTtcbiAgICBNUDQuU01IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBiYWxhbmNlXG4gICAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gICAgXSk7XG5cbiAgICBNUDQuU1RTRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTsvLyBlbnRyeV9jb3VudFxuXG4gICAgdmFyIG1ham9yQnJhbmQgPSBuZXcgVWludDhBcnJheShbMTA1LDExNSwxMTEsMTA5XSk7IC8vIGlzb21cbiAgICB2YXIgYXZjMUJyYW5kID0gbmV3IFVpbnQ4QXJyYXkoWzk3LDExOCw5OSw0OV0pOyAvLyBhdmMxXG4gICAgdmFyIG1pbm9yVmVyc2lvbiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIG1ham9yQnJhbmQsIG1pbm9yVmVyc2lvbiwgbWFqb3JCcmFuZCwgYXZjMUJyYW5kKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIGRyZWYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gOCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgbGVuID0gaSxcbiAgICByZXN1bHQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgcmVzdWx0WzBdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgICByZXN1bHRbMV0gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIHJlc3VsdFsyXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgICByZXN1bHRbM10gPSBzaXplICAmIDB4ZmY7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcbiAgICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICAgIGZvciAoaSA9IDAsIHNpemUgPSA4OyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIC8vIGNvcHkgcGF5bG9hZFtpXSBhcnJheSBAIG9mZnNldCBzaXplXG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsIGR1cmF0aW9uKSB7XG4gICAgZHVyYXRpb24gKj0gdGltZXNjYWxlO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4NTUsIDB4YzQsIC8vICd1bmQnIGxhbmd1YWdlICh1bmRldGVybWluZWQpXG4gICAgICAweDAwLCAweDAwXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1kaWEodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRpYSwgTVA0Lm1kaGQodHJhY2sudGltZXNjYWxlLCB0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLCBNUDQubWZoZChzbiksIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0udGltZXNjYWxlLCB0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKHRpbWVzY2FsZSxkdXJhdGlvbikge1xuICAgIGR1cmF0aW9uKj10aW1lc2NhbGU7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsIE1QNC5zdHNkKHRyYWNrKSwgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLCBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSwgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaSwgZGF0YSwgbGVuO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2suc3BzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgc3BzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2sucHBzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgcHBzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTtcbiAgICB9XG5cbiAgICB2YXIgYXZjYyA9IE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsICAgLy8gdmVyc2lvblxuICAgICAgICAgICAgc3BzWzNdLCAvLyBwcm9maWxlXG4gICAgICAgICAgICBzcHNbNF0sIC8vIHByb2ZpbGUgY29tcGF0XG4gICAgICAgICAgICBzcHNbNV0sIC8vIGxldmVsXG4gICAgICAgICAgICAweGZjIHwgMywgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICAgIDB4RTAgfCB0cmFjay5zcHMubGVuZ3RoIC8vIDNiaXQgcmVzZXJ2ZWQgKDExMSkgKyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0uY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIC8vY29uc29sZS5sb2coJ2F2Y2M6JyArIEhleC5oZXhEdW1wKGF2Y2MpKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB3aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICBoZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTIsXG4gICAgICAgIDB4NjQsIDB4NjEsIDB4NjksIDB4NkMsIC8vZGFpbHltb3Rpb24vaGxzLmpzXG4gICAgICAgIDB4NzksIDB4NkQsIDB4NkYsIDB4NzQsXG4gICAgICAgIDB4NjksIDB4NkYsIDB4NkUsIDB4MkYsXG4gICAgICAgIDB4NjgsIDB4NkMsIDB4NzMsIDB4MkUsXG4gICAgICAgIDB4NkEsIDB4NzMsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsICAgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBhdmNjLFxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmJ0cnQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDAsIDB4MWMsIDB4OWMsIDB4ODAsIC8vIGJ1ZmZlclNpemVEQlxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMF0pKSAvLyBhdmdCaXRyYXRlXG4gICAgICAgICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBlc2RzKHRyYWNrKSB7XG4gICAgdmFyIGNvbmZpZ2xlbiA9IHRyYWNrLmNvbmZpZy5sZW5ndGg7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcblxuICAgICAgMHgwMywgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDE3K2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAgIDB4MTUsIC8vIHN0cmVhbV90eXBlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBidWZmZXJfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYXZnQml0cmF0ZVxuXG4gICAgICAweDA1IC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgXS5jb25jYXQoW2NvbmZpZ2xlbl0pLmNvbmNhdCh0cmFjay5jb25maWcpLmNvbmNhdChbMHgwNiwgMHgwMSwgMHgwMl0pKTsgLy8gR0FTcGVjaWZpY0NvbmZpZykpOyAvLyBsZW5ndGggKyBhdWRpbyBjb25maWcgZGVzY3JpcHRvclxuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICB2YXIgYXVkaW9zYW1wbGVyYXRlID0gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgdHJhY2suY2hhbm5lbENvdW50LCAvLyBjaGFubmVsY291bnRcbiAgICAgIDB4MDAsIDB4MTAsIC8vIHNhbXBsZVNpemU6MTZiaXRzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgIChhdWRpb3NhbXBsZXJhdGUgPj4gOCkgJiAweEZGLFxuICAgICAgYXVkaW9zYW1wbGVyYXRlICYgMHhmZiwgLy9cbiAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmVzZHMsIE1QNC5lc2RzKHRyYWNrKSkpO1xuICB9XG5cbiAgc3RhdGljIHN0c2QodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNELCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5hdmMxKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHRraGQodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZCxcbiAgICAgICAgZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbip0cmFjay50aW1lc2NhbGUsXG4gICAgICAgIHdpZHRoID0gdHJhY2sud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHRyYWNrLmhlaWdodDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIChpZCA+PiAyNCkgJiAweEZGLFxuICAgICAgKGlkID4+IDE2KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gOCkgJiAweEZGLFxuICAgICAgaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgd2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgaGVpZ2h0ICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkge1xuICAgIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBNUDQuc2R0cCh0cmFjayksXG4gICAgICAgIGlkID0gdHJhY2suaWQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWYsXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoaWQgPj4gMjQpLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+MjQpLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LnRydW4odHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmR0XG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gdHJhZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gbW9vZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgOCksICAvLyBtZGF0IGhlYWRlclxuICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIHRyYWNrIGJveC5cbiAgICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IGEgdHJhY2sgZGVmaW5pdGlvblxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gICAqL1xuICBzdGF0aWMgdHJhayh0cmFjaykge1xuICAgIHRyYWNrLmR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24gfHwgMHhmZmZmZmZmZjtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhaywgTVA0LnRraGQodHJhY2spLCBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAoaWQgPj4gMjQpLFxuICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgKGlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXM9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICAgIGxlbiA9IHNhbXBsZXMubGVuZ3RoLFxuICAgICAgICBhcnJheWxlbiA9IDEyICsgKDE2ICogbGVuKSxcbiAgICAgICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheWxlbiksXG4gICAgICAgIGksc2FtcGxlLGR1cmF0aW9uLHNpemUsZmxhZ3MsY3RzO1xuICAgIG9mZnNldCArPSA4ICsgYXJyYXlsZW47XG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChsZW4gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiAxNikgJiAweEZGLFxuICAgICAgKGxlbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgbGVuICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdLDApO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGR1cmF0aW9uID0gc2FtcGxlLmR1cmF0aW9uO1xuICAgICAgc2l6ZSA9IHNhbXBsZS5zaXplO1xuICAgICAgZmxhZ3MgPSBzYW1wbGUuZmxhZ3M7XG4gICAgICBjdHMgPSBzYW1wbGUuY3RzO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKGR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKGZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgZmxhZ3MuaXNOb25TeW5jLFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHhGMCA8PCA4LFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChjdHMgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDgpICYgMHhGRixcbiAgICAgICAgY3RzICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG4gICAgaWYgKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhciBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksIHJlc3VsdDtcbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG4iLCIvKipcbiAqIGZNUDQgcmVtdXhlclxuKi9cblxuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IE1QNCBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBNUDRSZW11eGVyIHtcbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICAgIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SID0gNDtcbiAgICB0aGlzLlBFU19USU1FU0NBTEUgPSA5MDAwMDtcbiAgICB0aGlzLk1QNF9USU1FU0NBTEUgPSB0aGlzLlBFU19USU1FU0NBTEUgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgfVxuXG4gIGdldCBwYXNzdGhyb3VnaCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHRoaXMubmV4dEFhY1B0cyA9IHRoaXMubmV4dEF2Y0R0cyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHJlbXV4KGF1ZGlvVHJhY2ssdmlkZW9UcmFjayxpZDNUcmFjayx0ZXh0VHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cywgZGF0YSwgdDApIHtcbiAgICAvLyBnZW5lcmF0ZSBJbml0IFNlZ21lbnQgaWYgbmVlZGVkXG4gICAgaWYgKCF0aGlzLklTR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLmdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQsIHQwKTtcblx0fVxuXHRpZiAodGhpcy5JU0dlbmVyYXRlZCkge1xuXHRcdC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuXHRcdGlmICh2aWRlb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG5cdFx0ICB0aGlzLnJlbXV4VmlkZW8odmlkZW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMsIHQwKTtcblx0XHR9XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBBQUMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcblx0XHQgIHRoaXMucmVtdXhBdWRpbyhhdWRpb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cyk7XG5cdFx0fVxuXHRcdC8vbG9nZ2VyLmxvZygnbmIgSUQzIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuXHRcdGlmIChpZDNUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuXHRcdCAgdGhpcy5yZW11eElEMyhpZDNUcmFjayx0aW1lT2Zmc2V0KTtcblx0XHR9XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBJRDMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKHRleHRUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuXHRcdCAgdGhpcy5yZW11eFRleHQodGV4dFRyYWNrLHRpbWVPZmZzZXQpO1xuXHRcdH1cblx0fVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgfVxuXG4gIGdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQsIHQwKSB7XG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlcixcbiAgICAgICAgYXVkaW9TYW1wbGVzID0gYXVkaW9UcmFjay5zYW1wbGVzLFxuICAgICAgICB2aWRlb1NhbXBsZXMgPSB2aWRlb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgdHJhY2tzID0ge30sXG4gICAgICAgIGRhdGEgPSB7IHRyYWNrcyA6IHRyYWNrcywgdW5pcXVlIDogZmFsc2UgfSxcbiAgICAgICAgY29tcHV0ZVBUU0RUUyA9ICh0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpLFxuICAgICAgICBpbml0UFRTLCBpbml0RFRTO1xuXG4gICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgIGluaXRQVFMgPSBpbml0RFRTID0gSW5maW5pdHk7XG4gICAgfVxuICAgIGlmIChhdWRpb1RyYWNrLmNvbmZpZyAmJiBhdWRpb1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdWRpb1RyYWNrLnRpbWVzY2FsZSA9IGF1ZGlvVHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgLy8gTVA0IGR1cmF0aW9uICh0cmFjayBkdXJhdGlvbiBpbiBzZWNvbmRzIG11bHRpcGxpZWQgYnkgdGltZXNjYWxlKSBpcyBjb2RlZCBvbiAzMiBiaXRzXG4gICAgICAvLyB3ZSBrbm93IHRoYXQgZWFjaCBBQUMgc2FtcGxlIGNvbnRhaW5zIDEwMjQgZnJhbWVzLi4uLlxuICAgICAgLy8gaW4gb3JkZXIgdG8gYXZvaWQgb3ZlcmZsb3dpbmcgdGhlIDMyIGJpdCBjb3VudGVyIGZvciBsYXJnZSBkdXJhdGlvbiwgd2UgdXNlIHNtYWxsZXIgdGltZXNjYWxlICh0aW1lc2NhbGUvZ2NkKVxuICAgICAgLy8gd2UganVzdCBuZWVkIHRvIGVuc3VyZSB0aGF0IEFBQyBzYW1wbGUgZHVyYXRpb24gd2lsbCBzdGlsbCBiZSBhbiBpbnRlZ2VyICh3aWxsIGJlIDEwMjQvZ2NkKVxuICAgICAgaWYgKGF1ZGlvVHJhY2sudGltZXNjYWxlICogYXVkaW9UcmFjay5kdXJhdGlvbiA+IE1hdGgucG93KDIsIDMyKSkge1xuICAgICAgICBsZXQgZ3JlYXRlc3RDb21tb25EaXZpc29yID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgaWYgKCAhIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBncmVhdGVzdENvbW1vbkRpdmlzb3IoYiwgYSAlIGIpO1xuICAgICAgICB9O1xuICAgICAgICBhdWRpb1RyYWNrLnRpbWVzY2FsZSA9IGF1ZGlvVHJhY2suYXVkaW9zYW1wbGVyYXRlIC8gZ3JlYXRlc3RDb21tb25EaXZpc29yKGF1ZGlvVHJhY2suYXVkaW9zYW1wbGVyYXRlLDEwMjQpO1xuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZyAoJ2F1ZGlvIG1wNCB0aW1lc2NhbGUgOicrIGF1ZGlvVHJhY2sudGltZXNjYWxlKTtcbiAgICAgIHRyYWNrcy5hdWRpbyA9IHtcbiAgICAgICAgY29udGFpbmVyIDogJ2F1ZGlvL21wNCcsXG4gICAgICAgIGNvZGVjIDogIGF1ZGlvVHJhY2suY29kZWMsXG4gICAgICAgIGluaXRTZWdtZW50IDogTVA0LmluaXRTZWdtZW50KFthdWRpb1RyYWNrXSksXG4gICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgIGNoYW5uZWxDb3VudCA6IGF1ZGlvVHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0LiBmb3IgYXVkaW8sIFBUUyArIERUUyAuLi5cbiAgICAgICAgLy8gaW5pdFBUUyA9IGluaXREVFMgPSBhdWRpb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgaW5pdFBUUyA9IGluaXREVFMgPSB0MCAqIHBlc1RpbWVTY2FsZTtcblx0XHQvLyBpZiAodGltZU9mZnNldCAhPSB0MCkgZGVidWdnZXI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHZpZGVvVHJhY2suc3BzICYmIHZpZGVvVHJhY2sucHBzICYmIHZpZGVvU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHZpZGVvVHJhY2sudGltZXNjYWxlID0gdGhpcy5NUDRfVElNRVNDQUxFO1xuICAgICAgdHJhY2tzLnZpZGVvID0ge1xuICAgICAgICBjb250YWluZXIgOiAndmlkZW8vbXA0JyxcbiAgICAgICAgY29kZWMgOiAgdmlkZW9UcmFjay5jb2RlYyxcbiAgICAgICAgaW5pdFNlZ21lbnQgOiBNUDQuaW5pdFNlZ21lbnQoW3ZpZGVvVHJhY2tdKSxcbiAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgd2lkdGggOiB2aWRlb1RyYWNrLndpZHRoLFxuICAgICAgICAgIGhlaWdodCA6IHZpZGVvVHJhY2suaGVpZ2h0XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgICBpbml0UFRTID0gTWF0aC5taW4oaW5pdFBUUyx2aWRlb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldCk7XG4gICAgICAgIGluaXREVFMgPSBNYXRoLm1pbihpbml0RFRTLHZpZGVvU2FtcGxlc1swXS5kdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZighT2JqZWN0LmtleXModHJhY2tzKSkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ25vIGF1ZGlvL3ZpZGVvIHNhbXBsZXMgZm91bmQnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxkYXRhKTtcbiAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgICAgLy8gdGhpcy5faW5pdFBUUyA9IHQwKnBlc1RpbWVTY2FsZTsvL2luaXRQVFM7XG4gICAgICAgIC8vIHRoaXMuX2luaXREVFMgPSB0MCpwZXNUaW1lU2NhbGU7Ly9pbml0RFRTO1xuXG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSBpbml0UFRTO1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gaW5pdERUUztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZW11eFZpZGVvKHRyYWNrLCB0aW1lT2Zmc2V0LCBjb250aWd1b3VzLCB0MCkge1xuICAgIHZhciBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBtcDRTYW1wbGVEdXJhdGlvbixcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLFxuICAgICAgICBsYXN0UFRTLCBsYXN0RFRTLFxuICAgICAgICBpbnB1dFNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICBvdXRwdXRTYW1wbGVzID0gW107XG5cbiAgLy8gUFRTIGlzIGNvZGVkIG9uIDMzYml0cywgYW5kIGNhbiBsb29wIGZyb20gLTJeMzIgdG8gMl4zMlxuICAvLyBQVFNOb3JtYWxpemUgd2lsbCBtYWtlIFBUUy9EVFMgdmFsdWUgbW9ub3RvbmljLCB3ZSB1c2UgbGFzdCBrbm93biBEVFMgdmFsdWUgYXMgcmVmZXJlbmNlIHZhbHVlXG4gICBsZXQgbmV4dEF2Y0R0cztcbiAgICBpZiAoY29udGlndW91cykge1xuICAgICAgLy8gaWYgcGFyc2VkIGZyYWdtZW50IGlzIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZSwgbGV0J3MgdXNlIGxhc3QgRFRTIHZhbHVlIGFzIHJlZmVyZW5jZVxuICAgICAgbmV4dEF2Y0R0cyA9IHRoaXMubmV4dEF2Y0R0cztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaWYgbm90IGNvbnRpZ3VvdXMsIGxldCdzIHVzZSB0YXJnZXQgdGltZU9mZnNldFxuICAgICAgbmV4dEF2Y0R0cyA9IHQwKnBlc1RpbWVTY2FsZTtcbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGZpcnN0IERUUyBhbmQgbGFzdCBEVFMsIG5vcm1hbGl6ZSB0aGVtIGFnYWluc3QgcmVmZXJlbmNlIHZhbHVlXG4gICAgbGV0IHNhbXBsZSA9IGlucHV0U2FtcGxlc1swXTtcbiAgICAvLyBmaXJzdERUUyA9ICBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLmR0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG4gICAgLy8gZmlyc3RQVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuXG4gICAgZmlyc3REVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuICAgIGZpcnN0UFRTID0gIE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUucHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcblxuXHR2YXIgZmlyc3RTYW1wbGVEVFMgPSBzYW1wbGUuZHRzO1xuXHRmaXJzdFBUUyA9IGZpcnN0RFRTID0gTWF0aC5yb3VuZCh0MCAqIHBlc1RpbWVTY2FsZSk7XG5cdGxvZ2dlci5pbmZvKCAnZmlyc3RQVFMgIzE6ICcgKyBmaXJzdFBUUyApO1xuXG4gICAgLy8gY2hlY2sgdGltZXN0YW1wIGNvbnRpbnVpdHkgYWNjcm9zcyBjb25zZWN1dGl2ZSBmcmFnbWVudHMgKHRoaXMgaXMgdG8gcmVtb3ZlIGludGVyLWZyYWdtZW50IGdhcC9ob2xlKVxuLy8gICAgIGxldCBkZWx0YSA9IE1hdGgucm91bmQoKGZpcnN0RFRTIC0gbmV4dEF2Y0R0cykgLyA5MCk7XG4vL1xuLy8gICAgIC8vIGlmIGZyYWdtZW50IGFyZSBjb250aWd1b3VzLCBvciBkZWx0YSBsZXNzIHRoYW4gNjAwbXMsIGVuc3VyZSB0aGVyZSBpcyBubyBvdmVybGFwL2hvbGUgYmV0d2VlbiBmcmFnbWVudHNcbi8vICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbi8vICAgICAgIGlmIChkZWx0YSkge1xuLy8gICAgICAgICBpZiAoZGVsdGEgPiAxKSB7XG4vLyAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuLy8gICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEpIHtcbi8vICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbi8vICAgICAgICAgfVxuLy8gICAgICAgICAvLyByZW1vdmUgaG9sZS9nYXAgOiBzZXQgRFRTIHRvIG5leHQgZXhwZWN0ZWQgRFRTXG4vLyAgICAgICAgIGZpcnN0RFRTID0gaW5wdXRTYW1wbGVzWzBdLmR0cyA9IG5leHRBdmNEdHM7XG4vLyAgICAgICAgIC8vIG9mZnNldCBQVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgUFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgRFRTXG4vLyAgICAgICAgIGZpcnN0UFRTID0gaW5wdXRTYW1wbGVzWzBdLnB0cyA9IE1hdGgubWF4KGZpcnN0UFRTIC0gZGVsdGEsIG5leHRBdmNEdHMpO1xuLy8gICAgICAgICBsb2dnZXIubG9nKGBWaWRlby9QVFMvRFRTIGFkanVzdGVkOiAke2ZpcnN0UFRTfS8ke2ZpcnN0RFRTfSxkZWx0YToke2RlbHRhfWApO1xuLy8gICAgICAgfVxuLy8gICAgIH1cbi8vIFx0Y29uc29sZS5pbmZvKCAnZmlyc3RQVFMgIzI6ICcgKyBmaXJzdFBUUyApO1xuXG5cdC8vIHNhbXBsZSBkdXJhdGlvbiAoYXMgZXhwZWN0ZWQgYnkgdHJ1biBNUDQgYm94ZXMpLCBzaG91bGQgYmUgdGhlIGRlbHRhIGJldHdlZW4gc2FtcGxlIERUU1xuICAgIC8vIGxldCdzIHNpZ25hbCB0aGUgc2FtZSBzYW1wbGUgZHVyYXRpb24gZm9yIGFsbCBzYW1wbGVzXG4gICAgLy8gc2V0IHRoaXMgY29uc3RhbnQgZHVyYXRpb24gYXMgYmVpbmcgdGhlIGF2ZyBkZWx0YSBiZXR3ZWVuIGNvbnNlY3V0aXZlIERUUy5cbiAgICBzYW1wbGUgPSBpbnB1dFNhbXBsZXNbaW5wdXRTYW1wbGVzLmxlbmd0aC0xXTtcbiAgICBsYXN0RFRTID0gTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuXG5cdGxhc3REVFMgPSAoc2FtcGxlLmR0cyAtIGZpcnN0U2FtcGxlRFRTKSArIGZpcnN0UFRTO1xuICAgIG1wNFNhbXBsZUR1cmF0aW9uID0gTWF0aC5yb3VuZCgobGFzdERUUy1maXJzdERUUykvKHBlczJtcDRTY2FsZUZhY3RvciooaW5wdXRTYW1wbGVzLmxlbmd0aC0xKSkpO1xuXG5cdGlmIChsYXN0RFRTIDw9IGZpcnN0RFRTKSB7XG5cdFx0bGFzdERUUyA9IGZpcnN0RFRTO1xuXHRcdG1wNFNhbXBsZUR1cmF0aW9uID0gMDtcblx0XHRjb25zb2xlLndhcm4oJ2xhc3REVFMgPCBmaXJzdERUUycpO1xuXHR9XG5cdGxvZ2dlci5pbmZvKCAnKCBsYXN0RFRTIC0gZmlyc3REVFMgKSAvIDkwMDAwIDogJyArIChsYXN0RFRTIC0gZmlyc3REVFMpLzkwMDAwKTtcblx0dmFyIG9sZFBUUyA9IGZpcnN0UFRTO1xuXHQvLyBmaXJzdFBUUyA9IGZpcnN0RFRTID0gTWF0aC5yb3VuZCh0MCo5MDAwMCk7XG5cdGxvZ2dlci5pbmZvKCdmaXJzdFBUUzogJyAgKyBvbGRQVFMgKyAnIC0+ICcgKyB0MCo5MDAwMCk7XG5cdGlmICggTWF0aC5hYnMob2xkUFRTIC0gZmlyc3RQVFMpID4gMTAwMDAgKSB7IGNvbnNvbGUud2FybigndGhpcyBjb3VsZCBoYXZlIGNhdXNlZCBhIGZyYWdMb29wIGVycm9yJyk7IH1cblxuXG4gICAgLy8gbm9ybWFsaXplIGFsbCBQVFMvRFRTIG5vdyAuLi5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0U2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHNhbXBsZSA9IGlucHV0U2FtcGxlc1tpXTtcbiAgICAgIC8vIHNhbXBsZSBEVFMgaXMgY29tcHV0ZWQgdXNpbmcgYSBjb25zdGFudCBkZWNvZGluZyBvZmZzZXQgKG1wNFNhbXBsZUR1cmF0aW9uKSBiZXR3ZWVuIHNhbXBsZXNcbiAgICAgIHNhbXBsZS5kdHMgPSBmaXJzdERUUyArIGkqcGVzMm1wNFNjYWxlRmFjdG9yKm1wNFNhbXBsZUR1cmF0aW9uO1xuICAgICAgLy8gd2Ugbm9ybWFsaXplIFBUUyBhZ2FpbnN0IG5leHRBdmNEdHMsIHdlIGFsc28gc3Vic3RyYWN0IGluaXREVFMgKHNvbWUgc3RyZWFtcyBkb24ndCBzdGFydCBAIFBUUyBPKVxuICAgICAgLy8gYW5kIHdlIGVuc3VyZSB0aGF0IGNvbXB1dGVkIHZhbHVlIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBzYW1wbGUgRFRTXG4gICAgICAvLyBzYW1wbGUucHRzID0gTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLCBzYW1wbGUuZHRzKTtcblx0ICBzYW1wbGUucHRzID0gc2FtcGxlLmR0cztcbiAgICB9XG4gICAgbGFzdFBUUyA9IGlucHV0U2FtcGxlc1tpbnB1dFNhbXBsZXMubGVuZ3RoLTFdLnB0cztcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgKDQgKiB0cmFjay5uYk5hbHUpICsgOCk7XG4gICAgbGV0IHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgIHdoaWxlIChpbnB1dFNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBsZXQgYXZjU2FtcGxlID0gaW5wdXRTYW1wbGVzLnNoaWZ0KCksXG4gICAgICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlIChhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKG9mZnNldCwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCArPSA0ICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YXZjU2FtcGxlLnB0c30vJHthdmNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhdmNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBvdXRwdXRTYW1wbGVzLnB1c2goe1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgICAvLyBjb25zdGFudCBkdXJhdGlvblxuICAgICAgICBkdXJhdGlvbjogbXA0U2FtcGxlRHVyYXRpb24sXG4gICAgICAgIC8vIHNldCBjb21wb3NpdGlvbiB0aW1lIG9mZnNldCBhcyBhIG11bHRpcGxlIG9mIHNhbXBsZSBkdXJhdGlvblxuICAgICAgICBjdHM6IE1hdGgubWF4KDAsbXA0U2FtcGxlRHVyYXRpb24qTWF0aC5yb3VuZCgoYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMpLyhwZXMybXA0U2NhbGVGYWN0b3IqbXA0U2FtcGxlRHVyYXRpb24pKSksXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uIDogYXZjU2FtcGxlLmtleSA/IDIgOiAxLFxuICAgICAgICAgIGlzTm9uU3luYyA6IGF2Y1NhbXBsZS5rZXkgPyAwIDogMVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIERUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgRFRTICsgbGFzdCBzYW1wbGUgZHVyYXRpb24gKGluIFBFUyB0aW1lc2NhbGUpXG4gICAgdGhpcy5uZXh0QXZjRHRzID0gbGFzdERUUyArIG1wNFNhbXBsZUR1cmF0aW9uKnBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLm5iTmFsdSA9IDA7XG4gICAgaWYob3V0cHV0U2FtcGxlcy5sZW5ndGggJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEpIHtcbiAgICAgIGxldCBmbGFncyA9IG91dHB1dFNhbXBsZXNbMF0uZmxhZ3M7XG4gICAgLy8gY2hyb21lIHdvcmthcm91bmQsIG1hcmsgZmlyc3Qgc2FtcGxlIGFzIGJlaW5nIGEgUmFuZG9tIEFjY2VzcyBQb2ludCB0byBhdm9pZCBzb3VyY2VidWZmZXIgYXBwZW5kIGlzc3VlXG4gICAgLy8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTIyOTQxMlxuICAgICAgZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgIGZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgfVxuICAgIHRyYWNrLnNhbXBsZXMgPSBvdXRwdXRTYW1wbGVzO1xuXHQvLyBpZiAoZmlyc3REVFMvcGVzVGltZVNjYWxlID4gMTAwMDAwKSB7IGRlYnVnZ2VyOyB9XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gcGVzMm1wNFNjYWxlRmFjdG9yLCB0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgZGF0YTE6IG1vb2YsXG4gICAgICBkYXRhMjogbWRhdCxcbiAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZFBUUzogKGxhc3RQVFMgKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBtcDRTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmREVFM6IHRoaXMubmV4dEF2Y0R0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICBuYjogb3V0cHV0U2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIHJlbXV4QXVkaW8odHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gPSB0cmFjay50aW1lc2NhbGUgKiAxMDI0IC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlLFxuICAgICAgICBhYWNTYW1wbGUsIG1wNFNhbXBsZSxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgc2FtcGxlcyA9IFtdLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgc2FtcGxlczAgPSBbXTtcblxuICAgIHRyYWNrLnNhbXBsZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gKGEucHRzLWIucHRzKTtcbiAgICB9KTtcbiAgICBzYW1wbGVzMCA9IHRyYWNrLnNhbXBsZXM7XG5cbiAgICB3aGlsZSAoc2FtcGxlczAubGVuZ3RoKSB7XG4gICAgICBhYWNTYW1wbGUgPSBzYW1wbGVzMC5zaGlmdCgpO1xuICAgICAgdW5pdCA9IGFhY1NhbXBsZS51bml0O1xuICAgICAgcHRzID0gYWFjU2FtcGxlLnB0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICBkdHMgPSBhYWNTYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQXVkaW8vUFRTOiR7TWF0aC5yb3VuZChwdHMvOTApfWApO1xuICAgICAgLy8gaWYgbm90IGZpcnN0IHNhbXBsZVxuICAgICAgaWYgKGxhc3REVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbGFzdERUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBsYXN0RFRTKTtcbiAgICAgICAgLy8gbGV0J3MgY29tcHV0ZSBzYW1wbGUgZHVyYXRpb24uXG4gICAgICAgIC8vIHNhbXBsZSBEdXJhdGlvbiBzaG91bGQgYmUgY2xvc2UgdG8gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvblxuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAoZHRzbm9ybSAtIGxhc3REVFMpIC8gcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgICAgICBpZihNYXRoLmFicyhtcDRTYW1wbGUuZHVyYXRpb24gLSBleHBlY3RlZFNhbXBsZUR1cmF0aW9uKSA+IGV4cGVjdGVkU2FtcGxlRHVyYXRpb24vMTApIHtcbiAgICAgICAgICAvLyBtb3JlIHRoYW4gMTAlIGRpZmYgYmV0d2VlbiBzYW1wbGUgZHVyYXRpb24gYW5kIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gLi4uLiBsZXRzIGxvZyB0aGF0XG4gICAgICAgICAgLy8gbG9nZ2VyLnRyYWNlKGBpbnZhbGlkIEFBQyBzYW1wbGUgZHVyYXRpb24gYXQgUFRTICR7TWF0aC5yb3VuZChwdHMvOTApfSxzaG91bGQgYmUgMTAyNCxmb3VuZCA6JHtNYXRoLnJvdW5kKG1wNFNhbXBsZS5kdXJhdGlvbip0cmFjay5hdWRpb3NhbXBsZXJhdGUvdHJhY2sudGltZXNjYWxlKX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhbHdheXMgYWRqdXN0IHNhbXBsZSBkdXJhdGlvbiB0byBhdm9pZCBhdiBzeW5jIGlzc3VlXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGV4cGVjdGVkU2FtcGxlRHVyYXRpb247XG4gICAgICAgIGR0c25vcm0gPSBleHBlY3RlZFNhbXBsZUR1cmF0aW9uICogcGVzMm1wNFNjYWxlRmFjdG9yICsgbGFzdERUUztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBuZXh0QWFjUHRzLCBkZWx0YTtcbiAgICAgICAgaWYgKGNvbnRpZ3VvdXMpIHtcbiAgICAgICAgICBuZXh0QWFjUHRzID0gdGhpcy5uZXh0QWFjUHRzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5leHRBYWNQdHMgPSB0aW1lT2Zmc2V0KnBlc1RpbWVTY2FsZTtcbiAgICAgICAgfVxuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbmV4dEFhY1B0cyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZGVsdGEgPSBNYXRoLnJvdW5kKDEwMDAgKiAocHRzbm9ybSAtIG5leHRBYWNQdHMpIC8gcGVzVGltZVNjYWxlKTtcbiAgICAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuICAgICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgICAgICAvLyBsb2cgZGVsdGFcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBmcmFtZSBvdmVybGFwLCBvdmVybGFwcGluZyBmb3IgbW9yZSB0aGFuIGhhbGYgYSBmcmFtZSBkdXJhaW9uXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEyKSB7XG4gICAgICAgICAgICAgIC8vIGRyb3Agb3ZlcmxhcHBpbmcgYXVkaW8gZnJhbWVzLi4uIGJyb3dzZXIgd2lsbCBkZWFsIHdpdGggaXRcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBBQUMgc2FtcGxlcyBkZXRlY3RlZCwgZHJvcCBmcmFtZWApO1xuICAgICAgICAgICAgICB0cmFjay5sZW4gLT0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBEVFMgdG8gbmV4dCBEVFNcbiAgICAgICAgICAgIHB0c25vcm0gPSBkdHNub3JtID0gbmV4dEFhY1B0cztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhYWNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLCBwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLCBkdHNub3JtKTtcbiAgICAgICAgaWYodHJhY2subGVuID4gMCkge1xuICAgICAgICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgICAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbWRhdCB0eXBlKSAqL1xuICAgICAgICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyA4KTtcbiAgICAgICAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICAgICAgICB2aWV3LnNldFVpbnQzMigwLCBtZGF0LmJ5dGVMZW5ndGgpO1xuICAgICAgICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LCA0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBubyBhdWRpbyBzYW1wbGVzXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtZGF0LnNldCh1bml0LCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IHVuaXQuYnl0ZUxlbmd0aDtcbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthYWNTYW1wbGUucHRzfS8ke2FhY1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGFhY1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjdHM6IDAsXG4gICAgICAgIGR1cmF0aW9uOjAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0RFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgdmFyIGxhc3RTYW1wbGVEdXJhdGlvbiA9IDA7XG4gICAgdmFyIG5iU2FtcGxlcyA9IHNhbXBsZXMubGVuZ3RoO1xuICAgIC8vc2V0IGxhc3Qgc2FtcGxlIGR1cmF0aW9uIGFzIGJlaW5nIGlkZW50aWNhbCB0byBwcmV2aW91cyBzYW1wbGVcbiAgICBpZiAobmJTYW1wbGVzID49IDIpIHtcbiAgICAgIGxhc3RTYW1wbGVEdXJhdGlvbiA9IHNhbXBsZXNbbmJTYW1wbGVzIC0gMl0uZHVyYXRpb247XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgfVxuICAgIGlmIChuYlNhbXBsZXMpIHtcbiAgICAgIC8vIG5leHQgYWFjIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgICB0aGlzLm5leHRBYWNQdHMgPSBwdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uO1xuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG4gICAgICB0cmFjay5sZW4gPSAwO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgICBkYXRhMTogbW9vZixcbiAgICAgICAgZGF0YTI6IG1kYXQsXG4gICAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgZW5kUFRTOiB0aGlzLm5leHRBYWNQdHMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgZW5kRFRTOiAoZHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIGxhc3RTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIHR5cGU6ICdhdWRpbycsXG4gICAgICAgIG5iOiBuYlNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJlbXV4SUQzKHRyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB2YXIgbGVuZ3RoID0gdHJhY2suc2FtcGxlcy5sZW5ndGgsIHNhbXBsZTtcbiAgICAvLyBjb25zdW1lIHNhbXBsZXNcbiAgICBpZihsZW5ndGgpIHtcbiAgICAgIGZvcih2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBzYW1wbGUgPSB0cmFjay5zYW1wbGVzW2luZGV4XTtcbiAgICAgICAgLy8gc2V0dGluZyBpZDMgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICAgIHNhbXBsZS5kdHMgPSAoKHNhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgcmVtdXhUZXh0KHRyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB0cmFjay5zYW1wbGVzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgcmV0dXJuIChhLnB0cy1iLnB0cyk7XG4gICAgfSk7XG5cbiAgICB2YXIgbGVuZ3RoID0gdHJhY2suc2FtcGxlcy5sZW5ndGgsIHNhbXBsZTtcbiAgICAvLyBjb25zdW1lIHNhbXBsZXNcbiAgICBpZihsZW5ndGgpIHtcbiAgICAgIGZvcih2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBzYW1wbGUgPSB0cmFjay5zYW1wbGVzW2luZGV4XTtcbiAgICAgICAgLy8gc2V0dGluZyB0ZXh0IHB0cywgZHRzIHRvIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgLy8gdXNpbmcgdGhpcy5faW5pdFBUUyBhbmQgdGhpcy5faW5pdERUUyB0byBjYWxjdWxhdGUgcmVsYXRpdmUgdGltZVxuICAgICAgICBzYW1wbGUucHRzID0gKChzYW1wbGUucHRzIC0gdGhpcy5faW5pdFBUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwge1xuICAgICAgICBzYW1wbGVzOnRyYWNrLnNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgfVxuXG4gIF9QVFNOb3JtYWxpemUodmFsdWUsIHJlZmVyZW5jZSkge1xuICAgIHZhciBvZmZzZXQ7XG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChyZWZlcmVuY2UgPCB2YWx1ZSkge1xuICAgICAgLy8gLSAyXjMzXG4gICAgICBvZmZzZXQgPSAtODU4OTkzNDU5MjtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gKyAyXjMzXG4gICAgICBvZmZzZXQgPSA4NTg5OTM0NTkyO1xuICAgIH1cbiAgICAvKiBQVFMgaXMgMzNiaXQgKGZyb20gMCB0byAyXjMzIC0xKVxuICAgICAgaWYgZGlmZiBiZXR3ZWVuIHZhbHVlIGFuZCByZWZlcmVuY2UgaXMgYmlnZ2VyIHRoYW4gaGFsZiBvZiB0aGUgYW1wbGl0dWRlICgyXjMyKSB0aGVuIGl0IG1lYW5zIHRoYXRcbiAgICAgIFBUUyBsb29waW5nIG9jY3VyZWQuIGZpbGwgdGhlIGdhcCAqL1xuICAgIHdoaWxlIChNYXRoLmFicyh2YWx1ZSAtIHJlZmVyZW5jZSkgPiA0Mjk0OTY3Mjk2KSB7XG4gICAgICAgIHZhbHVlICs9IG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0UmVtdXhlcjtcbiIsIi8qKlxuICogcGFzc3Rocm91Z2ggcmVtdXhlclxuKi9cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuXG5jbGFzcyBQYXNzVGhyb3VnaFJlbXV4ZXIge1xuICBjb25zdHJ1Y3RvcihvYnNlcnZlcikge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICBnZXQgcGFzc3Rocm91Z2goKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHJlbXV4KGF1ZGlvVHJhY2ssdmlkZW9UcmFjayxpZDNUcmFjayx0ZXh0VHJhY2ssdGltZU9mZnNldCxyYXdEYXRhKSB7XG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlcjtcbiAgICAvLyBnZW5lcmF0ZSBJbml0IFNlZ21lbnQgaWYgbmVlZGVkXG4gICAgaWYgKCF0aGlzLklTR2VuZXJhdGVkKSB7XG4gICAgICB2YXIgdHJhY2tzID0ge30sXG4gICAgICAgICAgZGF0YSA9IHsgdHJhY2tzIDogdHJhY2tzLCB1bmlxdWUgOiB0cnVlIH0sXG4gICAgICAgICAgdHJhY2sgPSB2aWRlb1RyYWNrLFxuICAgICAgICAgIGNvZGVjID0gdHJhY2suY29kZWM7XG5cbiAgICAgIGlmIChjb2RlYykge1xuICAgICAgICBkYXRhLnRyYWNrcy52aWRlbyA9IHtcbiAgICAgICAgICBjb250YWluZXIgOiB0cmFjay5jb250YWluZXIsXG4gICAgICAgICAgY29kZWMgOiAgY29kZWMsXG4gICAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgICB3aWR0aCA6IHRyYWNrLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0IDogdHJhY2suaGVpZ2h0XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICB0cmFjayA9IGF1ZGlvVHJhY2s7XG4gICAgICBjb2RlYyA9IHRyYWNrLmNvZGVjO1xuICAgICAgaWYgKGNvZGVjKSB7XG4gICAgICAgIGRhdGEudHJhY2tzLmF1ZGlvID0ge1xuICAgICAgICAgIGNvbnRhaW5lciA6IHRyYWNrLmNvbnRhaW5lcixcbiAgICAgICAgICBjb2RlYyA6ICBjb2RlYyxcbiAgICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICAgIGNoYW5uZWxDb3VudCA6IHRyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULGRhdGEpO1xuICAgIH1cbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICBkYXRhMTogcmF3RGF0YSxcbiAgICAgIHN0YXJ0UFRTOiB0aW1lT2Zmc2V0LFxuICAgICAgc3RhcnREVFM6IHRpbWVPZmZzZXQsXG4gICAgICB0eXBlOiAnYXVkaW92aWRlbycsXG4gICAgICBuYjogMVxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBhc3NUaHJvdWdoUmVtdXhlcjtcbiIsIlxuLy8gYWRhcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9rYW5vbmdpbC9ub2RlLW0zdThwYXJzZS9ibG9iL21hc3Rlci9hdHRybGlzdC5qc1xuY2xhc3MgQXR0ckxpc3Qge1xuXG4gIGNvbnN0cnVjdG9yKGF0dHJzKSB7XG4gICAgaWYgKHR5cGVvZiBhdHRycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGF0dHJzID0gQXR0ckxpc3QucGFyc2VBdHRyTGlzdChhdHRycyk7XG4gICAgfVxuICAgIGZvcih2YXIgYXR0ciBpbiBhdHRycyl7XG4gICAgICBpZihhdHRycy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICB0aGlzW2F0dHJdID0gYXR0cnNbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBjb25zdCBpbnRWYWx1ZSA9IHBhcnNlSW50KHRoaXNbYXR0ck5hbWVdLCAxMCk7XG4gICAgaWYgKGludFZhbHVlID4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHtcbiAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICB9XG4gICAgcmV0dXJuIGludFZhbHVlO1xuICB9XG5cbiAgaGV4YWRlY2ltYWxJbnRlZ2VyKGF0dHJOYW1lKSB7XG4gICAgaWYodGhpc1thdHRyTmFtZV0pIHtcbiAgICAgIGxldCBzdHJpbmdWYWx1ZSA9ICh0aGlzW2F0dHJOYW1lXSB8fCAnMHgnKS5zbGljZSgyKTtcbiAgICAgIHN0cmluZ1ZhbHVlID0gKChzdHJpbmdWYWx1ZS5sZW5ndGggJiAxKSA/ICcwJyA6ICcnKSArIHN0cmluZ1ZhbHVlO1xuXG4gICAgICBjb25zdCB2YWx1ZSA9IG5ldyBVaW50OEFycmF5KHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDIpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHJpbmdWYWx1ZS5sZW5ndGggLyAyOyBpKyspIHtcbiAgICAgICAgdmFsdWVbaV0gPSBwYXJzZUludChzdHJpbmdWYWx1ZS5zbGljZShpICogMiwgaSAqIDIgKyAyKSwgMTYpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXJBc051bWJlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDE2KTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBkZWNpbWFsRmxvYXRpbmdQb2ludChhdHRyTmFtZSkge1xuICAgIHJldHVybiBwYXJzZUZsb2F0KHRoaXNbYXR0ck5hbWVdKTtcbiAgfVxuXG4gIGVudW1lcmF0ZWRTdHJpbmcoYXR0ck5hbWUpIHtcbiAgICByZXR1cm4gdGhpc1thdHRyTmFtZV07XG4gIH1cblxuICBkZWNpbWFsUmVzb2x1dGlvbihhdHRyTmFtZSkge1xuICAgIGNvbnN0IHJlcyA9IC9eKFxcZCspeChcXGQrKSQvLmV4ZWModGhpc1thdHRyTmFtZV0pO1xuICAgIGlmIChyZXMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogcGFyc2VJbnQocmVzWzFdLCAxMCksXG4gICAgICBoZWlnaHQ6IHBhcnNlSW50KHJlc1syXSwgMTApXG4gICAgfTtcbiAgfVxuXG4gIHN0YXRpYyBwYXJzZUF0dHJMaXN0KGlucHV0KSB7XG4gICAgY29uc3QgcmUgPSAvXFxzKiguKz8pXFxzKj0oKD86XFxcIi4qP1xcXCIpfC4qPykoPzosfCQpL2c7XG4gICAgdmFyIG1hdGNoLCBhdHRycyA9IHt9O1xuICAgIHdoaWxlICgobWF0Y2ggPSByZS5leGVjKGlucHV0KSkgIT09IG51bGwpIHtcbiAgICAgIHZhciB2YWx1ZSA9IG1hdGNoWzJdLCBxdW90ZSA9ICdcIic7XG5cbiAgICAgIGlmICh2YWx1ZS5pbmRleE9mKHF1b3RlKSA9PT0gMCAmJlxuICAgICAgICAgIHZhbHVlLmxhc3RJbmRleE9mKHF1b3RlKSA9PT0gKHZhbHVlLmxlbmd0aC0xKSkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLnNsaWNlKDEsIC0xKTtcbiAgICAgIH1cbiAgICAgIGF0dHJzW21hdGNoWzFdXSA9IHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gYXR0cnM7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBdHRyTGlzdDtcbiIsInZhciBCaW5hcnlTZWFyY2ggPSB7XG4gICAgLyoqXG4gICAgICogU2VhcmNoZXMgZm9yIGFuIGl0ZW0gaW4gYW4gYXJyYXkgd2hpY2ggbWF0Y2hlcyBhIGNlcnRhaW4gY29uZGl0aW9uLlxuICAgICAqIFRoaXMgcmVxdWlyZXMgdGhlIGNvbmRpdGlvbiB0byBvbmx5IG1hdGNoIG9uZSBpdGVtIGluIHRoZSBhcnJheSxcbiAgICAgKiBhbmQgZm9yIHRoZSBhcnJheSB0byBiZSBvcmRlcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gbGlzdCBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbXBhcmlzb25GdW5jdGlvblxuICAgICAqICAgICAgQ2FsbGVkIGFuZCBwcm92aWRlZCBhIGNhbmRpZGF0ZSBpdGVtIGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICAgKiAgICAgIFNob3VsZCByZXR1cm46XG4gICAgICogICAgICAgICAgPiAtMSBpZiB0aGUgaXRlbSBzaG91bGQgYmUgbG9jYXRlZCBhdCBhIGxvd2VyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAxIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgaGlnaGVyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAwIGlmIHRoZSBpdGVtIGlzIHRoZSBpdGVtIHlvdSdyZSBsb29raW5nIGZvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm4geyp9IFRoZSBvYmplY3QgaWYgaXQgaXMgZm91bmQgb3IgbnVsbCBvdGhlcndpc2UuXG4gICAgICovXG4gICAgc2VhcmNoOiBmdW5jdGlvbihsaXN0LCBjb21wYXJpc29uRnVuY3Rpb24pIHtcbiAgICAgICAgdmFyIG1pbkluZGV4ID0gMDtcbiAgICAgICAgdmFyIG1heEluZGV4ID0gbGlzdC5sZW5ndGggLSAxO1xuICAgICAgICB2YXIgY3VycmVudEluZGV4ID0gbnVsbDtcbiAgICAgICAgdmFyIGN1cnJlbnRFbGVtZW50ID0gbnVsbDtcbiAgICAgXG4gICAgICAgIHdoaWxlIChtaW5JbmRleCA8PSBtYXhJbmRleCkge1xuICAgICAgICAgICAgY3VycmVudEluZGV4ID0gKG1pbkluZGV4ICsgbWF4SW5kZXgpIC8gMiB8IDA7XG4gICAgICAgICAgICBjdXJyZW50RWxlbWVudCA9IGxpc3RbY3VycmVudEluZGV4XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGNvbXBhcmlzb25SZXN1bHQgPSBjb21wYXJpc29uRnVuY3Rpb24oY3VycmVudEVsZW1lbnQpO1xuICAgICAgICAgICAgaWYgKGNvbXBhcmlzb25SZXN1bHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgbWluSW5kZXggPSBjdXJyZW50SW5kZXggKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHtcbiAgICAgICAgICAgICAgICBtYXhJbmRleCA9IGN1cnJlbnRJbmRleCAtIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudEVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmluYXJ5U2VhcmNoO1xuIiwiLypcbiAqIENFQS03MDggaW50ZXJwcmV0ZXJcbiovXG5cbmNsYXNzIENFQTcwOEludGVycHJldGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxuXG4gIGF0dGFjaChtZWRpYSkge1xuICAgIHRoaXMubWVkaWEgPSBtZWRpYTtcbiAgICB0aGlzLmRpc3BsYXkgPSBbXTtcbiAgICB0aGlzLm1lbW9yeSA9IFtdO1xuICB9XG5cbiAgZGV0YWNoKClcbiAge1xuICAgIHRoaXMuY2xlYXIoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBfY3JlYXRlQ3VlKClcbiAge1xuICAgIHZhciBWVFRDdWUgPSB3aW5kb3cuVlRUQ3VlIHx8IHdpbmRvdy5UZXh0VHJhY2tDdWU7XG5cbiAgICB2YXIgY3VlID0gdGhpcy5jdWUgPSBuZXcgVlRUQ3VlKC0xLCAtMSwgJycpO1xuICAgIGN1ZS50ZXh0ID0gJyc7XG4gICAgY3VlLnBhdXNlT25FeGl0ID0gZmFsc2U7XG5cbiAgICAvLyBtYWtlIHN1cmUgaXQgZG9lc24ndCBzaG93IHVwIGJlZm9yZSBpdCdzIHJlYWR5XG4gICAgY3VlLnN0YXJ0VGltZSA9IE51bWJlci5NQVhfVkFMVUU7XG5cbiAgICAvLyBzaG93IGl0ICdmb3JldmVyJyBvbmNlIHdlIGRvIHNob3cgaXRcbiAgICAvLyAod2UnbGwgc2V0IHRoZSBlbmQgdGltZSBvbmNlIHdlIGtub3cgaXQgbGF0ZXIpXG4gICAgY3VlLmVuZFRpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXG4gICAgdGhpcy5tZW1vcnkucHVzaChjdWUpO1xuICB9XG5cbiAgY2xlYXIoKVxuICB7XG4gICAgdmFyIHRleHRUcmFjayA9IHRoaXMuX3RleHRUcmFjaztcbiAgICBpZiAodGV4dFRyYWNrICYmIHRleHRUcmFjay5jdWVzKVxuICAgIHtcbiAgICAgIHdoaWxlICh0ZXh0VHJhY2suY3Vlcy5sZW5ndGggPiAwKVxuICAgICAge1xuICAgICAgICB0ZXh0VHJhY2sucmVtb3ZlQ3VlKHRleHRUcmFjay5jdWVzWzBdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdXNoKHRpbWVzdGFtcCwgYnl0ZXMpXG4gIHtcbiAgICBpZiAoIXRoaXMuY3VlKVxuICAgIHtcbiAgICAgIHRoaXMuX2NyZWF0ZUN1ZSgpO1xuICAgIH1cblxuICAgIHZhciBjb3VudCA9IGJ5dGVzWzBdICYgMzE7XG4gICAgdmFyIHBvc2l0aW9uID0gMjtcbiAgICB2YXIgdG1wQnl0ZSwgY2NieXRlMSwgY2NieXRlMiwgY2NWYWxpZCwgY2NUeXBlO1xuXG4gICAgZm9yICh2YXIgaj0wOyBqPGNvdW50OyBqKyspXG4gICAge1xuICAgICAgdG1wQnl0ZSA9IGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMSA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjYnl0ZTIgPSAweDdGICYgYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY1ZhbGlkID0gKCg0ICYgdG1wQnl0ZSkgPT09IDAgPyBmYWxzZSA6IHRydWUpO1xuICAgICAgY2NUeXBlID0gKDMgJiB0bXBCeXRlKTtcblxuICAgICAgaWYgKGNjYnl0ZTEgPT09IDAgJiYgY2NieXRlMiA9PT0gMClcbiAgICAgIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChjY1ZhbGlkKVxuICAgICAge1xuICAgICAgICBpZiAoY2NUeXBlID09PSAwKSAvLyB8fCBjY1R5cGUgPT09IDFcbiAgICAgICAge1xuICAgICAgICAgIC8vIFN0YW5kYXJkIENoYXJhY3RlcnNcbiAgICAgICAgICBpZiAoMHgyMCAmIGNjYnl0ZTEgfHwgMHg0MCAmIGNjYnl0ZTEpXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSB0aGlzLl9mcm9tQ2hhckNvZGUoY2NieXRlMSkgKyB0aGlzLl9mcm9tQ2hhckNvZGUoY2NieXRlMik7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNwZWNpYWwgQ2hhcmFjdGVyc1xuICAgICAgICAgIGVsc2UgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgzMCAmJiBjY2J5dGUyIDw9IDB4M0YpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gZXh0ZW5kZWQgY2hhcnMsIGUuZy4gbXVzaWNhbCBub3RlLCBhY2NlbnRzXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgNDg6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwq4nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDQ5OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8KwJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MDpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCvSc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTE6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwr8nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUyOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ+KEoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTM6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwqInO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU0OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTU6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwqMnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU2OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ+KZqic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTc6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnICc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTg6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6gnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU5OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MDpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDqic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjE6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw64nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYyOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8O0JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDuyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxMSB8fCBjY2J5dGUxID09PSAweDE5KSAmJiBjY2J5dGUyID49IDB4MjAgJiYgY2NieXRlMiA8PSAweDJGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjA6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIxOlxuICAgICAgICAgICAgICAgIC8vIFdoaXRlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIEdyZWVuIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjQ6XG4gICAgICAgICAgICAgICAgLy8gQmx1ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjU6XG4gICAgICAgICAgICAgICAgLy8gQmx1ZSBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI2OlxuICAgICAgICAgICAgICAgIC8vIEN5YW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI3OlxuICAgICAgICAgICAgICAgIC8vIEN5YW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICAgICAgICAvLyBSZWRcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI5OlxuICAgICAgICAgICAgICAgIC8vIFJlZCBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJBOlxuICAgICAgICAgICAgICAgIC8vIFllbGxvd1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93IFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkM6XG4gICAgICAgICAgICAgICAgLy8gTWFnZW50YVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkQ6XG4gICAgICAgICAgICAgICAgLy8gTWFnZW50YSBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJFOlxuICAgICAgICAgICAgICAgIC8vIEl0YWxpY3NcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJGOlxuICAgICAgICAgICAgICAgIC8vIEl0YWxpY3MgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNCB8fCBjY2J5dGUxID09PSAweDFDKSAmJiBjY2J5dGUyID49IDB4MjAgJiYgY2NieXRlMiA8PSAweDJGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjA6XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogc2hvdWxkbid0IGFmZmVjdCByb2xsLXVwcy4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIC8vIFJDTDogUmVzdW1lIENhcHRpb24gTG9hZGluZ1xuICAgICAgICAgICAgICAgIC8vIGJlZ2luIHBvcCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gQlM6IEJhY2tzcGFjZVxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgPSB0aGlzLmN1ZS50ZXh0LnN1YnN0cigwLCB0aGlzLmN1ZS50ZXh0Lmxlbmd0aC0xKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIyOlxuICAgICAgICAgICAgICAgIC8vIEFPRjogcmVzZXJ2ZWQgKGZvcm1lcmx5IGFsYXJtIG9mZilcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIEFPTjogcmVzZXJ2ZWQgKGZvcm1lcmx5IGFsYXJtIG9uKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjQ6XG4gICAgICAgICAgICAgICAgLy8gREVSOiBEZWxldGUgdG8gZW5kIG9mIHJvd1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjU6XG4gICAgICAgICAgICAgICAgLy8gUlUyOiByb2xsLXVwIDIgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gUlUzOiByb2xsLXVwIDMgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gUlU0OiByb2xsLXVwIDQgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjg6XG4gICAgICAgICAgICAgICAgLy8gRk9OOiBGbGFzaCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUkRDOiBSZXN1bWUgZGlyZWN0IGNhcHRpb25pbmdcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJBOlxuICAgICAgICAgICAgICAgIC8vIFRSOiBUZXh0IFJlc3RhcnRcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJCOlxuICAgICAgICAgICAgICAgIC8vIFJURDogUmVzdW1lIFRleHQgRGlzcGxheVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkM6XG4gICAgICAgICAgICAgICAgLy8gRURNOiBFcmFzZSBEaXNwbGF5ZWQgTWVtb3J5XG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBDUjogQ2FycmlhZ2UgUmV0dXJuXG4gICAgICAgICAgICAgICAgLy8gb25seSBhZmZlY3RzIHJvbGwtdXBcbiAgICAgICAgICAgICAgICAvL3RoaXMuX3JvbGx1cCgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJFOlxuICAgICAgICAgICAgICAgIC8vIEVOTTogRXJhc2Ugbm9uLWRpc3BsYXllZCBtZW1vcnlcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0ID0gJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRjpcbiAgICAgICAgICAgICAgICB0aGlzLl9mbGlwTWVtb3J5KHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gRU9DOiBFbmQgb2YgY2FwdGlvblxuICAgICAgICAgICAgICAgIC8vIGhpZGUgYW55IGRpc3BsYXllZCBjYXB0aW9ucyBhbmQgc2hvdyBhbnkgaGlkZGVuIG9uZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoKGNjYnl0ZTEgPT09IDB4MTcgfHwgY2NieXRlMSA9PT0gMHgxRikgJiYgY2NieXRlMiA+PSAweDIxICYmIGNjYnl0ZTIgPD0gMHgyMylcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBNaWQtcm93IGNvZGVzOiBjb2xvci91bmRlcmxpbmVcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSAweDIxOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAxIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDIgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMzpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMyBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBQcm9iYWJseSBhIHByZS1hbWJsZSBhZGRyZXNzIGNvZGVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZnJvbUNoYXJDb2RlKHRtcEJ5dGUpXG4gIHtcbiAgICBzd2l0Y2ggKHRtcEJ5dGUpXG4gICAge1xuICAgICAgY2FzZSA0MjpcbiAgICAgICAgcmV0dXJuICfDoSc7XG5cbiAgICAgIGNhc2UgMjpcbiAgICAgICAgcmV0dXJuICfDoSc7XG5cbiAgICAgIGNhc2UgMjpcbiAgICAgICAgcmV0dXJuICfDqSc7XG5cbiAgICAgIGNhc2UgNDpcbiAgICAgICAgcmV0dXJuICfDrSc7XG5cbiAgICAgIGNhc2UgNTpcbiAgICAgICAgcmV0dXJuICfDsyc7XG5cbiAgICAgIGNhc2UgNjpcbiAgICAgICAgcmV0dXJuICfDuic7XG5cbiAgICAgIGNhc2UgMzpcbiAgICAgICAgcmV0dXJuICfDpyc7XG5cbiAgICAgIGNhc2UgNDpcbiAgICAgICAgcmV0dXJuICfDtyc7XG5cbiAgICAgIGNhc2UgNTpcbiAgICAgICAgcmV0dXJuICfDkSc7XG5cbiAgICAgIGNhc2UgNjpcbiAgICAgICAgcmV0dXJuICfDsSc7XG5cbiAgICAgIGNhc2UgNzpcbiAgICAgICAgcmV0dXJuICfilognO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSh0bXBCeXRlKTtcbiAgICB9XG4gIH1cblxuICBfZmxpcE1lbW9yeSh0aW1lc3RhbXApXG4gIHtcbiAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICB0aGlzLl9mbHVzaENhcHRpb25zKHRpbWVzdGFtcCk7XG4gIH1cblxuICBfZmx1c2hDYXB0aW9ucyh0aW1lc3RhbXApXG4gIHtcbiAgICBpZiAoIXRoaXMuX2hhczcwOClcbiAgICB7XG4gICAgICB0aGlzLl90ZXh0VHJhY2sgPSB0aGlzLm1lZGlhLmFkZFRleHRUcmFjaygnY2FwdGlvbnMnLCAnRW5nbGlzaCcsICdlbicpO1xuICAgICAgdGhpcy5faGFzNzA4ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IG1lbW9yeUl0ZW0gb2YgdGhpcy5tZW1vcnkpXG4gICAge1xuICAgICAgbWVtb3J5SXRlbS5zdGFydFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgICB0aGlzLl90ZXh0VHJhY2suYWRkQ3VlKG1lbW9yeUl0ZW0pO1xuICAgICAgdGhpcy5kaXNwbGF5LnB1c2gobWVtb3J5SXRlbSk7XG4gICAgfVxuXG4gICAgdGhpcy5tZW1vcnkgPSBbXTtcbiAgICB0aGlzLmN1ZSA9IG51bGw7XG4gIH1cblxuICBfY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcClcbiAge1xuICAgIGZvciAobGV0IGRpc3BsYXlJdGVtIG9mIHRoaXMuZGlzcGxheSlcbiAgICB7XG4gICAgICBkaXNwbGF5SXRlbS5lbmRUaW1lID0gdGltZXN0YW1wO1xuICAgIH1cblxuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICB9XG5cbi8qICBfcm9sbFVwKG4pXG4gIHtcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnQgcm9sbC11cCBjYXB0aW9uc1xuICB9XG4qL1xuICBfY2xlYXJCdWZmZXJlZEN1ZXMoKVxuICB7XG4gICAgLy9yZW1vdmUgdGhlbSBhbGwuLi5cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IENFQTcwOEludGVycHJldGVyO1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5jb25zdCBmYWtlTG9nZ2VyID0ge1xuICB0cmFjZTogbm9vcCxcbiAgZGVidWc6IG5vb3AsXG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5cbmxldCBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG5cbi8vbGV0IGxhc3RDYWxsVGltZTtcbi8vIGZ1bmN0aW9uIGZvcm1hdE1zZ1dpdGhUaW1lSW5mbyh0eXBlLCBtc2cpIHtcbi8vICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbi8vICAgY29uc3QgZGlmZiA9IGxhc3RDYWxsVGltZSA/ICcrJyArIChub3cgLSBsYXN0Q2FsbFRpbWUpIDogJzAnO1xuLy8gICBsYXN0Q2FsbFRpbWUgPSBub3c7XG4vLyAgIG1zZyA9IChuZXcgRGF0ZShub3cpKS50b0lTT1N0cmluZygpICsgJyB8IFsnICsgIHR5cGUgKyAnXSA+ICcgKyBtc2cgKyAnICggJyArIGRpZmYgKyAnIG1zICknO1xuLy8gICByZXR1cm4gbXNnO1xuLy8gfVxuXG5mdW5jdGlvbiBmb3JtYXRNc2codHlwZSwgbXNnKSB7XG4gIG1zZyA9ICdbJyArICB0eXBlICsgJ10gPiAnICsgbXNnO1xuICByZXR1cm4gbXNnO1xufVxuXG5mdW5jdGlvbiBjb25zb2xlUHJpbnRGbih0eXBlKSB7XG4gIGNvbnN0IGZ1bmMgPSB3aW5kb3cuY29uc29sZVt0eXBlXTtcbiAgaWYgKGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgaWYoYXJnc1swXSkge1xuICAgICAgICBhcmdzWzBdID0gZm9ybWF0TXNnKHR5cGUsIGFyZ3NbMF0pO1xuICAgICAgfVxuICAgICAgZnVuYy5hcHBseSh3aW5kb3cuY29uc29sZSwgYXJncyk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4gbm9vcDtcbn1cblxuZnVuY3Rpb24gZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLCAuLi5mdW5jdGlvbnMpIHtcbiAgZnVuY3Rpb25zLmZvckVhY2goZnVuY3Rpb24odHlwZSkge1xuICAgIGV4cG9ydGVkTG9nZ2VyW3R5cGVdID0gZGVidWdDb25maWdbdHlwZV0gPyBkZWJ1Z0NvbmZpZ1t0eXBlXS5iaW5kKGRlYnVnQ29uZmlnKSA6IGNvbnNvbGVQcmludEZuKHR5cGUpO1xuICB9KTtcbn1cblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWdDb25maWcpIHtcbiAgaWYgKGRlYnVnQ29uZmlnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1Z0NvbmZpZyA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsXG4gICAgICAvLyBSZW1vdmUgb3V0IGZyb20gbGlzdCBoZXJlIHRvIGhhcmQtZGlzYWJsZSBhIGxvZy1sZXZlbFxuICAgICAgLy8ndHJhY2UnLFxuICAgICAgJ2RlYnVnJyxcbiAgICAgICdsb2cnLFxuICAgICAgJ2luZm8nLFxuICAgICAgJ3dhcm4nLFxuICAgICAgJ2Vycm9yJ1xuICAgICk7XG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuXG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwidmFyIFVSTEhlbHBlciA9IHtcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBVUkwgZnJvbSBhIHJlbGF0aXZlIG9uZSB1c2luZyB0aGUgcHJvdmlkZWQgYmFzZVVSTFxuICAvLyBpZiByZWxhdGl2ZVVSTCBpcyBhbiBhYnNvbHV0ZSBVUkwgaXQgd2lsbCBiZSByZXR1cm5lZCBhcyBpcy5cbiAgYnVpbGRBYnNvbHV0ZVVSTDogZnVuY3Rpb24oYmFzZVVSTCwgcmVsYXRpdmVVUkwpIHtcbiAgICAvLyByZW1vdmUgYW55IHJlbWFpbmluZyBzcGFjZSBhbmQgQ1JMRlxuICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkwudHJpbSgpO1xuICAgIGlmICgvXlthLXpdKzovaS50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgLy8gY29tcGxldGUgdXJsLCBub3QgcmVsYXRpdmVcbiAgICAgIHJldHVybiByZWxhdGl2ZVVSTDtcbiAgICB9XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeSA9IG51bGw7XG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaCA9IG51bGw7XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMSGFzaFNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTEhhc2ggPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxRdWVyeVNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTFF1ZXJ5ID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTEhhc2hTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciBiYXNlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxRdWVyeVNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxEb21haW5TcGxpdCA9IC9eKCgoW2Etel0rKTopP1xcL1xcL1thLXowLTlcXC5cXC1ffl0rKDpbMC05XSspP1xcLykoLiopJC9pLmV4ZWMoYmFzZVVSTCk7XG4gICAgdmFyIGJhc2VVUkxQcm90b2NvbCA9IGJhc2VVUkxEb21haW5TcGxpdFszXTtcbiAgICB2YXIgYmFzZVVSTERvbWFpbiA9IGJhc2VVUkxEb21haW5TcGxpdFsxXTtcbiAgICB2YXIgYmFzZVVSTFBhdGggPSBiYXNlVVJMRG9tYWluU3BsaXRbNV07XG5cbiAgICB2YXIgYnVpbHRVUkwgPSBudWxsO1xuICAgIGlmICgvXlxcL1xcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTFByb3RvY29sKyc6Ly8nK1VSTEhlbHBlci5idWlsZEFic29sdXRlUGF0aCgnJywgcmVsYXRpdmVVUkwuc3Vic3RyaW5nKDIpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoL15cXC8vLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4rVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGJ1aWx0VVJMID0gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKGJhc2VVUkxEb21haW4rYmFzZVVSTFBhdGgsIHJlbGF0aXZlVVJMKTtcbiAgICB9XG5cbiAgICAvLyBwdXQgdGhlIHF1ZXJ5IGFuZCBoYXNoIHBhcnRzIGJhY2tcbiAgICBpZiAocmVsYXRpdmVVUkxRdWVyeSkge1xuICAgICAgYnVpbHRVUkwgKz0gcmVsYXRpdmVVUkxRdWVyeTtcbiAgICB9XG4gICAgaWYgKHJlbGF0aXZlVVJMSGFzaCkge1xuICAgICAgYnVpbHRVUkwgKz0gcmVsYXRpdmVVUkxIYXNoO1xuICAgIH1cbiAgICByZXR1cm4gYnVpbHRVUkw7XG4gIH0sXG5cbiAgLy8gYnVpbGQgYW4gYWJzb2x1dGUgcGF0aCB1c2luZyB0aGUgcHJvdmlkZWQgYmFzZVBhdGhcbiAgLy8gYWRhcHRlZCBmcm9tIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9kb2N1bWVudC9jb29raWUjVXNpbmdfcmVsYXRpdmVfVVJMc19pbl90aGVfcGF0aF9wYXJhbWV0ZXJcbiAgLy8gdGhpcyBkb2VzIG5vdCBoYW5kbGUgdGhlIGNhc2Ugd2hlcmUgcmVsYXRpdmVQYXRoIGlzIFwiL1wiIG9yIFwiLy9cIi4gVGhlc2UgY2FzZXMgc2hvdWxkIGJlIGhhbmRsZWQgb3V0c2lkZSB0aGlzLlxuICBidWlsZEFic29sdXRlUGF0aDogZnVuY3Rpb24oYmFzZVBhdGgsIHJlbGF0aXZlUGF0aCkge1xuICAgIHZhciBzUmVsUGF0aCA9IHJlbGF0aXZlUGF0aDtcbiAgICB2YXIgblVwTG4sIHNEaXIgPSAnJywgc1BhdGggPSBiYXNlUGF0aC5yZXBsYWNlKC9bXlxcL10qJC8sIHNSZWxQYXRoLnJlcGxhY2UoLyhcXC98XikoPzpcXC4/XFwvKykrL2csICckMScpKTtcbiAgICBmb3IgKHZhciBuRW5kLCBuU3RhcnQgPSAwOyBuRW5kID0gc1BhdGguaW5kZXhPZignLy4uLycsIG5TdGFydCksIG5FbmQgPiAtMTsgblN0YXJ0ID0gbkVuZCArIG5VcExuKSB7XG4gICAgICBuVXBMbiA9IC9eXFwvKD86XFwuXFwuXFwvKSovLmV4ZWMoc1BhdGguc2xpY2UobkVuZCkpWzBdLmxlbmd0aDtcbiAgICAgIHNEaXIgPSAoc0RpciArIHNQYXRoLnN1YnN0cmluZyhuU3RhcnQsIG5FbmQpKS5yZXBsYWNlKG5ldyBSZWdFeHAoJyg/OlxcXFxcXC8rW15cXFxcXFwvXSopezAsJyArICgoblVwTG4gLSAxKSAvIDMpICsgJ30kJyksICcvJyk7XG4gICAgfVxuICAgIHJldHVybiBzRGlyICsgc1BhdGguc3Vic3RyKG5TdGFydCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVVJMSGVscGVyO1xuIiwiLyoqXG4gKiBYSFIgYmFzZWQgbG9nZ2VyXG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgWGhyTG9hZGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICBpZiAoY29uZmlnICYmIGNvbmZpZy54aHJTZXR1cCkge1xuICAgICAgdGhpcy54aHJTZXR1cCA9IGNvbmZpZy54aHJTZXR1cDtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuYWJvcnQoKTtcbiAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5sb2FkZXIsXG4gICAgICAgIHRpbWVvdXRIYW5kbGUgPSB0aGlzLnRpbWVvdXRIYW5kbGU7XG4gICAgaWYgKGxvYWRlciAmJiBsb2FkZXIucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgdGhpcy5zdGF0cy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgIGxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICBpZiAodGltZW91dEhhbmRsZSkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aW1lb3V0SGFuZGxlKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCwgY3JlZHMsIHJlc3BvbnNlVHlwZSwgb25TdWNjZXNzLCBvbkVycm9yLCBvblRpbWVvdXQsIHRpbWVvdXQsIG1heFJldHJ5LCByZXRyeURlbGF5LCBvblByb2dyZXNzID0gbnVsbCwgZnJhZyA9IG51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICBpZiAoZnJhZyAmJiAhaXNOYU4oZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCkgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0KSkge1xuICAgICAgICB0aGlzLmJ5dGVSYW5nZSA9IGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgKyAnLScgKyAoZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQtMSk7XG4gICAgfVxuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25Qcm9ncmVzcyA9IG9uUHJvZ3Jlc3M7XG4gICAgdGhpcy5vblRpbWVvdXQgPSBvblRpbWVvdXQ7XG4gICAgdGhpcy5vbkVycm9yID0gb25FcnJvcjtcbiAgICB0aGlzLnN0YXRzID0ge3RyZXF1ZXN0OiBwZXJmb3JtYW5jZS5ub3coKSwgcmV0cnk6IDB9O1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcblx0dGhpcy5jcmVkcyA9IGNyZWRzO1xuICB9XG5cbiAgbG9hZEludGVybmFsKCkge1xuICAgIHZhciB4aHI7XG5cbiAgICBpZiAodHlwZW9mIFhEb21haW5SZXF1ZXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIH1cblxuICAgIHhoci5vbmxvYWRlbmQgPSB0aGlzLmxvYWRlbmQuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG5cbiAgICB4aHIub3BlbignR0VUJywgdGhpcy51cmwsIHRydWUpO1xuICAgIGlmICh0aGlzLmJ5dGVSYW5nZSkge1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ1JhbmdlJywgJ2J5dGVzPScgKyB0aGlzLmJ5dGVSYW5nZSk7XG4gICAgfVxuXHRpZiAodGhpcy5jcmVkcykge1xuXHRcdGlmICghdGhpcy5jcmVkcy51c2VybmFtZSkgeyBjb25zb2xlLndhcm4oJ2dvdCBjcmVkZW50aWFscywgYnV0IG5vIHVzZXJuYW1lJyk7IH1cblx0XHRpZiAoIXRoaXMuY3JlZHMucGFzc3dvcmQpIHsgY29uc29sZS53YXJuKCdnb3QgY3JlZGVudGlhbHMsIGJ1dCBubyBwYXNzd29yZCcpOyB9XG5cdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIoICdBdXRob3JpemF0aW9uJywgJ0Jhc2ljICcgKyBidG9hKHRoaXMuY3JlZHMudXNlcm5hbWUgKyAnOicgKyB0aGlzLmNyZWRzLnBhc3N3b3JkKSApO1xuXHR9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgaWYgKHRoaXMueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAoeGhyLCB0aGlzLnVybCk7XG4gICAgfVxuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy50aW1lb3V0KTtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZGVuZChldmVudCkge1xuICAgIHZhciB4aHIgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdGF0dXMgPSB4aHIuc3RhdHVzLFxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgLy8gZG9uJ3QgcHJvY2VlZCBpZiB4aHIgaGFzIGJlZW4gYWJvcnRlZFxuICAgIGlmICghc3RhdHMuYWJvcnRlZCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
