import { supabase } from './supabase.js';

export function normalizeClient(raw) {
    if (!raw) return null;
    return {
        ...raw,
        id: raw.id ?? null,
        role: 'client',
        name: raw.fullname || raw.name || 'Unknown',
        fullname: raw.fullname || raw.name || 'Unknown',
        email: raw.email ?? '',
        phone: raw.phone ?? '',
    };
}

/**
 * Phone-only client identity: upsert a client row by phone number.
 * No Supabase Auth required — clients are identified purely by phone.
 */
export async function getOrCreateClient(fullname, phone) {
    try {
        // First: try to find existing client by phone
        const { data: existing, error: fetchError } = await supabase
            .from('clients')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();

        if (fetchError) {
            console.error('[GET OR CREATE CLIENT] fetch error', fetchError);
            return { data: null, error: fetchError.message };
        }

        if (existing) {
            // Return existing client (optionally update name if changed)
            if (existing.fullname !== fullname.trim()) {
                const { data: updated } = await supabase
                    .from('clients')
                    .update({ fullname: fullname.trim() })
                    .eq('phone', phone)
                    .select()
                    .single();
                return { data: normalizeClient(updated ?? existing), error: null };
            }
            return { data: normalizeClient(existing), error: null };
        }

        // New client: insert with generated UUID, no auth row needed
        const syntheticEmail = `${phone.replace(/\D/g, '')}@navbatgo.uz`;
        const { data: inserted, error: insertError } = await supabase
            .from('clients')
            .insert([{
                fullname: fullname.trim(),
                phone,
                email: syntheticEmail,
            }])
            .select()
            .single();

        if (insertError) {
            console.error('[GET OR CREATE CLIENT] insert error', insertError);
            return { data: null, error: insertError.message };
        }

        return { data: normalizeClient(inserted), error: null };
    } catch (err) {
        console.error('[GET OR CREATE CLIENT] unexpected error', err);
        return { data: null, error: 'Failed to identify client.' };
    }
}

export async function createClient(payload) {
    if (payload.phone) {
        return getOrCreateClient(payload.fullname || payload.name || '', payload.phone);
    }
    return { data: null, error: 'Phone number is required.' };
}

export async function getClients() {
    try {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) return { data: null, error: error.message };
        return { data: (data || []).map(normalizeClient), error: null };
    } catch (error) {
        return { data: null, error: 'Failed to load clients.' };
    }
}

export async function loginClient(phone) {
    try {
        const { data: clientData, error: profileError } = await supabase
            .from('clients')
            .select('*')
            .eq('phone', phone)
            .single();

        if (profileError || !clientData) {
            return { data: null, error: 'Client not found.' };
        }

        const user = normalizeClient(clientData);
        return { data: { user }, error: null };
    } catch (error) {
        return { data: null, error: 'Something went wrong.' };
    }
}
