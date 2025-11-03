/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * MemoryMonitor Tests
 */

const MemoryMonitor = require('../../src/utils/MemoryMonitor');
const os = require('os');

// Mock os module
jest.mock('os');

describe('MemoryMonitor', () => {
  let memoryMonitor;
  let originalMemoryUsage;

  beforeAll(() => {
    // Mock os functions
    os.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    os.freemem.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    os.platform.mockReturnValue('linux');
    os.arch.mockReturnValue('x64');
    os.cpus.mockReturnValue(new Array(4).fill({})); // 4 CPUs

    // Mock process.memoryUsage
    originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = jest.fn().mockReturnValue({
      heapUsed: 100 * 1024 * 1024, // 100MB
      heapTotal: 200 * 1024 * 1024, // 200MB
      external: 10 * 1024 * 1024, // 10MB
      rss: 150 * 1024 * 1024, // 150MB
      arrayBuffers: 5 * 1024 * 1024 // 5MB
    });
  });

  afterAll(() => {
    // Restore original process.memoryUsage
    process.memoryUsage = originalMemoryUsage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    memoryMonitor = new MemoryMonitor({
      sampleInterval: 100, // Fast sampling for tests
      maxSamples: 10
    });
  });

  afterEach(() => {
    if (memoryMonitor.isMonitoring) {
      memoryMonitor.stopMonitoring();
    }
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const monitor = new MemoryMonitor();
      
      expect(monitor.options.sampleInterval).toBe(1000);
      expect(monitor.options.warningThreshold).toBe(0.8);
      expect(monitor.options.criticalThreshold).toBe(0.9);
      expect(monitor.options.maxSamples).toBe(1000);
      expect(monitor.isMonitoring).toBe(false);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        sampleInterval: 500,
        warningThreshold: 0.7,
        criticalThreshold: 0.85,
        maxSamples: 500
      };

      const monitor = new MemoryMonitor(customOptions);
      
      expect(monitor.options.sampleInterval).toBe(500);
      expect(monitor.options.warningThreshold).toBe(0.7);
      expect(monitor.options.criticalThreshold).toBe(0.85);
      expect(monitor.options.maxSamples).toBe(500);
    });
  });

  describe('startMonitoring', () => {
    test('should start monitoring and emit started event', (done) => {
      memoryMonitor.on('monitoring:started', (data) => {
        expect(data.interval).toBe(100);
        expect(data.thresholds.warning).toBe(0.8);
        expect(data.thresholds.critical).toBe(0.9);
        expect(memoryMonitor.isMonitoring).toBe(true);
        done();
      });

      memoryMonitor.startMonitoring();
    });

    test('should not start monitoring if already monitoring', () => {
      memoryMonitor.startMonitoring();
      const firstInterval = memoryMonitor.monitoringInterval;
      
      memoryMonitor.startMonitoring();
      
      expect(memoryMonitor.monitoringInterval).toBe(firstInterval);
    });

    test('should take initial sample when starting', () => {
      memoryMonitor.startMonitoring();
      
      expect(memoryMonitor.samples.length).toBe(1);
      expect(memoryMonitor.stats.samples).toBe(1);
    });
  });

  describe('stopMonitoring', () => {
    test('should stop monitoring and emit stopped event', (done) => {
      memoryMonitor.on('monitoring:stopped', (data) => {
        expect(data.duration).toBeGreaterThan(0);
        expect(data.totalSamples).toBeGreaterThan(0);
        expect(memoryMonitor.isMonitoring).toBe(false);
        done();
      });

      memoryMonitor.startMonitoring();
      
      setTimeout(() => {
        memoryMonitor.stopMonitoring();
      }, 50);
    });

    test('should not stop monitoring if not monitoring', () => {
      const stopSpy = jest.spyOn(memoryMonitor, 'emit');
      
      memoryMonitor.stopMonitoring();
      
      expect(stopSpy).not.toHaveBeenCalledWith('monitoring:stopped', expect.any(Object));
    });
  });

  describe('takeSample', () => {
    test('should take memory sample and emit sample:taken event', (done) => {
      memoryMonitor.on('sample:taken', (sample) => {
        expect(sample).toHaveProperty('timestamp');
        expect(sample).toHaveProperty('process');
        expect(sample).toHaveProperty('system');
        expect(sample).toHaveProperty('utilization');
        expect(sample.process.heapUsed).toBe(100 * 1024 * 1024);
        done();
      });

      memoryMonitor.takeSample();
    });

    test('should update statistics after taking sample', () => {
      memoryMonitor.takeSample();
      
      expect(memoryMonitor.stats.samples).toBe(1);
      expect(memoryMonitor.stats.current).toBe(100 * 1024 * 1024);
      expect(memoryMonitor.stats.peak).toBe(100 * 1024 * 1024);
      expect(memoryMonitor.stats.average).toBe(100 * 1024 * 1024);
    });

    test('should limit samples to maxSamples', () => {
      // Take more samples than maxSamples
      for (let i = 0; i < 15; i++) {
        memoryMonitor.takeSample();
      }
      
      expect(memoryMonitor.samples.length).toBe(10); // maxSamples
      expect(memoryMonitor.stats.samples).toBe(15); // Total samples taken
    });
  });

  describe('threshold checking', () => {
    test('should emit warning when warning threshold exceeded', (done) => {
      // Mock high system memory usage
      os.freemem.mockReturnValue(1 * 1024 * 1024 * 1024); // Only 1GB free out of 8GB

      memoryMonitor.on('memory:warning', (data) => {
        expect(data.systemUtilization).toBeGreaterThan(0.8);
        expect(data.recommendation).toContain('Monitor memory usage closely');
        done();
      });

      memoryMonitor.startMonitoring();
    });

    test('should emit critical alert when critical threshold exceeded', (done) => {
      // Mock very high system memory usage
      os.freemem.mockReturnValue(0.5 * 1024 * 1024 * 1024); // Only 0.5GB free out of 8GB

      memoryMonitor.on('memory:critical', (data) => {
        expect(data.systemUtilization).toBeGreaterThan(0.9);
        expect(data.recommendation).toContain('Consider reducing memory usage');
        done();
      });

      memoryMonitor.startMonitoring();
    });

    test('should increment warning and critical counters', () => {
      // Mock high memory usage
      os.freemem.mockReturnValue(1 * 1024 * 1024 * 1024); // High usage

      memoryMonitor.startMonitoring();
      
      // Wait for a sample to be taken
      setTimeout(() => {
        expect(memoryMonitor.stats.warnings).toBeGreaterThan(0);
        memoryMonitor.stopMonitoring();
      }, 150);
    });
  });

  describe('forceGarbageCollection', () => {
    test('should run garbage collection if available', () => {
      const mockGC = jest.fn();
      global.gc = mockGC;

      const result = memoryMonitor.forceGarbageCollection();

      expect(mockGC).toHaveBeenCalled();
      expect(result).toHaveProperty('freed');
      expect(result).toHaveProperty('freedMB');
      expect(result).toHaveProperty('before');
      expect(result).toHaveProperty('after');

      delete global.gc;
    });

    test('should return null if garbage collection not available', () => {
      delete global.gc;

      const result = memoryMonitor.forceGarbageCollection();

      expect(result).toBeNull();
    });

    test('should emit gc:completed event', (done) => {
      const mockGC = jest.fn();
      global.gc = mockGC;

      memoryMonitor.on('gc:completed', (data) => {
        expect(data).toHaveProperty('freed');
        expect(data).toHaveProperty('freedMB');
        expect(memoryMonitor.stats.gcRuns).toBe(1);
        done();
      });

      memoryMonitor.forceGarbageCollection();

      delete global.gc;
    });
  });

  describe('getCurrentUsage', () => {
    test('should return current memory usage with formatting', () => {
      const usage = memoryMonitor.getCurrentUsage();

      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('system');
      expect(usage).toHaveProperty('utilization');
      expect(usage).toHaveProperty('formatted');
      expect(usage.formatted.heapUsed).toBe('100 MB');
      expect(usage.utilization.heap).toBe(0.5); // 100MB / 200MB
    });
  });

  describe('getSystemInfo', () => {
    test('should return system information', () => {
      const systemInfo = memoryMonitor.getSystemInfo();

      expect(systemInfo).toHaveProperty('platform', 'linux');
      expect(systemInfo).toHaveProperty('arch', 'x64');
      expect(systemInfo).toHaveProperty('cpus', 4);
      expect(systemInfo).toHaveProperty('memory');
      expect(systemInfo.memory.totalGB).toBe(8);
    });
  });

  describe('getStats', () => {
    test('should return monitoring statistics', () => {
      memoryMonitor.startMonitoring();
      
      setTimeout(() => {
        const stats = memoryMonitor.getStats();

        expect(stats).toHaveProperty('samples');
        expect(stats).toHaveProperty('duration');
        expect(stats).toHaveProperty('durationFormatted');
        expect(stats).toHaveProperty('peakFormatted');
        expect(stats).toHaveProperty('averageFormatted');
        expect(stats).toHaveProperty('currentFormatted');
        expect(stats).toHaveProperty('samplesPerSecond');
        
        memoryMonitor.stopMonitoring();
      }, 150);
    });
  });

  describe('getTrend', () => {
    test('should analyze memory usage trend', () => {
      // Create samples with increasing memory usage
      for (let i = 0; i < 10; i++) {
        process.memoryUsage.mockReturnValue({
          heapUsed: (100 + i * 10) * 1024 * 1024, // Increasing usage
          heapTotal: 200 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          rss: 150 * 1024 * 1024
        });
        memoryMonitor.takeSample();
      }

      const trend = memoryMonitor.getTrend();

      expect(trend).toHaveProperty('trend');
      expect(trend).toHaveProperty('slope');
      expect(trend).toHaveProperty('confidence');
      expect(trend).toHaveProperty('recommendation');
      expect(['increasing', 'decreasing', 'stable']).toContain(trend.trend);
    });

    test('should return insufficient_data for too few samples', () => {
      const trend = memoryMonitor.getTrend();

      expect(trend.trend).toBe('insufficient_data');
      expect(trend.slope).toBe(0);
      expect(trend.confidence).toBe(0);
    });
  });

  describe('generateReport', () => {
    test('should generate comprehensive memory report', () => {
      memoryMonitor.startMonitoring();
      
      setTimeout(() => {
        const report = memoryMonitor.generateReport();

        expect(report).toHaveProperty('timestamp');
        expect(report).toHaveProperty('monitoring');
        expect(report).toHaveProperty('memory');
        expect(report).toHaveProperty('alerts');
        expect(report).toHaveProperty('trend');
        expect(report).toHaveProperty('system');
        expect(report).toHaveProperty('recommendations');
        
        expect(Array.isArray(report.recommendations)).toBe(true);
        
        memoryMonitor.stopMonitoring();
      }, 150);
    });
  });

  describe('exportData', () => {
    test('should export data in JSON format', () => {
      memoryMonitor.takeSample();
      
      const jsonData = memoryMonitor.exportData('json');
      const parsed = JSON.parse(jsonData);

      expect(parsed).toHaveProperty('report');
      expect(parsed).toHaveProperty('samples');
      expect(parsed).toHaveProperty('stats');
    });

    test('should export data in CSV format', () => {
      memoryMonitor.takeSample();
      
      const csvData = memoryMonitor.exportData('csv');
      const lines = csvData.split('\n');

      expect(lines[0]).toContain('timestamp,heapUsed,heapTotal');
      expect(lines.length).toBeGreaterThan(1);
    });

    test('should throw error for unsupported format', () => {
      expect(() => {
        memoryMonitor.exportData('xml');
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('formatBytes', () => {
    test('should format bytes correctly', () => {
      expect(memoryMonitor.formatBytes(0)).toBe('0 B');
      expect(memoryMonitor.formatBytes(1024)).toBe('1 KB');
      expect(memoryMonitor.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(memoryMonitor.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('formatDuration', () => {
    test('should format duration correctly', () => {
      expect(memoryMonitor.formatDuration(500)).toBe('500ms');
      expect(memoryMonitor.formatDuration(5000)).toBe('5s');
      expect(memoryMonitor.formatDuration(300000)).toBe('5m');
      expect(memoryMonitor.formatDuration(7200000)).toBe('2h');
    });
  });

  describe('error handling', () => {
    test('should handle memory usage errors gracefully', () => {
      process.memoryUsage.mockImplementation(() => {
        throw new Error('Memory usage error');
      });

      expect(() => {
        memoryMonitor.takeSample();
      }).toThrow('Memory usage error');
    });

    test('should handle system memory errors gracefully', () => {
      os.freemem.mockImplementation(() => {
        throw new Error('System memory error');
      });

      expect(() => {
        memoryMonitor.getSystemMemoryInfo();
      }).toThrow('System memory error');
    });
  });

  describe('integration scenarios', () => {
    test('should handle long-running monitoring session', (done) => {
      let sampleCount = 0;
      
      memoryMonitor.on('sample:taken', () => {
        sampleCount++;
        if (sampleCount >= 5) {
          const stats = memoryMonitor.getStats();
          expect(stats.samples).toBe(5);
          expect(stats.duration).toBeGreaterThan(0);
          memoryMonitor.stopMonitoring();
          done();
        }
      });

      memoryMonitor.startMonitoring();
    }, 10000);

    test('should handle memory pressure simulation', (done) => {
      let warningEmitted = false;
      
      memoryMonitor.on('memory:warning', () => {
        warningEmitted = true;
      });

      // Simulate increasing memory pressure
      let memoryUsage = 100 * 1024 * 1024;
      process.memoryUsage.mockImplementation(() => ({
        heapUsed: memoryUsage,
        heapTotal: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 150 * 1024 * 1024
      }));

      // Reduce free memory to trigger warning
      os.freemem.mockReturnValue(1 * 1024 * 1024 * 1024); // 1GB free

      memoryMonitor.startMonitoring();

      setTimeout(() => {
        expect(warningEmitted).toBe(true);
        memoryMonitor.stopMonitoring();
        done();
      }, 200);
    });
  });
});