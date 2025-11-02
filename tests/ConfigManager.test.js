/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const ConfigManager = require('../src/config/ConfigManager');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

describe('ConfigManager', () => {
  let configManager;
  let testConfigDir;

  beforeAll(() => {
    testConfigDir = path.join(os.tmpdir(), 'histofy-test-config');
    configManager = new ConfigManager(testConfigDir);
  });

  afterAll(() => {
    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('ensureConfigDir', () => {
    test('should create config directory if it does not exist', () => {
      configManager.ensureConfigDir();
      expect(fs.existsSync(testConfigDir)).toBe(true);
    });
  });

  describe('config operations', () => {
    beforeEach(() => {
      configManager.ensureConfigDir();
    });

    test('should set and get config values', () => {
      configManager.setSync('test.key', 'test-value');
      const value = configManager.getSync('test.key');
      expect(value).toBe('test-value');
    });

    test('should return default value for non-existent keys', () => {
      const value = configManager.getSync('non.existent.key', 'default');
      expect(value).toBe('default');
    });

    test('should return all config', () => {
      configManager.setSync('test.key1', 'value1');
      configManager.setSync('test.key2', 'value2');
      const config = configManager.getAllSync();
      expect(config.test.key1).toBe('value1');
      expect(config.test.key2).toBe('value2');
    });
  });

  describe('encryption functionality', () => {
    beforeEach(() => {
      configManager.ensureConfigDir();
    });

    test('should generate encryption key', async () => {
      const key = await configManager.getEncryptionKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // 256 bits
    });

    test('should reuse existing encryption key', async () => {
      const key1 = await configManager.getEncryptionKey();
      const key2 = await configManager.getEncryptionKey();
      expect(key1.equals(key2)).toBe(true);
    });

    test('should encrypt and decrypt values', async () => {
      const originalValue = 'sensitive-token-123';
      const encrypted = await configManager.encryptValue(originalValue);
      
      expect(encrypted).toHaveProperty('_encrypted', true);
      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      
      const decrypted = await configManager.decryptValue(encrypted);
      expect(decrypted).toBe(originalValue);
    });

    test('should not encrypt non-string values', async () => {
      const numberValue = 123;
      const booleanValue = true;
      const nullValue = null;
      
      expect(await configManager.encryptValue(numberValue)).toBe(numberValue);
      expect(await configManager.encryptValue(booleanValue)).toBe(booleanValue);
      expect(await configManager.encryptValue(nullValue)).toBe(nullValue);
    });

    test('should return non-encrypted values as-is when decrypting', async () => {
      const plainValue = 'plain-text';
      const decrypted = await configManager.decryptValue(plainValue);
      expect(decrypted).toBe(plainValue);
    });

    test('should set and get secure values', async () => {
      const sensitiveValue = 'ghp_1234567890abcdef1234567890abcdef12345678';
      
      const result = await configManager.setSecure('github.token', sensitiveValue);
      expect(result.success).toBe(true);
      expect(result.encrypted).toBe(true);
      
      const retrievedValue = await configManager.getSecure('github.token');
      expect(retrievedValue).toBe(sensitiveValue);
    });

    test('should migrate plain-text values to encrypted format', async () => {
      // Set up plain-text config
      const config = {
        github: {
          token: 'ghp_plaintext_token_123456789012345678901234'
        }
      };
      await configManager.saveConfig(config);
      
      // Migrate to encryption
      const result = await configManager.migrateToEncryption(['github.token']);
      expect(result.success).toBe(true);
      
      // Verify the value is now encrypted but can still be retrieved
      const retrievedValue = await configManager.getSecure('github.token');
      expect(retrievedValue).toBe('ghp_plaintext_token_123456789012345678901234');
    });

    test('should validate configuration', async () => {
      const validConfig = {
        github: {
          token: 'ghp_1234567890abcdef1234567890abcdef12345678'
        },
        git: {
          defaultEmail: 'test@example.com',
          defaultTime: '12:30'
        }
      };
      
      const result = await configManager.validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid configuration', async () => {
      const invalidConfig = {
        github: {
          token: 'invalid-token-format'
        },
        git: {
          defaultEmail: 'invalid-email',
          defaultTime: '25:70' // Invalid time
        }
      };
      
      const result = await configManager.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle encryption errors gracefully', async () => {
      // Mock crypto to throw error
      const originalCreateCipher = crypto.createCipher;
      crypto.createCipher = jest.fn(() => {
        throw new Error('Encryption failed');
      });
      
      await expect(configManager.encryptValue('test')).rejects.toThrow('Failed to encrypt value');
      
      // Restore original function
      crypto.createCipher = originalCreateCipher;
    });

    test('should handle decryption errors gracefully', async () => {
      const malformedEncryptedData = {
        _encrypted: true,
        data: 'invalid-data',
        iv: 'invalid-iv',
        tag: 'invalid-tag'
      };
      
      await expect(configManager.decryptValue(malformedEncryptedData)).rejects.toThrow('Failed to decrypt value');
    });
  });
});
