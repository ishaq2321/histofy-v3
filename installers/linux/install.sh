#!/bin/bash
# Histofy v3 - Enhanced Linux Installer
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
SYSTEM_WIDE=false

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
if [[ "${TERM:-}" == "dumb" ]] || [[ "${CI:-}" == "true" ]] || [[ "${DISPLAY:-}" == "" ]]; then
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
}log_w
arning() {
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

# Linux distribution detection
detect_linux_distro() {
    local distro="Unknown"
    local version="Unknown"
    local package_manager=""
    
    # Check /etc/os-release first (most modern distributions)
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        distro="$NAME"
        version="$VERSION_ID"
    elif [[ -f /etc/lsb-release ]]; then
        source /etc/lsb-release
        distro="$DISTRIB_ID"
        version="$DISTRIB_RELEASE"
    elif [[ -f /etc/debian_version ]]; then
        distro="Debian"
        version=$(cat /etc/debian_version)
    elif [[ -f /etc/redhat-release ]]; then
        distro=$(cat /etc/redhat-release | cut -d' ' -f1)
        version=$(cat /etc/redhat-release | grep -oE '[0-9]+\.[0-9]+')
    elif [[ -f /etc/arch-release ]]; then
        distro="Arch Linux"
        version="Rolling"
    fi
    
    # Detect package manager
    if command -v apt >/dev/null 2>&1; then
        package_manager="apt"
    elif command -v yum >/dev/null 2>&1; then
        package_manager="yum"
    elif command -v dnf >/dev/null 2>&1; then
        package_manager="dnf"
    elif command -v pacman >/dev/null 2>&1; then
        package_manager="pacman"
    elif command -v zypper >/dev/null 2>&1; then
        package_manager="zypper"
    elif command -v apk >/dev/null 2>&1; then
        package_manager="apk"
    fi
    
    echo "$distro|$version|$package_manager"
}detec
t_system() {
    local system_info=""
    
    # Get distribution info
    local distro_info
    distro_info=$(detect_linux_distro)
    local distro
    distro=$(echo "$distro_info" | cut -d'|' -f1)
    local version
    version=$(echo "$distro_info" | cut -d'|' -f2)
    local pkg_mgr
    pkg_mgr=$(echo "$distro_info" | cut -d'|' -f3)
    
    system_info="OS: $distro $version"
    
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
    
    # Add package manager info
    if [[ -n "$pkg_mgr" ]]; then
        system_info="$system_info, Package Manager: $pkg_mgr"
    fi
    
    # Check if running in container
    if [[ -f /.dockerenv ]] || [[ -n "${container:-}" ]]; then
        system_info="$system_info, Environment: Container"
    fi
    
    echo "$system_info"
}

check_linux_compatibility() {
    local distro_info
    distro_info=$(detect_linux_distro)
    local distro
    distro=$(echo "$distro_info" | cut -d'|' -f1)
    local version
    version=$(echo "$distro_info" | cut -d'|' -f2)
    
    log_progress "Checking Linux compatibility..."
    
    # Check for supported distributions
    case "$distro" in
        "Ubuntu")
            if [[ "$version" < "18.04" ]]; then
                log_error "Ubuntu 18.04 or later required (found: $version)"
                return 1
            fi
            ;;
        "Debian GNU/Linux")
            if [[ "$version" < "10" ]]; then
                log_error "Debian 10 or later required (found: $version)"
                return 1
            fi
            ;;
        "CentOS Linux")
            if [[ "$version" < "7" ]]; then
                log_error "CentOS 7 or later required (found: $version)"
                return 1
            fi
            ;;
        "Red Hat Enterprise Linux")
            if [[ "$version" < "7" ]]; then
                log_error "RHEL 7 or later required (found: $version)"
                return 1
            fi
            ;;
        "Fedora")
            if [[ "$version" < "30" ]]; then
                log_error "Fedora 30 or later required (found: $version)"
                return 1
            fi
            ;;
        "Arch Linux")
            # Arch is rolling release, assume compatible
            ;;
        "openSUSE"*)
            # openSUSE versions are complex, assume compatible if detected
            ;;
        *)
            log_warning "Unsupported distribution: $distro $version"
            log_warning "Installation may work but is not officially supported"
            ;;
    esac
    
    # Check architecture
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)
            log_debug "Architecture: $arch (supported)"
            ;;
        aarch64|arm64)
            log_debug "Architecture: $arch (supported)"
            ;;
        *)
            log_warning "Unsupported architecture: $arch"
            log_warning "Installation may not work properly"
            ;;
    esac
    
    log_success "Linux compatibility check passed"
    return 0
}version_comp
are() {
    local version1="$1"
    local version2="$2"
    
    # Simple version comparison
    if [[ "$version1" == "$version2" ]]; then
        return 0
    fi
    
    local IFS=.
    local i ver1=($version1) ver2=($version2)
    
    # Fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2
        fi
    done
    return 0
}

check_prerequisites() {
    log_progress "Checking prerequisites..."
    
    local missing_deps=()
    local package_manager=""
    
    # Detect package manager
    local distro_info
    distro_info=$(detect_linux_distro)
    package_manager=$(echo "$distro_info" | cut -d'|' -f3)
    
    if [[ -z "$package_manager" ]]; then
        log_error "Could not detect package manager"
        echo "error:unknown"
        return 1
    fi
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version
        node_version=$(node --version 2>/dev/null | sed 's/v//' || echo "0.0.0")
        version_compare "$node_version" "$MIN_NODE_VERSION"
        local node_cmp=$?
        
        if [[ $node_cmp -eq 2 ]]; then
            log_error "Node.js v$MIN_NODE_VERSION+ required (found: v$node_version)"
            missing_deps+=("nodejs")
        else
            log_success "Node.js v$node_version detected"
        fi
    else
        log_error "Node.js not found"
        missing_deps+=("nodejs")
    fi
    
    # Check npm or yarn
    if command -v npm >/dev/null 2>&1; then
        local npm_version
        npm_version=$(npm --version 2>/dev/null || echo "0.0.0")
        log_success "npm v$npm_version detected"
    elif command -v yarn >/dev/null 2>&1; then
        local yarn_version
        yarn_version=$(yarn --version 2>/dev/null || echo "0.0.0")
        log_success "Yarn v$yarn_version detected"
    else
        log_error "Neither npm nor yarn found"
        missing_deps+=("npm")
    fi   
 # Check Git
    if command -v git >/dev/null 2>&1; then
        local git_version
        git_version=$(git --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || echo "0.0.0")
        version_compare "$git_version" "$MIN_GIT_VERSION"
        local git_cmp=$?
        
        if [[ $git_cmp -eq 2 ]]; then
            log_error "Git v$MIN_GIT_VERSION+ required (found: v$git_version)"
            missing_deps+=("git")
        else
            log_success "Git v$git_version detected"
        fi
    else
        log_error "Git not found"
        missing_deps+=("git")
    fi
    
    # Check shell compatibility
    local shell_name
    shell_name=$(basename "${SHELL:-/bin/bash}")
    
    case "$shell_name" in
        bash)
            local bash_version
            bash_version=$(bash --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+' | head -n1 || echo "0.0")
            version_compare "$bash_version" "$MIN_BASH_VERSION"
            local bash_cmp=$?
            
            if [[ $bash_cmp -eq 2 ]]; then
                log_error "Bash v$MIN_BASH_VERSION+ required (found: v$bash_version)"
                missing_deps+=("bash")
            else
                log_success "Bash v$bash_version detected"
            fi
            ;;
        zsh)
            local zsh_version
            zsh_version=$(zsh --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -n1 || echo "0.0")
            version_compare "$zsh_version" "$MIN_ZSH_VERSION"
            local zsh_cmp=$?
            
            if [[ $zsh_cmp -eq 2 ]]; then
                log_error "Zsh v$MIN_ZSH_VERSION+ required (found: v$zsh_version)"
                missing_deps+=("zsh")
            else
                log_success "Zsh v$zsh_version detected"
            fi
            ;;
        *)
            log_warning "Unsupported shell: $shell_name"
            log_warning "Bash or Zsh recommended for full functionality"
            ;;
    esac
    
    # Check for curl or wget
    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        log_error "Either curl or wget required for downloads"
        missing_deps+=("curl")
    fi    
# Handle missing dependencies
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        
        if [[ "$SILENT" == "false" ]]; then
            log_info "To install missing dependencies:"
            
            case "$package_manager" in
                apt)
                    echo "  sudo apt update && sudo apt install -y ${missing_deps[*]}"
                    ;;
                yum)
                    echo "  sudo yum install -y ${missing_deps[*]}"
                    ;;
                dnf)
                    echo "  sudo dnf install -y ${missing_deps[*]}"
                    ;;
                pacman)
                    echo "  sudo pacman -S ${missing_deps[*]}"
                    ;;
                zypper)
                    echo "  sudo zypper install ${missing_deps[*]}"
                    ;;
                apk)
                    echo "  sudo apk add ${missing_deps[*]}"
                    ;;
                *)
                    echo "  Use your system's package manager to install: ${missing_deps[*]}"
                    ;;
            esac
        fi
        
        echo "error:$package_manager"
        return 1
    fi
    
    log_success "All prerequisites satisfied"
    echo "success:$package_manager"
    return 0
}

detect_shell() {
    local shell_name
    shell_name=$(basename "${SHELL:-/bin/bash}")
    echo "$shell_name"
}

get_shell_config_file() {
    local shell_type="$1"
    local config_file=""
    
    case "$shell_type" in
        bash)
            if [[ -f "$HOME/.bashrc" ]]; then
                config_file="$HOME/.bashrc"
            elif [[ -f "$HOME/.bash_profile" ]]; then
                config_file="$HOME/.bash_profile"
            else
                config_file="$HOME/.bashrc"
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
}install_hi
stofy_cli() {
    local package_manager="$1"
    
    log_progress "Installing Histofy CLI..."
    
    # Check if already installed
    if command -v histofy >/dev/null 2>&1 && [[ "$UPDATE_ONLY" == "false" ]]; then
        local current_version
        current_version=$(histofy --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "Unknown")
        
        if [[ "$FORCE" == "false" ]]; then
            log_warning "Histofy CLI already installed (v$current_version)"
            echo -n "Update to v$HISTOFY_VERSION? (y/N): "
            read -r update_choice
            if [[ "$update_choice" != "y" ]] && [[ "$update_choice" != "Y" ]]; then
                log_info "Skipping CLI installation"
                return 0
            fi
        fi
    fi
    
    # Install via npm or yarn
    local install_cmd=""
    local install_success=false
    
    if command -v npm >/dev/null 2>&1; then
        if [[ "$DEV_MODE" == "true" ]]; then
            install_cmd="npm install -g ."
        else
            install_cmd="npm install -g histofy-cli@$HISTOFY_VERSION"
        fi
        
        log_debug "Running: $install_cmd"
        if eval "$install_cmd" >/dev/null 2>&1; then
            install_success=true
        fi
    elif command -v yarn >/dev/null 2>&1; then
        if [[ "$DEV_MODE" == "true" ]]; then
            install_cmd="yarn global add file:$(pwd)"
        else
            install_cmd="yarn global add histofy-cli@$HISTOFY_VERSION"
        fi
        
        log_debug "Running: $install_cmd"
        if eval "$install_cmd" >/dev/null 2>&1; then
            install_success=true
        fi
    fi
    
    if [[ "$install_success" == "true" ]]; then
        # Verify installation
        if command -v histofy >/dev/null 2>&1; then
            local installed_version
            installed_version=$(histofy --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "Unknown")
            log_success "Histofy CLI v$installed_version installed successfully"
            return 0
        else
            log_error "CLI installation verification failed"
            return 1
        fi
    else
        log_error "CLI installation failed"
        return 1
    fi
}cr
eate_shell_functions() {
    local functions_file="$1"
    
    cat > "$functions_file" << 'EOF'
#!/bin/bash
# Histofy v3 - Enhanced Shell Functions
# Auto-generated by installer - do not edit manually

# Quick commit with custom date
hc() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: hc <message> [date] [time]"
        echo "Examples:"
        echo "  hc 'Fix bug' 2023-12-25"
        echo "  hc 'Add feature' 2023-12-25 14:30"
        return 1
    fi
    
    local message="$1"
    local date="$2"
    local time="$3"
    
    local cmd="histofy commit '$message'"
    
    if [[ -n "$date" ]]; then
        cmd="$cmd --date '$date'"
    fi
    
    if [[ -n "$time" ]]; then
        cmd="$cmd --time '$time'"
    fi
    
    eval "$cmd"
}

# Quick commit with push
hcp() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: hcp <message> [date] [time]"
        echo "Examples:"
        echo "  hcp 'Deploy fix' 2023-12-25"
        echo "  hcp 'Release v1.0' 2023-12-25 16:00"
        return 1
    fi
    
    local message="$1"
    local date="$2"
    local time="$3"
    
    local cmd="histofy commit '$message' --push"
    
    if [[ -n "$date" ]]; then
        cmd="$cmd --date '$date'"
    fi
    
    if [[ -n "$time" ]]; then
        cmd="$cmd --time '$time'"
    fi
    
    eval "$cmd"
}

# Quick status
hs() {
    histofy status "$@"
}

# Interactive commit
hci() {
    histofy commit --interactive "$@"
}

# Quick help
hh() {
    if [[ $# -eq 0 ]]; then
        histofy help
    else
        histofy help "$@"
    fi
}
EOF

    chmod +x "$functions_file"
    log_success "Shell functions created: $functions_file"
}in
stall_shell_integration() {
    log_progress "Installing shell integration..."
    
    local shell_type
    shell_type=$(detect_shell)
    local config_file
    config_file=$(get_shell_config_file "$shell_type")
    
    # Create functions file
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local functions_file="$script_dir/histofy-functions.sh"
    
    create_shell_functions "$functions_file"
    
    # Create config directory if it doesn't exist
    local config_dir
    config_dir=$(dirname "$config_file")
    if [[ ! -d "$config_dir" ]]; then
        mkdir -p "$config_dir"
    fi
    
    # Create config file if it doesn't exist
    if [[ ! -f "$config_file" ]]; then
        touch "$config_file"
    fi
    
    # Check if already integrated
    if grep -q "Histofy v3" "$config_file"; then
        if [[ "$FORCE" == "false" ]]; then
            log_warning "Shell integration already exists"
            echo -n "Update integration? (y/N): "
            read -r update_integration
            if [[ "$update_integration" != "y" ]] && [[ "$update_integration" != "Y" ]]; then
                log_info "Skipping shell integration"
                return 0
            fi
        fi
        
        # Remove existing integration
        sed -i '/# Histofy v3/,/# End Histofy v3/d' "$config_file"
    fi
    
    # Add integration
    cat >> "$config_file" << EOF

# Histofy v3 - Enhanced Git History Management
# Auto-generated by installer - do not edit manually
export HISTOFY_VERSION="$HISTOFY_VERSION"
export HISTOFY_SHELL="$shell_type"

# Load Histofy functions
if [[ -f "$functions_file" ]]; then
    source "$functions_file"
fi

# Histofy aliases and shortcuts
alias histofy-version='histofy --version'
alias histofy-help='histofy help'
alias histofy-status='histofy status'
alias histofy-config='histofy config'

# Enhanced Git aliases with Histofy integration
alias gch='histofy commit'
alias gcs='histofy status'
alias gca='histofy analyze'
alias gcb='histofy batch'

# Auto-completion setup
if [[ "$shell_type" == "bash" ]] && command -v complete >/dev/null 2>&1; then
    # Basic bash completion
    complete -W "commit config migrate status batch analyze performance audit help undo export import" histofy
fi

# End Histofy v3
EOF

    log_success "Shell integration installed for $shell_type"
    log_info "Configuration updated: $config_file"
    
    return 0
}i
nstall_completion() {
    local functions_file="$1"
    
    log_progress "Installing auto-completion..."
    
    local shell_type
    shell_type=$(detect_shell)
    
    case "$shell_type" in
        bash)
            install_bash_completion "$functions_file"
            ;;
        zsh)
            install_zsh_completion
            ;;
        fish)
            install_fish_completion
            ;;
        *)
            log_warning "Auto-completion not supported for $shell_type"
            return 1
            ;;
    esac
    
    return 0
}

install_bash_completion() {
    local functions_file="$1"
    
    # Check for bash-completion
    local completion_dir=""
    
    if [[ -d "/usr/share/bash-completion/completions" ]]; then
        completion_dir="/usr/share/bash-completion/completions"
    elif [[ -d "/etc/bash_completion.d" ]]; then
        completion_dir="/etc/bash_completion.d"
    elif [[ -d "$HOME/.bash_completion.d" ]]; then
        completion_dir="$HOME/.bash_completion.d"
    else
        # Create user completion directory
        completion_dir="$HOME/.bash_completion.d"
        mkdir -p "$completion_dir"
    fi
    
    local completion_file="$completion_dir/histofy"
    
    # Create completion script
    cat > "$completion_file" << 'EOF'
# Histofy Bash Completion

_histofy_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    local commands="commit config migrate status batch analyze performance audit help undo export import"
    
    # Global options
    local global_opts="--help --version --verbose --no-banner --profile --perf-summary"
    
    if [[ ${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=($(compgen -W "${commands} ${global_opts}" -- ${cur}))
        return 0
    fi
    
    case "${COMP_WORDS[1]}" in
        commit)
            local commit_opts="--date --time --author --add-all --push --dry-run --interactive"
            COMPREPLY=($(compgen -W "${commit_opts}" -- ${cur}))
            ;;
        config)
            local config_opts="init get set list validate reset"
            COMPREPLY=($(compgen -W "${config_opts}" -- ${cur}))
            ;;
        status)
            local status_opts="--remote --verbose --json"
            COMPREPLY=($(compgen -W "${status_opts}" -- ${cur}))
            ;;
        performance)
            local perf_opts="--enable --disable --summary --report --reset"
            COMPREPLY=($(compgen -W "${perf_opts}" -- ${cur}))
            ;;
        help)
            local help_topics="examples tutorial tutorials troubleshooting faq"
            COMPREPLY=($(compgen -W "${help_topics}" -- ${cur}))
            ;;
        *)
            COMPREPLY=($(compgen -W "${global_opts}" -- ${cur}))
            ;;
    esac
}

complete -F _histofy_completion histofy
EOF

    log_success "Bash completion installed: $completion_file"
}install
_zsh_completion() {
    local zsh_completions_dir=""
    
    # Find zsh completions directory
    if [[ -n "${fpath[1]}" ]]; then
        # Use first directory in fpath that's writable
        for dir in $fpath; do
            if [[ -w "$dir" ]] || [[ "$dir" == *"$HOME"* ]]; then
                zsh_completions_dir="$dir"
                break
            fi
        done
    fi
    
    # Fallback to user directory
    if [[ -z "$zsh_completions_dir" ]]; then
        zsh_completions_dir="$HOME/.zsh/completions"
        mkdir -p "$zsh_completions_dir"
        
        # Add to fpath if not already there
        local zshrc="$HOME/.zshrc"
        if [[ -f "$zshrc" ]] && ! grep -q "$zsh_completions_dir" "$zshrc"; then
            echo "fpath=(\"$zsh_completions_dir\" \$fpath)" >> "$zshrc"
            echo "autoload -U compinit && compinit" >> "$zshrc"
        fi
    fi
    
    cat > "$zsh_completions_dir/_histofy" << 'EOF'
#compdef histofy

# Histofy Zsh Completion

_histofy() {
    local context state line
    typeset -A opt_args
    
    _arguments -C \
        '(-h --help)'{-h,--help}'[Show help message]' \
        '(-v --version)'{-v,--version}'[Show version information]' \
        '--verbose[Enable verbose output]' \
        '--no-banner[Disable ASCII banner]' \
        '--profile[Enable performance profiling]' \
        '--perf-summary[Show performance summary]' \
        '1: :_histofy_commands' \
        '*:: :->args'
    
    case $state in
        args)
            case $words[1] in
                commit)
                    _arguments \
                        '(-d --date)'{-d,--date}'[Custom date (YYYY-MM-DD)]:date:' \
                        '(-t --time)'{-t,--time}'[Custom time (HH:MM)]:time:' \
                        '--author[Custom author]:author:' \
                        '(-a --add-all)'{-a,--add-all}'[Add all changes]' \
                        '--push[Push after commit]' \
                        '--dry-run[Preview only]' \
                        '--interactive[Interactive mode]'
                    ;;
                config)
                    _arguments '1: :(init get set list validate reset)'
                    ;;
                status)
                    _arguments \
                        '(-r --remote)'{-r,--remote}'[Include remote info]' \
                        '(-v --verbose)'{-v,--verbose}'[Verbose output]' \
                        '--json[JSON output]'
                    ;;
                performance)
                    _arguments \
                        '(-e --enable)'{-e,--enable}'[Enable monitoring]' \
                        '(-d --disable)'{-d,--disable}'[Disable monitoring]' \
                        '(-s --summary)'{-s,--summary}'[Show summary]' \
                        '(-r --report)'{-r,--report}'[Generate report]' \
                        '--reset[Reset statistics]'
                    ;;
                help)
                    _arguments '1: :(examples tutorial tutorials troubleshooting faq)'
                    ;;
            esac
            ;;
    esac
}

_histofy_commands() {
    local commands
    commands=(
        'commit:Create commits with custom dates'
        'config:Manage configuration'
        'migrate:Migrate existing commits'
        'status:Show repository status'
        'batch:Batch operations'
        'analyze:Repository analysis'
        'performance:Performance monitoring'
        'audit:Audit and compliance'
        'help:Show help'
        'undo:Undo operations'
        'export:Export data'
        'import:Import data'
    )
    
    _describe 'commands' commands
}

_histofy "$@"
EOF

    log_success "Zsh completion installed"
}i
nstall_fish_completion() {
    local fish_completions_dir="$HOME/.config/fish/completions"
    
    if [[ ! -d "$fish_completions_dir" ]]; then
        mkdir -p "$fish_completions_dir"
    fi
    
    cat > "$fish_completions_dir/histofy.fish" << 'EOF'
# Histofy Fish Completion

# Main command completions
complete -c histofy -f
complete -c histofy -s h -l help -d "Show help message"
complete -c histofy -s v -l version -d "Show version information"
complete -c histofy -l verbose -d "Enable verbose output"
complete -c histofy -l no-banner -d "Disable ASCII banner"
complete -c histofy -l profile -d "Enable performance profiling"
complete -c histofy -l perf-summary -d "Show performance summary"

# Subcommands
complete -c histofy -n "__fish_use_subcommand" -a "commit" -d "Create commits with custom dates"
complete -c histofy -n "__fish_use_subcommand" -a "config" -d "Manage configuration"
complete -c histofy -n "__fish_use_subcommand" -a "migrate" -d "Migrate existing commits"
complete -c histofy -n "__fish_use_subcommand" -a "status" -d "Show repository status"
complete -c histofy -n "__fish_use_subcommand" -a "batch" -d "Batch operations"
complete -c histofy -n "__fish_use_subcommand" -a "analyze" -d "Repository analysis"
complete -c histofy -n "__fish_use_subcommand" -a "performance" -d "Performance monitoring"
complete -c histofy -n "__fish_use_subcommand" -a "audit" -d "Audit and compliance"
complete -c histofy -n "__fish_use_subcommand" -a "help" -d "Show help"
complete -c histofy -n "__fish_use_subcommand" -a "undo" -d "Undo operations"
complete -c histofy -n "__fish_use_subcommand" -a "export" -d "Export data"
complete -c histofy -n "__fish_use_subcommand" -a "import" -d "Import data"

# Commit command options
complete -c histofy -n "__fish_seen_subcommand_from commit" -s d -l date -d "Custom date (YYYY-MM-DD)"
complete -c histofy -n "__fish_seen_subcommand_from commit" -s t -l time -d "Custom time (HH:MM)"
complete -c histofy -n "__fish_seen_subcommand_from commit" -l author -d "Custom author"
complete -c histofy -n "__fish_seen_subcommand_from commit" -s a -l add-all -d "Add all changes"
complete -c histofy -n "__fish_seen_subcommand_from commit" -l push -d "Push after commit"
complete -c histofy -n "__fish_seen_subcommand_from commit" -l dry-run -d "Preview only"

# Config command options
complete -c histofy -n "__fish_seen_subcommand_from config" -a "init get set list validate" -d "Config actions"

# Status command options
complete -c histofy -n "__fish_seen_subcommand_from status" -s r -l remote -d "Include remote info"
complete -c histofy -n "__fish_seen_subcommand_from status" -s v -l verbose -d "Verbose output"

# Performance command options
complete -c histofy -n "__fish_seen_subcommand_from performance" -s e -l enable -d "Enable monitoring"
complete -c histofy -n "__fish_seen_subcommand_from performance" -s d -l disable -d "Disable monitoring"
complete -c histofy -n "__fish_seen_subcommand_from performance" -s s -l summary -d "Show summary"
complete -c histofy -n "__fish_seen_subcommand_from performance" -s r -l report -d "Generate report"

# Help command options
complete -c histofy -n "__fish_seen_subcommand_from help" -a "examples tutorial tutorials troubleshooting faq"
EOF

    log_success "Fish completion installed"
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
}veri
fy_installation() {
    log_progress "Verifying installation..."
    
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
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
        log_success "Installation verification passed"
        return 0
    else
        log_error "Installation verification failed"
        printf '%s\n' "${issues[@]}"
        return 1
    fi
}

show_post_install_instructions() {
    echo ""
    log_success "🎉 Installation completed successfully!"
    echo ""
    
    log_info "📋 Next Steps:"
    echo ""
    
    # Shell reload
    local shell_type
    shell_type=$(detect_shell)
    local config_file
    config_file=$(get_shell_config_file "$shell_type")
    
    echo -e "${YELLOW}1.${NC} ${WHITE}Reload your shell configuration:${NC}"
    echo -e "   ${CYAN}source \"$config_file\"${NC}"
    echo -e "   ${GRAY}(or restart your terminal)${NC}"
    echo ""
    
    # Configuration setup
    echo -e "${YELLOW}2.${NC} ${WHITE}Initialize Histofy configuration:${NC}"
    echo -e "   ${CYAN}histofy config init${NC}"
    echo ""
    
    # GitHub token setup
    echo -e "${YELLOW}3.${NC} ${WHITE}Set your GitHub token (optional but recommended):${NC}"
    echo -e "   ${CYAN}histofy config set github.token YOUR_GITHUB_TOKEN${NC}"
    echo ""
    
    # Git defaults
    echo -e "${YELLOW}4.${NC} ${WHITE}Configure Git defaults:${NC}"
    echo -e "   ${CYAN}histofy config set git.defaultAuthor \"Your Name <email@example.com>\"${NC}"
    echo ""
    
    # Test installation
    echo -e "${YELLOW}5.${NC} ${WHITE}Test the installation:${NC}"
    echo -e "   ${CYAN}histofy status${NC}"
    echo -e "   ${CYAN}hh  # Show quick help${NC}"
    echo ""
    
    # Quick commands reference
    log_info "🚀 Quick Commands:"
    echo -e "   ${GREEN}hc${NC}   - Quick commit with date     ${GRAY}hc 'Fix bug' 2023-12-25 14:30${NC}"
    echo -e "   ${GREEN}hcp${NC}  - Quick commit with push     ${GRAY}hcp 'Deploy' 2023-12-25${NC}"
    echo -e "   ${GREEN}hs${NC}   - Show status               ${GRAY}hs --remote${NC}"
    echo -e "   ${GREEN}hci${NC}  - Interactive commit         ${GRAY}hci${NC}"
    echo -e "   ${GREEN}hh${NC}   - Show help                 ${GRAY}hh${NC}"
    echo ""
    
    log_info "📚 For more help:"
    echo -e "   ${CYAN}histofy help tutorials${NC}    # Interactive tutorials"
    echo -e "   ${CYAN}histofy help examples${NC}     # Command examples"
    echo -e "   ${CYAN}histofy help faq${NC}          # Frequently asked questions"
    echo ""
    
    log_success "Happy coding with Histofy! 🚀"
}s
how_help() {
    cat << EOF

╔══════════════════════════════════════════════════════════╗
║                 Histofy v3 Linux Installer              ║
║            Enhanced Bash/Zsh Cross-Platform Setup      ║
╚══════════════════════════════════════════════════════════╝

USAGE:
    ./install.sh [OPTIONS]

OPTIONS:
    -h, --help           Show this help message
    -v, --version        Show version information
    -s, --silent         Run in silent mode (minimal output)
    -f, --force          Force installation even if issues detected
    -d, --dev-mode       Install from local development project
    -u, --update-only    Only update existing installation

COMPONENT OPTIONS:
    --skip-cli           Skip CLI installation
    --skip-functions     Skip shell functions installation
    --skip-completion    Skip auto-completion setup

ADVANCED OPTIONS:
    --install-path PATH  Custom installation path
    --config-path PATH   Custom configuration path
    --system-wide        Install system-wide (requires sudo)

MAINTENANCE:
    --verify-only        Only verify existing installation
    --uninstall          Uninstall Histofy

EXAMPLES:
    ./install.sh                    # Standard installation
    ./install.sh --silent           # Silent installation
    ./install.sh --dev-mode         # Development installation
    ./install.sh --verify-only      # Verify installation
    ./install.sh --uninstall        # Remove Histofy

SYSTEM REQUIREMENTS:
    - Linux (Ubuntu 18.04+, Debian 10+, CentOS 7+, Fedora 30+, Arch)
    - Node.js v${MIN_NODE_VERSION}+
    - Git v${MIN_GIT_VERSION}+
    - Bash v${MIN_BASH_VERSION}+ or Zsh v${MIN_ZSH_VERSION}+

EOF
}

show_version() {
    cat << EOF

Histofy v3 Linux Installer
Version: $INSTALLER_VERSION
Target Histofy version: v$HISTOFY_VERSION

System Requirements:
  Node.js: v${MIN_NODE_VERSION}+
  Git: v${MIN_GIT_VERSION}+
  Bash: v${MIN_BASH_VERSION}+ or Zsh: v${MIN_ZSH_VERSION}+

Supported Shells: bash, zsh, fish

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                HELP=true
                shift
                ;;
            -v|--version)
                VERSION=true
                shift
                ;;
            -s|--silent)
                SILENT=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -d|--dev-mode)
                DEV_MODE=true
                shift
                ;;
            -u|--update-only)
                UPDATE_ONLY=true
                shift
                ;;
            --skip-cli)
                SKIP_CLI=true
                shift
                ;;
            --skip-functions)
                SKIP_FUNCTIONS=true
                shift
                ;;
            --skip-completion)
                SKIP_COMPLETION=true
                shift
                ;;
            --install-path)
                INSTALL_PATH="$2"
                shift 2
                ;;
            --config-path)
                CONFIG_PATH="$2"
                shift 2
                ;;
            --system-wide)
                SYSTEM_WIDE=true
                shift
                ;;
            --verify-only)
                VERIFY_ONLY=true
                shift
                ;;
            --uninstall)
                UNINSTALL=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}# Mai
n installation function
main() {
    # Parse arguments
    parse_args "$@"
    
    # Handle help and version
    if [[ "$HELP" == "true" ]]; then
        show_help
        exit 0
    fi
    
    if [[ "$VERSION" == "true" ]]; then
        show_version
        exit 0
    fi
    
    # Show banner (unless silent)
    if [[ "$SILENT" == "false" ]]; then
        echo ""
        echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║                 Histofy v3 Linux Installer              ║${NC}"
        echo -e "${BLUE}║            Enhanced Bash/Zsh Cross-Platform Setup      ║${NC}"
        echo -e "${BLUE}║                                                          ║${NC}"
        echo -e "${BLUE}║  Version: $(printf "%-47s" "$INSTALLER_VERSION") ║${NC}"
        echo -e "${BLUE}║  Target: $(printf "%-48s" "Histofy v$HISTOFY_VERSION") ║${NC}"
        echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
        echo ""
    fi
    
    # Handle uninstall
    if [[ "$UNINSTALL" == "true" ]]; then
        log_error "Uninstall functionality not yet implemented"
        exit 1
    fi
    
    # System detection and compatibility check
    log_progress "Detecting system..."
    local system_info
    system_info=$(detect_system)
    
    if [[ "$SILENT" == "false" ]]; then
        log_info "$system_info"
    fi
    
    # Check Linux compatibility
    if ! check_linux_compatibility; then
        if [[ "$FORCE" == "false" ]]; then
            log_error "System compatibility check failed. Use --force to bypass."
            exit 1
        else
            log_warning "Bypassing compatibility checks due to --force flag"
        fi
    fi
    
    # Check prerequisites
    local prereq_result
    prereq_result=$(check_prerequisites)
    local prereq_status
    prereq_status=$(echo "$prereq_result" | cut -d: -f1)
    local package_manager
    package_manager=$(echo "$prereq_result" | cut -d: -f2)
    
    if [[ "$prereq_status" != "success" ]]; then
        log_error "Prerequisites check failed"
        if [[ "$FORCE" == "false" ]]; then
            exit 1
        else
            log_warning "Continuing with --force flag despite missing prerequisites"
        fi
    fi
    
    # Verify only mode
    if [[ "$VERIFY_ONLY" == "true" ]]; then
        if verify_installation; then
            log_success "Installation verification passed"
            exit 0
        else
            log_error "Installation verification failed"
            exit 1
        fi
    fi
    
    # Installation process
    local installation_success=true
    
    # Install CLI
    if [[ "$SKIP_CLI" == "false" ]]; then
        if ! install_histofy_cli "$package_manager"; then
            installation_success=false
            if [[ "$FORCE" == "false" ]]; then
                log_error "CLI installation failed"
                exit 1
            fi
        fi
    fi
    
    # Install shell integration
    if [[ "$SKIP_FUNCTIONS" == "false" ]]; then
        if ! install_shell_integration; then
            installation_success=false
            log_warning "Shell integration installation failed"
        fi
    fi
    
    # Install auto-completion
    if [[ "$SKIP_COMPLETION" == "false" ]]; then
        local script_dir
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        local functions_file="$script_dir/histofy-functions.sh"
        
        if ! install_completion "$functions_file"; then
            log_warning "Auto-completion installation failed"
        fi
    fi
    
    # Verify installation
    if verify_installation; then
        show_post_install_instructions
    else
        log_warning "Installation completed with issues"
        installation_success=false
    fi
    
    if [[ "$installation_success" == "true" ]]; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function with all arguments
main "$@"