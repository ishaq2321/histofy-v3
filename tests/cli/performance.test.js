/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Performance CLI Command Tests
 */

const { Command } = require('commander');
const performanceCommand = require('../../src/cli/performance');
const {
  PerformanceProfiler,
  enableProfiling,
  disableProfiling,
  getSummary,
  generateReport
} = require('../../src/utils/PerformanceProfiler');
const { FeedbackUtils } = require('../../src/utils/feedback');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('../../src/utils/PerformanceProfiler');
jest.mock('../../src/utils/feedback');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn()
  }
}));

describe('Performance CLI Command', () => {
  let mockProfiler;
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup console spy
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };

    // Setup PerformanceProfiler mock
    mockProfiler = {
      reset: jest.fn(),
      exportData: jest.fn()
    };

    PerformanceProfiler.getInstance = jest.fn().mockReturnValue(mockProfiler);
    enableProfiling.mockImplementation(() => {});
    disableProfiling.mockImplementation(() => {});
    
    // Setup FeedbackUtils mock
    FeedbackUtils.success = jest.fn();
    FeedbackUtils.error = jest.fn();
    FeedbackUtils.info = jest.fn();
    FeedbackUtils.confirmDestructiveOperation = jest.fn();
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('command configuration', () => {
    test('should have correct command name and alias', () => {
      expect(performanceCommand.name()).toBe('performance');
      expect(performanceCommand.alias()).toBe('perf');
    });

    test('should have correct description', () => {
      expect(performanceCommand.description()).toBe('Performance monitoring and analysis tools');
    });

    test('should have all required options', () => {
      const options = performanceCommand.options;
      const optionFlags = options.map(opt => opt.flags);

      expect(optionFlags).toContain('-e, --enable');
      expect(optionFlags).toContain('-d, --disable');
      expect(optionFlags).toContain('-s, --summary');
      expect(optionFlags).toContain('-r, --report');
      expect(optionFlags).toContain('-o, --output <file>');
      expect(optionFlags).toContain('--export <format>');
      expect(optionFlags).toContain('--reset');
    });
  });

  describe('enable/disable functionality', () => {
    test('should enable performance monitoring', async () => {
      const mockAction = performanceCommand._actionHandler;
      
      await mockAction({ enable: true });

      expect(enableProfiling).toHaveBeenCalled();
      expect(FeedbackUtils.success).toHaveBeenCalledWith('Performance monitoring enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 Performance profiling is now active')
      );
    });

    test('should disable performance monitoring', async () => {
      const mockAction = performanceCommand._actionHandler;
      
      await mockAction({ disable: true });

      expect(disableProfiling).toHaveBeenCalled();
      expect(FeedbackUtils.success).toHaveBeenCalledWith('Performance monitoring disabled');
    });
  });

  describe('reset functionality', () => {
    test('should reset performance data when confirmed', async () => {
      FeedbackUtils.confirmDestructiveOperation.mockResolvedValue(true);
      const mockAction = performanceCommand._actionHandler;
      
      await mockAction({ reset: true });

      expect(FeedbackUtils.confirmDestructiveOperation).toHaveBeenCalledWith(
        'Reset performance data',
        ['All performance metrics and history will be lost']
      );
      expect(mockProfiler.reset).toHaveBeenCalled();
      expect(FeedbackUtils.success).toHaveBeenCalledWith('Performance data reset');
    });

    test('should cancel reset when not confirmed', async () => {
      FeedbackUtils.confirmDestructiveOperation.mockResolvedValue(false);
      const mockAction = performanceCommand._actionHandler;
      
      await mockAction({ reset: true });

      expect(mockProfiler.reset).not.toHaveBeenCalled();
      expect(FeedbackUtils.info).toHaveBeenCalledWith('Reset cancelled');
    });
  });

  describe('summary functionality', () => {
    test('should show performance summary when enabled', async () => {
      getSummary.mockReturnValue({
        enabled: true,
        totalOperations: 10,
        averageTime: 1500,
        alertCount: 2,
        memoryPeak: '200 MB',
        slowestOperation: {
          name: 'slow-operation',
          duration: 5000
        },
        recommendations: ['Optimize slow operations', 'Consider caching']
      });

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ summary: true });

      expect(getSummary).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📈 Performance Summary')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Total operations: 10')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Average time: 1500ms')
      );
    });

    test('should show disabled message when monitoring is disabled', async () => {
      getSummary.mockReturnValue({
        enabled: false
      });

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ summary: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Performance monitoring is disabled')
      );
    });
  });

  describe('report functionality', () => {
    test('should generate detailed report when enabled', async () => {
      const mockReport = {
        enabled: true,
        timestamp: '2025-01-01T00:00:00.000Z',
        systemInfo: {
          platform: 'linux',
          arch: 'x64',
          cpus: 8,
          memory: { totalGB: 16 },
          nodeVersion: 'v18.0.0'
        },
        summary: {
          totalOperations: 15,
          completedOperations: 13,
          failedOperations: 2,
          averageOperationTime: 2000,
          peakMemoryUsage: 300 * 1024 * 1024,
          monitoringDuration: 60000
        },
        topSlowOperations: [
          { name: 'slow-op-1', duration: 8000, memoryUsed: 100 },
          { name: 'slow-op-2', duration: 6000, memoryUsed: 80 }
        ],
        recentAlerts: [
          { severity: 'warning', message: 'Operation took too long' },
          { severity: 'critical', message: 'Memory usage high' }
        ],
        recommendations: [
          {
            priority: 'high',
            message: 'Optimize database queries',
            suggestion: 'Add indexes to frequently queried columns'
          }
        ]
      };

      generateReport.mockReturnValue(mockReport);

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ report: true });

      expect(generateReport).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 Detailed Performance Report')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Generated: 2025-01-01T00:00:00.000Z')
      );
    });

    test('should save report to file when output specified', async () => {
      const mockReport = {
        enabled: true,
        timestamp: '2025-01-01T00:00:00.000Z',
        systemInfo: {
          platform: 'linux',
          arch: 'x64',
          cpus: 8,
          memory: { totalGB: 16 },
          nodeVersion: 'v18.0.0'
        },
        summary: {
          totalOperations: 5,
          completedOperations: 5,
          failedOperations: 0,
          averageOperationTime: 1000,
          peakMemoryUsage: 100 * 1024 * 1024,
          monitoringDuration: 30000
        }
      };

      generateReport.mockReturnValue(mockReport);
      fs.writeFile.mockResolvedValue();

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ report: true, output: 'report.json' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        'report.json',
        JSON.stringify(mockReport, null, 2)
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Report saved to: report.json')
      );
    });

    test('should handle file write errors', async () => {
      const mockReport = {
        enabled: true,
        timestamp: '2025-01-01T00:00:00.000Z',
        systemInfo: {
          platform: 'linux',
          arch: 'x64',
          cpus: 8,
          memory: { totalGB: 16 },
          nodeVersion: 'v18.0.0'
        },
        summary: {
          totalOperations: 5,
          completedOperations: 5,
          failedOperations: 0,
          averageOperationTime: 1000,
          peakMemoryUsage: 100 * 1024 * 1024,
          monitoringDuration: 30000
        }
      };

      generateReport.mockReturnValue(mockReport);
      fs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ report: true, output: 'report.json' });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to save report: Permission denied')
      );
    });
  });

  describe('export functionality', () => {
    test('should export performance data with default filename', async () => {
      mockProfiler.exportData.mockReturnValue('{"test": "data"}');
      fs.writeFile.mockResolvedValue();

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ export: 'json' });

      expect(mockProfiler.exportData).toHaveBeenCalledWith('json');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/performance-data-.*\\.json/),
        '{"test": "data"}'
      );
    });

    test('should export performance data to specified file', async () => {
      mockProfiler.exportData.mockReturnValue('{"test": "data"}');
      fs.writeFile.mockResolvedValue();

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ export: 'json', output: 'custom-export.json' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        'custom-export.json',
        '{"test": "data"}'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Performance data exported to: custom-export.json')
      );
    });

    test('should handle no data available', async () => {
      mockProfiler.exportData.mockReturnValue(null);

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ export: 'json' });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No performance data available')
      );
    });

    test('should handle export errors', async () => {
      mockProfiler.exportData.mockImplementation(() => {
        throw new Error('Export failed');
      });

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ export: 'json' });

      expect(FeedbackUtils.error).toHaveBeenCalledWith('Export failed', 'Export failed');
    });
  });

  describe('default status functionality', () => {
    test('should show performance status when enabled', async () => {
      getSummary.mockReturnValue({
        enabled: true,
        totalOperations: 5,
        averageTime: 1200,
        alertCount: 1,
        memoryPeak: '150 MB',
        slowestOperation: {
          name: 'test-operation',
          duration: 3000
        }
      });

      const mockAction = performanceCommand._actionHandler;
      await mockAction({});

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 Performance Monitoring Status')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Performance monitoring is enabled')
      );
    });

    test('should show disabled status when monitoring is disabled', async () => {
      getSummary.mockReturnValue({
        enabled: false
      });

      const mockAction = performanceCommand._actionHandler;
      await mockAction({});

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Performance monitoring is disabled')
      );
    });
  });

  describe('error handling', () => {
    test('should handle command errors gracefully', async () => {
      getSummary.mockImplementation(() => {
        throw new Error('Summary failed');
      });

      const mockAction = performanceCommand._actionHandler;
      
      // Mock process.exit to prevent test termination
      const mockExit = jest.spyOn(process, 'exit').mockImplementation();

      await mockAction({ summary: true });

      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Performance command failed',
        'Summary failed'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('utility functions', () => {
    // These would test the utility functions if they were exported
    // For now, we test them indirectly through the command functionality
    
    test('should format bytes correctly in reports', async () => {
      const mockReport = {
        enabled: true,
        timestamp: '2025-01-01T00:00:00.000Z',
        systemInfo: {
          platform: 'linux',
          arch: 'x64',
          cpus: 8,
          memory: { totalGB: 16 },
          nodeVersion: 'v18.0.0'
        },
        summary: {
          totalOperations: 1,
          completedOperations: 1,
          failedOperations: 0,
          averageOperationTime: 1000,
          peakMemoryUsage: 1024 * 1024 * 1024, // 1GB
          monitoringDuration: 30000
        }
      };

      generateReport.mockReturnValue(mockReport);

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ report: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Peak memory: 1 GB')
      );
    });

    test('should format duration correctly in reports', async () => {
      const mockReport = {
        enabled: true,
        timestamp: '2025-01-01T00:00:00.000Z',
        systemInfo: {
          platform: 'linux',
          arch: 'x64',
          cpus: 8,
          memory: { totalGB: 16 },
          nodeVersion: 'v18.0.0'
        },
        summary: {
          totalOperations: 1,
          completedOperations: 1,
          failedOperations: 0,
          averageOperationTime: 1000,
          peakMemoryUsage: 100 * 1024 * 1024,
          monitoringDuration: 65000 // 1 minute 5 seconds
        }
      };

      generateReport.mockReturnValue(mockReport);

      const mockAction = performanceCommand._actionHandler;
      await mockAction({ report: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Monitoring duration: 1m')
      );
    });
  });
});