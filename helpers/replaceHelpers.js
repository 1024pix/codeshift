// contains helpers that assist with transforming sub-trees into other sub-trees
const { getFunctionNameFromFunctionExpression } = require('./getHelpers');

const types = require('ast-types');
const codeshift = require('jscodeshift');

function replaceServerInject(p) {
  // get name:
  const param = p.value.arguments[1].params[0].name;
  const call = codeshift.callExpression(codeshift.identifier('inject'), [p.value.arguments[0]]);
  const awaitExpr = codeshift.awaitExpression(call);
  const response = codeshift.variableDeclaration(
    'const',
    [codeshift.variableDeclarator(codeshift.identifier(param), awaitExpr)]
  );
  // get the body of the inject callback and put it back after the await expr:
  const callback = p.value.arguments[1];
  const oldBody = callback.body;
  p.parentPath.replace(response);
  oldBody.body.reverse();
  oldBody.body.forEach(expr => {
    p.parentPath.insertAfter(expr);
  });
}

// remove a parent return statement
// useful when nuking function calls in 'return func();' form
function removeReturnParent(func) {
  // if the parent is a return statement nuke it too:
  if (func.parentPath.value.type === 'ReturnStatement') {
    func.prune();
  }
}

// return a callback function transformed into await notation:
// eg func1(done) { myFunc(1234, done); } ----> await myFunc(1234);
function replaceCallbackWithAwait(pathway) {
  const newArgs = [];
  const func = pathway.value ? pathway.value : pathway;
  func.arguments.forEach((arg, index) => {
    if (index < func.arguments.length - 1) {
      newArgs.push(arg);
    }
  });
  const methodName = func.callee.type === 'MemberExpression' ? func.callee.property.name : func.callee.name;
  const call = codeshift.callExpression(codeshift.identifier(methodName), newArgs);
  if (func.callee) {
    call.callee = func.callee;
  }
  return codeshift.awaitExpression(call);
}

// assign a variable to a callback function with await notation
// eg func1(done) { myFunc(1234, done); } ----> const func1 = await myFunc(1234);
function replaceCallbackWithAssignment(pathway, varType, varName) {
  const awaitExpr = replaceCallbackWithAwait(pathway);
  const varAssign = codeshift.variableDeclaration(
    varType,
    [codeshift.variableDeclarator(codeshift.identifier(varName), awaitExpr)]
  );
  return varAssign;
}

// replace a code.expect statement:
function replaceCodeExpect(pathway) {
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
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('equal'));
    return { parent: pathway.parentPath.parentPath.parentPath, result: call };
  }
  // if it's a to.not.equal:
  if (seen.equal && seen.not) {
    const dest = pathway.parentPath.parentPath.parentPath.parentPath.value.arguments[0];
    const call = codeshift.callExpression(codeshift.identifier('t'), [source, dest]);
    call.callee = codeshift.memberExpression(codeshift.identifier('t'), codeshift.identifier('notEqual'));
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
}

// export everything:
module.exports = {
  replaceCallbackWithAwait,
  replaceCallbackWithAssignment,
  removeReturnParent,
  replaceCodeExpect,
  replaceServerInject
};
