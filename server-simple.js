// ============================================
// MINIMAL BACKEND SERVER FOR TESTING
// ============================================

// Force immediate console output
process.stdout.write('🚀 STARTING SERVER\n');

const express = require('express');
const http = require('http');

process.stdout.write('✅ Dependencies imported\n');

const app = express();
const server = http.createServer(app);

process.stdout.write('✅ Express/HTTP created\n');

// Health endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', service: 'ultimate-sports-ai', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!', timestamp: new Date().toISOString() });
});

process.stdout.write('✅ Routes registered\n');

const PORT = process.env.PORT || 3001;

process.stdout.write(`📍 Attempting to listen on port ${PORT}...\n`);

server.listen(PORT, '0.0.0.0', () => {
    process.stdout.write(`✅ SERVER IS RUNNING ON PORT ${PORT}\n`);
    process.stdout.write(`📍 Health check available at http://localhost:${PORT}/health\n`);
});

server.on('error', (err) => {
    process.stdout.write(`❌ SERVER ERROR: ${err.message}\n`);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    process.stdout.write('SIGTERM received, shutting down gracefully\n');
    server.close(() => {
        process.stdout.write('Server closed\n');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    process.stdout.write('SIGINT received, shutting down gracefully\n');
    server.close(() => {
        process.stdout.write('Server closed\n');
        process.exit(0);
    });
});
