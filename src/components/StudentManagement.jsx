import { useState, useEffect, useRef } from 'react';
import { Search, Pencil, Trash2, Plus, X, Upload, FileSpreadsheet, Check, AlertTriangle, CheckSquare, Square, Edit3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import KokomiLoading from './KokomiLoading';
import { getWeekRange, getAvailableWeeks, getSemesterRanges } from '../lib/weekUtils';



export default function StudentManagement() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('Tất cả lớp');
  const [teacherClass, setTeacherClass] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', dob: '', gender: 'Nam', class: '10A1', phone: '', status: 'Đang học' });
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState({ field: 'class', value: '' });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [classList, setClassList] = useState([]);
  const [leaderGroup, setLeaderGroup] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(null);
  // Subject scoring for tổ trưởng
  const [scoreModal, setScoreModal] = useState(null);
  const [subjectList, setSubjectList] = useState([]);
  const [scoreRecords, setScoreRecords] = useState({});
  const [scoreCategory, setScoreCategory] = useState('monhoc'); // 'monhoc' or 'khac'
  const [scoreSubject, setScoreSubject] = useState('');
  const [scoreChange, setScoreChange] = useState(0);
  const [scoreNote, setScoreNote] = useState('');
  const [scoreSaving, setScoreSaving] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null); // { id, name }
  const [scoreHistory, setScoreHistory] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [semester2Start, setSemester2Start] = useState(null);

  // Auto-detect current semester
  useEffect(() => {
    const ranges = getSemesterRanges(semester2Start);
    const now = new Date();
    setSelectedSemester(now >= ranges.hk2.start ? 2 : 1);
  }, [semester2Start]);

  // Load semester settings from DB
  useEffect(() => {
    async function loadSem() {
      const cls = user?.assigned_class;
      if (!cls) return;
      const { data } = await supabase.from('semester_settings').select('semester2_start').eq('class_id', cls).single();
      if (data?.semester2_start) setSemester2Start(data.semester2_start);
    }
    if (user?.role === 'totruong' || user?.role === 'giaovien') loadSem();
  }, [user]);

  const weeks = getAvailableWeeks(selectedSemester, semester2Start);

  // Auto-select valid week when semester changes
  useEffect(() => {
    if (weeks.length > 0 && !weeks.find(w => w.offset === selectedWeek)) {
      setSelectedWeek(weeks[0].offset);
    }
  }, [weeks, selectedWeek]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      let assignedClass = null;

      if (user?.role === 'giaovien') {
        const { data: freshUsers } = await supabase.rpc('get_user_by_id', { p_id: user.id });
        const freshUser = freshUsers?.[0] || null;
        assignedClass = freshUser?.assigned_class || null;
        setTeacherClass(assignedClass);
      }

      if (user?.role === 'totruong') {
        // Find the student record matching this tổ trưởng to get their group
        const { data: freshUsers2 } = await supabase.rpc('get_user_by_id', { p_id: user.id });
        const freshUser = freshUsers2?.[0] || null;
        assignedClass = freshUser?.assigned_class || null;
        setTeacherClass(assignedClass);

        if (assignedClass && freshUser?.name) {
          // Find the student to get group_name
          const { data: studentRecord } = await supabase
            .from('students')
            .select('group_name')
            .eq('name', freshUser.name)
            .eq('class', assignedClass)
            .single();
          if (studentRecord?.group_name) {
            setLeaderGroup(studentRecord.group_name);
          }
        }
      }

      // Fetch class list from DB
      const { data: classData } = await supabase.from('classes').select('name, code').order('code');
      const names = (classData || []).map(c => c.name.replace('Lớp ', ''));
      setClassList(names);

      let query = supabase.from('students').select('*').order('id');
      if (assignedClass) {
        query = query.eq('class', assignedClass);
      }
      const { data, error } = await query;
      if (error) console.error('Error fetching students:', error);
      else {
        let result = data || [];
        // For totruong: further filter by group_name
        if (user?.role === 'totruong' && leaderGroup) {
          result = result.filter(s => s.group_name === leaderGroup);
        }
        setStudents(result);

        // For totruong: load subjects and calculate scores from score_logs
        if (user?.role === 'totruong' && result.length > 0) {
          const { data: subData } = await supabase.from('subjects').select('code, name').order('name');
          setSubjectList(subData || []);

          const studentIds = result.map(s => s.id);
          const wr = getWeekRange(selectedWeek);
          const { data: logs } = await supabase.from('score_logs').select('student_id, change').in('student_id', studentIds).gte('created_at', wr.start).lte('created_at', wr.end);
          const map = {};
          (logs || []).forEach(r => {
            if (!map[r.student_id]) map[r.student_id] = { khac: 10 };
            map[r.student_id].khac += r.change;
          });
          setScoreRecords(map);
        }
      }
      setLoading(false);
    }
    init();
  }, [user, leaderGroup, selectedWeek]);

  function openAdd() {
    const nextId = generateNextId();
    setEditing(null);
    setForm({ id: nextId, name: '', dob: '', gender: 'Nam', class: teacherClass || classList[0] || '', phone: '', status: 'Đang học' });
    setShowModal(true);
  }

  function openEdit(student) {
    setEditing(student);
    setForm({ ...student });
    setShowModal(true);
  }

  function generateNextId() {
    if (students.length === 0) return 'HS001';
    const nums = students.map(s => parseInt(s.id.replace('HS', ''), 10)).filter(n => !isNaN(n));
    const max = Math.max(...nums, 0);
    return 'HS' + String(max + 1).padStart(3, '0');
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('Vui lòng nhập họ và tên!');
    if (!form.id.trim()) return alert('Vui lòng nhập mã học sinh!');

    setSaving(true);
    try {
      if (editing) {
        // Update
        const { error } = await supabase.from('students')
          .update({ name: form.name, dob: form.dob, gender: form.gender, class: form.class, phone: form.phone, status: form.status })
          .eq('id', form.id);
        if (error) throw error;
        setStudents(prev => prev.map(s => s.id === form.id ? { ...form } : s));
      } else {
        // Insert
        const insertData = { id: form.id, name: form.name, dob: form.dob, gender: form.gender, class: form.class, phone: form.phone, status: form.status, created_at: new Date().toISOString() };
        let res = await supabase.from('students').insert(insertData);
        if (res.error && res.error.message?.includes('created_at')) {
          const { created_at: _c, ...withoutDate } = insertData;
          res = await supabase.from('students').insert(withoutDate);
        }
        if (res.error) throw res.error;
        setStudents(prev => [...prev, { ...form }]);
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
      await supabase.from('grades').delete().eq('student_id', deleteTarget.id);
      const { error } = await supabase.from('students').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setStudents(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert('Lỗi xóa: ' + err.message);
    }
  }

  // Strip Vietnamese diacritics for fuzzy matching
  function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }

  function normalize(str) {
    return removeAccents(str).toLowerCase().replace(/\s+/g, '');
  }

  function findCol(row, options) {
    // 1. Exact match
    for (const key of options) {
      if (row[key] !== undefined) return key;
    }
    const keys = Object.keys(row);
    // 2. Case-insensitive + accent-insensitive match
    for (const opt of options) {
      const normOpt = normalize(opt);
      const found = keys.find(k => normalize(k) === normOpt);
      if (found) return found;
    }
    // 3. Fuzzy: key contains option or option contains key
    for (const opt of options) {
      const normOpt = normalize(opt);
      const found = keys.find(k => {
        const normK = normalize(k);
        return normK.includes(normOpt) || normOpt.includes(normK);
      });
      if (found) return found;
    }
    // 4. Keyword-based: match any keyword from options
    const keywords = options.flatMap(o => normalize(o).length > 2 ? [normalize(o)] : []);
    for (const k of keys) {
      const normK = normalize(k);
      if (keywords.some(kw => normK.includes(kw) || kw.includes(normK))) return k;
    }
    return null;
  }

  function normalizeDate(val) {
    if (!val) return '';
    if (typeof val === 'number') {
      // Excel serial date
      const d = new Date((val - 25569) * 86400000);
      return d.toISOString().split('T')[0];
    }
    // Try parse various formats
    const str = String(val).trim();
    const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    return str;
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setProcessing(true);

    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          let raw = XLSX.utils.sheet_to_json(ws);

          if (raw.length === 0) {
            setProcessing(false);
            alert('File không có dữ liệu!');
            return;
          }

          // Always try to find the real header row by scanning for known column keywords
          const allRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          let headerIdx = -1;
          let extractedClass = null;

          for (let ri = 0; ri < Math.min(allRows.length, 15); ri++) {
            const row = (allRows[ri] || []).map(c => String(c || '').trim());
            const rowLower = row.map(c => normalize(c));

            // Extract class from rows like "Lớp: 10A10 - GVCN: ..."
            const classRow = row.find(c => /l[oơớ]p[:\s]/i.test(c));
            if (classRow) {
              const cm = classRow.match(/l[oơớ]p[:\s]*\s*(\S+)/i);
              if (cm) extractedClass = cm[1].replace(/[^0-9A-Za-z]/g, '');
            }

            // Check if this row contains header keywords
            const hasName = rowLower.some(c => c.includes('hovaten') || c.includes('hoten') || (c.includes('ten') && c.length < 20));
            const hasDob = rowLower.some(c => c.includes('ngaysinh') || c.includes('namsinh') || c === 'stt');
            if (hasName || (hasDob && row.length >= 3)) {
              headerIdx = ri;
              break;
            }
          }

          if (headerIdx >= 0) {
            const headers = allRows[headerIdx].map(h => String(h || '').trim());
            raw = allRows.slice(headerIdx + 1)
              .filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim()))
              .map(r => {
                const obj = {};
                headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
                if (extractedClass && !obj['Lớp'] && !obj['class'] && !obj['LỚP']) {
                  obj['Lớp'] = extractedClass;
                }
                return obj;
              });
          }

          if (raw.length === 0) {
            setProcessing(false);
            alert('Không tìm thấy dữ liệu hợp lệ!');
            return;
          }

          // Auto-detect columns from first row
          const sample = raw[0];
          const allCols = Object.keys(sample);
          const colId = findCol(sample, ['Mã HS', 'MaHS', 'Ma HS', 'id', 'Ma', 'STT', 'Mã số', 'Mã học sinh']);
          const colName = findCol(sample, ['Họ và tên', 'Họ tên', 'HoTen', 'name', 'Tên', 'Ho ten', 'Họ và Tên', 'HỌ VÀ TÊN', 'Ten hoc sinh', 'Tên học sinh']);
          const colDob = findCol(sample, ['Ngày sinh', 'NgaySinh', 'dob', 'Ngay sinh', 'Năm sinh', 'NGÀY SINH', 'Sinh ngày']);
          const colGender = findCol(sample, ['Giới tính', 'GioiTinh', 'gender', 'Gioi tinh', 'GIỚI TÍNH', 'GT']);
          const colClass = findCol(sample, ['Lớp', 'class', 'Lop', 'LỚP', 'Lớp học']);
          const colPhone = findCol(sample, ['Điện thoại', 'SĐT', 'SDT', 'phone', 'Dien thoai', 'Số điện thoại', 'SỐ ĐIỆN THOẠI', 'ĐIỆN THOẠI', 'So dien thoai', 'DT']);
          const colStatus = findCol(sample, ['Trạng thái', 'status', 'Trang thai', 'TRẠNG THÁI']);

          const detectedCols = [colId, colName, colDob, colGender, colClass, colPhone].filter(Boolean);
          const existingIds = new Set(students.map(s => s.id));

          // If key columns not detected, show raw data for user to review
          if (!colName) {
            setImportStats({
              fileName: file.name,
              totalRows: raw.length,
              validRows: 0,
              duplicates: 0,
              detectedCols,
              sheetName: wb.SheetNames[0],
              allCols,
              rawMode: true,
              mapping: { colId, colName, colDob, colGender, colClass, colPhone },
            });
            // Show raw data as-is
            setImportData(raw.slice(0, 50).map((row, i) => ({ _raw: true, _index: i, ...row })));
            setProcessing(false);
            setShowImport(true);
            return;
          }

          const mapped = raw.map((row, i) => {
            const id = colId ? String(row[colId] || '') : `HS${String(students.length + i + 1).padStart(3, '0')}`;
            return {
              id: id.startsWith('HS') ? id : `HS${String(students.length + i + 1).padStart(3, '0')}`,
              name: colName ? String(row[colName] || '') : '',
              dob: normalizeDate(colDob ? row[colDob] : ''),
              gender: colGender ? String(row[colGender] || 'Nam') : 'Nam',
              class: colClass ? String(row[colClass] || '10A1') : '10A1',
              phone: colPhone ? String(row[colPhone] || '') : '',
              status: colStatus ? String(row[colStatus] || 'Đang học') : 'Đang học',
              _duplicate: existingIds.has(id),
            };
          }).filter(r => r.name.trim());

          const duplicates = mapped.filter(r => r._duplicate).length;
          const valid = mapped.filter(r => !r._duplicate);

          setImportStats({
            fileName: file.name,
            totalRows: raw.length,
            validRows: valid.length,
            duplicates,
            detectedCols,
            sheetName: wb.SheetNames[0],
            allCols,
            rawMode: false,
            mapping: { colId, colName, colDob, colGender, colClass, colPhone },
          });
          setImportData(valid);
          setProcessing(false);
          setShowImport(true);
        } catch (err) {
          setProcessing(false);
          alert('Lỗi đọc file: ' + err.message);
        }
      };
      reader.readAsBinaryString(file);
      e.target.value = '';
    }, 500);
  }

  async function handleImport() {
    if (importData.length === 0) return;
    setImporting(true);
    try {
      const now = new Date().toISOString();
      const fields = ['id', 'name', 'dob', 'gender', 'class', 'phone', 'status'];
      const clean = importData.map(row => {
        const obj = {};
        fields.forEach(f => { if (row[f] !== undefined) obj[f] = row[f]; });
        obj.created_at = now;
        return obj;
      });
      let { error } = await supabase.from('students').insert(clean);
      if (error && error.message?.includes('created_at')) {
        const cleanNoDate = clean.map(({ created_at: _C, ...rest }) => rest); // eslint-disable-line no-unused-vars
        ({ error } = await supabase.from('students').insert(cleanNoDate));
      }
      if (error) throw error;
      setStudents(prev => [...prev, ...clean]);
      setShowImport(false);
      setImportData([]);
      setImportStats(null);
    } catch (err) {
      alert('Lỗi nhập: ' + err.message);
    }
    setImporting(false);
  }

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === 'Tất cả lớp' || s.class === classFilter;
    return matchSearch && matchClass;
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
        <h2>{user?.role === 'totruong' && leaderGroup ? `Học sinh ${leaderGroup}` : 'Quản lý học sinh'}</h2>
        <p>{user?.role === 'totruong' && leaderGroup
          ? `Danh sách học sinh ${leaderGroup} - Lớp ${teacherClass || ''}`
          : teacherClass ? `Danh sách học sinh lớp ${teacherClass}` : 'Danh sách tất cả học sinh trong trường'}</p>
      </div>

      <div className="filters-bar">
        <div className="search-input">
          <Search />
          <input type="text" placeholder="Tìm kiếm theo tên hoặc mã học sinh..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!teacherClass && (
          <select className="filter-select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            {['Tất cả lớp', ...classList].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {user?.role !== 'totruong' && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 10, border: '1.5px solid #10B981', background: '#ECFDF5', color: '#059669', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}>
            <Upload size={16} /> Nhập Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
            <Plus size={18} /> Thêm học sinh
          </button>
        </div>}
      </div>

      {/* Semester & Week Selector for tổ trưởng */}
      {user?.role === 'totruong' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>📚 Học kỳ:</span>
          <select
            value={selectedSemester || 1}
            onChange={e => { setSelectedSemester(Number(e.target.value)); setSelectedWeek(0); }}
            className="filter-select"
            style={{ minWidth: 120 }}
          >
            <option value={1}>Học kỳ 1</option>
            <option value={2}>Học kỳ 2</option>
          </select>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginLeft: 8 }}>📅 Tuần:</span>
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(Number(e.target.value))}
            className="filter-select"
            style={{ minWidth: 200 }}
          >
            {weeks.map(w => (
              <option key={w.offset} value={w.offset}>
                {w.isCurrent ? `Tuần hiện tại (${w.label})` : w.label}
              </option>
            ))}
          </select>
          {selectedWeek !== 0 && (
            <span style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 600, background: '#FEF3C7', padding: '4px 10px', borderRadius: 8 }}>
              ⏳ Chỉ xem — không chỉnh sửa được
            </span>
          )}
        </div>
      )}

      {/* Bulk action toolbar */}
      {selected.size > 0 && !deleteProgress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', border: '1.5px solid #93C5FD', marginBottom: 16 }}>
          <CheckSquare size={18} color="#2563EB" />
          <span style={{ fontWeight: 700, color: '#1E40AF', fontSize: '0.9rem' }}>Đã chọn {selected.size} học sinh</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => { setBulkForm({ field: 'class', value: classList[0] || '' }); setShowBulkEdit(true); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #3B82F6', background: '#fff', color: '#2563EB', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
              <Edit3 size={14} /> Sửa hàng loạt
            </button>
            <button onClick={() => {
              const ids = Array.from(selected);
              const toDelete = students.filter(s => ids.includes(s.id));
              if (toDelete.length === 0) { alert('Không tìm thấy học sinh để xóa!'); return; }
              setDeleteProgress({ confirm: true, items: toDelete });
            }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #EF4444', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
              <Trash2 size={14} /> Xóa đã chọn
            </button>
            <button onClick={() => setSelected(new Set())} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #D1D5DB', background: '#fff', color: '#6B7280', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>Bỏ chọn</button>
          </div>
        </div>
      )}

      {loading ? (
        <KokomiLoading text="Đang tải học sinh..." />
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                {user?.role !== 'totruong' && <th style={{ width: 40, textAlign: 'center' }}>
                  <input type="checkbox" checked={filtered.length > 0 && filtered.every(s => selected.has(s.id))} onChange={e => {
                    if (e.target.checked) setSelected(new Set([...selected, ...filtered.map(s => s.id)]));
                    else { const n = new Set(selected); filtered.forEach(s => n.delete(s.id)); setSelected(n); }
                  }} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                </th>}
                <th>Mã HS</th><th>Họ và tên</th><th>Ngày sinh</th><th>Giới tính</th>
                <th>Lớp</th><th>Điện thoại</th><th>Trạng thái</th>{user?.role === 'totruong' && <th style={{ textAlign: 'center' }}>Điểm hiện tại</th>}{user?.role === 'totruong' && <th style={{ textAlign: 'center' }}>Điểm</th>}{user?.role !== 'totruong' && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ background: selected.has(s.id) ? '#EFF6FF' : undefined }}>
                  {user?.role !== 'totruong' && <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={e => {
                      const n = new Set(selected);
                      e.target.checked ? n.add(s.id) : n.delete(s.id);
                      setSelected(n);
                    }} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  </td>}
                  <td style={{ fontWeight: 600 }}>{s.id}</td>
                  <td>{user?.role === 'totruong'
                    ? <button onClick={async () => {
                        setHistoryStudent({ id: s.id, name: s.name });
                        const wr = getWeekRange(selectedWeek);
                        const { data } = await supabase.from('score_logs').select('*').eq('student_id', s.id).gte('created_at', wr.start).lte('created_at', wr.end).order('created_at', { ascending: false });
                        setScoreHistory(data || []);
                      }} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 'inherit' }}>{s.name}</button>
                    : s.name
                  }</td>
                  <td>{s.dob}</td>
                  <td>{s.gender}</td>
                  <td>{s.class}</td>
                  <td>{s.phone || '—'}</td>
                  <td><span className="badge success">{s.status}</span></td>
                  {user?.role === 'totruong' && (() => {
                    const sc = scoreRecords[s.id]?.['khac'] ?? 10;
                    return <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: sc >= 8 ? '#059669' : sc >= 5 ? '#D97706' : '#DC2626' }}>{sc}</td>;
                  })()}
                  {user?.role === 'totruong' && selectedWeek === 0 && <td style={{ textAlign: 'center' }}>
                    <button onClick={() => {
                      setScoreModal({ studentId: s.id, studentName: s.name });
                      setScoreCategory('monhoc');
                      setScoreSubject(subjectList[0]?.code || '');
                      setScoreChange(0);
                      setScoreNote('');
                    }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      📖 Chấm điểm
                    </button>
                  </td>}
                  {user?.role !== 'totruong' && <td>
                    <div className="action-btns">
                      <button className="action-btn edit" title="Sửa" onClick={() => openEdit(s)}><Pencil size={16} /></button>
                      <button className="action-btn delete" title="Xóa" onClick={() => setDeleteTarget(s)}><Trash2 size={16} /></button>
                    </div>
                  </td>}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Không tìm thấy học sinh nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete progress modal */}
      {deleteProgress && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 36, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            {deleteProgress.confirm ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <AlertTriangle size={28} color="#EF4444" />
                </div>
                <h3 style={{ margin: '0 0 8px', color: '#1F2937' }}>Xóa {deleteProgress.items.length} học sinh?</h3>
                <p style={{ color: '#EF4444', fontSize: '0.82rem', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
                  ⚠️ Điểm số liên quan cũng sẽ bị xóa vĩnh viễn
                </p>
                <div style={{ maxHeight: 120, overflow: 'auto', textAlign: 'left', background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: '0.82rem' }}>
                  {deleteProgress.items.map(s => (
                    <div key={s.id} style={{ padding: '2px 0', color: '#374151' }}>• {s.name} ({s.id})</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => setDeleteProgress(null)} style={{ padding: '10px 28px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
                  <button onClick={async () => {
                    const items = deleteProgress.items;
                    try {
                      for (let i = 0; i < items.length; i++) {
                        setDeleteProgress({ current: i + 1, total: items.length, name: items[i].name });
                        await supabase.from('grades').delete().eq('student_id', items[i].id);
                        await supabase.from('students').delete().eq('id', items[i].id);
                      }
                      setStudents(prev => prev.filter(s => !selected.has(s.id)));
                      setSelected(new Set());
                      setDeleteProgress({ done: true, total: items.length });
                      setTimeout(() => setDeleteProgress(null), 1500);
                    } catch (err) {
                      setDeleteProgress(null);
                      alert('Lỗi xóa: ' + err.message);
                    }
                  }} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                    Xóa {deleteProgress.items.length} học sinh
                  </button>
                </div>
              </>
            ) : deleteProgress.done ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={28} color="#059669" />
                </div>
                <h3 style={{ margin: '0 0 8px', color: '#059669' }}>Xóa thành công!</h3>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '0.88rem' }}>Đã xóa {deleteProgress.total} học sinh</p>
              </>
            ) : (
              <>
                <img src="https://media1.tenor.com/m/367_2oY3VaYAAAAC/kokomi-loading.gif" alt="loading" style={{ width: 100, borderRadius: 14, margin: '0 auto 12px', display: 'block' }} />
                <h3 style={{ margin: '0 0 8px', color: '#1F2937', fontSize: '1.1rem' }}>Đang xóa học sinh...</h3>
                <p style={{ margin: '0 0 16px', color: '#6B7280', fontSize: '0.85rem' }}>
                  {deleteProgress.current}/{deleteProgress.total} — <b>{deleteProgress.name}</b>
                </p>
                <div style={{ background: '#FEE2E2', borderRadius: 10, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    background: 'linear-gradient(90deg, #EF4444, #F87171)',
                    height: '100%', borderRadius: 10,
                    width: `${(deleteProgress.current / deleteProgress.total) * 100}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <p style={{ margin: '8px 0 0', color: '#9CA3AF', fontSize: '0.78rem' }}>
                  {Math.round((deleteProgress.current / deleteProgress.total) * 100)}% hoàn thành
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Thêm/Sửa */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{editing ? '✏️ Sửa học sinh' : '➕ Thêm học sinh mới'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Mã học sinh</label>
                <input style={{ ...inputStyle, background: editing ? '#F3F4F6' : '#FAFBFF' }} value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} disabled={!!editing} placeholder="VD: HS009" />
              </div>
              <div>
                <label style={labelStyle}>Họ và tên *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label style={labelStyle}>Ngày sinh</label>
                <input style={inputStyle} type="date" value={form.dob || ''} onChange={e => setForm({ ...form, dob: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Giới tính</label>
                <select style={inputStyle} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option>Nam</option>
                  <option>Nữ</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Lớp</label>
                <select style={inputStyle} value={form.class} onChange={e => setForm({ ...form, class: e.target.value })}>
                  {classList.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Điện thoại</label>
                <input style={inputStyle} value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0901234567" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Trạng thái</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option>Đang học</option>
                  <option>Nghỉ học</option>
                  <option>Chuyển trường</option>
                </select>
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

      {/* Processing indicator */}
      {processing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 40, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <KokomiLoading text="Đang xử lý file Excel..." />
          </div>
        </div>
      )}

      {/* Modal Nhập Excel Preview */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 820, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={22} color="#059669" /> Kết quả phân tích file
              </h3>
              <button onClick={() => { setShowImport(false); setImportData([]); setImportStats(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>

            {/* Analysis summary */}
            {importStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>File</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#15803D', marginTop: 2 }}>{importStats.fileName}</div>
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1E40AF', fontWeight: 600, textTransform: 'uppercase' }}>Tổng dòng</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1D4ED8', marginTop: 2 }}>{importStats.totalRows}</div>
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Hợp lệ</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803D', marginTop: 2 }}>{importStats.validRows}</div>
                </div>
                {importStats.duplicates > 0 && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <div style={{ fontSize: '0.72rem', color: '#991B1B', fontWeight: 600, textTransform: 'uppercase' }}>Trùng lặp (bỏ qua)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#DC2626', marginTop: 2 }}>{importStats.duplicates}</div>
                  </div>
                )}
              </div>
            )}

            {/* Column mapping info when rawMode */}
            {importStats?.rawMode && (
              <div style={{ padding: '14px 18px', borderRadius: 12, background: '#FEF3C7', border: '1px solid #FCD34D', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 6, fontSize: '0.9rem' }}>⚠️ Không tìm thấy cột "Họ và tên" — hiển thị dữ liệu gốc</div>
                <div style={{ fontSize: '0.82rem', color: '#78350F' }}>
                  <b>Cột trong file:</b> {importStats.allCols?.join(', ') || 'Không có'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#78350F', marginTop: 4 }}>
                  <b>Cần có ít nhất:</b> Một cột chứa tên (VD: "Họ và tên", "HỌ VÀ TÊN", "Ho ten", "Tên")
                </div>
              </div>
            )}

            {/* Data preview */}
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E5E7EB' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    {importStats?.rawMode ? (
                      <>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>#</th>
                        {importStats.allCols?.map(col => (
                          <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </>
                    ) : (
                      ['#', 'Mã HS', 'Họ và tên', 'Ngày sinh', 'Giới tính', 'Lớp', 'SĐT'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {importStats?.rawMode ? (
                    importData.slice(0, 20).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '9px 14px', color: '#9CA3AF' }}>{i + 1}</td>
                        {importStats.allCols?.map(col => (
                          <td key={col} style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>{String(row[col] ?? '—')}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    importData.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '9px 14px', color: '#9CA3AF' }}>{i + 1}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{s.id}</td>
                        <td style={{ padding: '9px 14px' }}>{s.name}</td>
                        <td style={{ padding: '9px 14px' }}>{s.dob}</td>
                        <td style={{ padding: '9px 14px' }}>{s.gender}</td>
                        <td style={{ padding: '9px 14px' }}>{s.class}</td>
                        <td style={{ padding: '9px 14px' }}>{s.phone || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                {importStats?.rawMode
                  ? `📋 Hiển thị ${Math.min(importData.length, 20)}/${importStats?.totalRows} dòng gốc • Sheet: ${importStats?.sheetName}`
                  : `✅ Phát hiện ${importStats?.detectedCols?.length || 0} cột • Sheet: ${importStats?.sheetName}`
                }
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowImport(false); setImportData([]); setImportStats(null); }} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#6B7280' }}>Đóng</button>
                {!importStats?.rawMode && (
                  <button onClick={handleImport} disabled={importing || importData.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, border: 'none', background: importing ? '#9CA3AF' : '#059669', color: '#fff', cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                    <Check size={16} /> {importing ? 'Đang nhập...' : `Xác nhận nhập ${importData.length} học sinh`}
                  </button>
                )}
              </div>
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
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', color: '#1F2937' }}>Xác nhận xóa học sinh</h3>
            <p style={{ margin: '0 0 6px', color: '#6B7280', fontSize: '0.92rem' }}>
              Bạn có chắc muốn xóa học sinh:
            </p>
            <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: '1.05rem', color: '#1F2937' }}>
              {deleteTarget.name} ({deleteTarget.id})
            </p>
            <p style={{ margin: '0 0 24px', color: '#EF4444', fontSize: '0.82rem', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>
              ⚠️ Điểm số liên quan cũng sẽ bị xóa vĩnh viễn
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '10px 28px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#6B7280' }}>Hủy</button>
              <button onClick={confirmDelete} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Xóa học sinh</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sửa hàng loạt */}
      {showBulkEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={20} color="#2563EB" /> Sửa hàng loạt ({selected.size} học sinh)
              </h3>
              <button onClick={() => setShowBulkEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={22} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Chọn trường cần sửa</label>
              <select style={inputStyle} value={bulkForm.field} onChange={e => setBulkForm({ field: e.target.value, value: e.target.value === 'class' ? (classList[0] || '') : e.target.value === 'status' ? 'Đang học' : e.target.value === 'gender' ? 'Nam' : '' })}>
                <option value="class">Lớp</option>
                <option value="status">Trạng thái</option>
                <option value="gender">Giới tính</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Giá trị mới</label>
              {bulkForm.field === 'class' ? (
                <select style={inputStyle} value={bulkForm.value} onChange={e => setBulkForm({ ...bulkForm, value: e.target.value })}>
                  {classList.map(c => <option key={c}>{c}</option>)}
                </select>
              ) : bulkForm.field === 'status' ? (
                <select style={inputStyle} value={bulkForm.value} onChange={e => setBulkForm({ ...bulkForm, value: e.target.value })}>
                  <option>Đang học</option>
                  <option>Nghỉ học</option>
                  <option>Chuyển trường</option>
                </select>
              ) : (
                <select style={inputStyle} value={bulkForm.value} onChange={e => setBulkForm({ ...bulkForm, value: e.target.value })}>
                  <option>Nam</option>
                  <option>Nữ</option>
                </select>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderRadius: 10, background: '#F9FAFB', border: '1px solid #E5E7EB', marginBottom: 20, maxHeight: 150, overflow: 'auto' }}>
              <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>Học sinh được chọn:</div>
              {students.filter(s => selected.has(s.id)).map(s => (
                <div key={s.id} style={{ fontSize: '0.82rem', padding: '3px 0', color: '#374151' }}>• {s.name} ({s.id}) — {bulkForm.field === 'class' ? s.class : bulkForm.field === 'status' ? s.status : s.gender} → <b style={{ color: '#2563EB' }}>{bulkForm.value}</b></div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowBulkEdit(false)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#6B7280' }}>Hủy</button>
              <button disabled={bulkSaving} onClick={async () => {
                setBulkSaving(true);
                try {
                  const ids = [...selected];
                  const update = { [bulkForm.field]: bulkForm.value };
                  for (const id of ids) {
                    await supabase.from('students').update(update).eq('id', id);
                  }
                  setStudents(prev => prev.map(s => selected.has(s.id) ? { ...s, ...update } : s));
                  setShowBulkEdit(false);
                  setSelected(new Set());
                } catch (err) {
                  alert('Lỗi: ' + err.message);
                }
                setBulkSaving(false);
              }} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: bulkSaving ? '#9CA3AF' : '#2563EB', color: '#fff', cursor: bulkSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                {bulkSaving ? 'Đang lưu...' : `Cập nhật ${selected.size} học sinh`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Score Modal for tổ trưởng */}
      {scoreModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1F2937' }}>📖 Chấm điểm - {scoreModal.studentName}</h3>
              <button onClick={() => setScoreModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="#9CA3AF" /></button>
            </div>

            {/* Category selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Chọn mục</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setScoreCategory('monhoc'); setScoreChange(0); }}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: scoreCategory === 'monhoc' ? '2px solid #6366F1' : '1.5px solid #E5E7EB', background: scoreCategory === 'monhoc' ? '#EEF2FF' : '#fff', color: scoreCategory === 'monhoc' ? '#4F46E5' : '#6B7280', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  📚 Điểm môn học
                </button>
                <button onClick={() => { setScoreCategory('khac'); setScoreChange(0); }}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: scoreCategory === 'khac' ? '2px solid #D97706' : '1.5px solid #E5E7EB', background: scoreCategory === 'khac' ? '#FFFBEB' : '#fff', color: scoreCategory === 'khac' ? '#B45309' : '#6B7280', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  📋 Khác
                </button>
              </div>
            </div>

            {/* Subject selector (for monhoc) */}
            {scoreCategory === 'monhoc' && <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Chọn môn học</label>
              <select value={scoreSubject} onChange={e => setScoreSubject(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: '0.92rem', outline: 'none', background: '#FAFBFF' }}>
                {subjectList.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>}


            {/* Current score display */}
            {(() => {
              const current = scoreRecords[scoreModal.studentId]?.['khac'] ?? 10;
              const preview = Math.max(0, current + scoreChange);
              return (
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 20, marginBottom: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 8 }}>Điểm hiện tại</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: current >= 8 ? '#059669' : current >= 5 ? '#D97706' : '#DC2626' }}>{current}</div>
                  {scoreChange !== 0 && (
                    <div style={{ marginTop: 8, fontSize: '1rem', fontWeight: 700 }}>
                      <span style={{ color: '#9CA3AF' }}>→ </span>
                      <span style={{ color: preview >= 8 ? '#059669' : preview >= 5 ? '#D97706' : '#DC2626' }}>{preview}</span>
                      <span style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700, background: scoreChange > 0 ? '#D1FAE5' : '#FEE2E2', color: scoreChange > 0 ? '#059669' : '#DC2626' }}>
                        {scoreChange > 0 ? `+${scoreChange}` : scoreChange}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Score change buttons */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Điểm cộng / trừ</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[-5, -3, -2, -1].map(v => (
                  <button key={v} onClick={() => setScoreChange(v)}
                    style={{ padding: '8px 16px', borderRadius: 10, border: scoreChange === v ? '2px solid #DC2626' : '1.5px solid #FCA5A5', background: scoreChange === v ? '#FEE2E2' : '#FFF', color: '#DC2626', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {v}
                  </button>
                ))}
                <button onClick={() => setScoreChange(0)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: scoreChange === 0 ? '2px solid #6B7280' : '1.5px solid #D1D5DB', background: scoreChange === 0 ? '#F3F4F6' : '#FFF', color: '#374151', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                  0
                </button>
                {[1, 2, 3, 5].map(v => (
                  <button key={v} onClick={() => setScoreChange(v)}
                    style={{ padding: '8px 16px', borderRadius: 10, border: scoreChange === v ? '2px solid #059669' : '1.5px solid #6EE7B7', background: scoreChange === v ? '#D1FAE5' : '#FFF', color: '#059669', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Ghi chú (tùy chọn)</label>
              <input type="text" value={scoreNote} onChange={e => setScoreNote(e.target.value)} placeholder="VD: Không làm bài tập, phát biểu tốt..."
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', background: '#FAFBFF' }} />
            </div>

            {/* Actions */}
            {(() => {
                const subjectName = scoreCategory === 'monhoc' ? (subjectList.find(s => s.code === scoreSubject)?.name || scoreSubject) : 'Khác';
                const fullNote = `[${subjectName}] ${scoreNote || ''}`.trim();
              return (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setScoreModal(null)} style={{ padding: '10px 24px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6B7280' }}>Hủy</button>
              <button disabled={scoreSaving || scoreChange === 0} onClick={async () => {
                setScoreSaving(true);
                const current = scoreRecords[scoreModal.studentId]?.['khac'] ?? 10;
                const newScore = Math.max(0, current + scoreChange);
                // Insert score log - if past week, set created_at within that week
                const insertData = {
                  student_id: scoreModal.studentId,
                  change: scoreChange,
                  note: fullNote || null,
                  score_after: newScore,
                };
                if (selectedWeek !== 0) {
                  const wr = getWeekRange(selectedWeek);
                  const mid = new Date(wr.start);
                  mid.setDate(mid.getDate() + 3);
                  mid.setHours(12, 0, 0, 0);
                  insertData.created_at = mid.toISOString();
                }
                const { error } = await supabase.from('score_logs').insert(insertData);
                if (error) {
                  alert('Lỗi: ' + error.message);
                } else {
                  setScoreRecords(prev => ({
                    ...prev,
                    [scoreModal.studentId]: {
                      ...(prev[scoreModal.studentId] || {}),
                      khac: newScore,
                    }
                  }));
                  setScoreModal(null);
                }
                setScoreSaving(false);
              }} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: (scoreSaving || scoreChange === 0) ? '#D1D5DB' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', cursor: (scoreSaving || scoreChange === 0) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                {scoreSaving ? 'Đang lưu...' : 'Lưu điểm'}
              </button>
            </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* Score History Modal */}
      {historyStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#1F2937' }}>📋 Lịch sử điểm - {historyStudent.name}</h3>
              <button onClick={() => setHistoryStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="#9CA3AF" /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px 18px', background: '#F9FAFB', borderRadius: 14 }}>
              <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>Điểm hiện tại:</span>
              {(() => { const sc = scoreRecords[historyStudent.id]?.['khac'] ?? 10; return <span style={{ fontSize: '1.5rem', fontWeight: 800, color: sc >= 8 ? '#059669' : sc >= 5 ? '#D97706' : '#DC2626' }}>{sc}</span>; })()}
            </div>
            {scoreHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>Chưa có lịch sử chấm điểm</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scoreHistory.map((log, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: log.change > 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${log.change > 0 ? '#BBF7D0' : '#FECACA'}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: log.change > 0 ? '#D1FAE5' : '#FEE2E2', color: log.change > 0 ? '#059669' : '#DC2626', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {log.change > 0 ? `+${log.change}` : log.change}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1F2937' }}>{log.note || 'Không có ghi chú'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2 }}>Điểm sau: {log.score_after} • {new Date(log.created_at).toLocaleString('vi-VN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
