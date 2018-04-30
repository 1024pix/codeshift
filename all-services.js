const async = require('async');

exports.allServices = {
  path: '/services/all',
  method: 'get',
  handler: {
    autoInject: {
      services(server, done) {
        done(null, server.methods.services.get());
      },
      serviceData(services, done) {
        async.mapValues(services, (service, serviceName, next) => {
          const data = service;

          data.serviceId = serviceName;

          next(null, data);
        }, done);
      },
      reply(serviceData, done) {
        const response = [];

        Object.keys(serviceData).forEach(serviceKey => {
          const service = serviceData[serviceKey];

          if (!service) {
            return;
          }

          response.push(service);
        });

        done(null, response);
      }
    }
  }
};
