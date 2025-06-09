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
const fs = require('fs').promises;
const yaml = require('yaml');
const moment = require('moment');
const GitManager = require('../core/GitManager');
const GitHubManager = require('../core/GitHubManager');
const ConfigManager = require('../config/ConfigManager');

const configManager = new ConfigManager();

/**
 * Handle deploy command
 */
async function deployCommand(options) {
  const spinner = ora();
  
  try {
    console.log(chalk.blue('🚀 Histofy Pattern Deployment\n'));

    // Load configuration
    const config = await configManager.loadConfig();
    
    // Get pattern to deploy
    let pattern = null;
    let patternName = '';
    
    if (options.file) {
      // Load pattern from file
      try {
        const fileContent = await fs.readFile(options.file, 'utf8');
        pattern = yaml.parse(fileContent);
        patternName = options.file;
        console.log(chalk.green(`📁 Loaded pattern from: ${options.file}`));
      } catch (error) {
        console.error(chalk.red(`❌ Failed to load pattern file: ${error.message}`));
        return;
      }
    } else if (options.pattern) {
      // Load predefined pattern
      const result = await configManager.loadPattern(options.pattern);
      if (result.success) {
        pattern = result.pattern;
        patternName = options.pattern;
        console.log(chalk.green(`🎨 Loaded pattern: ${options.pattern}`));
      } else {
        console.error(chalk.red(`❌ Pattern not found: ${options.pattern}`));
        console.log(chalk.gray('   Use "histofy pattern list" to see available patterns'));
        return;
      }
    } else {
      // Interactive pattern selection
      const patterns = await configManager.listPatterns();
      if (patterns.success && patterns.patterns.length > 0) {
        const response = await inquirer.prompt([
          {
            type: 'list',
            name: 'pattern',
            message: 'Select a pattern to deploy:',
            choices: patterns.patterns
          }
        ]);
        
        const result = await configManager.loadPattern(response.pattern);
        if (result.success) {
          pattern = result.pattern;
          patternName = response.pattern;
        } else {
          console.error(chalk.red(`❌ Failed to load pattern: ${result.error}`));
          return;
        }
      } else {
        console.error(chalk.red('❌ No patterns available'));
        console.log(chalk.gray('   Create a pattern with "histofy pattern create"'));
        return;
      }
    }

    // Get repository
    let repoName = options.repo;
    if (!repoName) {
      repoName = config.github.defaultRepo;
      if (!repoName) {
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'repo',
            message: 'Target repository (username/repo):',
            validate: input => input.includes('/') || 'Repository must be in format: username/repo'
          }
        ]);
        repoName = response.repo;
      }
    }

    console.log(chalk.blue(`🎯 Target repository: ${repoName}`));

    // Validate pattern structure
    if (!pattern || !pattern.commits || !Array.isArray(pattern.commits)) {
      console.error(chalk.red('❌ Invalid pattern structure'));
      console.log(chalk.gray('   Pattern must have a "commits" array'));
      return;
    }

    // Show deployment summary
    console.log(chalk.yellow('\n📋 Deployment Summary:'));
    console.log(`   Pattern: ${patternName}`);
    console.log(`   Repository: ${repoName}`);
    console.log(`   Total commits: ${pattern.commits.length}`);
    console.log(`   Date range: ${getDateRange(pattern.commits)}`);

    if (options.dryRun) {
      console.log(chalk.blue('\n🔍 Dry Run - Preview of commits to be created:\n'));
      displayCommitPreview(pattern.commits);
      return;
    }

    // Confirm deployment
    if (!options.force) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'deploy',
          message: 'Proceed with deployment?',
          default: false
        }
      ]);

      if (!confirm.deploy) {
        console.log(chalk.gray('Deployment cancelled'));
        return;
      }
    }

    // Initialize Git Manager
    const gitManager = new GitManager();
    
    // Check if we're in a git repository
    if (!(await gitManager.isGitRepo())) {
      console.error(chalk.red('❌ Not in a git repository'));
      console.log(chalk.gray('   Initialize a repository first with "git init"'));
      return;
    }

    // Check repository status
    const status = await gitManager.getStatus();
    if (!status.isClean && !options.force) {
      console.error(chalk.red('❌ Repository has uncommitted changes'));
      console.log(chalk.gray('   Commit or stash changes first, or use --force flag'));
      return;
    }

    // Deploy commits
    spinner.start('Deploying pattern...');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pattern.commits.length; i++) {
      const commit = pattern.commits[i];
      
      try {
        spinner.text = `Creating commit ${i + 1}/${pattern.commits.length}: ${commit.message}`;
        
        // Create dummy file if no files specified
        if (!commit.files || commit.files.length === 0) {
          const filename = `histofy-${Date.now()}-${i}.txt`;
          await fs.writeFile(filename, `Commit ${i + 1}: ${commit.message}\nCreated by Histofy v3\nDate: ${commit.date}\n`);
          await gitManager.addFiles(filename);
        } else {
          // Handle specified files (would need more complex logic)
          await gitManager.addFiles('.');
        }

        // Create commit with specified date
        await gitManager.commitWithDate(
          commit.message,
          commit.date,
          commit.time || '12:00',
          commit.author
        );

        successCount++;
        
        // Add small delay to avoid issues
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(chalk.red(`\n❌ Failed to create commit ${i + 1}: ${error.message}`));
        failCount++;
        
        if (!options.force) {
          break;
        }
      }
    }

    spinner.stop();

    // Show results
    console.log(chalk.green(`\n✅ Deployment completed!`));
    console.log(`   Successful commits: ${chalk.green(successCount)}`);
    if (failCount > 0) {
      console.log(`   Failed commits: ${chalk.red(failCount)}`);
    }

    // Ask about pushing
    if (successCount > 0) {
      const pushResponse = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'push',
          message: 'Push commits to remote repository?',
          default: true
        }
      ]);

      if (pushResponse.push) {
        spinner.start('Pushing to remote...');
        try {
          await gitManager.pushToRemote();
          spinner.succeed('Successfully pushed to remote repository');
        } catch (error) {
          spinner.fail(`Failed to push: ${error.message}`);
        }
      }
    }

    console.log(chalk.blue('\n🎉 Pattern deployment completed!'));
    
  } catch (error) {
    spinner.fail('Deployment failed');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Get date range from commits
 */
function getDateRange(commits) {
  if (commits.length === 0) return 'No commits';
  
  const dates = commits.map(c => moment(c.date)).sort();
  const start = dates[0].format('YYYY-MM-DD');
  const end = dates[dates.length - 1].format('YYYY-MM-DD');
  
  return start === end ? start : `${start} to ${end}`;
}

/**
 * Display commit preview
 */
function displayCommitPreview(commits) {
  commits.slice(0, 10).forEach((commit, index) => {
    console.log(`   ${index + 1}. ${chalk.yellow(commit.date)} ${chalk.gray(commit.time || '12:00')} - ${commit.message}`);
  });
  
  if (commits.length > 10) {
    console.log(chalk.gray(`   ... and ${commits.length - 10} more commits`));
  }
}

module.exports = deployCommand;
