/**
 * WRTC based loader
*/

import {logger} from '../utils/logger';

class WrtcLoader {

  constructor(config) {
	  if (!WrtcLoader.wrtc) { 
	    WrtcLoader.wrtc = new WRTCRequest( dataChannel );
	  }
    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  destroy() {
    this.abort();
    this.loader = null;
  }

  abort() {
	console.log('aborting request');
	var self = this;
	  WrtcLoader.wrtc.cancelRequest({
		  request_id: self.request_id
	  }, function(err, d) {
		  if( err ) { console.error(err); }
		  console.log('request cancelled');
	  });
		console.log('aborted');
      this.stats.aborted = true;
  }

  load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay, onProgress = null, frag = null) {
    this.url = url;
    if (frag && !isNaN(frag.byteRangeStartOffset) && !isNaN(frag.byteRangeEndOffset)) {
        this.byteRange = frag.byteRangeStartOffset + '-' + (frag.byteRangeEndOffset-1);
    }
    this.responseType = responseType;
    this.onSuccess = onSuccess;
    this.onProgress = onProgress;
    this.onTimeout = onTimeout;
    this.onError = onError;
    this.stats = {trequest: performance.now(), retry: 0};
    this.timeout = timeout;
    this.maxRetry = maxRetry;
    this.retryDelay = retryDelay;
    this.loadInternal();
  }

  parseURL( url ) {

	  url = url || this.url;

	  var playlistRequestRe = /cameras\/(\w+)\/video.m3u8/,
		  segmentRequestRe 	= /cameras\/(\w+)\/ts\/([\w-]+)\/([\w_.]+)/,
		  playlistStartRe 	= /begin=(\d+)/,
		  playlistEndRe 	= /end=(\d+)/,
		  playlistStreamRe 	= /stream=([\w-]+)/;

     var playlistMatch = playlistRequestRe.exec( url ),
		 segmentMatch  = segmentRequestRe.exec( url );

	 if( playlistMatch && playlistMatch[1] ) {

		var begin = playlistStartRe.exec( url ),
			end = playlistEndRe.exec( url ),
			stream = playlistStreamRe.exec( url );

		if (!begin || !begin[1] ||
			!end || !end[1] ||
			!stream || !stream[1] ) {
				logger.warn('missing data from request ' + url);
				return null;
			}

		return {
			type:      'playlist',
			start:     begin[1],
			end:       end[1],
			camId:     playlistMatch[1],
			streamId:  stream[1],
			url:       url
		};
		
	 } else if ( segmentMatch && segmentMatch[1] && segmentMatch[2] && segmentMatch[3] ) {
		
		 return {
			 type:      'segment',
			 camId:     segmentMatch[1],
			 streamId:  segmentMatch[2],
			 segment:   segmentMatch[3],
			 url: url
		 };
	 } else {
		 return null;
	 }
  }

  loadInternal() {

	  // var wrtc = new WRTCRequest( dataChannel );
	  var req = this.parseURL();

	  var self = this;

		if (req && req.type == 'playlist') {
			console.log('getting playlist');
			WrtcLoader.wrtc.getPlaylist({
				format:    'hls',
				container: 'ts',
				camID:     req.camId,
				streamID:  req.streamId,
				start:     req.start,
				end:       req.end
			}, function(err, d) {
				d = d || '';
				d = d.replace(/([\w-]+\/)ts/g, 'ts');

				var status = 200;

				if (err) {
					status = 501;
					d = '';
				}

				var r = {
					status: status,
				target: {
					responseText: d,
					responseURL: self.url
				},
				getResponseHeader: function(lastModified) {
					return Date.now();
				},
				byteLength: d.length,
				currentTarget: {
					status: status,
					response: d,
					responseText: d,
					getResponseHeader: function(lastModified) {
						return Date.now();
					}
				}
				};
				self.loadend( r );
			});
			return;
		} else if (req && req.type == 'segment') {

			this.request_id = WrtcLoader.wrtc.getSegment({
				camID:     req.camId,
				streamID:  req.streamId,
				start:     req.start,
				segment:   req.segment,
			}, function(err, d) {

				if (err == 'timeout') {
					console.error('timeout');
					if (self.timeout) { self.timeout(); }
					return;
				}
				var status = 200;
				//console.log(d);
				if (!d || err) { 
					console.error(err); 
					d = '';
					status = 501;
				}
				var r = {
					status: status,
					target: {
					responseText: d,
					responseURL: self.url
				},
				getResponseHeader: function(lastModified) {
					return Date.now();
				},
				byteLength: d.length,
				currentTarget: {
					status: status,
					response: d,
					responseText: d,
					getResponseHeader: function(lastModified) {
						return Date.now();
					}
				}
				};
				self.loadend( r );
				return;
			});
		} else {
			debugger;
		}
		return;

	  var xhr;

	  if (typeof XDomainRequest !== 'undefined') {
		  xhr = this.loader = new XDomainRequest();
	  } else {
		  xhr = this.loader = new XMLHttpRequest();
	  }

	  // TODO: parse url and decide which request to make ( playlist / segment )

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

  loadend(event) {

    var xhr = event.currentTarget,
        status = xhr.status,
        stats = this.stats;
	// debugger;
    // don't proceed if xhr has been aborted
    if (!stats.aborted) {
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300)  {
          window.clearTimeout(this.timeoutHandle);
          stats.tload = performance.now();
          this.onSuccess(event, stats);
      } else {
		  console.log('stats.aborted; retry: ' + stats.retry);
        // error ...
        if (stats.retry < this.maxRetry) {
          logger.warn(`${status} while loading ${this.url}, retrying in ${this.retryDelay}...`);
          this.destroy();
          window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
          // exponential backoff
          this.retryDelay = Math.min(2 * this.retryDelay, 64000);
          stats.retry++;
        } else {
          window.clearTimeout(this.timeoutHandle);
          logger.error(`${status} while loading ${this.url}` );
          this.onError(event);
        }
      }
    }
  }

  loadtimeout(event) {
    logger.warn(`timeout while loading ${this.url}` );
    this.onTimeout(event, this.stats);
  }

  loadprogress(event) {
    var stats = this.stats;
    if (stats.tfirst === null) {
      stats.tfirst = performance.now();
    }
    stats.loaded = event.loaded;
    if (this.onProgress) {
      this.onProgress(event, stats);
    }
  }
}

export default WrtcLoader;


//////////
//////////


var WRTCRequest = function(dataChannel) {

	this.dataChannel = dataChannel;
	this.setupDataChannel();
	this.requests = {};
};


WRTCRequest.prototype.setupDataChannel = function() {

	console.log('== setup data channel ==');
	var self = this;

    this.dataChannel.onmessage = function (e) {
		var data;
		data = msgpack.decode( e.data );

		var req = self.requests[ data.request_id ];

		if(req) { req.order = isNaN(req.order) ? 0 : ++req.order; }

		if( !req ) {
			// console.error('got a response without a matching request ' + data.request_id);
			// console.error(data);
			// console.log(self.requests);
		} else if (req.order != data.order && data.request != 'cancel') {
			req.ack = true;
			console.error('order doesnt match with expected value; expected / received: ' + req.order + '/' + data.order);
			console.log(data);
			req.cb( 'missing data' );
		} else if (req.cancelled) {
			// console.log('request ' + data.request_id + ' is cancelled');
		} else if (req.cb) {
			req.ack = true;
			req.cb( data.error, data );
		}
    };
};


WRTCRequest.prototype.request = function( req, cb ) {
	req.request_id = req.request_id || Date.now() + '_' + Math.random();

	if (this.dataChannel.bufferedAmount > 0) console.log('buffered amount: ' + this.dataChannel.bufferedAmount);

	var self = this;

	this.requests[ req.request_id ] = {
		req:  req,
		cb:   cb
	};

	this.dataChannel.send( JSON.stringify(req) );

	req.timeout = setTimeout( function() {
		var r = self.requests[req.request_id];
		if (!r || r.ack) return;
		delete self.requests[req.request_id];
		if (r.cb) r.cb( 'timeout' );
		//console.error('request timed out');
		//console.error(r.req);
	}, 10000);

	return {
		id: req.request_id,
		done: function() {
			console.info('deleting request ' + req.message + ' ' + req.request_id);
			delete self.requests[ req.request_id ];
		}
	};
};


/////
// webrtc api
WRTCRequest.prototype.getSnapshot = function( req, cb ) {

	cb = cb || function() {};

	var blob = null;

	var r = this.request({
		message: 'snapshot',
		payload: {
			camId:      req.camID,
			time:       req.time,
			precision:  req.precision || 0
		}
	}, function(err, d) {

		if(err) {
			console.error(err);
			cb( err, null );
			r.done();
			return;
		}

		if (d.end) {
			var img = new Image();
			img.src = 'data:image/jpeg;base64,' + _arrayBufferToBase64(blob);
			r.done();
			cb( err, img );
			return;
		} else {
			if (!blob) { blob = d.payload; }
			else { blob = _appendBuffer(blob, d.payload); }
		}
	});
};

var _appendBuffer = function(buffer1, buffer2) {
	var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
	tmp.set(new Uint8Array(buffer1), 0);
	tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
	return tmp.buffer;
};

WRTCRequest.prototype.getSegment = function(req, cb) {

	cb = cb || function() {};

	var blob = null;

	var payload = {
		start:      req.start,
		filename:   req.segment,
		cam_id:     req.camID,
		stream_id:  req.streamID
	};

	// payload = _.pick(payload, _.identity);
	//
	var r = this.request({
		message: 'get-segment',
		payload: payload
	}, function(err, d) {

		if(err) {
			cb( err, null );
			r.done();
			return;
		} else if (!d.end) {
			if (!blob) { blob = d.payload; }
			else { blob = _appendBuffer(blob, d.payload); }
		} else {
			cb(null, blob);
		}
	});

	return r.id;
};


WRTCRequest.prototype.getLivestream = function( req, cb ) {

 	cb = cb || function() {};

	var payload = {
		cam_id:     req.camID,
		stream_id:  req.streamID
	};

	payload = _.pick(payload, _.identity);

	var r = this.request({
		message: 'get-livestream',
		payload: payload
	}, function(err, d) {

		if(err) {
			cb( err, null );
			r.done();
			return;
		}

		cb(null, d);
	});
};


WRTCRequest.prototype.getCameras = function( cb ) {

 	cb = cb || function() {};

	var r = this.request({
		message:  'list-cameras'
	}, function(err, d) {

		if(err) {
			cb( err, null );
			r.done();
			return;
		}

		cb( null, d.payload );
	});
};


WRTCRequest.prototype.getThumb = function( req, cb ) {

 	cb = cb || function() {};

	var payload = {
		camId:  req.camID,
		thumb:  req.thumb
	};

	payload = _.pick(payload, _.identity);

	var r = this.request({
		message:  'thumbnail',
		payload:  payload
	}, function(err, d) {

		if(err) {
			cb( err, null );
			r.done();
			return;
		}

		var img = new Image();
		var blob = d.payload;

		img.src = 'data:image/jpeg;base64,' +
				_arrayBufferToBase64( blob );

		r.done();
		cb( err, img );

		return;
	});
};


WRTCRequest.prototype.getMultipleThumbs = function( req, cb ) {

 	cb = cb || function() {};

	var payload = {
		camId:     req.camID,
		streamId:  req.streamID,
		thumbs:    req.thumbs
	};

	payload = _.pick(payload, _.identity);

	var nThumbs = payload.thumbs ? payload.thumbs.length : 0;

	var r = this.request({
		message:  'multiple-thumbnails',
		payload:  payload
	}, function(err, d) {

		var done = nThumbs == 0;

		if(err) {
			cb( err, null, done );
			if ( done ) { r.done(); }
			return;
		}

		var img = new Image();
		var blob = d.payload;

		img.src = 'data:image/jpeg;base64,' +
				_arrayBufferToBase64( blob );

		cb( err, img, done );

		if ( done ) { r.done(); }
	});
};


WRTCRequest.prototype.doCheckin = function( cb ) {

	cb = cb || function() {};

	//TODO: extend webrtc API for checkin to accept json format as well
	var r = this.request({
		message:  'checkin'
	}, function(err, d) {

		if(err) {
			cb( err, null );
			r.done();
			return;
		}

		console.log('checkin');
		cb( null, d.payload );
	});
};


WRTCRequest.prototype.getMotion = function( req, cb ) {

	cb = cb || function() {};

	var buffer = "";

	var payload = {
		cam_id:     req.camID,
		start:      req.start,
		end:        req.end
	};

	console.log( payload );

	payload = _.pick(payload, _.identity);

	var r = this.request({
		message:  'get-motion',
		payload:  payload
	}, function(err, d) {

		if(err) {
			cb( err, null );
			r.done();
			return;
		}

		if (d.end) {
			var motion,
				err;

			try {
				motion = JSON.parse( buffer );
			} catch( e ) {
				err = e;
			}
			r.done();
			cb( err, motion );
			return;
		} else {
			buffer += d.payload;
		}
	});
};

WRTCRequest.prototype.cancelRequest = function( payload, cb ) {

	cb = cb || function() {};

	var r = this.requests[ payload.request_id ];

	if (r) {
		// console.log(r.req.timeout);
		// console.log('clearing request ' + payload.request_id + ' timeout ' + r.req.timeout);
		clearTimeout( r.req.timeout );
		r.cancelled = true;
	}

	// console.log('cancel request ' + payload.request_id);
	this.request({
		message:  'cancel',
		payload:  {
			request_id: payload.request_id
		}
	}, function(err, d) {
		cb( err, d );
	});
};

WRTCRequest.prototype.getPlaylist = function( req, cb ) {

	cb = cb || function() {};

	var buffer = "";

	var payload = {
		format:     req.format || 'json',
		container:  req.container || 'ts',
		cam_id:     req.camID,
		stream_id:  req.streamID,
		start:      req.start,
		end:        req.end
	};

	// payload = _.pick(payload, _.identity);

	console.log(payload);

	var r = this.request({
		message:  'get-playlist',
		payload:  payload
	}, function(err, d) {

		if(err) {
			cb( err, null );
			r.done();
			return;
		}

		if (d.end) {
			cb( err, buffer);
			return;
		} else {
			buffer += d.payload;
		}
	});
};

//
//
//


