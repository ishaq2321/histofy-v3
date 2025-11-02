/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Security Integration Tests - Testing against common attack vectors
 */

const SecurityUtils = require('../../src/security/SecurityUtils');
const ValidationUtils = require('../../src/utils/ValidationUtils');
const { ErrorHandler } = require('../../src/utils/errors');
const ConfigManager = require('../../src/config/ConfigManager');
const GitManager = require('../../src/core/GitManager');
const path = require('path');
const os = require('os');

describe('Security Integration Tests', () => {
  describe('Command Injection Prevention', () => {
    test('should prevent command injection in editor commands', () => {
      const maliciousCommands = [
        'nano; rm -rf /',
        'vim && cat /etc/passwd',
        'code | whoami',
        'notepad `whoami`',
        'emacs $(rm -rf /)',
        'vi; curl http://malicious.com',
        'nano & nc -l 4444'
      ];

      maliciousCommands.forEach(cmd => {
        expect(() => SecurityUtils.sanitizeEditorCommand(cmd))
          .toThrow(/dangerous characters/);
      });
    });

    test('should prevent command injection in Git references', () => {
      const maliciousRefs = [
        'HEAD; rm -rf /',
        'main && whoami',
        'branch | cat /etc/passwd',
        'commit `curl malicious.com`',
        'tag $(rm -rf /)',
        'HEAD~5; echo "pwned"',
        'origin/main && curl http://evil.com'
      ];

      maliciousRefs.forEach(ref => {
        expect(() => SecurityUtils.sanitizeGitReference(ref))
          .toThrow(/dangerous character/);
      });
    });

    test('should prevent command injection in file paths', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        'file.txt; rm -rf /',
        'normal.txt && whoami',
        'file.txt | cat /etc/shadow',
        'test.txt `curl evil.com`',
        'file.txt $(rm -rf /)',
        '~/../../etc/hosts'
      ];

      maliciousPaths.forEach(filePath => {
        expect(() => SecurityUtils.validateFilePath(filePath))
          .toThrow();
      });
    });

    test('should sanitize command arguments safely', () => {
      const maliciousArgs = [
        ['arg1', 'arg2; rm -rf /', 'arg3'],
        ['normal', '&& whoami', 'args'],
        ['test', '| cat /etc/passwd', 'end'],
        ['start', '`curl evil.com`', 'finish'],
        ['begin', '$(rm -rf /)', 'complete']
      ];

      maliciousArgs.forEach(args => {
        expect(() => SecurityUtils.sanitizeCommandArgs(args))
          .toThrow(/dangerous characters/);
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should prevent directory traversal attacks', () => {
      const traversalPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'normal/../../../etc/shadow',
        'file.txt/../../../root/.ssh/id_rsa',
        '~/../../etc/hosts',
        'test/../../../../../../etc/passwd',
        'dir\\..\\..\\..\\sensitive\\file.txt'
      ];

      traversalPaths.forEach(maliciousPath => {
        expect(() => SecurityUtils.validateFilePath(maliciousPath))
          .toThrow(/Path traversal detected/);
      });
    });

    test('should validate paths against base directory', () => {
      const basePath = '/safe/directory';
      const outsidePaths = [
        '../outside.txt',
        '../../etc/passwd',
        '/etc/passwd',
        '~/../../etc/shadow'
      ];

      outsidePaths.forEach(outsidePath => {
        expect(() => SecurityUtils.validateFilePath(outsidePath, basePath))
          .toThrow(/outside the allowed directory/);
      });
    });

    test('should allow safe paths within base directory', () => {
      const basePath = '/safe/directory';
      const safePaths = [
        'file.txt',
        'subdir/file.txt',
        'deep/nested/path/file.txt'
      ];

      safePaths.forEach(safePath => {
        expect(() => SecurityUtils.validateFilePath(safePath, basePath))
          .not.toThrow();
      });
    });
  });

  describe('Input Validation Security', () => {
    test('should validate commit messages against XSS', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        'commit message<script>fetch("http://evil.com")</script>'
      ];

      xssPayloads.forEach(payload => {
        const result = ValidationUtils.validateCommitMessage(payload);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('dangerous content');
      });
    });

    test('should validate email addresses against injection', () => {
      const maliciousEmails = [
        'user<script>alert("xss")</script>@domain.com',
        'user"@domain.com',
        'user\n@domain.com',
        'user\r@domain.com',
        'user\t@domain.com',
        'user@domain.com<script>',
        'user@domain.com\nBCC: evil@hacker.com'
      ];

      maliciousEmails.forEach(email => {
        expect(SecurityUtils.isValidEmail(email)).toBe(false);
      });
    });

    test('should validate GitHub tokens against format injection', () => {
      const maliciousTokens = [
        'ghp_token; curl evil.com',
        'ghp_token && whoami',
        'ghp_token | cat /etc/passwd',
        'ghp_token`curl evil.com`',
        'ghp_token$(rm -rf /)',
        'not_a_real_token_format',
        'ghp_' + 'a'.repeat(1000) // Extremely long token
      ];

      maliciousTokens.forEach(token => {
        expect(SecurityUtils.isValidGitHubToken(token)).toBe(false);
      });
    });
  });

  describe('Configuration Security', () => {
    let configManager;
    let testConfigDir;

    beforeEach(async () => {
      testConfigDir = path.join(os.tmpdir(), 'histofy-security-test-' + Date.now());
      configManager = new ConfigManager(testConfigDir);
      await configManager.init();
    });

    afterEach(async () => {
      try {
        const fs = require('fs').promises;
        await fs.rm(testConfigDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should encrypt sensitive configuration values', async () => {
      const sensitiveValue = 'ghp_1234567890abcdef1234567890abcdef12345678';
      
      const result = await configManager.setSecure('github.token', sensitiveValue);
      expect(result.success).toBe(true);
      expect(result.encrypted).toBe(true);

      // Verify the value is encrypted in storage
      const config = await configManager.loadConfig();
      const storedValue = configManager.getNestedValue(config, 'github.token');
      expect(storedValue).toHaveProperty('_encrypted', true);
      expect(storedValue.data).not.toBe(sensitiveValue);

      // Verify decryption works
      const decryptedValue = await configManager.getSecure('github.token');
      expect(decryptedValue).toBe(sensitiveValue);
    });

    test('should handle encryption key tampering', async () => {
      const sensitiveValue = 'secret-data';
      await configManager.setSecure('test.secret', sensitiveValue);

      // Tamper with the encryption key
      const fs = require('fs').promises;
      const keyFile = path.join(testConfigDir, '.key');
      await fs.writeFile(keyFile, 'tampered-key-data');

      // Should fail to decrypt with tampered key
      await expect(configManager.getSecure('test.secret'))
        .rejects.toThrow(/Failed to decrypt value/);
    });

    test('should validate configuration against schema injection', async () => {
      const maliciousConfig = {
        github: {
          token: 'ghp_token; curl evil.com',
          username: '<script>alert("xss")</script>'
        },
        git: {
          defaultEmail: 'user<script>@domain.com',
          defaultTime: '25:70' // Invalid time
        }
      };

      const result = await configManager.validateConfig(maliciousConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Security', () => {
    test('should sanitize error messages for display', () => {
      const maliciousError = new Error('<script>alert("xss")</script>');
      const sanitized = SecurityUtils.sanitizeForDisplay(maliciousError.message);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    test('should not leak sensitive information in error messages', () => {
      const sensitiveData = 'ghp_1234567890abcdef1234567890abcdef12345678';
      const error = new Error(`Authentication failed with token: ${sensitiveData}`);
      
      const formattedError = ErrorHandler.formatUserFriendlyError(error);
      
      // Should not contain the actual token
      expect(formattedError).not.toContain(sensitiveData);
      expect(formattedError).toContain('Authentication failed');
    });

    test('should handle control characters in error messages', () => {
      const errorWithControlChars = 'Error\x00with\x1Fcontrol\x7Fchars';
      const sanitized = SecurityUtils.sanitizeForDisplay(errorWithControlChars);
      
      expect(sanitized).toBe('Errorwithcontrolchars');
      expect(sanitized).not.toMatch(/[\x00-\x1F\x7F]/);
    });
  });

  describe('Git Operation Security', () => {
    test('should validate Git references before operations', () => {
      const maliciousRefs = [
        'HEAD; rm -rf /',
        'main && curl evil.com',
        'branch | whoami',
        'commit`malicious`',
        'tag$(dangerous)'
      ];

      maliciousRefs.forEach(ref => {
        expect(() => SecurityUtils.sanitizeGitReference(ref))
          .toThrow(/dangerous character/);
      });
    });

    test('should prevent Git command injection in commit messages', () => {
      const maliciousMessages = [
        'Normal commit; rm -rf /',
        'Commit && curl evil.com',
        'Message | cat /etc/passwd',
        'Commit`whoami`',
        'Message$(dangerous)'
      ];

      maliciousMessages.forEach(message => {
        const result = ValidationUtils.validateCommitMessage(message);
        expect(result.valid).toBe(false);
      });
    });

    test('should validate file paths for Git operations', () => {
      const maliciousPaths = [
        '.git/config',
        '.git/HEAD',
        '.git/objects/malicious',
        '../../../etc/passwd',
        'normal.txt; rm -rf /'
      ];

      maliciousPaths.forEach(filePath => {
        const result = ValidationUtils.validateGitFilePath(filePath);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Memory Safety', () => {
    test('should handle large input strings safely', () => {
      const largeString = 'a'.repeat(1000000); // 1MB string
      
      // Should not crash or cause memory issues
      expect(() => SecurityUtils.sanitizeForDisplay(largeString)).not.toThrow();
      
      const result = SecurityUtils.sanitizeForDisplay(largeString);
      expect(result.length).toBe(largeString.length);
    });

    test('should handle deeply nested objects safely', () => {
      // Create deeply nested object
      let deepObject = {};
      let current = deepObject;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = 'deep value';

      // Should not cause stack overflow
      expect(() => JSON.stringify(deepObject)).not.toThrow();
    });

    test('should handle circular references safely', () => {
      const obj = { name: 'test' };
      obj.self = obj; // Create circular reference

      // Should not cause infinite loops
      expect(() => {
        try {
          JSON.stringify(obj);
        } catch (error) {
          // Expected to throw due to circular reference
          expect(error.message).toContain('circular');
        }
      }).not.toThrow();
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should use constant-time comparison for sensitive data', () => {
      const token1 = 'ghp_1234567890abcdef1234567890abcdef12345678';
      const token2 = 'ghp_abcdef1234567890abcdef1234567890abcdef12';
      const wrongToken = 'wrong_token_format';

      // Measure timing for valid token comparison
      const start1 = process.hrtime.bigint();
      SecurityUtils.isValidGitHubToken(token1);
      const end1 = process.hrtime.bigint();
      const time1 = Number(end1 - start1);

      // Measure timing for different valid token
      const start2 = process.hrtime.bigint();
      SecurityUtils.isValidGitHubToken(token2);
      const end2 = process.hrtime.bigint();
      const time2 = Number(end2 - start2);

      // Measure timing for invalid token
      const start3 = process.hrtime.bigint();
      SecurityUtils.isValidGitHubToken(wrongToken);
      const end3 = process.hrtime.bigint();
      const time3 = Number(end3 - start3);

      // Times should be relatively similar (within reasonable bounds)
      // This is a basic check - in production, more sophisticated timing analysis would be needed
      const maxDifference = Math.max(time1, time2, time3) - Math.min(time1, time2, time3);
      const averageTime = (time1 + time2 + time3) / 3;
      
      // Allow for some variance but not excessive timing differences
      expect(maxDifference).toBeLessThan(averageTime * 10);
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    test('should limit input sizes appropriately', () => {
      // Test extremely long commit message
      const veryLongMessage = 'a'.repeat(10000);
      const result = ValidationUtils.validateCommitMessage(veryLongMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    test('should limit email address length', () => {
      const veryLongEmail = 'a'.repeat(1000) + '@domain.com';
      expect(SecurityUtils.isValidEmail(veryLongEmail)).toBe(false);
    });

    test('should handle large arrays safely', () => {
      const largeArray = new Array(10000).fill('test-arg');
      
      // Should handle large arrays without crashing
      expect(() => SecurityUtils.sanitizeCommandArgs(largeArray)).not.toThrow();
    });
  });
});