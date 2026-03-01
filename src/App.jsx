import { useState } from 'react';
import { AuthProvider, useAuth, ROLE_PERMISSIONS } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentManagement from './components/StudentManagement';
import ClassManagement from './components/ClassManagement';
import SubjectManagement from './components/SubjectManagement';
import AssignmentPage from './components/AssignmentPage';
import PublicScorePage from './components/PublicScorePage';

const pages = {
  dashboard: Dashboard,
  students: StudentManagement,
  classes: ClassManagement,
  subjects: SubjectManagement,
  assignments: AssignmentPage,
};

function AppContent() {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check for public page
  const params = new URLSearchParams(window.location.search);
  const publicToken = params.get('public');
  if (publicToken) {
    return <PublicScorePage token={publicToken} />;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Ensure active page is allowed for this role
  const perms = ROLE_PERMISSIONS[user.role] || [];
  const currentPage = perms.includes(activePage) ? activePage : perms[0] || 'dashboard';
  const PageComponent = pages[currentPage] || Dashboard;

  return (
    <div className="app-layout">
      <Sidebar
        activePage={currentPage}
        onNavigate={setActivePage}
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
      />
      <main className="main-content">
        <PageComponent />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
