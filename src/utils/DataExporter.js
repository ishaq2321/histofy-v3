/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * DataExporter - Comprehensive data export functionality
 */

const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const GitManager = require('../core/GitManager');
const OperationHistory = require('./OperationHistory');
const { ProgressUtils } = require('./progress');

class DataExporter {
  constructor() {
    this.supportedFormats = ['json', 'csv', 'xml', 'yaml'];
    this.gitManager = new GitManager();
    this.operationHistory = new OperationHistory();
  }

  /**
   * Export commit data from repository
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportCommitData(options = {}) {
    const {
      outputFile,
      format = 'json',
      since = null,
      until = null,
      author = null,
      branch = null,
      limit = 1000,
      includeFiles = false,
      includeDiffs = false,
      includeStats = true
    } = options;

    if (!this.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported export format: ${format}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }

    const progress = ProgressUtils.spinner('Exporting commit data...');
    progress.start();

    try {
      progress.update('Fetching commit history...');
      
      // Get commit history
      const commits = await this.gitManager.getCommitHistory({
        since,
        until,
        author,
        branch,
        limit,
        includeFiles,
        includeDiffs
      });

      progress.update(`Processing ${commits.length} commits...`);

      // Prepare export data
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'Histofy v3',
          version: '1.0.0',
          repository: await this.getRepositoryInfo(),
          filters: {
            since,
            until,
            author,
            branch,
            limit
          },
          totalCommits: commits.length
        },
        commits: commits.map(commit => this.transformCommitForExport(commit, {
          includeFiles,
          includeDiffs
        }))
      };

      // Add statistics if requested
      if (includeStats) {
        progress.update('Calculating statistics...');
        exportData.statistics = await this.calculateCommitStatistics(commits);
      }

      progress.update('Writing export file...');

      // Convert to requested format and write
      const content = await this.convertToFormat(exportData, format);
      await this.writeExportFile(outputFile, content, format);

      progress.succeed(`Exported ${commits.length} commits to ${outputFile}`);

      return {
        success: true,
        format,
        outputFile,
        totalCommits: commits.length,
        fileSize: (await fs.stat(outputFile)).size,
        metadata: exportData.metadata
      };

    } catch (error) {
      progress.fail('Export failed');
      throw error;
    }
  }

  /**
   * Export operation history
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportOperationHistory(options = {}) {
    const {
      outputFile,
      format = 'json',
      since = null,
      until = null,
      type = null,
      limit = 100,
      includeBackups = false
    } = options;

    const progress = ProgressUtils.spinner('Exporting operation history...');
    progress.start();

    try {
      progress.update('Fetching operation history...');

      const operations = await this.operationHistory.getHistory({
        since,
        until,
        type,
        limit
      });

      progress.update(`Processing ${operations.length} operations...`);

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'Histofy v3',
          version: '1.0.0',
          filters: { since, until, type, limit },
          totalOperations: operations.length
        },
        operations: operations.map(op => this.transformOperationForExport(op, {
          includeBackups
        }))
      };

      progress.update('Writing export file...');

      const content = await this.convertToFormat(exportData, format);
      await this.writeExportFile(outputFile, content, format);

      progress.succeed(`Exported ${operations.length} operations to ${outputFile}`);

      return {
        success: true,
        format,
        outputFile,
        totalOperations: operations.length,
        fileSize: (await fs.stat(outputFile)).size
      };

    } catch (error) {
      progress.fail('Export failed');
      throw error;
    }
  }

  /**
   * Export repository analysis data
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportAnalysisData(options = {}) {
    const {
      outputFile,
      format = 'json',
      includeHeatmap = true,
      includePatterns = true,
      includeHealth = true,
      includeTrends = true
    } = options;

    const CommitAnalyzer = require('./CommitAnalyzer');
    const analyzer = new CommitAnalyzer();

    const progress = ProgressUtils.spinner('Exporting analysis data...');
    progress.start();

    try {
      progress.update('Running comprehensive analysis...');

      const analysisData = await analyzer.getComprehensiveStats({
        maxCommits: 1000,
        includeFiles: false,
        includeDiffs: false
      });

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'Histofy v3',
          version: '1.0.0',
          analysisType: 'comprehensive'
        },
        analysis: analysisData
      };

      // Add optional data
      if (includeHeatmap) {
        progress.update('Generating heatmap data...');
        exportData.heatmap = await analyzer.generateHeatmap();
      }

      if (includePatterns) {
        progress.update('Analyzing commit patterns...');
        const commits = await analyzer.gitManager.getCommitHistory({ limit: 1000 });
        exportData.patterns = analyzer.analyzeCommitPatterns(commits);
      }

      progress.update('Writing export file...');

      const content = await this.convertToFormat(exportData, format);
      await this.writeExportFile(outputFile, content, format);

      progress.succeed(`Exported analysis data to ${outputFile}`);

      return {
        success: true,
        format,
        outputFile,
        fileSize: (await fs.stat(outputFile)).size
      };

    } catch (error) {
      progress.fail('Export failed');
      throw error;
    }
  }

  /**
   * Export configuration data
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportConfigurationData(options = {}) {
    const {
      outputFile,
      format = 'json',
      includeSensitive = false,
      includeDefaults = true
    } = options;

    const ConfigManager = require('../config/ConfigManager');
    const configManager = new ConfigManager();

    const progress = ProgressUtils.spinner('Exporting configuration...');
    progress.start();

    try {
      progress.update('Loading configuration...');

      const config = await configManager.loadConfig();
      
      // Filter sensitive data if not requested
      const exportConfig = includeSensitive ? 
        config : 
        this.filterSensitiveConfig(config);

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'Histofy v3',
          version: '1.0.0',
          includeSensitive,
          includeDefaults
        },
        configuration: exportConfig
      };

      // Add default values if requested
      if (includeDefaults) {
        exportData.defaults = await configManager.getDefaultConfig();
      }

      progress.update('Writing export file...');

      const content = await this.convertToFormat(exportData, format);
      await this.writeExportFile(outputFile, content, format);

      progress.succeed(`Exported configuration to ${outputFile}`);

      return {
        success: true,
        format,
        outputFile,
        fileSize: (await fs.stat(outputFile)).size
      };

    } catch (error) {
      progress.fail('Export failed');
      throw error;
    }
  }

  /**
   * Transform commit data for export
   * @private
   */
  transformCommitForExport(commit, options = {}) {
    const { includeFiles = false, includeDiffs = false } = options;
    
    const transformed = {
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      email: commit.author_email,
      date: commit.date,
      timestamp: new Date(commit.date).toISOString(),
      parents: commit.parents || []
    };

    if (includeFiles && commit.files) {
      transformed.files = commit.files.map(file => ({
        path: file.file,
        status: file.changes,
        insertions: file.insertions,
        deletions: file.deletions
      }));
    }

    if (includeDiffs && commit.diff) {
      transformed.diff = commit.diff;
    }

    return transformed;
  }

  /**
   * Transform operation data for export
   * @private
   */
  transformOperationForExport(operation, options = {}) {
    const { includeBackups = false } = options;
    
    const transformed = {
      id: operation.id,
      type: operation.type,
      command: operation.command,
      description: operation.description,
      timestamp: operation.timestamp,
      status: operation.status,
      undoable: operation.undoable,
      duration: operation.duration,
      args: operation.args,
      result: operation.result,
      metadata: {
        workingDirectory: operation.metadata.workingDirectory,
        user: operation.metadata.user,
        platform: operation.metadata.platform
      }
    };

    if (operation.undoneAt) {
      transformed.undoneAt = operation.undoneAt;
    }

    if (includeBackups && operation.backupInfo) {
      transformed.backupInfo = operation.backupInfo;
    }

    return transformed;
  }

  /**
   * Calculate commit statistics
   * @private
   */
  async calculateCommitStatistics(commits) {
    const stats = {
      totalCommits: commits.length,
      uniqueAuthors: new Set(commits.map(c => c.author_name)).size,
      dateRange: {
        earliest: commits.length > 0 ? commits[commits.length - 1].date : null,
        latest: commits.length > 0 ? commits[0].date : null
      },
      commitsByAuthor: {},
      commitsByMonth: {},
      commitsByDayOfWeek: {},
      commitsByHour: {},
      averageMessageLength: 0
    };

    if (commits.length === 0) return stats;

    // Calculate detailed statistics
    let totalMessageLength = 0;
    
    commits.forEach(commit => {
      const author = commit.author_name;
      const date = moment(commit.date);
      const month = date.format('YYYY-MM');
      const dayOfWeek = date.format('dddd');
      const hour = date.hour();

      // Author statistics
      stats.commitsByAuthor[author] = (stats.commitsByAuthor[author] || 0) + 1;

      // Temporal statistics
      stats.commitsByMonth[month] = (stats.commitsByMonth[month] || 0) + 1;
      stats.commitsByDayOfWeek[dayOfWeek] = (stats.commitsByDayOfWeek[dayOfWeek] || 0) + 1;
      stats.commitsByHour[hour] = (stats.commitsByHour[hour] || 0) + 1;

      // Message statistics
      totalMessageLength += commit.message.length;
    });

    stats.averageMessageLength = Math.round(totalMessageLength / commits.length);

    return stats;
  }

  /**
   * Get repository information
   * @private
   */
  async getRepositoryInfo() {
    try {
      const repoInfo = await this.gitManager.getRepoInfo();
      return {
        path: process.cwd(),
        remotes: repoInfo.remotes,
        currentBranch: repoInfo.currentBranch,
        totalBranches: repoInfo.branches?.length || 0
      };
    } catch (error) {
      return {
        path: process.cwd(),
        error: 'Could not retrieve repository information'
      };
    }
  }

  /**
   * Filter sensitive configuration data
   * @private
   */
  filterSensitiveConfig(config) {
    const sensitiveKeys = ['token', 'password', 'secret', 'key'];
    const filtered = JSON.parse(JSON.stringify(config));

    const filterObject = (obj, path = '') => {
      Object.keys(obj).forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (obj[key]._encrypted) {
            obj[key] = '[ENCRYPTED]';
          } else {
            filterObject(obj[key], currentPath);
          }
        } else if (sensitiveKeys.some(sensitive => 
          key.toLowerCase().includes(sensitive.toLowerCase())
        )) {
          obj[key] = '[FILTERED]';
        }
      });
    };

    filterObject(filtered);
    return filtered;
  }

  /**
   * Convert data to specified format
   * @private
   */
  async convertToFormat(data, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.convertToCSV(data);
      
      case 'xml':
        return this.convertToXML(data);
      
      case 'yaml':
        const yaml = require('yaml');
        return yaml.stringify(data);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Convert data to CSV format
   * @private
   */
  convertToCSV(data) {
    if (data.commits) {
      return this.convertCommitsToCSV(data.commits);
    } else if (data.operations) {
      return this.convertOperationsToCSV(data.operations);
    } else {
      // Generic object to CSV
      return this.convertObjectToCSV(data);
    }
  }

  /**
   * Convert commits to CSV
   * @private
   */
  convertCommitsToCSV(commits) {
    if (commits.length === 0) return '';

    const headers = ['Hash', 'Message', 'Author', 'Email', 'Date', 'Timestamp'];
    const rows = commits.map(commit => [
      commit.hash,
      commit.message.replace(/"/g, '""'),
      commit.author,
      commit.email,
      commit.date,
      commit.timestamp
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell)}"`).join(','))
      .join('\n');
  }

  /**
   * Convert operations to CSV
   * @private
   */
  convertOperationsToCSV(operations) {
    if (operations.length === 0) return '';

    const headers = ['ID', 'Type', 'Command', 'Description', 'Timestamp', 'Status', 'Undoable', 'Duration'];
    const rows = operations.map(op => [
      op.id,
      op.type,
      op.command,
      op.description.replace(/"/g, '""'),
      op.timestamp,
      op.status,
      op.undoable,
      op.duration
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell)}"`).join(','))
      .join('\n');
  }

  /**
   * Convert generic object to CSV
   * @private
   */
  convertObjectToCSV(data) {
    const flattenObject = (obj, prefix = '') => {
      const flattened = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(flattened, flattenObject(value, newKey));
        } else {
          flattened[newKey] = Array.isArray(value) ? value.join(';') : value;
        }
      });
      return flattened;
    };

    const flattened = flattenObject(data);
    const headers = Object.keys(flattened);
    const values = Object.values(flattened);

    return [headers, values]
      .map(row => row.map(cell => `"${String(cell)}"`).join(','))
      .join('\n');
  }

  /**
   * Convert data to XML format
   * @private
   */
  convertToXML(data) {
    const xmlBuilder = require('xmlbuilder');
    
    const root = xmlBuilder.create('histofy-export');
    
    const buildXML = (obj, parent) => {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        
        if (Array.isArray(value)) {
          const arrayElement = parent.ele(key);
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              const itemElement = arrayElement.ele('item', { index });
              buildXML(item, itemElement);
            } else {
              arrayElement.ele('item', { index }, item);
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          const objElement = parent.ele(key);
          buildXML(value, objElement);
        } else {
          parent.ele(key, value);
        }
      });
    };

    buildXML(data, root);
    return root.end({ pretty: true });
  }

  /**
   * Write export file with proper encoding
   * @private
   */
  async writeExportFile(outputFile, content, format) {
    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    await fs.mkdir(outputDir, { recursive: true });

    // Write file with appropriate encoding
    const encoding = format.toLowerCase() === 'xml' ? 'utf8' : 'utf8';
    await fs.writeFile(outputFile, content, encoding);
  }

  /**
   * Get export file extension for format
   * @private
   */
  getFileExtension(format) {
    const extensions = {
      json: '.json',
      csv: '.csv',
      xml: '.xml',
      yaml: '.yaml'
    };
    return extensions[format.toLowerCase()] || '.txt';
  }

  /**
   * Validate export options
   * @private
   */
  validateExportOptions(options) {
    const { outputFile, format } = options;

    if (!outputFile) {
      throw new Error('Output file is required');
    }

    if (format && !this.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported format: ${format}. Supported: ${this.supportedFormats.join(', ')}`);
    }

    return true;
  }
}

module.exports = DataExporter;