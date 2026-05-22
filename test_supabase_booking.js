import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://brvlvempavfiqyjbomjz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Htd1CQw0mzwW6eWFR8yBUg_RlphBIXG';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testBooking() {
    console.log("Testing Barber and Booking creation...");
    
    // 1. Create a Barber
    console.log("Creating Barber...");
    const barberEmail = `testbarber_${Date.now()}@example.com`;
    const { data: barberAuth, error: barberAuthError } = await supabase.auth.signUp({
        email: barberEmail,
        password: 'password123'
    });
    
    if (barberAuthError) {
        console.error("Barber Auth Error:", barberAuthError);
        return;
    }
    
    const barberId = barberAuth.user.id;
    const { data: barberInsert, error: barberInsertError } = await supabase.from('barbers').insert([{
        id: barberId,
        fullname: 'Test Barber',
        email: barberEmail,
        office_name: 'Test Barbershop'
    }]).select();
    
    if (barberInsertError) {
        console.error("Barber Insert Error:", barberInsertError);
        return;
    }
    console.log("Barber created:", barberInsert[0].id);
    
    // 2. We need a client to book. We already have one from the previous test.
    // Let's create a new client just to be sure we are authenticated as the client.
    console.log("Creating Client...");
    const clientEmail = `testclient_book_${Date.now()}@example.com`;
    const { data: clientAuth, error: clientAuthError } = await supabase.auth.signUp({
        email: clientEmail,
        password: 'password123'
    });
    
    if (clientAuthError) {
        console.error("Client Auth Error:", clientAuthError);
        return;
    }
    
    const clientId = clientAuth.user.id;
    const { data: clientInsert, error: clientInsertError } = await supabase.from('clients').insert([{
        id: clientId,
        fullname: 'Test Booking Client',
        email: clientEmail
    }]).select();
    
    if (clientInsertError) {
        console.error("Client Insert Error:", clientInsertError);
        return;
    }
    console.log("Client created:", clientInsert[0].id);

    // 3. Authenticate as the client and create a booking
    console.log("Signing in as client to test RLS...");
    await supabase.auth.signInWithPassword({
        email: clientEmail,
        password: 'password123'
    });

    console.log("Creating booking...");
    const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([{
        barber_id: barberId,
        client_id: clientId,
        booking_hours: '14:30',
        status: 'pending'
    }]).select('*, barbers(*), clients(*)');

    if (bookingError) {
        console.error("Booking Error:", bookingError);
    } else {
        console.log("Success: Booking created!");
        console.log("Joined Barber Data:", bookingData[0].barbers?.fullname);
        console.log("Joined Client Data:", bookingData[0].clients?.fullname);
    }
}

testBooking();
