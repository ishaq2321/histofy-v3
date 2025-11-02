/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Batch CLI Command Tests
 */

const batchCommand = require('../../src/cli/batch');
const BatchCommitManager = require('../../src/utils/BatchCommitManager');
const { FeedbackUtils } = require('../../src/utils/feedback');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/utils/BatchCommitManager');
jest.mock('../../src/utils/feedback');

describe('Batch CLI Command', () => {
  let testDir;
  let mockBatchManager;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-batch-cli-test-' + Date.now());
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

    // Setup BatchCommitManager mock
    mockBatchManager = {
      importFromCSV: jest.fn(),
      importFromJSON: jest.fn(),
      validateBatchData: jest.fn(),
      executeBatchCommit: jest.fn(),
      exportCommitData: jest.fn(),
      createTemplate: jest.fn(),
      loadTemplate: jest.fn()
    };
    BatchCommitManager.mockImplementation(() => mockBatchManager);

    // Setup FeedbackUtils mock
    FeedbackUtils.success = jest.fn();
    FeedbackUtils.error = jest.fn();
    FeedbackUtils.info = jest.fn();
    FeedbackUtils.warn = jest.fn();
  });

  describe('commit action', () => {
    test('should execute batch commit with CSV input', async () => {
      const csvData = [
        { message: 'First commit', date: '2023-06-15' },
        { message: 'Second commit', date: '2023-06-16' }
      ];

      const csvFile = path.join(testDir, 'commits.csv');
      await fs.writeFile(csvFile, 'message,date\nFirst commit,2023-06-15\nSecond commit,2023-06-16');

      mockBatchManager.importFromCSV.mockResolvedValue(csvData);
      mockBatchManager.validateBatchData.mockResolvedValue({
        valid: true,
        validCount: 2,
        invalidCount: 0,
        errors: [],
        warnings: []
      });
      mockBatchManager.executeBatchCommit.mockResolvedValue({
        success: true,
        totalCommits: 2,
        successfulCommits: 2,
        failedCommits: 0
      });

      const result = await batchCommand('commit', {
        input: csvFile,
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.importFromCSV).toHaveBeenCalledWith(csvFile, expect.any(Object));
      expect(mockBatchManager.executeBatchCommit).toHaveBeenCalledWith(csvData, null, expect.any(Object));
    });

    test('should execute batch commit with JSON input', async () => {
      const jsonData = [
        { message: 'First commit', date: '2023-06-15' },
        { message: 'Second commit', date: '2023-06-16' }
      ];

      const jsonFile = path.join(testDir, 'commits.json');
      await fs.writeFile(jsonFile, JSON.stringify(jsonData));

      mockBatchManager.importFromJSON.mockResolvedValue(jsonData);
      mockBatchManager.validateBatchData.mockResolvedValue({
        valid: true,
        validCount: 2,
        invalidCount: 0,
        errors: [],
        warnings: []
      });
      mockBatchManager.executeBatchCommit.mockResolvedValue({
        success: true,
        totalCommits: 2,
        successfulCommits: 2,
        failedCommits: 0
      });

      const result = await batchCommand('commit', {
        input: jsonFile,
        dryRun: false
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.importFromJSON).toHaveBeenCalledWith(jsonFile);
      expect(mockBatchManager.executeBatchCommit).toHaveBeenCalledWith(jsonData, null, expect.any(Object));
    });

    test('should handle dry run mode', async () => {
      const csvData = [
        { message: 'Test commit', date: '2023-06-15' }
      ];

      const csvFile = path.join(testDir, 'test.csv');
      await fs.writeFile(csvFile, 'message,date\nTest commit,2023-06-15');

      mockBatchManager.importFromCSV.mockResolvedValue(csvData);
      mockBatchManager.validateBatchData.mockResolvedValue({
        valid: true,
        validCount: 1,
        invalidCount: 0,
        errors: [],
        warnings: []
      });
      mockBatchManager.executeBatchCommit.mockResolvedValue({
        success: true,
        dryRun: true,
        processedCommits: 1
      });

      const result = await batchCommand('commit', {
        input: csvFile,
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.executeBatchCommit).toHaveBeenCalledWith(
        csvData, 
        null, 
        expect.objectContaining({ dryRun: true })
      );
    });

    test('should handle validation errors', async () => {
      const csvData = [
        { message: '', date: '2023-06-15' } // Invalid empty message
      ];

      const csvFile = path.join(testDir, 'invalid.csv');
      await fs.writeFile(csvFile, 'message,date\n,2023-06-15');

      mockBatchManager.importFromCSV.mockResolvedValue(csvData);
      mockBatchManager.validateBatchData.mockResolvedValue({
        valid: false,
        validCount: 0,
        invalidCount: 1,
        errors: [{ index: 0, error: 'Empty commit message' }],
        warnings: []
      });

      const result = await batchCommand('commit', {
        input: csvFile,
        dryRun: false
      });

      expect(result.success).toBe(false);
      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Validation failed',
        expect.stringContaining('1 invalid commits found')
      );
    });

    test('should require input file', async () => {
      const result = await batchCommand('commit', {});

      expect(result.success).toBe(false);
      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Input file required',
        'Use --input to specify CSV or JSON file'
      );
    });
  });

  describe('template action', () => {
    test('should create new template', async () => {
      const templateData = {
        message: 'Fix {{issue}}: {{description}}',
        author: 'Test Author',
        variables: [
          { name: 'issue', type: 'string' },
          { name: 'description', type: 'string' }
        ]
      };

      const outputFile = path.join(testDir, 'template.json');

      mockBatchManager.createTemplate.mockResolvedValue({
        success: true,
        templatePath: outputFile,
        template: templateData
      });

      const result = await batchCommand('template', {
        create: true,
        output: outputFile
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.createTemplate).toHaveBeenCalled();
    });

    test('should validate existing template', async () => {
      const templateFile = path.join(testDir, 'existing-template.json');
      const templateData = {
        message: 'Valid template: {{title}}',
        variables: [{ name: 'title', type: 'string' }]
      };

      await fs.writeFile(templateFile, JSON.stringify(templateData));

      mockBatchManager.loadTemplate.mockResolvedValue(templateData);

      const result = await batchCommand('template', {
        validate: true,
        input: templateFile
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.loadTemplate).toHaveBeenCalledWith(templateFile);
    });
  });

  describe('import action', () => {
    test('should import CSV data', async () => {
      const csvData = [
        { message: 'Imported commit', date: '2023-06-15' }
      ];

      const csvFile = path.join(testDir, 'import.csv');
      await fs.writeFile(csvFile, 'message,date\nImported commit,2023-06-15');

      mockBatchManager.importFromCSV.mockResolvedValue(csvData);

      const result = await batchCommand('import', {
        input: csvFile
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.importFromCSV).toHaveBeenCalledWith(csvFile, expect.any(Object));
    });

    test('should import JSON data', async () => {
      const jsonData = [
        { message: 'Imported commit', date: '2023-06-15' }
      ];

      const jsonFile = path.join(testDir, 'import.json');
      await fs.writeFile(jsonFile, JSON.stringify(jsonData));

      mockBatchManager.importFromJSON.mockResolvedValue(jsonData);

      const result = await batchCommand('import', {
        input: jsonFile
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.importFromJSON).toHaveBeenCalledWith(jsonFile);
    });
  });

  describe('export action', () => {
    test('should export commit data to JSON', async () => {
      const commitData = [
        { message: 'Export test', date: '2023-06-15' }
      ];

      const outputFile = path.join(testDir, 'export.json');

      mockBatchManager.exportCommitData.mockResolvedValue({
        success: true,
        format: 'json',
        recordCount: 1
      });

      const result = await batchCommand('export', {
        output: outputFile,
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.exportCommitData).toHaveBeenCalledWith(
        expect.any(Array),
        'json',
        outputFile
      );
    });

    test('should export commit data to CSV', async () => {
      const outputFile = path.join(testDir, 'export.csv');

      mockBatchManager.exportCommitData.mockResolvedValue({
        success: true,
        format: 'csv',
        recordCount: 1
      });

      const result = await batchCommand('export', {
        output: outputFile,
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.exportCommitData).toHaveBeenCalledWith(
        expect.any(Array),
        'csv',
        outputFile
      );
    });
  });

  describe('validate action', () => {
    test('should validate commit data', async () => {
      const csvData = [
        { message: 'Valid commit', date: '2023-06-15' }
      ];

      const csvFile = path.join(testDir, 'validate.csv');
      await fs.writeFile(csvFile, 'message,date\nValid commit,2023-06-15');

      mockBatchManager.importFromCSV.mockResolvedValue(csvData);
      mockBatchManager.validateBatchData.mockResolvedValue({
        valid: true,
        validCount: 1,
        invalidCount: 0,
        errors: [],
        warnings: []
      });

      const result = await batchCommand('validate', {
        input: csvFile
      });

      expect(result.success).toBe(true);
      expect(mockBatchManager.validateBatchData).toHaveBeenCalledWith(csvData);
    });

    test('should report validation errors', async () => {
      const csvData = [
        { message: '', date: 'invalid-date' }
      ];

      const csvFile = path.join(testDir, 'invalid-validate.csv');
      await fs.writeFile(csvFile, 'message,date\n,invalid-date');

      mockBatchManager.importFromCSV.mockResolvedValue(csvData);
      mockBatchManager.validateBatchData.mockResolvedValue({
        valid: false,
        validCount: 0,
        invalidCount: 1,
        errors: [
          { index: 0, error: 'Empty commit message' },
          { index: 0, error: 'Invalid date format' }
        ],
        warnings: []
      });

      const result = await batchCommand('validate', {
        input: csvFile
      });

      expect(result.success).toBe(false);
      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Validation failed',
        expect.stringContaining('1 invalid commits found')
      );
    });
  });

  describe('error handling', () => {
    test('should handle unsupported action', async () => {
      const result = await batchCommand('unsupported', {});

      expect(result.success).toBe(false);
      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Invalid action',
        'Supported actions: commit, template, import, export, validate'
      );
    });

    test('should handle file system errors', async () => {
      mockBatchManager.importFromCSV.mockRejectedValue(new Error('File not found'));

      const result = await batchCommand('commit', {
        input: 'nonexistent.csv'
      });

      expect(result.success).toBe(false);
      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Batch operation failed',
        'File not found'
      );
    });

    test('should handle batch execution errors', async () => {
      const csvData = [
        { message: 'Test commit', date: '2023-06-15' }
      ];

      const csvFile = path.join(testDir, 'error-test.csv');
      await fs.writeFile(csvFile, 'message,date\nTest commit,2023-06-15');

      mockBatchManager.importFromCSV.mockResolvedValue(csvData);
      mockBatchManager.validateBatchData.mockResolvedValue({
        valid: true,
        validCount: 1,
        invalidCount: 0,
        errors: [],
        warnings: []
      });
      mockBatchManager.executeBatchCommit.mockRejectedValue(new Error('Git operation failed'));

      const result = await batchCommand('commit', {
        input: csvFile,
        dryRun: false
      });

      expect(result.success).toBe(false);
      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Batch operation failed',
        'Git operation failed'
      );
    });
  });
});