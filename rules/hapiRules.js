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

const replaceServerInject = require('../helpers/replaceServerInject');
const replaceCallbackWithAwait = require('../helpers/replaceCallbackWithAwait');
const replaceAutoInjectObject = require('../helpers/replaceAutoInjectObject.js');

module.exports = {
  replaceServerStop: (ast) => {
    ast.find(codeshift.CallExpression)
      // get all 'server.stop()' expressions
      .filter(pathway => isCallExpression(pathway, 'server', 'stop'))
      // replace them with await server.stop()
      .replaceWith(p => replaceCallbackWithAwait(p, 'stop'));
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
  replaceRoutes: (ast) => {
    ast.find(codeshift.Property)
      .filter(pathway => pathway.value.key.name === 'handler' && pathway.value.value.type === 'FunctionExpression')
      .forEach(p => {
        p.value.value.params[1].name = 'h';
        // replace any occurence of 'reply':
        replaceReplies(p);
      });
  },
  // replaces hapi-auto-handler routes:

  replaceRouteAutoInject: (ast) => {
    // replace the main body and callback of the autoInject:
    ast.find(codeshift.Property)
      .filter(pathway => pathway.value.key.name === 'handler' && pathway.value.value.type !== 'FunctionExpression')
      .forEach(p => {
        const mainObject = p.get('value').get('properties').get(0).get('value');
        const allProps = replaceAutoInjectObject(mainObject);
        // add variables for server, setting:
        allProps.unshift(parseTree(`
          const server = request.server;
        `));
        allProps.unshift(parseTree(`
          const settings = request.server.settings.app;
        `));
        p.value.value = codeshift.arrowFunctionExpression([
          codeshift.identifier('request'),
          codeshift.identifier('h')
        ], codeshift.blockStatement(allProps));
        p.value.value.async = true;
        replaceReplies(p);
      });
  },
  /*
  replacePlugin: (ast) => {
    // replace the registration method:
    ast.find(codeshift.AssignmentExpression)
      .filter(pathway => pathway.value.left && pathway.value.left.property.name === 'register')
      .replaceWith(p => {
        // replace 'exports.register =' with 'const register ='
        const varAssign = codeshift.variableDeclaration(
          'const',
          [codeshift.variableDeclarator(codeshift.identifier('register'), p.value.right)]
        );
        // remove 'next':
        if (p.value.right.params && p.value.right.params.includes('next')) {
          p.value.right.params.pop();
        }
        types.visit(p, {
          visitCallExpression(func) {
            const name = getFunctionNameFromFunctionExpression(func.value);
            if (name === 'next') {
              delete func.loc;
              func.replace();
              func.parentPath.replace();
            }
            return this.traverse(func);
          }
        });
        p.parentPath.replace(varAssign);
      });
    // replace 'exports.register.attributes':
    ast.find(codeshift.AssignmentExpression)
      .filter(pathway => pathway.value.left.property.name === 'attributes')
      .forEach(p => {
        const right = p.value.right;
        p.replace(codeshift.assignmentExpression('=',
          codeshift.memberExpression(
            codeshift.identifier('exports'),
            codeshift.identifier('plugin'),
          ), right
        ));
        const registerProp = codeshift.property('init', codeshift.identifier('register'), codeshift.identifier('register'));
        registerProp.shorthand = true;
        const pkgProp = codeshift.property('init', codeshift.identifier('pkg'), codeshift.callExpression(codeshift.identifier('require'), [codeshift.literal('../package.json')]));
        // right.properties.push(onceProp);
        p.value.right.properties = [
          registerProp,
          pkgProp
        ];
      });
  }
  */
};
