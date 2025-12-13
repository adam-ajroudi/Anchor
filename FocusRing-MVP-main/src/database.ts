export const database = {
    connectDB: async () => {
        console.log('[Supabase Placeholder] Connecting to database...');
        return true;
    },

    // Full click (for ring button) - counts as 1
    logClick: async (timestamp: string) => {
        console.log(`[Supabase Placeholder] Logging full click at: ${timestamp}`);
        const clicks = global.mockClickCount || 0;
        global.mockClickCount = clicks + 1;
        return global.mockClickCount;
    },

    // Half click (for keyboard shortcut) - counts as 0.5
    // Because user presses once to show overlay, once to hide = 1 complete focus break
    logHalfClick: async (timestamp: string) => {
        console.log(`[Supabase Placeholder] Logging half click at: ${timestamp}`);
        const clicks = global.mockClickCount || 0;
        global.mockClickCount = clicks + 0.5;
        return global.mockClickCount;
    },

    getDailyStats: async () => {
        console.log('[Supabase Placeholder] Fetching daily stats...');
        const todayCount = global.mockClickCount || 0;
        return {
            today: todayCount,
            history: [5, 22, 10, 8, 15, 12, 18]
        };
    }
};

// Add type definition for the global mock variable
declare global {
    var mockClickCount: number;
}
