# Histofy v3 PowerShell Installer
# Cross-platform installer for Windows PowerShell and PowerShell Core

param(
    [switch]$SkipCli,
    [switch]$SkipFunctions,
    [switch]$SkipCompletion,
    [switch]$VerifyOnly,
    [switch]$Uninstall,
    [switch]$Help,
    [switch]$Version
)

# Version information
$HistofyVersion = "3.0.0"
$InstallerVersion = "1.0.0"

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
    Purple = "Magenta"
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    if ($Colors.ContainsKey($Color)) {
        Write-Host $Message -ForegroundColor $Colors[$Color]
    } else {
        Write-Host $Message
    }
}

function Show-Help {
    Write-Host "Histofy v3 PowerShell Installer" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Usage: .\install.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Help               Show this help message"
    Write-Host "  -Version            Show version information"
    Write-Host "  -SkipCli            Skip CLI installation"
    Write-Host "  -SkipFunctions      Skip PowerShell functions installation"
    Write-Host "  -SkipCompletion     Skip completion setup"
    Write-Host "  -VerifyOnly         Only verify existing installation"
    Write-Host "  -Uninstall          Uninstall Histofy"
    Write-Host ""
}

function Show-Version {
    Write-Host "Histofy PowerShell Installer v$InstallerVersion" -ForegroundColor Blue
    Write-Host "Target Histofy version: v$HistofyVersion"
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-SystemInfo {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $psVersion = $PSVersionTable.PSVersion
    
    return @{
        OS = "$($os.Caption) ($($os.Version))"
        Architecture = $env:PROCESSOR_ARCHITECTURE
        PowerShellVersion = $psVersion.ToString()
        PowerShellEdition = $PSVersionTable.PSEdition
    }
}

function Test-Requirements {
    Write-ColorOutput "System Information:" "Cyan"
    
    $sysInfo = Get-SystemInfo
    Write-ColorOutput "  OS: $($sysInfo.OS)" "Yellow"
    Write-ColorOutput "  Architecture: $($sysInfo.Architecture)" "Yellow"
    Write-ColorOutput "  PowerShell: $($sysInfo.PowerShellVersion) ($($sysInfo.PowerShellEdition))" "Yellow"
    Write-Host ""
    
    $allGood = $true
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-ColorOutput "✅ Node.js found: $nodeVersion" "Green"
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-ColorOutput "❌ Node.js not found" "Red"
        Write-ColorOutput "Please install Node.js (v14 or higher) from https://nodejs.org" "Yellow"
        $allGood = $false
    }
    
    # Check Git
    try {
        $gitVersion = git --version 2>$null
        if ($gitVersion) {
            Write-ColorOutput "✅ Git found: $gitVersion" "Green"
        } else {
            throw "Git not found"
        }
    } catch {
        Write-ColorOutput "❌ Git not found" "Red"
        Write-ColorOutput "Please install Git from https://git-scm.com" "Yellow"
        $allGood = $false
    }
    
    # Check package manager
    $packageManager = "none"
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $packageManager = "npm"
        Write-ColorOutput "✅ Package Manager: npm" "Green"
    } elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
        $packageManager = "yarn"
        Write-ColorOutput "✅ Package Manager: yarn" "Green"
    } elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
        $packageManager = "pnpm"
        Write-ColorOutput "✅ Package Manager: pnpm" "Green"
    } else {
        Write-ColorOutput "❌ No package manager found" "Red"
        Write-ColorOutput "Please install npm, yarn, or pnpm" "Yellow"
        $allGood = $false
    }
    
    Write-Host ""
    return @{
        Success = $allGood
        PackageManager = $packageManager
    }
}

function Install-HistofyCli {
    param([string]$PackageManager)
    
    Write-ColorOutput "Installing/updating Histofy CLI..." "Blue"
    
    # Check if we're in the Histofy project directory
    $packageJsonPath = Join-Path (Split-Path $ScriptDir -Parent) "package.json"
    $isLocalProject = $false
    
    if (Test-Path $packageJsonPath) {
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        if ($packageJson.name -eq "histofy-cli") {
            $isLocalProject = $true
        }
    }
    
    try {
        if ($isLocalProject) {
            Write-ColorOutput "Installing from local project..." "Cyan"
            Push-Location (Split-Path $ScriptDir -Parent)
            
            switch ($PackageManager) {
                "npm" {
                    try {
                        npm install -g . 2>$null
                    } catch {
                        npm link 2>$null
                    }
                }
                "yarn" {
                    try {
                        yarn global add . 2>$null
                    } catch {
                        yarn link 2>$null
                    }
                }
                "pnpm" {
                    try {
                        pnpm install -g . 2>$null
                    } catch {
                        pnpm link --global 2>$null
                    }
                }
            }
            
            Pop-Location
        } else {
            Write-ColorOutput "Installing from npm registry..." "Cyan"
            
            switch ($PackageManager) {
                "npm" { npm install -g histofy-cli }
                "yarn" { yarn global add histofy-cli }
                "pnpm" { pnpm install -g histofy-cli }
            }
        }
        
        # Verify installation
        $histofyVersion = histofy --version 2>$null
        if ($histofyVersion) {
            Write-ColorOutput "✅ Histofy CLI installed: $histofyVersion" "Green"
            return $true
        } else {
            throw "Histofy CLI installation verification failed"
        }
    } catch {
        Write-ColorOutput "❌ Histofy CLI installation failed: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Get-PowerShellProfile {
    # Determine the appropriate PowerShell profile
    if ($PSVersionTable.PSEdition -eq "Core") {
        # PowerShell Core
        return $PROFILE.CurrentUserAllHosts
    } else {
        # Windows PowerShell
        return $PROFILE.CurrentUserAllHosts
    }
}

function Install-PowerShellFunctions {
    Write-ColorOutput "Installing Histofy PowerShell functions..." "Blue"
    
    $profilePath = Get-PowerShellProfile
    $functionsFile = Join-Path $ScriptDir "powershell_functions.ps1"
    
    Write-ColorOutput "  Profile: $profilePath" "Yellow"
    Write-ColorOutput "  Functions file: $functionsFile" "Yellow"
    Write-Host ""
    
    # Create functions file if it doesn't exist
    if (-not (Test-Path $functionsFile)) {
        Write-ColorOutput "Creating PowerShell functions file..." "Blue"
        
        $functionsContent = @'
# Histofy v3 - PowerShell Functions
# Add these functions to your PowerShell profile for easier Histofy usage

# Input validation functions
function Test-HistofyDate {
    param([string]$Date)
    
    try {
        $parsedDate = [DateTime]::ParseExact($Date, "yyyy-MM-dd", $null)
        return $true
    } catch {
        Write-Host "Error: Invalid date format. Use YYYY-MM-DD" -ForegroundColor Red
        return $false
    }
}

function Test-HistofyTime {
    param([string]$Time)
    
    if ($Time -match "^([01]?[0-9]|2[0-3]):[0-5][0-9]$") {
        return $true
    } else {
        Write-Host "Error: Invalid time format. Use HH:MM" -ForegroundColor Red
        return $false
    }
}

function Test-HistofyMessage {
    param([string]$Message)
    
    # Remove potentially dangerous characters
    $sanitized = $Message -replace '[;&|`$(){}[\]\\<>]', ''
    
    if ($sanitized -ne $Message) {
        Write-Host "Error: Commit message contains dangerous characters" -ForegroundColor Red
        return $false
    }
    
    if ($Message.Length -lt 5) {
        Write-Host "Error: Commit message too short (minimum 5 characters)" -ForegroundColor Red
        return $false
    }
    
    if ($Message.Length -gt 72) {
        Write-Host "Error: Commit message too long (maximum 72 characters)" -ForegroundColor Red
        return $false
    }
    
    return $true
}

# Quick commit with custom date
function Invoke-HistofyCommit {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$true)]
        [string]$Date,
        
        [string]$Time = "12:00"
    )
    
    if (-not (Test-HistofyMessage $Message)) { return }
    if (-not (Test-HistofyDate $Date)) { return }
    if (-not (Test-HistofyTime $Time)) { return }
    
    histofy commit $Message --date $Date --time $Time --add-all
}

# Quick commit with push
function Invoke-HistofyCommitPush {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$true)]
        [string]$Date,
        
        [string]$Time = "12:00"
    )
    
    if (-not (Test-HistofyMessage $Message)) { return }
    if (-not (Test-HistofyDate $Date)) { return }
    if (-not (Test-HistofyTime $Time)) { return }
    
    histofy commit $Message --date $Date --time $Time --add-all --push
}

# Quick status check
function Invoke-HistofyStatus {
    param([string[]]$Arguments)
    
    if ($Arguments) {
        histofy status @Arguments
    } else {
        histofy status
    }
}

# Interactive commit with date picker
function Invoke-HistofyInteractiveCommit {
    histofy commit
}

# Show histofy help
function Show-HistofyHelp {
    histofy --help
}

# Show Histofy help and quick reference
function Show-HistofyQuickHelp {
    Write-Host "🎉 Histofy v3 Quick Reference" -ForegroundColor Blue
    Write-Host "Available commands:"
    Write-Host "  hc   - Quick commit with date (Invoke-HistofyCommit)"
    Write-Host "  hcp  - Quick commit with push (Invoke-HistofyCommitPush)"
    Write-Host "  hs   - Show status (Invoke-HistofyStatus)"
    Write-Host "  hci  - Interactive commit (Invoke-HistofyInteractiveCommit)"
    Write-Host "  hh   - Show help (Show-HistofyHelp)"
    Write-Host "  hhelp - Show this help message (Show-HistofyQuickHelp)"
}

# Aliases for easier usage
Set-Alias -Name hc -Value Invoke-HistofyCommit
Set-Alias -Name hcp -Value Invoke-HistofyCommitPush
Set-Alias -Name hs -Value Invoke-HistofyStatus
Set-Alias -Name hci -Value Invoke-HistofyInteractiveCommit
Set-Alias -Name hh -Value Show-HistofyHelp
Set-Alias -Name hhelp -Value Show-HistofyQuickHelp

Write-Host "Histofy v3 PowerShell functions loaded! Type 'hhelp' for quick reference." -ForegroundColor Green
'@
        
        Set-Content -Path $functionsFile -Value $functionsContent -Encoding UTF8
        Write-ColorOutput "✅ PowerShell functions file created" "Green"
    }
    
    # Ensure profile directory exists
    $profileDir = Split-Path $profilePath -Parent
    if (-not (Test-Path $profileDir)) {
        Write-ColorOutput "Creating profile directory: $profileDir" "Blue"
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }
    
    # Check if functions are already installed
    $profileExists = Test-Path $profilePath
    $alreadyInstalled = $false
    
    if ($profileExists) {
        $profileContent = Get-Content $profilePath -Raw
        if ($profileContent -match "Histofy v3") {
            Write-ColorOutput "Histofy functions already installed. Updating..." "Yellow"
            $alreadyInstalled = $true
            
            # Remove old installation
            $profileContent = $profileContent -replace '(?s)# Histofy v3 - PowerShell Functions.*?# End Histofy v3', ''
            Set-Content -Path $profilePath -Value $profileContent.Trim() -Encoding UTF8
        }
    }
    
    # Add new installation
    $installationBlock = @"

# Histofy v3 - PowerShell Functions (installed $(Get-Date))
if (Test-Path "$functionsFile") {
    . "$functionsFile"
}
# End Histofy v3
"@
    
    Add-Content -Path $profilePath -Value $installationBlock -Encoding UTF8
    
    Write-ColorOutput "✅ PowerShell functions installed successfully!" "Green"
    Write-Host ""
}

function Install-PowerShellCompletion {
    Write-ColorOutput "Setting up PowerShell completion..." "Blue"
    
    # PowerShell completion is typically handled through argument completers
    $completionScript = @'
# Histofy PowerShell Completion

Register-ArgumentCompleter -CommandName histofy -ScriptBlock {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
    
    $commands = @('commit', 'config', 'migrate', 'status')
    $commitOptions = @('--date', '--time', '--author', '--add-all', '--push', '--dry-run')
    $configOptions = @('get', 'set', 'init', 'list', 'validate')
    $statusOptions = @('--remote', '--verbose')
    $migrateOptions = @('--from', '--to', '--strategy', '--dry-run')
    
    $tokens = $commandAst.CommandElements
    
    if ($tokens.Count -eq 2) {
        # First argument - main commands
        $commands | Where-Object { $_ -like "$wordToComplete*" }
    } elseif ($tokens.Count -gt 2) {
        # Subsequent arguments based on command
        switch ($tokens[1].Value) {
            'commit' {
                $commitOptions | Where-Object { $_ -like "$wordToComplete*" }
            }
            'config' {
                $configOptions | Where-Object { $_ -like "$wordToComplete*" }
            }
            'status' {
                $statusOptions | Where-Object { $_ -like "$wordToComplete*" }
            }
            'migrate' {
                $migrateOptions | Where-Object { $_ -like "$wordToComplete*" }
            }
        }
    }
}

# Register completion for aliases
Register-ArgumentCompleter -CommandName hc -ScriptBlock {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
    
    $options = @('-Message', '-Date', '-Time')
    $options | Where-Object { $_ -like "$wordToComplete*" }
}

Register-ArgumentCompleter -CommandName hcp -ScriptBlock {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameters)
    
    $options = @('-Message', '-Date', '-Time')
    $options | Where-Object { $_ -like "$wordToComplete*" }
}
'@
    
    $functionsFile = Join-Path $ScriptDir "powershell_functions.ps1"
    Add-Content -Path $functionsFile -Value "`n$completionScript" -Encoding UTF8
    
    Write-ColorOutput "✅ PowerShell completion installed" "Green"
}

function Test-Installation {
    Write-ColorOutput "Verifying installation..." "Blue"
    
    $errors = 0
    
    # Check Histofy CLI
    try {
        $histofyVersion = histofy --version 2>$null
        if ($histofyVersion) {
            Write-ColorOutput "✅ Histofy CLI is accessible: $histofyVersion" "Green"
        } else {
            throw "Histofy CLI not responding"
        }
    } catch {
        Write-ColorOutput "❌ Histofy CLI not found or not working" "Red"
        $errors++
    }
    
    # Check PowerShell functions
    $profilePath = Get-PowerShellProfile
    if ((Test-Path $profilePath) -and ((Get-Content $profilePath -Raw) -match "Histofy v3")) {
        Write-ColorOutput "✅ PowerShell functions installed" "Green"
    } else {
        Write-ColorOutput "❌ PowerShell functions not found" "Red"
        $errors++
    }
    
    # Check function files
    $functionsFile = Join-Path $ScriptDir "powershell_functions.ps1"
    if (Test-Path $functionsFile) {
        Write-ColorOutput "✅ Function files exist" "Green"
    } else {
        Write-ColorOutput "❌ Function files missing" "Red"
        $errors++
    }
    
    Write-Host ""
    
    if ($errors -eq 0) {
        Write-ColorOutput "🎉 Installation verification passed!" "Green"
        return $true
    } else {
        Write-ColorOutput "❌ Installation verification failed ($errors errors)" "Red"
        return $false
    }
}

function Show-Instructions {
    $profilePath = Get-PowerShellProfile
    
    Write-ColorOutput "📋 Post-Installation Instructions:" "Cyan"
    Write-Host ""
    
    Write-ColorOutput "1. Reload your PowerShell profile:" "Yellow"
    Write-ColorOutput "   . `"$profilePath`" (or restart PowerShell)" "Blue"
    Write-Host ""
    
    Write-ColorOutput "2. Initialize Histofy configuration:" "Yellow"
    Write-ColorOutput "   histofy config init" "Blue"
    Write-Host ""
    
    Write-ColorOutput "3. Set your GitHub token (optional but recommended):" "Yellow"
    Write-ColorOutput "   histofy config set github.token YOUR_GITHUB_TOKEN" "Blue"
    Write-Host ""
    
    Write-ColorOutput "4. Set your Git defaults:" "Yellow"
    Write-ColorOutput "   histofy config set git.defaultAuthor `"Your Name`"" "Blue"
    Write-ColorOutput "   histofy config set git.defaultEmail `"your.email@example.com`"" "Blue"
    Write-Host ""
    
    Write-ColorOutput "5. Test the installation:" "Yellow"
    Write-ColorOutput "   histofy status" "Blue"
    Write-ColorOutput "   hhelp (to see quick reference)" "Blue"
    Write-Host ""
    
    Write-ColorOutput "🚀 Available Quick Commands:" "Cyan"
    Write-ColorOutput "   hc    - Quick commit with date" "Purple"
    Write-ColorOutput "   hcp   - Quick commit with push" "Purple"
    Write-ColorOutput "   hs    - Show status" "Purple"
    Write-ColorOutput "   hci   - Interactive commit" "Purple"
    Write-ColorOutput "   hh    - Show help" "Purple"
    Write-ColorOutput "   hhelp - Show quick reference" "Purple"
    Write-Host ""
}

# Main installation function
function Main {
    # Handle command line arguments
    if ($Help) {
        Show-Help
        return
    }
    
    if ($Version) {
        Show-Version
        return
    }
    
    if ($VerifyOnly) {
        Test-Installation
        return
    }
    
    if ($Uninstall) {
        Write-ColorOutput "Uninstall functionality not implemented yet" "Red"
        return
    }
    
    # Show banner
    Write-Host ""
    Write-ColorOutput "╔══════════════════════════════════════════════════════════╗" "Blue"
    Write-ColorOutput "║                 Histofy v3 Installer                    ║" "Blue"
    Write-ColorOutput "║            PowerShell Cross-Platform Setup              ║" "Blue"
    Write-ColorOutput "║                                                          ║" "Blue"
    Write-ColorOutput "║  Supports: Windows PowerShell & PowerShell Core         ║" "Blue"
    Write-ColorOutput "║  Platforms: Windows, Linux, macOS                       ║" "Blue"
    Write-ColorOutput "╚══════════════════════════════════════════════════════════╝" "Blue"
    Write-Host ""
    
    # Check system requirements
    $requirements = Test-Requirements
    if (-not $requirements.Success) {
        Write-ColorOutput "❌ System requirements not met" "Red"
        return
    }
    
    # Install Histofy CLI (unless skipped)
    if (-not $SkipCli) {
        if (-not (Install-HistofyCli $requirements.PackageManager)) {
            Write-ColorOutput "⚠️  CLI installation failed, continuing with PowerShell functions..." "Yellow"
        }
    }
    
    # Install PowerShell functions (unless skipped)
    if (-not $SkipFunctions) {
        Install-PowerShellFunctions
    }
    
    # Setup completion (unless skipped)
    if (-not $SkipCompletion) {
        Install-PowerShellCompletion
    }
    
    # Verify installation
    Write-Host ""
    if (Test-Installation) {
        Write-ColorOutput "🎉 Installation completed successfully!" "Green"
        Write-Host ""
        
        Show-Instructions
        
        Write-ColorOutput "Happy coding with Histofy! 🚀" "Green"
    } else {
        Write-ColorOutput "❌ Installation completed with errors" "Red"
        Write-ColorOutput "Please check the error messages above and try again" "Yellow"
    }
}

# Run installer
Main