import fs from 'fs';

let output = '';
const log = (...args) => {
    output += args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n';
    console.log(...args);
};

const rawData = JSON.parse(fs.readFileSync('api_out_all.json', 'utf8'));

function formatTo24h(timeStr) {
    if (!timeStr || timeStr === 'undefined') return '';
    const parts = String(timeStr).match(/(\d+):(\d+)/);
    if (!parts) return timeStr;
    let [_, h, m] = parts;
    if (String(timeStr).toLowerCase().includes('pm') && Number(h) < 12) h = Number(h) + 12;
    return `${h.toString().padStart(2, '0')}:${m}`;
}

function normalizeBarber(raw) {
    if (!raw) return null;
    const workingHoursRaw = raw.working_hours ?? raw.workingHours ?? '';
    const parts = String(workingHoursRaw).split('-');
    const startRaw = parts[0]?.trim();
    const endRaw = parts[1]?.trim();
    const start = formatTo24h(startRaw);
    const end = formatTo24h(endRaw);
    return {
        ...raw,
        id: raw._id ?? raw.id ?? null,
        role: 'barber',
        name: raw.fullname || raw.name || 'Unknown',
        shopName: raw.office_name || raw.shopName || 'Unnamed Shop',
        workingHours: start && end ? `${start} - ${end}` : 'N/A',
        avgPrice: raw.average_price ?? raw.avgPrice ?? 0,
        profile_img: raw.profile_img ?? raw.profileImage ?? '',
        office_img: raw.office_img ?? raw.shopImage ?? '',
        email: raw.email ?? '',
        phone: raw.phone ?? '',
    };
}

const barbers = rawData.map(normalizeBarber);
const b = barbers[1] || barbers[0];

log('=== BARBER IMAGE AUDIT ===');
log('profile_img:', JSON.stringify(b.profile_img));
log('profileImage:', JSON.stringify(b.profileImage));
log('office_img:', JSON.stringify(b.office_img));
log('shopImage:', JSON.stringify(b.shopImage));
log('=== BARBER LOCATION AUDIT ===');
log('coordinates:', JSON.stringify(b.coordinates));
log('location:', JSON.stringify(b.location));
log('address:', JSON.stringify(b.address));
log('=== FULL BARBER OBJECT ===');
log(JSON.stringify(b, null, 2));

log('=== CLIENT COORDS SET === 41.2995 69.2401');

log('=== DISTANCE CALC ===');
log('clientCoords: { lat: 41.2995, lng: 69.2401 }');
log('barber.coordinates:', b.coordinates);
log('barber.location:', b.location);

fs.writeFileSync('logs_out.txt', output);
