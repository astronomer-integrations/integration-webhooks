'use strict';

var Test = require('segmentio-integration-tester');
var Webhooks = require('..');
var assert = require('assert');
var crypto = require('crypto');
var express = require('express');
var Batch = require('batch');

describe('Webhooks', function(){
  var types = ['track', 'identify', 'alias', 'group', 'page', 'screen'];
  var webhooks;
  var settings;
  var server;
  var test;
  var app;

  before(function(done){
    app = express();
    app.use(express.bodyParser());
    server = app.listen(4000, done);
  });

  after(function(done){
    server.close(done);
  });

  beforeEach(function(){
    settings = {
      hooks: [{
        key: 'http://localhost:4000',
        value: {
          hook: 'http://localhost:4000',
          headers: [{
            key: 'X-wheels',
            value: 'value'
          }]
        }
      }]
    };
    webhooks = new Webhooks(settings);
    Webhooks._reset();
    test = Test(webhooks, __dirname);
  });

  it('should have the correct settings', function(){
    test
    .name('Webhooks')
    .channels(['server', 'mobile', 'client'])
    .timeout('3s')
    .retries(1);
  });

  types.forEach(function(type){
    describe('#' + type, function(){
      var json;

      beforeEach(function(){
        json = test.fixture(type + '-basic');
      });

      it('should succeed on valid call', function(done){
        var route = '/' + type + '/success';
        settings.hooks = settings.hooks.map(function(hook){
           hook.value.hook += route;
           return hook;
        });

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should set any headers', function(done){
        var route = '/' + type + '/success';
        settings.hooks = settings.hooks.map(function(hook){
           hook.value.hook += route;
           return hook;
        });

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          assert.equal(
            settings.hooks[0].value.headers['X-wheels'],
            req.headers['X-wheels']
          );
          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should not throw when `.hooks` is a string', function(done){
        var route = '/' + type + '/success';
        settings.hooks = 'http://localhost:4000' + route;

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should not throw when `.hooks$value.headers` is an object', function(done){
        var route = '/' + type + '/success';
        settings.hooks = [{
          key: route,
          value: {
            hook: route,
            headers: {}
          }
        }];

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should not throw when `.hooks` is an array of strings', function(done){
        var route = '/' + type + '/success';
        settings.hooks[0] = 'http://localhost:4000' + route;

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should send to multiple webhooks', function(done){
        var path1 = '/' + type + '/success';
        var path2 = '/' + type + '/error';

        var route1 = 'http://localhost:4000' + path1;
        var route2 = 'http://localhost:4000' + path2;

        // route1 is explicitly twice to test when there is a bad webhook.
        settings.hooks = [{
          key: route1,
          value: {
            hook: route1,
            headers: []
          }
        }, {
          key: route2,
          value: {
            hook: route2,
            headers: []
          }
        }, {
          key: route1,
          value: {
            hook: route1,
            headers: []
          }
        }];

        app.post(path1, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });
        app.post(path2, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(503);
        });

        test
          .set(settings)
          .requests(3)
          [type](json.input);

        test
          .request(0)
          .expects(200);

        test
          .request(1)
          .expects(503);

        test
          .request(2)
          .expects(200);

        test.end(done);
      });

      it('should work for multiple webhooks when missing headers subfield', function(done){
        var path1 = '/' + type + '/success';
        var path2 = '/' + type + '/error';

        var route1 = 'http://localhost:4000' + path1;
        var route2 = 'http://localhost:4000' + path2;

        // route1 is explicitly twice to test when there is a bad webhook.
        settings.hooks = [{
          key: route1,
          value: {
            hook: route1,
            headers: []
          }
        }, {
          key: route2,
          value: {
            hook: route2,

          }
        }, {
          key: route1,
          value: {
            hook: route1,

          }
        }];

        app.post(path1, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });
        app.post(path2, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(503);
        });

        test
          .set(settings)
          .requests(3)
          [type](json.input);

        test
          .request(0)
          .expects(200);

        test
          .request(1)
          .expects(503);

        test
          .request(2)
          .expects(200);

        test.end(done);
      });

      it('should only send to 5 webhooks', function(done){
        var path = '/' + type + '/success';
        var route = 'http://localhost:4000' + path;

        settings.hooks = [{
          key: route,
          value: {
            hook: route,
            headers: []
          }
        }, {
          key: route,
          value: {
            hook: route,
            headers: []
          }
        }, {
          key: route,
          value: {
            hook: route,
            headers: []
          }
        },{
          key: route,
          value: {
            hook: route,
            headers: []
          }
        }, {
          key: route,
          value: {
            hook: route,
            headers: []
          }
        }, {
          key: route,
          value: {
            hook: route,
            headers: []
          }
        }];

        app.post(path, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          .requests(5)
          [type](json.input);

        test.end(done);
      });

      it('should fail when all webhooks are down', function(done){
        var path1 = '/' + type + '/down'; // not mounted
        var path2 = '/' + type + '/error';

        var route1 = 'http://localhost:4000' + path1;
        var route2 = 'http://localhost:4000' + path2;

        settings.hooks = [{
          key: route1,
          value: {
            hook: route1,
            headers: []
          }
        }, {
          key: route2,
          value: {
            hook: route2,
            headers: []
          }
        }];

        app.post(path2, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(503);
        });

        test
          .set(settings)
          .requests(2)
          [type](json.input);

        test
          .request(0)
          .expects(404);

        test
          .request(1)
          .expects(503);

        test.error(done);
      });

      it('should error on invalid calls', function(done){
        var route = '/' + type + '/error';
        settings.hooks = settings.hooks.map(function(hook){
           hook.value.hook += route;
           return hook;
        });

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(503);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(503)
          .error(done);
      });

      it('should ignore bad reply', function(done){
        var route = '/bad';
        settings.hooks = settings.hooks.map(function(hook){
           hook.value.hook += route;
           return hook;
        });

        app.post(route, function(req, res){
          res.set('Content-Type', 'application/json');
          res.send(200, 'I lied, this is not JSON');
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should attach an HMAC digest when options.sharedSecret is present', function(done){
        var route = '/' + type;
        settings.hooks = settings.hooks.map(function(hook){
           hook.value.hook += route;
           return hook;
        });
        settings.sharedSecret = 'teehee';

        app.post(route, function(req, res){
          var signature = req.headers['x-signature'];
          var digest = crypto
            .createHmac('sha1', settings.sharedSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

          assert(signature);
          assert(signature === digest);

          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should rate limit bad urls', function(done) {
        var success = settings.hooks[0];
        var failed = {
          key: 'http://localhost:4000/no',
          value: {
            hook: 'http://localhost:4000/no',
            headers: []
          }
        }
        settings.hooks.push(failed);

        app.post('/', function(req, res) { res.send(200) });
        app.post('/no', function(req, res) { res.send(503) });

        var batch = new Batch()
          .concurrency(1);

        for (var i = 0; i < 50; i++) {
          batch.push(function(done){
            test
              .set(settings)
              [type](json.input)
              .end(done);
          });
        }

        batch.end(function(err, results){
          // it should not limit the successful endpoint
          assert(webhooks.allowed(success))
          // it should imit the failed endpoint
          assert(!webhooks.allowed(failed));
          done();
        });
      });
    });
  });
});
