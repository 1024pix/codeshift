const types = require('ast-types');
const codeshift = require('jscodeshift');
const { getExpressionType } = require('../helpers/selectionHelpers');
module.exports = {
  // strip out anything that is 'await <literal>'
  stripUnusedAwaits: (ast) => {
    ast.find(codeshift.AwaitExpression)
    .forEach(p => {
      if (p.value.argument.type === 'Literal') {
        p.replace();
        return;
      }
      // if the member expression rightmost term is not a function don't 'await' it:
      if (p.value.argument.type === 'MemberExpression') {
        if (getExpressionType(p.value.argument) === 'Identifier') {
          p.replace(p.value.argument);
        }
      }
    });
  },
  // strip variable declarations that are not used:
  stripUnused: (ast) => {
    ast.find(codeshift.VariableDeclaration)
    .forEach(p => {
      try {
        const varName = p.value.declarations[0].id.name;
        // check if this is referenced anywhere else below:
        const res = ast.toSource({ quote: 'single' });
        const ast = codeshift(res);
        const match = res.match(new RegExp(varName, 'g'));
        if (match && match.length === 1) {
          return p.replace(p.value.declarations[0].init);
        }
        // if the only reference is the declaration or on the same line,
        if (match && ['settings', 'server'].includes(varName) && match.length === 2) {
          p.replace('');
        }
      } catch (e) {
      }
    });
  },
  // always return if last item in a block is a variable declaration or function call
  returnLastDeclaration: (ast) => {
    ast.find(codeshift.BlockStatement)
    .forEach(p => {
      const lastStatement = p.value.body[p.value.body.length - 1];
      if (lastStatement.type === 'ExpressionStatement' && lastStatement.expression) {
        if (lastStatement.expression.type === 'VariableDeclaration') {
          const varName = lastStatement.expression.declarations[0].id.name;
          p.value.body.push(`return ${varName};`);
          return;
        }
        if (lastStatement.expression.type === 'CallExpression') {
          p.value.body[p.value.body.length - 1] = codeshift.returnStatement(lastStatement.expression);
        }
      }
    });
  }
};
