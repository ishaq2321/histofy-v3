/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * SecurityUtils Tests
 */

const SecurityUtils = require('../../src/security/SecurityUtils');
const path = require('path');
const os = require('os');

describe('SecurityUtils', () => {
  describe('sanitizeEditorCommand', () => {
    test('should accept allowed editors', () => {
      const allowedEditors = ['nano', 'vim', 'code', 'notepad'];
      
      allowedEditors.forEach(editor => {
        expect(() => SecurityUtils.sanitizeEditorCommand(editor)).not.toThrow();
        expect(SecurityUtils.sanitizeEditorCommand(editor)).toBe(editor);
      });
    });

    test('should accept allowed editors with .exe extension', () => {
      expect(() => SecurityUtils.sanitizeEditorCommand('notepad.exe')).not.toThrow();
      expect(SecurityUtils.sanitizeEditorCommand('notepad.exe')).toBe('notepad.exe');
    });

    test('should reject dangerous characters', () => {
      const dangerousCommands = [
        'nano; rm -rf /',
        'vim | cat /etc/passwd',
        'code && whoami',
        'nano `whoami`',
        'vim $(rm -rf /)'
      ];

      dangerousCommands.forEach(cmd => {
        expect(() => SecurityUtils.sanitizeEditorCommand(cmd)).toThrow('dangerous characters');
      });
    });

    test('should reject non-allowed editors', () => {
      const disallowedEditors = ['rm', 'cat', 'whoami', 'malicious-editor'];
      
      disallowedEditors.forEach(editor => {
        expect(() => SecurityUtils.sanitizeEditorCommand(editor)).toThrow('not in the allowed list');
      });
    });

    test('should handle invalid inputs', () => {
      expect(() => SecurityUtils.sanitizeEditorCommand(null)).toThrow('required and must be a string');
      expect(() => SecurityUtils.sanitizeEditorCommand(undefined)).toThrow('required and must be a string');
      expect(() => SecurityUtils.sanitizeEditorCommand('')).toThrow('required and must be a string');
      expect(() => SecurityUtils.sanitizeEditorCommand(123)).toThrow('required and must be a string');
    });
  });

  describe('validateFilePath', () => {
    test('should accept valid file paths', () => {
      const validPaths = ['test.txt', 'src/file.js', 'docs/readme.md'];
      
      validPaths.forEach(filePath => {
        expect(() => SecurityUtils.validateFilePath(filePath)).not.toThrow();
      });
    });

    test('should reject path traversal attempts', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '~/../../etc/shadow',
        'test/../../../etc/passwd'
      ];

      maliciousPaths.forEach(maliciousPath => {
        expect(() => SecurityUtils.validateFilePath(maliciousPath)).toThrow('Path traversal detected');
      });
    });

    test('should reject paths with invalid characters', () => {
      const invalidPaths = [
        'file\0.txt',
        'file<script>.txt',
        'file>output.txt',
        'file|pipe.txt',
        'file"quote.txt'
      ];

      invalidPaths.forEach(invalidPath => {
        expect(() => SecurityUtils.validateFilePath(invalidPath)).toThrow('invalid characters');
      });
    });

    test('should validate against base path', () => {
      const basePath = '/safe/directory';
      
      // Should accept paths within base path
      expect(() => SecurityUtils.validateFilePath('file.txt', basePath)).not.toThrow();
      
      // Should reject paths outside base path
      expect(() => SecurityUtils.validateFilePath('../outside.txt', basePath)).toThrow('outside the allowed directory');
    });

    test('should handle invalid inputs', () => {
      expect(() => SecurityUtils.validateFilePath(null)).toThrow('required and must be a string');
      expect(() => SecurityUtils.validateFilePath('')).toThrow('cannot be empty');
      expect(() => SecurityUtils.validateFilePath('   ')).toThrow('cannot be empty');
    });
  });

  describe('sanitizeGitReference', () => {
    test('should accept valid Git references', () => {
      const validRefs = [
        'main',
        'feature/new-feature',
        'HEAD~5',
        'v1.0.0',
        'origin/main',
        'HEAD~5..HEAD',
        'abc123def456'
      ];

      validRefs.forEach(ref => {
        expect(() => SecurityUtils.sanitizeGitReference(ref)).not.toThrow();
        expect(SecurityUtils.sanitizeGitReference(ref)).toBe(ref);
      });
    });

    test('should reject dangerous Git references', () => {
      const dangerousRefs = [
        'main; rm -rf /',
        'HEAD | cat /etc/passwd',
        'branch && whoami',
        'ref `whoami`',
        'branch $(rm -rf /)',
        'ref "dangerous"',
        "ref 'dangerous'"
      ];

      dangerousRefs.forEach(ref => {
        expect(() => SecurityUtils.sanitizeGitReference(ref)).toThrow('dangerous character');
      });
    });

    test('should reject references starting with hyphen', () => {
      expect(() => SecurityUtils.sanitizeGitReference('-main')).toThrow('cannot start with a hyphen');
    });

    test('should validate Git reference ranges', () => {
      expect(() => SecurityUtils.sanitizeGitReference('HEAD~5..HEAD')).not.toThrow();
      expect(() => SecurityUtils.sanitizeGitReference('main..feature')).not.toThrow();
      
      // Invalid range format
      expect(() => SecurityUtils.sanitizeGitReference('main...feature...other')).toThrow('Invalid Git reference range format');
    });

    test('should handle invalid inputs', () => {
      expect(() => SecurityUtils.sanitizeGitReference(null)).toThrow('required and must be a string');
      expect(() => SecurityUtils.sanitizeGitReference('')).toThrow('cannot be empty');
      expect(() => SecurityUtils.sanitizeGitReference('   ')).toThrow('cannot be empty');
    });
  });

  describe('sanitizeCommandArgs', () => {
    test('should sanitize valid arguments', () => {
      const validArgs = ['arg1', 'arg2', 'file.txt'];
      const result = SecurityUtils.sanitizeCommandArgs(validArgs);
      expect(result).toEqual(validArgs);
    });

    test('should reject dangerous arguments', () => {
      const dangerousArgs = ['arg1', 'arg2; rm -rf /', 'file.txt'];
      expect(() => SecurityUtils.sanitizeCommandArgs(dangerousArgs)).toThrow('dangerous characters');
    });

    test('should convert non-string arguments', () => {
      const mixedArgs = ['arg1', 123, true, 'arg4'];
      const result = SecurityUtils.sanitizeCommandArgs(mixedArgs);
      expect(result).toEqual(['arg1', '123', 'true', 'arg4']);
    });

    test('should handle invalid input', () => {
      expect(() => SecurityUtils.sanitizeCommandArgs('not-an-array')).toThrow('must be an array');
      expect(() => SecurityUtils.sanitizeCommandArgs(null)).toThrow('must be an array');
    });
  });

  describe('isValidEmail', () => {
    test('should accept valid emails', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.org',
        'user+tag@example.co.uk',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(SecurityUtils.isValidEmail(email)).toBe(true);
      });
    });

    test('should reject invalid emails', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user<script>@domain.com',
        'user"quote@domain.com',
        'user\n@domain.com',
        'a'.repeat(65) + '@domain.com', // Local part too long
        'user@' + 'a'.repeat(250) + '.com' // Email too long
      ];

      invalidEmails.forEach(email => {
        expect(SecurityUtils.isValidEmail(email)).toBe(false);
      });
    });

    test('should handle invalid inputs', () => {
      expect(SecurityUtils.isValidEmail(null)).toBe(false);
      expect(SecurityUtils.isValidEmail(undefined)).toBe(false);
      expect(SecurityUtils.isValidEmail('')).toBe(false);
      expect(SecurityUtils.isValidEmail(123)).toBe(false);
    });
  });

  describe('isValidGitHubToken', () => {
    test('should accept valid GitHub tokens', () => {
      const validTokens = [
        'ghp_1234567890abcdef1234567890abcdef12345678',
        'gho_1234567890abcdef1234567890abcdef12345678',
        'ghu_1234567890abcdef1234567890abcdef12345678',
        'ghs_1234567890abcdef1234567890abcdef12345678',
        'ghr_1234567890abcdef1234567890abcdef12345678'
      ];

      validTokens.forEach(token => {
        expect(SecurityUtils.isValidGitHubToken(token)).toBe(true);
      });
    });

    test('should reject invalid GitHub tokens', () => {
      const invalidTokens = [
        'invalid-token',
        'ghp_short',
        'wrong_prefix_1234567890abcdef1234567890abcdef12345678',
        'ghp_1234567890abcdef1234567890abcdef1234567', // Too short
        ''
      ];

      invalidTokens.forEach(token => {
        expect(SecurityUtils.isValidGitHubToken(token)).toBe(false);
      });
    });

    test('should handle invalid inputs', () => {
      expect(SecurityUtils.isValidGitHubToken(null)).toBe(false);
      expect(SecurityUtils.isValidGitHubToken(undefined)).toBe(false);
      expect(SecurityUtils.isValidGitHubToken(123)).toBe(false);
    });
  });

  describe('sanitizeForDisplay', () => {
    test('should sanitize HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect(SecurityUtils.sanitizeForDisplay(input)).toBe(expected);
    });

    test('should remove control characters', () => {
      const input = 'text\x00with\x1Fcontrol\x7Fchars';
      const expected = 'textwithcontrolchars';
      expect(SecurityUtils.sanitizeForDisplay(input)).toBe(expected);
    });

    test('should handle invalid inputs', () => {
      expect(SecurityUtils.sanitizeForDisplay(null)).toBe('');
      expect(SecurityUtils.sanitizeForDisplay(undefined)).toBe('');
      expect(SecurityUtils.sanitizeForDisplay(123)).toBe('');
    });
  });

  describe('generateSecureId', () => {
    test('should generate secure random IDs', () => {
      const id1 = SecurityUtils.generateSecureId();
      const id2 = SecurityUtils.generateSecureId();
      
      expect(id1).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(id2).toHaveLength(32);
      expect(id1).not.toBe(id2); // Should be unique
      expect(/^[a-f0-9]+$/.test(id1)).toBe(true); // Should be hex
    });

    test('should generate IDs of specified length', () => {
      const id = SecurityUtils.generateSecureId(8);
      expect(id).toHaveLength(16); // 8 bytes = 16 hex chars
    });
  });
});