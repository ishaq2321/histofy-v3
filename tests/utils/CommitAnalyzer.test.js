/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * CommitAnalyzer Tests
 */

const CommitAnalyzer = require('../../src/utils/CommitAnalyzer');
const moment = require('moment');

// Mock dependencies
jest.mock('../../src/core/GitManager');
jest.mock('../../src/utils/progress');

const GitManager = require('../../src/core/GitManager');
const { ProgressUtils } = require('../../src/utils/progress');

describe('CommitAnalyzer', () => {
  let analyzer;
  let mockGitManager;
  let mockProgress;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup progress mock
    mockProgress = {
      start: jest.fn(),
      update: jest.fn(),
      succeed: jest.fn(),
      fail: jest.fn()
    };
    ProgressUtils.spinner = jest.fn().mockReturnValue(mockProgress);

    // Setup GitManager mock
    mockGitManager = {
      getCommitHistory: jest.fn()
    };
    GitManager.mockImplementation(() => mockGitManager);

    analyzer = new CommitAnalyzer();
  });

  describe('overview statistics', () => {
    test('should calculate basic overview stats', () => {
      const commits = [
        { author: 'John Doe', date: '2023-06-15T10:00:00Z', message: 'First commit' },
        { author: 'Jane Smith', date: '2023-06-16T11:00:00Z', message: 'Second commit' },
        { author: 'John Doe', date: '2023-06-17T12:00:00Z', message: 'Third commit' }
      ];

      const stats = analyzer.calculateOverviewStats(commits);

      expect(stats.totalCommits).toBe(3);
      expect(stats.uniqueAuthors).toBe(2);
      expect(stats.repositoryAge).toBe(2); // 2 days
      expect(stats.averageCommitsPerDay).toBe(1.5);
      expect(stats.dateRange).toEqual({
        first: '2023-06-15T10:00:00.000Z',
        last: '2023-06-17T12:00:00.000Z',
        span: 2
      });
    });

    test('should handle empty commit array', () => {
      const stats = analyzer.calculateOverviewStats([]);

      expect(stats.totalCommits).toBe(0);
      expect(stats.uniqueAuthors).toBe(0);
      expect(stats.dateRange).toBeNull();
      expect(stats.averageCommitsPerDay).toBe(0);
      expect(stats.repositoryAge).toBe(0);
    });

    test('should handle single commit', () => {
      const commits = [
        { author: 'John Doe', date: '2023-06-15T10:00:00Z', message: 'Single commit' }
      ];

      const stats = analyzer.calculateOverviewStats(commits);

      expect(stats.totalCommits).toBe(1);
      expect(stats.uniqueAuthors).toBe(1);
      expect(stats.repositoryAge).toBe(1); // Minimum 1 day
      expect(stats.averageCommitsPerDay).toBe(1);
    });
  });

  describe('temporal statistics', () => {
    test('should calculate temporal patterns', () => {
      const commits = [
        { author: 'John', date: '2023-06-15T09:00:00Z', message: 'Morning commit' },
        { author: 'John', date: '2023-06-15T14:00:00Z', message: 'Afternoon commit' },
        { author: 'Jane', date: '2023-06-16T09:00:00Z', message: 'Another morning' },
        { author: 'Jane', date: '2023-06-17T20:00:00Z', message: 'Evening commit' }
      ];

      const stats = analyzer.calculateTemporalStats(commits);

      expect(stats.byHour[9]).toBe(2); // 9 AM has 2 commits
      expect(stats.byHour[14]).toBe(1); // 2 PM has 1 commit
      expect(stats.byHour[20]).toBe(1); // 8 PM has 1 commit
      expect(stats.peakHour).toBe('9');

      // Check day of week (Thursday=4, Friday=5, Saturday=6)
      expect(stats.byDayOfWeek[4]).toBe(2); // Thursday
      expect(stats.byDayOfWeek[5]).toBe(1); // Friday
      expect(stats.byDayOfWeek[6]).toBe(1); // Saturday

      expect(stats.patterns).toBeInstanceOf(Array);
    });

    test('should handle empty commits for temporal stats', () => {
      const stats = analyzer.calculateTemporalStats([]);

      expect(stats.byHour).toEqual({});
      expect(stats.byDayOfWeek).toEqual({});
      expect(stats.byMonth).toEqual({});
      expect(stats.byYear).toEqual({});
      expect(stats.patterns).toEqual([]);
    });

    test('should identify weekend worker pattern', () => {
      const commits = [
        // Weekend commits (Saturday and Sunday)
        { author: 'John', date: '2023-06-17T10:00:00Z', message: 'Saturday work' },
        { author: 'John', date: '2023-06-18T10:00:00Z', message: 'Sunday work' },
        // Weekday commit
        { author: 'John', date: '2023-06-19T10:00:00Z', message: 'Monday work' }
      ];

      const stats = analyzer.calculateTemporalStats(commits);
      const weekendPattern = stats.patterns.find(p => p.type === 'weekend_worker');
      
      expect(weekendPattern).toBeDefined();
      expect(weekendPattern.value).toBeGreaterThan(50); // More than 50% weekend activity
    });
  });

  describe('author statistics', () => {
    test('should calculate author contributions', () => {
      const commits = [
        { author: 'John Doe', date: '2023-06-15T10:00:00Z', message: 'First' },
        { author: 'John Doe', date: '2023-06-16T10:00:00Z', message: 'Second' },
        { author: 'Jane Smith', date: '2023-06-17T10:00:00Z', message: 'Third' },
        { author: 'John Doe', date: '2023-06-18T10:00:00Z', message: 'Fourth' }
      ];

      const stats = analyzer.calculateAuthorStats(commits);

      expect(stats.byAuthor['John Doe']).toBe(3);
      expect(stats.byAuthor['Jane Smith']).toBe(1);
      expect(stats.totalAuthors).toBe(2);

      expect(stats.topAuthors).toHaveLength(2);
      expect(stats.topAuthors[0]).toEqual({
        author: 'John Doe',
        commits: 3,
        percentage: 75,
        firstCommit: '2023-06-15T10:00:00.000Z',
        lastCommit: '2023-06-18T10:00:00.000Z',
        activeDays: 3
      });

      expect(stats.collaboration.diversity).toBe(2);
      expect(stats.collaboration.concentration).toBe(0.75); // John has 75% of commits
    });

    test('should handle empty commits for author stats', () => {
      const stats = analyzer.calculateAuthorStats([]);

      expect(stats.byAuthor).toEqual({});
      expect(stats.topAuthors).toEqual([]);
      expect(stats.authorActivity).toEqual({});
      expect(stats.collaboration).toEqual({});
    });

    test('should calculate active days correctly', () => {
      const commits = [
        { author: 'John', date: '2023-06-15T09:00:00Z', message: 'Commit 1' },
        { author: 'John', date: '2023-06-15T14:00:00Z', message: 'Commit 2' }, // Same day
        { author: 'John', date: '2023-06-16T10:00:00Z', message: 'Commit 3' }  // Different day
      ];

      const activeDays = analyzer.calculateActiveDays(commits);
      expect(activeDays).toBe(2); // 2 unique days
    });
  });

  describe('message statistics', () => {
    test('should analyze commit message patterns', () => {
      const commits = [
        { message: 'feat: add new feature' },
        { message: 'fix: resolve bug in parser' },
        { message: 'docs: update README' },
        { message: 'Add user authentication' },
        { message: 'wip' }, // Vague message
        { message: 'This is a very long commit message that exceeds the recommended 72 character limit for the first line' }
      ];

      const stats = analyzer.calculateMessageStats(commits);

      expect(stats.patterns.conventional).toBe(3); // feat, fix, docs
      expect(stats.patterns.featurePattern).toBe(2); // feat + Add
      expect(stats.patterns.fixPattern).toBe(1); // fix
      expect(stats.patterns.vague).toBe(1); // wip

      expect(stats.lengthDistribution.short).toBe(1); // wip
      expect(stats.lengthDistribution.medium).toBe(4); // Most messages
      expect(stats.lengthDistribution.long).toBe(1); // Very long message

      expect(stats.conventions.conventionalCommits).toBe(50); // 3/6 = 50%
      expect(stats.conventions.recommendedLength).toBe('good'); // Average <= 72
    });

    test('should handle empty commits for message stats', () => {
      const stats = analyzer.calculateMessageStats([]);

      expect(stats.averageLength).toBe(0);
      expect(stats.lengthDistribution).toEqual({});
      expect(stats.commonWords).toEqual([]);
      expect(stats.patterns).toEqual([]);
      expect(stats.conventions).toEqual({});
    });

    test('should calculate word frequency', () => {
      const commits = [
        { message: 'fix bug in authentication system' },
        { message: 'fix memory leak in parser' },
        { message: 'add authentication tests' },
        { message: 'update authentication documentation' }
      ];

      const stats = analyzer.calculateMessageStats(commits);
      
      const authWord = stats.commonWords.find(w => w.word === 'authentication');
      expect(authWord).toBeDefined();
      expect(authWord.count).toBe(3);

      const fixWord = stats.commonWords.find(w => w.word === 'fix');
      expect(fixWord).toBeDefined();
      expect(fixWord.count).toBe(2);
    });
  });

  describe('pattern statistics', () => {
    test('should identify bursty periods', () => {
      const commits = [
        // Normal day
        { date: '2023-06-15T10:00:00Z', message: 'Normal commit' },
        // Bursty day with many commits
        { date: '2023-06-16T09:00:00Z', message: 'Burst 1' },
        { date: '2023-06-16T10:00:00Z', message: 'Burst 2' },
        { date: '2023-06-16T11:00:00Z', message: 'Burst 3' },
        { date: '2023-06-16T12:00:00Z', message: 'Burst 4' },
        { date: '2023-06-16T13:00:00Z', message: 'Burst 5' },
        // Another normal day
        { date: '2023-06-17T10:00:00Z', message: 'Normal commit 2' }
      ];

      const stats = analyzer.calculatePatternStats(commits);

      expect(stats.burstyPeriods).toHaveLength(1);
      expect(stats.burstyPeriods[0].date).toBe('2023-06-16');
      expect(stats.burstyPeriods[0].commits).toBe(5);
      expect(stats.burstyPeriods[0].factor).toBeGreaterThan(2);

      expect(stats.averageDaily).toBeCloseTo(2.33, 1); // 7 commits / 3 days
    });

    test('should handle empty commits for pattern stats', () => {
      const stats = analyzer.calculatePatternStats([]);

      expect(stats.commitFrequency).toEqual({});
      expect(stats.burstyPeriods).toEqual([]);
      expect(stats.quietPeriods).toEqual([]);
      expect(stats.workingPatterns).toEqual({});
    });

    test('should analyze working patterns', () => {
      const commits = [
        { date: '2023-06-15T09:00:00Z', message: 'Morning work' },
        { date: '2023-06-15T09:30:00Z', message: 'More morning work' },
        { date: '2023-06-15T14:00:00Z', message: 'Afternoon work' },
        { date: '2023-06-16T09:00:00Z', message: 'Another morning' }
      ];

      const patterns = analyzer.analyzeWorkingPatterns(commits);

      expect(patterns.preferredHours).toHaveLength(2);
      expect(patterns.preferredHours[0].hour).toBe(9); // Most active hour
      expect(patterns.preferredHours[0].count).toBe(3);

      expect(patterns.workingDays).toHaveLength(2);
    });
  });

  describe('health statistics', () => {
    test('should calculate repository health score', () => {
      const commits = [
        { 
          author: 'John', 
          date: moment().subtract(1, 'day').toISOString(), 
          message: 'feat: add new feature with proper description' 
        },
        { 
          author: 'Jane', 
          date: moment().subtract(2, 'days').toISOString(), 
          message: 'fix: resolve critical bug in authentication' 
        },
        { 
          author: 'John', 
          date: moment().subtract(3, 'days').toISOString(), 
          message: 'docs: update API documentation' 
        }
      ];

      const stats = analyzer.calculateHealthStats(commits);

      expect(stats.score).toBeGreaterThan(0);
      expect(stats.score).toBeLessThanOrEqual(100);
      expect(stats.grade).toMatch(/[A-F]/);

      expect(stats.factors).toHaveProperty('frequency');
      expect(stats.factors).toHaveProperty('messageQuality');
      expect(stats.factors).toHaveProperty('authorDiversity');
      expect(stats.factors).toHaveProperty('consistency');
      expect(stats.factors).toHaveProperty('recency');

      expect(stats.recommendations).toBeInstanceOf(Array);
    });

    test('should handle empty commits for health stats', () => {
      const stats = analyzer.calculateHealthStats([]);

      expect(stats.score).toBe(0);
      expect(stats.factors).toEqual({});
      expect(stats.recommendations).toEqual([]);
    });

    test('should calculate individual health factors', () => {
      const recentCommits = [
        { 
          author: 'John', 
          date: moment().subtract(1, 'day').toISOString(), 
          message: 'Recent commit' 
        }
      ];

      const oldCommits = [
        { 
          author: 'John', 
          date: moment().subtract(100, 'days').toISOString(), 
          message: 'Old commit' 
        }
      ];

      const recentFrequency = analyzer.calculateFrequencyHealth(recentCommits);
      const oldFrequency = analyzer.calculateFrequencyHealth(oldCommits);

      expect(recentFrequency).toBeGreaterThan(oldFrequency);
      expect(recentFrequency).toBe(100); // Recent commit gets max score
      expect(oldFrequency).toBe(20); // Old commit gets low score
    });

    test('should generate appropriate recommendations', () => {
      const factors = {
        frequency: 50,
        messageQuality: 40,
        authorDiversity: 80,
        consistency: 30,
        recency: 60
      };

      const recommendations = analyzer.generateHealthRecommendations(factors, 50);

      expect(recommendations).toContain('Increase commit frequency for better project momentum');
      expect(recommendations).toContain('Improve commit message quality and follow conventional commit format');
      expect(recommendations).toContain('Maintain more consistent commit message formatting');
      expect(recommendations).toContain('Consider establishing commit guidelines for the team');
    });
  });

  describe('trend statistics', () => {
    test('should calculate commit trends', () => {
      const commits = [
        { date: '2023-04-15T10:00:00Z', message: 'Old commit' },
        { date: '2023-05-15T10:00:00Z', message: 'Month 1' },
        { date: '2023-05-16T10:00:00Z', message: 'Month 1 again' },
        { date: '2023-06-15T10:00:00Z', message: 'Month 2' },
        { date: '2023-06-16T10:00:00Z', message: 'Month 2 again' },
        { date: '2023-06-17T10:00:00Z', message: 'Month 2 more' }
      ];

      const stats = analyzer.calculateTrendStats(commits);

      expect(stats.activity).toMatch(/stable|growing|declining|accelerating|slowing/);
      expect(stats.velocity).toBeGreaterThan(-100);
      expect(stats.velocity).toBeLessThan(1000);
      expect(stats.momentum).toMatch(/increasing|decreasing|stable|neutral/);
      expect(stats.monthlyData).toHaveProperty('2023-04');
      expect(stats.monthlyData).toHaveProperty('2023-05');
      expect(stats.monthlyData).toHaveProperty('2023-06');
      expect(stats.predictions).toHaveProperty('nextMonth');
    });

    test('should handle insufficient data for trends', () => {
      const commits = [
        { date: '2023-06-15T10:00:00Z', message: 'Single commit' }
      ];

      const stats = analyzer.calculateTrendStats(commits);

      expect(stats.activity).toBe('stable');
      expect(stats.velocity).toBe(0);
      expect(stats.momentum).toBe('neutral');
    });

    test('should classify activity correctly', () => {
      expect(analyzer.classifyActivity(25, 'increasing')).toBe('accelerating');
      expect(analyzer.classifyActivity(10, 'increasing')).toBe('growing');
      expect(analyzer.classifyActivity(-25, 'decreasing')).toBe('declining');
      expect(analyzer.classifyActivity(-10, 'decreasing')).toBe('slowing');
      expect(analyzer.classifyActivity(5, 'stable')).toBe('stable');
    });
  });

  describe('heatmap generation', () => {
    test('should generate activity heatmap', async () => {
      const commits = [
        { date: '2023-06-15T10:00:00Z', message: 'Day 1 - 1 commit' },
        { date: '2023-06-16T10:00:00Z', message: 'Day 2 - 1 commit' },
        { date: '2023-06-16T14:00:00Z', message: 'Day 2 - 2 commits' },
        { date: '2023-06-16T16:00:00Z', message: 'Day 2 - 3 commits' }
      ];

      mockGitManager.getCommitHistory.mockResolvedValue(commits);

      const heatmap = await analyzer.generateHeatmap({
        since: new Date('2023-06-15'),
        until: new Date('2023-06-17')
      });

      expect(heatmap.data).toHaveProperty('2023-06-15');
      expect(heatmap.data).toHaveProperty('2023-06-16');
      expect(heatmap.data).toHaveProperty('2023-06-17');

      expect(heatmap.data['2023-06-15'].count).toBe(1);
      expect(heatmap.data['2023-06-16'].count).toBe(3);
      expect(heatmap.data['2023-06-17'].count).toBe(0);

      expect(heatmap.data['2023-06-15'].intensity).toBe(1);
      expect(heatmap.data['2023-06-16'].intensity).toBe(4); // Max intensity
      expect(heatmap.data['2023-06-17'].intensity).toBe(0);

      expect(heatmap.summary.totalDays).toBe(3);
      expect(heatmap.summary.activeDays).toBe(2);
      expect(heatmap.summary.totalCommits).toBe(4);
      expect(heatmap.summary.maxCommitsPerDay).toBe(3);
    });
  });

  describe('commit pattern analysis', () => {
    test('should analyze commit message patterns', () => {
      const commits = [
        { message: 'feat(auth): add user authentication' },
        { message: 'fix: resolve memory leak' },
        { message: 'Add new feature' },
        { message: 'wip' },
        { message: 'This is a very long commit message that definitely exceeds the seventy-two character limit' },
        { message: 'fix bug.' }, // Ends with period
        { message: 'lowercase start' } // Not capitalized
      ];

      const analysis = analyzer.analyzeCommitPatterns(commits);

      expect(analysis.patterns.conventional).toBe(2); // feat and fix
      expect(analysis.patterns.imperative).toBe(1); // Add
      expect(analysis.patterns.vague).toBe(1); // wip

      expect(analysis.issues).toHaveLength(3); // long, period, lowercase
      expect(analysis.issues.some(issue => issue.type === 'too_long')).toBe(true);
      expect(analysis.issues.some(issue => issue.type === 'ends_with_period')).toBe(true);
      expect(analysis.issues.some(issue => issue.type === 'not_capitalized')).toBe(true);

      expect(analysis.examples.good).toHaveLength(3); // feat, fix, Add
      expect(analysis.examples.bad).toHaveLength(1); // wip

      expect(analysis.suggestions).toBeInstanceOf(Array);
    });

    test('should generate appropriate suggestions', () => {
      const analysis = {
        patterns: {
          conventional: 1,
          imperative: 0,
          descriptive: 0,
          vague: 3
        },
        issues: [
          { type: 'too_long' },
          { type: 'too_long' }
        ]
      };

      const suggestions = analyzer.generateCommitSuggestions(analysis, 4);

      expect(suggestions.some(s => s.type === 'convention')).toBe(true); // < 50% conventional
      expect(suggestions.some(s => s.type === 'clarity')).toBe(true); // > 20% vague
      expect(suggestions.some(s => s.type === 'formatting')).toBe(true); // > 30% issues
    });
  });

  describe('comprehensive analysis', () => {
    test('should run comprehensive analysis', async () => {
      const commits = [
        { 
          author: 'John Doe', 
          date: '2023-06-15T10:00:00Z', 
          message: 'feat: add user authentication system' 
        },
        { 
          author: 'Jane Smith', 
          date: '2023-06-16T14:00:00Z', 
          message: 'fix: resolve memory leak in parser' 
        },
        { 
          author: 'John Doe', 
          date: '2023-06-17T09:00:00Z', 
          message: 'docs: update API documentation' 
        }
      ];

      mockGitManager.getCommitHistory.mockResolvedValue(commits);

      const stats = await analyzer.getComprehensiveStats({
        since: '2023-06-15',
        until: '2023-06-17',
        maxCommits: 1000
      });

      expect(stats).toHaveProperty('overview');
      expect(stats).toHaveProperty('temporal');
      expect(stats).toHaveProperty('authors');
      expect(stats).toHaveProperty('messages');
      expect(stats).toHaveProperty('patterns');
      expect(stats).toHaveProperty('health');
      expect(stats).toHaveProperty('trends');

      expect(mockProgress.start).toHaveBeenCalled();
      expect(mockProgress.succeed).toHaveBeenCalled();
    });

    test('should handle analysis errors', async () => {
      mockGitManager.getCommitHistory.mockRejectedValue(new Error('Git error'));

      await expect(analyzer.getComprehensiveStats()).rejects.toThrow('Git error');
      expect(mockProgress.fail).toHaveBeenCalled();
    });

    test('should use cache for repeated requests', async () => {
      const commits = [
        { author: 'John', date: '2023-06-15T10:00:00Z', message: 'Test commit' }
      ];

      mockGitManager.getCommitHistory.mockResolvedValue(commits);

      const options = { since: '2023-06-15', maxCommits: 100 };
      
      // First call
      const result1 = await analyzer.getComprehensiveStats(options);
      
      // Second call should use cache
      const result2 = await analyzer.getComprehensiveStats(options);

      expect(result1).toEqual(result2);
      expect(mockGitManager.getCommitHistory).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('helper methods', () => {
    test('should calculate message consistency', () => {
      const consistentCommits = [
        { message: 'Short message' },
        { message: 'Another short' },
        { message: 'Third short' }
      ];

      const inconsistentCommits = [
        { message: 'Short' },
        { message: 'This is a much longer commit message with more details' },
        { message: 'Medium length message here' }
      ];

      const consistentScore = analyzer.calculateMessageConsistency(consistentCommits);
      const inconsistentScore = analyzer.calculateMessageConsistency(inconsistentCommits);

      expect(consistentScore).toBeGreaterThan(inconsistentScore);
      expect(consistentScore).toBeGreaterThan(80);
      expect(inconsistentScore).toBeLessThan(80);
    });

    test('should generate week range correctly', () => {
      const commits = [
        { date: '2023-06-15T10:00:00Z' }, // Thursday
        { date: '2023-06-25T10:00:00Z' }  // Sunday (next week)
      ];

      const weeks = analyzer.generateWeekRange(commits);
      
      expect(weeks).toContain('2023-W24'); // Week containing June 15
      expect(weeks).toContain('2023-W25'); // Week containing June 25
      expect(weeks.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle empty commits in helper methods', () => {
      expect(analyzer.generateWeekRange([])).toEqual([]);
      expect(analyzer.calculateActiveDays([])).toBe(0);
    });
  });
});