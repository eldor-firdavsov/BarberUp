import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem("onboarding_data");
    if (!data) {
      navigate("/");
    }
  }, [navigate]);

  const handleContinue = () => {
    if (!email || !password) {
      setError("Fields cannot be empty.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Invalid email format.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const userExists = users.some(u => u.email === email);
    if (userExists) {
      setError("User already exists with this email.");
      return;
    }

    const data = JSON.parse(localStorage.getItem("onboarding_data"));
    const updatedData = { ...data, email, password };
    localStorage.setItem("onboarding_data", JSON.stringify(updatedData));

    if (data.role === "client") {
      navigate("/onboarding/client");
    } else if (data.role === "barber") {
      navigate("/onboarding/barber");
    }
  };

  const isFormValid = email.trim() !== "" && password.trim() !== "";

  return (
    <section className="page-animate min-h-screen flex flex-col px-6 py-12 max-w-md mx-auto">
      <button
        onClick={() => navigate('/')}
        className="self-start mb-6 flex items-center text-[#4C4451] font-medium"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M15 18l-6-6 6-6" /></svg>
        Back
      </button>
      <div className="text-center mb-10">
        <img src="./Scissor.png" alt="icon" className="mx-auto mb-6 h-10 w-10" />
        <h1 className="text-3xl font-bold text-[#1D0065] leading-tight mb-3">
          Welcome to <br /> NavbatGo
        </h1>
        <p className="text-base text-[#4C4451]">
          Enter your details to get started
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="label-base">Email</label>
          <input
            type="email"
            className="input-base"
            placeholder="example@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label-base">Password</label>
          <input
            type="password"
            className="input-base"
            placeholder="Create password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="text-red-500 text-sm font-medium text-center">{error}</div>}
        <button
          onClick={handleContinue}
          disabled={!isFormValid}
          className="btn-primary mt-4"
        >
          Sign Up
        </button>

        <div className="text-center mt-6">
          <p className="text-xs text-[#7D7483]">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-[#1D0065] underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export default Register;