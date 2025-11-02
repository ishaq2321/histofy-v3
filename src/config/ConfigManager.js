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
const ConfigValidator = require('./ConfigValidator');

class ConfigManager {
  constructor(customConfigDir = null) {
    this.configDir = customConfigDir || path.join(os.homedir(), '.histofy');
    this.configFile = path.join(this.configDir, 'config.yaml');
    this.backupDir = path.join(this.configDir, 'backups');
    this.keyFile = path.join(this.configDir, '.key');
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.validator = new ConfigValidator();
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
   * Validate configuration structure and values using ConfigValidator
   */
  async validateConfig(config = null) {
    try {
      const configToValidate = config || await this.loadConfig();
      
      // Decrypt sensitive values for validation
      const decryptedConfig = await this.decryptConfigForValidation(configToValidate);
      
      // Use ConfigValidator for comprehensive validation
      const result = this.validator.validate(decryptedConfig);
      
      return {
        valid: result.valid,
        errors: result.errors.map(e => e.error),
        warnings: result.warnings.map(w => w.error),
        details: result
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Configuration validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Create backup of current configuration
   */
  async createBackup(reason = 'manual') {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `config-${timestamp}.yaml`);
      const metadataFile = path.join(this.backupDir, `config-${timestamp}.meta.json`);
      
      // Copy current config file
      const configExists = await this.fileExists(this.configFile);
      if (configExists) {
        await fs.copyFile(this.configFile, backupFile);
        
        // Create metadata
        const metadata = {
          timestamp: new Date().toISOString(),
          reason,
          originalFile: this.configFile,
          backupFile,
          version: '3.0.0'
        };
        
        await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
        
        return {
          success: true,
          backupFile,
          metadataFile,
          timestamp
        };
      } else {
        return {
          success: false,
          error: 'No configuration file to backup'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to create backup: ${error.message}`
      };
    }
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(backupFile) {
    try {
      const backupExists = await this.fileExists(backupFile);
      if (!backupExists) {
        return {
          success: false,
          error: 'Backup file does not exist'
        };
      }

      // Create backup of current config before restore
      await this.createBackup('pre-restore');

      // Restore from backup
      await fs.copyFile(backupFile, this.configFile);

      // Validate restored configuration
      const validation = await this.validateConfig();
      if (!validation.valid) {
        return {
          success: false,
          error: 'Restored configuration is invalid',
          validationErrors: validation.errors
        };
      }

      return {
        success: true,
        message: 'Configuration restored successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore from backup: ${error.message}`
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const backupDirExists = await this.fileExists(this.backupDir);
      if (!backupDirExists) {
        return {
          success: true,
          backups: []
        };
      }

      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.meta.json')) {
          try {
            const metadataPath = path.join(this.backupDir, file);
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            const backupFileExists = await this.fileExists(metadata.backupFile);
            if (backupFileExists) {
              const stats = await fs.stat(metadata.backupFile);
              backups.push({
                ...metadata,
                size: stats.size,
                exists: true
              });
            }
          } catch (error) {
            // Skip invalid metadata files
            continue;
          }
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return {
        success: true,
        backups
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list backups: ${error.message}`
      };
    }
  }

  /**
   * Clean old backups (keep last N backups)
   */
  async cleanupBackups(keepCount = 10) {
    try {
      const backupList = await this.listBackups();
      if (!backupList.success) {
        return backupList;
      }

      const backupsToDelete = backupList.backups.slice(keepCount);
      let deletedCount = 0;

      for (const backup of backupsToDelete) {
        try {
          await fs.unlink(backup.backupFile);
          await fs.unlink(backup.metadataFile);
          deletedCount++;
        } catch (error) {
          // Continue with other backups if one fails
          continue;
        }
      }

      return {
        success: true,
        deletedCount,
        remainingCount: backupList.backups.length - deletedCount
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup backups: ${error.message}`
      };
    }
  }

  /**
   * Detect and recover from corrupted configuration
   */
  async detectAndRecoverCorruption() {
    try {
      const configExists = await this.fileExists(this.configFile);
      if (!configExists) {
        return {
          corrupted: false,
          recovered: false,
          message: 'No configuration file exists'
        };
      }

      // Try to load and parse configuration
      let isCorrupted = false;
      let corruptionReason = '';

      try {
        const configData = await fs.readFile(this.configFile, 'utf8');
        
        // Check for empty file
        if (configData.trim() === '') {
          isCorrupted = true;
          corruptionReason = 'Configuration file is empty';
        } else {
          // Try to parse YAML
          const parsedConfig = yaml.parse(configData);
          
          // Validate parsed configuration
          const validation = await this.validateConfig(parsedConfig);
          if (!validation.valid && validation.errors.some(e => e.includes('parsing') || e.includes('syntax'))) {
            isCorrupted = true;
            corruptionReason = 'Configuration file has syntax errors';
          }
        }
      } catch (error) {
        isCorrupted = true;
        corruptionReason = `Configuration file parsing failed: ${error.message}`;
      }

      if (!isCorrupted) {
        return {
          corrupted: false,
          recovered: false,
          message: 'Configuration file is valid'
        };
      }

      // Attempt recovery from backup
      const backupList = await this.listBackups();
      if (backupList.success && backupList.backups.length > 0) {
        const latestBackup = backupList.backups[0];
        const restoreResult = await this.restoreFromBackup(latestBackup.backupFile);
        
        if (restoreResult.success) {
          return {
            corrupted: true,
            recovered: true,
            corruptionReason,
            recoveryMethod: 'backup',
            backupUsed: latestBackup.timestamp
          };
        }
      }

      // If no backup available, create default configuration
      await this.saveConfig(this.defaultConfig);
      
      return {
        corrupted: true,
        recovered: true,
        corruptionReason,
        recoveryMethod: 'default',
        message: 'Restored to default configuration'
      };

    } catch (error) {
      return {
        corrupted: true,
        recovered: false,
        error: `Recovery failed: ${error.message}`
      };
    }
  }

  /**
   * Migrate configuration to new version
   */
  async migrateConfiguration(fromVersion = null) {
    try {
      // Create backup before migration
      const backupResult = await this.createBackup('pre-migration');
      if (!backupResult.success) {
        return {
          success: false,
          error: 'Failed to create backup before migration'
        };
      }

      const currentConfig = await this.loadConfig();
      
      // Auto-detect version if not provided
      const detectedVersion = fromVersion || this.detectConfigVersion(currentConfig);
      
      // Use ConfigValidator for migration
      const migrationResult = this.validator.migrate(currentConfig, detectedVersion, '3.0.0');
      
      if (!migrationResult.success) {
        return {
          success: false,
          error: 'Migration failed',
          details: migrationResult.errors
        };
      }

      // Save migrated configuration
      await this.saveConfig(migrationResult.migrated);

      return {
        success: true,
        fromVersion: detectedVersion,
        toVersion: '3.0.0',
        changes: migrationResult.changes,
        backupFile: backupResult.backupFile
      };

    } catch (error) {
      return {
        success: false,
        error: `Migration failed: ${error.message}`
      };
    }
  }

  /**
   * Decrypt configuration values for validation (without modifying original)
   * @private
   */
  async decryptConfigForValidation(config) {
    const decrypted = JSON.parse(JSON.stringify(config));
    
    // Decrypt sensitive values
    if (decrypted.github?.token) {
      try {
        decrypted.github.token = await this.decryptValue(decrypted.github.token);
      } catch (error) {
        // If decryption fails, leave as-is for validation
      }
    }

    return decrypted;
  }

  /**
   * Detect configuration version based on structure
   * @private
   */
  detectConfigVersion(config) {
    // V3 has nested structure with github, git, ui sections
    if (config.github || config.git || config.ui) {
      return '3.0.0';
    }
    
    // V2 has some nested structure but different property names
    if (config.ui?.colors !== undefined || config.ui?.verbose !== undefined) {
      return '2.0.0';
    }
    
    // V1 has flat structure with token, author properties
    if (config.token || config.author) {
      return '1.0.0';
    }
    
    // Default to current version for empty/unknown configs
    return '3.0.0';
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
