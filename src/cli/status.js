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
const Table = require('cli-table3');
const GitManager = require('../core/GitManager');
const GitHubManager = require('../core/GitHubManager');
const ConfigManager = require('../config/ConfigManager');
const { 
  EnhancedValidationUtils, 
  ErrorHandler, 
  GitError, 
  NetworkError,
  ConfigurationError,
  ProgressUtils 
} = require('../utils');

const configManager = new ConfigManager();

/**
 * Handle status command
 */
async function statusCommand(options) {
  const progress = ProgressUtils.spinner('Initializing status check...');
  
  try {
    console.log(chalk.blue('Histofy Status Report\n'));
    progress.start();

    // Validate Git repository
    progress.update('Validating Git repository...');
    const repoValidation = await EnhancedValidationUtils.validateGitRepository();
    if (!repoValidation.isValid) {
      progress.fail('Repository validation failed');
      console.log(ErrorHandler.handleValidationError(repoValidation, 'Git repository check'));
      return;
    }
    progress.succeed('Git repository validated');

    // Initialize Git Manager
    const gitManager = new GitManager();

    // Get repository information with error handling
    const repoProgress = ProgressUtils.spinner('Getting repository information...');
    repoProgress.start();
    
    let repoInfo, status;
    try {
      repoInfo = await gitManager.getRepoInfo();
      status = await gitManager.getStatus();
      repoProgress.succeed('Repository information retrieved');
    } catch (error) {
      repoProgress.fail('Failed to get repository information');
      const gitError = new GitError(error.message, 'repository info retrieval', error);
      console.log(ErrorHandler.handleGitError(gitError, 'getting repository information'));
      return;
    }

    // Display repository information
    displayRepositoryInfo(repoInfo, status);

    // Get configuration with error handling
    const configProgress = ProgressUtils.spinner('Loading configuration...');
    configProgress.start();
    
    let config;
    try {
      config = await configManager.loadConfig();
      configProgress.succeed('Configuration loaded');
    } catch (error) {
      configProgress.warn('Configuration load failed, using defaults');
      const configError = new ConfigurationError(error.message, null, 'Run "histofy config init" to initialize configuration');
      console.log(ErrorHandler.handleConfigurationError(configError));
      
      // Use default config to continue
      config = {
        github: { token: null, username: null },
        git: { defaultTime: '12:00' },
        ui: { showBanner: true, colorOutput: true }
      };
    }

    displayConfiguration(config);

    // Check GitHub integration if requested
    if (options.remote) {
      if (config.github && config.github.token) {
        await checkGitHubIntegration(config, repoInfo);
      } else {
        console.log(chalk.yellow('GitHub integration not configured'));
        console.log(chalk.gray('   Run "histofy config set github.token <your-token>" to enable GitHub features\n'));
      }
    }

    // Display recent commits with error handling
    await displayRecentCommits(gitManager);

  } catch (error) {
    progress.fail('Status check failed');
    
    // Handle different types of errors appropriately
    if (error instanceof GitError) {
      console.log(ErrorHandler.handleGitError(error, 'status operation'));
    } else if (error instanceof NetworkError) {
      console.log(ErrorHandler.handleNetworkError(error));
    } else if (error instanceof ConfigurationError) {
      console.log(ErrorHandler.handleConfigurationError(error));
    } else {
      console.log(ErrorHandler.formatUserFriendlyError(error, { 
        operation: 'status check',
        command: 'histofy status'
      }));
    }
    
    if (options.verbose && error.stack) {
      console.log(chalk.gray('\nStack trace:'));
      console.log(chalk.gray(error.stack));
    }
  }
}

/**
 * Display repository information
 */
function displayRepositoryInfo(repoInfo, status) {
  console.log(chalk.green('📁 Repository Information'));
  
  const repoTable = new Table({
    head: ['Property', 'Value'],
    colWidths: [20, 60],
    style: { head: ['cyan'] }
  });

  repoTable.push(
    ['Path', repoInfo.path],
    ['Branch', chalk.yellow(repoInfo.branch)],
    ['Status', status.isClean ? chalk.green('Clean') : chalk.red('Dirty')],
    ['Total Commits', repoInfo.totalCommits.toString()]
  );

  if (repoInfo.repoName) {
    repoTable.push(['GitHub Repo', chalk.blue(repoInfo.repoName)]);
  }

  console.log(repoTable.toString());
  console.log();

  // Display working directory status if not clean
  if (!status.isClean) {
    console.log(chalk.yellow('📝 Working Directory Status'));
    
    if (status.staged.length > 0) {
      console.log(chalk.green('   Staged files:'));
      status.staged.forEach(file => console.log(`     + ${file}`));
    }
    
    if (status.modified.length > 0) {
      console.log(chalk.red('   Modified files:'));
      status.modified.forEach(file => console.log(`     M ${file}`));
    }
    
    if (status.untracked.length > 0) {
      console.log(chalk.red('   Untracked files:'));
      status.untracked.forEach(file => console.log(`     ? ${file}`));
    }
    
    console.log();
  }
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
  console.log(chalk.green('⚙️  Configuration'));
  
  const configTable = new Table({
    head: ['Setting', 'Value'],
    colWidths: [25, 55],
    style: { head: ['cyan'] }
  });

  configTable.push(
    ['GitHub Token', config.github.token ? chalk.green('✅ Configured') : chalk.red('❌ Not set')],
    ['GitHub Username', config.github.username || chalk.gray('Not set')],
    ['Default Repository', config.github.defaultRepo || chalk.gray('Not set')],
    ['Default Author', config.git.defaultAuthor || chalk.gray('Not set')],
    ['Default Time', config.git.defaultTime || '12:00'],
    ['Show Banner', config.ui.showBanner ? 'Yes' : 'No'],
    ['Color Output', config.ui.colorOutput ? 'Yes' : 'No']
  );

  console.log(configTable.toString());
  console.log();

  // Configuration paths
  const paths = new ConfigManager().getPaths();
  console.log(chalk.gray('📂 Configuration Paths:'));
  console.log(chalk.gray(`   Config: ${paths.configFile}`));
  console.log();
}

/**
 * Check GitHub integration
 */
async function checkGitHubIntegration(config, repoInfo) {
  const progress = ProgressUtils.spinner('Checking GitHub integration...');
  progress.start();
  
  try {
    // Validate GitHub token first
    if (!config.github.token) {
      progress.fail('GitHub token not configured');
      console.log(chalk.yellow('GitHub integration not configured'));
      console.log(chalk.gray('   Run "histofy config set github.token <your-token>" to enable GitHub features\n'));
      return;
    }

    const tokenValidation = EnhancedValidationUtils.validateGitHubToken(config.github.token);
    if (!tokenValidation.isValid) {
      progress.fail('Invalid GitHub token');
      console.log(ErrorHandler.handleValidationError(tokenValidation, 'GitHub token validation'));
      return;
    }

    const githubManager = new GitHubManager(config.github.token);
    
    // Test connection with retry mechanism
    let connection;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        connection = await githubManager.testConnection();
        break;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        progress.update(`Retrying GitHub connection... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      }
    }
    
    if (connection.success) {
      progress.succeed('GitHub integration active');
      
      console.log(chalk.green('GitHub Integration'));
      const githubTable = new Table({
        head: ['Property', 'Value'],
        colWidths: [20, 60],
        style: { head: ['cyan'] }
      });

      githubTable.push(
        ['Username', chalk.yellow(connection.user.login)],
        ['Name', connection.user.name || 'Not set'],
        ['Public Repos', connection.user.public_repos.toString()],
        ['Private Repos', connection.user.total_private_repos?.toString() || 'N/A']
      );

      console.log(githubTable.toString());

      // Check repository access if we have a GitHub repo
      if (repoInfo.repoName) {
        const repoProgress = ProgressUtils.spinner(`Checking repository access for ${repoInfo.repoName}...`);
        repoProgress.start();
        
        try {
          const [owner, repo] = repoInfo.repoName.split('/');
          const repoAccess = await githubManager.validateRepoAccess(owner, repo);
          
          if (repoAccess.success) {
            repoProgress.succeed(`Repository access confirmed for ${repoInfo.repoName}`);
            console.log(chalk.gray(`   Can push: ${repoAccess.canPush ? 'Yes' : 'No'}`));
            console.log(chalk.gray(`   Private: ${repoAccess.isPrivate ? 'Yes' : 'No'}`));
          } else {
            repoProgress.fail(`Repository access failed for ${repoInfo.repoName}`);
            
            // Determine error type and provide appropriate handling
            if (repoAccess.error && repoAccess.error.includes('404')) {
              const networkError = new NetworkError(repoAccess.error, null, 404, false);
              console.log(ErrorHandler.handleNetworkError(networkError));
            } else {
              console.log(chalk.red(`Repository access error: ${repoAccess.error}`));
            }
          }
        } catch (error) {
          repoProgress.fail('Repository access check failed');
          const networkError = new NetworkError(error.message, null, null, true);
          console.log(ErrorHandler.handleNetworkError(networkError));
        }
      }
      
      console.log();
    } else {
      progress.fail('GitHub integration failed');
      
      // Handle different types of connection failures
      if (connection.error) {
        if (connection.error.includes('401') || connection.error.includes('Unauthorized')) {
          const networkError = new NetworkError(connection.error, null, 401, false);
          console.log(ErrorHandler.handleNetworkError(networkError));
        } else if (connection.error.includes('403') || connection.error.includes('rate limit')) {
          const networkError = new NetworkError(connection.error, null, 403, true);
          console.log(ErrorHandler.handleNetworkError(networkError));
        } else {
          console.log(chalk.red(`GitHub API Error: ${connection.error}`));
          console.log(chalk.gray('   Check your GitHub token configuration\n'));
        }
      }
    }
  } catch (error) {
    progress.fail('GitHub integration check failed');
    
    // Handle network errors specifically
    if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      const networkError = new NetworkError(error.message, 'https://api.github.com', null, true);
      console.log(ErrorHandler.handleNetworkError(networkError));
    } else {
      console.log(ErrorHandler.formatUserFriendlyError(error, { operation: 'GitHub integration check' }));
    }
  }
}

/**
 * Display recent commits
 */
async function displayRecentCommits(gitManager) {
  const progress = ProgressUtils.spinner('Loading recent commits...');
  progress.start();
  
  try {
    const commits = await gitManager.getCommitHistory({ limit: 5 });
    progress.succeed('Recent commits loaded');
    
    if (commits.length === 0) {
      console.log(chalk.yellow('No commits found'));
      console.log(chalk.gray('   This repository has no commits yet\n'));
      return;
    }

    console.log(chalk.green('Recent Commits (5 most recent)'));
    
    const commitTable = new Table({
      head: ['Hash', 'Date', 'Author', 'Message'],
      colWidths: [10, 20, 20, 40],
      style: { head: ['cyan'] }
    });

    commits.forEach(commit => {
      const shortHash = commit.hash.substring(0, 8);
      const date = new Date(commit.date).toLocaleDateString();
      const message = commit.message.length > 35 
        ? commit.message.substring(0, 35) + '...' 
        : commit.message;

      commitTable.push([
        chalk.yellow(shortHash),
        date,
        commit.author,
        message.split('\n')[0] // Only first line of commit message
      ]);
    });

    console.log(commitTable.toString());
    console.log();
  } catch (error) {
    progress.fail('Failed to load recent commits');
    const gitError = new GitError(error.message, 'commit history retrieval', error);
    console.log(ErrorHandler.handleGitError(gitError, 'getting recent commits'));
  }
}

module.exports = statusCommand;
