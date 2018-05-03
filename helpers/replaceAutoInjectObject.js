const types = require('ast-types');
const codeshift = require('jscodeshift');

// helpers:
const {
  getFunctionNameFromFunctionExpression,
  getLastArgumentFromFunction,
  ErrorNames
} = require('../helpers/getHelpers.js');

const parseTree = require('../helpers/parseTree');
const removeReturnParent = require('../helpers/removeReturnParent');
const replaceCallbackWithAssignment = require('../helpers/replaceCallbackWithAssignment');

module.exports = (mainObject, mainCallback) => {
  // use allProps to combine the code in the main object and the callback
  // into one unified block statement:
  const allProps = [];
  // loop over each function call in the main object and get the function name and the callback name
  // and then look for occurences of that callback in the function body:
  const properties = mainObject.get('properties');
  properties.value.forEach(prop => {
    const functionName = getFunctionNameFromFunctionExpression(prop);
    // get the callback name:
    const callbackName = getLastArgumentFromFunction(prop).name;
    prop.value.body.body.forEach(expressionStatement => {
      // clean up the content of each function
      // if it is an async function, it won't have a callback:
      if (prop.value.async) {
        let keep = true;
        types.visit(expressionStatement, {
          // for now just set the variable, later this may need to be more complicated:
          visitReturnStatement(ret) {
            if (!ret.value.argument) {
              return this.traverse(ret);
            }
            // if it is an identier it is either the functionName or it has already been declared above:
            if (ret.value.argument.type === 'Identifier') {
              if (functionName === ret.value.argument.name) {
                keep = false;
              }
              return this.traverse(ret);
            }
            // if it is a method call add 'await':
            const value = ret.value.argument.type === 'CallExpression' ?
              codeshift.awaitExpression(ret.value.argument) : ret.value.argument;
            const varAssign = codeshift.variableDeclaration(
              'const',
              [codeshift.variableDeclarator(codeshift.identifier(functionName), value)]
            );
            allProps.push(varAssign);
            keep = false;
            return this.traverse(ret);
          }
        });
        if (keep) {
          allProps.push(expressionStatement);
        }
        return;
      }
      types.visit(expressionStatement, {
        visitCallExpression(func) {
          // for any call to the callbackName, replace it with an awaitExpr
          // eg func1(done) { done(null, 'a value'); } --------> const func1 = 'a value';
          if (getFunctionNameFromFunctionExpression(func.value) === callbackName) {
            // if not called with args just nuke it:
            if (func.value.arguments.length === 0) {
              removeReturnParent(func);
              // if it was the 'reply' statement be sure to return nothing:
              if (functionName === 'reply') {
                func.replace(parseTree('return;'));
                return false;
              }
              func.replace();
              return false;
            }
            // if called with 1 arg that's an error:
            if (func.value.arguments.length === 1) {
              // replace the function with a throw:
              const replacement = codeshift.throwStatement(func.value.arguments[0]);
              if (func.parentPath.value.type === 'ReturnStatement') {
                func.parentPath.replace(replacement);
              } else {
                func.replace(replacement);
              }
              return false;
            }
            // if called with 2 args the 2nd arg is probably the assignment value:
            // todo: maybe try to verify the 1st arg is a null value
            if (func.value.arguments.length === 2) {
              const replacement = replaceCallbackWithAssignment(func, 'const', functionName, true);
              // check if we are just re-assigning the name of a variable, we don't need to do that:
              if (replacement.declarations[0].id.name === functionName && replacement.declarations[0].init.argument) {
                const assignmentType = replacement.declarations[0].init.argument.type;
                if (assignmentType === 'Identifier' || assignmentType === 'Literal') {
                  const assignmentName = assignmentType === 'Identifier' ? 'name' : 'value'
                  if (functionName === 'reply') {
                    func.replace(parseTree(`return ${replacement.declarations[0].init.argument[assignmentName]};`));
                    return false;
                  }
                  func.replace();
                  return false;
                }
              }
              if (func.parentPath.value.type === 'ReturnStatement') {
                func.parentPath.replace(replacement);
              } else {
                func.replace(replacement);
              }
              return false;
            }
          }
          // for any function expression that has the callback name as the last parameter, make it
          // a variableDeclaration, eg func1(done) { myFunc(1234, done); } ----> const func1 = await myFunc(1234);
          const expressionCallback = getLastArgumentFromFunction(func);
          if (expressionCallback.name && expressionCallback.name === callbackName) {
            // replace the function with the assignment:
            func.replace(replaceCallbackWithAssignment(func, 'const', functionName));
          }

          return this.traverse(func);
        }
      });
      // todo: convert explicit calls to done(err) to 'throw err';
      // todo: convert explicit calls to done(err, value) to 'const func1 = value;'
      // for any other type of expression statement just push it to the body:
      allProps.push(expressionStatement);
    });
  });
  // if the callback is an identifier, it should be for the callback function:
  // eg async.autoInject({....}, allDone). In which case we can just skip it;
  if (mainCallback && mainCallback.value.type !== 'Identifier') {
    // add the content of the callback to the block:
    mainCallback.value.body.body.forEach((item, index) => {
      // don't add any 'if (err)' statements:
      if (item.type === 'IfStatement' && ErrorNames.includes(item.test.name)) {
        return;
      }
      allProps.push(item);
    });
  }
  return allProps;
};
