/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * AuditLogger - Comprehensive audit logging system for compliance
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { EventEmitter } = require('events');

class AuditLogger extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logDirectory: options.logDirectory || path.join(os.homedir(), '.histofy', 'audit'),
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: options.maxLogFiles || 10,
      enableEncryption: options.enableEncryption || true,
      enableIntegrityCheck: options.enableIntegrityCheck || true,
      rotationInterval: options.rotationInterval || 24 * 60 * 60 * 1000, // 24 hours
      compressionEnabled: options.compressionEnabled || true,
      ...options
    };

    this.currentLogFile = null;
    this.currentLogSize = 0;
    this.encryptionKey = null;
    this.isInitialized = false;
    this.logBuffer = [];
    this.flushInterval = null;
    
    // Initialize logger
    this.initialize();
  }

  /**
   * Initialize the audit logger
   */
  async initialize() {
    try {
      // Create audit directory if it doesn't exist
      await fs.mkdir(this.options.logDirectory, { recursive: true });
      
      // Initialize encryption if enabled
      if (this.options.enableEncryption) {
        await this.initializeEncryption();
      }
      
      // Set up current log file
      await this.setupCurrentLogFile();
      
      // Start periodic flush
      this.startPeriodicFlush();
      
      // Set up rotation timer
      this.setupRotationTimer();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize audit logger: ${error.message}`));
    }
  }

  /**
   * Initialize encryption for audit logs
   */
  async initializeEncryption() {
    const keyFile = path.join(this.options.logDirectory, '.audit-key');
    
    try {
      // Try to load existing key
      const keyData = await fs.readFile(keyFile);
      this.encryptionKey = keyData;
    } catch (error) {
      // Generate new key if none exists
      this.encryptionKey = crypto.randomBytes(32);
      await fs.writeFile(keyFile, this.encryptionKey, { mode: 0o600 });
    }
  }

  /**
   * Set up current log file
   */
  async setupCurrentLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(this.options.logDirectory, `audit-${timestamp}.log`);
    this.currentLogSize = 0;
    
    // Create log file with header
    const header = this.createLogHeader();
    await this.writeToFile(header);
  }

  /**
   * Create log file header
   */
  createLogHeader() {
    return {
      type: 'AUDIT_LOG_HEADER',
      timestamp: new Date().toISOString(),
      version: '1.0',
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid
      },
      options: {
        encryptionEnabled: this.options.enableEncryption,
        integrityCheckEnabled: this.options.enableIntegrityCheck,
        maxLogSize: this.options.maxLogSize,
        maxLogFiles: this.options.maxLogFiles
      }
    };
  }

  /**
   * Log an audit event
   * @param {string} eventType - Type of event (e.g., 'COMMIT_CREATED', 'MIGRATION_EXECUTED')
   * @param {Object} eventData - Event-specific data
   * @param {Object} context - Additional context information
   */
  async logEvent(eventType, eventData = {}, context = {}) {
    if (!this.isInitialized) {
      this.logBuffer.push({ eventType, eventData, context });
      return;
    }

    const auditEntry = this.createAuditEntry(eventType, eventData, context);
    
    try {
      await this.writeAuditEntry(auditEntry);
      this.emit('eventLogged', auditEntry);
    } catch (error) {
      this.emit('error', new Error(`Failed to log audit event: ${error.message}`));
    }
  }

  /**
   * Create audit entry
   */
  createAuditEntry(eventType, eventData, context) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      eventData: this.sanitizeEventData(eventData),
      context: {
        user: this.getCurrentUser(),
        session: this.getSessionInfo(),
        system: this.getSystemInfo(),
        ...context
      },
      integrity: null
    };

    // Add integrity hash if enabled
    if (this.options.enableIntegrityCheck) {
      entry.integrity = this.calculateIntegrityHash(entry);
    }

    return entry;
  }

  /**
   * Sanitize event data to remove sensitive information
   */
  sanitizeEventData(eventData) {
    const sanitized = JSON.parse(JSON.stringify(eventData));
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
    
    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitizeObject(value);
        }
      }
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Get current user information
   */
  getCurrentUser() {
    return {
      username: os.userInfo().username,
      uid: os.userInfo().uid,
      gid: os.userInfo().gid,
      shell: os.userInfo().shell || process.env.SHELL,
      home: os.userInfo().homedir
    };
  }

  /**
   * Get session information
   */
  getSessionInfo() {
    return {
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HISTOFY_DEBUG: process.env.HISTOFY_DEBUG,
        TERM: process.env.TERM
      }
    };
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: process.memoryUsage()
      }
    };
  }

  /**
   * Calculate integrity hash for audit entry
   */
  calculateIntegrityHash(entry) {
    const entryWithoutIntegrity = { ...entry };
    delete entryWithoutIntegrity.integrity;
    
    const entryString = JSON.stringify(entryWithoutIntegrity, Object.keys(entryWithoutIntegrity).sort());
    return crypto.createHash('sha256').update(entryString).digest('hex');
  }

  /**
   * Write audit entry to log file
   */
  async writeAuditEntry(entry) {
    await this.writeToFile(entry);
    
    // Check if log rotation is needed
    if (this.currentLogSize >= this.options.maxLogSize) {
      await this.rotateLogFile();
    }
  }

  /**
   * Write data to current log file
   */
  async writeToFile(data) {
    const logLine = JSON.stringify(data) + '\\n';
    let finalData = logLine;
    
    // Encrypt if enabled
    if (this.options.enableEncryption && this.encryptionKey) {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(logLine, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      finalData = iv.toString('hex') + ':' + encrypted + '\\n';
    }
    
    await fs.appendFile(this.currentLogFile, finalData);
    this.currentLogSize += Buffer.byteLength(finalData);
  }

  /**
   * Rotate log file
   */
  async rotateLogFile() {
    try {
      // Close current log file
      const rotatedFile = this.currentLogFile + '.rotated';
      await fs.rename(this.currentLogFile, rotatedFile);
      
      // Compress if enabled
      if (this.options.compressionEnabled) {
        await this.compressLogFile(rotatedFile);
      }
      
      // Clean up old log files
      await this.cleanupOldLogFiles();
      
      // Create new log file
      await this.setupCurrentLogFile();
      
      this.emit('logRotated', { oldFile: rotatedFile, newFile: this.currentLogFile });
      
    } catch (error) {
      this.emit('error', new Error(`Failed to rotate log file: ${error.message}`));
    }
  }

  /**
   * Compress log file
   */
  async compressLogFile(filePath) {
    const zlib = require('zlib');
    const { pipeline } = require('stream');
    const { promisify } = require('util');
    const pipelineAsync = promisify(pipeline);
    
    try {
      const readStream = require('fs').createReadStream(filePath);
      const writeStream = require('fs').createWriteStream(filePath + '.gz');
      const gzipStream = zlib.createGzip();
      
      await pipelineAsync(readStream, gzipStream, writeStream);
      
      // Remove original file after compression
      await fs.unlink(filePath);
      
    } catch (error) {
      this.emit('error', new Error(`Failed to compress log file: ${error.message}`));
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogFiles() {
    try {
      const files = await fs.readdir(this.options.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('audit-') && (file.endsWith('.log.rotated') || file.endsWith('.log.gz')))
        .map(file => ({
          name: file,
          path: path.join(this.options.logDirectory, file),
          stat: null
        }));
      
      // Get file stats
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }
      
      // Sort by modification time (oldest first)
      logFiles.sort((a, b) => a.stat.mtime - b.stat.mtime);
      
      // Remove excess files
      if (logFiles.length > this.options.maxLogFiles) {
        const filesToRemove = logFiles.slice(0, logFiles.length - this.options.maxLogFiles);
        
        for (const file of filesToRemove) {
          await fs.unlink(file.path);
          this.emit('logFileRemoved', file.path);
        }
      }
      
    } catch (error) {
      this.emit('error', new Error(`Failed to cleanup old log files: ${error.message}`));
    }
  }

  /**
   * Start periodic flush of buffered logs
   */
  startPeriodicFlush() {
    this.flushInterval = setInterval(async () => {
      if (this.logBuffer.length > 0) {
        const bufferedLogs = [...this.logBuffer];
        this.logBuffer = [];
        
        for (const log of bufferedLogs) {
          await this.logEvent(log.eventType, log.eventData, log.context);
        }
      }
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Set up automatic log rotation timer
   */
  setupRotationTimer() {
    setInterval(async () => {
      const stats = await fs.stat(this.currentLogFile);
      const age = Date.now() - stats.mtime.getTime();
      
      if (age >= this.options.rotationInterval) {
        await this.rotateLogFile();
      }
    }, 60000); // Check every minute
  }

  /**
   * Read audit logs with optional filtering
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of audit entries
   */
  async readAuditLogs(options = {}) {
    const {
      startDate,
      endDate,
      eventType,
      user,
      limit = 1000,
      offset = 0
    } = options;
    
    try {
      const logFiles = await this.getLogFiles();
      const entries = [];
      
      for (const logFile of logFiles) {
        const fileEntries = await this.readLogFile(logFile);
        entries.push(...fileEntries);
      }
      
      // Filter entries
      let filteredEntries = entries.filter(entry => {
        if (startDate && new Date(entry.timestamp) < new Date(startDate)) return false;
        if (endDate && new Date(entry.timestamp) > new Date(endDate)) return false;
        if (eventType && entry.eventType !== eventType) return false;
        if (user && entry.context.user.username !== user) return false;
        return true;
      });
      
      // Sort by timestamp (newest first)
      filteredEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply pagination
      return filteredEntries.slice(offset, offset + limit);
      
    } catch (error) {
      throw new Error(`Failed to read audit logs: ${error.message}`);
    }
  }

  /**
   * Get list of log files
   */
  async getLogFiles() {
    const files = await fs.readdir(this.options.logDirectory);
    return files
      .filter(file => file.startsWith('audit-') && (file.endsWith('.log') || file.endsWith('.log.gz')))
      .map(file => path.join(this.options.logDirectory, file))
      .sort();
  }

  /**
   * Read and parse log file
   */
  async readLogFile(filePath) {
    try {
      let content;
      
      if (filePath.endsWith('.gz')) {
        // Decompress gzipped file
        const zlib = require('zlib');
        const compressedData = await fs.readFile(filePath);
        content = zlib.gunzipSync(compressedData).toString();
      } else {
        content = await fs.readFile(filePath, 'utf8');
      }
      
      const lines = content.trim().split('\\n');
      const entries = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          let parsedLine;
          
          if (this.options.enableEncryption && this.encryptionKey) {
            // Decrypt line
            const [ivHex, encryptedHex] = line.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            parsedLine = JSON.parse(decrypted);
          } else {
            parsedLine = JSON.parse(line);
          }
          
          // Verify integrity if enabled
          if (this.options.enableIntegrityCheck && parsedLine.integrity) {
            const calculatedHash = this.calculateIntegrityHash(parsedLine);
            if (calculatedHash !== parsedLine.integrity) {
              this.emit('integrityViolation', { file: filePath, entry: parsedLine });
              continue; // Skip corrupted entry
            }
          }
          
          entries.push(parsedLine);
          
        } catch (error) {
          this.emit('parseError', { file: filePath, line, error: error.message });
        }
      }
      
      return entries;
      
    } catch (error) {
      throw new Error(`Failed to read log file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Generate audit report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Audit report
   */
  async generateAuditReport(options = {}) {
    const {
      startDate,
      endDate,
      format = 'json',
      includeSystemInfo = true,
      includeStatistics = true
    } = options;
    
    try {
      const entries = await this.readAuditLogs({ startDate, endDate });
      
      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          period: {
            startDate: startDate || 'beginning',
            endDate: endDate || 'now'
          },
          totalEntries: entries.length,
          format
        },
        entries
      };
      
      if (includeSystemInfo) {
        report.systemInfo = this.getSystemInfo();
      }
      
      if (includeStatistics) {
        report.statistics = this.generateStatistics(entries);
      }
      
      return report;
      
    } catch (error) {
      throw new Error(`Failed to generate audit report: ${error.message}`);
    }
  }

  /**
   * Generate statistics from audit entries
   */
  generateStatistics(entries) {
    const stats = {
      eventTypes: {},
      users: {},
      timeDistribution: {},
      errorCount: 0,
      successCount: 0
    };
    
    entries.forEach(entry => {
      // Event type distribution
      stats.eventTypes[entry.eventType] = (stats.eventTypes[entry.eventType] || 0) + 1;
      
      // User activity
      const username = entry.context.user.username;
      stats.users[username] = (stats.users[username] || 0) + 1;
      
      // Time distribution (by hour)
      const hour = new Date(entry.timestamp).getHours();
      stats.timeDistribution[hour] = (stats.timeDistribution[hour] || 0) + 1;
      
      // Success/error count
      if (entry.eventData.success === false || entry.eventData.error) {
        stats.errorCount++;
      } else {
        stats.successCount++;
      }
    });
    
    return stats;
  }

  /**
   * Export audit logs in various formats
   * @param {string} format - Export format (json, csv, xml)
   * @param {Object} options - Export options
   * @returns {Promise<string>} Exported data
   */
  async exportAuditLogs(format = 'json', options = {}) {
    const entries = await this.readAuditLogs(options);
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(entries, null, 2);
        
      case 'csv':
        return this.exportToCSV(entries);
        
      case 'xml':
        return this.exportToXML(entries);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export entries to CSV format
   */
  exportToCSV(entries) {
    if (entries.length === 0) return '';
    
    const headers = ['timestamp', 'eventType', 'user', 'success', 'description'];
    const csvLines = [headers.join(',')];
    
    entries.forEach(entry => {
      const row = [
        entry.timestamp,
        entry.eventType,
        entry.context.user.username,
        entry.eventData.success !== false ? 'true' : 'false',
        JSON.stringify(entry.eventData.description || '').replace(/"/g, '""')
      ];
      csvLines.push(row.join(','));
    });
    
    return csvLines.join('\\n');
  }

  /**
   * Export entries to XML format
   */
  exportToXML(entries) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\\n<auditLog>\\n';
    
    entries.forEach(entry => {
      xml += '  <entry>\\n';
      xml += `    <id>${entry.id}</id>\\n`;
      xml += `    <timestamp>${entry.timestamp}</timestamp>\\n`;
      xml += `    <eventType>${entry.eventType}</eventType>\\n`;
      xml += `    <user>${entry.context.user.username}</user>\\n`;
      xml += `    <success>${entry.eventData.success !== false}</success>\\n`;
      xml += `    <data><![CDATA[${JSON.stringify(entry.eventData)}]]></data>\\n`;
      xml += '  </entry>\\n';
    });
    
    xml += '</auditLog>';
    return xml;
  }

  /**
   * Verify audit log integrity
   * @returns {Promise<Object>} Integrity verification result
   */
  async verifyIntegrity() {
    const result = {
      totalEntries: 0,
      validEntries: 0,
      corruptedEntries: 0,
      missingEntries: 0,
      violations: []
    };
    
    try {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        const entries = await this.readLogFile(logFile);
        
        entries.forEach(entry => {
          result.totalEntries++;
          
          if (entry.integrity) {
            const calculatedHash = this.calculateIntegrityHash(entry);
            if (calculatedHash === entry.integrity) {
              result.validEntries++;
            } else {
              result.corruptedEntries++;
              result.violations.push({
                file: logFile,
                entryId: entry.id,
                timestamp: entry.timestamp,
                type: 'integrity_mismatch'
              });
            }
          } else {
            result.missingEntries++;
            result.violations.push({
              file: logFile,
              entryId: entry.id,
              timestamp: entry.timestamp,
              type: 'missing_integrity'
            });
          }
        });
      }
      
      result.integrityScore = result.totalEntries > 0 ? 
        (result.validEntries / result.totalEntries) * 100 : 100;
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to verify audit log integrity: ${error.message}`);
    }
  }

  /**
   * Close the audit logger
   */
  async close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush any remaining buffered logs
    if (this.logBuffer.length > 0) {
      const bufferedLogs = [...this.logBuffer];
      this.logBuffer = [];
      
      for (const log of bufferedLogs) {
        await this.logEvent(log.eventType, log.eventData, log.context);
      }
    }
    
    this.emit('closed');
  }

  /**
   * Get singleton instance
   */
  static getInstance(options = {}) {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger(options);
    }
    return AuditLogger.instance;
  }
}

module.exports = AuditLogger;