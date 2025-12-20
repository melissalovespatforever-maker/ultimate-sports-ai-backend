const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

console.log('🚀 Starting backend...');

const app = express();
const server = http.createServer(app);

let io;
try {
  io = new Server(server, { cors: { origin: '*' } });
  console.log('✅ Socket.io ready');
} catch (e) {
  console.log('⚠️  Socket.io skip');
}

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let authRoutes, twoFactorRoutes, userRoutes, socialRoutes, achievementsRoutes, analyticsRoutes;
let oddsRoutes, scoresRoutes, aiCoachesRoutes, aiChatRoutes, subscriptionsRoutes, adminRoutes;
let initCoachesRoutes, initCoachesGetRoutes, checkCoachesRoutes, shopRoutes, betsRoutes, passwordResetRoutes;

try { authRoutes = require('./routes/auth'); } catch (e) { authRoutes = require('express').Router(); }
try { twoFactorRoutes = require('./routes/two-factor'); } catch (e) { twoFactorRoutes = require('express').Router(); }
try { userRoutes = require('./routes/users'); } catch (e) { userRoutes = require('express').Router(); }
try { socialRoutes = require('./routes/social'); } catch (e) { socialRoutes = require('express').Router(); }
try { achievementsRoutes = require('./routes/achievements'); } catch (e) { achievementsRoutes = require('express').Router(); }
try { analyticsRoutes = require('./routes/analytics'); } catch (e) { analyticsRoutes = require('express').Router(); }
try { oddsRoutes = require('./routes/odds'); } catch (e) { oddsRoutes = require('express').Router(); }
try { scoresRoutes = require('./routes/scores'); } catch (e) { scoresRoutes = require('express').Router(); }
try { aiCoachesRoutes = require('./routes/ai-coaches'); } catch (e) { aiCoachesRoutes = require('express').Router(); }
try { aiChatRoutes = require('./routes/ai-chat'); } catch (e) { aiChatRoutes = require('express').Router(); }
try { subscriptionsRoutes = require('./routes/subscriptions'); } catch (e) { subscriptionsRoutes = require('express').Router(); }
try { adminRoutes = require('./routes/admin'); } catch (e) { adminRoutes = require('express').Router(); }
try { initCoachesRoutes = require('./routes/init-coaches'); } catch (e) { initCoachesRoutes = require('express').Router(); }
try { initCoachesGetRoutes = require('./routes/init-coaches-get'); } catch (e) { initCoachesGetRoutes = require('express').Router(); }
try { checkCoachesRoutes = require('./routes/check-coaches'); } catch (e) { checkCoachesRoutes = require('express').Router(); }
try { shopRoutes = require('./routes/shop'); } catch (e) { shopRoutes = require('express').Router(); }
try { betsRoutes = require('./routes/bets'); } catch (e) { betsRoutes = require('express').Router(); }
try { passwordResetRoutes = require('./routes/password-reset'); } catch (e) { passwordResetRoutes = require('express').Router(); }

let authenticateToken = (req, res, next) => next();
let errorHandler = (err, req, res, next) => res.status(500).json({ error: 'Server error' });

try { authenticateToken = require('./middleware/auth').authenticateToken; } catch (e) {}
try { errorHandler = require('./middleware/errorHandler').errorHandler; } catch (e) {}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', message: 'Backend running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ultimate-sports-ai-backend', version: '2.0.0' });
});

app.get('/api/test/games', (req, res) => {
  res.json({ success: true, message: 'Backend API working' });
});

app.get('/api/ai-coaches/picks', (req, res) => {
  res.json({ success: true, coaches: [{ id: 1, name: 'The Analyst', accuracy: 74.2 }] });
});

app.get('/api/live-dashboard/config', (req, res) => {
  res.json({ success: true, oddsApiKey: process.env.THE_ODDS_API_KEY });
});

app.get('/api/debug/config', (req, res) => {
  res.json({ environment: process.env.NODE_ENV, nodeVersion: process.version });
});

app.use('/api/auth', authRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/social', authenticateToken, socialRoutes);
app.use('/api/achievements', authenticateToken, achievementsRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/odds', oddsRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/ai-coaches', aiCoachesRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/bets', authenticateToken, betsRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/init-coaches', initCoachesRoutes);
app.use('/api/init-coaches-now', initCoachesGetRoutes);
app.use('/api/check-coaches', checkCoachesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏈 Ultimate Sports AI Backend Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('✅ Server is ready to accept connections');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing gracefully...');
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };
    
