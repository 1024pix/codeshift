const { getAstFromFilePath, getYamlFromFilePath, writeToFile, writeToYamlFile } = require('./lib/utilities.js');
// updates hapi-views config:
const migrateHapiViews = require('./lib/migrateHapiViews.js');
// rules to converts es6 to es7 (async/await):
const es7Rules = require('./rules/es7Rules.js');
// rules to converts es6 to es7 (async/await):
const cleanupRules = require('./rules/cleanupRules.js');
// rules to converts hapi < 17 to hapi 17:
const hapiRules = require('./rules/hapiRules.js');
// rules to convert lab tests to tap tests:
const labRules = require('./rules/labRules.js');
const path = require('path');
const fixTapRules = require('./rules/fixTap.js');

const convertFile = (ast, ruleset, source) => {
  Object.values(ruleset).forEach(rule => {
    rule(ast, source);
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
    choices: ['labToTap', 'hapi17', 'fixTap', 'es7', 'all'],
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
.options({
  hapiViews: {
    describe: 'when true, read the input file as a YAML hapi-views configuration and attempt to transform it',
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
*/
.help()
.argv;

const applyRulesToFile = (input, ruleset, output, custom) => {
  // parse and apply transformation rules:
  const { source, ast } = getAstFromFilePath(input);
  if (ruleset === 'es7' || ruleset === 'all') {
    convertFile(ast, es7Rules, source);
  }
  if (ruleset === 'hapi17' || ruleset === 'all') {
    convertFile(ast, hapiRules, source)
  }
  if (ruleset === 'labToTap') {
    convertFile(ast, labRules);
  }
  if (ruleset === 'fixTap') {
    convertFile(ast, fixTapRules);
  }
  convertFile(ast, cleanupRules);
  // convert back to text:
  let result = ast.toSource({ quote: 'single' });
  // clean output of any double-commas or other artifacts:
  result = result.split(';;').join(';');
  result = result.split(' ;').join('');
  // add any missing include statements to the top:

  // print or write it out to file!
  if (!output) {
    console.log(result);
  } else {
    writeToFile(output, result);
  }
};

// will update hapi-views to server.methods style
// assumes hapi-view options are in their own file:
if (argv.hapiViews) {
  let config = getYamlFromFilePath(argv.input);
  let plugins, views = false;
  if (config.plugins) {
    plugins = true;
    config = config.plugins['hapi-views'];
  }
  if (config['hapi-views']) {
    views = true;
    config = config['hapi-views'];
  }
  const result = migrateHapiViews(config);
  // todo: if you chop this you have to writ back to file with the same stuff:
  if (plugins) {
    writeToYamlFile(argv.output, {
      plugins: {
      'hapi-views': result
      }
    });
  } else {
    writeToYamlFile(argv.output, { 'hapi-views': result });
  }
  return;
}

// will transform an entire directory of files according to the ruleset:
if (argv.project) {
  // get all files in the parent directory
  const files = require('fs').readdirSync(argv.project);
  files.forEach(file => {
    if (file.startsWith('migrated.')) {
      return;
    }
    const inputPath = path.join(argv.project, file);
    const outputPath = path.join(argv.project, `migrated.${file}`);
    try {
      applyRulesToFile(inputPath, argv.ruleset, outputPath);
    } catch (e) {
      console.log(e);
      console.log(`couldn't process ${inputPath}`);
    }
  });
  return;
  // apply rules to each one and write out with appellation
}
// will transform a single file to the output file according to the ruleset:
applyRulesToFile(argv.input, argv.ruleset, argv.output, argv.custom);
