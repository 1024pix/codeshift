// contains helpers to assist with selecting nodes of interest from a Collection of nodes
const { getLastArgumentFromFunction } = require('./getHelpers');

// try to find functions that need to be promisified:
function selectFunctionsWithCallbacks(pathway, ast) {
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
  // if it's an identifier we will look in the AST to see if it's a function:
}

// find a CallExpression of the form 'objectName.propertyName()"
function selectCallExpression(pathway, objectName, propertyName) {
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
function selectMemberExpression(pathway, objectName, propertyName) {
  const expression = pathway.value;
  return (expression.object && expression.object.name === objectName && expression.property.name === propertyName);
}

// export everything:
module.exports = {
  selectCallExpression,
  selectMemberExpression,
  selectFunctionsWithCallbacks
};
