import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, demoLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { success, error: loginError } = await login(email, pass);
    if (success) {
      navigate('/');
    } else {
      setError(loginError || 'メールアドレスまたはパスワードが正しくありません。');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <img src="/app-icon.png" alt="Temasak Logo" style={{ width: '48px', height: '48px', borderRadius: '14px', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)', objectFit: 'cover' }} />
            <h1 style={{ margin: 0, fontSize: '2rem' }}>Temasak</h1>
          </div>
          <p className="subtitle">自動精算機 導入支援プラットフォーム</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>メールアドレス</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input 
                type="email" 
                placeholder="メールアドレスを入力" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>パスワード</label>
            <div className="input-wrapper">
              <KeyRound size={18} className="input-icon" />
              <input 
                type="password" 
                placeholder="パスワードを入力" 
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <LogIn size={18} />
                ログイン
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              demoLogin();
              navigate('/');
            }}
            style={{
              marginTop: '0.75rem',
              width: '100%',
              padding: '0.65rem',
              backgroundColor: '#f1f5f9',
              border: '1px dashed #94a3b8',
              borderRadius: '0.5rem',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            開発確認用：ワンクリックログイン（松浦 貴文）
          </button>
        </form>
        
        <div className="login-footer">
          <p>※Firebaseで作成したユーザーのメールアドレスとパスワードでログインしてください。</p>
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          position: relative;
          overflow: hidden;
        }

        .login-container::before {
          content: '';
          position: absolute;
          top: -20%;
          left: -10%;
          width: 60%;
          height: 80%;
          background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(255,255,255,0) 70%);
          border-radius: 50%;
          z-index: 0;
        }

        .login-container::after {
          content: '';
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 50%;
          height: 60%;
          background: radial-gradient(circle, rgba(168,85,247,0.1) 0%, rgba(255,255,255,0) 70%);
          border-radius: 50%;
          z-index: 0;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 24px;
          padding: 3rem 2.5rem;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0,0,0,0.02);
          z-index: 1;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-header {
          text-align: center;
          margin-bottom: 2.5rem;
        }

        .logo-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--primary) 0%, #2563eb 100%);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .login-header h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-color);
          margin: 0;
          letter-spacing: -0.025em;
        }

        .subtitle {
          color: var(--text-muted);
          font-size: 0.875rem;
          margin: 0;
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: #fef2f2;
          color: #dc2626;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
          border: 1px solid #fee2e2;
          animation: shake 0.4s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-color);
          margin-bottom: 0.5rem;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          color: var(--text-muted);
        }

        .input-wrapper input {
          width: 100%;
          padding: 0.875rem 1rem 0.875rem 2.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          background-color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
          color: var(--text-color);
          transition: all 0.2s ease;
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
          background-color: #fff;
        }

        .login-btn {
          width: 100%;
          padding: 0.875rem;
          background: linear-gradient(135deg, var(--primary) 0%, #2563eb 100%);
          color: white;
          border: none;
          border-radius: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.2);
          margin-top: 0.5rem;
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.3);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
