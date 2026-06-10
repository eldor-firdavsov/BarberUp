import { createContext, useContext, useState } from 'react';

const ClientContext = createContext(null);

const PHONE_KEY = 'navbatgo_client_phone';
const NAME_KEY  = 'navbatgo_client_name';

export function ClientProvider({ children }) {
    const [clientPhone, setClientPhone] = useState(
        () => localStorage.getItem(PHONE_KEY) || ''
    );
    const [clientName, setClientName] = useState(
        () => localStorage.getItem(NAME_KEY) || ''
    );

    const isIdentified = Boolean(clientPhone && clientName);

    function identify(name, phone) {
        const trimPhone = phone.trim();
        const trimName  = name.trim();
        localStorage.setItem(PHONE_KEY, trimPhone);
        localStorage.setItem(NAME_KEY,  trimName);
        setClientPhone(trimPhone);
        setClientName(trimName);
    }

    function clearIdentity() {
        localStorage.removeItem(PHONE_KEY);
        localStorage.removeItem(NAME_KEY);
        setClientPhone('');
        setClientName('');
    }

    return (
        <ClientContext.Provider value={{ clientPhone, clientName, isIdentified, identify, clearIdentity }}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClient() {
    const ctx = useContext(ClientContext);
    if (!ctx) throw new Error('useClient must be used inside <ClientProvider>');
    return ctx;
}
