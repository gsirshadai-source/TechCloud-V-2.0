// Session Manager for TechCloud - Enhanced session persistence and timeout handling
class SessionManager {
    constructor() {
        this.sessionWarningShown = false;
        this.sessionTimeoutWarning = null;
        this.heartbeatInterval = null;
        this.init();
    }

    init() {
        // Start session heartbeat
        this.startHeartbeat();
        
        // Listen for user activity to extend session
        this.setupActivityListeners();
        
        // Handle page visibility changes
        this.setupVisibilityHandlers();
    }

    // Start heartbeat to keep session alive
    startHeartbeat() {
        // Send heartbeat every 10 minutes
        this.heartbeatInterval = setInterval(async () => {
            await this.sendHeartbeat();
        }, 10 * 60 * 1000);
    }

    // Send heartbeat to refresh session
    async sendHeartbeat() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error || !session) {
                console.log('No active session for heartbeat');
                return;
            }

            const expiresAt = session.expires_at * 1000;
            const now = Date.now();
            const timeUntilExpiry = expiresAt - now;
            
            console.log(`Heartbeat: Session expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
            
            // If session expires in less than 20 minutes, refresh it
            if (timeUntilExpiry < (20 * 60 * 1000)) {
                console.log('Refreshing session via heartbeat...');
                await supabaseClient.auth.refreshSession();
                this.sessionWarningShown = false; // Reset warning flag
            }
            
            // Show warning if session expires in less than 5 minutes
            if (timeUntilExpiry < (5 * 60 * 1000) && !this.sessionWarningShown) {
                this.showSessionWarning(Math.round(timeUntilExpiry / 1000 / 60));
            }
            
        } catch (error) {
            console.error('Heartbeat error:', error);
        }
    }

    // Setup activity listeners to detect user interaction
    setupActivityListeners() {
        const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        let lastActivity = Date.now();
        
        const activityHandler = () => {
            const now = Date.now();
            // Only process if more than 1 minute has passed since last activity
            if (now - lastActivity > 60000) {
                lastActivity = now;
                this.onUserActivity();
            }
        };

        activities.forEach(activity => {
            document.addEventListener(activity, activityHandler, true);
        });
    }

    // Handle user activity
    async onUserActivity() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (session && !error) {
                const expiresAt = session.expires_at * 1000;
                const now = Date.now();
                const timeUntilExpiry = expiresAt - now;
                
                // If session expires in less than 30 minutes, refresh it
                if (timeUntilExpiry < (30 * 60 * 1000)) {
                    console.log('User activity detected, refreshing session...');
                    await supabaseClient.auth.refreshSession();
                    this.sessionWarningShown = false;
                    this.hideSessionWarning();
                }
            }
        } catch (error) {
            console.error('Activity session check error:', error);
        }
    }

    // Setup visibility change handlers
    setupVisibilityHandlers() {
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                console.log('Tab became visible, checking session...');
                await this.onUserActivity();
            }
        });

        // Handle page focus
        window.addEventListener('focus', async () => {
            console.log('Window focused, checking session...');
            await this.onUserActivity();
        });
    }

    // Show session timeout warning
    showSessionWarning(minutesLeft) {
        this.sessionWarningShown = true;
        
        // Remove existing warning
        this.hideSessionWarning();
        
        const warningDiv = document.createElement('div');
        warningDiv.id = 'session-timeout-warning';
        warningDiv.className = 'alert alert-warning';
        warningDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10000;
            margin: 0;
            border-radius: 0;
            text-align: center;
            padding: 15px;
            background-color: #fcf8e3;
            border-color: #faebcc;
            color: #8a6d3b;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        `;
        
        warningDiv.innerHTML = `
            <strong>Session Expiring!</strong> 
            Your session will expire in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}. 
            <button onclick="sessionManager.extendSession()" class="btn btn-sm btn-warning" style="margin-left: 10px;">
                Extend Session
            </button>
            <button onclick="sessionManager.hideSessionWarning()" class="btn btn-sm btn-default" style="margin-left: 5px;">
                Dismiss
            </button>
        `;
        
        document.body.insertBefore(warningDiv, document.body.firstChild);
        
        // Auto-hide after 30 seconds if not interacted with
        setTimeout(() => {
            this.hideSessionWarning();
        }, 30000);
    }

    // Hide session warning
    hideSessionWarning() {
        const warning = document.getElementById('session-timeout-warning');
        if (warning) {
            warning.remove();
        }
    }

    // Extend session manually
    async extendSession() {
        try {
            console.log('Manually extending session...');
            const { data: { session }, error } = await supabaseClient.auth.refreshSession();
            
            if (error) {
                throw error;
            }
            
            if (session) {
                this.sessionWarningShown = false;
                this.hideSessionWarning();
                
                // Show success message
                if (window.authManager) {
                    authManager.showMessage('Session extended successfully!', 'success');
                }
                
                console.log('Session extended successfully');
            }
        } catch (error) {
            console.error('Failed to extend session:', error);
            if (window.authManager) {
                authManager.showMessage('Failed to extend session. Please log in again.', 'error');
            }
        }
    }

    // Stop all session management
    destroy() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.hideSessionWarning();
    }

    // Get session info
    async getSessionInfo() {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error || !session) {
                return null;
            }
            
            const expiresAt = session.expires_at * 1000;
            const now = Date.now();
            const timeUntilExpiry = expiresAt - now;
            
            return {
                session,
                expiresAt: new Date(expiresAt),
                timeUntilExpiry,
                minutesUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60),
                isExpiringSoon: timeUntilExpiry < (15 * 60 * 1000)
            };
        } catch (error) {
            console.error('Error getting session info:', error);
            return null;
        }
    }
}

// Initialize session manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager = new SessionManager();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.sessionManager) {
        window.sessionManager.destroy();
    }
});
