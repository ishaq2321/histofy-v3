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

const configManager = new ConfigManager();

/**
 * Handle status command
 */
async function statusCommand(options) {
  const spinner = ora();
  
  try {
    console.log(chalk.blue('📊 Histofy Status Report\n'));

    // Check git repository
    spinner.start('Checking git repository...');
    const gitManager = new GitManager();
    const isGitRepo = await gitManager.isGitRepo();
    spinner.stop();

    if (!isGitRepo) {
      console.log(chalk.red('❌ Not in a git repository'));
      console.log(chalk.gray('   Run "git init" to initialize a repository\n'));
      return;
    }

    // Get repository information
    spinner.start('Getting repository information...');
    const repoInfo = await gitManager.getRepoInfo();
    const status = await gitManager.getStatus();
    spinner.stop();

    // Display repository information
    displayRepositoryInfo(repoInfo, status);

    // Get configuration
    const config = await configManager.loadConfig();
    displayConfiguration(config);

    // Check GitHub integration if requested
    if (options.remote && config.github.token) {
      await checkGitHubIntegration(config, repoInfo);
    } else if (options.remote && !config.github.token) {
      console.log(chalk.yellow('⚠️  GitHub integration not configured'));
      console.log(chalk.gray('   Run "histofy config set github.token <your-token>" to enable GitHub features\n'));
    }

    // Display recent commits
    await displayRecentCommits(gitManager);

  } catch (error) {
    spinner.fail('Failed to get status');
    console.error(chalk.red(`Error: ${error.message}`));
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
  console.log(chalk.gray(`   Patterns: ${paths.patternsDir}`));
  console.log();
}

/**
 * Check GitHub integration
 */
async function checkGitHubIntegration(config, repoInfo) {
  const spinner = ora('Checking GitHub integration...').start();
  
  try {
    const githubManager = new GitHubManager(config.github.token);
    const connection = await githubManager.testConnection();
    
    if (connection.success) {
      spinner.succeed('GitHub integration active');
      
      console.log(chalk.green('🐙 GitHub Integration'));
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
        const [owner, repo] = repoInfo.repoName.split('/');
        const repoAccess = await githubManager.validateRepoAccess(owner, repo);
        
        if (repoAccess.success) {
          console.log(chalk.green(`✅ Repository access confirmed for ${repoInfo.repoName}`));
          console.log(chalk.gray(`   Can push: ${repoAccess.canPush ? 'Yes' : 'No'}`));
          console.log(chalk.gray(`   Private: ${repoAccess.isPrivate ? 'Yes' : 'No'}`));
        } else {
          console.log(chalk.red(`❌ Repository access failed: ${repoAccess.error}`));
        }
      }
      
      console.log();
    } else {
      spinner.fail('GitHub integration failed');
      console.log(chalk.red(`❌ GitHub API Error: ${connection.error}`));
      console.log(chalk.gray('   Check your GitHub token configuration\n'));
    }
  } catch (error) {
    spinner.fail('GitHub integration check failed');
    console.error(chalk.red(`Error: ${error.message}\n`));
  }
}

/**
 * Display recent commits
 */
async function displayRecentCommits(gitManager) {
  try {
    const commits = await gitManager.getCommitHistory({ limit: 5 });
    
    if (commits.length === 0) {
      console.log(chalk.yellow('📝 No commits found'));
      return;
    }

    console.log(chalk.green('📝 Recent Commits (5 most recent)'));
    
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
    console.log(chalk.red('❌ Failed to get recent commits'));
    console.log(chalk.gray(`   Error: ${error.message}\n`));
  }
}

module.exports = statusCommand;
