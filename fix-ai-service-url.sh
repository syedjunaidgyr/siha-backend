#!/bin/bash
# Script to fix AI service URL configuration in backend
# Run this on your EC2 instance after deploying code changes

set -e

echo "=========================================="
echo "Backend AI Service URL Configuration Fix"
echo "=========================================="
echo ""

BACKEND_DIR="/srv/siha/siha-backend"
SERVICE_NAME="siha-backend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Navigate to backend directory
echo -e "${GREEN}[1/5]${NC} Checking backend directory..."
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Backend directory not found at $BACKEND_DIR${NC}"
    echo "Please update BACKEND_DIR in this script or navigate to your backend directory."
    exit 1
fi

cd "$BACKEND_DIR"
echo "✓ Backend directory: $BACKEND_DIR"
echo ""

# Step 2: Check if code changes are deployed
echo -e "${GREEN}[2/5]${NC} Verifying code changes..."
if grep -q "13.203.232.71:3001" src/services/preventiveHealthService.ts; then
    echo "✓ Code changes detected (IP address configured)"
else
    echo -e "${YELLOW}Warning: Code changes not found.${NC}"
    echo "The default URL should be: http://13.203.232.71:3001/api"
    echo "Please ensure you've pulled the latest code changes."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Step 3: Check for environment variable override
echo -e "${GREEN}[3/5]${NC} Checking for environment variable overrides..."

# Check PM2 ecosystem config
if [ -f "ecosystem.config.js" ]; then
    if grep -q "AI_SERVICE_PYTHON_URL" ecosystem.config.js; then
        echo -e "${YELLOW}Found AI_SERVICE_PYTHON_URL in ecosystem.config.js${NC}"
        grep "AI_SERVICE_PYTHON_URL" ecosystem.config.js
        echo ""
        echo "Current value:"
        grep -A 2 "AI_SERVICE_PYTHON_URL" ecosystem.config.js || true
    else
        echo "✓ No AI_SERVICE_PYTHON_URL in ecosystem.config.js (will use code default)"
    fi
fi

# Check .env file
if [ -f ".env" ]; then
    if grep -q "AI_SERVICE_PYTHON_URL" .env; then
        echo -e "${YELLOW}Found AI_SERVICE_PYTHON_URL in .env file${NC}"
        grep "AI_SERVICE_PYTHON_URL" .env
        echo ""
        echo "If this is set to localhost or 127.0.0.1, update it to:"
        echo "AI_SERVICE_PYTHON_URL=http://13.203.232.71:3001/api"
    else
        echo "✓ No AI_SERVICE_PYTHON_URL in .env file (will use code default)"
    fi
fi

# Check PM2 process environment
echo ""
echo "Checking PM2 process environment..."
if pm2 describe $SERVICE_NAME &>/dev/null; then
    echo "PM2 process environment variables:"
    pm2 describe $SERVICE_NAME | grep -A 20 "env:" | grep "AI_SERVICE_PYTHON_URL" || echo "  No AI_SERVICE_PYTHON_URL found in PM2 env"
else
    echo "PM2 process '$SERVICE_NAME' not found"
fi
echo ""

# Step 4: Update PM2 ecosystem config if needed
echo -e "${GREEN}[4/5]${NC} Updating PM2 configuration..."

if [ -f "ecosystem.config.js" ]; then
    # Check if we need to add or update the env var
    if ! grep -q "AI_SERVICE_PYTHON_URL" ecosystem.config.js; then
        echo "Adding AI_SERVICE_PYTHON_URL to ecosystem.config.js..."
        # This is a simple approach - you may need to manually edit the file
        echo -e "${YELLOW}Please manually add this to your ecosystem.config.js env section:${NC}"
        echo "  AI_SERVICE_PYTHON_URL: 'http://13.203.232.71:3001/api'"
        echo ""
    else
        echo "✓ AI_SERVICE_PYTHON_URL already in ecosystem.config.js"
        echo "Please verify it's set to: http://13.203.232.71:3001/api"
    fi
else
    echo -e "${YELLOW}No ecosystem.config.js found.${NC}"
    echo "If you're using PM2, create an ecosystem.config.js or update your PM2 start command."
fi
echo ""

# Step 5: Restart backend service
echo -e "${GREEN}[5/5]${NC} Restarting backend service..."

if pm2 describe $SERVICE_NAME &>/dev/null; then
    echo "Restarting $SERVICE_NAME..."
    pm2 restart $SERVICE_NAME
    
    # Wait a moment for service to start
    sleep 3
    
    # Check status
    echo ""
    echo "Service status:"
    pm2 status | grep $SERVICE_NAME || true
    
    echo ""
    echo "Recent logs (checking for connection attempts):"
    pm2 logs $SERVICE_NAME --lines 10 --nostream | grep -i "AI_SERVICE\|3001\|ECONNREFUSED" || echo "  No relevant logs found"
else
    echo -e "${YELLOW}PM2 process '$SERVICE_NAME' not found.${NC}"
    echo "Please start the backend service manually:"
    echo "  pm2 start ecosystem.config.js"
    echo "  or"
    echo "  pm2 start npm --name '$SERVICE_NAME' -- start"
fi
echo ""

# Verification
echo "=========================================="
echo "Verification Steps"
echo "=========================================="
echo ""
echo "1. Check if AI service is running:"
echo "   curl http://13.203.232.71:3001/health"
echo ""
echo "2. Test backend connection to AI service:"
echo "   curl http://13.203.232.71:3001/api/ai/preventive-health"
echo "   (This will fail with method error, but confirms connection)"
echo ""
echo "3. Check backend logs for connection attempts:"
echo "   pm2 logs $SERVICE_NAME --lines 50 | grep -i '3001\|AI_SERVICE'"
echo ""
echo "4. Verify the URL being used:"
echo "   Check backend logs for: 'http://13.203.232.71:3001' (should see IP, not localhost)"
echo ""

echo -e "${GREEN}Fix script complete!${NC}"
echo ""
echo "If you're still seeing 127.0.0.1:3001 in logs:"
echo "1. Ensure code changes are deployed (check src/services/preventiveHealthService.ts)"
echo "2. Remove any AI_SERVICE_PYTHON_URL env var set to localhost"
echo "3. Restart the backend service: pm2 restart $SERVICE_NAME"

