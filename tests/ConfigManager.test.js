/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const ConfigManager = require('../src/config/ConfigManager');
const { ensureConfigDirSync, setConfigSync, getConfigSync, getAllConfigSync } = require('./helpers/ConfigTestUtils');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
      ensureConfigDirSync(configManager);
      expect(fs.existsSync(testConfigDir)).toBe(true);
    });
  });

  describe('config operations', () => {
    beforeEach(() => {
      ensureConfigDirSync(configManager);
    });

    test('should set and get config values', () => {
      setConfigSync(configManager, 'test.key', 'test-value');
      const value = getConfigSync(configManager, 'test.key');
      expect(value).toBe('test-value');
    });

    test('should return default value for non-existent keys', () => {
      const value = getConfigSync(configManager, 'non.existent.key', 'default');
      expect(value).toBe('default');
    });

    test('should return all config', () => {
      setConfigSync(configManager, 'test.key1', 'value1');
      setConfigSync(configManager, 'test.key2', 'value2');
      const config = getAllConfigSync(configManager);
      expect(config.test.key1).toBe('value1');
      expect(config.test.key2).toBe('value2');
    });
  });
});
