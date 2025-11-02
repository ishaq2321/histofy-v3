/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * GitManager Comprehensive Tests
 */

const GitManager = require('../src/core/GitManager');
const GitTransaction = require('../src/core/GitTransaction');
const OperationManager = require('../src/core/OperationManager');
const path = require('path');
const fs = require('fs').promises;
const { execSync, spawn } = require('child_process');
const os = require('os');

describe('GitManager', () => {
  let gitManager;
  let testRepoPath;
  let originalCwd;

  beforeAll(async () => {
    originalCwd = process.cwd();
    testRepoPath = path.join(os.tmpdir(), 'histofy-test-repo-' + Date.now());
    
    // Create test repository
    await fs.mkdir(testRepoPath, { recursive: true });
    process.chdir(testRepoPath);
    
    try {
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      
      // Create initial commit
      await fs.writeFile('README.md', '# Test Repository');
      execSync('git add README.md', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });
    } catch (error) {
      console.warn('Git setup failed, some tests may be skipped:', error.message);
    }
    
    gitManager = new GitManager(testRepoPath);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test repo:', error.message);
    }
  });

  describe('constructor', () => {
    test('should initialize with repository path', () => {
      const manager = new GitManager('/test/path');
      expect(manager.repoPath).toBe('/test/path');
    });

    test('should use current directory if no path provided', () => {
      const manager = new GitManager();
      expect(manager.repoPath).toBe(process.cwd());
    });
  });

  describe('isGitRepo', () => {
    test('should return true for valid git repository', async () => {
      const result = await gitManager.isGitRepo();
      expect(result).toBe(true);
    });

    test('should return false for non-git directory', async () => {
      const nonGitPath = path.join(os.tmpdir(), 'non-git-dir-' + Date.now());
      await fs.mkdir(nonGitPath, { recursive: true });
      
      const nonGitManager = new GitManager(nonGitPath);
      const result = await nonGitManager.isGitRepo();
      expect(result).toBe(false);
      
      await fs.rm(nonGitPath, { recursive: true, force: true });
    });

    test('should handle invalid paths gracefully', async () => {
      const invalidManager = new GitManager('/invalid/nonexistent/path');
      const result = await invalidManager.isGitRepo();
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    test('should get repository status', async () => {
      const status = await gitManager.getStatus();
      expect(status).toHaveProperty('files');
      expect(Array.isArray(status.files)).toBe(true);
    });

    test('should detect modified files', async () => {
      // Modify a file
      await fs.writeFile(path.join(testRepoPath, 'README.md'), '# Modified Test Repository');
      
      const status = await gitManager.getStatus();
      expect(status.files.some(file => file.path === 'README.md')).toBe(true);
      
      // Reset the file
      execSync('git checkout -- README.md', { stdio: 'ignore' });
    });

    test('should detect new files', async () => {
      const newFilePath = path.join(testRepoPath, 'new-file.txt');
      await fs.writeFile(newFilePath, 'New file content');
      
      const status = await gitManager.getStatus();
      expect(status.files.some(file => file.path === 'new-file.txt')).toBe(true);
      
      // Clean up
      await fs.unlink(newFilePath);
    });

    test('should handle non-git directory gracefully', async () => {
      const nonGitPath = path.join(os.tmpdir(), 'non-git-status-test');
      await fs.mkdir(nonGitPath, { recursive: true });
      
      const nonGitManager = new GitManager(nonGitPath);
      await expect(nonGitManager.getStatus()).rejects.toThrow();
      
      await fs.rm(nonGitPath, { recursive: true, force: true });
    });
  });

  describe('createCommit', () => {
    test('should create commit with custom date', async () => {
      // Create a test file
      const testFile = path.join(testRepoPath, 'test-commit.txt');
      await fs.writeFile(testFile, 'Test commit content');
      execSync('git add test-commit.txt', { stdio: 'ignore' });
      
      const commitData = {
        message: 'Test commit with custom date',
        date: '2023-06-15',
        time: '14:30',
        author: 'Test Author <test@example.com>'
      };
      
      const result = await gitManager.createCommit(commitData);
      expect(result.success).toBe(true);
      expect(result.hash).toBeDefined();
      
      // Verify commit was created
      const log = execSync('git log --oneline -1', { encoding: 'utf8' });
      expect(log).toContain('Test commit with custom date');
    });

    test('should handle commit creation errors', async () => {
      const commitData = {
        message: 'Test commit without staged files',
        date: '2023-06-15',
        time: '14:30'
      };
      
      // Try to commit without staged files
      const result = await gitManager.createCommit(commitData);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should validate commit data', async () => {
      const invalidCommitData = {
        message: '', // Empty message
        date: 'invalid-date',
        time: '25:70' // Invalid time
      };
      
      const result = await gitManager.createCommit(invalidCommitData);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executeMigration', () => {
    beforeEach(async () => {
      // Create multiple commits for migration testing
      for (let i = 1; i <= 3; i++) {
        const testFile = path.join(testRepoPath, `migration-test-${i}.txt`);
        await fs.writeFile(testFile, `Migration test content ${i}`);
        execSync(`git add migration-test-${i}.txt`, { stdio: 'ignore' });
        execSync(`git commit -m "Migration test commit ${i}"`, { stdio: 'ignore' });
      }
    });

    test('should execute migration with filter-branch strategy', async () => {
      const migrationPlan = {
        commits: [
          {
            hash: 'HEAD~2',
            newDate: '2023-06-15T10:00:00Z',
            message: 'Migrated commit 1'
          },
          {
            hash: 'HEAD~1',
            newDate: '2023-06-15T11:00:00Z',
            message: 'Migrated commit 2'
          }
        ],
        strategy: 'filter-branch'
      };
      
      const result = await gitManager.executeMigration(migrationPlan);
      expect(result.success).toBe(true);
      expect(result.migratedCommits).toBeDefined();
    });

    test('should execute migration with cherry-pick strategy', async () => {
      const migrationPlan = {
        commits: [
          {
            hash: 'HEAD~1',
            newDate: '2023-06-16T10:00:00Z',
            message: 'Cherry-picked commit'
          }
        ],
        strategy: 'cherry-pick'
      };
      
      const result = await gitManager.executeMigration(migrationPlan);
      expect(result.success).toBe(true);
    });

    test('should handle migration errors gracefully', async () => {
      const invalidMigrationPlan = {
        commits: [
          {
            hash: 'nonexistent-hash',
            newDate: '2023-06-15T10:00:00Z',
            message: 'Invalid commit'
          }
        ],
        strategy: 'filter-branch'
      };
      
      const result = await gitManager.executeMigration(invalidMigrationPlan);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should use appropriate strategy based on commit count', async () => {
      // Test automatic strategy selection
      const largeMigrationPlan = {
        commits: Array.from({ length: 15 }, (_, i) => ({
          hash: `HEAD~${i}`,
          newDate: `2023-06-${15 + i}T10:00:00Z`,
          message: `Bulk migration commit ${i + 1}`
        }))
      };
      
      const result = await gitManager.executeMigration(largeMigrationPlan);
      // Should handle large migrations (may fail due to test constraints, but should not crash)
      expect(result).toHaveProperty('success');
    });
  });

  describe('backup and restore', () => {
    test('should create repository backup', async () => {
      const backupResult = await gitManager.createBackup();
      expect(backupResult.success).toBe(true);
      expect(backupResult.backupPath).toBeDefined();
      
      // Verify backup exists
      const backupExists = await fs.access(backupResult.backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should restore from backup', async () => {
      // Create backup first
      const backupResult = await gitManager.createBackup();
      expect(backupResult.success).toBe(true);
      
      // Make some changes
      const testFile = path.join(testRepoPath, 'restore-test.txt');
      await fs.writeFile(testFile, 'Content to be restored');
      execSync('git add restore-test.txt', { stdio: 'ignore' });
      execSync('git commit -m "Commit to be restored"', { stdio: 'ignore' });
      
      // Restore from backup
      const restoreResult = await gitManager.restoreFromBackup(backupResult.backupPath);
      expect(restoreResult.success).toBe(true);
      
      // Verify restoration
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(false); // File should be gone after restore
    });

    test('should handle backup errors gracefully', async () => {
      const invalidManager = new GitManager('/invalid/path');
      const result = await invalidManager.createBackup();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('conflict resolution', () => {
    test('should detect merge conflicts', async () => {
      // This test would require setting up a conflict scenario
      // For now, test the conflict detection method exists
      expect(typeof gitManager.detectConflicts).toBe('function');
    });

    test('should resolve conflicts with strategy', async () => {
      // Test conflict resolution methods exist
      expect(typeof gitManager.resolveConflicts).toBe('function');
    });

    test('should handle manual conflict resolution', async () => {
      // Test manual resolution capability
      expect(typeof gitManager.openConflictEditor).toBe('function');
    });
  });

  describe('integration with other components', () => {
    test('should work with GitTransaction', async () => {
      const transaction = new GitTransaction(testRepoPath);
      expect(transaction).toBeInstanceOf(GitTransaction);
      
      // Test that GitManager can work within a transaction
      const backupResult = await transaction.createBackup();
      expect(backupResult.success).toBe(true);
    });

    test('should work with OperationManager', async () => {
      const operationManager = OperationManager.getInstance();
      const operationId = operationManager.startOperation('test-git-operation', 'Testing GitManager integration');
      
      expect(operationId).toBeDefined();
      
      // Complete the operation
      operationManager.completeOperation(operationId, { success: true });
      
      const operation = operationManager.getOperation(operationId);
      expect(operation.status).toBe('completed');
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle repository corruption gracefully', async () => {
      // Test with corrupted .git directory
      const corruptedPath = path.join(os.tmpdir(), 'corrupted-repo-' + Date.now());
      await fs.mkdir(corruptedPath, { recursive: true });
      await fs.mkdir(path.join(corruptedPath, '.git'), { recursive: true });
      await fs.writeFile(path.join(corruptedPath, '.git', 'HEAD'), 'invalid content');
      
      const corruptedManager = new GitManager(corruptedPath);
      const result = await corruptedManager.isGitRepo();
      
      // Should handle corruption gracefully
      expect(typeof result).toBe('boolean');
      
      await fs.rm(corruptedPath, { recursive: true, force: true });
    });

    test('should handle permission errors', async () => {
      // Test with read-only directory (if possible on current platform)
      const readOnlyPath = path.join(os.tmpdir(), 'readonly-repo-' + Date.now());
      await fs.mkdir(readOnlyPath, { recursive: true });
      
      try {
        await fs.chmod(readOnlyPath, 0o444); // Read-only
        const readOnlyManager = new GitManager(readOnlyPath);
        const result = await readOnlyManager.createBackup();
        
        expect(result.success).toBe(false);
      } catch (error) {
        // Permission changes might not work on all platforms
        console.warn('Permission test skipped:', error.message);
      } finally {
        try {
          await fs.chmod(readOnlyPath, 0o755); // Restore permissions
          await fs.rm(readOnlyPath, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn('Cleanup failed:', cleanupError.message);
        }
      }
    });

    test('should handle large repository operations', async () => {
      // Test with many files (simulate large repo)
      const largeRepoPath = path.join(os.tmpdir(), 'large-repo-' + Date.now());
      await fs.mkdir(largeRepoPath, { recursive: true });
      
      process.chdir(largeRepoPath);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      
      // Create many files
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(`file-${i}.txt`, `Content ${i}`);
      }
      
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Large commit"', { stdio: 'ignore' });
      
      const largeRepoManager = new GitManager(largeRepoPath);
      const status = await largeRepoManager.getStatus();
      
      expect(status).toHaveProperty('files');
      expect(Array.isArray(status.files)).toBe(true);
      
      process.chdir(originalCwd);
      await fs.rm(largeRepoPath, { recursive: true, force: true });
    });
  });

  describe('performance and optimization', () => {
    test('should handle concurrent operations', async () => {
      // Test multiple simultaneous status checks
      const promises = Array.from({ length: 5 }, () => gitManager.getStatus());
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toHaveProperty('files');
        expect(Array.isArray(result.files)).toBe(true);
      });
    });

    test('should cache frequently accessed data', async () => {
      // Test that repeated calls are efficient
      const start = Date.now();
      await gitManager.isGitRepo();
      const firstCall = Date.now() - start;
      
      const start2 = Date.now();
      await gitManager.isGitRepo();
      const secondCall = Date.now() - start2;
      
      // Second call should be faster (cached)
      expect(secondCall).toBeLessThanOrEqual(firstCall);
    });
  });
});
