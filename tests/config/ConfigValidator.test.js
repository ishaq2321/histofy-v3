/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * ConfigValidator Tests
 */

const ConfigValidator = require('../../src/config/ConfigValidator');

describe('ConfigValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('constructor', () => {
    test('should create validator with default schema', () => {
      expect(validator).toBeInstanceOf(ConfigValidator);
      expect(validator.schema).toBeDefined();
      expect(validator.schema).toHaveProperty('github');
      expect(validator.schema).toHaveProperty('git');
      expect(validator.schema).toHaveProperty('ui');
    });

    test('should create validator with custom schema', () => {
      const customSchema = {
        custom: {
          type: 'object',
          properties: {
            value: { type: 'string' }
          }
        }
      };
      
      const customValidator = new ConfigValidator(customSchema);
      expect(customValidator.schema).toEqual(customSchema);
    });
  });

  describe('validate', () => {
    test('should validate valid configuration', () => {
      const validConfig = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef12345678',
          username: 'testuser'
        },
        git: {
          defaultAuthor: 'Test User',
          defaultEmail: 'test@example.com',
          defaultTime: '12:00'
        },
        ui: {
          showBanner: true,
          colorOutput: true,
          verboseOutput: false
        }
      };

      const result = validator.validate(validConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid GitHub token', () => {
      const invalidConfig = {
        github: {
          token: 'invalid-token-format'
        }
      };

      const result = validator.validate(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'github.token',
          error: 'Invalid GitHub token format'
        })
      );
    });

    test('should detect invalid email format', () => {
      const invalidConfig = {
        git: {
          defaultEmail: 'invalid-email'
        }
      };

      const result = validator.validate(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'git.defaultEmail',
          error: 'Invalid email address format'
        })
      );
    });

    test('should detect invalid time format', () => {
      const invalidConfig = {
        git: {
          defaultTime: '25:70'
        }
      };

      const result = validator.validate(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'git.defaultTime',
          error: expect.stringContaining('Invalid time format')
        })
      );
    });

    test('should validate GitHub username format', () => {
      const invalidConfigs = [
        { github: { username: '' } }, // Too short
        { github: { username: 'a'.repeat(40) } }, // Too long
        { github: { username: '-invalid' } }, // Starts with hyphen
        { github: { username: 'invalid-' } }, // Ends with hyphen
        { github: { username: 'invalid@user' } } // Invalid characters
      ];

      invalidConfigs.forEach(config => {
        const result = validator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'github.username')).toBe(true);
      });
    });

    test('should validate repository URL format', () => {
      const invalidConfig = {
        github: {
          defaultRepo: 'invalid-repo-url'
        }
      };

      const result = validator.validate(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'github.defaultRepo'
        })
      );
    });

    test('should validate author name constraints', () => {
      const invalidConfigs = [
        { git: { defaultAuthor: '' } }, // Too short
        { git: { defaultAuthor: 'a'.repeat(101) } }, // Too long
        { git: { defaultAuthor: 'User<script>' } } // Dangerous characters
      ];

      invalidConfigs.forEach(config => {
        const result = validator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'git.defaultAuthor')).toBe(true);
      });
    });

    test('should validate UI theme values', () => {
      const invalidConfig = {
        ui: {
          theme: 'invalid-theme'
        }
      };

      const result = validator.validate(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'ui.theme',
          error: expect.stringContaining('Invalid theme')
        })
      );
    });

    test('should validate advanced configuration values', () => {
      const invalidConfig = {
        advanced: {
          maxConcurrentOperations: 25, // Too high
          operationTimeout: 5000, // Too low
          enableDebugLogging: 'not-boolean' // Wrong type
        }
      };

      const result = validator.validate(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.path === 'advanced.maxConcurrentOperations')).toBe(true);
      expect(result.errors.some(e => e.path === 'advanced.operationTimeout')).toBe(true);
      expect(result.errors.some(e => e.path === 'advanced.enableDebugLogging')).toBe(true);
    });

    test('should handle non-object configuration', () => {
      const result = validator.validate('not-an-object');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: '',
          error: 'Configuration must be an object'
        })
      );
    });

    test('should apply default values when requested', () => {
      const config = {
        github: {
          username: 'testuser'
        }
      };

      const result = validator.validate(config, { applyDefaults: true });
      
      expect(result.corrected).toBeDefined();
      expect(result.corrected.git.defaultTime).toBe('12:00');
      expect(result.corrected.ui.showBanner).toBe(true);
      expect(result.corrected.advanced.maxConcurrentOperations).toBe(5);
    });

    test('should detect unknown properties when not allowed', () => {
      const config = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef12345678',
          unknownProperty: 'value'
        }
      };

      const result = validator.validate(config, { allowUnknown: false });
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          path: 'github.unknownProperty',
          error: expect.stringContaining('Unknown property')
        })
      );
    });

    test('should use strict mode', () => {
      const config = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef12345678'
          // Missing username - should generate warning
        }
      };

      const result = validator.validate(config, { strict: true });
      
      // In strict mode, warnings become errors
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSection', () => {
    test('should validate specific section', () => {
      const githubConfig = {
        token: 'ghp_1234567890abcdef1234567890abcdef12345678',
        username: 'testuser'
      };

      const result = validator.validateSection({ github: githubConfig }, 'github');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid section', () => {
      const result = validator.validateSection({}, 'nonexistent');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'nonexistent',
          error: expect.stringContaining('Unknown configuration section')
        })
      );
    });

    test('should validate section with errors', () => {
      const invalidGitConfig = {
        defaultEmail: 'invalid-email'
      };

      const result = validator.validateSection({ git: invalidGitConfig }, 'git');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getSchema', () => {
    test('should return schema copy', () => {
      const schema = validator.getSchema();
      
      expect(schema).toEqual(validator.schema);
      expect(schema).not.toBe(validator.schema); // Should be a copy
    });
  });

  describe('getDefaults', () => {
    test('should extract default values', () => {
      const defaults = validator.getDefaults();
      
      expect(defaults).toHaveProperty('git.defaultTime', '12:00');
      expect(defaults).toHaveProperty('ui.showBanner', true);
      expect(defaults).toHaveProperty('ui.colorOutput', true);
      expect(defaults).toHaveProperty('advanced.maxConcurrentOperations', 5);
    });
  });

  describe('migrate', () => {
    test('should migrate from version 1.x', () => {
      const v1Config = {
        token: 'ghp_1234567890abcdef1234567890abcdef12345678',
        author: 'Test User'
      };

      const result = validator.migrate(v1Config, '1.0.0', '3.0.0');
      
      expect(result.success).toBe(true);
      expect(result.migrated).toHaveProperty('github.token', v1Config.token);
      expect(result.migrated).toHaveProperty('git.defaultAuthor', v1Config.author);
      expect(result.migrated).not.toHaveProperty('token');
      expect(result.migrated).not.toHaveProperty('author');
      expect(result.changes).toContain('Moved token to github.token');
      expect(result.changes).toContain('Moved author to git.defaultAuthor');
    });

    test('should migrate from version 2.x', () => {
      const v2Config = {
        ui: {
          colors: true,
          verbose: false
        }
      };

      const result = validator.migrate(v2Config, '2.0.0', '3.0.0');
      
      expect(result.success).toBe(true);
      expect(result.migrated).toHaveProperty('ui.colorOutput', true);
      expect(result.migrated).toHaveProperty('ui.verboseOutput', false);
      expect(result.migrated.ui).not.toHaveProperty('colors');
      expect(result.migrated.ui).not.toHaveProperty('verbose');
      expect(result.changes).toContain('Renamed ui.colors to ui.colorOutput');
      expect(result.changes).toContain('Renamed ui.verbose to ui.verboseOutput');
    });

    test('should handle migration errors', () => {
      const invalidConfig = {
        github: {
          token: 'invalid-token'
        }
      };

      const result = validator.migrate(invalidConfig, '1.0.0', '3.0.0');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should not migrate if already current version', () => {
      const currentConfig = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef12345678'
        }
      };

      const result = validator.migrate(currentConfig, '3.0.0', '3.0.0');
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(0);
    });
  });

  describe('dependency validation', () => {
    test('should warn when token provided without username', () => {
      const config = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef12345678'
        }
      };

      const result = validator.validate(config);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          path: 'github.username',
          error: expect.stringContaining('username is recommended')
        })
      );
    });

    test('should warn when author provided without email', () => {
      const config = {
        git: {
          defaultAuthor: 'Test User'
        }
      };

      const result = validator.validate(config);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          path: 'git.defaultEmail',
          error: expect.stringContaining('email is recommended')
        })
      );
    });

    test('should warn when email provided without author', () => {
      const config = {
        git: {
          defaultEmail: 'test@example.com'
        }
      };

      const result = validator.validate(config);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          path: 'git.defaultAuthor',
          error: expect.stringContaining('author is recommended')
        })
      );
    });
  });

  describe('encrypted values', () => {
    test('should accept encrypted token values', () => {
      const config = {
        github: {
          token: {
            _encrypted: true,
            data: 'encrypted-data',
            iv: 'initialization-vector',
            tag: 'auth-tag'
          }
        }
      };

      const result = validator.validate(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('should handle empty configuration', () => {
      const result = validator.validate({});
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle null values', () => {
      const config = {
        github: {
          token: null,
          username: null
        }
      };

      const result = validator.validate(config);
      
      expect(result.valid).toBe(true);
    });

    test('should handle undefined values', () => {
      const config = {
        github: {
          token: undefined,
          username: undefined
        }
      };

      const result = validator.validate(config);
      
      expect(result.valid).toBe(true);
    });

    test('should handle deeply nested invalid values', () => {
      const config = {
        advanced: {
          maxConcurrentOperations: 'not-a-number'
        }
      };

      const result = validator.validate(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'advanced.maxConcurrentOperations'
        })
      );
    });
  });
});