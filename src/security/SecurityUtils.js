/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * SecurityUtils - Centralized security validation and sanitization
 */

const path = require('path');
const crypto = require('crypto');

class SecurityUtils {
  /**
   * List of allowed editors for security
   */
  static ALLOWED_EDITORS = [
    'nano', 'vim', 'vi', 'emacs', 'code', 'notepad', 'notepad++', 'gedit', 'kate', 'atom', 'sublime_text'
  ];

  /**
   * Sanitize and validate editor command to prevent command injection
   * @param {string} editorCommand - Editor command from environment or user input
   * @returns {string} Sanitized editor command
   * @throws {Error} If editor is not allowed or command is invalid
   */
  static sanitizeEditorCommand(editorCommand) {
    if (!editorCommand || typeof editorCommand !== 'string') {
      throw new Error('Editor command is required and must be a string');
    }

    // Remove any shell metacharacters and extra spaces
    const cleanCommand = editorCommand.trim().replace(/[;&|`$(){}[\]\\<>]/g, '');
    
    if (cleanCommand !== editorCommand.trim()) {
      throw new Error('Editor command contains potentially dangerous characters');
    }

    // Extract the base command (first word)
    const baseCommand = cleanCommand.split(/\s+/)[0];
    const commandName = path.basename(baseCommand).toLowerCase();

    // Check against whitelist of allowed editors
    const isAllowed = this.ALLOWED_EDITORS.some(allowedEditor => 
      commandName === allowedEditor || commandName === `${allowedEditor}.exe`
    );

    if (!isAllowed) {
      throw new Error(`Editor '${commandName}' is not in the allowed list. Allowed editors: ${this.ALLOWED_EDITORS.join(', ')}`);
    }

    // Return the sanitized command
    return cleanCommand;
  }

  /**
   * Validate and sanitize file path to prevent path traversal attacks
   * @param {string} filePath - File path to validate
   * @param {string} basePath - Base path to restrict to (optional)
   * @returns {string} Sanitized and resolved file path
   * @throws {Error} If path is invalid or contains traversal attempts
   */
  static validateFilePath(filePath, basePath = null) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required and must be a string');
    }

    const trimmedPath = filePath.trim();
    
    if (trimmedPath === '') {
      throw new Error('File path cannot be empty');
    }

    // Check for obvious path traversal attempts
    if (trimmedPath.includes('..') || trimmedPath.includes('~')) {
      throw new Error('Path traversal detected: path contains ".." or "~"');
    }

    // Check for null bytes and other dangerous characters
    if (trimmedPath.includes('\0') || /[<>:"|?*]/.test(trimmedPath)) {
      throw new Error('Path contains invalid characters');
    }

    // Resolve the path to get absolute path
    const resolvedPath = basePath 
      ? path.resolve(basePath, trimmedPath)
      : path.resolve(trimmedPath);

    // If basePath is provided, ensure resolved path is within it
    if (basePath) {
      const normalizedBasePath = path.resolve(basePath);
      if (!resolvedPath.startsWith(normalizedBasePath + path.sep) && resolvedPath !== normalizedBasePath) {
        throw new Error('Path is outside the allowed directory');
      }
    }

    return resolvedPath;
  }

  /**
   * Sanitize Git reference to prevent command injection
   * @param {string} gitRef - Git reference (branch, tag, commit hash)
   * @returns {string} Sanitized Git reference
   * @throws {Error} If reference is invalid or potentially dangerous
   */
  static sanitizeGitReference(gitRef) {
    if (!gitRef || typeof gitRef !== 'string') {
      throw new Error('Git reference is required and must be a string');
    }

    const trimmedRef = gitRef.trim();
    
    if (trimmedRef === '') {
      throw new Error('Git reference cannot be empty');
    }

    // Git reference pattern - allows alphanumeric, dots, hyphens, slashes, tildes, carets, braces
    const gitRefPattern = /^[a-zA-Z0-9._\-\/~^{}]+$/;
    
    if (!gitRefPattern.test(trimmedRef)) {
      throw new Error('Git reference contains invalid characters');
    }

    // Check for command injection patterns
    const dangerousPatterns = [';', '|', '&', '$', '`', '(', ')', '<', '>', '"', "'"];
    for (const pattern of dangerousPatterns) {
      if (trimmedRef.includes(pattern)) {
        throw new Error(`Git reference contains potentially dangerous character: ${pattern}`);
      }
    }

    // Additional Git-specific validations
    if (trimmedRef.startsWith('-')) {
      throw new Error('Git reference cannot start with a hyphen');
    }

    if (trimmedRef.includes('..')) {
      // Allow range syntax like HEAD~5..HEAD but validate both parts
      const parts = trimmedRef.split('..');
      if (parts.length === 2) {
        parts.forEach(part => {
          if (part && !gitRefPattern.test(part)) {
            throw new Error('Invalid Git reference in range');
          }
        });
      } else {
        throw new Error('Invalid Git reference range format');
      }
    }

    return trimmedRef;
  }

  /**
   * Sanitize command arguments to prevent injection
   * @param {Array} args - Array of command arguments
   * @returns {Array} Sanitized arguments
   */
  static sanitizeCommandArgs(args) {
    if (!Array.isArray(args)) {
      throw new Error('Arguments must be an array');
    }

    return args.map(arg => {
      if (typeof arg !== 'string') {
        return String(arg);
      }

      // Remove dangerous characters
      const sanitized = arg.replace(/[;&|`$(){}[\]\\<>]/g, '');
      
      if (sanitized !== arg) {
        throw new Error(`Argument contains dangerous characters: ${arg}`);
      }

      return sanitized;
    });
  }

  /**
   * Generate secure random string for operation IDs
   * @param {number} length - Length of random string
   * @returns {string} Secure random string
   */
  static generateSecureId(length = 16) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate email format with security considerations
   * @param {string} email - Email address to validate
   * @returns {boolean} True if email is valid and safe
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic email pattern that prevents injection
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailPattern.test(email)) {
      return false;
    }

    // Additional security checks
    if (email.length > 254) {
      return false; // RFC 5321 limit
    }

    const [localPart, domain] = email.split('@');
    
    if (localPart.length > 64) {
      return false; // RFC 5321 limit
    }

    // Check for dangerous characters that could be used in injection
    const dangerousChars = ['<', '>', '"', "'", '\\', '\n', '\r', '\t'];
    for (const char of dangerousChars) {
      if (email.includes(char)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize user input for safe display
   * @param {string} input - User input to sanitize
   * @returns {string} Sanitized input safe for display
   */
  static sanitizeForDisplay(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>&"']/g, (match) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#x27;'
        };
        return entities[match];
      })
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
  }

  /**
   * Validate GitHub token format
   * @param {string} token - GitHub token to validate
   * @returns {boolean} True if token format is valid
   */
  static isValidGitHubToken(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // GitHub personal access tokens have specific prefixes and format
    const tokenPattern = /^gh[pousr]_[A-Za-z0-9_]{36,}$/;
    return tokenPattern.test(token);
  }
}

module.exports = SecurityUtils;