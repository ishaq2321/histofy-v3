/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const GitManager = require('../src/core/GitManager');
const path = require('path');
const fs = require('fs');

describe('GitManager', () => {
  let gitManager;
  let testRepoPath;

  beforeAll(() => {
    testRepoPath = path.join(__dirname, 'test-repo');
    gitManager = new GitManager(testRepoPath);
  });

  describe('isGitRepo', () => {
    test('should return false for non-git directory', async () => {
      const nonGitManager = new GitManager('/tmp');
      const result = await nonGitManager.isGitRepo();
      expect(result).toBe(false);
    });

    test('should handle errors gracefully', async () => {
      const invalidManager = new GitManager('/invalid/path');
      const result = await invalidManager.isGitRepo();
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    test('should handle non-git directory gracefully', async () => {
      const nonGitManager = new GitManager('/tmp');
      await expect(nonGitManager.getStatus()).rejects.toThrow();
    });
  });
});
