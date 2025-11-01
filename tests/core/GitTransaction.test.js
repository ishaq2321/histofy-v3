/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * GitTransaction Tests
 */

const GitTransaction = require('../../src/core/GitTransaction');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('GitTransaction', () => {
  let testRepoPath;
  let git;
  let transaction;

  beforeEach(async () => {
    // Create temporary test repository
    testRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'histofy-test-'));
    git = simpleGit(testRepoPath);
    
    // Initialize test repository
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    
    // Create initial commit
    await fs.writeFile(path.join(testRepoPath, 'test.txt'), 'initial content');
    await git.add('test.txt');
    await git.commit('Initial commit');
    
    transaction = new GitTransaction(testRepoPath);
  });

  afterEach(async () => {
    // Cleanup test repository
    if (testRepoPath) {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('should initialize with repository path', () => {
      expect(transaction.repoPath).toBe(testRepoPath);
      expect(transaction.operationId).toBeDefined();
      expect(transaction.backupCreated).toBe(false);
      expect(transaction.committed).toBe(false);
      expect(transaction.rolledBack).toBe(false);
    });

    test('should accept custom operation ID', () => {
      const customId = 'custom-operation-123';
      const customTransaction = new GitTransaction(testRepoPath, customId);
      expect(customTransaction.operationId).toBe(customId);
    });
  });

  describe('createBackup', () => {
    test('should create backup branch successfully', async () => {
      const result = await transaction.createBackup();
      
      expect(result.success).toBe(true);
      expect(result.backupBranch).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(transaction.backupCreated).toBe(true);
      
      // Verify backup branch exists
      const branches = await git.branch(['-a']);
      expect(branches.all.some(branch => branch.name === result.backupBranch)).toBe(true);
    });

    test('should fail if repository is not clean', async () => {
      // Create uncommitted changes
      await fs.writeFile(path.join(testRepoPath, 'test.txt'), 'modified content');
      
      await expect(transaction.createBackup()).rejects.toThrow('Repository must be clean');
    });

    test('should fail if backup already created', async () => {
      await transaction.createBackup();
      await expect(transaction.createBackup()).rejects.toThrow('Backup already created');
    });

    test('should verify backup integrity', async () => {
      const result = await transaction.createBackup();
      
      // Verify backup HEAD matches original HEAD
      const originalHead = await git.revparse(['HEAD']);
      const backupHead = await git.revparse([result.backupBranch]);
      
      expect(originalHead.trim()).toBe(backupHead.trim());
    });
  });

  describe('verifyBackupIntegrity', () => {
    test('should verify backup integrity successfully', async () => {
      await transaction.createBackup();
      const result = await transaction.verifyBackupIntegrity();
      expect(result).toBe(true);
    });

    test('should fail if backup branches not initialized', async () => {
      await expect(transaction.verifyBackupIntegrity()).rejects.toThrow('Backup branches not properly initialized');
    });
  });

  describe('commit', () => {
    test('should commit transaction successfully', async () => {
      await transaction.createBackup();
      const result = await transaction.commit();
      
      expect(result.success).toBe(true);
      expect(transaction.committed).toBe(true);
      expect(result.backupBranch).toBeDefined();
    });

    test('should fail if no backup created', async () => {
      await expect(transaction.commit()).rejects.toThrow('Cannot commit transaction: No backup created');
    });

    test('should fail if already committed', async () => {
      await transaction.createBackup();
      await transaction.commit();
      await expect(transaction.commit()).rejects.toThrow('Transaction already committed');
    });

    test('should fail if already rolled back', async () => {
      await transaction.createBackup();
      await transaction.rollback();
      await expect(transaction.commit()).rejects.toThrow('Cannot commit transaction: Already rolled back');
    });
  });

  describe('rollback', () => {
    test('should rollback transaction successfully', async () => {
      await transaction.createBackup();
      
      // Make some changes
      await fs.writeFile(path.join(testRepoPath, 'new-file.txt'), 'new content');
      await git.add('new-file.txt');
      await git.commit('New commit');
      
      const result = await transaction.rollback();
      
      expect(result.success).toBe(true);
      expect(transaction.rolledBack).toBe(true);
      
      // Verify repository is restored to backup state
      const currentHead = await git.revparse(['HEAD']);
      const backupHead = await git.revparse([transaction.backupBranch]);
      expect(currentHead.trim()).toBe(backupHead.trim());
    });

    test('should fail if no backup created', async () => {
      await expect(transaction.rollback()).rejects.toThrow('Cannot rollback transaction: No backup created');
    });

    test('should fail if already committed', async () => {
      await transaction.createBackup();
      await transaction.commit();
      await expect(transaction.rollback()).rejects.toThrow('Cannot rollback transaction: Already committed');
    });

    test('should fail if already rolled back', async () => {
      await transaction.createBackup();
      await transaction.rollback();
      await expect(transaction.rollback()).rejects.toThrow('Transaction already rolled back');
    });
  });

  describe('validateCurrentState', () => {
    test('should validate repository state successfully', async () => {
      const result = await transaction.validateCurrentState();
      expect(result.isValid).toBe(true);
      expect(result.status).toBeDefined();
    });
  });

  describe('cleanupBackup', () => {
    test('should cleanup backup after commit', async () => {
      await transaction.createBackup();
      const backupBranch = transaction.backupBranch;
      await transaction.commit();
      
      const result = await transaction.cleanupBackup();
      expect(result.success).toBe(true);
      
      // Verify backup branch is deleted
      const branches = await git.branch(['-a']);
      expect(branches.all.some(branch => branch.name === backupBranch)).toBe(false);
    });

    test('should cleanup backup after rollback', async () => {
      await transaction.createBackup();
      const backupBranch = transaction.backupBranch;
      await transaction.rollback();
      
      const result = await transaction.cleanupBackup();
      expect(result.success).toBe(true);
    });

    test('should fail to cleanup active transaction', async () => {
      await transaction.createBackup();
      const result = await transaction.cleanupBackup();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction is still active');
    });
  });

  describe('getStatus', () => {
    test('should return transaction status', async () => {
      const status = transaction.getStatus();
      
      expect(status.operationId).toBeDefined();
      expect(status.backupCreated).toBe(false);
      expect(status.committed).toBe(false);
      expect(status.rolledBack).toBe(false);
      expect(status.startTime).toBeDefined();
    });

    test('should update status after backup creation', async () => {
      await transaction.createBackup();
      const status = transaction.getStatus();
      
      expect(status.backupCreated).toBe(true);
      expect(status.backupBranch).toBeDefined();
      expect(status.originalBranch).toBeDefined();
      expect(status.metadata).toBeDefined();
    });
  });

  describe('static execute', () => {
    test('should execute operation with automatic transaction management', async () => {
      const operation = async (transaction) => {
        // Simulate some Git operation
        await fs.writeFile(path.join(testRepoPath, 'operation-file.txt'), 'operation content');
        await git.add('operation-file.txt');
        await git.commit('Operation commit');
        return { operationResult: 'success' };
      };

      const result = await GitTransaction.execute(testRepoPath, operation);
      
      expect(result.success).toBe(true);
      expect(result.result.operationResult).toBe('success');
      expect(result.transaction.committed).toBe(true);
    });

    test('should rollback on operation failure', async () => {
      const operation = async (transaction) => {
        // Simulate operation that fails
        await fs.writeFile(path.join(testRepoPath, 'operation-file.txt'), 'operation content');
        await git.add('operation-file.txt');
        await git.commit('Operation commit');
        throw new Error('Operation failed');
      };

      const result = await GitTransaction.execute(testRepoPath, operation);
      
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(result.error).toBe('Operation failed');
      
      // Verify repository is restored to original state
      const log = await git.log();
      expect(log.all.length).toBe(1); // Only initial commit should remain
    });
  });

  describe('error handling', () => {
    test('should handle Git errors gracefully', async () => {
      // Create transaction with invalid repository path
      const invalidTransaction = new GitTransaction('/invalid/path');
      
      await expect(invalidTransaction.createBackup()).rejects.toThrow();
    });

    test('should cleanup failed backup attempts', async () => {
      // Mock Git operation to fail after branch creation
      const originalCheckoutBranch = git.checkoutBranch;
      git.checkoutBranch = jest.fn().mockImplementation(async (branchName) => {
        await originalCheckoutBranch.call(git, branchName, 'main');
        throw new Error('Simulated failure');
      });

      await expect(transaction.createBackup()).rejects.toThrow();
      
      // Verify no backup branch remains
      const branches = await git.branch(['-a']);
      expect(branches.all.some(branch => branch.name.includes('histofy-backup'))).toBe(false);
    });
  });
});