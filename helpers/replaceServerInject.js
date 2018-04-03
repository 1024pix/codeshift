const codeshift = require('jscodeshift');

module.exports = function replaceServerInject(p) {
  // get name:
  const param = p.value.arguments[1].params[0].name;
  const call = codeshift.callExpression(codeshift.identifier('inject'), [p.value.arguments[0]]);
  //todo: make 'server' work for server2, testServer, etc
  call.callee = codeshift.memberExpression(codeshift.identifier('server'), codeshift.identifier('inject'));
  const awaitExpr = codeshift.awaitExpression(call);
  const response = codeshift.variableDeclaration(
    'const',
    [codeshift.variableDeclarator(codeshift.identifier(param), awaitExpr)]
  );
  // get the body of the inject callback and put it back after the await expr:
  const callback = p.value.arguments[1];
  const oldBody = callback.body;
  p.parentPath.replace(response);
  oldBody.body.reverse();
  oldBody.body.forEach(expr => {
    p.parentPath.insertAfter(expr);
  });
};
