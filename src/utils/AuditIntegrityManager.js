/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * AuditIntegrityManager - Advanced audit log integrity and security management
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const AuditLogger = require('./AuditLogger');

class AuditIntegrityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      backupDirectory: options.backupDirectory || path.join(process.cwd(), '.histofy', 'audit-backups'),
      integrityCheckInterval: options.integrityCheckInterval || 60 * 60 * 1000, // 1 hour
      tamperDetectionEnabled: options.tamperDetectionEnabled || true,
      blockchainVerification: options.blockchainVerification || false,
      redundantStorage: options.redundantStorage || true,
      encryptionAlgorithm: options.encryptionAlgorithm || 'aes-256-gcm',
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      ...options
    };

    this.auditLogger = AuditLogger.getInstance();
    this.integrityCheckTimer = null;
    this.masterKey = null;
    this.integrityChain = [];
    this.tamperAlerts = [];
    
    this.initialize();
  }

  /**
   * Initialize integrity manager
   */
  async initialize() {
    try {
      // Create backup directory
      await fs.mkdir(this.options.backupDirectory, { recursive: true });
      
      // Initialize master key for integrity verification
      await this.initializeMasterKey();
      
      // Start periodic integrity checks
      if (this.options.integrityCheckInterval > 0) {
        this.startPeriodicIntegrityChecks();
      }
      
      // Initialize integrity chain
      await this.initializeIntegrityChain();
      
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize integrity manager: ${error.message}`));
    }
  }

  /**
   * Initialize master key for integrity verification
   */
  async initializeMasterKey() {
    const keyFile = path.join(this.options.backupDirectory, '.master-key');
    
    try {
      // Try to load existing key
      const keyData = await fs.readFile(keyFile);
      this.masterKey = keyData;
    } catch (error) {
      // Generate new master key
      this.masterKey = crypto.randomBytes(32);
      await fs.writeFile(keyFile, this.masterKey, { mode: 0o600 });
    }
  }

  /**
   * Initialize integrity chain for blockchain-like verification
   */
  async initializeIntegrityChain() {
    const chainFile = path.join(this.options.backupDirectory, 'integrity-chain.json');
    
    try {
      const chainData = await fs.readFile(chainFile, 'utf8');
      this.integrityChain = JSON.parse(chainData);
    } catch (error) {
      // Initialize new chain with genesis block
      this.integrityChain = [{
        index: 0,
        timestamp: new Date().toISOString(),
        previousHash: '0',
        hash: this.calculateBlockHash(0, new Date().toISOString(), '0', 'genesis'),
        data: 'genesis',
        nonce: 0
      }];
      
      await this.saveIntegrityChain();
    }
  }

  /**
   * Start periodic integrity checks
   */
  startPeriodicIntegrityChecks() {
    this.integrityCheckTimer = setInterval(async () => {
      try {
        await this.performIntegrityCheck();
      } catch (error) {
        this.emit('error', new Error(`Periodic integrity check failed: ${error.message}`));
      }
    }, this.options.integrityCheckInterval);
  }

  /**
   * Stop periodic integrity checks
   */
  stopPeriodicIntegrityChecks() {
    if (this.integrityCheckTimer) {
      clearInterval(this.integrityCheckTimer);
      this.integrityCheckTimer = null;
    }
  }

  /**
   * Perform comprehensive integrity check
   */
  async performIntegrityCheck() {
    const checkResult = {
      timestamp: new Date().toISOString(),
      checksPerformed: [],
      violations: [],
      overallStatus: 'passed',
      recommendations: []
    };

    try {
      // 1. Verify audit log integrity
      const auditIntegrity = await this.verifyAuditLogIntegrity();
      checkResult.checksPerformed.push('audit_log_integrity');
      
      if (!auditIntegrity.passed) {
        checkResult.violations.push(...auditIntegrity.violations);
        checkResult.overallStatus = 'failed';
      }

      // 2. Verify file system integrity
      const fileSystemIntegrity = await this.verifyFileSystemIntegrity();
      checkResult.checksPerformed.push('file_system_integrity');
      
      if (!fileSystemIntegrity.passed) {
        checkResult.violations.push(...fileSystemIntegrity.violations);
        checkResult.overallStatus = 'failed';
      }

      // 3. Verify backup integrity
      const backupIntegrity = await this.verifyBackupIntegrity();
      checkResult.checksPerformed.push('backup_integrity');
      
      if (!backupIntegrity.passed) {
        checkResult.violations.push(...backupIntegrity.violations);
        checkResult.overallStatus = 'failed';
      }

      // 4. Verify integrity chain
      if (this.options.blockchainVerification) {
        const chainIntegrity = await this.verifyIntegrityChain();
        checkResult.checksPerformed.push('integrity_chain');
        
        if (!chainIntegrity.passed) {
          checkResult.violations.push(...chainIntegrity.violations);
          checkResult.overallStatus = 'failed';
        }
      }

      // 5. Detect tampering attempts
      if (this.options.tamperDetectionEnabled) {
        const tamperDetection = await this.detectTamperingAttempts();
        checkResult.checksPerformed.push('tamper_detection');
        
        if (tamperDetection.violations.length > 0) {
          checkResult.violations.push(...tamperDetection.violations);
          checkResult.overallStatus = 'failed';
        }
      }

      // Generate recommendations
      checkResult.recommendations = this.generateIntegrityRecommendations(checkResult);

      // Log integrity check result
      await this.auditLogger.logEvent('INTEGRITY_CHECK_COMPLETED', {
        status: checkResult.overallStatus,
        checksPerformed: checkResult.checksPerformed.length,
        violationsFound: checkResult.violations.length,
        success: checkResult.overallStatus === 'passed'
      });

      // Add to integrity chain
      if (this.options.blockchainVerification) {
        await this.addToIntegrityChain(checkResult);
      }

      this.emit('integrityCheckCompleted', checkResult);
      return checkResult;

    } catch (error) {
      checkResult.overallStatus = 'error';
      checkResult.violations.push({
        type: 'integrity_check_error',
        severity: 'critical',
        message: error.message,
        timestamp: new Date().toISOString()
      });

      this.emit('error', error);
      return checkResult;
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyAuditLogIntegrity() {
    try {
      const integrityResult = await this.auditLogger.verifyIntegrity();
      
      const violations = [];
      
      if (integrityResult.integrityScore < 95) {
        violations.push({
          type: 'low_integrity_score',
          severity: 'high',
          message: `Audit log integrity score ${integrityResult.integrityScore.toFixed(2)}% is below acceptable threshold`,
          details: integrityResult
        });
      }

      if (integrityResult.corruptedEntries > 0) {
        violations.push({
          type: 'corrupted_entries',
          severity: 'critical',
          message: `${integrityResult.corruptedEntries} corrupted audit entries detected`,
          details: integrityResult.violations
        });
      }

      return {
        passed: violations.length === 0,
        violations,
        details: integrityResult
      };

    } catch (error) {
      return {
        passed: false,
        violations: [{
          type: 'integrity_verification_failed',
          severity: 'critical',
          message: `Failed to verify audit log integrity: ${error.message}`
        }]
      };
    }
  }

  /**
   * Verify file system integrity
   */
  async verifyFileSystemIntegrity() {
    const violations = [];
    
    try {
      // Check audit log files
      const logFiles = await this.auditLogger.getLogFiles();
      
      for (const logFile of logFiles) {
        try {
          const stats = await fs.stat(logFile);
          const content = await fs.readFile(logFile);
          
          // Verify file hasn't been modified unexpectedly
          const expectedHash = await this.getStoredFileHash(logFile);
          const actualHash = crypto.createHash(this.options.hashAlgorithm).update(content).digest('hex');
          
          if (expectedHash && expectedHash !== actualHash) {
            violations.push({
              type: 'file_modification_detected',
              severity: 'critical',
              message: `Unauthorized modification detected in ${path.basename(logFile)}`,
              details: { file: logFile, expectedHash, actualHash }
            });
          } else {
            // Store/update file hash
            await this.storeFileHash(logFile, actualHash);
          }
          
          // Check file permissions
          const mode = stats.mode & parseInt('777', 8);
          if (mode > parseInt('644', 8)) {
            violations.push({
              type: 'insecure_file_permissions',
              severity: 'medium',
              message: `Insecure file permissions on ${path.basename(logFile)}`,
              details: { file: logFile, permissions: mode.toString(8) }
            });
          }
          
        } catch (error) {
          violations.push({
            type: 'file_access_error',
            severity: 'high',
            message: `Cannot access audit log file: ${error.message}`,
            details: { file: logFile }
          });
        }
      }

      return {
        passed: violations.length === 0,
        violations
      };

    } catch (error) {
      return {
        passed: false,
        violations: [{
          type: 'file_system_check_failed',
          severity: 'critical',
          message: `File system integrity check failed: ${error.message}`
        }]
      };
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity() {
    const violations = [];
    
    try {
      // Check if backup directory exists and is accessible
      const backupStats = await fs.stat(this.options.backupDirectory);
      
      if (!backupStats.isDirectory()) {
        violations.push({
          type: 'backup_directory_invalid',
          severity: 'critical',
          message: 'Backup directory is not a valid directory'
        });
        
        return { passed: false, violations };
      }

      // List backup files
      const backupFiles = await fs.readdir(this.options.backupDirectory);
      const auditBackups = backupFiles.filter(file => file.startsWith('audit-backup-'));
      
      // Verify each backup
      for (const backupFile of auditBackups) {
        const backupPath = path.join(this.options.backupDirectory, backupFile);
        
        try {
          const backupContent = await fs.readFile(backupPath);
          const backupData = JSON.parse(backupContent.toString());
          
          // Verify backup structure
          if (!backupData.timestamp || !backupData.originalFile || !backupData.checksum) {
            violations.push({
              type: 'invalid_backup_structure',
              severity: 'high',
              message: `Invalid backup structure in ${backupFile}`,
              details: { file: backupPath }
            });
            continue;
          }
          
          // Verify backup checksum
          const calculatedChecksum = crypto
            .createHash(this.options.hashAlgorithm)
            .update(JSON.stringify(backupData.data))
            .digest('hex');
          
          if (calculatedChecksum !== backupData.checksum) {
            violations.push({
              type: 'backup_checksum_mismatch',
              severity: 'critical',
              message: `Backup checksum mismatch in ${backupFile}`,
              details: { 
                file: backupPath, 
                expected: backupData.checksum, 
                actual: calculatedChecksum 
              }
            });
          }
          
        } catch (error) {
          violations.push({
            type: 'backup_verification_error',
            severity: 'high',
            message: `Failed to verify backup ${backupFile}: ${error.message}`,
            details: { file: backupPath }
          });
        }
      }

      return {
        passed: violations.length === 0,
        violations,
        details: { backupsChecked: auditBackups.length }
      };

    } catch (error) {
      return {
        passed: false,
        violations: [{
          type: 'backup_integrity_check_failed',
          severity: 'critical',
          message: `Backup integrity check failed: ${error.message}`
        }]
      };
    }
  }

  /**
   * Verify integrity chain (blockchain-like verification)
   */
  async verifyIntegrityChain() {
    const violations = [];
    
    try {
      for (let i = 1; i < this.integrityChain.length; i++) {
        const currentBlock = this.integrityChain[i];
        const previousBlock = this.integrityChain[i - 1];
        
        // Verify current block hash
        const calculatedHash = this.calculateBlockHash(
          currentBlock.index,
          currentBlock.timestamp,
          currentBlock.previousHash,
          currentBlock.data,
          currentBlock.nonce
        );
        
        if (calculatedHash !== currentBlock.hash) {
          violations.push({
            type: 'integrity_chain_hash_mismatch',
            severity: 'critical',
            message: `Hash mismatch in integrity chain block ${currentBlock.index}`,
            details: { 
              blockIndex: currentBlock.index,
              expected: currentBlock.hash,
              actual: calculatedHash
            }
          });
        }
        
        // Verify chain linkage
        if (currentBlock.previousHash !== previousBlock.hash) {
          violations.push({
            type: 'integrity_chain_link_broken',
            severity: 'critical',
            message: `Broken chain link at block ${currentBlock.index}`,
            details: {
              blockIndex: currentBlock.index,
              expectedPreviousHash: previousBlock.hash,
              actualPreviousHash: currentBlock.previousHash
            }
          });
        }
      }

      return {
        passed: violations.length === 0,
        violations,
        details: { blocksVerified: this.integrityChain.length }
      };

    } catch (error) {
      return {
        passed: false,
        violations: [{
          type: 'integrity_chain_verification_failed',
          severity: 'critical',
          message: `Integrity chain verification failed: ${error.message}`
        }]
      };
    }
  }

  /**
   * Detect tampering attempts
   */
  async detectTamperingAttempts() {
    const violations = [];
    
    try {
      // Check for suspicious file access patterns
      const auditEntries = await this.auditLogger.readAuditLogs({
        limit: 1000,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
      });

      // Detect unusual patterns
      const patterns = this.analyzeAccessPatterns(auditEntries);
      
      if (patterns.suspiciousActivity.length > 0) {
        violations.push(...patterns.suspiciousActivity.map(activity => ({
          type: 'suspicious_activity_detected',
          severity: 'high',
          message: activity.description,
          details: activity
        })));
      }

      // Check for file system anomalies
      const fileAnomalies = await this.detectFileAnomalies();
      violations.push(...fileAnomalies);

      return {
        passed: violations.length === 0,
        violations
      };

    } catch (error) {
      return {
        passed: false,
        violations: [{
          type: 'tamper_detection_failed',
          severity: 'medium',
          message: `Tamper detection failed: ${error.message}`
        }]
      };
    }
  }

  /**
   * Analyze access patterns for suspicious activity
   */
  analyzeAccessPatterns(auditEntries) {
    const suspiciousActivity = [];
    const userActivity = {};
    const operationFrequency = {};
    
    // Analyze user activity patterns
    auditEntries.forEach(entry => {
      const user = entry.context?.user?.username || 'unknown';
      const operation = entry.eventType;
      const timestamp = new Date(entry.timestamp);
      
      if (!userActivity[user]) {
        userActivity[user] = [];
      }
      userActivity[user].push({ operation, timestamp });
      
      if (!operationFrequency[operation]) {
        operationFrequency[operation] = 0;
      }
      operationFrequency[operation]++;
    });

    // Detect unusual user activity
    Object.entries(userActivity).forEach(([user, activities]) => {
      // Check for rapid-fire operations
      const rapidOperations = this.detectRapidOperations(activities);
      if (rapidOperations.length > 0) {
        suspiciousActivity.push({
          type: 'rapid_operations',
          user,
          description: `User ${user} performed ${rapidOperations.length} rapid operations`,
          details: rapidOperations
        });
      }
      
      // Check for unusual time patterns
      const unusualTimes = this.detectUnusualAccessTimes(activities);
      if (unusualTimes.length > 0) {
        suspiciousActivity.push({
          type: 'unusual_access_times',
          user,
          description: `User ${user} accessed system at unusual times`,
          details: unusualTimes
        });
      }
    });

    // Detect operation frequency anomalies
    Object.entries(operationFrequency).forEach(([operation, frequency]) => {
      const threshold = this.getOperationThreshold(operation);
      if (frequency > threshold) {
        suspiciousActivity.push({
          type: 'high_operation_frequency',
          operation,
          description: `Operation ${operation} performed ${frequency} times (threshold: ${threshold})`,
          details: { operation, frequency, threshold }
        });
      }
    });

    return { suspiciousActivity };
  }

  /**
   * Detect rapid operations (potential automation/attack)
   */
  detectRapidOperations(activities) {
    const rapidOps = [];
    const timeWindow = 60 * 1000; // 1 minute
    const maxOpsPerWindow = 10;
    
    for (let i = 0; i < activities.length - 1; i++) {
      const windowStart = activities[i].timestamp;
      const windowEnd = new Date(windowStart.getTime() + timeWindow);
      
      const opsInWindow = activities.filter(activity => 
        activity.timestamp >= windowStart && activity.timestamp <= windowEnd
      );
      
      if (opsInWindow.length > maxOpsPerWindow) {
        rapidOps.push({
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          operationCount: opsInWindow.length,
          operations: opsInWindow.map(op => op.operation)
        });
      }
    }
    
    return rapidOps;
  }

  /**
   * Detect unusual access times
   */
  detectUnusualAccessTimes(activities) {
    const unusualTimes = [];
    
    activities.forEach(activity => {
      const hour = activity.timestamp.getHours();
      
      // Consider 11 PM to 6 AM as unusual hours
      if (hour >= 23 || hour <= 6) {
        unusualTimes.push({
          timestamp: activity.timestamp.toISOString(),
          operation: activity.operation,
          hour
        });
      }
    });
    
    return unusualTimes;
  }

  /**
   * Get operation threshold for anomaly detection
   */
  getOperationThreshold(operation) {
    const thresholds = {
      'COMMIT_CREATED': 100,
      'MIGRATION_EXECUTED': 20,
      'BACKUP_CREATED': 50,
      'CONFIG_CHANGED': 10,
      'USER_LOGIN': 50
    };
    
    return thresholds[operation] || 30; // Default threshold
  }

  /**
   * Detect file system anomalies
   */
  async detectFileAnomalies() {
    const anomalies = [];
    
    try {
      // Check for unexpected files in audit directory
      const auditDir = this.auditLogger.options.logDirectory;
      const files = await fs.readdir(auditDir);
      
      files.forEach(file => {
        // Check for suspicious file patterns
        if (file.includes('..') || file.includes('/') || file.includes('\\')) {
          anomalies.push({
            type: 'suspicious_filename',
            severity: 'high',
            message: `Suspicious filename detected: ${file}`,
            details: { file, directory: auditDir }
          });
        }
        
        // Check for unexpected file extensions
        const suspiciousExtensions = ['.exe', '.bat', '.sh', '.ps1', '.cmd'];
        if (suspiciousExtensions.some(ext => file.toLowerCase().endsWith(ext))) {
          anomalies.push({
            type: 'suspicious_file_extension',
            severity: 'medium',
            message: `Suspicious file extension detected: ${file}`,
            details: { file, directory: auditDir }
          });
        }
      });

    } catch (error) {
      anomalies.push({
        type: 'file_anomaly_detection_failed',
        severity: 'low',
        message: `Failed to detect file anomalies: ${error.message}`
      });
    }
    
    return anomalies;
  }

  /**
   * Generate integrity recommendations
   */
  generateIntegrityRecommendations(checkResult) {
    const recommendations = [];
    
    // Analyze violations and generate specific recommendations
    const violationTypes = checkResult.violations.map(v => v.type);
    
    if (violationTypes.includes('corrupted_entries')) {
      recommendations.push({
        priority: 'critical',
        action: 'Investigate and restore corrupted audit entries',
        description: 'Corrupted audit entries compromise audit trail integrity'
      });
    }
    
    if (violationTypes.includes('file_modification_detected')) {
      recommendations.push({
        priority: 'critical',
        action: 'Investigate unauthorized file modifications',
        description: 'Unauthorized modifications may indicate security breach'
      });
    }
    
    if (violationTypes.includes('backup_checksum_mismatch')) {
      recommendations.push({
        priority: 'high',
        action: 'Restore backups from secure source',
        description: 'Backup integrity is compromised'
      });
    }
    
    if (violationTypes.includes('suspicious_activity_detected')) {
      recommendations.push({
        priority: 'high',
        action: 'Review user access patterns and implement additional monitoring',
        description: 'Suspicious activity patterns detected'
      });
    }
    
    if (violationTypes.includes('insecure_file_permissions')) {
      recommendations.push({
        priority: 'medium',
        action: 'Fix file permissions on audit logs',
        description: 'Secure file permissions prevent unauthorized access'
      });
    }
    
    // General recommendations based on overall status
    if (checkResult.overallStatus === 'failed') {
      recommendations.push({
        priority: 'high',
        action: 'Increase integrity check frequency',
        description: 'More frequent checks help detect issues earlier'
      });
    }
    
    return recommendations;
  }

  /**
   * Create secure backup of audit logs
   */
  async createSecureBackup(sourceFile, metadata = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `audit-backup-${timestamp}.json`;
      const backupPath = path.join(this.options.backupDirectory, backupFileName);
      
      // Read source file
      const sourceContent = await fs.readFile(sourceFile);
      
      // Create backup data structure
      const backupData = {
        timestamp: new Date().toISOString(),
        originalFile: sourceFile,
        metadata,
        checksum: crypto.createHash(this.options.hashAlgorithm).update(sourceContent).digest('hex'),
        data: sourceContent.toString()
      };
      
      // Encrypt backup if encryption is enabled
      let finalBackupData = JSON.stringify(backupData, null, 2);
      
      if (this.masterKey) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.options.encryptionAlgorithm, this.masterKey);
        let encrypted = cipher.update(finalBackupData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        finalBackupData = JSON.stringify({
          encrypted: true,
          iv: iv.toString('hex'),
          data: encrypted
        });
      }
      
      // Write backup file
      await fs.writeFile(backupPath, finalBackupData, { mode: 0o600 });
      
      // Log backup creation
      await this.auditLogger.logEvent('SECURE_BACKUP_CREATED', {
        backupFile: backupFileName,
        originalFile: sourceFile,
        encrypted: !!this.masterKey,
        success: true
      });
      
      this.emit('backupCreated', { backupPath, originalFile: sourceFile });
      return backupPath;
      
    } catch (error) {
      await this.auditLogger.logEvent('SECURE_BACKUP_FAILED', {
        originalFile: sourceFile,
        error: error.message,
        success: false
      });
      
      throw new Error(`Failed to create secure backup: ${error.message}`);
    }
  }

  /**
   * Restore from secure backup
   */
  async restoreFromBackup(backupPath, targetPath) {
    try {
      // Read backup file
      const backupContent = await fs.readFile(backupPath, 'utf8');
      let backupData;
      
      try {
        const parsedContent = JSON.parse(backupContent);
        
        // Check if backup is encrypted
        if (parsedContent.encrypted) {
          if (!this.masterKey) {
            throw new Error('Master key required to decrypt backup');
          }
          
          const decipher = crypto.createDecipher(this.options.encryptionAlgorithm, this.masterKey);
          let decrypted = decipher.update(parsedContent.data, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          
          backupData = JSON.parse(decrypted);
        } else {
          backupData = parsedContent;
        }
      } catch (error) {
        throw new Error(`Invalid backup format: ${error.message}`);
      }
      
      // Verify backup integrity
      const calculatedChecksum = crypto
        .createHash(this.options.hashAlgorithm)
        .update(backupData.data)
        .digest('hex');
      
      if (calculatedChecksum !== backupData.checksum) {
        throw new Error('Backup integrity verification failed');
      }
      
      // Restore file
      await fs.writeFile(targetPath, backupData.data);
      
      // Log restoration
      await this.auditLogger.logEvent('BACKUP_RESTORED', {
        backupFile: path.basename(backupPath),
        targetFile: targetPath,
        originalFile: backupData.originalFile,
        success: true
      });
      
      this.emit('backupRestored', { backupPath, targetPath });
      return true;
      
    } catch (error) {
      await this.auditLogger.logEvent('BACKUP_RESTORE_FAILED', {
        backupFile: path.basename(backupPath),
        targetFile: targetPath,
        error: error.message,
        success: false
      });
      
      throw new Error(`Failed to restore from backup: ${error.message}`);
    }
  }

  /**
   * Add entry to integrity chain
   */
  async addToIntegrityChain(data) {
    const previousBlock = this.integrityChain[this.integrityChain.length - 1];
    const newBlock = {
      index: this.integrityChain.length,
      timestamp: new Date().toISOString(),
      previousHash: previousBlock.hash,
      data: JSON.stringify(data),
      nonce: 0
    };
    
    // Calculate hash with proof of work (simple implementation)
    newBlock.hash = this.calculateBlockHash(
      newBlock.index,
      newBlock.timestamp,
      newBlock.previousHash,
      newBlock.data,
      newBlock.nonce
    );
    
    this.integrityChain.push(newBlock);
    await this.saveIntegrityChain();
    
    this.emit('blockAdded', newBlock);
  }

  /**
   * Calculate block hash
   */
  calculateBlockHash(index, timestamp, previousHash, data, nonce) {
    return crypto
      .createHash(this.options.hashAlgorithm)
      .update(index + timestamp + previousHash + data + nonce)
      .digest('hex');
  }

  /**
   * Save integrity chain to file
   */
  async saveIntegrityChain() {
    const chainFile = path.join(this.options.backupDirectory, 'integrity-chain.json');
    await fs.writeFile(chainFile, JSON.stringify(this.integrityChain, null, 2));
  }

  /**
   * Store file hash for integrity verification
   */
  async storeFileHash(filePath, hash) {
    const hashFile = path.join(this.options.backupDirectory, 'file-hashes.json');
    let hashes = {};
    
    try {
      const hashData = await fs.readFile(hashFile, 'utf8');
      hashes = JSON.parse(hashData);
    } catch (error) {
      // File doesn't exist, start with empty hashes
    }
    
    hashes[filePath] = {
      hash,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(hashFile, JSON.stringify(hashes, null, 2));
  }

  /**
   * Get stored file hash
   */
  async getStoredFileHash(filePath) {
    try {
      const hashFile = path.join(this.options.backupDirectory, 'file-hashes.json');
      const hashData = await fs.readFile(hashFile, 'utf8');
      const hashes = JSON.parse(hashData);
      
      return hashes[filePath]?.hash;
    } catch (error) {
      return null;
    }
  }

  /**
   * Close integrity manager
   */
  async close() {
    this.stopPeriodicIntegrityChecks();
    this.emit('closed');
  }

  /**
   * Get singleton instance
   */
  static getInstance(options = {}) {
    if (!AuditIntegrityManager.instance) {
      AuditIntegrityManager.instance = new AuditIntegrityManager(options);
    }
    return AuditIntegrityManager.instance;
  }
}

module.exports = AuditIntegrityManager;