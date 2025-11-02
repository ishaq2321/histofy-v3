#!/bin/bash

# Histofy v3 Cross-Platform Shell Integration Installer
# This script sets up shell functions and aliases for easier Histofy usage
# Supports: Bash, ZSH, Fish, and PowerShell (via companion PowerShell script)

# Version and metadata
HISTOFY_VERSION="3.0.0"
INSTALLER_VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Platform detection
PLATFORM=$(uname -s)
ARCH=$(uname -m)

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect operating system
detect_os() {
    case "$PLATFORM" in
        "Linux")
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                echo "$ID"
            else
                echo "linux"
            fi
            ;;
        "Darwin")
            echo "macos"
            ;;
        "CYGWIN"* | "MINGW"* | "MSYS"*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Detect shell with enhanced detection
detect_shell() {
    # Check environment variables first
    if [ -n "$ZSH_VERSION" ]; then
        echo "zsh"
    elif [ -n "$BASH_VERSION" ]; then
        echo "bash"
    elif [ -n "$FISH_VERSION" ]; then
        echo "fish"
    else
        # Fallback to checking $SHELL variable
        case "$SHELL" in
            */zsh)
                echo "zsh"
                ;;
            */bash)
                echo "bash"
                ;;
            */fish)
                echo "fish"
                ;;
            */dash)
                echo "dash"
                ;;
            */sh)
                echo "sh"
                ;;
            *)
                echo "unknown"
                ;;
        esac
    fi
}

# Detect package manager
detect_package_manager() {
    if command -v npm >/dev/null 2>&1; then
        echo "npm"
    elif command -v yarn >/dev/null 2>&1; then
        echo "yarn"
    elif command -v pnpm >/dev/null 2>&1; then
        echo "pnpm"
    else
        echo "none"
    fi
}

# Get shell config file with OS-specific logic
get_shell_config() {
    local shell_type="$1"
    local os_type=$(detect_os)
    
    case "$shell_type" in
        "bash")
            case "$os_type" in
                "macos")
                    # macOS prefers .bash_profile for login shells
                    if [ -f "$HOME/.bash_profile" ]; then
                        echo "$HOME/.bash_profile"
                    else
                        echo "$HOME/.bashrc"
                    fi
                    ;;
                *)
                    # Linux and others prefer .bashrc
                    if [ -f "$HOME/.bashrc" ]; then
                        echo "$HOME/.bashrc"
                    elif [ -f "$HOME/.bash_profile" ]; then
                        echo "$HOME/.bash_profile"
                    else
                        echo "$HOME/.bashrc"
                    fi
                    ;;
            esac
            ;;
        "zsh")
            echo "$HOME/.zshrc"
            ;;
        "fish")
            echo "$HOME/.config/fish/config.fish"
            ;;
        "dash" | "sh")
            echo "$HOME/.profile"
            ;;
        *)
            echo "$HOME/.profile"
            ;;
    esac
}

# Ensure config directory exists
ensure_config_dir() {
    local config_file="$1"
    local config_dir=$(dirname "$config_file")
    
    if [ ! -d "$config_dir" ]; then
        echo -e "${BLUE}Creating config directory: $config_dir${NC}"
        mkdir -p "$config_dir"
    fi
}

# Check system requirements
check_requirements() {
    local os_type=$(detect_os)
    local shell_type=$(detect_shell)
    local pkg_manager=$(detect_package_manager)
    
    echo -e "${CYAN}System Information:${NC}"
    echo -e "  OS: ${YELLOW}$os_type${NC} ($PLATFORM $ARCH)"
    echo -e "  Shell: ${YELLOW}$shell_type${NC} ($SHELL)"
    echo -e "  Package Manager: ${YELLOW}$pkg_manager${NC}"
    echo ""
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        echo -e "${GREEN}✅ Node.js found: $node_version${NC}"
    else
        echo -e "${RED}❌ Node.js not found${NC}"
        echo -e "${YELLOW}Please install Node.js (v14 or higher) from https://nodejs.org${NC}"
        return 1
    fi
    
    # Check Git
    if command -v git >/dev/null 2>&1; then
        local git_version=$(git --version)
        echo -e "${GREEN}✅ Git found: $git_version${NC}"
    else
        echo -e "${RED}❌ Git not found${NC}"
        echo -e "${YELLOW}Please install Git from https://git-scm.com${NC}"
        return 1
    fi
    
    echo ""
    return 0
}

# Install or update Histofy CLI
install_histofy_cli() {
    local pkg_manager=$(detect_package_manager)
    
    if [ "$pkg_manager" = "none" ]; then
        echo -e "${RED}❌ No package manager found${NC}"
        echo -e "${YELLOW}Please install npm, yarn, or pnpm first${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Installing/updating Histofy CLI...${NC}"
    
    # Check if we're in the Histofy project directory
    if [ -f "$SCRIPT_DIR/../package.json" ] && grep -q "histofy-cli" "$SCRIPT_DIR/../package.json"; then
        echo -e "${CYAN}Installing from local project...${NC}"
        cd "$SCRIPT_DIR/.."
        
        case "$pkg_manager" in
            "npm")
                npm install -g . || npm link
                ;;
            "yarn")
                yarn global add . || yarn link
                ;;
            "pnpm")
                pnpm install -g . || pnpm link --global
                ;;
        esac
    else
        echo -e "${CYAN}Installing from npm registry...${NC}"
        case "$pkg_manager" in
            "npm")
                npm install -g histofy-cli
                ;;
            "yarn")
                yarn global add histofy-cli
                ;;
            "pnpm")
                pnpm install -g histofy-cli
                ;;
        esac
    fi
    
    # Verify installation
    if command -v histofy >/dev/null 2>&1; then
        local histofy_version=$(histofy --version 2>/dev/null || echo "unknown")
        echo -e "${GREEN}✅ Histofy CLI installed: $histofy_version${NC}"
        return 0
    else
        echo -e "${RED}❌ Histofy CLI installation failed${NC}"
        return 1
    fi
}

# Create shell-specific function files
create_shell_functions() {
    local shell_type="$1"
    local target_file="$SCRIPT_DIR/${shell_type}_functions.sh"
    local base_file="$SCRIPT_DIR/bash_functions.sh"
    
    if [ ! -f "$base_file" ]; then
        echo -e "${RED}❌ Base functions file not found: $base_file${NC}"
        return 1
    fi
    
    case "$shell_type" in
        "zsh")
            if [ ! -f "$target_file" ]; then
                echo -e "${BLUE}Creating ZSH functions file...${NC}"
                cp "$base_file" "$target_file"
                
                # ZSH-specific modifications
                sed -i.bak 's|#!/bin/bash|#!/usr/bin/env zsh|g' "$target_file" 2>/dev/null || {
                    sed 's|#!/bin/bash|#!/usr/bin/env zsh|g' "$target_file" > "$target_file.tmp" && mv "$target_file.tmp" "$target_file"
                }
                
                # Add ZSH-specific configurations
                cat >> "$target_file" << 'EOF'

# ZSH-specific configurations
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_SAVE_NO_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_VERIFY

# Enable ZSH completion system
autoload -Uz compinit
compinit
EOF
                
                echo -e "${GREEN}✅ ZSH functions file created${NC}"
            fi
            ;;
        "fish")
            if [ ! -f "$target_file" ]; then
                echo -e "${BLUE}Creating Fish functions file...${NC}"
                
                # Fish uses a different syntax, so we create a basic version
                cat > "$target_file" << 'EOF'
#!/usr/bin/env fish

# Histofy v3 - Fish Shell Functions
# Add these functions to your ~/.config/fish/config.fish

# Quick commit with custom date
function hc
    set message $argv[1]
    set date $argv[2]
    set time $argv[3]
    
    if test -z "$message" -o -z "$date"
        echo "Usage: hc \"commit message\" \"YYYY-MM-DD\" [\"HH:MM\"]"
        echo "Example: hc \"Initial commit\" \"2023-06-15\" \"14:30\""
        return 1
    end
    
    if test -z "$time"
        set time "12:00"
    end
    
    histofy commit "$message" --date "$date" --time "$time" --add-all
end

# Quick commit with push
function hcp
    set message $argv[1]
    set date $argv[2]
    set time $argv[3]
    
    if test -z "$message" -o -z "$date"
        echo "Usage: hcp \"commit message\" \"YYYY-MM-DD\" [\"HH:MM\"]"
        echo "Example: hcp \"Initial commit\" \"2023-06-15\" \"14:30\""
        return 1
    end
    
    if test -z "$time"
        set time "12:00"
    end
    
    histofy commit "$message" --date "$date" --time "$time" --add-all --push
end

# Quick status check
function hs
    histofy status $argv
end

# Interactive commit with date picker
function hci
    histofy commit
end

# Show histofy help
function hh
    histofy --help
end

# Show Histofy help and quick reference
function hhelp
    echo "🎉 Histofy v3 Quick Reference"
    echo "Available commands:"
    echo "  hc   - Quick commit with date"
    echo "  hcp  - Quick commit with push"
    echo "  hs   - Show status"
    echo "  hci  - Interactive commit"
    echo "  hh   - Show help"
    echo "  hhelp - Show this help message"
end
EOF
                
                echo -e "${GREEN}✅ Fish functions file created${NC}"
            fi
            ;;
    esac
}

# Install shell functions with enhanced support
install_functions() {
    local shell_type=$(detect_shell)
    local config_file=$(get_shell_config "$shell_type")
    local functions_file=""
    
    # Ensure config directory exists
    ensure_config_dir "$config_file"
    
    # Create shell-specific functions if needed
    create_shell_functions "$shell_type"
    
    case "$shell_type" in
        "bash")
            functions_file="$SCRIPT_DIR/bash_functions.sh"
            ;;
        "zsh")
            functions_file="$SCRIPT_DIR/zsh_functions.sh"
            ;;
        "fish")
            functions_file="$SCRIPT_DIR/fish_functions.sh"
            ;;
        *)
            echo -e "${YELLOW}Warning: Unknown shell type ($shell_type). Installing bash functions...${NC}"
            functions_file="$SCRIPT_DIR/bash_functions.sh"
            ;;
    esac
    
    echo -e "${BLUE}Installing Histofy shell functions...${NC}"
    echo -e "  Shell: ${YELLOW}$shell_type${NC}"
    echo -e "  Config file: ${YELLOW}$config_file${NC}"
    echo -e "  Functions file: ${YELLOW}$functions_file${NC}"
    echo ""
    
    # Check if functions are already installed
    if [ -f "$config_file" ] && grep -q "Histofy v3" "$config_file" 2>/dev/null; then
        echo -e "${YELLOW}Histofy functions already installed. Updating...${NC}"
        
        # Remove old installation
        if command -v sed >/dev/null 2>&1; then
            # Create backup
            cp "$config_file" "$config_file.histofy.bak"
            
            # Remove old installation
            sed -i.tmp '/# Histofy v3 - Shell Functions/,/# End Histofy v3/d' "$config_file" 2>/dev/null || {
                sed '/# Histofy v3 - Shell Functions/,/# End Histofy v3/d' "$config_file" > "$config_file.tmp" && mv "$config_file.tmp" "$config_file"
            }
        fi
    fi
    
    # Add new installation
    echo "" >> "$config_file"
    echo "# Histofy v3 - Shell Functions (installed $(date))" >> "$config_file"
    
    if [ "$shell_type" = "fish" ]; then
        # Fish uses different syntax
        echo "if test -f \"$functions_file\"" >> "$config_file"
        echo "    source \"$functions_file\"" >> "$config_file"
        echo "end" >> "$config_file"
    else
        # Bash/ZSH syntax
        echo "if [ -f \"$functions_file\" ]; then" >> "$config_file"
        echo "    source \"$functions_file\"" >> "$config_file"
        echo "fi" >> "$config_file"
    fi
    
    echo "# End Histofy v3" >> "$config_file"
    
    echo -e "${GREEN}✅ Shell functions installed successfully!${NC}"
    echo ""
}

# Setup auto-completion
setup_completion() {
    local shell_type=$(detect_shell)
    
    echo -e "${BLUE}Setting up command completion for $shell_type...${NC}"
    
    case "$shell_type" in
        "bash")
            # Create bash completion script
            local completion_dir="/usr/local/etc/bash_completion.d"
            local user_completion_dir="$HOME/.local/share/bash-completion/completions"
            
            # Try user directory first
            if [ ! -d "$user_completion_dir" ]; then
                mkdir -p "$user_completion_dir"
            fi
            
            cat > "$user_completion_dir/histofy" << 'EOF'
#!/bin/bash
# Histofy bash completion

_histofy_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    opts="commit config migrate status --help --version"
    
    case "${prev}" in
        histofy)
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        commit)
            COMPREPLY=( $(compgen -W "--date --time --author --add-all --push --dry-run" -- ${cur}) )
            return 0
            ;;
        config)
            COMPREPLY=( $(compgen -W "get set init list validate" -- ${cur}) )
            return 0
            ;;
        status)
            COMPREPLY=( $(compgen -W "--remote --verbose" -- ${cur}) )
            return 0
            ;;
        migrate)
            COMPREPLY=( $(compgen -W "--from --to --strategy --dry-run" -- ${cur}) )
            return 0
            ;;
    esac
}

complete -F _histofy_completion histofy
EOF
            
            echo -e "${GREEN}✅ Bash completion installed${NC}"
            ;;
        "zsh")
            # Create zsh completion script
            local zsh_completion_dir="$HOME/.zsh/completions"
            
            if [ ! -d "$zsh_completion_dir" ]; then
                mkdir -p "$zsh_completion_dir"
            fi
            
            cat > "$zsh_completion_dir/_histofy" << 'EOF'
#compdef histofy

# Histofy zsh completion

_histofy() {
    local context state line
    
    _arguments \
        '1: :->commands' \
        '*: :->args'
    
    case $state in
        commands)
            _values 'histofy commands' \
                'commit[Create a commit with custom date]' \
                'config[Manage configuration]' \
                'migrate[Migrate commit history]' \
                'status[Show repository status]'
            ;;
        args)
            case $words[2] in
                commit)
                    _arguments \
                        '--date[Commit date (YYYY-MM-DD)]' \
                        '--time[Commit time (HH:MM)]' \
                        '--author[Commit author]' \
                        '--add-all[Add all files]' \
                        '--push[Push after commit]' \
                        '--dry-run[Show what would be done]'
                    ;;
                config)
                    _values 'config commands' \
                        'get[Get configuration value]' \
                        'set[Set configuration value]' \
                        'init[Initialize configuration]' \
                        'list[List all configuration]' \
                        'validate[Validate configuration]'
                    ;;
                status)
                    _arguments \
                        '--remote[Include remote status]' \
                        '--verbose[Verbose output]'
                    ;;
                migrate)
                    _arguments \
                        '--from[Source commit/range]' \
                        '--to[Target commit/range]' \
                        '--strategy[Migration strategy]' \
                        '--dry-run[Show what would be done]'
                    ;;
            esac
            ;;
    esac
}

_histofy "$@"
EOF
            
            # Add to fpath if not already there
            local zshrc="$HOME/.zshrc"
            if [ -f "$zshrc" ] && ! grep -q "$zsh_completion_dir" "$zshrc"; then
                echo "" >> "$zshrc"
                echo "# Histofy completion" >> "$zshrc"
                echo "fpath=($zsh_completion_dir \$fpath)" >> "$zshrc"
                echo "autoload -Uz compinit && compinit" >> "$zshrc"
            fi
            
            echo -e "${GREEN}✅ ZSH completion installed${NC}"
            ;;
        "fish")
            # Create fish completion script
            local fish_completion_dir="$HOME/.config/fish/completions"
            
            if [ ! -d "$fish_completion_dir" ]; then
                mkdir -p "$fish_completion_dir"
            fi
            
            cat > "$fish_completion_dir/histofy.fish" << 'EOF'
# Histofy fish completion

# Main commands
complete -c histofy -n '__fish_use_subcommand' -a 'commit' -d 'Create a commit with custom date'
complete -c histofy -n '__fish_use_subcommand' -a 'config' -d 'Manage configuration'
complete -c histofy -n '__fish_use_subcommand' -a 'migrate' -d 'Migrate commit history'
complete -c histofy -n '__fish_use_subcommand' -a 'status' -d 'Show repository status'

# Global options
complete -c histofy -l help -d 'Show help'
complete -c histofy -l version -d 'Show version'

# Commit command options
complete -c histofy -n '__fish_seen_subcommand_from commit' -l date -d 'Commit date (YYYY-MM-DD)'
complete -c histofy -n '__fish_seen_subcommand_from commit' -l time -d 'Commit time (HH:MM)'
complete -c histofy -n '__fish_seen_subcommand_from commit' -l author -d 'Commit author'
complete -c histofy -n '__fish_seen_subcommand_from commit' -l add-all -d 'Add all files'
complete -c histofy -n '__fish_seen_subcommand_from commit' -l push -d 'Push after commit'
complete -c histofy -n '__fish_seen_subcommand_from commit' -l dry-run -d 'Show what would be done'

# Config command options
complete -c histofy -n '__fish_seen_subcommand_from config' -a 'get set init list validate'

# Status command options
complete -c histofy -n '__fish_seen_subcommand_from status' -l remote -d 'Include remote status'
complete -c histofy -n '__fish_seen_subcommand_from status' -l verbose -d 'Verbose output'

# Migrate command options
complete -c histofy -n '__fish_seen_subcommand_from migrate' -l from -d 'Source commit/range'
complete -c histofy -n '__fish_seen_subcommand_from migrate' -l to -d 'Target commit/range'
complete -c histofy -n '__fish_seen_subcommand_from migrate' -l strategy -d 'Migration strategy'
complete -c histofy -n '__fish_seen_subcommand_from migrate' -l dry-run -d 'Show what would be done'
EOF
            
            echo -e "${GREEN}✅ Fish completion installed${NC}"
            ;;
        *)
            echo -e "${YELLOW}⚠️  Completion not available for $shell_type${NC}"
            ;;
    esac
}

# Verify installation
verify_installation() {
    echo -e "${BLUE}Verifying installation...${NC}"
    
    local errors=0
    
    # Check Histofy CLI
    if command -v histofy >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Histofy CLI is accessible${NC}"
        
        # Test basic command
        if histofy --version >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Histofy CLI is working${NC}"
        else
            echo -e "${RED}❌ Histofy CLI not responding${NC}"
            errors=$((errors + 1))
        fi
    else
        echo -e "${RED}❌ Histofy CLI not found in PATH${NC}"
        errors=$((errors + 1))
    fi
    
    # Check shell functions
    local shell_type=$(detect_shell)
    local config_file=$(get_shell_config "$shell_type")
    
    if [ -f "$config_file" ] && grep -q "Histofy v3" "$config_file"; then
        echo -e "${GREEN}✅ Shell functions installed${NC}"
    else
        echo -e "${RED}❌ Shell functions not found${NC}"
        errors=$((errors + 1))
    fi
    
    # Check function files
    local functions_file="$SCRIPT_DIR/${shell_type}_functions.sh"
    if [ ! -f "$functions_file" ]; then
        functions_file="$SCRIPT_DIR/bash_functions.sh"
    fi
    
    if [ -f "$functions_file" ]; then
        echo -e "${GREEN}✅ Function files exist${NC}"
    else
        echo -e "${RED}❌ Function files missing${NC}"
        errors=$((errors + 1))
    fi
    
    echo ""
    
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}🎉 Installation verification passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ Installation verification failed ($errors errors)${NC}"
        return 1
    fi
}

# Show post-installation instructions
show_instructions() {
    local shell_type=$(detect_shell)
    local config_file=$(get_shell_config "$shell_type")
    
    echo -e "${CYAN}📋 Post-Installation Instructions:${NC}"
    echo ""
    
    echo -e "${YELLOW}1. Reload your shell configuration:${NC}"
    case "$shell_type" in
        "bash")
            echo -e "   ${BLUE}source ~/.bashrc${NC} (or restart your terminal)"
            ;;
        "zsh")
            echo -e "   ${BLUE}source ~/.zshrc${NC} (or restart your terminal)"
            ;;
        "fish")
            echo -e "   ${BLUE}source ~/.config/fish/config.fish${NC} (or restart your terminal)"
            ;;
        *)
            echo -e "   ${BLUE}source $config_file${NC} (or restart your terminal)"
            ;;
    esac
    echo ""
    
    echo -e "${YELLOW}2. Initialize Histofy configuration:${NC}"
    echo -e "   ${BLUE}histofy config init${NC}"
    echo ""
    
    echo -e "${YELLOW}3. Set your GitHub token (optional but recommended):${NC}"
    echo -e "   ${BLUE}histofy config set github.token YOUR_GITHUB_TOKEN${NC}"
    echo ""
    
    echo -e "${YELLOW}4. Set your Git defaults:${NC}"
    echo -e "   ${BLUE}histofy config set git.defaultAuthor \"Your Name\"${NC}"
    echo -e "   ${BLUE}histofy config set git.defaultEmail \"your.email@example.com\"${NC}"
    echo ""
    
    echo -e "${YELLOW}5. Test the installation:${NC}"
    echo -e "   ${BLUE}histofy status${NC}"
    echo -e "   ${BLUE}hhelp${NC} (to see quick reference)"
    echo ""
    
    echo -e "${CYAN}🚀 Available Quick Commands:${NC}"
    echo -e "   ${PURPLE}hc${NC}    - Quick commit with date"
    echo -e "   ${PURPLE}hcp${NC}   - Quick commit with push"
    echo -e "   ${PURPLE}hs${NC}    - Show status"
    echo -e "   ${PURPLE}hci${NC}   - Interactive commit"
    echo -e "   ${PURPLE}hh${NC}    - Show help"
    echo -e "   ${PURPLE}hhelp${NC} - Show quick reference"
    echo ""
}

# Handle command line arguments
handle_args() {
    case "$1" in
        "--help" | "-h")
            echo "Histofy v3 Cross-Platform Installer"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --help, -h          Show this help message"
            echo "  --version, -v       Show version information"
            echo "  --skip-cli          Skip CLI installation"
            echo "  --skip-functions    Skip shell functions installation"
            echo "  --skip-completion   Skip completion setup"
            echo "  --verify-only       Only verify existing installation"
            echo "  --uninstall         Uninstall Histofy"
            echo ""
            exit 0
            ;;
        "--version" | "-v")
            echo "Histofy Installer v$INSTALLER_VERSION"
            echo "Target Histofy version: v$HISTOFY_VERSION"
            exit 0
            ;;
        "--verify-only")
            verify_installation
            exit $?
            ;;
        "--uninstall")
            echo "Uninstall functionality not implemented yet"
            exit 1
            ;;
    esac
}

# Main installation function
main() {
    # Handle command line arguments
    handle_args "$@"
    
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                 Histofy v3 Installer                    ║"
    echo "║            Cross-Platform Shell Integration              ║"
    echo "║                                                          ║"
    echo "║  Supports: Bash, ZSH, Fish, PowerShell                  ║"
    echo "║  Platforms: Linux, macOS, Windows                       ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    # Check system requirements
    if ! check_requirements; then
        echo -e "${RED}❌ System requirements not met${NC}"
        exit 1
    fi
    
    # Install Histofy CLI (unless skipped)
    if [[ "$*" != *"--skip-cli"* ]]; then
        if ! install_histofy_cli; then
            echo -e "${YELLOW}⚠️  CLI installation failed, continuing with shell functions...${NC}"
        fi
    fi
    
    # Install shell functions (unless skipped)
    if [[ "$*" != *"--skip-functions"* ]]; then
        install_functions
    fi
    
    # Setup completion (unless skipped)
    if [[ "$*" != *"--skip-completion"* ]]; then
        setup_completion
    fi
    
    # Verify installation
    echo ""
    if verify_installation; then
        echo -e "${GREEN}"
        echo "🎉 Installation completed successfully!"
        echo -e "${NC}"
        echo ""
        
        show_instructions
        
        echo -e "${GREEN}Happy coding with Histofy! 🚀${NC}"
    else
        echo -e "${RED}❌ Installation completed with errors${NC}"
        echo -e "${YELLOW}Please check the error messages above and try again${NC}"
        exit 1
    fi
}

# Run installer
main "$@"