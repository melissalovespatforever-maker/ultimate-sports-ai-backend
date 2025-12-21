// ============================================
// COMPLETE TOURNAMENT SYSTEM
// With Trophy Assets & Leaderboards
// ============================================

console.log('🏆 Loading Complete Tournament System');

class TournamentManager {
    constructor() {
        this.userTournaments = [];
        this.init();
    }

    // Get balance from unified currency manager
    getUserBalance() {
        return window.currencyManager ? window.currencyManager.getBalance() : 1000;
    }

    init() {
        this.setupTabs();
        this.loadAvailableTournaments();
        this.loadActiveTournaments();
        this.loadCompletedTournaments();
        this.updateStats();
    }

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
    }

    loadAvailableTournaments() {
        const container = document.getElementById('available-tournaments');
        if (!container) return;

        const tournaments = [
            {
                id: 1,
                name: 'Weekend Warriors',
                sport: 'Multi-Sport',
                entryFee: 50,
                prizePool: 1000,
                participants: 42,
                maxParticipants: 100,
                startTime: 'Sat 2:00 PM',
                duration: '2 days',
                trophy: 'https://rosebud.ai/assets/World trophy.png?7n3n',
                prizes: ['🥇 400 coins', '🥈 250 coins', '🥉 150 coins', '4-10th: 200 coins split'],
                difficulty: 'Intermediate'
            },
            {
                id: 2,
                name: 'NBA Finals Challenge',
                sport: 'Basketball',
                entryFee: 100,
                prizePool: 5000,
                participants: 128,
                maxParticipants: 256,
                startTime: 'Tonight 7:00 PM',
                duration: '7 days',
                trophy: 'https://rosebud.ai/assets/Basketball trophy.png?28RZ',
                prizes: ['🥇 2000 coins', '🥈 1200 coins', '🥉 800 coins', '4-20th: 1000 coins split'],
                difficulty: 'Expert',
                featured: true
            },
            {
                id: 3,
                name: 'NFL Sunday Special',
                sport: 'Football',
                entryFee: 75,
                prizePool: 2500,
                participants: 89,
                maxParticipants: 200,
                startTime: 'Sun 1:00 PM',
                duration: '1 day',
                trophy: 'https://rosebud.ai/assets/Football trophy icon.png?ok1w',
                prizes: ['🥇 1000 coins', '🥈 600 coins', '🥉 400 coins', '4-15th: 500 coins split'],
                difficulty: 'Intermediate'
            },
            {
                id: 4,
                name: 'Baseball Grand Slam',
                sport: 'Baseball',
                entryFee: 25,
                prizePool: 500,
                participants: 18,
                maxParticipants: 50,
                startTime: 'Mon 6:00 PM',
                duration: '1 week',
                trophy: 'https://rosebud.ai/assets/Baseball trophy.png?ZPlR',
                prizes: ['🥇 200 coins', '🥈 150 coins', '🥉 100 coins', '4-10th: 50 coins split'],
                difficulty: 'Beginner'
            },
            {
                id: 5,
                name: 'Soccer Parlay Masters',
                sport: 'Soccer',
                entryFee: 150,
                prizePool: 10000,
                participants: 256,
                maxParticipants: 500,
                startTime: 'Fri 12:00 PM',
                duration: '1 month',
                trophy: 'https://rosebud.ai/assets/Soccer parlay trophy.png?ePTo',
                prizes: ['🥇 4000 coins', '🥈 2500 coins', '🥉 1500 coins', '4-50th: 2000 coins split'],
                difficulty: 'Expert',
                featured: true
            },
            {
                id: 6,
                name: 'Ultimate Champion',
                sport: 'All Sports',
                entryFee: 250,
                prizePool: 25000,
                participants: 512,
                maxParticipants: 1000,
                startTime: 'Jan 1, 2025',
                duration: '3 months',
                trophy: 'https://rosebud.ai/assets/Ultimate sports ai trophy.png?REjH',
                prizes: ['🥇 10000 coins + Ring', '🥈 6000 coins', '🥉 3000 coins', 'Top 100: Share 6000 coins'],
                difficulty: 'Legend',
                featured: true,
                championship: true
            }
        ];

        container.innerHTML = tournaments.map(t => this.createTournamentCard(t)).join('');

        // Add join handlers
        container.querySelectorAll('.tournament-join-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tournamentId = parseInt(btn.dataset.tournamentId);
                this.joinTournament(tournamentId);
            });
        });

        // Add card click handlers
        container.querySelectorAll('.tournament-card').forEach(card => {
            card.addEventListener('click', () => {
                const tournamentId = parseInt(card.dataset.tournamentId);
                this.showTournamentDetails(tournamentId);
            });
        });
    }

    createTournamentCard(tournament) {
        const fillPercentage = (tournament.participants / tournament.maxParticipants) * 100;
        const difficultyColors = {
            'Beginner': '#22c55e',
            'Intermediate': '#3b82f6',
            'Expert': '#f59e0b',
            'Legend': '#ef4444'
        };

        return `
            <div class="tournament-card ${tournament.featured ? 'featured' : ''} ${tournament.championship ? 'championship' : ''}" 
                 data-tournament-id="${tournament.id}">
                ${tournament.featured ? '<div class="featured-badge"><i class="fas fa-star"></i> Featured</div>' : ''}
                ${tournament.championship ? '<div class="championship-badge"><i class="fas fa-crown"></i> Championship</div>' : ''}
                
                <div class="tournament-trophy">
                    <img src="${tournament.trophy}" alt="${tournament.name} Trophy">
                </div>
                
                <div class="tournament-header">
                    <h3>${tournament.name}</h3>
                    <span class="tournament-sport">${tournament.sport}</span>
                </div>

                <div class="tournament-info">
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-coins"></i> Entry Fee</span>
                        <span class="info-value">${tournament.entryFee} coins</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-trophy"></i> Prize Pool</span>
                        <span class="info-value highlight">${tournament.prizePool.toLocaleString()} coins</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-users"></i> Participants</span>
                        <span class="info-value">${tournament.participants}/${tournament.maxParticipants}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-clock"></i> Starts</span>
                        <span class="info-value">${tournament.startTime}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-hourglass-half"></i> Duration</span>
                        <span class="info-value">${tournament.duration}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-signal"></i> Difficulty</span>
                        <span class="difficulty-badge" style="background: ${difficultyColors[tournament.difficulty]}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${tournament.difficulty}
                        </span>
                    </div>
                </div>

                <div class="tournament-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${fillPercentage}%"></div>
                    </div>
                    <span class="progress-text">${Math.round(fillPercentage)}% Full</span>
                </div>

                <div class="tournament-prizes">
                    ${tournament.prizes.map(prize => `<div class="prize-item">${prize}</div>`).join('')}
                </div>

                <button class="tournament-join-btn" data-tournament-id="${tournament.id}">
                    <i class="fas fa-bolt"></i> Join Tournament
                </button>
            </div>
        `;
    }

    loadActiveTournaments() {
        const container = document.getElementById('active-tournaments');
        if (!container) return;

        // Mock active tournament
        const activeTournaments = [
            {
                id: 101,
                name: 'NBA Finals Challenge',
                currentRank: 34,
                totalParticipants: 256,
                points: 1245,
                potentialWinnings: 150,
                nextGame: 'Lakers vs Celtics - Tonight 7pm',
                trophy: 'https://rosebud.ai/assets/Basketball trophy.png?28RZ',
                status: 'In Progress'
            }
        ];

        if (activeTournaments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <h3>No Active Tournaments</h3>
                    <p>Join a tournament from the Available tab to compete!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activeTournaments.map(t => `
            <div class="active-tournament-card">
                <div class="active-tournament-header">
                    <img src="${t.trophy}" alt="Trophy" class="active-trophy-mini">
                    <div>
                        <h3>${t.name}</h3>
                        <span class="tournament-status ${t.status.toLowerCase().replace(' ', '-')}">${t.status}</span>
                    </div>
                </div>
                <div class="active-tournament-stats">
                    <div class="stat-item">
                        <span class="stat-label">Current Rank</span>
                        <span class="stat-value">#${t.currentRank} / ${t.totalParticipants}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Points</span>
                        <span class="stat-value">${t.points.toLocaleString()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Potential Winnings</span>
                        <span class="stat-value highlight">${t.potentialWinnings} coins</span>
                    </div>
                </div>
                <div class="next-game-alert">
                    <i class="fas fa-clock"></i>
                    <span>${t.nextGame}</span>
                </div>
                <div class="active-tournament-actions">
                    <button class="btn btn-secondary" onclick="tournamentManager.viewLeaderboard(${t.id})">
                        <i class="fas fa-list-ol"></i> Leaderboard
                    </button>
                    <button class="btn btn-primary" onclick="tournamentManager.makePick(${t.id})">
                        <i class="fas fa-plus"></i> Make Pick
                    </button>
                </div>
            </div>
        `).join('');

        document.getElementById('active-count').textContent = activeTournaments.length;
    }

    loadCompletedTournaments() {
        const container = document.getElementById('completed-tournaments');
        if (!container) return;

        const completed = [
            {
                id: 201,
                name: 'Sunday Showdown',
                finalRank: 12,
                totalParticipants: 150,
                winnings: 45,
                trophy: 'https://rosebud.ai/assets/Football trophy icon.png?ok1w',
                date: 'Dec 28, 2024'
            },
            {
                id: 202,
                name: 'MLB Winter Classic',
                finalRank: 3,
                totalParticipants: 50,
                winnings: 100,
                trophy: 'https://rosebud.ai/assets/Baseball trophy.png?ZPlR',
                date: 'Dec 25, 2024',
                medal: 'bronze'
            }
        ];

        if (completed.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No Tournament History</h3>
                    <p>Your completed tournaments will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = completed.map(t => `
            <div class="completed-tournament-card">
                <div class="completed-tournament-header">
                    <img src="${t.trophy}" alt="Trophy" class="completed-trophy-mini">
                    <div>
                        <h4>${t.name}</h4>
                        <span class="tournament-date">${t.date}</span>
                    </div>
                    ${t.medal ? `<div class="medal-badge ${t.medal}"><i class="fas fa-medal"></i></div>` : ''}
                </div>
                <div class="completed-stats">
                    <div class="stat">
                        <span class="label">Final Rank</span>
                        <span class="value">#${t.finalRank} / ${t.totalParticipants}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Winnings</span>
                        <span class="value ${t.winnings > 0 ? 'positive' : ''}">${t.winnings > 0 ? '+' : ''}${t.winnings} coins</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        document.getElementById('tournaments-won').textContent = 1;
        document.getElementById('total-winnings').textContent = '145';
        document.getElementById('current-rank').textContent = '#34';
        const balanceEl = document.getElementById('user-balance');
        if (balanceEl) {
            balanceEl.textContent = this.getUserBalance();
        }
    }

    joinTournament(tournamentId) {
        // Check if user has enough balance
        const tournament = this.getTournamentById(tournamentId);
        if (!tournament) return;

        const currentBalance = this.getUserBalance();
        if (currentBalance < tournament.entryFee) {
            this.showMessage(`Insufficient coins! Need ${tournament.entryFee}, have ${currentBalance}`, 'error');
            return;
        }

        if (confirm(`Join ${tournament.name} for ${tournament.entryFee} Ultimate Coins?`)) {
            // Deduct coins using unified currency manager
            if (window.currencyManager) {
                window.currencyManager.deductCoins(tournament.entryFee, `Joined ${tournament.name}`);
                window.currencyManager.addTransaction('tournament_entry', -tournament.entryFee, tournament.name);
            }
            
            this.showMessage(`Successfully joined ${tournament.name}! 🎉`, 'success');
            this.updateStats();
            // Refresh active tournaments
            setTimeout(() => this.loadActiveTournaments(), 500);
        }
    }

    showTournamentDetails(tournamentId) {
        const tournament = this.getTournamentById(tournamentId);
        if (!tournament) return;

        // Show detailed modal (implement modal here)
        alert(`${tournament.name}\n\nEntry: ${tournament.entryFee} coins\nPrize Pool: ${tournament.prizePool} coins\n\nClick Join to enter!`);
    }

    viewLeaderboard(tournamentId) {
        alert('Leaderboard feature coming soon! 🏆');
    }

    makePick(tournamentId) {
        alert('Make your tournament pick! 🎯');
    }

    getTournamentById(id) {
        // Mock tournament lookup
        return {
            id: id,
            name: 'Tournament ' + id,
            entryFee: 50,
            prizePool: 1000
        };
    }

    showMessage(message, type) {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            alert(message);
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.tournamentManager = new TournamentManager();
    });
} else {
    window.tournamentManager = new TournamentManager();
}

console.log('✅ Tournament System Loaded');
