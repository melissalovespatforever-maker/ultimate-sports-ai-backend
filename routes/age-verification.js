// ============================================
// AGE VERIFICATION SYSTEM (18+)
// Must accept before accessing app
// ============================================

const ageVerification = {
    isVerified: false,
    
    init() {
        console.log('🔞 Age Verification initializing...');
        
        // Check if already verified in this session
        const verified = sessionStorage.getItem('age_verified');
        if (verified === 'true') {
            this.isVerified = true;
            console.log('✅ Age already verified this session');
            return;
        }
        
        // Show verification modal
        this.showVerificationModal();
    },
    
    showVerificationModal() {
        const modal = document.createElement('div');
        modal.id = 'age-verification-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgba(30, 30, 60, 0.95) 0%, rgba(20, 20, 40, 0.95) 100%);
                border: 2px solid rgba(255, 215, 0, 0.3);
                border-radius: 20px;
                padding: 50px;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                animation: slideUp 0.5s ease-out;
            ">
                <div style="font-size: 80px; margin-bottom: 20px;">🔞</div>
                
                <h1 style="
                    color: #FFD700;
                    font-size: 32px;
                    margin-bottom: 20px;
                    text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
                    font-weight: bold;
                ">Age Verification Required</h1>
                
                <p style="
                    color: #fff;
                    font-size: 18px;
                    line-height: 1.6;
                    margin-bottom: 30px;
                    opacity: 0.9;
                ">
                    This platform contains sports betting and gaming content.<br>
                    <strong>You must be 18 years or older to enter.</strong>
                </p>
                
                <div style="
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 15px;
                    padding: 25px;
                    margin-bottom: 30px;
                ">
                    <label style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        color: #fff;
                        font-size: 16px;
                        gap: 15px;
                    ">
                        <input type="checkbox" id="age-confirm-checkbox" style="
                            width: 24px;
                            height: 24px;
                            cursor: pointer;
                            accent-color: #FFD700;
                        ">
                        <span>I confirm that I am 18 years of age or older</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <button id="age-verify-yes" disabled style="
                        background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
                        color: white;
                        border: none;
                        padding: 15px 40px;
                        border-radius: 10px;
                        font-size: 18px;
                        font-weight: bold;
                        cursor: not-allowed;
                        opacity: 0.5;
                        transition: all 0.3s;
                        box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);
                    ">
                        ✅ Yes, I'm 18+
                    </button>
                    
                    <button id="age-verify-no" style="
                        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                        color: white;
                        border: none;
                        padding: 15px 40px;
                        border-radius: 10px;
                        font-size: 18px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
                    ">
                        ❌ No, I'm under 18
                    </button>
                </div>
                
                <p style="
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 12px;
                    margin-top: 30px;
                    line-height: 1.4;
                ">
                    By clicking "Yes, I'm 18+", you certify that you are of legal age<br>
                    to participate in sports betting and gaming in your jurisdiction.
                </p>
            </div>
            
            <style>
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(50px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                #age-verify-yes:not(:disabled):hover {
                    transform: translateY(-3px);
                    box-shadow: 0 6px 25px rgba(46, 204, 113, 0.5);
                    opacity: 1;
                }
                
                #age-verify-no:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 6px 25px rgba(231, 76, 60, 0.5);
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        
        // Handle checkbox change
        const checkbox = document.getElementById('age-confirm-checkbox');
        const yesButton = document.getElementById('age-verify-yes');
        
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                yesButton.disabled = false;
                yesButton.style.cursor = 'pointer';
                yesButton.style.opacity = '1';
            } else {
                yesButton.disabled = true;
                yesButton.style.cursor = 'not-allowed';
                yesButton.style.opacity = '0.5';
            }
        });
        
        // Handle "Yes" button
        yesButton.addEventListener('click', () => {
            if (checkbox.checked) {
                this.verifyAge(true);
                modal.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => modal.remove(), 300);
            }
        });
        
        // Handle "No" button
        document.getElementById('age-verify-no').addEventListener('click', () => {
            this.verifyAge(false);
        });
    },
    
    verifyAge(confirmed) {
        if (confirmed) {
            this.isVerified = true;
            sessionStorage.setItem('age_verified', 'true');
            console.log('✅ Age verification confirmed');
            
            // Show success message
            this.showSuccessMessage();
            
            // Dispatch event so app knows user is verified
            window.dispatchEvent(new CustomEvent('age-verified'));
        } else {
            // Redirect away or show denial message
            document.body.innerHTML = `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    text-align: center;
                    padding: 20px;
                ">
                    <div>
                        <div style="font-size: 100px; margin-bottom: 30px;">😢</div>
                        <h1 style="color: #FFD700; font-size: 36px; margin-bottom: 20px;">
                            Sorry!
                        </h1>
                        <p style="color: #fff; font-size: 20px; line-height: 1.6; max-width: 600px;">
                            You must be 18 years or older to access this platform.<br>
                            Please return when you meet the age requirement.
                        </p>
                        <button onclick="window.location.href='https://google.com'" style="
                            margin-top: 30px;
                            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                            color: white;
                            border: none;
                            padding: 15px 40px;
                            border-radius: 10px;
                            font-size: 18px;
                            cursor: pointer;
                        ">
                            Exit Site
                        </button>
                    </div>
                </div>
            `;
        }
    },
    
    showSuccessMessage() {
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
            color: white;
            padding: 30px 50px;
            border-radius: 15px;
            font-size: 20px;
            font-weight: bold;
            z-index: 100001;
            box-shadow: 0 10px 40px rgba(46, 204, 113, 0.5);
            animation: fadeInOut 2s ease-in-out;
        `;
        successMsg.innerHTML = '✅ Age Verified! Welcome to Ultimate Sports AI';
        
        document.body.appendChild(successMsg);
        
        setTimeout(() => successMsg.remove(), 2000);
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ageVerification.init());
} else {
    ageVerification.init();
}

// Export for use in other modules
window.ageVerification = ageVerification;
