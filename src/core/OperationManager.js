/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * OperationManager - Manages operation state, transactions, and rollback capabilities
 */

const crypto = require('crypto');
const chalk = require('chalk');
const GitTransaction = require('./GitTransaction');
const { PerformanceProfiler } = require('../utils/PerformanceProfiler');
const AuditLogger = require('../utils/AuditLogger');

class Operation {
  constructor(id, type, metadata = {}) {
    this.id = id;
    this.type = type; // 'commit', 'migrate', 'config', 'status'
    this.metadata = metadata;
    this.status = 'pending'; // 'pending', 'running', 'completed', 'failed', 'cancelled'
    this.startTime = new Date();
    this.endTime = null;
    this.result = null;
    this.error = null;
    this.transaction = null;
    this.requiresCleanup = false;
  }

  /**
   * Check if this operation type requires backup
   */
  requiresBackup() {
    return ['migrate', 'commit'].includes(this.type);
  }

  /**
   * Mark operation as running
   */
  markRunning() {
    this.status = 'running';
    this.startTime = new Date();
  }

  /**
   * Complete the operation successfully
   */
  complete(result) {
    this.status = 'completed';
    this.endTime = new Date();
    this.result = result;
  }

  /**
   * Mark operation as failed
   */
  fail(error) {
    this.status = 'failed';
    this.endTime = new Date();
    this.error = error;
  }

  /**
   * Cancel the operation
   */
  cancel(reason = 'Operation cancelled') {
    this.status = 'cancelled';
    this.endTime = new Date();
    this.error = new Error(reason);
  }

  /**
   * Get operation duration in milliseconds
   */
  getDuration() {
    if (!this.endTime) {
      return Date.now() - this.startTime.getTime();
    }
    return this.endTime.getTime() - this.startTime.getTime();
  }

  /**
   * Get operation summary
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      duration: this.getDuration(),
      startTime: this.startTime,
      endTime: this.endTime,
      hasError: !!this.error,
      errorMessage: this.error?.message,
      metadata: this.metadata
    };
  }
}

class OperationManager {
  constructor() {
    this.operations = new Map();
    this.activeOperations = new Set();
    this.cleanupHandlers = new Set();
    this.shutdownInProgress = false;
    
    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();
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
   */
  async startOperation(type, metadata = {}) {
    if (this.shutdownInProgress) {
      throw new Error('Cannot start new operations during shutdown');
    }

    const operationId = this.generateOperationId();
    const operation = new Operation(operationId, type, metadata);
    
    this.operations.set(operationId, operation);
    this.activeOperations.add(operationId);
    
    operation.markRunning();

    // Log operation start to audit log
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.logEvent('OPERATION_STARTED', {
      operationId,
      type,
      metadata: this.sanitizeMetadata(metadata),
      success: true
    }, {
      operation: {
        id: operationId,
        type,
        startTime: operation.startTime
      }
    });

    // Create transaction if operation requires backup
    if (operation.requiresBackup() && metadata.repoPath) {
      try {
        operation.transaction = new GitTransaction(metadata.repoPath, operationId);
        await operation.transaction.createBackup();
        operation.requiresCleanup = true;
        
        // Log backup creation
        await auditLogger.logEvent('BACKUP_CREATED', {
          operationId,
          backupPath: operation.transaction.backupPath,
          success: true
        });
        
      } catch (error) {
        operation.fail(error);
        
        // Log backup failure
        await auditLogger.logEvent('BACKUP_FAILED', {
          operationId,
          error: error.message,
          success: false
        });
        this.activeOperations.delete(operationId);
        throw new Error(`Failed to create backup for operation: ${error.message}`);
      }
    }

    return operationId;
  }

  /**
   * Complete an operation successfully
   */
  async completeOperation(operationId, result = null) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.complete(result);
    this.activeOperations.delete(operationId);

    // Log operation completion
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.logEvent('OPERATION_COMPLETED', {
      operationId,
      type: operation.type,
      duration: operation.endTime - operation.startTime,
      result: this.sanitizeResult(result),
      success: true
    }, {
      operation: {
        id: operationId,
        type: operation.type,
        startTime: operation.startTime,
        endTime: operation.endTime
      }
    });

    // Commit transaction if exists
    if (operation.transaction) {
      try {
        await operation.transaction.commit();
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to commit transaction: ${error.message}`));
      }
    }

    return operation.getSummary();
  }

  /**
   * Fail an operation
   */
  async failOperation(operationId, error) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.fail(error);
    this.activeOperations.delete(operationId);

    // Log operation failure
    const auditLogger = AuditLogger.getInstance();
    await auditLogger.logEvent('OPERATION_FAILED', {
      operationId,
      type: operation.type,
      duration: operation.endTime - operation.startTime,
      error: error.message,
      stack: error.stack,
      success: false
    }, {
      operation: {
        id: operationId,
        type: operation.type,
        startTime: operation.startTime,
        endTime: operation.endTime
      }
    });

    // Rollback transaction if exists
    if (operation.transaction) {
      try {
        await operation.transaction.rollback();
        console.log(chalk.blue('Repository state restored from backup'));
        
        // Log successful rollback
        await auditLogger.logEvent('ROLLBACK_COMPLETED', {
          operationId,
          backupPath: operation.transaction.backupPath,
          success: true
        });
        
      } catch (rollbackError) {
        console.error(chalk.red(`Failed to rollback transaction: ${rollbackError.message}`));
        
        // Log rollback failure
        await auditLogger.logEvent('ROLLBACK_FAILED', {
          operationId,
          error: rollbackError.message,
          success: false
        });
      }
    }

    return operation.getSummary();
  }

  /**
   * Cancel an operation
   */
  async cancelOperation(operationId, reason = 'Operation cancelled') {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.cancel(reason);
    this.activeOperations.delete(operationId);

    // Rollback transaction if exists
    if (operation.transaction) {
      try {
        await operation.transaction.rollback();
        console.log(chalk.blue('Repository state restored from backup'));
      } catch (rollbackError) {
        console.error(chalk.red(`Failed to rollback transaction: ${rollbackError.message}`));
      }
    }

    return operation.getSummary();
  }

  /**
   * Get operation status
   */
  getOperationStatus(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return null;
    }
    return operation.getSummary();
  }

  /**
   * Get all active operations
   */
  getActiveOperations() {
    return Array.from(this.activeOperations).map(id => {
      const operation = this.operations.get(id);
      return operation ? operation.getSummary() : null;
    }).filter(Boolean);
  }

  /**
   * Get operation history
   */
  getOperationHistory(limit = 10) {
    const allOperations = Array.from(this.operations.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
    
    return allOperations.map(op => op.getSummary());
  }

  /**
   * Cleanup completed operations (keep last 50)
   */
  cleanupOldOperations() {
    const allOperations = Array.from(this.operations.entries())
      .sort(([, a], [, b]) => b.startTime.getTime() - a.startTime.getTime());
    
    // Keep only the last 50 operations
    const toDelete = allOperations.slice(50);
    
    for (const [id, operation] of toDelete) {
      // Only delete completed/failed/cancelled operations
      if (!this.activeOperations.has(id)) {
        this.operations.delete(id);
      }
    }
  }

  /**
   * Cancel all active operations
   */
  async cancelAllOperations(reason = 'Shutdown requested') {
    const activeOps = Array.from(this.activeOperations);
    const results = [];

    for (const operationId of activeOps) {
      try {
        const result = await this.cancelOperation(operationId, reason);
        results.push(result);
      } catch (error) {
        console.error(chalk.red(`Failed to cancel operation ${operationId}: ${error.message}`));
      }
    }

    return results;
  }

  /**
   * Cleanup all resources
   */
  async cleanupAll() {
    if (this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    console.log(chalk.yellow('\nCleaning up operations...'));

    // Cancel all active operations
    const cancelledOps = await this.cancelAllOperations('Application shutdown');
    
    if (cancelledOps.length > 0) {
      console.log(chalk.blue(`Cancelled ${cancelledOps.length} active operation(s)`));
    }

    // Run cleanup handlers
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error(chalk.red(`Cleanup handler failed: ${error.message}`));
      }
    }

    // Cleanup old operations
    this.cleanupOldOperations();

    console.log(chalk.green('Cleanup completed'));
  }

  /**
   * Add cleanup handler
   */
  addCleanupHandler(handler) {
    if (typeof handler === 'function') {
      this.cleanupHandlers.add(handler);
    }
  }

  /**
   * Remove cleanup handler
   */
  removeCleanupHandler(handler) {
    this.cleanupHandlers.delete(handler);
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const shutdownHandler = async (signal) => {
      console.log(chalk.yellow(`\nReceived ${signal}, shutting down gracefully...`));
      
      try {
        await this.cleanupAll();
        process.exit(0);
      } catch (error) {
        console.error(chalk.red(`Shutdown error: ${error.message}`));
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGQUIT', () => shutdownHandler('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('Uncaught Exception:'), error);
      await this.cleanupAll();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
      await this.cleanupAll();
      process.exit(1);
    });
  }

  /**
   * Execute operation with automatic management and performance monitoring
   */
  static async execute(type, operation, metadata = {}) {
    const manager = OperationManager.getInstance();
    const profiler = PerformanceProfiler.getInstance();
    let operationId = null;

    try {
      operationId = await manager.startOperation(type, metadata);
      
      // Profile the operation if profiling is enabled
      const result = await profiler.profileCommand(type, async () => {
        return await operation(operationId);
      }, { operationId, metadata });
      
      await manager.completeOperation(operationId, result);
      
      return {
        success: true,
        result,
        operationId
      };
    } catch (error) {
      if (operationId) {
        await manager.failOperation(operationId, error);
      }
      
      return {
        success: false,
        error: error.message,
        operationId
      };
    }
  }
}

module.exports = OperationManager;  
/**
   * Sanitize metadata for audit logging
   */
  sanitizeMetadata(metadata) {
    const sanitized = { ...metadata };
    
    // Remove sensitive information
    const sensitiveFields = ['token', 'password', 'key', 'secret', 'auth'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize result data for audit logging
   */
  sanitizeResult(result) {
    if (!result || typeof result !== 'object') {
      return result;
    }
    
    const sanitized = { ...result };
    
    // Remove sensitive information
    const sensitiveFields = ['token', 'password', 'key', 'secret', 'auth'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }