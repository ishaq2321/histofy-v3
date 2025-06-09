/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const yaml = require('yaml');

class ConfigManager {
  constructor(customConfigDir = null) {
    this.configDir = customConfigDir || path.join(os.homedir(), '.histofy');
    this.configFile = path.join(this.configDir, 'config.yaml');
    this.patternsDir = path.join(this.configDir, 'patterns');
    this.defaultConfig = {
      github: {
        token: null,
        username: null,
        defaultRepo: null
      },
      git: {
        defaultAuthor: null,
        defaultEmail: null,
        defaultTime: '12:00'
      },
      ui: {
        showBanner: true,
        colorOutput: true,
        verboseOutput: false
      },
      patterns: {
        directory: this.patternsDir
      }
    };
  }

  /**
   * Initialize configuration directory and files
   */
  async init() {
    try {
      // Create config directory if it doesn't exist
      await fs.mkdir(this.configDir, { recursive: true });
      await fs.mkdir(this.patternsDir, { recursive: true });

      // Create default config if it doesn't exist
      const configExists = await this.fileExists(this.configFile);
      if (!configExists) {
        await this.saveConfig(this.defaultConfig);
      }

      return {
        success: true,
        configDir: this.configDir,
        message: 'Configuration initialized successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    try {
      const configExists = await this.fileExists(this.configFile);
      if (!configExists) {
        await this.init();
        return this.defaultConfig;
      }

      const configData = await fs.readFile(this.configFile, 'utf8');
      const config = yaml.parse(configData);
      
      // Merge with default config to ensure all keys exist
      return this.mergeConfig(this.defaultConfig, config);
    } catch (error) {
      console.warn(`Warning: Could not load config, using defaults: ${error.message}`);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config) {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      const yamlData = yaml.stringify(config, { indent: 2 });
      await fs.writeFile(this.configFile, yamlData, 'utf8');
      return true;
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Get a configuration value
   */
  async get(key) {
    const config = await this.loadConfig();
    return this.getNestedValue(config, key);
  }

  /**
   * Set a configuration value
   */
  async set(key, value) {
    try {
      const config = await this.loadConfig();
      this.setNestedValue(config, key, value);
      await this.saveConfig(config);
      return {
        success: true,
        key,
        value
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all configuration
   */
  async getAll() {
    return await this.loadConfig();
  }

  /**
   * Save a pattern
   */
  async savePattern(name, pattern) {
    try {
      await fs.mkdir(this.patternsDir, { recursive: true });
      const patternFile = path.join(this.patternsDir, `${name}.yaml`);
      const yamlData = yaml.stringify(pattern, { indent: 2 });
      await fs.writeFile(patternFile, yamlData, 'utf8');
      return {
        success: true,
        name,
        file: patternFile
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load a pattern
   */
  async loadPattern(name) {
    try {
      const patternFile = path.join(this.patternsDir, `${name}.yaml`);
      const patternData = await fs.readFile(patternFile, 'utf8');
      const pattern = yaml.parse(patternData);
      return {
        success: true,
        name,
        pattern
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all patterns
   */
  async listPatterns() {
    try {
      const files = await fs.readdir(this.patternsDir);
      const patterns = files
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.basename(file, path.extname(file)));
      
      return {
        success: true,
        patterns
      };
    } catch (error) {
      return {
        success: true,
        patterns: [] // Empty list if directory doesn't exist
      };
    }
  }

  /**
   * Delete a pattern
   */
  async deletePattern(name) {
    try {
      const patternFile = path.join(this.patternsDir, `${name}.yaml`);
      await fs.unlink(patternFile);
      return {
        success: true,
        name
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Merge configurations
   */
  mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        merged[key] = this.mergeConfig(merged[key] || {}, userConfig[key]);
      } else {
        merged[key] = userConfig[key];
      }
    }
    
    return merged;
  }

  /**
   * Helper: Get nested configuration value
   */
  getNestedValue(obj, key) {
    return key.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : undefined;
    }, obj);
  }

  /**
   * Helper: Set nested configuration value
   */
  setNestedValue(obj, key, value) {
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
   * Get configuration file paths
   */
  getPaths() {
    return {
      configDir: this.configDir,
      configFile: this.configFile,
      patternsDir: this.patternsDir
    };
  }

  /**
   * Synchronous version of directory creation for testing
   */
  ensureConfigDir() {
    const fs = require('fs');
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    if (!fs.existsSync(this.patternsDir)) {
      fs.mkdirSync(this.patternsDir, { recursive: true });
    }
  }

  /**
   * Synchronous config storage for testing (in-memory)
   */
  _testConfig = {};

  /**
   * Synchronous set method for testing
   */
  setSync(key, value) {
    this.setNestedValue(this._testConfig, key, value);
  }

  /**
   * Synchronous get method for testing
   */
  getSync(key, defaultValue = null) {
    const value = this.getNestedValue(this._testConfig, key);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Synchronous getAll method for testing
   */
  getAllSync() {
    return { ...this._testConfig };
  }
}

module.exports = ConfigManager;
