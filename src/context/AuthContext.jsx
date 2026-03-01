import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

/*
  Roles:
  - admin: Full access to everything
  - giaovien: View/manage students & grades in their assigned class
  - totruong: View subjects in their department, view reports
*/

// Which nav items each role can see
export const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'students', 'classes', 'subjects', 'assignments'],
  giaovien: ['dashboard', 'students', 'assignments'],
  totruong: ['dashboard', 'students', 'subjects'],
};

export const ROLE_LABELS = {
  admin: 'Quản trị viên',
  giaovien: 'Giáo viên',
  totruong: 'Tổ trưởng',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginRejected, setLoginRejected] = useState(false);

  useEffect(() => {
    // Check localStorage for saved session
    const saved = localStorage.getItem('qlhs_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('qlhs_user');
      }
    }
    setLoading(false);

    // Listen for Supabase Auth changes (Google OAuth redirect only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle actual sign-in events (not INITIAL_SESSION)
      // and only when no user is already logged in via username/password
      const currentUser = localStorage.getItem('qlhs_user');
      if (event === 'SIGNED_IN' && session?.user?.email && !currentUser) {
        const email = session.user.email;
        const name = session.user.user_metadata?.full_name || email.split('@')[0];
        const username = email.split('@')[0];
        // Find or create user via RPC (bypasses RLS)
        const { data, error } = await supabase.rpc('google_login', {
          p_email: email, p_name: name, p_username: username,
        });
        if (!error && data && data.length > 0) {
          setUser(data[0]);
          localStorage.setItem('qlhs_user', JSON.stringify(data[0]));
        } else {
          setLoginRejected(true);
          supabase.auth.signOut();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(username, password) {
    const { data, error } = await supabase.rpc('login_user', {
      p_username: username,
      p_password: password,
    });

    if (error || !data || data.length === 0) {
      return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    }

    const userData = data[0];
    setUser(userData);
    localStorage.setItem('qlhs_user', JSON.stringify(userData));
    return { success: true, user: userData };
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('qlhs_user');
    supabase.auth.signOut();
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  function hasAccess(page) {
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role] || [];
    return perms.includes(page);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, hasAccess }}>
      {loginRejected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Inter', sans-serif",
          animation: 'fadeIn 0.4s ease',
        }}>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes popIn { from { opacity: 0; transform: scale(0.8) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
            @keyframes shake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-5deg); } 75% { transform: rotate(5deg); } }
          `}</style>
          <div style={{
            background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)',
            borderRadius: 24, padding: '48px 40px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            maxWidth: 420, width: '90%',
            animation: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <img src="https://media1.tenor.com/m/pzFs5Ii7ZcYAAAAC/mihoyo-genshin.gif" alt="Sayu" style={{ width: 200, borderRadius: 16, marginBottom: 20, animation: 'float 3s ease-in-out infinite' }} />
            <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>
              Truy cập bị từ chối
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 24 }}>
              Tài khoản Google này <strong style={{ color: '#F87171' }}>chưa được đăng ký</strong> trong hệ thống.
              <br/>Vui lòng liên hệ quản trị viên để được cấp quyền truy cập.
            </p>
            <div style={{
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 24,
              color: '#FCA5A5', fontSize: '0.82rem',
            }}>
              ⚠️ Chỉ tài khoản được quản trị viên thêm vào mới có thể đăng nhập
            </div>
            <button
              onClick={() => setLoginRejected(false)}
              style={{
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '14px 32px', fontSize: '0.95rem', fontWeight: 600,
                cursor: 'pointer', width: '100%',
                boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseOver={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 25px rgba(99,102,241,0.5)'; }}
              onMouseOut={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(99,102,241,0.4)'; }}
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
