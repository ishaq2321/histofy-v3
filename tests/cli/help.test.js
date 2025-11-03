/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Help CLI Command Tests
 */

const helpCommand = require('../../src/cli/help');
const HelpSystem = require('../../src/utils/HelpSystem');

// Mock HelpSystem
jest.mock('../../src/utils/HelpSystem');

describe('Help CLI Command', () => {
  let mockHelpSystem;
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup console spy
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };

    // Setup HelpSystem mock
    mockHelpSystem = {
      showMainHelp: jest.fn(),
      showExamples: jest.fn(),
      showTutorial: jest.fn(),
      listTutorials: jest.fn(),
      showCommandHelp: jest.fn(),
      provideContextualHelp: jest.fn()
    };

    HelpSystem.mockImplementation(() => mockHelpSystem);
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('command configuration', () => {
    test('should have correct command name', () => {
      expect(helpCommand.name()).toBe('help');
    });

    test('should have correct description', () => {
      expect(helpCommand.description()).toBe('Show help information and tutorials');
    });

    test('should accept topic and subtopic arguments', () => {
      const args = helpCommand.args;
      expect(args).toHaveLength(2);
      expect(args[0].name()).toBe('topic');
      expect(args[1].name()).toBe('subtopic');
    });
  });

  describe('main help functionality', () => {
    test('should show main help when no topic provided', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction();

      expect(mockHelpSystem.showMainHelp).toHaveBeenCalled();
    });
  });

  describe('examples functionality', () => {
    test('should show examples for specific command', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('examples', 'commit');

      expect(mockHelpSystem.showExamples).toHaveBeenCalledWith('commit');
    });

    test('should show error when no command specified for examples', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('examples');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Please specify a command name for examples.')
      );
      expect(mockHelpSystem.showExamples).not.toHaveBeenCalled();
    });
  });

  describe('tutorial functionality', () => {
    test('should show specific tutorial', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('tutorial', 'getting-started');

      expect(mockHelpSystem.showTutorial).toHaveBeenCalledWith('getting-started');
    });

    test('should list tutorials when no tutorial name specified', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('tutorial');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Please specify a tutorial name.')
      );
      expect(mockHelpSystem.listTutorials).toHaveBeenCalled();
    });

    test('should list all tutorials', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('tutorials');

      expect(mockHelpSystem.listTutorials).toHaveBeenCalled();
    });
  });

  describe('troubleshooting functionality', () => {
    test('should show troubleshooting guide', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('troubleshooting');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Troubleshooting Guide')
      );
    });
  });

  describe('FAQ functionality', () => {
    test('should show FAQ', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('faq');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('❓ Frequently Asked Questions')
      );
    });
  });

  describe('command-specific help', () => {
    test('should show help for valid command', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('commit');

      expect(mockHelpSystem.showCommandHelp).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(Function),
          description: expect.any(Function),
          usage: expect.any(Function)
        })
      );
    });

    test('should handle unknown command gracefully', async () => {
      const mockAction = helpCommand._actionHandler;
      
      await mockAction('unknown-command');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Unknown help topic: unknown-command')
      );
      expect(mockHelpSystem.showMainHelp).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should handle errors gracefully', async () => {
      mockHelpSystem.showMainHelp.mockImplementation(() => {
        throw new Error('Help system error');
      });

      const mockAction = helpCommand._actionHandler;
      
      await mockAction();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error showing help:'),
        'Help system error'
      );
      expect(mockHelpSystem.provideContextualHelp).toHaveBeenCalledWith('Help system error');
    });
  });
});