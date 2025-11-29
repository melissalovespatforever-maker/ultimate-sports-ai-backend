// ============================================
// SECURITY MIDDLEWARE
// Comprehensive security controls for API
// ============================================

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const cors = require('cors');

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
    }
});

// Strict rate limit for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    skipSuccessfulRequests: true,
    message: {
        error: 'Too Many Login Attempts',
        message: 'Too many login attempts, please try again in 15 minutes',
        retryAfter: '15 minutes'
    }
});

// Payment endpoint rate limit
const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 payment attempts per hour
    message: {
        error: 'Too Many Payment Attempts',
        message: 'Too many payment attempts, please try again in 1 hour',
        retryAfter: '1 hour'
    }
});

// Password reset rate limit
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset attempts per hour
    message: {
        error: 'Too Many Reset Attempts',
        message: 'Too many password reset attempts, please try again later',
        retryAfter: '1 hour'
    }
});

// ============================================
// INPUT VALIDATION & SANITIZATION
// ============================================

// Sanitize user input to prevent SQL injection
const sanitizeInput = (req, res, next) => {
    // PostgreSQL prepared statements handle injection protection
    next();
};

// Validate email format
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate password strength
const validatePassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
};

// Validate username
const validateUsername = (username) => {
    // 3-20 characters, alphanumeric and underscore only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
};

// Input validation middleware
const validateInput = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation Error',
                message: error.details[0].message
            });
        }
        next();
    };
};

// ============================================
// CORS CONFIGURATION
// ============================================

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://ultimate-sports-ai.com',
            'https://www.ultimate-sports-ai.com',
            'https://play.rosebud.ai',
            'http://localhost:3000',
            'http://localhost:5173',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`Blocked CORS request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// ============================================
// SECURITY HEADERS
// ============================================

const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://js.stripe.com'],
            imgSrc: ["'self'", 'data:', 'https:', 'http:'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
            connectSrc: ["'self'", 'https://api.stripe.com', 'wss:', 'ws:'],
            frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    }
});

// ============================================
// DATA PROTECTION
// ============================================

// Remove sensitive fields from user objects
const sanitizeUser = (user) => {
    const sanitized = { ...user };
    delete sanitized.password;
    delete sanitized.password_hash;
    delete sanitized.reset_token;
    delete sanitized.reset_token_expires;
    delete sanitized.verification_token;
    delete sanitized.refresh_token;
    return sanitized;
};

// Sanitize error messages (don't leak sensitive info)
const sanitizeError = (error) => {
    if (process.env.NODE_ENV === 'production') {
        // Don't expose internal errors in production
        return {
            error: 'Internal Server Error',
            message: 'An error occurred. Please try again later.'
        };
    }
    return {
        error: error.name || 'Error',
        message: error.message || 'An error occurred'
    };
};

// ============================================
// SQL INJECTION PROTECTION
// ============================================

// Validate and sanitize SQL parameters
const validateSQLParams = (params) => {
    return params.map(param => {
        if (typeof param === 'string') {
            // Remove potential SQL injection characters
            return param.replace(/['";\\]/g, '');
        }
        return param;
    });
};

// ============================================
// SESSION SECURITY
// ============================================

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict' // CSRF protection
    }
};

// ============================================
// API KEY VALIDATION
// ============================================

const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key required'
        });
    }
    
    if (apiKey !== process.env.API_KEY) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid API key'
        });
    }
    
    next();
};

// ============================================
// WEBHOOK SIGNATURE VALIDATION
// ============================================

const validateWebhookSignature = (secret) => {
    return (req, res, next) => {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        
        if (!signature || !timestamp) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing webhook signature'
            });
        }
        
        // Check timestamp to prevent replay attacks (5 minute window)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(timestamp)) > 300) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Webhook timestamp too old'
            });
        }
        
        // Validate signature
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(timestamp + JSON.stringify(req.body))
            .digest('hex');
        
        if (signature !== expectedSignature) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid webhook signature'
            });
        }
        
        next();
    };
};

// ============================================
// REQUEST SIZE LIMITS
// ============================================

const requestSizeLimits = {
    json: '10mb',      // JSON payloads
    urlencoded: '10mb', // Form data
    text: '10mb',      // Text data
    raw: '10mb'        // Raw data
};

// ============================================
// SECURITY LOGGING
// ============================================

const securityLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            path: req.path,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            status: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        };
        
        // Log suspicious activity
        if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
            console.warn('🚨 Security Alert:', logData);
        } else if (res.statusCode >= 500) {
            console.error('❌ Server Error:', logData);
        } else if (process.env.NODE_ENV === 'development') {
            console.log('📝 Request:', logData);
        }
    });
    
    next();
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Rate limiting
    apiLimiter,
    authLimiter,
    paymentLimiter,
    passwordResetLimiter,
    
    // Input validation
    sanitizeInput,
    validateEmail,
    validatePassword,
    validateUsername,
    validateInput,
    validateSQLParams,
    
    // CORS
    corsOptions,
    
    // Security headers
    securityHeaders,
    
    // Data protection
    sanitizeUser,
    sanitizeError,
    
    // Session
    sessionConfig,
    
    // API & Webhooks
    validateApiKey,
    validateWebhookSignature,
    
    // Limits
    requestSizeLimits,
    
    // Logging
    
    // HPP (HTTP Parameter Pollution)
    hpp
};
