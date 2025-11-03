/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * PerformanceProfiler - Lightweight profiling utilities for operations
 */

const PerformanceMonitor = require('./PerformanceMonitor');
const chalk = require('chalk');

class PerformanceProfiler {
  constructor() {
    this.monitor = new PerformanceMonitor({
      enableMemoryProfiling: true,
      enableCPUProfiling: true,
      sampleInterval: 2000, // 2 seconds
      alertThresholds: {
        operationTime: 10000, // 10 seconds
        memoryUsage: 80, // 80%
        cpuUsage: 75 // 75%
      }
    });

    this.isEnabled = false;
    this.profiles = new Map();
  }

  /**
   * Enable performance profiling
   */
  enable() {
    if (!this.isEnabled) {
      this.isEnabled = true;
      this.monitor.startMonitoring();
      
      // Setup alert handlers
      this.monitor.on('alert', (alert) => {
        this.handleAlert(alert);
      });
    }
  }

  /**
   * Disable performance profiling
   */
  disable() {
    if (this.isEnabled) {
      this.isEnabled = false;
      this.monitor.stopMonitoring();
    }
  }

  /**
   * Profile a Git operation
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to profile
   * @param {Object} metadata - Additional metadata
   */
  async profileGitOperation(operation, fn, metadata = {}) {
    if (!this.isEnabled) {
      return await fn();
    }

    return await this.monitor.measureFunction(
      `git:${operation}`,
      fn,
      { type: 'git', ...metadata }
    );
  }

  /**
   * Profile a CLI command
   * @param {string} command - Command name
   * @param {Function} fn - Function to profile
   * @param {Object} metadata - Additional metadata
   */
  async profileCommand(command, fn, metadata = {}) {
    if (!this.isEnabled) {
      return await fn();
    }

    return await this.monitor.measureFunction(
      `cli:${command}`,
      fn,
      { type: 'cli', ...metadata }
    );
  }

  /**
   * Profile a utility operation
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to profile
   * @param {Object} metadata - Additional metadata
   */
  async profileUtility(operation, fn, metadata = {}) {
    if (!this.isEnabled) {
      return await fn();
    }

    return await this.monitor.measureFunction(
      `util:${operation}`,
      fn,
      { type: 'utility', ...metadata }
    );
  }

  /**
   * Create a simple timer for manual profiling
   * @param {string} name - Timer name
   */
  startTimer(name) {
    if (!this.isEnabled) {
      return { end: () => {} };
    }

    const profiler = this.monitor.createProfiler(name);
    return {
      end: () => profiler.end(),
      fail: (error) => profiler.fail(error)
    };
  }

  /**
   * Get performance summary
   */
  getSummary() {
    if (!this.isEnabled) {
      return { enabled: false };
    }

    const metrics = this.monitor.getMetrics();
    const summary = metrics.summary;

    return {
      enabled: true,
      totalOperations: summary.totalOperations,
      averageTime: Math.round(summary.averageOperationTime),
      slowestOperation: summary.slowestOperation ? {
        name: summary.slowestOperation.name,
        duration: Math.round(summary.slowestOperation.duration)
      } : null,
      alertCount: summary.alertCount,
      memoryPeak: this.formatBytes(summary.peakMemoryUsage),
      recommendations: this.getQuickRecommendations(metrics)
    };
  }

  /**
   * Generate performance report
   */
  generateReport() {
    if (!this.isEnabled) {
      return { enabled: false, message: 'Performance profiling is disabled' };
    }

    return this.monitor.generateReport();
  }

  /**
   * Handle performance alerts
   * @private
   */
  handleAlert(alert) {
    const severity = alert.severity === 'warning' ? chalk.yellow : chalk.red;
    const icon = alert.severity === 'warning' ? '⚠️' : '🚨';
    
    console.log(severity(`${icon} Performance Alert: ${alert.message}`));
    
    // Store alert for later analysis
    if (!this.profiles.has('alerts')) {
      this.profiles.set('alerts', []);
    }
    this.profiles.get('alerts').push(alert);
  }

  /**
   * Get quick performance recommendations
   * @private
   */
  getQuickRecommendations(metrics) {
    const recommendations = [];
    const { summary, operations } = metrics;

    // Check for consistently slow operations
    const slowOps = operations.filter(op => 
      op.status === 'completed' && op.duration > 5000
    );
    
    if (slowOps.length > 0) {
      const uniqueSlowOps = [...new Set(slowOps.map(op => op.name))];
      recommendations.push(`Consider optimizing: ${uniqueSlowOps.join(', ')}`);
    }

    // Check for memory-intensive operations
    const memoryIntensiveOps = operations.filter(op => 
      op.memoryDelta && op.memoryDelta.heapUsed > 100 * 1024 * 1024
    );
    
    if (memoryIntensiveOps.length > 0) {
      recommendations.push('Some operations use high memory - consider streaming');
    }

    // Check for frequent failures
    const failedOps = operations.filter(op => op.status === 'failed');
    if (failedOps.length > operations.length * 0.1) {
      recommendations.push('High failure rate detected - review error handling');
    }

    return recommendations;
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
   * Export performance data
   * @param {string} format - Export format
   */
  exportData(format = 'json') {
    if (!this.isEnabled) {
      return null;
    }

    return this.monitor.exportData(format);
  }

  /**
   * Reset performance data
   */
  reset() {
    if (this.isEnabled) {
      this.monitor.stopMonitoring();
      this.monitor = new PerformanceMonitor(this.monitor.options);
      this.monitor.startMonitoring();
    }
    this.profiles.clear();
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }
}

// Convenience functions for global profiling
const globalProfiler = PerformanceProfiler.getInstance();

/**
 * Enable global performance profiling
 */
function enableProfiling() {
  globalProfiler.enable();
}

/**
 * Disable global performance profiling
 */
function disableProfiling() {
  globalProfiler.disable();
}

/**
 * Profile a function with automatic naming
 * @param {Function} fn - Function to profile
 * @param {string} name - Optional name (defaults to function name)
 */
async function profile(fn, name = null) {
  const operationName = name || fn.name || 'anonymous';
  return await globalProfiler.profileUtility(operationName, fn);
}

/**
 * Create a timer for manual profiling
 * @param {string} name - Timer name
 */
function timer(name) {
  return globalProfiler.startTimer(name);
}

/**
 * Get performance summary
 */
function getSummary() {
  return globalProfiler.getSummary();
}

/**
 * Generate performance report
 */
function generateReport() {
  return globalProfiler.generateReport();
}

/**
 * Decorator for profiling class methods
 * @param {string} name - Optional profile name
 */
function profileMethod(name = null) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const profileName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function(...args) {
      return await globalProfiler.profileUtility(profileName, () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

module.exports = {
  PerformanceProfiler,
  enableProfiling,
  disableProfiling,
  profile,
  timer,
  getSummary,
  generateReport,
  profileMethod,
  getInstance: () => globalProfiler
};