const types = require('ast-types');
const codeshift = require('jscodeshift');
const replaceMethodWithAsync = require('../helpers/replaceMethodWithAsync.js');
const replaceCallbackWithAssignment = require('../helpers/replaceCallbackWithAssignment');
const replaceCallbackWithAwait = require('../helpers/replaceCallbackWithAwait');
const replaceCallbacksInBody = require('../helpers/replaceCallbacksInBody');
const replaceAutoInjectObject = require('../helpers/replaceAutoInjectObject.js');
const parseTree = require('../helpers/parseTree');

// helpers:
const {
  CallbackNames,
  getLastArgumentFromFunction
} = require('../helpers/getHelpers.js');

const {
  isCallExpression,
} = require('../helpers/selectionHelpers.js');

const needsLibrary = (ast) => {
  ast.find(codeshift.CallExpression)
  forEach(p => {

  });
};

module.exports = {
  replacePromisify: (ast) => {
    ast.find(codeshift.CallExpression)
      .filter(pathway => {
        if (isCallExpression(pathway, 'util', 'promisify')) {
          return true;
        }
        if (pathway.value.callee && pathway.value.callee.name === 'promisify') {
          return true;
        }
      })
      .forEach(p => {
        // the parent is the call to the Promise:
        const arguments = p.parentPath.value.arguments;
        const call = codeshift.callExpression(p.value.arguments[0], arguments);
        p.parentPath.replace(call);
      });
  },
  replaceAsyncEachOf: (ast) => {
    ast.find(codeshift.CallExpression)
      .filter(pathway => isCallExpression(pathway, 'async', 'eachOf'))
      .forEach(p => {
        p.value.callee = p.value.callee.property;
        p.value.callee.name = 'pmap';
        const method = p.value.arguments[1];
        const objectName = p.value.arguments[0].name;
        const valueName = method.params[0].name;
        method.params = [method.params[1]];
        const keyName = method.params[0].name;

        // we will iterate over the keys of the object:
        p.value.arguments[0] = parseTree(`Object.keys(${objectName})`);
        // we will add a reference to the value name:
        method.body.body.unshift(parseTree(`const ${valueName} = ${objectName}[${keyName}];`));
        // and replace the replies:
        if (method.params.length === 3) {
          const callbackName = method.params[2].name;
          replaceCallbacksInBody(method.body.body, callbackName);
        }
      });
  },
  replaceAsyncMapValues: (ast) => {
    ast.find(codeshift.CallExpression)
      .filter(pathway => isCallExpression(pathway, 'async', 'mapValues'))
      .forEach(p => {
        p.value.callee = p.value.callee.property;
        p.value.callee.name = 'pmap';
        // the promise handler should only keep the middle arg:
        const method = p.value.arguments[1];
        const objectName = p.value.arguments[0].name;
        const valueName = method.params[0].name;
        const callbackName = method.params[2].name;
        method.params = [method.params[1]];
        const keyName = method.params[0].name;
        // we will iterate over the keys of the object:
        p.value.arguments[0] = parseTree(`Object.keys(${objectName})`);
        // we will add a reference to the value name:
        method.body.body.unshift(parseTree(`const ${valueName} = ${objectName}[${keyName}];`));
        // and replace the replies:
        replaceCallbacksInBody(method.body.body, callbackName);
      });
  },
  replaceAsyncAutoInject: (ast) => {
    // replace the main body and callback of the autoInject:
    ast.find(codeshift.CallExpression)
      .filter(pathway => isCallExpression(pathway, 'async', 'autoInject'))
      .forEach(p => {
        // eg async.autoInject(mainObject, mainCallback);
        const mainObject = p.get('arguments').get(0);
        const mainCallback = p.get('arguments').get(1);
        const newBody = codeshift.blockStatement(replaceAutoInjectObject(mainObject, mainCallback));
        // todo: might need to get first parent that is a blockStatement:
        if (Array.isArray(p.parentPath.parentPath.value)) {
          newBody.body.forEach(item => {
            p.parentPath.parentPath.parentPath.value.body.push(item);
          });
          p.replace();
        } else {
          // three levels up is the body of the function, replace it with the new body:
          const newBody = codeshift.blockStatement(replaceAutoInjectObject(mainObject, mainCallback));
          p.parentPath.parentPath.parentPath.replace(newBody);
        }
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
  replaceCallbacksWithAwait: (ast, source) => {
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
  },
};
