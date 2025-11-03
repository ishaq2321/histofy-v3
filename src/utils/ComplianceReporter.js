/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * ComplianceReporter - Compliance reporting and validation system
 */

const fs = require('fs').promises;
const path = require('path');
const AuditLogger = require('./AuditLogger');
const { EventEmitter } = require('events');

class ComplianceReporter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      rulesFile: options.rulesFile || path.join(process.cwd(), '.histofy-compliance.json'),
      outputDirectory: options.outputDirectory || path.join(process.cwd(), 'compliance-reports'),
      enableVisualization: options.enableVisualization || true,
      reportFormats: options.reportFormats || ['json', 'csv', 'html'],
      complianceLevel: options.complianceLevel || 'standard', // basic, standard, strict
      ...options
    };

    this.complianceRules = new Map();
    this.violations = [];
    this.auditLogger = AuditLogger.getInstance();
    
    this.initializeDefaultRules();
  }

  /**
   * Initialize default compliance rules
   */
  initializeDefaultRules() {
    // Default compliance rules based on common standards
    const defaultRules = [
      {
        id: 'AUDIT_LOG_RETENTION',
        name: 'Audit Log Retention',
        description: 'Audit logs must be retained for minimum period',
        category: 'data_retention',
        severity: 'high',
        rule: {
          type: 'retention_period',
          minDays: 90,
          maxDays: 2555 // 7 years
        }
      },
      {
        id: 'OPERATION_AUTHORIZATION',
        name: 'Operation Authorization',
        description: 'All operations must be performed by authorized users',
        category: 'access_control',
        severity: 'critical',
        rule: {
          type: 'user_authorization',
          requiredRoles: ['admin', 'developer'],
          restrictedOperations: ['MIGRATION_EXECUTED', 'BACKUP_RESTORED']
        }
      },
      {
        id: 'AUDIT_LOG_INTEGRITY',
        name: 'Audit Log Integrity',
        description: 'Audit logs must maintain integrity verification',
        category: 'data_integrity',
        severity: 'critical',
        rule: {
          type: 'integrity_check',
          minIntegrityScore: 95,
          maxCorruptedEntries: 5
        }
      },
      {
        id: 'OPERATION_FREQUENCY',
        name: 'Operation Frequency Limits',
        description: 'Limit frequency of sensitive operations',
        category: 'rate_limiting',
        severity: 'medium',
        rule: {
          type: 'frequency_limit',
          operations: ['MIGRATION_EXECUTED'],
          maxPerHour: 10,
          maxPerDay: 50
        }
      },
      {
        id: 'ERROR_RATE_THRESHOLD',
        name: 'Error Rate Threshold',
        description: 'Error rate must not exceed acceptable threshold',
        category: 'reliability',
        severity: 'high',
        rule: {
          type: 'error_rate',
          maxErrorRate: 0.05, // 5%
          timeWindow: 24 * 60 * 60 * 1000 // 24 hours
        }
      },
      {
        id: 'SENSITIVE_DATA_PROTECTION',
        name: 'Sensitive Data Protection',
        description: 'Sensitive data must be properly redacted in logs',
        category: 'data_protection',
        severity: 'critical',
        rule: {
          type: 'data_redaction',
          sensitiveFields: ['token', 'password', 'key', 'secret', 'auth'],
          redactionPattern: '[REDACTED]'
        }
      },
      {
        id: 'BACKUP_VERIFICATION',
        name: 'Backup Verification',
        description: 'All backups must be verified for integrity',
        category: 'backup_integrity',
        severity: 'high',
        rule: {
          type: 'backup_verification',
          requiredVerification: true,
          maxBackupAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
      }
    ];

    defaultRules.forEach(rule => {
      this.complianceRules.set(rule.id, rule);
    });
  }

  /**
   * Load compliance rules from file
   */
  async loadComplianceRules() {
    try {
      const rulesData = await fs.readFile(this.options.rulesFile, 'utf8');
      const customRules = JSON.parse(rulesData);
      
      if (customRules.rules && Array.isArray(customRules.rules)) {
        customRules.rules.forEach(rule => {
          this.complianceRules.set(rule.id, rule);
        });
      }
      
      this.emit('rulesLoaded', { count: customRules.rules?.length || 0 });
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.emit('error', new Error(`Failed to load compliance rules: ${error.message}`));
      }
      // Use default rules if file doesn't exist
    }
  }

  /**
   * Save compliance rules to file
   */
  async saveComplianceRules() {
    try {
      const rulesData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        complianceLevel: this.options.complianceLevel,
        rules: Array.from(this.complianceRules.values())
      };
      
      await fs.writeFile(this.options.rulesFile, JSON.stringify(rulesData, null, 2));
      this.emit('rulesSaved', { count: rulesData.rules.length });
      
    } catch (error) {
      this.emit('error', new Error(`Failed to save compliance rules: ${error.message}`));
    }
  }

  /**
   * Add or update compliance rule
   */
  addComplianceRule(rule) {
    if (!rule.id || !rule.name || !rule.rule) {
      throw new Error('Invalid compliance rule: missing required fields');
    }
    
    this.complianceRules.set(rule.id, {
      ...rule,
      createdAt: rule.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    this.emit('ruleAdded', rule);
  }

  /**
   * Remove compliance rule
   */
  removeComplianceRule(ruleId) {
    if (this.complianceRules.has(ruleId)) {
      const rule = this.complianceRules.get(ruleId);
      this.complianceRules.delete(ruleId);
      this.emit('ruleRemoved', rule);
      return true;
    }
    return false;
  }

  /**
   * Validate compliance against all rules
   */
  async validateCompliance(options = {}) {
    const {
      startDate,
      endDate,
      includeDetails = true
    } = options;

    this.violations = [];
    const validationResults = {
      timestamp: new Date().toISOString(),
      period: { startDate, endDate },
      totalRules: this.complianceRules.size,
      passedRules: 0,
      failedRules: 0,
      violations: [],
      complianceScore: 0,
      riskLevel: 'low'
    };

    // Get audit data for validation
    const auditEntries = await this.auditLogger.readAuditLogs({
      startDate,
      endDate,
      limit: 10000 // Large limit for comprehensive validation
    });

    // Validate each rule
    for (const [ruleId, rule] of this.complianceRules) {
      try {
        const ruleResult = await this.validateRule(rule, auditEntries);
        
        if (ruleResult.passed) {
          validationResults.passedRules++;
        } else {
          validationResults.failedRules++;
          
          const violation = {
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            description: rule.description,
            details: ruleResult.details,
            violationCount: ruleResult.violationCount || 1,
            firstViolation: ruleResult.firstViolation,
            lastViolation: ruleResult.lastViolation,
            recommendations: ruleResult.recommendations || []
          };
          
          validationResults.violations.push(violation);
          this.violations.push(violation);
        }
        
      } catch (error) {
        this.emit('error', new Error(`Failed to validate rule ${ruleId}: ${error.message}`));
      }
    }

    // Calculate compliance score
    validationResults.complianceScore = validationResults.totalRules > 0 ? 
      (validationResults.passedRules / validationResults.totalRules) * 100 : 100;

    // Determine risk level
    validationResults.riskLevel = this.calculateRiskLevel(validationResults);

    this.emit('complianceValidated', validationResults);
    return validationResults;
  }

  /**
   * Validate individual compliance rule
   */
  async validateRule(rule, auditEntries) {
    switch (rule.rule.type) {
      case 'retention_period':
        return this.validateRetentionPeriod(rule, auditEntries);
      
      case 'user_authorization':
        return this.validateUserAuthorization(rule, auditEntries);
      
      case 'integrity_check':
        return this.validateIntegrityCheck(rule);
      
      case 'frequency_limit':
        return this.validateFrequencyLimit(rule, auditEntries);
      
      case 'error_rate':
        return this.validateErrorRate(rule, auditEntries);
      
      case 'data_redaction':
        return this.validateDataRedaction(rule, auditEntries);
      
      case 'backup_verification':
        return this.validateBackupVerification(rule, auditEntries);
      
      default:
        return { passed: true, details: 'Unknown rule type - skipped' };
    }
  }

  /**
   * Validate retention period compliance
   */
  validateRetentionPeriod(rule, auditEntries) {
    const now = new Date();
    const minRetentionDate = new Date(now.getTime() - rule.rule.minDays * 24 * 60 * 60 * 1000);
    const maxRetentionDate = new Date(now.getTime() - rule.rule.maxDays * 24 * 60 * 60 * 1000);

    const oldestEntry = auditEntries.reduce((oldest, entry) => {
      const entryDate = new Date(entry.timestamp);
      return !oldest || entryDate < new Date(oldest.timestamp) ? entry : oldest;
    }, null);

    if (!oldestEntry) {
      return {
        passed: false,
        details: 'No audit entries found for retention validation',
        recommendations: ['Ensure audit logging is properly configured']
      };
    }

    const oldestDate = new Date(oldestEntry.timestamp);
    
    if (oldestDate > minRetentionDate) {
      return {
        passed: false,
        details: `Oldest audit entry is ${Math.floor((now - oldestDate) / (24 * 60 * 60 * 1000))} days old, minimum required is ${rule.rule.minDays} days`,
        recommendations: [
          'Increase audit log retention period',
          'Review log rotation settings',
          'Consider archiving older logs instead of deletion'
        ]
      };
    }

    if (oldestDate < maxRetentionDate) {
      return {
        passed: false,
        details: `Audit logs are older than maximum retention period of ${rule.rule.maxDays} days`,
        recommendations: [
          'Archive or remove logs older than maximum retention period',
          'Implement automated cleanup for old audit logs'
        ]
      };
    }

    return {
      passed: true,
      details: `Audit log retention complies with policy (${Math.floor((now - oldestDate) / (24 * 60 * 60 * 1000))} days)`
    };
  }

  /**
   * Validate user authorization compliance
   */
  validateUserAuthorization(rule, auditEntries) {
    const violations = [];
    const restrictedOps = rule.rule.restrictedOperations || [];
    
    auditEntries.forEach(entry => {
      if (restrictedOps.includes(entry.eventType)) {
        const user = entry.context?.user?.username;
        const userRoles = entry.context?.user?.roles || ['user']; // Default role
        
        const hasRequiredRole = rule.rule.requiredRoles.some(role => 
          userRoles.includes(role)
        );
        
        if (!hasRequiredRole) {
          violations.push({
            timestamp: entry.timestamp,
            user,
            operation: entry.eventType,
            userRoles,
            requiredRoles: rule.rule.requiredRoles
          });
        }
      }
    });

    if (violations.length > 0) {
      return {
        passed: false,
        violationCount: violations.length,
        firstViolation: violations[0].timestamp,
        lastViolation: violations[violations.length - 1].timestamp,
        details: `${violations.length} unauthorized operations detected`,
        recommendations: [
          'Review user role assignments',
          'Implement proper authorization checks',
          'Add role-based access control (RBAC)'
        ]
      };
    }

    return {
      passed: true,
      details: 'All operations performed by authorized users'
    };
  }

  /**
   * Validate integrity check compliance
   */
  async validateIntegrityCheck(rule) {
    try {
      const integrityResult = await this.auditLogger.verifyIntegrity();
      
      if (integrityResult.integrityScore < rule.rule.minIntegrityScore) {
        return {
          passed: false,
          details: `Integrity score ${integrityResult.integrityScore.toFixed(2)}% is below minimum ${rule.rule.minIntegrityScore}%`,
          violationCount: integrityResult.corruptedEntries,
          recommendations: [
            'Investigate integrity violations',
            'Review audit log storage security',
            'Consider re-generating corrupted entries if possible'
          ]
        };
      }

      if (integrityResult.corruptedEntries > rule.rule.maxCorruptedEntries) {
        return {
          passed: false,
          details: `${integrityResult.corruptedEntries} corrupted entries exceed maximum of ${rule.rule.maxCorruptedEntries}`,
          violationCount: integrityResult.corruptedEntries,
          recommendations: [
            'Investigate source of corruption',
            'Implement additional integrity protection measures',
            'Review file system and storage security'
          ]
        };
      }

      return {
        passed: true,
        details: `Audit log integrity verified (${integrityResult.integrityScore.toFixed(2)}% integrity score)`
      };
      
    } catch (error) {
      return {
        passed: false,
        details: `Failed to verify integrity: ${error.message}`,
        recommendations: ['Fix integrity verification system']
      };
    }
  }

  /**
   * Validate frequency limit compliance
   */
  validateFrequencyLimit(rule, auditEntries) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const violations = [];
    
    rule.rule.operations.forEach(operation => {
      const hourlyOps = auditEntries.filter(entry => 
        entry.eventType === operation && new Date(entry.timestamp) > oneHourAgo
      );
      
      const dailyOps = auditEntries.filter(entry => 
        entry.eventType === operation && new Date(entry.timestamp) > oneDayAgo
      );

      if (hourlyOps.length > rule.rule.maxPerHour) {
        violations.push({
          operation,
          period: 'hourly',
          count: hourlyOps.length,
          limit: rule.rule.maxPerHour
        });
      }

      if (dailyOps.length > rule.rule.maxPerDay) {
        violations.push({
          operation,
          period: 'daily',
          count: dailyOps.length,
          limit: rule.rule.maxPerDay
        });
      }
    });

    if (violations.length > 0) {
      return {
        passed: false,
        violationCount: violations.length,
        details: violations.map(v => 
          `${v.operation}: ${v.count} operations in last ${v.period} (limit: ${v.limit})`
        ).join('; '),
        recommendations: [
          'Implement rate limiting for sensitive operations',
          'Review operation patterns for anomalies',
          'Consider increasing limits if legitimate usage'
        ]
      };
    }

    return {
      passed: true,
      details: 'Operation frequency within acceptable limits'
    };
  }

  /**
   * Validate error rate compliance
   */
  validateErrorRate(rule, auditEntries) {
    const timeWindow = rule.rule.timeWindow;
    const cutoffTime = new Date(Date.now() - timeWindow);
    
    const recentEntries = auditEntries.filter(entry => 
      new Date(entry.timestamp) > cutoffTime
    );

    if (recentEntries.length === 0) {
      return {
        passed: true,
        details: 'No recent operations to evaluate error rate'
      };
    }

    const errorEntries = recentEntries.filter(entry => 
      entry.eventData.success === false || entry.eventData.error
    );

    const errorRate = errorEntries.length / recentEntries.length;

    if (errorRate > rule.rule.maxErrorRate) {
      return {
        passed: false,
        violationCount: errorEntries.length,
        details: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds maximum ${(rule.rule.maxErrorRate * 100).toFixed(2)}%`,
        recommendations: [
          'Investigate root causes of errors',
          'Improve error handling and recovery',
          'Review system stability and performance'
        ]
      };
    }

    return {
      passed: true,
      details: `Error rate ${(errorRate * 100).toFixed(2)}% is within acceptable limits`
    };
  }

  /**
   * Validate data redaction compliance
   */
  validateDataRedaction(rule, auditEntries) {
    const violations = [];
    const sensitiveFields = rule.rule.sensitiveFields;
    const redactionPattern = rule.rule.redactionPattern;

    auditEntries.forEach(entry => {
      const checkObject = (obj, path = '') => {
        if (typeof obj !== 'object' || obj === null) return;
        
        for (const [key, value] of Object.entries(obj)) {
          const fullPath = path ? `${path}.${key}` : key;
          
          if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            if (typeof value === 'string' && value !== redactionPattern) {
              violations.push({
                entryId: entry.id,
                timestamp: entry.timestamp,
                field: fullPath,
                value: value.substring(0, 10) + '...' // Truncated for security
              });
            }
          }
          
          if (typeof value === 'object') {
            checkObject(value, fullPath);
          }
        }
      };

      checkObject(entry.eventData, 'eventData');
      checkObject(entry.context, 'context');
    });

    if (violations.length > 0) {
      return {
        passed: false,
        violationCount: violations.length,
        details: `${violations.length} sensitive data exposures detected`,
        recommendations: [
          'Review data sanitization logic',
          'Ensure all sensitive fields are properly redacted',
          'Update sensitive field detection patterns'
        ]
      };
    }

    return {
      passed: true,
      details: 'All sensitive data properly redacted'
    };
  }

  /**
   * Validate backup verification compliance
   */
  validateBackupVerification(rule, auditEntries) {
    const backupEntries = auditEntries.filter(entry => 
      entry.eventType === 'BACKUP_CREATED'
    );

    const verificationEntries = auditEntries.filter(entry => 
      entry.eventType === 'BACKUP_VERIFIED'
    );

    const unverifiedBackups = [];
    const maxAge = rule.rule.maxBackupAge;

    backupEntries.forEach(backup => {
      const backupTime = new Date(backup.timestamp);
      const isOld = Date.now() - backupTime.getTime() > maxAge;
      
      const hasVerification = verificationEntries.some(verification => 
        verification.eventData.backupId === backup.eventData.backupId ||
        verification.eventData.operationId === backup.eventData.operationId
      );

      if (rule.rule.requiredVerification && !hasVerification && isOld) {
        unverifiedBackups.push({
          backupId: backup.eventData.backupId || backup.eventData.operationId,
          timestamp: backup.timestamp,
          age: Date.now() - backupTime.getTime()
        });
      }
    });

    if (unverifiedBackups.length > 0) {
      return {
        passed: false,
        violationCount: unverifiedBackups.length,
        details: `${unverifiedBackups.length} backups lack required verification`,
        recommendations: [
          'Implement automated backup verification',
          'Verify existing unverified backups',
          'Set up regular backup integrity checks'
        ]
      };
    }

    return {
      passed: true,
      details: 'All backups properly verified'
    };
  }

  /**
   * Calculate risk level based on violations
   */
  calculateRiskLevel(validationResults) {
    const criticalViolations = validationResults.violations.filter(v => v.severity === 'critical').length;
    const highViolations = validationResults.violations.filter(v => v.severity === 'high').length;
    const mediumViolations = validationResults.violations.filter(v => v.severity === 'medium').length;

    if (criticalViolations > 0) return 'critical';
    if (highViolations > 2) return 'high';
    if (highViolations > 0 || mediumViolations > 5) return 'medium';
    if (mediumViolations > 0) return 'low';
    return 'minimal';
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(options = {}) {
    const {
      format = 'json',
      startDate,
      endDate,
      includeRecommendations = true,
      includeVisualization = this.options.enableVisualization
    } = options;

    // Validate compliance
    const validationResults = await this.validateCompliance({ startDate, endDate });

    // Create comprehensive report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        reportType: 'compliance_assessment',
        period: validationResults.period,
        complianceLevel: this.options.complianceLevel,
        format
      },
      summary: {
        complianceScore: validationResults.complianceScore,
        riskLevel: validationResults.riskLevel,
        totalRules: validationResults.totalRules,
        passedRules: validationResults.passedRules,
        failedRules: validationResults.failedRules,
        totalViolations: validationResults.violations.length
      },
      violations: validationResults.violations,
      rulesSummary: this.generateRulesSummary(),
      systemInfo: await this.getSystemComplianceInfo()
    };

    if (includeRecommendations) {
      report.recommendations = this.generateComplianceRecommendations(validationResults);
    }

    if (includeVisualization) {
      report.visualizations = this.generateVisualizationData(validationResults);
    }

    return report;
  }

  /**
   * Generate rules summary
   */
  generateRulesSummary() {
    const summary = {
      totalRules: this.complianceRules.size,
      rulesByCategory: {},
      rulesBySeverity: {}
    };

    for (const rule of this.complianceRules.values()) {
      // By category
      summary.rulesByCategory[rule.category] = (summary.rulesByCategory[rule.category] || 0) + 1;
      
      // By severity
      summary.rulesBySeverity[rule.severity] = (summary.rulesBySeverity[rule.severity] || 0) + 1;
    }

    return summary;
  }

  /**
   * Get system compliance information
   */
  async getSystemComplianceInfo() {
    return {
      auditingEnabled: true,
      encryptionEnabled: this.auditLogger.options.enableEncryption,
      integrityCheckEnabled: this.auditLogger.options.enableIntegrityCheck,
      logRetentionDays: Math.floor(this.auditLogger.options.rotationInterval / (24 * 60 * 60 * 1000)),
      backupEnabled: true,
      complianceRulesCount: this.complianceRules.size
    };
  }

  /**
   * Generate compliance recommendations
   */
  generateComplianceRecommendations(validationResults) {
    const recommendations = [];

    // High-level recommendations based on compliance score
    if (validationResults.complianceScore < 70) {
      recommendations.push({
        priority: 'critical',
        category: 'overall_compliance',
        title: 'Critical Compliance Issues',
        description: 'Compliance score is below acceptable threshold',
        actions: [
          'Address all critical and high severity violations immediately',
          'Review and update compliance policies',
          'Implement additional monitoring and controls'
        ]
      });
    }

    // Risk-based recommendations
    if (validationResults.riskLevel === 'critical' || validationResults.riskLevel === 'high') {
      recommendations.push({
        priority: 'high',
        category: 'risk_mitigation',
        title: 'High Risk Mitigation Required',
        description: `Current risk level: ${validationResults.riskLevel}`,
        actions: [
          'Implement immediate risk mitigation measures',
          'Increase monitoring frequency',
          'Consider temporary restrictions on sensitive operations'
        ]
      });
    }

    // Specific violation-based recommendations
    const violationsByCategory = {};
    validationResults.violations.forEach(violation => {
      if (!violationsByCategory[violation.category]) {
        violationsByCategory[violation.category] = [];
      }
      violationsByCategory[violation.category].push(violation);
    });

    Object.entries(violationsByCategory).forEach(([category, violations]) => {
      const highSeverityCount = violations.filter(v => v.severity === 'critical' || v.severity === 'high').length;
      
      if (highSeverityCount > 0) {
        recommendations.push({
          priority: 'high',
          category,
          title: `${category.replace('_', ' ').toUpperCase()} Issues`,
          description: `${violations.length} violations in ${category} category`,
          actions: violations.flatMap(v => v.recommendations || []).slice(0, 3) // Top 3 unique recommendations
        });
      }
    });

    return recommendations;
  }

  /**
   * Generate visualization data
   */
  generateVisualizationData(validationResults) {
    return {
      complianceScoreChart: {
        type: 'gauge',
        data: {
          score: validationResults.complianceScore,
          target: 95,
          thresholds: [
            { value: 90, color: 'green', label: 'Excellent' },
            { value: 75, color: 'yellow', label: 'Good' },
            { value: 50, color: 'orange', label: 'Fair' },
            { value: 0, color: 'red', label: 'Poor' }
          ]
        }
      },
      violationsByCategory: {
        type: 'pie',
        data: validationResults.violations.reduce((acc, violation) => {
          acc[violation.category] = (acc[violation.category] || 0) + 1;
          return acc;
        }, {})
      },
      violationsBySeverity: {
        type: 'bar',
        data: validationResults.violations.reduce((acc, violation) => {
          acc[violation.severity] = (acc[violation.severity] || 0) + 1;
          return acc;
        }, {})
      },
      complianceTrend: {
        type: 'line',
        data: [] // Would be populated with historical data
      }
    };
  }

  /**
   * Export compliance report in various formats
   */
  async exportComplianceReport(report, format, outputPath) {
    await fs.mkdir(this.options.outputDirectory, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = outputPath || path.join(
      this.options.outputDirectory,
      `compliance-report-${timestamp}.${format}`
    );

    switch (format.toLowerCase()) {
      case 'json':
        await fs.writeFile(filename, JSON.stringify(report, null, 2));
        break;
        
      case 'csv':
        const csvData = this.convertReportToCSV(report);
        await fs.writeFile(filename, csvData);
        break;
        
      case 'html':
        const htmlData = this.convertReportToHTML(report);
        await fs.writeFile(filename, htmlData);
        break;
        
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }

    this.emit('reportExported', { filename, format });
    return filename;
  }

  /**
   * Convert report to CSV format
   */
  convertReportToCSV(report) {
    const lines = [];
    
    // Header
    lines.push('Compliance Report Summary');
    lines.push(`Generated,${report.metadata.generatedAt}`);
    lines.push(`Compliance Score,${report.summary.complianceScore.toFixed(2)}%`);
    lines.push(`Risk Level,${report.summary.riskLevel}`);
    lines.push(`Total Rules,${report.summary.totalRules}`);
    lines.push(`Passed Rules,${report.summary.passedRules}`);
    lines.push(`Failed Rules,${report.summary.failedRules}`);
    lines.push('');
    
    // Violations
    lines.push('Violations');
    lines.push('Rule ID,Rule Name,Category,Severity,Description,Violation Count');
    
    report.violations.forEach(violation => {
      lines.push([
        violation.ruleId,
        violation.ruleName,
        violation.category,
        violation.severity,
        `"${violation.description}"`,
        violation.violationCount || 1
      ].join(','));
    });
    
    return lines.join('\n');
  }

  /**
   * Convert report to HTML format
   */
  convertReportToHTML(report) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .violations { margin: 20px 0; }
        .violation { border-left: 4px solid #ff6b6b; padding: 10px; margin: 10px 0; background: #fff5f5; }
        .violation.high { border-color: #ff6b6b; }
        .violation.medium { border-color: #ffa726; }
        .violation.low { border-color: #ffeb3b; }
        .violation.critical { border-color: #d32f2f; background: #ffebee; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .score { font-size: 2em; font-weight: bold; }
        .score.good { color: #4caf50; }
        .score.fair { color: #ff9800; }
        .score.poor { color: #f44336; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Compliance Assessment Report</h1>
        <p>Generated: ${report.metadata.generatedAt}</p>
        <p>Period: ${report.metadata.period.startDate || 'Beginning'} to ${report.metadata.period.endDate || 'Now'}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Compliance Score</h3>
            <div class="score ${report.summary.complianceScore >= 90 ? 'good' : report.summary.complianceScore >= 70 ? 'fair' : 'poor'}">
                ${report.summary.complianceScore.toFixed(1)}%
            </div>
        </div>
        <div class="metric">
            <h3>Risk Level</h3>
            <div class="score">${report.summary.riskLevel.toUpperCase()}</div>
        </div>
        <div class="metric">
            <h3>Rules Status</h3>
            <p>Passed: ${report.summary.passedRules}</p>
            <p>Failed: ${report.summary.failedRules}</p>
        </div>
        <div class="metric">
            <h3>Violations</h3>
            <div class="score">${report.summary.totalViolations}</div>
        </div>
    </div>
    
    ${report.violations.length > 0 ? `
    <div class="violations">
        <h2>Compliance Violations</h2>
        ${report.violations.map(violation => `
        <div class="violation ${violation.severity}">
            <h4>${violation.ruleName} (${violation.severity.toUpperCase()})</h4>
            <p><strong>Category:</strong> ${violation.category}</p>
            <p><strong>Description:</strong> ${violation.description}</p>
            <p><strong>Details:</strong> ${violation.details}</p>
            ${violation.recommendations ? `
            <p><strong>Recommendations:</strong></p>
            <ul>
                ${violation.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
            ` : ''}
        </div>
        `).join('')}
    </div>
    ` : '<p>No compliance violations detected.</p>'}
    
    ${report.recommendations ? `
    <div class="recommendations">
        <h2>Recommendations</h2>
        ${report.recommendations.map(rec => `
        <div class="violation ${rec.priority}">
            <h4>${rec.title}</h4>
            <p>${rec.description}</p>
            <ul>
                ${rec.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
        </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;
    
    return html;
  }

  /**
   * Get singleton instance
   */
  static getInstance(options = {}) {
    if (!ComplianceReporter.instance) {
      ComplianceReporter.instance = new ComplianceReporter(options);
    }
    return ComplianceReporter.instance;
  }
}

module.exports = ComplianceReporter;