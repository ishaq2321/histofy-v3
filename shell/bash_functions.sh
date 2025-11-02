#!/bin/bash

# Histofy v3 - Bash Shell Functions
# Add these functions to your ~/.bashrc or ~/.bash_profile

# Input validation and sanitization functions
validate_date() {
    local date="$1"
    if [[ ! "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo "Error: Invalid date format. Use YYYY-MM-DD" >&2
        return 1
    fi
    
    # Check if date is valid using date command
    if ! date -d "$date" >/dev/null 2>&1; then
        echo "Error: Invalid date: $date" >&2
        return 1
    fi
    
    return 0
}

validate_time() {
    local time="$1"
    if [[ ! "$time" =~ ^[0-9]{1,2}:[0-9]{2}$ ]]; then
        echo "Error: Invalid time format. Use HH:MM" >&2
        return 1
    fi
    
    local hour=$(echo "$time" | cut -d: -f1)
    local minute=$(echo "$time" | cut -d: -f2)
    
    if [ "$hour" -gt 23 ] || [ "$minute" -gt 59 ]; then
        echo "Error: Invalid time: $time" >&2
        return 1
    fi
    
    return 0
}

sanitize_message() {
    local message="$1"
    
    # Remove potentially dangerous characters
    message=$(echo "$message" | sed 's/[;&|`$(){}[\]\\<>]//g')
    
    # Trim whitespace
    message=$(echo "$message" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Check minimum length
    if [ ${#message} -lt 5 ]; then
        echo "Error: Commit message too short (minimum 5 characters)" >&2
        return 1
    fi
    
    # Check maximum length
    if [ ${#message} -gt 72 ]; then
        echo "Error: Commit message too long (maximum 72 characters)" >&2
        return 1
    fi
    
    echo "$message"
    return 0
}

validate_count() {
    local count="$1"
    
    if [[ ! "$count" =~ ^[0-9]+$ ]]; then
        echo "Error: Count must be a positive number" >&2
        return 1
    fi
    
    if [ "$count" -lt 1 ] || [ "$count" -gt 20 ]; then
        echo "Error: Count must be between 1 and 20" >&2
        return 1
    fi
    
    return 0
}

# Quick commit with custom date
hc() {
    local message="$1"
    local date="$2"
    local time="${3:-12:00}"
    
    if [ -z "$message" ] || [ -z "$date" ]; then
        echo "Usage: hc \"commit message\" \"YYYY-MM-DD\" [\"HH:MM\"]"
        echo "Example: hc \"Initial commit\" \"2023-06-15\" \"14:30\""
        return 1
    fi
    
    # Validate and sanitize inputs
    if ! validate_date "$date"; then
        return 1
    fi
    
    if ! validate_time "$time"; then
        return 1
    fi
    
    local sanitized_message
    if ! sanitized_message=$(sanitize_message "$message"); then
        return 1
    fi
    
    histofy commit "$sanitized_message" --date "$date" --time "$time" --add-all
}

# Quick commit with push
hcp() {
    local message="$1"
    local date="$2"
    local time="${3:-12:00}"
    
    if [ -z "$message" ] || [ -z "$date" ]; then
        echo "Usage: hcp \"commit message\" \"YYYY-MM-DD\" [\"HH:MM\"]"
        echo "Example: hcp \"Initial commit\" \"2023-06-15\" \"14:30\""
        return 1
    fi
    
    # Validate and sanitize inputs
    if ! validate_date "$date"; then
        return 1
    fi
    
    if ! validate_time "$time"; then
        return 1
    fi
    
    local sanitized_message
    if ! sanitized_message=$(sanitize_message "$message"); then
        return 1
    fi
    
    histofy commit "$sanitized_message" --date "$date" --time "$time" --add-all --push
}



# Quick status check
hs() {
    histofy status "$@"
}

# Interactive commit with date picker
hci() {
    histofy commit
}

# Show histofy help
hh() {
    histofy --help
}

# Batch commit for today with different times
hcb() {
    local base_message="$1"
    local date="${2:-$(date +%Y-%m-%d)}"
    local count="${3:-3}"
    
    if [ -z "$base_message" ]; then
        echo "Usage: hcb \"base commit message\" [\"YYYY-MM-DD\"] [count]"
        echo "Example: hcb \"Working on feature\" \"2023-06-15\" 5"
        return 1
    fi
    
    # Validate inputs
    if ! validate_date "$date"; then
        return 1
    fi
    
    if ! validate_count "$count"; then
        return 1
    fi
    
    local sanitized_base_message
    if ! sanitized_base_message=$(sanitize_message "$base_message"); then
        return 1
    fi
    
    local start_hour=9
    local hour_increment=2
    
    for ((i=1; i<=count; i++)); do
        local current_hour=$((start_hour + (i-1) * hour_increment))
        
        # Ensure hour doesn't exceed 23
        if [ "$current_hour" -gt 23 ]; then
            current_hour=$((current_hour - 24))
        fi
        
        local time=$(printf "%02d:00" $current_hour)
        local message="$sanitized_base_message - Part $i"
        
        echo "Creating commit $i/$count: '$message' at $time"
        histofy commit "$message" --date "$date" --time "$time" --add-all
        
        # Small delay between commits
        sleep 1
    done
}

# Commit for yesterday (useful for catch-up)
hcy() {
    local message="$1"
    local time="${2:-12:00}"
    local yesterday=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)
    
    if [ -z "$message" ]; then
        echo "Usage: hcy \"commit message\" [\"HH:MM\"]"
        echo "Example: hcy \"Yesterday's work\" \"15:30\""
        return 1
    fi
    
    # Validate inputs
    if ! validate_time "$time"; then
        return 1
    fi
    
    local sanitized_message
    if ! sanitized_message=$(sanitize_message "$message"); then
        return 1
    fi
    
    histofy commit "$sanitized_message" --date "$yesterday" --time "$time" --add-all
}

# Commit for a week ago (useful for backfilling)
hcw() {
    local message="$1"
    local days_back="${2:-7}"
    local time="${3:-12:00}"
    
    if [ -z "$message" ]; then
        echo "Usage: hcw \"commit message\" [days_back] [\"HH:MM\"]"
        echo "Example: hcw \"Last week's work\" 7 \"10:00\""
        return 1
    fi
    
    # Validate days_back
    if [[ ! "$days_back" =~ ^[0-9]+$ ]] || [ "$days_back" -lt 1 ] || [ "$days_back" -gt 365 ]; then
        echo "Error: days_back must be a number between 1 and 365" >&2
        return 1
    fi
    
    # Calculate target date (cross-platform compatible)
    local target_date
    if command -v gdate >/dev/null 2>&1; then
        # macOS with GNU date
        target_date=$(gdate -d "$days_back days ago" +%Y-%m-%d)
    elif date -d "1 day ago" >/dev/null 2>&1; then
        # GNU date (Linux)
        target_date=$(date -d "$days_back days ago" +%Y-%m-%d)
    else
        # BSD date (macOS default)
        target_date=$(date -v-${days_back}d +%Y-%m-%d)
    fi
    
    # Validate inputs
    if ! validate_time "$time"; then
        return 1
    fi
    
    local sanitized_message
    if ! sanitized_message=$(sanitize_message "$message"); then
        return 1
    fi
    
    histofy commit "$sanitized_message" --date "$target_date" --time "$time" --add-all
}

# Show current git status with histofy enhancements
hst() {
    echo "=== Git Status ==="
    git status --short
    echo ""
    echo "=== Histofy Status ==="
    histofy status
}

# Auto-completion for histofy commands (if available)
if command -v histofy >/dev/null 2>&1; then
    # Add completion for histofy command
    complete -W "commit migrate config status" histofy
fi

# Aliases for common git operations with histofy
alias gch='histofy commit'
alias gst='histofy status'
alias gmg='histofy migrate'

# Show Histofy help and quick reference
hhelp() {
    echo "🎉 Histofy v3 Quick Reference"
    echo "Available commands:"
    echo "  hc   - Quick commit with date"
    echo "  hcp  - Quick commit with push"
    echo "  hs   - Show status"
    echo "  hci  - Interactive commit"
    echo "  hh   - Show help"
    echo "  hst  - Show git and histofy status"
    echo "  hcb  - Batch commit for today"
    echo "  hcy  - Commit for yesterday"
    echo "  hcw  - Commit for a week ago"
    echo "  hhelp - Show this help message"
}

# Export functions to make them available in subshells
export -f hc hcp hs hci hh hcb hcy hcw hst hhelp
