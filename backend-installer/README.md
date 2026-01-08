# Backend Installer - Payment System Setup

## 🚀 Quick Start

This installer automatically sets up the payment system backend for Ultimate Sports AI in **under 5 minutes**.

### Prerequisites

- PostgreSQL database (Railway, Heroku, or local)
- Node.js backend project
- Database URL in environment variables

### Installation

```bash
# 1. Set your database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# 2. Run the installer
cd backend-installer
chmod +x install.sh
./install.sh
```

That's it! The installer will:
- ✅ Create database tables (transactions, subscriptions)
- ✅ Update users table (add balance, subscription_tier)
- ✅ Install API routes (payments.js, subscriptions.js)
- ✅ Set up middleware (validation)
- ✅ Install test suite

---

## 📂 What Gets Installed

### Database Tables

**1. `transactions` Table**
- Stores all user transactions (purchases, bets, wins, losses)
- Includes PayPal transaction ID for duplicate prevention
- Indexed for fast queries

**2. `subscriptions` Table**
- Stores VIP subscription data
- Handles billing cycles and renewal dates
- Tracks active/cancelled status

**3. `users` Table Updates**
- Adds `balance` column (default: 10000)
- Adds `subscription_tier` column (default: 'free')
- Adds `last_balance_update` timestamp

### API Endpoints

**Payment Endpoints** (`/routes/payments.js`):
- `POST /api/transactions/paypal-purchase` - Record PayPal purchases
- `GET /api/transactions/history` - Get transaction history
- `GET /api/transactions/stats` - Get transaction statistics

**Subscription Endpoints** (`/routes/subscriptions.js`):
- `POST /api/subscriptions/activate` - Activate VIP subscription
- `GET /api/subscriptions/status` - Get subscription status
- `POST /api/subscriptions/cancel` - Cancel subscription
- `GET /api/subscriptions/history` - Get subscription history

---

## 🔧 Manual Installation

If the automatic installer doesn't work, follow these steps:

### Step 1: Run Database Migrations

```bash
# Connect to your database
psql $DATABASE_URL

# Run each migration file
\i backend-installer/migrations/001_create_transactions_table.sql
\i backend-installer/migrations/002_create_subscriptions_table.sql
\i backend-installer/migrations/003_update_users_table.sql

# Exit psql
\q
```

### Step 2: Copy Route Files

```bash
# Copy to your routes directory
cp backend-installer/routes/payments.js src/routes/
cp backend-installer/routes/subscriptions.js src/routes/
```

### Step 3: Update Your Main App File

Add these lines to your `app.js` or `index.js`:

```javascript
// Import payment routes
const paymentRoutes = require('./routes/payments');
const subscriptionRoutes = require('./routes/subscriptions');

// Register routes
app.use('/api', paymentRoutes);
app.use('/api', subscriptionRoutes);
```

### Step 4: Restart Server

```bash
npm run dev
# or
pm2 restart backend
```

---

## 🧪 Testing

### Test with cURL

```bash
# Set your auth token
export AUTH_TOKEN="your-jwt-token-here"

# Test PayPal purchase endpoint
curl -X POST http://localhost:3000/api/transactions/paypal-purchase \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "credit",
    "amount": 10000,
    "reason": "PayPal Purchase: Starter Pack",
    "metadata": {
      "method": "paypal",
      "paypalTransactionId": "TEST-12345",
      "bundleName": "Starter Pack",
      "verified": true
    }
  }'

# Test subscription activation
curl -X POST http://localhost:3000/api/subscriptions/activate \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "Silver VIP",
    "tierId": "silver_monthly",
    "monthlyCoins": 15000,
    "subscriptionId": "TEST-SUB-67890",
    "billingCycle": "monthly",
    "price": 19.99
  }'
```

### Test with Node.js Script

```bash
# Install dependencies
npm install node-fetch

# Set environment variables
export API_BASE_URL="http://localhost:3000"
export TEST_AUTH_TOKEN="your-jwt-token-here"

# Run tests
node backend-installer/test-endpoints.js
```

### Test with Frontend

1. Open frontend in browser
2. Navigate to `/payment-diagnostics.html`
3. Make a test purchase
4. Check diagnostics for sync status

---

## 🔑 Authentication

The routes expect JWT authentication. Make sure your auth middleware:

1. Verifies JWT token
2. Extracts `user.id` from token
3. Attaches to `req.user`

Example auth middleware:

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'No token provided' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                error: 'Invalid token' 
            });
        }
        req.user = user;
        next();
    });
}

module.exports = authenticateToken;
```

---

## 🗄️ Database Configuration

### Railway PostgreSQL

```bash
# Railway provides DATABASE_URL automatically
# Just run the installer:
./backend-installer/install.sh
```

### Heroku PostgreSQL

```bash
# Get your database URL
heroku config:get DATABASE_URL

# Set locally for testing
export DATABASE_URL="$(heroku config:get DATABASE_URL)"

# Run installer
./backend-installer/install.sh
```

### Local PostgreSQL

```bash
# Create database
createdb ultimate_sports_ai

# Set DATABASE_URL
export DATABASE_URL="postgresql://localhost/ultimate_sports_ai"

# Run installer
./backend-installer/install.sh
```

---

## 📊 Cron Jobs (Optional)

### Monthly Subscription Coins

Set up a cron job to credit monthly coins:

```bash
# Add to crontab (run daily at 2 AM)
0 2 * * * psql $DATABASE_URL -c "SELECT credit_monthly_subscription_coins();"
```

Or use Node-cron in your app:

```javascript
const cron = require('node-cron');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
    await db.query('SELECT credit_monthly_subscription_coins()');
    console.log('✅ Monthly subscription coins credited');
});
```

---

## 🐛 Troubleshooting

### Error: "DATABASE_URL not found"

```bash
# Make sure DATABASE_URL is set
echo $DATABASE_URL

# If empty, set it:
export DATABASE_URL="your-database-url-here"
```

### Error: "psql: command not found"

Install PostgreSQL client:

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from: https://www.postgresql.org/download/windows/
```

### Error: "Routes not found"

Make sure you're in the backend root directory:

```bash
# Should show package.json
ls -la | grep package.json

# If not, cd to backend directory
cd path/to/backend
```

### Error: "Auth middleware not found"

Create a basic auth middleware:

```bash
mkdir -p middleware
cat > middleware/auth.js << 'EOF'
module.exports = (req, res, next) => {
    // TODO: Implement proper JWT auth
    req.user = { id: 1 };
    next();
};
EOF
```

---

## 📝 File Structure

```
backend-installer/
├── install.sh                          # Automatic installer script
├── README.md                           # This file
├── migrations/
│   ├── 001_create_transactions_table.sql
│   ├── 002_create_subscriptions_table.sql
│   └── 003_update_users_table.sql
├── routes/
│   ├── payments.js                     # Payment endpoints
│   └── subscriptions.js                # Subscription endpoints
├── middleware/
│   └── validatePayment.js              # Payment validation (optional)
└── test-endpoints.js                   # Test script
```

---

## ✅ Verification Checklist

After installation, verify:

- [ ] Database tables created (`transactions`, `subscriptions`)
- [ ] Users table updated (balance, subscription_tier columns)
- [ ] Route files copied to routes directory
- [ ] Routes registered in main app file
- [ ] Server restarted
- [ ] Test endpoints with cURL (all return 200/401, not 404)
- [ ] Frontend diagnostics tool works
- [ ] Can make test purchase successfully

---

## 🚀 Production Deployment

Before deploying to production:

1. **Environment Variables**
   - [ ] `DATABASE_URL` set correctly
   - [ ] `JWT_SECRET` set securely
   - [ ] `NODE_ENV=production`

2. **Security**
   - [ ] Auth middleware properly implemented
   - [ ] Rate limiting added to payment endpoints
   - [ ] PayPal webhook verification enabled (optional but recommended)

3. **Monitoring**
   - [ ] Database query logging enabled
   - [ ] Error tracking (Sentry, LogRocket, etc.)
   - [ ] Alerts for failed purchases

4. **Testing**
   - [ ] All unit tests passing
   - [ ] All integration tests passing
   - [ ] Load testing completed
   - [ ] End-to-end testing with frontend

---

## 📞 Support

### Issues?

1. Check the troubleshooting section above
2. Review `/BACKEND_API_REQUIREMENTS.md` for detailed specs
3. Test with `/payment-diagnostics.html` on frontend
4. Check server logs for errors

### Need Help?

- **Documentation:** See `/PAYMENT_SYSTEM_FIX.md`
- **API Specs:** See `/BACKEND_API_REQUIREMENTS.md`
- **Frontend Testing:** Use `/payment-diagnostics.html`

---

**Version:** 2.5.1  
**Last Updated:** February 2025  
**Status:** Production Ready ✅
