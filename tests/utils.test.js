const { DateUtils, StringUtils, ValidationUtils } = require('../src/utils');

describe('Utils', () => {
  describe('DateUtils', () => {
    test('should validate valid dates', () => {
      expect(DateUtils.isValidDate('2024-01-01')).toBe(true);
      expect(DateUtils.isValidDate('2024-12-31')).toBe(true);
    });

    test('should reject invalid dates', () => {
      expect(DateUtils.isValidDate('invalid-date')).toBe(false);
      expect(DateUtils.isValidDate('2024-13-01')).toBe(false);
      expect(DateUtils.isValidDate('2024-01-32')).toBe(false);
    });

    test('should validate time strings', () => {
      expect(DateUtils.isValidTime('12:30')).toBe(true);
      expect(DateUtils.isValidTime('00:00')).toBe(true);
      expect(DateUtils.isValidTime('23:59')).toBe(true);
    });

    test('should reject invalid time strings', () => {
      expect(DateUtils.isValidTime('25:00')).toBe(false);
      expect(DateUtils.isValidTime('12:60')).toBe(false);
      expect(DateUtils.isValidTime('invalid')).toBe(false);
    });

    test('should format dates correctly', () => {
      const date = new Date('2024-01-01');
      expect(DateUtils.formatDate(date)).toBe('2024-01-01');
    });
  });

  describe('StringUtils', () => {
    test('should capitalize strings', () => {
      expect(StringUtils.capitalize('hello')).toBe('Hello');
      expect(StringUtils.capitalize('HELLO')).toBe('Hello');
    });

    test('should create slugs', () => {
      expect(StringUtils.slugify('Hello World')).toBe('hello-world');
      expect(StringUtils.slugify('Test@#$%String')).toBe('test-string');
    });

    test('should truncate strings', () => {
      expect(StringUtils.truncate('Long string', 5)).toBe('Long...');
      expect(StringUtils.truncate('Short', 10)).toBe('Short');
    });
  });

  describe('ValidationUtils', () => {
    test('should validate email addresses', () => {
      expect(ValidationUtils.isValidEmail('test@example.com')).toBe(true);
      expect(ValidationUtils.isValidEmail('invalid-email')).toBe(false);
    });

    test('should validate GitHub usernames', () => {
      expect(ValidationUtils.isValidGitHubUsername('validuser')).toBe(true);
      expect(ValidationUtils.isValidGitHubUsername('valid-user')).toBe(true);
      expect(ValidationUtils.isValidGitHubUsername('invalid@user')).toBe(false);
    });

    test('should validate repository names', () => {
      expect(ValidationUtils.isValidRepoName('my-repo')).toBe(true);
      expect(ValidationUtils.isValidRepoName('MyRepo123')).toBe(true);
      expect(ValidationUtils.isValidRepoName('invalid repo')).toBe(false);
    });
  });
});
