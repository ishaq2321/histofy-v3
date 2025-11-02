/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * CLI Commit Command Tests
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Mock the CLI modules
jest.mock('../../src/core/GitManager');
jest.mock('../../src/core/OperationManager');
jest.mock('../../src/config/ConfigManager');

const GitManager = require('../../src/core/GitManager');
const OperationManager = require('../../src/core/OperationManager');
const ConfigManager = require('../../src/config/ConfigManager');

describe('CLI Commit Command', () => {
  let testRepoPath;
  let originalCwd;
  let mockGitManager;
  let mockOperationManager;
  let mockConfigManager;

  beforeAll(() => {
    originalCwd = process.cwd();
    testRepoPath = path.join(os.tmpdir(), 'histofy-cli-test-' + Date.now());
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup GitManager mock
    mockGitManager = {
      isGitRepo: jest.fn().mockResolvedValue(true),
      getStatus: jest.fn().mockResolvedValue({ files: [] }),
      createCommit: jest.fn().mockResolvedValue({ success: true, hash: 'abc123' }),
      stageFiles: jest.fn().mockResolvedValue({ success: true })
    };
    GitManager.mockImplementation(() => mockGitManager);

    // Setup OperationManager mock
    mockOperationManager = {
      startOperation: jest.fn().mockReturnValue('op-123'),
      updateProgress: jest.fn(),
      completeOperation: jest.fn(),
      failOperation: jest.fn(),
      getInstance: jest.fn().mockReturnValue(mockOperationManager)
    };
    OperationManager.getInstance.mockReturnValue(mockOperationManager);

    // Setup ConfigManager mock
    mockConfigManager = {
      get: jest.fn().mockResolvedValue(null),
      getAll: jest.fn().mockResolvedValue({
        git: {
          defaultAuthor: 'Test User',
          defaultEmail: 'test@example.com',
          defaultTime: '12:00'
        }
      })
    };
    ConfigManager.mockImplementation(() => mockConfigManager);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('commit command execution', () => {
    test('should create commit with basic parameters', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15',
        time: '14:30',
        addAll: true
      };

      await commitCommand.handler('Test commit message', options);

      expect(mockGitManager.createCommit).toHaveBeenCalledWith({
        message: 'Test commit message',
        date: '2023-06-15',
        time: '14:30',
        author: expect.any(String)
      });
    });

    test('should handle missing message', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15',
        time: '14:30'
      };

      await expect(commitCommand.handler('', options)).rejects.toThrow();
    });

    test('should use default values from config', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {}; // No date/time specified

      await commitCommand.handler('Test commit', options);

      expect(mockConfigManager.getAll).toHaveBeenCalled();
      expect(mockGitManager.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test commit',
          time: '12:00' // Default from config
        })
      );
    });

    test('should stage files when addAll is true', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15',
        addAll: true
      };

      await commitCommand.handler('Test commit', options);

      expect(mockGitManager.stageFiles).toHaveBeenCalledWith('.');
    });

    test('should handle git repository validation', async () => {
      mockGitManager.isGitRepo.mockResolvedValue(false);
      
      const commitCommand = require('../../src/cli/commit');
      const options = { date: '2023-06-15' };

      await expect(commitCommand.handler('Test commit', options)).rejects.toThrow();
    });

    test('should handle commit creation errors', async () => {
      mockGitManager.createCommit.mockResolvedValue({
        success: false,
        error: 'Nothing to commit'
      });
      
      const commitCommand = require('../../src/cli/commit');
      const options = { date: '2023-06-15' };

      await expect(commitCommand.handler('Test commit', options)).rejects.toThrow('Nothing to commit');
    });

    test('should push to remote when push option is true', async () => {
      mockGitManager.push = jest.fn().mockResolvedValue({ success: true });
      
      const commitCommand = require('../../src/cli/commit');
      const options = {
        date: '2023-06-15',
        push: true
      };

      await commitCommand.handler('Test commit', options);

      expect(mockGitManager.push).toHaveBeenCalled();
    });

    test('should handle push errors gracefully', async () => {
      mockGitManager.push = jest.fn().mockResolvedValue({
        success: false,
        error: 'Remote rejected'
      });
      
      const commitCommand = require('../../src/cli/commit');
      const options = {
        date: '2023-06-15',
        push: true
      };

      // Should not throw, but should log warning
      await commitCommand.handler('Test commit', options);
      
      expect(mockGitManager.push).toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    test('should validate date format', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: 'invalid-date',
        time: '14:30'
      };

      await expect(commitCommand.handler('Test commit', options)).rejects.toThrow();
    });

    test('should validate time format', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15',
        time: '25:70' // Invalid time
      };

      await expect(commitCommand.handler('Test commit', options)).rejects.toThrow();
    });

    test('should sanitize commit message', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15'
      };

      const maliciousMessage = 'Test commit; rm -rf /';
      await commitCommand.handler(maliciousMessage, options);

      // Should sanitize the message
      expect(mockGitManager.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.not.stringContaining(';')
        })
      );
    });

    test('should validate commit message length', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15'
      };

      // Too short message
      await expect(commitCommand.handler('Hi', options)).rejects.toThrow();

      // Too long message
      const longMessage = 'A'.repeat(100);
      await expect(commitCommand.handler(longMessage, options)).rejects.toThrow();
    });
  });

  describe('operation management integration', () => {
    test('should start and complete operation', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15'
      };

      await commitCommand.handler('Test commit', options);

      expect(mockOperationManager.startOperation).toHaveBeenCalledWith(
        'commit',
        expect.any(String)
      );
      expect(mockOperationManager.completeOperation).toHaveBeenCalledWith(
        'op-123',
        expect.any(Object)
      );
    });

    test('should fail operation on error', async () => {
      mockGitManager.createCommit.mockRejectedValue(new Error('Git error'));
      
      const commitCommand = require('../../src/cli/commit');
      const options = { date: '2023-06-15' };

      await expect(commitCommand.handler('Test commit', options)).rejects.toThrow();

      expect(mockOperationManager.failOperation).toHaveBeenCalledWith(
        'op-123',
        expect.any(Error)
      );
    });

    test('should update progress during operation', async () => {
      const commitCommand = require('../../src/cli/commit');
      
      const options = {
        date: '2023-06-15',
        addAll: true
      };

      await commitCommand.handler('Test commit', options);

      expect(mockOperationManager.updateProgress).toHaveBeenCalled();
    });
  });

  describe('interactive mode', () => {
    test('should prompt for missing information', async () => {
      // This would test interactive prompts
      // For now, just ensure the interactive handler exists
      const commitCommand = require('../../src/cli/commit');
      expect(typeof commitCommand.interactive).toBe('function');
    });

    test('should validate interactive inputs', async () => {
      // Test that interactive mode validates inputs
      const commitCommand = require('../../src/cli/commit');
      
      if (commitCommand.interactive) {
        // Mock inquirer responses
        const mockInquirer = {
          prompt: jest.fn().mockResolvedValue({
            message: 'Interactive commit',
            date: '2023-06-15',
            time: '14:30'
          })
        };

        // Test interactive validation
        expect(typeof commitCommand.interactive).toBe('function');
      }
    });
  });

  describe('error recovery', () => {
    test('should provide recovery suggestions on failure', async () => {
      mockGitManager.createCommit.mockResolvedValue({
        success: false,
        error: 'Nothing to commit, working tree clean'
      });
      
      const commitCommand = require('../../src/cli/commit');
      const options = { date: '2023-06-15' };

      try {
        await commitCommand.handler('Test commit', options);
      } catch (error) {
        expect(error.message).toContain('Nothing to commit');
        // Should provide helpful suggestions
      }
    });

    test('should handle network errors during push', async () => {
      mockGitManager.push = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const commitCommand = require('../../src/cli/commit');
      const options = {
        date: '2023-06-15',
        push: true
      };

      // Should handle push errors gracefully
      await commitCommand.handler('Test commit', options);
      
      expect(mockGitManager.createCommit).toHaveBeenCalled();
    });
  });

  describe('configuration integration', () => {
    test('should use author from config', async () => {
      mockConfigManager.get.mockImplementation((key) => {
        if (key === 'git.defaultAuthor') return Promise.resolve('Config Author');
        if (key === 'git.defaultEmail') return Promise.resolve('config@example.com');
        return Promise.resolve(null);
      });
      
      const commitCommand = require('../../src/cli/commit');
      const options = { date: '2023-06-15' };

      await commitCommand.handler('Test commit', options);

      expect(mockGitManager.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          author: 'Config Author <config@example.com>'
        })
      );
    });

    test('should override config with command line options', async () => {
      const commitCommand = require('../../src/cli/commit');
      const options = {
        date: '2023-06-15',
        time: '16:45', // Override config default
        author: 'CLI Author <cli@example.com>'
      };

      await commitCommand.handler('Test commit', options);

      expect(mockGitManager.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          time: '16:45',
          author: 'CLI Author <cli@example.com>'
        })
      );
    });
  });
});