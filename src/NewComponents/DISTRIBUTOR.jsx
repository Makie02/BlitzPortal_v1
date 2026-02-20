import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import { debounce } from 'lodash';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const ROW_OPTIONS = [5, 10, 20];

/* ─── Global CSS ────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .dist-wrap * { box-sizing: border-box; font-family: 'DM Sans', sans-serif; }

  .dist-wrap .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border: none; border-radius: 10px;
    font-size: 13.5px; font-weight: 600; cursor: pointer;
    transition: all .18s ease; white-space: nowrap;
  }
  .dist-wrap .btn:active { transform: scale(.97); }
  .dist-wrap .btn-primary  { background: #2563eb; color: #fff; box-shadow: 0 2px 8px rgba(37,99,235,.28); }
  .dist-wrap .btn-primary:hover  { background: #1d4ed8; }
  .dist-wrap .btn-success  { background: #16a34a; color: #fff; box-shadow: 0 2px 8px rgba(22,163,74,.25); }
  .dist-wrap .btn-success:hover  { background: #15803d; }
  .dist-wrap .btn-emerald  { background: #059669; color: #fff; box-shadow: 0 2px 8px rgba(5,150,105,.25); }
  .dist-wrap .btn-emerald:hover  { background: #047857; }
  .dist-wrap .btn-violet   { background: #7c3aed; color: #fff; box-shadow: 0 2px 8px rgba(124,58,237,.25); }
  .dist-wrap .btn-violet:hover   { background: #6d28d9; }
  .dist-wrap .btn-muted    { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .dist-wrap .btn-muted:hover    { background: #e2e8f0; }
  .dist-wrap .btn-danger   { background: #dc2626; color: #fff; }
  .dist-wrap .btn-danger:hover   { background: #b91c1c; }
  .dist-wrap .btn-icon     { padding: 8px; border-radius: 8px; }

  .dist-wrap table { width: 100%; border-collapse: collapse; }
  .dist-wrap thead th {
    background: #1a57ff; color: #fff;
    padding: 13px 16px; font-size: 12.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .05em;
    position: sticky; top: 0; z-index: 1;
  }
  .dist-wrap thead th:first-child { border-radius: 10px 0 0 0; }
  .dist-wrap thead th:last-child  { border-radius: 0 10px 0 0; }
  .dist-wrap tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .12s; }
  .dist-wrap tbody tr:hover { background: #f8faff; }
  .dist-wrap tbody td { padding: 13px 16px; font-size: 13.5px; color: #334155; }

  .dist-wrap .badge {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 11.5px; font-weight: 600;
  }
  .dist-wrap .badge-blue   { background: #dbeafe; color: #1d4ed8; }
  .dist-wrap .badge-green  { background: #dcfce7; color: #15803d; }
  .dist-wrap .badge-amber  { background: #fef3c7; color: #92400e; }
  .dist-wrap .badge-violet { background: #ede9fe; color: #6d28d9; }
  .dist-wrap .badge-gray   { background: #f1f5f9; color: #475569; }

  /* Drag-drop */
  .dup-row { transition: box-shadow .15s, opacity .15s, transform .15s; }
  .dup-row.dragging { opacity: .45; box-shadow: 0 8px 24px rgba(0,0,0,.18); transform: scale(.99); }
  .dup-row.drag-over { box-shadow: inset 0 2px 0 #2563eb; background: #eff6ff !important; }

  /* Toggle pill */
  .action-pill { display: inline-flex; border-radius: 10px; overflow: hidden; border: 1.5px solid #e2e8f0; }
  .action-pill button { padding: 6px 14px; border: none; cursor: pointer; font-size: 12.5px; font-weight: 700; transition: all .15s; }
  .action-pill button.active-update { background: #2563eb; color: #fff; }
  .action-pill button.active-skip   { background: #64748b; color: #fff; }
  .action-pill button:not(.active-update):not(.active-skip) { background: #f8fafc; color: #94a3b8; }
  .action-pill button:not(.active-update):not(.active-skip):hover { background: #e2e8f0; color: #475569; }

  /* Input */
  .dist-input {
    width: 100%; padding: 9px 13px; border-radius: 9px;
    border: 1.5px solid #e2e8f0; font-size: 13.5px; color: #1e293b;
    transition: border-color .15s, box-shadow .15s; outline: none; background: #fff;
  }
  .dist-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
  .dist-input:disabled { background: #f8fafc; color: #94a3b8; }

  /* Modal */
  .dist-overlay {
    position: fixed; inset: 0; background: rgba(15,23,42,.55);
    display: flex; justify-content: center; align-items: center;
    z-index: 1000; padding: 16px; backdrop-filter: blur(3px);
  }
  .dist-modal {
    background: #fff; border-radius: 16px; width: 100%;
    box-shadow: 0 24px 60px rgba(0,0,0,.22);
    max-height: 90vh; overflow-y: auto; animation: modalIn .2s ease;
  }
  @keyframes modalIn {
    from { opacity: 0; transform: translateY(14px) scale(.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Scrollbar */
  .dist-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .dist-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
  .dist-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }

  /* Tooltip */
  .tt-cell { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default; position: relative; }
  .tt-box {
    position: fixed; background: #0f172a; color: #e2e8f0;
    padding: 8px 12px; border-radius: 9px; font-size: 12.5px;
    max-width: 300px; white-space: pre-wrap; word-break: break-word;
    z-index: 9999; pointer-events: none; line-height: 1.55;
    box-shadow: 0 8px 24px rgba(0,0,0,.3); transform: translate(10px, -105%);
  }

  .dist-label { display: block; font-size: 12.5px; font-weight: 600; color: #475569; margin-bottom: 5px; text-transform: uppercase; letter-spacing: .04em; }
  .drag-handle { cursor: grab; color: #94a3b8; padding: 0 4px; font-size: 16px; line-height: 1; user-select: none; }
  .drag-handle:active { cursor: grabbing; }
  .dist-wrap .mono { font-family: 'DM Mono', monospace; font-size: 12.5px; }

  /* Import format toggle */
  .fmt-toggle { display: inline-flex; border-radius: 8px; overflow: hidden; border: 1.5px solid #e2e8f0; }
  .fmt-toggle button { padding: 7px 14px; border: none; cursor: pointer; font-size: 12.5px; font-weight: 700; transition: all .15s; background: #f8fafc; color: #94a3b8; }
  .fmt-toggle button.fmt-active-csv  { background: #059669; color: #fff; }
  .fmt-toggle button.fmt-active-xlsx { background: #7c3aed; color: #fff; }
  .fmt-toggle button:hover:not(.fmt-active-csv):not(.fmt-active-xlsx) { background: #e2e8f0; color: #475569; }
`;

function injectCSS() {
  if (!document.getElementById('dist-styles')) {
    const el = document.createElement('style');
    el.id = 'dist-styles';
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
  }
}

/* ─── Sub-components ─────────────────────────────────────────────────── */
const TooltipCell = ({ text, maxChars = 28 }) => {
  const [show, setShow] = React.useState(false);
  const isTrunc = text && text.length > maxChars;
  return (
    <td className="tt-cell" onMouseEnter={() => isTrunc && setShow(true)} onMouseLeave={() => setShow(false)}>
      {isTrunc ? text.substring(0, maxChars) + '…' : (text || <span style={{ color: '#cbd5e1' }}>—</span>)}
      {show && <div className="tt-box">{text}</div>}
    </td>
  );
};

const IconBtn = ({ title, onClick, color, children }) => (
  <button title={title} onClick={onClick} className="btn btn-icon" style={{ backgroundColor: color, color: '#fff', marginRight: 5 }}>
    {children}
  </button>
);

const IcoView   = () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>;
const IcoEdit   = () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2L3 10.207V11h.793L13 3.793 11.207 2z"/></svg>;
const IcoTrash  = () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm5 0A.5.5 0 0 1 11 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3.086a1 1 0 0 1 .707.293l.707.707h3.086l.707-.707A1 1 0 0 1 11.914 2H15a1 1 0 0 1 .5.5zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118z"/></svg>;
const IcoSearch = () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.85-3.85zM6.5 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>;
const IcoDrag   = () => <span>⠿</span>;
const IcoDown   = () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>;
const IcoUp     = () => <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>;

/* ═══════════════════════════════════════════════════════════════════════ */
const Distributor = () => {
  injectCSS();

  const EMPTY_FORM = {
    id: null, code: '', name: '', description: '',
    agent_code: '', mother_accounts_code: '', slp: '',
    distributors_specialists: ''
  };

  const [distributors, setDistributors]     = useState([]);
  const [loading, setLoading]               = useState(true);
  const [modalOpen, setModalOpen]           = useState(false);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [isEditing, setIsEditing]           = useState(false);
  const [isViewing, setIsViewing]           = useState(false);
  const [searchTerm, setSearchTerm]         = useState('');
  const [currentPage, setCurrentPage]       = useState(1);
  const [itemsPerPage, setItemsPerPage]     = useState(5);
  const [motherAccounts, setMotherAccounts] = useState([]);
  const [selectedMotherAccounts, setSelectedMotherAccounts] = useState([]);
  const [accountUsers, setAccountUsers]     = useState([]);
  const [userModalOpen, setUserModalOpen]   = useState(false);
  const [accountUserSearch, setAccountUserSearch] = useState('');
  const [selectedAgentUser, setSelectedAgentUser]   = useState(null);
  const [selectedAgentUsers, setSelectedAgentUsers] = useState([]);

  /* ── Dup modal ── */
  const [dupModalOpen, setDupModalOpen]         = useState(false);
  const [dupRows, setDupRows]                   = useState([]);
  const [newRows, setNewRows]                   = useState([]);
  const [importProcessing, setImportProcessing] = useState(false);

  /* ── Import format toggle ── */
  const [importFormat, setImportFormat] = useState('csv');

  /* ── Drag state ── */
  const dragIdx  = useRef(null);
  const dragOver = useRef(null);

  const handleDragStart = (idx) => { dragIdx.current = idx; };
  const handleDragEnter = (idx) => { dragOver.current = idx; };
  const handleDragEnd   = () => {
    if (dragIdx.current === null || dragOver.current === null || dragIdx.current === dragOver.current) {
      dragIdx.current = dragOver.current = null; return;
    }
    const arr = [...dupRows];
    const [moved] = arr.splice(dragIdx.current, 1);
    arr.splice(dragOver.current, 0, moved);
    setDupRows(arr);
    dragIdx.current = dragOver.current = null;
  };

  /* ─── Fetch ─────────────────────────────────────────────────────────── */
  const fetchDistributors = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('distributors').select('*').order('code', { ascending: true });
    if (error) Swal.fire('Error', error.message, 'error');
    else setDistributors(data || []);
    setLoading(false);
  };

  const fetchMotherAccounts = async () => {
    const { data, error } = await supabase.from('mother_account').select('id, code, name').eq('status', true).order('code', { ascending: true });
    if (!error) setMotherAccounts(data || []);
  };

  const fetchAccountUsers = async () => {
    const { data, error } = await supabase.from('Account_Users').select('id, name, "UserID"').order('name', { ascending: true }).limit(1000);
    if (!error) setAccountUsers(data || []);
  };

  useEffect(() => { fetchDistributors(); fetchMotherAccounts(); fetchAccountUsers(); }, []);

  const getNextCode = async () => {
    try {
      const { data } = await supabase.from('distributors').select('code').not('code', 'is', null).order('id', { ascending: false }).limit(1);
      if (data?.[0]?.code) {
        const n = parseInt(String(data[0].code).replace(/\D/g, ''), 10) || 0;
        return (n + 1).toString().padStart(4, '0');
      }
      return '0001';
    } catch { return '0001'; }
  };

  /* ─── Modal openers ──────────────────────────────────────────────────── */
  const openAddModal = async () => {
    const nextCode = await getNextCode();
    setForm({ ...EMPTY_FORM, code: nextCode });
    setIsEditing(false); setIsViewing(false);
    setSelectedMotherAccounts([]); setSelectedAgentUser(null); setSelectedAgentUsers([]);
    setModalOpen(true);
  };

  const populateForm = (d) => {
    setForm({
      id: d.id, code: d.code, name: d.name || '',
      description: d.description || '', agent_code: d.agent_code || '',
      mother_accounts_code: d.mother_accounts_code || '',
      slp: d.slp != null ? String(d.slp) : '',
      distributors_specialists: d.Distributors_Specialists || ''
    });
    if (d.mother_accounts_code) {
      const arr = d.mother_accounts_code.split(',').map(c => c.trim()).filter(Boolean);
      setSelectedMotherAccounts(motherAccounts.filter(ma => arr.includes(String(ma.code))).map(ma => ma.id));
    } else setSelectedMotherAccounts([]);
    if (d.agent_code) {
      const codes = d.agent_code.split(',').map(c => c.trim());
      const matched = accountUsers.filter(u => codes.includes(String(u.UserID)));
      setSelectedAgentUsers(matched); setSelectedAgentUser(matched[0] || null);
    } else { setSelectedAgentUsers([]); setSelectedAgentUser(null); }
  };

  const openEditModal = (d) => { populateForm(d); setIsEditing(true);  setIsViewing(false); setModalOpen(true); };
  const openViewModal = (d) => { populateForm(d); setIsEditing(false); setIsViewing(true);  setModalOpen(true); };

  /* ─── Form handlers ──────────────────────────────────────────────────── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);
    if (name === 'agent_code') setSelectedAgentUser(accountUsers.find(u => String(u.UserID) === value) || null);
    if (isEditing) autoSave(updated);
  };

  const handleMotherAccountToggle = (id) => {
    if (isViewing) return;
    const next = selectedMotherAccounts.includes(id)
      ? selectedMotherAccounts.filter(s => s !== id)
      : [...selectedMotherAccounts, id];
    setSelectedMotherAccounts(next);
    setForm(prev => ({ ...prev, mother_accounts_code: motherAccounts.filter(ma => next.includes(ma.id)).map(ma => ma.code).join(',') }));
  };

  useEffect(() => {
    if (isEditing && form.agent_code) {
      const codes = form.agent_code.split(',').map(c => c.trim());
      setSelectedAgentUsers(accountUsers.filter(u => codes.includes(String(u.UserID))));
    }
  }, [isEditing, form.agent_code, accountUsers]);

  const buildPayload = (f, agentUsers, selectedMA) => {
    const motherCodes = motherAccounts.filter(ma => selectedMA.includes(ma.id)).map(ma => ma.code).join(',') || null;
    const slpVal = f.slp !== '' && f.slp != null ? parseInt(f.slp, 10) : null;
    return {
      name: f.name.trim(),
      description: f.description?.trim() || null,
      agent_code: agentUsers.length > 0 ? agentUsers.map(a => a.UserID).join(',') : null,
      mother_accounts_code: motherCodes,
      slp: slpVal,
      Distributors_Specialists: f.distributors_specialists?.trim() || null
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { Swal.fire('Warning', 'Distributor name is required.', 'warning'); return; }
    const payload = buildPayload(form, selectedAgentUsers, selectedMotherAccounts);
    try {
      if (isEditing && form.id) {
        const { error } = await supabase.from('distributors').update(payload).eq('id', form.id);
        if (error) throw error;
        Swal.fire('Updated!', 'Distributor updated successfully.', 'success');
      } else {
        const code = form.code || (await getNextCode());
        const { data: ex } = await supabase.from('distributors').select('name').eq('name', form.name.trim());
        if (ex?.length) { Swal.fire('Duplicate', 'A distributor with this name already exists.', 'warning'); return; }
        const { error } = await supabase.from('distributors').insert([{ code, ...payload }]);
        if (error) throw error;
        Swal.fire('Added!', `Distributor added. (${code})`, 'success');
      }
      setModalOpen(false); await fetchDistributors();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({ title: 'Delete?', text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Yes, delete' });
    if (res.isConfirmed) {
      const { error } = await supabase.from('distributors').delete().eq('id', id);
      if (error) Swal.fire('Error', error.message, 'error');
      else { Swal.fire('Deleted!', '', 'success'); fetchDistributors(); }
    }
  };

  /* ─── Export helpers ─────────────────────────────────────────────────── */
  // Column order matches the Excel screenshot: ID, Code, SLP, Distributors Specialists, Distributor Name, Description, Agent Code, Mother Accounts Code
  const EXPORT_HEADERS = ['ID', 'Code', 'SLP', 'Distributors Specialists', 'Distributor Name', 'Description', 'Agent Name', 'Agent Code', 'Mother Accounts Code'];

  const buildExportRows = () =>
    distributors.map(d => {
      const agentNames = d.agent_code
        ? String(d.agent_code).split(',').map(c => c.trim()).filter(Boolean)
            .map(code => { const f = accountUsers.find(u => String(u.UserID) === code); return f ? f.name : code; }).join(', ')
        : '';
      return [
        d.id,
        d.code,
        d.slp ?? '',
        d.Distributors_Specialists || '',
        d.name,
        d.description || '',
        agentNames,
        d.agent_code || '',
        d.mother_accounts_code || ''
      ];
    });

  const handleExportCSV = () => {
    const rows = buildExportRows();
    const csv = [EXPORT_HEADERS.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'distributors.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleExportXLSX = () => {
    const rows = buildExportRows();
    const wsData = [EXPORT_HEADERS, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Column widths (chars)
    ws['!cols'] = [6, 10, 6, 24, 38, 38, 28, 22, 28].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Distributors');
    XLSX.writeFile(wb, 'distributors.xlsx');
  };

  /* ─── Import: normalize a row (keys already lowercased) ─────────────── */
  const normalizeRow = (row) => {
    const slpRaw = (row['slp'] ?? '').toString().trim();
    return {
      code:   row['code']?.trim() || null,
      // "Distributor Name" = our export header; "name" = generic
      name:   row['distributor name']?.trim() || row['name']?.trim() || '',
      description: row['description']?.trim() || null,
      // "Agent Code" is col H in our export; ignore "Agent Name" (display-only)
      agent_code:
        row['agent code']?.trim() || row['agentcode']?.trim() || row['agent_code']?.trim() || null,
      mother_accounts_code:
        row['mother accounts code']?.trim() || row['mother accounts']?.trim() || row['mother_accounts_code']?.trim() || null,
      slp: slpRaw && !isNaN(slpRaw) ? parseInt(slpRaw, 10) : null,
      // "Distributors Specialists" = our export header col D
      Distributors_Specialists:
        row['distributors specialists']?.trim() ||
        row['distributors_specialists']?.trim() ||
        row['distributor specialists']?.trim() || null
    };
  };

  /* Shared processor: raw rows array → dup detection → modal or direct insert */
  const processImportedRows = async (rawRows) => {
    const norm = rawRows
      .map(row => {
        const n = {};
        for (const k in row) if (k?.trim()) n[k.toLowerCase().trim()] = row[k] != null ? String(row[k]) : '';
        return n;
      })
      .filter(r => r['distributor name']?.trim() || r['name']?.trim());

    if (!norm.length) {
      Swal.fire('Notice', 'No valid rows found. Make sure the file has a "Distributor Name" or "Name" column.', 'info');
      return;
    }

    const names = norm.map(r => normalizeRow(r).name).filter(Boolean);
    const codes = norm.map(r => normalizeRow(r).code).filter(Boolean);

    const [{ data: byName, error: e1 }, codeRes] = await Promise.all([
      supabase.from('distributors').select('*').in('name', names),
      codes.length > 0 ? supabase.from('distributors').select('*').in('code', codes) : Promise.resolve({ data: [], error: null })
    ]);
    const { data: byCode, error: e2 } = codeRes;
    if (e1 || e2) { Swal.fire('Error', (e1 || e2).message, 'error'); return; }

    const nameMap = {}; (byName || []).forEach(r => { nameMap[r.name] = r; });
    const codeMap = {}; (byCode || []).forEach(r => { if (r.code) codeMap[r.code] = r; });

    const dups = [], fresh = [];
    norm.forEach(row => {
      const csv = normalizeRow(row);
      const existing = nameMap[csv.name] || (csv.code ? codeMap[csv.code] : null) || null;
      if (existing) dups.push({ csvRow: csv, existingRow: existing, action: 'skip' });
      else fresh.push(csv);
    });

    if (!dups.length) {
      const { error } = await supabase.from('distributors').insert(fresh);
      if (error) Swal.fire('Error', error.message, 'error');
      else { Swal.fire('Success', `${fresh.length} record(s) imported.`, 'success'); fetchDistributors(); }
      return;
    }
    setNewRows(fresh); setDupRows(dups); setDupModalOpen(true);
  };

  /* CSV */
  const handleImportCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => { await processImportedRows(results.data); },
      error: (err) => Swal.fire('Parse Error', err.message, 'error')
    });
    e.target.value = '';
  };

  /* XLSX / Excel */
  const handleImportXLSX = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        await processImportedRows(jsonRows);
      } catch (err) { Swal.fire('Error', 'Failed to read Excel file: ' + err.message, 'error'); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  /* ─── Dup modal actions ─────────────────────────────────────────────── */
  const handleDupActionChange = (idx, action) => setDupRows(prev => prev.map((d, i) => i === idx ? { ...d, action } : d));
  const handleSetAll = (action) => setDupRows(prev => prev.map(d => ({ ...d, action })));

  const handleConfirmImport = async () => {
    setImportProcessing(true);
    try {
      let inserted = 0, updated = 0, skipped = 0;
      if (newRows.length) {
        const { error } = await supabase.from('distributors').insert(newRows);
        if (error) throw error;
        inserted = newRows.length;
      }
      for (const dup of dupRows) {
        if (dup.action === 'update') {
          const { error } = await supabase.from('distributors').update({
            name: dup.csvRow.name,
            description: dup.csvRow.description,
            agent_code: dup.csvRow.agent_code,
            mother_accounts_code: dup.csvRow.mother_accounts_code,
            slp: dup.csvRow.slp,
            Distributors_Specialists: dup.csvRow.Distributors_Specialists,
            ...(dup.csvRow.code ? { code: dup.csvRow.code } : {})
          }).eq('id', dup.existingRow.id);
          if (error) throw error;
          updated++;
        } else skipped++;
      }
      setDupModalOpen(false);
      await fetchDistributors();
      Swal.fire({
        title: 'Import Complete!',
        html: `<div style="text-align:left;font-size:14px;line-height:2.2">✅ <b>${inserted}</b> inserted<br/>🔄 <b>${updated}</b> updated<br/>⏭️ <b>${skipped}</b> skipped</div>`,
        icon: 'success'
      });
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
    finally { setImportProcessing(false); }
  };

  const autoSave = debounce(async (f) => {
    if (!f.id || !f.name?.trim()) return;
    const slpVal = f.slp !== '' && f.slp != null ? parseInt(f.slp, 10) : null;
    await supabase.from('distributors').update({
      name: f.name.trim(), description: f.description?.trim() || null,
      agent_code: f.agent_code?.trim() || null,
      mother_accounts_code: f.mother_accounts_code || null,
      slp: slpVal,
      Distributors_Specialists: f.distributors_specialists?.trim() || null
    }).eq('id', f.id);
    fetchDistributors();
  }, 1000);

  /* ─── Filtering / pagination ────────────────────────────────────────── */
  const filteredDist = distributors.filter(d => {
    const t = searchTerm.toLowerCase();
    return (
      String(d.name || '').toLowerCase().includes(t) ||
      String(d.code || '').toLowerCase().includes(t) ||
      String(d.description || '').toLowerCase().includes(t) ||
      String(d.agent_code || '').toLowerCase().includes(t) ||
      String(d.Distributors_Specialists || '').toLowerCase().includes(t) ||
      (d.slp != null && String(d.slp).includes(t))
    );
  });

  const totalPages   = Math.max(1, Math.ceil(filteredDist.length / itemsPerPage));
  const currentItems = filteredDist.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const goToPage     = (p) => setCurrentPage(Math.min(Math.max(1, p), totalPages));

  const filteredUsers = accountUsers.filter(u => {
    const t = accountUserSearch.toLowerCase();
    return String(u.name || '').toLowerCase().includes(t) || String(u.UserID || '').toLowerCase().includes(t);
  });

  /* ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="dist-wrap" style={{ padding: '28px 24px', maxWidth: 1600, margin: '0 auto', backgroundColor: '#f8fafc', minHeight: '100vh', borderRadius: 16 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-.02em' }}>Distributor List</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{distributors.length} total distributors</p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>

        {/* Add */}
        <button className="btn btn-primary" onClick={openAddModal}>
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/></svg>
          Add Distributor
        </button>

        {/* Export CSV */}
        <button className="btn btn-success" onClick={handleExportCSV}>
          <IcoDown /> Export CSV
        </button>

        {/* Export XLSX */}
        <button className="btn btn-violet" onClick={handleExportXLSX}>
          <IcoDown /> Export XLSX
        </button>

        {/* Import toggle + button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 11, padding: '5px 12px 5px 6px' }}>
          <div className="fmt-toggle">
            <button className={importFormat === 'csv'  ? 'fmt-active-csv'  : ''} onClick={() => setImportFormat('csv')}>CSV</button>
            <button className={importFormat === 'xlsx' ? 'fmt-active-xlsx' : ''} onClick={() => setImportFormat('xlsx')}>XLSX</button>
          </div>
          {importFormat === 'csv' ? (
            <>
              <label htmlFor="imp-csv" className="btn btn-emerald" style={{ marginBottom: 0, cursor: 'pointer', padding: '7px 14px' }}>
                <IcoUp /> Import CSV
              </label>
              <input id="imp-csv" type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            </>
          ) : (
            <>
              <label htmlFor="imp-xlsx" className="btn btn-violet" style={{ marginBottom: 0, cursor: 'pointer', padding: '7px 14px' }}>
                <IcoUp /> Import XLSX
              </label>
              <input id="imp-xlsx" type="file" accept=".xlsx,.xls" onChange={handleImportXLSX} style={{ display: 'none' }} />
            </>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><IcoSearch /></span>
          <input className="dist-input" style={{ paddingLeft: 36, marginBottom: 0 }} type="text"
            placeholder="Search name, code, SLP, agent, specialist…"
            value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
        </div>

        {/* Rows per page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Rows:</span>
          <select className="dist-input" style={{ width: 70, marginBottom: 0 }} value={itemsPerPage}
            onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            {ROW_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.07)', border: '1px solid #e2e8f0' }}>
        <div style={{ overflowX: 'auto' }} className="dist-scroll">
          <table>
            <thead>
              <tr>
                {['ID','Code','SLP','Specialists','Distributor Name','Description','Agent Name','Agent Code','Mother Accounts','Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading…</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan="10" style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No distributors found</td></tr>
              ) : currentItems.map(d => {
                const agentNames = d.agent_code
                  ? String(d.agent_code).split(',').map(c => c.trim()).filter(Boolean)
                      .map(code => { const f = accountUsers.find(u => String(u.UserID) === code); return f ? f.name : code; }).join(', ')
                  : '';
                return (
                  <tr key={d.id}>
                    <td><span className="mono" style={{ color: '#94a3b8' }}>{d.id}</span></td>
                    <td><span className="badge badge-blue mono">{d.code}</span></td>
                    <td>{d.slp != null ? <span className="badge badge-amber">{d.slp}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <TooltipCell text={d.Distributors_Specialists || ''} maxChars={20} />
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{d.name}</td>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{d.description || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <TooltipCell text={agentNames} maxChars={28} />
                    <TooltipCell text={d.agent_code || ''} maxChars={22} />
                    <TooltipCell text={d.mother_accounts_code || ''} maxChars={18} />
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <IconBtn title="View"   onClick={() => openViewModal(d)}   color="#0891b2"><IcoView /></IconBtn>
                        <IconBtn title="Edit"   onClick={() => openEditModal(d)}   color="#2563eb"><IcoEdit /></IconBtn>
                        <IconBtn title="Delete" onClick={() => handleDelete(d.id)} color="#dc2626"><IcoTrash /></IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredDist.length)}–{Math.min(currentPage * itemsPerPage, filteredDist.length)} of {filteredDist.length}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-muted" style={{ padding: '7px 16px' }} onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>← Prev</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', padding: '0 8px' }}>Page {currentPage} / {totalPages}</span>
          <button className="btn btn-muted" style={{ padding: '7px 16px' }} onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>Next →</button>
        </div>
      </div>

      {/* ══ Add / Edit / View Modal ═══════════════════════════════════════════ */}
      {modalOpen && (
        <div className="dist-overlay" onClick={() => setModalOpen(false)}>
          <div className="dist-modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                {isViewing ? '👁 View Distributor' : isEditing ? '✏️ Edit Distributor' : '➕ Add Distributor'}
              </h3>
            </div>
            <div style={{ padding: '20px 24px 24px' }}>
              <form onSubmit={handleSubmit}>

                {/* Row: Code + SLP */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label className="dist-label">Code</label>
                    <input className="dist-input" type="text" name="code" value={form.code} disabled readOnly />
                  </div>
                  <div>
                    <label className="dist-label">SLP</label>
                    <input className="dist-input" type="number" name="slp" value={form.slp} onChange={handleChange} disabled={isViewing} placeholder="Enter SLP" min="0" />
                  </div>
                </div>

                {/* Distributors Specialists */}
                <div style={{ marginBottom: 16 }}>
                  <label className="dist-label" style={{ color: '#7c3aed' }}>🏷 Distributors Specialists</label>
                  <input
                    className="dist-input"
                    style={{ borderColor: form.distributors_specialists && !isViewing ? '#a78bfa' : undefined }}
                    type="text"
                    name="distributors_specialists"
                    value={form.distributors_specialists}
                    onChange={handleChange}
                    disabled={isViewing}
                    placeholder="e.g. ALFREDO DEL PRADO"
                  />
                </div>

                {/* Distributor Name */}
                <div style={{ marginBottom: 16 }}>
                  <label className="dist-label">Distributor Name *</label>
                  <input className="dist-input" type="text" name="name" value={form.name} onChange={handleChange} required disabled={isViewing} />
                </div>

                {/* Description */}
                <div style={{ marginBottom: 16 }}>
                  <label className="dist-label">Description</label>
                  <textarea className="dist-input" style={{ height: 60, resize: 'vertical' }} name="description" value={form.description} onChange={handleChange} disabled={isViewing} />
                </div>

                {/* Agent Code */}
                <div style={{ marginBottom: 16 }}>
                  <label className="dist-label">Agent Code</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="dist-input" style={{ flex: 1, marginBottom: 0 }} type="text" name="agent_code" value={form.agent_code} onChange={handleChange} disabled={isViewing} placeholder="UserID(s)" />
                    <button type="button" className="btn btn-primary btn-icon"
                      onClick={() => { if (!isViewing) { fetchAccountUsers(); setAccountUserSearch(''); setUserModalOpen(true); } }}
                      disabled={isViewing} title="Pick agent">
                      <IcoSearch />
                    </button>
                  </div>
                  {selectedAgentUsers.length > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      {selectedAgentUsers.map(u => <div key={u.id} style={{ fontSize: 13, color: '#1d4ed8' }}>👤 <b>{u.UserID}</b> — {u.name}</div>)}
                    </div>
                  )}
                </div>

                {/* Mother Accounts */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="dist-label" style={{ margin: 0 }}>Mother Accounts</label>
                    {!isViewing && (
                      <button type="button" className="btn btn-muted" style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => {
                          if (selectedMotherAccounts.length === motherAccounts.length) {
                            setSelectedMotherAccounts([]); setForm(p => ({ ...p, mother_accounts_code: '' }));
                          } else {
                            setSelectedMotherAccounts(motherAccounts.map(m => m.id));
                            setForm(p => ({ ...p, mother_accounts_code: motherAccounts.map(m => m.code).join(',') }));
                          }
                        }}>
                        {selectedMotherAccounts.length === motherAccounts.length ? 'Uncheck All' : 'Check All'}
                      </button>
                    )}
                  </div>
                  <div className="dist-scroll" style={{ maxHeight: 150, overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', background: '#fafafa' }}>
                    {motherAccounts.map(ma => {
                      const checked = selectedMotherAccounts.includes(ma.id);
                      return (
                        <label key={ma.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: isViewing ? 'default' : 'pointer', fontSize: 13.5, color: '#334155' }}>
                          <input type="checkbox" checked={checked} onChange={() => handleMotherAccountToggle(ma.id)} disabled={isViewing} style={{ accentColor: '#2563eb', width: 15, height: 15 }} />
                          <span className="mono" style={{ color: '#2563eb', marginRight: 4 }}>{ma.code}</span> {ma.name}
                        </label>
                      );
                    })}
                  </div>
                  <input className="dist-input" style={{ marginTop: 8 }} type="text" value={form.mother_accounts_code} readOnly disabled placeholder="Auto-filled from selection" />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                  <button type="button" className="btn btn-muted" onClick={() => setModalOpen(false)}>Close</button>
                  {!isViewing && <button type="submit" className="btn btn-primary">{isEditing ? 'Save Changes' : 'Add Distributor'}</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ Agent Picker Modal ════════════════════════════════════════════════ */}
      {userModalOpen && (
        <div className="dist-overlay" style={{ zIndex: 1050 }} onClick={() => setUserModalOpen(false)}>
          <div className="dist-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Select Agent(s)</h4>
              <span className="badge badge-blue">{selectedAgentUsers.length} selected</span>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <input className="dist-input" style={{ marginBottom: 12 }} placeholder="Search by name or UserID…" value={accountUserSearch} onChange={e => setAccountUserSearch(e.target.value)} />
              <div className="dist-scroll" style={{ maxHeight: '45vh', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 44, background: '#f8fafc', color: '#475569' }}>✓</th>
                      <th style={{ background: '#f8fafc', color: '#475569' }}>UserID</th>
                      <th style={{ background: '#f8fafc', color: '#475569' }}>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No users found</td></tr>
                    ) : filteredUsers.map(u => {
                      const isSel = selectedAgentUsers.some(a => a.id === u.id);
                      return (
                        <tr key={u.id} style={{ cursor: 'pointer', background: isSel ? '#eff6ff' : '' }}
                          onClick={() => setSelectedAgentUsers(prev => isSel ? prev.filter(a => a.id !== u.id) : [...prev, u])}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={isSel} readOnly style={{ accentColor: '#2563eb', width: 16, height: 16 }} />
                          </td>
                          <td><span className="mono badge badge-blue">{u.UserID}</span></td>
                          <td style={{ fontWeight: isSel ? 600 : 400 }}>{u.name}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => {
                  setForm(prev => ({ ...prev, agent_code: selectedAgentUsers.map(u => u.UserID).join(',') }));
                  setUserModalOpen(false);
                }}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Duplicate Review Modal (Drag & Drop) ═════════════════════════════ */}
      {dupModalOpen && (
        <div className="dist-overlay" style={{ zIndex: 1100 }} onClick={() => !importProcessing && setDupModalOpen(false)}>
          <div className="dist-modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #fde68a', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 700, color: '#92400e' }}>⚠️ Duplicate Records Detected</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#78350f' }}>
                    Drag to reorder &nbsp;·&nbsp;
                    <span style={{ color: '#166534', fontWeight: 700 }}>{newRows.length} new</span>
                    &nbsp;·&nbsp;
                    <span style={{ color: '#b45309', fontWeight: 700 }}>{dupRows.length} duplicate(s)</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => handleSetAll('update')}>🔄 Update All</button>
                  <button className="btn btn-muted"   onClick={() => handleSetAll('skip')}>⏭️ Skip All</button>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px' }}>

              {/* New rows summary */}
              {newRows.length > 0 && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>✅ Will auto-insert:</span>
                  {newRows.map((r, i) => <span key={i} className="badge badge-green">{r.code ? `[${r.code}] ` : ''}{r.name}</span>)}
                </div>
              )}

              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcoDrag /> Drag rows by the handle to reprioritize
              </div>

              <div className="dist-scroll" style={{ maxHeight: '42vh', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: 12 }}>
                <table style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36, background: '#1a57ff' }}></th>
                      <th style={{ background: '#1a57ff' }}>#</th>
                      <th style={{ background: '#1a57ff' }}>📥 Incoming</th>
                      <th style={{ background: '#1a57ff' }}>🗄️ Existing in DB</th>
                      <th style={{ background: '#1a57ff', textAlign: 'center', width: 170 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dupRows.map((dup, idx) => (
                      <tr key={idx} className="dup-row" draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragEnter={() => handleDragEnter(idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => e.preventDefault()}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', verticalAlign: 'top' }}>

                        <td style={{ textAlign: 'center', padding: '12px 4px' }}><span className="drag-handle"><IcoDrag /></span></td>
                        <td style={{ padding: '12px 10px', color: '#94a3b8', fontWeight: 700, fontFamily: 'DM Mono' }}>{idx + 1}</td>

                        {/* Incoming */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 3 }}>{dup.csvRow.name}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 3 }}>
                            {dup.csvRow.code && <span className="badge badge-blue">Code: {dup.csvRow.code}</span>}
                            {dup.csvRow.slp != null && <span className="badge badge-amber">SLP: {dup.csvRow.slp}</span>}
                            {dup.csvRow.Distributors_Specialists && <span className="badge badge-violet">🏷 {dup.csvRow.Distributors_Specialists}</span>}
                          </div>
                          {dup.csvRow.description && <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>{dup.csvRow.description.length > 52 ? dup.csvRow.description.substring(0, 52) + '…' : dup.csvRow.description}</div>}
                        </td>

                        {/* Existing */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 3 }}>{dup.existingRow.name}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 3 }}>
                            {dup.existingRow.code && <span className="badge badge-green">Code: {dup.existingRow.code}</span>}
                            {dup.existingRow.slp != null && <span className="badge badge-amber">SLP: {dup.existingRow.slp}</span>}
                            {dup.existingRow.Distributors_Specialists && <span className="badge badge-violet">🏷 {dup.existingRow.Distributors_Specialists}</span>}
                          </div>
                          {dup.existingRow.description && <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>{dup.existingRow.description.length > 52 ? dup.existingRow.description.substring(0, 52) + '…' : dup.existingRow.description}</div>}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div className="action-pill">
                            <button className={dup.action === 'update' ? 'active-update' : ''} onClick={() => handleDupActionChange(idx, 'update')}>🔄 Update</button>
                            <button className={dup.action === 'skip'   ? 'active-skip'   : ''} onClick={() => handleDupActionChange(idx, 'skip')}>⏭️ Skip</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 16, padding: '14px 18px', background: '#f8fafc', borderRadius: 12, border: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 20, fontSize: 13, fontWeight: 600 }}>
                  <span>✅ Insert: <span style={{ color: '#166534' }}>{newRows.length}</span></span>
                  <span>🔄 Update: <span style={{ color: '#2563eb' }}>{dupRows.filter(d => d.action === 'update').length}</span></span>
                  <span>⏭️ Skip: <span style={{ color: '#64748b' }}>{dupRows.filter(d => d.action === 'skip').length}</span></span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-muted" onClick={() => setDupModalOpen(false)} disabled={importProcessing}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleConfirmImport} disabled={importProcessing}
                    style={{ opacity: importProcessing ? .7 : 1, minWidth: 160 }}>
                    {importProcessing ? '⏳ Processing…' : '✅ Confirm Import'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Distributor;
