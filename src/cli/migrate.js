const chalk = require('chalk');
const ora = require('ora');
const GitManager = require('../core/GitManager');

/**
 * Handle migrate command
 */
async function migrateCommand(commitRange, options) {
  const spinner = ora();
  
  try {
    console.log(chalk.blue('🔄 Histofy Commit Migration\n'));

    // Initialize Git Manager
    const gitManager = new GitManager();
    
    // Check if we're in a git repository
    if (!(await gitManager.isGitRepo())) {
      console.error(chalk.red('❌ Not in a git repository'));
      return;
    }

    console.log(chalk.blue(`📝 Analyzing commit range: ${commitRange}`));
    console.log(chalk.blue(`🎯 Target date: ${options.toDate}`));
    console.log(chalk.blue(`📅 Spread over: ${options.spread} day(s)`));
    console.log(chalk.blue(`⏰ Starting time: ${options.startTime}\n`));

    spinner.start('Analyzing commits...');
    
    // Get migration plan
    const result = await gitManager.migrateCommits(
      commitRange,
      options.toDate,
      parseInt(options.spread),
      options.startTime
    );

    spinner.stop();

    if (result.success) {
      console.log(chalk.green('✅ Migration plan generated\n'));
      
      // Display migration plan
      console.log(chalk.yellow('📋 Migration Plan:'));
      result.commits.forEach((commit, index) => {
        console.log(`   ${index + 1}. ${chalk.cyan(commit.originalHash.substring(0, 8))} → ${chalk.yellow(commit.newDate)}`);
        console.log(`      ${chalk.gray(commit.message.split('\n')[0])}`);
        console.log(`      ${chalk.gray(`Author: ${commit.author}`)}`);
        console.log();
      });

      if (result.warning) {
        console.log(chalk.yellow(`⚠️  ${result.warning}`));
      }

      console.log(chalk.blue('\n💡 To complete the migration:'));
      console.log(chalk.gray('1. This operation requires interactive rebase'));
      console.log(chalk.gray('2. Use git rebase -i to manually adjust commit dates'));
      console.log(chalk.gray('3. Or use a specialized tool for batch date modification'));
      
    } else {
      console.error(chalk.red(`❌ Migration failed: ${result.error}`));
    }
    
  } catch (error) {
    spinner.fail('Migration failed');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

module.exports = migrateCommand;
