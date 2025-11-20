// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err);
    
    // Validation error
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message,
            details: err.details
        });
    }
    
    // Database error
    if (err.code && err.code.startsWith('23')) {
        if (err.code === '23505') {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Resource already exists'
            });
        }
        if (err.code === '23503') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Referenced resource does not exist'
            });
        }
    }
    
    // Default error
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.name || 'Internal Server Error',
        message: err.message || 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}

module.exports = {
    errorHandler,
    AppError
};
