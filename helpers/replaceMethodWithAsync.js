const {
  getLastArgumentFromFunction,
  CallbackNames
} = require('../helpers/getHelpers.js');

const replaceCallbacksInBody = require('../helpers/replaceCallbacksInBody.js');

// replace a class's method with an async version if needed
module.exports = function replaceCallbackWithAwait(pathway, useCallback) {
  const func = pathway.value ? pathway.value : pathway;
  // see if last param is a callback:
  const lastArg = getLastArgumentFromFunction(func);
  if (!lastArg || CallbackNames.includes(lastArg.name) === false) {
    return;
  }
  func.async = true;
  if (func.params) {
    func.params = func.params.slice(0, func.params.length - 1);
  }
  if (func.arguments) {
    func.arguments = func.arguments.slice(0, func.arguments.length - 1);
  }
  if (lastArg.type === 'Identifier') {
    replaceCallbacksInBody(func.body, lastArg.name);
  }
  // todo: handle when last arg is a function expression
};
