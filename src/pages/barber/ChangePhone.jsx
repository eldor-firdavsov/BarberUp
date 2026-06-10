// Re-use the shared ChangePhone component but configured for the barbers
// table. This file exists so the router can lazy-load a barber-specific
// change-phone page without coupling it to the client module.

import ChangePhone from '../client/ChangePhone.jsx';

function BarberChangePhone() {
    return <ChangePhone table="barbers" returnPath="/barber/settings" />;
}

export default BarberChangePhone;
