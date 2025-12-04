// ============================================
// ENHANCED AUTHENTICATION MODULE
// Production-ready auth with validation & UX
// ============================================

console.log('🔐 Loading Enhanced Auth Module');

// ============================================
// FORM VALIDATION
// ============================================

const FormValidator = {
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePassword(password) {
        // At least 8 characters (backend requirement)
        return password.length >= 8;
    },

    validateName(name) {
        // Backend requires min 3 alphanumeric characters
        return name.trim().length >= 3;
    },

    getPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        return strength; // 0-5
    },

    getPasswordStrengthText(strength) {
        const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
        return levels[strength] || 'Very Weak';
    },

    getPasswordStrengthColor(strength) {
        const colors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981'];
        return colors[strength] || '#ef4444';
    }
};

// ============================================
// AUTH FORM HANDLER
// ============================================

class AuthFormHandler {
    constructor() {
        this.isSubmitting = false;
        this.init();
    }

    init() {
        // Use setTimeout to ensure DOM is fully ready
        setTimeout(() => {
            this.setupLoginForm();
            this.setupSignupForm();
            this.setupFormToggle();
        }, 100);
    }

    setupLoginForm() {
        const form = document.getElementById('login-form-element');
        if (!form) return;

        form.addEventListener('submit', (e) => this.handleLoginSubmit(e));

        // Real-time validation
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');

        emailInput?.addEventListener('blur', () => {
            const isValid = FormValidator.validateEmail(emailInput.value);
            this.setFieldError(emailInput, !isValid, 'Please enter a valid email');
        });

        passwordInput?.addEventListener('blur', () => {
            const isValid = FormValidator.validatePassword(passwordInput.value);
            this.setFieldError(passwordInput, !isValid, 'Password must be at least 8 characters');
        });
    }

    setupSignupForm() {
        const form = document.getElementById('signup-form-element');
        if (!form) return;

        form.addEventListener('submit', (e) => this.handleSignupSubmit(e));

        // Real-time validation
        const usernameInput = document.getElementById('signup-username');
        const emailInput = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');

        usernameInput?.addEventListener('blur', () => {
            const isValid = FormValidator.validateName(usernameInput.value);
            this.setFieldError(usernameInput, !isValid, 'Username must be at least 3 characters (letters & numbers only)');
        });

        emailInput?.addEventListener('blur', () => {
            const isValid = FormValidator.validateEmail(emailInput.value);
            this.setFieldError(emailInput, !isValid, 'Please enter a valid email');
        });

        passwordInput?.addEventListener('blur', () => {
            const isValid = FormValidator.validatePassword(passwordInput.value);
            this.setFieldError(passwordInput, !isValid, 'Password must be at least 8 characters');
            
            // Show strength indicator
            const strength = FormValidator.getPasswordStrength(passwordInput.value);
            this.showPasswordStrength(strength);
        });

        passwordInput?.addEventListener('input', () => {
            if (passwordInput.value) {
                const strength = FormValidator.getPasswordStrength(passwordInput.value);
                this.showPasswordStrength(strength);
            }
        });
    }

    setupFormToggle() {
        console.log('🔄 setupFormToggle called at', new Date().toISOString());
        
        // Don't reinit if already setup (prevents duplicate listeners)
        if (this.toggleSetup) {
            console.log('⏭️ Toggle already setup, skipping...');
            return;
        }
        
        const showSignupBtn = document.getElementById('show-signup');
        const showLoginBtn = document.getElementById('show-login');
        const forgotPasswordLink = document.getElementById('forgot-password-link');

        console.log('🔄 Form toggle elements:', { 
            showSignupBtn: !!showSignupBtn, 
            showLoginBtn: !!showLoginBtn, 
            forgotPasswordLink: !!forgotPasswordLink
        });

        if (showSignupBtn) {
            showSignupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ SIGN UP CLICKED - Switching to signup form');
                this.toggleForms('signup');
            });
            console.log('✅ Sign up button listener attached');
        }

        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ SIGN IN CLICKED - Switching to login form');
                this.toggleForms('login');
            });
            console.log('✅ Sign in button listener attached');
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔐 FORGOT PASSWORD CLICKED - Opening password reset flow');
                if (typeof window.openPasswordReset === 'function') {
                    window.openPasswordReset();
                } else {
                    console.error('❌ window.openPasswordReset not found!');
                }
            });
            console.log('✅ Forgot password link listener attached');
        }
        
        this.toggleSetup = true;
    }

    toggleForms(formType) {
        console.log('🔄 toggleForms called with:', formType);
        
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        console.log('📋 Current state:', { 
            loginFormExists: !!loginForm, 
            signupFormExists: !!signupForm,
            loginFormDisplay: loginForm?.style.display,
            signupFormDisplay: signupForm?.style.display
        });

        if (!loginForm || !signupForm) {
            console.error('❌ Form elements not found!');
            return;
        }

        if (formType === 'signup') {
            console.log('➡️ Switching to SIGNUP form...');
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
            console.log('✅ Signup form visible, login form hidden');
            
            setTimeout(() => {
                document.getElementById('signup-username')?.focus();
            }, 100);
        } else {
            console.log('➡️ Switching to LOGIN form...');
            signupForm.style.display = 'none';
            loginForm.style.display = 'block';
            console.log('✅ Login form visible, signup form hidden');
            
            setTimeout(() => {
                document.getElementById('login-email')?.focus();
            }, 100);
        }
        
        // Double-check after a moment
        setTimeout(() => {
            console.log('🔍 Verifying form states:', {
                loginDisplay: document.getElementById('login-form')?.style.display,
                signupDisplay: document.getElementById('signup-form')?.style.display
            });
        }, 150);
    }

    async handleLoginSubmit(e) {
        e.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        // Validate
        if (!FormValidator.validateEmail(email)) {
            showToast('Please enter a valid email', 'error');
            return;
        }

        if (!FormValidator.validatePassword(password)) {
            showToast('Password must be at least 8 characters', 'error');
            return;
        }

        // Submit
        this.setFormSubmitting(true, 'login-form-element');

        const success = await authManager.login(email, password);

        this.setFormSubmitting(false, 'login-form-element');

        if (success) {
            // Wait a moment for state update, then navigate
            setTimeout(() => {
                navigation.navigateTo('home');
            }, 500);
        }
    }

    async handleSignupSubmit(e) {
        e.preventDefault();
        console.log('📝 Signup form submitted');

        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        console.log('📊 Form data:', { username, email, passwordLength: password.length });

        // Validate
        if (!FormValidator.validateName(username)) {
            console.warn('⚠️ Invalid username');
            showToast('Username must be at least 3 characters (letters & numbers only)', 'error');
            return;
        }

        if (!FormValidator.validateEmail(email)) {
            console.warn('⚠️ Invalid email');
            showToast('Please enter a valid email', 'error');
            return;
        }

        if (!FormValidator.validatePassword(password)) {
            console.warn('⚠️ Invalid password');
            showToast('Password must be at least 8 characters', 'error');
            return;
        }

        console.log('✅ Validation passed, submitting to API...');

        // Submit
        this.setFormSubmitting(true, 'signup-form-element');

        const success = await authManager.signup(email, password, username);

        this.setFormSubmitting(false, 'signup-form-element');

        if (success) {
            // Clear form
            document.getElementById('signup-form-element').reset();
            
            // Wait a moment for state update, then navigate
            setTimeout(() => {
                navigation.navigateTo('home');
            }, 500);
        }
    }

    setFieldError(field, hasError, message) {
        if (hasError) {
            field.style.borderColor = 'var(--danger)';
            field.title = message;
        } else {
            field.style.borderColor = 'var(--border-color)';
            field.title = '';
        }
    }

    setFormSubmitting(isSubmitting, formId) {
        const form = document.getElementById(formId);
        const button = form?.querySelector('button[type="submit"]');

        if (isSubmitting) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            button.style.opacity = '0.6';
        } else {
            button.disabled = false;
            button.innerHTML = formId.includes('login') ? 'Sign In' : 'Create Account';
            button.style.opacity = '1';
        }
    }

    showPasswordStrength(strength) {
        let existingBar = document.getElementById('password-strength-bar');
        
        if (!existingBar) {
            const passwordInput = document.getElementById('signup-password');
            const container = passwordInput.parentElement;
            
            const bar = document.createElement('div');
            bar.id = 'password-strength-bar';
            bar.style.cssText = `
                height: 4px;
                background: var(--border-color);
                border-radius: 2px;
                margin-top: 8px;
                overflow: hidden;
            `;
            
            const fill = document.createElement('div');
            fill.id = 'password-strength-fill';
            bar.appendChild(fill);
            container.appendChild(bar);
            
            existingBar = bar;
        }

        const fill = document.getElementById('password-strength-fill');
        const percent = (strength + 1) / 6 * 100;
        const color = FormValidator.getPasswordStrengthColor(strength);
        const text = FormValidator.getPasswordStrengthText(strength);

        fill.style.width = percent + '%';
        fill.style.background = color;
        fill.title = 'Strength: ' + text;
    }
}

// Defer initialization until DOM is ready
let authFormHandler;

function initAuthFormHandler() {
    console.log('🔐 Init Auth Form Handler called at', new Date().toISOString());
    
    if (!authFormHandler) {
        authFormHandler = new AuthFormHandler();
        console.log('✅ Auth Form Handler initialized for first time');
    } else {
        console.log('ℹ️ Auth Form Handler already exists, skipping re-init');
        // Don't re-init, just let existing handler work
    }
}

// Initialize on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOMContentLoaded fired');
        initAuthFormHandler();
    });
} else {
    console.log('📄 DOM already loaded');
    initAuthFormHandler();
}

// Export for re-initialization when navigating to auth page
window.reinitAuthForm = initAuthFormHandler;

// Also setup global click handler as fallback
document.addEventListener('click', (e) => {
    if (e.target.id === 'show-signup') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔴 GLOBAL: Sign up link clicked');
        if (authFormHandler) {
            authFormHandler.toggleForms('signup');
        } else {
            console.error('❌ authFormHandler not initialized!');
        }
    }
    if (e.target.id === 'show-login') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔴 GLOBAL: Sign in link clicked');
        if (authFormHandler) {
            authFormHandler.toggleForms('login');
        } else {
            console.error('❌ authFormHandler not initialized!');
        }
    }
    if (e.target.id === 'forgot-password-link') {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔴 GLOBAL: Forgot password link clicked');
        if (typeof window.openPasswordReset === 'function') {
            window.openPasswordReset();
        } else {
            console.error('❌ window.openPasswordReset not found!');
        }
    }
}, true); // Use capture phase

console.log('✅ Enhanced Auth Module loaded');
