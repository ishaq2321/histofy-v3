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
const { 
  EnhancedValidationUtils, 
  ErrorHandler, 
  ValidationError, 
  GitError,
  ProgressUtils 
} = require('../utils');
const DryRunManager = require('../utils/DryRunManager');

/**
 * Handle migrate command
 */
async function migrateCommand(commitRange, options) {
  const progress = ProgressUtils.spinner('Initializing migration process...');
  
  try {
    console.log(chalk.blue('Histofy Commit Migration\n'));
    progress.start();

    // Validate inputs first
    progress.update('Validating inputs...');
    
    // Validate commit range
    const rangeValidation = EnhancedValidationUtils.validateCommitRange(commitRange);
    if (!rangeValidation.isValid) {
      progress.fail('Input validation failed');
      console.log(ErrorHandler.handleValidationError(rangeValidation, 'commit range validation'));
      return;
    }

    // Validate target date
    const dateValidation = EnhancedValidationUtils.validateDate(options.toDate);
    if (!dateValidation.isValid) {
      progress.fail('Input validation failed');
      console.log(ErrorHandler.handleValidationError(dateValidation, 'target date validation'));
      return;
    }

    // Validate spread days
    const spreadValidation = EnhancedValidationUtils.validateNumber(options.spread, {
      min: 1,
      max: 365,
      integer: true,
      fieldName: 'Spread days'
    });
    if (!spreadValidation.isValid) {
      progress.fail('Input validation failed');
      console.log(ErrorHandler.handleValidationError(spreadValidation, 'spread days validation'));
      return;
    }

    // Validate start time
    const timeValidation = EnhancedValidationUtils.validateTime(options.startTime);
    if (!timeValidation.isValid) {
      progress.fail('Input validation failed');
      console.log(ErrorHandler.handleValidationError(timeValidation, 'start time validation'));
      return;
    }

    progress.succeed('Input validation completed');

    // Initialize Git Manager and validate repository
    const gitManager = new GitManager();
    
    progress.start('Validating Git repository...');
    const repoValidation = await EnhancedValidationUtils.validateGitRepository();
    if (!repoValidation.isValid) {
      progress.fail('Repository validation failed');
      console.log(ErrorHandler.handleValidationError(repoValidation, 'Git repository check'));
      return;
    }
    progress.succeed('Git repository validated');

    // Display migration parameters
    console.log(chalk.blue(`Analyzing commit range: ${rangeValidation.value}`));
    console.log(chalk.blue(`Target date: ${dateValidation.value}`));
    console.log(chalk.blue(`Spread over: ${spreadValidation.value} day(s)`));
    console.log(chalk.blue(`Starting time: ${timeValidation.value}\n`));

    // Analyze commits with enhanced progress reporting
    const analysisProgress = ProgressUtils.progressBar('Analyzing commits...', 100);
    analysisProgress.start();
    
    // Set up progress callback for GitManager
    gitManager.setProgressCallback((message, progress) => {
      if (progress !== null) {
        analysisProgress.update(progress, message);
      } else {
        analysisProgress.update(message);
      }
    });
    
    let result;
    try {
      result = await gitManager.migrateCommits(
        rangeValidation.value,
        dateValidation.value,
        spreadValidation.value,
        timeValidation.value
      );
      analysisProgress.succeed('Commit analysis completed');
    } catch (error) {
      if (error.message.includes('cancelled')) {
        analysisProgress.cancel('Analysis cancelled by user');
      } else {
        analysisProgress.fail('Commit analysis failed');
        const gitError = new GitError(error.message, 'commit analysis', error);
        console.log(ErrorHandler.handleGitError(gitError, 'analyzing commits for migration'));
      }
      return;
    }

    if (result.success) {
      console.log(chalk.green('Migration plan generated\n'));
      
      // Validate that we have commits to migrate
      if (!result.commits || result.commits.length === 0) {
        const validationError = new ValidationError(
          'No commits found in the specified range',
          'commit_range',
          'Please verify the commit range exists and contains commits'
        );
        console.log(ErrorHandler.handleValidationError(validationError, 'migration planning'));
        return;
      }
      
      // Display migration plan
      console.log(chalk.yellow('Migration Plan:'));
      result.commits.forEach((commit, index) => {
        console.log(`   ${index + 1}. ${chalk.cyan(commit.originalHash.substring(0, 8))} → ${chalk.yellow(commit.newDate)}`);
        console.log(`      ${chalk.gray(commit.message.split('\n')[0])}`);
        console.log(`      ${chalk.gray(`Author: ${commit.author}`)}`);
        console.log();
      });

      if (result.warning) {
        console.log(chalk.yellow(`Warning: ${result.warning}`));
      }

      // Handle dry-run mode
      if (options.dryRun) {
        console.log(chalk.cyan('\n🔍 DRY RUN MODE - No changes will be made\n'));
        
        const migrationData = {
          commits: result.commits,
          strategy: result.strategy || 'interactive-rebase',
          targetDate: dateValidation.value,
          spread: spreadValidation.value
        };

        const dryRun = DryRunManager.forMigrationOperation(migrationData);
        const summary = dryRun.displayPreview({
          showDetails: true,
          showWarnings: true,
          showGitCommands: false // Git commands are complex for migration
        });

        console.log(chalk.blue('\n💡 To execute this migration, run the same command with --execute instead of --dry-run'));
        
        return {
          success: true,
          dryRun: true,
          summary,
          commits: result.commits,
          message: 'Migration dry-run completed successfully'
        };
      }

      // Check if execute flag is provided
      if (options.execute) {
        console.log(chalk.blue('\nExecuting migration...\n'));
        
        const executionProgress = ProgressUtils.spinner('Executing migration...');
        executionProgress.start();
        
        // Validate repository state before execution
        const repoValidation = await gitManager.validateRepositoryForMigration();
        if (!repoValidation.success) {
          executionProgress.fail('Repository validation failed');
          console.log(chalk.red('Repository is not ready for migration:'));
          repoValidation.issues.forEach(issue => {
            console.log(chalk.red(`   - ${issue}`));
          });
          if (repoValidation.warnings.length > 0) {
            console.log(chalk.yellow('Warnings:'));
            repoValidation.warnings.forEach(warning => {
              console.log(chalk.yellow(`   - ${warning}`));
            });
          }
          console.log(chalk.blue('\nPlease resolve these issues and try again.'));
          return;
        }

        // Set up progress callback for execution
        gitManager.setProgressCallback((message, progress) => {
          if (progress !== null) {
            executionProgress.update(progress, message);
          } else {
            executionProgress.update(message);
          }
        });

        // Check for conflict resolution options
        const migrationOptions = {
          createBackup: options.backup !== false,
          rollbackOnFailure: options.rollback !== false
        };

        // Add auto-resolve strategy if specified
        if (options.autoResolve) {
          const validStrategies = ['theirs', 'ours'];
          if (validStrategies.includes(options.autoResolve)) {
            migrationOptions.autoResolveStrategy = options.autoResolve;
            console.log(chalk.blue(`Using automatic conflict resolution: ${options.autoResolve}`));
          } else {
            console.log(chalk.yellow(`Warning: Invalid auto-resolve strategy '${options.autoResolve}'. Valid options: ${validStrategies.join(', ')}`));
          }
        }

        if (!migrationOptions.createBackup) {
          console.log(chalk.yellow('⚠️  Backup creation disabled - migration cannot be automatically rolled back'));
        }

        if (!migrationOptions.rollbackOnFailure) {
          console.log(chalk.yellow('⚠️  Automatic rollback disabled - manual recovery may be required on failure'));
        }

        let executeResult;
        try {
          executeResult = await gitManager.executeMigrationWithConflictResolution(result.commits, migrationOptions);
          
          if (executeResult.success) {
            executionProgress.succeed('Migration completed successfully');
            console.log(chalk.green('Migration completed successfully!'));
            
            // Display migration details
            if (executeResult.migrationResult) {
              const migResult = executeResult.migrationResult;
              if (migResult.migratedCount !== undefined) {
                console.log(chalk.gray(`   ${migResult.migratedCount}/${migResult.totalCommits} commit(s) migrated`));
              }
            }
            
            // Show conflict resolution information
            if (executeResult.conflictsEncountered) {
              console.log(chalk.yellow('   ⚠️  Conflicts were encountered and resolved during migration'));
            }
            
            if (executeResult.backupBranch) {
              console.log(chalk.blue(`   Backup created: ${executeResult.backupBranch}`));
            }
            
            // Validate migration integrity if we have the original commits
            if (executeResult.migrationResult && executeResult.migrationResult.migrations) {
              const validation = await gitManager.validateCommitIntegrity(result.commits, executeResult.migrationResult.migrations);
              if (validation.success) {
                console.log(chalk.green('   Migration integrity verified'));
              } else {
                console.log(chalk.yellow('   Migration completed with integrity warnings:'));
                validation.issues.forEach(issue => {
                  console.log(chalk.yellow(`     - ${issue}`));
                });
              }
            }
            
            console.log(chalk.blue('\nNext steps:'));
            console.log(chalk.gray('1. Verify the changes with: git log --oneline -10'));
            console.log(chalk.gray('2. Check commit dates with: git log --pretty=format:"%h %ad %s" --date=short'));
            console.log(chalk.gray('3. Push changes with: git push --force-with-lease origin <branch>'));
            if (executeResult.backupBranch) {
              console.log(chalk.gray(`4. Delete backup when satisfied: git branch -D ${executeResult.backupBranch}`));
            }
          } else if (executeResult.aborted) {
            executionProgress.info('Migration aborted by user');
            console.log(chalk.yellow('Migration was aborted during conflict resolution'));
            
            if (executeResult.backupBranch) {
              console.log(chalk.blue(`Backup branch available: ${executeResult.backupBranch}`));
              console.log(chalk.gray('You can manually restore with: git reset --hard ' + executeResult.backupBranch));
            }
          } else if (executeResult.rolledBack) {
            executionProgress.warn('Migration failed but was rolled back successfully');
            console.log(chalk.yellow('Migration failed but repository was restored to original state'));
            console.log(chalk.red(`Error: ${executeResult.error}`));
            
            if (executeResult.rollbackResult) {
              console.log(chalk.green('✅ Rollback completed successfully'));
            }
          } else if (executeResult.rollbackFailed) {
            executionProgress.fail('Migration and rollback both failed');
            console.log(chalk.red('❌ Migration failed and rollback was unsuccessful'));
            console.log(chalk.red(`Migration error: ${executeResult.error}`));
            console.log(chalk.red(`Rollback error: ${executeResult.rollbackError}`));
            
            if (executeResult.backupBranch) {
              console.log(chalk.yellow(`\n⚠️  Manual recovery required!`));
              console.log(chalk.blue(`Backup branch: ${executeResult.backupBranch}`));
              console.log(chalk.gray('Manually restore with: git reset --hard ' + executeResult.backupBranch));
            }
          } else {
            executionProgress.fail('Migration execution failed');
            const gitError = new GitError(executeResult.error, 'migration execution');
            console.log(ErrorHandler.handleGitError(gitError, 'executing migration'));
            
            if (executeResult.suggestion) {
              console.log(chalk.yellow(`\nSuggestion: ${executeResult.suggestion}`));
            }
          }
        } catch (error) {
          executionProgress.fail('Migration execution failed');
          
          if (error.message.includes('cancelled')) {
            console.log(chalk.yellow('Migration cancelled by user'));
          } else {
            const gitError = new GitError(error.message, 'migration execution', error);
            console.log(ErrorHandler.handleGitError(gitError, 'executing migration'));
          }
        }
      } else {
        console.log(chalk.blue('\nTo execute this migration:'));
        console.log(chalk.gray(`   histofy migrate ${commitRange} --to-date "${options.toDate}" --execute`));
        console.log(chalk.blue('\nOr complete manually:'));
        console.log(chalk.gray('1. This operation requires interactive rebase'));
        console.log(chalk.gray('2. Use git rebase -i to manually adjust commit dates'));
        console.log(chalk.gray('3. Or use a specialized tool for batch date modification'));
      }
    } else {
      const gitError = new GitError(result.error || 'Migration planning failed', 'migration planning');
      console.log(ErrorHandler.handleGitError(gitError, 'generating migration plan'));
    }
    
  } catch (error) {
    progress.fail('Migration operation failed');
    
    // Handle different types of errors appropriately
    if (error instanceof ValidationError) {
      console.log(ErrorHandler.handleValidationError(error, 'migration operation'));
    } else if (error instanceof GitError) {
      console.log(ErrorHandler.handleGitError(error, 'migration operation'));
    } else {
      console.log(ErrorHandler.formatUserFriendlyError(error, { 
        operation: 'migration operation',
        command: 'histofy migrate',
        args: { commitRange, ...options }
      }));
    }
    
    if (options.verbose && error.stack) {
      console.log(chalk.gray('\nStack trace:'));
      console.log(chalk.gray(error.stack));
    }
  }
}

module.exports = migrateCommand;
