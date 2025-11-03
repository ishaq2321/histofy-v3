/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * DataImporter - Comprehensive data import functionality
 */

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { createReadStream } = require('fs');
const moment = require('moment');
const ValidationUtils = require('./ValidationUtils');
const { ProgressUtils } = require('./progress');
const { ErrorHandler, ValidationError } = require('./errors');

class DataImporter {
  constructor() {
    this.supportedFormats = ['json', 'csv', 'yaml', 'xml'];
    this.validationRules = {
      commit: {
        required: ['message'],
        optional: ['date', 'time', 'author', 'email', 'hash'],
        validators: {
          message: (value) => typeof value === 'string' && value.trim().length > 0,
          date: (value) => !value || ValidationUtils.isValidDate(value),
          time: (value) => !value || ValidationUtils.isValidTime(value),
          email: (value) => !value || ValidationUtils.isValidEmail(value)
        }
      },
      operation: {
        required: ['type', 'description'],
        optional: ['command', 'args', 'timestamp', 'duration'],
        validators: {
          type: (value) => ['commit', 'migrate', 'config', 'batch'].includes(value),
          description: (value) => typeof value === 'string' && value.trim().length > 0
        }
      }
    };
  }

  /**
   * Import commit data from file
   * @param {string} inputFile - Input file path
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importCommitData(inputFile, options = {}) {
    const {
      format = null,
      validate = true,
      transform = true,
      dryRun = false,
      continueOnError = false
    } = options;

    const detectedFormat = format || this.detectFileFormat(inputFile);
    
    if (!this.supportedFormats.includes(detectedFormat)) {
      throw new Error(`Unsupported file format: ${detectedFormat}`);
    }

    const progress = ProgressUtils.spinner('Importing commit data...');
    progress.start();

    try {
      progress.update('Reading input file...');
      
      // Read and parse file
      const rawData = await this.readFile(inputFile, detectedFormat);
      
      progress.update('Parsing data...');
      
      // Extract commits from data
      const commits = this.extractCommitsFromData(rawData, detectedFormat);
      
      progress.update(`Processing ${commits.length} commits...`);
      
      // Validate data if requested
      let validationResult = { valid: true, errors: [], warnings: [] };
      if (validate) {
        validationResult = await this.validateCommitData(commits, { continueOnError });
      }

      // Transform data if requested
      let transformedCommits = commits;
      if (transform) {
        transformedCommits = await this.transformCommitData(commits, options);
      }

      progress.succeed(`Imported ${transformedCommits.length} commits`);

      return {
        success: true,
        format: detectedFormat,
        inputFile,
        totalCommits: transformedCommits.length,
        validCommits: validationResult.valid ? transformedCommits.length : validationResult.validCount,
        invalidCommits: validationResult.errors.length,
        commits: transformedCommits,
        validation: validationResult,
        dryRun
      };

    } catch (error) {
      progress.fail('Import failed');
      throw error;
    }
  }

  /**
   * Import operation history from file
   * @param {string} inputFile - Input file path
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importOperationHistory(inputFile, options = {}) {
    const {
      format = null,
      validate = true,
      merge = false,
      dryRun = false
    } = options;

    const detectedFormat = format || this.detectFileFormat(inputFile);
    
    const progress = ProgressUtils.spinner('Importing operation history...');
    progress.start();

    try {
      progress.update('Reading input file...');
      
      const rawData = await this.readFile(inputFile, detectedFormat);
      
      progress.update('Parsing operations...');
      
      const operations = this.extractOperationsFromData(rawData, detectedFormat);
      
      progress.update(`Processing ${operations.length} operations...`);
      
      // Validate operations if requested
      let validationResult = { valid: true, errors: [], warnings: [] };
      if (validate) {
        validationResult = await this.validateOperationData(operations);
      }

      if (!dryRun && validationResult.valid) {
        progress.update('Importing to operation history...');
        
        const OperationHistory = require('./OperationHistory');
        const operationHistory = new OperationHistory();
        
        if (merge) {
          // Merge with existing history
          for (const operation of operations) {
            await operationHistory.recordOperation(operation);
          }
        } else {
          // Replace existing history (with backup)
          await operationHistory.clearHistory({ keepBackups: true });
          for (const operation of operations) {
            await operationHistory.recordOperation(operation);
          }
        }
      }

      progress.succeed(`Imported ${operations.length} operations`);

      return {
        success: true,
        format: detectedFormat,
        inputFile,
        totalOperations: operations.length,
        validOperations: validationResult.validCount || operations.length,
        invalidOperations: validationResult.errors.length,
        operations,
        validation: validationResult,
        dryRun
      };

    } catch (error) {
      progress.fail('Import failed');
      throw error;
    }
  }

  /**
   * Import configuration from file
   * @param {string} inputFile - Input file path
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importConfiguration(inputFile, options = {}) {
    const {
      format = null,
      merge = true,
      backup = true,
      dryRun = false
    } = options;

    const detectedFormat = format || this.detectFileFormat(inputFile);
    
    const progress = ProgressUtils.spinner('Importing configuration...');
    progress.start();

    try {
      progress.update('Reading configuration file...');
      
      const configData = await this.readFile(inputFile, detectedFormat);
      
      progress.update('Validating configuration...');
      
      // Extract configuration from data
      const config = this.extractConfigFromData(configData, detectedFormat);
      
      // Validate configuration structure
      const validationResult = await this.validateConfigData(config);
      
      if (!validationResult.valid) {
        throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
      }

      if (!dryRun) {
        progress.update('Applying configuration...');
        
        const ConfigManager = require('../config/ConfigManager');
        const configManager = new ConfigManager();
        
        // Create backup if requested
        if (backup) {
          const backupFile = `${configManager.configFile}.backup.${Date.now()}`;
          try {
            const currentConfig = await configManager.loadConfig();
            await fs.writeFile(backupFile, JSON.stringify(currentConfig, null, 2));
          } catch (error) {
            // Ignore backup errors for new installations
          }
        }

        // Apply configuration
        if (merge) {
          // Merge with existing configuration
          const currentConfig = await configManager.loadConfig().catch(() => ({}));
          const mergedConfig = this.mergeConfigurations(currentConfig, config);
          await configManager.saveConfig(mergedConfig);
        } else {
          // Replace existing configuration
          await configManager.saveConfig(config);
        }
      }

      progress.succeed('Configuration imported successfully');

      return {
        success: true,
        format: detectedFormat,
        inputFile,
        configKeys: Object.keys(config).length,
        validation: validationResult,
        dryRun
      };

    } catch (error) {
      progress.fail('Import failed');
      throw error;
    }
  }

  /**
   * Detect file format from extension or content
   * @private
   */
  detectFileFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    const formatMap = {
      '.json': 'json',
      '.csv': 'csv',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml'
    };

    return formatMap[ext] || 'json';
  }

  /**
   * Read file based on format
   * @private
   */
  async readFile(filePath, format) {
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }

    switch (format.toLowerCase()) {
      case 'json':
        return await this.readJSONFile(filePath);
      
      case 'csv':
        return await this.readCSVFile(filePath);
      
      case 'yaml':
        return await this.readYAMLFile(filePath);
      
      case 'xml':
        return await this.readXMLFile(filePath);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Read JSON file
   * @private
   */
  async readJSONFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format in ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Read CSV file
   * @private
   */
  async readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(new Error(`CSV parsing error: ${error.message}`)));
    });
  }

  /**
   * Read YAML file
   * @private
   */
  async readYAMLFile(filePath) {
    try {
      const yaml = require('yaml');
      const content = await fs.readFile(filePath, 'utf8');
      return yaml.parse(content);
    } catch (error) {
      throw new Error(`YAML parsing error: ${error.message}`);
    }
  }

  /**
   * Read XML file
   * @private
   */
  async readXMLFile(filePath) {
    try {
      const xml2js = require('xml2js');
      const content = await fs.readFile(filePath, 'utf8');
      
      return new Promise((resolve, reject) => {
        xml2js.parseString(content, (err, result) => {
          if (err) {
            reject(new Error(`XML parsing error: ${err.message}`));
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      throw new Error(`XML processing error: ${error.message}`);
    }
  }

  /**
   * Extract commits from parsed data
   * @private
   */
  extractCommitsFromData(data, format) {
    if (format === 'csv') {
      // CSV data is already an array of objects
      return data;
    }

    // For JSON/YAML/XML, look for commits array
    if (data.commits && Array.isArray(data.commits)) {
      return data.commits;
    }

    // If data is directly an array, assume it's commits
    if (Array.isArray(data)) {
      return data;
    }

    // Single commit object
    if (data.message || data.hash) {
      return [data];
    }

    throw new Error('No commit data found in input file');
  }

  /**
   * Extract operations from parsed data
   * @private
   */
  extractOperationsFromData(data, format) {
    if (format === 'csv') {
      return data;
    }

    if (data.operations && Array.isArray(data.operations)) {
      return data.operations;
    }

    if (Array.isArray(data)) {
      return data;
    }

    if (data.type && data.description) {
      return [data];
    }

    throw new Error('No operation data found in input file');
  }

  /**
   * Extract configuration from parsed data
   * @private
   */
  extractConfigFromData(data, format) {
    if (data.configuration) {
      return data.configuration;
    }

    // Assume the entire data is configuration
    return data;
  }

  /**
   * Validate commit data
   * @private
   */
  async validateCommitData(commits, options = {}) {
    const { continueOnError = false } = options;
    const errors = [];
    const warnings = [];
    let validCount = 0;

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const commitErrors = [];

      // Check required fields
      for (const field of this.validationRules.commit.required) {
        if (!commit[field]) {
          commitErrors.push(`Missing required field: ${field}`);
        }
      }

      // Validate field values
      for (const [field, validator] of Object.entries(this.validationRules.commit.validators)) {
        if (commit[field] && !validator(commit[field])) {
          commitErrors.push(`Invalid ${field}: ${commit[field]}`);
        }
      }

      if (commitErrors.length > 0) {
        errors.push({
          index: i,
          commit: commit.message || commit.hash || `commit ${i}`,
          errors: commitErrors
        });

        if (!continueOnError) {
          break;
        }
      } else {
        validCount++;
      }
    }

    return {
      valid: errors.length === 0,
      validCount,
      invalidCount: errors.length,
      errors,
      warnings
    };
  }

  /**
   * Validate operation data
   * @private
   */
  async validateOperationData(operations) {
    const errors = [];
    const warnings = [];
    let validCount = 0;

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const operationErrors = [];

      // Check required fields
      for (const field of this.validationRules.operation.required) {
        if (!operation[field]) {
          operationErrors.push(`Missing required field: ${field}`);
        }
      }

      // Validate field values
      for (const [field, validator] of Object.entries(this.validationRules.operation.validators)) {
        if (operation[field] && !validator(operation[field])) {
          operationErrors.push(`Invalid ${field}: ${operation[field]}`);
        }
      }

      if (operationErrors.length > 0) {
        errors.push({
          index: i,
          operation: operation.description || operation.id || `operation ${i}`,
          errors: operationErrors
        });
      } else {
        validCount++;
      }
    }

    return {
      valid: errors.length === 0,
      validCount,
      invalidCount: errors.length,
      errors,
      warnings
    };
  }

  /**
   * Validate configuration data
   * @private
   */
  async validateConfigData(config) {
    const errors = [];
    const warnings = [];

    // Basic structure validation
    if (typeof config !== 'object' || config === null) {
      errors.push('Configuration must be an object');
      return { valid: false, errors, warnings };
    }

    // Validate known configuration sections
    const knownSections = ['git', 'github', 'ui', 'security'];
    const unknownSections = Object.keys(config).filter(key => 
      !knownSections.includes(key) && !key.startsWith('_')
    );

    if (unknownSections.length > 0) {
      warnings.push(`Unknown configuration sections: ${unknownSections.join(', ')}`);
    }

    // Validate git section
    if (config.git) {
      if (config.git.defaultTime && !ValidationUtils.isValidTime(config.git.defaultTime)) {
        errors.push('Invalid git.defaultTime format');
      }
    }

    // Validate github section
    if (config.github) {
      if (config.github.token && typeof config.github.token !== 'string') {
        errors.push('github.token must be a string');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Transform commit data
   * @private
   */
  async transformCommitData(commits, options = {}) {
    const {
      normalizeFields = true,
      validateDates = true,
      generateMissingFields = true
    } = options;

    return commits.map((commit, index) => {
      const transformed = { ...commit };

      if (normalizeFields) {
        // Normalize field names
        if (transformed.author_name && !transformed.author) {
          transformed.author = transformed.author_name;
        }
        if (transformed.author_email && !transformed.email) {
          transformed.email = transformed.author_email;
        }
      }

      if (validateDates && transformed.date) {
        // Ensure date is in ISO format
        const parsedDate = moment(transformed.date);
        if (parsedDate.isValid()) {
          transformed.date = parsedDate.toISOString();
        }
      }

      if (generateMissingFields) {
        // Generate missing fields
        if (!transformed.hash) {
          transformed.hash = `imported-${Date.now()}-${index}`;
        }
        if (!transformed.date) {
          transformed.date = new Date().toISOString();
        }
        if (!transformed.author) {
          transformed.author = 'Unknown Author';
        }
      }

      return transformed;
    });
  }

  /**
   * Merge configurations
   * @private
   */
  mergeConfigurations(current, imported) {
    const merged = { ...current };

    const mergeObject = (target, source) => {
      Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          mergeObject(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    };

    mergeObject(merged, imported);
    return merged;
  }

  /**
   * Get import statistics
   * @param {Object} result - Import result
   * @returns {Object} Statistics
   */
  getImportStatistics(result) {
    const stats = {
      totalRecords: result.totalCommits || result.totalOperations || 0,
      validRecords: result.validCommits || result.validOperations || 0,
      invalidRecords: result.invalidCommits || result.invalidOperations || 0,
      successRate: 0,
      format: result.format,
      fileSize: 0
    };

    if (stats.totalRecords > 0) {
      stats.successRate = Math.round((stats.validRecords / stats.totalRecords) * 100);
    }

    return stats;
  }
}

module.exports = DataImporter;