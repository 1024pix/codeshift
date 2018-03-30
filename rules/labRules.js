const codeshift = require('jscodeshift');

const {
  isMemberExpression,
  isCallExpression,
  selectFunctionCalls
} = require('../helpers/selectionHelpers.js');

const replaceCodeExpect = require('../helpers/replaceCodeExpect');

const { getLastArgumentFromFunction } = require('../helpers/getHelpers');

// todo: add new Promise for before/afterEach with non-hapi17 tests
module.exports = {
  replaceStrict: (ast) => {
    ast.find(codeshift.Literal)
    .filter(pathway => pathway.value.value === 'use strict')
    .forEach(p => {
      p.parentPath.replace();
    });
  },
  // replace all the lab require stuff with require('tap')
  replaceIncludes: (ast) => {
    ast.find(codeshift.VariableDeclaration)
      .filter(pathway => {
        if (pathway.value.declarations[0].id.name === 'code') {
          return true;
        }
        if (pathway.value.declarations[0].id.name === 'lab') {
          return true;
        }
        return false;
      })
      .forEach(p => {
        if (p.value.declarations[0].id.name === 'lab') {
          const varAssign = codeshift.variableDeclaration(
            'const',
            [
              codeshift.variableDeclarator(
                codeshift.identifier('tap'), codeshift.callExpression(
                  codeshift.identifier('require'), [codeshift.literal('tap')]
                )
            )]
          );
          p.replace(varAssign);
        } else {
          p.replace();
        }
      });
  },
  // scans for all 'code.expect(...)' calls:'
  replaceCodeExpect: (ast) => {
    ast.find(codeshift.CallExpression)
      .filter(pathway => {
        if (pathway.value.callee && pathway.value.callee.object && pathway.value.callee.object.name === 'code') {
          return true;
        }
        return false;
      })
      .forEach(p => {
        const { result, parent } = replaceCodeExpect(p);
        parent.replace(result);
      });
  },
  replaceAfterEach: (ast) => {
    // lab.afterEach -> tap.afterEach
    ast.find(codeshift.MemberExpression)
      .filter(pathway => isMemberExpression(pathway, 'lab', 'afterEach'))
      .replaceWith(p => {
        return codeshift.memberExpression(
          codeshift.identifier('tap'),
          p.value.property
        );
      });
    // (done) => (t) =>
    ast.find(codeshift.CallExpression)
      .filter(pathway => isCallExpression(pathway, 'tap', 'afterEach'))
      .replaceWith(p => {
        const callbackName = p.value.arguments[0].params[0].name;
        const arg = p.value.arguments[0].type === 'ObjectExpression' ? p.value.arguments[1] : p.value.arguments[0];
        // 'return new Promise(callbackName => { ..... callbackName() });'
        const promise = codeshift.returnStatement(
          codeshift.newExpression(
            codeshift.identifier('Promise'),
            [codeshift.arrowFunctionExpression([codeshift.identifier(callbackName)], arg.body)]
          )
        );
        const func = codeshift.arrowFunctionExpression([], codeshift.blockStatement([promise]));
        // func.async = true;
        const call = codeshift.callExpression(
          codeshift.identifier('afterEach'),
          [func]
        );
        call.callee = p.value.callee;
        return call;
      });
  },
  replaceBeforeEach: (ast) => {
    // lab.afterEach -> tap.afterEach
    ast.find(codeshift.MemberExpression)
      .filter(pathway => isMemberExpression(pathway, 'lab', 'beforeEach'))
      .replaceWith(p => {
        return codeshift.memberExpression(
          codeshift.identifier('tap'),
          p.value.property
        );
      });
    // (done) => async ()
    ast.find(codeshift.CallExpression)
    .filter(pathway => isCallExpression(pathway, 'tap', 'beforeEach'))
      .replaceWith(p => {
        const callbackName = p.value.arguments[0].type === 'ObjectExpression' ? p.value.arguments[1].params[0].name : p.value.arguments[0].params[0].name;
        const arg = p.value.arguments[0].type === 'ObjectExpression' ? p.value.arguments[1] : p.value.arguments[0];
        // 'return new Promise(callbackName => { ..... callbackName() });'
        const promise = codeshift.returnStatement(
          codeshift.newExpression(
            codeshift.identifier('Promise'),
            [codeshift.arrowFunctionExpression([codeshift.identifier(callbackName)], arg.body)]
          )
        );
        const func = codeshift.arrowFunctionExpression([], codeshift.blockStatement([promise]));
        // func.async = true;
        const call = codeshift.callExpression(
          codeshift.identifier('beforeEach'),
          [func]
        );
        call.callee = p.value.callee;
        return call;
      });
  },
  replaceServerSetup: (ast) => {
    ast.find(codeshift.CallExpression)
    .filter(pathway => isCallExpression(pathway, 'setup'))
      .replaceWith(p => {
        const call = codeshift.callExpression(codeshift.identifier('setup'), [p.value.arguments[0]]);
        const awaitExpr = codeshift.awaitExpression(call);
        return codeshift.assignmentExpression('=', codeshift.identifier('server'), awaitExpr);
      });
  },
  // todo replace callback with calls to t.end();
  replaceTest: (ast) => {
    // replace lab.test + callback with tap.test + async handler
    ast.find(codeshift.CallExpression)
      .filter(pathway => isCallExpression(pathway, 'lab', 'test'))
      .forEach(p => {
        // get the name of this test's callback and replace any occurences of it with a t.end() or t.end:
        // lab.test callback could be 2nd or 3rd param, if it's the third we need to remove the 2nd
        if (p.value.arguments[1].type === 'ObjectExpression') {
          p.value.arguments[1] = p.value.arguments.pop();
        }
        const existingArrow = p.value.arguments[1];
        const callbackName = existingArrow.params[0].name;
        // if there's a function that passes the callback as a parameter replace it with 't.end':
        const functionCalls = selectFunctionCalls(p);
        functionCalls.forEach(func => {
          const lastArg = func.get('arguments').get(func.value.arguments.length - 1);
          if (lastArg.value && lastArg.value.type === 'Identifier' && lastArg.value.name === callbackName) {
            lastArg.replace(codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('end')));
          }
        });
        // if there's a call to the callback replace it with 't.end()':
        const callbacks = selectFunctionCalls(p, callbackName);
        callbacks.reverse();
        callbacks.forEach(func => {
          // if the callback was an error, let's do t.fail:
          if (func.value.arguments.length > 0) {
            func.replace(codeshift.callExpression(codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('fail')), []));
          } else {
            func.replace(codeshift.callExpression(codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('end')), []));
          }
        });
        existingArrow.params = [codeshift.identifier('t')];
        p.value.callee.object.name = 'tap';
      });
  }
};
