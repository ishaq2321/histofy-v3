/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Performance Tests - Testing performance and memory usage
 */

const GitManager = require('../../src/core/GitManager');
const ConfigManager = require('../../src/config/ConfigManager');
const SecurityUtils = require('../../src/security/SecurityUtils');
const ValidationUtils = require('../../src/utils/ValidationUtils');
const { ProgressIndicator, MultiStepProgress } = require('../../src/utils/progress');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { execSync } = require('child_process');

describe('Performance Tests', () => {
  // Performance test timeout - 30 seconds
  const PERFORMANCE_TIMEOUT = 30000;

  describe('GitManager Performance', () => {
    let testRepoPath;
    let gitManager;
    let originalCwd;

    beforeAll(async () => {
      originalCwd = process.cwd();
      testRepoPath = path.join(os.tmpdir(), 'histofy-perf-test-' + Date.now());
      
      // Create test repository with many files
      await fs.mkdir(testRepoPath, { recursive: true });
      process.chdir(testRepoPath);
      
      try {
        execSync('git init', { stdio: 'ignore' });
        execSync('git config user.name "Test User"', { stdio: 'ignore' });
        execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
        
        // Create many files for performance testing
        for (let i = 0; i < 100; i++) {
          await fs.writeFile(`file-${i}.txt`, `Content for file ${i}\n`.repeat(10));
        }
        
        execSync('git add .', { stdio: 'ignore' });
        execSync('git commit -m "Initial commit with many files"', { stdio: 'ignore' });
        
        // Create more commits for history
        for (let i = 0; i < 20; i++) {
          await fs.writeFile(`commit-${i}.txt`, `Commit ${i} content`);
          execSync(`git add commit-${i}.txt`, { stdio: 'ignore' });
          execSync(`git commit -m "Commit ${i}"`, { stdio: 'ignore' });
        }
      } catch (error) {
        console.warn('Git setup failed, some performance tests may be skipped:', error.message);
      }
      
      gitManager = new GitManager(testRepoPath);
    }, PERFORMANCE_TIMEOUT);

    afterAll(async () => {
      process.chdir(originalCwd);
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup test repo:', error.message);
      }
    });

    test('should handle large repository status efficiently', async () => {
      const start = Date.now();
      
      const status = await gitManager.getStatus();
      
      const duration = Date.now() - start;
      
      expect(status).toHaveProperty('files');
      expect(Array.isArray(status.files)).toBe(true);
      
      // Should complete within reasonable time (5 seconds for 100+ files)
      expect(duration).toBeLessThan(5000);
    }, PERFORMANCE_TIMEOUT);

    test('should handle multiple concurrent status checks', async () => {
      const start = Date.now();
      
      // Run 10 concurrent status checks
      const promises = Array.from({ length: 10 }, () => gitManager.getStatus());
      const results = await Promise.all(promises);
      
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('files');
      });
      
      // Should handle concurrent requests efficiently
      expect(duration).toBeLessThan(10000);
    }, PERFORMANCE_TIMEOUT);

    test('should create backups efficiently for large repositories', async () => {
      const start = Date.now();
      
      const backupResult = await gitManager.createBackup();
      
      const duration = Date.now() - start;
      
      expect(backupResult.success).toBe(true);
      expect(backupResult.backupPath).toBeDefined();
      
      // Should complete backup within reasonable time
      expect(duration).toBeLessThan(15000);
    }, PERFORMANCE_TIMEOUT);

    test('should handle large commit history efficiently', async () => {
      const start = Date.now();
      
      // Get commit history (should have 20+ commits)
      const history = await gitManager.getCommitHistory(50);
      
      const duration = Date.now() - start;
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(15);
      
      // Should retrieve history efficiently
      expect(duration).toBeLessThan(3000);
    }, PERFORMANCE_TIMEOUT);

    test('should handle memory usage efficiently during operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await gitManager.getStatus();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncreasePercent).toBeLessThan(50);
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Configuration Performance', () => {
    let configManager;
    let testConfigDir;

    beforeEach(async () => {
      testConfigDir = path.join(os.tmpdir(), 'histofy-config-perf-' + Date.now());
      configManager = new ConfigManager(testConfigDir);
      await configManager.init();
    });

    afterEach(async () => {
      try {
        await fs.rm(testConfigDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should handle large configuration files efficiently', async () => {
      // Create large configuration
      const largeConfig = {};
      for (let i = 0; i < 1000; i++) {
        largeConfig[`key${i}`] = {
          value: `value${i}`,
          nested: {
            data: `nested data ${i}`,
            array: Array.from({ length: 10 }, (_, j) => `item${j}`)
          }
        };
      }
      
      const start = Date.now();
      
      await configManager.saveConfig(largeConfig);
      const loadedConfig = await configManager.loadConfig();
      
      const duration = Date.now() - start;
      
      expect(loadedConfig).toEqual(expect.objectContaining(largeConfig));
      
      // Should handle large configs efficiently
      expect(duration).toBeLessThan(5000);
    }, PERFORMANCE_TIMEOUT);

    test('should handle multiple concurrent config operations', async () => {
      const start = Date.now();
      
      // Run concurrent config operations
      const promises = Array.from({ length: 20 }, (_, i) => 
        configManager.set(`test.key${i}`, `value${i}`)
      );
      
      const results = await Promise.all(promises);
      
      const duration = Date.now() - start;
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Should handle concurrent operations efficiently
      expect(duration).toBeLessThan(3000);
    }, PERFORMANCE_TIMEOUT);

    test('should encrypt/decrypt large amounts of data efficiently', async () => {
      const largeData = 'x'.repeat(10000); // 10KB of data
      
      const start = Date.now();
      
      // Encrypt and decrypt multiple times
      for (let i = 0; i < 10; i++) {
        const encrypted = await configManager.encryptValue(largeData);
        const decrypted = await configManager.decryptValue(encrypted);
        expect(decrypted).toBe(largeData);
      }
      
      const duration = Date.now() - start;
      
      // Should handle encryption/decryption efficiently
      expect(duration).toBeLessThan(5000);
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Security Utils Performance', () => {
    test('should validate large numbers of inputs efficiently', () => {
      const start = Date.now();
      
      // Validate 1000 different inputs
      for (let i = 0; i < 1000; i++) {
        SecurityUtils.sanitizeForDisplay(`Test input ${i} with <script>alert('xss')</script>`);
        SecurityUtils.isValidEmail(`user${i}@domain${i}.com`);
        SecurityUtils.isValidGitHubToken(`ghp_${'a'.repeat(36)}`);
      }
      
      const duration = Date.now() - start;
      
      // Should validate inputs efficiently
      expect(duration).toBeLessThan(2000);
    });

    test('should handle large file path validations efficiently', () => {
      const start = Date.now();
      
      // Test with many file paths
      const basePath = '/safe/directory';
      for (let i = 0; i < 1000; i++) {
        try {
          SecurityUtils.validateFilePath(`subdir${i}/file${i}.txt`, basePath);
        } catch (error) {
          // Some may fail validation, that's expected
        }
      }
      
      const duration = Date.now() - start;
      
      // Should validate paths efficiently
      expect(duration).toBeLessThan(3000);
    });

    test('should sanitize large strings efficiently', () => {
      const largeString = '<script>alert("xss")</script>'.repeat(1000);
      
      const start = Date.now();
      
      const sanitized = SecurityUtils.sanitizeForDisplay(largeString);
      
      const duration = Date.now() - start;
      
      expect(sanitized).not.toContain('<script>');
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Validation Utils Performance', () => {
    test('should validate large numbers of commit messages efficiently', () => {
      const start = Date.now();
      
      // Validate 1000 commit messages
      for (let i = 0; i < 1000; i++) {
        ValidationUtils.validateCommitMessage(`Commit message ${i} with some content`);
      }
      
      const duration = Date.now() - start;
      
      // Should validate efficiently
      expect(duration).toBeLessThan(2000);
    });

    test('should validate large configuration structures efficiently', () => {
      // Create large configuration structure
      const largeConfig = {};
      for (let i = 0; i < 100; i++) {
        largeConfig[`section${i}`] = {};
        for (let j = 0; j < 10; j++) {
          largeConfig[`section${i}`][`key${j}`] = `value${j}`;
        }
      }
      
      const schema = {};
      for (let i = 0; i < 100; i++) {
        schema[`section${i}`] = {
          type: 'object',
          properties: {}
        };
        for (let j = 0; j < 10; j++) {
          schema[`section${i}`].properties[`key${j}`] = { type: 'string' };
        }
      }
      
      const start = Date.now();
      
      const result = ValidationUtils.validateConfigStructure(largeConfig, schema);
      
      const duration = Date.now() - start;
      
      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(3000);
    });

    test('should handle large arrays of arguments efficiently', () => {
      const largeArgs = Array.from({ length: 1000 }, (_, i) => `arg${i}`);
      
      const start = Date.now();
      
      const result = ValidationUtils.validateCommandArgs(largeArgs);
      
      const duration = Date.now() - start;
      
      expect(result.valid).toBe(true);
      expect(result.args).toHaveLength(1000);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Progress Indicators Performance', () => {
    test('should handle rapid progress updates efficiently', async () => {
      const progress = new ProgressIndicator({ type: 'progress', total: 1000 });
      
      const start = Date.now();
      
      progress.start('Performance test');
      
      // Rapid updates
      for (let i = 0; i <= 1000; i += 10) {
        progress.update(i, `Processing ${i}/1000`);
      }
      
      progress.succeed('Performance test completed');
      
      const duration = Date.now() - start;
      
      // Should handle rapid updates efficiently
      expect(duration).toBeLessThan(2000);
    });

    test('should handle large multi-step progress efficiently', () => {
      const steps = Array.from({ length: 100 }, (_, i) => ({
        name: `Step ${i + 1}`,
        description: `Description for step ${i + 1}`
      }));
      
      const start = Date.now();
      
      const multiStep = new MultiStepProgress(steps);
      multiStep.start();
      
      // Process all steps
      for (let i = 0; i < steps.length; i++) {
        multiStep.startStep(i);
        multiStep.updateStepProgress(i, 50);
        multiStep.completeStep(i);
      }
      
      const duration = Date.now() - start;
      
      expect(multiStep.isAllCompleted()).toBe(true);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Memory Usage Tests', () => {
    test('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations that could potentially leak memory
      for (let i = 0; i < 100; i++) {
        // Create and destroy objects
        const config = new ConfigManager();
        const progress = new ProgressIndicator();
        
        // Perform operations
        SecurityUtils.sanitizeForDisplay(`Test ${i}`);
        ValidationUtils.validateCommitMessage(`Commit ${i}`);
        
        // Force garbage collection if available
        if (global.gc && i % 10 === 0) {
          global.gc();
        }
      }
      
      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncreasePercent).toBeLessThan(100);
    });

    test('should handle large data structures without excessive memory usage', () => {
      const initialMemory = process.memoryUsage();
      
      // Create large data structures
      const largeArray = new Array(10000).fill(null).map((_, i) => ({
        id: i,
        data: `Data item ${i}`,
        nested: {
          value: i * 2,
          text: `Nested text ${i}`
        }
      }));
      
      // Process the large array
      const processed = largeArray.map(item => ({
        ...item,
        processed: true,
        timestamp: Date.now()
      }));
      
      const afterProcessing = process.memoryUsage();
      
      // Clean up
      largeArray.length = 0;
      processed.length = 0;
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory should be reasonable for the amount of data processed
      const peakIncrease = afterProcessing.heapUsed - initialMemory.heapUsed;
      const finalIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Peak memory usage should be reasonable
      expect(peakIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      
      // Memory should be mostly cleaned up after processing
      expect(finalIncrease).toBeLessThan(peakIncrease * 0.5);
    });
  });

  describe('Concurrent Operations Performance', () => {
    test('should handle concurrent security validations efficiently', async () => {
      const start = Date.now();
      
      // Run many concurrent security validations
      const promises = Array.from({ length: 100 }, (_, i) => 
        Promise.resolve().then(() => {
          SecurityUtils.sanitizeForDisplay(`Input ${i}`);
          SecurityUtils.isValidEmail(`user${i}@domain.com`);
          return ValidationUtils.validateCommitMessage(`Commit ${i}`);
        })
      );
      
      const results = await Promise.all(promises);
      
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toHaveProperty('valid');
      });
      
      // Should handle concurrent operations efficiently
      expect(duration).toBeLessThan(3000);
    });

    test('should handle concurrent configuration operations efficiently', async () => {
      const configManager = new ConfigManager();
      const start = Date.now();
      
      // Run concurrent configuration operations
      const promises = Array.from({ length: 50 }, (_, i) => 
        Promise.resolve().then(async () => {
          configManager.setSync(`test${i}.key`, `value${i}`);
          return configManager.getSync(`test${i}.key`);
        })
      );
      
      const results = await Promise.all(promises);
      
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(50);
      results.forEach((result, i) => {
        expect(result).toBe(`value${i}`);
      });
      
      // Should handle concurrent config operations efficiently
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Scalability Tests', () => {
    test('should scale linearly with input size', () => {
      const inputSizes = [100, 500, 1000, 2000];
      const timings = [];
      
      inputSizes.forEach(size => {
        const start = Date.now();
        
        // Perform operations that scale with input size
        for (let i = 0; i < size; i++) {
          SecurityUtils.sanitizeForDisplay(`Test input ${i}`);
        }
        
        const duration = Date.now() - start;
        timings.push({ size, duration });
      });
      
      // Check that timing scales roughly linearly
      // (allowing for some variance due to system factors)
      const firstTiming = timings[0];
      const lastTiming = timings[timings.length - 1];
      
      const expectedRatio = lastTiming.size / firstTiming.size;
      const actualRatio = lastTiming.duration / firstTiming.duration;
      
      // Actual ratio should be within reasonable bounds of expected ratio
      expect(actualRatio).toBeLessThan(expectedRatio * 3);
      expect(actualRatio).toBeGreaterThan(expectedRatio * 0.5);
    });
  });
});