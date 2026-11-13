import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FaCheckCircle, FaSearch, FaCalendarAlt, FaFileExcel, FaFilePdf } from "react-icons/fa";

// Source ng details (second page) per activity:
// "sku" → regular_sku | "budget" → regular_accountlis_badget (store + budget)
const SUMMARY_GROUPS = {
  "Listing Fee": { source: "sku" },
  "Bundling": { source: "sku" },
  "Penalty": { source: "budget", extra: { col: "penalty", label: "PENALTY" } },
  "Supplies / Material Expense": { source: "budget", extra: { col: "suppliesme", label: "SUPPLIES / MATERIAL EXPENSE" } },
  "Display Allowance": { source: "budget" },
  "Change Vendor Fee": { source: "budget" },
};
// mga special (may sariling source/extra); lahat ng ibang activity = "budget" (store + budget)
const SPECIAL_ACTIVITIES = Object.keys(SUMMARY_GROUPS);
const getGroupCfg = (title) => SUMMARY_GROUPS[title] || { source: "budget" };

const getSummaryKey = (item, activityMap) => {
  const rawName = (activityMap[String(item.activity_code)] || "").trim();
  const actName = rawName.toLowerCase().replace(/\s+/g, " ");
  if (!actName) return null;
  if (actName.includes("listing fee")) return "Listing Fee";
  if (actName.includes("bundling")) return "Bundling";
  if (actName.includes("display allowance")) return "Display Allowance";
  if (/change\s*(distributor|vendor)/.test(actName)) return "Change Vendor Fee";
  if (actName.includes("penalt")) return "Penalty";
  if (/suppl|material expense/.test(actName)) return "Supplies / Material Expense";
  // lahat ng iba: gamitin mismo ang pangalan ng activity (hal. "ANNIVERSARY SUPPORT")
  return rawName;
};

// penalty / suppliesme pwedeng array, JSON string, o plain text
const fmtList = (v) => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "-";
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { const arr = JSON.parse(v); if (Array.isArray(arr)) return arr.length ? arr.join(", ") : "-"; } catch (e) { /* plain text */ }
  }
  return v ? String(v) : "-";
};

// branchType pwedeng array, JSON string, o double-encoded → gawing malinis na listahan ng stores
const parseStoreList = (v, depth = 0) => {
  if (v == null || depth > 5) return [];
  if (Array.isArray(v)) return v.flatMap(x => parseStoreList(x, depth + 1));
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("[") || t.startsWith('"')) {
      try { return parseStoreList(JSON.parse(t), depth + 1); } catch (e) { /* plain text */ }
    }
    return t ? [t] : [];
  }
  return [String(v)];
};

// SKU Data source: regular_sku (sinusulat ng RegularVisaForm → handleSku)
const SKU_CONFIG = {
  table: "regular_sku",
  pwpColumn: "regular_code",   // PWP code (hal. R2026-11667)
  idCol: "id",
  accountCol: "account_name",
  skuCol: "sku_code",
  amountCol: "total_amount",
};

// Display Allowance / Change Vendor Fee: Store + Budget Amount lang
// (sinusulat ng RegularVisaForm → submit_all → regular_accountlis_badget)
const BUDGET_CONFIG = {
  table: "regular_accountlis_badget",
  pwpColumn: "regularcode",
  accountCol: "account_name",
  amountCol: "budget",
};

const ApprovalList = () => {
  const [approvalData, setApprovalData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [accountUsers, setAccountUsers] = useState([]);
  const [distributorMap, setDistributorMap] = useState({});
  const [activityMap, setActivityMap] = useState({});
  const [activeTab, setActiveTab] = useState("history"); // "history" | "summary"
  const [activityFilter, setActivityFilter] = useState("All"); // summary tab: All | Listing Fee | ...
  const [dateBasis, setDateBasis] = useState("created_at");    // created_at | DateResponded
  const [summaryPages, setSummaryPages] = useState({});        // per-table page
  const summaryRowsPerPage = 10;
  const [expandedRows, setExpandedRows] = useState({});   // rowKey → true (dropdown open)
  const [detailsCache, setDetailsCache] = useState({});     // `${mode}|${PwpCode}` → { loading, error, rows }
  const [summaryDetails, setSummaryDetails] = useState({ sku: {}, budget: {} }); // source → PwpCode → rows
  const [summaryDetailsLoading, setSummaryDetailsLoading] = useState(false);
  // ── Remarks Modal ──────────────────────────────────────────
  const [selectedRemarks, setSelectedRemarks] = useState(null);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  // ─────────────────────────────────────────────────────────

  // ── Accounting Access ─────────────────────────────────────────
  const [assignedDistributorCodes, setAssignedDistributorCodes] = useState(null);
  const [isAccessLoaded, setIsAccessLoaded] = useState(false);

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('loggedInUser')), []);
  const currentUserId = currentUser?.UserID ? Number(currentUser.UserID) : null;
  const role = currentUser?.role || "";

  useEffect(() => {
    const fetchAccountingAccess = async () => {
      if (!currentUser) { setIsAccessLoaded(true); return; }

      const posCode = currentUser.position || "";
      const uid = currentUser.UserID || currentUser.id;

      try {
        const { data: posData } = await supabase
          .from("position")
          .select("name")
          .eq("code", posCode)
          .single();

        const posName = (posData?.name || "").toLowerCase().trim();

        if (!posName.includes("account")) {
          setAssignedDistributorCodes(null);
          setIsAccessLoaded(true);
          return;
        }

        const { data: accessRows, error: accessErr } = await supabase
          .from("accounting_account_access_for_distributor")
          .select("distributor_id")
          .eq("user_id", uid);

        if (accessErr) throw accessErr;

        const distIds = (accessRows || []).map(r => r.distributor_id);

        if (distIds.length === 0) {
          setAssignedDistributorCodes(new Set());
          setIsAccessLoaded(true);
          return;
        }

        const { data: distRows, error: distErr } = await supabase
          .from("distributors")
          .select("id, code")
          .in("id", distIds);

        if (distErr) throw distErr;

        const codes = (distRows || []).map(d => String(d.code));
        setAssignedDistributorCodes(new Set(codes));
      } catch (err) {
        console.error("Error fetching accounting access:", err);
        setAssignedDistributorCodes(new Set());
      } finally {
        setIsAccessLoaded(true);
      }
    };

    fetchAccountingAccess();
  }, [currentUser]);
  // ─────────────────────────────────────────────────────────────

  // Fetch distributor map
  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase.from("distributors").select("code, name");
      if (error) { console.error("Error fetching distributors:", error); return; }
      const map = {};
      data.forEach(d => { map[String(d.code)] = d.name; });
      setDistributorMap(map);
    };
    fetchDistributors();
  }, []);

  // Fetch activity map
  useEffect(() => {
    const fetchActivities = async () => {
      const { data, error } = await supabase.from("activity").select("code, name");
      if (error) { console.error("Error fetching activities:", error); return; }
      const map = {};
      data.forEach(a => { map[String(a.code)] = a.name; });
      setActivityMap(map);
    };
    fetchActivities();
  }, []);

  useEffect(() => {
    const fetchAccountUsers = async () => {
      try {
        let allData = [];
        let hasMore = true;
        let offset = 0;
        const batchSize = 1000;

        while (hasMore) {
          const { data, error } = await supabase
            .from("Account_Users")
            .select("UserID, name")
            .range(offset, offset + batchSize - 1);

          if (error) { console.error("Error fetching account users:", error); break; }

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        setAccountUsers(allData);
      } catch (err) {
        console.error("Unexpected error fetching account users:", err);
      }
    };
    fetchAccountUsers();
  }, []);

  const userIdToNameMap = useMemo(() => {
    const map = new Map();
    accountUsers.forEach(u => {
      if (u.UserID && u.name) map.set(Number(u.UserID), u.name);
    });
    return map;
  }, [accountUsers]);

  const getUserNameById = (userId) => {
    if (!userId) return '-';
    const name = userIdToNameMap.get(Number(userId));
    return name || String(userId);
  };

  // Fetch Approval_History + join PWP details
  useEffect(() => {
    if (!isAccessLoaded) return;

    const fetchApprovals = async () => {
      setLoading(true);
      setError(null);

      try {
        let allData = [];
        let hasMore = true;
        let offset = 0;
        const batchSize = 1000;

        while (hasMore) {
          const { data, error } = await supabase
            .from("Approval_History")
            .select("*")
            .order("created_at", { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        // ── Enrich with PWP details (distributor, activity, amount, branchType) ──
        const pwpCodes = [...new Set(allData.map(r => r.PwpCode).filter(Boolean))];

        let regularMap = {};
        let coverMap = {};

        if (pwpCodes.length > 0) {
          for (let i = 0; i < pwpCodes.length; i += 1000) {
            const batch = pwpCodes.slice(i, i + 1000);

            const [{ data: regData }, { data: covData }] = await Promise.all([
              supabase
                .from("regular_pwp")
                .select('regularpwpcode, distributor, activity, credit_budget, branchType, "activityDurationFrom", "activityDurationTo"')
                .in("regularpwpcode", batch),
              supabase
                .from("cover_pwp")
                .select("cover_code, distributor, activity, credit_budget")
                .in("cover_code", batch),
            ]);

            (regData || []).forEach(r => {
              regularMap[r.regularpwpcode] = r;
            });
            (covData || []).forEach(r => {
              coverMap[r.cover_code] = r;
            });
          }
        }

        const enriched = allData.map(item => {
          const pwpDetail = regularMap[item.PwpCode] || coverMap[item.PwpCode] || {};
          return {
            ...item,
            distributor: pwpDetail.distributor || null,
            activity_code: pwpDetail.activity || null,
            credit_budget: pwpDetail.credit_budget || null,
            branchType: pwpDetail.branchType || null,
            storeName: pwpDetail.branchType || null, // ⚠️ palitan ng actual store name column
            skus: pwpDetail.skus || null,            // ⚠️ palitan ng actual SKU source
            activityDurationFrom: pwpDetail.activityDurationFrom || null,
            activityDurationTo: pwpDetail.activityDurationTo || null,
            pwpType: regularMap[item.PwpCode] ? "Regular" : coverMap[item.PwpCode] ? "Cover" : "-",
          };
        });

        setApprovalData(enriched);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching approvals:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [isAccessLoaded]);

  // Filter logic
  useEffect(() => {
    let filtered = approvalData;

    // ── Accounting restriction ────────────────────────────────
    if (assignedDistributorCodes !== null) {
      filtered = filtered.filter(item =>
        assignedDistributorCodes.has(String(item.distributor))
      );
    }
    // ─────────────────────────────────────────────────────────

    // Role filter (non-admin sees own records only, unless accounting)
    if (role !== "admin" && assignedDistributorCodes === null) {
      filtered = filtered.filter(item => {
        const createdForm = item.CreatedForm;
        if (!createdForm) return false;
        return Number(createdForm) === currentUserId;
      });
    }

    if (activeTab === "summary") {
      const seenPwp = new Set();
      filtered = filtered.filter(item => {
            if (item.Response !== "Approved") return false;
        if (item.pwpType !== "Regular") return false;
        const key = getSummaryKey(item, activityMap);
        if (!key) return false;
        if (activityFilter !== "All" && key !== activityFilter) return false;
        // isang beses lang kada PWP (may multiple approval rows minsan)
        if (seenPwp.has(item.PwpCode)) return false;
        seenPwp.add(item.PwpCode);
        return true;
      });
    } else if (filterStatus !== "All") {
      filtered = filtered.filter(item => item.Response === filterStatus);
    }

    filtered = filtered.filter(item => {
      const matchesSearch =
        item.PwpCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Response?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (distributorMap[String(item.distributor)] || "").toLowerCase().includes(searchTerm.toLowerCase());

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const rawDate = item[dateBasis];
        if (!rawDate) return false;
        const itemDate = new Date(rawDate);
        if (dateFrom && itemDate < new Date(dateFrom)) matchesDate = false;
        if (dateTo && itemDate > new Date(dateTo + 'T23:59:59')) matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });

    setFilteredData(filtered);
    setCurrentPage(1);
    setSummaryPages({});
    setExpandedRows({});
  }, [approvalData, searchTerm, dateFrom, dateTo, currentUserId, role,
      filterStatus, assignedDistributorCodes, distributorMap, activeTab,
      activityFilter, dateBasis, activityMap]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // ── Summary grouping (Listing Fee / Display Allowance / Change Vendor Fee) ──
    const summaryGroups = useMemo(() => {
    const groups = {};
    filteredData.forEach(item => {
      const key = getSummaryKey(item, activityMap);
      if (!key) return;
      (groups[key] = groups[key] || []).push(item);
    });
    return groups;
  }, [filteredData, activityMap]);

  // listahan ng lahat ng activity na may approved PWP (special muna, tapos alphabetical)
  // listahan ng activity na may approved PWP (base sa approvalData para laging kumpleto ang buttons)
  const summaryActivities = useMemo(() => {
    const names = new Set();
    approvalData.forEach(item => {
      if (item.Response !== "Approved" || item.pwpType !== "Regular") return;
      const k = getSummaryKey(item, activityMap);
      if (k) names.add(k);
    });
    const others = [...names].filter(k => !SPECIAL_ACTIVITIES.includes(k)).sort();
    return [...SPECIAL_ACTIVITIES.filter(k => names.has(k)), ...others];
  }, [approvalData, activityMap]);
  useEffect(() => {
    if (activeTab !== "summary") return;
    let cancelled = false;
    const run = async () => {
      const skuCodes = new Set();
      const budgetCodes = new Set();
      Object.keys(summaryGroups).forEach(t => (summaryGroups[t] || []).forEach(r => {
        if (!r.PwpCode) return;
        (getGroupCfg(t).source === "sku" ? skuCodes : budgetCodes).add(r.PwpCode);
      }));
      setSummaryDetailsLoading(true);
      try {
        const [skuRows, budgetRows] = await Promise.all([
          skuCodes.size ? fetchDetailsByCodes(SKU_CONFIG.table, SKU_CONFIG.pwpColumn, [...skuCodes]) : [],
          budgetCodes.size ? fetchDetailsByCodes(BUDGET_CONFIG.table, BUDGET_CONFIG.pwpColumn, [...budgetCodes]) : [],
        ]);
        const groupBy = (rows, col) => rows.reduce((m, r) => { (m[r[col]] = m[r[col]] || []).push(r); return m; }, {});
        if (!cancelled) {
          setSummaryDetails({
            sku: groupBy(skuRows, SKU_CONFIG.pwpColumn),
            budget: groupBy(budgetRows, BUDGET_CONFIG.pwpColumn),
          });
        }
      } catch (err) {
        console.error("Error loading summary details:", err);
        if (!cancelled) setError("Failed to load store details: " + (err.message || err));
      } finally {
        if (!cancelled) setSummaryDetailsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [summaryGroups, activeTab]);
  const fmtAmount = (v) =>
    v != null ? `₱${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-';

  const getGroupInfo = (item) => {
       const grp = getGroupCfg(getSummaryKey(item, activityMap));
    const mode = grp.source === "sku" ? "sku" : "budget";
    return { mode, extra: grp.extra || null, cfg: mode === "sku" ? SKU_CONFIG : BUDGET_CONFIG };
  };

  const loadDetails = async (item) => {
    const { mode, cfg } = getGroupInfo(item);
    const ck = `${mode}|${item.PwpCode}`;
    if (detailsCache[ck]) return; // cached na
    setDetailsCache(prev => ({ ...prev, [ck]: { loading: true, error: null, rows: [] } }));
    try {
      const { data, error } = await supabase
        .from(cfg.table)
        .select("*")
        .eq(cfg.pwpColumn, item.PwpCode);
      console.log("[Details]", cfg.table, `${cfg.pwpColumn} = ${item.PwpCode}`, "→", data?.length ?? 0, "rows", { data, error });
      if (error) throw error;
      setDetailsCache(prev => ({ ...prev, [ck]: { loading: false, error: null, rows: data || [] } }));
    } catch (err) {
      console.error("Error fetching PWP details:", err);
      setDetailsCache(prev => ({ ...prev, [ck]: { loading: false, error: err.message, rows: [] } }));
    }
  };

  const toggleRow = (item, rowKey) => {
    const willOpen = !expandedRows[rowKey];
    setExpandedRows(prev => ({ ...prev, [rowKey]: willOpen }));
    if (willOpen) loadDetails(item);
  };

  // Dropdown panel sa ilalim ng row: lahat ng store ng PWP
  const renderDetailsPanel = (item) => {
    const { mode, extra, cfg } = getGroupInfo(item);
    const entry = detailsCache[`${mode}|${item.PwpCode}`] || { loading: true, error: null, rows: [] };
    const stores = parseStoreList(item.branchType);
    const usingFallback = !entry.loading && !entry.error && entry.rows.length === 0 && stores.length > 0;
    const rows = entry.rows.length > 0
      ? entry.rows
      : stores.map(name => ({ [BUDGET_CONFIG.accountCol]: name, [SKU_CONFIG.accountCol]: name, [SKU_CONFIG.skuCol]: "-" }));
    const amountCol = mode === "budget" ? BUDGET_CONFIG.amountCol : SKU_CONFIG.amountCol;
    const total = entry.rows.reduce((sum, d) => sum + (Number(d[amountCol]) || 0), 0);
    const headers = mode === "budget"
      ? ["STORE", ...(extra ? [extra.label] : []), "BUDGET AMOUNT"]
      : ["ID", "ACCOUNT NAME", "SKU / NOTES", "TOTAL AMOUNT"];

    const nth = { padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#78909c', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' };
    const ntd = { padding: '8px 12px', fontSize: '13px', color: '#111', borderBottom: '1px solid #eee', whiteSpace: 'pre-wrap' };
    const ntdR = { ...ntd, textAlign: 'right', fontWeight: 700 };

    return (
      <div style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>
          Stores for <strong style={{ fontFamily: 'monospace' }}>{item.PwpCode}</strong>
          {!entry.loading && !entry.error && ` · ${rows.length} store${rows.length !== 1 ? 's' : ''}`}
        </div>

        {entry.loading && <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>Loading details...</p>}

        {entry.error && (
          <div style={{ padding: '10px 14px', backgroundColor: '#ffebee', border: '1px solid #ef5350', borderRadius: '6px', color: '#c62828', fontSize: '13px' }}>
            <strong>Error:</strong> {entry.error}
            <div style={{ marginTop: '4px', color: '#888' }}>Check SKU_CONFIG / BUDGET_CONFIG (table / column names) sa taas ng file.</div>
          </div>
        )}

        {!entry.loading && !entry.error && rows.length === 0 && (
          <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
            No details found for this PWP.
            <span style={{ display: 'block', fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
              Checked: {cfg.table}.{cfg.pwpColumn} = {item.PwpCode}
            </span>
          </p>
        )}

        {!entry.loading && !entry.error && rows.length > 0 && (
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {headers.map(h => (
                    <th key={h} style={{ ...nth, textAlign: h.includes('AMOUNT') ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => (
                  <tr key={d.id ?? i}>
                    {mode === "budget" ? (
                      <>
                        <td style={ntd}>{d[BUDGET_CONFIG.accountCol] ?? '-'}</td>
                        {extra && <td style={ntd}>{fmtList(d[extra.col])}</td>}
                        <td style={ntdR}>{fmtAmount(d[BUDGET_CONFIG.amountCol])}</td>
                      </>
                    ) : (
                      <>
                        <td style={ntd}>{d[SKU_CONFIG.idCol] ?? '-'}</td>
                        <td style={ntd}>{d[SKU_CONFIG.accountCol] ?? '-'}</td>
                        <td style={ntd}>{d[SKU_CONFIG.skuCol] ?? '-'}</td>
                        <td style={ntdR}>{fmtAmount(d[SKU_CONFIG.amountCol])}</td>
                      </>
                    )}
                  </tr>
                ))}
                {entry.rows.length > 0 && (
                  <tr style={{ backgroundColor: '#eef2ff' }}>
                    <td colSpan={headers.length - 1} style={{ ...ntd, textAlign: 'right', fontWeight: 700 }}>Total:</td>
                    <td style={{ ...ntdR, color: '#3f3fc4' }}>{fmtAmount(total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {usingFallback && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#8a6d3b', backgroundColor: '#fff3cd', border: '1px solid #ffe08a', borderRadius: '6px', padding: '8px 12px' }}>
            ⚠️ Walang per-store amount na naka-save para sa PWP na ito. Stores lang ang ipinapakita.
          </div>
        )}
      </div>
    );
  };

  // isang row per STORE (amount ng store, hindi ng buong PWP)
  const buildFlatRows = (title, rows) => {
    const cfg = getGroupCfg(title);
    return rows.flatMap(r => {
      const dist = distributorMap[String(r.distributor)] || r.distributor || '-';
      const list = (summaryDetails[cfg.source] || {})[r.PwpCode] || [];
      if (list.length === 0) {
        return [{
          key: `${r.id}-none`, dist, pwp: r.PwpCode || '-',
          store: parseStoreList(r.branchType).join(', ') || '-',
          col: '-', amount: null,
        }];
      }
      return list.map((d, i) => cfg.source === "sku"
        ? { key: `${r.id}-${d.id ?? i}`, dist, pwp: r.PwpCode || '-',
            store: d[SKU_CONFIG.accountCol] ?? '-', col: d[SKU_CONFIG.skuCol] ?? '-',
            amount: Number(d[SKU_CONFIG.amountCol]) || 0 }
        : { key: `${r.id}-${d.id ?? i}`, dist, pwp: r.PwpCode || '-',
            store: d[BUDGET_CONFIG.accountCol] ?? '-',
            col: cfg.extra ? fmtList(d[cfg.extra.col]) : '',
            amount: Number(d[BUDGET_CONFIG.amountCol]) || 0 });
    });
  };
  const renderSummaryTable = (title, rows) => {
    const cfg = getGroupCfg(title);
    const colLabel = cfg.source === "sku" ? "SKU'S" : cfg.extra ? cfg.extra.label : null;
    const flat = buildFlatRows(title, rows);
    const total = flat.reduce((s, r) => s + (r.amount || 0), 0);
    const pages = Math.max(1, Math.ceil(flat.length / summaryRowsPerPage));
    const page = Math.min(summaryPages[title] || 1, pages);
    const pageRows = flat.slice((page - 1) * summaryRowsPerPage, page * summaryRowsPerPage);
    const setPage = (p) => setSummaryPages(prev => ({ ...prev, [title]: p }));
    const colCount = colLabel ? 5 : 4;

    const th = { padding: '10px 14px', border: '1px solid #333', fontSize: '13px', fontWeight: 600, textAlign: 'left', backgroundColor: '#f1f5ff' };
    const td = { padding: '10px 14px', border: '1px solid #333', fontSize: '13px', color: '#111' };
    const pgBtn = (disabled) => ({
      padding: '6px 14px', border: 'none', borderRadius: '6px', fontSize: '13px',
      backgroundColor: disabled ? '#f5f5f5' : '#2196f3', color: disabled ? '#999' : 'white',
      cursor: disabled ? 'not-allowed' : 'pointer',
    });

    return (
      <div key={title} style={{ marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700 }}>
          {title.toUpperCase()}{' '}
          <span style={{ fontWeight: 400, color: '#666', fontSize: '13px' }}>
            ({rows.length} PWP · {flat.length} store{flat.length !== 1 ? 's' : ''})
          </span>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>DISTRIBUTOR</th>
                <th style={th}>PWP#</th>
                <th style={th}>STORE NAME</th>
                {colLabel && <th style={th}>{colLabel}</th>}
                <th style={{ ...th, textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {summaryDetailsLoading ? (
                <tr><td colSpan={colCount} style={{ ...td, textAlign: 'center', color: '#888' }}>Loading store details...</td></tr>
              ) : flat.length === 0 ? (
                <tr><td colSpan={colCount} style={{ ...td, textAlign: 'center', color: '#888' }}>No approved records.</td></tr>
              ) : pageRows.map(r => (
                <tr key={r.key}>
                  <td style={td}>{r.dist}</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{r.pwp}</td>
                  <td style={td}>{r.store}</td>
                  {colLabel && <td style={td}>{r.col}</td>}
                  <td style={{ ...td, textAlign: 'right' }}>{r.amount == null ? '-' : fmtAmount(r.amount)}</td>
                </tr>
              ))}
              {!summaryDetailsLoading && flat.length > 0 && (
                <tr style={{ fontWeight: 700, backgroundColor: '#fafafa' }}>
                  <td style={td} colSpan={colCount - 1}>TOTAL (all {flat.length} stores)</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtAmount(total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {flat.length > 0 && !summaryDetailsLoading && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            <div style={{ fontSize: '13px', color: '#666' }}>
              Showing {(page - 1) * summaryRowsPerPage + 1} to {Math.min(page * summaryRowsPerPage, flat.length)} of {flat.length}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setPage(Math.max(page - 1, 1))} disabled={page === 1} style={pgBtn(page === 1)}>Previous</button>
              <span style={{ fontSize: '13px', color: '#333' }}>Page {page} of {pages}</span>
              <button onClick={() => setPage(Math.min(page + 1, pages))} disabled={page === pages} style={pgBtn(page === pages)}>Next</button>
            </div>
          </div>
        )}
      </div>
    );
  };
  // ─────────────────────────────────────────────────────────────

  const getStatusStyle = (response) => {
    switch (response) {
      case 'Approved':   return { bg: '#e8f5e8', color: '#2e7d32' };
      case 'Disapproved': return { bg: '#ffebee', color: '#c62828' };
      case 'Cancelled':  return { bg: '#fff3e0', color: '#e65100' };
      default:           return { bg: '#fff3cd', color: '#8a6d3b' };
    }
  };

  const handleExportToExcel = async () => {
    setExportLoading(true);
    try {
      const exportData = filteredData.map(item => ({
        ID: item.id,
        'PWP Code': item.PwpCode,
        'PWP Type': item.pwpType,
        Distributor: distributorMap[String(item.distributor)] || item.distributor || '-',
        Activity: activityMap[String(item.activity_code)] || item.activity_code || '-',
        Amount: item.credit_budget ?? '-',
        'Branch Type': item.branchType || '-',
        'Activity From': item.activityDurationFrom
          ? new Date(item.activityDurationFrom).toLocaleDateString() : '-',
        'Activity To': item.activityDurationTo
          ? new Date(item.activityDurationTo).toLocaleDateString() : '-',
        Response: item.Response || '-',
        'Date Responded': item.DateResponded
          ? new Date(item.DateResponded).toLocaleString() : '-',
        'Assigned By': getUserNameById(item.CreatedForm),
        'Created At': item.created_at
          ? new Date(item.created_at).toLocaleString() : '-',
        'Remarks/Notes': item.RemarksNote || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ApprovalHistory");

      const maxLengths = {};
      exportData.forEach(row => {
        Object.keys(row).forEach(key => {
          const length = String(row[key] || '').length;
          maxLengths[key] = Math.max(maxLengths[key] || 0, length, key.length);
        });
      });
      worksheet['!cols'] = Object.keys(maxLengths).map(key => ({
        wch: Math.min(maxLengths[key] + 2, 50)
      }));

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([excelBuffer], { type: "application/octet-stream" }),
        `ApprovalHistory_${new Date().toISOString().split('T')[0]}.xlsx`
      );
    } catch (err) {
      setError('Failed to export Excel file');
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportToPDF = async () => {
    setExportLoading(true);
    try {
      const printWindow = window.open('', '_blank');
      const htmlContent = `
        <!DOCTYPE html><html><head>
          <title>Approval History Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1976d2; }
            .header h1 { color: #1976d2; margin: 0 0 10px; font-size: 24px; }
            .export-info { color: #666; font-size: 14px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px 6px; text-align: left; font-size: 11px; }
            th { background-color: #1976d2; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            @media print { body { margin: 0; } }
          </style>
        </head><body>
          <div class="header">
            <h1>Approval History Report</h1>
            <div class="export-info">
              Generated on: ${new Date().toLocaleDateString()} |
              Total Records: ${filteredData.length}
              ${dateFrom || dateTo ? ` | Date Range: ${dateFrom || 'Start'} to ${dateTo || 'End'}` : ''}
            </div>
          </div>
          <table>
            <thead><tr>
              <th>ID</th><th>PWP Code</th><th>PWP Type</th><th>Distributor</th>
              <th>Activity</th><th>Amount</th><th>Branch Type</th>
              <th>Activity From</th><th>Activity To</th>
              <th>Response</th><th>Date Responded</th><th>Assigned By</th><th>Created At</th><th>Remarks/Notes</th>
            </tr></thead>
            <tbody>
              ${filteredData.map(item => `
                <tr>
                  <td>${item.id}</td>
                  <td>${item.PwpCode || ''}</td>
                  <td>${item.pwpType || '-'}</td>
                  <td>${distributorMap[String(item.distributor)] || item.distributor || '-'}</td>
                  <td>${activityMap[String(item.activity_code)] || item.activity_code || '-'}</td>
                  <td>${item.credit_budget != null ? '₱' + Number(item.credit_budget).toLocaleString() : '-'}</td>
                  <td>${item.branchType || '-'}</td>
                  <td>${item.activityDurationFrom ? new Date(item.activityDurationFrom).toLocaleDateString() : '-'}</td>
                  <td>${item.activityDurationTo ? new Date(item.activityDurationTo).toLocaleDateString() : '-'}</td>
                  <td>${item.Response || ''}</td>
                  <td>${item.DateResponded ? new Date(item.DateResponded).toLocaleString() : '-'}</td>
                  <td>${getUserNameById(item.CreatedForm)}</td>
                  <td>${item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                  <td>${item.RemarksNote || '-'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div class="footer"><p>Automatically generated from the Approval History system.</p></div>
        </body></html>`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } catch (err) {
      setError('Failed to generate PDF');
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  // Kunin lahat ng rows ng details table para sa listahan ng PWP codes (batched)
  const fetchDetailsByCodes = async (table, col, codes) => {
    const out = [];
    const chunk = 150;
    for (let i = 0; i < codes.length; i += chunk) {
      const batch = codes.slice(i, i + chunk);
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .in(col, batch)
          .order("id", { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
        from += 1000;
      }
    }
    return out;
  };

  // Report template: isang row per STORE (amount per store, galing sa second page / details)
   const handleExportSummaryToExcel = async () => {
    setExportLoading(true);
    setError(null);
    try {
      const titles = activityFilter === "All" ? summaryActivities : [activityFilter];

      const skuCodes = new Set();
      const budgetCodes = new Set();
      titles.forEach(t => (summaryGroups[t] || []).forEach(r => {
        if (!r.PwpCode) return;
        (getGroupCfg(t).source === "sku" ? skuCodes : budgetCodes).add(r.PwpCode);
      }));

      const [skuRows, budgetRows] = await Promise.all([
        skuCodes.size ? fetchDetailsByCodes(SKU_CONFIG.table, SKU_CONFIG.pwpColumn, [...skuCodes]) : [],
        budgetCodes.size ? fetchDetailsByCodes(BUDGET_CONFIG.table, BUDGET_CONFIG.pwpColumn, [...budgetCodes]) : [],
      ]);

      const groupBy = (rows, col) => rows.reduce((m, r) => { (m[r[col]] = m[r[col]] || []).push(r); return m; }, {});
      const skuByPwp = groupBy(skuRows, SKU_CONFIG.pwpColumn);
      const budgetByPwp = groupBy(budgetRows, BUDGET_CONFIG.pwpColumn);

      const workbook = XLSX.utils.book_new();
      let missing = 0;
      let totalRows = 0;

        titles.forEach(title => {
        const cfg = getGroupCfg(title);
        const rows = summaryGroups[title] || [];
        if (rows.length === 0) return; // walang laman, walang sheet

        const colLabel = cfg.source === "sku" ? "SKU" : cfg.extra ? cfg.extra.label : null;
        const aoa = [];
        aoa.push(colLabel
          ? ["DISTRIBUTOR", "PWP#", "STORE", colLabel, "AMOUNT"]
          : ["DISTRIBUTOR", "PWP#", "STORE", "AMOUNT"]);

        let sheetTotal = 0;
        rows.forEach(r => {
          const dist = distributorMap[String(r.distributor)] || r.distributor || "-";
          const pwp = r.PwpCode || "-";
          const details = (cfg.source === "sku" ? skuByPwp : budgetByPwp)[r.PwpCode] || [];

          if (details.length === 0) {
            missing++;
            totalRows++;
            const store = parseStoreList(r.branchType).join(", ") || "-";
            aoa.push(colLabel ? [dist, pwp, store, "-", ""] : [dist, pwp, store, ""]);
            return;
          }

          details.forEach(d => {
            totalRows++;
            if (cfg.source === "sku") {
              const amt = Number(d[SKU_CONFIG.amountCol]) || 0;
              sheetTotal += amt;
              aoa.push([dist, pwp, d[SKU_CONFIG.accountCol] ?? "-", d[SKU_CONFIG.skuCol] ?? "-", amt]);
            } else {
              const amt = Number(d[BUDGET_CONFIG.amountCol]) || 0;
              sheetTotal += amt;
              const store = d[BUDGET_CONFIG.accountCol] ?? "-";
              aoa.push(colLabel
                ? [dist, pwp, store, fmtList(d[cfg.extra.col]), amt]
                : [dist, pwp, store, amt]);
            }
          });
        });

        aoa.push([]);
        aoa.push(colLabel ? ["TOTAL", "", "", "", sheetTotal] : ["TOTAL", "", "", sheetTotal]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = colLabel
          ? [{ wch: 32 }, { wch: 16 }, { wch: 38 }, { wch: 42 }, { wch: 16 }]
          : [{ wch: 32 }, { wch: 16 }, { wch: 38 }, { wch: 16 }];

        let sheetName = title.replace(/[\\/?*\[\]:]/g, "-").slice(0, 31);
        let n = 2;
        while (workbook.SheetNames.includes(sheetName)) {
          sheetName = title.replace(/[\\/?*\[\]:]/g, "-").slice(0, 28) + "_" + n++;
        }
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      });

      if (totalRows === 0) { setError('No approved records to export'); return; }

      const buf = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const suffix = activityFilter === "All" ? "All" : activityFilter.replace(/[^A-Za-z]+/g, '');
      saveAs(
        new Blob([buf], { type: "application/octet-stream" }),
        `ApprovedReport_${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`
      );

      if (missing > 0) {
        setError(`Na-export na. ${missing} PWP ang walang per-store details (blank ang amount nila).`);
      }
    } catch (err) {
      setError('Failed to export report: ' + (err.message || err));
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  const clearFilters = () => {
    setActivityFilter("All");
    setDateBasis("created_at");
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setFilterStatus("All");
  };

  const tdStyle = {
    padding: '14px 16px',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '13px',
    color: '#111',
  };

  return (
    <div style={{ padding: "20px", backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 30px', backgroundColor: '#f8f8f8' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700', color: '#111' }}>
            📋 Approval History
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            {filteredData.length} records found
            {(dateFrom || dateTo) && ` · filtered by date`}
            {role !== 'admin' && assignedDistributorCodes === null && ` · showing your records only`}
            {assignedDistributorCodes !== null && ` · accounting view (${assignedDistributorCodes.size} distributor${assignedDistributorCodes.size !== 1 ? 's' : ''})`}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '0 30px', backgroundColor: '#f8f8f8', borderBottom: '1px solid #e0e0e0' }}>
          {[
            { key: 'history', label: '📋 Approval History' },
            { key: 'summary', label: '✅ Approved Summary' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                backgroundColor: activeTab === t.key ? 'white' : 'transparent',
                color: activeTab === t.key ? '#1976d2' : '#666',
                borderBottom: activeTab === t.key ? '3px solid #1976d2' : '3px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ padding: '20px 30px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>

            {/* Search */}
            <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
              <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: '14px' }} />
              <input
                type="search"
                placeholder="Search PWP Code, Response, Distributor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '10px 12px 10px 35px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', width: '100%', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <FaCalendarAlt style={{ color: '#666', fontSize: '14px' }} />
              <span style={{ fontSize: '14px', color: '#666' }}>From:</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
              <span style={{ color: '#666' }}>To:</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
            </div>

            {/* Date basis */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Date by:</span>
              <select value={dateBasis} onChange={(e) => setDateBasis(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}>
                <option value="created_at">Created At</option>
                <option value="DateResponded">Date Responded</option>
              </select>
            </div>

            {/* Status Buttons (history tab only) */}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['All', 'Approved', 'Disapproved', 'Cancelled'].map(status => {
                  const colors = { Approved: '#4caf50', Disapproved: '#f44336', Cancelled: '#ff9800', All: '#2196f3' };
                  const color = colors[status];
                  return (
                    <button key={status} onClick={() => setFilterStatus(status)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: filterStatus === status ? color : 'white',
                        color: filterStatus === status ? 'white' : '#666',
                        border: `2px solid ${color}`,
                        borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s'
                      }}>
                      {status === 'Approved' && '✓ '}{status === 'Disapproved' && '✕ '}{status === 'Cancelled' && '⊘ '}{status}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Activity Filter (summary tab only) */}
            {activeTab === 'summary' && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                             {['All', ...summaryActivities].map(act => (
                  <button key={act} onClick={() => setActivityFilter(act)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: activityFilter === act ? '#1976d2' : 'white',
                      color: activityFilter === act ? 'white' : '#666',
                      border: '2px solid #1976d2',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
                    }}>
                    {act}
                  </button>
                ))}
              </div>
            )}

            <button onClick={clearFilters}
              style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              Clear Filters
            </button>
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={activeTab === 'summary' ? handleExportSummaryToExcel : handleExportToExcel} disabled={exportLoading}
              style={{ padding: '10px 20px', backgroundColor: exportLoading ? '#ccc' : '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: exportLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaFileExcel />{exportLoading ? 'Generating...' : activeTab === 'summary' ? 'Export Report Excel' : 'Generate Excel'}
            </button>
            {activeTab === 'history' && (
              <button onClick={handleExportToPDF} disabled={exportLoading}
                style={{ padding: '10px 20px', backgroundColor: exportLoading ? '#ccc' : '#f44336', color: 'white', border: 'none', borderRadius: '6px', cursor: exportLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaFilePdf />{exportLoading ? 'Generating...' : 'Generate PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #e3f2fd', borderTop: '4px solid #1976d2', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#666' }}>Loading approval history...</p>
          </div>
        )}
        {error && (
          <div style={{ padding: '20px 30px', backgroundColor: '#ffebee', border: '1px solid #ef5350', margin: '20px 30px', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#c62828' }}><strong>Error:</strong> {error}</p>
          </div>
        )}

        {/* Summary */}
        {!loading && activeTab === 'summary' && (
          <div style={{ padding: '24px 30px' }}>
                   {(activityFilter === "All" ? summaryActivities : [activityFilter]).map(t =>
                    renderSummaryTable(t, summaryGroups[t] || [])
            )}
          </div>
        )}

        {/* Table */}
        {!loading && activeTab === 'history' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#2575fc', color: 'white' }}>
                  {['ID', 'PWP Code', 'PWP Type', 'Distributor', 'Activity', 'Amount', 'Branch Type', 'Activity From', 'Activity To', 'Response', 'Date Responded', 'Assigned By', 'Created At', 'Status'].map(h => (
                    <th key={h} style={{ padding: '14px 16px', textAlign: h === 'Status' ? 'center' : 'left', fontWeight: '600', fontSize: '13px', borderBottom: '2px solid #1565c0', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '16px', backgroundColor: '#fafafa' }}>
                      No approval records found.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, index) => {
                    const statusStyle = getStatusStyle(item.Response);
                    return (
                      <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={tdStyle}>{item.id}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{item.PwpCode || '-'}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', backgroundColor: item.pwpType === 'Regular' ? '#e3f2fd' : '#f3e5f5', color: item.pwpType === 'Regular' ? '#1565c0' : '#6a1b9a' }}>
                            {item.pwpType || '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>{distributorMap[String(item.distributor)] || item.distributor || '-'}</td>
                        <td style={tdStyle}>{activityMap[String(item.activity_code)] || item.activity_code || '-'}</td>
                        <td style={tdStyle}>
                          {item.credit_budget != null
                            ? `₱${Number(item.credit_budget).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                            : '-'}
                        </td>
                        <td style={{ ...tdStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.branchType || ''}>
                          {item.branchType || '-'}
                        </td>
                        <td style={tdStyle}>
                          {item.activityDurationFrom ? new Date(item.activityDurationFrom).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td style={tdStyle}>
                          {item.activityDurationTo ? new Date(item.activityDurationTo).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.color}33` }}>
                            {item.Response || 'Pending'}
                          </span>
                        </td>
                        <td style={tdStyle}>{item.DateResponded ? new Date(item.DateResponded).toLocaleString() : '-'}</td>
                        <td style={tdStyle}>{getUserNameById(item.CreatedForm)}</td>
                        <td style={tdStyle}>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {item.Response === "Approved" && (
                            <button
                              onClick={() => {
                                setSelectedRemarks(item);
                                setShowRemarksModal(true);
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', backgroundColor: '#e8f5e8',
                                color: '#2e7d32', border: '1px solid #4caf50',
                                borderRadius: '6px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap'
                              }}
                            >
                              <FaCheckCircle size={14} />
                              View Remarks/Notes
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination (history tab only) */}
        {activeTab === 'history' && (
          <div style={{ padding: '20px 30px', backgroundColor: '#fafafa', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Showing {paginatedData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{' '}
              {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                style={{ padding: '8px 16px', backgroundColor: currentPage === 1 ? '#f5f5f5' : '#2196f3', color: currentPage === 1 ? '#999' : 'white', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                Previous
              </button>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                      style={{ padding: '8px 12px', backgroundColor: currentPage === pageNum ? '#1976d2' : 'white', color: currentPage === pageNum ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', minWidth: '40px' }}>
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}
                style={{ padding: '8px 16px', backgroundColor: currentPage === totalPages || totalPages === 0 ? '#f5f5f5' : '#2196f3', color: currentPage === totalPages || totalPages === 0 ? '#999' : 'white', border: 'none', borderRadius: '6px', cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Remarks/Notes Modal */}
      {showRemarksModal && selectedRemarks && (
        <div
          onClick={() => setShowRemarksModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white', borderRadius: '10px', padding: '24px',
              width: '90%', maxWidth: '450px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#111' }}>Remarks / Notes</h3>
              <button
                onClick={() => setShowRemarksModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
              PWP Code: <strong>{selectedRemarks.PwpCode}</strong>
            </div>
            <div style={{
              backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '6px',
              padding: '14px', fontSize: '14px', color: '#333', minHeight: '60px', whiteSpace: 'pre-wrap'
            }}>
              {selectedRemarks.RemarksNote || 'No remarks/notes available.'}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
    </div>
  );
};

export default ApprovalList;
