/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * ConfigValidator - Comprehensive configuration validation with schema support
 */

const SecurityUtils = require('../security/SecurityUtils');
const ValidationUtils = require('../utils/ValidationUtils');
const { ValidationError, ConfigurationError } = require('../utils/errors');

/**
 * Configuration validation schema definitions
 */
const CONFIG_SCHEMA = {
  github: {
    type: 'object',
    required: false,
    properties: {
      token: {
        type: 'string',
        required: false,
        sensitive: true,
        validate: (value) => {
          if (!value) return { valid: true };
          
          // Check if it's encrypted data
          if (typeof value === 'object' && value._encrypted) {
            return { valid: true };
          }
          
          if (!SecurityUtils.isValidGitHubToken(value)) {
            return {
              valid: false,
              error: 'Invalid GitHub token format',
              suggestion: 'Generate a new personal access token from GitHub Settings > Developer settings > Personal access tokens'
            };
          }
          return { valid: true };
        }
      },
      username: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 39,
        pattern: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
        validate: (value) => {
          if (!value) return { valid: true };
          
          if (value.length < 1 || value.length > 39) {
            return {
              valid: false,
              error: 'GitHub username must be 1-39 characters long',
              suggestion: 'Use your actual GitHub username'
            };
          }
          
          if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(value)) {
            return {
              valid: false,
              error: 'GitHub username contains invalid characters',
              suggestion: 'Username can only contain alphanumeric characters and hyphens, cannot start or end with hyphen'
            };
          }
          
          return { valid: true };
        }
      },
      defaultRepo: {
        type: 'string',
        required: false,
        validate: (value) => {
          if (!value) return { valid: true };
          
          const repoResult = ValidationUtils.validateRepositoryUrl(value);
          if (!repoResult.valid) {
            return {
              valid: false,
              error: repoResult.error,
              suggestion: 'Use format: https://github.com/owner/repo or git@github.com:owner/repo'
            };
          }
          
          return { valid: true };
        }
      }
    }
  },
  git: {
    type: 'object',
    required: false,
    properties: {
      defaultAuthor: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 100,
        validate: (value) => {
          if (!value) return { valid: true };
          
          if (value.length < 1 || value.length > 100) {
            return {
              valid: false,
              error: 'Author name must be 1-100 characters long',
              suggestion: 'Use your full name or preferred display name'
            };
          }
          
          // Check for potentially dangerous characters
          if (/[<>&"'`${}[\]\\]/.test(value)) {
            return {
              valid: false,
              error: 'Author name contains invalid characters',
              suggestion: 'Use only letters, numbers, spaces, and basic punctuation'
            };
          }
          
          return { valid: true };
        }
      },
      defaultEmail: {
        type: 'string',
        required: false,
        validate: (value) => {
          if (!value) return { valid: true };
          
          if (!SecurityUtils.isValidEmail(value)) {
            return {
              valid: false,
              error: 'Invalid email address format',
              suggestion: 'Use format: user@domain.com'
            };
          }
          
          return { valid: true };
        }
      },
      defaultTime: {
        type: 'string',
        required: false,
        default: '12:00',
        validate: (value) => {
          if (!value) return { valid: true };
          
          const timeResult = ValidationUtils.validateTime(value);
          if (!timeResult.valid) {
            return {
              valid: false,
              error: timeResult.error,
              suggestion: 'Use format: HH:MM (24-hour format, e.g., 14:30)'
            };
          }
          
          return { valid: true };
        }
      }
    }
  },
  ui: {
    type: 'object',
    required: false,
    properties: {
      showBanner: {
        type: 'boolean',
        required: false,
        default: true
      },
      colorOutput: {
        type: 'boolean',
        required: false,
        default: true
      },
      verboseOutput: {
        type: 'boolean',
        required: false,
        default: false
      },
      theme: {
        type: 'string',
        required: false,
        default: 'default',
        enum: ['default', 'dark', 'light', 'minimal'],
        validate: (value) => {
          if (!value) return { valid: true };
          
          const validThemes = ['default', 'dark', 'light', 'minimal'];
          if (!validThemes.includes(value)) {
            return {
              valid: false,
              error: `Invalid theme: ${value}`,
              suggestion: `Use one of: ${validThemes.join(', ')}`
            };
          }
          
          return { valid: true };
        }
      }
    }
  },
  advanced: {
    type: 'object',
    required: false,
    properties: {
      maxConcurrentOperations: {
        type: 'number',
        required: false,
        default: 5,
        min: 1,
        max: 20,
        validate: (value) => {
          if (value === undefined || value === null) return { valid: true };
          
          if (typeof value !== 'number' || !Number.isInteger(value)) {
            return {
              valid: false,
              error: 'Max concurrent operations must be an integer',
              suggestion: 'Use a number between 1 and 20'
            };
          }
          
          if (value < 1 || value > 20) {
            return {
              valid: false,
              error: 'Max concurrent operations must be between 1 and 20',
              suggestion: 'Recommended values: 3-10 depending on system resources'
            };
          }
          
          return { valid: true };
        }
      },
      operationTimeout: {
        type: 'number',
        required: false,
        default: 300000, // 5 minutes
        min: 10000, // 10 seconds
        max: 3600000, // 1 hour
        validate: (value) => {
          if (value === undefined || value === null) return { valid: true };
          
          if (typeof value !== 'number' || !Number.isInteger(value)) {
            return {
              valid: false,
              error: 'Operation timeout must be an integer (milliseconds)',
              suggestion: 'Use milliseconds (e.g., 300000 for 5 minutes)'
            };
          }
          
          if (value < 10000 || value > 3600000) {
            return {
              valid: false,
              error: 'Operation timeout must be between 10 seconds and 1 hour',
              suggestion: 'Recommended: 300000 (5 minutes) for most operations'
            };
          }
          
          return { valid: true };
        }
      },
      enableDebugLogging: {
        type: 'boolean',
        required: false,
        default: false
      }
    }
  }
};

/**
 * Configuration validator with comprehensive validation and error reporting
 */
class ConfigValidator {
  constructor(schema = CONFIG_SCHEMA) {
    this.schema = schema;
  }

  /**
   * Validate complete configuration object
   * @param {Object} config - Configuration to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with errors and warnings
   */
  validate(config, options = {}) {
    const {
      strict = false, // Strict mode fails on warnings
      allowUnknown = true, // Allow unknown properties
      applyDefaults = false // Apply default values
    } = options;

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      corrected: applyDefaults ? { ...config } : null
    };

    if (!config || typeof config !== 'object') {
      result.valid = false;
      result.errors.push({
        path: '',
        error: 'Configuration must be an object',
        suggestion: 'Provide a valid configuration object'
      });
      return result;
    }

    // Validate against schema
    this._validateObject(config, this.schema, '', result, { allowUnknown, applyDefaults });

    // Check for required sections that are missing
    this._checkRequiredSections(config, result);

    // Validate cross-field dependencies
    this._validateDependencies(config, result);

    // Apply strict mode
    if (strict && result.warnings.length > 0) {
      result.valid = false;
      result.errors.push(...result.warnings.map(w => ({ ...w, severity: 'error' })));
    }

    return result;
  }

  /**
   * Validate a specific configuration section
   * @param {Object} config - Configuration object
   * @param {string} section - Section name to validate
   * @returns {Object} Validation result
   */
  validateSection(config, section) {
    if (!this.schema[section]) {
      return {
        valid: false,
        errors: [{
          path: section,
          error: `Unknown configuration section: ${section}`,
          suggestion: `Valid sections: ${Object.keys(this.schema).join(', ')}`
        }]
      };
    }

    const sectionData = config[section] || {};
    const sectionSchema = this.schema[section];
    
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    this._validateObject(sectionData, sectionSchema, section, result);

    return result;
  }

  /**
   * Get configuration schema for documentation or UI generation
   * @returns {Object} Configuration schema
   */
  getSchema() {
    return JSON.parse(JSON.stringify(this.schema));
  }

  /**
   * Get default configuration based on schema
   * @returns {Object} Default configuration
   */
  getDefaults() {
    const defaults = {};
    this._extractDefaults(this.schema, defaults);
    return defaults;
  }

  /**
   * Migrate configuration from older versions
   * @param {Object} config - Configuration to migrate
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @returns {Object} Migration result
   */
  migrate(config, fromVersion, toVersion = '3.0.0') {
    const result = {
      success: true,
      migrated: { ...config },
      changes: [],
      errors: []
    };

    try {
      // Version-specific migrations
      if (this._compareVersions(fromVersion, '2.0.0') < 0) {
        this._migrateFromV1(result);
      }

      if (this._compareVersions(fromVersion, '3.0.0') < 0) {
        this._migrateFromV2(result);
      }

      // Validate migrated configuration
      const validation = this.validate(result.migrated, { applyDefaults: true });
      if (!validation.valid) {
        result.success = false;
        result.errors.push(...validation.errors);
      } else if (validation.corrected) {
        result.migrated = validation.corrected;
      }

    } catch (error) {
      result.success = false;
      result.errors.push({
        error: `Migration failed: ${error.message}`,
        suggestion: 'Manual configuration update may be required'
      });
    }

    return result;
  }

  /**
   * Validate object against schema
   * @private
   */
  _validateObject(obj, schema, path, result, options = {}) {
    const { allowUnknown = true, applyDefaults = false } = options;

    // Check required properties
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const fullPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        // Check if required
        if (propSchema.required && (value === undefined || value === null)) {
          result.valid = false;
          result.errors.push({
            path: fullPath,
            error: `Required property '${key}' is missing`,
            suggestion: propSchema.suggestion || `Provide a value for ${key}`
          });
          return;
        }

        // Apply defaults
        if (applyDefaults && value === undefined && propSchema.default !== undefined) {
          this._setNestedValue(result.corrected, fullPath, propSchema.default);
        }

        // Skip validation if value is undefined/null and not required
        if (value === undefined || value === null) {
          return;
        }

        // Validate property
        this._validateProperty(value, propSchema, fullPath, result, options);
      });
    }

    // Check for unknown properties
    if (!allowUnknown && schema.properties) {
      Object.keys(obj).forEach(key => {
        if (!schema.properties[key]) {
          result.warnings.push({
            path: path ? `${path}.${key}` : key,
            error: `Unknown property '${key}'`,
            suggestion: `Remove this property or check for typos. Valid properties: ${Object.keys(schema.properties).join(', ')}`
          });
        }
      });
    }
  }

  /**
   * Validate individual property
   * @private
   */
  _validateProperty(value, schema, path, result, options) {
    // Type validation
    if (schema.type && typeof value !== schema.type) {
      result.valid = false;
      result.errors.push({
        path,
        error: `Property '${path}' must be of type ${schema.type}, got ${typeof value}`,
        suggestion: `Convert value to ${schema.type}`
      });
      return;
    }

    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        result.valid = false;
        result.errors.push({
          path,
          error: `Property '${path}' must be at least ${schema.minLength} characters long`,
          suggestion: schema.suggestion || `Provide a longer value`
        });
      }

      if (schema.maxLength && value.length > schema.maxLength) {
        result.valid = false;
        result.errors.push({
          path,
          error: `Property '${path}' must be no more than ${schema.maxLength} characters long`,
          suggestion: schema.suggestion || `Provide a shorter value`
        });
      }

      if (schema.pattern && !schema.pattern.test(value)) {
        result.valid = false;
        result.errors.push({
          path,
          error: `Property '${path}' does not match required pattern`,
          suggestion: schema.suggestion || `Check the format requirements`
        });
      }

      if (schema.enum && !schema.enum.includes(value)) {
        result.valid = false;
        result.errors.push({
          path,
          error: `Property '${path}' must be one of: ${schema.enum.join(', ')}`,
          suggestion: `Use one of the allowed values`
        });
      }
    }

    // Number validations
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.min !== undefined && value < schema.min) {
        result.valid = false;
        result.errors.push({
          path,
          error: `Property '${path}' must be at least ${schema.min}`,
          suggestion: schema.suggestion || `Use a value >= ${schema.min}`
        });
      }

      if (schema.max !== undefined && value > schema.max) {
        result.valid = false;
        result.errors.push({
          path,
          error: `Property '${path}' must be no more than ${schema.max}`,
          suggestion: schema.suggestion || `Use a value <= ${schema.max}`
        });
      }
    }

    // Object validation
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      this._validateObject(value, schema, path, result, options);
    }

    // Custom validation
    if (schema.validate && typeof schema.validate === 'function') {
      const customResult = schema.validate(value);
      if (!customResult.valid) {
        result.valid = false;
        result.errors.push({
          path,
          error: customResult.error,
          suggestion: customResult.suggestion || schema.suggestion
        });
      }
    }
  }

  /**
   * Check for required sections
   * @private
   */
  _checkRequiredSections(config, result) {
    Object.entries(this.schema).forEach(([section, sectionSchema]) => {
      if (sectionSchema.required && !config[section]) {
        result.valid = false;
        result.errors.push({
          path: section,
          error: `Required section '${section}' is missing`,
          suggestion: `Add the ${section} section to your configuration`
        });
      }
    });
  }

  /**
   * Validate cross-field dependencies
   * @private
   */
  _validateDependencies(config, result) {
    // GitHub token requires username for some operations
    if (config.github?.token && !config.github?.username) {
      result.warnings.push({
        path: 'github.username',
        error: 'GitHub username is recommended when token is provided',
        suggestion: 'Add your GitHub username for better integration'
      });
    }

    // Git author and email should be provided together
    if (config.git?.defaultAuthor && !config.git?.defaultEmail) {
      result.warnings.push({
        path: 'git.defaultEmail',
        error: 'Default email is recommended when default author is provided',
        suggestion: 'Add your email address for complete Git configuration'
      });
    }

    if (config.git?.defaultEmail && !config.git?.defaultAuthor) {
      result.warnings.push({
        path: 'git.defaultAuthor',
        error: 'Default author is recommended when default email is provided',
        suggestion: 'Add your name for complete Git configuration'
      });
    }
  }

  /**
   * Extract default values from schema
   * @private
   */
  _extractDefaults(schema, defaults, path = '') {
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (propSchema.default !== undefined) {
          this._setNestedValue(defaults, fullPath, propSchema.default);
        }
        
        if (propSchema.type === 'object' && propSchema.properties) {
          this._extractDefaults(propSchema, defaults, fullPath);
        }
      });
    }
  }

  /**
   * Set nested value in object
   * @private
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Compare version strings
   * @private
   */
  _compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  /**
   * Migrate from version 1.x
   * @private
   */
  _migrateFromV1(result) {
    // V1 to V2 migration logic
    if (result.migrated.token) {
      result.migrated.github = result.migrated.github || {};
      result.migrated.github.token = result.migrated.token;
      delete result.migrated.token;
      result.changes.push('Moved token to github.token');
    }

    if (result.migrated.author) {
      result.migrated.git = result.migrated.git || {};
      result.migrated.git.defaultAuthor = result.migrated.author;
      delete result.migrated.author;
      result.changes.push('Moved author to git.defaultAuthor');
    }
  }

  /**
   * Migrate from version 2.x
   * @private
   */
  _migrateFromV2(result) {
    // V2 to V3 migration logic
    if (result.migrated.ui?.colors !== undefined) {
      result.migrated.ui.colorOutput = result.migrated.ui.colors;
      delete result.migrated.ui.colors;
      result.changes.push('Renamed ui.colors to ui.colorOutput');
    }

    if (result.migrated.ui?.verbose !== undefined) {
      result.migrated.ui.verboseOutput = result.migrated.ui.verbose;
      delete result.migrated.ui.verbose;
      result.changes.push('Renamed ui.verbose to ui.verboseOutput');
    }
  }
}

module.exports = ConfigValidator;