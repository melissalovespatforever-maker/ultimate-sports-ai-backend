// ============================================
// PAYPAL INVOICE GENERATOR & PDF EXPORT
// Professional invoice generation with PDF export
// ============================================

export class PayPalInvoiceGenerator {
    constructor() {
        this.invoices = [];
        this.invoiceCounter = 0;
        this.companyInfo = {
            name: 'Ultimate Sports AI',
            email: 'support@ultimatesportsai.com',
            phone: '+1 (555) 123-4567',
            website: 'www.ultimatesportsai.com',
            address: 'Sports Analytics Platform',
            city: 'Digital',
            country: 'Global',
            taxId: 'TAX-US-001',
            logo: null
        };
        this.init();
    }

    async init() {
        await this.loadPdfLibrary();
        this.loadStoredInvoices();
        console.log('✅ Invoice Generator Initialized');
    }

    /**
     * Load html2pdf library
     */
    async loadPdfLibrary() {
        if (window.html2pdf) return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => {
                console.log('✅ html2pdf library loaded');
                resolve();
            };
            script.onerror = () => {
                console.warn('⚠️ Could not load html2pdf, PDF export will use fallback');
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Generate invoice from payment
     */
    generateInvoice(payment) {
        const invoice = {
            id: this.generateInvoiceId(),
            paymentId: payment.id || this.generatePaymentId(),
            invoiceNumber: `INV-${String(++this.invoiceCounter).padStart(6, '0')}`,
            date: payment.date || new Date().toISOString(),
            dueDate: this.calculateDueDate(payment.date || new Date()),
            customer: {
                name: payment.customerName || 'Valued Customer',
                email: payment.email || '',
                phone: payment.phone || '',
                address: payment.address || ''
            },
            items: [
                {
                    description: `${payment.tier} Subscription Plan`,
                    quantity: 1,
                    unitPrice: payment.amount,
                    total: payment.amount
                }
            ],
            subtotal: payment.amount,
            tax: payment.tax || 0,
            total: payment.amount + (payment.tax || 0),
            paymentMethod: 'PayPal',
            status: payment.status || 'Paid',
            notes: payment.notes || 'Thank you for your subscription!',
            terms: 'Payment terms: Due upon receipt'
        };

        this.invoices.push(invoice);
        this.saveInvoices();
        
        return invoice;
    }

    /**
     * Generate invoice ID
     */
    generateInvoiceId() {
        return `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate payment ID
     */
    generatePaymentId() {
        return `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Calculate due date (30 days from invoice date)
     */
    calculateDueDate(invoiceDate) {
        const date = new Date(invoiceDate);
        date.setDate(date.getDate() + 30);
        return date.toISOString();
    }

    /**
     * Get invoice by ID
     */
    getInvoice(invoiceId) {
        return this.invoices.find(inv => inv.id === invoiceId);
    }

    /**
     * Get all invoices
     */
    getAllInvoices() {
        return this.invoices;
    }

    /**
     * Generate HTML invoice
     */
    generateInvoiceHtml(invoice) {
        const invoiceDate = new Date(invoice.date);
        const dueDate = new Date(invoice.dueDate);

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Invoice ${invoice.invoiceNumber}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        color: #333;
                        background: white;
                        line-height: 1.6;
                    }

                    .invoice-container {
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 40px;
                        background: white;
                    }

                    .invoice-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 3px solid #007bff;
                        padding-bottom: 30px;
                        margin-bottom: 30px;
                    }

                    .company-info h1 {
                        font-size: 28px;
                        color: #007bff;
                        margin-bottom: 10px;
                        font-weight: 700;
                    }

                    .company-info p {
                        font-size: 13px;
                        color: #666;
                        margin: 4px 0;
                    }

                    .invoice-title {
                        text-align: right;
                    }

                    .invoice-title h2 {
                        font-size: 32px;
                        color: #333;
                        margin-bottom: 5px;
                    }

                    .invoice-title p {
                        font-size: 14px;
                        color: #666;
                    }

                    .invoice-details {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 40px;
                        margin-bottom: 40px;
                        padding-bottom: 30px;
                        border-bottom: 1px solid #eee;
                    }

                    .detail-block h3 {
                        font-size: 12px;
                        text-transform: uppercase;
                        color: #999;
                        font-weight: 600;
                        margin-bottom: 10px;
                        letter-spacing: 0.5px;
                    }

                    .detail-block p {
                        font-size: 14px;
                        color: #333;
                        margin: 4px 0;
                    }

                    .detail-block .label {
                        color: #666;
                        font-weight: 500;
                    }

                    .status-badge {
                        display: inline-block;
                        padding: 6px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        margin-top: 8px;
                    }

                    .status-paid {
                        background: #d4edda;
                        color: #155724;
                        border: 1px solid #c3e6cb;
                    }

                    .invoice-items {
                        margin-bottom: 40px;
                    }

                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }

                    .items-table thead {
                        background: #f8f9fa;
                        border-top: 2px solid #007bff;
                        border-bottom: 2px solid #007bff;
                    }

                    .items-table th {
                        padding: 12px;
                        text-align: left;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: #333;
                        letter-spacing: 0.5px;
                    }

                    .items-table td {
                        padding: 12px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }

                    .items-table .description {
                        color: #333;
                        font-weight: 500;
                    }

                    .items-table .quantity {
                        text-align: center;
                        color: #666;
                    }

                    .items-table .unit-price {
                        text-align: right;
                        color: #666;
                    }

                    .items-table .total {
                        text-align: right;
                        font-weight: 600;
                        color: #333;
                    }

                    .invoice-summary {
                        display: flex;
                        justify-content: flex-end;
                        margin-bottom: 40px;
                    }

                    .summary-box {
                        width: 300px;
                        background: #f8f9fa;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        padding: 20px;
                    }

                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        font-size: 14px;
                        margin-bottom: 12px;
                        padding-bottom: 12px;
                        border-bottom: 1px solid #e0e0e0;
                    }

                    .summary-row:last-child {
                        border-bottom: none;
                        font-size: 18px;
                        font-weight: 700;
                        color: #007bff;
                        margin-bottom: 0;
                    }

                    .summary-row .label {
                        color: #666;
                    }

                    .summary-row .amount {
                        color: #333;
                        font-weight: 600;
                    }

                    .invoice-footer {
                        border-top: 1px solid #eee;
                        padding-top: 20px;
                        font-size: 12px;
                        color: #666;
                        line-height: 1.8;
                    }

                    .thank-you {
                        font-size: 14px;
                        font-weight: 500;
                        color: #007bff;
                        margin-bottom: 15px;
                    }

                    .footer-note {
                        font-size: 11px;
                        color: #999;
                        margin-top: 15px;
                        padding-top: 15px;
                        border-top: 1px solid #eee;
                    }

                    @media print {
                        body {
                            background: white;
                        }
                        .invoice-container {
                            padding: 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <!-- Header -->
                    <div class="invoice-header">
                        <div class="company-info">
                            <h1>${this.companyInfo.name}</h1>
                            <p>${this.companyInfo.email}</p>
                            <p>${this.companyInfo.phone}</p>
                            <p>${this.companyInfo.website}</p>
                            <p>${this.companyInfo.address}</p>
                            <p>${this.companyInfo.city}, ${this.companyInfo.country}</p>
                            <p>Tax ID: ${this.companyInfo.taxId}</p>
                        </div>
                        <div class="invoice-title">
                            <h2>INVOICE</h2>
                            <p>${invoice.invoiceNumber}</p>
                        </div>
                    </div>

                    <!-- Details -->
                    <div class="invoice-details">
                        <div class="detail-block">
                            <h3>Bill To</h3>
                            <p><strong>${invoice.customer.name}</strong></p>
                            <p>${invoice.customer.email}</p>
                            <p>${invoice.customer.phone || 'N/A'}</p>
                            <p>${invoice.customer.address || 'N/A'}</p>
                            <div class="status-badge status-paid">${invoice.status}</div>
                        </div>
                        <div class="detail-block">
                            <div style="margin-bottom: 20px;">
                                <h3>Invoice Details</h3>
                                <p><span class="label">Invoice #:</span> ${invoice.invoiceNumber}</p>
                                <p><span class="label">Invoice Date:</span> ${invoiceDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}</p>
                                <p><span class="label">Due Date:</span> ${dueDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}</p>
                            </div>
                            <div>
                                <h3>Payment Method</h3>
                                <p>${invoice.paymentMethod}</p>
                                <p class="label">Payment ID: ${invoice.paymentId}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Items -->
                    <div class="invoice-items">
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th class="description">Description</th>
                                    <th class="quantity" style="width: 80px;">Qty</th>
                                    <th class="unit-price" style="width: 120px;">Unit Price</th>
                                    <th class="total" style="width: 120px;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${invoice.items.map(item => `
                                    <tr>
                                        <td class="description">${item.description}</td>
                                        <td class="quantity">${item.quantity}</td>
                                        <td class="unit-price">$${item.unitPrice.toFixed(2)}</td>
                                        <td class="total">$${item.total.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Summary -->
                    <div class="invoice-summary">
                        <div class="summary-box">
                            <div class="summary-row">
                                <span class="label">Subtotal:</span>
                                <span class="amount">$${invoice.subtotal.toFixed(2)}</span>
                            </div>
                            ${invoice.tax > 0 ? `
                                <div class="summary-row">
                                    <span class="label">Tax:</span>
                                    <span class="amount">$${invoice.tax.toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <div class="summary-row">
                                <span>Total Due:</span>
                                <span>$${invoice.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="invoice-footer">
                        <p class="thank-you">✨ ${invoice.notes}</p>
                        <p>${invoice.terms}</p>
                        <p class="footer-note">
                            This invoice was generated on ${new Date().toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}. 
                            For questions about this invoice, please contact ${this.companyInfo.email}.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Export invoice as PDF
     */
    async exportInvoicePdf(invoiceId, filename) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) {
            console.error('Invoice not found:', invoiceId);
            return false;
        }

        try {
            if (window.html2pdf) {
                const element = document.createElement('div');
                element.innerHTML = this.generateInvoiceHtml(invoice);
                
                const opt = {
                    margin: 10,
                    filename: filename || `${invoice.invoiceNumber}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
                };

                await html2pdf().set(opt).from(element).save();
                return true;
            } else {
                // Fallback: use browser print dialog
                this.printInvoice(invoiceId);
                return true;
            }
        } catch (error) {
            console.error('PDF export error:', error);
            return false;
        }
    }

    /**
     * Export invoice as HTML
     */
    exportInvoiceHtml(invoiceId, filename) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) return false;

        const html = this.generateInvoiceHtml(invoice);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `${invoice.invoiceNumber}.html`;
        link.click();
        URL.revokeObjectURL(url);
        
        return true;
    }

    /**
     * Print invoice
     */
    printInvoice(invoiceId) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) return false;

        const html = this.generateInvoiceHtml(invoice);
        const printWindow = window.open('', '', 'width=900,height=1200');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        
        return true;
    }

    /**
     * Export invoice as CSV (for accounting software)
     */
    exportInvoiceCsv(invoiceId, filename) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) return false;

        let csv = 'Ultimate Sports AI - Invoice Export\n\n';
        csv += `Invoice Number,${invoice.invoiceNumber}\n`;
        csv += `Invoice Date,${new Date(invoice.date).toLocaleDateString('en-US')}\n`;
        csv += `Payment ID,${invoice.paymentId}\n`;
        csv += `Customer Name,${invoice.customer.name}\n`;
        csv += `Customer Email,${invoice.customer.email}\n`;
        csv += `Payment Status,${invoice.status}\n\n`;

        csv += 'Description,Quantity,Unit Price,Total\n';
        invoice.items.forEach(item => {
            csv += `"${item.description}",${item.quantity},$${item.unitPrice.toFixed(2)},$${item.total.toFixed(2)}\n`;
        });

        csv += `\nSubtotal,$${invoice.subtotal.toFixed(2)}\n`;
        if (invoice.tax > 0) {
            csv += `Tax,$${invoice.tax.toFixed(2)}\n`;
        }
        csv += `Total,$${invoice.total.toFixed(2)}\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `${invoice.invoiceNumber}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        return true;
    }

    /**
     * Update company info
     */
    updateCompanyInfo(info) {
        this.companyInfo = { ...this.companyInfo, ...info };
        return this.companyInfo;
    }

    /**
     * Get company info
     */
    getCompanyInfo() {
        return this.companyInfo;
    }

    /**
     * Save invoices to localStorage
     */
    saveInvoices() {
        try {
            localStorage.setItem('paypalInvoices', JSON.stringify(this.invoices));
        } catch (error) {
            console.warn('Could not save invoices:', error);
        }
    }

    /**
     * Load invoices from localStorage
     */
    loadStoredInvoices() {
        try {
            const stored = localStorage.getItem('paypalInvoices');
            if (stored) {
                this.invoices = JSON.parse(stored);
                this.invoiceCounter = this.invoices.length;
                console.log(`✅ Loaded ${this.invoices.length} invoices from storage`);
            }
        } catch (error) {
            console.warn('Could not load invoices:', error);
        }
    }

    /**
     * Search invoices
     */
    searchInvoices(query) {
        const lowerQuery = query.toLowerCase();
        return this.invoices.filter(inv => 
            inv.invoiceNumber.toLowerCase().includes(lowerQuery) ||
            inv.customer.name.toLowerCase().includes(lowerQuery) ||
            inv.customer.email.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Filter invoices by date range
     */
    filterInvoicesByDateRange(startDate, endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        return this.invoices.filter(inv => {
            const invDate = new Date(inv.date).getTime();
            return invDate >= start && invDate <= end;
        });
    }

    /**
     * Get invoices by status
     */
    getInvoicesByStatus(status) {
        return this.invoices.filter(inv => inv.status === status);
    }

    /**
     * Calculate total revenue
     */
    calculateTotalRevenue() {
        return this.invoices.reduce((sum, inv) => sum + inv.total, 0);
    }

    /**
     * Delete invoice
     */
    deleteInvoice(invoiceId) {
        const index = this.invoices.findIndex(inv => inv.id === invoiceId);
        if (index > -1) {
            this.invoices.splice(index, 1);
            this.saveInvoices();
            return true;
        }
        return false;
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const paypalInvoiceGenerator = new PayPalInvoiceGenerator();
