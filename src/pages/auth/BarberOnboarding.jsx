import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function BarberOnboarding() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [shopName, setShopName] = useState('');
    const [workingHours, setWorkingHours] = useState('');
    const [avgPrice, setAvgPrice] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const data = localStorage.getItem('onboarding_data');
        if (!data) {
            navigate('/');
        }
    }, [navigate]);

    const handleFinish = () => {
        if (name && phone && shopName && workingHours && avgPrice) {
            const data = JSON.parse(localStorage.getItem('onboarding_data'));
            const userObj = {
                role: 'barber',
                email: data.email,
                password: data.password,
                name,
                phone,
                shopName,
                workingHours,
                avgPrice
            };

            const users = JSON.parse(localStorage.getItem('users')) || [];
            users.push(userObj);
            localStorage.setItem('users', JSON.stringify(users));

            login(userObj);
            navigate('/barber/dashboard');
        }
    };

    return (
        <div>
            <h1>Barber Onboarding</h1>
            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
            <input type="text" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} />
            <input type="text" placeholder="Barbershop Name" value={shopName} onChange={e => setShopName(e.target.value)} />
            <input type="text" placeholder="Working Hours" value={workingHours} onChange={e => setWorkingHours(e.target.value)} />
            <input type="text" placeholder="Average Price" value={avgPrice} onChange={e => setAvgPrice(e.target.value)} />
            <button onClick={handleFinish}>Finish</button>
        </div>
    );
}

export default BarberOnboarding;
