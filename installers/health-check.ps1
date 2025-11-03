# Histofy v3 - Health Check Script (Windows PowerShell)
# Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
# Licensed under MIT License

param(
    [switch]$Help,
    [switch]$Version,
    [switch]$Quick,
    [switch]$Verbose
)

# Configuration
$SCRIPT_VERSION = "1.0.0"
$HISTOFY_VERSION = "3.0.0"

# Enhanced output functions with emoji support
$EmojiSupport = $true
if ($env:CI -eq "true" -or $env:TERM -eq "dumb") {
    $EmojiSupport = $false
}

function Write-Info {
    param([string]$Message)
    $icon = if ($EmojiSupport) { "ℹ️" } else { "[INFO]" }
    Write-Host "$icon $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    $icon = if ($EmojiSupport) { "✅" } else { "[SUCCESS]" }
    Write-Host "$icon $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    $icon = if ($EmojiSupport) { "⚠️" } else { "[WARNING]" }
    Write-Host "$icon $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    $icon = if ($EmojiSupport) { "❌" } else { "[ERROR]" }
    Write-Host "$icon $Message" -ForegroundColor Red
}

function Write-Progress {
    param([string]$Message)
    $icon = if ($EmojiSupport) { "🔄" } else { "[PROGRESS]" }
    Write-Host "$icon $Message" -ForegroundColor Blue
}

function Test-SystemHealth {
    Write-Progress "Checking system health..."
    
    $issues = @()
    
    # Check disk space
    try {
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3" | Where-Object { $_.DeviceID -eq "C:" }
        $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)
        
        if ($diskUsage -gt 90) {
            $issues += "Disk usage is $diskUsage% (consider freeing space)"
        } elseif ($diskUsage -gt 80) {
            Write-Warning "Disk usage is $diskUsage% (monitor space)"
        } else {
            Write-Success "Disk usage: $diskUsage%"
        }
    }
    catch {
        Write-Warning "Could not check disk usage: $_"
    }
    
    # Check memory usage
    try {
        $memory = Get-WmiObject -Class Win32_OperatingSystem
        $memUsage = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 2)
        
        if ($memUsage -gt 90) {
            $issues += "Memory usage is $memUsage% (system may be slow)"
        } elseif ($memUsage -gt 80) {
            Write-Warning "Memory usage is $memUsage% (monitor performance)"
        } else {
            Write-Success "Memory usage: $memUsage%"
        }
    }
    catch {
        Write-Warning "Could not check memory usage: $_"
    }
    
    # Check CPU usage
    try {
        $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
        $cpuUsage = $cpu.Average
        
        if ($cpuUsage -gt 90) {
            $issues += "CPU usage is $cpuUsage% (system under heavy load)"
        } elseif ($cpuUsage -gt 80) {
            Write-Warning "CPU usage is $cpuUsage% (monitor performance)"
        } else {
            Write-Success "CPU usage: $cpuUsage%"
        }
    }
    catch {
        Write-Warning "Could not check CPU usage: $_"
    }
    
    if ($issues.Count -eq 0) {
        Write-Success "System health check passed"
        return $true
    } else {
        Write-Warning "System health issues detected:"
        $issues | ForEach-Object { Write-Host "  $_" }
        return $false
    }
}func
tion Test-GitHealth {
    Write-Progress "Checking Git repository health..."
    
    try {
        git rev-parse --git-dir 2>$null | Out-Null
    }
    catch {
        Write-Info "Not in a Git repository (skipping Git checks)"
        return $true
    }
    
    $issues = @()
    
    # Check for uncommitted changes
    try {
        $status = git status --porcelain 2>$null
        if ($status) {
            $issues += "Uncommitted changes detected"
        }
    }
    catch {
        Write-Warning "Could not check Git status"
    }
    
    # Check for untracked files
    try {
        $untracked = git ls-files --others --exclude-standard 2>$null
        $untrackedCount = ($untracked | Measure-Object).Count
        if ($untrackedCount -gt 0) {
            $issues += "$untrackedCount untracked files"
        }
    }
    catch {
        Write-Warning "Could not check untracked files"
    }
    
    # Check repository size
    try {
        $gitDir = git rev-parse --git-dir 2>$null
        if (Test-Path $gitDir) {
            $size = (Get-ChildItem $gitDir -Recurse | Measure-Object -Property Length -Sum).Sum
            $sizeGB = [math]::Round($size / 1GB, 2)
            Write-Info "Repository size: $sizeGB GB"
        }
    }
    catch {
        Write-Warning "Could not determine repository size"
    }
    
    # Check remote connectivity
    try {
        $remotes = git remote 2>$null
        if ($remotes) {
            $remoteName = $remotes | Select-Object -First 1
            try {
                git ls-remote $remoteName 2>$null | Out-Null
                Write-Success "Remote '$remoteName' is accessible"
            }
            catch {
                $issues += "Remote '$remoteName' is not accessible"
            }
        }
    }
    catch {
        Write-Warning "Could not check remote connectivity"
    }
    
    if ($issues.Count -eq 0) {
        Write-Success "Git repository health check passed"
        return $true
    } else {
        Write-Warning "Git repository issues detected:"
        $issues | ForEach-Object { Write-Host "  $_" }
        return $false
    }
}

function Test-HistofyHealth {
    Write-Progress "Checking Histofy health..."
    
    $issues = @()
    
    # Check CLI availability
    if (-not (Get-Command histofy -ErrorAction SilentlyContinue)) {
        $issues += "Histofy CLI not found in PATH"
        Write-Error "Histofy CLI health check failed"
        return $false
    }
    
    # Check version
    try {
        $versionOutput = histofy --version 2>$null
        $histofyVersion = ($versionOutput -replace '.*v?(\d+\.\d+\.\d+).*', '$1')
        
        if ($histofyVersion -eq $HISTOFY_VERSION) {
            Write-Success "Histofy CLI v$histofyVersion (latest)"
        } elseif ($histofyVersion -match '\d+\.\d+\.\d+') {
            $issues += "Histofy CLI v$histofyVersion (expected v$HISTOFY_VERSION)"
        } else {
            $issues += "Could not determine Histofy version"
        }
    }
    catch {
        $issues += "Could not check Histofy version"
    }
    
    # Check configuration
    try {
        histofy config list 2>$null | Out-Null
        Write-Success "Histofy configuration system working"
        
        # Check critical configurations
        try {
            $gitAuthor = histofy config get git.defaultAuthor 2>$null
            if ([string]::IsNullOrWhiteSpace($gitAuthor)) {
                $issues += "Git default author not configured"
            } else {
                Write-Success "Git default author configured"
            }
        }
        catch {
            $issues += "Could not check Git default author configuration"
        }
        
        # Check GitHub token (optional)
        try {
            $githubToken = histofy config get github.token 2>$null
            if ([string]::IsNullOrWhiteSpace($githubToken)) {
                Write-Info "GitHub token not configured (optional)"
            } else {
                Write-Success "GitHub token configured"
            }
        }
        catch {
            Write-Info "Could not check GitHub token configuration"
        }
    }
    catch {
        $issues += "Histofy configuration system not working"
    }
    
    # Test basic functionality
    try {
        git rev-parse --git-dir 2>$null | Out-Null
        
        # Test status command
        try {
            histofy status 2>$null | Out-Null
            Write-Success "Histofy status command working"
        }
        catch {
            $issues += "Histofy status command failed"
        }
        
        # Test dry-run functionality
        try {
            histofy commit "test" --dry-run 2>$null | Out-Null
            Write-Success "Histofy dry-run functionality working"
        }
        catch {
            $issues += "Histofy dry-run functionality failed"
        }
    }
    catch {
        Write-Info "Not in Git repository (skipping functionality tests)"
    }
    
    if ($issues.Count -eq 0) {
        Write-Success "Histofy health check passed"
        return $true
    } else {
        Write-Warning "Histofy health issues detected:"
        $issues | ForEach-Object { Write-Host "  $_" }
        return $false
    }
}

function Test-PowerShellIntegration {
    Write-Progress "Checking PowerShell integration health..."
    
    $issues = @()
    
    # Check PowerShell profile
    $profilePath = $PROFILE.CurrentUserAllHosts
    
    if (Test-Path $profilePath) {
        $profileContent = Get-Content $profilePath -ErrorAction SilentlyContinue
        if ($profileContent -and ($profileContent -match "Histofy v3")) {
            Write-Success "PowerShell integration found in profile"
        } else {
            $issues += "No PowerShell integration found in profile"
        }
    } else {
        $issues += "PowerShell profile not found"
    }
    
    # Check functions file
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $functionsFile = Join-Path $scriptDir "histofy-functions.ps1"
    
    if (Test-Path $functionsFile) {
        Write-Success "PowerShell functions file exists"
    } else {
        $issues += "PowerShell functions file not found"
    }
    
    # Check environment variables
    if ($env:HISTOFY_VERSION) {
        Write-Success "HISTOFY_VERSION environment variable set"
    } else {
        $issues += "HISTOFY_VERSION environment variable not set"
    }
    
    if ($env:HISTOFY_SHELL) {
        Write-Success "HISTOFY_SHELL environment variable set"
    } else {
        $issues += "HISTOFY_SHELL environment variable not set"
    }
    
    if ($issues.Count -eq 0) {
        Write-Success "PowerShell integration health check passed"
        return $true
    } else {
        Write-Warning "PowerShell integration issues detected:"
        $issues | ForEach-Object { Write-Host "  $_" }
        return $false
    }
}

function Test-Performance {
    Write-Progress "Checking Histofy performance..."
    
    if (-not (Get-Command histofy -ErrorAction SilentlyContinue)) {
        Write-Warning "Histofy CLI not available for performance check"
        return $false
    }
    
    try {
        git rev-parse --git-dir 2>$null | Out-Null
    }
    catch {
        Write-Info "Not in Git repository (skipping performance check)"
        return $true
    }
    
    # Test command execution time
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        histofy status 2>$null | Out-Null
        $stopwatch.Stop()
        
        $duration = $stopwatch.Elapsed.TotalSeconds
        Write-Success "Histofy status execution time: $([math]::Round($duration, 3))s"
        
        # Check if performance is reasonable (< 2 seconds)
        if ($duration -gt 2) {
            Write-Warning "Histofy commands may be running slowly"
            return $false
        }
    }
    catch {
        Write-Warning "Could not measure performance: $_"
        return $false
    }
    
    Write-Success "Performance check completed"
    return $true
}

function Invoke-Diagnostics {
    Write-Progress "Running diagnostic tests..."
    
    # Test network connectivity
    try {
        $ping = Test-NetConnection -ComputerName "github.com" -Port 443 -InformationLevel Quiet
        if ($ping) {
            Write-Success "Network connectivity to GitHub available"
        } else {
            Write-Warning "Network connectivity to GitHub unavailable"
        }
    }
    catch {
        Write-Warning "Could not test network connectivity"
    }
    
    # Check npm environment
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        try {
            $npmDoctor = npm doctor 2>&1
            $npmIssues = ($npmDoctor | Select-String -Pattern "error|warn").Count
            
            if ($npmIssues -eq 0) {
                Write-Success "npm environment healthy"
            } else {
                Write-Warning "npm environment has $npmIssues issues"
            }
        }
        catch {
            Write-Warning "Could not check npm environment"
        }
    }
    
    # Check common issues
    $commonIssues = @()
    
    # Check execution policy
    $executionPolicy = Get-ExecutionPolicy
    if ($executionPolicy -eq "Restricted") {
        $commonIssues += "PowerShell execution policy is Restricted"
    }
    
    # Check PATH
    $pathDirs = $env:PATH -split ';'
    $nodeInPath = $pathDirs | Where-Object { $_ -like "*node*" -or $_ -like "*npm*" }
    if (-not $nodeInPath) {
        $commonIssues += "Node.js/npm not found in PATH"
    }
    
    if ($commonIssues.Count -gt 0) {
        Write-Warning "Common issues detected:"
        $commonIssues | ForEach-Object { Write-Host "  $_" }
        return $false
    }
    
    Write-Success "Diagnostic tests completed"
    return $true
}

function New-HealthReport {
    param([array]$Results)
    
    Write-Host ""
    Write-Host "=================================================================="
    Write-Info "Histofy v3 Health Check Report"
    Write-Host "=================================================================="
    
    $passed = ($Results | Where-Object { $_ -like "*:success" }).Count
    $total = $Results.Count
    $percentage = [math]::Round(($passed / $total) * 100)
    
    Write-Host ""
    Write-Host "Overall Health: " -NoNewline -ForegroundColor Cyan
    Write-Host "$passed/$total checks passed ($percentage%)"
    
    if ($percentage -ge 90) {
        Write-Success "Histofy installation is healthy!"
    } elseif ($percentage -ge 70) {
        Write-Warning "Histofy installation mostly healthy, minor issues detected"
    } else {
        Write-Error "Histofy installation has significant health issues"
    }
    
    Write-Host ""
    Write-Host "Detailed Results:" -ForegroundColor Gray
    
    foreach ($result in $Results) {
        $checkName, $status = $result -split ':'
        
        switch ($status) {
            "success" {
                Write-Host "  ✓ $checkName" -ForegroundColor Green
            }
            "warning" {
                Write-Host "  ⚠ $checkName" -ForegroundColor Yellow
            }
            "error" {
                Write-Host "  ✗ $checkName" -ForegroundColor Red
            }
        }
    }
    
    if ($percentage -lt 100) {
        Write-Host ""
        Write-Host "Recommendations:" -ForegroundColor Yellow
        Write-Host "  • Re-run the installer if issues persist"
        Write-Host "  • Check the troubleshooting guide: TROUBLESHOOTING.md"
        Write-Host "  • Verify system requirements are met"
        Write-Host "  • Run 'histofy help troubleshooting' for more help"
    }
    
    Write-Host ""
}

function Show-Help {
    Write-Host @"

Histofy v3 Health Check Script

USAGE:
    .\health-check.ps1 [OPTIONS]

OPTIONS:
    -Help           Show this help message
    -Version        Show version information
    -Quick          Run quick health check (skip performance tests)
    -Verbose        Show detailed output

DESCRIPTION:
    Comprehensive health check for Histofy v3 installation.
    Verifies system health, Git repository status, Histofy functionality,
    PowerShell integration, and performance.

EXIT CODES:
    0    All health checks passed
    1    Some health issues detected
    2    Critical health issues found

"@
}

# Main function
function Main {
    # Handle help and version
    if ($Help) {
        Show-Help
        exit 0
    }
    
    if ($Version) {
        Write-Host "Histofy Health Check v$SCRIPT_VERSION"
        exit 0
    }
    
    # Show banner
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║                Histofy v3 Health Check                  ║" -ForegroundColor Blue
    Write-Host "║              Comprehensive System Analysis              ║" -ForegroundColor Blue
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""
    
    # Run health checks
    $results = @()
    $overallStatus = 0
    
    # System health
    if (Test-SystemHealth) {
        $results += "System Health:success"
    } else {
        $results += "System Health:warning"
        $overallStatus = 1
    }
    
    # Git health
    if (Test-GitHealth) {
        $results += "Git Repository:success"
    } else {
        $results += "Git Repository:warning"
        $overallStatus = 1
    }
    
    # Histofy health
    if (Test-HistofyHealth) {
        $results += "Histofy CLI:success"
    } else {
        $results += "Histofy CLI:error"
        $overallStatus = 2
    }
    
    # PowerShell integration
    if (Test-PowerShellIntegration) {
        $results += "PowerShell Integration:success"
    } else {
        $results += "PowerShell Integration:warning"
        $overallStatus = 1
    }
    
    # Performance (unless quick mode)
    if (-not $Quick) {
        if (Test-Performance) {
            $results += "Performance:success"
        } else {
            $results += "Performance:warning"
            $overallStatus = 1
        }
    }
    
    # Diagnostics
    if (Invoke-Diagnostics) {
        $results += "Diagnostics:success"
    } else {
        $results += "Diagnostics:warning"
        $overallStatus = 1
    }
    
    # Generate report
    New-HealthReport $results
    
    exit $overallStatus
}

# Execute main function
Main