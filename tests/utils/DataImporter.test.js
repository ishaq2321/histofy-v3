/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * DataImporter Tests
 */

const DataImporter = require('../../src/utils/DataImporter');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/utils/OperationHistory');
jest.mock('../../src/config/ConfigManager');

const OperationHistory = require('../../src/utils/OperationHistory');

describe('DataImporter', () => {
  let dataImporter;
  let testDir;
  let mockOperationHistory;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-import-test-' + Date.now());
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

    // Setup OperationHistory mock
    mockOperationHistory = {
      recordOperation: jest.fn().mockResolvedValue('op-123'),
      clearHistory: jest.fn().mockResolvedValue({ success: true })
    };
    OperationHistory.mockImplementation(() => mockOperationHistory);

    dataImporter = new DataImporter();
  });

  describe('format detection', () => {
    test('should detect JSON format from extension', () => {
      expect(dataImporter.detectFileFormat('data.json')).toBe('json');
      expect(dataImporter.detectFileFormat('data.csv')).toBe('csv');
      expect(dataImporter.detectFileFormat('data.yaml')).toBe('yaml');
      expect(dataImporter.detectFileFormat('data.yml')).toBe('yaml');
      expect(dataImporter.detectFileFormat('data.xml')).toBe('xml');
    });

    test('should default to JSON for unknown extensions', () => {
      expect(dataImporter.detectFileFormat('data.unknown')).toBe('json');
      expect(dataImporter.detectFileFormat('data')).toBe('json');
    });
  });

  describe('file reading', () => {
    test('should read JSON file', async () => {
      const testData = { commits: [{ message: 'test', hash: 'abc123' }] };
      const jsonFile = path.join(testDir, 'test.json');
      await fs.writeFile(jsonFile, JSON.stringify(testData));

      const result = await dataImporter.readJSONFile(jsonFile);

      expect(result).toEqual(testData);
    });

    test('should handle invalid JSON', async () => {
      const jsonFile = path.join(testDir, 'invalid.json');
      await fs.writeFile(jsonFile, '{ invalid json }');

      await expect(dataImporter.readJSONFile(jsonFile))
        .rejects.toThrow('Invalid JSON format');
    });

    test('should read CSV file', async () => {
      const csvContent = 'message,hash,author\nTest commit,abc123,John Doe\nAnother commit,def456,Jane Smith';
      const csvFile = path.join(testDir, 'test.csv');
      await fs.writeFile(csvFile, csvContent);

      const result = await dataImporter.readCSVFile(csvFile);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        message: 'Test commit',
        hash: 'abc123',
        author: 'John Doe'
      });
      expect(result[1]).toEqual({
        message: 'Another commit',
        hash: 'def456',
        author: 'Jane Smith'
      });
    });

    test('should read YAML file', async () => {
      const yamlContent = `
commits:
  - message: Test commit
    hash: abc123
    author: John Doe
  - message: Another commit
    hash: def456
    author: Jane Smith
`;
      const yamlFile = path.join(testDir, 'test.yaml');
      await fs.writeFile(yamlFile, yamlContent);

      const result = await dataImporter.readYAMLFile(yamlFile);

      expect(result.commits).toHaveLength(2);
      expect(result.commits[0].message).toBe('Test commit');
    });

    test('should handle file not found', async () => {
      await expect(dataImporter.readFile('nonexistent.json', 'json'))
        .rejects.toThrow('File not found');
    });
  });

  describe('commit data import', () => {
    test('should import commit data from JSON', async () => {
      const commitData = {
        commits: [
          {
            message: 'First commit',
            hash: 'abc123',
            author: 'John Doe',
            email: 'john@example.com',
            date: '2023-06-15'
          },
          {
            message: 'Second commit',
            hash: 'def456',
            author: 'Jane Smith',
            email: 'jane@example.com',
            date: '2023-06-16'
          }
        ]
      };

      const jsonFile = path.join(testDir, 'commits.json');
      await fs.writeFile(jsonFile, JSON.stringify(commitData));

      const result = await dataImporter.importCommitData(jsonFile, {
        validate: true,
        transform: true
      });

      expect(result.success).toBe(true);
      expect(result.totalCommits).toBe(2);
      expect(result.validCommits).toBe(2);
      expect(result.invalidCommits).toBe(0);
      expect(result.commits).toHaveLength(2);
    });

    test('should import commit data from CSV', async () => {
      const csvContent = 'message,hash,author,email,date\n' +
                        'First commit,abc123,John Doe,john@example.com,2023-06-15\n' +
                        'Second commit,def456,Jane Smith,jane@example.com,2023-06-16';

      const csvFile = path.join(testDir, 'commits.csv');
      await fs.writeFile(csvFile, csvContent);

      const result = await dataImporter.importCommitData(csvFile, {
        format: 'csv',
        validate: true
      });

      expect(result.success).toBe(true);
      expect(result.totalCommits).toBe(2);
      expect(result.commits[0].message).toBe('First commit');
      expect(result.commits[1].author).toBe('Jane Smith');
    });

    test('should validate commit data', async () => {
      const invalidCommitData = {
        commits: [
          {
            message: 'Valid commit',
            date: '2023-06-15'
          },
          {
            // Missing required message field
            date: '2023-06-16'
          },
          {
            message: 'Another commit',
            date: 'invalid-date'
          }
        ]
      };

      const jsonFile = path.join(testDir, 'invalid-commits.json');
      await fs.writeFile(jsonFile, JSON.stringify(invalidCommitData));

      const result = await dataImporter.importCommitData(jsonFile, {
        validate: true,
        continueOnError: true
      });

      expect(result.success).toBe(true); // Success because continueOnError is true
      expect(result.totalCommits).toBe(3);
      expect(result.validation.validCount).toBe(1);
      expect(result.validation.invalidCount).toBe(2);
      expect(result.validation.errors).toHaveLength(2);
    });

    test('should transform commit data', async () => {
      const commitData = {
        commits: [
          {
            message: 'Test commit',
            author_name: 'John Doe', // Should be normalized to 'author'
            author_email: 'john@example.com', // Should be normalized to 'email'
            date: '2023-06-15T10:00:00Z'
          }
        ]
      };

      const jsonFile = path.join(testDir, 'transform-commits.json');
      await fs.writeFile(jsonFile, JSON.stringify(commitData));

      const result = await dataImporter.importCommitData(jsonFile, {
        transform: true,
        generateMissingFields: true
      });

      expect(result.success).toBe(true);
      expect(result.commits[0].author).toBe('John Doe');
      expect(result.commits[0].email).toBe('john@example.com');
      expect(result.commits[0].hash).toMatch(/^imported-\d+-0$/);
    });

    test('should handle dry run mode', async () => {
      const commitData = {
        commits: [{ message: 'Test commit', date: '2023-06-15' }]
      };

      const jsonFile = path.join(testDir, 'dryrun-commits.json');
      await fs.writeFile(jsonFile, JSON.stringify(commitData));

      const result = await dataImporter.importCommitData(jsonFile, {
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.totalCommits).toBe(1);
    });
  });

  describe('operation history import', () => {
    test('should import operation history from JSON', async () => {
      const operationData = {
        operations: [
          {
            type: 'commit',
            description: 'Test commit operation',
            command: 'commit',
            timestamp: '2023-06-15T10:00:00Z',
            duration: 5
          },
          {
            type: 'migrate',
            description: 'Test migration operation',
            command: 'migrate',
            timestamp: '2023-06-16T10:00:00Z',
            duration: 30
          }
        ]
      };

      const jsonFile = path.join(testDir, 'operations.json');
      await fs.writeFile(jsonFile, JSON.stringify(operationData));

      const result = await dataImporter.importOperationHistory(jsonFile, {
        validate: true,
        merge: false
      });

      expect(result.success).toBe(true);
      expect(result.totalOperations).toBe(2);
      expect(result.validOperations).toBe(2);
      expect(mockOperationHistory.clearHistory).toHaveBeenCalledWith({ keepBackups: true });
      expect(mockOperationHistory.recordOperation).toHaveBeenCalledTimes(2);
    });

    test('should merge with existing history', async () => {
      const operationData = {
        operations: [
          {
            type: 'commit',
            description: 'New operation',
            command: 'commit'
          }
        ]
      };

      const jsonFile = path.join(testDir, 'merge-operations.json');
      await fs.writeFile(jsonFile, JSON.stringify(operationData));

      const result = await dataImporter.importOperationHistory(jsonFile, {
        merge: true
      });

      expect(result.success).toBe(true);
      expect(mockOperationHistory.clearHistory).not.toHaveBeenCalled();
      expect(mockOperationHistory.recordOperation).toHaveBeenCalledTimes(1);
    });

    test('should validate operation data', async () => {
      const invalidOperationData = {
        operations: [
          {
            type: 'commit',
            description: 'Valid operation'
          },
          {
            type: 'invalid-type', // Invalid type
            description: 'Invalid operation'
          },
          {
            type: 'migrate'
            // Missing required description
          }
        ]
      };

      const jsonFile = path.join(testDir, 'invalid-operations.json');
      await fs.writeFile(jsonFile, JSON.stringify(invalidOperationData));

      const result = await dataImporter.importOperationHistory(jsonFile, {
        validate: true
      });

      expect(result.success).toBe(true); // Still success if validation passes for some
      expect(result.validation.validCount).toBe(1);
      expect(result.validation.invalidCount).toBe(2);
    });

    test('should handle dry run for operations', async () => {
      const operationData = {
        operations: [
          { type: 'commit', description: 'Test operation' }
        ]
      };

      const jsonFile = path.join(testDir, 'dryrun-operations.json');
      await fs.writeFile(jsonFile, JSON.stringify(operationData));

      const result = await dataImporter.importOperationHistory(jsonFile, {
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockOperationHistory.recordOperation).not.toHaveBeenCalled();
    });
  });

  describe('configuration import', () => {
    test('should import configuration from JSON', async () => {
      const configData = {
        git: {
          defaultTime: '10:00'
        },
        github: {
          token: 'test-token'
        },
        ui: {
          theme: 'dark'
        }
      };

      const jsonFile = path.join(testDir, 'config.json');
      await fs.writeFile(jsonFile, JSON.stringify(configData));

      // Mock ConfigManager
      const mockConfigManager = {
        loadConfig: jest.fn().mockResolvedValue({}),
        saveConfig: jest.fn().mockResolvedValue(true),
        configFile: path.join(testDir, 'histofy-config.yaml')
      };

      jest.doMock('../../src/config/ConfigManager', () => {
        return jest.fn().mockImplementation(() => mockConfigManager);
      });

      const result = await dataImporter.importConfiguration(jsonFile, {
        merge: false,
        backup: true
      });

      expect(result.success).toBe(true);
      expect(result.configKeys).toBe(3);
    });

    test('should merge configuration', async () => {
      const newConfig = {
        git: {
          defaultTime: '09:00'
        },
        newSection: {
          newValue: 'test'
        }
      };

      const existingConfig = {
        git: {
          defaultTime: '12:00',
          existingValue: 'keep'
        },
        github: {
          token: 'existing-token'
        }
      };

      const merged = dataImporter.mergeConfigurations(existingConfig, newConfig);

      expect(merged.git.defaultTime).toBe('09:00'); // Overwritten
      expect(merged.git.existingValue).toBe('keep'); // Preserved
      expect(merged.github.token).toBe('existing-token'); // Preserved
      expect(merged.newSection.newValue).toBe('test'); // Added
    });

    test('should validate configuration structure', async () => {
      const validConfig = {
        git: { defaultTime: '12:00' },
        github: { token: 'test-token' }
      };

      const result = await dataImporter.validateConfigData(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid configuration', async () => {
      const invalidConfig = {
        git: { defaultTime: '25:00' } // Invalid time
      };

      const result = await dataImporter.validateConfigData(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid git.defaultTime format');
    });

    test('should handle dry run for configuration', async () => {
      const configData = { git: { defaultTime: '10:00' } };

      const jsonFile = path.join(testDir, 'dryrun-config.json');
      await fs.writeFile(jsonFile, JSON.stringify(configData));

      const result = await dataImporter.importConfiguration(jsonFile, {
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
    });
  });

  describe('data extraction', () => {
    test('should extract commits from various data structures', () => {
      // Direct array
      const directArray = [
        { message: 'commit 1' },
        { message: 'commit 2' }
      ];
      expect(dataImporter.extractCommitsFromData(directArray, 'json')).toHaveLength(2);

      // Wrapped in commits property
      const wrappedData = {
        commits: [
          { message: 'commit 1' },
          { message: 'commit 2' }
        ]
      };
      expect(dataImporter.extractCommitsFromData(wrappedData, 'json')).toHaveLength(2);

      // Single commit object
      const singleCommit = { message: 'single commit', hash: 'abc123' };
      expect(dataImporter.extractCommitsFromData(singleCommit, 'json')).toHaveLength(1);

      // CSV format (already array)
      const csvData = [
        { message: 'csv commit 1' },
        { message: 'csv commit 2' }
      ];
      expect(dataImporter.extractCommitsFromData(csvData, 'csv')).toHaveLength(2);
    });

    test('should extract operations from various data structures', () => {
      // Direct array
      const directArray = [
        { type: 'commit', description: 'op 1' },
        { type: 'migrate', description: 'op 2' }
      ];
      expect(dataImporter.extractOperationsFromData(directArray, 'json')).toHaveLength(2);

      // Wrapped in operations property
      const wrappedData = {
        operations: [
          { type: 'commit', description: 'op 1' }
        ]
      };
      expect(dataImporter.extractOperationsFromData(wrappedData, 'json')).toHaveLength(1);

      // Single operation object
      const singleOp = { type: 'commit', description: 'single op' };
      expect(dataImporter.extractOperationsFromData(singleOp, 'json')).toHaveLength(1);
    });

    test('should extract configuration from data', () => {
      // Direct configuration
      const directConfig = { git: { defaultTime: '12:00' } };
      expect(dataImporter.extractConfigFromData(directConfig, 'json')).toEqual(directConfig);

      // Wrapped in configuration property
      const wrappedConfig = {
        configuration: { git: { defaultTime: '12:00' } }
      };
      expect(dataImporter.extractConfigFromData(wrappedConfig, 'json')).toEqual({ git: { defaultTime: '12:00' } });
    });

    test('should throw error for invalid data structures', () => {
      const invalidData = { someOtherProperty: 'value' };

      expect(() => dataImporter.extractCommitsFromData(invalidData, 'json'))
        .toThrow('No commit data found in input file');

      expect(() => dataImporter.extractOperationsFromData(invalidData, 'json'))
        .toThrow('No operation data found in input file');
    });
  });

  describe('import statistics', () => {
    test('should calculate import statistics', () => {
      const commitResult = {
        totalCommits: 100,
        validCommits: 95,
        invalidCommits: 5,
        format: 'json'
      };

      const stats = dataImporter.getImportStatistics(commitResult);

      expect(stats.totalRecords).toBe(100);
      expect(stats.validRecords).toBe(95);
      expect(stats.invalidRecords).toBe(5);
      expect(stats.successRate).toBe(95);
      expect(stats.format).toBe('json');
    });

    test('should handle zero records', () => {
      const emptyResult = {
        totalCommits: 0,
        validCommits: 0,
        invalidCommits: 0,
        format: 'csv'
      };

      const stats = dataImporter.getImportStatistics(emptyResult);

      expect(stats.successRate).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle unsupported file format', async () => {
      await expect(dataImporter.importCommitData('test.unsupported', {
        format: 'unsupported'
      })).rejects.toThrow('Unsupported file format: unsupported');
    });

    test('should handle file read errors gracefully', async () => {
      await expect(dataImporter.readFile('nonexistent.json', 'json'))
        .rejects.toThrow('File not found');
    });

    test('should handle malformed CSV', async () => {
      const malformedCsv = 'header1,header2\nvalue1,value2,extra_value\nincomplete_row';
      const csvFile = path.join(testDir, 'malformed.csv');
      await fs.writeFile(csvFile, malformedCsv);

      // CSV parser should handle this gracefully
      const result = await dataImporter.readCSVFile(csvFile);
      expect(result).toHaveLength(2); // Should parse what it can
    });
  });
});