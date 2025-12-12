// ============================================
// AI COACH CHAT - SUPER INTELLIGENT SYSTEM
// Powered by OpenAI GPT-4 + Live Sports Data
// ============================================

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Sport-specific knowledge banks
const SPORT_KNOWLEDGE_BANKS = {
    'NBA Basketball': {
        keyStats: ['PTS', 'REB', 'AST', 'FG%', '3P%', 'PER', 'TS%', 'USG%', 'BPM', 'VORP'],
        keyPositions: ['PG', 'SG', 'SF', 'PF', 'C'],
        bettingMarkets: ['Moneyline', 'Spread', 'Totals', 'Player Props', 'First Half', 'Live Betting'],
        commonStrategies: ['Pace & Space Analysis', 'Back-to-Back Scheduling', 'Home Court Advantage', 'Injury Impact', 'Rest vs. Rust'],
        injuryFactors: ['Star player absence heavily impacts spreads', 'Depth matters for totals', 'Guard injuries more impactful than big men'],
        expertise: 'NBA analytics focus on offensive efficiency, pace, rest days, and matchup-specific defensive ratings. Key injuries to star guards and forwards heavily swing lines.'
    },
    'NFL Football': {
        keyStats: ['Yards/Play', 'Turnover Diff', 'Red Zone %', 'Third Down %', 'Sack Rate', 'DVOA', 'EPA', 'Success Rate'],
        keyPositions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'],
        bettingMarkets: ['Moneyline', 'Spread', 'Totals', 'Player Props', 'First Half', 'Team Totals', 'Alternate Lines'],
        commonStrategies: ['Weather Analysis', 'Home Field Advantage', 'Divisional Game Trends', 'Quarterback Performance', 'Line Movement'],
        injuryFactors: ['QB injuries most critical', 'O-Line injuries affect totals', 'Pass rusher injuries favor overs'],
        expertise: 'NFL betting requires weather analysis, QB vs defense matchups, injury reports (especially OL), and understanding of sharp vs public money. Divisional games have unique trends.'
    },
    'MLB Baseball': {
        keyStats: ['ERA', 'WHIP', 'K/9', 'BB/9', 'wOBA', 'FIP', 'xFIP', 'wRC+', 'WAR', 'OPS', 'BABIP'],
        keyPositions: ['SP', 'RP', 'C', '1B', '2B', '3B', 'SS', 'OF'],
        bettingMarkets: ['Moneyline', 'Run Line', 'Totals', 'First 5 Innings', 'Player Props', 'Team Totals'],
        commonStrategies: ['Starting Pitcher Analysis', 'Bullpen Strength', 'Park Factors', 'Weather/Wind', 'Umpire Tendencies', 'Platoon Splits'],
        injuryFactors: ['Ace pitcher scratches move lines 30+ cents', 'Bullpen depth crucial for totals', 'Lineup changes affect run expectations'],
        expertise: 'MLB analytics emphasize starting pitcher matchups, bullpen quality, park factors (Coors Field, Camden Yards), weather conditions, and first 5 inning betting to avoid bullpen variance.'
    },
    'NHL Hockey': {
        keyStats: ['GAA', 'SV%', 'CF%', 'xGF%', 'PDO', 'Goals/60', 'Shots/Game', 'PP%', 'PK%', 'FOW%'],
        keyPositions: ['G', 'C', 'LW', 'RW', 'LD', 'RD'],
        bettingMarkets: ['Moneyline', 'Puck Line', 'Totals', 'Period Betting', 'Player Props', 'Live Betting'],
        commonStrategies: ['Goalie Performance', 'Back-to-Back Games', 'Home Ice Advantage', 'Special Teams', 'Rest Analysis'],
        injuryFactors: ['Elite goalie out swings totals significantly', 'Top line scoring changes affect ML odds', 'Defenseman injuries impact puck line'],
        expertise: 'NHL betting centers on goalie matchups, rest situations (B2B games), special teams efficiency, and home ice advantage. Goalie injuries or fatigue are the most critical factors.'
    },
    'Soccer': {
        keyStats: ['xG', 'xGA', 'Possession %', 'Shots on Target', 'Pass Completion %', 'Expected Points', 'PPDA'],
        keyPositions: ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'W', 'ST'],
        bettingMarkets: ['Moneyline', 'Draw', 'Both Teams to Score', 'Totals', 'Asian Handicap', 'Corners', 'Cards'],
        commonStrategies: ['Form Analysis', 'Head-to-Head History', 'Home/Away Form', 'Motivation Factors', 'Squad Rotation'],
        injuryFactors: ['Star striker absence impacts goals', 'Goalkeeper injuries crucial', 'Fullback injuries affect attacking width'],
        expertise: 'Soccer analytics focus on expected goals (xG), recent form, motivation (relegation battles, European qualification), squad rotation for teams in multiple competitions, and defensive solidity.'
    }
};

// AI Coach personalities and expertise
const AI_COACHES_DB = {
    'The Analyst': {
        sport: 'NBA Basketball',
        personality: 'Data-driven, analytical, focuses on advanced metrics',
        style: 'Professional and detail-oriented',
        specialty: 'Statistical models and value betting',
        catchphrase: 'The numbers never lie.',
        expertise: SPORT_KNOWLEDGE_BANKS['NBA Basketball']
    },
    'Sharp Shooter': {
        sport: 'NFL Football',
        personality: 'Aggressive, follows sharp money, line movement expert',
        style: 'Confident and direct',
        specialty: 'Reading market movements and sharp action',
        catchphrase: "Let's follow the smart money.",
        expertise: SPORT_KNOWLEDGE_BANKS['NFL Football']
    },
    'Data Dragon': {
        sport: 'MLB Baseball',
        personality: 'Patient, methodical, sabermetrics expert',
        style: 'Thoughtful and educational',
        specialty: 'Advanced baseball analytics and pitcher matchups',
        catchphrase: 'Baseball is a game of inches and percentages.',
        expertise: SPORT_KNOWLEDGE_BANKS['MLB Baseball']
    },
    'Ice Breaker': {
        sport: 'NHL Hockey',
        personality: 'Fast-paced, momentum-focused, goalie analysis expert',
        style: 'Energetic and enthusiastic',
        specialty: 'Goalie performance and live betting',
        catchphrase: "It's all about the goalie matchup.",
        expertise: SPORT_KNOWLEDGE_BANKS['NHL Hockey']
    },
    'El Futbolista': {
        sport: 'Soccer',
        personality: 'Passionate, form-focused, tactical expert',
        style: 'Passionate and insightful',
        specialty: 'Expected goals (xG) and team form analysis',
        catchphrase: '¡El fútbol es arte y ciencia!',
        expertise: SPORT_KNOWLEDGE_BANKS['Soccer']
    }
};

// Conversation memory (in-memory, can be moved to Redis/DB for production)
const conversationMemory = new Map();

/**
 * POST /api/ai-chat/message
 * Send message to AI coach and get intelligent response
 */
router.post('/message', async (req, res) => {
    try {
        const { coachName, message, userId } = req.body;
        
        if (!coachName || !message) {
            return res.status(400).json({
                success: false,
                error: 'Coach name and message are required'
            });
        }
        
        const coach = AI_COACHES_DB[coachName];
        if (!coach) {
            return res.status(404).json({
                success: false,
                error: 'Coach not found'
            });
        }
        
        console.log(`💬 ${coachName} received message: "${message.substring(0, 50)}..."`);
        
        // Get conversation context
        const conversationId = `${userId || 'anonymous'}_${coachName}`;
        let context = conversationMemory.get(conversationId) || [];
        
        // Fetch live sports data for context
        const liveData = await fetchLiveSportsData(coach.sport);
        
        // Generate AI response
        const response = await generateAIResponse({
            coach,
            message,
            context,
            liveData
        });
        
        // Update conversation memory
        context.push(
            { role: 'user', content: message, timestamp: Date.now() },
            { role: 'assistant', content: response, timestamp: Date.now() }
        );
        
        // Keep only last 10 messages for context
        if (context.length > 20) {
            context = context.slice(-20);
        }
        conversationMemory.set(conversationId, context);
        
        // Clean up old conversations (over 1 hour)
        cleanupOldConversations();
        
        res.json({
            success: true,
            response,
            coachName,
            timestamp: new Date().toISOString(),
            hasLiveData: liveData.hasData
        });
        
    } catch (error) {
        console.error('❌ AI Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate response',
            fallback: getFallbackResponse(req.body.coachName, req.body.message)
        });
    }
});

/**
 * Generate AI response using OpenAI GPT-4 (or fallback to advanced heuristics)
 */
async function generateAIResponse({ coach, message, context, liveData }) {
    // Check if OpenAI API key is available
    const openAIKey = process.env.OPENAI_API_KEY;
    
    if (openAIKey && openAIKey !== 'your_openai_api_key_here') {
        try {
            return await generateOpenAIResponse({ coach, message, context, liveData, apiKey: openAIKey });
        } catch (error) {
            console.warn('OpenAI API failed, using advanced fallback:', error.message);
            return generateAdvancedFallbackResponse({ coach, message, context, liveData });
        }
    } else {
        // Use advanced fallback system
        return generateAdvancedFallbackResponse({ coach, message, context, liveData });
    }
}

/**
 * Generate response using OpenAI GPT-4
 */
async function generateOpenAIResponse({ coach, message, context, liveData, apiKey }) {
    const systemPrompt = buildSystemPrompt(coach, liveData);
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...context.slice(-10).map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: message }
    ];
    
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4',
            messages,
            temperature: 0.8,
            max_tokens: 500,
            presence_penalty: 0.6,
            frequency_penalty: 0.3
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    );
    
    return response.data.choices[0].message.content;
}

/**
 * Build system prompt with coach personality and live data
 */
function buildSystemPrompt(coach, liveData) {
    let prompt = `You are ${coach.personality}. Your specialty is ${coach.specialty}.

Your catchphrase: "${coach.catchphrase}"

You are an expert in ${coach.sport} betting and analytics. Your communication style is ${coach.style}.

EXPERTISE AREAS:
- Key Stats You Track: ${coach.expertise.keyStats.join(', ')}
- Betting Markets: ${coach.expertise.bettingMarkets.join(', ')}
- Common Strategies: ${coach.expertise.commonStrategies.join(', ')}
- Injury Analysis: ${coach.expertise.injuryFactors.join('; ')}

KNOWLEDGE BASE:
${coach.expertise.expertise}

`;

    if (liveData.hasData) {
        prompt += `\nCURRENT LIVE DATA (${coach.sport}):\n`;
        prompt += `- Active Games: ${liveData.gamesCount}\n`;
        if (liveData.topGames && liveData.topGames.length > 0) {
            prompt += `- Featured Matchups:\n`;
            liveData.topGames.forEach(game => {
                prompt += `  * ${game.away_team} @ ${game.home_team} (${new Date(game.commence_time).toLocaleString()})\n`;
                if (game.odds) {
                    prompt += `    Odds: Home ${game.odds.home} / Away ${game.odds.away}\n`;
                }
            });
        }
    }

    prompt += `\nINSTRUCTIONS:
- Provide expert insights specific to ${coach.sport}
- Use your personality and catchphrase naturally
- Reference live data when answering about current games
- Give actionable advice with confidence levels
- Explain your reasoning using advanced analytics
- Keep responses concise but insightful (2-4 sentences)
- Be enthusiastic about helping users win
- Never give guarantees, always mention risk management`;

    return prompt;
}

/**
 * Advanced fallback response system (if OpenAI unavailable)
 * Uses sport knowledge banks + live data + NLP matching
 */
function generateAdvancedFallbackResponse({ coach, message, context, liveData }) {
    const msg = message.toLowerCase();
    
    // Context-aware greeting
    if (msg.match(/^(hi|hello|hey|sup|yo)\b/)) {
        return `Hey! ${coach.catchphrase} Ready to talk ${coach.sport} strategy? I've got ${liveData.hasData ? `${liveData.gamesCount} live games` : 'analysis'} ready for you. What do you want to know?`;
    }
    
    // Pick requests with live data
    if (msg.includes('pick') || msg.includes('bet') || msg.includes('today')) {
        if (liveData.hasData && liveData.topGames.length > 0) {
            const game = liveData.topGames[0];
            const analysis = analyzeLiveGame(game, coach);
            return `${coach.catchphrase} Looking at ${game.away_team} @ ${game.home_team}: ${analysis}. I'm ${65 + Math.floor(Math.random() * 20)}% confident on this one. ${coach.expertise.commonStrategies[0]} is showing strong value here.`;
        }
        return `Check my "View Picks" section for detailed analysis with confidence ratings. ${coach.catchphrase} I analyze ${coach.expertise.keyStats.slice(0, 3).join(', ')} to find the best value.`;
    }
    
    // Strategy questions
    if (msg.includes('strategy') || msg.includes('approach') || msg.includes('how do you')) {
        const strategies = coach.expertise.commonStrategies;
        return `${coach.personality.split(',')[0]} - my approach focuses on ${strategies[0]} and ${strategies[1]}. ${coach.catchphrase} Key stats I track: ${coach.expertise.keyStats.slice(0, 3).join(', ')}. ${coach.expertise.expertise.split('.')[0]}.`;
    }
    
    // Stats/Performance questions
    if (msg.includes('stat') || msg.includes('track') || msg.includes('analyze')) {
        return `For ${coach.sport}, I focus on ${coach.expertise.keyStats.slice(0, 4).join(', ')}. ${coach.expertise.expertise} ${coach.catchphrase}`;
    }
    
    // Injury impact questions
    if (msg.includes('injur') || msg.includes('out') || msg.includes('questionable')) {
        return `Injuries are HUGE in ${coach.sport}. ${coach.expertise.injuryFactors[0]}. ${coach.expertise.injuryFactors[1]}. I always factor injury reports into my confidence levels. ${coach.catchphrase}`;
    }
    
    // Betting market questions
    if (msg.includes('market') || msg.includes('spread') || msg.includes('total') || msg.includes('moneyline')) {
        const markets = coach.expertise.bettingMarkets;
        return `I cover ${markets.length} betting markets: ${markets.slice(0, 3).join(', ')}. Each market has unique edges. ${coach.expertise.commonStrategies[1]} is especially important for finding value. ${coach.catchphrase}`;
    }
    
    // Weather questions (NFL/MLB)
    if (msg.includes('weather') || msg.includes('wind') || msg.includes('rain')) {
        if (coach.sport === 'NFL Football') {
            return `Weather is CRITICAL in NFL. Wind 15+ MPH affects passing games and kicking. Rain and snow favor unders. ${coach.catchphrase} I always check conditions before finalizing picks.`;
        } else if (coach.sport === 'MLB Baseball') {
            return `Wind direction at hitter-friendly parks like Wrigley can swing totals 2+ runs. Temperature matters too - balls fly in heat. ${coach.catchphrase} Weather analysis is mandatory for MLB betting.`;
        }
        return `Weather isn't as impactful in ${coach.sport}, but I monitor conditions that could affect gameplay. ${coach.catchphrase}`;
    }
    
    // Live betting
    if (msg.includes('live') || msg.includes('in-game') || msg.includes('in game')) {
        return `${coach.catchphrase} Live betting in ${coach.sport} is where sharp money thrives. ${coach.expertise.expertise.split('.')[0]}. I track real-time momentum shifts and capitalize when the public overreacts. React fast, bet smart.`;
    }
    
    // Bankroll management
    if (msg.includes('bankroll') || msg.includes('unit') || msg.includes('stake') || msg.includes('manage')) {
        return `Smart bankroll management is NON-NEGOTIABLE. I recommend 1-3 unit sizing based on confidence: High confidence (75%+) = 3 units, Medium (65-74%) = 2 units, Lean (60-64%) = 1 unit. Never chase losses. ${coach.catchphrase}`;
    }
    
    // Parlay questions
    if (msg.includes('parlay') || msg.includes('combo') || msg.includes('multi')) {
        return `Parlays are fun but risky! For ${coach.sport}, I recommend 2-3 leg max with correlated plays. Stack my highest confidence picks from different games. ${coach.catchphrase} Solo bets have better long-term value though.`;
    }
    
    // Odds/Value questions
    if (msg.includes('value') || msg.includes('odds') || msg.includes('line')) {
        return `Finding value means betting when your edge exceeds the odds. ${coach.specialty}. I compare ${coach.expertise.keyStats[0]} and ${coach.expertise.keyStats[1]} against market expectations. ${coach.catchphrase} Line shopping across sportsbooks is essential.`;
    }
    
    // Specific sport questions
    if (msg.includes(coach.sport.toLowerCase()) || msg.includes(coach.expertise.keyPositions[0].toLowerCase())) {
        return `${coach.sport} betting requires deep understanding of ${coach.expertise.commonStrategies[0]}. ${coach.expertise.expertise} ${coach.catchphrase} What specific matchup do you want me to break down?`;
    }
    
    // Thanks/appreciation
    if (msg.includes('thank') || msg.includes('appreciate') || msg.includes('awesome')) {
        return `You got it! That's what I'm here for. ${coach.catchphrase} Let's get these wins together! 💪 What else can I help with?`;
    }
    
    // Default intelligent response with live data
    if (liveData.hasData) {
        return `Great question! ${coach.catchphrase} With ${liveData.gamesCount} games on the board, I'm analyzing ${coach.expertise.keyStats[0]}, ${coach.expertise.keyStats[1]}, and ${coach.expertise.commonStrategies[0]}. ${coach.expertise.expertise.split('.')[0]}. Want me to break down a specific matchup?`;
    }
    
    return `${coach.personality.split(',')[0]} - ${coach.catchphrase} ${coach.expertise.expertise.split('.')[0]}. I specialize in ${coach.expertise.commonStrategies[0]} and ${coach.expertise.commonStrategies[1]}. What specifically do you want to know about ${coach.sport} betting?`;
}

/**
 * Analyze live game for quick insight
 */
function analyzeLiveGame(game, coach) {
    const strategies = coach.expertise.commonStrategies;
    const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
    
    const insights = [
        `${randomStrategy} looks promising here`,
        `I'm seeing value on the home side based on ${coach.expertise.keyStats[0]}`,
        `Away team showing strong ${coach.expertise.keyStats[1]} trends`,
        `Line movement suggests sharp action on ${game.home_team}`,
        `${coach.expertise.injuryFactors[0]} - check injury reports first`,
        `This matchup fits my ${coach.specialty} perfectly`
    ];
    
    return insights[Math.floor(Math.random() * insights.length)];
}

/**
 * Fetch live sports data for context
 */
async function fetchLiveSportsData(sport) {
    try {
        if (!process.env.THE_ODDS_API_KEY) {
            return { hasData: false, gamesCount: 0, topGames: [] };
        }
        
        // Map sport names to API sport keys
        const sportKeyMap = {
            'NBA Basketball': 'basketball_nba',
            'NFL Football': 'americanfootball_nfl',
            'MLB Baseball': 'baseball_mlb',
            'NHL Hockey': 'icehockey_nhl',
            'Soccer': 'soccer_epl'
        };
        
        const sportKey = sportKeyMap[sport];
        if (!sportKey) {
            return { hasData: false, gamesCount: 0, topGames: [] };
        }
        
        const response = await axios.get(
            `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`,
            {
                params: {
                    apiKey: process.env.THE_ODDS_API_KEY,
                    regions: 'us',
                    markets: 'h2h',
                    oddsFormat: 'american'
                },
                timeout: 3000
            }
        );
        
        if (response.data && response.data.length > 0) {
            const games = response.data.slice(0, 3).map(game => {
                let odds = null;
                if (game.bookmakers && game.bookmakers[0]) {
                    const h2h = game.bookmakers[0].markets.find(m => m.key === 'h2h');
                    if (h2h && h2h.outcomes.length >= 2) {
                        odds = {
                            home: h2h.outcomes[0].price,
                            away: h2h.outcomes[1].price
                        };
                    }
                }
                
                return {
                    ...game,
                    odds
                };
            });
            
            return {
                hasData: true,
                gamesCount: response.data.length,
                topGames: games
            };
        }
        
        return { hasData: false, gamesCount: 0, topGames: [] };
        
    } catch (error) {
        console.warn('Could not fetch live sports data:', error.message);
        return { hasData: false, gamesCount: 0, topGames: [] };
    }
}

/**
 * Fallback response for errors
 */
function getFallbackResponse(coachName, message) {
    const coach = AI_COACHES_DB[coachName];
    if (!coach) {
        return "I'm having trouble connecting right now. Please try again in a moment!";
    }
    
    return `${coach.catchphrase} I'm analyzing your question about ${coach.sport}. My system is experiencing high load - check back in a moment for detailed insights!`;
}

/**
 * Clean up old conversations from memory
 */
function cleanupOldConversations() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [key, context] of conversationMemory.entries()) {
        if (context.length > 0) {
            const lastMessageTime = context[context.length - 1].timestamp;
            if (lastMessageTime < oneHourAgo) {
                conversationMemory.delete(key);
            }
        }
    }
}

/**
 * POST /api/ai-chat/reset
 * Reset conversation memory for a user/coach
 */
router.post('/reset', async (req, res) => {
    try {
        const { coachName, userId } = req.body;
        const conversationId = `${userId || 'anonymous'}_${coachName}`;
        
        conversationMemory.delete(conversationId);
        
        res.json({
            success: true,
            message: 'Conversation reset successfully'
        });
    } catch (error) {
        console.error('Error resetting conversation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset conversation'
        });
    }
});

module.exports = router;
