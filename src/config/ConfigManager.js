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
const crypto = require('crypto');
const SecurityUtils = require('../security/SecurityUtils');

class ConfigManager {
  constructor(customConfigDir = null) {
    this.configDir = customConfigDir || path.join(os.homedir(), '.histofy');
    this.configFile = path.join(this.configDir, 'config.yaml');
    this.keyFile = path.join(this.configDir, '.key');
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
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
   * Generate or load encryption key
   */
  async getEncryptionKey() {
    try {
      const keyExists = await this.fileExists(this.keyFile);
      
      if (keyExists) {
        const keyData = await fs.readFile(this.keyFile);
        return keyData;
      } else {
        // Generate new key
        const key = crypto.randomBytes(this.keyLength);
        await fs.writeFile(this.keyFile, key, { mode: 0o600 }); // Restrict permissions
        return key;
      }
    } catch (error) {
      throw new Error(`Failed to manage encryption key: ${error.message}`);
    }
  }

  /**
   * Encrypt sensitive configuration value
   */
  async encryptValue(value) {
    if (!value || typeof value !== 'string') {
      return value; // Don't encrypt non-string or empty values
    }

    try {
      const key = await this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('histofy-config'));

      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Return encrypted data with metadata
      return {
        _encrypted: true,
        data: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Failed to encrypt value: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive configuration value
   */
  async decryptValue(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'object' || !encryptedData._encrypted) {
      return encryptedData; // Return as-is if not encrypted
    }

    try {
      const key = await this.getEncryptionKey();
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('histofy-config'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt value: ${error.message}`);
    }
  }

  /**
   * Set encrypted configuration value for sensitive data
   */
  async setSecure(key, value) {
    try {
      const config = await this.loadConfig();
      const encryptedValue = await this.encryptValue(value);
      this.setNestedValue(config, key, encryptedValue);
      await this.saveConfig(config);
      return {
        success: true,
        key,
        encrypted: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get and decrypt secure configuration value
   */
  async getSecure(key) {
    try {
      const config = await this.loadConfig();
      const encryptedValue = this.getNestedValue(config, key);
      return await this.decryptValue(encryptedValue);
    } catch (error) {
      throw new Error(`Failed to get secure value: ${error.message}`);
    }
  }

  /**
   * Migrate existing plain-text sensitive values to encrypted format
   */
  async migrateToEncryption(sensitiveKeys = ['github.token']) {
    try {
      const config = await this.loadConfig();
      let migrated = false;

      for (const key of sensitiveKeys) {
        const value = this.getNestedValue(config, key);
        
        if (value && typeof value === 'string' && !value._encrypted) {
          const encryptedValue = await this.encryptValue(value);
          this.setNestedValue(config, key, encryptedValue);
          migrated = true;
        }
      }

      if (migrated) {
        await this.saveConfig(config);
        return {
          success: true,
          message: `Migrated ${sensitiveKeys.length} sensitive values to encrypted format`
        };
      } else {
        return {
          success: true,
          message: 'No migration needed - values already encrypted or empty'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate configuration structure and values
   */
  async validateConfig(config = null) {
    try {
      const configToValidate = config || await this.loadConfig();
      const errors = [];

      // Validate GitHub token if present
      const githubToken = await this.decryptValue(this.getNestedValue(configToValidate, 'github.token'));
      if (githubToken && !SecurityUtils.isValidGitHubToken(githubToken)) {
        errors.push('Invalid GitHub token format');
      }

      // Validate email if present
      const email = this.getNestedValue(configToValidate, 'git.defaultEmail');
      if (email && !SecurityUtils.isValidEmail(email)) {
        errors.push('Invalid email format in git.defaultEmail');
      }

      // Validate time format
      const time = this.getNestedValue(configToValidate, 'git.defaultTime');
      if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        errors.push('Invalid time format in git.defaultTime (expected HH:MM)');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Configuration validation failed: ${error.message}`]
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
      configFile: this.configFile
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
