
exports.create = {
  method: 'POST',
  config: {
    tags: ['api'],
    auth: 'api',
    validate: {
      payload: Joi.object({
        name: Joi.string().required(),
        type: Joi.string().default('yaml').allow(['yaml', 'markdown', 'json', 'collection']),
        contentRaw: Joi.string().required().allow(''),
        previewURL: Joi.string().optional(),
        hooks: Joi.array().items(Joi.object({ url: Joi.string().uri(), status: Joi.string().optional() })).default([]),
        tags: Joi.array().default([]),
        projectSlug: Joi.string().required(),
        parentPageSlug: Joi.string().optional(),
        templateId: Joi.string().optional()
      })
    }
  },
  handler: {
    autoInject: {
      user(request, done) {
        done(null, request.auth.credentials);
      },
      org(request, done) {
        done(null, request.organization);
      },
      ObjectID(server, done) {
        done(null, server.plugins['hapi-mongodb'].ObjectID);
      },
      project(request, server, ObjectID, org, done) {
        server.db.projects.findOne({ slug: request.payload.projectSlug, organization: org._id }, done);
      },
      template(request, server, ObjectID, done) {
        if (!request.payload.templateId) {
          return done();
        }
        server.db.templates.findOne({ _id: new ObjectID(request.payload.templateId) }, (err, template) => {
          /* $lab:coverage:off$ */
          if (err) {
            return done(err);
          }
          /* $lab:coverage:on$ */
          if (!template) {
            return done(boom.badRequest(`template ${request.payload.templateId} does not exist`));
          }
          return done(null, template);
        });
      },
      // parentPage(request, server, org, ObjectID, done) {
      //   if (!request.payload.parentPageSlug) {
      //     return done();
      //   }
      //   server.db.pages.findOne({ slug: request.payload.parentPageSlug, organization: org._id }, { _id: 1, slug: 1, type: 1 }, (err, page) => {
      //     /* $lab:coverage:off$ */
      //     if (err) {
      //       return done(err);
      //     }
      //     /* $lab:coverage:on$ */
      //     if (!page) {
      //       return done(boom.notFound('invalid parentPageSlug'));
      //     }
      //     if (page.type !== 'collection') {
      //       return done(boom.badRequest('You can only create a page with a parent page if the type of the parent is "collection"'));
      //     }
      //     done(null, page);
      //   });
      // },
      // reply(done) {
      //   done(null, 'hi');
      // }
      // reply(event, create, version, done) {
      //   const newPage = create.ops[0];
      //   if (version) {
      //     newPage.latestVersionId = version._id;
      //   }
      //   done(null, create.ops[0]);
      // }
    }
  }
};
