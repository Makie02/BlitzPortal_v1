import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function AdminDistributorAccess() {
  const [users, setUsers] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [accessMap, setAccessMap] = useState({}); // { UserID: Set(distributor_ids) }
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [positionMap, setPositionMap] = useState({}); // { code: name }
  const [userSearch, setUserSearch] = useState("");
  const [distSearch, setDistSearch] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch ALL users
      const { data: usersData, error: uErr } = await supabase
        .from("Account_Users")
        .select('id, "UserID", name, email, username, "profilePicture", position, "isActive"')
        .order("name");

      if (uErr) throw uErr;

      // Fetch ALL distributors
      const { data: distsData, error: dErr } = await supabase
        .from("distributors")
        .select("id, name, code, agent_code, sap_vendor_code")
        .order("name");

      if (dErr) throw dErr;

      // Fetch existing access records — correct lowercase table name
      const { data: accessData, error: aErr } = await supabase
        .from("accounting_account_access_for_distributor")
        .select("user_id, distributor_id");

      if (aErr) throw aErr;

      // Build accessMap { UserID: Set(distributor_ids) }
      const map = {};
      (accessData || []).forEach(({ user_id, distributor_id }) => {
        if (!map[user_id]) map[user_id] = new Set();
        map[user_id].add(distributor_id);
      });

      setUsers(usersData || []);
      setDistributors(distsData || []);
      setAccessMap(map);

      // Fetch positions for display names
      const { data: posData, error: pErr } = await supabase
        .from("position")
        .select("code, name");

      if (pErr) throw pErr;

      // Build positionMap { code: name }
      const pMap = {};
      (posData || []).forEach(({ code, name }) => { pMap[code] = name; });
      setPositionMap(pMap);

      if (usersData && usersData.length > 0) {
        setSelectedUser(usersData[0]);
      }
    } catch (err) {
      showToast(err.message || "Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleDistributor = (distId) => {
    if (!selectedUser) return;
    const uid = selectedUser.UserID;
    setAccessMap((prev) => {
      const updated = { ...prev };
      const current = new Set(updated[uid] || []);
      if (current.has(distId)) {
        current.delete(distId);
      } else {
        current.add(distId);
      }
      updated[uid] = current;
      return updated;
    });
  };

  const selectAllVisible = () => {
    if (!selectedUser) return;
    const uid = selectedUser.UserID;
    setAccessMap((prev) => {
      const updated = { ...prev };
      const current = new Set(updated[uid] || []);
      filteredDists.forEach((d) => current.add(d.id));
      updated[uid] = current;
      return updated;
    });
  };

  const clearAll = () => {
    if (!selectedUser) return;
    const uid = selectedUser.UserID;
    setAccessMap((prev) => ({ ...prev, [uid]: new Set() }));
  };

  const saveAccess = async () => {
    if (!selectedUser) return;
    setSaving(true);
    const uid = selectedUser.UserID; // bigint — matches user_id FK
    const assignedIds = Array.from(accessMap[uid] || []);

    try {
      // Delete existing access for this user
      const { error: delErr } = await supabase
        .from("accounting_account_access_for_distributor")
        .delete()
        .eq("user_id", uid);

      if (delErr) throw delErr;

      // Insert new access rows
      if (assignedIds.length > 0) {
        const rows = assignedIds.map((did) => ({
          user_id: uid,
          distributor_id: did,
        }));
        const { error: insErr } = await supabase
          .from("accounting_account_access_for_distributor")
          .insert(rows);
        if (insErr) throw insErr;
      }

      showToast(`✓ Saved access for ${selectedUser.name || selectedUser.username}!`);
    } catch (err) {
      showToast(err.message || "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const getAssignedCount = (uid) => (accessMap[uid] ? accessMap[uid].size : 0);

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.position?.toLowerCase().includes(q)
    );
  });

  const filteredDists = distributors.filter((d) => {
    const q = distSearch.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.code?.toLowerCase().includes(q) ||
      d.agent_code?.toLowerCase().includes(q) ||
      d.sap_vendor_code?.toLowerCase().includes(q)
    );
  });

  const currentAccess = selectedUser ? accessMap[selectedUser.UserID] || new Set() : new Set();
  const assignedCount = currentAccess.size;
  const progressPct = distributors.length > 0 ? Math.round((assignedCount / distributors.length) * 100) : 0;

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .user-item:hover { background: #f0f9ff !important; }
        .dist-item:hover { background: #f8fafc !important; }
        .btn-save:hover { background: #1e40af !important; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === "error" ? "#ef4444" : "#10b981",
          animation: "fadeUp 0.3s ease",
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerEmoji}>🛡️</span>
          <div>
            <h1 style={s.headerTitle}>Distributor Access Control</h1>
            <p style={s.headerSub}>Admin · Assign which distributors each user can see</p>
          </div>
        </div>
        <div style={s.statRow}>
          <div style={s.statBox}>
            <span style={s.statNum}>{users.length}</span>
            <span style={s.statLabel}>Users</span>
          </div>
          <div style={{ ...s.statBox, background: "#f0fdf4", border: "1.5px solid #86efac" }}>
            <span style={{ ...s.statNum, color: "#16a34a" }}>{distributors.length}</span>
            <span style={s.statLabel}>Distributors</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={s.loadWrap}>
          <div style={s.spinner} />
          <span style={{ color: "#64748b", fontSize: 15 }}>Loading users and distributors...</span>
        </div>
      ) : (
        <div style={s.layout}>

          {/* ── LEFT: Users ── */}
          <div style={s.panel}>
            <div style={s.panelHead}>
              <span style={s.panelTitle}>All Users</span>
              <span style={s.panelCount}>{filteredUsers.length}</span>
            </div>
            <div style={s.searchRow}>
              <span>🔍</span>
              <input
                style={s.searchInput}
                placeholder="Search name, position..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <div style={s.listScroll}>
              {filteredUsers.length === 0 && (
                <div style={s.emptyList}>No users found.</div>
              )}
              {filteredUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                const count = getAssignedCount(u.UserID);
                return (
                  <div
                    key={u.id}
                    className="user-item"
                    onClick={() => setSelectedUser(u)}
                    style={{
                      ...s.userItem,
                      background: isSelected ? "#e0f2fe" : "#fff",
                      borderLeft: isSelected ? "4px solid #0ea5e9" : "4px solid transparent",
                    }}
                  >
                    <div style={s.avatar}>
                      {u.profilePicture ? (
                        <img src={u.profilePicture} style={s.avatarImg} alt="" />
                      ) : (
                        <span style={s.avatarLetter}>
                          {(u.name || u.username || "?")[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={s.userInfo}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={s.userName}>{u.name || u.username || "—"}</span>
                        {u.position && (
                          <span style={{
                            ...s.posBadge,
                            background: positionMap[u.position]?.toLowerCase() === "accounting"
                              ? "#dbeafe" : positionMap[u.position]?.toLowerCase() === "admin"
                              ? "#fce7f3" : "#f1f5f9",
                            color: positionMap[u.position]?.toLowerCase() === "accounting"
                              ? "#1d4ed8" : positionMap[u.position]?.toLowerCase() === "admin"
                              ? "#be185d" : "#475569",
                          }}>
                            {positionMap[u.position] || u.position}
                          </span>
                        )}
                      </div>
                      <span style={s.userEmail}>{u.email || u.username || ""}</span>
                    </div>
                    <span style={{
                      ...s.countBadge,
                      background: count > 0 ? "#dbeafe" : "#f1f5f9",
                      color: count > 0 ? "#1d4ed8" : "#94a3b8",
                    }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: Distributors ── */}
          <div style={s.panel}>
            {!selectedUser ? (
              <div style={s.noSel}>
                <span style={{ fontSize: 40 }}>👈</span>
                <p style={{ color: "#94a3b8", marginTop: 12 }}>Select a user to manage access</p>
              </div>
            ) : (
              <>
                <div style={s.rightHead}>
                  <div>
                    <h2 style={s.rightName}>{selectedUser.name || selectedUser.username}</h2>
                    <p style={s.rightSub}>
                      {assignedCount} of {distributors.length} distributors assigned
                    </p>
                  </div>
                  <div style={s.rightBtns}>
                    <button style={s.btnOutlineGreen} onClick={selectAllVisible}>Select All</button>
                    <button style={s.btnOutlineRed} onClick={clearAll}>Clear All</button>
                    <button
                      className="btn-save"
                      style={s.btnSave}
                      onClick={saveAccess}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "💾 Save"}
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div style={s.progressRow}>
                  <div style={s.progressBg}>
                    <div style={{ ...s.progressFill, width: `${progressPct}%` }} />
                  </div>
                  <span style={s.progressLabel}>{progressPct}%</span>
                </div>

                <div style={s.searchRow}>
                  <span>🔍</span>
                  <input
                    style={s.searchInput}
                    placeholder="Search distributor..."
                    value={distSearch}
                    onChange={(e) => setDistSearch(e.target.value)}
                  />
                </div>

                <div style={s.listScroll}>
                  {filteredDists.length === 0 && (
                    <div style={s.emptyList}>No distributors found.</div>
                  )}
                  {filteredDists.map((d) => {
                    const checked = currentAccess.has(d.id);
                    return (
                      <div
                        key={d.id}
                        className="dist-item"
                        onClick={() => toggleDistributor(d.id)}
                        style={{
                          ...s.distItem,
                          background: checked ? "#f0fdf4" : "#fff",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{
                          ...s.checkbox,
                          background: checked ? "#22c55e" : "#fff",
                          borderColor: checked ? "#22c55e" : "#cbd5e1",
                        }}>
                          {checked && <span style={s.checkmark}>✓</span>}
                        </div>
                        <div style={s.distInfo}>
                          <span style={s.distName}>{d.name}</span>
                          <div style={s.distCodes}>
                            {d.code && <code style={s.codeChip}>{d.code}</code>}
                            {d.agent_code && (
                              <code style={{ ...s.codeChip, background: "#fef3c7", color: "#92400e" }}>
                                {d.agent_code}
                              </code>
                            )}
                            {d.sap_vendor_code && (
                              <code style={{ ...s.codeChip, background: "#eff6ff", color: "#1d4ed8" }}>
                                SAP: {d.sap_vendor_code}
                              </code>
                            )}
                          </div>
                        </div>
                        <span style={{
                          ...s.accessTag,
                          background: checked ? "#dcfce7" : "#f1f5f9",
                          color: checked ? "#15803d" : "#94a3b8",
                        }}>
                          {checked ? "✓ Access" : "No Access"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

const s = {
  root: { fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px" },
  toast: { position: "fixed", top: 20, right: 20, zIndex: 9999, color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 14 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerEmoji: { fontSize: 34 },
  headerTitle: { fontSize: 22, fontWeight: 700, color: "#0f172a" },
  headerSub: { fontSize: 13, color: "#64748b", marginTop: 3 },
  statRow: { display: "flex", gap: 10 },
  statBox: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 18px", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12 },
  statNum: { fontSize: 22, fontWeight: 700, color: "#1d4ed8", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 3, fontWeight: 500 },
  loadWrap: { display: "flex", alignItems: "center", gap: 12, justifyContent: "center", padding: 80 },
  spinner: { width: 22, height: 22, border: "3px solid #e2e8f0", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  layout: { display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" },
  panel: { background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 10px", borderBottom: "1px solid #f1f5f9" },
  panelTitle: { fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" },
  panelCount: { background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
  searchRow: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fafafa", borderBottom: "1px solid #f1f5f9", fontSize: 14 },
  searchInput: { flex: 1, border: "none", background: "transparent", fontSize: 13, color: "#334155", outline: "none", fontFamily: "'DM Sans', sans-serif" },
  listScroll: { maxHeight: "calc(100vh - 300px)", overflowY: "auto", padding: "6px 0" },
  emptyList: { textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 },
  userItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f8fafc", transition: "background 0.12s" },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  avatarLetter: { fontSize: 14, fontWeight: 700, color: "#0369a1" },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontWeight: 700, fontSize: 13, color: "#0f172a" },
  posBadge: { fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 },
  userEmail: { display: "block", fontSize: 11, color: "#94a3b8", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  countBadge: { padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 },
  noSel: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, textAlign: "center" },
  rightHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 18px 12px", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 10 },
  rightName: { fontSize: 17, fontWeight: 700, color: "#0f172a" },
  rightSub: { fontSize: 12, color: "#64748b", marginTop: 3 },
  rightBtns: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  btnOutlineGreen: { background: "#f0fdf4", color: "#15803d", border: "1.5px solid #86efac", padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnOutlineRed: { background: "#fff1f2", color: "#be123c", border: "1.5px solid #fda4af", padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnSave: { background: "#1d4ed8", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(29,78,216,0.25)", transition: "background 0.15s" },
  progressRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "#fafafa", borderBottom: "1px solid #f1f5f9" },
  progressBg: { flex: 1, height: 7, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 99, transition: "width 0.3s ease" },
  progressLabel: { fontSize: 11, fontWeight: 700, color: "#64748b", fontFamily: "'JetBrains Mono', monospace", minWidth: 34 },
  distItem: { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", transition: "all 0.12s" },
  checkbox: { width: 20, height: 20, borderRadius: 5, border: "2px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1 },
  distInfo: { flex: 1, minWidth: 0 },
  distName: { display: "block", fontWeight: 600, fontSize: 13, color: "#0f172a" },
  distCodes: { display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap" },
  codeChip: { background: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
  accessTag: { padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 },
};
