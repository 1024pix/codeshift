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

const anyFunction = anyOf(codeshift.FunctionExpression, codeshift.ArrowFunctionExpression, codeshift.FunctionDeclaration);

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
    ast.find(codeshift.CallExpression,
             call => call.callee.type === 'MemberExpression'
                     && /ontroller$/.test(call.callee.object.name))
      .forEach(callPath => {
        const lastArg = _.last(callPath.value.arguments);
        if (typeof lastArg === 'object') {
          if (lastArg.type === 'CallExpression'
              || lastArg.name === 'reply'
              || lastArg.name === 'replyStub') {
            callPath.value.arguments[callPath.value.arguments.length - 1] =
              codeshift.objectExpression([
                codeshift.objectProperty(
                  codeshift.identifier('response'),
                  lastArg
                )
              ]);
          }
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
        codeshift(expr).closest(anyFunction)
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
        codeshift(path).closest(anyFunction)
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

  asyncifyControllerTest(ast) {
    // promise = ...ontroller....(...)
    ast.find(codeshift.VariableDeclarator,
             decl => decl.id.name === 'promise'
              && decl.init
              && decl.init.type === 'CallExpression'
              && decl.init.callee.type === 'MemberExpression'
              && /ontroller$/.test(decl.init.callee.object.name))
      .forEach((path) => {
        const func = codeshift(path).closest(anyFunction).nodes()[0];

        codeshift(func).find(codeshift.ReturnStatement,
                             ret => ret.argument.type === 'CallExpression'
                              && ret.argument.callee.type === 'MemberExpression'
                              && ret.argument.callee.object.name === 'promise'
                              && ret.argument.callee.property.name === 'then'
                            )
          .forEach(retPath => {
            func.async = true;
            path.value.id.name = 'response';
            path.value.init = codeshift.awaitExpression(path.value.init);

            const statements = retPath.value.argument.arguments[0].body.body;
            statements.reverse().forEach(st => retPath.insertAfter(st));
            retPath.insertAfter("// then");
            codeshift(retPath).remove();
          });

      });
  },

};
