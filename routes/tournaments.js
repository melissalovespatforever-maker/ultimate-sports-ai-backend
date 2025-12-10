// ============================================
// TOURNAMENT SYSTEM
// Complete bracket tournament with entry fees
// ============================================

console.log('🏆 Loading Tournament System');

const TournamentSystem = {
    
    // Get user data
    getUserData() {
        return {
            username: localStorage.getItem('guestUsername') || 'Guest User',
            avatar: localStorage.getItem('guestAvatar') || '🎮',
            balance: parseInt(localStorage.getItem('sportsLoungeBalance') || '975'),
            tournamentsWon: parseInt(localStorage.getItem('tournamentsWon') || '0'),
            totalWinnings: parseInt(localStorage.getItem('totalWinnings') || '0')
        };
    },

    // Save user data
    saveUserData(data) {
        if (data.balance !== undefined) {
            localStorage.setItem('sportsLoungeBalance', data.balance.toString());
        }
        if (data.tournamentsWon !== undefined) {
            localStorage.setItem('tournamentsWon', data.tournamentsWon.toString());
        }
        if (data.totalWinnings !== undefined) {
            localStorage.setItem('totalWinnings', data.totalWinnings.toString());
        }
    },

    // Get tournaments from localStorage
    getTournaments() {
        const stored = localStorage.getItem('tournaments');
        if (stored) {
            return JSON.parse(stored);
        }
        return this.generateInitialTournaments();
    },

    // Save tournaments
    saveTournaments(tournaments) {
        localStorage.setItem('tournaments', JSON.stringify(tournaments));
    },

    // Generate initial tournaments
    generateInitialTournaments() {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        return [
            {
                id: 'daily-free-1',
                name: 'Daily Quick Fire',
                type: 'Single Elimination',
                entryFee: 0,
                prizePool: 500,
                maxPlayers: 16,
                players: [],
                format: 'Beat the Streak',
                status: 'registering',
                tier: 'free',
                startTime: now + (2 * 60 * 60 * 1000), // 2 hours
                duration: 30, // minutes
                bracket: null
            },
            {
                id: 'bronze-1',
                name: 'Bronze League',
                type: 'Single Elimination',
                entryFee: 50,
                prizePool: 400,
                maxPlayers: 16,
                players: [],
                format: 'Parlay Battle',
                status: 'registering',
                tier: 'premium',
                startTime: now + (4 * 60 * 60 * 1000), // 4 hours
                duration: 45,
                bracket: null
            },
            {
                id: 'silver-1',
                name: 'Silver Championship',
                type: 'Single Elimination',
                entryFee: 100,
                prizePool: 1000,
                maxPlayers: 32,
                players: [],
                format: 'Parlay Battle',
                status: 'registering',
                tier: 'premium',
                startTime: now + (6 * 60 * 60 * 1000),
                duration: 60,
                bracket: null
            },
            {
                id: 'gold-1',
                name: 'Gold Masters',
                type: 'Single Elimination',
                entryFee: 250,
                prizePool: 5000,
                maxPlayers: 32,
                players: [],
                format: 'Mixed Games',
                status: 'registering',
                tier: 'vip',
                startTime: now + (12 * 60 * 60 * 1000),
                duration: 90,
                bracket: null
            },
            {
                id: 'weekend-1',
                name: 'Weekend Warriors',
                type: 'Double Elimination',
                entryFee: 150,
                prizePool: 3000,
                maxPlayers: 64,
                players: [],
                format: 'All Games',
                status: 'registering',
                tier: 'premium',
                startTime: now + (2 * day),
                duration: 120,
                bracket: null
            },
            {
                id: 'mega-1',
                name: 'Mega Showdown',
                type: 'Single Elimination',
                entryFee: 500,
                prizePool: 20000,
                maxPlayers: 64,
                players: [],
                format: 'All Games',
                status: 'upcoming',
                tier: 'vip',
                startTime: now + (7 * day),
                duration: 180,
                bracket: null
            }
        ];
    },

    // Initialize
    init() {
        console.log('🏆 Initializing Tournament System');
        
        this.loadUserStats();
        this.setupTabs();
        this.renderAvailableTournaments();
        this.renderActiveTournaments();
        this.renderCompletedTournaments();
        this.updateTournamentStatuses();

        // Update every minute
        setInterval(() => this.updateTournamentStatuses(), 60000);
    },

    // Load user stats
    loadUserStats() {
        const userData = this.getUserData();
        
        document.getElementById('user-balance').textContent = userData.balance.toLocaleString();
        document.getElementById('tournaments-won').textContent = userData.tournamentsWon;
        document.getElementById('total-winnings').textContent = userData.totalWinnings.toLocaleString();
        
        // Calculate rank
        let rank = 'Unranked';
        if (userData.tournamentsWon >= 10) rank = 'Champion';
        else if (userData.tournamentsWon >= 5) rank = 'Master';
        else if (userData.tournamentsWon >= 3) rank = 'Expert';
        else if (userData.tournamentsWon >= 1) rank = 'Veteran';
        
        document.getElementById('current-rank').textContent = rank;
    },

    // Setup tabs
    setupTabs() {
        const tabs = document.querySelectorAll('.tournament-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show corresponding content
                const tabName = tab.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
    },

    // Render available tournaments
    renderAvailableTournaments() {
        const container = document.getElementById('available-tournaments');
        const tournaments = this.getTournaments();
        const available = tournaments.filter(t => t.status === 'registering' || t.status === 'upcoming');

        if (available.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏆</div>
                    <div class="empty-message">No tournaments available</div>
                    <div class="empty-hint">Check back soon for new competitions!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = available.map(t => this.createTournamentCard(t)).join('');
    },

    // Render active tournaments
    renderActiveTournaments() {
        const container = document.getElementById('active-tournaments');
        const tournaments = this.getTournaments();
        const userData = this.getUserData();
        const active = tournaments.filter(t => 
            t.status === 'live' || 
            (t.players && t.players.some(p => p.username === userData.username))
        );

        document.getElementById('active-count').textContent = active.length;

        if (active.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎮</div>
                    <div class="empty-message">No active tournaments</div>
                    <div class="empty-hint">Join a tournament to start competing!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = active.map(t => this.createTournamentCard(t, true)).join('');
    },

    // Render completed tournaments
    renderCompletedTournaments() {
        const container = document.getElementById('completed-tournaments');
        const tournaments = this.getTournaments();
        const completed = tournaments.filter(t => t.status === 'completed');

        if (completed.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📜</div>
                    <div class="empty-message">No tournament history</div>
                    <div class="empty-hint">Your completed tournaments will appear here</div>
                </div>
            `;
            return;
        }

        container.innerHTML = completed.map(t => this.createTournamentCard(t)).join('');
    },

    // Create tournament card
    createTournamentCard(tournament, showBracket = false) {
        const userData = this.getUserData();
        const isJoined = tournament.players.some(p => p.username === userData.username);
        const spotsLeft = tournament.maxPlayers - tournament.players.length;
        const progress = (tournament.players.length / tournament.maxPlayers) * 100;
        const timeUntil = this.getTimeUntil(tournament.startTime);

        let statusClass = `status-${tournament.status}`;
        let statusText = tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1);
        
        let badgeClass = `badge-${tournament.tier}`;
        let badgeText = tournament.tier.toUpperCase();

        let actionButtons = '';
        if (tournament.status === 'registering') {
            if (isJoined) {
                actionButtons = `
                    <button class="btn-view" onclick="TournamentSystem.viewTournament('${tournament.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                `;
            } else {
                actionButtons = `
                    <button class="btn-join" onclick="TournamentSystem.joinTournament('${tournament.id}')">
                        <i class="fas fa-plus"></i> Join (${tournament.entryFee} coins)
                    </button>
                `;
            }
        } else if (showBracket && tournament.bracket) {
            actionButtons = `
                <button class="btn-view" onclick="TournamentSystem.viewBracket('${tournament.id}')">
                    <i class="fas fa-sitemap"></i> View Bracket
                </button>
            `;
        }

        return `
            <div class="tournament-card" onclick="TournamentSystem.viewTournament('${tournament.id}')">
                <div class="tournament-badge ${badgeClass}">${badgeText}</div>
                
                <div class="tournament-status ${statusClass}">${statusText}</div>
                
                <div class="tournament-header">
                    <h3 class="tournament-name">${tournament.name}</h3>
                    <div class="tournament-type">
                        <i class="fas fa-trophy"></i>
                        ${tournament.type} • ${tournament.format}
                    </div>
                </div>

                <div class="tournament-prize">
                    <div class="prize-label">Prize Pool</div>
                    <div class="prize-amount">${tournament.prizePool.toLocaleString()} 🪙</div>
                </div>

                <div class="tournament-info">
                    <div class="info-item">
                        <span class="info-label">Entry Fee</span>
                        <span class="info-value">
                            <i class="fas fa-coins"></i>
                            ${tournament.entryFee === 0 ? 'FREE' : tournament.entryFee}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Duration</span>
                        <span class="info-value">
                            <i class="fas fa-clock"></i>
                            ${tournament.duration}m
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Players</span>
                        <span class="info-value">
                            <i class="fas fa-users"></i>
                            ${tournament.players.length}/${tournament.maxPlayers}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Starts In</span>
                        <span class="info-value">
                            <i class="fas fa-calendar"></i>
                            ${timeUntil}
                        </span>
                    </div>
                </div>

                ${tournament.status === 'registering' ? `
                    <div class="tournament-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-text">${spotsLeft} spots remaining</div>
                    </div>
                ` : ''}

                <div class="tournament-actions" onclick="event.stopPropagation()">
                    ${actionButtons}
                </div>
            </div>
        `;
    },

    // Get time until start
    getTimeUntil(timestamp) {
        const now = Date.now();
        const diff = timestamp - now;
        
        if (diff < 0) return 'Started';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },

    // Join tournament
    joinTournament(tournamentId) {
        const tournaments = this.getTournaments();
        const tournament = tournaments.find(t => t.id === tournamentId);
        const userData = this.getUserData();

        if (!tournament) {
            alert('Tournament not found!');
            return;
        }

        // Check if already joined
        if (tournament.players.some(p => p.username === userData.username)) {
            alert('You are already registered for this tournament!');
            return;
        }

        // Check if tournament is full
        if (tournament.players.length >= tournament.maxPlayers) {
            alert('Tournament is full!');
            return;
        }

        // Check balance
        if (userData.balance < tournament.entryFee) {
            alert(`Insufficient balance! You need ${tournament.entryFee} coins to enter.`);
            if (typeof showUpgradePrompt === 'function') {
                showUpgradePrompt('coins', 'Get more coins to join tournaments!');
            }
            return;
        }

        // Deduct entry fee
        userData.balance -= tournament.entryFee;
        this.saveUserData(userData);

        // Add player to tournament
        tournament.players.push({
            username: userData.username,
            avatar: userData.avatar,
            seed: tournament.players.length + 1,
            status: 'active'
        });

        // Update prize pool if not free tournament
        if (tournament.entryFee > 0) {
            tournament.prizePool += Math.floor(tournament.entryFee * 0.5);
        }

        this.saveTournaments(tournaments);

        // Show success
        alert(`✅ Successfully joined ${tournament.name}!\n\nEntry Fee: ${tournament.entryFee} coins\nRemaining Balance: ${userData.balance} coins`);

        // Refresh UI
        this.loadUserStats();
        this.renderAvailableTournaments();
        this.renderActiveTournaments();
    },

    // View tournament details
    viewTournament(tournamentId) {
        const tournaments = this.getTournaments();
        const tournament = tournaments.find(t => t.id === tournamentId);

        if (!tournament) return;

        const userData = this.getUserData();
        const isJoined = tournament.players.some(p => p.username === userData.username);

        const modal = document.getElementById('tournament-modal');
        const content = document.getElementById('tournament-detail-content');

        content.innerHTML = `
            <div style="padding: 40px 30px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="font-size: 32px; font-weight: 800; margin-bottom: 10px;">${tournament.name}</h2>
                    <div style="color: rgba(255,255,255,0.6);">${tournament.type} • ${tournament.format}</div>
                </div>

                <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 140, 0, 0.2)); border-radius: 15px; padding: 25px; text-align: center; margin-bottom: 25px;">
                    <div style="font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 5px;">PRIZE POOL</div>
                    <div style="font-size: 48px; font-weight: 800; background: linear-gradient(135deg, #ffd700, #ff8c00); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        ${tournament.prizePool.toLocaleString()} 🪙
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 25px;">
                    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">ENTRY FEE</div>
                        <div style="font-size: 24px; font-weight: 700;">${tournament.entryFee === 0 ? 'FREE' : tournament.entryFee + ' 🪙'}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">DURATION</div>
                        <div style="font-size: 24px; font-weight: 700;">${tournament.duration} min</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">PLAYERS</div>
                        <div style="font-size: 24px; font-weight: 700;">${tournament.players.length}/${tournament.maxPlayers}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">STARTS IN</div>
                        <div style="font-size: 24px; font-weight: 700;">${this.getTimeUntil(tournament.startTime)}</div>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px;">Prize Distribution</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05)); border-radius: 8px; border: 2px solid rgba(255,215,0,0.3);">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span>🥇 1st Place</span>
                                <img src="https://play.rosebud.ai/assets/Championshipring1.png?shqb" alt="Championship Ring" style="height: 32px; width: 32px; object-fit: contain;">
                            </div>
                            <span style="font-weight: 700; font-size: 16px;">${Math.floor(tournament.prizePool * 0.5).toLocaleString()} coins</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(192,192,192,0.1); border-radius: 8px;">
                            <span>🥈 2nd Place</span>
                            <span style="font-weight: 700;">${Math.floor(tournament.prizePool * 0.3).toLocaleString()} coins</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(205,127,50,0.1); border-radius: 8px;">
                            <span>🥉 3rd Place</span>
                            <span style="font-weight: 700;">${Math.floor(tournament.prizePool * 0.2).toLocaleString()} coins</span>
                        </div>
                    </div>
                </div>

                ${tournament.players.length > 0 ? `
                    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 15px;">Registered Players (${tournament.players.length})</h3>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${tournament.players.map((p, i) => `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 8px;">
                                    <div style="font-weight: 700; color: rgba(255,255,255,0.5); width: 30px;">#${i + 1}</div>
                                    <div style="font-size: 24px;">${p.avatar}</div>
                                    <div style="flex: 1; font-weight: 600;">${p.username}</div>
                                    ${p.username === userData.username ? '<span style="background: #10b981; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;">YOU</span>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${!isJoined && tournament.status === 'registering' ? `
                    <button onclick="TournamentSystem.closeModal(); TournamentSystem.joinTournament('${tournament.id}');" 
                            style="width: 100%; padding: 18px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
                        Join Tournament (${tournament.entryFee} coins)
                    </button>
                ` : ''}
            </div>
        `;

        modal.classList.add('active');
    },

    // Close modal
    closeModal() {
        document.getElementById('tournament-modal').classList.remove('active');
    },

    // View bracket
    viewBracket(tournamentId) {
        const tournaments = this.getTournaments();
        const tournament = tournaments.find(t => t.id === tournamentId);

        if (!tournament || !tournament.bracket) {
            alert('Bracket not available yet!');
            return;
        }

        const modal = document.getElementById('bracket-modal');
        const content = document.getElementById('bracket-content');

        content.innerHTML = `
            <div class="bracket-container">
                <div class="bracket-header">
                    <h2 class="bracket-title">${tournament.name} - Bracket</h2>
                    <p style="color: rgba(255,255,255,0.6);">Track the tournament progress</p>
                </div>
                <div class="bracket-rounds">
                    ${this.renderBracket(tournament.bracket)}
                </div>
            </div>
        `;

        modal.classList.add('active');
    },

    // Render bracket
    renderBracket(bracket) {
        // Simple single elimination bracket
        return `
            <div class="bracket-round">
                <div class="round-title">Round 1</div>
                ${this.renderMatches(bracket.round1 || [])}
            </div>
            <div class="bracket-round">
                <div class="round-title">Quarter Finals</div>
                ${this.renderMatches(bracket.round2 || [])}
            </div>
            <div class="bracket-round">
                <div class="round-title">Semi Finals</div>
                ${this.renderMatches(bracket.round3 || [])}
            </div>
            <div class="bracket-round">
                <div class="round-title">Final</div>
                ${this.renderMatches(bracket.final || [])}
            </div>
        `;
    },

    // Render matches
    renderMatches(matches) {
        if (!matches.length) {
            return '<div style="text-align: center; color: rgba(255,255,255,0.5);">TBD</div>';
        }

        return matches.map(match => `
            <div class="bracket-match">
                ${match.players.map((player, i) => `
                    <div class="match-player ${match.winner === i ? 'winner' : match.winner !== null ? 'loser' : ''}">
                        <div class="player-info">
                            <div class="player-avatar">${player.avatar}</div>
                            <div class="player-name">${player.username}</div>
                        </div>
                        <div class="player-score">${player.score || 0}</div>
                    </div>
                `).join('')}
                ${match.time ? `<div class="match-time">${match.time}</div>` : ''}
            </div>
        `).join('');
    },

    // Close bracket
    closeBracket() {
        document.getElementById('bracket-modal').classList.remove('active');
    },

    // Update tournament statuses
    updateTournamentStatuses() {
        const tournaments = this.getTournaments();
        let updated = false;
        const now = Date.now();

        tournaments.forEach(tournament => {
            if (tournament.status === 'registering' && now >= tournament.startTime) {
                tournament.status = 'live';
                this.generateBracket(tournament);
                updated = true;
            }
            
            if (tournament.status === 'live' && now >= tournament.startTime + (tournament.duration * 60 * 1000)) {
                tournament.status = 'completed';
                this.completeTournament(tournament);
                updated = true;
            }
        });

        if (updated) {
            this.saveTournaments(tournaments);
            this.renderAvailableTournaments();
            this.renderActiveTournaments();
            this.renderCompletedTournaments();
        }
    },

    // Generate bracket
    generateBracket(tournament) {
        const players = [...tournament.players];
        
        // Shuffle for random seeding
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        tournament.bracket = {
            round1: this.createMatches(players),
            round2: [],
            round3: [],
            final: []
        };
    },

    // Create matches
    createMatches(players) {
        const matches = [];
        for (let i = 0; i < players.length; i += 2) {
            if (i + 1 < players.length) {
                matches.push({
                    players: [players[i], players[i + 1]],
                    winner: null,
                    time: null
                });
            }
        }
        return matches;
    },

    // Complete tournament
    completeTournament(tournament) {
        if (!tournament.bracket || tournament.players.length < 2) return;

        // Simulate results
        const winner = tournament.players[Math.floor(Math.random() * Math.min(3, tournament.players.length))];
        const userData = this.getUserData();

        if (winner.username === userData.username) {
            const winnings = Math.floor(tournament.prizePool * 0.5);
            userData.balance += winnings;
            userData.tournamentsWon += 1;
            userData.totalWinnings += winnings;
            this.saveUserData(userData);

            // Trigger confetti celebration for user win
            if (window.ConfettiEffect) {
                ConfettiEffect.victory(200);
            }

            // Play victory sound
            if (window.SoundEffects) {
                SoundEffects.playTrumpetVictory();
            }

            alert(`🎉 Congratulations! You won ${tournament.name}!\n\nPrize: ${winnings.toLocaleString()} coins`);
        }

        tournament.winner = winner;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    TournamentSystem.init();
});

// Export for global access
window.TournamentSystem = TournamentSystem;

console.log('✅ Tournament System Loaded');
