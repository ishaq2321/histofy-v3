/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Original creation date: 2025-06-09
 * Repository: https://github.com/ishaq2321/histofy-v3
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const Table = require('cli-table3');
const moment = require('moment');
const ConfigManager = require('../config/ConfigManager');

const configManager = new ConfigManager();

/**
 * Pattern management commands
 */
const patternCommand = {

  /**
   * List available patterns
   */
  async list() {
    try {
      console.log(chalk.blue('🎨 Available Patterns\n'));
      
      const result = await configManager.listPatterns();
      
      if (result.success && result.patterns.length > 0) {
        const table = new Table({
          head: ['Name', 'Status'],
          colWidths: [30, 20],
          style: { head: ['cyan'] }
        });

        for (const patternName of result.patterns) {
          const patternResult = await configManager.loadPattern(patternName);
          let status = chalk.red('Invalid');
          
          if (patternResult.success) {
            const commits = patternResult.pattern.commits || [];
            status = chalk.green(`${commits.length} commits`);
          }
          
          table.push([patternName, status]);
        }
        
        console.log(table.toString());
        console.log(chalk.gray(`\nFound ${result.patterns.length} pattern(s)`));
        
      } else {
        console.log(chalk.gray('No patterns found'));
        console.log(chalk.blue('💡 Create a new pattern with: histofy pattern create <name>'));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * Create a new pattern
   */
  async create(name, options) {
    try {
      console.log(chalk.blue(`🎨 Creating Pattern: ${name}\n`));

      // Check if pattern already exists
      const existing = await configManager.loadPattern(name);
      if (existing.success) {
        const overwrite = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Pattern already exists. Overwrite?',
            default: false
          }
        ]);
        
        if (!overwrite.overwrite) {
          console.log(chalk.gray('Pattern creation cancelled'));
          return;
        }
      }

      let pattern = {};

      if (options.template) {
        // Use template
        pattern = await this.getTemplate(options.template);
      } else {
        // Interactive creation
        pattern = await this.createInteractivePattern();
      }

      // Save pattern
      const result = await configManager.savePattern(name, pattern);
      
      if (result.success) {
        console.log(chalk.green(`✅ Pattern '${name}' created successfully`));
        console.log(chalk.gray(`   File: ${result.file}`));
        console.log(chalk.blue('\n💡 Preview your pattern with: histofy pattern preview ' + name));
      } else {
        console.error(chalk.red(`❌ Failed to save pattern: ${result.error}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * Edit an existing pattern
   */
  async edit(name) {
    try {
      console.log(chalk.blue(`✏️  Editing Pattern: ${name}\n`));
      
      const result = await configManager.loadPattern(name);
      if (!result.success) {
        console.error(chalk.red(`❌ Pattern not found: ${name}`));
        return;
      }

      console.log(chalk.yellow('Current pattern structure:'));
      console.log(JSON.stringify(result.pattern, null, 2));
      console.log();

      const response = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'edit',
          message: 'Open pattern file in default editor?',
          default: true
        }
      ]);

      if (response.edit) {
        const paths = configManager.getPaths();
        const patternFile = `${paths.patternsDir}/${name}.yaml`;
        
        console.log(chalk.blue(`📝 Opening: ${patternFile}`));
        console.log(chalk.gray('Edit the file and save it when done.'));
        
        // In a real implementation, this would open the default editor
        // For now, we just show the file path
        console.log(chalk.yellow('\n💡 Use your favorite editor to modify the pattern file'));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * Delete a pattern
   */
  async delete(name) {
    try {
      console.log(chalk.blue(`🗑️  Deleting Pattern: ${name}\n`));
      
      const result = await configManager.loadPattern(name);
      if (!result.success) {
        console.error(chalk.red(`❌ Pattern not found: ${name}`));
        return;
      }

      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'delete',
          message: `Are you sure you want to delete pattern '${name}'?`,
          default: false
        }
      ]);

      if (confirm.delete) {
        const deleteResult = await configManager.deletePattern(name);
        
        if (deleteResult.success) {
          console.log(chalk.green(`✅ Pattern '${name}' deleted successfully`));
        } else {
          console.error(chalk.red(`❌ Failed to delete pattern: ${deleteResult.error}`));
        }
      } else {
        console.log(chalk.gray('Pattern deletion cancelled'));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * Preview a pattern
   */
  async preview(name, options) {
    try {
      console.log(chalk.blue(`🔍 Pattern Preview: ${name}\n`));
      
      const result = await configManager.loadPattern(name);
      if (!result.success) {
        console.error(chalk.red(`❌ Pattern not found: ${name}`));
        return;
      }

      const pattern = result.pattern;
      const year = parseInt(options.year);

      console.log(chalk.green('📋 Pattern Information:'));
      console.log(`   Name: ${chalk.yellow(name)}`);
      console.log(`   Description: ${pattern.description || chalk.gray('No description')}`);
      console.log(`   Total commits: ${chalk.cyan(pattern.commits?.length || 0)}`);
      
      if (pattern.commits && pattern.commits.length > 0) {
        const dates = pattern.commits.map(c => moment(c.date));
        const startDate = moment.min(dates).format('YYYY-MM-DD');
        const endDate = moment.max(dates).format('YYYY-MM-DD');
        console.log(`   Date range: ${chalk.yellow(startDate)} to ${chalk.yellow(endDate)}`);
      }
      console.log();

      // Display commit timeline
      if (pattern.commits && pattern.commits.length > 0) {
        console.log(chalk.green('📅 Commit Timeline:'));
        
        const sortedCommits = pattern.commits
          .sort((a, b) => moment(a.date).diff(moment(b.date)))
          .slice(0, 20); // Show first 20 commits

        const table = new Table({
          head: ['Date', 'Time', 'Message'],
          colWidths: [12, 8, 50],
          style: { head: ['cyan'] }
        });

        sortedCommits.forEach(commit => {
          table.push([
            moment(commit.date).format('YYYY-MM-DD'),
            commit.time || '12:00',
            commit.message.length > 45 ? commit.message.substring(0, 45) + '...' : commit.message
          ]);
        });

        console.log(table.toString());
        
        if (pattern.commits.length > 20) {
          console.log(chalk.gray(`   ... and ${pattern.commits.length - 20} more commits`));
        }
      }

      // ASCII calendar preview for the year
      if (pattern.commits && pattern.commits.length > 0) {
        console.log(chalk.green(`\n📊 ${year} Contribution Calendar Preview:`));
        this.displayCalendarPreview(pattern.commits, year);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  },

  /**
   * Create interactive pattern
   */
  async createInteractivePattern() {
    const responses = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Pattern description:'
      },
      {
        type: 'list',
        name: 'type',
        message: 'Pattern type:',
        choices: [
          'Custom (define manually)',
          'Daily commits for a period',
          'Weekly pattern',
          'Specific dates only'
        ]
      }
    ]);

    let commits = [];

    switch (responses.type) {
      case 'Daily commits for a period':
        commits = await this.createDailyPattern();
        break;
      case 'Weekly pattern':
        commits = await this.createWeeklyPattern();
        break;
      case 'Specific dates only':
        commits = await this.createSpecificDatesPattern();
        break;
      default:
        commits = await this.createCustomPattern();
    }

    return {
      description: responses.description,
      type: responses.type,
      created: new Date().toISOString(),
      commits
    };
  },

  /**
   * Create daily pattern
   */
  async createDailyPattern() {
    const responses = await inquirer.prompt([
      {
        type: 'input',
        name: 'startDate',
        message: 'Start date (YYYY-MM-DD):',
        validate: input => moment(input, 'YYYY-MM-DD', true).isValid() || 'Invalid date format'
      },
      {
        type: 'input',
        name: 'endDate',
        message: 'End date (YYYY-MM-DD):',
        validate: input => moment(input, 'YYYY-MM-DD', true).isValid() || 'Invalid date format'
      },
      {
        type: 'input',
        name: 'commitsPerDay',
        message: 'Commits per day:',
        default: '1',
        validate: input => parseInt(input) > 0 || 'Must be a positive number'
      }
    ]);

    const commits = [];
    const start = moment(responses.startDate);
    const end = moment(responses.endDate);
    const commitsPerDay = parseInt(responses.commitsPerDay);

    for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'day')) {
      for (let i = 0; i < commitsPerDay; i++) {
        const hour = 9 + (i * 2); // Spread commits throughout the day
        commits.push({
          date: date.format('YYYY-MM-DD'),
          time: `${hour.toString().padStart(2, '0')}:00`,
          message: `Daily work - ${date.format('MMM DD')} (${i + 1}/${commitsPerDay})`
        });
      }
    }

    return commits;
  },

  /**
   * Create weekly pattern
   */
  async createWeeklyPattern() {
    const responses = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'days',
        message: 'Select days of the week:',
        choices: [
          { name: 'Monday', value: 1 },
          { name: 'Tuesday', value: 2 },
          { name: 'Wednesday', value: 3 },
          { name: 'Thursday', value: 4 },
          { name: 'Friday', value: 5 },
          { name: 'Saturday', value: 6 },
          { name: 'Sunday', value: 0 }
        ]
      },
      {
        type: 'input',
        name: 'weeks',
        message: 'Number of weeks:',
        default: '4',
        validate: input => parseInt(input) > 0 || 'Must be a positive number'
      }
    ]);

    const commits = [];
    const weeks = parseInt(responses.weeks);
    const today = moment();

    for (let week = 0; week < weeks; week++) {
      responses.days.forEach(day => {
        const date = today.clone().add(week, 'weeks').day(day);
        commits.push({
          date: date.format('YYYY-MM-DD'),
          time: '10:00',
          message: `Weekly work - ${date.format('dddd, MMM DD')}`
        });
      });
    }

    return commits.sort((a, b) => moment(a.date).diff(moment(b.date)));
  },

  /**
   * Create specific dates pattern
   */
  async createSpecificDatesPattern() {
    console.log(chalk.yellow('Enter dates one by one (press Enter with empty input to finish):'));
    
    const commits = [];
    let dateInput = '';
    
    do {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'date',
          message: `Date ${commits.length + 1} (YYYY-MM-DD) or Enter to finish:`,
          validate: input => !input || moment(input, 'YYYY-MM-DD', true).isValid() || 'Invalid date format'
        }
      ]);
      
      dateInput = response.date;
      
      if (dateInput) {
        const messageResponse = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: 'Commit message:',
            default: `Work on ${moment(dateInput).format('MMM DD')}`
          }
        ]);
        
        commits.push({
          date: dateInput,
          time: '12:00',
          message: messageResponse.message
        });
      }
    } while (dateInput);

    return commits.sort((a, b) => moment(a.date).diff(moment(b.date)));
  },

  /**
   * Create custom pattern
   */
  async createCustomPattern() {
    console.log(chalk.yellow('Custom pattern creation - add commits manually'));
    console.log(chalk.gray('You can edit the pattern file later for more complex configurations'));
    
    return [{
      date: moment().format('YYYY-MM-DD'),
      time: '12:00',
      message: 'Initial commit from Histofy pattern'
    }];
  },

  /**
   * Get template pattern
   */
  async getTemplate(templateName) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const yaml = require('yaml');
      
      // Try to load from templates directory
      const templatesDir = path.join(__dirname, '../../templates');
      const templateFile = path.join(templatesDir, `${templateName}.yaml`);
      
      try {
        const templateData = await fs.readFile(templateFile, 'utf8');
        const template = yaml.parse(templateData);
        console.log(chalk.green(`✅ Loaded template: ${templateName}`));
        return template;
      } catch (fileError) {
        console.log(chalk.yellow(`⚠️  Template file not found: ${templateName}, using fallback`));
        
        // Fallback templates if file doesn't exist
        const fallbackTemplates = {
          'hello-world': {
            description: 'Simple hello world pattern',
            type: 'Template',
            created: new Date().toISOString(),
            commits: [
              { date: moment().format('YYYY-MM-DD'), time: '09:00', message: 'Initial commit' },
              { date: moment().add(1, 'day').format('YYYY-MM-DD'), time: '10:00', message: 'Add hello world' },
              { date: moment().add(2, 'days').format('YYYY-MM-DD'), time: '11:00', message: 'Update documentation' }
            ]
          },
          'daily-contributor': {
            description: 'Daily contributor pattern',
            type: 'Template', 
            created: new Date().toISOString(),
            commits: Array.from({ length: 7 }, (_, i) => ({
              date: moment().add(i, 'days').format('YYYY-MM-DD'),
              time: '10:00',
              message: `Daily work - Day ${i + 1}`
            }))
          },
          'github-streak': {
            description: 'GitHub streak pattern',
            type: 'Template',
            created: new Date().toISOString(), 
            commits: Array.from({ length: 30 }, (_, i) => ({
              date: moment().add(i, 'days').format('YYYY-MM-DD'),
              time: '12:00',
              message: `Streak day ${i + 1}`
            }))
          }
        };

        return fallbackTemplates[templateName] || fallbackTemplates['hello-world'];
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error loading template: ${error.message}`));
      
      // Return basic fallback
      return {
        description: 'Default pattern',
        type: 'Template',
        created: new Date().toISOString(),
        commits: [
          { date: moment().format('YYYY-MM-DD'), time: '12:00', message: 'Default commit' }
        ]
      };
    }
  },

  /**
   * Display calendar preview
   */
  displayCalendarPreview(commits, year) {
    // Simple month-by-month preview
    const commitsByDate = {};
    commits.forEach(commit => {
      const date = moment(commit.date);
      if (date.year() === year) {
        commitsByDate[date.format('YYYY-MM-DD')] = (commitsByDate[date.format('YYYY-MM-DD')] || 0) + 1;
      }
    });

    const months = moment.months();
    
    months.forEach((month, index) => {
      const monthStart = moment({ year, month: index });
      const daysInMonth = monthStart.daysInMonth();
      let monthCommits = 0;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = moment({ year, month: index, day }).format('YYYY-MM-DD');
        if (commitsByDate[date]) {
          monthCommits += commitsByDate[date];
        }
      }
      
      if (monthCommits > 0) {
        const bar = '█'.repeat(Math.min(monthCommits, 20));
        console.log(`   ${month.padEnd(9)} ${chalk.green(bar)} ${monthCommits}`);
      }
    });
  }
};

module.exports = patternCommand;
