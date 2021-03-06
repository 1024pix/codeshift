const codeshift = require('jscodeshift');
const types = require('ast-types');

const { getFunctionNameFromFunctionExpression, getVariableDeclaration } = require('../helpers/getHelpers');

// replace a code.expect statement:
module.exports = function replaceCodeExpect(ast, pathway) {
  const seen = {};
  let source;
  types.visit(pathway.parentPath.parentPath.parentPath, {
    visitCallExpression(func) {
      // get 'a' from 'expect(a)'
      if (getFunctionNameFromFunctionExpression(func.value) === 'expect') {
        source = func.value.arguments[0];
      }
      return this.traverse(func);
    },
    // records each seen identifier:
    visitIdentifier(id) {
      seen[id.value.name] = id;
      return this.traverse(id);
    }
  });

  // if it's a to.equal:
  if (seen.equal && !seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('equal'), [
      codeshift.identifier('t'),
      source,
      dest
    ]);
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }

  // if it's a to.startWith:
  if (seen.startWith && !seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('match'));
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.endWith:
  if (seen.endWith && !seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('match'));
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.include:
  if (seen.include && !seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('match'));
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.not.include:
  if (seen.include && seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('notMatch'));
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.contain
  if (seen.contain && !seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('ok'));
    const includes = codeshift.callExpression(codeshift.identifier('includes'), [dest]);
    includes.callee = codeshift.memberExpression(source, codeshift.identifier('includes'));
    call.arguments = [includes];
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.not.contain:
  if (seen.contain && seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('notOk'));
    const includes = codeshift.callExpression(codeshift.identifier('includes'), [dest]);
    includes.callee = codeshift.memberExpression(source, codeshift.identifier('includes'));
    call.arguments = [includes];
    return { parent: pathway.parentPath.parentPath.parentPath.parentPath, result: call };
  }


  // if it's a to.include:
  if (seen.endWith && !seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('match'));
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }


  // if it's a to.not.equal:
  if (seen.equal && seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('notEqual'), [
      codeshift.identifier('t'),
      source,
      dest
    ]);
    return { parent: pathway.parentPath.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.be.an / to.be.a:
  if (seen.be && (seen.an || seen.a) && !seen.not) {
    // .to.be.an."type"();
    const type = pathway.parentPath.parentPath.parentPath.parentPath.value.property.name;
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, codeshift.literal(type)]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('isA'));
    return { parent: pathway.parentPath.parentPath.parentPath.parentPath.parentPath, result: call };
  }
  // todo: not sure this works yet:
  // if it's a to.not.be.an / to.not.be.a:
  if (seen.be && (seen.an || seen.a) && seen.not) {
    // .to.be.an."type"();
    const type = pathway.parentPath.parentPath.parentPath.parentPath.value.property.name;
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, codeshift.literal(type)]);
    // these need to be t.notOk(typeof source !== type):
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('notOk'));
    return { parent: pathway.parentPath.parentPath.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.exist:
  if (seen.to && seen.exist && !seen.not) {
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, codeshift.identifier('undefined')]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('notEqual'));
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.not.exist:
  if (seen.to && seen.exist && seen.not) {
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, codeshift.identifier('undefined')]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('equal'));
    return { parent: pathway.parentPath.parentPath.parentPath.parentPath, result: call };
  }
  return {};
};
