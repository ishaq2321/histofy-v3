/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * StreamingGitManager Tests
 */

const StreamingGitManager = require('../../src/utils/StreamingGitManager');
const MemoryMonitor = require('../../src/utils/MemoryMonitor');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/core/GitManager');
jest.mock('../../src/utils/MemoryMonitor');

describe('StreamingGitManager', () => {
  let streamingGitManager;
  let testDir;
  let mockMemoryMonitor;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-streaming-test-' + Date.now());
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

    // Setup MemoryMonitor mock
    mockMemoryMonitor = {
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      getCurrentUsage: jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 200 * 1024 * 1024,
        rss: 150 * 1024 * 1024,
        external: 10 * 1024 * 1024
      }),
      getStats: jest.fn().mockReturnValue({
        peak: 150 * 1024 * 1024,
        average: 120 * 1024 * 1024,
        samples: 100
      })
    };

    MemoryMonitor.mockImplementation(() => mockMemoryMonitor);

    streamingGitManager = new StreamingGitManager(testDir);
    
    // Mock GitManager methods
    streamingGitManager.getCommitCount = jest.fn().mockResolvedValue(1000);
    streamingGitManager.getCommitHistory = jest.fn();
    streamingGitManager.git = {
      raw: jest.fn()
    };
  });

  describe('streamCommitHistory', () => {
    test('should stream commits in chunks', async () => {
      // Mock commit data
      const mockCommits = Array.from({ length: 50 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Commit message ${i}`,
        author: 'Test Author',
        date: new Date().toISOString()
      }));

      streamingGitManager.getCommitHistory
        .mockResolvedValueOnce(mockCommits.slice(0, 25))
        .mockResolvedValueOnce(mockCommits.slice(25, 50))
        .mockResolvedValueOnce([]);

      const chunks = [];
      for await (const chunk of streamingGitManager.streamCommitHistory({ chunkSize: 25 })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].commits).toHaveLength(25);
      expect(chunks[1].commits).toHaveLength(25);
      expect(chunks[0].chunk).toBe(1);
      expect(chunks[1].chunk).toBe(2);
      expect(mockMemoryMonitor.startMonitoring).toHaveBeenCalled();
      expect(mockMemoryMonitor.stopMonitoring).toHaveBeenCalled();
    });

    test('should handle memory threshold warnings', async () => {
      // Mock high memory usage
      mockMemoryMonitor.getCurrentUsage.mockReturnValue({
        heapUsed: 600 * 1024 * 1024, // 600MB (above threshold)
        heapTotal: 800 * 1024 * 1024,
        rss: 700 * 1024 * 1024,
        external: 50 * 1024 * 1024
      });

      const mockCommits = Array.from({ length: 10 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Commit message ${i}`
      }));

      streamingGitManager.getCommitHistory
        .mockResolvedValueOnce(mockCommits)
        .mockResolvedValueOnce([]);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const chunks = [];
      for await (const chunk of streamingGitManager.streamCommitHistory({ chunkSize: 10 })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: High memory usage detected')
      );

      consoleSpy.mockRestore();
    });

    test('should handle empty repository', async () => {
      streamingGitManager.getCommitCount.mockResolvedValue(0);
      streamingGitManager.getCommitHistory.mockResolvedValue([]);

      const chunks = [];
      for await (const chunk of streamingGitManager.streamCommitHistory()) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });
  });

  describe('processCommitsStreaming', () => {
    test('should process commits with transform function', async () => {
      const mockCommits = Array.from({ length: 20 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Message ${i}`
      }));

      streamingGitManager.getCommitHistory
        .mockResolvedValueOnce(mockCommits.slice(0, 10))
        .mockResolvedValueOnce(mockCommits.slice(10, 20))
        .mockResolvedValueOnce([]);

      const transformFn = jest.fn().mockImplementation((commits) => {
        return { processedCount: commits.length };
      });

      const result = await streamingGitManager.processCommitsStreaming(transformFn, {
        chunkSize: 10
      });

      expect(result.totalProcessed).toBe(20);
      expect(result.totalErrors).toBe(0);
      expect(result.chunks).toHaveLength(2);
      expect(transformFn).toHaveBeenCalledTimes(2);
      expect(result.memoryStats.peak).toBeGreaterThan(0);
    });

    test('should handle transform errors with continueOnError', async () => {
      const mockCommits = Array.from({ length: 20 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Message ${i}`
      }));

      streamingGitManager.getCommitHistory
        .mockResolvedValueOnce(mockCommits.slice(0, 10))
        .mockResolvedValueOnce(mockCommits.slice(10, 20))
        .mockResolvedValueOnce([]);

      const transformFn = jest.fn()
        .mockImplementationOnce(() => { throw new Error('Transform error'); })
        .mockImplementationOnce((commits) => ({ processedCount: commits.length }));

      const result = await streamingGitManager.processCommitsStreaming(transformFn, {
        chunkSize: 10,
        continueOnError: true
      });

      expect(result.totalProcessed).toBe(20);
      expect(result.totalErrors).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Transform error');
    });

    test('should call progress callback', async () => {
      const mockCommits = Array.from({ length: 10 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Message ${i}`
      }));

      streamingGitManager.getCommitHistory
        .mockResolvedValueOnce(mockCommits)
        .mockResolvedValueOnce([]);

      const transformFn = jest.fn().mockResolvedValue({ processed: true });
      const onProgress = jest.fn();

      await streamingGitManager.processCommitsStreaming(transformFn, {
        chunkSize: 10,
        onProgress
      });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          chunk: 1,
          totalChunks: 1,
          processed: 10,
          total: 1000
        })
      );
    });
  });

  describe('createCommitStream', () => {
    test('should create readable stream of commits', async () => {
      const mockCommits = Array.from({ length: 5 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Message ${i}`
      }));

      streamingGitManager.getCommitHistory
        .mockResolvedValueOnce(mockCommits)
        .mockResolvedValueOnce([]);

      const stream = streamingGitManager.createCommitStream({ chunkSize: 5 });
      const chunks = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          expect(chunks).toHaveLength(1);
          expect(chunks[0].commits).toHaveLength(5);
          resolve();
        });

        stream.on('error', reject);
      });
    });
  });

  describe('batchProcess', () => {
    test('should process items in batches', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));
      const processFn = jest.fn().mockImplementation((batch) => {
        return { processed: batch.length };
      });

      const result = await streamingGitManager.batchProcess(items, processFn, {
        batchSize: 10
      });

      expect(result.totalProcessed).toBe(25);
      expect(result.batches).toHaveLength(3);
      expect(result.batches[0].size).toBe(10);
      expect(result.batches[1].size).toBe(10);
      expect(result.batches[2].size).toBe(5);
      expect(processFn).toHaveBeenCalledTimes(3);
    });

    test('should handle batch processing errors', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const processFn = jest.fn()
        .mockImplementationOnce(() => { throw new Error('Batch error'); })
        .mockImplementationOnce((batch) => ({ processed: batch.length }));

      const result = await streamingGitManager.batchProcess(items, processFn, {
        batchSize: 10
      });

      expect(result.totalProcessed).toBe(20);
      expect(result.totalErrors).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Batch error');
    });

    test('should call progress callback during batch processing', async () => {
      const items = Array.from({ length: 15 }, (_, i) => ({ id: i }));
      const processFn = jest.fn().mockResolvedValue({ processed: true });
      const onProgress = jest.fn();

      await streamingGitManager.batchProcess(items, processFn, {
        batchSize: 10,
        onProgress
      });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          batch: 1,
          totalBatches: 2,
          processed: 10,
          total: 15
        })
      );
    });
  });

  describe('optimizeForStreaming', () => {
    test('should run repository optimization commands', async () => {
      streamingGitManager.git.raw
        .mockResolvedValueOnce('') // gc
        .mockResolvedValueOnce('') // repack
        .mockResolvedValueOnce(''); // update-server-info

      const result = await streamingGitManager.optimizeForStreaming();

      expect(result.success).toBe(true);
      expect(result.optimizations).toContain('garbage_collection');
      expect(result.optimizations).toContain('repack_objects');
      expect(result.optimizations).toContain('update_server_info');
      
      expect(streamingGitManager.git.raw).toHaveBeenCalledWith(['gc', '--aggressive']);
      expect(streamingGitManager.git.raw).toHaveBeenCalledWith(['repack', '-a', '-d']);
      expect(streamingGitManager.git.raw).toHaveBeenCalledWith(['update-server-info']);
    });

    test('should handle optimization errors gracefully', async () => {
      streamingGitManager.git.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(streamingGitManager.optimizeForStreaming()).rejects.toThrow(
        'Repository optimization failed: Git command failed'
      );
    });
  });

  describe('configureForSystem', () => {
    test('should configure parameters for low memory system', () => {
      const config = streamingGitManager.configureForSystem({
        totalMemory: 2 * 1024 * 1024 * 1024, // 2GB
        availableMemory: 1 * 1024 * 1024 * 1024, // 1GB
        cpuCores: 2
      });

      expect(config.chunkSize).toBe(50);
      expect(config.memoryThreshold).toBe(200 * 1024 * 1024);
      expect(config.recommendedConcurrency).toBe(2);
    });

    test('should configure parameters for high memory system', () => {
      const config = streamingGitManager.configureForSystem({
        totalMemory: 16 * 1024 * 1024 * 1024, // 16GB
        availableMemory: 8 * 1024 * 1024 * 1024, // 8GB
        cpuCores: 8
      });

      expect(config.chunkSize).toBe(200);
      expect(config.memoryThreshold).toBe(800 * 1024 * 1024);
      expect(config.recommendedConcurrency).toBe(4); // Capped at 4
    });
  });

  describe('getStreamingMetrics', () => {
    test('should return streaming performance metrics', () => {
      const metrics = streamingGitManager.getStreamingMetrics();

      expect(metrics).toHaveProperty('chunkSize');
      expect(metrics).toHaveProperty('memoryThreshold');
      expect(metrics).toHaveProperty('memoryMonitor');
      expect(metrics).toHaveProperty('recommendations');
      expect(Array.isArray(metrics.recommendations)).toBe(true);
    });
  });

  describe('getPerformanceRecommendations', () => {
    test('should provide recommendations for high memory usage', () => {
      mockMemoryMonitor.getStats.mockReturnValue({
        peak: 600 * 1024 * 1024, // Above threshold
        average: 400 * 1024 * 1024,
        samples: 100
      });

      const recommendations = streamingGitManager.getPerformanceRecommendations();

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'memory',
            priority: 'high',
            message: expect.stringContaining('Consider reducing chunk size')
          })
        ])
      );
    });

    test('should provide recommendations for large chunk size', () => {
      streamingGitManager.chunkSize = 600; // Large chunk size

      const recommendations = streamingGitManager.getPerformanceRecommendations();

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'chunk_size',
            priority: 'medium',
            message: expect.stringContaining('Large chunk size may cause memory issues')
          })
        ])
      );
    });
  });

  describe('error handling', () => {
    test('should handle streaming errors gracefully', async () => {
      streamingGitManager.getCommitHistory.mockRejectedValue(new Error('Git error'));

      const transformFn = jest.fn();

      await expect(
        streamingGitManager.processCommitsStreaming(transformFn)
      ).rejects.toThrow('Streaming processing failed: Git error');
    });

    test('should handle memory monitoring errors', async () => {
      mockMemoryMonitor.getCurrentUsage.mockImplementation(() => {
        throw new Error('Memory monitoring error');
      });

      const mockCommits = [{ hash: 'test', message: 'test' }];
      streamingGitManager.getCommitHistory
        .mockResolvedValueOnce(mockCommits)
        .mockResolvedValueOnce([]);

      // Should not throw, should handle gracefully
      const chunks = [];
      for await (const chunk of streamingGitManager.streamCommitHistory({ chunkSize: 1 })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
    });
  });

  describe('integration scenarios', () => {
    test('should handle large repository simulation', async () => {
      // Simulate large repository with many commits
      streamingGitManager.getCommitCount.mockResolvedValue(10000);
      
      const mockCommits = Array.from({ length: 100 }, (_, i) => ({
        hash: `commit${i}`,
        message: `Message ${i}`,
        author: 'Test Author',
        date: new Date().toISOString()
      }));

      // Mock multiple chunks
      streamingGitManager.getCommitHistory
        .mockResolvedValue(mockCommits)
        .mockResolvedValueOnce(mockCommits)
        .mockResolvedValueOnce(mockCommits)
        .mockResolvedValueOnce([]);

      const transformFn = jest.fn().mockImplementation((commits) => ({
        processed: commits.length,
        analyzed: commits.map(c => ({ hash: c.hash, length: c.message.length }))
      }));

      const result = await streamingGitManager.processCommitsStreaming(transformFn, {
        chunkSize: 100,
        onProgress: jest.fn()
      });

      expect(result.totalProcessed).toBeGreaterThan(0);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.memoryStats.peak).toBeGreaterThan(0);
    });
  });
});