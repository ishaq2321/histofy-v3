/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * GitOperationOptimizer - Optimizes Git operations for better performance
 */

const GitManager = require('../core/GitManager');
const MemoryMonitor = require('./MemoryMonitor');
const { ProgressUtils } = require('./progress');
const chalk = require('chalk');

class GitOperationOptimizer extends GitManager {
  constructor(repoPath = null) {
    super(repoPath);
    this.operationCache = new Map();
    this.batchQueue = [];
    this.connectionPool = new Map();
    this.optimizationStats = {
      cacheHits: 0,
      cacheMisses: 0,
      batchedOperations: 0,
      optimizedQueries: 0,
      timeSaved: 0
    };
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxBatchSize = 50;
    this.batchTimeout = 1000; // 1 second
  }

  /**
   * Execute multiple Git operations in an optimized batch
   * @param {Array} operations - Array of operation objects
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} Array of results
   */
  async executeBatch(operations, options = {}) {
    const {
      maxConcurrency = 3,
      continueOnError = false,
      enableCaching = true,
      optimizeOrder = true
    } = options;

    if (operations.length === 0) {
      return [];
    }

    const startTime = Date.now();
    const progress = ProgressUtils.progress(operations.length, {
      format: 'Executing batch: {bar} {percentage}% | {value}/{total} | ETA: {eta}s'
    });

    try {
      // Optimize operation order for better performance
      const optimizedOperations = optimizeOrder ? 
        this.optimizeOperationOrder(operations) : operations;

      // Group operations by type for batching
      const groupedOperations = this.groupOperationsByType(optimizedOperations);

      const results = [];
      let completedOperations = 0;

      // Process each group
      for (const [operationType, ops] of groupedOperations) {
        const groupResults = await this.executeOperationGroup(
          operationType, 
          ops, 
          { maxConcurrency, continueOnError, enableCaching }
        );

        results.push(...groupResults);
        completedOperations += ops.length;
        progress.update(completedOperations);
      }

      progress.stop();

      // Update statistics
      this.optimizationStats.batchedOperations += operations.length;
      this.optimizationStats.timeSaved += this.estimateTimeSaved(operations.length);

      const endTime = Date.now();
      
      return {
        success: true,
        results,
        duration: endTime - startTime,
        operationsProcessed: operations.length,
        optimizationStats: this.getOptimizationStats()
      };

    } catch (error) {
      progress.fail('Batch execution failed');
      throw new Error(`Batch execution failed: ${error.message}`);
    }
  }

  /**
   * Optimize the order of operations for better performance
   * @private
   */
  optimizeOperationOrder(operations) {
    // Priority order: read operations first, then writes
    const priorities = {
      'log': 1,
      'show': 1,
      'status': 1,
      'branch': 1,
      'rev-parse': 1,
      'commit': 2,
      'add': 2,
      'reset': 3,
      'checkout': 3,
      'merge': 4,
      'rebase': 4
    };

    return operations.sort((a, b) => {
      const priorityA = priorities[a.type] || 5;
      const priorityB = priorities[b.type] || 5;
      return priorityA - priorityB;
    });
  }

  /**
   * Group operations by type for efficient batching
   * @private
   */
  groupOperationsByType(operations) {
    const groups = new Map();
    
    operations.forEach(operation => {
      const type = operation.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type).push(operation);
    });

    return groups;
  }

  /**
   * Execute a group of operations of the same type
   * @private
   */
  async executeOperationGroup(operationType, operations, options) {
    const { maxConcurrency, continueOnError, enableCaching } = options;

    // Check if this operation type can be optimized
    if (this.canOptimizeOperationType(operationType)) {
      return await this.executeOptimizedGroup(operationType, operations, options);
    }

    // Execute operations with concurrency control
    const results = [];
    const chunks = this.chunkArray(operations, maxConcurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (operation) => {
        try {
          return await this.executeOptimizedOperation(operation, enableCaching);
        } catch (error) {
          if (continueOnError) {
            return { success: false, error: error.message, operation };
          }
          throw error;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Execute an optimized operation with caching
   * @private
   */
  async executeOptimizedOperation(operation, enableCaching = true) {
    const cacheKey = this.generateCacheKey(operation);
    
    // Check cache first
    if (enableCaching && this.operationCache.has(cacheKey)) {
      const cached = this.operationCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.optimizationStats.cacheHits++;
        return { ...cached.result, fromCache: true };
      } else {
        this.operationCache.delete(cacheKey);
      }
    }

    // Execute operation
    const startTime = Date.now();
    let result;

    try {
      result = await this.executeGitOperation(operation);
      
      // Cache successful results for read operations
      if (enableCaching && this.isReadOperation(operation)) {
        this.operationCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }

      this.optimizationStats.cacheMisses++;
      this.optimizationStats.optimizedQueries++;

    } catch (error) {
      throw new Error(`Operation ${operation.type} failed: ${error.message}`);
    }

    const endTime = Date.now();
    
    return {
      ...result,
      duration: endTime - startTime,
      fromCache: false
    };
  }

  /**
   * Execute optimized group operations for specific types
   * @private
   */
  async executeOptimizedGroup(operationType, operations, options) {
    switch (operationType) {
      case 'log':
        return await this.executeOptimizedLogGroup(operations, options);
      case 'show':
        return await this.executeOptimizedShowGroup(operations, options);
      case 'status':
        return await this.executeOptimizedStatusGroup(operations, options);
      default:
        return await this.executeOperationGroup(operationType, operations, options);
    }
  }

  /**
   * Execute optimized log operations
   * @private
   */
  async executeOptimizedLogGroup(operations, options) {
    // Combine multiple log requests into fewer, more efficient queries
    const combinedRanges = this.combineLogRanges(operations);
    const results = [];

    for (const range of combinedRanges) {
      try {
        const logResult = await this.git.log({
          from: range.from,
          to: range.to,
          maxCount: range.maxCount,
          format: range.format
        });

        // Split results back to individual operations
        const splitResults = this.splitLogResults(logResult, range.originalOperations);
        results.push(...splitResults);

      } catch (error) {
        if (options.continueOnError) {
          range.originalOperations.forEach(op => {
            results.push({ success: false, error: error.message, operation: op });
          });
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Execute optimized show operations
   * @private
   */
  async executeOptimizedShowGroup(operations, options) {
    // Batch show operations for better performance
    const batchSize = 10;
    const results = [];
    const chunks = this.chunkArray(operations, batchSize);

    for (const chunk of chunks) {
      try {
        // Use git cat-file for batch object retrieval
        const hashes = chunk.map(op => op.args[0]).filter(Boolean);
        
        if (hashes.length > 0) {
          const batchResult = await this.git.raw(['cat-file', '--batch-check', '--batch-all-objects']);
          const parsedResults = this.parseBatchCatFileResult(batchResult, chunk);
          results.push(...parsedResults);
        }

      } catch (error) {
        if (options.continueOnError) {
          chunk.forEach(op => {
            results.push({ success: false, error: error.message, operation: op });
          });
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Execute optimized status operations
   * @private
   */
  async executeOptimizedStatusGroup(operations, options) {
    // Status operations can often be combined into a single call
    try {
      const statusResult = await this.git.status();
      
      // Return the same result for all status operations
      return operations.map(operation => ({
        success: true,
        result: statusResult,
        operation,
        optimized: true
      }));

    } catch (error) {
      if (options.continueOnError) {
        return operations.map(operation => ({
          success: false,
          error: error.message,
          operation
        }));
      }
      throw error;
    }
  }

  /**
   * Execute a single Git operation
   * @private
   */
  async executeGitOperation(operation) {
    const { type, args = [], options = {} } = operation;

    switch (type) {
      case 'log':
        return await this.git.log(options);
      case 'show':
        return await this.git.show(args);
      case 'status':
        return await this.git.status();
      case 'branch':
        return await this.git.branch(args);
      case 'rev-parse':
        return await this.git.raw(['rev-parse', ...args]);
      case 'commit':
        return await this.git.commit(args[0], options);
      case 'add':
        return await this.git.add(args);
      case 'reset':
        return await this.git.reset(args);
      case 'checkout':
        return await this.git.checkout(args);
      default:
        return await this.git.raw([type, ...args]);
    }
  }

  /**
   * Combine log ranges for more efficient queries
   * @private
   */
  combineLogRanges(operations) {
    // Group operations by similar parameters
    const groups = new Map();
    
    operations.forEach(operation => {
      const key = JSON.stringify({
        format: operation.options?.format,
        author: operation.options?.author,
        since: operation.options?.since,
        until: operation.options?.until
      });
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(operation);
    });

    // Create combined ranges
    const combinedRanges = [];
    
    groups.forEach((ops, key) => {
      const params = JSON.parse(key);
      const maxCount = ops.reduce((sum, op) => sum + (op.options?.maxCount || 100), 0);
      
      combinedRanges.push({
        ...params,
        maxCount,
        from: ops[0].options?.from || 'HEAD',
        to: ops[0].options?.to,
        originalOperations: ops
      });
    });

    return combinedRanges;
  }

  /**
   * Split combined log results back to individual operations
   * @private
   */
  splitLogResults(logResult, originalOperations) {
    const results = [];
    let currentIndex = 0;

    originalOperations.forEach(operation => {
      const requestedCount = operation.options?.maxCount || 100;
      const operationCommits = logResult.all.slice(currentIndex, currentIndex + requestedCount);
      
      results.push({
        success: true,
        result: {
          all: operationCommits,
          latest: operationCommits[0] || null,
          total: operationCommits.length
        },
        operation,
        optimized: true
      });

      currentIndex += requestedCount;
    });

    return results;
  }

  /**
   * Parse batch cat-file results
   * @private
   */
  parseBatchCatFileResult(batchResult, operations) {
    const lines = batchResult.split('\n').filter(line => line.trim());
    const results = [];

    operations.forEach((operation, index) => {
      const line = lines[index];
      if (line) {
        const [hash, type, size] = line.split(' ');
        results.push({
          success: true,
          result: { hash, type, size: parseInt(size) },
          operation,
          optimized: true
        });
      } else {
        results.push({
          success: false,
          error: 'Object not found',
          operation
        });
      }
    });

    return results;
  }

  /**
   * Check if operation type can be optimized
   * @private
   */
  canOptimizeOperationType(operationType) {
    const optimizableTypes = ['log', 'show', 'status', 'rev-parse'];
    return optimizableTypes.includes(operationType);
  }

  /**
   * Check if operation is a read operation (cacheable)
   * @private
   */
  isReadOperation(operation) {
    const readOperations = ['log', 'show', 'status', 'branch', 'rev-parse', 'diff'];
    return readOperations.includes(operation.type);
  }

  /**
   * Generate cache key for operation
   * @private
   */
  generateCacheKey(operation) {
    return JSON.stringify({
      type: operation.type,
      args: operation.args,
      options: operation.options
    });
  }

  /**
   * Split array into chunks
   * @private
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Estimate time saved by optimization
   * @private
   */
  estimateTimeSaved(operationCount) {
    // Rough estimate: each optimization saves ~50ms per operation
    return operationCount * 50;
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    const totalOperations = this.optimizationStats.cacheHits + this.optimizationStats.cacheMisses;
    const cacheHitRate = totalOperations > 0 ? 
      (this.optimizationStats.cacheHits / totalOperations) * 100 : 0;

    return {
      ...this.optimizationStats,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      totalOperations,
      estimatedTimeSavedMs: this.optimizationStats.timeSaved,
      estimatedTimeSavedFormatted: this.formatDuration(this.optimizationStats.timeSaved)
    };
  }

  /**
   * Clear operation cache
   */
  clearCache() {
    this.operationCache.clear();
    return {
      success: true,
      message: 'Operation cache cleared'
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    this.operationCache.forEach((entry) => {
      if (now - entry.timestamp < this.cacheTimeout) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    });

    return {
      totalEntries: this.operationCache.size,
      validEntries,
      expiredEntries,
      cacheTimeout: this.cacheTimeout,
      memoryUsage: this.estimateCacheMemoryUsage()
    };
  }

  /**
   * Estimate cache memory usage
   * @private
   */
  estimateCacheMemoryUsage() {
    let totalSize = 0;
    
    this.operationCache.forEach((entry, key) => {
      totalSize += key.length * 2; // Rough estimate for string size
      totalSize += JSON.stringify(entry).length * 2;
    });

    return {
      bytes: totalSize,
      formatted: this.formatBytes(totalSize)
    };
  }

  /**
   * Optimize repository for better Git operations
   */
  async optimizeRepository() {
    const progress = ProgressUtils.spinner('Optimizing repository...');
    progress.start();

    const optimizations = [];
    const startTime = Date.now();

    try {
      // Run garbage collection
      progress.update('Running garbage collection...');
      await this.git.raw(['gc', '--auto']);
      optimizations.push('garbage_collection');

      // Optimize pack files
      progress.update('Optimizing pack files...');
      await this.git.raw(['repack', '-a', '-d', '-f']);
      optimizations.push('repack');

      // Update refs
      progress.update('Updating references...');
      await this.git.raw(['pack-refs', '--all']);
      optimizations.push('pack_refs');

      // Prune unreachable objects
      progress.update('Pruning unreachable objects...');
      await this.git.raw(['prune']);
      optimizations.push('prune');

      // Update server info (if applicable)
      try {
        await this.git.raw(['update-server-info']);
        optimizations.push('update_server_info');
      } catch (error) {
        // Not critical, continue
      }

      const endTime = Date.now();
      progress.succeed(`Repository optimized (${endTime - startTime}ms)`);

      return {
        success: true,
        optimizations,
        duration: endTime - startTime,
        message: 'Repository optimized for better performance'
      };

    } catch (error) {
      progress.fail('Repository optimization failed');
      throw new Error(`Repository optimization failed: ${error.message}`);
    }
  }

  /**
   * Create optimized Git operation
   */
  createOperation(type, args = [], options = {}) {
    return {
      type,
      args: Array.isArray(args) ? args : [args],
      options,
      id: this.generateOperationId()
    };
  }

  /**
   * Generate unique operation ID
   * @private
   */
  generateOperationId() {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format duration to human readable format
   * @private
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  }

  /**
   * Format bytes to human readable format
   * @private
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport() {
    const stats = this.getOptimizationStats();
    const cacheStats = this.getCacheStats();

    return {
      timestamp: new Date().toISOString(),
      optimization: {
        totalOperations: stats.totalOperations,
        batchedOperations: stats.batchedOperations,
        optimizedQueries: stats.optimizedQueries,
        timeSaved: stats.estimatedTimeSavedFormatted
      },
      cache: {
        hitRate: `${stats.cacheHitRate}%`,
        totalEntries: cacheStats.totalEntries,
        validEntries: cacheStats.validEntries,
        memoryUsage: cacheStats.memoryUsage.formatted
      },
      recommendations: this.generateOptimizationRecommendations(stats, cacheStats)
    };
  }

  /**
   * Generate optimization recommendations
   * @private
   */
  generateOptimizationRecommendations(stats, cacheStats) {
    const recommendations = [];

    if (stats.cacheHitRate < 30) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        message: 'Low cache hit rate detected',
        action: 'Consider increasing cache timeout or reviewing operation patterns'
      });
    }

    if (cacheStats.expiredEntries > cacheStats.validEntries) {
      recommendations.push({
        type: 'cache_cleanup',
        priority: 'low',
        message: 'Many expired cache entries detected',
        action: 'Consider clearing cache or reducing cache timeout'
      });
    }

    if (stats.batchedOperations < stats.totalOperations * 0.5) {
      recommendations.push({
        type: 'batching',
        priority: 'high',
        message: 'Low batching efficiency',
        action: 'Group similar operations together for better performance'
      });
    }

    return recommendations;
  }
}

module.exports = GitOperationOptimizer;