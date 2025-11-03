/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * PerformanceMonitor - Comprehensive performance monitoring and profiling
 */

const { performance } = require('perf_hooks');
const os = require('os');
const { EventEmitter } = require('events');
const MemoryMonitor = require('./MemoryMonitor');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableCPUProfiling: options.enableCPUProfiling || false,
      enableMemoryProfiling: options.enableMemoryProfiling || true,
      enableNetworkProfiling: options.enableNetworkProfiling || false,
      sampleInterval: options.sampleInterval || 1000, // 1 second
      maxSamples: options.maxSamples || 1000,
      alertThresholds: {
        cpuUsage: options.alertThresholds?.cpuUsage || 80, // 80%
        memoryUsage: options.alertThresholds?.memoryUsage || 85, // 85%
        operationTime: options.alertThresholds?.operationTime || 30000, // 30 seconds
        ...options.alertThresholds
      },
      ...options
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.operations = new Map();
    this.metrics = {
      operations: [],
      system: [],
      alerts: [],
      summary: {
        totalOperations: 0,
        averageOperationTime: 0,
        slowestOperation: null,
        fastestOperation: null,
        totalCPUTime: 0,
        peakMemoryUsage: 0,
        alertCount: 0
      }
    };

    this.memoryMonitor = new MemoryMonitor({
      sampleInterval: this.options.sampleInterval,
      maxSamples: this.options.maxSamples
    });

    this.systemInfo = this.getSystemInfo();
    this.startTime = null;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();

    // Start memory monitoring
    if (this.options.enableMemoryProfiling) {
      this.memoryMonitor.startMonitoring();
    }

    // Start system monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.options.sampleInterval);

    this.emit('monitoring:started', {
      timestamp: new Date().toISOString(),
      options: this.options
    });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Stop memory monitoring
    if (this.memoryMonitor.isMonitoring) {
      this.memoryMonitor.stopMonitoring();
    }

    // Stop system monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Calculate final summary
    this.calculateSummary();

    this.emit('monitoring:stopped', {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: this.metrics.summary
    });
  }

  /**
   * Start profiling an operation
   * @param {string} operationName - Name of the operation
   * @param {Object} metadata - Additional metadata
   * @returns {string} Operation ID
   */
  startOperation(operationName, metadata = {}) {
    const operationId = this.generateOperationId();
    const operation = {
      id: operationId,
      name: operationName,
      startTime: performance.now(),
      startTimestamp: Date.now(),
      metadata,
      memoryStart: process.memoryUsage(),
      cpuStart: process.cpuUsage(),
      status: 'running',
      endTime: null,
      duration: null,
      memoryEnd: null,
      cpuEnd: null,
      memoryDelta: null,
      cpuDelta: null,
      error: null
    };

    this.operations.set(operationId, operation);

    this.emit('operation:started', {
      operationId,
      name: operationName,
      timestamp: new Date().toISOString()
    });

    return operationId;
  }

  /**
   * End profiling an operation
   * @param {string} operationId - Operation ID
   * @param {Object} result - Operation result
   */
  endOperation(operationId, result = null) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const endTime = performance.now();
    const memoryEnd = process.memoryUsage();
    const cpuEnd = process.cpuUsage();

    // Calculate metrics
    operation.endTime = endTime;
    operation.duration = endTime - operation.startTime;
    operation.memoryEnd = memoryEnd;
    operation.cpuEnd = cpuEnd;
    operation.memoryDelta = {
      heapUsed: memoryEnd.heapUsed - operation.memoryStart.heapUsed,
      heapTotal: memoryEnd.heapTotal - operation.memoryStart.heapTotal,
      external: memoryEnd.external - operation.memoryStart.external,
      rss: memoryEnd.rss - operation.memoryStart.rss
    };
    operation.cpuDelta = {
      user: cpuEnd.user - operation.cpuStart.user,
      system: cpuEnd.system - operation.cpuStart.system
    };
    operation.status = 'completed';
    operation.result = result;

    // Add to metrics
    this.metrics.operations.push(operation);

    // Check for performance alerts
    this.checkOperationAlerts(operation);

    this.emit('operation:completed', {
      operationId,
      name: operation.name,
      duration: operation.duration,
      memoryDelta: operation.memoryDelta,
      timestamp: new Date().toISOString()
    });

    return operation;
  }

  /**
   * Mark operation as failed
   * @param {string} operationId - Operation ID
   * @param {Error} error - Error that occurred
   */
  failOperation(operationId, error) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const endTime = performance.now();
    operation.endTime = endTime;
    operation.duration = endTime - operation.startTime;
    operation.status = 'failed';
    operation.error = error.message;

    this.metrics.operations.push(operation);

    this.emit('operation:failed', {
      operationId,
      name: operation.name,
      duration: operation.duration,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return operation;
  }

  /**
   * Collect system performance metrics
   * @private
   */
  collectSystemMetrics() {
    const cpuUsage = this.getCPUUsage();
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    const metrics = {
      timestamp: Date.now(),
      cpu: cpuUsage,
      memory: {
        process: memoryUsage,
        system: systemMemory,
        utilization: {
          process: memoryUsage.heapUsed / memoryUsage.heapTotal,
          system: systemMemory.used / systemMemory.total
        }
      },
      loadAverage: os.loadavg(),
      uptime: os.uptime()
    };

    this.metrics.system.push(metrics);

    // Keep only recent samples
    if (this.metrics.system.length > this.options.maxSamples) {
      this.metrics.system.shift();
    }

    // Check for system alerts
    this.checkSystemAlerts(metrics);

    this.emit('metrics:collected', metrics);
  }

  /**
   * Get CPU usage percentage
   * @private
   */
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage,
      cores: cpus.length,
      model: cpus[0].model,
      speed: cpus[0].speed
    };
  }

  /**
   * Check for operation performance alerts
   * @private
   */
  checkOperationAlerts(operation) {
    const alerts = [];

    // Check operation duration
    if (operation.duration > this.options.alertThresholds.operationTime) {
      alerts.push({
        type: 'slow_operation',
        severity: 'warning',
        message: `Operation '${operation.name}' took ${Math.round(operation.duration)}ms (threshold: ${this.options.alertThresholds.operationTime}ms)`,
        operation: operation.name,
        value: operation.duration,
        threshold: this.options.alertThresholds.operationTime
      });
    }

    // Check memory usage
    if (operation.memoryDelta && operation.memoryDelta.heapUsed > 100 * 1024 * 1024) { // 100MB
      alerts.push({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `Operation '${operation.name}' used ${Math.round(operation.memoryDelta.heapUsed / 1024 / 1024)}MB of memory`,
        operation: operation.name,
        value: operation.memoryDelta.heapUsed,
        threshold: 100 * 1024 * 1024
      });
    }

    // Add alerts to metrics
    alerts.forEach(alert => {
      alert.timestamp = Date.now();
      alert.operationId = operation.id;
      this.metrics.alerts.push(alert);
      this.emit('alert', alert);
    });
  }

  /**
   * Check for system performance alerts
   * @private
   */
  checkSystemAlerts(metrics) {
    const alerts = [];

    // Check CPU usage
    if (metrics.cpu.usage > this.options.alertThresholds.cpuUsage) {
      alerts.push({
        type: 'high_cpu_usage',
        severity: 'warning',
        message: `High CPU usage detected: ${metrics.cpu.usage}% (threshold: ${this.options.alertThresholds.cpuUsage}%)`,
        value: metrics.cpu.usage,
        threshold: this.options.alertThresholds.cpuUsage
      });
    }

    // Check system memory usage
    if (metrics.memory.utilization.system > this.options.alertThresholds.memoryUsage / 100) {
      alerts.push({
        type: 'high_system_memory',
        severity: 'warning',
        message: `High system memory usage: ${Math.round(metrics.memory.utilization.system * 100)}% (threshold: ${this.options.alertThresholds.memoryUsage}%)`,
        value: metrics.memory.utilization.system * 100,
        threshold: this.options.alertThresholds.memoryUsage
      });
    }

    // Add alerts to metrics
    alerts.forEach(alert => {
      alert.timestamp = metrics.timestamp;
      this.metrics.alerts.push(alert);
      this.emit('alert', alert);
    });
  }

  /**
   * Calculate performance summary
   * @private
   */
  calculateSummary() {
    const operations = this.metrics.operations;
    
    if (operations.length === 0) {
      return;
    }

    const completedOps = operations.filter(op => op.status === 'completed');
    const durations = completedOps.map(op => op.duration);
    
    this.metrics.summary = {
      totalOperations: operations.length,
      completedOperations: completedOps.length,
      failedOperations: operations.filter(op => op.status === 'failed').length,
      averageOperationTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      slowestOperation: completedOps.reduce((prev, current) => 
        (prev.duration > current.duration) ? prev : current, completedOps[0]),
      fastestOperation: completedOps.reduce((prev, current) => 
        (prev.duration < current.duration) ? prev : current, completedOps[0]),
      totalCPUTime: completedOps.reduce((total, op) => 
        total + (op.cpuDelta ? op.cpuDelta.user + op.cpuDelta.system : 0), 0),
      peakMemoryUsage: Math.max(...completedOps.map(op => 
        op.memoryEnd ? op.memoryEnd.heapUsed : 0)),
      alertCount: this.metrics.alerts.length,
      monitoringDuration: Date.now() - this.startTime
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    this.calculateSummary();
    
    return {
      ...this.metrics,
      isMonitoring: this.isMonitoring,
      startTime: this.startTime,
      systemInfo: this.systemInfo,
      memoryMonitor: this.memoryMonitor.getStats()
    };
  }

  /**
   * Get performance report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const recentAlerts = metrics.alerts.slice(-10);
    const topSlowOperations = metrics.operations
      .filter(op => op.status === 'completed')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      timestamp: new Date().toISOString(),
      summary: metrics.summary,
      systemInfo: metrics.systemInfo,
      recentAlerts,
      topSlowOperations: topSlowOperations.map(op => ({
        name: op.name,
        duration: Math.round(op.duration),
        memoryUsed: op.memoryDelta ? Math.round(op.memoryDelta.heapUsed / 1024 / 1024) : 0,
        timestamp: new Date(op.startTimestamp).toISOString()
      })),
      recommendations: this.generateRecommendations(metrics),
      charts: this.generateChartData(metrics)
    };
  }

  /**
   * Generate performance recommendations
   * @private
   */
  generateRecommendations(metrics) {
    const recommendations = [];
    const { summary, alerts } = metrics;

    // Check for slow operations
    if (summary.averageOperationTime > 5000) { // 5 seconds
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Average operation time is high',
        suggestion: 'Consider optimizing slow operations or using batch processing',
        value: Math.round(summary.averageOperationTime),
        threshold: 5000
      });
    }

    // Check for frequent alerts
    const recentAlerts = alerts.filter(alert => 
      Date.now() - alert.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );
    
    if (recentAlerts.length > 5) {
      recommendations.push({
        type: 'alerts',
        priority: 'medium',
        message: 'Frequent performance alerts detected',
        suggestion: 'Review system resources and optimize operations',
        value: recentAlerts.length,
        threshold: 5
      });
    }

    // Check memory usage patterns
    const highMemoryOps = metrics.operations.filter(op => 
      op.memoryDelta && op.memoryDelta.heapUsed > 50 * 1024 * 1024 // 50MB
    );
    
    if (highMemoryOps.length > metrics.operations.length * 0.3) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Many operations are using high memory',
        suggestion: 'Consider implementing streaming or chunked processing',
        value: highMemoryOps.length,
        threshold: Math.round(metrics.operations.length * 0.3)
      });
    }

    return recommendations;
  }

  /**
   * Generate chart data for visualization
   * @private
   */
  generateChartData(metrics) {
    const systemMetrics = metrics.system.slice(-50); // Last 50 samples
    
    return {
      cpuUsage: {
        labels: systemMetrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
        data: systemMetrics.map(m => m.cpu.usage)
      },
      memoryUsage: {
        labels: systemMetrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
        data: systemMetrics.map(m => Math.round(m.memory.utilization.system * 100))
      },
      operationDurations: {
        labels: metrics.operations.slice(-20).map(op => op.name),
        data: metrics.operations.slice(-20).map(op => Math.round(op.duration))
      }
    };
  }

  /**
   * Export performance data
   * @param {string} format - Export format (json, csv)
   */
  exportData(format = 'json') {
    const metrics = this.getMetrics();
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      
      case 'csv':
        const operations = metrics.operations;
        const headers = ['name', 'duration', 'status', 'memoryUsed', 'cpuTime', 'timestamp'];
        const rows = [headers.join(',')];
        
        operations.forEach(op => {
          const row = [
            op.name,
            Math.round(op.duration || 0),
            op.status,
            op.memoryDelta ? Math.round(op.memoryDelta.heapUsed / 1024 / 1024) : 0,
            op.cpuDelta ? op.cpuDelta.user + op.cpuDelta.system : 0,
            new Date(op.startTimestamp).toISOString()
          ];
          rows.push(row.join(','));
        });
        
        return rows.join('\n');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get system information
   * @private
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total: os.totalmem(),
        totalGB: Math.round(os.totalmem() / 1024 / 1024 / 1024)
      },
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      hostname: os.hostname(),
      uptime: os.uptime()
    };
  }

  /**
   * Generate unique operation ID
   * @private
   */
  generateOperationId() {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format duration to human readable format
   * @private
   */
  formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
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
   * Create a performance profiler for a specific operation
   */
  createProfiler(operationName, metadata = {}) {
    const operationId = this.startOperation(operationName, metadata);
    
    return {
      operationId,
      end: (result) => this.endOperation(operationId, result),
      fail: (error) => this.failOperation(operationId, error),
      addMetadata: (key, value) => {
        const operation = this.operations.get(operationId);
        if (operation) {
          operation.metadata[key] = value;
        }
      }
    };
  }

  /**
   * Measure execution time of a function
   */
  async measureFunction(name, fn, metadata = {}) {
    const profiler = this.createProfiler(name, metadata);
    
    try {
      const result = await fn();
      profiler.end(result);
      return result;
    } catch (error) {
      profiler.fail(error);
      throw error;
    }
  }
}

module.exports = PerformanceMonitor;