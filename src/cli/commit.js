/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const moment = require('moment');
const GitManager = require('../core/GitManager');
const ConfigManager = require('../config/ConfigManager');
const { 
  EnhancedValidationUtils, 
  ErrorHandler, 
  ValidationError, 
  GitError, 
  NetworkError,
  ProgressUtils 
} = require('../utils');
const DryRunManager = require('../utils/DryRunManager');

const configManager = new ConfigManager();

/**
 * Handle commit command
 */
async function commitCommand(messageArg, options) {
  // Create multi-step progress for complex commit operation
  const steps = [
    { name: 'Validation', description: 'Validating inputs and repository state' },
    { name: 'Repository Check', description: 'Checking Git repository status' },
    { name: 'File Staging', description: 'Adding files to staging area' },
    { name: 'Commit Creation', description: 'Creating commit with custom date' },
    { name: 'Remote Push', description: 'Pushing to remote repository' }
  ];
  
  const multiProgress = ProgressUtils.multiStep(steps, { 
    showProgress: true, 
    showElapsed: true 
  });
  
  try {
    multiProgress.start();
    
    // Step 1: Validation
    multiProgress.startStep(0, 'Validating inputs and repository state');
    
    // Initialize git manager
    const gitManager = new GitManager();
    
    // Validate Git repository state
    multiProgress.updateStepProgress(0, 30, 'Validating Git repository...');
    const repoValidation = await EnhancedValidationUtils.validateGitRepository();
    if (!repoValidation.isValid) {
      multiProgress.failStep(0, new Error('Repository validation failed'));
      console.log(ErrorHandler.handleValidationError(repoValidation, 'Git repository check'));
      return;
    }
    
    multiProgress.updateStepProgress(0, 60, 'Git repository validated');

    // Get and validate commit message
    multiProgress.updateStepProgress(0, 70, 'Validating commit message...');
    let message = messageArg || options.message;
    if (!message) {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: 'Commit message:',
          validate: input => {
            const validation = EnhancedValidationUtils.validateCommitMessage(input);
            return validation.isValid || validation.error;
          }
        }
      ]);
      message = response.message;
    }

    // Validate commit message
    const messageValidation = EnhancedValidationUtils.validateCommitMessage(message);
    if (!messageValidation.isValid) {
      multiProgress.failStep(0, new Error('Message validation failed'));
      console.log(ErrorHandler.handleValidationError(messageValidation, 'commit message validation'));
      return;
    }

    // Get and validate date
    multiProgress.updateStepProgress(0, 80, 'Validating date and time...');
    let date = options.date;
    if (!date) {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'date',
          message: 'Date (YYYY-MM-DD) or leave empty for today:',
          default: moment().format('YYYY-MM-DD'),
          validate: input => {
            if (!input.trim()) return true;
            const validation = EnhancedValidationUtils.validateDate(input);
            return validation.isValid || validation.error;
          }
        }
      ]);
      date = response.date || moment().format('YYYY-MM-DD');
    }

    // Validate date
    const dateValidation = EnhancedValidationUtils.validateDate(date);
    if (!dateValidation.isValid) {
      multiProgress.failStep(0, new Error('Date validation failed'));
      console.log(ErrorHandler.handleValidationError(dateValidation, 'date validation'));
      return;
    }

    // Get and validate time
    let time = options.time;
    if (!time) {
      try {
        const config = await configManager.loadConfig();
        time = config.git.defaultTime || '12:00';
      } catch (error) {
        console.log(ErrorHandler.formatUserFriendlyError(error, { operation: 'loading configuration' }));
        time = '12:00'; // Fallback to default
      }
    }

    // Validate time
    const timeValidation = EnhancedValidationUtils.validateTime(time);
    if (!timeValidation.isValid) {
      multiProgress.failStep(0, new Error('Time validation failed'));
      console.log(ErrorHandler.handleValidationError(timeValidation, 'time validation'));
      return;
    }

    // Validate author if provided
    if (options.author) {
      const authorValidation = EnhancedValidationUtils.validateAuthor(options.author);
      if (!authorValidation.isValid) {
        multiProgress.failStep(0, new Error('Author validation failed'));
        console.log(ErrorHandler.handleValidationError(authorValidation, 'author validation'));
        return;
      }
    }

    multiProgress.completeStep(0, 'All inputs validated successfully');

    // Handle dry-run mode
    if (options.dryRun) {
      multiProgress.completeStep(1, 'Dry-run mode: skipping repository check');
      multiProgress.completeStep(2, 'Dry-run mode: skipping file staging');
      multiProgress.completeStep(3, 'Dry-run mode: skipping commit creation');
      multiProgress.completeStep(4, 'Dry-run mode: skipping remote push');
      
      const commitData = {
        message: messageValidation.value,
        date: dateValidation.value,
        time: timeValidation.value,
        author: options.author,
        addAll: options.addAll,
        push: options.push,
        files: options.addAll ? null : ['staged files']
      };

      const dryRun = DryRunManager.forCommitOperation(commitData);
      const summary = dryRun.displayPreview({
        showDetails: true,
        showWarnings: true,
        showGitCommands: true
      });

      return {
        success: true,
        dryRun: true,
        summary,
        message: 'Dry-run completed successfully'
      };
    }

    // Step 2: Repository Check
    multiProgress.startStep(1, 'Checking repository status');
    
    let status;
    try {
      multiProgress.updateStepProgress(1, 50, 'Getting repository status...');
      status = await gitManager.getStatus();
      multiProgress.completeStep(1, 'Repository status checked');
    } catch (error) {
      multiProgress.failStep(1, error, 'Failed to check repository status');
      const gitError = new GitError(error.message, 'status check', error);
      console.log(ErrorHandler.handleGitError(gitError, 'repository status check'));
      return;
    }

    // Step 3: File Staging
    if (options.addAll || status.untracked.length > 0 || status.modified.length > 0) {
      multiProgress.startStep(2, 'Adding files to staging area');
      
      const shouldAdd = options.addAll || await confirmAddFiles(status);
      
      if (shouldAdd) {
        try {
          multiProgress.updateStepProgress(2, 50, 'Adding files to staging area...');
          await gitManager.addFiles('.');
          multiProgress.completeStep(2, 'Files added to staging area');
        } catch (error) {
          multiProgress.failStep(2, error, 'Failed to add files');
          const gitError = new GitError(error.message, 'add files', error);
          console.log(ErrorHandler.handleGitError(gitError, 'adding files to staging area'));
          return;
        }
      } else {
        multiProgress.skipStep(2, 'File staging skipped by user');
      }
    } else {
      multiProgress.skipStep(2, 'No files to stage');
    }

    // Check if there are staged changes
    let updatedStatus;
    try {
      updatedStatus = await gitManager.getStatus();
    } catch (error) {
      const gitError = new GitError(error.message, 'status check after add', error);
      console.log(ErrorHandler.handleGitError(gitError, 'checking repository status'));
      return;
    }

    if (updatedStatus.staged.length === 0) {
      const validationError = new ValidationError(
        'No staged changes to commit',
        'staged_files',
        'Use "git add <files>" to stage changes or use --add-all flag to stage all changes'
      );
      console.log(ErrorHandler.handleValidationError(validationError, 'commit preparation'));
      return;
    }

    // Step 4: Commit Creation
    multiProgress.startStep(3, `Creating commit for ${dateValidation.value} at ${timeValidation.value}`);
    
    let result;
    try {
      multiProgress.updateStepProgress(3, 30, 'Preparing commit...');
      result = await gitManager.commitWithDate(messageValidation.value, dateValidation.value, timeValidation.value, options.author);
      multiProgress.completeStep(3, `Commit created: ${result.hash.substring(0, 8)}`);
    } catch (error) {
      multiProgress.failStep(3, error, 'Failed to create commit');
      const gitError = new GitError(error.message, 'commit creation', error);
      console.log(ErrorHandler.handleGitError(gitError, 'creating commit'));
      return;
    }

    // Display commit info
    console.log(chalk.blue('\nCommit Details:'));
    console.log(`   Hash: ${chalk.cyan(result.hash.substring(0, 8))}`);
    console.log(`   Date: ${chalk.yellow(dateValidation.value)} at ${chalk.yellow(timeValidation.value)}`);
    console.log(`   Message: ${chalk.white(messageValidation.value)}`);
    if (options.author) {
      console.log(`   Author: ${chalk.white(options.author)}`);
    }

    // Step 5: Remote Push
    if (options.push) {
      const shouldPush = await confirmPush();
      if (shouldPush) {
        multiProgress.startStep(4, 'Pushing to remote repository');
        
        try {
          multiProgress.updateStepProgress(4, 50, 'Pushing to remote...');
          await gitManager.pushToRemote();
          multiProgress.completeStep(4, 'Pushed to remote repository');
        } catch (error) {
          multiProgress.failStep(4, error, 'Failed to push to remote');
          
          // Determine if this is a network error or Git error
          if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('connection')) {
            const networkError = new NetworkError(error.message, null, null, true);
            console.log(ErrorHandler.handleNetworkError(networkError, 0, 3));
          } else {
            const gitError = new GitError(error.message, 'push to remote', error);
            console.log(ErrorHandler.handleGitError(gitError, 'pushing to remote repository'));
          }
          
          console.log(chalk.yellow('\nCommit was created successfully but push failed.'));
          console.log(chalk.gray('You can push manually later with: git push'));
        }
      } else {
        multiProgress.skipStep(4, 'Push skipped by user');
      }
    } else {
      multiProgress.skipStep(4, 'Push not requested');
    }

    // Display final summary
    const summary = multiProgress.getSummary();
    console.log(chalk.green('\nCommit operation completed!'));
    console.log(chalk.gray(`   Steps completed: ${summary.completed}/${summary.total}`));
    if (summary.failed > 0) {
      console.log(chalk.red(`   Steps failed: ${summary.failed}`));
    }
    if (summary.skipped > 0) {
      console.log(chalk.yellow(`   Steps skipped: ${summary.skipped}`));
    }
    
  } catch (error) {
    // Fail any running step
    if (multiProgress.currentStepIndex < multiProgress.steps.length) {
      multiProgress.failStep(multiProgress.currentStepIndex, error, 'Operation failed');
    }
    
    // Handle different types of errors appropriately
    if (error instanceof ValidationError) {
      console.log(ErrorHandler.handleValidationError(error, 'commit operation'));
    } else if (error instanceof GitError) {
      console.log(ErrorHandler.handleGitError(error, 'commit operation'));
    } else if (error instanceof NetworkError) {
      console.log(ErrorHandler.handleNetworkError(error));
    } else {
      console.log(ErrorHandler.formatUserFriendlyError(error, { 
        operation: 'commit operation',
        command: 'histofy commit',
        args: { message: messageArg, ...options }
      }));
    }
    
    if (options.verbose && error.stack) {
      console.log(chalk.gray('\nStack trace:'));
      console.log(chalk.gray(error.stack));
    }
  }
}

/**
 * Confirm adding files to staging area
 */
async function confirmAddFiles(status) {
  console.log(chalk.yellow('\n⚠️  Repository Status:'));
  
  if (status.modified.length > 0) {
    console.log(chalk.red('   Modified files:'));
    status.modified.forEach(file => console.log(`     - ${file}`));
  }
  
  if (status.untracked.length > 0) {
    console.log(chalk.red('   Untracked files:'));
    status.untracked.forEach(file => console.log(`     - ${file}`));
  }

  const response = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addFiles',
      message: 'Add all changes to staging area?',
      default: true
    }
  ]);

  return response.addFiles;
}

/**
 * Confirm pushing to remote
 */
async function confirmPush() {
  const response = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'push',
      message: 'Push changes to remote repository?',
      default: true
    }
  ]);

  return response.push;
}

module.exports = commitCommand;
