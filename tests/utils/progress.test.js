/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Progress Utilities Tests
 */

const {
  ProgressIndicator,
  MultiStepProgress,
  ProgressUtils
} = require('../../src/utils/progress');

// Mock ora to avoid actual spinner output during tests
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    text: ''
  }));
});

// Mock console methods to avoid output during tests
const mockConsole = {
  log: jest.fn(),
  clear: jest.fn()
};

describe('ProgressIndicator', () => {
  let originalConsole;
  let originalStdout;

  beforeAll(() => {
    originalConsole = { ...console };
    originalStdout = { ...process.stdout };
    
    console.log = mockConsole.log;
    console.clear = mockConsole.clear;
    process.stdout.write = jest.fn();
    process.stdout.columns = 80;
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

  describe('constructor', () => {
    test('should create progress indicator with default options', () => {
      const progress = new ProgressIndicator();
      
      expect(progress.options.type).toBe('spinner');
      expect(progress.options.text).toBe('Processing...');
      expect(progress.options.color).toBe('cyan');
      expect(progress.cancelled).toBe(false);
    });

    test('should create progress indicator with custom options', () => {
      const options = {
        type: 'progress',
        text: 'Custom text',
        color: 'green',
        total: 50
      };
      
      const progress = new ProgressIndicator(options);
      
      expect(progress.options.type).toBe('progress');
      expect(progress.options.text).toBe('Custom text');
      expect(progress.options.color).toBe('green');
      expect(progress.options.total).toBe(50);
    });
  });

  describe('spinner type', () => {
    test('should start spinner', () => {
      const progress = new ProgressIndicator({ type: 'spinner' });
      const ora = require('ora');
      
      progress.start('Loading...');
      
      expect(ora).toHaveBeenCalledWith({
        text: 'Loading...',
        color: 'cyan',
        spinner: 'dots'
      });
      expect(progress.startTime).toBeDefined();
    });

    test('should update spinner text', () => {
      const progress = new ProgressIndicator({ type: 'spinner' });
      progress.start();
      
      progress.update('Updated text');
      
      expect(progress.spinner.text).toBe('Updated text');
    });

    test('should succeed spinner', () => {
      const progress = new ProgressIndicator({ type: 'spinner' });
      progress.start();
      
      const successSpy = jest.fn();
      progress.on('success', successSpy);
      
      progress.succeed('Success message');
      
      expect(progress.spinner.succeed).toHaveBeenCalled();
      expect(successSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Success message')
        })
      );
    });

    test('should fail spinner', () => {
      const progress = new ProgressIndicator({ type: 'spinner' });
      progress.start();
      
      const failSpy = jest.fn();
      progress.on('failure', failSpy);
      
      progress.fail('Error message');
      
      expect(progress.spinner.fail).toHaveBeenCalled();
      expect(failSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Error message')
        })
      );
    });
  });

  describe('progress bar type', () => {
    test('should initialize progress bar', () => {
      const progress = new ProgressIndicator({ type: 'progress', total: 100 });
      
      progress.start('Processing...');
      
      expect(progress.progressBar).toBeDefined();
      expect(progress.progressBar.total).toBe(100);
      expect(progress.progressBar.current).toBe(0);
    });

    test('should update progress bar', () => {
      const progress = new ProgressIndicator({ type: 'progress', total: 100 });
      progress.start();
      
      progress.update(50, 'Half way done');
      
      expect(progress.progressBar.current).toBe(50);
      expect(progress.progressBar.text).toBe('Half way done');
    });

    test('should not exceed maximum progress', () => {
      const progress = new ProgressIndicator({ type: 'progress', total: 100 });
      progress.start();
      
      progress.update(150); // Exceeds maximum
      
      expect(progress.progressBar.current).toBe(100);
    });

    test('should calculate ETA', () => {
      const progress = new ProgressIndicator({ type: 'progress', total: 100 });
      progress.start();
      
      // Mock start time to be 1 second ago
      progress.startTime = Date.now() - 1000;
      
      const eta = progress.calculateETA(25, 100);
      
      expect(eta).toBeDefined();
      expect(typeof eta).toBe('string');
    });
  });

  describe('step type', () => {
    test('should initialize step progress', () => {
      const progress = new ProgressIndicator({ type: 'steps', total: 5 });
      
      progress.start('Step processing...');
      
      expect(progress.stepProgress).toBeDefined();
      expect(progress.stepProgress.total).toBe(5);
    });

    test('should update step progress', () => {
      const progress = new ProgressIndicator({ type: 'steps', total: 5 });
      progress.start();
      
      progress.update(2, 'Step 2 of 5');
      
      expect(progress.stepProgress.current).toBe(2);
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[2/5]')
      );
    });
  });

  describe('cancellation', () => {
    test('should cancel progress', () => {
      const progress = new ProgressIndicator();
      progress.start();
      
      const cancelSpy = jest.fn();
      progress.on('cancelled', cancelSpy);
      
      progress.cancel('User cancelled');
      
      expect(progress.cancelled).toBe(true);
      expect(cancelSpy).toHaveBeenCalledWith({
        text: 'User cancelled'
      });
    });

    test('should not update when cancelled', () => {
      const progress = new ProgressIndicator();
      progress.start();
      progress.cancel();
      
      progress.update('Should not update');
      
      // Should not throw or cause issues
      expect(progress.cancelled).toBe(true);
    });
  });

  describe('elapsed time', () => {
    test('should calculate elapsed time', () => {
      const progress = new ProgressIndicator();
      progress.startTime = Date.now() - 5000; // 5 seconds ago
      
      const elapsed = progress.getElapsedTime();
      
      expect(elapsed).toBe('5s');
    });

    test('should format minutes and seconds', () => {
      const progress = new ProgressIndicator();
      progress.startTime = Date.now() - 125000; // 2 minutes 5 seconds ago
      
      const elapsed = progress.getElapsedTime();
      
      expect(elapsed).toBe('2m 5s');
    });

    test('should return 0s when no start time', () => {
      const progress = new ProgressIndicator();
      
      const elapsed = progress.getElapsedTime();
      
      expect(elapsed).toBe('0s');
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources', () => {
      const progress = new ProgressIndicator();
      progress.start();
      
      progress.cleanup();
      
      expect(progress.spinner).toBeNull();
      expect(progress.progressBar).toBeNull();
    });
  });
});

describe('MultiStepProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.clear.mockClear();
  });

  describe('constructor', () => {
    test('should create multi-step progress with steps', () => {
      const steps = [
        { name: 'Step 1', description: 'First step' },
        { name: 'Step 2', description: 'Second step' }
      ];
      
      const multiStep = new MultiStepProgress(steps);
      
      expect(multiStep.steps).toHaveLength(2);
      expect(multiStep.steps[0].name).toBe('Step 1');
      expect(multiStep.steps[0].status).toBe('pending');
      expect(multiStep.currentStepIndex).toBe(0);
    });

    test('should create steps with default names', () => {
      const steps = [{}, {}]; // No names provided
      
      const multiStep = new MultiStepProgress(steps);
      
      expect(multiStep.steps[0].name).toBe('Step 1');
      expect(multiStep.steps[1].name).toBe('Step 2');
    });
  });

  describe('step management', () => {
    let multiStep;

    beforeEach(() => {
      const steps = [
        { name: 'Initialize', description: 'Setting up' },
        { name: 'Process', description: 'Processing data' },
        { name: 'Finalize', description: 'Cleaning up' }
      ];
      multiStep = new MultiStepProgress(steps);
    });

    test('should start a step', () => {
      const startSpy = jest.fn();
      multiStep.on('stepStart', startSpy);
      
      multiStep.startStep(0, 'Starting initialization');
      
      expect(multiStep.steps[0].status).toBe('running');
      expect(multiStep.steps[0].startTime).toBeDefined();
      expect(multiStep.steps[0].description).toBe('Starting initialization');
      expect(startSpy).toHaveBeenCalled();
    });

    test('should complete a step', () => {
      const completeSpy = jest.fn();
      multiStep.on('stepComplete', completeSpy);
      
      multiStep.startStep(0);
      multiStep.completeStep(0, 'Initialization complete');
      
      expect(multiStep.steps[0].status).toBe('completed');
      expect(multiStep.steps[0].endTime).toBeDefined();
      expect(multiStep.steps[0].progress).toBe(100);
      expect(multiStep.currentStepIndex).toBe(1); // Auto-advanced
      expect(completeSpy).toHaveBeenCalled();
    });

    test('should fail a step', () => {
      const failSpy = jest.fn();
      multiStep.on('stepFail', failSpy);
      
      const error = new Error('Step failed');
      multiStep.startStep(0);
      multiStep.failStep(0, error, 'Initialization failed');
      
      expect(multiStep.steps[0].status).toBe('failed');
      expect(multiStep.steps[0].error).toBe(error);
      expect(multiStep.steps[0].description).toBe('Initialization failed');
      expect(failSpy).toHaveBeenCalledWith(
        expect.objectContaining({ error })
      );
    });

    test('should skip a step', () => {
      const skipSpy = jest.fn();
      multiStep.on('stepSkip', skipSpy);
      
      multiStep.skipStep(0, 'Not needed');
      
      expect(multiStep.steps[0].status).toBe('skipped');
      expect(multiStep.steps[0].description).toBe('Not needed');
      expect(multiStep.currentStepIndex).toBe(1); // Auto-advanced
      expect(skipSpy).toHaveBeenCalled();
    });

    test('should update step progress', () => {
      const progressSpy = jest.fn();
      multiStep.on('stepProgress', progressSpy);
      
      multiStep.startStep(0);
      multiStep.updateStepProgress(0, 75, 'Almost done');
      
      expect(multiStep.steps[0].progress).toBe(75);
      expect(multiStep.steps[0].description).toBe('Almost done');
      expect(progressSpy).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 75 })
      );
    });

    test('should clamp progress between 0 and 100', () => {
      multiStep.startStep(0);
      
      multiStep.updateStepProgress(0, -10);
      expect(multiStep.steps[0].progress).toBe(0);
      
      multiStep.updateStepProgress(0, 150);
      expect(multiStep.steps[0].progress).toBe(100);
    });
  });

  describe('completion detection', () => {
    test('should detect when all steps are completed', () => {
      const steps = [{ name: 'Step 1' }, { name: 'Step 2' }];
      const multiStep = new MultiStepProgress(steps);
      
      const allCompleteSpy = jest.fn();
      multiStep.on('allComplete', allCompleteSpy);
      
      multiStep.completeStep(0);
      expect(allCompleteSpy).not.toHaveBeenCalled();
      
      multiStep.completeStep(1);
      expect(allCompleteSpy).toHaveBeenCalled();
    });

    test('should consider skipped steps as completed', () => {
      const steps = [{ name: 'Step 1' }, { name: 'Step 2' }];
      const multiStep = new MultiStepProgress(steps);
      
      multiStep.completeStep(0);
      multiStep.skipStep(1);
      
      expect(multiStep.isAllCompleted()).toBe(true);
    });

    test('should get completed count', () => {
      const steps = [{ name: 'Step 1' }, { name: 'Step 2' }, { name: 'Step 3' }];
      const multiStep = new MultiStepProgress(steps);
      
      expect(multiStep.getCompletedCount()).toBe(0);
      
      multiStep.completeStep(0);
      expect(multiStep.getCompletedCount()).toBe(1);
      
      multiStep.skipStep(1);
      expect(multiStep.getCompletedCount()).toBe(2);
    });
  });

  describe('summary and reporting', () => {
    test('should generate summary', () => {
      const steps = [
        { name: 'Step 1' },
        { name: 'Step 2' },
        { name: 'Step 3' },
        { name: 'Step 4' }
      ];
      const multiStep = new MultiStepProgress(steps);
      
      multiStep.completeStep(0);
      multiStep.failStep(1, new Error('Failed'));
      multiStep.skipStep(2);
      // Step 3 remains pending
      
      const summary = multiStep.getSummary();
      
      expect(summary.total).toBe(4);
      expect(summary.completed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.pending).toBe(1);
    });

    test('should get step icon for different statuses', () => {
      const multiStep = new MultiStepProgress([]);
      
      expect(multiStep.getStepIcon('pending')).toBeDefined();
      expect(multiStep.getStepIcon('running')).toBeDefined();
      expect(multiStep.getStepIcon('completed')).toBeDefined();
      expect(multiStep.getStepIcon('failed')).toBeDefined();
      expect(multiStep.getStepIcon('skipped')).toBeDefined();
    });

    test('should calculate step elapsed time', () => {
      const multiStep = new MultiStepProgress([]);
      const step = {
        startTime: Date.now() - 5000,
        endTime: Date.now()
      };
      
      const elapsed = multiStep.getStepElapsed(step);
      
      expect(elapsed).toBe('5s');
    });

    test('should create progress bar', () => {
      const multiStep = new MultiStepProgress([]);
      
      const progressBar = multiStep.createProgressBar(50);
      
      expect(progressBar).toContain('[');
      expect(progressBar).toContain(']');
      expect(progressBar).toContain('50%');
    });
  });

  describe('rendering', () => {
    test('should render steps', () => {
      const steps = [{ name: 'Step 1' }, { name: 'Step 2' }];
      const multiStep = new MultiStepProgress(steps);
      
      multiStep.renderSteps();
      
      expect(mockConsole.clear).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Progress: 0/2 steps completed')
      );
    });

    test('should start multi-step progress', () => {
      const steps = [{ name: 'Step 1' }, { name: 'Step 2' }];
      const multiStep = new MultiStepProgress(steps);
      
      multiStep.start();
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting 2 step process')
      );
    });
  });
});

describe('ProgressUtils', () => {
  test('should create spinner', () => {
    const spinner = ProgressUtils.spinner('Loading data');
    
    expect(spinner).toBeInstanceOf(ProgressIndicator);
    expect(spinner.options.type).toBe('spinner');
    expect(spinner.options.text).toBe('Loading data');
  });

  test('should create progress bar', () => {
    const progressBar = ProgressUtils.progressBar('Processing files', 50);
    
    expect(progressBar).toBeInstanceOf(ProgressIndicator);
    expect(progressBar.options.type).toBe('progress');
    expect(progressBar.options.text).toBe('Processing files');
    expect(progressBar.options.total).toBe(50);
  });

  test('should create step progress', () => {
    const steps = ProgressUtils.steps('Running steps', 10);
    
    expect(steps).toBeInstanceOf(ProgressIndicator);
    expect(steps.options.type).toBe('steps');
    expect(steps.options.text).toBe('Running steps');
    expect(steps.options.total).toBe(10);
  });

  test('should create multi-step progress', () => {
    const stepDefs = [{ name: 'Step 1' }, { name: 'Step 2' }];
    const multiStep = ProgressUtils.multiStep(stepDefs);
    
    expect(multiStep).toBeInstanceOf(MultiStepProgress);
    expect(multiStep.steps).toHaveLength(2);
  });
});