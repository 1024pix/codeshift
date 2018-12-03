// contains utilities that help with testing the rules and converting code
const yaml = require('js-yaml');
const codeshift = require('jscodeshift');
const fs = require('fs');
const path = require('path');

// turn a filepath into an AST tree:
function getAstFromFilePath(filepath) {
  const source = fs.readFileSync(filepath, 'utf-8');
  return { source, ast: codeshift(source) };
}

// turn a yaml file into a JSON object:
function getYamlFromFilePath(filepath) {
  // Get document, or throw exception on error
  try {
    return yaml.safeLoad(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.log(e);
  }
}

function writeToFile(filepath, text) {
  fs.writeFileSync(filepath, text);
}

function writeToYamlFile(filepath, obj) {
  fs.writeFileSync(filepath, yaml.safeDump(obj));
}

// used by testing:
const getTest = (fileName) => {
  const { source, ast } = getAstFromFilePath(path.join('tests', 'inputs', fileName));
  const expected = fs.readFileSync(path.join('tests', 'outputs', fileName)).toString('utf-8');
  return { ast, expected };
};

module.exports = { getAstFromFilePath, getTest, writeToFile, getYamlFromFilePath, writeToYamlFile };
