/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const moment = require('moment');
const chalk = require('chalk');

/**
 * Date and time utilities
 */
class DateUtils {
  /**
   * Validate date string
   */
  static isValidDate(dateString, format = 'YYYY-MM-DD') {
    return moment(dateString, format, true).isValid();
  }

  /**
   * Validate time string
   */
  static isValidTime(timeString) {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString);
  }

  /**
   * Format date for display
   */
  static formatDate(date, format = 'YYYY-MM-DD') {
    return moment(date).format(format);
  }

  /**
   * Get date range string
   */
  static getDateRange(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    
    if (start.isSame(end, 'day')) {
      return start.format('YYYY-MM-DD');
    }
    
    return `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`;
  }

  /**
   * Generate date sequence
   */
  static generateDateSequence(startDate, endDate, step = 1) {
    const dates = [];
    const start = moment(startDate);
    const end = moment(endDate);
    
    for (let date = start.clone(); date.isSameOrBefore(end); date.add(step, 'days')) {
      dates.push(date.format('YYYY-MM-DD'));
    }
    
    return dates;
  }

  /**
   * Get relative time description
   */
  static getRelativeTime(date) {
    return moment(date).fromNow();
  }

  /**
   * Check if date is in the past
   */
  static isPast(date) {
    return moment(date).isBefore(moment(), 'day');
  }

  /**
   * Check if date is in the future
   */
  static isFuture(date) {
    return moment(date).isAfter(moment(), 'day');
  }
}

/**
 * String utilities
 */
class StringUtils {
  /**
   * Truncate string with ellipsis
   */
  static truncate(str, length = 50) {
    if (str.length <= length) return str;
    return str.substring(0, length).trim() + '...';
  }

  /**
   * Capitalize first letter
   */
  static capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Create URL-friendly slug
   */
  static slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Convert to kebab case
   */
  static toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  /**
   * Mask sensitive data
   */
  static maskSensitive(str, visibleChars = 4) {
    if (!str || str.length <= visibleChars * 2) return str;
    
    const start = str.substring(0, visibleChars);
    const end = str.substring(str.length - visibleChars);
    const middle = '*'.repeat(Math.max(0, str.length - visibleChars * 2));
    
    return start + middle + end;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Extract repository info from URL
   */
  static parseRepoUrl(url) {
    const patterns = [
      /github\.com[:/](.+?)\/(.+?)(?:\.git)?$/,
      /^(.+?)\/(.+?)$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace('.git', ''),
          fullName: `${match[1]}/${match[2].replace('.git', '')}`
        };
      }
    }
    
    return null;
  }
}

/**
 * Validation utilities
 */
class ValidationUtils {
  /**
   * Validate email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate GitHub username
   */
  static isValidGitHubUsername(username) {
    const usernamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    return usernamePattern.test(username) && username.length <= 39;
  }

  /**
   * Validate GitHub token format
   */
  static isValidGitHubToken(token) {
    // GitHub personal access tokens start with ghp_, gho_, ghu_, ghs_, or ghr_
    const tokenPattern = /^gh[pousr]_[A-Za-z0-9_]{36,}$/;
    return tokenPattern.test(token);
  }

  /**
   * Validate repository name format
   */
  static isValidRepoName(repoName) {
    const repoPattern = /^[a-zA-Z0-9._-]+$/;
    return repoPattern.test(repoName) && repoName.length <= 100;
  }

  /**
   * Validate commit message
   */
  static isValidCommitMessage(message) {
    return message && message.trim().length > 0 && message.length <= 500;
  }

  /**
   * Validate author format
   */
  static isValidAuthor(author) {
    // Format: "Name <email@example.com>"
    const authorPattern = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;
    return authorPattern.test(author);
  }
}

/**
 * File utilities
 */
class FileUtils {
  /**
   * Check if file has YAML extension
   */
  static isYamlFile(filename) {
    return /\.(yaml|yml)$/i.test(filename);
  }

  /**
   * Check if file has JSON extension
   */
  static isJsonFile(filename) {
    return /\.json$/i.test(filename);
  }

  /**
   * Get file extension
   */
  static getExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  /**
   * Get filename without extension
   */
  static getBasename(filename) {
    return filename.replace(/\.[^/.]+$/, '');
  }
}

/**
 * Console output utilities
 */
class OutputUtils {
  /**
   * Create a separator line
   */
  static separator(char = '─', length = 50) {
    return char.repeat(length);
  }

  /**
   * Create a box around text
   */
  static box(text, options = {}) {
    const padding = options.padding || 1;
    const char = options.char || '─';
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map(line => line.length));
    const width = maxLength + (padding * 2);
    
    const top = '┌' + char.repeat(width) + '┐';
    const bottom = '└' + char.repeat(width) + '┘';
    const content = lines.map(line => 
      '│' + ' '.repeat(padding) + line.padEnd(maxLength) + ' '.repeat(padding) + '│'
    );
    
    return [top, ...content, bottom].join('\n');
  }

  /**
   * Format success message
   */
  static success(message) {
    return chalk.green('✅ ' + message);
  }

  /**
   * Format error message
   */
  static error(message) {
    return chalk.red('❌ ' + message);
  }

  /**
   * Format warning message
   */
  static warning(message) {
    return chalk.yellow('⚠️  ' + message);
  }

  /**
   * Format info message
   */
  static info(message) {
    return chalk.blue('ℹ️  ' + message);
  }

  /**
   * Format step message
   */
  static step(step, total, message) {
    return chalk.cyan(`[${step}/${total}] `) + message;
  }
}

/**
 * Array utilities
 */
class ArrayUtils {
  /**
   * Chunk array into smaller arrays
   */
  static chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Remove duplicates from array
   */
  static unique(array) {
    return [...new Set(array)];
  }

  /**
   * Sort array by date
   */
  static sortByDate(array, dateKey = 'date') {
    return array.sort((a, b) => moment(a[dateKey]).diff(moment(b[dateKey])));
  }

  /**
   * Group array by key
   */
  static groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }
}

// Import new enhanced utilities
const EnhancedValidationUtils = require('./validation');
const { ErrorHandler, HistofyError, ValidationError, GitError, NetworkError, FileSystemError, ConfigurationError } = require('./errors');
const { ProgressIndicator, MultiStepProgress, ProgressUtils } = require('./progress');

module.exports = {
  // Existing utilities
  DateUtils,
  StringUtils,
  ValidationUtils,
  FileUtils,
  OutputUtils,
  ArrayUtils,
  
  // New enhanced utilities
  EnhancedValidationUtils,
  ErrorHandler,
  HistofyError,
  ValidationError,
  GitError,
  NetworkError,
  FileSystemError,
  ConfigurationError,
  ProgressIndicator,
  MultiStepProgress,
  ProgressUtils
};
