import { useNavigate } from 'react-router-dom';

function RoleSelection() {
    const navigate = useNavigate();

    const handleSelectRole = (role) => {
        localStorage.setItem('onboarding_data', JSON.stringify({ role }));
        navigate('/register');
    };

    return (
        <section className="page-animate min-h-screen flex flex-col px-6 py-12 max-w-md mx-auto">
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold text-[#1D0065] mb-2">NavbatGo</h1>
                <p className="text-lg font-medium text-[#5F5E5E]">Select your professional journey</p>
            </div>

            <div className="space-y-4 flex-grow">
                <button
                    onClick={() => handleSelectRole('barber')}
                    className="w-full flex items-center justify-between p-5 bg-white border-2 border-gray-100 rounded-2xl transition-all hover:border-[#1D0065] active:scale-95 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-[#f0f4ff] p-3 rounded-xl">
                            <img src="./Scissor.png" alt="" className="w-8 h-8 object-contain" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-bold text-[#1D0065]">I'm a Barber</h2>
                            <p className="text-sm text-[#5F5E5E] leading-tight">Manage schedule and grow</p>
                        </div>
                    </div>
                    <img src="./pointer.png" alt="" className="w-4 h-4 opacity-40" />
                </button>

                <button
                    onClick={() => handleSelectRole('client')}
                    className="w-full flex items-center justify-between p-5 bg-white border-2 border-gray-100 rounded-2xl transition-all hover:border-[#1D0065] active:scale-95 shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-[#f0f4ff] p-3 rounded-xl">
                            <img src="./Icon.png" alt="" className="w-8 h-8 object-contain" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-bold text-[#1D0065]">I'm a Client</h2>
                            <p className="text-sm text-[#5F5E5E] leading-tight">Book premium services</p>
                        </div>
                    </div>
                    <img src="./pointer.png" alt="" className="w-4 h-4 opacity-40" />
                </button>
            </div>

            <div className="mt-auto pt-10 text-center">
                <div className="flex items-center justify-center gap-3 mb-6">
                    <img src="./People.png" alt="" className="h-6" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#5F5E5E]">Join 1200+ professionals</p>
                </div>
                <p className="uppercase text-[10px] tracking-[3px] text-[#5F5E5E] opacity-50">The modern barber experience</p>
            </div>
        </section>
    );
}

export default RoleSelection;