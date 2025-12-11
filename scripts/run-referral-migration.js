// ============================================
// REFERRAL MIGRATION ROUTE
// Visit /api/run-referral-migration in browser
// ============================================

const express = require('express');
const router = express.Router();
const { runReferralMigration } = require('../scripts/run-referral-migration');

// GET endpoint - visit in browser
router.get('/', async (req, res) => {
    try {
        console.log('🔧 Running referral migration via browser...');
        
        const result = await runReferralMigration();
        
        // Return HTML response (pretty for browser)
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Migration Complete! ✅</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .card {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 40px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    }
                    h1 { font-size: 3rem; margin: 0 0 20px 0; }
                    .emoji { font-size: 5rem; }
                    .success { color: #10b981; font-size: 1.5rem; font-weight: bold; }
                    .tables { 
                        background: rgba(0,0,0,0.2);
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                        font-family: monospace;
                    }
                    .table-item {
                        padding: 8px 0;
                        border-bottom: 1px solid rgba(255,255,255,0.2);
                    }
                    .btn {
                        display: inline-block;
                        padding: 15px 30px;
                        background: #10b981;
                        color: white;
                        text-decoration: none;
                        border-radius: 10px;
                        font-weight: bold;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="emoji">🎉</div>
                    <h1>Migration Complete!</h1>
                    <p class="success">✅ Referral system is now active!</p>
                    
                    <h3>Tables Created:</h3>
                    <div class="tables">
                        ${result.tables.map(table => `
                            <div class="table-item">✅ ${table}</div>
                        `).join('')}
                    </div>
                    
                    <p>
                        Your referral system is now ready to use! Users can now:
                    </p>
                    <ul>
                        <li>Get unique referral codes</li>
                        <li>Share with friends</li>
                        <li>Earn coins and rewards</li>
                        <li>Climb the leaderboard</li>
                        <li>Unlock milestones</li>
                    </ul>
                    
                    <a href="/referral-program.html" class="btn">
                        View Referral Program →
                    </a>
                    
                    <p style="margin-top: 40px; font-size: 0.9rem; opacity: 0.7;">
                        Note: You can safely close this page. The migration only runs once.
                    </p>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        
        // Return error HTML
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Migration Error ❌</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                        color: white;
                    }
                    .card {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 40px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    }
                    h1 { font-size: 3rem; margin: 0 0 20px 0; }
                    .emoji { font-size: 5rem; }
                    .error {
                        background: rgba(0,0,0,0.3);
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                        font-family: monospace;
                        font-size: 0.9rem;
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="emoji">❌</div>
                    <h1>Migration Failed</h1>
                    <p>Don't worry! This might mean the tables already exist.</p>
                    
                    <div class="error">
                        ${error.message}
                    </div>
                    
                    <h3>Common Solutions:</h3>
                    <ul>
                        <li>Tables might already exist (that's OK!)</li>
                        <li>Try refreshing this page</li>
                        <li>Check Railway logs for details</li>
                        <li>Contact support if persists</li>
                    </ul>
                    
                    <p style="margin-top: 40px; font-size: 0.9rem; opacity: 0.7;">
                        Error code: ${error.code || 'UNKNOWN'}
                    </p>
                </div>
            </body>
            </html>
        `);
    }
});

module.exports = router;
