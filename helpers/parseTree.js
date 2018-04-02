// helper to parse a bit of js code and return the relevant node:
const codeshift = require('jscodeshift');
module.exports = code => codeshift(code).__paths[0].value.program.body[0];
