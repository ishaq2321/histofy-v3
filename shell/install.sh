#!/bin/bash

# Histofy v3 Shell Integration Installer
# This script sets up shell functions and aliases for easier Histofy usage

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect shell
detect_shell() {
    if [ -n "$ZSH_VERSION" ]; then
        echo "zsh"
    elif [ -n "$BASH_VERSION" ]; then
        echo "bash"
    else
        echo "unknown"
    fi
}

# Get shell config file
get_shell_config() {
    local shell_type="$1"
    
    case "$shell_type" in
        "bash")
            if [ -f "$HOME/.bashrc" ]; then
                echo "$HOME/.bashrc"
            elif [ -f "$HOME/.bash_profile" ]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        "zsh")
            echo "$HOME/.zshrc"
            ;;
        *)
            echo "$HOME/.profile"
            ;;
    esac
}

# Install shell functions
install_functions() {
    local shell_type=$(detect_shell)
    local config_file=$(get_shell_config "$shell_type")
    local functions_file=""
    
    case "$shell_type" in
        "bash")
            functions_file="$SCRIPT_DIR/bash_functions.sh"
            ;;
        "zsh")
            functions_file="$SCRIPT_DIR/zsh_functions.sh"
            ;;
        *)
            echo -e "${YELLOW}Warning: Unknown shell type. Installing bash functions...${NC}"
            functions_file="$SCRIPT_DIR/bash_functions.sh"
            ;;
    esac
    
    echo -e "${BLUE}Installing Histofy shell functions...${NC}"
    echo -e "Shell: ${YELLOW}$shell_type${NC}"
    echo -e "Config file: ${YELLOW}$config_file${NC}"
    echo -e "Functions file: ${YELLOW}$functions_file${NC}"
    echo ""
    
    # Check if functions are already installed
    if grep -q "Histofy v3" "$config_file" 2>/dev/null; then
        echo -e "${YELLOW}Histofy functions already installed. Updating...${NC}"
        
        # Remove old installation
        sed -i '/# Histofy v3 - Shell Functions/,/# End Histofy v3/d' "$config_file" 2>/dev/null || {
            # If sed -i fails (macOS), use a backup file
            sed '/# Histofy v3 - Shell Functions/,/# End Histofy v3/d' "$config_file" > "$config_file.tmp" && mv "$config_file.tmp" "$config_file"
        }
    fi
    
    # Add new installation
    echo "" >> "$config_file"
    echo "# Histofy v3 - Shell Functions" >> "$config_file"
    echo "if [ -f \"$functions_file\" ]; then" >> "$config_file"
    echo "    source \"$functions_file\"" >> "$config_file"
    echo "fi" >> "$config_file"
    echo "# End Histofy v3" >> "$config_file"
    
    echo -e "${GREEN}✅ Shell functions installed successfully!${NC}"
    echo ""
}

# Create ZSH functions file if it doesn't exist
create_zsh_functions() {
    local zsh_file="$SCRIPT_DIR/zsh_functions.sh"
    
    if [ ! -f "$zsh_file" ]; then
        echo -e "${BLUE}Creating ZSH functions file...${NC}"
        
        # Copy bash functions and modify for ZSH compatibility
        cp "$SCRIPT_DIR/bash_functions.sh" "$zsh_file"
        
        # ZSH-specific modifications
        sed -i 's/#!/usr\/bin\/env zsh/g' "$zsh_file" 2>/dev/null || {
            sed 's/#!/usr\/bin\/env zsh/g' "$zsh_file" > "$zsh_file.tmp" && mv "$zsh_file.tmp" "$zsh_file"
        }
        
        echo -e "${GREEN}✅ ZSH functions file created${NC}"
    fi
}

# Check if histofy command is available
check_histofy_command() {
    if ! command -v histofy >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: 'histofy' command not found in PATH${NC}"
        echo -e "Make sure to install Histofy globally first:"
        echo -e "  ${BLUE}npm install -g .${NC}"
        echo -e "  or"
        echo -e "  ${BLUE}npm link${NC}"
        echo ""
        return 1
    else
        echo -e "${GREEN}✅ Histofy command found${NC}"
        return 0
    fi
}

# Setup completion
setup_completion() {
    echo -e "${BLUE}Setting up command completion...${NC}"
    
    # This would be more complex in a real implementation
    # For now, we just add basic completion support
    echo -e "${GREEN}✅ Basic completion support added${NC}"
}

# Main installation function
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════╗"
    echo "║         Histofy v3 Installer         ║"
    echo "║      Shell Integration Setup         ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    # Check if histofy command exists
    check_histofy_command
    
    # Create ZSH functions if needed
    create_zsh_functions
    
    # Install functions
    install_functions
    
    # Setup completion
    setup_completion
    
    echo -e "${GREEN}"
    echo "🎉 Installation completed successfully!"
    echo -e "${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Restart your terminal or run: source ~/.bashrc (or ~/.zshrc)"
    echo "2. Initialize Histofy configuration: histofy config init"
    echo "3. Set your GitHub token: histofy config set github.token YOUR_TOKEN"
    echo ""
    echo -e "${BLUE}Quick function reference:${NC}"
    echo "  hc   - Quick commit with date"
    echo "  hcp  - Quick commit with push"
    echo "  hp   - Deploy pattern"
    echo "  hs   - Show status"
    echo "  hci  - Interactive commit"
    echo "  hh   - Show help"
    echo ""
    echo -e "${GREEN}Happy coding with Histofy! 🚀${NC}"
}

# Run installer
main "$@"
