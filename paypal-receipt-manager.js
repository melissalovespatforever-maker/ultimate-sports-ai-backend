// ============================================
// PAYPAL RECEIPT MANAGER UI
// View, download, print, and manage receipts
// ============================================

import { paypalEmailReceipts } from './paypal-email-receipts.js';

export class PayPalReceiptManager {
    constructor() {
        this.receipts = [];
        this.selectedReceipt = null;
        this.init();
    }

    async init() {
        this.loadReceipts();
    }

    /**
     * Load all stored receipts
     */
    loadReceipts() {
        this.receipts = paypalEmailReceipts.getStoredReceipts();
        console.log(`✅ Loaded ${this.receipts.length} receipts`);
    }

    /**
     * Show receipt manager modal
     */
    showReceiptManager() {
        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay receipt-manager-overlay';
        modal.innerHTML = `
            <div class="paypal-modal receipt-manager-modal">
                <div class="paypal-modal-header">
                    <h2><i class="fas fa-receipt"></i> Receipt Manager</h2>
                    <button class="paypal-modal-close">&times;</button>
                </div>
                <div class="paypal-modal-body receipt-manager-body">
                    ${this.receipts.length === 0 ? 
                        this.renderNoReceipts() : 
                        this.renderReceiptsList()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup close handler
        modal.querySelector('.paypal-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        // Setup receipt click handlers
        modal.querySelectorAll('.receipt-item').forEach(item => {
            item.onclick = () => {
                const receiptId = item.dataset.receiptId;
                this.showReceiptDetail(receiptId, modal);
            };
        });
    }

    /**
     * Render no receipts message
     */
    renderNoReceipts() {
        return `
            <div class="receipt-empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No Receipts Yet</h3>
                <p>Your payment receipts will appear here after you complete an upgrade.</p>
            </div>
        `;
    }

    /**
     * Render receipts list
     */
    renderReceiptsList() {
        return `
            <div class="receipt-list">
                <div class="receipt-filters">
                    <input type="text" class="receipt-search" placeholder="Search receipts...">
                    <select class="receipt-filter-tier">
                        <option value="">All Tiers</option>
                        <option value="PRO">PRO</option>
                        <option value="VIP">VIP</option>
                    </select>
                </div>
                
                <div class="receipt-items">
                    ${this.receipts.map(receipt => `
                        <div class="receipt-item" data-receipt-id="${receipt.id}">
                            <div class="receipt-icon">
                                <i class="fas fa-receipt"></i>
                            </div>
                            <div class="receipt-info">
                                <h4>${receipt.tier} Plan</h4>
                                <p class="receipt-date">${new Date(receipt.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</p>
                                <p class="receipt-email">${receipt.email}</p>
                            </div>
                            <div class="receipt-amount">
                                <span class="amount">$${receipt.amount.toFixed(2)}</span>
                                <span class="frequency">/month</span>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Show receipt detail view
     */
    showReceiptDetail(receiptId, parentModal) {
        const receipt = this.receipts.find(r => r.id === receiptId);
        if (!receipt) return;

        // Hide parent modal content
        if (parentModal) {
            parentModal.style.display = 'none';
        }

        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay receipt-detail-overlay';
        modal.innerHTML = `
            <div class="paypal-modal receipt-detail-modal">
                <div class="paypal-modal-header">
                    <div>
                        <h2><i class="fas fa-receipt"></i> Receipt Details</h2>
                        <p class="receipt-id">ID: ${receipt.id}</p>
                    </div>
                    <button class="paypal-modal-close">&times;</button>
                </div>
                <div class="paypal-modal-body receipt-detail-body">
                    <div class="receipt-preview">
                        <div class="receipt-preview-header">
                            <h3>${receipt.tier}</h3>
                            <span class="receipt-date">${new Date(receipt.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</span>
                        </div>
                        <div class="receipt-preview-amount">
                            <span>$${receipt.amount.toFixed(2)}</span>
                            <span>/month</span>
                        </div>
                    </div>

                    <div class="receipt-actions">
                        <button class="receipt-action-btn view-btn">
                            <i class="fas fa-eye"></i> View Full Receipt
                        </button>
                        <button class="receipt-action-btn download-btn">
                            <i class="fas fa-download"></i> Download as HTML
                        </button>
                        <button class="receipt-action-btn print-btn">
                            <i class="fas fa-print"></i> Print
                        </button>
                        <button class="receipt-action-btn email-btn">
                            <i class="fas fa-envelope"></i> Resend Email
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup handlers
        modal.querySelector('.paypal-modal-close').onclick = () => {
            modal.remove();
            if (parentModal) parentModal.style.display = 'flex';
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
                if (parentModal) parentModal.style.display = 'flex';
            }
        };

        modal.querySelector('.view-btn').onclick = () => {
            this.showReceiptPreview(receipt);
        };

        modal.querySelector('.download-btn').onclick = () => {
            paypalEmailReceipts.downloadReceipt(receiptId);
            this.showToast('✅ Receipt downloaded successfully!');
        };

        modal.querySelector('.print-btn').onclick = () => {
            paypalEmailReceipts.printReceipt(receiptId);
            this.showToast('✅ Printing receipt...');
        };

        modal.querySelector('.email-btn').onclick = () => {
            this.showResendEmailModal(receiptId, receipt);
        };
    }

    /**
     * Show receipt preview
     */
    showReceiptPreview(receipt) {
        const preview = document.createElement('div');
        preview.className = 'receipt-preview-window';
        preview.innerHTML = `
            <div class="receipt-preview-container">
                <button class="receipt-preview-close">&times;</button>
                <iframe class="receipt-iframe" srcdoc="${this.escapeHtml(receipt.html)}"></iframe>
            </div>
        `;

        document.body.appendChild(preview);

        preview.querySelector('.receipt-preview-close').onclick = () => {
            preview.remove();
        };

        preview.onclick = (e) => {
            if (e.target === preview) preview.remove();
        };
    }

    /**
     * Show resend email modal
     */
    showResendEmailModal(receiptId, receipt) {
        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay';
        modal.innerHTML = `
            <div class="paypal-modal resend-email-modal">
                <div class="paypal-modal-header">
                    <h2><i class="fas fa-envelope"></i> Resend Receipt</h2>
                    <button class="paypal-modal-close">&times;</button>
                </div>
                <div class="paypal-modal-body">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" class="email-input" value="${receipt.email}" placeholder="Enter email address">
                    </div>
                </div>
                <div class="paypal-modal-footer">
                    <button class="paypal-modal-cancel">Cancel</button>
                    <button class="paypal-modal-confirm resend-confirm-btn">
                        <i class="fas fa-send"></i> Send Receipt
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.paypal-modal-close').onclick = () => modal.remove();
        modal.querySelector('.paypal-modal-cancel').onclick = () => modal.remove();

        modal.querySelector('.resend-confirm-btn').onclick = async () => {
            const email = modal.querySelector('.email-input').value;
            if (!email) {
                alert('Please enter an email address');
                return;
            }

            const result = await paypalEmailReceipts.resendReceipt(receiptId, email);
            modal.remove();

            if (result.success) {
                this.showToast('✅ Receipt sent successfully!');
            } else {
                this.showToast('⚠️ Could not send receipt. You can download it instead.');
            }
        };

        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'receipt-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const paypalReceiptManager = new PayPalReceiptManager();
