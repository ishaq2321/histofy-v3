/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Analyze CLI Command Tests
 */

const { Command } = require('commander');
const analyzeCommand = require('../../src/cli/analyze');
const CommitAnalyzer = require('../../src/utils/CommitAnalyzer');
const { FeedbackUtils } = require('../../src/utils/feedback');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/utils/CommitAnalyzer');
jest.mock('../../src/utils/feedback');

describe('Analyze CLI Command', () => {
  let testDir;
  let mockAnalyzer;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-analyze-cli-test-' + Date.now());
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

    // Setup CommitAnalyzer mock
    mockAnalyzer = {
      getComprehensiveStats: jest.fn(),
      generateHeatmap: jest.fn(),
      analyzeCommitPatterns: jest.fn(),
      gitManager: {
        getCommitHistory: jest.fn()
      }
    };
    CommitAnalyzer.mockImplementation(() => mockAnalyzer);

    // Setup FeedbackUtils mock
    FeedbackUtils.success = jest.fn();
    FeedbackUtils.error = jest.fn();
    FeedbackUtils.info = jest.fn();
    FeedbackUtils.warn = jest.fn();

    // Mock console.log to capture output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('main analyze command', () => {
    test('should run comprehensive analysis', async () => {
      const mockStats = {
        overview: {
          totalCommits: 100,
          uniqueAuthors: 5,
          repositoryAge: 365,
          averageCommitsPerDay: 0.27
        },
        temporal: {
          peakHour: '14',
          peakDay: '1',
          patterns: []
        },
        authors: {
          topAuthors: [
            { author: 'John Doe', commits: 50, percentage: 50, activeDays: 30 }
          ]
        },
        health: {
          score: 85,
          grade: 'B',
          factors: {
            frequency: 80,
            messageQuality: 90,
            consistency: 85
          },
          recommendations: []
        }
      };

      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      // Create a test program to simulate command execution
      const program = new Command();
      program.addCommand(analyzeCommand);

      // Mock process.argv to simulate command line input
      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', '--since', '2023-01-01'];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.getComprehensiveStats).toHaveBeenCalledWith(
          expect.objectContaining({
            since: '2023-01-01'
          })
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle analysis with output file', async () => {
      const mockStats = {
        overview: { totalCommits: 10 },
        temporal: { patterns: [] },
        authors: { topAuthors: [] },
        health: { score: 75 }
      };

      const outputFile = path.join(testDir, 'analysis.json');
      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', '--output', outputFile];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.getComprehensiveStats).toHaveBeenCalled();
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          expect.stringContaining(`Analysis saved to ${outputFile}`)
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('stats subcommand', () => {
    test('should generate statistics', async () => {
      const mockStats = {
        overview: {
          totalCommits: 50,
          uniqueAuthors: 3,
          repositoryAge: 180,
          averageCommitsPerDay: 0.28
        },
        temporal: {
          peakHour: '10',
          peakDay: '2',
          patterns: [
            { type: 'peak_hour', description: 'Most active at 10:00' }
          ]
        },
        authors: {
          topAuthors: [
            { author: 'Alice', commits: 25, percentage: 50, activeDays: 15 },
            { author: 'Bob', commits: 15, percentage: 30, activeDays: 10 }
          ]
        },
        health: {
          score: 78,
          grade: 'C',
          factors: {
            frequency: 75,
            messageQuality: 80,
            consistency: 70
          }
        }
      };

      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'stats', '--format', 'table'];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.getComprehensiveStats).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Repository Overview'));
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should save stats to file', async () => {
      const mockStats = {
        overview: { totalCommits: 25 },
        temporal: { patterns: [] },
        authors: { topAuthors: [] },
        health: { score: 80 }
      };

      const outputFile = path.join(testDir, 'stats.json');
      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'stats', '--output', outputFile];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          expect.stringContaining(`Statistics saved to ${outputFile}`)
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('heatmap subcommand', () => {
    test('should generate heatmap', async () => {
      const mockHeatmap = {
        data: {
          '2023-06-15': { count: 3, intensity: 2 },
          '2023-06-16': { count: 1, intensity: 1 }
        },
        summary: {
          totalDays: 365,
          activeDays: 120,
          totalCommits: 200,
          maxCommitsPerDay: 5,
          averageCommitsPerDay: 0.55
        }
      };

      mockAnalyzer.generateHeatmap.mockResolvedValue(mockHeatmap);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'heatmap', '--since', '2023-01-01'];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.generateHeatmap).toHaveBeenCalledWith(
          expect.objectContaining({
            since: expect.any(Date)
          })
        );
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Activity Heatmap Summary'));
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should save heatmap data to file', async () => {
      const mockHeatmap = {
        data: { '2023-06-15': { count: 2, intensity: 1 } },
        summary: { totalDays: 1, activeDays: 1, totalCommits: 2 }
      };

      const outputFile = path.join(testDir, 'heatmap.json');
      mockAnalyzer.generateHeatmap.mockResolvedValue(mockHeatmap);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'heatmap', '--output', outputFile];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          expect.stringContaining(`Heatmap data saved to ${outputFile}`)
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('patterns subcommand', () => {
    test('should analyze commit patterns', async () => {
      const mockCommits = [
        { message: 'feat: add new feature' },
        { message: 'fix: resolve bug' },
        { message: 'wip' }
      ];

      const mockPatterns = {
        patterns: {
          conventional: 2,
          imperative: 0,
          descriptive: 0,
          vague: 1
        },
        issues: [
          { index: 2, type: 'too_short', message: 'wip' }
        ],
        suggestions: [
          {
            type: 'clarity',
            priority: 'medium',
            message: 'Reduce vague commit messages',
            example: 'Instead of "wip", use "work in progress: implementing user auth"'
          }
        ],
        examples: {
          good: [
            { index: 0, message: 'feat: add new feature' },
            { index: 1, message: 'fix: resolve bug' }
          ],
          bad: [
            { index: 2, message: 'wip', issue: 'Too vague or short' }
          ]
        }
      };

      mockAnalyzer.gitManager.getCommitHistory.mockResolvedValue(mockCommits);
      mockAnalyzer.analyzeCommitPatterns.mockReturnValue(mockPatterns);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'patterns', '--suggestions'];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.analyzeCommitPatterns).toHaveBeenCalledWith(mockCommits);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Commit Message Patterns'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Suggestions for Improvement'));
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should save pattern analysis to file', async () => {
      const mockCommits = [{ message: 'test commit' }];
      const mockPatterns = {
        patterns: { conventional: 0, vague: 1 },
        issues: [],
        suggestions: []
      };

      const outputFile = path.join(testDir, 'patterns.json');
      mockAnalyzer.gitManager.getCommitHistory.mockResolvedValue(mockCommits);
      mockAnalyzer.analyzeCommitPatterns.mockReturnValue(mockPatterns);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'patterns', '--output', outputFile];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          expect.stringContaining(`Pattern analysis saved to ${outputFile}`)
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('health subcommand', () => {
    test('should generate health report', async () => {
      const mockStats = {
        health: {
          score: 82,
          grade: 'B',
          factors: {
            frequency: 85,
            messageQuality: 78,
            authorDiversity: 90,
            consistency: 75,
            recency: 80
          },
          recommendations: [
            'Improve commit message quality and follow conventional commit format',
            'Maintain more consistent commit message formatting'
          ]
        }
      };

      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'health', '--detailed'];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.getComprehensiveStats).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Repository Health Report'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('82/100'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Recommendations'));
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('trends subcommand', () => {
    test('should analyze trends', async () => {
      const mockStats = {
        trends: {
          activity: 'growing',
          velocity: 15.5,
          momentum: 'increasing',
          monthlyData: {
            '2023-04': 10,
            '2023-05': 12,
            '2023-06': 15
          },
          predictions: {
            nextMonth: 18,
            trend: 'increasing',
            confidence: 'high'
          }
        }
      };

      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', 'trends', '--predictions'];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.getComprehensiveStats).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Commit Trends Analysis'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Predictions'));
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('error handling', () => {
    test('should handle analysis errors', async () => {
      mockAnalyzer.getComprehensiveStats.mockRejectedValue(new Error('Git repository not found'));

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.error).toHaveBeenCalledWith(
          'Analysis failed',
          'Git repository not found'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle invalid date format', async () => {
      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', '--since', 'invalid-date'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.error).toHaveBeenCalledWith(
          'Analysis failed',
          expect.stringContaining('Invalid since date format')
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle file write errors', async () => {
      const mockStats = { overview: { totalCommits: 1 } };
      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      // Mock fs.writeFile to throw an error
      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Permission denied'));

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', '--output', '/invalid/path/output.json'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.error).toHaveBeenCalledWith(
          'Analysis failed',
          expect.stringContaining('Permission denied')
        );
      } finally {
        process.argv = originalArgv;
        fs.writeFile = originalWriteFile;
      }
    });
  });

  describe('validation', () => {
    test('should validate date range', async () => {
      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', '--since', '2023-06-15', '--until', '2023-06-10'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.error).toHaveBeenCalledWith(
          'Analysis failed',
          'Since date must be before until date'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should validate max commits parameter', async () => {
      const mockStats = { overview: { totalCommits: 5 } };
      mockAnalyzer.getComprehensiveStats.mockResolvedValue(mockStats);

      const program = new Command();
      program.addCommand(analyzeCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'analyze', '--max-commits', '5'];

      try {
        await program.parseAsync();
        
        expect(mockAnalyzer.getComprehensiveStats).toHaveBeenCalledWith(
          expect.objectContaining({
            maxCommits: 5
          })
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });
});