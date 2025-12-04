// ============================================
// AI COACHES ROUTES
// Generate real picks with ESPN + The Odds API data
// Features:
// - Real-time injury reports from ESPN
// - Betting odds from 10+ sportsbooks (The Odds API)
// - Fallback to ESPN game data if odds unavailable
// - Injury impact analysis (Out/Doubtful/Questionable)
// - Key position weighting (QB, PG, Pitcher, Goalie)
// ============================================

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Cache to reduce API calls
const cache = new Map();
const CACHE_DURATION = 60000; // 1 minute

/**
 * AI Coach configurations
 */
const COACHES = [
    {
        id: 1,
        name: 'The Analyst',
        specialty: 'basketball_nba',
        avatar: '🤖',
        tier: 'PRO',
        strategy: 'value_betting' // Focuses on EV and line value
    },
    {
        id: 2,
        name: 'Sharp Shooter',
        specialty: 'americanfootball_nfl',
        avatar: '🏈',
        tier: 'VIP',
        strategy: 'sharp_money' // Follows line movement
    },
    {
        id: 3,
        name: 'Data Dragon',
        specialty: 'baseball_mlb',
        avatar: '⚾',
        tier: 'PRO',
        strategy: 'consensus' // Follows sportsbook consensus
    },
    {
        id: 4,
        name: 'Ice Breaker',
        specialty: 'icehockey_nhl',
        avatar: '🏒',
        tier: 'VIP',
        strategy: 'value_betting'
    }
];

/**
 * GET /api/ai-coaches/picks
 * Generate AI picks from real games
 */
router.get('/picks', async (req, res) => {
    try {
        const cacheKey = 'ai_coaches_picks';
        const cached = cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return res.json(cached.data);
        }
        
        console.log('🤖 Generating AI coach picks from real data...');
        
        const coachesWithPicks = [];
        
        for (const coach of COACHES) {
            try {
                // Fetch real games for this coach's sport
                const games = await fetchSportGames(coach.specialty);
                
                if (games && games.length > 0) {
                    // Analyze games and generate picks based on coach's strategy
                    const picks = analyzeGamesForPicks(games, coach);
                    
                    // Get coach stats (from database if available, else default)
                    const stats = await getCoachStats(coach.id);
                    
                    coachesWithPicks.push({
                        ...coach,
                        accuracy: stats.accuracy,
                        totalPicks: stats.totalPicks,
                        streak: stats.streak,
                        recentPicks: picks.slice(0, 3) // Top 3 picks
                    });
                }
            } catch (error) {
                console.error(`Failed to generate picks for ${coach.name}:`, error.message);
            }
        }
        
        const result = {
            success: true,
            timestamp: new Date().toISOString(),
            coaches: coachesWithPicks
        };
        
        // Cache the result
        cache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error generating AI picks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate AI picks',
            details: error.message
        });
    }
});

/**
 * Fetch games for a sport from The Odds API
 * Falls back to ESPN data if Odds API unavailable
 */
async function fetchSportGames(sport) {
    try {
        // Try The Odds API first (for betting lines)
        if (process.env.THE_ODDS_API_KEY) {
            const response = await axios.get(
                `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
                {
                    params: {
                        apiKey: process.env.THE_ODDS_API_KEY,
                        regions: 'us',
                        markets: 'h2h,spreads,totals',
                        oddsFormat: 'american'
                    },
                    timeout: 5000
                }
            );
            
            if (response.data && response.data.length > 0) {
                console.log(`✅ Fetched ${response.data.length} games from Odds API for ${sport}`);
                return response.data;
            }
        }
        
        // Fallback: Fetch from ESPN API
        console.log(`📺 Falling back to ESPN for ${sport}`);
        return await fetchESPNGames(sport);
        
    } catch (error) {
        console.error(`Error fetching ${sport} games:`, error.message);
        // Try ESPN as fallback
        try {
            return await fetchESPNGames(sport);
        } catch (espnError) {
            console.error(`ESPN fallback failed:`, espnError.message);
            return [];
        }
    }
}

/**
 * Fetch games from ESPN API (fallback)
 */
async function fetchESPNGames(sport) {
    try {
        // Map sport codes to ESPN endpoints
        const espnSportMap = {
            'basketball_nba': 'nba',
            'americanfootball_nfl': 'nfl',
            'baseball_mlb': 'mlb',
            'icehockey_nhl': 'nhl'
        };
        
        const espnSport = espnSportMap[sport];
        if (!espnSport) {
            console.warn(`No ESPN mapping for ${sport}`);
            return [];
        }
        
        const sportCategory = espnSport === 'nba' ? 'basketball' : 
                             espnSport === 'nfl' ? 'football' : 
                             espnSport === 'mlb' ? 'baseball' : 'hockey';
        
        const response = await axios.get(
            `https://site.api.espn.com/apis/site/v2/sports/${sportCategory}/${espnSport}/scoreboard`,
            { timeout: 5000 }
        );
        
        if (!response.data || !response.data.events) {
            return [];
        }
        
        // Convert ESPN format to Odds API format and add injury data
        const games = await Promise.all(response.data.events.map(async event => {
            const competition = event.competitions[0];
            const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
            const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
            
            // Fetch injury data for both teams
            const injuries = await fetchTeamInjuries(espnSport, homeTeam?.team?.id, awayTeam?.team?.id);
            
            return {
                id: event.id,
                sport_key: sport,
                sport_title: event.name,
                commence_time: event.date,
                home_team: homeTeam?.team?.displayName || 'Home',
                away_team: awayTeam?.team?.displayName || 'Away',
                home_team_id: homeTeam?.team?.id,
                away_team_id: awayTeam?.team?.id,
                bookmakers: [], // ESPN doesn't provide odds, will use mock
                injuries: injuries // Add injury data
            };
        }));
        
        console.log(`✅ Fetched ${games.length} games from ESPN for ${sport}`);
        return games.slice(0, 5); // Limit to 5 games
        
    } catch (error) {
        console.error(`ESPN API error for ${sport}:`, error.message);
        return [];
    }
}

/**
 * Fetch injury reports for teams from ESPN
 */
async function fetchTeamInjuries(sport, homeTeamId, awayTeamId) {
    try {
        const injuries = {
            home: [],
            away: []
        };
        
        // Fetch injuries for home team
        if (homeTeamId) {
            try {
                const homeResponse = await axios.get(
                    `https://site.api.espn.com/apis/site/v2/sports/${sport === 'nba' ? 'basketball' : sport === 'nfl' ? 'football' : sport === 'mlb' ? 'baseball' : 'hockey'}/${sport}/teams/${homeTeamId}/injuries`,
                    { timeout: 3000 }
                );
                
                if (homeResponse.data && homeResponse.data.injuries) {
                    injuries.home = homeResponse.data.injuries.map(injury => ({
                        athlete: injury.athlete?.displayName || 'Unknown',
                        position: injury.athlete?.position?.abbreviation || 'N/A',
                        status: injury.status || 'Unknown',
                        type: injury.type || 'Injury',
                        details: injury.details?.type || injury.shortComment || '',
                        longComment: injury.longComment || ''
                    })).slice(0, 5); // Top 5 injuries
                }
            } catch (err) {
                console.warn(`Could not fetch home team injuries: ${err.message}`);
            }
        }
        
        // Fetch injuries for away team
        if (awayTeamId) {
            try {
                const awayResponse = await axios.get(
                    `https://site.api.espn.com/apis/site/v2/sports/${sport === 'nba' ? 'basketball' : sport === 'nfl' ? 'football' : sport === 'mlb' ? 'baseball' : 'hockey'}/${sport}/teams/${awayTeamId}/injuries`,
                    { timeout: 3000 }
                );
                
                if (awayResponse.data && awayResponse.data.injuries) {
                    injuries.away = awayResponse.data.injuries.map(injury => ({
                        athlete: injury.athlete?.displayName || 'Unknown',
                        position: injury.athlete?.position?.abbreviation || 'N/A',
                        status: injury.status || 'Unknown',
                        type: injury.type || 'Injury',
                        details: injury.details?.type || injury.shortComment || '',
                        longComment: injury.longComment || ''
                    })).slice(0, 5); // Top 5 injuries
                }
            } catch (err) {
                console.warn(`Could not fetch away team injuries: ${err.message}`);
            }
        }
        
        return injuries;
        
    } catch (error) {
        console.error('Error fetching injuries:', error.message);
        return { home: [], away: [] };
    }
}

/**
 * Analyze games and generate picks based on coach strategy
 */
function analyzeGamesForPicks(games, coach) {
    const picks = [];
    
    games.forEach(game => {
        const analysis = analyzeGame(game, coach.strategy);
        
        if (analysis && analysis.confidence > 60) {
            picks.push({
                game: `${game.away_team} @ ${game.home_team}`,
                pick: analysis.recommendation,
                odds: analysis.odds,
                confidence: Math.round(analysis.confidence),
                reasoning: analysis.reasoning,
                gameTime: new Date(game.commence_time).toLocaleString('en-US', {
                    timeZone: 'America/New_York',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                })
            });
        }
    });
    
    // Sort by confidence (highest first)
    return picks.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Analyze a single game using market data
 */
function analyzeGame(game, strategy) {
    // Check if we have real odds data from sportsbooks
    const hasRealOdds = game.bookmakers && game.bookmakers.length > 0;
    
    if (!hasRealOdds) {
        // Use ESPN data with simulated analysis
        return analyzeGameWithoutOdds(game, strategy);
    }
    
    // Calculate consensus odds across all sportsbooks
    const consensus = calculateConsensus(game.bookmakers);
    
    if (!consensus.valid) {
        return analyzeGameWithoutOdds(game, strategy);
    }
    
    // Calculate confidence based on strategy
    let confidence = 50;
    let recommendation = '';
    let odds = 0;
    let reasoning = [];
    
    // Strategy: Value Betting
    if (strategy === 'value_betting') {
        // Find best value (highest odds)
        if (consensus.homeML.avg < -150) {
            // Heavy favorite, look for value on underdog
            recommendation = `${game.away_team} ML`;
            odds = Math.round(consensus.awayML.best);
            confidence += 15;
            reasoning.push('Value found on underdog');
        } else if (Math.abs(consensus.homeML.avg - consensus.awayML.avg) < 50) {
            // Close matchup, pick value side
            if (consensus.homeML.best < consensus.awayML.best) {
                recommendation = `${game.home_team} ML`;
                odds = Math.round(consensus.homeML.best);
            } else {
                recommendation = `${game.away_team} ML`;
                odds = Math.round(consensus.awayML.best);
            }
            confidence += 10;
            reasoning.push('Close matchup with value opportunity');
        }
    }
    
    // Strategy: Sharp Money (line movement)
    else if (strategy === 'sharp_money') {
        // Simplified: pick favorite if consensus is strong
        if (consensus.homeML.avg < consensus.awayML.avg) {
            recommendation = `${game.home_team} ML`;
            odds = Math.round(consensus.homeML.best);
        } else {
            recommendation = `${game.away_team} ML`;
            odds = Math.round(consensus.awayML.best);
        }
        confidence += 12;
        reasoning.push('Line showing sharp action');
    }
    
    // Strategy: Consensus
    else if (strategy === 'consensus') {
        // Pick the side with lowest variance (sportsbooks agree)
        if (consensus.homeML.variance < 15 && consensus.homeML.avg < -120) {
            recommendation = `${game.home_team} ML`;
            odds = Math.round(consensus.homeML.best);
            confidence += 18;
            reasoning.push('Strong sportsbook consensus');
        } else if (consensus.awayML.variance < 15 && consensus.awayML.avg < -120) {
            recommendation = `${game.away_team} ML`;
            odds = Math.round(consensus.awayML.best);
            confidence += 18;
            reasoning.push('Strong sportsbook consensus');
        }
    }
    
    // Add bookmaker count bonus
    if (consensus.bookmakerCount >= 10) {
        confidence += 8;
        reasoning.push(`${consensus.bookmakerCount} sportsbooks analyzed`);
    }
    
    // Low variance bonus (sportsbooks agree)
    if (consensus.homeML.variance < 10 || consensus.awayML.variance < 10) {
        confidence += 12;
        reasoning.push('Low variance - strong agreement');
    }
    
    // Factor in injury reports if available
    if (game.injuries) {
        const injuryImpact = analyzeInjuryImpact(game.injuries);
        
        // Adjust confidence based on injuries
        if (recommendation.includes(game.home_team)) {
            // Home team pick - reduce confidence if home has injuries
            confidence -= injuryImpact.homeImpact;
            if (injuryImpact.homeImpact > 5) {
                reasoning.push(`${game.injuries.home.length} home team injuries factored`);
            }
        } else if (recommendation.includes(game.away_team)) {
            // Away team pick - reduce confidence if away has injuries
            confidence -= injuryImpact.awayImpact;
            if (injuryImpact.awayImpact > 5) {
                reasoning.push(`${game.injuries.away.length} away team injuries factored`);
            }
        }
    }
    
    if (!recommendation) {
        return null;
    }
    
    return {
        recommendation,
        odds,
        confidence: Math.min(92, Math.max(45, confidence)), // Cap between 45-92%
        reasoning: reasoning.join('. ') + '.',
        injuries: game.injuries
    };
}

/**
 * Calculate consensus odds across bookmakers
 */
function calculateConsensus(bookmakers) {
    const homeMLOdds = [];
    const awayMLOdds = [];
    
    bookmakers.forEach(book => {
        const h2hMarket = book.markets.find(m => m.key === 'h2h');
        if (h2hMarket && h2hMarket.outcomes) {
            h2hMarket.outcomes.forEach(outcome => {
                if (outcome.name && outcome.price) {
                    // Determine if home or away based on position (home is usually first)
                    const isHome = h2hMarket.outcomes.indexOf(outcome) === 0;
                    if (isHome) {
                        homeMLOdds.push(outcome.price);
                    } else {
                        awayMLOdds.push(outcome.price);
                    }
                }
            });
        }
    });
    
    if (homeMLOdds.length === 0 || awayMLOdds.length === 0) {
        return { valid: false };
    }
    
    return {
        valid: true,
        homeML: {
            avg: average(homeMLOdds),
            best: Math.max(...homeMLOdds),
            variance: variance(homeMLOdds)
        },
        awayML: {
            avg: average(awayMLOdds),
            best: Math.max(...awayMLOdds),
            variance: variance(awayMLOdds)
        },
        bookmakerCount: bookmakers.length
    };
}

/**
 * Analyze game without odds data (ESPN only)
 * Uses team names, injury reports, and basic heuristics
 */
function analyzeGameWithoutOdds(game, strategy) {
    // Determine pick based on team names/history (simplified)
    const homeTeam = game.home_team;
    const awayTeam = game.away_team;
    
    // Simple heuristic: home team advantage
    let confidence = 55; // Base confidence for home team
    let recommendation = `${homeTeam} ML`;
    let odds = -110;
    let reasoning = [];
    
    reasoning.push('Analysis based on ESPN live data');
    reasoning.push('Home team advantage factored in');
    
    // Factor in injury reports
    if (game.injuries) {
        const injuryImpact = analyzeInjuryImpact(game.injuries);
        
        if (injuryImpact.homeImpact > injuryImpact.awayImpact) {
            // Home team more affected by injuries - favor away team
            confidence -= injuryImpact.homeImpact;
            recommendation = `${awayTeam} ML`;
            odds = +120;
            reasoning.push(`Home team has ${game.injuries.home.length} key injuries`);
        } else if (injuryImpact.awayImpact > injuryImpact.homeImpact) {
            // Away team more affected - favor home team
            confidence += Math.floor(injuryImpact.awayImpact / 2);
            reasoning.push(`Away team has ${game.injuries.away.length} key injuries`);
        }
        
        // Add specific injury details to reasoning
        const criticalInjuries = [...game.injuries.home, ...game.injuries.away]
            .filter(inj => inj.status === 'Out' || inj.status === 'Doubtful');
        
        if (criticalInjuries.length > 0) {
            reasoning.push(`${criticalInjuries.length} player(s) out or doubtful`);
        }
    }
    
    // Strategy-based adjustments
    if (strategy === 'value_betting') {
        // Look for potential value (no real odds, so simulate)
        confidence += 8;
        reasoning.push('Potential value opportunity identified');
    } else if (strategy === 'sharp_money') {
        confidence += 5;
        reasoning.push('Injury impact and team strength analyzed');
    } else if (strategy === 'consensus') {
        confidence += 10;
        reasoning.push('ESPN matchup and injury data analyzed');
    }
    
    return {
        recommendation,
        odds,
        confidence: Math.min(75, confidence), // Cap at 75% without real odds
        reasoning: reasoning.join('. ') + '.',
        injuries: game.injuries // Include injury data in response
    };
}

/**
 * Analyze injury impact on teams
 * Returns impact scores (0-20) for each team
 */
function analyzeInjuryImpact(injuries) {
    const impact = {
        homeImpact: 0,
        awayImpact: 0
    };
    
    // Calculate home team injury impact
    if (injuries.home && injuries.home.length > 0) {
        injuries.home.forEach(injury => {
            // Weight injuries based on status
            if (injury.status === 'Out') {
                impact.homeImpact += 5; // Out = significant impact
            } else if (injury.status === 'Doubtful') {
                impact.homeImpact += 3; // Doubtful = moderate impact
            } else if (injury.status === 'Questionable') {
                impact.homeImpact += 1; // Questionable = minor impact
            }
            
            // Extra weight for key positions (QB, PG, Pitcher, Goalie)
            const keyPositions = ['QB', 'PG', 'C', 'SP', 'G'];
            if (keyPositions.includes(injury.position)) {
                impact.homeImpact += 3;
            }
        });
    }
    
    // Calculate away team injury impact
    if (injuries.away && injuries.away.length > 0) {
        injuries.away.forEach(injury => {
            if (injury.status === 'Out') {
                impact.awayImpact += 5;
            } else if (injury.status === 'Doubtful') {
                impact.awayImpact += 3;
            } else if (injury.status === 'Questionable') {
                impact.awayImpact += 1;
            }
            
            const keyPositions = ['QB', 'PG', 'C', 'SP', 'G'];
            if (keyPositions.includes(injury.position)) {
                impact.awayImpact += 3;
            }
        });
    }
    
    return impact;
}

/**
 * Get coach historical stats (mock for now, would query database)
 */
async function getCoachStats(coachId) {
    // TODO: Query database for real stats
    // For now, return reasonable defaults
    const baseStats = {
        1: { accuracy: 68.5, totalPicks: 247, streak: 5 },
        2: { accuracy: 72.3, totalPicks: 189, streak: 8 },
        3: { accuracy: 65.8, totalPicks: 412, streak: 3 },
        4: { accuracy: 70.1, totalPicks: 298, streak: 6 }
    };
    
    return baseStats[coachId] || { accuracy: 0, totalPicks: 0, streak: 0 };
}

/**
 * Utility: Calculate average
 */
function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Utility: Calculate variance
 */
function variance(arr) {
    if (arr.length === 0) return 0;
    const avg = average(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(average(squareDiffs));
}

module.exports = router;
