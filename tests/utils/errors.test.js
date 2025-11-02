/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Error Handling Utilities Tests
 */

const {
  HistofyError,
  ValidationError,
  GitError,
  NetworkError,
  FileSystemError,
  ConfigurationError,
  ErrorHandler
} = require('../../src/utils/errors');

describe('Error Classes', () => {
  describe('HistofyError', () => {
    test('should create basic error with message', () => {
      const error = new HistofyError('Test error message');
      
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('HistofyError');
      expect(error.code).toBe('HISTOFY_ERROR');
      expect(error.timestamp).toBeDefined();
      expect(error.context).toEqual({});
    });

    test('should create error with custom code and context', () => {
      const context = { operation: 'test', data: 'value' };
      const error = new HistofyError('Test error', 'CUSTOM_CODE', context);
      
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.context).toEqual(context);
    });

    test('should be instance of Error', () => {
      const error = new HistofyError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HistofyError);
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with field and suggestion', () => {
      const error = new ValidationError('Invalid email format', 'email', 'Use format: user@domain.com');
      
      expect(error.message).toBe('Invalid email format');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('email');
      expect(error.suggestion).toBe('Use format: user@domain.com');
    });

    test('should inherit from HistofyError', () => {
      const error = new ValidationError('Test validation error');
      expect(error).toBeInstanceOf(HistofyError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('GitError', () => {
    test('should create git error with operation and git error details', () => {
      const gitError = { code: 128, message: 'Git command failed' };
      const error = new GitError('Repository not found', 'clone', gitError);
      
      expect(error.message).toBe('Repository not found');
      expect(error.name).toBe('GitError');
      expect(error.operation).toBe('clone');
      expect(error.gitError).toEqual(gitError);
    });
  });

  describe('NetworkError', () => {
    test('should create network error with URL and status code', () => {
      const error = new NetworkError('Request failed', 'https://api.github.com', 404, false);
      
      expect(error.message).toBe('Request failed');
      expect(error.name).toBe('NetworkError');
      expect(error.url).toBe('https://api.github.com');
      expect(error.statusCode).toBe(404);
      expect(error.retryable).toBe(false);
    });

    test('should default retryable to true', () => {
      const error = new NetworkError('Network timeout');
      expect(error.retryable).toBe(true);
    });
  });

  describe('FileSystemError', () => {
    test('should create filesystem error with path and operation', () => {
      const error = new FileSystemError('Permission denied', '/path/to/file', 'write');
      
      expect(error.message).toBe('Permission denied');
      expect(error.name).toBe('FileSystemError');
      expect(error.path).toBe('/path/to/file');
      expect(error.operation).toBe('write');
    });
  });

  describe('ConfigurationError', () => {
    test('should create configuration error with key and suggestion', () => {
      const error = new ConfigurationError('Invalid token', 'github.token', 'Generate new token');
      
      expect(error.message).toBe('Invalid token');
      expect(error.name).toBe('ConfigurationError');
      expect(error.configKey).toBe('github.token');
      expect(error.suggestion).toBe('Generate new token');
    });
  });
});

describe('ErrorHandler', () => {
  // Mock chalk to avoid color codes in tests
  beforeAll(() => {
    jest.mock('chalk', () => ({
      red: (text) => text,
      yellow: (text) => text,
      green: (text) => text,
      blue: (text) => text
    }));
  });

  describe('handleValidationError', () => {
    test('should format ValidationError instance', () => {
      const error = new ValidationError('Invalid email format', 'email', 'Use format: user@domain.com');
      const result = ErrorHandler.handleValidationError(error, 'user registration');
      
      expect(result).toContain('Validation Error:');
      expect(result).toContain('Context: user registration');
      expect(result).toContain('Field: email');
      expect(result).toContain('Invalid email format');
      expect(result).toContain('Suggestion:');
      expect(result).toContain('Use format: user@domain.com');
    });

    test('should format validation result object', () => {
      const validationResult = {
        error: 'Date is required',
        field: 'date',
        suggestion: 'Provide date in YYYY-MM-DD format'
      };
      
      const result = ErrorHandler.handleValidationError(validationResult);
      
      expect(result).toContain('Date is required');
      expect(result).toContain('Field: date');
      expect(result).toContain('Provide date in YYYY-MM-DD format');
    });

    test('should handle string error', () => {
      const result = ErrorHandler.handleValidationError('Simple validation error');
      
      expect(result).toContain('Simple validation error');
    });
  });

  describe('handleGitError', () => {
    test('should format git error with suggestions', () => {
      const error = new GitError('not a git repository', 'status');
      const result = ErrorHandler.handleGitError(error, 'git status');
      
      expect(result).toContain('Git Error:');
      expect(result).toContain('Operation: git status');
      expect(result).toContain('not a git repository');
      expect(result).toContain('Recovery Suggestions:');
      expect(result).toContain('git init');
    });

    test('should provide merge conflict suggestions', () => {
      const error = new Error('merge conflict in file.txt');
      const result = ErrorHandler.handleGitError(error, 'merge');
      
      expect(result).toContain('Resolve merge conflicts');
      expect(result).toContain('git status');
    });

    test('should provide nothing to commit suggestions', () => {
      const error = new Error('nothing to commit, working tree clean');
      const result = ErrorHandler.handleGitError(error, 'commit');
      
      expect(result).toContain('git add');
      expect(result).toContain('git status');
    });
  });

  describe('handleNetworkError', () => {
    test('should format network error with retry information', () => {
      const error = new NetworkError('Connection timeout', 'https://api.github.com', null, true);
      const result = ErrorHandler.handleNetworkError(error, 1, 3);
      
      expect(result).toContain('Network Error:');
      expect(result).toContain('Connection timeout');
      expect(result).toContain('URL: https://api.github.com');
      expect(result).toContain('Retrying... (2/3)');
    });

    test('should show max retries reached', () => {
      const error = new NetworkError('Connection failed', null, 500);
      const result = ErrorHandler.handleNetworkError(error, 3, 3);
      
      expect(result).toContain('Maximum retry attempts reached');
      expect(result).toContain('GitHub API may be experiencing issues');
    });

    test('should provide status code specific suggestions', () => {
      const error = new NetworkError('Unauthorized', null, 401);
      const result = ErrorHandler.handleNetworkError(error, 3, 3);
      
      expect(result).toContain('Check your GitHub token');
      expect(result).toContain('Verify token has required permissions');
    });
  });

  describe('handleFileSystemError', () => {
    test('should format filesystem error with suggestions', () => {
      const error = new FileSystemError('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      
      const result = ErrorHandler.handleFileSystemError(error, '/path/to/file', 'read');
      
      expect(result).toContain('File System Error:');
      expect(result).toContain('Operation: read');
      expect(result).toContain('Path: /path/to/file');
      expect(result).toContain('Verify the file or directory exists');
    });

    test('should provide permission error suggestions', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      
      const result = ErrorHandler.handleFileSystemError(error, '/restricted/file', 'write');
      
      expect(result).toContain('Check file and directory permissions');
      expect(result).toContain('write access');
    });
  });

  describe('formatUserFriendlyError', () => {
    test('should route ValidationError to validation handler', () => {
      const error = new ValidationError('Invalid input');
      const result = ErrorHandler.formatUserFriendlyError(error);
      
      expect(result).toContain('Validation Error:');
    });

    test('should route GitError to git handler', () => {
      const error = new GitError('Git operation failed');
      const result = ErrorHandler.formatUserFriendlyError(error);
      
      expect(result).toContain('Git Error:');
    });

    test('should route NetworkError to network handler', () => {
      const error = new NetworkError('Network failed');
      const result = ErrorHandler.formatUserFriendlyError(error);
      
      expect(result).toContain('Network Error:');
    });

    test('should handle generic errors', () => {
      const error = new Error('Generic error message');
      const result = ErrorHandler.formatUserFriendlyError(error, { operation: 'test' });
      
      expect(result).toContain('Error:');
      expect(result).toContain('Generic error message');
      expect(result).toContain('Operation: test');
    });
  });

  describe('getGitErrorSuggestions', () => {
    test('should return suggestions for "not a git repository"', () => {
      const suggestions = ErrorHandler.getGitErrorSuggestions('not a git repository', 'status');
      
      expect(suggestions).toContain('Run "git init" to initialize a Git repository');
      expect(suggestions).toContain('Navigate to an existing Git repository directory');
    });

    test('should return suggestions for merge conflicts', () => {
      const suggestions = ErrorHandler.getGitErrorSuggestions('merge conflict in file.txt', 'merge');
      
      expect(suggestions).toContain('Resolve merge conflicts in the affected files');
      expect(suggestions).toContain('Use "git status" to see conflicted files');
    });

    test('should return default suggestions for unknown errors', () => {
      const suggestions = ErrorHandler.getGitErrorSuggestions('unknown git error', 'unknown');
      
      expect(suggestions).toContain('Check Git documentation for the specific error');
      expect(suggestions).toContain('Verify repository state with "git status"');
    });
  });

  describe('getNetworkErrorSuggestions', () => {
    test('should return suggestions for 401 Unauthorized', () => {
      const suggestions = ErrorHandler.getNetworkErrorSuggestions(401, 'Unauthorized');
      
      expect(suggestions).toContain('Check your GitHub token configuration');
      expect(suggestions).toContain('Verify token has required permissions');
    });

    test('should return suggestions for 404 Not Found', () => {
      const suggestions = ErrorHandler.getNetworkErrorSuggestions(404, 'Not Found');
      
      expect(suggestions).toContain('Verify the repository exists and is accessible');
      expect(suggestions).toContain('Check repository name and owner');
    });

    test('should return suggestions for timeout errors', () => {
      const suggestions = ErrorHandler.getNetworkErrorSuggestions(null, 'Connection timeout');
      
      expect(suggestions).toContain('Check your internet connection');
      expect(suggestions).toContain('Try again with a stable network connection');
    });
  });

  describe('getFileSystemErrorSuggestions', () => {
    test('should return suggestions for ENOENT', () => {
      const suggestions = ErrorHandler.getFileSystemErrorSuggestions('ENOENT', '/path/file', 'read');
      
      expect(suggestions).toContain('Verify the file or directory exists');
      expect(suggestions).toContain('Check the file path spelling');
    });

    test('should return suggestions for EACCES', () => {
      const suggestions = ErrorHandler.getFileSystemErrorSuggestions('EACCES', '/restricted/file', 'write');
      
      expect(suggestions).toContain('Check file and directory permissions');
      expect(suggestions).toContain('Ensure you have write access to the location');
    });

    test('should return suggestions for ENOSPC', () => {
      const suggestions = ErrorHandler.getFileSystemErrorSuggestions('ENOSPC', '/full/disk', 'write');
      
      expect(suggestions).toContain('Free up disk space');
      expect(suggestions).toContain('Check available storage');
    });
  });

  describe('createErrorReport', () => {
    test('should create detailed error report', () => {
      const error = new GitError('Test git error', 'commit');
      const context = {
        operation: 'commit',
        command: 'histofy commit',
        args: ['test message']
      };
      
      const report = ErrorHandler.createErrorReport(error, context);
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('error');
      expect(report).toHaveProperty('context');
      expect(report).toHaveProperty('suggestions');
      
      expect(report.error.name).toBe('GitError');
      expect(report.error.message).toBe('Test git error');
      expect(report.context.operation).toBe('commit');
      expect(report.context.command).toBe('histofy commit');
      expect(Array.isArray(report.suggestions)).toBe(true);
    });

    test('should include system information in context', () => {
      const error = new Error('Test error');
      const report = ErrorHandler.createErrorReport(error);
      
      expect(report.context).toHaveProperty('cwd');
      expect(report.context).toHaveProperty('nodeVersion');
      expect(report.context).toHaveProperty('platform');
    });
  });

  describe('getSuggestionsForError', () => {
    test('should return git suggestions for GitError', () => {
      const error = new GitError('not a git repository');
      const suggestions = ErrorHandler.getSuggestionsForError(error, { operation: 'status' });
      
      expect(suggestions).toContain('Run "git init" to initialize a Git repository');
    });

    test('should return network suggestions for NetworkError', () => {
      const error = new NetworkError('Unauthorized', null, 401);
      const suggestions = ErrorHandler.getSuggestionsForError(error, {});
      
      expect(suggestions).toContain('Check your GitHub token configuration');
    });

    test('should return filesystem suggestions for FileSystemError', () => {
      const error = new FileSystemError('File not found');
      error.code = 'ENOENT';
      const suggestions = ErrorHandler.getSuggestionsForError(error, { operation: 'read' });
      
      expect(suggestions).toContain('Verify the file or directory exists');
    });

    test('should return default suggestions for unknown errors', () => {
      const error = new Error('Unknown error');
      const suggestions = ErrorHandler.getSuggestionsForError(error, {});
      
      expect(suggestions).toContain('Check the error message for specific details');
      expect(suggestions).toContain('Consult documentation for troubleshooting');
    });
  });
});