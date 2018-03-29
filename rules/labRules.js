const codeshift = require('jscodeshift');
const types = require('ast-types');

const {
  selectMemberExpression,
  selectCallExpression
} = require('../helpers/selectionHelpers.js');

const replaceCodeExpect = require('../helpers/replaceCodeExpect');
const removeReturnParent = require('../helpers/removeReturnParent');

const { getFunctionNameFromFunctionExpression } = require('../helpers/getHelpers');

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
        if (p.value.declarations[0].id.name === 'code') {
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
      .filter(pathway => selectMemberExpression(pathway, 'lab', 'afterEach'))
      .replaceWith(p => {
        return codeshift.memberExpression(
          codeshift.identifier('tap'),
          p.value.property
        );
      });
    // (done) => async ()
    ast.find(codeshift.CallExpression)
      .filter(pathway => selectCallExpression(pathway, 'tap', 'afterEach'))
      .replaceWith(p => {
        const arg = p.value.arguments[0];
        const func = codeshift.arrowFunctionExpression([], arg.body);
        func.async = true;
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
      .filter(pathway => selectMemberExpression(pathway, 'lab', 'beforeEach'))
      .replaceWith(p => {
        return codeshift.memberExpression(
          codeshift.identifier('tap'),
          p.value.property
        );
      });
    // (done) => async ()
    ast.find(codeshift.CallExpression)
    .filter(pathway => selectCallExpression(pathway, 'tap', 'beforeEach'))
      .replaceWith(p => {
        const arg = p.value.arguments[0].type === 'ObjectExpression' ? p.value.arguments[1] : p.value.arguments[0];
        const func = codeshift.arrowFunctionExpression([], arg.body);
        func.async = true;
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
    .filter(pathway => selectCallExpression(pathway, 'setup'))
      .replaceWith(p => {
        const call = codeshift.callExpression(codeshift.identifier('setup'), [p.value.arguments[0]]);
        const awaitExpr = codeshift.awaitExpression(call);
        return codeshift.assignmentExpression('=', codeshift.identifier('server'), awaitExpr);
      });
  },
  replaceTest: (ast) => {
    // replace lab.test + callback with tap.test + async handler
    ast.find(codeshift.CallExpression)
      .filter(pathway => selectCallExpression(pathway, 'lab', 'test'))
      .forEach(p => {
        // get the name of this test's callback and replace any occurences of it:
        const callbackName = p.value.arguments[1].params[0].name;
        types.visit(p, {
          visitCallExpression(func) {
            if (callbackName === getFunctionNameFromFunctionExpression(func.value)) {
              // remove the 'return' if it exists:
              removeReturnParent(func);
              func.replace();
            }
            // for any call to the callbackName, replace it with an awaitExpr
            return this.traverse(func);
          }
        });
        const tEnd = codeshift.callExpression(
          codeshift.identifier('end'), []
        );
        tEnd.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('end'));
        const existingArrow = p.value.arguments[1];
        existingArrow.async = true;
        existingArrow.params[0] = codeshift.identifier('t');
        existingArrow.body.body.push(codeshift.expressionStatement(tEnd));
        p.value.callee.object.name = 'tap';
      });
  }
};
