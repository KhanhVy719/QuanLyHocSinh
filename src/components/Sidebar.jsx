import {
  LayoutDashboard, Users, School,
  BookOpen, LogOut, UserCog, Menu, X, ClipboardCheck,
} from 'lucide-react';
import { useAuth, ROLE_PERMISSIONS, ROLE_LABELS } from '../context/AuthContext';

const allNavItems = [
  { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { key: 'students', label: 'Quản lý học sinh', icon: Users },
  { key: 'conduct', label: 'Xếp hạnh kiểm', icon: ClipboardCheck },
  { key: 'classes', label: 'Quản lý lớp học', icon: School },
  { key: 'subjects', label: 'Quản lý môn học', icon: BookOpen },
  { key: 'assignments', label: 'Phân công', icon: UserCog },
];

export default function Sidebar({ activePage, onNavigate, isOpen, onToggle }) {
  const { user, logout } = useAuth();
  const perms = ROLE_PERMISSIONS[user?.role] || [];
  const navItems = allNavItems.filter((item) => perms.includes(item.key));

  const handleNav = (key) => {
    onNavigate(key);
    // Auto-close sidebar on mobile after navigation
    if (window.innerWidth <= 768) onToggle(false);
  };

  return (
    <>
      {/* Mobile top bar - fixed at top, only visible on mobile */}
      {!isOpen && (
        <div className="mobile-top-bar">
          <button className="mobile-menu-btn" onClick={() => onToggle(true)} aria-label="Menu">
            <Menu size={22} />
          </button>
          <span className="mobile-top-title">Quản lý học sinh</span>
        </div>
      )}

      {/* Backdrop overlay on mobile */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={() => onToggle(false)} />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>Quản lý học sinh</h1>
          <button className="close-btn sidebar-close-mobile" onClick={() => onToggle(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`nav-item${activePage === item.key ? ' active' : ''}`}
                onClick={() => handleNav(item.key)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-avatar">{user?.name?.[0] || 'A'}</div>
          <div className="sidebar-footer-info">
            <div className="name">{user?.name || 'Admin'}</div>
            <div className="email">{ROLE_LABELS[user?.role] || ''}</div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Đăng xuất">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
