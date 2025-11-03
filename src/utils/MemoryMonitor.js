/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * MemoryMonitor - Memory usage monitoring and optimization utilities
 */

const os = require('os');
const { EventEmitter } = require('events');

class MemoryMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      sampleInterval: options.sampleInterval || 1000, // 1 second
      warningThreshold: options.warningThreshold || 0.8, // 80% of available memory
      criticalThreshold: options.criticalThreshold || 0.9, // 90% of available memory
      maxSamples: options.maxSamples || 1000, // Keep last 1000 samples
      enableGC: options.enableGC || false, // Enable automatic garbage collection
      ...options
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.samples = [];
    this.stats = {
      peak: 0,
      average: 0,
      current: 0,
      samples: 0,
      warnings: 0,
      criticalAlerts: 0,
      gcRuns: 0,
      startTime: null,
      lastSample: null
    };

    this.systemInfo = this.getSystemInfo();
  }

  /**
   * Start memory monitoring
   * @param {Object} options - Monitoring options
   */
  startMonitoring(options = {}) {
    if (this.isMonitoring) {
      return;
    }

    const monitoringOptions = { ...this.options, ...options };
    this.isMonitoring = true;
    this.stats.startTime = Date.now();

    // Take initial sample
    this.takeSample();

    // Set up monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.takeSample();
      this.checkThresholds();
    }, monitoringOptions.sampleInterval);

    this.emit('monitoring:started', {
      interval: monitoringOptions.sampleInterval,
      thresholds: {
        warning: monitoringOptions.warningThreshold,
        critical: monitoringOptions.criticalThreshold
      }
    });
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Take final sample
    this.takeSample();

    this.emit('monitoring:stopped', {
      duration: Date.now() - this.stats.startTime,
      totalSamples: this.stats.samples,
      peakUsage: this.stats.peak
    });
  }

  /**
   * Take a memory usage sample
   * @private
   */
  takeSample() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = this.getSystemMemoryInfo();
    
    const sample = {
      timestamp: Date.now(),
      process: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers || 0
      },
      system: systemMemory,
      utilization: {
        heap: memoryUsage.heapUsed / memoryUsage.heapTotal,
        system: (systemMemory.total - systemMemory.free) / systemMemory.total
      }
    };

    // Add to samples array
    this.samples.push(sample);
    
    // Keep only the last N samples
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift();
    }

    // Update statistics
    this.updateStats(sample);
    this.stats.lastSample = sample;

    this.emit('sample:taken', sample);
  }

  /**
   * Update running statistics
   * @private
   */
  updateStats(sample) {
    this.stats.samples++;
    this.stats.current = sample.process.heapUsed;
    
    // Update peak
    if (sample.process.heapUsed > this.stats.peak) {
      this.stats.peak = sample.process.heapUsed;
    }

    // Calculate running average
    if (this.samples.length > 0) {
      const totalHeapUsed = this.samples.reduce((sum, s) => sum + s.process.heapUsed, 0);
      this.stats.average = totalHeapUsed / this.samples.length;
    }
  }

  /**
   * Check memory thresholds and emit warnings
   * @private
   */
  checkThresholds() {
    if (!this.stats.lastSample) {
      return;
    }

    const sample = this.stats.lastSample;
    const systemUtilization = sample.utilization.system;
    const heapUtilization = sample.utilization.heap;

    // Check critical threshold
    if (systemUtilization >= this.options.criticalThreshold || 
        heapUtilization >= this.options.criticalThreshold) {
      
      this.stats.criticalAlerts++;
      
      this.emit('memory:critical', {
        sample,
        systemUtilization,
        heapUtilization,
        recommendation: 'Consider reducing memory usage or increasing available memory'
      });

      // Automatic garbage collection if enabled
      if (this.options.enableGC && global.gc) {
        this.forceGarbageCollection();
      }
    }
    // Check warning threshold
    else if (systemUtilization >= this.options.warningThreshold || 
             heapUtilization >= this.options.warningThreshold) {
      
      this.stats.warnings++;
      
      this.emit('memory:warning', {
        sample,
        systemUtilization,
        heapUtilization,
        recommendation: 'Monitor memory usage closely'
      });
    }
  }

  /**
   * Force garbage collection
   */
  forceGarbageCollection() {
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();
      
      this.stats.gcRuns++;
      
      const freed = beforeGC.heapUsed - afterGC.heapUsed;
      
      this.emit('gc:completed', {
        before: beforeGC,
        after: afterGC,
        freed,
        freedMB: Math.round(freed / 1024 / 1024)
      });

      return {
        freed,
        freedMB: Math.round(freed / 1024 / 1024),
        before: beforeGC,
        after: afterGC
      };
    }
    
    return null;
  }

  /**
   * Get current memory usage
   * @returns {Object} Current memory usage
   */
  getCurrentUsage() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = this.getSystemMemoryInfo();
    
    return {
      ...memoryUsage,
      system: systemMemory,
      utilization: {
        heap: memoryUsage.heapUsed / memoryUsage.heapTotal,
        system: (systemMemory.total - systemMemory.free) / systemMemory.total
      },
      formatted: {
        heapUsed: this.formatBytes(memoryUsage.heapUsed),
        heapTotal: this.formatBytes(memoryUsage.heapTotal),
        rss: this.formatBytes(memoryUsage.rss),
        external: this.formatBytes(memoryUsage.external),
        systemFree: this.formatBytes(systemMemory.free),
        systemTotal: this.formatBytes(systemMemory.total)
      }
    };
  }

  /**
   * Get system memory information
   * @returns {Object} System memory info
   */
  getSystemMemoryInfo() {
    return {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };
  }

  /**
   * Get system information
   * @returns {Object} System information
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
      v8Version: process.versions.v8
    };
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Monitoring statistics
   */
  getStats() {
    const duration = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
    
    return {
      ...this.stats,
      duration,
      durationFormatted: this.formatDuration(duration),
      peakFormatted: this.formatBytes(this.stats.peak),
      averageFormatted: this.formatBytes(this.stats.average),
      currentFormatted: this.formatBytes(this.stats.current),
      samplesPerSecond: duration > 0 ? (this.stats.samples / (duration / 1000)) : 0
    };
  }

  /**
   * Get memory usage trend
   * @param {number} windowSize - Number of recent samples to analyze
   * @returns {Object} Trend analysis
   */
  getTrend(windowSize = 10) {
    if (this.samples.length < 2) {
      return { trend: 'insufficient_data', slope: 0, confidence: 0 };
    }

    const recentSamples = this.samples.slice(-windowSize);
    const values = recentSamples.map(s => s.process.heapUsed);
    
    // Calculate linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ..., n-1
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Determine trend
    let trend;
    if (Math.abs(slope) < 1000) { // Less than 1KB per sample
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Calculate confidence based on R-squared
    const meanY = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssResidual = values.reduce((sum, y, x) => {
      const predicted = meanY + slope * (x - (n - 1) / 2);
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    return {
      trend,
      slope,
      slopeFormatted: this.formatBytes(Math.abs(slope)) + '/sample',
      confidence,
      confidencePercent: Math.round(confidence * 100),
      samples: n,
      recommendation: this.getTrendRecommendation(trend, slope, confidence)
    };
  }

  /**
   * Get trend-based recommendations
   * @private
   */
  getTrendRecommendation(trend, slope, confidence) {
    if (confidence < 0.5) {
      return 'Insufficient data for reliable trend analysis';
    }

    switch (trend) {
      case 'increasing':
        if (slope > 10000) { // More than 10KB per sample
          return 'Memory usage is increasing rapidly. Consider optimizing memory usage or reducing batch sizes.';
        }
        return 'Memory usage is gradually increasing. Monitor closely.';
      
      case 'decreasing':
        return 'Memory usage is decreasing. Current optimization strategies are working well.';
      
      case 'stable':
        return 'Memory usage is stable. Current configuration appears optimal.';
      
      default:
        return 'Unable to determine trend.';
    }
  }

  /**
   * Generate memory usage report
   * @returns {Object} Comprehensive memory report
   */
  generateReport() {
    const stats = this.getStats();
    const trend = this.getTrend();
    const currentUsage = this.getCurrentUsage();
    
    return {
      timestamp: new Date().toISOString(),
      monitoring: {
        isActive: this.isMonitoring,
        duration: stats.durationFormatted,
        samples: stats.samples,
        samplesPerSecond: Math.round(stats.samplesPerSecond * 100) / 100
      },
      memory: {
        current: {
          heap: currentUsage.formatted.heapUsed,
          rss: currentUsage.formatted.rss,
          external: currentUsage.formatted.external,
          utilization: Math.round(currentUsage.utilization.heap * 100) + '%'
        },
        peak: stats.peakFormatted,
        average: stats.averageFormatted,
        system: {
          total: currentUsage.formatted.systemTotal,
          free: currentUsage.formatted.systemFree,
          utilization: Math.round(currentUsage.utilization.system * 100) + '%'
        }
      },
      alerts: {
        warnings: stats.warnings,
        critical: stats.criticalAlerts,
        gcRuns: stats.gcRuns
      },
      trend: {
        direction: trend.trend,
        slope: trend.slopeFormatted,
        confidence: trend.confidencePercent + '%',
        recommendation: trend.recommendation
      },
      system: this.systemInfo,
      recommendations: this.generateRecommendations(stats, trend, currentUsage)
    };
  }

  /**
   * Generate optimization recommendations
   * @private
   */
  generateRecommendations(stats, trend, currentUsage) {
    const recommendations = [];

    // High memory usage
    if (currentUsage.utilization.heap > 0.8) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'High heap utilization detected',
        action: 'Consider reducing batch sizes or enabling garbage collection'
      });
    }

    // Increasing memory trend
    if (trend.trend === 'increasing' && trend.confidence > 0.7) {
      recommendations.push({
        type: 'trend',
        priority: 'medium',
        message: 'Memory usage is consistently increasing',
        action: 'Monitor for memory leaks and optimize data processing'
      });
    }

    // Frequent warnings
    if (stats.warnings > stats.samples * 0.1) {
      recommendations.push({
        type: 'alerts',
        priority: 'medium',
        message: 'Frequent memory warnings detected',
        action: 'Adjust warning thresholds or optimize memory usage patterns'
      });
    }

    // System memory pressure
    if (currentUsage.utilization.system > 0.9) {
      recommendations.push({
        type: 'system',
        priority: 'high',
        message: 'System memory pressure detected',
        action: 'Close other applications or increase system memory'
      });
    }

    // No garbage collection runs
    if (stats.gcRuns === 0 && stats.samples > 100) {
      recommendations.push({
        type: 'gc',
        priority: 'low',
        message: 'No garbage collection detected',
        action: 'Consider enabling automatic garbage collection for better memory management'
      });
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
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration to human readable format
   * @private
   */
  formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    return Math.round(ms / 3600000) + 'h';
  }

  /**
   * Export monitoring data
   * @param {string} format - Export format (json, csv)
   * @returns {string} Exported data
   */
  exportData(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify({
          report: this.generateReport(),
          samples: this.samples,
          stats: this.getStats()
        }, null, 2);
      
      case 'csv':
        const headers = ['timestamp', 'heapUsed', 'heapTotal', 'rss', 'external', 'systemFree', 'systemTotal'];
        const rows = [headers.join(',')];
        
        this.samples.forEach(sample => {
          const row = [
            sample.timestamp,
            sample.process.heapUsed,
            sample.process.heapTotal,
            sample.process.rss,
            sample.process.external,
            sample.system.free,
            sample.system.total
          ];
          rows.push(row.join(','));
        });
        
        return rows.join('\n');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

module.exports = MemoryMonitor;