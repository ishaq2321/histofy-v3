/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Audit CLI Command - Audit logging and compliance management
 */

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const AuditLogger = require('../utils/AuditLogger');
const ComplianceReporter = require('../utils/ComplianceReporter');
const AuditIntegrityManager = require('../utils/AuditIntegrityManager');
const { FeedbackUtils } = require('../utils/feedback');

const auditCommand = new Command('audit')
  .description('Audit logging and compliance management')
  .option('-l, --list', 'List recent audit entries')
  .option('-s, --search <query>', 'Search audit logs')
  .option('-u, --user <username>', 'Filter by user')
  .option('-t, --type <eventType>', 'Filter by event type')
  .option('--start-date <date>', 'Start date for filtering (YYYY-MM-DD)')
  .option('--end-date <date>', 'End date for filtering (YYYY-MM-DD)')
  .option('--limit <number>', 'Maximum number of entries to show', '50')
  .option('--offset <number>', 'Number of entries to skip', '0')
  .option('-r, --report', 'Generate audit report')
  .option('-e, --export <format>', 'Export audit logs (json, csv, xml)')
  .option('-o, --output <file>', 'Output file for export or report')
  .option('--verify', 'Verify audit log integrity')
  .option('--stats', 'Show audit statistics')
  .option('--cleanup', 'Clean up old audit logs')
  .option('--rotate', 'Force log rotation')
  .option('--compliance', 'Run compliance validation')
  .option('--compliance-report <format>', 'Generate compliance report (json, csv, html)')
  .option('--rules', 'List compliance rules')
  .option('--add-rule <file>', 'Add compliance rule from JSON file')
  .option('--remove-rule <ruleId>', 'Remove compliance rule')
  .option('--compliance-level <level>', 'Set compliance level (basic, standard, strict)', 'standard')
  .option('--integrity-check', 'Run comprehensive integrity check')
  .option('--backup <file>', 'Create secure backup of audit file')
  .option('--restore <backupFile>', 'Restore from secure backup')
  .option('--tamper-scan', 'Scan for tampering attempts')
  .option('--chain-verify', 'Verify integrity chain')
  .action(async (options) => {
    try {
      const auditLogger = AuditLogger.getInstance();
      const complianceReporter = ComplianceReporter.getInstance({
        complianceLevel: options.complianceLevel
      });
      const integrityManager = AuditIntegrityManager.getInstance();

      // Handle compliance validation
      if (options.compliance) {
        await runComplianceValidation(complianceReporter, options);
        return;
      }

      // Handle compliance report generation
      if (options.complianceReport) {
        await generateComplianceReport(complianceReporter, options);
        return;
      }

      // Handle compliance rules management
      if (options.rules) {
        await listComplianceRules(complianceReporter);
        return;
      }

      if (options.addRule) {
        await addComplianceRule(complianceReporter, options.addRule);
        return;
      }

      if (options.removeRule) {
        await removeComplianceRule(complianceReporter, options.removeRule);
        return;
      }

      // Handle integrity operations
      if (options.integrityCheck) {
        await runIntegrityCheck(integrityManager);
        return;
      }

      if (options.backup) {
        await createSecureBackup(integrityManager, options.backup, options.output);
        return;
      }

      if (options.restore) {
        await restoreFromBackup(integrityManager, options.restore, options.output);
        return;
      }

      if (options.tamperScan) {
        await runTamperScan(integrityManager);
        return;
      }

      if (options.chainVerify) {
        await verifyIntegrityChain(integrityManager);
        return;
      }

      // Handle verification
      if (options.verify) {
        await verifyAuditIntegrity(auditLogger);
        return;
      }

      // Handle cleanup
      if (options.cleanup) {
        await cleanupAuditLogs(auditLogger);
        return;
      }

      // Handle rotation
      if (options.rotate) {
        await rotateAuditLogs(auditLogger);
        return;
      }

      // Handle export
      if (options.export) {
        await exportAuditLogs(auditLogger, options);
        return;
      }

      // Handle report generation
      if (options.report) {
        await generateAuditReport(auditLogger, options);
        return;
      }

      // Handle statistics
      if (options.stats) {
        await showAuditStatistics(auditLogger, options);
        return;
      }

      // Default: list audit entries
      await listAuditEntries(auditLogger, options);

    } catch (error) {
      FeedbackUtils.error('Audit command failed', error.message);
      process.exit(1);
    }
  });

/**
 * List audit entries
 */
async function listAuditEntries(auditLogger, options) {
  const queryOptions = {
    user: options.user,
    eventType: options.type,
    startDate: options.startDate,
    endDate: options.endDate,
    limit: parseInt(options.limit),
    offset: parseInt(options.offset)
  };

  try {
    const entries = await auditLogger.readAuditLogs(queryOptions);

    if (entries.length === 0) {
      console.log(chalk.yellow('No audit entries found matching the criteria.'));
      return;
    }

    console.log(chalk.blue(`\\n📋 Audit Log Entries (${entries.length} entries)\\n`));

    entries.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const user = entry.context.user.username;
      const success = entry.eventData.success !== false;
      const statusIcon = success ? chalk.green('✅') : chalk.red('❌');
      
      console.log(`${statusIcon} ${chalk.bold(entry.eventType)} - ${timestamp}`);
      console.log(`   User: ${chalk.cyan(user)}`);
      console.log(`   ID: ${chalk.gray(entry.id)}`);
      
      if (entry.eventData.description) {
        console.log(`   Description: ${entry.eventData.description}`);
      }
      
      if (entry.eventData.error) {
        console.log(`   Error: ${chalk.red(entry.eventData.error)}`);
      }
      
      if (entry.eventData.operationId) {
        console.log(`   Operation: ${chalk.gray(entry.eventData.operationId)}`);
      }
      
      console.log(); // Empty line
    });

    // Show pagination info
    if (entries.length === parseInt(options.limit)) {
      console.log(chalk.gray(`Showing ${entries.length} entries. Use --offset ${parseInt(options.offset) + parseInt(options.limit)} to see more.`));
    }

  } catch (error) {
    throw new Error(`Failed to list audit entries: ${error.message}`);
  }
}

/**
 * Generate audit report
 */
async function generateAuditReport(auditLogger, options) {
  const reportOptions = {
    startDate: options.startDate,
    endDate: options.endDate,
    format: 'json',
    includeSystemInfo: true,
    includeStatistics: true
  };

  try {
    console.log(chalk.blue('📊 Generating audit report...'));
    
    const report = await auditLogger.generateAuditReport(reportOptions);
    
    console.log(chalk.blue('\\n📈 Audit Report Summary\\n'));
    
    // Report metadata
    console.log(`${chalk.bold('Generated:')} ${report.metadata.generatedAt}`);
    console.log(`${chalk.bold('Period:')} ${report.metadata.period.startDate} to ${report.metadata.period.endDate}`);
    console.log(`${chalk.bold('Total Entries:')} ${report.metadata.totalEntries}`);
    
    // Statistics
    if (report.statistics) {
      console.log(`\\n${chalk.bold('📊 Statistics:')}`);
      console.log(`  Successful operations: ${chalk.green(report.statistics.successCount)}`);
      console.log(`  Failed operations: ${chalk.red(report.statistics.errorCount)}`);
      
      // Top event types
      const topEventTypes = Object.entries(report.statistics.eventTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      if (topEventTypes.length > 0) {
        console.log(`\\n  ${chalk.bold('Top Event Types:')}`);
        topEventTypes.forEach(([type, count]) => {
          console.log(`    ${type}: ${count}`);
        });
      }
      
      // Top users
      const topUsers = Object.entries(report.statistics.users)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      if (topUsers.length > 0) {
        console.log(`\\n  ${chalk.bold('Most Active Users:')}`);
        topUsers.forEach(([user, count]) => {
          console.log(`    ${user}: ${count} operations`);
        });
      }
    }
    
    // System info
    if (report.systemInfo) {
      console.log(`\\n${chalk.bold('🖥️  System Information:')}`);
      console.log(`  Hostname: ${report.systemInfo.hostname}`);
      console.log(`  Platform: ${report.systemInfo.platform} ${report.systemInfo.arch}`);
      console.log(`  Memory: ${Math.round(report.systemInfo.memory.total / 1024 / 1024 / 1024)}GB total, ${Math.round(report.systemInfo.memory.free / 1024 / 1024 / 1024)}GB free`);
    }
    
    // Save to file if requested
    if (options.output) {
      await fs.writeFile(options.output, JSON.stringify(report, null, 2));
      console.log(`\\n${chalk.green('✅ Report saved to:')} ${options.output}`);
    }
    
  } catch (error) {
    throw new Error(`Failed to generate audit report: ${error.message}`);
  }
}

/**
 * Export audit logs
 */
async function exportAuditLogs(auditLogger, options) {
  const exportOptions = {
    user: options.user,
    eventType: options.type,
    startDate: options.startDate,
    endDate: options.endDate,
    limit: options.limit ? parseInt(options.limit) : undefined
  };

  try {
    console.log(chalk.blue(`📤 Exporting audit logs in ${options.export.toUpperCase()} format...`));
    
    const exportedData = await auditLogger.exportAuditLogs(options.export, exportOptions);
    
    if (options.output) {
      await fs.writeFile(options.output, exportedData);
      console.log(chalk.green(`✅ Audit logs exported to: ${options.output}`));
    } else {
      // Generate default filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultFile = `audit-export-${timestamp}.${options.export}`;
      await fs.writeFile(defaultFile, exportedData);
      console.log(chalk.green(`✅ Audit logs exported to: ${defaultFile}`));
    }
    
  } catch (error) {
    throw new Error(`Failed to export audit logs: ${error.message}`);
  }
}

/**
 * Show audit statistics
 */
async function showAuditStatistics(auditLogger, options) {
  const queryOptions = {
    user: options.user,
    eventType: options.type,
    startDate: options.startDate,
    endDate: options.endDate
  };

  try {
    const entries = await auditLogger.readAuditLogs(queryOptions);
    
    if (entries.length === 0) {
      console.log(chalk.yellow('No audit entries found for statistics.'));
      return;
    }
    
    console.log(chalk.blue('\\n📊 Audit Statistics\\n'));
    
    // Basic counts
    const successCount = entries.filter(e => e.eventData.success !== false).length;
    const errorCount = entries.length - successCount;
    
    console.log(`${chalk.bold('Overview:')}`);
    console.log(`  Total entries: ${entries.length}`);
    console.log(`  Successful operations: ${chalk.green(successCount)}`);
    console.log(`  Failed operations: ${chalk.red(errorCount)}`);
    console.log(`  Success rate: ${((successCount / entries.length) * 100).toFixed(1)}%`);
    
    // Event type distribution
    const eventTypes = {};
    entries.forEach(entry => {
      eventTypes[entry.eventType] = (eventTypes[entry.eventType] || 0) + 1;
    });
    
    console.log(`\\n${chalk.bold('Event Types:')}`);
    Object.entries(eventTypes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        const percentage = ((count / entries.length) * 100).toFixed(1);
        console.log(`  ${type}: ${count} (${percentage}%)`);
      });
    
    // User activity
    const users = {};
    entries.forEach(entry => {
      const username = entry.context.user.username;
      users[username] = (users[username] || 0) + 1;
    });
    
    console.log(`\\n${chalk.bold('User Activity:')}`);
    Object.entries(users)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([user, count]) => {
        const percentage = ((count / entries.length) * 100).toFixed(1);
        console.log(`  ${user}: ${count} operations (${percentage}%)`);
      });
    
    // Time distribution
    const hours = {};
    entries.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    
    console.log(`\\n${chalk.bold('Activity by Hour:')}`);
    Object.entries(hours)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([hour, count]) => {
        const percentage = ((count / entries.length) * 100).toFixed(1);
        const hourStr = hour.padStart(2, '0') + ':00';
        console.log(`  ${hourStr}: ${count} operations (${percentage}%)`);
      });
    
    // Recent activity
    const recentEntries = entries.slice(0, 5);
    console.log(`\\n${chalk.bold('Recent Activity:')}`);
    recentEntries.forEach(entry => {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const success = entry.eventData.success !== false;
      const statusIcon = success ? chalk.green('✅') : chalk.red('❌');
      console.log(`  ${statusIcon} ${entry.eventType} - ${timestamp} (${entry.context.user.username})`);
    });
    
  } catch (error) {
    throw new Error(`Failed to show audit statistics: ${error.message}`);
  }
}

/**
 * Verify audit log integrity
 */
async function verifyAuditIntegrity(auditLogger) {
  try {
    console.log(chalk.blue('🔍 Verifying audit log integrity...'));
    
    const result = await auditLogger.verifyIntegrity();
    
    console.log(chalk.blue('\\n🛡️  Integrity Verification Results\\n'));
    
    console.log(`${chalk.bold('Total entries:')} ${result.totalEntries}`);
    console.log(`${chalk.bold('Valid entries:')} ${chalk.green(result.validEntries)}`);
    console.log(`${chalk.bold('Corrupted entries:')} ${chalk.red(result.corruptedEntries)}`);
    console.log(`${chalk.bold('Missing integrity:')} ${chalk.yellow(result.missingEntries)}`);
    console.log(`${chalk.bold('Integrity score:')} ${result.integrityScore.toFixed(2)}%`);
    
    if (result.integrityScore === 100) {
      console.log(chalk.green('\\n✅ All audit logs passed integrity verification!'));
    } else if (result.integrityScore >= 95) {
      console.log(chalk.yellow('\\n⚠️  Minor integrity issues detected. Review violations below.'));
    } else {
      console.log(chalk.red('\\n🚨 Significant integrity issues detected! Immediate attention required.'));
    }
    
    // Show violations
    if (result.violations.length > 0) {
      console.log(`\\n${chalk.bold('Integrity Violations:')}`);
      result.violations.slice(0, 10).forEach(violation => {
        console.log(`  ${chalk.red('•')} ${violation.type} in ${path.basename(violation.file)}`);
        console.log(`    Entry ID: ${violation.entryId}`);
        console.log(`    Timestamp: ${violation.timestamp}`);
      });
      
      if (result.violations.length > 10) {
        console.log(`  ${chalk.gray(`... and ${result.violations.length - 10} more violations`)}`);
      }
    }
    
  } catch (error) {
    throw new Error(`Failed to verify audit integrity: ${error.message}`);
  }
}

/**
 * Clean up old audit logs
 */
async function cleanupAuditLogs(auditLogger) {
  try {
    const confirmed = await FeedbackUtils.confirmDestructiveOperation(
      'Clean up old audit logs',
      ['This will remove old audit log files according to retention policy', 'This action cannot be undone']
    );
    
    if (!confirmed) {
      FeedbackUtils.info('Cleanup cancelled');
      return;
    }
    
    console.log(chalk.blue('🧹 Cleaning up old audit logs...'));
    
    // Trigger cleanup by calling the internal method
    await auditLogger.cleanupOldLogFiles();
    
    console.log(chalk.green('✅ Audit log cleanup completed'));
    
  } catch (error) {
    throw new Error(`Failed to cleanup audit logs: ${error.message}`);
  }
}

/**
 * Force log rotation
 */
async function rotateAuditLogs(auditLogger) {
  try {
    console.log(chalk.blue('🔄 Rotating audit logs...'));
    
    // Trigger rotation by calling the internal method
    await auditLogger.rotateLogFile();
    
    console.log(chalk.green('✅ Audit log rotation completed'));
    
  } catch (error) {
    throw new Error(`Failed to rotate audit logs: ${error.message}`);
  }
}

module.exports = auditCommand;/**

 * Run compliance validation
 */
async function runComplianceValidation(complianceReporter, options) {
  try {
    console.log(chalk.blue('🔍 Running compliance validation...'));
    
    await complianceReporter.loadComplianceRules();
    
    const validationOptions = {
      startDate: options.startDate,
      endDate: options.endDate,
      includeDetails: true
    };
    
    const results = await complianceReporter.validateCompliance(validationOptions);
    
    console.log(chalk.blue('\n🛡️  Compliance Validation Results\n'));
    
    // Overall score
    const scoreColor = results.complianceScore >= 90 ? chalk.green : 
                      results.complianceScore >= 70 ? chalk.yellow : chalk.red;
    
    console.log(`${chalk.bold('Compliance Score:')} ${scoreColor(results.complianceScore.toFixed(1) + '%')}`);
    console.log(`${chalk.bold('Risk Level:')} ${getRiskLevelColor(results.riskLevel)(results.riskLevel.toUpperCase())}`);
    console.log(`${chalk.bold('Rules Evaluated:')} ${results.totalRules}`);
    console.log(`${chalk.bold('Rules Passed:')} ${chalk.green(results.passedRules)}`);
    console.log(`${chalk.bold('Rules Failed:')} ${chalk.red(results.failedRules)}`);
    console.log(`${chalk.bold('Total Violations:')} ${results.violations.length}`);
    
    // Violations by severity
    if (results.violations.length > 0) {
      const violationsBySeverity = results.violations.reduce((acc, v) => {
        acc[v.severity] = (acc[v.severity] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`\n${chalk.bold('Violations by Severity:')}`);
      Object.entries(violationsBySeverity).forEach(([severity, count]) => {
        const color = severity === 'critical' ? chalk.red : 
                     severity === 'high' ? chalk.red : 
                     severity === 'medium' ? chalk.yellow : chalk.blue;
        console.log(`  ${color(severity.toUpperCase())}: ${count}`);
      });
      
      // Show top violations
      console.log(`\n${chalk.bold('Top Violations:')}`);
      results.violations
        .sort((a, b) => getSeverityWeight(b.severity) - getSeverityWeight(a.severity))
        .slice(0, 5)
        .forEach(violation => {
          const severityColor = getSeverityColor(violation.severity);
          console.log(`  ${severityColor('•')} ${violation.ruleName} (${violation.category})`);
          console.log(`    ${violation.details}`);
          if (violation.recommendations && violation.recommendations.length > 0) {
            console.log(`    ${chalk.gray('Recommendation:')} ${violation.recommendations[0]}`);
          }
        });
    } else {
      console.log(chalk.green('\n✅ No compliance violations detected!'));
    }
    
    // Show recommendations
    if (results.violations.length > 0) {
      console.log(`\n${chalk.bold('Next Steps:')}`);
      if (results.complianceScore < 70) {
        console.log(chalk.red('  🚨 Immediate action required - compliance score is below acceptable threshold'));
      }
      console.log('  📋 Review violation details above');
      console.log('  📊 Generate detailed compliance report: histofy audit --compliance-report html');
      console.log('  🔧 Address high and critical severity violations first');
    }
    
  } catch (error) {
    throw new Error(`Failed to run compliance validation: ${error.message}`);
  }
}

/**
 * Generate compliance report
 */
async function generateComplianceReport(complianceReporter, options) {
  try {
    console.log(chalk.blue(`📊 Generating compliance report in ${options.complianceReport.toUpperCase()} format...`));
    
    await complianceReporter.loadComplianceRules();
    
    const reportOptions = {
      format: options.complianceReport,
      startDate: options.startDate,
      endDate: options.endDate,
      includeRecommendations: true,
      includeVisualization: true
    };
    
    const report = await complianceReporter.generateComplianceReport(reportOptions);
    
    // Export report
    const filename = await complianceReporter.exportComplianceReport(
      report, 
      options.complianceReport, 
      options.output
    );
    
    console.log(chalk.green(`✅ Compliance report generated: ${filename}`));
    
    // Show summary
    console.log(chalk.blue('\n📈 Report Summary:'));
    console.log(`  Compliance Score: ${report.summary.complianceScore.toFixed(1)}%`);
    console.log(`  Risk Level: ${report.summary.riskLevel.toUpperCase()}`);
    console.log(`  Total Violations: ${report.summary.totalViolations}`);
    console.log(`  Rules Evaluated: ${report.summary.totalRules}`);
    
    if (options.complianceReport === 'html') {
      console.log(chalk.gray('\n💡 Open the HTML file in a web browser to view the interactive report'));
    }
    
  } catch (error) {
    throw new Error(`Failed to generate compliance report: ${error.message}`);
  }
}

/**
 * List compliance rules
 */
async function listComplianceRules(complianceReporter) {
  try {
    await complianceReporter.loadComplianceRules();
    
    console.log(chalk.blue('📋 Compliance Rules\n'));
    
    const rulesByCategory = {};
    for (const rule of complianceReporter.complianceRules.values()) {
      if (!rulesByCategory[rule.category]) {
        rulesByCategory[rule.category] = [];
      }
      rulesByCategory[rule.category].push(rule);
    }
    
    Object.entries(rulesByCategory).forEach(([category, rules]) => {
      console.log(chalk.bold(`${category.replace('_', ' ').toUpperCase()}:`));
      
      rules.forEach(rule => {
        const severityColor = getSeverityColor(rule.severity);
        console.log(`  ${severityColor('•')} ${rule.name} (${rule.id})`);
        console.log(`    ${chalk.gray(rule.description)}`);
        console.log(`    ${chalk.gray('Severity:')} ${severityColor(rule.severity.toUpperCase())}`);
      });
      
      console.log(); // Empty line between categories
    });
    
    console.log(chalk.gray(`Total rules: ${complianceReporter.complianceRules.size}`));
    console.log(chalk.gray('Use --add-rule <file> to add custom rules'));
    console.log(chalk.gray('Use --remove-rule <ruleId> to remove rules'));
    
  } catch (error) {
    throw new Error(`Failed to list compliance rules: ${error.message}`);
  }
}

/**
 * Add compliance rule
 */
async function addComplianceRule(complianceReporter, ruleFile) {
  try {
    const ruleData = await fs.readFile(ruleFile, 'utf8');
    const rule = JSON.parse(ruleData);
    
    // Validate rule structure
    if (!rule.id || !rule.name || !rule.rule) {
      throw new Error('Invalid rule format: missing required fields (id, name, rule)');
    }
    
    await complianceReporter.loadComplianceRules();
    complianceReporter.addComplianceRule(rule);
    await complianceReporter.saveComplianceRules();
    
    console.log(chalk.green(`✅ Compliance rule added: ${rule.name} (${rule.id})`));
    console.log(`   Category: ${rule.category || 'uncategorized'}`);
    console.log(`   Severity: ${rule.severity || 'medium'}`);
    
  } catch (error) {
    throw new Error(`Failed to add compliance rule: ${error.message}`);
  }
}

/**
 * Remove compliance rule
 */
async function removeComplianceRule(complianceReporter, ruleId) {
  try {
    await complianceReporter.loadComplianceRules();
    
    const removed = complianceReporter.removeComplianceRule(ruleId);
    
    if (removed) {
      await complianceReporter.saveComplianceRules();
      console.log(chalk.green(`✅ Compliance rule removed: ${ruleId}`));
    } else {
      console.log(chalk.yellow(`⚠️  Compliance rule not found: ${ruleId}`));
    }
    
  } catch (error) {
    throw new Error(`Failed to remove compliance rule: ${error.message}`);
  }
}

/**
 * Get risk level color
 */
function getRiskLevelColor(riskLevel) {
  switch (riskLevel) {
    case 'critical': return chalk.red;
    case 'high': return chalk.red;
    case 'medium': return chalk.yellow;
    case 'low': return chalk.blue;
    case 'minimal': return chalk.green;
    default: return chalk.gray;
  }
}

/**
 * Get severity color
 */
function getSeverityColor(severity) {
  switch (severity) {
    case 'critical': return chalk.red;
    case 'high': return chalk.red;
    case 'medium': return chalk.yellow;
    case 'low': return chalk.blue;
    default: return chalk.gray;
  }
}

/**
 * Get severity weight for sorting
 */
function getSeverityWeight(severity) {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}/**
 * 
Run comprehensive integrity check
 */
async function runIntegrityCheck(integrityManager) {
  try {
    console.log(chalk.blue('🔍 Running comprehensive integrity check...'));
    
    const checkResult = await integrityManager.performIntegrityCheck();
    
    console.log(chalk.blue('\n🛡️  Integrity Check Results\n'));
    
    // Overall status
    const statusColor = checkResult.overallStatus === 'passed' ? chalk.green : 
                       checkResult.overallStatus === 'failed' ? chalk.red : chalk.yellow;
    
    console.log(`${chalk.bold('Overall Status:')} ${statusColor(checkResult.overallStatus.toUpperCase())}`);
    console.log(`${chalk.bold('Checks Performed:')} ${checkResult.checksPerformed.join(', ')}`);
    console.log(`${chalk.bold('Violations Found:')} ${checkResult.violations.length}`);
    console.log(`${chalk.bold('Timestamp:')} ${checkResult.timestamp}`);
    
    // Show violations
    if (checkResult.violations.length > 0) {
      console.log(`\n${chalk.bold('🚨 Integrity Violations:')}`);
      
      checkResult.violations.forEach((violation, index) => {
        const severityColor = getSeverityColor(violation.severity);
        console.log(`\n  ${index + 1}. ${severityColor(violation.type.toUpperCase())}`);
        console.log(`     ${violation.message}`);
        
        if (violation.details) {
          console.log(`     ${chalk.gray('Details:')} ${JSON.stringify(violation.details, null, 2).substring(0, 200)}...`);
        }
      });
    } else {
      console.log(chalk.green('\n✅ No integrity violations detected!'));
    }
    
    // Show recommendations
    if (checkResult.recommendations && checkResult.recommendations.length > 0) {
      console.log(`\n${chalk.bold('💡 Recommendations:')}`);
      
      checkResult.recommendations.forEach((rec, index) => {
        const priorityColor = rec.priority === 'critical' ? chalk.red : 
                             rec.priority === 'high' ? chalk.yellow : chalk.blue;
        
        console.log(`\n  ${index + 1}. ${priorityColor(`[${rec.priority.toUpperCase()}]`)} ${rec.action}`);
        console.log(`     ${chalk.gray(rec.description)}`);
      });
    }
    
    // Next steps
    if (checkResult.overallStatus === 'failed') {
      console.log(`\n${chalk.bold('🔧 Next Steps:')}`);
      console.log('  1. Address critical and high priority violations immediately');
      console.log('  2. Run integrity check again after fixes');
      console.log('  3. Consider increasing monitoring frequency');
      console.log('  4. Review security measures and access controls');
    }
    
  } catch (error) {
    throw new Error(`Failed to run integrity check: ${error.message}`);
  }
}

/**
 * Create secure backup
 */
async function createSecureBackup(integrityManager, sourceFile, outputPath) {
  try {
    console.log(chalk.blue(`🔒 Creating secure backup of ${sourceFile}...`));
    
    const backupPath = await integrityManager.createSecureBackup(sourceFile, {
      requestedBy: 'cli',
      reason: 'manual_backup'
    });
    
    // Move to custom location if specified
    if (outputPath) {
      await fs.rename(backupPath, outputPath);
      console.log(chalk.green(`✅ Secure backup created: ${outputPath}`));
    } else {
      console.log(chalk.green(`✅ Secure backup created: ${backupPath}`));
    }
    
    console.log(chalk.gray('💡 Backup is encrypted and includes integrity verification'));
    
  } catch (error) {
    throw new Error(`Failed to create secure backup: ${error.message}`);
  }
}

/**
 * Restore from backup
 */
async function restoreFromBackup(integrityManager, backupFile, targetPath) {
  try {
    if (!targetPath) {
      throw new Error('Target path is required for restore operation');
    }
    
    const confirmed = await FeedbackUtils.confirmDestructiveOperation(
      'Restore from backup',
      [
        `This will overwrite the target file: ${targetPath}`,
        'The current file will be lost if not backed up',
        'This action cannot be undone'
      ]
    );
    
    if (!confirmed) {
      FeedbackUtils.info('Restore cancelled');
      return;
    }
    
    console.log(chalk.blue(`🔄 Restoring from backup ${backupFile}...`));
    
    await integrityManager.restoreFromBackup(backupFile, targetPath);
    
    console.log(chalk.green(`✅ Successfully restored to: ${targetPath}`));
    console.log(chalk.gray('💡 Backup integrity was verified before restoration'));
    
  } catch (error) {
    throw new Error(`Failed to restore from backup: ${error.message}`);
  }
}

/**
 * Run tamper scan
 */
async function runTamperScan(integrityManager) {
  try {
    console.log(chalk.blue('🕵️  Scanning for tampering attempts...'));
    
    const tamperResult = await integrityManager.detectTamperingAttempts();
    
    console.log(chalk.blue('\n🔍 Tamper Detection Results\n'));
    
    if (tamperResult.passed) {
      console.log(chalk.green('✅ No tampering attempts detected'));
    } else {
      console.log(chalk.red(`🚨 ${tamperResult.violations.length} potential tampering attempts detected`));
      
      tamperResult.violations.forEach((violation, index) => {
        const severityColor = getSeverityColor(violation.severity);
        console.log(`\n  ${index + 1}. ${severityColor(violation.type.toUpperCase())}`);
        console.log(`     ${violation.message}`);
        
        if (violation.details) {
          if (violation.details.user) {
            console.log(`     ${chalk.gray('User:')} ${violation.details.user}`);
          }
          if (violation.details.timestamp) {
            console.log(`     ${chalk.gray('Time:')} ${violation.details.timestamp}`);
          }
          if (violation.details.description) {
            console.log(`     ${chalk.gray('Details:')} ${violation.details.description}`);
          }
        }
      });
      
      console.log(`\n${chalk.bold('🔧 Recommended Actions:')}`);
      console.log('  1. Investigate suspicious activities immediately');
      console.log('  2. Review user access logs and permissions');
      console.log('  3. Consider implementing additional security measures');
      console.log('  4. Monitor affected users and operations closely');
    }
    
  } catch (error) {
    throw new Error(`Failed to run tamper scan: ${error.message}`);
  }
}

/**
 * Verify integrity chain
 */
async function verifyIntegrityChain(integrityManager) {
  try {
    console.log(chalk.blue('⛓️  Verifying integrity chain...'));
    
    const chainResult = await integrityManager.verifyIntegrityChain();
    
    console.log(chalk.blue('\n🔗 Integrity Chain Verification\n'));
    
    if (chainResult.passed) {
      console.log(chalk.green('✅ Integrity chain verification passed'));
      console.log(`${chalk.bold('Blocks Verified:')} ${chainResult.details.blocksVerified}`);
    } else {
      console.log(chalk.red(`❌ Integrity chain verification failed`));
      console.log(`${chalk.bold('Blocks Verified:')} ${chainResult.details.blocksVerified}`);
      console.log(`${chalk.bold('Violations:')} ${chainResult.violations.length}`);
      
      chainResult.violations.forEach((violation, index) => {
        console.log(`\n  ${index + 1}. ${chalk.red(violation.type.toUpperCase())}`);
        console.log(`     ${violation.message}`);
        
        if (violation.details) {
          if (violation.details.blockIndex !== undefined) {
            console.log(`     ${chalk.gray('Block:')} ${violation.details.blockIndex}`);
          }
          if (violation.details.expected) {
            console.log(`     ${chalk.gray('Expected:')} ${violation.details.expected.substring(0, 16)}...`);
          }
          if (violation.details.actual) {
            console.log(`     ${chalk.gray('Actual:')} ${violation.details.actual.substring(0, 16)}...`);
          }
        }
      });
      
      console.log(`\n${chalk.bold('🚨 Critical Actions Required:')}`);
      console.log('  1. Integrity chain has been compromised');
      console.log('  2. Investigate potential security breach immediately');
      console.log('  3. Consider rebuilding integrity chain from secure backups');
      console.log('  4. Review all recent audit log modifications');
    }
    
  } catch (error) {
    throw new Error(`Failed to verify integrity chain: ${error.message}`);
  }
}