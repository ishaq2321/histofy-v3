const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const moment = require('moment');
const GitManager = require('../core/GitManager');
const ConfigManager = require('../config/ConfigManager');

const configManager = new ConfigManager();

/**
 * Handle commit command
 */
async function commitCommand(messageArg, options) {
  const spinner = ora();
  
  try {
    // Initialize git manager
    const gitManager = new GitManager();
    
    // Check if we're in a git repository
    if (!(await gitManager.isGitRepo())) {
      console.error(chalk.red('Error: Not in a git repository'));
      console.log(chalk.gray('Run "git init" to initialize a repository'));
      return;
    }

    // Get commit message
    let message = messageArg || options.message;
    if (!message) {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: 'Commit message:',
          validate: input => input.trim().length > 0 || 'Commit message is required'
        }
      ]);
      message = response.message;
    }

    // Get date
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
            return moment(input, 'YYYY-MM-DD', true).isValid() || 'Invalid date format (use YYYY-MM-DD)';
          }
        }
      ]);
      date = response.date || moment().format('YYYY-MM-DD');
    }

    // Get time
    let time = options.time;
    if (!time) {
      const config = await configManager.loadConfig();
      time = config.git.defaultTime || '12:00';
    }

    // Validate date and time
    const commitDateTime = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm');
    if (!commitDateTime.isValid()) {
      console.error(chalk.red('Error: Invalid date or time format'));
      return;
    }

    // Check repository status
    spinner.start('Checking repository status...');
    const status = await gitManager.getStatus();
    spinner.stop();

    // Add files if requested or if there are untracked files
    if (options.addAll || status.untracked.length > 0 || status.modified.length > 0) {
      const shouldAdd = options.addAll || await confirmAddFiles(status);
      
      if (shouldAdd) {
        spinner.start('Adding files to staging area...');
        await gitManager.addFiles('.');
        spinner.succeed('Files added to staging area');
      }
    }

    // Check if there are staged changes
    const updatedStatus = await gitManager.getStatus();
    if (updatedStatus.staged.length === 0) {
      console.error(chalk.red('Error: No staged changes to commit'));
      console.log(chalk.gray('Use "git add" to stage changes or use --add-all flag'));
      return;
    }

    // Create commit
    spinner.start(`Creating commit for ${date} at ${time}...`);
    const result = await gitManager.commitWithDate(message, date, time, options.author);
    spinner.succeed(`Commit created: ${chalk.green(result.hash.substring(0, 8))}`);

    // Display commit info
    console.log(chalk.blue('\n📝 Commit Details:'));
    console.log(`   Hash: ${chalk.cyan(result.hash.substring(0, 8))}`);
    console.log(`   Date: ${chalk.yellow(date)} at ${chalk.yellow(time)}`);
    console.log(`   Message: ${chalk.white(message)}`);

    // Push if requested
    if (options.push) {
      const shouldPush = await confirmPush();
      if (shouldPush) {
        spinner.start('Pushing to remote repository...');
        try {
          await gitManager.pushToRemote();
          spinner.succeed('Pushed to remote repository');
        } catch (error) {
          spinner.fail(`Failed to push: ${error.message}`);
        }
      }
    }

    console.log(chalk.green('\n✅ Commit completed successfully!'));
    
  } catch (error) {
    spinner.fail('Commit failed');
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
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
