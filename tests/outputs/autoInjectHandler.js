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
  handler: async (request, h) => {
    const response = h.response();
    const settings = request.server.settings.app;
    const server = request.server;
    const user = request.auth.credentials;
    const org = request.organization;
    const ObjectID = server.plugins['hapi-mongodb'].ObjectID;
    const project = await server.db.projects.findOne({ slug: request.payload.projectSlug, organization: org._id });
  }
};
