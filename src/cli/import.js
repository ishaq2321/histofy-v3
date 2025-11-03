/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Import CLI - Data import functionality
 */

const { Command } = require('commander');
const DataImporter = require('../utils/DataImporter');
const { FeedbackUtils } = require('../utils/feedback');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs').promises;

const importCommand = new Command('import');

importCommand
  .description('Import data into Histofy from various formats')
  .argument('<file>', 'Input file to import')
  .option('-f, --format <format>', 'Input format (json|csv|xml|yaml)')
  .option('--validate', 'Validate data before import', true)
  .option('--no-validate', 'Skip data validation')
  .option('--transform', 'Transform data during import', true)
  .option('--no-transform', 'Skip data transformation')
  .option('--continue-on-error', 'Continue import despite validation errors')
  .option('--dry-run', 'Preview import without making changes')
  .action(async (file, options) => {
    try {
      await handleImportCommand(file, options);
    } catch (error) {
      FeedbackUtils.error('Import failed', error.message);
      process.exit(1);
    }
  });

// Subcommands
importCommand
  .command('commits <file>')
  .description('Import commit data for batch operations')
  .option('-f, --format <format>', 'Input format (json|csv|xml|yaml)')
  .option('--validate', 'Validate commit data', true)
  .option('--no-validate', 'Skip validation')
  .option('--transform', 'Transform data during import', true)
  .option('--no-transform', 'Skip transformation')
  .option('--continue-on-error', 'Continue despite validation errors')
  .option('--dry-run', 'Preview import without making changes')
  .action(async (file, options) => {
    try {
      await handleCommitImportCommand(file, options);
    } catch (error) {
      FeedbackUtils.error('Commit import failed', error.message);
      process.exit(1);
    }
  });

importCommand
  .command('history <file>')
  .description('Import operation history')
  .option('-f, --format <format>', 'Input format (json|csv|xml|yaml)')
  .option('--validate', 'Validate operation data', true)
  .option('--no-validate', 'Skip validation')
  .option('--merge', 'Merge with existing history', false)
  .option('--replace', 'Replace existing history')
  .option('--dry-run', 'Preview import without making changes')
  .action(async (file, options) => {
    try {
      await handleHistoryImportCommand(file, options);
    } catch (error) {
      FeedbackUtils.error('History import failed', error.message);
      process.exit(1);
    }
  });

importCommand
  .command('config <file>')
  .description('Import configuration data')
  .option('-f, --format <format>', 'Input format (json|csv|xml|yaml)')
  .option('--merge', 'Merge with existing configuration', true)
  .option('--replace', 'Replace existing configuration')
  .option('--backup', 'Create backup before import', true)
  .option('--no-backup', 'Skip backup creation')
  .option('--dry-run', 'Preview import without making changes')
  .action(async (file, options) => {
    try {
      await handleConfigImportCommand(file, options);
    } catch (error) {
      FeedbackUtils.error('Config import failed', error.message);
      process.exit(1);
    }
  });

/**
 * Handle main import command (auto-detect type)
 */
async function handleImportCommand(file, options) {
  console.log(chalk.cyan('📥 Auto-detecting Import Type\n'));
  
  // Check if file exists
  try {
    await fs.access(file);
  } catch (error) {
    throw new Error(`File not found: ${file}`);
  }

  const dataImporter = new DataImporter();
  
  // Try to detect data type by reading a sample
  const format = options.format || dataImporter.detectFileFormat(file);
  const sampleData = await dataImporter.readFile(file, format);
  
  const dataType = detectDataType(sampleData);
  
  console.log(`Detected data type: ${chalk.yellow(dataType)}`);
  console.log(`Detected format: ${chalk.yellow(format.toUpperCase())}\n`);
  
  // Confirm with user
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: `Import as ${dataType} data?`,
      default: true
    }
  ]);
  
  if (!answers.proceed) {
    FeedbackUtils.info('Import cancelled');
    return { success: true, cancelled: true };
  }
  
  // Route to appropriate handler
  switch (dataType) {
    case 'commits':
      return await handleCommitImportCommand(file, options);
    case 'history':
      return await handleHistoryImportCommand(file, options);
    case 'config':
      return await handleConfigImportCommand(file, options);
    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }
}

/**
 * Handle commit import command
 */
async function handleCommitImportCommand(file, options) {
  const dataImporter = new DataImporter();
  
  console.log(chalk.cyan('📥 Importing Commit Data\n'));
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be made\n'));
  }

  // Display import configuration
  console.log(chalk.bold('Import Configuration:'));
  console.log(`  ${chalk.gray('Input File:')} ${file}`);
  console.log(`  ${chalk.gray('Format:')} ${options.format || 'auto-detect'}`);
  console.log(`  ${chalk.gray('Validation:')} ${options.validate ? 'enabled' : 'disabled'}`);
  console.log(`  ${chalk.gray('Transformation:')} ${options.transform ? 'enabled' : 'disabled'}`);
  console.log(`  ${chalk.gray('Continue on Error:')} ${options.continueOnError ? 'yes' : 'no'}`);
  console.log();

  const result = await dataImporter.importCommitData(file, {
    format: options.format,
    validate: options.validate,
    transform: options.transform,
    dryRun: options.dryRun,
    continueOnError: options.continueOnError
  });

  displayImportResult(result, 'commits');
  
  if (result.success && !options.dryRun && result.validCommits > 0) {
    console.log(chalk.blue('\n💡 Next Steps:'));
    console.log(chalk.gray('  Use the batch command to create commits from this data:'));
    console.log(chalk.gray(`  histofy batch commit --input ${file}`));
  }

  return result;
}

/**
 * Handle history import command
 */
async function handleHistoryImportCommand(file, options) {
  const dataImporter = new DataImporter();
  
  console.log(chalk.cyan('📥 Importing Operation History\n'));
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be made\n'));
  }

  // Warn about replacing history
  if (options.replace && !options.dryRun) {
    console.log(chalk.yellow('⚠️  Warning: This will replace your existing operation history'));
    
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Are you sure you want to replace existing history?',
        default: false
      }
    ]);
    
    if (!confirm.proceed) {
      FeedbackUtils.info('Import cancelled');
      return { success: true, cancelled: true };
    }
  }

  const result = await dataImporter.importOperationHistory(file, {
    format: options.format,
    validate: options.validate,
    merge: options.merge || !options.replace,
    dryRun: options.dryRun
  });

  displayImportResult(result, 'operations');
  return result;
}

/**
 * Handle config import command
 */
async function handleConfigImportCommand(file, options) {
  const dataImporter = new DataImporter();
  
  console.log(chalk.cyan('📥 Importing Configuration\n'));
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be made\n'));
  }

  // Warn about replacing configuration
  if (options.replace && !options.dryRun) {
    console.log(chalk.yellow('⚠️  Warning: This will replace your existing configuration'));
    
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Are you sure you want to replace existing configuration?',
        default: false
      }
    ]);
    
    if (!confirm.proceed) {
      FeedbackUtils.info('Import cancelled');
      return { success: true, cancelled: true };
    }
  }

  const result = await dataImporter.importConfiguration(file, {
    format: options.format,
    merge: options.merge || !options.replace,
    backup: options.backup,
    dryRun: options.dryRun
  });

  displayImportResult(result, 'configuration');
  
  if (result.success && !options.dryRun) {
    console.log(chalk.blue('\n💡 Configuration imported successfully'));
    console.log(chalk.gray('  Restart Histofy to apply all changes'));
  }

  return result;
}

/**
 * Detect data type from sample data
 */
function detectDataType(data) {
  // Check for commits
  if (data.commits || (Array.isArray(data) && data.length > 0 && data[0].message)) {
    return 'commits';
  }
  
  // Check for operations
  if (data.operations || (Array.isArray(data) && data.length > 0 && data[0].type && data[0].description)) {
    return 'history';
  }
  
  // Check for configuration
  if (data.configuration || (data.git || data.github || data.ui)) {
    return 'config';
  }
  
  // Default to commits if uncertain
  return 'commits';
}

/**
 * Display import result
 */
function displayImportResult(result, dataType) {
  if (result.success) {
    console.log(chalk.green('\n✅ Import completed successfully!\n'));
    
    console.log(chalk.bold('Import Summary:'));
    console.log(`  ${chalk.gray('File:')} ${result.inputFile}`);
    console.log(`  ${chalk.gray('Format:')} ${result.format.toUpperCase()}`);
    
    if (result.totalCommits !== undefined) {
      console.log(`  ${chalk.gray('Total Commits:')} ${result.totalCommits}`);
      console.log(`  ${chalk.gray('Valid Commits:')} ${chalk.green(result.validCommits)}`);
      if (result.invalidCommits > 0) {
        console.log(`  ${chalk.gray('Invalid Commits:')} ${chalk.red(result.invalidCommits)}`);
      }
    }
    
    if (result.totalOperations !== undefined) {
      console.log(`  ${chalk.gray('Total Operations:')} ${result.totalOperations}`);
      console.log(`  ${chalk.gray('Valid Operations:')} ${chalk.green(result.validOperations)}`);
      if (result.invalidOperations > 0) {
        console.log(`  ${chalk.gray('Invalid Operations:')} ${chalk.red(result.invalidOperations)}`);
      }
    }
    
    if (result.configKeys !== undefined) {
      console.log(`  ${chalk.gray('Configuration Keys:')} ${result.configKeys}`);
    }
    
    // Display validation errors if any
    if (result.validation && result.validation.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️  Validation Issues:'));
      result.validation.errors.slice(0, 5).forEach(error => {
        console.log(`  ${chalk.red('•')} ${error.commit || error.operation}: ${error.errors.join(', ')}`);
      });
      
      if (result.validation.errors.length > 5) {
        console.log(`  ${chalk.gray(`... and ${result.validation.errors.length - 5} more issues`)}`);
      }
    }
    
    // Display warnings if any
    if (result.validation && result.validation.warnings.length > 0) {
      console.log(chalk.yellow('\n💡 Warnings:'));
      result.validation.warnings.forEach(warning => {
        console.log(`  ${chalk.yellow('•')} ${warning}`);
      });
    }
    
    if (result.dryRun) {
      console.log(chalk.cyan('\n🔍 DRY RUN COMPLETED'));
      console.log(chalk.gray('No changes were made. Remove --dry-run to execute the import.'));
    } else {
      FeedbackUtils.success('Import completed', `${dataType} data imported successfully`);
    }
  } else {
    console.log(chalk.red('\n❌ Import failed\n'));
    
    if (result.validation && result.validation.errors.length > 0) {
      console.log(chalk.red('Validation Errors:'));
      result.validation.errors.forEach(error => {
        console.log(`  ${chalk.red('•')} ${error.commit || error.operation}: ${error.errors.join(', ')}`);
      });
    }
  }
}

module.exports = importCommand;