#!/bin/bash

# Histofy v3 - Bash Shell Functions
# Add these functions to your ~/.bashrc or ~/.bash_profile

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
    
    histofy commit "$message" --date "$date" --time "$time" --add-all
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
    
    histofy commit "$message" --date "$date" --time "$time" --add-all --push
}

# Quick pattern deployment
hp() {
    local pattern="$1"
    local repo="$2"
    
    if [ -z "$pattern" ] || [ -z "$repo" ]; then
        echo "Usage: hp \"pattern-name\" \"username/repo\""
        echo "Example: hp \"hello-world\" \"octocat/Hello-World\""
        return 1
    fi
    
    histofy deploy --pattern "$pattern" --repo "$repo"
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
    
    local start_hour=9
    local hour_increment=2
    
    for ((i=1; i<=count; i++)); do
        local current_hour=$((start_hour + (i-1) * hour_increment))
        local time=$(printf "%02d:00" $current_hour)
        local message="$base_message - Part $i"
        
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

    # Cross-platform date calculation
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD date)
        local yesterday=$(date -v-1d +%Y-%m-%d)
    else
        # Linux (GNU date)
        local yesterday=$(date -d "yesterday" +%Y-%m-%d)
    fi

    if [ -z "$message" ]; then
        echo "Usage: hcy \"commit message\" [\"HH:MM\"]"
        echo "Example: hcy \"Yesterday's work\" \"15:30\""
        return 1
    fi

    histofy commit "$message" --date "$yesterday" --time "$time" --add-all
}

# Commit for a week ago (useful for backfilling)
hcw() {
    local message="$1"
    local days_back="${2:-7}"
    local time="${3:-12:00}"

    # Cross-platform date calculation
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD date)
        local target_date=$(date -v-${days_back}d +%Y-%m-%d)
    else
        # Linux (GNU date)
        local target_date=$(date -d "$days_back days ago" +%Y-%m-%d)
    fi

    if [ -z "$message" ]; then
        echo "Usage: hcw \"commit message\" [days_back] [\"HH:MM\"]"
        echo "Example: hcw \"Last week's work\" 7 \"10:00\""
        return 1
    fi

    histofy commit "$message" --date "$target_date" --time "$time" --add-all
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
    complete -W "commit deploy migrate pattern config status" histofy
    
    # Add completion for pattern names
    _hp_completion() {
        local cur="${COMP_WORDS[COMP_CWORD]}"
        if [ "${COMP_CWORD}" -eq 1 ]; then
            # Complete pattern names
            local patterns=$(histofy pattern list 2>/dev/null | grep -v "Available patterns" | xargs)
            COMPREPLY=($(compgen -W "$patterns" -- "$cur"))
        fi
    }
    complete -F _hp_completion hp
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
    echo "  hp   - Deploy pattern"
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
export -f hc hcp hp hs hci hh hcb hcy hcw hst hhelp
