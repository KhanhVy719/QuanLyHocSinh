import { useState, useEffect } from 'react';
import { UserCog, Users, School, Check, Plus, Trash2, UserPlus, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import KokomiLoading from './KokomiLoading';

export default function AssignmentPage() {
  const { user } = useAuth();

  if (user?.role === 'admin') return <AdminAssignment />;
  if (user?.role === 'giaovien') return <TeacherAssignment user={user} />;
  return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Bạn không có quyền truy cập trang này.</div>;
}

/* ===== ADMIN: Assign teacher → class + account management ===== */
function AdminAssignment() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  // Modal for creating/editing teacher account
  const [modal, setModal] = useState(null); // null | 'create' | { editing: teacherObj }
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [teacherRes, classRes] = await Promise.all([
        supabase.rpc('get_teachers'),
        supabase.from('classes').select('*').order('code'),
      ]);
      setTeachers(teacherRes.data || []);
      setClasses(classRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  async function assignClass(teacherId, className) {
    setSaving(teacherId);
    const val = className === '' ? null : className;
    const { error } = await supabase.rpc('assign_class', { p_teacher_id: teacherId, p_class: val });
    if (error) console.error('Error:', error);
    else setTeachers((prev) => prev.map((t) => (t.id === teacherId ? { ...t, assigned_class: val } : t)));
    setSaving(null);
  }

  function openCreateModal() {
    setModal('create');
    setForm({ name: '', username: '', email: '', password: '' });
    setFormError('');
  }

  function openEditModal(teacher) {
    setModal({ editing: teacher });
    setForm({ name: teacher.name, username: teacher.username, email: teacher.email || '', password: '' });
    setFormError('');
  }

  async function handleSave() {
    if (!form.name || !form.username) { setFormError('Vui lòng nhập tên và tên đăng nhập'); return; }
    if (modal === 'create' && !form.password) { setFormError('Vui lòng nhập mật khẩu'); return; }
    if (form.password && form.password.length < 6) { setFormError('Mật khẩu phải ít nhất 6 ký tự'); return; }
    setSaving('modal');
    setFormError('');

    if (modal === 'create') {
      const { data, error } = await supabase.rpc('create_user', {
        p_username: form.username, p_name: form.name,
        p_password: form.password, p_role: 'giaovien',
        p_email: form.email || '', p_assigned_class: null,
      });
      if (error) {
        setFormError(error.message.includes('duplicate') ? 'Tên đăng nhập đã tồn tại' : 'Lỗi: ' + error.message);
        setSaving(null); return;
      }
      setTeachers(prev => [...prev, data?.[0] || data]);
    } else {
      // Editing
      const updates = { name: form.name, username: form.username, email: form.email || null };
      if (form.password) updates.password = form.password;
      const { error } = await supabase.rpc('update_user', { p_id: modal.editing.id, p_data: updates });
      if (error) {
        setFormError(error.message.includes('duplicate') ? 'Tên đăng nhập đã tồn tại' : 'Lỗi: ' + error.message);
        setSaving(null); return;
      }
      setTeachers(prev => prev.map(t => t.id === modal.editing.id ? { ...t, ...updates } : t));
    }
    setModal(null);
    setSaving(null);
  }

  async function deleteTeacher(teacher) {
    const ok = window.confirm(`Xóa giáo viên "${teacher.name}"? Tài khoản sẽ bị xóa vĩnh viễn.`);
    if (!ok) return;
    setSaving(teacher.id);
    try {
      await supabase.rpc('delete_user', { p_id: teacher.id });
      setTeachers(prev => prev.filter(t => t.id !== teacher.id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Lỗi khi xóa giáo viên: ' + (err.message || 'Unknown'));
    }
    setSaving(null);
  }

  const classNames = classes.map((c) => c.name.replace('Lớp ', ''));
  const assignedClasses = teachers.filter((t) => t.assigned_class).map((t) => t.assigned_class);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h2>Phân công giáo viên</h2><p>Quản lý tài khoản và phân công lớp cho giáo viên</p></div>
        <button onClick={openCreateModal} style={{
          padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)',
          color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem',
        }}><Plus size={16} /> Thêm giáo viên</button>
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-info"><label>Tổng giáo viên</label><div className="stat-value">{teachers.length}</div></div><div className="stat-icon blue"><Users size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Đã phân công</label><div className="stat-value" style={{ color: 'var(--success)' }}>{assignedClasses.length}</div></div><div className="stat-icon green"><Check size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Chưa phân công</label><div className="stat-value" style={{ color: 'var(--warning)' }}>{teachers.length - assignedClasses.length}</div></div><div className="stat-icon orange"><UserCog size={24} /></div></div>
      </div>
      {loading ? (
        <KokomiLoading text="Đang tải giáo viên..." />
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Giáo viên</th><th>Tài khoản</th><th>Email</th><th>Lớp phân công</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td><code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontSize: '0.82rem' }}>{t.username}</code></td>
                  <td>{t.email || <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                  <td>
                    <select className="filter-select" value={t.assigned_class || ''} onChange={(e) => assignClass(t.id, e.target.value)} disabled={saving === t.id} style={{ minWidth: 140 }}>
                      <option value="">-- Chọn lớp --</option>
                      {classNames.map((cn) => (
                        <option key={cn} value={cn} disabled={assignedClasses.includes(cn) && t.assigned_class !== cn}>
                          {cn} {assignedClasses.includes(cn) && t.assigned_class !== cn ? '(đã có GV)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{t.assigned_class ? <span className="badge success">Đã phân công</span> : <span className="badge warning">Chưa phân công</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {saving === t.id ? <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>Đang lưu...</span> : (
                        <>
                          <button className="btn-edit" onClick={() => openEditModal(t)} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>Sửa</button>
                          {t.assigned_class && <button className="btn-delete" onClick={() => assignClass(t.id, '')} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>Bỏ lớp</button>}
                          <button onClick={() => deleteTeacher(t)} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 6, border: 'none', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer', fontWeight: 600 }}>Xóa</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>Chưa có giáo viên nào</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal tạo/sửa tài khoản giáo viên */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>{modal === 'create' ? 'Thêm giáo viên mới' : 'Sửa thông tin giáo viên'}</h3>
            <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '0.9rem' }}>
              {modal === 'create' ? 'Tạo tài khoản đăng nhập cho giáo viên' : `Cập nhật thông tin cho ${modal.editing.name}`}
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>Họ và tên *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.95rem', boxSizing: 'border-box' }}
                placeholder="VD: Nguyễn Văn A" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>Tên đăng nhập *</label>
              <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.95rem', boxSizing: 'border-box' }}
                placeholder="VD: gv_nguyenvana" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.95rem', boxSizing: 'border-box' }}
                placeholder="VD: gv@school.edu.vn" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>
                Mật khẩu {modal === 'create' ? '*' : '(để trống nếu không đổi)'}
              </label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.95rem', boxSizing: 'border-box' }}
                placeholder="Ít nhất 6 ký tự" />
            </div>
            {formError && <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: 14, padding: '8px 12px', background: '#FEF2F2', borderRadius: 8 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Hủy</button>
              <button onClick={handleSave} disabled={saving === 'modal'}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: saving === 'modal' ? 0.7 : 1 }}>
                {saving === 'modal' ? 'Đang lưu...' : modal === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== TEACHER: Group management + tổ trưởng ===== */

// Helper: get/set groups from Supabase class_groups table (fallback: derive from students)
async function getStoredGroups(className) {
  try {
    const { data, error } = await supabase.from('class_groups').select('group_name').eq('class_name', className);
    if (error) return []; // table might not exist
    return (data || []).map(r => r.group_name);
  } catch { return []; }
}

async function saveGroupToDb(className, groupName) {
  try {
    await supabase.from('class_groups').upsert({ class_name: className, group_name: groupName }, { onConflict: 'class_name,group_name' });
  } catch { /* table might not exist */ }
}

async function removeGroupFromDb(className, groupName) {
  try {
    await supabase.from('class_groups').delete().eq('class_name', className).eq('group_name', groupName);
  } catch { /* ignore */ }
}

function TeacherAssignment({ user }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignedClass, setAssignedClass] = useState(null);
  const [groupNames, setGroupNames] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [hasGroupColumn, setHasGroupColumn] = useState(true);
  // Modal for tổ trưởng account
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [formError, setFormError] = useState('');
  // Modal for adding students to group
  const [addModal, setAddModal] = useState(null);
  const [addModalSelected, setAddModalSelected] = useState([]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: freshUsers } = await supabase.rpc('get_user_by_id', { p_id: user.id });
      const freshUser = freshUsers?.[0] || null;
      const currentClass = freshUser?.assigned_class || null;
      setAssignedClass(currentClass);
      if (freshUser) localStorage.setItem('qlhs_user', JSON.stringify(freshUser));
      if (!currentClass) { setLoading(false); return; }

      const { data, error } = await supabase.from('students').select('*').eq('class', currentClass).order('id');
      if (error) { console.error('Error:', error); setLoading(false); return; }

      const studentList = data || [];
      // Check if group_name column exists
      const hasCol = studentList.length === 0 || Object.prototype.hasOwnProperty.call(studentList[0], 'group_name');
      setHasGroupColumn(hasCol);

      setStudents(studentList);

      // Load groups: merge from Supabase class_groups + student data
      const storedGroups = await getStoredGroups(currentClass);
      const dbGroups = hasCol ? [...new Set(studentList.map(s => s.group_name).filter(Boolean))] : [];
      const allGroups = [...new Set([...storedGroups, ...dbGroups])];
      setGroupNames(allGroups);

      setLoading(false);
    }
    init();
  }, [user.id]);

  async function addGroup() {
    const input = newGroupName.trim();
    if (!input) return;

    // Support range: "Tổ 1-4" → Tổ 1, Tổ 2, Tổ 3, Tổ 4
    const rangeMatch = input.match(/^(.+?)\s*(\d+)\s*-\s*(\d+)$/);
    let names = [];
    if (rangeMatch) {
      const prefix = rangeMatch[1].trim();
      const start = parseInt(rangeMatch[2]);
      const end = parseInt(rangeMatch[3]);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        names.push(`${prefix} ${i}`);
      }
    } else {
      // Support comma-separated: "Tổ 1, Tổ 2, Tổ 3"
      names = input.split(',').map(n => n.trim()).filter(Boolean);
    }

    const newNames = names.filter(n => !groupNames.includes(n));
    if (newNames.length === 0) return;

    setGroupNames(prev => [...prev, ...newNames]);
    setNewGroupName('');
    if (assignedClass) {
      for (const n of newNames) await saveGroupToDb(assignedClass, n);
    }
  }

  async function deleteGroup(gName) {
    if (!confirm(`Xóa "${gName}"? Các học sinh sẽ trở về chưa phân tổ.`)) return;
    setSaving(true);
    const members = students.filter(s => s.group_name === gName);
    for (const s of members) {
      if (hasGroupColumn) {
        await supabase.from('students').update({ group_name: null, ...(s.status === 'Tổ trưởng' ? { status: 'Đang học' } : {}) }).eq('id', s.id);
      }
      if (s.status === 'Tổ trưởng') {
        await supabase.rpc('delete_user_by_name_role', { p_name: s.name, p_role: 'totruong' });
      }
    }
    setStudents(prev => prev.map(s => s.group_name === gName
      ? { ...s, group_name: null, status: s.status === 'Tổ trưởng' ? 'Đang học' : s.status }
      : s
    ));
    setGroupNames(prev => prev.filter(g => g !== gName));
    if (assignedClass) await removeGroupFromDb(assignedClass, gName);
    setSaving(false);
  }

  async function addStudentToGroup(studentId, groupName) {
    setSaving(true);
    if (hasGroupColumn) {
      const { error } = await supabase.from('students').update({ group_name: groupName }).eq('id', studentId);
      if (error) { console.error('Error adding to group:', error); setSaving(false); return; }
    }
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, group_name: groupName } : s));
    setSaving(false);
  }

  async function removeFromGroup(studentId) {
    setSaving(true);
    const student = students.find(s => s.id === studentId);
    if (student?.status === 'Tổ trưởng') {
      if (hasGroupColumn) await supabase.from('students').update({ status: 'Đang học', group_name: null }).eq('id', studentId);
      else await supabase.from('students').update({ status: 'Đang học' }).eq('id', studentId);
      await supabase.rpc('delete_user_by_name_role', { p_name: student.name, p_role: 'totruong' });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, group_name: null, status: 'Đang học' } : s));
    } else {
      if (hasGroupColumn) await supabase.from('students').update({ group_name: null }).eq('id', studentId);
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, group_name: null } : s));
    }
    setSaving(false);
  }

  // --- Tổ trưởng ---
  function openLeaderModal(student) {
    setModal({ studentId: student.id, studentName: student.name });
    setFormData({ username: student.id.toLowerCase(), email: '', password: '' });
    setFormError('');
  }

  async function handleAssignLeader() {
    if (!formData.username || !formData.password) { setFormError('Vui lòng nhập tên đăng nhập và mật khẩu'); return; }
    if (formData.password.length < 6) { setFormError('Mật khẩu phải ít nhất 6 ký tự'); return; }
    setSaving(true); setFormError('');
    const { error: userError } = await supabase.rpc('create_user', {
      p_username: formData.username, p_password: formData.password, p_name: modal.studentName,
      p_email: formData.email || '', p_role: 'totruong', p_assigned_class: assignedClass,
    });
    if (userError) {
      setFormError(userError.code === '23505' ? 'Tên đăng nhập đã tồn tại' : 'Lỗi: ' + userError.message);
      setSaving(false); return;
    }
    await supabase.from('students').update({ status: 'Tổ trưởng' }).eq('id', modal.studentId);
    setStudents(prev => prev.map(s => s.id === modal.studentId ? { ...s, status: 'Tổ trưởng' } : s));
    setModal(null);
    setSaving(false);
  }

  async function removeLeader(studentId) {
    setSaving(true);
    const student = students.find(s => s.id === studentId);
    if (student) await supabase.rpc('delete_user_by_name_role', { p_name: student.name, p_role: 'totruong' });
    await supabase.from('students').update({ status: 'Đang học' }).eq('id', studentId);
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: 'Đang học' } : s));
    setSaving(false);
  }

  // --- UI ---
  const unassigned = students.filter(s => !s.group_name);
  const monitors = students.filter(s => s.status === 'Tổ trưởng');

  if (loading) return <div><div className="page-header"><h2>Phân công lớp</h2></div><KokomiLoading text="Đang tải dữ liệu lớp..." /></div>;
  if (!assignedClass) return <div><div className="page-header"><h2>Phân công lớp</h2></div><div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Bạn chưa được phân công lớp nào. Liên hệ Admin.</div></div>;

  const cardStyle = { background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: 16 };
  const cardHeaderStyle = (color) => ({ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: color, color: '#fff', fontWeight: 700, fontSize: '0.95rem' });
  const memberRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #F3F4F6', gap: 8 };
  const btnSm = (bg) => ({ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#fff', background: bg });
  const groupColors = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#BE185D', '#065F46'];

  return (
    <div>
      <div className="page-header">
        <h2>Phân công lớp {assignedClass}</h2>
        <p>Tạo tổ, thêm học sinh vào tổ và chỉ định tổ trưởng</p>
      </div>

      {!hasGroupColumn && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem', color: '#92400E' }}>
          ⚠️ Cột <code>group_name</code> chưa được thêm vào bảng students. Vui lòng chạy SQL:
          <code style={{ display: 'block', margin: '8px 0', padding: 8, background: '#FFF7ED', borderRadius: 6 }}>
            ALTER TABLE students ADD COLUMN IF NOT EXISTS group_name TEXT DEFAULT NULL;
          </code>
          Phân tổ tạm lưu trên trình duyệt, sẽ mất khi đổi máy.
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-info"><label>Tổng học sinh</label><div className="stat-value">{students.length}</div></div><div className="stat-icon blue"><Users size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Số tổ</label><div className="stat-value" style={{ color: 'var(--primary)' }}>{groupNames.length}</div></div><div className="stat-icon purple"><School size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Tổ trưởng</label><div className="stat-value" style={{ color: 'var(--success)' }}>{monitors.length}</div></div><div className="stat-icon green"><Star size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Chưa phân tổ</label><div className="stat-value" style={{ color: 'var(--warning)' }}>{unassigned.length}</div></div><div className="stat-icon orange"><UserCog size={24} /></div></div>
      </div>

      {/* Tạo tổ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="VD: Tổ 1-4  hoặc  Tổ A, Tổ B, Tổ C" value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: '0.92rem', flex: 1, maxWidth: 340 }} />
        <button onClick={addGroup} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Tạo tổ
        </button>
      </div>

      {/* Group cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {groupNames.map((gName, idx) => {
          const members = students.filter(s => s.group_name === gName);
          const leader = members.find(s => s.status === 'Tổ trưởng');
          const color = groupColors[idx % groupColors.length];
          return (
            <div key={gName} style={cardStyle}>
              <div style={cardHeaderStyle(color)}>
                <span>{gName} ({members.length} HS)</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setAddModal(gName)} style={{ ...btnSm('rgba(255,255,255,0.25)'), display: 'flex', alignItems: 'center', gap: 4 }}>
                    <UserPlus size={13} /> Thêm
                  </button>
                  <button onClick={() => deleteGroup(gName)} style={{ ...btnSm('rgba(255,255,255,0.25)'), display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={13} /> Xóa
                  </button>
                </div>
              </div>
              {members.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: '0.88rem' }}>Chưa có học sinh. Bấm "Thêm" để thêm.</div>
              ) : members.map(s => (
                <div key={s.id} style={memberRowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', minWidth: 44 }}>{s.id}</span>
                    <span style={{ fontSize: '0.9rem' }}>{s.name}</span>
                    {s.status === 'Tổ trưởng' && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700 }}>⭐ Tổ trưởng</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.status === 'Tổ trưởng' ? (
                      <button onClick={() => removeLeader(s.id)} disabled={saving} style={btnSm('#EF4444')}>Bỏ TT</button>
                    ) : (
                      <button onClick={() => openLeaderModal(s)} disabled={saving || !!leader} title={leader ? 'Tổ đã có tổ trưởng' : ''}
                        style={{ ...btnSm(leader ? '#D1D5DB' : '#F59E0B'), cursor: leader ? 'not-allowed' : 'pointer' }}>
                        <Star size={11} style={{ marginRight: 3 }} />TT
                      </button>
                    )}
                    <button onClick={() => removeFromGroup(s.id)} disabled={saving} style={btnSm('#6B7280')}>Bỏ</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Chưa phân tổ */}
      {unassigned.length > 0 && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle('#6B7280')}><span>Chưa phân tổ ({unassigned.length} HS)</span></div>
          {unassigned.map(s => (
            <div key={s.id} style={memberRowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', minWidth: 44 }}>{s.id}</span>
                <span style={{ fontSize: '0.9rem' }}>{s.name}</span>
                <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{s.gender}</span>
                {s.status === 'Tổ trưởng' && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700 }}>⭐ Tổ trưởng</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {s.status === 'Tổ trưởng' ? (
                  <button onClick={() => removeLeader(s.id)} disabled={saving} style={btnSm('#EF4444')}>Bỏ TT</button>
                ) : (
                  <button onClick={() => openLeaderModal(s)} disabled={saving}
                    style={{ ...btnSm('#F59E0B'), display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Star size={11} /> Tổ trưởng
                  </button>
                )}
                {groupNames.length > 0 && (
                  <select onChange={e => { if (e.target.value) addStudentToGroup(s.id, e.target.value); e.target.value = ''; }} defaultValue=""
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: '0.82rem' }}>
                    <option value="">Thêm vào tổ...</option>
                    {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Thêm HS vào tổ (hàng loạt) */}
      {addModal && (() => {
        const available = unassigned;
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px' }}>Thêm học sinh vào {addModal}</h3>
            <p style={{ margin: '0 0 12px', color: '#6B7280', fontSize: '0.88rem' }}>Chọn học sinh để thêm hàng loạt</p>
            {available.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>Tất cả học sinh đã được phân tổ</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, color: '#4F46E5' }}>
                    <input type="checkbox"
                      checked={addModalSelected.length === available.length}
                      onChange={e => setAddModalSelected(e.target.checked ? available.map(s => s.id) : [])}
                      style={{ width: 16, height: 16, accentColor: '#4F46E5' }} />
                    Chọn tất cả ({available.length})
                  </label>
                  {addModalSelected.length > 0 && (
                    <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>✓ Đã chọn {addModalSelected.length}</span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'auto', maxHeight: '50vh', border: '1px solid #F3F4F6', borderRadius: 10 }}>
                  {available.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', gap: 10, background: addModalSelected.includes(s.id) ? '#EEF2FF' : '#fff', transition: 'background 0.15s' }}>
                      <input type="checkbox" checked={addModalSelected.includes(s.id)}
                        onChange={e => setAddModalSelected(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                        style={{ width: 16, height: 16, accentColor: '#4F46E5' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', minWidth: 44 }}>{s.id}</span>
                      <span style={{ fontSize: '0.9rem', flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{s.gender}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setAddModal(null); setAddModalSelected([]); }} style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Đóng</button>
              {addModalSelected.length > 0 && (
                <button disabled={saving} onClick={async () => {
                  setSaving(true);
                  for (const sid of addModalSelected) {
                    if (hasGroupColumn) await supabase.from('students').update({ group_name: addModal }).eq('id', sid);
                  }
                  setStudents(prev => prev.map(s => addModalSelected.includes(s.id) ? { ...s, group_name: addModal } : s));
                  setAddModalSelected([]);
                  setAddModal(null);
                  setSaving(false);
                }} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Đang thêm...' : `Thêm ${addModalSelected.length} học sinh`}
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal: Tạo tài khoản tổ trưởng */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>Chỉ định tổ trưởng</h3>
            <p style={{ margin: '0 0 20px', color: '#6B7280', fontSize: '0.9rem' }}>Tạo tài khoản đăng nhập cho <strong>{modal.studentName}</strong></p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>Tên đăng nhập *</label>
              <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.95rem', boxSizing: 'border-box' }} placeholder="VD: hs003" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.95rem', boxSizing: 'border-box' }} placeholder="VD: hocsinh@school.edu.vn" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>Mật khẩu *</label>
              <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.95rem', boxSizing: 'border-box' }} placeholder="Ít nhất 6 ký tự" />
            </div>
            {formError && <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: 14, padding: '8px 12px', background: '#FEF2F2', borderRadius: 8 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Hủy</button>
              <button onClick={handleAssignLeader} disabled={saving}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Đang lưu...' : 'Xác nhận & Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
