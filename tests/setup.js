/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.HISTOFY_TEST_MODE = 'true';

// Create temporary directory for tests
const testTempDir = path.join(os.tmpdir(), 'histofy-tests');
if (!fs.existsSync(testTempDir)) {
    fs.mkdirSync(testTempDir, { recursive: true });
}

// Set test configuration path
process.env.HISTOFY_CONFIG_PATH = path.join(testTempDir, 'config');

// Global test utilities
global.testUtils = {
    tempDir: testTempDir,
    
    // Create temporary Git repository for testing
    createTempRepo: async () => {
        const { execSync } = require('child_process');
        const repoPath = path.join(testTempDir, `repo-${Date.now()}`);
        
        fs.mkdirSync(repoPath, { recursive: true });
        
        // Initialize Git repository
        execSync('git init', { cwd: repoPath, stdio: 'pipe' });
        execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'pipe' });
        execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'pipe' });
        
        // Create initial commit
        fs.writeFileSync(path.join(repoPath, 'README.md'), '# Test Repository');
        execSync('git add README.md', { cwd: repoPath, stdio: 'pipe' });
        execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' });
        
        return repoPath;
    },
    
    // Clean up temporary files
    cleanup: () => {
        if (fs.existsSync(testTempDir)) {
            fs.rmSync(testTempDir, { recursive: true, force: true });
        }
    },
    
    // Mock console methods
    mockConsole: () => {
        const originalConsole = { ...console };
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
        console.info = jest.fn();
        
        return {
            restore: () => {
                Object.assign(console, originalConsole);
            }
        };
    }
};

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(() => {
    global.testUtils.cleanup();
});

// Suppress console output during tests unless explicitly needed
if (!process.env.VERBOSE_TESTS) {
    global.console = {
        ...console,
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    };
}