const { getAstFromFilePath, writeToFile } = require('./lib/utilities.js');
// rules to converts hapi < 17 to hapi 17:
const hapiRules = require('./rules/hapiRules.js');
// rules to convert lab tests to tap tests:
const labRules = require('./rules/labRules.js');

const convertFile = (ast, ruleset) => {
  Object.values(ruleset).forEach(rule => {
    rule(ast);
  });
};

const argv = require('yargs')
.options({
  input: {
    alias: 'i',
    describe: 'path to input file',
  },
})
.options({
  output: {
    alias: 'o',
    describe: 'path to output file. if not set output will be logged to console',
    default: false
  },
})
.options({
  ruleset: {
    alias: 'r',
    describe: 'which transformation ruleset to apply',
    choices: ['labToTap', 'hapi17', 'all'],
    default: 'all'
  },
})

// future features:
/*
.options({
  test: {
    alias: 't',
    describe: 'a command that will be executed on the output file after conversion, eg --test=tap',
    default: false
  },
})
.options({
  project: {
    alias: 'p',
    describe: 'when set will attempt to transform all files in the indicated directory',
    default: false
  },
})
.options({
  rule: {
    describe: 'the name of a rule from the ruleset to apply. by default will apply all of them',
    default: false
  },
})

*/
.help()
.argv;

// parse and apply transformation rules:
const ast = getAstFromFilePath(argv.input);
if (argv.ruleset === 'hapi17' || argv.ruleset === 'all') {
  convertFile(ast, hapiRules)
}
if (argv.ruleset === 'labToTap' || argv.ruleset === 'all') {
  convertFile(ast, labRules);
}

// convert back to text:
const result = ast.toSource({ quote: 'single' });

// print or write it out to file!
if (!argv.output) {
  console.log(result);
} else {
  writeToFile(argv.output, result);
}
