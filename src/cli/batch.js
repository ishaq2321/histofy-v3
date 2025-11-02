/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Batch Command - Handle batch commit operations
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const BatchCommitManager = require('../utils/BatchCommitManager');
const { ErrorHandler, ValidationError, FileSystemError } = require('../utils/errors');
const FeedbackUtils = require('../utils/feedback');

/**
 * Handle batch commit command
 */
async function batchCommand(action, options) {
  const batchManager = new BatchCommitManager();

  try {
    switch (action) {
      case 'commit':
        await handleBatchCommit(batchManager, options);
        break;
      case 'template':
        await handleTemplateCommand(batchManager, options);
        break;
      case 'import':
        await handleImportCommand(batchManager, options);
        break;
      case 'export':
        await handleExportCommand(batchManager, options);
        break;
      case 'validate':
        await handleValidateCommand(batchManager, options);
        break;
      default:
        console.log(chalk.red(`Unknown batch action: ${action}`));
        showBatchHelp();
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log(ErrorHandler.handleValidationError(error, 'batch operation'));
    } else if (error instanceof FileSystemError) {
      console.log(ErrorHandler.handleFileSystemError(error, error.path, error.operation));
    } else {
      console.log(ErrorHandler.formatUserFriendlyError(error, {
        operation: 'batch operation',
        command: `histofy batch ${action}`
      }));
    }

    if (options.verbose && error.stack) {
      console.log(chalk.gray('\nStack trace:'));
      console.log(chalk.gray(error.stack));
    }
  }
}

/**
 * Handle batch commit operation
 */
async function handleBatchCommit(batchManager, options) {
  console.log(chalk.blue('🚀 Batch Commit Operation\n'));

  // Validate required options
  if (!options.input) {
    throw new ValidationError('Input file is required', 'input', 'Specify input file with --input option');
  }

  // Load commit data
  console.log(chalk.cyan('📂 Loading commit data...'));
  let commitData;
  
  const inputPath = path.resolve(options.input);
  const fileExtension = path.extname(inputPath).toLowerCase();

  if (fileExtension === '.csv') {
    commitData = await batchManager.importFromCSV(inputPath, {
      separator: options.separator || ',',
      headers: options.headers !== false
    });
  } else if (fileExtension === '.json') {
    commitData = await batchManager.importFromJSON(inputPath);
  } else {
    throw new ValidationError('Unsupported input format', 'input_format', 'Use .csv or .json files');
  }

  console.log(chalk.green(`✅ Loaded ${commitData.length} commit records\n`));

  // Load template if specified
  let template = null;
  if (options.template) {
    console.log(chalk.cyan('📋 Loading commit template...'));
    template = await batchManager.loadTemplate(options.template);
    console.log(chalk.green('✅ Template loaded successfully\n'));
  }

  // Show preview if requested
  if (options.preview || options.dryRun) {
    console.log(chalk.yellow('👀 Preview Mode - First 5 commits:\n'));
    
    const previewData = commitData.slice(0, 5);
    const previewTable = [];
    
    previewData.forEach((commit, index) => {
      const processedCommit = template ? 
        batchManager.processTemplate(template, { ...commit, index, total: commitData.length }) :
        commit;
      
      previewTable.push({
        '#': index + 1,
        'Message': processedCommit.message.substring(0, 50) + (processedCommit.message.length > 50 ? '...' : ''),
        'Date': processedCommit.date,
        'Time': processedCommit.time,
        'Author': processedCommit.author || 'Default'
      });
    });

    FeedbackUtils.displayTable(previewTable, [
      { key: '#', header: '#', width: 5 },
      { key: 'Message', header: 'Message', width: 52 },
      { key: 'Date', header: 'Date', width: 12 },
      { key: 'Time', header: 'Time', width: 8 },
      { key: 'Author', header: 'Author', width: 15 }
    ], { title: 'Commit Preview' });

    if (commitData.length > 5) {
      console.log(chalk.gray(`... and ${commitData.length - 5} more commits\n`));
    }
  }

  // Confirm execution unless in non-interactive mode
  if (!options.yes && !options.dryRun) {
    const confirmed = await FeedbackUtils.confirmDestructiveOperation(
      `batch commit of ${commitData.length} commits`,
      [
        'This will create multiple commits in your repository',
        'Each commit will modify your Git history',
        'Make sure you have a backup of your repository'
      ]
    );

    if (!confirmed) {
      console.log(chalk.yellow('Batch commit cancelled by user'));
      return;
    }
  }

  // Execute batch commit
  const batchOptions = {
    dryRun: options.dryRun || false,
    continueOnError: options.continueOnError || false,
    maxConcurrent: options.concurrent || 1,
    validateOnly: options.validateOnly || false
  };

  const result = await batchManager.executeBatchCommit(commitData, template, batchOptions);

  // Display results
  displayBatchResults(result, options);
}

/**
 * Handle template command
 */
async function handleTemplateCommand(batchManager, options) {
  if (options.create) {
    await createTemplate(batchManager, options);
  } else if (options.validate) {
    await validateTemplate(batchManager, options);
  } else {
    console.log(chalk.red('Template action required'));
    console.log(chalk.gray('Use --create to create a new template or --validate to validate existing template'));
  }
}

/**
 * Create a new template
 */
async function createTemplate(batchManager, options) {
  console.log(chalk.blue('📋 Create Commit Template\n'));

  const templateData = {};

  // Interactive template creation
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: 'Commit message template (use {{variable}} for substitution):',
      validate: input => input.trim().length > 0 || 'Message template is required'
    },
    {
      type: 'input',
      name: 'author',
      message: 'Default author (optional):',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Default email (optional):',
    },
    {
      type: 'input',
      name: 'date',
      message: 'Default date (YYYY-MM-DD, optional):',
    },
    {
      type: 'input',
      name: 'time',
      message: 'Default time (HH:MM, optional):',
      default: '12:00'
    },
    {
      type: 'confirm',
      name: 'addVariables',
      message: 'Add custom variables?',
      default: false
    }
  ]);

  templateData.message = answers.message;
  if (answers.author) templateData.author = answers.author;
  if (answers.email) templateData.email = answers.email;
  if (answers.date) templateData.date = answers.date;
  if (answers.time) templateData.time = answers.time;

  // Add custom variables
  if (answers.addVariables) {
    templateData.variables = [];
    
    let addMore = true;
    while (addMore) {
      const varAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Variable name:',
          validate: input => input.trim().length > 0 || 'Variable name is required'
        },
        {
          type: 'list',
          name: 'type',
          message: 'Variable type:',
          choices: ['string', 'number', 'date', 'boolean'],
          default: 'string'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Variable description (optional):'
        },
        {
          type: 'confirm',
          name: 'addAnother',
          message: 'Add another variable?',
          default: false
        }
      ]);

      const variable = {
        name: varAnswers.name,
        type: varAnswers.type
      };
      
      if (varAnswers.description) {
        variable.description = varAnswers.description;
      }

      templateData.variables.push(variable);
      addMore = varAnswers.addAnother;
    }
  }

  // Save template
  const outputPath = options.output || `template-${Date.now()}.json`;
  const result = await batchManager.createTemplate(templateData, outputPath);

  console.log(chalk.green('\n✅ Template created successfully!'));
  console.log(chalk.cyan(`📁 Saved to: ${result.templatePath}`));
  
  // Show template preview
  console.log(chalk.yellow('\n📋 Template Preview:'));
  console.log(JSON.stringify(result.template, null, 2));
}

/**
 * Validate template
 */
async function validateTemplate(batchManager, options) {
  if (!options.template) {
    throw new ValidationError('Template file is required', 'template', 'Specify template file with --template option');
  }

  console.log(chalk.blue('🔍 Validating Template\n'));
  
  try {
    const template = await batchManager.loadTemplate(options.template);
    console.log(chalk.green('✅ Template is valid!'));
    
    if (options.verbose) {
      console.log(chalk.yellow('\n📋 Template Details:'));
      console.log(JSON.stringify(template, null, 2));
    }
  } catch (error) {
    console.log(chalk.red('❌ Template validation failed'));
    throw error;
  }
}

/**
 * Handle import command
 */
async function handleImportCommand(batchManager, options) {
  console.log(chalk.blue('📥 Import Commit Data\n'));

  if (!options.input) {
    throw new ValidationError('Input file is required', 'input', 'Specify input file with --input option');
  }

  const inputPath = path.resolve(options.input);
  const fileExtension = path.extname(inputPath).toLowerCase();

  let commitData;
  if (fileExtension === '.csv') {
    commitData = await batchManager.importFromCSV(inputPath, {
      separator: options.separator || ',',
      headers: options.headers !== false
    });
  } else if (fileExtension === '.json') {
    commitData = await batchManager.importFromJSON(inputPath);
  } else {
    throw new ValidationError('Unsupported input format', 'input_format', 'Use .csv or .json files');
  }

  console.log(chalk.green(`✅ Successfully imported ${commitData.length} records`));

  // Show sample data
  if (commitData.length > 0) {
    console.log(chalk.yellow('\n📊 Sample Data (first record):'));
    console.log(JSON.stringify(commitData[0], null, 2));
  }

  // Validate data if requested
  if (options.validate) {
    console.log(chalk.cyan('\n🔍 Validating imported data...'));
    const validation = await batchManager.validateBatchData(commitData);
    
    if (validation.valid) {
      console.log(chalk.green(`✅ All ${validation.validCount} records are valid`));
    } else {
      console.log(chalk.red(`❌ ${validation.invalidCount} invalid records found`));
      
      if (options.verbose) {
        validation.errors.slice(0, 5).forEach(error => {
          console.log(chalk.red(`  • Record ${error.index}: ${error.error}`));
        });
        
        if (validation.errors.length > 5) {
          console.log(chalk.gray(`  ... and ${validation.errors.length - 5} more errors`));
        }
      }
    }
  }
}

/**
 * Handle export command
 */
async function handleExportCommand(batchManager, options) {
  console.log(chalk.blue('📤 Export Commit Data\n'));

  // This would typically export existing commit data
  // For now, show help message
  console.log(chalk.yellow('Export functionality coming soon!'));
  console.log(chalk.gray('This will allow exporting commit history to CSV/JSON formats'));
}

/**
 * Handle validate command
 */
async function handleValidateCommand(batchManager, options) {
  console.log(chalk.blue('🔍 Validate Batch Data\n'));

  if (!options.input) {
    throw new ValidationError('Input file is required', 'input', 'Specify input file with --input option');
  }

  // Load and validate data
  const inputPath = path.resolve(options.input);
  const fileExtension = path.extname(inputPath).toLowerCase();

  let commitData;
  if (fileExtension === '.csv') {
    commitData = await batchManager.importFromCSV(inputPath);
  } else if (fileExtension === '.json') {
    commitData = await batchManager.importFromJSON(inputPath);
  } else {
    throw new ValidationError('Unsupported input format', 'input_format', 'Use .csv or .json files');
  }

  // Load template if specified
  let template = null;
  if (options.template) {
    template = await batchManager.loadTemplate(options.template);
  }

  // Validate
  const validation = await batchManager.validateBatchData(commitData, template);

  // Display results
  console.log(chalk.cyan(`📊 Validation Results:`));
  console.log(`   Total records: ${commitData.length}`);
  console.log(`   Valid records: ${chalk.green(validation.validCount)}`);
  console.log(`   Invalid records: ${chalk.red(validation.invalidCount)}`);

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow(`   Warnings: ${validation.warnings.length}`));
  }

  if (validation.valid) {
    console.log(chalk.green('\n✅ All data is valid and ready for batch commit!'));
  } else {
    console.log(chalk.red('\n❌ Validation failed - fix errors before proceeding'));
    
    if (options.verbose) {
      console.log(chalk.red('\nErrors:'));
      validation.errors.slice(0, 10).forEach(error => {
        console.log(chalk.red(`  • Record ${error.index}: ${error.error}`));
        if (error.suggestion) {
          console.log(chalk.gray(`    Suggestion: ${error.suggestion}`));
        }
      });
      
      if (validation.errors.length > 10) {
        console.log(chalk.gray(`  ... and ${validation.errors.length - 10} more errors`));
      }
    }
  }
}

/**
 * Display batch operation results
 */
function displayBatchResults(result, options) {
  console.log(chalk.blue('\n📊 Batch Operation Results\n'));

  if (result.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN - No commits were actually created\n'));
  }

  // Summary table
  const summaryData = [
    { metric: 'Total Commits', value: result.totalCommits },
    { metric: 'Successful', value: result.successfulCommits || result.processedCommits },
    { metric: 'Failed', value: result.failedCommits || result.errors },
    { metric: 'Duration', value: result.duration ? `${Math.round(result.duration / 1000)}s` : 'N/A' }
  ];

  FeedbackUtils.displayTable(summaryData, [
    { key: 'metric', header: 'Metric', width: 20 },
    { key: 'value', header: 'Value', width: 15 }
  ], { title: 'Summary' });

  // Show errors if any
  if (result.errors && result.errors.length > 0) {
    console.log(chalk.red(`\n❌ ${result.errors.length} Error(s):`));
    
    result.errors.slice(0, 5).forEach(error => {
      console.log(chalk.red(`  • Record ${error.index}: ${error.error}`));
    });
    
    if (result.errors.length > 5) {
      console.log(chalk.gray(`  ... and ${result.errors.length - 5} more errors`));
    }
  }

  // Success message
  if (result.success) {
    if (result.dryRun) {
      console.log(chalk.green('\n✅ Dry run completed successfully!'));
      console.log(chalk.cyan('Run without --dry-run to execute the batch commit'));
    } else {
      console.log(chalk.green('\n🎉 Batch commit completed successfully!'));
    }
  } else {
    console.log(chalk.red('\n❌ Batch commit completed with errors'));
    console.log(chalk.yellow('Use --continue-on-error to process remaining commits despite errors'));
  }
}

/**
 * Show batch command help
 */
function showBatchHelp() {
  console.log(chalk.blue('\n📚 Histofy Batch Commands\n'));
  
  console.log(chalk.yellow('Available Actions:'));
  console.log('  commit     - Execute batch commit from data file');
  console.log('  template   - Create or validate commit templates');
  console.log('  import     - Import and validate commit data');
  console.log('  export     - Export commit data to file');
  console.log('  validate   - Validate batch data without execution');
  
  console.log(chalk.yellow('\nCommon Options:'));
  console.log('  --input <file>      - Input data file (CSV or JSON)');
  console.log('  --template <file>   - Commit template file');
  console.log('  --dry-run          - Preview without executing');
  console.log('  --verbose          - Show detailed output');
  console.log('  --yes              - Skip confirmation prompts');
  
  console.log(chalk.yellow('\nExamples:'));
  console.log(chalk.cyan('  histofy batch commit --input commits.csv --template template.json'));
  console.log(chalk.cyan('  histofy batch validate --input data.json'));
  console.log(chalk.cyan('  histofy batch template --create --output my-template.json'));
}

module.exports = batchCommand;