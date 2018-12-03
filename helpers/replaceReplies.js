const types = require('ast-types');
const codeshift = require('jscodeshift');

module.exports = (p) => {
  const replies = {};
  types.visit(p, {
    visitCallExpression(reply) {
      // replace reply(var1) -----> return var1;
      const callee = reply.value.callee;
      if (callee.name === 'reply' && callee.type === 'Identifier') {
        replies.reply = reply;
        return this.traverse(reply);
      }
      if (reply.value.callee.property) {
        if (reply.value.callee.property.name === 'state') {
          replies.state = reply;
          return this.traverse(reply);
        }
        // replace reply.redirect:
        if (reply.value.callee.property.name === 'redirect') {
          replies.redirect = reply;
          return this.traverse(reply);
        }
      }
      // replace reply.state:
      return this.traverse(reply);
    }
  });
  // if it's just a reply and nothing else:
  if (Object.keys(replies).length === 1 && replies.reply) {
    const arg = replies.reply.value.arguments[0];
    replies.reply.parentPath.replace(codeshift.returnStatement(arg));
    return;
  }
  // otherwise we need to make an h.response() object and call things on it:
  const args = replies.reply ? replies.reply.value.arguments : [];
  // check if there is already a 'const response' below:
  let responseAlreadDeclared = false;
  types.visit(p, {
    visitVariableDeclaration(decl) {
      if (decl.value.declarations[0].id.name === 'response') {
        responseAlreadDeclared = true;
      }
      return this.traverse(decl);
    }
  });
  if (responseAlreadDeclared) {
    return;
  }
  // don't add anything if there is already a 'return' statement at the end of the handler:
  const lastExpression = p.value.value.body.body[p.value.value.body.body.length - 1];
  if (lastExpression.expression && lastExpression.expression.type === 'ReturnStatement') {
    return;
  }
  const call = codeshift.callExpression(codeshift.identifier('response'), args);
  call.callee = codeshift.memberExpression(codeshift.identifier('h'), codeshift.identifier('response'));
  const responseObj = codeshift.variableDeclaration(
    'const',
    [codeshift.variableDeclarator(codeshift.identifier('response'), call)]
  );
  // add 'const response = h.response(....)' to the top of the handler:
  p.value.value.body.body.unshift(responseObj);
  p.value.value.body.body.push(codeshift.returnStatement(codeshift.identifier('response')));
  if (replies.redirect) {
    replies.redirect.value.callee.object.name = 'response';
  }
  if (replies.state) {
    replies.state.value.callee.object.name = 'response';
  }
};
