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
 * Handle enhanced status command with health checks and actionable suggestions
 */
async function statusCommand(options) {
  const progress = ProgressUtils.spinner('Initializing comprehensive status check...');
  
  try {
    // Display enhanced header with system info
    displayStatusHeader();
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

    // Perform comprehensive health check
    const healthCheck = await performHealthCheck(gitManager, repoInfo, status);
    
    // Display repository information with health indicators
    displayEnhancedRepositoryInfo(repoInfo, status, healthCheck);

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

    displayEnhancedConfiguration(config, healthCheck);

    // Check GitHub integration if requested
    if (options.remote) {
      if (config.github && config.github.token) {
        await checkGitHubIntegration(config, repoInfo);
      } else {
        displayGitHubSetupSuggestions();
      }
    }

    // Display recent commits with enhanced information
    await displayEnhancedRecentCommits(gitManager, options.verbose);
    
    // Display actionable suggestions based on repository state
    displayActionableSuggestions(repoInfo, status, config, healthCheck);
    
    // Display system health summary
    displayHealthSummary(healthCheck);

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

/**
 * Display enhanced status header with system information
 */
function displayStatusHeader() {
  const now = new Date();
  const nodeVersion = process.version;
  const platform = process.platform;
  
  console.log(chalk.blue('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║                 Histofy Status Report                   ║'));
  console.log(chalk.blue('╚══════════════════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray(`Generated: ${now.toLocaleString()}`));
  console.log(chalk.gray(`System: ${platform} | Node.js: ${nodeVersion}`));
  console.log();
}

/**
 * Perform comprehensive health check
 */
async function performHealthCheck(gitManager, repoInfo, status) {
  const healthCheck = {
    overall: 'healthy',
    issues: [],
    warnings: [],
    suggestions: [],
    scores: {
      repository: 100,
      configuration: 100,
      performance: 100,
      security: 100
    }
  };

  try {
    // Check repository health
    if (!status.isClean) {
      healthCheck.warnings.push('Repository has uncommitted changes');
      healthCheck.scores.repository -= 10;
    }

    // Check for large files
    const largeFiles = await checkForLargeFiles(gitManager);
    if (largeFiles.length > 0) {
      healthCheck.warnings.push(`Found ${largeFiles.length} large files (>10MB)`);
      healthCheck.suggestions.push('Consider using Git LFS for large files');
      healthCheck.scores.performance -= 15;
    }

    // Check commit frequency
    const commitStats = await getCommitStats(gitManager);
    if (commitStats.daysSinceLastCommit > 30) {
      healthCheck.warnings.push('No commits in the last 30 days');
      healthCheck.suggestions.push('Regular commits help maintain project momentum');
      healthCheck.scores.repository -= 5;
    }

    // Check for security issues
    const securityIssues = await checkSecurityIssues(gitManager);
    if (securityIssues.length > 0) {
      healthCheck.issues.push(...securityIssues);
      healthCheck.scores.security -= 20 * securityIssues.length;
    }

    // Calculate overall health
    const avgScore = Object.values(healthCheck.scores).reduce((a, b) => a + b, 0) / 4;
    if (avgScore >= 90) {
      healthCheck.overall = 'excellent';
    } else if (avgScore >= 75) {
      healthCheck.overall = 'good';
    } else if (avgScore >= 60) {
      healthCheck.overall = 'fair';
    } else {
      healthCheck.overall = 'poor';
    }

  } catch (error) {
    healthCheck.issues.push('Health check partially failed');
    healthCheck.overall = 'unknown';
  }

  return healthCheck;
}

/**
 * Check for large files in repository
 */
async function checkForLargeFiles(gitManager) {
  try {
    // This would need to be implemented in GitManager
    // For now, return empty array
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Get commit statistics
 */
async function getCommitStats(gitManager) {
  try {
    const commits = await gitManager.getCommitHistory({ limit: 100 });
    if (commits.length === 0) {
      return { daysSinceLastCommit: 0, totalCommits: 0, avgCommitsPerWeek: 0 };
    }

    const lastCommitDate = new Date(commits[0].date);
    const daysSinceLastCommit = Math.floor((Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate average commits per week over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCommits = commits.filter(c => new Date(c.date) > thirtyDaysAgo);
    const avgCommitsPerWeek = (recentCommits.length / 30) * 7;

    return {
      daysSinceLastCommit,
      totalCommits: commits.length,
      avgCommitsPerWeek: Math.round(avgCommitsPerWeek * 10) / 10
    };
  } catch (error) {
    return { daysSinceLastCommit: 0, totalCommits: 0, avgCommitsPerWeek: 0 };
  }
}

/**
 * Check for security issues
 */
async function checkSecurityIssues(gitManager) {
  const issues = [];
  
  try {
    // Check for sensitive files in repository
    const status = await gitManager.getStatus();
    const allFiles = [...status.staged, ...status.modified, ...status.untracked];
    
    const sensitivePatterns = [
      /\.env$/,
      /\.key$/,
      /\.pem$/,
      /password/i,
      /secret/i,
      /token/i,
      /config\.json$/,
      /\.ssh\//
    ];

    allFiles.forEach(file => {
      if (sensitivePatterns.some(pattern => pattern.test(file))) {
        issues.push(`Potentially sensitive file detected: ${file}`);
      }
    });

  } catch (error) {
    // Ignore errors in security check
  }

  return issues;
}

/**
 * Display enhanced repository information with health indicators
 */
function displayEnhancedRepositoryInfo(repoInfo, status, healthCheck) {
  console.log(chalk.green('📁 Repository Health & Information'));
  
  // Health indicator
  const healthColor = {
    'excellent': 'green',
    'good': 'cyan',
    'fair': 'yellow',
    'poor': 'red',
    'unknown': 'gray'
  }[healthCheck.overall];
  
  const healthIcon = {
    'excellent': '🟢',
    'good': '🔵', 
    'fair': '🟡',
    'poor': '🔴',
    'unknown': '⚪'
  }[healthCheck.overall];

  console.log(`   ${healthIcon} Overall Health: ${chalk[healthColor](healthCheck.overall.toUpperCase())}`);
  console.log();

  const repoTable = new Table({
    head: ['Property', 'Value', 'Status'],
    colWidths: [20, 40, 20],
    style: { head: ['cyan'] }
  });

  // Repository basic info
  repoTable.push(
    ['Path', repoInfo.path, '📂'],
    ['Branch', chalk.yellow(repoInfo.branch), repoInfo.branch === 'main' || repoInfo.branch === 'master' ? '✅' : '⚠️'],
    ['Working Directory', status.isClean ? chalk.green('Clean') : chalk.red('Dirty'), status.isClean ? '✅' : '⚠️'],
    ['Total Commits', repoInfo.totalCommits.toString(), repoInfo.totalCommits > 0 ? '✅' : '⚠️']
  );

  if (repoInfo.repoName) {
    repoTable.push(['GitHub Repository', chalk.blue(repoInfo.repoName), '🔗']);
  }

  console.log(repoTable.toString());
  console.log();

  // Display detailed working directory status with color coding
  if (!status.isClean) {
    console.log(chalk.yellow('📝 Working Directory Changes'));
    
    if (status.staged.length > 0) {
      console.log(chalk.green(`   ✅ Staged files (${status.staged.length}):`));
      status.staged.slice(0, 10).forEach(file => console.log(`     ${chalk.green('+')} ${file}`));
      if (status.staged.length > 10) {
        console.log(chalk.gray(`     ... and ${status.staged.length - 10} more`));
      }
    }
    
    if (status.modified.length > 0) {
      console.log(chalk.red(`   📝 Modified files (${status.modified.length}):`));
      status.modified.slice(0, 10).forEach(file => console.log(`     ${chalk.red('M')} ${file}`));
      if (status.modified.length > 10) {
        console.log(chalk.gray(`     ... and ${status.modified.length - 10} more`));
      }
    }
    
    if (status.untracked.length > 0) {
      console.log(chalk.red(`   ❓ Untracked files (${status.untracked.length}):`));
      status.untracked.slice(0, 10).forEach(file => console.log(`     ${chalk.red('?')} ${file}`));
      if (status.untracked.length > 10) {
        console.log(chalk.gray(`     ... and ${status.untracked.length - 10} more`));
      }
    }
    
    console.log();
  }
}

/**
 * Display enhanced configuration with health scores
 */
function displayEnhancedConfiguration(config, healthCheck) {
  console.log(chalk.green('⚙️  Configuration & Setup'));
  
  const configTable = new Table({
    head: ['Setting', 'Value', 'Status'],
    colWidths: [25, 35, 20],
    style: { head: ['cyan'] }
  });

  // Configuration status with recommendations
  const tokenStatus = config.github?.token ? 
    { value: chalk.green('✅ Configured'), status: '✅' } : 
    { value: chalk.red('❌ Not set'), status: '⚠️' };

  const usernameStatus = config.github?.username ? 
    { value: config.github.username, status: '✅' } : 
    { value: chalk.gray('Not set'), status: '⚠️' };

  const authorStatus = config.git?.defaultAuthor ? 
    { value: config.git.defaultAuthor, status: '✅' } : 
    { value: chalk.gray('Not set'), status: '⚠️' };

  const emailStatus = config.git?.defaultEmail ? 
    { value: config.git.defaultEmail, status: '✅' } : 
    { value: chalk.gray('Not set'), status: '⚠️' };

  configTable.push(
    ['GitHub Token', tokenStatus.value, tokenStatus.status],
    ['GitHub Username', usernameStatus.value, usernameStatus.status],
    ['Default Repository', config.github?.defaultRepo || chalk.gray('Not set'), config.github?.defaultRepo ? '✅' : '➖'],
    ['Default Author', authorStatus.value, authorStatus.status],
    ['Default Email', emailStatus.value, emailStatus.status],
    ['Default Time', config.git?.defaultTime || '12:00', '✅'],
    ['Show Banner', config.ui?.showBanner ? 'Yes' : 'No', '✅'],
    ['Color Output', config.ui?.colorOutput ? 'Yes' : 'No', '✅']
  );

  console.log(configTable.toString());
  
  // Configuration health score
  console.log(chalk.cyan(`   Configuration Score: ${healthCheck.scores.configuration}/100`));
  console.log();

  // Configuration paths
  const paths = new ConfigManager().getPaths();
  console.log(chalk.gray('📂 Configuration Paths:'));
  console.log(chalk.gray(`   Config: ${paths.configFile}`));
  console.log();
}

/**
 * Display GitHub setup suggestions
 */
function displayGitHubSetupSuggestions() {
  console.log(chalk.yellow('🔗 GitHub Integration Setup'));
  console.log(chalk.gray('   GitHub integration is not configured. To enable GitHub features:'));
  console.log();
  console.log(chalk.blue('   1. Generate a Personal Access Token:'));
  console.log(chalk.gray('      → Go to GitHub Settings > Developer settings > Personal access tokens'));
  console.log(chalk.gray('      → Generate new token with repo permissions'));
  console.log();
  console.log(chalk.blue('   2. Configure Histofy:'));
  console.log(chalk.cyan('      histofy config set github.token YOUR_TOKEN'));
  console.log(chalk.cyan('      histofy config set github.username YOUR_USERNAME'));
  console.log();
  console.log(chalk.blue('   3. Test the connection:'));
  console.log(chalk.cyan('      histofy status --remote'));
  console.log();
}

/**
 * Display enhanced recent commits with more information
 */
async function displayEnhancedRecentCommits(gitManager, verbose = false) {
  const progress = ProgressUtils.spinner('Loading recent commits...');
  progress.start();
  
  try {
    const limit = verbose ? 10 : 5;
    const commits = await gitManager.getCommitHistory({ limit });
    progress.succeed(`Recent commits loaded (${commits.length})`);
    
    if (commits.length === 0) {
      console.log(chalk.yellow('📝 No Commits Found'));
      console.log(chalk.gray('   This repository has no commits yet'));
      console.log(chalk.blue('   💡 Create your first commit with: histofy commit "Initial commit"'));
      console.log();
      return;
    }

    console.log(chalk.green(`📝 Recent Commits (${commits.length} most recent)`));
    
    const commitTable = new Table({
      head: verbose ? 
        ['Hash', 'Date', 'Time', 'Author', 'Message'] :
        ['Hash', 'Date', 'Author', 'Message'],
      colWidths: verbose ? [10, 12, 8, 20, 35] : [10, 20, 20, 40],
      style: { head: ['cyan'] }
    });

    commits.forEach(commit => {
      const shortHash = commit.hash.substring(0, 8);
      const commitDate = new Date(commit.date);
      const date = commitDate.toLocaleDateString();
      const time = commitDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const message = commit.message.length > (verbose ? 30 : 35) 
        ? commit.message.substring(0, verbose ? 30 : 35) + '...' 
        : commit.message;

      const row = verbose ? 
        [chalk.yellow(shortHash), date, time, commit.author, message.split('\n')[0]] :
        [chalk.yellow(shortHash), date, commit.author, message.split('\n')[0]];

      commitTable.push(row);
    });

    console.log(commitTable.toString());
    console.log();
  } catch (error) {
    progress.fail('Failed to load recent commits');
    const gitError = new GitError(error.message, 'commit history retrieval', error);
    console.log(ErrorHandler.handleGitError(gitError, 'getting recent commits'));
  }
}

/**
 * Display actionable suggestions based on repository state
 */
function displayActionableSuggestions(repoInfo, status, config, healthCheck) {
  console.log(chalk.green('💡 Actionable Suggestions'));
  
  const suggestions = [];

  // Repository-based suggestions
  if (!status.isClean) {
    if (status.staged.length > 0) {
      suggestions.push({
        icon: '✅',
        action: 'Commit staged changes',
        command: 'histofy commit "Your commit message"',
        priority: 'high'
      });
    }
    
    if (status.modified.length > 0 || status.untracked.length > 0) {
      suggestions.push({
        icon: '📝',
        action: 'Stage and commit all changes',
        command: 'histofy commit "Your message" --add-all',
        priority: 'medium'
      });
    }
  }

  // Configuration-based suggestions
  if (!config.github?.token) {
    suggestions.push({
      icon: '🔗',
      action: 'Set up GitHub integration',
      command: 'histofy config set github.token YOUR_TOKEN',
      priority: 'medium'
    });
  }

  if (!config.git?.defaultAuthor) {
    suggestions.push({
      icon: '👤',
      action: 'Set default author',
      command: 'histofy config set git.defaultAuthor "Your Name"',
      priority: 'low'
    });
  }

  if (!config.git?.defaultEmail) {
    suggestions.push({
      icon: '📧',
      action: 'Set default email',
      command: 'histofy config set git.defaultEmail "your@email.com"',
      priority: 'low'
    });
  }

  // Health-based suggestions
  healthCheck.suggestions.forEach(suggestion => {
    suggestions.push({
      icon: '⚡',
      action: suggestion,
      command: null,
      priority: 'low'
    });
  });

  // Display suggestions grouped by priority
  const priorityOrder = ['high', 'medium', 'low'];
  let hasHighPriority = false;

  priorityOrder.forEach(priority => {
    const prioritySuggestions = suggestions.filter(s => s.priority === priority);
    if (prioritySuggestions.length === 0) return;

    if (priority === 'high' && !hasHighPriority) {
      console.log(chalk.red('   🚨 High Priority:'));
      hasHighPriority = true;
    } else if (priority === 'medium') {
      console.log(chalk.yellow('   ⚠️  Medium Priority:'));
    } else if (priority === 'low') {
      console.log(chalk.blue('   💡 Recommendations:'));
    }

    prioritySuggestions.forEach(suggestion => {
      console.log(`     ${suggestion.icon} ${suggestion.action}`);
      if (suggestion.command) {
        console.log(chalk.cyan(`       → ${suggestion.command}`));
      }
    });
    console.log();
  });

  if (suggestions.length === 0) {
    console.log(chalk.green('   🎉 Everything looks good! No immediate actions needed.'));
    console.log();
  }
}

/**
 * Display health summary with scores
 */
function displayHealthSummary(healthCheck) {
  console.log(chalk.green('📊 Health Summary'));
  
  const healthTable = new Table({
    head: ['Category', 'Score', 'Status'],
    colWidths: [20, 10, 30],
    style: { head: ['cyan'] }
  });

  Object.entries(healthCheck.scores).forEach(([category, score]) => {
    const status = score >= 90 ? chalk.green('Excellent') :
                   score >= 75 ? chalk.cyan('Good') :
                   score >= 60 ? chalk.yellow('Fair') :
                   chalk.red('Needs Attention');
    
    const icon = score >= 90 ? '🟢' :
                 score >= 75 ? '🔵' :
                 score >= 60 ? '🟡' : '🔴';

    healthTable.push([
      category.charAt(0).toUpperCase() + category.slice(1),
      `${score}/100`,
      `${icon} ${status}`
    ]);
  });

  console.log(healthTable.toString());

  // Display issues and warnings
  if (healthCheck.issues.length > 0) {
    console.log(chalk.red('\n   🚨 Issues Found:'));
    healthCheck.issues.forEach(issue => {
      console.log(chalk.red(`     • ${issue}`));
    });
  }

  if (healthCheck.warnings.length > 0) {
    console.log(chalk.yellow('\n   ⚠️  Warnings:'));
    healthCheck.warnings.forEach(warning => {
      console.log(chalk.yellow(`     • ${warning}`));
    });
  }

  console.log();
  
  // Overall health message
  const overallMessage = {
    'excellent': '🎉 Your repository is in excellent condition!',
    'good': '👍 Your repository is in good shape with minor improvements possible.',
    'fair': '⚠️  Your repository needs some attention to improve its health.',
    'poor': '🚨 Your repository has significant issues that should be addressed.',
    'unknown': '❓ Unable to fully assess repository health.'
  }[healthCheck.overall];

  console.log(chalk.bold(overallMessage));
  console.log();
}

module.exports = statusCommand;
