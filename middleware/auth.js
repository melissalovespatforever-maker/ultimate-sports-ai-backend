// ============================================
// AUTHENTICATION MIDDLEWARE
// JWT token verification
// ============================================

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Access token required'
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Invalid or expired token'
            });
        }
        
        req.user = { id: decoded.userId };
        next();
    });
};

module.exports = { authenticateToken };
