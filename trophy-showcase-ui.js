/**
 * Trophy Showcase UI
 * User interface for trophy display and management
 */

import trophyShowcase from './trophy-showcase-system.js';

class TrophyShowcaseUI {
    constructor() {
        this.currentView = 'showcase';
        this.currentFilter = 'all';
        this.currentSort = 'recent';
    }

    /**
     * Render trophy showcase page
     */
    renderShowcasePage() {
        const stats = trophyShowcase.getStats();
        const showcaseTrophies = trophyShowcase.getShowcaseTrophies();
        const unlockedTrophies = trophyShowcase.getUnlockedTrophies();

        return `
            <div class="trophy-showcase-page">
                <!-- Header Stats -->
                <div class="trophy-showcase-header">
                    <div class="trophy-showcase-hero">
                        <div class="trophy-hero-icon">🏆</div>
                        <div class="trophy-hero-content">
                            <h1>Trophy Showcase</h1>
                            <p>Celebrate your achievements</p>
                        </div>
                    </div>
                    
                    <div class="trophy-stats-grid">
                        <div class="trophy-stat-card">
                            <div class="trophy-stat-icon">🎯</div>
                            <div class="trophy-stat-value">${stats.unlocked}/${stats.total}</div>
                            <div class="trophy-stat-label">Unlocked</div>
                            <div class="trophy-stat-progress">
                                <div class="trophy-stat-progress-bar" style="width: ${stats.percentage}%"></div>
                            </div>
                        </div>
                        
                        <div class="trophy-stat-card">
                            <div class="trophy-stat-icon">⭐</div>
                            <div class="trophy-stat-value">${stats.points.toLocaleString()}</div>
                            <div class="trophy-stat-label">Trophy Points</div>
                        </div>
                        
                        <div class="trophy-stat-card">
                            <div class="trophy-stat-icon">🟡</div>
                            <div class="trophy-stat-value">${stats.byRarity.legendary}</div>
                            <div class="trophy-stat-label">Legendary</div>
                        </div>
                        
                        <div class="trophy-stat-card">
                            <div class="trophy-stat-icon">🟣</div>
                            <div class="trophy-stat-value">${stats.byRarity.epic}</div>
                            <div class="trophy-stat-label">Epic</div>
                        </div>
                    </div>
                </div>

                <!-- View Toggle -->
                <div class="trophy-view-toggle">
                    <button class="trophy-view-btn ${this.currentView === 'showcase' ? 'active' : ''}" data-view="showcase">
                        <i class="fas fa-star"></i> Showcase
                    </button>
                    <button class="trophy-view-btn ${this.currentView === 'collection' ? 'active' : ''}" data-view="collection">
                        <i class="fas fa-trophy"></i> Collection
                    </button>
                </div>

                <!-- Showcase View -->
                <div class="trophy-view ${this.currentView === 'showcase' ? 'active' : ''}">
                    <div class="trophy-showcase-intro">
                        <h2>Featured Achievements</h2>
                        <p>Display your most impressive trophies (max 6)</p>
                    </div>
                    
                    <div class="trophy-showcase-grid">
                        ${this.renderShowcaseGrid(showcaseTrophies)}
                    </div>
                    
                    ${showcaseTrophies.length < 6 ? `
                        <div class="trophy-showcase-cta">
                            <i class="fas fa-plus-circle"></i>
                            <p>Add more trophies to your showcase</p>
                            <button class="trophy-cta-btn" data-view="collection">
                                Browse Collection
                            </button>
                        </div>
                    ` : ''}
                </div>

                <!-- Collection View -->
                <div class="trophy-view ${this.currentView === 'collection' ? 'active' : ''}">
                    <!-- Filters -->
                    <div class="trophy-filters">
                        <div class="trophy-filter-group">
                            <label>Category:</label>
                            <select class="trophy-filter-select" id="trophy-category-filter">
                                <option value="all">All Categories</option>
                                <option value="predictions">Predictions</option>
                                <option value="sports">Sports</option>
                                <option value="parlays">Parlays</option>
                                <option value="profit">Profit</option>
                                <option value="accuracy">Accuracy</option>
                                <option value="leaderboard">Leaderboard</option>
                                <option value="subscription">Subscription</option>
                            </select>
                        </div>
                        
                        <div class="trophy-filter-group">
                            <label>Rarity:</label>
                            <select class="trophy-filter-select" id="trophy-rarity-filter">
                                <option value="all">All Rarities</option>
                                <option value="legendary">🟡 Legendary</option>
                                <option value="epic">🟣 Epic</option>
                                <option value="rare">🔵 Rare</option>
                                <option value="common">⚪ Common</option>
                            </select>
                        </div>
                        
                        <div class="trophy-filter-group">
                            <label>Sort:</label>
                            <select class="trophy-filter-select" id="trophy-sort-filter">
                                <option value="recent">Recently Unlocked</option>
                                <option value="rarity">Rarity</option>
                                <option value="points">Points</option>
                                <option value="name">Name</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="trophy-collection-grid">
                        ${this.renderCollectionGrid(unlockedTrophies)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render showcase grid
     */
    renderShowcaseGrid(trophies) {
        if (trophies.length === 0) {
            return `
                <div class="trophy-showcase-empty">
                    <div class="trophy-empty-icon">🏆</div>
                    <h3>Your Showcase is Empty</h3>
                    <p>Unlock achievements and add them to your showcase to display your accomplishments!</p>
                </div>
            `;
        }

        // Fill empty slots
        const slots = 6;
        const emptySlots = slots - trophies.length;

        return trophies.map(trophy => this.renderShowcaseTrophy(trophy)).join('') +
               Array(emptySlots).fill(null).map(() => this.renderEmptySlot()).join('');
    }

    /**
     * Render showcase trophy
     */
    renderShowcaseTrophy(trophy) {
        return `
            <div class="trophy-showcase-item ${trophy.rarity}" data-trophy="${trophy.id}">
                <button class="trophy-showcase-remove" title="Remove from showcase">
                    <i class="fas fa-times"></i>
                </button>
                
                <div class="trophy-showcase-glow"></div>
                
                <div class="trophy-showcase-image">
                    <img src="${trophy.image}" alt="${trophy.name}">
                    <div class="trophy-showcase-shine"></div>
                </div>
                
                <div class="trophy-showcase-info">
                    <div class="trophy-showcase-rarity ${trophy.rarity}">
                        ${trophy.rarity.toUpperCase()}
                    </div>
                    <div class="trophy-showcase-name">${trophy.name}</div>
                    <div class="trophy-showcase-points">+${trophy.points}</div>
                </div>
                
                <div class="trophy-showcase-particles"></div>
            </div>
        `;
    }

    /**
     * Render empty showcase slot
     */
    renderEmptySlot() {
        return `
            <div class="trophy-showcase-item empty">
                <div class="trophy-showcase-empty-icon">
                    <i class="fas fa-plus"></i>
                </div>
                <div class="trophy-showcase-empty-text">Empty Slot</div>
            </div>
        `;
    }

    /**
     * Render collection grid
     */
    renderCollectionGrid(trophies) {
        const allTrophies = trophyShowcase.trophies;
        const showcaseTrophies = trophyShowcase.showcaseTrophies;

        return allTrophies.map(trophy => {
            const unlocked = trophyShowcase.unlockedTrophies.has(trophy.id);
            const inShowcase = showcaseTrophies.includes(trophy.id);
            
            return `
                <div class="trophy-collection-item ${unlocked ? 'unlocked' : 'locked'} ${trophy.rarity}" 
                     data-trophy="${trophy.id}">
                    ${unlocked ? `
                        <div class="trophy-collection-glow"></div>
                        
                        <div class="trophy-collection-image">
                            <img src="${trophy.image}" alt="${trophy.name}">
                        </div>
                        
                        <div class="trophy-collection-info">
                            <div class="trophy-collection-name">${trophy.name}</div>
                            <div class="trophy-collection-description">${trophy.description}</div>
                            <div class="trophy-collection-meta">
                                <span class="trophy-collection-rarity ${trophy.rarity}">
                                    ${trophy.rarity.toUpperCase()}
                                </span>
                                <span class="trophy-collection-points">+${trophy.points}</span>
                            </div>
                        </div>
                        
                        ${inShowcase ? `
                            <button class="trophy-collection-action in-showcase" disabled>
                                <i class="fas fa-star"></i> In Showcase
                            </button>
                        ` : `
                            <button class="trophy-collection-action add-showcase">
                                <i class="fas fa-plus"></i> Add to Showcase
                            </button>
                        `}
                    ` : `
                        <div class="trophy-collection-locked-overlay">
                            <i class="fas fa-lock"></i>
                        </div>
                        
                        <div class="trophy-collection-image locked">
                            <img src="${trophy.image}" alt="Locked">
                        </div>
                        
                        <div class="trophy-collection-info locked">
                            <div class="trophy-collection-name">???</div>
                            <div class="trophy-collection-description">${trophy.description}</div>
                            <div class="trophy-collection-meta">
                                <span class="trophy-collection-rarity ${trophy.rarity}">
                                    ${trophy.rarity.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    `}
                </div>
            `;
        }).join('');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // View toggle
        document.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.trophy-view-btn');
            if (viewBtn) {
                this.currentView = viewBtn.dataset.view;
                this.refreshUI();
            }

            // Remove from showcase
            const removeBtn = e.target.closest('.trophy-showcase-remove');
            if (removeBtn) {
                const item = removeBtn.closest('.trophy-showcase-item');
                const trophyId = item?.dataset.trophy;
                if (trophyId) {
                    trophyShowcase.removeFromShowcase(trophyId);
                    this.refreshUI();
                }
            }

            // Add to showcase
            const addBtn = e.target.closest('.trophy-collection-action.add-showcase');
            if (addBtn) {
                const item = addBtn.closest('.trophy-collection-item');
                const trophyId = item?.dataset.trophy;
                if (trophyId) {
                    const success = trophyShowcase.addToShowcase(trophyId);
                    if (success) {
                        this.refreshUI();
                        this.showToast('Trophy added to showcase!');
                    } else {
                        this.showToast('Showcase is full (max 6 trophies)');
                    }
                }
            }

            // CTA button
            const ctaBtn = e.target.closest('.trophy-cta-btn');
            if (ctaBtn) {
                this.currentView = ctaBtn.dataset.view;
                this.refreshUI();
            }
        });

        // Filters
        document.addEventListener('change', (e) => {
            if (e.target.id === 'trophy-category-filter') {
                this.currentFilter = e.target.value;
                this.refreshUI();
            }
            if (e.target.id === 'trophy-rarity-filter') {
                this.currentFilter = e.target.value;
                this.refreshUI();
            }
            if (e.target.id === 'trophy-sort-filter') {
                this.currentSort = e.target.value;
                this.refreshUI();
            }
        });
    }

    /**
     * Refresh UI
     */
    refreshUI() {
        const container = document.querySelector('#trophy-showcase-container');
        if (container) {
            container.innerHTML = this.renderShowcasePage();
        }
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'trophy-toast';
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Initialize UI
     */
    init() {
        this.setupEventListeners();
    }
}

// Create instance
const trophyShowcaseUI = new TrophyShowcaseUI();

// Export
export default trophyShowcaseUI;
