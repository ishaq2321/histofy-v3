/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * BatchCommitManager - Handles batch commit operations with templates and data import
 */

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { createReadStream } = require('fs');
const GitManager = require('../core/GitManager');
const OperationManager = require('../core/OperationManager');
const SecurityUtils = require('../security/SecurityUtils');
const ValidationUtils = require('./ValidationUtils');
const { ProgressUtils } = require('./progress');
const { ErrorHandler, ValidationError, FileSystemError } = require('./errors');

class BatchCommitManager {
  constructor() {
    this.gitManager = new GitManager();
    this.operationManager = OperationManager.getInstance();
    this.templates = new Map();
    this.supportedFormats = ['json', 'csv', 'yaml'];
  }

  /**
   * Load commit template from file or create from object
   * @param {string|Object} template - Template file path or template object
   * @returns {Object} Loaded template
   */
  async loadTemplate(template) {
    if (typeof template === 'object') {
      return this.validateTemplate(template);
    }

    try {
      const templatePath = SecurityUtils.validateFilePath(template);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      let templateData;
      if (templatePath.endsWith('.json')) {
        templateData = JSON.parse(templateContent);
      } else if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
        const yaml = require('yaml');
        templateData = yaml.parse(templateContent);
      } else {
        throw new ValidationError('Unsupported template format', 'template_format', 'Use JSON or YAML format');
      }

      return this.validateTemplate(templateData);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new FileSystemError(`Failed to load template: ${error.message}`, template, 'read');
    }
  }

  /**
   * Validate template structure
   * @param {Object} template - Template object to validate
   * @returns {Object} Validated template
   */
  validateTemplate(template) {
    const requiredFields = ['message'];
    const optionalFields = ['author', 'email', 'date', 'time', 'variables'];

    // Check required fields
    for (const field of requiredFields) {
      if (!template[field]) {
        throw new ValidationError(`Template missing required field: ${field}`, field, 'Add the required field to your template');
      }
    }

    // Validate message template
    if (typeof template.message !== 'string') {
      throw new ValidationError('Template message must be a string', 'message', 'Provide a valid message template');
    }

    // Validate variables if present
    if (template.variables) {
      if (!Array.isArray(template.variables)) {
        throw new ValidationError('Template variables must be an array', 'variables', 'Define variables as an array of objects');
      }

      template.variables.forEach((variable, index) => {
        if (!variable.name || typeof variable.name !== 'string') {
          throw new ValidationError(`Variable ${index} missing name`, `variables[${index}].name`, 'Each variable must have a name');
        }
        
        if (variable.type && !['string', 'number', 'date', 'boolean'].includes(variable.type)) {
          throw new ValidationError(`Invalid variable type: ${variable.type}`, `variables[${index}].type`, 'Use: string, number, date, or boolean');
        }
      });
    }

    return template;
  }

  /**
   * Process template with variable substitution
   * @param {Object} template - Template object
   * @param {Object} data - Data for variable substitution
   * @returns {Object} Processed commit data
   */
  processTemplate(template, data) {
    let message = template.message;
    
    // Replace variables in message
    if (template.variables) {
      template.variables.forEach(variable => {
        const value = data[variable.name];
        if (value !== undefined) {
          const placeholder = `{{${variable.name}}}`;
          message = message.replace(new RegExp(placeholder, 'g'), String(value));
        }
      });
    }

    // Replace built-in variables
    const builtInVars = {
      '{{date}}': data.date || new Date().toISOString().split('T')[0],
      '{{time}}': data.time || '12:00',
      '{{timestamp}}': new Date().toISOString(),
      '{{index}}': data.index || 0,
      '{{total}}': data.total || 1
    };

    Object.entries(builtInVars).forEach(([placeholder, value]) => {
      message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
    });

    return {
      message: SecurityUtils.sanitizeForDisplay(message),
      author: template.author || data.author,
      email: template.email || data.email,
      date: data.date || template.date || new Date().toISOString().split('T')[0],
      time: data.time || template.time || '12:00'
    };
  }

  /**
   * Import commit data from CSV file
   * @param {string} filePath - Path to CSV file
   * @param {Object} options - Import options
   * @returns {Promise<Array>} Array of commit data
   */
  async importFromCSV(filePath, options = {}) {
    const validatedPath = SecurityUtils.validateFilePath(filePath);
    const commits = [];
    
    return new Promise((resolve, reject) => {
      const stream = createReadStream(validatedPath)
        .pipe(csv({
          separator: options.separator || ',',
          headers: options.headers || true,
          skipEmptyLines: true
        }));

      stream.on('data', (row) => {
        try {
          // Validate and sanitize row data
          const sanitizedRow = {};
          Object.entries(row).forEach(([key, value]) => {
            const sanitizedKey = SecurityUtils.sanitizeForDisplay(key.trim());
            const sanitizedValue = SecurityUtils.sanitizeForDisplay(String(value).trim());
            sanitizedRow[sanitizedKey] = sanitizedValue;
          });

          commits.push(sanitizedRow);
        } catch (error) {
          reject(new ValidationError(`Invalid CSV row: ${error.message}`, 'csv_row', 'Check CSV format and data'));
        }
      });

      stream.on('end', () => {
        resolve(commits);
      });

      stream.on('error', (error) => {
        reject(new FileSystemError(`Failed to read CSV file: ${error.message}`, filePath, 'read'));
      });
    });
  }

  /**
   * Import commit data from JSON file
   * @param {string} filePath - Path to JSON file
   * @returns {Promise<Array>} Array of commit data
   */
  async importFromJSON(filePath) {
    try {
      const validatedPath = SecurityUtils.validateFilePath(filePath);
      const jsonContent = await fs.readFile(validatedPath, 'utf8');
      const data = JSON.parse(jsonContent);

      if (!Array.isArray(data)) {
        throw new ValidationError('JSON file must contain an array of commit data', 'json_format', 'Structure your JSON as an array of objects');
      }

      // Validate and sanitize each commit entry
      return data.map((commit, index) => {
        if (typeof commit !== 'object' || commit === null) {
          throw new ValidationError(`Invalid commit data at index ${index}`, `commits[${index}]`, 'Each commit must be an object');
        }

        const sanitizedCommit = {};
        Object.entries(commit).forEach(([key, value]) => {
          const sanitizedKey = SecurityUtils.sanitizeForDisplay(key);
          const sanitizedValue = typeof value === 'string' ? 
            SecurityUtils.sanitizeForDisplay(value) : value;
          sanitizedCommit[sanitizedKey] = sanitizedValue;
        });

        return sanitizedCommit;
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error instanceof SyntaxError) {
        throw new ValidationError('Invalid JSON format', 'json_syntax', 'Check JSON syntax and structure');
      }
      throw new FileSystemError(`Failed to read JSON file: ${error.message}`, filePath, 'read');
    }
  }

  /**
   * Execute batch commit operation
   * @param {Array} commitData - Array of commit data
   * @param {Object} template - Commit template (optional)
   * @param {Object} options - Batch options
   * @returns {Promise<Object>} Batch operation result
   */
  async executeBatchCommit(commitData, template = null, options = {}) {
    const operationId = this.operationManager.startOperation('batch-commit', `Batch commit of ${commitData.length} commits`);
    
    const {
      dryRun = false,
      continueOnError = false,
      maxConcurrent = 1,
      validateOnly = false
    } = options;

    try {
      // Validate all commit data first
      const validationResults = await this.validateBatchData(commitData, template);
      if (!validationResults.valid) {
        throw new ValidationError('Batch validation failed', 'batch_validation', 'Fix validation errors before proceeding');
      }

      if (validateOnly) {
        this.operationManager.completeOperation(operationId, {
          success: true,
          validated: true,
          totalCommits: commitData.length,
          validCommits: validationResults.validCount
        });
        return validationResults;
      }

      // Create multi-step progress for batch operation
      const steps = [
        { name: 'Preparation', description: 'Preparing batch commit operation' },
        { name: 'Processing', description: 'Processing commit data' },
        { name: 'Execution', description: 'Creating commits' },
        { name: 'Verification', description: 'Verifying results' }
      ];

      const multiProgress = ProgressUtils.multiStep(steps, {
        showProgress: true,
        showElapsed: true,
        showETA: true
      });

      multiProgress.start();

      // Step 1: Preparation
      multiProgress.startStep(0, 'Preparing batch operation...');
      
      const processedCommits = [];
      const errors = [];
      let successCount = 0;

      // Process each commit with template if provided
      for (let i = 0; i < commitData.length; i++) {
        try {
          const commit = commitData[i];
          const processedCommit = template ? 
            this.processTemplate(template, { ...commit, index: i, total: commitData.length }) :
            commit;

          // Validate processed commit
          const validation = this.validateCommitData(processedCommit);
          if (!validation.valid) {
            throw new ValidationError(validation.error, 'commit_validation', validation.suggestion);
          }

          processedCommits.push({
            ...processedCommit,
            originalIndex: i
          });
        } catch (error) {
          errors.push({
            index: i,
            error: error.message,
            data: commitData[i]
          });

          if (!continueOnError) {
            throw error;
          }
        }
      }

      multiProgress.completeStep(0, `Prepared ${processedCommits.length} commits`);

      // Step 2: Processing
      multiProgress.startStep(1, 'Processing commit data...');

      if (dryRun) {
        multiProgress.updateStepProgress(1, 100, 'Dry run - no commits created');
        multiProgress.completeStep(1, 'Dry run completed');
        multiProgress.skipStep(2, 'Skipped - dry run mode');
        multiProgress.skipStep(3, 'Skipped - dry run mode');

        const result = {
          success: true,
          dryRun: true,
          totalCommits: commitData.length,
          processedCommits: processedCommits.length,
          errors: errors.length,
          preview: processedCommits.slice(0, 5), // Show first 5 as preview
          validationErrors: errors
        };

        this.operationManager.completeOperation(operationId, result);
        return result;
      }

      multiProgress.completeStep(1, 'Processing completed');

      // Step 3: Execution
      multiProgress.startStep(2, 'Creating commits...');

      const results = [];
      
      // Execute commits (sequential for now, could be made concurrent)
      for (let i = 0; i < processedCommits.length; i++) {
        const commit = processedCommits[i];
        
        try {
          multiProgress.updateStepProgress(2, (i / processedCommits.length) * 100, 
            `Creating commit ${i + 1}/${processedCommits.length}: ${commit.message.substring(0, 50)}...`);

          const result = await this.gitManager.createCommit({
            message: commit.message,
            date: commit.date,
            time: commit.time,
            author: commit.author ? `${commit.author} <${commit.email || 'unknown@example.com'}>` : undefined
          });

          if (result.success) {
            results.push({
              index: commit.originalIndex,
              success: true,
              hash: result.hash,
              message: commit.message
            });
            successCount++;
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          const errorResult = {
            index: commit.originalIndex,
            success: false,
            error: error.message,
            message: commit.message
          };

          results.push(errorResult);
          errors.push(errorResult);

          if (!continueOnError) {
            throw error;
          }
        }

        // Small delay between commits to be respectful to Git
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      multiProgress.completeStep(2, `Created ${successCount} commits`);

      // Step 4: Verification
      multiProgress.startStep(3, 'Verifying results...');

      // Verify repository state
      const finalStatus = await this.gitManager.getStatus();
      
      multiProgress.completeStep(3, 'Verification completed');

      const finalResult = {
        success: errors.length === 0 || continueOnError,
        totalCommits: commitData.length,
        successfulCommits: successCount,
        failedCommits: errors.length,
        results,
        errors,
        repositoryStatus: finalStatus,
        duration: Date.now() - multiProgress.totalStartTime
      };

      this.operationManager.completeOperation(operationId, finalResult);
      return finalResult;

    } catch (error) {
      this.operationManager.failOperation(operationId, error);
      throw error;
    }
  }

  /**
   * Validate batch commit data
   * @param {Array} commitData - Array of commit data to validate
   * @param {Object} template - Template for validation context
   * @returns {Object} Validation results
   */
  async validateBatchData(commitData, template = null) {
    const results = {
      valid: true,
      validCount: 0,
      invalidCount: 0,
      errors: [],
      warnings: []
    };

    if (!Array.isArray(commitData)) {
      results.valid = false;
      results.errors.push({
        error: 'Commit data must be an array',
        suggestion: 'Provide an array of commit objects'
      });
      return results;
    }

    if (commitData.length === 0) {
      results.valid = false;
      results.errors.push({
        error: 'No commit data provided',
        suggestion: 'Provide at least one commit to process'
      });
      return results;
    }

    if (commitData.length > 1000) {
      results.warnings.push({
        warning: 'Large batch size detected',
        suggestion: 'Consider processing in smaller batches for better performance'
      });
    }

    // Validate each commit
    for (let i = 0; i < commitData.length; i++) {
      const commit = commitData[i];
      
      try {
        const processedCommit = template ? 
          this.processTemplate(template, { ...commit, index: i, total: commitData.length }) :
          commit;

        const validation = this.validateCommitData(processedCommit);
        
        if (validation.valid) {
          results.validCount++;
        } else {
          results.invalidCount++;
          results.errors.push({
            index: i,
            error: validation.error,
            suggestion: validation.suggestion,
            data: commit
          });
        }
      } catch (error) {
        results.invalidCount++;
        results.errors.push({
          index: i,
          error: error.message,
          data: commit
        });
      }
    }

    if (results.invalidCount > 0) {
      results.valid = false;
    }

    return results;
  }

  /**
   * Validate individual commit data
   * @param {Object} commit - Commit data to validate
   * @returns {Object} Validation result
   */
  validateCommitData(commit) {
    // Validate message
    const messageValidation = ValidationUtils.validateCommitMessage(commit.message);
    if (!messageValidation.valid) {
      return messageValidation;
    }

    // Validate date if provided
    if (commit.date) {
      const dateValidation = ValidationUtils.validateDate(commit.date);
      if (!dateValidation.valid) {
        return dateValidation;
      }
    }

    // Validate time if provided
    if (commit.time) {
      const timeValidation = ValidationUtils.validateTime(commit.time);
      if (!timeValidation.valid) {
        return timeValidation;
      }
    }

    // Validate email if provided
    if (commit.email && !SecurityUtils.isValidEmail(commit.email)) {
      return {
        valid: false,
        error: 'Invalid email format',
        suggestion: 'Provide a valid email address'
      };
    }

    return { valid: true };
  }

  /**
   * Export commit data to various formats
   * @param {Array} commits - Commit data to export
   * @param {string} format - Export format (json, csv, yaml)
   * @param {string} outputPath - Output file path
   * @returns {Promise<Object>} Export result
   */
  async exportCommitData(commits, format, outputPath) {
    try {
      const validatedPath = SecurityUtils.validateFilePath(outputPath);
      let content;

      switch (format.toLowerCase()) {
        case 'json':
          content = JSON.stringify(commits, null, 2);
          break;
          
        case 'csv':
          if (commits.length === 0) {
            content = '';
          } else {
            const headers = Object.keys(commits[0]);
            const csvRows = [headers.join(',')];
            
            commits.forEach(commit => {
              const row = headers.map(header => {
                const value = commit[header] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
              });
              csvRows.push(row.join(','));
            });
            
            content = csvRows.join('\n');
          }
          break;
          
        case 'yaml':
          const yaml = require('yaml');
          content = yaml.stringify(commits);
          break;
          
        default:
          throw new ValidationError(`Unsupported export format: ${format}`, 'export_format', 'Use json, csv, or yaml');
      }

      await fs.writeFile(validatedPath, content, 'utf8');

      return {
        success: true,
        format,
        outputPath: validatedPath,
        recordCount: commits.length,
        fileSize: Buffer.byteLength(content, 'utf8')
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new FileSystemError(`Failed to export data: ${error.message}`, outputPath, 'write');
    }
  }

  /**
   * Create a commit template
   * @param {Object} templateData - Template configuration
   * @param {string} outputPath - Path to save template
   * @returns {Promise<Object>} Template creation result
   */
  async createTemplate(templateData, outputPath) {
    try {
      const validatedTemplate = this.validateTemplate(templateData);
      const validatedPath = SecurityUtils.validateFilePath(outputPath);
      
      const templateContent = JSON.stringify(validatedTemplate, null, 2);
      await fs.writeFile(validatedPath, templateContent, 'utf8');

      return {
        success: true,
        templatePath: validatedPath,
        template: validatedTemplate
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new FileSystemError(`Failed to create template: ${error.message}`, outputPath, 'write');
    }
  }
}

module.exports = BatchCommitManager;