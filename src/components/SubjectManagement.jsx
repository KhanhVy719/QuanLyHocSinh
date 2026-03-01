import { useState, useEffect } from 'react';
import { Search, BookOpen, FolderOpen, Plus, X, Pencil, Trash2, AlertTriangle, ChevronDown, ChevronRight, Link2, Unlink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import KokomiLoading from './KokomiLoading';
import { useAuth } from '../context/AuthContext';

const emptySubject = { code: '', name: '', credits: 1, type: 'Bắt buộc', department: 'Khoa học tự nhiên', description: '' };
const typeOnly = ['Bắt buộc', 'Tự chọn'];
const deptOnly = ['Khoa học tự nhiên', 'Khoa học xã hội', 'Ngoại ngữ', 'Công nghệ'];

export default function SubjectManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseSubjects, setCourseSubjects] = useState([]); // junction
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({}); // which courses are expanded
  const [myCourseCode, setMyCourseCode] = useState(null); // for teacher/totruong

  // Subject modal
  const [subjectModal, setSubjectModal] = useState(null); // null | 'create' | { editing: subject }
  const [subjectForm, setSubjectForm] = useState({ ...emptySubject });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Course modal
  const [courseModal, setCourseModal] = useState(null); // null | 'create' | { editing: course }
  const [courseForm, setCourseForm] = useState({ code: '', name: '', description: '' });

  // Link subject to course modal
  const [linkModal, setLinkModal] = useState(null); // course_code to add subjects to

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [subRes, courseRes, csRes] = await Promise.all([
      supabase.from('subjects').select('*').order('code'),
      supabase.from('courses').select('*').order('code'),
      supabase.from('course_subjects').select('*'),
    ]);
    setSubjects(subRes.data || []);
    setCourses(courseRes.data || []);
    setCourseSubjects(csRes.data || []);

    // For non-admin: find their class's course
    if (!isAdmin && user) {
      const { data: userData } = await supabase.rpc('get_user_by_id', { p_id: user.id });
      const assignedClass = userData?.[0]?.assigned_class;
      if (assignedClass) {
        const { data: classData } = await supabase.from('classes').select('course_code').eq('name', 'L\u1edbp ' + assignedClass).single();
        if (!classData) {
          // Try matching by code
          const { data: classData2 } = await supabase.from('classes').select('course_code').eq('code', assignedClass).single();
          setMyCourseCode(classData2?.course_code || null);
        } else {
          setMyCourseCode(classData?.course_code || null);
        }
      }
    }

    // Auto expand all courses
    const exp = {};
    (courseRes.data || []).forEach(c => { exp[c.code] = true; });
    setExpanded(exp);
    setLoading(false);
  }

  // --- Subject CRUD ---
  function openAddSubject() {
    setSubjectModal('create');
    setSubjectForm({ ...emptySubject });
  }
  function openEditSubject(s) {
    setSubjectModal({ editing: s });
    setSubjectForm({ ...s });
  }
  async function saveSubject() {
    if (!subjectForm.code.trim() || !subjectForm.name.trim()) return alert('Vui lòng nhập mã và tên môn học!');
    setSaving(true);
    try {
      if (subjectModal?.editing) {
        const { error } = await supabase.from('subjects')
          .update({ name: subjectForm.name, credits: subjectForm.credits, type: subjectForm.type, department: subjectForm.department, description: subjectForm.description })
          .eq('code', subjectForm.code);
        if (error) throw error;
        setSubjects(prev => prev.map(s => s.code === subjectForm.code ? { ...subjectForm } : s));
      } else {
        if (subjects.find(s => s.code === subjectForm.code)) { setSaving(false); return alert('Mã môn học đã tồn tại!'); }
        const { error } = await supabase.from('subjects').insert(subjectForm);
        if (error) throw error;
        setSubjects(prev => [...prev, { ...subjectForm }]);
      }
      setSubjectModal(null);
    } catch (err) { alert('Lỗi: ' + err.message); }
    setSaving(false);
  }
  async function deleteSubject() {
    if (!deleteTarget) return;
    try {
      await supabase.from('course_subjects').delete().eq('subject_code', deleteTarget.code);
      const { error } = await supabase.from('subjects').delete().eq('code', deleteTarget.code);
      if (error) throw error;
      setSubjects(prev => prev.filter(s => s.code !== deleteTarget.code));
      setCourseSubjects(prev => prev.filter(cs => cs.subject_code !== deleteTarget.code));
      setDeleteTarget(null);
    } catch (err) { alert('Lỗi: ' + err.message); }
  }

  // --- Course CRUD ---
  function openAddCourse() {
    setCourseModal('create');
    setCourseForm({ code: '', name: '', description: '' });
  }
  function openEditCourse(c) {
    setCourseModal({ editing: c });
    setCourseForm({ ...c });
  }
  async function saveCourse() {
    if (!courseForm.code.trim() || !courseForm.name.trim()) return alert('Vui lòng nhập mã và tên khóa!');
    setSaving(true);
    try {
      if (courseModal?.editing) {
        const { error } = await supabase.from('courses')
          .update({ name: courseForm.name, description: courseForm.description })
          .eq('code', courseForm.code);
        if (error) throw error;
        setCourses(prev => prev.map(c => c.code === courseForm.code ? { ...courseForm } : c));
      } else {
        if (courses.find(c => c.code === courseForm.code)) { setSaving(false); return alert('Mã khóa đã tồn tại!'); }
        const { error } = await supabase.from('courses').insert(courseForm);
        if (error) throw error;
        setCourses(prev => [...prev, { ...courseForm }]);
        setExpanded(prev => ({ ...prev, [courseForm.code]: true }));
      }
      setCourseModal(null);
    } catch (err) { alert('Lỗi: ' + err.message); }
    setSaving(false);
  }
  async function deleteCourse(course) {
    if (!confirm(`Xóa khóa "${course.name}" (${course.code})? Các môn học sẽ bị gỡ khỏi khóa này.`)) return;
    try {
      const { error } = await supabase.from('courses').delete().eq('code', course.code);
      if (error) throw error;
      setCourses(prev => prev.filter(c => c.code !== course.code));
      setCourseSubjects(prev => prev.filter(cs => cs.course_code !== course.code));
    } catch (err) { alert('Lỗi: ' + err.message); }
  }

  // --- Link/Unlink subjects ---
  async function linkSubject(courseCode, subjectCode) {
    try {
      const { error } = await supabase.from('course_subjects').insert({ course_code: courseCode, subject_code: subjectCode });
      if (error) throw error;
      setCourseSubjects(prev => [...prev, { course_code: courseCode, subject_code: subjectCode }]);
    } catch (err) { alert('Lỗi: ' + err.message); }
  }
  async function unlinkSubject(courseCode, subjectCode) {
    try {
      const { error } = await supabase.from('course_subjects').delete()
        .eq('course_code', courseCode).eq('subject_code', subjectCode);
      if (error) throw error;
      setCourseSubjects(prev => prev.filter(cs => !(cs.course_code === courseCode && cs.subject_code === subjectCode)));
    } catch (err) { alert('Lỗi: ' + err.message); }
  }

  // --- Helpers ---
  function getSubjectsForCourse(courseCode) {
    const codes = courseSubjects.filter(cs => cs.course_code === courseCode).map(cs => cs.subject_code);
    return subjects.filter(s => codes.includes(s.code));
  }
  function getUnlinkedSubjects(courseCode) {
    const linked = courseSubjects.filter(cs => cs.course_code === courseCode).map(cs => cs.subject_code);
    return subjects.filter(s => !linked.includes(s.code));
  }
  const unassigned = subjects.filter(s => !courseSubjects.find(cs => cs.subject_code === s.code));

  const filteredCourses = courses.filter(c => {
    // Non-admin: only show their course
    if (!isAdmin && myCourseCode && c.code !== myCourseCode) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    if (c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) return true;
    const subs = getSubjectsForCourse(c.code);
    return subs.some(s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  });

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', transition: 'border 0.2s', background: '#FAFBFF' };
  const labelStyle = { fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };

  if (loading) return <KokomiLoading text="Đang tải dữ liệu..." />;

  // Non-admin without assigned course
  if (!isAdmin && !myCourseCode) {
    return (
      <div>
        <div className="page-header"><h2>Môn học</h2><p>Danh sách môn học theo khóa của bạn</p></div>
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
          <BookOpen size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>Lớp của bạn chưa được gán khóa học nào.</p>
          <p style={{ fontSize: '0.85rem' }}>Vui lòng liên hệ quản trị viên.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h2>{isAdmin ? 'Quản lý môn học' : 'Môn học'}</h2><p>{isAdmin ? 'Tổ chức môn học theo khóa' : 'Các môn học trong khóa của bạn'}</p></div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-info"><label>Tổng khóa</label><div className="stat-value">{courses.length}</div></div><div className="stat-icon blue"><FolderOpen size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Tổng môn học</label><div className="stat-value">{subjects.length}</div></div><div className="stat-icon green"><BookOpen size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Chưa gán khóa</label><div className="stat-value">{unassigned.length}</div></div><div className="stat-icon purple"><Unlink size={24} /></div></div>
      </div>

      {/* Actions */}
      <div className="filters-bar">
        <div className="search-input"><Search /><input type="text" placeholder="Tìm khóa hoặc môn học..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={openAddCourse} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              <Plus size={16} /> Thêm khóa
            </button>
            <button onClick={openAddSubject} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4F6BED, #7C3AED)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              <Plus size={16} /> Thêm môn
            </button>
          </div>
        )}
      </div>

      {/* Courses list */}
      {filteredCourses.map(course => {
        const subs = getSubjectsForCourse(course.code);
        const isOpen = expanded[course.code];
        return (
          <div key={course.code} style={{ marginBottom: 16, borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {/* Course header */}
            <div
              onClick={() => setExpanded(prev => ({ ...prev, [course.code]: !prev[course.code] }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px',
                background: 'linear-gradient(135deg, #F0F9FF, #EDE9FE)', cursor: 'pointer', userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {isOpen ? <ChevronDown size={20} color="#6366F1" /> : <ChevronRight size={20} color="#6366F1" />}
                <div style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff',
                  padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', letterSpacing: 1,
                }}>{course.code}</div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1F2937', fontSize: '0.95rem' }}>{course.name}</div>
                  {course.description && <div style={{ color: '#6B7280', fontSize: '0.78rem' }}>{course.description}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.82rem', color: '#6366F1', fontWeight: 600, background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 6 }}>
                  {subs.length} môn
                </span>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setLinkModal(course.code)} style={{ background: 'rgba(16,185,129,0.1)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#10B981', display: 'flex' }} title="Thêm môn vào khóa"><Link2 size={16} /></button>
                    <button onClick={() => openEditCourse(course)} style={{ background: 'rgba(99,102,241,0.1)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#6366F1', display: 'flex' }} title="Sửa khóa"><Pencil size={16} /></button>
                    <button onClick={() => deleteCourse(course)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#EF4444', display: 'flex' }} title="Xóa khóa"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            </div>

            {/* Subjects in course */}
            {isOpen && (
              <div style={{ padding: '0 20px 16px' }}>
                {subs.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>
                    Chưa có môn học nào trong khóa này
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', marginTop: 8 }}>
                    <thead>
                      <tr style={{ fontSize: '0.78rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Mã</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tên môn</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Tín chỉ</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Loại</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tổ bộ môn</th>
                        {isAdmin && <th style={{ padding: '8px 12px', textAlign: 'center' }}>Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map(s => (
                        <tr key={s.code} style={{ background: '#F8FAFC', borderRadius: 8 }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#4F6BED', fontSize: '0.85rem' }}>{s.code}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1F2937' }}>{s.name}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600 }}>{s.credits}</span></td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ background: s.type === 'Bắt buộc' ? '#D1FAE5' : '#E0E7FF', color: s.type === 'Bắt buộc' ? '#065F46' : '#3730A3', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 500 }}>{s.type}</span></td>
                          <td style={{ padding: '10px 12px', color: '#6B7280', fontSize: '0.85rem' }}>{s.department}</td>
                          {isAdmin && (
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button onClick={() => openEditSubject(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', padding: 4 }} title="Sửa"><Pencil size={14} /></button>
                                <button onClick={() => unlinkSubject(course.code, s.code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F59E0B', padding: 4 }} title="Gỡ khỏi khóa"><Unlink size={14} /></button>
                                <button onClick={() => setDeleteTarget(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }} title="Xóa môn"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned subjects */}
      {unassigned.length > 0 && (
        <div style={{ marginTop: 24, borderRadius: 16, border: '1px dashed #D1D5DB', overflow: 'hidden', background: '#FEFCE8' }}>
          <div style={{ padding: '16px 20px', background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Unlink size={18} color="#D97706" />
              <span style={{ fontWeight: 600, color: '#92400E' }}>Môn chưa gán khóa ({unassigned.length})</span>
            </div>
          </div>
          <div style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {unassigned.map(s => (
                <div key={s.code} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: '0.85rem',
                }}>
                  <span style={{ fontWeight: 600, color: '#4F6BED' }}>{s.code}</span>
                  <span style={{ color: '#374151' }}>{s.name}</span>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => openEditSubject(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', padding: 2 }}><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {filteredCourses.length === 0 && unassigned.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
          <FolderOpen size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>Chưa có khóa hoặc môn học nào</p>
        </div>
      )}

      {/* === MODALS === */}

      {/* Subject Modal */}
      {subjectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0 }}>{subjectModal?.editing ? '✏️ Sửa môn học' : '➕ Thêm môn học'}</h3>
              <button onClick={() => setSubjectModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={labelStyle}>Mã môn *</label><input style={inputStyle} value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} placeholder="VD: TOAN10" disabled={!!subjectModal?.editing} /></div>
                <div><label style={labelStyle}>Tên môn *</label><input style={inputStyle} value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="VD: Toán học" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div><label style={labelStyle}>Tín chỉ</label><input type="number" min={1} max={10} style={inputStyle} value={subjectForm.credits} onChange={e => setSubjectForm({ ...subjectForm, credits: Number(e.target.value) })} /></div>
                <div><label style={labelStyle}>Loại</label><select style={inputStyle} value={subjectForm.type} onChange={e => setSubjectForm({ ...subjectForm, type: e.target.value })}>{typeOnly.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label style={labelStyle}>Tổ bộ môn</label><select style={inputStyle} value={subjectForm.department} onChange={e => setSubjectForm({ ...subjectForm, department: e.target.value })}>{deptOnly.map(d => <option key={d}>{d}</option>)}</select></div>
              </div>
              <div><label style={labelStyle}>Mô tả</label><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={subjectForm.description} onChange={e => setSubjectForm({ ...subjectForm, description: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setSubjectModal(null)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
              <button onClick={saveSubject} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4F6BED, #7C3AED)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Đang lưu...' : subjectModal?.editing ? 'Cập nhật' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Modal */}
      {courseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0 }}>{courseModal?.editing ? '✏️ Sửa khóa' : '📦 Tạo khóa mới'}</h3>
              <button onClick={() => setCourseModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={labelStyle}>Mã khóa *</label><input style={inputStyle} value={courseForm.code} onChange={e => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="VD: A01" disabled={!!courseModal?.editing} /></div>
              <div><label style={labelStyle}>Tên khóa *</label><input style={inputStyle} value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="VD: Khoa học tự nhiên" /></div>
              <div><label style={labelStyle}>Mô tả</label><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setCourseModal(null)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
              <button onClick={saveCourse} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Đang lưu...' : courseModal?.editing ? 'Cập nhật' : 'Tạo khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Subject Modal */}
      {linkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>🔗 Thêm môn vào khóa {linkModal}</h3>
              <button onClick={() => setLinkModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>
            {(() => {
              const available = getUnlinkedSubjects(linkModal);
              return available.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Tất cả môn đã được thêm vào khóa này</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {available.map(s => (
                    <div key={s.code} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E5E7EB',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#4F6BED', marginRight: 8 }}>{s.code}</span>
                        <span style={{ color: '#374151' }}>{s.name}</span>
                      </div>
                      <button onClick={() => linkSubject(linkModal, s.code)} style={{
                        background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 8,
                        padding: '6px 14px', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                      }}>
                        <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Thêm
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Delete Subject Modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 36, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={28} color="#EF4444" />
            </div>
            <h3 style={{ margin: '0 0 8px' }}>Xóa môn học?</h3>
            <p style={{ color: '#6B7280', fontSize: '0.88rem' }}><strong>{deleteTarget.name}</strong> ({deleteTarget.code})</p>
            <p style={{ color: '#EF4444', fontSize: '0.82rem', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8, marginBottom: 20 }}>⚠️ Sẽ gỡ khỏi tất cả khóa và xóa vĩnh viễn</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '10px 28px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
              <button onClick={deleteSubject} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
