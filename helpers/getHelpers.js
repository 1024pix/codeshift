// contains helpers to assist with extracting different types of information from individual nodes

// helper to always get the name of a function definition or function call:
function getFunctionNameFromFunctionExpression(functionExpression) {
  if (functionExpression.type === 'ArrowFunctionExpression') {
    return '';
  }
  // object definition form, eg ' { func1(...) { ....} }'
  if (functionExpression.type === 'Property') {
    return functionExpression.key.name;
  }
  // simple call form, eg 'func1(....);':
  if (functionExpression.name) {
    return functionExpression.name;
  }
  // todo: handle function definition form eg ' function func1(...) { .... }'
  // property call form, eg 'caller.func1(...)':
  return functionExpression.callee.type === 'MemberExpression' ? functionExpression.callee.property.name : functionExpression.callee.name;
}

// helper to always get the last argument of a function definition or call
// if the last arg is a callback then rules will want to promisify them
function getLastArgumentFromFunction(functionExpression) {
  const func = functionExpression.value ? functionExpression.value : functionExpression;
  // if it's a function declaration it has params:
  if (func.params) {
    if (func.params.length === 0) {
      return {};
    }
    return func.params[func.params.length - 1];
  }
  // if it's a function call it has arguments:
  if (func.arguments.length === 0) {
    return {};
  }
  return func.arguments[func.arguments.length - 1];
}

// export everything:
module.exports = {
  getFunctionNameFromFunctionExpression,
  getLastArgumentFromFunction,
  CallbackNames: ['done', 'allDone', 'callback', 'cb'],
  ErrorNames: ['err', 'exc', 'error']
};
