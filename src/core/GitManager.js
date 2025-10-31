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
        warning: 'Migration plan generated. Actual migration requires interactive rebase.'
      };
    } catch (error) {
      if (error.message.includes('cancelled')) {
        throw error; // Re-throw cancellation errors as-is
      }
      throw new Error(`Failed to migrate commits: ${error.message}`);
    }
  }

  /**
   * Execute migration by actually changing commit dates using Git rebase operations
   */
  async executeMigration(migrationPlan) {
    try {
      this.resetCancellation();
      this.reportProgress('Preparing migration execution...', 0);
      
      if (!migrationPlan || migrationPlan.length === 0) {
        throw new Error('No migration plan provided');
      }

      // Validate repository state before migration
      const status = await this.git.status();
      if (!status.isClean()) {
        throw new Error('Repository has uncommitted changes. Please commit or stash changes before migration.');
      }

      this.reportProgress('Creating backup branch...', 10);
      
      // Create backup branch before migration
      const currentBranch = (await this.git.branch()).current;
      const backupBranch = `histofy-backup-${Date.now()}`;
      
      try {
        await this.git.checkoutBranch(backupBranch, currentBranch);
        await this.git.checkout(currentBranch);
      } catch (error) {
        throw new Error(`Failed to create backup branch: ${error.message}`);
      }

      this.reportProgress('Backup created, starting migration...', 20);

      // Sort commits by original date to process in correct order (oldest first)
      const sortedCommits = migrationPlan.sort((a, b) => 
        new Date(a.originalDate) - new Date(b.originalDate)
      );

      const migratedCommits = [];
      let successCount = 0;

      // Use different strategies based on the number of commits
      if (sortedCommits.length === 1) {
        // Single commit - use amend strategy
        const result = await this.migrateSingleCommit(sortedCommits[0]);
        if (result.success) {
          migratedCommits.push(result.commit);
          successCount++;
        }
      } else {
        // Multiple commits - use interactive rebase strategy
        const result = await this.migrateMultipleCommits(sortedCommits);
        migratedCommits.push(...result.migratedCommits);
        successCount = result.successCount;
      }

      this.reportProgress('Migration completed, cleaning up...', 90);

      // Clean up any temporary files or refs
      await this.cleanupMigrationArtifacts();

      this.reportProgress('Migration execution completed', 100);

      return {
        success: true,
        migratedCount: successCount,
        totalCommits: sortedCommits.length,
        migrations: migratedCommits,
        backupBranch: backupBranch,
        originalBranch: currentBranch
      };

    } catch (error) {
      if (error.message.includes('cancelled')) {
        throw error; // Re-throw cancellation errors as-is
      }
      
      return {
        success: false,
        error: `Migration execution failed: ${error.message}`,
        suggestion: 'Check repository state and try again. Use the backup branch if needed.'
      };
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
