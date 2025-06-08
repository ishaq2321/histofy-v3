#!/usr/bin/env node

console.log('Testing CLI...');

const { Command } = require('commander');
const chalk = require('chalk');

const program = new Command();

program
  .name('histofy')
  .description('Test CLI')
  .version('3.0.0');

program
  .command('test')
  .description('Test command')
  .action(() => {
    console.log(chalk.green('Test command works!'));
  });

program.parse(process.argv);

if (process.argv.length === 2) {
  console.log(chalk.cyan('Histofy v3 Test'));
  program.help();
}
