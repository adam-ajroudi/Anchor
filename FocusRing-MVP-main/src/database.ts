export const database = {
    connectDB: async () => {
        console.log('[Supabase Placeholder] Connecting to database...');
        return true;
    },
    
    logClick: async (timestamp: string) => {
        console.log(`[Supabase Placeholder] Logging click at: ${timestamp}`);
        // Simulate logging to a local store for the session
        const clicks = global.mockClickCount || 0;
        global.mockClickCount = clicks + 1;
    },

    getDailyStats: async () => {
        console.log('[Supabase Placeholder] Fetching daily stats...');
        // Return mock data for the dashboard
        return {
            today: global.mockClickCount || 12,
            history: [5, 8, 15, 10, 22, 12, 18] // Last 7 days mock data
        };
    }
};

// Add type definition for the global mock variable
declare global {
    var mockClickCount: number;
}
