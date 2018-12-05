const { sinon, expect } = require('../../../test-helper');

const Boom = require('boom');
const JSONAPIError = require('jsonapi-serializer').Error;

const assessmentResultController = require('../../../../lib/application/assessment-results/assessment-result-controller');
const assessmentResultService = require('../../../../lib/domain/services/assessment-result-service');

const { AlreadyRatedAssessmentError, NotFoundError } = require('../../../../lib/domain/errors');
const AssessmentResult = require('../../../../lib/domain/models/AssessmentResult');
const CompetenceMark = require('../../../../lib/domain/models/CompetenceMark');
const usecases = require('../../../../lib/domain/usecases');

const logger = require('../../../../lib/infrastructure/logger');

describe('Unit | Controller | assessment-results', () => {

  describe('#evaluate', () => {

    let sandbox;
    let replyStub;

    const request = {
      payload: {
        data: {
          attributes: {
            'estimated-level': null,
            'pix-score': null
          },
          relationships: {
            assessment: {
              data: {
                type: 'assessments',
                id: '22'
              }
            }
          },
          type: 'assessment-results'
        }
      }
    };

    beforeEach(() => {
      sandbox = sinon.sandbox.create();

      replyStub = sinon.stub().returns({ code: sinon.stub() });
      sandbox.stub(usecases, 'createAssessmentResultForCompletedCertification').resolves();
      sandbox.stub(Boom, 'notFound').returns({ message: 'NotFoundError' });
      sandbox.stub(Boom, 'badImplementation').returns({ message: 'badImplementation' });
      sandbox.stub(logger, 'error');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should evaluate the assessment', () => {
      // when
      assessmentResultController.evaluate(request, {
        response: replyStub
      });

      // then
      expect(usecases.createAssessmentResultForCompletedCertification).to.have.been.calledWith({
        assessmentId: '22',
        forceRecomputeResult: false,
      });
    });
  });
});
