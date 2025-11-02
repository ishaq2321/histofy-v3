/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * ValidationUtils Tests
 */

const ValidationUtils = require('../../src/utils/ValidationUtils');
const path = require('path');

describe('ValidationUtils', () => {
  describe('isValidCommitHash', () => {
    test('should accept valid full commit hashes', () => {
      const validHashes = [
        'a1b2c3d4e5f6789012345678901234567890abcd',
        'ABCDEF1234567890ABCDEF1234567890ABCDEF12',
        '0123456789abcdef0123456789abcdef01234567'
      ];

      validHashes.forEach(hash => {
        expect(ValidationUtils.isValidCommitHash(hash)).toBe(true);
      });
    });

    test('should accept valid short commit hashes when allowed', () => {
      const validShortHashes = [
        'a1b2c3d',
        'ABCDEF1',
        '0123456789abcdef'
      ];

      validShortHashes.forEach(hash => {
        expect(ValidationUtils.isValidCommitHash(hash, true)).toBe(true);
      });
    });

    test('should reject short commit hashes when not allowed', () => {
      const shortHashes = ['a1b2c3d', 'ABCDEF1'];

      shortHashes.forEach(hash => {
        expect(ValidationUtils.isValidCommitHash(hash, false)).toBe(false);
      });
    });

    test('should reject invalid commit hashes', () => {
      const invalidHashes = [
        'invalid',
        'a1b2c3g', // Invalid character 'g'
        'a1b2c3', // Too short
        'a1b2c3d4e5f6789012345678901234567890abcde', // Too long
        '',
        null,
        undefined,
        123
      ];

      invalidHashes.forEach(hash => {
        expect(ValidationUtils.isValidCommitHash(hash)).toBe(false);
      });
    });
  });

  describe('validateDate', () => {
    test('should accept valid date strings', () => {
      const validDates = [
        '2023-01-01',
        '2023-12-31T23:59:59Z',
        'January 1, 2023',
        '01/01/2023',
        '2023-06-15T10:30:00'
      ];

      validDates.forEach(dateStr => {
        const result = ValidationUtils.validateDate(dateStr);
        expect(result.valid).toBe(true);
        expect(result.date).toBeInstanceOf(Date);
        expect(result.iso).toBeDefined();
      });
    });

    test('should reject invalid date strings', () => {
      const invalidDates = [
        'invalid-date',
        '2023-13-01', // Invalid month
        '2023-01-32', // Invalid day
        '',
        null,
        undefined,
        123
      ];

      invalidDates.forEach(dateStr => {
        const result = ValidationUtils.validateDate(dateStr);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject dates too far in past or future', () => {
      const result1 = ValidationUtils.validateDate('1969-01-01');
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('too far in the past');

      const result2 = ValidationUtils.validateDate('2050-01-01');
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('too far in the future');
    });
  });

  describe('validateTime', () => {
    test('should accept valid time strings', () => {
      const validTimes = [
        '00:00',
        '12:30',
        '23:59',
        '9:15',
        '01:01'
      ];

      validTimes.forEach(timeStr => {
        const result = ValidationUtils.validateTime(timeStr);
        expect(result.valid).toBe(true);
        expect(result.hours).toBeDefined();
        expect(result.minutes).toBeDefined();
        expect(result.formatted).toBeDefined();
      });
    });

    test('should reject invalid time strings', () => {
      const invalidTimes = [
        '24:00', // Invalid hour
        '12:60', // Invalid minute
        '12', // Missing minutes
        '12:30:45', // Seconds not allowed
        'invalid',
        '',
        null,
        undefined
      ];

      invalidTimes.forEach(timeStr => {
        const result = ValidationUtils.validateTime(timeStr);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should format time correctly', () => {
      const result = ValidationUtils.validateTime('9:5');
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe('09:05');
    });
  });

  describe('validateRepositoryUrl', () => {
    test('should accept valid GitHub HTTPS URLs', () => {
      const validUrls = [
        'https://github.com/user/repo',
        'https://github.com/user/repo.git',
        'https://github.com/user-name/repo-name',
        'https://github.com/user.name/repo.name'
      ];

      validUrls.forEach(url => {
        const result = ValidationUtils.validateRepositoryUrl(url);
        expect(result.valid).toBe(true);
        expect(result.type).toBe('https');
        expect(result.owner).toBeDefined();
        expect(result.repo).toBeDefined();
      });
    });

    test('should accept valid GitHub SSH URLs', () => {
      const validUrls = [
        'git@github.com:user/repo',
        'git@github.com:user/repo.git',
        'git@github.com:user-name/repo-name'
      ];

      validUrls.forEach(url => {
        const result = ValidationUtils.validateRepositoryUrl(url);
        expect(result.valid).toBe(true);
        expect(result.type).toBe('ssh');
        expect(result.owner).toBeDefined();
        expect(result.repo).toBeDefined();
      });
    });

    test('should reject invalid repository URLs', () => {
      const invalidUrls = [
        'https://gitlab.com/user/repo', // Not GitHub
        'https://github.com/user', // Missing repo
        'invalid-url',
        'ftp://github.com/user/repo',
        '',
        null,
        undefined
      ];

      invalidUrls.forEach(url => {
        const result = ValidationUtils.validateRepositoryUrl(url);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateCommitMessage', () => {
    test('should accept valid commit messages', () => {
      const validMessages = [
        'Add new feature',
        'Fix bug in user authentication',
        'Update documentation for API endpoints'
      ];

      validMessages.forEach(message => {
        const result = ValidationUtils.validateCommitMessage(message);
        expect(result.valid).toBe(true);
        expect(result.subject).toBeDefined();
      });
    });

    test('should reject messages that are too short', () => {
      const result = ValidationUtils.validateCommitMessage('Fix');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    test('should reject messages that are too long', () => {
      const longMessage = 'A'.repeat(100);
      const result = ValidationUtils.validateCommitMessage(longMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    test('should reject messages with dangerous content', () => {
      const dangerousMessages = [
        'Fix <script>alert("xss")</script>',
        'Update javascript:alert("xss")',
        'Add data:text/html,<script>alert("xss")</script>'
      ];

      dangerousMessages.forEach(message => {
        const result = ValidationUtils.validateCommitMessage(message);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('dangerous content');
      });
    });

    test('should handle custom options', () => {
      const options = {
        maxLength: 50,
        minLength: 5,
        allowEmpty: true
      };

      const result1 = ValidationUtils.validateCommitMessage('', options);
      expect(result1.valid).toBe(true);

      const result2 = ValidationUtils.validateCommitMessage('Short', options);
      expect(result2.valid).toBe(true);
    });
  });

  describe('validateGitFilePath', () => {
    test('should accept valid file paths', () => {
      const validPaths = [
        'src/index.js',
        'README.md',
        'docs/api.md',
        '.gitignore'
      ];

      validPaths.forEach(filePath => {
        const result = ValidationUtils.validateGitFilePath(filePath);
        expect(result.valid).toBe(true);
        expect(result.path).toBeDefined();
      });
    });

    test('should reject Git internal files', () => {
      const gitFiles = [
        '.git/config',
        '.git/HEAD',
        '.git/objects/abc123'
      ];

      gitFiles.forEach(filePath => {
        const result = ValidationUtils.validateGitFilePath(filePath);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Git internal files');
      });
    });

    test('should warn about binary files', () => {
      const binaryFiles = [
        'app.exe',
        'library.dll',
        'binary.bin'
      ];

      binaryFiles.forEach(filePath => {
        const result = ValidationUtils.validateGitFilePath(filePath);
        expect(result.valid).toBe(true);
        expect(result.warning).toContain('Binary file detected');
      });
    });

    test('should handle repository root validation', () => {
      const repoRoot = '/home/user/repo';
      const result = ValidationUtils.validateGitFilePath('src/file.js', repoRoot);
      expect(result.valid).toBe(true);
      expect(result.relative).toBeDefined();
    });
  });

  describe('validateCommandArgs', () => {
    test('should accept valid arguments', () => {
      const args = ['arg1', 'arg2', 'file.txt'];
      const result = ValidationUtils.validateCommandArgs(args);
      expect(result.valid).toBe(true);
      expect(result.args).toEqual(args);
    });

    test('should validate with schema', () => {
      const args = ['123', 'true', 'text'];
      const schema = {
        0: { type: 'number' },
        1: { type: 'boolean' },
        2: { maxLength: 10 }
      };

      const result = ValidationUtils.validateCommandArgs(args, schema);
      expect(result.valid).toBe(true);
    });

    test('should reject arguments that fail schema validation', () => {
      const args = ['not-a-number', 'not-a-boolean'];
      const schema = {
        0: { type: 'number' },
        1: { type: 'boolean' }
      };

      const result = ValidationUtils.validateCommandArgs(args, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle invalid input', () => {
      const result = ValidationUtils.validateCommandArgs('not-an-array');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an array');
    });
  });

  describe('validateConfigStructure', () => {
    test('should validate config against schema', () => {
      const config = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef12345678',
          username: 'testuser'
        },
        git: {
          defaultEmail: 'test@example.com'
        }
      };

      const schema = {
        github: {
          type: 'object',
          properties: {
            token: { type: 'string', required: true },
            username: { type: 'string' }
          }
        },
        git: {
          type: 'object',
          properties: {
            defaultEmail: { 
              type: 'string',
              validate: (value) => ({
                valid: value.includes('@'),
                error: 'Invalid email format'
              })
            }
          }
        }
      };

      const result = ValidationUtils.validateConfigStructure(config, schema);
      expect(result.valid).toBe(true);
    });

    test('should detect missing required fields', () => {
      const config = {
        github: {
          username: 'testuser'
          // token is missing
        }
      };

      const schema = {
        github: {
          type: 'object',
          properties: {
            token: { type: 'string', required: true },
            username: { type: 'string' }
          }
        }
      };

      const result = ValidationUtils.validateConfigStructure(config, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Required field missing: github.token');
    });

    test('should detect type mismatches', () => {
      const config = {
        github: {
          token: 123 // Should be string
        }
      };

      const schema = {
        github: {
          type: 'object',
          properties: {
            token: { type: 'string' }
          }
        }
      };

      const result = ValidationUtils.validateConfigStructure(config, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid type');
    });

    test('should warn about unexpected fields', () => {
      const config = {
        github: {
          token: 'valid-token',
          unexpectedField: 'value'
        }
      };

      const schema = {
        github: {
          type: 'object',
          properties: {
            token: { type: 'string' }
          }
        }
      };

      const result = ValidationUtils.validateConfigStructure(config, schema);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unexpected field: github.unexpectedField');
    });
  });
});