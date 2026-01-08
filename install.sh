#!/bin/bash

# ============================================
# Ultimate Sports AI - Payment System Installer
# Version: 2.5.1
# ============================================

set -e  # Exit on error

echo "=========================================="
echo "🚀 Ultimate Sports AI Payment Installer"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from your backend root directory"
    exit 1
fi

echo -e "${BLUE}📋 Installation Steps:${NC}"
echo "  1. Database migrations"
echo "  2. API endpoint installation"
echo "  3. Middleware setup"
echo "  4. Testing suite"
echo ""

# Step 1: Database Migrations
echo -e "${YELLOW}Step 1/4: Running database migrations...${NC}"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not found in environment${NC}"
    echo "Please set DATABASE_URL environment variable"
    echo "Example: export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

# Run migrations
if [ -f "backend-installer/migrations/001_create_transactions_table.sql" ]; then
    echo "  → Creating transactions table..."
    psql "$DATABASE_URL" < backend-installer/migrations/001_create_transactions_table.sql
    echo -e "${GREEN}  ✓ Transactions table created${NC}"
else
    echo -e "${RED}  ✗ Migration file not found${NC}"
    exit 1
fi

if [ -f "backend-installer/migrations/002_create_subscriptions_table.sql" ]; then
    echo "  → Creating subscriptions table..."
    psql "$DATABASE_URL" < backend-installer/migrations/002_create_subscriptions_table.sql
    echo -e "${GREEN}  ✓ Subscriptions table created${NC}"
else
    echo -e "${RED}  ✗ Migration file not found${NC}"
    exit 1
fi

if [ -f "backend-installer/migrations/003_update_users_table.sql" ]; then
    echo "  → Updating users table..."
    psql "$DATABASE_URL" < backend-installer/migrations/003_update_users_table.sql
    echo -e "${GREEN}  ✓ Users table updated${NC}"
else
    echo -e "${RED}  ✗ Migration file not found${NC}"
    exit 1
fi

# Step 2: Copy API endpoints
echo ""
echo -e "${YELLOW}Step 2/4: Installing API endpoints...${NC}"

# Detect backend structure
if [ -d "src/routes" ]; then
    ROUTES_DIR="src/routes"
elif [ -d "routes" ]; then
    ROUTES_DIR="routes"
else
    echo -e "${RED}❌ Could not find routes directory${NC}"
    echo "Please create 'src/routes' or 'routes' directory first"
    exit 1
fi

# Copy payment routes
if [ -f "backend-installer/routes/payments.js" ]; then
    cp backend-installer/routes/payments.js "$ROUTES_DIR/"
    echo -e "${GREEN}  ✓ Payment routes installed to ${ROUTES_DIR}/payments.js${NC}"
else
    echo -e "${RED}  ✗ Payment routes file not found${NC}"
    exit 1
fi

# Copy subscriptions routes
if [ -f "backend-installer/routes/subscriptions.js" ]; then
    cp backend-installer/routes/subscriptions.js "$ROUTES_DIR/"
    echo -e "${GREEN}  ✓ Subscription routes installed to ${ROUTES_DIR}/subscriptions.js${NC}"
else
    echo -e "${RED}  ✗ Subscription routes file not found${NC}"
    exit 1
fi

# Step 3: Install middleware
echo ""
echo -e "${YELLOW}Step 3/4: Installing middleware...${NC}"

if [ -d "src/middleware" ]; then
    MIDDLEWARE_DIR="src/middleware"
elif [ -d "middleware" ]; then
    MIDDLEWARE_DIR="middleware"
else
    mkdir -p middleware
    MIDDLEWARE_DIR="middleware"
    echo "  → Created middleware directory"
fi

if [ -f "backend-installer/middleware/validatePayment.js" ]; then
    cp backend-installer/middleware/validatePayment.js "$MIDDLEWARE_DIR/"
    echo -e "${GREEN}  ✓ Payment validation middleware installed${NC}"
else
    echo -e "${YELLOW}  ⚠ Payment validation middleware not found (optional)${NC}"
fi

# Step 4: Create test file
echo ""
echo -e "${YELLOW}Step 4/4: Installing test suite...${NC}"

if [ -f "backend-installer/tests/payment.test.js" ]; then
    if [ -d "tests" ]; then
        cp backend-installer/tests/payment.test.js tests/
    elif [ -d "test" ]; then
        cp backend-installer/tests/payment.test.js test/
    else
        mkdir -p tests
        cp backend-installer/tests/payment.test.js tests/
    fi
    echo -e "${GREEN}  ✓ Test suite installed${NC}"
else
    echo -e "${YELLOW}  ⚠ Test suite not found (optional)${NC}"
fi

# Final instructions
echo ""
echo -e "${GREEN}=========================================="
echo "✅ Installation Complete!"
echo "==========================================${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo ""
echo "1. Update your main app file (app.js or index.js) to include:"
echo "   ${YELLOW}const paymentRoutes = require('./routes/payments');${NC}"
echo "   ${YELLOW}const subscriptionRoutes = require('./routes/subscriptions');${NC}"
echo "   ${YELLOW}app.use('/api', paymentRoutes);${NC}"
echo "   ${YELLOW}app.use('/api', subscriptionRoutes);${NC}"
echo ""
echo "2. Restart your backend server:"
echo "   ${YELLOW}npm run dev${NC}   (or)   ${YELLOW}pm2 restart backend${NC}"
echo ""
echo "3. Test the endpoints:"
echo "   ${YELLOW}npm test${NC}   (or)   ${YELLOW}node backend-installer/test-endpoints.js${NC}"
echo ""
echo "4. Verify in browser:"
echo "   Open: ${YELLOW}https://your-domain.com/payment-diagnostics.html${NC}"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - API Specs: backend-installer/BACKEND_API_REQUIREMENTS.md"
echo "   - Testing Guide: backend-installer/TESTING.md"
echo ""
echo -e "${GREEN}🎉 Payment system ready for production!${NC}"
echo ""
