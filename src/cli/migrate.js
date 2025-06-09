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

      // Check if execute flag is provided
      if (options.execute) {
        console.log(chalk.blue('\n🚀 Executing migration...\n'));
        
        const executeResult = await gitManager.executeMigration(result.commits);
        
        if (executeResult.success) {
          console.log(chalk.green('✅ Migration completed successfully!'));
          console.log(chalk.gray(`   ${executeResult.migratedCount} commit(s) migrated`));
          console.log(chalk.blue('\n💡 Next steps:'));
          console.log(chalk.gray('1. Verify the changes with: git log --oneline -10'));
          console.log(chalk.gray('2. Push changes with: git push --force-with-lease origin <branch>'));
        } else {
          console.error(chalk.red(`❌ Migration execution failed: ${executeResult.error}`));
        }
      } else {
        console.log(chalk.blue('\n💡 To execute this migration:'));
        console.log(chalk.gray(`   histofy migrate ${commitRange} --to-date "${options.toDate}" --execute`));
        console.log(chalk.blue('\n💡 Or complete manually:'));
        console.log(chalk.gray('1. This operation requires interactive rebase'));
        console.log(chalk.gray('2. Use git rebase -i to manually adjust commit dates'));
        console.log(chalk.gray('3. Or use a specialized tool for batch date modification'));
      }
    } else {
      console.error(chalk.red(`❌ Migration failed: ${result.error}`));
    }
    
  } catch (error) {
    spinner.fail('Migration failed');
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

module.exports = migrateCommand;
