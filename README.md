# Histofy v3 🚀

> Advanced terminal-based Git history manipulation tool with comprehensive features

Histofy v3 is a powerful CLI tool for Git history manipulation, offering custom commit dates, batch operations, performance monitoring, and comprehensive analysis tools. Perfect for developers who need precise control over their Git history.

> **Note**: For pattern-based contribution management, check out [Histofy v2](https://github.com/ishaq2321/histofy-v2.git) which includes pattern creation, templates, and deployment features.

## ✨ Features

### Core Features
- **🎯 Custom Date Commits**: Create commits with any date and time
- **🔄 Commit Migration**: Safely migrate existing commits to new dates with automatic backups
- **📦 Batch Operations**: Process multiple commits from CSV/JSON data with templates
- **🔧 Configuration Management**: Encrypted configuration with validation and recovery
- **📊 Repository Analysis**: Comprehensive commit pattern and author contribution analysis

### Advanced Features
- **⚡ Performance Monitoring**: Real-time performance profiling and optimization alerts
- **🔍 Interactive Help System**: Contextual help, tutorials, and troubleshooting guides
- **📈 Streaming Operations**: Memory-efficient processing for large repositories
- **🛡️ Security & Validation**: Input sanitization and comprehensive security measures
- **📋 Operation History**: Full undo capabilities with operation tracking
- **🌐 GitHub Integration**: Rate-limited API calls with comprehensive error handling

### Developer Experience
- **🎓 Interactive Tutorials**: Step-by-step guides for all features
- **🔧 Dry-Run Mode**: Preview all operations before execution
- **📊 Progress Tracking**: Real-time progress with ETA calculations
- **🚨 Smart Error Handling**: Contextual help and recovery suggestions
- **⚡ Shell Integration**: Quick functions and auto-completion support

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/histofy/histofy-v3.git
cd histofy-v3

# Install dependencies
npm install

# Install globally
npm install -g .

# Setup shell integration
npm run setup-shell
```

### Quick Start

```bash
# Initialize configuration
histofy config init

# Get interactive help
histofy help tutorial getting-started

# Create a commit with custom date
histofy commit "My commit" --date 2023-06-15 --time 14:30

# Preview before executing
histofy commit "Test commit" --dry-run

# Check repository status
histofy status --remote

# Enable performance monitoring
histofy --profile commit "Monitored commit"
```

## 📖 Commands

### Core Commands

#### `histofy commit` - Custom Date Commits
Create commits with precise date and time control.

```bash
# Interactive commit with prompts
histofy commit

# Direct commit with custom date
histofy commit "Fix authentication bug" --date 2023-06-15 --time 14:30

# Add all changes and commit
histofy commit "Major refactoring" --add-all --date 2023-06-10

# Commit with custom author
histofy commit "Update docs" --author "John Doe <john@example.com>"

# Commit and push immediately
histofy commit "Hotfix" --push --date 2023-06-15

# Preview commit without executing
histofy commit "Test commit" --dry-run
```

#### `histofy migrate` - Commit Date Migration
Safely migrate existing commits to new dates with automatic backups.

```bash
# Migrate single commit
histofy migrate abc123 --to-date 2023-06-15

# Migrate commit range
histofy migrate HEAD~5..HEAD --to-date 2023-06-15

# Preview migration without executing
histofy migrate HEAD~5..HEAD --to-date 2023-06-15 --dry-run

# Force migration with conflicts
histofy migrate HEAD~10..HEAD --to-date 2023-06-15 --force
```

#### `histofy batch` - Bulk Operations
Process multiple commits efficiently from data files.

```bash
# Batch commit from CSV
histofy batch commit --input commits.csv

# Create commit template
histofy batch template --create --output template.json

# Import commits with template
histofy batch import --input data.json --template template.json

# Export commit history
histofy batch export --output history.csv --format csv

# Validate data without processing
histofy batch validate --input commits.csv --validate-only
```

#### `histofy analyze` - Repository Analysis
Comprehensive analysis of commit patterns and repository health.

```bash
# Basic repository analysis
histofy analyze

# Author contribution analysis
histofy analyze --authors

# Temporal analysis with charts
histofy analyze --temporal --charts

# Export analysis report
histofy analyze --export report.json --format json
```

#### `histofy performance` - Performance Monitoring
Monitor and optimize operation performance.

```bash
# Enable performance monitoring
histofy performance --enable

# Show performance summary
histofy performance --summary

# Generate detailed report
histofy performance --report --output perf-report.json

# Export performance data
histofy performance --export json --output perf-data.json
```

#### `histofy help` - Enhanced Help System
Interactive help with examples and tutorials.

```bash
# Show main help
histofy help

# Show command examples
histofy help examples commit

# Run interactive tutorial
histofy help tutorial getting-started

# List all tutorials
histofy help tutorials

# Show troubleshooting guide
histofy help troubleshooting

# Show FAQ
histofy help faq
```

#### `histofy config` - Configuration Management
Secure configuration with encryption and validation.

```bash
# Initialize configuration
histofy config init

# Set GitHub token (encrypted)
histofy config set github.token ghp_your_token_here

# Set default author
histofy config set git.defaultAuthor "Jane Smith <jane@example.com>"

# Preview configuration changes
histofy config set git.defaultBranch main --dry-run

# List all configuration
histofy config list
```

#### `histofy status` - Repository Status
Enhanced status with health checks and remote information.

```bash
# Basic repository status
histofy status

# Include GitHub remote information
histofy status --remote
```

### Utility Commands

#### `histofy undo` - Operation History
Undo recent Histofy operations with full rollback.

```bash
# Show operation history
histofy undo list

# Undo last operation
histofy undo

# Undo specific operation
histofy undo abc123

# Clear operation history
histofy undo clear
```

#### `histofy export/import` - Data Management
Export and import commit data in various formats.

```bash
# Export commit history
histofy export --format csv --output commits.csv

# Import commit data
histofy import --input commits.json --format json
```

## 🔧 Shell Functions

Histofy v3 includes convenient shell functions for quick operations:

### Quick Functions

```bash
# Quick commit with date
hc "commit message" "2023-06-15" "14:30"

# Quick commit with push
hcp "commit message" "2023-06-15" "14:30"

# Show status
hs

# Interactive commit
hci

# Show help
hh
```

### Batch Functions

```bash
# Batch commits for today
hcb "base message" "2023-06-15" 5

# Commit for yesterday
hcy "yesterday's work" "15:30"

# Commit for a week ago
hcw "last week's work" 7 "10:00"
```

### Setup Shell Integration

```bash
# Run the installer
npm run setup-shell

# Or manually source functions
source ./shell/bash_functions.sh

# Reload your shell
source ~/.bashrc
```

## ⚙️ Configuration

Configuration is stored in `~/.histofy/config.yaml`:

```yaml
github:
  token: "ghp_your_token_here"
  username: "your-username"
  defaultRepo: "username/default-repo"

git:
  defaultAuthor: "Your Name"
  defaultEmail: "your.email@example.com"
  defaultTime: "12:00"

ui:
  showBanner: true
  colorOutput: true
  verboseOutput: false
```

### Required Configuration

1. **GitHub Token**: Personal Access Token with repo permissions
   ```bash
   histofy config set github.token ghp_your_token_here
   ```

2. **GitHub Username**: Your GitHub username
   ```bash
   histofy config set github.username your-username
   ```

## 🔒 Security

- GitHub tokens are stored locally in `~/.histofy/config.yaml`
- Tokens are masked in status output
- No data is sent to external services except GitHub API
- Local git operations only

## 🛠️ Development

### Setup Development Environment

```bash
# Clone and install
git clone https://github.com/histofy/histofy-v3.git
cd histofy-v3
npm install

# Link for global testing
npm link

# Run in development mode
npm run dev
```

### Project Structure

```
histofy-v3/
├── src/
│   ├── cli/           # CLI command handlers
│   ├── core/          # Core business logic
│   ├── config/        # Configuration management
│   └── index.js       # Main entry point
├── bin/histofy        # Executable script
├── shell/             # Shell integration
├── tests/            # Test files
└── docs/             # Documentation
```

### Adding New Commands

1. Create handler in `src/cli/`
2. Register in `src/index.js`
3. Add to shell functions if needed
4. Update documentation

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- 📧 Email: ishaq2321@proton.me
- 🐛 Issues: [GitHub Issues](https://github.com/histofy/histofy-v3/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/histofy/histofy-v3/discussions)

---

<div align="center">

**Built with 💚 in solidarity with Palestine 🇵🇸**

*"In the face of injustice, silence is complicity. We stand with the Palestinian people in their struggle for freedom, dignity, and human rights."*

🟢⚪🔴 **#FreePalestine** 🔴⚪🟢

</div>

## 🚀 Advanced Usage

### Global Options
All commands support these global options:

```bash
# Enable performance profiling
histofy --profile commit "Profiled commit"

# Show performance summary after operation
histofy --perf-summary status

# Enable verbose output for debugging
histofy --verbose migrate HEAD~3..HEAD --to-date 2023-06-15

# Disable ASCII banner (useful for scripts)
histofy --no-banner status
```

### Batch Operations with Templates

Create a CSV file for batch commits:
```csv
message,date,author
Fix authentication bug,2023-06-15,John Doe <john@example.com>
Add new feature,2023-06-16,Jane Smith <jane@example.com>
Update documentation,2023-06-17,Bob Wilson <bob@example.com>
```

Process the batch:
```bash
# Validate data first
histofy batch validate --input commits.csv

# Preview operations
histofy batch commit --input commits.csv --dry-run

# Execute batch commits
histofy batch commit --input commits.csv
```

### Performance Monitoring

Enable comprehensive performance monitoring:
```bash
# Enable monitoring
histofy performance --enable

# Run operations (they'll be automatically profiled)
histofy commit "Test commit"
histofy migrate HEAD~5..HEAD --to-date 2023-06-15

# View performance summary
histofy performance --summary

# Generate detailed report
histofy performance --report --output performance-report.json
```

### Repository Analysis

Get comprehensive insights into your repository:
```bash
# Full analysis with all metrics
histofy analyze --authors --temporal --charts

# Export analysis for external tools
histofy analyze --export analysis.json --format json

# Focus on specific aspects
histofy analyze --authors  # Author contributions only
histofy analyze --temporal # Time-based patterns only
```

## 🔧 Shell Integration

Histofy provides powerful shell functions for quick operations:

### Installation
```bash
# Automatic setup
npm run setup-shell

# Manual setup (add to ~/.bashrc or ~/.zshrc)
source /path/to/histofy-v3/shell/bash_functions.sh
```

### Quick Functions
```bash
# Quick commit with date
hc "commit message" "2023-06-15" "14:30"

# Quick commit with push
hcp "commit message" "2023-06-15" "14:30"

# Interactive commit
hci

# Show status
hs

# Show help
hh

# Batch commits for today
hcb "base message" "2023-06-15" 5

# Commit for yesterday
hcy "yesterday's work" "15:30"

# Commit for a week ago
hcw "last week's work" 7 "10:00"
```

## ⚙️ Configuration

### Configuration File
Histofy uses `~/.histofy.yml` for configuration:

```yaml
github:
  token: "encrypted_token_here"
  username: "your-username"
  apiUrl: "https://api.github.com"

git:
  defaultAuthor: "Your Name <your.email@example.com>"
  defaultTime: "12:00"
  defaultBranch: "main"

performance:
  enableProfiling: false
  alertThresholds:
    operationTime: 10000  # 10 seconds
    memoryUsage: 80       # 80%

security:
  encryptSensitiveData: true
  validateInputs: true
```

### Environment Variables
```bash
export HISTOFY_CONFIG_PATH="/custom/path/.histofy.yml"
export HISTOFY_GITHUB_TOKEN="your_token_here"
export HISTOFY_DEBUG="true"
```

## 🛡️ Security

Histofy implements comprehensive security measures:

- **Input Validation**: All user inputs are sanitized and validated
- **Configuration Encryption**: Sensitive data is encrypted at rest
- **Command Injection Prevention**: Safe command execution with parameter validation
- **Path Traversal Protection**: File operations are restricted to safe directories
- **GitHub Token Security**: Tokens are encrypted and never logged

## 🔍 Troubleshooting

### Common Issues

#### "Not a git repository" Error
```bash
# Solution: Initialize Git repository
git init
git remote add origin <repository-url>
```

#### "Configuration file not found" Error
```bash
# Solution: Initialize Histofy configuration
histofy config init
```

#### "Invalid GitHub token" Error
```bash
# Solution: Update your GitHub token
# 1. Generate new token: GitHub Settings > Developer settings > Personal access tokens
# 2. Update configuration:
histofy config set github.token YOUR_NEW_TOKEN
```

#### "Permission denied" Errors
```bash
# Check file permissions
ls -la
chmod 644 filename

# Check directory permissions
chmod 755 dirname
```

#### "Invalid date format" Errors
```bash
# Use YYYY-MM-DD format for dates
histofy commit "message" --date 2023-06-15

# Use HH:MM format for times
histofy commit "message" --date 2023-06-15 --time 14:30
```

### Getting Help

```bash
# Interactive help system
histofy help

# Command-specific help
histofy help commit

# Show examples
histofy help examples commit

# Run tutorial
histofy help tutorial getting-started

# Troubleshooting guide
histofy help troubleshooting

# FAQ
histofy help faq
```

### Debug Mode
```bash
# Enable verbose output
histofy --verbose <command>

# Enable debug logging
export HISTOFY_DEBUG=true
histofy <command>

# Check repository health
histofy status
```

## ❓ FAQ

### General Questions

**Q: What is Histofy and what does it do?**
A: Histofy is a tool for manipulating Git commit history. It allows you to create commits with custom dates, migrate existing commits to new dates, and perform bulk operations on commit history.

**Q: Is it safe to use Histofy on my repository?**
A: Yes, Histofy creates automatic backups before any destructive operations. You can always restore your repository to its previous state. However, be cautious when working with shared repositories.

**Q: Can I use Histofy with GitHub/remote repositories?**
A: Yes, but be careful with shared repositories. Changing commit history affects other collaborators. Use force-push carefully and coordinate with your team.

### Technical Questions

**Q: What file formats does Histofy support for batch operations?**
A: Histofy supports CSV and JSON formats for batch operations. CSV files should have headers like "message,date,author". JSON files should contain arrays of commit objects.

**Q: How do I undo a Histofy operation?**
A: Use the `histofy undo` command to reverse recent operations. Histofy maintains an operation history and can restore previous states automatically.

**Q: Can I customize commit templates?**
A: Yes, use `histofy batch template --create` to create custom templates. Templates support variable substitution and can be reused for consistent commit formatting.

**Q: How do I monitor performance of large operations?**
A: Enable performance monitoring with `histofy performance --enable` or use the `--profile` flag with any command. This provides detailed metrics and optimization suggestions.

### Workflow Questions

**Q: What should I do if a migration fails?**
A: Histofy automatically restores your repository from backup if a migration fails. Check the error message, resolve any issues, and try again. Use `--dry-run` to preview first.

**Q: How do I configure Histofy for my team?**
A: Create a shared configuration template with `histofy config init`, then distribute it to team members. Set common defaults like author information and GitHub tokens.

**Q: Can I use Histofy in CI/CD pipelines?**
A: Yes, Histofy supports machine-readable output and non-interactive modes. Use `--no-banner` for scripts and `--dry-run` for validation steps.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
# Clone repository
git clone https://github.com/ishaq2321/histofy-v3.git
cd histofy-v3

# Install dependencies
npm install

# Run tests
npm test

# Run with development mode
npm run dev
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/cli/commit.test.js

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm run test:performance
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI framework
- Uses [simple-git](https://github.com/steveukx/git-js) for Git operations
- Styled with [chalk](https://github.com/chalk/chalk) for terminal colors
- Progress tracking with [ora](https://github.com/sindresorhus/ora)

## 📞 Support

- 📧 Email: ishaq2321@proton.me
- 🐛 Issues: [GitHub Issues](https://github.com/ishaq2321/histofy-v3/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/ishaq2321/histofy-v3/discussions)

---

**Made with ❤️ by [Ishaq](https://github.com/ishaq2321)**