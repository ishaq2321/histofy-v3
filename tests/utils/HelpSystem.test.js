/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * HelpSystem Tests
 */

const HelpSystem = require('../../src/utils/HelpSystem');
const chalk = require('chalk');

// Mock chalk to avoid ANSI codes in tests
jest.mock('chalk', () => ({
  blue: jest.fn(msg => msg),
  red: jest.fn(msg => msg),
  green: jest.fn(msg => msg),
  yellow: jest.fn(msg => msg),
  gray: jest.fn(msg => msg),
  bold: jest.fn(msg => msg)
}));

describe('HelpSystem', () => {
  let helpSystem;
  let consoleSpy;

  beforeEach(() => {
    helpSystem = new HelpSystem();
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation()
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
  });

  describe('constructor', () => {
    test('should initialize with examples, tutorials, and contextual help', () => {
      expect(helpSystem.examples).toBeInstanceOf(Map);
      expect(helpSystem.tutorials).toBeInstanceOf(Map);
      expect(helpSystem.contextualHelp).toBeInstanceOf(Map);
      
      // Check that examples are loaded
      expect(helpSystem.examples.has('commit')).toBe(true);
      expect(helpSystem.examples.has('status')).toBe(true);
      expect(helpSystem.examples.has('config')).toBe(true);
    });
  });

  describe('showExamples', () => {
    test('should show examples for valid command', () => {
      helpSystem.showExamples('commit');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("📚 Examples for 'commit' command:")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Basic commit with custom date')
      );
    });

    test('should show error for unknown command', () => {
      helpSystem.showExamples('unknown');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No examples available for command: unknown')
      );
    });

    test('should include dry-run tip', () => {
      helpSystem.showExamples('commit');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('💡 Tip: Use --dry-run')
      );
    });
  });

  describe('showTutorial', () => {
    test('should show tutorial for valid tutorial name', async () => {
      await helpSystem.showTutorial('getting-started');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🎓 Getting Started with Histofy')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Step 1: Initialize Configuration')
      );
    });

    test('should handle unknown tutorial', async () => {
      await helpSystem.showTutorial('unknown-tutorial');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Tutorial 'unknown-tutorial' not found.")
      );
    });

    test('should show completion message', async () => {
      await helpSystem.showTutorial('getting-started');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Tutorial completed!')
      );
    });
  });

  describe('listTutorials', () => {
    test('should list all available tutorials', () => {
      helpSystem.listTutorials();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🎓 Available Tutorials:')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('getting-started')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('batch-operations')
      );
    });
  });

  describe('provideContextualHelp', () => {
    test('should provide help for git repository error', () => {
      helpSystem.provideContextualHelp('not a git repository');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error: not a git repository')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('💡 Suggestion: Initialize a Git repository first')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('git init')
      );
    });

    test('should provide help for configuration error', () => {
      helpSystem.provideContextualHelp('configuration file not found');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Initialize Histofy configuration')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('histofy config init')
      );
    });

    test('should provide help for GitHub token error', () => {
      helpSystem.provideContextualHelp('invalid GitHub token');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Update your GitHub personal access token')
      );
    });

    test('should provide help for date format error', () => {
      helpSystem.provideContextualHelp('invalid date format');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Use YYYY-MM-DD format for dates')
      );
    });

    test('should provide generic help for unknown errors', () => {
      helpSystem.provideContextualHelp('some unknown error');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('💡 General troubleshooting steps:')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Check your current directory')
      );
    });
  });

  describe('findErrorKey', () => {
    test('should find correct error key for git repository error', () => {
      const key = helpSystem.findErrorKey('not a git repository');
      expect(key).toBe('not_a_git_repository');
    });

    test('should find correct error key for config error', () => {
      const key = helpSystem.findErrorKey('config file not found');
      expect(key).toBe('config_not_found');
    });

    test('should find correct error key for GitHub token error', () => {
      const key = helpSystem.findErrorKey('GitHub token invalid');
      expect(key).toBe('invalid_github_token');
    });

    test('should return null for unknown error', () => {
      const key = helpSystem.findErrorKey('completely unknown error');
      expect(key).toBeNull();
    });
  });

  describe('showCommandHelp', () => {
    test('should show command help with description and usage', () => {
      const mockCommand = {
        name: () => 'test-command',
        description: () => 'Test command description',
        usage: () => 'test-command [options]',
        options: [
          { flags: '-t, --test', description: 'Test option' }
        ]
      };

      helpSystem.showCommandHelp(mockCommand);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("📖 Help for 'test-command' command")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Test command description')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('test-command [options]')
      );
    });
  });

  describe('showMainHelp', () => {
    test('should show main help with command overview', () => {
      helpSystem.showMainHelp();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📖 Histofy Help System')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Available Commands:')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('commit')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Getting Help:')
      );
    });
  });

  describe('examples content', () => {
    test('should have comprehensive commit examples', () => {
      const commitExamples = helpSystem.examples.get('commit');
      
      expect(commitExamples).toBeDefined();
      expect(commitExamples.length).toBeGreaterThan(0);
      
      // Check for specific examples
      const basicExample = commitExamples.find(ex => ex.title.includes('Basic commit'));
      expect(basicExample).toBeDefined();
      expect(basicExample.command).toContain('histofy commit');
      expect(basicExample.command).toContain('--date');
    });

    test('should have performance command examples', () => {
      const perfExamples = helpSystem.examples.get('performance');
      
      expect(perfExamples).toBeDefined();
      expect(perfExamples.length).toBeGreaterThan(0);
      
      const enableExample = perfExamples.find(ex => ex.title.includes('Enable'));
      expect(enableExample).toBeDefined();
      expect(enableExample.command).toContain('--enable');
    });
  });

  describe('tutorials content', () => {
    test('should have getting started tutorial', () => {
      const tutorial = helpSystem.tutorials.get('getting-started');
      
      expect(tutorial).toBeDefined();
      expect(tutorial.title).toBe('Getting Started with Histofy');
      expect(tutorial.steps).toBeDefined();
      expect(tutorial.steps.length).toBeGreaterThan(0);
      
      const firstStep = tutorial.steps[0];
      expect(firstStep.title).toContain('Initialize Configuration');
      expect(firstStep.command).toContain('histofy config init');
    });

    test('should have batch operations tutorial', () => {
      const tutorial = helpSystem.tutorials.get('batch-operations');
      
      expect(tutorial).toBeDefined();
      expect(tutorial.title).toBe('Batch Operations Tutorial');
      expect(tutorial.steps).toBeDefined();
      expect(tutorial.steps.length).toBeGreaterThan(0);
    });
  });

  describe('contextual help content', () => {
    test('should have comprehensive error mappings', () => {
      expect(helpSystem.contextualHelp.has('not_a_git_repository')).toBe(true);
      expect(helpSystem.contextualHelp.has('config_not_found')).toBe(true);
      expect(helpSystem.contextualHelp.has('invalid_github_token')).toBe(true);
      expect(helpSystem.contextualHelp.has('invalid_date_format')).toBe(true);
      expect(helpSystem.contextualHelp.has('file_not_found')).toBe(true);
    });

    test('should have proper help structure', () => {
      const gitHelp = helpSystem.contextualHelp.get('not_a_git_repository');
      
      expect(gitHelp.error).toBeDefined();
      expect(gitHelp.suggestion).toBeDefined();
      expect(gitHelp.commands).toBeDefined();
      expect(gitHelp.explanation).toBeDefined();
      expect(Array.isArray(gitHelp.commands)).toBe(true);
    });
  });
});