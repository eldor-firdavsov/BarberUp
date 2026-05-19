const axios = require('axios');
const fs = require('fs');

const run = async () => {
    let log = '';
    const print = (m) => { log += m + '\n'; console.log(m); };

    try {
        const eC = 'c' + Date.now() + '@t.com';
        const phC = '+998' + Date.now().toString().slice(-9);
        await axios.post('https://barber-shop-xh34.onrender.com/api/v1/client', { fullname: 'C', email: eC, password: 'p', phone: phC });
        const resC = await axios.post('https://barber-shop-xh34.onrender.com/api/v1/client/login', { email: eC, password: 'p' });
        const tC = resC.data.token || resC.data.data.token;
        const iC = resC.data.data.client?._id || resC.data.data.user?._id || resC.data.data._id;

        const eB = 'b' + Date.now() + '@t.com';
        const phB = '+998' + (Date.now() - 1000).toString().slice(-9);
        await axios.post('https://barber-shop-xh34.onrender.com/api/v1/barber', { fullname: 'B', email: eB, password: 'p', phone: phB, office_name: 'S', working_hours: '09:00 - 18:00', average_price: '50' });
        const resB = await axios.post('https://barber-shop-xh34.onrender.com/api/v1/barber/login', { email: eB, password: 'p' });
        const tB = resB.data.token || resB.data.data.token;
        const iB = resB.data.data.barber?._id || resB.data.data.user?._id || resB.data.data._id;

        const rBo = await axios.post('https://barber-shop-xh34.onrender.com/api/v1/booking', { barber: iB, client: iC, booking_hours: '10:00' }, { headers: { Authorization: 'Bearer ' + tC } });
        const iBo = rBo.data.data._id || rBo.data.data.id;
        print('Booking:' + iBo);

        const statuses = ['approved', 'confirm', 'active', 'accepted', 'decline', 'deny', 'rejected', 'completed', 'cancelled', 'canceled'];
        for (const s of statuses) {
            try {
                await axios.patch('https://barber-shop-xh34.onrender.com/api/v1/booking/' + iBo, { status: s }, { headers: { Authorization: 'Bearer ' + tB } });
                print('STATUS [' + s + ']: SUCCESS');
            } catch (e) {
                print('STATUS [' + s + ']: FAILED -> ' + (e.response?.data?.message || JSON.stringify(e.response?.data)));
            }
        }
    } catch (e) {
        print('Error: ' + JSON.stringify(e.response?.data || e.message));
    }
    fs.writeFileSync('clean_logs.txt', log, 'utf8');
};
run();
