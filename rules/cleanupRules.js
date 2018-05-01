const types = require('ast-types');
const codeshift = require('jscodeshift');

module.exports = {
  // strip out anything that is 'await <literal>'
  stripUnusedAwaits: (ast) => {
    ast.find(codeshift.AwaitExpression)
    .forEach(p => {
      if (p.value.argument.type === 'Literal') {
        p.replace();
      }
    });
  },
  // strip variable declarations that are not used:
  stripUnused: (ast) => {
    ast.find(codeshift.VariableDeclaration)
    .forEach(p => {
      const varName = p.value.declarations[0].id.name;
      const match = ast.toSource().match(new RegExp(varName, 'g'));
      if (match && match.length === 1) {
        return p.replace(p.value.declarations[0].init);
      }
      // if the only reference is the declaration or on the same line,
      if (match && ['settings', 'server'].includes(varName) && match.length === 2) {
        p.replace();
      }
    });
  }
};
