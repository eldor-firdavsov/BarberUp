import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://brvlvempavfiqyjbomjz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Htd1CQw0mzwW6eWFR8yBUg_RlphBIXG';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log("Testing Supabase connection...");
    
    // Test 1: Fetch barbers
    console.log("Test 1: Fetching barbers...");
    const { data: barbers, error: barbersError } = await supabase.from('barbers').select('*');
    if (barbersError) {
        console.error("Failed to fetch barbers:", barbersError);
    } else {
        console.log(`Success: Found ${barbers.length} barbers.`);
    }

    // Test 2: Fetch clients
    console.log("Test 2: Fetching clients...");
    const { data: clients, error: clientsError } = await supabase.from('clients').select('*');
    if (clientsError) {
        console.error("Failed to fetch clients:", clientsError);
    } else {
        console.log(`Success: Found ${clients.length} clients.`);
    }

    // Test 3: Create a dummy client user
    console.log("Test 3: Creating a dummy client...");
    const email = `testclient_${Date.now()}@example.com`;
    const password = 'password123';
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });

    if (authError) {
        console.error("Auth Error:", authError);
    } else {
        console.log("Created Auth User ID:", authData.user?.id);
        
        // Insert into clients table
        if (authData.user) {
            const { data: insertData, error: insertError } = await supabase.from('clients').insert([{
                id: authData.user.id,
                fullname: 'Test Client',
                email: email,
                phone: '+998901234567'
            }]).select();

            if (insertError) {
                console.error("Failed to insert into clients table:", insertError);
            } else {
                console.log("Success: Inserted into clients table:", insertData);
            }
        }
    }
}

test();
