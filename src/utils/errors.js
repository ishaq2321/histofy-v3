/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Enhanced error handling utilities with context-aware help and recovery suggestions
 */

const chalk = require('chalk');

/**
 * Custom error classes for different types of errors
 */
class HistofyError extends Error {
  constructor(message, code = 'HISTOFY_ERROR', context = {}) {
    super(message);
    this.name = 'HistofyError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends HistofyError {
  constructor(message, field = null, suggestion = null) {
    super(message, 'VALIDATION_ERROR', { field, suggestion });
    this.name = 'ValidationError';
    this.field = field;
    this.suggestion = suggestion;
  }
}

class GitError extends HistofyError {
  constructor(message, operation = null, gitError = null) {
    super(message, 'GIT_ERROR', { operation, gitError });
    this.name = 'GitError';
    this.operation = operation;
    this.gitError = gitError;
  }
}

class NetworkError extends HistofyError {
  constructor(message, url = null, statusCode = null, retryable = true) {
    super(message, 'NETWORK_ERROR', { url, statusCode, retryable });
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

class FileSystemError extends HistofyError {
  constructor(message, path = null, operation = null) {
    super(message, 'FILESYSTEM_ERROR', { path, operation });
    this.name = 'FileSystemError';
    this.path = path;
    this.operation = operation;
  }
}

class ConfigurationError extends HistofyError {
  constructor(message, configKey = null, suggestion = null) {
    super(message, 'CONFIGURATION_ERROR', { configKey, suggestion });
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    this.suggestion = suggestion;
  }
}

/**
 * Error handler utility class
 */
class ErrorHandler {
  
  /**
   * Handle validation errors with detailed formatting
   * @param {ValidationError|Object} error - Validation error or validation result
   * @param {string} context - Context where validation failed
   * @returns {string} Formatted error message
   */
  static handleValidationError(error, context = '') {
    let message, suggestion, field;

    if (error instanceof ValidationError) {
      message = error.message;
      suggestion = error.suggestion;
      field = error.field;
    } else if (error && typeof error === 'object') {
      message = error.error || 'Validation failed';
      suggestion = error.suggestion;
      field = error.field;
    } else {
      message = String(error);
    }

    const output = [];
    
    // Main error message
    output.push(chalk.red('Validation Error:'));
    if (context) {
      output.push(chalk.red(`  Context: ${context}`));
    }
    if (field) {
      output.push(chalk.red(`  Field: ${field}`));
    }
    output.push(chalk.red(`  ${message}`));
    
    // Suggestion
    if (suggestion) {
      output.push('');
      output.push(chalk.yellow('Suggestion:'));
      output.push(chalk.yellow(`  ${suggestion}`));
    }

    return output.join('\n');
  }

  /**
   * Handle Git operation errors with recovery suggestions
   * @param {GitError|Error} error - Git error
   * @param {string} operation - Git operation that failed
   * @returns {string} Formatted error message with recovery suggestions
   */
  static handleGitError(error, operation = 'Git operation') {
    const message = error.message || 'Unknown Git error';
    const output = [];

    output.push(chalk.red('Git Error:'));
    output.push(chalk.red(`  Operation: ${operation}`));
    output.push(chalk.red(`  ${message}`));

    // Provide specific recovery suggestions based on error patterns
    const suggestions = this.getGitErrorSuggestions(message, operation);
    if (suggestions.length > 0) {
      output.push('');
      output.push(chalk.yellow('Recovery Suggestions:'));
      suggestions.forEach((suggestion, index) => {
        output.push(chalk.yellow(`  ${index + 1}. ${suggestion}`));
      });
    }

    return output.join('\n');
  }

  /**
   * Handle network errors with retry information
   * @param {NetworkError|Error} error - Network error
   * @param {number} retryCount - Current retry count
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {string} Formatted error message
   */
  static handleNetworkError(error, retryCount = 0, maxRetries = 3) {
    const message = error.message || 'Network error occurred';
    const statusCode = error.statusCode;
    const url = error.url;
    const retryable = error.retryable !== false;

    const output = [];
    
    output.push(chalk.red('Network Error:'));
    if (url) {
      output.push(chalk.red(`  URL: ${url}`));
    }
    if (statusCode) {
      output.push(chalk.red(`  Status Code: ${statusCode}`));
    }
    output.push(chalk.red(`  ${message}`));

    if (retryable && retryCount < maxRetries) {
      output.push('');
      output.push(chalk.yellow(`Retrying... (${retryCount + 1}/${maxRetries})`));
    } else if (retryCount >= maxRetries) {
      output.push('');
      output.push(chalk.red('Maximum retry attempts reached'));
      
      const suggestions = this.getNetworkErrorSuggestions(statusCode, message);
      if (suggestions.length > 0) {
        output.push('');
        output.push(chalk.yellow('Suggestions:'));
        suggestions.forEach((suggestion, index) => {
          output.push(chalk.yellow(`  ${index + 1}. ${suggestion}`));
        });
      }
    }

    return output.join('\n');
  }

  /**
   * Handle file system errors
   * @param {FileSystemError|Error} error - File system error
   * @param {string} path - File path that caused the error
   * @param {string} operation - File operation that failed
   * @returns {string} Formatted error message
   */
  static handleFileSystemError(error, path = '', operation = 'File operation') {
    const message = error.message || 'File system error occurred';
    const output = [];

    output.push(chalk.red('File System Error:'));
    output.push(chalk.red(`  Operation: ${operation}`));
    if (path) {
      output.push(chalk.red(`  Path: ${path}`));
    }
    output.push(chalk.red(`  ${message}`));

    const suggestions = this.getFileSystemErrorSuggestions(error.code || error.errno, path, operation);
    if (suggestions.length > 0) {
      output.push('');
      output.push(chalk.yellow('Suggestions:'));
      suggestions.forEach((suggestion, index) => {
        output.push(chalk.yellow(`  ${index + 1}. ${suggestion}`));
      });
    }

    return output.join('\n');
  }

  /**
   * Format user-friendly error message
   * @param {Error} error - Error to format
   * @param {Object} context - Additional context information
   * @returns {string} Formatted error message
   */
  static formatUserFriendlyError(error, context = {}) {
    if (error instanceof ValidationError) {
      return this.handleValidationError(error, context.operation);
    }
    
    if (error instanceof GitError) {
      return this.handleGitError(error, context.operation);
    }
    
    if (error instanceof NetworkError) {
      return this.handleNetworkError(error, context.retryCount, context.maxRetries);
    }
    
    if (error instanceof FileSystemError) {
      return this.handleFileSystemError(error, context.path, context.operation);
    }

    if (error instanceof ConfigurationError) {
      return this.handleConfigurationError(error);
    }

    // Generic error handling
    const output = [];
    output.push(chalk.red('Error:'));
    output.push(chalk.red(`  ${error.message || 'An unexpected error occurred'}`));
    
    if (context.operation) {
      output.push(chalk.red(`  Operation: ${context.operation}`));
    }

    return output.join('\n');
  }

  /**
   * Handle configuration errors
   * @param {ConfigurationError} error - Configuration error
   * @returns {string} Formatted error message
   */
  static handleConfigurationError(error) {
    const output = [];
    
    output.push(chalk.red('Configuration Error:'));
    if (error.configKey) {
      output.push(chalk.red(`  Configuration Key: ${error.configKey}`));
    }
    output.push(chalk.red(`  ${error.message}`));

    if (error.suggestion) {
      output.push('');
      output.push(chalk.yellow('Suggestion:'));
      output.push(chalk.yellow(`  ${error.suggestion}`));
    }

    return output.join('\n');
  }

  /**
   * Get recovery suggestions for Git errors
   * @param {string} errorMessage - Git error message
   * @param {string} operation - Git operation
   * @returns {Array} Array of suggestion strings
   */
  static getGitErrorSuggestions(errorMessage, operation) {
    const suggestions = [];
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('not a git repository')) {
      suggestions.push('Run "git init" to initialize a Git repository');
      suggestions.push('Navigate to an existing Git repository directory');
    }

    if (lowerMessage.includes('nothing to commit')) {
      suggestions.push('Add files to staging area with "git add ."');
      suggestions.push('Check repository status with "git status"');
    }

    if (lowerMessage.includes('merge conflict')) {
      suggestions.push('Resolve merge conflicts in the affected files');
      suggestions.push('Use "git status" to see conflicted files');
      suggestions.push('After resolving conflicts, use "git add" and "git commit"');
    }

    if (lowerMessage.includes('permission denied') || lowerMessage.includes('access denied')) {
      suggestions.push('Check file and directory permissions');
      suggestions.push('Ensure you have write access to the repository');
    }

    if (lowerMessage.includes('remote') && lowerMessage.includes('rejected')) {
      suggestions.push('Pull latest changes with "git pull" before pushing');
      suggestions.push('Use "git push --force-with-lease" if you need to force push safely');
    }

    if (lowerMessage.includes('detached head')) {
      suggestions.push('Create a new branch with "git checkout -b new-branch-name"');
      suggestions.push('Switch to an existing branch with "git checkout branch-name"');
    }

    if (suggestions.length === 0) {
      suggestions.push('Check Git documentation for the specific error');
      suggestions.push('Verify repository state with "git status"');
      suggestions.push('Consider creating a backup before attempting fixes');
    }

    return suggestions;
  }

  /**
   * Get suggestions for network errors
   * @param {number} statusCode - HTTP status code
   * @param {string} errorMessage - Error message
   * @returns {Array} Array of suggestion strings
   */
  static getNetworkErrorSuggestions(statusCode, errorMessage) {
    const suggestions = [];

    switch (statusCode) {
      case 401:
        suggestions.push('Check your GitHub token configuration');
        suggestions.push('Verify token has required permissions');
        suggestions.push('Generate a new token if the current one is expired');
        break;
      
      case 403:
        suggestions.push('Check API rate limits');
        suggestions.push('Verify repository access permissions');
        suggestions.push('Wait before retrying if rate limited');
        break;
      
      case 404:
        suggestions.push('Verify the repository exists and is accessible');
        suggestions.push('Check repository name and owner');
        suggestions.push('Ensure you have access to private repositories');
        break;
      
      case 422:
        suggestions.push('Check request parameters and format');
        suggestions.push('Verify all required fields are provided');
        break;
      
      case 500:
      case 502:
      case 503:
        suggestions.push('GitHub API may be experiencing issues');
        suggestions.push('Try again in a few minutes');
        suggestions.push('Check GitHub status page');
        break;
      
      default:
        if (errorMessage.toLowerCase().includes('timeout')) {
          suggestions.push('Check your internet connection');
          suggestions.push('Try again with a stable network connection');
        } else if (errorMessage.toLowerCase().includes('dns')) {
          suggestions.push('Check DNS settings');
          suggestions.push('Try using a different DNS server');
        } else {
          suggestions.push('Check your internet connection');
          suggestions.push('Verify GitHub API accessibility');
        }
    }

    return suggestions;
  }

  /**
   * Get suggestions for file system errors
   * @param {string} errorCode - Error code (ENOENT, EACCES, etc.)
   * @param {string} path - File path
   * @param {string} operation - File operation
   * @returns {Array} Array of suggestion strings
   */
  static getFileSystemErrorSuggestions(errorCode, path, operation) {
    const suggestions = [];

    switch (errorCode) {
      case 'ENOENT':
        suggestions.push('Verify the file or directory exists');
        suggestions.push('Check the file path spelling');
        suggestions.push('Create the directory if it doesn\'t exist');
        break;
      
      case 'EACCES':
      case 'EPERM':
        suggestions.push('Check file and directory permissions');
        suggestions.push('Ensure you have write access to the location');
        suggestions.push('Try running with appropriate permissions');
        break;
      
      case 'ENOSPC':
        suggestions.push('Free up disk space');
        suggestions.push('Check available storage');
        break;
      
      case 'EMFILE':
      case 'ENFILE':
        suggestions.push('Too many open files - close unused applications');
        suggestions.push('Increase system file descriptor limits');
        break;
      
      default:
        suggestions.push('Check file path and permissions');
        suggestions.push('Verify disk space availability');
        suggestions.push('Ensure the target directory exists');
    }

    return suggestions;
  }

  /**
   * Create a detailed error report
   * @param {Error} error - Error to report
   * @param {Object} context - Additional context
   * @returns {Object} Detailed error report
   */
  static createErrorReport(error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context: {
        operation: context.operation,
        command: context.command,
        args: context.args,
        cwd: process.cwd(),
        nodeVersion: process.version,
        platform: process.platform
      },
      suggestions: this.getSuggestionsForError(error, context)
    };
  }

  /**
   * Get suggestions for any error type
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Array} Array of suggestions
   */
  static getSuggestionsForError(error, context) {
    if (error instanceof GitError) {
      return this.getGitErrorSuggestions(error.message, context.operation);
    }
    
    if (error instanceof NetworkError) {
      return this.getNetworkErrorSuggestions(error.statusCode, error.message);
    }
    
    if (error instanceof FileSystemError) {
      return this.getFileSystemErrorSuggestions(error.code, error.path, context.operation);
    }

    return ['Check the error message for specific details', 'Consult documentation for troubleshooting'];
  }
}

module.exports = {
  HistofyError,
  ValidationError,
  GitError,
  NetworkError,
  FileSystemError,
  ConfigurationError,
  ErrorHandler
};