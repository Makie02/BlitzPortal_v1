import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import Papa from "papaparse";

function MotherAccountPage() {
  const [motherAccounts, setMotherAccounts] = useState([]);
  const [activeMother, setActiveMother] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [editingSubAccount, setEditingSubAccount] = useState(null);
  const importInputRef = useRef(null);

  // Search states
  const [motherSearchQuery, setMotherSearchQuery] = useState("");
  const [subAccountSearchQuery, setSubAccountSearchQuery] = useState("");

  // ── State para sa DS lookup tooltip ──
  const [dsLookupResults, setDsLookupResults] = useState([]);
  const [dsLookupLoading, setDsLookupLoading] = useState(false);
  const [showDsTooltip, setShowDsTooltip] = useState(false);
  const [dsLookupCode, setDsLookupCode] = useState('');
  const dsTooltipRef = useRef(null);


  // ── States para sa per-row tooltip ──
  const [activeTooltipIdx, setActiveTooltipIdx] = useState(null);
  const [rowLookupResults, setRowLookupResults] = useState([]);
  const [rowLookupLoading, setRowLookupLoading] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  // ── Close tooltip on outside click ──
  useEffect(() => {
    const handleClickOutside = () => setActiveTooltipIdx(null);
    if (activeTooltipIdx !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeTooltipIdx]);

  // ── Fetch BP Names per row ──
  // ── Fetch BP Names per row ──
  const handleRowLookup = async (idx, motherCode) => {
    if (activeTooltipIdx === idx) {
      setActiveTooltipIdx(null);
      return;
    }

    // ✅ Position relative to the button, but INSIDE the modal
    const btn = document.getElementById(`lookup-btn-${idx}`);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: rect.right - 300,
      });
    }
    setActiveTooltipIdx(idx);
    setRowLookupLoading(true);
    setRowLookupResults([]);

    try {
      const { data, error } = await supabase
        .from('Accounts_List')
        .select('bp_code, bp_name')
        .eq('mother_code', motherCode?.trim())
        .limit(200);

      if (error) throw error;
      setRowLookupResults(data || []);
    } catch (err) {
      console.error(err);
      setRowLookupResults([]);
    } finally {
      setRowLookupLoading(false);
    }
  };
  // ── Close tooltip on outside click ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dsTooltipRef.current && !dsTooltipRef.current.contains(e.target)) {
        setShowDsTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Fetch BP Names connected to a DS code ──
  const handleDsLookup = async (code) => {
    const trimmed = code?.trim();
    if (!trimmed) {
      Swal.fire('Warning', 'Walang mother code na naka-input.', 'warning');
      return;
    }

    setDsLookupLoading(true);
    setShowDsTooltip(true);
    setDsLookupResults([]);
    setDsLookupCode(trimmed);

    try {
      const BATCH = 1000;
      let allRows = [], offset = 0, hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('Accounts_List')
          .select('bp_code, bp_name, distributor_code, group_code')
          .eq('mother_code', trimmed)
          .range(offset, offset + BATCH - 1);

        if (error) throw error;

        if (data?.length > 0) {
          allRows = [...allRows, ...data];
          offset += BATCH;
          hasMore = data.length === BATCH;
        } else {
          hasMore = false;
        }
      }

      setDsLookupResults(allRows);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message, 'error');
      setShowDsTooltip(false);
    } finally {
      setDsLookupLoading(false);
    }
  };

  // Add this function with your other handlers
  const handleDeleteAll = async () => {
    if (!activeMother) return;

    const confirm = await Swal.fire({
      title: '⚠️ Delete ALL Sub-Accounts?',
      html: `
      <div style="text-align:left;">
        <p>Lahat ng sub-accounts sa <b style="color:#dc3545;">${activeMother.name}</b> ay mabubura.</p>
        <p style="color:#6b7280;font-size:13px;">Total: <b>${subAccounts.length}</b> records ang mabubura.</p>
        <p style="color:#dc3545;font-size:13px;font-weight:bold;">⚠️ Hindi na ito maibabalik!</p>
      </div>
    `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ Yes, Delete All!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    });

    if (!confirm.isConfirmed) return;

    const doubleConfirm = await Swal.fire({
      title: 'Are you SURE?',
      text: 'Type "DELETE" to confirm',
      input: 'text',
      inputPlaceholder: 'Type DELETE here',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Confirm Delete All',
      preConfirm: (value) => {
        if (value !== 'DELETE') {
          Swal.showValidationMessage('Please type DELETE to confirm');
        }
        return value;
      }
    });

    if (!doubleConfirm.isConfirmed) return;

    try {
      Swal.fire({
        title: '🗑️ Deleting records...',
        html: `
        <div style="text-align:left;font-size:14px;">
          <p>⏳ Running server-side batch delete...</p>
          <p style="color:#6b7280;font-size:12px;">Maaaring tumagal ng ilang minuto depende sa dami ng records.</p>
        </div>
      `,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const { data, error } = await supabase.rpc('delete_sub_mother_by_group', {
        p_group_code: String(activeMother.code),
      });

      if (error) throw error;

      // Check if function returned an error
      if (data && data.success === false) {
        throw new Error(data.error || 'Unknown error from server');
      }

      Swal.close();
      await Swal.fire({
        icon: 'success',
        title: '✅ Deleted!',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:1.8;">
          <p style="color:green;">✅ <b>Sub-accounts deleted:</b> ${data?.deleted_sub ?? 0}</p>
          <p style="color:#6b7280;">🗑️ <b>Sub_3 records deleted:</b> ${data?.deleted_sub3 ?? 0}</p>
        </div>
      `,
        timer: 3000,
        showConfirmButton: false,
      });

      fetchSubAccounts(activeMother);

    } catch (err) {
      console.error(err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
    }
  };
  // Fetch mother accounts on component mount
  useEffect(() => {
    const fetchMotherAccounts = async () => {
      const { data, error } = await supabase
        .from("mother_account")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        console.error(error);
        Swal.fire("Error", "Failed to load mother accounts", "error");
      } else {
        setMotherAccounts(data);
      }
    };
    fetchMotherAccounts();
  }, []);

  // Filter mother accounts
  const filteredMotherAccounts = motherAccounts.filter((mother) => {
    const q = motherSearchQuery.trim().toLowerCase();
    if (q === "") return true;
    const nameMatch = mother.name.toLowerCase().includes(q);
    const codeMatch = mother.code && mother.code.toLowerCase().includes(q);
    return nameMatch || codeMatch;
  });

  // Fetch sub-accounts
  // ✅ Fetch sub-accounts (now filtered by group_code instead of mother_id)
  const fetchSubAccounts = async (mother) => {
    setActiveMother(mother);
    setSubAccountSearchQuery("");

    const { data, error } = await supabase
      .from("sub_mother_account")
      .select(`
      id,
      group_code,
      dscode,
      name,
      status,
      created_at,
      group_name
    `)
      .eq("group_code", mother.code)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ Error fetching sub-accounts:", error);
      Swal.fire("Error", "Failed to load sub-accounts", "error");
    } else {
      setSubAccounts(data);
    }
  };



  // Filter sub-accounts
  const filteredSubAccounts = subAccounts.filter((sub) => {
    const q = subAccountSearchQuery.trim().toLowerCase();
    if (q === "") return true;
    const nameMatch = sub.name.toLowerCase().includes(q);
    const statusText = sub.status ? "active" : "inactive";
    const statusMatch = statusText.includes(q);
    return nameMatch || statusMatch;
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetModal = () => {
    setFormData({ name: "" });
    setEditingSubAccount(null);
    setShowModal(false);
  };

  // ✅ Add/Edit Sub-account
  const handleAddEditSubAccount = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return Swal.fire("Warning", "Sub-account name is required", "warning");
    }

    try {
      if (editingSubAccount) {
        // ✏️ Update existing
        const { error } = await supabase
          .from("sub_mother_account")
          .update({ name: formData.name })
          .eq("id", editingSubAccount.id);

        if (error) throw error;
        Swal.fire("Success", "Sub-account updated!", "success");
      } else {
        // ✅ Generate next DS code
        const { data: existing, error: fetchError } = await supabase
          .from("sub_mother_account")
          .select("dscode")
          .order("id", { ascending: false })
          .limit(1);
        if (fetchError) throw fetchError;

        let nextdscode = "DS100000";
        if (existing && existing.length > 0 && existing[0].dscode) {
          const lastCode = existing[0].dscode;
          const lastNumber = parseInt(lastCode.replace("DS", ""), 10);
          if (!isNaN(lastNumber)) nextdscode = `DS${lastNumber + 1}`;
        }

        // ✅ Insert (no mother_id)
        const { error: insertError } = await supabase
          .from("sub_mother_account")
          .insert([
            {
              name: formData.name,
              dscode: nextdscode,
              status: true,
              group_name: activeMother.name,
              group_code: activeMother.code, // ✅ only this used now
            },
          ]);

        if (insertError) throw insertError;

        Swal.fire("Success", `Sub-account created! (${nextdscode})`, "success");
      }

      resetModal();
      fetchSubAccounts(activeMother);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", error.message, "error");
    }
  };



  const handleBack = () => {
    setActiveMother(null);
    setSubAccounts([]);
    setMotherSearchQuery("");
  };

  const triggerImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  // ✅ Import CSV
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      Swal.fire("Warning", "No file selected.", "warning");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const parsedData = results.data;
        const hasName = results.meta.fields.includes("Sub-Mother Name");
        if (!hasName) {
          Swal.fire("Error", 'Missing required column: "Sub-Mother Name"', "error");
          return;
        }

        const hasID = results.meta.fields.includes("ID");
        let existingIDs = [];
        if (hasID) {
          const { data: existingSubs, error } = await supabase
            .from("sub_mother_account")
            .select("id");
          if (error) {
            console.error(error);
            Swal.fire("Error", "Failed to check existing records", "error");
            return;
          }
          existingIDs = existingSubs.map((item) => String(item.id));
        }

        const toInsert = [];
        const toUpdate = [];

        parsedData.forEach((row) => {
          const name = row["Sub-Mother Name"]?.trim();
          const id = String(row["ID"] || "").trim();
          if (!name) return;
          const record = {
            name,
            group_name: activeMother.name,
            group_code: activeMother.code,
          };
          if (hasID && id) {
            if (existingIDs.includes(id)) {
              toUpdate.push({ ...record, id });
            } else {
              toInsert.push({ ...record, id });
            }
          } else {
            toInsert.push(record);
          }
        });

        if (toInsert.length === 0 && toUpdate.length === 0) {
          Swal.fire("Info", "No valid records found to import.", "info");
          return;
        }

        try {
          // ✅ Generate DS codes for new inserts only
          if (toInsert.length > 0) {
            Swal.fire({
              title: '📥 Preparing DS codes...',
              allowOutsideClick: false,
              didOpen: () => Swal.showLoading(),
            });

            // ✅ Get MAX dscode reliably
            const { data: allDsCodes, error: dsError } = await supabase
              .from('sub_mother_account')
              .select('dscode')
              .not('dscode', 'is', null)
              .not('dscode', 'eq', '');

            if (dsError) throw dsError;

            let dsCounter = 100000;
            if (allDsCodes && allDsCodes.length > 0) {
              const maxDs = allDsCodes.reduce((max, row) => {
                const match = row.dscode?.match(/^DS(\d+)$/i);
                if (match) {
                  const num = parseInt(match[1]);
                  return num > max ? num : max;
                }
                return max;
              }, 100000);
              dsCounter = maxDs;
            }

            console.log(`📊 Starting DS counter at: DS${dsCounter}`);

            // ✅ Assign dscode to each new insert
            const toInsertWithDS = toInsert.map((record) => {
              dsCounter++;
              const dscode = `DS${dsCounter}`;
              return { ...record, dscode, status: true };
            });

            // ✅ Validate — no null dscode allowed
            const invalid = toInsertWithDS.filter(r => !r.dscode || r.dscode === 'DSNaN' || !r.name);
            if (invalid.length > 0) {
              throw new Error(`${invalid.length} invalid rows detected (null dscode or name)`);
            }

            // ✅ Insert in batches of 500
            const INSERT_BATCH = 500;
            let inserted = 0;

            Swal.fire({
              title: '📥 Importing...',
              html: `<span id="import-prog">0 / ${toInsertWithDS.length}</span>`,
              allowOutsideClick: false,
              didOpen: () => Swal.showLoading(),
            });

            for (let i = 0; i < toInsertWithDS.length; i += INSERT_BATCH) {
              const chunk = toInsertWithDS.slice(i, i + INSERT_BATCH);
              const { error: insertError } = await supabase
                .from("sub_mother_account")
                .insert(chunk);
              if (insertError) throw insertError;

              inserted += chunk.length;
              const el = document.getElementById('import-prog');
              if (el) el.textContent = `${inserted} / ${toInsertWithDS.length}`;
            }
          }

          // ✅ Update existing records
          if (toUpdate.length > 0) {
            for (const updateRow of toUpdate) {
              const { id, ...fields } = updateRow;
              const { error: updateError } = await supabase
                .from("sub_mother_account")
                .update(fields)
                .eq("id", id);
              if (updateError) throw updateError;
            }
          }

          Swal.fire({
            icon: 'success',
            title: 'Import Complete!',
            html: `
            <div style="text-align:left;font-family:monospace;font-size:14px;line-height:1.8;">
              <p style="color:green;">✅ <b>Inserted:</b> ${toInsert.length}</p>
              <p style="color:#0087c5;">✏️ <b>Updated:</b> ${toUpdate.length}</p>
            </div>
          `,
            timer: 3000,
            showConfirmButton: false,
          });

          fetchSubAccounts(activeMother);
        } catch (err) {
          console.error(err);
          Swal.fire("Error", err.message, "error");
        }
      },
      error: function (error) {
        console.error(error);
        Swal.fire("Error", "Failed to parse CSV file.", "error");
      },
    });

    e.target.value = null;
  };


  // ── State para sa missing modal ──
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [missingMotherCodes, setMissingMotherCodes] = useState([]);
  const [checkingMissing, setCheckingMissing] = useState(false);
  const [creatingMissing, setCreatingMissing] = useState(false);

  // ── Check Missing Mother Codes ──
  const handleCheckMissing = async () => {
    if (!activeMother) return;
    setCheckingMissing(true);

    try {
      Swal.fire({
        title: '🔍 Checking Missing Mother Codes...',
        html: '<span id="check-prog" style="color:#f59e0b;font-weight:600;">Loading Accounts_List...</span>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // ── Step 1: Load ALL Accounts_List for this group ──
      const BATCH = 1000;
      let allAccounts = [], offset = 0, hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('Accounts_List')
          .select('mother_code, bp_name, bp_code')
          .eq('group_code', String(activeMother.code))
          .not('mother_code', 'is', null)
          .not('mother_code', 'eq', '')
          .range(offset, offset + BATCH - 1);

        if (error) throw error;

        if (data?.length > 0) {
          allAccounts = [...allAccounts, ...data];
          offset += BATCH;
          hasMore = data.length === BATCH;
          const el = document.getElementById('check-prog');
          if (el) el.textContent = `${allAccounts.length.toLocaleString()} records loaded...`;
        } else {
          hasMore = false;
        }
      }

      // ── Step 2: Get unique mother_codes from Accounts_List ──
      const motherCodeMap = {}; // mother_code → bp_name (first match)
      allAccounts.forEach(row => {
        const code = row.mother_code?.toString().trim();
        const name = row.bp_name?.toString().trim();
        if (code && name && !motherCodeMap[code]) {
          motherCodeMap[code] = name;
        }
      });

      const uniqueMotherCodes = Object.keys(motherCodeMap);
      console.log(`📊 Unique mother_codes in Accounts_List: ${uniqueMotherCodes.length}`);

      // ── Step 3: Load existing dscodes from sub_mother_account ──
      const el2 = document.getElementById('check-prog');
      if (el2) el2.textContent = 'Checking sub_mother_account...';

      let existingSubs = [], subOffset = 0, subHasMore = true;
      while (subHasMore) {
        const { data, error } = await supabase
          .from('sub_mother_account')
          .select('dscode, name')
          .eq('group_code', String(activeMother.code))
          .range(subOffset, subOffset + BATCH - 1);

        if (error) throw error;

        if (data?.length > 0) {
          existingSubs = [...existingSubs, ...data];
          subOffset += BATCH;
          subHasMore = data.length === BATCH;
        } else {
          subHasMore = false;
        }
      }

      const existingDscodeSet = new Set(
        existingSubs.map(s => s.dscode?.toString().trim()).filter(Boolean)
      );

      console.log(`✅ Existing dscodes: ${existingDscodeSet.size}`);

      // ── Step 4: Find missing mother_codes ──
      const missing = uniqueMotherCodes
        .filter(code => !existingDscodeSet.has(code))
        .map(code => ({
          mother_code: code,
          suggested_name: motherCodeMap[code] || '',
          input_name: motherCodeMap[code] || '', // editable
        }));

      console.log(`❌ Missing: ${missing.length}`);

      Swal.close();

      if (missing.length === 0) {
        Swal.fire({
          icon: 'success',
          title: '✅ All Good!',
          text: `All ${uniqueMotherCodes.length} mother codes already exist in sub_mother_account.`,
          timer: 2500,
          showConfirmButton: false,
        });
        setCheckingMissing(false);
        return;
      }

      setMissingMotherCodes(missing.map(m => ({ ...m })));
      setShowMissingModal(true);

    } catch (err) {
      console.error(err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
    } finally {
      setCheckingMissing(false);
    }
  };

  // ── Create Missing Mother Codes ──
  const handleCreateMissing = async () => {
    const toCreate = missingMotherCodes.filter(m => m.input_name?.trim());

    if (toCreate.length === 0) {
      Swal.fire('Warning', 'Walang records na may name na ilalagay.', 'warning');
      return;
    }

    setCreatingMissing(true);

    try {
      Swal.fire({
        title: '📥 Creating missing records...',
        html: '<span id="create-prog">Getting DS counter...</span>',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // ── Get MAX dscode ──
      const { data: allDsCodes, error: dsError } = await supabase
        .from('sub_mother_account')
        .select('dscode')
        .not('dscode', 'is', null)
        .not('dscode', 'eq', '');

      if (dsError) throw dsError;

      let dsCounter = 100000;
      if (allDsCodes?.length > 0) {
        const maxDs = allDsCodes.reduce((max, row) => {
          const match = row.dscode?.match(/^DS(\d+)$/i);
          if (match) {
            const num = parseInt(match[1]);
            return num > max ? num : max;
          }
          return max;
        }, 100000);
        dsCounter = maxDs;
      }

      // ── Build insert payload ──
      // Use the mother_code AS the dscode (since that's what Accounts_List references)
      const toInsert = toCreate.map(m => ({
        dscode: m.mother_code, // ✅ use exact mother_code from Accounts_List
        name: m.input_name.trim(),
        status: true,
        group_code: String(activeMother.code),
        group_name: activeMother.name,
      }));

      // ── Validate ──
      const invalid = toInsert.filter(r => !r.dscode || !r.name);
      if (invalid.length > 0) {
        throw new Error(`${invalid.length} rows have missing dscode or name!`);
      }

      // ── Insert in batches ──
      const INSERT_BATCH = 500;
      let inserted = 0;

      for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
        const chunk = toInsert.slice(i, i + INSERT_BATCH);
        const { error } = await supabase
          .from('sub_mother_account')
          .insert(chunk);

        if (error) throw error;

        inserted += chunk.length;
        const el = document.getElementById('create-prog');
        if (el) el.textContent = `${inserted} / ${toInsert.length} inserted`;
      }

      Swal.close();
      await Swal.fire({
        icon: 'success',
        title: '✅ Created!',
        html: `
        <div style="text-align:left;font-family:monospace;font-size:14px;line-height:1.8;">
          <p style="color:green;">✅ <b>Created:</b> ${inserted} records</p>
          <p style="color:#6b7280;">Group: <b>${activeMother.name}</b></p>
        </div>
      `,
        timer: 2500,
        showConfirmButton: false,
      });

      setShowMissingModal(false);
      setMissingMotherCodes([]);
      fetchSubAccounts(activeMother);

    } catch (err) {
      console.error(err);
      Swal.close();
      Swal.fire('Error', err.message, 'error');
    } finally {
      setCreatingMissing(false);
    }
  };

  // ✅ Export CSV
  const exportSubAccountsToCSV = (subs, motherInfo) => {
    if (subs.length === 0) {
      Swal.fire("Info", "No sub-accounts to export.", "info");
      return;
    }
    const header = [
      "ID",
      "Mother Code",
      "DS Code",
      "Sub-Mother Name",
      "Group Name",
      "Status",
      "Created At",
    ];
    const rows = subs.map((sub) => [
      sub.id,
      sub.mother_account?.code || "",
      sub.dscode,
      sub.name,
      sub.group_name || motherInfo.name,
      sub.status ? "Active" : "Inactive",
      new Date(sub.created_at).toLocaleString(),
    ]);
    const csvContent =
      [header, ...rows]
        .map((row) => row.map((v) => `"${v}"`).join(","))
        .join("\n") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sub_accounts_${motherInfo.code || motherInfo.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  // Add this state near your other states

  const handleEdit = (sub) => {
    setEditingSubAccount(sub);
    setFormData({ name: sub.name });
    setShowModal(true);
  };

  const handleDelete = (sub) => {
    Swal.fire({
      title: "Are you sure?",
      text: `Delete sub-account "${sub.name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const { error } = await supabase
            .from("sub_mother_account")
            .delete()
            .eq("id", sub.id);
          if (error) throw error;
          Swal.fire("Deleted!", "Sub-account has been deleted.", "success");
          fetchSubAccounts(activeMother);
        } catch (error) {
          console.error(error);
          Swal.fire("Error", error.message, "error");
        }
      }
    });
  };

  const toggleStatus = async (sub) => {
    try {
      const { error } = await supabase
        .from("sub_mother_account")
        .update({ status: !sub.status })
        .eq("id", sub.id);
      if (error) throw error;
      fetchSubAccounts(activeMother);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to update status", "error");
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(7);

  // Pagination calculations
  const totalItems = filteredSubAccounts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubAccounts = filteredSubAccounts.slice(startIndex, endIndex);



  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [subAccountSearchQuery]);
  // Add these style objects at the bottom with your other styles

  const paginationContainer = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "20px",
    padding: "15px",
    borderTop: "1px solid #ddd",
    flexWrap: "wrap",
    gap: "10px",
  };

  const paginationInfo = {
    fontSize: "14px",
    color: "#555",
  };

  const paginationControls = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  };

  const paginationSelect = {
    padding: "6px 10px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    fontSize: "14px",
    cursor: "pointer",
  };

  const paginationBtn = {
    padding: "6px 12px",
    background: "#0087c5",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s",
  };

  const paginationBtnDisabled = {
    background: "#ccc",
    cursor: "not-allowed",
  };

  const paginationPageInfo = {
    padding: "0 10px",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#333",
  };
  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      {!activeMother && (
        <>
          <h1 style={{ textAlign: "center", marginBottom: 30, color: "#0087c5" }}>
            Mother Accounts
          </h1>

          {/* Search bar for mother accounts */}
          <div style={{ margin: "0 auto", width: "300px", marginBottom: 20 }}>
            <input
              type="text"
              placeholder="Search mother accounts..."
              value={motherSearchQuery}
              onChange={(e) => setMotherSearchQuery(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={cardContainer}>
            {filteredMotherAccounts.map((mother) => (
              <div
                key={mother.id}
                style={cardStyle}
                onClick={() => fetchSubAccounts(mother)}
              >
                <div style={cardHeader}>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{mother.name}</h3>
                </div>
                <div style={cardBody}>
                  <p style={{ margin: 0, color: "#555", fontSize: 14 }}>
                    Code: <strong>{mother.code}</strong>
                  </p>
                  <p style={{ margin: "5px 0 0 0", color: "#777", fontSize: 12 }}>
                    Status: {mother.status ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            ))}
            {filteredMotherAccounts.length === 0 && (
              <p style={{ textAlign: "center", color: "#888", width: "100%" }}>
                No mother accounts found.
              </p>
            )}
          </div>
        </>
      )}

      {activeMother && (
        <div style={tabPanel}>
          <button style={btnBack} onClick={handleBack}>
            ← Back to Mother Accounts
          </button>

          <h2>{activeMother.name}</h2>

          {/* Search bar for sub-accounts */}
          <div style={{ marginBottom: 10, width: "300px" }}>
            <input
              type="text"
              placeholder="Search accounts..."
              value={subAccountSearchQuery}
              onChange={(e) => setSubAccountSearchQuery(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <button style={btnAdd} onClick={() => { resetModal(); setShowModal(true); }}>
              + Add Mother Account
            </button>
            <button
              style={{ ...btnAdd, marginLeft: 10, backgroundColor: "#6c757d" }}
              onClick={triggerImportClick}
            >
              Import CSV
            </button>
            <button
              style={{ ...btnAdd, marginLeft: 10, backgroundColor: "#17a2b8" }}
              onClick={() => exportSubAccountsToCSV(filteredSubAccounts, activeMother)}
            >
              Export CSV
            </button>
            <input
              type="file"
              accept=".csv"
              ref={importInputRef}
              style={{ display: "none" }}
              onChange={handleImportCSV}
            />





            <button
              style={{
                ...btnAdd,
                marginLeft: 10,
                backgroundColor: '#dc3545',
              }}
              onClick={handleDeleteAll}
            >
              🗑️ Delete All
            </button>

            <button
              style={{
                ...btnAdd,
                marginLeft: 10,
                backgroundColor: checkingMissing ? '#9ca3af' : '#f59e0b',
                cursor: checkingMissing ? 'not-allowed' : 'pointer',
                color: '#fff',
              }}
              onClick={handleCheckMissing}
              disabled={checkingMissing}
            >
              {checkingMissing ? 'Checking...' : '🔍 Check Missing'}
            </button>
          </div>

          <div style={{ ...responsiveTableWrapper, maxHeight: "480px", overflowY: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Group Code</th>
                  <th style={thStyle}>Mother Code</th>
                  <th style={thStyle}>Mother Name</th>

                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created At</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 10 }}>
                      No sub-accounts found.
                    </td>
                  </tr>
                ) : (
                  paginatedSubAccounts.map((sub) => (
                    <tr key={sub.id} style={trResponsive}>
                      <td style={tdStyle}>{sub.id}</td>
                      <td style={tdStyle}>{sub.group_code || "-"}</td>
                      <td style={tdStyle}>{sub.dscode}</td> {/* ✅ KEPT THIS LINE */}

                      <td style={tdStyle}>{sub.name}</td> {/* ✅ KEPT THIS LINE */}

                      <td style={tdStyle}>{sub.status ? "Active" : "Inactive"}</td>
                      <td style={tdStyle}>{new Date(sub.created_at).toLocaleString()}</td>
                      <td style={tdStyle}>
                        <button style={btnEdit} onClick={() => handleEdit(sub)}>
                          Edit
                        </button>
                        <button style={btnDelete} onClick={() => handleDelete(sub)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

          </div>
        </div>
      )}

      {totalItems > 0 && (
        <div style={paginationContainer}>
          <div style={paginationInfo}>
            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
          </div>

          <div style={paginationControls}>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={paginationSelect}
            >
              <option value={7}>7 per page</option>

              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </select>

            <button
              style={{ ...paginationBtn, ...(currentPage === 1 ? paginationBtnDisabled : {}) }}
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </button>

            <button
              style={{ ...paginationBtn, ...(currentPage === 1 ? paginationBtnDisabled : {}) }}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>

            <span style={paginationPageInfo}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              style={{ ...paginationBtn, ...(currentPage === totalPages ? paginationBtnDisabled : {}) }}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>

            <button
              style={{ ...paginationBtn, ...(currentPage === totalPages ? paginationBtnDisabled : {}) }}
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </button>
          </div>
        </div>
      )}
      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>
              {editingSubAccount
                ? `Edit Mother-Account for ${activeMother?.name}`
                : `Create Mother-Account for ${activeMother?.name}`}
            </h3>
            <button style={closeBtn} onClick={resetModal}>&times;</button>

            <form onSubmit={handleAddEditSubAccount} style={{ marginTop: 20 }}>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Mother-account name"
                style={inputStyle}
                autoFocus
              />

              {/* ── DS Code lookup field ── */}
              {!editingSubAccount && (
                <div style={{ position: 'relative', marginBottom: 10 }} ref={dsTooltipRef}>
                  <label style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' }}>
                    🔍 Lookup BP Names by Mother Code:
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={dsLookupCode}
                      onChange={(e) => setDsLookupCode(e.target.value)}
                      placeholder="e.g. DS100000"
                      style={{
                        ...inputStyle,
                        marginBottom: 0,
                        flex: 1,
                        fontFamily: 'monospace',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleDsLookup(dsLookupCode);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleDsLookup(dsLookupCode)}
                      style={{
                        padding: '8px 14px',
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🔍 View
                    </button>
                  </div>

                  {/* ── Tooltip Dropdown ── */}
                  {showDsTooltip && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      zIndex: 9999,
                      maxHeight: 280,
                      overflowY: 'auto',
                      marginTop: 4,
                    }}>
                      {/* Tooltip Header */}
                      <div style={{
                        padding: '10px 14px',
                        background: '#fffbeb',
                        borderBottom: '1px solid #fde68a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>
                          📋 Mother Code: <span style={{ fontFamily: 'monospace', color: '#f59e0b' }}>{dsLookupCode}</span>
                        </span>
                        {!dsLookupLoading && (
                          <span style={{ fontSize: 11, color: '#6b7280' }}>
                            {dsLookupResults.length} BP{dsLookupResults.length !== 1 ? 's' : ''} found
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowDsTooltip(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 16,
                            color: '#6b7280',
                            padding: '0 4px',
                          }}
                        >×</button>
                      </div>

                      {/* Loading */}
                      {dsLookupLoading && (
                        <div style={{ padding: 20, textAlign: 'center', color: '#f59e0b' }}>
                          ⏳ Loading...
                        </div>
                      )}

                      {/* No results */}
                      {!dsLookupLoading && dsLookupResults.length === 0 && (
                        <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                          ❌ Walang BP found para sa <b>{dsLookupCode}</b>
                        </div>
                      )}

                      {/* Results list */}
                      {!dsLookupLoading && dsLookupResults.map((row, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, name: row.bp_name }));
                            setShowDsTooltip(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #f3f4f6',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>
                            {row.bp_name}
                          </span>
                          <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
                            {row.bp_code} · Group: {row.group_code}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" style={btnSave}>
                {editingSubAccount ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}
      {showMissingModal && (
        <div style={modalOverlay}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            width: '750px',
            maxWidth: '95vw',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>
                  🔍 Missing Mother Codes
                </h3>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                  {activeMother?.name} — {missingMotherCodes.length} missing records
                </p>
              </div>
              <button
                onClick={() => { setShowMissingModal(false); setMissingMotherCodes([]); }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 20,
                  cursor: 'pointer',
                  borderRadius: 6,
                  padding: '4px 10px',
                }}
              >
                ×
              </button>
            </div>

            {/* Info bar */}
            <div style={{
              background: '#fffbeb',
              borderBottom: '1px solid #fde68a',
              padding: '10px 24px',
              fontSize: 13,
              color: '#92400e',
            }}>
              ⚠️ Ang mga mother_code na ito ay nasa <b>Accounts_List</b> pero wala pa sa <b>sub_mother_account</b>.
              Ang <b>Mother Name</b> ay pre-filled — pwede mo i-edit bago i-create.
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                    <th style={{ ...thStyle, background: '#f59e0b', padding: '10px 12px', width: 40 }}>#</th>
                    <th style={{ ...thStyle, background: '#f59e0b', padding: '10px 12px' }}>Mother Code</th>
                    <th style={{ ...thStyle, background: '#f59e0b', padding: '10px 12px' }}>Mother Name (editable)</th>
                  </tr>
                </thead>
                <tbody>
                  {missingMotherCodes.map((item, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...tdStyle, color: '#9ca3af', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#f59e0b', fontWeight: 700 }}>
                        {item.mother_code}
                      </td>
                      <td style={{ ...tdStyle }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
                          <input
                            type="text"
                            value={item.input_name}
                            onChange={(e) => {
                              const updated = [...missingMotherCodes];
                              updated[idx].input_name = e.target.value;
                              setMissingMotherCodes(updated);
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              border: item.input_name?.trim()
                                ? '1px solid #86efac'
                                : '1px solid #fca5a5',
                              borderRadius: 6,
                              fontSize: 13,
                              background: item.input_name?.trim() ? '#f0fdf4' : '#fff1f2',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                            placeholder="Enter mother name..."
                          />

                          {/* ── 🔍 Lookup Button ── */}
                          <div style={{ position: 'relative' }}>
                            <button
                              id={`lookup-btn-${idx}`}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRowLookup(idx, item.mother_code); }}
                              style={{
                                padding: '6px 10px',
                                background: '#f59e0b',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                              title="View BP Names connected to this Mother Code"
                            >
                              🔍
                            </button>

                            {/* ── Tooltip Dropdown ── */}
                            {activeTooltipIdx === idx && (
                              <div
                                onMouseDown={(e) => e.stopPropagation()} // ✅ prevent close on click inside
                                style={{
                                  position: 'fixed',
                                  top: tooltipPos.top,
                                  left: tooltipPos.left,
                                  width: 300,
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 10,
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                                  zIndex: 999999,
                                  maxHeight: 240,
                                  overflowY: 'auto',
                                }}
                              >
                                {/* Header */}
                                <div style={{
                                  padding: '8px 12px',
                                  background: '#fffbeb',
                                  borderBottom: '1px solid #fde68a',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  position: 'sticky',
                                  top: 0,
                                  zIndex: 1,
                                }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', fontFamily: 'monospace' }}>
                                    {item.mother_code}
                                  </span>
                                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                                    {rowLookupLoading ? '⏳' : `${rowLookupResults.length} found`}
                                  </span>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => { e.stopPropagation(); setActiveTooltipIdx(null); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280' }}
                                  >×</button>
                                </div>

                                {/* Loading */}
                                {rowLookupLoading && (
                                  <div style={{ padding: 16, textAlign: 'center', color: '#f59e0b', fontSize: 13 }}>
                                    ⏳ Fetching...
                                  </div>
                                )}

                                {/* No results */}
                                {!rowLookupLoading && rowLookupResults.length === 0 && (
                                  <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                                    ❌ Walang BP found
                                  </div>
                                )}

                                {/* Results */}
                                {!rowLookupLoading && rowLookupResults.map((row, rIdx) => (
                                  <div
                                    key={rIdx}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      const updated = [...missingMotherCodes];
                                      updated[idx].input_name = row.bp_name;
                                      setMissingMotherCodes(updated);
                                      setActiveTooltipIdx(null);
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      borderBottom: '1px solid #f3f4f6',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                  >
                                    <div style={{ fontWeight: 600, color: '#1f2937' }}>{row.bp_name}</div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{row.bp_code}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f9fafb',
            }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                ✅ Ready to create: <b style={{ color: '#16a34a' }}>
                  {missingMotherCodes.filter(m => m.input_name?.trim()).length}
                </b> / {missingMotherCodes.length}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setShowMissingModal(false); setMissingMotherCodes([]); }}
                  style={{
                    padding: '8px 16px',
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMissing}
                  disabled={creatingMissing || missingMotherCodes.filter(m => m.input_name?.trim()).length === 0}
                  style={{
                    padding: '8px 20px',
                    background: creatingMissing ? '#9ca3af' : '#f59e0b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: creatingMissing ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {creatingMissing ? 'Creating...' : `✅ Create ${missingMotherCodes.filter(m => m.input_name?.trim()).length} Records`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MotherAccountPage;

// --- Styles ---
const cardContainer = {
  display: "flex",
  flexWrap: "wrap",
  gap: "20px",
  justifyContent: "center",
};

const cardStyle = {
  flex: "0 0 220px",
  borderRadius: 12,
  background: "#f9f9f9",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  transition: "transform 0.2s, box-shadow 0.2s",
  overflow: "hidden",
};

const cardHeader = {
  background: "linear-gradient(135deg, #0087c5, #00b0ff)",
  padding: "15px",
  textAlign: "center",
};

const cardBody = {
  padding: "15px",
  textAlign: "center",
};

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 4,
  border: "1px solid #ccc",
  marginBottom: 10,
};

const btnSave = {
  padding: "6px 12px",
  background: "#28a745",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalContent = {
  background: "#fff",
  padding: 20,
  borderRadius: 8,
  width: "400px",
  position: "relative",
};

const closeBtn = {
  position: "absolute",
  top: 10,
  right: 10,
  fontSize: 20,
  background: "transparent",
  border: "none",
  cursor: "pointer",
};

const tabPanel = {
  marginTop: 20,
  padding: 15,
  border: "1px solid #ccc",
  borderRadius: 8,
  background: "#fff",
  overflowX: "auto",
};

const btnBack = {
  padding: "6px 12px",
  background: "#555",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  marginBottom: 10,
};

const responsiveTableWrapper = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 700,
};

const thStyle = {
  padding: 10,
  textAlign: "left",
  background: "#0087c5",
  color: "#fff",
  fontSize: 14,
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #ddd",
  fontSize: 13,
};

const trResponsive = {
  background: "#fafafa",
};

const btnAdd = {
  padding: "6px 12px",
  background: "#0087c5",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  marginBottom: 10,
};

const btnEdit = {
  padding: "4px 8px",
  background: "#ffc107",
  color: "#212529",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  marginRight: 8,
  fontSize: 12,
};

const btnDelete = {
  padding: "4px 8px",
  background: "#dc3545",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};
