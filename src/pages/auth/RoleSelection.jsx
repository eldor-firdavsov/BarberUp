import { useNavigate } from 'react-router-dom';

function RoleSelection() {
    const navigate = useNavigate();

    const handleSelectRole = (role) => {
        localStorage.setItem('onboarding_data', JSON.stringify({ role }));
        navigate('/register');
    };

    return (
        <>
             <section className="mt-10 mx-auto">
                 <div className="flex-col text-center">
                     <h1 className="text-[48px] font-bold text-[#1D0065]">NavbatGo</h1>
                     <p className="text-[18px] font-medium text-[#5F5E5E]">Select your professional journey</p>
                 </div>
                 <div className="mt-10 ">
                     <button onClick={() => handleSelectRole('barber')} className="flex items-center justify-center mx-auto text-start px-5 py-2 gap-5 mb-5 cursor-pointer border-2 border-transparent rounded-xl hover:border-[#1D0065]">
                         <img src="./Scissor.png" alt="" />
                         <div>
                             <h1 className="text-[24px] font-bold text-[#1D0065]">I'm a Barber</h1>
                             <p className="w-40 text-[14px]  text-[#5F5E5E]">Manage schedule and grow your barber</p>
                         </div>
                         <img src="./pointer.png" alt="" />
                     </button>
                     <button onClick={() => handleSelectRole('client')} className="flex items-center justify-center mx-auto text-start px-5 py-2  cursor-pointer border-2 border-transparent rounded-xl hover:border-[#1D0065]">
                         <img src="./Icon.png" alt="" />
                         <div className="ml-5">
                             <h1 className="text-[24px] font-bold text-[#1D0065]">I'm a Client</h1>
                             <p className="w-45 text-[14px] text-[#5F5E5E]">Book premium services in seconds</p>
                         </div>
                         <img src="./pointer.png" alt="" />
                     </button>
                     <div className="flex items-center justify-center gap-5 mt-20">
                         <img src="./People.png" alt="" />
                         <p className="text-[12px] font-semibold uppercase text-[#5F5E5E]">Join 1200+ professionals</p>
                     </div>
                     <p className="text-center tracking-[2.4px] mt-20 uppercase text-[12px] text-[#5F5E5E] opacity-60">The modern barber exprience</p>
                 </div>
             </section>            
         </>
    );
}

export default RoleSelection;
