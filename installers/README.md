# Histofy v3 Installers

This directory contains platform-specific installers for Histofy v3, providing enhanced Git history management with custom date commits, shell integration, and comprehensive tooling.

## Available Installers

### 🍎 macOS Installer (`macos/install.sh`)
- **Supports**: macOS 10.15 (Catalina) or later
- **Shells**: Bash, Zsh, Fish
- **Features**: Homebrew integration, comprehensive shell functions, auto-completion

### 🐧 Linux Installer (`linux/install.sh`)
- **Supports**: Ubuntu 18.04+, Debian 10+, CentOS 7+, Fedora 30+, Arch Linux
- **Shells**: Bash, Zsh, Fish
- **Features**: Multi-distro package manager support, container detection

### 🪟 Windows Installer (`windows/install.ps1`)
- **Supports**: Windows 10 1809+, Windows Server 2019+
- **Shells**: PowerShell 5.1+
- **Features**: PowerShell profile integration, winget/chocolatey support

## Quick Start

### macOS/Linux
```bash
# Download and run installer
curl -fsSL https://raw.githubusercontent.com/your-repo/histofy-v3/main/installers/macos/install.sh | bash

# Or clone and run locally
git clone https://github.com/your-repo/histofy-v3.git
cd histofy-v3/installers/macos  # or linux
chmod +x install.sh
./install.sh
```

### Windows
```powershell
# Download and run installer
iwr -useb https://raw.githubusercontent.com/your-repo/histofy-v3/main/installers/windows/install.ps1 | iex

# Or clone and run locally
git clone https://github.com/your-repo/histofy-v3.git
cd histofy-v3/installers/windows
.\install.ps1
```

## Installation Options

### Standard Options
- `-h, --help` / `-Help`: Show help message
- `-v, --version` / `-Version`: Show version information
- `-s, --silent` / `-Silent`: Run in silent mode
- `-f, --force` / `-Force`: Force installation despite issues
- `-d, --dev-mode` / `-DevMode`: Install from local development project

### Component Control
- `--skip-cli` / `-SkipCli`: Skip CLI installation
- `--skip-functions` / `-SkipFunctions`: Skip shell functions
- `--skip-completion` / `-SkipCompletion`: Skip auto-completion

### Advanced Options
- `--install-path PATH` / `-InstallPath PATH`: Custom installation path
- `--system-wide` / `-SystemWide`: System-wide installation (requires admin/sudo)
- `--verify-only` / `-VerifyOnly`: Only verify existing installation
- `--uninstall` / `-Uninstall`: Uninstall Histofy

## What Gets Installed

### 1. Histofy CLI
- Global npm package: `histofy-cli@3.0.0`
- Command-line interface with all features
- Available as `histofy` command globally

### 2. Shell Integration
- **macOS/Linux**: Functions added to `.bashrc`, `.zshrc`, or Fish config
- **Windows**: Functions added to PowerShell profile
- Environment variables and aliases
- Enhanced Git integration

### 3. Quick Functions
- `hc` - Quick commit with custom date
- `hcp` - Quick commit with push
- `hs` - Show status
- `hci` - Interactive commit
- `hh` - Quick help
- `ha` - Analysis tools
- `hp` - Performance monitoring
- `hcfg` - Configuration management

### 4. Auto-completion
- **Bash**: Tab completion for commands and options
- **Zsh**: Advanced completion with descriptions
- **Fish**: Rich completions with help text
- **PowerShell**: Basic completion support

## System Requirements

### All Platforms
- **Node.js**: v16.0.0 or later
- **Git**: v2.20.0 or later
- **npm** or **yarn**: Latest version

### Platform-Specific
- **macOS**: macOS 10.15+ (Catalina or later)
- **Linux**: Modern distribution with package manager
- **Windows**: Windows 10 1809+ or Windows Server 2019+

### Shell Requirements
- **Bash**: v4.0+ (macOS/Linux)
- **Zsh**: v5.0+ (macOS/Linux)
- **Fish**: v3.0+ (macOS/Linux)
- **PowerShell**: v5.1+ (Windows)

## Post-Installation

### 1. Reload Shell
```bash
# macOS/Linux
source ~/.bashrc  # or ~/.zshrc
# Windows
. $PROFILE
```

### 2. Initialize Configuration
```bash
histofy config init
```

### 3. Set GitHub Token (Optional)
```bash
histofy config set github.token YOUR_GITHUB_TOKEN
```

### 4. Configure Git Defaults
```bash
histofy config set git.defaultAuthor "Your Name <email@example.com>"
```

### 5. Test Installation
```bash
histofy status
hh  # Quick help
```

## Troubleshooting

### Common Issues

#### Permission Denied
```bash
# macOS/Linux
chmod +x install.sh
sudo ./install.sh  # If system-wide installation needed

# Windows
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Node.js Not Found
```bash
# macOS
brew install node

# Ubuntu/Debian
sudo apt update && sudo apt install nodejs npm

# CentOS/RHEL
sudo yum install nodejs npm

# Windows
winget install OpenJS.NodeJS
# or
choco install nodejs
```

#### Git Not Found
```bash
# macOS
brew install git

# Ubuntu/Debian
sudo apt install git

# CentOS/RHEL
sudo yum install git

# Windows
winget install Git.Git
# or
choco install git
```

### Verification
```bash
# Check installation
histofy --version
histofy config list

# Verify shell integration
hh  # Should show help
hs  # Should show status
```

### Manual Cleanup
If installation fails, you can manually clean up:

```bash
# Remove CLI
npm uninstall -g histofy-cli

# Remove shell integration (edit these files)
# ~/.bashrc, ~/.zshrc, ~/.config/fish/config.fish, or PowerShell $PROFILE

# Remove functions file
rm ~/histofy-functions.sh  # or histofy-functions.ps1
```

## Development

### Local Development Installation
```bash
# Clone repository
git clone https://github.com/your-repo/histofy-v3.git
cd histofy-v3

# Install in development mode
./installers/macos/install.sh --dev-mode    # macOS
./installers/linux/install.sh --dev-mode   # Linux
.\installers\windows\install.ps1 -DevMode  # Windows
```

### Testing Installers
```bash
# Verify installation
./install.sh --verify-only

# Silent installation for CI
./install.sh --silent --force

# Update existing installation
./install.sh --update-only
```

## Support

- **Documentation**: [README.md](../README.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **FAQ**: [FAQ.md](../FAQ.md)
- **Issues**: [GitHub Issues](https://github.com/your-repo/histofy-v3/issues)

## License

MIT License - see [LICENSE](../LICENSE) for details.