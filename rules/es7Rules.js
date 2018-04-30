const types = require('ast-types');
const codeshift = require('jscodeshift');
const replaceMethodWithAsync = require('../helpers/replaceMethodWithAsync.js');
const replaceCallbackWithAssignment = require('../helpers/replaceCallbackWithAssignment');
const replaceCallbackWithAwait = require('../helpers/replaceCallbackWithAwait');
const replaceAutoInjectObject = require('../helpers/replaceAutoInjectObject.js');

// helpers:
const {
  CallbackNames,
  getLastArgumentFromFunction
} = require('../helpers/getHelpers.js');

const {
  isCallExpression,
} = require('../helpers/selectionHelpers.js');

module.exports = {
  replaceAsyncAutoInject: (ast) => {
    // replace the main body and callback of the autoInject:
    ast.find(codeshift.CallExpression)
      .filter(pathway => isCallExpression(pathway, 'async', 'autoInject'))
      .forEach(p => {
        // eg async.autoInject(mainObject, mainCallback);
        const mainObject = p.get('arguments').get(0);
        const mainCallback = p.get('arguments').get(1);
        const newBody = codeshift.blockStatement(replaceAutoInjectObject(mainObject, mainCallback));
        // three levels up is the body of the function, replace it with the new body:
        p.parentPath.parentPath.parentPath.replace(newBody);
        // make sure to convert any references to 'results.whatever' to just 'whatever'
        types.visit(p, {
          visitMemberExpression(member) {
            if (member.value.object.name !== 'results') {
              return this.traverse(member);
            }
            member.replace(member.value.property);
            return this.traverse(member);
          }
        });
      });
  },
  // make class members async:
  replaceClassMembers: (ast) => {
    ast.find(codeshift.ClassBody)
    .forEach(p => {
      // loop over all but the first function declarations:
      p.value.body.forEach(def => {
        replaceMethodWithAsync(def);
      });
    });
  },
  // convert any object methods that have a callback:
  replaceMethodDefinitions: (ast) => {
    ast.find(codeshift.CallExpression)
    .filter(p => {
      const lastArg = getLastArgumentFromFunction(p.value);
      console.log(lastArg.type);
      // todo: see if any calls to that callback are of length > 2, if so then don't mess for now
      // todo: also include ones where the last argument is a function expression
      return (lastArg.name && CallbackNames.includes(lastArg.name)) || lastArg.type === 'ArrowFunctionExpression';
    })
    .forEach(p => {
      replaceMethodWithAsync(p.value);
    });

    ast.find(codeshift.FunctionExpression)
    .filter(p => {
      const lastArg = getLastArgumentFromFunction(p.value);
      // todo: see if any calls to that callback are of length > 2, if so then don't mess for now
      // todo: also include ones where the last argument is a function expression
      return (lastArg.name && CallbackNames.includes(lastArg.name)) || lastArg.type === 'ArrowFunctionExpression';
    })
    .forEach(p => {
      replaceMethodWithAsync(p.value);
    });
  },

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
        // if (callback.params.length > 1) {
        const varName = callback.params[callback.params.length - 1].name;
        func.replace(replaceCallbackWithAssignment(func, 'const', varName));
      });
    });
  }
};
