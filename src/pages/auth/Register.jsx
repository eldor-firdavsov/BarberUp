import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem("onboarding_data");
    if (!data) {
      navigate("/");
    }
  }, [navigate]);

  const handleContinue = () => {
    if (email && password) {
      const data = JSON.parse(localStorage.getItem("onboarding_data"));
      const updatedData = { ...data, email, password };
      localStorage.setItem("onboarding_data", JSON.stringify(updatedData));

      if (data.role === "client") {
        navigate("/onboarding/client");
      } else if (data.role === "barber") {
        navigate("/onboarding/barber");
      }
    }
  };

  return (
    <>
      <section className="mt-10 mx-auto">
        <div className="flex-col text-center ">
          <img
            src="./Scissor.png"
            alt="blue scissor icon"
            className="mx-auto mb-10"
          />
          <h1 className="text-[36px] font-bold text-[#1D0065] leading-none my-5">
            Welcome to
            <br />
            NavbatGo
          </h1>
          <p className="text-[16px] text-[#4C4451] text-center">
            Enter your email to get <br />
            started
          </p>
        </div>
        <div className="flex-col justify-items-center mt-10">
          <div className="flex-col mb-5">
            <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">
              Email
            </h1>
            <input
              type="email"
              placeholder="example@gmail.com"
              className="pl-5 pr-15 py-3 rounded-4xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">
              Password
            </h1>
            <input
              type="password"
              placeholder="Create password"
              className="pl-5 pr-15 py-3 rounded-4xl text-[16px] font-regular text-[#000000]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button onClick={handleContinue} className="flex justify-items-center mt-5 font-medium bg-[#1D0065] text-white px-28 py-3 rounded-3xl cursor-pointer">
            Sign Up
          </button>
        </div>
        <div className="flex-col justify-items-center mt-3">
          <div className="ml-38 leading-none  text-right">
            <p className="text-[11px] text-[#7D7483]">
              Already have an accaunt?
            </p>
            <a onClick={() => navigate("/login")} href="#" className="text-[11px] font-semibold text-[#1D0065] ">
              Sign In
            </a>
          </div>
        </div>
      </section>
      
      
    </>
  );
}

export default Register;
