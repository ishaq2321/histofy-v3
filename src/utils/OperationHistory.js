/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * OperationHistory - Tracks and manages operation history with undo capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const moment = require('moment');
const os = require('os');
const GitManager = require('../core/GitManager');
const SecurityUtils = require('../security/SecurityUtils');
const { ProgressUtils } = require('./progress');
const { FeedbackUtils } = require('./feedback');

class OperationHistory {
  constructor() {
    this.historyDir = path.join(os.homedir(), '.histofy', 'history');
    this.historyFile = path.join(this.historyDir, 'operations.json');
    this.backupDir = path.join(this.historyDir, 'backups');
    this.maxHistoryEntries = 100;
    this.maxBackupAge = 30; // days
  }

  /**
   * Initialize operation history system
   */
  async initialize() {
    try {
      await fs.mkdir(this.historyDir, { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create history file if it doesn't exist
      try {
        await fs.access(this.historyFile);
      } catch (error) {
        await this.saveHistory([]);
      }
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to initialize operation history: ${error.message}`);
    }
  }

  /**
   * Record a new operation in history
   * @param {Object} operation - Operation details
   * @returns {Promise<string>} Operation ID
   */
  async recordOperation(operation) {
    await this.initialize();
    
    const operationId = this.generateOperationId();
    const timestamp = new Date().toISOString();
    
    const historyEntry = {
      id: operationId,
      timestamp,
      type: operation.type,
      command: operation.command,
      args: operation.args || {},
      description: operation.description,
      status: 'completed',
      undoable: operation.undoable !== false,
      metadata: {
        workingDirectory: process.cwd(),
        user: os.userInfo().username,
        platform: os.platform(),
        nodeVersion: process.version,
        histofyVersion: operation.histofyVersion || '3.0.0'
      },
      result: operation.result || {},
      backupInfo: operation.backupInfo || null,
      undoData: operation.undoData || null,
      duration: operation.duration || 0
    };

    // Load existing history
    const history = await this.loadHistory();
    
    // Add new entry at the beginning
    history.unshift(historyEntry);
    
    // Limit history size
    if (history.length > this.maxHistoryEntries) {
      const removedEntries = history.splice(this.maxHistoryEntries);
      // Clean up backups for removed entries
      await this.cleanupBackupsForEntries(removedEntries);
    }
    
    // Save updated history
    await this.saveHistory(history);
    
    return operationId;
  }

  /**
   * Get operation history
   * @param {Object} options - Query options
   * @returns {Promise<Array>} History entries
   */
  async getHistory(options = {}) {
    const {
      limit = 20,
      type = null,
      since = null,
      until = null,
      undoableOnly = false
    } = options;

    await this.initialize();
    const history = await this.loadHistory();
    
    let filteredHistory = history;
    
    // Filter by type
    if (type) {
      filteredHistory = filteredHistory.filter(entry => entry.type === type);
    }
    
    // Filter by date range
    if (since) {
      const sinceDate = new Date(since);
      filteredHistory = filteredHistory.filter(entry => 
        new Date(entry.timestamp) >= sinceDate
      );
    }
    
    if (until) {
      const untilDate = new Date(until);
      filteredHistory = filteredHistory.filter(entry => 
        new Date(entry.timestamp) <= untilDate
      );
    }
    
    // Filter undoable only
    if (undoableOnly) {
      filteredHistory = filteredHistory.filter(entry => entry.undoable);
    }
    
    // Apply limit
    return filteredHistory.slice(0, limit);
  }

  /**
   * Get a specific operation by ID
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object|null>} Operation entry
   */
  async getOperation(operationId) {
    await this.initialize();
    const history = await this.loadHistory();
    return history.find(entry => entry.id === operationId) || null;
  }

  /**
   * Undo a specific operation
   * @param {string} operationId - Operation ID to undo
   * @param {Object} options - Undo options
   * @returns {Promise<Object>} Undo result
   */
  async undoOperation(operationId, options = {}) {
    const { force = false, dryRun = false } = options;
    
    const operation = await this.getOperation(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found in history`);
    }
    
    if (!operation.undoable) {
      throw new Error(`Operation ${operationId} is not undoable`);
    }
    
    if (operation.status === 'undone') {
      throw new Error(`Operation ${operationId} has already been undone`);
    }

    // Check if operation can be safely undone
    const safetyCheck = await this.checkUndoSafety(operation);
    if (!safetyCheck.safe && !force) {
      throw new Error(`Cannot safely undo operation: ${safetyCheck.reason}. Use --force to override.`);
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        operation,
        safetyCheck,
        message: 'Undo dry-run completed successfully'
      };
    }

    const progress = ProgressUtils.spinner(`Undoing operation: ${operation.description}`);
    progress.start();

    try {
      // Perform the undo based on operation type
      const undoResult = await this.performUndo(operation, progress);
      
      // Mark operation as undone
      await this.markOperationUndone(operationId, undoResult);
      
      progress.succeed(`Operation undone successfully: ${operation.description}`);
      
      return {
        success: true,
        operationId,
        undoResult,
        message: 'Operation undone successfully'
      };
      
    } catch (error) {
      progress.fail(`Failed to undo operation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Undo the last N operations
   * @param {number} count - Number of operations to undo
   * @param {Object} options - Undo options
   * @returns {Promise<Object>} Undo result
   */
  async undoLast(count = 1, options = {}) {
    const { force = false, dryRun = false } = options;
    
    const recentOperations = await this.getHistory({ 
      limit: count, 
      undoableOnly: true 
    });
    
    if (recentOperations.length === 0) {
      throw new Error('No undoable operations found');
    }
    
    if (recentOperations.length < count) {
      throw new Error(`Only ${recentOperations.length} undoable operations available, requested ${count}`);
    }

    const results = [];
    
    for (const operation of recentOperations) {
      try {
        const result = await this.undoOperation(operation.id, { force, dryRun });
        results.push({ operationId: operation.id, success: true, result });
      } catch (error) {
        results.push({ operationId: operation.id, success: false, error: error.message });
        if (!force) {
          break; // Stop on first error unless force is enabled
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    return {
      success: failureCount === 0,
      totalOperations: count,
      successfulUndos: successCount,
      failedUndos: failureCount,
      results,
      message: `Undone ${successCount}/${count} operations`
    };
  }

  /**
   * Check if an operation can be safely undone
   * @param {Object} operation - Operation to check
   * @returns {Promise<Object>} Safety check result
   */
  async checkUndoSafety(operation) {
    try {
      // Check if working directory still exists and is accessible
      const workingDir = operation.metadata.workingDirectory;
      try {
        await fs.access(workingDir);
        process.chdir(workingDir);
      } catch (error) {
        return {
          safe: false,
          reason: `Working directory no longer accessible: ${workingDir}`
        };
      }

      // Check if this is a Git repository
      const gitManager = new GitManager(workingDir);
      try {
        await gitManager.getStatus();
      } catch (error) {
        return {
          safe: false,
          reason: 'Not in a Git repository or Git is not accessible'
        };
      }

      // Check if there are uncommitted changes
      const status = await gitManager.getStatus();
      if (!status.isClean) {
        return {
          safe: false,
          reason: 'Repository has uncommitted changes. Commit or stash changes before undoing.'
        };
      }

      // Check operation-specific safety conditions
      const operationSafety = await this.checkOperationSpecificSafety(operation, gitManager);
      if (!operationSafety.safe) {
        return operationSafety;
      }

      return { safe: true };
      
    } catch (error) {
      return {
        safe: false,
        reason: `Safety check failed: ${error.message}`
      };
    }
  }

  /**
   * Perform the actual undo operation
   * @param {Object} operation - Operation to undo
   * @param {Object} progress - Progress indicator
   * @returns {Promise<Object>} Undo result
   */
  async performUndo(operation, progress) {
    const gitManager = new GitManager(operation.metadata.workingDirectory);
    
    switch (operation.type) {
      case 'commit':
        return await this.undoCommitOperation(operation, gitManager, progress);
      
      case 'migrate':
        return await this.undoMigrationOperation(operation, gitManager, progress);
      
      case 'batch':
        return await this.undoBatchOperation(operation, gitManager, progress);
      
      case 'config':
        return await this.undoConfigOperation(operation, progress);
      
      default:
        throw new Error(`Undo not supported for operation type: ${operation.type}`);
    }
  }

  /**
   * Undo a commit operation
   * @private
   */
  async undoCommitOperation(operation, gitManager, progress) {
    progress.update('Undoing commit...');
    
    if (operation.undoData && operation.undoData.commitHash) {
      // Reset to the commit before the one we created
      await gitManager.resetToCommit(operation.undoData.parentHash || 'HEAD~1', { hard: true });
      
      return {
        type: 'commit_undo',
        removedCommit: operation.undoData.commitHash,
        resetTo: operation.undoData.parentHash || 'HEAD~1'
      };
    } else {
      throw new Error('Insufficient undo data for commit operation');
    }
  }

  /**
   * Undo a migration operation
   * @private
   */
  async undoMigrationOperation(operation, gitManager, progress) {
    progress.update('Restoring from backup...');
    
    if (operation.backupInfo && operation.backupInfo.backupBranch) {
      // Restore from backup branch
      await gitManager.restoreFromBackup(operation.backupInfo.backupBranch);
      
      return {
        type: 'migration_undo',
        restoredFrom: operation.backupInfo.backupBranch,
        migratedCommits: operation.result.migratedCommits || []
      };
    } else {
      throw new Error('No backup information available for migration undo');
    }
  }

  /**
   * Undo a batch operation
   * @private
   */
  async undoBatchOperation(operation, gitManager, progress) {
    progress.update('Undoing batch commits...');
    
    if (operation.undoData && operation.undoData.createdCommits) {
      const commits = operation.undoData.createdCommits;
      
      // Reset to before the first commit in the batch
      if (commits.length > 0) {
        const resetTarget = commits[0].parentHash || `HEAD~${commits.length}`;
        await gitManager.resetToCommit(resetTarget, { hard: true });
      }
      
      return {
        type: 'batch_undo',
        removedCommits: commits.map(c => c.hash),
        resetTo: commits[0]?.parentHash || `HEAD~${commits.length}`
      };
    } else {
      throw new Error('Insufficient undo data for batch operation');
    }
  }

  /**
   * Undo a configuration operation
   * @private
   */
  async undoConfigOperation(operation, progress) {
    progress.update('Restoring configuration...');
    
    if (operation.undoData && operation.undoData.previousValue !== undefined) {
      const ConfigManager = require('../config/ConfigManager');
      const configManager = new ConfigManager();
      
      if (operation.undoData.previousValue === null) {
        // Key didn't exist before, remove it
        await configManager.remove(operation.undoData.key);
      } else {
        // Restore previous value
        await configManager.set(operation.undoData.key, operation.undoData.previousValue);
      }
      
      return {
        type: 'config_undo',
        key: operation.undoData.key,
        restoredValue: operation.undoData.previousValue
      };
    } else {
      throw new Error('Insufficient undo data for configuration operation');
    }
  }

  /**
   * Check operation-specific safety conditions
   * @private
   */
  async checkOperationSpecificSafety(operation, gitManager) {
    switch (operation.type) {
      case 'commit':
        // Check if the commit still exists and is the last commit
        if (operation.undoData && operation.undoData.commitHash) {
          try {
            const currentHead = await gitManager.getCurrentCommitHash();
            if (currentHead !== operation.undoData.commitHash) {
              return {
                safe: false,
                reason: 'Additional commits have been made since this operation. Undo may cause data loss.'
              };
            }
          } catch (error) {
            return {
              safe: false,
              reason: 'Cannot verify current repository state'
            };
          }
        }
        break;
        
      case 'migrate':
        // Check if backup still exists
        if (operation.backupInfo && operation.backupInfo.backupBranch) {
          try {
            const branches = await gitManager.getBranches();
            if (!branches.includes(operation.backupInfo.backupBranch)) {
              return {
                safe: false,
                reason: 'Backup branch no longer exists. Cannot safely undo migration.'
              };
            }
          } catch (error) {
            return {
              safe: false,
              reason: 'Cannot verify backup branch existence'
            };
          }
        }
        break;
    }
    
    return { safe: true };
  }

  /**
   * Mark an operation as undone
   * @private
   */
  async markOperationUndone(operationId, undoResult) {
    const history = await this.loadHistory();
    const operationIndex = history.findIndex(entry => entry.id === operationId);
    
    if (operationIndex !== -1) {
      history[operationIndex].status = 'undone';
      history[operationIndex].undoneAt = new Date().toISOString();
      history[operationIndex].undoResult = undoResult;
      
      await this.saveHistory(history);
    }
  }

  /**
   * Clear operation history
   * @param {Object} options - Clear options
   */
  async clearHistory(options = {}) {
    const { olderThan = null, type = null, keepBackups = false } = options;
    
    const history = await this.loadHistory();
    let filteredHistory = history;
    
    if (olderThan) {
      const cutoffDate = new Date(olderThan);
      filteredHistory = history.filter(entry => 
        new Date(entry.timestamp) >= cutoffDate
      );
    }
    
    if (type) {
      const removedEntries = history.filter(entry => entry.type === type);
      filteredHistory = history.filter(entry => entry.type !== type);
      
      if (!keepBackups) {
        await this.cleanupBackupsForEntries(removedEntries);
      }
    } else if (!keepBackups) {
      const removedEntries = history.filter(entry => 
        olderThan ? new Date(entry.timestamp) < new Date(olderThan) : true
      );
      await this.cleanupBackupsForEntries(removedEntries);
    }
    
    await this.saveHistory(filteredHistory);
    
    return {
      success: true,
      removedCount: history.length - filteredHistory.length,
      remainingCount: filteredHistory.length
    };
  }

  /**
   * Export operation history
   * @param {string} outputFile - Output file path
   * @param {Object} options - Export options
   */
  async exportHistory(outputFile, options = {}) {
    const { format = 'json', includeBackups = false } = options;
    
    const history = await this.getHistory({ limit: this.maxHistoryEntries });
    
    let exportData;
    switch (format.toLowerCase()) {
      case 'json':
        exportData = JSON.stringify({
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          totalEntries: history.length,
          entries: history
        }, null, 2);
        break;
        
      case 'csv':
        exportData = this.convertHistoryToCSV(history);
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    await fs.writeFile(outputFile, exportData, 'utf8');
    
    return {
      success: true,
      format,
      entriesExported: history.length,
      outputFile
    };
  }

  /**
   * Generate unique operation ID
   * @private
   */
  generateOperationId() {
    return `op_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Load operation history from file
   * @private
   */
  async loadHistory() {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  /**
   * Save operation history to file
   * @private
   */
  async saveHistory(history) {
    const data = JSON.stringify(history, null, 2);
    await fs.writeFile(this.historyFile, data, 'utf8');
  }

  /**
   * Clean up old backups
   * @private
   */
  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const cutoffDate = moment().subtract(this.maxBackupAge, 'days');
      
      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (moment(stats.mtime).isBefore(cutoffDate)) {
          await fs.rm(filePath, { recursive: true, force: true });
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Clean up backups for specific entries
   * @private
   */
  async cleanupBackupsForEntries(entries) {
    for (const entry of entries) {
      if (entry.backupInfo && entry.backupInfo.backupPath) {
        try {
          await fs.rm(entry.backupInfo.backupPath, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Convert history to CSV format
   * @private
   */
  convertHistoryToCSV(history) {
    if (history.length === 0) return '';
    
    const headers = ['ID', 'Timestamp', 'Type', 'Command', 'Description', 'Status', 'Undoable', 'Duration'];
    const rows = history.map(entry => [
      entry.id,
      entry.timestamp,
      entry.type,
      entry.command,
      entry.description,
      entry.status,
      entry.undoable,
      entry.duration
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}

module.exports = OperationHistory;