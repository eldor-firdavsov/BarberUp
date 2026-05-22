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

export async function createClient(payload) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: payload.email,
            password: payload.password,
        });

        if (authError) return { data: null, error: authError.message };
        if (!authData.user) return { data: null, error: 'Failed to create user.' };

        const clientPayload = {
            fullname: payload.fullname || payload.name || '',
            email: payload.email || '',
            phone: payload.phone || '',
            profile_img: payload.profile_img || ''
        };

        const { data: clientData, error: insertError } = await supabase
            .from('clients')
            .insert([{ id: authData.user.id, ...clientPayload }])
            .select()
            .single();

        if (insertError) {
            console.error('[CREATE CLIENT] insert error', insertError);
            return { data: null, error: 'Failed to save client profile.' };
        }

        const client = normalizeClient(clientData);
        return { data: client, error: null };
    } catch (error) {
        return { data: null, error: 'Failed to create client account.' };
    }
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

export async function loginClient(email, password) {
    console.log('[LOGIN CLIENT] request start ->', { email });
    try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) return { data: null, error: authError.message };

        const { data: clientData, error: profileError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !clientData) {
            return { data: null, error: 'Client profile not found.' };
        }

        const user = normalizeClient(clientData);
        return { data: { token: authData.session.access_token, user }, error: null };
    } catch (error) {
        return { data: null, error: 'Something went wrong.' };
    }
}
