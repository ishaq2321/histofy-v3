/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * StreamingGitManager - Memory-efficient streaming operations for large repositories
 */

const { Transform, Readable } = require('stream');
const { pipeline } = require('stream/promises');
const GitManager = require('../core/GitManager');
const MemoryMonitor = require('./MemoryMonitor');
const { ProgressUtils } = require('./progress');
const chalk = require('chalk');

class StreamingGitManager extends GitManager {
  constructor(repoPath = null) {
    super(repoPath);
    this.memoryMonitor = new MemoryMonitor();
    this.chunkSize = 100; // Default chunk size for batch processing
    this.memoryThreshold = 500 * 1024 * 1024; // 500MB memory threshold
  }

  /**
   * Stream commit history in chunks to avoid memory issues
   * @param {Object} options - Streaming options
   * @returns {AsyncGenerator} Async generator yielding commit chunks
   */
  async* streamCommitHistory(options = {}) {
    const {
      since = null,
      until = null,
      author = null,
      branch = null,
      chunkSize = this.chunkSize,
      includeFiles = false,
      includeDiffs = false
    } = options;

    this.memoryMonitor.startMonitoring();
    
    try {
      // Get total commit count for progress tracking
      const totalCommits = await this.getCommitCount({ since, until, author, branch });
      const progress = ProgressUtils.progress(totalCommits, {
        format: 'Streaming commits: {bar} {percentage}% | {value}/{total} | ETA: {eta}s | Memory: {memory}MB',
        showMemory: true
      });

      let offset = 0;
      let processedCommits = 0;

      while (processedCommits < totalCommits) {
        // Check memory usage before processing next chunk
        const memoryUsage = this.memoryMonitor.getCurrentUsage();
        if (memoryUsage.heapUsed > this.memoryThreshold) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          
          // Wait a bit for memory to be freed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const newMemoryUsage = this.memoryMonitor.getCurrentUsage();
          if (newMemoryUsage.heapUsed > this.memoryThreshold) {
            console.warn(chalk.yellow(`Warning: High memory usage detected (${Math.round(newMemoryUsage.heapUsed / 1024 / 1024)}MB)`));
          }
        }

        // Fetch chunk of commits
        const commits = await this.getCommitHistory({
          since,
          until,
          author,
          branch,
          limit: chunkSize,
          offset,
          includeFiles,
          includeDiffs
        });

        if (commits.length === 0) {
          break;
        }

        processedCommits += commits.length;
        offset += chunkSize;

        // Update progress with memory info
        progress.update(processedCommits, {
          memory: Math.round(memoryUsage.heapUsed / 1024 / 1024)
        });

        yield {
          commits,
          chunk: Math.ceil(processedCommits / chunkSize),
          totalChunks: Math.ceil(totalCommits / chunkSize),
          processedCommits,
          totalCommits,
          memoryUsage: this.memoryMonitor.getCurrentUsage()
        };
      }

      progress.stop();
    } finally {
      this.memoryMonitor.stopMonitoring();
    }
  }

  /**
   * Process commits in streaming fashion with a transform function
   * @param {Function} transformFn - Function to transform each commit chunk
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  async processCommitsStreaming(transformFn, options = {}) {
    const {
      concurrency = 1,
      onProgress = null,
      onError = null,
      continueOnError = false
    } = options;

    const results = {
      totalProcessed: 0,
      totalErrors: 0,
      chunks: [],
      errors: [],
      memoryStats: {
        peak: 0,
        average: 0,
        samples: []
      }
    };

    const memoryStats = [];
    let chunkIndex = 0;

    try {
      for await (const chunk of this.streamCommitHistory(options)) {
        chunkIndex++;
        
        // Track memory usage
        const memoryUsage = chunk.memoryUsage.heapUsed;
        memoryStats.push(memoryUsage);
        results.memoryStats.peak = Math.max(results.memoryStats.peak, memoryUsage);

        try {
          // Process chunk with transform function
          const transformResult = await transformFn(chunk.commits, {
            chunkIndex,
            totalChunks: chunk.totalChunks,
            processedCommits: chunk.processedCommits,
            totalCommits: chunk.totalCommits
          });

          results.chunks.push({
            index: chunkIndex,
            size: chunk.commits.length,
            result: transformResult,
            memoryUsage
          });

          results.totalProcessed += chunk.commits.length;

          if (onProgress) {
            onProgress({
              chunk: chunkIndex,
              totalChunks: chunk.totalChunks,
              processed: results.totalProcessed,
              total: chunk.totalCommits,
              memoryUsage
            });
          }

        } catch (error) {
          results.totalErrors++;
          const errorInfo = {
            chunk: chunkIndex,
            error: error.message,
            commits: chunk.commits.length
          };
          
          results.errors.push(errorInfo);

          if (onError) {
            onError(errorInfo);
          }

          if (!continueOnError) {
            throw error;
          }
        }
      }

      // Calculate memory statistics
      if (memoryStats.length > 0) {
        results.memoryStats.average = memoryStats.reduce((a, b) => a + b, 0) / memoryStats.length;
        results.memoryStats.samples = memoryStats;
      }

      return results;

    } catch (error) {
      throw new Error(`Streaming processing failed: ${error.message}`);
    }
  }

  /**
   * Create a readable stream of commits
   * @param {Object} options - Stream options
   * @returns {Readable} Readable stream of commits
   */
  createCommitStream(options = {}) {
    const streamingOptions = { ...options };
    const commitGenerator = this.streamCommitHistory(streamingOptions);

    return new Readable({
      objectMode: true,
      async read() {
        try {
          const { value, done } = await commitGenerator.next();
          
          if (done) {
            this.push(null); // End of stream
          } else {
            this.push(value);
          }
        } catch (error) {
          this.destroy(error);
        }
      }
    });
  }

  /**
   * Create a transform stream for processing commits
   * @param {Function} transformFn - Transform function
   * @param {Object} options - Transform options
   * @returns {Transform} Transform stream
   */
  createCommitTransform(transformFn, options = {}) {
    const { 
      highWaterMark = 16,
      objectMode = true 
    } = options;

    return new Transform({
      objectMode,
      highWaterMark,
      async transform(chunk, encoding, callback) {
        try {
          const result = await transformFn(chunk);
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Pipeline commits through multiple transform streams
   * @param {Array} transforms - Array of transform functions or streams
   * @param {Object} options - Pipeline options
   * @returns {Promise<Array>} Pipeline results
   */
  async pipelineCommits(transforms, options = {}) {
    const results = [];
    const commitStream = this.createCommitStream(options);

    // Create transform streams
    const transformStreams = transforms.map(transform => {
      if (typeof transform === 'function') {
        return this.createCommitTransform(transform);
      }
      return transform; // Assume it's already a stream
    });

    // Add result collector
    const collector = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        results.push(chunk);
        callback(null, chunk);
      }
    });

    try {
      await pipeline(
        commitStream,
        ...transformStreams,
        collector
      );

      return results;
    } catch (error) {
      throw new Error(`Pipeline processing failed: ${error.message}`);
    }
  }

  /**
   * Get commit count efficiently without loading all commits
   * @param {Object} options - Count options
   * @returns {Promise<number>} Total commit count
   */
  async getCommitCount(options = {}) {
    const {
      since = null,
      until = null,
      author = null,
      branch = null
    } = options;

    try {
      const args = ['rev-list', '--count'];
      
      if (since) args.push(`--since=${since}`);
      if (until) args.push(`--until=${until}`);
      if (author) args.push(`--author=${author}`);
      
      args.push(branch || 'HEAD');

      const result = await this.git.raw(args);
      return parseInt(result.trim(), 10);
    } catch (error) {
      throw new Error(`Failed to get commit count: ${error.message}`);
    }
  }

  /**
   * Batch process large operations with memory management
   * @param {Array} items - Items to process
   * @param {Function} processFn - Processing function
   * @param {Object} options - Batch options
   * @returns {Promise<Object>} Batch results
   */
  async batchProcess(items, processFn, options = {}) {
    const {
      batchSize = this.chunkSize,
      concurrency = 1,
      memoryThreshold = this.memoryThreshold,
      onProgress = null
    } = options;

    const results = {
      totalProcessed: 0,
      totalErrors: 0,
      batches: [],
      errors: [],
      memoryStats: []
    };

    this.memoryMonitor.startMonitoring();

    try {
      const totalBatches = Math.ceil(items.length / batchSize);
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchIndex = Math.floor(i / batchSize) + 1;

        // Memory check before processing batch
        const memoryBefore = this.memoryMonitor.getCurrentUsage();
        
        if (memoryBefore.heapUsed > memoryThreshold) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
          const batchResult = await processFn(batch, {
            batchIndex,
            totalBatches,
            batchSize: batch.length
          });

          const memoryAfter = this.memoryMonitor.getCurrentUsage();
          
          results.batches.push({
            index: batchIndex,
            size: batch.length,
            result: batchResult,
            memoryUsage: {
              before: memoryBefore.heapUsed,
              after: memoryAfter.heapUsed,
              delta: memoryAfter.heapUsed - memoryBefore.heapUsed
            }
          });

          results.totalProcessed += batch.length;
          results.memoryStats.push(memoryAfter.heapUsed);

          if (onProgress) {
            onProgress({
              batch: batchIndex,
              totalBatches,
              processed: results.totalProcessed,
              total: items.length,
              memoryUsage: memoryAfter
            });
          }

        } catch (error) {
          results.totalErrors++;
          results.errors.push({
            batch: batchIndex,
            error: error.message,
            items: batch.length
          });
        }
      }

      return results;

    } finally {
      this.memoryMonitor.stopMonitoring();
    }
  }

  /**
   * Optimize repository for better streaming performance
   * @returns {Promise<Object>} Optimization results
   */
  async optimizeForStreaming() {
    const progress = ProgressUtils.spinner('Optimizing repository for streaming...');
    progress.start();

    try {
      const optimizations = [];

      // Run git gc to optimize repository
      progress.update('Running garbage collection...');
      await this.git.raw(['gc', '--aggressive']);
      optimizations.push('garbage_collection');

      // Repack objects for better performance
      progress.update('Repacking objects...');
      await this.git.raw(['repack', '-a', '-d']);
      optimizations.push('repack_objects');

      // Update server info for better performance
      progress.update('Updating server info...');
      try {
        await this.git.raw(['update-server-info']);
        optimizations.push('update_server_info');
      } catch (error) {
        // Not critical, continue
      }

      progress.succeed('Repository optimized for streaming');

      return {
        success: true,
        optimizations,
        message: 'Repository optimized for better streaming performance'
      };

    } catch (error) {
      progress.fail('Optimization failed');
      throw new Error(`Repository optimization failed: ${error.message}`);
    }
  }

  /**
   * Get streaming performance metrics
   * @returns {Object} Performance metrics
   */
  getStreamingMetrics() {
    return {
      chunkSize: this.chunkSize,
      memoryThreshold: this.memoryThreshold,
      memoryMonitor: this.memoryMonitor.getStats(),
      recommendations: this.getPerformanceRecommendations()
    };
  }

  /**
   * Get performance recommendations based on current metrics
   * @private
   */
  getPerformanceRecommendations() {
    const recommendations = [];
    const memoryStats = this.memoryMonitor.getStats();

    if (memoryStats.peak > this.memoryThreshold) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Consider reducing chunk size or increasing memory threshold',
        suggestion: `Current peak: ${Math.round(memoryStats.peak / 1024 / 1024)}MB`
      });
    }

    if (this.chunkSize > 500) {
      recommendations.push({
        type: 'chunk_size',
        priority: 'medium',
        message: 'Large chunk size may cause memory issues',
        suggestion: 'Consider reducing chunk size to 100-200 commits'
      });
    }

    return recommendations;
  }

  /**
   * Configure streaming parameters based on system resources
   * @param {Object} systemInfo - System information
   */
  configureForSystem(systemInfo = {}) {
    const {
      totalMemory = 8 * 1024 * 1024 * 1024, // 8GB default
      availableMemory = 4 * 1024 * 1024 * 1024, // 4GB default
      cpuCores = 4
    } = systemInfo;

    // Adjust chunk size based on available memory
    if (availableMemory < 2 * 1024 * 1024 * 1024) { // Less than 2GB
      this.chunkSize = 50;
      this.memoryThreshold = 200 * 1024 * 1024; // 200MB
    } else if (availableMemory < 4 * 1024 * 1024 * 1024) { // Less than 4GB
      this.chunkSize = 100;
      this.memoryThreshold = 400 * 1024 * 1024; // 400MB
    } else { // 4GB or more
      this.chunkSize = 200;
      this.memoryThreshold = 800 * 1024 * 1024; // 800MB
    }

    return {
      chunkSize: this.chunkSize,
      memoryThreshold: this.memoryThreshold,
      recommendedConcurrency: Math.min(cpuCores, 4)
    };
  }
}

module.exports = StreamingGitManager;