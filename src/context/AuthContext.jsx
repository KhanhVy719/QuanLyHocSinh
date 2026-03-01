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
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
