# Histofy v3 🚀

**Enhanced Git History Management with Custom Date Commits**

[![npm version](https://badge.fury.io/js/histofy-cli.svg)](https://badge.fury.io/js/histofy-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/ishaq2321/histofy-v3)

Histofy v3 is a powerful, enterprise-grade Git history management tool that allows you to create commits with custom dates, perform bulk operations, and maintain comprehensive audit trails. Perfect for developers, teams, and organizations who need precise control over their Git history.

## ✨ Key Features

- 🕒 **Custom Date Commits** - Create commits with any date and time
- 🔒 **Enterprise Security** - Input validation, encryption, and audit trails
- ⚡ **High Performance** - Optimized for large repositories with streaming operations
- 🌐 **Cross-Platform** - Native support for Windows, macOS, and Linux
- 🔄 **Batch Operations** - Process multiple commits from CSV/JSON files
- 📊 **Repository Analysis** - Comprehensive commit pattern analysis
- 🔌 **RESTful API** - Programmatic access with authentication
- 🪝 **Webhook System** - Event-driven automation
- 📋 **Audit & Compliance** - Complete operation logging and reporting
- 🛠️ **Shell Integration** - Quick functions and auto-completion

## 🚀 Quick Installation

### Option 1: One-Line Installer (Recommended)

**macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/ishaq2321/histofy-v3/main/installers/macos/install.sh | bash
```

**Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/ishaq2321/histofy-v3/main/installers/linux/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/ishaq2321/histofy-v3/main/installers/windows/install.ps1 | iex
```

### Option 2: Manual Installation

**Using npm:**
```bash
npm install -g histofy-cli
```

**Using yarn:**
```bash
yarn global add histofy-cli
```

### Option 3: From Source (GitHub CLI)

```bash
# Clone repository using GitHub CLI
gh repo clone ishaq2321/histofy-v3
cd histofy-v3

# Install dependencies
npm install

# Install globally from source
npm install -g .
```

## 🎯 Quick Start

### 1. Initialize Configuration
```bash
histofy config init
```

### 2. Set Your GitHub Token (Optional)
```bash
histofy config set github.token YOUR_GITHUB_TOKEN
```

### 3. Create Your First Custom Date Commit
```bash
# Basic commit with custom date
histofy commit "Fix critical bug" --date "2023-12-25" --time "14:30"

# Quick commit using shell function
hc "Add new feature" 2023-12-25 14:30
```

### 4. Check Status
```bash
histofy status
# or use the quick function
hs
```

## 📚 Core Commands

### Commit Operations
```bash
# Create commit with custom date
histofy commit "Your message" --date "2023-12-25" --time "14:30"

# Interactive commit with date picker
histofy commit --interactive

# Commit and push
histofy commit "Deploy fix" --date "2023-12-25" --push

# Dry run (preview only)
histofy commit "Test commit" --date "2023-12-25" --dry-run
```

### Batch Operations
```bash
# Process commits from CSV file
histofy batch process --file commits.csv

# Generate commit template
histofy batch template --output template.csv

# Validate batch file
histofy batch validate --file commits.csv
```

### Repository Analysis
```bash
# Comprehensive analysis
histofy analyze --all

# Commit patterns
histofy analyze patterns --since "2023-01-01"

# Author statistics
histofy analyze authors --format json
```

### Configuration Management
```bash
# Initialize configuration
histofy config init

# Set configuration values
histofy config set git.defaultAuthor "Your Name <email@example.com>"
histofy config set github.token "your-token"

# List all configuration
histofy config list

# Validate configuration
histofy config validate
```

## 🛠️ Shell Integration

Histofy v3 includes powerful shell integration with quick functions:

### Quick Functions
- `hc` - Quick commit with date: `hc "Fix bug" 2023-12-25 14:30`
- `hcp` - Quick commit with push: `hcp "Deploy" 2023-12-25`
- `hs` - Show status: `hs --remote`
- `hci` - Interactive commit: `hci`
- `hh` - Quick help: `hh`
- `ha` - Analysis: `ha --patterns`
- `hp` - Performance monitoring: `hp --summary`

### Auto-Completion
Histofy v3 provides intelligent auto-completion for:
- **Bash** - Tab completion for all commands and options
- **Zsh** - Advanced completion with descriptions
- **Fish** - Rich completions with help text
- **PowerShell** - Native PowerShell completion

## 🔌 API & Integration

### RESTful API Server
```bash
# Start API server
histofy server --port 3000

# With custom API key
histofy server --port 3000 --api-key your-secret-key
```

### Webhook Management
```bash
# Register webhook
histofy webhook register my-webhook --url https://api.example.com/webhook --events commit.created,migration.completed

# Test webhook
histofy webhook test my-webhook

# List webhooks
histofy webhook list
```

### Workflow Automation
```bash
# Define workflow from file
histofy workflow define my-workflow --file workflow.json

# Execute workflow
histofy workflow execute my-workflow --context '{"branch":"main"}'
```

## 📊 Advanced Features

### Performance Monitoring
```bash
# Enable performance monitoring
histofy performance --enable

# Show performance summary
histofy performance --summary

# Generate performance report
histofy performance --report --output perf-report.json
```

### Audit & Compliance
```bash
# View audit logs
histofy audit logs --since "2023-01-01"

# Generate compliance report
histofy audit report --format pdf --output compliance-report.pdf

# Verify repository integrity
histofy audit verify --deep
```

### Data Export/Import
```bash
# Export commit history
histofy export commits --format json --output commits.json

# Export configuration
histofy export config --output config-backup.yml

# Import commits from file
histofy import commits --file commits.json --validate
```

### Operation History & Undo
```bash
# View operation history
histofy undo list

# Undo last operation
histofy undo last

# Undo specific operation
histofy undo operation abc123
```

## 🔧 Configuration

### Essential Settings
```bash
# Git defaults
histofy config set git.defaultAuthor "Your Name <email@example.com>"
histofy config set git.defaultTime "12:00"

# GitHub integration
histofy config set github.token "your-github-token"
histofy config set github.username "your-username"

# Performance settings
histofy config set performance.enabled true
histofy config set performance.memoryLimit "512MB"

# Security settings
histofy config set security.encryptConfig true
histofy config set audit.enabled true
```

### Configuration File Location
- **Windows:** `%APPDATA%\\histofy\\config.yml`
- **macOS:** `~/.histofy/config.yml`
- **Linux:** `~/.histofy/config.yml`

## 🌐 Cross-Platform Support

### System Requirements
- **Node.js:** v16.0.0 or later
- **Git:** v2.20.0 or later
- **Operating System:**
  - Windows 10 1809+ or Windows Server 2019+
  - macOS 10.15 (Catalina) or later
  - Linux (Ubuntu 18.04+, Debian 10+, CentOS 7+, Fedora 30+, Arch)

### Shell Support
- **Windows:** PowerShell 5.1+, PowerShell 7+
- **macOS/Linux:** Bash 4.0+, Zsh 5.0+, Fish 3.0+

## 🔒 Security Features

- **Input Validation** - All user inputs are sanitized and validated
- **Command Injection Prevention** - Secure command execution throughout
- **Configuration Encryption** - Sensitive data encrypted at rest
- **Audit Logging** - Complete operation tracking with integrity verification
- **Access Control** - Secure configuration and operation access

## 📈 Performance Features

- **Streaming Operations** - Memory-efficient processing for large repositories
- **Git Operation Optimization** - Batched operations with connection reuse
- **Memory Management** - Automatic garbage collection and usage monitoring
- **Parallel Processing** - Safe concurrent operations where applicable
- **Intelligent Caching** - Smart caching for frequently accessed Git data

## 🧪 Development Setup

### From Source
```bash
# Clone repository
gh repo clone ishaq2321/histofy-v3
cd histofy-v3

# Install dependencies
npm install

# Run tests
npm test

# Install globally from source
npm install -g .
```

### Development Commands
```bash
# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Run security tests
npm run test:security

# Run performance tests
npm run test:performance
```

## 📖 Documentation

- **[📚 Complete Documentation](../../tree/docs)** - Comprehensive guides with live examples
- **[🚀 Quick Start Guide](../../tree/docs/docs/QUICK_START.md)** - Get started in 5 minutes
- **[📋 Command Reference](../../tree/docs/docs/COMMANDS.md)** - All commands with real outputs
- **[🎯 Real-World Examples](../../tree/docs/docs/EXAMPLES.md)** - Practical usage scenarios
- **[Installation Guide](installers/README.md)** - Detailed installation instructions
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[FAQ](FAQ.md)** - Frequently asked questions
- **[Contributing](CONTRIBUTING.md)** - Development guidelines
- **[Changelog](CHANGELOG.md)** - Version history and changes

> **🎭 Special**: Our [documentation branch](../../tree/docs) was created using Histofy v3 itself, demonstrating real custom date commits with realistic development patterns!

## 🆘 Support & Community

- **📧 Email:** [ishaq2321@proton.me](mailto:ishaq2321@proton.me)
- **🐛 Issues:** [GitHub Issues](https://github.com/ishaq2321/histofy-v3/issues)
- **💬 Discussions:** [GitHub Discussions](https://github.com/ishaq2321/histofy-v3/discussions)
- **📚 Documentation:** [GitHub Wiki](https://github.com/ishaq2321/histofy-v3/wiki)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code of Conduct
- Development setup
- Pull request process
- Coding standards
- Testing requirements

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- Built with modern Node.js and enterprise-grade security
- Inspired by the need for precise Git history management
- Community-driven development and feedback

---

**Built with 💚 in solidarity with Palestine 🇵🇸**

*"In the face of injustice, silence is complicity. We stand with the Palestinian people in their struggle for freedom, dignity, and human rights."*

🟢⚪🔴 #FreePalestine 🔴⚪🟢