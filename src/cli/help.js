/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Help CLI Command - Enhanced help and tutorial system
 */

const { Command } = require('commander');
const chalk = require('chalk');
const HelpSystem = require('../utils/HelpSystem');

const helpSystem = new HelpSystem();

const helpCommand = new Command('help')
  .description('Show help information and tutorials')
  .argument('[topic]', 'Help topic (command name, "examples", "tutorial", "tutorials")')
  .argument('[subtopic]', 'Subtopic (command name for examples, tutorial name for tutorial)')
  .action(async (topic, subtopic) => {
    try {
      if (!topic) {
        // Show main help
        helpSystem.showMainHelp();
        return;
      }

      // Handle special topics
      switch (topic.toLowerCase()) {
        case 'examples':
          if (!subtopic) {
            console.log(chalk.yellow('Please specify a command name for examples.'));
            console.log(chalk.gray('Usage: histofy help examples <command>'));
            console.log(chalk.gray('Available commands: commit, status, config, migrate, batch, analyze, performance\\n'));
            return;
          }
          helpSystem.showExamples(subtopic);
          break;

        case 'tutorial':
          if (!subtopic) {
            console.log(chalk.yellow('Please specify a tutorial name.'));
            helpSystem.listTutorials();
            return;
          }
          await helpSystem.showTutorial(subtopic);
          break;

        case 'tutorials':
          helpSystem.listTutorials();
          break;

        case 'troubleshooting':
          showTroubleshootingGuide();
          break;

        case 'faq':
          showFAQ();
          break;

        default:
          // Try to show help for a specific command
          const commandHelp = getCommandHelp(topic);
          if (commandHelp) {
            helpSystem.showCommandHelp(commandHelp);
          } else {
            console.log(chalk.yellow(`Unknown help topic: ${topic}`));
            console.log(chalk.gray('Available topics: examples, tutorial, tutorials, troubleshooting, faq'));
            console.log(chalk.gray('Available commands: commit, status, config, migrate, batch, analyze, performance\\n'));
            helpSystem.showMainHelp();
          }
          break;
      }
    } catch (error) {
      console.error(chalk.red('Error showing help:'), error.message);
      helpSystem.provideContextualHelp(error.message);
    }
  });

/**
 * Get command help object for a command name
 */
function getCommandHelp(commandName) {
  // This would ideally get the actual command objects from the main program
  // For now, we'll create mock command objects with the essential info
  const commands = {
    commit: {
      name: () => 'commit',
      description: () => 'Create commits with custom dates and metadata',
      usage: () => 'commit [message] [options]',
      options: [
        { flags: '-d, --date <date>', description: 'Custom date (YYYY-MM-DD)' },
        { flags: '-t, --time <time>', description: 'Custom time (HH:MM)' },
        { flags: '-a, --add-all', description: 'Add all changes before committing' },
        { flags: '--author <author>', description: 'Custom author (Name <email>)' },
        { flags: '--push', description: 'Push after committing' },
        { flags: '--dry-run', description: 'Preview what would be done without executing' }
      ]
    },
    status: {
      name: () => 'status',
      description: () => 'Show repository status and health information',
      usage: () => 'status [options]',
      options: [
        { flags: '-r, --remote', description: 'Include remote information' }
      ]
    },
    config: {
      name: () => 'config',
      description: () => 'Manage Histofy configuration settings',
      usage: () => 'config [action] [key] [value] [options]',
      options: [
        { flags: '--dry-run', description: 'Preview configuration changes without applying them' }
      ]
    },
    migrate: {
      name: () => 'migrate',
      description: () => 'Migrate existing commits to new dates',
      usage: () => 'migrate <range> [options]',
      options: [
        { flags: '-d, --to-date <date>', description: 'Target date (YYYY-MM-DD)' },
        { flags: '-t, --time-offset <offset>', description: 'Time offset for commits' },
        { flags: '--force', description: 'Force migration even with conflicts' },
        { flags: '--dry-run', description: 'Preview migration without executing' }
      ]
    },
    batch: {
      name: () => 'batch',
      description: () => 'Perform bulk operations on multiple commits',
      usage: () => 'batch <action> [options]',
      options: [
        { flags: '-i, --input <file>', description: 'Input data file (CSV or JSON)' },
        { flags: '-o, --output <file>', description: 'Output file path' },
        { flags: '-t, --template <file>', description: 'Commit template file' },
        { flags: '--dry-run', description: 'Preview batch operations without executing' },
        { flags: '--continue-on-error', description: 'Continue processing despite errors' }
      ]
    },
    analyze: {
      name: () => 'analyze',
      description: () => 'Analyze repository patterns and statistics',
      usage: () => 'analyze [options]',
      options: [
        { flags: '--authors', description: 'Analyze contributions by author' },
        { flags: '--temporal', description: 'Show temporal analysis' },
        { flags: '--charts', description: 'Generate visual charts' },
        { flags: '--export <file>', description: 'Export analysis results' }
      ]
    },
    performance: {
      name: () => 'performance',
      description: () => 'Monitor and analyze performance metrics',
      usage: () => 'performance [options]',
      options: [
        { flags: '-e, --enable', description: 'Enable performance monitoring' },
        { flags: '-d, --disable', description: 'Disable performance monitoring' },
        { flags: '-s, --summary', description: 'Show performance summary' },
        { flags: '-r, --report', description: 'Generate detailed performance report' },
        { flags: '--export <format>', description: 'Export performance data' }
      ]
    }
  };

  return commands[commandName.toLowerCase()];
}

/**
 * Show troubleshooting guide
 */
function showTroubleshootingGuide() {
  console.log(chalk.blue('\\n🔧 Troubleshooting Guide\\n'));
  
  console.log(chalk.bold('Common Issues and Solutions:\\n'));
  
  console.log(chalk.yellow('1. "Not a git repository" error'));
  console.log('   • Make sure you\\'re in a Git repository directory');
  console.log('   • Run: git init (to initialize a new repository)');
  console.log('   • Run: git status (to verify Git repository)\\n');
  
  console.log(chalk.yellow('2. "Configuration file not found" error'));
  console.log('   • Run: histofy config init');
  console.log('   • Check: ~/.histofy.yml exists');
  console.log('   • Verify: file permissions are correct\\n');
  
  console.log(chalk.yellow('3. "GitHub token invalid" error'));
  console.log('   • Generate new token: GitHub Settings > Developer settings > Personal access tokens');
  console.log('   • Run: histofy config set github.token YOUR_NEW_TOKEN');
  console.log('   • Verify: token has required permissions (repo access)\\n');
  
  console.log(chalk.yellow('4. "Permission denied" errors'));
  console.log('   • Check file permissions: ls -la');
  console.log('   • Fix permissions: chmod 644 filename');
  console.log('   • Check directory permissions: chmod 755 dirname\\n');
  
  console.log(chalk.yellow('5. "Invalid date format" errors'));
  console.log('   • Use YYYY-MM-DD format for dates');
  console.log('   • Use HH:MM format for times');
  console.log('   • Example: --date 2023-06-15 --time 14:30\\n');
  
  console.log(chalk.yellow('6. Migration conflicts'));
  console.log('   • Use --dry-run first to preview changes');
  console.log('   • Check for merge conflicts: git status');
  console.log('   • Resolve conflicts manually if needed');
  console.log('   • Use --force only if you\\'re sure\\n');
  
  console.log(chalk.bold('Getting More Help:'));
  console.log(chalk.green('  histofy help faq               ') + 'Frequently asked questions');
  console.log(chalk.green('  histofy help tutorial getting-started') + 'Interactive tutorial');
  console.log(chalk.green('  histofy status                 ') + 'Check repository health');
  console.log(chalk.green('  histofy --verbose <command>    ') + 'Enable detailed logging\\n');
}

/**
 * Show frequently asked questions
 */
function showFAQ() {
  console.log(chalk.blue('\\n❓ Frequently Asked Questions\\n'));
  
  const faqs = [
    {
      question: 'What is Histofy and what does it do?',
      answer: 'Histofy is a tool for manipulating Git commit history. It allows you to create commits with custom dates, migrate existing commits to new dates, and perform bulk operations on commit history.'
    },
    {
      question: 'Is it safe to use Histofy on my repository?',
      answer: 'Yes, Histofy creates automatic backups before any destructive operations. You can always restore your repository to its previous state. However, be cautious when working with shared repositories.'
    },
    {
      question: 'Can I use Histofy with GitHub/remote repositories?',
      answer: 'Yes, but be careful with shared repositories. Changing commit history affects other collaborators. Use force-push carefully and coordinate with your team.'
    },
    {
      question: 'What file formats does Histofy support for batch operations?',
      answer: 'Histofy supports CSV and JSON formats for batch operations. CSV files should have headers like "message,date,author". JSON files should contain arrays of commit objects.'
    },
    {
      question: 'How do I undo a Histofy operation?',
      answer: 'Use the "histofy undo" command to reverse recent operations. Histofy maintains an operation history and can restore previous states automatically.'
    },
    {
      question: 'Can I customize commit templates?',
      answer: 'Yes, use "histofy batch template --create" to create custom templates. Templates support variable substitution and can be reused for consistent commit formatting.'
    },
    {
      question: 'How do I monitor performance of large operations?',
      answer: 'Enable performance monitoring with "histofy performance --enable" or use the --profile flag with any command. This provides detailed metrics and optimization suggestions.'
    },
    {
      question: 'What should I do if a migration fails?',
      answer: 'Histofy automatically restores your repository from backup if a migration fails. Check the error message, resolve any issues, and try again. Use --dry-run to preview first.'
    },
    {
      question: 'How do I configure Histofy for my team?',
      answer: 'Create a shared configuration template with "histofy config init", then distribute it to team members. Set common defaults like author information and GitHub tokens.'
    },
    {
      question: 'Can I use Histofy in CI/CD pipelines?',
      answer: 'Yes, Histofy supports machine-readable output and non-interactive modes. Use --no-banner for scripts and --dry-run for validation steps.'
    }
  ];

  faqs.forEach((faq, index) => {
    console.log(chalk.bold(`${index + 1}. ${faq.question}`));
    console.log(chalk.gray(`   ${faq.answer}\\n`));
  });

  console.log(chalk.bold('Still need help?'));
  console.log(chalk.green('  histofy help troubleshooting   ') + 'Troubleshooting guide');
  console.log(chalk.green('  histofy help tutorial getting-started') + 'Interactive tutorial');
  console.log(chalk.green('  histofy status                 ') + 'Check repository status\\n');
}

module.exports = helpCommand;