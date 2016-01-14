'use strict';

/**
 * Module dependencies.
 */

var crypto = require('crypto');
var integration = require('segmentio-integration');
var url = require('url');
var Batch = require('batch');
var LRU = require('lru-cache');
var ms = require('ms');

/**
 * Expose `Webhooks`
 */

var Webhooks = module.exports = integration('Webhooks')
  .channels(['server', 'mobile', 'client'])
  .timeout('3s')
  .retries(1);

/**
 * Add an in-memory cache for now
 */

Webhooks.prototype.initialize = function(){
  this.cache = new LRU({
    max: 10000,
    maxAge: ms('3m')
  });
};

/**
 * Expose our methods
 */

Webhooks.prototype.identify = request;
Webhooks.prototype.alias = request;
Webhooks.prototype.group = request;
Webhooks.prototype.track = request;
Webhooks.prototype.page = request;
Webhooks.prototype.screen = request;

/**
 * Return whether the url is over or under limit
 */

Webhooks.prototype.allowed = function(url){
  var errors = this.cache.peek(url);
  return !errors || (errors < 25);
}

/**
 * Request.
 *
 * @param {Facade} message
 * @param {Function} fn
 * @api private
 */

function request(message, done){
  var body = JSON.stringify(message.json());
  var sharedSecret = this.settings.sharedSecret;
  var digest;
  var self = this;
  var cache = this.cache;

  if (typeof sharedSecret === 'string' && sharedSecret.length) {
    digest = crypto
      .createHmac('sha1', sharedSecret)
      .update(body, 'utf8')
      .digest('hex');
  }

  var batch = new Batch();
  batch.throws(false);

  var hooks = self.settings.hooks.slice(0, 5);

  var validHooks = hooks
    .filter(isUrl)
    .filter(this.allowed.bind(this))

  if (validHooks.length === 0) {
    return done();
  }

  var errors = [];
  var results = [];

  validHooks.forEach(function(hook, i){
    batch.push(function(done){
      var req = self
        .post(hook)
        .type('json')
        .send(body)
        .parse(ignore);

      if (digest) req.set('X-Signature', digest);

      req.end(self.handle(function(err, res){
        if (err) {
          var errCount = cache.peek(hook);
          errCount = errCount + 1 || 1;
          cache.set(hook, errCount);
        }
        errors[i] = err;
        results[i] = res;
        done();
      }));
    });
  });

  batch.end(function(){
    var realErrors = errors.filter(function(error){
      return error;
    });
    // Only fail if all the webhooks were down.
    if (realErrors.length === validHooks.length) {
      var error = new Error('Batch failed');
      error.errors = realErrors;
      return done(error, results);
    }
    done(null, results);
  });
}

/**
 * Check if the given `value` is a valid url.
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function isUrl(value){
  var parsed = url.parse(String(value));
  return parsed.protocol && parsed.host;
}

/**
 * Ignore is a superagent parser (which segmentio-integration
 * uses under the hood) to just completely ignore the response
 * from the webhook request. This is ideal because we can't
 * rely on content-type header for parsing and more importantly we
 * don't really want to parse an unbound amount of data that
 * the request could respond with.
 */

function ignore(res, fn){
  res.text = '';
  res.on('data', function(){});
  res.on('end', fn);
}
