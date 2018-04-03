// remove a parent return statement
// useful when nuking function calls in 'return func();' form
module.exports = function removeReturnParent(func) {
  // if the parent is a return statement nuke it too:
  if (func.parentPath.value.type === 'ReturnStatement') {
    func.prune();
  }
};
