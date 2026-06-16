import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from "sweetalert2";
import { Modal, Button, Spinner } from "react-bootstrap";

export default function AccountsListManager() {
  const [data, setData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importMode, setImportMode] = useState('add');

  const [showDistributorModal, setShowDistributorModal] = useState(false);
  const [showMotherModal, setShowMotherModal] = useState(false);
  const [showBpModal, setShowBpModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);

  const [distributors, setDistributors] = useState([]);
  const [motherAccounts, setMotherAccounts] = useState([]);
  const [bpAccounts, setBpAccounts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [agentMap, setAgentMap] = useState({}); // 🔹 Map UserID -> name
  const [motherMap, setMotherMap] = useState({}); // 🔹 Map dscode -> name
  const [distributorMap, setDistributorMap] = useState({}); // 🔹 Map code -> name
  const [groupMap, setGroupMap] = useState({});
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [isFetching, setIsFetching] = useState(false);

  const BATCH = 1000;
  const UPDATE_BATCH = 500; // ✅ ADD THIS
  // Add these states
  const [showExportByDistModal, setShowExportByDistModal] = useState(false);
  const [selectedDistForExport, setSelectedDistForExport] = useState(null);
  const [exportDistSearch, setExportDistSearch] = useState('');

  const [newRecord, setNewRecord] = useState({
    distributor_code: '',
    mother_code: '',
    bp_code: '',
    bp_name: '',
    group_code: '',
    status: true
  })


  // const arrangeData = async () => {

  //   const confirm = await Swal.fire({
  //     title: 'ge DArranata',
  //     html: `<div style="text-align:left;">
  //       <p>This will sync missing <b>mother_code</b> values from <b>Accounts_List</b> 
  //       into <b>sub_mother_account</b> with correct names.</p>
  //     </div>`,
  //     icon: 'info',
  //     showCancelButton: true,
  //     confirmButtonText: 'Arrange Now',
  //     cancelButtonText: 'Cancel',
  //     confirmButtonColor: '#f59e0b',
  //     cancelButtonColor: '#6c757d',
  //   });

  //   if (!confirm.isConfirmed) return;

  //   try {
  //     // Step 1: Load ALL Accounts_List — mother_code + bp_name + group_code
  //     Swal.fire({
  //       title: 'Loading Accounts_List...',
  //       html: 'Fetching records...<br><span id="arr-prog" style="color:#f59e0b;font-weight:600;">0 loaded</span>',
  //       allowOutsideClick: false,
  //       didOpen: () => Swal.showLoading(),
  //     });

  //     const BATCH = 1000;
  //     let all = [], offset = 0, hasMore = true;

  //     while (hasMore) {
  //       const { data: batch, error } = await supabase
  //         .from('Accounts_List')
  //         .select('mother_code, bp_name, group_code')
  //         .not('mother_code', 'is', null)
  //         .not('mother_code', 'eq', '')
  //         .range(offset, offset + BATCH - 1);

  //       if (error) throw error;

  //       if (batch?.length > 0) {
  //         all = [...all, ...batch];
  //         offset += BATCH;
  //         hasMore = batch.length === BATCH;
  //         const el = document.getElementById('arr-prog');
  //         if (el) el.textContent = `${all.length.toLocaleString()} loaded`;
  //       } else {
  //         hasMore = false;
  //       }
  //     }

  //     console.log(`✅ Total rows loaded: ${all.length}`);

  //     // Step 2: Build map — dscode -> { name, group_code }
  //     // Ang name dapat = bp_name ng FIRST record na may ganyang mother_code
  //     // HINDI yung dscode mismo!
  //     const motherMap = {}; // dscode -> { name, group_code }

  //     all.forEach(row => {
  //       const dscode = row.mother_code?.toString().trim();
  //       const bpName = row.bp_name?.toString().trim();
  //       const groupCode = row.group_code?.toString().trim() || null;

  //       if (!dscode) return;

  //       // Pag wala pa sa map, ilagay
  //       // Pag meron na pero walang name, i-update
  //       if (!motherMap[dscode]) {
  //         motherMap[dscode] = { name: bpName || dscode, group_code: groupCode };
  //       } else if (!motherMap[dscode].name || motherMap[dscode].name === dscode) {
  //         // Update lang kung walang proper name pa
  //         if (bpName) motherMap[dscode].name = bpName;
  //       }
  //     });

  //     console.log(`📊 Unique mother codes: ${Object.keys(motherMap).length}`);
  //     console.log('Sample:', Object.entries(motherMap).slice(0, 5));

  //     // Step 3: Load group_name lookup
  //     const { data: groupRows } = await supabase
  //       .from('mother_account')
  //       .select('code, name')
  //       .eq('status', true);

  //     const groupCodeToName = {};
  //     groupRows?.forEach(g => {
  //       groupCodeToName[String(g.code)] = g.name;
  //     });

  //     console.log('Group map:', groupCodeToName);

  //     // Step 4: Load existing dscodes from sub_mother_account
  //     Swal.update({
  //       title: 'Checking existing records...',
  //       html: '<span style="color:#f59e0b;font-weight:600;">Loading sub_mother_account...</span>',
  //     });

  //     let existingSubs = [], subOffset = 0, subHasMore = true;

  //     while (subHasMore) {
  //       const { data: subBatch, error } = await supabase
  //         .from('sub_mother_account')
  //         .select('dscode')
  //         .range(subOffset, subOffset + BATCH - 1);

  //       if (error) throw error;

  //       if (subBatch?.length > 0) {
  //         existingSubs = [...existingSubs, ...subBatch];
  //         subOffset += BATCH;
  //         subHasMore = subBatch.length === BATCH;
  //       } else {
  //         subHasMore = false;
  //       }
  //     }

  //     const existingSet = new Set(
  //       existingSubs.map(s => s.dscode?.toString().trim())
  //     );

  //     console.log(`✅ Existing in sub_mother_account: ${existingSet.size}`);

  //     // Step 5: Find missing + build insert payload with CORRECT names
  //     const toInsert = [];

  //     Object.entries(motherMap).forEach(([dscode, info]) => {
  //       // Skip if already exists
  //       if (existingSet.has(dscode)) return;

  //       const groupCode = info.group_code;
  //       const groupName = groupCode ? (groupCodeToName[groupCode] || null) : null;

  //       // ✅ name = bp_name (actual store name), NOT the dscode!
  //       toInsert.push({
  //         dscode: dscode,                    // e.g. DS100001
  //         name: info.name || dscode,        // e.g. FLORES MART INC. ← DITO ANG FIX!
  //         status: true,
  //         group_code: groupCode || null,     // e.g. "6002"
  //         group_name: groupName || null,     // e.g. "DIRECT DISTRIBUTOR"
  //       });
  //     });

  //     console.log(`📥 To insert: ${toInsert.length}`);
  //     console.log('Sample inserts:', toInsert.slice(0, 5));

  //     Swal.close();

  //     if (toInsert.length === 0) {
  //       Swal.fire({
  //         icon: 'info',
  //         title: 'Already Synced!',
  //         text: `All ${Object.keys(motherMap).length} mother codes already exist.`,
  //         timer: 2500,
  //         showConfirmButton: false,
  //       });
  //       return;
  //     }

  //     // Step 6: Insert in batches
  //     Swal.fire({
  //       title: 'Inserting missing records...',
  //       html: `<span id="arr-insert-prog">0 / ${toInsert.length.toLocaleString()}</span>`,
  //       allowOutsideClick: false,
  //       didOpen: () => Swal.showLoading(),
  //     });

  //     const INSERT_BATCH = 500;
  //     let inserted = 0;

  //     for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
  //       const chunk = toInsert.slice(i, i + INSERT_BATCH);

  //       const { error } = await supabase
  //         .from('sub_mother_account')
  //         .insert(chunk);

  //       if (error) {
  //         console.error('Insert error:', error.message);
  //         await supabase
  //           .from('sub_mother_account')
  //           .upsert(chunk, { onConflict: 'dscode', ignoreDuplicates: true });
  //       }

  //       inserted += chunk.length;
  //       const el = document.getElementById('arr-insert-prog');
  //       if (el) el.textContent = `${inserted.toLocaleString()} / ${toInsert.length.toLocaleString()}`;
  //       await new Promise(r => setTimeout(r, 30));
  //     }

  //     Swal.close();

  //     await Swal.fire({
  //       icon: 'success',
  //       title: 'Arrange Complete!',
  //       html: `
  //         <div style="text-align:left;font-family:monospace;">
  //           <p>📊 <b>Unique mother codes scanned:</b> ${Object.keys(motherMap).length.toLocaleString()}</p>
  //           <p style="color:green;">✅ <b>Newly inserted:</b> ${inserted.toLocaleString()}</p>
  //           <p style="color:gray;">⏭️ <b>Already existed (skipped):</b> ${existingSet.size.toLocaleString()}</p>
  //         </div>
  //       `,
  //       confirmButtonText: 'OK',
  //     });

  //     await fetchMotherAccounts();

  //   } catch (err) {
  //     console.error('arrangeData error:', err);
  //     Swal.close();
  //     Swal.fire('Error', err.message, 'error');
  //   }
  // };

  const fixSubMotherNames = async () => {
    try {
      Swal.fire({
        title: '🔄 Loading sub_mother_account...',
        html: '<span id="fix-sm-prog" style="color:#8b5cf6;font-weight:700;">0 loaded</span>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const BATCH = 1000;
      let allSubs = [], offset = 0, hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('sub_mother_account')
          .select('id, dscode, name, group_code')
          .range(offset, offset + BATCH - 1);
        if (error) throw error;
        if (data?.length > 0) {
          allSubs = [...allSubs, ...data];
          offset += BATCH;
          hasMore = data.length === BATCH;
          const el = document.getElementById('fix-sm-prog');
          if (el) el.textContent = `${allSubs.length.toLocaleString()} loaded`;
        } else hasMore = false;
      }

      // Find rows where name = DS code pattern
      const dsCodeRows = allSubs.filter(s => /^DS\d+$/i.test(s.name?.trim()));
      console.log(`Found ${dsCodeRows.length} rows with DS code as name`);

      if (dsCodeRows.length === 0) {
        Swal.close();
        Swal.fire({
          icon: 'info', title: '✅ All Good!',
          text: 'No sub_mother_account rows need fixing.',
        });
        return;
      }

      // Load Accounts_List to get proper names via mother_code → bp_name
      const dscodeSet = new Set(dsCodeRows.map(s => s.dscode));

      Swal.update({
        title: '🔄 Loading Accounts_List for name lookup...',
        html: '<span id="fix-al-prog" style="color:#8b5cf6;">Loading...</span>',
      });

      let allAccounts = [], accOffset = 0, accHasMore = true;
      while (accHasMore) {
        const { data, error } = await supabase
          .from('Accounts_List')
          .select('mother_code, bp_name, group_code')
          .range(accOffset, accOffset + BATCH - 1);
        if (error) throw error;
        if (data?.length > 0) {
          allAccounts = [...allAccounts, ...data];
          accOffset += BATCH;
          accHasMore = data.length === BATCH;
          const el = document.getElementById('fix-al-prog');
          if (el) el.textContent = `${allAccounts.length.toLocaleString()} loaded`;
        } else accHasMore = false;
      }

      // Build dscode → bp_name map
      const dscodeToName = {};
      allAccounts.forEach(row => {
        const mc = row.mother_code?.toString().trim();
        const name = row.bp_name?.toString().trim();
        if (mc && name && dscodeSet.has(mc) && !dscodeToName[mc]) {
          dscodeToName[mc] = name;
        }
      });

      // Build update list
      const toUpdate = [];
      let noMatch = 0;
      dsCodeRows.forEach(row => {
        const newName = dscodeToName[row.dscode];
        if (newName) {
          toUpdate.push({ id: row.id, dscode: row.dscode, name: newName });
        } else {
          noMatch++;
        }
      });

      Swal.close();

      if (toUpdate.length === 0) {
        Swal.fire({
          icon: 'warning', title: '⚠️ No Updates',
          html: `
          <div style="text-align:left;font-family:monospace;">
            <p>Found <b>${dsCodeRows.length}</b> DS-named rows but no matching names in Accounts_List.</p>
            <p style="color:orange;">⚠️ No match: ${noMatch}</p>
          </div>
        `,
        });
        return;
      }

      // Preview
      const confirmRes = await Swal.fire({
        icon: 'info',
        title: '📊 Fix Sub Mother Names',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:1.8;">
          <p>🔍 <b>Rows with DS code as name:</b> ${dsCodeRows.length.toLocaleString()}</p>
          <p style="color:green;">✅ <b>Will be fixed:</b> ${toUpdate.length.toLocaleString()}</p>
          <p style="color:orange;">⚠️ <b>No match found:</b> ${noMatch.toLocaleString()}</p>
          <hr style="margin:10px 0;"/>
          <p style="font-size:12px;color:#6b7280;">Sample fixes:</p>
          ${toUpdate.slice(0, 5).map(u =>
          `<p style="font-size:12px;">"${u.dscode}" → "<b>${u.name}</b>"</p>`
        ).join('')}
        </div>
      `,
        showCancelButton: true,
        confirmButtonText: '⚡ Fix Now',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#8b5cf6',
      });

      if (!confirmRes.isConfirmed) return;

      // Parallel batch update
      Swal.fire({
        title: '⚡ Fixing sub_mother_account names...',
        html: '<div id="fix-sm-upd">Starting...</div>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const CONCURRENCY = 10;
      let updated = 0;

      const updateOne = async (item) => {
        const { error } = await supabase
          .from('sub_mother_account')
          .update({ name: item.name })
          .eq('id', item.id);
        if (error) console.error(`Update error id=${item.id}:`, error.message);
        return 1;
      };

      for (let i = 0; i < toUpdate.length; i += CONCURRENCY) {
        const slice = toUpdate.slice(i, i + CONCURRENCY);
        await Promise.all(slice.map(updateOne));
        updated += slice.length;

        const pct = Math.round(updated / toUpdate.length * 100);
        const el = document.getElementById('fix-sm-upd');
        if (el) el.innerHTML = `
        <b style="color:#8b5cf6;font-size:18px;">${updated.toLocaleString()} / ${toUpdate.length.toLocaleString()}</b>
        <div style="width:100%;height:10px;background:#eee;border-radius:5px;overflow:hidden;margin-top:8px;">
          <div style="width:${pct}%;height:100%;background:#8b5cf6;transition:width 0.2s;"></div>
        </div>
        <p style="color:#6b7280;font-size:12px;margin-top:4px;">${pct}%</p>
      `;
      }

      Swal.close();

      await Swal.fire({
        icon: 'success',
        title: '✅ Fix Complete!',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;">
          <p style="color:green;">✅ <b>Names fixed:</b> ${updated.toLocaleString()}</p>
          <p style="color:orange;">⚠️ <b>No match (skipped):</b> ${noMatch.toLocaleString()}</p>
        </div>
      `,
      });

      await fetchMotherAccounts();
      fetchAndCleanData(currentPage, searchTerm, searchField);

    } catch (err) {
      console.error('fixSubMotherNames error:', err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
    }
  };
  const [showArrangeModal, setShowArrangeModal] = useState(false);
  const [arrangeOption, setArrangeOption] = useState('');

  const runArrangeData = async (selectedOp) => {
    try {
      Swal.fire({
        title: '📥 Loading reference tables...',
        html: '<span id="ref-prog" style="color:#f59e0b;font-weight:700;">Loading...</span>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const [groupRes, subMotherRes] = await Promise.all([
        supabase.from('mother_account').select('code, name').eq('status', true),
        supabase.from('sub_mother_account').select('dscode, name, group_code'),
        // ❌ OLD: .eq('status', true) — tinanggal para makuha lahat
      ]);

      if (groupRes.error) throw groupRes.error;
      if (subMotherRes.error) throw subMotherRes.error;

      const nameToGroupCode = {};
      const validGroupCodes = new Set();
      groupRes.data?.forEach(g => {
        validGroupCodes.add(String(g.code).trim());
        nameToGroupCode[g.name.trim().toLowerCase()] = String(g.code).trim();
      });

      // Group name lookup (code -> name)
      const groupCodeToName = {}; // ✅ NEW: ginawa natin ito dito para magamit sa insert
      groupRes.data?.forEach(g => {
        groupCodeToName[String(g.code)] = g.name;
      });

      const nameToDscode = {};
      const nameGroupToDscode = {};
      subMotherRes.data?.forEach(s => {
        const name = s.name?.trim().toLowerCase();
        const ds = s.dscode?.trim();
        const gc = s.group_code?.toString().trim();
        if (!name || !ds) return;
        if (!nameToDscode[name]) nameToDscode[name] = ds;
        if (gc) nameGroupToDscode[`${gc}|${name}`] = ds;
      });

      // Get current max DS number ✅ NEW
      let maxDsNum = 0;
      subMotherRes.data?.forEach(s => {
        const match = s.dscode?.match(/^DS(\d+)$/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxDsNum) maxDsNum = num;
        }
      });

      const elRef = document.getElementById('ref-prog');
      if (elRef) elRef.textContent = 'Loading Accounts_List...';

      const FETCH_BATCH = 1000;
      const { count: totalRows, error: cntErr } = await supabase
        .from('Accounts_List')
        .select('*', { count: 'exact', head: true });
      if (cntErr) throw cntErr;

      const CONCURRENCY = 10;
      const all = new Array(totalRows);
      const totalBatches = Math.ceil(totalRows / FETCH_BATCH);
      let fetched = 0;

      const fetchBatch = async (batchIndex) => {
        const from = batchIndex * FETCH_BATCH;
        const to = from + FETCH_BATCH - 1;
        const { data, error } = await supabase
          .from('Accounts_List')
          .select('id, mother_code, group_code')
          .range(from, to);
        if (error) throw error;
        data.forEach((row, i) => { all[from + i] = row; });
        fetched += data.length;
        const el2 = document.getElementById('ref-prog');
        if (el2) el2.textContent = `Loading... ${fetched.toLocaleString()} / ${totalRows.toLocaleString()}`;
      };

      for (let i = 0; i < totalBatches; i += CONCURRENCY) {
        const tasks = [];
        for (let j = i; j < Math.min(i + CONCURRENCY, totalBatches); j++) {
          tasks.push(fetchBatch(j));
        }
        await Promise.all(tasks);
      }

      const rows = all.filter(Boolean);

      const byGroupCode = {};
      const byDscode = {};
      let noMatchGroup = 0, noMatchMother = 0;
      let alreadyOkGroup = 0, alreadyOkMother = 0;

      // ✅ NEW: collect unmatched mother names para i-insert sa sub_mother_account
      const unmatchedMotherNames = new Map(); // name -> { group_code }

      rows.forEach(row => {
        const rawGC = row.group_code?.toString().trim() || '';
        const rawMC = row.mother_code?.toString().trim() || '';

        if (selectedOp === 'fix_group_code' || selectedOp === 'fix_both') {
          if (validGroupCodes.has(rawGC)) {
            alreadyOkGroup++;
          } else {
            const fixed = nameToGroupCode[rawGC.toLowerCase()];
            if (fixed) {
              if (!byGroupCode[fixed]) byGroupCode[fixed] = [];
              byGroupCode[fixed].push(row.id);
              row.group_code = fixed;
            } else noMatchGroup++;
          }
        }

        if (selectedOp === 'fix_mother_code' || selectedOp === 'fix_both') {
          if (/^DS\d+$/i.test(rawMC)) { alreadyOkMother++; return; }
          if (!rawMC) return; // ✅ NEW: skip empty

          const nameLower = rawMC.toLowerCase();
          const gc = row.group_code?.toString().trim() || '';
          const ds = nameGroupToDscode[`${gc}|${nameLower}`] || nameToDscode[nameLower];

          if (ds) {
            if (!byDscode[ds]) byDscode[ds] = [];
            byDscode[ds].push(row.id);
          } else {
            // ✅ NEW: walang match — i-collect para i-insert sa sub_mother_account
            noMatchMother++;
            if (!unmatchedMotherNames.has(nameLower)) {
              unmatchedMotherNames.set(nameLower, {
                originalName: rawMC,
                group_code: gc || null,
                rowIds: [row.id]
              });
            } else {
              unmatchedMotherNames.get(nameLower).rowIds.push(row.id);
            }
          }
        }
      });

      const totalGroupUpdates = Object.values(byGroupCode).reduce((s, a) => s + a.length, 0);
      const totalMotherUpdates = Object.values(byDscode).reduce((s, a) => s + a.length, 0);

      Swal.close();

      const confirmRes = await Swal.fire({
        icon: 'info',
        title: '📊 Preview',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:1.8;">
          ${selectedOp !== 'fix_mother_code' ? `
            <p>🏷️ <b>Group Code fixes:</b> ${totalGroupUpdates.toLocaleString()} rows</p>
            <p style="color:#6b7280;margin-left:16px;">
              ✅ Already correct: ${alreadyOkGroup.toLocaleString()} &nbsp;|&nbsp;
              ⚠️ No match: ${noMatchGroup.toLocaleString()}
            </p>` : ''}
          ${selectedOp !== 'fix_group_code' ? `
            <p>👥 <b>Mother Code fixes:</b> ${totalMotherUpdates.toLocaleString()} rows</p>
            <p style="color:green;margin-left:16px;">
              ✅ Already DS code: ${alreadyOkMother.toLocaleString()}
            </p>
            <p style="color:#f59e0b;margin-left:16px;">
              🆕 Will auto-create DS codes: ${unmatchedMotherNames.size.toLocaleString()} new entries
            </p>` : ''}
          <hr style="margin:10px 0;"/>
          <p>📋 <b>Total scanned:</b> ${rows.length.toLocaleString()}</p>
        </div>
      `,
        showCancelButton: true,
        confirmButtonText: '⚡ Run Now',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#f59e0b',
      });

      if (!confirmRes.isConfirmed) return;

      // ✅ NEW: Auto-insert unmatched names to sub_mother_account
      if (unmatchedMotherNames.size > 0 &&
        (selectedOp === 'fix_mother_code' || selectedOp === 'fix_both')) {

        Swal.fire({
          title: '🆕 Creating new DS codes...',
          html: '<div id="insert-sub-prog">Starting...</div>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        let dsCounter = maxDsNum;
        const toInsertSubs = [];

        for (const [nameLower, info] of unmatchedMotherNames.entries()) {
          dsCounter++;
          const newDs = `DS${String(dsCounter).padStart(6, '0')}`;
          const groupName = info.group_code
            ? (groupCodeToName[info.group_code] || null)
            : null;

          toInsertSubs.push({
            dscode: newDs,
            name: info.originalName,
            status: true,
            group_code: info.group_code || null,
            group_name: groupName,
          });

          // ✅ Add to byDscode para ma-update ang Accounts_List
          byDscode[newDs] = info.rowIds;

          // ✅ Update in-memory maps
          nameToDscode[nameLower] = newDs;
          if (info.group_code) {
            nameGroupToDscode[`${info.group_code}|${nameLower}`] = newDs;
          }
        }

        // Insert to sub_mother_account in batches
        const INSERT_BATCH = 500;
        let insertedSubs = 0;

        for (let i = 0; i < toInsertSubs.length; i += INSERT_BATCH) {
          const chunk = toInsertSubs.slice(i, i + INSERT_BATCH);
          const { error } = await supabase
            .from('sub_mother_account')
            .insert(chunk);

          if (error) {
            console.error('sub_mother insert error:', error.message);
            // Try upsert as fallback
            await supabase
              .from('sub_mother_account')
              .upsert(chunk, { onConflict: 'dscode', ignoreDuplicates: true });
          }

          insertedSubs += chunk.length;
          const el = document.getElementById('insert-sub-prog');
          if (el) el.innerHTML = `
          <b style="color:#f59e0b;font-size:18px;">
            ${insertedSubs.toLocaleString()} / ${toInsertSubs.length.toLocaleString()}
          </b> DS codes created
        `;
        }

        console.log(`✅ Auto-inserted ${insertedSubs} new entries to sub_mother_account`);
      }

      // ── Update group codes ──────────────────────────────────
      const UPDATE_BATCH = 500;
      const UPDATE_CONCURRENCY = 8;
      let updatedGroup = 0, updatedMother = 0;

      const updateSlice = async (ids, field, value) => {
        const { error } = await supabase
          .from('Accounts_List')
          .update({ [field]: value })
          .in('id', ids);
        if (error) console.error(`Update error [${field}=${value}]:`, error.message);
        return ids.length;
      };

      const showProgress = (label, done, total) => {
        const pct = total > 0 ? Math.round(done / total * 100) : 100;
        Swal.update({
          html: `
          <div style="font-family:monospace;">
            <p style="margin-bottom:8px;">${label}</p>
            <b style="color:#f59e0b;font-size:18px;">
              ${done.toLocaleString()} / ${total.toLocaleString()}
            </b>
            <div style="width:100%;height:12px;background:#eee;border-radius:6px;overflow:hidden;margin-top:10px;">
              <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f59e0b,#d97706);transition:width 0.2s;"></div>
            </div>
            <p style="color:#6b7280;margin-top:6px;font-size:12px;">${pct}%</p>
          </div>
        `
        });
      };

      if (totalGroupUpdates > 0) {
        Swal.fire({
          title: '⚡ Updating Group Codes...',
          html: '<div>Starting...</div>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        const tasks = [];
        for (const [code, ids] of Object.entries(byGroupCode)) {
          for (let i = 0; i < ids.length; i += UPDATE_BATCH) {
            tasks.push({ ids: ids.slice(i, i + UPDATE_BATCH), code });
          }
        }

        for (let i = 0; i < tasks.length; i += UPDATE_CONCURRENCY) {
          const slice = tasks.slice(i, i + UPDATE_CONCURRENCY);
          const results = await Promise.all(
            slice.map(t => updateSlice(t.ids, 'group_code', t.code))
          );
          updatedGroup += results.reduce((s, n) => s + n, 0);
          showProgress('🏷️ Updating group codes...', updatedGroup, totalGroupUpdates);
        }
      }

      // ── Update mother codes (kasama na yung bagong DS codes) ─
      const totalMotherUpdatesNow = Object.values(byDscode)
        .reduce((s, a) => s + a.length, 0);

      if (totalMotherUpdatesNow > 0) {
        Swal.fire({
          title: '⚡ Updating Mother Codes...',
          html: '<div>Starting...</div>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        const tasks = [];
        for (const [ds, ids] of Object.entries(byDscode)) {
          for (let i = 0; i < ids.length; i += UPDATE_BATCH) {
            tasks.push({ ids: ids.slice(i, i + UPDATE_BATCH), ds });
          }
        }

        for (let i = 0; i < tasks.length; i += UPDATE_CONCURRENCY) {
          const slice = tasks.slice(i, i + UPDATE_CONCURRENCY);
          const results = await Promise.all(
            slice.map(t => updateSlice(t.ids, 'mother_code', t.ds))
          );
          updatedMother += results.reduce((s, n) => s + n, 0);
          showProgress('👥 Updating mother codes...', updatedMother, totalMotherUpdatesNow);
        }
      }

      Swal.close();

      await Swal.fire({
        icon: 'success',
        title: '✅ Arrange Complete!',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:1.8;">
          ${selectedOp !== 'fix_mother_code'
            ? `<p style="color:green;">🏷️ Group codes fixed: <b>${updatedGroup.toLocaleString()}</b></p>`
            : ''}
          ${selectedOp !== 'fix_group_code'
            ? `<p style="color:green;">👥 Mother codes fixed: <b>${updatedMother.toLocaleString()}</b></p>
               <p style="color:#f59e0b;">🆕 New DS codes created: <b>${unmatchedMotherNames.size.toLocaleString()}</b></p>`
            : ''}
          <p style="color:#6b7280;">
            ⚠️ No match (group) skipped: ${noMatchGroup.toLocaleString()}
          </p>
        </div>
      `,
        confirmButtonText: 'OK',
      });

      fetchAndCleanData(currentPage, searchTerm, searchField);
      await fetchMotherAccounts(); // ✅ NEW: refresh mother map

    } catch (err) {
      console.error('runArrangeData error:', err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
    }
  };
  // New export by distributor function
  const handleExportByDistributor = async (distributorCode) => {
    try {
      setShowExportModal(true);
      setExportProgress({ fetched: 0, total: 0, type: "distributor" });

      const batchSize = 1000;
      let allData = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("Accounts_List")
          .select("*")
          .eq("distributor_code", distributorCode)
          .order("id", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
          setExportProgress({ fetched: allData.length, total: allData.length + (hasMore ? batchSize : 0), type: "distributor" });
        } else {
          hasMore = false;
          setExportProgress({ fetched: allData.length, total: allData.length, type: "distributor" });
        }
      }

      if (allData.length === 0) {
        Swal.fire("No Data", `No records found for distributor: ${distributorCode}`, "warning");
        setShowExportModal(false);
        return;
      }

      // Fetch group map for name resolution
      const { data: groupData } = await supabase.from("mother_account").select("code, name");
      const localGroupMap = {};
      groupData?.forEach(g => { localGroupMap[g.code] = g.name; });
      const exportData = allData.map((row) => ({
        distributor_name: distributorMap[row.distributor_code] || row.distributor_code || "",
        mother_name: motherMap[row.mother_code] || row.mother_code || "",
        bp_code: row.bp_code || "",
        bp_name: row.bp_name || "",
        group_name: localGroupMap[row.group_code] || row.group_code || "",
        status: row.status ? "Active" : "Inactive",
      }));

      await new Promise((res) => setTimeout(res, 300));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "AccountsList");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      const distName = distributorMap[distributorCode] || distributorCode;
      saveAs(blob, `accounts_${distName}_${distributorCode}.xlsx`);

      setShowExportModal(false);
      setShowExportByDistModal(false);
      setSelectedDistForExport(null);
      setExportDistSearch('');
    } catch (err) {
      console.error("Export Error:", err);
      Swal.fire("Error", err.message, "error");
      setShowExportModal(false);
    }
  };
  // 🔹 Handle file selection

  // 🔹 Delete a row in preview
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

  // 🔹 STEP 1: Validate BP Codes Against Bp_Accounts (BLOCKING)

  // 🔹 STEP 1: Validate BP Codes Against Bp_Accounts (BLOCKING)
  // 🔹 STEP 1: Validate BP Codes Against Bp_Accounts (BLOCKING) - FIXED FOR 80K+ RECORDS
  const validateBpCodes = async () => {
    if (!importData.length) return { valid: true, invalidRecords: [] };

    console.log("🔍 Validating BP Codes against Bp_Accounts...");

    Swal.fire({
      title: 'Validating BP Codes...',
      html: 'Loading BP Accounts database...<br><span id="bp-progress" style="color:#2563eb;font-weight:600;">0 loaded...</span>',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // ✅ LOAD ALL BP CODES WITH PAGINATION (handles 80k+ records)
      const batchSize = 1000;
      let allBpAccounts = [];
      let offset = 0;
      let hasMore = true;

      console.log("📥 Starting to load ALL BP codes from database...");

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('Bp_Accounts')
          .select('bp_code, bp_name')
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error("❌ Error fetching Bp_Accounts:", error);
          Swal.close();
          Swal.fire({
            icon: "error",
            title: "Database Error!",
            text: `Failed to validate BP codes: ${error.message}`,
            confirmButtonColor: '#d33'
          });
          return { valid: false, invalidRecords: [] };
        }

        if (batch && batch.length > 0) {
          allBpAccounts = [...allBpAccounts, ...batch];
          offset += batchSize;
          hasMore = batch.length === batchSize;

          // Update progress in modal
          const progressEl = document.getElementById('bp-progress');
          if (progressEl) {
            progressEl.textContent = `${allBpAccounts.length.toLocaleString()} loaded...`;
          }

          // ✅ FIXED: Using parentheses () not backticks
          console.log(`📦 Batch ${Math.floor(offset / batchSize)}: Loaded ${allBpAccounts.length.toLocaleString()} total BP codes`);
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Finished loading ALL ${allBpAccounts.length.toLocaleString()} BP codes from database`);

      const validBpAccounts = allBpAccounts;

      // ✅ LOG RAW DATA FROM DATABASE
      console.log("📦 RAW BP Accounts from DB (first 5):", validBpAccounts.slice(0, 5));

      const validBpCodes = new Set(
        validBpAccounts.map(acc => {
          const code = acc.bp_code?.toString().trim().toUpperCase();
          return code;
        }).filter(Boolean)
      );

      console.log(`✅ Total valid BP codes: ${validBpCodes.size}`);
      console.log("📋 First 10 valid codes:", Array.from(validBpCodes).slice(0, 10));

      // ✅ LOG RAW DATA FROM EXCEL
      console.log("📦 RAW Import Data (first 5):", importData.slice(0, 5));

      const invalidRecords = [];
      importData.forEach((row, idx) => {
        const rawBpCode = row.bp_code?.toString().trim();
        const normalizedBpCode = rawBpCode?.toUpperCase();

        // ✅ DETAILED LOGGING
        console.log(`\n🔍 Row ${idx + 2}:`);
        console.log(`   Raw: "${rawBpCode}"`);
        console.log(`   Normalized: "${normalizedBpCode}"`);
        console.log(`   Exists in Set: ${validBpCodes.has(normalizedBpCode)}`);

        if (!rawBpCode || rawBpCode === "") {
          invalidRecords.push({
            Row: idx + 2,
            BP_Code: "❌ EMPTY/NULL",
            BP_Name: row.bp_name || "N/A",
            Distributor: row.distributor_code || "N/A",
            Issue: "BP Code is empty or missing"
          });
        } else if (!validBpCodes.has(normalizedBpCode)) {
          console.log(`   ❌ NOT FOUND IN DATABASE`);
          invalidRecords.push({
            Row: idx + 2,
            BP_Code: rawBpCode,
            BP_Name: row.bp_name || "N/A",
            Distributor: row.distributor_code || "N/A",
            Issue: "BP Code NOT FOUND in Bp_Accounts table"
          });
        } else {
          console.log(`   ✅ VALID!`);
        }
      });

      Swal.close();

      if (invalidRecords.length > 0) {
        console.log("\n⚠️ TOTAL INVALID:", invalidRecords.length);
        console.table(invalidRecords);

        const invalidList = invalidRecords.slice(0, 15).map(r =>
          `<li style="margin: 8px 0; padding: 8px; background: #fee; border-left: 4px solid #d33; border-radius: 4px;">
          <strong>Row ${r.Row}:</strong> <code style="background: #333; color: #ff6b6b; padding: 2px 6px; border-radius: 3px;">${r.BP_Code}</code><br>
          <small style="color: #666;">BP Name: ${r.BP_Name} | Distributor: ${r.Distributor}</small><br>
          <small style="color: #d33;">⚠️ ${r.Issue}</small>
        </li>`
        ).join('');

        Swal.fire({
          icon: "error",
          title: "🚫 INVALID BP CODES!",
          html: `
          <div style="text-align:left;">
            <div style="background: #fee; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h3 style="color: #d33; margin: 0;">⛔ BLOCKED!</h3>
              <p><strong style="color: red; font-size: 18px;">${invalidRecords.length}</strong> invalid codes</p>
            </div>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; max-height: 400px; overflow-y: auto;">
              <h4>❌ Invalid Records:</h4>
              <ul style="list-style: none; padding: 0;">${invalidList}</ul>
            </div>
          </div>
        `,
          width: 800,
          confirmButtonColor: '#d33'
        });

        return { valid: false, invalidRecords };
      }

      console.log("✅ ALL VALID!");
      Swal.fire({
        icon: "success",
        title: "✅ Valid!",
        text: `All ${importData.length} BP codes are valid`,
        timer: 1500,
        showConfirmButton: false
      });

      return { valid: true, invalidRecords: [] };

    } catch (err) {
      console.error("💥 ERROR:", err);
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Validation Failed!",
        text: err.message,
        confirmButtonColor: '#d33'
      });
      return { valid: false, invalidRecords: [] };
    }
  };
  // 🔹 STEP 2: Check for existing records and mark for UPDATE - FIXED FOR LARGE DATASETS
  const checkExistingRecords = async () => {
    if (!importData.length) return;

    // ⚠️ FIRST: VALIDATE BP CODES
    const validation = await validateBpCodes();
    if (!validation.valid) {
      console.log("❌ BP Code validation failed. Stopping duplicate check.");
      return;
    }

    // ⚠️ SECOND: Check for existing records
    setChecking(true);
    setLoadingProgress({ current: 0, total: 0 });

    try {
      console.log("🔍 Checking for existing records in Accounts_List...");

      const bpCodes = [...new Set(importData.map(r => r.bp_code).filter(Boolean))];
      console.log(`📊 Checking ${bpCodes.length} unique BP codes...`);

      Swal.fire({
        title: 'Checking for Duplicates...',
        html: 'Searching existing records...<br><span id="duplicate-progress" style="color:#2563eb;font-weight:600;">0 / 0</span>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      // ✅ BATCH THE BP CODES (Supabase .in() has ~1000 item limit)
      const BATCH_SIZE = 500;
      let allExistingRecords = [];

      for (let i = 0; i < bpCodes.length; i += BATCH_SIZE) {
        const batchCodes = bpCodes.slice(i, i + BATCH_SIZE);

        console.log(`📥 Checking batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchCodes.length} codes`);

        const { data: batchRecords, error } = await supabase
          .from('Accounts_List')
          .select('id, bp_code, distributor_code, mother_code, bp_name, group_code, status')
          .in('bp_code', batchCodes);

        if (error) {
          console.error("❌ Error fetching batch:", error);
          throw error;
        }

        if (batchRecords && batchRecords.length > 0) {
          allExistingRecords = [...allExistingRecords, ...batchRecords];
          console.log(`✅ Found ${batchRecords.length} existing records in this batch (Total: ${allExistingRecords.length})`);
        }

        // Update progress
        const progressEl = document.getElementById('duplicate-progress');
        if (progressEl) {
          const processed = Math.min(i + BATCH_SIZE, bpCodes.length);
          progressEl.textContent = `${processed} / ${bpCodes.length}`;
        }

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      Swal.close();

      console.log(`✅ Finished checking: Found ${allExistingRecords.length} existing records`);

      // Create lookup map
      const existingMap = {};
      allExistingRecords.forEach(record => {
        existingMap[record.bp_code] = record;
      });

      // Mark each row as new or update
      let newCount = 0;
      let updateCount = 0;

      const updatedImportData = importData.map(row => {
        const existing = existingMap[row.bp_code];

        if (!existing) {
          // NEW RECORD
          newCount++;
          return { ...row, _updateFlag: 'new' };
        }

        // BP Code exists in Accounts_List → MARK FOR UPDATE
        updateCount++;
        return {
          ...row,
          _updateFlag: 'update',
          _oldData: existing
        };
      });

      setImportData(updatedImportData);
      setDuplicatesChecked(true);

      console.log("\n📊 DUPLICATE CHECK RESULTS:");
      console.log(`✅ New Records: ${newCount}`);
      console.log(`🔄 Records to Update: ${updateCount}`);

      Swal.fire({
        icon: "info",
        title: "✅ Duplicate Check Complete!",
        html: `
        <div style="text-align:left; font-family: monospace;">
          <p><strong>✅ New Records:</strong> ${newCount}</p>
          <p style="color: orange;"><strong>🔄 Will Update:</strong> ${updateCount}</p>
          <hr>
          <p><strong>📊 Total Rows:</strong> ${importData.length}</p>
          ${updateCount > 0 ? '<p style="color: orange;"><em>⚠️ Existing BP codes will be updated</em></p>' : ''}
        </div>
      `,
        confirmButtonText: 'OK',
        width: 500
      });

    } catch (err) {
      console.error("💥 Error checking duplicates:", err);
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Duplicate Check Failed!",
        text: err.message,
        confirmButtonColor: '#d33'
      });
    } finally {
      setChecking(false);
    }
  };

  // 🔹 STEP 3: Import with UPDATE logic
  const BATCH_SIZE = 500;
  const CONCURRENCY = 8;

  function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  // Run async tasks with max N concurrent at a time
  async function parallelBatch(items, fn, concurrency = CONCURRENCY, onProgress) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const slice = items.slice(i, i + concurrency);
      const res = await Promise.all(slice.map(fn));
      results.push(...res);
      if (onProgress) onProgress(Math.min(i + concurrency, items.length), items.length);
    }
    return results;
  }

  // ── Main Function ────────────────────────────────────────────

  const importDataToDB = async () => {
    if (!importData.length) return;

    // ── STEP 1: Load ALL valid BP codes ONCE ──────────────────
    Swal.fire({
      title: '🔍 Loading BP codes...',
      html: '<span id="bp-prog" style="color:#2563eb;font-weight:700;">0 loaded</span>',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // Get total count first
      const { count: totalBp, error: cntErr } = await supabase
        .from('Bp_Accounts')
        .select('*', { count: 'exact', head: true });

      if (cntErr) throw cntErr;

      if (!totalBp || totalBp === 0) {
        Swal.close();
        Swal.fire('Error', 'Bp_Accounts table is empty!', 'error');
        return;
      }

      // Parallel fetch of all BP codes
      const totalBpBatches = Math.ceil(totalBp / BATCH_SIZE);
      const bpBatchIndexes = Array.from({ length: totalBpBatches }, (_, i) => i);

      let allBpCodes = [];

      await parallelBatch(bpBatchIndexes, async (batchIdx) => {
        const from = batchIdx * BATCH_SIZE;
        const { data, error } = await supabase
          .from('Bp_Accounts')
          .select('bp_code')
          .range(from, from + BATCH_SIZE - 1);
        if (error) throw error;
        return data || [];
      }, CONCURRENCY, (done, total) => {
        const el = document.getElementById('bp-prog');
        if (el) el.textContent = `${done * BATCH_SIZE} / ${totalBp} loaded`;
      }).then(results => {
        allBpCodes = results.flat();
      });

      const validBpSet = new Set(
        allBpCodes.map(r => r.bp_code?.toString().trim().toUpperCase()).filter(Boolean)
      );

      console.log(`✅ Valid BP codes loaded: ${validBpSet.size}`);

      // ── STEP 2: Validate import data against BP set ───────────
      const invalidRows = [];
      importData.forEach((row, idx) => {
        const code = row.bp_code?.toString().trim().toUpperCase();
        if (!code) {
          invalidRows.push({ row: idx + 2, bp_code: 'EMPTY', issue: 'BP code is empty' });
        } else if (!validBpSet.has(code)) {
          invalidRows.push({ row: idx + 2, bp_code: code, issue: 'Not found in Bp_Accounts' });
        }
      });

      if (invalidRows.length > 0) {
        Swal.close();
        const list = invalidRows.slice(0, 15).map(r =>
          `<li style="margin:6px 0;padding:6px 10px;background:#fee;border-left:3px solid #d33;border-radius:4px;">
           <strong>Row ${r.row}:</strong> <code>${r.bp_code}</code> — ${r.issue}
         </li>`
        ).join('');

        Swal.fire({
          icon: 'error',
          title: `🚫 ${invalidRows.length} invalid BP code(s)`,
          html: `<ul style="list-style:none;padding:0;max-height:350px;overflow-y:auto;">${list}
          ${invalidRows.length > 15 ? `<li style="padding:8px;color:#888;">...and ${invalidRows.length - 15} more</li>` : ''}
        </ul>`,
          width: 700,
        });
        return;
      }

      Swal.close();

      // ── STEP 3: Check existing records in parallel ────────────
      Swal.fire({
        title: '🔍 Checking existing records...',
        html: '<div id="dup-prog">Starting...</div>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const uniqueBpCodes = [...new Set(importData.map(r => r.bp_code?.toString().trim()).filter(Boolean))];
      const bpChunks = chunkArray(uniqueBpCodes, BATCH_SIZE);

      let existingRecords = [];
      let checkedCount = 0;

      await parallelBatch(bpChunks, async (chunk) => {
        const { data, error } = await supabase
          .from('Accounts_List')
          .select('id, bp_code, distributor_code, mother_code, bp_name, group_code, status')
          .in('bp_code', chunk);
        if (error) throw error;
        return data || [];
      }, CONCURRENCY, (done, total) => {
        checkedCount = done;
        const pct = Math.round(done / total * 100);
        const el = document.getElementById('dup-prog');
        if (el) el.innerHTML = `
        <b style="color:#2563eb">${done * BATCH_SIZE} / ${uniqueBpCodes.length}</b> codes checked
        <div style="width:100%;height:8px;background:#eee;border-radius:4px;margin-top:6px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:#2563eb;transition:width 0.2s;"></div>
        </div>
      `;
      }).then(results => {
        existingRecords = results.flat();
      });

      // Build lookup map
      const existingMap = {};
      existingRecords.forEach(r => {
        existingMap[r.bp_code?.toString().trim().toUpperCase()] = r;
      });

      console.log(`✅ Found ${existingRecords.length} existing records`);

      // ── STEP 4: Separate NEW vs UPDATE vs SKIP ────────────────
      const toInsert = [];
      const toUpdate = [];
      let skippedCount = 0;

      importData.forEach(row => {
        const bpKey = row.bp_code?.toString().trim().toUpperCase();
        const existing = existingMap[bpKey];

        const newRecord = {
          distributor_code: row.distributor_code || null,
          mother_code: row.mother_code || null,
          bp_code: row.bp_code || null,
          bp_name: row.bp_name || null,
          group_code: row.group_code || null,
        };
        if (!existing) {
          toInsert.push({ ...newRecord, status: true });
          return;
        }

        const normalize = (v) => (v === '' || v === undefined || v === null) ? null : String(v).trim();

        const hasChanges =

          normalize(newRecord.distributor_code) !== normalize(existing.distributor_code) ||
          normalize(newRecord.mother_code) !== normalize(existing.mother_code) ||
          normalize(newRecord.bp_name) !== normalize(existing.bp_name) ||
          normalize(newRecord.group_code) !== normalize(existing.group_code);

        if (hasChanges) {
          toUpdate.push({ id: existing.id, ...newRecord, status: existing.status });
        } else {
          skippedCount++;
        }
      });

      Swal.close();

      // ── STEP 5: Confirm before proceeding ─────────────────────
      const confirmResult = await Swal.fire({
        icon: 'info',
        title: '📊 Smart Import Summary',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:2;">
          <p>✅ <b>New records:</b> ${toInsert.length.toLocaleString()}</p>
          <p style="color:orange;">🔄 <b>Will update (changed):</b> ${toUpdate.length.toLocaleString()}</p>
          <p style="color:gray;">⏭️ <b>Skipped (no changes):</b> ${skippedCount.toLocaleString()}</p>
          <hr/>
          <p>📋 <b>Total rows:</b> ${importData.length.toLocaleString()}</p>
        </div>
      `,
        showCancelButton: true,
        confirmButtonText: 'Proceed',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#10b981',
      });

      if (!confirmResult.isConfirmed) return;

      // ── STEP 6: INSERT in parallel batches ────────────────────
      let insertedCount = 0;
      let updatedCount = 0;
      const failedBatches = [];

      if (toInsert.length > 0) {
        Swal.fire({
          title: '📥 Inserting new records...',
          html: '<div id="ins-prog">Starting...</div>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        const insertChunks = chunkArray(toInsert, BATCH_SIZE);

        await parallelBatch(insertChunks, async (chunk) => {
          const { error } = await supabase.from('Accounts_List').insert(chunk);
          if (error) {
            console.error('Insert batch error:', error.message);
            failedBatches.push({ type: 'insert', count: chunk.length, error: error.message });
            return 0;
          }
          return chunk.length;
        }, CONCURRENCY, (done, total) => {
          const count = Math.min(done * BATCH_SIZE, toInsert.length);
          const pct = Math.round(count / toInsert.length * 100);
          const el = document.getElementById('ins-prog');
          if (el) el.innerHTML = `
          <b style="color:#10b981;font-size:18px;">${count.toLocaleString()} / ${toInsert.length.toLocaleString()}</b>
          <div style="width:100%;height:10px;background:#eee;border-radius:5px;margin-top:8px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#10b981;transition:width 0.2s;"></div>
          </div>
          <p style="color:#6b7280;margin-top:4px;font-size:12px;">${pct}%</p>
        `;
        }).then(results => {
          insertedCount = results.reduce((s, n) => s + (n || 0), 0);
        });
      }

      // ── STEP 7: UPDATE in parallel batches ────────────────────
      if (toUpdate.length > 0) {
        Swal.fire({
          title: '🔄 Updating changed records...',
          html: '<div id="upd-prog">Starting...</div>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        const updateChunks = chunkArray(toUpdate, BATCH_SIZE);

        await parallelBatch(updateChunks, async (chunk) => {
          // upsert by bp_code — NO individual fallback loop
          const { error } = await supabase
            .from('Accounts_List')
            .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });

          if (error) {
            console.error('Upsert batch error:', error.message);
            failedBatches.push({ type: 'update', count: chunk.length, error: error.message });
            return 0;
          }
          return chunk.length;
        }, CONCURRENCY, (done, total) => {
          const count = Math.min(done * BATCH_SIZE, toUpdate.length);
          const pct = Math.round(count / toUpdate.length * 100);
          const el = document.getElementById('upd-prog');
          if (el) el.innerHTML = `
          <b style="color:#f59e0b;font-size:18px;">${count.toLocaleString()} / ${toUpdate.length.toLocaleString()}</b>
          <div style="width:100%;height:10px;background:#eee;border-radius:5px;margin-top:8px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:#f59e0b;transition:width 0.2s;"></div>
          </div>
          <p style="color:#6b7280;margin-top:4px;font-size:12px;">${pct}%</p>
        `;
        }).then(results => {
          updatedCount = results.reduce((s, n) => s + (n || 0), 0);
        });
      }

      Swal.close();

      // ── STEP 8: Final summary ─────────────────────────────────
      await Swal.fire({
        icon: failedBatches.length > 0 ? 'warning' : 'success',
        title: '✅ Import Complete!',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:2;">
          <p style="color:green;">✅ <b>Inserted:</b> ${insertedCount.toLocaleString()}</p>
          <p style="color:orange;">🔄 <b>Updated:</b> ${updatedCount.toLocaleString()}</p>
          <p style="color:gray;">⏭️ <b>Skipped:</b> ${skippedCount.toLocaleString()}</p>
          ${failedBatches.length > 0
            ? `<p style="color:red;">❌ <b>Failed batches:</b> ${failedBatches.length} 
               (${failedBatches.reduce((s, b) => s + b.count, 0).toLocaleString()} rows)</p>`
            : ''}
          <hr/>
          <p>📋 <b>Total:</b> ${importData.length.toLocaleString()}</p>
        </div>
      `,
      });

      fetchAndCleanData();

    } catch (err) {
      console.error('Import error:', err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
    } finally {
      setUploading(false);
      setImporting(false);
    }
  };

  // 🔹 Handle Excel Import (no changes needed, just included for completeness)
  // 🔹 Handle Excel Import with IMMEDIATE BP validation
  const handleImportMother = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ⚠️⚠️⚠️ CHECK BP_ACCOUNTS FIRST BAGO MAG-PROCESS ⚠️⚠️⚠️
    Swal.fire({
      title: 'Checking BP Accounts...',
      text: 'Validating database...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // CHECK IF BP_ACCOUNTS HAS DATA
      const { data: bpCheck, error: bpError } = await supabase
        .from('Bp_Accounts')
        .select('bp_code, bp_name')
        .limit(1);

      if (bpError) {
        Swal.close();
        Swal.fire({
          icon: "error",
          title: "Database Error!",
          text: `Failed to check Bp_Accounts: ${bpError.message}`,
          confirmButtonColor: '#d33'
        });
        return;
      }

      // ⚠️⚠️⚠️ IF BP_ACCOUNTS IS EMPTY - SHOW SUPER WARNING ⚠️⚠️⚠️
      if (!bpCheck || bpCheck.length === 0) {
        Swal.close();

        console.error("🚨🚨🚨 BP_ACCOUNTS TABLE IS EMPTY! BLOCKING UPLOAD!");

        Swal.fire({
          icon: "error",
          title: "🚨 BP_ACCOUNTS TABLE IS EMPTY!",
          html: `
        <div style="text-align:left; font-family: 'Segoe UI', sans-serif;">
          <div style="background: #fee; padding: 20px; border-radius: 8px; margin-bottom: 15px; border: 3px solid #d33;">
            <h2 style="color: #d33; margin: 0 0 15px 0; font-size: 24px;">⛔ UPLOAD BLOCKED!</h2>
            <p style="margin: 10px 0; font-size: 16px;"><strong style="color: red;">The Bp_Accounts table has NO RECORDS!</strong></p>
            <p style="margin: 10px 0; font-size: 14px; color: #666;">You cannot import data without valid BP codes in the system.</p>
          </div>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border: 2px solid #ffc107; margin-bottom: 15px;">
            <h3 style="margin-top: 0; color: #856404;">⚠️ REQUIRED ACTIONS:</h3>
            <ol style="margin: 15px 0; padding-left: 25px; color: #666; font-size: 14px; line-height: 1.8;">
              <li><strong>Go to the Bp_Accounts table</strong> (Business Partner Accounts)</li>
              <li><strong>Add BP codes</strong> that match the codes in your Excel file</li>
              <li><strong>Make sure each BP code is unique</strong> and properly entered</li>
              <li><strong>Save all BP Account records</strong></li>
              <li><strong>Try uploading your Excel file again</strong></li>
            </ol>
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 5px solid #2196f3;">
            <h4 style="margin-top: 0; color: #1976d2;">💡 What are BP Codes?</h4>
            <p style="margin: 5px 0; color: #666; font-size: 13px;">
              BP (Business Partner) Codes are unique identifiers for customers, vendors, or partners.
              Every record in your Excel file must have a BP code that exists in the Bp_Accounts table.
            </p>
          </div>

          <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 5px solid #f44336;">
            <p style="margin: 0; color: #c62828; font-size: 14px; font-weight: bold;">
              ⚠️ You CANNOT proceed with the upload until BP codes are added to Bp_Accounts!
            </p>
          </div>
        </div>
      `,
          width: 900,
          confirmButtonText: '❌ Close - Add BP Codes First',
          confirmButtonColor: '#d33',
          allowOutsideClick: false
        });

        return; // BLOCK THE UPLOAD COMPLETELY
      }

      console.log("✅ Bp_Accounts has data, proceeding with Excel upload...");

    } catch (err) {
      Swal.close();
      console.error("💥 Error checking Bp_Accounts:", err);
      Swal.fire({
        icon: "error",
        title: "Validation Failed!",
        text: `Failed to check Bp_Accounts: ${err.message}`,
        confirmButtonColor: '#d33'
      });
      return;
    }

    // ✅ BP_ACCOUNTS HAS DATA - CONTINUE WITH EXCEL PROCESSING
    Swal.fire({
      title: 'Reading Excel File...',
      text: 'Please wait...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const rawData = await readExcelFile(file);

    if (!rawData.length) {
      Swal.close();
      Swal.fire({
        icon: 'warning',
        title: 'Empty File!',
        text: 'The Excel file contains no data.',
        confirmButtonText: 'OK'
      });
      return;
    }

    // ✅ REMOVED 40K LIMIT - ACCEPT ANY NUMBER OF ROWS
    console.log(`📊 Excel contains ${rawData.length.toLocaleString()} rows - Processing all...`);

    // Show warning if file is very large (over 100k rows)
    if (rawData.length > 100000) {
      const confirmLarge = await Swal.fire({
        icon: 'warning',
        title: 'Large File Detected',
        html: `
        <p>Excel contains <strong>${rawData.length.toLocaleString()} rows</strong>.</p>
        <p>This may take several minutes to process.</p>
        <p><strong>Do you want to continue?</strong></p>
      `,
        showCancelButton: true,
        confirmButtonText: 'Yes, Process All',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6c757d'
      });

      if (!confirmLarge.isConfirmed) return;
    }

    Swal.fire({
      title: 'Processing Excel...',
      html: `Converting names to codes...<br><span id="excel-progress" style="color:#2563eb;font-weight:600;">0 / ${rawData.length.toLocaleString()} rows</span>`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const [
        { data: motherAccounts },
        { data: agentAccounts },
        { data: bpAccounts },
        { data: distributorAccounts }
      ] = await Promise.all([
        supabase.from('sub_mother_account').select('dscode, name, group_name, group_code'),
        supabase.from('Account_Users').select('UserID, name'),
        supabase.from('Bp_Accounts').select('bp_code, bp_name'),
        supabase.from('distributors').select('code, name')
      ]);

      const groupNameToCodeMap = {};
      motherAccounts?.forEach(m => {
        if (m.group_name && m.group_code) {
          const normalizedGroupName = m.group_name.toString().trim().toLowerCase();
          groupNameToCodeMap[normalizedGroupName] = m.group_code.toString();
        }
      });

      const motherLookup = {};
      motherAccounts?.forEach(m => {
        const groupCode = m.group_code?.toString().trim();
        const exactName = m.name?.toString().trim().toLowerCase();
        const normalizedName = exactName.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/\s+/g, ' ').trim();
        if (!groupCode || !m.name) return;
        if (!motherLookup[groupCode]) motherLookup[groupCode] = {};
        motherLookup[groupCode][exactName] = m.dscode;
        motherLookup[groupCode][normalizedName] = m.dscode;
      });

      const findMotherCode = (rawMotherName, resolvedGroupCode) => {
        const groupCode = resolvedGroupCode?.toString().trim();
        if (!groupCode || !motherLookup[groupCode]) return rawMotherName;

        const exactName = rawMotherName.toString().trim().toLowerCase();
        const normalizedName = exactName.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/\s+/g, ' ').trim();
        const availableNames = motherLookup[groupCode];

        if (availableNames[exactName]) return availableNames[exactName];
        if (availableNames[normalizedName]) return availableNames[normalizedName];
        const fuzzyMatch = Object.keys(availableNames).find(dbName =>
          dbName.includes(normalizedName) || normalizedName.includes(dbName)
        );
        if (fuzzyMatch) return availableNames[fuzzyMatch];
        return Object.values(availableNames)[0] || rawMotherName;
      };

      const createMap = (arr, key1, key2) => {
        const map = {};
        arr?.forEach(item => {
          if (item[key1]) map[item[key1].toString().trim().toLowerCase()] = item[key2];
          if (item[key2]) map[item[key2].toString().trim().toLowerCase()] = item[key2];
        });
        return map;
      };

      const agentMap = createMap(agentAccounts, 'name', 'UserID');
      const bpMap = createMap(bpAccounts, 'bp_name', 'bp_code');
      const distributorMap = createMap(distributorAccounts, 'name', 'code');
      const bpNameMap = {};
      bpAccounts?.forEach(b => {
        if (b.bp_code && b.bp_name)
          bpNameMap[b.bp_code.toString().trim().toLowerCase()] = b.bp_name;
      });

      const isCode = (val) => /^[A-Z0-9\-_]+$/i.test(val || '');

      // Process data in chunks to show progress
      const CHUNK_SIZE = 1000;
      const processedData = [];

      for (let i = 0; i < rawData.length; i += CHUNK_SIZE) {
        const chunk = rawData.slice(i, i + CHUNK_SIZE);

        const processedChunk = chunk.map((row) => {
          const rawGroup = row.group_code?.toString().trim() || row.group_name?.toString().trim() || '';
          const rawMother = row.mother_code?.toString().trim() || row.mother_name?.toString().trim() || '';
          const rawAgent = row.agent_code?.toString().trim() || row.agent_name?.toString().trim() || '';
          const rawBp = row.bp_code?.toString().trim() || '';
          const rawDist = row.distributor_code?.toString().trim() || row.distributor_name?.toString().trim() || '';

          let groupCode = rawGroup;
          if (!isCode(rawGroup)) {
            groupCode = groupNameToCodeMap[rawGroup.toLowerCase()] || rawGroup;
          }

          let motherCode = rawMother;
          if (!isCode(rawMother)) {
            motherCode = findMotherCode(rawMother, groupCode);
          }

          const agentCode = isCode(rawAgent)
            ? rawAgent
            : (agentMap[rawAgent.toLowerCase()] || rawAgent);

          const bpCode = isCode(rawBp)
            ? rawBp
            : (bpMap[rawBp.toLowerCase()] || rawBp);

          const bpName =
            bpNameMap[bpCode?.toString().trim().toLowerCase()] ||
            row.bp_name ||
            null;

          const distributorCode = isCode(rawDist)
            ? rawDist
            : (distributorMap[rawDist.toLowerCase()] || rawDist);

          return {
            distributor_code: distributorCode || '',
            mother_code: motherCode || '',
            bp_code: bpCode || '',
            bp_name: bpName || '',
            group_code: groupCode || '',
            status: 'status'
          };
        });

        processedData.push(...processedChunk);

        // Update progress
        const progressEl = document.getElementById('excel-progress');
        if (progressEl) {
          progressEl.textContent = `${processedData.length.toLocaleString()} / ${rawData.length.toLocaleString()} rows`;
        }

        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      Swal.close();

      // ⚠️⚠️ VALIDATE BP CODES AGAINST Bp_Accounts ⚠️⚠️
      console.log("\n🔍 VALIDATING BP CODES...");

      Swal.fire({
        title: 'Validating BP Codes...',
        html: 'Loading all BP codes from database...<br><span id="validate-progress" style="color:#2563eb;font-weight:600;">0 loaded...</span>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      try {
        // ✅ STEP 1: Get total count first
        const { count: totalBpCount, error: countError } = await supabase
          .from('Bp_Accounts')
          .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        console.log(`📊 Total BP codes in database: ${totalBpCount?.toLocaleString() || 0}`);

        if (!totalBpCount || totalBpCount === 0) {
          Swal.close();
          Swal.fire({
            icon: "error",
            title: "⚠️ BP Accounts is EMPTY!",
            text: "Please add BP codes to Bp_Accounts table first.",
            confirmButtonColor: '#d33'
          });
          return;
        }

        // ✅ STEP 2: Load ALL BP codes in batches
        const BATCH_SIZE = 1000;
        let allBpCodes = [];
        let currentOffset = 0;

        while (currentOffset < totalBpCount) {
          console.log(`📥 Fetching batch: offset ${currentOffset} to ${currentOffset + BATCH_SIZE - 1}`);

          const { data: batch, error } = await supabase
            .from('Bp_Accounts')
            .select('bp_code')
            .order('id', { ascending: true })
            .range(currentOffset, currentOffset + BATCH_SIZE - 1);

          if (error) {
            console.error("❌ Error fetching batch:", error);
            throw error;
          }

          if (!batch || batch.length === 0) {
            console.log("⚠️ No more data, breaking loop");
            break;
          }

          console.log(`✅ Loaded batch: ${batch.length} codes (Total so far: ${allBpCodes.length + batch.length})`);

          allBpCodes = [...allBpCodes, ...batch];
          currentOffset += BATCH_SIZE;

          // Update progress
          const progressEl = document.getElementById('validate-progress');
          if (progressEl) {
            const percentage = Math.min(100, Math.round((allBpCodes.length / totalBpCount) * 100));
            progressEl.textContent = `${allBpCodes.length.toLocaleString()} / ${totalBpCount.toLocaleString()} (${percentage}%)`;
          }

          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`✅ FINISHED LOADING: ${allBpCodes.length.toLocaleString()} total BP codes`);

        Swal.close();

        // ✅ STEP 3: Create validation set
        const validBpCodes = new Set(
          allBpCodes
            .map(acc => acc.bp_code?.toString().trim().toUpperCase())
            .filter(Boolean)
        );

        console.log(`✅ Valid BP codes in database: ${validBpCodes.size.toLocaleString()}`);
        console.log("📋 Sample BP codes:", Array.from(validBpCodes).slice(0, 10));

        // ✅ STEP 4: Validate Excel data
        const invalidRecords = [];
        processedData.forEach((row, idx) => {
          const bpCode = row.bp_code?.toString().trim();

          if (!bpCode || bpCode === "") {
            invalidRecords.push({
              Row: idx + 2,
              BP_Code: "❌ EMPTY/NULL",
              BP_Name: row.bp_name || "N/A",
              Distributor: row.distributor_code || "N/A",
              Issue: "BP Code is empty or missing"
            });
          } else if (!validBpCodes.has(bpCode.toUpperCase())) {
            invalidRecords.push({
              Row: idx + 2,
              BP_Code: bpCode,
              BP_Name: row.bp_name || "N/A",
              Distributor: row.distributor_code || "N/A",
              Issue: "BP Code NOT FOUND in Bp_Accounts table"
            });
          }
        });

        // ✅ STEP 5: Show results
        if (invalidRecords.length > 0) {
          console.log("\n⚠️⚠️⚠️ INVALID BP CODES FOUND:");
          console.table(invalidRecords);

          const invalidList = invalidRecords.slice(0, 15).map(r =>
            `<li style="margin: 8px 0; padding: 8px; background: #fee; border-left: 4px solid #d33; border-radius: 4px;">
            <strong>Row ${r.Row}:</strong> <code style="background: #333; color: #ff6b6b; padding: 2px 6px; border-radius: 3px;">${r.BP_Code}</code><br>
            <small style="color: #666;">BP Name: ${r.BP_Name} | Distributor: ${r.Distributor}</small><br>
            <small style="color: #d33;">⚠️ ${r.Issue}</small>
          </li>`
          ).join('');

          Swal.fire({
            icon: "error",
            title: "🚫 INVALID BP CODES DETECTED!",
            html: `
            <div style="text-align:left; font-family: 'Segoe UI', sans-serif;">
              <div style="background: #fee; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #d33;">
                <h3 style="color: #d33; margin: 0 0 10px 0;">⛔ EXCEL UPLOAD BLOCKED!</h3>
                <p style="margin: 5px 0;"><strong style="color: red; font-size: 18px;">${invalidRecords.length.toLocaleString()}</strong> invalid BP code(s) found out of <strong>${processedData.length.toLocaleString()}</strong> total rows!</p>
              </div>
              
              <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; max-height: 400px; overflow-y: auto;">
                <h4 style="margin-top: 0; color: #333;">❌ Invalid Records (showing first 15):</h4>
                <ul style="list-style: none; padding: 0; margin: 0;">
                  ${invalidList}
                  ${invalidRecords.length > 15 ?
                `<li style="margin: 8px 0; padding: 8px; background: #fff3cd; border-left: 4px solid #ffc107;">
                      <strong>... and ${(invalidRecords.length - 15).toLocaleString()} more</strong>
                    </li>` : ''}
                </ul>
              </div>

              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 2px solid #ffc107;">
                <h4 style="margin-top: 0; color: #856404;">⚠️ ACTION REQUIRED:</h4>
                <ol style="margin: 10px 0; padding-left: 20px; color: #666;">
                  <li>Go to <strong>Bp Accounts</strong> table</li>
                  <li>Add the missing BP codes listed above</li>
                  <li>Upload your Excel file again</li>
                </ol>
              </div>
            </div>
          `,
            width: 800,
            confirmButtonText: '❌ Close',
            confirmButtonColor: '#d33',
            allowOutsideClick: false
          });

          return;
        }

        // ✅ ALL VALID
        console.log("✅ All BP codes validated!");

        setFileName(file.name);
        setImportData(processedData);
        setCurrentPageExcel(1);
        setTotalRows(processedData.length);
        setProcessedRows(0);
        setProgressPercent(0);
        setDuplicatesChecked(false);

        Swal.fire({
          icon: "success",
          title: "✅ Excel Uploaded Successfully!",
          html: `
          <div style="text-align:left;">
            <p><strong>File:</strong> ${file.name}</p>
            <p><strong>Total Rows:</strong> ${processedData.length.toLocaleString()}</p>
            <p style="color: green;"><strong>✅ All BP codes validated!</strong></p>
            <p style="color: #666; font-size: 13px; margin-top: 10px;">Ready to import all ${processedData.length.toLocaleString()} records</p>
          </div>
        `,
          timer: 3000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error('❌ Validation Error:', error);
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Validation Failed!',
          text: error.message,
          confirmButtonColor: '#d33'
        });
      }

    } catch (error) {
      console.error('❌ Error:', error);
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Processing Failed!',
        text: error.message || 'Failed to process Excel',
        confirmButtonColor: '#d33'
      });
    }
  };
  // 🔹 Modal visibility

  // 🔹 Excel import data
  const [importData, setImportData] = useState([]);
  const [existingRows, setExistingRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const itemsPerPage = 7;
  const exportMenuRef = useRef(null);
  const importMenuRef = useRef(null);
  const [totalCount, setTotalCount] = useState(0); // 👈 Add this line
  const [duplicatesChecked, setDuplicatesChecked] = useState(false); // ✅ track if check has been done


  // 🔹 Pagination
  const [currentPageExcel, setCurrentPageExcel] = useState(1);
  const rowsPerPageExcel = 10;
  const indexOfLastRowExcel = currentPageExcel * rowsPerPageExcel;
  const indexOfFirstRowExcel = indexOfLastRowExcel - rowsPerPageExcel;
  const currentRowsExcel = importData.slice(indexOfFirstRowExcel, indexOfLastRowExcel);
  const totalPagesExcel = Math.ceil(importData.length / rowsPerPageExcel);

  const checkAndCleanBPTagging = async () => {
    try {
      console.log("\n🚀 ========== STARTING BP TAGGING CHECK ==========");

      // 1️⃣ Confirmation
      const result = await Swal.fire({
        title: '🔍 Check BP List Tagging',
        text: 'This will check and remove accounts not existing in BP_Accounts. Continue?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Check Now',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
      });
      if (!result.isConfirmed) return;

      // 2️⃣ Loading while fetching Accounts_List
      Swal.fire({
        title: '🔄 Loading Accounts_List...',
        html: '<span id="accounts-progress" style="color:#2563eb;font-weight:600;">0 loaded...</span>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      // 3️⃣ Fetch ALL Accounts_List with pagination
      console.log("\n📥 STEP 1: Loading ALL Accounts_List records...");
      const batchSize = 1000;
      let allAccountsList = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('Accounts_List')
          .select('id, bp_code, bp_name, distributor_code, mother_code, agent_code, group_code')
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error("❌ Error fetching Accounts_List:", error);
          throw error;
        }

        if (batch && batch.length > 0) {
          allAccountsList = [...allAccountsList, ...batch];
          offset += batchSize;
          hasMore = batch.length === batchSize;

          const progressEl = document.getElementById('accounts-progress');
          if (progressEl) {
            progressEl.textContent = `${allAccountsList.length.toLocaleString()} loaded...`;
          }

          console.log(`📦 Batch ${Math.floor(offset / batchSize)}: Loaded ${allAccountsList.length.toLocaleString()} total Accounts_List records`);
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Finished loading Accounts_List: ${allAccountsList.length.toLocaleString()} total records`);
      console.log("📋 Sample Accounts_List (first 5):", allAccountsList.slice(0, 5));

      // 4️⃣ Loading Bp_Accounts
      Swal.update({
        title: '🔄 Loading Bp_Accounts...',
        html: '<span id="bp-progress" style="color:#2563eb;font-weight:600;">0 loaded...</span>'
      });

      console.log("\n📥 STEP 2: Loading ALL Bp_Accounts records...");
      let allBpAccounts = [];
      offset = 0;
      hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('Bp_Accounts')
          .select('bp_code')
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error("❌ Error fetching Bp_Accounts:", error);
          throw error;
        }

        if (batch && batch.length > 0) {
          allBpAccounts = [...allBpAccounts, ...batch];
          offset += batchSize;
          hasMore = batch.length === batchSize;

          const progressEl = document.getElementById('bp-progress');
          if (progressEl) {
            progressEl.textContent = `${allBpAccounts.length.toLocaleString()} loaded...`;
          }

          console.log(`📦 Batch ${Math.floor(offset / batchSize)}: Loaded ${allBpAccounts.length.toLocaleString()} total BP codes`);
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Finished loading Bp_Accounts: ${allBpAccounts.length.toLocaleString()} total BP codes`);
      console.log("📋 Sample Bp_Accounts (first 10):", allBpAccounts.slice(0, 10));

      // 5️⃣ Checking for mismatches
      Swal.update({
        title: '🔍 Checking for mismatches...',
        html: 'Comparing Accounts_List against Bp_Accounts...'
      });

      console.log("\n🔍 STEP 3: Checking for BP codes NOT in Bp_Accounts...");

      // Normalize BP codes for matching
      const normalize = str =>
        (str || "")
          .toString()
          .trim()
          .toUpperCase()
          .replace(/[-–—]/g, "-")
          .replace(/\s+/g, "")
          .replace(/[^A-Z0-9-]/g, "");

      const validBPCodes = new Set(allBpAccounts.map(bp => normalize(bp.bp_code)));
      console.log(`✅ Valid BP Codes Set created: ${validBPCodes.size.toLocaleString()} unique codes`);
      console.log("📋 Sample valid BP codes (first 10):", Array.from(validBPCodes).slice(0, 10));

      // 6️⃣ Find accounts NOT in BP_Accounts
      const accountsToDelete = [];

      allAccountsList.forEach((acc, idx) => {
        const rawCode = acc.bp_code;
        const normalizedCode = normalize(rawCode);
        const exists = validBPCodes.has(normalizedCode);

        if (!exists) {
          accountsToDelete.push(acc);

          // Log first 10 mismatches in detail
          if (accountsToDelete.length <= 10) {
            console.log(`\n❌ MISMATCH #${accountsToDelete.length}:`);
            console.log(`   Raw BP Code: "${rawCode}"`);
            console.log(`   Normalized: "${normalizedCode}"`);
            console.log(`   Exists in Bp_Accounts: ${exists}`);
            console.log(`   Full Record:`, acc);
          }
        }
      });

      console.log(`\n📊 RESULTS:`);
      console.log(`   Total Accounts_List: ${allAccountsList.length.toLocaleString()}`);
      console.log(`   Valid BP Codes: ${validBPCodes.size.toLocaleString()}`);
      console.log(`   ❌ NOT FOUND in Bp_Accounts: ${accountsToDelete.length.toLocaleString()}`);

      if (accountsToDelete.length > 10) {
        console.log(`\n⚠️ Total ${accountsToDelete.length} accounts NOT in Bp_Accounts`);
        console.table(accountsToDelete.slice(0, 20)); // Show first 20 in table
      } else if (accountsToDelete.length > 0) {
        console.table(accountsToDelete);
      }

      Swal.close();

      // 7️⃣ No deletion needed
      if (accountsToDelete.length === 0) {
        console.log("\n✅ ALL ACCOUNTS VALID! No cleanup needed.");
        Swal.fire({
          icon: 'success',
          title: '✅ All Clear!',
          text: 'All accounts exist in BP_Accounts.',
          timer: 2000,
          showConfirmButton: false
        });
        return;
      }

      // 8️⃣ Show confirmation with PAGINATION
      console.log("\n⚠️ Showing confirmation dialog for deletion...");

      let currentModalPage = 1;
      const rowsPerModalPage = 15;
      const totalModalPages = Math.ceil(accountsToDelete.length / rowsPerModalPage);

      const showPaginatedTable = (page) => {
        const startIdx = (page - 1) * rowsPerModalPage;
        const endIdx = startIdx + rowsPerModalPage;
        const pageData = accountsToDelete.slice(startIdx, endIdx);

        const tableRows = pageData.map(acc => `
        <tr class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 text-sm">${acc.bp_code || 'N/A'}</td>
          <td class="px-3 py-2 text-sm">${acc.bp_name || 'N/A'}</td>
          <td class="px-3 py-2 text-sm">${acc.distributor_code || 'N/A'}</td>
          <td class="px-3 py-2 text-sm">${acc.mother_code || 'N/A'}</td>
          <td class="px-3 py-2 text-sm">${acc.agent_code || 'N/A'}</td>
          <td class="px-3 py-2 text-sm">${acc.group_code || 'N/A'}</td>
        </tr>
      `).join('');

        return `
        <div class="text-left">
          <p class="mb-4 text-center">
            <strong>Found ${accountsToDelete.length.toLocaleString()} accounts not in BP_Accounts</strong>
          </p>
          
          <div class="border rounded" style="max-height: 400px;">
            <table class="w-full text-left">
              <thead class="bg-gray-100 sticky top-0">
                <tr>
                  <th class="px-3 py-2 text-sm font-semibold">BP Code</th>
                  <th class="px-3 py-2 text-sm font-semibold">BP Name</th>
                  <th class="px-3 py-2 text-sm font-semibold">Dist</th>
                  <th class="px-3 py-2 text-sm font-semibold">Mother</th>
                  <th class="px-3 py-2 text-sm font-semibold">Agent</th>
                  <th class="px-3 py-2 text-sm font-semibold">Group</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>

          <!-- Pagination Controls -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding: 10px; background: #f9fafb; border-radius: 8px;">
            <button 
              id="prev-page-btn" 
              style="padding: 8px 16px; background: ${page === 1 ? '#e5e7eb' : '#2563eb'}; color: ${page === 1 ? '#9ca3af' : 'white'}; border: none; border-radius: 6px; cursor: ${page === 1 ? 'not-allowed' : 'pointer'}; font-weight: 500;"
              ${page === 1 ? 'disabled' : ''}
            >
              ◀ Previous
            </button>
            
            <span style="font-weight: 600; color: #374151;">
              Page ${page} of ${totalModalPages} 
              <span style="color: #6b7280; font-weight: 400;">(Showing ${startIdx + 1}-${Math.min(endIdx, accountsToDelete.length)} of ${accountsToDelete.length})</span>
            </span>
            
            <button 
              id="next-page-btn" 
              style="padding: 8px 16px; background: ${page === totalModalPages ? '#e5e7eb' : '#2563eb'}; color: ${page === totalModalPages ? '#9ca3af' : 'white'}; border: none; border-radius: 6px; cursor: ${page === totalModalPages ? 'not-allowed' : 'pointer'}; font-weight: 500;"
              ${page === totalModalPages ? 'disabled' : ''}
            >
              Next ▶
            </button>
          </div>

          <p class="mt-4 text-center text-red-600 font-semibold">Do you want to delete these accounts?</p>
        </div>
      `;
      };

      const deleteConfirm = await Swal.fire({
        icon: 'warning',
        title: '⚠️ Accounts Not in BP_Accounts',
        html: showPaginatedTable(currentModalPage),
        width: '950px',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete All',
        cancelButtonText: 'No, Cancel',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        customClass: { htmlContainer: 'swal-wide-content' },
        didOpen: () => {
          // Handle pagination button clicks
          const prevBtn = document.getElementById('prev-page-btn');
          const nextBtn = document.getElementById('next-page-btn');

          if (prevBtn) {
            prevBtn.onclick = () => {
              if (currentModalPage > 1) {
                currentModalPage--;
                Swal.update({ html: showPaginatedTable(currentModalPage) });
                // Re-attach event listeners after update
                setTimeout(() => {
                  const newPrevBtn = document.getElementById('prev-page-btn');
                  const newNextBtn = document.getElementById('next-page-btn');
                  if (newPrevBtn) newPrevBtn.onclick = prevBtn.onclick;
                  if (newNextBtn) newNextBtn.onclick = nextBtn.onclick;
                }, 0);
              }
            };
          }

          if (nextBtn) {
            nextBtn.onclick = () => {
              if (currentModalPage < totalModalPages) {
                currentModalPage++;
                Swal.update({ html: showPaginatedTable(currentModalPage) });
                // Re-attach event listeners after update
                setTimeout(() => {
                  const newPrevBtn = document.getElementById('prev-page-btn');
                  const newNextBtn = document.getElementById('next-page-btn');
                  if (newPrevBtn) newPrevBtn.onclick = prevBtn.onclick;
                  if (newNextBtn) newNextBtn.onclick = nextBtn.onclick;
                }, 0);
              }
            };
          }
        }
      });














      if (!deleteConfirm.isConfirmed) {
        console.log("\n❌ User cancelled deletion");
        Swal.fire('Cancelled', 'No accounts were deleted.', 'info');
        return;
      }

      // 9️⃣ Delete in batches
      console.log("\n🗑️ STEP 4: Starting deletion process...");

      Swal.fire({
        title: '🗑️ Deleting...',
        html: `Deleting ${accountsToDelete.length.toLocaleString()} accounts...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const idsToDelete = accountsToDelete.map(acc => acc.id);
      const deleteBatchSize = 100;
      let deletedCount = 0;

      for (let i = 0; i < idsToDelete.length; i += deleteBatchSize) {
        const batch = idsToDelete.slice(i, i + deleteBatchSize);

        console.log(`🗑️ Deleting batch ${Math.floor(i / deleteBatchSize) + 1}: ${batch.length} records`);

        const { error: deleteError } = await supabase
          .from('Accounts_List')
          .delete()
          .in('id', batch);

        if (deleteError) {
          console.error(`❌ Batch delete failed:`, deleteError);
          throw deleteError;
        }

        deletedCount += batch.length;
        console.log(`✅ Deleted ${deletedCount}/${idsToDelete.length} records so far`);

        Swal.update({ html: `Deleted ${deletedCount.toLocaleString()} of ${idsToDelete.length.toLocaleString()} accounts...` });
      }

      console.log(`\n✅ DELETION COMPLETE: ${deletedCount.toLocaleString()} records deleted`);
      console.log("🚀 ========== BP TAGGING CHECK FINISHED ==========\n");

      // ✅ Final success
      await Swal.fire({
        icon: 'success',
        title: '✅ Cleanup Complete!',
        html: `<p class="text-center text-green-600 font-bold">Successfully deleted ${deletedCount.toLocaleString()} accounts not in BP_Accounts.</p>`,
        confirmButtonText: 'OK'
      });

      // Refresh data
      fetchAndCleanData(currentPage, searchTerm, searchField);

    } catch (err) {
      console.error('\n💥 ERROR in checkAndCleanBPTagging:', err);
      console.error('Error details:', err.message);
      console.error('Stack trace:', err.stack);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Failed to check BP tagging',
      });
    }
  };

  // 🔹 File ref
  const fileInputRef = useRef(null);
  // Fetch and clean data on mount
  useEffect(() => {
    fetchAndCleanData();
    fetchAgents(); // 🔹 Load agents on mount for mapping
    fetchMotherAccounts(); // 🔹 Load mother accounts
    fetchDistributors(); // 🔹 Load distributors
    fetchGroupMap();
  }, []);

  const fetchAllData = async (search = "", field = "all") => {
    try {
      setLoading(true);
      console.log("🚀 Fetching ALL records...");

      let query = supabase
        .from("Accounts_List")
        .select("*", { count: "exact" })
        .order("id", { ascending: true });

      // Apply account type filter
      // ✅ APPLY ACCOUNT TYPE FILTER FIRST (before search)
      if (accountTypeFilter === "mother_only") {
        console.log("📊 Applying Mother Only filter: mother_code exists");
        query = query.not('mother_code', 'is', null).not('mother_code', 'eq', '');
      } else if (accountTypeFilter === "bp_only") {
        console.log("📊 Applying BP Only filter: bp_code exists");
        query = query.not('bp_code', 'is', null).not('bp_code', 'eq', '');
      } else if (accountTypeFilter === "agent_only") {
        console.log("📊 Applying Agent Only filter: agent_code exists");
        query = query.not('agent_code', 'is', null).not('agent_code', 'eq', '');
      } else if (accountTypeFilter === "distributor_only") {
        console.log("📊 Applying Distributor Only filter: distributor_code exists");
        query = query.not('distributor_code', 'is', null).not('distributor_code', 'eq', '');
      } else if (accountTypeFilter === "group_only") {
        console.log("📊 Applying Group Only filter: group_code exists");
        query = query.not('group_code', 'is', null).not('group_code', 'eq', '');
      } else {
        console.log("📊 No account type filter applied (showing all)");
      }

      // Apply search filters (same as paginated version)
      if (search.trim()) {
        const searchTerm = search.trim().toLowerCase();

        if (field === 'all') {
          const [distData, motherData, agentData, groupData] = await Promise.all([
            supabase.from('distributors').select('code, name'),
            supabase.from('sub_mother_account').select('dscode, name'),
            supabase.from('Account_Users').select('UserID, name'),
            supabase.from('mother_account').select('code, name')
          ]);

          const distCodes = new Set();
          distData.data?.forEach(d => {
            if (d.name && d.name.toLowerCase().includes(searchTerm)) {
              distCodes.add(d.code);
            }
          });

          const motherCodes = new Set();
          motherData.data?.forEach(m => {
            if (m.name && m.name.toLowerCase().includes(searchTerm)) {
              motherCodes.add(m.dscode);
            }
          });

          const agentCodes = new Set();
          agentData.data?.forEach(a => {
            if (a.name && a.name.toLowerCase().includes(searchTerm)) {
              agentCodes.add(a.UserID);
            }
          });

          const groupCodes = new Set();
          groupData.data?.forEach(g => {
            if (g.name && g.name.toLowerCase().includes(searchTerm)) {
              groupCodes.add(g.code);
            }
          });

          const conditions = [
            `distributor_code.ilike.%${search}%`,
            `mother_code.ilike.%${search}%`,
            `bp_code.ilike.%${search}%`,
            `bp_name.ilike.%${search}%`,
            `group_code.ilike.%${search}%`
          ];

          if (distCodes.size > 0) {
            conditions.push(`distributor_code.in.(${Array.from(distCodes).join(',')})`);
          }
          if (motherCodes.size > 0) {
            conditions.push(`mother_code.in.(${Array.from(motherCodes).join(',')})`);
          }
          if (agentCodes.size > 0) {
            conditions.push(`agent_code.in.(${Array.from(agentCodes).join(',')})`);
          }
          if (groupCodes.size > 0) {
            conditions.push(`group_code.in.(${Array.from(groupCodes).join(',')})`);
          }

          if (!isNaN(search)) {
            conditions.push(`agent_code.eq.${search}`);
          }

          query = query.or(conditions.join(','));
        } else if (field === 'distributor') {
          const { data: distData } = await supabase.from('distributors').select('code, name');
          const distCodes = new Set();
          distData?.forEach(d => {
            if ((d.code && d.code.toLowerCase().includes(searchTerm)) ||
              (d.name && d.name.toLowerCase().includes(searchTerm))) {
              distCodes.add(d.code);
            }
          });
          if (distCodes.size > 0) {
            query = query.in('distributor_code', Array.from(distCodes));
          } else {
            query = query.ilike('distributor_code', `%${search}%`);
          }
        } else if (field === 'mother') {
          const { data: motherData } = await supabase.from('sub_mother_account').select('dscode, name');
          const motherCodes = new Set();
          motherData?.forEach(m => {
            if ((m.dscode && m.dscode.toLowerCase().includes(searchTerm)) ||
              (m.name && m.name.toLowerCase().includes(searchTerm))) {
              motherCodes.add(m.dscode);
            }
          });
          if (motherCodes.size > 0) {
            query = query.in('mother_code', Array.from(motherCodes));
          } else {
            query = query.ilike('mother_code', `%${search}%`);
          }
        } else if (field === 'bp_code') {
          query = query.ilike('bp_code', `%${search}%`);
        } else if (field === 'bp_name') {
          query = query.ilike('bp_name', `%${search}%`);
        } else if (field === 'agent') {
          const { data: agentData } = await supabase.from('Account_Users').select('UserID, name');
          const agentCodes = new Set();
          agentData?.forEach(a => {
            if ((a.UserID && String(a.UserID).includes(search)) ||
              (a.name && a.name.toLowerCase().includes(searchTerm))) {
              agentCodes.add(a.UserID);
            }
          });
          if (agentCodes.size > 0) {
            query = query.in('agent_code', Array.from(agentCodes));
          } else if (!isNaN(search)) {
            query = query.eq('agent_code', parseInt(search));
          }
        } else if (field === 'group') {
          const { data: groupData } = await supabase.from('mother_account').select('code, name');
          const groupCodes = new Set();
          groupData?.forEach(g => {
            if ((g.code && g.code.toLowerCase().includes(searchTerm)) ||
              (g.name && g.name.toLowerCase().includes(searchTerm))) {
              groupCodes.add(g.code);
            }
          });
          if (groupCodes.size > 0) {
            query = query.in('group_code', Array.from(groupCodes));
          } else {
            query = query.ilike('group_code', `%${search}%`);
          }
        }
      }

      // Fetch ALL records in batches
      const BATCH_SIZE = 1000;
      let allRecords = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await query.range(offset, offset + BATCH_SIZE - 1);

        if (error) throw error;

        if (batch && batch.length > 0) {
          allRecords = [...allRecords, ...batch];
          offset += BATCH_SIZE;
          hasMore = batch.length === BATCH_SIZE;

          console.log(`📦 Loaded ${allRecords.length.toLocaleString()} records so far...`);
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Finished loading ${allRecords.length.toLocaleString()} total records`);

      const uniqueData = await autoRemoveDuplicatesOnLoad(allRecords);
      setData(uniqueData);
      setTotalCount(uniqueData.length);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching all data:", err);
      Swal.fire("Error", err.message, "error");
      setLoading(false);
    }
  };
  const fetchAndCleanData = async (page = 1, search = "", field = "all") => {
    // ✅ Prevent multiple simultaneous fetches
    if (isFetching) {
      console.log("⚠️ Already fetching, skipping...");
      return;
    }

    try {
      setIsFetching(true);
      setLoading(true);
      const batchSize = itemsPerPage;
      const offset = (page - 1) * batchSize;

      let query = supabase
        .from("Accounts_List")
        .select("*", { count: "exact" })
        .order("id", { ascending: true });

      // ✅ DEBUGGING: Log the filter
      console.log("🔍 Current Filter State:", {
        accountTypeFilter,
        searchField: field,
        searchTerm: search,
        page
      });

      // ✅ APPLY ACCOUNT TYPE FILTER FIRST (before search)
      if (accountTypeFilter === "mother_only") {
        console.log("📊 Applying Mother Only filter: mother_code exists");
        query = query.not('mother_code', 'is', null).not('mother_code', 'eq', '');
      } else if (accountTypeFilter === "bp_only") {
        console.log("📊 Applying BP Only filter: bp_code exists");
        query = query.not('bp_code', 'is', null).not('bp_code', 'eq', '');
      } else {
        console.log("📊 No account type filter applied (showing all)");
      }

      // ✅ THEN APPLY SEARCH FILTERS
      if (search.trim()) {
        const searchTerm = search.trim().toLowerCase();

        if (field === 'all') {
          const [distData, motherData, agentData, groupData] = await Promise.all([
            supabase.from('distributors').select('code, name'),
            supabase.from('sub_mother_account').select('dscode, name'),
            supabase.from('Account_Users').select('UserID, name'),
            supabase.from('mother_account').select('code, name')
          ]);

          const distCodes = new Set();
          distData.data?.forEach(d => {
            if (d.name && d.name.toLowerCase().includes(searchTerm)) {
              distCodes.add(d.code);
            }
          });

          const motherCodes = new Set();
          motherData.data?.forEach(m => {
            if (m.name && m.name.toLowerCase().includes(searchTerm)) {
              motherCodes.add(m.dscode);
            }
          });

          const agentCodes = new Set();
          agentData.data?.forEach(a => {
            if (a.name && a.name.toLowerCase().includes(searchTerm)) {
              agentCodes.add(a.UserID);
            }
          });

          const groupCodes = new Set();
          groupData.data?.forEach(g => {
            if (g.name && g.name.toLowerCase().includes(searchTerm)) {
              groupCodes.add(g.code);
            }
          });

          const conditions = [
            `distributor_code.ilike.%${search}%`,
            `mother_code.ilike.%${search}%`,
            `bp_code.ilike.%${search}%`,
            `bp_name.ilike.%${search}%`,
            `group_code.ilike.%${search}%`
          ];

          if (distCodes.size > 0) {
            conditions.push(`distributor_code.in.(${Array.from(distCodes).join(',')})`);
          }
          if (motherCodes.size > 0) {
            conditions.push(`mother_code.in.(${Array.from(motherCodes).join(',')})`);
          }
          if (agentCodes.size > 0) {
            conditions.push(`agent_code.in.(${Array.from(agentCodes).join(',')})`);
          }
          if (groupCodes.size > 0) {
            conditions.push(`group_code.in.(${Array.from(groupCodes).join(',')})`);
          }

          if (!isNaN(search)) {
            conditions.push(`agent_code.eq.${search}`);
          }

          query = query.or(conditions.join(','));
        } else if (field === 'distributor') {
          const { data: distData } = await supabase
            .from('distributors')
            .select('code, name');

          const distCodes = new Set();
          distData?.forEach(d => {
            if ((d.code && d.code.toLowerCase().includes(searchTerm)) ||
              (d.name && d.name.toLowerCase().includes(searchTerm))) {
              distCodes.add(d.code);
            }
          });

          if (distCodes.size > 0) {
            query = query.in('distributor_code', Array.from(distCodes));
          } else {
            query = query.ilike('distributor_code', `%${search}%`);
          }
        } else if (field === 'mother') {
          const { data: motherData } = await supabase
            .from('sub_mother_account')
            .select('dscode, name');

          const motherCodes = new Set();
          motherData?.forEach(m => {
            if ((m.dscode && m.dscode.toLowerCase().includes(searchTerm)) ||
              (m.name && m.name.toLowerCase().includes(searchTerm))) {
              motherCodes.add(m.dscode);
            }
          });

          if (motherCodes.size > 0) {
            query = query.in('mother_code', Array.from(motherCodes));
          } else {
            query = query.ilike('mother_code', `%${search}%`);
          }
        } else if (field === 'bp_code') {
          query = query.ilike('bp_code', `%${search}%`);
        } else if (field === 'bp_name') {
          query = query.ilike('bp_name', `%${search}%`);
        } else if (field === 'agent') {
          const { data: agentData } = await supabase
            .from('Account_Users')
            .select('UserID, name');

          const agentCodes = new Set();
          agentData?.forEach(a => {
            if ((a.UserID && String(a.UserID).includes(search)) ||
              (a.name && a.name.toLowerCase().includes(searchTerm))) {
              agentCodes.add(a.UserID);
            }
          });

          if (agentCodes.size > 0) {
            query = query.in('agent_code', Array.from(agentCodes));
          } else if (!isNaN(search)) {
            query = query.eq('agent_code', parseInt(search));
          }
        } else if (field === 'group') {
          const { data: groupData } = await supabase
            .from('mother_account')
            .select('code, name');

          const groupCodes = new Set();
          groupData?.forEach(g => {
            if ((g.code && g.code.toLowerCase().includes(searchTerm)) ||
              (g.name && g.name.toLowerCase().includes(searchTerm))) {
              groupCodes.add(g.code);
            }
          });

          if (groupCodes.size > 0) {
            query = query.in('group_code', Array.from(groupCodes));
          } else {
            query = query.ilike('group_code', `%${search}%`);
          }
        }
      }

      // ✅ APPLY PAGINATION LAST (after all filters)
      query = query.range(offset, offset + batchSize - 1);

      const { data: pageData, error, count } = await query;

      if (error) throw error;

      // ✅ DEBUGGING: Log results
      console.log("📊 FINAL RESULTS:");
      console.log("   Total Count:", count);
      console.log("   Records on this page:", pageData?.length);

      // Clean duplicates
      const uniqueData = await autoRemoveDuplicatesOnLoad(pageData);

      setData(uniqueData);
      setTotalCount(count || 0);
      setLoading(false);
      setIsFetching(false);
    } catch (err) {
      console.error("Error:", err);
      Swal.fire("Error", err.message, "error");
      setLoading(false);
      setIsFetching(false);
    }
  };

  // ✅ STEP 2: UPDATE useEffect for search - reset to page 1
  useEffect(() => {
    const delay = setTimeout(() => {
      setCurrentPage(1); // Reset to page 1 when any filter/search changes
      fetchAndCleanData(1, searchTerm, searchField);
    }, 400);

    return () => clearTimeout(delay);
  }, [searchTerm, searchField, accountTypeFilter]);



  // 🔍 Filter logic


  // 🧮 Pagination (based on filtered data)
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;



  const handleNextPage = async () => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      await fetchAndCleanData(nextPage, searchTerm, searchField);
    }
  };

  // ✅ STEP 6: UPDATE handlePrevPage (ADD THIS if you don't have it)
  const handlePrevPage = async () => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      await fetchAndCleanData(prevPage, searchTerm);
    }
  };

  // ✅ STEP 7: UPDATE handleFirstPage
  const handleFirstPage = async () => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      await fetchAndCleanData(1, searchTerm); // ✅ ADD: Fetch data
    }
  };

  // ✅ STEP 8: ADD handleLastPage
  const handleLastPage = async () => {
    if (currentPage !== totalPages) {
      setCurrentPage(totalPages);
      await fetchAndCleanData(totalPages, searchTerm);
    }
  };

  // ✅ Duplicate cleaner function (keeps first entry, deletes the rest)
  const autoRemoveDuplicatesOnLoad = async (data) => {
    if (!Array.isArray(data) || data.length === 0) return [];

    const seen = {};
    const toDelete = [];
    const uniqueRecords = [];

    for (const record of data) {
      const key = `${record.mother_code || ""}|${record.bp_code || ""}`;

      if (!record.mother_code && !record.bp_code) {
        uniqueRecords.push(record);
        continue;
      }

      if (seen[key]) {
        if (record.id) toDelete.push(record.id);
      } else {
        seen[key] = true;
        uniqueRecords.push(record);
      }
    }

    if (toDelete.length > 0) {
      console.log(`🧹 Found ${toDelete.length} duplicates — cleaning up...`);
      try {
        const chunkSize = 500;
        let totalDeleted = 0;

        for (let i = 0; i < toDelete.length; i += chunkSize) {
          const chunk = toDelete.slice(i, i + chunkSize);

          const { error: deleteError } = await supabase
            .from("Accounts_List")
            .delete()
            .in("id", chunk);

          if (deleteError) {
            console.warn(`⚠️ Batch delete failed, retrying individually`, deleteError);
            for (const id of chunk) {
              const { error } = await supabase
                .from("Accounts_List")
                .delete()
                .eq("id", id);
              if (!error) totalDeleted++;
            }
          } else {
            totalDeleted += chunk.length;
          }
        }

        Swal.fire({
          icon: "success",
          title: "Duplicate Cleanup",
          text: `Deleted ${totalDeleted}/${toDelete.length} duplicates.`,
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (err) {
        console.error("❌ Error during duplicate cleanup:", err);
        Swal.fire("Error", "Unexpected error while deleting duplicates.", "error");
      }
    } else {
      console.log("✅ No duplicates found.");
    }

    return uniqueRecords;
  };

  // Filtered data
  // 🔍 Filter logic: only bp_name and mother_code


  // Pagination

  // Fetch dropdowns
  const fetchDistributors = async () => {
    const { data, error } = await supabase
      .from("distributors")
      .select("code, name, agent_code")
      .order("name", { ascending: true });
    if (error) console.error(error);
    else {
      setDistributors(data);
      // 🔹 Create a map for quick lookup: code -> name
      const map = {};
      data.forEach(dist => {
        map[dist.code] = dist.name;
      });
      setDistributorMap(map);
    }
  };
  const fetchMotherAccounts = async () => {
    const batchSize = 1000;
    let allData = [];
    let hasMore = true;
    let offset = 0;

    console.log("🚀 Starting full sub_mother_account data fetch...");

    try {
      while (hasMore) {
        console.log(
          `📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`
        );

        const { data, error } = await supabase
          .from("sub_mother_account")
          .select("dscode, name, group_code, group_name")
          .eq("status", true)
          .order("name", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error("❌ Error during batch fetch:", error);
          throw error;
        }

        console.log(
          `✅ Fetched batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
        );

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
          console.log(`📊 Total records so far: ${allData.length}`);
        } else {
          hasMore = false;
          console.log("🏁 Finished fetching all sub_mother_account data");
        }
      }

      if (allData.length === 0) {
        console.warn("⚠️ No active mother accounts found");
        setMotherAccounts([]);
        return;
      }

      // ✅ Set all fetched data into state
      setMotherAccounts(allData);

      // 🔹 Create a map for quick lookup: dscode -> name
      const map = {};
      allData.forEach(mother => {
        map[mother.dscode] = mother.name;
      });
      setMotherMap(map);

      console.log(`🎉 Successfully loaded ${allData.length} mother accounts`);
    } catch (err) {
      console.error("🔥 Error fetching sub_mother_account:", err);
    }
  };
  const [syncingSubMother, setSyncingSubMother] = useState(false);
  const [syncStats, setSyncStats] = useState(null); // { total, added, skipped, groupsMissing }

  const generateDscode = async () => {
    // Get the latest dscode to determine next number
    const { data: latest } = await supabase
      .from('sub_mother_account')
      .select('dscode')
      .order('id', { ascending: false })
      .limit(1);

    const lastCode = latest?.[0]?.dscode || 'DS000000';
    const numPart = parseInt(lastCode.replace(/\D/g, '')) || 0;
    const nextNum = numPart + 1;
    return `DS${String(nextNum).padStart(6, '0')}`;
  };


  // 🔹 Sync Accounts_List mother_codes → sub_mother_account
  const syncToSubMotherAccount = async (importedData = null) => {
    try {
      setSyncingSubMother(true);

      // ✅ Step 1: Load source data
      let sourceData = importedData;
      if (!sourceData) {
        Swal.fire({
          title: '🔄 Loading Accounts_List...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        const BATCH = 1000;
        let all = [], offset = 0, hasMore = true;
        while (hasMore) {
          const { data: batch, error } = await supabase
            .from('Accounts_List')
            .select('mother_code, bp_name, group_code')
            .range(offset, offset + BATCH - 1);
          if (error) throw error;
          if (batch?.length > 0) {
            all = [...all, ...batch];
            offset += BATCH;
            hasMore = batch.length === BATCH;
          } else hasMore = false;
        }
        sourceData = all;
        Swal.close();
      }

      // ✅ Step 2: Fetch mother_account for group lookup
      // mother_account: code (int) = 6001/6002/6003/6004, name = "DIRECT MEGASOFT" etc.
      const { data: groupRows, error: groupErr } = await supabase
        .from('mother_account')
        .select('code, name')
        .eq('status', true);

      if (groupErr) throw groupErr;

      // Map: "6001" -> "DIRECT MEGASOFT", "6002" -> "DIRECT DISTRIBUTOR", etc.
      const groupCodeToName = {};
      groupRows?.forEach(g => {
        groupCodeToName[String(g.code)] = g.name;
      });

      console.log('📋 Group map:', groupCodeToName);

      // ✅ Step 3: Fetch ALL existing sub_mother_account records
      // We need both dscode AND name to check for duplicates
      const { data: existingSubs } = await supabase
        .from('sub_mother_account')
        .select('dscode, name');

      // Set of existing dscodes (e.g. DS100000, DS100001...)
      const existingDscodes = new Set(existingSubs?.map(s => s.dscode) || []);

      // Set of existing names (lowercase) to avoid name duplicates
      const existingNames = new Set(
        existingSubs?.map(s => s.name?.toString().trim().toLowerCase()) || []
      );

      // Get the highest DS number to continue sequence
      let maxDsNum = 0;
      existingSubs?.forEach(s => {
        const match = s.dscode?.match(/^DS(\d+)$/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxDsNum) maxDsNum = num;
        }
      });

      console.log(`✅ Existing sub_mother_account: ${existingDscodes.size} records`);
      console.log(`✅ Max DS number found: DS${maxDsNum}`);

      // ✅ Step 4: Collect unique mother names from Accounts_List
      // Group by mother_code — get unique mother names
      // Key = bp_name (the mother account name), value = { group_code }
      const uniqueMotherNames = new Map(); // bp_name -> { group_code }

      sourceData.forEach(row => {
        const motherName = row.bp_name?.toString().trim();
        const groupCode = row.group_code?.toString().trim() || null;

        if (!motherName || motherName === '') return;

        // Use name as key (to group same names together)
        if (!uniqueMotherNames.has(motherName)) {
          uniqueMotherNames.set(motherName, { group_code: groupCode });
        }
      });

      console.log(`📊 Unique mother names found: ${uniqueMotherNames.size}`);

      // ✅ Step 5: Build insert list
      const toInsert = [];
      const skipped = [];
      const groupsMissing = [];
      let dsCounter = maxDsNum; // Continue from last DS number

      for (const [motherName, info] of uniqueMotherNames.entries()) {
        const normalizedName = motherName.toLowerCase();

        // Skip if name already exists in sub_mother_account
        if (existingNames.has(normalizedName)) {
          skipped.push(motherName);
          continue;
        }

        // Resolve group info
        const rawGroupCode = info.group_code; // e.g. "6001", "6002"
        const resolvedGroupName = rawGroupCode
          ? (groupCodeToName[rawGroupCode] || null)
          : null;

        if (rawGroupCode && !groupCodeToName[rawGroupCode]) {
          groupsMissing.push({ motherName, groupCode: rawGroupCode });
          console.warn(`⚠️ No group found for code: ${rawGroupCode}`);
        }

        // ✅ Generate next DS code
        dsCounter++;
        const newDscode = `DS${String(dsCounter).padStart(6, '0')}`;

        toInsert.push({
          dscode: newDscode,              // ✅ Auto-generated: DS100449, DS100450...
          name: motherName,              // ✅ The actual mother account name
          status: true,
          group_code: rawGroupCode || null,      // ✅ "6001", "6002", "6003", "6004"
          group_name: resolvedGroupName || null, // ✅ "DIRECT MEGASOFT", "DIRECT DISTRIBUTOR"
        });
      }

      console.log(`✅ To insert: ${toInsert.length}, Skipped: ${skipped.length}`);
      if (groupsMissing.length > 0) {
        console.warn('⚠️ Missing group mappings:', groupsMissing);
      }

      // ✅ Step 6: Insert in batches
      let insertedCount = 0;
      const INSERT_BATCH = 500;

      if (toInsert.length > 0) {
        Swal.fire({
          title: '📥 Syncing to sub_mother_account...',
          html: `<span id="sync-progress">0 / ${toInsert.length}</span>`,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
          const chunk = toInsert.slice(i, i + INSERT_BATCH);

          const { error } = await supabase
            .from('sub_mother_account')
            .insert(chunk);

          if (error) {
            console.error('❌ Insert error:', error.message);
            // Try upsert as fallback
            await supabase
              .from('sub_mother_account')
              .upsert(chunk, { onConflict: 'dscode', ignoreDuplicates: true });
          }

          insertedCount += chunk.length;

          const el = document.getElementById('sync-progress');
          if (el) el.textContent = `${insertedCount} / ${toInsert.length}`;

          await new Promise(r => setTimeout(r, 50));
        }
      }

      Swal.close();

      const stats = {
        total: uniqueMotherNames.size,
        added: insertedCount,
        skipped: skipped.length,
        groupsMissing: groupsMissing.length,
      };

      setSyncStats(stats);
      console.log('✅ Sync complete:', stats);

      return stats;

    } catch (err) {
      console.error('💥 Sync error:', err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
      return null;
    } finally {
      setSyncingSubMother(false);
    }
  };
  // ✅ Fetch first 1,000 records for initial modal load
  // ✅ Fetch BP Accounts with pagination - Shows first page fast, loads more on demand
  const fetchBpAccounts = async (page = 1, searchTerm = '') => {
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    console.log(`🚀 Fetching BP Accounts - Page ${page}, Search: "${searchTerm}"`);

    try {
      let query = supabase
        .from("Bp_Accounts")
        .select("bp_code, bp_name", { count: "exact" })
        .order("bp_name", { ascending: true })
        .range(offset, offset + pageSize - 1);

      // Apply search filter if exists
      if (searchTerm.trim()) {
        query = query.or(`bp_code.ilike.%${searchTerm}%,bp_name.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("❌ Error fetching BP Accounts:", error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} records (Total: ${count})`);

      return { data: data || [], count: count || 0 };
    } catch (err) {
      console.error("🔥 Error fetching Bp_Accounts:", err);
      return { data: [], count: 0 };
    }
  };

  // ✅ Fetch ALL records only during search




  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from("Account_Users")
      .select("UserID, name")
      .order("name", { ascending: true });
    if (error) console.error(error);
    else {
      setAgents(data);
      // 🔹 Create a map for quick lookup: UserID -> name
      const map = {};
      data.forEach(agent => {
        map[agent.UserID] = agent.name;
      });
      setAgentMap(map);
    }
  };
  const fetchGroupMap = async () => {
    const { data, error } = await supabase
      .from("mother_account")
      .select("code, name")
      .eq("status", true);

    if (error) {
      console.error(error);
    } else {
      const map = {};
      data.forEach(group => {
        map[group.code] = group.name;
      });
      setGroupMap(map);
    }
  };

  useEffect(() => {
    if (showDistributorModal) fetchDistributors();
    if (showMotherModal) fetchMotherAccounts();
    if (showBpModal) {
      // ✅ BP modal will load first page instantly in the modal itself
      setBpAccounts([]); // Clear old data, modal handles fetching
    }
    if (showAgentModal) fetchAgents();
  }, [showDistributorModal, showMotherModal, showBpModal, showAgentModal]);

  // Handle selections
  const handleSelectDistributor = (selected) => {
    setNewRecord(prev => ({
      ...prev,
      distributor_code: selected.code,

    }));
    setShowDistributorModal(false);
  };

  const handleSelectMother = (selected) => {
    setNewRecord(prev => ({
      ...prev,
      mother_code: selected.dscode,
      group_code: selected.group_code,

    }));
    setShowMotherModal(false);
  };

  const handleSelectBp = (selected) => {
    setNewRecord(prev => ({
      ...prev,
      bp_code: selected.bp_code,
      bp_name: selected.bp_name

    }));
    setShowBpModal(false);
  };

  const handleSelectAgent = (selected) => {
    setNewRecord(prev => ({
      ...prev,
      agent_code: selected.UserID
    }));
    setShowAgentModal(false);
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewRecord(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage('');

    try {
      if (isEditing) {
        const { id, ...updateData } = newRecord;
        const { error } = await supabase
          .from('Accounts_List')
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          setErrorMessage(error.message);
        } else {
          setData((prev) =>
            prev.map((row) => (row.id === id ? { ...row, ...updateData } : row))
          );
          setShowModal(false);
          setIsEditing(false);
          Swal.fire('Success', 'Record updated', 'success');
        }
      } else {
        const { error } = await supabase
          .from('Accounts_List')
          .insert([
            {
              ...newRecord,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select();

        if (error) {
          setErrorMessage(error.message);
        } else {
          await fetchAndCleanData();
          setShowModal(false);
          setNewRecord({
            distributor_code: '',
            mother_code: '',
            bp_code: '',
            bp_name: '',
            group_code: '',
            status: true,
          });
          Swal.fire('Success', 'Record created', 'success');
        }
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };


  const handleEdit = (row) => {
    setNewRecord(row);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete?',
      text: "This can't be undone",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete'
    });

    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase
        .from('Accounts_List')
        .delete()
        .eq('id', id);

      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        setData(prev => prev.filter(row => row.id !== id));
        Swal.fire('Deleted', 'Record removed', 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  const [countdown, setCountdown] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [processedRows, setProcessedRows] = useState(0);


  // file: MasterdataBranch.jsx
  const readExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        resolve(jsonData);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };


  const [showExcelModal, setShowExcelModal] = useState(false);




  const [accountsData, setAccountsData] = useState([]); // full table data



  // State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState({ fetched: 0, total: 0, type: "" });

  // Updated handleExport
  const handleExport = async (type) => {
    try {
      setShowExportModal(true);
      setExportProgress({ fetched: 0, total: 0, type });

      const headers = [
        'distributor_code',
        'mother_code',
        'bp_code',
        'bp_name',
        'group_code',
        'status'
      ];

      let exportData = [];

      if (type === "template") {
        exportData = [Object.fromEntries(headers.map((k) => [k, ""]))];
        setExportProgress({ fetched: 1, total: 1, type });
      } else if (type === "all") {
        const batchSize = 1000;
        let allData = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("Accounts_List")
            .select("*")
            .order("id", { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
            setExportProgress({ fetched: allData.length, total: allData.length + (hasMore ? batchSize : 0), type });
          } else {
            hasMore = false;
            setExportProgress({ fetched: allData.length, total: allData.length, type });
          }
        }

        if (allData.length === 0) {
          Swal.fire("Error", "No data to export", "error");
          setShowExportModal(false);
          return;
        }

        // 🔹 Fetch all lookup tables for name conversion
        const { data: groupData } = await supabase
          .from("mother_account")
          .select("code, name");

        const groupMap = {};
        groupData?.forEach(g => {
          groupMap[g.code] = g.name;
        });

        // Convert codes to names
        exportData = allData.map((row) => ({
          distributor_name: distributorMap[row.distributor_code] || row.distributor_code || "",
          mother_name: motherMap[row.mother_code] || row.mother_code || "",
          bp_code: row.bp_code || "",
          bp_name: row.bp_name || "",
          group_name: groupMap[row.group_code] || row.group_code || "",
          status: row.status ? "Active" : "Inactive",
        }));
      }

      // Small delay to display progress modal nicely
      await new Promise((res) => setTimeout(res, 500));

      // Generate Excel
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "AccountsList");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `accounts_list_${type}.xlsx`);

      setShowExportModal(false);
    } catch (err) {
      console.error("Export Error:", err);
      Swal.fire("Error", err.message, "error");
      setShowExportModal(false);
    } finally {
      setShowExportMenu(false);
    }
  };


  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) setShowImportMenu(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const [showTaggingModal, setShowTaggingModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const handleOptionClick = (type) => {
    setSelectedExportType(type);
    setShowMultipleModal(true);  // This opens your modal
  };

  const [taggingData, setTaggingData] = useState({
    bp_code: '',
    agent_code: '',
    distributor_code: '',
    mother_code: '',
    group_code: '',
    from_date: '',
    to_date: '',
  });
  const handleTaggingExport = (e) => {
    e.preventDefault();
    console.log('Exporting for tagging:', newRecord);
    // call your export logic here (like handleExport('tagging'))
    handleExport('tagging');
    setShowTaggingModal(false);
  };
  // Handles input changes in your modal
  const handleTaggingChange = (e) => {
    const { name, value } = e.target;
    setNewRecord(prev => ({ ...prev, [name]: value }));
  };

  // Generates Excel tagging template
  const handleGenerateTaggingTemplate = () => {
    const distributorBase = parseInt(newRecord.distributor_code) || 5001;
    let count = Number(newRecord.range_count) || 1;
    count = Math.max(1, Math.min(count, 99999999)); // clamp

    const rows = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        distributor_code: distributorBase,
        mother_code: newRecord.mother_code || '',
        bp_code: newRecord.bp_code || '',
        agent_code: newRecord.agent_code || '',
        group_code: newRecord.group_code || '',
      });
    }

    // Export to Excel
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TaggingTemplate');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'tagging_template.xlsx');

    // ✅ Reset all modal fields
    setNewRecord({
      distributor_code: '',
      distributor_name: '',
      mother_code: '',
      mother_acct: '',
      bp_code: '',
      bp_name: '',
      agent_code: '',
      agent_name: '',
      group_code: '',
      group_name: '',
      range_count: ''
    });

    alert(`Tagging template generated successfully! (${count} codes)`);
    setShowTaggingModal(false);
  };

  const [hoveredButton, setHoveredButton] = useState(null);

  // Updated styles with hover effect
  const buttonHoverStyle = {
    background: '#1d4ed8',
    color: 'white',
    transition: 'all 0.2s',
  };

  const menuItemHoverStyle = {
    background: '#e8f0fe',
    transition: 'background 0.2s',
  };

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupAccounts, setGroupAccounts] = useState([]);
  const fetchGroupAccounts = async () => {
    const { data, error } = await supabase
      .from('mother_account')
      .select('*')
      .eq('status', true);

    if (error) {
      console.error(error);
    } else {
      setGroupAccounts(data);
    }
  };

  useEffect(() => {
    if (showGroupModal) fetchGroupAccounts();
  }, [showGroupModal]);
  const handleSelectGroup = (selected) => {
    setNewRecord(prev => ({
      ...prev,
      group_code: selected.code
    }));
    setShowGroupModal(false);
  };


  const [showMultipleModal, setShowMultipleModal] = useState(false);
  const [selectedExportType, setSelectedExportType] = useState('');
  const [multipleRecord, setMultipleRecord] = useState({ range_count: '' });

  const handleGenerateMultipleTemplate = async (type) => {
    try {
      // ✅ check if form has data
      if (!newRecord || Object.keys(newRecord).length === 0) {
        Swal.fire('Error', 'No data to export', 'error');
        return;
      }

      const count = parseInt(newRecord.range_count || '0');
      if (isNaN(count) || count <= 0) {
        Swal.fire('Invalid Input', 'Please enter a valid range count', 'warning');
        return;
      }

      Swal.fire({
        title: `Generating ${type} Excel...`,
        text: 'Please wait a moment.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // ✅ Define the headers you want in the export
      const headers = [
        'distributor_code',
        'mother_code',
        'bp_code',
        'bp_name',
        'agent_code',
        'group_code',
        'status'
      ];

      // ✅ Create the export row from form (newRecord)
      const baseRow = {};
      headers.forEach(h => baseRow[h] = newRecord[h] ?? '');

      // ✅ Generate multiple rows (duplicate based on count)
      const exportData = Array.from({ length: count }, () => ({ ...baseRow }));

      if (exportData.length === 0) {
        Swal.fire('Error', 'No data to export', 'error');
        return;
      }

      // ✅ Create Excel file
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${type}_Export`);

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(blob, `${type}_Export.xlsx`);

      Swal.fire('Success', `${type} Excel generated successfully!`, 'success');
      setShowMultipleModal(false);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to generate Excel.', 'error');
    }
  };
  // PALITAN YUNG BUONG handleExportUpdates function:
  const handleExportUpdates = async () => {
    const updateRows = importData.filter(row => row._updateFlag === 'update');

    if (updateRows.length === 0) {
      Swal.fire('No Updates', 'Walang rows na marked as Update.', 'info');
      return;
    }

    const confirmRes = await Swal.fire({
      icon: 'warning',
      title: `🔄 Import ${updateRows.length.toLocaleString()} Updates?`,
      html: `
      <div style="text-align:left;font-family:monospace;font-size:14px;line-height:1.8;">
        <p>🟠 <b>Rows to update:</b> ${updateRows.length.toLocaleString()}</p>
        <p style="color:#6b7280;font-size:12px;">This will upsert these rows to Supabase using bp_code as conflict key.</p>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: '⚡ Import Updates',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#f59e0b',
    });

    if (!confirmRes.isConfirmed) return;

    Swal.fire({
      title: '🔄 Importing updates...',
      html: '<div id="upd-only-prog">Starting...</div>',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const toUpdate = updateRows.map(row => ({
        id: row._oldData?.id,
        distributor_code: row.distributor_code || null,
        mother_code: row.mother_code || null,
        bp_code: row.bp_code || null,
        bp_name: row.bp_name || null,
        group_code: row.group_code || null,
        status: row._oldData?.status ?? true,
      }));

      const chunks = chunkArray(toUpdate, BATCH_SIZE);
      let updatedCount = 0;
      const failedBatches = [];

      await parallelBatch(chunks, async (chunk) => {
        const { error } = await supabase
          .from('Accounts_List')
          .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });

        if (error) {
          console.error('Upsert error:', error.message);
          failedBatches.push({ count: chunk.length, error: error.message });
          return 0;
        }
        return chunk.length;
      }, CONCURRENCY, (done, total) => {
        const count = Math.min(done * BATCH_SIZE, toUpdate.length);
        const pct = Math.round(count / toUpdate.length * 100);
        const el = document.getElementById('upd-only-prog');
        if (el) el.innerHTML = `
        <b style="color:#f59e0b;font-size:18px;">${count.toLocaleString()} / ${toUpdate.length.toLocaleString()}</b>
        <div style="width:100%;height:10px;background:#eee;border-radius:5px;margin-top:8px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:#f59e0b;transition:width 0.2s;"></div>
        </div>
        <p style="color:#6b7280;margin-top:4px;font-size:12px;">${pct}%</p>
      `;
      }).then(results => {
        updatedCount = results.reduce((s, n) => s + (n || 0), 0);
      });

      Swal.close();

      await Swal.fire({
        icon: failedBatches.length > 0 ? 'warning' : 'success',
        title: '✅ Import Updates Complete!',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:2;">
          <p style="color:orange;">🔄 <b>Updated:</b> ${updatedCount.toLocaleString()}</p>
          ${failedBatches.length > 0
            ? `<p style="color:red;">❌ <b>Failed batches:</b> ${failedBatches.length}</p>`
            : ''}
        </div>
      `,
      });

      fetchAndCleanData();

    } catch (err) {
      console.error('Import updates error:', err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>📋 Accounts List Manager</h2>

      <div style={styles.buttonContainer}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={{
              ...styles.btn,
              ...(hoveredButton === 'export' ? buttonHoverStyle : {}),
            }}
            onMouseEnter={() => setHoveredButton('export')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            Export ▼
          </button>

          {showExportMenu && (
            <div ref={exportMenuRef} style={styles.menu}>
              {/* Template */}
              <div
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                onClick={() => {
                  handleExport('template');
                  setShowExportMenu(false);
                }}
              >
                📄 Export Template Only
              </div>

              {/* All Data */}
              <div
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f0fe")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                onClick={() => handleExport("all")}
              >
                📊 Export All Data
              </div>

              <div
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f0fe")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                onClick={() => {
                  setShowExportByDistModal(true);
                  setShowExportMenu(false);
                }}
              >
                📦 Export by Distributor
              </div>

              <div
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                onClick={() => {
                  setShowTaggingModal(true);
                  setShowExportMenu(false);
                }}
              >
                🏷️ Export for Tagging
              </div>
              <Modal show={showExportModal} centered>
                <Modal.Header>
                  <Modal.Title>📊 Exporting Data...</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  {exportProgress.type === "template" ? (
                    <p>Preparing template...</p>
                  ) : (
                    <>
                      <p>
                        Fetched {exportProgress.fetched} / {exportProgress.total} records
                      </p>
                      <div
                        style={{
                          width: "100%",
                          height: "10px",
                          background: "#eee",
                          borderRadius: "5px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min((exportProgress.fetched / exportProgress.total) * 100, 100)}%`,
                            height: "100%",
                            background: "#0d6efd",
                            transition: "width 0.2s",
                          }}
                        />
                      </div>
                    </>
                  )}
                </Modal.Body>
              </Modal>

              {/* Multiple (Agent / Distributor / Mother) */}
              <div
                style={{ ...styles.menuItem, position: 'relative' }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                🔁 Export Multiple ▸

                {showTooltip && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '100%',
                      background: '#fff',
                      border: '1px solid #ccc',
                      borderRadius: 6,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      zIndex: 10,
                      width: 160,
                    }}
                  >
                    {['Agent', 'Distributor', 'Mother'].map((label, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: idx < 2 ? '1px solid #eee' : 'none',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                        onClick={() => {
                          handleOptionClick(label); // ✅ triggers modal
                          setShowExportMenu(false);
                          setShowTooltip(false);
                        }}
                      >
                        {label}
                      </div>
                    ))}

                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Import Button */}
        {/* === Import Menu === */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowImportMenu(!showImportMenu)}
            style={{
              ...styles.btn,
              ...(hoveredButton === 'import' ? buttonHoverStyle : {}),
            }}
            onMouseEnter={() => setHoveredButton('import')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            Import ▼
          </button>

          {showImportMenu && (
            <div ref={importMenuRef} style={styles.menu}>
              <div
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                onClick={() => {
                  setShowImportMenu(false);
                  setShowExcelModal(true);
                }}
              >
                📥 Upload Excel File
              </div>
            </div>
          )}

          {/* === Import Excel Modal === */}
          {showExcelModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1050,
              }}
              onClick={() => {
                setShowExcelModal(false);
                setImportData([]);
                setExistingRows([]);
                setDuplicatesChecked(false);
                setFileName('');
                setProcessedRows(0);
                setProgressPercent(0);
              }}
            >
              <div
                style={{
                  width: "1500px",
                  maxHeight: "90vh",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  overflowY: "auto",
                  padding: "20px",
                  boxShadow: "0 0 20px rgba(0,0,0,0.3)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <h4>📥 Import from Excel</h4>
                  <button
                    onClick={() => {
                      setShowExcelModal(false);
                      setImportData([]);
                      setExistingRows([]);
                      setDuplicatesChecked(false);
                      setFileName('');
                      setProcessedRows(0);
                      setProgressPercent(0);
                    }}
                    style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>

                {/* File Input */}
                <div className="mb-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportMother}
                    className="form-control"
                  />
                  {fileName && <div className="mt-2 text-muted">Selected File: <b>{fileName}</b></div>}
                </div>

                {/* Check Duplicates Button */}
                {importData.length > 0 && (
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={checkExistingRecords}
                    disabled={checking}
                    style={{ marginBottom: "10px" }}
                  >
                    {checking ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                        Checking...
                      </>
                    ) : (
                      "🔍 Check for Duplicates"
                    )}
                  </Button>
                )}
                {checking && loadingProgress.total > 0 && (
                  <div style={{
                    marginBottom: "15px",
                    padding: "10px",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "6px",
                    border: "1px solid #dee2e6"
                  }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px"
                    }}>
                      <span style={{ fontWeight: 600, color: "#495057" }}>
                        Loading existing records...
                      </span>
                      <span style={{ fontWeight: 600, color: "#0d6efd" }}>
                        {loadingProgress.current.toLocaleString()} / {loadingProgress.total.toLocaleString()}
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '10px',
                      backgroundColor: '#e9ecef',
                      borderRadius: '5px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                        height: '100%',
                        backgroundColor: '#0d6efd',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{
                      marginTop: "6px",
                      fontSize: "12px",
                      color: "#6c757d",
                      textAlign: "center"
                    }}>
                      {Math.round((loadingProgress.current / loadingProgress.total) * 100)}% complete
                    </div>
                  </div>
                )}

                {/* Table */}
                {importData.length > 0 && (
                  <div className="table-responsive mt-2">
                    <table style={{ ...tableStyle, width: "100%", fontSize: "1.1rem" }}>
                      <thead style={{ backgroundColor: "#0d6efd", color: "white" }}>
                        <tr>
                          <th style={{ ...thStyle, minWidth: "120px" }}>Distributor Code</th>
                          <th style={{ ...thStyle, minWidth: "120px" }}>Mother Code</th>
                          <th style={{ ...thStyle, minWidth: "120px" }}>BP Code</th>
                          <th style={{ ...thStyle, minWidth: "150px" }}>BP Name</th>
                          <th style={{ ...thStyle, minWidth: "120px" }}>Group Code</th>
                          <th style={{ ...thStyle, minWidth: "100px" }}>Status</th>
                          <th style={{ ...thStyle, minWidth: "100px" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentRowsExcel.map((row, idx) => {
                          const updateFlag = row._updateFlag;
                          const oldData = row._oldData;

                          // Determine row background and status
                          let rowBg = "white";
                          let statusText = "New";
                          let statusIcon = "✅";

                          if (updateFlag === 'update') {
                            rowBg = "#fff3cd"; // Light orange/yellow
                            statusText = "Update";
                            statusIcon = "🟠";
                          } else if (updateFlag === 'duplicate') {
                            rowBg = "#ffcccc"; // Light red
                            statusText = "Duplicate";
                            statusIcon = "🔴";
                          } else if (updateFlag === 'null') {
                            rowBg = "#f8d7da"; // Light red
                            statusText = "Null BP";
                            statusIcon = "⚠️";
                          }

                          // Helper function to check if field changed
                          const hasChanged = (field) => {
                            if (updateFlag !== 'update' || !oldData) return false;
                            return oldData[field] !== row[field];
                          };

                          // Style for changed cells
                          const changedCellStyle = {
                            ...tdStyle,
                            backgroundColor: "#ffc107",
                            fontWeight: 600,
                            border: "2px solid #ff9800"
                          };

                          return (
                            <tr key={idx} style={{ backgroundColor: rowBg }}>
                              <td style={hasChanged('distributor_code') ? changedCellStyle : tdStyle}>
                                {row.distributor_code}
                                {hasChanged('distributor_code') && oldData && (
                                  <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                    Old: {oldData.distributor_code || 'N/A'}
                                  </div>
                                )}
                              </td>
                              <td style={hasChanged('mother_code') ? changedCellStyle : tdStyle}>
                                {row.mother_code}
                                {hasChanged('mother_code') && oldData && (
                                  <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                    Old: {oldData.mother_code || 'N/A'}
                                  </div>
                                )}
                              </td>
                              <td style={tdStyle}>{row.bp_code}</td>
                              <td style={hasChanged('bp_name') ? changedCellStyle : tdStyle}>
                                {row.bp_name}
                                {hasChanged('bp_name') && oldData && (
                                  <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                    Old: {oldData.bp_name || 'N/A'}
                                  </div>
                                )}
                              </td>

                              <td style={hasChanged('group_code') ? changedCellStyle : tdStyle}>
                                {row.group_code}
                                {hasChanged('group_code') && oldData && (
                                  <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                    Old: {oldData.group_code || 'N/A'}
                                  </div>
                                )}
                              </td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>
                                {statusIcon} {statusText}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <Button
                                  variant={updateFlag === 'duplicate' ? "danger" : updateFlag === 'update' ? "warning" : "secondary"}
                                  size="sm"
                                  onClick={() => {
                                    const actualIndex = indexOfFirstRowExcel + idx;
                                    const updatedData = importData.filter((_, i) => i !== actualIndex);
                                    setImportData(updatedData);

                                    const stillHasDuplicates = updatedData.some(r => r._updateFlag === 'duplicate' || r._updateFlag === 'update');
                                    if (!stillHasDuplicates) {
                                      setDuplicatesChecked(false);
                                    }
                                  }}
                                  style={{ padding: "6px 12px", fontSize: "14px" }}
                                >
                                  🗑️ Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Progress */}
                {uploading && (
                  <div style={{ marginTop: 10 }}>
                    <div>Processing {processedRows}/{totalRows} rows</div>
                    <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ width: `${progressPercent}%`, height: '100%', background: '#28a745' }} />
                    </div>
                  </div>
                )}

                {/* Pagination */}
                {importData.length > 0 && (
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <small>
                      Showing {indexOfFirstRowExcel + 1}–{Math.min(indexOfLastRowExcel, importData.length)} of {importData.length}
                    </small>
                    <div>
                      <Button
                        variant="outline-dark"
                        size="sm"
                        disabled={currentPageExcel === 1}
                        onClick={() => setCurrentPageExcel((p) => p - 1)}
                        className="me-2"
                      >
                        ⬅ Prev
                      </Button>
                      <span className="mx-2">Page {currentPageExcel} of {totalPagesExcel}</span>
                      <Button
                        variant="outline-dark"
                        size="sm"
                        disabled={currentPageExcel === totalPagesExcel}
                        onClick={() => setCurrentPageExcel((p) => p + 1)}
                      >
                        Next ➡
                      </Button>
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    onClick={() => { setShowExcelModal(false); setImportData([]); setExistingRows([]); setDuplicatesChecked(false); setFileName(''); setProcessedRows(0); setProgressPercent(0); }}
                    style={{ padding: "6px 12px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    Close
                  </button>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {/* EXPORT UPDATES BUTTON — visible lang pag may update rows at naka-check na duplicates */}
                    {duplicatesChecked && importData.some(r => r._updateFlag === 'update') && (
                      <button
                        onClick={handleExportUpdates}
                        style={{
                          padding: "6px 14px",
                          backgroundColor: "#f59e0b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}

                      >🔄 Import Updates ({importData.filter(r => r._updateFlag === 'update').length})

                      </button>
                    )}

                    <button
                      onClick={importDataToDB}
                      disabled={importing || importData.length === 0 || !duplicatesChecked}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: importing || importData.length === 0 || !duplicatesChecked ? "not-allowed" : "pointer",
                      }}
                    >
                      {importing ? "Importing..." : "📤 Import"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>



        {/* Sync Sub Mother Account button — only show if data exists */}
        {totalCount > 0 && (
          <button
            onClick={async () => {
              const confirm = await Swal.fire({
                title: '🔄 Sync Sub Mother Account',
                html: `
          <div style="text-align:left;">
            <p>This will scan <strong>Accounts_List</strong> and add any <strong>mother_code</strong> values not yet in <strong>sub_mother_account</strong>.</p>
            <p style="color:#6b7280; font-size:13px;">Already-existing entries will be skipped. No deletions.</p>
          </div>
        `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: '🔄 Sync Now',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#8b5cf6',
                cancelButtonColor: '#6c757d',
              });

              if (!confirm.isConfirmed) return;

              const result = await syncToSubMotherAccount();
              if (result) {
                Swal.fire({
                  icon: result.added > 0 ? 'success' : 'info',
                  title: result.added > 0 ? '✅ Sync Complete!' : 'ℹ️ Nothing to Sync',
                  html: `
            <div style="text-align:left; font-family: monospace;">
              <p>📊 <strong>Unique mother codes found:</strong> ${result.total}</p>
              <p style="color:green;">✅ <strong>Added:</strong> ${result.added}</p>
              <p style="color:gray;">⏭️ <strong>Skipped (already exist):</strong> ${result.skipped}</p>
              ${result.groupsMissing > 0
                      ? `<p style="color:orange;">⚠️ <strong>Missing group code mapping:</strong> ${result.groupsMissing} entries (group_name will be null)</p>`
                      : ''}
            </div>
          `,
                  confirmButtonText: 'OK',
                });
                await fetchMotherAccounts(); // Refresh mother accounts list
              }
            }}
            disabled={syncingSubMother}
            style={{
              padding: '10px 15px',
              background: syncingSubMother ? '#9ca3af' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: 5,
              cursor: syncingSubMother ? 'not-allowed' : 'pointer',
            }}
          >
            {syncingSubMother ? '🔄 Syncing...' : '🔄 Sync Sub Mother'}
          </button>
        )}
        {/* ── Arrange Data Modal ── */}
        <button
          onClick={() => setShowArrangeModal(true)}
          style={{
            padding: '10px 15px',
            background: '#f59e0b',
            color: 'white', border: 'none', borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          🗂️ Arrange Data
        </button>

        {showArrangeModal && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2000,
            }}
            onClick={() => { setShowArrangeModal(false); setArrangeOption(''); }}
          >
            <div
              style={{
                background: 'white', borderRadius: 16, width: '100%', maxWidth: 480,
                overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                padding: '18px 24px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h3 style={{ margin: 0, color: 'white', fontSize: 20, fontWeight: 600 }}>
                  🗂️ Arrange Data
                </h3>
                <button
                  onClick={() => { setShowArrangeModal(false); setArrangeOption(''); }}
                  style={{
                    background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                    width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 20,
                  }}
                >×</button>
              </div>

              {/* Body */}
              <div style={{ padding: '24px' }}>
                <p style={{ margin: '0 0 16px', color: '#374151', fontSize: 14 }}>
                  Select which operation to run:
                </p>

                {/* Options */}
                {[
                  {
                    value: 'fix_group_code',
                    icon: '🏷️',
                    label: 'Fix Group Codes',
                    desc: 'Convert group_code names → numeric codes using mother_account table',
                    color: '#3b82f6',
                  },
                  {
                    value: 'fix_mother_code',
                    icon: '👥',
                    label: 'Fix Mother Codes',
                    desc: 'Convert mother_code names → DS codes using sub_mother_account table',
                    color: '#8b5cf6',
                  },
                  {
                    value: 'fix_both',
                    icon: '⚡',
                    label: 'Arrange Both',
                    desc: 'Fix Group Codes first, then Mother Codes (recommended)',
                    color: '#f59e0b',
                  },
                  {
                    value: 'fix_sub_mother_names',
                    icon: '🔧',
                    label: 'Fix Sub Mother Names',
                    desc: 'Replace DS codes used as names in sub_mother_account with actual store names',
                    color: '#ef4444',
                  },
                ].map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => setArrangeOption(opt.value)}
                    style={{
                      padding: '14px 16px', borderRadius: 10, marginBottom: 10,
                      border: `2px solid ${arrangeOption === opt.value ? opt.color : '#e5e7eb'}`,
                      background: arrangeOption === opt.value ? `${opt.color}10` : 'white',
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}
                    onMouseEnter={e => {
                      if (arrangeOption !== opt.value)
                        e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={e => {
                      if (arrangeOption !== opt.value)
                        e.currentTarget.style.background = 'white';
                    }}
                  >
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>
                    <div>
                      <div style={{
                        fontWeight: 600, fontSize: 15, color: '#111827',
                        marginBottom: 2,
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>
                        {opt.desc}
                      </div>
                    </div>
                    {arrangeOption === opt.value && (
                      <span style={{
                        marginLeft: 'auto', color: opt.color,
                        fontSize: 20, flexShrink: 0,
                      }}>✔</span>
                    )}
                  </div>
                ))}

                <p style={{ fontSize: 12, color: '#9ca3af', margin: '12px 0 0' }}>
                  ⚡ Uses parallel batch processing — handles 100k+ records fast.
                </p>
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px', borderTop: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                background: '#f9fafb',
              }}>
                <button
                  onClick={() => { setShowArrangeModal(false); setArrangeOption(''); }}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: '#e5e7eb', cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  disabled={!arrangeOption}
                  onClick={() => {
                    setShowArrangeModal(false);
                    if (arrangeOption === 'fix_sub_mother_names') {
                      fixSubMotherNames();
                    } else {
                      runArrangeData(arrangeOption);
                    }
                    setArrangeOption('');
                  }}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: arrangeOption ? '#f59e0b' : '#d1d5db',
                    color: arrangeOption ? 'white' : '#9ca3af',
                    cursor: arrangeOption ? 'pointer' : 'not-allowed',
                    fontWeight: 600, fontSize: 15,
                  }}
                >
                  ⚡ Run Now
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Create New */}
        <button
          onClick={() => {
            setIsEditing(false);
            setNewRecord({
              distributor_code: '',
              mother_code: '',
              bp_code: '',
              bp_name: '',
              group_code: '',
              status: true,
            });
            setShowModal(true);
          }}
          style={{
            ...styles.btnCreate,
            ...(hoveredButton === 'create' ? buttonHoverStyle : {}),
          }}
          onMouseEnter={() => setHoveredButton('create')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          + Create New
        </button>
        <button
          onClick={checkAndCleanBPTagging}
          disabled={loading}
          style={{
            ...styles.btnCreate,
            ...(hoveredButton === 'create' ? buttonHoverStyle : {}),
          }}
        >

          Check BP List Tagging
        </button>
      </div>


      {/* 🔍 Search with Dropdown Filter */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 15,
        background: 'white',
        padding: '15px',
        borderRadius: 8,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>

        {/* 🔥 ADD THIS DROPDOWN BEFORE THE SEARCH FIELD DROPDOWN */}
        <select
          value={accountTypeFilter}
          onChange={(e) => {
            setAccountTypeFilter(e.target.value);
            setCurrentPage(1); // Reset to page 1
          }}
          style={{
            padding: '8px 12px',
            border: '2px solid #10b981',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            minWidth: 200,
            backgroundColor: '#f0fdf4'
          }}
        >
          <option value="all">📊 All Accounts</option>
          <option value="mother_only">👥 Mother Account Only</option>
          <option value="bp_only">📋 BP Account Only</option>
          <option value="agent_only">👤 Agent Only</option>
          <option value="distributor_only">🏢 Distributor Only</option>
          <option value="group_only">🏷️ Group Only</option>
        </select>

        {/* SEARCH FIELD DROPDOWN */}
        <select
          value={searchField}
          onChange={(e) => {
            setSearchField(e.target.value);
            setSearchTerm('');
          }}
          style={{
            padding: '8px 12px',
            border: '2px solid #2563eb',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            minWidth: 180,
            backgroundColor: '#f8fafc'
          }}
        >
          <option value="all">🔍 Search All Fields</option>
        </select>

        {/* SEARCH INPUT */}
        <input
          type="text"
          placeholder={
            searchField === 'all' ? 'Search all fields...' :
              searchField === 'distributor' ? 'Search distributor code or name...' :
                searchField === 'mother' ? 'Search mother code or name...' :
                  searchField === 'bp_code' ? 'Search BP code...' :
                    searchField === 'bp_name' ? 'Search BP name...' :
                      searchField === 'agent' ? 'Search agent code or name...' :
                        'Search group code or name...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '2px solid #e5e7eb',
            borderRadius: 6,
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#2563eb'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />

        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            ✕ Clear
          </button>
        )}

        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            padding: '8px 16px',
            backgroundColor: showAll ? '#6c757d' : '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            transition: 'background 0.2s'
          }}
        >
          {showAll ? 'Paginate' : 'Show All'}
        </button>
      </div>

      {/* 🧾 Table */}
      <div
        style={{
          overflowX: 'auto',
          margin: '20px 0',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '800px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#007BFF',
                color: '#fff',
                textAlign: 'left',
              }}
            >
              <th style={{ padding: '12px 15px' }}>Distributor</th>
              <th style={{ padding: '12px 15px' }}>Mother Code</th>
              <th style={{ padding: '12px 15px' }}>BP Code</th>
              <th style={{ padding: '12px 15px' }}>BP Name</th>
              <th style={{ padding: '12px 15px' }}>Group Code</th>
              <th style={{ padding: '12px 15px' }}>Status</th>
              <th style={{ padding: '12px 15px' }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {/* 🔄 Upload progress bar */}
            {uploading && (
              <tr>
                <td colSpan={8} style={{ padding: '10px 15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div
                      style={{
                        background: '#e0e0e0',
                        borderRadius: 5,
                        overflow: 'hidden',
                        height: 20,
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPercent}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #4f46e5, #3b82f6)',
                          transition: 'width 0.3s ease-in-out',
                          textAlign: 'center',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        {processedRows} / {totalRows} rows
                      </div>
                    </div>
                    {countdown > 0 && (
                      <div
                        style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                          color: '#1d4ed8',
                        }}
                      >
                        Completed! Closing in {countdown}...
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* ✅ DISPLAY DATA - ISANG BESES LANG! */}
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 20 }}>
                  Loading...
                </td>
              </tr>
            ) : data.length > 0 ? (
              data.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid #ddd',
                    transition: 'background 0.3s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 15px' }}>
                    {distributorMap[row.distributor_code] || row.distributor_code}
                  </td>
                  <td style={{ padding: '10px 15px' }}>
                    {motherMap[row.mother_code] || row.mother_code}
                  </td>
                  <td style={{ padding: '10px 15px' }}>{row.bp_code}</td>
                  <td style={{ padding: '10px 15px' }}>{row.bp_name}</td>

                  <td style={{ padding: '10px 15px' }}>
                    {groupMap[row.group_code] || row.group_code}
                  </td>
                  <td
                    style={{
                      padding: '10px 15px',
                      fontWeight: 'bold',
                      color: row.status ? 'green' : 'red',
                    }}
                  >
                    {row.status ? 'Active' : 'Inactive'}
                  </td>
                  <td style={{ padding: '10px 15px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEdit(row)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              !uploading && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: 'center', padding: 20, color: '#777' }}
                  >
                    No records
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>

        {/* 📄 Pagination Controls (NO Last button) */}
        {/* 📄 Pagination Controls */}
        {!showAll && data.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', padding: '20px' }}>
            <button
              onClick={handleFirstPage}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                backgroundColor: currentPage === 1 ? '#ccc' : '#007BFF',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              First
            </button>

            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                backgroundColor: currentPage === 1 ? '#ccc' : '#007BFF',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>

            <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 16px',
                backgroundColor: currentPage === totalPages ? '#ccc' : '#007BFF',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>

            <button
              onClick={handleLastPage}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 16px',
                backgroundColor: currentPage === totalPages ? '#ccc' : '#007BFF',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Last
            </button>
          </div>
        )}
      </div>

      {showExportByDistModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1050, padding: 16,
          }}
          onClick={() => { setShowExportByDistModal(false); setSelectedDistForExport(null); setExportDistSearch(''); }}
        >
          <div
            style={{
              background: 'white', borderRadius: 16, width: '100%', maxWidth: 600,
              maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: 20, fontWeight: 600 }}>
                📦 Export by Distributor
              </h3>
              <button
                onClick={() => { setShowExportByDistModal(false); setSelectedDistForExport(null); setExportDistSearch(''); }}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 22,
                }}
              >×</button>
            </div>

            {/* Search */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <input
                type="text"
                placeholder="🔍 Search distributor..."
                value={exportDistSearch}
                onChange={e => setExportDistSearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb',
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Distributor List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
              {distributors
                .filter(d =>
                  d.name?.toLowerCase().includes(exportDistSearch.toLowerCase()) ||
                  d.code?.toLowerCase().includes(exportDistSearch.toLowerCase())
                )
                .map((dist, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedDistForExport(dist)}
                    style={{
                      padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                      marginBottom: 4, transition: 'all 0.2s',
                      background: selectedDistForExport?.code === dist.code ? '#eff6ff' : 'white',
                      border: selectedDistForExport?.code === dist.code ? '2px solid #2563eb' : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (selectedDistForExport?.code !== dist.code) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={e => { if (selectedDistForExport?.code !== dist.code) e.currentTarget.style.background = 'white'; }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{dist.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Code: {dist.code}</div>
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f9fafb',
            }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                {selectedDistForExport ? `Selected: ${selectedDistForExport.name}` : 'Select a distributor'}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setShowExportByDistModal(false); setSelectedDistForExport(null); setExportDistSearch(''); }}
                  style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#e5e7eb', cursor: 'pointer' }}
                >Cancel</button>
                <button
                  disabled={!selectedDistForExport}
                  onClick={() => handleExportByDistributor(selectedDistForExport.code)}
                  style={{
                    padding: '10px 18px', borderRadius: 8, border: 'none',
                    background: selectedDistForExport ? '#2563eb' : '#9ca3af',
                    color: 'white', cursor: selectedDistForExport ? 'pointer' : 'not-allowed',
                    fontWeight: 500,
                  }}
                >📥 Export</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              borderRadius: 16,
              width: '100%',
              maxWidth: 650,
              maxHeight: '90vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: 'white',
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                }}
              >
                {isEditing ? 'Edit' : 'Create New'} Record
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')
                }
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                padding: 24,
                overflowY: 'auto',
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20,
              }}
            >
              {/* Distributor Code */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Distributor Code *
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name="distributor_code"
                    value={newRecord.distributor_code || ''}
                    onChange={handleInputChange}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 14,
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                    onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowDistributorModal(true)}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 16,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* Mother Code */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Mother Code
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name="mother_code"
                    value={newRecord.mother_code || ''}
                    onChange={handleInputChange}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                    onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMotherModal(true)}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 16,
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* Agent Code */}
              <div>
         
                
              </div>

              {/* Group Code */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>Group Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name="group_code"
                    value={newRecord.group_code || ''}
                    onChange={handleTaggingChange}
                    disabled
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(true)}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>BP Code</label>
                <BpSearchableDropdown
                  value={newRecord.bp_code || ''}
                  onSelect={(bp) => {
                    setNewRecord(prev => ({
                      ...prev,
                      bp_code: bp.bp_code,
                      bp_name: bp.bp_name
                    }));
                  }}
                />
              </div>
              {/* BP Name (Disabled) */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>BP Name</label>
                <input
                  name="bp_name"
                  value={newRecord.bp_name || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    backgroundColor: '#f9fafb',
                    color: '#6b7280',
                    fontStyle: 'italic',
                  }}
                />
              </div>


              {/* Status */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>Status *</label>
                <select
                  name="status"
                  value={newRecord.status}
                  onChange={(e) =>
                    setNewRecord((p) => ({ ...p, status: e.target.value === 'true' }))
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                  required
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div
                  style={{
                    color: '#dc2626',
                    marginTop: 20,
                    padding: 12,
                    background: '#fef2f2',
                    borderRadius: 8,
                    fontSize: 14,
                    borderLeft: '4px solid #dc2626',
                    gridColumn: 'span 2',
                  }}
                >
                  {errorMessage}
                </div>
              )}
            </form>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                padding: 24,
                flexShrink: 0,
                borderTop: '1px solid #e5e7eb',
                background: 'white',
              }}
            >
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button" // keep as button
                onClick={handleSubmit} // <--- call your function here
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  background: saving ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </button>
            </div>

          </div>
        </div>
      )}



      {showMultipleModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowMultipleModal(false)}
        >
          <div
            style={{
              position: 'relative',
              background: 'white',
              borderRadius: 16,
              width: '100%',
              maxWidth: 450,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                padding: '18px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, color: 'white', fontSize: 18, fontWeight: 600 }}>
                🔍 Export {selectedExportType}
              </h3>
              <button
                onClick={() => setShowMultipleModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateMultipleTemplate(selectedExportType);
              }}
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {/* Dynamic Input Field */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  {selectedExportType} Code
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name={`${selectedExportType.toLowerCase()}_code`}
                    type="text"
                    value={
                      newRecord[`${selectedExportType.toLowerCase()}_code`] || ''
                    }
                    onChange={(e) =>
                      setNewRecord({
                        ...newRecord,
                        [e.target.name]: e.target.value,
                      })
                    }
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedExportType === 'Agent') setShowAgentModal(true);
                      if (selectedExportType === 'Distributor')
                        setShowDistributorModal(true);
                      if (selectedExportType === 'Mother') setShowMotherModal(true);
                    }}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* Number of Codes */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Number of Codes to Generate
                </label>
                <input
                  name="range_count"
                  type="number"
                  min="1"
                  max="99999999"
                  value={newRecord.range_count || ''}
                  onChange={(e) =>
                    setNewRecord({
                      ...newRecord,
                      [e.target.name]: e.target.value,
                    })
                  }
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                  }}
                />
              </div>

              {/* Footer Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowMultipleModal(false)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: 8,
                    background: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {showTaggingModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowTaggingModal(false)}
        >
          <div
            style={{
              position: 'relative',
              background: 'white',
              borderRadius: 16,
              width: '100%',
              maxWidth: 700,
              maxHeight: '90vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, color: 'white', fontSize: 20, fontWeight: 600 }}>
                🏷️ Export for Tagging
              </h3>
              <button
                onClick={() => setShowTaggingModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerateTaggingTemplate();
              }}
              style={{
                padding: 24,
                overflowY: 'auto',
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20,
              }}
            >
              {/* Distributor Code */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>Distributor Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name="distributor_code"
                    type="number"
                    value={newRecord.distributor_code || ''}
                    onChange={handleTaggingChange}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowDistributorModal(true)}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* Mother Code */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>Mother Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name="mother_code"
                    value={newRecord.mother_code || ''}
                    onChange={handleTaggingChange}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMotherModal(true)}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* Agent Code */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>Agent Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name="agent_code"
                    value={newRecord.agent_code || ''}
                    onChange={handleTaggingChange}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAgentModal(true)}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* Group Code */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>Group Code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    name="group_code"
                    value={newRecord.group_code || ''}
                    onChange={handleTaggingChange}
                    disabled
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(true)}
                    style={{
                      padding: '10px 14px',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    🔍
                  </button>
                </div>
              </div>
              {/* Number of Codes */}
              <div style={{ gridColumn: '1 / span 2' }}>
                <label style={{ display: 'block', marginBottom: 8 }}>Number of Codes to Generate</label>
                <input
                  name="range_count"
                  type="number"
                  min="1"
                  max="99999999"
                  value={newRecord.range_count || ''}
                  onChange={handleTaggingChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                  }}
                />
              </div>

              {/* Footer Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  gridColumn: '1 / span 2',
                  marginTop: 24,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowTaggingModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Generate Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showGroupModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowGroupModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              width: '100%',
              maxWidth: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16 }}>Select Group Code</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {groupAccounts.map((g) => (
                <li
                  key={g.id}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSelectGroup(g)}
                >
                  {g.code} — {g.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showDistributorModal && <LookupModal title="Select Distributor" columns={['Code', 'Name',]} data={distributors} onSelect={handleSelectDistributor} onClose={() => setShowDistributorModal(false)} fieldKeys={['code', 'name',]} />}
      {showMotherModal && <LookupModal title="Select Mother Account" columns={['Code', 'Name',]} data={motherAccounts} onSelect={handleSelectMother} onClose={() => setShowMotherModal(false)} fieldKeys={['dscode', 'name',]} />}
      {showAgentModal && <LookupModal title="Select Agent" columns={['ID', 'Name']} data={agents} onSelect={handleSelectAgent} onClose={() => setShowAgentModal(false)} fieldKeys={['UserID', 'name']} />}
    </div >
  );
}


function BpSearchableDropdown({ value, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBpName, setSelectedBpName] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load BP name when value changes
  useEffect(() => {
    if (value && !selectedBpName) {
      loadBpName(value);
    }
  }, [value]);

  const loadBpName = async (bpCode) => {
    try {
      const { data, error } = await supabase
        .from('Bp_Accounts')
        .select('bp_name')
        .eq('bp_code', bpCode)
        .single();

      if (!error && data) {
        setSelectedBpName(data.bp_name);
      }
    } catch (err) {
      console.error('Error loading BP name:', err);
    }
  };

  // Search BP Accounts with debounce
  const searchBpAccounts = async (term) => {
    if (!term || term.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Bp_Accounts')
        .select('bp_code, bp_name')
        .or(`bp_code.ilike.%${term}%,bp_name.ilike.%${term}%`)
        .order('bp_name', { ascending: true })
        .limit(50); // Show top 50 results

      if (error) throw error;
      setOptions(data || []);
    } catch (err) {
      console.error('Error searching BP:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isOpen && searchTerm) {
        searchBpAccounts(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, isOpen]);

  const handleSelect = (bp) => {
    onSelect(bp);
    setSelectedBpName(bp.bp_name);
    setSearchTerm('');
    setIsOpen(false);
    setOptions([]);
  };

  const displayValue = value ? `${value} - ${selectedBpName}` : '';

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={isOpen ? searchTerm : displayValue}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search BP Code or Name..."
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '2px solid #e5e7eb',
          borderRadius: 8,
          fontSize: 14,
          outline: 'none',
          transition: 'all 0.2s',
        }}
        onFocusCapture={(e) => (e.target.style.borderColor = '#2563eb')}
        onBlur={(e) => setTimeout(() => (e.target.style.borderColor = '#e5e7eb'), 200)}
      />

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxHeight: 300,
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          {loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
              Searching...
            </div>
          ) : searchTerm.length < 2 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              Type at least 2 characters to search
            </div>
          ) : options.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
              No results found
            </div>
          ) : (
            options.map((bp, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(bp)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: idx < options.length - 1 ? '1px solid #f3f4f6' : 'none',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                  {bp.bp_code}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {bp.bp_name}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
function LookupModal({ title, columns, data, onSelect, onClose, fieldKeys }) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [localData, setLocalData] = useState(data);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 10;

  // Check if this is BP modal (needs lazy loading)
  const isBpModal = title === 'Select BP Account';

  // Fetch data for BP modal (lazy loading)
  const fetchBpPage = async (page, searchTerm) => {
    if (!isBpModal) return;

    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      let query = supabase
        .from("Bp_Accounts")
        .select("bp_code, bp_name", { count: "exact" })
        .order("bp_name", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (searchTerm.trim()) {
        query = query.or(`bp_code.ilike.%${searchTerm}%,bp_name.ilike.%${searchTerm}%`);
      }

      const { data: fetchedData, error, count } = await query;
      if (error) throw error;

      setLocalData(fetchedData || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching BP data:', err);
      setLocalData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Initialize data
  useEffect(() => {
    if (isBpModal) {
      fetchBpPage(1, '');
    } else {
      setLocalData(data);
      setTotalCount(data.length);
    }
  }, []);

  // Handle search
  useEffect(() => {
    if (isBpModal) {
      setCurrentPage(1);
      fetchBpPage(1, search);
    } else {
      // For non-BP modals, filter locally
      const filtered = data.filter(row =>
        fieldKeys.some(k => String(row[k] || '').toLowerCase().includes(search.toLowerCase()))
      );
      setLocalData(filtered);
      setTotalCount(filtered.length);
    }
  }, [search]);

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    if (isBpModal) {
      fetchBpPage(newPage, search);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / pageSize);
  const displayData = isBpModal ? localData : localData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            margin: 0,
            color: 'white',
            fontSize: 20,
            fontWeight: 600
          }}>
            {title} {isBpModal && `(${totalCount.toLocaleString()} total)`}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 22,
              transition: 'all 0.2s'
            }}
          >
            ×
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              fontSize: 18
            }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                border: '2px solid #e5e7eb',
                borderRadius: 10,
                fontSize: 15,
                outline: 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 24px 24px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              Loading...
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0 4px',
              marginTop: 4
            }}>
              <thead>
                <tr>
                  {columns.map((c, i) => (
                    <th key={i} style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      position: 'sticky',
                      top: 0,
                      background: 'white',
                      zIndex: 10
                    }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.length ? displayData.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => { onSelect(row); onClose(); }}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {fieldKeys.map((k, j) => (
                      <td key={j} style={{
                        padding: '14px 16px',
                        fontSize: 14,
                        color: '#1f2937',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderLeft: j === 0 ? '3px solid #2563eb' : '1px solid #e5e7eb',
                        borderRadius: j === 0 ? '8px 0 0 8px' : j === fieldKeys.length - 1 ? '0 8px 8px 0' : 0
                      }}>
                        {row[k] || '-'}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{
                        textAlign: 'center',
                        padding: 40,
                        color: '#9ca3af',
                        fontSize: 15
                      }}
                    >
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f9fafb'
        }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>
            Page {currentPage} of {totalPages || 1}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: (currentPage === 1 || loading) ? '#f3f4f6' : '#fff',
                color: '#111827',
                cursor: (currentPage === 1 || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              ◀ Prev
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0 || loading}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: (currentPage === totalPages || totalPages === 0 || loading) ? '#f3f4f6' : '#fff',
                color: '#111827',
                cursor: (currentPage === totalPages || totalPages === 0 || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>


    </div>

  );
}

const styles = {
  container: { padding: 20, fontFamily: 'Arial, sans-serif', background: '#f5f5f5' },
  heading: { color: '#333', marginBottom: 20 },
  buttonContainer: { display: 'flex', gap: 10, marginBottom: 20 },
  btn: { padding: '10px 15px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' },
  btnCreate: { padding: '10px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' },
  btnEdit: { padding: '5px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  btnDelete: { padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  btnIcon: { padding: '8px 10px', background: '#0066cc', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' },
  btnCancel: { padding: '8px 15px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' },
  btnSave: { padding: '8px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' },
  menu: { position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ccc', borderRadius: 4, zIndex: 10, minWidth: 250 },
  menuItem: { padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', marginTop: 15 },
  input: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: 4 },
  searchInput: { flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: 4 },
  pagination: { display: 'flex', justifyContent: 'center', gap: 10, marginTop: 15, padding: 10 },
  pageBtn: { padding: '6px 12px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', borderRadius: 4 }
};
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { border: "1px solid #ccc", padding: "8px", textAlign: "center" };
const tdStyle = { border: "1px solid #ccc", padding: "8px", textAlign: "center" };


const modalStyles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: 'white', borderRadius: 8, width: 600, maxHeight: '90vh', overflowY: 'auto', padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: 15, marginBottom: 20 },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }
};























