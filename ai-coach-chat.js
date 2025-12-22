// ============================================
// AI COACH CHAT MODAL
// VIP-Exclusive Chat Interface
// ============================================

console.log('💬 AI Coach Chat Module loading...');

const aiCoachChat = {
    currentCoach: null,
    messages: [],
    isOpen: false,

    open(coach) {
        if (!coach) return;
        
        this.currentCoach = coach;
        this.messages = [];
        this.isOpen = true;
        
        // Create modal
        this.createModal();
        
        // Add welcome message
        setTimeout(() => {
            this.addMessage('coach', `Hey! ${coach.catchphrase} I'm here to help you win. Ask me anything about ${coach.sport}!`);
        }, 500);
    },

    close() {
        const modal = document.getElementById('ai-coach-chat-modal');
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.remove();
                this.isOpen = false;
                this.currentCoach = null;
                this.messages = [];
            }, 300);
        }
    },

    createModal() {
        // Remove existing modal if any
        const existing = document.getElementById('ai-coach-chat-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'ai-coach-chat-modal';
        modal.className = 'coach-chat-modal';
        
        modal.innerHTML = `
            <div class="coach-chat-overlay" onclick="aiCoachChat.close()"></div>
            <div class="coach-chat-container">
                <!-- Header -->
                <div class="coach-chat-header" style="background: linear-gradient(135deg, ${this.currentCoach.color}15, ${this.currentCoach.color}05);">
                    <div class="chat-header-left">
                        <img src="${this.currentCoach.avatar}" alt="${this.currentCoach.name}" class="chat-coach-avatar">
                        <div class="chat-coach-info">
                            <h3>${this.currentCoach.name}</h3>
                            <p>${this.currentCoach.sport} Expert</p>
                            <span class="chat-status online">
                                <span class="status-dot"></span> Online
                            </span>
                        </div>
                    </div>
                    <button class="chat-close-btn" onclick="aiCoachChat.close()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Messages Area -->
                <div class="coach-chat-messages" id="chat-messages">
                    <div class="chat-welcome">
                        <div class="welcome-icon" style="color: ${this.currentCoach.color};">
                            <i class="fas fa-comments"></i>
                        </div>
                        <h4>Chat with ${this.currentCoach.name}</h4>
                        <p>Ask about picks, strategies, or ${this.currentCoach.sport} insights</p>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="chat-quick-actions">
                    <button class="quick-action-btn" onclick="aiCoachChat.sendQuickMessage(&quot;What are your top picks for today?&quot;)">
                        <i class="fas fa-star"></i> Today's Picks
                    </button>
                    <button class="quick-action-btn" onclick="aiCoachChat.sendQuickMessage(&quot;What is your betting strategy?&quot;)">
                        <i class="fas fa-lightbulb"></i> Strategy Tips
                    </button>
                    <button class="quick-action-btn" onclick="aiCoachChat.sendQuickMessage(&quot;Tell me about your win rate&quot;)">
                        <i class="fas fa-chart-line"></i> Performance
                    </button>
                </div>

                <!-- Input Area -->
                <div class="coach-chat-input">
                    <div class="input-wrapper">
                        <input 
                            type="text" 
                            id="chat-input" 
                            placeholder="Ask ${this.currentCoach.name} anything..."
                            onkeypress="if(event.key==='Enter') aiCoachChat.sendMessage()"
                        >
                        <button class="send-btn" onclick="aiCoachChat.sendMessage()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="chat-footer-text">
                        <i class="fas fa-shield-alt"></i> VIP Exclusive Feature
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => modal.classList.add('active'), 10);

        // Focus input
        setTimeout(() => {
            const input = document.getElementById('chat-input');
            if (input) input.focus();
        }, 400);
    },

    addMessage(sender, text, typing = false) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // Remove welcome message on first message
        const welcome = messagesContainer.querySelector('.chat-welcome');
        if (welcome && this.messages.length === 0) {
            welcome.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${sender}`;
        
        if (sender === 'coach') {
            messageEl.innerHTML = `
                <img src="${this.currentCoach.avatar}" alt="${this.currentCoach.name}" class="message-avatar">
                <div class="message-content">
                    <div class="message-bubble" style="background: ${this.currentCoach.color}15; border-color: ${this.currentCoach.color}30;">
                        ${typing ? '<span class="typing-indicator"><span></span><span></span><span></span></span>' : text}
                    </div>
                    <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
            `;
        } else {
            messageEl.innerHTML = `
                <div class="message-content">
                    <div class="message-bubble">
                        ${text}
                    </div>
                    <span class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
            `;
        }

        messagesContainer.appendChild(messageEl);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Store message
        if (!typing) {
            this.messages.push({ sender, text, timestamp: Date.now() });
        }

        return messageEl;
    },

    async sendMessage() {
        const input = document.getElementById('chat-input');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        // Add user message
        this.addMessage('user', text);
        input.value = '';

        // Show typing indicator
        const typingMsg = this.addMessage('coach', '', true);

        try {
            // Call backend AI chat API
            const apiBaseUrl = (window.CONFIG && window.CONFIG.API_BASE_URL) || 'https://ultimate-sports-ai-backend-production.up.railway.app';
            
            console.log('📡 Sending AI chat request to:', `${apiBaseUrl}/api/ai-chat/message`);
            
            // Get auth token if available
            const token = localStorage.getItem('auth_token');
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`${apiBaseUrl}/api/ai-chat/message`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    coachId: this.currentCoach.id,
                    coachName: this.currentCoach.name,
                    message: text,
                    context: {
                        sport: this.currentCoach.specialty,
                        previousMessages: this.messages.slice(-5) // Last 5 messages
                    }
                })
            });

            console.log('✅ Response status:', response.status, response.statusText);
            
            const data = await response.json();
            
            typingMsg.remove();
            
            if (data.success && data.response) {
                this.addMessage('coach', data.response);
            } else {
                // Fallback to local response
                const fallbackResponse = data.fallback || this.getAIResponse(text);
                this.addMessage('coach', fallbackResponse);
            }
        } catch (error) {
            console.error('❌ AI Chat error:', error.message || error);
            console.error('Error details:', error);
            typingMsg.remove();
            // Fallback to local response on error
            const response = this.getAIResponse(text);
            this.addMessage('coach', response);
        }
    },

    sendQuickMessage(text) {
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = text;
            this.sendMessage();
        }
    },

    getAIResponse(userMessage) {
        const coach = this.currentCoach;
        const msg = userMessage.toLowerCase();

        // Context-aware responses based on coach personality
        if (msg.includes('pick') || msg.includes('bet') || msg.includes('today')) {
            const picks = [
                `Based on my analysis, I'm loving the ${coach.sport === 'NBA Basketball' ? 'Lakers -3.5' : coach.sport === 'NFL Football' ? '49ers ML' : coach.sport === 'MLB Baseball' ? 'Yankees Under 8.5' : coach.sport === 'NHL Hockey' ? 'Bruins -1.5' : 'Man City -1'} tonight. ${coach.specialty} shows strong value here.`,
                `I've got 3 picks lined up. Check the "View Picks" section for full analysis with confidence ratings.`,
                `My model is showing ${coach.accuracy}% confidence on the early games. I'll have the full breakdown ready in 20 minutes.`
            ];
            return picks[Math.floor(Math.random() * picks.length)];
        }

        if (msg.includes('strategy') || msg.includes('approach') || msg.includes('method')) {
            return `My approach? ${coach.personality} I focus on ${coach.specialty}. Key areas: ${coach.strengths.join(', ')}. ${coach.catchphrase}`;
        }

        if (msg.includes('win rate') || msg.includes('performance') || msg.includes('stats')) {
            return `Currently sitting at ${coach.accuracy}% accuracy over ${coach.totalPicks} picks. On a ${coach.streak}-game hot streak with ${coach.monthlyROI} monthly ROI. ${coach.background}`;
        }

        if (msg.includes('how') || msg.includes('why') || msg.includes('explain')) {
            return `Let me break it down: ${coach.specialty}. I analyze ${coach.strengths[0]}, ${coach.strengths[1]}, and ${coach.strengths[2]}. It's all about finding edges the market misses.`;
        }

        if (msg.includes('parlay') || msg.includes('multi')) {
            return `For parlays, I recommend 2-3 leg max. Stack my highest confidence picks from today. I'll flag which ones pair well together.`;
        }

        if (msg.includes('bankroll') || msg.includes('unit') || msg.includes('stake')) {
            return `Smart money management is key. I recommend 1-3 unit sizing based on confidence. Never chase losses. ${coach.catchphrase}`;
        }

        if (msg.includes('live') || msg.includes('in-game') || msg.includes('in game')) {
            return `Live betting is my specialty! ${coach.strengths.includes('Live Betting') ? 'I track line movement and momentum shifts in real-time.' : 'Watch for value when the public overreacts to early plays.'}`;
        }

        if (msg.includes('thank') || msg.includes('appreciate')) {
            return `You got it! That's what I'm here for. Let's get these wins together! 💪`;
        }

        if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
            return `Hey! Ready to talk ${coach.sport}? What can I help you with today?`;
        }

        // Default responses based on coach personality
        const defaults = [
            `Great question! ${coach.catchphrase} Let me analyze that for you...`,
            `${coach.personality} Based on my research, here's my take...`,
            `I love discussing ${coach.sport}! Check out my latest analysis in the picks section.`,
            `That's exactly the kind of thinking that wins long-term. Let me elaborate...`,
            `${coach.background} - So I can tell you from experience...`
        ];

        return defaults[Math.floor(Math.random() * defaults.length)];
    }
};

// Expose to global window
window.aiCoachChat = aiCoachChat;

console.log('✅ AI Coach Chat Module loaded');
