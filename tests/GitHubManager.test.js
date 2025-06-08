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

  describe('parseRepoFromUrl', () => {
    test('should parse GitHub HTTPS URL correctly', () => {
      const manager = new GitHubManager();
      const result = manager.parseRepoFromUrl('https://github.com/user/repo.git');
      expect(result).toEqual({ 
        owner: 'user', 
        repo: 'repo',
        fullName: 'user/repo'
      });
    });

    test('should parse GitHub SSH URL correctly', () => {
      const manager = new GitHubManager();
      const result = manager.parseRepoFromUrl('git@github.com:user/repo.git');
      expect(result).toEqual({ 
        owner: 'user', 
        repo: 'repo',
        fullName: 'user/repo'
      });
    });

    test('should handle invalid URLs', () => {
      const manager = new GitHubManager();
      const result = manager.parseRepoFromUrl('invalid-url');
      expect(result).toBeNull();
    });
  });
});
