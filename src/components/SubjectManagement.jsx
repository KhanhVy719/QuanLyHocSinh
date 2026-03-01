import { useState, useEffect } from 'react';
import { Search, BookOpen, BookMarked, BookPlus, Pencil, Trash2, Plus, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import KokomiLoading from './KokomiLoading';
import { useAuth } from '../context/AuthContext';

const typeOpts = ['Tất cả loại', 'Bắt buộc', 'Tự chọn'];
const typeOnly = ['Bắt buộc', 'Tự chọn'];
const deptOpts = ['Tất cả tổ bộ môn', 'Khoa học tự nhiên', 'Khoa học xã hội', 'Ngoại ngữ', 'Công nghệ'];
const deptOnly = ['Khoa học tự nhiên', 'Khoa học xã hội', 'Ngoại ngữ', 'Công nghệ'];

const emptyForm = { code: '', name: '', credits: 1, type: 'Bắt buộc', department: 'Khoa học tự nhiên', description: '' };

export default function SubjectManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tf, setTf] = useState('Tất cả loại');
  const [df, setDf] = useState('Tất cả tổ bộ môn');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { fetchSubjects(); }, []);

  async function fetchSubjects() {
    setLoading(true);
    const { data, error } = await supabase.from('subjects').select('*').order('code');
    if (error) console.error('Error:', error);
    else setSubjects(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(subject) {
    setEditing(subject);
    setForm({ ...subject });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.code.trim()) return alert('Vui lòng nhập mã môn học!');
    if (!form.name.trim()) return alert('Vui lòng nhập tên môn học!');
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('subjects')
          .update({ name: form.name, credits: form.credits, type: form.type, department: form.department, description: form.description })
          .eq('code', form.code);
        if (error) throw error;
        setSubjects(prev => prev.map(s => s.code === form.code ? { ...form } : s));
      } else {
        const exists = subjects.find(s => s.code === form.code);
        if (exists) { setSaving(false); return alert('Mã môn học đã tồn tại!'); }
        const { error } = await supabase.from('subjects').insert(form);
        if (error) throw error;
        setSubjects(prev => [...prev, { ...form }]);
      }
      setShowModal(false);
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('subjects').delete().eq('code', deleteTarget.code);
      if (error) throw error;
      setSubjects(prev => prev.filter(s => s.code !== deleteTarget.code));
      setDeleteTarget(null);
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  }

  const filtered = subjects.filter((s) => {
    const ms = s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase());
    const mt = tf === 'Tất cả loại' || s.type === tf;
    const md = df === 'Tất cả tổ bộ môn' || s.department === df;
    return ms && mt && md;
  });

  const batBuoc = subjects.filter((s) => s.type === 'Bắt buộc').length;
  const tuChon = subjects.filter((s) => s.type === 'Tự chọn').length;
  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', transition: 'border 0.2s' };

  return (
    <div>
      <div className="page-header"><h2>Quản lý môn học</h2><p>Danh sách tất cả môn học trong trường</p></div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-info"><label>Tổng môn học</label><div className="stat-value">{subjects.length}</div></div><div className="stat-icon blue"><BookOpen size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Môn bắt buộc</label><div className="stat-value">{batBuoc}</div></div><div className="stat-icon green"><BookMarked size={24} /></div></div>
        <div className="stat-card"><div className="stat-info"><label>Môn tự chọn</label><div className="stat-value">{tuChon}</div></div><div className="stat-icon purple"><BookPlus size={24} /></div></div>
      </div>
      <div className="filters-bar">
        <div className="search-input"><Search /><input type="text" placeholder="Tìm kiếm theo tên hoặc mã môn học..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="filter-select" value={tf} onChange={(e) => setTf(e.target.value)}>{typeOpts.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="filter-select" value={df} onChange={(e) => setDf(e.target.value)}>{deptOpts.map((d) => <option key={d}>{d}</option>)}</select>
        {isAdmin && (
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4F6BED, #7C3AED)', color: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,107,237,0.3)' }}>
            <Plus size={16} /> Thêm môn
          </button>
        )}
      </div>
      {loading ? (
        <KokomiLoading text="Đang tải môn học..." />
      ) : (
        <div className="cards-grid">
          {filtered.map((s) => (
            <div className="item-card" key={s.code}>
              <div className="item-card-header">
                <div><div className="card-code">{s.code}</div><div className="card-title">{s.name}</div></div>
                {isAdmin && <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(s)} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }} title="Sửa"><Pencil size={16} /></button>
                  <button onClick={() => setDeleteTarget(s)} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }} title="Xóa"><Trash2 size={16} /></button>
                </div>}
              </div>
              <div className="item-card-body">
                <div className="detail-row"><span>Số tín chỉ:</span><span className="badge info">{s.credits} TC</span></div>
                <div className="detail-row"><span>Loại môn:</span><span className={`badge ${s.type === 'Bắt buộc' ? 'success' : 'info'}`}>{s.type}</span></div>
                <div className="detail-row"><span>Tổ bộ môn:</span><strong>{s.department}</strong></div>
                <div className="detail-row"><span>Mô tả:</span><span>{s.description}</span></div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Không tìm thấy môn học nào</div>}
        </div>
      )}

      {/* Modal Thêm/Sửa */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{editing ? '✏️ Sửa môn học' : '➕ Thêm môn học mới'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Mã môn học *</label>
                  <input style={inputStyle} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="VD: TOAN10" disabled={!!editing} />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Tên môn học *</label>
                  <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Toán học" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Số tín chỉ</label>
                  <input type="number" min="1" max="10" style={inputStyle} value={form.credits} onChange={e => setForm({ ...form, credits: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Loại môn</label>
                  <select style={inputStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {typeOnly.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Tổ bộ môn</label>
                  <select style={inputStyle} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                    {deptOnly.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Mô tả</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Mô tả chi tiết về môn học..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4F6BED, #7C3AED)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 36, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={28} color="#EF4444" />
            </div>
            <h3 style={{ margin: '0 0 8px', color: '#1F2937' }}>Xóa môn học?</h3>
            <p style={{ color: '#6B7280', fontSize: '0.88rem', margin: '0 0 8px' }}>
              <strong>{deleteTarget.name}</strong> ({deleteTarget.code})
            </p>
            <p style={{ color: '#EF4444', fontSize: '0.82rem', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8, marginBottom: 20 }}>
              ⚠️ Hành động này không thể hoàn tác
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '10px 28px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
              <button onClick={handleDelete} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
