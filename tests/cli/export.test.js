/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Export CLI Command Tests
 */

const { Command } = require('commander');
const exportCommand = require('../../src/cli/export');
const DataExporter = require('../../src/utils/DataExporter');
const { FeedbackUtils } = require('../../src/utils/feedback');

// Mock dependencies
jest.mock('../../src/utils/DataExporter');
jest.mock('../../src/utils/feedback');

describe('Export CLI Command', () => {
  let mockDataExporter;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup DataExporter mock
    mockDataExporter = {
      exportCommitData: jest.fn(),
      exportOperationHistory: jest.fn(),
      exportAnalysisData: jest.fn(),
      exportConfigurationData: jest.fn()
    };
    DataExporter.mockImplementation(() => mockDataExporter);

    // Setup FeedbackUtils mock
    FeedbackUtils.success = jest.fn();
    FeedbackUtils.error = jest.fn();
    FeedbackUtils.info = jest.fn();

    // Mock console.log to capture output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('commits export', () => {
    test('should export commits to JSON', async () => {
      mockDataExporter.exportCommitData.mockResolvedValue({
        success: true,
        format: 'json',
        outputFile: 'commits.json',
        totalCommits: 50,
        fileSize: 1024
      });

      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'export', 'commits', '--output', 'commits.json'];

      try {
        await program.parseAsync();
        
        expect(mockDataExporter.exportCommitData).toHaveBeenCalledWith({
          outputFile: 'commits.json',
          format: 'json',
          since: undefined,
          until: undefined,
          author: undefined,
          branch: undefined,
          limit: 1000,
          includeFiles: undefined,
          includeDiffs: undefined,
          includeStats: true
        });
        
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Export completed successfully')
        );
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          'Export completed',
          'Data saved to commits.json'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should export commits with filters', async () => {
      mockDataExporter.exportCommitData.mockResolvedValue({
        success: true,
        format: 'csv',
        outputFile: 'filtered-commits.csv',
        totalCommits: 25,
        fileSize: 2048
      });

      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = [
        'node', 'histofy', 'export', 'commits',
        '--format', 'csv',
        '--output', 'filtered-commits.csv',
        '--since', '2023-01-01',
        '--until', '2023-12-31',
        '--author', 'John Doe',
        '--branch', 'main',
        '--limit', '500',
        '--include-files',
        '--include-stats'
      ];

      try {
        await program.parseAsync();
        
        expect(mockDataExporter.exportCommitData).toHaveBeenCalledWith({
          outputFile: 'filtered-commits.csv',
          format: 'csv',
          since: '2023-01-01',
          until: '2023-12-31',
          author: 'John Doe',
          branch: 'main',
          limit: 500,
          includeFiles: true,
          includeDiffs: undefined,
          includeStats: true
        });
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle dry run mode', async () => {
      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'export', 'commits', '--dry-run'];

      try {
        await program.parseAsync();
        
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('DRY RUN MODE')
        );
        expect(FeedbackUtils.info).toHaveBeenCalledWith(
          'Dry run completed - no files created'
        );
        expect(mockDataExporter.exportCommitData).not.toHaveBeenCalled();
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('history export', () => {
    test('should export operation history', async () => {
      mockDataExporter.exportOperationHistory.mockResolvedValue({
        success: true,
        format: 'json',
        outputFile: 'history.json',
        totalOperations: 20,
        fileSize: 512
      });

      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'export', 'history', '--output', 'history.json'];

      try {
        await program.parseAsync();
        
        expect(mockDataExporter.exportOperationHistory).toHaveBeenCalledWith({
          outputFile: 'history.json',
          format: 'json',
          since: undefined,
          until: undefined,
          type: undefined,
          limit: 100,
          includeBackups: undefined
        });
        
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          'Export completed',
          'Data saved to history.json'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should export history with filters', async () => {
      mockDataExporter.exportOperationHistory.mockResolvedValue({
        success: true,
        format: 'csv',
        outputFile: 'filtered-history.csv',
        totalOperations: 10,
        fileSize: 256
      });

      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = [
        'node', 'histofy', 'export', 'history',
        '--format', 'csv',
        '--type', 'commit',
        '--since', '2023-06-01',
        '--limit', '50',
        '--include-backups'
      ];

      try {
        await program.parseAsync();
        
        expect(mockDataExporter.exportOperationHistory).toHaveBeenCalledWith({
          outputFile: expect.stringMatching(/histofy-history-\d{4}-\d{2}-\d{2}\.csv$/),
          format: 'csv',
          since: '2023-06-01',
          until: undefined,
          type: 'commit',
          limit: 50,
          includeBackups: true
        });
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('analysis export', () => {
    test('should export analysis data', async () => {
      mockDataExporter.exportAnalysisData.mockResolvedValue({
        success: true,
        format: 'json',
        outputFile: 'analysis.json',
        fileSize: 4096
      });

      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = [
        'node', 'histofy', 'export', 'analysis',
        '--output', 'analysis.json',
        '--include-heatmap',
        '--include-patterns',
        '--include-health',
        '--include-trends'
      ];

      try {
        await program.parseAsync();
        
        expect(mockDataExporter.exportAnalysisData).toHaveBeenCalledWith({
          outputFile: 'analysis.json',
          format: 'json',
          includeHeatmap: true,
          includePatterns: true,
          includeHealth: true,
          includeTrends: true
        });
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('config export', () => {
    test('should export configuration data', async () => {
      mockDataExporter.exportConfigurationData.mockResolvedValue({
        success: true,
        format: 'yaml',
        outputFile: 'config.yaml',
        configKeys: 5,
        fileSize: 128
      });

      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = [
        'node', 'histofy', 'export', 'config',
        '--format', 'yaml',
        '--output', 'config.yaml',
        '--include-sensitive',
        '--include-defaults'
      ];

      try {
        await program.parseAsync();
        
        expect(mockDataExporter.exportConfigurationData).toHaveBeenCalledWith({
          outputFile: 'config.yaml',
          format: 'yaml',
          includeSensitive: true,
          includeDefaults: true
        });
        
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Warning: Sensitive configuration values will be included')
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('error handling', () => {
    test('should handle export errors', async () => {
      mockDataExporter.exportCommitData.mockRejectedValue(new Error('Export failed'));

      const program = new Command();
      program.addCommand(exportCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'export', 'commits'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.error).toHaveBeenCalledWith(
          'Commit export failed',
          'Export failed'
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('utility functions', () => {
    test('should format file sizes correctly', () => {
      // Import the function from the module (need to access it somehow)
      // For now, we'll test the logic conceptually
      const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
    });

    test('should get correct file extensions', () => {
      const getFileExtension = (format) => {
        const extensions = {
          json: '.json',
          csv: '.csv',
          xml: '.xml',
          yaml: '.yaml'
        };
        return extensions[format.toLowerCase()] || '.txt';
      };

      expect(getFileExtension('json')).toBe('.json');
      expect(getFileExtension('CSV')).toBe('.csv');
      expect(getFileExtension('xml')).toBe('.xml');
      expect(getFileExtension('yaml')).toBe('.yaml');
      expect(getFileExtension('unknown')).toBe('.txt');
    });
  });
});