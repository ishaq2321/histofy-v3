# Histofy v3 Troubleshooting Guide

This guide helps you resolve common issues when using Histofy v3.

## 🚨 Common Issues

### Git Repository Issues

#### "Not a git repository" Error
**Problem**: Histofy can't find a Git repository in the current directory.

**Solutions**:
```bash
# Check if you're in the right directory
pwd
ls -la

# Initialize a new Git repository
git init

# Clone an existing repository
git clone <repository-url>
cd <repository-name>

# Check Git status
git status
```

#### "No commits found" Error
**Problem**: The repository has no commits yet.

**Solutions**:
```bash
# Create your first commit
git add .
git commit -m "Initial commit"

# Or use Histofy to create the first commit
histofy commit "Initial commit" --date 2023-06-15
```

#### "Working directory not clean" Error
**Problem**: There are uncommitted changes in the repository.

**Solutions**:
```bash
# Check what files have changes
git status

# Stage and commit changes
git add .
git commit -m "Save current work"

# Or use Histofy with --add-all
histofy commit "Save current work" --add-all --date 2023-06-15

# Alternatively, stash changes temporarily
git stash
# ... run Histofy commands ...
git stash pop
```

### Configuration Issues

#### "Configuration file not found" Error
**Problem**: Histofy configuration hasn't been initialized.

**Solutions**:
```bash
# Initialize configuration with defaults
histofy config init

# Verify configuration was created
ls -la ~/.histofy.yml

# Check configuration contents
histofy config list
```

#### "Invalid configuration" Error
**Problem**: Configuration file is corrupted or has invalid values.

**Solutions**:
```bash
# Backup current config
cp ~/.histofy.yml ~/.histofy.yml.backup

# Reinitialize configuration
histofy config init

# Or manually edit the configuration
nano ~/.histofy.yml

# Validate configuration
histofy config list
```

#### "Permission denied accessing config" Error
**Problem**: Insufficient permissions to read/write configuration file.

**Solutions**:
```bash
# Check file permissions
ls -la ~/.histofy.yml

# Fix permissions
chmod 644 ~/.histofy.yml

# Check directory permissions
ls -la ~/
chmod 755 ~/
```

### GitHub Integration Issues

#### "Invalid GitHub token" Error
**Problem**: GitHub token is expired, invalid, or has insufficient permissions.

**Solutions**:
```bash
# Generate a new token:
# 1. Go to GitHub Settings > Developer settings > Personal access tokens
# 2. Click "Generate new token"
# 3. Select required scopes (repo, user)
# 4. Copy the token

# Update Histofy configuration
histofy config set github.token YOUR_NEW_TOKEN

# Test the connection
histofy status --remote
```

#### "GitHub API rate limit exceeded" Error
**Problem**: Too many API requests in a short time.

**Solutions**:
```bash
# Wait for rate limit to reset (usually 1 hour)
# Check rate limit status
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit

# Use authenticated requests (higher rate limit)
histofy config set github.token YOUR_TOKEN

# Reduce API calls by avoiding --remote flag frequently
histofy status  # Instead of: histofy status --remote
```

#### "Repository not found on GitHub" Error
**Problem**: Repository doesn't exist on GitHub or token lacks access.

**Solutions**:
```bash
# Check remote URL
git remote -v

# Verify repository exists on GitHub
# Visit: https://github.com/username/repository-name

# Check token permissions
# Ensure token has 'repo' scope for private repos

# Update remote URL if needed
git remote set-url origin https://github.com/username/repository-name.git
```

### Date and Time Issues

#### "Invalid date format" Error
**Problem**: Date is not in the expected YYYY-MM-DD format.

**Solutions**:
```bash
# Correct date format
histofy commit "message" --date 2023-06-15

# Correct date and time format
histofy commit "message" --date 2023-06-15 --time 14:30

# Invalid formats to avoid:
# histofy commit "message" --date 06/15/2023  # Wrong
# histofy commit "message" --date 15-06-2023  # Wrong
# histofy commit "message" --time 2:30 PM     # Wrong
```

#### "Date is in the future" Warning
**Problem**: Specified date is in the future.

**Solutions**:
```bash
# Use a past or current date
histofy commit "message" --date 2023-06-15

# If you really need a future date, it will work but may cause issues
# with some Git tools and GitHub
```

### Migration Issues

#### "Migration conflicts detected" Error
**Problem**: Commit migration would cause conflicts or issues.

**Solutions**:
```bash
# Preview the migration first
histofy migrate HEAD~5..HEAD --to-date 2023-06-15 --dry-run

# Check for merge conflicts
git status

# Resolve any existing conflicts first
git add .
git commit -m "Resolve conflicts"

# Try migration again
histofy migrate HEAD~5..HEAD --to-date 2023-06-15

# Force migration if you're sure (use with caution)
histofy migrate HEAD~5..HEAD --to-date 2023-06-15 --force
```

#### "Backup creation failed" Error
**Problem**: Histofy can't create a backup before migration.

**Solutions**:
```bash
# Check disk space
df -h

# Check permissions in .git directory
ls -la .git/
chmod 755 .git/

# Manually create backup directory
mkdir -p .git/histofy-backups
chmod 755 .git/histofy-backups

# Try migration again
histofy migrate HEAD~5..HEAD --to-date 2023-06-15
```

### Performance Issues

#### "Operation taking too long" Issue
**Problem**: Commands are running slowly.

**Solutions**:
```bash
# Enable performance monitoring to identify bottlenecks
histofy performance --enable

# Run the slow operation
histofy --profile migrate HEAD~100..HEAD --to-date 2023-06-15

# Check performance report
histofy performance --report

# For large repositories, use streaming operations
# (automatically enabled for large operations)

# Reduce concurrent operations if memory is limited
histofy batch commit --input large-file.csv --concurrent 1
```

#### "Out of memory" Error
**Problem**: Operations consume too much memory.

**Solutions**:
```bash
# Enable memory monitoring
histofy performance --enable

# Process in smaller batches
# Instead of: histofy migrate HEAD~1000..HEAD --to-date 2023-06-15
# Use: histofy migrate HEAD~100..HEAD --to-date 2023-06-15

# Check system memory
free -h

# Close other applications to free memory

# Use streaming operations for large datasets
histofy batch commit --input large-file.csv --streaming
```

### File and Permission Issues

#### "Permission denied" Error
**Problem**: Insufficient permissions to read/write files.

**Solutions**:
```bash
# Check file permissions
ls -la

# Fix file permissions
chmod 644 filename

# Fix directory permissions
chmod 755 dirname

# Check if file is locked by another process
lsof filename

# Run with appropriate permissions (use carefully)
sudo histofy command  # Only if absolutely necessary
```

#### "File not found" Error
**Problem**: Specified file doesn't exist.

**Solutions**:
```bash
# Check if file exists
ls -la path/to/file

# Use absolute path
histofy batch commit --input /full/path/to/commits.csv

# Check current directory
pwd

# Use relative path from current directory
histofy batch commit --input ./data/commits.csv
```

### Batch Operation Issues

#### "CSV parsing error" Error
**Problem**: CSV file format is incorrect.

**Solutions**:
```bash
# Check CSV format - must have headers
head -5 commits.csv

# Correct format:
# message,date,author
# "Fix bug",2023-06-15,"John Doe <john@example.com>"
# "Add feature",2023-06-16,"Jane Smith <jane@example.com>"

# Validate CSV before processing
histofy batch validate --input commits.csv

# Check for special characters or encoding issues
file commits.csv
```

#### "Template not found" Error
**Problem**: Specified template file doesn't exist.

**Solutions**:
```bash
# Create a new template
histofy batch template --create --output template.json

# Check if template file exists
ls -la template.json

# Use absolute path for template
histofy batch import --input data.json --template /full/path/to/template.json
```

## 🔧 Diagnostic Commands

### Check System Status
```bash
# Check Histofy installation
which histofy
histofy --version

# Check Node.js version
node --version
npm --version

# Check Git installation
git --version
git config --list

# Check repository status
histofy status
git status
```

### Debug Mode
```bash
# Enable verbose output
histofy --verbose command

# Enable debug logging
export HISTOFY_DEBUG=true
histofy command

# Check configuration
histofy config list

# Test GitHub connection
histofy status --remote
```

### Performance Diagnostics
```bash
# Enable performance monitoring
histofy performance --enable

# Run operation with profiling
histofy --profile command

# Check performance summary
histofy performance --summary

# Generate detailed performance report
histofy performance --report --output debug-report.json
```

## 🆘 Getting Help

### Built-in Help System
```bash
# Main help
histofy help

# Command-specific help
histofy help commit

# Show examples
histofy help examples commit

# Interactive tutorial
histofy help tutorial getting-started

# Troubleshooting guide
histofy help troubleshooting

# FAQ
histofy help faq
```

### Community Support
- 📧 Email: ishaq2321@proton.me
- 🐛 Report Issues: [GitHub Issues](https://github.com/ishaq2321/histofy-v3/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/ishaq2321/histofy-v3/discussions)

### Before Reporting Issues
Please include the following information:

1. **System Information**:
   ```bash
   histofy --version
   node --version
   git --version
   uname -a  # Linux/macOS
   ```

2. **Configuration**:
   ```bash
   histofy config list
   ```

3. **Error Details**:
   - Full error message
   - Command that caused the error
   - Steps to reproduce

4. **Repository State**:
   ```bash
   git status
   git log --oneline -5
   ```

5. **Debug Output**:
   ```bash
   export HISTOFY_DEBUG=true
   histofy --verbose <failing-command>
   ```

## 🔄 Recovery Procedures

### Restore from Backup
If a migration fails or causes issues:

```bash
# List available backups
ls -la .git/histofy-backups/

# Restore from backup (replace BACKUP_ID with actual backup)
git reset --hard BACKUP_ID

# Or use Histofy's undo feature
histofy undo list
histofy undo OPERATION_ID
```

### Reset Configuration
If configuration is corrupted:

```bash
# Backup current config
cp ~/.histofy.yml ~/.histofy.yml.backup

# Remove corrupted config
rm ~/.histofy.yml

# Reinitialize
histofy config init

# Restore specific settings
histofy config set github.token YOUR_TOKEN
```

### Clean Installation
If all else fails:

```bash
# Remove Histofy
npm uninstall -g histofy-v3

# Remove configuration
rm ~/.histofy.yml

# Remove shell integration
# Edit ~/.bashrc or ~/.zshrc and remove Histofy lines

# Reinstall
npm install -g histofy-v3
histofy config init
```

---

**Still having issues?** Don't hesitate to reach out for help! 🤝