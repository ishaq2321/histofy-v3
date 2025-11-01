/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const simpleGit = require('simple-git');
const moment = require('moment');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const GitTransaction = require('./GitTransaction');
const SecurityUtils = require('../security/SecurityUtils');

class GitManager {
  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
    this.cancelled = false;
    this.progressCallback = null;
    
    try {
      this.git = simpleGit(repoPath);
    } catch (error) {
      this.git = null;
      this._initError = error;
    }
  }

  /**
   * Set progress callback for long-running operations
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Cancel current operation
   */
  cancel() {
    this.cancelled = true;
  }

  /**
   * Check if operation was cancelled
   */
  isCancelled() {
    return this.cancelled;
  }

  /**
   * Reset cancellation state
   */
  resetCancellation() {
    this.cancelled = false;
  }

  /**
   * Report progress if callback is set
   * @param {string} message - Progress message
   * @param {number} progress - Progress percentage (0-100)
   */
  reportProgress(message, progress = null) {
    if (this.progressCallback) {
      this.progressCallback(message, progress);
    }
  }

  /**
   * Check if current directory is a git repository
   */
  async isGitRepo() {
    try {
      if (!this.git) return false;
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current repository status
   */
  async getStatus() {
    try {
      if (!this.git) {
        return {
          isGitRepo: false,
          error: 'Not a git repository or directory does not exist'
        };
      }
      
      const status = await this.git.status();
      const remotes = await this.git.getRemotes(true);
      const currentBranch = await this.git.branch();
      
      return {
        status,
        remotes,
        currentBranch: currentBranch.current,
        isClean: status.isClean(),
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added
      };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error.message}`);
    }
  }

  /**
   * Create a commit with custom date and time
   */
  async commitWithDate(message, date, time = '12:00', author = null) {
    try {
      // Parse and validate date
      const commitDate = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm');
      if (!commitDate.isValid()) {
        throw new Error('Invalid date or time format');
      }

      // Format date for git
      const gitDate = commitDate.format('YYYY-MM-DD HH:mm:ss');
      
      // Set environment variables for git commit
      const env = {
        ...process.env,
        GIT_AUTHOR_DATE: gitDate,
        GIT_COMMITTER_DATE: gitDate
      };

      if (author) {
        env.GIT_AUTHOR_NAME = author.split('<')[0].trim();
        env.GIT_AUTHOR_EMAIL = author.match(/<(.+)>/)?.[1] || '';
      }

      // Create commit with custom date
      const result = await this.git.env(env).commit(message);
      
      return {
        success: true,
        hash: result.commit,
        date: gitDate,
        message
      };
    } catch (error) {
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  }

  /**
   * Add files to staging area
   */
  async addFiles(files = '.') {
    try {
      await this.git.add(files);
      return true;
    } catch (error) {
      throw new Error(`Failed to add files: ${error.message}`);
    }
  }

  /**
   * Push commits to remote
   */
  async pushToRemote(remote = 'origin', branch = null) {
    try {
      const currentBranch = branch || (await this.git.branch()).current;
      await this.git.push(remote, currentBranch);
      return true;
    } catch (error) {
      throw new Error(`Failed to push: ${error.message}`);
    }
  }

  /**
   * Get commit history
   */
  async getCommitHistory(options = {}) {
    try {
      const log = await this.git.log({
        maxCount: options.limit || 10,
        from: options.from,
        to: options.to
      });
      
      return log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        author: commit.author_name,
        email: commit.author_email,
        message: commit.message
      }));
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error.message}`);
    }
  }

  /**
   * Migrate commits to new dates with progress reporting and cancellation support
   */
  async migrateCommits(commitRange, startDate, spreadDays = 1, startTime = '09:00') {
    try {
      this.resetCancellation();
      this.reportProgress('Analyzing commit range...', 0);
      
      let commits;
      
      // Check if operation was cancelled
      if (this.isCancelled()) {
        throw new Error('Operation cancelled by user');
      }
      
      // Check if it's a single commit hash or a range
      if (commitRange.includes('..')) {
        this.reportProgress('Fetching commit range...', 10);
        // Handle range format (e.g., HEAD~5..HEAD)
        commits = await this.git.log({
          from: commitRange.split('..')[0],
          to: commitRange.split('..')[1] || 'HEAD'
        });
      } else {
        this.reportProgress('Fetching single commit...', 10);
        // Handle single commit hash
        try {
          const singleCommit = await this.git.show([commitRange, '--format=%H|%ad|%an|%ae|%s', '--no-patch']);
          const [hash, date, authorName, authorEmail, message] = singleCommit.split('|');
          
          commits = {
            all: [{
              hash: hash,
              date: date,
              author_name: authorName,
              author_email: authorEmail,
              message: message
            }]
          };
        } catch (error) {
          throw new Error(`Invalid commit hash: ${commitRange}`);
        }
      }

      if (this.isCancelled()) {
        throw new Error('Operation cancelled by user');
      }

      if (commits.all.length === 0) {
        throw new Error('No commits found in the specified range');
      }

      this.reportProgress(`Found ${commits.all.length} commit(s) to migrate`, 30);

      const results = [];
      const baseDate = moment(startDate, 'YYYY-MM-DD');
      
      // Calculate date intervals
      const hoursInterval = (spreadDays * 24) / commits.all.length;
      let currentDate = moment(baseDate).hour(parseInt(startTime.split(':')[0])).minute(parseInt(startTime.split(':')[1]));

      this.reportProgress('Generating migration plan...', 50);

      for (let i = commits.all.length - 1; i >= 0; i--) {
        if (this.isCancelled()) {
          throw new Error('Operation cancelled by user');
        }
        
        const commit = commits.all[i];
        const newDate = currentDate.format('YYYY-MM-DD HH:mm:ss');
        
        // Report progress for each commit processed
        const progress = 50 + ((commits.all.length - 1 - i) / commits.all.length) * 40;
        this.reportProgress(`Processing commit ${commits.all.length - i}/${commits.all.length}`, Math.round(progress));
        
        results.push({
          originalHash: commit.hash,
          originalDate: commit.date,
          newDate: newDate,
          message: commit.message,
          author: commit.author_name
        });

        currentDate.add(hoursInterval, 'hours');
      }

      this.reportProgress('Migration plan completed', 100);

      return {
        success: true,
        commits: results,
        executable: true,
        strategy: this.determineMigrationStrategy(results),
        message: 'Migration plan generated and ready for execution.'
      };
    } catch (error) {
      if (error.message.includes('cancelled')) {
        throw error; // Re-throw cancellation errors as-is
      }
      throw new Error(`Failed to migrate commits: ${error.message}`);
    }
  }

  /**
   * Execute migration by actually changing commit dates using Git operations with atomic transactions
   */
  async executeMigration(migrationPlan) {
    this.resetCancellation();
    this.reportProgress('Preparing migration execution...', 0);
    
    if (!migrationPlan || migrationPlan.length === 0) {
      throw new Error('No migration plan provided');
    }

    // Use GitTransaction for atomic operations
    const result = await GitTransaction.execute(this.repoPath, async (transaction) => {
      this.reportProgress('Transaction started, validating migration plan...', 10);
      
      // Sort commits by original date to process in correct order (oldest first)
      const sortedCommits = migrationPlan.sort((a, b) => 
        new Date(a.originalDate) - new Date(b.originalDate)
      );

      // Determine migration strategy based on commit count and complexity
      const strategy = this.determineMigrationStrategy(sortedCommits);
      this.reportProgress(`Using ${strategy} strategy for ${sortedCommits.length} commit(s)...`, 20);

      let migratedCommits = [];
      let successCount = 0;

      // Execute migration based on strategy
      switch (strategy) {
        case 'filter-branch':
          const filterResult = await this.executeFilterBranchMigration(sortedCommits);
          migratedCommits = filterResult.migratedCommits;
          successCount = filterResult.successCount;
          break;
          
        case 'interactive-rebase':
          const rebaseResult = await this.executeInteractiveRebaseMigration(sortedCommits);
          migratedCommits = rebaseResult.migratedCommits;
          successCount = rebaseResult.successCount;
          break;
          
        case 'cherry-pick':
          const cherryResult = await this.executeCherryPickMigration(sortedCommits);
          migratedCommits = cherryResult.migratedCommits;
          successCount = cherryResult.successCount;
          break;
          
        default:
          throw new Error(`Unknown migration strategy: ${strategy}`);
      }

      this.reportProgress('Migration completed, validating results...', 90);

      // Validate migration integrity
      const validation = await this.validateMigrationIntegrity(migrationPlan, migratedCommits);
      if (!validation.success) {
        throw new Error(`Migration validation failed: ${validation.issues.join(', ')}`);
      }

      this.reportProgress('Migration execution completed successfully', 100);

      return {
        success: true,
        migratedCount: successCount,
        totalCommits: sortedCommits.length,
        migrations: migratedCommits,
        strategy: strategy,
        validation: validation
      };
    });

    if (result.success) {
      return {
        ...result.result,
        backupBranch: result.transaction.backupBranch,
        originalBranch: result.transaction.originalBranch,
        transactionId: result.transaction.operationId
      };
    } else {
      throw new Error(result.error);
    }
  }

  /**
   * Determine the best migration strategy based on commit characteristics
   * @param {Array} commits - Array of commits to migrate
   * @returns {string} Migration strategy ('filter-branch', 'interactive-rebase', 'cherry-pick')
   */
  determineMigrationStrategy(commits) {
    // For large numbers of commits, use filter-branch for efficiency
    if (commits.length > 20) {
      return 'filter-branch';
    }
    
    // Check for merge commits which require special handling
    const hasMergeCommits = commits.some(commit => 
      commit.parents && commit.parents.length > 1
    );
    
    if (hasMergeCommits) {
      return 'interactive-rebase';
    }
    
    // For small numbers of linear commits, use cherry-pick for precision
    if (commits.length <= 5) {
      return 'cherry-pick';
    }
    
    // Default to interactive rebase for medium-sized operations
    return 'interactive-rebase';
  }

  /**
   * Execute migration using Git filter-branch for bulk operations
   * @param {Array} commits - Commits to migrate
   * @returns {Object} Migration result
   */
  async executeFilterBranchMigration(commits) {
    this.reportProgress('Executing filter-branch migration...', 30);
    
    try {
      // Create environment filter script for commit date modification
      const commitDateMap = {};
      commits.forEach(commit => {
        commitDateMap[commit.originalHash] = commit.newDate;
      });

      // Build the environment filter script
      let envFilter = 'case $GIT_COMMIT in\n';
      Object.entries(commitDateMap).forEach(([hash, date]) => {
        envFilter += `  ${hash})\n`;
        envFilter += `    export GIT_AUTHOR_DATE="${date}"\n`;
        envFilter += `    export GIT_COMMITTER_DATE="${date}"\n`;
        envFilter += `    ;;\n`;
      });
      envFilter += 'esac';

      this.reportProgress('Running filter-branch operation...', 50);

      // Execute filter-branch with the environment filter
      await this.git.raw([
        'filter-branch',
        '-f',
        '--env-filter',
        envFilter,
        '--',
        '--all'
      ]);

      this.reportProgress('Filter-branch completed, cleaning up...', 80);

      // Clean up filter-branch backup refs
      await this.cleanupFilterBranchRefs();

      return {
        migratedCommits: commits.map(commit => ({
          ...commit,
          newHash: 'updated-by-filter-branch'
        })),
        successCount: commits.length
      };

    } catch (error) {
      throw new Error(`Filter-branch migration failed: ${error.message}`);
    }
  }

  /**
   * Execute migration using interactive rebase for complex histories
   * @param {Array} commits - Commits to migrate
   * @returns {Object} Migration result
   */
  async executeInteractiveRebaseMigration(commits) {
    this.reportProgress('Executing interactive rebase migration...', 30);
    
    try {
      const migratedCommits = [];
      let successCount = 0;

      // Process commits in chronological order
      for (let i = 0; i < commits.length; i++) {
        if (this.isCancelled()) {
          throw new Error('Operation cancelled by user');
        }

        const commit = commits[i];
        const progress = 30 + (i / commits.length) * 50;
        this.reportProgress(`Processing commit ${i + 1}/${commits.length}: ${commit.originalHash.substring(0, 8)}`, progress);

        try {
          // Checkout the specific commit
          await this.git.checkout(commit.originalHash);

          // Set the new date environment variables
          const env = {
            ...process.env,
            GIT_AUTHOR_DATE: commit.newDate,
            GIT_COMMITTER_DATE: commit.newDate
          };

          // Amend the commit with new date
          await this.git.env(env).raw(['commit', '--amend', '--no-edit']);

          // Get the new commit hash
          const newCommitHash = await this.git.revparse(['HEAD']);

          migratedCommits.push({
            ...commit,
            newHash: newCommitHash.trim()
          });
          successCount++;

        } catch (error) {
          console.warn(`Failed to migrate commit ${commit.originalHash}: ${error.message}`);
        }
      }

      return {
        migratedCommits,
        successCount
      };

    } catch (error) {
      throw new Error(`Interactive rebase migration failed: ${error.message}`);
    }
  }

  /**
   * Execute migration using cherry-pick for precise control
   * @param {Array} commits - Commits to migrate
   * @returns {Object} Migration result
   */
  async executeCherryPickMigration(commits) {
    this.reportProgress('Executing cherry-pick migration...', 30);
    
    try {
      const migratedCommits = [];
      let successCount = 0;

      // Create a new branch for the migration
      const migrationBranch = `histofy-migration-${Date.now()}`;
      const originalBranch = (await this.git.branch()).current;

      // Find the base commit (parent of the first commit to migrate)
      const firstCommit = commits[0];
      const parents = await this.git.raw(['rev-list', '--parents', '-n', '1', firstCommit.originalHash]);
      const parentHash = parents.trim().split(' ')[1];

      if (parentHash) {
        // Create migration branch from parent commit
        await this.git.checkoutBranch(migrationBranch, parentHash);
      } else {
        // If no parent, create orphan branch
        await this.git.raw(['checkout', '--orphan', migrationBranch]);
      }

      // Cherry-pick each commit with new date
      for (let i = 0; i < commits.length; i++) {
        if (this.isCancelled()) {
          throw new Error('Operation cancelled by user');
        }

        const commit = commits[i];
        const progress = 30 + (i / commits.length) * 50;
        this.reportProgress(`Cherry-picking commit ${i + 1}/${commits.length}: ${commit.originalHash.substring(0, 8)}`, progress);

        try {
          // Set environment variables for new date
          const env = {
            ...process.env,
            GIT_AUTHOR_DATE: commit.newDate,
            GIT_COMMITTER_DATE: commit.newDate
          };

          // Cherry-pick the commit
          await this.git.env(env).raw(['cherry-pick', commit.originalHash]);

          // Get the new commit hash
          const newCommitHash = await this.git.revparse(['HEAD']);

          migratedCommits.push({
            ...commit,
            newHash: newCommitHash.trim()
          });
          successCount++;

        } catch (error) {
          console.warn(`Failed to cherry-pick commit ${commit.originalHash}: ${error.message}`);
        }
      }

      // Switch back to original branch and reset to migration branch
      await this.git.checkout(originalBranch);
      await this.git.reset(['--hard', migrationBranch]);

      // Clean up migration branch
      await this.git.deleteLocalBranch(migrationBranch, true);

      return {
        migratedCommits,
        successCount
      };

    } catch (error) {
      throw new Error(`Cherry-pick migration failed: ${error.message}`);
    }
  }

  /**
   * Migrate a single commit using Git amend strategy
   * @param {Object} commitPlan - Single commit migration plan
   * @returns {Object} Migration result
   */
  async migrateSingleCommit(commitPlan) {
    try {
      this.reportProgress(`Migrating single commit ${commitPlan.originalHash.substring(0, 8)}...`, 50);

      // Check if we're already on the commit
      const currentCommit = await this.git.revparse(['HEAD']);
      
      if (currentCommit.trim() !== commitPlan.originalHash) {
        // Checkout the specific commit
        await this.git.checkout(commitPlan.originalHash);
      }

      // Set the new date environment variables
      const env = {
        ...process.env,
        GIT_AUTHOR_DATE: commitPlan.newDate,
        GIT_COMMITTER_DATE: commitPlan.newDate
      };

      // Amend the commit with new date
      await this.git.env(env).raw(['commit', '--amend', '--no-edit']);

      // Get the new commit hash
      const newCommitHash = await this.git.revparse(['HEAD']);

      return {
        success: true,
        commit: {
          ...commitPlan,
          newHash: newCommitHash.trim()
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to migrate single commit: ${error.message}`
      };
    }
  }

  /**
   * Migrate multiple commits using Git filter-branch strategy
   * @param {Array} commitPlans - Array of commit migration plans
   * @returns {Object} Migration result
   */
  async migrateMultipleCommits(commitPlans) {
    try {
      const migratedCommits = [];
      let successCount = 0;

      this.reportProgress('Preparing filter-branch operation...', 30);

      // Create environment filter script for all commits
      const commitDateMap = {};
      commitPlans.forEach(plan => {
        commitDateMap[plan.originalHash] = plan.newDate;
      });

      // Build the environment filter script
      let envFilter = 'case $GIT_COMMIT in\n';
      Object.entries(commitDateMap).forEach(([hash, date]) => {
        envFilter += `  ${hash})\n`;
        envFilter += `    export GIT_AUTHOR_DATE="${date}"\n`;
        envFilter += `    export GIT_COMMITTER_DATE="${date}"\n`;
        envFilter += `    ;;\n`;
      });
      envFilter += 'esac';

      this.reportProgress('Executing filter-branch operation...', 50);

      // Execute filter-branch with the environment filter
      try {
        await this.git.raw([
          'filter-branch',
          '-f',
          '--env-filter',
          envFilter,
          '--',
          '--all'
        ]);

        // All commits were processed successfully
        successCount = commitPlans.length;
        migratedCommits.push(...commitPlans.map(plan => ({
          ...plan,
          newHash: 'updated' // Hash will be different after filter-branch
        })));

      } catch (filterError) {
        this.reportProgress('Filter-branch failed, trying alternative method...', 60);
        
        // Fallback to individual commit processing
        const fallbackResult = await this.migrateCommitsIndividually(commitPlans);
        successCount = fallbackResult.successCount;
        migratedCommits.push(...fallbackResult.migratedCommits);
      }

      this.reportProgress('Cleaning up filter-branch artifacts...', 80);

      // Clean up filter-branch backup refs
      await this.cleanupFilterBranchRefs();

      return {
        migratedCommits,
        successCount
      };

    } catch (error) {
      throw new Error(`Multiple commit migration failed: ${error.message}`);
    }
  }

  /**
   * Migrate commits individually as fallback method
   * @param {Array} commitPlans - Array of commit migration plans
   * @returns {Object} Migration result
   */
  async migrateCommitsIndividually(commitPlans) {
    const migratedCommits = [];
    let successCount = 0;

    for (let i = 0; i < commitPlans.length; i++) {
      if (this.isCancelled()) {
        throw new Error('Operation cancelled by user');
      }

      const plan = commitPlans[i];
      const progress = 60 + (i / commitPlans.length) * 20;
      
      this.reportProgress(`Migrating commit ${i + 1}/${commitPlans.length}: ${plan.originalHash.substring(0, 8)}`, progress);

      try {
        // Use cherry-pick with custom date
        const env = {
          ...process.env,
          GIT_AUTHOR_DATE: plan.newDate,
          GIT_COMMITTER_DATE: plan.newDate
        };

        // This is a simplified approach - in practice, you'd need more sophisticated rebase logic
        await this.git.env(env).raw(['cherry-pick', plan.originalHash]);
        
        migratedCommits.push({
          ...plan,
          newHash: 'cherry-picked'
        });
        successCount++;

      } catch (error) {
        // Log the error but continue with other commits
        console.warn(`Failed to migrate commit ${plan.originalHash}: ${error.message}`);
      }
    }

    return {
      migratedCommits,
      successCount
    };
  }

  /**
   * Clean up filter-branch backup references
   */
  async cleanupFilterBranchRefs() {
    try {
      // Get current branch to clean up the right refs
      const currentBranch = (await this.git.branch()).current;
      
      // Clean up filter-branch backup refs
      const backupRefs = [
        `refs/original/refs/heads/${currentBranch}`,
        'refs/original/refs/heads/master',
        'refs/original/refs/heads/main'
      ];

      for (const ref of backupRefs) {
        try {
          await this.git.raw(['update-ref', '-d', ref]);
        } catch (error) {
          // Ignore errors - ref might not exist
        }
      }

    } catch (error) {
      // Non-critical cleanup error
      console.warn(`Cleanup warning: ${error.message}`);
    }
  }

  /**
   * Clean up any migration artifacts
   */
  async cleanupMigrationArtifacts() {
    try {
      // Remove any temporary files or refs created during migration
      await this.cleanupFilterBranchRefs();
      
      // Force garbage collection to clean up unreachable objects
      try {
        await this.git.raw(['gc', '--prune=now']);
      } catch (error) {
        // GC is not critical, just log warning
        console.warn(`Garbage collection warning: ${error.message}`);
      }

    } catch (error) {
      // Non-critical cleanup error
      console.warn(`Cleanup warning: ${error.message}`);
    }
  }

  /**
   * Validate commit integrity after migration
   * @param {Array} originalCommits - Original commit list
   * @param {Array} migratedCommits - Migrated commit list
   * @returns {Object} Validation result
   */
  async validateCommitIntegrity(originalCommits, migratedCommits) {
    try {
      const validation = {
        success: true,
        issues: [],
        summary: {
          originalCount: originalCommits.length,
          migratedCount: migratedCommits.length,
          integrityChecks: []
        }
      };

      // Check commit count
      if (originalCommits.length !== migratedCommits.length) {
        validation.issues.push(`Commit count mismatch: expected ${originalCommits.length}, got ${migratedCommits.length}`);
        validation.success = false;
      }

      // Check commit messages are preserved
      for (let i = 0; i < Math.min(originalCommits.length, migratedCommits.length); i++) {
        const original = originalCommits[i];
        const migrated = migratedCommits[i];

        if (original.message !== migrated.message) {
          validation.issues.push(`Message mismatch for commit ${original.originalHash}: expected "${original.message}", got "${migrated.message}"`);
          validation.success = false;
        }

        if (original.author !== migrated.author) {
          validation.issues.push(`Author mismatch for commit ${original.originalHash}: expected "${original.author}", got "${migrated.author}"`);
          validation.success = false;
        }
      }

      validation.summary.integrityChecks = [
        `Commit count: ${validation.summary.migratedCount}/${validation.summary.originalCount}`,
        `Issues found: ${validation.issues.length}`
      ];

      return validation;

    } catch (error) {
      return {
        success: false,
        error: `Integrity validation failed: ${error.message}`,
        issues: [`Validation error: ${error.message}`],
        summary: {
          originalCount: originalCommits.length,
          migratedCount: migratedCommits.length,
          integrityChecks: ['Validation failed']
        }
      };
    }
  }

  /**
   * Create a backup of the current branch
   * @param {string} backupName - Name for the backup branch
   * @returns {Object} Backup result
   */
  async createBackup(backupName = null) {
    try {
      const currentBranch = (await this.git.branch()).current;
      const backupBranch = backupName || `histofy-backup-${currentBranch}-${Date.now()}`;
      
      // Create backup branch
      await this.git.checkoutBranch(backupBranch, currentBranch);
      await this.git.checkout(currentBranch);
      
      return {
        success: true,
        backupBranch,
        originalBranch: currentBranch
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create backup: ${error.message}`
      };
    }
  }

  /**
   * Restore from a backup branch
   * @param {string} backupBranch - Name of the backup branch
   * @param {boolean} deleteBackup - Whether to delete backup after restore
   * @returns {Object} Restore result
   */
  async restoreFromBackup(backupBranch, deleteBackup = false) {
    try {
      const currentBranch = (await this.git.branch()).current;
      
      // Reset current branch to backup
      await this.git.reset(['--hard', backupBranch]);
      
      if (deleteBackup) {
        try {
          await this.git.deleteLocalBranch(backupBranch);
        } catch (error) {
          console.warn(`Warning: Could not delete backup branch: ${error.message}`);
        }
      }
      
      return {
        success: true,
        restoredBranch: currentBranch,
        backupBranch
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore from backup: ${error.message}`
      };
    }
  }

  /**
   * Check if a branch exists
   * @param {string} branchName - Name of the branch to check
   * @returns {boolean} Whether the branch exists
   */
  async branchExists(branchName) {
    try {
      const branches = await this.git.branch(['-a']);
      return branches.all.some(branch => 
        branch.name === branchName || branch.name === `remotes/origin/${branchName}`
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect merge conflicts in the repository with enhanced security and validation
   * @returns {Object} Conflict detection result
   */
  async detectConflicts() {
    try {
      const status = await this.git.status();
      
      const conflicts = {
        hasConflicts: false,
        conflictedFiles: [],
        unmergedPaths: [],
        details: [],
        timestamp: new Date().toISOString()
      };

      // Check for conflicted files in status
      if (status.conflicted && status.conflicted.length > 0) {
        conflicts.hasConflicts = true;
        conflicts.conflictedFiles = status.conflicted;
      }

      // Check for unmerged paths with better validation
      if (status.not_added && status.not_added.length > 0) {
        // More robust conflict detection - check actual file content instead of filename
        const potentialConflicts = [];
        for (const file of status.not_added) {
          try {
            // Validate file path for security
            const sanitizedPath = SecurityUtils.validateFilePath(file, this.repoPath);
            const content = await fs.readFile(sanitizedPath, 'utf8');
            
            // Check for actual conflict markers in content
            if (content.includes('<<<<<<<') || content.includes('>>>>>>>') || content.includes('=======')) {
              potentialConflicts.push(file);
            }
          } catch (error) {
            // File might not exist or be readable, skip it
            continue;
          }
        }
        
        if (potentialConflicts.length > 0) {
          conflicts.hasConflicts = true;
          conflicts.unmergedPaths = potentialConflicts;
        }
      }

      // Get detailed conflict information with enhanced security
      if (conflicts.hasConflicts) {
        const allConflictedFiles = [...new Set([...conflicts.conflictedFiles, ...conflicts.unmergedPaths])];
        
        for (const file of allConflictedFiles) {
          try {
            // Validate file path for security
            const sanitizedPath = SecurityUtils.validateFilePath(file, this.repoPath);
            
            // Check file size to prevent reading extremely large files
            const stats = await fs.stat(sanitizedPath);
            if (stats.size > 10 * 1024 * 1024) { // 10MB limit
              conflicts.details.push({
                file,
                error: 'File too large to analyze (>10MB)',
                size: stats.size
              });
              continue;
            }
            
            const content = await fs.readFile(sanitizedPath, 'utf8');
            
            // Enhanced conflict marker detection
            const conflictMarkers = {
              incoming: (content.match(/<<<<<<< /g) || []).length,
              separator: (content.match(/=======/g) || []).length,
              current: (content.match(/>>>>>>> /g) || []).length
            };

            // Additional conflict analysis
            const conflictSections = [];
            const lines = content.split('\n');
            let inConflict = false;
            let conflictStart = -1;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith('<<<<<<<')) {
                inConflict = true;
                conflictStart = i;
              } else if (line.startsWith('>>>>>>>') && inConflict) {
                inConflict = false;
                conflictSections.push({
                  start: conflictStart,
                  end: i,
                  lines: i - conflictStart + 1
                });
              }
            }

            conflicts.details.push({
              file,
              conflictMarkers,
              conflictSections,
              hasValidMarkers: conflictMarkers.incoming === conflictMarkers.separator && 
                              conflictMarkers.separator === conflictMarkers.current,
              totalConflicts: conflictSections.length,
              fileSize: stats.size
            });
          } catch (error) {
            conflicts.details.push({
              file,
              error: `Could not analyze file: ${error.message}`
            });
          }
        }
      }

      return conflicts;
    } catch (error) {
      throw new Error(`Failed to detect conflicts: ${error.message}`);
    }
  }

  /**
   * Guide user through conflict resolution
   * @param {Object} conflicts - Conflict information from detectConflicts()
   * @returns {Object} Resolution result
   */
  async guideConflictResolution(conflicts) {
    const inquirer = require('inquirer');
    const chalk = require('chalk');

    if (!conflicts.hasConflicts) {
      return { success: true, message: 'No conflicts to resolve' };
    }

    console.log(chalk.red('\n⚠️  Merge conflicts detected during migration!'));
    console.log(chalk.yellow(`Found conflicts in ${conflicts.conflictedFiles.length} file(s):\n`));

    conflicts.conflictedFiles.forEach((file, index) => {
      console.log(chalk.red(`   ${index + 1}. ${file}`));
    });

    console.log(chalk.blue('\nConflict Resolution Options:'));
    console.log(chalk.gray('1. Manual resolution - Open files in editor and resolve conflicts'));
    console.log(chalk.gray('2. Automatic resolution - Choose strategy for all conflicts'));
    console.log(chalk.gray('3. Abort migration - Rollback to original state'));

    const resolutionChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'strategy',
        message: 'How would you like to resolve the conflicts?',
        choices: [
          { name: 'Manual resolution (recommended)', value: 'manual' },
          { name: 'Accept incoming changes (theirs)', value: 'theirs' },
          { name: 'Keep current changes (ours)', value: 'ours' },
          { name: 'Abort migration', value: 'abort' }
        ]
      }
    ]);

    switch (resolutionChoice.strategy) {
      case 'manual':
        return await this.handleManualResolution(conflicts);
      
      case 'theirs':
        return await this.handleAutomaticResolution(conflicts, 'theirs');
      
      case 'ours':
        return await this.handleAutomaticResolution(conflicts, 'ours');
      
      case 'abort':
        return { success: false, aborted: true, message: 'Migration aborted by user' };
      
      default:
        return { success: false, error: 'Invalid resolution strategy' };
    }
  }

  /**
   * Handle manual conflict resolution with user guidance
   * @param {Object} conflicts - Conflict information
   * @returns {Object} Resolution result
   */
  async handleManualResolution(conflicts) {
    const inquirer = require('inquirer');
    const chalk = require('chalk');

    console.log(chalk.blue('\n📝 Manual Conflict Resolution Guide:'));
    console.log(chalk.gray('1. Open each conflicted file in your preferred editor'));
    console.log(chalk.gray('2. Look for conflict markers: <<<<<<<, =======, >>>>>>>'));
    console.log(chalk.gray('3. Edit the file to resolve conflicts'));
    console.log(chalk.gray('4. Remove all conflict markers'));
    console.log(chalk.gray('5. Save the file'));
    console.log(chalk.gray('6. Return here when all conflicts are resolved\n'));

    // Display detailed conflict information
    conflicts.details.forEach((detail, index) => {
      console.log(chalk.yellow(`File ${index + 1}: ${detail.file}`));
      if (detail.conflictMarkers) {
        console.log(chalk.gray(`   Conflict sections: ${detail.conflictMarkers.incoming}`));
        console.log(chalk.gray(`   Valid markers: ${detail.hasValidMarkers ? 'Yes' : 'No'}`));
      }
      if (detail.error) {
        console.log(chalk.red(`   Error: ${detail.error}`));
      }
      console.log();
    });

    // Wait for user to resolve conflicts
    let resolved = false;
    while (!resolved) {
      const checkResult = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Check if conflicts are resolved', value: 'check' },
            { name: 'Open file in default editor', value: 'edit' },
            { name: 'Show conflict status', value: 'status' },
            { name: 'Abort resolution', value: 'abort' }
          ]
        }
      ]);

      switch (checkResult.action) {
        case 'check':
          const currentConflicts = await this.detectConflicts();
          if (!currentConflicts.hasConflicts) {
            console.log(chalk.green('✅ All conflicts have been resolved!'));
            resolved = true;
          } else {
            console.log(chalk.red(`❌ ${currentConflicts.conflictedFiles.length} file(s) still have conflicts:`));
            currentConflicts.conflictedFiles.forEach(file => {
              console.log(chalk.red(`   - ${file}`));
            });
          }
          break;

        case 'edit':
          const fileChoice = await inquirer.prompt([
            {
              type: 'list',
              name: 'file',
              message: 'Which file would you like to edit?',
              choices: conflicts.conflictedFiles
            }
          ]);
          
          try {
            // Secure editor command validation
            const rawEditor = process.env.EDITOR || 'nano';
            const sanitizedEditor = SecurityUtils.sanitizeEditorCommand(rawEditor);
            
            // Validate file path to prevent path traversal
            const sanitizedFilePath = SecurityUtils.validateFilePath(fileChoice.file, this.repoPath);
            
            console.log(chalk.blue(`Opening ${path.basename(sanitizedFilePath)} in ${path.basename(sanitizedEditor)}...`));
            
            // Use secure spawn with validated inputs
            const editorProcess = spawn(sanitizedEditor, [sanitizedFilePath], {
              stdio: 'inherit',
              cwd: this.repoPath, // Ensure we're in the correct directory
              shell: false // Disable shell to prevent command injection
            });
            
            await new Promise((resolve, reject) => {
              editorProcess.on('close', (code) => {
                if (code === 0) {
                  console.log(chalk.green('Editor closed successfully'));
                  resolve();
                } else {
                  console.log(chalk.yellow(`Editor exited with code ${code}`));
                  resolve();
                }
              });
              
              editorProcess.on('error', (error) => {
                console.log(chalk.red(`Failed to open editor: ${error.message}`));
                if (error.code === 'ENOENT') {
                  console.log(chalk.gray('Tip: Make sure your EDITOR environment variable points to a valid editor'));
                  console.log(chalk.gray(`Allowed editors: ${SecurityUtils.ALLOWED_EDITORS.join(', ')}`));
                }
                resolve();
              });
            });
          } catch (error) {
            console.log(chalk.red(`Failed to open editor: ${error.message}`));
            if (error.message.includes('not in the allowed list')) {
              console.log(chalk.gray(`Allowed editors: ${SecurityUtils.ALLOWED_EDITORS.join(', ')}`));
              console.log(chalk.gray('You can set EDITOR environment variable to one of the allowed editors'));
            }
          }
          break;

        case 'status':
          const statusConflicts = await this.detectConflicts();
          if (statusConflicts.hasConflicts) {
            console.log(chalk.yellow(`Remaining conflicts in ${statusConflicts.conflictedFiles.length} file(s):`));
            statusConflicts.details.forEach((detail, index) => {
              console.log(chalk.yellow(`   ${index + 1}. ${detail.file}`));
              if (detail.conflictMarkers) {
                console.log(chalk.gray(`      Conflict sections: ${detail.conflictMarkers.incoming}`));
              }
            });
          } else {
            console.log(chalk.green('✅ No conflicts detected'));
          }
          break;

        case 'abort':
          return { success: false, aborted: true, message: 'Manual resolution aborted by user' };
      }
    }

    // Add resolved files to staging area
    try {
      for (const file of conflicts.conflictedFiles) {
        await this.git.add(file);
      }
      
      return { 
        success: true, 
        message: 'Conflicts resolved manually and files staged',
        resolvedFiles: conflicts.conflictedFiles
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to stage resolved files: ${error.message}` 
      };
    }
  }

  /**
   * Handle automatic conflict resolution using Git strategies with enhanced validation
   * @param {Object} conflicts - Conflict information
   * @param {string} strategy - Resolution strategy ('theirs' or 'ours')
   * @returns {Object} Resolution result
   */
  async handleAutomaticResolution(conflicts, strategy) {
    const chalk = require('chalk');

    try {
      // Validate strategy parameter
      const validStrategies = ['theirs', 'ours'];
      if (!validStrategies.includes(strategy)) {
        throw new Error(`Invalid resolution strategy: ${strategy}. Valid strategies: ${validStrategies.join(', ')}`);
      }

      console.log(chalk.blue(`\n🔄 Applying automatic resolution strategy: ${strategy}`));

      const resolvedFiles = [];
      const failedFiles = [];
      const skippedFiles = [];

      // Validate conflicts object
      if (!conflicts || !conflicts.conflictedFiles || !Array.isArray(conflicts.conflictedFiles)) {
        throw new Error('Invalid conflicts object provided');
      }

      for (const file of conflicts.conflictedFiles) {
        try {
          // Validate file path for security
          const sanitizedFilePath = SecurityUtils.validateFilePath(file, this.repoPath);
          
          // Check if file still exists and has conflicts
          const fileStatus = await this.git.status([sanitizedFilePath]);
          if (!fileStatus.conflicted.includes(file)) {
            console.log(chalk.yellow(`   ⚠️  Skipped: ${file} - No longer in conflict`));
            skippedFiles.push(file);
            continue;
          }

          // Use git checkout to resolve conflicts automatically
          if (strategy === 'theirs') {
            await this.git.raw(['checkout', '--theirs', sanitizedFilePath]);
          } else if (strategy === 'ours') {
            await this.git.raw(['checkout', '--ours', sanitizedFilePath]);
          }

          // Verify the file is no longer in conflict
          const postResolutionStatus = await this.git.status([sanitizedFilePath]);
          if (postResolutionStatus.conflicted.includes(file)) {
            throw new Error('File still in conflict after resolution attempt');
          }

          // Add the resolved file to staging area
          await this.git.add(sanitizedFilePath);
          resolvedFiles.push(file);
          
          console.log(chalk.green(`   ✅ Resolved: ${file}`));
        } catch (error) {
          failedFiles.push({ file, error: error.message });
          console.log(chalk.red(`   ❌ Failed: ${file} - ${error.message}`));
        }
      }

      if (failedFiles.length === 0) {
        return {
          success: true,
          message: `All conflicts resolved using '${strategy}' strategy`,
          resolvedFiles,
          strategy
        };
      } else {
        return {
          success: false,
          error: `Failed to resolve ${failedFiles.length} file(s) automatically`,
          resolvedFiles,
          failedFiles,
          strategy
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Automatic resolution failed: ${error.message}`,
        strategy
      };
    }
  }

  /**
   * Rollback migration to original state
   * @param {string} backupBranch - Name of the backup branch to restore from
   * @param {Object} options - Rollback options
   * @returns {Object} Rollback result
   */
  async rollbackMigration(backupBranch, options = {}) {
    const chalk = require('chalk');
    const { 
      deleteBackup = false, 
      force = false,
      preserveWorkingDirectory = false 
    } = options;

    try {
      console.log(chalk.yellow(`\n🔄 Rolling back migration to backup: ${backupBranch}`));

      // Check if backup branch exists
      const branches = await this.git.branch(['-a']);
      const backupExists = branches.all.some(branch => 
        branch.name === backupBranch || branch.name === `remotes/origin/${backupBranch}`
      );

      if (!backupExists) {
        return {
          success: false,
          error: `Backup branch '${backupBranch}' not found`
        };
      }

      // Get current branch name
      const currentBranch = (await this.git.branch()).current;

      // Stash working directory changes if needed
      let stashCreated = false;
      if (!preserveWorkingDirectory) {
        const status = await this.git.status();
        if (!status.isClean()) {
          try {
            await this.git.stash(['push', '-m', 'Histofy migration rollback stash']);
            stashCreated = true;
            console.log(chalk.blue('   Working directory changes stashed'));
          } catch (error) {
            if (!force) {
              return {
                success: false,
                error: `Cannot stash working directory changes: ${error.message}. Use force option to override.`
              };
            }
          }
        }
      }

      // Reset current branch to backup
      try {
        if (force) {
          await this.git.reset(['--hard', backupBranch]);
        } else {
          await this.git.reset(['--merge', backupBranch]);
        }
        
        console.log(chalk.green(`   ✅ Branch '${currentBranch}' reset to backup state`));
      } catch (error) {
        return {
          success: false,
          error: `Failed to reset branch: ${error.message}`
        };
      }

      // Clean up backup branch if requested
      if (deleteBackup) {
        try {
          await this.git.deleteLocalBranch(backupBranch);
          console.log(chalk.blue(`   🗑️  Backup branch '${backupBranch}' deleted`));
        } catch (error) {
          console.log(chalk.yellow(`   ⚠️  Could not delete backup branch: ${error.message}`));
        }
      }

      // Restore stashed changes if preserving working directory
      if (stashCreated && preserveWorkingDirectory) {
        try {
          await this.git.stash(['pop']);
          console.log(chalk.blue('   Working directory changes restored'));
        } catch (error) {
          console.log(chalk.yellow(`   ⚠️  Could not restore stashed changes: ${error.message}`));
        }
      }

      return {
        success: true,
        message: `Migration rolled back successfully to backup '${backupBranch}'`,
        restoredBranch: currentBranch,
        backupBranch,
        stashCreated,
        backupDeleted: deleteBackup
      };

    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error.message}`
      };
    }
  }

  /**
   * Enhanced migration execution with conflict resolution support
   * @param {Array} migrationPlan - Migration plan from migrateCommits
   * @param {Object} options - Migration options
   * @returns {Object} Migration result with conflict handling
   */
  async executeMigrationWithConflictResolution(migrationPlan, options = {}) {
    const chalk = require('chalk');
    const { 
      autoResolveStrategy = null, 
      createBackup = true,
      rollbackOnFailure = true 
    } = options;

    try {
      this.resetCancellation();
      this.reportProgress('Starting migration with conflict resolution...', 0);

      if (!migrationPlan || migrationPlan.length === 0) {
        throw new Error('No migration plan provided');
      }

      // Create backup before starting
      let backupInfo = null;
      if (createBackup) {
        this.reportProgress('Creating backup...', 10);
        backupInfo = await this.createBackup();
        if (!backupInfo.success) {
          throw new Error(`Failed to create backup: ${backupInfo.error}`);
        }
        console.log(chalk.blue(`   Backup created: ${backupInfo.backupBranch}`));
      }

      // Validate repository state
      const repoValidation = await this.validateRepositoryForMigration();
      if (!repoValidation.success) {
        throw new Error(`Repository validation failed: ${repoValidation.issues.join(', ')}`);
      }

      this.reportProgress('Starting commit migration...', 20);

      // Execute the migration
      let migrationResult;
      try {
        migrationResult = await this.executeMigration(migrationPlan);
      } catch (error) {
        // Check if the error is due to conflicts
        const conflicts = await this.detectConflicts();
        
        if (conflicts.hasConflicts) {
          console.log(chalk.yellow('\n⚠️  Migration paused due to conflicts'));
          
          // Handle conflicts based on strategy
          let resolutionResult;
          if (autoResolveStrategy) {
            resolutionResult = await this.handleAutomaticResolution(conflicts, autoResolveStrategy);
          } else {
            resolutionResult = await this.guideConflictResolution(conflicts);
          }

          if (resolutionResult.success) {
            console.log(chalk.green('✅ Conflicts resolved, continuing migration...'));
            
            // Continue the migration after conflict resolution
            try {
              await this.git.raw(['rebase', '--continue']);
              migrationResult = { 
                success: true, 
                message: 'Migration completed after conflict resolution',
                conflictsResolved: true,
                resolutionStrategy: resolutionResult.strategy || 'manual'
              };
            } catch (continueError) {
              throw new Error(`Failed to continue migration after conflict resolution: ${continueError.message}`);
            }
          } else if (resolutionResult.aborted) {
            // User chose to abort
            if (rollbackOnFailure && backupInfo) {
              console.log(chalk.yellow('🔄 Rolling back due to user abort...'));
              const rollbackResult = await this.rollbackMigration(backupInfo.backupBranch);
              if (rollbackResult.success) {
                console.log(chalk.green('✅ Rollback completed successfully'));
              }
            }
            
            return {
              success: false,
              aborted: true,
              message: 'Migration aborted by user during conflict resolution',
              backupBranch: backupInfo?.backupBranch
            };
          } else {
            throw new Error(`Conflict resolution failed: ${resolutionResult.error}`);
          }
        } else {
          // Re-throw the original error if it's not conflict-related
          throw error;
        }
      }

      this.reportProgress('Migration completed successfully', 100);

      return {
        success: true,
        message: 'Migration completed successfully',
        migrationResult,
        backupBranch: backupInfo?.backupBranch,
        conflictsEncountered: migrationResult?.conflictsResolved || false
      };

    } catch (error) {
      // Handle migration failure with rollback
      if (rollbackOnFailure && backupInfo?.backupBranch) {
        console.log(chalk.red(`\n❌ Migration failed: ${error.message}`));
        console.log(chalk.yellow('🔄 Attempting rollback...'));
        
        try {
          const rollbackResult = await this.rollbackMigration(backupInfo.backupBranch);
          if (rollbackResult.success) {
            console.log(chalk.green('✅ Rollback completed successfully'));
            return {
              success: false,
              error: error.message,
              rolledBack: true,
              backupBranch: backupInfo.backupBranch,
              rollbackResult
            };
          } else {
            console.log(chalk.red(`❌ Rollback failed: ${rollbackResult.error}`));
            return {
              success: false,
              error: error.message,
              rollbackFailed: true,
              rollbackError: rollbackResult.error,
              backupBranch: backupInfo.backupBranch
            };
          }
        } catch (rollbackError) {
          console.log(chalk.red(`❌ Rollback error: ${rollbackError.message}`));
          return {
            success: false,
            error: error.message,
            rollbackFailed: true,
            rollbackError: rollbackError.message,
            backupBranch: backupInfo.backupBranch
          };
        }
      }

      return {
        success: false,
        error: error.message,
        backupBranch: backupInfo?.backupBranch
      };
    }
  }

  /**
   * Get detailed commit information
   * @param {string} commitHash - Commit hash to get info for
   * @returns {Object} Detailed commit information
   */
  async getCommitDetails(commitHash) {
    try {
      const commitInfo = await this.git.show([
        commitHash,
        '--format=%H|%P|%an|%ae|%ad|%cn|%ce|%cd|%s|%b',
        '--no-patch'
      ]);
      
      const [
        hash, parents, authorName, authorEmail, authorDate,
        committerName, committerEmail, committerDate, subject, body
      ] = commitInfo.split('|');
      
      return {
        hash: hash.trim(),
        parents: parents.trim().split(' ').filter(p => p),
        author: {
          name: authorName.trim(),
          email: authorEmail.trim(),
          date: authorDate.trim()
        },
        committer: {
          name: committerName.trim(),
          email: committerEmail.trim(),
          date: committerDate.trim()
        },
        message: {
          subject: subject.trim(),
          body: body ? body.trim() : ''
        },
        fullMessage: [subject.trim(), body ? body.trim() : ''].filter(s => s).join('\n\n')
      };
    } catch (error) {
      throw new Error(`Failed to get commit details: ${error.message}`);
    }
  }

  /**
   * Verify repository is in a clean state for migration
   * @returns {Object} Repository state validation
   */
  async validateRepositoryForMigration() {
    try {
      const status = await this.git.status();
      const validation = {
        isClean: status.isClean(),
        issues: [],
        warnings: []
      };

      if (!validation.isClean) {
        if (status.staged.length > 0) {
          validation.issues.push(`${status.staged.length} staged file(s) need to be committed`);
        }
        if (status.modified.length > 0) {
          validation.issues.push(`${status.modified.length} modified file(s) need to be committed or stashed`);
        }
        if (status.not_added.length > 0) {
          validation.warnings.push(`${status.not_added.length} untracked file(s) present`);
        }
      }

      // Check for ongoing rebase or merge
      try {
        const rebaseHead = await this.git.raw(['rev-parse', '--verify', 'REBASE_HEAD']);
        if (rebaseHead.trim()) {
          validation.issues.push('Repository is in the middle of a rebase operation');
        }
      } catch (error) {
        // No rebase in progress, which is good
      }

      try {
        const mergeHead = await this.git.raw(['rev-parse', '--verify', 'MERGE_HEAD']);
        if (mergeHead.trim()) {
          validation.issues.push('Repository is in the middle of a merge operation');
        }
      } catch (error) {
        // No merge in progress, which is good
      }

      return {
        success: validation.issues.length === 0,
        isClean: validation.isClean,
        issues: validation.issues,
        warnings: validation.warnings
      };
    } catch (error) {
      return {
        success: false,
        error: `Repository validation failed: ${error.message}`
      };
    }
  }

  /**
   * Get repository information
   */
  async getRepoInfo() {
    try {
      const remotes = await this.git.getRemotes(true);
      const branch = await this.git.branch();
      const status = await this.git.status();
      
      const originRemote = remotes.find(r => r.name === 'origin');
      let repoUrl = null;
      let repoName = null;
      
      if (originRemote) {
        repoUrl = originRemote.refs.fetch;
        // Extract repo name from URL
        const match = repoUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
        if (match) {
          repoName = match[1];
        }
      }

      return {
        path: this.repoPath,
        branch: branch.current,
        remotes: remotes.map(r => ({ name: r.name, url: r.refs.fetch })),
        repoUrl,
        repoName,
        isClean: status.isClean(),
        totalCommits: (await this.git.log()).total
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error.message}`);
    }
  }
}

module.exports = GitManager;
