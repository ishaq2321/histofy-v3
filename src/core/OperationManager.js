/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * OperationManager - Manages operation state, lifecycle, and cleanup
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const crypto = require('crypto');
const chalk = require('chalk');

/**
 * Represents a single operation with its state and metadata
 */
class Operation {
  constructor(id, type, metadata = {}) {
    this.id = id;
    this.type = type; // 'commit', 'migrate', 'config', 'status'
    this.metadata = metadata;
    this.status = 'pending'; // 'pending', 'running', 'completed', 'failed', 'cancelled', 'rolled_back'
    this.startTime = new Date();
    this.endTime = null;
    this.progress = 0;
    this.result = null;
    this.error = null;
    this.backupInfo = null;
    this.cleanupTasks = [];
    this.context = {};
  }

  /**
   * Update operation progress
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  updateProgress(progress, message = null) {
    this.progress = Math.min(Math.max(progress, 0), 100);
    if (message) {
      this.context.lastMessage = message;
      this.context.lastUpdate = new Date();
    }
  }

  /**
   * Mark operation as completed
   * @param {*} result - Operation result
   */
  complete(result) {
    this.status = 'completed';
    this.endTime = new Date();
    this.progress = 100;
    this.result = result;
  }

  /**
   * Mark operation as failed
   * @param {Error} error - Error that caused failure
   */
  fail(error) {
    this.status = 'failed';
    this.endTime = new Date();
    this.error = error;
  }

  /**
   * Mark operation as cancelled
   * @param {string} reason - Cancellation reason
   */
  cancel(reason = 'User cancelled') {
    this.status = 'cancelled';
    this.endTime = new Date();
    this.context.cancellationReason = reason;
  }

  /**
   * Add cleanup task to be executed when operation ends
   * @param {Function} cleanupFn - Cleanup function
   * @param {string} description - Description of cleanup task
   */
  addCleanupTask(cleanupFn, description) {
    this.cleanupTasks.push({
      fn: cleanupFn,
      description: description,
      id: crypto.randomBytes(4).toString('hex')
    });
  }

  /**
   * Execute all cleanup tasks
   */
  async executeCleanup() {
    const results = [];
    
    for (const task of this.cleanupTasks) {
      try {
        await task.fn();
        results.push({ id: task.id, success: true, description: task.description });
      } catch (error) {
        results.push({ 
          id: task.id, 
          success: false, 
          error: error.message, 
          description: task.description 
        });
      }
    }
    
    return results;
  }

  /**
   * Get operation duration in milliseconds
   */
  getDuration() {
    const endTime = this.endTime || new Date();
    return endTime.getTime() - this.startTime.getTime();
  }

  /**
   * Check if operation requires backup
   */
  requiresBackup() {
    return ['commit', 'migrate'].includes(this.type);
  }

  /**
   * Get operation summary
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      progress: this.progress,
      duration: this.getDuration(),
      startTime: this.startTime,
      endTime: this.endTime,
      hasError: !!this.error,
      hasResult: !!this.result,
      cleanupTaskCount: this.cleanupTasks.length
    };
  }
}

/**
 * Manages all operations and their lifecycle
 */
class OperationManager extends EventEmitter {
  constructor() {
    super();
    this.operations = new Map();
    this.activeOperations = new Set();
    this.operationHistory = [];
    this.maxHistorySize = 100;
    this.shutdownInProgress = false;
    this.setupSignalHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!OperationManager.instance) {
      OperationManager.instance = new OperationManager();
    }
    return OperationManager.instance;
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `op-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Start a new operation
   * @param {string} type - Operation type
   * @param {Object} metadata - Operation metadata
   * @returns {string} Operation ID
   */
  async startOperation(type, metadata = {}) {
    const operationId = this.generateOperationId();
    const operation = new Operation(operationId, type, metadata);
    
    this.operations.set(operationId, operation);
    this.activeOperations.add(operationId);
    
    // Set operation as running
    operation.status = 'running';
    
    // Emit operation started event
    this.emit('operationStarted', operation);
    
    // Add to history
    this.addToHistory(operation);
    
    return operationId;
  }

  /**
   * Update operation progress
   * @param {string} operationId - Operation ID
   * @param {number} progress - Progress percentage
   * @param {string} message - Progress message
   */
  updateProgress(operationId, progress, message = null) {
    const operation = this.operations.get(operationId);
    if (operation) {
      operation.updateProgress(progress, message);
      this.emit('operationProgress', operation);
    }
  }

  /**
   * Complete an operation
   * @param {string} operationId - Operation ID
   * @param {*} result - Operation result
   */
  async completeOperation(operationId, result) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.complete(result);
    this.activeOperations.delete(operationId);
    
    // Execute cleanup tasks
    const cleanupResults = await operation.executeCleanup();
    operation.context.cleanupResults = cleanupResults;
    
    this.emit('operationCompleted', operation);
    
    return operation;
  }

  /**
   * Fail an operation
   * @param {string} operationId - Operation ID
   * @param {Error} error - Error that caused failure
   */
  async failOperation(operationId, error) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.fail(error);
    this.activeOperations.delete(operationId);
    
    // Execute cleanup tasks
    const cleanupResults = await operation.executeCleanup();
    operation.context.cleanupResults = cleanupResults;
    
    this.emit('operationFailed', operation);
    
    return operation;
  }

  /**
   * Cancel an operation
   * @param {string} operationId - Operation ID
   * @param {string} reason - Cancellation reason
   */
  async cancelOperation(operationId, reason = 'User cancelled') {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.cancel(reason);
    this.activeOperations.delete(operationId);
    
    // Execute cleanup tasks
    const cleanupResults = await operation.executeCleanup();
    operation.context.cleanupResults = cleanupResults;
    
    this.emit('operationCancelled', operation);
    
    return operation;
  }

  /**
   * Get operation by ID
   * @param {string} operationId - Operation ID
   * @returns {Operation} Operation instance
   */
  getOperation(operationId) {
    return this.operations.get(operationId);
  }

  /**
   * Get all active operations
   * @returns {Array} Array of active operations
   */
  getActiveOperations() {
    return Array.from(this.activeOperations).map(id => this.operations.get(id));
  }

  /**
   * Get operation history
   * @param {number} limit - Maximum number of operations to return
   * @returns {Array} Array of operation summaries
   */
  getOperationHistory(limit = 10) {
    return this.operationHistory
      .slice(-limit)
      .map(op => op.getSummary());
  }

  /**
   * Add operation to history
   * @param {Operation} operation - Operation to add
   */
  addToHistory(operation) {
    this.operationHistory.push(operation);
    
    // Limit history size
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Cancel all active operations
   * @param {string} reason - Cancellation reason
   */
  async cancelAllOperations(reason = 'System shutdown') {
    const activeOps = this.getActiveOperations();
    const results = [];
    
    for (const operation of activeOps) {
      try {
        const result = await this.cancelOperation(operation.id, reason);
        results.push({ operationId: operation.id, success: true, result });
      } catch (error) {
        results.push({ operationId: operation.id, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Cleanup all operations and resources
   */
  async cleanupAll() {
    if (this.shutdownInProgress) {
      return;
    }
    
    this.shutdownInProgress = true;
    
    try {
      // Cancel all active operations
      await this.cancelAllOperations('System cleanup');
      
      // Clear all data
      this.operations.clear();
      this.activeOperations.clear();
      
      this.emit('cleanupCompleted');
    } catch (error) {
      this.emit('cleanupError', error);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const handleShutdown = async (signal) => {
      console.log(chalk.yellow(`\nReceived ${signal}, shutting down gracefully...`));
      
      try {
        await this.cleanupAll();
        console.log(chalk.green('Cleanup completed successfully'));
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('Cleanup failed:'), error.message);
        process.exit(1);
      }
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('Uncaught exception:'), error);
      await this.cleanupAll();
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error(chalk.red('Unhandled promise rejection:'), reason);
      await this.cleanupAll();
      process.exit(1);
    });
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      activeOperations: this.activeOperations.size,
      totalOperations: this.operations.size,
      historySize: this.operationHistory.length,
      shutdownInProgress: this.shutdownInProgress,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Save operation state to disk (for recovery)
   * @param {string} operationId - Operation ID
   */
  async saveOperationState(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const stateDir = path.join(os.tmpdir(), 'histofy-operations');
    await fs.mkdir(stateDir, { recursive: true });
    
    const statePath = path.join(stateDir, `${operationId}.json`);
    const state = {
      id: operation.id,
      type: operation.type,
      metadata: operation.metadata,
      status: operation.status,
      startTime: operation.startTime,
      progress: operation.progress,
      context: operation.context
    };
    
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    return statePath;
  }

  /**
   * Load operation state from disk
   * @param {string} operationId - Operation ID
   */
  async loadOperationState(operationId) {
    const stateDir = path.join(os.tmpdir(), 'histofy-operations');
    const statePath = path.join(stateDir, `${operationId}.json`);
    
    try {
      const stateData = await fs.readFile(statePath, 'utf8');
      return JSON.parse(stateData);
    } catch (error) {
      throw new Error(`Failed to load operation state: ${error.message}`);
    }
  }

  /**
   * Clean up old operation state files
   */
  async cleanupOldStates() {
    const stateDir = path.join(os.tmpdir(), 'histofy-operations');
    
    try {
      const files = await fs.readdir(stateDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(stateDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      // Non-critical error, just log it
      console.warn(`Warning: Failed to cleanup old operation states: ${error.message}`);
    }
  }
}

module.exports = { OperationManager, Operation };