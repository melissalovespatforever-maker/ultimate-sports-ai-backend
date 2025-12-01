// ============================================
// INVOICE & RECEIPT MANAGEMENT ROUTES
// Handle receipt generation, invoices, and email sending
// ============================================

const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const emailReceiptService = require('../services/email-receipt-service');

const router = express.Router();

// ============================================
// MIDDLEWARE
// ============================================

router.use(authenticateToken);

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/invoices/create
 * Create invoice and receipt for a payment
 */
router.post('/create', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { paymentId } = req.body;
        
        if (!paymentId) {
            return res.status(400).json({ error: 'paymentId is required' });
        }
        
        // Get payment details
        const paymentResult = await query(
            `SELECT * FROM payments WHERE id = $1 AND user_id = $2`,
            [paymentId, userId]
        );
        
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        const payment = paymentResult.rows[0];
        
        // Get user details
        const userResult = await query(
            `SELECT id, email, full_name FROM users WHERE id = $1`,
            [userId]
        );
        
        const user = userResult.rows[0];
        
        // Create invoice and send receipt
        const receiptData = await emailReceiptService.createAndSendReceipt(
            {
                user_id: userId,
                payment_id: paymentId,
                amount: payment.amount,
                tier: payment.tier,
                billing_cycle: payment.description ? (payment.description.includes('annual') ? 'annual' : 'monthly') : 'monthly'
            },
            {
                email: user.email,
                full_name: user.full_name
            }
        );
        
        res.json({
            success: true,
            data: receiptData
        });
    } catch (error) {
        console.error('❌ Error creating invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/invoices/:receiptId
 * Get receipt and invoice details
 */
router.get('/:receiptId', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { receiptId } = req.params;
        
        // Verify ownership
        const receiptResult = await query(
            `SELECT * FROM email_receipts WHERE id = $1 AND user_id = $2`,
            [receiptId, userId]
        );
        
        if (receiptResult.rows.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }
        
        const receipt = receiptResult.rows[0];
        
        // Get invoice details
        const invoiceResult = await query(
            `SELECT * FROM invoices WHERE id = $1`,
            [receipt.invoice_number]
        );
        
        res.json({
            receipt,
            invoice: invoiceResult.rows[0]
        });
    } catch (error) {
        console.error('❌ Error fetching receipt:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/invoices/history/list
 * Get user's receipt and invoice history
 */
router.get('/history/list', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { limit = 20, offset = 0 } = req.query;
        
        const receipts = await emailReceiptService.getUserReceiptHistory(
            userId,
            parseInt(limit),
            parseInt(offset)
        );
        
        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) as count FROM email_receipts WHERE user_id = $1`,
            [userId]
        );
        
        res.json({
            receipts,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('❌ Error fetching receipt history:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/invoices/resend-receipt
 * Resend receipt email
 */
router.post('/resend-receipt', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { receiptId } = req.body;
        
        if (!receiptId) {
            return res.status(400).json({ error: 'receiptId is required' });
        }
        
        // Verify ownership
        const receiptResult = await query(
            `SELECT * FROM email_receipts WHERE id = $1 AND user_id = $2`,
            [receiptId, userId]
        );
        
        if (receiptResult.rows.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }
        
        const receipt = receiptResult.rows[0];
        
        // Resend email
        const success = await emailReceiptService.retryFailedReceipt(receiptId);
        
        res.json({
            success,
            message: success ? 'Receipt email resent successfully' : 'Failed to resend receipt'
        });
    } catch (error) {
        console.error('❌ Error resending receipt:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/invoices/download/:receiptId
 * Download invoice as PDF (placeholder for future PDF generation)
 */
router.get('/download/:receiptId', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { receiptId } = req.params;
        
        // Verify ownership
        const receiptResult = await query(
            `SELECT * FROM email_receipts WHERE id = $1 AND user_id = $2`,
            [receiptId, userId]
        );
        
        if (receiptResult.rows.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }
        
        const receipt = receiptResult.rows[0];
        
        // For now, return HTML that can be printed
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${receipt.receipt_number}.html"`);
        res.send(receipt.html_body);
    } catch (error) {
        console.error('❌ Error downloading invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/invoices/billing-history
 * Get user's billing history
 */
router.get('/billing-history', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { limit = 12, offset = 0 } = req.query;
        
        const result = await query(
            `SELECT bh.*, inv.invoice_number, inv.total_amount
             FROM billing_history bh
             LEFT JOIN invoices inv ON bh.invoice_id = inv.id
             WHERE bh.user_id = $1
             ORDER BY bh.billing_cycle_start DESC
             LIMIT $2 OFFSET $3`,
            [userId, parseInt(limit), parseInt(offset)]
        );
        
        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) as count FROM billing_history WHERE user_id = $1`,
            [userId]
        );
        
        res.json({
            history: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('❌ Error fetching billing history:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/invoices/mark-viewed
 * Mark invoice as viewed by user
 */
router.post('/mark-viewed', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { receiptId } = req.body;
        
        if (!receiptId) {
            return res.status(400).json({ error: 'receiptId is required' });
        }
        
        // Verify ownership
        const receiptResult = await query(
            `SELECT invoice_number FROM email_receipts WHERE id = $1 AND user_id = $2`,
            [receiptId, userId]
        );
        
        if (receiptResult.rows.length === 0) {
            return res.status(404).json({ error: 'Receipt not found' });
        }
        
        const invoiceNumber = receiptResult.rows[0].invoice_number;
        
        // Update invoice status
        await query(
            `UPDATE invoices 
             SET invoice_status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE invoice_number = $2 AND invoice_status NOT IN ('paid', 'refunded')`,
            ['viewed', invoiceNumber]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error marking invoice as viewed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/invoices/summary
 * Get invoice and receipt summary stats for user
 */
router.get('/summary', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        // Total receipts sent
        const receiptCountResult = await query(
            `SELECT COUNT(*) as count FROM email_receipts WHERE user_id = $1`,
            [userId]
        );
        
        // Successfully delivered
        const deliveredResult = await query(
            `SELECT COUNT(*) as count FROM email_receipts 
             WHERE user_id = $1 AND status = 'delivered'`,
            [userId]
        );
        
        // Failed/bounced
        const failedResult = await query(
            `SELECT COUNT(*) as count FROM email_receipts 
             WHERE user_id = $1 AND status IN ('failed', 'bounced')`,
            [userId]
        );
        
        // Total amount invoiced
        const totalResult = await query(
            `SELECT SUM(total_amount) as total FROM invoices WHERE user_id = $1`,
            [userId]
        );
        
        // Recent receipts
        const recentResult = await query(
            `SELECT receipt_number, invoice_number, created_at, status
             FROM email_receipts
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 5`,
            [userId]
        );
        
        res.json({
            summary: {
                totalReceipts: parseInt(receiptCountResult.rows[0].count || 0),
                deliveredCount: parseInt(deliveredResult.rows[0].count || 0),
                failedCount: parseInt(failedResult.rows[0].count || 0),
                totalInvoiced: parseFloat(totalResult.rows[0].total || 0)
            },
            recentReceipts: recentResult.rows
        });
    } catch (error) {
        console.error('❌ Error fetching invoice summary:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
