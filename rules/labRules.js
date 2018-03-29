const codeshift = require('jscodeshift');
// some helpers:
const {
  selectMemberExpression,
  selectCallExpression
} = require('../helpers/selectionHelpers.js');

const { replaceCodeExpect } = require('../helpers/replaceHelpers');

module.exports = {
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
  // todo: add in the t.end():
  replaceTest: (ast) => {
    // replace lab.test + callback with tap.test + async handler
    ast.find(codeshift.CallExpression)
      .filter(pathway => selectCallExpression(pathway, 'lab', 'test'))
      .forEach(p => {
        const tEnd = codeshift.callExpression(
          codeshift.identifier('end'), []
        );
        tEnd.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('end')); 
        const existingArrow = p.value.arguments[1];
        existingArrow.async = true;
        existingArrow.params[0] = codeshift.identifier('t');
        existingArrow.body.body.push(codeshift.expressionStatement(tEnd));
        p.value.callee.object.name = 'tap';

        // this gets the main body of the test:
        // const mainbody = p.value.arguments[1].body;
        // const newbody = [];
        // mainbody.body.forEach((directive, index) => {
        //   newbody.push(directive);
        // });
        // newbody.push(tEnd);
        // console.log(Object.keys(existingArrow.body));
        // console.log(existingArrow.body.body[0]);
        // existingArrow.body = codeshift.blockStatement(newbody);
        // const call = codeshift.arrowFunctionExpression([codeshift.identifier('t')], p.value.arguments[1].body);
        // const call = codeshift.arrowFunctionExpression([codeshift.identifier('t')], codeshift.blockStatement(newbody));
        // call.async = true;
        // call.body = existingArrow.body;
        // p.value.arguments[0] = call;
        // console.log(existingArrow.params[0]);
        // console.log(p.value.arguments[1]);
        // console.log(p.value.arguments.unshift);
        // console.log(p.value.arguments.pop);
        // p.value.body = codeshift.blockStatement(newBody)
        //   codeshift.callExpression(
        //     codeshift.identifier('test'), [p.value.arguments[0], call]
        //   )
        // );
      });
  }
};
