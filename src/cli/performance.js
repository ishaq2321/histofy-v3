/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Performance CLI Command - Performance monitoring and analysis
 */

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const {
  PerformanceProfiler,
  enableProfiling,
  disableProfiling,
  getSummary,
  generateReport
} = require('../utils/PerformanceProfiler');
const { FeedbackUtils } = require('../utils/feedback');

const performanceCommand = new Command('performance')
  .alias('perf')
  .description('Performance monitoring and analysis tools')
  .option('-e, --enable', 'Enable performance monitoring')
  .option('-d, --disable', 'Disable performance monitoring')
  .option('-s, --summary', 'Show performance summary')
  .option('-r, --report', 'Generate detailed performance report')
  .option('-o, --output <file>', 'Output file for report (JSON format)')
  .option('--export <format>', 'Export performance data (json, csv)', 'json')
  .option('--reset', 'Reset performance data')
  .action(async (options) => {
    try {
      const profiler = PerformanceProfiler.getInstance();

      // Handle enable/disable
      if (options.enable) {
        enableProfiling();
        FeedbackUtils.success('Performance monitoring enabled');
        console.log(chalk.blue('📊 Performance profiling is now active'));
        console.log(chalk.gray('Use --summary or --report to view performance data'));
        return;
      }

      if (options.disable) {
        disableProfiling();
        FeedbackUtils.success('Performance monitoring disabled');
        return;
      }

      // Handle reset
      if (options.reset) {
        const confirmed = await FeedbackUtils.confirmDestructiveOperation(
          'Reset performance data',
          ['All performance metrics and history will be lost']
        );
        
        if (confirmed) {
          profiler.reset();
          FeedbackUtils.success('Performance data reset');
        } else {
          FeedbackUtils.info('Reset cancelled');
        }
        return;
      }

      // Handle summary
      if (options.summary) {
        await showPerformanceSummary();
        return;
      }

      // Handle detailed report
      if (options.report) {
        await showDetailedReport(options.output);
        return;
      }

      // Handle data export
      if (options.export) {
        await exportPerformanceData(options.export, options.output);
        return;
      }

      // Default: show current status
      await showPerformanceStatus();

    } catch (error) {
      FeedbackUtils.error('Performance command failed', error.message);
      process.exit(1);
    }
  });

/**
 * Show current performance status
 */
async function showPerformanceStatus() {
  const summary = getSummary();
  
  console.log(chalk.blue('📊 Performance Monitoring Status\\n'));
  
  if (!summary.enabled) {
    console.log(chalk.yellow('⚠️  Performance monitoring is disabled'));
    console.log(chalk.gray('Use --enable to start monitoring performance'));
    return;
  }

  console.log(chalk.green('✅ Performance monitoring is enabled'));
  console.log(`\\n${chalk.bold('Quick Stats:')}`);
  console.log(`  Operations monitored: ${summary.totalOperations}`);
  console.log(`  Average operation time: ${summary.averageTime}ms`);
  console.log(`  Performance alerts: ${summary.alertCount}`);
  console.log(`  Peak memory usage: ${summary.memoryPeak}`);
  
  if (summary.slowestOperation) {
    console.log(`  Slowest operation: ${summary.slowestOperation.name} (${summary.slowestOperation.duration}ms)`);
  }

  console.log(chalk.gray('\\nUse --summary for detailed information or --report for comprehensive analysis'));
}

/**
 * Show performance summary
 */
async function showPerformanceSummary() {
  const summary = getSummary();
  
  if (!summary.enabled) {
    console.log(chalk.yellow('⚠️  Performance monitoring is disabled'));
    console.log(chalk.gray('Use --enable to start monitoring performance'));
    return;
  }

  console.log(chalk.blue('📈 Performance Summary\\n'));
  
  // Operations overview
  console.log(chalk.bold('Operations Overview:'));
  console.log(`  Total operations: ${summary.totalOperations}`);
  console.log(`  Average time: ${summary.averageTime}ms`);
  
  if (summary.slowestOperation) {
    console.log(`  Slowest: ${chalk.red(summary.slowestOperation.name)} (${summary.slowestOperation.duration}ms)`);
  }
  
  // Memory usage
  console.log(`\\n${chalk.bold('Memory Usage:')}`);
  console.log(`  Peak usage: ${summary.memoryPeak}`);
  
  // Alerts
  console.log(`\\n${chalk.bold('Performance Alerts:')}`);
  if (summary.alertCount > 0) {
    console.log(chalk.yellow(`  ⚠️  ${summary.alertCount} alerts generated`));
  } else {
    console.log(chalk.green('  ✅ No performance alerts'));
  }
  
  // Recommendations
  if (summary.recommendations && summary.recommendations.length > 0) {
    console.log(`\\n${chalk.bold('💡 Recommendations:')}`);
    summary.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }
  
  console.log(chalk.gray('\\nUse --report for detailed analysis with charts and metrics'));
}

/**
 * Show detailed performance report
 */
async function showDetailedReport(outputFile = null) {
  const report = generateReport();
  
  if (!report.enabled) {
    console.log(chalk.yellow('⚠️  Performance monitoring is disabled'));
    console.log(chalk.gray('Use --enable to start monitoring performance'));
    return;
  }

  console.log(chalk.blue('📊 Detailed Performance Report\\n'));
  
  // Report header
  console.log(`${chalk.bold('Generated:')} ${report.timestamp}`);
  console.log(`${chalk.bold('System:')} ${report.systemInfo.platform} ${report.systemInfo.arch}`);
  console.log(`${chalk.bold('CPUs:')} ${report.systemInfo.cpus}`);
  console.log(`${chalk.bold('Memory:')} ${report.systemInfo.memory.totalGB}GB`);
  console.log(`${chalk.bold('Node.js:')} ${report.systemInfo.nodeVersion}`);
  
  // Summary section
  console.log(`\\n${chalk.bold('📈 Summary:')}`);
  console.log(`  Total operations: ${report.summary.totalOperations}`);
  console.log(`  Completed: ${report.summary.completedOperations}`);
  console.log(`  Failed: ${report.summary.failedOperations}`);
  console.log(`  Average time: ${Math.round(report.summary.averageOperationTime)}ms`);
  console.log(`  Peak memory: ${formatBytes(report.summary.peakMemoryUsage)}`);
  console.log(`  Monitoring duration: ${formatDuration(report.summary.monitoringDuration)}`);
  
  // Top slow operations
  if (report.topSlowOperations && report.topSlowOperations.length > 0) {
    console.log(`\\n${chalk.bold('🐌 Slowest Operations:')}`);
    report.topSlowOperations.slice(0, 5).forEach((op, index) => {
      console.log(`  ${index + 1}. ${chalk.yellow(op.name)} - ${op.duration}ms (${op.memoryUsed}MB)`);
    });
  }
  
  // Recent alerts
  if (report.recentAlerts && report.recentAlerts.length > 0) {
    console.log(`\\n${chalk.bold('⚠️  Recent Alerts:')}`);
    report.recentAlerts.slice(0, 5).forEach(alert => {
      const severity = alert.severity === 'warning' ? chalk.yellow : chalk.red;
      console.log(`  ${severity('•')} ${alert.message}`);
    });
  }
  
  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    console.log(`\\n${chalk.bold('💡 Recommendations:')}`);
    report.recommendations.forEach(rec => {
      const priority = rec.priority === 'high' ? chalk.red : 
                      rec.priority === 'medium' ? chalk.yellow : chalk.blue;
      console.log(`  ${priority('•')} [${rec.priority.toUpperCase()}] ${rec.message}`);
      console.log(`    ${chalk.gray(rec.suggestion)}`);
    });
  }
  
  // Save to file if requested
  if (outputFile) {
    try {
      await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
      console.log(`\\n${chalk.green('✅ Report saved to:')} ${outputFile}`);
    } catch (error) {
      console.log(`\\n${chalk.red('❌ Failed to save report:')} ${error.message}`);
    }
  }
  
  console.log(chalk.gray('\\nUse --export to export raw performance data'));
}

/**
 * Export performance data
 */
async function exportPerformanceData(format, outputFile = null) {
  const profiler = PerformanceProfiler.getInstance();
  
  try {
    const data = profiler.exportData(format);
    
    if (!data) {
      console.log(chalk.yellow('⚠️  No performance data available'));
      console.log(chalk.gray('Performance monitoring may be disabled or no operations have been recorded'));
      return;
    }
    
    if (outputFile) {
      await fs.writeFile(outputFile, data);
      console.log(chalk.green(`✅ Performance data exported to: ${outputFile}`));
    } else {
      // Generate default filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultFile = `performance-data-${timestamp}.${format}`;
      await fs.writeFile(defaultFile, data);
      console.log(chalk.green(`✅ Performance data exported to: ${defaultFile}`));
    }
    
  } catch (error) {
    FeedbackUtils.error('Export failed', error.message);
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration to human readable format
 */
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

module.exports = performanceCommand;