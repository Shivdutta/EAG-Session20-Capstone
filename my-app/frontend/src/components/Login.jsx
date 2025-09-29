import React, { useEffect, useRef, useState } from "react";
import DEMO_USERS from "./demoUsers";
import SIPGoalPlanningForm from "./react_sip_form";
import '../App.css'; // Import the CSS file from parent directory

const SESSION_MINUTES = 200;

// base64url helpers
const b64url = (obj) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const makeDemoJWT = (payload) => {
  const header = { alg: "HS256", typ: "JWT" };
  return `${b64url(header)}.${b64url(payload)}.demo-signature`;
};

const parseDemoJWT = (token) => {
  try {
    const [, payload] = token.split(".");
    const json = decodeURIComponent(
      escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const AuthStore = {
  login(username, password) {
    const match = DEMO_USERS.find(
      (u) => u.id === username && u.password === password
    );
    if (!match) throw new Error("Invalid username or password");

    const now = Math.floor(Date.now() / 1000);
    const exp = now + SESSION_MINUTES * 60;
    const token = makeDemoJWT({ sub: match.id, roles: match.roles, iat: now, exp });

    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_exp", String(exp));
    return { token, user: { id: match.id, roles: match.roles }, exp };
  },
  logout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_exp");
  },
  getToken() {
    return localStorage.getItem("auth_token");
  },
  isAuthed() {
    const t = this.getToken();
    if (!t) return false;
    const p = parseDemoJWT(t);
    const now = Math.floor(Date.now() / 1000);
    return !!(p?.exp && now < p.exp);
  },
  getUser() {
    const t = this.getToken();
    if (!t) return null;
    const p = parseDemoJWT(t);
    return p ? { id: p.sub, roles: p.roles || [] } : null;
  },
  msRemaining() {
    const exp = Number(localStorage.getItem("auth_exp") || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    return Math.max(exp - nowSec, 0) * 1000;
  },
};

// ======== Login UI ========
function LoginForm({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setIsSubmitting(true);
    
    // Add slight delay for better UX feedback
    setTimeout(() => {
      try {
        AuthStore.login(username.trim(), password);
        onSuccess?.();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        setErr(e.message || "Login failed");
      } finally {
        setIsSubmitting(false);
      }
    }, 300);
  };

  return (
    <div className="login-app-container">
      <div className="login-background-overlay"></div>
      
      <div className="login-content-wrapper">
        {/* Hero Section */}
        <div className="login-hero-section">
          <div className="hero-content">
            <h1 className="hero-title">SIP Goal Planning</h1>
            <h2 className="hero-subtitle">Fund Calculation Platform</h2>
            <p className="hero-description">
              Plan your systematic investment goals and calculate returns with precision
            </p>
            <div className="hero-features">
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <span>Advanced Analytics</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🎯</div>
                <span>Goal-Based Planning</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">💰</div>
                <span>Smart Calculations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="login-card-container">
          <div className="login-card">
            <div className="login-card-header">
              <h3 className="login-title">Welcome Back</h3>
              <p className="login-subtitle">Sign in to continue to your dashboard</p>
            </div>

            {err && (
              <div className="error-message">
                <div className="error-icon">⚠️</div>
                <span>{err}</span>
              </div>
            )}

            <form onSubmit={submit} className="login-form">
              <div className="form-group">
                <label className="form-label">
                  User ID <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your user ID"
                    required
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <div className="input-icon">👤</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={isSubmitting}
                  />
                  <div className="input-icon">🔒</div>
                </div>
              </div>

              <button 
                className={`btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="btn-spinner"></div>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="login-footer">
              <div className="demo-credentials">
                <p className="demo-title">Demo Credentials:</p>
                <div className="demo-info">
                  <span><strong>User ID:</strong> admin</span>
                  <span><strong>Password:</strong> Admin@123</span>
                </div>
              </div>
              <p className="session-info">
                Session auto-expires in {SESSION_MINUTES} minutes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Styles */}
      <style jsx>{`
        .login-app-container {
          min-height: 100vh;
          display: flex;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .login-background-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%);
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
          z-index: -1;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .login-content-wrapper {
          display: flex;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          align-items: center;
          min-height: 100vh;
          gap: 60px;
          padding: 40px;
        }

        /* Hero Section */
        .login-hero-section {
          flex: 1;
          color: white;
          animation: slideInLeft 0.8s ease-out;
        }

        .hero-content {
          max-width: 500px;
        }

        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          margin: 0 0 10px 0;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          line-height: 1.1;
          background: linear-gradient(45deg, #ffffff, #e0e7ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 2rem;
          font-weight: 600;
          margin: 0 0 20px 0;
          color: rgba(255, 255, 255, 0.9);
        }

        .hero-description {
          font-size: 1.2rem;
          margin: 0 0 40px 0;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
        }

        .hero-features {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 15px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 15px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }

        .feature-item:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateX(10px);
        }

        .feature-icon {
          font-size: 1.5rem;
          min-width: 30px;
        }

        /* Login Card */
        .login-card-container {
          flex: 0 0 420px;
          animation: slideInRight 0.8s ease-out;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.1),
            0 0 0 1px rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .login-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .login-subtitle {
          color: #6b7280;
          font-size: 1rem;
          margin: 0;
        }

        /* Form Styles */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-weight: 600;
          color: #374151;
          font-size: 0.95rem;
        }

        .required {
          color: #ef4444;
        }

        .input-wrapper {
          position: relative;
        }

        .form-input {
          width: 100%;
          padding: 16px 50px 16px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: white;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
          transform: translateY(-1px);
        }

        .form-input:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .input-icon {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          font-size: 1rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 16px 24px;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 10px;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
        }

        .btn-primary:active {
          transform: translateY(0);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .btn-loading {
          pointer-events: none;
        }

        .btn-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .btn-block {
          width: 100%;
        }

        .error-message {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          color: #dc2626;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid #fecaca;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: shake 0.5s ease-in-out;
        }

        .error-icon {
          font-size: 1.2rem;
          flex-shrink: 0;
        }

        /* Footer */
        .login-footer {
          margin-top: 30px;
          text-align: center;
        }

        .demo-credentials {
          background: #f0f9ff;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid #bae6fd;
        }

        .demo-title {
          font-weight: 600;
          color: #1e40af;
          margin: 0 0 12px 0;
          font-size: 0.95rem;
        }

        .demo-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 0.9rem;
          color: #1e40af;
        }

        .session-info {
          color: #6b7280;
          font-size: 0.85rem;
          margin: 0;
        }

        /* Animations */
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .login-content-wrapper {
            flex-direction: column;
            gap: 30px;
            padding: 20px;
            text-align: center;
          }

          .login-hero-section {
            flex: none;
          }

          .hero-title {
            font-size: 2.5rem;
          }

          .hero-subtitle {
            font-size: 1.5rem;
          }

          .hero-description {
            font-size: 1rem;
          }

          .hero-features {
            display: none;
          }

          .login-card-container {
            flex: none;
            width: 100%;
            max-width: 400px;
          }

          .login-card {
            padding: 30px 25px;
          }

          .demo-info {
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .login-content-wrapper {
            padding: 15px;
          }

          .hero-title {
            font-size: 2rem;
          }

          .hero-subtitle {
            font-size: 1.2rem;
          }

          .login-card {
            padding: 25px 20px;
          }
        }
      `}</style>
    </div>
  );
}

// ======== Auth Gate ========
function AuthGate({ children }) {
  const [, force] = useState(0);
  const timerRef = useRef(null);
  const [sessionVersion, setSessionVersion] = useState(0);

  const scheduleLogout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = AuthStore.msRemaining();
    if (ms > 0) {
      timerRef.current = setTimeout(() => {
        handleLogout();
      }, ms);
    }
  };

  const handleLogout = () => {
    AuthStore.logout();
    setSessionVersion((v) => v + 1);
    force((x) => x + 1);
    if (window?.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const ok = AuthStore.isAuthed();
    if (!ok) {
      handleLogout();
      return;
    }
    scheduleLogout();
    return () => timerRef.current && clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!AuthStore.isAuthed()) {
    return (
      <LoginForm
        onSuccess={() => {
          scheduleLogout();
          force((x) => x + 1);
        }}
      />
    );
  }

  const user = AuthStore.getUser();

  return (
    <div className="authenticated-app">
      {/* Streamlined Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">SIP Goal Planning & Fund Calculation</h1>
          <div className="header-actions">
            <div className="user-info">
              <span className="user-greeting">Welcome back, <strong>{user?.id}</strong></span>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              <span className="logout-icon">🚪</span>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main key={sessionVersion} className="main-content">
        {children}
      </main>

      {/* Header Styles */}
      <style jsx>{`
        .authenticated-app {
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .app-header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .app-title {
          font-size: 1.8rem;
          font-weight: 700;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .user-info {
          display: flex;
          align-items: center;
        }

        .user-greeting {
          color: #374151;
          font-size: 0.95rem;
        }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        }

        .logout-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }

        .logout-btn:active {
          transform: translateY(0);
        }

        .logout-icon {
          font-size: 1rem;
        }

        .main-content {
          padding: 0;
          animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .header-content {
            padding: 15px 20px;
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }

          .app-title {
            font-size: 1.4rem;
          }

          .header-actions {
            gap: 15px;
          }

          .user-greeting {
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}

// ======== Default export ========
export default function Login() {
  return (
    <AuthGate>
      <SIPGoalPlanningForm />
    </AuthGate>
  );
}