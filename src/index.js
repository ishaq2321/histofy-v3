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

// Configure program
program
  .name('histofy')
  .description('Terminal-based GitHub history manipulation tool')
  .version(packageJson.version)
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-banner', 'Disable ASCII banner');

// Import and setup command handlers with error handling
function setupCommands() {
  try {
    // Commit command
    program
      .command('commit')
      .description('Create commits with custom dates')
      .argument('[message]', 'Commit message')
      .option('-d, --date <date>', 'Custom date (YYYY-MM-DD)')
      .option('-t, --time <time>', 'Custom time (HH:MM)')
      .option('-a, --add-all', 'Add all changes before committing')
      .option('--author <author>', 'Custom author (Name <email>)')
      .option('--push', 'Push after committing')
      .action(async (message, options) => {
        try {
          const commitCommand = require('./cli/commit');
          await commitCommand(message, options);
        } catch (error) {
          console.error(chalk.red('Error in commit command:'), error.message);
          process.exit(1);
        }
      });

    // Status command
    program
      .command('status')
      .description('Show repository status')
      .option('-r, --remote', 'Include remote information')
      .action(async (options) => {
        try {
          const statusCommand = require('./cli/status');
          await statusCommand(options);
        } catch (error) {
          console.error(chalk.red('Error in status command:'), error.message);
          process.exit(1);
        }
      });

    // Config command
    program
      .command('config')
      .description('Manage configuration')
      .argument('[action]', 'Configuration action (init, set, get, list)')
      .argument('[key]', 'Configuration key')
      .argument('[value]', 'Configuration value')
      .action(async (action, key, value) => {
        try {
          const configCommand = require('./cli/config');
          
          // Handle different config actions
          switch (action) {
            case 'init':
              await configCommand.init();
              break;
            case 'set':
              if (!key) {
                console.error(chalk.red('Error: Key is required for set action'));
                process.exit(1);
              }
              await configCommand.set(key, value);
              break;
            case 'get':
              if (!key) {
                console.error(chalk.red('Error: Key is required for get action'));
                process.exit(1);
              }
              await configCommand.get(key);
              break;
            case 'list':
            default:
              await configCommand.list();
              break;
          }
        } catch (error) {
          console.error(chalk.red('Error in config command:'), error.message);
          process.exit(1);
        }
      });

    // Deploy command
    program
      .command('deploy')
      .description('Deploy contribution patterns')
      .option('-f, --file <file>', 'Pattern configuration file')
      .option('-r, --repo <repo>', 'Target repository (username/repo)')
      .option('-p, --pattern <pattern>', 'Predefined pattern name')
      .option('--dry-run', 'Show what would be deployed without executing')
      .option('--force', 'Force deployment even if repository has commits')
      .action(async (options) => {
        try {
          const deployCommand = require('./cli/deploy');
          await deployCommand(options);
        } catch (error) {
          console.error(chalk.red('Error in deploy command:'), error.message);
          process.exit(1);
        }
      });

    // Migrate command
    program
      .command('migrate')
      .description('Migrate existing commits to new dates')
      .argument('<range>', 'Commit hash or range (e.g., abc123 or HEAD~5..HEAD)')
      .option('-d, --to-date <date>', 'Target date (YYYY-MM-DD)')
      .option('-s, --spread <days>', 'Spread commits over N days', '1')
      .option('-t, --start-time <time>', 'Start time for first commit', '09:00')
      .option('--preserve-order', 'Preserve original commit order')
      .option('--execute', 'Execute the migration automatically (default: plan only)')
      .action(async (range, options) => {
        try {
          const migrateCommand = require('./cli/migrate');
          await migrateCommand(range, options);
        } catch (error) {
          console.error(chalk.red('Error in migrate command:'), error.message);
          process.exit(1);
        }
      });

    // Pattern command
    program
      .command('pattern')
      .description('Manage contribution patterns')
      .argument('<action>', 'Pattern action (list, create, edit, preview, delete)')
      .argument('[name]', 'Pattern name')
      .option('--template <template>', 'Template to use for creation')
      .option('--year <year>', 'Year for preview')
      .action(async (action, name, options) => {
        try {
          const patternCommand = require('./cli/pattern');
          
          // Handle different pattern actions
          switch (action) {
            case 'list':
              await patternCommand.list();
              break;
            case 'create':
              if (!name) {
                console.error(chalk.red('Error: Pattern name is required for create action'));
                process.exit(1);
              }
              await patternCommand.create(name, options);
              break;
            case 'edit':
              if (!name) {
                console.error(chalk.red('Error: Pattern name is required for edit action'));
                process.exit(1);
              }
              await patternCommand.edit(name);
              break;
            case 'preview':
              if (!name) {
                console.error(chalk.red('Error: Pattern name is required for preview action'));
                process.exit(1);
              }
              await patternCommand.preview(name, options);
              break;
            case 'delete':
              if (!name) {
                console.error(chalk.red('Error: Pattern name is required for delete action'));
                process.exit(1);
              }
              await patternCommand.delete(name);
              break;
            default:
              console.error(chalk.red(`Error: Unknown action "${action}"`));
              console.log(chalk.gray('Available actions: list, create, edit, preview, delete'));
              process.exit(1);
          }
        } catch (error) {
          console.error(chalk.red('Error in pattern command:'), error.message);
          process.exit(1);
        }
      });

  } catch (error) {
    console.error(chalk.red('Error setting up commands:'), error.message);
    // Continue with basic functionality
  }
}

// Setup commands
setupCommands();

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str))
});

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
  process.exit(1);
});

// Show banner and help if no arguments provided
if (process.argv.length === 2) {
  if (!program.opts().noBanner) {
    showBanner();
  }
  program.help();
} else if (!program.opts().noBanner && process.argv.length > 2) {
  showBanner();
}

// Parse arguments
try {
  program.parse(process.argv);
} catch (err) {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
}
