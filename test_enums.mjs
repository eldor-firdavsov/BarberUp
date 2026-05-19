import axios from 'axios';
import fs from 'fs';

const API_BASE_URL = 'https://barber-shop-xh34.onrender.com/api/v1';
let output = '';
const log = (msg) => { output += msg + '\n'; console.log(msg); };

async function run() {
    try {
        const emailC = `client_${Date.now()}_${Math.random()}@test.com`;
        await axios.post(`${API_BASE_URL}/client`, {
            fullname: "TestClient", email: emailC, password: "password123", phone: "+12" + Math.floor(Math.random() * 10000000)
        });
        const resC = await axios.post(`${API_BASE_URL}/client/login`, { email: emailC, password: "password123" });
        const dataC = resC.data.data || resC.data;
        const clientToken = resC.data.token || dataC.token;
        const clientId = dataC.client?._id || dataC.user?._id || dataC._id;

        const emailB = `barber_${Date.now()}_${Math.random()}@test.com`;
        await axios.post(`${API_BASE_URL}/barber`, {
            fullname: "TestBarber", email: emailB, password: "password123", phone: "+12" + Math.floor(Math.random() * 10000000),
            office_name: "Shop", working_hours: "09:00 - 18:00", average_price: "50000"
        });
        const resB = await axios.post(`${API_BASE_URL}/barber/login`, { email: emailB, password: "password123" });
        const dataB = resB.data.data || resB.data;
        const barberToken = resB.data.token || dataB.token;
        const barberId = dataB.barber?._id || dataB.user?._id || dataB._id;

        const resBook = await axios.post(`${API_BASE_URL}/booking`, {
            barber: barberId,
            client: clientId,
            booking_hours: "10:00"
        }, { headers: { Authorization: `Bearer ${clientToken}` } });

        const bookingId = resBook.data.data?._id || resBook.data.data?.id || resBook.data?._id;
        log("Created booking: " + bookingId);

        const statuses = ['approved', 'confirm', 'active', 'accepted', 'decline', 'deny', 'rejected', 'completed', 'cancelled', 'canceled'];
        for (const status of statuses) {
            try {
                await axios.patch(`${API_BASE_URL}/booking/${bookingId}`, { status }, {
                    headers: { Authorization: `Bearer ${barberToken}` }
                });
                log(`STATUS [${status}]: SUCCESS`);
            } catch (e) {
                log(`STATUS [${status}]: FAILED -> ` + (e.response?.data?.message || JSON.stringify(e.response?.data)));
            }
        }
    } catch (e) {
        log("Setup failed: " + JSON.stringify(e.response?.data || e.message));
    }
    fs.writeFileSync('out_statuses.txt', output);
}
run();
