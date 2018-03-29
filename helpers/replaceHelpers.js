// contains helpers that assist with transforming sub-trees into other sub-trees

const codeshift = require('jscodeshift');

// replace a callback function with await notation:
// eg func1(done) { myFunc(1234, done); } ----> await myFunc(1234);
function replaceCallbackWithAwait(pathway) {
  const newArgs = [];
  const func = pathway.value ? pathway.value : pathway;
  func.arguments.forEach((arg, index) => {
    if (index < func.arguments.length - 1) {
      newArgs.push(arg);
    }
  });
  const methodName = func.callee.type === 'MemberExpression' ? func.callee.property.name : func.callee.name;
  const call = codeshift.callExpression(codeshift.identifier(methodName), newArgs);
  if (func.callee) {
    call.callee = func.callee;
  }
  return codeshift.awaitExpression(call);
}

// assign a variable to a callback function with await notation
// eg func1(done) { myFunc(1234, done); } ----> const func1 = await myFunc(1234);
function replaceCallbackWithAssignment(pathway, varType, varName) {
  const awaitExpr = replaceCallbackWithAwait(pathway);
  const varAssign = codeshift.variableDeclaration(
    varType,
    [codeshift.variableDeclarator(codeshift.identifier(varName), awaitExpr)]
  );
  return varAssign;
}

// export everything:
module.exports = {
  replaceCallbackWithAwait,
  replaceCallbackWithAssignment
};
