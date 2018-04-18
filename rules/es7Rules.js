const types = require('ast-types');
const codeshift = require('jscodeshift');
const replaceMethodWithAsync = require('../helpers/replaceMethodWithAsync.js');
const replaceCallbackWithAssignment = require('../helpers/replaceCallbackWithAssignment');
const replaceCallbackWithAwait = require('../helpers/replaceCallbackWithAwait');

// helpers:
const {
  getLastArgumentFromFunction
} = require('../helpers/getHelpers.js');

module.exports = {
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
  },
  replaceClassMembers: (ast) => {
    ast.find(codeshift.ClassBody)
    .forEach(p => {
      // loop over all but the first function declarations:
      p.value.body.forEach(def => {
        replaceMethodWithAsync(def);
      });
    });
  }
};
