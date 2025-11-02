/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ConfigManager = require('../config/ConfigManager');
const { 
  EnhancedValidationUtils, 
  ErrorHandler, 
  ValidationError, 
  ConfigurationError,
  ProgressUtils 
} = require('../utils');
const DryRunManager = require('../utils/DryRunManager');
const OperationHistory = require('../utils/OperationHistory');

const configManager = new ConfigManager();

/**
 * Configuration command handlers
 */
const configCommand = {
  
  /**
   * Initialize configuration
   */
  async init() {
    console.log(chalk.blue('Initializing Histofy Configuration\n'));
    
    const progress = ProgressUtils.spinner('Setting up configuration...');
    progress.start();
    
    try {
      // Initialize config manager
      const result = await configManager.init();
      
      if (result.success) {
        progress.succeed('Configuration directory created');
        console.log(chalk.gray(`   Location: ${result.configDir}\n`));
        
        // Ask for basic configuration with enhanced validation
        const responses = await inquirer.prompt([
          {
            type: 'input',
            name: 'githubToken',
            message: 'GitHub Personal Access Token (optional):',
            validate: input => {
              if (!input.trim()) return true; // Optional field
              const validation = EnhancedValidationUtils.validateGitHubToken(input);
              return validation.isValid || validation.error;
            }
          },
          {
            type: 'input',
            name: 'githubUsername',
            message: 'GitHub Username (optional):',
            validate: input => {
              if (!input.trim()) return true; // Optional field
              // Basic username validation (GitHub allows alphanumeric, hyphens, max 39 chars)
              if (input.length > 39) return 'Username too long (max 39 characters)';
              if (!/^[a-zA-Z0-9-]+$/.test(input)) return 'Username can only contain letters, numbers, and hyphens';
              return true;
            }
          },
          {
            type: 'input',
            name: 'defaultAuthor',
            message: 'Default commit author name (optional):',
            validate: input => {
              if (!input.trim()) return true; // Optional field
              if (input.length < 2) return 'Author name too short (minimum 2 characters)';
              if (input.length > 100) return 'Author name too long (maximum 100 characters)';
              return true;
            }
          },
          {
            type: 'input',
            name: 'defaultEmail',
            message: 'Default commit author email (optional):',
            validate: input => {
              if (!input.trim()) return true; // Optional field
              const validation = EnhancedValidationUtils.validateEmail(input);
              return validation.isValid || validation.error;
            }
          },
          {
            type: 'input',
            name: 'defaultTime',
            message: 'Default commit time (HH:MM):',
            default: '12:00',
            validate: input => {
              const validation = EnhancedValidationUtils.validateTime(input);
              return validation.isValid || validation.error;
            }
          }
        ]);
        
        // Save configuration with validation
        const saveProgress = ProgressUtils.spinner('Saving configuration...');
        saveProgress.start();
        
        try {
          const config = await configManager.loadConfig();
          
          if (responses.githubToken) {
            config.github.token = responses.githubToken;
          }
          if (responses.githubUsername) {
            config.github.username = responses.githubUsername;
          }
          if (responses.defaultAuthor) {
            config.git.defaultAuthor = responses.defaultAuthor;
          }
          if (responses.defaultEmail) {
            config.git.defaultEmail = responses.defaultEmail;
          }
          if (responses.defaultTime) {
            config.git.defaultTime = responses.defaultTime;
          }
          
          await configManager.saveConfig(config);
          saveProgress.succeed('Configuration saved successfully');
          
          console.log(chalk.green('\nConfiguration saved successfully!'));
          console.log(chalk.gray('Run "histofy config list" to view all settings'));
          
        } catch (error) {
          saveProgress.fail('Failed to save configuration');
          const configError = new ConfigurationError(error.message, null, 'Check file permissions and disk space');
          console.log(ErrorHandler.handleConfigurationError(configError));
        }
        
      } else {
        progress.fail('Failed to initialize configuration');
        const configError = new ConfigurationError(result.error, null, 'Check file permissions and ensure the directory is writable');
        console.log(ErrorHandler.handleConfigurationError(configError));
      }
      
    } catch (error) {
      progress.fail('Configuration initialization failed');
      console.log(ErrorHandler.formatUserFriendlyError(error, { operation: 'configuration initialization' }));
    }
  },

  /**
   * Set a configuration value
   */
  async set(key, value, options = {}) {
    try {
      console.log(chalk.blue(`Setting configuration: ${key} = ${value}\n`));
      
      // Validate the configuration key and value
      const validationResult = this.validateConfigKeyValue(key, value);
      if (!validationResult.isValid) {
        console.log(ErrorHandler.handleValidationError(validationResult, 'configuration validation'));
        return;
      }

      // Handle dry-run mode
      if (options.dryRun) {
        console.log(chalk.cyan('\n🔍 DRY RUN MODE - No changes will be made\n'));
        
        const configData = {
          action: 'set',
          key,
          value: validationResult.value || value,
          sensitive: this.isSensitiveKey(key),
          configFile: configManager.configFile
        };

        const dryRun = DryRunManager.forConfigOperation(configData);
        const summary = dryRun.displayPreview({
          showDetails: true,
          showWarnings: true
        });

        console.log(chalk.blue('\n💡 To apply this configuration, run the same command without --dry-run'));
        
        return {
          success: true,
          dryRun: true,
          summary,
          message: 'Configuration dry-run completed successfully'
        };
      }
      
      const progress = ProgressUtils.spinner('Updating configuration...');
      progress.start();
      
      const result = await configManager.set(key, validationResult.value || value);
      
      if (result.success) {
        progress.succeed('Configuration updated successfully');
        console.log(chalk.gray(`   ${key}: ${validationResult.value || value}`));
        
        // Record operation in history
        try {
          const operationHistory = new OperationHistory();
          const previousValue = await configManager.get(key).catch(() => null);
          
          await operationHistory.recordOperation({
            type: 'config',
            command: 'config set',
            args: {
              key,
              value: this.isSensitiveKey(key) ? '[ENCRYPTED]' : (validationResult.value || value),
              sensitive: this.isSensitiveKey(key)
            },
            description: `Set configuration: ${key}`,
            result: {
              key,
              success: true,
              encrypted: result.encrypted || false
            },
            undoData: {
              key,
              previousValue: previousValue
            },
            duration: 1 // Config operations are typically fast
          });
        } catch (error) {
          // Don't fail the config operation if history recording fails
          console.log(chalk.yellow(`Warning: Failed to record operation in history: ${error.message}`));
        }
        
        // Show related information
        if (key === 'github.token') {
          console.log(chalk.yellow('\nTip: Test your GitHub connection with:'));
          console.log(chalk.gray('   histofy status --remote'));
        }
        
      } else {
        progress.fail('Failed to update configuration');
        const configError = new ConfigurationError(result.error, key, 'Check the configuration key and value format');
        console.log(ErrorHandler.handleConfigurationError(configError));
      }
      
    } catch (error) {
      console.log(ErrorHandler.formatUserFriendlyError(error, { 
        operation: 'setting configuration',
        configKey: key 
      }));
    }
  },

  /**
   * Check if a configuration key is sensitive
   * @private
   */
  isSensitiveKey(key) {
    const sensitiveKeys = ['github.token', 'password', 'secret', 'key', 'token'];
    return sensitiveKeys.some(sensitiveKey => 
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );
  },

  /**
   * Get a configuration value
   */
  async get(key) {
    try {
      // Validate the configuration key
      if (!key || typeof key !== 'string' || key.trim() === '') {
        const validationError = new ValidationError(
          'Configuration key is required',
          'config_key',
          'Please provide a valid configuration key (e.g., github.token, git.defaultTime)'
        );
        console.log(ErrorHandler.handleValidationError(validationError, 'configuration key validation'));
        return;
      }
      
      const progress = ProgressUtils.spinner('Retrieving configuration...');
      progress.start();
      
      const value = await configManager.get(key.trim());
      progress.stop();
      
      if (value !== undefined) {
        console.log(chalk.blue(`Configuration value for '${key}':`));
        
        // Mask sensitive values
        if (key.includes('token') && value) {
          const maskedValue = value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
          console.log(chalk.yellow(maskedValue));
        } else {
          console.log(chalk.yellow(value || 'Not set'));
        }
      } else {
        console.log(chalk.gray(`Configuration key '${key}' not found`));
        console.log(chalk.gray('Available keys: github.token, github.username, git.defaultAuthor, git.defaultEmail, git.defaultTime'));
      }
      
    } catch (error) {
      console.log(ErrorHandler.formatUserFriendlyError(error, { 
        operation: 'getting configuration',
        configKey: key 
      }));
    }
  },

  /**
   * List all configuration
   */
  async list() {
    const progress = ProgressUtils.spinner('Loading configuration...');
    progress.start();
    
    try {
      const config = await configManager.getAll();
      const paths = configManager.getPaths();
      progress.succeed('Configuration loaded');
      
      console.log(chalk.blue('Histofy Configuration\n'));
      
      // Ensure config has expected structure
      const githubConfig = config?.github || {};
      const gitConfig = config?.git || {};
      const uiConfig = config?.ui || {};
      
      // Display configuration in organized sections
      this.displayConfigSection('GitHub Settings', {
        'Token': this.maskSensitive(githubConfig.token),
        'Username': this.formatConfigValue(githubConfig.username),
        'Default Repository': this.formatConfigValue(githubConfig.defaultRepo)
      });
      
      this.displayConfigSection('Git Settings', {
        'Default Author': this.formatConfigValue(gitConfig.defaultAuthor),
        'Default Email': this.formatConfigValue(gitConfig.defaultEmail),
        'Default Time': gitConfig.defaultTime || '12:00'
      });
      
      this.displayConfigSection('UI Settings', {
        'Show Banner': uiConfig.showBanner !== false ? 'Yes' : 'No',
        'Color Output': uiConfig.colorOutput !== false ? 'Yes' : 'No',
        'Verbose Output': uiConfig.verboseOutput ? 'Yes' : 'No'
      });
      
      // Display file locations
      console.log(chalk.green('File Locations'));
      console.log(`   Config File: ${chalk.yellow(paths.configFile)}`);
      console.log();
      
    } catch (error) {
      progress.fail('Failed to load configuration');
      console.log(ErrorHandler.formatUserFriendlyError(error, { operation: 'listing configuration' }));
    }
  },

  /**
   * Helper: Display configuration section
   */
  displayConfigSection(title, items) {
    console.log(chalk.green(title));
    Object.entries(items).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log();
  },

  /**
   * Helper: Format configuration value for display
   */
  formatConfigValue(value) {
    if (value === null || value === undefined) {
      return chalk.gray('Not set');
    }
    
    if (typeof value === 'object') {
      // Handle empty objects or arrays
      if (Array.isArray(value) && value.length === 0) {
        return chalk.gray('Not set');
      }
      if (typeof value === 'object' && Object.keys(value).length === 0) {
        return chalk.gray('Not set');
      }
      // For non-empty objects, try to stringify
      try {
        return chalk.yellow(JSON.stringify(value));
      } catch {
        return chalk.gray('Not set');
      }
    }
    
    if (typeof value === 'string' && value.trim() === '') {
      return chalk.gray('Not set');
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return chalk.yellow(value.toString());
  },

  /**
   * Helper: Mask sensitive values
   */
  maskSensitive(value) {
    if (!value || typeof value !== 'string') return chalk.gray('Not set');
    if (value.length < 8) return chalk.yellow(value);
    
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    const middle = '*'.repeat(Math.max(0, value.length - 8));
    
    return chalk.yellow(start + middle + end);
  },

  /**
   * Helper: Validate configuration key and value
   */
  validateConfigKeyValue(key, value) {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      return {
        isValid: false,
        error: 'Configuration key is required',
        suggestion: 'Please provide a valid configuration key (e.g., github.token, git.defaultTime)'
      };
    }

    if (value === null || value === undefined) {
      return {
        isValid: false,
        error: 'Configuration value is required',
        suggestion: 'Please provide a value for the configuration key'
      };
    }

    const trimmedKey = key.trim();
    const trimmedValue = typeof value === 'string' ? value.trim() : value;

    // Validate specific configuration keys
    switch (trimmedKey) {
      case 'github.token':
        const tokenValidation = EnhancedValidationUtils.validateGitHubToken(trimmedValue);
        if (!tokenValidation.isValid) {
          return tokenValidation;
        }
        return { isValid: true, value: tokenValidation.value };

      case 'github.username':
        if (typeof trimmedValue !== 'string' || trimmedValue === '') {
          return {
            isValid: false,
            error: 'GitHub username must be a non-empty string',
            suggestion: 'Please provide a valid GitHub username'
          };
        }
        if (trimmedValue.length > 39) {
          return {
            isValid: false,
            error: 'GitHub username is too long',
            suggestion: 'GitHub usernames must be 39 characters or less'
          };
        }
        if (!/^[a-zA-Z0-9-]+$/.test(trimmedValue)) {
          return {
            isValid: false,
            error: 'Invalid GitHub username format',
            suggestion: 'GitHub usernames can only contain letters, numbers, and hyphens'
          };
        }
        return { isValid: true, value: trimmedValue };

      case 'git.defaultAuthor':
        if (typeof trimmedValue !== 'string' || trimmedValue === '') {
          return {
            isValid: false,
            error: 'Default author must be a non-empty string',
            suggestion: 'Please provide a valid author name'
          };
        }
        if (trimmedValue.length < 2) {
          return {
            isValid: false,
            error: 'Author name is too short',
            suggestion: 'Please provide an author name with at least 2 characters'
          };
        }
        return { isValid: true, value: trimmedValue };

      case 'git.defaultEmail':
        const emailValidation = EnhancedValidationUtils.validateEmail(trimmedValue);
        if (!emailValidation.isValid) {
          return emailValidation;
        }
        return { isValid: true, value: emailValidation.value };

      case 'git.defaultTime':
        const timeValidation = EnhancedValidationUtils.validateTime(trimmedValue);
        if (!timeValidation.isValid) {
          return timeValidation;
        }
        return { isValid: true, value: timeValidation.value };

      case 'ui.showBanner':
      case 'ui.colorOutput':
      case 'ui.verboseOutput':
        if (typeof trimmedValue === 'boolean') {
          return { isValid: true, value: trimmedValue };
        }
        if (typeof trimmedValue === 'string') {
          const lowerValue = trimmedValue.toLowerCase();
          if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1') {
            return { isValid: true, value: true };
          }
          if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === '0') {
            return { isValid: true, value: false };
          }
        }
        return {
          isValid: false,
          error: 'Boolean configuration value must be true/false, yes/no, or 1/0',
          suggestion: 'Please use true, false, yes, no, 1, or 0'
        };

      default:
        // For unknown keys, just validate that they're not empty
        if (typeof trimmedValue === 'string' && trimmedValue === '') {
          return {
            isValid: false,
            error: 'Configuration value cannot be empty',
            suggestion: 'Please provide a non-empty value'
          };
        }
        return { isValid: true, value: trimmedValue };
    }
  }
};

module.exports = configCommand;
