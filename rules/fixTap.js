const codeshift = require('jscodeshift');

module.exports = {
  fix: (ast) => {
    ast.find(codeshift.VariableDeclaration)
      .filter(pathway => pathway.value.declarations[0].id.name === 'notEqual')
      .forEach(p => {
        p.replace();
      });
    ast.find(codeshift.VariableDeclaration)
      .filter(pathway => pathway.value.declarations[0].id.name === 'equal')
      .forEach(p => {
        const p1 = codeshift.property('init', codeshift.identifier('notEqual'), codeshift.identifier('notEqual'));
        p1.shorthand = true;
        const p2 = codeshift.property('init', codeshift.identifier('equal'), codeshift.identifier('equal'));
        p2.shorthand = true;
        const varAssign = codeshift.variableDeclaration(
          'const',
          [
            codeshift.variableDeclarator(
              codeshift.objectPattern([p1, p2]),
              codeshift.callExpression(
                codeshift.identifier('require'), [codeshift.literal('./equals.js')]
              )
          )]
        );
        p.replace(varAssign);
      });
  }
};
