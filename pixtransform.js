const pixRules = require('./rules/pixRules');
const codeshift = require('jscodeshift');

module.exports = function(fileInfo, api, options) {
  const ast = codeshift(fileInfo.source);
  Object.values(pixRules).forEach((rule) => {
    rule(ast);
  });
  return ast.toSource();
};
