/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// Test configuration
describe('Histofy v3 Core Tests', () => {
  describe('Basic Dependencies', () => {
    test('should load chalk', () => {
      const chalk = require('chalk');
      expect(chalk).toBeDefined();
      expect(typeof chalk.red).toBe('function');
    });

    test('should load commander', () => {
      const { Command } = require('commander');
      expect(Command).toBeDefined();
      expect(typeof Command).toBe('function');
    });

    test('should load inquirer', () => {
      const inquirer = require('inquirer');
      expect(inquirer).toBeDefined();
      expect(typeof inquirer.prompt).toBe('function');
    });

    test('should load moment', () => {
      const moment = require('moment');
      expect(moment).toBeDefined();
      expect(typeof moment).toBe('function');
    });
  });

  describe('Package Configuration', () => {
    test('should load package.json', () => {
      const packageJson = require('../package.json');
      expect(packageJson).toBeDefined();
      expect(packageJson.name).toBe('histofy-cli');
      expect(packageJson.version).toBe('3.0.0');
    });
  });
});
