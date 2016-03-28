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
            sourceBuffer[segment.type].appendBuffer(segment.data);
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
        this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
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
        this.hls.trigger(_events2.default.LEVEL_LOADING, { url: level.url[urlId], level: levelId, id: urlId });
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
      //logger.log(this.state);
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
                    //logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
                    if (candidate.start + candidate.duration - maxFragLookUpTolerance <= bufferEnd) {
                      return 1;
                    } else if (candidate.start - maxFragLookUpTolerance > bufferEnd) {
                      return -1;
                    }
                    return 0;
                  });
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
          _logger.logger.log('Demuxing ' + sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + level);
          this.demuxer.push(data.payload, audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata);
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
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
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
      demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
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
    value: function pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn: sn, duration: duration }, [data]);
      } else {
        this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata) {
      if (data.byteLength > 0 && decryptdata != null && decryptdata.key != null && decryptdata.method === 'AES-128') {
        if (this.decrypter == null) {
          this.decrypter = new _decrypter2.default(this.hls);
        }

        var localthis = this;
        this.decrypter.decrypt(data, decryptdata.key, decryptdata.iv, function (decryptedData) {
          localthis.pushDecrypted(decryptedData, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
        });
      } else {
        this.pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
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
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
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
                      this.remux(data);
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
                      this.remux(data);
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
      this.remux(null);
    }
  }, {
    key: 'remux',
    value: function remux(data) {
      this.remuxer.remux(this._aacTrack, this._avcTrack, this._id3Track, this._txtTrack, this.timeOffset, this.contiguous, data);
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
      if (!isNaN(frag.startPTS)) {
        startPTS = Math.min(startPTS, frag.startPTS);
        endPTS = Math.max(endPTS, frag.endPTS);
      }

      var drift = startPTS - frag.start;

      frag.start = frag.startPTS = startPTS;
      frag.endPTS = endPTS;
      frag.duration = endPTS - startPTS;
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
          debug: false,
          capLevelToPlayerSize: false,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.5,
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
          fragLoadingMaxRetry: 6,
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
          byteRangeStartOffset;

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
              frag = { url: url, duration: duration, start: totalduration, sn: sn, level: id, cc: cc++, byteRangeStartOffset: byteRangeStartOffset, byteRangeEndOffset: byteRangeEndOffset, decryptdata: fragdecryptdata, programDateTime: programDateTime };
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
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous) {
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        this.generateIS(audioTrack, videoTrack, timeOffset);
      }
      //logger.log('nb AVC samples:' + videoTrack.samples.length);
      if (videoTrack.samples.length) {
        this.remuxVideo(videoTrack, timeOffset, contiguous);
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
      //notify end of parsing
      this.observer.trigger(_events2.default.FRAG_PARSED);
    }
  }, {
    key: 'generateIS',
    value: function generateIS(audioTrack, videoTrack, timeOffset) {
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
          initPTS = initDTS = audioSamples[0].pts - pesTimeScale * timeOffset;
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
          this._initPTS = initPTS;
          this._initDTS = initDTS;
        }
      }
    }
  }, {
    key: 'remuxVideo',
    value: function remuxVideo(track, timeOffset, contiguous) {
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
        nextAvcDts = timeOffset * pesTimeScale;
      }

      // compute first DTS and last DTS, normalize them against reference value
      var sample = inputSamples[0];
      firstDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);
      firstPTS = Math.max(this._PTSNormalize(sample.pts, nextAvcDts) - this._initDTS, 0);

      // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
      var delta = Math.round((firstDTS - nextAvcDts) / 90);
      // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
      if (contiguous || Math.abs(delta) < 600) {
        if (delta) {
          if (delta > 1) {
            _logger.logger.log('AVC:' + delta + ' ms hole between fragments detected,filling it');
          } else if (delta < -1) {
            _logger.logger.log('AVC:' + -delta + ' ms overlapping between fragments detected');
          }
          // remove hole/gap : set DTS to next expected DTS
          firstDTS = inputSamples[0].dts = nextAvcDts;
          // offset PTS as well, ensure that PTS is smaller or equal than new DTS
          firstPTS = inputSamples[0].pts = Math.max(firstPTS - delta, nextAvcDts);
          _logger.logger.log('Video/PTS/DTS adjusted: ' + firstPTS + '/' + firstDTS + ',delta:' + delta);
        }
      }

      // sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
      // let's signal the same sample duration for all samples
      // set this constant duration as being the avg delta between consecutive DTS.
      sample = inputSamples[inputSamples.length - 1];
      lastDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);
      mp4SampleDuration = Math.round((lastDTS - firstDTS) / (pes2mp4ScaleFactor * (inputSamples.length - 1)));

      // normalize all PTS/DTS now ...
      for (var i = 0; i < inputSamples.length; i++) {
        var _sample = inputSamples[i];
        // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
        _sample.dts = firstDTS + i * pes2mp4ScaleFactor * mp4SampleDuration;
        // we normalize PTS against nextAvcDts, we also substract initDTS (some streams don't start @ PTS O)
        // and we ensure that computed value is greater or equal than sample DTS
        _sample.pts = Math.max(this._PTSNormalize(_sample.pts, nextAvcDts) - this._initDTS, _sample.dts);
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
          mp4timeScale = track.timescale,
          pes2mp4ScaleFactor = pesTimeScale / mp4timeScale,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwic3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCJzcmMvY29udHJvbGxlci9idWZmZXItY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL2NhcC1sZXZlbC1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlci5qcyIsInNyYy9jcnlwdC9hZXMuanMiLCJzcmMvY3J5cHQvYWVzMTI4LWRlY3J5cHRlci5qcyIsInNyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCJzcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsInNyYy9kZW11eC9hZHRzLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXIuanMiLCJzcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsInNyYy9kZW11eC9pZDMuanMiLCJzcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9ldmVudC1oYW5kbGVyLmpzIiwic3JjL2V2ZW50cy5qcyIsInNyYy9oZWxwZXIvYnVmZmVyLWhlbHBlci5qcyIsInNyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwic3JjL2hscy5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwic3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwic3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCJzcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsInNyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsInNyYy9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyLmpzIiwic3JjL3V0aWxzL2F0dHItbGlzdC5qcyIsInNyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwic3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCJzcmMvdXRpbHMvbG9nZ2VyLmpzIiwic3JjL3V0aWxzL3VybC5qcyIsInNyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtB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SyxLQUFMLENBQXRCLENBRmlCOzs7O2lDQUtOLE9BQU87QUFDbEIsVUFBSSxRQUFRLEtBQUssS0FBTCxDQURNO0FBRWxCLFVBQUksTUFBTSxNQUFOLEtBQWlCLElBQWpCLEVBQXVCO0FBQ3pCLGNBQU0sTUFBTixHQUFlLFlBQVksR0FBWixFQUFmLENBRHlCO09BQTNCO0FBR0EsWUFBTSxNQUFOLEdBQWUsTUFBTSxNQUFOLENBTEc7QUFNbEIsVUFBSSxLQUFLLFVBQUwsRUFBaUI7QUFDbkIsYUFBSyxVQUFMLENBQWdCLEtBQWhCLEVBQXVCLEtBQXZCLEVBRG1CO09BQXJCOzs7O1NBNUdFOzs7a0JBa0hTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIHZhciBleHAgPSBjYWNoZVtrZXldLmV4cG9ydHM7XG4gICAgICAgIC8vIFVzaW5nIGJhYmVsIGFzIGEgdHJhbnNwaWxlciB0byB1c2UgZXNtb2R1bGUsIHRoZSBleHBvcnQgd2lsbCBhbHdheXNcbiAgICAgICAgLy8gYmUgYW4gb2JqZWN0IHdpdGggdGhlIGRlZmF1bHQgZXhwb3J0IGFzIGEgcHJvcGVydHkgb2YgaXQuIFRvIGVuc3VyZVxuICAgICAgICAvLyB0aGUgZXhpc3RpbmcgYXBpIGFuZCBiYWJlbCBlc21vZHVsZSBleHBvcnRzIGFyZSBib3RoIHN1cHBvcnRlZCB3ZVxuICAgICAgICAvLyBjaGVjayBmb3IgYm90aFxuICAgICAgICBpZiAoZXhwID09PSBmbiB8fCBleHAuZGVmYXVsdCA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG5cbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sIChcbiAgICAgICAgICAgIC8vIHRyeSB0byBjYWxsIGRlZmF1bHQgaWYgZGVmaW5lZCB0byBhbHNvIHN1cHBvcnQgYmFiZWwgZXNtb2R1bGVcbiAgICAgICAgICAgIC8vIGV4cG9ydHNcbiAgICAgICAgICAgICd2YXIgZiA9IHJlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpOycgK1xuICAgICAgICAgICAgJyhmLmRlZmF1bHQgPyBmLmRlZmF1bHQgOiBmKShzZWxmKTsnXG4gICAgICAgICkpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG5cbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogc2ltcGxlIEFCUiBDb250cm9sbGVyXG4gKiAgLSBjb21wdXRlIG5leHQgbGV2ZWwgYmFzZWQgb24gbGFzdCBmcmFnbWVudCBidyBoZXVyaXN0aWNzXG4gKiAgLSBpbXBsZW1lbnQgYW4gYWJhbmRvbiBydWxlcyB0cmlnZ2VyZWQgaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGJ1ZmZlcmVkIGFuZCBpZiBjb21wdXRlZCBidyBzaG93cyB0aGF0IHdlIHJpc2sgYnVmZmVyIHN0YWxsaW5nXG4gKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IEJ1ZmZlckhlbHBlciBmcm9tICcuLi9oZWxwZXIvYnVmZmVyLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBBYnJDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgICAgICAgICAgRXZlbnQuRVJST1IpO1xuICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSAwO1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbkNoZWNrID0gdGhpcy5hYmFuZG9uUnVsZXNDaGVjay5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9uQ2hlY2ssIDEwMCk7XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IGRhdGEuZnJhZztcbiAgfVxuXG4gIG9uRnJhZ0xvYWRQcm9ncmVzcyhkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAvLyBvbmx5IHVwZGF0ZSBzdGF0cyBpZiBmaXJzdCBmcmFnIGxvYWRpbmdcbiAgICAvLyBpZiBzYW1lIGZyYWcgaXMgbG9hZGVkIG11bHRpcGxlIHRpbWVzLCBpdCBtaWdodCBiZSBpbiBicm93c2VyIGNhY2hlLCBhbmQgbG9hZGVkIHF1aWNrbHlcbiAgICAvLyBhbmQgbGVhZGluZyB0byB3cm9uZyBidyBlc3RpbWF0aW9uXG4gICAgaWYgKHN0YXRzLmFib3J0ZWQgPT09IHVuZGVmaW5lZCAmJiBkYXRhLmZyYWcubG9hZENvdW50ZXIgPT09IDEpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAocGVyZm9ybWFuY2Uubm93KCkgLSBzdGF0cy50cmVxdWVzdCkgLyAxMDAwO1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgIHRoaXMubGFzdGJ3ID0gKHN0YXRzLmxvYWRlZCAqIDgpIC8gdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbjtcbiAgICAgIC8vY29uc29sZS5sb2coYGZldGNoRHVyYXRpb246JHt0aGlzLmxhc3RmZXRjaGR1cmF0aW9ufSxidzokeyh0aGlzLmxhc3Ridy8xMDAwKS50b0ZpeGVkKDApfS8ke3N0YXRzLmFib3J0ZWR9YCk7XG4gICAgfVxuICB9XG5cbiAgYWJhbmRvblJ1bGVzQ2hlY2soKSB7XG4gICAgLypcbiAgICAgIG1vbml0b3IgZnJhZ21lbnQgcmV0cmlldmFsIHRpbWUuLi5cbiAgICAgIHdlIGNvbXB1dGUgZXhwZWN0ZWQgdGltZSBvZiBhcnJpdmFsIG9mIHRoZSBjb21wbGV0ZSBmcmFnbWVudC5cbiAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICovXG4gICAgbGV0IGhscyA9IHRoaXMuaGxzLCB2ID0gaGxzLm1lZGlhLGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIC8qIG9ubHkgbW9uaXRvciBmcmFnIHJldHJpZXZhbCB0aW1lIGlmXG4gICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKHJlYWR5IHN0YXRlID09PSBIQVZFX05PVEhJTkcgPSAwKSkgQU5EIGF1dG9zd2l0Y2hpbmcgZW5hYmxlZCBBTkQgbm90IGxvd2VzdCBsZXZlbCAoPT4gbWVhbnMgdGhhdCB3ZSBoYXZlIHNldmVyYWwgbGV2ZWxzKSAqL1xuICAgIGlmICh2ICYmICghdi5wYXVzZWQgfHwgIXYucmVhZHlTdGF0ZSkgJiYgZnJhZy5hdXRvTGV2ZWwgJiYgZnJhZy5sZXZlbCkge1xuICAgICAgbGV0IHJlcXVlc3REZWxheSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gZnJhZy50cmVxdWVzdDtcbiAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICBpZiAocmVxdWVzdERlbGF5ID4gKDUwMCAqIGZyYWcuZHVyYXRpb24pKSB7XG4gICAgICAgIGxldCBsb2FkUmF0ZSA9IE1hdGgubWF4KDEsZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5KTsgLy8gYnl0ZS9zOyBhdCBsZWFzdCAxIGJ5dGUvcyB0byBhdm9pZCBkaXZpc2lvbiBieSB6ZXJvXG4gICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gZnJhZy5sb2FkZWQ7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHBvcyA9IHYuY3VycmVudFRpbWU7XG4gICAgICAgIGxldCBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICBsZXQgYnVmZmVyU3RhcnZhdGlvbkRlbGF5ID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odixwb3MsaGxzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5lbmQgLSBwb3M7XG4gICAgICAgIC8vIGNvbnNpZGVyIGVtZXJnZW5jeSBzd2l0Y2ggZG93biBvbmx5IGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBidWZmZXJlZCBBTkRcbiAgICAgICAgLy8gdGltZSB0byBmaW5pc2ggbG9hZGluZyBjdXJyZW50IGZyYWdtZW50IGlzIGJpZ2dlciB0aGFuIGJ1ZmZlciBzdGFydmF0aW9uIGRlbGF5XG4gICAgICAgIC8vIGllIGlmIHdlIHJpc2sgYnVmZmVyIHN0YXJ2YXRpb24gaWYgYncgZG9lcyBub3QgaW5jcmVhc2UgcXVpY2tseVxuICAgICAgICBpZiAoYnVmZmVyU3RhcnZhdGlvbkRlbGF5IDwgMipmcmFnLmR1cmF0aW9uICYmIGZyYWdMb2FkZWREZWxheSA+IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSkge1xuICAgICAgICAgIGxldCBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXksIG5leHRMb2FkTGV2ZWw7XG4gICAgICAgICAgLy8gbGV0cyBpdGVyYXRlIHRocm91Z2ggbG93ZXIgbGV2ZWwgYW5kIHRyeSB0byBmaW5kIHRoZSBiaWdnZXN0IG9uZSB0aGF0IGNvdWxkIGF2b2lkIHJlYnVmZmVyaW5nXG4gICAgICAgICAgLy8gd2Ugc3RhcnQgZnJvbSBjdXJyZW50IGxldmVsIC0gMSBhbmQgd2Ugc3RlcCBkb3duICwgdW50aWwgd2UgZmluZCBhIG1hdGNoaW5nIGxldmVsXG4gICAgICAgICAgZm9yIChuZXh0TG9hZExldmVsID0gZnJhZy5sZXZlbCAtIDEgOyBuZXh0TG9hZExldmVsID49MCA7IG5leHRMb2FkTGV2ZWwtLSkge1xuICAgICAgICAgICAgLy8gY29tcHV0ZSB0aW1lIHRvIGxvYWQgbmV4dCBmcmFnbWVudCBhdCBsb3dlciBsZXZlbFxuICAgICAgICAgICAgLy8gMC44IDogY29uc2lkZXIgb25seSA4MCUgb2YgY3VycmVudCBidyB0byBiZSBjb25zZXJ2YXRpdmVcbiAgICAgICAgICAgIC8vIDggPSBiaXRzIHBlciBieXRlIChicHMvQnBzKVxuICAgICAgICAgICAgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5ID0gZnJhZy5kdXJhdGlvbiAqIGhscy5sZXZlbHNbbmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogMC44ICogbG9hZFJhdGUpO1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZnJhZ0xvYWRlZERlbGF5L2J1ZmZlclN0YXJ2YXRpb25EZWxheS9mcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXlbJHtuZXh0TG9hZExldmVsfV0gOiR7ZnJhZ0xvYWRlZERlbGF5LnRvRml4ZWQoMSl9LyR7YnVmZmVyU3RhcnZhdGlvbkRlbGF5LnRvRml4ZWQoMSl9LyR7ZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5LnRvRml4ZWQoMSl9YCk7XG4gICAgICAgICAgICBpZiAoZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5IDwgYnVmZmVyU3RhcnZhdGlvbkRlbGF5KSB7XG4gICAgICAgICAgICAgIC8vIHdlIGZvdW5kIGEgbG93ZXIgbGV2ZWwgdGhhdCBiZSByZWJ1ZmZlcmluZyBmcmVlIHdpdGggY3VycmVudCBlc3RpbWF0ZWQgYncgIVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gb25seSBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gaWYgaXQgdGFrZXMgbGVzcyB0aW1lIHRvIGxvYWQgbmV3IGZyYWdtZW50IGF0IGxvd2VzdCBsZXZlbCBpbnN0ZWFkXG4gICAgICAgICAgLy8gb2YgZmluaXNoaW5nIGxvYWRpbmcgY3VycmVudCBvbmUgLi4uXG4gICAgICAgICAgaWYgKGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA8IGZyYWdMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgLy8gZW5zdXJlIG5leHRMb2FkTGV2ZWwgaXMgbm90IG5lZ2F0aXZlXG4gICAgICAgICAgICBuZXh0TG9hZExldmVsID0gTWF0aC5tYXgoMCxuZXh0TG9hZExldmVsKTtcbiAgICAgICAgICAgIC8vIGZvcmNlIG5leHQgbG9hZCBsZXZlbCBpbiBhdXRvIG1vZGVcbiAgICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbmV4dExvYWRMZXZlbDtcbiAgICAgICAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgLi4uXG4gICAgICAgICAgICBsb2dnZXIud2FybihgbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZyBhbmQgc3dpdGNoIHRvIGxldmVsICR7bmV4dExvYWRMZXZlbH1gKTtcbiAgICAgICAgICAgIC8vYWJvcnQgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZCgpIHtcbiAgICAvLyBzdG9wIG1vbml0b3JpbmcgYncgb25jZSBmcmFnIGxvYWRlZFxuICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgLy8gc3RvcCB0aW1lciBpbiBjYXNlIG9mIGZyYWcgbG9hZGluZyBlcnJvclxuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuIGNsZWFyVGltZXIoKSB7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LCBobHMgPSB0aGlzLmhscyxhZGp1c3RlZGJ3LCBpLCBtYXhBdXRvTGV2ZWw7XG4gICAgaWYgKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSBobHMubGV2ZWxzLmxlbmd0aCAtIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25leHRBdXRvTGV2ZWwgIT09IC0xKSB7XG4gICAgICB2YXIgbmV4dExldmVsID0gTWF0aC5taW4odGhpcy5fbmV4dEF1dG9MZXZlbCxtYXhBdXRvTGV2ZWwpO1xuICAgICAgaWYgKG5leHRMZXZlbCA9PT0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV4dExldmVsO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IgKGkgPSAwOyBpIDw9IG1heEF1dG9MZXZlbDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZiAoaSA8PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjggKiBsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43ICogbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYgKGFkanVzdGVkYncgPCBobHMubGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIGkgLSAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGkgLSAxO1xuICB9XG5cbiAgc2V0IG5leHRBdXRvTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBYnJDb250cm9sbGVyO1xuXG4iLCIvKlxuICogQnVmZmVyIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cblxuY2xhc3MgQnVmZmVyQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgRXZlbnQuQlVGRkVSX1JFU0VULFxuICAgICAgRXZlbnQuQlVGRkVSX0FQUEVORElORyxcbiAgICAgIEV2ZW50LkJVRkZFUl9DT0RFQ1MsXG4gICAgICBFdmVudC5CVUZGRVJfRU9TLFxuICAgICAgRXZlbnQuQlVGRkVSX0ZMVVNISU5HKTtcblxuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU0JVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25TQlVwZGF0ZUVycm9yLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2UgPSBuZXcgTWVkaWFTb3VyY2UoKTtcbiAgICAvL01lZGlhIFNvdXJjZSBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbk1lZGlhU291cmNlT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTWVkaWFTb3VyY2VFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2MgPSB0aGlzLm9uTWVkaWFTb3VyY2VDbG9zZS5iaW5kKHRoaXMpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgbWVkaWEuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYgKG1zKSB7XG4gICAgICBpZiAobXMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gZW5kT2ZTdHJlYW0gY291bGQgdHJpZ2dlciBleGNlcHRpb24gaWYgYW55IHNvdXJjZWJ1ZmZlciBpcyBpbiB1cGRhdGluZyBzdGF0ZVxuICAgICAgICAgIC8vIHdlIGRvbid0IHJlYWxseSBjYXJlIGFib3V0IGNoZWNraW5nIHNvdXJjZWJ1ZmZlciBzdGF0ZSBoZXJlLFxuICAgICAgICAgIC8vIGFzIHdlIGFyZSBhbnl3YXkgZGV0YWNoaW5nIHRoZSBNZWRpYVNvdXJjZVxuICAgICAgICAgIC8vIGxldCdzIGp1c3QgYXZvaWQgdGhpcyBleGNlcHRpb24gdG8gcHJvcGFnYXRlXG4gICAgICAgICAgbXMuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIud2Fybihgb25NZWRpYURldGFjaGluZzoke2Vyci5tZXNzYWdlfSB3aGlsZSBjYWxsaW5nIGVuZE9mU3RyZWFtYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB0aGlzLm1lZGlhLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYS5yZW1vdmVBdHRyaWJ1dGUoJ3NyYycpO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IG51bGw7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hFRCk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hFRCwgeyBtZWRpYSA6IHRoaXMubWVkaWEgfSk7XG4gICAgLy8gb25jZSByZWNlaXZlZCwgZG9uJ3QgbGlzdGVuIGFueW1vcmUgdG8gc291cmNlb3BlbiBldmVudFxuICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIC8vIGlmIGFueSBidWZmZXIgY29kZWNzIHBlbmRpbmcsIHRyZWF0IGl0IGhlcmUuXG4gICAgdmFyIHBlbmRpbmdUcmFja3MgPSB0aGlzLnBlbmRpbmdUcmFja3M7XG4gICAgaWYgKHBlbmRpbmdUcmFja3MpIHtcbiAgICAgIHRoaXMub25CdWZmZXJDb2RlY3MocGVuZGluZ1RyYWNrcyk7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSBudWxsO1xuICAgICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cblxuXG4gIG9uU0JVcGRhdGVFbmQoKSB7XG5cbiAgICBpZiAodGhpcy5fbmVlZHNGbHVzaCkge1xuICAgICAgdGhpcy5kb0ZsdXNoKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25lZWRzRW9zKSB7XG4gICAgICB0aGlzLm9uQnVmZmVyRW9zKCk7XG4gICAgfVxuXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ERUQpO1xuXG4gICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICB9XG5cbiAgb25TQlVwZGF0ZUVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICAvLyBhY2NvcmRpbmcgdG8gaHR0cDovL3d3dy53My5vcmcvVFIvbWVkaWEtc291cmNlLyNzb3VyY2VidWZmZXItYXBwZW5kLWVycm9yXG4gICAgLy8gdGhpcyBlcnJvciBtaWdodCBub3QgYWx3YXlzIGJlIGZhdGFsIChpdCBpcyBmYXRhbCBpZiBkZWNvZGUgZXJyb3IgaXMgc2V0LCBpbiB0aGF0IGNhc2VcbiAgICAvLyBpdCB3aWxsIGJlIGZvbGxvd2VkIGJ5IGEgbWVkaWFFbGVtZW50IGVycm9yIC4uLilcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiBmYWxzZX0pO1xuICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gZG8gbW9yZSB0aGFuIHRoYXQsIGFzIGFjY29yZGluIHRvIHRoZSBzcGVjLCB1cGRhdGVlbmQgd2lsbCBiZSBmaXJlZCBqdXN0IGFmdGVyXG4gIH1cblxuICBvbkJ1ZmZlclJlc2V0KCkge1xuICAgIHZhciBzb3VyY2VCdWZmZXIgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYik7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5hcHBlbmRlZCA9IDA7XG4gIH1cblxuICBvbkJ1ZmZlckNvZGVjcyh0cmFja3MpIHtcbiAgICB2YXIgc2IsdHJhY2tOYW1lLHRyYWNrLCBjb2RlYywgbWltZVR5cGU7XG5cbiAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IHRyYWNrcztcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB2YXIgc291cmNlQnVmZmVyID0ge30sIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgIGZvciAodHJhY2tOYW1lIGluIHRyYWNrcykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICAvLyB1c2UgbGV2ZWxDb2RlYyBhcyBmaXJzdCBwcmlvcml0eVxuICAgICAgICBjb2RlYyA9IHRyYWNrLmxldmVsQ29kZWMgfHwgdHJhY2suY29kZWM7XG4gICAgICAgIG1pbWVUeXBlID0gYCR7dHJhY2suY29udGFpbmVyfTtjb2RlY3M9JHtjb2RlY31gO1xuICAgICAgICBsb2dnZXIubG9nKGBjcmVhdGluZyBzb3VyY2VCdWZmZXIgd2l0aCBtaW1lVHlwZToke21pbWVUeXBlfWApO1xuICAgICAgICBzYiA9IHNvdXJjZUJ1ZmZlclt0cmFja05hbWVdID0gbWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKG1pbWVUeXBlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBzb3VyY2VCdWZmZXI7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRpbmcoZGF0YSkge1xuICAgIGlmICghdGhpcy5zZWdtZW50cykge1xuICAgICAgdGhpcy5zZWdtZW50cyA9IFsgZGF0YSBdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlZ21lbnRzLnB1c2goZGF0YSk7XG4gICAgfVxuICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kRmFpbChkYXRhKSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtkYXRhLmV2ZW50fWApO1xuICAgIC8vIGFjY29yZGluZyB0byBodHRwOi8vd3d3LnczLm9yZy9UUi9tZWRpYS1zb3VyY2UvI3NvdXJjZWJ1ZmZlci1hcHBlbmQtZXJyb3JcbiAgICAvLyB0aGlzIGVycm9yIG1pZ2h0IG5vdCBhbHdheXMgYmUgZmF0YWwgKGl0IGlzIGZhdGFsIGlmIGRlY29kZSBlcnJvciBpcyBzZXQsIGluIHRoYXQgY2FzZVxuICAgIC8vIGl0IHdpbGwgYmUgZm9sbG93ZWQgYnkgYSBtZWRpYUVsZW1lbnQgZXJyb3IgLi4uKVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fSk7XG4gIH1cblxuICBvbkJ1ZmZlckVvcygpIHtcbiAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlciwgbWVkaWFTb3VyY2UgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmICghbWVkaWFTb3VyY2UgfHwgbWVkaWFTb3VyY2UucmVhZHlTdGF0ZSAhPT0gJ29wZW4nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghKChzYi5hdWRpbyAmJiBzYi5hdWRpby51cGRhdGluZykgfHwgKHNiLnZpZGVvICYmIHNiLnZpZGVvLnVwZGF0aW5nKSkpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2FsbCBtZWRpYSBkYXRhIGF2YWlsYWJsZSwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2UgYW5kIHN0b3AgbG9hZGluZyBmcmFnbWVudCcpO1xuICAgICAgLy9Ob3RpZnkgdGhlIG1lZGlhIGVsZW1lbnQgdGhhdCBpdCBub3cgaGFzIGFsbCBvZiB0aGUgbWVkaWEgZGF0YVxuICAgICAgbWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBvbkJ1ZmZlckZsdXNoaW5nKGRhdGEpIHtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IGRhdGEuc3RhcnRPZmZzZXQsIGVuZDogZGF0YS5lbmRPZmZzZXR9KTtcbiAgICAvLyBhdHRlbXB0IGZsdXNoIGltbWVkaWF0bHlcbiAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgdGhpcy5kb0ZsdXNoKCk7XG4gIH1cblxuICBkb0ZsdXNoKCkge1xuICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgaWYgKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpIHtcbiAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnNoaWZ0KCk7XG4gICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX25lZWRzRmx1c2ggPSB0cnVlO1xuICAgICAgICAvLyBhdm9pZCBsb29waW5nLCB3YWl0IGZvciBTQiB1cGRhdGUgZW5kIHRvIHJldHJpZ2dlciBhIGZsdXNoXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZFxuICAgICAgdGhpcy5fbmVlZHNGbHVzaCA9IGZhbHNlO1xuXG4gICAgICAvLyBsZXQncyByZWNvbXB1dGUgdGhpcy5hcHBlbmRlZCwgd2hpY2ggaXMgdXNlZCB0byBhdm9pZCBmbHVzaCBsb29waW5nXG4gICAgICB2YXIgYXBwZW5kZWQgPSAwO1xuICAgICAgdmFyIHNvdXJjZUJ1ZmZlciA9IHRoaXMuc291cmNlQnVmZmVyO1xuICAgICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIGFwcGVuZGVkICs9IHNvdXJjZUJ1ZmZlclt0eXBlXS5idWZmZXJlZC5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuYXBwZW5kZWQgPSBhcHBlbmRlZDtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNIRUQpO1xuICAgIH1cbiAgfVxuXG4gIGRvQXBwZW5kaW5nKCkge1xuICAgIHZhciBobHMgPSB0aGlzLmhscywgc291cmNlQnVmZmVyID0gdGhpcy5zb3VyY2VCdWZmZXIsIHNlZ21lbnRzID0gdGhpcy5zZWdtZW50cztcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBpZiAodGhpcy5tZWRpYS5lcnJvcikge1xuICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ3RyeWluZyB0byBhcHBlbmQgYWx0aG91Z2ggYSBtZWRpYSBlcnJvciBvY2N1cmVkLCBmbHVzaCBzZWdtZW50IGFuZCBhYm9ydCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBpZiAoc291cmNlQnVmZmVyW3R5cGVdLnVwZGF0aW5nKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiB1cGRhdGUgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHNlZ21lbnQgPSBzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9KTtcbiAgICAgICAgICBzb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS5hcHBlbmRCdWZmZXIoc2VnbWVudC5kYXRhKTtcbiAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMDtcbiAgICAgICAgICB0aGlzLmFwcGVuZGVkKys7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgLy8gaW4gY2FzZSBhbnkgZXJyb3Igb2NjdXJlZCB3aGlsZSBhcHBlbmRpbmcsIHB1dCBiYWNrIHNlZ21lbnQgaW4gc2VnbWVudHMgdGFibGVcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGVycm9yIHdoaWxlIHRyeWluZyB0byBhcHBlbmQgYnVmZmVyOiR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgc2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICB2YXIgZXZlbnQgPSB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUn07XG4gICAgICAgICAgaWYoZXJyLmNvZGUgIT09IDIyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvcikge1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LmRldGFpbHMgPSBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORF9FUlJPUjtcbiAgICAgICAgICAgIGV2ZW50LmZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICAgICAgLyogd2l0aCBVSEQgY29udGVudCwgd2UgY291bGQgZ2V0IGxvb3Agb2YgcXVvdGEgZXhjZWVkZWQgZXJyb3IgdW50aWxcbiAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvciA+IGhscy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsICR7aGxzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5fSB0aW1lcyB0byBhcHBlbmQgc2VnbWVudCBpbiBzb3VyY2VCdWZmZXJgKTtcbiAgICAgICAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IGZhbHNlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBRdW90YUV4Y2VlZGVkRXJyb3I6IGh0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1L2luZnJhc3RydWN0dXJlLmh0bWwjcXVvdGFleGNlZWRlZGVycm9yXG4gICAgICAgICAgICAvLyBsZXQncyBzdG9wIGFwcGVuZGluZyBhbnkgc2VnbWVudHMsIGFuZCByZXBvcnQgQlVGRkVSX0ZVTExfRVJST1IgZXJyb3JcbiAgICAgICAgICAgIHNlZ21lbnRzID0gW107XG4gICAgICAgICAgICBldmVudC5kZXRhaWxzID0gRXJyb3JEZXRhaWxzLkJVRkZFUl9GVUxMX0VSUk9SO1xuICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsZXZlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAgZmx1c2ggc3BlY2lmaWVkIGJ1ZmZlcmVkIHJhbmdlLFxuICAgIHJldHVybiB0cnVlIG9uY2UgcmFuZ2UgaGFzIGJlZW4gZmx1c2hlZC5cbiAgICBhcyBzb3VyY2VCdWZmZXIucmVtb3ZlKCkgaXMgYXN5bmNocm9ub3VzLCBmbHVzaEJ1ZmZlciB3aWxsIGJlIHJldHJpZ2dlcmVkIG9uIHNvdXJjZUJ1ZmZlciB1cGRhdGUgZW5kXG4gICovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsIGksIGJ1ZlN0YXJ0LCBidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmcgOiBkb24ndCB0cnkgdG8gZmx1c2ggbW9yZSB0aGFuIHRoZSBuYiBvZiBhcHBlbmRlZCBzZWdtZW50c1xuICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA8IHRoaXMuYXBwZW5kZWQgJiYgdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvciAodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgaWYgKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYnVmU3RhcnQgPSBzYi5idWZmZXJlZC5zdGFydChpKTtcbiAgICAgICAgICAgIGJ1ZkVuZCA9IHNiLmJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZmlyZWZveCBub3QgYWJsZSB0byBwcm9wZXJseSBmbHVzaCBtdWx0aXBsZSBidWZmZXJlZCByYW5nZS5cbiAgICAgICAgICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiBlbmRPZmZzZXQgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gZW5kT2Zmc2V0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IE1hdGgubWF4KGJ1ZlN0YXJ0LCBzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLCBlbmRPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc29tZXRpbWVzIHNvdXJjZWJ1ZmZlci5yZW1vdmUoKSBkb2VzIG5vdCBmbHVzaFxuICAgICAgICAgICAgICAgdGhlIGV4YWN0IGV4cGVjdGVkIHRpbWUgcmFuZ2UuXG4gICAgICAgICAgICAgICB0byBhdm9pZCByb3VuZGluZyBpc3N1ZXMvaW5maW5pdGUgbG9vcCxcbiAgICAgICAgICAgICAgIG9ubHkgZmx1c2ggYnVmZmVyIHJhbmdlIG9mIGxlbmd0aCBncmVhdGVyIHRoYW4gNTAwbXMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKE1hdGgubWluKGZsdXNoRW5kLGJ1ZkVuZCkgLSBmbHVzaFN0YXJ0ID4gMC41ICkge1xuICAgICAgICAgICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmbHVzaCAke3R5cGV9IFske2ZsdXNoU3RhcnR9LCR7Zmx1c2hFbmR9XSwgb2YgWyR7YnVmU3RhcnR9LCR7YnVmRW5kfV0sIHBvczoke3RoaXMubWVkaWEuY3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHNiLnJlbW92ZShmbHVzaFN0YXJ0LCBmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oJ2Nhbm5vdCBmbHVzaCwgc2IgdXBkYXRpbmcgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oJ2Fib3J0IGZsdXNoaW5nIHRvbyBtYW55IHJldHJpZXMnKTtcbiAgICB9XG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG4iLCIvKlxuICogY2FwIHN0cmVhbSBsZXZlbCB0byBtZWRpYSBzaXplIGRpbWVuc2lvbiBjb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5cbmNsYXNzIENhcExldmVsQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cdGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1FRElBX0FUVEFDSElORyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX1BBUlNFRCk7ICAgXG5cdH1cblx0XG5cdGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5jYXBMZXZlbFRvUGxheWVyU2l6ZSkge1xuICAgICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgICB0aGlzLmF1dG9MZXZlbENhcHBpbmcgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgICB0aGlzLnRpbWVyID0gY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblx0ICBcblx0b25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdGhpcy5tZWRpYSA9IGRhdGEubWVkaWEgaW5zdGFuY2VvZiBIVE1MVmlkZW9FbGVtZW50ID8gZGF0YS5tZWRpYSA6IG51bGw7ICBcbiAgfVxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZGF0YSkge1xuICAgIGlmICh0aGlzLmhscy5jb25maWcuY2FwTGV2ZWxUb1BsYXllclNpemUpIHtcbiAgICAgIHRoaXMuYXV0b0xldmVsQ2FwcGluZyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgICB0aGlzLmhscy5maXJzdExldmVsID0gdGhpcy5nZXRNYXhMZXZlbChkYXRhLmZpcnN0TGV2ZWwpO1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLmRldGVjdFBsYXllclNpemUuYmluZCh0aGlzKSwgMTAwMCk7XG4gICAgICB0aGlzLmRldGVjdFBsYXllclNpemUoKTtcbiAgICB9XG4gIH1cbiAgXG4gIGRldGVjdFBsYXllclNpemUoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIGxldCBsZXZlbHNMZW5ndGggPSB0aGlzLmxldmVscyA/IHRoaXMubGV2ZWxzLmxlbmd0aCA6IDA7XG4gICAgICBpZiAobGV2ZWxzTGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmcgPSB0aGlzLmdldE1heExldmVsKGxldmVsc0xlbmd0aCAtIDEpO1xuICAgICAgICBpZiAodGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZyA+IHRoaXMuYXV0b0xldmVsQ2FwcGluZykge1xuICAgICAgICAgIC8vIGlmIGF1dG8gbGV2ZWwgY2FwcGluZyBoYXMgYSBoaWdoZXIgdmFsdWUgZm9yIHRoZSBwcmV2aW91cyBvbmUsIGZsdXNoIHRoZSBidWZmZXIgdXNpbmcgbmV4dExldmVsU3dpdGNoXG4gICAgICAgICAgLy8gdXN1YWxseSBoYXBwZW4gd2hlbiB0aGUgdXNlciBnbyB0byB0aGUgZnVsbHNjcmVlbiBtb2RlLlxuICAgICAgICAgIHRoaXMuaGxzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hdXRvTGV2ZWxDYXBwaW5nID0gdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZzsgICAgICAgIFxuICAgICAgfSAgXG4gICAgfVxuICB9XG4gIFxuICAvKlxuICAqIHJldHVybnMgbGV2ZWwgc2hvdWxkIGJlIHRoZSBvbmUgd2l0aCB0aGUgZGltZW5zaW9ucyBlcXVhbCBvciBncmVhdGVyIHRoYW4gdGhlIG1lZGlhIChwbGF5ZXIpIGRpbWVuc2lvbnMgKHNvIHRoZSB2aWRlbyB3aWxsIGJlIGRvd25zY2FsZWQpXG4gICovXG4gIGdldE1heExldmVsKGNhcExldmVsSW5kZXgpIHtcbiAgICBsZXQgcmVzdWx0LFxuICAgICAgICBpLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAgbVdpZHRoID0gdGhpcy5tZWRpYVdpZHRoLFxuICAgICAgICBtSGVpZ2h0ID0gdGhpcy5tZWRpYUhlaWdodCxcbiAgICAgICAgbFdpZHRoID0gMCxcbiAgICAgICAgbEhlaWdodCA9IDA7XG4gICAgICAgIFxuICAgIGZvciAoaSA9IDA7IGkgPD0gY2FwTGV2ZWxJbmRleDsgaSsrKSB7XG4gICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW2ldO1xuICAgICAgcmVzdWx0ID0gaTtcbiAgICAgIGxXaWR0aCA9IGxldmVsLndpZHRoO1xuICAgICAgbEhlaWdodCA9IGxldmVsLmhlaWdodDtcbiAgICAgIGlmIChtV2lkdGggPD0gbFdpZHRoIHx8IG1IZWlnaHQgPD0gbEhlaWdodCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9ICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIFxuICBnZXQgY29udGVudFNjYWxlRmFjdG9yKCkge1xuICAgIGxldCBwaXhlbFJhdGlvID0gMTtcbiAgICB0cnkge1xuICAgICAgcGl4ZWxSYXRpbyA9ICB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgICB9IGNhdGNoKGUpIHt9XG4gICAgcmV0dXJuIHBpeGVsUmF0aW87XG4gIH1cbiAgXG4gIGdldCBtZWRpYVdpZHRoKCkge1xuICAgIGxldCB3aWR0aDtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgd2lkdGggPSB0aGlzLm1lZGlhLndpZHRoIHx8IHRoaXMubWVkaWEuY2xpZW50V2lkdGggfHwgdGhpcy5tZWRpYS5vZmZzZXRXaWR0aDtcbiAgICAgIHdpZHRoICo9IHRoaXMuY29udGVudFNjYWxlRmFjdG9yO1xuICAgIH1cbiAgICByZXR1cm4gd2lkdGg7XG4gIH1cbiAgXG4gIGdldCBtZWRpYUhlaWdodCgpIHtcbiAgICBsZXQgaGVpZ2h0O1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICBoZWlnaHQgPSB0aGlzLm1lZGlhLmhlaWdodCB8fCB0aGlzLm1lZGlhLmNsaWVudEhlaWdodCB8fCB0aGlzLm1lZGlhLm9mZnNldEhlaWdodDtcbiAgICAgIGhlaWdodCAqPSB0aGlzLmNvbnRlbnRTY2FsZUZhY3RvcjsgXG4gICAgfVxuICAgIHJldHVybiBoZWlnaHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ2FwTGV2ZWxDb250cm9sbGVyOyIsIi8qXG4gKiBMZXZlbCBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBMZXZlbENvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgIEV2ZW50LkVSUk9SKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgc3RhcnRMb2FkKCkge1xuICAgIHRoaXMuY2FubG9hZCA9IHRydWU7XG4gICAgLy8gc3BlZWQgdXAgbGl2ZSBwbGF5bGlzdCByZWZyZXNoIGlmIHRpbWVyIGV4aXN0c1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBzdG9wTG9hZCgpIHtcbiAgICB0aGlzLmNhbmxvYWQgPSBmYWxzZTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZGF0YSkge1xuICAgIHZhciBsZXZlbHMwID0gW10sIGxldmVscyA9IFtdLCBiaXRyYXRlU3RhcnQsIGksIGJpdHJhdGVTZXQgPSB7fSwgdmlkZW9Db2RlY0ZvdW5kID0gZmFsc2UsIGF1ZGlvQ29kZWNGb3VuZCA9IGZhbHNlLCBobHMgPSB0aGlzLmhscztcblxuICAgIC8vIHJlZ3JvdXAgcmVkdW5kYW50IGxldmVsIHRvZ2V0aGVyXG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgIHZpZGVvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZihsZXZlbC5hdWRpb0NvZGVjKSB7XG4gICAgICAgIGF1ZGlvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICB2YXIgcmVkdW5kYW50TGV2ZWxJZCA9IGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV07XG4gICAgICBpZiAocmVkdW5kYW50TGV2ZWxJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSBsZXZlbHMwLmxlbmd0aDtcbiAgICAgICAgbGV2ZWwudXJsID0gW2xldmVsLnVybF07XG4gICAgICAgIGxldmVsLnVybElkID0gMDtcbiAgICAgICAgbGV2ZWxzMC5wdXNoKGxldmVsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVsczBbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHJlbW92ZSBhdWRpby1vbmx5IGxldmVsIGlmIHdlIGFsc28gaGF2ZSBsZXZlbHMgd2l0aCBhdWRpbyt2aWRlbyBjb2RlY3Mgc2lnbmFsbGVkXG4gICAgaWYodmlkZW9Db2RlY0ZvdW5kICYmIGF1ZGlvQ29kZWNGb3VuZCkge1xuICAgICAgbGV2ZWxzMC5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldmVscyA9IGxldmVsczA7XG4gICAgfVxuXG4gICAgLy8gb25seSBrZWVwIGxldmVsIHdpdGggc3VwcG9ydGVkIGF1ZGlvL3ZpZGVvIGNvZGVjc1xuICAgIGxldmVscyA9IGxldmVscy5maWx0ZXIoZnVuY3Rpb24obGV2ZWwpIHtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZEF1ZGlvID0gZnVuY3Rpb24oY29kZWMpIHsgcmV0dXJuIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZChgYXVkaW8vbXA0O2NvZGVjcz0ke2NvZGVjfWApO307XG4gICAgICB2YXIgY2hlY2tTdXBwb3J0ZWRWaWRlbyA9IGZ1bmN0aW9uKGNvZGVjKSB7IHJldHVybiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoYHZpZGVvL21wNDtjb2RlY3M9JHtjb2RlY31gKTt9O1xuICAgICAgdmFyIGF1ZGlvQ29kZWMgPSBsZXZlbC5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gbGV2ZWwudmlkZW9Db2RlYztcblxuICAgICAgcmV0dXJuICghYXVkaW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZEF1ZGlvKGF1ZGlvQ29kZWMpKSAmJlxuICAgICAgICAgICAgICghdmlkZW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZFZpZGVvKHZpZGVvQ29kZWMpKTtcbiAgICB9KTtcblxuICAgIGlmKGxldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0YXJ0IGJpdHJhdGUgaXMgdGhlIGZpcnN0IGJpdHJhdGUgb2YgdGhlIG1hbmlmZXN0XG4gICAgICBiaXRyYXRlU3RhcnQgPSBsZXZlbHNbMF0uYml0cmF0ZTtcbiAgICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgICAgbGV2ZWxzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEuYml0cmF0ZSAtIGIuYml0cmF0ZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fbGV2ZWxzID0gbGV2ZWxzO1xuICAgICAgLy8gZmluZCBpbmRleCBvZiBmaXJzdCBsZXZlbCBpbiBzb3J0ZWQgbGV2ZWxzXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChsZXZlbHNbaV0uYml0cmF0ZSA9PT0gYml0cmF0ZVN0YXJ0KSB7XG4gICAgICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IGk7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgbG9hZGVkLCR7bGV2ZWxzLmxlbmd0aH0gbGV2ZWwocykgZm91bmQsIGZpcnN0IGJpdHJhdGU6JHtiaXRyYXRlU3RhcnR9YCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwge2xldmVsczogdGhpcy5fbGV2ZWxzLCBmaXJzdExldmVsOiB0aGlzLl9maXJzdExldmVsLCBzdGF0czogZGF0YS5zdGF0c30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9JTkNPTVBBVElCTEVfQ09ERUNTX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiBobHMudXJsLCByZWFzb246ICdubyBsZXZlbCB3aXRoIGNvbXBhdGlibGUgY29kZWNzIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYgKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCB8fCB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdLmRldGFpbHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zZXRMZXZlbEludGVybmFsKG5ld0xldmVsKTtcbiAgICB9XG4gIH1cblxuIHNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpIHtcbiAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICBpZiAobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMuX2xldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgIGxvZ2dlci5sb2coYHN3aXRjaGluZyB0byBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9TV0lUQ0gsIHtsZXZlbDogbmV3TGV2ZWx9KTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tuZXdMZXZlbF07XG4gICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICBpZiAobGV2ZWwuZGV0YWlscyA9PT0gdW5kZWZpbmVkIHx8IGxldmVsLmRldGFpbHMubGl2ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgb3IgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIChyZSlsb2FkIGl0XG4gICAgICAgIGxvZ2dlci5sb2coYChyZSlsb2FkaW5nIHBsYXlsaXN0IGZvciBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICB2YXIgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbmV3TGV2ZWwsIGlkOiB1cmxJZH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuT1RIRVJfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5MRVZFTF9TV0lUQ0hfRVJST1IsIGxldmVsOiBuZXdMZXZlbCwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICB9XG4gfVxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIGlmIChuZXdMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB9XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgaWYoZGF0YS5mYXRhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkZXRhaWxzID0gZGF0YS5kZXRhaWxzLCBobHMgPSB0aGlzLmhscywgbGV2ZWxJZCwgbGV2ZWw7XG4gICAgLy8gdHJ5IHRvIHJlY292ZXIgbm90IGZhdGFsIGVycm9yc1xuICAgIHN3aXRjaChkZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAgbGV2ZWxJZCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgICAgbGV2ZWxJZCA9IGRhdGEubGV2ZWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8qIHRyeSB0byBzd2l0Y2ggdG8gYSByZWR1bmRhbnQgc3RyZWFtIGlmIGFueSBhdmFpbGFibGUuXG4gICAgICogaWYgbm8gcmVkdW5kYW50IHN0cmVhbSBhdmFpbGFibGUsIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAoaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCAwKVxuICAgICAqIG90aGVyd2lzZSwgd2UgY2Fubm90IHJlY292ZXIgdGhpcyBuZXR3b3JrIGVycm9yIC4uLlxuICAgICAqIGRvbid0IHJhaXNlIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXMgZmF0YWwsIGFzIGl0IGlzIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICovXG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZiAobGV2ZWwudXJsSWQgPCAobGV2ZWwudXJsLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZiAocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICBobHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsID0gMDtcbiAgICAgICAgfSBlbHNlIGlmKGxldmVsICYmIGxldmVsLmRldGFpbHMgJiYgbGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBvbiBsaXZlIHN0cmVhbSwgZGlzY2FyZGApO1xuICAgICAgICAvLyBGUkFHX0xPQURfRVJST1IgYW5kIEZSQUdfTE9BRF9USU1FT1VUIGFyZSBoYW5kbGVkIGJ5IG1lZGlhQ29udHJvbGxlclxuICAgICAgICB9IGVsc2UgaWYgKGRldGFpbHMgIT09IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IgJiYgZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBjYW5ub3QgcmVjb3ZlciAke2RldGFpbHN9IGVycm9yYCk7XG4gICAgICAgICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZiAoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwICogZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gICAgaWYgKCFkYXRhLmRldGFpbHMubGl2ZSAmJiB0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBwbGF5bGlzdCBpcyBub3QgbGl2ZSBhbmQgdGltZXIgaXMgYXJtZWQgOiBzdG9wcGluZyBpdFxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdmFyIGxldmVsSWQgPSB0aGlzLl9sZXZlbDtcbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkICYmIHRoaXMuY2FubG9hZCkge1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdLCB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbGV2ZWxJZCwgaWQ6IHVybElkfSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX21hbnVhbExldmVsICE9PSAtMSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgIHJldHVybiB0aGlzLmhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IG5leHRMb2FkTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5sZXZlbCA9IG5leHRMZXZlbDtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgPT09IC0xKSB7XG4gICAgICB0aGlzLmhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWwgPSBuZXh0TGV2ZWw7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFN0cmVhbSBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRGVtdXhlciBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IEJpbmFyeVNlYXJjaCBmcm9tICcuLi91dGlscy9iaW5hcnktc2VhcmNoJztcbmltcG9ydCBCdWZmZXJIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2J1ZmZlci1oZWxwZXInO1xuaW1wb3J0IExldmVsSGVscGVyIGZyb20gJy4uL2hlbHBlci9sZXZlbC1oZWxwZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNvbnN0IFN0YXRlID0ge1xuICBTVE9QUEVEIDogJ1NUT1BQRUQnLFxuICBTVEFSVElORyA6ICdTVEFSVElORycsXG4gIElETEUgOiAnSURMRScsXG4gIFBBVVNFRCA6ICdQQVVTRUQnLFxuICBLRVlfTE9BRElORyA6ICdLRVlfTE9BRElORycsXG4gIEZSQUdfTE9BRElORyA6ICdGUkFHX0xPQURJTkcnLFxuICBGUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWSA6ICdGUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWScsXG4gIFdBSVRJTkdfTEVWRUwgOiAnV0FJVElOR19MRVZFTCcsXG4gIFBBUlNJTkcgOiAnUEFSU0lORycsXG4gIFBBUlNFRCA6ICdQQVJTRUQnLFxuICBFTkRFRCA6ICdFTkRFRCcsXG4gIEVSUk9SIDogJ0VSUk9SJ1xufTtcblxuY2xhc3MgU3RyZWFtQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNIRUQsXG4gICAgICBFdmVudC5NRURJQV9ERVRBQ0hJTkcsXG4gICAgICBFdmVudC5NQU5JRkVTVF9MT0FESU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuS0VZX0xPQURFRCxcbiAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxcbiAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLFxuICAgICAgRXZlbnQuRlJBR19QQVJTRUQsXG4gICAgICBFdmVudC5FUlJPUixcbiAgICAgIEV2ZW50LkJVRkZFUl9BUFBFTkRFRCxcbiAgICAgIEV2ZW50LkJVRkZFUl9GTFVTSEVEKTtcblxuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICB0aGlzLmF1ZGlvQ29kZWNTd2FwID0gZmFsc2U7XG4gICAgdGhpcy50aWNrcyA9IDA7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdG9wTG9hZCgpO1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICB9XG5cbiAgc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb249MCkge1xuICAgIGlmICh0aGlzLmxldmVscykge1xuICAgICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSwgbGFzdEN1cnJlbnRUaW1lID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICB0aGlzLnN0b3BMb2FkKCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcih0aGlzLmhscyk7XG4gICAgICBpZiAoIXRoaXMudGltZXIpIHtcbiAgICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgICAgfVxuICAgICAgdGhpcy5sZXZlbCA9IC0xO1xuICAgICAgdGhpcy5mcmFnTG9hZEVycm9yID0gMDtcbiAgICAgIGlmIChtZWRpYSAmJiBsYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgbG9nZ2VyLmxvZyhgY29uZmlndXJlIHN0YXJ0UG9zaXRpb24gQCR7bGFzdEN1cnJlbnRUaW1lfWApO1xuICAgICAgICBpZiAoIXRoaXMubGFzdFBhdXNlZCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3Jlc3VtaW5nIHZpZGVvJyk7XG4gICAgICAgICAgbWVkaWEucGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb24gPyB0aGlzLnN0YXJ0UG9zaXRpb24gOiBzdGFydFBvc2l0aW9uO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RBUlRJTkc7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgbWFuaWZlc3Qgbm90IHBhcnNlZCB5ZXQnKTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICAgIH1cbiAgfVxuXG4gIHN0b3BMb2FkKCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZykge1xuICAgICAgaWYgKGZyYWcubG9hZGVyKSB7XG4gICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgIGlmICh0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RPUFBFRDtcbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdGhpcy50aWNrcysrO1xuICAgIGlmICh0aGlzLnRpY2tzID09PSAxKSB7XG4gICAgICB0aGlzLmRvVGljaygpO1xuICAgICAgaWYgKHRoaXMudGlja3MgPiAxKSB7XG4gICAgICAgIHNldFRpbWVvdXQodGhpcy50aWNrLCAxKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGlja3MgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGRvVGljaygpIHtcbiAgICB2YXIgcG9zLCBsZXZlbCwgbGV2ZWxEZXRhaWxzLCBobHMgPSB0aGlzLmhscywgY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICAvL2xvZ2dlci5sb2codGhpcy5zdGF0ZSk7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU3RhdGUuRVJST1I6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gZXJyb3Igc3RhdGUgdG8gYXZvaWQgYnJlYWtpbmcgZnVydGhlciAuLi5cbiAgICAgIGNhc2UgU3RhdGUuUEFVU0VEOlxuICAgICAgICAvL2Rvbid0IGRvIGFueXRoaW5nIGluIHBhdXNlZCBzdGF0ZSBlaXRoZXIgLi4uXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5TVEFSVElORzpcbiAgICAgICAgLy8gZGV0ZXJtaW5lIGxvYWQgbGV2ZWxcbiAgICAgICAgdGhpcy5zdGFydExldmVsID0gaGxzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdCaXRyYXRlVGVzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBzdGFydCBsZXZlbCBsb2FkXG4gICAgICAgIHRoaXMubGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLldBSVRJTkdfTEVWRUw7XG4gICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLklETEU6XG4gICAgICAgIC8vIGlmIHZpZGVvIG5vdCBhdHRhY2hlZCBBTkRcbiAgICAgICAgLy8gc3RhcnQgZnJhZ21lbnQgYWxyZWFkeSByZXF1ZXN0ZWQgT1Igc3RhcnQgZnJhZyBwcmVmZXRjaCBkaXNhYmxlXG4gICAgICAgIC8vIGV4aXQgbG9vcFxuICAgICAgICAvLyA9PiBpZiBtZWRpYSBub3QgYXR0YWNoZWQgYnV0IHN0YXJ0IGZyYWcgcHJlZmV0Y2ggaXMgZW5hYmxlZCBhbmQgc3RhcnQgZnJhZyBub3QgcmVxdWVzdGVkIHlldCwgd2Ugd2lsbCBub3QgZXhpdCBsb29wXG4gICAgICAgIGlmICghdGhpcy5tZWRpYSAmJlxuICAgICAgICAgICh0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCB8fCAhY29uZmlnLnN0YXJ0RnJhZ1ByZWZldGNoKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYgKHRoaXMubG9hZGVkbWV0YWRhdGEpIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvcyA9IHRoaXMubmV4dExvYWRQb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBsb2FkIGxldmVsXG4gICAgICAgIGlmICh0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBsZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3ZSBhcmUgbm90IGF0IHBsYXliYWNrIHN0YXJ0LCBnZXQgbmV4dCBsb2FkIGxldmVsIGZyb20gbGV2ZWwgQ29udHJvbGxlclxuICAgICAgICAgIGxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWw7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSBCdWZmZXJIZWxwZXIuYnVmZmVySW5mbyh0aGlzLm1lZGlhLHBvcyxjb25maWcubWF4QnVmZmVySG9sZSksXG4gICAgICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJJbmZvLmxlbixcbiAgICAgICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLFxuICAgICAgICAgICAgZnJhZ1ByZXZpb3VzID0gdGhpcy5mcmFnUHJldmlvdXMsXG4gICAgICAgICAgICBtYXhCdWZMZW47XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYgKCh0aGlzLmxldmVsc1tsZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1heCg4ICogY29uZmlnLm1heEJ1ZmZlclNpemUgLyB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSwgY29uZmlnLm1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5taW4obWF4QnVmTGVuLCBjb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBjb25maWcubWF4QnVmZmVyTGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGJ1ZmZlciBsZW5ndGggaXMgbGVzcyB0aGFuIG1heEJ1ZkxlbiB0cnkgdG8gbG9hZCBhIG5ldyBmcmFnbWVudFxuICAgICAgICBpZiAoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgLy8gc2V0IG5leHQgbG9hZCBsZXZlbCA6IHRoaXMgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZCBpZiBuZWVkZWRcbiAgICAgICAgICBobHMubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICAgICAgICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICBsZXZlbERldGFpbHMgPSB0aGlzLmxldmVsc1tsZXZlbF0uZGV0YWlscztcbiAgICAgICAgICAvLyBpZiBsZXZlbCBpbmZvIG5vdCByZXRyaWV2ZWQgeWV0LCBzd2l0Y2ggc3RhdGUgYW5kIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIGVuc3VyZSB0aGF0IG5ldyBwbGF5bGlzdCBoYXMgYmVlbiByZWZyZXNoZWQgdG8gYXZvaWQgbG9hZGluZy90cnkgdG8gbG9hZFxuICAgICAgICAgIC8vIGEgdXNlbGVzcyBhbmQgb3V0ZGF0ZWQgZnJhZ21lbnQgKHRoYXQgbWlnaHQgZXZlbiBpbnRyb2R1Y2UgbG9hZCBlcnJvciBpZiBpdCBpcyBhbHJlYWR5IG91dCBvZiB0aGUgbGl2ZSBwbGF5bGlzdClcbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcgfHwgbGV2ZWxEZXRhaWxzLmxpdmUgJiYgdGhpcy5sZXZlbExhc3RMb2FkZWQgIT09IGxldmVsKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBmaW5kIGZyYWdtZW50IGluZGV4LCBjb250aWd1b3VzIHdpdGggZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAgIGxldCBmcmFnbWVudHMgPSBsZXZlbERldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICAgICAgICBmcmFnTGVuID0gZnJhZ21lbnRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgc3RhcnQgPSBmcmFnbWVudHNbMF0uc3RhcnQsXG4gICAgICAgICAgICAgIGVuZCA9IGZyYWdtZW50c1tmcmFnTGVuLTFdLnN0YXJ0ICsgZnJhZ21lbnRzW2ZyYWdMZW4tMV0uZHVyYXRpb24sXG4gICAgICAgICAgICAgIGZyYWc7XG5cbiAgICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICBpZiAobGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHJlcXVlc3RlZCBwb3NpdGlvbiBpcyB3aXRoaW4gc2Vla2FibGUgYm91bmRhcmllcyA6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coYHN0YXJ0L3Bvcy9idWZFbmQvc2Vla2luZzoke3N0YXJ0LnRvRml4ZWQoMyl9LyR7cG9zLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9LyR7dGhpcy5tZWRpYS5zZWVraW5nfWApO1xuICAgICAgICAgICAgbGV0IG1heExhdGVuY3kgPSBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb24gOiBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50KmxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbjtcblxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IE1hdGgubWF4KHN0YXJ0LCBlbmQgLSBtYXhMYXRlbmN5KSkge1xuICAgICAgICAgICAgICAgIGxldCB0YXJnZXRMYXRlbmN5ID0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uIDogY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAqIGxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbjtcbiAgICAgICAgICAgICAgICB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkID0gc3RhcnQgKyBNYXRoLm1heCgwLCBsZXZlbERldGFpbHMudG90YWxkdXJhdGlvbiAtIHRhcmdldExhdGVuY3kpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIHRvbyBmYXIgZnJvbSB0aGUgZW5kIG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyQnVmZmVyZWQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkICYmICFsZXZlbERldGFpbHMuUFRTS25vd24pIHtcbiAgICAgICAgICAgICAgLyogd2UgYXJlIHN3aXRjaGluZyBsZXZlbCBvbiBsaXZlIHBsYXlsaXN0LCBidXQgd2UgZG9uJ3QgaGF2ZSBhbnkgUFRTIGluZm8gZm9yIHRoYXQgcXVhbGl0eSBsZXZlbCAuLi5cbiAgICAgICAgICAgICAgICAgdHJ5IHRvIGxvYWQgZnJhZyBtYXRjaGluZyB3aXRoIG5leHQgU04uXG4gICAgICAgICAgICAgICAgIGV2ZW4gaWYgU04gYXJlIG5vdCBzeW5jaHJvbml6ZWQgYmV0d2VlbiBwbGF5bGlzdHMsIGxvYWRpbmcgdGhpcyBmcmFnIHdpbGwgaGVscCB1c1xuICAgICAgICAgICAgICAgICBjb21wdXRlIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZSBhZnRlciBpbiBjYXNlIGl0IHdhcyBub3QgdGhlIHJpZ2h0IGNvbnNlY3V0aXZlIG9uZSAqL1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldFNOID0gZnJhZ1ByZXZpb3VzLnNuICsgMTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U04gPj0gbGV2ZWxEZXRhaWxzLnN0YXJ0U04gJiYgdGFyZ2V0U04gPD0gbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW3RhcmdldFNOIC0gbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCBsb2FkIGZyYWcgd2l0aCBuZXh0IFNOOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgICAgIC8qIHdlIGhhdmUgbm8gaWRlYSBhYm91dCB3aGljaCBmcmFnbWVudCBzaG91bGQgYmUgbG9hZGVkLlxuICAgICAgICAgICAgICAgICAgIHNvIGxldCdzIGxvYWQgbWlkIGZyYWdtZW50LiBpdCB3aWxsIGhlbHAgY29tcHV0aW5nIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tNYXRoLm1pbihmcmFnTGVuIC0gMSwgTWF0aC5yb3VuZChmcmFnTGVuIC8gMikpXTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIHVua25vd24sIGxvYWQgbWlkZGxlIGZyYWcgOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVm9EIHBsYXlsaXN0OiBpZiBidWZmZXJFbmQgYmVmb3JlIHN0YXJ0IG9mIHBsYXlsaXN0LCBsb2FkIGZpcnN0IGZyYWdtZW50XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgc3RhcnQpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICBsZXQgZm91bmRGcmFnO1xuICAgICAgICAgICAgbGV0IG1heEZyYWdMb29rVXBUb2xlcmFuY2UgPSBjb25maWcubWF4RnJhZ0xvb2tVcFRvbGVyYW5jZTtcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBlbmQpIHtcbiAgICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA+IGVuZCAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2UpIHtcbiAgICAgICAgICAgICAgICBtYXhGcmFnTG9va1VwVG9sZXJhbmNlID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBCaW5hcnlTZWFyY2guc2VhcmNoKGZyYWdtZW50cywgKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5IC0gY29uZmlnLm1heEZyYWdMb29rVXBUb2xlcmFuY2VcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIHRvIGNvcGUgd2l0aCBzaXR1YXRpb25zIGxpa2VcbiAgICAgICAgICAgICAgICAvLyBidWZmZXJFbmQgPSA5Ljk5MVxuICAgICAgICAgICAgICAgIC8vIGZyYWdbw5hdIDogWzAsMTBdXG4gICAgICAgICAgICAgICAgLy8gZnJhZ1sxXSA6IFsxMCwyMF1cbiAgICAgICAgICAgICAgICAvLyBidWZmZXJFbmQgaXMgd2l0aGluIGZyYWdbMF0gcmFuZ2UgLi4uIGFsdGhvdWdoIHdoYXQgd2UgYXJlIGV4cGVjdGluZyBpcyB0byByZXR1cm4gZnJhZ1sxXSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICBmcmFnIHN0YXJ0ICAgICAgICAgICAgICAgZnJhZyBzdGFydCtkdXJhdGlvblxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgIHwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgIDwtLS0+ICAgICAgICAgICAgICAgICAgICAgICAgIDwtLS0+XG4gICAgICAgICAgICAgICAgICAgIC8vICAuLi4tLS0tLS0tLT48LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0+PC0tLS0tLS0tLS4uLi5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJldmlvdXMgZnJhZyAgICAgICAgIG1hdGNoaW5nIGZyYWdtZW50ICAgICAgICAgbmV4dCBmcmFnXG4gICAgICAgICAgICAgICAgICAgIC8vICByZXR1cm4gLTEgICAgICAgICAgICAgcmV0dXJuIDAgICAgICAgICAgICAgICAgIHJldHVybiAxXG4gICAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBsZXZlbC9zbi9zdGFydC9lbmQvYnVmRW5kOiR7bGV2ZWx9LyR7Y2FuZGlkYXRlLnNufS8ke2NhbmRpZGF0ZS5zdGFydH0vJHsoY2FuZGlkYXRlLnN0YXJ0K2NhbmRpZGF0ZS5kdXJhdGlvbil9LyR7YnVmZmVyRW5kfWApO1xuICAgICAgICAgICAgICAgIGlmICgoY2FuZGlkYXRlLnN0YXJ0ICsgY2FuZGlkYXRlLmR1cmF0aW9uIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSkgPD0gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2FuZGlkYXRlLnN0YXJ0IC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSA+IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyByZWFjaCBlbmQgb2YgcGxheWxpc3RcbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZm91bmRGcmFnKSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmb3VuZEZyYWc7XG4gICAgICAgICAgICAgIHN0YXJ0ID0gZm91bmRGcmFnLnN0YXJ0O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgU04gbWF0Y2hpbmcgd2l0aCBwb3M6JyArICBidWZmZXJFbmQgKyAnOicgKyBmcmFnLnNuKTtcbiAgICAgICAgICAgICAgaWYgKGZyYWdQcmV2aW91cyAmJiBmcmFnLmxldmVsID09PSBmcmFnUHJldmlvdXMubGV2ZWwgJiYgZnJhZy5zbiA9PT0gZnJhZ1ByZXZpb3VzLnNuKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZyYWcuc24gPCBsZXZlbERldGFpbHMuZW5kU04pIHtcbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZy5zbiArIDEgLSBsZXZlbERldGFpbHMuc3RhcnRTTl07XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBTTiBqdXN0IGxvYWRlZCwgbG9hZCBuZXh0IG9uZTogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAvLyBoYXZlIHdlIHJlYWNoZWQgZW5kIG9mIFZPRCBwbGF5bGlzdCA/XG4gICAgICAgICAgICAgICAgICBpZiAoIWxldmVsRGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0VPUyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FTkRFRDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZihmcmFnKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJyAgICAgIGxvYWRpbmcgZnJhZyAnICsgaSArJyxwb3MvYnVmRW5kOicgKyBwb3MudG9GaXhlZCgzKSArICcvJyArIGJ1ZmZlckVuZC50b0ZpeGVkKDMpKTtcbiAgICAgICAgICAgIGlmICgoZnJhZy5kZWNyeXB0ZGF0YS51cmkgIT0gbnVsbCkgJiYgKGZyYWcuZGVjcnlwdGRhdGEua2V5ID09IG51bGwpKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcga2V5IGZvciAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuS0VZX0xPQURJTkc7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgY3VycmVudFRpbWU6JHtwb3N9LGJ1ZmZlckVuZDoke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICBmcmFnLmF1dG9MZXZlbCA9IGhscy5hdXRvTGV2ZWxFbmFibGVkO1xuICAgICAgICAgICAgICBpZiAodGhpcy5sZXZlbHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBNYXRoLnJvdW5kKGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSAvIDgpO1xuICAgICAgICAgICAgICAgIGZyYWcudHJlcXVlc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBhcmUgbm90IHJlbG9hZGluZyB0aGUgc2FtZSBmcmFnbWVudHMgaW4gbG9vcCAuLi5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlcikge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIrKztcbiAgICAgICAgICAgICAgICBsZXQgbWF4VGhyZXNob2xkID0gY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGlzIGZyYWcgaGFzIGFscmVhZHkgYmVlbiBsb2FkZWQgMyB0aW1lcywgYW5kIGlmIGl0IGhhcyBiZWVuIHJlbG9hZGVkIHJlY2VudGx5XG4gICAgICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIgPiBtYXhUaHJlc2hvbGQgJiYgKE1hdGguYWJzKHRoaXMuZnJhZ0xvYWRJZHggLSBmcmFnLmxvYWRJZHgpIDwgbWF4VGhyZXNob2xkKSkge1xuICAgICAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyID0gMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcmFnLmxvYWRJZHggPSB0aGlzLmZyYWdMb2FkSWR4O1xuICAgICAgICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gZnJhZztcbiAgICAgICAgICAgICAgdGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5GUkFHX0xPQURJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5XQUlUSU5HX0xFVkVMOlxuICAgICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZiAobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWTpcbiAgICAgICAgdmFyIG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB2YXIgcmV0cnlEYXRlID0gdGhpcy5yZXRyeURhdGU7XG4gICAgICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgICAgIHZhciBpc1NlZWtpbmcgPSBtZWRpYSAmJiBtZWRpYS5zZWVraW5nO1xuICAgICAgICAvLyBpZiBjdXJyZW50IHRpbWUgaXMgZ3QgdGhhbiByZXRyeURhdGUsIG9yIGlmIG1lZGlhIHNlZWtpbmcgbGV0J3Mgc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gcmV0cnkgbG9hZGluZ1xuICAgICAgICBpZighcmV0cnlEYXRlIHx8IChub3cgPj0gcmV0cnlEYXRlKSB8fCBpc1NlZWtpbmcpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtZWRpYUNvbnRyb2xsZXI6IHJldHJ5RGF0ZSByZWFjaGVkLCBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlYCk7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlNUT1BQRUQ6XG4gICAgICBjYXNlIFN0YXRlLkZSQUdfTE9BRElORzpcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0lORzpcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0VEOlxuICAgICAgY2FzZSBTdGF0ZS5FTkRFRDpcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLy8gY2hlY2sgYnVmZmVyXG4gICAgdGhpcy5fY2hlY2tCdWZmZXIoKTtcbiAgICAvLyBjaGVjay91cGRhdGUgY3VycmVudCBmcmFnbWVudFxuICAgIHRoaXMuX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCk7XG4gIH1cblxuXG5cblxuICBnZXRCdWZmZXJSYW5nZShwb3NpdGlvbikge1xuICAgIHZhciBpLCByYW5nZSxcbiAgICAgICAgYnVmZmVyUmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlO1xuICAgIGlmIChidWZmZXJSYW5nZSkge1xuICAgICAgZm9yIChpID0gYnVmZmVyUmFuZ2UubGVuZ3RoIC0gMTsgaSA+PTA7IGktLSkge1xuICAgICAgICByYW5nZSA9IGJ1ZmZlclJhbmdlW2ldO1xuICAgICAgICBpZiAocG9zaXRpb24gPj0gcmFuZ2Uuc3RhcnQgJiYgcG9zaXRpb24gPD0gcmFuZ2UuZW5kKSB7XG4gICAgICAgICAgcmV0dXJuIHJhbmdlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgdmFyIHJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKTtcbiAgICAgIGlmIChyYW5nZSkge1xuICAgICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgZ2V0IG5leHRCdWZmZXJSYW5nZSgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgLy8gZmlyc3QgZ2V0IGVuZCByYW5nZSBvZiBjdXJyZW50IGZyYWdtZW50XG4gICAgICByZXR1cm4gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZSh0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZm9sbG93aW5nQnVmZmVyUmFuZ2UocmFuZ2UpIHtcbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIC8vIHRyeSB0byBnZXQgcmFuZ2Ugb2YgbmV4dCBmcmFnbWVudCAoNTAwbXMgYWZ0ZXIgdGhpcyByYW5nZSlcbiAgICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlclJhbmdlKHJhbmdlLmVuZCArIDAuNSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICB2YXIgcmFuZ2UgPSB0aGlzLm5leHRCdWZmZXJSYW5nZTtcbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICB9XG5cbiAgaXNCdWZmZXJlZChwb3NpdGlvbikge1xuICAgIHZhciB2ID0gdGhpcy5tZWRpYSwgYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChwb3NpdGlvbiA+PSBidWZmZXJlZC5zdGFydChpKSAmJiBwb3NpdGlvbiA8PSBidWZmZXJlZC5lbmQoaSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpIHtcbiAgICB2YXIgcmFuZ2VDdXJyZW50LCBjdXJyZW50VGltZSwgdmlkZW8gPSB0aGlzLm1lZGlhO1xuICAgIGlmICh2aWRlbyAmJiB2aWRlby5zZWVraW5nID09PSBmYWxzZSkge1xuICAgICAgY3VycmVudFRpbWUgPSB2aWRlby5jdXJyZW50VGltZTtcbiAgICAgIC8qIGlmIHZpZGVvIGVsZW1lbnQgaXMgaW4gc2Vla2VkIHN0YXRlLCBjdXJyZW50VGltZSBjYW4gb25seSBpbmNyZWFzZS5cbiAgICAgICAgKGFzc3VtaW5nIHRoYXQgcGxheWJhY2sgcmF0ZSBpcyBwb3NpdGl2ZSAuLi4pXG4gICAgICAgIEFzIHNvbWV0aW1lcyBjdXJyZW50VGltZSBqdW1wcyBiYWNrIHRvIHplcm8gYWZ0ZXIgYVxuICAgICAgICBtZWRpYSBkZWNvZGUgZXJyb3IsIGNoZWNrIHRoaXMsIHRvIGF2b2lkIHNlZWtpbmcgYmFjayB0b1xuICAgICAgICB3cm9uZyBwb3NpdGlvbiBhZnRlciBhIG1lZGlhIGRlY29kZSBlcnJvclxuICAgICAgKi9cbiAgICAgIGlmKGN1cnJlbnRUaW1lID4gdmlkZW8ucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gY3VycmVudFRpbWU7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lKSkge1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lICsgMC4xKSkge1xuICAgICAgICAvKiBlbnN1cmUgdGhhdCBGUkFHX0NIQU5HRUQgZXZlbnQgaXMgdHJpZ2dlcmVkIGF0IHN0YXJ0dXAsXG4gICAgICAgICAgd2hlbiBmaXJzdCB2aWRlbyBmcmFtZSBpcyBkaXNwbGF5ZWQgYW5kIHBsYXliYWNrIGlzIHBhdXNlZC5cbiAgICAgICAgICBhZGQgYSB0b2xlcmFuY2Ugb2YgMTAwbXMsIGluIGNhc2UgY3VycmVudCBwb3NpdGlvbiBpcyBub3QgYnVmZmVyZWQsXG4gICAgICAgICAgY2hlY2sgaWYgY3VycmVudCBwb3MrMTAwbXMgaXMgYnVmZmVyZWQgYW5kIHVzZSB0aGF0IGJ1ZmZlciByYW5nZVxuICAgICAgICAgIGZvciBGUkFHX0NIQU5HRUQgZXZlbnQgcmVwb3J0aW5nICovXG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUgKyAwLjEpO1xuICAgICAgfVxuICAgICAgaWYgKHJhbmdlQ3VycmVudCkge1xuICAgICAgICB2YXIgZnJhZ1BsYXlpbmcgPSByYW5nZUN1cnJlbnQuZnJhZztcbiAgICAgICAgaWYgKGZyYWdQbGF5aW5nICE9PSB0aGlzLmZyYWdQbGF5aW5nKSB7XG4gICAgICAgICAgdGhpcy5mcmFnUGxheWluZyA9IGZyYWdQbGF5aW5nO1xuICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19DSEFOR0VELCB7ZnJhZzogZnJhZ1BsYXlpbmd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgIC0gcGF1c2UgcGxheWJhY2sgaWYgcGxheWluZ1xuICAgICAtIGNhbmNlbCBhbnkgcGVuZGluZyBsb2FkIHJlcXVlc3RcbiAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaCgpIHtcbiAgICBsb2dnZXIubG9nKCdpbW1lZGlhdGVMZXZlbFN3aXRjaCcpO1xuICAgIGlmICghdGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgIHRoaXMuaW1tZWRpYXRlU3dpdGNoID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJldmlvdXNseVBhdXNlZCA9IHRoaXMubWVkaWEucGF1c2VkO1xuICAgICAgdGhpcy5tZWRpYS5wYXVzZSgpO1xuICAgIH1cbiAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAvLyBmbHVzaCBldmVyeXRoaW5nXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRkxVU0hJTkcsIHtzdGFydE9mZnNldDogMCwgZW5kT2Zmc2V0OiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9KTtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFVU0VEO1xuICAgIC8vIGluY3JlYXNlIGZyYWdtZW50IGxvYWQgSW5kZXggdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3IgYWZ0ZXIgYnVmZmVyIGZsdXNoXG4gICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgLypcbiAgICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCBlbmQsIGFmdGVyIG5ldyBmcmFnbWVudCBoYXMgYmVlbiBidWZmZXJlZCA6XG4gICAgICAtIG51ZGdlIHZpZGVvIGRlY29kZXIgYnkgc2xpZ2h0bHkgYWRqdXN0aW5nIHZpZGVvIGN1cnJlbnRUaW1lXG4gICAgICAtIHJlc3VtZSB0aGUgcGxheWJhY2sgaWYgbmVlZGVkXG4gICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCkge1xuICAgIHRoaXMuaW1tZWRpYXRlU3dpdGNoID0gZmFsc2U7XG4gICAgdGhpcy5tZWRpYS5jdXJyZW50VGltZSAtPSAwLjAwMDE7XG4gICAgaWYgKCF0aGlzLnByZXZpb3VzbHlQYXVzZWQpIHtcbiAgICAgIHRoaXMubWVkaWEucGxheSgpO1xuICAgIH1cbiAgfVxuXG4gIG5leHRMZXZlbFN3aXRjaCgpIHtcbiAgICAvKiB0cnkgdG8gc3dpdGNoIEFTQVAgd2l0aG91dCBicmVha2luZyB2aWRlbyBwbGF5YmFjayA6XG4gICAgICAgaW4gb3JkZXIgdG8gZW5zdXJlIHNtb290aCBidXQgcXVpY2sgbGV2ZWwgc3dpdGNoaW5nLFxuICAgICAgd2UgbmVlZCB0byBmaW5kIHRoZSBuZXh0IGZsdXNoYWJsZSBidWZmZXIgcmFuZ2VcbiAgICAgIHdlIHNob3VsZCB0YWtlIGludG8gYWNjb3VudCBuZXcgc2VnbWVudCBmZXRjaCB0aW1lXG4gICAgKi9cbiAgICB2YXIgZmV0Y2hkZWxheSwgY3VycmVudFJhbmdlLCBuZXh0UmFuZ2U7XG4gICAgY3VycmVudFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKTtcbiAgICBpZiAoY3VycmVudFJhbmdlICYmIGN1cnJlbnRSYW5nZS5zdGFydCA+IDEpIHtcbiAgICAvLyBmbHVzaCBidWZmZXIgcHJlY2VkaW5nIGN1cnJlbnQgZnJhZ21lbnQgKGZsdXNoIHVudGlsIGN1cnJlbnQgZnJhZ21lbnQgc3RhcnQgb2Zmc2V0KVxuICAgIC8vIG1pbnVzIDFzIHRvIGF2b2lkIHZpZGVvIGZyZWV6aW5nLCB0aGF0IGNvdWxkIGhhcHBlbiBpZiB3ZSBmbHVzaCBrZXlmcmFtZSBvZiBjdXJyZW50IHZpZGVvIC4uLlxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRkxVU0hJTkcsIHtzdGFydE9mZnNldDogMCwgZW5kT2Zmc2V0OiBjdXJyZW50UmFuZ2Uuc3RhcnQgLSAxfSk7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFVU0VEO1xuICAgIH1cbiAgICBpZiAoIXRoaXMubWVkaWEucGF1c2VkKSB7XG4gICAgICAvLyBhZGQgYSBzYWZldHkgZGVsYXkgb2YgMXNcbiAgICAgIHZhciBuZXh0TGV2ZWxJZCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwsbmV4dExldmVsID0gdGhpcy5sZXZlbHNbbmV4dExldmVsSWRdLCBmcmFnTGFzdEticHMgPSB0aGlzLmZyYWdMYXN0S2JwcztcbiAgICAgIGlmIChmcmFnTGFzdEticHMgJiYgdGhpcy5mcmFnQ3VycmVudCkge1xuICAgICAgICBmZXRjaGRlbGF5ID0gdGhpcy5mcmFnQ3VycmVudC5kdXJhdGlvbiAqIG5leHRMZXZlbC5iaXRyYXRlIC8gKDEwMDAgKiBmcmFnTGFzdEticHMpICsgMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmZXRjaGRlbGF5OicrZmV0Y2hkZWxheSk7XG4gICAgLy8gZmluZCBidWZmZXIgcmFuZ2UgdGhhdCB3aWxsIGJlIHJlYWNoZWQgb25jZSBuZXcgZnJhZ21lbnQgd2lsbCBiZSBmZXRjaGVkXG4gICAgbmV4dFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lICsgZmV0Y2hkZWxheSk7XG4gICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgLy8gd2UgY2FuIGZsdXNoIGJ1ZmZlciByYW5nZSBmb2xsb3dpbmcgdGhpcyBvbmUgd2l0aG91dCBzdGFsbGluZyBwbGF5YmFja1xuICAgICAgbmV4dFJhbmdlID0gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZShuZXh0UmFuZ2UpO1xuICAgICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNISU5HLCB7c3RhcnRPZmZzZXQ6IG5leHRSYW5nZS5zdGFydCwgZW5kT2Zmc2V0OiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9KTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBVVNFRDtcbiAgICAgICAgLy8gaWYgd2UgYXJlIGhlcmUsIHdlIGNhbiBhbHNvIGNhbmNlbCBhbnkgbG9hZGluZy9kZW11eGluZyBpbiBwcm9ncmVzcywgYXMgdGhleSBhcmUgdXNlbGVzc1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIC8vIGluY3JlYXNlIGZyYWdtZW50IGxvYWQgSW5kZXggdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3IgYWZ0ZXIgYnVmZmVyIGZsdXNoXG4gICAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbk1lZGlhQXR0YWNoZWQoZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25NZWRpYVNlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udnNlZWtlZCA9IHRoaXMub25NZWRpYVNlZWtlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252ZW5kZWQgPSB0aGlzLm9uTWVkaWFFbmRlZC5iaW5kKHRoaXMpO1xuICAgIG1lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLCB0aGlzLm9udnNlZWtpbmcpO1xuICAgIG1lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsIHRoaXMub252c2Vla2VkKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgIGlmKHRoaXMubGV2ZWxzICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuaGxzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBpZiAobWVkaWEgJiYgbWVkaWEuZW5kZWQpIHtcbiAgICAgIGxvZ2dlci5sb2coJ01TRSBkZXRhY2hpbmcgYW5kIHZpZGVvIGVuZGVkLCByZXNldCBzdGFydFBvc2l0aW9uJyk7XG4gICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gICAgfVxuXG4gICAgLy8gcmVzZXQgZnJhZ21lbnQgbG9hZGluZyBjb3VudGVyIG9uIE1TRSBkZXRhY2hpbmcgdG8gYXZvaWQgcmVwb3J0aW5nIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SIGFmdGVyIGVycm9yIHJlY292ZXJ5XG4gICAgdmFyIGxldmVscyA9IHRoaXMubGV2ZWxzO1xuICAgIGlmIChsZXZlbHMpIHtcbiAgICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWQgY291bnRlclxuICAgICAgICBsZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAgICAgaWYobGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgICAgbGV2ZWwuZGV0YWlscy5mcmFnbWVudHMuZm9yRWFjaChmcmFnbWVudCA9PiB7XG4gICAgICAgICAgICAgIGZyYWdtZW50LmxvYWRDb3VudGVyID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIC8vIHJlbW92ZSB2aWRlbyBsaXN0ZW5lcnNcbiAgICBpZiAobWVkaWEpIHtcbiAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLCB0aGlzLm9udnNlZWtpbmcpO1xuICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub252c2Vla2VkICA9IHRoaXMub252ZW5kZWQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgdGhpcy5zdG9wTG9hZCgpO1xuICB9XG5cbiAgb25NZWRpYVNlZWtpbmcoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkZSQUdfTE9BRElORykge1xuICAgICAgLy8gY2hlY2sgaWYgY3VycmVudGx5IGxvYWRlZCBmcmFnbWVudCBpcyBpbnNpZGUgYnVmZmVyLlxuICAgICAgLy9pZiBvdXRzaWRlLCBjYW5jZWwgZnJhZ21lbnQgbG9hZGluZywgb3RoZXJ3aXNlIGRvIG5vdGhpbmdcbiAgICAgIGlmIChCdWZmZXJIZWxwZXIuYnVmZmVySW5mbyh0aGlzLm1lZGlhLHRoaXMubWVkaWEuY3VycmVudFRpbWUsdGhpcy5jb25maWcubWF4QnVmZmVySG9sZSkubGVuID09PSAwKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ3NlZWtpbmcgb3V0c2lkZSBvZiBidWZmZXIgd2hpbGUgZnJhZ21lbnQgbG9hZCBpbiBwcm9ncmVzcywgY2FuY2VsIGZyYWdtZW50IGxvYWQnKTtcbiAgICAgICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgaWYgKGZyYWdDdXJyZW50KSB7XG4gICAgICAgICAgaWYgKGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgLy8gc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gbG9hZCBuZXcgZnJhZ21lbnRcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5FTkRFRCkge1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBjaGVjayBmb3IgcG90ZW50aWFsIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB9XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gYXZvaWQgcmVwb3J0aW5nIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciBpbiBjYXNlIHVzZXIgaXMgc2Vla2luZyBzZXZlcmFsIHRpbWVzIG9uIHNhbWUgcG9zaXRpb25cbiAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYVNlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIGVuZGVkJyk7XG4gICAgLy8gcmVzZXQgc3RhcnRQb3NpdGlvbiBhbmQgbGFzdEN1cnJlbnRUaW1lIHRvIHJlc3RhcnQgcGxheWJhY2sgQCBzdHJlYW0gYmVnaW5uaW5nXG4gICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICB9XG5cblxuICBvbk1hbmlmZXN0TG9hZGluZygpIHtcbiAgICAvLyByZXNldCBidWZmZXIgb24gbWFuaWZlc3QgbG9hZGluZ1xuICAgIGxvZ2dlci5sb2coJ3RyaWdnZXIgQlVGRkVSX1JFU0VUJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfUkVTRVQpO1xuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBbXTtcbiAgICB0aGlzLnN0YWxsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZGF0YSkge1xuICAgIHZhciBhYWMgPSBmYWxzZSwgaGVhYWMgPSBmYWxzZSwgY29kZWM7XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWMgPSBsZXZlbC5hdWRpb0NvZGVjO1xuICAgICAgaWYgKGNvZGVjKSB7XG4gICAgICAgIGlmIChjb2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEpIHtcbiAgICAgICAgICBhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmF1ZGlvQ29kZWNTd2l0Y2ggPSAoYWFjICYmIGhlYWFjKTtcbiAgICBpZiAodGhpcy5hdWRpb0NvZGVjU3dpdGNoKSB7XG4gICAgICBsb2dnZXIubG9nKCdib3RoIEFBQy9IRS1BQUMgYXVkaW8gZm91bmQgaW4gbGV2ZWxzOyBkZWNsYXJpbmcgbGV2ZWwgY29kZWMgYXMgSEUtQUFDJyk7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICBpZiAodGhpcy5jb25maWcuYXV0b1N0YXJ0TG9hZCkge1xuICAgICAgdGhpcy5obHMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChkYXRhKSB7XG4gICAgdmFyIG5ld0RldGFpbHMgPSBkYXRhLmRldGFpbHMsXG4gICAgICAgIG5ld0xldmVsSWQgPSBkYXRhLmxldmVsLFxuICAgICAgICBjdXJMZXZlbCA9IHRoaXMubGV2ZWxzW25ld0xldmVsSWRdLFxuICAgICAgICBkdXJhdGlvbiA9IG5ld0RldGFpbHMudG90YWxkdXJhdGlvbixcbiAgICAgICAgc2xpZGluZyA9IDA7XG5cbiAgICBsb2dnZXIubG9nKGBsZXZlbCAke25ld0xldmVsSWR9IGxvYWRlZCBbJHtuZXdEZXRhaWxzLnN0YXJ0U059LCR7bmV3RGV0YWlscy5lbmRTTn1dLGR1cmF0aW9uOiR7ZHVyYXRpb259YCk7XG4gICAgdGhpcy5sZXZlbExhc3RMb2FkZWQgPSBuZXdMZXZlbElkO1xuXG4gICAgaWYgKG5ld0RldGFpbHMubGl2ZSkge1xuICAgICAgdmFyIGN1ckRldGFpbHMgPSBjdXJMZXZlbC5kZXRhaWxzO1xuICAgICAgaWYgKGN1ckRldGFpbHMpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBoYXZlIGRldGFpbHMgZm9yIHRoYXQgbGV2ZWwsIG1lcmdlIHRoZW1cbiAgICAgICAgTGV2ZWxIZWxwZXIubWVyZ2VEZXRhaWxzKGN1ckRldGFpbHMsbmV3RGV0YWlscyk7XG4gICAgICAgIHNsaWRpbmcgPSBuZXdEZXRhaWxzLmZyYWdtZW50c1swXS5zdGFydDtcbiAgICAgICAgaWYgKG5ld0RldGFpbHMuUFRTS25vd24pIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtzbGlkaW5nLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnbGl2ZSBwbGF5bGlzdCAtIG91dGRhdGVkIFBUUywgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICAgICAgbG9nZ2VyLmxvZygnbGl2ZSBwbGF5bGlzdCAtIGZpcnN0IGxvYWQsIHVua25vd24gc2xpZGluZycpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgfVxuICAgIC8vIG92ZXJyaWRlIGxldmVsIGluZm9cbiAgICBjdXJMZXZlbC5kZXRhaWxzID0gbmV3RGV0YWlscztcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1VQREFURUQsIHsgZGV0YWlsczogbmV3RGV0YWlscywgbGV2ZWw6IG5ld0xldmVsSWQgfSk7XG5cbiAgICAvLyBjb21wdXRlIHN0YXJ0IHBvc2l0aW9uXG4gICAgaWYgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICh1c3VhbGx5IDMpXG4gICAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICAgIGxldCB0YXJnZXRMYXRlbmN5ID0gdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbiA6IHRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAqIG5ld0RldGFpbHMudGFyZ2V0ZHVyYXRpb247XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IE1hdGgubWF4KDAsIHNsaWRpbmcgKyBkdXJhdGlvbiAtIHRhcmdldExhdGVuY3kpO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgIH1cbiAgICAvLyBvbmx5IHN3aXRjaCBiYXRjayB0byBJRExFIHN0YXRlIGlmIHdlIHdlcmUgd2FpdGluZyBmb3IgbGV2ZWwgdG8gc3RhcnQgZG93bmxvYWRpbmcgYSBuZXcgZnJhZ21lbnRcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuV0FJVElOR19MRVZFTCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25LZXlMb2FkZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLktFWV9MT0FESU5HKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZChkYXRhKSB7XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HICYmXG4gICAgICAgIGZyYWdDdXJyZW50ICYmXG4gICAgICAgIGRhdGEuZnJhZy5sZXZlbCA9PT0gZnJhZ0N1cnJlbnQubGV2ZWwgJiZcbiAgICAgICAgZGF0YS5mcmFnLnNuID09PSBmcmFnQ3VycmVudC5zbikge1xuICAgICAgaWYgKHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB0aGlzLmZyYWdCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHtzdGF0czogZGF0YS5zdGF0cywgZnJhZzogZnJhZ0N1cnJlbnR9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTSU5HO1xuICAgICAgICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgICAgIHRoaXMuc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgICAgICB2YXIgY3VycmVudExldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgICAgICBkZXRhaWxzID0gY3VycmVudExldmVsLmRldGFpbHMsXG4gICAgICAgICAgICBkdXJhdGlvbiA9IGRldGFpbHMudG90YWxkdXJhdGlvbixcbiAgICAgICAgICAgIHN0YXJ0ID0gZnJhZ0N1cnJlbnQuc3RhcnQsXG4gICAgICAgICAgICBsZXZlbCA9IGZyYWdDdXJyZW50LmxldmVsLFxuICAgICAgICAgICAgc24gPSBmcmFnQ3VycmVudC5zbixcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSBjdXJyZW50TGV2ZWwuYXVkaW9Db2RlYyB8fCB0aGlzLmNvbmZpZy5kZWZhdWx0QXVkaW9Db2RlYztcbiAgICAgICAgaWYodGhpcy5hdWRpb0NvZGVjU3dhcCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3N3YXBwaW5nIHBsYXlsaXN0IGF1ZGlvIGNvZGVjJyk7XG4gICAgICAgICAgaWYoYXVkaW9Db2RlYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gdGhpcy5sYXN0QXVkaW9Db2RlYztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoYXVkaW9Db2RlYykge1xuICAgICAgICAgICAgaWYoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkge1xuICAgICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZyA9IDA7XG4gICAgICAgIGxvZ2dlci5sb2coYERlbXV4aW5nICR7c259IG9mIFske2RldGFpbHMuc3RhcnRTTn0gLCR7ZGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCwgYXVkaW9Db2RlYywgY3VycmVudExldmVsLnZpZGVvQ29kZWMsIHN0YXJ0LCBmcmFnQ3VycmVudC5jYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgZnJhZ0N1cnJlbnQuZGVjcnlwdGRhdGEpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSAwO1xuICB9XG5cbiAgb25GcmFnUGFyc2luZ0luaXRTZWdtZW50KGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdmFyIHRyYWNrcyA9IGRhdGEudHJhY2tzLCB0cmFja05hbWUsIHRyYWNrO1xuXG4gICAgICAvLyBpbmNsdWRlIGxldmVsQ29kZWMgaW4gYXVkaW8gYW5kIHZpZGVvIHRyYWNrc1xuICAgICAgdHJhY2sgPSB0cmFja3MuYXVkaW87XG4gICAgICBpZih0cmFjaykge1xuICAgICAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsXG4gICAgICAgICAgICB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYoYXVkaW9Db2RlYyAmJiB0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gaW4gY2FzZSBBQUMgYW5kIEhFLUFBQyBhdWRpbyBjb2RlY3MgYXJlIHNpZ25hbGxlZCBpbiBtYW5pZmVzdFxuICAgICAgICAvLyBmb3JjZSBIRS1BQUMgLCBhcyBpdCBzZWVtcyB0aGF0IG1vc3QgYnJvd3NlcnMgcHJlZmVycyB0aGF0IHdheSxcbiAgICAgICAgLy8gZXhjZXB0IGZvciBtb25vIHN0cmVhbXMgT1Igb24gRkZcbiAgICAgICAgLy8gdGhlc2UgY29uZGl0aW9ucyBtaWdodCBuZWVkIHRvIGJlIHJldmlld2VkIC4uLlxuICAgICAgICBpZiAodGhpcy5hdWRpb0NvZGVjU3dpdGNoKSB7XG4gICAgICAgICAgICAvLyBkb24ndCBmb3JjZSBIRS1BQUMgaWYgbW9ubyBzdHJlYW1cbiAgICAgICAgICAgaWYodHJhY2subWV0YWRhdGEuY2hhbm5lbENvdW50ICE9PSAxICYmXG4gICAgICAgICAgICAvLyBkb24ndCBmb3JjZSBIRS1BQUMgaWYgZmlyZWZveFxuICAgICAgICAgICAgdWEuaW5kZXhPZignZmlyZWZveCcpID09PSAtMSkge1xuICAgICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEhFLUFBQyBpcyBicm9rZW4gb24gQW5kcm9pZCwgYWx3YXlzIHNpZ25hbCBhdWRpbyBjb2RlYyBhcyBBQUMgZXZlbiBpZiB2YXJpYW50IG1hbmlmZXN0IHN0YXRlcyBvdGhlcndpc2VcbiAgICAgICAgaWYodWEuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICBsb2dnZXIubG9nKGBBbmRyb2lkOiBmb3JjZSBhdWRpbyBjb2RlYyB0b2AgKyBhdWRpb0NvZGVjKTtcbiAgICAgICAgfVxuICAgICAgICB0cmFjay5sZXZlbENvZGVjID0gYXVkaW9Db2RlYztcbiAgICAgIH1cbiAgICAgIHRyYWNrID0gdHJhY2tzLnZpZGVvO1xuICAgICAgaWYodHJhY2spIHtcbiAgICAgICAgdHJhY2subGV2ZWxDb2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWM7XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIHJlbXV4ZXIgc3BlY2lmeSB0aGF0IGEgdW5pcXVlIHRyYWNrIG5lZWRzIHRvIGdlbmVyYXRlZCxcbiAgICAgIC8vIGxldCdzIG1lcmdlIGFsbCB0cmFja3MgdG9nZXRoZXJcbiAgICAgIGlmIChkYXRhLnVuaXF1ZSkge1xuICAgICAgICB2YXIgbWVyZ2VkVHJhY2sgPSB7XG4gICAgICAgICAgICBjb2RlYyA6ICcnLFxuICAgICAgICAgICAgbGV2ZWxDb2RlYyA6ICcnXG4gICAgICAgICAgfTtcbiAgICAgICAgZm9yICh0cmFja05hbWUgaW4gZGF0YS50cmFja3MpIHtcbiAgICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICAgIG1lcmdlZFRyYWNrLmNvbnRhaW5lciA9IHRyYWNrLmNvbnRhaW5lcjtcbiAgICAgICAgICBpZiAobWVyZ2VkVHJhY2suY29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmNvZGVjICs9ICAnLCc7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5sZXZlbENvZGVjICs9ICAnLCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKHRyYWNrLmNvZGVjKSB7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5jb2RlYyArPSAgdHJhY2suY29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0cmFjay5sZXZlbENvZGVjKSB7XG4gICAgICAgICAgICBtZXJnZWRUcmFjay5sZXZlbENvZGVjICs9ICB0cmFjay5sZXZlbENvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0cmFja3MgPSB7IGF1ZGlvdmlkZW8gOiBtZXJnZWRUcmFjayB9O1xuICAgICAgfVxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQ09ERUNTLHRyYWNrcyk7XG4gICAgICAvLyBsb29wIHRocm91Z2ggdHJhY2tzIHRoYXQgYXJlIGdvaW5nIHRvIGJlIHByb3ZpZGVkIHRvIGJ1ZmZlckNvbnRyb2xsZXJcbiAgICAgIGZvciAodHJhY2tOYW1lIGluIHRyYWNrcykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICBsb2dnZXIubG9nKGB0cmFjazoke3RyYWNrTmFtZX0sY29udGFpbmVyOiR7dHJhY2suY29udGFpbmVyfSxjb2RlY3NbbGV2ZWwvcGFyc2VkXT1bJHt0cmFjay5sZXZlbENvZGVjfS8ke3RyYWNrLmNvZGVjfV1gKTtcbiAgICAgICAgdmFyIGluaXRTZWdtZW50ID0gdHJhY2suaW5pdFNlZ21lbnQ7XG4gICAgICAgIGlmIChpbml0U2VnbWVudCkge1xuICAgICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZysrO1xuICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0FQUEVORElORywge3R5cGU6IHRyYWNrTmFtZSwgZGF0YTogaW5pdFNlZ21lbnR9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nRGF0YShkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMudHBhcnNlMiA9IERhdGUubm93KCk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcblxuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkICR7ZGF0YS50eXBlfSxQVFM6WyR7ZGF0YS5zdGFydFBUUy50b0ZpeGVkKDMpfSwke2RhdGEuZW5kUFRTLnRvRml4ZWQoMyl9XSxEVFM6WyR7ZGF0YS5zdGFydERUUy50b0ZpeGVkKDMpfS8ke2RhdGEuZW5kRFRTLnRvRml4ZWQoMyl9XSxuYjoke2RhdGEubmJ9YCk7XG5cbiAgICAgIHZhciBkcmlmdCA9IExldmVsSGVscGVyLnVwZGF0ZUZyYWdQVFMobGV2ZWwuZGV0YWlscyxmcmFnLnNuLGRhdGEuc3RhcnRQVFMsZGF0YS5lbmRQVFMpLFxuICAgICAgICAgIGhscyA9IHRoaXMuaGxzO1xuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfUFRTX1VQREFURUQsIHtkZXRhaWxzOiBsZXZlbC5kZXRhaWxzLCBsZXZlbDogdGhpcy5sZXZlbCwgZHJpZnQ6IGRyaWZ0fSk7XG5cbiAgICAgIFtkYXRhLmRhdGExLCBkYXRhLmRhdGEyXS5mb3JFYWNoKGJ1ZmZlciA9PiB7XG4gICAgICAgIGlmIChidWZmZXIpIHtcbiAgICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmcrKztcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ESU5HLCB7dHlwZTogZGF0YS50eXBlLCBkYXRhOiBidWZmZXJ9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IGRhdGEuZW5kUFRTO1xuICAgICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0OiBkYXRhLnN0YXJ0UFRTLCBlbmQ6IGRhdGEuZW5kUFRTLCBmcmFnOiBmcmFnfSk7XG5cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKGBub3QgaW4gUEFSU0lORyBzdGF0ZSBidXQgJHt0aGlzLnN0YXRlfSwgaWdub3JpbmcgRlJBR19QQVJTSU5HX0RBVEEgZXZlbnRgKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNFRDtcbiAgICAgIHRoaXMuX2NoZWNrQXBwZW5kZWRQYXJzZWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkJ1ZmZlckFwcGVuZGVkKCkge1xuICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5QQVJTSU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTRUQ6XG4gICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZy0tO1xuICAgICAgICB0aGlzLl9jaGVja0FwcGVuZGVkUGFyc2VkKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgX2NoZWNrQXBwZW5kZWRQYXJzZWQoKSB7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNFRCAmJiB0aGlzLnBlbmRpbmdBcHBlbmRpbmcgPT09IDApICB7XG4gICAgICB2YXIgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQsIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICAgIGlmIChmcmFnKSB7XG4gICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gZnJhZztcbiAgICAgICAgc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuZnJhZ0xhc3RLYnBzID0gTWF0aC5yb3VuZCg4ICogc3RhdHMubGVuZ3RoIC8gKHN0YXRzLnRidWZmZXJlZCAtIHN0YXRzLnRmaXJzdCkpO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHtzdGF0czogc3RhdHMsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgbWVkaWEgYnVmZmVyZWQgOiAke3RoaXMudGltZVJhbmdlc1RvU3RyaW5nKHRoaXMubWVkaWEuYnVmZmVyZWQpfWApO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRXJyb3IoZGF0YSkge1xuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgICBpZighZGF0YS5mYXRhbCkge1xuICAgICAgICAgIHZhciBsb2FkRXJyb3IgPSB0aGlzLmZyYWdMb2FkRXJyb3I7XG4gICAgICAgICAgaWYobG9hZEVycm9yKSB7XG4gICAgICAgICAgICBsb2FkRXJyb3IrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9hZEVycm9yPTE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChsb2FkRXJyb3IgPD0gdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdNYXhSZXRyeSkge1xuICAgICAgICAgICAgdGhpcy5mcmFnTG9hZEVycm9yID0gbG9hZEVycm9yO1xuICAgICAgICAgICAgLy8gcmVzZXQgbG9hZCBjb3VudGVyIHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yXG4gICAgICAgICAgICBkYXRhLmZyYWcubG9hZENvdW50ZXIgPSAwO1xuICAgICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZiBjYXBwZWQgdG8gNjRzXG4gICAgICAgICAgICB2YXIgZGVsYXkgPSBNYXRoLm1pbihNYXRoLnBvdygyLGxvYWRFcnJvci0xKSp0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ1JldHJ5RGVsYXksNjQwMDApO1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYG1lZGlhQ29udHJvbGxlcjogZnJhZyBsb2FkaW5nIGZhaWxlZCwgcmV0cnkgaW4gJHtkZWxheX0gbXNgKTtcbiAgICAgICAgICAgIHRoaXMucmV0cnlEYXRlID0gcGVyZm9ybWFuY2Uubm93KCkgKyBkZWxheTtcbiAgICAgICAgICAgIC8vIHJldHJ5IGxvYWRpbmcgc3RhdGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5GUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSByZWFjaGVzIG1heCByZXRyeSwgcmVkaXNwYXRjaCBhcyBmYXRhbCAuLi5gKTtcbiAgICAgICAgICAgIC8vIHJlZGlzcGF0Y2ggc2FtZSBlcnJvciBidXQgd2l0aCBmYXRhbCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBkYXRhKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIC8vIGlmIGZhdGFsIGVycm9yLCBzdG9wIHByb2Nlc3NpbmcsIG90aGVyd2lzZSBtb3ZlIHRvIElETEUgdG8gcmV0cnkgbG9hZGluZ1xuICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiAke2RhdGEuZGV0YWlsc30gd2hpbGUgbG9hZGluZyBmcmFnLHN3aXRjaCB0byAke2RhdGEuZmF0YWwgPyAnRVJST1InIDogJ0lETEUnfSBzdGF0ZSAuLi5gKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGRhdGEuZmF0YWwgPyBTdGF0ZS5FUlJPUiA6IFN0YXRlLklETEU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuQlVGRkVSX0ZVTExfRVJST1I6XG4gICAgICAgIC8vIHRyaWdnZXIgYSBzbW9vdGggbGV2ZWwgc3dpdGNoIHRvIGVtcHR5IGJ1ZmZlcnNcbiAgICAgICAgLy8gYWxzbyByZWR1Y2UgbWF4IGJ1ZmZlciBsZW5ndGggYXMgaXQgbWlnaHQgYmUgdG9vIGhpZ2guIHdlIGRvIHRoaXMgdG8gYXZvaWQgbG9vcCBmbHVzaGluZyAuLi5cbiAgICAgICAgdGhpcy5jb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoLz0yO1xuICAgICAgICBsb2dnZXIud2FybihgcmVkdWNlIG1heCBidWZmZXIgbGVuZ3RoIHRvICR7dGhpcy5jb25maWcubWF4TWF4QnVmZmVyTGVuZ3RofXMgYW5kIHRyaWdnZXIgYSBuZXh0TGV2ZWxTd2l0Y2ggdG8gZmx1c2ggb2xkIGJ1ZmZlciBhbmQgZml4IFF1b3RhRXhjZWVkZWRFcnJvcmApO1xuICAgICAgICB0aGlzLm5leHRMZXZlbFN3aXRjaCgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG5fY2hlY2tCdWZmZXIoKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBpZihtZWRpYSkge1xuICAgICAgLy8gY29tcGFyZSByZWFkeVN0YXRlXG4gICAgICB2YXIgcmVhZHlTdGF0ZSA9IG1lZGlhLnJlYWR5U3RhdGU7XG4gICAgICAvLyBpZiByZWFkeSBzdGF0ZSBkaWZmZXJlbnQgZnJvbSBIQVZFX05PVEhJTkcgKG51bWVyaWMgdmFsdWUgMCksIHdlIGFyZSBhbGxvd2VkIHRvIHNlZWtcbiAgICAgIGlmKHJlYWR5U3RhdGUpIHtcbiAgICAgICAgdmFyIHRhcmdldFNlZWtQb3NpdGlvbiwgY3VycmVudFRpbWU7XG4gICAgICAgIC8vIGlmIHNlZWsgYWZ0ZXIgYnVmZmVyZWQgZGVmaW5lZCwgbGV0J3Mgc2VlayBpZiB3aXRoaW4gYWNjZXB0YWJsZSByYW5nZVxuICAgICAgICB2YXIgc2Vla0FmdGVyQnVmZmVyZWQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICBpZihzZWVrQWZ0ZXJCdWZmZXJlZCkge1xuICAgICAgICAgIGlmKG1lZGlhLmR1cmF0aW9uID49IHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgICB0YXJnZXRTZWVrUG9zaXRpb24gPSBzZWVrQWZ0ZXJCdWZmZXJlZDtcbiAgICAgICAgICAgIHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGN1cnJlbnRUaW1lID0gbWVkaWEuY3VycmVudFRpbWU7XG4gICAgICAgICAgdmFyIGxvYWRlZG1ldGFkYXRhID0gdGhpcy5sb2FkZWRtZXRhZGF0YTtcblxuICAgICAgICAgIC8vIGFkanVzdCBjdXJyZW50VGltZSB0byBzdGFydCBwb3NpdGlvbiBvbiBsb2FkZWQgbWV0YWRhdGFcbiAgICAgICAgICBpZighbG9hZGVkbWV0YWRhdGEgJiYgbWVkaWEuYnVmZmVyZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gdHJ1ZTtcbiAgICAgICAgICAgIC8vIG9ubHkgYWRqdXN0IGN1cnJlbnRUaW1lIGlmIG5vdCBlcXVhbCB0byAwXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRUaW1lICYmIGN1cnJlbnRUaW1lICE9PSB0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgdGFyZ2V0U2Vla1Bvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGFyZ2V0U2Vla1Bvc2l0aW9uKSB7XG4gICAgICAgICAgY3VycmVudFRpbWUgPSB0YXJnZXRTZWVrUG9zaXRpb247XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgdGFyZ2V0IHNlZWsgcG9zaXRpb246JHt0YXJnZXRTZWVrUG9zaXRpb259YCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSBCdWZmZXJIZWxwZXIuYnVmZmVySW5mbyhtZWRpYSxjdXJyZW50VGltZSwwKSxcbiAgICAgICAgICAgIGV4cGVjdGVkUGxheWluZyA9ICEobWVkaWEucGF1c2VkIHx8IG1lZGlhLmVuZGVkIHx8IG1lZGlhLnNlZWtpbmcgfHwgcmVhZHlTdGF0ZSA8IDIpLFxuICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDAuNCwgLy8gdG9sZXJhbmNlIG5lZWRlZCBhcyBzb21lIGJyb3dzZXJzIHN0YWxscyBwbGF5YmFjayBiZWZvcmUgcmVhY2hpbmcgYnVmZmVyZWQgcmFuZ2UgZW5kXG4gICAgICAgICAgICBwbGF5aGVhZE1vdmluZyA9IGN1cnJlbnRUaW1lID4gbWVkaWEucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lO1xuXG4gICAgICAgIGlmICh0aGlzLnN0YWxsZWQgJiYgcGxheWhlYWRNb3ZpbmcpIHtcbiAgICAgICAgICB0aGlzLnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBwbGF5YmFjayBub3Qgc3R1Y2sgYW55bW9yZSBAJHtjdXJyZW50VGltZX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjaGVjayBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiBsZXNzIHRoYW4gMjAwbXMgaXMgYnVmZmVyZWQsIGFuZCBtZWRpYSBpcyBleHBlY3RlZCB0byBwbGF5IGJ1dCBwbGF5aGVhZCBpcyBub3QgbW92aW5nLFxuICAgICAgICAvLyBhbmQgd2UgaGF2ZSBhIG5ldyBidWZmZXIgcmFuZ2UgYXZhaWxhYmxlIHVwZnJvbnQsIGxldCdzIHNlZWsgdG8gdGhhdCBvbmVcbiAgICAgICAgaWYoYnVmZmVySW5mby5sZW4gPD0ganVtcFRocmVzaG9sZCkge1xuICAgICAgICAgIGlmKHBsYXloZWFkTW92aW5nIHx8ICFleHBlY3RlZFBsYXlpbmcpIHtcbiAgICAgICAgICAgIC8vIHBsYXloZWFkIG1vdmluZyBvciBtZWRpYSBub3QgcGxheWluZ1xuICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHBsYXloZWFkIG5vdCBtb3ZpbmcgQU5EIG1lZGlhIGV4cGVjdGVkIHRvIHBsYXlcbiAgICAgICAgICAgIGlmKCF0aGlzLnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgcGxheWJhY2sgc2VlbXMgc3R1Y2sgQCR7Y3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX1NUQUxMRURfRVJST1IsIGZhdGFsOiBmYWxzZX0pO1xuICAgICAgICAgICAgICB0aGlzLnN0YWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpZiB3ZSBhcmUgYmVsb3cgdGhyZXNob2xkLCB0cnkgdG8ganVtcCBpZiBuZXh0IGJ1ZmZlciByYW5nZSBpcyBjbG9zZVxuICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgIC8vIG5vIGJ1ZmZlciBhdmFpbGFibGUgQCBjdXJyZW50VGltZSwgY2hlY2sgaWYgbmV4dCBidWZmZXIgaXMgY2xvc2UgKHdpdGhpbiBhIGNvbmZpZy5tYXhTZWVrSG9sZSBzZWNvbmQgcmFuZ2UpXG4gICAgICAgICAgICB2YXIgbmV4dEJ1ZmZlclN0YXJ0ID0gYnVmZmVySW5mby5uZXh0U3RhcnQsIGRlbHRhID0gbmV4dEJ1ZmZlclN0YXJ0LWN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgaWYobmV4dEJ1ZmZlclN0YXJ0ICYmXG4gICAgICAgICAgICAgICAoZGVsdGEgPCB0aGlzLmNvbmZpZy5tYXhTZWVrSG9sZSkgJiZcbiAgICAgICAgICAgICAgIChkZWx0YSA+IDApICAmJlxuICAgICAgICAgICAgICAgIW1lZGlhLnNlZWtpbmcpIHtcbiAgICAgICAgICAgICAgLy8gbmV4dCBidWZmZXIgaXMgY2xvc2UgISBhZGp1c3QgY3VycmVudFRpbWUgdG8gbmV4dEJ1ZmZlclN0YXJ0XG4gICAgICAgICAgICAgIC8vIHRoaXMgd2lsbCBlbnN1cmUgZWZmZWN0aXZlIHZpZGVvIGRlY29kaW5nXG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7bWVkaWEuY3VycmVudFRpbWV9IHRvIG5leHQgYnVmZmVyZWQgQCAke25leHRCdWZmZXJTdGFydH1gKTtcbiAgICAgICAgICAgICAgbWVkaWEuY3VycmVudFRpbWUgPSBuZXh0QnVmZmVyU3RhcnQ7XG4gICAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX1NFRUtfT1ZFUl9IT0xFLCBmYXRhbDogZmFsc2V9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHRhcmdldFNlZWtQb3NpdGlvbiAmJiBtZWRpYS5jdXJyZW50VGltZSAhPT0gdGFyZ2V0U2Vla1Bvc2l0aW9uKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGBhZGp1c3QgY3VycmVudFRpbWUgZnJvbSAke21lZGlhLmN1cnJlbnRUaW1lfSB0byAke3RhcmdldFNlZWtQb3NpdGlvbn1gKTtcbiAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gdGFyZ2V0U2Vla1Bvc2l0aW9uO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkKCkge1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25CdWZmZXJGbHVzaGVkKCkge1xuICAgIC8qIGFmdGVyIHN1Y2Nlc3NmdWwgYnVmZmVyIGZsdXNoaW5nLCByZWJ1aWxkIGJ1ZmZlciBSYW5nZSBhcnJheVxuICAgICAgbG9vcCB0aHJvdWdoIGV4aXN0aW5nIGJ1ZmZlciByYW5nZSBhbmQgY2hlY2sgaWZcbiAgICAgIGNvcnJlc3BvbmRpbmcgcmFuZ2UgaXMgc3RpbGwgYnVmZmVyZWQuIG9ubHkgcHVzaCB0byBuZXcgYXJyYXkgYWxyZWFkeSBidWZmZXJlZCByYW5nZVxuICAgICovXG4gICAgdmFyIG5ld1JhbmdlID0gW10scmFuZ2UsaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5idWZmZXJSYW5nZS5sZW5ndGg7IGkrKykge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZCgocmFuZ2Uuc3RhcnQgKyByYW5nZS5lbmQpIC8gMikpIHtcbiAgICAgICAgbmV3UmFuZ2UucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBuZXdSYW5nZTtcblxuICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICBpZiAodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgIHRoaXMuaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKTtcbiAgICB9XG4gICAgLy8gbW92ZSB0byBJRExFIG9uY2UgZmx1c2ggY29tcGxldGUuIHRoaXMgc2hvdWxkIHRyaWdnZXIgbmV3IGZyYWdtZW50IGxvYWRpbmdcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAvLyByZXNldCByZWZlcmVuY2UgdG8gZnJhZ1xuICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgfVxuXG4gIHN3YXBBdWRpb0NvZGVjKCkge1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSAhdGhpcy5hdWRpb0NvZGVjU3dhcDtcbiAgfVxuXG4gIHRpbWVSYW5nZXNUb1N0cmluZyhyKSB7XG4gICAgdmFyIGxvZyA9ICcnLCBsZW4gPSByLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcbiAgICAgIGxvZyArPSAnWycgKyByLnN0YXJ0KGkpICsgJywnICsgci5lbmQoaSkgKyAnXSc7XG4gICAgfVxuICAgIHJldHVybiBsb2c7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbUNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBUaW1lbGluZSBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQgQ0VBNzA4SW50ZXJwcmV0ZXIgZnJvbSAnLi4vdXRpbHMvY2VhLTcwOC1pbnRlcnByZXRlcic7XG5cbmNsYXNzIFRpbWVsaW5lQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5NRURJQV9BVFRBQ0hJTkcsXG4gICAgICAgICAgICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSxcbiAgICAgICAgICAgICAgICBFdmVudC5NQU5JRkVTVF9MT0FESU5HLFxuICAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BREVEKTtcblxuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcblxuICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVDRUE3MDhDYXB0aW9ucylcbiAgICB7XG4gICAgICB0aGlzLmNlYTcwOEludGVycHJldGVyID0gbmV3IENFQTcwOEludGVycHJldGVyKCk7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuYXR0YWNoKG1lZGlhKTtcbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5kZXRhY2goKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKClcbiAge1xuICAgIHRoaXMubGFzdFB0cyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZChkYXRhKVxuICB7XG4gICAgdmFyIHB0cyA9IGRhdGEuZnJhZy5zdGFydDsgLy9OdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cbiAgICAvLyBpZiB0aGlzIGlzIGEgZnJhZyBmb3IgYSBwcmV2aW91c2x5IGxvYWRlZCB0aW1lcmFuZ2UsIHJlbW92ZSBhbGwgY2FwdGlvbnNcbiAgICAvLyBUT0RPOiBjb25zaWRlciBqdXN0IHJlbW92aW5nIGNhcHRpb25zIGZvciB0aGUgdGltZXJhbmdlXG4gICAgaWYgKHB0cyA8PSB0aGlzLmxhc3RQdHMpXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5jbGVhcigpO1xuICAgIH1cblxuICAgIHRoaXMubGFzdFB0cyA9IHB0cztcbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdVc2VyZGF0YShkYXRhKSB7XG4gICAgLy8gcHVzaCBhbGwgb2YgdGhlIENFQS03MDggbWVzc2FnZXMgaW50byB0aGUgaW50ZXJwcmV0ZXJcbiAgICAvLyBpbW1lZGlhdGVseS4gSXQgd2lsbCBjcmVhdGUgdGhlIHByb3BlciB0aW1lc3RhbXBzIGJhc2VkIG9uIG91ciBQVFMgdmFsdWVcbiAgICBmb3IgKHZhciBpPTA7IGk8ZGF0YS5zYW1wbGVzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIucHVzaChkYXRhLnNhbXBsZXNbaV0ucHRzLCBkYXRhLnNhbXBsZXNbaV0uYnl0ZXMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUaW1lbGluZUNvbnRyb2xsZXI7XG4iLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuY2xhc3MgQUVTIHtcblxuICAvKipcbiAgICogU2NoZWR1bGUgb3V0IGFuIEFFUyBrZXkgZm9yIGJvdGggZW5jcnlwdGlvbiBhbmQgZGVjcnlwdGlvbi4gVGhpc1xuICAgKiBpcyBhIGxvdy1sZXZlbCBjbGFzcy4gVXNlIGEgY2lwaGVyIG1vZGUgdG8gZG8gYnVsayBlbmNyeXB0aW9uLlxuICAgKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIGtleSB7QXJyYXl9IFRoZSBrZXkgYXMgYW4gYXJyYXkgb2YgNCwgNiBvciA4IHdvcmRzLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioa2V5KSB7XG4gICAgLyoqXG4gICAgICogVGhlIGV4cGFuZGVkIFMtYm94IGFuZCBpbnZlcnNlIFMtYm94IHRhYmxlcy4gVGhlc2Ugd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIG9uIHRoZSBjbGllbnQgc28gdGhhdCB3ZSBkb24ndCBoYXZlIHRvIHNlbmQgdGhlbSBkb3duIHRoZSB3aXJlLlxuICAgICAqXG4gICAgICogVGhlcmUgYXJlIHR3byB0YWJsZXMsIF90YWJsZXNbMF0gaXMgZm9yIGVuY3J5cHRpb24gYW5kXG4gICAgICogX3RhYmxlc1sxXSBpcyBmb3IgZGVjcnlwdGlvbi5cbiAgICAgKlxuICAgICAqIFRoZSBmaXJzdCA0IHN1Yi10YWJsZXMgYXJlIHRoZSBleHBhbmRlZCBTLWJveCB3aXRoIE1peENvbHVtbnMuIFRoZVxuICAgICAqIGxhc3QgKF90YWJsZXNbMDFdWzRdKSBpcyB0aGUgUy1ib3ggaXRzZWxmLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl90YWJsZXMgPSBbW1tdLFtdLFtdLFtdLFtdXSxbW10sW10sW10sW10sW11dXTtcblxuICAgIHRoaXMuX3ByZWNvbXB1dGUoKTtcblxuICAgIHZhciBpLCBqLCB0bXAsXG4gICAgZW5jS2V5LCBkZWNLZXksXG4gICAgc2JveCA9IHRoaXMuX3RhYmxlc1swXVs0XSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAga2V5TGVuID0ga2V5Lmxlbmd0aCwgcmNvbiA9IDE7XG5cbiAgICBpZiAoa2V5TGVuICE9PSA0ICYmIGtleUxlbiAhPT0gNiAmJiBrZXlMZW4gIT09IDgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhZXMga2V5IHNpemU9JyArIGtleUxlbik7XG4gICAgfVxuXG4gICAgZW5jS2V5ID0ga2V5LnNsaWNlKDApO1xuICAgIGRlY0tleSA9IFtdO1xuICAgIHRoaXMuX2tleSA9IFtlbmNLZXksIGRlY0tleV07XG5cbiAgICAvLyBzY2hlZHVsZSBlbmNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGkgPSBrZXlMZW47IGkgPCA0ICoga2V5TGVuICsgMjg7IGkrKykge1xuICAgICAgdG1wID0gZW5jS2V5W2ktMV07XG5cbiAgICAgIC8vIGFwcGx5IHNib3hcbiAgICAgIGlmIChpJWtleUxlbiA9PT0gMCB8fCAoa2V5TGVuID09PSA4ICYmIGkla2V5TGVuID09PSA0KSkge1xuICAgICAgICB0bXAgPSBzYm94W3RtcD4+PjI0XTw8MjQgXiBzYm94W3RtcD4+MTYmMjU1XTw8MTYgXiBzYm94W3RtcD4+OCYyNTVdPDw4IF4gc2JveFt0bXAmMjU1XTtcblxuICAgICAgICAvLyBzaGlmdCByb3dzIGFuZCBhZGQgcmNvblxuICAgICAgICBpZiAoaSVrZXlMZW4gPT09IDApIHtcbiAgICAgICAgICB0bXAgPSB0bXA8PDggXiB0bXA+Pj4yNCBeIHJjb248PDI0O1xuICAgICAgICAgIHJjb24gPSByY29uPDwxIF4gKHJjb24+PjcpKjI4MztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlbmNLZXlbaV0gPSBlbmNLZXlbaS1rZXlMZW5dIF4gdG1wO1xuICAgIH1cblxuICAgIC8vIHNjaGVkdWxlIGRlY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaiA9IDA7IGk7IGorKywgaS0tKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaiYzID8gaSA6IGkgLSA0XTtcbiAgICAgIGlmIChpPD00IHx8IGo8NCkge1xuICAgICAgICBkZWNLZXlbal0gPSB0bXA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWNLZXlbal0gPSBkZWNUYWJsZVswXVtzYm94W3RtcD4+PjI0ICAgICAgXV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzFdW3Nib3hbdG1wPj4xNiAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMl1bc2JveFt0bXA+PjggICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVszXVtzYm94W3RtcCAgICAgICYgMjU1XV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4cGFuZCB0aGUgUy1ib3ggdGFibGVzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3ByZWNvbXB1dGUoKSB7XG4gICAgdmFyIGVuY1RhYmxlID0gdGhpcy5fdGFibGVzWzBdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBzYm94ID0gZW5jVGFibGVbNF0sIHNib3hJbnYgPSBkZWNUYWJsZVs0XSxcbiAgICBpLCB4LCB4SW52LCBkPVtdLCB0aD1bXSwgeDIsIHg0LCB4OCwgcywgdEVuYywgdERlYztcblxuICAgIC8vIENvbXB1dGUgZG91YmxlIGFuZCB0aGlyZCB0YWJsZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgMjU2OyBpKyspIHtcbiAgICAgIHRoWyggZFtpXSA9IGk8PDEgXiAoaT4+NykqMjgzICleaV09aTtcbiAgICB9XG5cbiAgICBmb3IgKHggPSB4SW52ID0gMDsgIXNib3hbeF07IHggXj0geDIgfHwgMSwgeEludiA9IHRoW3hJbnZdIHx8IDEpIHtcbiAgICAgIC8vIENvbXB1dGUgc2JveFxuICAgICAgcyA9IHhJbnYgXiB4SW52PDwxIF4geEludjw8MiBeIHhJbnY8PDMgXiB4SW52PDw0O1xuICAgICAgcyA9IHM+PjggXiBzJjI1NSBeIDk5O1xuICAgICAgc2JveFt4XSA9IHM7XG4gICAgICBzYm94SW52W3NdID0geDtcblxuICAgICAgLy8gQ29tcHV0ZSBNaXhDb2x1bW5zXG4gICAgICB4OCA9IGRbeDQgPSBkW3gyID0gZFt4XV1dO1xuICAgICAgdERlYyA9IHg4KjB4MTAxMDEwMSBeIHg0KjB4MTAwMDEgXiB4MioweDEwMSBeIHgqMHgxMDEwMTAwO1xuICAgICAgdEVuYyA9IGRbc10qMHgxMDEgXiBzKjB4MTAxMDEwMDtcblxuICAgICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICBlbmNUYWJsZVtpXVt4XSA9IHRFbmMgPSB0RW5jPDwyNCBeIHRFbmM+Pj44O1xuICAgICAgICBkZWNUYWJsZVtpXVtzXSA9IHREZWMgPSB0RGVjPDwyNCBeIHREZWM+Pj44O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbXBhY3RpZnkuIENvbnNpZGVyYWJsZSBzcGVlZHVwIG9uIEZpcmVmb3guXG4gICAgZm9yIChpID0gMDsgaSA8IDU7IGkrKykge1xuICAgICAgZW5jVGFibGVbaV0gPSBlbmNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICAgIGRlY1RhYmxlW2ldID0gZGVjVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERlY3J5cHQgMTYgYnl0ZXMsIHNwZWNpZmllZCBhcyBmb3VyIDMyLWJpdCB3b3Jkcy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZDAge251bWJlcn0gdGhlIGZpcnN0IHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMSB7bnVtYmVyfSB0aGUgc2Vjb25kIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMiB7bnVtYmVyfSB0aGUgdGhpcmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQzIHtudW1iZXJ9IHRoZSBmb3VydGggd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBvdXQge0ludDMyQXJyYXl9IHRoZSBhcnJheSB0byB3cml0ZSB0aGUgZGVjcnlwdGVkIHdvcmRzXG4gICAqIGludG9cbiAgICogQHBhcmFtIG9mZnNldCB7bnVtYmVyfSB0aGUgb2Zmc2V0IGludG8gdGhlIG91dHB1dCBhcnJheSB0byBzdGFydFxuICAgKiB3cml0aW5nIHJlc3VsdHNcbiAgICogQHJldHVybiB7QXJyYXl9IFRoZSBwbGFpbnRleHQuXG4gICAqL1xuICBkZWNyeXB0KGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsIG91dCwgb2Zmc2V0KSB7XG4gICAgdmFyIGtleSA9IHRoaXMuX2tleVsxXSxcbiAgICAvLyBzdGF0ZSB2YXJpYWJsZXMgYSxiLGMsZCBhcmUgbG9hZGVkIHdpdGggcHJlLXdoaXRlbmVkIGRhdGFcbiAgICBhID0gZW5jcnlwdGVkMCBeIGtleVswXSxcbiAgICBiID0gZW5jcnlwdGVkMyBeIGtleVsxXSxcbiAgICBjID0gZW5jcnlwdGVkMiBeIGtleVsyXSxcbiAgICBkID0gZW5jcnlwdGVkMSBeIGtleVszXSxcbiAgICBhMiwgYjIsIGMyLFxuXG4gICAgbklubmVyUm91bmRzID0ga2V5Lmxlbmd0aCAvIDQgLSAyLCAvLyBrZXkubGVuZ3RoID09PSAyID9cbiAgICBpLFxuICAgIGtJbmRleCA9IDQsXG4gICAgdGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG5cbiAgICAvLyBsb2FkIHVwIHRoZSB0YWJsZXNcbiAgICB0YWJsZTAgICAgPSB0YWJsZVswXSxcbiAgICB0YWJsZTEgICAgPSB0YWJsZVsxXSxcbiAgICB0YWJsZTIgICAgPSB0YWJsZVsyXSxcbiAgICB0YWJsZTMgICAgPSB0YWJsZVszXSxcbiAgICBzYm94ICA9IHRhYmxlWzRdO1xuXG4gICAgLy8gSW5uZXIgcm91bmRzLiBDcmliYmVkIGZyb20gT3BlblNTTC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbklubmVyUm91bmRzOyBpKyspIHtcbiAgICAgIGEyID0gdGFibGUwW2E+Pj4yNF0gXiB0YWJsZTFbYj4+MTYgJiAyNTVdIF4gdGFibGUyW2M+PjggJiAyNTVdIF4gdGFibGUzW2QgJiAyNTVdIF4ga2V5W2tJbmRleF07XG4gICAgICBiMiA9IHRhYmxlMFtiPj4+MjRdIF4gdGFibGUxW2M+PjE2ICYgMjU1XSBeIHRhYmxlMltkPj44ICYgMjU1XSBeIHRhYmxlM1thICYgMjU1XSBeIGtleVtrSW5kZXggKyAxXTtcbiAgICAgIGMyID0gdGFibGUwW2M+Pj4yNF0gXiB0YWJsZTFbZD4+MTYgJiAyNTVdIF4gdGFibGUyW2E+PjggJiAyNTVdIF4gdGFibGUzW2IgJiAyNTVdIF4ga2V5W2tJbmRleCArIDJdO1xuICAgICAgZCAgPSB0YWJsZTBbZD4+PjI0XSBeIHRhYmxlMVthPj4xNiAmIDI1NV0gXiB0YWJsZTJbYj4+OCAmIDI1NV0gXiB0YWJsZTNbYyAmIDI1NV0gXiBrZXlba0luZGV4ICsgM107XG4gICAgICBrSW5kZXggKz0gNDtcbiAgICAgIGE9YTI7IGI9YjI7IGM9YzI7XG4gICAgfVxuXG4gICAgLy8gTGFzdCByb3VuZC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICBvdXRbKDMgJiAtaSkgKyBvZmZzZXRdID1cbiAgICAgICAgc2JveFthPj4+MjQgICAgICBdPDwyNCBeXG4gICAgICAgIHNib3hbYj4+MTYgICYgMjU1XTw8MTYgXlxuICAgICAgICBzYm94W2M+PjggICAmIDI1NV08PDggIF5cbiAgICAgICAgc2JveFtkICAgICAgJiAyNTVdICAgICBeXG4gICAgICAgIGtleVtrSW5kZXgrK107XG4gICAgICBhMj1hOyBhPWI7IGI9YzsgYz1kOyBkPWEyO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRVM7XG4iLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuXG5pbXBvcnQgQUVTIGZyb20gJy4vYWVzJztcblxuY2xhc3MgQUVTMTI4RGVjcnlwdGVyIHtcblxuICBjb25zdHJ1Y3RvcihrZXksIGluaXRWZWN0b3IpIHtcbiAgICB0aGlzLmtleSA9IGtleTtcbiAgICB0aGlzLml2ID0gaW5pdFZlY3RvcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IG5ldHdvcmstb3JkZXIgKGJpZy1lbmRpYW4pIGJ5dGVzIGludG8gdGhlaXIgbGl0dGxlLWVuZGlhblxuICAgKiByZXByZXNlbnRhdGlvbi5cbiAgICovXG4gIG50b2god29yZCkge1xuICAgIHJldHVybiAod29yZCA8PCAyNCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwKSA8PCA4KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDAwMCkgPj4gOCkgfFxuICAgICAgKHdvcmQgPj4+IDI0KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERlY3J5cHQgYnl0ZXMgdXNpbmcgQUVTLTEyOCB3aXRoIENCQyBhbmQgUEtDUyM3IHBhZGRpbmcuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQge1VpbnQ4QXJyYXl9IHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICogQHBhcmFtIGtleSB7VWludDMyQXJyYXl9IHRoZSBieXRlcyBvZiB0aGUgZGVjcnlwdGlvbiBrZXlcbiAgICogQHBhcmFtIGluaXRWZWN0b3Ige1VpbnQzMkFycmF5fSB0aGUgaW5pdGlhbGl6YXRpb24gdmVjdG9yIChJVikgdG9cbiAgICogdXNlIGZvciB0aGUgZmlyc3Qgcm91bmQgb2YgQ0JDLlxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgZGVjcnlwdGVkIGJ5dGVzXG4gICAqXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BZHZhbmNlZF9FbmNyeXB0aW9uX1N0YW5kYXJkXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CbG9ja19jaXBoZXJfbW9kZV9vZl9vcGVyYXRpb24jQ2lwaGVyX0Jsb2NrX0NoYWluaW5nXy4yOENCQy4yOVxuICAgKiBAc2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMzE1XG4gICAqL1xuICBkb0RlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IpIHtcbiAgICB2YXJcbiAgICAgIC8vIHdvcmQtbGV2ZWwgYWNjZXNzIHRvIHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkLmJ1ZmZlciwgZW5jcnlwdGVkLmJ5dGVPZmZzZXQsIGVuY3J5cHRlZC5ieXRlTGVuZ3RoID4+IDIpLFxuXG4gICAgZGVjaXBoZXIgPSBuZXcgQUVTKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGtleSkpLFxuXG4gICAgLy8gYnl0ZSBhbmQgd29yZC1sZXZlbCBhY2Nlc3MgZm9yIHRoZSBkZWNyeXB0ZWQgb3V0cHV0XG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGRlY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZGVjcnlwdGVkLmJ1ZmZlciksXG5cbiAgICAvLyB0ZW1wb3JhcnkgdmFyaWFibGVzIGZvciB3b3JraW5nIHdpdGggdGhlIElWLCBlbmNyeXB0ZWQsIGFuZFxuICAgIC8vIGRlY3J5cHRlZCBkYXRhXG4gICAgaW5pdDAsIGluaXQxLCBpbml0MiwgaW5pdDMsXG4gICAgZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMyxcblxuICAgIC8vIGl0ZXJhdGlvbiB2YXJpYWJsZVxuICAgIHdvcmRJeDtcblxuICAgIC8vIHB1bGwgb3V0IHRoZSB3b3JkcyBvZiB0aGUgSVYgdG8gZW5zdXJlIHdlIGRvbid0IG1vZGlmeSB0aGVcbiAgICAvLyBwYXNzZWQtaW4gcmVmZXJlbmNlIGFuZCBlYXNpZXIgYWNjZXNzXG4gICAgaW5pdDAgPSB+fmluaXRWZWN0b3JbMF07XG4gICAgaW5pdDEgPSB+fmluaXRWZWN0b3JbMV07XG4gICAgaW5pdDIgPSB+fmluaXRWZWN0b3JbMl07XG4gICAgaW5pdDMgPSB+fmluaXRWZWN0b3JbM107XG5cbiAgICAvLyBkZWNyeXB0IGZvdXIgd29yZCBzZXF1ZW5jZXMsIGFwcGx5aW5nIGNpcGhlci1ibG9jayBjaGFpbmluZyAoQ0JDKVxuICAgIC8vIHRvIGVhY2ggZGVjcnlwdGVkIGJsb2NrXG4gICAgZm9yICh3b3JkSXggPSAwOyB3b3JkSXggPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IHdvcmRJeCArPSA0KSB7XG4gICAgICAvLyBjb252ZXJ0IGJpZy1lbmRpYW4gKG5ldHdvcmsgb3JkZXIpIHdvcmRzIGludG8gbGl0dGxlLWVuZGlhblxuICAgICAgLy8gKGphdmFzY3JpcHQgb3JkZXIpXG4gICAgICBlbmNyeXB0ZWQwID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4XSk7XG4gICAgICBlbmNyeXB0ZWQxID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgMV0pO1xuICAgICAgZW5jcnlwdGVkMiA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDJdKTtcbiAgICAgIGVuY3J5cHRlZDMgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAzXSk7XG5cbiAgICAgIC8vIGRlY3J5cHQgdGhlIGJsb2NrXG4gICAgICBkZWNpcGhlci5kZWNyeXB0KGVuY3J5cHRlZDAsXG4gICAgICAgICAgZW5jcnlwdGVkMSxcbiAgICAgICAgICBlbmNyeXB0ZWQyLFxuICAgICAgICAgIGVuY3J5cHRlZDMsXG4gICAgICAgICAgZGVjcnlwdGVkMzIsXG4gICAgICAgICAgd29yZEl4KTtcblxuICAgICAgLy8gWE9SIHdpdGggdGhlIElWLCBhbmQgcmVzdG9yZSBuZXR3b3JrIGJ5dGUtb3JkZXIgdG8gb2J0YWluIHRoZVxuICAgICAgLy8gcGxhaW50ZXh0XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXhdICAgICA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXhdIF4gaW5pdDApO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gXiBpbml0MSk7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSBeIGluaXQyKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdIF4gaW5pdDMpO1xuXG4gICAgICAvLyBzZXR1cCB0aGUgSVYgZm9yIHRoZSBuZXh0IHJvdW5kXG4gICAgICBpbml0MCA9IGVuY3J5cHRlZDA7XG4gICAgICBpbml0MSA9IGVuY3J5cHRlZDE7XG4gICAgICBpbml0MiA9IGVuY3J5cHRlZDI7XG4gICAgICBpbml0MyA9IGVuY3J5cHRlZDM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY3J5cHRlZDtcbiAgfVxuXG4gIGxvY2FsRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKSB7XG4gICAgdmFyIGJ5dGVzID0gdGhpcy5kb0RlY3J5cHQoZW5jcnlwdGVkLFxuICAgICAgICBrZXksXG4gICAgICAgIGluaXRWZWN0b3IpO1xuICAgIGRlY3J5cHRlZC5zZXQoYnl0ZXMsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0KTtcbiAgfVxuXG4gIGRlY3J5cHQoZW5jcnlwdGVkKSB7XG4gICAgdmFyXG4gICAgICBzdGVwID0gNCAqIDgwMDAsXG4gICAgLy9lbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIpLFxuICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkKSxcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgaSA9IDA7XG5cbiAgICAvLyBzcGxpdCB1cCB0aGUgZW5jcnlwdGlvbiBqb2IgYW5kIGRvIHRoZSBpbmRpdmlkdWFsIGNodW5rcyBhc3luY2hyb25vdXNseVxuICAgIHZhciBrZXkgPSB0aGlzLmtleTtcbiAgICB2YXIgaW5pdFZlY3RvciA9IHRoaXMuaXY7XG4gICAgdGhpcy5sb2NhbERlY3J5cHQoZW5jcnlwdGVkMzIuc3ViYXJyYXkoaSwgaSArIHN0ZXApLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCk7XG5cbiAgICBmb3IgKGkgPSBzdGVwOyBpIDwgZW5jcnlwdGVkMzIubGVuZ3RoOyBpICs9IHN0ZXApIHtcbiAgICAgIGluaXRWZWN0b3IgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gNF0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gM10pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMl0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMV0pXG4gICAgICBdKTtcbiAgICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTMTI4RGVjcnlwdGVyO1xuIiwiLypcbiAqIEFFUzEyOCBkZWNyeXB0aW9uLlxuICovXG5cbmltcG9ydCBBRVMxMjhEZWNyeXB0ZXIgZnJvbSAnLi9hZXMxMjgtZGVjcnlwdGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJyb3dzZXJDcnlwdG8gPSB3aW5kb3cgPyB3aW5kb3cuY3J5cHRvIDogY3J5cHRvO1xuICAgICAgdGhpcy5zdWJ0bGUgPSBicm93c2VyQ3J5cHRvLnN1YnRsZSB8fCBicm93c2VyQ3J5cHRvLndlYmtpdFN1YnRsZTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9ICF0aGlzLnN1YnRsZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBkZWNyeXB0KGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuZGlzYWJsZVdlYkNyeXB0byAmJiB0aGlzLmhscy5jb25maWcuZW5hYmxlU29mdHdhcmVBRVMpIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBXZWJDcnlwdG8gQVBJJyk7XG5cbiAgICB0aGlzLnN1YnRsZS5pbXBvcnRLZXkoJ3JhdycsIGtleSwgeyBuYW1lIDogJ0FFUy1DQkMnLCBsZW5ndGggOiAxMjggfSwgZmFsc2UsIFsnZGVjcnlwdCddKS5cbiAgICAgIHRoZW4oKGltcG9ydGVkS2V5KSA9PiB7XG4gICAgICAgIHRoaXMuc3VidGxlLmRlY3J5cHQoeyBuYW1lIDogJ0FFUy1DQkMnLCBpdiA6IGl2LmJ1ZmZlciB9LCBpbXBvcnRlZEtleSwgZGF0YSkuXG4gICAgICAgICAgdGhlbihjYWxsYmFjaykuXG4gICAgICAgICAgY2F0Y2ggKChlcnIpID0+IHtcbiAgICAgICAgICAgIHRoaXMub25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLlxuICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSk7XG4gIH1cblxuICBkZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXk4LCBpdjgsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBKYXZhU2NyaXB0IEltcGxlbWVudGF0aW9uJyk7XG5cbiAgICB2YXIgdmlldyA9IG5ldyBEYXRhVmlldyhrZXk4LmJ1ZmZlcik7XG4gICAgdmFyIGtleSA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhpdjguYnVmZmVyKTtcbiAgICB2YXIgaXYgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZhciBkZWNyeXB0ZXIgPSBuZXcgQUVTMTI4RGVjcnlwdGVyKGtleSwgaXYpO1xuICAgIGNhbGxiYWNrKGRlY3J5cHRlci5kZWNyeXB0KGRhdGEpLmJ1ZmZlcik7XG4gIH1cblxuICBvbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNhYmxpbmcgdG8gdXNlIFdlYkNyeXB0byBBUEknKTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBsb2dnZXIuZXJyb3IoYGRlY3J5cHRpbmcgZXJyb3IgOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfREVDUllQVF9FUlJPUiwgZmF0YWwgOiB0cnVlLCByZWFzb24gOiBlcnIubWVzc2FnZX0pO1xuICAgIH1cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlY3J5cHRlcjtcbiIsIi8qKlxuICogQUFDIGRlbXV4ZXJcbiAqL1xuaW1wb3J0IEFEVFMgZnJvbSAnLi9hZHRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IElEMyBmcm9tICcuLi9kZW11eC9pZDMnO1xuXG4gY2xhc3MgQUFDRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIscmVtdXhlckNsYXNzKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMucmVtdXhlckNsYXNzID0gcmVtdXhlckNsYXNzO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7Y29udGFpbmVyIDogJ2F1ZGlvL2FkdHMnLCB0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICB9XG5cbiAgc3RhdGljIHByb2JlKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBkYXRhIGNvbnRhaW5zIElEMyB0aW1lc3RhbXAgYW5kIEFEVFMgc3luYyB3b3JjXG4gICAgdmFyIGlkMyA9IG5ldyBJRDMoZGF0YSksIG9mZnNldCxsZW47XG4gICAgaWYoaWQzLmhhc1RpbWVTdGFtcCkge1xuICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgIGZvciAob2Zmc2V0ID0gaWQzLmxlbmd0aCwgbGVuID0gZGF0YS5sZW5ndGg7IG9mZnNldCA8IGxlbiAtIDE7IG9mZnNldCsrKSB7XG4gICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQURUUyBzeW5jIHdvcmQgZm91bmQgIScpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGlkMyA9IG5ldyBJRDMoZGF0YSksXG4gICAgICAgIHB0cyA9IDkwKmlkMy50aW1lU3RhbXAsXG4gICAgICAgIGNvbmZpZywgZnJhbWVMZW5ndGgsIGZyYW1lRHVyYXRpb24sIGZyYW1lSW5kZXgsIG9mZnNldCwgaGVhZGVyTGVuZ3RoLCBzdGFtcCwgbGVuLCBhYWNTYW1wbGU7XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKG9mZnNldCA9IGlkMy5sZW5ndGgsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdHJhY2suYXVkaW9zYW1wbGVyYXRlKSB7XG4gICAgICBjb25maWcgPSBBRFRTLmdldEF1ZGlvQ29uZmlnKHRoaXMub2JzZXJ2ZXIsZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLmR1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgZnJhbWVJbmRleCA9IDA7XG4gICAgZnJhbWVEdXJhdGlvbiA9IDEwMjQgKiA5MDAwMCAvIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICB3aGlsZSAoKG9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyBUaGUgcHJvdGVjdGlvbiBza2lwIGJpdCB0ZWxscyB1cyBpZiB3ZSBoYXZlIDIgYnl0ZXMgb2YgQ1JDIGRhdGEgYXQgdGhlIGVuZCBvZiB0aGUgQURUUyBoZWFkZXJcbiAgICAgIGhlYWRlckxlbmd0aCA9ICghIShkYXRhW29mZnNldCArIDFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBmcmFtZUxlbmd0aCA9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MDMpIDw8IDExKSB8XG4gICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQgKyA0XSA8PCAzKSB8XG4gICAgICAgICAgICAgICAgICAgICgoZGF0YVtvZmZzZXQgKyA1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGZyYW1lTGVuZ3RoICAtPSBoZWFkZXJMZW5ndGg7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcblxuICAgICAgaWYgKChmcmFtZUxlbmd0aCA+IDApICYmICgob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpIDw9IGxlbikpIHtcbiAgICAgICAgc3RhbXAgPSBwdHMgKyBmcmFtZUluZGV4ICogZnJhbWVEdXJhdGlvbjtcbiAgICAgICAgLy9sb2dnZXIubG9nKGBBQUMgZnJhbWUsIG9mZnNldC9sZW5ndGgvdG90YWwvcHRzOiR7b2Zmc2V0K2hlYWRlckxlbmd0aH0vJHtmcmFtZUxlbmd0aH0vJHtkYXRhLmJ5dGVMZW5ndGh9LyR7KHN0YW1wLzkwKS50b0ZpeGVkKDApfWApO1xuICAgICAgICBhYWNTYW1wbGUgPSB7dW5pdDogZGF0YS5zdWJhcnJheShvZmZzZXQgKyBoZWFkZXJMZW5ndGgsIG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSwgcHRzOiBzdGFtcCwgZHRzOiBzdGFtcH07XG4gICAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gZnJhbWVMZW5ndGg7XG4gICAgICAgIG9mZnNldCArPSBmcmFtZUxlbmd0aCArIGhlYWRlckxlbmd0aDtcbiAgICAgICAgZnJhbWVJbmRleCsrO1xuICAgICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgICBmb3IgKCA7IG9mZnNldCA8IChsZW4gLSAxKTsgb2Zmc2V0KyspIHtcbiAgICAgICAgICBpZiAoKGRhdGFbb2Zmc2V0XSA9PT0gMHhmZikgJiYgKChkYXRhW29mZnNldCArIDFdICYgMHhmMCkgPT09IDB4ZjApKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2sse3NhbXBsZXMgOiBbXX0sIHtzYW1wbGVzIDogWyB7IHB0czogcHRzLCBkdHMgOiBwdHMsIHVuaXQgOiBpZDMucGF5bG9hZH0gXX0sIHsgc2FtcGxlczogW10gfSwgdGltZU9mZnNldCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUFDRGVtdXhlcjtcbiIsIi8qKlxuICogIEFEVFMgcGFyc2VyIGhlbHBlclxuICovXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgQURUUyB7XG5cbiAgc3RhdGljIGdldEF1ZGlvQ29uZmlnKG9ic2VydmVyLCBkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpIHtcbiAgICB2YXIgYWR0c09iamVjdFR5cGUsIC8vIDppbnRcbiAgICAgICAgYWR0c1NhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzQ2hhbmVsQ29uZmlnLCAvLyA6aW50XG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgdXNlckFnZW50ID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBhZHRzU2FtcGxlaW5nUmF0ZXMgPSBbXG4gICAgICAgICAgICA5NjAwMCwgODgyMDAsXG4gICAgICAgICAgICA2NDAwMCwgNDgwMDAsXG4gICAgICAgICAgICA0NDEwMCwgMzIwMDAsXG4gICAgICAgICAgICAyNDAwMCwgMjIwNTAsXG4gICAgICAgICAgICAxNjAwMCwgMTIwMDAsXG4gICAgICAgICAgICAxMTAyNSwgODAwMCxcbiAgICAgICAgICAgIDczNTBdO1xuICAgIC8vIGJ5dGUgMlxuICAgIGFkdHNPYmplY3RUeXBlID0gKChkYXRhW29mZnNldCArIDJdICYgMHhDMCkgPj4+IDYpICsgMTtcbiAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgaWYoYWR0c1NhbXBsZWluZ0luZGV4ID4gYWR0c1NhbXBsZWluZ1JhdGVzLmxlbmd0aC0xKSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogYGludmFsaWQgQURUUyBzYW1wbGluZyBpbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1gfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4QzApID4+PiA2KTtcbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfUh6XSxjaGFubmVsQ29uZmlnOiR7YWR0c0NoYW5lbENvbmZpZ31gKTtcbiAgICAvLyBmaXJlZm94OiBmcmVxIGxlc3MgdGhhbiAyNGtIeiA9IEFBQyBTQlIgKEhFLUFBQylcbiAgICBpZiAodXNlckFnZW50LmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEpIHtcbiAgICAgIGlmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgICAgLy8gQW5kcm9pZCA6IGFsd2F5cyB1c2UgQUFDXG4gICAgfSBlbHNlIGlmICh1c2VyQWdlbnQuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICAvKiAgZm9yIG90aGVyIGJyb3dzZXJzIChjaHJvbWUgLi4uKVxuICAgICAgICAgIGFsd2F5cyBmb3JjZSBhdWRpbyB0eXBlIHRvIGJlIEhFLUFBQyBTQlIsIGFzIHNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoIHByb3Blcmx5IChsaWtlIENocm9tZSAuLi4pXG4gICAgICAqL1xuICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEhFLUFBQyBvciBIRS1BQUN2MikgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgQU5EIGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHopXG4gICAgICBpZiAoKGF1ZGlvQ29kZWMgJiYgKChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMjknKSAhPT0gLTEpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkpKSB8fFxuICAgICAgICAgICghYXVkaW9Db2RlYyAmJiBhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikpIHtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgQUFDKSBBTkQgKGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHogQU5EIG5iIGNoYW5uZWwgaXMgMSkgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgYW5kIG1vbm8gYXVkaW8pXG4gICAgICAgIC8vIENocm9tZSBmYWlscyB0byBwbGF5IGJhY2sgd2l0aCBsb3cgZnJlcXVlbmN5IEFBQyBMQyBtb25vIHdoZW4gaW5pdGlhbGl6ZWQgd2l0aCBIRS1BQUMuICBUaGlzIGlzIG5vdCBhIHByb2JsZW0gd2l0aCBzdGVyZW8uXG4gICAgICAgIGlmIChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xICYmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNiAmJiBhZHRzQ2hhbmVsQ29uZmlnID09PSAxKSB8fFxuICAgICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNDaGFuZWxDb25maWcgPT09IDEpKSB7XG4gICAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAgICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZiAoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4ge2NvbmZpZzogY29uZmlnLCBzYW1wbGVyYXRlOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50OiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYzogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFEVFM7XG4iLCIvKiAgaW5saW5lIGRlbXV4ZXIuXG4gKiAgIHByb2JlIGZyYWdtZW50cyBhbmQgaW5zdGFudGlhdGUgYXBwcm9wcmlhdGUgZGVtdXhlciBkZXBlbmRpbmcgb24gY29udGVudCB0eXBlIChUU0RlbXV4ZXIsIEFBQ0RlbXV4ZXIsIC4uLilcbiAqL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IEFBQ0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvYWFjZGVtdXhlcic7XG5pbXBvcnQgVFNEZW11eGVyIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG5pbXBvcnQgTVA0UmVtdXhlciBmcm9tICcuLi9yZW11eC9tcDQtcmVtdXhlcic7XG5pbXBvcnQgUGFzc1Rocm91Z2hSZW11eGVyIGZyb20gJy4uL3JlbXV4L3Bhc3N0aHJvdWdoLXJlbXV4ZXInO1xuXG5jbGFzcyBEZW11eGVySW5saW5lIHtcblxuICBjb25zdHJ1Y3RvcihobHMsdHlwZVN1cHBvcnRlZCkge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMudHlwZVN1cHBvcnRlZCA9IHR5cGVTdXBwb3J0ZWQ7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmIChkZW11eGVyKSB7XG4gICAgICBkZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXI7XG4gICAgaWYgKCFkZW11eGVyKSB7XG4gICAgICB2YXIgaGxzID0gdGhpcy5obHM7XG4gICAgICAvLyBwcm9iZSBmb3IgY29udGVudCB0eXBlXG4gICAgICBpZiAoVFNEZW11eGVyLnByb2JlKGRhdGEpKSB7XG4gICAgICAgIGlmICh0aGlzLnR5cGVTdXBwb3J0ZWQubXAydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIGRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKGhscyxQYXNzVGhyb3VnaFJlbXV4ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKGhscyxNUDRSZW11eGVyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKEFBQ0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgZGVtdXhlciA9IG5ldyBBQUNEZW11eGVyKGhscyxNUDRSZW11eGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCByZWFzb246ICdubyBkZW11eCBtYXRjaGluZyB3aXRoIGNvbnRlbnQgZm91bmQnfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhlciA9IGRlbXV4ZXI7XG4gICAgfVxuICAgIGRlbXV4ZXIucHVzaChkYXRhLGF1ZGlvQ29kZWMsdmlkZW9Db2RlYyx0aW1lT2Zmc2V0LGNjLGxldmVsLHNuLGR1cmF0aW9uKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVySW5saW5lO1xuIiwiLyogZGVtdXhlciB3ZWIgd29ya2VyLlxuICogIC0gbGlzdGVuIHRvIHdvcmtlciBtZXNzYWdlLCBhbmQgdHJpZ2dlciBEZW11eGVySW5saW5lIHVwb24gcmVjZXB0aW9uIG9mIEZyYWdtZW50cy5cbiAqICAtIHByb3ZpZGVzIE1QNCBCb3hlcyBiYWNrIHRvIG1haW4gdGhyZWFkIHVzaW5nIFt0cmFuc2ZlcmFibGUgb2JqZWN0c10oaHR0cHM6Ly9kZXZlbG9wZXJzLmdvb2dsZS5jb20vd2ViL3VwZGF0ZXMvMjAxMS8xMi9UcmFuc2ZlcmFibGUtT2JqZWN0cy1MaWdodG5pbmctRmFzdCkgaW4gb3JkZXIgdG8gbWluaW1pemUgbWVzc2FnZSBwYXNzaW5nIG92ZXJoZWFkLlxuICovXG5cbiBpbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuXG52YXIgRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gIC8vIG9ic2VydmVyIHNldHVwXG4gIHZhciBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuXG4gIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gIH07XG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgIHZhciBkYXRhID0gZXYuZGF0YTtcbiAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZGF0YS5jbWQpO1xuICAgIHN3aXRjaCAoZGF0YS5jbWQpIHtcbiAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICBzZWxmLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShvYnNlcnZlciwgZGF0YS50eXBlU3VwcG9ydGVkKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YSksIGRhdGEuYXVkaW9Db2RlYywgZGF0YS52aWRlb0NvZGVjLCBkYXRhLnRpbWVPZmZzZXQsIGRhdGEuY2MsIGRhdGEubGV2ZWwsIGRhdGEuc24sIGRhdGEuZHVyYXRpb24pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgRGVtdXhlclxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldiwgdHJhY2tzIDogZGF0YS50cmFja3MsIHVuaXF1ZSA6IGRhdGEudW5pcXVlIH0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXYsIHR5cGU6IGRhdGEudHlwZSwgc3RhcnRQVFM6IGRhdGEuc3RhcnRQVFMsIGVuZFBUUzogZGF0YS5lbmRQVFMsIHN0YXJ0RFRTOiBkYXRhLnN0YXJ0RFRTLCBlbmREVFM6IGRhdGEuZW5kRFRTLCBkYXRhMTogZGF0YS5kYXRhMS5idWZmZXIsIGRhdGEyOiBkYXRhLmRhdGEyLmJ1ZmZlciwgbmI6IGRhdGEubmJ9O1xuICAgIC8vIHBhc3MgZGF0YTEvZGF0YTIgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsIFtvYmpEYXRhLmRhdGExLCBvYmpEYXRhLmRhdGEyXSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCBmdW5jdGlvbihldmVudCkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudH0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnQsIGRhdGE6IGRhdGF9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldmVudCwgc2FtcGxlczogZGF0YS5zYW1wbGVzfTtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xuXG59O1xuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyV29ya2VyO1xuXG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbmltcG9ydCBEZW11eGVyV29ya2VyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItd29ya2VyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IERlY3J5cHRlciBmcm9tICcuLi9jcnlwdC9kZWNyeXB0ZXInO1xuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB2YXIgdHlwZVN1cHBvcnRlZCA9IHtcbiAgICAgIG1wNCA6IE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0JyksXG4gICAgICBtcDJ0IDogaGxzLmNvbmZpZy5lbmFibGVNUDJUUGFzc1Rocm91Z2ggJiYgTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDJ0JylcbiAgICB9O1xuICAgIGlmIChobHMuY29uZmlnLmVuYWJsZVdvcmtlciAmJiAodHlwZW9mKFdvcmtlcikgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICBsb2dnZXIubG9nKCdkZW11eGluZyBpbiB3ZWJ3b3JrZXInKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgd29yayA9IHJlcXVpcmUoJ3dlYndvcmtpZnknKTtcbiAgICAgICAgICB0aGlzLncgPSB3b3JrKERlbXV4ZXJXb3JrZXIpO1xuICAgICAgICAgIHRoaXMub253bXNnID0gdGhpcy5vbldvcmtlck1lc3NhZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgICB0aGlzLncuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgICAgICB0aGlzLncucG9zdE1lc3NhZ2Uoe2NtZDogJ2luaXQnLCB0eXBlU3VwcG9ydGVkIDogdHlwZVN1cHBvcnRlZH0pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcignZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIERlbXV4ZXJXb3JrZXIsIGZhbGxiYWNrIG9uIERlbXV4ZXJJbmxpbmUnKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsdHlwZVN1cHBvcnRlZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyx0eXBlU3VwcG9ydGVkKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmRlY3J5cHRlcikge1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICBpZiAodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2Uoe2NtZDogJ2RlbXV4JywgZGF0YTogZGF0YSwgYXVkaW9Db2RlYzogYXVkaW9Db2RlYywgdmlkZW9Db2RlYzogdmlkZW9Db2RlYywgdGltZU9mZnNldDogdGltZU9mZnNldCwgY2M6IGNjLCBsZXZlbDogbGV2ZWwsIHNuIDogc24sIGR1cmF0aW9uOiBkdXJhdGlvbn0sIFtkYXRhXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEpLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgZGVjcnlwdGRhdGEpIHtcbiAgICBpZiAoKGRhdGEuYnl0ZUxlbmd0aCA+IDApICYmIChkZWNyeXB0ZGF0YSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEua2V5ICE9IG51bGwpICYmIChkZWNyeXB0ZGF0YS5tZXRob2QgPT09ICdBRVMtMTI4JykpIHtcbiAgICAgIGlmICh0aGlzLmRlY3J5cHRlciA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuZGVjcnlwdGVyID0gbmV3IERlY3J5cHRlcih0aGlzLmhscyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBsb2NhbHRoaXMgPSB0aGlzO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVjcnlwdChkYXRhLCBkZWNyeXB0ZGF0YS5rZXksIGRlY3J5cHRkYXRhLml2LCBmdW5jdGlvbihkZWNyeXB0ZWREYXRhKXtcbiAgICAgICAgbG9jYWx0aGlzLnB1c2hEZWNyeXB0ZWQoZGVjcnlwdGVkRGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHVzaERlY3J5cHRlZChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgb25Xb3JrZXJNZXNzYWdlKGV2KSB7XG4gICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBvYmoudHJhY2tzID0gZGF0YS50cmFja3M7XG4gICAgICAgIG9iai51bmlxdWUgPSBkYXRhLnVuaXF1ZTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBvYmopO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgICAgIGRhdGExOiBuZXcgVWludDhBcnJheShkYXRhLmRhdGExKSxcbiAgICAgICAgICBkYXRhMjogbmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhMiksXG4gICAgICAgICAgc3RhcnRQVFM6IGRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTOiBkYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUzogZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFM6IGRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGU6IGRhdGEudHlwZSxcbiAgICAgICAgICBuYjogZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKGRhdGEuZXZlbnQsIGRhdGEuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuXG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZyBzY2hlbWUgdXNlZCBieSBoMjY0LlxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy5kYXRhXG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aCAtIHRoaXMuYnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy5ieXRlc0F2YWlsYWJsZSk7XG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMuZGF0YS5zdWJhcnJheShwb3NpdGlvbiwgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLmRhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLmJpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMuYml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcbiAgICBpZiAoc2l6ZSA+IDMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExaKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLmJpdHNBdmFpbGFibGU7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMWigpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVUVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVRUcoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExaKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFRygpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVFRygpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVU2hvcnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMTYpO1xuICB9XG4gICAgLy8gKCk6aW50XG4gIHJlYWRVSW50KCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDMyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEVHKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNQUygpIHtcbiAgICB2YXJcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IDAsXG4gICAgICBzYXJTY2FsZSA9IDEsXG4gICAgICBwcm9maWxlSWRjLHByb2ZpbGVDb21wYXQsbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdCA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNF1fZmxhZywgdSg1KVxuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vIHJlc2VydmVkX3plcm9fM2JpdHMgdSgzKSxcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMjQ0IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDQ0ICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4MyAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gODYgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExOCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjgpIHtcbiAgICAgIHZhciBjaHJvbWFGb3JtYXRJZGMgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfY2hyb21hX21pbnVzOFxuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gcXBwcmltZV95X3plcm9fdHJhbnNmb3JtX2J5cGFzc19mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX21hdHJpeF9wcmVzZW50X2ZsYWdcbiAgICAgICAgc2NhbGluZ0xpc3RDb3VudCA9IChjaHJvbWFGb3JtYXRJZGMgIT09IDMpID8gOCA6IDEyO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2NhbGluZ0xpc3RDb3VudDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19saXN0X3ByZXNlbnRfZmxhZ1sgaSBdXG4gICAgICAgICAgICBpZiAoaSA8IDYpIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoMTYpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVRUcoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfdG9wX3RvX2JvdHRvbV9maWVsZFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3JlZl9mcmFtZVsgaSBdXG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcbiAgICBwaWNXaWR0aEluTWJzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGZyYW1lTWJzT25seUZsYWcgPSB0aGlzLnJlYWRCaXRzKDEpO1xuICAgIGlmIChmcmFtZU1ic09ubHlGbGFnID09PSAwKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBtYl9hZGFwdGl2ZV9mcmFtZV9maWVsZF9mbGFnXG4gICAgfVxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgIH1cbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7XG4gICAgICAvLyB2dWlfcGFyYW1ldGVyc19wcmVzZW50X2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgICAgLy8gYXNwZWN0X3JhdGlvX2luZm9fcHJlc2VudF9mbGFnXG4gICAgICAgIGxldCBzYXJSYXRpbztcbiAgICAgICAgY29uc3QgYXNwZWN0UmF0aW9JZGMgPSB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgICAgICBzd2l0Y2ggKGFzcGVjdFJhdGlvSWRjKSB7XG4gICAgICAgICAgY2FzZSAxOiBzYXJSYXRpbyA9IFsxLDFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDI6IHNhclJhdGlvID0gWzEyLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOiBzYXJSYXRpbyA9IFsxMCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNDogc2FyUmF0aW8gPSBbMTYsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDU6IHNhclJhdGlvID0gWzQwLDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA2OiBzYXJSYXRpbyA9IFsyNCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNzogc2FyUmF0aW8gPSBbMjAsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDg6IHNhclJhdGlvID0gWzMyLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA5OiBzYXJSYXRpbyA9IFs4MCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTA6IHNhclJhdGlvID0gWzE4LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMTogc2FyUmF0aW8gPSBbMTUsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEyOiBzYXJSYXRpbyA9IFs2NCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTM6IHNhclJhdGlvID0gWzE2MCw5OV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTQ6IHNhclJhdGlvID0gWzQsM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTU6IHNhclJhdGlvID0gWzMsMl07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTY6IHNhclJhdGlvID0gWzIsMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjU1OiB7XG4gICAgICAgICAgICBzYXJSYXRpbyA9IFt0aGlzLnJlYWRVQnl0ZSgpIDw8IDggfCB0aGlzLnJlYWRVQnl0ZSgpLCB0aGlzLnJlYWRVQnl0ZSgpIDw8IDggfCB0aGlzLnJlYWRVQnl0ZSgpXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoc2FyUmF0aW8pIHtcbiAgICAgICAgICBzYXJTY2FsZSA9IHNhclJhdGlvWzBdIC8gc2FyUmF0aW9bMV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBNYXRoLmNlaWwoKCgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIpICogc2FyU2NhbGUpLFxuICAgICAgaGVpZ2h0OiAoKDIgLSBmcmFtZU1ic09ubHlGbGFnKSAqIChwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxICsgMSkgKiAxNikgLSAoKGZyYW1lTWJzT25seUZsYWc/IDIgOiA0KSAqIChmcmFtZUNyb3BUb3BPZmZzZXQgKyBmcmFtZUNyb3BCb3R0b21PZmZzZXQpKVxuICAgIH07XG4gIH1cblxuICByZWFkU2xpY2VUeXBlKCkge1xuICAgIC8vIHNraXAgTkFMdSB0eXBlXG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICAvLyBkaXNjYXJkIGZpcnN0X21iX2luX3NsaWNlXG4gICAgdGhpcy5yZWFkVUVHKCk7XG4gICAgLy8gcmV0dXJuIHNsaWNlX3R5cGVcbiAgICByZXR1cm4gdGhpcy5yZWFkVUVHKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBJRDMgcGFyc2VyXG4gKi9cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuLy9pbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG5cbiBjbGFzcyBJRDMge1xuXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSBmYWxzZTtcbiAgICB2YXIgb2Zmc2V0ID0gMCwgYnl0ZTEsYnl0ZTIsYnl0ZTMsYnl0ZTQsdGFnU2l6ZSxlbmRQb3MsaGVhZGVyLGxlbjtcbiAgICAgIGRvIHtcbiAgICAgICAgaGVhZGVyID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDMpO1xuICAgICAgICBvZmZzZXQrPTM7XG4gICAgICAgICAgLy8gZmlyc3QgY2hlY2sgZm9yIElEMyBoZWFkZXJcbiAgICAgICAgICBpZiAoaGVhZGVyID09PSAnSUQzJykge1xuICAgICAgICAgICAgICAvLyBza2lwIDI0IGJpdHNcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IDM7XG4gICAgICAgICAgICAgIC8vIHJldHJpZXZlIHRhZyhzKSBsZW5ndGhcbiAgICAgICAgICAgICAgYnl0ZTEgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUyID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlMyA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTQgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIHRhZ1NpemUgPSAoYnl0ZTEgPDwgMjEpICsgKGJ5dGUyIDw8IDE0KSArIChieXRlMyA8PCA3KSArIGJ5dGU0O1xuICAgICAgICAgICAgICBlbmRQb3MgPSBvZmZzZXQgKyB0YWdTaXplO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyB0YWcgZm91bmQsIHNpemUvZW5kOiAke3RhZ1NpemV9LyR7ZW5kUG9zfWApO1xuXG4gICAgICAgICAgICAgIC8vIHJlYWQgSUQzIHRhZ3NcbiAgICAgICAgICAgICAgdGhpcy5fcGFyc2VJRDNGcmFtZXMoZGF0YSwgb2Zmc2V0LGVuZFBvcyk7XG4gICAgICAgICAgICAgIG9mZnNldCA9IGVuZFBvcztcbiAgICAgICAgICB9IGVsc2UgaWYgKGhlYWRlciA9PT0gJzNESScpIHtcbiAgICAgICAgICAgICAgLy8gaHR0cDovL2lkMy5vcmcvaWQzdjIuNC4wLXN0cnVjdHVyZSBjaGFwdGVyIDMuNC4gICBJRDN2MiBmb290ZXJcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IDc7XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGAzREkgZm9vdGVyIGZvdW5kLCBlbmQ6ICR7b2Zmc2V0fWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9mZnNldCAtPSAzO1xuICAgICAgICAgICAgICBsZW4gPSBvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBJRDMgbGVuOiAke2xlbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFzVGltZVN0YW1wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKCdJRDMgdGFnIGZvdW5kLCBidXQgbm8gdGltZXN0YW1wJyk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xlbmd0aCA9IGxlbjtcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9wYXlsb2FkID0gZGF0YS5zdWJhcnJheSgwLGxlbik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICB9IHdoaWxlICh0cnVlKTtcbiAgfVxuXG4gIHJlYWRVVEYoZGF0YSxzdGFydCxsZW4pIHtcblxuICAgIHZhciByZXN1bHQgPSAnJyxvZmZzZXQgPSBzdGFydCwgZW5kID0gc3RhcnQgKyBsZW47XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVtvZmZzZXQrK10pO1xuICAgIH0gd2hpbGUob2Zmc2V0IDwgZW5kKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgX3BhcnNlSUQzRnJhbWVzKGRhdGEsb2Zmc2V0LGVuZFBvcykge1xuICAgIHZhciB0YWdJZCx0YWdMZW4sdGFnU3RhcnQsdGFnRmxhZ3MsdGltZXN0YW1wO1xuICAgIHdoaWxlKG9mZnNldCArIDggPD0gZW5kUG9zKSB7XG4gICAgICB0YWdJZCA9IHRoaXMucmVhZFVURihkYXRhLG9mZnNldCw0KTtcbiAgICAgIG9mZnNldCArPTQ7XG5cbiAgICAgIHRhZ0xlbiA9IGRhdGFbb2Zmc2V0KytdIDw8IDI0ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCAxNiArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10gPDwgOCArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK107XG5cbiAgICAgIHRhZ0ZsYWdzID0gZGF0YVtvZmZzZXQrK10gPDwgOCArXG4gICAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnU3RhcnQgPSBvZmZzZXQ7XG4gICAgICAvL2xvZ2dlci5sb2coXCJJRDMgdGFnIGlkOlwiICsgdGFnSWQpO1xuICAgICAgc3dpdGNoKHRhZ0lkKSB7XG4gICAgICAgIGNhc2UgJ1BSSVYnOlxuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwYXJzZSBmcmFtZTonICsgSGV4LmhleER1bXAoZGF0YS5zdWJhcnJheShvZmZzZXQsZW5kUG9zKSkpO1xuICAgICAgICAgICAgLy8gb3duZXIgc2hvdWxkIGJlIFwiY29tLmFwcGxlLnN0cmVhbWluZy50cmFuc3BvcnRTdHJlYW1UaW1lc3RhbXBcIlxuICAgICAgICAgICAgaWYgKHRoaXMucmVhZFVURihkYXRhLG9mZnNldCw0NCkgPT09ICdjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcCcpIHtcbiAgICAgICAgICAgICAgICBvZmZzZXQrPTQ0O1xuICAgICAgICAgICAgICAgIC8vIHNtZWxsaW5nIGV2ZW4gYmV0dGVyICEgd2UgZm91bmQgdGhlIHJpZ2h0IGRlc2NyaXB0b3JcbiAgICAgICAgICAgICAgICAvLyBza2lwIG51bGwgY2hhcmFjdGVyIChzdHJpbmcgZW5kKSArIDMgZmlyc3QgYnl0ZXNcbiAgICAgICAgICAgICAgICBvZmZzZXQrPSA0O1xuXG4gICAgICAgICAgICAgICAgLy8gdGltZXN0YW1wIGlzIDMzIGJpdCBleHByZXNzZWQgYXMgYSBiaWctZW5kaWFuIGVpZ2h0LW9jdGV0IG51bWJlciwgd2l0aCB0aGUgdXBwZXIgMzEgYml0cyBzZXQgdG8gemVyby5cbiAgICAgICAgICAgICAgICB2YXIgcHRzMzNCaXQgID0gZGF0YVtvZmZzZXQrK10gJiAweDE7XG4gICAgICAgICAgICAgICAgdGhpcy5faGFzVGltZVN0YW1wID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCA9ICgoZGF0YVtvZmZzZXQrK10gPDwgMjMpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8IDE1KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCsrXSA8PCAgNykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSkgLzQ1O1xuXG4gICAgICAgICAgICAgICAgaWYgKHB0czMzQml0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcCAgICs9IDQ3NzIxODU4Ljg0OyAvLyAyXjMyIC8gOTBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gTWF0aC5yb3VuZCh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGxvZ2dlci50cmFjZShgSUQzIHRpbWVzdGFtcCBmb3VuZDogJHt0aW1lc3RhbXB9YCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZVN0YW1wID0gdGltZXN0YW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgaGFzVGltZVN0YW1wKCkge1xuICAgIHJldHVybiB0aGlzLl9oYXNUaW1lU3RhbXA7XG4gIH1cblxuICBnZXQgdGltZVN0YW1wKCkge1xuICAgIHJldHVybiB0aGlzLl90aW1lU3RhbXA7XG4gIH1cblxuICBnZXQgbGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLl9sZW5ndGg7XG4gIH1cblxuICBnZXQgcGF5bG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF5bG9hZDtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IElEMztcblxuIiwiLyoqXG4gKiBoaWdobHkgb3B0aW1pemVkIFRTIGRlbXV4ZXI6XG4gKiBwYXJzZSBQQVQsIFBNVFxuICogZXh0cmFjdCBQRVMgcGFja2V0IGZyb20gYXVkaW8gYW5kIHZpZGVvIFBJRHNcbiAqIGV4dHJhY3QgQVZDL0gyNjQgTkFMIHVuaXRzIGFuZCBBQUMvQURUUyBzYW1wbGVzIGZyb20gUEVTIHBhY2tldFxuICogdHJpZ2dlciB0aGUgcmVtdXhlciB1cG9uIHBhcnNpbmcgY29tcGxldGlvblxuICogaXQgYWxzbyB0cmllcyB0byB3b3JrYXJvdW5kIGFzIGJlc3QgYXMgaXQgY2FuIGF1ZGlvIGNvZGVjIHN3aXRjaCAoSEUtQUFDIHRvIEFBQyBhbmQgdmljZSB2ZXJzYSksIHdpdGhvdXQgaGF2aW5nIHRvIHJlc3RhcnQgdGhlIE1lZGlhU291cmNlLlxuICogaXQgYWxzbyBjb250cm9scyB0aGUgcmVtdXhpbmcgcHJvY2VzcyA6XG4gKiB1cG9uIGRpc2NvbnRpbnVpdHkgb3IgbGV2ZWwgc3dpdGNoIGRldGVjdGlvbiwgaXQgd2lsbCBhbHNvIG5vdGlmaWVzIHRoZSByZW11eGVyIHNvIHRoYXQgaXQgY2FuIHJlc2V0IGl0cyBzdGF0ZS5cbiovXG5cbiBpbXBvcnQgQURUUyBmcm9tICcuL2FkdHMnO1xuIGltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFeHBHb2xvbWIgZnJvbSAnLi9leHAtZ29sb21iJztcbi8vIGltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcbiBpbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIFRTRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIscmVtdXhlckNsYXNzKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMucmVtdXhlckNsYXNzID0gcmVtdXhlckNsYXNzO1xuICAgIHRoaXMubGFzdENDID0gMDtcbiAgICB0aGlzLnJlbXV4ZXIgPSBuZXcgdGhpcy5yZW11eGVyQ2xhc3Mob2JzZXJ2ZXIpO1xuICB9XG5cbiAgc3RhdGljIHByb2JlKGRhdGEpIHtcbiAgICAvLyBhIFRTIGZyYWdtZW50IHNob3VsZCBjb250YWluIGF0IGxlYXN0IDMgVFMgcGFja2V0cywgYSBQQVQsIGEgUE1ULCBhbmQgb25lIFBJRCwgZWFjaCBzdGFydGluZyB3aXRoIDB4NDdcbiAgICBpZiAoZGF0YS5sZW5ndGggPj0gMyoxODggJiYgZGF0YVswXSA9PT0gMHg0NyAmJiBkYXRhWzE4OF0gPT09IDB4NDcgJiYgZGF0YVsyKjE4OF0gPT09IDB4NDcpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5wbXRQYXJzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wbXRJZCA9IC0xO1xuICAgIHRoaXMubGFzdEFhY1BUUyA9IG51bGw7XG4gICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7Y29udGFpbmVyIDogJ3ZpZGVvL21wMnQnLCB0eXBlOiAndmlkZW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDAsIG5iTmFsdSA6IDB9O1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge2NvbnRhaW5lciA6ICd2aWRlby9tcDJ0JywgdHlwZTogJ2F1ZGlvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl9pZDNUcmFjayA9IHt0eXBlOiAnaWQzJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl90eHRUcmFjayA9IHt0eXBlOiAndGV4dCcsIGlkOiAtMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXM6IFtdLCBsZW46IDB9O1xuICAgIHRoaXMucmVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5yZW11eGVyLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciBhdmNEYXRhLCBhYWNEYXRhLCBpZDNEYXRhLFxuICAgICAgICBzdGFydCwgbGVuID0gZGF0YS5sZW5ndGgsIHN0dCwgcGlkLCBhdGYsIG9mZnNldCxcbiAgICAgICAgY29kZWNzT25seSA9IHRoaXMucmVtdXhlci5wYXNzdGhyb3VnaDtcblxuICAgIHRoaXMuYXVkaW9Db2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgdGhpcy52aWRlb0NvZGVjID0gdmlkZW9Db2RlYztcbiAgICB0aGlzLnRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICAgIHRoaXMuX2R1cmF0aW9uID0gZHVyYXRpb247XG4gICAgdGhpcy5jb250aWd1b3VzID0gZmFsc2U7XG4gICAgaWYgKGNjICE9PSB0aGlzLmxhc3RDQykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzY29udGludWl0eSBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gICAgICB0aGlzLmxhc3RDQyA9IGNjO1xuICAgIH0gZWxzZSBpZiAobGV2ZWwgIT09IHRoaXMubGFzdExldmVsKSB7XG4gICAgICBsb2dnZXIubG9nKCdsZXZlbCBzd2l0Y2ggZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICAgIHRoaXMubGFzdExldmVsID0gbGV2ZWw7XG4gICAgfSBlbHNlIGlmIChzbiA9PT0gKHRoaXMubGFzdFNOKzEpKSB7XG4gICAgICB0aGlzLmNvbnRpZ3VvdXMgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxhc3RTTiA9IHNuO1xuXG4gICAgaWYoIXRoaXMuY29udGlndW91cykge1xuICAgICAgLy8gZmx1c2ggYW55IHBhcnRpYWwgY29udGVudFxuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkLFxuICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkLFxuICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkLFxuICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuXG4gICAgLy8gZG9uJ3QgcGFyc2UgbGFzdCBUUyBwYWNrZXQgaWYgaW5jb21wbGV0ZVxuICAgIGxlbiAtPSBsZW4gJSAxODg7XG4gICAgLy8gbG9vcCB0aHJvdWdoIFRTIHBhY2tldHNcbiAgICBmb3IgKHN0YXJ0ID0gMDsgc3RhcnQgPCBsZW47IHN0YXJ0ICs9IDE4OCkge1xuICAgICAgaWYgKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQgKyAxXSAmIDB4NDApO1xuICAgICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCArIDFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0ICsgMl07XG4gICAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0ICsgM10gJiAweDMwKSA+PiA0O1xuICAgICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgICAgaWYgKGF0ZiA+IDEpIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDUgKyBkYXRhW3N0YXJ0ICsgNF07XG4gICAgICAgICAgLy8gY29udGludWUgaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgICAgaWYgKG9mZnNldCA9PT0gKHN0YXJ0ICsgMTg4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocG10UGFyc2VkKSB7XG4gICAgICAgICAgaWYgKHBpZCA9PT0gYXZjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvZGVjc09ubHkpIHtcbiAgICAgICAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgdmlkZW8gY29kZWMgaW5mbyBBTkRcbiAgICAgICAgICAgICAgICAgIC8vIGlmIGF1ZGlvIFBJRCBpcyB1bmRlZmluZWQgT1IgaWYgd2UgaGF2ZSBhdWRpbyBjb2RlYyBpbmZvLFxuICAgICAgICAgICAgICAgICAgLy8gd2UgaGF2ZSBhbGwgY29kZWMgaW5mbyAhXG4gICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXZjVHJhY2suY29kZWMgJiYgKGFhY0lkID09PSAtMSB8fCB0aGlzLl9hYWNUcmFjay5jb2RlYykpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW11eChkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhdmNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhdmNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGFhY0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgICAgICAgICAgICAgIGlmIChjb2RlY3NPbmx5KSB7XG4gICAgICAgICAgICAgICAgICAvLyBoZXJlIHdlIG5vdyB0aGF0IHdlIGhhdmUgYXVkaW8gY29kZWMgaW5mb1xuICAgICAgICAgICAgICAgICAgLy8gaWYgdmlkZW8gUElEIGlzIHVuZGVmaW5lZCBPUiBpZiB3ZSBoYXZlIHZpZGVvIGNvZGVjIGluZm8sXG4gICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGFsbCBjb2RlYyBpbmZvcyAhXG4gICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYWFjVHJhY2suY29kZWMgJiYgKGF2Y0lkID09PSAtMSB8fCB0aGlzLl9hdmNUcmFjay5jb2RlYykpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW11eChkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhYWNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgIGFhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhYWNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGlkM0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlkM0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgaWQzRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGlkM0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgb2Zmc2V0ICs9IGRhdGFbb2Zmc2V0XSArIDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwaWQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUEFUKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IHRoaXMuX3BtdElkKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBNVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgICAgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQgPSB0cnVlO1xuICAgICAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZDtcbiAgICAgICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQ7XG4gICAgICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnVFMgcGFja2V0IGRpZCBub3Qgc3RhcnQgd2l0aCAweDQ3J30pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBwYXJzZSBsYXN0IFBFUyBwYWNrZXRcbiAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgIH1cbiAgICB0aGlzLnJlbXV4KG51bGwpO1xuICB9XG5cbiAgcmVtdXgoZGF0YSkge1xuICAgIHRoaXMucmVtdXhlci5yZW11eCh0aGlzLl9hYWNUcmFjaywgdGhpcy5fYXZjVHJhY2ssIHRoaXMuX2lkM1RyYWNrLCB0aGlzLl90eHRUcmFjaywgdGhpcy50aW1lT2Zmc2V0LCB0aGlzLmNvbnRpZ3VvdXMsIGRhdGEpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSAwO1xuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsIG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsIG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLCB0YWJsZUVuZCwgcHJvZ3JhbUluZm9MZW5ndGgsIHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMTFdO1xuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gUGFja2V0aXplZCBtZXRhZGF0YSAoSUQzKVxuICAgICAgICBjYXNlIDB4MTU6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdJRDMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9pZDNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsIGZyYWcsIHBlc0ZsYWdzLCBwZXNQcmVmaXgsIHBlc0xlbiwgcGVzSGRyTGVuLCBwZXNEYXRhLCBwZXNQdHMsIHBlc0R0cywgcGF5bG9hZFN0YXJ0T2Zmc2V0LCBkYXRhID0gc3RyZWFtLmRhdGE7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYgKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvKiBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgICAgIGFzIFBUUyAvIERUUyBpcyAzMyBiaXQgd2UgY2Fubm90IHVzZSBiaXR3aXNlIG9wZXJhdG9yIGluIEpTLFxuICAgICAgICAgICAgYXMgQml0d2lzZSBvcGVyYXRvcnMgdHJlYXQgdGhlaXIgb3BlcmFuZHMgYXMgYSBzZXF1ZW5jZSBvZiAzMiBiaXRzICovXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAoZnJhZ1sxMF0gJiAweEZGKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAoZnJhZ1sxMV0gJiAweEZFKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgKGZyYWdbMTJdICYgMHhGRikgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgIChmcmFnWzEzXSAmIDB4RkUpIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNQdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzUHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApICogNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgICAoZnJhZ1sxNV0gJiAweEZGICkgKiA0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgICAoZnJhZ1sxNl0gJiAweEZFICkgKiAxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgICAgKGZyYWdbMTddICYgMHhGRiApICogMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAgIChmcmFnWzE4XSAmIDB4RkUgKSAvIDI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzRHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgIHBlc0R0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4gKyA5O1xuXG4gICAgICBzdHJlYW0uc2l6ZSAtPSBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAvL3JlYXNzZW1ibGUgUEVTIHBhY2tldFxuICAgICAgcGVzRGF0YSA9IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKTtcbiAgICAgIHdoaWxlIChkYXRhLmxlbmd0aCkge1xuICAgICAgICBmcmFnID0gZGF0YS5zaGlmdCgpO1xuICAgICAgICB2YXIgbGVuID0gZnJhZy5ieXRlTGVuZ3RoO1xuICAgICAgICBpZiAocGF5bG9hZFN0YXJ0T2Zmc2V0KSB7XG4gICAgICAgICAgaWYgKHBheWxvYWRTdGFydE9mZnNldCA+IGxlbikge1xuICAgICAgICAgICAgLy8gdHJpbSBmdWxsIGZyYWcgaWYgUEVTIGhlYWRlciBiaWdnZXIgdGhhbiBmcmFnXG4gICAgICAgICAgICBwYXlsb2FkU3RhcnRPZmZzZXQtPWxlbjtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB0cmltIHBhcnRpYWwgZnJhZyBpZiBQRVMgaGVhZGVyIHNtYWxsZXIgdGhhbiBmcmFnXG4gICAgICAgICAgICBmcmFnID0gZnJhZy5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgICAgICAgbGVuLT1wYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSs9bGVuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtkYXRhOiBwZXNEYXRhLCBwdHM6IHBlc1B0cywgZHRzOiBwZXNEdHMsIGxlbjogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyxcbiAgICAgICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpLFxuICAgICAgICB1bml0czIgPSBbXSxcbiAgICAgICAgZGVidWcgPSBmYWxzZSxcbiAgICAgICAga2V5ID0gZmFsc2UsXG4gICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgIGV4cEdvbG9tYkRlY29kZXIsXG4gICAgICAgIGF2Y1NhbXBsZSxcbiAgICAgICAgcHVzaCxcbiAgICAgICAgaTtcbiAgICAvLyBubyBOQUx1IGZvdW5kXG4gICAgaWYgKHVuaXRzLmxlbmd0aCA9PT0gMCAmJiBzYW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFwcGVuZCBwZXMuZGF0YSB0byBwcmV2aW91cyBOQUwgdW5pdFxuICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgcGVzLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgdG1wLnNldChwZXMuZGF0YSwgbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgdHJhY2subGVuICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHZhciBkZWJ1Z1N0cmluZyA9ICcnO1xuXG4gICAgdW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9ORFJcbiAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnTkRSICc7XG4gICAgICAgICAgIH1cbiAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0lEUiAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NFSVxuICAgICAgICBjYXNlIDY6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTRUkgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcblxuICAgICAgICAgIC8vIHNraXAgZnJhbWVUeXBlXG4gICAgICAgICAgZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIHZhciBwYXlsb2FkVHlwZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAvLyBUT0RPOiB0aGVyZSBjYW4gYmUgbW9yZSB0aGFuIG9uZSBwYXlsb2FkIGluIGFuIFNFSSBwYWNrZXQuLi5cbiAgICAgICAgICAvLyBUT0RPOiBuZWVkIHRvIHJlYWQgdHlwZSBhbmQgc2l6ZSBpbiBhIHdoaWxlIGxvb3AgdG8gZ2V0IHRoZW0gYWxsXG4gICAgICAgICAgaWYgKHBheWxvYWRUeXBlID09PSA0KVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHZhciBwYXlsb2FkU2l6ZSA9IDA7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgcGF5bG9hZFNpemUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHBheWxvYWRTaXplID09PSAyNTUpO1xuXG4gICAgICAgICAgICB2YXIgY291bnRyeUNvZGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoY291bnRyeUNvZGUgPT09IDE4MSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdmFyIHByb3ZpZGVyQ29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVTaG9ydCgpO1xuXG4gICAgICAgICAgICAgIGlmIChwcm92aWRlckNvZGUgPT09IDQ5KVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmFyIHVzZXJTdHJ1Y3R1cmUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVSW50KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAodXNlclN0cnVjdHVyZSA9PT0gMHg0NzQxMzkzNClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB2YXIgdXNlckRhdGFUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgLy8gUmF3IENFQS02MDggYnl0ZXMgd3JhcHBlZCBpbiBDRUEtNzA4IHBhY2tldFxuICAgICAgICAgICAgICAgICAgaWYgKHVzZXJEYXRhVHlwZSA9PT0gMylcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpcnN0Qnl0ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZWNvbmRCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgdG90YWxDQ3MgPSAzMSAmIGZpcnN0Qnl0ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJ5dGVBcnJheSA9IFtmaXJzdEJ5dGUsIHNlY29uZEJ5dGVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaT0wOyBpPHRvdGFsQ0NzOyBpKyspXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyAzIGJ5dGVzIHBlciBDQ1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHh0VHJhY2suc2FtcGxlcy5wdXNoKHt0eXBlOiAzLCBwdHM6IHBlcy5wdHMsIGJ5dGVzOiBieXRlQXJyYXl9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNQUygpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgdmFyIGNvZGVjYXJyYXkgPSB1bml0LmRhdGEuc3ViYXJyYXkoMSwgNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgPSAnYXZjMS4nO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdQUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA5OlxuICAgICAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0FVRCAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBwdXNoID0gZmFsc2U7XG4gICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ3Vua25vd24gTkFMICcgKyB1bml0LnR5cGUgKyAnICc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZihwdXNoKSB7XG4gICAgICAgIHVuaXRzMi5wdXNoKHVuaXQpO1xuICAgICAgICBsZW5ndGgrPXVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmKGRlYnVnIHx8IGRlYnVnU3RyaW5nLmxlbmd0aCkge1xuICAgICAgbG9nZ2VyLmxvZyhkZWJ1Z1N0cmluZyk7XG4gICAgfVxuICAgIC8vYnVpbGQgc2FtcGxlIGZyb20gUEVTXG4gICAgLy8gQW5uZXggQiB0byBNUDQgY29udmVyc2lvbiB0byBiZSBkb25lXG4gICAgaWYgKHVuaXRzMi5sZW5ndGgpIHtcbiAgICAgIC8vIG9ubHkgcHVzaCBBVkMgc2FtcGxlIGlmIGtleWZyYW1lIGFscmVhZHkgZm91bmQuIGJyb3dzZXJzIGV4cGVjdCBhIGtleWZyYW1lIGF0IGZpcnN0IHRvIHN0YXJ0IGRlY29kaW5nXG4gICAgICBpZiAoa2V5ID09PSB0cnVlIHx8IHRyYWNrLnNwcyApIHtcbiAgICAgICAgYXZjU2FtcGxlID0ge3VuaXRzOiB7IHVuaXRzIDogdW5pdHMyLCBsZW5ndGggOiBsZW5ndGh9LCBwdHM6IHBlcy5wdHMsIGR0czogcGVzLmR0cywga2V5OiBrZXl9O1xuICAgICAgICBzYW1wbGVzLnB1c2goYXZjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGxlbmd0aDtcbiAgICAgICAgdHJhY2submJOYWx1ICs9IHVuaXRzMi5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLCBsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLCB2YWx1ZSwgb3ZlcmZsb3csIHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsIGxhc3RVbml0VHlwZTtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZiAodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gMSAmJiBpIDwgbGVuKSB7XG4gICAgICAgICAgICB1bml0VHlwZSA9IGFycmF5W2ldICYgMHgxZjtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBOQUxVIEAgb2Zmc2V0OicgKyBpICsgJyx0eXBlOicgKyB1bml0VHlwZSk7XG4gICAgICAgICAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0ge2RhdGE6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsIGkgLSBzdGF0ZSAtIDEpLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcztcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXRzID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdCA9IGxhc3RVbml0c1tsYXN0VW5pdHMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLCAwKTtcbiAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCwgb3ZlcmZsb3cpLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgdHJhY2subGVuICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgbGVuKSwgdHlwZTogbGFzdFVuaXRUeXBlfTtcbiAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiB1bml0cztcbiAgfVxuXG4gIF9wYXJzZUFBQ1BFUyhwZXMpIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgZGF0YSA9IHBlcy5kYXRhLFxuICAgICAgICBwdHMgPSBwZXMucHRzLFxuICAgICAgICBzdGFydE9mZnNldCA9IDAsXG4gICAgICAgIGR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb24sXG4gICAgICAgIGF1ZGlvQ29kZWMgPSB0aGlzLmF1ZGlvQ29kZWMsXG4gICAgICAgIGFhY092ZXJGbG93ID0gdGhpcy5hYWNPdmVyRmxvdyxcbiAgICAgICAgbGFzdEFhY1BUUyA9IHRoaXMubGFzdEFhY1BUUyxcbiAgICAgICAgY29uZmlnLCBmcmFtZUxlbmd0aCwgZnJhbWVEdXJhdGlvbiwgZnJhbWVJbmRleCwgb2Zmc2V0LCBoZWFkZXJMZW5ndGgsIHN0YW1wLCBsZW4sIGFhY1NhbXBsZTtcbiAgICBpZiAoYWFjT3ZlckZsb3cpIHtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShhYWNPdmVyRmxvdy5ieXRlTGVuZ3RoICsgZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQoYWFjT3ZlckZsb3csIDApO1xuICAgICAgdG1wLnNldChkYXRhLCBhYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDOiBhcHBlbmQgb3ZlcmZsb3dpbmcgJHthYWNPdmVyRmxvdy5ieXRlTGVuZ3RofSBieXRlcyB0byBiZWdpbm5pbmcgb2YgbmV3IFBFU2ApO1xuICAgICAgZGF0YSA9IHRtcDtcbiAgICB9XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKG9mZnNldCA9IHN0YXJ0T2Zmc2V0LCBsZW4gPSBkYXRhLmxlbmd0aDsgb2Zmc2V0IDwgbGVuIC0gMTsgb2Zmc2V0KyspIHtcbiAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgQURUUyBoZWFkZXIgZG9lcyBub3Qgc3RhcnQgc3RyYWlnaHQgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGF5bG9hZCwgcmFpc2UgYW4gZXJyb3JcbiAgICBpZiAob2Zmc2V0KSB7XG4gICAgICB2YXIgcmVhc29uLCBmYXRhbDtcbiAgICAgIGlmIChvZmZzZXQgPCBsZW4gLSAxKSB7XG4gICAgICAgIHJlYXNvbiA9IGBBQUMgUEVTIGRpZCBub3Qgc3RhcnQgd2l0aCBBRFRTIGhlYWRlcixvZmZzZXQ6JHtvZmZzZXR9YDtcbiAgICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlYXNvbiA9ICdubyBBRFRTIGhlYWRlciBmb3VuZCBpbiBBQUMgUEVTJztcbiAgICAgICAgZmF0YWwgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhdGFsLCByZWFzb246IHJlYXNvbn0pO1xuICAgICAgaWYgKGZhdGFsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IEFEVFMuZ2V0QXVkaW9Db25maWcodGhpcy5vYnNlcnZlcixkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpO1xuICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBmcmFtZUluZGV4ID0gMDtcbiAgICBmcmFtZUR1cmF0aW9uID0gMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuXG4gICAgLy8gaWYgbGFzdCBBQUMgZnJhbWUgaXMgb3ZlcmZsb3dpbmcsIHdlIHNob3VsZCBlbnN1cmUgdGltZXN0YW1wcyBhcmUgY29udGlndW91czpcbiAgICAvLyBmaXJzdCBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBmcmFtZUR1cmF0aW9uXG4gICAgaWYoYWFjT3ZlckZsb3cgJiYgbGFzdEFhY1BUUykge1xuICAgICAgdmFyIG5ld1BUUyA9IGxhc3RBYWNQVFMrZnJhbWVEdXJhdGlvbjtcbiAgICAgIGlmKE1hdGguYWJzKG5ld1BUUy1wdHMpID4gMSkge1xuICAgICAgICBsb2dnZXIubG9nKGBBQUM6IGFsaWduIFBUUyBmb3Igb3ZlcmxhcHBpbmcgZnJhbWVzIGJ5ICR7TWF0aC5yb3VuZCgobmV3UFRTLXB0cykvOTApfWApO1xuICAgICAgICBwdHM9bmV3UFRTO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlICgob2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIFRoZSBwcm90ZWN0aW9uIHNraXAgYml0IHRlbGxzIHVzIGlmIHdlIGhhdmUgMiBieXRlcyBvZiBDUkMgZGF0YSBhdCB0aGUgZW5kIG9mIHRoZSBBRFRTIGhlYWRlclxuICAgICAgaGVhZGVyTGVuZ3RoID0gKCEhKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGZyYW1lTGVuZ3RoID0gKChkYXRhW29mZnNldCArIDNdICYgMHgwMykgPDwgMTEpIHxcbiAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCArIDRdIDw8IDMpIHxcbiAgICAgICAgICAgICAgICAgICAgKChkYXRhW29mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgZnJhbWVMZW5ndGggIC09IGhlYWRlckxlbmd0aDtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuXG4gICAgICBpZiAoKGZyYW1lTGVuZ3RoID4gMCkgJiYgKChvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCkgPD0gbGVuKSkge1xuICAgICAgICBzdGFtcCA9IHB0cyArIGZyYW1lSW5kZXggKiBmcmFtZUR1cmF0aW9uO1xuICAgICAgICAvL2xvZ2dlci5sb2coYEFBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC90b3RhbC9wdHM6JHtvZmZzZXQraGVhZGVyTGVuZ3RofS8ke2ZyYW1lTGVuZ3RofS8ke2RhdGEuYnl0ZUxlbmd0aH0vJHsoc3RhbXAvOTApLnRvRml4ZWQoMCl9YCk7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KG9mZnNldCArIGhlYWRlckxlbmd0aCwgb2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBmcmFtZUxlbmd0aDtcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lTGVuZ3RoICsgaGVhZGVyTGVuZ3RoO1xuICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICAgIGZvciAoIDsgb2Zmc2V0IDwgKGxlbiAtIDEpOyBvZmZzZXQrKykge1xuICAgICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoKGRhdGFbb2Zmc2V0ICsgMV0gJiAweGYwKSA9PT0gMHhmMCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvZmZzZXQgPCBsZW4pIHtcbiAgICAgIGFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShvZmZzZXQsIGxlbik7XG4gICAgICAvL2xvZ2dlci5sb2coYEFBQzogb3ZlcmZsb3cgZGV0ZWN0ZWQ6JHtsZW4tb2Zmc2V0fWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBhYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBhYWNPdmVyRmxvdztcbiAgICB0aGlzLmxhc3RBYWNQVFMgPSBzdGFtcDtcbiAgfVxuXG4gIF9wYXJzZUlEM1BFUyhwZXMpIHtcbiAgICB0aGlzLl9pZDNUcmFjay5zYW1wbGVzLnB1c2gocGVzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG5cbiIsImV4cG9ydCBjb25zdCBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUjogJ25ldHdvcmtFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWVkaWEgRXJyb3IgKHZpZGVvL3BhcnNpbmcvbWVkaWFzb3VyY2UgZXJyb3IpXG4gIE1FRElBX0VSUk9SOiAnbWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1I6ICdvdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IGNvbnN0IEVycm9yRGV0YWlscyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9FUlJPUjogJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQ6ICdtYW5pZmVzdExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBwYXJzaW5nIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZWFzb24gOiBlcnJvciByZWFzb259XG4gIE1BTklGRVNUX1BBUlNJTkdfRVJST1I6ICdtYW5pZmVzdFBhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3Qgd2l0aCBvbmx5IGluY29tcGF0aWJsZSBjb2RlY3MgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfSU5DT01QQVRJQkxFX0NPREVDU19FUlJPUjogJ21hbmlmZXN0SW5jb21wYXRpYmxlQ29kZWNzRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUjogJ2xldmVsTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgcGxheWxpc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9USU1FT1VUOiAnbGV2ZWxMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfU1dJVENIX0VSUk9SOiAnbGV2ZWxTd2l0Y2hFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBGUkFHX0xPQURfRVJST1I6ICdmcmFnTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPT1BfTE9BRElOR19FUlJPUjogJ2ZyYWdMb29wTG9hZGluZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfVElNRU9VVDogJ2ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgZGVjcnlwdGlvbiBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19ERUNSWVBUX0VSUk9SOiAnZnJhZ0RlY3J5cHRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SOiAnZnJhZ1BhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBLRVlfTE9BRF9FUlJPUjogJ2tleUxvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgdGltZW91dCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgS0VZX0xPQURfVElNRU9VVDogJ2tleUxvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kIGVycm9yIC0gZGF0YTogYXBwZW5kIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRfRVJST1I6ICdidWZmZXJBcHBlbmRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIGFwcGVuZGluZyBlcnJvciBldmVudCAtIGRhdGE6IGFwcGVuZGluZyBlcnJvciBkZXNjcmlwdGlvblxuICBCVUZGRVJfQVBQRU5ESU5HX0VSUk9SOiAnYnVmZmVyQXBwZW5kaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBzdGFsbGVkIGVycm9yIGV2ZW50XG4gIEJVRkZFUl9TVEFMTEVEX0VSUk9SOiAnYnVmZmVyU3RhbGxlZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgZnVsbCBldmVudFxuICBCVUZGRVJfRlVMTF9FUlJPUjogJ2J1ZmZlckZ1bGxFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHNlZWsgb3ZlciBob2xlIGV2ZW50XG4gIEJVRkZFUl9TRUVLX09WRVJfSE9MRTogJ2J1ZmZlclNlZWtPdmVySG9sZSdcbn07XG4iLCIvKlxuKlxuKiBBbGwgb2JqZWN0cyBpbiB0aGUgZXZlbnQgaGFuZGxpbmcgY2hhaW4gc2hvdWxkIGluaGVyaXQgZnJvbSB0aGlzIGNsYXNzXG4qXG4qL1xuXG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzLCAuLi5ldmVudHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9uRXZlbnQgPSB0aGlzLm9uRXZlbnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLmhhbmRsZWRFdmVudHMgPSBldmVudHM7XG4gICAgdGhpcy51c2VHZW5lcmljSGFuZGxlciA9IHRydWU7XG5cbiAgICB0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMudW5yZWdpc3Rlckxpc3RlbmVycygpO1xuICB9XG5cbiAgaXNFdmVudEhhbmRsZXIoKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGlzLmhhbmRsZWRFdmVudHMgPT09ICdvYmplY3QnICYmIHRoaXMuaGFuZGxlZEV2ZW50cy5sZW5ndGggJiYgdHlwZW9mIHRoaXMub25FdmVudCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIHJlZ2lzdGVyTGlzdGVuZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRXZlbnRIYW5kbGVyKCkpIHtcbiAgICAgIHRoaXMuaGFuZGxlZEV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCA9PT0gJ2hsc0V2ZW50R2VuZXJpYycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvcmJpZGRlbiBldmVudCBuYW1lOiAnICsgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGxzLm9uKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB1bnJlZ2lzdGVyTGlzdGVuZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRXZlbnRIYW5kbGVyKCkpIHtcbiAgICAgIHRoaXMuaGFuZGxlZEV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuaGxzLm9mZihldmVudCwgdGhpcy5vbkV2ZW50KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgKiBhcmd1bWVudHM6IGV2ZW50IChzdHJpbmcpLCBkYXRhIChhbnkpXG4gICovXG4gIG9uRXZlbnQoZXZlbnQsIGRhdGEpIHtcbiAgICB0aGlzLm9uRXZlbnRHZW5lcmljKGV2ZW50LCBkYXRhKTtcbiAgfVxuXG4gIG9uRXZlbnRHZW5lcmljKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGV2ZW50VG9GdW5jdGlvbiA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICB2YXIgZnVuY05hbWUgPSAnb24nICsgZXZlbnQucmVwbGFjZSgnaGxzJywgJycpO1xuICAgICAgaWYgKHR5cGVvZiB0aGlzW2Z1bmNOYW1lXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50ICR7ZXZlbnR9IGhhcyBubyBnZW5lcmljIGhhbmRsZXIgaW4gdGhpcyAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gY2xhc3MgKHRyaWVkICR7ZnVuY05hbWV9KWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXNbZnVuY05hbWVdLmJpbmQodGhpcywgZGF0YSk7XG4gICAgfTtcbiAgICBldmVudFRvRnVuY3Rpb24uY2FsbCh0aGlzLCBldmVudCwgZGF0YSkuY2FsbCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV2ZW50SGFuZGxlcjsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgLy8gZmlyZWQgYmVmb3JlIE1lZGlhU291cmNlIGlzIGF0dGFjaGluZyB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyBtZWRpYSB9XG4gIE1FRElBX0FUVEFDSElORzogJ2hsc01lZGlhQXR0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0FUVEFDSEVEOiAnaGxzTWVkaWFBdHRhY2hlZCcsXG4gIC8vIGZpcmVkIGJlZm9yZSBkZXRhY2hpbmcgTWVkaWFTb3VyY2UgZnJvbSBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0RFVEFDSElORzogJ2hsc01lZGlhRGV0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBkZXRhY2hlZCBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNIRUQ6ICdobHNNZWRpYURldGFjaGVkJyxcbiAgLy8gZmlyZWQgd2hlbiB3ZSBidWZmZXIgaXMgZ29pbmcgdG8gYmUgcmVzZXR0ZWRcbiAgQlVGRkVSX1JFU0VUOiAnaGxzQnVmZmVyUmVzZXQnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGtub3cgYWJvdXQgdGhlIGNvZGVjcyB0aGF0IHdlIG5lZWQgYnVmZmVycyBmb3IgdG8gcHVzaCBpbnRvIC0gZGF0YToge3RyYWNrcyA6IHsgY29udGFpbmVyLCBjb2RlYywgbGV2ZWxDb2RlYywgaW5pdFNlZ21lbnQsIG1ldGFkYXRhIH19XG4gIEJVRkZFUl9DT0RFQ1M6ICdobHNCdWZmZXJDb2RlY3MnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGFwcGVuZCBhIHNlZ21lbnQgdG8gdGhlIGJ1ZmZlciAtIGRhdGE6IHsgc2VnbWVudDogc2VnbWVudCBvYmplY3QgfVxuICBCVUZGRVJfQVBQRU5ESU5HOiAnaGxzQnVmZmVyQXBwZW5kaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiB3ZSBhcmUgZG9uZSB3aXRoIGFwcGVuZGluZyBhIG1lZGlhIHNlZ21lbnQgdG8gdGhlIGJ1ZmZlclxuICBCVUZGRVJfQVBQRU5ERUQ6ICdobHNCdWZmZXJBcHBlbmRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIHN0cmVhbSBpcyBmaW5pc2hlZCBhbmQgd2Ugd2FudCB0byBub3RpZnkgdGhlIG1lZGlhIGJ1ZmZlciB0aGF0IHRoZXJlIHdpbGwgYmUgbm8gbW9yZSBkYXRhXG4gIEJVRkZFUl9FT1M6ICdobHNCdWZmZXJFb3MnLFxuICAvLyBmaXJlZCB3aGVuIHRoZSBtZWRpYSBidWZmZXIgc2hvdWxkIGJlIGZsdXNoZWQgLSBkYXRhIHtzdGFydE9mZnNldCwgZW5kT2Zmc2V0fVxuICBCVUZGRVJfRkxVU0hJTkc6ICdobHNCdWZmZXJGbHVzaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIG1lZGlhIGhhcyBiZWVuIGZsdXNoZWRcbiAgQlVGRkVSX0ZMVVNIRUQ6ICdobHNCdWZmZXJGbHVzaGVkJyxcbiAgLy8gZmlyZWQgdG8gc2lnbmFsIHRoYXQgYSBtYW5pZmVzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbWFuaWZlc3RVUkx9XG4gIE1BTklGRVNUX0xPQURJTkc6ICdobHNNYW5pZmVzdExvYWRpbmcnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBsb2FkZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgdXJsIDogbWFuaWZlc3RVUkwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9fVxuICBNQU5JRkVTVF9MT0FERUQ6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIHBhcnNlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCBmaXJzdExldmVsIDogaW5kZXggb2YgZmlyc3QgcXVhbGl0eSBsZXZlbCBhcHBlYXJpbmcgaW4gTWFuaWZlc3R9XG4gIE1BTklGRVNUX1BBUlNFRDogJ2hsc01hbmlmZXN0UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBsZXZlbCBVUkwgIGxldmVsIDogaWQgb2YgbGV2ZWwgYmVpbmcgbG9hZGVkfVxuICBMRVZFTF9MT0FESU5HOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgZmluaXNoZXMgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIGxvYWRlZCBsZXZlbCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX0gfVxuICBMRVZFTF9MT0FERUQ6ICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIGRldGFpbHMgaGF2ZSBiZWVuIHVwZGF0ZWQgYmFzZWQgb24gcHJldmlvdXMgZGV0YWlscywgYWZ0ZXIgaXQgaGFzIGJlZW4gbG9hZGVkLiAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCB9XG4gIExFVkVMX1VQREFURUQ6ICdobHNMZXZlbFVwZGF0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwncyBQVFMgaW5mb3JtYXRpb24gaGFzIGJlZW4gdXBkYXRlZCBhZnRlciBwYXJzaW5nIGEgZnJhZ21lbnQgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIHVwZGF0ZWQgbGV2ZWwsIGRyaWZ0OiBQVFMgZHJpZnQgb2JzZXJ2ZWQgd2hlbiBwYXJzaW5nIGxhc3QgZnJhZ21lbnQgfVxuICBMRVZFTF9QVFNfVVBEQVRFRDogJ2hsc0xldmVsUHRzVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBzd2l0Y2ggaXMgcmVxdWVzdGVkIC0gZGF0YTogeyBsZXZlbCA6IGlkIG9mIG5ldyBsZXZlbCB9XG4gIExFVkVMX1NXSVRDSDogJ2hsc0xldmVsU3dpdGNoJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURJTkc6ICdobHNGcmFnTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIHByb2dyZXNzaW5nIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCB7IHRyZXF1ZXN0LCB0Zmlyc3QsIGxvYWRlZH19XG4gIEZSQUdfTE9BRF9QUk9HUkVTUzogJ2hsc0ZyYWdMb2FkUHJvZ3Jlc3MnLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIGFib3J0aW5nIGZvciBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gLSBkYXRhOiB7ZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVEOiAnaGxzRnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDogZnJhZ21lbnQgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBGUkFHX0xPQURFRDogJ2hsc0ZyYWdMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIEluaXQgU2VnbWVudCBoYXMgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vdiA6IG1vb3YgTVA0IGJveCwgY29kZWNzIDogY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnR9XG4gIEZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6ICdobHNGcmFnUGFyc2luZ0luaXRTZWdtZW50JyxcbiAgLy8gZmlyZWQgd2hlbiBwYXJzaW5nIHNlaSB0ZXh0IGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgc2VpIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfVVNFUkRBVEE6ICdobHNGcmFnUGFyc2luZ1VzZXJkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBwYXJzaW5nIGlkMyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IHNhbXBsZXMgOiBbIGlkMyBzYW1wbGVzIHBlcyBdIH1cbiAgRlJBR19QQVJTSU5HX01FVEFEQVRBOiAnaGxzRnJhZ1BhcnNpbmdNZXRhZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZGF0YSBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IGRhdGExIDogbW9vZiBNUDQgYm94IG9yIFRTIGZyYWdtZW50cywgZGF0YTIgOiBtZGF0IE1QNCBib3ggb3IgbnVsbH1cbiAgRlJBR19QQVJTSU5HX0RBVEE6ICdobHNGcmFnUGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEOiAnaGxzRnJhZ1BhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEOiAnaGxzRnJhZ0J1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgbWVkaWEgcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEOiAnaGxzRnJhZ0NoYW5nZWQnLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgRlBTIGRyb3AgZXZlbnQgLSBkYXRhOiB7Y3VyZW50RHJvcHBlZCwgY3VycmVudERlY29kZWQsIHRvdGFsRHJvcHBlZEZyYW1lc31cbiAgRlBTX0RST1A6ICdobHNGcHNEcm9wJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYW4gZXJyb3IgZXZlbnQgLSBkYXRhOiB7IHR5cGUgOiBlcnJvciB0eXBlLCBkZXRhaWxzIDogZXJyb3IgZGV0YWlscywgZmF0YWwgOiBpZiB0cnVlLCBobHMuanMgY2Fubm90L3dpbGwgbm90IHRyeSB0byByZWNvdmVyLCBpZiBmYWxzZSwgaGxzLmpzIHdpbGwgdHJ5IHRvIHJlY292ZXIsb3RoZXIgZXJyb3Igc3BlY2lmaWMgZGF0YX1cbiAgRVJST1I6ICdobHNFcnJvcicsXG4gIC8vIGZpcmVkIHdoZW4gaGxzLmpzIGluc3RhbmNlIHN0YXJ0cyBkZXN0cm95aW5nLiBEaWZmZXJlbnQgZnJvbSBNRURJQV9ERVRBQ0hFRCBhcyBvbmUgY291bGQgd2FudCB0byBkZXRhY2ggYW5kIHJlYXR0YWNoIGEgbWVkaWEgdG8gdGhlIGluc3RhbmNlIG9mIGhscy5qcyB0byBoYW5kbGUgbWlkLXJvbGxzIGZvciBleGFtcGxlXG4gIERFU1RST1lJTkc6ICdobHNEZXN0cm95aW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRElORzogJ2hsc0tleUxvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBrZXkgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBLRVlfTE9BREVEOiAnaGxzS2V5TG9hZGVkJyxcbn07XG4iLCIvKipcbiAqIEJ1ZmZlciBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgYnVmZmVyIGxlbmd0aCByZXRyaWV2YWxcbiovXG5cblxuY2xhc3MgQnVmZmVySGVscGVyIHtcblxuICBzdGF0aWMgYnVmZmVySW5mbyhtZWRpYSwgcG9zLG1heEhvbGVEdXJhdGlvbikge1xuICAgIGlmIChtZWRpYSkge1xuICAgICAgdmFyIHZidWZmZXJlZCA9IG1lZGlhLmJ1ZmZlcmVkLCBidWZmZXJlZCA9IFtdLGk7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGJ1ZmZlcmVkLnB1c2goe3N0YXJ0OiB2YnVmZmVyZWQuc3RhcnQoaSksIGVuZDogdmJ1ZmZlcmVkLmVuZChpKX0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge2xlbjogMCwgc3RhcnQ6IDAsIGVuZDogMCwgbmV4dFN0YXJ0IDogdW5kZWZpbmVkfSA7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGJ1ZmZlcmVkSW5mbyhidWZmZXJlZCxwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJMZW4sYnVmZmVyU3RhcnQsIGJ1ZmZlckVuZCxidWZmZXJTdGFydE5leHQsaTtcbiAgICAvLyBzb3J0IG9uIGJ1ZmZlci5zdGFydC9zbWFsbGVyIGVuZCAoSUUgZG9lcyBub3QgYWx3YXlzIHJldHVybiBzb3J0ZWQgYnVmZmVyZWQgcmFuZ2UpXG4gICAgYnVmZmVyZWQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgdmFyIGRpZmYgPSBhLnN0YXJ0IC0gYi5zdGFydDtcbiAgICAgIGlmIChkaWZmKSB7XG4gICAgICAgIHJldHVybiBkaWZmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGIuZW5kIC0gYS5lbmQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gbWF4SG9sZUR1cmF0aW9uIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBidWYybGVuID0gYnVmZmVyZWQyLmxlbmd0aDtcbiAgICAgIGlmKGJ1ZjJsZW4pIHtcbiAgICAgICAgdmFyIGJ1ZjJlbmQgPSBidWZmZXJlZDJbYnVmMmxlbiAtIDFdLmVuZDtcbiAgICAgICAgLy8gaWYgc21hbGwgaG9sZSAodmFsdWUgYmV0d2VlbiAwIG9yIG1heEhvbGVEdXJhdGlvbiApIG9yIG92ZXJsYXBwaW5nIChuZWdhdGl2ZSlcbiAgICAgICAgaWYoKGJ1ZmZlcmVkW2ldLnN0YXJ0IC0gYnVmMmVuZCkgPCBtYXhIb2xlRHVyYXRpb24pIHtcbiAgICAgICAgICAvLyBtZXJnZSBvdmVybGFwcGluZyB0aW1lIHJhbmdlc1xuICAgICAgICAgIC8vIHVwZGF0ZSBsYXN0UmFuZ2UuZW5kIG9ubHkgaWYgc21hbGxlciB0aGFuIGl0ZW0uZW5kXG4gICAgICAgICAgLy8gZS5nLiAgWyAxLCAxNV0gd2l0aCAgWyAyLDhdID0+IFsgMSwxNV0gKG5vIG5lZWQgdG8gbW9kaWZ5IGxhc3RSYW5nZS5lbmQpXG4gICAgICAgICAgLy8gd2hlcmVhcyBbIDEsIDhdIHdpdGggIFsgMiwxNV0gPT4gWyAxLDE1XSAoIGxhc3RSYW5nZSBzaG91bGQgc3dpdGNoIGZyb20gWzEsOF0gdG8gWzEsMTVdKVxuICAgICAgICAgIGlmKGJ1ZmZlcmVkW2ldLmVuZCA+IGJ1ZjJlbmQpIHtcbiAgICAgICAgICAgIGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kID0gYnVmZmVyZWRbaV0uZW5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBiaWcgaG9sZVxuICAgICAgICAgIGJ1ZmZlcmVkMi5wdXNoKGJ1ZmZlcmVkW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZmlyc3QgdmFsdWVcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvczsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0YXJ0ID0gIGJ1ZmZlcmVkMltpXS5zdGFydCxcbiAgICAgICAgICBlbmQgPSBidWZmZXJlZDJbaV0uZW5kO1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPj0gc3RhcnQgJiYgcG9zIDwgZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IHN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBlbmQ7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH0gZWxzZSBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPCBzdGFydCkge1xuICAgICAgICBidWZmZXJTdGFydE5leHQgPSBzdGFydDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7bGVuOiBidWZmZXJMZW4sIHN0YXJ0OiBidWZmZXJTdGFydCwgZW5kOiBidWZmZXJFbmQsIG5leHRTdGFydCA6IGJ1ZmZlclN0YXJ0TmV4dH07XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBCdWZmZXJIZWxwZXI7XG4iLCIvKipcbiAqIExldmVsIEhlbHBlciBjbGFzcywgcHJvdmlkaW5nIG1ldGhvZHMgZGVhbGluZyB3aXRoIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGRyaWZ0XG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgTGV2ZWxIZWxwZXIge1xuXG4gIHN0YXRpYyBtZXJnZURldGFpbHMob2xkRGV0YWlscyxuZXdEZXRhaWxzKSB7XG4gICAgdmFyIHN0YXJ0ID0gTWF0aC5tYXgob2xkRGV0YWlscy5zdGFydFNOLG5ld0RldGFpbHMuc3RhcnRTTiktbmV3RGV0YWlscy5zdGFydFNOLFxuICAgICAgICBlbmQgPSBNYXRoLm1pbihvbGREZXRhaWxzLmVuZFNOLG5ld0RldGFpbHMuZW5kU04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZGVsdGEgPSBuZXdEZXRhaWxzLnN0YXJ0U04gLSBvbGREZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIG9sZGZyYWdtZW50cyA9IG9sZERldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICBuZXdmcmFnbWVudHMgPSBuZXdEZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgY2NPZmZzZXQgPTAsXG4gICAgICAgIFBUU0ZyYWc7XG5cbiAgICAvLyBjaGVjayBpZiBvbGQvbmV3IHBsYXlsaXN0cyBoYXZlIGZyYWdtZW50cyBpbiBjb21tb25cbiAgICBpZiAoIGVuZCA8IHN0YXJ0KSB7XG4gICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGxvb3AgdGhyb3VnaCBvdmVybGFwcGluZyBTTiBhbmQgdXBkYXRlIHN0YXJ0UFRTICwgY2MsIGFuZCBkdXJhdGlvbiBpZiBhbnkgZm91bmRcbiAgICBmb3IodmFyIGkgPSBzdGFydCA7IGkgPD0gZW5kIDsgaSsrKSB7XG4gICAgICB2YXIgb2xkRnJhZyA9IG9sZGZyYWdtZW50c1tkZWx0YStpXSxcbiAgICAgICAgICBuZXdGcmFnID0gbmV3ZnJhZ21lbnRzW2ldO1xuICAgICAgY2NPZmZzZXQgPSBvbGRGcmFnLmNjIC0gbmV3RnJhZy5jYztcbiAgICAgIGlmICghaXNOYU4ob2xkRnJhZy5zdGFydFBUUykpIHtcbiAgICAgICAgbmV3RnJhZy5zdGFydCA9IG5ld0ZyYWcuc3RhcnRQVFMgPSBvbGRGcmFnLnN0YXJ0UFRTO1xuICAgICAgICBuZXdGcmFnLmVuZFBUUyA9IG9sZEZyYWcuZW5kUFRTO1xuICAgICAgICBuZXdGcmFnLmR1cmF0aW9uID0gb2xkRnJhZy5kdXJhdGlvbjtcbiAgICAgICAgUFRTRnJhZyA9IG5ld0ZyYWc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoY2NPZmZzZXQpIHtcbiAgICAgIGxvZ2dlci5sb2coYGRpc2NvbnRpbnVpdHkgc2xpZGluZyBmcm9tIHBsYXlsaXN0LCB0YWtlIGRyaWZ0IGludG8gYWNjb3VudGApO1xuICAgICAgZm9yKGkgPSAwIDsgaSA8IG5ld2ZyYWdtZW50cy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgbmV3ZnJhZ21lbnRzW2ldLmNjICs9IGNjT2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGlmIGF0IGxlYXN0IG9uZSBmcmFnbWVudCBjb250YWlucyBQVFMgaW5mbywgcmVjb21wdXRlIFBUUyBpbmZvcm1hdGlvbiBmb3IgYWxsIGZyYWdtZW50c1xuICAgIGlmKFBUU0ZyYWcpIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZUZyYWdQVFMobmV3RGV0YWlscyxQVFNGcmFnLnNuLFBUU0ZyYWcuc3RhcnRQVFMsUFRTRnJhZy5lbmRQVFMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBhZGp1c3Qgc3RhcnQgYnkgc2xpZGluZyBvZmZzZXRcbiAgICAgIHZhciBzbGlkaW5nID0gb2xkZnJhZ21lbnRzW2RlbHRhXS5zdGFydDtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5zdGFydCArPSBzbGlkaW5nO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgaXQgbWVhbnMgd2UgaGF2ZSBmcmFnbWVudHMgb3ZlcmxhcHBpbmcgYmV0d2VlblxuICAgIC8vIG9sZCBhbmQgbmV3IGxldmVsLiByZWxpYWJsZSBQVFMgaW5mbyBpcyB0aHVzIHJlbHlpbmcgb24gb2xkIGxldmVsXG4gICAgbmV3RGV0YWlscy5QVFNLbm93biA9IG9sZERldGFpbHMuUFRTS25vd247XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3RhdGljIHVwZGF0ZUZyYWdQVFMoZGV0YWlscyxzbixzdGFydFBUUyxlbmRQVFMpIHtcbiAgICB2YXIgZnJhZ0lkeCwgZnJhZ21lbnRzLCBmcmFnLCBpO1xuICAgIC8vIGV4aXQgaWYgc24gb3V0IG9mIHJhbmdlXG4gICAgaWYgKHNuIDwgZGV0YWlscy5zdGFydFNOIHx8IHNuID4gZGV0YWlscy5lbmRTTikge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIGZyYWdJZHggPSBzbiAtIGRldGFpbHMuc3RhcnRTTjtcbiAgICBmcmFnbWVudHMgPSBkZXRhaWxzLmZyYWdtZW50cztcbiAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHhdO1xuICAgIGlmKCFpc05hTihmcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgc3RhcnRQVFMgPSBNYXRoLm1pbihzdGFydFBUUyxmcmFnLnN0YXJ0UFRTKTtcbiAgICAgIGVuZFBUUyA9IE1hdGgubWF4KGVuZFBUUywgZnJhZy5lbmRQVFMpO1xuICAgIH1cblxuICAgIHZhciBkcmlmdCA9IHN0YXJ0UFRTIC0gZnJhZy5zdGFydDtcblxuICAgIGZyYWcuc3RhcnQgPSBmcmFnLnN0YXJ0UFRTID0gc3RhcnRQVFM7XG4gICAgZnJhZy5lbmRQVFMgPSBlbmRQVFM7XG4gICAgZnJhZy5kdXJhdGlvbiA9IGVuZFBUUyAtIHN0YXJ0UFRTO1xuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0tMSB0byBmcmFnIDBcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpID4gMCA7IGktLSkge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGktMSk7XG4gICAgfVxuXG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bSB0byBsYXN0IGZyYWdcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpIDwgZnJhZ21lbnRzLmxlbmd0aCAtIDEgOyBpKyspIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpKzEpO1xuICAgIH1cbiAgICBkZXRhaWxzLlBUU0tub3duID0gdHJ1ZTtcbiAgICAvL2xvZ2dlci5sb2coYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhZyBzdGFydC9lbmQ6JHtzdGFydFBUUy50b0ZpeGVkKDMpfS8ke2VuZFBUUy50b0ZpeGVkKDMpfWApO1xuXG4gICAgcmV0dXJuIGRyaWZ0O1xuICB9XG5cbiAgc3RhdGljIHVwZGF0ZVBUUyhmcmFnbWVudHMsZnJvbUlkeCwgdG9JZHgpIHtcbiAgICB2YXIgZnJhZ0Zyb20gPSBmcmFnbWVudHNbZnJvbUlkeF0sZnJhZ1RvID0gZnJhZ21lbnRzW3RvSWR4XSwgZnJhZ1RvUFRTID0gZnJhZ1RvLnN0YXJ0UFRTO1xuICAgIC8vIGlmIHdlIGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgaWYoIWlzTmFOKGZyYWdUb1BUUykpIHtcbiAgICAgIC8vIHVwZGF0ZSBmcmFnbWVudCBkdXJhdGlvbi5cbiAgICAgIC8vIGl0IGhlbHBzIHRvIGZpeCBkcmlmdHMgYmV0d2VlbiBwbGF5bGlzdCByZXBvcnRlZCBkdXJhdGlvbiBhbmQgZnJhZ21lbnQgcmVhbCBkdXJhdGlvblxuICAgICAgaWYgKHRvSWR4ID4gZnJvbUlkeCkge1xuICAgICAgICBmcmFnRnJvbS5kdXJhdGlvbiA9IGZyYWdUb1BUUy1mcmFnRnJvbS5zdGFydDtcbiAgICAgICAgaWYoZnJhZ0Zyb20uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgZnJhZyAke2ZyYWdGcm9tLnNufSxsZXZlbCAke2ZyYWdGcm9tLmxldmVsfSwgdGhlcmUgc2hvdWxkIGJlIHNvbWUgZHVyYXRpb24gZHJpZnQgYmV0d2VlbiBwbGF5bGlzdCBhbmQgZnJhZ21lbnQhYCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5kdXJhdGlvbiA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvUFRTO1xuICAgICAgICBpZihmcmFnVG8uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgZnJhZyAke2ZyYWdUby5zbn0sbGV2ZWwgJHtmcmFnVG8ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyB3ZSBkb250IGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0ICsgZnJhZ0Zyb20uZHVyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uc3RhcnQgPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUby5kdXJhdGlvbjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxIZWxwZXI7XG4iLCIvKipcbiAqIEhMUyBpbnRlcmZhY2VcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEZyYWdtZW50TG9hZGVyIGZyb20gJy4vbG9hZGVyL2ZyYWdtZW50LWxvYWRlcic7XG5pbXBvcnQgQWJyQ29udHJvbGxlciBmcm9tICAgICcuL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXInO1xuaW1wb3J0IEJ1ZmZlckNvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgQ2FwTGV2ZWxDb250cm9sbGVyIGZyb20gICcuL2NvbnRyb2xsZXIvY2FwLWxldmVsLWNvbnRyb2xsZXInO1xuaW1wb3J0IFN0cmVhbUNvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9zdHJlYW0tY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyIGZyb20gICcuL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQgVGltZWxpbmVDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci90aW1lbGluZS1jb250cm9sbGVyJztcbi8vaW1wb3J0IEZQU0NvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL2Zwcy1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLCBlbmFibGVMb2dzfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgWGhyTG9hZGVyIGZyb20gJy4vdXRpbHMveGhyLWxvYWRlcic7XG5pbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgS2V5TG9hZGVyIGZyb20gJy4vbG9hZGVyL2tleS1sb2FkZXInO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiB3aW5kb3cuTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQ7IGNvZGVjcz1cImF2YzEuNDJFMDFFLG1wNGEuNDAuMlwiJykpO1xuICB9XG5cbiAgc3RhdGljIGdldCBFdmVudHMoKSB7XG4gICAgcmV0dXJuIEV2ZW50O1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvclR5cGVzKCkge1xuICAgIHJldHVybiBFcnJvclR5cGVzO1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvckRldGFpbHMoKSB7XG4gICAgcmV0dXJuIEVycm9yRGV0YWlscztcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRGVmYXVsdENvbmZpZygpIHtcbiAgICBpZighSGxzLmRlZmF1bHRDb25maWcpIHtcbiAgICAgICBIbHMuZGVmYXVsdENvbmZpZyA9IHtcbiAgICAgICAgICBhdXRvU3RhcnRMb2FkOiB0cnVlLFxuICAgICAgICAgIGRlYnVnOiBmYWxzZSxcbiAgICAgICAgICBjYXBMZXZlbFRvUGxheWVyU2l6ZTogZmFsc2UsXG4gICAgICAgICAgbWF4QnVmZmVyTGVuZ3RoOiAzMCxcbiAgICAgICAgICBtYXhCdWZmZXJTaXplOiA2MCAqIDEwMDAgKiAxMDAwLFxuICAgICAgICAgIG1heEJ1ZmZlckhvbGU6IDAuNSxcbiAgICAgICAgICBtYXhTZWVrSG9sZTogMixcbiAgICAgICAgICBtYXhGcmFnTG9va1VwVG9sZXJhbmNlIDogMC4yLFxuICAgICAgICAgIGxpdmVTeW5jRHVyYXRpb25Db3VudDozLFxuICAgICAgICAgIGxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudDogSW5maW5pdHksXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgIGxpdmVNYXhMYXRlbmN5RHVyYXRpb246IHVuZGVmaW5lZCxcbiAgICAgICAgICBtYXhNYXhCdWZmZXJMZW5ndGg6IDYwMCxcbiAgICAgICAgICBlbmFibGVXb3JrZXI6IHRydWUsXG4gICAgICAgICAgZW5hYmxlU29mdHdhcmVBRVM6IHRydWUsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nVGltZU91dDogMTAwMDAsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk6IDEsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdNYXhSZXRyeTogNCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGZyYWdMb2FkaW5nVGltZU91dDogMjAwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeTogNixcbiAgICAgICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkOiAzLFxuICAgICAgICAgIHN0YXJ0RnJhZ1ByZWZldGNoIDogZmFsc2UsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2Q6IDUwMDAsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQ6IDAuMixcbiAgICAgICAgICBhcHBlbmRFcnJvck1heFJldHJ5OiAzLFxuICAgICAgICAgIGxvYWRlcjogWGhyTG9hZGVyLFxuICAgICAgICAgIGZMb2FkZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgYWJyQ29udHJvbGxlciA6IEFickNvbnRyb2xsZXIsXG4gICAgICAgICAgYnVmZmVyQ29udHJvbGxlciA6IEJ1ZmZlckNvbnRyb2xsZXIsXG4gICAgICAgICAgY2FwTGV2ZWxDb250cm9sbGVyIDogQ2FwTGV2ZWxDb250cm9sbGVyLFxuICAgICAgICAgIHN0cmVhbUNvbnRyb2xsZXI6IFN0cmVhbUNvbnRyb2xsZXIsXG4gICAgICAgICAgdGltZWxpbmVDb250cm9sbGVyOiBUaW1lbGluZUNvbnRyb2xsZXIsXG4gICAgICAgICAgZW5hYmxlQ0VBNzA4Q2FwdGlvbnM6IHRydWUsXG4gICAgICAgICAgZW5hYmxlTVAyVFBhc3NUaHJvdWdoIDogZmFsc2VcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIEhscy5kZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgc3RhdGljIHNldCBEZWZhdWx0Q29uZmlnKGRlZmF1bHRDb25maWcpIHtcbiAgICBIbHMuZGVmYXVsdENvbmZpZyA9IGRlZmF1bHRDb25maWc7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgIHZhciBkZWZhdWx0Q29uZmlnID0gSGxzLkRlZmF1bHRDb25maWc7XG5cbiAgICBpZiAoKGNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgfHwgY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCkgJiYgKGNvbmZpZy5saXZlU3luY0R1cmF0aW9uIHx8IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IGRvblxcJ3QgbWl4IHVwIGxpdmVTeW5jRHVyYXRpb25Db3VudC9saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgYW5kIGxpdmVTeW5jRHVyYXRpb24vbGl2ZU1heExhdGVuY3lEdXJhdGlvbicpO1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gZGVmYXVsdENvbmZpZykge1xuICAgICAgICBpZiAocHJvcCBpbiBjb25maWcpIHsgY29udGludWU7IH1cbiAgICAgICAgY29uZmlnW3Byb3BdID0gZGVmYXVsdENvbmZpZ1twcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCAhPT0gdW5kZWZpbmVkICYmIGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgPD0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50XCIgbXVzdCBiZSBndCBcImxpdmVTeW5jRHVyYXRpb25Db3VudFwiJyk7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uICE9PSB1bmRlZmluZWQgJiYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uIDw9IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uIHx8IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uID09PSB1bmRlZmluZWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgaGxzLmpzIGNvbmZpZzogXCJsaXZlTWF4TGF0ZW5jeUR1cmF0aW9uXCIgbXVzdCBiZSBndCBcImxpdmVTeW5jRHVyYXRpb25cIicpO1xuICAgIH1cblxuICAgIGVuYWJsZUxvZ3MoY29uZmlnLmRlYnVnKTtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICAvLyBvYnNlcnZlciBzZXR1cFxuICAgIHZhciBvYnNlcnZlciA9IHRoaXMub2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcblxuICAgIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCAuLi5kYXRhKTtcbiAgICB9O1xuICAgIHRoaXMub24gPSBvYnNlcnZlci5vbi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLm9mZiA9IG9ic2VydmVyLm9mZi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnRyaWdnZXIgPSBvYnNlcnZlci50cmlnZ2VyLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBuZXcgUGxheWxpc3RMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlciA9IG5ldyBGcmFnbWVudExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG5ldyBMZXZlbENvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5hYnJDb250cm9sbGVyID0gbmV3IGNvbmZpZy5hYnJDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYnVmZmVyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmNhcExldmVsQ29udHJvbGxlciA9IG5ldyBjb25maWcuY2FwTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlciA9IG5ldyBjb25maWcuc3RyZWFtQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnRpbWVsaW5lQ29udHJvbGxlciA9IG5ldyBjb25maWcudGltZWxpbmVDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMua2V5TG9hZGVyID0gbmV3IEtleUxvYWRlcih0aGlzKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlciA9IG5ldyBGUFNDb250cm9sbGVyKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBsb2dnZXIubG9nKCdkZXN0cm95Jyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50LkRFU1RST1lJTkcpO1xuICAgIHRoaXMuZGV0YWNoTWVkaWEoKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmNhcExldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnRpbWVsaW5lQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5rZXlMb2FkZXIuZGVzdHJveSgpO1xuICAgIC8vdGhpcy5mcHNDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gICAgdGhpcy5vYnNlcnZlci5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGF0dGFjaE1lZGlhKG1lZGlhKSB7XG4gICAgbG9nZ2VyLmxvZygnYXR0YWNoTWVkaWEnKTtcbiAgICB0aGlzLm1lZGlhID0gbWVkaWE7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0FUVEFDSElORywge21lZGlhOiBtZWRpYX0pO1xuICB9XG5cbiAgZGV0YWNoTWVkaWEoKSB7XG4gICAgbG9nZ2VyLmxvZygnZGV0YWNoTWVkaWEnKTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUVESUFfREVUQUNISU5HKTtcbiAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgfVxuXG4gIGxvYWRTb3VyY2UodXJsKSB7XG4gICAgbG9nZ2VyLmxvZyhgbG9hZFNvdXJjZToke3VybH1gKTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHt1cmw6IHVybH0pO1xuICB9XG5cbiAgc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb249MCkge1xuICAgIGxvZ2dlci5sb2coJ3N0YXJ0TG9hZCcpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TG9hZCgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zdGFydExvYWQoc3RhcnRQb3NpdGlvbik7XG4gIH1cblxuICBzdG9wTG9hZCgpIHtcbiAgICBsb2dnZXIubG9nKCdzdG9wTG9hZCcpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0b3BMb2FkKCk7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLnN0b3BMb2FkKCk7XG4gIH1cblxuICBzd2FwQXVkaW9Db2RlYygpIHtcbiAgICBsb2dnZXIubG9nKCdzd2FwQXVkaW9Db2RlYycpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zd2FwQXVkaW9Db2RlYygpO1xuICB9XG5cbiAgcmVjb3Zlck1lZGlhRXJyb3IoKSB7XG4gICAgbG9nZ2VyLmxvZygncmVjb3Zlck1lZGlhRXJyb3InKTtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIHRoaXMuZGV0YWNoTWVkaWEoKTtcbiAgICB0aGlzLmF0dGFjaE1lZGlhKG1lZGlhKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gYWxsIHF1YWxpdHkgbGV2ZWxzICoqL1xuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbHM7XG4gIH1cblxuICAvKiogUmV0dXJuIGN1cnJlbnQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAqKi9cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5zdHJlYW1Db250cm9sbGVyLmN1cnJlbnRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGltbWVkaWF0ZWx5ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGN1cnJlbnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBjdXJyZW50TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtQ29udHJvbGxlci5uZXh0TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBuZXh0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgbmV4dExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIGN1cnJlbnQvbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIGN1cnJlbnQvbmV4dCBsb2FkZWQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbG9hZExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGxvYWRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgc2V0IG5leHRMb2FkTGV2ZWwobGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgZmlyc3RMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsO1xuICB9XG5cbiAgLyoqIHNldCAgc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IHN0YXJ0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgYXV0b0xldmVsQ2FwcGluZzoke25ld0xldmVsfWApO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiBjaGVjayBpZiB3ZSBhcmUgaW4gYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBtb2RlICovXG4gIGdldCBhdXRvTGV2ZWxFbmFibGVkKCkge1xuICAgIHJldHVybiAodGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPT09IC0xKTtcbiAgfVxuXG4gIC8qIHJldHVybiBtYW51YWwgbGV2ZWwgKi9cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBIbHM7XG4iLCIvLyBUaGlzIGlzIG1vc3RseSBmb3Igc3VwcG9ydCBvZiB0aGUgZXM2IG1vZHVsZSBleHBvcnRcbi8vIHN5bnRheCB3aXRoIHRoZSBiYWJlbCBjb21waWxlciwgaXQgbG9va3MgbGlrZSBpdCBkb2VzbnQgc3VwcG9ydFxuLy8gZnVuY3Rpb24gZXhwb3J0cyBsaWtlIHdlIGFyZSB1c2VkIHRvIGluIG5vZGUvY29tbW9uanNcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9obHMuanMnKS5kZWZhdWx0O1xuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEZyYWdtZW50TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIDEsIDAsIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIERlY3J5cHQga2V5IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEtleUxvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5LRVlfTE9BRElORyk7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gbnVsbDtcbiAgICB0aGlzLmRlY3J5cHR1cmwgPSBudWxsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbktleUxvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnID0gZGF0YS5mcmFnLFxuICAgICAgICBkZWNyeXB0ZGF0YSA9IGZyYWcuZGVjcnlwdGRhdGEsXG4gICAgICAgIHVyaSA9IGRlY3J5cHRkYXRhLnVyaTtcbiAgICAgICAgLy8gaWYgdXJpIGlzIGRpZmZlcmVudCBmcm9tIHByZXZpb3VzIG9uZSBvciBpZiBkZWNyeXB0IGtleSBub3QgcmV0cmlldmVkIHlldFxuICAgICAgaWYgKHVyaSAhPT0gdGhpcy5kZWNyeXB0dXJsIHx8IHRoaXMuZGVjcnlwdGtleSA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgICAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICAgICAgdGhpcy5kZWNyeXB0dXJsID0gdXJpO1xuICAgICAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgICAgICBmcmFnLmxvYWRlci5sb2FkKHVyaSwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5kZWNyeXB0a2V5KSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbG9hZGVkIHRoaXMga2V5LCByZXR1cm4gaXRcbiAgICAgICAgZGVjcnlwdGRhdGEua2V5ID0gdGhpcy5kZWNyeXB0a2V5O1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICB9XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IGZyYWcuZGVjcnlwdGRhdGEua2V5ID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZSk7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICBmcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcblxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEtleUxvYWRlcjtcbiIsIi8qKlxuICogUGxheWxpc3QgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBVUkxIZWxwZXIgZnJvbSAnLi4vdXRpbHMvdXJsJztcbmltcG9ydCBBdHRyTGlzdCBmcm9tICcuLi91dGlscy9hdHRyLWxpc3QnO1xuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgUGxheWxpc3RMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5MRVZFTF9MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBudWxsKTtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsIGRhdGEubGV2ZWwsIGRhdGEuaWQpO1xuICB9XG5cbiAgbG9hZCh1cmwsIGlkMSwgaWQyKSB7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZyxcbiAgICAgICAgcmV0cnksXG4gICAgICAgIHRpbWVvdXQsXG4gICAgICAgIHJldHJ5RGVsYXk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5pZCA9IGlkMTtcbiAgICB0aGlzLmlkMiA9IGlkMjtcbiAgICBpZih0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICByZXRyeSA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdNYXhSZXRyeTtcbiAgICAgIHRpbWVvdXQgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nVGltZU91dDtcbiAgICAgIHJldHJ5RGVsYXkgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0cnkgPSBjb25maWcubGV2ZWxMb2FkaW5nTWF4UmV0cnk7XG4gICAgICB0aW1lb3V0ID0gY29uZmlnLmxldmVsTG9hZGluZ1RpbWVPdXQ7XG4gICAgICByZXRyeURlbGF5ID0gY29uZmlnLmxldmVsTG9hZGluZ1JldHJ5RGVsYXk7XG4gICAgfVxuICAgIHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5wTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLnBMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsICcnLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGltZW91dCwgcmV0cnksIHJldHJ5RGVsYXkpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICByZXR1cm4gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVVUkwoYmFzZVVybCwgdXJsKTtcbiAgfVxuXG4gIHBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsKSB7XG4gICAgbGV0IGxldmVscyA9IFtdLCByZXN1bHQ7XG5cbiAgICAvLyBodHRwczovL3JlZ2V4MTAxLmNvbSBpcyB5b3VyIGZyaWVuZFxuICAgIGNvbnN0IHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOihbXlxcblxccl0qKVtcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmUuZXhlYyhzdHJpbmcpKSAhPSBudWxsKXtcbiAgICAgIGNvbnN0IGxldmVsID0ge307XG5cbiAgICAgIHZhciBhdHRycyA9IGxldmVsLmF0dHJzID0gbmV3IEF0dHJMaXN0KHJlc3VsdFsxXSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKTtcblxuICAgICAgdmFyIHJlc29sdXRpb24gPSBhdHRycy5kZWNpbWFsUmVzb2x1dGlvbignUkVTT0xVVElPTicpO1xuICAgICAgaWYocmVzb2x1dGlvbikge1xuICAgICAgICBsZXZlbC53aWR0aCA9IHJlc29sdXRpb24ud2lkdGg7XG4gICAgICAgIGxldmVsLmhlaWdodCA9IHJlc29sdXRpb24uaGVpZ2h0O1xuICAgICAgfVxuICAgICAgbGV2ZWwuYml0cmF0ZSA9IGF0dHJzLmRlY2ltYWxJbnRlZ2VyKCdCQU5EV0lEVEgnKTtcbiAgICAgIGxldmVsLm5hbWUgPSBhdHRycy5OQU1FO1xuXG4gICAgICB2YXIgY29kZWNzID0gYXR0cnMuQ09ERUNTO1xuICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgIGNvZGVjcyA9IGNvZGVjcy5zcGxpdCgnLCcpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvZGVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IGNvZGVjID0gY29kZWNzW2ldO1xuICAgICAgICAgIGlmIChjb2RlYy5pbmRleE9mKCdhdmMxJykgIT09IC0xKSB7XG4gICAgICAgICAgICBsZXZlbC52aWRlb0NvZGVjID0gdGhpcy5hdmMxdG9hdmNvdGkoY29kZWMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXZlbC5hdWRpb0NvZGVjID0gY29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIGxldmVscztcbiAgfVxuXG4gIGF2YzF0b2F2Y290aShjb2RlYykge1xuICAgIHZhciByZXN1bHQsIGF2Y2RhdGEgPSBjb2RlYy5zcGxpdCgnLicpO1xuICAgIGlmIChhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwMCcgKyBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC00KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gY29kZWM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBjbG9uZU9iaihvYmopIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsXG4gICAgICAgIHRvdGFsZHVyYXRpb24gPSAwLFxuICAgICAgICBsZXZlbCA9IHt1cmw6IGJhc2V1cmwsIGZyYWdtZW50czogW10sIGxpdmU6IHRydWUsIHN0YXJ0U046IDB9LFxuICAgICAgICBsZXZlbGtleSA9IHttZXRob2QgOiBudWxsLCBrZXkgOiBudWxsLCBpdiA6IG51bGwsIHVyaSA6IG51bGx9LFxuICAgICAgICBjYyA9IDAsXG4gICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGwsXG4gICAgICAgIGZyYWcgPSBudWxsLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIHJlZ2V4cCxcbiAgICAgICAgYnl0ZVJhbmdlRW5kT2Zmc2V0LFxuICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldDtcblxuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVC1YLShLRVkpOiguKikpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSooW1xcclxcbl0rW14jfFxcclxcbl0rKT8pfCg/OiNFWFQtWC0oQllURVJBTkdFKTooW1xcZF0rW0BbXFxkXSopXSpbXFxyXFxuXSsoW14jfFxcclxcbl0rKT98KD86I0VYVC1YLShFTkRMSVNUKSl8KD86I0VYVC1YLShESVMpQ09OVElOVUlUWSkpfCg/OiNFWFQtWC0oUFJPR1JBTS1EQVRFLVRJTUUpOiguKikpL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCkge1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4pIHsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpOyB9KTtcbiAgICAgIHN3aXRjaCAocmVzdWx0WzBdKSB7XG4gICAgICAgIGNhc2UgJ01FRElBLVNFUVVFTkNFJzpcbiAgICAgICAgICBjdXJyZW50U04gPSBsZXZlbC5zdGFydFNOID0gcGFyc2VJbnQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnVEFSR0VURFVSQVRJT04nOlxuICAgICAgICAgIGxldmVsLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBsZXZlbC5saXZlID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0RJUyc6XG4gICAgICAgICAgY2MrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnQllURVJBTkdFJzpcbiAgICAgICAgICB2YXIgcGFyYW1zID0gcmVzdWx0WzFdLnNwbGl0KCdAJyk7XG4gICAgICAgICAgaWYgKHBhcmFtcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1swXSkgKyBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICBpZiAoZnJhZyAmJiAhZnJhZy51cmwpIHtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGlmICghaXNOYU4oZHVyYXRpb24pKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ2RlY3J5cHRkYXRhLFxuICAgICAgICAgICAgICAgIHNuID0gY3VycmVudFNOKys7XG4gICAgICAgICAgICBpZiAobGV2ZWxrZXkubWV0aG9kICYmIGxldmVsa2V5LnVyaSAmJiAhbGV2ZWxrZXkuaXYpIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gdGhpcy5jbG9uZU9iaihsZXZlbGtleSk7XG4gICAgICAgICAgICAgIHZhciB1aW50OFZpZXcgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxMjsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgICAgICAgICB1aW50OFZpZXdbaV0gPSAoc24gPj4gOCooMTUtaSkpICYgMHhmZjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEuaXYgPSB1aW50OFZpZXc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSBsZXZlbGtleTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB1cmwgPSByZXN1bHRbMl0gPyB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKSA6IG51bGw7XG4gICAgICAgICAgICBmcmFnID0ge3VybDogdXJsLCBkdXJhdGlvbjogZHVyYXRpb24sIHN0YXJ0OiB0b3RhbGR1cmF0aW9uLCBzbjogc24sIGxldmVsOiBpZCwgY2M6IGNjKyssIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0OiBieXRlUmFuZ2VTdGFydE9mZnNldCwgYnl0ZVJhbmdlRW5kT2Zmc2V0OiBieXRlUmFuZ2VFbmRPZmZzZXQsIGRlY3J5cHRkYXRhIDogZnJhZ2RlY3J5cHRkYXRhLCBwcm9ncmFtRGF0ZVRpbWU6IHByb2dyYW1EYXRlVGltZX07XG4gICAgICAgICAgICBsZXZlbC5mcmFnbWVudHMucHVzaChmcmFnKTtcbiAgICAgICAgICAgIHRvdGFsZHVyYXRpb24gKz0gZHVyYXRpb247XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IG51bGw7XG4gICAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnS0VZJzpcbiAgICAgICAgICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvZHJhZnQtcGFudG9zLWh0dHAtbGl2ZS1zdHJlYW1pbmctMDgjc2VjdGlvbi0zLjQuNFxuICAgICAgICAgIHZhciBkZWNyeXB0cGFyYW1zID0gcmVzdWx0WzFdO1xuICAgICAgICAgIHZhciBrZXlBdHRycyA9IG5ldyBBdHRyTGlzdChkZWNyeXB0cGFyYW1zKTtcbiAgICAgICAgICB2YXIgZGVjcnlwdG1ldGhvZCA9IGtleUF0dHJzLmVudW1lcmF0ZWRTdHJpbmcoJ01FVEhPRCcpLFxuICAgICAgICAgICAgICBkZWNyeXB0dXJpID0ga2V5QXR0cnMuVVJJLFxuICAgICAgICAgICAgICBkZWNyeXB0aXYgPSBrZXlBdHRycy5oZXhhZGVjaW1hbEludGVnZXIoJ0lWJyk7XG4gICAgICAgICAgaWYgKGRlY3J5cHRtZXRob2QpIHtcbiAgICAgICAgICAgIGxldmVsa2V5ID0geyBtZXRob2Q6IG51bGwsIGtleTogbnVsbCwgaXY6IG51bGwsIHVyaTogbnVsbCB9O1xuICAgICAgICAgICAgaWYgKChkZWNyeXB0dXJpKSAmJiAoZGVjcnlwdG1ldGhvZCA9PT0gJ0FFUy0xMjgnKSkge1xuICAgICAgICAgICAgICBsZXZlbGtleS5tZXRob2QgPSBkZWNyeXB0bWV0aG9kO1xuICAgICAgICAgICAgICAvLyBVUkkgdG8gZ2V0IHRoZSBrZXlcbiAgICAgICAgICAgICAgbGV2ZWxrZXkudXJpID0gdGhpcy5yZXNvbHZlKGRlY3J5cHR1cmksIGJhc2V1cmwpO1xuICAgICAgICAgICAgICBsZXZlbGtleS5rZXkgPSBudWxsO1xuICAgICAgICAgICAgICAvLyBJbml0aWFsaXphdGlvbiBWZWN0b3IgKElWKVxuICAgICAgICAgICAgICBsZXZlbGtleS5pdiA9IGRlY3J5cHRpdjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1BST0dSQU0tREFURS1USU1FJzpcbiAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBuZXcgRGF0ZShEYXRlLnBhcnNlKHJlc3VsdFsxXSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZvdW5kICcgKyBsZXZlbC5mcmFnbWVudHMubGVuZ3RoICsgJyBmcmFnbWVudHMnKTtcbiAgICBpZihmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgbGV2ZWwuZnJhZ21lbnRzLnBvcCgpO1xuICAgICAgdG90YWxkdXJhdGlvbi09ZnJhZy5kdXJhdGlvbjtcbiAgICB9XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciB0YXJnZXQgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdHJpbmcgPSB0YXJnZXQucmVzcG9uc2VUZXh0LFxuICAgICAgICB1cmwgPSB0YXJnZXQucmVzcG9uc2VVUkwsXG4gICAgICAgIGlkID0gdGhpcy5pZCxcbiAgICAgICAgaWQyID0gdGhpcy5pZDIsXG4gICAgICAgIGhscyA9IHRoaXMuaGxzLFxuICAgICAgICBsZXZlbHM7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYgKHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWxsYmFjayB0byBpbml0aWFsIFVSTFxuICAgICAgdXJsID0gdGhpcy51cmw7XG4gICAgfVxuICAgIHN0YXRzLnRsb2FkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZSh0YXJnZXQuZ2V0UmVzcG9uc2VIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnKSk7XG4gICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdFxuICAgICAgICAvLyBpZiBmaXJzdCByZXF1ZXN0LCBmaXJlIG1hbmlmZXN0IGxvYWRlZCBldmVudCwgbGV2ZWwgd2lsbCBiZSByZWxvYWRlZCBhZnRlcndhcmRzXG4gICAgICAgIC8vICh0aGlzIGlzIHRvIGhhdmUgYSB1bmlmb3JtIGxvZ2ljIGZvciAxIGxldmVsL211bHRpbGV2ZWwgcGxheWxpc3RzKVxuICAgICAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogW3t1cmw6IHVybH1dLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGxldmVsRGV0YWlscyA9IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgdXJsLCBpZCk7XG4gICAgICAgICAgc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCwge2RldGFpbHM6IGxldmVsRGV0YWlscywgbGV2ZWw6IGlkLCBpZDogaWQyLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgdXJsKTtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgaWYgKGxldmVscy5sZW5ndGgpIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IGxldmVscywgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBsZXZlbCBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gRVhUTTNVIGRlbGltaXRlcid9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIHJlc3BvbnNlOiBldmVudC5jdXJyZW50VGFyZ2V0LCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCIvKipcbiAqIEdlbmVyYXRlIE1QNCBCb3hcbiovXG5cbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdmlkZW9IZGxyID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcblxuICAgIHZhciBhdWRpb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTMsIDB4NmYsIDB4NzUsIDB4NmUsXG4gICAgICAweDY0LCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOiB2aWRlb0hkbHIsXG4gICAgICAnYXVkaW8nOiBhdWRpb0hkbHJcbiAgICB9O1xuXG4gICAgdmFyIGRyZWYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG5cbiAgICB2YXIgc3RjbyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG5cbiAgICBNUDQuU1RUUyA9IE1QNC5TVFNDID0gTVA0LlNUQ08gPSBzdGNvO1xuXG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5WTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGdyYXBoaWNzbW9kZVxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwIC8vIG9wY29sb3JcbiAgICBdKTtcbiAgICBNUDQuU01IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBiYWxhbmNlXG4gICAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gICAgXSk7XG5cbiAgICBNUDQuU1RTRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTsvLyBlbnRyeV9jb3VudFxuXG4gICAgdmFyIG1ham9yQnJhbmQgPSBuZXcgVWludDhBcnJheShbMTA1LDExNSwxMTEsMTA5XSk7IC8vIGlzb21cbiAgICB2YXIgYXZjMUJyYW5kID0gbmV3IFVpbnQ4QXJyYXkoWzk3LDExOCw5OSw0OV0pOyAvLyBhdmMxXG4gICAgdmFyIG1pbm9yVmVyc2lvbiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIG1ham9yQnJhbmQsIG1pbm9yVmVyc2lvbiwgbWFqb3JCcmFuZCwgYXZjMUJyYW5kKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIGRyZWYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gOCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgbGVuID0gaSxcbiAgICByZXN1bHQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgcmVzdWx0WzBdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgICByZXN1bHRbMV0gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIHJlc3VsdFsyXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgICByZXN1bHRbM10gPSBzaXplICAmIDB4ZmY7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcbiAgICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICAgIGZvciAoaSA9IDAsIHNpemUgPSA4OyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIC8vIGNvcHkgcGF5bG9hZFtpXSBhcnJheSBAIG9mZnNldCBzaXplXG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsIGR1cmF0aW9uKSB7XG4gICAgZHVyYXRpb24gKj0gdGltZXNjYWxlO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4NTUsIDB4YzQsIC8vICd1bmQnIGxhbmd1YWdlICh1bmRldGVybWluZWQpXG4gICAgICAweDAwLCAweDAwXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1kaWEodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRpYSwgTVA0Lm1kaGQodHJhY2sudGltZXNjYWxlLCB0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLCBNUDQubWZoZChzbiksIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0udGltZXNjYWxlLCB0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKHRpbWVzY2FsZSxkdXJhdGlvbikge1xuICAgIGR1cmF0aW9uKj10aW1lc2NhbGU7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsIE1QNC5zdHNkKHRyYWNrKSwgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLCBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSwgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaSwgZGF0YSwgbGVuO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2suc3BzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgc3BzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2sucHBzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgcHBzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTtcbiAgICB9XG5cbiAgICB2YXIgYXZjYyA9IE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsICAgLy8gdmVyc2lvblxuICAgICAgICAgICAgc3BzWzNdLCAvLyBwcm9maWxlXG4gICAgICAgICAgICBzcHNbNF0sIC8vIHByb2ZpbGUgY29tcGF0XG4gICAgICAgICAgICBzcHNbNV0sIC8vIGxldmVsXG4gICAgICAgICAgICAweGZjIHwgMywgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICAgIDB4RTAgfCB0cmFjay5zcHMubGVuZ3RoIC8vIDNiaXQgcmVzZXJ2ZWQgKDExMSkgKyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0uY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIC8vY29uc29sZS5sb2coJ2F2Y2M6JyArIEhleC5oZXhEdW1wKGF2Y2MpKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB3aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICBoZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTIsXG4gICAgICAgIDB4NjQsIDB4NjEsIDB4NjksIDB4NkMsIC8vZGFpbHltb3Rpb24vaGxzLmpzXG4gICAgICAgIDB4NzksIDB4NkQsIDB4NkYsIDB4NzQsXG4gICAgICAgIDB4NjksIDB4NkYsIDB4NkUsIDB4MkYsXG4gICAgICAgIDB4NjgsIDB4NkMsIDB4NzMsIDB4MkUsXG4gICAgICAgIDB4NkEsIDB4NzMsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsICAgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBhdmNjLFxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmJ0cnQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDAsIDB4MWMsIDB4OWMsIDB4ODAsIC8vIGJ1ZmZlclNpemVEQlxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMF0pKSAvLyBhdmdCaXRyYXRlXG4gICAgICAgICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBlc2RzKHRyYWNrKSB7XG4gICAgdmFyIGNvbmZpZ2xlbiA9IHRyYWNrLmNvbmZpZy5sZW5ndGg7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcblxuICAgICAgMHgwMywgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDE3K2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAgIDB4MTUsIC8vIHN0cmVhbV90eXBlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBidWZmZXJfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYXZnQml0cmF0ZVxuXG4gICAgICAweDA1IC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgXS5jb25jYXQoW2NvbmZpZ2xlbl0pLmNvbmNhdCh0cmFjay5jb25maWcpLmNvbmNhdChbMHgwNiwgMHgwMSwgMHgwMl0pKTsgLy8gR0FTcGVjaWZpY0NvbmZpZykpOyAvLyBsZW5ndGggKyBhdWRpbyBjb25maWcgZGVzY3JpcHRvclxuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICB2YXIgYXVkaW9zYW1wbGVyYXRlID0gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgdHJhY2suY2hhbm5lbENvdW50LCAvLyBjaGFubmVsY291bnRcbiAgICAgIDB4MDAsIDB4MTAsIC8vIHNhbXBsZVNpemU6MTZiaXRzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgIChhdWRpb3NhbXBsZXJhdGUgPj4gOCkgJiAweEZGLFxuICAgICAgYXVkaW9zYW1wbGVyYXRlICYgMHhmZiwgLy9cbiAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmVzZHMsIE1QNC5lc2RzKHRyYWNrKSkpO1xuICB9XG5cbiAgc3RhdGljIHN0c2QodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNELCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5hdmMxKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHRraGQodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZCxcbiAgICAgICAgZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbip0cmFjay50aW1lc2NhbGUsXG4gICAgICAgIHdpZHRoID0gdHJhY2sud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHRyYWNrLmhlaWdodDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIChpZCA+PiAyNCkgJiAweEZGLFxuICAgICAgKGlkID4+IDE2KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gOCkgJiAweEZGLFxuICAgICAgaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgd2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgaGVpZ2h0ICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkge1xuICAgIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBNUDQuc2R0cCh0cmFjayksXG4gICAgICAgIGlkID0gdHJhY2suaWQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWYsXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoaWQgPj4gMjQpLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+MjQpLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LnRydW4odHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmR0XG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gdHJhZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gbW9vZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgOCksICAvLyBtZGF0IGhlYWRlclxuICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIHRyYWNrIGJveC5cbiAgICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IGEgdHJhY2sgZGVmaW5pdGlvblxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gICAqL1xuICBzdGF0aWMgdHJhayh0cmFjaykge1xuICAgIHRyYWNrLmR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24gfHwgMHhmZmZmZmZmZjtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhaywgTVA0LnRraGQodHJhY2spLCBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAoaWQgPj4gMjQpLFxuICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgKGlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXM9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICAgIGxlbiA9IHNhbXBsZXMubGVuZ3RoLFxuICAgICAgICBhcnJheWxlbiA9IDEyICsgKDE2ICogbGVuKSxcbiAgICAgICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheWxlbiksXG4gICAgICAgIGksc2FtcGxlLGR1cmF0aW9uLHNpemUsZmxhZ3MsY3RzO1xuICAgIG9mZnNldCArPSA4ICsgYXJyYXlsZW47XG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChsZW4gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiAxNikgJiAweEZGLFxuICAgICAgKGxlbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgbGVuICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdLDApO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGR1cmF0aW9uID0gc2FtcGxlLmR1cmF0aW9uO1xuICAgICAgc2l6ZSA9IHNhbXBsZS5zaXplO1xuICAgICAgZmxhZ3MgPSBzYW1wbGUuZmxhZ3M7XG4gICAgICBjdHMgPSBzYW1wbGUuY3RzO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKGR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKGZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgZmxhZ3MuaXNOb25TeW5jLFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHhGMCA8PCA4LFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChjdHMgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDgpICYgMHhGRixcbiAgICAgICAgY3RzICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG4gICAgaWYgKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhciBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksIHJlc3VsdDtcbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG4iLCIvKipcbiAqIGZNUDQgcmVtdXhlclxuKi9cblxuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IE1QNCBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBNUDRSZW11eGVyIHtcbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICAgIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SID0gNDtcbiAgICB0aGlzLlBFU19USU1FU0NBTEUgPSA5MDAwMDtcbiAgICB0aGlzLk1QNF9USU1FU0NBTEUgPSB0aGlzLlBFU19USU1FU0NBTEUgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgfVxuXG4gIGdldCBwYXNzdGhyb3VnaCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHRoaXMubmV4dEFhY1B0cyA9IHRoaXMubmV4dEF2Y0R0cyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHJlbXV4KGF1ZGlvVHJhY2ssdmlkZW9UcmFjayxpZDNUcmFjayx0ZXh0VHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmICh2aWRlb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4VmlkZW8odmlkZW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAoYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5yZW11eEF1ZGlvKGF1ZGlvVHJhY2ssdGltZU9mZnNldCxjb250aWd1b3VzKTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBJRDMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKGlkM1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4SUQzKGlkM1RyYWNrLHRpbWVPZmZzZXQpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAodGV4dFRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4VGV4dCh0ZXh0VHJhY2ssdGltZU9mZnNldCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgfVxuXG4gIGdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyLFxuICAgICAgICBhdWRpb1NhbXBsZXMgPSBhdWRpb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIHZpZGVvU2FtcGxlcyA9IHZpZGVvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICB0cmFja3MgPSB7fSxcbiAgICAgICAgZGF0YSA9IHsgdHJhY2tzIDogdHJhY2tzLCB1bmlxdWUgOiBmYWxzZSB9LFxuICAgICAgICBjb21wdXRlUFRTRFRTID0gKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCksXG4gICAgICAgIGluaXRQVFMsIGluaXREVFM7XG5cbiAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgaW5pdFBUUyA9IGluaXREVFMgPSBJbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGF1ZGlvVHJhY2suY29uZmlnICYmIGF1ZGlvU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF1ZGlvVHJhY2sudGltZXNjYWxlID0gYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICAvLyBNUDQgZHVyYXRpb24gKHRyYWNrIGR1cmF0aW9uIGluIHNlY29uZHMgbXVsdGlwbGllZCBieSB0aW1lc2NhbGUpIGlzIGNvZGVkIG9uIDMyIGJpdHNcbiAgICAgIC8vIHdlIGtub3cgdGhhdCBlYWNoIEFBQyBzYW1wbGUgY29udGFpbnMgMTAyNCBmcmFtZXMuLi4uXG4gICAgICAvLyBpbiBvcmRlciB0byBhdm9pZCBvdmVyZmxvd2luZyB0aGUgMzIgYml0IGNvdW50ZXIgZm9yIGxhcmdlIGR1cmF0aW9uLCB3ZSB1c2Ugc21hbGxlciB0aW1lc2NhbGUgKHRpbWVzY2FsZS9nY2QpXG4gICAgICAvLyB3ZSBqdXN0IG5lZWQgdG8gZW5zdXJlIHRoYXQgQUFDIHNhbXBsZSBkdXJhdGlvbiB3aWxsIHN0aWxsIGJlIGFuIGludGVnZXIgKHdpbGwgYmUgMTAyNC9nY2QpXG4gICAgICBpZiAoYXVkaW9UcmFjay50aW1lc2NhbGUgKiBhdWRpb1RyYWNrLmR1cmF0aW9uID4gTWF0aC5wb3coMiwgMzIpKSB7XG4gICAgICAgIGxldCBncmVhdGVzdENvbW1vbkRpdmlzb3IgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgICBpZiAoICEgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGdyZWF0ZXN0Q29tbW9uRGl2aXNvcihiLCBhICUgYik7XG4gICAgICAgIH07XG4gICAgICAgIGF1ZGlvVHJhY2sudGltZXNjYWxlID0gYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGUgLyBncmVhdGVzdENvbW1vbkRpdmlzb3IoYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGUsMTAyNCk7XG4gICAgICB9XG4gICAgICBsb2dnZXIubG9nICgnYXVkaW8gbXA0IHRpbWVzY2FsZSA6JysgYXVkaW9UcmFjay50aW1lc2NhbGUpO1xuICAgICAgdHJhY2tzLmF1ZGlvID0ge1xuICAgICAgICBjb250YWluZXIgOiAnYXVkaW8vbXA0JyxcbiAgICAgICAgY29kZWMgOiAgYXVkaW9UcmFjay5jb2RlYyxcbiAgICAgICAgaW5pdFNlZ21lbnQgOiBNUDQuaW5pdFNlZ21lbnQoW2F1ZGlvVHJhY2tdKSxcbiAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgY2hhbm5lbENvdW50IDogYXVkaW9UcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHQuIGZvciBhdWRpbywgUFRTICsgRFRTIC4uLlxuICAgICAgICBpbml0UFRTID0gaW5pdERUUyA9IGF1ZGlvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh2aWRlb1RyYWNrLnNwcyAmJiB2aWRlb1RyYWNrLnBwcyAmJiB2aWRlb1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB2aWRlb1RyYWNrLnRpbWVzY2FsZSA9IHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgICAgIHRyYWNrcy52aWRlbyA9IHtcbiAgICAgICAgY29udGFpbmVyIDogJ3ZpZGVvL21wNCcsXG4gICAgICAgIGNvZGVjIDogIHZpZGVvVHJhY2suY29kZWMsXG4gICAgICAgIGluaXRTZWdtZW50IDogTVA0LmluaXRTZWdtZW50KFt2aWRlb1RyYWNrXSksXG4gICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgIHdpZHRoIDogdmlkZW9UcmFjay53aWR0aCxcbiAgICAgICAgICBoZWlnaHQgOiB2aWRlb1RyYWNrLmhlaWdodFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgICAgaW5pdFBUUyA9IE1hdGgubWluKGluaXRQVFMsdmlkZW9TYW1wbGVzWzBdLnB0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQpO1xuICAgICAgICBpbml0RFRTID0gTWF0aC5taW4oaW5pdERUUyx2aWRlb1NhbXBsZXNbMF0uZHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoIU9iamVjdC5rZXlzKHRyYWNrcykpIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdubyBhdWRpby92aWRlbyBzYW1wbGVzIGZvdW5kJ30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsZGF0YSk7XG4gICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSBpbml0UFRTO1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gaW5pdERUUztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZW11eFZpZGVvKHRyYWNrLCB0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgdmFyIG9mZnNldCA9IDgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgcGVzMm1wNFNjYWxlRmFjdG9yID0gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsXG4gICAgICAgIG1wNFNhbXBsZUR1cmF0aW9uLFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsXG4gICAgICAgIGxhc3RQVFMsIGxhc3REVFMsXG4gICAgICAgIGlucHV0U2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMsXG4gICAgICAgIG91dHB1dFNhbXBsZXMgPSBbXTtcblxuICAvLyBQVFMgaXMgY29kZWQgb24gMzNiaXRzLCBhbmQgY2FuIGxvb3AgZnJvbSAtMl4zMiB0byAyXjMyXG4gIC8vIFBUU05vcm1hbGl6ZSB3aWxsIG1ha2UgUFRTL0RUUyB2YWx1ZSBtb25vdG9uaWMsIHdlIHVzZSBsYXN0IGtub3duIERUUyB2YWx1ZSBhcyByZWZlcmVuY2UgdmFsdWVcbiAgIGxldCBuZXh0QXZjRHRzO1xuICAgIGlmIChjb250aWd1b3VzKSB7XG4gICAgICAvLyBpZiBwYXJzZWQgZnJhZ21lbnQgaXMgY29udGlndW91cyB3aXRoIGxhc3Qgb25lLCBsZXQncyB1c2UgbGFzdCBEVFMgdmFsdWUgYXMgcmVmZXJlbmNlXG4gICAgICBuZXh0QXZjRHRzID0gdGhpcy5uZXh0QXZjRHRzO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpZiBub3QgY29udGlndW91cywgbGV0J3MgdXNlIHRhcmdldCB0aW1lT2Zmc2V0XG4gICAgICBuZXh0QXZjRHRzID0gdGltZU9mZnNldCpwZXNUaW1lU2NhbGU7XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBmaXJzdCBEVFMgYW5kIGxhc3QgRFRTLCBub3JtYWxpemUgdGhlbSBhZ2FpbnN0IHJlZmVyZW5jZSB2YWx1ZVxuICAgIGxldCBzYW1wbGUgPSBpbnB1dFNhbXBsZXNbMF07XG4gICAgZmlyc3REVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuICAgIGZpcnN0UFRTID0gIE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUucHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcblxuICAgIC8vIGNoZWNrIHRpbWVzdGFtcCBjb250aW51aXR5IGFjY3Jvc3MgY29uc2VjdXRpdmUgZnJhZ21lbnRzICh0aGlzIGlzIHRvIHJlbW92ZSBpbnRlci1mcmFnbWVudCBnYXAvaG9sZSlcbiAgICBsZXQgZGVsdGEgPSBNYXRoLnJvdW5kKChmaXJzdERUUyAtIG5leHRBdmNEdHMpIC8gOTApO1xuICAgIC8vIGlmIGZyYWdtZW50IGFyZSBjb250aWd1b3VzLCBvciBkZWx0YSBsZXNzIHRoYW4gNjAwbXMsIGVuc3VyZSB0aGVyZSBpcyBubyBvdmVybGFwL2hvbGUgYmV0d2VlbiBmcmFnbWVudHNcbiAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICBpZiAoZGVsdGEgPiAxKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZW1vdmUgaG9sZS9nYXAgOiBzZXQgRFRTIHRvIG5leHQgZXhwZWN0ZWQgRFRTXG4gICAgICAgIGZpcnN0RFRTID0gaW5wdXRTYW1wbGVzWzBdLmR0cyA9IG5leHRBdmNEdHM7XG4gICAgICAgIC8vIG9mZnNldCBQVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgUFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgRFRTXG4gICAgICAgIGZpcnN0UFRTID0gaW5wdXRTYW1wbGVzWzBdLnB0cyA9IE1hdGgubWF4KGZpcnN0UFRTIC0gZGVsdGEsIG5leHRBdmNEdHMpO1xuICAgICAgICBsb2dnZXIubG9nKGBWaWRlby9QVFMvRFRTIGFkanVzdGVkOiAke2ZpcnN0UFRTfS8ke2ZpcnN0RFRTfSxkZWx0YToke2RlbHRhfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNhbXBsZSBkdXJhdGlvbiAoYXMgZXhwZWN0ZWQgYnkgdHJ1biBNUDQgYm94ZXMpLCBzaG91bGQgYmUgdGhlIGRlbHRhIGJldHdlZW4gc2FtcGxlIERUU1xuICAgIC8vIGxldCdzIHNpZ25hbCB0aGUgc2FtZSBzYW1wbGUgZHVyYXRpb24gZm9yIGFsbCBzYW1wbGVzXG4gICAgLy8gc2V0IHRoaXMgY29uc3RhbnQgZHVyYXRpb24gYXMgYmVpbmcgdGhlIGF2ZyBkZWx0YSBiZXR3ZWVuIGNvbnNlY3V0aXZlIERUUy5cbiAgICBzYW1wbGUgPSBpbnB1dFNhbXBsZXNbaW5wdXRTYW1wbGVzLmxlbmd0aC0xXTtcbiAgICBsYXN0RFRTID0gTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuICAgIG1wNFNhbXBsZUR1cmF0aW9uID0gTWF0aC5yb3VuZCgobGFzdERUUy1maXJzdERUUykvKHBlczJtcDRTY2FsZUZhY3RvciooaW5wdXRTYW1wbGVzLmxlbmd0aC0xKSkpO1xuXG4gICAgLy8gbm9ybWFsaXplIGFsbCBQVFMvRFRTIG5vdyAuLi5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0U2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHNhbXBsZSA9IGlucHV0U2FtcGxlc1tpXTtcbiAgICAgIC8vIHNhbXBsZSBEVFMgaXMgY29tcHV0ZWQgdXNpbmcgYSBjb25zdGFudCBkZWNvZGluZyBvZmZzZXQgKG1wNFNhbXBsZUR1cmF0aW9uKSBiZXR3ZWVuIHNhbXBsZXNcbiAgICAgIHNhbXBsZS5kdHMgPSBmaXJzdERUUyArIGkqcGVzMm1wNFNjYWxlRmFjdG9yKm1wNFNhbXBsZUR1cmF0aW9uO1xuICAgICAgLy8gd2Ugbm9ybWFsaXplIFBUUyBhZ2FpbnN0IG5leHRBdmNEdHMsIHdlIGFsc28gc3Vic3RyYWN0IGluaXREVFMgKHNvbWUgc3RyZWFtcyBkb24ndCBzdGFydCBAIFBUUyBPKVxuICAgICAgLy8gYW5kIHdlIGVuc3VyZSB0aGF0IGNvbXB1dGVkIHZhbHVlIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBzYW1wbGUgRFRTXG4gICAgICBzYW1wbGUucHRzID0gTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLCBzYW1wbGUuZHRzKTtcbiAgICB9XG4gICAgbGFzdFBUUyA9IGlucHV0U2FtcGxlc1tpbnB1dFNhbXBsZXMubGVuZ3RoLTFdLnB0cztcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgKDQgKiB0cmFjay5uYk5hbHUpICsgOCk7XG4gICAgbGV0IHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgIHdoaWxlIChpbnB1dFNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBsZXQgYXZjU2FtcGxlID0gaW5wdXRTYW1wbGVzLnNoaWZ0KCksXG4gICAgICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlIChhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKG9mZnNldCwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCArPSA0ICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YXZjU2FtcGxlLnB0c30vJHthdmNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhdmNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBvdXRwdXRTYW1wbGVzLnB1c2goe1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgICAvLyBjb25zdGFudCBkdXJhdGlvblxuICAgICAgICBkdXJhdGlvbjogbXA0U2FtcGxlRHVyYXRpb24sXG4gICAgICAgIC8vIHNldCBjb21wb3NpdGlvbiB0aW1lIG9mZnNldCBhcyBhIG11bHRpcGxlIG9mIHNhbXBsZSBkdXJhdGlvblxuICAgICAgICBjdHM6IE1hdGgubWF4KDAsbXA0U2FtcGxlRHVyYXRpb24qTWF0aC5yb3VuZCgoYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMpLyhwZXMybXA0U2NhbGVGYWN0b3IqbXA0U2FtcGxlRHVyYXRpb24pKSksXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uIDogYXZjU2FtcGxlLmtleSA/IDIgOiAxLFxuICAgICAgICAgIGlzTm9uU3luYyA6IGF2Y1NhbXBsZS5rZXkgPyAwIDogMVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIERUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgRFRTICsgbGFzdCBzYW1wbGUgZHVyYXRpb24gKGluIFBFUyB0aW1lc2NhbGUpXG4gICAgdGhpcy5uZXh0QXZjRHRzID0gbGFzdERUUyArIG1wNFNhbXBsZUR1cmF0aW9uKnBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLm5iTmFsdSA9IDA7XG4gICAgaWYob3V0cHV0U2FtcGxlcy5sZW5ndGggJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEpIHtcbiAgICAgIGxldCBmbGFncyA9IG91dHB1dFNhbXBsZXNbMF0uZmxhZ3M7XG4gICAgLy8gY2hyb21lIHdvcmthcm91bmQsIG1hcmsgZmlyc3Qgc2FtcGxlIGFzIGJlaW5nIGEgUmFuZG9tIEFjY2VzcyBQb2ludCB0byBhdm9pZCBzb3VyY2VidWZmZXIgYXBwZW5kIGlzc3VlXG4gICAgLy8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTIyOTQxMlxuICAgICAgZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgIGZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgfVxuICAgIHRyYWNrLnNhbXBsZXMgPSBvdXRwdXRTYW1wbGVzO1xuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIGRhdGExOiBtb29mLFxuICAgICAgZGF0YTI6IG1kYXQsXG4gICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmRQVFM6IChsYXN0UFRTICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbXA0U2FtcGxlRHVyYXRpb24pIC8gcGVzVGltZVNjYWxlLFxuICAgICAgc3RhcnREVFM6IGZpcnN0RFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kRFRTOiB0aGlzLm5leHRBdmNEdHMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICB0eXBlOiAndmlkZW8nLFxuICAgICAgbmI6IG91dHB1dFNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICByZW11eEF1ZGlvKHRyYWNrLHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgb2Zmc2V0ID0gOCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICBtcDR0aW1lU2NhbGUgPSB0cmFjay50aW1lc2NhbGUsXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHBlc1RpbWVTY2FsZS9tcDR0aW1lU2NhbGUsXG4gICAgICAgIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gPSB0cmFjay50aW1lc2NhbGUgKiAxMDI0IC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlLFxuICAgICAgICBhYWNTYW1wbGUsIG1wNFNhbXBsZSxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgc2FtcGxlcyA9IFtdLFxuICAgICAgICBzYW1wbGVzMCA9IFtdO1xuXG4gICAgdHJhY2suc2FtcGxlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiAoYS5wdHMtYi5wdHMpO1xuICAgIH0pO1xuICAgIHNhbXBsZXMwID0gdHJhY2suc2FtcGxlcztcblxuICAgIHdoaWxlIChzYW1wbGVzMC5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHNhbXBsZXMwLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBwdHMgPSBhYWNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGFhY1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKGBBdWRpby9QVFM6JHtNYXRoLnJvdW5kKHB0cy85MCl9YCk7XG4gICAgICAvLyBpZiBub3QgZmlyc3Qgc2FtcGxlXG4gICAgICBpZiAobGFzdERUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBsYXN0RFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIGxhc3REVFMpO1xuICAgICAgICAvLyBsZXQncyBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbi5cbiAgICAgICAgLy8gc2FtcGxlIER1cmF0aW9uIHNob3VsZCBiZSBjbG9zZSB0byBleHBlY3RlZFNhbXBsZUR1cmF0aW9uXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdERUUykgLyBwZXMybXA0U2NhbGVGYWN0b3I7XG4gICAgICAgIGlmKE1hdGguYWJzKG1wNFNhbXBsZS5kdXJhdGlvbiAtIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24pID4gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbi8xMCkge1xuICAgICAgICAgIC8vIG1vcmUgdGhhbiAxMCUgZGlmZiBiZXR3ZWVuIHNhbXBsZSBkdXJhdGlvbiBhbmQgZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbiAuLi4uIGxldHMgbG9nIHRoYXRcbiAgICAgICAgICBsb2dnZXIudHJhY2UoYGludmFsaWQgQUFDIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMgJHtNYXRoLnJvdW5kKHB0cy85MCl9LHNob3VsZCBiZSAxMDI0LGZvdW5kIDoke01hdGgucm91bmQobXA0U2FtcGxlLmR1cmF0aW9uKnRyYWNrLmF1ZGlvc2FtcGxlcmF0ZS90cmFjay50aW1lc2NhbGUpfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFsd2F5cyBhZGp1c3Qgc2FtcGxlIGR1cmF0aW9uIHRvIGF2b2lkIGF2IHN5bmMgaXNzdWVcbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbjtcbiAgICAgICAgZHRzbm9ybSA9IGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gKiBwZXMybXA0U2NhbGVGYWN0b3IgKyBsYXN0RFRTO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IG5leHRBYWNQdHMsIGRlbHRhO1xuICAgICAgICBpZiAoY29udGlndW91cykge1xuICAgICAgICAgIG5leHRBYWNQdHMgPSB0aGlzLm5leHRBYWNQdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV4dEFhY1B0cyA9IHRpbWVPZmZzZXQqcGVzVGltZVNjYWxlO1xuICAgICAgICB9XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gbmV4dEFhY1B0cykgLyBwZXNUaW1lU2NhbGUpO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIC8vIGxvZyBkZWx0YVxuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIGZyYW1lIG92ZXJsYXAsIG92ZXJsYXBwaW5nIGZvciBtb3JlIHRoYW4gaGFsZiBhIGZyYW1lIGR1cmFpb25cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMTIpIHtcbiAgICAgICAgICAgICAgLy8gZHJvcCBvdmVybGFwcGluZyBhdWRpbyBmcmFtZXMuLi4gYnJvd3NlciB3aWxsIGRlYWwgd2l0aCBpdFxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAkeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLCBkcm9wIGZyYW1lYCk7XG4gICAgICAgICAgICAgIHRyYWNrLmxlbiAtPSB1bml0LmJ5dGVMZW5ndGg7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IGR0c25vcm0gPSBuZXh0QWFjUHRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgICBpZih0cmFjay5sZW4gPiAwKSB7XG4gICAgICAgICAgLyogY29uY2F0ZW5hdGUgdGhlIGF1ZGlvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtZGF0IHR5cGUpICovXG4gICAgICAgICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRyYWNrLmxlbiArIDgpO1xuICAgICAgICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgICAgICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vIGF1ZGlvIHNhbXBsZXNcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1kYXQuc2V0KHVuaXQsIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2FhY1NhbXBsZS5wdHN9LyR7YWFjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYWFjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGN0czogMCxcbiAgICAgICAgZHVyYXRpb246MCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3REVFMgPSBkdHNub3JtO1xuICAgIH1cbiAgICB2YXIgbGFzdFNhbXBsZUR1cmF0aW9uID0gMDtcbiAgICB2YXIgbmJTYW1wbGVzID0gc2FtcGxlcy5sZW5ndGg7XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmIChuYlNhbXBsZXMgPj0gMikge1xuICAgICAgbGFzdFNhbXBsZUR1cmF0aW9uID0gc2FtcGxlc1tuYlNhbXBsZXMgLSAyXS5kdXJhdGlvbjtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICB9XG4gICAgaWYgKG5iU2FtcGxlcykge1xuICAgICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICAgIHRoaXMubmV4dEFhY1B0cyA9IHB0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcbiAgICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICAgIGRhdGExOiBtb29mLFxuICAgICAgICBkYXRhMjogbWRhdCxcbiAgICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmRQVFM6IHRoaXMubmV4dEFhY1B0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgc3RhcnREVFM6IGZpcnN0RFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmREVFM6IChkdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgdHlwZTogJ2F1ZGlvJyxcbiAgICAgICAgbmI6IG5iU2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmVtdXhJRDModHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIGlkMyBwdHMsIGR0cyB0byByZWxhdGl2ZSB0aW1lXG4gICAgICAgIC8vIHVzaW5nIHRoaXMuX2luaXRQVFMgYW5kIHRoaXMuX2luaXREVFMgdG8gY2FsY3VsYXRlIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgc2FtcGxlLnB0cyA9ICgoc2FtcGxlLnB0cyAtIHRoaXMuX2luaXRQVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgICAgc2FtcGxlLmR0cyA9ICgoc2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIHtcbiAgICAgICAgc2FtcGxlczp0cmFjay5zYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gIH1cblxuICByZW11eFRleHQodHJhY2ssdGltZU9mZnNldCkge1xuICAgIHRyYWNrLnNhbXBsZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gKGEucHRzLWIucHRzKTtcbiAgICB9KTtcblxuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIHRleHQgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgX1BUU05vcm1hbGl6ZSh2YWx1ZSwgcmVmZXJlbmNlKSB7XG4gICAgdmFyIG9mZnNldDtcbiAgICBpZiAocmVmZXJlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHJlZmVyZW5jZSA8IHZhbHVlKSB7XG4gICAgICAvLyAtIDJeMzNcbiAgICAgIG9mZnNldCA9IC04NTg5OTM0NTkyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyArIDJeMzNcbiAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDRSZW11eGVyO1xuIiwiLyoqXG4gKiBwYXNzdGhyb3VnaCByZW11eGVyXG4qL1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNsYXNzIFBhc3NUaHJvdWdoUmVtdXhlciB7XG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGdldCBwYXNzdGhyb3VnaCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LHJhd0RhdGEpIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyO1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHZhciB0cmFja3MgPSB7fSxcbiAgICAgICAgICBkYXRhID0geyB0cmFja3MgOiB0cmFja3MsIHVuaXF1ZSA6IHRydWUgfSxcbiAgICAgICAgICB0cmFjayA9IHZpZGVvVHJhY2ssXG4gICAgICAgICAgY29kZWMgPSB0cmFjay5jb2RlYztcblxuICAgICAgaWYgKGNvZGVjKSB7XG4gICAgICAgIGRhdGEudHJhY2tzLnZpZGVvID0ge1xuICAgICAgICAgIGNvbnRhaW5lciA6IHRyYWNrLmNvbnRhaW5lcixcbiAgICAgICAgICBjb2RlYyA6ICBjb2RlYyxcbiAgICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICAgIHdpZHRoIDogdHJhY2sud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQgOiB0cmFjay5oZWlnaHRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHRyYWNrID0gYXVkaW9UcmFjaztcbiAgICAgIGNvZGVjID0gdHJhY2suY29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgZGF0YS50cmFja3MuYXVkaW8gPSB7XG4gICAgICAgICAgY29udGFpbmVyIDogdHJhY2suY29udGFpbmVyLFxuICAgICAgICAgIGNvZGVjIDogIGNvZGVjLFxuICAgICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgICAgY2hhbm5lbENvdW50IDogdHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsZGF0YSk7XG4gICAgfVxuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIGRhdGExOiByYXdEYXRhLFxuICAgICAgc3RhcnRQVFM6IHRpbWVPZmZzZXQsXG4gICAgICBzdGFydERUUzogdGltZU9mZnNldCxcbiAgICAgIHR5cGU6ICdhdWRpb3ZpZGVvJyxcbiAgICAgIG5iOiAxXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGFzc1Rocm91Z2hSZW11eGVyO1xuIiwiXG4vLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2thbm9uZ2lsL25vZGUtbTN1OHBhcnNlL2Jsb2IvbWFzdGVyL2F0dHJsaXN0LmpzXG5jbGFzcyBBdHRyTGlzdCB7XG5cbiAgY29uc3RydWN0b3IoYXR0cnMpIHtcbiAgICBpZiAodHlwZW9mIGF0dHJzID09PSAnc3RyaW5nJykge1xuICAgICAgYXR0cnMgPSBBdHRyTGlzdC5wYXJzZUF0dHJMaXN0KGF0dHJzKTtcbiAgICB9XG4gICAgZm9yKHZhciBhdHRyIGluIGF0dHJzKXtcbiAgICAgIGlmKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIHRoaXNbYXR0cl0gPSBhdHRyc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDEwKTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBpZih0aGlzW2F0dHJOYW1lXSkge1xuICAgICAgbGV0IHN0cmluZ1ZhbHVlID0gKHRoaXNbYXR0ck5hbWVdIHx8ICcweCcpLnNsaWNlKDIpO1xuICAgICAgc3RyaW5nVmFsdWUgPSAoKHN0cmluZ1ZhbHVlLmxlbmd0aCAmIDEpID8gJzAnIDogJycpICsgc3RyaW5nVmFsdWU7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gbmV3IFVpbnQ4QXJyYXkoc3RyaW5nVmFsdWUubGVuZ3RoIC8gMik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDI7IGkrKykge1xuICAgICAgICB2YWx1ZVtpXSA9IHBhcnNlSW50KHN0cmluZ1ZhbHVlLnNsaWNlKGkgKiAyLCBpICogMiArIDIpLCAxNik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlckFzTnVtYmVyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTYpO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGRlY2ltYWxGbG9hdGluZ1BvaW50KGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpc1thdHRyTmFtZV0pO1xuICB9XG5cbiAgZW51bWVyYXRlZFN0cmluZyhhdHRyTmFtZSkge1xuICAgIHJldHVybiB0aGlzW2F0dHJOYW1lXTtcbiAgfVxuXG4gIGRlY2ltYWxSZXNvbHV0aW9uKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgcmVzID0gL14oXFxkKyl4KFxcZCspJC8uZXhlYyh0aGlzW2F0dHJOYW1lXSk7XG4gICAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBwYXJzZUludChyZXNbMV0sIDEwKSxcbiAgICAgIGhlaWdodDogcGFyc2VJbnQocmVzWzJdLCAxMClcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIHBhcnNlQXR0ckxpc3QoaW5wdXQpIHtcbiAgICBjb25zdCByZSA9IC9cXHMqKC4rPylcXHMqPSgoPzpcXFwiLio/XFxcIil8Lio/KSg/Oix8JCkvZztcbiAgICB2YXIgbWF0Y2gsIGF0dHJzID0ge307XG4gICAgd2hpbGUgKChtYXRjaCA9IHJlLmV4ZWMoaW5wdXQpKSAhPT0gbnVsbCkge1xuICAgICAgdmFyIHZhbHVlID0gbWF0Y2hbMl0sIHF1b3RlID0gJ1wiJztcblxuICAgICAgaWYgKHZhbHVlLmluZGV4T2YocXVvdGUpID09PSAwICYmXG4gICAgICAgICAgdmFsdWUubGFzdEluZGV4T2YocXVvdGUpID09PSAodmFsdWUubGVuZ3RoLTEpKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc2xpY2UoMSwgLTEpO1xuICAgICAgfVxuICAgICAgYXR0cnNbbWF0Y2hbMV1dID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBhdHRycztcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0dHJMaXN0O1xuIiwidmFyIEJpbmFyeVNlYXJjaCA9IHtcbiAgICAvKipcbiAgICAgKiBTZWFyY2hlcyBmb3IgYW4gaXRlbSBpbiBhbiBhcnJheSB3aGljaCBtYXRjaGVzIGEgY2VydGFpbiBjb25kaXRpb24uXG4gICAgICogVGhpcyByZXF1aXJlcyB0aGUgY29uZGl0aW9uIHRvIG9ubHkgbWF0Y2ggb25lIGl0ZW0gaW4gdGhlIGFycmF5LFxuICAgICAqIGFuZCBmb3IgdGhlIGFycmF5IHRvIGJlIG9yZGVyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBsaXN0IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY29tcGFyaXNvbkZ1bmN0aW9uXG4gICAgICogICAgICBDYWxsZWQgYW5kIHByb3ZpZGVkIGEgY2FuZGlkYXRlIGl0ZW0gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgICAqICAgICAgU2hvdWxkIHJldHVybjpcbiAgICAgKiAgICAgICAgICA+IC0xIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgbG93ZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBoaWdoZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDAgaWYgdGhlIGl0ZW0gaXMgdGhlIGl0ZW0geW91J3JlIGxvb2tpbmcgZm9yLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Kn0gVGhlIG9iamVjdCBpZiBpdCBpcyBmb3VuZCBvciBudWxsIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZWFyY2g6IGZ1bmN0aW9uKGxpc3QsIGNvbXBhcmlzb25GdW5jdGlvbikge1xuICAgICAgICB2YXIgbWluSW5kZXggPSAwO1xuICAgICAgICB2YXIgbWF4SW5kZXggPSBsaXN0Lmxlbmd0aCAtIDE7XG4gICAgICAgIHZhciBjdXJyZW50SW5kZXggPSBudWxsO1xuICAgICAgICB2YXIgY3VycmVudEVsZW1lbnQgPSBudWxsO1xuICAgICBcbiAgICAgICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgICAgICBjdXJyZW50SW5kZXggPSAobWluSW5kZXggKyBtYXhJbmRleCkgLyAyIHwgMDtcbiAgICAgICAgICAgIGN1cnJlbnRFbGVtZW50ID0gbGlzdFtjdXJyZW50SW5kZXhdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgY29tcGFyaXNvblJlc3VsdCA9IGNvbXBhcmlzb25GdW5jdGlvbihjdXJyZW50RWxlbWVudCk7XG4gICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHtcbiAgICAgICAgICAgICAgICBtaW5JbmRleCA9IGN1cnJlbnRJbmRleCArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkge1xuICAgICAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50RWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICBcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCaW5hcnlTZWFyY2g7XG4iLCIvKlxuICogQ0VBLTcwOCBpbnRlcnByZXRlclxuKi9cblxuY2xhc3MgQ0VBNzA4SW50ZXJwcmV0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgYXR0YWNoKG1lZGlhKSB7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICAgIHRoaXMubWVtb3J5ID0gW107XG4gIH1cblxuICBkZXRhY2goKVxuICB7XG4gICAgdGhpcy5jbGVhcigpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIF9jcmVhdGVDdWUoKVxuICB7XG4gICAgdmFyIFZUVEN1ZSA9IHdpbmRvdy5WVFRDdWUgfHwgd2luZG93LlRleHRUcmFja0N1ZTtcblxuICAgIHZhciBjdWUgPSB0aGlzLmN1ZSA9IG5ldyBWVFRDdWUoLTEsIC0xLCAnJyk7XG4gICAgY3VlLnRleHQgPSAnJztcbiAgICBjdWUucGF1c2VPbkV4aXQgPSBmYWxzZTtcblxuICAgIC8vIG1ha2Ugc3VyZSBpdCBkb2Vzbid0IHNob3cgdXAgYmVmb3JlIGl0J3MgcmVhZHlcbiAgICBjdWUuc3RhcnRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIC8vIHNob3cgaXQgJ2ZvcmV2ZXInIG9uY2Ugd2UgZG8gc2hvdyBpdFxuICAgIC8vICh3ZSdsbCBzZXQgdGhlIGVuZCB0aW1lIG9uY2Ugd2Uga25vdyBpdCBsYXRlcilcbiAgICBjdWUuZW5kVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XG5cbiAgICB0aGlzLm1lbW9yeS5wdXNoKGN1ZSk7XG4gIH1cblxuICBjbGVhcigpXG4gIHtcbiAgICB2YXIgdGV4dFRyYWNrID0gdGhpcy5fdGV4dFRyYWNrO1xuICAgIGlmICh0ZXh0VHJhY2sgJiYgdGV4dFRyYWNrLmN1ZXMpXG4gICAge1xuICAgICAgd2hpbGUgKHRleHRUcmFjay5jdWVzLmxlbmd0aCA+IDApXG4gICAgICB7XG4gICAgICAgIHRleHRUcmFjay5yZW1vdmVDdWUodGV4dFRyYWNrLmN1ZXNbMF0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1c2godGltZXN0YW1wLCBieXRlcylcbiAge1xuICAgIGlmICghdGhpcy5jdWUpXG4gICAge1xuICAgICAgdGhpcy5fY3JlYXRlQ3VlKCk7XG4gICAgfVxuXG4gICAgdmFyIGNvdW50ID0gYnl0ZXNbMF0gJiAzMTtcbiAgICB2YXIgcG9zaXRpb24gPSAyO1xuICAgIHZhciB0bXBCeXRlLCBjY2J5dGUxLCBjY2J5dGUyLCBjY1ZhbGlkLCBjY1R5cGU7XG5cbiAgICBmb3IgKHZhciBqPTA7IGo8Y291bnQ7IGorKylcbiAgICB7XG4gICAgICB0bXBCeXRlID0gYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUxID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMiA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjVmFsaWQgPSAoKDQgJiB0bXBCeXRlKSA9PT0gMCA/IGZhbHNlIDogdHJ1ZSk7XG4gICAgICBjY1R5cGUgPSAoMyAmIHRtcEJ5dGUpO1xuXG4gICAgICBpZiAoY2NieXRlMSA9PT0gMCAmJiBjY2J5dGUyID09PSAwKVxuICAgICAge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNjVmFsaWQpXG4gICAgICB7XG4gICAgICAgIGlmIChjY1R5cGUgPT09IDApIC8vIHx8IGNjVHlwZSA9PT0gMVxuICAgICAgICB7XG4gICAgICAgICAgLy8gU3RhbmRhcmQgQ2hhcmFjdGVyc1xuICAgICAgICAgIGlmICgweDIwICYgY2NieXRlMSB8fCAweDQwICYgY2NieXRlMSlcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUxKSArIHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3BlY2lhbCBDaGFyYWN0ZXJzXG4gICAgICAgICAgZWxzZSBpZiAoKGNjYnl0ZTEgPT09IDB4MTEgfHwgY2NieXRlMSA9PT0gMHgxOSkgJiYgY2NieXRlMiA+PSAweDMwICYmIGNjYnl0ZTIgPD0gMHgzRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBleHRlbmRlZCBjaGFycywgZS5nLiBtdXNpY2FsIG5vdGUsIGFjY2VudHNcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSA0ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNDk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwrAnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8K9JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCvyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4oSiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTY6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4pmqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICcgJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDqCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6InO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw7QnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYzOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8O7JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBXaGl0ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGUgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBHcmVlblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBCbHVlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBCbHVlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gQ3lhblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gQ3lhbiBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIC8vIFJlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUmVkIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQjpcbiAgICAgICAgICAgICAgICAvLyBZZWxsb3cgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljcyBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDE0IHx8IGNjYnl0ZTEgPT09IDB4MUMpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBzaG91bGRuJ3QgYWZmZWN0IHJvbGwtdXBzLi4uXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gUkNMOiBSZXN1bWUgQ2FwdGlvbiBMb2FkaW5nXG4gICAgICAgICAgICAgICAgLy8gYmVnaW4gcG9wIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICAvLyBCUzogQmFja3NwYWNlXG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCA9IHRoaXMuY3VlLnRleHQuc3Vic3RyKDAsIHRoaXMuY3VlLnRleHQubGVuZ3RoLTEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gQU9GOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb2ZmKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gQU9OOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb24pXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBERVI6IERlbGV0ZSB0byBlbmQgb2Ygcm93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBSVTI6IHJvbGwtdXAgMiByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNjpcbiAgICAgICAgICAgICAgICAvLyBSVTM6IHJvbGwtdXAgMyByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNzpcbiAgICAgICAgICAgICAgICAvLyBSVTQ6IHJvbGwtdXAgNCByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoNCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICAgICAgICAvLyBGT046IEZsYXNoIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICAgICAgICAvLyBSREM6IFJlc3VtZSBkaXJlY3QgY2FwdGlvbmluZ1xuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gVFI6IFRleHQgUmVzdGFydFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgLy8gUlREOiBSZXN1bWUgVGV4dCBEaXNwbGF5XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBFRE06IEVyYXNlIERpc3BsYXllZCBNZW1vcnlcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJEOlxuICAgICAgICAgICAgICAgIC8vIENSOiBDYXJyaWFnZSBSZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGFmZmVjdHMgcm9sbC11cFxuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gRU5NOiBFcmFzZSBub24tZGlzcGxheWVkIG1lbW9yeVxuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJGOlxuICAgICAgICAgICAgICAgIHRoaXMuX2ZsaXBNZW1vcnkodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICAvLyBFT0M6IEVuZCBvZiBjYXB0aW9uXG4gICAgICAgICAgICAgICAgLy8gaGlkZSBhbnkgZGlzcGxheWVkIGNhcHRpb25zIGFuZCBzaG93IGFueSBoaWRkZW4gb25lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNyB8fCBjY2J5dGUxID09PSAweDFGKSAmJiBjY2J5dGUyID49IDB4MjEgJiYgY2NieXRlMiA8PSAweDIzKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDEgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMiBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAzIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFByb2JhYmx5IGEgcHJlLWFtYmxlIGFkZHJlc3MgY29kZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mcm9tQ2hhckNvZGUodG1wQnl0ZSlcbiAge1xuICAgIHN3aXRjaCAodG1wQnl0ZSlcbiAgICB7XG4gICAgICBjYXNlIDQyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OpJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8OtJztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8OzJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8O6JztcblxuICAgICAgY2FzZSAzOlxuICAgICAgICByZXR1cm4gJ8OnJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8O3JztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8ORJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8OxJztcblxuICAgICAgY2FzZSA3OlxuICAgICAgICByZXR1cm4gJ+KWiCc7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHRtcEJ5dGUpO1xuICAgIH1cbiAgfVxuXG4gIF9mbGlwTWVtb3J5KHRpbWVzdGFtcClcbiAge1xuICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgIHRoaXMuX2ZsdXNoQ2FwdGlvbnModGltZXN0YW1wKTtcbiAgfVxuXG4gIF9mbHVzaENhcHRpb25zKHRpbWVzdGFtcClcbiAge1xuICAgIGlmICghdGhpcy5faGFzNzA4KVxuICAgIHtcbiAgICAgIHRoaXMuX3RleHRUcmFjayA9IHRoaXMubWVkaWEuYWRkVGV4dFRyYWNrKCdjYXB0aW9ucycsICdFbmdsaXNoJywgJ2VuJyk7XG4gICAgICB0aGlzLl9oYXM3MDggPSB0cnVlO1xuICAgIH1cblxuICAgIGZvcihsZXQgbWVtb3J5SXRlbSBvZiB0aGlzLm1lbW9yeSlcbiAgICB7XG4gICAgICBtZW1vcnlJdGVtLnN0YXJ0VGltZSA9IHRpbWVzdGFtcDtcbiAgICAgIHRoaXMuX3RleHRUcmFjay5hZGRDdWUobWVtb3J5SXRlbSk7XG4gICAgICB0aGlzLmRpc3BsYXkucHVzaChtZW1vcnlJdGVtKTtcbiAgICB9XG5cbiAgICB0aGlzLm1lbW9yeSA9IFtdO1xuICAgIHRoaXMuY3VlID0gbnVsbDtcbiAgfVxuXG4gIF9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKVxuICB7XG4gICAgZm9yIChsZXQgZGlzcGxheUl0ZW0gb2YgdGhpcy5kaXNwbGF5KVxuICAgIHtcbiAgICAgIGRpc3BsYXlJdGVtLmVuZFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gIH1cblxuLyogIF9yb2xsVXAobilcbiAge1xuICAgIC8vIFRPRE86IGltcGxlbWVudCByb2xsLXVwIGNhcHRpb25zXG4gIH1cbiovXG4gIF9jbGVhckJ1ZmZlcmVkQ3VlcygpXG4gIHtcbiAgICAvL3JlbW92ZSB0aGVtIGFsbC4uLlxuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ0VBNzA4SW50ZXJwcmV0ZXI7XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbmNvbnN0IGZha2VMb2dnZXIgPSB7XG4gIHRyYWNlOiBub29wLFxuICBkZWJ1Zzogbm9vcCxcbiAgbG9nOiBub29wLFxuICB3YXJuOiBub29wLFxuICBpbmZvOiBub29wLFxuICBlcnJvcjogbm9vcFxufTtcblxubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuLy9sZXQgbGFzdENhbGxUaW1lO1xuLy8gZnVuY3Rpb24gZm9ybWF0TXNnV2l0aFRpbWVJbmZvKHR5cGUsIG1zZykge1xuLy8gICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuLy8gICBjb25zdCBkaWZmID0gbGFzdENhbGxUaW1lID8gJysnICsgKG5vdyAtIGxhc3RDYWxsVGltZSkgOiAnMCc7XG4vLyAgIGxhc3RDYWxsVGltZSA9IG5vdztcbi8vICAgbXNnID0gKG5ldyBEYXRlKG5vdykpLnRvSVNPU3RyaW5nKCkgKyAnIHwgWycgKyAgdHlwZSArICddID4gJyArIG1zZyArICcgKCAnICsgZGlmZiArICcgbXMgKSc7XG4vLyAgIHJldHVybiBtc2c7XG4vLyB9XG5cbmZ1bmN0aW9uIGZvcm1hdE1zZyh0eXBlLCBtc2cpIHtcbiAgbXNnID0gJ1snICsgIHR5cGUgKyAnXSA+ICcgKyBtc2c7XG4gIHJldHVybiBtc2c7XG59XG5cbmZ1bmN0aW9uIGNvbnNvbGVQcmludEZuKHR5cGUpIHtcbiAgY29uc3QgZnVuYyA9IHdpbmRvdy5jb25zb2xlW3R5cGVdO1xuICBpZiAoZnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBpZihhcmdzWzBdKSB7XG4gICAgICAgIGFyZ3NbMF0gPSBmb3JtYXRNc2codHlwZSwgYXJnc1swXSk7XG4gICAgICB9XG4gICAgICBmdW5jLmFwcGx5KHdpbmRvdy5jb25zb2xlLCBhcmdzKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiBub29wO1xufVxuXG5mdW5jdGlvbiBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsIC4uLmZ1bmN0aW9ucykge1xuICBmdW5jdGlvbnMuZm9yRWFjaChmdW5jdGlvbih0eXBlKSB7XG4gICAgZXhwb3J0ZWRMb2dnZXJbdHlwZV0gPSBkZWJ1Z0NvbmZpZ1t0eXBlXSA/IGRlYnVnQ29uZmlnW3R5cGVdLmJpbmQoZGVidWdDb25maWcpIDogY29uc29sZVByaW50Rm4odHlwZSk7XG4gIH0pO1xufVxuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Z0NvbmZpZykge1xuICBpZiAoZGVidWdDb25maWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnQ29uZmlnID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZyxcbiAgICAgIC8vIFJlbW92ZSBvdXQgZnJvbSBsaXN0IGhlcmUgdG8gaGFyZC1kaXNhYmxlIGEgbG9nLWxldmVsXG4gICAgICAvLyd0cmFjZScsXG4gICAgICAnZGVidWcnLFxuICAgICAgJ2xvZycsXG4gICAgICAnaW5mbycsXG4gICAgICAnd2FybicsXG4gICAgICAnZXJyb3InXG4gICAgKTtcbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGFsbG93IHRvIHVzZSBiaW5kIG9uIGNvbnNvbGUgb2JqZWN0IGFueXdheVxuICAgIC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgZXhwb3J0ZWRMb2dnZXIubG9nKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5cbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iLCJ2YXIgVVJMSGVscGVyID0ge1xuXG4gIC8vIGJ1aWxkIGFuIGFic29sdXRlIFVSTCBmcm9tIGEgcmVsYXRpdmUgb25lIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlVVJMXG4gIC8vIGlmIHJlbGF0aXZlVVJMIGlzIGFuIGFic29sdXRlIFVSTCBpdCB3aWxsIGJlIHJldHVybmVkIGFzIGlzLlxuICBidWlsZEFic29sdXRlVVJMOiBmdW5jdGlvbihiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xuICAgIC8vIHJlbW92ZSBhbnkgcmVtYWluaW5nIHNwYWNlIGFuZCBDUkxGXG4gICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTC50cmltKCk7XG4gICAgaWYgKC9eW2Etel0rOi9pLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICAvLyBjb21wbGV0ZSB1cmwsIG5vdCByZWxhdGl2ZVxuICAgICAgcmV0dXJuIHJlbGF0aXZlVVJMO1xuICAgIH1cblxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5ID0gbnVsbDtcbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoID0gbnVsbDtcblxuICAgIHZhciByZWxhdGl2ZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoU3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMSGFzaCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMUXVlcnkgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMSGFzaFNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIGJhc2VVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTERvbWFpblNwbGl0ID0gL14oKChbYS16XSspOik/XFwvXFwvW2EtejAtOVxcLlxcLV9+XSsoOlswLTldKyk/XFwvKSguKikkL2kuZXhlYyhiYXNlVVJMKTtcbiAgICB2YXIgYmFzZVVSTFByb3RvY29sID0gYmFzZVVSTERvbWFpblNwbGl0WzNdO1xuICAgIHZhciBiYXNlVVJMRG9tYWluID0gYmFzZVVSTERvbWFpblNwbGl0WzFdO1xuICAgIHZhciBiYXNlVVJMUGF0aCA9IGJhc2VVUkxEb21haW5TcGxpdFs1XTtcblxuICAgIHZhciBidWlsdFVSTCA9IG51bGw7XG4gICAgaWYgKC9eXFwvXFwvLy50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgYnVpbHRVUkwgPSBiYXNlVVJMUHJvdG9jb2wrJzovLycrVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMikpO1xuICAgIH1cbiAgICBlbHNlIGlmICgvXlxcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbitVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoJycsIHJlbGF0aXZlVVJMLnN1YnN0cmluZygxKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgYnVpbHRVUkwgPSBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoYmFzZVVSTERvbWFpbitiYXNlVVJMUGF0aCwgcmVsYXRpdmVVUkwpO1xuICAgIH1cblxuICAgIC8vIHB1dCB0aGUgcXVlcnkgYW5kIGhhc2ggcGFydHMgYmFja1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5KSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoKSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTEhhc2g7XG4gICAgfVxuICAgIHJldHVybiBidWlsdFVSTDtcbiAgfSxcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlUGF0aFxuICAvLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL2RvY3VtZW50L2Nvb2tpZSNVc2luZ19yZWxhdGl2ZV9VUkxzX2luX3RoZV9wYXRoX3BhcmFtZXRlclxuICAvLyB0aGlzIGRvZXMgbm90IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSByZWxhdGl2ZVBhdGggaXMgXCIvXCIgb3IgXCIvL1wiLiBUaGVzZSBjYXNlcyBzaG91bGQgYmUgaGFuZGxlZCBvdXRzaWRlIHRoaXMuXG4gIGJ1aWxkQWJzb2x1dGVQYXRoOiBmdW5jdGlvbihiYXNlUGF0aCwgcmVsYXRpdmVQYXRoKSB7XG4gICAgdmFyIHNSZWxQYXRoID0gcmVsYXRpdmVQYXRoO1xuICAgIHZhciBuVXBMbiwgc0RpciA9ICcnLCBzUGF0aCA9IGJhc2VQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgJyQxJykpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKCcvLi4vJywgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cCgnKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCwnICsgKChuVXBMbiAtIDEpIC8gMykgKyAnfSQnKSwgJy8nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVUkxIZWxwZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLmxvYWRlcixcbiAgICAgICAgdGltZW91dEhhbmRsZSA9IHRoaXMudGltZW91dEhhbmRsZTtcbiAgICBpZiAobG9hZGVyICYmIGxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgbG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGlmICh0aW1lb3V0SGFuZGxlKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwsIGZyYWcgPSBudWxsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgaWYgKGZyYWcgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQpICYmICFpc05hTihmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCkpIHtcbiAgICAgICAgdGhpcy5ieXRlUmFuZ2UgPSBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ICsgJy0nICsgKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0LTEpO1xuICAgIH1cbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHt0cmVxdWVzdDogcGVyZm9ybWFuY2Uubm93KCksIHJldHJ5OiAwfTtcbiAgICB0aGlzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHRoaXMubWF4UmV0cnkgPSBtYXhSZXRyeTtcbiAgICB0aGlzLnJldHJ5RGVsYXkgPSByZXRyeURlbGF5O1xuICAgIHRoaXMubG9hZEludGVybmFsKCk7XG4gIH1cblxuICBsb2FkSW50ZXJuYWwoKSB7XG4gICAgdmFyIHhocjtcblxuICAgIGlmICh0eXBlb2YgWERvbWFpblJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgfVxuXG4gICAgeGhyLm9ubG9hZGVuZCA9IHRoaXMubG9hZGVuZC5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcblxuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgaWYgKHRoaXMuYnl0ZVJhbmdlKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHRoaXMuYnl0ZVJhbmdlKTtcbiAgICB9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgaWYgKHRoaXMueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAoeGhyLCB0aGlzLnVybCk7XG4gICAgfVxuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy50aW1lb3V0KTtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZGVuZChldmVudCkge1xuICAgIHZhciB4aHIgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdGF0dXMgPSB4aHIuc3RhdHVzLFxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgLy8gZG9uJ3QgcHJvY2VlZCBpZiB4aHIgaGFzIGJlZW4gYWJvcnRlZFxuICAgIGlmICghc3RhdHMuYWJvcnRlZCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
