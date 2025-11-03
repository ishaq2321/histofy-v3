#!/usr/bin/env node
/**
 * Histofy v3 - Installation Verification Tool
 * Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
 * Licensed under MIT License
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const REQUIRED_NODE_VERSION = '16.0.0';
const REQUIRED_GIT_VERSION = '2.20.0';
const HISTOFY_VERSION = '3.0.0';

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

// Emoji support detection
const emojiSupport = process.env.TERM !== 'dumb' && process.env.CI !== 'true';

function log(level, message) {
    const icons = {
        info: emojiSupport ? 'ℹ️' : '[INFO]',
        success: emojiSupport ? '✅' : '[SUCCESS]',
        warning: emojiSupport ? '⚠️' : '[WARNING]',
        error: emojiSupport ? '❌' : '[ERROR]',
        progress: emojiSupport ? '🔄' : '[PROGRESS]'
    };
    
    const colorMap = {
        info: colors.cyan,
        success: colors.green,
        warning: colors.yellow,
        error: colors.red,
        progress: colors.blue
    };
    
    console.log(`${colorMap[level]}${icons[level]} ${message}${colors.reset}`);
}

function compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        
        if (v1Part > v2Part) return 1;
        if (v1Part < v2Part) return -1;
    }
    
    return 0;
}

function runCommand(command, options = {}) {
    try {
        const result = execSync(command, { 
            encoding: 'utf8', 
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options 
        });
        return { success: true, output: result.trim() };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            output: error.stdout ? error.stdout.trim() : ''
        };
    }
}

function checkSystemInfo() {
    log('progress', 'Gathering system information...');
    
    const platform = os.platform();
    const arch = os.arch();
    const nodeVersion = process.version.replace('v', '');
    const osRelease = os.release();
    
    console.log(`${colors.gray}Platform: ${platform}${colors.reset}`);
    console.log(`${colors.gray}Architecture: ${arch}${colors.reset}`);
    console.log(`${colors.gray}Node.js: v${nodeVersion}${colors.reset}`);
    console.log(`${colors.gray}OS Release: ${osRelease}${colors.reset}`);
    
    return { platform, arch, nodeVersion, osRelease };
}

function checkNodeJs() {
    log('progress', 'Checking Node.js installation...');
    
    const nodeVersion = process.version.replace('v', '');
    const versionCheck = compareVersions(nodeVersion, REQUIRED_NODE_VERSION);
    
    if (versionCheck >= 0) {
        log('success', `Node.js v${nodeVersion} detected (required: v${REQUIRED_NODE_VERSION}+)`);
        return true;
    } else {
        log('error', `Node.js v${REQUIRED_NODE_VERSION}+ required (found: v${nodeVersion})`);
        return false;
    }
}

function checkGit() {
    log('progress', 'Checking Git installation...');
    
    const gitCheck = runCommand('git --version', { silent: true });
    
    if (!gitCheck.success) {
        log('error', 'Git not found in PATH');
        return false;
    }
    
    const versionMatch = gitCheck.output.match(/git version (\d+\.\d+\.\d+)/);
    if (!versionMatch) {
        log('warning', 'Could not determine Git version');
        return false;
    }
    
    const gitVersion = versionMatch[1];
    const versionCheck = compareVersions(gitVersion, REQUIRED_GIT_VERSION);
    
    if (versionCheck >= 0) {
        log('success', `Git v${gitVersion} detected (required: v${REQUIRED_GIT_VERSION}+)`);
        return true;
    } else {
        log('error', `Git v${REQUIRED_GIT_VERSION}+ required (found: v${gitVersion})`);
        return false;
    }
}

function checkPackageManagers() {
    log('progress', 'Checking package managers...');
    
    const managers = [];
    
    // Check npm
    const npmCheck = runCommand('npm --version', { silent: true });
    if (npmCheck.success) {
        managers.push(`npm v${npmCheck.output}`);
        log('success', `npm v${npmCheck.output} detected`);
    }
    
    // Check yarn
    const yarnCheck = runCommand('yarn --version', { silent: true });
    if (yarnCheck.success) {
        managers.push(`yarn v${yarnCheck.output}`);
        log('success', `yarn v${yarnCheck.output} detected`);
    }
    
    // Platform-specific package managers
    const platform = os.platform();
    
    if (platform === 'darwin') {
        const brewCheck = runCommand('brew --version', { silent: true });
        if (brewCheck.success) {
            const version = brewCheck.output.split('\n')[0].replace('Homebrew ', '');
            managers.push(`homebrew ${version}`);
            log('success', `Homebrew ${version} detected`);
        }
    } else if (platform === 'linux') {
        // Check various Linux package managers
        const linuxManagers = [
            { cmd: 'apt --version', name: 'apt' },
            { cmd: 'yum --version', name: 'yum' },
            { cmd: 'dnf --version', name: 'dnf' },
            { cmd: 'pacman --version', name: 'pacman' },
            { cmd: 'zypper --version', name: 'zypper' }
        ];
        
        linuxManagers.forEach(({ cmd, name }) => {
            const check = runCommand(cmd, { silent: true });
            if (check.success) {
                managers.push(name);
                log('success', `${name} detected`);
            }
        });
    } else if (platform === 'win32') {
        const chocoCheck = runCommand('choco --version', { silent: true });
        if (chocoCheck.success) {
            managers.push(`chocolatey v${chocoCheck.output}`);
            log('success', `Chocolatey v${chocoCheck.output} detected`);
        }
        
        const wingetCheck = runCommand('winget --version', { silent: true });
        if (wingetCheck.success) {
            managers.push(`winget v${wingetCheck.output}`);
            log('success', `winget v${wingetCheck.output} detected`);
        }
    }
    
    if (managers.length === 0) {
        log('warning', 'No package managers detected');
        return false;
    }
    
    return managers;
}

function checkHistofyCli() {
    log('progress', 'Checking Histofy CLI installation...');
    
    const histofyCheck = runCommand('histofy --version', { silent: true });
    
    if (!histofyCheck.success) {
        log('error', 'Histofy CLI not found in PATH');
        return false;
    }
    
    const versionMatch = histofyCheck.output.match(/v?(\d+\.\d+\.\d+)/);
    if (!versionMatch) {
        log('warning', 'Could not determine Histofy version');
        return false;
    }
    
    const histofyVersion = versionMatch[1];
    log('success', `Histofy CLI v${histofyVersion} detected`);
    
    // Check if it's the expected version
    if (histofyVersion === HISTOFY_VERSION) {
        log('success', 'Histofy version matches expected version');
    } else {
        log('warning', `Expected v${HISTOFY_VERSION}, found v${histofyVersion}`);
    }
    
    return true;
}

function checkShellIntegration() {
    log('progress', 'Checking shell integration...');
    
    const platform = os.platform();
    const homeDir = os.homedir();
    let configFiles = [];
    let functionsFiles = [];
    
    if (platform === 'win32') {
        // PowerShell profile
        const profilePaths = [
            path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
            path.join(homeDir, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
        ];
        
        configFiles = profilePaths.filter(p => fs.existsSync(p));
        functionsFiles = ['histofy-functions.ps1'];
    } else {
        // Unix-like systems
        configFiles = [
            path.join(homeDir, '.bashrc'),
            path.join(homeDir, '.bash_profile'),
            path.join(homeDir, '.zshrc'),
            path.join(homeDir, '.config', 'fish', 'config.fish')
        ].filter(p => fs.existsSync(p));
        
        functionsFiles = ['histofy-functions.sh'];
    }
    
    let integrationFound = false;
    
    // Check config files for Histofy integration
    configFiles.forEach(configFile => {
        try {
            const content = fs.readFileSync(configFile, 'utf8');
            if (content.includes('Histofy v3')) {
                log('success', `Shell integration found in ${path.basename(configFile)}`);
                integrationFound = true;
            }
        } catch (error) {
            log('warning', `Could not read ${configFile}: ${error.message}`);
        }
    });
    
    if (!integrationFound) {
        log('warning', 'No shell integration found in config files');
    }
    
    return integrationFound;
}

function checkConfiguration() {
    log('progress', 'Checking Histofy configuration...');
    
    const configCheck = runCommand('histofy config list', { silent: true });
    
    if (!configCheck.success) {
        log('warning', 'Histofy configuration not initialized');
        log('info', 'Run "histofy config init" to initialize configuration');
        return false;
    }
    
    log('success', 'Histofy configuration system working');
    
    // Check for common configuration items
    const commonConfigs = [
        'git.defaultAuthor',
        'github.token',
        'performance.enabled'
    ];
    
    commonConfigs.forEach(config => {
        const getConfig = runCommand(`histofy config get ${config}`, { silent: true });
        if (getConfig.success && getConfig.output.trim()) {
            log('success', `Configuration "${config}" is set`);
        } else {
            log('info', `Configuration "${config}" not set (optional)`);
        }
    });
    
    return true;
}

function checkQuickFunctions() {
    log('progress', 'Checking quick functions availability...');
    
    const platform = os.platform();
    const shell = process.env.SHELL || (platform === 'win32' ? 'powershell' : 'bash');
    
    // This is a basic check - in practice, functions are loaded in interactive shells
    log('info', `Shell detected: ${shell}`);
    log('info', 'Quick functions (hc, hcp, hs, etc.) should be available in new shell sessions');
    
    return true;
}

function runDiagnostics() {
    log('progress', 'Running diagnostic tests...');
    
    // Test basic Git operations
    const gitStatus = runCommand('git status', { silent: true });
    if (gitStatus.success) {
        log('success', 'Git repository detected and accessible');
    } else {
        log('info', 'Not in a Git repository (this is normal for verification)');
    }
    
    // Test Histofy help system
    const helpCheck = runCommand('histofy help', { silent: true });
    if (helpCheck.success) {
        log('success', 'Histofy help system working');
    } else {
        log('warning', 'Histofy help system not responding');
    }
    
    return true;
}

function generateReport(results) {
    console.log('\n' + '='.repeat(60));
    log('info', 'Installation Verification Report');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'success').length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log(`\n${colors.cyan}Overall Status: ${colors.reset}${passed}/${total} checks passed (${percentage}%)`);
    
    if (percentage >= 90) {
        log('success', 'Installation appears to be working correctly!');
    } else if (percentage >= 70) {
        log('warning', 'Installation mostly working, but some issues detected');
    } else {
        log('error', 'Installation has significant issues that need attention');
    }
    
    console.log('\n' + colors.gray + 'Detailed Results:' + colors.reset);
    results.forEach(result => {
        const icon = result.status === 'success' ? '✓' : 
                    result.status === 'warning' ? '⚠' : '✗';
        const color = result.status === 'success' ? colors.green :
                     result.status === 'warning' ? colors.yellow : colors.red;
        
        console.log(`  ${color}${icon} ${result.name}${colors.reset}`);
        if (result.details) {
            console.log(`    ${colors.gray}${result.details}${colors.reset}`);
        }
    });
    
    if (percentage < 100) {
        console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
        
        const failedChecks = results.filter(r => r.status !== 'success');
        failedChecks.forEach(check => {
            if (check.recommendation) {
                console.log(`  • ${check.recommendation}`);
            }
        });
        
        console.log(`\n${colors.cyan}For more help:${colors.reset}`);
        console.log('  • Check the installation guide: installers/README.md');
        console.log('  • Run troubleshooting: histofy help troubleshooting');
        console.log('  • Report issues: https://github.com/your-repo/histofy-v3/issues');
    }
    
    console.log('');
}

async function main() {
    console.log(`\n${colors.blue}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║              Histofy v3 Installation Verifier           ║${colors.reset}`);
    console.log(`${colors.blue}║                  Comprehensive System Check              ║${colors.reset}`);
    console.log(`${colors.blue}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);
    
    const results = [];
    
    // System information
    const systemInfo = checkSystemInfo();
    
    // Run all checks
    const checks = [
        {
            name: 'Node.js Version',
            fn: checkNodeJs,
            recommendation: 'Install Node.js v16.0.0 or later from https://nodejs.org'
        },
        {
            name: 'Git Installation',
            fn: checkGit,
            recommendation: 'Install Git v2.20.0 or later from https://git-scm.com'
        },
        {
            name: 'Package Managers',
            fn: checkPackageManagers,
            recommendation: 'Install npm (included with Node.js) or yarn'
        },
        {
            name: 'Histofy CLI',
            fn: checkHistofyCli,
            recommendation: 'Run the installer or: npm install -g histofy-cli'
        },
        {
            name: 'Shell Integration',
            fn: checkShellIntegration,
            recommendation: 'Re-run installer or manually source shell configuration'
        },
        {
            name: 'Configuration System',
            fn: checkConfiguration,
            recommendation: 'Run: histofy config init'
        },
        {
            name: 'Quick Functions',
            fn: checkQuickFunctions,
            recommendation: 'Restart shell or source configuration file'
        },
        {
            name: 'Diagnostics',
            fn: runDiagnostics,
            recommendation: 'Check Histofy CLI installation and permissions'
        }
    ];
    
    for (const check of checks) {
        try {
            const result = check.fn();
            results.push({
                name: check.name,
                status: result ? 'success' : 'warning',
                recommendation: result ? null : check.recommendation
            });
        } catch (error) {
            results.push({
                name: check.name,
                status: 'error',
                details: error.message,
                recommendation: check.recommendation
            });
        }
    }
    
    // Generate final report
    generateReport(results);
    
    // Exit with appropriate code
    const hasErrors = results.some(r => r.status === 'error');
    const hasWarnings = results.some(r => r.status === 'warning');
    
    if (hasErrors) {
        process.exit(1);
    } else if (hasWarnings) {
        process.exit(2);
    } else {
        process.exit(0);
    }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Histofy v3 Installation Verifier

USAGE:
    node verify.js [options]

OPTIONS:
    -h, --help     Show this help message
    --version      Show version information

DESCRIPTION:
    Comprehensive verification tool for Histofy v3 installation.
    Checks system requirements, CLI installation, shell integration,
    and configuration to ensure everything is working correctly.

EXIT CODES:
    0    All checks passed
    1    Critical errors found
    2    Warnings found (installation mostly working)
`);
    process.exit(0);
}

if (process.argv.includes('--version')) {
    console.log(`Histofy Installation Verifier v${HISTOFY_VERSION}`);
    process.exit(0);
}

// Run main function
main().catch(error => {
    log('error', `Verification failed: ${error.message}`);
    process.exit(1);
});