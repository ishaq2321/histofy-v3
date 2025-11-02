/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Feedback Utilities Tests
 */

const FeedbackUtils = require('../../src/utils/feedback');

// Mock inquirer to avoid actual prompts during tests
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock cli-table3 to avoid table rendering during tests
jest.mock('cli-table3', () => {
  return jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    toString: jest.fn().mockReturnValue('mocked table')
  }));
});

// Mock console methods to capture output
const mockConsole = {
  log: jest.fn(),
  clear: jest.fn()
};

describe('FeedbackUtils', () => {
  let originalConsole;
  let originalStdout;

  beforeAll(() => {
    originalConsole = { ...console };
    originalStdout = { ...process.stdout };
    
    console.log = mockConsole.log;
    console.clear = mockConsole.clear;
    process.stdout.write = jest.fn();
  });

  afterAll(() => {
    Object.assign(console, originalConsole);
    Object.assign(process.stdout, originalStdout);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.clear.mockClear();
  });

  describe('displayOperationSummary', () => {
    test('should display operation summary with stats', () => {
      const stats = {
        filesProcessed: 10,
        commitsCreated: 5,
        errorsEncountered: 0
      };
      
      FeedbackUtils.displayOperationSummary('Git Migration', stats, 5000);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Git Migration Summary:')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Duration: 5s')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Files Processed: 10')
      );
    });

    test('should display summary without duration', () => {
      const stats = { operations: 3 };
      
      FeedbackUtils.displayOperationSummary('Test Operation', stats);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Test Operation Summary:')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Operations: 3')
      );
    });

    test('should format duration in minutes and seconds', () => {
      FeedbackUtils.displayOperationSummary('Long Operation', {}, 125000);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Duration: 2m 5s')
      );
    });
  });

  describe('displaySuccess', () => {
    test('should display success message', () => {
      FeedbackUtils.displaySuccess('Operation completed successfully');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ Operation completed successfully')
      );
    });

    test('should display success message with details', () => {
      const details = ['5 files processed', '3 commits created'];
      
      FeedbackUtils.displaySuccess('Migration completed', details);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ Migration completed')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('5 files processed')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('3 commits created')
      );
    });
  });

  describe('displayWarning', () => {
    test('should display warning message', () => {
      FeedbackUtils.displayWarning('Some files were skipped');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠ Some files were skipped')
      );
    });

    test('should display warning with suggestions', () => {
      const suggestions = ['Check file permissions', 'Verify file paths'];
      
      FeedbackUtils.displayWarning('Access denied', suggestions);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠ Access denied')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Suggestions:')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('1. Check file permissions')
      );
    });
  });

  describe('displayInfo', () => {
    test('should display info message', () => {
      FeedbackUtils.displayInfo('Repository initialized');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('ℹ Repository initialized')
      );
    });

    test('should display info with context', () => {
      const context = ['Branch: main', 'Remote: origin'];
      
      FeedbackUtils.displayInfo('Git status', context);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('ℹ Git status')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Branch: main')
      );
    });
  });

  describe('confirmDestructiveOperation', () => {
    const inquirer = require('inquirer');

    test('should confirm destructive operation', async () => {
      inquirer.prompt.mockResolvedValue({ confirmed: true });
      
      const warnings = ['This will delete all local changes', 'Cannot be undone'];
      const result = await FeedbackUtils.confirmDestructiveOperation(
        'Reset repository',
        warnings
      );
      
      expect(result).toBe(true);
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠ Destructive Operation: Reset repository')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('This will delete all local changes')
      );
    });

    test('should handle user cancellation', async () => {
      inquirer.prompt.mockResolvedValue({ confirmed: false });
      
      const result = await FeedbackUtils.confirmDestructiveOperation('Delete files');
      
      expect(result).toBe(false);
    });

    test('should use custom options', async () => {
      inquirer.prompt.mockResolvedValue({ confirmed: true });
      
      const options = {
        confirmText: 'proceed',
        cancelText: 'abort',
        defaultValue: true
      };
      
      await FeedbackUtils.confirmDestructiveOperation('Test operation', [], options);
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: true
        })
      ]);
    });
  });

  describe('getUserChoice', () => {
    const inquirer = require('inquirer');

    test('should get user choice from options', async () => {
      inquirer.prompt.mockResolvedValue({ choice: 'option2' });
      
      const choices = ['option1', 'option2', 'option3'];
      const result = await FeedbackUtils.getUserChoice('Select an option:', choices);
      
      expect(result).toBe('option2');
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          message: 'Select an option:',
          choices: expect.arrayContaining([
            { name: 'option1', value: 'option1' },
            { name: 'option2', value: 'option2' },
            { name: 'option3', value: 'option3' }
          ])
        })
      ]);
    });

    test('should handle object choices', async () => {
      inquirer.prompt.mockResolvedValue({ choice: 'value1' });
      
      const choices = [
        { name: 'First Option', value: 'value1' },
        { name: 'Second Option', value: 'value2' }
      ];
      
      const result = await FeedbackUtils.getUserChoice('Choose:', choices);
      
      expect(result).toBe('value1');
    });

    test('should allow cancellation', async () => {
      inquirer.prompt.mockResolvedValue({ choice: null });
      
      const choices = ['option1', 'option2'];
      const result = await FeedbackUtils.getUserChoice(
        'Select:',
        choices,
        { allowCancel: true }
      );
      
      expect(result).toBeNull();
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: expect.arrayContaining([
            { name: 'Cancel', value: null }
          ])
        })
      ]);
    });
  });

  describe('getMultipleChoices', () => {
    const inquirer = require('inquirer');

    test('should get multiple choices', async () => {
      inquirer.prompt.mockResolvedValue({ choices: ['choice1', 'choice3'] });
      
      const choices = ['choice1', 'choice2', 'choice3'];
      const result = await FeedbackUtils.getMultipleChoices('Select multiple:', choices);
      
      expect(result).toEqual(['choice1', 'choice3']);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'checkbox',
          message: 'Select multiple:'
        })
      ]);
    });

    test('should validate minimum selections', async () => {
      inquirer.prompt.mockResolvedValue({ choices: ['choice1', 'choice2'] });
      
      const choices = ['choice1', 'choice2', 'choice3'];
      const options = { minSelections: 2 };
      
      await FeedbackUtils.getMultipleChoices('Select at least 2:', choices, options);
      
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          validate: expect.any(Function)
        })
      ]);
    });

    test('should validate maximum selections', async () => {
      inquirer.prompt.mockResolvedValue({ choices: ['choice1'] });
      
      const choices = ['choice1', 'choice2', 'choice3'];
      const options = { maxSelections: 1 };
      
      await FeedbackUtils.getMultipleChoices('Select max 1:', choices, options);
      
      const call = inquirer.prompt.mock.calls[0][0][0];
      const validator = call.validate;
      
      expect(validator(['choice1'])).toBe(true);
      expect(validator(['choice1', 'choice2'])).toContain('no more than 1');
    });
  });

  describe('displayTable', () => {
    const Table = require('cli-table3');

    test('should display table with data', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Boston' }
      ];
      
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'age', header: 'Age' },
        { key: 'city', header: 'City' }
      ];
      
      FeedbackUtils.displayTable(data, columns, { title: 'User Data' });
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('User Data')
      );
      expect(Table).toHaveBeenCalled();
    });

    test('should handle empty data', () => {
      const data = [];
      const columns = [{ key: 'name', header: 'Name' }];
      
      FeedbackUtils.displayTable(data, columns);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('No data to display')
      );
    });

    test('should apply formatters and colors', () => {
      const data = [{ status: 'active', count: 5 }];
      const columns = [
        {
          key: 'status',
          header: 'Status',
          formatter: (value) => value.toUpperCase(),
          color: 'green'
        },
        { key: 'count', header: 'Count' }
      ];
      
      FeedbackUtils.displayTable(data, columns);
      
      expect(Table).toHaveBeenCalled();
    });
  });

  describe('displayProgressSummary', () => {
    test('should display progress summary', () => {
      const operations = [
        { name: 'Initialize', success: true, duration: 1000, details: 'Setup complete' },
        { name: 'Process', success: false, duration: 2000, details: 'Failed to process' },
        { name: 'Cleanup', warning: true, duration: 500, details: 'Some warnings' }
      ];
      
      FeedbackUtils.displayProgressSummary(operations);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Operation Summary:')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ Initialize')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('✗ Process')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠ Cleanup')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Successful: 1')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Failed: 1')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Warnings: 1')
      );
    });

    test('should calculate total duration', () => {
      const operations = [
        { name: 'Op1', success: true, duration: 1000 },
        { name: 'Op2', success: true, duration: 2000 }
      ];
      
      FeedbackUtils.displayProgressSummary(operations);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Total Duration: 3s')
      );
    });
  });

  describe('createProgressMonitor', () => {
    test('should create progress monitor', () => {
      const steps = [
        { name: 'Step 1', description: 'First step' },
        { name: 'Step 2', description: 'Second step' }
      ];
      
      const monitor = FeedbackUtils.createProgressMonitor('Test Process', steps);
      
      expect(monitor).toHaveProperty('title', 'Test Process');
      expect(monitor.steps).toHaveLength(2);
      expect(monitor.steps[0].name).toBe('Step 1');
      expect(monitor.steps[0].status).toBe('pending');
    });

    test('should start progress monitor', () => {
      const monitor = FeedbackUtils.createProgressMonitor('Test', []);
      
      monitor.start();
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Test')
      );
    });

    test('should start and complete steps', () => {
      const steps = [{ name: 'Test Step' }];
      const monitor = FeedbackUtils.createProgressMonitor('Test', steps);
      
      monitor.startStep(0, 'Starting test');
      expect(monitor.steps[0].status).toBe('running');
      expect(monitor.steps[0].description).toBe('Starting test');
      
      monitor.completeStep(0, 'Test completed');
      expect(monitor.steps[0].status).toBe('completed');
      expect(monitor.steps[0].progress).toBe(100);
    });

    test('should update step progress', () => {
      const steps = [{ name: 'Test Step' }];
      const monitor = FeedbackUtils.createProgressMonitor('Test', steps);
      
      monitor.updateStep(0, 50, 'Half done');
      
      expect(monitor.steps[0].progress).toBe(50);
      expect(monitor.steps[0].description).toBe('Half done');
    });

    test('should fail steps', () => {
      const steps = [{ name: 'Test Step' }];
      const monitor = FeedbackUtils.createProgressMonitor('Test', steps);
      
      const error = new Error('Test error');
      monitor.failStep(0, error, 'Step failed');
      
      expect(monitor.steps[0].status).toBe('failed');
      expect(monitor.steps[0].error).toBe(error);
    });

    test('should get step icons', () => {
      const monitor = FeedbackUtils.createProgressMonitor('Test', []);
      
      expect(monitor.getStepIcon('pending')).toBeDefined();
      expect(monitor.getStepIcon('running')).toBeDefined();
      expect(monitor.getStepIcon('completed')).toBeDefined();
      expect(monitor.getStepIcon('failed')).toBeDefined();
    });

    test('should create progress bar', () => {
      const monitor = FeedbackUtils.createProgressMonitor('Test', []);
      
      const progressBar = monitor.createProgressBar(75);
      
      expect(progressBar).toContain('[');
      expect(progressBar).toContain(']');
      expect(progressBar).toContain('75%');
    });

    test('should complete monitor', () => {
      const steps = [{ name: 'Step 1' }, { name: 'Step 2' }];
      const monitor = FeedbackUtils.createProgressMonitor('Test', steps);
      
      monitor.completeStep(0);
      monitor.completeStep(1);
      monitor.complete();
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Test completed!')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Steps completed: 2/2')
      );
    });
  });
});