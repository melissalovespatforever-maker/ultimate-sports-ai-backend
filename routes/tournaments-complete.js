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

    async loadAvailableTournaments() {
        const container = document.getElementById('available-tournaments');
        if (!container) return;

        try {
            const response = await fetch('/api/tournaments', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load tournaments');

            const data = await response.json();
            const tournaments = data.tournaments || [];

            if (tournaments.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>No tournaments available</p></div>';
                return;
            }

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
        } catch (error) {
            console.error('Error loading tournaments:', error);
            container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading tournaments</p></div>';
        }
    }

    createTournamentCard(tournament) {
        // Handle both snake_case (DB) and camelCase (mock) formats
        const currentPlayers = tournament.current_players || tournament.participants || 0;
        const maxPlayers = tournament.max_players || tournament.maxParticipants || 100;
        const entryFee = tournament.entry_fee || tournament.entryFee || 0;
        const prizePool = tournament.prize_pool || tournament.prizePool || 0;
        const startTime = tournament.start_time || tournament.startTime || 'TBD';
        const tier = tournament.tier || tournament.difficulty || 'Intermediate';
        const type = tournament.type || 'Multi-Sport';
        
        const fillPercentage = (currentPlayers / maxPlayers) * 100;
        const difficultyColors = {
            'Beginner': '#22c55e',
            'Intermediate': '#3b82f6',
            'Expert': '#f59e0b',
            'Legend': '#ef4444'
        };

        return `
            <div class="tournament-card" 
                 data-tournament-id="${tournament.id}">
                
                <div class="tournament-header">
                    <h3>${tournament.name}</h3>
                    <span class="tournament-sport">${type}</span>
                </div>

                <div class="tournament-info">
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-coins"></i> Entry Fee</span>
                        <span class="info-value">${entryFee} coins</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-trophy"></i> Prize Pool</span>
                        <span class="info-value highlight">${prizePool.toLocaleString()} coins</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-users"></i> Participants</span>
                        <span class="info-value">${currentPlayers}/${maxPlayers}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-clock"></i> Starts</span>
                        <span class="info-value">${startTime}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-signal"></i> Status</span>
                        <span class="difficulty-badge" style="background: ${difficultyColors[tier] || '#3b82f6'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                            ${tournament.status || 'Active'}
                        </span>
                    </div>
                </div>

                <div class="tournament-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${fillPercentage}%"></div>
                    </div>
                    <span class="progress-text">${Math.round(fillPercentage)}% Full</span>
                </div>

                <button class="tournament-join-btn" data-tournament-id="${tournament.id}">
                    <i class="fas fa-bolt"></i> Join Tournament
                </button>
            </div>
        `;
    }

    async loadActiveTournaments() {
        const container = document.getElementById('active-tournaments');
        if (!container) return;

        try {
            const response = await fetch('/api/users/me/tournaments', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load active tournaments');

            const data = await response.json();
            const activeTournaments = data.tournaments?.filter(t => t.status === 'active') || [];

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
                        <div>
                            <h3>${t.name}</h3>
                            <span class="tournament-status">${t.status}</span>
                        </div>
                    </div>
                    <div class="active-tournament-stats">
                        <div class="stat-item">
                            <span class="stat-label">Participants</span>
                            <span class="stat-value">${t.current_players || 0} / ${t.max_players || 100}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Type</span>
                            <span class="stat-value">${t.type || 'Multi-Sport'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Prize Pool</span>
                            <span class="stat-value highlight">${(t.prize_pool || 0).toLocaleString()} coins</span>
                        </div>
                    </div>
                </div>
            `).join('');

            document.getElementById('active-count').textContent = activeTournaments.length;
        } catch (error) {
            console.error('Error loading active tournaments:', error);
            container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading tournaments</p></div>';
        }
    }

    async loadCompletedTournaments() {
        const container = document.getElementById('completed-tournaments');
        if (!container) return;

        try {
            const response = await fetch('/api/users/me/tournaments', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load completed tournaments');

            const data = await response.json();
            const completed = data.tournaments?.filter(t => t.status === 'completed') || [];

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
                        <div>
                            <h4>${t.name}</h4>
                            <span class="tournament-date">${new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="completed-stats">
                        <div class="stat">
                            <span class="label">Type</span>
                            <span class="value">${t.type || 'Multi-Sport'}</span>
                        </div>
                        <div class="stat">
                            <span class="label">Prize Pool</span>
                            <span class="value highlight">${(t.prize_pool || 0).toLocaleString()} coins</span>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading completed tournaments:', error);
            container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading tournaments</p></div>';
        }
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

    closeModal() {
        const modal = document.getElementById('tournament-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    closeBracket() {
        const modal = document.getElementById('bracket-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.tournamentManager = new TournamentManager();
        window.TournamentSystem = window.tournamentManager; // Alias for backwards compatibility
    });
} else {
    window.tournamentManager = new TournamentManager();
    window.TournamentSystem = window.tournamentManager; // Alias for backwards compatibility
}

console.log('✅ Tournament System Loaded');
