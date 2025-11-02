/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * BatchCommitManager Tests
 */

const BatchCommitManager = require('../../src/utils/BatchCommitManager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/core/GitManager');
jest.mock('../../src/core/OperationManager');

const GitManager = require('../../src/core/GitManager');
const OperationManager = require('../../src/core/OperationManager');

describe('BatchCommitManager', () => {
  let batchManager;
  let mockGitManager;
  let mockOperationManager;
  let testDir;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-batch-test-' + Date.now());
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
      createCommit: jest.fn().mockResolvedValue({ success: true, hash: 'abc123' }),
      getStatus: jest.fn().mockResolvedValue({ isClean: true, staged: [], modified: [], untracked: [] })
    };
    GitManager.mockImplementation(() => mockGitManager);

    // Setup OperationManager mock
    mockOperationManager = {
      startOperation: jest.fn().mockReturnValue('op-123'),
      completeOperation: jest.fn(),
      failOperation: jest.fn(),
      getInstance: jest.fn().mockReturnValue(mockOperationManager)
    };
    OperationManager.getInstance.mockReturnValue(mockOperationManager);

    batchManager = new BatchCommitManager();
  });

  describe('template validation', () => {
    test('should validate valid template', () => {
      const validTemplate = {
        message: 'Commit: {{title}}',
        author: 'Test Author',
        email: 'test@example.com',
        variables: [
          { name: 'title', type: 'string' },
          { name: 'priority', type: 'number' }
        ]
      };

      const result = batchManager.validateTemplate(validTemplate);
      expect(result).toEqual(validTemplate);
    });

    test('should reject template without message', () => {
      const invalidTemplate = {
        author: 'Test Author'
      };

      expect(() => batchManager.validateTemplate(invalidTemplate))
        .toThrow('Template missing required field: message');
    });

    test('should reject template with invalid variables', () => {
      const invalidTemplate = {
        message: 'Test message',
        variables: [
          { name: 'test' }, // Missing type is OK
          { type: 'invalid_type' } // Missing name
        ]
      };

      expect(() => batchManager.validateTemplate(invalidTemplate))
        .toThrow('Variable 1 missing name');
    });

    test('should reject template with invalid variable type', () => {
      const invalidTemplate = {
        message: 'Test message',
        variables: [
          { name: 'test', type: 'invalid_type' }
        ]
      };

      expect(() => batchManager.validateTemplate(invalidTemplate))
        .toThrow('Invalid variable type: invalid_type');
    });
  });

  describe('template processing', () => {
    test('should process template with variable substitution', () => {
      const template = {
        message: 'Fix {{issue}}: {{description}}',
        author: 'Test Author',
        variables: [
          { name: 'issue', type: 'string' },
          { name: 'description', type: 'string' }
        ]
      };

      const data = {
        issue: 'BUG-123',
        description: 'Memory leak in parser',
        date: '2023-06-15',
        time: '14:30'
      };

      const result = batchManager.processTemplate(template, data);

      expect(result.message).toBe('Fix BUG-123: Memory leak in parser');
      expect(result.author).toBe('Test Author');
      expect(result.date).toBe('2023-06-15');
      expect(result.time).toBe('14:30');
    });

    test('should process built-in variables', () => {
      const template = {
        message: 'Commit {{index}}/{{total}} on {{date}}'
      };

      const data = {
        index: 5,
        total: 10,
        date: '2023-06-15'
      };

      const result = batchManager.processTemplate(template, data);

      expect(result.message).toBe('Commit 5/10 on 2023-06-15');
    });

    test('should handle missing variables gracefully', () => {
      const template = {
        message: 'Fix {{issue}}: {{description}}',
        variables: [
          { name: 'issue', type: 'string' },
          { name: 'description', type: 'string' }
        ]
      };

      const data = {
        issue: 'BUG-123'
        // description is missing
      };

      const result = batchManager.processTemplate(template, data);

      expect(result.message).toBe('Fix BUG-123: {{description}}'); // Unchanged placeholder
    });
  });

  describe('CSV import', () => {
    test('should import valid CSV data', async () => {
      const csvContent = 'message,date,time,author\n' +
                        'First commit,2023-06-15,10:00,John Doe\n' +
                        'Second commit,2023-06-16,11:00,Jane Smith';
      
      const csvFile = path.join(testDir, 'test.csv');
      await fs.writeFile(csvFile, csvContent);

      const result = await batchManager.importFromCSV(csvFile);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        message: 'First commit',
        date: '2023-06-15',
        time: '10:00',
        author: 'John Doe'
      });
      expect(result[1]).toEqual({
        message: 'Second commit',
        date: '2023-06-16',
        time: '11:00',
        author: 'Jane Smith'
      });
    });

    test('should handle CSV with custom separator', async () => {
      const csvContent = 'message;date;author\n' +
                        'Test commit;2023-06-15;Test Author';
      
      const csvFile = path.join(testDir, 'test-semicolon.csv');
      await fs.writeFile(csvFile, csvContent);

      const result = await batchManager.importFromCSV(csvFile, { separator: ';' });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        message: 'Test commit',
        date: '2023-06-15',
        author: 'Test Author'
      });
    });

    test('should handle file read errors', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.csv');

      await expect(batchManager.importFromCSV(nonExistentFile))
        .rejects.toThrow('Failed to read CSV file');
    });
  });

  describe('JSON import', () => {
    test('should import valid JSON data', async () => {
      const jsonData = [
        {
          message: 'First commit',
          date: '2023-06-15',
          time: '10:00',
          author: 'John Doe'
        },
        {
          message: 'Second commit',
          date: '2023-06-16',
          time: '11:00',
          author: 'Jane Smith'
        }
      ];
      
      const jsonFile = path.join(testDir, 'test.json');
      await fs.writeFile(jsonFile, JSON.stringify(jsonData, null, 2));

      const result = await batchManager.importFromJSON(jsonFile);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(jsonData[0]);
      expect(result[1]).toEqual(jsonData[1]);
    });

    test('should reject non-array JSON', async () => {
      const jsonData = {
        message: 'Single commit',
        date: '2023-06-15'
      };
      
      const jsonFile = path.join(testDir, 'invalid.json');
      await fs.writeFile(jsonFile, JSON.stringify(jsonData));

      await expect(batchManager.importFromJSON(jsonFile))
        .rejects.toThrow('JSON file must contain an array');
    });

    test('should handle invalid JSON syntax', async () => {
      const invalidJson = '{ "message": "test", invalid }';
      
      const jsonFile = path.join(testDir, 'syntax-error.json');
      await fs.writeFile(jsonFile, invalidJson);

      await expect(batchManager.importFromJSON(jsonFile))
        .rejects.toThrow('Invalid JSON format');
    });

    test('should validate individual commit objects', async () => {
      const jsonData = [
        { message: 'Valid commit', date: '2023-06-15' },
        'invalid commit data', // Not an object
        { message: 'Another valid commit' }
      ];
      
      const jsonFile = path.join(testDir, 'mixed-validity.json');
      await fs.writeFile(jsonFile, JSON.stringify(jsonData));

      await expect(batchManager.importFromJSON(jsonFile))
        .rejects.toThrow('Invalid commit data at index 1');
    });
  });

  describe('batch validation', () => {
    test('should validate valid batch data', async () => {
      const commitData = [
        { message: 'First commit', date: '2023-06-15', time: '10:00' },
        { message: 'Second commit', date: '2023-06-16', time: '11:00' }
      ];

      const result = await batchManager.validateBatchData(commitData);

      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid commit data', async () => {
      const commitData = [
        { message: 'Valid commit', date: '2023-06-15' },
        { message: '', date: '2023-06-16' }, // Empty message
        { message: 'Another valid commit', date: 'invalid-date' } // Invalid date
      ];

      const result = await batchManager.validateBatchData(commitData);

      expect(result.valid).toBe(false);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    test('should warn about large batch sizes', async () => {
      const commitData = new Array(1500).fill(0).map((_, i) => ({
        message: `Commit ${i}`,
        date: '2023-06-15'
      }));

      const result = await batchManager.validateBatchData(commitData);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          warning: 'Large batch size detected'
        })
      );
    });

    test('should handle empty batch data', async () => {
      const result = await batchManager.validateBatchData([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          error: 'No commit data provided'
        })
      );
    });

    test('should handle non-array input', async () => {
      const result = await batchManager.validateBatchData('not an array');

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          error: 'Commit data must be an array'
        })
      );
    });
  });

  describe('batch execution', () => {
    test('should execute batch commit successfully', async () => {
      const commitData = [
        { message: 'First commit', date: '2023-06-15', time: '10:00' },
        { message: 'Second commit', date: '2023-06-16', time: '11:00' }
      ];

      const result = await batchManager.executeBatchCommit(commitData, null, { dryRun: false });

      expect(result.success).toBe(true);
      expect(result.totalCommits).toBe(2);
      expect(result.successfulCommits).toBe(2);
      expect(result.failedCommits).toBe(0);
      expect(mockGitManager.createCommit).toHaveBeenCalledTimes(2);
    });

    test('should handle dry run mode', async () => {
      const commitData = [
        { message: 'Test commit', date: '2023-06-15' }
      ];

      const result = await batchManager.executeBatchCommit(commitData, null, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.processedCommits).toBe(1);
      expect(mockGitManager.createCommit).not.toHaveBeenCalled();
    });

    test('should handle validation-only mode', async () => {
      const commitData = [
        { message: 'Test commit', date: '2023-06-15' }
      ];

      const result = await batchManager.executeBatchCommit(commitData, null, { validateOnly: true });

      expect(result.success).toBe(true);
      expect(result.validated).toBe(true);
      expect(result.totalCommits).toBe(1);
      expect(mockGitManager.createCommit).not.toHaveBeenCalled();
    });

    test('should continue on error when configured', async () => {
      const commitData = [
        { message: 'Good commit', date: '2023-06-15' },
        { message: 'Bad commit', date: '2023-06-16' },
        { message: 'Another good commit', date: '2023-06-17' }
      ];

      // Mock second commit to fail
      mockGitManager.createCommit
        .mockResolvedValueOnce({ success: true, hash: 'abc123' })
        .mockRejectedValueOnce(new Error('Commit failed'))
        .mockResolvedValueOnce({ success: true, hash: 'def456' });

      const result = await batchManager.executeBatchCommit(commitData, null, { 
        continueOnError: true,
        dryRun: false 
      });

      expect(result.success).toBe(true); // Success because continueOnError is true
      expect(result.successfulCommits).toBe(2);
      expect(result.failedCommits).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    test('should stop on first error when not configured to continue', async () => {
      const commitData = [
        { message: 'Good commit', date: '2023-06-15' },
        { message: 'Bad commit', date: '2023-06-16' }
      ];

      mockGitManager.createCommit
        .mockResolvedValueOnce({ success: true, hash: 'abc123' })
        .mockRejectedValueOnce(new Error('Commit failed'));

      await expect(batchManager.executeBatchCommit(commitData, null, { 
        continueOnError: false,
        dryRun: false 
      })).rejects.toThrow('Commit failed');
    });

    test('should use template for processing', async () => {
      const template = {
        message: 'Fix {{issue}}: {{description}}',
        author: 'Template Author'
      };

      const commitData = [
        { issue: 'BUG-123', description: 'Memory leak' }
      ];

      await batchManager.executeBatchCommit(commitData, template, { dryRun: false });

      expect(mockGitManager.createCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Fix BUG-123: Memory leak',
          author: 'Template Author <unknown@example.com>'
        })
      );
    });
  });

  describe('data export', () => {
    test('should export to JSON format', async () => {
      const commitData = [
        { message: 'First commit', date: '2023-06-15' },
        { message: 'Second commit', date: '2023-06-16' }
      ];

      const outputFile = path.join(testDir, 'export.json');
      const result = await batchManager.exportCommitData(commitData, 'json', outputFile);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.recordCount).toBe(2);

      // Verify file content
      const fileContent = await fs.readFile(outputFile, 'utf8');
      const parsedData = JSON.parse(fileContent);
      expect(parsedData).toEqual(commitData);
    });

    test('should export to CSV format', async () => {
      const commitData = [
        { message: 'First commit', date: '2023-06-15', author: 'John' },
        { message: 'Second commit', date: '2023-06-16', author: 'Jane' }
      ];

      const outputFile = path.join(testDir, 'export.csv');
      const result = await batchManager.exportCommitData(commitData, 'csv', outputFile);

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.recordCount).toBe(2);

      // Verify file content
      const fileContent = await fs.readFile(outputFile, 'utf8');
      expect(fileContent).toContain('message,date,author');
      expect(fileContent).toContain('"First commit","2023-06-15","John"');
    });

    test('should handle empty data export', async () => {
      const outputFile = path.join(testDir, 'empty.csv');
      const result = await batchManager.exportCommitData([], 'csv', outputFile);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0);

      const fileContent = await fs.readFile(outputFile, 'utf8');
      expect(fileContent).toBe('');
    });

    test('should reject unsupported export format', async () => {
      const commitData = [{ message: 'Test' }];
      const outputFile = path.join(testDir, 'export.xml');

      await expect(batchManager.exportCommitData(commitData, 'xml', outputFile))
        .rejects.toThrow('Unsupported export format: xml');
    });
  });

  describe('template creation', () => {
    test('should create template file', async () => {
      const templateData = {
        message: 'Fix {{issue}}: {{description}}',
        author: 'Test Author',
        variables: [
          { name: 'issue', type: 'string' },
          { name: 'description', type: 'string' }
        ]
      };

      const outputFile = path.join(testDir, 'template.json');
      const result = await batchManager.createTemplate(templateData, outputFile);

      expect(result.success).toBe(true);
      expect(result.templatePath).toBe(outputFile);
      expect(result.template).toEqual(templateData);

      // Verify file content
      const fileContent = await fs.readFile(outputFile, 'utf8');
      const parsedTemplate = JSON.parse(fileContent);
      expect(parsedTemplate).toEqual(templateData);
    });

    test('should validate template before creation', async () => {
      const invalidTemplate = {
        author: 'Test Author'
        // Missing required message field
      };

      const outputFile = path.join(testDir, 'invalid-template.json');

      await expect(batchManager.createTemplate(invalidTemplate, outputFile))
        .rejects.toThrow('Template missing required field: message');
    });
  });

  describe('individual commit validation', () => {
    test('should validate valid commit data', () => {
      const commit = {
        message: 'Valid commit message',
        date: '2023-06-15',
        time: '10:00',
        email: 'test@example.com'
      };

      const result = batchManager.validateCommitData(commit);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid commit message', () => {
      const commit = {
        message: '', // Empty message
        date: '2023-06-15'
      };

      const result = batchManager.validateCommitData(commit);
      expect(result.valid).toBe(false);
    });

    test('should reject invalid date', () => {
      const commit = {
        message: 'Valid message',
        date: 'invalid-date'
      };

      const result = batchManager.validateCommitData(commit);
      expect(result.valid).toBe(false);
    });

    test('should reject invalid time', () => {
      const commit = {
        message: 'Valid message',
        time: '25:70' // Invalid time
      };

      const result = batchManager.validateCommitData(commit);
      expect(result.valid).toBe(false);
    });

    test('should reject invalid email', () => {
      const commit = {
        message: 'Valid message',
        email: 'invalid-email'
      };

      const result = batchManager.validateCommitData(commit);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });
  });
});