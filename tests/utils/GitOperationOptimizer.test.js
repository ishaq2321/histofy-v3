/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * GitOperationOptimizer Tests
 */

const GitOperationOptimizer = require('../../src/utils/GitOperationOptimizer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/core/GitManager');

describe('GitOperationOptimizer', () => {
  let optimizer;
  let testDir;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-optimizer-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    optimizer = new GitOperationOptimizer(testDir);
    
    // Mock git operations
    optimizer.git = {
      log: jest.fn(),
      show: jest.fn(),
      status: jest.fn(),
      branch: jest.fn(),
      raw: jest.fn(),
      commit: jest.fn(),
      add: jest.fn(),
      reset: jest.fn(),
      checkout: jest.fn()
    };
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(optimizer.operationCache).toBeInstanceOf(Map);
      expect(optimizer.batchQueue).toEqual([]);
      expect(optimizer.optimizationStats.cacheHits).toBe(0);
      expect(optimizer.optimizationStats.cacheMisses).toBe(0);
      expect(optimizer.cacheTimeout).toBe(5 * 60 * 1000);
      expect(optimizer.maxBatchSize).toBe(50);
    });
  });

  describe('executeBatch', () => {
    test('should execute batch of operations successfully', async () => {
      const operations = [
        { type: 'status', args: [], options: {} },
        { type: 'log', args: [], options: { maxCount: 10 } },
        { type: 'branch', args: [], options: {} }
      ];

      optimizer.git.status.mockResolvedValue({ clean: true });
      optimizer.git.log.mockResolvedValue({ all: [], latest: null, total: 0 });
      optimizer.git.branch.mockResolvedValue({ all: ['main'], current: 'main' });

      const result = await optimizer.executeBatch(operations);

      expect(result.success).toBe(true);
      expect(result.operationsProcessed).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(optimizer.optimizationStats.batchedOperations).toBe(3);
    });

    test('should handle empty operations array', async () => {
      const result = await optimizer.executeBatch([]);
      expect(result).toEqual([]);
    });

    test('should optimize operation order', async () => {
      const operations = [
        { type: 'commit', args: ['test'], options: {} },
        { type: 'log', args: [], options: {} },
        { type: 'status', args: [], options: {} }
      ];

      optimizer.git.log.mockResolvedValue({ all: [] });
      optimizer.git.status.mockResolvedValue({ clean: true });
      optimizer.git.commit.mockResolvedValue({ hash: 'abc123' });

      const optimizedOps = optimizer.optimizeOperationOrder(operations);

      // Read operations (log, status) should come before write operations (commit)
      expect(optimizedOps[0].type).toBe('log');
      expect(optimizedOps[1].type).toBe('status');
      expect(optimizedOps[2].type).toBe('commit');
    });

    test('should group operations by type', () => {
      const operations = [
        { type: 'log', args: [] },
        { type: 'status', args: [] },
        { type: 'log', args: [] },
        { type: 'branch', args: [] }
      ];

      const grouped = optimizer.groupOperationsByType(operations);

      expect(grouped.size).toBe(3);
      expect(grouped.get('log')).toHaveLength(2);
      expect(grouped.get('status')).toHaveLength(1);
      expect(grouped.get('branch')).toHaveLength(1);
    });
  });

  describe('caching', () => {
    test('should cache read operation results', async () => {
      const operation = { type: 'status', args: [], options: {} };
      const mockResult = { clean: true, files: [] };

      optimizer.git.status.mockResolvedValue(mockResult);

      // First execution - should hit the git operation
      const result1 = await optimizer.executeOptimizedOperation(operation, true);
      expect(result1.fromCache).toBe(false);
      expect(optimizer.optimizationStats.cacheMisses).toBe(1);

      // Second execution - should hit the cache
      const result2 = await optimizer.executeOptimizedOperation(operation, true);
      expect(result2.fromCache).toBe(true);
      expect(optimizer.optimizationStats.cacheHits).toBe(1);

      // Git operation should only be called once
      expect(optimizer.git.status).toHaveBeenCalledTimes(1);
    });

    test('should not cache write operations', async () => {
      const operation = { type: 'commit', args: ['test message'], options: {} };
      const mockResult = { hash: 'abc123' };

      optimizer.git.commit.mockResolvedValue(mockResult);

      // Execute twice
      await optimizer.executeOptimizedOperation(operation, true);
      await optimizer.executeOptimizedOperation(operation, true);

      // Should call git operation twice (no caching for write operations)
      expect(optimizer.git.commit).toHaveBeenCalledTimes(2);
      expect(optimizer.optimizationStats.cacheHits).toBe(0);
    });

    test('should expire cache entries after timeout', async () => {
      const operation = { type: 'status', args: [], options: {} };
      const mockResult = { clean: true };

      optimizer.git.status.mockResolvedValue(mockResult);
      optimizer.cacheTimeout = 100; // 100ms timeout

      // First execution
      await optimizer.executeOptimizedOperation(operation, true);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second execution - should hit git operation again
      const result = await optimizer.executeOptimizedOperation(operation, true);
      expect(result.fromCache).toBe(false);
      expect(optimizer.git.status).toHaveBeenCalledTimes(2);
    });

    test('should clear cache', () => {
      // Add some cache entries
      optimizer.operationCache.set('key1', { result: {}, timestamp: Date.now() });
      optimizer.operationCache.set('key2', { result: {}, timestamp: Date.now() });

      expect(optimizer.operationCache.size).toBe(2);

      const result = optimizer.clearCache();

      expect(result.success).toBe(true);
      expect(optimizer.operationCache.size).toBe(0);
    });
  });

  describe('optimized group operations', () => {
    test('should optimize log operations', async () => {
      const operations = [
        { type: 'log', options: { maxCount: 10, format: 'short' } },
        { type: 'log', options: { maxCount: 5, format: 'short' } }
      ];

      const mockLogResult = {
        all: Array.from({ length: 15 }, (_, i) => ({ hash: `commit${i}`, message: `Message ${i}` }))
      };

      optimizer.git.log.mockResolvedValue(mockLogResult);

      const results = await optimizer.executeOptimizedLogGroup(operations, {});

      expect(results).toHaveLength(2);
      expect(results[0].result.all).toHaveLength(10);
      expect(results[1].result.all).toHaveLength(5);
      expect(results[0].optimized).toBe(true);
      expect(results[1].optimized).toBe(true);
    });

    test('should optimize status operations', async () => {
      const operations = [
        { type: 'status', args: [] },
        { type: 'status', args: [] },
        { type: 'status', args: [] }
      ];

      const mockStatusResult = { clean: true, files: [] };
      optimizer.git.status.mockResolvedValue(mockStatusResult);

      const results = await optimizer.executeOptimizedStatusGroup(operations, {});

      expect(results).toHaveLength(3);
      expect(optimizer.git.status).toHaveBeenCalledTimes(1); // Only called once
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.optimized).toBe(true);
        expect(result.result).toEqual(mockStatusResult);
      });
    });

    test('should handle errors in optimized groups with continueOnError', async () => {
      const operations = [
        { type: 'status', args: [] },
        { type: 'status', args: [] }
      ];

      optimizer.git.status.mockRejectedValue(new Error('Git error'));

      const results = await optimizer.executeOptimizedStatusGroup(operations, { continueOnError: true });

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBe('Git error');
      });
    });
  });

  describe('operation execution', () => {
    test('should execute different operation types', async () => {
      const testCases = [
        { type: 'log', expectedMethod: 'log' },
        { type: 'show', expectedMethod: 'show' },
        { type: 'status', expectedMethod: 'status' },
        { type: 'branch', expectedMethod: 'branch' },
        { type: 'commit', expectedMethod: 'commit' },
        { type: 'add', expectedMethod: 'add' }
      ];

      for (const testCase of testCases) {
        optimizer.git[testCase.expectedMethod] = jest.fn().mockResolvedValue({});
        
        const operation = { type: testCase.type, args: [], options: {} };
        await optimizer.executeGitOperation(operation);

        expect(optimizer.git[testCase.expectedMethod]).toHaveBeenCalled();
      }
    });

    test('should handle raw git commands', async () => {
      optimizer.git.raw.mockResolvedValue('output');

      const operation = { type: 'custom-command', args: ['--option'], options: {} };
      const result = await optimizer.executeGitOperation(operation);

      expect(optimizer.git.raw).toHaveBeenCalledWith(['custom-command', '--option']);
      expect(result).toBe('output');
    });
  });

  describe('statistics and reporting', () => {
    test('should track optimization statistics', () => {
      optimizer.optimizationStats.cacheHits = 10;
      optimizer.optimizationStats.cacheMisses = 5;
      optimizer.optimizationStats.batchedOperations = 20;
      optimizer.optimizationStats.timeSaved = 1000;

      const stats = optimizer.getOptimizationStats();

      expect(stats.cacheHitRate).toBe(66.67); // 10/15 * 100
      expect(stats.totalOperations).toBe(15);
      expect(stats.estimatedTimeSavedMs).toBe(1000);
      expect(stats.estimatedTimeSavedFormatted).toBe('1s');
    });

    test('should get cache statistics', () => {
      const now = Date.now();
      
      // Add valid and expired entries
      optimizer.operationCache.set('valid', { result: {}, timestamp: now });
      optimizer.operationCache.set('expired', { result: {}, timestamp: now - 10 * 60 * 1000 });

      const cacheStats = optimizer.getCacheStats();

      expect(cacheStats.totalEntries).toBe(2);
      expect(cacheStats.validEntries).toBe(1);
      expect(cacheStats.expiredEntries).toBe(1);
      expect(cacheStats.memoryUsage).toHaveProperty('bytes');
      expect(cacheStats.memoryUsage).toHaveProperty('formatted');
    });

    test('should generate optimization report', () => {
      optimizer.optimizationStats.cacheHits = 8;
      optimizer.optimizationStats.cacheMisses = 2;
      optimizer.optimizationStats.batchedOperations = 15;

      const report = optimizer.generateOptimizationReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('optimization');
      expect(report).toHaveProperty('cache');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should generate optimization recommendations', () => {
      const lowCacheStats = { cacheHitRate: 20, totalOperations: 100, batchedOperations: 30 };
      const cacheStats = { expiredEntries: 10, validEntries: 5 };

      const recommendations = optimizer.generateOptimizationRecommendations(lowCacheStats, cacheStats);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'cache')).toBe(true);
      expect(recommendations.some(r => r.type === 'cache_cleanup')).toBe(true);
      expect(recommendations.some(r => r.type === 'batching')).toBe(true);
    });
  });

  describe('repository optimization', () => {
    test('should optimize repository successfully', async () => {
      optimizer.git.raw
        .mockResolvedValueOnce('') // gc
        .mockResolvedValueOnce('') // repack
        .mockResolvedValueOnce('') // pack-refs
        .mockResolvedValueOnce('') // prune
        .mockResolvedValueOnce(''); // update-server-info

      const result = await optimizer.optimizeRepository();

      expect(result.success).toBe(true);
      expect(result.optimizations).toContain('garbage_collection');
      expect(result.optimizations).toContain('repack');
      expect(result.optimizations).toContain('pack_refs');
      expect(result.optimizations).toContain('prune');
      expect(result.duration).toBeGreaterThan(0);

      expect(optimizer.git.raw).toHaveBeenCalledWith(['gc', '--auto']);
      expect(optimizer.git.raw).toHaveBeenCalledWith(['repack', '-a', '-d', '-f']);
      expect(optimizer.git.raw).toHaveBeenCalledWith(['pack-refs', '--all']);
      expect(optimizer.git.raw).toHaveBeenCalledWith(['prune']);
    });

    test('should handle repository optimization errors', async () => {
      optimizer.git.raw.mockRejectedValue(new Error('Git optimization failed'));

      await expect(optimizer.optimizeRepository()).rejects.toThrow(
        'Repository optimization failed: Git optimization failed'
      );
    });

    test('should continue if update-server-info fails', async () => {
      optimizer.git.raw
        .mockResolvedValueOnce('') // gc
        .mockResolvedValueOnce('') // repack
        .mockResolvedValueOnce('') // pack-refs
        .mockResolvedValueOnce('') // prune
        .mockRejectedValueOnce(new Error('update-server-info failed')); // update-server-info

      const result = await optimizer.optimizeRepository();

      expect(result.success).toBe(true);
      expect(result.optimizations).not.toContain('update_server_info');
    });
  });

  describe('utility methods', () => {
    test('should create operation objects', () => {
      const operation = optimizer.createOperation('log', ['--oneline'], { maxCount: 10 });

      expect(operation.type).toBe('log');
      expect(operation.args).toEqual(['--oneline']);
      expect(operation.options).toEqual({ maxCount: 10 });
      expect(operation.id).toMatch(/^op-\d+-[a-z0-9]+$/);
    });

    test('should handle single arg as string', () => {
      const operation = optimizer.createOperation('show', 'abc123');

      expect(operation.args).toEqual(['abc123']);
    });

    test('should format duration correctly', () => {
      expect(optimizer.formatDuration(500)).toBe('500ms');
      expect(optimizer.formatDuration(5000)).toBe('5s');
      expect(optimizer.formatDuration(300000)).toBe('5m');
      expect(optimizer.formatDuration(7200000)).toBe('2h');
    });

    test('should format bytes correctly', () => {
      expect(optimizer.formatBytes(0)).toBe('0 B');
      expect(optimizer.formatBytes(1024)).toBe('1 KB');
      expect(optimizer.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(optimizer.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    test('should chunk arrays correctly', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = optimizer.chunkArray(array, 3);

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });

    test('should estimate time saved', () => {
      const timeSaved = optimizer.estimateTimeSaved(10);
      expect(timeSaved).toBe(500); // 10 * 50ms
    });
  });

  describe('error handling', () => {
    test('should handle operation execution errors', async () => {
      const operation = { type: 'status', args: [], options: {} };
      optimizer.git.status.mockRejectedValue(new Error('Git status failed'));

      await expect(optimizer.executeOptimizedOperation(operation, false)).rejects.toThrow(
        'Operation status failed: Git status failed'
      );
    });

    test('should handle batch execution errors with continueOnError', async () => {
      const operations = [
        { type: 'status', args: [] },
        { type: 'log', args: [] }
      ];

      optimizer.git.status.mockRejectedValue(new Error('Status failed'));
      optimizer.git.log.mockResolvedValue({ all: [] });

      const result = await optimizer.executeBatch(operations, { continueOnError: true });

      expect(result.success).toBe(true);
      expect(result.results.some(r => r.success === false)).toBe(true);
      expect(result.results.some(r => r.success === true)).toBe(true);
    });
  });

  describe('performance scenarios', () => {
    test('should handle large batch efficiently', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: 'status',
        args: [],
        options: {}
      }));

      optimizer.git.status.mockResolvedValue({ clean: true });

      const startTime = Date.now();
      const result = await optimizer.executeBatch(operations);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.operationsProcessed).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Should optimize by combining status operations
      expect(optimizer.git.status).toHaveBeenCalledTimes(1);
    });

    test('should maintain cache efficiency with many operations', async () => {
      const operations = Array.from({ length: 50 }, () => ({
        type: 'status',
        args: [],
        options: {}
      }));

      optimizer.git.status.mockResolvedValue({ clean: true });

      // Execute batch twice to test caching
      await optimizer.executeBatch(operations, { enableCaching: true });
      await optimizer.executeBatch(operations, { enableCaching: true });

      const stats = optimizer.getOptimizationStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });
  });
});