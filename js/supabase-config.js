// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_CONFIG = {
    url: 'https://xbdvkvarpthptbepqbhb.supabase.co', // Replace with your Supabase project URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZHZrdmFycHRocHRiZXBxYmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODExMTksImV4cCI6MjA3Mjc1NzExOX0.5sQHHhjNtFsDW2PwlTl-8jqpvaiF1-6JoGjX4CgnP08' // Replace with your Supabase anon key
};

// Initialize Supabase client with enhanced session management
const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
        // Enable automatic token refresh
        autoRefreshToken: true,
        // Persist session in localStorage
        persistSession: true,
        // Detect session in URL (for email confirmations, password resets)
        detectSessionInUrl: true,
        // Storage key for session persistence
        storageKey: 'techcloud-auth-token',
        // Custom storage implementation (optional)
        storage: window.localStorage,
        // Flow type for better security
        flowType: 'pkce'
    },
    // Global configuration
    global: {
        headers: {
            'X-Client-Info': 'techcloud-website'
        }
    },
    // Realtime configuration (if needed)
    realtime: {
        params: {
            eventsPerSecond: 2
        }
    }
});

// Enhanced session monitoring
let sessionCheckInterval;

// Function to start session monitoring
function startSessionMonitoring() {
    // Clear any existing interval
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    // Check session every 5 minutes
    sessionCheckInterval = setInterval(async () => {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error) {
                console.error('Session check error:', error);
                return;
            }
            
            if (session) {
                const expiresAt = session.expires_at * 1000;
                const now = Date.now();
                const timeUntilExpiry = expiresAt - now;
                
                // Log session status
                console.log(`Session check: expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
                
                // If session expires in less than 15 minutes, try to refresh
                if (timeUntilExpiry < (15 * 60 * 1000)) {
                    console.log('Session expiring soon, attempting refresh...');
                    await supabaseClient.auth.refreshSession();
                }
            }
        } catch (error) {
            console.error('Session monitoring error:', error);
        }
    }, 5 * 60 * 1000); // Every 5 minutes
}

// Function to stop session monitoring
function stopSessionMonitoring() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
}

// Start monitoring when client is initialized
startSessionMonitoring();

// Listen for visibility changes to refresh session when tab becomes active
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session && !error) {
                const expiresAt = session.expires_at * 1000;
                const now = Date.now();
                const timeUntilExpiry = expiresAt - now;
                
                // If session expires in less than 30 minutes, refresh it
                if (timeUntilExpiry < (30 * 60 * 1000)) {
                    console.log('Tab became active, refreshing session...');
                    await supabaseClient.auth.refreshSession();
                }
            }
        } catch (error) {
            console.error('Visibility change session check error:', error);
        }
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    stopSessionMonitoring();
});

// Export for use in other files
window.supabaseClient = supabaseClient;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.startSessionMonitoring = startSessionMonitoring;
window.stopSessionMonitoring = stopSessionMonitoring;
