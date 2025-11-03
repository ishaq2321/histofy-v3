# Histofy v3 - Frequently Asked Questions

## 🤔 General Questions

### What is Histofy?
Histofy is a powerful command-line tool for Git history manipulation. It allows you to create commits with custom dates, migrate existing commits to new dates, perform bulk operations, and analyze repository patterns. It's designed for developers who need precise control over their Git history.

### How is Histofy v3 different from v2?
Histofy v3 is a complete rewrite focused on:
- **Pure CLI experience** (no web interface)
- **Advanced batch operations** with CSV/JSON support
- **Performance monitoring** and optimization
- **Comprehensive security** measures
- **Interactive help system** with tutorials
- **Operation history** with undo capabilities
- **Repository analysis** tools

### Is Histofy safe to use?
Yes! Histofy implements multiple safety measures:
- **Automatic backups** before any destructive operations
- **Dry-run mode** to preview changes before execution
- **Input validation** and sanitization
- **Operation history** with undo capabilities
- **Comprehensive error handling** with recovery options

### Can I use Histofy with shared repositories?
Yes, but with caution. Changing commit history affects all collaborators. Best practices:
- **Coordinate with your team** before making changes
- **Use on feature branches** rather than main branches
- **Force-push carefully** and communicate changes
- **Consider using on personal repositories** or forks first

## 🛠️ Installation & Setup

### How do I install Histofy?
```bash
# Clone the repository
git clone https://github.com/ishaq2321/histofy-v3.git
cd histofy-v3

# Install dependencies
npm install

# Install globally
npm install -g .

# Initialize configuration
histofy config init
```

### How do I set up shell integration?
```bash
# Automatic setup
npm run setup-shell

# Manual setup - add to ~/.bashrc or ~/.zshrc
source /path/to/histofy-v3/shell/bash_functions.sh

# Reload shell
source ~/.bashrc
```

### Do I need a GitHub token?
A GitHub token is optional but recommended for:
- **Remote status checks** (`histofy status --remote`)
- **Higher API rate limits**
- **Access to private repositories**

Generate a token at: GitHub Settings > Developer settings > Personal access tokens

### What permissions does the GitHub token need?
For public repositories: `public_repo`
For private repositories: `repo`
For user information: `user:email`

## 💻 Usage Questions

### How do I create a commit with a custom date?
```bash
# Basic custom date commit
histofy commit "My commit message" --date 2023-06-15

# With custom time
histofy commit "My commit message" --date 2023-06-15 --time 14:30

# With custom author
histofy commit "My commit message" --date 2023-06-15 --author "John Doe <john@example.com>"

# Add all files and commit
histofy commit "My commit message" --date 2023-06-15 --add-all
```

### How do I migrate existing commits?
```bash
# Migrate single commit
histofy migrate abc123 --to-date 2023-06-15

# Migrate range of commits
histofy migrate HEAD~5..HEAD --to-date 2023-06-15

# Preview migration first (recommended)
histofy migrate HEAD~5..HEAD --to-date 2023-06-15 --dry-run
```

### How do I perform batch operations?
Create a CSV file with commit data:
```csv
message,date,author
Fix authentication bug,2023-06-15,John Doe <john@example.com>
Add new feature,2023-06-16,Jane Smith <jane@example.com>
Update documentation,2023-06-17,Bob Wilson <bob@example.com>
```

Then process it:
```bash
# Validate data first
histofy batch validate --input commits.csv

# Preview operations
histofy batch commit --input commits.csv --dry-run

# Execute batch commits
histofy batch commit --input commits.csv
```

### How do I undo a Histofy operation?
```bash
# Show operation history
histofy undo list

# Undo last operation
histofy undo

# Undo specific operation
histofy undo abc123
```

### How do I analyze my repository?
```bash
# Basic analysis
histofy analyze

# Author contribution analysis
histofy analyze --authors

# Temporal patterns with charts
histofy analyze --temporal --charts

# Export analysis report
histofy analyze --export report.json
```

## 🔧 Configuration Questions

### Where is the configuration file stored?
The configuration file is stored at `~/.histofy.yml` by default. You can customize the location with:
```bash
export HISTOFY_CONFIG_PATH="/custom/path/.histofy.yml"
```

### What configuration options are available?
```yaml
github:
  token: "your_encrypted_token"
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

### How do I update configuration settings?
```bash
# Set individual values
histofy config set github.token YOUR_TOKEN
histofy config set git.defaultAuthor "Your Name <email@example.com>"

# Preview changes before applying
histofy config set git.defaultTime "10:00" --dry-run

# View current configuration
histofy config list
```

### Is my GitHub token secure?
Yes! Histofy encrypts sensitive configuration data including GitHub tokens. The token is:
- **Encrypted at rest** in the configuration file
- **Never logged** or displayed in plain text
- **Validated** before use
- **Automatically refreshed** if expired

## 📊 Performance Questions

### How do I monitor performance?
```bash
# Enable performance monitoring
histofy performance --enable

# Run operations (automatically profiled)
histofy commit "Test commit"

# View performance summary
histofy performance --summary

# Generate detailed report
histofy performance --report --output report.json
```

### How do I optimize performance for large repositories?
Histofy automatically optimizes for large repositories by:
- **Streaming operations** for memory efficiency
- **Batch processing** to reduce overhead
- **Progress tracking** with ETA calculations
- **Memory monitoring** with garbage collection

You can also:
```bash
# Use performance profiling to identify bottlenecks
histofy --profile migrate HEAD~100..HEAD --to-date 2023-06-15

# Process in smaller batches
histofy batch commit --input large-file.csv --concurrent 2

# Enable verbose output for debugging
histofy --verbose command
```

### What should I do if operations are slow?
1. **Enable performance monitoring**: `histofy performance --enable`
2. **Profile the operation**: `histofy --profile <command>`
3. **Check the performance report**: `histofy performance --report`
4. **Reduce batch sizes** if processing large datasets
5. **Close other applications** to free system resources
6. **Check disk space** and available memory

## 🔒 Security Questions

### How does Histofy handle security?
Histofy implements comprehensive security measures:
- **Input validation** and sanitization for all user inputs
- **Command injection prevention** with safe parameter handling
- **Path traversal protection** for file operations
- **Configuration encryption** for sensitive data
- **GitHub token security** with encryption and validation

### Can I use Histofy in production environments?
Yes! Histofy is designed for production use with:
- **Comprehensive error handling** and recovery
- **Automatic backups** before destructive operations
- **Audit logging** for compliance requirements
- **Security validation** for all operations
- **Performance monitoring** for optimization

### How do I report security issues?
Please report security issues privately to: ishaq2321@proton.me

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## 🚨 Troubleshooting Questions

### What should I do if a command fails?
1. **Check the error message** for specific guidance
2. **Use the help system**: `histofy help troubleshooting`
3. **Enable verbose output**: `histofy --verbose <command>`
4. **Check repository status**: `histofy status`
5. **Try dry-run mode**: `histofy <command> --dry-run`

### How do I recover from a failed migration?
Histofy automatically creates backups and provides recovery options:
```bash
# Check operation history
histofy undo list

# Undo the failed operation
histofy undo

# Or manually restore from backup
ls -la .git/histofy-backups/
git reset --hard BACKUP_COMMIT_HASH
```

### Why am I getting "permission denied" errors?
Common causes and solutions:
```bash
# Check file permissions
ls -la

# Fix file permissions
chmod 644 filename

# Fix directory permissions
chmod 755 dirname

# Check if running in correct directory
pwd
```

### How do I fix configuration issues?
```bash
# Reinitialize configuration
histofy config init

# Validate current configuration
histofy config list

# Check configuration file permissions
ls -la ~/.histofy.yml
chmod 644 ~/.histofy.yml
```

## 🔄 Workflow Questions

### Can I use Histofy in CI/CD pipelines?
Yes! Histofy supports automation with:
- **Non-interactive mode** for scripts
- **Machine-readable output** formats
- **Exit codes** for success/failure detection
- **Dry-run mode** for validation steps

Example CI usage:
```bash
# Disable banner for scripts
histofy --no-banner status

# Validate batch data in CI
histofy batch validate --input commits.csv

# Use dry-run for validation
histofy migrate HEAD~5..HEAD --to-date 2023-06-15 --dry-run
```

### How do I integrate Histofy with my team workflow?
1. **Create shared configuration** templates
2. **Use batch operations** for consistent commits
3. **Implement code reviews** for history changes
4. **Document procedures** for team members
5. **Use feature branches** for experimental changes

### Can I automate Histofy operations?
Yes! Use shell scripts or automation tools:
```bash
#!/bin/bash
# Automated batch commit script

# Validate data
if histofy batch validate --input daily-commits.csv; then
    # Preview operations
    histofy batch commit --input daily-commits.csv --dry-run
    
    # Execute if validation passes
    histofy batch commit --input daily-commits.csv
else
    echo "Validation failed - check your data"
    exit 1
fi
```

## 📈 Advanced Questions

### How do I create custom commit templates?
```bash
# Create a new template
histofy batch template --create --output my-template.json

# Edit the template file
nano my-template.json

# Use template for imports
histofy batch import --input data.json --template my-template.json
```

### How do I export repository data?
```bash
# Export commit history to CSV
histofy export --format csv --output commits.csv

# Export analysis data
histofy analyze --export analysis.json --format json

# Export performance data
histofy performance --export json --output perf-data.json
```

### How do I extend Histofy functionality?
Histofy is designed to be extensible:
- **Shell functions** for custom workflows
- **Configuration templates** for team standards
- **Batch templates** for consistent operations
- **API integration** for external tools

### Can I contribute to Histofy development?
Absolutely! We welcome contributions:
1. **Fork the repository** on GitHub
2. **Create a feature branch** for your changes
3. **Write tests** for new functionality
4. **Submit a pull request** with description
5. **Follow coding standards** and guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 🆘 Support Questions

### How do I get help?
Multiple support channels are available:

**Built-in Help**:
```bash
histofy help                    # Main help
histofy help <command>          # Command help
histofy help examples <command> # Examples
histofy help tutorial <name>    # Tutorials
histofy help troubleshooting    # Troubleshooting
histofy help faq               # This FAQ
```

**Community Support**:
- 📧 Email: ishaq2321@proton.me
- 🐛 Issues: [GitHub Issues](https://github.com/ishaq2321/histofy-v3/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/ishaq2321/histofy-v3/discussions)

### What information should I include when reporting issues?
Please include:
1. **Histofy version**: `histofy --version`
2. **System information**: `node --version`, `git --version`, `uname -a`
3. **Full error message** and stack trace
4. **Steps to reproduce** the issue
5. **Expected vs actual behavior**
6. **Configuration**: `histofy config list`
7. **Debug output**: `histofy --verbose <command>`

### How often is Histofy updated?
Histofy follows semantic versioning:
- **Patch releases** (bug fixes): As needed
- **Minor releases** (new features): Monthly
- **Major releases** (breaking changes): Quarterly

Check for updates:
```bash
npm outdated -g histofy-v3
npm update -g histofy-v3
```

### Is there a roadmap for future features?
Yes! Planned features include:
- **Web dashboard** for repository insights
- **Team collaboration** features
- **Advanced analytics** and reporting
- **Plugin system** for extensibility
- **Cloud synchronization** for configurations

Track progress on [GitHub Projects](https://github.com/ishaq2321/histofy-v3/projects).

---

**Have a question not covered here?** Feel free to ask in [GitHub Discussions](https://github.com/ishaq2321/histofy-v3/discussions)! 🤝