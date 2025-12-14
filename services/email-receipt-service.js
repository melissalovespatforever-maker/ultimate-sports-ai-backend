// ============================================
// EMAIL RECEIPT SERVICE
// Handles receipt generation, email sending, and invoice creation
// ============================================

const axios = require('axios');
const { query, transaction } = require('../config/database');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@ultimatesportsai.com';
const FROM_NAME = 'Ultimate Sports AI';

// ============================================
// RECEIPT NUMBER GENERATOR
// ============================================

/**
 * Generate unique receipt number
 */
async function generateReceiptNumber() {
    try {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        // Get count for today
        const result = await query(
            `SELECT COUNT(*) as count FROM email_receipts 
             WHERE DATE(created_at) = CURRENT_DATE`,
            []
        );
        
        const count = parseInt(result.rows[0].count || 0) + 1;
        const receiptNumber = `RCP-${year}${month}-${String(count).padStart(6, '0')}`;
        
        return receiptNumber;
    } catch (error) {
        console.error('❌ Error generating receipt number:', error);
        throw error;
    }
}

/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber() {
    try {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        const result = await query(
            `SELECT COUNT(*) as count FROM invoices 
             WHERE DATE(created_at) = CURRENT_DATE`,
            []
        );
        
        const count = parseInt(result.rows[0].count || 0) + 1;
        const invoiceNumber = `INV-${year}${month}-${String(count).padStart(6, '0')}`;
        
        return invoiceNumber;
    } catch (error) {
        console.error('❌ Error generating invoice number:', error);
        throw error;
    }
}

// ============================================
// INVOICE CREATION
// ============================================

/**
 * Create invoice for payment
 */
async function createInvoice(paymentData, userData) {
    try {
        const invoiceNumber = await generateInvoiceNumber();
        const invoiceDate = new Date();
        
        // Calculate line items
        const lineItems = [
            {
                description: `${paymentData.tier.toUpperCase()} Subscription (${paymentData.billing_cycle || 'monthly'})`,
                quantity: 1,
                unit_price: paymentData.amount,
                amount: paymentData.amount,
                sku: `SUB-${paymentData.tier.toUpperCase()}-${(paymentData.billing_cycle || 'monthly').toUpperCase()[0]}`
            }
        ];
        
        const subtotal = paymentData.amount;
        const taxAmount = 0; // Adjust based on tax requirements
        const discountAmount = 0;
        const totalAmount = subtotal + taxAmount - discountAmount;
        
        const invoiceResult = await query(
            `INSERT INTO invoices (
                user_id, payment_id, invoice_number, invoice_date,
                bill_to_name, bill_to_email, 
                line_items, subtotal, tax_amount, discount_amount, total_amount,
                payment_method, subscription_tier, billing_cycle,
                invoice_status, currency
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                paymentData.user_id,
                paymentData.payment_id,
                invoiceNumber,
                invoiceDate,
                userData.full_name || userData.email,
                userData.email,
                JSON.stringify(lineItems),
                subtotal,
                taxAmount,
                discountAmount,
                totalAmount,
                'PayPal',
                paymentData.tier,
                paymentData.billing_cycle || 'monthly',
                'issued',
                'USD'
            ]
        );
        
        const invoice = invoiceResult.rows[0];
        
        // Update payment with invoice reference
        await query(
            `UPDATE payments SET invoice_id = $1 WHERE id = $2`,
            [invoice.id, paymentData.payment_id]
        );
        
        console.log(`✅ Invoice created: ${invoiceNumber}`);
        return invoice;
    } catch (error) {
        console.error('❌ Error creating invoice:', error);
        throw error;
    }
}

// ============================================
// EMAIL TEMPLATE GENERATION
// ============================================

/**
 * Generate receipt HTML email
 */
function generateReceiptHTML(receiptData, invoiceData) {
    const { receiptNumber, recipientEmail, createdAt } = receiptData;
    const { invoiceNumber, lineItems, subtotal, taxAmount, discountAmount, totalAmount } = invoiceData;
    
    const lineItemsHTML = lineItems.map(item => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                ${item.description}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                ${item.quantity}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                $${parseFloat(item.unit_price).toFixed(2)}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">
                $${parseFloat(item.amount).toFixed(2)}
            </td>
        </tr>
    `).join('');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 30px; }
                .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; color: #6b7280; }
                .invoice-label { font-weight: 600; color: #1f2937; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; color: #1f2937; border-bottom: 2px solid #e5e7eb; }
                .summary-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
                .summary-total { display: flex; justify-content: space-between; padding: 16px 0; font-size: 18px; font-weight: 700; color: #10b981; }
                .footer { background: #1f2937; color: #d1d5db; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
                .button { background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0; font-size: 28px;">Ultimate Sports AI</h1>
                    <p style="margin: 8px 0 0; opacity: 0.9;">Subscription Receipt</p>
                </div>
                
                <div class="content">
                    <p style="color: #374151; margin-bottom: 20px;">Thank you for your subscription!</p>
                    
                    <div class="invoice-info">
                        <div>
                            <div class="invoice-label">Receipt #</div>
                            <div>${receiptNumber}</div>
                        </div>
                        <div>
                            <div class="invoice-label">Invoice #</div>
                            <div>${invoiceNumber}</div>
                        </div>
                        <div>
                            <div class="invoice-label">Date</div>
                            <div>${new Date(createdAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th style="text-align: right;">Qty</th>
                                <th style="text-align: right;">Unit Price</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lineItemsHTML}
                        </tbody>
                    </table>
                    
                    <div style="margin-left: auto; width: 300px;">
                        <div class="summary-row">
                            <span>Subtotal:</span>
                            <span>$${parseFloat(subtotal).toFixed(2)}</span>
                        </div>
                        ${taxAmount > 0 ? `
                        <div class="summary-row">
                            <span>Tax:</span>
                            <span>$${parseFloat(taxAmount).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        ${discountAmount > 0 ? `
                        <div class="summary-row">
                            <span>Discount:</span>
                            <span>-$${parseFloat(discountAmount).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div class="summary-total">
                            <span>Total:</span>
                            <span>$${parseFloat(totalAmount).toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        Your subscription is now active! Access all PRO features immediately.
                    </p>
                </div>
                
                <div class="footer">
                    <p style="margin: 0;">© 2024 Ultimate Sports AI. All rights reserved.</p>
                    <p style="margin: 8px 0 0;">If you have any questions, contact us at billing@ultimatesportsai.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

/**
 * Generate plain text receipt
 */
function generateReceiptText(receiptData, invoiceData) {
    const { receiptNumber, recipientEmail, createdAt } = receiptData;
    const { invoiceNumber, lineItems, subtotal, taxAmount, discountAmount, totalAmount } = invoiceData;
    
    const lineItemsText = lineItems.map(item => 
        `${item.description}\n  Qty: ${item.quantity} x $${parseFloat(item.unit_price).toFixed(2)} = $${parseFloat(item.amount).toFixed(2)}`
    ).join('\n');
    
    return `
ULTIMATE SPORTS AI - SUBSCRIPTION RECEIPT
==========================================

Receipt #: ${receiptNumber}
Invoice #: ${invoiceNumber}
Date: ${new Date(createdAt).toLocaleDateString()}

ITEMS:
------
${lineItemsText}

SUMMARY:
--------
Subtotal:     $${parseFloat(subtotal).toFixed(2)}
${taxAmount > 0 ? `Tax:          $${parseFloat(taxAmount).toFixed(2)}\n` : ''}${discountAmount > 0 ? `Discount:     -$${parseFloat(discountAmount).toFixed(2)}\n` : ''}Total:        $${parseFloat(totalAmount).toFixed(2)}

Thank you for your subscription!

© 2024 Ultimate Sports AI
billing@ultimatesportsai.com
    `.trim();
}

// ============================================
// SENDGRID EMAIL SENDING
// ============================================

/**
 * Send receipt email via SendGrid
 */
async function sendReceiptEmail(receiptId, htmlBody, textBody, subject, recipientEmail) {
    try {
        if (!SENDGRID_API_KEY) {
            console.warn('⚠️ SendGrid API key not configured');
            return null;
        }
        
        const response = await axios.post(
            'https://api.sendgrid.com/v3/mail/send',
            {
                personalizations: [
                    {
                        to: [{ email: recipientEmail }],
                        subject: subject
                    }
                ],
                from: { email: FROM_EMAIL, name: FROM_NAME },
                content: [
                    { type: 'text/plain', value: textBody },
                    { type: 'text/html', value: htmlBody }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // Store message ID
        const messageId = response.headers['x-message-id'];
        
        // Update receipt with sending status
        await query(
            `UPDATE email_receipts 
             SET status = $1, sent_at = CURRENT_TIMESTAMP, provider_message_id = $2
             WHERE id = $3`,
            ['sent', messageId, receiptId]
        );
        
        // Log action
        await query(
            `INSERT INTO receipt_logs (email_receipt_id, action, new_status, event_data)
             VALUES ($1, $2, $3, $4)`,
            [receiptId, 'email_sent', 'sent', JSON.stringify({ messageId })]
        );
        
        console.log(`✅ Receipt email sent (${messageId})`);
        return messageId;
    } catch (error) {
        console.error('❌ Error sending receipt email:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================
// MAIN RECEIPT CREATION & SENDING
// ============================================

/**
 * Create and send complete receipt
 */
async function createAndSendReceipt(paymentData, userData) {
    try {
        return await transaction(async (client) => {
            // Generate receipt and invoice numbers
            const receiptNumber = await generateReceiptNumber();
            const invoiceNumber = await generateInvoiceNumber();
            
            // Create invoice
            const invoice = await createInvoice(paymentData, userData);
            
            // Create receipt record
            const htmlBody = generateReceiptHTML(
                { receiptNumber, recipientEmail: userData.email, createdAt: new Date() },
                invoice
            );
            const textBody = generateReceiptText(
                { receiptNumber, recipientEmail: userData.email, createdAt: new Date() },
                invoice
            );
            
            const receiptResult = await query(
                `INSERT INTO email_receipts (
                    user_id, payment_id, receipt_number, invoice_number,
                    recipient_email, subject, html_body, text_body,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [
                    paymentData.user_id,
                    paymentData.payment_id,
                    receiptNumber,
                    invoiceNumber,
                    userData.email,
                    `Receipt #${receiptNumber} - Ultimate Sports AI Subscription`,
                    htmlBody,
                    textBody,
                    'pending'
                ]
            );
            
            const receipt = receiptResult.rows[0];
            
            // Send email
            try {
                await sendReceiptEmail(
                    receipt.id,
                    htmlBody,
                    textBody,
                    receipt.subject,
                    userData.email
                );
            } catch (emailError) {
                console.error('⚠️ Email sending failed, but receipt created:', emailError);
                // Update receipt with error
                await query(
                    `UPDATE email_receipts 
                     SET status = $1, error_message = $2, failed_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    ['failed', emailError.message, receipt.id]
                );
            }
            
            return {
                receipt,
                invoice,
                receiptNumber,
                invoiceNumber
            };
        });
    } catch (error) {
        console.error('❌ Error creating and sending receipt:', error);
        throw error;
    }
}

/**
 * Retry failed receipt sending
 */
async function retryFailedReceipt(receiptId) {
    try {
        const result = await query(
            `SELECT * FROM email_receipts WHERE id = $1`,
            [receiptId]
        );
        
        if (result.rows.length === 0) {
            throw new Error('Receipt not found');
        }
        
        const receipt = result.rows[0];
        
        if (receipt.retry_count >= 3) {
            console.warn(`⚠️ Receipt ${receiptId} exceeded retry limit`);
            return false;
        }
        
        // Attempt to send
        await sendReceiptEmail(
            receipt.id,
            receipt.html_body,
            receipt.text_body,
            receipt.subject,
            receipt.recipient_email
        );
        
        // Update retry count
        await query(
            `UPDATE email_receipts 
             SET retry_count = retry_count + 1, last_retry_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [receiptId]
        );
        
        return true;
    } catch (error) {
        console.error(`❌ Error retrying receipt ${receiptId}:`, error);
        return false;
    }
}

/**
 * Get receipt with invoice details
 */
async function getReceiptWithDetails(receiptId) {
    try {
        const result = await query(
            `SELECT er.*, inv.*
             FROM email_receipts er
             LEFT JOIN invoices inv ON er.invoice_number = inv.invoice_number
             WHERE er.id = $1`,
            [receiptId]
        );
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('❌ Error fetching receipt details:', error);
        throw error;
    }
}

/**
 * Get user's receipt history
 */
async function getUserReceiptHistory(userId, limit = 20, offset = 0) {
    try {
        const result = await query(
            `SELECT er.*, inv.total_amount, inv.invoice_date
             FROM email_receipts er
             LEFT JOIN invoices inv ON er.invoice_number = inv.invoice_number
             WHERE er.user_id = $1
             ORDER BY er.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        
        return result.rows;
    } catch (error) {
        console.error('❌ Error fetching receipt history:', error);
        throw error;
    }
}

module.exports = {
    generateReceiptNumber,
    generateInvoiceNumber,
    createInvoice,
    generateReceiptHTML,
    generateReceiptText,
    sendReceiptEmail,
    createAndSendReceipt,
    retryFailedReceipt,
    getReceiptWithDetails,
    getUserReceiptHistory
};
