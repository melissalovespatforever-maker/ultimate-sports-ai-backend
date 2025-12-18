# 🤖 AI Coaches Backend Integration

## Overview

Complete backend integration for all 11 AI coaches with real-time stats tracking, performance analytics, and pick generation from live sports data.

---

## 🎯 Features

### ✅ **Implemented**
- **11 AI Coaches** - Complete roster across all major sports
- **Real-time Stats** - Database-backed performance tracking
- **ESPN Integration** - Live injury reports and game data
- **The Odds API** - Real betting lines from 10+ sportsbooks
- **Smart Analysis** - Injury impact, line movement, consensus tracking
- **Performance Tracking** - Win/loss records, streaks, ROI, accuracy
- **Caching System** - 1-minute cache to reduce API calls

### 📊 **Sports Coverage**
| Coach | Sport | API Coverage |
|-------|-------|--------------|
| The Analyst | NBA Basketball | ✅ ESPN + Odds API |
| Sharp Shooter | NFL Football | ✅ ESPN + Odds API |
| Data Dragon | MLB Baseball | ✅ ESPN + Odds API |
| Ice Breaker | NHL Hockey | ✅ ESPN + Odds API |
| El Futbolista | Soccer (EPL) | ✅ ESPN + Odds API |
| The Gridiron Guru | College Football | ✅ ESPN + Odds API |
| Ace of Aces | Tennis (ATP) | ⚠️ Odds API only |
| The Brawl Boss | MMA/Boxing | ⚠️ Odds API only |
| The Green Master | Golf (PGA) | ⚠️ Odds API only |
| March Madness | College Basketball | ✅ ESPN + Odds API |
| Pixel Prophet | Esports (LoL) | ⚠️ Odds API only |

---

## 🔌 API Endpoints

### **GET /api/ai-coaches**
Get all coach profiles with current stats.

**Response:**
```json
{
  "success": true,
  "count": 11,
  "coaches": [
    {
      "id": 1,
      "name": "The Analyst",
      "specialty": "basketball_nba",
      "tier": "PRO",
      "strategy": "value_betting",
      "accuracy": 74.2,
      "totalPicks": 547,
      "streak": 12,
      "roi": "+24.8%"
    }
  ]
}
```

---

### **GET /api/ai-coaches/:id**
Get individual coach details.

**Example:** `GET /api/ai-coaches/2`

**Response:**
```json
{
  "success": true,
  "coach": {
    "id": 2,
    "name": "Sharp Shooter",
    "specialty": "americanfootball_nfl",
    "tier": "VIP",
    "strategy": "sharp_money",
    "accuracy": 71.8,
    "totalPicks": 423,
    "streak": 8,
    "roi": "+31.2%"
  }
}
```

---

### **GET /api/ai-coaches/picks**
Generate AI picks from live games with real-time analysis.

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-01-15T18:30:00.000Z",
  "coaches": [
    {
      "id": 1,
      "name": "The Analyst",
      "accuracy": 74.2,
      "totalPicks": 547,
      "streak": 12,
      "recentPicks": [
        {
          "game": "Lakers @ Warriors",
          "pick": "Warriors ML",
          "odds": -145,
          "confidence": 78,
          "reasoning": "Strong sportsbook consensus. 12 sportsbooks analyzed. Home team has key injuries factored.",
          "gameTime": "Jan 15, 10:30 PM",
          "injuries": {
            "home": [],
            "away": [
              {
                "athlete": "LeBron James",
                "position": "SF",
                "status": "Questionable",
                "details": "Ankle"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## 🗄️ Database Schema

### **Tables**

#### `coaches`
Stores coach profile information.
```sql
id, name, specialty, avatar, tier, strategy, created_at, updated_at
```

#### `coach_picks`
Historical picks with outcomes for performance tracking.
```sql
id, coach_id, game_id, sport, home_team, away_team, 
pick_team, pick_type, odds, confidence, reasoning, 
game_time, result, created_at, updated_at
```

#### `coach_stats`
Aggregated performance metrics per coach.
```sql
coach_id, total_picks, wins, losses, pushes, accuracy,
current_streak, best_streak, roi, units_won, 
last_pick_date, created_at, updated_at
```

---

## 🚀 Setup Instructions

### **1. Run Database Migration**

Connect to your PostgreSQL database and run:
```bash
psql $DATABASE_URL -f backend/migrations/003_ai_coaches_performance.sql
```

Or via Railway CLI:
```bash
railway run psql < backend/migrations/003_ai_coaches_performance.sql
```

### **2. Verify Migration**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%coach%';

-- Verify all 11 coaches inserted
SELECT id, name, specialty, tier FROM coaches ORDER BY id;

-- Check initial stats
SELECT coach_id, accuracy, total_picks, current_streak 
FROM coach_stats ORDER BY accuracy DESC;
```

### **3. Test Endpoints**

```bash
# Get all coaches
curl https://ultimate-sports-ai-backend-production.up.railway.app/api/ai-coaches

# Get specific coach
curl https://ultimate-sports-ai-backend-production.up.railway.app/api/ai-coaches/1

# Get live picks
curl https://ultimate-sports-ai-backend-production.up.railway.app/api/ai-coaches/picks
```

---

## 🔧 Configuration

### **Environment Variables**

Required in your `.env` or Railway environment:

```env
# PostgreSQL Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# The Odds API (for betting lines)
THE_ODDS_API_KEY=your_odds_api_key_here

# ESPN API (public, no key needed)
# Automatically falls back if Odds API unavailable
```

### **Get The Odds API Key**
1. Sign up at [the-odds-api.com](https://the-odds-api.com/)
2. Free tier: 500 requests/month
3. Add to Railway: `railway variables set THE_ODDS_API_KEY=your_key`

---

## 📈 Performance Tracking

### **Automatic Updates**
The database uses PostgreSQL triggers to automatically update coach stats when pick results are recorded:

```sql
-- Mark a pick as won
UPDATE coach_picks SET result = 'win' WHERE id = 123;
-- Stats automatically recalculated via trigger
```

### **Manual Stats Update**
```sql
-- Recalculate accuracy for coach ID 1
UPDATE coach_stats
SET 
  wins = (SELECT COUNT(*) FROM coach_picks WHERE coach_id = 1 AND result = 'win'),
  losses = (SELECT COUNT(*) FROM coach_picks WHERE coach_id = 1 AND result = 'loss'),
  total_picks = (SELECT COUNT(*) FROM coach_picks WHERE coach_id = 1 AND result != 'pending'),
  accuracy = (SELECT COUNT(*)::DECIMAL FROM coach_picks WHERE coach_id = 1 AND result = 'win') / 
             (SELECT COUNT(*)::DECIMAL FROM coach_picks WHERE coach_id = 1 AND result != 'pending') * 100
WHERE coach_id = 1;
```

---

## 🎯 Coach Strategies

Each coach uses a different analysis strategy:

### **Value Betting** (Coaches 1, 4, 7, 10)
- Focuses on expected value (EV)
- Seeks highest odds opportunities
- Targets undervalued underdogs

### **Sharp Money** (Coaches 2, 5, 8, 11)
- Follows professional bettor patterns
- Tracks line movement
- Identifies sharp action

### **Consensus** (Coaches 3, 6, 9)
- Analyzes sportsbook agreement
- Seeks low variance picks
- Follows market consensus

---

## 🔄 Data Flow

```
┌─────────────┐
│  Frontend   │ Request picks
│  (Vercel)   ├─────────────┐
└─────────────┘             │
                            ▼
                  ┌──────────────────┐
                  │  Backend API     │
                  │  (Railway)       │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │  ESPN API    │  │ The Odds API │
│  (Railway)   │  │  (Free)      │  │ (Paid/Free)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 📝 Next Steps

### **Immediate**
1. ✅ Run database migration
2. ✅ Test all endpoints
3. ✅ Verify stats display on frontend

### **Future Enhancements**
- [ ] Real-time pick result tracking via cron job
- [ ] Historical performance charts
- [ ] Coach leaderboard with weekly/monthly rankings
- [ ] Push notifications for high-confidence picks
- [ ] User-specific coach following system
- [ ] Advanced analytics dashboard

---

## 🐛 Troubleshooting

### **Database Connection Issues**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT NOW();"

# Check if tables exist
psql $DATABASE_URL -c "\dt"
```

### **API Not Returning Picks**
1. Check The Odds API key is set: `echo $THE_ODDS_API_KEY`
2. Verify API quota not exceeded: Check [dashboard](https://the-odds-api.com/account)
3. Check ESPN fallback working: Look for "Falling back to ESPN" in logs

### **Stats Not Updating**
```sql
-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'coach_picks';

-- Manually trigger stats update
SELECT update_coach_stats();
```

---

## 📚 Resources

- **The Odds API Docs:** https://the-odds-api.com/liveapi/guides/v4/
- **ESPN API (Unofficial):** https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b
- **PostgreSQL Triggers:** https://www.postgresql.org/docs/current/trigger-definition.html

---

## ✅ Deployment Checklist

- [x] All 11 coaches defined in backend
- [x] Database migration created
- [x] API endpoints implemented
- [x] ESPN integration working
- [x] The Odds API integration ready
- [x] Performance tracking system built
- [x] Automatic stat updates configured
- [x] Frontend syncing with backend stats
- [ ] Database migration run on Railway
- [ ] The Odds API key added to Railway
- [ ] Production testing complete

---

**Status:** Ready for database migration and production deployment! 🚀
