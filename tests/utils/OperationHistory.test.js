/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * OperationHistory Tests
 */

const OperationHistory = require('../../src/utils/OperationHistory');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('../../src/core/GitManager');

const GitManager = require('../../src/core/GitManager');

describe('OperationHistory', () => {
  let operationHistory;
  let testDir;
  let mockGitManager;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-history-test-' + Date.now());
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
      getStatus: jest.fn().mockResolvedValue({ isClean: true }),
      getCurrentCommitHash: jest.fn().mockResolvedValue('abc123'),
      getParentCommitHash: jest.fn().mockResolvedValue('def456'),
      resetToCommit: jest.fn().mockResolvedValue({ success: true }),
      getBranches: jest.fn().mockResolvedValue(['main', 'backup-branch']),
      restoreFromBackup: jest.fn().mockResolvedValue({ success: true })
    };
    GitManager.mockImplementation(() => mockGitManager);

    operationHistory = new OperationHistory();
    // Override directories for testing
    operationHistory.historyDir = path.join(testDir, 'history');
    operationHistory.historyFile = path.join(testDir, 'history', 'operations.json');
    operationHistory.backupDir = path.join(testDir, 'history', 'backups');
  });

  describe('initialization', () => {
    test('should initialize history system', async () => {
      const result = await operationHistory.initialize();

      expect(result.success).toBe(true);
      
      // Check directories were created
      await expect(fs.access(operationHistory.historyDir)).resolves.not.toThrow();
      await expect(fs.access(operationHistory.backupDir)).resolves.not.toThrow();
      
      // Check history file was created
      await expect(fs.access(operationHistory.historyFile)).resolves.not.toThrow();
    });

    test('should handle existing history file', async () => {
      // Create existing history
      await fs.mkdir(operationHistory.historyDir, { recursive: true });
      const existingHistory = [{ id: 'test', type: 'test' }];
      await fs.writeFile(operationHistory.historyFile, JSON.stringify(existingHistory));

      const result = await operationHistory.initialize();

      expect(result.success).toBe(true);
      
      // Should not overwrite existing history
      const history = await operationHistory.loadHistory();
      expect(history).toEqual(existingHistory);
    });
  });

  describe('operation recording', () => {
    test('should record operation successfully', async () => {
      const operation = {
        type: 'commit',
        command: 'commit',
        args: { message: 'test commit' },
        description: 'Create test commit',
        result: { hash: 'abc123' },
        undoData: { commitHash: 'abc123' },
        duration: 5
      };

      const operationId = await operationHistory.recordOperation(operation);

      expect(operationId).toMatch(/^op_\d+_[a-f0-9]{8}$/);

      const history = await operationHistory.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: operationId,
        type: 'commit',
        command: 'commit',
        description: 'Create test commit',
        status: 'completed',
        undoable: true
      });
      expect(history[0].metadata).toHaveProperty('workingDirectory');
      expect(history[0].metadata).toHaveProperty('user');
    });

    test('should limit history size', async () => {
      operationHistory.maxHistoryEntries = 3;

      // Add more operations than the limit
      for (let i = 0; i < 5; i++) {
        await operationHistory.recordOperation({
          type: 'test',
          command: 'test',
          description: `Test operation ${i}`,
          duration: 1
        });
      }

      const history = await operationHistory.getHistory({ limit: 10 });
      expect(history).toHaveLength(3);
      
      // Should keep the most recent operations
      expect(history[0].description).toBe('Test operation 4');
      expect(history[1].description).toBe('Test operation 3');
      expect(history[2].description).toBe('Test operation 2');
    });

    test('should handle non-undoable operations', async () => {
      const operation = {
        type: 'status',
        command: 'status',
        description: 'Check repository status',
        undoable: false
      };

      const operationId = await operationHistory.recordOperation(operation);
      const recorded = await operationHistory.getOperation(operationId);

      expect(recorded.undoable).toBe(false);
    });
  });

  describe('history retrieval', () => {
    beforeEach(async () => {
      // Add test operations
      const operations = [
        {
          type: 'commit',
          command: 'commit',
          description: 'First commit',
          timestamp: '2023-06-15T10:00:00Z'
        },
        {
          type: 'migrate',
          command: 'migrate',
          description: 'Migrate commits',
          timestamp: '2023-06-16T10:00:00Z'
        },
        {
          type: 'commit',
          command: 'commit',
          description: 'Second commit',
          timestamp: '2023-06-17T10:00:00Z'
        }
      ];

      for (const op of operations) {
        await operationHistory.recordOperation(op);
      }
    });

    test('should get history with default options', async () => {
      const history = await operationHistory.getHistory();

      expect(history).toHaveLength(3);
      // Should be in reverse chronological order (newest first)
      expect(history[0].description).toBe('Second commit');
      expect(history[1].description).toBe('Migrate commits');
      expect(history[2].description).toBe('First commit');
    });

    test('should filter by type', async () => {
      const history = await operationHistory.getHistory({ type: 'commit' });

      expect(history).toHaveLength(2);
      expect(history[0].description).toBe('Second commit');
      expect(history[1].description).toBe('First commit');
    });

    test('should filter by date range', async () => {
      const history = await operationHistory.getHistory({
        since: '2023-06-16T00:00:00Z',
        until: '2023-06-16T23:59:59Z'
      });

      expect(history).toHaveLength(1);
      expect(history[0].description).toBe('Migrate commits');
    });

    test('should filter undoable only', async () => {
      // Add a non-undoable operation
      await operationHistory.recordOperation({
        type: 'status',
        command: 'status',
        description: 'Status check',
        undoable: false
      });

      const history = await operationHistory.getHistory({ undoableOnly: true });

      expect(history).toHaveLength(3); // Original 3 operations are undoable
      expect(history.every(op => op.undoable)).toBe(true);
    });

    test('should apply limit', async () => {
      const history = await operationHistory.getHistory({ limit: 2 });

      expect(history).toHaveLength(2);
      expect(history[0].description).toBe('Second commit');
      expect(history[1].description).toBe('Migrate commits');
    });

    test('should get specific operation by ID', async () => {
      const history = await operationHistory.getHistory();
      const operationId = history[0].id;

      const operation = await operationHistory.getOperation(operationId);

      expect(operation).toBeDefined();
      expect(operation.id).toBe(operationId);
      expect(operation.description).toBe('Second commit');
    });

    test('should return null for non-existent operation', async () => {
      const operation = await operationHistory.getOperation('non-existent-id');

      expect(operation).toBeNull();
    });
  });

  describe('undo safety checks', () => {
    test('should pass safety check for clean repository', async () => {
      const operation = {
        type: 'commit',
        metadata: { workingDirectory: process.cwd() },
        undoData: { commitHash: 'abc123' }
      };

      const safetyCheck = await operationHistory.checkUndoSafety(operation);

      expect(safetyCheck.safe).toBe(true);
    });

    test('should fail safety check for dirty repository', async () => {
      mockGitManager.getStatus.mockResolvedValue({ isClean: false });

      const operation = {
        type: 'commit',
        metadata: { workingDirectory: process.cwd() },
        undoData: { commitHash: 'abc123' }
      };

      const safetyCheck = await operationHistory.checkUndoSafety(operation);

      expect(safetyCheck.safe).toBe(false);
      expect(safetyCheck.reason).toContain('uncommitted changes');
    });

    test('should fail safety check for non-existent directory', async () => {
      const operation = {
        type: 'commit',
        metadata: { workingDirectory: '/non/existent/path' },
        undoData: { commitHash: 'abc123' }
      };

      const safetyCheck = await operationHistory.checkUndoSafety(operation);

      expect(safetyCheck.safe).toBe(false);
      expect(safetyCheck.reason).toContain('Working directory no longer accessible');
    });

    test('should check commit-specific safety conditions', async () => {
      mockGitManager.getCurrentCommitHash.mockResolvedValue('different-hash');

      const operation = {
        type: 'commit',
        metadata: { workingDirectory: process.cwd() },
        undoData: { commitHash: 'abc123' }
      };

      const safetyCheck = await operationHistory.checkUndoSafety(operation);

      expect(safetyCheck.safe).toBe(false);
      expect(safetyCheck.reason).toContain('Additional commits have been made');
    });

    test('should check migration-specific safety conditions', async () => {
      mockGitManager.getBranches.mockResolvedValue(['main']); // No backup branch

      const operation = {
        type: 'migrate',
        metadata: { workingDirectory: process.cwd() },
        backupInfo: { backupBranch: 'backup-branch' }
      };

      const safetyCheck = await operationHistory.checkUndoSafety(operation);

      expect(safetyCheck.safe).toBe(false);
      expect(safetyCheck.reason).toContain('Backup branch no longer exists');
    });
  });

  describe('undo operations', () => {
    test('should undo commit operation', async () => {
      const operationId = await operationHistory.recordOperation({
        type: 'commit',
        command: 'commit',
        description: 'Test commit',
        undoData: {
          commitHash: 'abc123',
          parentHash: 'def456'
        }
      });

      const result = await operationHistory.undoOperation(operationId);

      expect(result.success).toBe(true);
      expect(mockGitManager.resetToCommit).toHaveBeenCalledWith('def456', { hard: true });

      // Check operation is marked as undone
      const operation = await operationHistory.getOperation(operationId);
      expect(operation.status).toBe('undone');
      expect(operation.undoneAt).toBeDefined();
    });

    test('should undo migration operation', async () => {
      const operationId = await operationHistory.recordOperation({
        type: 'migrate',
        command: 'migrate',
        description: 'Test migration',
        backupInfo: { backupBranch: 'backup-branch' }
      });

      const result = await operationHistory.undoOperation(operationId);

      expect(result.success).toBe(true);
      expect(mockGitManager.restoreFromBackup).toHaveBeenCalledWith('backup-branch');
    });

    test('should handle dry-run undo', async () => {
      const operationId = await operationHistory.recordOperation({
        type: 'commit',
        command: 'commit',
        description: 'Test commit',
        undoData: { commitHash: 'abc123' }
      });

      const result = await operationHistory.undoOperation(operationId, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockGitManager.resetToCommit).not.toHaveBeenCalled();

      // Operation should not be marked as undone
      const operation = await operationHistory.getOperation(operationId);
      expect(operation.status).toBe('completed');
    });

    test('should fail to undo non-existent operation', async () => {
      await expect(operationHistory.undoOperation('non-existent'))
        .rejects.toThrow('Operation non-existent not found');
    });

    test('should fail to undo non-undoable operation', async () => {
      const operationId = await operationHistory.recordOperation({
        type: 'status',
        command: 'status',
        description: 'Status check',
        undoable: false
      });

      await expect(operationHistory.undoOperation(operationId))
        .rejects.toThrow('is not undoable');
    });

    test('should fail to undo already undone operation', async () => {
      const operationId = await operationHistory.recordOperation({
        type: 'commit',
        command: 'commit',
        description: 'Test commit',
        undoData: { commitHash: 'abc123' }
      });

      // First undo
      await operationHistory.undoOperation(operationId);

      // Second undo should fail
      await expect(operationHistory.undoOperation(operationId))
        .rejects.toThrow('has already been undone');
    });

    test('should force undo despite safety checks', async () => {
      mockGitManager.getStatus.mockResolvedValue({ isClean: false });

      const operationId = await operationHistory.recordOperation({
        type: 'commit',
        command: 'commit',
        description: 'Test commit',
        undoData: { commitHash: 'abc123', parentHash: 'def456' }
      });

      const result = await operationHistory.undoOperation(operationId, { force: true });

      expect(result.success).toBe(true);
      expect(mockGitManager.resetToCommit).toHaveBeenCalled();
    });
  });

  describe('undo last operations', () => {
    beforeEach(async () => {
      // Add test operations
      for (let i = 0; i < 3; i++) {
        await operationHistory.recordOperation({
          type: 'commit',
          command: 'commit',
          description: `Commit ${i}`,
          undoData: { commitHash: `hash${i}`, parentHash: `parent${i}` }
        });
      }
    });

    test('should undo last operation', async () => {
      const result = await operationHistory.undoLast(1);

      expect(result.success).toBe(true);
      expect(result.successfulUndos).toBe(1);
      expect(result.failedUndos).toBe(0);
      expect(mockGitManager.resetToCommit).toHaveBeenCalledTimes(1);
    });

    test('should undo multiple operations', async () => {
      const result = await operationHistory.undoLast(2);

      expect(result.success).toBe(true);
      expect(result.successfulUndos).toBe(2);
      expect(result.failedUndos).toBe(0);
      expect(mockGitManager.resetToCommit).toHaveBeenCalledTimes(2);
    });

    test('should handle partial failure', async () => {
      // Make second undo fail
      mockGitManager.resetToCommit
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Reset failed'));

      const result = await operationHistory.undoLast(2, { force: true });

      expect(result.success).toBe(false);
      expect(result.successfulUndos).toBe(1);
      expect(result.failedUndos).toBe(1);
    });

    test('should fail if no undoable operations', async () => {
      // Clear history and add non-undoable operation
      await operationHistory.clearHistory();
      await operationHistory.recordOperation({
        type: 'status',
        command: 'status',
        description: 'Status check',
        undoable: false
      });

      await expect(operationHistory.undoLast(1))
        .rejects.toThrow('No undoable operations found');
    });

    test('should handle requesting more operations than available', async () => {
      await expect(operationHistory.undoLast(10))
        .rejects.toThrow('Only 3 undoable operations available, requested 10');
    });
  });

  describe('history management', () => {
    beforeEach(async () => {
      // Add test operations
      for (let i = 0; i < 5; i++) {
        await operationHistory.recordOperation({
          type: i % 2 === 0 ? 'commit' : 'migrate',
          command: i % 2 === 0 ? 'commit' : 'migrate',
          description: `Operation ${i}`,
          timestamp: new Date(2023, 5, 15 + i).toISOString()
        });
      }
    });

    test('should clear all history', async () => {
      const result = await operationHistory.clearHistory();

      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(5);
      expect(result.remainingCount).toBe(0);

      const history = await operationHistory.getHistory();
      expect(history).toHaveLength(0);
    });

    test('should clear history by type', async () => {
      const result = await operationHistory.clearHistory({ type: 'commit' });

      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(3); // 3 commit operations
      expect(result.remainingCount).toBe(2); // 2 migrate operations

      const history = await operationHistory.getHistory();
      expect(history).toHaveLength(2);
      expect(history.every(op => op.type === 'migrate')).toBe(true);
    });

    test('should clear history older than date', async () => {
      const cutoffDate = new Date(2023, 5, 17).toISOString(); // June 17, 2023

      const result = await operationHistory.clearHistory({ olderThan: cutoffDate });

      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(2); // Operations from June 15-16
      expect(result.remainingCount).toBe(3); // Operations from June 17-19

      const history = await operationHistory.getHistory();
      expect(history).toHaveLength(3);
    });
  });

  describe('export functionality', () => {
    beforeEach(async () => {
      await operationHistory.recordOperation({
        type: 'commit',
        command: 'commit',
        description: 'Test commit',
        result: { hash: 'abc123' }
      });
    });

    test('should export history to JSON', async () => {
      const outputFile = path.join(testDir, 'export.json');

      const result = await operationHistory.exportHistory(outputFile, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.entriesExported).toBe(1);

      // Verify file content
      const fileContent = await fs.readFile(outputFile, 'utf8');
      const exportData = JSON.parse(fileContent);
      expect(exportData.totalEntries).toBe(1);
      expect(exportData.entries).toHaveLength(1);
      expect(exportData.entries[0].description).toBe('Test commit');
    });

    test('should export history to CSV', async () => {
      const outputFile = path.join(testDir, 'export.csv');

      const result = await operationHistory.exportHistory(outputFile, { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');

      // Verify file content
      const fileContent = await fs.readFile(outputFile, 'utf8');
      expect(fileContent).toContain('ID,Timestamp,Type,Command,Description');
      expect(fileContent).toContain('Test commit');
    });

    test('should handle unsupported export format', async () => {
      const outputFile = path.join(testDir, 'export.xml');

      await expect(operationHistory.exportHistory(outputFile, { format: 'xml' }))
        .rejects.toThrow('Unsupported export format: xml');
    });
  });

  describe('utility methods', () => {
    test('should generate unique operation IDs', () => {
      const id1 = operationHistory.generateOperationId();
      const id2 = operationHistory.generateOperationId();

      expect(id1).toMatch(/^op_\d+_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^op_\d+_[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });

    test('should convert history to CSV format', () => {
      const history = [
        {
          id: 'op1',
          timestamp: '2023-06-15T10:00:00Z',
          type: 'commit',
          command: 'commit',
          description: 'Test commit',
          status: 'completed',
          undoable: true,
          duration: 5
        }
      ];

      const csv = operationHistory.convertHistoryToCSV(history);

      expect(csv).toContain('ID,Timestamp,Type,Command,Description,Status,Undoable,Duration');
      expect(csv).toContain('"op1","2023-06-15T10:00:00Z","commit","commit","Test commit","completed","true","5"');
    });

    test('should handle empty history for CSV conversion', () => {
      const csv = operationHistory.convertHistoryToCSV([]);
      expect(csv).toBe('');
    });
  });
});