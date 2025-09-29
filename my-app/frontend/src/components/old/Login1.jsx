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

// ======== Login UI (styled to match react_sip_form) ========
function LoginForm({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setErr("");
    try {
      AuthStore.login(username.trim(), password);
      onSuccess?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e.message || "Login failed");
    }
  };

  return (
    <div className="App">
      <div className="sip-form-container login-page">
        {/* Main heading for the application */}
        <div className="app-header-section">
          <h1 className="main-app-title">SIP Goal Planning and Fund Calculation</h1>
          <p className="app-subtitle">Plan your systematic investment goals and calculate returns</p>
        </div>

        <div className="form-section login-card">
          <h2 className="form-title">Sign in</h2>
          <p className="form-description">Session auto-expires in 30 minutes</p>

          {err && <div className="error-message">{err}</div>}

          <form onSubmit={submit} className="login-form">
            <div className="form-group">
              <label className="form-label">User ID <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password <span className="required">*</span></label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin@123"
                required
              />
            </div>

            <button className="btn-primary btn-block">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ======== Auth Gate (right-aligned "Signed in as …", with main title) ========
function AuthGate({ children }) {
  const [, force] = useState(0);
  const timerRef = useRef(null);
  const [sessionVersion, setSessionVersion] = useState(0); // force SIP remount

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
    <div className="App">
      {/* Header: two-line layout */}
      <header className="auth-header">
        {/* First line: Right-aligned user info */}
        <div className="auth-top-line">
          <div className="auth-right">
            <span className="signed-in">
              Signed in as <b>{user?.id}</b>
            </span>
            <button onClick={handleLogout} className="btn-secondary auth-logout">
              Logout
            </button>
          </div>
        </div>
        
        {/* Second line: Center-aligned title */}
        <div className="auth-title-line">
          <h1 className="header-title">SIP Goal Planning and Fund Calculation</h1>
        </div>
      </header>

      {/* key ensures SIP remounts after logout/login */}
      <div key={sessionVersion}>{children}</div>

      {/* Enhanced styles combining original + App.css inspiration */}
      <style jsx>{`
        /* Base App styling */
        .App {
          text-align: center;
          min-height: 100vh;
        }

        /* Container + Typography (match SIP) */
        .sip-form-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        /* Main application header section */
        .app-header-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 20px;
          margin-bottom: 30px;
          border-radius: 15px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .main-app-title {
          font-size: 3rem;
          font-weight: bold;
          margin: 0 0 10px 0;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          animation: fadeInDown 0.8s ease-out;
        }

        .app-subtitle {
          font-size: 1.2rem;
          margin: 0;
          opacity: 0.9;
          animation: fadeInUp 0.8s ease-out 0.2s both;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Header title for authenticated view */
        .header-title {
          font-size: 1.8rem;
          font-weight: bold;
          color: #1f2937;
          margin: 0;
          background: linear-gradient(45deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .form-title {
          font-size: 1.8rem;
          font-weight: bold;
          color: #1f2937;
          margin: 0 0 6px 0;
          text-align: center;
        }
        .form-description {
          color: #6b7280;
          font-size: 1rem;
          text-align: center;
          margin-bottom: 20px;
        }

        /* Card (match .form-section from SIP) */
        .form-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Login page layout */
        .login-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
        .login-card {
          max-width: 480px;
          margin: 0 auto;
          width: 100%;
        }
        .login-form {
          display: grid;
          gap: 16px;
        }

        /* Labels, inputs, errors (match SIP) */
        .form-group { display: flex; flex-direction: column; }
        .form-label {
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
          text-align: left;
        }
        .required { color: #ef4444; }
        .form-input {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #d1d5db;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .error-message {
          background: #fee2e2;
          color: #dc2626;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 10px;
          border: 1px solid #fecaca;
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        /* Buttons (enhanced) */
        .btn-primary, .btn-secondary {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .btn-primary:hover { 
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        .btn-secondary:hover { 
          background: #e5e7eb; 
          transform: translateY(-1px);
        }
        .btn-block { width: 100%; }

        /* Header bar: two-line layout */
        .auth-header {
          background: white;
          margin-bottom: 10px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          border-bottom: 2px solid #e5e7eb;
        }
        
        .auth-top-line {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 12px 24px 8px 24px;
        }
        
        .auth-title-line {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 8px 24px 16px 24px;
        }
        
        .auth-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .signed-in {
          font-size: 0.95rem;
          color: #374151;
        }
        .auth-logout {
          padding: 8px 14px;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .main-app-title { font-size: 2.2rem; }
          .app-subtitle { font-size: 1rem; }
          .header-title { font-size: 1.4rem; }
          .login-card { padding: 4px; }
          .auth-header { 
            flex-direction: column; 
            gap: 12px;
            padding: 12px 16px;
          }
          .auth-left { text-align: center; }
          .auth-right { gap: 8px; }
          .signed-in { font-size: 0.9rem; }
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