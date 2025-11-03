/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Streaming Performance Tests
 */

const StreamingGitManager = require('../../src/utils/StreamingGitManager');
const MemoryMonitor = require('../../src/utils/MemoryMonitor');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies for performance testing
jest.mock('../../src/core/GitManager');

describe('Streaming Performance Tests', () => {
  let streamingGitManager;
  let memoryMonitor;
  let testDir;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-perf-test-' + Date.now());
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
    
    streamingGitManager = new StreamingGitManager(testDir);
    memoryMonitor = new MemoryMonitor({
      sampleInterval: 100,
      maxSamples: 1000
    });

    // Mock GitManager methods for performance testing
    streamingGitManager.git = {
      raw: jest.fn().mockResolvedValue(''),
      log: jest.fn(),
      show: jest.fn()
    };
  });

  afterEach(() => {
    if (memoryMonitor.isMonitoring) {
      memoryMonitor.stopMonitoring();
    }
  });

  describe('Large Dataset Performance', () => {
    test('should handle 10,000 commits efficiently', async () => {
      const commitCount = 10000;
      const chunkSize = 100;
      
      // Mock large dataset
      streamingGitManager.getCommitCount = jest.fn().mockResolvedValue(commitCount);
      
      // Create mock commits
      const createMockCommits = (start, count) => 
        Array.from({ length: count }, (_, i) => ({
          hash: `commit${start + i}`,
          message: `Commit message ${start + i}`,
          author: `Author ${(start + i) % 10}`, // 10 different authors
          date: new Date(Date.now() - (start + i) * 86400000).toISOString(), // Daily commits
          email: `author${(start + i) % 10}@example.com`
        }));

      // Mock getCommitHistory to return chunks
      let callCount = 0;
      streamingGitManager.getCommitHistory = jest.fn().mockImplementation(() => {
        const start = callCount * chunkSize;
        callCount++;
        
        if (start >= commitCount) {
          return Promise.resolve([]);
        }
        
        const remaining = Math.min(chunkSize, commitCount - start);
        return Promise.resolve(createMockCommits(start, remaining));
      });

      const startTime = Date.now();
      memoryMonitor.startMonitoring();

      let totalProcessed = 0;
      let chunkCount = 0;
      const memorySnapshots = [];

      // Process commits with memory tracking
      const transformFn = (commits) => {
        totalProcessed += commits.length;
        chunkCount++;
        
        // Take memory snapshot
        const memoryUsage = process.memoryUsage();
        memorySnapshots.push({
          chunk: chunkCount,
          processed: totalProcessed,
          heapUsed: memoryUsage.heapUsed,
          timestamp: Date.now()
        });

        // Simulate some processing work
        return {
          processed: commits.length,
          analysis: commits.map(c => ({
            hash: c.hash,
            messageLength: c.message.length,
            authorHash: c.author.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
          }))
        };
      };

      const result = await streamingGitManager.processCommitsStreaming(transformFn, {
        chunkSize
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      memoryMonitor.stopMonitoring();
      const memoryStats = memoryMonitor.getStats();

      // Performance assertions
      expect(result.totalProcessed).toBe(commitCount);
      expect(result.totalErrors).toBe(0);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Memory efficiency assertions
      const maxMemoryUsed = Math.max(...memorySnapshots.map(s => s.heapUsed));
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1].heapUsed - memorySnapshots[0].heapUsed;
      
      expect(maxMemoryUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
      
      // Throughput assertions
      const commitsPerSecond = commitCount / (duration / 1000);
      expect(commitsPerSecond).toBeGreaterThan(100); // At least 100 commits/second

      console.log(`Performance Results:
        - Total commits: ${commitCount}
        - Duration: ${duration}ms
        - Commits/second: ${Math.round(commitsPerSecond)}
        - Max memory: ${Math.round(maxMemoryUsed / 1024 / 1024)}MB
        - Memory growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB
        - Chunks processed: ${chunkCount}`);
    }, 60000); // 60 second timeout

    test('should maintain consistent memory usage across chunks', async () => {
      const commitCount = 5000;
      const chunkSize = 50;
      
      streamingGitManager.getCommitCount = jest.fn().mockResolvedValue(commitCount);
      
      const memoryUsagePerChunk = [];
      let callCount = 0;

      streamingGitManager.getCommitHistory = jest.fn().mockImplementation(() => {
        const start = callCount * chunkSize;
        callCount++;
        
        if (start >= commitCount) {
          return Promise.resolve([]);
        }
        
        const commits = Array.from({ length: Math.min(chunkSize, commitCount - start) }, (_, i) => ({
          hash: `commit${start + i}`,
          message: `Message ${start + i}`,
          author: 'Test Author',
          date: new Date().toISOString()
        }));
        
        return Promise.resolve(commits);
      });

      const transformFn = (commits) => {
        const memoryBefore = process.memoryUsage();
        
        // Simulate processing that might accumulate memory
        const processed = commits.map(commit => ({
          ...commit,
          processed: true,
          timestamp: Date.now(),
          metadata: {
            length: commit.message.length,
            words: commit.message.split(' ').length
          }
        }));

        const memoryAfter = process.memoryUsage();
        
        memoryUsagePerChunk.push({
          before: memoryBefore.heapUsed,
          after: memoryAfter.heapUsed,
          delta: memoryAfter.heapUsed - memoryBefore.heapUsed,
          chunk: memoryUsagePerChunk.length + 1
        });

        return { processed: processed.length };
      };

      await streamingGitManager.processCommitsStreaming(transformFn, { chunkSize });

      // Analyze memory consistency
      const memoryDeltas = memoryUsagePerChunk.map(m => m.delta);
      const avgDelta = memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length;
      const maxDelta = Math.max(...memoryDeltas);
      const minDelta = Math.min(...memoryDeltas);
      
      // Memory should be relatively consistent across chunks
      expect(maxDelta - minDelta).toBeLessThan(50 * 1024 * 1024); // Less than 50MB variance
      expect(Math.abs(avgDelta)).toBeLessThan(10 * 1024 * 1024); // Average delta less than 10MB

      console.log(`Memory Consistency Results:
        - Chunks processed: ${memoryUsagePerChunk.length}
        - Average memory delta: ${Math.round(avgDelta / 1024 / 1024)}MB
        - Max delta: ${Math.round(maxDelta / 1024 / 1024)}MB
        - Min delta: ${Math.round(minDelta / 1024 / 1024)}MB
        - Variance: ${Math.round((maxDelta - minDelta) / 1024 / 1024)}MB`);
    });
  });

  describe('Memory Pressure Handling', () => {
    test('should handle memory pressure gracefully', async () => {
      const commitCount = 1000;
      const chunkSize = 100;
      
      streamingGitManager.getCommitCount = jest.fn().mockResolvedValue(commitCount);
      
      // Mock high memory usage scenario
      const originalMemoryUsage = process.memoryUsage;
      let memoryPressureSimulated = false;
      
      process.memoryUsage = jest.fn().mockImplementation(() => {
        const baseUsage = originalMemoryUsage();
        
        // Simulate memory pressure after processing some chunks
        if (!memoryPressureSimulated && Math.random() > 0.7) {
          memoryPressureSimulated = true;
          return {
            ...baseUsage,
            heapUsed: 600 * 1024 * 1024 // 600MB - above threshold
          };
        }
        
        return baseUsage;
      });

      let callCount = 0;
      streamingGitManager.getCommitHistory = jest.fn().mockImplementation(() => {
        const start = callCount * chunkSize;
        callCount++;
        
        if (start >= commitCount) {
          return Promise.resolve([]);
        }
        
        return Promise.resolve(
          Array.from({ length: Math.min(chunkSize, commitCount - start) }, (_, i) => ({
            hash: `commit${start + i}`,
            message: `Message ${start + i}`,
            author: 'Test Author'
          }))
        );
      });

      const warnings = [];
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation((message) => {
        warnings.push(message);
      });

      const transformFn = (commits) => ({ processed: commits.length });

      const result = await streamingGitManager.processCommitsStreaming(transformFn, { chunkSize });

      // Restore original memoryUsage
      process.memoryUsage = originalMemoryUsage;
      consoleSpy.mockRestore();

      expect(result.totalProcessed).toBe(commitCount);
      
      // Should have issued memory warnings
      if (memoryPressureSimulated) {
        expect(warnings.some(w => w.includes('High memory usage detected'))).toBe(true);
      }

      console.log(`Memory Pressure Test Results:
        - Memory pressure simulated: ${memoryPressureSimulated}
        - Warnings issued: ${warnings.length}
        - Processing completed successfully: ${result.totalProcessed === commitCount}`);
    });

    test('should trigger garbage collection when enabled', async () => {
      // Mock global.gc
      const mockGC = jest.fn();
      global.gc = mockGC;

      const monitor = new MemoryMonitor({
        enableGC: true,
        criticalThreshold: 0.5, // Low threshold to trigger GC
        sampleInterval: 50
      });

      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 400 * 1024 * 1024, // High usage
        heapTotal: 500 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        rss: 450 * 1024 * 1024
      });

      monitor.startMonitoring();

      // Wait for monitoring to detect high usage and trigger GC
      await new Promise(resolve => setTimeout(resolve, 200));

      monitor.stopMonitoring();

      // Restore
      process.memoryUsage = originalMemoryUsage;
      delete global.gc;

      expect(mockGC).toHaveBeenCalled();
      expect(monitor.stats.gcRuns).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Processing', () => {
    test('should handle concurrent batch processing', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `item-${i}` }));
      
      const processingTimes = [];
      const processFn = async (batch, context) => {
        const startTime = Date.now();
        
        // Simulate async processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        const processed = batch.map(item => ({
          ...item,
          processed: true,
          batchIndex: context.batchIndex
        }));

        const endTime = Date.now();
        processingTimes.push(endTime - startTime);

        return { processed: processed.length };
      };

      const startTime = Date.now();
      
      const result = await streamingGitManager.batchProcess(items, processFn, {
        batchSize: 50,
        onProgress: (progress) => {
          // Track progress
        }
      });

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(result.totalProcessed).toBe(1000);
      expect(result.totalErrors).toBe(0);
      expect(result.batches.length).toBe(20); // 1000 / 50

      // Performance metrics
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const itemsPerSecond = 1000 / (totalDuration / 1000);

      expect(avgProcessingTime).toBeLessThan(100); // Less than 100ms per batch
      expect(itemsPerSecond).toBeGreaterThan(50); // At least 50 items/second

      console.log(`Concurrent Processing Results:
        - Total items: 1000
        - Batches: ${result.batches.length}
        - Total duration: ${totalDuration}ms
        - Items/second: ${Math.round(itemsPerSecond)}
        - Avg batch time: ${Math.round(avgProcessingTime)}ms`);
    });
  });

  describe('Stream Performance', () => {
    test('should efficiently stream large datasets', async () => {
      const commitCount = 2000;
      const chunkSize = 100;
      
      streamingGitManager.getCommitCount = jest.fn().mockResolvedValue(commitCount);
      
      let callCount = 0;
      streamingGitManager.getCommitHistory = jest.fn().mockImplementation(() => {
        const start = callCount * chunkSize;
        callCount++;
        
        if (start >= commitCount) {
          return Promise.resolve([]);
        }
        
        return Promise.resolve(
          Array.from({ length: Math.min(chunkSize, commitCount - start) }, (_, i) => ({
            hash: `commit${start + i}`,
            message: `Message ${start + i}`,
            author: 'Test Author',
            date: new Date().toISOString()
          }))
        );
      });

      const stream = streamingGitManager.createCommitStream({ chunkSize });
      
      const chunks = [];
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          const totalCommits = chunks.reduce((sum, chunk) => sum + chunk.commits.length, 0);
          const commitsPerSecond = totalCommits / (duration / 1000);

          expect(totalCommits).toBe(commitCount);
          expect(chunks.length).toBe(commitCount / chunkSize);
          expect(commitsPerSecond).toBeGreaterThan(200); // At least 200 commits/second

          console.log(`Stream Performance Results:
            - Total commits streamed: ${totalCommits}
            - Chunks: ${chunks.length}
            - Duration: ${duration}ms
            - Commits/second: ${Math.round(commitsPerSecond)}`);

          resolve();
        });

        stream.on('error', reject);
      });
    });
  });

  describe('System Resource Optimization', () => {
    test('should configure optimally for different system specs', () => {
      // Test low-end system configuration
      const lowEndConfig = streamingGitManager.configureForSystem({
        totalMemory: 2 * 1024 * 1024 * 1024, // 2GB
        availableMemory: 1 * 1024 * 1024 * 1024, // 1GB
        cpuCores: 2
      });

      expect(lowEndConfig.chunkSize).toBe(50);
      expect(lowEndConfig.memoryThreshold).toBe(200 * 1024 * 1024);
      expect(lowEndConfig.recommendedConcurrency).toBe(2);

      // Test high-end system configuration
      const highEndConfig = streamingGitManager.configureForSystem({
        totalMemory: 32 * 1024 * 1024 * 1024, // 32GB
        availableMemory: 16 * 1024 * 1024 * 1024, // 16GB
        cpuCores: 16
      });

      expect(highEndConfig.chunkSize).toBe(200);
      expect(highEndConfig.memoryThreshold).toBe(800 * 1024 * 1024);
      expect(highEndConfig.recommendedConcurrency).toBe(4); // Capped at 4

      // Verify optimization improves performance
      expect(highEndConfig.chunkSize).toBeGreaterThan(lowEndConfig.chunkSize);
      expect(highEndConfig.memoryThreshold).toBeGreaterThan(lowEndConfig.memoryThreshold);
    });

    test('should provide meaningful performance recommendations', () => {
      // Simulate high memory usage scenario
      const mockMemoryMonitor = {
        getStats: () => ({
          peak: 600 * 1024 * 1024, // High peak usage
          average: 400 * 1024 * 1024,
          samples: 100
        })
      };

      streamingGitManager.memoryMonitor = mockMemoryMonitor;
      streamingGitManager.chunkSize = 600; // Large chunk size

      const recommendations = streamingGitManager.getPerformanceRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'memory')).toBe(true);
      expect(recommendations.some(r => r.type === 'chunk_size')).toBe(true);
      
      const memoryRec = recommendations.find(r => r.type === 'memory');
      expect(memoryRec.priority).toBe('high');
      expect(memoryRec.message).toContain('Consider reducing chunk size');
    });
  });

  describe('Error Recovery Performance', () => {
    test('should recover quickly from processing errors', async () => {
      const commitCount = 500;
      const chunkSize = 50;
      const errorRate = 0.2; // 20% error rate
      
      streamingGitManager.getCommitCount = jest.fn().mockResolvedValue(commitCount);
      
      let callCount = 0;
      streamingGitManager.getCommitHistory = jest.fn().mockImplementation(() => {
        const start = callCount * chunkSize;
        callCount++;
        
        if (start >= commitCount) {
          return Promise.resolve([]);
        }
        
        return Promise.resolve(
          Array.from({ length: Math.min(chunkSize, commitCount - start) }, (_, i) => ({
            hash: `commit${start + i}`,
            message: `Message ${start + i}`
          }))
        );
      });

      const transformFn = jest.fn().mockImplementation((commits, context) => {
        // Randomly throw errors
        if (Math.random() < errorRate) {
          throw new Error(`Processing error in chunk ${context.chunkIndex}`);
        }
        return { processed: commits.length };
      });

      const startTime = Date.now();
      
      const result = await streamingGitManager.processCommitsStreaming(transformFn, {
        chunkSize,
        continueOnError: true
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete despite errors
      expect(result.totalProcessed).toBe(commitCount);
      expect(result.totalErrors).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Error recovery should not significantly impact performance
      const expectedChunks = Math.ceil(commitCount / chunkSize);
      const errorRate = result.totalErrors / expectedChunks;
      expect(errorRate).toBeLessThan(0.5); // Less than 50% error rate

      console.log(`Error Recovery Performance:
        - Total processed: ${result.totalProcessed}
        - Errors: ${result.totalErrors}
        - Error rate: ${Math.round(errorRate * 100)}%
        - Duration: ${duration}ms
        - Recovery successful: ${result.totalProcessed === commitCount}`);
    });
  });
});