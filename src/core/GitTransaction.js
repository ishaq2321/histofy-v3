/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * GitTransaction - Provides atomic Git operations with backup and rollback capabilities
 */

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const chalk = require('chalk');

class GitTransaction {
  constructor(repoPath, operationId = null) {
    this.repoPath = repoPath;
    this.operationId = operationId || this.generateOperationId();
    this.git = simpleGit(repoPath);
    this.backupBranch = null;
    this.originalBranch = null;
    this.backupCreated = false;
    this.committed = false;
    this.rolledBack = false;
    this.startTime = new Date();
    this.backupMetadata = null;
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `histofy-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Create a complete backup of the repository state
   */
  async createBackup() {
    if (this.backupCreated) {
      throw new Error('Backup already created for this transaction');
    }

    try {
      // Get current branch and repository state
      const currentBranch = (await this.git.branch()).current;
      const status = await this.git.status();
      const headCommit = await this.git.revparse(['HEAD']);

      this.originalBranch = currentBranch;
      this.backupBranch = `histofy-backup-${this.operationId}`;

      // Validate repository state
      if (!status.isClean()) {
        throw new Error('Repository must be clean before creating backup. Please commit or stash changes.');
      }

      // Create backup branch from current HEAD
      await this.git.checkoutBranch(this.backupBranch, currentBranch);
      await this.git.checkout(currentBranch);

      // Store backup metadata
      this.backupMetadata = {
        operationId: this.operationId,
        originalBranch: currentBranch,
        backupBranch: this.backupBranch,
        headCommit: headCommit.trim(),
        timestamp: this.startTime.toISOString(),
        repositoryPath: this.repoPath,
        status: status
      };

      // Verify backup integrity
      await this.verifyBackupIntegrity();

      this.backupCreated = true;
      return {
        success: true,
        backupBranch: this.backupBranch,
        metadata: this.backupMetadata
      };

    } catch (error) {
      // Cleanup failed backup attempt
      if (this.backupBranch) {
        try {
          await this.git.deleteLocalBranch(this.backupBranch, true);
        } catch (cleanupError) {
          // Log cleanup error but don't throw
          console.warn(`Warning: Failed to cleanup backup branch: ${cleanupError.message}`);
        }
      }
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Verify backup integrity by comparing with original
   */
  async verifyBackupIntegrity() {
    if (!this.backupBranch || !this.originalBranch) {
      throw new Error('Backup branches not properly initialized');
    }

    try {
      // Try to access the backup branch directly - this is more reliable
      try {
        const backupHead = await this.git.revparse([this.backupBranch]);
        const originalHead = await this.git.revparse([this.originalBranch]);

        if (originalHead.trim() !== backupHead.trim()) {
          throw new Error('Backup integrity check failed: HEAD commits do not match');
        }
      } catch (revParseError) {
        throw new Error('Backup integrity check failed: Cannot access backup branch');
      }

      // Additional verification - try to show the backup branch
      try {
        await this.git.raw(['show-branch', this.backupBranch]);
      } catch (showBranchError) {
        throw new Error('Backup integrity check failed: Backup branch is not accessible');
      }

      return true;
    } catch (error) {
      throw new Error(`Backup integrity verification failed: ${error.message}`);
    }
  }

  /**
   * Commit the transaction (cleanup backup if successful)
   */
  async commit() {
    if (!this.backupCreated) {
      throw new Error('Cannot commit transaction: No backup created');
    }

    if (this.committed) {
      throw new Error('Transaction already committed');
    }

    if (this.rolledBack) {
      throw new Error('Cannot commit transaction: Already rolled back');
    }

    try {
      // Verify current repository state is valid
      await this.validateCurrentState();

      // Mark as committed
      this.committed = true;

      // Optionally keep backup for a period (don't delete immediately)
      // This allows for manual recovery if issues are discovered later
      return {
        success: true,
        operationId: this.operationId,
        backupBranch: this.backupBranch,
        message: 'Transaction committed successfully. Backup branch preserved for recovery.'
      };

    } catch (error) {
      throw new Error(`Failed to commit transaction: ${error.message}`);
    }
  }

  /**
   * Rollback the transaction to the backup state
   */
  async rollback() {
    if (!this.backupCreated) {
      throw new Error('Cannot rollback transaction: No backup created');
    }

    if (this.committed) {
      throw new Error('Cannot rollback transaction: Already committed');
    }

    if (this.rolledBack) {
      throw new Error('Transaction already rolled back');
    }

    try {
      // Get current branch
      const currentBranch = (await this.git.branch()).current;

      // Try to access backup branch directly instead of verifying integrity first
      let backupHead;
      try {
        backupHead = await this.git.revparse([this.backupBranch]);
      } catch (error) {
        throw new Error('Backup branch is not accessible for rollback');
      }

      // Reset current branch to backup state
      await this.git.reset(['--hard', this.backupBranch]);

      // Verify rollback success by comparing HEAD
      const currentHead = await this.git.revparse(['HEAD']);

      if (currentHead.trim() !== backupHead.trim()) {
        throw new Error('Rollback verification failed: Repository state not properly restored');
      }

      this.rolledBack = true;

      return {
        success: true,
        operationId: this.operationId,
        restoredBranch: currentBranch,
        backupBranch: this.backupBranch,
        message: 'Transaction rolled back successfully'
      };

    } catch (error) {
      throw new Error(`Failed to rollback transaction: ${error.message}`);
    }
  }

  /**
   * Validate current repository state
   */
  async validateCurrentState() {
    try {
      // Check if repository is still valid
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Repository is no longer valid');
      }

      // Check if we can access HEAD
      await this.git.revparse(['HEAD']);

      // Check repository status
      const status = await this.git.status();
      
      return {
        isValid: true,
        status: status
      };

    } catch (error) {
      throw new Error(`Repository state validation failed: ${error.message}`);
    }
  }

  /**
   * Cleanup backup branch (use with caution)
   */
  async cleanupBackup() {
    if (!this.backupBranch) {
      return { success: true, message: 'No backup to cleanup' };
    }

    try {
      // Only allow cleanup if transaction is committed or rolled back
      if (!this.committed && !this.rolledBack) {
        throw new Error('Cannot cleanup backup: Transaction is still active');
      }

      // Delete backup branch
      await this.git.deleteLocalBranch(this.backupBranch, true);

      return {
        success: true,
        deletedBranch: this.backupBranch,
        message: 'Backup branch cleaned up successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup backup: ${error.message}`,
        backupBranch: this.backupBranch
      };
    }
  }

  /**
   * Get transaction status and metadata
   */
  getStatus() {
    return {
      operationId: this.operationId,
      backupCreated: this.backupCreated,
      committed: this.committed,
      rolledBack: this.rolledBack,
      backupBranch: this.backupBranch,
      originalBranch: this.originalBranch,
      startTime: this.startTime,
      metadata: this.backupMetadata
    };
  }

  /**
   * Create a transaction wrapper for executing operations safely
   */
  static async execute(repoPath, operation, operationId = null) {
    const transaction = new GitTransaction(repoPath, operationId);
    
    try {
      // Create backup
      await transaction.createBackup();
      
      // Execute the operation
      const result = await operation(transaction);
      
      // Commit transaction
      await transaction.commit();
      
      return {
        success: true,
        result: result,
        transaction: transaction.getStatus()
      };
      
    } catch (error) {
      // Attempt rollback on failure
      try {
        await transaction.rollback();
        return {
          success: false,
          error: error.message,
          rolledBack: true,
          transaction: transaction.getStatus()
        };
      } catch (rollbackError) {
        return {
          success: false,
          error: error.message,
          rollbackError: rollbackError.message,
          rolledBack: false,
          transaction: transaction.getStatus()
        };
      }
    }
  }
}

module.exports = GitTransaction;