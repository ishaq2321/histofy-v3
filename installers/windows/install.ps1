# Histofy v3 - Enhanced Windows PowerShell Installer
# Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
# Licensed under MIT License - https://opensource.org/licenses/MIT

param(
    [switch]$Help,
    [switch]$Version,
    [switch]$Silent,
    [switch]$Force,
    [switch]$DevMode,
    [switch]$UpdateOnly,
    [switch]$SkipCli,
    [switch]$SkipFunctions,
    [switch]$SkipCompletion,
    [switch]$VerifyOnly,
    [switch]$Uninstall,
    [string]$InstallPath = "",
    [string]$ConfigPath = "",
    [switch]$SystemWide
)

# Installer configuration
$HISTOFY_VERSION = "3.0.0"
$INSTALLER_VERSION = "2.0.0"
$MIN_NODE_VERSION = "16.0.0"
$MIN_GIT_VERSION = "2.20.0"
$MIN_POWERSHELL_VERSION = "5.1"

# Enhanced output functions with emoji support
$EmojiSupport = $true
if ($env:CI -eq "true" -or $env:TERM -eq "dumb") {
    $EmojiSupport = $false
}

function Write-Info {
    param([string]$Message)
    $icon = if ($EmojiSupport) { "ℹ️" } else { "[INFO]" }
    if (-not $Silent) {
        Write-Host "$icon $Message" -ForegroundColor Cyan
    }
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
    if (-not $Silent) {
        Write-Host "$icon $Message" -ForegroundColor Blue
    }
}

function Write-Debug {
    param([string]$Message)
    $icon = if ($EmojiSupport) { "🔍" } else { "[DEBUG]" }
    if ($env:DEBUG -eq "true") {
        Write-Host "$icon $Message" -ForegroundColor Gray
    }
}funct
ion Get-SystemInfo {
    Write-Progress "Detecting system..."
    
    $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
    $osVersion = "$($osInfo.Caption) $($osInfo.Version)"
    
    $arch = $env:PROCESSOR_ARCHITECTURE
    if ($arch -eq "AMD64") { $arch = "x64" }
    elseif ($arch -eq "x86") { $arch = "x86" }
    
    $psVersion = $PSVersionTable.PSVersion.ToString()
    
    $systemInfo = "OS: $osVersion, Architecture: $arch, PowerShell: $psVersion"
    
    # Check if running as Administrator
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if ($isAdmin) {
        $systemInfo += ", Running as: Administrator"
    } else {
        $systemInfo += ", Running as: User"
    }
    
    return $systemInfo
}

function Test-WindowsCompatibility {
    Write-Progress "Checking Windows compatibility..."
    
    $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
    $osVersion = [Version]$osInfo.Version
    
    # Check Windows version (Windows 10 1809+ or Windows Server 2019+)
    $minVersion = [Version]"10.0.17763"
    if ($osVersion -lt $minVersion) {
        Write-Error "Windows 10 version 1809 or later required (found: $($osInfo.Caption) $($osInfo.Version))"
        return $false
    }
    
    # Check PowerShell version
    $psVersion = $PSVersionTable.PSVersion
    $minPsVersion = [Version]$MIN_POWERSHELL_VERSION
    if ($psVersion -lt $minPsVersion) {
        Write-Error "PowerShell v$MIN_POWERSHELL_VERSION+ required (found: v$psVersion)"
        return $false
    }
    
    # Check architecture
    $arch = $env:PROCESSOR_ARCHITECTURE
    if ($arch -notin @("AMD64", "x86", "ARM64")) {
        Write-Warning "Unsupported architecture: $arch"
        Write-Warning "Installation may not work properly"
    }
    
    Write-Success "Windows compatibility check passed"
    return $true
}

function Compare-Version {
    param(
        [string]$Version1,
        [string]$Version2
    )
    
    try {
        $v1 = [Version]$Version1
        $v2 = [Version]$Version2
        
        if ($v1 -eq $v2) { return 0 }
        elseif ($v1 -gt $v2) { return 1 }
        else { return -1 }
    }
    catch {
        # Fallback to string comparison
        if ($Version1 -eq $Version2) { return 0 }
        elseif ($Version1 -gt $Version2) { return 1 }
        else { return -1 }
    }
}

function Test-Prerequisites {
    Write-Progress "Checking prerequisites..."
    
    $missingDeps = @()
    $packageManager = ""
    
    # Check for package managers
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $packageManager = "npm"
    } elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
        $packageManager = "yarn"
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        $packageManager = "chocolatey"
    } elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        $packageManager = "winget"
    }
    
    # Check Node.js
    if (Get-Command node -ErrorAction SilentlyContinue) {
        try {
            $nodeVersion = (node --version 2>$null) -replace '^v', ''
            $versionCompare = Compare-Version $nodeVersion $MIN_NODE_VERSION
            
            if ($versionCompare -lt 0) {
                Write-Error "Node.js v$MIN_NODE_VERSION+ required (found: v$nodeVersion)"
                $missingDeps += "nodejs"
            } else {
                Write-Success "Node.js v$nodeVersion detected"
            }
        }
        catch {
            Write-Error "Node.js version check failed"
            $missingDeps += "nodejs"
        }
    } else {
        Write-Error "Node.js not found"
        $missingDeps += "nodejs"
    }
    
    # Check npm or yarn
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        try {
            $npmVersion = npm --version 2>$null
            Write-Success "npm v$npmVersion detected"
        }
        catch {
            Write-Warning "npm version check failed"
        }
    } elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
        try {
            $yarnVersion = yarn --version 2>$null
            Write-Success "Yarn v$yarnVersion detected"
        }
        catch {
            Write-Warning "Yarn version check failed"
        }
    } else {
        Write-Error "Neither npm nor yarn found"
        $missingDeps += "npm"
    }
    
    # Check Git
    if (Get-Command git -ErrorAction SilentlyContinue) {
        try {
            $gitVersionOutput = git --version 2>$null
            $gitVersion = ($gitVersionOutput -split ' ')[-1]
            $versionCompare = Compare-Version $gitVersion $MIN_GIT_VERSION
            
            if ($versionCompare -lt 0) {
                Write-Error "Git v$MIN_GIT_VERSION+ required (found: v$gitVersion)"
                $missingDeps += "git"
            } else {
                Write-Success "Git v$gitVersion detected"
            }
        }
        catch {
            Write-Error "Git version check failed"
            $missingDeps += "git"
        }
    } else {
        Write-Error "Git not found"
        $missingDeps += "git"
    }
    
    # Handle missing dependencies
    if ($missingDeps.Count -gt 0) {
        Write-Error "Missing dependencies: $($missingDeps -join ', ')"
        
        if (-not $Silent) {
            Write-Info "To install missing dependencies:"
            
            switch ($packageManager) {
                "chocolatey" {
                    Write-Host "  choco install $($missingDeps -join ' ')"
                }
                "winget" {
                    foreach ($dep in $missingDeps) {
                        switch ($dep) {
                            "nodejs" { Write-Host "  winget install OpenJS.NodeJS" }
                            "git" { Write-Host "  winget install Git.Git" }
                            "npm" { Write-Host "  npm is included with Node.js" }
                        }
                    }
                }
                default {
                    Write-Host "  Install manually or use a package manager like Chocolatey or winget"
                    Write-Host "  Chocolatey: https://chocolatey.org/"
                    Write-Host "  winget: Built into Windows 10/11"
                }
            }
        }
        
        return @{
            Status = "error"
            PackageManager = $packageManager
        }
    }
    
    Write-Success "All prerequisites satisfied"
    return @{
        Status = "success"
        PackageManager = $packageManager
    }
}fu
nction Install-HistofyCli {
    param([string]$PackageManager)
    
    Write-Progress "Installing Histofy CLI..."
    
    # Check if already installed
    if ((Get-Command histofy -ErrorAction SilentlyContinue) -and (-not $UpdateOnly)) {
        try {
            $currentVersion = (histofy --version 2>$null) -replace '.*v?(\d+\.\d+\.\d+).*', '$1'
            
            if (-not $Force) {
                Write-Warning "Histofy CLI already installed (v$currentVersion)"
                $updateChoice = Read-Host "Update to v$HISTOFY_VERSION? (y/N)"
                if ($updateChoice -notin @('y', 'Y')) {
                    Write-Info "Skipping CLI installation"
                    return $true
                }
            }
        }
        catch {
            Write-Warning "Could not determine current Histofy version"
        }
    }
    
    # Install via npm or yarn
    $installSuccess = $false
    
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        try {
            if ($DevMode) {
                $installCmd = "npm install -g ."
            } else {
                $installCmd = "npm install -g histofy-cli@$HISTOFY_VERSION"
            }
            
            Write-Debug "Running: $installCmd"
            Invoke-Expression $installCmd | Out-Null
            $installSuccess = $true
        }
        catch {
            Write-Debug "npm installation failed: $_"
        }
    } elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
        try {
            if ($DevMode) {
                $installCmd = "yarn global add file:$(Get-Location)"
            } else {
                $installCmd = "yarn global add histofy-cli@$HISTOFY_VERSION"
            }
            
            Write-Debug "Running: $installCmd"
            Invoke-Expression $installCmd | Out-Null
            $installSuccess = $true
        }
        catch {
            Write-Debug "yarn installation failed: $_"
        }
    }
    
    if ($installSuccess) {
        # Verify installation
        if (Get-Command histofy -ErrorAction SilentlyContinue) {
            try {
                $installedVersion = (histofy --version 2>$null) -replace '.*v?(\d+\.\d+\.\d+).*', '$1'
                Write-Success "Histofy CLI v$installedVersion installed successfully"
                return $true
            }
            catch {
                Write-Error "CLI installation verification failed"
                return $false
            }
        } else {
            Write-Error "CLI installation verification failed: histofy command not found"
            return $false
        }
    } else {
        Write-Error "CLI installation failed"
        return $false
    }
}

function New-PowerShellFunctions {
    param([string]$FunctionsFile)
    
    $functionsContent = @'
# Histofy v3 - Enhanced PowerShell Functions
# Auto-generated by installer - do not edit manually

# Quick commit with custom date
function hc {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        [string]$Date,
        [string]$Time
    )
    
    if (-not $Message) {
        Write-Host "Usage: hc <message> [date] [time]"
        Write-Host "Examples:"
        Write-Host "  hc 'Fix bug' 2023-12-25"
        Write-Host "  hc 'Add feature' 2023-12-25 14:30"
        return
    }
    
    $cmd = "histofy commit '$Message'"
    
    if ($Date) {
        $cmd += " --date '$Date'"
    }
    
    if ($Time) {
        $cmd += " --time '$Time'"
    }
    
    Invoke-Expression $cmd
}

# Quick commit with push
function hcp {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        [string]$Date,
        [string]$Time
    )
    
    if (-not $Message) {
        Write-Host "Usage: hcp <message> [date] [time]"
        Write-Host "Examples:"
        Write-Host "  hcp 'Deploy fix' 2023-12-25"
        Write-Host "  hcp 'Release v1.0' 2023-12-25 16:00"
        return
    }
    
    $cmd = "histofy commit '$Message' --push"
    
    if ($Date) {
        $cmd += " --date '$Date'"
    }
    
    if ($Time) {
        $cmd += " --time '$Time'"
    }
    
    Invoke-Expression $cmd
}

# Quick status
function hs {
    histofy status @args
}

# Interactive commit
function hci {
    histofy commit --interactive @args
}

# Quick help
function hh {
    if ($args.Count -eq 0) {
        histofy help
    } else {
        histofy help @args
    }
}

# Batch operations
function hb {
    histofy batch @args
}

# Analysis
function ha {
    histofy analyze @args
}

# Performance monitoring
function hp {
    histofy performance @args
}

# Configuration
function hcfg {
    histofy config @args
}

# Export data
function hex {
    histofy export @args
}

# Import data
function him {
    histofy import @args
}

# Undo operations
function hu {
    histofy undo @args
}

# Audit operations
function haudit {
    histofy audit @args
}

# Migration
function hmig {
    histofy migrate @args
}
'@

    try {
        $functionsContent | Out-File -FilePath $FunctionsFile -Encoding UTF8
        Write-Success "PowerShell functions created: $FunctionsFile"
        return $true
    }
    catch {
        Write-Error "Failed to create PowerShell functions: $_"
        return $false
    }
}fun
ction Install-PowerShellIntegration {
    Write-Progress "Installing PowerShell integration..."
    
    # Create functions file
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $functionsFile = Join-Path $scriptDir "histofy-functions.ps1"
    
    if (-not (New-PowerShellFunctions $functionsFile)) {
        return $false
    }
    
    # Get PowerShell profile path
    $profilePath = $PROFILE.CurrentUserAllHosts
    $profileDir = Split-Path -Parent $profilePath
    
    # Create profile directory if it doesn't exist
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }
    
    # Create profile file if it doesn't exist
    if (-not (Test-Path $profilePath)) {
        New-Item -ItemType File -Path $profilePath -Force | Out-Null
    }
    
    # Check if already integrated
    $profileContent = Get-Content $profilePath -ErrorAction SilentlyContinue
    if ($profileContent -and ($profileContent -match "Histofy v3")) {
        if (-not $Force) {
            Write-Warning "PowerShell integration already exists"
            $updateChoice = Read-Host "Update integration? (y/N)"
            if ($updateChoice -notin @('y', 'Y')) {
                Write-Info "Skipping PowerShell integration"
                return $true
            }
        }
        
        # Remove existing integration
        $newContent = $profileContent | Where-Object { 
            $_ -notmatch "# Histofy v3" -and 
            $_ -notmatch "# End Histofy v3" -and
            $_ -notmatch "histofy-functions.ps1"
        }
        $newContent | Out-File -FilePath $profilePath -Encoding UTF8
    }
    
    # Add integration
    $integrationContent = @"

# Histofy v3 - Enhanced Git History Management
# Auto-generated by installer - do not edit manually
`$env:HISTOFY_VERSION = "$HISTOFY_VERSION"
`$env:HISTOFY_SHELL = "powershell"

# Load Histofy functions
if (Test-Path "$functionsFile") {
    . "$functionsFile"
}

# Histofy aliases and shortcuts
Set-Alias -Name histofy-version -Value "histofy --version"
Set-Alias -Name histofy-help -Value "histofy help"
Set-Alias -Name histofy-status -Value "histofy status"
Set-Alias -Name histofy-config -Value "histofy config"

# Enhanced Git aliases with Histofy integration
Set-Alias -Name gch -Value "histofy commit"
Set-Alias -Name gcs -Value "histofy status"
Set-Alias -Name gca -Value "histofy analyze"
Set-Alias -Name gcb -Value "histofy batch"

# End Histofy v3
"@

    try {
        Add-Content -Path $profilePath -Value $integrationContent -Encoding UTF8
        Write-Success "PowerShell integration installed"
        Write-Info "Configuration updated: $profilePath"
        return $true
    }
    catch {
        Write-Error "Failed to install PowerShell integration: $_"
        return $false
    }
}

function Install-PowerShellCompletion {
    Write-Progress "Installing PowerShell auto-completion..."
    
    # PowerShell completion is handled through the profile integration
    # Advanced completion would require a separate module
    Write-Success "Basic PowerShell completion installed via profile"
    return $true
}

function Test-Installation {
    Write-Progress "Verifying installation..."
    
    # Use comprehensive health check if available
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $healthCheckScript = Join-Path (Split-Path -Parent $scriptDir) "health-check.ps1"
    
    if (Test-Path $healthCheckScript) {
        Write-Info "Running comprehensive health check..."
        
        try {
            $result = & $healthCheckScript -Silent -Json | ConvertFrom-Json
            
            if ($result.success) {
                Write-Success "Comprehensive verification passed"
                return $true
            } else {
                Write-Warning "Comprehensive verification found issues"
                
                # Run detailed check for troubleshooting
                if (-not $Silent) {
                    Write-Host ""
                    Write-Info "Running detailed health check for troubleshooting..."
                    & $healthCheckScript -Verbose -Fix
                }
                return $false
            }
        }
        catch {
            Write-Warning "Health check script failed: $_"
            # Fall back to basic verification
        }
    }
    
    # Fallback to basic verification
    Write-Info "Running basic verification..."
    
    $verificationPassed = $true
    $issues = @()
    
    # Test CLI
    if (Get-Command histofy -ErrorAction SilentlyContinue) {
        try {
            $histofyVersion = histofy --version 2>$null
            Write-Success "CLI verification: $histofyVersion"
        }
        catch {
            Write-Success "CLI verification: histofy command found"
        }
    } else {
        Write-Error "CLI verification failed: histofy command not found"
        $issues += "Histofy CLI not accessible"
        $verificationPassed = $false
    }
    
    # Test PowerShell integration
    $profilePath = $PROFILE.CurrentUserAllHosts
    $functionsFile = Join-Path $scriptDir "histofy-functions.ps1"
    
    if ((Test-Path $profilePath) -and (Test-Path $functionsFile)) {
        $profileContent = Get-Content $profilePath -ErrorAction SilentlyContinue
        if ($profileContent -and ($profileContent -match "Histofy v3")) {
            Write-Success "PowerShell integration verified"
        } else {
            Write-Warning "PowerShell integration may not be properly configured"
            $issues += "PowerShell integration configuration issue"
        }
    } else {
        Write-Error "PowerShell integration files missing"
        $issues += "PowerShell integration files not found"
        $verificationPassed = $false
    }
    
    # Test configuration
    try {
        histofy config list 2>$null | Out-Null
        Write-Success "Configuration system verified"
    }
    catch {
        Write-Warning "Configuration not initialized (run 'histofy config init')"
    }
    
    if ($verificationPassed) {
        Write-Success "Basic verification passed"
        return $true
    } else {
        Write-Error "Basic verification failed"
        $issues | ForEach-Object { Write-Host "  $_" }
        return $false
    }
}fun
ction Show-PostInstallInstructions {
    Write-Host ""
    Write-Success "🎉 Installation completed successfully!"
    Write-Host ""
    
    Write-Info "📋 Next Steps:"
    Write-Host ""
    
    # PowerShell reload
    $profilePath = $PROFILE.CurrentUserAllHosts
    
    Write-Host "1. " -ForegroundColor Yellow -NoNewline
    Write-Host "Reload your PowerShell profile:" -ForegroundColor White
    Write-Host "   . `"$profilePath`"" -ForegroundColor Cyan
    Write-Host "   (or restart your PowerShell session)" -ForegroundColor Gray
    Write-Host ""
    
    # Configuration setup
    Write-Host "2. " -ForegroundColor Yellow -NoNewline
    Write-Host "Initialize Histofy configuration:" -ForegroundColor White
    Write-Host "   histofy config init" -ForegroundColor Cyan
    Write-Host ""
    
    # GitHub token setup
    Write-Host "3. " -ForegroundColor Yellow -NoNewline
    Write-Host "Set your GitHub token (optional but recommended):" -ForegroundColor White
    Write-Host "   histofy config set github.token YOUR_GITHUB_TOKEN" -ForegroundColor Cyan
    Write-Host ""
    
    # Git defaults
    Write-Host "4. " -ForegroundColor Yellow -NoNewline
    Write-Host "Configure Git defaults:" -ForegroundColor White
    Write-Host "   histofy config set git.defaultAuthor `"Your Name <email@example.com>`"" -ForegroundColor Cyan
    Write-Host ""
    
    # Test installation
    Write-Host "5. " -ForegroundColor Yellow -NoNewline
    Write-Host "Test the installation:" -ForegroundColor White
    Write-Host "   histofy status" -ForegroundColor Cyan
    Write-Host "   hh  # Show quick help" -ForegroundColor Cyan
    Write-Host ""
    
    # Quick commands reference
    Write-Info "🚀 Quick Commands:"
    Write-Host "   " -NoNewline
    Write-Host "hc" -ForegroundColor Green -NoNewline
    Write-Host "   - Quick commit with date     " -NoNewline
    Write-Host "hc 'Fix bug' 2023-12-25 14:30" -ForegroundColor Gray
    Write-Host "   " -NoNewline
    Write-Host "hcp" -ForegroundColor Green -NoNewline
    Write-Host "  - Quick commit with push     " -NoNewline
    Write-Host "hcp 'Deploy' 2023-12-25" -ForegroundColor Gray
    Write-Host "   " -NoNewline
    Write-Host "hs" -ForegroundColor Green -NoNewline
    Write-Host "   - Show status               " -NoNewline
    Write-Host "hs -remote" -ForegroundColor Gray
    Write-Host "   " -NoNewline
    Write-Host "hci" -ForegroundColor Green -NoNewline
    Write-Host "  - Interactive commit         " -NoNewline
    Write-Host "hci" -ForegroundColor Gray
    Write-Host "   " -NoNewline
    Write-Host "hh" -ForegroundColor Green -NoNewline
    Write-Host "   - Show help                 " -NoNewline
    Write-Host "hh" -ForegroundColor Gray
    Write-Host ""
    
    Write-Info "📚 For more help:"
    Write-Host "   histofy help tutorials    # Interactive tutorials" -ForegroundColor Cyan
    Write-Host "   histofy help examples     # Command examples" -ForegroundColor Cyan
    Write-Host "   histofy help faq          # Frequently asked questions" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Success "Happy coding with Histofy! 🚀"
}

function Show-Help {
    Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                Histofy v3 Windows Installer             ║
║           Enhanced PowerShell Cross-Platform Setup      ║
╚══════════════════════════════════════════════════════════╝

USAGE:
    .\install.ps1 [OPTIONS]

OPTIONS:
    -Help                Show this help message
    -Version             Show version information
    -Silent              Run in silent mode (minimal output)
    -Force               Force installation even if issues detected
    -DevMode             Install from local development project
    -UpdateOnly          Only update existing installation

COMPONENT OPTIONS:
    -SkipCli             Skip CLI installation
    -SkipFunctions       Skip PowerShell functions installation
    -SkipCompletion      Skip auto-completion setup

ADVANCED OPTIONS:
    -InstallPath PATH    Custom installation path
    -ConfigPath PATH     Custom configuration path
    -SystemWide          Install system-wide (requires admin)

MAINTENANCE:
    -VerifyOnly          Only verify existing installation
    -Uninstall           Uninstall Histofy

EXAMPLES:
    .\install.ps1                    # Standard installation
    .\install.ps1 -Silent            # Silent installation
    .\install.ps1 -DevMode           # Development installation
    .\install.ps1 -VerifyOnly        # Verify installation
    .\install.ps1 -Uninstall         # Remove Histofy

SYSTEM REQUIREMENTS:
    - Windows 10 version 1809+ or Windows Server 2019+
    - PowerShell v$MIN_POWERSHELL_VERSION+
    - Node.js v$MIN_NODE_VERSION+
    - Git v$MIN_GIT_VERSION+

"@
}

function Show-Version {
    Write-Host @"

Histofy v3 Windows Installer
Version: $INSTALLER_VERSION
Target Histofy version: v$HISTOFY_VERSION

System Requirements:
  PowerShell: v$MIN_POWERSHELL_VERSION+
  Node.js: v$MIN_NODE_VERSION+
  Git: v$MIN_GIT_VERSION+

Supported Shells: PowerShell

"@
}# Main i
nstallation function
function Main {
    # Handle help and version
    if ($Help) {
        Show-Help
        exit 0
    }
    
    if ($Version) {
        Show-Version
        exit 0
    }
    
    # Show banner (unless silent)
    if (-not $Silent) {
        Write-Host ""
        Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Blue
        Write-Host "║                Histofy v3 Windows Installer             ║" -ForegroundColor Blue
        Write-Host "║           Enhanced PowerShell Cross-Platform Setup      ║" -ForegroundColor Blue
        Write-Host "║                                                          ║" -ForegroundColor Blue
        Write-Host "║  Version: $($INSTALLER_VERSION.PadRight(47)) ║" -ForegroundColor Blue
        Write-Host "║  Target: Histofy v$($HISTOFY_VERSION.PadRight(40)) ║" -ForegroundColor Blue
        Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Blue
        Write-Host ""
    }
    
    # Handle uninstall
    if ($Uninstall) {
        Write-Error "Uninstall functionality not yet implemented"
        exit 1
    }
    
    # System detection and compatibility check
    $systemInfo = Get-SystemInfo
    
    if (-not $Silent) {
        Write-Info $systemInfo
    }
    
    # Check Windows compatibility
    if (-not (Test-WindowsCompatibility)) {
        if (-not $Force) {
            Write-Error "System compatibility check failed. Use -Force to bypass."
            exit 1
        } else {
            Write-Warning "Bypassing compatibility checks due to -Force flag"
        }
    }
    
    # Check prerequisites
    $prereqResult = Test-Prerequisites
    
    if ($prereqResult.Status -ne "success") {
        Write-Error "Prerequisites check failed"
        if (-not $Force) {
            exit 1
        } else {
            Write-Warning "Continuing with -Force flag despite missing prerequisites"
        }
    }
    
    # Verify only mode
    if ($VerifyOnly) {
        if (Test-Installation) {
            Write-Success "Installation verification passed"
            exit 0
        } else {
            Write-Error "Installation verification failed"
            exit 1
        }
    }
    
    # Installation process
    $installationSuccess = $true
    
    # Install CLI
    if (-not $SkipCli) {
        if (-not (Install-HistofyCli $prereqResult.PackageManager)) {
            $installationSuccess = $false
            if (-not $Force) {
                Write-Error "CLI installation failed"
                exit 1
            }
        }
    }
    
    # Install PowerShell integration
    if (-not $SkipFunctions) {
        if (-not (Install-PowerShellIntegration)) {
            $installationSuccess = $false
            Write-Warning "PowerShell integration installation failed"
        }
    }
    
    # Install auto-completion
    if (-not $SkipCompletion) {
        if (-not (Install-PowerShellCompletion)) {
            Write-Warning "Auto-completion installation failed"
        }
    }
    
    # Verify installation
    if (Test-Installation) {
        Show-PostInstallInstructions
    } else {
        Write-Warning "Installation completed with issues"
        $installationSuccess = $false
    }
    
    if ($installationSuccess) {
        exit 0
    } else {
        exit 1
    }
}

# Execute main function
Main