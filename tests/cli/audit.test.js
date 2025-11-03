/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * Audit CLI Command Tests
 */

const auditCommand = require('../../src/cli/audit');
const AuditLogger = require('../../src/utils/AuditLogger');
const { FeedbackUtils } = require('../../src/utils/feedback');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('../../src/utils/AuditLogger');
jest.mock('../../src/utils/feedback');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn()
  }
}));

describe('Audit CLI Command', () => {
  let mockAuditLogger;
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup console spy
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation()
    };

    // Setup AuditLogger mock
    mockAuditLogger = {
      readAuditLogs: jest.fn(),
      generateAuditReport: jest.fn(),
      exportAuditLogs: jest.fn(),
      verifyIntegrity: jest.fn(),
      cleanupOldLogFiles: jest.fn(),
      rotateLogFile: jest.fn()
    };

    AuditLogger.getInstance = jest.fn().mockReturnValue(mockAuditLogger);

    // Setup FeedbackUtils mock
    FeedbackUtils.error = jest.fn();
    FeedbackUtils.info = jest.fn();
    FeedbackUtils.confirmDestructiveOperation = jest.fn();
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
  });

  describe('command configuration', () => {
    test('should have correct command name', () => {
      expect(auditCommand.name()).toBe('audit');
    });

    test('should have correct description', () => {
      expect(auditCommand.description()).toBe('Audit logging and compliance management');
    });

    test('should have all required options', () => {
      const options = auditCommand.options;
      const optionFlags = options.map(opt => opt.flags);

      expect(optionFlags).toContain('-l, --list');
      expect(optionFlags).toContain('-s, --search <query>');
      expect(optionFlags).toContain('-u, --user <username>');
      expect(optionFlags).toContain('-t, --type <eventType>');
      expect(optionFlags).toContain('--start-date <date>');
      expect(optionFlags).toContain('--end-date <date>');
      expect(optionFlags).toContain('--limit <number>');
      expect(optionFlags).toContain('--offset <number>');
      expect(optionFlags).toContain('-r, --report');
      expect(optionFlags).toContain('-e, --export <format>');
      expect(optionFlags).toContain('-o, --output <file>');
      expect(optionFlags).toContain('--verify');
      expect(optionFlags).toContain('--stats');
      expect(optionFlags).toContain('--cleanup');
      expect(optionFlags).toContain('--rotate');
    });
  });

  describe('list functionality', () => {
    test('should list audit entries with default options', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: { success: true, description: 'Test commit' },
          context: { user: { username: 'testuser' } }
        },
        {
          id: 'test-2',
          timestamp: '2025-01-01T13:00:00.000Z',
          eventType: 'MIGRATION_EXECUTED',
          eventData: { success: false, error: 'Migration failed' },
          context: { user: { username: 'testuser2' } }
        }
      ];

      mockAuditLogger.readAuditLogs.mockResolvedValue(mockEntries);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ limit: '50', offset: '0' });

      expect(mockAuditLogger.readAuditLogs).toHaveBeenCalledWith({
        user: undefined,
        eventType: undefined,
        startDate: undefined,
        endDate: undefined,
        limit: 50,
        offset: 0
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📋 Audit Log Entries (2 entries)')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ COMMIT_CREATED')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('❌ MIGRATION_EXECUTED')
      );
    });

    test('should filter entries by user', async () => {
      mockAuditLogger.readAuditLogs.mockResolvedValue([]);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ user: 'testuser', limit: '50', offset: '0' });

      expect(mockAuditLogger.readAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'testuser'
        })
      );
    });

    test('should filter entries by event type', async () => {
      mockAuditLogger.readAuditLogs.mockResolvedValue([]);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ type: 'COMMIT_CREATED', limit: '50', offset: '0' });

      expect(mockAuditLogger.readAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'COMMIT_CREATED'
        })
      );
    });

    test('should filter entries by date range', async () => {
      mockAuditLogger.readAuditLogs.mockResolvedValue([]);

      const mockAction = auditCommand._actionHandler;
      await mockAction({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        limit: '50',
        offset: '0'
      });

      expect(mockAuditLogger.readAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        })
      );
    });

    test('should handle empty results', async () => {
      mockAuditLogger.readAuditLogs.mockResolvedValue([]);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ limit: '50', offset: '0' });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No audit entries found matching the criteria.')
      );
    });

    test('should show pagination info', async () => {
      const mockEntries = Array.from({ length: 50 }, (_, i) => ({
        id: `test-${i}`,
        timestamp: '2025-01-01T12:00:00.000Z',
        eventType: 'TEST_EVENT',
        eventData: { success: true },
        context: { user: { username: 'testuser' } }
      }));

      mockAuditLogger.readAuditLogs.mockResolvedValue(mockEntries);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ limit: '50', offset: '0' });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Use --offset 50 to see more')
      );
    });
  });

  describe('report functionality', () => {
    test('should generate audit report', async () => {
      const mockReport = {
        metadata: {
          generatedAt: '2025-01-01T12:00:00.000Z',
          period: {
            startDate: 'beginning',
            endDate: 'now'
          },
          totalEntries: 100
        },
        statistics: {
          successCount: 80,
          errorCount: 20,
          eventTypes: {
            'COMMIT_CREATED': 50,
            'MIGRATION_EXECUTED': 30,
            'BACKUP_CREATED': 20
          },
          users: {
            'user1': 60,
            'user2': 40
          }
        },
        systemInfo: {
          hostname: 'test-host',
          platform: 'linux',
          arch: 'x64',
          memory: {
            total: 8 * 1024 * 1024 * 1024,
            free: 4 * 1024 * 1024 * 1024
          }
        }
      };

      mockAuditLogger.generateAuditReport.mockResolvedValue(mockReport);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ report: true });

      expect(mockAuditLogger.generateAuditReport).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        format: 'json',
        includeSystemInfo: true,
        includeStatistics: true
      });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📈 Audit Report Summary')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Total Entries: 100')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Successful operations: 80')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Failed operations: 20')
      );
    });

    test('should save report to file when output specified', async () => {
      const mockReport = {
        metadata: {
          generatedAt: '2025-01-01T12:00:00.000Z',
          period: { startDate: 'beginning', endDate: 'now' },
          totalEntries: 10
        }
      };

      mockAuditLogger.generateAuditReport.mockResolvedValue(mockReport);
      fs.writeFile.mockResolvedValue();

      const mockAction = auditCommand._actionHandler;
      await mockAction({ report: true, output: 'report.json' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        'report.json',
        JSON.stringify(mockReport, null, 2)
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Report saved to: report.json')
      );
    });
  });

  describe('export functionality', () => {
    test('should export audit logs in JSON format', async () => {
      const mockExportData = JSON.stringify([
        { id: 'test-1', eventType: 'TEST_EVENT' }
      ], null, 2);

      mockAuditLogger.exportAuditLogs.mockResolvedValue(mockExportData);
      fs.writeFile.mockResolvedValue();

      const mockAction = auditCommand._actionHandler;
      await mockAction({ export: 'json', output: 'export.json' });

      expect(mockAuditLogger.exportAuditLogs).toHaveBeenCalledWith('json', {
        user: undefined,
        eventType: undefined,
        startDate: undefined,
        endDate: undefined,
        limit: undefined
      });

      expect(fs.writeFile).toHaveBeenCalledWith('export.json', mockExportData);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Audit logs exported to: export.json')
      );
    });

    test('should generate default filename when no output specified', async () => {
      const mockExportData = 'test,data';

      mockAuditLogger.exportAuditLogs.mockResolvedValue(mockExportData);
      fs.writeFile.mockResolvedValue();

      const mockAction = auditCommand._actionHandler;
      await mockAction({ export: 'csv' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/audit-export-.*\\.csv/),
        mockExportData
      );
    });

    test('should apply filters to export', async () => {
      mockAuditLogger.exportAuditLogs.mockResolvedValue('{}');
      fs.writeFile.mockResolvedValue();

      const mockAction = auditCommand._actionHandler;
      await mockAction({
        export: 'json',
        user: 'testuser',
        type: 'COMMIT_CREATED',
        startDate: '2025-01-01',
        limit: '100'
      });

      expect(mockAuditLogger.exportAuditLogs).toHaveBeenCalledWith('json', {
        user: 'testuser',
        eventType: 'COMMIT_CREATED',
        startDate: '2025-01-01',
        endDate: undefined,
        limit: 100
      });
    });
  });

  describe('statistics functionality', () => {
    test('should show audit statistics', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T10:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: { success: true },
          context: { user: { username: 'user1' } }
        },
        {
          id: 'test-2',
          timestamp: '2025-01-01T14:00:00.000Z',
          eventType: 'MIGRATION_EXECUTED',
          eventData: { success: false, error: 'Test error' },
          context: { user: { username: 'user2' } }
        },
        {
          id: 'test-3',
          timestamp: '2025-01-01T16:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: { success: true },
          context: { user: { username: 'user1' } }
        }
      ];

      mockAuditLogger.readAuditLogs.mockResolvedValue(mockEntries);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ stats: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 Audit Statistics')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Total entries: 3')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Successful operations: 2')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Failed operations: 1')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Success rate: 66.7%')
      );
    });

    test('should show event type distribution', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: { success: true },
          context: { user: { username: 'user1' } }
        },
        {
          id: 'test-2',
          timestamp: '2025-01-01T12:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: { success: true },
          context: { user: { username: 'user1' } }
        },
        {
          id: 'test-3',
          timestamp: '2025-01-01T12:00:00.000Z',
          eventType: 'MIGRATION_EXECUTED',
          eventData: { success: true },
          context: { user: { username: 'user1' } }
        }
      ];

      mockAuditLogger.readAuditLogs.mockResolvedValue(mockEntries);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ stats: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Event Types:')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('COMMIT_CREATED: 2 (66.7%)')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('MIGRATION_EXECUTED: 1 (33.3%)')
      );
    });

    test('should handle empty statistics', async () => {
      mockAuditLogger.readAuditLogs.mockResolvedValue([]);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ stats: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No audit entries found for statistics.')
      );
    });
  });

  describe('verification functionality', () => {
    test('should verify audit log integrity', async () => {
      const mockResult = {
        totalEntries: 100,
        validEntries: 95,
        corruptedEntries: 3,
        missingEntries: 2,
        integrityScore: 95.0,
        violations: [
          {
            file: '/path/to/audit-log.log',
            entryId: 'test-1',
            timestamp: '2025-01-01T12:00:00.000Z',
            type: 'integrity_mismatch'
          },
          {
            file: '/path/to/audit-log.log',
            entryId: 'test-2',
            timestamp: '2025-01-01T13:00:00.000Z',
            type: 'missing_integrity'
          }
        ]
      };

      mockAuditLogger.verifyIntegrity.mockResolvedValue(mockResult);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ verify: true });

      expect(mockAuditLogger.verifyIntegrity).toHaveBeenCalled();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🛡️  Integrity Verification Results')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Total entries: 100')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Valid entries: 95')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Corrupted entries: 3')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Integrity score: 95.00%')
      );
    });

    test('should show perfect integrity message', async () => {
      const mockResult = {
        totalEntries: 100,
        validEntries: 100,
        corruptedEntries: 0,
        missingEntries: 0,
        integrityScore: 100.0,
        violations: []
      };

      mockAuditLogger.verifyIntegrity.mockResolvedValue(mockResult);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ verify: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ All audit logs passed integrity verification!')
      );
    });

    test('should show critical integrity warning', async () => {
      const mockResult = {
        totalEntries: 100,
        validEntries: 50,
        corruptedEntries: 50,
        missingEntries: 0,
        integrityScore: 50.0,
        violations: []
      };

      mockAuditLogger.verifyIntegrity.mockResolvedValue(mockResult);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ verify: true });

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Significant integrity issues detected!')
      );
    });
  });

  describe('cleanup functionality', () => {
    test('should clean up audit logs when confirmed', async () => {
      FeedbackUtils.confirmDestructiveOperation.mockResolvedValue(true);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ cleanup: true });

      expect(FeedbackUtils.confirmDestructiveOperation).toHaveBeenCalledWith(
        'Clean up old audit logs',
        expect.arrayContaining([
          expect.stringContaining('This will remove old audit log files')
        ])
      );
      expect(mockAuditLogger.cleanupOldLogFiles).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Audit log cleanup completed')
      );
    });

    test('should cancel cleanup when not confirmed', async () => {
      FeedbackUtils.confirmDestructiveOperation.mockResolvedValue(false);

      const mockAction = auditCommand._actionHandler;
      await mockAction({ cleanup: true });

      expect(mockAuditLogger.cleanupOldLogFiles).not.toHaveBeenCalled();
      expect(FeedbackUtils.info).toHaveBeenCalledWith('Cleanup cancelled');
    });
  });

  describe('rotation functionality', () => {
    test('should force log rotation', async () => {
      const mockAction = auditCommand._actionHandler;
      await mockAction({ rotate: true });

      expect(mockAuditLogger.rotateLogFile).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Audit log rotation completed')
      );
    });
  });

  describe('error handling', () => {
    test('should handle audit logger errors', async () => {
      mockAuditLogger.readAuditLogs.mockRejectedValue(new Error('Audit error'));

      const mockAction = auditCommand._actionHandler;
      
      // Mock process.exit to prevent test termination
      const mockExit = jest.spyOn(process, 'exit').mockImplementation();

      await mockAction({ limit: '50', offset: '0' });

      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Audit command failed',
        'Failed to list audit entries: Audit error'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    test('should handle file write errors', async () => {
      mockAuditLogger.exportAuditLogs.mockResolvedValue('test data');
      fs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const mockAction = auditCommand._actionHandler;
      const mockExit = jest.spyOn(process, 'exit').mockImplementation();

      await mockAction({ export: 'json', output: 'test.json' });

      expect(FeedbackUtils.error).toHaveBeenCalledWith(
        'Audit command failed',
        expect.stringContaining('Permission denied')
      );

      mockExit.mockRestore();
    });
  });
});