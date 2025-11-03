/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * AuditLogger Tests
 */

const AuditLogger = require('../../src/utils/AuditLogger');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn()
  }
}));

// Mock crypto for consistent testing
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('test-random-bytes')),
  randomUUID: jest.fn(() => 'test-uuid-123'),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'test-hash-123')
  })),
  createCipher: jest.fn(() => ({
    update: jest.fn(() => 'encrypted-data'),
    final: jest.fn(() => 'final-encrypted')
  })),
  createDecipher: jest.fn(() => ({
    update: jest.fn(() => 'decrypted-data'),
    final: jest.fn(() => '')
  }))
}));

describe('AuditLogger', () => {
  let auditLogger;
  let mockOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOptions = {
      logDirectory: '/test/audit',
      maxLogSize: 1024,
      maxLogFiles: 5,
      enableEncryption: false,
      enableIntegrityCheck: true
    };

    // Setup default mock implementations
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.appendFile.mockResolvedValue();
    fs.readdir.mockResolvedValue([]);
    fs.stat.mockResolvedValue({ mtime: new Date(), size: 100 });

    auditLogger = new AuditLogger(mockOptions);
  });

  afterEach(async () => {
    if (auditLogger) {
      await auditLogger.close();
    }
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const logger = new AuditLogger();
      
      expect(logger.options.logDirectory).toContain('.histofy/audit');
      expect(logger.options.maxLogSize).toBe(10 * 1024 * 1024);
      expect(logger.options.maxLogFiles).toBe(10);
      expect(logger.options.enableEncryption).toBe(true);
      expect(logger.options.enableIntegrityCheck).toBe(true);
    });

    test('should merge custom options', () => {
      const customOptions = {
        maxLogSize: 5000,
        enableEncryption: false
      };
      
      const logger = new AuditLogger(customOptions);
      
      expect(logger.options.maxLogSize).toBe(5000);
      expect(logger.options.enableEncryption).toBe(false);
      expect(logger.options.enableIntegrityCheck).toBe(true); // default
    });
  });

  describe('initialization', () => {
    test('should create audit directory', async () => {
      await auditLogger.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        mockOptions.logDirectory,
        { recursive: true }
      );
    });

    test('should setup current log file', async () => {
      await auditLogger.initialize();
      
      expect(auditLogger.currentLogFile).toBeDefined();
      expect(auditLogger.currentLogFile).toContain('audit-');
      expect(auditLogger.currentLogFile).toContain('.log');
    });

    test('should emit initialized event', async () => {
      const initSpy = jest.fn();
      auditLogger.on('initialized', initSpy);
      
      await auditLogger.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      const errorSpy = jest.fn();
      auditLogger.on('error', errorSpy);
      
      await auditLogger.initialize();
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to initialize audit logger')
        })
      );
    });
  });

  describe('encryption', () => {
    test('should initialize encryption key when enabled', async () => {
      const encryptedLogger = new AuditLogger({
        ...mockOptions,
        enableEncryption: true
      });
      
      fs.readFile.mockRejectedValue(new Error('Key file not found'));
      
      await encryptedLogger.initialize();
      
      expect(encryptedLogger.encryptionKey).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.audit-key'),
        expect.any(Buffer),
        { mode: 0o600 }
      );
    });

    test('should load existing encryption key', async () => {
      const encryptedLogger = new AuditLogger({
        ...mockOptions,
        enableEncryption: true
      });
      
      const existingKey = Buffer.from('existing-key');
      fs.readFile.mockResolvedValue(existingKey);
      
      await encryptedLogger.initialize();
      
      expect(encryptedLogger.encryptionKey).toBe(existingKey);
    });
  });

  describe('logEvent', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    test('should create audit entry with required fields', async () => {
      await auditLogger.logEvent('TEST_EVENT', { data: 'test' }, { context: 'test' });
      
      expect(fs.appendFile).toHaveBeenCalled();
      
      const logCall = fs.appendFile.mock.calls[1]; // Skip header
      const logData = JSON.parse(logCall[1]);
      
      expect(logData.id).toBe('test-uuid-123');
      expect(logData.eventType).toBe('TEST_EVENT');
      expect(logData.eventData.data).toBe('test');
      expect(logData.context.context).toBe('test');
      expect(logData.timestamp).toBeDefined();
    });

    test('should sanitize sensitive data', async () => {
      const sensitiveData = {
        username: 'user',
        password: 'secret123',
        token: 'abc123',
        normalData: 'visible'
      };
      
      await auditLogger.logEvent('TEST_EVENT', sensitiveData);
      
      const logCall = fs.appendFile.mock.calls[1];
      const logData = JSON.parse(logCall[1]);
      
      expect(logData.eventData.username).toBe('user');
      expect(logData.eventData.password).toBe('[REDACTED]');
      expect(logData.eventData.token).toBe('[REDACTED]');
      expect(logData.eventData.normalData).toBe('visible');
    });

    test('should add integrity hash when enabled', async () => {
      await auditLogger.logEvent('TEST_EVENT', { data: 'test' });
      
      const logCall = fs.appendFile.mock.calls[1];
      const logData = JSON.parse(logCall[1]);
      
      expect(logData.integrity).toBe('test-hash-123');
    });

    test('should include system context', async () => {
      await auditLogger.logEvent('TEST_EVENT', { data: 'test' });
      
      const logCall = fs.appendFile.mock.calls[1];
      const logData = JSON.parse(logCall[1]);
      
      expect(logData.context.user).toBeDefined();
      expect(logData.context.session).toBeDefined();
      expect(logData.context.system).toBeDefined();
    });

    test('should emit eventLogged event', async () => {
      const eventSpy = jest.fn();
      auditLogger.on('eventLogged', eventSpy);
      
      await auditLogger.logEvent('TEST_EVENT', { data: 'test' });
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TEST_EVENT'
        })
      );
    });

    test('should buffer events before initialization', async () => {
      const uninitializedLogger = new AuditLogger(mockOptions);
      
      await uninitializedLogger.logEvent('BUFFERED_EVENT', { data: 'test' });
      
      expect(uninitializedLogger.logBuffer).toHaveLength(1);
      expect(uninitializedLogger.logBuffer[0].eventType).toBe('BUFFERED_EVENT');
    });
  });

  describe('log rotation', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    test('should rotate log when size limit exceeded', async () => {
      // Mock large log size
      auditLogger.currentLogSize = mockOptions.maxLogSize + 1;
      
      fs.rename.mockResolvedValue();
      
      await auditLogger.logEvent('TEST_EVENT', { data: 'test' });
      
      expect(fs.rename).toHaveBeenCalled();
    });

    test('should emit logRotated event', async () => {
      const rotateSpy = jest.fn();
      auditLogger.on('logRotated', rotateSpy);
      
      fs.rename.mockResolvedValue();
      
      await auditLogger.rotateLogFile();
      
      expect(rotateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          oldFile: expect.any(String),
          newFile: expect.any(String)
        })
      );
    });

    test('should compress rotated logs when enabled', async () => {
      const compressLogger = new AuditLogger({
        ...mockOptions,
        compressionEnabled: true
      });
      
      await compressLogger.initialize();
      
      fs.rename.mockResolvedValue();
      
      // Mock zlib and stream operations
      const mockGzip = {
        pipe: jest.fn().mockReturnThis()
      };
      
      jest.doMock('zlib', () => ({
        createGzip: () => mockGzip
      }));
      
      await compressLogger.rotateLogFile();
      
      expect(fs.rename).toHaveBeenCalled();
    });
  });

  describe('readAuditLogs', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    test('should read and parse log files', async () => {
      const mockLogContent = JSON.stringify({
        id: 'test-1',
        timestamp: '2025-01-01T00:00:00.000Z',
        eventType: 'TEST_EVENT',
        eventData: { data: 'test' },
        context: { user: { username: 'testuser' } },
        integrity: 'test-hash-123'
      }) + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const entries = await auditLogger.readAuditLogs();
      
      expect(entries).toHaveLength(1);
      expect(entries[0].eventType).toBe('TEST_EVENT');
      expect(entries[0].eventData.data).toBe('test');
    });

    test('should filter entries by date range', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T00:00:00.000Z',
          eventType: 'OLD_EVENT',
          eventData: {},
          context: { user: { username: 'user1' } }
        },
        {
          id: 'test-2',
          timestamp: '2025-01-15T00:00:00.000Z',
          eventType: 'NEW_EVENT',
          eventData: {},
          context: { user: { username: 'user2' } }
        }
      ];
      
      const mockLogContent = mockEntries.map(e => JSON.stringify(e)).join('\\n') + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const entries = await auditLogger.readAuditLogs({
        startDate: '2025-01-10',
        endDate: '2025-01-20'
      });
      
      expect(entries).toHaveLength(1);
      expect(entries[0].eventType).toBe('NEW_EVENT');
    });

    test('should filter entries by event type', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T00:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: {},
          context: { user: { username: 'user1' } }
        },
        {
          id: 'test-2',
          timestamp: '2025-01-01T01:00:00.000Z',
          eventType: 'MIGRATION_EXECUTED',
          eventData: {},
          context: { user: { username: 'user1' } }
        }
      ];
      
      const mockLogContent = mockEntries.map(e => JSON.stringify(e)).join('\\n') + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const entries = await auditLogger.readAuditLogs({
        eventType: 'COMMIT_CREATED'
      });
      
      expect(entries).toHaveLength(1);
      expect(entries[0].eventType).toBe('COMMIT_CREATED');
    });

    test('should apply pagination', async () => {
      const mockEntries = Array.from({ length: 10 }, (_, i) => ({
        id: `test-${i}`,
        timestamp: `2025-01-01T${i.toString().padStart(2, '0')}:00:00.000Z`,
        eventType: 'TEST_EVENT',
        eventData: { index: i },
        context: { user: { username: 'user1' } }
      }));
      
      const mockLogContent = mockEntries.map(e => JSON.stringify(e)).join('\\n') + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const entries = await auditLogger.readAuditLogs({
        limit: 5,
        offset: 3
      });
      
      expect(entries).toHaveLength(5);
      expect(entries[0].eventData.index).toBe(6); // Sorted newest first, then offset
    });
  });

  describe('generateAuditReport', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    test('should generate comprehensive report', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T00:00:00.000Z',
          eventType: 'COMMIT_CREATED',
          eventData: { success: true },
          context: { user: { username: 'user1' } }
        },
        {
          id: 'test-2',
          timestamp: '2025-01-01T01:00:00.000Z',
          eventType: 'MIGRATION_EXECUTED',
          eventData: { success: false, error: 'Test error' },
          context: { user: { username: 'user2' } }
        }
      ];
      
      const mockLogContent = mockEntries.map(e => JSON.stringify(e)).join('\\n') + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const report = await auditLogger.generateAuditReport();
      
      expect(report.metadata).toBeDefined();
      expect(report.metadata.totalEntries).toBe(2);
      expect(report.entries).toHaveLength(2);
      expect(report.statistics).toBeDefined();
      expect(report.statistics.successCount).toBe(1);
      expect(report.statistics.errorCount).toBe(1);
    });

    test('should include system information when requested', async () => {
      fs.readdir.mockResolvedValue([]);
      
      const report = await auditLogger.generateAuditReport({
        includeSystemInfo: true
      });
      
      expect(report.systemInfo).toBeDefined();
      expect(report.systemInfo.hostname).toBeDefined();
      expect(report.systemInfo.platform).toBeDefined();
    });
  });

  describe('verifyIntegrity', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    test('should verify log integrity', async () => {
      const mockEntry = {
        id: 'test-1',
        timestamp: '2025-01-01T00:00:00.000Z',
        eventType: 'TEST_EVENT',
        eventData: { data: 'test' },
        context: { user: { username: 'user1' } },
        integrity: 'test-hash-123'
      };
      
      const mockLogContent = JSON.stringify(mockEntry) + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const result = await auditLogger.verifyIntegrity();
      
      expect(result.totalEntries).toBe(1);
      expect(result.validEntries).toBe(1);
      expect(result.corruptedEntries).toBe(0);
      expect(result.integrityScore).toBe(100);
    });

    test('should detect corrupted entries', async () => {
      const mockEntry = {
        id: 'test-1',
        timestamp: '2025-01-01T00:00:00.000Z',
        eventType: 'TEST_EVENT',
        eventData: { data: 'test' },
        context: { user: { username: 'user1' } },
        integrity: 'wrong-hash'
      };
      
      const mockLogContent = JSON.stringify(mockEntry) + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const result = await auditLogger.verifyIntegrity();
      
      expect(result.totalEntries).toBe(1);
      expect(result.validEntries).toBe(0);
      expect(result.corruptedEntries).toBe(1);
      expect(result.integrityScore).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('integrity_mismatch');
    });
  });

  describe('export functionality', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    test('should export to JSON format', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T00:00:00.000Z',
          eventType: 'TEST_EVENT',
          eventData: { data: 'test' },
          context: { user: { username: 'user1' } }
        }
      ];
      
      const mockLogContent = mockEntries.map(e => JSON.stringify(e)).join('\\n') + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const exported = await auditLogger.exportAuditLogs('json');
      
      expect(exported).toBe(JSON.stringify(mockEntries, null, 2));
    });

    test('should export to CSV format', async () => {
      const mockEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-01T00:00:00.000Z',
          eventType: 'TEST_EVENT',
          eventData: { success: true, description: 'Test event' },
          context: { user: { username: 'user1' } }
        }
      ];
      
      const mockLogContent = mockEntries.map(e => JSON.stringify(e)).join('\\n') + '\\n';
      
      fs.readdir.mockResolvedValue(['audit-2025-01-01.log']);
      fs.readFile.mockResolvedValue(mockLogContent);
      
      const exported = await auditLogger.exportAuditLogs('csv');
      
      expect(exported).toContain('timestamp,eventType,user,success,description');
      expect(exported).toContain('2025-01-01T00:00:00.000Z,TEST_EVENT,user1,true');
    });

    test('should throw error for unsupported format', async () => {
      fs.readdir.mockResolvedValue([]);
      
      await expect(auditLogger.exportAuditLogs('unsupported'))
        .rejects.toThrow('Unsupported export format: unsupported');
    });
  });

  describe('singleton pattern', () => {
    test('should return same instance', () => {
      const instance1 = AuditLogger.getInstance();
      const instance2 = AuditLogger.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should use provided options for singleton', () => {
      const options = { maxLogSize: 5000 };
      const instance = AuditLogger.getInstance(options);
      
      expect(instance.options.maxLogSize).toBe(5000);
    });
  });

  describe('cleanup and maintenance', () => {
    beforeEach(async () => {
      await auditLogger.initialize();
    });

    test('should clean up old log files', async () => {
      const oldFiles = Array.from({ length: 10 }, (_, i) => `audit-old-${i}.log.gz`);
      
      fs.readdir.mockResolvedValue(oldFiles);
      fs.stat.mockImplementation((filePath) => {
        const index = parseInt(filePath.match(/audit-old-(\d+)/)[1]);
        return Promise.resolve({
          mtime: new Date(Date.now() - index * 24 * 60 * 60 * 1000) // Different ages
        });
      });
      
      await auditLogger.cleanupOldLogFiles();
      
      // Should remove excess files (keeping only maxLogFiles)
      const expectedRemovals = oldFiles.length - mockOptions.maxLogFiles;
      expect(fs.unlink).toHaveBeenCalledTimes(expectedRemovals);
    });

    test('should handle cleanup errors gracefully', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'));
      
      const errorSpy = jest.fn();
      auditLogger.on('error', errorSpy);
      
      await auditLogger.cleanupOldLogFiles();
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to cleanup old log files')
        })
      );
    });
  });

  describe('close', () => {
    test('should flush buffered logs on close', async () => {
      auditLogger.logBuffer = [
        { eventType: 'BUFFERED_EVENT', eventData: { data: 'test' }, context: {} }
      ];
      
      await auditLogger.initialize();
      await auditLogger.close();
      
      // Should have logged the buffered event
      expect(fs.appendFile).toHaveBeenCalledTimes(2); // Header + buffered event
    });

    test('should emit closed event', async () => {
      const closeSpy = jest.fn();
      auditLogger.on('closed', closeSpy);
      
      await auditLogger.close();
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});