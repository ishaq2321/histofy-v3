/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const packageJson = require('../package.json');

const program = new Command();

// ASCII Art Banner
function showBanner() {
  console.log(
    chalk.cyan(
      figlet.textSync('Histofy v3', {
        font: 'Small',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      })
    )
  );
  console.log(chalk.gray(`Terminal-based GitHub history manipulation • v${packageJson.version}\n`));
}

// Configure CLI
program
  .name('histofy')
  .description('Terminal-based GitHub history manipulation tool')
  .version(packageJson.version)
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-banner', 'Disable ASCII banner');

// Basic commands for testing
program
  .command('init')
  .description('Initialize Histofy configuration')
  .action(async () => {
    console.log(chalk.green('✓ Histofy initialization (placeholder)'));
  });

program
  .command('status')
  .description('Show repository status')
  .action(async () => {
    console.log(chalk.blue('ℹ Repository status (placeholder)'));
  });

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str))
});

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
  process.exit(1);
});

// Parse arguments
try {
  program.parse(process.argv);
} catch (err) {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
}

// Show help if no arguments provided
if (process.argv.length === 2) {
  if (!program.opts().noBanner) {
    showBanner();
  }
  program.help();
}
