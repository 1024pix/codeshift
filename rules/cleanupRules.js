const types = require('ast-types');
const codeshift = require('jscodeshift');

module.exports = {
  // strip variable declarations that are not used:
  stripUnused: (ast) => {
    ast.find(codeshift.VariableDeclaration)
    .forEach(p => {
      const varName = p.value.declarations[0].id.name;
      const match = ast.toSource().match(new RegExp(varName, 'g'));
      // if the only reference is the declaration, keep the declaration:
      if (match && match.length === 1) {
        return p.replace(p.value.declarations[0].init);
      }
      // otherwise if it is one of the special settings:
      if (match && ['settings', 'server'].includes(varName) && match.length === 2) {
        p.replace();
      }
    });
  }
};
