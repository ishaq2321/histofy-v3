/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * AuditIntegrityManager Tests
 */

const AuditIntegrityManager = require('../../src/utils/AuditIntegrityManager');
const AuditLogger = require('../../src/utils/AuditLogger');
const fs = require('fs').promises;
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../src/utils/AuditLogger');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    rename: jest.fn()
  }
}));

// Mock crypto for consistent testing
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('test-random-bytes')),
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

describe('AuditIntegrityManager', () => {
  let integrityManager;
  let mockAuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup AuditLogger mock
    mockAuditLogger = {
      readAuditLogs: jest.fn(),
      verifyIntegrity: jest.fn(),
      logEvent: jest.fn(),
      getLogFiles: jest.fn(),
      options: {
        logDirectory: '/test/audit-logs'
      }
    };

    AuditLogger.getInstance = jest.fn().mockReturnValue(mockAuditLogger);

    // Setup file system mocks
    fs.mkdir.mockResolvedValue();
    fs.readFile.mockImplementation((filePath) => {
      if (filePath.includes('.master-key')) {
        return Promise.reject({ code: 'ENOENT' });
      }
      if (filePath.includes('integrity-chain.json')) {
        return Promise.reject({ code: 'ENOENT' });
      }
      return Promise.resolve('test file content');
    });
    fs.writeFile.mockResolvedValue();
    fs.readdir.mockResolvedValue([]);
    fs.stat.mockResolvedValue({
      isDirectory: () => true,
      mode: parseInt('644', 8),
      mtime: new Date()
    });

    integrityManager = new AuditIntegrityManager({
      backupDirectory: '/test/backups',
      integrityCheckInterval: 0 // Disable periodic checks for testing
    });
  });

  afterEach(async () => {
    if (integrityManager) {
      await integrityManager.close();
    }
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      const manager = new AuditIntegrityManager();
      
      expect(manager.options.tamperDetectionEnabled).toBe(true);
      expect(manager.options.redundantStorage).toBe(true);
      expect(manager.options.encryptionAlgorithm).toBe('aes-256-gcm');
      expect(manager.options.hashAlgorithm).toBe('sha256');
    });

    test('should merge custom options', () => {
      const customOptions = {
        tamperDetectionEnabled: false,
        blockchainVerification: true
      };
      
      const manager = new AuditIntegrityManager(customOptions);
      
      expect(manager.options.tamperDetectionEnabled).toBe(false);
      expect(manager.options.blockchainVerification).toBe(true);
    });
  });

  describe('initialization', () => {
    test('should create backup directory', async () => {
      await integrityManager.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith('/test/backups', { recursive: true });
    });

    test('should initialize master key', async () => {
      await integrityManager.initialize();
      
      expect(integrityManager.masterKey).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.master-key'),
        expect.any(Buffer),
        { mode: 0o600 }
      );
    });

    test('should initialize integrity chain', async () => {
      await integrityManager.initialize();
      
      expect(integrityManager.integrityChain).toHaveLength(1);
      expect(integrityManager.integrityChain[0].index).toBe(0);
      expect(integrityManager.integrityChain[0].data).toBe('genesis');
    });

    test('should emit initialized event', async () => {
      const initSpy = jest.fn();
      integrityManager.on('initialized', initSpy);
      
      await integrityManager.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('performIntegrityCheck', () => {
    beforeEach(async () => {
      await integrityManager.initialize();
      
      // Setup mock responses
      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        integrityScore: 98.0,
        corruptedEntries: 1,
        violations: []
      });
      
      mockAuditLogger.getLogFiles.mockResolvedValue(['/test/audit-1.log']);
      mockAuditLogger.readAuditLogs.mockResolvedValue([]);
      
      fs.readdir.mockResolvedValue(['audit-backup-1.json']);
    });

    test('should perform comprehensive integrity check', async () => {
      const result = await integrityManager.performIntegrityCheck();
      
      expect(result.timestamp).toBeDefined();
      expect(result.checksPerformed).toContain('audit_log_integrity');
      expect(result.checksPerformed).toContain('file_system_integrity');
      expect(result.checksPerformed).toContain('backup_integrity');
      expect(result.overallStatus).toBeDefined();
    });

    test('should detect integrity violations', async () => {
      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        integrityScore: 85.0,
        corruptedEntries: 10,
        violations: []
      });
      
      const result = await integrityManager.performIntegrityCheck();
      
      expect(result.overallStatus).toBe('failed');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.type === 'low_integrity_score')).toBe(true);
    });

    test('should include tamper detection when enabled', async () => {
      integrityManager.options.tamperDetectionEnabled = true;
      
      const result = await integrityManager.performIntegrityCheck();
      
      expect(result.checksPerformed).toContain('tamper_detection');
    });

    test('should include blockchain verification when enabled', async () => {
      integrityManager.options.blockchainVerification = true;
      
      const result = await integrityManager.performIntegrityCheck();
      
      expect(result.checksPerformed).toContain('integrity_chain');
    });

    test('should generate recommendations', async () => {
      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        integrityScore: 80.0,
        corruptedEntries: 5,
        violations: []
      });
      
      const result = await integrityManager.performIntegrityCheck();
      
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should emit integrityCheckCompleted event', async () => {
      const eventSpy = jest.fn();
      integrityManager.on('integrityCheckCompleted', eventSpy);
      
      await integrityManager.performIntegrityCheck();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          overallStatus: expect.any(String)
        })
      );
    });
  });

  describe('verifyAuditLogIntegrity', () => {
    beforeEach(async () => {
      await integrityManager.initialize();
    });

    test('should pass when integrity is good', async () => {
      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        integrityScore: 98.0,
        corruptedEntries: 0,
        violations: []
      });
      
      const result = await integrityManager.verifyAuditLogIntegrity();
      
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should fail when integrity score is low', async () => {
      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        integrityScore: 85.0,
        corruptedEntries: 0,
        violations: []
      });
      
      const result = await integrityManager.verifyAuditLogIntegrity();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'low_integrity_score')).toBe(true);
    });

    test('should fail when corrupted entries exist', async () => {
      mockAuditLogger.verifyIntegrity.mockResolvedValue({
        integrityScore: 98.0,
        corruptedEntries: 5,
        violations: []
      });
      
      const result = await integrityManager.verifyAuditLogIntegrity();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'corrupted_entries')).toBe(true);
    });
  });

  describe('verifyFileSystemIntegrity', () => {
    beforeEach(async () => {
      await integrityManager.initialize();
      mockAuditLogger.getLogFiles.mockResolvedValue(['/test/audit-1.log']);
    });

    test('should pass when files are intact', async () => {
      // Mock stored hash matches actual hash
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('file-hashes.json')) {
          return Promise.resolve(JSON.stringify({
            '/test/audit-1.log': {
              hash: 'test-hash-123',
              timestamp: new Date().toISOString()
            }
          }));
        }
        return Promise.resolve('test file content');
      });
      
      const result = await integrityManager.verifyFileSystemIntegrity();
      
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect file modifications', async () => {
      // Mock hash mismatch
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('file-hashes.json')) {
          return Promise.resolve(JSON.stringify({
            '/test/audit-1.log': {
              hash: 'different-hash',
              timestamp: new Date().toISOString()
            }
          }));
        }
        return Promise.resolve('modified file content');
      });
      
      const result = await integrityManager.verifyFileSystemIntegrity();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'file_modification_detected')).toBe(true);
    });

    test('should detect insecure file permissions', async () => {
      fs.stat.mockResolvedValue({
        isDirectory: () => false,
        mode: parseInt('777', 8), // Insecure permissions
        mtime: new Date()
      });
      
      const result = await integrityManager.verifyFileSystemIntegrity();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'insecure_file_permissions')).toBe(true);
    });
  });

  describe('detectTamperingAttempts', () => {
    beforeEach(async () => {
      await integrityManager.initialize();
    });

    test('should detect rapid operations', async () => {
      const rapidOperations = Array.from({ length: 15 }, (_, i) => ({
        id: `audit-${i}`,
        timestamp: new Date(Date.now() - (60 - i) * 1000).toISOString(), // 15 ops in 1 minute
        eventType: 'COMMIT_CREATED',
        eventData: { success: true },
        context: { user: { username: 'testuser' } }
      }));
      
      mockAuditLogger.readAuditLogs.mockResolvedValue(rapidOperations);
      
      const result = await integrityManager.detectTamperingAttempts();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'suspicious_activity_detected')).toBe(true);
    });

    test('should detect unusual access times', async () => {
      const nightOperations = [
        {
          id: 'audit-1',
          timestamp: new Date().setHours(2, 0, 0, 0), // 2 AM
          eventType: 'MIGRATION_EXECUTED',
          eventData: { success: true },
          context: { user: { username: 'testuser' } }
        }
      ].map(op => ({ ...op, timestamp: new Date(op.timestamp).toISOString() }));
      
      mockAuditLogger.readAuditLogs.mockResolvedValue(nightOperations);
      
      const result = await integrityManager.detectTamperingAttempts();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'suspicious_activity_detected')).toBe(true);
    });

    test('should detect high operation frequency', async () => {
      const highFrequencyOps = Array.from({ length: 25 }, (_, i) => ({
        id: `audit-${i}`,
        timestamp: new Date(Date.now() - i * 60 * 1000).toISOString(),
        eventType: 'MIGRATION_EXECUTED',
        eventData: { success: true },
        context: { user: { username: 'testuser' } }
      }));
      
      mockAuditLogger.readAuditLogs.mockResolvedValue(highFrequencyOps);
      
      const result = await integrityManager.detectTamperingAttempts();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'suspicious_activity_detected')).toBe(true);
    });
  });

  describe('createSecureBackup', () => {
    beforeEach(async () => {
      await integrityManager.initialize();
    });

    test('should create encrypted backup', async () => {
      const sourceFile = '/test/source.log';
      const sourceContent = 'test audit log content';
      
      fs.readFile.mockResolvedValue(sourceContent);
      
      const backupPath = await integrityManager.createSecureBackup(sourceFile);
      
      expect(backupPath).toContain('audit-backup-');
      expect(fs.writeFile).toHaveBeenCalledWith(
        backupPath,
        expect.any(String),
        { mode: 0o600 }
      );
      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
        'SECURE_BACKUP_CREATED',
        expect.objectContaining({
          originalFile: sourceFile,
          encrypted: true,
          success: true
        })
      );
    });

    test('should emit backupCreated event', async () => {
      const eventSpy = jest.fn();
      integrityManager.on('backupCreated', eventSpy);
      
      fs.readFile.mockResolvedValue('test content');
      
      await integrityManager.createSecureBackup('/test/source.log');
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          backupPath: expect.any(String),
          originalFile: '/test/source.log'
        })
      );
    });

    test('should handle backup creation errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(
        integrityManager.createSecureBackup('/test/nonexistent.log')
      ).rejects.toThrow('Failed to create secure backup');
      
      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
        'SECURE_BACKUP_FAILED',
        expect.objectContaining({
          success: false
        })
      );
    });
  });

  describe('restoreFromBackup', () => {
    beforeEach(async () => {
      await integrityManager.initialize();
    });

    test('should restore from encrypted backup', async () => {
      const backupData = {
        timestamp: new Date().toISOString(),
        originalFile: '/test/original.log',
        checksum: 'test-hash-123',
        data: 'restored content'
      };
      
      const encryptedBackup = JSON.stringify({
        encrypted: true,
        iv: 'test-iv',
        data: 'encrypted-data'
      });
      
      fs.readFile.mockResolvedValue(encryptedBackup);
      
      // Mock decryption to return backup data
      crypto.createDecipher.mockReturnValue({
        update: jest.fn(() => JSON.stringify(backupData)),
        final: jest.fn(() => '')
      });
      
      await integrityManager.restoreFromBackup('/test/backup.json', '/test/target.log');
      
      expect(fs.writeFile).toHaveBeenCalledWith('/test/target.log', 'restored content');
      expect(mockAuditLogger.logEvent).toHaveBeenCalledWith(
        'BACKUP_RESTORED',
        expect.objectContaining({
          success: true
        })
      );
    });

    test('should verify backup integrity before restore', async () => {
      const backupData = {
        timestamp: new Date().toISOString(),
        originalFile: '/test/original.log',
        checksum: 'wrong-checksum',
        data: 'restored content'
      };
      
      fs.readFile.mockResolvedValue(JSON.stringify(backupData));
      
      await expect(
        integrityManager.restoreFromBackup('/test/backup.json', '/test/target.log')
      ).rejects.toThrow('Backup integrity verification failed');
    });

    test('should emit backupRestored event', async () => {
      const eventSpy = jest.fn();
      integrityManager.on('backupRestored', eventSpy);
      
      const backupData = {
        timestamp: new Date().toISOString(),
        originalFile: '/test/original.log',
        checksum: 'test-hash-123',
        data: 'restored content'
      };
      
      fs.readFile.mockResolvedValue(JSON.stringify(backupData));
      
      await integrityManager.restoreFromBackup('/test/backup.json', '/test/target.log');
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          backupPath: '/test/backup.json',
          targetPath: '/test/target.log'
        })
      );
    });
  });

  describe('integrity chain', () => {
    beforeEach(async () => {
      await integrityManager.initialize();
    });

    test('should add entry to integrity chain', async () => {
      const testData = { test: 'data' };
      
      await integrityManager.addToIntegrityChain(testData);
      
      expect(integrityManager.integrityChain).toHaveLength(2); // Genesis + new block
      
      const newBlock = integrityManager.integrityChain[1];
      expect(newBlock.index).toBe(1);
      expect(newBlock.data).toBe(JSON.stringify(testData));
      expect(newBlock.previousHash).toBe(integrityManager.integrityChain[0].hash);
    });

    test('should verify integrity chain', async () => {
      // Add a block to chain
      await integrityManager.addToIntegrityChain({ test: 'data' });
      
      const result = await integrityManager.verifyIntegrityChain();
      
      expect(result.passed).toBe(true);
      expect(result.details.blocksVerified).toBe(2);
    });

    test('should detect chain tampering', async () => {
      // Add a block and then tamper with it
      await integrityManager.addToIntegrityChain({ test: 'data' });
      integrityManager.integrityChain[1].hash = 'tampered-hash';
      
      const result = await integrityManager.verifyIntegrityChain();
      
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.type === 'integrity_chain_hash_mismatch')).toBe(true);
    });

    test('should emit blockAdded event', async () => {
      const eventSpy = jest.fn();
      integrityManager.on('blockAdded', eventSpy);
      
      await integrityManager.addToIntegrityChain({ test: 'data' });
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 1,
          data: JSON.stringify({ test: 'data' })
        })
      );
    });
  });

  describe('periodic integrity checks', () => {
    test('should start periodic checks when interval is set', async () => {
      const manager = new AuditIntegrityManager({
        integrityCheckInterval: 100 // 100ms for testing
      });
      
      const checkSpy = jest.spyOn(manager, 'performIntegrityCheck').mockResolvedValue({});
      
      await manager.initialize();
      
      // Wait for at least one check
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(checkSpy).toHaveBeenCalled();
      
      await manager.close();
    });

    test('should stop periodic checks on close', async () => {
      const manager = new AuditIntegrityManager({
        integrityCheckInterval: 100
      });
      
      await manager.initialize();
      expect(manager.integrityCheckTimer).toBeDefined();
      
      await manager.close();
      expect(manager.integrityCheckTimer).toBeNull();
    });
  });

  describe('singleton pattern', () => {
    test('should return same instance', () => {
      const instance1 = AuditIntegrityManager.getInstance();
      const instance2 = AuditIntegrityManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should use provided options for singleton', () => {
      const options = { tamperDetectionEnabled: false };
      const instance = AuditIntegrityManager.getInstance(options);
      
      expect(instance.options.tamperDetectionEnabled).toBe(false);
    });
  });
});