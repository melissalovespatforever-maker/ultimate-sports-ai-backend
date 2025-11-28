// ============================================
// PAYPAL INVOICE UI MANAGER
// Beautiful UI for invoice management & export
// ============================================

import { paypalInvoiceGenerator } from './paypal-invoice-generator.js';

export class PayPalInvoiceUI {
    constructor() {
        this.selectedInvoices = new Set();
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.init();
    }

    init() {
        console.log('✅ Invoice UI Manager Initialized');
    }

    /**
     * Show invoice manager modal
     */
    showInvoiceManager() {
        const invoices = paypalInvoiceGenerator.getAllInvoices();
        
        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay invoice-manager-overlay';
        modal.innerHTML = `
            <div class="paypal-modal invoice-manager-modal">
                <div class="paypal-modal-header invoice-header-actions">
                    <div>
                        <h2><i class="fas fa-file-invoice"></i> Invoice Manager</h2>
                        <p class="invoice-subtitle">View, download, and manage all invoices</p>
                    </div>
                    <button class="paypal-modal-close">&times;</button>
                </div>

                <div class="invoice-toolbar">
                    <div class="invoice-search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" class="invoice-search" placeholder="Search by invoice number, customer...">
                    </div>
                    <div class="invoice-filters">
                        <button class="invoice-filter-btn active" data-filter="all">
                            <i class="fas fa-list"></i> All (${invoices.length})
                        </button>
                        <button class="invoice-filter-btn" data-filter="paid">
                            <i class="fas fa-check-circle"></i> Paid
                        </button>
                    </div>
                </div>

                <div class="paypal-modal-body invoice-manager-body">
                    ${invoices.length === 0 ? 
                        this.renderNoInvoices() : 
                        this.renderInvoicesList(invoices)}
                </div>

                <div class="paypal-modal-footer invoice-footer-actions">
                    <button class="paypal-modal-cancel">Close</button>
                    <button class="invoice-bulk-export-btn" ${this.selectedInvoices.size === 0 ? 'disabled' : ''}>
                        <i class="fas fa-download"></i> Export Selected
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event handlers
        this.setupInvoiceManagerHandlers(modal, invoices);
    }

    /**
     * Setup invoice manager event handlers
     */
    setupInvoiceManagerHandlers(modal, invoices) {
        // Close button
        modal.querySelector('.paypal-modal-close').onclick = () => modal.remove();
        modal.querySelector('.paypal-modal-cancel').onclick = () => modal.remove();

        // Search functionality
        const searchInput = modal.querySelector('.invoice-search');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.updateInvoicesList(modal);
        });

        // Filter buttons
        modal.querySelectorAll('.invoice-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                modal.querySelectorAll('.invoice-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.invoice-filter-btn').classList.add('active');
                this.currentFilter = e.target.closest('.invoice-filter-btn').dataset.filter;
                this.updateInvoicesList(modal);
            });
        });

        // Checkbox handlers
        modal.querySelectorAll('.invoice-item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedInvoices.add(e.target.dataset.invoiceId);
                } else {
                    this.selectedInvoices.delete(e.target.dataset.invoiceId);
                }
                this.updateExportButtonState(modal);
            });
        });

        // Select all checkbox
        const selectAllCheckbox = modal.querySelector('.invoice-select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                modal.querySelectorAll('.invoice-item-checkbox').forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                    if (e.target.checked) {
                        this.selectedInvoices.add(checkbox.dataset.invoiceId);
                    } else {
                        this.selectedInvoices.delete(checkbox.dataset.invoiceId);
                    }
                });
                this.updateExportButtonState(modal);
            });
        }

        // Invoice click handlers (row click)
        modal.querySelectorAll('.invoice-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT' && !e.target.closest('.invoice-actions')) {
                    const invoiceId = row.dataset.invoiceId;
                    this.showInvoiceDetail(invoiceId);
                }
            });
        });

        // Action buttons
        modal.querySelectorAll('.invoice-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const invoiceId = btn.closest('.invoice-row').dataset.invoiceId;
                const action = btn.dataset.action;

                if (action === 'view') this.showInvoiceDetail(invoiceId);
                else if (action === 'pdf') await this.exportInvoicePdf(invoiceId);
                else if (action === 'html') this.exportInvoiceHtml(invoiceId);
                else if (action === 'csv') this.exportInvoiceCsv(invoiceId);
                else if (action === 'print') this.printInvoice(invoiceId);
                else if (action === 'delete') this.deleteInvoice(invoiceId, modal);
            });
        });

        // Bulk export button
        const bulkExportBtn = modal.querySelector('.invoice-bulk-export-btn');
        if (bulkExportBtn) {
            bulkExportBtn.addEventListener('click', () => this.showBulkExportOptions());
        }

        // Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    /**
     * Update invoices list based on filters and search
     */
    updateInvoicesList(modal) {
        let invoices = paypalInvoiceGenerator.getAllInvoices();

        // Apply search
        if (this.searchQuery) {
            invoices = paypalInvoiceGenerator.searchInvoices(this.searchQuery);
        }

        // Apply filter
        if (this.currentFilter === 'paid') {
            invoices = invoices.filter(inv => inv.status === 'Paid');
        }

        const body = modal.querySelector('.invoice-manager-body');
        if (invoices.length === 0) {
            body.innerHTML = this.renderNoInvoices();
        } else {
            body.innerHTML = this.renderInvoicesList(invoices);
            this.setupInvoiceRowHandlers(modal);
        }
    }

    /**
     * Render no invoices message
     */
    renderNoInvoices() {
        return `
            <div class="invoice-empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No Invoices Found</h3>
                <p>Invoices will appear here when you complete payments.</p>
            </div>
        `;
    }

    /**
     * Render invoices list table
     */
    renderInvoicesList(invoices) {
        return `
            <div class="invoice-table-container">
                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th class="checkbox-col">
                                <input type="checkbox" class="invoice-select-all">
                            </th>
                            <th>Invoice #</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoices.map(invoice => `
                            <tr class="invoice-row" data-invoice-id="${invoice.id}">
                                <td class="checkbox-col">
                                    <input type="checkbox" class="invoice-item-checkbox" data-invoice-id="${invoice.id}">
                                </td>
                                <td class="invoice-number">
                                    <strong>${invoice.invoiceNumber}</strong>
                                </td>
                                <td class="customer-info">
                                    <div class="customer-name">${invoice.customer.name}</div>
                                    <div class="customer-email">${invoice.customer.email}</div>
                                </td>
                                <td class="invoice-date">
                                    ${new Date(invoice.date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </td>
                                <td class="invoice-amount">
                                    <strong>$${invoice.total.toFixed(2)}</strong>
                                </td>
                                <td class="invoice-status">
                                    <span class="status-badge status-${invoice.status.toLowerCase()}">
                                        ${invoice.status}
                                    </span>
                                </td>
                                <td class="invoice-actions">
                                    <button class="invoice-action-btn" data-action="view" title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="invoice-action-btn" data-action="pdf" title="Export as PDF">
                                        <i class="fas fa-file-pdf"></i>
                                    </button>
                                    <button class="invoice-action-btn" data-action="print" title="Print">
                                        <i class="fas fa-print"></i>
                                    </button>
                                    <div class="invoice-actions-dropdown">
                                        <button class="invoice-action-menu-btn">
                                            <i class="fas fa-ellipsis-v"></i>
                                        </button>
                                        <div class="invoice-dropdown-menu">
                                            <button data-action="html"><i class="fas fa-file-code"></i> Export as HTML</button>
                                            <button data-action="csv"><i class="fas fa-table"></i> Export as CSV</button>
                                            <button data-action="delete" class="delete-action"><i class="fas fa-trash"></i> Delete</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Setup invoice row event handlers
     */
    setupInvoiceRowHandlers(modal) {
        // Invoice rows click
        modal.querySelectorAll('.invoice-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('.invoice-actions') && e.target.tagName !== 'INPUT') {
                    const invoiceId = row.dataset.invoiceId;
                    this.showInvoiceDetail(invoiceId);
                }
            });
        });

        // Action buttons
        modal.querySelectorAll('.invoice-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const invoiceId = btn.closest('.invoice-row').dataset.invoiceId;
                const action = btn.dataset.action;

                if (action === 'view') this.showInvoiceDetail(invoiceId);
                else if (action === 'pdf') await this.exportInvoicePdf(invoiceId);
                else if (action === 'html') this.exportInvoiceHtml(invoiceId);
                else if (action === 'print') this.printInvoice(invoiceId);
            });
        });

        // Dropdown menu buttons
        modal.querySelectorAll('.invoice-dropdown-menu button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const invoiceId = btn.closest('.invoice-row').dataset.invoiceId;
                const action = btn.dataset.action;

                if (action === 'html') this.exportInvoiceHtml(invoiceId);
                else if (action === 'csv') this.exportInvoiceCsv(invoiceId);
                else if (action === 'delete') this.deleteInvoice(invoiceId, modal);
            });
        });

        // Dropdown menu toggle
        modal.querySelectorAll('.invoice-action-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = btn.closest('.invoice-actions-dropdown').querySelector('.invoice-dropdown-menu');
                menu.classList.toggle('show');

                // Close other menus
                modal.querySelectorAll('.invoice-dropdown-menu').forEach(m => {
                    if (m !== menu) m.classList.remove('show');
                });

                // Close on click outside
                document.addEventListener('click', () => {
                    menu.classList.remove('show');
                }, { once: true });
            });
        });
    }

    /**
     * Show invoice detail view
     */
    showInvoiceDetail(invoiceId) {
        const invoice = paypalInvoiceGenerator.getInvoice(invoiceId);
        if (!invoice) return;

        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay invoice-detail-overlay';
        modal.innerHTML = `
            <div class="paypal-modal invoice-detail-modal">
                <div class="paypal-modal-header">
                    <div>
                        <h2><i class="fas fa-file-invoice"></i> Invoice Details</h2>
                        <p class="invoice-detail-number">${invoice.invoiceNumber}</p>
                    </div>
                    <button class="paypal-modal-close">&times;</button>
                </div>

                <div class="paypal-modal-body invoice-detail-body">
                    <div class="invoice-detail-preview" id="invoicePreviewArea">
                        <iframe class="invoice-preview-iframe" srcdoc="${this.escapeHtml(paypalInvoiceGenerator.generateInvoiceHtml(invoice))}"></iframe>
                    </div>
                </div>

                <div class="paypal-modal-footer invoice-detail-footer">
                    <div class="invoice-detail-stats">
                        <div class="stat">
                            <span class="stat-label">Total:</span>
                            <span class="stat-value">$${invoice.total.toFixed(2)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Status:</span>
                            <span class="stat-value status-paid">${invoice.status}</span>
                        </div>
                    </div>
                    <div class="invoice-detail-actions">
                        <button class="invoice-detail-action-btn" data-action="pdf">
                            <i class="fas fa-file-pdf"></i> Download PDF
                        </button>
                        <button class="invoice-detail-action-btn" data-action="html">
                            <i class="fas fa-file-code"></i> Export HTML
                        </button>
                        <button class="invoice-detail-action-btn" data-action="csv">
                            <i class="fas fa-table"></i> Export CSV
                        </button>
                        <button class="invoice-detail-action-btn" data-action="print">
                            <i class="fas fa-print"></i> Print
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup handlers
        modal.querySelector('.paypal-modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        // Action buttons
        modal.querySelectorAll('.invoice-detail-action-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                if (action === 'pdf') await this.exportInvoicePdf(invoiceId);
                else if (action === 'html') this.exportInvoiceHtml(invoiceId);
                else if (action === 'csv') this.exportInvoiceCsv(invoiceId);
                else if (action === 'print') this.printInvoice(invoiceId);
            });
        });
    }

    /**
     * Show bulk export options
     */
    showBulkExportOptions() {
        const modal = document.createElement('div');
        modal.className = 'paypal-modal-overlay';
        modal.innerHTML = `
            <div class="paypal-modal">
                <div class="paypal-modal-header">
                    <h2><i class="fas fa-download"></i> Bulk Export</h2>
                    <button class="paypal-modal-close">&times;</button>
                </div>
                <div class="paypal-modal-body">
                    <p>Export ${this.selectedInvoices.size} selected invoices as:</p>
                    <div class="bulk-export-options">
                        <button class="bulk-export-option" data-format="zip-pdf">
                            <i class="fas fa-file-pdf"></i>
                            <div>
                                <strong>ZIP with PDFs</strong>
                                <small>All invoices as individual PDF files</small>
                            </div>
                        </button>
                        <button class="bulk-export-option" data-format="csv">
                            <i class="fas fa-table"></i>
                            <div>
                                <strong>Single CSV File</strong>
                                <small>All invoices in one spreadsheet</small>
                            </div>
                        </button>
                        <button class="bulk-export-option" data-format="html">
                            <i class="fas fa-file-code"></i>
                            <div>
                                <strong>ZIP with HTML</strong>
                                <small>All invoices as HTML files</small>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.paypal-modal-close').onclick = () => modal.remove();

        modal.querySelectorAll('.bulk-export-option').forEach(btn => {
            btn.addEventListener('click', async () => {
                const format = btn.dataset.format;
                this.performBulkExport(format);
                modal.remove();
            });
        });
    }

    /**
     * Perform bulk export
     */
    async performBulkExport(format) {
        const invoiceIds = Array.from(this.selectedInvoices);
        if (invoiceIds.length === 0) return;

        this.showToast(`📦 Preparing ${invoiceIds.length} invoices...`);

        if (format === 'csv') {
            this.exportMultipleInvoicesCsv(invoiceIds);
        } else if (format === 'zip-pdf' || format === 'html') {
            this.showToast('⚠️ Bulk ZIP export requires backend setup. Exporting individual files...');
            for (const id of invoiceIds) {
                if (format === 'zip-pdf') {
                    await this.exportInvoicePdf(id);
                } else {
                    this.exportInvoiceHtml(id);
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    /**
     * Export multiple invoices as CSV
     */
    exportMultipleInvoicesCsv(invoiceIds) {
        let csv = 'Ultimate Sports AI - Invoices Export\n';
        csv += `Export Date: ${new Date().toLocaleDateString('en-US')}\n`;
        csv += `Total Invoices: ${invoiceIds.length}\n\n`;

        csv += 'Invoice Number,Customer,Email,Date,Subtotal,Tax,Total,Status,Payment ID\n';

        invoiceIds.forEach(id => {
            const invoice = paypalInvoiceGenerator.getInvoice(id);
            if (invoice) {
                csv += `"${invoice.invoiceNumber}","${invoice.customer.name}","${invoice.customer.email}",${new Date(invoice.date).toLocaleDateString('en-US')},$${invoice.subtotal.toFixed(2)},$${invoice.tax.toFixed(2)},$${invoice.total.toFixed(2)},"${invoice.status}","${invoice.paymentId}"\n`;
            }
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoices-export-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.showToast(`✅ Exported ${invoiceIds.length} invoices as CSV`);
    }

    /**
     * Export invoice as PDF
     */
    async exportInvoicePdf(invoiceId) {
        const invoice = paypalInvoiceGenerator.getInvoice(invoiceId);
        if (!invoice) return;

        this.showToast('📄 Exporting as PDF...');
        const success = await paypalInvoiceGenerator.exportInvoicePdf(
            invoiceId,
            `${invoice.invoiceNumber}.pdf`
        );

        if (success) {
            this.showToast(`✅ Downloaded ${invoice.invoiceNumber}.pdf`);
        } else {
            this.showToast('⚠️ PDF export failed. Printing instead...');
            this.printInvoice(invoiceId);
        }
    }

    /**
     * Export invoice as HTML
     */
    exportInvoiceHtml(invoiceId) {
        const invoice = paypalInvoiceGenerator.getInvoice(invoiceId);
        if (!invoice) return;

        paypalInvoiceGenerator.exportInvoiceHtml(invoiceId, `${invoice.invoiceNumber}.html`);
        this.showToast(`✅ Downloaded ${invoice.invoiceNumber}.html`);
    }

    /**
     * Export invoice as CSV
     */
    exportInvoiceCsv(invoiceId) {
        const invoice = paypalInvoiceGenerator.getInvoice(invoiceId);
        if (!invoice) return;

        paypalInvoiceGenerator.exportInvoiceCsv(invoiceId, `${invoice.invoiceNumber}.csv`);
        this.showToast(`✅ Downloaded ${invoice.invoiceNumber}.csv`);
    }

    /**
     * Print invoice
     */
    printInvoice(invoiceId) {
        paypalInvoiceGenerator.printInvoice(invoiceId);
        this.showToast('🖨️ Printing invoice...');
    }

    /**
     * Delete invoice
     */
    deleteInvoice(invoiceId, modal) {
        if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) {
            return;
        }

        const success = paypalInvoiceGenerator.deleteInvoice(invoiceId);
        if (success) {
            this.showToast('✅ Invoice deleted');
            this.updateInvoicesList(modal);
        } else {
            this.showToast('⚠️ Could not delete invoice');
        }
    }

    /**
     * Update export button state
     */
    updateExportButtonState(modal) {
        const btn = modal.querySelector('.invoice-bulk-export-btn');
        if (btn) {
            btn.disabled = this.selectedInvoices.size === 0;
            btn.textContent = this.selectedInvoices.size > 0 
                ? `<i class="fas fa-download"></i> Export ${this.selectedInvoices.size} Selected`
                : '<i class="fas fa-download"></i> Export Selected';
        }
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'invoice-toast';
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

export const paypalInvoiceUI = new PayPalInvoiceUI();
