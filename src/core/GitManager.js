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
    try {
      this.git = simpleGit(repoPath);
    } catch (error) {
      this.git = null;
      this._initError = error;
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
   * Migrate commits to new dates
   */
  async migrateCommits(commitRange, startDate, spreadDays = 1, startTime = '09:00') {
    try {
      let commits;
      
      // Check if it's a single commit hash or a range
      if (commitRange.includes('..')) {
        // Handle range format (e.g., HEAD~5..HEAD)
        commits = await this.git.log({
          from: commitRange.split('..')[0],
          to: commitRange.split('..')[1] || 'HEAD'
        });
      } else {
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

      if (commits.all.length === 0) {
        throw new Error('No commits found in the specified range');
      }

      const results = [];
      const baseDate = moment(startDate, 'YYYY-MM-DD');
      
      // Calculate date intervals
      const hoursInterval = (spreadDays * 24) / commits.all.length;
      let currentDate = moment(baseDate).hour(parseInt(startTime.split(':')[0])).minute(parseInt(startTime.split(':')[1]));

      for (let i = commits.all.length - 1; i >= 0; i--) {
        const commit = commits.all[i];
        const newDate = currentDate.format('YYYY-MM-DD HH:mm:ss');
        
        // Rebase commit with new date
        const env = {
          ...process.env,
          GIT_AUTHOR_DATE: newDate,
          GIT_COMMITTER_DATE: newDate
        };

        // This would require more complex git operations
        // For now, we'll return the plan
        results.push({
          originalHash: commit.hash,
          originalDate: commit.date,
          newDate: newDate,
          message: commit.message,
          author: commit.author_name
        });

        currentDate.add(hoursInterval, 'hours');
      }

      return {
        success: true,
        commits: results,
        warning: 'Migration plan generated. Actual migration requires interactive rebase.'
      };
    } catch (error) {
      throw new Error(`Failed to migrate commits: ${error.message}`);
    }
  }

  /**
   * Execute migration by actually changing commit dates
   */
  async executeMigration(migrationPlan) {
    try {
      const migratedCommits = [];
      
      // Sort commits by original date to process in correct order
      const sortedCommits = migrationPlan.sort((a, b) => 
        new Date(a.originalDate) - new Date(b.originalDate)
      );

      for (const commit of sortedCommits) {
        try {
          // Use git filter-branch or rebase to change the commit date
          const newDate = commit.newDate;
          const commitHash = commit.originalHash;

          // Method 1: Using git filter-branch for individual commits
          await this.git.raw([
            'filter-branch', '-f', '--env-filter',
            `if [ $GIT_COMMIT = ${commitHash} ]
             then
                 export GIT_AUTHOR_DATE="${newDate}"
                 export GIT_COMMITTER_DATE="${newDate}"
             fi`,
            '--', '--all'
          ]);

          migratedCommits.push(commit);
        } catch (commitError) {
          // If filter-branch fails, try alternative method
          console.warn(`Warning: Failed to migrate commit ${commit.originalHash}: ${commitError.message}`);
        }
      }

      // Clean up filter-branch refs
      try {
        await this.git.raw(['update-ref', '-d', 'refs/original/refs/heads/master']);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return {
        success: true,
        migratedCount: migratedCommits.length,
        migrations: migratedCommits
      };
    } catch (error) {
      return {
        success: false,
        error: `Migration execution failed: ${error.message}`
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
