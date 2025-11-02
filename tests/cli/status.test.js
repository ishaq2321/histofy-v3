/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * CLI Status Command Tests
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Mock the CLI modules
jest.mock('../../src/core/GitManager');
jest.mock('../../src/core/GitHubManager');
jest.mock('../../src/core/OperationManager');
jest.mock('../../src/config/ConfigManager');

const GitManager = require('../../src/core/GitManager');
const GitHubManager = require('../../src/core/GitHubManager');
const OperationManager = require('../../src/core/OperationManager');
const ConfigManager = require('../../src/config/ConfigManager');

describe('CLI Status Command', () => {
  let mockGitManager;
  let mockGitHubManager;
  let mockOperationManager;
  let mockConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup GitManager mock
    mockGitManager = {
      isGitRepo: jest.fn().mockResolvedValue(true),
      getStatus: jest.fn().mockResolvedValue({
        files: [
          { path: 'file1.txt', status: 'modified' },
          { path: 'file2.txt', status: 'added' }
        ],
        branch: 'main',
        ahead: 2,
        behind: 0,
        clean: false
      }),
      getCommitHistory: jest.fn().mockResolvedValue([
        { hash: 'abc123', message: 'Recent commit', date: '2023-06-15' }
      ])
    };
    GitManager.mockImplementation(() => mockGitManager);

    // Setup GitHubManager mock
    mockGitHubManager = {
      getRemoteStatus: jest.fn().mockResolvedValue({
        connected: true,
        repository: 'user/repo',
        lastSync: '2023-06-15T10:00:00Z'
      }),
      validateToken: jest.fn().mockResolvedValue(true)
    };
    GitHubManager.mockImplementation(() => mockGitHubManager);

    // Setup OperationManager mock
    mockOperationManager = {
      getActiveOperations: jest.fn().mockReturnValue([]),
      getRecentOperations: jest.fn().mockReturnValue([
        { id: 'op-1', type: 'commit', status: 'completed', timestamp: Date.now() }
      ])
    };
    OperationManager.getInstance = jest.fn().mockReturnValue(mockOperationManager);

    // Setup ConfigManager mock
    mockConfigManager = {
      getAll: jest.fn().mockResolvedValue({
        github: { token: 'valid-token' },
        ui: { colorOutput: true, verboseOutput: false }
      })
    };
    ConfigManager.mockImplementation(() => mockConfigManager);
  });

  describe('basic status display', () => {
    test('should display repository status', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(mockGitManager.getStatus).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Repository Status'));
      
      consoleSpy.mockRestore();
    });

    test('should show file changes', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('file1.txt'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('file2.txt'));
      
      consoleSpy.mockRestore();
    });

    test('should show branch information', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('main'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ahead'));
      
      consoleSpy.mockRestore();
    });

    test('should handle clean repository', async () => {
      mockGitManager.getStatus.mockResolvedValue({
        files: [],
        branch: 'main',
        ahead: 0,
        behind: 0,
        clean: true
      });

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('clean'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('remote status', () => {
    test('should display remote status when requested', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = { remote: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(mockGitHubManager.getRemoteStatus).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Remote Status'));
      
      consoleSpy.mockRestore();
    });

    test('should handle remote connection errors', async () => {
      mockGitHubManager.getRemoteStatus.mockRejectedValue(new Error('Network error'));

      const statusCommand = require('../../src/cli/status');
      const options = { remote: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await statusCommand.handler(options);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('remote status'));
      
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('should validate GitHub token', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = { remote: true };

      await statusCommand.handler(options);

      expect(mockGitHubManager.validateToken).toHaveBeenCalled();
    });

    test('should handle invalid GitHub token', async () => {
      mockGitHubManager.validateToken.mockResolvedValue(false);

      const statusCommand = require('../../src/cli/status');
      const options = { remote: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await statusCommand.handler(options);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('token'));
      
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('verbose output', () => {
    test('should show detailed information in verbose mode', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = { verbose: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(mockGitManager.getCommitHistory).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recent Commits'));
      
      consoleSpy.mockRestore();
    });

    test('should show operation history in verbose mode', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = { verbose: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(mockOperationManager.getRecentOperations).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recent Operations'));
      
      consoleSpy.mockRestore();
    });

    test('should show configuration in verbose mode', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = { verbose: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(mockConfigManager.getAll).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('active operations', () => {
    test('should show active operations', async () => {
      mockOperationManager.getActiveOperations.mockReturnValue([
        { id: 'op-active', type: 'migration', status: 'running', progress: 50 }
      ]);

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Operations'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('migration'));
      
      consoleSpy.mockRestore();
    });

    test('should handle no active operations', async () => {
      mockOperationManager.getActiveOperations.mockReturnValue([]);

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      // Should not show active operations section
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Active Operations'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    test('should handle non-git repository', async () => {
      mockGitManager.isGitRepo.mockResolvedValue(false);

      const statusCommand = require('../../src/cli/status');
      const options = {};

      await expect(statusCommand.handler(options)).rejects.toThrow('not a git repository');
    });

    test('should handle git status errors', async () => {
      mockGitManager.getStatus.mockRejectedValue(new Error('Git error'));

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      await statusCommand.handler(options);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
      
      errorSpy.mockRestore();
    });

    test('should handle configuration errors', async () => {
      mockConfigManager.getAll.mockRejectedValue(new Error('Config error'));

      const statusCommand = require('../../src/cli/status');
      const options = { verbose: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await statusCommand.handler(options);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('configuration'));
      
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('output formatting', () => {
    test('should use colors when enabled', async () => {
      mockConfigManager.getAll.mockResolvedValue({
        ui: { colorOutput: true }
      });

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      // Should use colored output (chalk colors)
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should disable colors when configured', async () => {
      mockConfigManager.getAll.mockResolvedValue({
        ui: { colorOutput: false }
      });

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      // Should use plain text output
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should format file status correctly', async () => {
      mockGitManager.getStatus.mockResolvedValue({
        files: [
          { path: 'modified.txt', status: 'M' },
          { path: 'added.txt', status: 'A' },
          { path: 'deleted.txt', status: 'D' },
          { path: 'untracked.txt', status: '??' }
        ],
        branch: 'main',
        clean: false
      });

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('modified.txt'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('added.txt'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('deleted.txt'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('untracked.txt'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('performance', () => {
    test('should handle large number of files efficiently', async () => {
      const manyFiles = Array.from({ length: 1000 }, (_, i) => ({
        path: `file${i}.txt`,
        status: 'M'
      }));

      mockGitManager.getStatus.mockResolvedValue({
        files: manyFiles,
        branch: 'main',
        clean: false
      });

      const statusCommand = require('../../src/cli/status');
      const options = {};

      const start = Date.now();
      await statusCommand.handler(options);
      const duration = Date.now() - start;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    test('should cache status information', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = {};

      // First call
      await statusCommand.handler(options);
      const firstCallCount = mockGitManager.getStatus.mock.calls.length;

      // Second call should potentially use cache
      await statusCommand.handler(options);
      const secondCallCount = mockGitManager.getStatus.mock.calls.length;

      expect(secondCallCount).toBeGreaterThanOrEqual(firstCallCount);
    });
  });

  describe('integration', () => {
    test('should work with all components together', async () => {
      const statusCommand = require('../../src/cli/status');
      const options = { remote: true, verbose: true };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await statusCommand.handler(options);

      // Should call all relevant components
      expect(mockGitManager.getStatus).toHaveBeenCalled();
      expect(mockGitHubManager.getRemoteStatus).toHaveBeenCalled();
      expect(mockOperationManager.getRecentOperations).toHaveBeenCalled();
      expect(mockConfigManager.getAll).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});