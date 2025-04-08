import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../../Services/apiConnection";
import { FaUser, FaLock, FaEnvelope, FaEye, FaEyeSlash } from "react-icons/fa";
import "./Credentials.css";
import { FaGoogle } from "react-icons/fa";

const Credentials = () => {
  const [isActive, setIsActive] = useState(false);
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [loginErrors, setLoginErrors] = useState({});
  const [loginIsSubmitting, setLoginIsSubmitting] = useState(false);
  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    adminName: "",
  });
  const [registerErrors, setRegisterErrors] = useState({});
  const [registerIsSubmitting, setRegisterIsSubmitting] = useState(false);
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const [registerShowPassword, setRegisterShowPassword] = useState(false);
  const [registerShowConfirmPassword, setRegisterShowConfirmPassword] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateLogin = () => {
    const errors = {};
    if (!loginData.email) errors.email = "Enter email";
    else if (!validateEmail(loginData.email)) errors.email = "Invalid email address";
    if (!loginData.password) errors.password = "Enter password";
    else if (loginData.password.length < 6)
      errors.password = "Password must be at least 6 characters";
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegister = () => {
    const errors = {};
    if (!registerData.email) errors.email = "Enter email";
    else if (!validateEmail(registerData.email)) errors.email = "Invalid email address";
    if (!registerData.username) errors.username = "Enter username";
    else if (registerData.username.length < 3)
      errors.username = "Username must be at least 3 characters";
    if (!registerData.password) errors.password = "Enter password";
    else if (registerData.password.length < 6)
      errors.password = "Password must be at least 6 characters";
    if (!registerData.confirmPassword)
      errors.confirmPassword = "Confirm your password";
    else if (registerData.password !== registerData.confirmPassword)
      errors.confirmPassword = "Passwords do not match";
    setRegisterErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
    setLoginErrors((prev) => ({ ...prev, [name]: "", apiError: "" }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setLoginIsSubmitting(true);
    try {
      const response = await login({
        email: loginData.email,
        password: loginData.password,
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginErrors({ apiError: data.message || "Please register first" });
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("adminName", data.adminName);
        if (data.role === "admin") {
          navigate(`/adminPannel/${data.username}`);
        } else if (data.role === "superadmin") {
          navigate("/superadminPannel");
        } else {
          navigate("/landingpage");
        }
      }
    } catch (error) {
      setLoginErrors({
        apiError: "Something went wrong. Please try again later.",
      });
    } finally {
      setLoginIsSubmitting(false);
    }
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    if (name === "username") {
      const isAdmin = /_.*@/.test(value);
      setIsAdminUser(isAdmin);
    }
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    setRegisterErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!validateRegister()) return;

    setRegisterIsSubmitting(true);
    try {
      const requestData = {
        email: registerData.email,
        username: registerData.username,
        password: registerData.password,
        confirmPassword: registerData.confirmPassword,
      };

      if (registerData.adminName) {
        requestData.adminName = registerData.adminName;
      }

      const response = await register(requestData);

      if (!response.ok) {
        const data = await response.json();
        setRegisterErrors({ apiError: data.message || "Registration failed." });
        return;
      }

      // Instead of using a native alert, show a stylish alert card.
      setRegisterData({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        adminName: "",
      });
      setShowSuccessAlert(true);
    } catch (err) {
      setRegisterErrors({ apiError: "Registration failed, please try again." });
    } finally {
      setRegisterIsSubmitting(false);
    }
  };

  return (
    <div className="crediantials-credentials-container">
      <div className={`crediantials-container ${isActive ? "crediantials-active" : ""}`}>
        <div className="crediantials-form-box crediantials-login">
          <form className="crediantials-form" onSubmit={handleLoginSubmit} noValidate>
            <h1 className="crediantials-headingtag">Login</h1>
            <div className="crediantials-input-box">
              <input
                type="text"
                name="email"
                placeholder="Email"
                required
                aria-label="Username"
                className={`crediantials-input ${loginErrors.email ? "input-error" : ""}`}
                value={loginData.email}
                onChange={handleLoginChange}
              />
              <FaUser className="crediantials-iconstyle" />
              {loginErrors.email && <span className="error-tooltip">{loginErrors.email}</span>}
            </div>
            <div className="crediantials-input-box">
              <input
                type={loginShowPassword ? "text" : "password"}
                name="password"
                placeholder={loginErrors.apiError || "Password"}
                required
                aria-label="Password"
                className={`crediantials-input ${loginErrors.apiError ? "input-error" : ""}`}
                value={loginErrors.apiError ? "" : loginData.password}
                onChange={handleLoginChange}
              />
              <span
                onClick={() => setLoginShowPassword(!loginShowPassword)}
                className="crediantials-iconstyle"
                style={{ cursor: "pointer" }}
              >
                {loginShowPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
            <div className="crediantials-forgot-link">
              <span
                className="crediantials-forgot-link-span"
                role="button"
                tabIndex="0"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot Password?
              </span>
            </div>
            <button type="submit" className="crediantials-btn" disabled={loginIsSubmitting}>
              {loginIsSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
        <div className="crediantials-form-box crediantials-register">
          <form className="crediantials-form" onSubmit={handleRegisterSubmit} noValidate>
            <h1 className="crediantials-headingtag">Register</h1>
            <div className="crediantials-input-box">
              <input
                type="text"
                name="username"
                placeholder="Username"
                required
                aria-label="Username"
                className={`crediantials-input ${registerErrors.username ? "input-error" : ""}`}
                value={registerData.username}
                onChange={handleRegisterChange}
              />
              <FaUser className="crediantials-iconstyle" />
              {registerErrors.username && (
                <span className="error-tooltip">{registerErrors.username}</span>
              )}
            </div>
            <div className="crediantials-input-box">
              <input
                type="email"
                name="email"
                placeholder="Email"
                required
                aria-label="Email"
                className={`crediantials-input ${registerErrors.email ? "input-error" : ""}`}
                value={registerData.email}
                onChange={handleRegisterChange}
              />
              <FaEnvelope className="crediantials-iconstyle" />
              {registerErrors.email && (
                <span className="error-tooltip">{registerErrors.email}</span>
              )}
            </div>
            <div className="crediantials-input-box">
              <input
                type="text"
                name="adminName"
                placeholder="Admin Name"
                required
                aria-label="adminName"
                className={`crediantials-input ${registerErrors.adminName ? "input-error" : ""}`}
                value={registerData.adminName}
                onChange={handleRegisterChange}
                disabled={isAdminUser}
              />
              <FaUser className="crediantials-iconstyle" />
              {registerErrors.adminName && (
                <span className="error-tooltip">{registerErrors.adminName}</span>
              )}
            </div>
            <div className="crediantials-input-box">
              <input
                type={registerShowPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                required
                aria-label="Password"
                className={`crediantials-input ${registerErrors.password ? "input-error" : ""}`}
                value={registerData.password}
                onChange={handleRegisterChange}
              />
              <span
                onClick={() => setRegisterShowPassword(!registerShowPassword)}
                className="crediantials-iconstyle"
                style={{ cursor: "pointer" }}
              >
                {registerShowPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
              {registerErrors.password && (
                <span className="error-tooltip">{registerErrors.password}</span>
              )}
            </div>
            <div className="crediantials-input-box">
              <input
                type={registerShowConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                required
                aria-label="Confirm Password"
                className={`crediantials-input ${registerErrors.confirmPassword ? "input-error" : ""}`}
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
              />
              <span
                onClick={() => setRegisterShowConfirmPassword(!registerShowConfirmPassword)}
                className="crediantials-iconstyle"
                style={{ cursor: "pointer" }}
              >
                {registerShowConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
              {registerErrors.confirmPassword && (
                <span className="error-tooltip">{registerErrors.confirmPassword}</span>
              )}
            </div>
            {registerErrors.apiError && (
              <div className="api-error">{registerErrors.apiError}</div>
            )}
            <button type="submit" className="crediantials-btn" disabled={registerIsSubmitting}>
              {registerIsSubmitting ? "Submitting..." : "Register"}
            </button>
          </form>
        </div>
        <div className="crediantials-toggle-box">
          <div className="crediantials-toggle-panel crediantials-toggle-left">
            <h1 className="crediantials-toggle-heading">RevuteAI</h1>
            <p className="crediantials-toggle-paragraph">Don't have an account?</p>
            <button type="button" className="crediantials-btn" onClick={() => setIsActive(true)}>
              Register
            </button>
          </div>
          <div className="crediantials-toggle-panel crediantials-toggle-right">
            <h1 className="crediantials-toggle-heading">Welcome Back!</h1>
            <p className="crediantials-toggle-paragraph">Already have an account?</p>
            <button type="button" className="crediantials-btn" onClick={() => setIsActive(false)}>
              Login
            </button>
          </div>
        </div>
      </div>
      {showSuccessAlert && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            <h2>Success!</h2>
            <p>Registered successfully!</p>
            <button
              className="crediantials-btn"
              onClick={() => {
                setShowSuccessAlert(false);
                setIsActive(false);
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Credentials;
