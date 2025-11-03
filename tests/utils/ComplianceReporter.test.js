/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * ComplianceReporter Tests
 */

const ComplianceReporter = require('../../src/utils/ComplianceReporter');
const AuditLogger = require('../../src/utils/AuditLogger');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('../../src/utils/AuditLogger');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

describe('ComplianceReporter', () => {
  let complianceReporter;
  let mockAuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup AuditLogger mock
    mockAuditLogger = {
      readAuditLogs: jest.fn(),
      verifyIntegrity: jest.fn(),
      options: {
        enableEncryption: true,
        enableIntegrityCheck: true,
        rotationInterval: 24 * 60 * 60 * 1000
      }
    };

    AuditLogger.getInstance = jest.fn().mockReturnValue(mockAuditLogger);

    // Setup file system mocks
    fs.readFile.mockRejectedValue({ code: 'ENOENT' }); // No custom rules file
    fs.writeFile.mockResolvedValue();
    fs.mkdir.mockResolvedValue();

    complianceReporter = new ComplianceReporter({
      rulesFile: '/test/compliance-rules.json',
      outputDirectory: '/test/reports'
    });
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const reporter = new ComplianceReporter();
      
      expect(reporter.options.complianceLevel).toBe('standard');
      expect(reporter.options.reportFormats).toContain('json');
      expect(reporter.options.reportFormats).toContain('csv');
      expect(reporter.options.reportFormats).toContain('html');
    });

    test('should initialize default compliance rules', () => {
      expect(complianceReporter.complianceRules.size).toBeGreaterThan(0);
      expect(complianceReporter.complianceRules.has('AUDIT_LOG_RETENTION')).toBe(true);
      expect(complianceReporter.complianceRules.has('OPERATION_AUTHORIZATION')).toBe(true);
      expect(complianceReporter.complianceRules.has('AUDIT_LOG_INTEGRITY')).toBe(true);
    });
  });

  describe('loadComplianceRules', () => {
    test('should load custom rules from file', async () => {
      const customRules = {
        rules: [
          {
            id: 'CUSTOM_RULE',
            name: 'Custom Rule',
            description: 'Custom compliance rule',
            category: 'custom',
            severity: 'medium',
            rule: { type: 'custom_check' }
          }
        ]
      };

      fs.readFile.mockResolvedValue(JSON.stringify(customRules));

      await complianceReporter.loadComplianceRules();

      expect(complianceReporter.complianceRules.has('CUSTOM_RULE')).toBe(true);
      expect(complianceReporter.complianceRules.get('CUSTOM_RULE').name).toBe('Custom Rule');
    });

    test('should handle missing rules file gracefully', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      await complianceReporter.loadComplianceRules();

      // Should still have default rules
      expect(complianceReporter.complianceRules.size).toBeGreaterThan(0);
    });

    test('should emit error for invalid rules file', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      const errorSpy = jest.fn();
      complianceReporter.on('error', errorSpy);

      await complianceReporter.loadComplianceRules();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to load compliance rules')
        })
      );
    });
  });

  describe('addComplianceRule', () => {
    test('should add valid compliance rule', () => {
      const rule = {
        id: 'TEST_RULE',
        name: 'Test Rule',
        description: 'Test compliance rule',
        category: 'test',
        severity: 'low',
        rule: { type: 'test_check' }
      };

      const eventSpy = jest.fn();
      complianceReporter.on('ruleAdded', eventSpy);

      complianceReporter.addComplianceRule(rule);

      expect(complianceReporter.complianceRules.has('TEST_RULE')).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(rule);
    });

    test('should throw error for invalid rule', () => {
      const invalidRule = {
        name: 'Invalid Rule'
        // Missing id and rule fields
      };

      expect(() => {
        complianceReporter.addComplianceRule(invalidRule);
      }).toThrow('Invalid compliance rule: missing required fields');
    });

    test('should update existing rule', () => {
      const rule = {
        id: 'EXISTING_RULE',
        name: 'Original Rule',
        description: 'Original description',
        category: 'test',
        severity: 'low',
        rule: { type: 'test_check' }
      };

      complianceReporter.addComplianceRule(rule);

      const updatedRule = {
        ...rule,
        name: 'Updated Rule',
        description: 'Updated description'
      };

      complianceReporter.addComplianceRule(updatedRule);

      const storedRule = complianceReporter.complianceRules.get('EXISTING_RULE');
      expect(storedRule.name).toBe('Updated Rule');
      expect(storedRule.description).toBe('Updated description');
    });
  });

  describe('removeComplianceRule', () => {
    test('should remove existing rule', () => {
      const rule = {
        id: 'REMOVABLE_RULE',
        name: 'Removable Rule',
        description: 'Rule to be removed',
        category: 'test',
        severity: 'low',
        rule: { type: 'test_check' }
      };

      complianceReporter.addComplianceRule(rule);
      expect(complianceReporter.complianceRules.has('REMOVABLE_RULE')).toBe(true);

      const eventSpy = jest.fn();
      complianceReporter.on('ruleRemoved', eventSpy);

      const result = complianceReporter.removeComplianceRule('REMOVABLE_RULE');

      expect(result).toBe(true);
      expect(complianceReporter.complianceRules.has('REMOVABLE_RULE')).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith(rule);
    });

    test('should return false for non-existent rule', () => {
      const result = complianceReporter.removeComplianceRule('NON_EXISTENT');
      expect(result).toBe(false);
    });
  });

  describe('validateCompliance', () => {
    beforeEach(() => {
      // Setup mock audit data
      mockAuditLogger.readAuditLogs.mockResolvedValue([
        {
          id: 'audit-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: { success: true },
          context: { user: { username: 'testuser', roles: ['developer'] } }
        },
        {
          id: 'audit-2',
          timestamp: '2025-01-01T13:00:00.000Z',
          eventType: 'MIGRATION_EXECUTED',
          eventData: { success: false, error: 'Migration failed' },
          context: { user: { username: 'testuser2', roles: ['user'] } }
        }
      ]);

      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        totalEntries: 100,
        validEntries: 95,
        corruptedEntries: 5,
        integrityScore: 95.0,
        violations: []
      });
    });

    test('should validate all compliance rules', async () => {
      const results = await complianceReporter.validateCompliance();

      expect(results.totalRules).toBeGreaterThan(0);
      expect(results.passedRules).toBeDefined();
      expect(results.failedRules).toBeDefined();
      expect(results.complianceScore).toBeDefined();
      expect(results.riskLevel).toBeDefined();
      expect(Array.isArray(results.violations)).toBe(true);
    });

    test('should calculate compliance score correctly', async () => {
      // Mock all rules to pass
      complianceReporter.complianceRules.clear();
      complianceReporter.addComplianceRule({
        id: 'ALWAYS_PASS',
        name: 'Always Pass Rule',
        description: 'Rule that always passes',
        category: 'test',
        severity: 'low',
        rule: { type: 'retention_period', minDays: 1, maxDays: 365 }
      });

      const results = await complianceReporter.validateCompliance();

      expect(results.complianceScore).toBe(100);
      expect(results.passedRules).toBe(1);
      expect(results.failedRules).toBe(0);
    });

    test('should detect violations and calculate risk level', async () => {
      // Add a rule that will fail
      complianceReporter.complianceRules.clear();
      complianceReporter.addComplianceRule({
        id: 'STRICT_INTEGRITY',
        name: 'Strict Integrity Rule',
        description: 'Requires 100% integrity',
        category: 'data_integrity',
        severity: 'critical',
        rule: { type: 'integrity_check', minIntegrityScore: 100, maxCorruptedEntries: 0 }
      });

      const results = await complianceReporter.validateCompliance();

      expect(results.failedRules).toBe(1);
      expect(results.violations.length).toBe(1);
      expect(results.riskLevel).toBe('critical');
    });

    test('should emit complianceValidated event', async () => {
      const eventSpy = jest.fn();
      complianceReporter.on('complianceValidated', eventSpy);

      await complianceReporter.validateCompliance();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRules: expect.any(Number),
          complianceScore: expect.any(Number)
        })
      );
    });
  });

  describe('rule validation methods', () => {
    const mockAuditEntries = [
      {
        id: 'audit-1',
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        eventType: 'COMMIT_CREATED',
        eventData: { success: true },
        context: { user: { username: 'testuser', roles: ['developer'] } }
      },
      {
        id: 'audit-2',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        eventType: 'MIGRATION_EXECUTED',
        eventData: { success: false, error: 'Test error' },
        context: { user: { username: 'unauthorized', roles: ['user'] } }
      }
    ];

    describe('validateRetentionPeriod', () => {
      test('should pass when retention period is compliant', async () => {
        const rule = {
          rule: { minDays: 7, maxDays: 365 }
        };

        const result = complianceReporter.validateRetentionPeriod(rule, mockAuditEntries);

        expect(result.passed).toBe(true);
        expect(result.details).toContain('complies with policy');
      });

      test('should fail when retention period is too short', async () => {
        const rule = {
          rule: { minDays: 60, maxDays: 365 }
        };

        const result = complianceReporter.validateRetentionPeriod(rule, mockAuditEntries);

        expect(result.passed).toBe(false);
        expect(result.details).toContain('minimum required is 60 days');
        expect(result.recommendations).toBeDefined();
      });

      test('should handle empty audit entries', async () => {
        const rule = {
          rule: { minDays: 30, maxDays: 365 }
        };

        const result = complianceReporter.validateRetentionPeriod(rule, []);

        expect(result.passed).toBe(false);
        expect(result.details).toContain('No audit entries found');
      });
    });

    describe('validateUserAuthorization', () => {
      test('should pass when all operations are authorized', async () => {
        const rule = {
          rule: {
            requiredRoles: ['developer', 'admin'],
            restrictedOperations: ['COMMIT_CREATED']
          }
        };

        const result = complianceReporter.validateUserAuthorization(rule, mockAuditEntries);

        expect(result.passed).toBe(true);
        expect(result.details).toContain('authorized users');
      });

      test('should fail when unauthorized operations detected', async () => {
        const rule = {
          rule: {
            requiredRoles: ['admin'],
            restrictedOperations: ['MIGRATION_EXECUTED']
          }
        };

        const result = complianceReporter.validateUserAuthorization(rule, mockAuditEntries);

        expect(result.passed).toBe(false);
        expect(result.violationCount).toBe(1);
        expect(result.details).toContain('unauthorized operations detected');
      });
    });

    describe('validateIntegrityCheck', () => {
      test('should pass when integrity meets requirements', async () => {
        mockAuditLogger.verifyIntegrity.mockResolvedValue({
          integrityScore: 98.0,
          corruptedEntries: 2
        });

        const rule = {
          rule: { minIntegrityScore: 95, maxCorruptedEntries: 5 }
        };

        const result = await complianceReporter.validateIntegrityCheck(rule);

        expect(result.passed).toBe(true);
        expect(result.details).toContain('98.00% integrity score');
      });

      test('should fail when integrity score is too low', async () => {
        mockAuditLogger.verifyIntegrity.mockResolvedValue({
          integrityScore: 85.0,
          corruptedEntries: 15
        });

        const rule = {
          rule: { minIntegrityScore: 95, maxCorruptedEntries: 10 }
        };

        const result = await complianceReporter.validateIntegrityCheck(rule);

        expect(result.passed).toBe(false);
        expect(result.details).toContain('below minimum 95%');
      });
    });

    describe('validateErrorRate', () => {
      test('should pass when error rate is acceptable', async () => {
        const rule = {
          rule: { maxErrorRate: 0.6, timeWindow: 24 * 60 * 60 * 1000 }
        };

        const result = complianceReporter.validateErrorRate(rule, mockAuditEntries);

        expect(result.passed).toBe(true);
        expect(result.details).toContain('within acceptable limits');
      });

      test('should fail when error rate is too high', async () => {
        const rule = {
          rule: { maxErrorRate: 0.3, timeWindow: 24 * 60 * 60 * 1000 }
        };

        const result = complianceReporter.validateErrorRate(rule, mockAuditEntries);

        expect(result.passed).toBe(false);
        expect(result.details).toContain('exceeds maximum');
      });
    });
  });

  describe('generateComplianceReport', () => {
    beforeEach(() => {
      mockAuditLogger.readAuditLogs.mockResolvedValue([]);
      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        integrityScore: 100,
        corruptedEntries: 0
      });
    });

    test('should generate comprehensive compliance report', async () => {
      const report = await complianceReporter.generateComplianceReport();

      expect(report.metadata).toBeDefined();
      expect(report.metadata.reportType).toBe('compliance_assessment');
      expect(report.summary).toBeDefined();
      expect(report.summary.complianceScore).toBeDefined();
      expect(report.violations).toBeDefined();
      expect(report.rulesSummary).toBeDefined();
      expect(report.systemInfo).toBeDefined();
    });

    test('should include recommendations when requested', async () => {
      const report = await complianceReporter.generateComplianceReport({
        includeRecommendations: true
      });

      expect(report.recommendations).toBeDefined();
    });

    test('should include visualization data when requested', async () => {
      const report = await complianceReporter.generateComplianceReport({
        includeVisualization: true
      });

      expect(report.visualizations).toBeDefined();
      expect(report.visualizations.complianceScoreChart).toBeDefined();
    });
  });

  describe('exportComplianceReport', () => {
    const mockReport = {
      metadata: { generatedAt: '2025-01-01T00:00:00.000Z' },
      summary: { complianceScore: 95.0, riskLevel: 'low' },
      violations: []
    };

    test('should export report in JSON format', async () => {
      const filename = await complianceReporter.exportComplianceReport(
        mockReport, 
        'json', 
        '/test/report.json'
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/report.json',
        JSON.stringify(mockReport, null, 2)
      );
      expect(filename).toBe('/test/report.json');
    });

    test('should export report in CSV format', async () => {
      const filename = await complianceReporter.exportComplianceReport(
        mockReport, 
        'csv', 
        '/test/report.csv'
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/report.csv',
        expect.stringContaining('Compliance Report Summary')
      );
    });

    test('should export report in HTML format', async () => {
      const filename = await complianceReporter.exportComplianceReport(
        mockReport, 
        'html', 
        '/test/report.html'
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/report.html',
        expect.stringContaining('<!DOCTYPE html>')
      );
    });

    test('should generate default filename when none provided', async () => {
      const filename = await complianceReporter.exportComplianceReport(
        mockReport, 
        'json'
      );

      expect(filename).toMatch(/compliance-report-.*\.json$/);
    });

    test('should throw error for unsupported format', async () => {
      await expect(
        complianceReporter.exportComplianceReport(mockReport, 'unsupported')
      ).rejects.toThrow('Unsupported report format: unsupported');
    });

    test('should emit reportExported event', async () => {
      const eventSpy = jest.fn();
      complianceReporter.on('reportExported', eventSpy);

      await complianceReporter.exportComplianceReport(mockReport, 'json', '/test/report.json');

      expect(eventSpy).toHaveBeenCalledWith({
        filename: '/test/report.json',
        format: 'json'
      });
    });
  });

  describe('calculateRiskLevel', () => {
    test('should return critical for critical violations', () => {
      const results = {
        violations: [
          { severity: 'critical' },
          { severity: 'high' }
        ]
      };

      const riskLevel = complianceReporter.calculateRiskLevel(results);
      expect(riskLevel).toBe('critical');
    });

    test('should return high for multiple high violations', () => {
      const results = {
        violations: [
          { severity: 'high' },
          { severity: 'high' },
          { severity: 'high' }
        ]
      };

      const riskLevel = complianceReporter.calculateRiskLevel(results);
      expect(riskLevel).toBe('high');
    });

    test('should return minimal for no violations', () => {
      const results = { violations: [] };

      const riskLevel = complianceReporter.calculateRiskLevel(results);
      expect(riskLevel).toBe('minimal');
    });
  });

  describe('singleton pattern', () => {
    test('should return same instance', () => {
      const instance1 = ComplianceReporter.getInstance();
      const instance2 = ComplianceReporter.getInstance();

      expect(instance1).toBe(instance2);
    });

    test('should use provided options for singleton', () => {
      const options = { complianceLevel: 'strict' };
      const instance = ComplianceReporter.getInstance(options);

      expect(instance.options.complianceLevel).toBe('strict');
    });
  });
});