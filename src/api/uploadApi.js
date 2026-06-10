import { supabase } from './supabase.js';

// ─── Image compression ────────────────────────────────────────────────────────

/**
 * Compress an image file to WebP format at a max dimension of `maxSide`px.
 * Returns a Blob (WebP) suitable for uploading.
 *
 * @param {File} file
 * @param {number} maxSide - Max width or height in pixels (default 800)
 * @param {number} quality - WebP quality 0–1 (default 0.82)
 * @returns {Promise<Blob>}
 */
async function compressImage(file, maxSide = 800, quality = 0.82) {
    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            const scale  = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(objectUrl);
                    // Fallback: if canvas.toBlob fails, use original file
                    resolve(blob ?? file);
                },
                'image/webp',
                quality,
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file); // fallback to original
        };

        img.src = objectUrl;
    });
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Compress and upload an image to Supabase Storage `Images` bucket.
 *
 * @param {File} file - The image file to upload.
 * @param {string} pathFolder - Folder inside the bucket (e.g., 'profiles', 'photos').
 * @returns {Promise<{ url: string|null, error: string|null }>}
 */
export async function uploadImage(file, pathFolder) {
    if (!file) return { url: null, error: 'No file provided' };

    try {
        // Compress before upload — stays under ~200KB for typical photos
        const compressed = await compressImage(file);

        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;
        const filePath = `${pathFolder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('Images')
            .upload(filePath, compressed, {
                cacheControl: '3600',
                upsert:       false,
                contentType:  'image/webp',
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
