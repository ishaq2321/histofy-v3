/**
 * Histofy v3 - Terminal-based GitHub history manipulation tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License - https://opensource.org/licenses/MIT
 * 
 * DryRunManager Tests
 */

const DryRunManager = require('../../src/utils/DryRunManager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('DryRunManager', () => {
  let dryRun;
  let testDir;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), 'histofy-dryrun-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    dryRun = new DryRunManager();
    // Mock console.log to capture output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('operation management', () => {
    test('should add operations correctly', () => {
      const operationId = dryRun.addOperation({
        type: 'git_commit',
        description: 'Create test commit',
        estimatedDuration: 5,
        riskLevel: 'low',
        reversible: true
      });

      expect(operationId).toBe(1);
      expect(dryRun.operations).toHaveLength(1);
      expect(dryRun.operations[0]).toMatchObject({
        id: 1,
        type: 'git_commit',
        description: 'Create test commit',
        estimatedDuration: 5,
        riskLevel: 'low',
        reversible: true
      });
      expect(dryRun.estimatedTime).toBe(5);
    });

    test('should track affected files', () => {
      dryRun.addOperation({
        type: 'file_operation',
        description: 'Modify files',
        affectedFiles: ['file1.txt', 'file2.txt']
      });

      expect(dryRun.affectedFiles.size).toBe(2);
      expect(dryRun.affectedFiles.has('file1.txt')).toBe(true);
      expect(dryRun.affectedFiles.has('file2.txt')).toBe(true);
    });

    test('should track git operations', () => {
      dryRun.addOperation({
        type: 'git_operation',
        description: 'Git commit',
        gitCommand: 'commit',
        gitArgs: ['-m', 'test message']
      });

      expect(dryRun.gitOperations).toHaveLength(1);
      expect(dryRun.gitOperations[0]).toEqual({
        command: 'commit',
        args: ['-m', 'test message'],
        description: 'Git commit'
      });
    });

    test('should add warnings', () => {
      dryRun.addWarning('This is a test warning', 'warning');
      dryRun.addWarning('This is an error', 'error');

      expect(dryRun.warnings).toHaveLength(2);
      expect(dryRun.warnings[0]).toMatchObject({
        message: 'This is a test warning',
        severity: 'warning'
      });
      expect(dryRun.warnings[1]).toMatchObject({
        message: 'This is an error',
        severity: 'error'
      });
    });
  });

  describe('summary generation', () => {
    test('should generate comprehensive summary', () => {
      dryRun.addOperation({
        type: 'test_op',
        description: 'Test operation',
        estimatedDuration: 10,
        riskLevel: 'high',
        reversible: false,
        affectedFiles: ['test.txt']
      });

      dryRun.addOperation({
        type: 'another_op',
        description: 'Another operation',
        estimatedDuration: 5,
        riskLevel: 'low',
        reversible: true
      });

      dryRun.addWarning('Test warning');

      const summary = dryRun.generateSummary();

      expect(summary).toMatchObject({
        totalOperations: 2,
        estimatedTime: 15,
        affectedFilesCount: 1,
        gitOperationsCount: 0,
        riskDistribution: {
          high: 1,
          low: 1
        },
        reversibleOperations: 1,
        irreversibleOperations: 1,
        warningsCount: 1
      });

      expect(summary.operations).toHaveLength(2);
      expect(summary.warnings).toHaveLength(1);
      expect(summary.affectedFiles).toEqual(['test.txt']);
    });

    test('should handle empty operations', () => {
      const summary = dryRun.generateSummary();

      expect(summary).toMatchObject({
        totalOperations: 0,
        estimatedTime: 0,
        affectedFilesCount: 0,
        gitOperationsCount: 0,
        riskDistribution: {},
        reversibleOperations: 0,
        irreversibleOperations: 0,
        warningsCount: 0
      });
    });
  });

  describe('display preview', () => {
    test('should display preview with operations', () => {
      dryRun.addOperation({
        type: 'test_op',
        description: 'Test operation',
        details: { key: 'value' },
        estimatedDuration: 5,
        riskLevel: 'medium',
        reversible: true
      });

      dryRun.addWarning('Test warning', 'warning');

      const summary = dryRun.displayPreview();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DRY RUN PREVIEW'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total Operations: 1'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Test operation'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Test warning'));
      expect(summary.totalOperations).toBe(1);
    });

    test('should limit operations display', () => {
      // Add more operations than the limit
      for (let i = 0; i < 25; i++) {
        dryRun.addOperation({
          type: 'test_op',
          description: `Operation ${i + 1}`,
          estimatedDuration: 1
        });
      }

      dryRun.displayPreview({ maxOperations: 5 });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('... and 20 more operations'));
    });

    test('should show git commands when requested', () => {
      dryRun.addOperation({
        type: 'git_op',
        description: 'Git operation',
        gitCommand: 'commit',
        gitArgs: ['-m', 'test']
      });

      dryRun.displayPreview({ showGitCommands: true });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Git Commands to Execute'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('git commit -m test'));
    });

    test('should show affected files when reasonable number', () => {
      dryRun.addOperation({
        type: 'file_op',
        description: 'File operation',
        affectedFiles: ['file1.txt', 'file2.txt', 'file3.txt']
      });

      dryRun.displayPreview();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Affected Files'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('file1.txt'));
    });

    test('should handle many affected files', () => {
      const manyFiles = Array.from({ length: 15 }, (_, i) => `file${i}.txt`);
      dryRun.addOperation({
        type: 'file_op',
        description: 'File operation',
        affectedFiles: manyFiles
      });

      dryRun.displayPreview();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('15 files (too many to list)'));
    });
  });

  describe('utility methods', () => {
    test('should format duration correctly', () => {
      expect(dryRun.formatDuration(30)).toBe('30s');
      expect(dryRun.formatDuration(90)).toBe('1m 30s');
      expect(dryRun.formatDuration(120)).toBe('2m');
      expect(dryRun.formatDuration(3660)).toBe('1h 1m');
      expect(dryRun.formatDuration(3600)).toBe('1h');
    });

    test('should get correct risk icons', () => {
      expect(dryRun.getRiskIcon('high')).toBe('🔴');
      expect(dryRun.getRiskIcon('medium')).toBe('🟡');
      expect(dryRun.getRiskIcon('low')).toBe('🟢');
      expect(dryRun.getRiskIcon('unknown')).toBe('⚪');
    });

    test('should get correct warning icons and colors', () => {
      expect(dryRun.getWarningIcon('error')).toBe('❌');
      expect(dryRun.getWarningIcon('warning')).toBe('⚠️');
      expect(dryRun.getWarningIcon('info')).toBe('ℹ️');
      
      expect(dryRun.getWarningColor('error')).toBe('red');
      expect(dryRun.getWarningColor('warning')).toBe('yellow');
      expect(dryRun.getWarningColor('info')).toBe('blue');
    });

    test('should clear operations and warnings', () => {
      dryRun.addOperation({ type: 'test', description: 'test' });
      dryRun.addWarning('test warning');

      expect(dryRun.operations).toHaveLength(1);
      expect(dryRun.warnings).toHaveLength(1);

      dryRun.clear();

      expect(dryRun.operations).toHaveLength(0);
      expect(dryRun.warnings).toHaveLength(0);
      expect(dryRun.estimatedTime).toBe(0);
      expect(dryRun.affectedFiles.size).toBe(0);
    });
  });

  describe('export functionality', () => {
    test('should export summary to JSON file', async () => {
      dryRun.addOperation({
        type: 'test_op',
        description: 'Test operation',
        estimatedDuration: 5
      });

      const outputFile = path.join(testDir, 'summary.json');
      const exportData = await dryRun.exportSummary(outputFile);

      expect(exportData).toHaveProperty('totalOperations', 1);
      expect(exportData).toHaveProperty('exportedAt');
      expect(exportData).toHaveProperty('version', '1.0.0');

      // Verify file was created
      const fileContent = await fs.readFile(outputFile, 'utf8');
      const parsedData = JSON.parse(fileContent);
      expect(parsedData.totalOperations).toBe(1);
    });
  });

  describe('factory methods', () => {
    describe('forCommitOperation', () => {
      test('should create dry-run for commit operation', () => {
        const commitData = {
          message: 'Test commit',
          date: '2023-06-15',
          time: '10:00',
          author: 'Test Author',
          addAll: true,
          push: false,
          files: ['file1.txt', 'file2.txt']
        };

        const commitDryRun = DryRunManager.forCommitOperation(commitData);

        expect(commitDryRun.operations).toHaveLength(2); // add + commit
        expect(commitDryRun.operations[0].type).toBe('git_add');
        expect(commitDryRun.operations[1].type).toBe('git_commit');
        expect(commitDryRun.operations[1].details.message).toBe('Test commit');
      });

      test('should include push operation when requested', () => {
        const commitData = {
          message: 'Test commit',
          push: true
        };

        const commitDryRun = DryRunManager.forCommitOperation(commitData);

        expect(commitDryRun.operations).toHaveLength(3); // add + commit + push
        expect(commitDryRun.operations[2].type).toBe('git_push');
        expect(commitDryRun.operations[2].reversible).toBe(false);
        expect(commitDryRun.warnings).toHaveLength(1);
      });
    });

    describe('forMigrationOperation', () => {
      test('should create dry-run for migration operation', () => {
        const migrationData = {
          commits: [
            {
              hash: 'abc123',
              message: 'First commit',
              originalDate: '2023-06-01',
              newDate: '2023-06-15'
            },
            {
              hash: 'def456',
              message: 'Second commit',
              originalDate: '2023-06-02',
              newDate: '2023-06-16'
            }
          ],
          strategy: 'interactive-rebase'
        };

        const migrationDryRun = DryRunManager.forMigrationOperation(migrationData);

        expect(migrationDryRun.operations).toHaveLength(4); // backup + 2 migrations + cleanup
        expect(migrationDryRun.operations[0].type).toBe('git_backup');
        expect(migrationDryRun.operations[1].type).toBe('commit_migration');
        expect(migrationDryRun.operations[2].type).toBe('commit_migration');
        expect(migrationDryRun.operations[3].type).toBe('cleanup');
        expect(migrationDryRun.warnings).toHaveLength(2);
      });

      test('should warn about large migrations', () => {
        const migrationData = {
          commits: Array.from({ length: 15 }, (_, i) => ({
            hash: `hash${i}`,
            message: `Commit ${i}`,
            originalDate: '2023-06-01',
            newDate: '2023-06-15'
          }))
        };

        const migrationDryRun = DryRunManager.forMigrationOperation(migrationData);

        expect(migrationDryRun.warnings).toHaveLength(3); // standard warnings + large migration warning
        expect(migrationDryRun.warnings.some(w => w.message.includes('Large migration'))).toBe(true);
      });
    });

    describe('forConfigOperation', () => {
      test('should create dry-run for config set operation', () => {
        const configData = {
          action: 'set',
          key: 'github.token',
          value: 'secret-token',
          sensitive: true,
          configFile: '~/.histofy/config.yaml'
        };

        const configDryRun = DryRunManager.forConfigOperation(configData);

        expect(configDryRun.operations).toHaveLength(2); // update + encryption
        expect(configDryRun.operations[0].type).toBe('config_update');
        expect(configDryRun.operations[0].details.encrypted).toBe(true);
        expect(configDryRun.operations[1].type).toBe('encryption');
      });

      test('should create dry-run for config init operation', () => {
        const configData = {
          action: 'init',
          configFile: '~/.histofy/config.yaml'
        };

        const configDryRun = DryRunManager.forConfigOperation(configData);

        expect(configDryRun.operations).toHaveLength(1);
        expect(configDryRun.operations[0].type).toBe('config_init');
        expect(configDryRun.operations[0].details.createDirectories).toBe(true);
      });
    });

    describe('forBatchOperation', () => {
      test('should create dry-run for batch operation', () => {
        const batchData = {
          commits: [
            { message: 'First commit', date: '2023-06-15' },
            { message: 'Second commit', date: '2023-06-16' },
            { message: 'Third commit', date: '2023-06-17' }
          ],
          continueOnError: true
        };

        const batchDryRun = DryRunManager.forBatchOperation(batchData);

        expect(batchDryRun.operations).toHaveLength(4); // validation + 3 commits
        expect(batchDryRun.operations[0].type).toBe('data_validation');
        expect(batchDryRun.operations[1].type).toBe('batch_commit');
        expect(batchDryRun.operations[2].type).toBe('batch_commit');
        expect(batchDryRun.operations[3].type).toBe('batch_commit');
        expect(batchDryRun.warnings).toHaveLength(1); // continue on error warning
      });

      test('should warn about large batch operations', () => {
        const batchData = {
          commits: Array.from({ length: 60 }, (_, i) => ({
            message: `Commit ${i}`,
            date: '2023-06-15'
          }))
        };

        const batchDryRun = DryRunManager.forBatchOperation(batchData);

        expect(batchDryRun.warnings.some(w => w.message.includes('Large batch operation'))).toBe(true);
      });
    });
  });
});