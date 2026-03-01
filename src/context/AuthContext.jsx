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
        // Match with users table
        const { data } = await supabase.from('users').select('*').eq('email', email).single();
        if (data) {
          setUser(data);
          localStorage.setItem('qlhs_user', JSON.stringify(data));
        } else {
          // Auto-create user with default role if not found
          const newUser = {
            username: email.split('@')[0],
            name: session.user.user_metadata?.full_name || email.split('@')[0],
            email: email,
            role: 'giaovien',
            password: '',
          };
          const { data: created, error } = await supabase.from('users').insert(newUser).select().single();
          if (!error && created) {
            setUser(created);
            localStorage.setItem('qlhs_user', JSON.stringify(created));
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(username, password) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    }

    setUser(data);
    localStorage.setItem('qlhs_user', JSON.stringify(data));
    return { success: true, user: data };
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
