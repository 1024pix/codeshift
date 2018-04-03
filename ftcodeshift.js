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
.options({
  project: {
    alias: 'p',
    describe: 'when set to a path, will attempt to transform all files in the indicated directory',
    default: false
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
  rule: {
    describe: 'the name of a rule from the ruleset to apply. by default will apply all of them',
    default: false
  },
})

*/
.help()
.argv;

const applyRulesToFile = (input, ruleset, output) => {
  // parse and apply transformation rules:
  const ast = getAstFromFilePath(input);
  if (ruleset === 'hapi17' || ruleset === 'all') {
    convertFile(ast, hapiRules)
  }
  if (ruleset === 'labToTap' || ruleset === 'all') {
    convertFile(ast, labRules);
  }
  // convert back to text:
  const result = ast.toSource({ quote: 'single' });
  // print or write it out to file!
  if (!output) {
    console.log(result);
  } else {
    writeToFile(output, result);
  }
};

const path = require('path');
if (argv.project) {
  // get all files in the parent directory
  const files = require('fs').readdirSync(argv.project);
  files.forEach(file => {
    const inputPath = path.join(argv.project, file);
    const outputPath = path.join(argv.project, `migrated.${file}`);
    try {
      applyRulesToFile(inputPath, argv.ruleset, outputPath);
    } catch (e) {
      console.log(`couldn't process ${inputPath}`);
    }
  });
  // apply rules to each one and write out with appelation
} else {
  applyRulesToFile(argv.input, argv.ruleset, argv.output);
}
