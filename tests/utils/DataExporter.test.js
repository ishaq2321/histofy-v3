/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * DataExporter Tests
 */

const DataExporter = require('../../src/utils/DataExporter');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/core/GitManager');
jest.mock('../../src/utils/OperationHistory');
jest.mock('../../src/utils/CommitAnalyzer');

const GitManager = require('../../src/core/GitManager');
const OperationHistory = require('../../src/utils/OperationHistory');
const CommitAnalyzer = require('../../src/utils/CommitAnalyzer');

describe('DataExporter', () => {
  let dataExporter;
  let testDir;
  let mockGitManager;
  let mockOperationHistory;
  let mockCommitAnalyzer;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-export-test-' + Date.now());
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

    // Setup GitManager mock
    mockGitManager = {
      getCommitHistory: jest.fn(),
      getRepoInfo: jest.fn().mockResolvedValue({
        remotes: [{ name: 'origin', url: 'https://github.com/test/repo.git' }],
        currentBranch: 'main',
        branches: ['main', 'develop']
      })
    };
    GitManager.mockImplementation(() => mockGitManager);

    // Setup OperationHistory mock
    mockOperationHistory = {
      getHistory: jest.fn()
    };
    OperationHistory.mockImplementation(() => mockOperationHistory);

    // Setup CommitAnalyzer mock
    mockCommitAnalyzer = {
      getComprehensiveStats: jest.fn(),
      generateHeatmap: jest.fn(),
      analyzeCommitPatterns: jest.fn(),
      gitManager: mockGitManager
    };
    CommitAnalyzer.mockImplementation(() => mockCommitAnalyzer);

    dataExporter = new DataExporter();
  });

  describe('commit data export', () => {
    test('should export commit data to JSON', async () => {
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'First commit',
          author_name: 'John Doe',
          author_email: 'john@example.com',
          date: '2023-06-15T10:00:00Z',
          parents: ['def456']
        },
        {
          hash: 'def456',
          message: 'Second commit',
          author_name: 'Jane Smith',
          author_email: 'jane@example.com',
          date: '2023-06-16T11:00:00Z',
          parents: []
        }
      ];

      mockGitManager.getCommitHistory.mockResolvedValue(mockCommits);

      const outputFile = path.join(testDir, 'commits.json');
      const result = await dataExporter.exportCommitData({
        outputFile,
        format: 'json',
        limit: 100
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.totalCommits).toBe(2);
      expect(result.outputFile).toBe(outputFile);

      // Verify file was created
      const fileContent = await fs.readFile(outputFile, 'utf8');
      const exportData = JSON.parse(fileContent);
      
      expect(exportData.metadata.totalCommits).toBe(2);
      expect(exportData.commits).toHaveLength(2);
      expect(exportData.commits[0].hash).toBe('abc123');
      expect(exportData.commits[0].author).toBe('John Doe');
      expect(exportData.statistics).toBeDefined();
    });

    test('should export commit data to CSV', async () => {
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'Test commit',
          author_name: 'Test Author',
          author_email: 'test@example.com',
          date: '2023-06-15T10:00:00Z'
        }
      ];

      mockGitManager.getCommitHistory.mockResolvedValue(mockCommits);

      const outputFile = path.join(testDir, 'commits.csv');
      const result = await dataExporter.exportCommitData({
        outputFile,
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');

      // Verify CSV content
      const fileContent = await fs.readFile(outputFile, 'utf8');
      expect(fileContent).toContain('Hash,Message,Author,Email,Date,Timestamp');
      expect(fileContent).toContain('abc123');
      expect(fileContent).toContain('Test commit');
    });

    test('should include file changes when requested', async () => {
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'Test commit',
          author_name: 'Test Author',
          author_email: 'test@example.com',
          date: '2023-06-15T10:00:00Z',
          files: [
            { file: 'src/test.js', changes: 'M', insertions: 10, deletions: 5 }
          ]
        }
      ];

      mockGitManager.getCommitHistory.mockResolvedValue(mockCommits);

      const outputFile = path.join(testDir, 'commits-with-files.json');
      const result = await dataExporter.exportCommitData({
        outputFile,
        format: 'json',
        includeFiles: true
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      const exportData = JSON.parse(fileContent);
      
      expect(exportData.commits[0].files).toBeDefined();
      expect(exportData.commits[0].files[0].path).toBe('src/test.js');
      expect(exportData.commits[0].files[0].status).toBe('M');
    });

    test('should filter commits by date range', async () => {
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'Filtered commit',
          author_name: 'Test Author',
          author_email: 'test@example.com',
          date: '2023-06-15T10:00:00Z'
        }
      ];

      mockGitManager.getCommitHistory.mockResolvedValue(mockCommits);

      const result = await dataExporter.exportCommitData({
        outputFile: path.join(testDir, 'filtered-commits.json'),
        format: 'json',
        since: '2023-06-01',
        until: '2023-06-30',
        author: 'Test Author'
      });

      expect(mockGitManager.getCommitHistory).toHaveBeenCalledWith({
        since: '2023-06-01',
        until: '2023-06-30',
        author: 'Test Author',
        branch: undefined,
        limit: 1000,
        includeFiles: false,
        includeDiffs: false
      });

      expect(result.success).toBe(true);
    });

    test('should handle unsupported format', async () => {
      await expect(dataExporter.exportCommitData({
        outputFile: path.join(testDir, 'test.invalid'),
        format: 'invalid'
      })).rejects.toThrow('Unsupported export format: invalid');
    });
  });

  describe('operation history export', () => {
    test('should export operation history to JSON', async () => {
      const mockOperations = [
        {
          id: 'op1',
          type: 'commit',
          command: 'commit',
          description: 'Test commit',
          timestamp: '2023-06-15T10:00:00Z',
          status: 'completed',
          undoable: true,
          duration: 5,
          args: { message: 'test' },
          result: { hash: 'abc123' },
          metadata: {
            workingDirectory: '/test',
            user: 'testuser',
            platform: 'linux'
          }
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockOperations);

      const outputFile = path.join(testDir, 'history.json');
      const result = await dataExporter.exportOperationHistory({
        outputFile,
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.totalOperations).toBe(1);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      const exportData = JSON.parse(fileContent);
      
      expect(exportData.operations).toHaveLength(1);
      expect(exportData.operations[0].id).toBe('op1');
      expect(exportData.operations[0].type).toBe('commit');
    });

    test('should export operation history to CSV', async () => {
      const mockOperations = [
        {
          id: 'op1',
          type: 'commit',
          command: 'commit',
          description: 'Test operation',
          timestamp: '2023-06-15T10:00:00Z',
          status: 'completed',
          undoable: true,
          duration: 3
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockOperations);

      const outputFile = path.join(testDir, 'history.csv');
      const result = await dataExporter.exportOperationHistory({
        outputFile,
        format: 'csv'
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      expect(fileContent).toContain('ID,Type,Command,Description');
      expect(fileContent).toContain('op1,commit,commit');
    });

    test('should filter operations by type and date', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([]);

      await dataExporter.exportOperationHistory({
        outputFile: path.join(testDir, 'filtered-history.json'),
        format: 'json',
        type: 'commit',
        since: '2023-06-01',
        until: '2023-06-30',
        limit: 50
      });

      expect(mockOperationHistory.getHistory).toHaveBeenCalledWith({
        since: '2023-06-01',
        until: '2023-06-30',
        type: 'commit',
        limit: 50
      });
    });
  });

  describe('analysis data export', () => {
    test('should export analysis data', async () => {
      const mockAnalysis = {
        overview: { totalCommits: 100, uniqueAuthors: 5 },
        temporal: { peakHour: 14, patterns: [] },
        authors: { topAuthors: [] },
        health: { score: 85, grade: 'B' }
      };

      const mockHeatmap = {
        data: { '2023-06-15': { count: 3, intensity: 2 } },
        summary: { totalDays: 365, activeDays: 120 }
      };

      const mockPatterns = {
        patterns: { conventional: 50, vague: 10 },
        suggestions: []
      };

      mockCommitAnalyzer.getComprehensiveStats.mockResolvedValue(mockAnalysis);
      mockCommitAnalyzer.generateHeatmap.mockResolvedValue(mockHeatmap);
      mockCommitAnalyzer.analyzeCommitPatterns.mockReturnValue(mockPatterns);
      mockGitManager.getCommitHistory.mockResolvedValue([]);

      const outputFile = path.join(testDir, 'analysis.json');
      const result = await dataExporter.exportAnalysisData({
        outputFile,
        format: 'json',
        includeHeatmap: true,
        includePatterns: true
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      const exportData = JSON.parse(fileContent);
      
      expect(exportData.analysis).toEqual(mockAnalysis);
      expect(exportData.heatmap).toEqual(mockHeatmap);
      expect(exportData.patterns).toEqual(mockPatterns);
    });
  });

  describe('configuration export', () => {
    test('should export configuration data', async () => {
      // Mock ConfigManager
      const mockConfigManager = {
        loadConfig: jest.fn().mockResolvedValue({
          git: { defaultTime: '12:00' },
          github: { token: 'secret-token' },
          ui: { theme: 'dark' }
        }),
        getDefaultConfig: jest.fn().mockResolvedValue({
          git: { defaultTime: '12:00' },
          ui: { theme: 'light' }
        })
      };

      jest.doMock('../../src/config/ConfigManager', () => {
        return jest.fn().mockImplementation(() => mockConfigManager);
      });

      const outputFile = path.join(testDir, 'config.json');
      const result = await dataExporter.exportConfigurationData({
        outputFile,
        format: 'json',
        includeSensitive: false,
        includeDefaults: true
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      const exportData = JSON.parse(fileContent);
      
      expect(exportData.configuration.git.defaultTime).toBe('12:00');
      expect(exportData.configuration.github.token).toBe('[FILTERED]');
      expect(exportData.defaults).toBeDefined();
    });

    test('should include sensitive data when requested', async () => {
      const mockConfigManager = {
        loadConfig: jest.fn().mockResolvedValue({
          github: { token: 'secret-token' }
        }),
        getDefaultConfig: jest.fn().mockResolvedValue({})
      };

      jest.doMock('../../src/config/ConfigManager', () => {
        return jest.fn().mockImplementation(() => mockConfigManager);
      });

      const outputFile = path.join(testDir, 'config-sensitive.json');
      const result = await dataExporter.exportConfigurationData({
        outputFile,
        format: 'json',
        includeSensitive: true
      });

      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      const exportData = JSON.parse(fileContent);
      
      expect(exportData.configuration.github.token).toBe('secret-token');
    });
  });

  describe('format conversion', () => {
    test('should convert data to XML format', async () => {
      const data = {
        metadata: { version: '1.0.0' },
        items: [
          { id: 1, name: 'test' },
          { id: 2, name: 'another' }
        ]
      };

      const xml = await dataExporter.convertToFormat(data, 'xml');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<histofy-export>');
      expect(xml).toContain('<metadata>');
      expect(xml).toContain('<version>1.0.0</version>');
      expect(xml).toContain('<items>');
    });

    test('should convert data to YAML format', async () => {
      const data = {
        metadata: { version: '1.0.0' },
        items: ['item1', 'item2']
      };

      const yaml = await dataExporter.convertToFormat(data, 'yaml');

      expect(yaml).toContain('metadata:');
      expect(yaml).toContain('version: 1.0.0');
      expect(yaml).toContain('items:');
      expect(yaml).toContain('- item1');
    });

    test('should handle unsupported format conversion', async () => {
      const data = { test: 'data' };

      await expect(dataExporter.convertToFormat(data, 'unsupported'))
        .rejects.toThrow('Unsupported format: unsupported');
    });
  });

  describe('utility methods', () => {
    test('should transform commit data for export', () => {
      const commit = {
        hash: 'abc123',
        message: 'Test commit',
        author_name: 'John Doe',
        author_email: 'john@example.com',
        date: '2023-06-15T10:00:00Z',
        parents: ['def456'],
        files: [
          { file: 'test.js', changes: 'M', insertions: 5, deletions: 2 }
        ]
      };

      const transformed = dataExporter.transformCommitForExport(commit, {
        includeFiles: true
      });

      expect(transformed.hash).toBe('abc123');
      expect(transformed.author).toBe('John Doe');
      expect(transformed.email).toBe('john@example.com');
      expect(transformed.timestamp).toBe('2023-06-15T10:00:00.000Z');
      expect(transformed.files).toHaveLength(1);
      expect(transformed.files[0].path).toBe('test.js');
    });

    test('should transform operation data for export', () => {
      const operation = {
        id: 'op1',
        type: 'commit',
        command: 'commit',
        description: 'Test operation',
        timestamp: '2023-06-15T10:00:00Z',
        status: 'completed',
        undoable: true,
        duration: 5,
        args: { message: 'test' },
        result: { hash: 'abc123' },
        metadata: {
          workingDirectory: '/test',
          user: 'testuser',
          platform: 'linux',
          nodeVersion: 'v16.0.0'
        },
        backupInfo: { backupBranch: 'backup-123' }
      };

      const transformed = dataExporter.transformOperationForExport(operation, {
        includeBackups: true
      });

      expect(transformed.id).toBe('op1');
      expect(transformed.type).toBe('commit');
      expect(transformed.metadata.workingDirectory).toBe('/test');
      expect(transformed.metadata.nodeVersion).toBeUndefined(); // Should be filtered
      expect(transformed.backupInfo).toEqual({ backupBranch: 'backup-123' });
    });

    test('should calculate commit statistics', async () => {
      const commits = [
        {
          author_name: 'John Doe',
          date: '2023-06-15T10:00:00Z',
          message: 'First commit message'
        },
        {
          author_name: 'Jane Smith',
          date: '2023-06-15T14:00:00Z',
          message: 'Second commit'
        },
        {
          author_name: 'John Doe',
          date: '2023-06-16T09:00:00Z',
          message: 'Third commit message here'
        }
      ];

      const stats = await dataExporter.calculateCommitStatistics(commits);

      expect(stats.totalCommits).toBe(3);
      expect(stats.uniqueAuthors).toBe(2);
      expect(stats.commitsByAuthor['John Doe']).toBe(2);
      expect(stats.commitsByAuthor['Jane Smith']).toBe(1);
      expect(stats.averageMessageLength).toBeGreaterThan(0);
      expect(stats.dateRange.earliest).toBe('2023-06-15T10:00:00Z');
      expect(stats.dateRange.latest).toBe('2023-06-16T09:00:00Z');
    });

    test('should filter sensitive configuration', () => {
      const config = {
        git: { defaultTime: '12:00' },
        github: { 
          token: 'secret-token',
          username: 'testuser'
        },
        database: {
          password: 'secret-password',
          host: 'localhost'
        },
        encrypted: {
          _encrypted: true,
          data: 'encrypted-data'
        }
      };

      const filtered = dataExporter.filterSensitiveConfig(config);

      expect(filtered.git.defaultTime).toBe('12:00');
      expect(filtered.github.token).toBe('[FILTERED]');
      expect(filtered.github.username).toBe('testuser');
      expect(filtered.database.password).toBe('[FILTERED]');
      expect(filtered.database.host).toBe('localhost');
      expect(filtered.encrypted).toBe('[ENCRYPTED]');
    });
  });

  describe('error handling', () => {
    test('should handle git manager errors', async () => {
      mockGitManager.getCommitHistory.mockRejectedValue(new Error('Git error'));

      await expect(dataExporter.exportCommitData({
        outputFile: path.join(testDir, 'error-test.json'),
        format: 'json'
      })).rejects.toThrow('Git error');
    });

    test('should handle file write errors', async () => {
      mockGitManager.getCommitHistory.mockResolvedValue([]);

      // Try to write to invalid path
      await expect(dataExporter.exportCommitData({
        outputFile: '/invalid/path/test.json',
        format: 'json'
      })).rejects.toThrow();
    });
  });
});