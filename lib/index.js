
/**
 * Module dependencies.
 */

var integration = require('segmentio-integration');
var url = require('url');

/**
 * Expose `Webhooks`
 */

var Webhooks = module.exports = integration('Webhooks')
  .channels(['server', 'mobile', 'client'])
  .timeout('3s');

/**
 * Ensure `globalHook` is a url.
 */

Webhooks.ensure(function(_, settings){
  if (isUrl(settings.globalHook)) return;
  return this.invalid('"globalHook" must be a valid url, got "%s"', settings.globalHook);
});

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
 * Request.
 *
 * TODO: remove context / options normalization.
 *
 * @param {Facade} message
 * @param {Function} fn
 * @api private
 */

function request(message, fn){
  var json = message.json();
  json.options = json.options || json.context;
  return this
  .post(this.settings.globalHook)
  .type('json')
  .send(json)
  .end(this.handle(fn));
}

/**
 * Check if the given `value` is a valid url.
 *
 * TODO: this should be checked when the integration is saved.
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function isUrl(value){
  var parsed = url.parse(String(value));
  return parsed.protocol && parsed.host;
}
