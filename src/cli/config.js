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

const configManager = new ConfigManager();

/**
 * Configuration command handlers
 */
const configCommand = {
  
  /**
   * Initialize configuration
   */
  async init() {
    console.log(chalk.blue('🔧 Initializing Histofy Configuration\n'));
    
    try {
      // Initialize config manager
      const result = await configManager.init();
      
      if (result.success) {
        console.log(chalk.green('✅ Configuration directory created'));
        console.log(chalk.gray(`   Location: ${result.configDir}\n`));
        
        // Ask for basic configuration
        const responses = await inquirer.prompt([
          {
            type: 'input',
            name: 'githubToken',
            message: 'GitHub Personal Access Token (optional):',
            validate: input => !input || input.length >= 20 || 'Token seems too short'
          },
          {
            type: 'input',
            name: 'githubUsername',
            message: 'GitHub Username (optional):'
          },
          {
            type: 'input',
            name: 'defaultAuthor',
            message: 'Default commit author name (optional):'
          },
          {
            type: 'input',
            name: 'defaultEmail',
            message: 'Default commit author email (optional):'
          },
          {
            type: 'input',
            name: 'defaultTime',
            message: 'Default commit time (HH:MM):',
            default: '12:00',
            validate: input => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input) || 'Invalid time format'
          }
        ]);
        
        // Save configuration
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
        
        console.log(chalk.green('\n✅ Configuration saved successfully!'));
        console.log(chalk.gray('Run "histofy config list" to view all settings'));
        
      } else {
        console.error(chalk.red(`❌ Failed to initialize: ${result.error}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * Set a configuration value
   */
  async set(key, value) {
    try {
      console.log(chalk.blue(`🔧 Setting configuration: ${key} = ${value}\n`));
      
      const result = await configManager.set(key, value);
      
      if (result.success) {
        console.log(chalk.green('✅ Configuration updated successfully'));
        console.log(chalk.gray(`   ${key}: ${value}`));
        
        // Show related information
        if (key === 'github.token') {
          console.log(chalk.yellow('\n💡 Tip: Test your GitHub connection with:'));
          console.log(chalk.gray('   histofy status --remote'));
        }
        
      } else {
        console.error(chalk.red(`❌ Failed to set configuration: ${result.error}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * Get a configuration value
   */
  async get(key) {
    try {
      const value = await configManager.get(key);
      
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
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * List all configuration
   */
  async list() {
    try {
      console.log(chalk.blue('🔧 Histofy Configuration\n'));
      
      const config = await configManager.getAll();
      const paths = configManager.getPaths();
      
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
        'Show Banner': uiConfig.showBanner ? 'Yes' : 'No',
        'Color Output': uiConfig.colorOutput ? 'Yes' : 'No',
        'Verbose Output': uiConfig.verboseOutput ? 'Yes' : 'No'
      });
      
      // Display file locations
      console.log(chalk.green('📁 File Locations'));
      console.log(`   Config File: ${chalk.yellow(paths.configFile)}`);
      console.log(`   Patterns Directory: ${chalk.yellow(paths.patternsDir)}`);
      console.log();
      
      // Display available patterns
      const patterns = await configManager.listPatterns();
      if (patterns.success && patterns.patterns.length > 0) {
        console.log(chalk.green('🎨 Available Patterns'));
        patterns.patterns.forEach(pattern => {
          console.log(`   • ${pattern}`);
        });
        console.log();
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
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
  }
};

module.exports = configCommand;
