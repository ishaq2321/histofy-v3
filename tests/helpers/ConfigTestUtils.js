/**
 * Histofy v3 - Test utilities for ConfigManager
 *
 * These are synchronous test-only helper functions that were moved
 * from the production ConfigManager class to keep test utilities
 * separate from production code.
 */

const fs = require('fs');

/**
 * Helper: Get nested configuration value
 */
function getNestedValue(obj, key) {
  return key.split('.').reduce((current, prop) => {
    return current && current[prop] !== undefined ? current[prop] : undefined;
  }, obj);
}

/**
 * Helper: Set nested configuration value
 */
function setNestedValue(obj, key, value) {
  const keys = key.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, prop) => {
    if (current[prop] === undefined) {
      current[prop] = {};
    }
    return current[prop];
  }, obj);
  target[lastKey] = value;
}

/**
 * Synchronous version of directory creation for testing
 *
 * @param {ConfigManager} configManager - The ConfigManager instance
 */
function ensureConfigDirSync(configManager) {
  if (!fs.existsSync(configManager.configDir)) {
    fs.mkdirSync(configManager.configDir, { recursive: true });
  }
  if (!fs.existsSync(configManager.patternsDir)) {
    fs.mkdirSync(configManager.patternsDir, { recursive: true });
  }
}

/**
 * Synchronous set method for testing (in-memory)
 *
 * @param {ConfigManager} configManager - The ConfigManager instance
 * @param {string} key - The configuration key (dot-notation supported)
 * @param {*} value - The value to set
 */
function setConfigSync(configManager, key, value) {
  if (!configManager._testConfig) {
    configManager._testConfig = {};
  }
  setNestedValue(configManager._testConfig, key, value);
}

/**
 * Synchronous get method for testing (in-memory)
 *
 * @param {ConfigManager} configManager - The ConfigManager instance
 * @param {string} key - The configuration key (dot-notation supported)
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} The configuration value or default value
 */
function getConfigSync(configManager, key, defaultValue = null) {
  if (!configManager._testConfig) {
    configManager._testConfig = {};
  }
  const value = getNestedValue(configManager._testConfig, key);
  return value !== undefined ? value : defaultValue;
}

/**
 * Synchronous getAll method for testing (in-memory)
 *
 * @param {ConfigManager} configManager - The ConfigManager instance
 * @returns {Object} All configuration values
 */
function getAllConfigSync(configManager) {
  if (!configManager._testConfig) {
    configManager._testConfig = {};
  }
  return { ...configManager._testConfig };
}

module.exports = {
  ensureConfigDirSync,
  setConfigSync,
  getConfigSync,
  getAllConfigSync
};
