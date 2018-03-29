const codeshift = require('jscodeshift');

// return a callback function transformed into await notation:
// eg func1(done) { myFunc(1234, done); } ----> await myFunc(1234);
module.exports = function replaceCallbackWithAwait(pathway) {
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
};
