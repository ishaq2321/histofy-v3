#!/usr/bin/env node

/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const packageJson = require('../package.json');
const OperationManager = require('./core/OperationManager');

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
      .option('--dry-run', 'Preview what would be done without executing')
      .action(async (message, options) => {
        const result = await OperationManager.execute('commit', async (operationId) => {
          const commitCommand = require('./cli/commit');
          return await commitCommand(message, options);
        }, {
          repoPath: process.cwd(),
          command: 'commit',
          args: { message, options }
        });

        if (!result.success) {
          console.error(chalk.red('Error in commit command:'), result.error);
          console.error(chalk.gray('The repository has been restored to its previous state.'));
          return 1; // Return error code instead of process.exit(1)
        }
      });

    // Status command
    program
      .command('status')
      .description('Show repository status')
      .option('-r, --remote', 'Include remote information')
      .action(async (options) => {
        const result = await OperationManager.execute('status', async (operationId) => {
          const statusCommand = require('./cli/status');
          return await statusCommand(options);
        }, {
          command: 'status',
          args: { options }
        });

        if (!result.success) {
          console.error(chalk.red('Error in status command:'), result.error);
          return 1; // Return error code instead of process.exit(1)
        }
      });

    // Config command
    program
      .command('config')
      .description('Manage configuration')
      .argument('[action]', 'Configuration action (init, set, get, list)')
      .argument('[key]', 'Configuration key')
      .argument('[value]', 'Configuration value')
      .option('--dry-run', 'Preview configuration changes without applying them')
      .action(async (action, key, value, options) => {
        const result = await OperationManager.execute('config', async (operationId) => {
          const configCommand = require('./cli/config');
          
          // Handle different config actions
          switch (action) {
            case 'init':
              return await configCommand.init();
            case 'set':
              if (!key) {
                throw new Error('Key is required for set action');
              }
              return await configCommand.set(key, value, options);
            case 'get':
              if (!key) {
                throw new Error('Key is required for get action');
              }
              return await configCommand.get(key);
            case 'list':
            default:
              return await configCommand.list();
          }
        }, {
          command: 'config',
          args: { action, key, value, options }
        });

        if (!result.success) {
          console.error(chalk.red('Error in config command:'), result.error);
          return 1; // Return error code instead of process.exit(1)
        }
      });

    // Batch command
    program
      .command('batch')
      .description('Batch operations for multiple commits')
      .argument('<action>', 'Batch action (commit, template, import, export, validate)')
      .option('-i, --input <file>', 'Input data file (CSV or JSON)')
      .option('-o, --output <file>', 'Output file path')
      .option('-t, --template <file>', 'Commit template file')
      .option('--separator <char>', 'CSV separator character', ',')
      .option('--no-headers', 'CSV file has no headers')
      .option('--dry-run', 'Preview batch operations without executing')
      .option('--continue-on-error', 'Continue processing despite errors')
      .option('--concurrent <num>', 'Max concurrent operations', '1')
      .option('--validate-only', 'Only validate data without execution')
      .option('--preview', 'Show preview of first 5 commits')
      .option('-y, --yes', 'Skip confirmation prompts')
      .option('--create', 'Create new template (for template action)')
      .option('--validate', 'Validate template or data')
      .action(async (action, options) => {
        const result = await OperationManager.execute('batch', async (operationId) => {
          const batchCommand = require('./cli/batch');
          return await batchCommand(action, options);
        }, {
          command: 'batch',
          args: { action, options }
        });

        if (!result.success) {
          console.error(chalk.red('Error in batch command:'), result.error);
          return 1;
        }
      });

    // Analyze command
    program.addCommand(require('./cli/analyze'));

    // Undo command
    program.addCommand(require('./cli/undo'));

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
      .option('--auto-resolve <strategy>', 'Automatic conflict resolution strategy (theirs|ours)')
      .option('--no-backup', 'Skip creating backup before migration')
      .option('--no-rollback', 'Disable automatic rollback on failure')
      .option('--dry-run', 'Show detailed preview of what would be done without executing')
      .action(async (range, options) => {
        const result = await OperationManager.execute('migrate', async (operationId) => {
          const migrateCommand = require('./cli/migrate');
          return await migrateCommand(range, options);
        }, {
          repoPath: process.cwd(),
          command: 'migrate',
          args: { range, options }
        });

        if (!result.success) {
          console.error(chalk.red('Error in migrate command:'), result.error);
          console.error(chalk.gray('The repository has been restored to its previous state.'));
          return 1; // Return error code instead of process.exit(1)
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
  return 1; // Return error code instead of process.exit(1)
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
  return 1; // Return error code instead of process.exit(1)
}
