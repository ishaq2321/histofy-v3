/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Export CLI - Data export functionality
 */

const { Command } = require('commander');
const DataExporter = require('../utils/DataExporter');
const { FeedbackUtils } = require('../utils/feedback');
const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');

const exportCommand = new Command('export');

exportCommand
  .description('Export Histofy data in various formats')
  .option('-f, --format <format>', 'Export format (json|csv|xml|yaml)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('--dry-run', 'Preview export without creating files')
  .action(async (options) => {
    try {
      await handleExportCommand(options);
    } catch (error) {
      FeedbackUtils.error('Export failed', error.message);
      process.exit(1);
    }
  });

// Subcommands
exportCommand
  .command('commits')
  .description('Export commit data from repository')
  .option('-f, --format <format>', 'Export format (json|csv|xml|yaml)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('--since <date>', 'Export commits since date (YYYY-MM-DD)')
  .option('--until <date>', 'Export commits until date (YYYY-MM-DD)')
  .option('--author <author>', 'Filter by author')
  .option('--branch <branch>', 'Export from specific branch')
  .option('--limit <number>', 'Maximum commits to export', '1000')
  .option('--include-files', 'Include file change information')
  .option('--include-diffs', 'Include diff information')
  .option('--include-stats', 'Include commit statistics')
  .option('--dry-run', 'Preview export without creating files')
  .action(async (options) => {
    try {
      await handleCommitExportCommand(options);
    } catch (error) {
      FeedbackUtils.error('Commit export failed', error.message);
      process.exit(1);
    }
  });

exportCommand
  .command('history')
  .description('Export operation history')
  .option('-f, --format <format>', 'Export format (json|csv|xml|yaml)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('--since <date>', 'Export operations since date (YYYY-MM-DD)')
  .option('--until <date>', 'Export operations until date (YYYY-MM-DD)')
  .option('--type <type>', 'Filter by operation type')
  .option('--limit <number>', 'Maximum operations to export', '100')
  .option('--include-backups', 'Include backup information')
  .option('--dry-run', 'Preview export without creating files')
  .action(async (options) => {
    try {
      await handleHistoryExportCommand(options);
    } catch (error) {
      FeedbackUtils.error('History export failed', error.message);
      process.exit(1);
    }
  });

exportCommand
  .command('analysis')
  .description('Export repository analysis data')
  .option('-f, --format <format>', 'Export format (json|csv|xml|yaml)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('--include-heatmap', 'Include activity heatmap data')
  .option('--include-patterns', 'Include commit pattern analysis')
  .option('--include-health', 'Include repository health data')
  .option('--include-trends', 'Include trend analysis')
  .option('--dry-run', 'Preview export without creating files')
  .action(async (options) => {
    try {
      await handleAnalysisExportCommand(options);
    } catch (error) {
      FeedbackUtils.error('Analysis export failed', error.message);
      process.exit(1);
    }
  });

exportCommand
  .command('config')
  .description('Export configuration data')
  .option('-f, --format <format>', 'Export format (json|csv|xml|yaml)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .option('--include-sensitive', 'Include sensitive configuration values')
  .option('--include-defaults', 'Include default configuration values')
  .option('--dry-run', 'Preview export without creating files')
  .action(async (options) => {
    try {
      await handleConfigExportCommand(options);
    } catch (error) {
      FeedbackUtils.error('Config export failed', error.message);
      process.exit(1);
    }
  });

/**
 * Handle main export command (interactive mode)
 */
async function handleExportCommand(options) {
  console.log(chalk.cyan('📤 Interactive Export Mode\n'));
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'dataType',
      message: 'What would you like to export?',
      choices: [
        { name: 'Commit data from repository', value: 'commits' },
        { name: 'Operation history', value: 'history' },
        { name: 'Repository analysis data', value: 'analysis' },
        { name: 'Configuration data', value: 'config' }
      ]
    },
    {
      type: 'list',
      name: 'format',
      message: 'Select export format:',
      choices: [
        { name: 'JSON (JavaScript Object Notation)', value: 'json' },
        { name: 'CSV (Comma Separated Values)', value: 'csv' },
        { name: 'YAML (YAML Ain\'t Markup Language)', value: 'yaml' },
        { name: 'XML (eXtensible Markup Language)', value: 'xml' }
      ],
      default: options.format || 'json'
    },
    {
      type: 'input',
      name: 'outputFile',
      message: 'Output file path:',
      default: (answers) => {
        const timestamp = new Date().toISOString().slice(0, 10);
        const extension = getFileExtension(answers.format);
        return `histofy-${answers.dataType}-${timestamp}${extension}`;
      },
      when: () => !options.output
    }
  ]);

  const exportOptions = {
    ...options,
    format: answers.format,
    outputFile: answers.outputFile || options.output
  };

  switch (answers.dataType) {
    case 'commits':
      return await handleCommitExportCommand(exportOptions);
    case 'history':
      return await handleHistoryExportCommand(exportOptions);
    case 'analysis':
      return await handleAnalysisExportCommand(exportOptions);
    case 'config':
      return await handleConfigExportCommand(exportOptions);
  }
}

/**
 * Handle commit export command
 */
async function handleCommitExportCommand(options) {
  const dataExporter = new DataExporter();
  
  // Generate output file if not provided
  if (!options.output) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const extension = getFileExtension(options.format);
    options.output = `histofy-commits-${timestamp}${extension}`;
  }

  console.log(chalk.cyan('📤 Exporting Commit Data\n'));
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be created\n'));
  }

  // Display export configuration
  console.log(chalk.bold('Export Configuration:'));
  console.log(`  ${chalk.gray('Output File:')} ${options.output}`);
  console.log(`  ${chalk.gray('Format:')} ${options.format.toUpperCase()}`);
  console.log(`  ${chalk.gray('Limit:')} ${options.limit} commits`);
  
  if (options.since) console.log(`  ${chalk.gray('Since:')} ${options.since}`);
  if (options.until) console.log(`  ${chalk.gray('Until:')} ${options.until}`);
  if (options.author) console.log(`  ${chalk.gray('Author:')} ${options.author}`);
  if (options.branch) console.log(`  ${chalk.gray('Branch:')} ${options.branch}`);
  
  const features = [];
  if (options.includeFiles) features.push('file changes');
  if (options.includeDiffs) features.push('diffs');
  if (options.includeStats) features.push('statistics');
  if (features.length > 0) {
    console.log(`  ${chalk.gray('Include:')} ${features.join(', ')}`);
  }
  
  console.log();

  if (options.dryRun) {
    FeedbackUtils.info('Dry run completed - no files created');
    return { success: true, dryRun: true };
  }

  const result = await dataExporter.exportCommitData({
    outputFile: options.output,
    format: options.format,
    since: options.since,
    until: options.until,
    author: options.author,
    branch: options.branch,
    limit: parseInt(options.limit),
    includeFiles: options.includeFiles,
    includeDiffs: options.includeDiffs,
    includeStats: options.includeStats !== false
  });

  displayExportResult(result);
  return result;
}

/**
 * Handle history export command
 */
async function handleHistoryExportCommand(options) {
  const dataExporter = new DataExporter();
  
  if (!options.output) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const extension = getFileExtension(options.format);
    options.output = `histofy-history-${timestamp}${extension}`;
  }

  console.log(chalk.cyan('📤 Exporting Operation History\n'));
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be created\n'));
    FeedbackUtils.info('Dry run completed - no files created');
    return { success: true, dryRun: true };
  }

  const result = await dataExporter.exportOperationHistory({
    outputFile: options.output,
    format: options.format,
    since: options.since,
    until: options.until,
    type: options.type,
    limit: parseInt(options.limit),
    includeBackups: options.includeBackups
  });

  displayExportResult(result);
  return result;
}

/**
 * Handle analysis export command
 */
async function handleAnalysisExportCommand(options) {
  const dataExporter = new DataExporter();
  
  if (!options.output) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const extension = getFileExtension(options.format);
    options.output = `histofy-analysis-${timestamp}${extension}`;
  }

  console.log(chalk.cyan('📤 Exporting Analysis Data\n'));
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be created\n'));
    FeedbackUtils.info('Dry run completed - no files created');
    return { success: true, dryRun: true };
  }

  const result = await dataExporter.exportAnalysisData({
    outputFile: options.output,
    format: options.format,
    includeHeatmap: options.includeHeatmap !== false,
    includePatterns: options.includePatterns !== false,
    includeHealth: options.includeHealth !== false,
    includeTrends: options.includeTrends !== false
  });

  displayExportResult(result);
  return result;
}

/**
 * Handle config export command
 */
async function handleConfigExportCommand(options) {
  const dataExporter = new DataExporter();
  
  if (!options.output) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const extension = getFileExtension(options.format);
    options.output = `histofy-config-${timestamp}${extension}`;
  }

  console.log(chalk.cyan('📤 Exporting Configuration\n'));
  
  if (options.includeSensitive) {
    console.log(chalk.yellow('⚠️  Warning: Sensitive configuration values will be included'));
  }
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be created\n'));
    FeedbackUtils.info('Dry run completed - no files created');
    return { success: true, dryRun: true };
  }

  const result = await dataExporter.exportConfigurationData({
    outputFile: options.output,
    format: options.format,
    includeSensitive: options.includeSensitive,
    includeDefaults: options.includeDefaults !== false
  });

  displayExportResult(result);
  return result;
}

/**
 * Display export result
 */
function displayExportResult(result) {
  if (result.success) {
    console.log(chalk.green('\n✅ Export completed successfully!\n'));
    
    console.log(chalk.bold('Export Summary:'));
    console.log(`  ${chalk.gray('File:')} ${result.outputFile}`);
    console.log(`  ${chalk.gray('Format:')} ${result.format.toUpperCase()}`);
    console.log(`  ${chalk.gray('Size:')} ${formatFileSize(result.fileSize)}`);
    
    if (result.totalCommits !== undefined) {
      console.log(`  ${chalk.gray('Commits:')} ${result.totalCommits}`);
    }
    
    if (result.totalOperations !== undefined) {
      console.log(`  ${chalk.gray('Operations:')} ${result.totalOperations}`);
    }
    
    if (result.configKeys !== undefined) {
      console.log(`  ${chalk.gray('Config Keys:')} ${result.configKeys}`);
    }
    
    console.log();
    FeedbackUtils.success('Export completed', `Data saved to ${result.outputFile}`);
  }
}

/**
 * Get file extension for format
 */
function getFileExtension(format) {
  const extensions = {
    json: '.json',
    csv: '.csv',
    xml: '.xml',
    yaml: '.yaml'
  };
  return extensions[format.toLowerCase()] || '.txt';
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = exportCommand;