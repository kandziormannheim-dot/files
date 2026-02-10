#!/bin/bash

#############################################
# Affiliate Business Automation - Setup Script
# Automatische Installation & Konfiguration
#############################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is NOT installed"
        return 1
    fi
}

# Start setup
print_header "Affiliate Business Automation Setup"

echo "OS: $(uname -s)"
echo "Current Directory: $(pwd)"
echo "Current User: $(whoami)"
echo ""

# Step 1: Check Prerequisites
print_header "Step 1: Checking Prerequisites"

MISSING=0

if ! check_command python3; then
    print_error "Python 3 is required!"
    MISSING=$((MISSING+1))
fi

if ! check_command pip3; then
    print_error "pip3 is required!"
    MISSING=$((MISSING+1))
fi

if ! check_command git; then
    print_warning "git is not installed (optional but recommended)"
fi

if [ $MISSING -gt 0 ]; then
    print_error "Please install missing prerequisites and try again"
    exit 1
fi

# Step 2: Create Virtual Environment
print_header "Step 2: Creating Python Virtual Environment"

if [ -d "venv" ]; then
    print_warning "Virtual environment already exists. Skipping creation."
else
    python3 -m venv venv
    print_success "Virtual environment created"
fi

# Activate virtual environment
source venv/bin/activate
print_success "Virtual environment activated"

# Step 3: Upgrade pip
print_header "Step 3: Upgrading pip"
pip install --upgrade pip setuptools wheel
print_success "pip upgraded"

# Step 4: Install Python Dependencies
print_header "Step 4: Installing Python Dependencies"

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    print_success "All Python packages installed"
else
    print_error "requirements.txt not found!"
    exit 1
fi

# Step 5: Setup Environment Variables
print_header "Step 5: Setting Up Environment Variables"

if [ -f ".env" ]; then
    print_warning ".env file already exists. Skipping template copy."
else
    if [ -f ".env.template" ]; then
        cp .env.template .env
        print_success ".env file created from template"
        print_warning "IMPORTANT: Edit .env file with your actual credentials!"
    else
        print_error ".env.template not found!"
        exit 1
    fi
fi

# Step 6: Create Configuration File
print_header "Step 6: Verifying Configuration Files"

if [ -f "affiliate_business_config.yml" ]; then
    print_success "affiliate_business_config.yml exists"
else
    print_error "affiliate_business_config.yml not found!"
    exit 1
fi

# Step 7: Create Necessary Directories
print_header "Step 7: Creating Directory Structure"

mkdir -p logs
mkdir -p backups
mkdir -p tmp
mkdir -p data/databases
mkdir -p workflows

print_success "Directory structure created"

# Step 8: Create Log Files
print_header "Step 8: Setting Up Logging"

touch logs/setup.log
touch logs/affiliate_automation.log
touch logs/n8n_workflows.log
touch logs/health_check.log

print_success "Log files created"

# Step 9: Database Check
print_header "Step 9: Database Configuration"

if ! check_command psql; then
    print_warning "PostgreSQL client (psql) not found"
    print_warning "If using local PostgreSQL, install: sudo apt-get install postgresql postgresql-contrib"
    print_warning "Database setup will be manual"
else
    print_success "PostgreSQL client found"
    print_warning "Database creation is manual - see QUICKSTART_GUIDE.md"
fi

# Step 10: Test Python Scripts
print_header "Step 10: Verifying Python Scripts"

for script in affiliate_automation_master.py n8n_workflow_manager.py health_check.py backup_manager.py; do
    if [ -f "$script" ]; then
        python3 -m py_compile "$script"
        print_success "$script is valid"
    else
        print_warning "$script not found (will be available later)"
    fi
done

# Step 11: Create systemd Service Files (optional)
print_header "Step 11: Systemd Service Files (Optional)"

if [ "$EUID" -eq 0 ]; then
    print_success "Running as root - can create systemd files"
    
    # Create n8n service file
    cat > /etc/systemd/system/n8n.service <<EOF
[Unit]
Description=n8n Workflow Automation
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
Environment="PATH=$(pwd)/venv/bin"
ExecStart=$(pwd)/venv/bin/n8n start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    print_success "systemd service files created"
else
    print_warning "Not running as root - skipping systemd service creation"
    print_warning "To create services: sudo bash setup.sh"
fi

# Step 12: Test Imports
print_header "Step 12: Testing Python Imports"

python3 << EOF
try:
    import requests
    import yaml
    import dotenv
    from datetime import datetime
    print("✓ All critical imports successful")
except ImportError as e:
    print(f"✗ Import error: {e}")
    exit(1)
EOF

# Step 13: Display Next Steps
print_header "Setup Complete! ✓"

echo -e "${GREEN}What to do next:${NC}\n"

echo "1. Edit .env file with your credentials:"
echo "   ${YELLOW}nano .env${NC}"
echo ""

echo "2. Edit configuration:"
echo "   ${YELLOW}nano affiliate_business_config.yml${NC}"
echo ""

echo "3. Generate setup plan:"
echo "   ${YELLOW}python3 affiliate_automation_master.py${NC}"
echo ""

echo "4. Follow QUICKSTART_GUIDE.md for detailed instructions"
echo ""

echo -e "${YELLOW}Important Files:${NC}"
echo "  - .env (API keys and credentials)"
echo "  - affiliate_business_config.yml (system configuration)"
echo "  - QUICKSTART_GUIDE.md (setup instructions)"
echo "  - README.md (documentation)"
echo ""

echo -e "${BLUE}Useful Commands:${NC}"
echo "  source venv/bin/activate      # Activate virtual environment"
echo "  deactivate                     # Deactivate virtual environment"
echo "  python3 affiliate_automation_master.py    # Run setup"
echo "  python3 health_check.py        # Check system health"
echo "  python3 backup_manager.py      # Manage backups"
echo ""

echo -e "${GREEN}Setup ready! Next step: Edit .env and follow QUICKSTART_GUIDE.md${NC}\n"

# Create completion marker
echo "$(date)" > .setup_complete
print_success "Setup marker created"

