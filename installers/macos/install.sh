#!/bin/bash
# Histofy v3 - Enhanced macOS Installer
# Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
# Licensed under MIT License - https://opensource.org/licenses/MIT

set -euo pipefail

# Installer configuration
readonly HISTOFY_VERSION="3.0.0"
readonly INSTALLER_VERSION="2.0.0"
readonly MIN_NODE_VERSION="16.0.0"
readonly MIN_GIT_VERSION="2.20.0"
readonly MIN_BASH_VERSION="4.0"
readonly MIN_ZSH_VERSION="5.0"

# Default options
SKIP_CLI=false
SKIP_FUNCTIONS=false
SKIP_COMPLETION=false
VERIFY_ONLY=false
UNINSTALL=false
HELP=false
VERSION=false
SILENT=false
FORCE=false
DEV_MODE=false
UPDATE_ONLY=false
INSTALL_PATH=""
CONFIG_PATH=""

# Colors and formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly GRAY='\033[0;37m'
readonly NC='\033[0m' # No Color

# Emoji support detection
EMOJI_SUPPORT=true
if [[ "${TERM:-}" == "dumb" ]] || [[ "${CI:-}" == "true" ]]; then
    EMOJI_SUPPORT=false
fi

# Enhanced output functions
log_info() {
    local icon="ℹ️"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[INFO]"
    [[ "$SILENT" == "false" ]] && echo -e "${CYAN}${icon} $1${NC}"
}

log_success() {
    local icon="✅"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[SUCCESS]"
    echo -e "${GREEN}${icon} $1${NC}"
}

log_warning() {
    local icon="⚠️"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[WARNING]"
    echo -e "${YELLOW}${icon} $1${NC}"
}

log_error() {
    local icon="❌"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[ERROR]"
    echo -e "${RED}${icon} $1${NC}" >&2
}

log_debug() {
    local icon="🔍"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[DEBUG]"
    [[ "${DEBUG:-}" == "true" ]] && echo -e "${GRAY}${icon} $1${NC}"
}

log_progress() {
    local icon="🔄"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[PROGRESS]"
    [[ "$SILENT" == "false" ]] && echo -e "${BLUE}${icon} $1${NC}"
}

# System detection functions
detect_system() {
    local system_info=""
    
    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local macos_version
        macos_version=$(sw_vers -productVersion 2>/dev/null || echo "Unknown")
        local macos_name
        macos_name=$(sw_vers -productName 2>/dev/null || echo "macOS")
        system_info="OS: $macos_name $macos_version"
    else
        system_info="OS: $OSTYPE"
    fi
    
    # Detect architecture
    local arch
    arch=$(uname -m 2>/dev/null || echo "Unknown")
    system_info="$system_info, Architecture: $arch"
    
    # Detect shell
    local shell_name
    shell_name=$(basename "${SHELL:-/bin/bash}")
    local shell_version=""
    
    case "$shell_name" in
        bash)
            shell_version=$($SHELL --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || echo "Unknown")
            ;;
        zsh)
            shell_version=$($SHELL --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || echo "Unknown")
            ;;
        *)
            shell_version="Unknown"
            ;;
    esac
    
    system_info="$system_info, Shell: $shell_name $shell_version"
    
    # Detect if running under Rosetta (Apple Silicon Macs)
    if [[ "$arch" == "x86_64" ]] && [[ -n "${ROSETTA_ENABLED:-}" ]] || sysctl -n machdep.cpu.brand_string 2>/dev/null | grep -q "Apple"; then
        system_info="$system_info (Rosetta)"
    fi
    
    echo "$system_info"
}

check_macos_compatibility() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "This installer is designed for macOS systems"
        return 1
    fi
    
    # Check macOS version
    local macos_version
    macos_version=$(sw_vers -productVersion 2>/dev/null || echo "0.0.0")
    local major_version
    major_version=$(echo "$macos_version" | cut -d. -f1)
    local minor_version
    minor_version=$(echo "$macos_version" | cut -d. -f2)
    
    # Require macOS 10.15 (Catalina) or later
    if [[ "$major_version" -lt 10 ]] || [[ "$major_version" -eq 10 && "$minor_version" -lt 15 ]]; then
        log_error "macOS 10.15 (Catalina) or later is required (current: $macos_version)"
        return 1
    fi
    
    # Check for Xcode Command Line Tools
    if ! xcode-select -p >/dev/null 2>&1; then
        log_warning "Xcode Command Line Tools not found"
        log_info "Install with: xcode-select --install"
        if [[ "$FORCE" == "false" ]]; then
            return 1
        fi
    fi
    
    return 0
}

check_prerequisites() {
    log_progress "Checking prerequisites..."
    
    local all_good=true
    local node_found=false
    local git_found=false
    local npm_found=false
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version
        node_version=$(node --version 2>/dev/null | sed 's/v//')
        if version_compare "$node_version" "$MIN_NODE_VERSION"; then
            log_success "Node.js: v$node_version"
            node_found=true
        else
            log_error "Node.js version too old: v$node_version (minimum: v$MIN_NODE_VERSION)"
            all_good=false
        fi
    else
        log_error "Node.js not found"
        log_info "Install from https://nodejs.org or use: brew install node"
        all_good=false
    fi
    
    # Check Git
    if command -v git >/dev/null 2>&1; then
        local git_version
        git_version=$(git --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
        if version_compare "$git_version" "$MIN_GIT_VERSION"; then
            log_success "Git: v$git_version"
            git_found=true
        else
            log_warning "Git version may be too old: v$git_version (recommended: v$MIN_GIT_VERSION+)"
            git_found=true
        fi
    else
        log_error "Git not found"
        log_info "Install with: brew install git or xcode-select --install"
        all_good=false
    fi
    
    # Check package manager
    local package_manager=""
    if command -v npm >/dev/null 2>&1; then
        local npm_version
        npm_version=$(npm --version 2>/dev/null)
        log_success "NPM: v$npm_version"
        package_manager="npm"
        npm_found=true
    elif command -v yarn >/dev/null 2>&1; then
        local yarn_version
        yarn_version=$(yarn --version 2>/dev/null)
        log_success "Yarn: v$yarn_version"
        package_manager="yarn"
    elif command -v pnpm >/dev/null 2>&1; then
        local pnpm_version
        pnpm_version=$(pnpm --version 2>/dev/null)
        log_success "PNPM: v$pnpm_version"
        package_manager="pnpm"
    else
        log_error "No package manager found (npm, yarn, or pnpm required)"
        all_good=false
    fi
    
    # Check optional tools
    if command -v gh >/dev/null 2>&1; then
        local gh_version
        gh_version=$(gh --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_success "GitHub CLI: v$gh_version (optional)"
    else
        log_debug "GitHub CLI not found (optional)"
    fi
    
    if command -v brew >/dev/null 2>&1; then
        log_success "Homebrew detected"
    else
        log_debug "Homebrew not found (optional but recommended)"
    fi
    
    # Return results
    if [[ "$all_good" == "true" ]]; then
        echo "success:$package_manager"
    else
        echo "failed:"
    fi
}

# Version comparison function
version_compare() {
    local version1="$1"
    local version2="$2"
    
    # Convert versions to comparable format
    local v1_major v1_minor v1_patch
    local v2_major v2_minor v2_patch
    
    IFS='.' read -r v1_major v1_minor v1_patch <<< "$version1"
    IFS='.' read -r v2_major v2_minor v2_patch <<< "$version2"
    
    # Default to 0 if parts are missing
    v1_minor=${v1_minor:-0}
    v1_patch=${v1_patch:-0}
    v2_minor=${v2_minor:-0}
    v2_patch=${v2_patch:-0}
    
    # Compare versions
    if [[ "$v1_major" -gt "$v2_major" ]]; then
        return 0
    elif [[ "$v1_major" -eq "$v2_major" ]]; then
        if [[ "$v1_minor" -gt "$v2_minor" ]]; then
            return 0
        elif [[ "$v1_minor" -eq "$v2_minor" ]]; then
            if [[ "$v1_patch" -ge "$v2_patch" ]]; then
                return 0
            fi
        fi
    fi
    
    return 1
}install_
histofy_cli() {
    local package_manager="$1"
    
    log_progress "Installing Histofy CLI..."
    
    # Check if we're in development mode
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local project_root
    project_root="$(cd "$script_dir/../.." && pwd)"
    
    if [[ -f "$project_root/package.json" ]] && [[ "$DEV_MODE" == "true" ]]; then
        log_info "Installing from local development project..."
        
        cd "$project_root"
        
        # Install dependencies
        log_progress "Installing dependencies..."
        case "$package_manager" in
            npm)
                npm install
                npm link
                ;;
            yarn)
                yarn install
                yarn link
                ;;
            pnpm)
                pnpm install
                pnpm link --global
                ;;
        esac
        
        cd - >/dev/null
    else
        log_info "Installing from npm registry..."
        
        case "$package_manager" in
            npm)
                if [[ -n "$INSTALL_PATH" ]]; then
                    npm install -g histofy-cli --prefix "$INSTALL_PATH"
                else
                    npm install -g histofy-cli
                fi
                ;;
            yarn)
                yarn global add histofy-cli
                ;;
            pnpm)
                pnpm install -g histofy-cli
                ;;
        esac
    fi
    
    # Verify installation
    sleep 2
    if command -v histofy >/dev/null 2>&1; then
        local histofy_version
        histofy_version=$(histofy --version 2>/dev/null || echo "Unknown")
        log_success "Histofy CLI installed: $histofy_version"
        return 0
    else
        log_error "Histofy CLI installation verification failed"
        return 1
    fi
}

verify_installation() {
    log_progress "Verifying installation..."
    
    # Use comprehensive health check if available
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local health_check_script="$script_dir/../health-check.sh"
    
    if [[ -f "$health_check_script" ]]; then
        log_info "Running comprehensive health check..."
        
        if bash "$health_check_script" --silent; then
            log_success "Comprehensive verification passed"
            return 0
        else
            log_warning "Comprehensive verification found issues"
            
            # Run detailed check for troubleshooting
            if [[ "$SILENT" == "false" ]]; then
                echo ""
                log_info "Running detailed health check for troubleshooting..."
                bash "$health_check_script" --verbose --fix
            fi
            return 1
        fi
    else
        # Fallback to basic verification
        log_info "Running basic verification..."
        
        local verification_passed=true
        local issues=()
        
        # Test CLI
        if command -v histofy >/dev/null 2>&1; then
            local histofy_version
            histofy_version=$(histofy --version 2>/dev/null || echo "Unknown")
            log_success "CLI verification: $histofy_version"
        else
            log_error "CLI verification failed: histofy command not found"
            issues+=("Histofy CLI not accessible")
            verification_passed=false
        fi
        
        # Test shell integration
        local shell_type
        shell_type=$(detect_shell)
        local config_file
        config_file=$(get_shell_config_file "$shell_type")
        local functions_file="$script_dir/histofy-functions.sh"
        
        if [[ -f "$config_file" ]] && [[ -f "$functions_file" ]]; then
            if grep -q "Histofy v3" "$config_file"; then
                log_success "Shell integration verified"
            else
                log_warning "Shell integration may not be properly configured"
                issues+=("Shell integration configuration issue")
            fi
        else
            log_error "Shell integration files missing"
            issues+=("Shell integration files not found")
            verification_passed=false
        fi
        
        # Test configuration
        if histofy config list >/dev/null 2>&1; then
            log_success "Configuration system verified"
        else
            log_warning "Configuration not initialized (run 'histofy config init')"
        fi
        
        if [[ "$verification_passed" == "true" ]]; then
            log_success "Basic verification passed"
            return 0
        else
            log_error "Basic verification failed"
            printf '%s\n' "${issues[@]}"
            return 1
        fi
    fi
}

detect_shell() {
    local shell_name
    shell_name=$(basename "${SHELL:-/bin/bash}")
    
    case "$shell_name" in
        bash)
            echo "bash"
            ;;
        zsh)
            echo "zsh"
            ;;
        fish)
            echo "fish"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

get_shell_config_file() {
    local shell_type="$1"
    local config_file=""
    
    case "$shell_type" in
        bash)
            if [[ -f "$HOME/.bash_profile" ]]; then
                config_file="$HOME/.bash_profile"
            elif [[ -f "$HOME/.bashrc" ]]; then
                config_file="$HOME/.bashrc"
            else
                config_file="$HOME/.bash_profile"
            fi
            ;;
        zsh)
            config_file="$HOME/.zshrc"
            ;;
        fish)
            config_file="$HOME/.config/fish/config.fish"
            ;;
        *)
            config_file="$HOME/.profile"
            ;;
    esac
    
    echo "$config_file"
}

install_shell_integration() {
    local shell_type
    shell_type=$(detect_shell)
    
    log_progress "Installing shell integration for $shell_type..."
    
    local config_file
    config_file=$(get_shell_config_file "$shell_type")
    
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local functions_file="$script_dir/histofy-functions.sh"
    
    # Create enhanced shell functions
    create_shell_functions "$functions_file" "$shell_type"
    
    # Ensure config directory exists
    local config_dir
    config_dir=$(dirname "$config_file")
    [[ ! -d "$config_dir" ]] && mkdir -p "$config_dir"
    
    # Check if already installed
    if [[ -f "$config_file" ]] && grep -q "Histofy v3" "$config_file"; then
        log_info "Histofy integration already exists. Updating..."
        
        # Remove old installation
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' '/# Histofy v3/,/# End Histofy v3/d' "$config_file"
        else
            sed -i '/# Histofy v3/,/# End Histofy v3/d' "$config_file"
        fi
    fi
    
    # Add new installation block
    cat >> "$config_file" << EOF

# Histofy v3 - Shell Integration (installed $(date))
if [[ -f "$functions_file" ]]; then
    source "$functions_file"
else
    echo "Warning: Histofy shell functions not found at: $functions_file"
fi
# End Histofy v3
EOF
    
    log_success "Shell integration installed successfully"
    log_info "Config file: $config_file"
    log_info "Functions file: $functions_file"
    
    return 0
}

create_shell_functions() {
    local functions_file="$1"
    local shell_type="$2"
    
    cat > "$functions_file" << 'EOF'
#!/bin/bash
# Histofy v3 - Enhanced Shell Functions
# Advanced shell integration with validation and error handling

# Color definitions
readonly HC_RED='\033[0;31m'
readonly HC_GREEN='\033[0;32m'
readonly HC_YELLOW='\033[1;33m'
readonly HC_BLUE='\033[0;34m'
readonly HC_CYAN='\033[0;36m'
readonly HC_GRAY='\033[0;37m'
readonly HC_NC='\033[0m'

# Enhanced validation functions
validate_histofy_date() {
    local date="$1"
    
    # Check format
    if [[ ! "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo -e "${HC_RED}Error: Invalid date format. Use YYYY-MM-DD${HC_NC}" >&2
        return 1
    fi
    
    # Check if date is valid
    if ! date -j -f "%Y-%m-%d" "$date" >/dev/null 2>&1; then
        echo -e "${HC_RED}Error: Invalid date: $date${HC_NC}" >&2
        return 1
    fi
    
    # Check if date is reasonable (not too far in past/future)
    local date_epoch
    date_epoch=$(date -j -f "%Y-%m-%d" "$date" "+%s" 2>/dev/null)
    local now_epoch
    now_epoch=$(date "+%s")
    local ten_years_ago
    ten_years_ago=$((now_epoch - 315360000)) # 10 years in seconds
    local one_day_future
    one_day_future=$((now_epoch + 86400)) # 1 day in seconds
    
    if [[ "$date_epoch" -lt "$ten_years_ago" ]]; then
        echo -e "${HC_YELLOW}Warning: Date is more than 10 years in the past${HC_NC}" >&2
    elif [[ "$date_epoch" -gt "$one_day_future" ]]; then
        echo -e "${HC_YELLOW}Warning: Date is in the future${HC_NC}" >&2
    fi
    
    return 0
}

validate_histofy_time() {
    local time="$1"
    
    if [[ ! "$time" =~ ^([01]?[0-9]|2[0-3]):[0-5][0-9]$ ]]; then
        echo -e "${HC_RED}Error: Invalid time format. Use HH:MM (e.g., 14:30)${HC_NC}" >&2
        return 1
    fi
    
    return 0
}

validate_histofy_message() {
    local message="$1"
    
    # Check for dangerous characters
    if [[ "$message" =~ [;&\|`\$\(\)\{\}\[\]\\<>] ]]; then
        echo -e "${HC_RED}Error: Commit message contains potentially dangerous characters${HC_NC}" >&2
        return 1
    fi
    
    # Check length
    if [[ ${#message} -lt 3 ]]; then
        echo -e "${HC_RED}Error: Commit message too short (minimum 3 characters)${HC_NC}" >&2
        return 1
    fi
    
    if [[ ${#message} -gt 100 ]]; then
        echo -e "${HC_RED}Error: Commit message too long (maximum 100 characters)${HC_NC}" >&2
        return 1
    fi
    
    # Check for empty or whitespace-only message
    if [[ "$message" =~ ^[[:space:]]*$ ]]; then
        echo -e "${HC_RED}Error: Commit message cannot be empty or whitespace only${HC_NC}" >&2
        return 1
    fi
    
    return 0
}

# Enhanced commit functions
hc() {
    local message="$1"
    local date="$2"
    local time="${3:-12:00}"
    
    if [[ $# -lt 2 ]]; then
        echo -e "${HC_YELLOW}Usage: hc <message> <date> [time]${HC_NC}"
        echo -e "${HC_GRAY}Example: hc 'Fix authentication bug' 2023-12-25 14:30${HC_NC}"
        return 1
    fi
    
    # Validate inputs
    validate_histofy_message "$message" || return 1
    validate_histofy_date "$date" || return 1
    validate_histofy_time "$time" || return 1
    
    # Execute command
    echo -e "${HC_CYAN}Executing: histofy commit \"$message\" --date $date --time $time --add-all${HC_NC}"
    histofy commit "$message" --date "$date" --time "$time" --add-all
}

# Quick commit with push
hcp() {
    local message="$1"
    local date="$2"
    local time="${3:-12:00}"
    
    if [[ $# -lt 2 ]]; then
        echo -e "${HC_YELLOW}Usage: hcp <message> <date> [time]${HC_NC}"
        echo -e "${HC_GRAY}Example: hcp 'Deploy to production' 2023-12-25 14:30${HC_NC}"
        return 1
    fi
    
    # Validate inputs
    validate_histofy_message "$message" || return 1
    validate_histofy_date "$date" || return 1
    validate_histofy_time "$time" || return 1
    
    # Execute command with push
    echo -e "${HC_CYAN}Executing: histofy commit \"$message\" --date $date --time $time --add-all --push${HC_NC}"
    histofy commit "$message" --date "$date" --time "$time" --add-all --push
}

# Enhanced status function
hs() {
    local args=()
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--remote)
                args+=("--remote")
                shift
                ;;
            -v|--verbose)
                args+=("--verbose")
                shift
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done
    
    histofy status "${args[@]}"
}

# Interactive commit
hci() {
    histofy commit
}

# Show help
hh() {
    if [[ $# -eq 0 ]]; then
        echo -e "${HC_BLUE}🎉 Histofy v3 Shell Integration${HC_NC}"
        echo ""
        echo -e "${HC_CYAN}Quick Commands:${HC_NC}"
        echo -e "${HC_GREEN}  hc <msg> <date> [time]  ${HC_GRAY}- Quick commit with date${HC_NC}"
        echo -e "${HC_GREEN}  hcp <msg> <date> [time] ${HC_GRAY}- Quick commit with push${HC_NC}"
        echo -e "${HC_GREEN}  hs [-r] [-v]            ${HC_GRAY}- Show status${HC_NC}"
        echo -e "${HC_GREEN}  hci                     ${HC_GRAY}- Interactive commit${HC_NC}"
        echo -e "${HC_GREEN}  hh [command]            ${HC_GRAY}- Show help${HC_NC}"
        echo ""
        echo -e "${HC_CYAN}Examples:${HC_NC}"
        echo -e "${HC_YELLOW}  hc 'Fix authentication bug' 2023-12-25 14:30${HC_NC}"
        echo -e "${HC_YELLOW}  hcp 'Deploy hotfix' 2023-12-25${HC_NC}"
        echo -e "${HC_YELLOW}  hs --remote${HC_NC}"
        echo ""
        echo -e "${HC_GRAY}For full help: histofy --help${HC_NC}"
    else
        histofy help "$@"
    fi
}

# Batch commit functions
hcb() {
    local base_message="$1"
    local date="$2"
    local count="${3:-5}"
    local start_time="${4:-09:00}"
    
    if [[ $# -lt 2 ]]; then
        echo -e "${HC_YELLOW}Usage: hcb <base_message> <date> [count] [start_time]${HC_NC}"
        echo -e "${HC_GRAY}Example: hcb 'Daily work' 2023-12-25 5 09:00${HC_NC}"
        return 1
    fi
    
    validate_histofy_date "$date" || return 1
    validate_histofy_time "$start_time" || return 1
    
    echo -e "${HC_CYAN}Creating $count commits for $date starting at $start_time${HC_NC}"
    
    for ((i=1; i<=count; i++)); do
        local message="$base_message - Part $i"
        local time_offset=$((i * 60)) # 1 hour between commits
        local commit_time
        commit_time=$(date -j -f "%H:%M" -v "+${time_offset}M" "$start_time" "+%H:%M" 2>/dev/null || echo "$start_time")
        
        echo -e "${HC_BLUE}Creating commit $i/$count: $message at $commit_time${HC_NC}"
        histofy commit "$message" --date "$date" --time "$commit_time" --add-all
        
        sleep 1 # Brief pause between commits
    done
}

# Commit for yesterday
hcy() {
    local message="$1"
    local time="${2:-15:30}"
    
    if [[ $# -lt 1 ]]; then
        echo -e "${HC_YELLOW}Usage: hcy <message> [time]${HC_NC}"
        echo -e "${HC_GRAY}Example: hcy 'Yesterday work' 15:30${HC_NC}"
        return 1
    fi
    
    local yesterday
    yesterday=$(date -j -v-1d "+%Y-%m-%d" 2>/dev/null || date -d "yesterday" "+%Y-%m-%d" 2>/dev/null)
    
    hc "$message" "$yesterday" "$time"
}

# Commit for N days ago
hcw() {
    local message="$1"
    local days_ago="${2:-7}"
    local time="${3:-10:00}"
    
    if [[ $# -lt 1 ]]; then
        echo -e "${HC_YELLOW}Usage: hcw <message> [days_ago] [time]${HC_NC}"
        echo -e "${HC_GRAY}Example: hcw 'Last week work' 7 10:00${HC_NC}"
        return 1
    fi
    
    local target_date
    target_date=$(date -j -v-"${days_ago}"d "+%Y-%m-%d" 2>/dev/null || date -d "$days_ago days ago" "+%Y-%m-%d" 2>/dev/null)
    
    hc "$message" "$target_date" "$time"
}

# Git repository health check
hhealth() {
    echo -e "${HC_BLUE}🏥 Repository Health Check${HC_NC}"
    echo ""
    
    # Check if in git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo -e "${HC_RED}❌ Not in a Git repository${HC_NC}"
        return 1
    fi
    
    # Check repository status
    echo -e "${HC_CYAN}Repository Status:${HC_NC}"
    histofy status
    
    echo ""
    echo -e "${HC_CYAN}Git Status:${HC_NC}"
    git status --short
    
    echo ""
    echo -e "${HC_CYAN}Recent Commits:${HC_NC}"
    git log --oneline -5
    
    echo ""
    echo -e "${HC_CYAN}Branch Information:${HC_NC}"
    git branch -vv
}

# Performance monitoring shortcut
hperf() {
    local action="${1:-summary}"
    
    case "$action" in
        on|enable)
            histofy performance --enable
            ;;
        off|disable)
            histofy performance --disable
            ;;
        summary|s)
            histofy performance --summary
            ;;
        report|r)
            histofy performance --report
            ;;
        *)
            echo -e "${HC_YELLOW}Usage: hperf [on|off|summary|report]${HC_NC}"
            echo -e "${HC_GRAY}Examples:${HC_NC}"
            echo -e "${HC_GRAY}  hperf on      # Enable monitoring${HC_NC}"
            echo -e "${HC_GRAY}  hperf summary # Show summary${HC_NC}"
            ;;
    esac
}

echo -e "${HC_GREEN}✅ Histofy v3 shell functions loaded! Type 'hh' for help.${HC_NC}"
EOF

    chmod +x "$functions_file"
    log_success "Shell functions created: $functions_file"
}

install_completion() {
    local shell_type
    shell_type=$(detect_shell)
    local functions_file="$1"
    
    log_progress "Installing auto-completion for $shell_type..."
    
    case "$shell_type" in
        bash)
            install_bash_completion "$functions_file"
            ;;
        zsh)
            install_zsh_completion "$functions_file"
            ;;
        fish)
            install_fish_completion
            ;;
        *)
            log_warning "Auto-completion not supported for shell: $shell_type"
            return 1
            ;;
    esac
}

install_bash_completion() {
    local functions_file="$1"
    
    cat >> "$functions_file" << 'EOF'

# Histofy Bash Completion
_histofy_completion() {
    local cur prev opts commands
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    commands="commit config migrate status batch analyze performance audit help undo export import"
    global_opts="--help --version --verbose --no-banner --profile --perf-summary"
    
    case "${prev}" in
        histofy)
            COMPREPLY=( $(compgen -W "${commands} ${global_opts}" -- ${cur}) )
            return 0
            ;;
        commit)
            opts="--date --time --author --add-all --push --dry-run"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        config)
            opts="init get set list validate --dry-run"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        status)
            opts="--remote --verbose"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        migrate)
            opts="--to-date --time-offset --force --dry-run"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        performance)
            opts="--enable --disable --summary --report --export --output"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        audit)
            opts="--list --search --user --type --verify --stats --compliance --rules"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        help)
            opts="examples tutorial tutorials troubleshooting faq"
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
    esac
}

complete -F _histofy_completion histofy
complete -F _histofy_completion hc
complete -F _histofy_completion hcp
complete -F _histofy_completion hs
EOF

    log_success "Bash completion installed"
}

install_zsh_completion() {
    local functions_file="$1"
    
    cat >> "$functions_file" << 'EOF'

# Histofy Zsh Completion
if [[ -n "${ZSH_VERSION:-}" ]]; then
    autoload -U compinit
    compinit
    
    _histofy() {
        local context state line
        typeset -A opt_args
        
        _arguments \
            '--help[Show help]' \
            '--version[Show version]' \
            '--verbose[Enable verbose output]' \
            '--no-banner[Disable ASCII banner]' \
            '--profile[Enable performance profiling]' \
            '--perf-summary[Show performance summary]' \
            '1: :->commands' \
            '*: :->args'
        
        case $state in
            commands)
                _values 'histofy commands' \
                    'commit[Create commits with custom dates]' \
                    'config[Manage configuration]' \
                    'migrate[Migrate existing commits]' \
                    'status[Show repository status]' \
                    'batch[Batch operations]' \
                    'analyze[Repository analysis]' \
                    'performance[Performance monitoring]' \
                    'audit[Audit and compliance]' \
                    'help[Show help]' \
                    'undo[Undo operations]' \
                    'export[Export data]' \
                    'import[Import data]'
                ;;
            args)
                case $words[2] in
                    commit)
                        _arguments \
                            '--date[Custom date (YYYY-MM-DD)]' \
                            '--time[Custom time (HH:MM)]' \
                            '--author[Custom author]' \
                            '--add-all[Add all changes]' \
                            '--push[Push after commit]' \
                            '--dry-run[Preview only]'
                        ;;
                    config)
                        _values 'config actions' 'init' 'get' 'set' 'list' 'validate'
                        ;;
                    status)
                        _arguments \
                            '--remote[Include remote info]' \
                            '--verbose[Verbose output]'
                        ;;
                esac
                ;;
        esac
    }
    
    compdef _histofy histofy
    compdef _histofy hc
    compdef _histofy hcp
    compdef _histofy hs
fi
EOF

    log_success "Zsh completion installed"
}