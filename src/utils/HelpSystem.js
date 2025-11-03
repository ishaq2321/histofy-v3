/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * HelpSystem - Enhanced help and tutorial system
 */

const chalk = require('chalk');
const { Command } = require('commander');

class HelpSystem {
  constructor() {
    this.examples = new Map();
    this.tutorials = new Map();
    this.contextualHelp = new Map();
    this.setupExamples();
    this.setupTutorials();
    this.setupContextualHelp();
  }

  /**
   * Setup command examples
   */
  setupExamples() {
    // Commit command examples
    this.examples.set('commit', [
      {
        title: 'Basic commit with custom date',
        command: 'histofy commit "Fix bug in authentication" --date 2023-06-15',
        description: 'Create a commit with a specific date'
      },
      {
        title: 'Commit with custom date and time',
        command: 'histofy commit "Add new feature" --date 2023-06-15 --time 14:30',
        description: 'Create a commit with specific date and time'
      },
      {
        title: 'Commit with custom author',
        command: 'histofy commit "Update documentation" --author "John Doe <john@example.com>"',
        description: 'Create a commit with a different author'
      },
      {
        title: 'Add all changes and commit',
        command: 'histofy commit "Major refactoring" --add-all --date 2023-06-10',
        description: 'Stage all changes and commit with custom date'
      },
      {
        title: 'Commit and push immediately',
        command: 'histofy commit "Hotfix for production" --push',
        description: 'Create commit and push to remote repository'
      },
      {
        title: 'Preview commit without executing',
        command: 'histofy commit "Test commit" --dry-run',
        description: 'See what would happen without actually committing'
      }
    ]);

    // Status command examples
    this.examples.set('status', [
      {
        title: 'Basic repository status',
        command: 'histofy status',
        description: 'Show current repository status and health'
      },
      {
        title: 'Status with remote information',
        command: 'histofy status --remote',
        description: 'Include GitHub remote repository information'
      }
    ]);

    // Config command examples
    this.examples.set('config', [
      {
        title: 'Initialize configuration',
        command: 'histofy config init',
        description: 'Create initial configuration file with defaults'
      },
      {
        title: 'Set GitHub token',
        command: 'histofy config set github.token ghp_your_token_here',
        description: 'Configure GitHub personal access token'
      },
      {
        title: 'Set default author',
        command: 'histofy config set git.defaultAuthor "Jane Smith <jane@example.com>"',
        description: 'Set default author for commits'
      },
      {
        title: 'List all configuration',
        command: 'histofy config list',
        description: 'Show all current configuration settings'
      },
      {
        title: 'Get specific configuration',
        command: 'histofy config get github.token',
        description: 'Show specific configuration value'
      },
      {
        title: 'Preview configuration changes',
        command: 'histofy config set git.defaultBranch main --dry-run',
        description: 'Preview configuration changes without applying'
      }
    ]);

    // Migrate command examples
    this.examples.set('migrate', [
      {
        title: 'Migrate single commit',
        command: 'histofy migrate abc123 --to-date 2023-06-15',
        description: 'Change the date of a specific commit'
      },
      {
        title: 'Migrate commit range',
        command: 'histofy migrate HEAD~5..HEAD --to-date 2023-06-15',
        description: 'Change dates for the last 5 commits'
      },
      {
        title: 'Migrate with time offset',
        command: 'histofy migrate HEAD~3..HEAD --to-date 2023-06-15 --time-offset "+2 hours"',
        description: 'Migrate commits with time adjustments'
      },
      {
        title: 'Preview migration without executing',
        command: 'histofy migrate HEAD~5..HEAD --to-date 2023-06-15 --dry-run',
        description: 'See migration plan without executing changes'
      },
      {
        title: 'Force migration with conflicts',
        command: 'histofy migrate HEAD~10..HEAD --to-date 2023-06-15 --force',
        description: 'Force migration even if conflicts are detected'
      }
    ]);

    // Batch command examples
    this.examples.set('batch', [
      {
        title: 'Batch commit from CSV',
        command: 'histofy batch commit --input commits.csv',
        description: 'Create multiple commits from CSV data'
      },
      {
        title: 'Create commit template',
        command: 'histofy batch template --create --output template.json',
        description: 'Create a new commit template file'
      },
      {
        title: 'Import commits from JSON',
        command: 'histofy batch import --input data.json --template template.json',
        description: 'Import commits using a template'
      },
      {
        title: 'Export commit history',
        command: 'histofy batch export --output history.csv --format csv',
        description: 'Export commit history to CSV format'
      },
      {
        title: 'Validate batch data',
        command: 'histofy batch validate --input commits.csv --validate-only',
        description: 'Validate batch data without processing'
      }
    ]);

    // Analyze command examples
    this.examples.set('analyze', [
      {
        title: 'Basic repository analysis',
        command: 'histofy analyze',
        description: 'Analyze commit patterns and repository health'
      },
      {
        title: 'Author contribution analysis',
        command: 'histofy analyze --authors',
        description: 'Analyze contributions by author'
      },
      {
        title: 'Temporal analysis with charts',
        command: 'histofy analyze --temporal --charts',
        description: 'Show activity patterns with visual charts'
      },
      {
        title: 'Export analysis report',
        command: 'histofy analyze --export report.json --format json',
        description: 'Export detailed analysis to JSON file'
      }
    ]);

    // Performance command examples
    this.examples.set('performance', [
      {
        title: 'Enable performance monitoring',
        command: 'histofy performance --enable',
        description: 'Start monitoring performance metrics'
      },
      {
        title: 'Show performance summary',
        command: 'histofy performance --summary',
        description: 'Display current performance statistics'
      },
      {
        title: 'Generate detailed report',
        command: 'histofy performance --report --output perf-report.json',
        description: 'Create comprehensive performance report'
      },
      {
        title: 'Export performance data',
        command: 'histofy performance --export json --output perf-data.json',
        description: 'Export raw performance data'
      }
    ]);

    // Global options examples
    this.examples.set('global', [
      {
        title: 'Enable performance profiling globally',
        command: 'histofy --profile commit "Test commit"',
        description: 'Profile any command execution'
      },
      {
        title: 'Show performance summary after operation',
        command: 'histofy --perf-summary status',
        description: 'Display performance metrics after command'
      },
      {
        title: 'Verbose output for debugging',
        command: 'histofy --verbose migrate HEAD~3..HEAD --to-date 2023-06-15',
        description: 'Enable detailed logging for troubleshooting'
      },
      {
        title: 'Disable banner for scripts',
        command: 'histofy --no-banner status',
        description: 'Run commands without ASCII banner (useful for scripts)'
      }
    ]);
  }

  /**
   * Setup interactive tutorials
   */
  setupTutorials() {
    this.tutorials.set('getting-started', {
      title: 'Getting Started with Histofy',
      description: 'Learn the basics of using Histofy for Git history manipulation',
      steps: [
        {
          title: 'Initialize Configuration',
          command: 'histofy config init',
          explanation: 'First, create your configuration file with default settings.',
          tips: ['This creates a .histofy.yml file in your home directory', 'You can customize settings later']
        },
        {
          title: 'Set GitHub Token (Optional)',
          command: 'histofy config set github.token YOUR_TOKEN',
          explanation: 'Configure GitHub access for remote operations.',
          tips: ['Get a token from GitHub Settings > Developer settings > Personal access tokens', 'Required for --remote status checks']
        },
        {
          title: 'Check Repository Status',
          command: 'histofy status',
          explanation: 'Verify your repository is ready for Histofy operations.',
          tips: ['Ensure you have a clean working directory', 'Check for any warnings or issues']
        },
        {
          title: 'Create Your First Custom Commit',
          command: 'histofy commit "My first Histofy commit" --date 2023-06-15',
          explanation: 'Create a commit with a custom date.',
          tips: ['Use --dry-run first to preview', 'Date format is YYYY-MM-DD']
        },
        {
          title: 'Explore Advanced Features',
          command: 'histofy --help',
          explanation: 'Discover all available commands and options.',
          tips: ['Try batch operations for multiple commits', 'Use analyze command for repository insights']
        }
      ]
    });

    this.tutorials.set('batch-operations', {
      title: 'Batch Operations Tutorial',
      description: 'Learn how to perform bulk operations efficiently',
      steps: [
        {
          title: 'Prepare Your Data',
          command: 'echo "message,date,author\\nFix bug,2023-06-15,John Doe\\nAdd feature,2023-06-16,Jane Smith" > commits.csv',
          explanation: 'Create a CSV file with commit data.',
          tips: ['Include headers: message, date, author', 'Use proper CSV formatting']
        },
        {
          title: 'Validate Your Data',
          command: 'histofy batch validate --input commits.csv',
          explanation: 'Check your data for errors before processing.',
          tips: ['Fix any validation errors before proceeding', 'Use --validate-only for dry validation']
        },
        {
          title: 'Preview Batch Operation',
          command: 'histofy batch commit --input commits.csv --dry-run',
          explanation: 'See what commits will be created.',
          tips: ['Review the preview carefully', 'Check dates and authors are correct']
        },
        {
          title: 'Execute Batch Commits',
          command: 'histofy batch commit --input commits.csv',
          explanation: 'Create all commits from your data file.',
          tips: ['Use --continue-on-error to handle individual failures', 'Monitor progress with the built-in progress bar']
        }
      ]
    });

    this.tutorials.set('migration', {
      title: 'Commit Migration Tutorial',
      description: 'Learn how to safely migrate commit dates',
      steps: [
        {
          title: 'Identify Commits to Migrate',
          command: 'git log --oneline -10',
          explanation: 'Find the commits you want to migrate.',
          tips: ['Note commit hashes or use ranges like HEAD~5..HEAD', 'Consider the impact on collaborators']
        },
        {
          title: 'Preview Migration',
          command: 'histofy migrate HEAD~5..HEAD --to-date 2023-06-15 --dry-run',
          explanation: 'See the migration plan before executing.',
          tips: ['Review all affected commits', 'Check for potential conflicts']
        },
        {
          title: 'Create Backup (Automatic)',
          command: 'histofy migrate HEAD~5..HEAD --to-date 2023-06-15',
          explanation: 'Histofy automatically creates backups before migration.',
          tips: ['Backups are stored in .git/histofy-backups/', 'You can restore manually if needed']
        },
        {
          title: 'Verify Migration Results',
          command: 'git log --oneline -10',
          explanation: 'Check that migration completed successfully.',
          tips: ['Verify commit dates are correct', 'Check that commit messages and content are unchanged']
        }
      ]
    });
  }

  /**
   * Setup contextual help for common errors
   */
  setupContextualHelp() {
    // Git-related errors
    this.contextualHelp.set('not_a_git_repository', {
      error: 'not a git repository',
      suggestion: 'Initialize a Git repository first',
      commands: [
        'git init',
        'git remote add origin <repository-url>'
      ],
      explanation: 'Histofy requires a Git repository to function. Initialize one or navigate to an existing repository.'
    });

    this.contextualHelp.set('no_commits', {
      error: 'no commits found',
      suggestion: 'Create at least one commit before using Histofy',
      commands: [
        'git add .',
        'git commit -m "Initial commit"'
      ],
      explanation: 'Some Histofy operations require existing commits. Create your first commit to get started.'
    });

    // Configuration errors
    this.contextualHelp.set('config_not_found', {
      error: 'configuration file not found',
      suggestion: 'Initialize Histofy configuration',
      commands: [
        'histofy config init'
      ],
      explanation: 'Histofy needs a configuration file to work properly. Run the init command to create one with defaults.'
    });

    this.contextualHelp.set('invalid_github_token', {
      error: 'invalid GitHub token',
      suggestion: 'Update your GitHub personal access token',
      commands: [
        'histofy config set github.token YOUR_NEW_TOKEN'
      ],
      explanation: 'Your GitHub token may be expired or invalid. Generate a new token from GitHub Settings > Developer settings.'
    });

    // Command usage errors
    this.contextualHelp.set('invalid_date_format', {
      error: 'invalid date format',
      suggestion: 'Use YYYY-MM-DD format for dates',
      commands: [
        'histofy commit "message" --date 2023-06-15',
        'histofy commit "message" --date 2023-06-15 --time 14:30'
      ],
      explanation: 'Dates must be in YYYY-MM-DD format. Time is optional and uses HH:MM format.'
    });

    this.contextualHelp.set('invalid_commit_range', {
      error: 'invalid commit range',
      suggestion: 'Use valid Git commit references',
      commands: [
        'histofy migrate abc123 --to-date 2023-06-15',
        'histofy migrate HEAD~5..HEAD --to-date 2023-06-15',
        'histofy migrate main..feature-branch --to-date 2023-06-15'
      ],
      explanation: 'Commit ranges must use valid Git references like commit hashes, HEAD~N, or branch names.'
    });

    // File operation errors
    this.contextualHelp.set('file_not_found', {
      error: 'file not found',
      suggestion: 'Check file path and permissions',
      commands: [
        'ls -la path/to/file',
        'histofy batch commit --input ./data/commits.csv'
      ],
      explanation: 'Ensure the file exists and you have read permissions. Use relative or absolute paths.'
    });

    this.contextualHelp.set('permission_denied', {
      error: 'permission denied',
      suggestion: 'Check file and directory permissions',
      commands: [
        'chmod 644 file.csv',
        'sudo histofy command (if needed)'
      ],
      explanation: 'You may not have sufficient permissions. Check file ownership and permissions.'
    });
  }

  /**
   * Show examples for a specific command
   */
  showExamples(commandName) {
    const examples = this.examples.get(commandName);
    if (!examples) {
      console.log(chalk.yellow(`No examples available for command: ${commandName}`));
      return;
    }

    console.log(chalk.blue(`\\n📚 Examples for '${commandName}' command:\\n`));
    
    examples.forEach((example, index) => {
      console.log(chalk.bold(`${index + 1}. ${example.title}`));
      console.log(chalk.green(`   $ ${example.command}`));
      console.log(chalk.gray(`   ${example.description}\\n`));
    });

    console.log(chalk.gray('💡 Tip: Use --dry-run with any command to preview changes without executing.\\n'));
  }

  /**
   * Show interactive tutorial
   */
  async showTutorial(tutorialName) {
    const tutorial = this.tutorials.get(tutorialName);
    if (!tutorial) {
      console.log(chalk.yellow(`Tutorial '${tutorialName}' not found.`));
      this.listTutorials();
      return;
    }

    console.log(chalk.blue(`\\n🎓 ${tutorial.title}\\n`));
    console.log(chalk.gray(tutorial.description + '\\n'));

    for (let i = 0; i < tutorial.steps.length; i++) {
      const step = tutorial.steps[i];
      
      console.log(chalk.bold(`Step ${i + 1}: ${step.title}`));
      console.log(chalk.green(`$ ${step.command}`));
      console.log(step.explanation);
      
      if (step.tips && step.tips.length > 0) {
        console.log(chalk.yellow('💡 Tips:'));
        step.tips.forEach(tip => {
          console.log(chalk.yellow(`   • ${tip}`));
        });
      }
      
      console.log(); // Empty line
      
      // Pause between steps (in a real interactive tutorial)
      if (i < tutorial.steps.length - 1) {
        console.log(chalk.gray('Press Enter to continue to the next step...'));
        // In a real implementation, you'd wait for user input here
      }
    }

    console.log(chalk.green('✅ Tutorial completed! Try the commands above to get started.\\n'));
  }

  /**
   * List available tutorials
   */
  listTutorials() {
    console.log(chalk.blue('\\n🎓 Available Tutorials:\\n'));
    
    for (const [name, tutorial] of this.tutorials) {
      console.log(chalk.bold(`• ${name}`));
      console.log(chalk.gray(`  ${tutorial.description}`));
      console.log(chalk.green(`  Run: histofy help tutorial ${name}\\n`));
    }
  }

  /**
   * Provide contextual help for errors
   */
  provideContextualHelp(errorMessage) {
    const errorKey = this.findErrorKey(errorMessage);
    const help = this.contextualHelp.get(errorKey);
    
    if (!help) {
      return this.provideGenericHelp(errorMessage);
    }

    console.log(chalk.red(`\\n❌ Error: ${errorMessage}\\n`));
    console.log(chalk.blue(`💡 Suggestion: ${help.suggestion}\\n`));
    console.log(chalk.gray(help.explanation + '\\n'));
    
    if (help.commands && help.commands.length > 0) {
      console.log(chalk.bold('Try these commands:'));
      help.commands.forEach(cmd => {
        console.log(chalk.green(`  $ ${cmd}`));
      });
      console.log();
    }

    console.log(chalk.gray('For more help, run: histofy help\\n'));
  }

  /**
   * Find error key from error message
   */
  findErrorKey(errorMessage) {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('not a git repository')) return 'not_a_git_repository';
    if (message.includes('no commits')) return 'no_commits';
    if (message.includes('config') && message.includes('not found')) return 'config_not_found';
    if (message.includes('github') && message.includes('token')) return 'invalid_github_token';
    if (message.includes('date') && message.includes('format')) return 'invalid_date_format';
    if (message.includes('commit') && message.includes('range')) return 'invalid_commit_range';
    if (message.includes('file not found') || message.includes('no such file')) return 'file_not_found';
    if (message.includes('permission denied')) return 'permission_denied';
    
    return null;
  }

  /**
   * Provide generic help for unknown errors
   */
  provideGenericHelp(errorMessage) {
    console.log(chalk.red(`\\n❌ Error: ${errorMessage}\\n`));
    console.log(chalk.blue('💡 General troubleshooting steps:\\n'));
    
    console.log(chalk.bold('1. Check your current directory:'));
    console.log(chalk.green('   $ pwd'));
    console.log(chalk.green('   $ ls -la\\n'));
    
    console.log(chalk.bold('2. Verify Git repository status:'));
    console.log(chalk.green('   $ git status'));
    console.log(chalk.green('   $ git log --oneline -5\\n'));
    
    console.log(chalk.bold('3. Check Histofy configuration:'));
    console.log(chalk.green('   $ histofy config list'));
    console.log(chalk.green('   $ histofy status\\n'));
    
    console.log(chalk.bold('4. Get detailed help:'));
    console.log(chalk.green('   $ histofy --help'));
    console.log(chalk.green('   $ histofy <command> --help\\n'));
    
    console.log(chalk.gray('If the problem persists, please check the documentation or report an issue.\\n'));
  }

  /**
   * Show command-specific help with examples
   */
  showCommandHelp(command) {
    console.log(chalk.blue(`\\n📖 Help for '${command.name()}' command\\n`));
    
    // Show command description
    console.log(chalk.bold('Description:'));
    console.log(`  ${command.description()}\\n`);
    
    // Show usage
    console.log(chalk.bold('Usage:'));
    console.log(chalk.green(`  histofy ${command.usage()}\\n`));
    
    // Show options
    if (command.options && command.options.length > 0) {
      console.log(chalk.bold('Options:'));
      command.options.forEach(option => {
        console.log(chalk.green(`  ${option.flags.padEnd(25)} ${option.description}`));
      });
      console.log();
    }
    
    // Show examples
    this.showExamples(command.name());
  }

  /**
   * Show main help with overview
   */
  showMainHelp() {
    console.log(chalk.blue('\\n📖 Histofy Help System\\n'));
    
    console.log(chalk.bold('Available Commands:'));
    console.log(chalk.green('  commit      ') + 'Create commits with custom dates and metadata');
    console.log(chalk.green('  status      ') + 'Show repository status and health information');
    console.log(chalk.green('  config      ') + 'Manage Histofy configuration settings');
    console.log(chalk.green('  migrate     ') + 'Migrate existing commits to new dates');
    console.log(chalk.green('  batch       ') + 'Perform bulk operations on multiple commits');
    console.log(chalk.green('  analyze     ') + 'Analyze repository patterns and statistics');
    console.log(chalk.green('  performance ') + 'Monitor and analyze performance metrics');
    console.log(chalk.green('  undo        ') + 'Undo recent Histofy operations');
    console.log(chalk.green('  export      ') + 'Export commit data and history');
    console.log(chalk.green('  import      ') + 'Import commit data from external sources\\n');
    
    console.log(chalk.bold('Getting Help:'));
    console.log(chalk.green('  histofy help                    ') + 'Show this help message');
    console.log(chalk.green('  histofy help <command>          ') + 'Show help for specific command');
    console.log(chalk.green('  histofy help examples <command> ') + 'Show examples for command');
    console.log(chalk.green('  histofy help tutorial <name>    ') + 'Run interactive tutorial');
    console.log(chalk.green('  histofy help tutorials          ') + 'List available tutorials\\n');
    
    console.log(chalk.bold('Quick Start:'));
    console.log(chalk.green('  histofy config init             ') + 'Initialize configuration');
    console.log(chalk.green('  histofy status                  ') + 'Check repository status');
    console.log(chalk.green('  histofy help tutorial getting-started') + 'Interactive tutorial\\n');
    
    console.log(chalk.gray('💡 Tip: Use --dry-run with any command to preview changes.'));
    console.log(chalk.gray('🔧 Use --verbose for detailed output during operations.\\n'));
  }
}

module.exports = HelpSystem;