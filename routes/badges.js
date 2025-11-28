// ============================================
// BADGE ROUTES
// Referral milestone and achievement badges
// ============================================

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// ============================================
// BADGE DEFINITIONS
// ============================================

const BADGE_DEFINITIONS = {
    // Referral Milestone Badges
    'first_referral': {
        name: 'Friend Maker',
        description: 'Refer your first friend',
        icon: '👥',
        category: 'milestone',
        unlock_type: 'referral_count',
        unlock_value: 1,
        color: 'blue',
        rarity: 'common',
        points: 10
    },
    'five_referrals': {
        name: 'Influencer',
        description: 'Refer 5 friends',
        icon: '📢',
        category: 'milestone',
        unlock_type: 'referral_count',
        unlock_value: 5,
        color: 'green',
        rarity: 'uncommon',
        points: 25
    },
    'ten_referrals': {
        name: 'Ambassador',
        description: 'Refer 10 friends',
        icon: '🎖️',
        category: 'milestone',
        unlock_type: 'referral_count',
        unlock_value: 10,
        color: 'purple',
        rarity: 'rare',
        points: 50
    },
    'twenty_five_referrals': {
        name: 'Growth Hacker',
        description: 'Refer 25 friends',
        icon: '🚀',
        category: 'milestone',
        unlock_type: 'referral_count',
        unlock_value: 25,
        color: 'orange',
        rarity: 'epic',
        points: 100
    },
    'fifty_referrals': {
        name: 'Legend',
        description: 'Refer 50 friends',
        icon: '👑',
        category: 'milestone',
        unlock_type: 'referral_count',
        unlock_value: 50,
        color: 'gold',
        rarity: 'epic',
        points: 250
    },
    'hundred_referrals': {
        name: 'Viral Sensation',
        description: 'Refer 100 friends',
        icon: '🌟',
        category: 'milestone',
        unlock_type: 'referral_count',
        unlock_value: 100,
        color: 'red',
        rarity: 'legendary',
        points: 500
    },

    // Conversion Badges
    'first_pro_conversion': {
        name: 'PRO Hunter',
        description: 'Convert a friend to PRO',
        icon: '💎',
        category: 'tier',
        unlock_type: 'subscription_conversion',
        unlock_value: 1,
        color: 'blue',
        rarity: 'rare',
        points: 75
    },
    'five_pro_conversions': {
        name: 'PRO Master',
        description: 'Convert 5 friends to PRO',
        icon: '💎💎',
        category: 'tier',
        unlock_type: 'subscription_conversion',
        unlock_value: 5,
        color: 'purple',
        rarity: 'epic',
        points: 150
    },
    'first_vip_conversion': {
        name: 'VIP Recruiter',
        description: 'Convert a friend to VIP',
        icon: '👑',
        category: 'tier',
        unlock_type: 'subscription_conversion',
        unlock_value: 1,
        color: 'gold',
        rarity: 'epic',
        points: 200
    },
    'five_vip_conversions': {
        name: 'VIP Champion',
        description: 'Convert 5 friends to VIP',
        icon: '👑👑',
        category: 'tier',
        unlock_type: 'subscription_conversion',
        unlock_value: 5,
        color: 'red',
        rarity: 'legendary',
        points: 500
    },

    // Earnings Badges
    'earn_5k_coins': {
        name: 'Coin Collector',
        description: 'Earn 5,000 coins from referrals',
        icon: '🪙',
        category: 'special',
        unlock_type: 'coins_earned',
        unlock_value: 5000,
        color: 'yellow',
        rarity: 'common',
        points: 30
    },
    'earn_25k_coins': {
        name: 'Coin Master',
        description: 'Earn 25,000 coins from referrals',
        icon: '🏆',
        category: 'special',
        unlock_type: 'coins_earned',
        unlock_value: 25000,
        color: 'orange',
        rarity: 'epic',
        points: 200
    },
    'earn_100k_coins': {
        name: 'Millionaire',
        description: 'Earn 100,000 coins from referrals',
        icon: '💰',
        category: 'special',
        unlock_type: 'coins_earned',
        unlock_value: 100000,
        color: 'gold',
        rarity: 'legendary',
        points: 500
    }
};

// ============================================
// INITIALIZE BADGES (Called on server startup)
// ============================================

async function initializeBadges() {
    try {
        for (const [badgeId, badgeData] of Object.entries(BADGE_DEFINITIONS)) {
            const result = await query(
                'SELECT id FROM referral_badges WHERE id = $1',
                [badgeId]
            );

            if (result.rows.length === 0) {
                await query(
                    `INSERT INTO referral_badges 
                     (id, name, description, icon, category, unlock_type, unlock_value, color, rarity, points)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        badgeId,
                        badgeData.name,
                        badgeData.description,
                        badgeData.icon,
                        badgeData.category,
                        badgeData.unlock_type,
                        badgeData.unlock_value,
                        badgeData.color,
                        badgeData.rarity,
                        badgeData.points
                    ]
                );
            }
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('✅ Referral badges initialized');
        }
    } catch (error) {
        console.error('Error initializing badges:', error);
    }
}

// Call on module load
initializeBadges();

// ============================================
// GET ALL BADGES
// ============================================

router.get('/all', async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM referral_badges 
             ORDER BY rarity DESC, unlock_value ASC`
        );

        res.json({
            success: true,
            badges: result.rows
        });

    } catch (error) {
        console.error('Error getting badges:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get badges'
        });
    }
});

// ============================================
// GET USER'S BADGES
// ============================================

router.get('/my-badges', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await query(
            `SELECT 
                b.id,
                b.name,
                b.description,
                b.icon,
                b.category,
                b.rarity,
                b.points,
                b.color,
                ub.unlocked_at,
                ub.featured
             FROM referral_badges b
             LEFT JOIN user_referral_badges ub ON b.id = ub.badge_id AND ub.user_id = $1
             ORDER BY ub.unlocked_at DESC NULLS LAST`,
            [userId]
        );

        const unlockedBadges = result.rows.filter(b => b.unlocked_at);
        const lockedBadges = result.rows.filter(b => !b.unlocked_at);

        res.json({
            success: true,
            unlocked: unlockedBadges,
            locked: lockedBadges,
            total: result.rows.length,
            unlockedCount: unlockedBadges.length
        });

    } catch (error) {
        console.error('Error getting user badges:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user badges'
        });
    }
});

// ============================================
// FEATURED BADGE
// ============================================

router.post('/set-featured', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { badgeId } = req.body;

        if (!badgeId) {
            return res.status(400).json({
                success: false,
                error: 'Badge ID required'
            });
        }

        // Check user has this badge
        const badgeResult = await query(
            'SELECT id FROM user_referral_badges WHERE user_id = $1 AND badge_id = $2',
            [userId, badgeId]
        );

        if (badgeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Badge not unlocked'
            });
        }

        // Unfeature all others
        await query(
            'UPDATE user_referral_badges SET featured = FALSE WHERE user_id = $1',
            [userId]
        );

        // Feature this one
        await query(
            'UPDATE user_referral_badges SET featured = TRUE WHERE user_id = $1 AND badge_id = $2',
            [userId, badgeId]
        );

        res.json({
            success: true,
            message: 'Badge featured successfully'
        });

    } catch (error) {
        console.error('Error setting featured badge:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set featured badge'
        });
    }
});

// ============================================
// CHECK AND AWARD BADGES
// ============================================

router.post('/check-and-award', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user's referral stats
        const statsResult = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'completed') as completed_referrals,
                SUM(CASE WHEN u.subscription_tier = 'pro' THEN 1 ELSE 0 END) as pro_conversions,
                SUM(CASE WHEN u.subscription_tier = 'vip' THEN 1 ELSE 0 END) as vip_conversions
             FROM referrals r
             LEFT JOIN users u ON u.id = r.referee_id
             WHERE r.referrer_id = $1`,
            [userId]
        );

        const stats = statsResult.rows[0];
        const completedReferrals = parseInt(stats.completed_referrals) || 0;
        const proConversions = parseInt(stats.pro_conversions) || 0;
        const vipConversions = parseInt(stats.vip_conversions) || 0;

        // Get coins earned
        const coinsResult = await query(
            'SELECT COALESCE(SUM(coins_earned), 0) as total FROM referrals WHERE referrer_id = $1',
            [userId]
        );
        const coinsEarned = parseInt(coinsResult.rows[0].total) || 0;

        const newBadges = [];

        // Check each badge
        if (completedReferrals >= 1) await checkAndAwardBadge(userId, 'first_referral', newBadges);
        if (completedReferrals >= 5) await checkAndAwardBadge(userId, 'five_referrals', newBadges);
        if (completedReferrals >= 10) await checkAndAwardBadge(userId, 'ten_referrals', newBadges);
        if (completedReferrals >= 25) await checkAndAwardBadge(userId, 'twenty_five_referrals', newBadges);
        if (completedReferrals >= 50) await checkAndAwardBadge(userId, 'fifty_referrals', newBadges);
        if (completedReferrals >= 100) await checkAndAwardBadge(userId, 'hundred_referrals', newBadges);

        if (proConversions >= 1) await checkAndAwardBadge(userId, 'first_pro_conversion', newBadges);
        if (proConversions >= 5) await checkAndAwardBadge(userId, 'five_pro_conversions', newBadges);

        if (vipConversions >= 1) await checkAndAwardBadge(userId, 'first_vip_conversion', newBadges);
        if (vipConversions >= 5) await checkAndAwardBadge(userId, 'five_vip_conversions', newBadges);

        if (coinsEarned >= 5000) await checkAndAwardBadge(userId, 'earn_5k_coins', newBadges);
        if (coinsEarned >= 25000) await checkAndAwardBadge(userId, 'earn_25k_coins', newBadges);
        if (coinsEarned >= 100000) await checkAndAwardBadge(userId, 'earn_100k_coins', newBadges);

        res.json({
            success: true,
            newBadges: newBadges.map(b => ({
                id: b,
                ...BADGE_DEFINITIONS[b]
            }))
        });

    } catch (error) {
        console.error('Error checking badges:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check badges'
        });
    }
});

// Helper function to award badge
async function checkAndAwardBadge(userId, badgeId, newBadges) {
    try {
        const result = await query(
            'SELECT id FROM user_referral_badges WHERE user_id = $1 AND badge_id = $2',
            [userId, badgeId]
        );

        if (result.rows.length === 0) {
            await query(
                'INSERT INTO user_referral_badges (user_id, badge_id) VALUES ($1, $2)',
                [userId, badgeId]
            );
            newBadges.push(badgeId);
        }
    } catch (error) {
        console.error(`Error awarding badge ${badgeId}:`, error);
    }
}

// ============================================
// GET BADGE LEADERBOARD
// ============================================

router.get('/leaderboard', async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                u.id,
                u.username,
                u.avatar,
                u.level,
                COUNT(DISTINCT ub.badge_id) as badges_count,
                SUM(b.points) as badge_points
             FROM users u
             LEFT JOIN user_referral_badges ub ON u.id = ub.user_id
             LEFT JOIN referral_badges b ON ub.badge_id = b.id
             WHERE ub.badge_id IS NOT NULL
             GROUP BY u.id
             ORDER BY badge_points DESC, badges_count DESC
             LIMIT 100`,
            []
        );

        res.json({
            success: true,
            leaderboard: result.rows
        });

    } catch (error) {
        console.error('Error getting badge leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get leaderboard'
        });
    }
});

module.exports = router;
module.exports.BADGE_DEFINITIONS = BADGE_DEFINITIONS;
module.exports.initializeBadges = initializeBadges;
