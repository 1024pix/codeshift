const types = require('ast-types');
const codeshift = require('jscodeshift');

// helpers:
const {
  getFunctionNameFromFunctionExpression
} = require('../helpers/getHelpers.js');

const replaceReplies = require('../helpers/replaceReplies.js');

const {
  isCallExpression,
} = require('../helpers/selectionHelpers.js');

const parseTree = require('../helpers/parseTree.js');

const util = require('util');

function log(msg) {
  process.stderr.write(msg + '\n\n');
}

function insp(e, depth) {
  depth = depth || 2;
  log(util.inspect(e,{depth,colors:true}));
}

module.exports = {
  replaceReplyStub(ast) {
    const hasCodeStub = ast.find(codeshift.VariableDeclarator, decl => decl.id.name === 'codeStub').size() > 0;
    ast.find(codeshift.VariableDeclaration,
             decl => decl.kind === 'let'
                     && decl.declarations.length === 1
                     && decl.declarations[0].id.name === 'replyStub')
       .forEach(p => codeshift(p)
                .replaceWith(`const hStub = { response: () => {} };${hasCodeStub ? '' : '\nlet codeStub;'}`));
    ast.find(codeshift.AssignmentExpression,
             expr => expr.left.name === 'replyStub')
       .forEach(e => codeshift(e)
                .replaceWith(`${hasCodeStub ? '' : 'codeStub = sandbox.stub();\n'}hStub.response = sandbox.stub().returns({\n  code: codeStub,\n})`));
    ast.find(codeshift.Identifier, id => id.name === 'replyStub')
       .forEach(id => {
         const [ { callee } ] = codeshift(id).closest(codeshift.CallExpression).nodes();
         if (callee.name === 'expect') {
           codeshift(id).replaceWith('hStub.response');
         } else {
           codeshift(id).replaceWith('hStub');
         }
       });
  },
};
