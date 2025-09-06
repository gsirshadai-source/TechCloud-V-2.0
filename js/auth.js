// Authentication Module for TechCloud
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentSession = null;
        this.refreshTimer = null;
        this.init();
    }

    async init() {
        try {
            // Initially show auth links while checking session
            this.showAuthLinks();
            
            // Get current session (this includes refresh if needed)
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error) {
                console.error('Session error:', error);
            }
            
            this.currentSession = session;
            this.currentUser = session?.user || null;
            this.updateUI();
            
            // Set up session refresh if we have a session
            if (session) {
                this.setupSessionRefresh(session);
            }
            
            // Listen for auth changes
            supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log('Auth state change:', event, session?.user?.email);
                
                this.currentSession = session;
                this.currentUser = session?.user || null;
                this.updateUI();
                
                // Clear existing refresh timer
                if (this.refreshTimer) {
                    clearTimeout(this.refreshTimer);
                    this.refreshTimer = null;
                }
                
                // Only handle redirects for actual authentication events, not initial session checks
                if (event === 'SIGNED_IN') {
                    this.handleSignIn();
                    if (session) {
                        this.setupSessionRefresh(session);
                    }
                } else if (event === 'SIGNED_OUT') {
                    this.handleSignOut();
                } else if (event === 'TOKEN_REFRESHED' && session) {
                    // Just setup refresh, don't redirect
                    this.setupSessionRefresh(session);
                }
            });
            
            // Set up periodic session refresh
            this.startPeriodicRefresh();
            
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    // Set up automatic session refresh based on token expiry
    setupSessionRefresh(session) {
        if (!session || !session.expires_at) return;
        
        const expiresAt = session.expires_at * 1000; // Convert to milliseconds
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Refresh 5 minutes before expiry (or immediately if already expired)
        const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 1000);
        
        console.log(`Session expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, refreshing in ${Math.round(refreshTime / 1000 / 60)} minutes`);
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        this.refreshTimer = setTimeout(async () => {
            await this.refreshSession();
        }, refreshTime);
    }

    // Manually refresh the session
    async refreshSession() {
        try {
            console.log('Refreshing session...');
            const { data: { session }, error } = await supabaseClient.auth.refreshSession();
            
            if (error) {
                console.error('Session refresh error:', error);
                // If refresh fails, sign out the user
                await this.signOut();
                return false;
            }
            
            if (session) {
                console.log('Session refreshed successfully');
                this.currentSession = session;
                this.currentUser = session.user;
                this.setupSessionRefresh(session);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Session refresh error:', error);
            return false;
        }
    }

    // Start periodic session refresh (every 30 minutes as backup)
    startPeriodicRefresh() {
        setInterval(async () => {
            if (this.currentSession && this.currentUser) {
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                
                if (error || !session) {
                    console.log('Session lost, signing out...');
                    await this.signOut();
                } else if (session.expires_at) {
                    const expiresAt = session.expires_at * 1000;
                    const now = Date.now();
                    const timeUntilExpiry = expiresAt - now;
                    
                    // If session expires in less than 10 minutes, refresh it
                    if (timeUntilExpiry < (10 * 60 * 1000)) {
                        await this.refreshSession();
                    }
                }
            }
        }, 30 * 60 * 1000); // Check every 30 minutes
    }

    // Sign up new user
    async signUp(email, password, fullName) {
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            if (data.user && !data.user.email_confirmed_at) {
                this.showMessage('Please check your email to confirm your account!', 'info');
                return { success: true, needsConfirmation: true };
            }

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Sign up error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    // Sign in existing user
    async signIn(email, password, rememberMe = false) {
        try {
            // Set session persistence based on "Remember Me"
            const sessionOptions = {
                email: email,
                password: password
            };

            // If remember me is checked, we'll rely on the default localStorage persistence
            // If not, we could implement session-only storage, but Supabase handles this automatically
            
            const { data, error } = await supabaseClient.auth.signInWithPassword(sessionOptions);

            if (error) throw error;

            // Store remember me preference
            if (rememberMe) {
                localStorage.setItem('techcloud-remember-me', 'true');
                localStorage.setItem('techcloud-user-email', email);
            } else {
                localStorage.removeItem('techcloud-remember-me');
                localStorage.removeItem('techcloud-user-email');
            }

            this.showMessage('Successfully signed in!', 'success');
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Sign in error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    // Sign out user
    async signOut() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            
            this.showMessage('Successfully signed out!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    // Reset password
    async resetPassword(email) {
        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/reset-password.html'
            });

            if (error) throw error;

            this.showMessage('Password reset email sent!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            this.showMessage(error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    // Show auth links initially (before session check)
    showAuthLinks() {
        const authLinks = document.querySelectorAll('.auth-links');
        const userInfo = document.querySelectorAll('.user-info');
        
        authLinks.forEach(link => link.style.display = 'list-item');
        userInfo.forEach(info => info.style.display = 'none');
    }

    // Update UI based on auth state
    updateUI() {
        const authLinks = document.querySelectorAll('.auth-links');
        const userInfo = document.querySelectorAll('.user-info');
        const protectedContent = document.querySelectorAll('.protected-content');

        if (this.currentUser) {
            // User is logged in - hide auth links, show user info
            authLinks.forEach(link => {
                link.style.setProperty('display', 'none', 'important');
            });
            userInfo.forEach(info => {
                info.style.setProperty('display', 'list-item', 'important');
                const userNameEl = info.querySelector('.user-name');
                if (userNameEl) {
                    userNameEl.textContent = this.currentUser.user_metadata?.full_name || this.currentUser.email;
                }
            });
            protectedContent.forEach(content => content.style.display = 'block');
        } else {
            // User is not logged in - show auth links, hide user info
            authLinks.forEach(link => {
                link.style.setProperty('display', 'list-item', 'important');
            });
            userInfo.forEach(info => {
                info.style.setProperty('display', 'none', 'important');
            });
            protectedContent.forEach(content => content.style.display = 'none');
        }
    }

    // Handle successful sign in
    handleSignIn() {
        // Only redirect if user is actually authenticated AND on login/register page
        if (this.currentUser && (window.location.pathname.includes('login.html') || 
            window.location.pathname.includes('registration.html'))) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    }

    // Handle sign out
    handleSignOut() {
        // Redirect to home page if on protected page
        if (window.location.pathname.includes('profile.html') || 
            window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'index.html';
        }
    }

    // Show message to user
    showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.auth-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} auth-message`;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        messageDiv.innerHTML = `
            <button type="button" class="close" onclick="this.parentElement.remove()">
                <span>&times;</span>
            </button>
            ${message}
        `;

        document.body.appendChild(messageDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 5000);
    }

    // Check if user is authenticated (async to handle session restoration)
    async isAuthenticated() {
        // If we already have a current user, return true
        if (this.currentUser) {
            return true;
        }
        
        // Try to get session from Supabase (handles localStorage restoration)
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error) {
                console.error('Session check error:', error);
                return false;
            }
            
            if (session && session.user) {
                this.currentSession = session;
                this.currentUser = session.user;
                this.setupSessionRefresh(session);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Authentication check error:', error);
            return false;
        }
    }

    // Get current user (async to handle session restoration)
    async getCurrentUser() {
        // If we already have a current user, return it
        if (this.currentUser) {
            return this.currentUser;
        }
        
        // Try to restore session and get user
        const isAuth = await this.isAuthenticated();
        return isAuth ? this.currentUser : null;
    }

    // Require authentication for protected pages (now async)
    async requireAuth() {
        const isAuth = await this.isAuthenticated();
        
        if (!isAuth) {
            this.showMessage('Please log in to access this page', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }
        return true;
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Ensure auth links are visible immediately
    const authLinks = document.querySelectorAll('.auth-links');
    authLinks.forEach(link => {
        link.style.display = 'list-item';
        link.style.visibility = 'visible';
    });
    
    // Initialize auth manager
    window.authManager = new AuthManager();
    
    // Debug: Log navigation elements
    console.log('Auth links found:', authLinks.length);
    console.log('Navigation initialized');
});

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .auth-message {
        animation: slideIn 0.3s ease-out;
    }
    
    .user-info {
        display: none;
    }
    
    .protected-content {
        display: none;
    }
`;
document.head.appendChild(style);
