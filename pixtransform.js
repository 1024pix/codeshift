const { replaceReplyStub } = require('./rules/pixRules');
const codeshift = require('jscodeshift');

module.exports = function(fileInfo, api, options) {
  return replaceReplyStub(codeshift(fileInfo.source), fileInfo.source).toSource();
};
