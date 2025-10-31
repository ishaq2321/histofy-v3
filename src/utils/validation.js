/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Enhanced validation utilities for comprehensive input validation
 */

const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');

/**
 * Enhanced validation utilities with detailed error messages and context-aware help
 */
class ValidationUtils {
  
  /**
   * Validate date format with detailed error messages
   * @param {string} dateString - Date string to validate
   * @param {string} format - Expected date format (default: 'YYYY-MM-DD')
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateDate(dateString, format = 'YYYY-MM-DD') {
    if (!dateString || typeof dateString !== 'string') {
      return {
        isValid: false,
        error: 'Date is required',
        suggestion: `Please provide a date in ${format} format (e.g., ${moment().format(format)})`
      };
    }

    const trimmedDate = dateString.trim();
    if (trimmedDate === '') {
      return {
        isValid: false,
        error: 'Date cannot be empty',
        suggestion: `Please provide a date in ${format} format (e.g., ${moment().format(format)})`
      };
    }

    const parsedDate = moment(trimmedDate, format, true);
    if (!parsedDate.isValid()) {
      return {
        isValid: false,
        error: `Invalid date format: "${trimmedDate}"`,
        suggestion: `Please use ${format} format (e.g., ${moment().format(format)})`
      };
    }

    // Check if date is reasonable (not too far in past or future)
    const now = moment();
    const yearsDiff = Math.abs(parsedDate.diff(now, 'years'));
    if (yearsDiff > 50) {
      return {
        isValid: false,
        error: `Date "${trimmedDate}" is too far from current date`,
        suggestion: 'Please use a date within 50 years of today'
      };
    }

    return {
      isValid: true,
      value: parsedDate.format(format),
      parsedDate: parsedDate
    };
  }

  /**
   * Validate time format with detailed error messages
   * @param {string} timeString - Time string to validate
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateTime(timeString) {
    if (!timeString || typeof timeString !== 'string') {
      return {
        isValid: false,
        error: 'Time is required',
        suggestion: 'Please provide time in HH:MM format (e.g., 14:30, 09:00)'
      };
    }

    const trimmedTime = timeString.trim();
    if (trimmedTime === '') {
      return {
        isValid: false,
        error: 'Time cannot be empty',
        suggestion: 'Please provide time in HH:MM format (e.g., 14:30, 09:00)'
      };
    }

    const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const match = trimmedTime.match(timePattern);
    
    if (!match) {
      return {
        isValid: false,
        error: `Invalid time format: "${trimmedTime}"`,
        suggestion: 'Please use HH:MM format (e.g., 14:30, 09:00, 23:59)'
      };
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    // Format with leading zeros
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    return {
      isValid: true,
      value: formattedTime,
      hours: hours,
      minutes: minutes
    };
  }

  /**
   * Validate commit message with comprehensive checks
   * @param {string} message - Commit message to validate
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateCommitMessage(message) {
    if (!message || typeof message !== 'string') {
      return {
        isValid: false,
        error: 'Commit message is required',
        suggestion: 'Please provide a descriptive commit message'
      };
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage === '') {
      return {
        isValid: false,
        error: 'Commit message cannot be empty',
        suggestion: 'Please provide a descriptive commit message'
      };
    }

    if (trimmedMessage.length < 3) {
      return {
        isValid: false,
        error: 'Commit message is too short',
        suggestion: 'Please provide a commit message with at least 3 characters'
      };
    }

    if (trimmedMessage.length > 500) {
      return {
        isValid: false,
        error: 'Commit message is too long',
        suggestion: 'Please keep commit message under 500 characters'
      };
    }

    // Check for common issues
    const firstLine = trimmedMessage.split('\n')[0];
    if (firstLine.length > 72) {
      return {
        isValid: false,
        error: 'First line of commit message is too long',
        suggestion: 'Please keep the first line under 72 characters for better Git log readability'
      };
    }

    // Check for trailing periods in first line (conventional commit style)
    if (firstLine.endsWith('.')) {
      return {
        isValid: false,
        error: 'First line should not end with a period',
        suggestion: 'Remove the trailing period from the first line'
      };
    }

    return {
      isValid: true,
      value: trimmedMessage,
      firstLine: firstLine,
      hasBody: trimmedMessage.includes('\n')
    };
  }

  /**
   * Validate author format (Name <email@example.com>)
   * @param {string} author - Author string to validate
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateAuthor(author) {
    if (!author || typeof author !== 'string') {
      return {
        isValid: false,
        error: 'Author is required',
        suggestion: 'Please provide author in format: "Name <email@example.com>"'
      };
    }

    const trimmedAuthor = author.trim();
    if (trimmedAuthor === '') {
      return {
        isValid: false,
        error: 'Author cannot be empty',
        suggestion: 'Please provide author in format: "Name <email@example.com>"'
      };
    }

    const authorPattern = /^(.+?)\s+<([^\s@]+@[^\s@]+\.[^\s@]+)>$/;
    const match = trimmedAuthor.match(authorPattern);

    if (!match) {
      return {
        isValid: false,
        error: `Invalid author format: "${trimmedAuthor}"`,
        suggestion: 'Please use format: "Name <email@example.com>"'
      };
    }

    const name = match[1].trim();
    const email = match[2].trim();

    if (name.length < 2) {
      return {
        isValid: false,
        error: 'Author name is too short',
        suggestion: 'Please provide a name with at least 2 characters'
      };
    }

    const emailValidation = this.validateEmail(email);
    if (!emailValidation.isValid) {
      return {
        isValid: false,
        error: `Invalid email in author: ${emailValidation.error}`,
        suggestion: emailValidation.suggestion
      };
    }

    return {
      isValid: true,
      value: trimmedAuthor,
      name: name,
      email: email
    };
  }

  /**
   * Validate email address
   * @param {string} email - Email address to validate
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return {
        isValid: false,
        error: 'Email is required',
        suggestion: 'Please provide a valid email address (e.g., user@example.com)'
      };
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail === '') {
      return {
        isValid: false,
        error: 'Email cannot be empty',
        suggestion: 'Please provide a valid email address (e.g., user@example.com)'
      };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return {
        isValid: false,
        error: `Invalid email format: "${trimmedEmail}"`,
        suggestion: 'Please provide a valid email address (e.g., user@example.com)'
      };
    }

    // Additional checks
    if (trimmedEmail.length > 254) {
      return {
        isValid: false,
        error: 'Email address is too long',
        suggestion: 'Please use an email address under 254 characters'
      };
    }

    const parts = trimmedEmail.split('@');
    if (parts[0].length > 64) {
      return {
        isValid: false,
        error: 'Email local part is too long',
        suggestion: 'Please use an email with local part under 64 characters'
      };
    }

    return {
      isValid: true,
      value: trimmedEmail,
      localPart: parts[0],
      domain: parts[1]
    };
  }

  /**
   * Validate GitHub token format
   * @param {string} token - GitHub token to validate
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateGitHubToken(token) {
    if (!token || typeof token !== 'string') {
      return {
        isValid: false,
        error: 'GitHub token is required',
        suggestion: 'Please provide a valid GitHub Personal Access Token'
      };
    }

    const trimmedToken = token.trim();
    if (trimmedToken === '') {
      return {
        isValid: false,
        error: 'GitHub token cannot be empty',
        suggestion: 'Please provide a valid GitHub Personal Access Token'
      };
    }

    // GitHub personal access tokens have specific prefixes
    const tokenPattern = /^gh[pousr]_[A-Za-z0-9_]{36,}$/;
    if (!tokenPattern.test(trimmedToken)) {
      return {
        isValid: false,
        error: 'Invalid GitHub token format',
        suggestion: 'Please provide a valid GitHub Personal Access Token (starts with ghp_, gho_, ghu_, ghs_, or ghr_)'
      };
    }

    return {
      isValid: true,
      value: trimmedToken,
      type: trimmedToken.substring(0, 4)
    };
  }

  /**
   * Validate Git repository state
   * @param {string} repoPath - Path to repository
   * @returns {Object} Validation result with success flag and detailed message
   */
  static async validateGitRepository(repoPath = process.cwd()) {
    try {
      const git = simpleGit(repoPath);
      
      // Check if it's a git repository
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          isValid: false,
          error: 'Not a Git repository',
          suggestion: 'Please run this command from within a Git repository or run "git init" to initialize one'
        };
      }

      // Check repository status
      const status = await git.status();
      
      return {
        isValid: true,
        value: repoPath,
        status: status,
        isClean: status.isClean(),
        currentBranch: status.current
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Git repository validation failed: ${error.message}`,
        suggestion: 'Please ensure you are in a valid Git repository'
      };
    }
  }

  /**
   * Validate commit range format
   * @param {string} range - Commit range to validate (e.g., "HEAD~5..HEAD" or "abc123")
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateCommitRange(range) {
    if (!range || typeof range !== 'string') {
      return {
        isValid: false,
        error: 'Commit range is required',
        suggestion: 'Please provide a commit hash or range (e.g., "HEAD~5..HEAD" or "abc123")'
      };
    }

    const trimmedRange = range.trim();
    if (trimmedRange === '') {
      return {
        isValid: false,
        error: 'Commit range cannot be empty',
        suggestion: 'Please provide a commit hash or range (e.g., "HEAD~5..HEAD" or "abc123")'
      };
    }

    // Check for range format (contains ..)
    if (trimmedRange.includes('..')) {
      const parts = trimmedRange.split('..');
      if (parts.length !== 2) {
        return {
          isValid: false,
          error: `Invalid range format: "${trimmedRange}"`,
          suggestion: 'Please use format: "start..end" (e.g., "HEAD~5..HEAD")'
        };
      }

      const [start, end] = parts;
      if (!start.trim() || !end.trim()) {
        return {
          isValid: false,
          error: 'Range parts cannot be empty',
          suggestion: 'Please provide both start and end commits (e.g., "HEAD~5..HEAD")'
        };
      }

      return {
        isValid: true,
        value: trimmedRange,
        type: 'range',
        start: start.trim(),
        end: end.trim()
      };
    }

    // Single commit hash validation
    const hashPattern = /^[a-fA-F0-9]{4,40}$|^HEAD~?\d*$|^[a-zA-Z0-9_/-]+$/;
    if (!hashPattern.test(trimmedRange)) {
      return {
        isValid: false,
        error: `Invalid commit reference: "${trimmedRange}"`,
        suggestion: 'Please provide a valid commit hash, HEAD reference, or branch name'
      };
    }

    return {
      isValid: true,
      value: trimmedRange,
      type: 'single'
    };
  }

  /**
   * Validate file path for security (prevent path traversal)
   * @param {string} filePath - File path to validate
   * @param {string} basePath - Base path to restrict to (optional)
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateFilePath(filePath, basePath = null) {
    if (!filePath || typeof filePath !== 'string') {
      return {
        isValid: false,
        error: 'File path is required',
        suggestion: 'Please provide a valid file path'
      };
    }

    const trimmedPath = filePath.trim();
    if (trimmedPath === '') {
      return {
        isValid: false,
        error: 'File path cannot be empty',
        suggestion: 'Please provide a valid file path'
      };
    }

    // Check for path traversal attempts
    if (trimmedPath.includes('..') || trimmedPath.includes('~')) {
      return {
        isValid: false,
        error: 'Path traversal detected in file path',
        suggestion: 'Please use relative paths without ".." or "~"'
      };
    }

    // Check for absolute paths (security concern)
    if (path.isAbsolute(trimmedPath) && !basePath) {
      return {
        isValid: false,
        error: 'Absolute paths are not allowed',
        suggestion: 'Please use relative paths'
      };
    }

    // Resolve and normalize the path
    const resolvedPath = basePath 
      ? path.resolve(basePath, trimmedPath)
      : path.resolve(trimmedPath);

    // If basePath is provided, ensure resolved path is within it
    if (basePath && !resolvedPath.startsWith(path.resolve(basePath))) {
      return {
        isValid: false,
        error: 'Path is outside allowed directory',
        suggestion: `Please use paths within ${basePath}`
      };
    }

    return {
      isValid: true,
      value: trimmedPath,
      resolvedPath: resolvedPath,
      isAbsolute: path.isAbsolute(trimmedPath)
    };
  }

  /**
   * Validate numeric input with range checking
   * @param {string|number} value - Value to validate
   * @param {Object} options - Validation options (min, max, integer)
   * @returns {Object} Validation result with success flag and detailed message
   */
  static validateNumber(value, options = {}) {
    const { min, max, integer = false, fieldName = 'Value' } = options;

    if (value === null || value === undefined || value === '') {
      return {
        isValid: false,
        error: `${fieldName} is required`,
        suggestion: `Please provide a valid number${min !== undefined ? ` (minimum: ${min})` : ''}${max !== undefined ? ` (maximum: ${max})` : ''}`
      };
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return {
        isValid: false,
        error: `Invalid number: "${value}"`,
        suggestion: `Please provide a valid number${min !== undefined ? ` (minimum: ${min})` : ''}${max !== undefined ? ` (maximum: ${max})` : ''}`
      };
    }

    if (integer && !Number.isInteger(numValue)) {
      return {
        isValid: false,
        error: `${fieldName} must be an integer`,
        suggestion: 'Please provide a whole number without decimal places'
      };
    }

    if (min !== undefined && numValue < min) {
      return {
        isValid: false,
        error: `${fieldName} is below minimum value`,
        suggestion: `Please provide a value of ${min} or higher`
      };
    }

    if (max !== undefined && numValue > max) {
      return {
        isValid: false,
        error: `${fieldName} exceeds maximum value`,
        suggestion: `Please provide a value of ${max} or lower`
      };
    }

    return {
      isValid: true,
      value: numValue
    };
  }

  /**
   * Sanitize input to prevent command injection
   * @param {string} input - Input string to sanitize
   * @returns {string} Sanitized input string
   */
  static sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove or escape potentially dangerous characters
    return input
      .replace(/[;&|`$(){}[\]\\]/g, '') // Remove shell metacharacters
      .replace(/\x00/g, '') // Remove null bytes
      .trim();
  }

  /**
   * Validate and sanitize command arguments
   * @param {Array} args - Array of command arguments
   * @returns {Object} Validation result with sanitized arguments
   */
  static validateCommandArgs(args) {
    if (!Array.isArray(args)) {
      return {
        isValid: false,
        error: 'Arguments must be an array',
        suggestion: 'Please provide arguments as an array'
      };
    }

    const sanitizedArgs = args.map(arg => {
      if (typeof arg !== 'string') {
        return String(arg);
      }
      return this.sanitizeInput(arg);
    }).filter(arg => arg.length > 0);

    return {
      isValid: true,
      value: sanitizedArgs,
      originalCount: args.length,
      sanitizedCount: sanitizedArgs.length
    };
  }
}

module.exports = ValidationUtils;