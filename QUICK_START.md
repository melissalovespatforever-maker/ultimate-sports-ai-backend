# ⚡ Backend Quick Start Guide

## 🎯 Choose Your Path

### Path A: Deploy to Railway (Production) 🚀
**Best for:** Final deployment, production environment
**Time:** 5 minutes
**Cost:** FREE (with $5 credit)

👉 **Follow:** `RAILWAY_POSTGRES_COMPLETE_SETUP.md`

---

### Path B: Run Locally (Development) 💻
**Best for:** Testing, development, local debugging
**Time:** 2 minutes
**Requirements:** PostgreSQL installed locally

---

## 🏠 Running Locally (Path B)

### Prerequisites

1. **PostgreSQL installed:**
   - **Mac:** `brew install postgresql@15`
   - **Windows:** Download from https://www.postgresql.org/download/
   - **Linux:** `sudo apt-get install postgresql-15`

2. **Node.js 18+:**
   - Check: `node --version`
   - Install from: https://nodejs.org/

### Setup (2 Minutes)

#### 1. Create Local Database

```bash
# Start PostgreSQL (if not running)
# Mac:
brew services start postgresql@15

# Linux:
sudo service postgresql start

# Windows: Start from Windows Services

# Create database
psql postgres -c "CREATE DATABASE ultimate_sports_ai;"

# Verify
psql postgres -c "\l" | grep ultimate_sports_ai
```

#### 2. Configure Environment

```bash
cd backend

# Copy example env file
cp .env.example .env

# Edit .env file
nano .env  # or open in your editor
```

**Update these values in `.env`:**
```bash
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Local Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ultimate_sports_ai
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# OR use connection string:
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ultimate_sports_ai

# JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your_dev_secret_here
JWT_REFRESH_SECRET=your_dev_refresh_secret_here

# API Key
THE_ODDS_API_KEY=9f8af56c3774a79663650a7713d1a776
```

#### 3. Install Dependencies

```bash
npm install
```

#### 4. Initialize Database

```bash
# This creates all tables and seeds initial data
npm run db:init
```

You should see:
```
✅ Database connected successfully!
✅ Schema created successfully!
✅ Data seeded successfully!
✅ DATABASE SETUP COMPLETE!

📊 Summary:
   • Achievements: 20
   • Challenges: 6
   • Shop Items: 13
   • Users: 4

🔑 Admin Credentials:
   Email: admin@sportsai.com
   Password: admin123
```

#### 5. Start Server

```bash
npm run dev
```

You should see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏈 Ultimate Sports AI Backend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Server running on port 3001
📡 Environment: development
🌐 Frontend URL: http://localhost:3000
⚡ WebSocket server ready
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Database connected
```

#### 6. Test It

Open another terminal:

```bash
# Health check
curl http://localhost:3001/health

# Register test user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@test.com",
    "password": "test123"
  }'
```

**Success!** ✅ Your backend is running locally!

---

## 🔄 Development Workflow

### Start Development Server
```bash
npm run dev
```
- Auto-restarts on file changes
- Shows detailed logs
- Perfect for development

### Reset Database (Fresh Start)
```bash
npm run db:init
```
- Drops existing tables
- Creates new schema
- Seeds fresh data
- Useful when testing schema changes

### View Database
```bash
psql ultimate_sports_ai

# Useful commands:
\dt                    # List all tables
\d users              # Describe users table
SELECT * FROM users;  # View all users
\q                    # Quit
```

---

## 🧪 Testing Your Backend

### Test Authentication

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"test123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Copy the token from response, then:
TOKEN="your_token_here"

# Get user profile
curl http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Test Database Queries

```bash
# Check achievements
psql ultimate_sports_ai -c "SELECT id, name, rarity FROM achievements LIMIT 5;"

# Check challenges
psql ultimate_sports_ai -c "SELECT id, name, type, coins_reward FROM challenges;"

# Check shop items
psql ultimate_sports_ai -c "SELECT id, name, coin_price FROM shop_items LIMIT 5;"

# Check users
psql ultimate_sports_ai -c "SELECT username, email, subscription_tier, level FROM users;"
```

---

## 🐛 Troubleshooting

### ❌ "Database connection refused"

**Check PostgreSQL is running:**
```bash
# Mac:
brew services list | grep postgresql

# Linux:
sudo service postgresql status

# If not running, start it:
brew services start postgresql@15  # Mac
sudo service postgresql start      # Linux
```

### ❌ "Database does not exist"

**Create it:**
```bash
psql postgres -c "CREATE DATABASE ultimate_sports_ai;"
```

### ❌ "Password authentication failed"

**Check your postgres password:**
```bash
# Reset postgres password if needed:
psql postgres
ALTER USER postgres PASSWORD 'newpassword';
\q

# Update .env with new password
```

### ❌ "Port 3001 already in use"

**Kill the process:**
```bash
# Mac/Linux:
lsof -ti:3001 | xargs kill -9

# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### ❌ "npm ERR! missing script"

**Make sure you're in backend directory:**
```bash
cd backend
npm install
npm run db:init
```

---

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # Database connection (supports Railway & local)
├── database/
│   ├── schema.sql           # Database schema (18 tables)
│   └── seed.sql             # Initial data (achievements, shop, etc.)
├── middleware/
│   ├── auth.js              # JWT authentication
│   └── errorHandler.js      # Error handling
├── routes/
│   ├── auth.js              # Login, register, refresh token
│   ├── users.js             # User profile, stats
│   ├── picks.js             # Create picks, view history
│   ├── social.js            # Follow, activity feed
│   ├── achievements.js      # Unlock, view achievements
│   ├── challenges.js        # Daily/weekly challenges
│   ├── shop.js              # Buy items, inventory
│   ├── analytics.js         # Stats, leaderboards
│   └── odds.js              # Sports odds proxy
├── scripts/
│   └── init-database.js     # Database initialization script
├── websocket/
│   └── handler.js           # Real-time updates
├── server.js                # Main server file
├── package.json
└── .env                     # Your environment variables
```

---

## 🚀 Ready for Production?

Once your local backend works:

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Backend ready for production"
   git push
   ```

2. **Deploy to Railway:**
   👉 Follow: `RAILWAY_POSTGRES_COMPLETE_SETUP.md`

3. **Update Frontend:**
   - Change `config.js` to use Railway URL
   - Deploy frontend to Vercel/Netlify

4. **Test end-to-end:**
   - Register → Make picks → Check leaderboard
   - Verify everything syncs!

---

## 📊 Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server (auto-reload)
npm start               # Start production server

# Database
npm run db:init         # Initialize/reset database
psql ultimate_sports_ai # Connect to database

# Testing
curl http://localhost:3001/health  # Health check

# Logs
tail -f logs/app.log    # View application logs (if configured)
```

---

## ✅ Checklist

Local Setup:
- [ ] PostgreSQL installed & running
- [ ] Database created (`ultimate_sports_ai`)
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured
- [ ] Database initialized (`npm run db:init`)
- [ ] Server starts successfully (`npm run dev`)
- [ ] Health check works
- [ ] Can register/login users

Production Setup:
- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] PostgreSQL added on Railway
- [ ] Backend deployed
- [ ] Environment variables set
- [ ] Database initialized on Railway
- [ ] Health check works on Railway URL

---

## 🎉 You're Ready!

**Local backend running?** Start building features!
**Production deployed?** Time to launch! 🚀

**Need help?** Check the logs - they tell you exactly what's wrong!
