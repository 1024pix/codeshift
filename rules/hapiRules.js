const types = require('ast-types');
const codeshift = require('jscodeshift');

// helpers:
const {
  getFunctionNameFromFunctionExpression,
  getLastArgumentFromFunction,
} = require('../helpers/getHelpers.js');

const {
  selectCallExpression,
} = require('../helpers/selectionHelpers.js');

// helpers:
const {
  replaceCallbackWithAwait,
  replaceCallbackWithAssignment,
  replaceServerInject,
  removeReturnParent
} = require('../helpers/replaceHelpers.js');

module.exports = {
  replaceServerStop: (ast) => {
    ast.find(codeshift.CallExpression)
      // get all 'server.stop()' expressions
      .filter(pathway => selectCallExpression(pathway, 'server', 'stop'))
      // replace them with await server.stop()
      .replaceWith(p => replaceCallbackWithAwait(p, 'stop'));
  },
  replaceAsyncAutoInject: (ast) => {
    // replace the main body and callback of the autoInject:
    ast.find(codeshift.CallExpression)
      .filter(pathway => selectCallExpression(pathway, 'async', 'autoInject'))
      .forEach(p => {
        // eg async.autoInject(mainObject, mainCallback);
        const mainObject = p.get('arguments').get(0);
        const mainCallback = p.get('arguments').get(1);
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
            types.visit(expressionStatement, {
              visitCallExpression(func) {
                // for any call to the callbackName, replace it with an awaitExpr
                // eg func1(done) { done(null, 'a value'); } --------> const func1 = 'a value';
                if (getFunctionNameFromFunctionExpression(func.value) === callbackName) {
                  // if not called with args just nuke it:
                  if (func.value.arguments.length === 0) {
                    removeReturnParent(func);
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
                    //   return done(null, simpleAwaitExpression.name);
                    const replacement = replaceCallbackWithAssignment(func, 'const', functionName);
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
        if (mainCallback.value.type !== 'Identifier') {
          // add the content of the callback to the block:
          mainCallback.value.body.body.forEach((item, index) => {
            // don't add any 'if (err)' statements:
            if (item.type === 'IfStatement' && index === 0) {
              return;
            }
            allProps.push(item);
          });
        }
        const newBody = codeshift.blockStatement(allProps);
        // three levels up is the body of the function, replace it with the new body:
        p.parentPath.parentPath.parentPath.replace(newBody);
      });
    // replace any ('if (err) { }')
  },
  replaceServerInject: (ast) => {
    ast.find(codeshift.Program)
      .forEach(p => {
        // use types.visit to get any server.inject statements
        // then loop over and awaitify each of them with replaceServerInject(p);
        const injects = [];
        types.visit(p, {
          visitCallExpression(func) {
            const name = getFunctionNameFromFunctionExpression(func.value);
            if (name === 'inject') {
              if (!injects.includes(func)) {
                injects.push(func);
              }
            }
            return this.traverse(func);
          }
        });
        injects.reverse();
        injects.forEach(func => {
          replaceServerInject(func);
        });
      });
  },
  // find methods who's last argument is a function of the form '(err, something)''
  // and awaitify them:
  // UNDER CONSTRUCTION:
  replaceCallbacksWithAwait: (ast) => {
    ast.find(codeshift.Program)
    .forEach(p => {
      const calls = [];
      types.visit(p, {
        visitCallExpression(func) {
          const lastArg = getLastArgumentFromFunction(func.value);
          // if it's a callback method:
          if (lastArg.type === 'ArrowFunctionExpression') {
            const callbackArgs = lastArg.params;
            if (callbackArgs.length > 0) {
              if (callbackArgs[0].type === 'Identifier') {
                ['exc', 'err'].forEach(errName => {
                  if (callbackArgs[0].name.startsWith(errName)) {
                    calls.push(func);
                  }
                });
              }
            }
          }
          this.traverse(func);
        }
      });
      calls.reverse();
      calls.forEach(func => {
        // get the callback:
        const callback = getLastArgumentFromFunction(func.value);
        if (callback.params.length === 1) {
          func.replace(replaceCallbackWithAwait(func));
        }
        // get the callback name that we'll use for the variable assignment:
        const varName = callback.params[1].name;
        func.replace(replaceCallbackWithAssignment(func, 'const', varName));
      });
    });
  }
};
