
var transform = require('segmentio-transform-legacy');
var Test = require('segmentio-integration-tester');
var express = require('express');
var Webhooks = require('..');

describe('Webhooks', function(){
  var types = ['track', 'identify', 'alias', 'group', 'page', 'screen'];
  var webhooks;
  var settings;
  var server;
  var app;

  before(function(done){
    app = express();
    app.use(express.bodyParser());
    server = app.listen(4000, done);
  })

  after(function(done){
    server.close(done);
  })

  beforeEach(function(){
    settings = { globalHook: 'http://localhost:4000' };
    webhooks = new Webhooks(settings);
    test = Test(webhooks, __dirname);
  });

  it('should have the correct settings', function(){
    test
      .name('Webhooks')
      .channels(['server', 'mobile', 'client'])
      .timeout('3s');
  });

  describe('.validate()', function(){
    it('should be invalid if .globalHook isnt a url', function(){
      test.invalid({}, { globalHook: true });
      test.invalid({}, { globalHook: '' });
      test.invalid({}, { globalHook: 'aaa' });
    });

    it('should be valid if globalHook is a url', function(){
      test.valid({}, settings);
    });
  });

  types.forEach(function(type){
    describe('.' + type + '()', function(){
      var json;

      beforeEach(function(){
        json = test.fixture(type + '-basic');
      });

      it('should succeed on valid call', function(done){
        var route = '/' + type + '/success';
        settings.globalHook += route;

        app.post(route, function(req, res){
          json.input.options = json.input.context;
          json.input = transform(json.input);
          serialized(req.body).should.eql(serialized(json.input));
          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should error on invalid calls', function(done){
        var route = '/' + type + '/error';
        settings.globalHook += route;

        app.post(route, function(req, res){
          json.input.options = json.input.context;
          json.input = transform(json.input);
          serialized(req.body).should.eql(serialized(json.input));
          res.send(503);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(503)
          .error(done);
      });

      // TODO: test limit
    })
  });

});

function serialized (obj) {
  return JSON.parse(JSON.stringify(obj));
}
