import { useState, useEffect } from 'react';
import { Search, School, Users, UserCheck, Pencil, Trash2, Plus, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import KokomiLoading from './KokomiLoading';

const khois = ['Tất cả khối', 'Khối 10', 'Khối 11', 'Khối 12'];

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [khoiFilter, setKhoiFilter] = useState('Tất cả khối');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', teacher: '', room: '', max_students: 45, schedule: '' });

  useEffect(() => { fetchClasses(); }, []);

  async function fetchClasses() {
    setLoading(true);
    const { data, error } = await supabase.from('classes').select('*').order('code');
    if (error) console.error('Error:', error);
    else {
      const { data: students } = await supabase.from('students').select('class');
      const counts = {};
      (students || []).forEach((s) => { counts[s.class] = (counts[s.class] || 0) + 1; });
      const enriched = (data || []).map((c) => {
        const className = c.name.replace('Lớp ', '');
        return { ...c, students: counts[className] || 0 };
      });
      setClasses(enriched);
    }
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ code: '', name: '', teacher: '', room: '', max_students: 45, schedule: '' });
    setShowModal(true);
  }

  function openEdit(cls) {
    setEditing(cls);
    setForm({ code: cls.code, name: cls.name, teacher: cls.teacher, room: cls.room, max_students: cls.max_students, schedule: cls.schedule || '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) return alert('Vui lòng nhập mã lớp và tên lớp!');
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('classes')
          .update({ name: form.name, teacher: form.teacher, room: form.room, max_students: form.max_students, schedule: form.schedule })
          .eq('code', form.code);
        if (error) throw error;
        setClasses(prev => prev.map(c => c.code === form.code ? { ...c, ...form } : c));
      } else {
        const { error } = await supabase.from('classes').insert(form);
        if (error) throw error;
        setClasses(prev => [...prev, { ...form, students: 0 }]);
      }
      setShowModal(false);
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
    setSaving(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('classes').delete().eq('code', deleteTarget.code);
      if (error) throw error;
      setClasses(prev => prev.filter(c => c.code !== deleteTarget.code));
      setDeleteTarget(null);
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  }

  const totalStudents = classes.reduce((s, c) => s + c.students, 0);
  const avgStudents = classes.length > 0 ? Math.round(totalStudents / classes.length) : 0;

  const filtered = classes.filter((c) => {
    const ms = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()) || c.teacher.toLowerCase().includes(search.toLowerCase());
    let mk = true;
    if (khoiFilter === 'Khối 10') mk = c.name.includes('10');
    else if (khoiFilter === 'Khối 11') mk = c.name.includes('11');
    else if (khoiFilter === 'Khối 12') mk = c.name.includes('12');
    return ms && mk;
  });

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB',
    fontSize: '0.92rem', fontFamily: 'Inter, sans-serif', outline: 'none', transition: 'border 0.2s',
    background: '#FAFBFF',
  };
  const labelStyle = { display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.82rem', color: '#4B5563' };

  return (
    <div>
      <div className="page-header">
        <h2>Quản lý lớp học</h2>
        <p>Danh sách tất cả các lớp học trong trường</p>
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-info"><label>Tổng số lớp</label><div className="stat-value">{classes.length}</div></div><div className="stat-icon blue"><School size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Tổng học sinh</label><div className="stat-value">{totalStudents}</div></div><div className="stat-icon green"><Users size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Sĩ số trung bình</label><div className="stat-value">{avgStudents}</div></div><div className="stat-icon purple"><UserCheck size={24} /></div></div>
      </div>
      <div className="filters-bar">
        <div className="search-input"><Search /><input type="text" placeholder="Tìm kiếm theo tên lớp, mã lớp hoặc giáo viên..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="filter-select" value={khoiFilter} onChange={(e) => setKhoiFilter(e.target.value)}>{khois.map((k) => <option key={k}>{k}</option>)}</select>
        <button onClick={openAdd} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
          <Plus size={18} /> Thêm lớp
        </button>
      </div>
      {loading ? (
        <KokomiLoading text="Đang tải lớp học..." />
      ) : (
        <div className="cards-grid">
          {filtered.map((c) => (
            <div className="item-card" key={c.code}>
              <div className="item-card-header">
                <div><div className="card-code">{c.code}</div><div className="card-title">{c.name}</div></div>
                <div className="card-count"><div className="number">{c.students}</div><div className="label">học sinh</div></div>
              </div>
              <div className="item-card-body">
                <div className="detail-row"><span>Giáo viên:</span><strong>{c.teacher}</strong></div>
                <div className="detail-row"><span>Phòng học:</span><strong>{c.room}</strong></div>
                <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                  <span>Sĩ số:</span>
                  <div className="progress-bar-wrapper">
                    <span>{c.students}/{c.max_students}</span>
                    <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${(c.students / c.max_students) * 100}%` }} /></div>
                  </div>
                </div>
                <div className="detail-row"><span>{c.schedule}</span></div>
              </div>
              <div className="item-card-footer">
                <button className="btn-edit" onClick={() => openEdit(c)}><Pencil size={14} /> Sửa</button>
                <button className="btn-delete" onClick={() => setDeleteTarget(c)}><Trash2 size={14} /> Xóa</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Không tìm thấy lớp nào</div>
          )}
        </div>
      )}

      {/* Modal Thêm/Sửa lớp */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{editing ? '✏️ Sửa lớp học' : '➕ Thêm lớp mới'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Mã lớp *</label>
                <input style={{ ...inputStyle, background: editing ? '#F3F4F6' : '#FAFBFF' }} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!!editing} placeholder="VD: CLS007" />
              </div>
              <div>
                <label style={labelStyle}>Tên lớp *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Lớp 10A3" />
              </div>
              <div>
                <label style={labelStyle}>Giáo viên chủ nhiệm</label>
                <input style={inputStyle} value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })} placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label style={labelStyle}>Phòng học</label>
                <input style={inputStyle} value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="VD: P301" />
              </div>
              <div>
                <label style={labelStyle}>Sĩ số tối đa</label>
                <input style={inputStyle} type="number" value={form.max_students} onChange={e => setForm({ ...form, max_students: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={labelStyle}>Lịch học</label>
                <input style={inputStyle} value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} placeholder="VD: Sáng T2-T6" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#6B7280' }}>Hủy</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: saving ? '#9CA3AF' : 'var(--primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xóa */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={28} color="#EF4444" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', color: '#1F2937' }}>Xác nhận xóa lớp học</h3>
            <p style={{ margin: '0 0 6px', color: '#6B7280', fontSize: '0.92rem' }}>
              Bạn có chắc muốn xóa lớp:
            </p>
            <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: '1.05rem', color: '#1F2937' }}>
              {deleteTarget.name} ({deleteTarget.code})
            </p>
            {deleteTarget.students > 0 && (
              <p style={{ margin: '0 0 16px', color: '#EF4444', fontSize: '0.82rem', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>
                ⚠️ Lớp này có {deleteTarget.students} học sinh
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '10px 28px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#6B7280' }}>Hủy</button>
              <button onClick={confirmDelete} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Xóa lớp</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
