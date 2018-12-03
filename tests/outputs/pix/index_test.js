const { expect, sinon } = require('../../../test-helper');
const Hapi = require('hapi');
const AnswerController = require('../../../../lib/application/answers/answer-controller');

describe('Unit | Router | answer-router', function() {
  let server;

  beforeEach(function() {
    server = Hapi.server();
    return server.register(require('../../../../lib/application/answers'));
  });

  describe('POST /api/answers', function() {

    before(function() {
      sinon.stub(AnswerController, 'save').callsFake((request, h) => h.response('ok'));
    });

    after(function() {
      AnswerController.save.restore();
    });

    it('should exist', async function() {
      const res = await server.inject({ method: 'POST', url: '/api/answers' });
      expect(res.statusCode).to.equal(200);
    });

    it('should exist', async () => {
      const res = await server.inject({ method: 'POST', url: '/api/answers' });
      expect(res.statusCode).to.equal(200);
    });
  });
});
