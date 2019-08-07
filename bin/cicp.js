#!/usr/bin/env node

const program = require('commander');
const figlet = require('figlet');
const pkg = require('../package.json');

program
  .version(pkg.version)
  .description('CICP providing record/replay & autopilot mode');

program
  .option('-p, --port <port>', 'The port to listen to', parseInt);

program
  .option('-l, --listen', 'Begin to listen when launching');

program
  .option('-s, --silent', 'Disable all logs');

program
  .option('--no-color', 'Disable color in output message');

program
  .option('-f, --folder <folder>', 'The folder where to save session');

program
  .option('-o, --order <list>', 'A comma separated list on which order plugins should be proceded', 'autopilot,configLoader,recorder');

console.log(figlet.textSync('CICP', { font: 'Speed' })); // eslint-disable-line no-console

// Start the proxy
const { CICP } = require('../lib/index');

const cicp = new CICP();

const options = {
  mitm: {},
};

if (program.port) {
  options.mitm.port = program.port;
}
if (program.silent) {
  options.silent = program.silent;
}
options.colorize = program.color;
if (program.folder) {
  options.folder = program.folder;
}
if (program.order) {
  options.order = program.order.split(',');
}

// Init the proxy
cicp.setOptions(options);
cicp.init(() => {
  const newOptions = cicp.pluginsOptions();

  // Add new options
  newOptions.forEach((option) => {
    // TODO: Check if params exists
    // TODO: Maybe prefix command with short p and long plugin-
    program
      .option(`-p${option.command.short}, --plug-${option.command.long} ${option.command.parameters}`, option.description)
      .action((...args) => {
        const params = args;
        const currentCmd = `plug${option.command.long.charAt(0).toUpperCase()}${option.command.long.slice(1)}`;

        params.pop();
        params.unshift(program[currentCmd]);
        if (program[currentCmd] !== undefined) {
          option.callback(params);
        }
      });
  });

  program.parse(process.argv);

  if (program.listen) {
    cicp.listen();
  }
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
