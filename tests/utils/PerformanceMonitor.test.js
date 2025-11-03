/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * PerformanceMonitor Tests
 */

const PerformanceMonitor = require('../../src/utils/PerformanceMonitor');
const MemoryMonitor = require('../../src/utils/MemoryMonitor');
const os = require('os');

// Mock dependencies
jest.mock('../../src/utils/MemoryMonitor');
jest.mock('os');

describe('PerformanceMonitor', () => {
  let performanceMonitor;
  let mockMemoryMonitor;

  beforeAll(() => {
    // Mock os functions
    os.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    os.freemem.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    os.platform.mockReturnValue('linux');
    os.arch.mockReturnValue('x64');
    os.cpus.mockReturnValue(new Array(4).fill({
      model: 'Intel Core i7',
      speed: 2800,
      times: { user: 1000, nice: 0, sys: 500, idle: 8000, irq: 0 }
    }));
    os.loadavg.mockReturnValue([1.5, 1.2, 1.0]);
    os.uptime.mockReturnValue(86400); // 1 day
    os.hostname.mockReturnValue('test-host');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup MemoryMonitor mock
    mockMemoryMonitor = {
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      isMonitoring: false,
      getStats: jest.fn().mockReturnValue({
        peak: 200 * 1024 * 1024,
        average: 150 * 1024 * 1024,
        samples: 50
      })
    };

    MemoryMonitor.mockImplementation(() => mockMemoryMonitor);

    performanceMonitor = new PerformanceMonitor({
      sampleInterval: 100, // Fast sampling for tests
      maxSamples: 10
    });
  });

  afterEach(() => {
    if (performanceMonitor.isMonitoring) {
      performanceMonitor.stopMonitoring();
    }
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const monitor = new PerformanceMonitor();
      
      expect(monitor.options.sampleInterval).toBe(1000);
      expect(monitor.options.alertThresholds.cpuUsage).toBe(80);
      expect(monitor.options.alertThresholds.memoryUsage).toBe(85);
      expect(monitor.isMonitoring).toBe(false);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        sampleInterval: 500,
        alertThresholds: {
          cpuUsage: 70,
          memoryUsage: 75,
          operationTime: 20000
        }
      };

      const monitor = new PerformanceMonitor(customOptions);
      
      expect(monitor.options.sampleInterval).toBe(500);
      expect(monitor.options.alertThresholds.cpuUsage).toBe(70);
      expect(monitor.options.alertThresholds.memoryUsage).toBe(75);
      expect(monitor.options.alertThresholds.operationTime).toBe(20000);
    });
  });

  describe('monitoring lifecycle', () => {
    test('should start monitoring and emit started event', (done) => {
      performanceMonitor.on('monitoring:started', (data) => {
        expect(data.timestamp).toBeDefined();
        expect(data.options).toBeDefined();
        expect(performanceMonitor.isMonitoring).toBe(true);
        expect(mockMemoryMonitor.startMonitoring).toHaveBeenCalled();
        done();
      });

      performanceMonitor.startMonitoring();
    });

    test('should stop monitoring and emit stopped event', (done) => {
      performanceMonitor.on('monitoring:stopped', (data) => {
        expect(data.timestamp).toBeDefined();
        expect(data.duration).toBeGreaterThan(0);
        expect(data.summary).toBeDefined();
        expect(performanceMonitor.isMonitoring).toBe(false);
        done();
      });

      performanceMonitor.startMonitoring();
      
      setTimeout(() => {
        performanceMonitor.stopMonitoring();
      }, 50);
    });

    test('should not start monitoring if already monitoring', () => {
      performanceMonitor.startMonitoring();
      const firstInterval = performanceMonitor.monitoringInterval;
      
      performanceMonitor.startMonitoring();
      
      expect(performanceMonitor.monitoringInterval).toBe(firstInterval);
    });
  });

  describe('operation profiling', () => {
    test('should profile operation lifecycle', (done) => {
      performanceMonitor.on('operation:started', (data) => {
        expect(data.operationId).toBeDefined();
        expect(data.name).toBe('test-operation');
      });

      performanceMonitor.on('operation:completed', (data) => {
        expect(data.operationId).toBeDefined();
        expect(data.name).toBe('test-operation');
        expect(data.duration).toBeGreaterThan(0);
        expect(data.memoryDelta).toBeDefined();
        done();
      });

      const operationId = performanceMonitor.startOperation('test-operation', { test: true });
      
      setTimeout(() => {
        performanceMonitor.endOperation(operationId, { success: true });
      }, 10);
    });

    test('should handle operation failure', (done) => {
      performanceMonitor.on('operation:failed', (data) => {
        expect(data.operationId).toBeDefined();
        expect(data.name).toBe('failing-operation');
        expect(data.error).toBe('Test error');
        done();
      });

      const operationId = performanceMonitor.startOperation('failing-operation');
      performanceMonitor.failOperation(operationId, new Error('Test error'));
    });

    test('should throw error for unknown operation', () => {
      expect(() => {
        performanceMonitor.endOperation('unknown-id');
      }).toThrow('Operation unknown-id not found');
    });

    test('should measure function execution', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test result';
      };

      const result = await performanceMonitor.measureFunction('test-function', testFunction);

      expect(result).toBe('test result');
      expect(performanceMonitor.metrics.operations).toHaveLength(1);
      expect(performanceMonitor.metrics.operations[0].name).toBe('test-function');
      expect(performanceMonitor.metrics.operations[0].status).toBe('completed');
    });

    test('should handle function execution errors', async () => {
      const failingFunction = async () => {
        throw new Error('Function failed');
      };

      await expect(
        performanceMonitor.measureFunction('failing-function', failingFunction)
      ).rejects.toThrow('Function failed');

      expect(performanceMonitor.metrics.operations).toHaveLength(1);
      expect(performanceMonitor.metrics.operations[0].status).toBe('failed');
      expect(performanceMonitor.metrics.operations[0].error).toBe('Function failed');
    });
  });

  describe('system metrics collection', () => {
    test('should collect system metrics', () => {
      performanceMonitor.collectSystemMetrics();

      expect(performanceMonitor.metrics.system).toHaveLength(1);
      const metrics = performanceMonitor.metrics.system[0];
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('loadAverage');
      expect(metrics.cpu.cores).toBe(4);
    });

    test('should limit system metrics samples', () => {
      // Collect more samples than maxSamples
      for (let i = 0; i < 15; i++) {
        performanceMonitor.collectSystemMetrics();
      }

      expect(performanceMonitor.metrics.system.length).toBe(10); // maxSamples
    });
  });

  describe('alert system', () => {
    test('should generate operation alerts for slow operations', (done) => {
      performanceMonitor.options.alertThresholds.operationTime = 50; // 50ms threshold

      performanceMonitor.on('alert', (alert) => {
        expect(alert.type).toBe('slow_operation');
        expect(alert.severity).toBe('warning');
        expect(alert.operation).toBe('slow-operation');
        expect(alert.value).toBeGreaterThan(50);
        done();
      });

      const operationId = performanceMonitor.startOperation('slow-operation');
      
      setTimeout(() => {
        performanceMonitor.endOperation(operationId);
      }, 60); // Longer than threshold
    });

    test('should generate memory alerts for high memory operations', (done) => {
      performanceMonitor.on('alert', (alert) => {
        expect(alert.type).toBe('high_memory_usage');
        expect(alert.severity).toBe('warning');
        done();
      });

      const operationId = performanceMonitor.startOperation('memory-intensive');
      
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn()
        .mockReturnValueOnce({
          heapUsed: 100 * 1024 * 1024,
          heapTotal: 200 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          rss: 150 * 1024 * 1024
        })
        .mockReturnValueOnce({
          heapUsed: 250 * 1024 * 1024, // 150MB increase
          heapTotal: 300 * 1024 * 1024,
          external: 15 * 1024 * 1024,
          rss: 280 * 1024 * 1024
        });

      performanceMonitor.endOperation(operationId);
      
      // Restore original
      process.memoryUsage = originalMemoryUsage;
    });

    test('should generate system alerts for high CPU usage', (done) => {
      performanceMonitor.options.alertThresholds.cpuUsage = 50; // Low threshold for testing

      performanceMonitor.on('alert', (alert) => {
        expect(alert.type).toBe('high_cpu_usage');
        expect(alert.severity).toBe('warning');
        done();
      });

      // Mock high CPU usage
      os.cpus.mockReturnValue(new Array(4).fill({
        model: 'Intel Core i7',
        speed: 2800,
        times: { user: 8000, nice: 0, sys: 1500, idle: 500, irq: 0 } // High usage
      }));

      performanceMonitor.collectSystemMetrics();
    });
  });

  describe('profiler creation', () => {
    test('should create profiler with end and fail methods', () => {
      const profiler = performanceMonitor.createProfiler('test-profiler', { test: true });

      expect(profiler).toHaveProperty('operationId');
      expect(profiler).toHaveProperty('end');
      expect(profiler).toHaveProperty('fail');
      expect(profiler).toHaveProperty('addMetadata');
      expect(typeof profiler.end).toBe('function');
      expect(typeof profiler.fail).toBe('function');
    });

    test('should add metadata to operation', () => {
      const profiler = performanceMonitor.createProfiler('test-profiler');
      profiler.addMetadata('testKey', 'testValue');

      const operation = performanceMonitor.operations.get(profiler.operationId);
      expect(operation.metadata.testKey).toBe('testValue');
    });
  });

  describe('metrics and reporting', () => {
    test('should calculate performance summary', () => {
      // Add some test operations
      const op1Id = performanceMonitor.startOperation('fast-op');
      performanceMonitor.endOperation(op1Id);

      const op2Id = performanceMonitor.startOperation('slow-op');
      setTimeout(() => {
        performanceMonitor.endOperation(op2Id);
      }, 20);

      setTimeout(() => {
        performanceMonitor.calculateSummary();
        const summary = performanceMonitor.metrics.summary;

        expect(summary.totalOperations).toBe(2);
        expect(summary.completedOperations).toBe(2);
        expect(summary.averageOperationTime).toBeGreaterThan(0);
        expect(summary.slowestOperation).toBeDefined();
        expect(summary.fastestOperation).toBeDefined();
      }, 30);
    });

    test('should generate comprehensive report', () => {
      // Add test data
      performanceMonitor.startOperation('test-op');
      performanceMonitor.collectSystemMetrics();

      const report = performanceMonitor.generateReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('systemInfo');
      expect(report).toHaveProperty('recentAlerts');
      expect(report).toHaveProperty('topSlowOperations');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('charts');
    });

    test('should export data in JSON format', () => {
      performanceMonitor.collectSystemMetrics();
      
      const jsonData = performanceMonitor.exportData('json');
      const parsed = JSON.parse(jsonData);

      expect(parsed).toHaveProperty('operations');
      expect(parsed).toHaveProperty('system');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('systemInfo');
    });

    test('should export data in CSV format', () => {
      const opId = performanceMonitor.startOperation('test-op');
      performanceMonitor.endOperation(opId);
      
      const csvData = performanceMonitor.exportData('csv');
      const lines = csvData.split('\n');

      expect(lines[0]).toContain('name,duration,status,memoryUsed,cpuTime,timestamp');
      expect(lines.length).toBeGreaterThan(1);
    });

    test('should throw error for unsupported export format', () => {
      expect(() => {
        performanceMonitor.exportData('xml');
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('recommendations', () => {
    test('should generate recommendations for slow operations', () => {
      // Create slow operations
      const op1Id = performanceMonitor.startOperation('slow-op-1');
      const op2Id = performanceMonitor.startOperation('slow-op-2');
      
      // Mock slow operations
      const operation1 = performanceMonitor.operations.get(op1Id);
      const operation2 = performanceMonitor.operations.get(op2Id);
      
      operation1.duration = 6000; // 6 seconds
      operation1.status = 'completed';
      operation2.duration = 7000; // 7 seconds
      operation2.status = 'completed';
      
      performanceMonitor.metrics.operations.push(operation1, operation2);

      const metrics = performanceMonitor.getMetrics();
      const recommendations = performanceMonitor.generateRecommendations(metrics);

      expect(recommendations.some(r => r.type === 'performance')).toBe(true);
      const perfRec = recommendations.find(r => r.type === 'performance');
      expect(perfRec.priority).toBe('high');
      expect(perfRec.message).toContain('Average operation time is high');
    });

    test('should generate recommendations for memory-intensive operations', () => {
      const opId = performanceMonitor.startOperation('memory-op');
      const operation = performanceMonitor.operations.get(opId);
      
      operation.status = 'completed';
      operation.duration = 1000;
      operation.memoryDelta = {
        heapUsed: 150 * 1024 * 1024 // 150MB
      };
      
      performanceMonitor.metrics.operations.push(operation);

      const metrics = performanceMonitor.getMetrics();
      const recommendations = performanceMonitor.generateRecommendations(metrics);

      expect(recommendations.some(r => r.type === 'memory')).toBe(true);
      const memRec = recommendations.find(r => r.type === 'memory');
      expect(memRec.message).toContain('high memory');
    });

    test('should generate recommendations for frequent alerts', () => {
      // Add multiple recent alerts
      const now = Date.now();
      for (let i = 0; i < 7; i++) {
        performanceMonitor.metrics.alerts.push({
          type: 'test_alert',
          timestamp: now - (i * 30000), // Within last 5 minutes
          severity: 'warning'
        });
      }

      const metrics = performanceMonitor.getMetrics();
      const recommendations = performanceMonitor.generateRecommendations(metrics);

      expect(recommendations.some(r => r.type === 'alerts')).toBe(true);
    });
  });

  describe('chart data generation', () => {
    test('should generate chart data for visualization', () => {
      // Add system metrics
      for (let i = 0; i < 5; i++) {
        performanceMonitor.collectSystemMetrics();
      }

      // Add operations
      const opId = performanceMonitor.startOperation('chart-test');
      performanceMonitor.endOperation(opId);

      const metrics = performanceMonitor.getMetrics();
      const chartData = performanceMonitor.generateChartData(metrics);

      expect(chartData).toHaveProperty('cpuUsage');
      expect(chartData).toHaveProperty('memoryUsage');
      expect(chartData).toHaveProperty('operationDurations');
      
      expect(chartData.cpuUsage.labels).toHaveLength(5);
      expect(chartData.cpuUsage.data).toHaveLength(5);
      expect(chartData.operationDurations.labels).toHaveLength(1);
      expect(chartData.operationDurations.data).toHaveLength(1);
    });
  });

  describe('system information', () => {
    test('should get system information', () => {
      const systemInfo = performanceMonitor.getSystemInfo();

      expect(systemInfo).toHaveProperty('platform', 'linux');
      expect(systemInfo).toHaveProperty('arch', 'x64');
      expect(systemInfo).toHaveProperty('cpus', 4);
      expect(systemInfo).toHaveProperty('memory');
      expect(systemInfo.memory.totalGB).toBe(8);
      expect(systemInfo).toHaveProperty('nodeVersion');
      expect(systemInfo).toHaveProperty('hostname', 'test-host');
    });
  });

  describe('utility methods', () => {
    test('should format duration correctly', () => {
      expect(performanceMonitor.formatDuration(500)).toBe('500ms');
      expect(performanceMonitor.formatDuration(5000)).toBe('5s');
      expect(performanceMonitor.formatDuration(300000)).toBe('5m');
      expect(performanceMonitor.formatDuration(7200000)).toBe('2h');
    });

    test('should format bytes correctly', () => {
      expect(performanceMonitor.formatBytes(0)).toBe('0 B');
      expect(performanceMonitor.formatBytes(1024)).toBe('1 KB');
      expect(performanceMonitor.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(performanceMonitor.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    test('should generate unique operation IDs', () => {
      const id1 = performanceMonitor.generateOperationId();
      const id2 = performanceMonitor.generateOperationId();

      expect(id1).toMatch(/^perf-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^perf-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('error handling', () => {
    test('should handle system metrics collection errors', () => {
      os.cpus.mockImplementation(() => {
        throw new Error('CPU info error');
      });

      expect(() => {
        performanceMonitor.collectSystemMetrics();
      }).toThrow('CPU info error');
    });

    test('should handle memory monitoring errors gracefully', () => {
      mockMemoryMonitor.startMonitoring.mockImplementation(() => {
        throw new Error('Memory monitoring error');
      });

      expect(() => {
        performanceMonitor.startMonitoring();
      }).toThrow('Memory monitoring error');
    });
  });

  describe('integration scenarios', () => {
    test('should handle long-running monitoring session', (done) => {
      let metricsCollected = 0;
      
      performanceMonitor.on('metrics:collected', () => {
        metricsCollected++;
        if (metricsCollected >= 3) {
          const metrics = performanceMonitor.getMetrics();
          expect(metrics.system.length).toBe(3);
          expect(metrics.summary.monitoringDuration).toBeGreaterThan(0);
          performanceMonitor.stopMonitoring();
          done();
        }
      });

      performanceMonitor.startMonitoring();
    }, 10000);

    test('should handle multiple concurrent operations', async () => {
      const operations = [];
      
      // Start multiple operations
      for (let i = 0; i < 5; i++) {
        const opId = performanceMonitor.startOperation(`concurrent-op-${i}`);
        operations.push(opId);
      }

      // End operations with different delays
      await Promise.all(operations.map((opId, index) => 
        new Promise(resolve => {
          setTimeout(() => {
            performanceMonitor.endOperation(opId, { index });
            resolve();
          }, (index + 1) * 10);
        })
      ));

      expect(performanceMonitor.metrics.operations).toHaveLength(5);
      expect(performanceMonitor.metrics.operations.every(op => op.status === 'completed')).toBe(true);
    });
  });
});