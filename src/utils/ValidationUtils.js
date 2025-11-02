/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * ValidationUtils - Enhanced validation utilities with security focus
 */

const SecurityUtils = require('../security/SecurityUtils');
const path = require('path');

class ValidationUtils {
  /**
   * Validate commit hash format
   * @param {string} hash - Commit hash to validate
   * @param {boolean} allowShort - Allow short hashes (7+ chars)
   * @returns {boolean} True if hash is valid
   */
  static isValidCommitHash(hash, allowShort = true) {
    if (!hash || typeof hash !== 'string') {
      return false;
    }

    const trimmedHash = hash.trim();
    
    // Full SHA-1 hash (40 characters)
    if (/^[a-f0-9]{40}$/i.test(trimmedHash)) {
      return true;
    }

    // Short hash (7-39 characters) if allowed
    if (allowShort && /^[a-f0-9]{7,39}$/i.test(trimmedHash)) {
      return true;
    }

    return false;
  }

  /**
   * Validate date string in various formats
   * @param {string} dateStr - Date string to validate
   * @returns {object} Validation result with parsed date
   */
  static validateDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
      return { valid: false, error: 'Date is required and must be a string' };
    }

    const trimmedDate = dateStr.trim();
    
    if (trimmedDate === '') {
      return { valid: false, error: 'Date cannot be empty' };
    }

    try {
      // Try parsing the date
      const parsedDate = new Date(trimmedDate);
      
      if (isNaN(parsedDate.getTime())) {
        return { valid: false, error: 'Invalid date format' };
      }

      // Check if date is reasonable (not too far in past or future)
      const now = new Date();
      const minDate = new Date('1970-01-01');
      const maxDate = new Date(now.getFullYear() + 10, 11, 31);

      if (parsedDate < minDate) {
        return { valid: false, error: 'Date is too far in the past' };
      }

      if (parsedDate > maxDate) {
        return { valid: false, error: 'Date is too far in the future' };
      }

      return { 
        valid: true, 
        date: parsedDate,
        iso: parsedDate.toISOString()
      };
    } catch (error) {
      return { valid: false, error: `Date parsing failed: ${error.message}` };
    }
  }

  /**
   * Validate time string in HH:MM format
   * @param {string} timeStr - Time string to validate
   * @returns {object} Validation result
   */
  static validateTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
      return { valid: false, error: 'Time is required and must be a string' };
    }

    const trimmedTime = timeStr.trim();
    const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const match = timePattern.exec(trimmedTime);

    if (!match) {
      return { valid: false, error: 'Invalid time format (expected HH:MM)' };
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    return {
      valid: true,
      hours,
      minutes,
      formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    };
  }

  /**
   * Validate repository URL
   * @param {string} url - Repository URL to validate
   * @returns {object} Validation result with parsed components
   */
  static validateRepositoryUrl(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'Repository URL is required and must be a string' };
    }

    const trimmedUrl = url.trim();
    
    if (trimmedUrl === '') {
      return { valid: false, error: 'Repository URL cannot be empty' };
    }

    try {
      // GitHub HTTPS URL pattern
      const httpsPattern = /^https:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\.git)?$/;
      const httpsMatch = httpsPattern.exec(trimmedUrl);

      if (httpsMatch) {
        return {
          valid: true,
          type: 'https',
          owner: httpsMatch[1],
          repo: httpsMatch[2].replace(/\.git$/, ''),
          url: trimmedUrl
        };
      }

      // GitHub SSH URL pattern
      const sshPattern = /^git@github\.com:([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\.git)?$/;
      const sshMatch = sshPattern.exec(trimmedUrl);

      if (sshMatch) {
        return {
          valid: true,
          type: 'ssh',
          owner: sshMatch[1],
          repo: sshMatch[2].replace(/\.git$/, ''),
          url: trimmedUrl
        };
      }

      return { valid: false, error: 'Invalid repository URL format (only GitHub URLs supported)' };
    } catch (error) {
      return { valid: false, error: `URL validation failed: ${error.message}` };
    }
  }

  /**
   * Validate commit message
   * @param {string} message - Commit message to validate
   * @param {object} options - Validation options
   * @returns {object} Validation result
   */
  static validateCommitMessage(message, options = {}) {
    const {
      maxLength = 72,
      minLength = 10,
      requireSubject = true,
      allowEmpty = false
    } = options;

    if (!message && !allowEmpty) {
      return { valid: false, error: 'Commit message is required' };
    }

    if (!message || typeof message !== 'string') {
      if (allowEmpty) {
        return { valid: true, message: '' };
      }
      return { valid: false, error: 'Commit message must be a string' };
    }

    const trimmedMessage = message.trim();
    
    if (trimmedMessage === '' && !allowEmpty) {
      return { valid: false, error: 'Commit message cannot be empty' };
    }

    if (trimmedMessage.length < minLength) {
      return { valid: false, error: `Commit message too short (minimum ${minLength} characters)` };
    }

    if (trimmedMessage.length > maxLength) {
      return { valid: false, error: `Commit message too long (maximum ${maxLength} characters)` };
    }

    // Check for potentially dangerous content
    const dangerousPatterns = [
      /[<>]/,  // HTML tags
      /javascript:/i,  // JavaScript protocol
      /data:/i,  // Data protocol
      /\x00/,  // Null bytes
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmedMessage)) {
        return { valid: false, error: 'Commit message contains potentially dangerous content' };
      }
    }

    const lines = trimmedMessage.split('\n');
    const subject = lines[0];

    if (requireSubject && subject.length === 0) {
      return { valid: false, error: 'Commit message must have a subject line' };
    }

    return {
      valid: true,
      message: trimmedMessage,
      subject,
      body: lines.slice(2).join('\n').trim(),
      lineCount: lines.length
    };
  }

  /**
   * Validate file path for Git operations
   * @param {string} filePath - File path to validate
   * @param {string} repoRoot - Repository root path
   * @returns {object} Validation result
   */
  static validateGitFilePath(filePath, repoRoot = null) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'File path is required and must be a string' };
    }

    try {
      // Use SecurityUtils for basic path validation
      const sanitizedPath = SecurityUtils.validateFilePath(filePath, repoRoot);
      
      // Additional Git-specific validations
      const trimmedPath = filePath.trim();
      
      // Check for Git-specific invalid patterns
      if (trimmedPath.startsWith('.git/') && trimmedPath !== '.gitignore' && trimmedPath !== '.gitattributes') {
        return { valid: false, error: 'Cannot modify Git internal files' };
      }

      // Check for binary file extensions that might be problematic
      const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin'];
      const ext = path.extname(trimmedPath).toLowerCase();
      
      if (binaryExtensions.includes(ext)) {
        return { 
          valid: true, 
          path: sanitizedPath,
          warning: 'Binary file detected - ensure this is intentional'
        };
      }

      return {
        valid: true,
        path: sanitizedPath,
        relative: path.relative(repoRoot || process.cwd(), sanitizedPath)
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Validate command line arguments
   * @param {Array} args - Arguments to validate
   * @param {object} schema - Validation schema
   * @returns {object} Validation result
   */
  static validateCommandArgs(args, schema = {}) {
    if (!Array.isArray(args)) {
      return { valid: false, error: 'Arguments must be an array' };
    }

    try {
      // Use SecurityUtils for basic sanitization
      const sanitizedArgs = SecurityUtils.sanitizeCommandArgs(args);
      
      const validatedArgs = [];
      const errors = [];

      for (let i = 0; i < sanitizedArgs.length; i++) {
        const arg = sanitizedArgs[i];
        const argSchema = schema[i] || schema.default || {};

        // Type validation
        if (argSchema.type) {
          if (argSchema.type === 'number' && isNaN(Number(arg))) {
            errors.push(`Argument ${i + 1} must be a number`);
            continue;
          }
          
          if (argSchema.type === 'boolean' && !['true', 'false', '1', '0'].includes(arg.toLowerCase())) {
            errors.push(`Argument ${i + 1} must be a boolean`);
            continue;
          }
        }

        // Length validation
        if (argSchema.maxLength && arg.length > argSchema.maxLength) {
          errors.push(`Argument ${i + 1} exceeds maximum length of ${argSchema.maxLength}`);
          continue;
        }

        // Pattern validation
        if (argSchema.pattern && !argSchema.pattern.test(arg)) {
          errors.push(`Argument ${i + 1} does not match required pattern`);
          continue;
        }

        validatedArgs.push(arg);
      }

      return {
        valid: errors.length === 0,
        args: validatedArgs,
        errors
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Validate configuration object structure
   * @param {object} config - Configuration to validate
   * @param {object} schema - Expected schema
   * @returns {object} Validation result
   */
  static validateConfigStructure(config, schema) {
    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Configuration must be an object' };
    }

    if (!schema || typeof schema !== 'object') {
      return { valid: false, error: 'Schema must be an object' };
    }

    const errors = [];
    const warnings = [];

    // Check required fields
    const checkRequired = (obj, schemaObj, path = '') => {
      for (const key in schemaObj) {
        const fullPath = path ? `${path}.${key}` : key;
        const fieldSchema = schemaObj[key];

        if (fieldSchema.required && (obj[key] === undefined || obj[key] === null)) {
          errors.push(`Required field missing: ${fullPath}`);
          continue;
        }

        if (obj[key] !== undefined) {
          // Type validation
          if (fieldSchema.type && typeof obj[key] !== fieldSchema.type) {
            errors.push(`Invalid type for ${fullPath}: expected ${fieldSchema.type}, got ${typeof obj[key]}`);
            continue;
          }

          // Nested object validation
          if (fieldSchema.properties && typeof obj[key] === 'object') {
            checkRequired(obj[key], fieldSchema.properties, fullPath);
          }

          // Custom validation
          if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
            const result = fieldSchema.validate(obj[key]);
            if (!result.valid) {
              errors.push(`Validation failed for ${fullPath}: ${result.error}`);
            }
          }
        }
      }
    };

    checkRequired(config, schema);

    // Check for unexpected fields
    const checkUnexpected = (obj, schemaObj, path = '') => {
      for (const key in obj) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (!schemaObj[key]) {
          warnings.push(`Unexpected field: ${fullPath}`);
        } else if (schemaObj[key].properties && typeof obj[key] === 'object') {
          checkUnexpected(obj[key], schemaObj[key].properties, fullPath);
        }
      }
    };

    checkUnexpected(config, schema);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = ValidationUtils;