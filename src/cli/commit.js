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

const configManager = new ConfigManager();

/**
 * Handle commit command
 */
async function commitCommand(messageArg, options) {
  const progress = ProgressUtils.spinner('Initializing commit process...');
  
  try {
    progress.start();
    
    // Initialize git manager
    const gitManager = new GitManager();
    
    // Validate Git repository state
    progress.update('Validating Git repository...');
    const repoValidation = await EnhancedValidationUtils.validateGitRepository();
    if (!repoValidation.isValid) {
      progress.fail('Repository validation failed');
      console.log(ErrorHandler.handleValidationError(repoValidation, 'Git repository check'));
      return;
    }
    
    progress.succeed('Git repository validated');

    // Get and validate commit message
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
      console.log(ErrorHandler.handleValidationError(messageValidation, 'commit message validation'));
      return;
    }

    // Get and validate date
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
      console.log(ErrorHandler.handleValidationError(timeValidation, 'time validation'));
      return;
    }

    // Validate author if provided
    if (options.author) {
      const authorValidation = EnhancedValidationUtils.validateAuthor(options.author);
      if (!authorValidation.isValid) {
        console.log(ErrorHandler.handleValidationError(authorValidation, 'author validation'));
        return;
      }
    }

    // Check repository status with enhanced error handling
    const statusProgress = ProgressUtils.spinner('Checking repository status...');
    statusProgress.start();
    
    let status;
    try {
      status = await gitManager.getStatus();
      statusProgress.succeed('Repository status checked');
    } catch (error) {
      statusProgress.fail('Failed to check repository status');
      const gitError = new GitError(error.message, 'status check', error);
      console.log(ErrorHandler.handleGitError(gitError, 'repository status check'));
      return;
    }

    // Add files if requested or if there are untracked files
    if (options.addAll || status.untracked.length > 0 || status.modified.length > 0) {
      const shouldAdd = options.addAll || await confirmAddFiles(status);
      
      if (shouldAdd) {
        const addProgress = ProgressUtils.spinner('Adding files to staging area...');
        addProgress.start();
        
        try {
          await gitManager.addFiles('.');
          addProgress.succeed('Files added to staging area');
        } catch (error) {
          addProgress.fail('Failed to add files');
          const gitError = new GitError(error.message, 'add files', error);
          console.log(ErrorHandler.handleGitError(gitError, 'adding files to staging area'));
          return;
        }
      }
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

    // Create commit with enhanced error handling
    const commitProgress = ProgressUtils.spinner(`Creating commit for ${dateValidation.value} at ${timeValidation.value}...`);
    commitProgress.start();
    
    let result;
    try {
      result = await gitManager.commitWithDate(messageValidation.value, dateValidation.value, timeValidation.value, options.author);
      commitProgress.succeed(`Commit created: ${chalk.green(result.hash.substring(0, 8))}`);
    } catch (error) {
      commitProgress.fail('Failed to create commit');
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

    // Push if requested with enhanced error handling
    if (options.push) {
      const shouldPush = await confirmPush();
      if (shouldPush) {
        const pushProgress = ProgressUtils.spinner('Pushing to remote repository...');
        pushProgress.start();
        
        try {
          await gitManager.pushToRemote();
          pushProgress.succeed('Pushed to remote repository');
        } catch (error) {
          pushProgress.fail('Failed to push to remote');
          
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
      }
    }

    console.log(chalk.green('\nCommit completed successfully!'));
    
  } catch (error) {
    progress.fail('Commit operation failed');
    
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
