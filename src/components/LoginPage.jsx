import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const recaptchaRef = useRef(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const captchaWidgetId = useRef(null);

  const onCaptchaChange = useCallback((token) => {
    setCaptchaToken(token);
  }, []);

  useEffect(() => {
    // Render reCAPTCHA when API is ready
    const renderCaptcha = () => {
      if (window.grecaptcha && recaptchaRef.current && captchaWidgetId.current === null) {
        captchaWidgetId.current = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: '6LeNNHssAAAAAMIte93v32bcpzrVDqZhXHObtqwx',
          callback: onCaptchaChange,
          'expired-callback': () => setCaptchaToken(null),
        });
      }
    };
    // Check if already loaded or wait
    if (window.grecaptcha && window.grecaptcha.render) {
      renderCaptcha();
    } else {
      const interval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          renderCaptcha();
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [onCaptchaChange]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (!captchaToken) {
      setError('Vui lòng xác nhận bạn không phải robot');
      return;
    }
    setLoading(true);
    const result = await login(username, password);
    if (!result.success) {
      setError(result.error);
      // Reset captcha on error
      if (window.grecaptcha && captchaWidgetId.current !== null) {
        window.grecaptcha.reset(captchaWidgetId.current);
        setCaptchaToken(null);
      }
    }
    setLoading(false);
  }



  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-form-container">
          <h1 className="login-title">Welcome Back 👋</h1>
          <p className="login-subtitle">
            Hệ thống quản lý học sinh.<br />
            Đăng nhập để tiếp tục.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="username">Tên đăng nhập</label>
              <input
                id="username"
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>

            <div className="login-field">
              <div className="login-field-header">
                <label htmlFor="password">Mật khẩu</label>
                <a href="#" className="forgot-link">Quên mật khẩu?</a>
              </div>
              <input
                id="password"
                type="password"
                placeholder="Ít nhất 8 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <div ref={recaptchaRef}></div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="login-divider">
            <span>Hoặc</span>
          </div>

          <button onClick={loginWithGoogle} type="button" className="google-auth-btn">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Đăng nhập bằng Google
          </button>


        </div>
      </div>
    </div>
  );
}
