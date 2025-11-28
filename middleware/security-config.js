/**
 * Frontend Security Configuration
 * Client-side security measures and best practices
 */

const SecurityConfig = {
    // ============================================
    // API SECURITY
    // ============================================
    
    /**
     * Secure API client with token management
     */
    createSecureClient() {
        const API_BASE_URL = window.location.hostname.includes('localhost') 
            ? 'http://localhost:3001/api'
            : 'https://your-backend-api.railway.app/api';

        return {
            // Get auth token from secure storage
            getToken() {
                try {
                    // Try sessionStorage first (more secure for sensitive data)
                    return sessionStorage.getItem('auth_token') || 
                           localStorage.getItem('auth_token');
                } catch (error) {
                    console.error('Error reading token:', error);
                    return null;
                }
            },

            // Store token securely
            setToken(token) {
                try {
                    // Store in sessionStorage (cleared when tab closes)
                    sessionStorage.setItem('auth_token', token);
                    // Backup in localStorage (persists)
                    localStorage.setItem('auth_token', token);
                } catch (error) {
                    console.error('Error storing token:', error);
                }
            },

            // Remove token
            clearToken() {
                try {
                    sessionStorage.removeItem('auth_token');
                    localStorage.removeItem('auth_token');
                } catch (error) {
                    console.error('Error clearing token:', error);
                }
            },

            // Make authenticated request
            async request(endpoint, options = {}) {
                const token = this.getToken();
                
                const headers = {
                    'Content-Type': 'application/json',
                    ...options.headers
                };

                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                        ...options,
                        headers,
                        credentials: 'include' // Send cookies with requests
                    });

                    // Handle unauthorized (token expired/invalid)
                    if (response.status === 401) {
                        this.clearToken();
                        // Redirect to login
                        if (!window.location.pathname.includes('/login')) {
                            window.location.href = '/login.html';
                        }
                        throw new Error('Unauthorized - Please log in again');
                    }

                    // Handle rate limiting
                    if (response.status === 429) {
                        const retryAfter = response.headers.get('Retry-After');
                        throw new Error(`Rate limit exceeded. Try again in ${retryAfter || '15 minutes'}`);
                    }

                    return response;
                } catch (error) {
                    console.error('API request failed:', error);
                    throw error;
                }
            }
        };
    },

    // ============================================
    // INPUT SANITIZATION
    // ============================================

    /**
     * Sanitize user input to prevent XSS attacks
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        // Remove script tags and event handlers
        let sanitized = input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
        
        // Encode HTML special characters
        const div = document.createElement('div');
        div.textContent = sanitized;
        return div.innerHTML;
    },

    /**
     * Sanitize HTML content (for rich text)
     */
    sanitizeHTML(html) {
        if (typeof html !== 'string') return '';
        
        // Create temporary div
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove dangerous elements
        const dangerous = temp.querySelectorAll('script, iframe, object, embed, link, style');
        dangerous.forEach(el => el.remove());
        
        // Remove event handlers
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        return temp.innerHTML;
    },

    /**
     * Validate email format
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validate password strength
     */
    validatePassword(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };
        
        const strength = Object.values(checks).filter(Boolean).length;
        
        return {
            valid: checks.length && checks.uppercase && checks.lowercase && checks.number,
            strength: strength >= 5 ? 'strong' : strength >= 3 ? 'medium' : 'weak',
            checks
        };
    },

    // ============================================
    // LOCAL STORAGE SECURITY
    // ============================================

    /**
     * Secure storage with encryption (basic)
     */
    secureStorage: {
        // Simple encryption key (use environment variable in production)
        encryptionKey: 'your-encryption-key-change-this',

        // Encrypt data before storing
        encrypt(data) {
            try {
                const jsonString = JSON.stringify(data);
                // Basic Base64 encoding (use proper encryption in production)
                return btoa(jsonString);
            } catch (error) {
                console.error('Encryption failed:', error);
                return null;
            }
        },

        // Decrypt data after retrieving
        decrypt(encrypted) {
            try {
                const jsonString = atob(encrypted);
                return JSON.parse(jsonString);
            } catch (error) {
                console.error('Decryption failed:', error);
                return null;
            }
        },

        // Store encrypted data
        setItem(key, value) {
            try {
                const encrypted = this.encrypt(value);
                if (encrypted) {
                    localStorage.setItem(key, encrypted);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Secure storage set failed:', error);
                return false;
            }
        },

        // Retrieve and decrypt data
        getItem(key) {
            try {
                const encrypted = localStorage.getItem(key);
                if (encrypted) {
                    return this.decrypt(encrypted);
                }
                return null;
            } catch (error) {
                console.error('Secure storage get failed:', error);
                return null;
            }
        },

        // Remove item
        removeItem(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('Secure storage remove failed:', error);
                return false;
            }
        }
    },

    // ============================================
    // CSRF PROTECTION
    // ============================================

    /**
     * Generate CSRF token
     */
    generateCSRFToken() {
        try {
            // Try using Web Crypto API (secure)
            if (window.crypto && window.crypto.getRandomValues) {
                const array = new Uint8Array(32);
                window.crypto.getRandomValues(array);
                return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            }
        } catch (error) {
            console.warn('Crypto API not available, using fallback');
        }
        
        // Fallback for non-secure contexts
        return Math.random().toString(36).substring(2) + 
               Math.random().toString(36).substring(2) + 
               Math.random().toString(36).substring(2) + 
               Date.now().toString(36);
    },

    /**
     * Get or create CSRF token
     */
    getCSRFToken() {
        let token = sessionStorage.getItem('csrf_token');
        if (!token) {
            token = this.generateCSRFToken();
            sessionStorage.setItem('csrf_token', token);
        }
        return token;
    },

    // ============================================
    // CONTENT SECURITY
    // ============================================

    /**
     * Check if URL is safe
     */
    isSafeURL(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            
            // Allow only http/https
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return false;
            }
            
            // Check against whitelist
            const allowedDomains = [
                'rosebud.ai',
                'ultimate-sports-ai.com',
                'vercel.app',
                'railway.app',
                'stripe.com',
                'espn.com',
                'cdn.nba.com'
            ];
            
            return allowedDomains.some(domain => 
                parsed.hostname === domain || 
                parsed.hostname.endsWith(`.${domain}`)
            );
        } catch (error) {
            console.error('URL validation failed:', error);
            return false;
        }
    },

    /**
     * Load external script safely
     */
    async loadScript(src, integrity = null) {
        return new Promise((resolve, reject) => {
            if (!this.isSafeURL(src)) {
                reject(new Error('Unsafe script URL'));
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            if (integrity) {
                script.integrity = integrity;
                script.crossOrigin = 'anonymous';
            }
            
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            
            document.head.appendChild(script);
        });
    },

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Check session validity
     */
    isSessionValid() {
        try {
            const token = this.createSecureClient().getToken();
            if (!token) return false;

            // Decode JWT (basic check - server validates properly)
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            try {
                const payload = JSON.parse(atob(parts[1]));
                const expiresAt = payload.exp * 1000; // Convert to milliseconds
                
                return Date.now() < expiresAt;
            } catch (decodeError) {
                console.warn('Failed to decode JWT:', decodeError);
                return false;
            }
        } catch (error) {
            console.error('Session validation failed:', error);
            return false;
        }
    },

    /**
     * Logout and clear all sensitive data
     */
    logout() {
        const client = this.createSecureClient();
        client.clearToken();
        
        // Clear sensitive localStorage items
        const sensitiveKeys = [
            'auth_token',
            'user_profile',
            'payment_methods',
            'csrf_token'
        ];
        
        sensitiveKeys.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
        
        // Redirect to login
        window.location.href = '/login.html';
    },

    // ============================================
    // INITIALIZE SECURITY
    // ============================================

    /**
     * Initialize security features
     */
    init() {
        try {
            console.log('🔒 Initializing security features...');

            // Check session on page load
            if (!window.location.pathname.includes('/login') && 
                !window.location.pathname.includes('/register')) {
                if (!this.isSessionValid()) {
                    console.warn('⚠️ Invalid or expired session');
                    // Don't force logout on index - allow guest browsing
                    if (window.location.pathname === '/' || 
                        window.location.pathname === '/index.html') {
                        console.log('Guest browsing allowed on homepage');
                    }
                }
            }

            // Auto-logout on session expiry
            const checkSessionInterval = setInterval(() => {
                try {
                    if (!this.isSessionValid() && this.createSecureClient().getToken()) {
                        console.warn('🔴 Session expired - logging out');
                        this.logout();
                    }
                } catch (error) {
                    console.warn('Session check error:', error);
                }
            }, 60000); // Check every minute

            // Prevent clickjacking (safe check)
            try {
                if (window.self !== window.top) {
                    console.warn('⚠️ Running in iframe - clickjacking check skipped for compatibility');
                    // Don't force redirect - could break legitimate use cases
                    // Just log the warning
                }
            } catch (error) {
                console.warn('Clickjacking check skipped (iframe context)');
            }

            // Disable console in production (safe approach)
            if (window.location.hostname !== 'localhost' && 
                !window.location.hostname.includes('127.0.0.1') &&
                !window.location.hostname.includes('run.app')) { // Allow in development environments
                
                // Store original console methods
                const originalLog = console.log;
                const originalWarn = console.warn;
                const originalError = console.error;
                
                // Disable in production
                console.log = () => {};
                console.warn = () => {};
                // Keep console.error for critical errors
            }

            console.log('✅ Security features initialized');
        } catch (error) {
            console.error('❌ Security initialization error:', error);
        }
    }
};

// Initialize on page load (safe initialization)
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try {
                SecurityConfig.init();
            } catch (error) {
                console.error('Failed to initialize SecurityConfig:', error);
            }
        });
    } else {
        SecurityConfig.init();
    }
} catch (error) {
    console.error('Failed to setup SecurityConfig initialization:', error);
}

// Export for use in modules
export default SecurityConfig;

// Also make available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.SecurityConfig = SecurityConfig;
}
