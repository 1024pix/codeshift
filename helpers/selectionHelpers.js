// contains helpers to assist with selecting nodes of interest from a Collection of nodes

const { getFunctionNameFromFunctionExpression } = require('../helpers/getHelpers');
const { getLastArgumentFromFunction } = require('./getHelpers');
const types = require('ast-types');

// get a list of all function calls with the specified name or member expression beneath root:
function selectFunctionCalls(root, functionName) {
  const calls = [];
  types.visit(root, {
    visitCallExpression(func) {
      if (functionName === getFunctionNameFromFunctionExpression(func.value)) {
        calls.push(func);
      }
      return this.traverse(func);
    }
  });
  return calls;
}

// try to find functions that need to be promisified:
function isFunctionWithCallback(pathway, ast) {
  // if it's already an async call, let's leave it be:
  if (pathway.value.async) {
    return false;
  }
  // see if the last argument is an Identifier or Function Expression:
  const argCount = pathway.value.arguments.length;
  if (argCount === 0) {
    return false;
  }
  const callback = getLastArgumentFromFunction(pathway);
  // if it's a function then it's definitely a callback:
  if (callback.type === 'CallExpression') {
    return true;
  }
}

// return true if this is a CallExpression of the form 'objectName.propertyName()"
function isCallExpression(pathway, objectName, propertyName) {
  const callee = pathway.value.callee;
  if (!propertyName) {
    return callee.object && callee.object.name === objectName;
  }
  if (!objectName) {
    return callee.property && callee.property.name === propertyName;
  }
  return callee.object && callee.object.name === objectName && callee.property.name === propertyName;
}

// find a MemberExpression of the form 'objectName.propertyName'
function isMemberExpression(pathway, objectName, propertyName) {
  const expression = pathway.value;
  return (expression.object && expression.object.name === objectName && expression.property.name === propertyName);
}

// export everything:
module.exports = {
  isCallExpression,
  isFunctionWithCallback,
  isMemberExpression,
  selectFunctionCalls
};
