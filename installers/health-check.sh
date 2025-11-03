#!/bin/bash
# Histofy v3 - Health Check Script (Unix/Linux/macOS)
# Copyright (c) 2025 Ishaq (ishaq2321@proton.me)
# Licensed under MIT License

set -euo pipefail

# Configuration
readonly SCRIPT_VERSION="1.0.0"
readonly HISTOFY_VERSION="3.0.0"

# Colors and formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly GRAY='\033[0;37m'
readonly NC='\033[0m'

# Emoji support detection
EMOJI_SUPPORT=true
if [[ "${TERM:-}" == "dumb" ]] || [[ "${CI:-}" == "true" ]]; then
    EMOJI_SUPPORT=false
fi

# Output functions
log_info() {
    local icon="ℹ️"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[INFO]"
    echo -e "${CYAN}${icon} $1${NC}"
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

log_progress() {
    local icon="🔄"
    [[ "$EMOJI_SUPPORT" == "false" ]] && icon="[PROGRESS]"
    echo -e "${BLUE}${icon} $1${NC}"
}

# Health check functions
check_system_health() {
    log_progress "Checking system health..."
    
    local issues=()
    
    # Check disk space
    local disk_usage
    disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $disk_usage -gt 90 ]]; then
        issues+=("Disk usage is ${disk_usage}% (consider freeing space)")
    elif [[ $disk_usage -gt 80 ]]; then
        log_warning "Disk usage is ${disk_usage}% (monitor space)"
    else
        log_success "Disk usage: ${disk_usage}%"
    fi
    
    # Check memory usage
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        
        if [[ $mem_usage -gt 90 ]]; then
            issues+=("Memory usage is ${mem_usage}% (system may be slow)")
        elif [[ $mem_usage -gt 80 ]]; then
            log_warning "Memory usage is ${mem_usage}% (monitor performance)"
        else
            log_success "Memory usage: ${mem_usage}%"
        fi
    fi
    
    # Check load average (Linux/macOS)
    if command -v uptime >/dev/null 2>&1; then
        local load_avg
        load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        local cpu_cores
        cpu_cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "1")
        
        # Simple load check (load > cores * 2)
        if (( $(echo "$load_avg > $cpu_cores * 2" | bc -l 2>/dev/null || echo "0") )); then
            issues+=("High system load: $load_avg (cores: $cpu_cores)")
        else
            log_success "System load: $load_avg (cores: $cpu_cores)"
        fi
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "System health check passed"
        return 0
    else
        log_warning "System health issues detected:"
        printf '  %s\n' "${issues[@]}"
        return 1
    fi
}

check_git_health() {
    log_progress "Checking Git repository health..."
    
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        log_info "Not in a Git repository (skipping Git checks)"
        return 0
    fi
    
    local issues=()
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        issues+=("Uncommitted changes detected")
    fi
    
    # Check for untracked files
    local untracked_count
    untracked_count=$(git ls-files --others --exclude-standard | wc -l)
    if [[ $untracked_count -gt 0 ]]; then
        issues+=("$untracked_count untracked files")
    fi
    
    # Check repository size
    local repo_size
    repo_size=$(du -sh .git 2>/dev/null | cut -f1 || echo "unknown")
    log_info "Repository size: $repo_size"
    
    # Check for large files
    local large_files
    large_files=$(find . -type f -size +10M 2>/dev/null | grep -v '.git' | wc -l || echo "0")
    if [[ $large_files -gt 0 ]]; then
        issues+=("$large_files files larger than 10MB detected")
    fi
    
    # Check remote connectivity
    if git remote >/dev/null 2>&1; then
        local remote_name
        remote_name=$(git remote | head -n1)
        if [[ -n "$remote_name" ]]; then
            if git ls-remote "$remote_name" >/dev/null 2>&1; then
                log_success "Remote '$remote_name' is accessible"
            else
                issues+=("Remote '$remote_name' is not accessible")
            fi
        fi
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "Git repository health check passed"
        return 0
    else
        log_warning "Git repository issues detected:"
        printf '  %s\n' "${issues[@]}"
        return 1
    fi
}

check_histofy_health() {
    log_progress "Checking Histofy health..."
    
    local issues=()
    
    # Check CLI availability
    if ! command -v histofy >/dev/null 2>&1; then
        issues+=("Histofy CLI not found in PATH")
        log_error "Histofy CLI health check failed"
        return 1
    fi
    
    # Check version
    local histofy_version
    histofy_version=$(histofy --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    
    if [[ "$histofy_version" == "$HISTOFY_VERSION" ]]; then
        log_success "Histofy CLI v$histofy_version (latest)"
    elif [[ "$histofy_version" != "unknown" ]]; then
        issues+=("Histofy CLI v$histofy_version (expected v$HISTOFY_VERSION)")
    else
        issues+=("Could not determine Histofy version")
    fi
    
    # Check configuration
    if histofy config list >/dev/null 2>&1; then
        log_success "Histofy configuration system working"
        
        # Check critical configurations
        local git_author
        git_author=$(histofy config get git.defaultAuthor 2>/dev/null || echo "")
        if [[ -z "$git_author" ]]; then
            issues+=("Git default author not configured")
        else
            log_success "Git default author configured"
        fi
        
        # Check GitHub token (optional)
        local github_token
        github_token=$(histofy config get github.token 2>/dev/null || echo "")
        if [[ -z "$github_token" ]]; then
            log_info "GitHub token not configured (optional)"
        else
            log_success "GitHub token configured"
        fi
    else
        issues+=("Histofy configuration system not working")
    fi
    
    # Test basic functionality
    if git rev-parse --git-dir >/dev/null 2>&1; then
        # Test status command
        if histofy status >/dev/null 2>&1; then
            log_success "Histofy status command working"
        else
            issues+=("Histofy status command failed")
        fi
        
        # Test dry-run functionality
        if histofy commit "test" --dry-run >/dev/null 2>&1; then
            log_success "Histofy dry-run functionality working"
        else
            issues+=("Histofy dry-run functionality failed")
        fi
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "Histofy health check passed"
        return 0
    else
        log_warning "Histofy health issues detected:"
        printf '  %s\n' "${issues[@]}"
        return 1
    fi
}

check_shell_integration() {
    log_progress "Checking shell integration health..."
    
    local issues=()
    local shell_name
    shell_name=$(basename "${SHELL:-/bin/bash}")
    
    # Check shell configuration files
    local config_files=()
    case "$shell_name" in
        bash)
            config_files=("$HOME/.bashrc" "$HOME/.bash_profile")
            ;;
        zsh)
            config_files=("$HOME/.zshrc")
            ;;
        fish)
            config_files=("$HOME/.config/fish/config.fish")
            ;;
        *)
            config_files=("$HOME/.profile")
            ;;
    esac
    
    local integration_found=false
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]] && grep -q "Histofy v3" "$config_file"; then
            log_success "Shell integration found in $(basename "$config_file")"
            integration_found=true
            break
        fi
    done
    
    if [[ "$integration_found" == "false" ]]; then
        issues+=("No shell integration found in configuration files")
    fi
    
    # Check functions file
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local functions_file="$script_dir/histofy-functions.sh"
    
    if [[ -f "$functions_file" ]]; then
        log_success "Shell functions file exists"
        
        # Check if functions file is executable
        if [[ -x "$functions_file" ]]; then
            log_success "Shell functions file is executable"
        else
            issues+=("Shell functions file is not executable")
        fi
    else
        issues+=("Shell functions file not found")
    fi
    
    # Check environment variables
    if [[ -n "${HISTOFY_VERSION:-}" ]]; then
        log_success "HISTOFY_VERSION environment variable set"
    else
        issues+=("HISTOFY_VERSION environment variable not set")
    fi
    
    if [[ -n "${HISTOFY_SHELL:-}" ]]; then
        log_success "HISTOFY_SHELL environment variable set"
    else
        issues+=("HISTOFY_SHELL environment variable not set")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "Shell integration health check passed"
        return 0
    else
        log_warning "Shell integration issues detected:"
        printf '  %s\n' "${issues[@]}"
        return 1
    fi
}

check_performance() {
    log_progress "Checking Histofy performance..."
    
    if ! command -v histofy >/dev/null 2>&1; then
        log_warning "Histofy CLI not available for performance check"
        return 1
    fi
    
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        log_info "Not in Git repository (skipping performance check)"
        return 0
    fi
    
    # Test command execution time
    local start_time
    local end_time
    local duration
    
    start_time=$(date +%s.%N 2>/dev/null || date +%s)
    histofy status >/dev/null 2>&1 || true
    end_time=$(date +%s.%N 2>/dev/null || date +%s)
    
    if command -v bc >/dev/null 2>&1; then
        duration=$(echo "$end_time - $start_time" | bc)
    else
        duration="unknown"
    fi
    
    if [[ "$duration" != "unknown" ]]; then
        log_success "Histofy status execution time: ${duration}s"
        
        # Check if performance is reasonable (< 2 seconds)
        if (( $(echo "$duration > 2" | bc -l 2>/dev/null || echo "0") )); then
            log_warning "Histofy commands may be running slowly"
            return 1
        fi
    else
        log_info "Performance timing not available"
    fi
    
    log_success "Performance check completed"
    return 0
}

run_diagnostics() {
    log_progress "Running diagnostic tests..."
    
    # Test network connectivity (if needed)
    if command -v ping >/dev/null 2>&1; then
        if ping -c 1 github.com >/dev/null 2>&1; then
            log_success "Network connectivity to GitHub available"
        else
            log_warning "Network connectivity to GitHub unavailable"
        fi
    fi
    
    # Check Node.js modules
    if command -v npm >/dev/null 2>&1; then
        local npm_issues
        npm_issues=$(npm doctor 2>&1 | grep -i "error\|warn" | wc -l || echo "0")
        
        if [[ $npm_issues -eq 0 ]]; then
            log_success "npm environment healthy"
        else
            log_warning "npm environment has $npm_issues issues"
        fi
    fi
    
    # Check for common issues
    local common_issues=()
    
    # Check PATH
    if ! echo "$PATH" | grep -q "/usr/local/bin"; then
        common_issues+=("/usr/local/bin not in PATH")
    fi
    
    # Check permissions
    if [[ ! -w "$HOME" ]]; then
        common_issues+=("Home directory not writable")
    fi
    
    if [[ ${#common_issues[@]} -gt 0 ]]; then
        log_warning "Common issues detected:"
        printf '  %s\n' "${common_issues[@]}"
        return 1
    fi
    
    log_success "Diagnostic tests completed"
    return 0
}

generate_health_report() {
    local results=("$@")
    
    echo ""
    echo "=================================================================="
    log_info "Histofy v3 Health Check Report"
    echo "=================================================================="
    
    local passed=0
    local total=${#results[@]}
    
    for result in "${results[@]}"; do
        if [[ "$result" == *":success" ]]; then
            ((passed++))
        fi
    done
    
    local percentage=$((passed * 100 / total))
    
    echo ""
    echo -e "${CYAN}Overall Health: ${NC}$passed/$total checks passed ($percentage%)"
    
    if [[ $percentage -ge 90 ]]; then
        log_success "Histofy installation is healthy!"
    elif [[ $percentage -ge 70 ]]; then
        log_warning "Histofy installation mostly healthy, minor issues detected"
    else
        log_error "Histofy installation has significant health issues"
    fi
    
    echo ""
    echo -e "${GRAY}Detailed Results:${NC}"
    
    for result in "${results[@]}"; do
        local check_name
        local status
        check_name=$(echo "$result" | cut -d: -f1)
        status=$(echo "$result" | cut -d: -f2)
        
        case "$status" in
            success)
                echo -e "  ${GREEN}✓ $check_name${NC}"
                ;;
            warning)
                echo -e "  ${YELLOW}⚠ $check_name${NC}"
                ;;
            error)
                echo -e "  ${RED}✗ $check_name${NC}"
                ;;
        esac
    done
    
    if [[ $percentage -lt 100 ]]; then
        echo ""
        echo -e "${YELLOW}Recommendations:${NC}"
        echo "  • Re-run the installer if issues persist"
        echo "  • Check the troubleshooting guide: TROUBLESHOOTING.md"
        echo "  • Verify system requirements are met"
        echo "  • Run 'histofy help troubleshooting' for more help"
    fi
    
    echo ""
}

show_help() {
    cat << EOF

Histofy v3 Health Check Script

USAGE:
    ./health-check.sh [OPTIONS]

OPTIONS:
    -h, --help      Show this help message
    -v, --version   Show version information
    --quick         Run quick health check (skip performance tests)
    --verbose       Show detailed output

DESCRIPTION:
    Comprehensive health check for Histofy v3 installation.
    Verifies system health, Git repository status, Histofy functionality,
    shell integration, and performance.

EXIT CODES:
    0    All health checks passed
    1    Some health issues detected
    2    Critical health issues found

EOF
}

main() {
    local quick_mode=false
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                echo "Histofy Health Check v$SCRIPT_VERSION"
                exit 0
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Show banner
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                Histofy v3 Health Check                  ║${NC}"
    echo -e "${BLUE}║              Comprehensive System Analysis              ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Run health checks
    local results=()
    local overall_status=0
    
    # System health
    if check_system_health; then
        results+=("System Health:success")
    else
        results+=("System Health:warning")
        overall_status=1
    fi
    
    # Git health
    if check_git_health; then
        results+=("Git Repository:success")
    else
        results+=("Git Repository:warning")
        overall_status=1
    fi
    
    # Histofy health
    if check_histofy_health; then
        results+=("Histofy CLI:success")
    else
        results+=("Histofy CLI:error")
        overall_status=2
    fi
    
    # Shell integration
    if check_shell_integration; then
        results+=("Shell Integration:success")
    else
        results+=("Shell Integration:warning")
        overall_status=1
    fi
    
    # Performance (unless quick mode)
    if [[ "$quick_mode" == "false" ]]; then
        if check_performance; then
            results+=("Performance:success")
        else
            results+=("Performance:warning")
            overall_status=1
        fi
    fi
    
    # Diagnostics
    if run_diagnostics; then
        results+=("Diagnostics:success")
    else
        results+=("Diagnostics:warning")
        overall_status=1
    fi
    
    # Generate report
    generate_health_report "${results[@]}"
    
    exit $overall_status
}

# Execute main function
main "$@"