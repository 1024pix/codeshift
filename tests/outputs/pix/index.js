const answerController = require('./answer-controller');

exports.register = async function(server, options) {
  server.route([
    {
      method: 'POST',
      path: '/api/answers',
      config: {
        auth: false,
        handler: answerController.save,
        tags: ['api']
      }
    },
    {
      method: 'GET',
      path: '/api/answers/{id}',
      config: {
        auth: false,
        handler: answerController.get,
        tags: ['api']
      }
    },
    {
      method: 'PATCH',
      path: '/api/answers/{id}',
      config: {
        auth: false,
        handler: answerController.update,
        tags: ['api']
      }
    },
    {
      method: 'GET',
      path: '/api/answers',
      config: {
        auth: false,
        handler: answerController.findByChallengeAndAssessment,
        tags: ['api']
      }
    }
  ]);
};

exports.name = 'answers-api';
