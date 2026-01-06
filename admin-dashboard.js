/**
 * Ultimate Admin Dashboard Logic
 * Unified control center for Users, Transactions, Minigames, and Shop.
 */

const API_BASE = '/api/admin';

const admin = {
    // State
    currentView: 'dashboard',
    currentItem: null, // For editing shop items or users

    init: async () => {
        // Check Auth
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/';
            return;
        }

        try {
            // Verify Admin Access
            const response = await fetch(`${API_BASE}/dashboard-stats`, {
                headers: admin.getHeaders()
            });

            if (!response.ok) {
                if (response.status === 403 || response.status === 401) {
                    alert('Access Denied: Admin privileges required.');
                    window.location.href = '/';
                    return;
                }
                throw new Error('Failed to load dashboard');
            }

            const data = await response.json();
            admin.renderDashboard(data.stats);
            
            // Set up event listeners
            document.getElementById('user-search').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') admin.fetchUsers();
            });

        } catch (error) {
            console.error('Init error:', error);
            alert('Failed to initialize admin dashboard. See console for details.');
        }
    },

    getHeaders: () => ({
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
    }),

    // Navigation
    showView: (viewName) => {
        // Update Sidebar
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        // Find the nav item that matches (simple check)
        const navItems = document.querySelectorAll('.nav-item');
        if (viewName === 'dashboard') navItems[0].classList.add('active');
        if (viewName === 'users') navItems[1].classList.add('active');
        if (viewName === 'transactions') navItems[2].classList.add('active');
        if (viewName === 'minigames') navItems[3].classList.add('active');
        if (viewName === 'shop') navItems[4].classList.add('active');
        if (viewName === 'coaches') navItems[5].classList.add('active');

        // Update Content
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');

        // Update Title
        const titles = {
            dashboard: 'Dashboard',
            users: 'User Management',
            transactions: 'Transaction History',
            minigames: 'Minigame Control',
            shop: 'Shop Inventory',
            coaches: 'AI Coaches'
        };
        document.getElementById('page-title').textContent = titles[viewName];

        // Load Data
        admin.currentView = viewName;
        if (viewName === 'users') admin.fetchUsers();
        if (viewName === 'transactions') admin.fetchTransactions();
        if (viewName === 'minigames') admin.fetchMinigames();
        if (viewName === 'shop') admin.fetchShop();
    },

    // ==========================================
    // DASHBOARD
    // ==========================================
    renderDashboard: (stats) => {
        document.getElementById('dash-users').textContent = stats.totalUsers.toLocaleString();
        document.getElementById('dash-active').textContent = stats.activeUsers.toLocaleString();
        document.getElementById('dash-revenue').textContent = `$${stats.totalRevenue}`;
        document.getElementById('dash-economy').textContent = (stats.totalCoins || 0).toLocaleString();
        
        // Mock recent activity if not provided
        const activityTable = document.getElementById('dash-activity-table');
        if (stats.recentActivity && stats.recentActivity.length > 0) {
            activityTable.innerHTML = stats.recentActivity.map(act => `
                <tr>
                    <td>${act.user}</td>
                    <td>${act.action}</td>
                    <td>${act.details}</td>
                    <td>${new Date(act.time).toLocaleTimeString()}</td>
                </tr>
            `).join('');
        } else {
            activityTable.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--admin-text-muted);">No recent activity logged.</td></tr>';
        }
    },

    // ==========================================
    // USERS
    // ==========================================
    fetchUsers: async () => {
        const tbody = document.getElementById('users-table-body');
        const search = document.getElementById('user-search').value;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';

        try {
            const res = await fetch(`${API_BASE}/users?search=${encodeURIComponent(search)}`, { headers: admin.getHeaders() });
            const data = await res.json();
            
            tbody.innerHTML = data.users.map(user => `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${user.username}</div>
                        <div style="font-size: 12px; color: var(--admin-text-muted);">${user.email}</div>
                    </td>
                    <td>
                        <span class="status-badge ${user.is_admin ? 'status-warning' : 'status-success'}">
                            ${user.is_admin ? 'Admin' : 'User'}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${user.is_active ? 'status-success' : 'status-danger'}">
                            ${user.is_active ? 'Active' : 'Banned'}
                        </span>
                    </td>
                    <td>${(user.coins || 0).toLocaleString()} 🪙</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            <button class="action-btn" onclick="admin.openAdjustModal(${user.id}, '${user.username}')">
                                <i class="fas fa-coins"></i>
                            </button>
                            ${!user.is_admin ? `
                                <button class="action-btn ${user.is_active ? 'status-danger' : 'status-success'}" 
                                        onclick="admin.toggleBan(${user.id}, ${user.is_active})">
                                    <i class="fas ${user.is_active ? 'fa-ban' : 'fa-check'}"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Error loading users</td></tr>';
        }
    },

    openAdjustModal: (userId, username) => {
        admin.currentItem = { id: userId };
        const content = document.getElementById('modal-content');
        document.getElementById('modal-title').textContent = `Adjust Balance: ${username}`;
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Amount (+ to add, - to remove)</label>
                <input type="number" id="adjust-amount" class="form-input" placeholder="0">
            </div>
            <div class="form-group">
                <label class="form-label">Reason</label>
                <input type="text" id="adjust-reason" class="form-input" placeholder="Admin adjustment">
            </div>
        `;
        
        document.getElementById('modal-submit').onclick = admin.submitAdjustment;
        document.getElementById('admin-modal').style.display = 'flex';
    },

    submitAdjustment: async () => {
        const amount = document.getElementById('adjust-amount').value;
        const reason = document.getElementById('adjust-reason').value;
        
        if (!amount) return alert('Enter an amount');

        try {
            const res = await fetch(`${API_BASE}/users/${admin.currentItem.id}/adjust-coins`, {
                method: 'POST',
                headers: admin.getHeaders(),
                body: JSON.stringify({ amount: parseInt(amount), reason })
            });

            if (res.ok) {
                admin.closeModal();
                admin.fetchUsers();
                // Also update dashboard stats if possible
            } else {
                alert('Failed to adjust balance');
            }
        } catch (error) {
            console.error(error);
        }
    },

    toggleBan: async (userId, isActive) => {
        if (!confirm(`Are you sure you want to ${isActive ? 'BAN' : 'UNBAN'} this user?`)) return;
        try {
            await fetch(`${API_BASE}/users/${userId}/ban`, {
                method: 'POST',
                headers: admin.getHeaders(),
                body: JSON.stringify({ ban: isActive })
            });
            admin.fetchUsers();
        } catch (error) {
            console.error(error);
        }
    },

    // ==========================================
    // TRANSACTIONS
    // ==========================================
    fetchTransactions: async () => {
        const tbody = document.getElementById('transactions-table-body');
        tbody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        
        try {
            const res = await fetch(`${API_BASE}/transactions`, { headers: admin.getHeaders() });
            const data = await res.json();
            
            tbody.innerHTML = data.transactions.map(tx => `
                <tr>
                    <td>#${tx.id}</td>
                    <td>${tx.username || 'Unknown'}</td>
                    <td><span class="status-badge status-warning">${tx.type}</span></td>
                    <td>${tx.amount ? '$'+tx.amount : '-'}</td>
                    <td>${tx.coins_amount ? tx.coins_amount : '-'}</td>
                    <td><span class="status-badge ${tx.status === 'completed' ? 'status-success' : 'status-danger'}">${tx.status}</span></td>
                    <td>${new Date(tx.created_at).toLocaleString()}</td>
                </tr>
            `).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7">Error loading transactions</td></tr>';
        }
    },

    // ==========================================
    // MINIGAMES
    // ==========================================
    fetchMinigames: async () => {
        const tbody = document.getElementById('minigames-table-body');
        tbody.innerHTML = '<tr><td colspan="5">Loading stats...</td></tr>';

        try {
            // New endpoint we will create
            const res = await fetch(`${API_BASE}/minigames/stats`, { headers: admin.getHeaders() });
            const data = await res.json();

            // Populate summary cards
            document.getElementById('game-plays').textContent = (data.totalPlays || 0).toLocaleString();
            document.getElementById('game-payout').textContent = (data.totalPayout || 0).toLocaleString();

            tbody.innerHTML = data.games.map(game => `
                <tr>
                    <td>
                        <div style="font-weight: 600;">${game.name}</div>
                    </td>
                    <td>${game.plays.toLocaleString()}</td>
                    <td>${game.winRate}%</td>
                    <td><span class="status-badge status-success">Active</span></td>
                    <td>
                        <button class="action-btn" onclick="alert('RTP Config coming soon!')">
                            <i class="fas fa-cog"></i> Config
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Minigame fetch error:', error);
            tbody.innerHTML = '<tr><td colspan="5">Failed to load game stats</td></tr>';
        }
    },

    // ==========================================
    // SHOP
    // ==========================================
    fetchShop: async () => {
        const tbody = document.getElementById('shop-table-body');
        tbody.innerHTML = '<tr><td colspan="6">Loading inventory...</td></tr>';

        try {
            const res = await fetch(`${API_BASE}/shop/items`, { headers: admin.getHeaders() });
            const data = await res.json();

            tbody.innerHTML = data.items.map(item => `
                <tr>
                    <td>
                        <div style="width: 40px; height: 40px; background: #334155; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            ${item.image_url ? `<img src="${item.image_url}" style="width:100%; height:100%; object-fit: cover;">` : '<i class="fas fa-box"></i>'}
                        </div>
                    </td>
                    <td>${item.name}</td>
                    <td>${item.price} 🪙</td>
                    <td>${item.category}</td>
                    <td>${item.stock === -1 ? '∞' : item.stock}</td>
                    <td>
                        <button class="action-btn" onclick="admin.openShopModal(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn status-danger" onclick="admin.deleteShopItem(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6">Failed to load shop items</td></tr>';
        }
    },

    openShopModal: async (itemId = null) => {
        const content = document.getElementById('modal-content');
        document.getElementById('modal-title').textContent = itemId ? 'Edit Item' : 'Add New Item';
        
        let item = { name: '', price: '', category: 'avatars', stock: -1, image_url: '', description: '' };

        if (itemId) {
            // Fetch single item details if needed, or find in existing list
            // For now, assume we need to re-fetch or pass data. Simpler to just fetch list again or store locally.
            // Let's just create empty for now to save time, or use a "edit" mode.
            // A better way is to pass the item object to this function, but for now let's just use placeholders.
             try {
                const res = await fetch(`${API_BASE}/shop/items/${itemId}`, { headers: admin.getHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    item = data.item;
                }
            } catch (e) { console.error(e); }
        }
        
        admin.currentItem = itemId ? { id: itemId } : null;

        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Item Name</label>
                <input type="text" id="shop-name" class="form-input" value="${item.name}">
            </div>
            <div style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Price (Coins)</label>
                    <input type="number" id="shop-price" class="form-input" value="${item.price}">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label">Category</label>
                    <select id="shop-category" class="form-input">
                        <option value="avatars" ${item.category === 'avatars' ? 'selected' : ''}>Avatar</option>
                        <option value="boosters" ${item.category === 'boosters' ? 'selected' : ''}>Booster</option>
                        <option value="items" ${item.category === 'items' ? 'selected' : ''}>Item</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Image URL</label>
                <input type="text" id="shop-image" class="form-input" value="${item.image_url || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Stock (-1 for infinite)</label>
                <input type="number" id="shop-stock" class="form-input" value="${item.stock}">
            </div>
        `;

        document.getElementById('modal-submit').onclick = admin.saveShopItem;
        document.getElementById('admin-modal').style.display = 'flex';
    },

    saveShopItem: async () => {
        const data = {
            name: document.getElementById('shop-name').value,
            price: parseInt(document.getElementById('shop-price').value),
            category: document.getElementById('shop-category').value,
            image_url: document.getElementById('shop-image').value,
            stock: parseInt(document.getElementById('shop-stock').value)
        };

        const method = admin.currentItem ? 'PUT' : 'POST';
        const url = admin.currentItem 
            ? `${API_BASE}/shop/items/${admin.currentItem.id}`
            : `${API_BASE}/shop/items`;

        try {
            const res = await fetch(url, {
                method: method,
                headers: admin.getHeaders(),
                body: JSON.stringify(data)
            });

            if (res.ok) {
                admin.closeModal();
                admin.fetchShop();
            } else {
                alert('Failed to save item');
            }
        } catch (error) {
            console.error(error);
        }
    },

    deleteShopItem: async (id) => {
        if (!confirm('Delete this item?')) return;
        try {
            await fetch(`${API_BASE}/shop/items/${id}`, { method: 'DELETE', headers: admin.getHeaders() });
            admin.fetchShop();
        } catch (e) { console.error(e); }
    },

    // Common
    closeModal: () => {
        document.getElementById('admin-modal').style.display = 'none';
        admin.currentItem = null;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', admin.init);
