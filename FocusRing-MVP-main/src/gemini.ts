import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables (from dist/ folder where compiled code runs)
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Gemini API Configuration (from environment variable)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
    console.error('[Gemini] WARNING: GEMINI_API_KEY not set in environment variables!');
}

// Initialize the old SDK for text generation (still works)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Use Gemini 2.5 Flash-Lite for text (cheapest, good quality)
const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

// Initialize the NEW SDK for image generation (required for gemini-2.5-flash-image)
const imageAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface GeneratedContent {
    quotes: string[];
    imagePrompts: string[];
}

/**
 * Generate motivational content based on user's task and reward.
 * Returns 3 quotes and 3 image prompts.
 */
export async function generateSessionContent(
    task: string,
    reward: string
): Promise<{ content: GeneratedContent | null; error: string | null }> {

    // Sanitize inputs for privacy (strip specific details)
    const sanitizedTask = sanitizeInput(task);
    const sanitizedReward = sanitizeInput(reward);

    const prompt = `You are a supportive, empathetic focus coach. A user is working on: "${sanitizedTask}" and looking forward to: "${sanitizedReward}".

Generate content to help them stay focused and motivated. Respond in JSON format exactly like this:
{
    "quotes": [
        "First motivational quote",
        "Second motivational quote", 
        "Third motivational quote"
    ],
    "imagePrompts": [
        "First image description",
        "Second image description",
        "Third image description"
    ]
}

Guidelines:
- Quotes should be brief (1-2 sentences), encouraging, and non-judgmental
- Avoid "toxic positivity" - acknowledge that focus is hard but celebrate the effort
- Image prompts should describe calming, inspiring visuals related to their reward
- Use empathetic language that feels like a supportive friend
- Focus on the journey, not just the destination`;

    try {
        console.log('[Gemini] Generating content for task:', sanitizedTask);
        console.log('[Gemini] Using model: gemini-2.5-flash-lite');

        const result = await textModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[Gemini] Failed to parse JSON from response:', text);
            return { content: null, error: 'Failed to parse AI response' };
        }

        const parsed = JSON.parse(jsonMatch[0]) as GeneratedContent;

        // Validate structure
        if (!parsed.quotes || !parsed.imagePrompts ||
            parsed.quotes.length < 3 || parsed.imagePrompts.length < 3) {
            console.error('[Gemini] Invalid response structure:', parsed);
            return { content: null, error: 'Invalid AI response structure' };
        }

        console.log('[Gemini] Generated content successfully');
        return { content: parsed, error: null };

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Gemini] Error generating content:', errorMessage);
        return { content: null, error: `AI generation failed: ${errorMessage}` };
    }
}

/**
 * Generate an image using Gemini image models.
 * Tries gemini-2.5-flash-image first, falls back to imagen-3.
 * Returns base64 image data or null on error.
 */
export async function generateImage(prompt: string): Promise<{ imageData: string | null; error: string | null }> {
    // Try gemini-2.5-flash-image first (may require billing)
    try {
        console.log('[Gemini Image] Generating image for prompt:', prompt.substring(0, 50));
        console.log('[Gemini Image] Trying model: gemini-2.5-flash-image');

        const response = await imageAI.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: {
                responseModalities: ['Image']
            }
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData) {
                    console.log('[Gemini Image] Generated image successfully with gemini-2.5-flash-image');
                    return {
                        imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                        error: null
                    };
                }
            }
        }
        console.log('[Gemini Image] No image in response, trying fallback...');
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.log('[Gemini Image] gemini-2.5-flash-image failed:', errorMessage.substring(0, 100));

        // Check if it's a quota error - don't retry with same model
        if (errorMessage.includes('429') || errorMessage.includes('quota')) {
            console.log('[Gemini Image] Quota exceeded - image generation not available on free tier');
        }
    }

    // Image generation not available, return error
    return {
        imageData: null,
        error: 'Image generation requires billing to be enabled. Using local images instead.'
    };
}

/**
 * Sanitize user input to protect privacy while keeping context.
 * Strips specific names, URLs, and sensitive details.
 */
function sanitizeInput(input: string): string {
    // Remove URLs
    let sanitized = input.replace(/https?:\/\/[^\s]+/g, '[link]');

    // Remove email addresses
    sanitized = sanitized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');

    // Remove phone numbers
    sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]');

    // Limit length
    if (sanitized.length > 200) {
        sanitized = sanitized.substring(0, 200) + '...';
    }

    return sanitized;
}

/**
 * Get fallback content if AI generation fails.
 */
export function getFallbackContent(): GeneratedContent {
    return {
        quotes: [
            "Every moment of awareness is a victory. You noticed—that's the hardest part.",
            "Focus isn't about never drifting. It's about gently returning, again and again.",
            "You're building something powerful with each redirect. Keep going."
        ],
        imagePrompts: [
            "A calm ocean at sunset with gentle waves",
            "A cozy coffee shop with warm lighting",
            "A peaceful mountain path through autumn trees"
        ]
    };
}
