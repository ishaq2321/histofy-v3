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
const { enableProfiling, disableProfiling, getSummary } = require('./utils/PerformanceProfiler');
const HelpSystem = require('./utils/HelpSystem');

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
  .option('--no-banner', 'Disable ASCII banner')
  .option('--profile', 'Enable performance profiling')
  .option('--perf-summary', 'Show performance summary after operations');

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

    // Export command
    program.addCommand(require('./cli/export'));

    // Import command
    program.addCommand(require('./cli/import'));

    // Performance command
    program.addCommand(require('./cli/performance'));

    // Help command
    program.addCommand(require('./cli/help'));

    // Audit command
    program.addCommand(require('./cli/audit'));

    // API Server command
    program
      .command('server')
      .description('Start Histofy API server')
      .option('-p, --port <port>', 'Server port', '3000')
      .option('-h, --host <host>', 'Server host', 'localhost')
      .option('--api-key <key>', 'Custom API key')
      .action(async (options) => {
        const result = await OperationManager.execute('server', async (operationId) => {
          const { HistofyAPIServer } = require('./api/server');
          const server = new HistofyAPIServer({
            port: parseInt(options.port),
            host: options.host,
            apiKey: options.apiKey
          });
          
          console.log(chalk.blue('🚀 Starting Histofy API server...'));
          await server.start();
          
          // Keep the process running
          return new Promise(() => {
            // Server will run until interrupted
          });
        }, {
          command: 'server',
          args: { options }
        });

        if (!result.success) {
          console.error(chalk.red('Error starting API server:'), result.error);
          return 1;
        }
      });

    // Webhook command
    program
      .command('webhook')
      .description('Manage webhooks')
      .argument('<action>', 'Webhook action (register, unregister, list, test)')
      .argument('[id]', 'Webhook ID')
      .option('--url <url>', 'Webhook URL')
      .option('--events <events>', 'Comma-separated list of events')
      .option('--secret <secret>', 'Webhook secret')
      .option('--active', 'Set webhook as active')
      .option('--inactive', 'Set webhook as inactive')
      .action(async (action, id, options) => {
        const result = await OperationManager.execute('webhook', async (operationId) => {
          const { WebhookManager } = require('./api/webhook');
          const webhookManager = new WebhookManager();
          
          switch (action) {
            case 'register':
              if (!id || !options.url || !options.events) {
                throw new Error('ID, URL, and events are required for registration');
              }
              const webhook = webhookManager.registerWebhook(id, {
                url: options.url,
                events: options.events.split(','),
                active: !options.inactive,
                secret: options.secret
              });
              console.log(chalk.green('✅ Webhook registered:'), webhook.id);
              return webhook;
              
            case 'unregister':
              if (!id) {
                throw new Error('Webhook ID is required');
              }
              webhookManager.unregisterWebhook(id);
              console.log(chalk.green('✅ Webhook unregistered:'), id);
              return { unregistered: id };
              
            case 'list':
              const webhooks = webhookManager.listWebhooks();
              console.log(chalk.blue('📋 Registered webhooks:'));
              webhooks.forEach(wh => {
                console.log(`  ${wh.id}: ${wh.url} (${wh.active ? 'active' : 'inactive'})`);
              });
              return webhooks;
              
            case 'test':
              if (!id) {
                throw new Error('Webhook ID is required for testing');
              }
              const testResult = await webhookManager.testWebhook(id);
              if (testResult.success) {
                console.log(chalk.green('✅ Webhook test successful'));
              } else {
                console.log(chalk.red('❌ Webhook test failed:'), testResult.error);
              }
              return testResult;
              
            default:
              throw new Error(`Unknown webhook action: ${action}`);
          }
        }, {
          command: 'webhook',
          args: { action, id, options }
        });

        if (!result.success) {
          console.error(chalk.red('Error in webhook command:'), result.error);
          return 1;
        }
      });

    // Workflow command
    program
      .command('workflow')
      .description('Manage workflows')
      .argument('<action>', 'Workflow action (define, execute, list, delete)')
      .argument('[id]', 'Workflow ID')
      .option('-f, --file <file>', 'Workflow definition file')
      .option('-c, --context <context>', 'Execution context (JSON)')
      .action(async (action, id, options) => {
        const result = await OperationManager.execute('workflow', async (operationId) => {
          const { WorkflowEngine } = require('./api/workflow');
          const workflowEngine = new WorkflowEngine();
          
          switch (action) {
            case 'define':
              if (!id || !options.file) {
                throw new Error('Workflow ID and definition file are required');
              }
              const fs = require('fs');
              const definition = JSON.parse(fs.readFileSync(options.file, 'utf8'));
              const workflow = workflowEngine.defineWorkflow(id, definition);
              console.log(chalk.green('✅ Workflow defined:'), workflow.id);
              return workflow;
              
            case 'execute':
              if (!id) {
                throw new Error('Workflow ID is required');
              }
              const context = options.context ? JSON.parse(options.context) : {};
              console.log(chalk.blue('🔄 Executing workflow:'), id);
              const execution = await workflowEngine.executeWorkflow(id, context);
              console.log(chalk.green('✅ Workflow completed:'), execution.id);
              return execution;
              
            case 'list':
              const workflows = workflowEngine.listWorkflows();
              console.log(chalk.blue('📋 Defined workflows:'));
              workflows.forEach(wf => {
                console.log(`  ${wf.id}: ${wf.name} (${wf.enabled ? 'enabled' : 'disabled'})`);
              });
              return workflows;
              
            case 'delete':
              if (!id) {
                throw new Error('Workflow ID is required');
              }
              workflowEngine.deleteWorkflow(id);
              console.log(chalk.green('✅ Workflow deleted:'), id);
              return { deleted: id };
              
            default:
              throw new Error(`Unknown workflow action: ${action}`);
          }
        }, {
          command: 'workflow',
          args: { action, id, options }
        });

        if (!result.success) {
          console.error(chalk.red('Error in workflow command:'), result.error);
          return 1;
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
  // Enable profiling if requested
  const options = program.opts();
  if (options.profile) {
    enableProfiling();
    console.log(chalk.blue('📊 Performance profiling enabled'));
  }

  program.parse(process.argv);

  // Show performance summary if requested
  if (options.perfSummary || options.profile) {
    const summary = getSummary();
    if (summary.enabled) {
      console.log(chalk.blue('\\n📈 Performance Summary:'));
      console.log(`  Operations: ${summary.totalOperations}`);
      console.log(`  Average time: ${summary.averageTime}ms`);
      if (summary.slowestOperation) {
        console.log(`  Slowest: ${summary.slowestOperation.name} (${summary.slowestOperation.duration}ms)`);
      }
      console.log(`  Peak memory: ${summary.memoryPeak}`);
      console.log(`  Alerts: ${summary.alertCount}`);
      
      if (summary.recommendations.length > 0) {
        console.log(chalk.yellow('\\n💡 Recommendations:'));
        summary.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
      }
    }
    
    if (options.profile) {
      disableProfiling();
    }
  }
} catch (err) {
  console.error(chalk.red('Error:'), err.message);
  
  // Provide contextual help for the error
  const helpSystem = new HelpSystem();
  helpSystem.provideContextualHelp(err.message);
  
  return 1; // Return error code instead of process.exit(1)
}
