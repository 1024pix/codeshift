const { sinon, expect } = require('../../../test-helper');
const assessmentController = require('../../../../lib/application/assessments/assessment-controller');

describe('Unit | Controller | assessment-results', () => {

  describe('#evaluate', () => {
    const reply = sinon.spy();

    const request = { };

    it('should evaluate the assessment', () => {
      assessmentController.evaluate(request, {
        response: reply
      });
    });
  });
});
