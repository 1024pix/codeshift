const types = require('ast-types');
const codeshift = require('jscodeshift');
const _ = require('lodash');
const recast = require('recast');

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

function normalSource(ast) {
  return recast.prettyPrint(ast).code;
}

function anyOf(...types) {
  return {
    check(node) {
      return types.some((t) => t.check(node));
    }
  }
}

function promisifyCall(path) {
  const callback = path.value.arguments.pop();
  const newExpr = codeshift.callExpression(
    codeshift.memberExpression(
      path.value,
      codeshift.identifier('then'),
  ),
  [
    callback
  ]
  );
  codeshift(path).replaceWith(newExpr);
}

module.exports = {
  replaceReplyStub(ast) {
    const hasCodeStub = ast.find(codeshift.VariableDeclarator, decl => decl.id.name === 'codeStub').size() > 0;
    // let replyStub = ...     ->     const hStub = ...
    ast.find(codeshift.VariableDeclaration,
             decl => decl.declarations.length === 1
                     && decl.declarations[0].id.name === 'replyStub')
       .forEach(p => codeshift(p)
                       .replaceWith(`const hStub = { response: () => {} };${hasCodeStub ? '' : '\nlet codeStub;'}`));

    // replyStub = ...     ->    hStub.response = ...
    ast.find(codeshift.AssignmentExpression,
             expr => expr.left.name === 'replyStub')
       .forEach(e => {
         codeshift(e)
           .replaceWith(`${hasCodeStub ? '' : 'codeStub = sandbox.stub();\n'}hStub.response = sandbox.stub().returns({\n  code: codeStub,\n})`);
       });

    // expect(replyStub) -> expect(hStub.response)
    // replyStub -> hStub
    ast.find(codeshift.Identifier, id => id.name === 'replyStub')
       .forEach(id => {
         const [ { callee } ] = codeshift(id).closest(codeshift.CallExpression).nodes();
         if (callee.name === 'expect') {
           codeshift(id).replaceWith('hStub.response');
         } else {
           codeshift(id).replaceWith('hStub');
         }
       });

    ast.find(codeshift.CallExpression,
             call => call.callee.type === 'MemberExpression'
                     && /Controller$/.test(call.callee.object.name))
      .forEach(callPath => {
        const lastArg = _.last(callPath.value.arguments);
        if (typeof lastArg === 'object' && lastArg.type === 'CallExpression') {
          callPath.value.arguments[callPath.value.arguments.length - 1] =
            codeshift.objectExpression([
              codeshift.objectProperty(
                codeshift.identifier('response'),
                lastArg
              )
            ]);
        }
      });

  },

  upgradeHapiRoute(ast) {
    ast.find(codeshift.AssignmentExpression,
             expr => normalSource(expr.left) === 'exports.register')
      .forEach(expr => {
        const func = expr.value.right;
        func.async = true;

        // remove 'done' argument
        if (func.params.length > 2) {
          func.params.pop();
        }

        // remove 'return next()'
        if (_.last(func.body.body).type === 'ReturnStatement') {
          func.body.body.pop();
        }
      });

    // exports.register.attributes = { name: '...' } => exports.name = '...'
    ast.find(codeshift.AssignmentExpression,
             expr => normalSource(expr.left) === 'exports.register.attributes')
      .forEach(expr => {
        const ass = expr.value;
        const nameProp = _.find(ass.right.properties, prop => prop.key.name === 'name');
        ass.left = ass.left.object;
        ass.left.property = 'name';
        ass.right = nameProp.value;
      });
  },

  upgradeHapiRouteTest(ast) {
    // rewrite Server constructor calls
    ast.find(codeshift.NewExpression,
             expr => normalSource(expr.callee) === 'Hapi.Server')
      .forEach(expr => {
        codeshift(expr).replaceWith('Hapi.server()');
      });

    // remove calls to server.connection()
    ast.find(codeshift.CallExpression,
             expr => normalSource(expr.callee) === 'server.connection')
      .forEach(expr => codeshift(expr).remove());

    // remove { register: ... }
    ast.find(codeshift.CallExpression,
             expr => normalSource(expr.callee) === 'server.register'
               && expr.arguments[0].type === 'ObjectExpression')
      .forEach(expr => {
        const arg = expr.value.arguments[0];
        expr.value.arguments[0] = arg.properties[0].value;

        codeshift(expr.parentPath).replaceWith(codeshift.returnStatement(expr.value));
      });

    // inline expectRouteToExist
    ast.find(codeshift.FunctionDeclaration,
             decl => decl.id && decl.id.name === 'expectRouteToExist')
      .forEach(decl => codeshift(decl).remove());
    ast.find(codeshift.CallExpression,
             expr => normalSource(expr.callee) === 'expectRouteToExist')
      .forEach(expr => {
        const newExpr =
          codeshift.variableDeclaration('const', [
            codeshift.variableDeclarator(
              codeshift.identifier('res'),
              codeshift.awaitExpression(
                codeshift.callExpression(
                  codeshift.memberExpression(codeshift.identifier('server'), codeshift.identifier('inject')),
                  [ expr.value.arguments[0] ]
                )
              )
            )
          ]);
        codeshift(expr.parentPath).replaceWith(newExpr)
          .insertAfter("expect(res.statusCode).to.equal(200);");
        codeshift(expr).closest(anyOf(codeshift.FunctionExpression, codeshift.ArrowFunctionExpression))
          .forEach(fnexpr => {
            fnexpr.value.async = true;
            fnexpr.value.params.pop();
          });
      });

  },

  // server.inject({ ... }, cb) => server.inject({ ... }).then(cb)
  promisifyServerInject(ast) {
    ast.find(codeshift.CallExpression,
             expr => normalSource(expr.callee) === 'server.inject' && expr.arguments.length == 2)
      .forEach(path => {
        promisifyCall(path);
        codeshift(path).closest(anyOf(codeshift.FunctionExpression, codeshift.ArrowFunctionExpression))
          .forEach(fnpath => {
            if (fnpath.value.params.length === 1) {
              const doneName = fnpath.value.params[0].name;
              fnpath.value.params.pop();
              codeshift(fnpath).find(codeshift.CallExpression,
                                     expr => expr.callee.name === doneName).remove();
            }
          });
      });
  },

  // reply -> h.response
  replyToResponseToolkit(ast) {
    [codeshift.ArrowFunctionExpression, codeshift.FunctionExpression, codeshift.FunctionDeclaration].forEach(type => {
      ast.find(type,
               expr => _.some(expr.params, { name: 'reply' }))
        .forEach(path => {
          const replyParam = _.find(path.value.params, { name: 'reply' });
          replyParam.name = 'h';
          codeshift(path).find(codeshift.CallExpression, expr => expr.callee.name === 'reply')
            .forEach(replyCall => {
              replyCall.value.callee = codeshift.memberExpression(codeshift.identifier('h'), codeshift.identifier('response'));
            });
          codeshift(path).find(codeshift.Identifier, id => id.name === 'reply')
            .forEach(path => {
              path.value.name = 'h';
            });
        });
    });
  },

};
