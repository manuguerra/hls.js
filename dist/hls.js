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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwic3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCJzcmMvY29udHJvbGxlci9idWZmZXItY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL2NhcC1sZXZlbC1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlci5qcyIsInNyYy9jcnlwdC9hZXMuanMiLCJzcmMvY3J5cHQvYWVzMTI4LWRlY3J5cHRlci5qcyIsInNyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCJzcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsInNyYy9kZW11eC9hZHRzLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXIuanMiLCJzcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsInNyYy9kZW11eC9pZDMuanMiLCJzcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9ldmVudC1oYW5kbGVyLmpzIiwic3JjL2V2ZW50cy5qcyIsInNyYy9oZWxwZXIvYnVmZmVyLWhlbHBlci5qcyIsInNyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwic3JjL2hscy5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwic3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwic3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCJzcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsInNyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsInNyYy9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyLmpzIiwic3JjL3V0aWxzL2F0dHItbGlzdC5qcyIsInNyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwic3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCJzcmMvdXRpbHMvbG9nZ2VyLmpzIiwic3JjL3V0aWxzL3VybC5qcyIsInNyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtB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SSxRQUFRLEtBQUssS0FBTCxDQURNO0FBRWxCLFVBQUksTUFBTSxNQUFOLEtBQWlCLElBQWpCLEVBQXVCO0FBQ3pCLGNBQU0sTUFBTixHQUFlLFlBQVksR0FBWixFQUFmLENBRHlCO09BQTNCO0FBR0EsWUFBTSxNQUFOLEdBQWUsTUFBTSxNQUFOLENBTEc7QUFNbEIsVUFBSSxLQUFLLFVBQUwsRUFBaUI7QUFDbkIsYUFBSyxVQUFMLENBQWdCLEtBQWhCLEVBQXVCLEtBQXZCLEVBRG1CO09BQXJCOzs7O1NBbEhFOzs7a0JBd0hTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIHZhciBleHAgPSBjYWNoZVtrZXldLmV4cG9ydHM7XG4gICAgICAgIC8vIFVzaW5nIGJhYmVsIGFzIGEgdHJhbnNwaWxlciB0byB1c2UgZXNtb2R1bGUsIHRoZSBleHBvcnQgd2lsbCBhbHdheXNcbiAgICAgICAgLy8gYmUgYW4gb2JqZWN0IHdpdGggdGhlIGRlZmF1bHQgZXhwb3J0IGFzIGEgcHJvcGVydHkgb2YgaXQuIFRvIGVuc3VyZVxuICAgICAgICAvLyB0aGUgZXhpc3RpbmcgYXBpIGFuZCBiYWJlbCBlc21vZHVsZSBleHBvcnRzIGFyZSBib3RoIHN1cHBvcnRlZCB3ZVxuICAgICAgICAvLyBjaGVjayBmb3IgYm90aFxuICAgICAgICBpZiAoZXhwID09PSBmbiB8fCBleHAuZGVmYXVsdCA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG5cbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sIChcbiAgICAgICAgICAgIC8vIHRyeSB0byBjYWxsIGRlZmF1bHQgaWYgZGVmaW5lZCB0byBhbHNvIHN1cHBvcnQgYmFiZWwgZXNtb2R1bGVcbiAgICAgICAgICAgIC8vIGV4cG9ydHNcbiAgICAgICAgICAgICd2YXIgZiA9IHJlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpOycgK1xuICAgICAgICAgICAgJyhmLmRlZmF1bHQgPyBmLmRlZmF1bHQgOiBmKShzZWxmKTsnXG4gICAgICAgICkpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG5cbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogc2ltcGxlIEFCUiBDb250cm9sbGVyXG4gKiAgLSBjb21wdXRlIG5leHQgbGV2ZWwgYmFzZWQgb24gbGFzdCBmcmFnbWVudCBidyBoZXVyaXN0aWNzXG4gKiAgLSBpbXBsZW1lbnQgYW4gYWJhbmRvbiBydWxlcyB0cmlnZ2VyZWQgaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGJ1ZmZlcmVkIGFuZCBpZiBjb21wdXRlZCBidyBzaG93cyB0aGF0IHdlIHJpc2sgYnVmZmVyIHN0YWxsaW5nXG4gKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IEJ1ZmZlckhlbHBlciBmcm9tICcuLi9oZWxwZXIvYnVmZmVyLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBBYnJDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgICAgICAgICAgRXZlbnQuRVJST1IpO1xuICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSAwO1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbkNoZWNrID0gdGhpcy5hYmFuZG9uUnVsZXNDaGVjay5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9uQ2hlY2ssIDEwMCk7XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IGRhdGEuZnJhZztcbiAgfVxuXG4gIG9uRnJhZ0xvYWRQcm9ncmVzcyhkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAvLyBvbmx5IHVwZGF0ZSBzdGF0cyBpZiBmaXJzdCBmcmFnIGxvYWRpbmdcbiAgICAvLyBpZiBzYW1lIGZyYWcgaXMgbG9hZGVkIG11bHRpcGxlIHRpbWVzLCBpdCBtaWdodCBiZSBpbiBicm93c2VyIGNhY2hlLCBhbmQgbG9hZGVkIHF1aWNrbHlcbiAgICAvLyBhbmQgbGVhZGluZyB0byB3cm9uZyBidyBlc3RpbWF0aW9uXG4gICAgaWYgKHN0YXRzLmFib3J0ZWQgPT09IHVuZGVmaW5lZCAmJiBkYXRhLmZyYWcubG9hZENvdW50ZXIgPT09IDEpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAocGVyZm9ybWFuY2Uubm93KCkgLSBzdGF0cy50cmVxdWVzdCkgLyAxMDAwO1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgIHRoaXMubGFzdGJ3ID0gKHN0YXRzLmxvYWRlZCAqIDgpIC8gdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbjtcbiAgICAgIC8vY29uc29sZS5sb2coYGZldGNoRHVyYXRpb246JHt0aGlzLmxhc3RmZXRjaGR1cmF0aW9ufSxidzokeyh0aGlzLmxhc3Ridy8xMDAwKS50b0ZpeGVkKDApfS8ke3N0YXRzLmFib3J0ZWR9YCk7XG4gICAgfVxuICB9XG5cbiAgYWJhbmRvblJ1bGVzQ2hlY2soKSB7XG4gICAgLypcbiAgICAgIG1vbml0b3IgZnJhZ21lbnQgcmV0cmlldmFsIHRpbWUuLi5cbiAgICAgIHdlIGNvbXB1dGUgZXhwZWN0ZWQgdGltZSBvZiBhcnJpdmFsIG9mIHRoZSBjb21wbGV0ZSBmcmFnbWVudC5cbiAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICovXG4gICAgbGV0IGhscyA9IHRoaXMuaGxzLCB2ID0gaGxzLm1lZGlhLGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIC8qIG9ubHkgbW9uaXRvciBmcmFnIHJldHJpZXZhbCB0aW1lIGlmXG4gICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKHJlYWR5IHN0YXRlID09PSBIQVZFX05PVEhJTkcgPSAwKSkgQU5EIGF1dG9zd2l0Y2hpbmcgZW5hYmxlZCBBTkQgbm90IGxvd2VzdCBsZXZlbCAoPT4gbWVhbnMgdGhhdCB3ZSBoYXZlIHNldmVyYWwgbGV2ZWxzKSAqL1xuICAgIGlmICh2ICYmICghdi5wYXVzZWQgfHwgIXYucmVhZHlTdGF0ZSkgJiYgZnJhZy5hdXRvTGV2ZWwgJiYgZnJhZy5sZXZlbCkge1xuICAgICAgbGV0IHJlcXVlc3REZWxheSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gZnJhZy50cmVxdWVzdDtcbiAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICBpZiAocmVxdWVzdERlbGF5ID4gKDUwMCAqIGZyYWcuZHVyYXRpb24pKSB7XG4gICAgICAgIGxldCBsb2FkUmF0ZSA9IE1hdGgubWF4KDEsZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5KTsgLy8gYnl0ZS9zOyBhdCBsZWFzdCAxIGJ5dGUvcyB0byBhdm9pZCBkaXZpc2lvbiBieSB6ZXJvXG4gICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gZnJhZy5sb2FkZWQ7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHBvcyA9IHYuY3VycmVudFRpbWU7XG4gICAgICAgIGxldCBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICBsZXQgYnVmZmVyU3RhcnZhdGlvbkRlbGF5ID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odixwb3MsaGxzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5lbmQgLSBwb3M7XG4gICAgICAgIC8vIGNvbnNpZGVyIGVtZXJnZW5jeSBzd2l0Y2ggZG93biBvbmx5IGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBidWZmZXJlZCBBTkRcbiAgICAgICAgLy8gdGltZSB0byBmaW5pc2ggbG9hZGluZyBjdXJyZW50IGZyYWdtZW50IGlzIGJpZ2dlciB0aGFuIGJ1ZmZlciBzdGFydmF0aW9uIGRlbGF5XG4gICAgICAgIC8vIGllIGlmIHdlIHJpc2sgYnVmZmVyIHN0YXJ2YXRpb24gaWYgYncgZG9lcyBub3QgaW5jcmVhc2UgcXVpY2tseVxuICAgICAgICBpZiAoYnVmZmVyU3RhcnZhdGlvbkRlbGF5IDwgMipmcmFnLmR1cmF0aW9uICYmIGZyYWdMb2FkZWREZWxheSA+IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSkge1xuICAgICAgICAgIGxldCBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXksIG5leHRMb2FkTGV2ZWw7XG4gICAgICAgICAgLy8gbGV0cyBpdGVyYXRlIHRocm91Z2ggbG93ZXIgbGV2ZWwgYW5kIHRyeSB0byBmaW5kIHRoZSBiaWdnZXN0IG9uZSB0aGF0IGNvdWxkIGF2b2lkIHJlYnVmZmVyaW5nXG4gICAgICAgICAgLy8gd2Ugc3RhcnQgZnJvbSBjdXJyZW50IGxldmVsIC0gMSBhbmQgd2Ugc3RlcCBkb3duICwgdW50aWwgd2UgZmluZCBhIG1hdGNoaW5nIGxldmVsXG4gICAgICAgICAgZm9yIChuZXh0TG9hZExldmVsID0gZnJhZy5sZXZlbCAtIDEgOyBuZXh0TG9hZExldmVsID49MCA7IG5leHRMb2FkTGV2ZWwtLSkge1xuICAgICAgICAgICAgLy8gY29tcHV0ZSB0aW1lIHRvIGxvYWQgbmV4dCBmcmFnbWVudCBhdCBsb3dlciBsZXZlbFxuICAgICAgICAgICAgLy8gMC44IDogY29uc2lkZXIgb25seSA4MCUgb2YgY3VycmVudCBidyB0byBiZSBjb25zZXJ2YXRpdmVcbiAgICAgICAgICAgIC8vIDggPSBiaXRzIHBlciBieXRlIChicHMvQnBzKVxuICAgICAgICAgICAgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5ID0gZnJhZy5kdXJhdGlvbiAqIGhscy5sZXZlbHNbbmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogMC44ICogbG9hZFJhdGUpO1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZnJhZ0xvYWRlZERlbGF5L2J1ZmZlclN0YXJ2YXRpb25EZWxheS9mcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXlbJHtuZXh0TG9hZExldmVsfV0gOiR7ZnJhZ0xvYWRlZERlbGF5LnRvRml4ZWQoMSl9LyR7YnVmZmVyU3RhcnZhdGlvbkRlbGF5LnRvRml4ZWQoMSl9LyR7ZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5LnRvRml4ZWQoMSl9YCk7XG4gICAgICAgICAgICBpZiAoZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5IDwgYnVmZmVyU3RhcnZhdGlvbkRlbGF5KSB7XG4gICAgICAgICAgICAgIC8vIHdlIGZvdW5kIGEgbG93ZXIgbGV2ZWwgdGhhdCBiZSByZWJ1ZmZlcmluZyBmcmVlIHdpdGggY3VycmVudCBlc3RpbWF0ZWQgYncgIVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gb25seSBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gaWYgaXQgdGFrZXMgbGVzcyB0aW1lIHRvIGxvYWQgbmV3IGZyYWdtZW50IGF0IGxvd2VzdCBsZXZlbCBpbnN0ZWFkXG4gICAgICAgICAgLy8gb2YgZmluaXNoaW5nIGxvYWRpbmcgY3VycmVudCBvbmUgLi4uXG4gICAgICAgICAgaWYgKGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA8IGZyYWdMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgLy8gZW5zdXJlIG5leHRMb2FkTGV2ZWwgaXMgbm90IG5lZ2F0aXZlXG4gICAgICAgICAgICBuZXh0TG9hZExldmVsID0gTWF0aC5tYXgoMCxuZXh0TG9hZExldmVsKTtcbiAgICAgICAgICAgIC8vIGZvcmNlIG5leHQgbG9hZCBsZXZlbCBpbiBhdXRvIG1vZGVcbiAgICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbmV4dExvYWRMZXZlbDtcbiAgICAgICAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgLi4uXG4gICAgICAgICAgICBsb2dnZXIud2FybihgbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZyBhbmQgc3dpdGNoIHRvIGxldmVsICR7bmV4dExvYWRMZXZlbH1gKTtcbiAgICAgICAgICAgIC8vYWJvcnQgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZCgpIHtcbiAgICAvLyBzdG9wIG1vbml0b3JpbmcgYncgb25jZSBmcmFnIGxvYWRlZFxuICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgLy8gc3RvcCB0aW1lciBpbiBjYXNlIG9mIGZyYWcgbG9hZGluZyBlcnJvclxuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuIGNsZWFyVGltZXIoKSB7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LCBobHMgPSB0aGlzLmhscyxhZGp1c3RlZGJ3LCBpLCBtYXhBdXRvTGV2ZWw7XG4gICAgaWYgKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSBobHMubGV2ZWxzLmxlbmd0aCAtIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25leHRBdXRvTGV2ZWwgIT09IC0xKSB7XG4gICAgICB2YXIgbmV4dExldmVsID0gTWF0aC5taW4odGhpcy5fbmV4dEF1dG9MZXZlbCxtYXhBdXRvTGV2ZWwpO1xuICAgICAgaWYgKG5leHRMZXZlbCA9PT0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV4dExldmVsO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IgKGkgPSAwOyBpIDw9IG1heEF1dG9MZXZlbDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZiAoaSA8PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjggKiBsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43ICogbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYgKGFkanVzdGVkYncgPCBobHMubGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIGkgLSAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGkgLSAxO1xuICB9XG5cbiAgc2V0IG5leHRBdXRvTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBYnJDb250cm9sbGVyO1xuXG4iLCIvKlxuICogQnVmZmVyIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cblxuY2xhc3MgQnVmZmVyQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgRXZlbnQuQlVGRkVSX1JFU0VULFxuICAgICAgRXZlbnQuQlVGRkVSX0FQUEVORElORyxcbiAgICAgIEV2ZW50LkJVRkZFUl9DT0RFQ1MsXG4gICAgICBFdmVudC5CVUZGRVJfRU9TLFxuICAgICAgRXZlbnQuQlVGRkVSX0ZMVVNISU5HKTtcblxuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU0JVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25TQlVwZGF0ZUVycm9yLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2UgPSBuZXcgTWVkaWFTb3VyY2UoKTtcbiAgICAvL01lZGlhIFNvdXJjZSBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbk1lZGlhU291cmNlT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTWVkaWFTb3VyY2VFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2MgPSB0aGlzLm9uTWVkaWFTb3VyY2VDbG9zZS5iaW5kKHRoaXMpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgbWVkaWEuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYgKG1zKSB7XG4gICAgICBpZiAobXMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gZW5kT2ZTdHJlYW0gY291bGQgdHJpZ2dlciBleGNlcHRpb24gaWYgYW55IHNvdXJjZWJ1ZmZlciBpcyBpbiB1cGRhdGluZyBzdGF0ZVxuICAgICAgICAgIC8vIHdlIGRvbid0IHJlYWxseSBjYXJlIGFib3V0IGNoZWNraW5nIHNvdXJjZWJ1ZmZlciBzdGF0ZSBoZXJlLFxuICAgICAgICAgIC8vIGFzIHdlIGFyZSBhbnl3YXkgZGV0YWNoaW5nIHRoZSBNZWRpYVNvdXJjZVxuICAgICAgICAgIC8vIGxldCdzIGp1c3QgYXZvaWQgdGhpcyBleGNlcHRpb24gdG8gcHJvcGFnYXRlXG4gICAgICAgICAgbXMuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIud2Fybihgb25NZWRpYURldGFjaGluZzoke2Vyci5tZXNzYWdlfSB3aGlsZSBjYWxsaW5nIGVuZE9mU3RyZWFtYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB0aGlzLm1lZGlhLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYS5yZW1vdmVBdHRyaWJ1dGUoJ3NyYycpO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IG51bGw7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hFRCk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hFRCwgeyBtZWRpYSA6IHRoaXMubWVkaWEgfSk7XG4gICAgLy8gb25jZSByZWNlaXZlZCwgZG9uJ3QgbGlzdGVuIGFueW1vcmUgdG8gc291cmNlb3BlbiBldmVudFxuICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIC8vIGlmIGFueSBidWZmZXIgY29kZWNzIHBlbmRpbmcsIHRyZWF0IGl0IGhlcmUuXG4gICAgdmFyIHBlbmRpbmdUcmFja3MgPSB0aGlzLnBlbmRpbmdUcmFja3M7XG4gICAgaWYgKHBlbmRpbmdUcmFja3MpIHtcbiAgICAgIHRoaXMub25CdWZmZXJDb2RlY3MocGVuZGluZ1RyYWNrcyk7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSBudWxsO1xuICAgICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cblxuXG4gIG9uU0JVcGRhdGVFbmQoKSB7XG5cbiAgICBpZiAodGhpcy5fbmVlZHNGbHVzaCkge1xuICAgICAgdGhpcy5kb0ZsdXNoKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25lZWRzRW9zKSB7XG4gICAgICB0aGlzLm9uQnVmZmVyRW9zKCk7XG4gICAgfVxuXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ERUQpO1xuXG4gICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICB9XG5cbiAgb25TQlVwZGF0ZUVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICAvLyBhY2NvcmRpbmcgdG8gaHR0cDovL3d3dy53My5vcmcvVFIvbWVkaWEtc291cmNlLyNzb3VyY2VidWZmZXItYXBwZW5kLWVycm9yXG4gICAgLy8gdGhpcyBlcnJvciBtaWdodCBub3QgYWx3YXlzIGJlIGZhdGFsIChpdCBpcyBmYXRhbCBpZiBkZWNvZGUgZXJyb3IgaXMgc2V0LCBpbiB0aGF0IGNhc2VcbiAgICAvLyBpdCB3aWxsIGJlIGZvbGxvd2VkIGJ5IGEgbWVkaWFFbGVtZW50IGVycm9yIC4uLilcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiBmYWxzZX0pO1xuICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gZG8gbW9yZSB0aGFuIHRoYXQsIGFzIGFjY29yZGluIHRvIHRoZSBzcGVjLCB1cGRhdGVlbmQgd2lsbCBiZSBmaXJlZCBqdXN0IGFmdGVyXG4gIH1cblxuICBvbkJ1ZmZlclJlc2V0KCkge1xuICAgIHZhciBzb3VyY2VCdWZmZXIgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYik7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5hcHBlbmRlZCA9IDA7XG4gIH1cblxuICBvbkJ1ZmZlckNvZGVjcyh0cmFja3MpIHtcbiAgICB2YXIgc2IsdHJhY2tOYW1lLHRyYWNrLCBjb2RlYywgbWltZVR5cGU7XG5cbiAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IHRyYWNrcztcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB2YXIgc291cmNlQnVmZmVyID0ge30sIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgIGZvciAodHJhY2tOYW1lIGluIHRyYWNrcykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICAvLyB1c2UgbGV2ZWxDb2RlYyBhcyBmaXJzdCBwcmlvcml0eVxuICAgICAgICBjb2RlYyA9IHRyYWNrLmxldmVsQ29kZWMgfHwgdHJhY2suY29kZWM7XG4gICAgICAgIG1pbWVUeXBlID0gYCR7dHJhY2suY29udGFpbmVyfTtjb2RlY3M9JHtjb2RlY31gO1xuICAgICAgICBsb2dnZXIubG9nKGBjcmVhdGluZyBzb3VyY2VCdWZmZXIgd2l0aCBtaW1lVHlwZToke21pbWVUeXBlfWApO1xuICAgICAgICBzYiA9IHNvdXJjZUJ1ZmZlclt0cmFja05hbWVdID0gbWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKG1pbWVUeXBlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBzb3VyY2VCdWZmZXI7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRpbmcoZGF0YSkge1xuICAgIGlmICghdGhpcy5zZWdtZW50cykge1xuICAgICAgdGhpcy5zZWdtZW50cyA9IFsgZGF0YSBdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlZ21lbnRzLnB1c2goZGF0YSk7XG4gICAgfVxuICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kRmFpbChkYXRhKSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtkYXRhLmV2ZW50fWApO1xuICAgIC8vIGFjY29yZGluZyB0byBodHRwOi8vd3d3LnczLm9yZy9UUi9tZWRpYS1zb3VyY2UvI3NvdXJjZWJ1ZmZlci1hcHBlbmQtZXJyb3JcbiAgICAvLyB0aGlzIGVycm9yIG1pZ2h0IG5vdCBhbHdheXMgYmUgZmF0YWwgKGl0IGlzIGZhdGFsIGlmIGRlY29kZSBlcnJvciBpcyBzZXQsIGluIHRoYXQgY2FzZVxuICAgIC8vIGl0IHdpbGwgYmUgZm9sbG93ZWQgYnkgYSBtZWRpYUVsZW1lbnQgZXJyb3IgLi4uKVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fSk7XG4gIH1cblxuICBvbkJ1ZmZlckVvcygpIHtcbiAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlciwgbWVkaWFTb3VyY2UgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmICghbWVkaWFTb3VyY2UgfHwgbWVkaWFTb3VyY2UucmVhZHlTdGF0ZSAhPT0gJ29wZW4nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghKChzYi5hdWRpbyAmJiBzYi5hdWRpby51cGRhdGluZykgfHwgKHNiLnZpZGVvICYmIHNiLnZpZGVvLnVwZGF0aW5nKSkpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2FsbCBtZWRpYSBkYXRhIGF2YWlsYWJsZSwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2UgYW5kIHN0b3AgbG9hZGluZyBmcmFnbWVudCcpO1xuICAgICAgLy9Ob3RpZnkgdGhlIG1lZGlhIGVsZW1lbnQgdGhhdCBpdCBub3cgaGFzIGFsbCBvZiB0aGUgbWVkaWEgZGF0YVxuICAgICAgbWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBvbkJ1ZmZlckZsdXNoaW5nKGRhdGEpIHtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IGRhdGEuc3RhcnRPZmZzZXQsIGVuZDogZGF0YS5lbmRPZmZzZXR9KTtcbiAgICAvLyBhdHRlbXB0IGZsdXNoIGltbWVkaWF0bHlcbiAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgdGhpcy5kb0ZsdXNoKCk7XG4gIH1cblxuICBkb0ZsdXNoKCkge1xuICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgaWYgKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpIHtcbiAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnNoaWZ0KCk7XG4gICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX25lZWRzRmx1c2ggPSB0cnVlO1xuICAgICAgICAvLyBhdm9pZCBsb29waW5nLCB3YWl0IGZvciBTQiB1cGRhdGUgZW5kIHRvIHJldHJpZ2dlciBhIGZsdXNoXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZFxuICAgICAgdGhpcy5fbmVlZHNGbHVzaCA9IGZhbHNlO1xuXG4gICAgICAvLyBsZXQncyByZWNvbXB1dGUgdGhpcy5hcHBlbmRlZCwgd2hpY2ggaXMgdXNlZCB0byBhdm9pZCBmbHVzaCBsb29waW5nXG4gICAgICB2YXIgYXBwZW5kZWQgPSAwO1xuICAgICAgdmFyIHNvdXJjZUJ1ZmZlciA9IHRoaXMuc291cmNlQnVmZmVyO1xuICAgICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIGFwcGVuZGVkICs9IHNvdXJjZUJ1ZmZlclt0eXBlXS5idWZmZXJlZC5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuYXBwZW5kZWQgPSBhcHBlbmRlZDtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNIRUQpO1xuICAgIH1cbiAgfVxuXG4gIGRvQXBwZW5kaW5nKCkge1xuICAgIHZhciBobHMgPSB0aGlzLmhscywgc291cmNlQnVmZmVyID0gdGhpcy5zb3VyY2VCdWZmZXIsIHNlZ21lbnRzID0gdGhpcy5zZWdtZW50cztcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBpZiAodGhpcy5tZWRpYS5lcnJvcikge1xuICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ3RyeWluZyB0byBhcHBlbmQgYWx0aG91Z2ggYSBtZWRpYSBlcnJvciBvY2N1cmVkLCBmbHVzaCBzZWdtZW50IGFuZCBhYm9ydCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBpZiAoc291cmNlQnVmZmVyW3R5cGVdLnVwZGF0aW5nKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiB1cGRhdGUgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHNlZ21lbnQgPSBzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9KTtcblx0XHQgIC8vIGlmIChzb3VyY2VCdWZmZXIuZmlyc3RMb2FkZWQgJiYgIXNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykgeyBcblx0XHQgIFx0Ly8gc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0udGltZXN0YW1wT2Zmc2V0ICs9IDEwO1xuXHRcdCAgLy8gfVxuICAgICAgICAgIHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuXHRcdCAgc291cmNlQnVmZmVyLmZpcnN0TG9hZGVkID0gdHJ1ZTtcblxuXHRcdCAgLy8gc2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0ICAvLyBcdHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLnRpbWVzdGFtcE9mZnNldCA9IDE1O1xuXHRcdCAgLy8gfSwgNSk7XG5cblx0XHQgIGxvZ2dlci5pbmZvKHNlZ21lbnQpO1xuICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAwO1xuICAgICAgICAgIHRoaXMuYXBwZW5kZWQrKztcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBzZWdtZW50cyB0YWJsZVxuICAgICAgICAgIGxvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICBzZWdtZW50cy51bnNoaWZ0KHNlZ21lbnQpO1xuICAgICAgICAgIHZhciBldmVudCA9IHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SfTtcbiAgICAgICAgICBpZihlcnIuY29kZSAhPT0gMjIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yKSB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXZlbnQuZGV0YWlscyA9IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5EX0VSUk9SO1xuICAgICAgICAgICAgZXZlbnQuZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgICAgICAvKiB3aXRoIFVIRCBjb250ZW50LCB3ZSBjb3VsZCBnZXQgbG9vcCBvZiBxdW90YSBleGNlZWRlZCBlcnJvciB1bnRpbFxuICAgICAgICAgICAgICBicm93c2VyIGlzIGFibGUgdG8gZXZpY3Qgc29tZSBkYXRhIGZyb20gc291cmNlYnVmZmVyLiByZXRyeWluZyBoZWxwIHJlY292ZXJpbmcgdGhpc1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yID4gaGxzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5KSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZhaWwgJHtobHMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnl9IHRpbWVzIHRvIGFwcGVuZCBzZWdtZW50IGluIHNvdXJjZUJ1ZmZlcmApO1xuICAgICAgICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV2ZW50LmZhdGFsID0gZmFsc2U7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFF1b3RhRXhjZWVkZWRFcnJvcjogaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvaW5mcmFzdHJ1Y3R1cmUuaHRtbCNxdW90YWV4Y2VlZGVkZXJyb3JcbiAgICAgICAgICAgIC8vIGxldCdzIHN0b3AgYXBwZW5kaW5nIGFueSBzZWdtZW50cywgYW5kIHJlcG9ydCBCVUZGRVJfRlVMTF9FUlJPUiBlcnJvclxuICAgICAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgICAgIGV2ZW50LmRldGFpbHMgPSBFcnJvckRldGFpbHMuQlVGRkVSX0ZVTExfRVJST1I7XG4gICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUixldmVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICBmbHVzaCBzcGVjaWZpZWQgYnVmZmVyZWQgcmFuZ2UsXG4gICAgcmV0dXJuIHRydWUgb25jZSByYW5nZSBoYXMgYmVlbiBmbHVzaGVkLlxuICAgIGFzIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBpcyBhc3luY2hyb25vdXMsIGZsdXNoQnVmZmVyIHdpbGwgYmUgcmV0cmlnZ2VyZWQgb24gc291cmNlQnVmZmVyIHVwZGF0ZSBlbmRcbiAgKi9cbiAgZmx1c2hCdWZmZXIoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkge1xuICAgIHZhciBzYiwgaSwgYnVmU3RhcnQsIGJ1ZkVuZCwgZmx1c2hTdGFydCwgZmx1c2hFbmQ7XG4gICAgLy9sb2dnZXIubG9nKCdmbHVzaEJ1ZmZlcixwb3Mvc3RhcnQvZW5kOiAnICsgdGhpcy5tZWRpYS5jdXJyZW50VGltZSArICcvJyArIHN0YXJ0T2Zmc2V0ICsgJy8nICsgZW5kT2Zmc2V0KTtcbiAgICAvLyBzYWZlZ3VhcmQgdG8gYXZvaWQgaW5maW5pdGUgbG9vcGluZyA6IGRvbid0IHRyeSB0byBmbHVzaCBtb3JlIHRoYW4gdGhlIG5iIG9mIGFwcGVuZGVkIHNlZ21lbnRzXG4gICAgaWYgKHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyIDwgdGhpcy5hcHBlbmRlZCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yICh2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICBpZiAoIXNiLnVwZGF0aW5nKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHNiLmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBidWZTdGFydCA9IHNiLmJ1ZmZlcmVkLnN0YXJ0KGkpO1xuICAgICAgICAgICAgYnVmRW5kID0gc2IuYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmaXJlZm94IG5vdCBhYmxlIHRvIHByb3Blcmx5IGZsdXNoIG11bHRpcGxlIGJ1ZmZlcmVkIHJhbmdlLlxuICAgICAgICAgICAgaWYgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xICYmIGVuZE9mZnNldCA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBzdGFydE9mZnNldDtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBlbmRPZmZzZXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gTWF0aC5tYXgoYnVmU3RhcnQsIHN0YXJ0T2Zmc2V0KTtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBNYXRoLm1pbihidWZFbmQsIGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAoTWF0aC5taW4oZmx1c2hFbmQsYnVmRW5kKSAtIGZsdXNoU3RhcnQgPiAwLjUgKSB7XG4gICAgICAgICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZsdXNoICR7dHlwZX0gWyR7Zmx1c2hTdGFydH0sJHtmbHVzaEVuZH1dLCBvZiBbJHtidWZTdGFydH0sJHtidWZFbmR9XSwgcG9zOiR7dGhpcy5tZWRpYS5jdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgc2IucmVtb3ZlKGZsdXNoU3RhcnQsIGZsdXNoRW5kKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fib3J0ICcgKyB0eXBlICsgJyBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICAvLyB0aGlzIHdpbGwgYWJvcnQgYW55IGFwcGVuZGluZyBpbiBwcm9ncmVzc1xuICAgICAgICAgIC8vc2IuYWJvcnQoKTtcbiAgICAgICAgICBsb2dnZXIud2FybignY2Fubm90IGZsdXNoLCBzYiB1cGRhdGluZyBpbiBwcm9ncmVzcycpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignYWJvcnQgZmx1c2hpbmcgdG9vIG1hbnkgcmV0cmllcycpO1xuICAgIH1cbiAgICBsb2dnZXIubG9nKCdidWZmZXIgZmx1c2hlZCcpO1xuICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZCAhXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVyQ29udHJvbGxlcjtcbiIsIi8qXG4gKiBjYXAgc3RyZWFtIGxldmVsIHRvIG1lZGlhIHNpemUgZGltZW5zaW9uIGNvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcblxuY2xhc3MgQ2FwTGV2ZWxDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblx0Y29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VEKTsgICBcblx0fVxuXHRcblx0ZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmNhcExldmVsVG9QbGF5ZXJTaXplKSB7XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMuYXV0b0xldmVsQ2FwcGluZyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgIHRoaXMudGltZXIgPSBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXHQgIFxuXHRvbk1lZGlhQXR0YWNoaW5nKGRhdGEpIHtcbiAgICB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYSBpbnN0YW5jZW9mIEhUTUxWaWRlb0VsZW1lbnQgPyBkYXRhLm1lZGlhIDogbnVsbDsgIFxuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5jYXBMZXZlbFRvUGxheWVyU2l6ZSkge1xuICAgICAgdGhpcy5hdXRvTGV2ZWxDYXBwaW5nID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICAgIHRoaXMuaGxzLmZpcnN0TGV2ZWwgPSB0aGlzLmdldE1heExldmVsKGRhdGEuZmlyc3RMZXZlbCk7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMuZGV0ZWN0UGxheWVyU2l6ZS5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICAgIHRoaXMuZGV0ZWN0UGxheWVyU2l6ZSgpO1xuICAgIH1cbiAgfVxuICBcbiAgZGV0ZWN0UGxheWVyU2l6ZSgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgbGV0IGxldmVsc0xlbmd0aCA9IHRoaXMubGV2ZWxzID8gdGhpcy5sZXZlbHMubGVuZ3RoIDogMDtcbiAgICAgIGlmIChsZXZlbHNMZW5ndGgpIHtcbiAgICAgICAgdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZyA9IHRoaXMuZ2V0TWF4TGV2ZWwobGV2ZWxzTGVuZ3RoIC0gMSk7XG4gICAgICAgIGlmICh0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nID4gdGhpcy5hdXRvTGV2ZWxDYXBwaW5nKSB7XG4gICAgICAgICAgLy8gaWYgYXV0byBsZXZlbCBjYXBwaW5nIGhhcyBhIGhpZ2hlciB2YWx1ZSBmb3IgdGhlIHByZXZpb3VzIG9uZSwgZmx1c2ggdGhlIGJ1ZmZlciB1c2luZyBuZXh0TGV2ZWxTd2l0Y2hcbiAgICAgICAgICAvLyB1c3VhbGx5IGhhcHBlbiB3aGVuIHRoZSB1c2VyIGdvIHRvIHRoZSBmdWxsc2NyZWVuIG1vZGUuXG4gICAgICAgICAgdGhpcy5obHMuc3RyZWFtQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmF1dG9MZXZlbENhcHBpbmcgPSB0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nOyAgICAgICAgXG4gICAgICB9ICBcbiAgICB9XG4gIH1cbiAgXG4gIC8qXG4gICogcmV0dXJucyBsZXZlbCBzaG91bGQgYmUgdGhlIG9uZSB3aXRoIHRoZSBkaW1lbnNpb25zIGVxdWFsIG9yIGdyZWF0ZXIgdGhhbiB0aGUgbWVkaWEgKHBsYXllcikgZGltZW5zaW9ucyAoc28gdGhlIHZpZGVvIHdpbGwgYmUgZG93bnNjYWxlZClcbiAgKi9cbiAgZ2V0TWF4TGV2ZWwoY2FwTGV2ZWxJbmRleCkge1xuICAgIGxldCByZXN1bHQsXG4gICAgICAgIGksXG4gICAgICAgIGxldmVsLFxuICAgICAgICBtV2lkdGggPSB0aGlzLm1lZGlhV2lkdGgsXG4gICAgICAgIG1IZWlnaHQgPSB0aGlzLm1lZGlhSGVpZ2h0LFxuICAgICAgICBsV2lkdGggPSAwLFxuICAgICAgICBsSGVpZ2h0ID0gMDtcbiAgICAgICAgXG4gICAgZm9yIChpID0gMDsgaSA8PSBjYXBMZXZlbEluZGV4OyBpKyspIHtcbiAgICAgIGxldmVsID0gdGhpcy5sZXZlbHNbaV07XG4gICAgICByZXN1bHQgPSBpO1xuICAgICAgbFdpZHRoID0gbGV2ZWwud2lkdGg7XG4gICAgICBsSGVpZ2h0ID0gbGV2ZWwuaGVpZ2h0O1xuICAgICAgaWYgKG1XaWR0aCA8PSBsV2lkdGggfHwgbUhlaWdodCA8PSBsSGVpZ2h0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgXG4gIGdldCBjb250ZW50U2NhbGVGYWN0b3IoKSB7XG4gICAgbGV0IHBpeGVsUmF0aW8gPSAxO1xuICAgIHRyeSB7XG4gICAgICBwaXhlbFJhdGlvID0gIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuICAgIH0gY2F0Y2goZSkge31cbiAgICByZXR1cm4gcGl4ZWxSYXRpbztcbiAgfVxuICBcbiAgZ2V0IG1lZGlhV2lkdGgoKSB7XG4gICAgbGV0IHdpZHRoO1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB3aWR0aCA9IHRoaXMubWVkaWEud2lkdGggfHwgdGhpcy5tZWRpYS5jbGllbnRXaWR0aCB8fCB0aGlzLm1lZGlhLm9mZnNldFdpZHRoO1xuICAgICAgd2lkdGggKj0gdGhpcy5jb250ZW50U2NhbGVGYWN0b3I7XG4gICAgfVxuICAgIHJldHVybiB3aWR0aDtcbiAgfVxuICBcbiAgZ2V0IG1lZGlhSGVpZ2h0KCkge1xuICAgIGxldCBoZWlnaHQ7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIGhlaWdodCA9IHRoaXMubWVkaWEuaGVpZ2h0IHx8IHRoaXMubWVkaWEuY2xpZW50SGVpZ2h0IHx8IHRoaXMubWVkaWEub2Zmc2V0SGVpZ2h0O1xuICAgICAgaGVpZ2h0ICo9IHRoaXMuY29udGVudFNjYWxlRmFjdG9yOyBcbiAgICB9XG4gICAgcmV0dXJuIGhlaWdodDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDYXBMZXZlbENvbnRyb2xsZXI7IiwiLypcbiAqIExldmVsIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIExldmVsQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuRVJST1IpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMuX21hbnVhbExldmVsID0gLTE7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgdGhpcy5jYW5sb2FkID0gdHJ1ZTtcbiAgICAvLyBzcGVlZCB1cCBsaXZlIHBsYXlsaXN0IHJlZnJlc2ggaWYgdGltZXIgZXhpc3RzXG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIHN0b3BMb2FkKCkge1xuICAgIHRoaXMuY2FubG9hZCA9IGZhbHNlO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChkYXRhKSB7XG4gICAgdmFyIGxldmVsczAgPSBbXSwgbGV2ZWxzID0gW10sIGJpdHJhdGVTdGFydCwgaSwgYml0cmF0ZVNldCA9IHt9LCB2aWRlb0NvZGVjRm91bmQgPSBmYWxzZSwgYXVkaW9Db2RlY0ZvdW5kID0gZmFsc2UsIGhscyA9IHRoaXMuaGxzO1xuXG4gICAgLy8gcmVncm91cCByZWR1bmRhbnQgbGV2ZWwgdG9nZXRoZXJcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIGlmKGxldmVsLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgdmlkZW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmKGxldmVsLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgYXVkaW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHZhciByZWR1bmRhbnRMZXZlbElkID0gYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXTtcbiAgICAgIGlmIChyZWR1bmRhbnRMZXZlbElkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXSA9IGxldmVsczAubGVuZ3RoO1xuICAgICAgICBsZXZlbC51cmwgPSBbbGV2ZWwudXJsXTtcbiAgICAgICAgbGV2ZWwudXJsSWQgPSAwO1xuICAgICAgICBsZXZlbHMwLnB1c2gobGV2ZWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzMFtyZWR1bmRhbnRMZXZlbElkXS51cmwucHVzaChsZXZlbC51cmwpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gcmVtb3ZlIGF1ZGlvLW9ubHkgbGV2ZWwgaWYgd2UgYWxzbyBoYXZlIGxldmVscyB3aXRoIGF1ZGlvK3ZpZGVvIGNvZGVjcyBzaWduYWxsZWRcbiAgICBpZih2aWRlb0NvZGVjRm91bmQgJiYgYXVkaW9Db2RlY0ZvdW5kKSB7XG4gICAgICBsZXZlbHMwLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV2ZWxzID0gbGV2ZWxzMDtcbiAgICB9XG5cbiAgICAvLyBvbmx5IGtlZXAgbGV2ZWwgd2l0aCBzdXBwb3J0ZWQgYXVkaW8vdmlkZW8gY29kZWNzXG4gICAgbGV2ZWxzID0gbGV2ZWxzLmZpbHRlcihmdW5jdGlvbihsZXZlbCkge1xuICAgICAgdmFyIGNoZWNrU3VwcG9ydGVkQXVkaW8gPSBmdW5jdGlvbihjb2RlYykgeyByZXR1cm4gTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKGBhdWRpby9tcDQ7Y29kZWNzPSR7Y29kZWN9YCk7fTtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZFZpZGVvID0gZnVuY3Rpb24oY29kZWMpIHsgcmV0dXJuIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZChgdmlkZW8vbXA0O2NvZGVjcz0ke2NvZGVjfWApO307XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IGxldmVsLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSBsZXZlbC52aWRlb0NvZGVjO1xuXG4gICAgICByZXR1cm4gKCFhdWRpb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkQXVkaW8oYXVkaW9Db2RlYykpICYmXG4gICAgICAgICAgICAgKCF2aWRlb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkVmlkZW8odmlkZW9Db2RlYykpO1xuICAgIH0pO1xuXG4gICAgaWYobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgICAgLy8gc29ydCBsZXZlbCBvbiBiaXRyYXRlXG4gICAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5iaXRyYXRlIC0gYi5iaXRyYXRlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG4gICAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBsb2FkZWQsJHtsZXZlbHMubGVuZ3RofSBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZToke2JpdHJhdGVTdGFydH1gKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB7bGV2ZWxzOiB0aGlzLl9sZXZlbHMsIGZpcnN0TGV2ZWw6IHRoaXMuX2ZpcnN0TGV2ZWwsIHN0YXRzOiBkYXRhLnN0YXRzfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX0lOQ09NUEFUSUJMRV9DT0RFQ1NfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IGhscy51cmwsIHJlYXNvbjogJ25vIGxldmVsIHdpdGggY29tcGF0aWJsZSBjb2RlY3MgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVscztcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZiAodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsIHx8IHRoaXMuX2xldmVsc1tuZXdMZXZlbF0uZGV0YWlscyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpO1xuICAgIH1cbiAgfVxuXG4gc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCkge1xuICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgIGlmIChuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgbG9nZ2VyLmxvZyhgc3dpdGNoaW5nIHRvIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1NXSVRDSCwge2xldmVsOiBuZXdMZXZlbH0pO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgIGlmIChsZXZlbC5kZXRhaWxzID09PSB1bmRlZmluZWQgfHwgbGV2ZWwuZGV0YWlscy5saXZlID09PSB0cnVlKSB7XG4gICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgbG9nZ2VyLmxvZyhgKHJlKWxvYWRpbmcgcGxheWxpc3QgZm9yIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICAgIHZhciB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBuZXdMZXZlbCwgaWQ6IHVybElkfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmFsaWQgbGV2ZWwgaWQgZ2l2ZW4sIHRyaWdnZXIgZXJyb3JcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5PVEhFUl9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkxFVkVMX1NXSVRDSF9FUlJPUiwgbGV2ZWw6IG5ld0xldmVsLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ2ludmFsaWQgbGV2ZWwgaWR4J30pO1xuICAgIH1cbiB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgaWYgKG5ld0xldmVsICE9PSAtMSkge1xuICAgICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICB9XG5cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkVycm9yKGRhdGEpIHtcbiAgICBpZihkYXRhLmZhdGFsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGRldGFpbHMgPSBkYXRhLmRldGFpbHMsIGhscyA9IHRoaXMuaGxzLCBsZXZlbElkLCBsZXZlbDtcbiAgICAvLyB0cnkgdG8gcmVjb3ZlciBub3QgZmF0YWwgZXJyb3JzXG4gICAgc3dpdGNoKGRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX1RJTUVPVVQ6XG4gICAgICAgICBsZXZlbElkID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgICBsZXZlbElkID0gZGF0YS5sZXZlbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLyogdHJ5IHRvIHN3aXRjaCB0byBhIHJlZHVuZGFudCBzdHJlYW0gaWYgYW55IGF2YWlsYWJsZS5cbiAgICAgKiBpZiBubyByZWR1bmRhbnQgc3RyZWFtIGF2YWlsYWJsZSwgZW1lcmdlbmN5IHN3aXRjaCBkb3duIChpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IDApXG4gICAgICogb3RoZXJ3aXNlLCB3ZSBjYW5ub3QgcmVjb3ZlciB0aGlzIG5ldHdvcmsgZXJyb3IgLi4uXG4gICAgICogZG9uJ3QgcmFpc2UgRlJBR19MT0FEX0VSUk9SIGFuZCBGUkFHX0xPQURfVElNRU9VVCBhcyBmYXRhbCwgYXMgaXQgaXMgaGFuZGxlZCBieSBtZWRpYUNvbnRyb2xsZXJcbiAgICAgKi9cbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXTtcbiAgICAgIGlmIChsZXZlbC51cmxJZCA8IChsZXZlbC51cmwubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgbGV2ZWwudXJsSWQrKztcbiAgICAgICAgbGV2ZWwuZGV0YWlscyA9IHVuZGVmaW5lZDtcbiAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBmb3IgbGV2ZWwgJHtsZXZlbElkfTogc3dpdGNoaW5nIHRvIHJlZHVuZGFudCBzdHJlYW0gaWQgJHtsZXZlbC51cmxJZH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIGNvdWxkIHRyeSB0byByZWNvdmVyIGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgbG93ZXN0IGxldmVsICgwKVxuICAgICAgICBsZXQgcmVjb3ZlcmFibGUgPSAoKHRoaXMuX21hbnVhbExldmVsID09PSAtMSkgJiYgbGV2ZWxJZCk7XG4gICAgICAgIGlmIChyZWNvdmVyYWJsZSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc306IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgICAgICAgIGhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWwgPSAwO1xuICAgICAgICB9IGVsc2UgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9IG9uIGxpdmUgc3RyZWFtLCBkaXNjYXJkYCk7XG4gICAgICAgIC8vIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXJlIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICAgIH0gZWxzZSBpZiAoZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiAmJiBkZXRhaWxzICE9PSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGNhbm5vdCByZWNvdmVyICR7ZGV0YWlsc30gZXJyb3JgKTtcbiAgICAgICAgICB0aGlzLl9sZXZlbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICBobHMudHJpZ2dlcihldmVudCwgZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IHBsYXlsaXN0IGlzIGEgbGl2ZSBwbGF5bGlzdFxuICAgIGlmIChkYXRhLmRldGFpbHMubGl2ZSAmJiAhdGhpcy50aW1lcikge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCB3ZSB3aWxsIGhhdmUgdG8gcmVsb2FkIGl0IHBlcmlvZGljYWxseVxuICAgICAgLy8gc2V0IHJlbG9hZCBwZXJpb2QgdG8gcGxheWxpc3QgdGFyZ2V0IGR1cmF0aW9uXG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMDAgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24vMyk7XG4gICAgfVxuICAgIGlmICghZGF0YS5kZXRhaWxzLmxpdmUgJiYgdGhpcy50aW1lcikge1xuICAgICAgLy8gcGxheWxpc3QgaXMgbm90IGxpdmUgYW5kIHRpbWVyIGlzIGFybWVkIDogc3RvcHBpbmcgaXRcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBsZXZlbElkID0gdGhpcy5fbGV2ZWw7XG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCAmJiB0aGlzLmNhbmxvYWQpIHtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXSwgdXJsSWQgPSBsZXZlbC51cmxJZDtcblx0ICB2YXIgdG90YWxEdXJhdGlvbiA9IDA7XG5cdCAgZm9yICh2YXIgZiBpbiBsZXZlbC5kZXRhaWxzLmZyYWdtZW50cyApIHtcblx0XHQgIHRvdGFsRHVyYXRpb24gPSBsZXZlbC5kZXRhaWxzLmZyYWdtZW50c1tmXS5lbmRQVFM7XG5cdCAgfVxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbGV2ZWxJZCwgaWQ6IHVybElkLCB0b3RhbER1cmF0aW9uOiB0b3RhbER1cmF0aW9uIHx8IDB9KTtcbiAgICB9XG4gIH1cblxuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgbmV4dExvYWRMZXZlbChuZXh0TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsID0gbmV4dExldmVsO1xuICAgIGlmICh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpIHtcbiAgICAgIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxDb250cm9sbGVyO1xuXG4iLCIvKlxuICogU3RyZWFtIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBEZW11eGVyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXInO1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgQmluYXJ5U2VhcmNoIGZyb20gJy4uL3V0aWxzL2JpbmFyeS1zZWFyY2gnO1xuaW1wb3J0IEJ1ZmZlckhlbHBlciBmcm9tICcuLi9oZWxwZXIvYnVmZmVyLWhlbHBlcic7XG5pbXBvcnQgTGV2ZWxIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2xldmVsLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY29uc3QgU3RhdGUgPSB7XG4gIFNUT1BQRUQgOiAnU1RPUFBFRCcsXG4gIFNUQVJUSU5HIDogJ1NUQVJUSU5HJyxcbiAgSURMRSA6ICdJRExFJyxcbiAgUEFVU0VEIDogJ1BBVVNFRCcsXG4gIEtFWV9MT0FESU5HIDogJ0tFWV9MT0FESU5HJyxcbiAgRlJBR19MT0FESU5HIDogJ0ZSQUdfTE9BRElORycsXG4gIEZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZIDogJ0ZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZJyxcbiAgV0FJVElOR19MRVZFTCA6ICdXQUlUSU5HX0xFVkVMJyxcbiAgUEFSU0lORyA6ICdQQVJTSU5HJyxcbiAgUEFSU0VEIDogJ1BBUlNFRCcsXG4gIEVOREVEIDogJ0VOREVEJyxcbiAgRVJST1IgOiAnRVJST1InXG59O1xuXG5jbGFzcyBTdHJlYW1Db250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsXG4gICAgICBFdmVudC5NRURJQV9BVFRBQ0hFRCxcbiAgICAgIEV2ZW50Lk1FRElBX0RFVEFDSElORyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICBFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICBFdmVudC5LRVlfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19MT0FERUQsXG4gICAgICBFdmVudC5GUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQsXG4gICAgICBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsXG4gICAgICBFdmVudC5GUkFHX1BBUlNFRCxcbiAgICAgIEV2ZW50LkVSUk9SLFxuICAgICAgRXZlbnQuQlVGRkVSX0FQUEVOREVELFxuICAgICAgRXZlbnQuQlVGRkVSX0ZMVVNIRUQpO1xuXG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSBmYWxzZTtcbiAgICB0aGlzLnRpY2tzID0gMDtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3BMb2FkKCk7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG4gIH1cblxuICBzdGFydExvYWQoc3RhcnRQb3NpdGlvbj0wKSB7XG4gICAgaWYgKHRoaXMubGV2ZWxzKSB7XG4gICAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhLCBsYXN0Q3VycmVudFRpbWUgPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMuc3RvcExvYWQoKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVyKHRoaXMuaGxzKTtcbiAgICAgIGlmICghdGhpcy50aW1lcikge1xuICAgICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxldmVsID0gLTE7XG4gICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSAwO1xuICAgICAgaWYgKG1lZGlhICYmIGxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGBjb25maWd1cmUgc3RhcnRQb3NpdGlvbiBAJHtsYXN0Q3VycmVudFRpbWV9YCk7XG4gICAgICAgIGlmICghdGhpcy5sYXN0UGF1c2VkKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygncmVzdW1pbmcgdmlkZW8nKTtcbiAgICAgICAgICBtZWRpYS5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbiA/IHRoaXMuc3RhcnRQb3NpdGlvbiA6IHN0YXJ0UG9zaXRpb247XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVEFSVElORztcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKCdjYW5ub3Qgc3RhcnQgbG9hZGluZyBhcyBtYW5pZmVzdCBub3QgcGFyc2VkIHlldCcpO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG4gICAgfVxuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnKSB7XG4gICAgICBpZiAoZnJhZy5sb2FkZXIpIHtcbiAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgaWYgKHRoaXMuZGVtdXhlcikge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB0aGlzLnRpY2tzKys7XG4gICAgaWYgKHRoaXMudGlja3MgPT09IDEpIHtcbiAgICAgIHRoaXMuZG9UaWNrKCk7XG4gICAgICBpZiAodGhpcy50aWNrcyA+IDEpIHtcbiAgICAgICAgc2V0VGltZW91dCh0aGlzLnRpY2ssIDEpO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrcyA9IDA7XG4gICAgfVxuICB9XG5cbiAgZG9UaWNrKCkge1xuICAgIHZhciBwb3MsIGxldmVsLCBsZXZlbERldGFpbHMsIGhscyA9IHRoaXMuaGxzLCBjb25maWcgPSBobHMuY29uZmlnO1xuICAgIHN3aXRjaCh0aGlzLnN0YXRlKSB7XG4gICAgICBjYXNlIFN0YXRlLkVSUk9SOlxuICAgICAgICAvL2Rvbid0IGRvIGFueXRoaW5nIGluIGVycm9yIHN0YXRlIHRvIGF2b2lkIGJyZWFraW5nIGZ1cnRoZXIgLi4uXG4gICAgICBjYXNlIFN0YXRlLlBBVVNFRDpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBwYXVzZWQgc3RhdGUgZWl0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IGhscy5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5JRExFOlxuICAgICAgICAvLyBpZiB2aWRlbyBub3QgYXR0YWNoZWQgQU5EXG4gICAgICAgIC8vIHN0YXJ0IGZyYWdtZW50IGFscmVhZHkgcmVxdWVzdGVkIE9SIHN0YXJ0IGZyYWcgcHJlZmV0Y2ggZGlzYWJsZVxuICAgICAgICAvLyBleGl0IGxvb3BcbiAgICAgICAgLy8gPT4gaWYgbWVkaWEgbm90IGF0dGFjaGVkIGJ1dCBzdGFydCBmcmFnIHByZWZldGNoIGlzIGVuYWJsZWQgYW5kIHN0YXJ0IGZyYWcgbm90IHJlcXVlc3RlZCB5ZXQsIHdlIHdpbGwgbm90IGV4aXQgbG9vcFxuICAgICAgICBpZiAoIXRoaXMubWVkaWEgJiZcbiAgICAgICAgICAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgfHwgIWNvbmZpZy5zdGFydEZyYWdQcmVmZXRjaCkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgbGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gd2UgYXJlIG5vdCBhdCBwbGF5YmFjayBzdGFydCwgZ2V0IG5leHQgbG9hZCBsZXZlbCBmcm9tIGxldmVsIENvbnRyb2xsZXJcbiAgICAgICAgICBsZXZlbCA9IGhscy5uZXh0TG9hZExldmVsO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odGhpcy5tZWRpYSxwb3MsY29uZmlnLm1heEJ1ZmZlckhvbGUpLFxuICAgICAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sXG4gICAgICAgICAgICBidWZmZXJFbmQgPSBidWZmZXJJbmZvLmVuZCxcbiAgICAgICAgICAgIGZyYWdQcmV2aW91cyA9IHRoaXMuZnJhZ1ByZXZpb3VzLFxuICAgICAgICAgICAgbWF4QnVmTGVuO1xuXHRcdC8vIGNvbnNvbGUuaW5mbyhidWZmZXJJbmZvKTtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICBpZiAoKHRoaXMubGV2ZWxzW2xldmVsXSkuaGFzT3duUHJvcGVydHkoJ2JpdHJhdGUnKSkge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWF4KDggKiBjb25maWcubWF4QnVmZmVyU2l6ZSAvIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLCBjb25maWcubWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1pbihtYXhCdWZMZW4sIGNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IGNvbmZpZy5tYXhCdWZmZXJMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmIChidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICAvLyBzZXQgbmV4dCBsb2FkIGxldmVsIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICAgIGxldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGluZm8gbm90IHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgZW5zdXJlIHRoYXQgbmV3IHBsYXlsaXN0IGhhcyBiZWVuIHJlZnJlc2hlZCB0byBhdm9pZCBsb2FkaW5nL3RyeSB0byBsb2FkXG4gICAgICAgICAgLy8gYSB1c2VsZXNzIGFuZCBvdXRkYXRlZCBmcmFnbWVudCAodGhhdCBtaWdodCBldmVuIGludHJvZHVjZSBsb2FkIGVycm9yIGlmIGl0IGlzIGFscmVhZHkgb3V0IG9mIHRoZSBsaXZlIHBsYXlsaXN0KVxuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJyB8fCBsZXZlbERldGFpbHMubGl2ZSAmJiB0aGlzLmxldmVsTGFzdExvYWRlZCAhPT0gbGV2ZWwpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgICAgICAgIGZyYWdMZW4gPSBmcmFnbWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgICBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCxcbiAgICAgICAgICAgICAgZW5kID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV0uc3RhcnQgKyBmcmFnbWVudHNbZnJhZ0xlbi0xXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgZnJhZztcblxuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmIChsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLm1lZGlhLnNlZWtpbmd9YCk7XG4gICAgICAgICAgICBsZXQgbWF4TGF0ZW5jeSA9IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uICE9PSB1bmRlZmluZWQgPyBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiA6IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQqbGV2ZWxEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuXG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgTWF0aC5tYXgoc3RhcnQsIGVuZCAtIG1heExhdGVuY3kpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHRhcmdldExhdGVuY3kgPSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gOiBjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbGV2ZWxEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQgPSBzdGFydCArIE1hdGgubWF4KDAsIGxldmVsRGV0YWlscy50b3RhbGR1cmF0aW9uIC0gdGFyZ2V0TGF0ZW5jeSk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYnVmZmVyIGVuZDogJHtidWZmZXJFbmR9IGlzIGxvY2F0ZWQgdG9vIGZhciBmcm9tIHRoZSBlbmQgb2YgbGl2ZSBzbGlkaW5nIHBsYXlsaXN0LCBtZWRpYSBwb3NpdGlvbiB3aWxsIGJlIHJlc2V0ZWQgdG86ICR7dGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICAgIGJ1ZmZlckVuZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgJiYgIWxldmVsRGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgICAgICAvKiB3ZSBhcmUgc3dpdGNoaW5nIGxldmVsIG9uIGxpdmUgcGxheWxpc3QsIGJ1dCB3ZSBkb24ndCBoYXZlIGFueSBQVFMgaW5mbyBmb3IgdGhhdCBxdWFsaXR5IGxldmVsIC4uLlxuICAgICAgICAgICAgICAgICB0cnkgdG8gbG9hZCBmcmFnIG1hdGNoaW5nIHdpdGggbmV4dCBTTi5cbiAgICAgICAgICAgICAgICAgZXZlbiBpZiBTTiBhcmUgbm90IHN5bmNocm9uaXplZCBiZXR3ZWVuIHBsYXlsaXN0cywgbG9hZGluZyB0aGlzIGZyYWcgd2lsbCBoZWxwIHVzXG4gICAgICAgICAgICAgICAgIGNvbXB1dGUgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lIGFmdGVyIGluIGNhc2UgaXQgd2FzIG5vdCB0aGUgcmlnaHQgY29uc2VjdXRpdmUgb25lICovXG4gICAgICAgICAgICAgIGlmIChmcmFnUHJldmlvdXMpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0U04gPSBmcmFnUHJldmlvdXMuc24gKyAxO1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRTTiA+PSBsZXZlbERldGFpbHMuc3RhcnRTTiAmJiB0YXJnZXRTTiA8PSBsZXZlbERldGFpbHMuZW5kU04pIHtcbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbdGFyZ2V0U04gLSBsZXZlbERldGFpbHMuc3RhcnRTTl07XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIGxvYWQgZnJhZyB3aXRoIG5leHQgU046ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICAgICAgLyogd2UgaGF2ZSBubyBpZGVhIGFib3V0IHdoaWNoIGZyYWdtZW50IHNob3VsZCBiZSBsb2FkZWQuXG4gICAgICAgICAgICAgICAgICAgc28gbGV0J3MgbG9hZCBtaWQgZnJhZ21lbnQuIGl0IHdpbGwgaGVscCBjb21wdXRpbmcgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lXG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW01hdGgubWluKGZyYWdMZW4gLSAxLCBNYXRoLnJvdW5kKGZyYWdMZW4gLyAyKSldO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgdW5rbm93biwgbG9hZCBtaWRkbGUgZnJhZyA6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBWb0QgcGxheWxpc3Q6IGlmIGJ1ZmZlckVuZCBiZWZvcmUgc3RhcnQgb2YgcGxheWxpc3QsIGxvYWQgZmlyc3QgZnJhZ21lbnRcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBzdGFydCkge1xuICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgIGxldCBmb3VuZEZyYWc7XG4gICAgICAgICAgICBsZXQgbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSA9IGNvbmZpZy5tYXhGcmFnTG9va1VwVG9sZXJhbmNlO1xuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IGVuZCkge1xuICAgICAgICAgICAgICBpZiAoYnVmZmVyRW5kID4gZW5kIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSkge1xuICAgICAgICAgICAgICAgIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgPSAwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvdW5kRnJhZyA9IEJpbmFyeVNlYXJjaC5zZWFyY2goZnJhZ21lbnRzLCAoY2FuZGlkYXRlKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gb2Zmc2V0IHNob3VsZCBiZSB3aXRoaW4gZnJhZ21lbnQgYm91bmRhcnkgLSBjb25maWcubWF4RnJhZ0xvb2tVcFRvbGVyYW5jZVxuICAgICAgICAgICAgICAgIC8vIHRoaXMgaXMgdG8gY29wZSB3aXRoIHNpdHVhdGlvbnMgbGlrZVxuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlckVuZCA9IDkuOTkxXG4gICAgICAgICAgICAgICAgLy8gZnJhZ1vDmF0gOiBbMCwxMF1cbiAgICAgICAgICAgICAgICAvLyBmcmFnWzFdIDogWzEwLDIwXVxuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlckVuZCBpcyB3aXRoaW4gZnJhZ1swXSByYW5nZSAuLi4gYWx0aG91Z2ggd2hhdCB3ZSBhcmUgZXhwZWN0aW5nIGlzIHRvIHJldHVybiBmcmFnWzFdIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgIGZyYWcgc3RhcnQgICAgICAgICAgICAgICBmcmFnIHN0YXJ0K2R1cmF0aW9uXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgPC0tLT4gICAgICAgICAgICAgICAgICAgICAgICAgPC0tLT5cbiAgICAgICAgICAgICAgICAgICAgLy8gIC4uLi0tLS0tLS0tPjwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLT48LS0tLS0tLS0tLi4uLlxuICAgICAgICAgICAgICAgICAgICAvLyBwcmV2aW91cyBmcmFnICAgICAgICAgbWF0Y2hpbmcgZnJhZ21lbnQgICAgICAgICBuZXh0IGZyYWdcbiAgICAgICAgICAgICAgICAgICAgLy8gIHJldHVybiAtMSAgICAgICAgICAgICByZXR1cm4gMCAgICAgICAgICAgICAgICAgcmV0dXJuIDFcbiAgICAgICAgICAgICAgICAvLyBsb2dnZXIubG9nKGBsZXZlbC9zbi9zdGFydC9lbmQvYnVmRW5kOiR7bGV2ZWx9LyR7Y2FuZGlkYXRlLnNufS8ke2NhbmRpZGF0ZS5zdGFydCAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2V9LyR7KGNhbmRpZGF0ZS5zdGFydCtjYW5kaWRhdGUuZHVyYXRpb24gLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlKX0vJHtidWZmZXJFbmR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKChjYW5kaWRhdGUuc3RhcnQgKyBjYW5kaWRhdGUuZHVyYXRpb24gLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlKSA8PSBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChjYW5kaWRhdGUuc3RhcnQgLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuXHRcdFx0ICBcdC8vIGNvbnNvbGUuaW5mbyhjYW5kaWRhdGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICB9KTtcblx0XHRcdCAgLy8gY29uc29sZS5pbmZvKGZvdW5kRnJhZyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyByZWFjaCBlbmQgb2YgcGxheWxpc3RcbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZm91bmRGcmFnKSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmb3VuZEZyYWc7XG4gICAgICAgICAgICAgIHN0YXJ0ID0gZm91bmRGcmFnLnN0YXJ0O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAvLyBhZGp1c3QgcXVpY2sgbG9hZCBzZWVrIHBvc2l0aW9uIGlmIGl0IGlzIGNsb3NlIHRvIHRoZSBlbmQgb2YgZnJhZ21lbnRcbiAgICAgICAgICAgICAgdmFyIGsgPSBjb25maWcucXVpY2tMb2FkU2Vla1RocmVzaG9sZDtcbiAgICAgICAgICAgICAgdmFyIGVuZF9wb3MgPSAoMS1rKSpmcmFnLmR1cmF0aW9uICsgZnJhZy5zdGFydDtcbiAgICAgICAgICAgICAgaWYgKCF0aGlzLmluaXRpYWxfc2Vlaykge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5pdGlhbF9zZWVrID0gKGJ1ZmZlckVuZCA+IGVuZF9wb3MgPyBlbmRfcG9zIDogYnVmZmVyRW5kKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRU9TKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVOREVEO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWcpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuICAgICAgICAgICAgaWYgKChmcmFnLmRlY3J5cHRkYXRhLnVyaSAhPSBudWxsKSAmJiAoZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYExvYWRpbmcga2V5IGZvciAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuS0VZX0xPQURJTkc7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYExvYWRpbmcgJHtmcmFnLnNufSBvZiBbJHtsZXZlbERldGFpbHMuc3RhcnRTTn0gLCR7bGV2ZWxEZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH0sIGN1cnJlbnRUaW1lOiR7cG9zfSxidWZmZXJFbmQ6JHtidWZmZXJFbmQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgZnJhZy5hdXRvTGV2ZWwgPSBobHMuYXV0b0xldmVsRW5hYmxlZDtcbiAgICAgICAgICAgICAgaWYgKHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gTWF0aC5yb3VuZChmcmFnLmR1cmF0aW9uICogdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUgLyA4KTtcbiAgICAgICAgICAgICAgICBmcmFnLnRyZXF1ZXN0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gZW5zdXJlIHRoYXQgd2UgYXJlIG5vdCByZWxvYWRpbmcgdGhlIHNhbWUgZnJhZ21lbnRzIGluIGxvb3AgLi4uXG4gICAgICAgICAgICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4Kys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgbGV0IG1heFRocmVzaG9sZCA9IGNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBmcmFnIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkIDMgdGltZXMsIGFuZCBpZiBpdCBoYXMgYmVlbiByZWxvYWRlZCByZWNlbnRseVxuICAgICAgICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyID4gbWF4VGhyZXNob2xkICYmIChNYXRoLmFicyh0aGlzLmZyYWdMb2FkSWR4IC0gZnJhZy5sb2FkSWR4KSA8IG1heFRocmVzaG9sZCkpIHtcbiAgICAgICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlciA9IDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZy5sb2FkSWR4ID0gdGhpcy5mcmFnTG9hZElkeDtcbiAgICAgICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IGZyYWc7XG4gICAgICAgICAgICAgIHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FESU5HLCB7ZnJhZzogZnJhZywgY3JlZHM6IHRoaXMuY3JlZHN9KTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLldBSVRJTkdfTEVWRUw6XG4gICAgICAgIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkXG4gICAgICAgIGlmIChsZXZlbCAmJiBsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZOlxuICAgICAgICB2YXIgbm93ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHZhciByZXRyeURhdGUgPSB0aGlzLnJldHJ5RGF0ZTtcbiAgICAgICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICAgICAgdmFyIGlzU2Vla2luZyA9IG1lZGlhICYmIG1lZGlhLnNlZWtpbmc7XG4gICAgICAgIC8vIGlmIGN1cnJlbnQgdGltZSBpcyBndCB0aGFuIHJldHJ5RGF0ZSwgb3IgaWYgbWVkaWEgc2Vla2luZyBsZXQncyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGlmKCFyZXRyeURhdGUgfHwgKG5vdyA+PSByZXRyeURhdGUpIHx8IGlzU2Vla2luZykge1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1lZGlhQ29udHJvbGxlcjogcmV0cnlEYXRlIHJlYWNoZWQsIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGVgKTtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RPUFBFRDpcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTSU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTRUQ6XG4gICAgICBjYXNlIFN0YXRlLkVOREVEOlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjayBidWZmZXJcbiAgICB0aGlzLl9jaGVja0J1ZmZlcigpO1xuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG5cblxuXG4gIGdldEJ1ZmZlclJhbmdlKHBvc2l0aW9uKSB7XG4gICAgdmFyIGksIHJhbmdlLFxuICAgICAgICBidWZmZXJSYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2U7XG4gICAgaWYgKGJ1ZmZlclJhbmdlKSB7XG4gICAgICBmb3IgKGkgPSBidWZmZXJSYW5nZS5sZW5ndGggLSAxOyBpID49MDsgaS0tKSB7XG4gICAgICAgIHJhbmdlID0gYnVmZmVyUmFuZ2VbaV07XG4gICAgICAgIGlmIChwb3NpdGlvbiA+PSByYW5nZS5zdGFydCAmJiBwb3NpdGlvbiA8PSByYW5nZS5lbmQpIHtcbiAgICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgICAgaWYgKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICAvLyBmaXJzdCBnZXQgZW5kIHJhbmdlIG9mIGN1cnJlbnQgZnJhZ21lbnRcbiAgICAgIHJldHVybiB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmb2xsb3dpbmdCdWZmZXJSYW5nZShyYW5nZSkge1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgLy8gdHJ5IHRvIGdldCByYW5nZSBvZiBuZXh0IGZyYWdtZW50ICg1MDBtcyBhZnRlciB0aGlzIHJhbmdlKVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyUmFuZ2UocmFuZ2UuZW5kICsgMC41KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHZhciByYW5nZSA9IHRoaXMubmV4dEJ1ZmZlclJhbmdlO1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLm1lZGlhLCBidWZmZXJlZCA9IHYuYnVmZmVyZWQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHBvc2l0aW9uID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvc2l0aW9uIDw9IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCkge1xuICAgIHZhciByYW5nZUN1cnJlbnQsIGN1cnJlbnRUaW1lLCB2aWRlbyA9IHRoaXMubWVkaWE7XG4gICAgaWYgKHZpZGVvICYmIHZpZGVvLnNlZWtpbmcgPT09IGZhbHNlKSB7XG4gICAgICBjdXJyZW50VGltZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgLyogaWYgdmlkZW8gZWxlbWVudCBpcyBpbiBzZWVrZWQgc3RhdGUsIGN1cnJlbnRUaW1lIGNhbiBvbmx5IGluY3JlYXNlLlxuICAgICAgICAoYXNzdW1pbmcgdGhhdCBwbGF5YmFjayByYXRlIGlzIHBvc2l0aXZlIC4uLilcbiAgICAgICAgQXMgc29tZXRpbWVzIGN1cnJlbnRUaW1lIGp1bXBzIGJhY2sgdG8gemVybyBhZnRlciBhXG4gICAgICAgIG1lZGlhIGRlY29kZSBlcnJvciwgY2hlY2sgdGhpcywgdG8gYXZvaWQgc2Vla2luZyBiYWNrIHRvXG4gICAgICAgIHdyb25nIHBvc2l0aW9uIGFmdGVyIGEgbWVkaWEgZGVjb2RlIGVycm9yXG4gICAgICAqL1xuICAgICAgaWYoY3VycmVudFRpbWUgPiB2aWRlby5wbGF5YmFja1JhdGUqdGhpcy5sYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSBjdXJyZW50VGltZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUpKSB7XG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUgKyAwLjEpKSB7XG4gICAgICAgIC8qIGVuc3VyZSB0aGF0IEZSQUdfQ0hBTkdFRCBldmVudCBpcyB0cmlnZ2VyZWQgYXQgc3RhcnR1cCxcbiAgICAgICAgICB3aGVuIGZpcnN0IHZpZGVvIGZyYW1lIGlzIGRpc3BsYXllZCBhbmQgcGxheWJhY2sgaXMgcGF1c2VkLlxuICAgICAgICAgIGFkZCBhIHRvbGVyYW5jZSBvZiAxMDBtcywgaW4gY2FzZSBjdXJyZW50IHBvc2l0aW9uIGlzIG5vdCBidWZmZXJlZCxcbiAgICAgICAgICBjaGVjayBpZiBjdXJyZW50IHBvcysxMDBtcyBpcyBidWZmZXJlZCBhbmQgdXNlIHRoYXQgYnVmZmVyIHJhbmdlXG4gICAgICAgICAgZm9yIEZSQUdfQ0hBTkdFRCBldmVudCByZXBvcnRpbmcgKi9cbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSArIDAuMSk7XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2VDdXJyZW50KSB7XG4gICAgICAgIHZhciBmcmFnUGxheWluZyA9IHJhbmdlQ3VycmVudC5mcmFnO1xuICAgICAgICBpZiAoZnJhZ1BsYXlpbmcgIT09IHRoaXMuZnJhZ1BsYXlpbmcpIHtcbiAgICAgICAgICB0aGlzLmZyYWdQbGF5aW5nID0gZnJhZ1BsYXlpbmc7XG4gICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0NIQU5HRUQsIHtmcmFnOiBmcmFnUGxheWluZ30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIDpcbiAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgIC0gY2FuY2VsIGFueSBwZW5kaW5nIGxvYWQgcmVxdWVzdFxuICAgICAtIGFuZCB0cmlnZ2VyIGEgYnVmZmVyIGZsdXNoXG4gICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGxvZ2dlci5sb2coJ2ltbWVkaWF0ZUxldmVsU3dpdGNoJyk7XG4gICAgaWYgKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy5tZWRpYS5wYXVzZWQ7XG4gICAgICB0aGlzLm1lZGlhLnBhdXNlKCk7XG4gICAgfVxuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIC8vIGZsdXNoIGV2ZXJ5dGhpbmdcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiAwLCBlbmRPZmZzZXQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICAvKlxuICAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAgIC0gbnVkZ2UgdmlkZW8gZGVjb2RlciBieSBzbGlnaHRseSBhZGp1c3RpbmcgdmlkZW8gY3VycmVudFRpbWVcbiAgICAgIC0gcmVzdW1lIHRoZSBwbGF5YmFjayBpZiBuZWVkZWRcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lIC09IDAuMDAwMTtcbiAgICBpZiAoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy5tZWRpYS5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LCBjdXJyZW50UmFuZ2UsIG5leHRSYW5nZTtcbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgIGlmIChjdXJyZW50UmFuZ2UgJiYgY3VycmVudFJhbmdlLnN0YXJ0ID4gMSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiAwLCBlbmRPZmZzZXQ6IGN1cnJlbnRSYW5nZS5zdGFydCAtIDF9KTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgfVxuICAgIGlmICghdGhpcy5tZWRpYS5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgdmFyIG5leHRMZXZlbElkID0gdGhpcy5obHMubmV4dExvYWRMZXZlbCxuZXh0TGV2ZWwgPSB0aGlzLmxldmVsc1tuZXh0TGV2ZWxJZF0sIGZyYWdMYXN0S2JwcyA9IHRoaXMuZnJhZ0xhc3RLYnBzO1xuICAgICAgaWYgKGZyYWdMYXN0S2JwcyAmJiB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSB0aGlzLmZyYWdDdXJyZW50LmR1cmF0aW9uICogbmV4dExldmVsLmJpdHJhdGUgLyAoMTAwMCAqIGZyYWdMYXN0S2JwcykgKyAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAvLyB3ZSBjYW4gZmx1c2ggYnVmZmVyIHJhbmdlIGZvbGxvd2luZyB0aGlzIG9uZSB3aXRob3V0IHN0YWxsaW5nIHBsYXliYWNrXG4gICAgICBuZXh0UmFuZ2UgPSB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKG5leHRSYW5nZSk7XG4gICAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAgIC8vIGZsdXNoIHBvc2l0aW9uIGlzIHRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGlzIG5ldyBidWZmZXJcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRkxVU0hJTkcsIHtzdGFydE9mZnNldDogbmV4dFJhbmdlLnN0YXJ0LCBlbmRPZmZzZXQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFVU0VEO1xuICAgICAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgd2UgY2FuIGFsc28gY2FuY2VsIGFueSBsb2FkaW5nL2RlbXV4aW5nIGluIHByb2dyZXNzLCBhcyB0aGV5IGFyZSB1c2VsZXNzXG4gICAgICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAgICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hlZChkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbk1lZGlhU2Vla2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252c2Vla2VkID0gdGhpcy5vbk1lZGlhU2Vla2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZlbmRlZCA9IHRoaXMub25NZWRpYUVuZGVkLmJpbmQodGhpcyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgIG1lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgaWYodGhpcy5sZXZlbHMgJiYgdGhpcy5jb25maWcuYXV0b1N0YXJ0TG9hZCkge1xuICAgICAgdGhpcy5obHMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmIChtZWRpYSAmJiBtZWRpYS5lbmRlZCkge1xuICAgICAgbG9nZ2VyLmxvZygnTVNFIGRldGFjaGluZyBhbmQgdmlkZW8gZW5kZWQsIHJlc2V0IHN0YXJ0UG9zaXRpb24nKTtcbiAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkaW5nIGNvdW50ZXIgb24gTVNFIGRldGFjaGluZyB0byBhdm9pZCByZXBvcnRpbmcgRlJBR19MT09QX0xPQURJTkdfRVJST1IgYWZ0ZXIgZXJyb3IgcmVjb3ZlcnlcbiAgICB2YXIgbGV2ZWxzID0gdGhpcy5sZXZlbHM7XG4gICAgaWYgKGxldmVscykge1xuICAgICAgLy8gcmVzZXQgZnJhZ21lbnQgbG9hZCBjb3VudGVyXG4gICAgICAgIGxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgICBpZihsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgICBsZXZlbC5kZXRhaWxzLmZyYWdtZW50cy5mb3JFYWNoKGZyYWdtZW50ID0+IHtcbiAgICAgICAgICAgICAgZnJhZ21lbnQubG9hZENvdW50ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyc1xuICAgIGlmIChtZWRpYSkge1xuICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgID0gdGhpcy5vbnZlbmRlZCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICB0aGlzLnN0b3BMb2FkKCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2luZygpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYgKEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHRoaXMubWVkaWEsdGhpcy5tZWRpYS5jdXJyZW50VGltZSx0aGlzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oJ3NlZWtpbmcgb3V0c2lkZSBvZiBidWZmZXIgd2hpbGUgZnJhZ21lbnQgbG9hZCBpbiBwcm9ncmVzcywgY2FuY2VsIGZyYWdtZW50IGxvYWQnKTtcbiAgICAgICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgaWYgKGZyYWdDdXJyZW50KSB7XG4gICAgICAgICAgaWYgKGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgLy8gc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gbG9hZCBuZXcgZnJhZ21lbnRcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5FTkRFRCkge1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBjaGVjayBmb3IgcG90ZW50aWFsIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB9XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gYXZvaWQgcmVwb3J0aW5nIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciBpbiBjYXNlIHVzZXIgaXMgc2Vla2luZyBzZXZlcmFsIHRpbWVzIG9uIHNhbWUgcG9zaXRpb25cbiAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYVNlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIGVuZGVkJyk7XG4gICAgLy8gcmVzZXQgc3RhcnRQb3NpdGlvbiBhbmQgbGFzdEN1cnJlbnRUaW1lIHRvIHJlc3RhcnQgcGxheWJhY2sgQCBzdHJlYW0gYmVnaW5uaW5nXG4gICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICB9XG5cblxuICBvbk1hbmlmZXN0TG9hZGluZyhkYXRhKSB7XG4gICAgLy8gcmVzZXQgYnVmZmVyIG9uIG1hbmlmZXN0IGxvYWRpbmdcbiAgICBsb2dnZXIubG9nKCd0cmlnZ2VyIEJVRkZFUl9SRVNFVCcpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX1JFU0VUKTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgdGhpcy5zdGFsbGVkID0gZmFsc2U7XG5cdHRoaXMuY3JlZHMgPSBkYXRhLmNyZWRzO1xuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgdmFyIGFhYyA9IGZhbHNlLCBoZWFhYyA9IGZhbHNlLCBjb2RlYztcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICBjb2RlYyA9IGxldmVsLmF1ZGlvQ29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgIGhlYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3aXRjaCA9IChhYWMgJiYgaGVhYWMpO1xuICAgIGlmICh0aGlzLmF1ZGlvQ29kZWNTd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBsZXZlbCBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLmhscy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgbmV3RGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGR1cmF0aW9uID0gbmV3RGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICBzbGlkaW5nID0gMDtcblxuICAgIGxvZ2dlci5sb2coYGxldmVsICR7bmV3TGV2ZWxJZH0gbG9hZGVkIFske25ld0RldGFpbHMuc3RhcnRTTn0sJHtuZXdEZXRhaWxzLmVuZFNOfV0sZHVyYXRpb246JHtkdXJhdGlvbn1gKTtcbiAgICB0aGlzLmxldmVsTGFzdExvYWRlZCA9IG5ld0xldmVsSWQ7XG5cbiAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgY3VyRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICBpZiAoY3VyRGV0YWlscykge1xuICAgICAgICAvLyB3ZSBhbHJlYWR5IGhhdmUgZGV0YWlscyBmb3IgdGhhdCBsZXZlbCwgbWVyZ2UgdGhlbVxuICAgICAgICBMZXZlbEhlbHBlci5tZXJnZURldGFpbHMoY3VyRGV0YWlscyxuZXdEZXRhaWxzKTtcbiAgICAgICAgc2xpZGluZyA9IG5ld0RldGFpbHMuZnJhZ21lbnRzWzBdLnN0YXJ0O1xuICAgICAgICBpZiAobmV3RGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke3NsaWRpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gb3V0ZGF0ZWQgUFRTLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gZmlyc3QgbG9hZCwgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGN1ckxldmVsLmRldGFpbHMgPSBuZXdEZXRhaWxzO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfVVBEQVRFRCwgeyBkZXRhaWxzOiBuZXdEZXRhaWxzLCBsZXZlbDogbmV3TGV2ZWxJZCB9KTtcblxuICAgIC8vIGNvbXB1dGUgc3RhcnQgcG9zaXRpb25cbiAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBzZXQgc3RhcnQgcG9zaXRpb24gdG8gYmUgZnJhZ21lbnQgTi10aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKHVzdWFsbHkgMylcbiAgICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgbGV0IHRhcmdldExhdGVuY3kgPSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uICE9PSB1bmRlZmluZWQgPyB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uIDogdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbmV3RGV0YWlscy50YXJnZXRkdXJhdGlvbjtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCwgc2xpZGluZyArIGR1cmF0aW9uIC0gdGFyZ2V0TGF0ZW5jeSk7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbktleUxvYWRlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuS0VZX0xPQURJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcgJiZcbiAgICAgICAgZnJhZ0N1cnJlbnQgJiZcbiAgICAgICAgZGF0YS5mcmFnLmxldmVsID09PSBmcmFnQ3VycmVudC5sZXZlbCAmJlxuICAgICAgICBkYXRhLmZyYWcuc24gPT09IGZyYWdDdXJyZW50LnNuKSB7XG4gICAgICBpZiAodGhpcy5mcmFnQml0cmF0ZVRlc3QgPT09IHRydWUpIHtcbiAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSAuLi4gd2UganVzdCBsb2FkZWQgYSBmcmFnbWVudCB0byBkZXRlcm1pbmUgYWRlcXVhdGUgc3RhcnQgYml0cmF0ZSBhbmQgaW5pdGlhbGl6ZSBhdXRvc3dpdGNoIGFsZ29cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID0gZmFsc2U7XG4gICAgICAgIGRhdGEuc3RhdHMudHBhcnNlZCA9IGRhdGEuc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBkYXRhLnN0YXRzLCBmcmFnOiBmcmFnQ3VycmVudH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICAgIGRldGFpbHMgPSBjdXJyZW50TGV2ZWwuZGV0YWlscyxcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICAgICAgc3RhcnQgPSBmcmFnQ3VycmVudC5zdGFydCxcbiAgICAgICAgICAgIGxldmVsID0gZnJhZ0N1cnJlbnQubGV2ZWwsXG4gICAgICAgICAgICBzbiA9IGZyYWdDdXJyZW50LnNuLFxuICAgICAgICAgICAgYXVkaW9Db2RlYyA9IGN1cnJlbnRMZXZlbC5hdWRpb0NvZGVjIHx8IHRoaXMuY29uZmlnLmRlZmF1bHRBdWRpb0NvZGVjO1xuICAgICAgICBpZih0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSB0aGlzLmxhc3RBdWRpb0NvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nID0gMDtcbiAgICAgICAgLy8gbG9nZ2VyLmxvZyhgRGVtdXhpbmcgJHtzbn0gb2YgWyR7ZGV0YWlscy5zdGFydFNOfSAsJHtkZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH1gKTtcbi8vIFx0XHR2YXIgcmUgPSAvKFxcZCspX1xcZCsudHMvO1xuLy8gXHRcdHZhciB0MCA9IDA7XG4vLyBcdFx0dmFyIG0gPSByZS5leGVjKGZyYWdDdXJyZW50LnVybCk7XG4vLyBcdFx0dmFyIHQwID0gKG0gJiYgbVsxXSkgPyBwYXJzZUludCggbVsxXSApLzEwMDAgOiAwO1xuLy9cbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLCBhdWRpb0NvZGVjLCBjdXJyZW50TGV2ZWwudmlkZW9Db2RlYywgc3RhcnQsIGZyYWdDdXJyZW50LmNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBmcmFnQ3VycmVudC5kZWNyeXB0ZGF0YSwgc3RhcnQpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSAwO1xuICB9XG5cbiAgb25GcmFnUGFyc2luZ0luaXRTZWdtZW50KGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdmFyIHRyYWNrcyA9IGRhdGEudHJhY2tzLCB0cmFja05hbWUsIHRyYWNrO1xuXG4gICAgICAvLyBpbmNsdWRlIGxldmVsQ29kZWMgaW4gYXVkaW8gYW5kIHZpZGVvIHRyYWNrc1xuICAgICAgdHJhY2sgPSB0cmFja3MuYXVkaW87XG4gICAgICBpZih0cmFjaykge1xuICAgICAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsXG4gICAgICAgICAgICB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYoYXVkaW9Db2RlYyAmJiB0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gaW4gY2FzZSBBQUMgYW5kIEhFLUFBQyBhdWRpbyBjb2RlY3MgYXJlIHNpZ25hbGxlZCBpbiBtYW5pZmVzdFxuICAgICAgICAvLyBmb3JjZSBIRS1BQUMgLCBhcyBpdCBzZWVtcyB0aGF0IG1vc3QgYnJvd3NlcnMgcHJlZmVycyB0aGF0IHdheSxcbiAgICAgICAgLy8gZXhjZXB0IGZvciBtb25vIHN0cmVhbXMgT1Igb24gRkZcbiAgICAgICAgLy8gdGhlc2UgY29uZGl0aW9ucyBtaWdodCBuZWVkIHRvIGJlIHJldmlld2VkIC4uLlxuICAgICAgICBpZiAodGhpcy5hdWRpb0NvZGVjU3dpdGNoKSB7XG4gICAgICAgICAgICAvLyBkb24ndCBmb3JjZSBIRS1BQUMgaWYgbW9ubyBzdHJlYW1cbiAgICAgICAgICAgaWYodHJhY2subWV0YWRhdGEuY2hhbm5lbENvdW50ICE9PSAxICYmXG4gICAgICAgICAgICAvLyBkb24ndCBmb3JjZSBIRS1BQUMgaWYgZmlyZWZveFxuICAgICAgICAgICAgdWEuaW5kZXhPZignZmlyZWZveCcpID09PSAtMSkge1xuICAgICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEhFLUFBQyBpcyBicm9rZW4gb24gQW5kcm9pZCwgYWx3YXlzIHNpZ25hbCBhdWRpbyBjb2RlYyBhcyBBQUMgZXZlbiBpZiB2YXJpYW50IG1hbmlmZXN0IHN0YXRlcyBvdGhlcndpc2VcbiAgICAgICAgaWYodWEuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICBsb2dnZXIubG9nKGBBbmRyb2lkOiBmb3JjZSBhdWRpbyBjb2RlYyB0b2AgKyBhdWRpb0NvZGVjKTtcbiAgICAgICAgfVxuICAgICAgICB0cmFjay5sZXZlbENvZGVjID0gYXVkaW9Db2RlYztcbiAgICAgIH1cbiAgICAgIHRyYWNrID0gdHJhY2tzLnZpZGVvO1xuICAgICAgaWYodHJhY2spIHtcbiAgICAgICAgdHJhY2subGV2ZWxDb2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWM7XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIHJlbXV4ZXIgc3BlY2lmeSB0aGF0IGEgdW5pcXVlIHRyYWNrIG5lZWRzIHRvIGdlbmVyYXRlZCxcbiAgICAgIC8vIGxldCdzIG1lcmdlIGFsbCB0cmFja3MgdG9nZXRoZXJcbiAgICAgIGlmIChkYXRhLnVuaXF1ZSkge1xuICAgICAgICB2YXIgbWVyZ2VkVHJhY2sgPSB7XG4gICAgICAgICAgICBjb2RlYyA6ICcnLFxuICAgICAgICAgICAgbGV2ZWxDb2RlYyA6ICcnXG4gICAgICAgICAgfTtcbiAgICAgICAgZm9yICh0cmFja05hbWUgaW4gZGF0YS50cmFja3MpIHtcbiAgICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICAgIG1lcmdlZFRyYWNrLmNvbnRhaW5lciA9IHRyYWNrLmNvbnRhaW5lcjtcbiAgICAgICAgICBpZiAobWVyZ2VkVHJhY2suY29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmNvZGVjICs9ICAnLCc7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5sZXZlbENvZGVjICs9ICAnLCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKHRyYWNrLmNvZGVjKSB7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5jb2RlYyArPSAgdHJhY2suY29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0cmFjay5sZXZlbENvZGVjKSB7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5sZXZlbENvZGVjICs9ICB0cmFjay5sZXZlbENvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0cmFja3MgPSB7IGF1ZGlvdmlkZW8gOiBtZXJnZWRUcmFjayB9O1xuICAgICAgfVxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQ09ERUNTLHRyYWNrcyk7XG4gICAgICAvLyBsb29wIHRocm91Z2ggdHJhY2tzIHRoYXQgYXJlIGdvaW5nIHRvIGJlIHByb3ZpZGVkIHRvIGJ1ZmZlckNvbnRyb2xsZXJcbiAgICAgIGZvciAodHJhY2tOYW1lIGluIHRyYWNrcykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICBsb2dnZXIubG9nKGB0cmFjazoke3RyYWNrTmFtZX0sY29udGFpbmVyOiR7dHJhY2suY29udGFpbmVyfSxjb2RlY3NbbGV2ZWwvcGFyc2VkXT1bJHt0cmFjay5sZXZlbENvZGVjfS8ke3RyYWNrLmNvZGVjfV1gKTtcbiAgICAgICAgdmFyIGluaXRTZWdtZW50ID0gdHJhY2suaW5pdFNlZ21lbnQ7XG4gICAgICAgIGlmIChpbml0U2VnbWVudCkge1xuICAgICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZysrO1xuICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVORElORywge3R5cGU6IHRyYWNrTmFtZSwgZGF0YTogaW5pdFNlZ21lbnR9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nRGF0YShkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMudHBhcnNlMiA9IERhdGUubm93KCk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcblxuICAgICAgbG9nZ2VyLmluZm8oYHBhcnNlZCAke2RhdGEudHlwZX0sUFRTOlske2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0sJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfV0sRFRTOlske2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfV0sbmI6JHtkYXRhLm5ifWApO1xuXG4gICAgICB2YXIgZHJpZnQgPSBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKGxldmVsLmRldGFpbHMsZnJhZy5zbixkYXRhLnN0YXJ0UFRTLGRhdGEuZW5kUFRTKSxcbiAgICAgICAgICBobHMgPSB0aGlzLmhscztcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1BUU19VUERBVEVELCB7ZGV0YWlsczogbGV2ZWwuZGV0YWlscywgbGV2ZWw6IHRoaXMubGV2ZWwsIGRyaWZ0OiBkcmlmdH0pO1xuXG4gICAgICBbZGF0YS5kYXRhMSwgZGF0YS5kYXRhMl0uZm9yRWFjaChidWZmZXIgPT4ge1xuICAgICAgICBpZiAoYnVmZmVyKSB7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nKys7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVORElORywge3R5cGU6IGRhdGEudHlwZSwgZGF0YTogYnVmZmVyfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSBkYXRhLmVuZFBUUztcbiAgICAgIHRoaXMuYnVmZmVyUmFuZ2UucHVzaCh7dHlwZTogZGF0YS50eXBlLCBzdGFydDogZGF0YS5zdGFydFBUUywgZW5kOiBkYXRhLmVuZFBUUywgZnJhZzogZnJhZ30pO1xuXG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2Fybihgbm90IGluIFBBUlNJTkcgc3RhdGUgYnV0ICR7dGhpcy5zdGF0ZX0sIGlnbm9yaW5nIEZSQUdfUEFSU0lOR19EQVRBIGV2ZW50YCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnUGFyc2VkKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTRUQ7XG4gICAgICB0aGlzLl9jaGVja0FwcGVuZGVkUGFyc2VkKCk7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRlZCgpIHtcbiAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0lORzpcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0VEOlxuICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmctLTtcbiAgICAgICAgdGhpcy5fY2hlY2tBcHBlbmRlZFBhcnNlZCgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIF9jaGVja0FwcGVuZGVkUGFyc2VkKCkge1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTRUQgJiYgdGhpcy5wZW5kaW5nQXBwZW5kaW5nID09PSAwKSAge1xuICAgICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50LCBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgICBpZiAoZnJhZykge1xuICAgICAgICB0aGlzLmZyYWdQcmV2aW91cyA9IGZyYWc7XG4gICAgICAgIHN0YXRzLnRidWZmZXJlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLmZyYWdMYXN0S2JwcyA9IE1hdGgucm91bmQoOCAqIHN0YXRzLmxlbmd0aCAvIChzdGF0cy50YnVmZmVyZWQgLSBzdGF0cy50Zmlyc3QpKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IHN0YXRzLCBmcmFnOiBmcmFnfSk7XG5cdFx0Ly8gY29uc29sZS5pbmZvKHN0YXRzKTtcblx0XHQvLyBjb25zb2xlLmluZm8oZnJhZyk7XG4gICAgICAgIGxvZ2dlci5pbmZvKGBtZWRpYSBidWZmZXJlZCA6ICR7dGhpcy50aW1lUmFuZ2VzVG9TdHJpbmcodGhpcy5tZWRpYS5idWZmZXJlZCl9YCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGlmKCFkYXRhLmZhdGFsKSB7XG4gICAgICAgICAgdmFyIGxvYWRFcnJvciA9IHRoaXMuZnJhZ0xvYWRFcnJvcjtcbiAgICAgICAgICBpZihsb2FkRXJyb3IpIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcisrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkRXJyb3I9MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGxvYWRFcnJvciA8PSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5KSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSBsb2FkRXJyb3I7XG4gICAgICAgICAgICAvLyByZXNldCBsb2FkIGNvdW50ZXIgdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3JcbiAgICAgICAgICAgIGRhdGEuZnJhZy5sb2FkQ291bnRlciA9IDA7XG4gICAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmIGNhcHBlZCB0byA2NHNcbiAgICAgICAgICAgIHZhciBkZWxheSA9IE1hdGgubWluKE1hdGgucG93KDIsbG9hZEVycm9yLTEpKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiBmcmFnIGxvYWRpbmcgZmFpbGVkLCByZXRyeSBpbiAke2RlbGF5fSBtc2ApO1xuICAgICAgICAgICAgdGhpcy5yZXRyeURhdGUgPSBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5O1xuICAgICAgICAgICAgLy8gcmV0cnkgbG9hZGluZyBzdGF0ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHJlYWNoZXMgbWF4IHJldHJ5LCByZWRpc3BhdGNoIGFzIGZhdGFsIC4uLmApO1xuICAgICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGRhdGEpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IFN0YXRlLkVSUk9SIDogU3RhdGUuSURMRTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5CVUZGRVJfRlVMTF9FUlJPUjpcbiAgICAgICAgLy8gdHJpZ2dlciBhIHNtb290aCBsZXZlbCBzd2l0Y2ggdG8gZW1wdHkgYnVmZmVyc1xuICAgICAgICAvLyBhbHNvIHJlZHVjZSBtYXggYnVmZmVyIGxlbmd0aCBhcyBpdCBtaWdodCBiZSB0b28gaGlnaC4gd2UgZG8gdGhpcyB0byBhdm9pZCBsb29wIGZsdXNoaW5nIC4uLlxuICAgICAgICB0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgvPTI7XG4gICAgICAgIGxvZ2dlci53YXJuKGByZWR1Y2UgbWF4IGJ1ZmZlciBsZW5ndGggdG8gJHt0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGh9cyBhbmQgdHJpZ2dlciBhIG5leHRMZXZlbFN3aXRjaCB0byBmbHVzaCBvbGQgYnVmZmVyIGFuZCBmaXggUXVvdGFFeGNlZWRlZEVycm9yYCk7XG4gICAgICAgIHRoaXMubmV4dExldmVsU3dpdGNoKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbl9jaGVja0J1ZmZlcigpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmKG1lZGlhKSB7XG4gICAgICAvLyBjb21wYXJlIHJlYWR5U3RhdGVcbiAgICAgIHZhciByZWFkeVN0YXRlID0gbWVkaWEucmVhZHlTdGF0ZTtcbiAgICAgIC8vIGlmIHJlYWR5IHN0YXRlIGRpZmZlcmVudCBmcm9tIEhBVkVfTk9USElORyAobnVtZXJpYyB2YWx1ZSAwKSwgd2UgYXJlIGFsbG93ZWQgdG8gc2Vla1xuICAgICAgaWYocmVhZHlTdGF0ZSkge1xuICAgICAgICB2YXIgdGFyZ2V0U2Vla1Bvc2l0aW9uLCBjdXJyZW50VGltZTtcbiAgICAgICAgLy8gaWYgc2VlayBhZnRlciBidWZmZXJlZCBkZWZpbmVkLCBsZXQncyBzZWVrIGlmIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgIHZhciBzZWVrQWZ0ZXJCdWZmZXJlZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgIGlmKHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgaWYobWVkaWEuZHVyYXRpb24gPj0gc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICAgIHRhcmdldFNlZWtQb3NpdGlvbiA9IHNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3VycmVudFRpbWUgPSBtZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgICB2YXIgbG9hZGVkbWV0YWRhdGEgPSB0aGlzLmxvYWRlZG1ldGFkYXRhO1xuXG4gICAgICAgICAgLy8gYWRqdXN0IGN1cnJlbnRUaW1lIHRvIHN0YXJ0IHBvc2l0aW9uIG9uIGxvYWRlZCBtZXRhZGF0YVxuICAgICAgICAgIGlmKCFsb2FkZWRtZXRhZGF0YSAmJiBtZWRpYS5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgICAgICAgICAgLy8gb25seSBhZGp1c3QgY3VycmVudFRpbWUgaWYgbm90IGVxdWFsIHRvIDBcbiAgICAgICAgICAgIGlmICghY3VycmVudFRpbWUgJiYgY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgICAgICAgICB0YXJnZXRTZWVrUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0YXJnZXRTZWVrUG9zaXRpb24pIHtcblxuICAgICAgICAgIC8vIGFkanVzdCBxdWljayBsb2FkIHNlZWsgcG9zaXRpb24gaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgaWYgKHRoaXMuaW5pdGlhbF9zZWVrKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5pbmZvKCdhZGp1c3RpbmcgaW5pdGlhbCBzZWVrOiBiZWZvcmUvYWZ0ZXI6ICcgKyB0YXJnZXRTZWVrUG9zaXRpb24gKyAnIC8gJyArIHRoaXMuaW5pdGlhbF9zZWVrKTtcbiAgICAgICAgICAgICAgdGFyZ2V0U2Vla1Bvc2l0aW9uID0gdGhpcy5pbml0aWFsX3NlZWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY3VycmVudFRpbWUgPSB0YXJnZXRTZWVrUG9zaXRpb247XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgdGFyZ2V0IHNlZWsgcG9zaXRpb246JHt0YXJnZXRTZWVrUG9zaXRpb259YCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSBCdWZmZXJIZWxwZXIuYnVmZmVySW5mbyhtZWRpYSxjdXJyZW50VGltZSwwKSxcbiAgICAgICAgICAgIGV4cGVjdGVkUGxheWluZyA9ICEobWVkaWEucGF1c2VkIHx8IG1lZGlhLmVuZGVkIHx8IG1lZGlhLnNlZWtpbmcgfHwgcmVhZHlTdGF0ZSA8IDIpLFxuICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDAuNCwgLy8gdG9sZXJhbmNlIG5lZWRlZCBhcyBzb21lIGJyb3dzZXJzIHN0YWxscyBwbGF5YmFjayBiZWZvcmUgcmVhY2hpbmcgYnVmZmVyZWQgcmFuZ2UgZW5kXG4gICAgICAgICAgICBwbGF5aGVhZE1vdmluZyA9IGN1cnJlbnRUaW1lID4gbWVkaWEucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lO1xuXG4gICAgICAgIGlmICh0aGlzLnN0YWxsZWQgJiYgcGxheWhlYWRNb3ZpbmcpIHtcbiAgICAgICAgICB0aGlzLnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBwbGF5YmFjayBub3Qgc3R1Y2sgYW55bW9yZSBAJHtjdXJyZW50VGltZX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjaGVjayBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiBsZXNzIHRoYW4gMjAwbXMgaXMgYnVmZmVyZWQsIGFuZCBtZWRpYSBpcyBleHBlY3RlZCB0byBwbGF5IGJ1dCBwbGF5aGVhZCBpcyBub3QgbW92aW5nLFxuICAgICAgICAvLyBhbmQgd2UgaGF2ZSBhIG5ldyBidWZmZXIgcmFuZ2UgYXZhaWxhYmxlIHVwZnJvbnQsIGxldCdzIHNlZWsgdG8gdGhhdCBvbmVcbiAgICAgICAgaWYoYnVmZmVySW5mby5sZW4gPD0ganVtcFRocmVzaG9sZCkge1xuICAgICAgICAgIGlmKHBsYXloZWFkTW92aW5nIHx8ICFleHBlY3RlZFBsYXlpbmcpIHtcbiAgICAgICAgICAgIC8vIHBsYXloZWFkIG1vdmluZyBvciBtZWRpYSBub3QgcGxheWluZ1xuICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHBsYXloZWFkIG5vdCBtb3ZpbmcgQU5EIG1lZGlhIGV4cGVjdGVkIHRvIHBsYXlcbiAgICAgICAgICAgIGlmKCF0aGlzLnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgcGxheWJhY2sgc2VlbXMgc3R1Y2sgQCR7Y3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX1NUQUxMRURfRVJST1IsIGZhdGFsOiBmYWxzZX0pO1xuICAgICAgICAgICAgICB0aGlzLnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpZiB3ZSBhcmUgYmVsb3cgdGhyZXNob2xkLCB0cnkgdG8ganVtcCBpZiBuZXh0IGJ1ZmZlciByYW5nZSBpcyBjbG9zZVxuICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgIC8vIG5vIGJ1ZmZlciBhdmFpbGFibGUgQCBjdXJyZW50VGltZSwgY2hlY2sgaWYgbmV4dCBidWZmZXIgaXMgY2xvc2UgKHdpdGhpbiBhIGNvbmZpZy5tYXhTZWVrSG9sZSBzZWNvbmQgcmFuZ2UpXG4gICAgICAgICAgICB2YXIgbmV4dEJ1ZmZlclN0YXJ0ID0gYnVmZmVySW5mby5uZXh0U3RhcnQsIGRlbHRhID0gbmV4dEJ1ZmZlclN0YXJ0LWN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgaWYobmV4dEJ1ZmZlclN0YXJ0ICYmXG4gICAgICAgICAgICAgICAoZGVsdGEgPCB0aGlzLmNvbmZpZy5tYXhTZWVrSG9sZSkgJiZcbiAgICAgICAgICAgICAgIChkZWx0YSA+IDApICAmJlxuICAgICAgICAgICAgICAgIW1lZGlhLnNlZWtpbmcpIHtcbiAgICAgICAgICAgICAgLy8gbmV4dCBidWZmZXIgaXMgY2xvc2UgISBhZGp1c3QgY3VycmVudFRpbWUgdG8gbmV4dEJ1ZmZlclN0YXJ0XG4gICAgICAgICAgICAgIC8vIHRoaXMgd2lsbCBlbnN1cmUgZWZmZWN0aXZlIHZpZGVvIGRlY29kaW5nXG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7bWVkaWEuY3VycmVudFRpbWV9IHRvIG5leHQgYnVmZmVyZWQgQCAke25leHRCdWZmZXJTdGFydH1gKTtcbiAgICAgICAgICAgICAgbWVkaWEuY3VycmVudFRpbWUgPSBuZXh0QnVmZmVyU3RhcnQ7XG4gICAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX1NFRUtfT1ZFUl9IT0xFLCBmYXRhbDogZmFsc2V9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHRhcmdldFNlZWtQb3NpdGlvbiAmJiBtZWRpYS5jdXJyZW50VGltZSAhPT0gdGFyZ2V0U2Vla1Bvc2l0aW9uKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGBhZGp1c3QgY3VycmVudFRpbWUgZnJvbSAke21lZGlhLmN1cnJlbnRUaW1lfSB0byAke3RhcmdldFNlZWtQb3NpdGlvbn1gKTtcbiAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gdGFyZ2V0U2Vla1Bvc2l0aW9uO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkKCkge1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25CdWZmZXJGbHVzaGVkKCkge1xuICAgIC8qIGFmdGVyIHN1Y2Nlc3NmdWwgYnVmZmVyIGZsdXNoaW5nLCByZWJ1aWxkIGJ1ZmZlciBSYW5nZSBhcnJheVxuICAgICAgbG9vcCB0aHJvdWdoIGV4aXN0aW5nIGJ1ZmZlciByYW5nZSBhbmQgY2hlY2sgaWZcbiAgICAgIGNvcnJlc3BvbmRpbmcgcmFuZ2UgaXMgc3RpbGwgYnVmZmVyZWQuIG9ubHkgcHVzaCB0byBuZXcgYXJyYXkgYWxyZWFkeSBidWZmZXJlZCByYW5nZVxuICAgICovXG4gICAgdmFyIG5ld1JhbmdlID0gW10scmFuZ2UsaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5idWZmZXJSYW5nZS5sZW5ndGg7IGkrKykge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZCgocmFuZ2Uuc3RhcnQgKyByYW5nZS5lbmQpIC8gMikpIHtcbiAgICAgICAgbmV3UmFuZ2UucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBuZXdSYW5nZTtcblxuICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICBpZiAodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgIHRoaXMuaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKTtcbiAgICB9XG4gICAgLy8gbW92ZSB0byBJRExFIG9uY2UgZmx1c2ggY29tcGxldGUuIHRoaXMgc2hvdWxkIHRyaWdnZXIgbmV3IGZyYWdtZW50IGxvYWRpbmdcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAvLyByZXNldCByZWZlcmVuY2UgdG8gZnJhZ1xuICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgfVxuXG4gIHN3YXBBdWRpb0NvZGVjKCkge1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSAhdGhpcy5hdWRpb0NvZGVjU3dhcDtcbiAgfVxuXG4gIHRpbWVSYW5nZXNUb1N0cmluZyhyKSB7XG4gICAgdmFyIGxvZyA9ICcnLCBsZW4gPSByLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcbiAgICAgIGxvZyArPSAnWycgKyByLnN0YXJ0KGkpICsgJywnICsgci5lbmQoaSkgKyAnXSc7XG4gICAgfVxuICAgIHJldHVybiBsb2c7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbUNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBUaW1lbGluZSBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQgQ0VBNzA4SW50ZXJwcmV0ZXIgZnJvbSAnLi4vdXRpbHMvY2VhLTcwOC1pbnRlcnByZXRlcic7XG5cbmNsYXNzIFRpbWVsaW5lQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5NRURJQV9BVFRBQ0hJTkcsXG4gICAgICAgICAgICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSxcbiAgICAgICAgICAgICAgICBFdmVudC5NQU5JRkVTVF9MT0FESU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BREVEKTtcblxuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcblxuICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVDRUE3MDhDYXB0aW9ucylcbiAgICB7XG4gICAgICB0aGlzLmNlYTcwOEludGVycHJldGVyID0gbmV3IENFQTcwOEludGVycHJldGVyKCk7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuYXR0YWNoKG1lZGlhKTtcbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5kZXRhY2goKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKClcbiAge1xuICAgIHRoaXMubGFzdFB0cyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZChkYXRhKVxuICB7XG4gICAgdmFyIHB0cyA9IGRhdGEuZnJhZy5zdGFydDsgLy9OdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgICAvLyBpZiB0aGlzIGlzIGEgZnJhZyBmb3IgYSBwcmV2aW91c2x5IGxvYWRlZCB0aW1lcmFuZ2UsIHJlbW92ZSBhbGwgY2FwdGlvbnNcbiAgICAvLyBUT0RPOiBjb25zaWRlciBqdXN0IHJlbW92aW5nIGNhcHRpb25zIGZvciB0aGUgdGltZXJhbmdlXG4gICAgaWYgKHB0cyA8PSB0aGlzLmxhc3RQdHMpXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5jbGVhcigpO1xuICAgIH1cblxuICAgIHRoaXMubGFzdFB0cyA9IHB0cztcbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdVc2VyZGF0YShkYXRhKSB7XG4gICAgLy8gcHVzaCBhbGwgb2YgdGhlIENFQS03MDggbWVzc2FnZXMgaW50byB0aGUgaW50ZXJwcmV0ZXJcbiAgICAvLyBpbW1lZGlhdGVseS4gSXQgd2lsbCBjcmVhdGUgdGhlIHByb3BlciB0aW1lc3RhbXBzIGJhc2VkIG9uIG91ciBQVFMgdmFsdWVcbiAgICBmb3IgKHZhciBpPTA7IGk8ZGF0YS5zYW1wbGVzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIucHVzaChkYXRhLnNhbXBsZXNbaV0ucHRzLCBkYXRhLnNhbXBsZXNbaV0uYnl0ZXMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUaW1lbGluZUNvbnRyb2xsZXI7XG4iLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuY2xhc3MgQUVTIHtcblxuICAvKipcbiAgICogU2NoZWR1bGUgb3V0IGFuIEFFUyBrZXkgZm9yIGJvdGggZW5jcnlwdGlvbiBhbmQgZGVjcnlwdGlvbi4gVGhpc1xuICAgKiBpcyBhIGxvdy1sZXZlbCBjbGFzcy4gVXNlIGEgY2lwaGVyIG1vZGUgdG8gZG8gYnVsayBlbmNyeXB0aW9uLlxuICAgKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIGtleSB7QXJyYXl9IFRoZSBrZXkgYXMgYW4gYXJyYXkgb2YgNCwgNiBvciA4IHdvcmRzLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioa2V5KSB7XG4gICAgLyoqXG4gICAgICogVGhlIGV4cGFuZGVkIFMtYm94IGFuZCBpbnZlcnNlIFMtYm94IHRhYmxlcy4gVGhlc2Ugd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIG9uIHRoZSBjbGllbnQgc28gdGhhdCB3ZSBkb24ndCBoYXZlIHRvIHNlbmQgdGhlbSBkb3duIHRoZSB3aXJlLlxuICAgICAqXG4gICAgICogVGhlcmUgYXJlIHR3byB0YWJsZXMsIF90YWJsZXNbMF0gaXMgZm9yIGVuY3J5cHRpb24gYW5kXG4gICAgICogX3RhYmxlc1sxXSBpcyBmb3IgZGVjcnlwdGlvbi5cbiAgICAgKlxuICAgICAqIFRoZSBmaXJzdCA0IHN1Yi10YWJsZXMgYXJlIHRoZSBleHBhbmRlZCBTLWJveCB3aXRoIE1peENvbHVtbnMuIFRoZVxuICAgICAqIGxhc3QgKF90YWJsZXNbMDFdWzRdKSBpcyB0aGUgUy1ib3ggaXRzZWxmLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl90YWJsZXMgPSBbW1tdLFtdLFtdLFtdLFtdXSxbW10sW10sW10sW10sW11dXTtcblxuICAgIHRoaXMuX3ByZWNvbXB1dGUoKTtcblxuICAgIHZhciBpLCBqLCB0bXAsXG4gICAgZW5jS2V5LCBkZWNLZXksXG4gICAgc2JveCA9IHRoaXMuX3RhYmxlc1swXVs0XSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAga2V5TGVuID0ga2V5Lmxlbmd0aCwgcmNvbiA9IDE7XG5cbiAgICBpZiAoa2V5TGVuICE9PSA0ICYmIGtleUxlbiAhPT0gNiAmJiBrZXlMZW4gIT09IDgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhZXMga2V5IHNpemU9JyArIGtleUxlbik7XG4gICAgfVxuXG4gICAgZW5jS2V5ID0ga2V5LnNsaWNlKDApO1xuICAgIGRlY0tleSA9IFtdO1xuICAgIHRoaXMuX2tleSA9IFtlbmNLZXksIGRlY0tleV07XG5cbiAgICAvLyBzY2hlZHVsZSBlbmNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGkgPSBrZXlMZW47IGkgPCA0ICoga2V5TGVuICsgMjg7IGkrKykge1xuICAgICAgdG1wID0gZW5jS2V5W2ktMV07XG5cbiAgICAgIC8vIGFwcGx5IHNib3hcbiAgICAgIGlmIChpJWtleUxlbiA9PT0gMCB8fCAoa2V5TGVuID09PSA4ICYmIGkla2V5TGVuID09PSA0KSkge1xuICAgICAgICB0bXAgPSBzYm94W3RtcD4+PjI0XTw8MjQgXiBzYm94W3RtcD4+MTYmMjU1XTw8MTYgXiBzYm94W3RtcD4+OCYyNTVdPDw4IF4gc2JveFt0bXAmMjU1XTtcblxuICAgICAgICAvLyBzaGlmdCByb3dzIGFuZCBhZGQgcmNvblxuICAgICAgICBpZiAoaSVrZXlMZW4gPT09IDApIHtcbiAgICAgICAgICB0bXAgPSB0bXA8PDggXiB0bXA+Pj4yNCBeIHJjb248PDI0O1xuICAgICAgICAgIHJjb24gPSByY29uPDwxIF4gKHJjb24+PjcpKjI4MztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlbmNLZXlbaV0gPSBlbmNLZXlbaS1rZXlMZW5dIF4gdG1wO1xuICAgIH1cblxuICAgIC8vIHNjaGVkdWxlIGRlY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaiA9IDA7IGk7IGorKywgaS0tKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaiYzID8gaSA6IGkgLSA0XTtcbiAgICAgIGlmIChpPD00IHx8IGo8NCkge1xuICAgICAgICBkZWNLZXlbal0gPSB0bXA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWNLZXlbal0gPSBkZWNUYWJsZVswXVtzYm94W3RtcD4+PjI0ICAgICAgXV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzFdW3Nib3hbdG1wPj4xNiAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMl1bc2JveFt0bXA+PjggICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVszXVtzYm94W3RtcCAgICAgICYgMjU1XV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4cGFuZCB0aGUgUy1ib3ggdGFibGVzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3ByZWNvbXB1dGUoKSB7XG4gICAgdmFyIGVuY1RhYmxlID0gdGhpcy5fdGFibGVzWzBdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBzYm94ID0gZW5jVGFibGVbNF0sIHNib3hJbnYgPSBkZWNUYWJsZVs0XSxcbiAgICBpLCB4LCB4SW52LCBkPVtdLCB0aD1bXSwgeDIsIHg0LCB4OCwgcywgdEVuYywgdERlYztcblxuICAgIC8vIENvbXB1dGUgZG91YmxlIGFuZCB0aGlyZCB0YWJsZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgMjU2OyBpKyspIHtcbiAgICAgIHRoWyggZFtpXSA9IGk8PDEgXiAoaT4+NykqMjgzICleaV09aTtcbiAgICB9XG5cbiAgICBmb3IgKHggPSB4SW52ID0gMDsgIXNib3hbeF07IHggXj0geDIgfHwgMSwgeEludiA9IHRoW3hJbnZdIHx8IDEpIHtcbiAgICAgIC8vIENvbXB1dGUgc2JveFxuICAgICAgcyA9IHhJbnYgXiB4SW52PDwxIF4geEludjw8MiBeIHhJbnY8PDMgXiB4SW52PDw0O1xuICAgICAgcyA9IHM+PjggXiBzJjI1NSBeIDk5O1xuICAgICAgc2JveFt4XSA9IHM7XG4gICAgICBzYm94SW52W3NdID0geDtcblxuICAgICAgLy8gQ29tcHV0ZSBNaXhDb2x1bW5zXG4gICAgICB4OCA9IGRbeDQgPSBkW3gyID0gZFt4XV1dO1xuICAgICAgdERlYyA9IHg4KjB4MTAxMDEwMSBeIHg0KjB4MTAwMDEgXiB4MioweDEwMSBeIHgqMHgxMDEwMTAwO1xuICAgICAgdEVuYyA9IGRbc10qMHgxMDEgXiBzKjB4MTAxMDEwMDtcblxuICAgICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICBlbmNUYWJsZVtpXVt4XSA9IHRFbmMgPSB0RW5jPDwyNCBeIHRFbmM+Pj44O1xuICAgICAgICBkZWNUYWJsZVtpXVtzXSA9IHREZWMgPSB0RGVjPDwyNCBeIHREZWM+Pj44O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbXBhY3RpZnkuIENvbnNpZGVyYWJsZSBzcGVlZHVwIG9uIEZpcmVmb3guXG4gICAgZm9yIChpID0gMDsgaSA8IDU7IGkrKykge1xuICAgICAgZW5jVGFibGVbaV0gPSBlbmNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICAgIGRlY1RhYmxlW2ldID0gZGVjVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERlY3J5cHQgMTYgYnl0ZXMsIHNwZWNpZmllZCBhcyBmb3VyIDMyLWJpdCB3b3Jkcy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZDAge251bWJlcn0gdGhlIGZpcnN0IHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMSB7bnVtYmVyfSB0aGUgc2Vjb25kIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMiB7bnVtYmVyfSB0aGUgdGhpcmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQzIHtudW1iZXJ9IHRoZSBmb3VydGggd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBvdXQge0ludDMyQXJyYXl9IHRoZSBhcnJheSB0byB3cml0ZSB0aGUgZGVjcnlwdGVkIHdvcmRzXG4gICAqIGludG9cbiAgICogQHBhcmFtIG9mZnNldCB7bnVtYmVyfSB0aGUgb2Zmc2V0IGludG8gdGhlIG91dHB1dCBhcnJheSB0byBzdGFydFxuICAgKiB3cml0aW5nIHJlc3VsdHNcbiAgICogQHJldHVybiB7QXJyYXl9IFRoZSBwbGFpbnRleHQuXG4gICAqL1xuICBkZWNyeXB0KGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsIG91dCwgb2Zmc2V0KSB7XG4gICAgdmFyIGtleSA9IHRoaXMuX2tleVsxXSxcbiAgICAvLyBzdGF0ZSB2YXJpYWJsZXMgYSxiLGMsZCBhcmUgbG9hZGVkIHdpdGggcHJlLXdoaXRlbmVkIGRhdGFcbiAgICBhID0gZW5jcnlwdGVkMCBeIGtleVswXSxcbiAgICBiID0gZW5jcnlwdGVkMyBeIGtleVsxXSxcbiAgICBjID0gZW5jcnlwdGVkMiBeIGtleVsyXSxcbiAgICBkID0gZW5jcnlwdGVkMSBeIGtleVszXSxcbiAgICBhMiwgYjIsIGMyLFxuXG4gICAgbklubmVyUm91bmRzID0ga2V5Lmxlbmd0aCAvIDQgLSAyLCAvLyBrZXkubGVuZ3RoID09PSAyID9cbiAgICBpLFxuICAgIGtJbmRleCA9IDQsXG4gICAgdGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG5cbiAgICAvLyBsb2FkIHVwIHRoZSB0YWJsZXNcbiAgICB0YWJsZTAgICAgPSB0YWJsZVswXSxcbiAgICB0YWJsZTEgICAgPSB0YWJsZVsxXSxcbiAgICB0YWJsZTIgICAgPSB0YWJsZVsyXSxcbiAgICB0YWJsZTMgICAgPSB0YWJsZVszXSxcbiAgICBzYm94ICA9IHRhYmxlWzRdO1xuXG4gICAgLy8gSW5uZXIgcm91bmRzLiBDcmliYmVkIGZyb20gT3BlblNTTC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbklubmVyUm91bmRzOyBpKyspIHtcbiAgICAgIGEyID0gdGFibGUwW2E+Pj4yNF0gXiB0YWJsZTFbYj4+MTYgJiAyNTVdIF4gdGFibGUyW2M+PjggJiAyNTVdIF4gdGFibGUzW2QgJiAyNTVdIF4ga2V5W2tJbmRleF07XG4gICAgICBiMiA9IHRhYmxlMFtiPj4+MjRdIF4gdGFibGUxW2M+PjE2ICYgMjU1XSBeIHRhYmxlMltkPj44ICYgMjU1XSBeIHRhYmxlM1thICYgMjU1XSBeIGtleVtrSW5kZXggKyAxXTtcbiAgICAgIGMyID0gdGFibGUwW2M+Pj4yNF0gXiB0YWJsZTFbZD4+MTYgJiAyNTVdIF4gdGFibGUyW2E+PjggJiAyNTVdIF4gdGFibGUzW2IgJiAyNTVdIF4ga2V5W2tJbmRleCArIDJdO1xuICAgICAgZCAgPSB0YWJsZTBbZD4+PjI0XSBeIHRhYmxlMVthPj4xNiAmIDI1NV0gXiB0YWJsZTJbYj4+OCAmIDI1NV0gXiB0YWJsZTNbYyAmIDI1NV0gXiBrZXlba0luZGV4ICsgM107XG4gICAgICBrSW5kZXggKz0gNDtcbiAgICAgIGE9YTI7IGI9YjI7IGM9YzI7XG4gICAgfVxuXG4gICAgLy8gTGFzdCByb3VuZC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICBvdXRbKDMgJiAtaSkgKyBvZmZzZXRdID1cbiAgICAgICAgc2JveFthPj4+MjQgICAgICBdPDwyNCBeXG4gICAgICAgIHNib3hbYj4+MTYgICYgMjU1XTw8MTYgXlxuICAgICAgICBzYm94W2M+PjggICAmIDI1NV08PDggIF5cbiAgICAgICAgc2JveFtkICAgICAgJiAyNTVdICAgICBeXG4gICAgICAgIGtleVtrSW5kZXgrK107XG4gICAgICBhMj1hOyBhPWI7IGI9YzsgYz1kOyBkPWEyO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRVM7XG4iLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuXG5pbXBvcnQgQUVTIGZyb20gJy4vYWVzJztcblxuY2xhc3MgQUVTMTI4RGVjcnlwdGVyIHtcblxuICBjb25zdHJ1Y3RvcihrZXksIGluaXRWZWN0b3IpIHtcbiAgICB0aGlzLmtleSA9IGtleTtcbiAgICB0aGlzLml2ID0gaW5pdFZlY3RvcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IG5ldHdvcmstb3JkZXIgKGJpZy1lbmRpYW4pIGJ5dGVzIGludG8gdGhlaXIgbGl0dGxlLWVuZGlhblxuICAgKiByZXByZXNlbnRhdGlvbi5cbiAgICovXG4gIG50b2god29yZCkge1xuICAgIHJldHVybiAod29yZCA8PCAyNCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwKSA8PCA4KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDAwMCkgPj4gOCkgfFxuICAgICAgKHdvcmQgPj4+IDI0KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERlY3J5cHQgYnl0ZXMgdXNpbmcgQUVTLTEyOCB3aXRoIENCQyBhbmQgUEtDUyM3IHBhZGRpbmcuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQge1VpbnQ4QXJyYXl9IHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICogQHBhcmFtIGtleSB7VWludDMyQXJyYXl9IHRoZSBieXRlcyBvZiB0aGUgZGVjcnlwdGlvbiBrZXlcbiAgICogQHBhcmFtIGluaXRWZWN0b3Ige1VpbnQzMkFycmF5fSB0aGUgaW5pdGlhbGl6YXRpb24gdmVjdG9yIChJVikgdG9cbiAgICogdXNlIGZvciB0aGUgZmlyc3Qgcm91bmQgb2YgQ0JDLlxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgZGVjcnlwdGVkIGJ5dGVzXG4gICAqXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BZHZhbmNlZF9FbmNyeXB0aW9uX1N0YW5kYXJkXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CbG9ja19jaXBoZXJfbW9kZV9vZl9vcGVyYXRpb24jQ2lwaGVyX0Jsb2NrX0NoYWluaW5nXy4yOENCQy4yOVxuICAgKiBAc2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMzE1XG4gICAqL1xuICBkb0RlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IpIHtcbiAgICB2YXJcbiAgICAgIC8vIHdvcmQtbGV2ZWwgYWNjZXNzIHRvIHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkLmJ1ZmZlciwgZW5jcnlwdGVkLmJ5dGVPZmZzZXQsIGVuY3J5cHRlZC5ieXRlTGVuZ3RoID4+IDIpLFxuXG4gICAgZGVjaXBoZXIgPSBuZXcgQUVTKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGtleSkpLFxuXG4gICAgLy8gYnl0ZSBhbmQgd29yZC1sZXZlbCBhY2Nlc3MgZm9yIHRoZSBkZWNyeXB0ZWQgb3V0cHV0XG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGRlY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZGVjcnlwdGVkLmJ1ZmZlciksXG5cbiAgICAvLyB0ZW1wb3JhcnkgdmFyaWFibGVzIGZvciB3b3JraW5nIHdpdGggdGhlIElWLCBlbmNyeXB0ZWQsIGFuZFxuICAgIC8vIGRlY3J5cHRlZCBkYXRhXG4gICAgaW5pdDAsIGluaXQxLCBpbml0MiwgaW5pdDMsXG4gICAgZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMyxcblxuICAgIC8vIGl0ZXJhdGlvbiB2YXJpYWJsZVxuICAgIHdvcmRJeDtcblxuICAgIC8vIHB1bGwgb3V0IHRoZSB3b3JkcyBvZiB0aGUgSVYgdG8gZW5zdXJlIHdlIGRvbid0IG1vZGlmeSB0aGVcbiAgICAvLyBwYXNzZWQtaW4gcmVmZXJlbmNlIGFuZCBlYXNpZXIgYWNjZXNzXG4gICAgaW5pdDAgPSB+fmluaXRWZWN0b3JbMF07XG4gICAgaW5pdDEgPSB+fmluaXRWZWN0b3JbMV07XG4gICAgaW5pdDIgPSB+fmluaXRWZWN0b3JbMl07XG4gICAgaW5pdDMgPSB+fmluaXRWZWN0b3JbM107XG5cbiAgICAvLyBkZWNyeXB0IGZvdXIgd29yZCBzZXF1ZW5jZXMsIGFwcGx5aW5nIGNpcGhlci1ibG9jayBjaGFpbmluZyAoQ0JDKVxuICAgIC8vIHRvIGVhY2ggZGVjcnlwdGVkIGJsb2NrXG4gICAgZm9yICh3b3JkSXggPSAwOyB3b3JkSXggPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IHdvcmRJeCArPSA0KSB7XG4gICAgICAvLyBjb252ZXJ0IGJpZy1lbmRpYW4gKG5ldHdvcmsgb3JkZXIpIHdvcmRzIGludG8gbGl0dGxlLWVuZGlhblxuICAgICAgLy8gKGphdmFzY3JpcHQgb3JkZXIpXG4gICAgICBlbmNyeXB0ZWQwID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4XSk7XG4gICAgICBlbmNyeXB0ZWQxID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgMV0pO1xuICAgICAgZW5jcnlwdGVkMiA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDJdKTtcbiAgICAgIGVuY3J5cHRlZDMgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAzXSk7XG5cbiAgICAgIC8vIGRlY3J5cHQgdGhlIGJsb2NrXG4gICAgICBkZWNpcGhlci5kZWNyeXB0KGVuY3J5cHRlZDAsXG4gICAgICAgICAgZW5jcnlwdGVkMSxcbiAgICAgICAgICBlbmNyeXB0ZWQyLFxuICAgICAgICAgIGVuY3J5cHRlZDMsXG4gICAgICAgICAgZGVjcnlwdGVkMzIsXG4gICAgICAgICAgd29yZEl4KTtcblxuICAgICAgLy8gWE9SIHdpdGggdGhlIElWLCBhbmQgcmVzdG9yZSBuZXR3b3JrIGJ5dGUtb3JkZXIgdG8gb2J0YWluIHRoZVxuICAgICAgLy8gcGxhaW50ZXh0XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXhdICAgICA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXhdIF4gaW5pdDApO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gXiBpbml0MSk7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSBeIGluaXQyKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdIF4gaW5pdDMpO1xuXG4gICAgICAvLyBzZXR1cCB0aGUgSVYgZm9yIHRoZSBuZXh0IHJvdW5kXG4gICAgICBpbml0MCA9IGVuY3J5cHRlZDA7XG4gICAgICBpbml0MSA9IGVuY3J5cHRlZDE7XG4gICAgICBpbml0MiA9IGVuY3J5cHRlZDI7XG4gICAgICBpbml0MyA9IGVuY3J5cHRlZDM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY3J5cHRlZDtcbiAgfVxuXG4gIGxvY2FsRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKSB7XG4gICAgdmFyIGJ5dGVzID0gdGhpcy5kb0RlY3J5cHQoZW5jcnlwdGVkLFxuICAgICAgICBrZXksXG4gICAgICAgIGluaXRWZWN0b3IpO1xuICAgIGRlY3J5cHRlZC5zZXQoYnl0ZXMsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0KTtcbiAgfVxuXG4gIGRlY3J5cHQoZW5jcnlwdGVkKSB7XG4gICAgdmFyXG4gICAgICBzdGVwID0gNCAqIDgwMDAsXG4gICAgLy9lbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIpLFxuICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkKSxcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgaSA9IDA7XG5cbiAgICAvLyBzcGxpdCB1cCB0aGUgZW5jcnlwdGlvbiBqb2IgYW5kIGRvIHRoZSBpbmRpdmlkdWFsIGNodW5rcyBhc3luY2hyb25vdXNseVxuICAgIHZhciBrZXkgPSB0aGlzLmtleTtcbiAgICB2YXIgaW5pdFZlY3RvciA9IHRoaXMuaXY7XG4gICAgdGhpcy5sb2NhbERlY3J5cHQoZW5jcnlwdGVkMzIuc3ViYXJyYXkoaSwgaSArIHN0ZXApLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCk7XG5cbiAgICBmb3IgKGkgPSBzdGVwOyBpIDwgZW5jcnlwdGVkMzIubGVuZ3RoOyBpICs9IHN0ZXApIHtcbiAgICAgIGluaXRWZWN0b3IgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gNF0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gM10pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMl0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMV0pXG4gICAgICBdKTtcbiAgICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTMTI4RGVjcnlwdGVyO1xuIiwiLypcbiAqIEFFUzEyOCBkZWNyeXB0aW9uLlxuICovXG5cbmltcG9ydCBBRVMxMjhEZWNyeXB0ZXIgZnJvbSAnLi9hZXMxMjgtZGVjcnlwdGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJyb3dzZXJDcnlwdG8gPSB3aW5kb3cgPyB3aW5kb3cuY3J5cHRvIDogY3J5cHRvO1xuICAgICAgdGhpcy5zdWJ0bGUgPSBicm93c2VyQ3J5cHRvLnN1YnRsZSB8fCBicm93c2VyQ3J5cHRvLndlYmtpdFN1YnRsZTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9ICF0aGlzLnN1YnRsZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBkZWNyeXB0KGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuZGlzYWJsZVdlYkNyeXB0byAmJiB0aGlzLmhscy5jb25maWcuZW5hYmxlU29mdHdhcmVBRVMpIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBXZWJDcnlwdG8gQVBJJyk7XG5cbiAgICB0aGlzLnN1YnRsZS5pbXBvcnRLZXkoJ3JhdycsIGtleSwgeyBuYW1lIDogJ0FFUy1DQkMnLCBsZW5ndGggOiAxMjggfSwgZmFsc2UsIFsnZGVjcnlwdCddKS5cbiAgICAgIHRoZW4oKGltcG9ydGVkS2V5KSA9PiB7XG4gICAgICAgIHRoaXMuc3VidGxlLmRlY3J5cHQoeyBuYW1lIDogJ0FFUy1DQkMnLCBpdiA6IGl2LmJ1ZmZlciB9LCBpbXBvcnRlZEtleSwgZGF0YSkuXG4gICAgICAgICAgdGhlbihjYWxsYmFjaykuXG4gICAgICAgICAgY2F0Y2ggKChlcnIpID0+IHtcbiAgICAgICAgICAgIHRoaXMub25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLlxuICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSk7XG4gIH1cblxuICBkZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXk4LCBpdjgsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBKYXZhU2NyaXB0IEltcGxlbWVudGF0aW9uJyk7XG5cbiAgICB2YXIgdmlldyA9IG5ldyBEYXRhVmlldyhrZXk4LmJ1ZmZlcik7XG4gICAgdmFyIGtleSA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhpdjguYnVmZmVyKTtcbiAgICB2YXIgaXYgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZhciBkZWNyeXB0ZXIgPSBuZXcgQUVTMTI4RGVjcnlwdGVyKGtleSwgaXYpO1xuICAgIGNhbGxiYWNrKGRlY3J5cHRlci5kZWNyeXB0KGRhdGEpLmJ1ZmZlcik7XG4gIH1cblxuICBvbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNhYmxpbmcgdG8gdXNlIFdlYkNyeXB0byBBUEknKTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBsb2dnZXIuZXJyb3IoYGRlY3J5cHRpbmcgZXJyb3IgOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfREVDUllQVF9FUlJPUiwgZmF0YWwgOiB0cnVlLCByZWFzb24gOiBlcnIubWVzc2FnZX0pO1xuICAgIH1cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlY3J5cHRlcjtcbiIsIi8qKlxuICogQUFDIGRlbXV4ZXJcbiAqL1xuaW1wb3J0IEFEVFMgZnJvbSAnLi9hZHRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IElEMyBmcm9tICcuLi9kZW11eC9pZDMnO1xuXG4gY2xhc3MgQUFDRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIscmVtdXhlckNsYXNzKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMucmVtdXhlckNsYXNzID0gcmVtdXhlckNsYXNzO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7Y29udGFpbmVyIDogJ2F1ZGlvL2FkdHMnLCB0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICB9XG5cbiAgc3RhdGljIHByb2JlKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBkYXRhIGNvbnRhaW5zIElEMyB0aW1lc3RhbXAgYW5kIEFEVFMgc3luYyB3b3JjXG4gICAgdmFyIGlkMyA9IG5ldyBJRDMoZGF0YSksIG9mZnNldCxsZW47XG4gICAgaWYoaWQzLmhhc1RpbWVTdGFtcCkge1xuICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgIGZvciAob2Zmc2V0ID0gaWQzLmxlbmd0aCwgbGVuID0gZGF0YS5sZW5ndGg7IG9mZnNldCA8IGxlbiAtIDE7IG9mZnNldCsrKSB7XG4gICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQURUUyBzeW5jIHdvcmQgZm91bmQgIScpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGlkMyA9IG5ldyBJRDMoZGF0YSksXG4gICAgICAgIHB0cyA9IDkwKmlkMy50aW1lU3RhbXAsXG4gICAgICAgIGNvbmZpZywgZnJhbWVMZW5ndGgsIGZyYW1lRHVyYXRpb24sIGZyYW1lSW5kZXgsIG9mZnNldCwgaGVhZGVyTGVuZ3RoLCBzdGFtcCwgbGVuLCBhYWNTYW1wbGU7XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKG9mZnNldCA9IGlkMy5sZW5ndGgsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdHJhY2suYXVkaW9zYW1wbGVyYXRlKSB7XG4gICAgICBjb25maWcgPSBBRFRTLmdldEF1ZGlvQ29uZmlnKHRoaXMub2JzZXJ2ZXIsZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgZnJhbWVJbmRleCA9IDA7XG4gICAgZnJhbWVEdXJhdGlvbiA9IDEwMjQgKiA5MDAwMCAvIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICB3aGlsZSAoKG9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyBUaGUgcHJvdGVjdGlvbiBza2lwIGJpdCB0ZWxscyB1cyBpZiB3ZSBoYXZlIDIgYnl0ZXMgb2YgQ1JDIGRhdGEgYXQgdGhlIGVuZCBvZiB0aGUgQURUUyBoZWFkZXJcbiAgICAgIGhlYWRlckxlbmd0aCA9ICghIShkYXRhW29mZnNldCArIDFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBmcmFtZUxlbmd0aCA9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MDMpIDw8IDExKSB8XG4gICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQgKyA0XSA8PCAzKSB8XG4gICAgICAgICAgICAgICAgICAgICgoZGF0YVtvZmZzZXQgKyA1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGZyYW1lTGVuZ3RoICAtPSBoZWFkZXJMZW5ndGg7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcblxuICAgICAgaWYgKChmcmFtZUxlbmd0aCA+IDApICYmICgob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpIDw9IGxlbikpIHtcbiAgICAgICAgc3RhbXAgPSBwdHMgKyBmcmFtZUluZGV4ICogZnJhbWVEdXJhdGlvbjtcbiAgICAgICAgLy9sb2dnZXIubG9nKGBBQUMgZnJhbWUsIG9mZnNldC9sZW5ndGgvdG90YWwvcHRzOiR7b2Zmc2V0K2hlYWRlckxlbmd0aH0vJHtmcmFtZUxlbmd0aH0vJHtkYXRhLmJ5dGVMZW5ndGh9LyR7KHN0YW1wLzkwKS50b0ZpeGVkKDApfWApO1xuICAgICAgICBhYWNTYW1wbGUgPSB7dW5pdDogZGF0YS5zdWJhcnJheShvZmZzZXQgKyBoZWFkZXJMZW5ndGgsIG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSwgcHRzOiBzdGFtcCwgZHRzOiBzdGFtcH07XG4gICAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gZnJhbWVMZW5ndGg7XG4gICAgICAgIG9mZnNldCArPSBmcmFtZUxlbmd0aCArIGhlYWRlckxlbmd0aDtcbiAgICAgICAgZnJhbWVJbmRleCsrO1xuICAgICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgICBmb3IgKCA7IG9mZnNldCA8IChsZW4gLSAxKTsgb2Zmc2V0KyspIHtcbiAgICAgICAgICBpZiAoKGRhdGFbb2Zmc2V0XSA9PT0gMHhmZikgJiYgKChkYXRhW29mZnNldCArIDFdICYgMHhmMCkgPT09IDB4ZjApKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2sse3NhbXBsZXMgOiBbXX0sIHtzYW1wbGVzIDogWyB7IHB0czogcHRzLCBkdHMgOiBwdHMsIHVuaXQgOiBpZDMucGF5bG9hZH0gXX0sIHsgc2FtcGxlczogW10gfSwgdGltZU9mZnNldCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUFDRGVtdXhlcjtcbiIsIi8qKlxuICogIEFEVFMgcGFyc2VyIGhlbHBlclxuICovXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgQURUUyB7XG5cbiAgc3RhdGljIGdldEF1ZGlvQ29uZmlnKG9ic2VydmVyLCBkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpIHtcbiAgICB2YXIgYWR0c09iamVjdFR5cGUsIC8vIDppbnRcbiAgICAgICAgYWR0c1NhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzQ2hhbmVsQ29uZmlnLCAvLyA6aW50XG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgdXNlckFnZW50ID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBhZHRzU2FtcGxlaW5nUmF0ZXMgPSBbXG4gICAgICAgICAgICA5NjAwMCwgODgyMDAsXG4gICAgICAgICAgICA2NDAwMCwgNDgwMDAsXG4gICAgICAgICAgICA0NDEwMCwgMzIwMDAsXG4gICAgICAgICAgICAyNDAwMCwgMjIwNTAsXG4gICAgICAgICAgICAxNjAwMCwgMTIwMDAsXG4gICAgICAgICAgICAxMTAyNSwgODAwMCxcbiAgICAgICAgICAgIDczNTBdO1xuICAgIC8vIGJ5dGUgMlxuICAgIGFkdHNPYmplY3RUeXBlID0gKChkYXRhW29mZnNldCArIDJdICYgMHhDMCkgPj4+IDYpICsgMTtcbiAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgaWYoYWR0c1NhbXBsZWluZ0luZGV4ID4gYWR0c1NhbXBsZWluZ1JhdGVzLmxlbmd0aC0xKSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogYGludmFsaWQgQURUUyBzYW1wbGluZyBpbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1gfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4QzApID4+PiA2KTtcbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfUh6XSxjaGFubmVsQ29uZmlnOiR7YWR0c0NoYW5lbENvbmZpZ31gKTtcbiAgICAvLyBmaXJlZm94OiBmcmVxIGxlc3MgdGhhbiAyNGtIeiA9IEFBQyBTQlIgKEhFLUFBQylcbiAgICBpZiAodXNlckFnZW50LmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEpIHtcbiAgICAgIGlmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgICAgLy8gQW5kcm9pZCA6IGFsd2F5cyB1c2UgQUFDXG4gICAgfSBlbHNlIGlmICh1c2VyQWdlbnQuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICAvKiAgZm9yIG90aGVyIGJyb3dzZXJzIChjaHJvbWUgLi4uKVxuICAgICAgICAgIGFsd2F5cyBmb3JjZSBhdWRpbyB0eXBlIHRvIGJlIEhFLUFBQyBTQlIsIGFzIHNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoIHByb3Blcmx5IChsaWtlIENocm9tZSAuLi4pXG4gICAgICAqL1xuICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEhFLUFBQyBvciBIRS1BQUN2MikgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgQU5EIGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHopXG4gICAgICBpZiAoKGF1ZGlvQ29kZWMgJiYgKChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMjknKSAhPT0gLTEpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkpKSB8fFxuICAgICAgICAgICghYXVkaW9Db2RlYyAmJiBhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikpIHtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgQUFDKSBBTkQgKGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHogQU5EIG5iIGNoYW5uZWwgaXMgMSkgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgYW5kIG1vbm8gYXVkaW8pXG4gICAgICAgIC8vIENocm9tZSBmYWlscyB0byBwbGF5IGJhY2sgd2l0aCBsb3cgZnJlcXVlbmN5IEFBQyBMQyBtb25vIHdoZW4gaW5pdGlhbGl6ZWQgd2l0aCBIRS1BQUMuICBUaGlzIGlzIG5vdCBhIHByb2JsZW0gd2l0aCBzdGVyZW8uXG4gICAgICAgIGlmIChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xICYmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNiAmJiBhZHRzQ2hhbmVsQ29uZmlnID09PSAxKSB8fFxuICAgICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNDaGFuZWxDb25maWcgPT09IDEpKSB7XG4gICAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAgICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZiAoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4ge2NvbmZpZzogY29uZmlnLCBzYW1wbGVyYXRlOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50OiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYzogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFEVFM7XG4iLCIvKiAgaW5saW5lIGRlbXV4ZXIuXG4gKiAgIHByb2JlIGZyYWdtZW50cyBhbmQgaW5zdGFudGlhdGUgYXBwcm9wcmlhdGUgZGVtdXhlciBkZXBlbmRpbmcgb24gY29udGVudCB0eXBlIChUU0RlbXV4ZXIsIEFBQ0RlbXV4ZXIsIC4uLilcbiAqL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IEFBQ0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvYWFjZGVtdXhlcic7XG5pbXBvcnQgVFNEZW11eGVyIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG5pbXBvcnQgTVA0UmVtdXhlciBmcm9tICcuLi9yZW11eC9tcDQtcmVtdXhlcic7XG5pbXBvcnQgUGFzc1Rocm91Z2hSZW11eGVyIGZyb20gJy4uL3JlbXV4L3Bhc3N0aHJvdWdoLXJlbXV4ZXInO1xuXG5jbGFzcyBEZW11eGVySW5saW5lIHtcblxuICBjb25zdHJ1Y3RvcihobHMsdHlwZVN1cHBvcnRlZCkge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMudHlwZVN1cHBvcnRlZCA9IHR5cGVTdXBwb3J0ZWQ7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmIChkZW11eGVyKSB7XG4gICAgICBkZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCkge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmICghZGVtdXhlcikge1xuICAgICAgdmFyIGhscyA9IHRoaXMuaGxzO1xuICAgICAgLy8gcHJvYmUgZm9yIGNvbnRlbnQgdHlwZVxuICAgICAgaWYgKFRTRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBpZiAodGhpcy50eXBlU3VwcG9ydGVkLm1wMnQgPT09IHRydWUpIHtcbiAgICAgICAgICBkZW11eGVyID0gbmV3IFRTRGVtdXhlcihobHMsUGFzc1Rocm91Z2hSZW11eGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZW11eGVyID0gbmV3IFRTRGVtdXhlcihobHMsTVA0UmVtdXhlcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZihBQUNEZW11eGVyLnByb2JlKGRhdGEpKSB7XG4gICAgICAgIGRlbXV4ZXIgPSBuZXcgQUFDRGVtdXhlcihobHMsTVA0UmVtdXhlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgcmVhc29uOiAnbm8gZGVtdXggbWF0Y2hpbmcgd2l0aCBjb250ZW50IGZvdW5kJ30pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBkZW11eGVyO1xuICAgIH1cbiAgICBkZW11eGVyLnB1c2goZGF0YSxhdWRpb0NvZGVjLHZpZGVvQ29kZWMsdGltZU9mZnNldCxjYyxsZXZlbCxzbixkdXJhdGlvbiwgdDApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJJbmxpbmU7XG4iLCIvKiBkZW11eGVyIHdlYiB3b3JrZXIuXG4gKiAgLSBsaXN0ZW4gdG8gd29ya2VyIG1lc3NhZ2UsIGFuZCB0cmlnZ2VyIERlbXV4ZXJJbmxpbmUgdXBvbiByZWNlcHRpb24gb2YgRnJhZ21lbnRzLlxuICogIC0gcHJvdmlkZXMgTVA0IEJveGVzIGJhY2sgdG8gbWFpbiB0aHJlYWQgdXNpbmcgW3RyYW5zZmVyYWJsZSBvYmplY3RzXShodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDExLzEyL1RyYW5zZmVyYWJsZS1PYmplY3RzLUxpZ2h0bmluZy1GYXN0KSBpbiBvcmRlciB0byBtaW5pbWl6ZSBtZXNzYWdlIHBhc3Npbmcgb3ZlcmhlYWQuXG4gKi9cblxuIGltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbnZhciBEZW11eGVyV29ya2VyID0gZnVuY3Rpb24gKHNlbGYpIHtcbiAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgdmFyIG9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG4gIH07XG5cbiAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCAuLi5kYXRhKTtcbiAgfTtcbiAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBkYXRhLmNtZCk7XG4gICAgc3dpdGNoIChkYXRhLmNtZCkge1xuICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKG9ic2VydmVyLCBkYXRhLnR5cGVTdXBwb3J0ZWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgc2VsZi5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhKSwgZGF0YS5hdWRpb0NvZGVjLCBkYXRhLnZpZGVvQ29kZWMsIGRhdGEudGltZU9mZnNldCwgZGF0YS5jYywgZGF0YS5sZXZlbCwgZGF0YS5zbiwgZGF0YS5kdXJhdGlvbiwgZGF0YS50MCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9KTtcblxuICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBEZW11eGVyXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2LCB0cmFja3MgOiBkYXRhLnRyYWNrcywgdW5pcXVlIDogZGF0YS51bmlxdWUgfSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldiwgdHlwZTogZGF0YS50eXBlLCBzdGFydFBUUzogZGF0YS5zdGFydFBUUywgZW5kUFRTOiBkYXRhLmVuZFBUUywgc3RhcnREVFM6IGRhdGEuc3RhcnREVFMsIGVuZERUUzogZGF0YS5lbmREVFMsIGRhdGExOiBkYXRhLmRhdGExLmJ1ZmZlciwgZGF0YTI6IGRhdGEuZGF0YTIuYnVmZmVyLCBuYjogZGF0YS5uYn07XG4gICAgLy8gcGFzcyBkYXRhMS9kYXRhMiBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSwgW29iakRhdGEuZGF0YTEsIG9iakRhdGEuZGF0YTJdKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50fSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudCwgZGF0YTogZGF0YX0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZlbnQsIHNhbXBsZXM6IGRhdGEuc2FtcGxlc307XG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgfSk7XG5cbn07XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJXb3JrZXI7XG5cbiIsImltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IERlbXV4ZXJJbmxpbmUgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci1pbmxpbmUnO1xuaW1wb3J0IERlbXV4ZXJXb3JrZXIgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci13b3JrZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgRGVjcnlwdGVyIGZyb20gJy4uL2NyeXB0L2RlY3J5cHRlcic7XG5cbmNsYXNzIERlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHZhciB0eXBlU3VwcG9ydGVkID0ge1xuICAgICAgbXA0IDogTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQnKSxcbiAgICAgIG1wMnQgOiBobHMuY29uZmlnLmVuYWJsZU1QMlRQYXNzVGhyb3VnaCAmJiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wMnQnKVxuICAgIH07XG4gICAgaWYgKGhscy5jb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ2RlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnaW5pdCcsIHR5cGVTdXBwb3J0ZWQgOiB0eXBlU3VwcG9ydGVkfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKCdlcnJvciB3aGlsZSBpbml0aWFsaXppbmcgRGVtdXhlcldvcmtlciwgZmFsbGJhY2sgb24gRGVtdXhlcklubGluZScpO1xuICAgICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyx0eXBlU3VwcG9ydGVkKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUoaGxzLHR5cGVTdXBwb3J0ZWQpO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eEluaXRpYWxpemVkID0gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgdGhpcy53LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICB0aGlzLncudGVybWluYXRlKCk7XG4gICAgICB0aGlzLncgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZGVjcnlwdGVyKSB7XG4gICAgICB0aGlzLmRlY3J5cHRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlY3J5cHRlciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHVzaERlY3J5cHRlZChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApIHtcblx0bG9nZ2VyLmluZm8oJ3B1c2hEZWNyeXB0ZWQgdDA6ICcgKyB0MCk7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdkZW11eCcsIGRhdGE6IGRhdGEsIGF1ZGlvQ29kZWM6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQ6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWw6IGxldmVsLCBzbiA6IHNuLCBkdXJhdGlvbjogZHVyYXRpb24sIHQwOiB0MH0sIFtkYXRhXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEpLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGRlY3J5cHRkYXRhLCB0MCkge1xuICAgIGlmICgoZGF0YS5ieXRlTGVuZ3RoID4gMCkgJiYgKGRlY3J5cHRkYXRhICE9IG51bGwpICYmIChkZWNyeXB0ZGF0YS5rZXkgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLm1ldGhvZCA9PT0gJ0FFUy0xMjgnKSkge1xuICAgICAgaWYgKHRoaXMuZGVjcnlwdGVyID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5kZWNyeXB0ZXIgPSBuZXcgRGVjcnlwdGVyKHRoaXMuaGxzKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGxvY2FsdGhpcyA9IHRoaXM7XG4gICAgICB0aGlzLmRlY3J5cHRlci5kZWNyeXB0KGRhdGEsIGRlY3J5cHRkYXRhLmtleSwgZGVjcnlwdGRhdGEuaXYsIGZ1bmN0aW9uKGRlY3J5cHRlZERhdGEpe1xuICAgICAgICBsb2NhbHRoaXMucHVzaERlY3J5cHRlZChkZWNyeXB0ZWREYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHVzaERlY3J5cHRlZChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIHZhciBkYXRhID0gZXYuZGF0YTtcbiAgICAvL2NvbnNvbGUubG9nKCdvbldvcmtlck1lc3NhZ2U6JyArIGRhdGEuZXZlbnQpO1xuICAgIHN3aXRjaChkYXRhLmV2ZW50KSB7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6XG4gICAgICAgIHZhciBvYmogPSB7fTtcbiAgICAgICAgb2JqLnRyYWNrcyA9IGRhdGEudHJhY2tzO1xuICAgICAgICBvYmoudW5pcXVlID0gZGF0YS51bmlxdWU7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBkYXRhMTogbmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhMSksXG4gICAgICAgICAgZGF0YTI6IG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YTIpLFxuICAgICAgICAgIHN0YXJ0UFRTOiBkYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUzogZGF0YS5lbmRQVFMsXG4gICAgICAgICAgc3RhcnREVFM6IGRhdGEuc3RhcnREVFMsXG4gICAgICAgICAgZW5kRFRTOiBkYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlOiBkYXRhLnR5cGUsXG4gICAgICAgICAgbmI6IGRhdGEubmJcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQTpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIHtcbiAgICAgICAgICBzYW1wbGVzOiBkYXRhLnNhbXBsZXNcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQTpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIHtcbiAgICAgICAgICBzYW1wbGVzOiBkYXRhLnNhbXBsZXNcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihkYXRhLmV2ZW50LCBkYXRhLmRhdGEpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcjtcblxuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2Rpbmcgc2NoZW1lIHVzZWQgYnkgaDI2NC5cbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMuZGF0YVxuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JkID0gMDsgLy8gOnVpbnRcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJpdHMgbGVmdCB0byBleGFtaW5lIGluIHRoZSBjdXJyZW50IHdvcmRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGggLSB0aGlzLmJ5dGVzQXZhaWxhYmxlLFxuICAgICAgd29ya2luZ0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCksXG4gICAgICBhdmFpbGFibGVCeXRlcyA9IE1hdGgubWluKDQsIHRoaXMuYnl0ZXNBdmFpbGFibGUpO1xuICAgIGlmIChhdmFpbGFibGVCeXRlcyA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdubyBieXRlcyBhdmFpbGFibGUnKTtcbiAgICB9XG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLmRhdGEuc3ViYXJyYXkocG9zaXRpb24sIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy5kYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gYXZhaWxhYmxlQnl0ZXMgKiA4O1xuICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH1cblxuICAvLyAoY291bnQ6aW50KTp2b2lkXG4gIHNraXBCaXRzKGNvdW50KSB7XG4gICAgdmFyIHNraXBCeXRlczsgLy8gOmludFxuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9IGVsc2Uge1xuICAgICAgY291bnQgLT0gdGhpcy5iaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgPj4gMztcbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgPj4gMyk7XG4gICAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gKHNpemU6aW50KTp1aW50XG4gIHJlYWRCaXRzKHNpemUpIHtcbiAgICB2YXJcbiAgICAgIGJpdHMgPSBNYXRoLm1pbih0aGlzLmJpdHNBdmFpbGFibGUsIHNpemUpLCAvLyA6dWludFxuICAgICAgdmFsdSA9IHRoaXMud29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG4gICAgaWYgKHNpemUgPiAzMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29yZCA8PD0gYml0cztcbiAgICB9IGVsc2UgaWYgKHRoaXMuYnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuICAgIGJpdHMgPSBzaXplIC0gYml0cztcbiAgICBpZiAoYml0cyA+IDApIHtcbiAgICAgIHJldHVybiB2YWx1IDw8IGJpdHMgfCB0aGlzLnJlYWRCaXRzKGJpdHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdmFsdTtcbiAgICB9XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHNraXBMWigpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwOyBsZWFkaW5nWmVyb0NvdW50IDwgdGhpcy5iaXRzQXZhaWxhYmxlOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JkICYgKDB4ODAwMDAwMDAgPj4+IGxlYWRpbmdaZXJvQ291bnQpKSkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgYml0IG9mIHdvcmtpbmcgd29yZCBpcyAxXG4gICAgICAgIHRoaXMud29yZCA8PD0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cbiAgICAvLyB3ZSBleGhhdXN0ZWQgd29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTFooKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcFVFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVUVHKCkge1xuICAgIHZhciBjbHogPSB0aGlzLnNraXBMWigpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRUcoKSB7XG4gICAgdmFyIHZhbHUgPSB0aGlzLnJlYWRVRUcoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVQnl0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyg4KTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVVNob3J0KCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDE2KTtcbiAgfVxuICAgIC8vICgpOmludFxuICByZWFkVUludCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cygzMik7XG4gIH1cblxuICAvKipcbiAgICogQWR2YW5jZSB0aGUgRXhwR29sb21iIGRlY29kZXIgcGFzdCBhIHNjYWxpbmcgbGlzdC4gVGhlIHNjYWxpbmdcbiAgICogbGlzdCBpcyBvcHRpb25hbGx5IHRyYW5zbWl0dGVkIGFzIHBhcnQgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXJcbiAgICogc2V0IGFuZCBpcyBub3QgcmVsZXZhbnQgdG8gdHJhbnNtdXhpbmcuXG4gICAqIEBwYXJhbSBjb3VudCB7bnVtYmVyfSB0aGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhpcyBzY2FsaW5nIGxpc3RcbiAgICogQHNlZSBSZWNvbW1lbmRhdGlvbiBJVFUtVCBILjI2NCwgU2VjdGlvbiA3LjMuMi4xLjEuMVxuICAgKi9cbiAgc2tpcFNjYWxpbmdMaXN0KGNvdW50KSB7XG4gICAgdmFyXG4gICAgICBsYXN0U2NhbGUgPSA4LFxuICAgICAgbmV4dFNjYWxlID0gOCxcbiAgICAgIGosXG4gICAgICBkZWx0YVNjYWxlO1xuICAgIGZvciAoaiA9IDA7IGogPCBjb3VudDsgaisrKSB7XG4gICAgICBpZiAobmV4dFNjYWxlICE9PSAwKSB7XG4gICAgICAgIGRlbHRhU2NhbGUgPSB0aGlzLnJlYWRFRygpO1xuICAgICAgICBuZXh0U2NhbGUgPSAobGFzdFNjYWxlICsgZGVsdGFTY2FsZSArIDI1NikgJSAyNTY7XG4gICAgICB9XG4gICAgICBsYXN0U2NhbGUgPSAobmV4dFNjYWxlID09PSAwKSA/IGxhc3RTY2FsZSA6IG5leHRTY2FsZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVhZCBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgYW5kIHJldHVybiBzb21lIGludGVyZXN0aW5nIHZpZGVvXG4gICAqIHByb3BlcnRpZXMuIEEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBpcyB0aGUgSDI2NCBtZXRhZGF0YSB0aGF0XG4gICAqIGRlc2NyaWJlcyB0aGUgcHJvcGVydGllcyBvZiB1cGNvbWluZyB2aWRlbyBmcmFtZXMuXG4gICAqIEBwYXJhbSBkYXRhIHtVaW50OEFycmF5fSB0aGUgYnl0ZXMgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0XG4gICAqIEByZXR1cm4ge29iamVjdH0gYW4gb2JqZWN0IHdpdGggY29uZmlndXJhdGlvbiBwYXJzZWQgZnJvbSB0aGVcbiAgICogc2VxdWVuY2UgcGFyYW1ldGVyIHNldCwgaW5jbHVkaW5nIHRoZSBkaW1lbnNpb25zIG9mIHRoZVxuICAgKiBhc3NvY2lhdGVkIHZpZGVvIGZyYW1lcy5cbiAgICovXG4gIHJlYWRTUFMoKSB7XG4gICAgdmFyXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSAwLFxuICAgICAgc2FyU2NhbGUgPSAxLFxuICAgICAgcHJvZmlsZUlkYyxwcm9maWxlQ29tcGF0LGxldmVsSWRjLFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlLCBwaWNXaWR0aEluTWJzTWludXMxLFxuICAgICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSxcbiAgICAgIGZyYW1lTWJzT25seUZsYWcsXG4gICAgICBzY2FsaW5nTGlzdENvdW50LFxuICAgICAgaTtcbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIHByb2ZpbGVJZGMgPSB0aGlzLnJlYWRVQnl0ZSgpOyAvLyBwcm9maWxlX2lkY1xuICAgIHByb2ZpbGVDb21wYXQgPSB0aGlzLnJlYWRCaXRzKDUpOyAvLyBjb25zdHJhaW50X3NldFswLTRdX2ZsYWcsIHUoNSlcbiAgICB0aGlzLnNraXBCaXRzKDMpOyAvLyByZXNlcnZlZF96ZXJvXzNiaXRzIHUoMyksXG4gICAgbGV2ZWxJZGMgPSB0aGlzLnJlYWRVQnl0ZSgpOyAvL2xldmVsX2lkYyB1KDgpXG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIHNlcV9wYXJhbWV0ZXJfc2V0X2lkXG4gICAgLy8gc29tZSBwcm9maWxlcyBoYXZlIG1vcmUgb3B0aW9uYWwgZGF0YSB3ZSBkb24ndCBuZWVkXG4gICAgaWYgKHByb2ZpbGVJZGMgPT09IDEwMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTIyIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDI0NCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA0NCAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gODMgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDg2ICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTggfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTI4KSB7XG4gICAgICB2YXIgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2x1bWFfbWludXM4XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIGxvZzJfbWF4X2ZyYW1lX251bV9taW51czRcbiAgICB2YXIgcGljT3JkZXJDbnRUeXBlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVUVHKCk7IC8vbG9nMl9tYXhfcGljX29yZGVyX2NudF9sc2JfbWludXM0XG4gICAgfSBlbHNlIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDEpIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRlbHRhX3BpY19vcmRlcl9hbHdheXNfemVyb19mbGFnXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbWF4X251bV9yZWZfZnJhbWVzXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZ2Fwc19pbl9mcmFtZV9udW1fdmFsdWVfYWxsb3dlZF9mbGFnXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgLy8gdnVpX3BhcmFtZXRlcnNfcHJlc2VudF9mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7XG4gICAgICAgIC8vIGFzcGVjdF9yYXRpb19pbmZvX3ByZXNlbnRfZmxhZ1xuICAgICAgICBsZXQgc2FyUmF0aW87XG4gICAgICAgIGNvbnN0IGFzcGVjdFJhdGlvSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICAgICAgc3dpdGNoIChhc3BlY3RSYXRpb0lkYykge1xuICAgICAgICAgIGNhc2UgMTogc2FyUmF0aW8gPSBbMSwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyOiBzYXJSYXRpbyA9IFsxMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzogc2FyUmF0aW8gPSBbMTAsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6IHNhclJhdGlvID0gWzE2LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA1OiBzYXJSYXRpbyA9IFs0MCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNjogc2FyUmF0aW8gPSBbMjQsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDc6IHNhclJhdGlvID0gWzIwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA4OiBzYXJSYXRpbyA9IFszMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgOTogc2FyUmF0aW8gPSBbODAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEwOiBzYXJSYXRpbyA9IFsxOCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTE6IHNhclJhdGlvID0gWzE1LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMjogc2FyUmF0aW8gPSBbNjQsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEzOiBzYXJSYXRpbyA9IFsxNjAsOTldOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE0OiBzYXJSYXRpbyA9IFs0LDNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE1OiBzYXJSYXRpbyA9IFszLDJdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE2OiBzYXJSYXRpbyA9IFsyLDFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDI1NToge1xuICAgICAgICAgICAgc2FyUmF0aW8gPSBbdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKSwgdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNhclJhdGlvKSB7XG4gICAgICAgICAgc2FyU2NhbGUgPSBzYXJSYXRpb1swXSAvIHNhclJhdGlvWzFdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogTWF0aC5jZWlsKCgoKHBpY1dpZHRoSW5NYnNNaW51czEgKyAxKSAqIDE2KSAtIGZyYW1lQ3JvcExlZnRPZmZzZXQgKiAyIC0gZnJhbWVDcm9wUmlnaHRPZmZzZXQgKiAyKSAqIHNhclNjYWxlKSxcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKChmcmFtZU1ic09ubHlGbGFnPyAyIDogNCkgKiAoZnJhbWVDcm9wVG9wT2Zmc2V0ICsgZnJhbWVDcm9wQm90dG9tT2Zmc2V0KSlcbiAgICB9O1xuICB9XG5cbiAgcmVhZFNsaWNlVHlwZSgpIHtcbiAgICAvLyBza2lwIE5BTHUgdHlwZVxuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgLy8gZGlzY2FyZCBmaXJzdF9tYl9pbl9zbGljZVxuICAgIHRoaXMucmVhZFVFRygpO1xuICAgIC8vIHJldHVybiBzbGljZV90eXBlXG4gICAgcmV0dXJuIHRoaXMucmVhZFVFRygpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV4cEdvbG9tYjtcbiIsIi8qKlxuICogSUQzIHBhcnNlclxuICovXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuXG4gY2xhc3MgSUQzIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5faGFzVGltZVN0YW1wID0gZmFsc2U7XG4gICAgdmFyIG9mZnNldCA9IDAsIGJ5dGUxLGJ5dGUyLGJ5dGUzLGJ5dGU0LHRhZ1NpemUsZW5kUG9zLGhlYWRlcixsZW47XG4gICAgICBkbyB7XG4gICAgICAgIGhlYWRlciA9IHRoaXMucmVhZFVURihkYXRhLG9mZnNldCwzKTtcbiAgICAgICAgb2Zmc2V0Kz0zO1xuICAgICAgICAgIC8vIGZpcnN0IGNoZWNrIGZvciBJRDMgaGVhZGVyXG4gICAgICAgICAgaWYgKGhlYWRlciA9PT0gJ0lEMycpIHtcbiAgICAgICAgICAgICAgLy8gc2tpcCAyNCBiaXRzXG4gICAgICAgICAgICAgIG9mZnNldCArPSAzO1xuICAgICAgICAgICAgICAvLyByZXRyaWV2ZSB0YWcocykgbGVuZ3RoXG4gICAgICAgICAgICAgIGJ5dGUxID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlMiA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTMgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGU0ID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICB0YWdTaXplID0gKGJ5dGUxIDw8IDIxKSArIChieXRlMiA8PCAxNCkgKyAoYnl0ZTMgPDwgNykgKyBieXRlNDtcbiAgICAgICAgICAgICAgZW5kUG9zID0gb2Zmc2V0ICsgdGFnU2l6ZTtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBJRDMgdGFnIGZvdW5kLCBzaXplL2VuZDogJHt0YWdTaXplfS8ke2VuZFBvc31gKTtcblxuICAgICAgICAgICAgICAvLyByZWFkIElEMyB0YWdzXG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlSUQzRnJhbWVzKGRhdGEsIG9mZnNldCxlbmRQb3MpO1xuICAgICAgICAgICAgICBvZmZzZXQgPSBlbmRQb3M7XG4gICAgICAgICAgfSBlbHNlIGlmIChoZWFkZXIgPT09ICczREknKSB7XG4gICAgICAgICAgICAgIC8vIGh0dHA6Ly9pZDMub3JnL2lkM3YyLjQuMC1zdHJ1Y3R1cmUgY2hhcHRlciAzLjQuICAgSUQzdjIgZm9vdGVyXG4gICAgICAgICAgICAgIG9mZnNldCArPSA3O1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgM0RJIGZvb3RlciBmb3VuZCwgZW5kOiAke29mZnNldH1gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvZmZzZXQgLT0gMztcbiAgICAgICAgICAgICAgbGVuID0gb2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIGxlbjogJHtsZW59YCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhc1RpbWVTdGFtcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIud2FybignSUQzIHRhZyBmb3VuZCwgYnV0IG5vIHRpbWVzdGFtcCcpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZW5ndGggPSBsZW47XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcGF5bG9hZCA9IGRhdGEuc3ViYXJyYXkoMCxsZW4pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgfSB3aGlsZSAodHJ1ZSk7XG4gIH1cblxuICByZWFkVVRGKGRhdGEsc3RhcnQsbGVuKSB7XG5cbiAgICB2YXIgcmVzdWx0ID0gJycsb2Zmc2V0ID0gc3RhcnQsIGVuZCA9IHN0YXJ0ICsgbGVuO1xuICAgIGRvIHtcbiAgICAgIHJlc3VsdCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFbb2Zmc2V0KytdKTtcbiAgICB9IHdoaWxlKG9mZnNldCA8IGVuZCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIF9wYXJzZUlEM0ZyYW1lcyhkYXRhLG9mZnNldCxlbmRQb3MpIHtcbiAgICB2YXIgdGFnSWQsdGFnTGVuLHRhZ1N0YXJ0LHRhZ0ZsYWdzLHRpbWVzdGFtcDtcbiAgICB3aGlsZShvZmZzZXQgKyA4IDw9IGVuZFBvcykge1xuICAgICAgdGFnSWQgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsNCk7XG4gICAgICBvZmZzZXQgKz00O1xuXG4gICAgICB0YWdMZW4gPSBkYXRhW29mZnNldCsrXSA8PCAyNCArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10gPDwgMTYgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDggK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdGbGFncyA9IGRhdGFbb2Zmc2V0KytdIDw8IDggK1xuICAgICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK107XG5cbiAgICAgIHRhZ1N0YXJ0ID0gb2Zmc2V0O1xuICAgICAgLy9sb2dnZXIubG9nKFwiSUQzIHRhZyBpZDpcIiArIHRhZ0lkKTtcbiAgICAgIHN3aXRjaCh0YWdJZCkge1xuICAgICAgICBjYXNlICdQUklWJzpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncGFyc2UgZnJhbWU6JyArIEhleC5oZXhEdW1wKGRhdGEuc3ViYXJyYXkob2Zmc2V0LGVuZFBvcykpKTtcbiAgICAgICAgICAgIC8vIG93bmVyIHNob3VsZCBiZSBcImNvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wXCJcbiAgICAgICAgICAgIGlmICh0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsNDQpID09PSAnY29tLmFwcGxlLnN0cmVhbWluZy50cmFuc3BvcnRTdHJlYW1UaW1lc3RhbXAnKSB7XG4gICAgICAgICAgICAgICAgb2Zmc2V0Kz00NDtcbiAgICAgICAgICAgICAgICAvLyBzbWVsbGluZyBldmVuIGJldHRlciAhIHdlIGZvdW5kIHRoZSByaWdodCBkZXNjcmlwdG9yXG4gICAgICAgICAgICAgICAgLy8gc2tpcCBudWxsIGNoYXJhY3RlciAoc3RyaW5nIGVuZCkgKyAzIGZpcnN0IGJ5dGVzXG4gICAgICAgICAgICAgICAgb2Zmc2V0Kz0gNDtcblxuICAgICAgICAgICAgICAgIC8vIHRpbWVzdGFtcCBpcyAzMyBiaXQgZXhwcmVzc2VkIGFzIGEgYmlnLWVuZGlhbiBlaWdodC1vY3RldCBudW1iZXIsIHdpdGggdGhlIHVwcGVyIDMxIGJpdHMgc2V0IHRvIHplcm8uXG4gICAgICAgICAgICAgICAgdmFyIHB0czMzQml0ICA9IGRhdGFbb2Zmc2V0KytdICYgMHgxO1xuICAgICAgICAgICAgICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSAoKGRhdGFbb2Zmc2V0KytdIDw8IDIzKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCsrXSA8PCAxNSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgIDcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10pIC80NTtcblxuICAgICAgICAgICAgICAgIGlmIChwdHMzM0JpdCkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXAgICArPSA0NzcyMTg1OC44NDsgLy8gMl4zMiAvIDkwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCA9IE1hdGgucm91bmQodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIudHJhY2UoYElEMyB0aW1lc3RhbXAgZm91bmQ6ICR7dGltZXN0YW1wfWApO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RpbWVTdGFtcCA9IHRpbWVzdGFtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IGhhc1RpbWVTdGFtcCgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzVGltZVN0YW1wO1xuICB9XG5cbiAgZ2V0IHRpbWVTdGFtcCgpIHtcbiAgICByZXR1cm4gdGhpcy5fdGltZVN0YW1wO1xuICB9XG5cbiAgZ2V0IGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGVuZ3RoO1xuICB9XG5cbiAgZ2V0IHBheWxvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BheWxvYWQ7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBJRDM7XG5cbiIsIi8qKlxuICogaGlnaGx5IG9wdGltaXplZCBUUyBkZW11eGVyOlxuICogcGFyc2UgUEFULCBQTVRcbiAqIGV4dHJhY3QgUEVTIHBhY2tldCBmcm9tIGF1ZGlvIGFuZCB2aWRlbyBQSURzXG4gKiBleHRyYWN0IEFWQy9IMjY0IE5BTCB1bml0cyBhbmQgQUFDL0FEVFMgc2FtcGxlcyBmcm9tIFBFUyBwYWNrZXRcbiAqIHRyaWdnZXIgdGhlIHJlbXV4ZXIgdXBvbiBwYXJzaW5nIGNvbXBsZXRpb25cbiAqIGl0IGFsc28gdHJpZXMgdG8gd29ya2Fyb3VuZCBhcyBiZXN0IGFzIGl0IGNhbiBhdWRpbyBjb2RlYyBzd2l0Y2ggKEhFLUFBQyB0byBBQUMgYW5kIHZpY2UgdmVyc2EpLCB3aXRob3V0IGhhdmluZyB0byByZXN0YXJ0IHRoZSBNZWRpYVNvdXJjZS5cbiAqIGl0IGFsc28gY29udHJvbHMgdGhlIHJlbXV4aW5nIHByb2Nlc3MgOlxuICogdXBvbiBkaXNjb250aW51aXR5IG9yIGxldmVsIHN3aXRjaCBkZXRlY3Rpb24sIGl0IHdpbGwgYWxzbyBub3RpZmllcyB0aGUgcmVtdXhlciBzbyB0aGF0IGl0IGNhbiByZXNldCBpdHMgc3RhdGUuXG4qL1xuXG4gaW1wb3J0IEFEVFMgZnJvbSAnLi9hZHRzJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXhwR29sb21iIGZyb20gJy4vZXhwLWdvbG9tYic7XG4vLyBpbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG4gaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLmxhc3RDQyA9IDA7XG4gICAgdGhpcy5yZW11eGVyID0gbmV3IHRoaXMucmVtdXhlckNsYXNzKG9ic2VydmVyKTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9iZShkYXRhKSB7XG4gICAgLy8gYSBUUyBmcmFnbWVudCBzaG91bGQgY29udGFpbiBhdCBsZWFzdCAzIFRTIHBhY2tldHMsIGEgUEFULCBhIFBNVCwgYW5kIG9uZSBQSUQsIGVhY2ggc3RhcnRpbmcgd2l0aCAweDQ3XG4gICAgaWYgKGRhdGEubGVuZ3RoID49IDMqMTg4ICYmIGRhdGFbMF0gPT09IDB4NDcgJiYgZGF0YVsxODhdID09PSAweDQ3ICYmIGRhdGFbMioxODhdID09PSAweDQ3KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSAtMTtcbiAgICB0aGlzLmxhc3RBYWNQVFMgPSBudWxsO1xuICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIHRoaXMuX2F2Y1RyYWNrID0ge2NvbnRhaW5lciA6ICd2aWRlby9tcDJ0JywgdHlwZTogJ3ZpZGVvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwLCBuYk5hbHUgOiAwfTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHtjb250YWluZXIgOiAndmlkZW8vbXAydCcsIHR5cGU6ICdhdWRpbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gICAgdGhpcy5faWQzVHJhY2sgPSB7dHlwZTogJ2lkMycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gICAgdGhpcy5fdHh0VHJhY2sgPSB7dHlwZTogJ3RleHQnLCBpZDogLTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzOiBbXSwgbGVuOiAwfTtcbiAgICB0aGlzLnJlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgfVxuXG4gIGluc2VydERpc2NvbnRpbnVpdHkoKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgIHRoaXMucmVtdXhlci5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKSB7XG4gICAgbG9nZ2VyLmluZm8oJ3RzZGVtdXhlciB0MDogJyArIHQwKTtcbiAgICB2YXIgYXZjRGF0YSwgYWFjRGF0YSwgaWQzRGF0YSxcbiAgICAgICAgc3RhcnQsIGxlbiA9IGRhdGEubGVuZ3RoLCBzdHQsIHBpZCwgYXRmLCBvZmZzZXQsXG4gICAgICAgIGNvZGVjc09ubHkgPSB0aGlzLnJlbXV4ZXIucGFzc3Rocm91Z2g7XG5cbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgIHRoaXMuY29udGlndW91cyA9IGZhbHNlO1xuICAgIGlmIChjYyAhPT0gdGhpcy5sYXN0Q0MpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2NvbnRpbnVpdHkgZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICAgICAgdGhpcy5sYXN0Q0MgPSBjYztcbiAgICB9IGVsc2UgaWYgKGxldmVsICE9PSB0aGlzLmxhc3RMZXZlbCkge1xuICAgICAgbG9nZ2VyLmxvZygnbGV2ZWwgc3dpdGNoIGRldGVjdGVkJyk7XG4gICAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgICB0aGlzLmxhc3RMZXZlbCA9IGxldmVsO1xuICAgIH0gZWxzZSBpZiAoc24gPT09ICh0aGlzLmxhc3RTTisxKSkge1xuICAgICAgdGhpcy5jb250aWd1b3VzID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5sYXN0U04gPSBzbjtcblxuICAgIGlmKCF0aGlzLmNvbnRpZ3VvdXMpIHtcbiAgICAgIC8vIGZsdXNoIGFueSBwYXJ0aWFsIGNvbnRlbnRcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCxcbiAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZCxcbiAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZCxcbiAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcblxuXHR2YXIgZmlyc3RGcmFtZSA9IHRydWU7XG4gICAgLy8gZG9uJ3QgcGFyc2UgbGFzdCBUUyBwYWNrZXQgaWYgaW5jb21wbGV0ZVxuICAgIGxlbiAtPSBsZW4gJSAxODg7XG4gICAgLy8gbG9vcCB0aHJvdWdoIFRTIHBhY2tldHNcbiAgICBmb3IgKHN0YXJ0ID0gMDsgc3RhcnQgPCBsZW47IHN0YXJ0ICs9IDE4OCkge1xuICAgICAgaWYgKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQgKyAxXSAmIDB4NDApO1xuICAgICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCArIDFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0ICsgMl07XG4gICAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0ICsgM10gJiAweDMwKSA+PiA0O1xuICAgICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgICAgaWYgKGF0ZiA+IDEpIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDUgKyBkYXRhW3N0YXJ0ICsgNF07XG4gICAgICAgICAgLy8gY29udGludWUgaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgICAgaWYgKG9mZnNldCA9PT0gKHN0YXJ0ICsgMTg4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocG10UGFyc2VkKSB7XG4gICAgICAgICAgaWYgKHBpZCA9PT0gYXZjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgICB2YXIgaXNGcmFtZU9rRm9yQ2hyb21lT1NYID0gdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSksIGZpcnN0RnJhbWUpO1xuXHRcdFx0XHRpZiAoaXNGcmFtZU9rRm9yQ2hyb21lT1NYKSB7IGZpcnN0RnJhbWUgPSBmYWxzZTsgfVxuICAgICAgICAgICAgICAgIGlmIChjb2RlY3NPbmx5KSB7XG4gICAgICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIHZpZGVvIGNvZGVjIGluZm8gQU5EXG4gICAgICAgICAgICAgICAgICAvLyBpZiBhdWRpbyBQSUQgaXMgdW5kZWZpbmVkIE9SIGlmIHdlIGhhdmUgYXVkaW8gY29kZWMgaW5mbyxcbiAgICAgICAgICAgICAgICAgIC8vIHdlIGhhdmUgYWxsIGNvZGVjIGluZm8gIVxuICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F2Y1RyYWNrLmNvZGVjICYmIChhYWNJZCA9PT0gLTEgfHwgdGhpcy5fYWFjVHJhY2suY29kZWMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVtdXgoZGF0YSwgdDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF2Y0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgYXZjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gYWFjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvZGVjc09ubHkpIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhlcmUgd2Ugbm93IHRoYXQgd2UgaGF2ZSBhdWRpbyBjb2RlYyBpbmZvXG4gICAgICAgICAgICAgICAgICAvLyBpZiB2aWRlbyBQSUQgaXMgdW5kZWZpbmVkIE9SIGlmIHdlIGhhdmUgdmlkZW8gY29kZWMgaW5mbyxcbiAgICAgICAgICAgICAgICAgIC8vIHdlIGhhdmUgYWxsIGNvZGVjIGluZm9zICFcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hYWNUcmFjay5jb2RlYyAmJiAoYXZjSWQgPT09IC0xIHx8IHRoaXMuX2F2Y1RyYWNrLmNvZGVjKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbXV4KGRhdGEsIHQwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhYWNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgIGFhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhYWNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGlkM0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlkM0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgaWQzRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGlkM0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgb2Zmc2V0ICs9IGRhdGFbb2Zmc2V0XSArIDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwaWQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUEFUKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IHRoaXMuX3BtdElkKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBNVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgICAgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQgPSB0cnVlO1xuICAgICAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZDtcbiAgICAgICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQ7XG4gICAgICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnVFMgcGFja2V0IGRpZCBub3Qgc3RhcnQgd2l0aCAweDQ3J30pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBwYXJzZSBsYXN0IFBFUyBwYWNrZXRcbiAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgIH1cbiAgICB0aGlzLnJlbXV4KG51bGwsIHQwKTtcbiAgfVxuXG4gIHJlbXV4KGRhdGEsIHQwKSB7XG5cdGxvZ2dlci5pbmZvKCd0c2RlbXV4ZXIgcGFzc2luZyB0MCB0byByZW11eDogJyArIHQwKTtcbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2ssIHRoaXMuX2F2Y1RyYWNrLCB0aGlzLl9pZDNUcmFjaywgdGhpcy5fdHh0VHJhY2ssIHRoaXMudGltZU9mZnNldCwgdGhpcy5jb250aWd1b3VzLCBkYXRhLCB0MCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgcGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBQYWNrZXRpemVkIG1ldGFkYXRhIChJRDMpXG4gICAgICAgIGNhc2UgMHgxNTpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0lEMyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2lkM1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCwgZnJhZywgcGVzRmxhZ3MsIHBlc1ByZWZpeCwgcGVzTGVuLCBwZXNIZHJMZW4sIHBlc0RhdGEsIHBlc1B0cywgcGVzRHRzLCBwYXlsb2FkU3RhcnRPZmZzZXQsIGRhdGEgPSBzdHJlYW0uZGF0YTtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBkYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZiAocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8qIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICAgICAgYXMgUFRTIC8gRFRTIGlzIDMzIGJpdCB3ZSBjYW5ub3QgdXNlIGJpdHdpc2Ugb3BlcmF0b3IgaW4gSlMsXG4gICAgICAgICAgICBhcyBCaXR3aXNlIG9wZXJhdG9ycyB0cmVhdCB0aGVpciBvcGVyYW5kcyBhcyBhIHNlcXVlbmNlIG9mIDMyIGJpdHMgKi9cbiAgICAgICAgcGVzUHRzID0gKGZyYWdbOV0gJiAweDBFKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgIChmcmFnWzEwXSAmIDB4RkYpICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAoZnJhZ1sxMl0gJiAweEZGKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgKGZyYWdbMTNdICYgMHhGRSkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNQdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIGlmIChwZXNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgICBwZXNEdHMgPSAoZnJhZ1sxNF0gJiAweDBFICkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAgIChmcmFnWzE1XSAmIDB4RkYgKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgICAoZnJhZ1sxN10gJiAweEZGICkgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgICAgKGZyYWdbMThdICYgMHhGRSApIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzRHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlc0R0cyA9IHBlc1B0cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVzSGRyTGVuID0gZnJhZ1s4XTtcbiAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IHBlc0hkckxlbiArIDk7XG5cbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgd2hpbGUgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBkYXRhLnNoaWZ0KCk7XG4gICAgICAgIHZhciBsZW4gPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICAgIGlmIChwYXlsb2FkU3RhcnRPZmZzZXQpIHtcbiAgICAgICAgICBpZiAocGF5bG9hZFN0YXJ0T2Zmc2V0ID4gbGVuKSB7XG4gICAgICAgICAgICAvLyB0cmltIGZ1bGwgZnJhZyBpZiBQRVMgaGVhZGVyIGJpZ2dlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldC09bGVuO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRyaW0gcGFydGlhbCBmcmFnIGlmIFBFUyBoZWFkZXIgc21hbGxlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIGZyYWcgPSBmcmFnLnN1YmFycmF5KHBheWxvYWRTdGFydE9mZnNldCk7XG4gICAgICAgICAgICBsZW4tPXBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpKz1sZW47XG4gICAgICB9XG4gICAgICByZXR1cm4ge2RhdGE6IHBlc0RhdGEsIHB0czogcGVzUHRzLCBkdHM6IHBlc0R0cywgbGVuOiBwZXNMZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VBVkNQRVMocGVzLCBmaXJzdEZyYW1lKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSksXG4gICAgICAgIHVuaXRzMiA9IFtdLFxuICAgICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgICBrZXkgPSBmYWxzZSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgZXhwR29sb21iRGVjb2RlcixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBwdXNoLFxuICAgICAgICBpO1xuICAgIC8vIG5vIE5BTHUgZm91bmRcbiAgICBpZiAodW5pdHMubGVuZ3RoID09PSAwICYmIHNhbXBsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYXBwZW5kIHBlcy5kYXRhIHRvIHByZXZpb3VzIE5BTCB1bml0XG4gICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBwZXMuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwgMCk7XG4gICAgICB0bXAuc2V0KHBlcy5kYXRhLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB0cmFjay5sZW4gKz0gcGVzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdmFyIGRlYnVnU3RyaW5nID0gJyc7XG5cblx0dmFyIHR5cGVzID0gJyc7XG5cdHZhciBzaG91bGRFeGl0ID0gZmFsc2U7XG5cblx0dmFyIFNFSUNvdW50ZXIgPSAwO1xuXG4gICAgdW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcblx0XHRpZiAoc2hvdWxkRXhpdCkgcmV0dXJuO1xuXHRcdHR5cGVzICs9ICcgJyArIHVuaXQudHlwZTtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9ORFJcbiAgICAgICAgIGNhc2UgMTpcblx0XHQgICBpZiggZmlyc3RGcmFtZSAmJlxuXHRcdFx0ICAgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSA+IC0xICYmIFxuXHRcdFx0ICAgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTFcblx0XHQgICApIHsgXG5cblx0XHRcdCAgIGNvbnNvbGUud2FybignZmlyc3QgZnJhbWUgd2l0aCAnICsgdW5pdC50eXBlICsgJzsgc2tpcHBpbmcgdG8gcHJldmVudCBjaHJvbWUgaGFyZHdhcmUgZGVjb2RlciBpc3N1ZSBvbiBvc3gnKTsgXG5cdFx0XHQgICBwdXNoID0gZmFsc2U7XG5cdFx0XHQgICBzaG91bGRFeGl0ID0gdHJ1ZTtcblx0XHRcdCAgIHJldHVybiBmYWxzZTtcblx0XHRcdCAgIGJyZWFrO1xuXHRcdCAgIH1cbiAgICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnTkRSICc7XG4gICAgICAgICAgIH1cbiAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0lEUiAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NFSVxuICAgICAgICBjYXNlIDY6XG5cdFx0ICAgU0VJQ291bnRlcisrO1xuXHRcdCAgIGlmKCBmaXJzdEZyYW1lICYmIFxuXHRcdFx0ICAgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSA+IC0xICYmIFxuXHRcdFx0ICAgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEgJiZcblx0XHRcdCAgIFNFSUNvdW50ZXIgPiAxXG5cdFx0ICAgKSB7IFxuXHRcdFx0ICAgIGNvbnNvbGUud2FybignZmlyc3QgZnJhbWUgd2l0aCAnICsgdW5pdC50eXBlICsgJzsgc2tpcHBpbmcgdG8gcHJldmVudCBjaHJvbWUgaGFyZHdhcmUgZGVjb2RlciBpc3N1ZSBvbiBvc3gnKTsgXG5cdFx0XHQgICAgcHVzaCA9IGZhbHNlO1xuXHRcdFx0XHRzaG91bGRFeGl0ID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0ICAgIGJyZWFrO1xuXHRcdCAgICB9XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTRUkgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcblxuICAgICAgICAgIC8vIHNraXAgZnJhbWVUeXBlXG4gICAgICAgICAgZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIHZhciBwYXlsb2FkVHlwZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAvLyBUT0RPOiB0aGVyZSBjYW4gYmUgbW9yZSB0aGFuIG9uZSBwYXlsb2FkIGluIGFuIFNFSSBwYWNrZXQuLi5cbiAgICAgICAgICAvLyBUT0RPOiBuZWVkIHRvIHJlYWQgdHlwZSBhbmQgc2l6ZSBpbiBhIHdoaWxlIGxvb3AgdG8gZ2V0IHRoZW0gYWxsXG4gICAgICAgICAgaWYgKHBheWxvYWRUeXBlID09PSA0KVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHZhciBwYXlsb2FkU2l6ZSA9IDA7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgcGF5bG9hZFNpemUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHBheWxvYWRTaXplID09PSAyNTUpO1xuXG4gICAgICAgICAgICB2YXIgY291bnRyeUNvZGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoY291bnRyeUNvZGUgPT09IDE4MSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdmFyIHByb3ZpZGVyQ29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVTaG9ydCgpO1xuXG4gICAgICAgICAgICAgIGlmIChwcm92aWRlckNvZGUgPT09IDQ5KVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmFyIHVzZXJTdHJ1Y3R1cmUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVSW50KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAodXNlclN0cnVjdHVyZSA9PT0gMHg0NzQxMzkzNClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB2YXIgdXNlckRhdGFUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgLy8gUmF3IENFQS02MDggYnl0ZXMgd3JhcHBlZCBpbiBDRUEtNzA4IHBhY2tldFxuICAgICAgICAgICAgICAgICAgaWYgKHVzZXJEYXRhVHlwZSA9PT0gMylcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpcnN0Qnl0ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZWNvbmRCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgdG90YWxDQ3MgPSAzMSAmIGZpcnN0Qnl0ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJ5dGVBcnJheSA9IFtmaXJzdEJ5dGUsIHNlY29uZEJ5dGVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaT0wOyBpPHRvdGFsQ0NzOyBpKyspXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyAzIGJ5dGVzIHBlciBDQ1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHh0VHJhY2suc2FtcGxlcy5wdXNoKHt0eXBlOiAzLCBwdHM6IHBlcy5wdHMsIGJ5dGVzOiBieXRlQXJyYXl9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNQUygpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgdmFyIGNvZGVjYXJyYXkgPSB1bml0LmRhdGEuc3ViYXJyYXkoMSwgNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgPSAnYXZjMS4nO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdQUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA5OlxuICAgICAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0FVRCAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBwdXNoID0gZmFsc2U7XG4gICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ3Vua25vd24gTkFMICcgKyB1bml0LnR5cGUgKyAnICc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZihwdXNoKSB7XG4gICAgICAgIHVuaXRzMi5wdXNoKHVuaXQpO1xuICAgICAgICBsZW5ndGgrPXVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgIH0pO1xuXG5cdGlmIChmaXJzdEZyYW1lKSB7IFxuXHRcdHR5cGVzID0gJyoqICcgKyB0eXBlczsgXG5cdFx0Y29uc29sZS5pbmZvKHR5cGVzICsgJycpO1xuXHR9XG5cblx0aWYgKHNob3VsZEV4aXQpIHtcblx0XHRjb25zb2xlLndhcm4oJ3NraXBwaW5nIGZyYW1lJyk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cbiAgICBpZihkZWJ1ZyB8fCBkZWJ1Z1N0cmluZy5sZW5ndGgpIHtcbiAgICAgIGxvZ2dlci5sb2coZGVidWdTdHJpbmcpO1xuICAgIH1cbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGlmICh1bml0czIubGVuZ3RoKSB7XG4gICAgICAvLyBvbmx5IHB1c2ggQVZDIHNhbXBsZSBpZiBrZXlmcmFtZSBhbHJlYWR5IGZvdW5kLiBicm93c2VycyBleHBlY3QgYSBrZXlmcmFtZSBhdCBmaXJzdCB0byBzdGFydCBkZWNvZGluZ1xuICAgICAgaWYgKGtleSA9PT0gdHJ1ZSB8fCB0cmFjay5zcHMgKSB7XG4gICAgICAgIGF2Y1NhbXBsZSA9IHt1bml0czogeyB1bml0cyA6IHVuaXRzMiwgbGVuZ3RoIDogbGVuZ3RofSwgcHRzOiBwZXMucHRzLCBkdHM6IHBlcy5kdHMsIGtleToga2V5fTtcbiAgICAgICAgc2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBsZW5ndGg7XG4gICAgICAgIHRyYWNrLm5iTmFsdSArPSB1bml0czIubGVuZ3RoO1xuICAgICAgfVxuICAgIH1cblx0cmV0dXJuIHRydWU7XG4gIH1cblxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsIGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsIHZhbHVlLCBvdmVyZmxvdywgc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCwgbGFzdFVuaXRUeXBlO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmKCB2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSAxICYmIGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgaSAtIHN0YXRlIC0gMSksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzO1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdHMgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLFxuICAgICAgICAgICAgICAgICAgICAgIGxhc3RVbml0ID0gbGFzdFVuaXRzW2xhc3RVbml0cy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLCBvdmVyZmxvdyksIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB0cmFjay5sZW4gKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuaXRzO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBkYXRhID0gcGVzLmRhdGEsXG4gICAgICAgIHB0cyA9IHBlcy5wdHMsXG4gICAgICAgIHN0YXJ0T2Zmc2V0ID0gMCxcbiAgICAgICAgZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbixcbiAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMuYXVkaW9Db2RlYyxcbiAgICAgICAgYWFjT3ZlckZsb3cgPSB0aGlzLmFhY092ZXJGbG93LFxuICAgICAgICBsYXN0QWFjUFRTID0gdGhpcy5sYXN0QWFjUFRTLFxuICAgICAgICBjb25maWcsIGZyYW1lTGVuZ3RoLCBmcmFtZUR1cmF0aW9uLCBmcmFtZUluZGV4LCBvZmZzZXQsIGhlYWRlckxlbmd0aCwgc3RhbXAsIGxlbiwgYWFjU2FtcGxlO1xuICAgIGlmIChhYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGFhY092ZXJGbG93LmJ5dGVMZW5ndGggKyBkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldChhYWNPdmVyRmxvdywgMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsIGFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgLy9sb2dnZXIubG9nKGBBQUM6IGFwcGVuZCBvdmVyZmxvd2luZyAke2FhY092ZXJGbG93LmJ5dGVMZW5ndGh9IGJ5dGVzIHRvIGJlZ2lubmluZyBvZiBuZXcgUEVTYCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAob2Zmc2V0ID0gc3RhcnRPZmZzZXQsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChvZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKG9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke29mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmF0YWwsIHJlYXNvbjogcmVhc29ufSk7XG4gICAgICBpZiAoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIGZyYW1lSW5kZXggPSAwO1xuICAgIGZyYW1lRHVyYXRpb24gPSAxMDI0ICogOTAwMDAgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG5cbiAgICAvLyBpZiBsYXN0IEFBQyBmcmFtZSBpcyBvdmVyZmxvd2luZywgd2Ugc2hvdWxkIGVuc3VyZSB0aW1lc3RhbXBzIGFyZSBjb250aWd1b3VzOlxuICAgIC8vIGZpcnN0IHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGZyYW1lRHVyYXRpb25cbiAgICBpZihhYWNPdmVyRmxvdyAmJiBsYXN0QWFjUFRTKSB7XG4gICAgICB2YXIgbmV3UFRTID0gbGFzdEFhY1BUUytmcmFtZUR1cmF0aW9uO1xuICAgICAgaWYoTWF0aC5hYnMobmV3UFRTLXB0cykgPiAxKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYEFBQzogYWxpZ24gUFRTIGZvciBvdmVybGFwcGluZyBmcmFtZXMgYnkgJHtNYXRoLnJvdW5kKChuZXdQVFMtcHRzKS85MCl9YCk7XG4gICAgICAgIHB0cz1uZXdQVFM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKChvZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gVGhlIHByb3RlY3Rpb24gc2tpcCBiaXQgdGVsbHMgdXMgaWYgd2UgaGF2ZSAyIGJ5dGVzIG9mIENSQyBkYXRhIGF0IHRoZSBlbmQgb2YgdGhlIEFEVFMgaGVhZGVyXG4gICAgICBoZWFkZXJMZW5ndGggPSAoISEoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgZnJhbWVMZW5ndGggPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSkgfFxuICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0ICsgNF0gPDwgMykgfFxuICAgICAgICAgICAgICAgICAgICAoKGRhdGFbb2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBmcmFtZUxlbmd0aCAgLT0gaGVhZGVyTGVuZ3RoO1xuICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG5cbiAgICAgIGlmICgoZnJhbWVMZW5ndGggPiAwKSAmJiAoKG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSA8PSBsZW4pKSB7XG4gICAgICAgIHN0YW1wID0gcHRzICsgZnJhbWVJbmRleCAqIGZyYW1lRHVyYXRpb247XG4gICAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3RvdGFsL3B0czoke29mZnNldCtoZWFkZXJMZW5ndGh9LyR7ZnJhbWVMZW5ndGh9LyR7ZGF0YS5ieXRlTGVuZ3RofS8keyhzdGFtcC85MCkudG9GaXhlZCgwKX1gKTtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoLCBvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCksIHB0czogc3RhbXAsIGR0czogc3RhbXB9O1xuICAgICAgICB0cmFjay5zYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGZyYW1lTGVuZ3RoO1xuICAgICAgICBvZmZzZXQgKz0gZnJhbWVMZW5ndGggKyBoZWFkZXJMZW5ndGg7XG4gICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBvZmZzZXQgPCAobGVuIC0gMSk7IG9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVtvZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9mZnNldCA8IGxlbikge1xuICAgICAgYWFjT3ZlckZsb3cgPSBkYXRhLnN1YmFycmF5KG9mZnNldCwgbGVuKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDOiBvdmVyZmxvdyBkZXRlY3RlZDoke2xlbi1vZmZzZXR9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hYWNPdmVyRmxvdyA9IGFhY092ZXJGbG93O1xuICAgIHRoaXMubGFzdEFhY1BUUyA9IHN0YW1wO1xuICB9XG5cbiAgX3BhcnNlSUQzUEVTKHBlcykge1xuICAgIHRoaXMuX2lkM1RyYWNrLnNhbXBsZXMucHVzaChwZXMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcblxuIiwiZXhwb3J0IGNvbnN0IEVycm9yVHlwZXMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbmV0d29yayBlcnJvciAobG9hZGluZyBlcnJvciAvIHRpbWVvdXQgLi4uKVxuICBORVRXT1JLX0VSUk9SOiAnbmV0d29ya0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtZWRpYSBFcnJvciAodmlkZW8vcGFyc2luZy9tZWRpYXNvdXJjZSBlcnJvcilcbiAgTUVESUFfRVJST1I6ICdtZWRpYUVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYWxsIG90aGVyIGVycm9yc1xuICBPVEhFUl9FUlJPUjogJ290aGVyRXJyb3InXG59O1xuXG5leHBvcnQgY29uc3QgRXJyb3JEZXRhaWxzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX0VSUk9SOiAnbWFuaWZlc3RMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfVElNRU9VVDogJ21hbmlmZXN0TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IHBhcnNpbmcgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfUEFSU0lOR19FUlJPUjogJ21hbmlmZXN0UGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCB3aXRoIG9ubHkgaW5jb21wYXRpYmxlIGNvZGVjcyBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVhc29uIDogZXJyb3IgcmVhc29ufVxuICBNQU5JRkVTVF9JTkNPTVBBVElCTEVfQ09ERUNTX0VSUk9SOiAnbWFuaWZlc3RJbmNvbXBhdGlibGVDb2RlY3NFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SOiAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQ6ICdsZXZlbExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9TV0lUQ0hfRVJST1I6ICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUjogJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOiAnZnJhZ0xvb3BMb2FkaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9USU1FT1VUOiAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBkZWNyeXB0aW9uIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0RFQ1JZUFRfRVJST1I6ICdmcmFnRGVjcnlwdEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1I6ICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEtFWV9MT0FEX0VSUk9SOiAna2V5TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRF9USU1FT1VUOiAna2V5TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmQgZXJyb3IgLSBkYXRhOiBhcHBlbmQgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORF9FUlJPUjogJ2J1ZmZlckFwcGVuZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRJTkdfRVJST1I6ICdidWZmZXJBcHBlbmRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHN0YWxsZWQgZXJyb3IgZXZlbnRcbiAgQlVGRkVSX1NUQUxMRURfRVJST1I6ICdidWZmZXJTdGFsbGVkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBmdWxsIGV2ZW50XG4gIEJVRkZFUl9GVUxMX0VSUk9SOiAnYnVmZmVyRnVsbEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgc2VlayBvdmVyIGhvbGUgZXZlbnRcbiAgQlVGRkVSX1NFRUtfT1ZFUl9IT0xFOiAnYnVmZmVyU2Vla092ZXJIb2xlJ1xufTtcbiIsIi8qXG4qXG4qIEFsbCBvYmplY3RzIGluIHRoZSBldmVudCBoYW5kbGluZyBjaGFpbiBzaG91bGQgaW5oZXJpdCBmcm9tIHRoaXMgY2xhc3NcbipcbiovXG5cbi8vaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMsIC4uLmV2ZW50cykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25FdmVudCA9IHRoaXMub25FdmVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZEV2ZW50cyA9IGV2ZW50cztcbiAgICB0aGlzLnVzZUdlbmVyaWNIYW5kbGVyID0gdHJ1ZTtcblxuICAgIHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy51bnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBpc0V2ZW50SGFuZGxlcigpIHtcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuaGFuZGxlZEV2ZW50cyA9PT0gJ29iamVjdCcgJiYgdGhpcy5oYW5kbGVkRXZlbnRzLmxlbmd0aCAmJiB0eXBlb2YgdGhpcy5vbkV2ZW50ID09PSAnZnVuY3Rpb24nO1xuICB9XG5cbiAgcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ID09PSAnaGxzRXZlbnRHZW5lcmljJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRm9yYmlkZGVuIGV2ZW50IG5hbWU6ICcgKyBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5obHMub24oZXZlbnQsIHRoaXMub25FdmVudCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHVucmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdGhpcy5obHMub2ZmKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAqIGFyZ3VtZW50czogZXZlbnQgKHN0cmluZyksIGRhdGEgKGFueSlcbiAgKi9cbiAgb25FdmVudChldmVudCwgZGF0YSkge1xuICAgIHRoaXMub25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpO1xuICB9XG5cbiAgb25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgZXZlbnRUb0Z1bmN0aW9uID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIHZhciBmdW5jTmFtZSA9ICdvbicgKyBldmVudC5yZXBsYWNlKCdobHMnLCAnJyk7XG4gICAgICBpZiAodHlwZW9mIHRoaXNbZnVuY05hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgJHtldmVudH0gaGFzIG5vIGdlbmVyaWMgaGFuZGxlciBpbiB0aGlzICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBjbGFzcyAodHJpZWQgJHtmdW5jTmFtZX0pYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1tmdW5jTmFtZV0uYmluZCh0aGlzLCBkYXRhKTtcbiAgICB9O1xuICAgIGV2ZW50VG9GdW5jdGlvbi5jYWxsKHRoaXMsIGV2ZW50LCBkYXRhKS5jYWxsKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXZlbnRIYW5kbGVyOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAvLyBmaXJlZCBiZWZvcmUgTWVkaWFTb3VyY2UgaXMgYXR0YWNoaW5nIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhIH1cbiAgTUVESUFfQVRUQUNISU5HOiAnaGxzTWVkaWFBdHRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfQVRUQUNIRUQ6ICdobHNNZWRpYUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgYmVmb3JlIGRldGFjaGluZyBNZWRpYVNvdXJjZSBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNISU5HOiAnaGxzTWVkaWFEZXRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIGRldGFjaGVkIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hFRDogJ2hsc01lZGlhRGV0YWNoZWQnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGJ1ZmZlciBpcyBnb2luZyB0byBiZSByZXNldHRlZFxuICBCVUZGRVJfUkVTRVQ6ICdobHNCdWZmZXJSZXNldCcsXG4gIC8vIGZpcmVkIHdoZW4gd2Uga25vdyBhYm91dCB0aGUgY29kZWNzIHRoYXQgd2UgbmVlZCBidWZmZXJzIGZvciB0byBwdXNoIGludG8gLSBkYXRhOiB7dHJhY2tzIDogeyBjb250YWluZXIsIGNvZGVjLCBsZXZlbENvZGVjLCBpbml0U2VnbWVudCwgbWV0YWRhdGEgfX1cbiAgQlVGRkVSX0NPREVDUzogJ2hsc0J1ZmZlckNvZGVjcycsXG4gIC8vIGZpcmVkIHdoZW4gd2UgYXBwZW5kIGEgc2VnbWVudCB0byB0aGUgYnVmZmVyIC0gZGF0YTogeyBzZWdtZW50OiBzZWdtZW50IG9iamVjdCB9XG4gIEJVRkZFUl9BUFBFTkRJTkc6ICdobHNCdWZmZXJBcHBlbmRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGFyZSBkb25lIHdpdGggYXBwZW5kaW5nIGEgbWVkaWEgc2VnbWVudCB0byB0aGUgYnVmZmVyXG4gIEJVRkZFUl9BUFBFTkRFRDogJ2hsc0J1ZmZlckFwcGVuZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgc3RyZWFtIGlzIGZpbmlzaGVkIGFuZCB3ZSB3YW50IHRvIG5vdGlmeSB0aGUgbWVkaWEgYnVmZmVyIHRoYXQgdGhlcmUgd2lsbCBiZSBubyBtb3JlIGRhdGFcbiAgQlVGRkVSX0VPUzogJ2hsc0J1ZmZlckVvcycsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIG1lZGlhIGJ1ZmZlciBzaG91bGQgYmUgZmx1c2hlZCAtIGRhdGEge3N0YXJ0T2Zmc2V0LCBlbmRPZmZzZXR9XG4gIEJVRkZFUl9GTFVTSElORzogJ2hsc0J1ZmZlckZsdXNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgbWVkaWEgaGFzIGJlZW4gZmx1c2hlZFxuICBCVUZGRVJfRkxVU0hFRDogJ2hsc0J1ZmZlckZsdXNoZWQnLFxuICAvLyBmaXJlZCB0byBzaWduYWwgdGhhdCBhIG1hbmlmZXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBtYW5pZmVzdFVSTH1cbiAgTUFOSUZFU1RfTE9BRElORzogJ2hsc01hbmlmZXN0TG9hZGluZycsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIGZpcnN0TGV2ZWwgOiBpbmRleCBvZiBmaXJzdCBxdWFsaXR5IGxldmVsIGFwcGVhcmluZyBpbiBNYW5pZmVzdH1cbiAgTUFOSUZFU1RfUEFSU0VEOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IGxldmVsIFVSTCAgbGV2ZWwgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkc6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRDogJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgZGV0YWlscyBoYXZlIGJlZW4gdXBkYXRlZCBiYXNlZCBvbiBwcmV2aW91cyBkZXRhaWxzLCBhZnRlciBpdCBoYXMgYmVlbiBsb2FkZWQuIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsIH1cbiAgTEVWRUxfVVBEQVRFRDogJ2hsc0xldmVsVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIFBUUyBpbmZvcm1hdGlvbiBoYXMgYmVlbiB1cGRhdGVkIGFmdGVyIHBhcnNpbmcgYSBmcmFnbWVudCAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCwgZHJpZnQ6IFBUUyBkcmlmdCBvYnNlcnZlZCB3aGVuIHBhcnNpbmcgbGFzdCBmcmFnbWVudCB9XG4gIExFVkVMX1BUU19VUERBVEVEOiAnaGxzTGV2ZWxQdHNVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgc2VpIHRleHQgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBzZWkgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19VU0VSREFUQTogJ2hsc0ZyYWdQYXJzaW5nVXNlcmRhdGEnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgaWQzIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgaWQzIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfTUVUQURBVEE6ICdobHNGcmFnUGFyc2luZ01ldGFkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBkYXRhIGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgZGF0YTEgOiBtb29mIE1QNCBib3ggb3IgVFMgZnJhZ21lbnRzLCBkYXRhMiA6IG1kYXQgTVA0IGJveCBvciBudWxsfVxuICBGUkFHX1BBUlNJTkdfREFUQTogJ2hsc0ZyYWdQYXJzaW5nRGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcGFyc2luZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB1bmRlZmluZWRcbiAgRlJBR19QQVJTRUQ6ICdobHNGcmFnUGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCByZW11eGVkIE1QNCBib3hlcyBoYXZlIGFsbCBiZWVuIGFwcGVuZGVkIGludG8gU291cmNlQnVmZmVyIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIHRwYXJzZWQsIHRidWZmZXJlZCwgbGVuZ3RofSB9XG4gIEZSQUdfQlVGRkVSRUQ6ICdobHNGcmFnQnVmZmVyZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IG1hdGNoaW5nIHdpdGggY3VycmVudCBtZWRpYSBwb3NpdGlvbiBpcyBjaGFuZ2luZyAtIGRhdGEgOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QgfVxuICBGUkFHX0NIQU5HRUQ6ICdobHNGcmFnQ2hhbmdlZCcsXG4gICAgLy8gSWRlbnRpZmllciBmb3IgYSBGUFMgZHJvcCBldmVudCAtIGRhdGE6IHtjdXJlbnREcm9wcGVkLCBjdXJyZW50RGVjb2RlZCwgdG90YWxEcm9wcGVkRnJhbWVzfVxuICBGUFNfRFJPUDogJ2hsc0Zwc0Ryb3AnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbiBlcnJvciBldmVudCAtIGRhdGE6IHsgdHlwZSA6IGVycm9yIHR5cGUsIGRldGFpbHMgOiBlcnJvciBkZXRhaWxzLCBmYXRhbCA6IGlmIHRydWUsIGhscy5qcyBjYW5ub3Qvd2lsbCBub3QgdHJ5IHRvIHJlY292ZXIsIGlmIGZhbHNlLCBobHMuanMgd2lsbCB0cnkgdG8gcmVjb3ZlcixvdGhlciBlcnJvciBzcGVjaWZpYyBkYXRhfVxuICBFUlJPUjogJ2hsc0Vycm9yJyxcbiAgLy8gZmlyZWQgd2hlbiBobHMuanMgaW5zdGFuY2Ugc3RhcnRzIGRlc3Ryb3lpbmcuIERpZmZlcmVudCBmcm9tIE1FRElBX0RFVEFDSEVEIGFzIG9uZSBjb3VsZCB3YW50IHRvIGRldGFjaCBhbmQgcmVhdHRhY2ggYSBtZWRpYSB0byB0aGUgaW5zdGFuY2Ugb2YgaGxzLmpzIHRvIGhhbmRsZSBtaWQtcm9sbHMgZm9yIGV4YW1wbGVcbiAgREVTVFJPWUlORzogJ2hsc0Rlc3Ryb3lpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEtFWV9MT0FESU5HOiAnaGxzS2V5TG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBkZWNyeXB0IGtleSBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGtleSBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEtFWV9MT0FERUQ6ICdobHNLZXlMb2FkZWQnLFxufTtcbiIsIi8qKlxuICogQnVmZmVyIEhlbHBlciBjbGFzcywgcHJvdmlkaW5nIG1ldGhvZHMgZGVhbGluZyBidWZmZXIgbGVuZ3RoIHJldHJpZXZhbFxuKi9cblxuXG5jbGFzcyBCdWZmZXJIZWxwZXIge1xuXG4gIHN0YXRpYyBidWZmZXJJbmZvKG1lZGlhLCBwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgaWYgKG1lZGlhKSB7XG4gICAgICB2YXIgdmJ1ZmZlcmVkID0gbWVkaWEuYnVmZmVyZWQsIGJ1ZmZlcmVkID0gW10saTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB2YnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYnVmZmVyZWQucHVzaCh7c3RhcnQ6IHZidWZmZXJlZC5zdGFydChpKSwgZW5kOiB2YnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5idWZmZXJlZEluZm8oYnVmZmVyZWQscG9zLG1heEhvbGVEdXJhdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7bGVuOiAwLCBzdGFydDogMCwgZW5kOiAwLCBuZXh0U3RhcnQgOiB1bmRlZmluZWR9IDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pIHtcbiAgICB2YXIgYnVmZmVyZWQyID0gW10sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlckxlbixidWZmZXJTdGFydCwgYnVmZmVyRW5kLGJ1ZmZlclN0YXJ0TmV4dCxpO1xuICAgIC8vIHNvcnQgb24gYnVmZmVyLnN0YXJ0L3NtYWxsZXIgZW5kIChJRSBkb2VzIG5vdCBhbHdheXMgcmV0dXJuIHNvcnRlZCBidWZmZXJlZCByYW5nZSlcbiAgICBidWZmZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICB2YXIgZGlmZiA9IGEuc3RhcnQgLSBiLnN0YXJ0O1xuICAgICAgaWYgKGRpZmYpIHtcbiAgICAgICAgcmV0dXJuIGRpZmY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYi5lbmQgLSBhLmVuZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiBtYXhIb2xlRHVyYXRpb24gYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvciAoaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJ1ZjJsZW4gPSBidWZmZXJlZDIubGVuZ3RoO1xuICAgICAgaWYoYnVmMmxlbikge1xuICAgICAgICB2YXIgYnVmMmVuZCA9IGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kO1xuICAgICAgICAvLyBpZiBzbWFsbCBob2xlICh2YWx1ZSBiZXR3ZWVuIDAgb3IgbWF4SG9sZUR1cmF0aW9uICkgb3Igb3ZlcmxhcHBpbmcgKG5lZ2F0aXZlKVxuICAgICAgICBpZigoYnVmZmVyZWRbaV0uc3RhcnQgLSBidWYyZW5kKSA8IG1heEhvbGVEdXJhdGlvbikge1xuICAgICAgICAgIC8vIG1lcmdlIG92ZXJsYXBwaW5nIHRpbWUgcmFuZ2VzXG4gICAgICAgICAgLy8gdXBkYXRlIGxhc3RSYW5nZS5lbmQgb25seSBpZiBzbWFsbGVyIHRoYW4gaXRlbS5lbmRcbiAgICAgICAgICAvLyBlLmcuICBbIDEsIDE1XSB3aXRoICBbIDIsOF0gPT4gWyAxLDE1XSAobm8gbmVlZCB0byBtb2RpZnkgbGFzdFJhbmdlLmVuZClcbiAgICAgICAgICAvLyB3aGVyZWFzIFsgMSwgOF0gd2l0aCAgWyAyLDE1XSA9PiBbIDEsMTVdICggbGFzdFJhbmdlIHNob3VsZCBzd2l0Y2ggZnJvbSBbMSw4XSB0byBbMSwxNV0pXG4gICAgICAgICAgaWYoYnVmZmVyZWRbaV0uZW5kID4gYnVmMmVuZCkge1xuICAgICAgICAgICAgYnVmZmVyZWQyW2J1ZjJsZW4gLSAxXS5lbmQgPSBidWZmZXJlZFtpXS5lbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGJpZyBob2xlXG4gICAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmaXJzdCB2YWx1ZVxuICAgICAgICBidWZmZXJlZDIucHVzaChidWZmZXJlZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zOyBpIDwgYnVmZmVyZWQyLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3RhcnQgPSAgYnVmZmVyZWQyW2ldLnN0YXJ0LFxuICAgICAgICAgIGVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQ7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA+PSBzdGFydCAmJiBwb3MgPCBlbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGVuZDtcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfSBlbHNlIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA8IHN0YXJ0KSB7XG4gICAgICAgIGJ1ZmZlclN0YXJ0TmV4dCA9IHN0YXJ0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cdC8vIGlmKCBidWZmZXJTdGFydCA9PSBidWZmZXJFbmQgJiYgYnVmZmVyRW5kICE9IDApIHsgZGVidWdnZXI7IH1cbiAgICByZXR1cm4ge2xlbjogYnVmZmVyTGVuLCBzdGFydDogYnVmZmVyU3RhcnQsIGVuZDogYnVmZmVyRW5kLCBuZXh0U3RhcnQgOiBidWZmZXJTdGFydE5leHR9O1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVySGVscGVyO1xuIiwiLyoqXG4gKiBMZXZlbCBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgd2l0aCBwbGF5bGlzdCBzbGlkaW5nIGFuZCBkcmlmdFxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIExldmVsSGVscGVyIHtcblxuICBzdGF0aWMgbWVyZ2VEZXRhaWxzKG9sZERldGFpbHMsbmV3RGV0YWlscykge1xuICAgIHZhciBzdGFydCA9IE1hdGgubWF4KG9sZERldGFpbHMuc3RhcnRTTixuZXdEZXRhaWxzLnN0YXJ0U04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZW5kID0gTWF0aC5taW4ob2xkRGV0YWlscy5lbmRTTixuZXdEZXRhaWxzLmVuZFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGRlbHRhID0gbmV3RGV0YWlscy5zdGFydFNOIC0gb2xkRGV0YWlscy5zdGFydFNOLFxuICAgICAgICBvbGRmcmFnbWVudHMgPSBvbGREZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgbmV3ZnJhZ21lbnRzID0gbmV3RGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIGNjT2Zmc2V0ID0wLFxuICAgICAgICBQVFNGcmFnO1xuXG4gICAgLy8gY2hlY2sgaWYgb2xkL25ldyBwbGF5bGlzdHMgaGF2ZSBmcmFnbWVudHMgaW4gY29tbW9uXG4gICAgaWYgKCBlbmQgPCBzdGFydCkge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBsb29wIHRocm91Z2ggb3ZlcmxhcHBpbmcgU04gYW5kIHVwZGF0ZSBzdGFydFBUUyAsIGNjLCBhbmQgZHVyYXRpb24gaWYgYW55IGZvdW5kXG4gICAgZm9yKHZhciBpID0gc3RhcnQgOyBpIDw9IGVuZCA7IGkrKykge1xuICAgICAgdmFyIG9sZEZyYWcgPSBvbGRmcmFnbWVudHNbZGVsdGEraV0sXG4gICAgICAgICAgbmV3RnJhZyA9IG5ld2ZyYWdtZW50c1tpXTtcbiAgICAgIGNjT2Zmc2V0ID0gb2xkRnJhZy5jYyAtIG5ld0ZyYWcuY2M7XG4gICAgICBpZiAoIWlzTmFOKG9sZEZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICAgIG5ld0ZyYWcuc3RhcnQgPSBuZXdGcmFnLnN0YXJ0UFRTID0gb2xkRnJhZy5zdGFydFBUUztcbiAgICAgICAgbmV3RnJhZy5lbmRQVFMgPSBvbGRGcmFnLmVuZFBUUztcbiAgICAgICAgbmV3RnJhZy5kdXJhdGlvbiA9IG9sZEZyYWcuZHVyYXRpb247XG4gICAgICAgIFBUU0ZyYWcgPSBuZXdGcmFnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGNjT2Zmc2V0KSB7XG4gICAgICBsb2dnZXIubG9nKGBkaXNjb250aW51aXR5IHNsaWRpbmcgZnJvbSBwbGF5bGlzdCwgdGFrZSBkcmlmdCBpbnRvIGFjY291bnRgKTtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5jYyArPSBjY09mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiBhdCBsZWFzdCBvbmUgZnJhZ21lbnQgY29udGFpbnMgUFRTIGluZm8sIHJlY29tcHV0ZSBQVFMgaW5mb3JtYXRpb24gZm9yIGFsbCBmcmFnbWVudHNcbiAgICBpZihQVFNGcmFnKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKG5ld0RldGFpbHMsUFRTRnJhZy5zbixQVFNGcmFnLnN0YXJ0UFRTLFBUU0ZyYWcuZW5kUFRTKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYWRqdXN0IHN0YXJ0IGJ5IHNsaWRpbmcgb2Zmc2V0XG4gICAgICB2YXIgc2xpZGluZyA9IG9sZGZyYWdtZW50c1tkZWx0YV0uc3RhcnQ7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uc3RhcnQgKz0gc2xpZGluZztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2UgYXJlIGhlcmUsIGl0IG1lYW5zIHdlIGhhdmUgZnJhZ21lbnRzIG92ZXJsYXBwaW5nIGJldHdlZW5cbiAgICAvLyBvbGQgYW5kIG5ldyBsZXZlbC4gcmVsaWFibGUgUFRTIGluZm8gaXMgdGh1cyByZWx5aW5nIG9uIG9sZCBsZXZlbFxuICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBvbGREZXRhaWxzLlBUU0tub3duO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVGcmFnUFRTKGRldGFpbHMsc24sc3RhcnRQVFMsZW5kUFRTKSB7XG4gICAgdmFyIGZyYWdJZHgsIGZyYWdtZW50cywgZnJhZywgaTtcbiAgICAvLyBleGl0IGlmIHNuIG91dCBvZiByYW5nZVxuICAgIGlmIChzbiA8IGRldGFpbHMuc3RhcnRTTiB8fCBzbiA+IGRldGFpbHMuZW5kU04pIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBmcmFnSWR4ID0gc24gLSBkZXRhaWxzLnN0YXJ0U047XG4gICAgZnJhZ21lbnRzID0gZGV0YWlscy5mcmFnbWVudHM7XG4gICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcblxuXHR2YXIgcHJldkZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCAtIDFdO1xuXHR2YXIgbmV4dEZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeCArIDFdO1xuXG4gICAgaWYoIWlzTmFOKGZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICBzdGFydFBUUyA9IE1hdGgubWluKHN0YXJ0UFRTLGZyYWcuc3RhcnRQVFMpO1xuICAgICAgZW5kUFRTID0gTWF0aC5tYXgoZW5kUFRTLCBmcmFnLmVuZFBUUyk7XG4gICAgfVxuXG5cdGlmKCBwcmV2RnJhZyAmJiBNYXRoLmFicyhwcmV2RnJhZy5zdGFydCAtIHN0YXJ0UFRTKSA+IDEwMCkge1xuXHRcdHN0YXJ0UFRTID0gcHJldkZyYWcuc3RhcnQgKyBwcmV2RnJhZy5kdXJhdGlvbjtcblx0XHQvLyBpZiAoZnJhZy5kdXJhdGlvbiA+IDEwMCkgZGVidWdnZXI7XG5cdFx0ZW5kUFRTID0gc3RhcnRQVFMgKyBmcmFnLmR1cmF0aW9uO1xuXHRcdGNvbnNvbGUuaW5mbyhmcmFnLnNuICsgJzogICcgKyBzdGFydFBUUyArICcgLT4gJyArIGVuZFBUUyArICcgfCAnICsgZnJhZy5kdXJhdGlvbik7XG5cdFx0Ly8gZGVidWdnZXI7XG5cdH0gZWxzZSBpZiggbmV4dEZyYWcgJiYgTWF0aC5hYnMobmV4dEZyYWcuc3RhcnQgLSBzdGFydFBUUykgPiAxMDApIHtcblx0XHQvLyBzdGFydFBUUyA9IG5leHRGcmFnLnN0YXJ0ICsgbmV4dEZyYWcuZHVyYXRpb247XG5cdFx0Ly8gZW5kUFRTID0gc3RhcnRQVFMgKyBmcmFnLmR1cmF0aW9uO1xuXHRcdC8vIGNvbnNvbGUubG9nKGZyYWcuc24gKyAnOiAgJyArIHN0YXJ0UFRTICsgJyAtPiAnICsgZW5kUFRTICsgJyB8ICcgKyBmcmFnLmR1cmF0aW9uKTtcblx0XHQvLyBkZWJ1Z2dlcjtcblx0fVxuXG4gICBpZiggTWF0aC5hYnMoc3RhcnRQVFMgLSBlbmRQVFMpID4gMTAwKSB7XG5cdCAgIC8vIHZhciBvbGRFbmRQVFMgPSBlbmRQVFM7XG5cdCAgIGVuZFBUUyA9IHN0YXJ0UFRTICsgZnJhZy5kdXJhdGlvbjtcblx0ICAgLy8gY29uc29sZS5pbmZvKCdhZGp1c3RpbmcgZW5kUFRTOiAnICsgb2xkRW5kUFRTICsgJyAtPiAnICsgZW5kUFRTKTtcbiAgIH1cblxuICAgIHZhciBkcmlmdCA9IHN0YXJ0UFRTIC0gZnJhZy5zdGFydDtcblxuICAgIGZyYWcuc3RhcnQgPSBmcmFnLnN0YXJ0UFRTID0gc3RhcnRQVFM7XG4gICAgZnJhZy5lbmRQVFMgPSBlbmRQVFM7XG4gICAgZnJhZy5kdXJhdGlvbiA9IGVuZFBUUyAtIHN0YXJ0UFRTO1xuXG5cdC8vIGlmIChmcmFnLmR1cmF0aW9uID4gMTAwKSBkZWJ1Z2dlcjtcblx0XG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bS0xIHRvIGZyYWcgMFxuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPiAwIDsgaS0tKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaS0xKTtcbiAgICB9XG5cbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtIHRvIGxhc3QgZnJhZ1xuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPCBmcmFnbWVudHMubGVuZ3RoIC0gMSA7IGkrKykge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGkrMSk7XG4gICAgfVxuICAgIGRldGFpbHMuUFRTS25vd24gPSB0cnVlO1xuICAgIC8vbG9nZ2VyLmxvZyhgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFnIHN0YXJ0L2VuZDoke3N0YXJ0UFRTLnRvRml4ZWQoMyl9LyR7ZW5kUFRTLnRvRml4ZWQoMyl9YCk7XG5cbiAgICByZXR1cm4gZHJpZnQ7XG4gIH1cblxuICBzdGF0aWMgdXBkYXRlUFRTKGZyYWdtZW50cyxmcm9tSWR4LCB0b0lkeCkge1xuICAgIHZhciBmcmFnRnJvbSA9IGZyYWdtZW50c1tmcm9tSWR4XSxmcmFnVG8gPSBmcmFnbWVudHNbdG9JZHhdLCBmcmFnVG9QVFMgPSBmcmFnVG8uc3RhcnRQVFM7XG4gICAgLy8gaWYgd2Uga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICBpZighaXNOYU4oZnJhZ1RvUFRTKSkge1xuICAgICAgLy8gdXBkYXRlIGZyYWdtZW50IGR1cmF0aW9uLlxuICAgICAgLy8gaXQgaGVscHMgdG8gZml4IGRyaWZ0cyBiZXR3ZWVuIHBsYXlsaXN0IHJlcG9ydGVkIGR1cmF0aW9uIGFuZCBmcmFnbWVudCByZWFsIGR1cmF0aW9uXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdGcm9tLmR1cmF0aW9uID0gZnJhZ1RvUFRTLWZyYWdGcm9tLnN0YXJ0O1xuICAgICAgICBpZihmcmFnRnJvbS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciBmcmFnICR7ZnJhZ0Zyb20uc259LGxldmVsICR7ZnJhZ0Zyb20ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ1RvLmR1cmF0aW9uID0gZnJhZ0Zyb20uc3RhcnQgLSBmcmFnVG9QVFM7XG4gICAgICAgIGlmKGZyYWdUby5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciBmcmFnICR7ZnJhZ1RvLnNufSxsZXZlbCAke2ZyYWdUby5sZXZlbH0sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdlIGRvbnQga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgKyBmcmFnRnJvbS5kdXJhdGlvbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvLmR1cmF0aW9uO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbEhlbHBlcjtcbiIsIi8qKlxuICogSExTIGludGVyZmFjZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBBYnJDb250cm9sbGVyIGZyb20gICAgJy4vY29udHJvbGxlci9hYnItY29udHJvbGxlcic7XG5pbXBvcnQgQnVmZmVyQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL2J1ZmZlci1jb250cm9sbGVyJztcbmltcG9ydCBDYXBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9jYXAtbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQgU3RyZWFtQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCBUaW1lbGluZUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL3RpbWVsaW5lLWNvbnRyb2xsZXInO1xuLy9pbXBvcnQgRlBTQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvZnBzLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsIGVuYWJsZUxvZ3N9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgZnJvbSAnLi91dGlscy94aHItbG9hZGVyJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCBLZXlMb2FkZXIgZnJvbSAnLi9sb2FkZXIva2V5LWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIHdpbmRvdy5NZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgc3RhdGljIGdldCBEZWZhdWx0Q29uZmlnKCkge1xuICAgIGlmKCFIbHMuZGVmYXVsdENvbmZpZykge1xuICAgICAgIEhscy5kZWZhdWx0Q29uZmlnID0ge1xuICAgICAgICAgIGF1dG9TdGFydExvYWQ6IHRydWUsXG4gICAgICAgICAgZGVidWc6IHRydWUsXG4gICAgICAgICAgY2FwTGV2ZWxUb1BsYXllclNpemU6IGZhbHNlLFxuICAgICAgICAgIG1heEJ1ZmZlckxlbmd0aDogMzAsXG4gICAgICAgICAgbWF4QnVmZmVyU2l6ZTogNjAgKiAxMDAwICogMTAwMCxcbiAgICAgICAgICBtYXhCdWZmZXJIb2xlOiA1LFxuICAgICAgICAgIG1heFNlZWtIb2xlOiAyLFxuICAgICAgICAgIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgOiAwLjIsXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbkNvdW50OjMsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50OiBJbmZpbml0eSxcbiAgICAgICAgICBsaXZlU3luY0R1cmF0aW9uOiB1bmRlZmluZWQsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgIG1heE1heEJ1ZmZlckxlbmd0aDogNjAwLFxuICAgICAgICAgIGVuYWJsZVdvcmtlcjogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVTb2Z0d2FyZUFFUzogdHJ1ZSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeTogMSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ1RpbWVPdXQ6IDEwMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ01heFJldHJ5OiA0LFxuICAgICAgICAgIGxldmVsTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0OiAyMDAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ01heFJldHJ5OiAyMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkOiAzLFxuICAgICAgICAgIHN0YXJ0RnJhZ1ByZWZldGNoIDogZmFsc2UsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2Q6IDUwMDAsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQ6IDAuMixcbiAgICAgICAgICBhcHBlbmRFcnJvck1heFJldHJ5OiAzLFxuICAgICAgICAgIGxvYWRlcjogWGhyTG9hZGVyLFxuICAgICAgICAgIGZMb2FkZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgYWJyQ29udHJvbGxlciA6IEFickNvbnRyb2xsZXIsXG4gICAgICAgICAgYnVmZmVyQ29udHJvbGxlciA6IEJ1ZmZlckNvbnRyb2xsZXIsXG4gICAgICAgICAgY2FwTGV2ZWxDb250cm9sbGVyIDogQ2FwTGV2ZWxDb250cm9sbGVyLFxuICAgICAgICAgIHN0cmVhbUNvbnRyb2xsZXI6IFN0cmVhbUNvbnRyb2xsZXIsXG4gICAgICAgICAgdGltZWxpbmVDb250cm9sbGVyOiBUaW1lbGluZUNvbnRyb2xsZXIsXG4gICAgICAgICAgZW5hYmxlQ0VBNzA4Q2FwdGlvbnM6IHRydWUsXG4gICAgICAgICAgZW5hYmxlTVAyVFBhc3NUaHJvdWdoIDogZmFsc2UsXG4gICAgICAgICAgcXVpY2tMb2FkU2Vla1RocmVzaG9sZDogMS8zXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBIbHMuZGVmYXVsdENvbmZpZztcbiAgfVxuXG4gIHN0YXRpYyBzZXQgRGVmYXVsdENvbmZpZyhkZWZhdWx0Q29uZmlnKSB7XG4gICAgSGxzLmRlZmF1bHRDb25maWcgPSBkZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICB2YXIgZGVmYXVsdENvbmZpZyA9IEhscy5EZWZhdWx0Q29uZmlnO1xuXG4gICAgaWYgKChjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50IHx8IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQpICYmIChjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBkb25cXCd0IG1peCB1cCBsaXZlU3luY0R1cmF0aW9uQ291bnQvbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IGFuZCBsaXZlU3luY0R1cmF0aW9uL2xpdmVNYXhMYXRlbmN5RHVyYXRpb24nKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGRlZmF1bHRDb25maWcpIHtcbiAgICAgICAgaWYgKHByb3AgaW4gY29uZmlnKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgIGNvbmZpZ1twcm9wXSA9IGRlZmF1bHRDb25maWdbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgIT09IHVuZGVmaW5lZCAmJiBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IDw9IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBcImxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudFwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uQ291bnRcIicpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvblwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uXCInKTtcbiAgICB9XG5cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG5cbiAgICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy50cmlnZ2VyID0gb2JzZXJ2ZXIudHJpZ2dlci5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYWJyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmJ1ZmZlckNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmNhcExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnN0cmVhbUNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnRpbWVsaW5lQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmtleUxvYWRlciA9IG5ldyBLZXlMb2FkZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVzdHJveScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5ERVNUUk9ZSU5HKTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMua2V5TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIHRoaXMub2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hNZWRpYShtZWRpYSkge1xuICAgIGxvZ2dlci5sb2coJ2F0dGFjaE1lZGlhJyk7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHttZWRpYTogbWVkaWF9KTtcbiAgfVxuXG4gIGRldGFjaE1lZGlhKCkge1xuICAgIGxvZ2dlci5sb2coJ2RldGFjaE1lZGlhJyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSElORyk7XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gIH1cblxuICBsb2FkU291cmNlKHVybCwgY3JlZHMpIHtcbiAgICBsb2dnZXIubG9nKGBsb2FkU291cmNlOiR7dXJsfWApO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywge3VybDogdXJsLCBjcmVkczogY3JlZHN9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZChzdGFydFBvc2l0aW9uPTApIHtcbiAgICBsb2dnZXIubG9nKCdzdGFydExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExvYWQoKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb24pO1xuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RvcExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3dhcEF1ZGlvQ29kZWMnKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3dhcEF1ZGlvQ29kZWMoKTtcbiAgfVxuXG4gIHJlY292ZXJNZWRpYUVycm9yKCkge1xuICAgIGxvZ2dlci5sb2coJ3JlY292ZXJNZWRpYUVycm9yJyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5hdHRhY2hNZWRpYShtZWRpYSk7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgY3VycmVudExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sb2FkTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gbmV4dCBwbGF5YmFjayBxdWFsaXR5IGxldmVsIChxdWFsaXR5IGxldmVsIG9mIG5leHQgZnJhZ21lbnQpICoqL1xuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbmV4dExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IG5leHRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBsb2FkTGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIHNldCBuZXh0TG9hZExldmVsKGxldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGZpcnN0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBzdGFydExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiLy8gVGhpcyBpcyBtb3N0bHkgZm9yIHN1cHBvcnQgb2YgdGhlIGVzNiBtb2R1bGUgZXhwb3J0XG4vLyBzeW50YXggd2l0aCB0aGUgYmFiZWwgY29tcGlsZXIsIGl0IGxvb2tzIGxpa2UgaXQgZG9lc250IHN1cHBvcnRcbi8vIGZ1bmN0aW9uIGV4cG9ydHMgbGlrZSB3ZSBhcmUgdXNlZCB0byBpbiBub2RlL2NvbW1vbmpzXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vaGxzLmpzJykuZGVmYXVsdDtcblxuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEZyYWdtZW50TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgZGF0YS5jcmVkcywgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIDEsIDAsIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIERlY3J5cHQga2V5IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEtleUxvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5LRVlfTE9BRElORyk7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gbnVsbDtcbiAgICB0aGlzLmRlY3J5cHR1cmwgPSBudWxsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbktleUxvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnID0gZGF0YS5mcmFnLFxuICAgICAgICBkZWNyeXB0ZGF0YSA9IGZyYWcuZGVjcnlwdGRhdGEsXG4gICAgICAgIHVyaSA9IGRlY3J5cHRkYXRhLnVyaTtcbiAgICAgICAgLy8gaWYgdXJpIGlzIGRpZmZlcmVudCBmcm9tIHByZXZpb3VzIG9uZSBvciBpZiBkZWNyeXB0IGtleSBub3QgcmV0cmlldmVkIHlldFxuICAgICAgaWYgKHVyaSAhPT0gdGhpcy5kZWNyeXB0dXJsIHx8IHRoaXMuZGVjcnlwdGtleSA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgICAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICAgICAgdGhpcy5kZWNyeXB0dXJsID0gdXJpO1xuICAgICAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgICAgICBmcmFnLmxvYWRlci5sb2FkKHVyaSwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5kZWNyeXB0a2V5KSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbG9hZGVkIHRoaXMga2V5LCByZXR1cm4gaXRcbiAgICAgICAgZGVjcnlwdGRhdGEua2V5ID0gdGhpcy5kZWNyeXB0a2V5O1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICB9XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IGZyYWcuZGVjcnlwdGRhdGEua2V5ID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZSk7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICBmcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcblxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEtleUxvYWRlcjtcbiIsIi8qKlxuICogUGxheWxpc3QgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBVUkxIZWxwZXIgZnJvbSAnLi4vdXRpbHMvdXJsJztcbmltcG9ydCBBdHRyTGlzdCBmcm9tICcuLi91dGlscy9hdHRyLWxpc3QnO1xuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgUGxheWxpc3RMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5MRVZFTF9MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG5cdHRoaXMudG90YWxEdXJhdGlvbiA9IDA7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhkYXRhKSB7XG5cdHRoaXMuY3JlZHMgPSBkYXRhLmNyZWRzO1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgbnVsbCk7XG4gIH1cblxuICBvbkxldmVsTG9hZGluZyhkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBkYXRhLmxldmVsLCBkYXRhLmlkKTtcblx0dGhpcy50b3RhbER1cmF0aW9uID0gZGF0YS50b3RhbER1cmF0aW9uIHx8IDA7XG4gIH1cblxuICBsb2FkKHVybCwgaWQxLCBpZDIpIHtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnLFxuICAgICAgICByZXRyeSxcbiAgICAgICAgdGltZW91dCxcbiAgICAgICAgcmV0cnlEZWxheTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gaWQxO1xuICAgIHRoaXMuaWQyID0gaWQyO1xuICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXRyeSA9IGNvbmZpZy5sZXZlbExvYWRpbmdNYXhSZXRyeTtcbiAgICAgIHRpbWVvdXQgPSBjb25maWcubGV2ZWxMb2FkaW5nVGltZU91dDtcbiAgICAgIHJldHJ5RGVsYXkgPSBjb25maWcubGV2ZWxMb2FkaW5nUmV0cnlEZWxheTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLnBMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcucExvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgdGhpcy5jcmVkcywgJycsIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0LCByZXRyeSwgcmV0cnlEZWxheSk7XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHJldHVybiBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVVSTChiYXNlVXJsLCB1cmwpO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwpIHtcbiAgICBsZXQgbGV2ZWxzID0gW10sIHJlc3VsdDtcblxuICAgIC8vIGh0dHBzOi8vcmVnZXgxMDEuY29tIGlzIHlvdXIgZnJpZW5kXG4gICAgY29uc3QgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSopW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgY29uc3QgbGV2ZWwgPSB7fTtcblxuICAgICAgdmFyIGF0dHJzID0gbGV2ZWwuYXR0cnMgPSBuZXcgQXR0ckxpc3QocmVzdWx0WzFdKTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuXG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGF0dHJzLmRlY2ltYWxSZXNvbHV0aW9uKCdSRVNPTFVUSU9OJyk7XG4gICAgICBpZihyZXNvbHV0aW9uKSB7XG4gICAgICAgIGxldmVsLndpZHRoID0gcmVzb2x1dGlvbi53aWR0aDtcbiAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcmVzb2x1dGlvbi5oZWlnaHQ7XG4gICAgICB9XG4gICAgICBsZXZlbC5iaXRyYXRlID0gYXR0cnMuZGVjaW1hbEludGVnZXIoJ0JBTkRXSURUSCcpO1xuICAgICAgbGV2ZWwubmFtZSA9IGF0dHJzLk5BTUU7XG5cbiAgICAgIHZhciBjb2RlY3MgPSBhdHRycy5DT0RFQ1M7XG4gICAgICBpZihjb2RlY3MpIHtcbiAgICAgICAgY29kZWNzID0gY29kZWNzLnNwbGl0KCcsJyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgY29kZWMgPSBjb2RlY3NbaV07XG4gICAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGxldmVsLnZpZGVvQ29kZWMgPSB0aGlzLmF2YzF0b2F2Y290aShjb2RlYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCwgYXZjZGF0YSA9IGNvZGVjLnNwbGl0KCcuJyk7XG4gICAgaWYgKGF2Y2RhdGEubGVuZ3RoID4gMikge1xuICAgICAgcmVzdWx0ID0gYXZjZGF0YS5zaGlmdCgpICsgJy4nO1xuICAgICAgcmVzdWx0ICs9IHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpO1xuICAgICAgcmVzdWx0ICs9ICgnMDAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGNsb25lT2JqKG9iaikge1xuICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9iaikpO1xuICB9XG5cbiAgcGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgYmFzZXVybCwgaWQpIHtcbiAgICB2YXIgY3VycmVudFNOID0gMCxcbiAgICAgICAgdG90YWxkdXJhdGlvbiA9IDAsXG4gICAgICAgIGxldmVsID0ge3VybDogYmFzZXVybCwgZnJhZ21lbnRzOiBbXSwgbGl2ZTogdHJ1ZSwgc3RhcnRTTjogMH0sXG4gICAgICAgIGxldmVsa2V5ID0ge21ldGhvZCA6IG51bGwsIGtleSA6IG51bGwsIGl2IDogbnVsbCwgdXJpIDogbnVsbH0sXG4gICAgICAgIGNjID0gMCxcbiAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbnVsbCxcbiAgICAgICAgZnJhZyA9IG51bGwsXG4gICAgICAgIHJlc3VsdCxcbiAgICAgICAgcmVnZXhwLFxuICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQsXG4gICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LFxuXHRcdG5leHRUaW1lc3RhbXA7XG5cblx0dmFyIHJlID0gIC8oXFxkKylfXFxkKy50cy87XG5cbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQtWC0oS0VZKTooLiopKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qKFtcXHJcXG5dK1teI3xcXHJcXG5dKyk/KXwoPzojRVhULVgtKEJZVEVSQU5HRSk6KFtcXGRdK1tAW1xcZF0qKV0qW1xcclxcbl0rKFteI3xcXHJcXG5dKyk/fCg/OiNFWFQtWC0oRU5ETElTVCkpfCg/OiNFWFQtWC0oRElTKUNPTlRJTlVJVFkpKXwoPzojRVhULVgtKFBST0dSQU0tREFURS1USU1FKTooLiopKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmVnZXhwLmV4ZWMoc3RyaW5nKSkgIT09IG51bGwpIHtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKSB7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTsgfSk7XG4gICAgICBzd2l0Y2ggKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdESVMnOlxuICAgICAgICAgIGNjKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0JZVEVSQU5HRSc6XG4gICAgICAgICAgdmFyIHBhcmFtcyA9IHJlc3VsdFsxXS5zcGxpdCgnQCcpO1xuICAgICAgICAgIGlmIChwYXJhbXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMF0pICsgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgaWYgKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdJTkYnOlxuICAgICAgICAgIHZhciBkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBpZiAoIWlzTmFOKGR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGZyYWdkZWNyeXB0ZGF0YSxcbiAgICAgICAgICAgICAgICBzbiA9IGN1cnJlbnRTTisrO1xuICAgICAgICAgICAgaWYgKGxldmVsa2V5Lm1ldGhvZCAmJiBsZXZlbGtleS51cmkgJiYgIWxldmVsa2V5Lml2KSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IHRoaXMuY2xvbmVPYmoobGV2ZWxrZXkpO1xuICAgICAgICAgICAgICB2YXIgdWludDhWaWV3ID0gbmV3IFVpbnQ4QXJyYXkoMTYpO1xuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTI7IGkgPCAxNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdWludDhWaWV3W2ldID0gKHNuID4+IDgqKDE1LWkpKSAmIDB4ZmY7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhLml2ID0gdWludDhWaWV3O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gbGV2ZWxrZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgdXJsID0gcmVzdWx0WzJdID8gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCkgOiBudWxsO1xuXG5cdFx0XHR2YXIgbWF0Y2ggPSByZS5leGVjKCB1cmwgKTtcblx0XHRcdHZhciB0aW1lc3RhbXAgPSAobWF0Y2ggJiYgbWF0Y2hbMV0pID8gbWF0Y2hbMV0gOiBudWxsO1xuXG5cdFx0XHQvLyBpZiAodGltZXN0YW1wICYmIG5leHRUaW1lc3RhbXApIHtcblx0XHRcdC8vIFx0dGltZXN0YW1wID0gcGFyc2VJbnQoIHRpbWVzdGFtcCApO1xuXHRcdFx0Ly8gXHRpZiAoIHRpbWVzdGFtcCAtIG5leHRUaW1lc3RhbXAgPiAyMDAwICkge1xuXHRcdFx0Ly8gXHRcdGNvbnNvbGUubG9nKCB0aW1lc3RhbXAgKyAnICcgKyBuZXh0VGltZXN0YW1wICsgJyAnICsgdXJsICk7XG5cdFx0XHQvLyBcdFx0Y2MrKztcblx0XHRcdC8vIFx0fVxuXHRcdFx0Ly8gfVxuXG5cdFx0XHRuZXh0VGltZXN0YW1wID0gdGltZXN0YW1wICsgZHVyYXRpb24qMTAwMDtcblxuICAgICAgICAgICAgZnJhZyA9IHt1cmw6IHVybCwgZHVyYXRpb246IGR1cmF0aW9uLCBzdGFydDogdG90YWxkdXJhdGlvbiwgc246IHNuLCBsZXZlbDogaWQsIGNjOiBjYywgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ6IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LCBieXRlUmFuZ2VFbmRPZmZzZXQ6IGJ5dGVSYW5nZUVuZE9mZnNldCwgZGVjcnlwdGRhdGEgOiBmcmFnZGVjcnlwdGRhdGEsIHByb2dyYW1EYXRlVGltZTogcHJvZ3JhbURhdGVUaW1lfTtcbiAgICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKGZyYWcpO1xuICAgICAgICAgICAgdG90YWxkdXJhdGlvbiArPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdLRVknOlxuICAgICAgICAgIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9kcmFmdC1wYW50b3MtaHR0cC1saXZlLXN0cmVhbWluZy0wOCNzZWN0aW9uLTMuNC40XG4gICAgICAgICAgdmFyIGRlY3J5cHRwYXJhbXMgPSByZXN1bHRbMV07XG4gICAgICAgICAgdmFyIGtleUF0dHJzID0gbmV3IEF0dHJMaXN0KGRlY3J5cHRwYXJhbXMpO1xuICAgICAgICAgIHZhciBkZWNyeXB0bWV0aG9kID0ga2V5QXR0cnMuZW51bWVyYXRlZFN0cmluZygnTUVUSE9EJyksXG4gICAgICAgICAgICAgIGRlY3J5cHR1cmkgPSBrZXlBdHRycy5VUkksXG4gICAgICAgICAgICAgIGRlY3J5cHRpdiA9IGtleUF0dHJzLmhleGFkZWNpbWFsSW50ZWdlcignSVYnKTtcbiAgICAgICAgICBpZiAoZGVjcnlwdG1ldGhvZCkge1xuICAgICAgICAgICAgbGV2ZWxrZXkgPSB7IG1ldGhvZDogbnVsbCwga2V5OiBudWxsLCBpdjogbnVsbCwgdXJpOiBudWxsIH07XG4gICAgICAgICAgICBpZiAoKGRlY3J5cHR1cmkpICYmIChkZWNyeXB0bWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICAgICAgICAgIGxldmVsa2V5Lm1ldGhvZCA9IGRlY3J5cHRtZXRob2Q7XG4gICAgICAgICAgICAgIC8vIFVSSSB0byBnZXQgdGhlIGtleVxuICAgICAgICAgICAgICBsZXZlbGtleS51cmkgPSB0aGlzLnJlc29sdmUoZGVjcnlwdHVyaSwgYmFzZXVybCk7XG4gICAgICAgICAgICAgIGxldmVsa2V5LmtleSA9IG51bGw7XG4gICAgICAgICAgICAgIC8vIEluaXRpYWxpemF0aW9uIFZlY3RvciAoSVYpXG4gICAgICAgICAgICAgIGxldmVsa2V5Lml2ID0gZGVjcnlwdGl2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnUFJPR1JBTS1EQVRFLVRJTUUnOlxuICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG5ldyBEYXRlKERhdGUucGFyc2UocmVzdWx0WzFdKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGlmKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICBsZXZlbC5mcmFnbWVudHMucG9wKCk7XG4gICAgICB0b3RhbGR1cmF0aW9uLT1mcmFnLmR1cmF0aW9uO1xuICAgIH1cbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG5cblx0aWYgKGxldmVsLmxpdmUpIHtcblx0XHR2YXIgZW5kUFRTO1xuXHRcdGZvciAodmFyIGkgaW4gbGV2ZWwuZnJhZ21lbnRzKSB7XG5cdFx0XHR2YXIgZiA9IGxldmVsLmZyYWdtZW50c1tpXTtcblx0XHRcdGYuc3RhcnQgPSBwYXJzZUludCggdGhpcy50b3RhbER1cmF0aW9uICk7XG5cdFx0XHRlbmRQVFMgPSBmLmVuZFBUUztcblx0XHR9XG5cdFx0bGV2ZWwudG90YWxkdXJhdGlvbiA9IGVuZFBUUyA/IGVuZFBUUyA6IGxldmVsLnRvdGFsZHVyYXRpb24gKyB0aGlzLnRvdGFsRHVyYXRpb247XG5cdH1cbiAgICByZXR1cm4gbGV2ZWw7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgdGFyZ2V0ID0gZXZlbnQuY3VycmVudFRhcmdldCxcbiAgICAgICAgc3RyaW5nID0gdGFyZ2V0LnJlc3BvbnNlVGV4dCxcbiAgICAgICAgdXJsID0gdGFyZ2V0LnJlc3BvbnNlVVJMLFxuICAgICAgICBpZCA9IHRoaXMuaWQsXG4gICAgICAgIGlkMiA9IHRoaXMuaWQyLFxuICAgICAgICBobHMgPSB0aGlzLmhscyxcbiAgICAgICAgbGV2ZWxzO1xuICAgIC8vIHJlc3BvbnNlVVJMIG5vdCBzdXBwb3J0ZWQgb24gc29tZSBicm93c2VycyAoaXQgaXMgdXNlZCB0byBkZXRlY3QgVVJMIHJlZGlyZWN0aW9uKVxuICAgIGlmICh1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICBzdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIHN0YXRzLm10aW1lID0gbmV3IERhdGUodGFyZ2V0LmdldFJlc3BvbnNlSGVhZGVyKCdMYXN0LU1vZGlmaWVkJykpO1xuICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVE0zVScpID09PSAwKSB7XG4gICAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRJTkY6JykgPiAwKSB7XG4gICAgICAgIC8vIDEgbGV2ZWwgcGxheWxpc3RcbiAgICAgICAgLy8gaWYgZmlyc3QgcmVxdWVzdCwgZmlyZSBtYW5pZmVzdCBsb2FkZWQgZXZlbnQsIGxldmVsIHdpbGwgYmUgcmVsb2FkZWQgYWZ0ZXJ3YXJkc1xuICAgICAgICAvLyAodGhpcyBpcyB0byBoYXZlIGEgdW5pZm9ybSBsb2dpYyBmb3IgMSBsZXZlbC9tdWx0aWxldmVsIHBsYXlsaXN0cylcbiAgICAgICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IFt7dXJsOiB1cmx9XSwgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBsZXZlbERldGFpbHMgPSB0aGlzLnBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIHVybCwgaWQpO1xuICAgICAgICAgIHN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsIHtkZXRhaWxzOiBsZXZlbERldGFpbHMsIGxldmVsOiBpZCwgaWQ6IGlkMiwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVscyA9IHRoaXMucGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIHVybCk7XG4gICAgICAgIC8vIG11bHRpIGxldmVsIHBsYXlsaXN0LCBwYXJzZSBsZXZlbCBpbmZvXG4gICAgICAgIGlmIChsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBsZXZlbHMsIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBsZXZlbCBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gRVhUTTNVIGRlbGltaXRlcid9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIHJlc3BvbnNlOiBldmVudC5jdXJyZW50VGFyZ2V0LCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCIvKipcbiAqIEdlbmVyYXRlIE1QNCBCb3hcbiovXG5cbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdmlkZW9IZGxyID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcblxuICAgIHZhciBhdWRpb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTMsIDB4NmYsIDB4NzUsIDB4NmUsXG4gICAgICAweDY0LCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOiB2aWRlb0hkbHIsXG4gICAgICAnYXVkaW8nOiBhdWRpb0hkbHJcbiAgICB9O1xuXG4gICAgdmFyIGRyZWYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG5cbiAgICB2YXIgc3RjbyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG5cbiAgICBNUDQuU1RUUyA9IE1QNC5TVFNDID0gTVA0LlNUQ08gPSBzdGNvO1xuXG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5WTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGdyYXBoaWNzbW9kZVxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwIC8vIG9wY29sb3JcbiAgICBdKTtcbiAgICBNUDQuU01IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBiYWxhbmNlXG4gICAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gICAgXSk7XG5cbiAgICBNUDQuU1RTRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTsvLyBlbnRyeV9jb3VudFxuXG4gICAgdmFyIG1ham9yQnJhbmQgPSBuZXcgVWludDhBcnJheShbMTA1LDExNSwxMTEsMTA5XSk7IC8vIGlzb21cbiAgICB2YXIgYXZjMUJyYW5kID0gbmV3IFVpbnQ4QXJyYXkoWzk3LDExOCw5OSw0OV0pOyAvLyBhdmMxXG4gICAgdmFyIG1pbm9yVmVyc2lvbiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIG1ham9yQnJhbmQsIG1pbm9yVmVyc2lvbiwgbWFqb3JCcmFuZCwgYXZjMUJyYW5kKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIGRyZWYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gOCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgbGVuID0gaSxcbiAgICByZXN1bHQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgcmVzdWx0WzBdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgICByZXN1bHRbMV0gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIHJlc3VsdFsyXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgICByZXN1bHRbM10gPSBzaXplICAmIDB4ZmY7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcbiAgICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICAgIGZvciAoaSA9IDAsIHNpemUgPSA4OyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIC8vIGNvcHkgcGF5bG9hZFtpXSBhcnJheSBAIG9mZnNldCBzaXplXG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsIGR1cmF0aW9uKSB7XG4gICAgZHVyYXRpb24gKj0gdGltZXNjYWxlO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4NTUsIDB4YzQsIC8vICd1bmQnIGxhbmd1YWdlICh1bmRldGVybWluZWQpXG4gICAgICAweDAwLCAweDAwXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1kaWEodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRpYSwgTVA0Lm1kaGQodHJhY2sudGltZXNjYWxlLCB0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLCBNUDQubWZoZChzbiksIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0udGltZXNjYWxlLCB0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKHRpbWVzY2FsZSxkdXJhdGlvbikge1xuICAgIGR1cmF0aW9uKj10aW1lc2NhbGU7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsIE1QNC5zdHNkKHRyYWNrKSwgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLCBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSwgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaSwgZGF0YSwgbGVuO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2suc3BzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgc3BzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2sucHBzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgcHBzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTtcbiAgICB9XG5cbiAgICB2YXIgYXZjYyA9IE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsICAgLy8gdmVyc2lvblxuICAgICAgICAgICAgc3BzWzNdLCAvLyBwcm9maWxlXG4gICAgICAgICAgICBzcHNbNF0sIC8vIHByb2ZpbGUgY29tcGF0XG4gICAgICAgICAgICBzcHNbNV0sIC8vIGxldmVsXG4gICAgICAgICAgICAweGZjIHwgMywgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICAgIDB4RTAgfCB0cmFjay5zcHMubGVuZ3RoIC8vIDNiaXQgcmVzZXJ2ZWQgKDExMSkgKyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0uY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIC8vY29uc29sZS5sb2coJ2F2Y2M6JyArIEhleC5oZXhEdW1wKGF2Y2MpKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB3aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICBoZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTIsXG4gICAgICAgIDB4NjQsIDB4NjEsIDB4NjksIDB4NkMsIC8vZGFpbHltb3Rpb24vaGxzLmpzXG4gICAgICAgIDB4NzksIDB4NkQsIDB4NkYsIDB4NzQsXG4gICAgICAgIDB4NjksIDB4NkYsIDB4NkUsIDB4MkYsXG4gICAgICAgIDB4NjgsIDB4NkMsIDB4NzMsIDB4MkUsXG4gICAgICAgIDB4NkEsIDB4NzMsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsICAgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBhdmNjLFxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmJ0cnQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDAsIDB4MWMsIDB4OWMsIDB4ODAsIC8vIGJ1ZmZlclNpemVEQlxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMF0pKSAvLyBhdmdCaXRyYXRlXG4gICAgICAgICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBlc2RzKHRyYWNrKSB7XG4gICAgdmFyIGNvbmZpZ2xlbiA9IHRyYWNrLmNvbmZpZy5sZW5ndGg7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcblxuICAgICAgMHgwMywgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDE3K2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAgIDB4MTUsIC8vIHN0cmVhbV90eXBlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBidWZmZXJfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYXZnQml0cmF0ZVxuXG4gICAgICAweDA1IC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgXS5jb25jYXQoW2NvbmZpZ2xlbl0pLmNvbmNhdCh0cmFjay5jb25maWcpLmNvbmNhdChbMHgwNiwgMHgwMSwgMHgwMl0pKTsgLy8gR0FTcGVjaWZpY0NvbmZpZykpOyAvLyBsZW5ndGggKyBhdWRpbyBjb25maWcgZGVzY3JpcHRvclxuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICB2YXIgYXVkaW9zYW1wbGVyYXRlID0gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgdHJhY2suY2hhbm5lbENvdW50LCAvLyBjaGFubmVsY291bnRcbiAgICAgIDB4MDAsIDB4MTAsIC8vIHNhbXBsZVNpemU6MTZiaXRzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgIChhdWRpb3NhbXBsZXJhdGUgPj4gOCkgJiAweEZGLFxuICAgICAgYXVkaW9zYW1wbGVyYXRlICYgMHhmZiwgLy9cbiAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmVzZHMsIE1QNC5lc2RzKHRyYWNrKSkpO1xuICB9XG5cbiAgc3RhdGljIHN0c2QodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNELCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5hdmMxKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHRraGQodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZCxcbiAgICAgICAgZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbip0cmFjay50aW1lc2NhbGUsXG4gICAgICAgIHdpZHRoID0gdHJhY2sud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHRyYWNrLmhlaWdodDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIChpZCA+PiAyNCkgJiAweEZGLFxuICAgICAgKGlkID4+IDE2KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gOCkgJiAweEZGLFxuICAgICAgaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgd2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgaGVpZ2h0ICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkge1xuICAgIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBNUDQuc2R0cCh0cmFjayksXG4gICAgICAgIGlkID0gdHJhY2suaWQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWYsXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoaWQgPj4gMjQpLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+MjQpLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LnRydW4odHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmR0XG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gdHJhZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gbW9vZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgOCksICAvLyBtZGF0IGhlYWRlclxuICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIHRyYWNrIGJveC5cbiAgICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IGEgdHJhY2sgZGVmaW5pdGlvblxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gICAqL1xuICBzdGF0aWMgdHJhayh0cmFjaykge1xuICAgIHRyYWNrLmR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24gfHwgMHhmZmZmZmZmZjtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhaywgTVA0LnRraGQodHJhY2spLCBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAoaWQgPj4gMjQpLFxuICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgKGlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXM9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICAgIGxlbiA9IHNhbXBsZXMubGVuZ3RoLFxuICAgICAgICBhcnJheWxlbiA9IDEyICsgKDE2ICogbGVuKSxcbiAgICAgICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheWxlbiksXG4gICAgICAgIGksc2FtcGxlLGR1cmF0aW9uLHNpemUsZmxhZ3MsY3RzO1xuICAgIG9mZnNldCArPSA4ICsgYXJyYXlsZW47XG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChsZW4gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiAxNikgJiAweEZGLFxuICAgICAgKGxlbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgbGVuICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdLDApO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGR1cmF0aW9uID0gc2FtcGxlLmR1cmF0aW9uO1xuICAgICAgc2l6ZSA9IHNhbXBsZS5zaXplO1xuICAgICAgZmxhZ3MgPSBzYW1wbGUuZmxhZ3M7XG4gICAgICBjdHMgPSBzYW1wbGUuY3RzO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKGR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKGZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgZmxhZ3MuaXNOb25TeW5jLFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHhGMCA8PCA4LFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChjdHMgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDgpICYgMHhGRixcbiAgICAgICAgY3RzICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG4gICAgaWYgKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhciBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksIHJlc3VsdDtcbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG4iLCIvKipcbiAqIGZNUDQgcmVtdXhlclxuKi9cblxuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IE1QNCBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBNUDRSZW11eGVyIHtcbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICAgIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SID0gNDtcbiAgICB0aGlzLlBFU19USU1FU0NBTEUgPSA5MDAwMDtcbiAgICB0aGlzLk1QNF9USU1FU0NBTEUgPSB0aGlzLlBFU19USU1FU0NBTEUgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgfVxuXG4gIGdldCBwYXNzdGhyb3VnaCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHRoaXMubmV4dEFhY1B0cyA9IHRoaXMubmV4dEF2Y0R0cyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHJlbXV4KGF1ZGlvVHJhY2ssdmlkZW9UcmFjayxpZDNUcmFjayx0ZXh0VHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cywgZGF0YSwgdDApIHtcbiAgICAvLyBnZW5lcmF0ZSBJbml0IFNlZ21lbnQgaWYgbmVlZGVkXG4gICAgaWYgKCF0aGlzLklTR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLmdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQsIHQwKTtcblx0fVxuXHRpZiAodGhpcy5JU0dlbmVyYXRlZCkge1xuXHRcdC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuXHRcdGlmICh2aWRlb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG5cdFx0ICB0aGlzLnJlbXV4VmlkZW8odmlkZW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMsIHQwKTtcblx0XHR9XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBBQUMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcblx0XHQgIHRoaXMucmVtdXhBdWRpbyhhdWRpb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cyk7XG5cdFx0fVxuXHRcdC8vbG9nZ2VyLmxvZygnbmIgSUQzIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuXHRcdGlmIChpZDNUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuXHRcdCAgdGhpcy5yZW11eElEMyhpZDNUcmFjayx0aW1lT2Zmc2V0KTtcblx0XHR9XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBJRDMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKHRleHRUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuXHRcdCAgdGhpcy5yZW11eFRleHQodGV4dFRyYWNrLHRpbWVPZmZzZXQpO1xuXHRcdH1cblx0fVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgfVxuXG4gIGdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQsIHQwKSB7XG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlcixcbiAgICAgICAgYXVkaW9TYW1wbGVzID0gYXVkaW9UcmFjay5zYW1wbGVzLFxuICAgICAgICB2aWRlb1NhbXBsZXMgPSB2aWRlb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgdHJhY2tzID0ge30sXG4gICAgICAgIGRhdGEgPSB7IHRyYWNrcyA6IHRyYWNrcywgdW5pcXVlIDogZmFsc2UgfSxcbiAgICAgICAgY29tcHV0ZVBUU0RUUyA9ICh0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpLFxuICAgICAgICBpbml0UFRTLCBpbml0RFRTO1xuXG4gICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgIGluaXRQVFMgPSBpbml0RFRTID0gSW5maW5pdHk7XG4gICAgfVxuICAgIGlmIChhdWRpb1RyYWNrLmNvbmZpZyAmJiBhdWRpb1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdWRpb1RyYWNrLnRpbWVzY2FsZSA9IGF1ZGlvVHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgLy8gTVA0IGR1cmF0aW9uICh0cmFjayBkdXJhdGlvbiBpbiBzZWNvbmRzIG11bHRpcGxpZWQgYnkgdGltZXNjYWxlKSBpcyBjb2RlZCBvbiAzMiBiaXRzXG4gICAgICAvLyB3ZSBrbm93IHRoYXQgZWFjaCBBQUMgc2FtcGxlIGNvbnRhaW5zIDEwMjQgZnJhbWVzLi4uLlxuICAgICAgLy8gaW4gb3JkZXIgdG8gYXZvaWQgb3ZlcmZsb3dpbmcgdGhlIDMyIGJpdCBjb3VudGVyIGZvciBsYXJnZSBkdXJhdGlvbiwgd2UgdXNlIHNtYWxsZXIgdGltZXNjYWxlICh0aW1lc2NhbGUvZ2NkKVxuICAgICAgLy8gd2UganVzdCBuZWVkIHRvIGVuc3VyZSB0aGF0IEFBQyBzYW1wbGUgZHVyYXRpb24gd2lsbCBzdGlsbCBiZSBhbiBpbnRlZ2VyICh3aWxsIGJlIDEwMjQvZ2NkKVxuICAgICAgaWYgKGF1ZGlvVHJhY2sudGltZXNjYWxlICogYXVkaW9UcmFjay5kdXJhdGlvbiA+IE1hdGgucG93KDIsIDMyKSkge1xuICAgICAgICBsZXQgZ3JlYXRlc3RDb21tb25EaXZpc29yID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgaWYgKCAhIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBncmVhdGVzdENvbW1vbkRpdmlzb3IoYiwgYSAlIGIpO1xuICAgICAgICB9O1xuICAgICAgICBhdWRpb1RyYWNrLnRpbWVzY2FsZSA9IGF1ZGlvVHJhY2suYXVkaW9zYW1wbGVyYXRlIC8gZ3JlYXRlc3RDb21tb25EaXZpc29yKGF1ZGlvVHJhY2suYXVkaW9zYW1wbGVyYXRlLDEwMjQpO1xuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZyAoJ2F1ZGlvIG1wNCB0aW1lc2NhbGUgOicrIGF1ZGlvVHJhY2sudGltZXNjYWxlKTtcbiAgICAgIHRyYWNrcy5hdWRpbyA9IHtcbiAgICAgICAgY29udGFpbmVyIDogJ2F1ZGlvL21wNCcsXG4gICAgICAgIGNvZGVjIDogIGF1ZGlvVHJhY2suY29kZWMsXG4gICAgICAgIGluaXRTZWdtZW50IDogTVA0LmluaXRTZWdtZW50KFthdWRpb1RyYWNrXSksXG4gICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgIGNoYW5uZWxDb3VudCA6IGF1ZGlvVHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0LiBmb3IgYXVkaW8sIFBUUyArIERUUyAuLi5cbiAgICAgICAgLy8gaW5pdFBUUyA9IGluaXREVFMgPSBhdWRpb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgaW5pdFBUUyA9IGluaXREVFMgPSB0MCAqIHBlc1RpbWVTY2FsZTtcblx0XHQvLyBpZiAodGltZU9mZnNldCAhPSB0MCkgZGVidWdnZXI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHZpZGVvVHJhY2suc3BzICYmIHZpZGVvVHJhY2sucHBzICYmIHZpZGVvU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHZpZGVvVHJhY2sudGltZXNjYWxlID0gdGhpcy5NUDRfVElNRVNDQUxFO1xuICAgICAgdHJhY2tzLnZpZGVvID0ge1xuICAgICAgICBjb250YWluZXIgOiAndmlkZW8vbXA0JyxcbiAgICAgICAgY29kZWMgOiAgdmlkZW9UcmFjay5jb2RlYyxcbiAgICAgICAgaW5pdFNlZ21lbnQgOiBNUDQuaW5pdFNlZ21lbnQoW3ZpZGVvVHJhY2tdKSxcbiAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgd2lkdGggOiB2aWRlb1RyYWNrLndpZHRoLFxuICAgICAgICAgIGhlaWdodCA6IHZpZGVvVHJhY2suaGVpZ2h0XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgICBpbml0UFRTID0gTWF0aC5taW4oaW5pdFBUUyx2aWRlb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldCk7XG4gICAgICAgIGluaXREVFMgPSBNYXRoLm1pbihpbml0RFRTLHZpZGVvU2FtcGxlc1swXS5kdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZighT2JqZWN0LmtleXModHJhY2tzKSkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ25vIGF1ZGlvL3ZpZGVvIHNhbXBsZXMgZm91bmQnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxkYXRhKTtcbiAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgICAgLy8gdGhpcy5faW5pdFBUUyA9IHQwKnBlc1RpbWVTY2FsZTsvL2luaXRQVFM7XG4gICAgICAgIC8vIHRoaXMuX2luaXREVFMgPSB0MCpwZXNUaW1lU2NhbGU7Ly9pbml0RFRTO1xuXG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSBpbml0UFRTO1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gaW5pdERUUztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZW11eFZpZGVvKHRyYWNrLCB0aW1lT2Zmc2V0LCBjb250aWd1b3VzLCB0MCkge1xuICAgIHZhciBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBtcDRTYW1wbGVEdXJhdGlvbixcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLFxuICAgICAgICBsYXN0UFRTLCBsYXN0RFRTLFxuICAgICAgICBpbnB1dFNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICBvdXRwdXRTYW1wbGVzID0gW107XG5cbiAgLy8gUFRTIGlzIGNvZGVkIG9uIDMzYml0cywgYW5kIGNhbiBsb29wIGZyb20gLTJeMzIgdG8gMl4zMlxuICAvLyBQVFNOb3JtYWxpemUgd2lsbCBtYWtlIFBUUy9EVFMgdmFsdWUgbW9ub3RvbmljLCB3ZSB1c2UgbGFzdCBrbm93biBEVFMgdmFsdWUgYXMgcmVmZXJlbmNlIHZhbHVlXG4gICBsZXQgbmV4dEF2Y0R0cztcbiAgICBpZiAoY29udGlndW91cykge1xuICAgICAgLy8gaWYgcGFyc2VkIGZyYWdtZW50IGlzIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZSwgbGV0J3MgdXNlIGxhc3QgRFRTIHZhbHVlIGFzIHJlZmVyZW5jZVxuICAgICAgbmV4dEF2Y0R0cyA9IHRoaXMubmV4dEF2Y0R0cztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaWYgbm90IGNvbnRpZ3VvdXMsIGxldCdzIHVzZSB0YXJnZXQgdGltZU9mZnNldFxuICAgICAgbmV4dEF2Y0R0cyA9IHQwKnBlc1RpbWVTY2FsZTtcbiAgICB9XG5cbiAgICAvLyBjb21wdXRlIGZpcnN0IERUUyBhbmQgbGFzdCBEVFMsIG5vcm1hbGl6ZSB0aGVtIGFnYWluc3QgcmVmZXJlbmNlIHZhbHVlXG4gICAgbGV0IHNhbXBsZSA9IGlucHV0U2FtcGxlc1swXTtcbiAgICAvLyBmaXJzdERUUyA9ICBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLmR0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG4gICAgLy8gZmlyc3RQVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuXG4gICAgZmlyc3REVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuICAgIGZpcnN0UFRTID0gIE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUucHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcblxuXHR2YXIgZmlyc3RTYW1wbGVEVFMgPSBzYW1wbGUuZHRzO1xuXHRmaXJzdFBUUyA9IGZpcnN0RFRTID0gTWF0aC5yb3VuZCh0MCAqIHBlc1RpbWVTY2FsZSk7XG5cdGxvZ2dlci5pbmZvKCAnZmlyc3RQVFMgIzE6ICcgKyBmaXJzdFBUUyApO1xuXG4gICAgLy8gY2hlY2sgdGltZXN0YW1wIGNvbnRpbnVpdHkgYWNjcm9zcyBjb25zZWN1dGl2ZSBmcmFnbWVudHMgKHRoaXMgaXMgdG8gcmVtb3ZlIGludGVyLWZyYWdtZW50IGdhcC9ob2xlKVxuLy8gICAgIGxldCBkZWx0YSA9IE1hdGgucm91bmQoKGZpcnN0RFRTIC0gbmV4dEF2Y0R0cykgLyA5MCk7XG4vL1xuLy8gICAgIC8vIGlmIGZyYWdtZW50IGFyZSBjb250aWd1b3VzLCBvciBkZWx0YSBsZXNzIHRoYW4gNjAwbXMsIGVuc3VyZSB0aGVyZSBpcyBubyBvdmVybGFwL2hvbGUgYmV0d2VlbiBmcmFnbWVudHNcbi8vICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbi8vICAgICAgIGlmIChkZWx0YSkge1xuLy8gICAgICAgICBpZiAoZGVsdGEgPiAxKSB7XG4vLyAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuLy8gICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEpIHtcbi8vICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbi8vICAgICAgICAgfVxuLy8gICAgICAgICAvLyByZW1vdmUgaG9sZS9nYXAgOiBzZXQgRFRTIHRvIG5leHQgZXhwZWN0ZWQgRFRTXG4vLyAgICAgICAgIGZpcnN0RFRTID0gaW5wdXRTYW1wbGVzWzBdLmR0cyA9IG5leHRBdmNEdHM7XG4vLyAgICAgICAgIC8vIG9mZnNldCBQVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgUFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgRFRTXG4vLyAgICAgICAgIGZpcnN0UFRTID0gaW5wdXRTYW1wbGVzWzBdLnB0cyA9IE1hdGgubWF4KGZpcnN0UFRTIC0gZGVsdGEsIG5leHRBdmNEdHMpO1xuLy8gICAgICAgICBsb2dnZXIubG9nKGBWaWRlby9QVFMvRFRTIGFkanVzdGVkOiAke2ZpcnN0UFRTfS8ke2ZpcnN0RFRTfSxkZWx0YToke2RlbHRhfWApO1xuLy8gICAgICAgfVxuLy8gICAgIH1cbi8vIFx0Y29uc29sZS5pbmZvKCAnZmlyc3RQVFMgIzI6ICcgKyBmaXJzdFBUUyApO1xuXG5cdC8vIHNhbXBsZSBkdXJhdGlvbiAoYXMgZXhwZWN0ZWQgYnkgdHJ1biBNUDQgYm94ZXMpLCBzaG91bGQgYmUgdGhlIGRlbHRhIGJldHdlZW4gc2FtcGxlIERUU1xuICAgIC8vIGxldCdzIHNpZ25hbCB0aGUgc2FtZSBzYW1wbGUgZHVyYXRpb24gZm9yIGFsbCBzYW1wbGVzXG4gICAgLy8gc2V0IHRoaXMgY29uc3RhbnQgZHVyYXRpb24gYXMgYmVpbmcgdGhlIGF2ZyBkZWx0YSBiZXR3ZWVuIGNvbnNlY3V0aXZlIERUUy5cbiAgICBzYW1wbGUgPSBpbnB1dFNhbXBsZXNbaW5wdXRTYW1wbGVzLmxlbmd0aC0xXTtcbiAgICBsYXN0RFRTID0gTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuXG5cdGxhc3REVFMgPSAoc2FtcGxlLmR0cyAtIGZpcnN0U2FtcGxlRFRTKSArIGZpcnN0UFRTO1xuICAgIG1wNFNhbXBsZUR1cmF0aW9uID0gTWF0aC5yb3VuZCgobGFzdERUUy1maXJzdERUUykvKHBlczJtcDRTY2FsZUZhY3RvciooaW5wdXRTYW1wbGVzLmxlbmd0aC0xKSkpO1xuXG5cdGlmIChsYXN0RFRTIDw9IGZpcnN0RFRTKSB7XG5cdFx0bGFzdERUUyA9IGZpcnN0RFRTO1xuXHRcdG1wNFNhbXBsZUR1cmF0aW9uID0gMDtcblx0XHRjb25zb2xlLndhcm4oJ2xhc3REVFMgPCBmaXJzdERUUycpO1xuXHR9XG5cdGxvZ2dlci5pbmZvKCAnKCBsYXN0RFRTIC0gZmlyc3REVFMgKSAvIDkwMDAwIDogJyArIChsYXN0RFRTIC0gZmlyc3REVFMpLzkwMDAwKTtcblx0dmFyIG9sZFBUUyA9IGZpcnN0UFRTO1xuXHQvLyBmaXJzdFBUUyA9IGZpcnN0RFRTID0gTWF0aC5yb3VuZCh0MCo5MDAwMCk7XG5cdGxvZ2dlci5pbmZvKCdmaXJzdFBUUzogJyAgKyBvbGRQVFMgKyAnIC0+ICcgKyB0MCo5MDAwMCk7XG5cdGlmICggTWF0aC5hYnMob2xkUFRTIC0gZmlyc3RQVFMpID4gMTAwMDAgKSB7IGNvbnNvbGUud2FybigndGhpcyBjb3VsZCBoYXZlIGNhdXNlZCBhIGZyYWdMb29wIGVycm9yJyk7IH1cblxuXG4gICAgLy8gbm9ybWFsaXplIGFsbCBQVFMvRFRTIG5vdyAuLi5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0U2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHNhbXBsZSA9IGlucHV0U2FtcGxlc1tpXTtcbiAgICAgIC8vIHNhbXBsZSBEVFMgaXMgY29tcHV0ZWQgdXNpbmcgYSBjb25zdGFudCBkZWNvZGluZyBvZmZzZXQgKG1wNFNhbXBsZUR1cmF0aW9uKSBiZXR3ZWVuIHNhbXBsZXNcbiAgICAgIHNhbXBsZS5kdHMgPSBmaXJzdERUUyArIGkqcGVzMm1wNFNjYWxlRmFjdG9yKm1wNFNhbXBsZUR1cmF0aW9uO1xuICAgICAgLy8gd2Ugbm9ybWFsaXplIFBUUyBhZ2FpbnN0IG5leHRBdmNEdHMsIHdlIGFsc28gc3Vic3RyYWN0IGluaXREVFMgKHNvbWUgc3RyZWFtcyBkb24ndCBzdGFydCBAIFBUUyBPKVxuICAgICAgLy8gYW5kIHdlIGVuc3VyZSB0aGF0IGNvbXB1dGVkIHZhbHVlIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBzYW1wbGUgRFRTXG4gICAgICAvLyBzYW1wbGUucHRzID0gTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLCBzYW1wbGUuZHRzKTtcblx0ICBzYW1wbGUucHRzID0gc2FtcGxlLmR0cztcbiAgICB9XG4gICAgbGFzdFBUUyA9IGlucHV0U2FtcGxlc1tpbnB1dFNhbXBsZXMubGVuZ3RoLTFdLnB0cztcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgKDQgKiB0cmFjay5uYk5hbHUpICsgOCk7XG4gICAgbGV0IHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgIHdoaWxlIChpbnB1dFNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBsZXQgYXZjU2FtcGxlID0gaW5wdXRTYW1wbGVzLnNoaWZ0KCksXG4gICAgICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlIChhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKG9mZnNldCwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCArPSA0ICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YXZjU2FtcGxlLnB0c30vJHthdmNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhdmNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBvdXRwdXRTYW1wbGVzLnB1c2goe1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgICAvLyBjb25zdGFudCBkdXJhdGlvblxuICAgICAgICBkdXJhdGlvbjogbXA0U2FtcGxlRHVyYXRpb24sXG4gICAgICAgIC8vIHNldCBjb21wb3NpdGlvbiB0aW1lIG9mZnNldCBhcyBhIG11bHRpcGxlIG9mIHNhbXBsZSBkdXJhdGlvblxuICAgICAgICBjdHM6IE1hdGgubWF4KDAsbXA0U2FtcGxlRHVyYXRpb24qTWF0aC5yb3VuZCgoYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMpLyhwZXMybXA0U2NhbGVGYWN0b3IqbXA0U2FtcGxlRHVyYXRpb24pKSksXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uIDogYXZjU2FtcGxlLmtleSA/IDIgOiAxLFxuICAgICAgICAgIGlzTm9uU3luYyA6IGF2Y1NhbXBsZS5rZXkgPyAwIDogMVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIERUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgRFRTICsgbGFzdCBzYW1wbGUgZHVyYXRpb24gKGluIFBFUyB0aW1lc2NhbGUpXG4gICAgdGhpcy5uZXh0QXZjRHRzID0gbGFzdERUUyArIG1wNFNhbXBsZUR1cmF0aW9uKnBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLm5iTmFsdSA9IDA7XG4gICAgaWYob3V0cHV0U2FtcGxlcy5sZW5ndGggJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEpIHtcbiAgICAgIGxldCBmbGFncyA9IG91dHB1dFNhbXBsZXNbMF0uZmxhZ3M7XG4gICAgLy8gY2hyb21lIHdvcmthcm91bmQsIG1hcmsgZmlyc3Qgc2FtcGxlIGFzIGJlaW5nIGEgUmFuZG9tIEFjY2VzcyBQb2ludCB0byBhdm9pZCBzb3VyY2VidWZmZXIgYXBwZW5kIGlzc3VlXG4gICAgLy8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTIyOTQxMlxuICAgICAgZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgIGZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgfVxuICAgIHRyYWNrLnNhbXBsZXMgPSBvdXRwdXRTYW1wbGVzO1xuXHQvLyBpZiAoZmlyc3REVFMvcGVzVGltZVNjYWxlID4gMTAwMDAwKSB7IGRlYnVnZ2VyOyB9XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gcGVzMm1wNFNjYWxlRmFjdG9yLCB0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgZGF0YTE6IG1vb2YsXG4gICAgICBkYXRhMjogbWRhdCxcbiAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZFBUUzogKGxhc3RQVFMgKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBtcDRTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmREVFM6IHRoaXMubmV4dEF2Y0R0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICBuYjogb3V0cHV0U2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIHJlbXV4QXVkaW8odHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gPSB0cmFjay50aW1lc2NhbGUgKiAxMDI0IC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlLFxuICAgICAgICBhYWNTYW1wbGUsIG1wNFNhbXBsZSxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgc2FtcGxlcyA9IFtdLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgc2FtcGxlczAgPSBbXTtcblxuICAgIHRyYWNrLnNhbXBsZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gKGEucHRzLWIucHRzKTtcbiAgICB9KTtcbiAgICBzYW1wbGVzMCA9IHRyYWNrLnNhbXBsZXM7XG5cbiAgICB3aGlsZSAoc2FtcGxlczAubGVuZ3RoKSB7XG4gICAgICBhYWNTYW1wbGUgPSBzYW1wbGVzMC5zaGlmdCgpO1xuICAgICAgdW5pdCA9IGFhY1NhbXBsZS51bml0O1xuICAgICAgcHRzID0gYWFjU2FtcGxlLnB0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICBkdHMgPSBhYWNTYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQXVkaW8vUFRTOiR7TWF0aC5yb3VuZChwdHMvOTApfWApO1xuICAgICAgLy8gaWYgbm90IGZpcnN0IHNhbXBsZVxuICAgICAgaWYgKGxhc3REVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbGFzdERUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBsYXN0RFRTKTtcbiAgICAgICAgLy8gbGV0J3MgY29tcHV0ZSBzYW1wbGUgZHVyYXRpb24uXG4gICAgICAgIC8vIHNhbXBsZSBEdXJhdGlvbiBzaG91bGQgYmUgY2xvc2UgdG8gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvblxuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAoZHRzbm9ybSAtIGxhc3REVFMpIC8gcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgICAgICBpZihNYXRoLmFicyhtcDRTYW1wbGUuZHVyYXRpb24gLSBleHBlY3RlZFNhbXBsZUR1cmF0aW9uKSA+IGV4cGVjdGVkU2FtcGxlRHVyYXRpb24vMTApIHtcbiAgICAgICAgICAvLyBtb3JlIHRoYW4gMTAlIGRpZmYgYmV0d2VlbiBzYW1wbGUgZHVyYXRpb24gYW5kIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gLi4uLiBsZXRzIGxvZyB0aGF0XG4gICAgICAgICAgLy8gbG9nZ2VyLnRyYWNlKGBpbnZhbGlkIEFBQyBzYW1wbGUgZHVyYXRpb24gYXQgUFRTICR7TWF0aC5yb3VuZChwdHMvOTApfSxzaG91bGQgYmUgMTAyNCxmb3VuZCA6JHtNYXRoLnJvdW5kKG1wNFNhbXBsZS5kdXJhdGlvbip0cmFjay5hdWRpb3NhbXBsZXJhdGUvdHJhY2sudGltZXNjYWxlKX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhbHdheXMgYWRqdXN0IHNhbXBsZSBkdXJhdGlvbiB0byBhdm9pZCBhdiBzeW5jIGlzc3VlXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGV4cGVjdGVkU2FtcGxlRHVyYXRpb247XG4gICAgICAgIGR0c25vcm0gPSBleHBlY3RlZFNhbXBsZUR1cmF0aW9uICogcGVzMm1wNFNjYWxlRmFjdG9yICsgbGFzdERUUztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBuZXh0QWFjUHRzLCBkZWx0YTtcbiAgICAgICAgaWYgKGNvbnRpZ3VvdXMpIHtcbiAgICAgICAgICBuZXh0QWFjUHRzID0gdGhpcy5uZXh0QWFjUHRzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5leHRBYWNQdHMgPSB0aW1lT2Zmc2V0KnBlc1RpbWVTY2FsZTtcbiAgICAgICAgfVxuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbmV4dEFhY1B0cyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZGVsdGEgPSBNYXRoLnJvdW5kKDEwMDAgKiAocHRzbm9ybSAtIG5leHRBYWNQdHMpIC8gcGVzVGltZVNjYWxlKTtcbiAgICAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuICAgICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgICAgICAvLyBsb2cgZGVsdGFcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBmcmFtZSBvdmVybGFwLCBvdmVybGFwcGluZyBmb3IgbW9yZSB0aGFuIGhhbGYgYSBmcmFtZSBkdXJhaW9uXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEyKSB7XG4gICAgICAgICAgICAgIC8vIGRyb3Agb3ZlcmxhcHBpbmcgYXVkaW8gZnJhbWVzLi4uIGJyb3dzZXIgd2lsbCBkZWFsIHdpdGggaXRcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBBQUMgc2FtcGxlcyBkZXRlY3RlZCwgZHJvcCBmcmFtZWApO1xuICAgICAgICAgICAgICB0cmFjay5sZW4gLT0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBEVFMgdG8gbmV4dCBEVFNcbiAgICAgICAgICAgIHB0c25vcm0gPSBkdHNub3JtID0gbmV4dEFhY1B0cztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhYWNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLCBwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLCBkdHNub3JtKTtcbiAgICAgICAgaWYodHJhY2subGVuID4gMCkge1xuICAgICAgICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgICAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbWRhdCB0eXBlKSAqL1xuICAgICAgICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyA4KTtcbiAgICAgICAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICAgICAgICB2aWV3LnNldFVpbnQzMigwLCBtZGF0LmJ5dGVMZW5ndGgpO1xuICAgICAgICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LCA0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBubyBhdWRpbyBzYW1wbGVzXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtZGF0LnNldCh1bml0LCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IHVuaXQuYnl0ZUxlbmd0aDtcbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthYWNTYW1wbGUucHRzfS8ke2FhY1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGFhY1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjdHM6IDAsXG4gICAgICAgIGR1cmF0aW9uOjAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0RFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgdmFyIGxhc3RTYW1wbGVEdXJhdGlvbiA9IDA7XG4gICAgdmFyIG5iU2FtcGxlcyA9IHNhbXBsZXMubGVuZ3RoO1xuICAgIC8vc2V0IGxhc3Qgc2FtcGxlIGR1cmF0aW9uIGFzIGJlaW5nIGlkZW50aWNhbCB0byBwcmV2aW91cyBzYW1wbGVcbiAgICBpZiAobmJTYW1wbGVzID49IDIpIHtcbiAgICAgIGxhc3RTYW1wbGVEdXJhdGlvbiA9IHNhbXBsZXNbbmJTYW1wbGVzIC0gMl0uZHVyYXRpb247XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgfVxuICAgIGlmIChuYlNhbXBsZXMpIHtcbiAgICAgIC8vIG5leHQgYWFjIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgICB0aGlzLm5leHRBYWNQdHMgPSBwdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uO1xuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG4gICAgICB0cmFjay5sZW4gPSAwO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgICBkYXRhMTogbW9vZixcbiAgICAgICAgZGF0YTI6IG1kYXQsXG4gICAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgZW5kUFRTOiB0aGlzLm5leHRBYWNQdHMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgZW5kRFRTOiAoZHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIGxhc3RTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIHR5cGU6ICdhdWRpbycsXG4gICAgICAgIG5iOiBuYlNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJlbXV4SUQzKHRyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB2YXIgbGVuZ3RoID0gdHJhY2suc2FtcGxlcy5sZW5ndGgsIHNhbXBsZTtcbiAgICAvLyBjb25zdW1lIHNhbXBsZXNcbiAgICBpZihsZW5ndGgpIHtcbiAgICAgIGZvcih2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBzYW1wbGUgPSB0cmFjay5zYW1wbGVzW2luZGV4XTtcbiAgICAgICAgLy8gc2V0dGluZyBpZDMgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICAgIHNhbXBsZS5kdHMgPSAoKHNhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgcmVtdXhUZXh0KHRyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB0cmFjay5zYW1wbGVzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgcmV0dXJuIChhLnB0cy1iLnB0cyk7XG4gICAgfSk7XG5cbiAgICB2YXIgbGVuZ3RoID0gdHJhY2suc2FtcGxlcy5sZW5ndGgsIHNhbXBsZTtcbiAgICAvLyBjb25zdW1lIHNhbXBsZXNcbiAgICBpZihsZW5ndGgpIHtcbiAgICAgIGZvcih2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBzYW1wbGUgPSB0cmFjay5zYW1wbGVzW2luZGV4XTtcbiAgICAgICAgLy8gc2V0dGluZyB0ZXh0IHB0cywgZHRzIHRvIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgLy8gdXNpbmcgdGhpcy5faW5pdFBUUyBhbmQgdGhpcy5faW5pdERUUyB0byBjYWxjdWxhdGUgcmVsYXRpdmUgdGltZVxuICAgICAgICBzYW1wbGUucHRzID0gKChzYW1wbGUucHRzIC0gdGhpcy5faW5pdFBUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwge1xuICAgICAgICBzYW1wbGVzOnRyYWNrLnNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgfVxuXG4gIF9QVFNOb3JtYWxpemUodmFsdWUsIHJlZmVyZW5jZSkge1xuICAgIHZhciBvZmZzZXQ7XG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChyZWZlcmVuY2UgPCB2YWx1ZSkge1xuICAgICAgLy8gLSAyXjMzXG4gICAgICBvZmZzZXQgPSAtODU4OTkzNDU5MjtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gKyAyXjMzXG4gICAgICBvZmZzZXQgPSA4NTg5OTM0NTkyO1xuICAgIH1cbiAgICAvKiBQVFMgaXMgMzNiaXQgKGZyb20gMCB0byAyXjMzIC0xKVxuICAgICAgaWYgZGlmZiBiZXR3ZWVuIHZhbHVlIGFuZCByZWZlcmVuY2UgaXMgYmlnZ2VyIHRoYW4gaGFsZiBvZiB0aGUgYW1wbGl0dWRlICgyXjMyKSB0aGVuIGl0IG1lYW5zIHRoYXRcbiAgICAgIFBUUyBsb29waW5nIG9jY3VyZWQuIGZpbGwgdGhlIGdhcCAqL1xuICAgIHdoaWxlIChNYXRoLmFicyh2YWx1ZSAtIHJlZmVyZW5jZSkgPiA0Mjk0OTY3Mjk2KSB7XG4gICAgICAgIHZhbHVlICs9IG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0UmVtdXhlcjtcbiIsIi8qKlxuICogcGFzc3Rocm91Z2ggcmVtdXhlclxuKi9cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuXG5jbGFzcyBQYXNzVGhyb3VnaFJlbXV4ZXIge1xuICBjb25zdHJ1Y3RvcihvYnNlcnZlcikge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICBnZXQgcGFzc3Rocm91Z2goKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHJlbXV4KGF1ZGlvVHJhY2ssdmlkZW9UcmFjayxpZDNUcmFjayx0ZXh0VHJhY2ssdGltZU9mZnNldCxyYXdEYXRhKSB7XG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlcjtcbiAgICAvLyBnZW5lcmF0ZSBJbml0IFNlZ21lbnQgaWYgbmVlZGVkXG4gICAgaWYgKCF0aGlzLklTR2VuZXJhdGVkKSB7XG4gICAgICB2YXIgdHJhY2tzID0ge30sXG4gICAgICAgICAgZGF0YSA9IHsgdHJhY2tzIDogdHJhY2tzLCB1bmlxdWUgOiB0cnVlIH0sXG4gICAgICAgICAgdHJhY2sgPSB2aWRlb1RyYWNrLFxuICAgICAgICAgIGNvZGVjID0gdHJhY2suY29kZWM7XG5cbiAgICAgIGlmIChjb2RlYykge1xuICAgICAgICBkYXRhLnRyYWNrcy52aWRlbyA9IHtcbiAgICAgICAgICBjb250YWluZXIgOiB0cmFjay5jb250YWluZXIsXG4gICAgICAgICAgY29kZWMgOiAgY29kZWMsXG4gICAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgICB3aWR0aCA6IHRyYWNrLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0IDogdHJhY2suaGVpZ2h0XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICB0cmFjayA9IGF1ZGlvVHJhY2s7XG4gICAgICBjb2RlYyA9IHRyYWNrLmNvZGVjO1xuICAgICAgaWYgKGNvZGVjKSB7XG4gICAgICAgIGRhdGEudHJhY2tzLmF1ZGlvID0ge1xuICAgICAgICAgIGNvbnRhaW5lciA6IHRyYWNrLmNvbnRhaW5lcixcbiAgICAgICAgICBjb2RlYyA6ICBjb2RlYyxcbiAgICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICAgIGNoYW5uZWxDb3VudCA6IHRyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULGRhdGEpO1xuICAgIH1cbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICBkYXRhMTogcmF3RGF0YSxcbiAgICAgIHN0YXJ0UFRTOiB0aW1lT2Zmc2V0LFxuICAgICAgc3RhcnREVFM6IHRpbWVPZmZzZXQsXG4gICAgICB0eXBlOiAnYXVkaW92aWRlbycsXG4gICAgICBuYjogMVxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBhc3NUaHJvdWdoUmVtdXhlcjtcbiIsIlxuLy8gYWRhcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9rYW5vbmdpbC9ub2RlLW0zdThwYXJzZS9ibG9iL21hc3Rlci9hdHRybGlzdC5qc1xuY2xhc3MgQXR0ckxpc3Qge1xuXG4gIGNvbnN0cnVjdG9yKGF0dHJzKSB7XG4gICAgaWYgKHR5cGVvZiBhdHRycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGF0dHJzID0gQXR0ckxpc3QucGFyc2VBdHRyTGlzdChhdHRycyk7XG4gICAgfVxuICAgIGZvcih2YXIgYXR0ciBpbiBhdHRycyl7XG4gICAgICBpZihhdHRycy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICB0aGlzW2F0dHJdID0gYXR0cnNbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBjb25zdCBpbnRWYWx1ZSA9IHBhcnNlSW50KHRoaXNbYXR0ck5hbWVdLCAxMCk7XG4gICAgaWYgKGludFZhbHVlID4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHtcbiAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICB9XG4gICAgcmV0dXJuIGludFZhbHVlO1xuICB9XG5cbiAgaGV4YWRlY2ltYWxJbnRlZ2VyKGF0dHJOYW1lKSB7XG4gICAgaWYodGhpc1thdHRyTmFtZV0pIHtcbiAgICAgIGxldCBzdHJpbmdWYWx1ZSA9ICh0aGlzW2F0dHJOYW1lXSB8fCAnMHgnKS5zbGljZSgyKTtcbiAgICAgIHN0cmluZ1ZhbHVlID0gKChzdHJpbmdWYWx1ZS5sZW5ndGggJiAxKSA/ICcwJyA6ICcnKSArIHN0cmluZ1ZhbHVlO1xuXG4gICAgICBjb25zdCB2YWx1ZSA9IG5ldyBVaW50OEFycmF5KHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDIpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHJpbmdWYWx1ZS5sZW5ndGggLyAyOyBpKyspIHtcbiAgICAgICAgdmFsdWVbaV0gPSBwYXJzZUludChzdHJpbmdWYWx1ZS5zbGljZShpICogMiwgaSAqIDIgKyAyKSwgMTYpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXJBc051bWJlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDE2KTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBkZWNpbWFsRmxvYXRpbmdQb2ludChhdHRyTmFtZSkge1xuICAgIHJldHVybiBwYXJzZUZsb2F0KHRoaXNbYXR0ck5hbWVdKTtcbiAgfVxuXG4gIGVudW1lcmF0ZWRTdHJpbmcoYXR0ck5hbWUpIHtcbiAgICByZXR1cm4gdGhpc1thdHRyTmFtZV07XG4gIH1cblxuICBkZWNpbWFsUmVzb2x1dGlvbihhdHRyTmFtZSkge1xuICAgIGNvbnN0IHJlcyA9IC9eKFxcZCspeChcXGQrKSQvLmV4ZWModGhpc1thdHRyTmFtZV0pO1xuICAgIGlmIChyZXMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogcGFyc2VJbnQocmVzWzFdLCAxMCksXG4gICAgICBoZWlnaHQ6IHBhcnNlSW50KHJlc1syXSwgMTApXG4gICAgfTtcbiAgfVxuXG4gIHN0YXRpYyBwYXJzZUF0dHJMaXN0KGlucHV0KSB7XG4gICAgY29uc3QgcmUgPSAvXFxzKiguKz8pXFxzKj0oKD86XFxcIi4qP1xcXCIpfC4qPykoPzosfCQpL2c7XG4gICAgdmFyIG1hdGNoLCBhdHRycyA9IHt9O1xuICAgIHdoaWxlICgobWF0Y2ggPSByZS5leGVjKGlucHV0KSkgIT09IG51bGwpIHtcbiAgICAgIHZhciB2YWx1ZSA9IG1hdGNoWzJdLCBxdW90ZSA9ICdcIic7XG5cbiAgICAgIGlmICh2YWx1ZS5pbmRleE9mKHF1b3RlKSA9PT0gMCAmJlxuICAgICAgICAgIHZhbHVlLmxhc3RJbmRleE9mKHF1b3RlKSA9PT0gKHZhbHVlLmxlbmd0aC0xKSkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLnNsaWNlKDEsIC0xKTtcbiAgICAgIH1cbiAgICAgIGF0dHJzW21hdGNoWzFdXSA9IHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gYXR0cnM7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBdHRyTGlzdDtcbiIsInZhciBCaW5hcnlTZWFyY2ggPSB7XG4gICAgLyoqXG4gICAgICogU2VhcmNoZXMgZm9yIGFuIGl0ZW0gaW4gYW4gYXJyYXkgd2hpY2ggbWF0Y2hlcyBhIGNlcnRhaW4gY29uZGl0aW9uLlxuICAgICAqIFRoaXMgcmVxdWlyZXMgdGhlIGNvbmRpdGlvbiB0byBvbmx5IG1hdGNoIG9uZSBpdGVtIGluIHRoZSBhcnJheSxcbiAgICAgKiBhbmQgZm9yIHRoZSBhcnJheSB0byBiZSBvcmRlcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gbGlzdCBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbXBhcmlzb25GdW5jdGlvblxuICAgICAqICAgICAgQ2FsbGVkIGFuZCBwcm92aWRlZCBhIGNhbmRpZGF0ZSBpdGVtIGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICAgKiAgICAgIFNob3VsZCByZXR1cm46XG4gICAgICogICAgICAgICAgPiAtMSBpZiB0aGUgaXRlbSBzaG91bGQgYmUgbG9jYXRlZCBhdCBhIGxvd2VyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAxIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgaGlnaGVyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAwIGlmIHRoZSBpdGVtIGlzIHRoZSBpdGVtIHlvdSdyZSBsb29raW5nIGZvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm4geyp9IFRoZSBvYmplY3QgaWYgaXQgaXMgZm91bmQgb3IgbnVsbCBvdGhlcndpc2UuXG4gICAgICovXG4gICAgc2VhcmNoOiBmdW5jdGlvbihsaXN0LCBjb21wYXJpc29uRnVuY3Rpb24pIHtcbiAgICAgICAgdmFyIG1pbkluZGV4ID0gMDtcbiAgICAgICAgdmFyIG1heEluZGV4ID0gbGlzdC5sZW5ndGggLSAxO1xuICAgICAgICB2YXIgY3VycmVudEluZGV4ID0gbnVsbDtcbiAgICAgICAgdmFyIGN1cnJlbnRFbGVtZW50ID0gbnVsbDtcbiAgICAgXG4gICAgICAgIHdoaWxlIChtaW5JbmRleCA8PSBtYXhJbmRleCkge1xuICAgICAgICAgICAgY3VycmVudEluZGV4ID0gKG1pbkluZGV4ICsgbWF4SW5kZXgpIC8gMiB8IDA7XG4gICAgICAgICAgICBjdXJyZW50RWxlbWVudCA9IGxpc3RbY3VycmVudEluZGV4XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGNvbXBhcmlzb25SZXN1bHQgPSBjb21wYXJpc29uRnVuY3Rpb24oY3VycmVudEVsZW1lbnQpO1xuICAgICAgICAgICAgaWYgKGNvbXBhcmlzb25SZXN1bHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgbWluSW5kZXggPSBjdXJyZW50SW5kZXggKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHtcbiAgICAgICAgICAgICAgICBtYXhJbmRleCA9IGN1cnJlbnRJbmRleCAtIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudEVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmluYXJ5U2VhcmNoO1xuIiwiLypcbiAqIENFQS03MDggaW50ZXJwcmV0ZXJcbiovXG5cbmNsYXNzIENFQTcwOEludGVycHJldGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxuXG4gIGF0dGFjaChtZWRpYSkge1xuICAgIHRoaXMubWVkaWEgPSBtZWRpYTtcbiAgICB0aGlzLmRpc3BsYXkgPSBbXTtcbiAgICB0aGlzLm1lbW9yeSA9IFtdO1xuICB9XG5cbiAgZGV0YWNoKClcbiAge1xuICAgIHRoaXMuY2xlYXIoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBfY3JlYXRlQ3VlKClcbiAge1xuICAgIHZhciBWVFRDdWUgPSB3aW5kb3cuVlRUQ3VlIHx8IHdpbmRvdy5UZXh0VHJhY2tDdWU7XG5cbiAgICB2YXIgY3VlID0gdGhpcy5jdWUgPSBuZXcgVlRUQ3VlKC0xLCAtMSwgJycpO1xuICAgIGN1ZS50ZXh0ID0gJyc7XG4gICAgY3VlLnBhdXNlT25FeGl0ID0gZmFsc2U7XG5cbiAgICAvLyBtYWtlIHN1cmUgaXQgZG9lc24ndCBzaG93IHVwIGJlZm9yZSBpdCdzIHJlYWR5XG4gICAgY3VlLnN0YXJ0VGltZSA9IE51bWJlci5NQVhfVkFMVUU7XG5cbiAgICAvLyBzaG93IGl0ICdmb3JldmVyJyBvbmNlIHdlIGRvIHNob3cgaXRcbiAgICAvLyAod2UnbGwgc2V0IHRoZSBlbmQgdGltZSBvbmNlIHdlIGtub3cgaXQgbGF0ZXIpXG4gICAgY3VlLmVuZFRpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXG4gICAgdGhpcy5tZW1vcnkucHVzaChjdWUpO1xuICB9XG5cbiAgY2xlYXIoKVxuICB7XG4gICAgdmFyIHRleHRUcmFjayA9IHRoaXMuX3RleHRUcmFjaztcbiAgICBpZiAodGV4dFRyYWNrICYmIHRleHRUcmFjay5jdWVzKVxuICAgIHtcbiAgICAgIHdoaWxlICh0ZXh0VHJhY2suY3Vlcy5sZW5ndGggPiAwKVxuICAgICAge1xuICAgICAgICB0ZXh0VHJhY2sucmVtb3ZlQ3VlKHRleHRUcmFjay5jdWVzWzBdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdXNoKHRpbWVzdGFtcCwgYnl0ZXMpXG4gIHtcbiAgICBpZiAoIXRoaXMuY3VlKVxuICAgIHtcbiAgICAgIHRoaXMuX2NyZWF0ZUN1ZSgpO1xuICAgIH1cblxuICAgIHZhciBjb3VudCA9IGJ5dGVzWzBdICYgMzE7XG4gICAgdmFyIHBvc2l0aW9uID0gMjtcbiAgICB2YXIgdG1wQnl0ZSwgY2NieXRlMSwgY2NieXRlMiwgY2NWYWxpZCwgY2NUeXBlO1xuXG4gICAgZm9yICh2YXIgaj0wOyBqPGNvdW50OyBqKyspXG4gICAge1xuICAgICAgdG1wQnl0ZSA9IGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMSA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjYnl0ZTIgPSAweDdGICYgYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY1ZhbGlkID0gKCg0ICYgdG1wQnl0ZSkgPT09IDAgPyBmYWxzZSA6IHRydWUpO1xuICAgICAgY2NUeXBlID0gKDMgJiB0bXBCeXRlKTtcblxuICAgICAgaWYgKGNjYnl0ZTEgPT09IDAgJiYgY2NieXRlMiA9PT0gMClcbiAgICAgIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChjY1ZhbGlkKVxuICAgICAge1xuICAgICAgICBpZiAoY2NUeXBlID09PSAwKSAvLyB8fCBjY1R5cGUgPT09IDFcbiAgICAgICAge1xuICAgICAgICAgIC8vIFN0YW5kYXJkIENoYXJhY3RlcnNcbiAgICAgICAgICBpZiAoMHgyMCAmIGNjYnl0ZTEgfHwgMHg0MCAmIGNjYnl0ZTEpXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSB0aGlzLl9mcm9tQ2hhckNvZGUoY2NieXRlMSkgKyB0aGlzLl9mcm9tQ2hhckNvZGUoY2NieXRlMik7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNwZWNpYWwgQ2hhcmFjdGVyc1xuICAgICAgICAgIGVsc2UgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgzMCAmJiBjY2J5dGUyIDw9IDB4M0YpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gZXh0ZW5kZWQgY2hhcnMsIGUuZy4gbXVzaWNhbCBub3RlLCBhY2NlbnRzXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgNDg6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwq4nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDQ5OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8KwJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MDpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCvSc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTE6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwr8nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUyOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ+KEoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTM6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwqInO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU0OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTU6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwqMnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU2OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ+KZqic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTc6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnICc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTg6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6gnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU5OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MDpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDqic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjE6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw64nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYyOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8O0JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDuyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxMSB8fCBjY2J5dGUxID09PSAweDE5KSAmJiBjY2J5dGUyID49IDB4MjAgJiYgY2NieXRlMiA8PSAweDJGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjA6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIxOlxuICAgICAgICAgICAgICAgIC8vIFdoaXRlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIEdyZWVuIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjQ6XG4gICAgICAgICAgICAgICAgLy8gQmx1ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjU6XG4gICAgICAgICAgICAgICAgLy8gQmx1ZSBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI2OlxuICAgICAgICAgICAgICAgIC8vIEN5YW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI3OlxuICAgICAgICAgICAgICAgIC8vIEN5YW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICAgICAgICAvLyBSZWRcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI5OlxuICAgICAgICAgICAgICAgIC8vIFJlZCBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJBOlxuICAgICAgICAgICAgICAgIC8vIFllbGxvd1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93IFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkM6XG4gICAgICAgICAgICAgICAgLy8gTWFnZW50YVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkQ6XG4gICAgICAgICAgICAgICAgLy8gTWFnZW50YSBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJFOlxuICAgICAgICAgICAgICAgIC8vIEl0YWxpY3NcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJGOlxuICAgICAgICAgICAgICAgIC8vIEl0YWxpY3MgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNCB8fCBjY2J5dGUxID09PSAweDFDKSAmJiBjY2J5dGUyID49IDB4MjAgJiYgY2NieXRlMiA8PSAweDJGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjA6XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogc2hvdWxkbid0IGFmZmVjdCByb2xsLXVwcy4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIC8vIFJDTDogUmVzdW1lIENhcHRpb24gTG9hZGluZ1xuICAgICAgICAgICAgICAgIC8vIGJlZ2luIHBvcCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gQlM6IEJhY2tzcGFjZVxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgPSB0aGlzLmN1ZS50ZXh0LnN1YnN0cigwLCB0aGlzLmN1ZS50ZXh0Lmxlbmd0aC0xKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIyOlxuICAgICAgICAgICAgICAgIC8vIEFPRjogcmVzZXJ2ZWQgKGZvcm1lcmx5IGFsYXJtIG9mZilcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIEFPTjogcmVzZXJ2ZWQgKGZvcm1lcmx5IGFsYXJtIG9uKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjQ6XG4gICAgICAgICAgICAgICAgLy8gREVSOiBEZWxldGUgdG8gZW5kIG9mIHJvd1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjU6XG4gICAgICAgICAgICAgICAgLy8gUlUyOiByb2xsLXVwIDIgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gUlUzOiByb2xsLXVwIDMgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gUlU0OiByb2xsLXVwIDQgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjg6XG4gICAgICAgICAgICAgICAgLy8gRk9OOiBGbGFzaCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUkRDOiBSZXN1bWUgZGlyZWN0IGNhcHRpb25pbmdcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJBOlxuICAgICAgICAgICAgICAgIC8vIFRSOiBUZXh0IFJlc3RhcnRcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJCOlxuICAgICAgICAgICAgICAgIC8vIFJURDogUmVzdW1lIFRleHQgRGlzcGxheVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkM6XG4gICAgICAgICAgICAgICAgLy8gRURNOiBFcmFzZSBEaXNwbGF5ZWQgTWVtb3J5XG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBDUjogQ2FycmlhZ2UgUmV0dXJuXG4gICAgICAgICAgICAgICAgLy8gb25seSBhZmZlY3RzIHJvbGwtdXBcbiAgICAgICAgICAgICAgICAvL3RoaXMuX3JvbGx1cCgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJFOlxuICAgICAgICAgICAgICAgIC8vIEVOTTogRXJhc2Ugbm9uLWRpc3BsYXllZCBtZW1vcnlcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0ID0gJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRjpcbiAgICAgICAgICAgICAgICB0aGlzLl9mbGlwTWVtb3J5KHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gRU9DOiBFbmQgb2YgY2FwdGlvblxuICAgICAgICAgICAgICAgIC8vIGhpZGUgYW55IGRpc3BsYXllZCBjYXB0aW9ucyBhbmQgc2hvdyBhbnkgaGlkZGVuIG9uZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoKGNjYnl0ZTEgPT09IDB4MTcgfHwgY2NieXRlMSA9PT0gMHgxRikgJiYgY2NieXRlMiA+PSAweDIxICYmIGNjYnl0ZTIgPD0gMHgyMylcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBNaWQtcm93IGNvZGVzOiBjb2xvci91bmRlcmxpbmVcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSAweDIxOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAxIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDIgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMzpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMyBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBQcm9iYWJseSBhIHByZS1hbWJsZSBhZGRyZXNzIGNvZGVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfZnJvbUNoYXJDb2RlKHRtcEJ5dGUpXG4gIHtcbiAgICBzd2l0Y2ggKHRtcEJ5dGUpXG4gICAge1xuICAgICAgY2FzZSA0MjpcbiAgICAgICAgcmV0dXJuICfDoSc7XG5cbiAgICAgIGNhc2UgMjpcbiAgICAgICAgcmV0dXJuICfDoSc7XG5cbiAgICAgIGNhc2UgMjpcbiAgICAgICAgcmV0dXJuICfDqSc7XG5cbiAgICAgIGNhc2UgNDpcbiAgICAgICAgcmV0dXJuICfDrSc7XG5cbiAgICAgIGNhc2UgNTpcbiAgICAgICAgcmV0dXJuICfDsyc7XG5cbiAgICAgIGNhc2UgNjpcbiAgICAgICAgcmV0dXJuICfDuic7XG5cbiAgICAgIGNhc2UgMzpcbiAgICAgICAgcmV0dXJuICfDpyc7XG5cbiAgICAgIGNhc2UgNDpcbiAgICAgICAgcmV0dXJuICfDtyc7XG5cbiAgICAgIGNhc2UgNTpcbiAgICAgICAgcmV0dXJuICfDkSc7XG5cbiAgICAgIGNhc2UgNjpcbiAgICAgICAgcmV0dXJuICfDsSc7XG5cbiAgICAgIGNhc2UgNzpcbiAgICAgICAgcmV0dXJuICfilognO1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSh0bXBCeXRlKTtcbiAgICB9XG4gIH1cblxuICBfZmxpcE1lbW9yeSh0aW1lc3RhbXApXG4gIHtcbiAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICB0aGlzLl9mbHVzaENhcHRpb25zKHRpbWVzdGFtcCk7XG4gIH1cblxuICBfZmx1c2hDYXB0aW9ucyh0aW1lc3RhbXApXG4gIHtcbiAgICBpZiAoIXRoaXMuX2hhczcwOClcbiAgICB7XG4gICAgICB0aGlzLl90ZXh0VHJhY2sgPSB0aGlzLm1lZGlhLmFkZFRleHRUcmFjaygnY2FwdGlvbnMnLCAnRW5nbGlzaCcsICdlbicpO1xuICAgICAgdGhpcy5faGFzNzA4ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBmb3IobGV0IG1lbW9yeUl0ZW0gb2YgdGhpcy5tZW1vcnkpXG4gICAge1xuICAgICAgbWVtb3J5SXRlbS5zdGFydFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgICB0aGlzLl90ZXh0VHJhY2suYWRkQ3VlKG1lbW9yeUl0ZW0pO1xuICAgICAgdGhpcy5kaXNwbGF5LnB1c2gobWVtb3J5SXRlbSk7XG4gICAgfVxuXG4gICAgdGhpcy5tZW1vcnkgPSBbXTtcbiAgICB0aGlzLmN1ZSA9IG51bGw7XG4gIH1cblxuICBfY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcClcbiAge1xuICAgIGZvciAobGV0IGRpc3BsYXlJdGVtIG9mIHRoaXMuZGlzcGxheSlcbiAgICB7XG4gICAgICBkaXNwbGF5SXRlbS5lbmRUaW1lID0gdGltZXN0YW1wO1xuICAgIH1cblxuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICB9XG5cbi8qICBfcm9sbFVwKG4pXG4gIHtcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnQgcm9sbC11cCBjYXB0aW9uc1xuICB9XG4qL1xuICBfY2xlYXJCdWZmZXJlZEN1ZXMoKVxuICB7XG4gICAgLy9yZW1vdmUgdGhlbSBhbGwuLi5cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IENFQTcwOEludGVycHJldGVyO1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5jb25zdCBmYWtlTG9nZ2VyID0ge1xuICB0cmFjZTogbm9vcCxcbiAgZGVidWc6IG5vb3AsXG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5cbmxldCBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG5cbi8vbGV0IGxhc3RDYWxsVGltZTtcbi8vIGZ1bmN0aW9uIGZvcm1hdE1zZ1dpdGhUaW1lSW5mbyh0eXBlLCBtc2cpIHtcbi8vICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbi8vICAgY29uc3QgZGlmZiA9IGxhc3RDYWxsVGltZSA/ICcrJyArIChub3cgLSBsYXN0Q2FsbFRpbWUpIDogJzAnO1xuLy8gICBsYXN0Q2FsbFRpbWUgPSBub3c7XG4vLyAgIG1zZyA9IChuZXcgRGF0ZShub3cpKS50b0lTT1N0cmluZygpICsgJyB8IFsnICsgIHR5cGUgKyAnXSA+ICcgKyBtc2cgKyAnICggJyArIGRpZmYgKyAnIG1zICknO1xuLy8gICByZXR1cm4gbXNnO1xuLy8gfVxuXG5mdW5jdGlvbiBmb3JtYXRNc2codHlwZSwgbXNnKSB7XG4gIG1zZyA9ICdbJyArICB0eXBlICsgJ10gPiAnICsgbXNnO1xuICByZXR1cm4gbXNnO1xufVxuXG5mdW5jdGlvbiBjb25zb2xlUHJpbnRGbih0eXBlKSB7XG4gIGNvbnN0IGZ1bmMgPSB3aW5kb3cuY29uc29sZVt0eXBlXTtcbiAgaWYgKGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgaWYoYXJnc1swXSkge1xuICAgICAgICBhcmdzWzBdID0gZm9ybWF0TXNnKHR5cGUsIGFyZ3NbMF0pO1xuICAgICAgfVxuICAgICAgZnVuYy5hcHBseSh3aW5kb3cuY29uc29sZSwgYXJncyk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4gbm9vcDtcbn1cblxuZnVuY3Rpb24gZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLCAuLi5mdW5jdGlvbnMpIHtcbiAgZnVuY3Rpb25zLmZvckVhY2goZnVuY3Rpb24odHlwZSkge1xuICAgIGV4cG9ydGVkTG9nZ2VyW3R5cGVdID0gZGVidWdDb25maWdbdHlwZV0gPyBkZWJ1Z0NvbmZpZ1t0eXBlXS5iaW5kKGRlYnVnQ29uZmlnKSA6IGNvbnNvbGVQcmludEZuKHR5cGUpO1xuICB9KTtcbn1cblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWdDb25maWcpIHtcbiAgaWYgKGRlYnVnQ29uZmlnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1Z0NvbmZpZyA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsXG4gICAgICAvLyBSZW1vdmUgb3V0IGZyb20gbGlzdCBoZXJlIHRvIGhhcmQtZGlzYWJsZSBhIGxvZy1sZXZlbFxuICAgICAgLy8ndHJhY2UnLFxuICAgICAgJ2RlYnVnJyxcbiAgICAgICdsb2cnLFxuICAgICAgJ2luZm8nLFxuICAgICAgJ3dhcm4nLFxuICAgICAgJ2Vycm9yJ1xuICAgICk7XG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuXG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwidmFyIFVSTEhlbHBlciA9IHtcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBVUkwgZnJvbSBhIHJlbGF0aXZlIG9uZSB1c2luZyB0aGUgcHJvdmlkZWQgYmFzZVVSTFxuICAvLyBpZiByZWxhdGl2ZVVSTCBpcyBhbiBhYnNvbHV0ZSBVUkwgaXQgd2lsbCBiZSByZXR1cm5lZCBhcyBpcy5cbiAgYnVpbGRBYnNvbHV0ZVVSTDogZnVuY3Rpb24oYmFzZVVSTCwgcmVsYXRpdmVVUkwpIHtcbiAgICAvLyByZW1vdmUgYW55IHJlbWFpbmluZyBzcGFjZSBhbmQgQ1JMRlxuICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkwudHJpbSgpO1xuICAgIGlmICgvXlthLXpdKzovaS50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgLy8gY29tcGxldGUgdXJsLCBub3QgcmVsYXRpdmVcbiAgICAgIHJldHVybiByZWxhdGl2ZVVSTDtcbiAgICB9XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeSA9IG51bGw7XG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaCA9IG51bGw7XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMSGFzaFNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTEhhc2ggPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxRdWVyeVNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTFF1ZXJ5ID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTEhhc2hTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciBiYXNlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxRdWVyeVNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxEb21haW5TcGxpdCA9IC9eKCgoW2Etel0rKTopP1xcL1xcL1thLXowLTlcXC5cXC1ffl0rKDpbMC05XSspP1xcLykoLiopJC9pLmV4ZWMoYmFzZVVSTCk7XG4gICAgdmFyIGJhc2VVUkxQcm90b2NvbCA9IGJhc2VVUkxEb21haW5TcGxpdFszXTtcbiAgICB2YXIgYmFzZVVSTERvbWFpbiA9IGJhc2VVUkxEb21haW5TcGxpdFsxXTtcbiAgICB2YXIgYmFzZVVSTFBhdGggPSBiYXNlVVJMRG9tYWluU3BsaXRbNV07XG5cbiAgICB2YXIgYnVpbHRVUkwgPSBudWxsO1xuICAgIGlmICgvXlxcL1xcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTFByb3RvY29sKyc6Ly8nK1VSTEhlbHBlci5idWlsZEFic29sdXRlUGF0aCgnJywgcmVsYXRpdmVVUkwuc3Vic3RyaW5nKDIpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoL15cXC8vLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4rVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGJ1aWx0VVJMID0gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKGJhc2VVUkxEb21haW4rYmFzZVVSTFBhdGgsIHJlbGF0aXZlVVJMKTtcbiAgICB9XG5cbiAgICAvLyBwdXQgdGhlIHF1ZXJ5IGFuZCBoYXNoIHBhcnRzIGJhY2tcbiAgICBpZiAocmVsYXRpdmVVUkxRdWVyeSkge1xuICAgICAgYnVpbHRVUkwgKz0gcmVsYXRpdmVVUkxRdWVyeTtcbiAgICB9XG4gICAgaWYgKHJlbGF0aXZlVVJMSGFzaCkge1xuICAgICAgYnVpbHRVUkwgKz0gcmVsYXRpdmVVUkxIYXNoO1xuICAgIH1cbiAgICByZXR1cm4gYnVpbHRVUkw7XG4gIH0sXG5cbiAgLy8gYnVpbGQgYW4gYWJzb2x1dGUgcGF0aCB1c2luZyB0aGUgcHJvdmlkZWQgYmFzZVBhdGhcbiAgLy8gYWRhcHRlZCBmcm9tIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9kb2N1bWVudC9jb29raWUjVXNpbmdfcmVsYXRpdmVfVVJMc19pbl90aGVfcGF0aF9wYXJhbWV0ZXJcbiAgLy8gdGhpcyBkb2VzIG5vdCBoYW5kbGUgdGhlIGNhc2Ugd2hlcmUgcmVsYXRpdmVQYXRoIGlzIFwiL1wiIG9yIFwiLy9cIi4gVGhlc2UgY2FzZXMgc2hvdWxkIGJlIGhhbmRsZWQgb3V0c2lkZSB0aGlzLlxuICBidWlsZEFic29sdXRlUGF0aDogZnVuY3Rpb24oYmFzZVBhdGgsIHJlbGF0aXZlUGF0aCkge1xuICAgIHZhciBzUmVsUGF0aCA9IHJlbGF0aXZlUGF0aDtcbiAgICB2YXIgblVwTG4sIHNEaXIgPSAnJywgc1BhdGggPSBiYXNlUGF0aC5yZXBsYWNlKC9bXlxcL10qJC8sIHNSZWxQYXRoLnJlcGxhY2UoLyhcXC98XikoPzpcXC4/XFwvKykrL2csICckMScpKTtcbiAgICBmb3IgKHZhciBuRW5kLCBuU3RhcnQgPSAwOyBuRW5kID0gc1BhdGguaW5kZXhPZignLy4uLycsIG5TdGFydCksIG5FbmQgPiAtMTsgblN0YXJ0ID0gbkVuZCArIG5VcExuKSB7XG4gICAgICBuVXBMbiA9IC9eXFwvKD86XFwuXFwuXFwvKSovLmV4ZWMoc1BhdGguc2xpY2UobkVuZCkpWzBdLmxlbmd0aDtcbiAgICAgIHNEaXIgPSAoc0RpciArIHNQYXRoLnN1YnN0cmluZyhuU3RhcnQsIG5FbmQpKS5yZXBsYWNlKG5ldyBSZWdFeHAoJyg/OlxcXFxcXC8rW15cXFxcXFwvXSopezAsJyArICgoblVwTG4gLSAxKSAvIDMpICsgJ30kJyksICcvJyk7XG4gICAgfVxuICAgIHJldHVybiBzRGlyICsgc1BhdGguc3Vic3RyKG5TdGFydCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVVJMSGVscGVyO1xuIiwiLyoqXG4gKiBYSFIgYmFzZWQgbG9nZ2VyXG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgWGhyTG9hZGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICBpZiAoY29uZmlnICYmIGNvbmZpZy54aHJTZXR1cCkge1xuICAgICAgdGhpcy54aHJTZXR1cCA9IGNvbmZpZy54aHJTZXR1cDtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuYWJvcnQoKTtcbiAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICB2YXIgbG9hZGVyID0gdGhpcy5sb2FkZXIsXG4gICAgICAgIHRpbWVvdXRIYW5kbGUgPSB0aGlzLnRpbWVvdXRIYW5kbGU7XG4gICAgaWYgKGxvYWRlciAmJiBsb2FkZXIucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgdGhpcy5zdGF0cy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgIGxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICBpZiAodGltZW91dEhhbmRsZSkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aW1lb3V0SGFuZGxlKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCwgY3JlZHMsIHJlc3BvbnNlVHlwZSwgb25TdWNjZXNzLCBvbkVycm9yLCBvblRpbWVvdXQsIHRpbWVvdXQsIG1heFJldHJ5LCByZXRyeURlbGF5LCBvblByb2dyZXNzID0gbnVsbCwgZnJhZyA9IG51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICBpZiAoZnJhZyAmJiAhaXNOYU4oZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCkgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0KSkge1xuICAgICAgICB0aGlzLmJ5dGVSYW5nZSA9IGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgKyAnLScgKyAoZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQtMSk7XG4gICAgfVxuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25Qcm9ncmVzcyA9IG9uUHJvZ3Jlc3M7XG4gICAgdGhpcy5vblRpbWVvdXQgPSBvblRpbWVvdXQ7XG4gICAgdGhpcy5vbkVycm9yID0gb25FcnJvcjtcbiAgICB0aGlzLnN0YXRzID0ge3RyZXF1ZXN0OiBwZXJmb3JtYW5jZS5ub3coKSwgcmV0cnk6IDB9O1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcblx0dGhpcy5jcmVkcyA9IGNyZWRzO1xuICB9XG5cbiAgbG9hZEludGVybmFsKCkge1xuICAgIHZhciB4aHI7XG5cbiAgICBpZiAodHlwZW9mIFhEb21haW5SZXF1ZXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIH1cblxuICAgIHhoci5vbmxvYWRlbmQgPSB0aGlzLmxvYWRlbmQuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG5cbiAgICB4aHIub3BlbignR0VUJywgdGhpcy51cmwsIHRydWUpO1xuICAgIGlmICh0aGlzLmJ5dGVSYW5nZSkge1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ1JhbmdlJywgJ2J5dGVzPScgKyB0aGlzLmJ5dGVSYW5nZSk7XG4gICAgfVxuXHRpZiAodGhpcy5jcmVkcykge1xuXHRcdGlmICghdGhpcy5jcmVkcy51c2VybmFtZSkgeyBjb25zb2xlLndhcm4oJ2dvdCBjcmVkZW50aWFscywgYnV0IG5vIHVzZXJuYW1lJyk7IH1cblx0XHRpZiAoIXRoaXMuY3JlZHMucGFzc3dvcmQpIHsgY29uc29sZS53YXJuKCdnb3QgY3JlZGVudGlhbHMsIGJ1dCBubyBwYXNzd29yZCcpOyB9XG5cdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIoICdBdXRob3JpemF0aW9uJywgJ0Jhc2ljICcgKyBidG9hKHRoaXMuY3JlZHMudXNlcm5hbWUgKyAnOicgKyB0aGlzLmNyZWRzLnBhc3N3b3JkKSApO1xuXHR9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgaWYgKHRoaXMueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAoeGhyLCB0aGlzLnVybCk7XG4gICAgfVxuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy50aW1lb3V0KTtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZGVuZChldmVudCkge1xuICAgIHZhciB4aHIgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdGF0dXMgPSB4aHIuc3RhdHVzLFxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgLy8gZG9uJ3QgcHJvY2VlZCBpZiB4aHIgaGFzIGJlZW4gYWJvcnRlZFxuICAgIGlmICghc3RhdHMuYWJvcnRlZCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
