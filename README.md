# 🏈 Ultimate Sports AI - Backend API

Production-ready Node.js + Express + PostgreSQL backend for the Ultimate Sports AI platform.

**Tech Stack:** Node.js 18+ • Express 4 • PostgreSQL 15 • Socket.IO • JWT Auth

---

## ⚡ Quick Start

### Option 1: Local Development (2 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Initialize database (creates tables + seeds data)
npm run db:init

# 4. Start development server
npm run dev
```

**Server running at:** http://localhost:3001

📖 **Detailed guide:** See `QUICK_START.md`

### Option 2: Deploy to Railway (5 minutes)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

📖 **Detailed guide:** See `RAILWAY_POSTGRES_COMPLETE_SETUP.md`

---

## 🏗️ Project Structure

```
backend/
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env.example           # Environment template
├── config/
│   └── database.js        # Database connection
├── database/
│   ├── schema.sql         # Database schema
│   └── seeds/             # Seed data
├── routes/
│   ├── auth.js            # Authentication
│   ├── users.js           # User management
│   ├── picks.js           # Picks/bets
│   ├── social.js          # Social features
│   ├── achievements.js    # Achievements
│   ├── challenges.js      # Challenges
│   ├── shop.js            # Shop & items
│   ├── analytics.js       # Analytics
│   └── odds.js            # Odds data
├── middleware/
│   ├── auth.js            # JWT authentication
│   └── errorHandler.js    # Error handling
├── websocket/
│   └── handler.js         # WebSocket setup
├── services/
│   ├── email.js           # Email service
│   └── stripe.js          # Payment processing
└── scripts/
    ├── migrate.js         # Database migrations
    └── seed.js            # Seed data
```

---

## 🔐 Environment Variables

Create a `.env` file from `.env.example`:

```env
# Required
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/ultimate_sports_ai
JWT_SECRET=your_secret_here

# Optional
REDIS_URL=redis://localhost:6379
THE_ODDS_API_KEY=your_api_key
STRIPE_SECRET_KEY=sk_test_...
```

---

## 📊 Database Setup

### Create Database

```bash
createdb ultimate_sports_ai
```

### Run Schema

```bash
psql -d ultimate_sports_ai -f database/schema.sql
```

### Tables Created
- `users` - User accounts and stats
- `picks` & `pick_legs` - Betting picks
- `achievements` & `user_achievements` - Achievement system
- `challenges` & `user_challenges` - Challenge system
- `shop_items` & `user_inventory` - Shop and items
- `coin_transactions` - Coin economy
- `follows` - Social follows
- `activity_feed` - Social activity
- `betting_pools` & `pool_participants` - Betting pools
- `referrals` - Referral system
- `notifications` - User notifications
- `refresh_tokens` - JWT refresh tokens
- `user_sessions` - Session tracking

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register      # Register new user
POST   /api/auth/login         # Login
POST   /api/auth/refresh       # Refresh token
POST   /api/auth/logout        # Logout
GET    /api/auth/me            # Get current user
```

### Users
```
GET    /api/users/profile      # Get user profile
PUT    /api/users/profile      # Update profile
GET    /api/users/stats        # Get user stats
GET    /api/users/leaderboard  # Get leaderboard
```

### Picks
```
POST   /api/picks              # Create pick
GET    /api/picks              # Get user picks
GET    /api/picks/:id          # Get pick details
PUT    /api/picks/:id          # Update pick
DELETE /api/picks/:id          # Delete pick
```

### Social
```
POST   /api/social/follow      # Follow user
DELETE /api/social/follow/:id  # Unfollow user
GET    /api/social/followers   # Get followers
GET    /api/social/following   # Get following
GET    /api/social/feed        # Get activity feed
POST   /api/social/feed        # Post activity
POST   /api/social/like        # Like activity
POST   /api/social/comment     # Comment on activity
```

### Achievements
```
GET    /api/achievements       # Get all achievements
GET    /api/achievements/user  # Get user achievements
POST   /api/achievements/check # Check for new achievements
```

### Challenges
```
GET    /api/challenges         # Get active challenges
GET    /api/challenges/user    # Get user challenges
POST   /api/challenges/claim   # Claim reward
PUT    /api/challenges/progress # Update progress
```

### Shop
```
GET    /api/shop/items         # Get shop items
POST   /api/shop/purchase      # Purchase item
GET    /api/shop/inventory     # Get user inventory
POST   /api/shop/activate      # Activate item
```

### Odds
```
GET    /api/odds/live          # Get live odds
GET    /api/odds/games/:id     # Get game odds
GET    /api/odds/compare       # Compare odds
```

---

## 🔐 Authentication

Uses JWT (JSON Web Tokens) for authentication.

### Login Flow

1. **Register/Login**: Get `accessToken` and `refreshToken`
2. **API Requests**: Include `Authorization: Bearer <accessToken>`
3. **Token Refresh**: Use `refreshToken` to get new `accessToken`
4. **Logout**: Revoke `refreshToken`

### Example Request

```javascript
fetch('http://localhost:3001/api/users/profile', {
    headers: {
        'Authorization': 'Bearer <your_access_token>',
        'Content-Type': 'application/json'
    }
})
```

---

## 🔌 WebSocket Events

Connect with JWT token:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
    auth: {
        token: 'your_jwt_token'
    }
});
```

### Events

**Subscriptions:**
- `subscribe:scores` - Subscribe to live scores
- `subscribe:odds` - Subscribe to odds updates
- `subscribe:notifications` - Subscribe to notifications

**Pool Chat:**
- `join:pool` - Join betting pool
- `pool:message` - Send message
- `leave:pool` - Leave pool

**Analysis Rooms:**
- `join:analysis` - Join analysis room
- `analysis:message` - Send message
- `leave:analysis` - Leave room

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test
npm test -- auth.test.js
```

---

## 📦 Deployment

### Option 1: Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Add PostgreSQL: `railway add`
5. Deploy: `railway up`

### Option 2: Render

1. Connect GitHub repo
2. Create new Web Service
3. Add PostgreSQL database
4. Set environment variables
5. Deploy

### Option 3: Heroku

```bash
heroku create ultimate-sports-ai-api
heroku addons:create heroku-postgresql:mini
git push heroku main
```

### Option 4: VPS (DigitalOcean, AWS, etc.)

```bash
# Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql nginx

# Clone repo
git clone <your-repo>
cd backend

# Install dependencies
npm install --production

# Setup PM2
npm install -g pm2
pm2 start server.js --name sports-api
pm2 startup
pm2 save

# Configure Nginx reverse proxy
# Point to localhost:3001
```

---

## 🔒 Security Checklist

- [x] JWT authentication
- [x] Password hashing (bcrypt)
- [x] Rate limiting
- [x] CORS configuration
- [x] Helmet.js security headers
- [x] Input validation (Joi)
- [x] SQL injection prevention (parameterized queries)
- [x] XSS prevention
- [ ] HTTPS (production)
- [ ] Environment variables (production)
- [ ] Database backups
- [ ] Monitoring (Sentry, etc.)

---

## 📊 Monitoring & Logging

### Add Winston Logger

```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
```

### Add Sentry (Error Tracking)

```bash
npm install @sentry/node
```

```javascript
const Sentry = require('@sentry/node');

Sentry.init({ dsn: process.env.SENTRY_DSN });

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

---

## 🚀 Performance Tips

1. **Enable Redis Caching**
   ```javascript
   const redis = require('redis');
   const client = redis.createClient({ url: process.env.REDIS_URL });
   ```

2. **Database Indexing**
   - Already included in schema.sql
   - Monitor slow queries

3. **Connection Pooling**
   - Already configured in database.js
   - Max 20 connections

4. **Compression**
   - Already enabled in server.js

5. **Rate Limiting**
   - Already configured
   - Adjust as needed

---

## 📝 API Response Format

### Success Response
```json
{
    "message": "Operation successful",
    "data": { ... }
}
```

### Error Response
```json
{
    "error": "Error Type",
    "message": "Detailed error message"
}
```

### Paginated Response
```json
{
    "data": [...],
    "pagination": {
        "page": 1,
        "perPage": 20,
        "total": 150,
        "totalPages": 8
    }
}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📞 Support

- Documentation: `/backend/docs`
- Issues: GitHub Issues
- Email: support@ultimatesportsai.com

---

## 📄 License

MIT License - see LICENSE file for details

---

**Built with ❤️ by PredictMaster Studios**
