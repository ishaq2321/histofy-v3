/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Undo CLI Command Tests
 */

const { Command } = require('commander');
const undoCommand = require('../../src/cli/undo');
const OperationHistory = require('../../src/utils/OperationHistory');
const { FeedbackUtils } = require('../../src/utils/feedback');

// Mock dependencies
jest.mock('../../src/utils/OperationHistory');
jest.mock('../../src/utils/feedback');
jest.mock('inquirer');

const inquirer = require('inquirer');

describe('Undo CLI Command', () => {
  let mockOperationHistory;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup OperationHistory mock
    mockOperationHistory = {
      getHistory: jest.fn(),
      getOperation: jest.fn(),
      undoOperation: jest.fn(),
      undoLast: jest.fn(),
      checkUndoSafety: jest.fn(),
      clearHistory: jest.fn(),
      exportHistory: jest.fn()
    };
    OperationHistory.mockImplementation(() => mockOperationHistory);

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

  describe('undo last command', () => {
    test('should undo last operation successfully', async () => {
      const mockOperations = [
        {
          id: 'op1',
          type: 'commit',
          description: 'Test commit',
          timestamp: '2023-06-15T10:00:00Z',
          undoable: true,
          status: 'completed'
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockOperations);
      mockOperationHistory.checkUndoSafety.mockResolvedValue({ safe: true });
      mockOperationHistory.undoLast.mockResolvedValue({
        success: true,
        totalOperations: 1,
        successfulUndos: 1,
        failedUndos: 0
      });

      // Mock inquirer confirmation
      inquirer.prompt.mockResolvedValue({ proceed: true });

      // Create a test program to simulate command execution
      const program = new Command();
      program.addCommand(undoCommand);

      // Mock process.argv to simulate command line input
      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'last', '1', '--yes'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.getHistory).toHaveBeenCalledWith({
          limit: 1,
          undoableOnly: true
        });
        expect(mockOperationHistory.undoLast).toHaveBeenCalledWith(1, {
          force: undefined,
          dryRun: undefined
        });
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          'Undo completed',
          '1/1 operations undone'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle dry-run mode', async () => {
      const mockOperations = [
        {
          id: 'op1',
          type: 'commit',
          description: 'Test commit',
          timestamp: '2023-06-15T10:00:00Z',
          undoable: true
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockOperations);
      mockOperationHistory.checkUndoSafety.mockResolvedValue({ safe: true });
      mockOperationHistory.undoLast.mockResolvedValue({
        success: true,
        totalOperations: 1,
        successfulUndos: 1,
        failedUndos: 0
      });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'last', '1', '--dry-run'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.undoLast).toHaveBeenCalledWith(1, {
          force: undefined,
          dryRun: true
        });
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('DRY RUN COMPLETED')
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle safety check failures', async () => {
      const mockOperations = [
        {
          id: 'op1',
          type: 'commit',
          description: 'Test commit',
          timestamp: '2023-06-15T10:00:00Z',
          undoable: true
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockOperations);
      mockOperationHistory.checkUndoSafety.mockResolvedValue({
        safe: false,
        reason: 'Repository has uncommitted changes'
      });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'last', '1'];

      try {
        await program.parseAsync();
        
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('failed safety checks')
        );
        expect(mockOperationHistory.undoLast).not.toHaveBeenCalled();
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle no undoable operations', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([]);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'last', '1'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.warn).toHaveBeenCalledWith(
          'No undoable operations found'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should force undo with --force flag', async () => {
      const mockOperations = [
        {
          id: 'op1',
          type: 'commit',
          description: 'Test commit',
          timestamp: '2023-06-15T10:00:00Z',
          undoable: true
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockOperations);
      mockOperationHistory.checkUndoSafety.mockResolvedValue({
        safe: false,
        reason: 'Repository has uncommitted changes'
      });
      mockOperationHistory.undoLast.mockResolvedValue({
        success: true,
        totalOperations: 1,
        successfulUndos: 1,
        failedUndos: 0
      });

      inquirer.prompt.mockResolvedValue({ proceed: true });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'last', '1', '--force', '--yes'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.undoLast).toHaveBeenCalledWith(1, {
          force: true,
          dryRun: undefined
        });
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('undo operation command', () => {
    test('should undo specific operation successfully', async () => {
      const mockOperation = {
        id: 'op1',
        type: 'commit',
        description: 'Test commit',
        timestamp: '2023-06-15T10:00:00Z',
        status: 'completed',
        undoable: true
      };

      mockOperationHistory.getOperation.mockResolvedValue(mockOperation);
      mockOperationHistory.checkUndoSafety.mockResolvedValue({ safe: true });
      mockOperationHistory.undoOperation.mockResolvedValue({
        success: true,
        operationId: 'op1'
      });

      inquirer.prompt.mockResolvedValue({ proceed: true });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'operation', 'op1', '--yes'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.getOperation).toHaveBeenCalledWith('op1');
        expect(mockOperationHistory.undoOperation).toHaveBeenCalledWith('op1', {
          force: undefined,
          dryRun: undefined
        });
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          'Operation undone successfully',
          'Test commit'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle non-existent operation', async () => {
      mockOperationHistory.getOperation.mockResolvedValue(null);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'operation', 'non-existent'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.error).toHaveBeenCalledWith(
          'Operation not found',
          'No operation found with ID: non-existent'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle non-undoable operation', async () => {
      const mockOperation = {
        id: 'op1',
        type: 'status',
        description: 'Status check',
        undoable: false
      };

      mockOperationHistory.getOperation.mockResolvedValue(mockOperation);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'operation', 'op1'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.error).toHaveBeenCalledWith(
          'Operation not undoable',
          'This operation cannot be undone'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle already undone operation', async () => {
      const mockOperation = {
        id: 'op1',
        type: 'commit',
        description: 'Test commit',
        status: 'undone',
        undoable: true
      };

      mockOperationHistory.getOperation.mockResolvedValue(mockOperation);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'operation', 'op1'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.warn).toHaveBeenCalledWith(
          'Already undone',
          'This operation has already been undone'
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('history command', () => {
    test('should display history in table format', async () => {
      const mockHistory = [
        {
          id: 'op1',
          type: 'commit',
          description: 'Test commit',
          timestamp: '2023-06-15T10:00:00Z',
          status: 'completed'
        },
        {
          id: 'op2',
          type: 'migrate',
          description: 'Migrate commits',
          timestamp: '2023-06-14T10:00:00Z',
          status: 'undone'
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockHistory);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'history'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.getHistory).toHaveBeenCalledWith({
          limit: 20,
          type: undefined,
          since: undefined,
          until: undefined,
          undoableOnly: undefined
        });
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Operation History')
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should filter history by type', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([]);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'history', '--type', 'commit'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.getHistory).toHaveBeenCalledWith({
          limit: 20,
          type: 'commit',
          since: undefined,
          until: undefined,
          undoableOnly: undefined
        });
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should export history to file', async () => {
      const mockHistory = [
        {
          id: 'op1',
          type: 'commit',
          description: 'Test commit'
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockHistory);
      mockOperationHistory.exportHistory.mockResolvedValue({
        success: true,
        entriesExported: 1
      });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'history', '--output', 'history.json'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.exportHistory).toHaveBeenCalledWith(
          'history.json',
          { format: 'table' }
        );
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          'History exported',
          'Saved 1 entries to history.json'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle empty history', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([]);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'history'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.info).toHaveBeenCalledWith(
          'No operations found matching the criteria'
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('clear command', () => {
    test('should clear all history with confirmation', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([
        { id: 'op1', type: 'commit' },
        { id: 'op2', type: 'migrate' }
      ]);
      mockOperationHistory.clearHistory.mockResolvedValue({
        success: true,
        removedCount: 2,
        remainingCount: 0
      });

      inquirer.prompt.mockResolvedValue({ proceed: true });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'clear'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.clearHistory).toHaveBeenCalledWith({
          olderThan: undefined,
          type: undefined,
          keepBackups: undefined
        });
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          'History cleared',
          'Removed 2 operations, 0 remaining'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should clear history by type', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([
        { id: 'op1', type: 'commit' }
      ]);
      mockOperationHistory.clearHistory.mockResolvedValue({
        success: true,
        removedCount: 1,
        remainingCount: 1
      });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'clear', '--type', 'commit', '--yes'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.clearHistory).toHaveBeenCalledWith({
          olderThan: undefined,
          type: 'commit',
          keepBackups: undefined
        });
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle clear cancellation', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([
        { id: 'op1', type: 'commit' }
      ]);

      inquirer.prompt.mockResolvedValue({ proceed: false });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'clear'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.info).toHaveBeenCalledWith('Clear cancelled');
        expect(mockOperationHistory.clearHistory).not.toHaveBeenCalled();
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle no operations to clear', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([]);

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'clear'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.info).toHaveBeenCalledWith(
          'No operations match the criteria'
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('export command', () => {
    test('should export history to JSON', async () => {
      mockOperationHistory.exportHistory.mockResolvedValue({
        success: true,
        entriesExported: 5,
        format: 'json'
      });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'export', 'history.json'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.exportHistory).toHaveBeenCalledWith(
          'history.json',
          {
            format: 'json',
            includeBackups: undefined
          }
        );
        expect(FeedbackUtils.success).toHaveBeenCalledWith(
          'History exported',
          '5 entries exported to history.json'
        );
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should export history to CSV', async () => {
      mockOperationHistory.exportHistory.mockResolvedValue({
        success: true,
        entriesExported: 3,
        format: 'csv'
      });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo', 'export', 'history.csv', '--format', 'csv'];

      try {
        await program.parseAsync();
        
        expect(mockOperationHistory.exportHistory).toHaveBeenCalledWith(
          'history.csv',
          {
            format: 'csv',
            includeBackups: undefined
          }
        );
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('interactive mode', () => {
    test('should handle interactive undo selection', async () => {
      const mockOperations = [
        {
          id: 'op1',
          type: 'commit',
          description: 'Recent commit',
          timestamp: '2023-06-15T10:00:00Z',
          status: 'completed'
        }
      ];

      mockOperationHistory.getHistory.mockResolvedValue(mockOperations);
      mockOperationHistory.undoLast.mockResolvedValue({
        success: true,
        successfulUndos: 1,
        failedUndos: 0
      });

      // Mock interactive prompts
      inquirer.prompt
        .mockResolvedValueOnce({ action: 'last' })
        .mockResolvedValueOnce({ proceed: true });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo'];

      try {
        await program.parseAsync();
        
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Interactive Undo Mode')
        );
        expect(mockOperationHistory.undoLast).toHaveBeenCalled();
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle interactive cancellation', async () => {
      mockOperationHistory.getHistory.mockResolvedValue([
        { id: 'op1', type: 'commit', description: 'Test' }
      ]);

      inquirer.prompt.mockResolvedValue({ action: 'cancel' });

      const program = new Command();
      program.addCommand(undoCommand);

      const originalArgv = process.argv;
      process.argv = ['node', 'histofy', 'undo'];

      try {
        await program.parseAsync();
        
        expect(FeedbackUtils.info).toHaveBeenCalledWith('Undo cancelled');
      } finally {
        process.argv = originalArgv;
      }
    });
  });
});