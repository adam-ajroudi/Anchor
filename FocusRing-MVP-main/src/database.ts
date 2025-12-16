import { supabase, getCurrentUserId } from './supabase';

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// Get date N days ago in YYYY-MM-DD format
function getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

// Local pending logs buffer (batch mode)
interface PendingLog {
    timestamp: string;
    value: number;
    source: string;
}
let pendingLogs: PendingLog[] = [];
let localClickCount = 0;

export const database = {
    /**
     * Log a full click (ring button) - value 1.0
     * In batch mode, stores locally and syncs later
     */
    logClick: async (timestamp: string): Promise<number> => {
        // Always increment local count immediately for responsive UI
        localClickCount++;

        // Store in pending logs buffer (will sync on session end)
        pendingLogs.push({
            timestamp,
            value: 1.0,
            source: 'ring'
        });

        console.log(`[Database] Logged click locally. Pending: ${pendingLogs.length}, Total: ${localClickCount}`);
        return localClickCount;
    },

    /**
     * Get session click count (local, fast)
     */
    getSessionCount: (): number => {
        return localClickCount;
    },

    /**
     * Sync all pending logs to Supabase (call on session end)
     */
    syncPendingLogs: async (): Promise<{ synced: number; errors: number }> => {
        const userId = getCurrentUserId();

        if (!userId) {
            console.log('[Database] No user logged in, cannot sync');
            return { synced: 0, errors: pendingLogs.length };
        }

        if (pendingLogs.length === 0) {
            console.log('[Database] No pending logs to sync');
            return { synced: 0, errors: 0 };
        }

        console.log(`[Database] Syncing ${pendingLogs.length} pending logs to Supabase...`);

        let synced = 0;
        let errors = 0;

        // Batch insert all pending logs
        const logsToInsert = pendingLogs.map(log => ({
            user_id: userId,
            timestamp: log.timestamp,
            value: log.value,
            source: log.source
        }));

        try {
            const { error } = await supabase
                .from('logs')
                .insert(logsToInsert);

            if (error) {
                console.error('[Supabase] Batch insert error:', error.message);
                errors = pendingLogs.length;
            } else {
                synced = pendingLogs.length;
                console.log(`[Supabase] Successfully synced ${synced} logs`);
                pendingLogs = []; // Clear pending logs on success
            }
        } catch (err) {
            console.error('[Supabase] Sync error:', err);
            errors = pendingLogs.length;
        }

        return { synced, errors };
    },

    /**
     * Get pending log count (for UI display)
     */
    getPendingCount: (): number => {
        return pendingLogs.length;
    },

    /**
     * Reset local session data (for new sessions)
     */
    resetSession: () => {
        localClickCount = 0;
        pendingLogs = [];
        console.log('[Database] Session data reset');
    },

    /**
     * Get today's total click count (from Supabase)
     */
    getTodayCount: async (): Promise<number> => {
        const userId = getCurrentUserId();

        if (!userId) {
            return localClickCount;
        }

        try {
            const today = getTodayDate();
            const { data, error } = await supabase
                .from('logs')
                .select('value')
                .eq('user_id', userId)
                .gte('timestamp', `${today}T00:00:00`)
                .lt('timestamp', `${today}T23:59:59`);

            if (error) {
                console.error('[Supabase] Error getting today count:', error.message);
                return localClickCount;
            }

            const dbTotal = data?.reduce((sum, log) => sum + (log.value || 0), 0) || 0;
            // Return max of DB count + pending local count for accurate display
            return dbTotal + pendingLogs.length;
        } catch (err) {
            console.error('[Supabase] Error:', err);
            return localClickCount;
        }
    },

    /**
     * Get daily stats for dashboard (today + last 7 days of history)
     */
    getDailyStats: async (): Promise<{ today: number; history: number[] }> => {
        const userId = getCurrentUserId();

        if (!userId) {
            console.log('[Database] No user logged in, returning local data');
            return {
                today: localClickCount,
                history: [0, 0, 0, 0, 0, 0, 0]
            };
        }

        try {
            // Get today's count (includes pending)
            const todayCount = await database.getTodayCount();

            // Get last 7 days history
            const history: number[] = [];

            for (let i = 7; i >= 1; i--) {
                const date = getDateDaysAgo(i);
                const { data, error } = await supabase
                    .from('logs')
                    .select('value')
                    .eq('user_id', userId)
                    .gte('timestamp', `${date}T00:00:00`)
                    .lt('timestamp', `${date}T23:59:59`);

                if (error) {
                    console.error(`[Supabase] Error getting history for ${date}:`, error.message);
                    history.push(0);
                } else {
                    const dayTotal = data?.reduce((sum, log) => sum + (log.value || 0), 0) || 0;
                    history.push(dayTotal);
                }
            }

            console.log('[Supabase] Dashboard stats - Today:', todayCount, 'History:', history);

            return {
                today: todayCount,
                history: history
            };
        } catch (err) {
            console.error('[Supabase] Error fetching daily stats:', err);
            return {
                today: localClickCount,
                history: [0, 0, 0, 0, 0, 0, 0]
            };
        }
    }
};

// Add type definition for the global mock variable (fallback)
declare global {
    var mockClickCount: number;
}
