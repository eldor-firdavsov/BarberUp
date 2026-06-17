import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const envUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const envKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(envUrl, envKey);

async function insertTestReview() {
    // 1. Get first barber
    const { data: barbers } = await supabase.from('barbers').select('id').limit(1);
    if (!barbers || barbers.length === 0) {
        console.log("No barbers found");
        process.exit(1);
    }
    const barberId = barbers[0].id;
    console.log("Using barber:", barberId);

    // 2. Insert a review
    const { data: review, error } = await supabase.from('reviews').insert([{
        barber_id: barberId,
        rating: 5,
        comment: 'Juda zo\'r master, tavsiya qilaman! Gap yo\'q.',
        guest_phone: '+998901234567'
    }]).select();

    if (error) {
         console.error("Error inserting review:", error.message);
    } else {
         console.log("Inserted review:", review);
    }
}

insertTestReview();
