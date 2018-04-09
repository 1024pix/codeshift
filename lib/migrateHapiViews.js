// takes in the hapi-views options and updates it
module.exports = (yaml) => {
  // 'views' -> 'routes':
  yaml.routes = yaml.views;
  delete yaml.views;
  Object.keys(yaml.routes).forEach(route => {
    const routeInfo = yaml.routes[route];
    if (!routeInfo.data) {
      routeInfo.data = {};
    }
    // update 'api' fields and merge them in:
    routeInfo.data.api = {};
    if (routeInfo.api) {
      Object.keys(routeInfo.api).forEach(apiEntry => {
        routeInfo.data.api[apiEntry] = `api(${routeInfo.api[apiEntry]})`;
      });
    }
    delete routeInfo.api;
  });
  return yaml;
};
