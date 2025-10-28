/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const GitHubManager = require('../src/core/GitHubManager');

describe('GitHubManager', () => {
  let githubManager;

  beforeAll(() => {
    githubManager = new GitHubManager();
  });

  describe('constructor', () => {
    test('should create instance without token', () => {
      const manager = new GitHubManager();
      expect(manager).toBeInstanceOf(GitHubManager);
      expect(manager.baseURL).toBe('https://api.github.com');
    });

    test('should create instance with token', () => {
      const manager = new GitHubManager('test-token');
      expect(manager.token).toBe('test-token');
    });
  });

  describe('testConnection', () => {
    test('should handle missing token gracefully', async () => {
      const manager = new GitHubManager();
      const result = await manager.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
