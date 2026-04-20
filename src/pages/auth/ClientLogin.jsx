import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function ClientLogin() {
    const [phone, setPhone] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = () => {
        if (phone.trim()) {
            login('client', phone);
            navigate('/client/dashboard');
        }
    };

    return (
             <section className="mt-15 mx-auto justify-items-center">
                 <div className="flex-col justfiy-items-center ">
                     <div className="flex items-center gap-2">
                         <img src="./Scissor.png" alt="blue scissor icon" className="w-3 h-3" />
                         <p className="text-[#1D0065] font-bold">Join NavbatGo</p>
                     </div>
                     <h1 className="text-[36px] text-start font-bold text-[#1D0065] leading-none my-5">Set Up Your Client <br />Profile</h1>
                 
                 </div>
                 <h1 className="flex items-center mt-15 mb-5 mr-13 gap-2 text-[20px] font-semibold"><img src="./Icon.png" alt="" className="h-4 w-4" />Personal Information</h1>
                 <div className="flex-col justify-items-center ">
                     <div className="flex-col mb-5 ">
                         <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">Full name</h1>
                         <input type="name" placeholder="e.g Aziz Raghimov" className="pl-5 pr-15 py-3 text-semibold rounded-xl" />
                     </div>
                     <div className="ml-10">
                         <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">Mobile Number</h1>
                         <div className="flex items-center ml-5">
                             <p>+998</p>
                             <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder=" 90 123 45 67" className="ml-2 pr-15 py-2 rounded-xl text-[16px] font-regular text-[#000000]" />
                         </div>
                     </div>
                     <button onClick={handleLogin} className="flex justify-items-center mt-20 font-medium bg-[#1D0065] text-white px-30 py-3 rounded-xl cursor-pointer">Continue</button>
                 </div>
             </section>
            
    );
}

export default ClientLogin;
