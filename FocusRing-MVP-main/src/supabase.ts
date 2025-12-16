import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Supabase Configuration (from environment variables)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Supabase] WARNING: Supabase credentials not set in environment variables!');
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current user state
let currentUser: User | null = null;

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        return { user: null, error: error.message };
    }

    currentUser = data.user;
    return { user: data.user, error: null };
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { user: null, error: error.message };
    }

    currentUser = data.user;
    return { user: data.user, error: null };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signOut();

    if (error) {
        return { error: error.message };
    }

    currentUser = null;
    return { error: null };
}

/**
 * Get the current session (if any)
 */
export async function getSession(): Promise<{ user: User | null; isAuthenticated: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
        currentUser = session.user;
        return { user: session.user, isAuthenticated: true };
    }

    return { user: null, isAuthenticated: false };
}

/**
 * Get the current user ID (for tagging logs)
 */
export function getCurrentUserId(): string | null {
    return currentUser?.id || null;
}

/**
 * Get the current user
 */
export function getCurrentUser(): User | null {
    return currentUser;
}

// ============= STORAGE FUNCTIONS =============

const STORAGE_BUCKET = 'session-images';

/**
 * Upload a base64 image to Supabase Storage
 * Returns the public URL of the uploaded image
 */
export async function uploadImage(
    base64Data: string,
    fileName: string
): Promise<{ url: string | null; error: string | null }> {
    const userId = getCurrentUserId();
    if (!userId) {
        return { url: null, error: 'No user logged in' };
    }

    try {
        // Extract the actual base64 data (remove data:image/png;base64, prefix)
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return { url: null, error: 'Invalid base64 image data' };
        }

        const contentType = matches[1];
        const base64 = matches[2];
        const buffer = Buffer.from(base64, 'base64');

        // Create unique file path: userId/timestamp_filename
        const filePath = `${userId}/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, buffer, {
                contentType,
                upsert: true
            });

        if (uploadError) {
            console.error('[Storage] Upload error:', uploadError.message);
            return { url: null, error: uploadError.message };
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        console.log('[Storage] Uploaded image:', filePath);
        return { url: urlData.publicUrl, error: null };

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Storage] Error:', errorMessage);
        return { url: null, error: errorMessage };
    }
}

/**
 * Get all images for the current user from storage
 */
export async function getUserImages(): Promise<{ urls: string[]; error: string | null }> {
    const userId = getCurrentUserId();
    if (!userId) {
        return { urls: [], error: 'No user logged in' };
    }

    try {
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .list(userId, {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' }
            });

        if (error) {
            console.error('[Storage] List error:', error.message);
            return { urls: [], error: error.message };
        }

        const urls = data.map(file => {
            const { data: urlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(`${userId}/${file.name}`);
            return urlData.publicUrl;
        });

        return { urls, error: null };

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return { urls: [], error: errorMessage };
    }
}
