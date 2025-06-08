# Histofy v3 🚀

> Terminal-based GitHub history manipulation tool with custom commit dates

Histofy v3 brings the power of GitHub contribution pattern manipulation directly to your terminal. Create commits with custom dates, deploy contribution patterns, and manage your GitHub activity with ease.

## ✨ Features

- **🎯 Custom Date Commits**: Create commits with any date and time
- **🎨 Pattern Deployment**: Deploy predefined contribution patterns
- **⚡ Shell Integration**: Quick functions for common operations
- **🔄 Commit Migration**: Move existing commits to new dates
- **🎨 Pattern Management**: Create, edit, and manage contribution patterns
- **🔧 Configuration**: Persistent configuration with GitHub integration
- **📊 Status Monitoring**: Enhanced repository and GitHub status checks

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

### Basic Usage

```bash
# Initialize configuration
histofy config init

# Create a commit with custom date
histofy commit -m "My commit" --date "2023-06-15" --time "14:30"

# Quick commit (using shell function)
hc "Quick commit" "2023-06-15" "14:30"

# Deploy a pattern
histofy deploy --pattern hello-world --repo username/repo

# Check status
histofy status --remote
```

## 📖 Commands

### Core Commands

#### `histofy commit`
Create commits with custom dates and times.

```bash
# Interactive commit
histofy commit

# Direct commit
histofy commit -m "Message" --date "2023-06-15" --time "14:30"

# Add all files and commit
histofy commit -m "Message" --date "2023-06-15" --add-all

# Commit and push
histofy commit -m "Message" --date "2023-06-15" --push
```

**Options:**
- `-m, --message <message>`: Commit message
- `-d, --date <date>`: Custom date (YYYY-MM-DD)
- `-t, --time <time>`: Custom time (HH:MM, default: 12:00)
- `-a, --add-all`: Add all changes before committing
- `--author <author>`: Custom author (Name <email>)
- `--push`: Push after committing

#### `histofy deploy`
Deploy contribution patterns to repositories.

```bash
# Deploy from pattern file
histofy deploy --file pattern.yaml --repo username/repo

# Deploy predefined pattern
histofy deploy --pattern hello-world --repo username/repo

# Dry run (preview only)
histofy deploy --pattern hello-world --repo username/repo --dry-run

# Force deployment
histofy deploy --pattern hello-world --repo username/repo --force
```

**Options:**
- `-f, --file <file>`: Pattern configuration file
- `-r, --repo <repo>`: Target repository (username/repo)
- `-p, --pattern <pattern>`: Predefined pattern name
- `--dry-run`: Show what would be deployed without executing
- `--force`: Force deployment even if repository has commits

#### `histofy migrate`
Migrate existing commits to new dates.

```bash
# Migrate last 5 commits to new date
histofy migrate HEAD~5..HEAD --to-date "2023-06-15"

# Spread commits over multiple days
histofy migrate HEAD~10..HEAD --to-date "2023-06-15" --spread 5

# Custom start time
histofy migrate HEAD~3..HEAD --to-date "2023-06-15" --start-time "09:00"
```

**Options:**
- `-d, --to-date <date>`: Target date (YYYY-MM-DD)
- `-s, --spread <days>`: Spread commits over N days (default: 1)
- `-t, --start-time <time>`: Start time for first commit (default: 09:00)
- `--preserve-order`: Preserve original commit order

#### `histofy pattern`
Manage contribution patterns.

```bash
# List available patterns
histofy pattern list

# Create new pattern
histofy pattern create my-pattern

# Create from template
histofy pattern create my-pattern --template hello-world

# Edit existing pattern
histofy pattern edit my-pattern

# Preview pattern
histofy pattern preview my-pattern --year 2023

# Delete pattern
histofy pattern delete my-pattern
```

#### `histofy config`
Manage configuration settings.

```bash
# Initialize configuration
histofy config init

# Set configuration value
histofy config set github.token ghp_your_token_here
histofy config set github.username your-username
histofy config set git.defaultTime "10:00"

# Get configuration value
histofy config get github.token

# List all configuration
histofy config list
```

#### `histofy status`
Show repository and Histofy status.

```bash
# Basic status
histofy status

# Include GitHub information
histofy status --remote
```

## 🔧 Shell Functions

Histofy v3 includes convenient shell functions for quick operations:

### Quick Functions

```bash
# Quick commit with date
hc "commit message" "2023-06-15" "14:30"

# Quick commit with push
hcp "commit message" "2023-06-15" "14:30"

# Deploy pattern
hp "pattern-name" "username/repo"

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

## 🎨 Pattern System

### Pattern Structure

Patterns are defined in YAML format:

```yaml
description: "My custom pattern"
type: "Custom"
created: "2023-06-15T00:00:00.000Z"
commits:
  - date: "2023-06-15"
    time: "09:00"
    message: "Initial commit"
    author: "Developer <dev@example.com>"
  
  - date: "2023-06-16"
    time: "14:30"
    message: "Add features"
```

### Built-in Templates

- **hello-world**: Simple introduction pattern
- **daily-contributor**: Consistent daily commits
- **github-streak**: 30-day contribution streak
- **weekly-pattern**: Weekly contribution pattern

### Creating Custom Patterns

```bash
# Interactive creation
histofy pattern create my-pattern

# From template
histofy pattern create my-pattern --template daily-contributor

# Manual creation
# Edit ~/.histofy/patterns/my-pattern.yaml
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
├── templates/         # Pattern templates
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

## 🙏 Acknowledgments

- Built on top of the original Histofy project
- Inspired by the GitHub contribution graph
- Thanks to all contributors and users

## 📞 Support

- 📧 Email: support@histofy.com
- 🐛 Issues: [GitHub Issues](https://github.com/histofy/histofy-v3/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/histofy/histofy-v3/discussions)

---

**Made with ❤️ by the Histofy Team**
