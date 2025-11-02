/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * DryRunManager - Handles dry-run mode for all operations
 */

const chalk = require('chalk');
const { FeedbackUtils } = require('./feedback');

class DryRunManager {
  constructor() {
    this.operations = [];
    this.warnings = [];
    this.estimatedTime = 0;
    this.affectedFiles = new Set();
    this.gitOperations = [];
  }

  /**
   * Add an operation to the dry-run preview
   * @param {Object} operation - Operation details
   */
  addOperation(operation) {
    const op = {
      id: this.operations.length + 1,
      type: operation.type,
      description: operation.description,
      details: operation.details || {},
      estimatedDuration: operation.estimatedDuration || 0,
      riskLevel: operation.riskLevel || 'low', // low, medium, high
      reversible: operation.reversible !== false,
      timestamp: new Date().toISOString()
    };

    this.operations.push(op);
    this.estimatedTime += op.estimatedDuration;

    // Track affected files
    if (operation.affectedFiles) {
      operation.affectedFiles.forEach(file => this.affectedFiles.add(file));
    }

    // Track Git operations
    if (operation.gitCommand) {
      this.gitOperations.push({
        command: operation.gitCommand,
        args: operation.gitArgs || [],
        description: operation.description
      });
    }

    return op.id;
  }

  /**
   * Add a warning to the dry-run preview
   * @param {string} warning - Warning message
   * @param {string} severity - Warning severity (info, warning, error)
   */
  addWarning(warning, severity = 'warning') {
    this.warnings.push({
      message: warning,
      severity,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate a comprehensive dry-run summary
   * @returns {Object} Dry-run summary
   */
  generateSummary() {
    const riskCounts = this.operations.reduce((acc, op) => {
      acc[op.riskLevel] = (acc[op.riskLevel] || 0) + 1;
      return acc;
    }, {});

    const reversibleCount = this.operations.filter(op => op.reversible).length;
    const irreversibleCount = this.operations.length - reversibleCount;

    return {
      totalOperations: this.operations.length,
      estimatedTime: this.estimatedTime,
      affectedFilesCount: this.affectedFiles.size,
      gitOperationsCount: this.gitOperations.length,
      riskDistribution: riskCounts,
      reversibleOperations: reversibleCount,
      irreversibleOperations: irreversibleCount,
      warningsCount: this.warnings.length,
      operations: this.operations,
      warnings: this.warnings,
      affectedFiles: Array.from(this.affectedFiles),
      gitOperations: this.gitOperations
    };
  }

  /**
   * Display dry-run preview in a formatted way
   * @param {Object} options - Display options
   */
  displayPreview(options = {}) {
    const {
      showDetails = true,
      showWarnings = true,
      showGitCommands = false,
      maxOperations = 20
    } = options;

    const summary = this.generateSummary();

    console.log(chalk.cyan('\\n🔍 DRY RUN PREVIEW\\n'));
    console.log(chalk.bold('Operation Summary:'));
    console.log(`  Total Operations: ${chalk.yellow(summary.totalOperations)}`);
    console.log(`  Estimated Time: ${chalk.yellow(this.formatDuration(summary.estimatedTime))}`);
    console.log(`  Affected Files: ${chalk.yellow(summary.affectedFilesCount)}`);
    console.log(`  Git Operations: ${chalk.yellow(summary.gitOperationsCount)}`);

    // Risk distribution
    if (Object.keys(summary.riskDistribution).length > 0) {
      console.log('\\n' + chalk.bold('Risk Assessment:'));
      Object.entries(summary.riskDistribution).forEach(([risk, count]) => {
        const color = risk === 'high' ? 'red' : risk === 'medium' ? 'yellow' : 'green';
        console.log(`  ${chalk[color](risk.toUpperCase())}: ${count} operations`);
      });
    }

    // Reversibility info
    if (summary.irreversibleOperations > 0) {
      console.log(`\\n${chalk.red('⚠️  Warning:')} ${summary.irreversibleOperations} operations are irreversible!`);
    }

    // Operations list
    if (showDetails && this.operations.length > 0) {
      console.log('\\n' + chalk.bold('Planned Operations:'));
      const operationsToShow = this.operations.slice(0, maxOperations);
      
      operationsToShow.forEach((op, index) => {
        const riskIcon = this.getRiskIcon(op.riskLevel);
        const reversibleIcon = op.reversible ? '↩️' : '⚠️';
        
        console.log(`  ${index + 1}. ${riskIcon} ${reversibleIcon} ${op.description}`);
        
        if (op.details && Object.keys(op.details).length > 0) {
          Object.entries(op.details).forEach(([key, value]) => {
            console.log(`     ${chalk.gray(`${key}:`)} ${chalk.white(value)}`);
          });
        }
      });

      if (this.operations.length > maxOperations) {
        console.log(`     ${chalk.gray(`... and ${this.operations.length - maxOperations} more operations`)}`);
      }
    }

    // Git commands preview
    if (showGitCommands && this.gitOperations.length > 0) {
      console.log('\\n' + chalk.bold('Git Commands to Execute:'));
      this.gitOperations.forEach((gitOp, index) => {
        const command = `git ${gitOp.command} ${gitOp.args.join(' ')}`.trim();
        console.log(`  ${index + 1}. ${chalk.cyan(command)}`);
        if (gitOp.description) {
          console.log(`     ${chalk.gray(gitOp.description)}`);
        }
      });
    }

    // Warnings
    if (showWarnings && this.warnings.length > 0) {
      console.log('\\n' + chalk.bold('Warnings and Recommendations:'));
      this.warnings.forEach((warning, index) => {
        const icon = this.getWarningIcon(warning.severity);
        const color = this.getWarningColor(warning.severity);
        console.log(`  ${index + 1}. ${icon} ${chalk[color](warning.message)}`);
      });
    }

    // Affected files
    if (summary.affectedFilesCount > 0 && summary.affectedFilesCount <= 10) {
      console.log('\\n' + chalk.bold('Affected Files:'));
      Array.from(this.affectedFiles).forEach(file => {
        console.log(`  📄 ${file}`);
      });
    } else if (summary.affectedFilesCount > 10) {
      console.log(`\\n${chalk.bold('Affected Files:')} ${summary.affectedFilesCount} files (too many to list)`);
    }

    // Footer
    console.log(`\\n${chalk.gray('💡 This is a preview only. No changes have been made.')}`);
    console.log(`${chalk.gray('   Use --execute or remove --dry-run to perform these operations.')}`);
    
    return summary;
  }

  /**
   * Get risk level icon
   * @private
   */
  getRiskIcon(riskLevel) {
    switch (riskLevel) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get warning icon based on severity
   * @private
   */
  getWarningIcon(severity) {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '💡';
    }
  }

  /**
   * Get warning color based on severity
   * @private
   */
  getWarningColor(severity) {
    switch (severity) {
      case 'error': return 'red';
      case 'warning': return 'yellow';
      case 'info': return 'blue';
      default: return 'gray';
    }
  }

  /**
   * Format duration in human-readable format
   * @private
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  /**
   * Clear all operations and warnings
   */
  clear() {
    this.operations = [];
    this.warnings = [];
    this.estimatedTime = 0;
    this.affectedFiles.clear();
    this.gitOperations = [];
  }

  /**
   * Export dry-run summary to JSON
   * @param {string} filePath - Output file path
   */
  async exportSummary(filePath) {
    const fs = require('fs').promises;
    const summary = this.generateSummary();
    
    const exportData = {
      ...summary,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    return exportData;
  }

  /**
   * Create a dry-run manager for commit operations
   * @param {Object} commitData - Commit data
   * @returns {DryRunManager} Configured dry-run manager
   */
  static forCommitOperation(commitData) {
    const dryRun = new DryRunManager();
    
    dryRun.addOperation({
      type: 'git_add',
      description: 'Stage files for commit',
      details: {
        files: commitData.files || ['all changes'],
        mode: commitData.addAll ? 'all' : 'selective'
      },
      estimatedDuration: 2,
      riskLevel: 'low',
      reversible: true,
      gitCommand: 'add',
      gitArgs: commitData.addAll ? ['.'] : commitData.files || [],
      affectedFiles: commitData.files
    });

    dryRun.addOperation({
      type: 'git_commit',
      description: `Create commit: "${commitData.message}"`,
      details: {
        message: commitData.message,
        date: commitData.date || 'current',
        time: commitData.time || 'current',
        author: commitData.author || 'default'
      },
      estimatedDuration: 3,
      riskLevel: 'low',
      reversible: true,
      gitCommand: 'commit',
      gitArgs: ['-m', commitData.message]
    });

    if (commitData.push) {
      dryRun.addOperation({
        type: 'git_push',
        description: 'Push commit to remote repository',
        estimatedDuration: 5,
        riskLevel: 'medium',
        reversible: false,
        gitCommand: 'push'
      });
      
      dryRun.addWarning('Push operation cannot be undone automatically', 'warning');
    }

    return dryRun;
  }

  /**
   * Create a dry-run manager for migration operations
   * @param {Object} migrationData - Migration data
   * @returns {DryRunManager} Configured dry-run manager
   */
  static forMigrationOperation(migrationData) {
    const dryRun = new DryRunManager();
    
    dryRun.addOperation({
      type: 'git_backup',
      description: 'Create backup of current repository state',
      estimatedDuration: 10,
      riskLevel: 'low',
      reversible: true
    });

    migrationData.commits.forEach((commit, index) => {
      dryRun.addOperation({
        type: 'commit_migration',
        description: `Migrate commit ${commit.hash.substring(0, 8)}: ${commit.message.substring(0, 50)}...`,
        details: {
          originalDate: commit.originalDate,
          newDate: commit.newDate,
          hash: commit.hash,
          strategy: migrationData.strategy || 'interactive-rebase'
        },
        estimatedDuration: 15,
        riskLevel: 'high',
        reversible: true,
        gitCommand: 'rebase',
        gitArgs: ['--interactive']
      });
    });

    dryRun.addOperation({
      type: 'cleanup',
      description: 'Clean up temporary files and references',
      estimatedDuration: 5,
      riskLevel: 'low',
      reversible: true
    });

    dryRun.addWarning('Migration will rewrite Git history', 'warning');
    dryRun.addWarning('Backup will be created automatically', 'info');
    
    if (migrationData.commits.length > 10) {
      dryRun.addWarning('Large migration may take significant time', 'warning');
    }

    return dryRun;
  }

  /**
   * Create a dry-run manager for configuration operations
   * @param {Object} configData - Configuration data
   * @returns {DryRunManager} Configured dry-run manager
   */
  static forConfigOperation(configData) {
    const dryRun = new DryRunManager();
    
    if (configData.action === 'set') {
      dryRun.addOperation({
        type: 'config_update',
        description: `Set configuration: ${configData.key} = ${configData.value}`,
        details: {
          key: configData.key,
          value: configData.sensitive ? '[ENCRYPTED]' : configData.value,
          encrypted: configData.sensitive || false
        },
        estimatedDuration: 2,
        riskLevel: 'low',
        reversible: true,
        affectedFiles: [configData.configFile || '~/.histofy/config.yaml']
      });

      if (configData.sensitive) {
        dryRun.addOperation({
          type: 'encryption',
          description: 'Encrypt sensitive configuration value',
          estimatedDuration: 1,
          riskLevel: 'low',
          reversible: true
        });
      }
    } else if (configData.action === 'init') {
      dryRun.addOperation({
        type: 'config_init',
        description: 'Initialize configuration file with default values',
        details: {
          configFile: configData.configFile || '~/.histofy/config.yaml',
          createDirectories: true
        },
        estimatedDuration: 3,
        riskLevel: 'low',
        reversible: true,
        affectedFiles: [configData.configFile || '~/.histofy/config.yaml']
      });
    }

    return dryRun;
  }

  /**
   * Create a dry-run manager for batch operations
   * @param {Object} batchData - Batch operation data
   * @returns {DryRunManager} Configured dry-run manager
   */
  static forBatchOperation(batchData) {
    const dryRun = new DryRunManager();
    
    if (batchData.commits && batchData.commits.length > 0) {
      dryRun.addOperation({
        type: 'data_validation',
        description: `Validate ${batchData.commits.length} commit entries`,
        estimatedDuration: Math.ceil(batchData.commits.length / 10),
        riskLevel: 'low',
        reversible: true
      });

      batchData.commits.forEach((commit, index) => {
        dryRun.addOperation({
          type: 'batch_commit',
          description: `Create commit ${index + 1}/${batchData.commits.length}: ${commit.message}`,
          details: {
            message: commit.message,
            date: commit.date,
            time: commit.time,
            author: commit.author
          },
          estimatedDuration: 3,
          riskLevel: 'low',
          reversible: true,
          gitCommand: 'commit',
          gitArgs: ['-m', commit.message]
        });
      });

      if (batchData.commits.length > 50) {
        dryRun.addWarning('Large batch operation may take significant time', 'warning');
      }

      if (batchData.continueOnError) {
        dryRun.addWarning('Will continue processing even if individual commits fail', 'info');
      }
    }

    return dryRun;
  }
}

module.exports = DryRunManager;