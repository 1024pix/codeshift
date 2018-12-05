const { expect, sinon } = require('../../../test-helper');
const Hapi = require('hapi');
const AnswerController = require('../../../../lib/application/answers/answer-controller');

describe('Unit | Router | answer-router', function() {

  let server;

  beforeEach(function() {
    server = new Hapi.      Server();
    server.connection({ port: null });
    server.register({ register: require('../../../../lib/application/answers') });
  });

  function expectRouteToExist(routeOptions, done) {
    server.inject(routeOptions, (res) => {
      expect(res.statusCode).to.equal(200);
      done();
    });
  }

  describe('POST /api/answers', function() {

    before(function() {
      sinon.stub(AnswerController, 'save').callsFake((request, reply) => reply('ok'));
    });

    after(function() {
      AnswerController.save.restore();
    });

    it('should exist', function(done) {
      expectRouteToExist({ method: 'POST', url: '/api/answers' }, done);
    });

    it('should exist', (done) => {
      expectRouteToExist({ method: 'POST', url: '/api/answers' }, done);
    });

    it('should exist', (done) => {
      return server.inject({ method: 'POST', url: '/api/snapshots' }, (res) => {
        expect(res.statusCode).to.equal(200);
        done();
      });
    });

  });

});
