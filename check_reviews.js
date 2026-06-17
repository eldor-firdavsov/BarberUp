import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables from .env
const envFile = fs.readFileSync('.env', 'utf8');
const envUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const envKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(envUrl, envKey);

async function checkReviewsTable() {
    const { data, error } = await supabase.from('reviews').select('*').limit(1);
    if (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
    console.log("Table exists! Data:", data);
}

checkReviewsTable();
