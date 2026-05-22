import { supabase } from './supabase.js';

/**
 * Uploads an image file to the Supabase 'images' bucket.
 * @param {File} file - The file to upload.
 * @param {string} pathFolder - The folder inside the bucket (e.g., 'profiles', 'offices').
 * @returns {Promise<{ url: string|null, error: string|null }>}
 */
export async function uploadImage(file, pathFolder) {
    if (!file) return { url: null, error: 'No file provided' };

    try {
        // Generate a unique filename using timestamp and a random string
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${pathFolder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('Images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('[UPLOAD ERROR]', uploadError);
            return { url: null, error: uploadError.message };
        }

        const { data } = supabase.storage
            .from('Images')
            .getPublicUrl(filePath);

        return { url: data.publicUrl, error: null };
    } catch (err) {
        console.error('[UPLOAD EXCEPTION]', err);
        return { url: null, error: 'Failed to upload image' };
    }
}
