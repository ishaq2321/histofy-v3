/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Dry-Run CLI Integration Tests
 */

const commitCommand = require('../../src/cli/commit');
const migrateCommand = require('../../src/cli/migrate');
const configCommand = require('../../src/cli/config');
const DryRunManager = require('../../src/utils/DryRunManager');

// Mock dependencies
jest.mock('../../src/core/GitManager');
jest.mock('../../src/config/ConfigManager');
jest.mock('../../src/utils/DryRunManager');

const GitManager = require('../../src/core/GitManager');
const ConfigManager = require('../../src/config/ConfigManager');

describe('Dry-Run CLI Integration', () => {
  let mockGitManager;
  let mockConfigManager;
  let mockDryRunManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup GitManager mock
    mockGitManager = {
      getStatus: jest.fn().mockResolvedValue({
        isClean: false,
        staged: [],
        modified: ['file1.txt'],
        untracked: []
      }),
      addFiles: jest.fn().mockResolvedValue({ success: true }),
      commitWithDate: jest.fn().mockResolvedValue({ 
        success: true, 
        hash: 'abc123def456' 
      }),
      migrateCommits: jest.fn().mockResolvedValue({
        success: true,
        commits: [
          {
            originalHash: 'abc123',
            message: 'Test commit',
            author: 'Test Author',
            originalDate: '2023-06-01',
            newDate: '2023-06-15'
          }
        ]
      })
    };
    GitManager.mockImplementation(() => mockGitManager);

    // Setup ConfigManager mock
    mockConfigManager = {
      loadConfig: jest.fn().mockResolvedValue({
        git: { defaultTime: '12:00' }
      }),
      set: jest.fn().mockResolvedValue({ success: true }),
      configFile: '~/.histofy/config.yaml'
    };
    ConfigManager.mockImplementation(() => mockConfigManager);

    // Setup DryRunManager mock
    mockDryRunManager = {
      displayPreview: jest.fn().mockReturnValue({
        totalOperations: 2,
        estimatedTime: 10
      }),
      operations: [],
      warnings: []
    };
    DryRunManager.forCommitOperation = jest.fn().mockReturnValue(mockDryRunManager);
    DryRunManager.forMigrationOperation = jest.fn().mockReturnValue(mockDryRunManager);
    DryRunManager.forConfigOperation = jest.fn().mockReturnValue(mockDryRunManager);

    // Mock console.log to capture output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('commit command dry-run', () => {
    test('should execute dry-run for commit command', async () => {
      const result = await commitCommand('Test commit message', {
        date: '2023-06-15',
        time: '10:00',
        addAll: true,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.summary).toBeDefined();
      expect(DryRunManager.forCommitOperation).toHaveBeenCalledWith({
        message: 'Test commit message',
        date: '2023-06-15',
        time: '10:00',
        author: undefined,
        addAll: true,
        push: undefined,
        files: null
      });
      expect(mockDryRunManager.displayPreview).toHaveBeenCalledWith({
        showDetails: true,
        showWarnings: true,
        showGitCommands: true
      });

      // Should not execute actual Git operations
      expect(mockGitManager.commitWithDate).not.toHaveBeenCalled();
    });

    test('should handle dry-run with push option', async () => {
      const result = await commitCommand('Test commit', {
        dryRun: true,
        push: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(DryRunManager.forCommitOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          push: true
        })
      );
    });

    test('should handle dry-run with custom author', async () => {
      const result = await commitCommand('Test commit', {
        dryRun: true,
        author: 'John Doe <john@example.com>'
      });

      expect(result.success).toBe(true);
      expect(DryRunManager.forCommitOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          author: 'John Doe <john@example.com>'
        })
      );
    });
  });

  describe('migrate command dry-run', () => {
    test('should execute dry-run for migrate command', async () => {
      const result = await migrateCommand('HEAD~3..HEAD', {
        toDate: '2023-06-15',
        spread: '3',
        startTime: '09:00',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.commits).toBeDefined();
      
      expect(DryRunManager.forMigrationOperation).toHaveBeenCalledWith({
        commits: expect.any(Array),
        strategy: undefined,
        targetDate: '2023-06-15',
        spread: '3'
      });
      
      expect(mockDryRunManager.displayPreview).toHaveBeenCalledWith({
        showDetails: true,
        showWarnings: true,
        showGitCommands: false
      });

      // Should not execute actual migration
      expect(mockGitManager.executeMigration).not.toHaveBeenCalled();
    });

    test('should show migration plan before dry-run', async () => {
      await migrateCommand('HEAD~1..HEAD', {
        toDate: '2023-06-15',
        dryRun: true
      });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Migration Plan:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE'));
    });

    test('should provide execution guidance after dry-run', async () => {
      await migrateCommand('HEAD~1..HEAD', {
        toDate: '2023-06-15',
        dryRun: true
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('To execute this migration, run the same command with --execute')
      );
    });
  });

  describe('config command dry-run', () => {
    test('should execute dry-run for config set command', async () => {
      const result = await configCommand.set('github.token', 'test-token', {
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.summary).toBeDefined();
      
      expect(DryRunManager.forConfigOperation).toHaveBeenCalledWith({
        action: 'set',
        key: 'github.token',
        value: 'test-token',
        sensitive: true,
        configFile: '~/.histofy/config.yaml'
      });
      
      expect(mockDryRunManager.displayPreview).toHaveBeenCalledWith({
        showDetails: true,
        showWarnings: true
      });

      // Should not execute actual config update
      expect(mockConfigManager.set).not.toHaveBeenCalled();
    });

    test('should detect sensitive configuration keys', async () => {
      await configCommand.set('github.token', 'secret', { dryRun: true });
      
      expect(DryRunManager.forConfigOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          sensitive: true
        })
      );
    });

    test('should detect non-sensitive configuration keys', async () => {
      await configCommand.set('git.defaultTime', '10:00', { dryRun: true });
      
      expect(DryRunManager.forConfigOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          sensitive: false
        })
      );
    });

    test('should provide execution guidance after config dry-run', async () => {
      await configCommand.set('test.key', 'test-value', { dryRun: true });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('To apply this configuration, run the same command without --dry-run')
      );
    });
  });

  describe('error handling in dry-run mode', () => {
    test('should handle validation errors in commit dry-run', async () => {
      const result = await commitCommand('', { // Empty message
        dryRun: true
      });

      // Should fail validation before reaching dry-run
      expect(result).toBeUndefined();
      expect(DryRunManager.forCommitOperation).not.toHaveBeenCalled();
    });

    test('should handle validation errors in migrate dry-run', async () => {
      const result = await migrateCommand('invalid-range', {
        toDate: 'invalid-date',
        dryRun: true
      });

      // Should fail validation before reaching dry-run
      expect(result).toBeUndefined();
      expect(DryRunManager.forMigrationOperation).not.toHaveBeenCalled();
    });

    test('should handle validation errors in config dry-run', async () => {
      // Mock validation to fail
      const originalValidateConfigKeyValue = configCommand.validateConfigKeyValue;
      configCommand.validateConfigKeyValue = jest.fn().mockReturnValue({
        isValid: false,
        error: 'Invalid key format'
      });

      const result = await configCommand.set('invalid..key', 'value', {
        dryRun: true
      });

      // Should fail validation before reaching dry-run
      expect(result).toBeUndefined();
      expect(DryRunManager.forConfigOperation).not.toHaveBeenCalled();

      // Restore original method
      configCommand.validateConfigKeyValue = originalValidateConfigKeyValue;
    });
  });

  describe('dry-run output formatting', () => {
    test('should display dry-run header consistently', async () => {
      await commitCommand('Test', { dryRun: true });
      await migrateCommand('HEAD~1..HEAD', { toDate: '2023-06-15', dryRun: true });
      await configCommand.set('test.key', 'value', { dryRun: true });

      // All commands should show dry-run mode indicator
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN MODE')
      );
    });

    test('should provide consistent execution guidance', async () => {
      await commitCommand('Test', { dryRun: true });
      await migrateCommand('HEAD~1..HEAD', { toDate: '2023-06-15', dryRun: true });
      await configCommand.set('test.key', 'value', { dryRun: true });

      // All commands should provide guidance on how to execute
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('To execute')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('To apply')
      );
    });
  });

  describe('dry-run integration with progress system', () => {
    test('should complete progress steps in dry-run mode', async () => {
      const result = await commitCommand('Test commit', {
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      
      // Should complete all progress steps without actual execution
      expect(mockDryRunManager.displayPreview).toHaveBeenCalled();
    });

    test('should skip actual operations in dry-run mode', async () => {
      await commitCommand('Test commit', {
        dryRun: true,
        addAll: true,
        push: true
      });

      // Should not execute any actual Git operations
      expect(mockGitManager.addFiles).not.toHaveBeenCalled();
      expect(mockGitManager.commitWithDate).not.toHaveBeenCalled();
      expect(mockGitManager.pushToRemote).not.toHaveBeenCalled();
    });
  });
});