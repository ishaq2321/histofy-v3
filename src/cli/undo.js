/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Undo CLI - Undo and manage operation history
 */

const { Command } = require('commander');
const OperationHistory = require('../utils/OperationHistory');
const { FeedbackUtils } = require('../utils/feedback');
const { ProgressUtils } = require('../utils/progress');
const chalk = require('chalk');
const inquirer = require('inquirer');
const moment = require('moment');

const undoCommand = new Command('undo');

undoCommand
  .description('Undo Histofy operations and manage operation history')
  .option('--dry-run', 'Preview what would be undone without executing')
  .option('--force', 'Force undo even if safety checks fail')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      await handleUndoCommand(options);
    } catch (error) {
      FeedbackUtils.error('Undo failed', error.message);
      process.exit(1);
    }
  });

// Subcommands
undoCommand
  .command('last [count]')
  .description('Undo the last N operations (default: 1)')
  .option('--dry-run', 'Preview what would be undone')
  .option('--force', 'Force undo even if safety checks fail')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (count, options) => {
    try {
      await handleUndoLastCommand(parseInt(count) || 1, options);
    } catch (error) {
      FeedbackUtils.error('Undo last failed', error.message);
      process.exit(1);
    }
  });

undoCommand
  .command('operation <operationId>')
  .description('Undo a specific operation by ID')
  .option('--dry-run', 'Preview what would be undone')
  .option('--force', 'Force undo even if safety checks fail')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (operationId, options) => {
    try {
      await handleUndoOperationCommand(operationId, options);
    } catch (error) {
      FeedbackUtils.error('Undo operation failed', error.message);
      process.exit(1);
    }
  });

undoCommand
  .command('history')
  .description('View operation history')
  .option('-l, --limit <number>', 'Number of entries to show', '20')
  .option('-t, --type <type>', 'Filter by operation type')
  .option('--since <date>', 'Show operations since date (YYYY-MM-DD)')
  .option('--until <date>', 'Show operations until date (YYYY-MM-DD)')
  .option('--undoable-only', 'Show only undoable operations')
  .option('--format <format>', 'Output format (table|json|csv)', 'table')
  .option('-o, --output <file>', 'Save to file')
  .action(async (options) => {
    try {
      await handleHistoryCommand(options);
    } catch (error) {
      FeedbackUtils.error('History command failed', error.message);
      process.exit(1);
    }
  });

undoCommand
  .command('clear')
  .description('Clear operation history')
  .option('--older-than <date>', 'Clear operations older than date (YYYY-MM-DD)')
  .option('--type <type>', 'Clear operations of specific type')
  .option('--keep-backups', 'Keep backup files when clearing history')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      await handleClearCommand(options);
    } catch (error) {
      FeedbackUtils.error('Clear history failed', error.message);
      process.exit(1);
    }
  });

undoCommand
  .command('export <file>')
  .description('Export operation history to file')
  .option('--format <format>', 'Export format (json|csv)', 'json')
  .option('--include-backups', 'Include backup information')
  .action(async (file, options) => {
    try {
      await handleExportCommand(file, options);
    } catch (error) {
      FeedbackUtils.error('Export failed', error.message);
      process.exit(1);
    }
  });

/**
 * Handle main undo command (interactive mode)
 */
async function handleUndoCommand(options) {
  const operationHistory = new OperationHistory();
  
  console.log(chalk.cyan('🔄 Interactive Undo Mode\n'));
  
  // Get recent undoable operations
  const recentOps = await operationHistory.getHistory({ 
    limit: 10, 
    undoableOnly: true 
  });
  
  if (recentOps.length === 0) {
    FeedbackUtils.info('No undoable operations found');
    return { success: true, message: 'No operations to undo' };
  }
  
  // Display recent operations
  console.log(chalk.bold('Recent Undoable Operations:\n'));
  recentOps.forEach((op, index) => {
    const timeAgo = moment(op.timestamp).fromNow();
    const status = op.status === 'undone' ? chalk.gray('(undone)') : '';
    console.log(`  ${index + 1}. ${chalk.cyan(op.description)} ${status}`);
    console.log(`     ${chalk.gray(`${op.type} • ${timeAgo} • ${op.id}`)}`);
    console.log();
  });
  
  // Interactive selection
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Undo last operation', value: 'last' },
        { name: 'Select specific operation to undo', value: 'select' },
        { name: 'View full history', value: 'history' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);
  
  switch (answers.action) {
    case 'last':
      return await handleUndoLastCommand(1, options);
    
    case 'select':
      const selectAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'operationId',
          message: 'Select operation to undo:',
          choices: recentOps.map(op => ({
            name: `${op.description} (${moment(op.timestamp).fromNow()})`,
            value: op.id
          }))
        }
      ]);
      return await handleUndoOperationCommand(selectAnswers.operationId, options);
    
    case 'history':
      return await handleHistoryCommand({ format: 'table', limit: '20' });
    
    case 'cancel':
      FeedbackUtils.info('Undo cancelled');
      return { success: true, message: 'Undo cancelled' };
  }
}

/**
 * Handle undo last command
 */
async function handleUndoLastCommand(count, options) {
  const operationHistory = new OperationHistory();
  
  // Get operations to undo
  const operations = await operationHistory.getHistory({ 
    limit: count, 
    undoableOnly: true 
  });
  
  if (operations.length === 0) {
    FeedbackUtils.warn('No undoable operations found');
    return { success: false, message: 'No operations to undo' };
  }
  
  if (operations.length < count) {
    FeedbackUtils.warn(`Only ${operations.length} undoable operations available, requested ${count}`);
  }
  
  // Display what will be undone
  console.log(chalk.cyan(`\n🔄 Undoing Last ${Math.min(count, operations.length)} Operation(s)\n`));
  
  operations.forEach((op, index) => {
    const timeAgo = moment(op.timestamp).fromNow();
    console.log(`  ${index + 1}. ${chalk.yellow(op.description)}`);
    console.log(`     ${chalk.gray(`${op.type} • ${timeAgo} • ${op.id}`)}`);
  });
  
  // Safety checks
  console.log(chalk.blue('\n🔍 Running safety checks...\n'));
  const safetyResults = [];
  
  for (const op of operations) {
    const safetyCheck = await operationHistory.checkUndoSafety(op);
    safetyResults.push({ operation: op, safety: safetyCheck });
    
    const icon = safetyCheck.safe ? '✅' : '⚠️';
    const color = safetyCheck.safe ? 'green' : 'yellow';
    console.log(`  ${icon} ${chalk[color](op.description)}`);
    if (!safetyCheck.safe) {
      console.log(`     ${chalk.red(safetyCheck.reason)}`);
    }
  }
  
  const unsafeOperations = safetyResults.filter(r => !r.safety.safe);
  
  if (unsafeOperations.length > 0 && !options.force) {
    console.log(chalk.red(`\n⚠️  ${unsafeOperations.length} operation(s) failed safety checks.`));
    console.log(chalk.gray('Use --force to override safety checks.'));
    return { success: false, message: 'Safety checks failed' };
  }
  
  // Confirmation
  if (!options.yes && !options.dryRun) {
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: `Are you sure you want to undo ${operations.length} operation(s)?`,
        default: false
      }
    ]);
    
    if (!confirm.proceed) {
      FeedbackUtils.info('Undo cancelled');
      return { success: true, message: 'Undo cancelled' };
    }
  }
  
  // Perform undo
  const result = await operationHistory.undoLast(Math.min(count, operations.length), {
    force: options.force,
    dryRun: options.dryRun
  });
  
  if (options.dryRun) {
    console.log(chalk.cyan('\n🔍 DRY RUN COMPLETED\n'));
    console.log(chalk.gray('No changes were made. Remove --dry-run to execute.'));
  } else {
    if (result.success) {
      FeedbackUtils.success('Undo completed', `${result.successfulUndos}/${result.totalOperations} operations undone`);
    } else {
      FeedbackUtils.warn('Undo partially completed', `${result.successfulUndos}/${result.totalOperations} operations undone`);
    }
  }
  
  return result;
}

/**
 * Handle undo specific operation command
 */
async function handleUndoOperationCommand(operationId, options) {
  const operationHistory = new OperationHistory();
  
  // Get the operation
  const operation = await operationHistory.getOperation(operationId);
  if (!operation) {
    FeedbackUtils.error('Operation not found', `No operation found with ID: ${operationId}`);
    return { success: false, message: 'Operation not found' };
  }
  
  // Display operation details
  console.log(chalk.cyan('\n🔄 Undo Operation\n'));
  console.log(`  ${chalk.bold('Description:')} ${operation.description}`);
  console.log(`  ${chalk.bold('Type:')} ${operation.type}`);
  console.log(`  ${chalk.bold('Timestamp:')} ${moment(operation.timestamp).format('YYYY-MM-DD HH:mm:ss')} (${moment(operation.timestamp).fromNow()})`);
  console.log(`  ${chalk.bold('Status:')} ${operation.status}`);
  console.log(`  ${chalk.bold('Undoable:')} ${operation.undoable ? 'Yes' : 'No'}`);
  console.log(`  ${chalk.bold('ID:')} ${operation.id}`);
  
  if (!operation.undoable) {
    FeedbackUtils.error('Operation not undoable', 'This operation cannot be undone');
    return { success: false, message: 'Operation not undoable' };
  }
  
  if (operation.status === 'undone') {
    FeedbackUtils.warn('Already undone', 'This operation has already been undone');
    return { success: false, message: 'Operation already undone' };
  }
  
  // Safety check
  console.log(chalk.blue('\n🔍 Running safety check...\n'));
  const safetyCheck = await operationHistory.checkUndoSafety(operation);
  
  const icon = safetyCheck.safe ? '✅' : '⚠️';
  const color = safetyCheck.safe ? 'green' : 'yellow';
  console.log(`  ${icon} ${chalk[color]('Safety Check')}`);
  
  if (!safetyCheck.safe) {
    console.log(`     ${chalk.red(safetyCheck.reason)}`);
    if (!options.force) {
      console.log(chalk.gray('\nUse --force to override safety checks.'));
      return { success: false, message: 'Safety check failed' };
    }
  }
  
  // Confirmation
  if (!options.yes && !options.dryRun) {
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Are you sure you want to undo this operation?',
        default: false
      }
    ]);
    
    if (!confirm.proceed) {
      FeedbackUtils.info('Undo cancelled');
      return { success: true, message: 'Undo cancelled' };
    }
  }
  
  // Perform undo
  const result = await operationHistory.undoOperation(operationId, {
    force: options.force,
    dryRun: options.dryRun
  });
  
  if (options.dryRun) {
    console.log(chalk.cyan('\n🔍 DRY RUN COMPLETED\n'));
    console.log(chalk.gray('No changes were made. Remove --dry-run to execute.'));
  } else {
    if (result.success) {
      FeedbackUtils.success('Operation undone successfully', operation.description);
    }
  }
  
  return result;
}

/**
 * Handle history command
 */
async function handleHistoryCommand(options) {
  const operationHistory = new OperationHistory();
  
  const historyOptions = {
    limit: parseInt(options.limit) || 20,
    type: options.type,
    since: options.since,
    until: options.until,
    undoableOnly: options.undoableOnly
  };
  
  const history = await operationHistory.getHistory(historyOptions);
  
  if (history.length === 0) {
    FeedbackUtils.info('No operations found matching the criteria');
    return { success: true, message: 'No operations found' };
  }
  
  if (options.output) {
    // Export to file
    await operationHistory.exportHistory(options.output, { format: options.format });
    FeedbackUtils.success('History exported', `Saved ${history.length} entries to ${options.output}`);
    return { success: true, message: 'History exported' };
  }
  
  // Display in console
  switch (options.format) {
    case 'table':
      displayHistoryTable(history);
      break;
    case 'json':
      console.log(JSON.stringify(history, null, 2));
      break;
    case 'csv':
      console.log(convertHistoryToCSV(history));
      break;
    default:
      FeedbackUtils.error('Invalid format', `Unsupported format: ${options.format}`);
      return { success: false, message: 'Invalid format' };
  }
  
  return { success: true, history };
}

/**
 * Handle clear command
 */
async function handleClearCommand(options) {
  const operationHistory = new OperationHistory();
  
  // Get current history for confirmation
  const currentHistory = await operationHistory.getHistory({ limit: 1000 });
  
  let affectedCount = currentHistory.length;
  if (options.olderThan) {
    const cutoffDate = new Date(options.olderThan);
    affectedCount = currentHistory.filter(entry => 
      new Date(entry.timestamp) < cutoffDate
    ).length;
  }
  if (options.type) {
    affectedCount = currentHistory.filter(entry => entry.type === options.type).length;
  }
  
  if (affectedCount === 0) {
    FeedbackUtils.info('No operations match the criteria');
    return { success: true, message: 'No operations to clear' };
  }
  
  // Confirmation
  if (!options.yes) {
    console.log(chalk.yellow(`\n⚠️  This will remove ${affectedCount} operation(s) from history.`));
    if (!options.keepBackups) {
      console.log(chalk.yellow('Associated backup files will also be deleted.'));
    }
    
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Are you sure you want to clear the operation history?',
        default: false
      }
    ]);
    
    if (!confirm.proceed) {
      FeedbackUtils.info('Clear cancelled');
      return { success: true, message: 'Clear cancelled' };
    }
  }
  
  // Perform clear
  const result = await operationHistory.clearHistory({
    olderThan: options.olderThan,
    type: options.type,
    keepBackups: options.keepBackups
  });
  
  FeedbackUtils.success('History cleared', `Removed ${result.removedCount} operations, ${result.remainingCount} remaining`);
  
  return result;
}

/**
 * Handle export command
 */
async function handleExportCommand(file, options) {
  const operationHistory = new OperationHistory();
  
  const result = await operationHistory.exportHistory(file, {
    format: options.format,
    includeBackups: options.includeBackups
  });
  
  FeedbackUtils.success('History exported', `${result.entriesExported} entries exported to ${file}`);
  
  return result;
}

/**
 * Display history in table format
 */
function displayHistoryTable(history) {
  const Table = require('cli-table3');
  
  console.log(chalk.cyan('\n📋 Operation History\n'));
  
  const table = new Table({
    head: ['ID', 'Time', 'Type', 'Description', 'Status'],
    colWidths: [12, 20, 12, 40, 10],
    wordWrap: true
  });
  
  history.forEach(entry => {
    const timeAgo = moment(entry.timestamp).fromNow();
    const status = entry.status === 'undone' ? chalk.gray('undone') : chalk.green('active');
    const description = entry.description.length > 35 ? 
      entry.description.substring(0, 32) + '...' : 
      entry.description;
    
    table.push([
      entry.id.substring(0, 10) + '...',
      timeAgo,
      entry.type,
      description,
      status
    ]);
  });
  
  console.log(table.toString());
  console.log(chalk.gray(`\nShowing ${history.length} operations. Use --limit to show more.`));
}

/**
 * Convert history to CSV format
 */
function convertHistoryToCSV(history) {
  if (history.length === 0) return '';
  
  const headers = ['ID', 'Timestamp', 'Type', 'Command', 'Description', 'Status', 'Undoable'];
  const rows = history.map(entry => [
    entry.id,
    entry.timestamp,
    entry.type,
    entry.command,
    entry.description,
    entry.status,
    entry.undoable
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

module.exports = undoCommand;