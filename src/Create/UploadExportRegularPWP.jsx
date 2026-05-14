import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { CSVLink } from "react-csv";
import * as XLSX from 'xlsx';
const PAGE_SIZE = 10;

const UploadExportRegularPWP = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [filterToday, setFilterToday] = useState(false);
    const [filterApproved, setFilterApproved] = useState(false);
    const [distributorMap, setDistributorMap] = useState({});
    const [approvalMap, setApprovalMap] = useState({});
    const [activityMap, setActivityMap] = useState({});
    const [userMap, setUserMap] = useState({});
    const [allRecords, setAllRecords] = useState([]);
    const [exportData, setExportData] = useState([]); // 🆕 Separate state for export data
    const [isPreparingExport, setIsPreparingExport] = useState(false); // 🆕 Loading state for export
    const [totalRecordsCount, setTotalRecordsCount] = useState(0); // 🆕 Total records fetched
    const [approvedRecordsCount, setApprovedRecordsCount] = useState(0); // 🆕 Approved records count

    // New date filter states
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [exportHistory, setExportHistory] = useState(null); // { dateFrom, dateTo, exportedCodes: [], exportedAt }
    const [exportedCodesSet, setExportedCodesSet] = useState(new Set());
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [allExportHistory, setAllExportHistory] = useState([]);

    const fetchAllExportHistory = async () => {
        try {
            const { data, error } = await supabase
                .from("export_history")
                .select("*")
                .order("exported_at", { ascending: false })
                .limit(20);

            if (error || !data) return;
            setAllExportHistory(data);
        } catch (err) {
            console.error("❌ Error fetching export history:", err);
        }
    };
    // Load last export history on mount
    const loadExportHistory = async () => {
        try {


            const { data, error } = await supabase
                .from("export_history")
                .select("*")
                .order("exported_at", { ascending: false })
                .limit(1)
                .single();

            if (error || !data) return;

            const supabaseHistory = {
                dateFrom: data.date_from,
                dateTo: data.date_to,
                exportedCodes: data.pwp_codes || [],
                exportedAt: data.exported_at,
                totalRecords: data.total_records,
            };

            // Use Supabase data (more authoritative)
            setExportHistory(supabaseHistory);
            setExportedCodesSet(new Set(supabaseHistory.exportedCodes));

            // Sync to localStorage

        } catch (err) {
            console.error("❌ Error loading export history:", err);
        }
    };

    const saveExportHistory = async (dateFrom, dateTo, exportedCodes) => {
        try {
            const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
            const exportedBy = currentUser?.name || "Unknown";

            const historyData = {
                dateFrom,
                dateTo,
                exportedCodes,
                exportedAt: new Date().toISOString(),
                totalRecords: exportedCodes.length,
            };

            setExportHistory(historyData);
            setExportedCodesSet(new Set(exportedCodes));

            // 2️⃣ Save to Supabase
            const { error } = await supabase
                .from("export_history")
                .insert([{
                    date_from: dateFrom,
                    date_to: dateTo,
                    pwp_codes: exportedCodes,
                    exported_by: exportedBy,
                    total_records: exportedCodes.length,
                }]);

            if (error) {
                console.error("❌ Error saving export history to Supabase:", error);
            } else {
                console.log("✅ Export history saved!");
            }

        } catch (err) {
            console.error("❌ Error saving export history:", err);
        }
    };
    const handlePageSizeChange = (e) => {
        setPageSize(Number(e.target.value));
        setPage(1);
    };

    const handleFirst = () => setPage(1);
    const handleLast = () => setPage(totalPages);

    // 🆕 NEW FUNCTION - Separate Customer List Export
    const fetchAllRecordsForSeparateExport = async () => {
        setIsPreparingExport(true);

        try {
            // ✅ Helper function - YYYYMMDD format (e.g. 20251109)
            const formatDate = (dateStr) => {
                if (!dateStr) return "";
                const d = new Date(dateStr);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}${mm}${dd}`;
            };

            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            console.log("🔄 Starting to fetch ALL records for SEPARATE export...");

            // STEP 1: Fetch all regular_pwp records
            while (hasMore) {
                let query = supabase
                    .from("regular_pwp")
                    .select("*", { count: 'exact' })
                    .order("created_at", { ascending: false })
                    .range(offset, offset + batchSize - 1);

                const { data, error } = await query;

                if (error) {
                    console.error("❌ Error fetching batch:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            console.log(`📊 Total PWP records fetched: ${allData.length}`);

            // Filter APPROVED only
            // Filter APPROVED only
            let filteredData = allData.filter(r => approvalMap[r.regularpwpcode]);
            console.log(`✅ Approved records: ${filteredData.length}`);

            // ✅ Filter by date range if set
            if (dateFrom || dateTo) {
                filteredData = filteredData.filter(r => {
                    const activityFrom = r.activityDurationFrom ? new Date(r.activityDurationFrom) : null;
                    const activityTo = r.activityDurationTo ? new Date(r.activityDurationTo) : null;
                    const filterFromDate = dateFrom ? new Date(dateFrom) : null;
                    const filterToDate = dateTo ? new Date(dateTo) : null;

                    if (filterFromDate && filterToDate) {
                        // ✅ activityDurationFrom must be EXACTLY within the selected date range
                        return activityFrom &&
                            activityFrom >= filterFromDate &&
                            activityFrom <= filterToDate;
                    }
                    if (filterFromDate && !filterToDate) {
                        return activityTo && activityTo >= filterFromDate;
                    }
                    if (!filterFromDate && filterToDate) {
                        return activityFrom && activityFrom <= filterToDate;
                    }
                    return true;
                });
                console.log(`📅 After date filter: ${filteredData.length} records`);
            }

            // STEP 2: Fetch account budget data (regular_accountlis_badget)
            console.log("🔄 Fetching account budget data...");
            let accountBudgetMap = {};
            let budgetOffset = 0;
            let hasBudgetMore = true;

            while (hasBudgetMore) {
                const { data: budgetData, error: budgetError } = await supabase
                    .from("regular_accountlis_badget")
                    .select("regularcode, account_name, budget")
                    .range(budgetOffset, budgetOffset + batchSize - 1);

                if (budgetError) {
                    console.error("❌ Error fetching budget data:", budgetError);
                    break;
                }

                if (budgetData && budgetData.length > 0) {
                    budgetData.forEach(b => {
                        if (!accountBudgetMap[b.regularcode]) {
                            accountBudgetMap[b.regularcode] = {};
                        }
                        accountBudgetMap[b.regularcode][b.account_name] = parseFloat(b.budget || 0);
                    });
                    budgetOffset += batchSize;
                    hasBudgetMore = budgetData.length === batchSize;
                } else {
                    hasBudgetMore = false;
                }
            }

            console.log(`✅ Account budget map loaded for ${Object.keys(accountBudgetMap).length} codes`);

            // STEP 3: Fetch SKU data (regular_sku)
            console.log("🔄 Fetching SKU data...");
            let skuMap = {};
            let skuOffset = 0;
            let hasSkuMore = true;

            while (hasSkuMore) {
                const { data: skuData, error: skuError } = await supabase
                    .from("regular_sku")
                    .select("regular_code, account_name, total_amount")
                    .range(skuOffset, skuOffset + batchSize - 1);

                if (skuError) {
                    console.error("❌ Error fetching SKU data:", skuError);
                    break;
                }

                if (skuData && skuData.length > 0) {
                    skuData.forEach(s => {
                        if (!skuMap[s.regular_code]) {
                            skuMap[s.regular_code] = {};
                        }
                        if (!skuMap[s.regular_code][s.account_name]) {
                            skuMap[s.regular_code][s.account_name] = 0;
                        }
                        skuMap[s.regular_code][s.account_name] += parseFloat(s.total_amount || 0);
                    });
                    skuOffset += batchSize;
                    hasSkuMore = skuData.length === batchSize;
                } else {
                    hasSkuMore = false;
                }
            }

            console.log(`✅ SKU map loaded for ${Object.keys(skuMap).length} codes`);

            // STEP 4: Create separated data with proper budget splitting
            const separatedData = [];

            filteredData.forEach((r) => {
                const cleanText = (text) =>
                    text
                        ? `"${String(text)
                            .replace(/"/g, '""')
                            .replace(/,/g, " ")
                            .replace(/[\r\n]+/g, " ")
                            .replace(/\s+/g, " ")
                            .trim()}"`
                        : "";

                // Parse customer list (branchType)
                let customerList = [];

                if (r.branchType) {
                    try {
                        const parsed = JSON.parse(r.branchType);
                        if (Array.isArray(parsed)) {
                            customerList = parsed;
                        } else {
                            customerList = [r.branchType];
                        }
                    } catch {
                        customerList = r.branchType
                            .split(/[\n,;]/)
                            .map(c => c.trim())
                            .filter(c => c.length > 0);

                        if (customerList.length === 0) {
                            customerList = [r.branchType];
                        }
                    }
                } else {
                    customerList = ["-"];
                }

                // 🔥 CREATE SEPARATE ROW FOR EACH CUSTOMER WITH CORRECT BUDGET
                customerList.forEach(customer => {
                    let priceVatExt = r.credit_budget || 0;

                    const accountBudgets = accountBudgetMap[r.regularpwpcode];
                    const skuBudgets = skuMap[r.regularpwpcode];


                    if (skuBudgets && skuBudgets[customer]) {
                        priceVatExt = skuBudgets[customer];
                        console.log(`💰 SKU budget for ${r.regularpwpcode} - ${customer}: ${priceVatExt}`);
                    } else if (accountBudgets && accountBudgets[customer]) {
                        priceVatExt = accountBudgets[customer];
                        console.log(`💰 Account budget for ${r.regularpwpcode} - ${customer}: ${priceVatExt}`);
                    } else {
                        if (customerList.length > 1) {
                            priceVatExt = parseFloat(r.credit_budget || 0) / customerList.length;
                            console.log(`⚠️ No budget breakdown for ${r.regularpwpcode} - ${customer}, dividing equally: ${priceVatExt}`);
                        }
                    }

                    separatedData.push({
                        "Purchase Order": r.regularpwpcode,
                        "Vendor Name": cleanText(distributorMap[r.distributor]?.name || r.distributor),
                        "SAP Vendor Code": distributorMap[r.distributor]?.sap_vendor_code ?? "",
                        "Suppliers Ref. No.": r.regularpwpcode,
                        "Posting Date": formatDate(approvalMap[r.regularpwpcode]),
                        "PO Date": formatDate(r.created_at),
                        "Remarks (UDF)": cleanText(`${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`),
                        "Buyer": cleanText(userMap[r.createForm] || r.createForm),
                        "Prepared By": cleanText(userMap[r.createForm] || r.createForm),
                        "SLP": distributorMap[r.distributor]?.slp ?? "",
                        "Vendor": r.distributor,
                        "(01)Description": cleanText(activityMap[r.activity]?.name || r.activity),
                        "(02)Account Code": cleanText(activityMap[r.activity]?.glcode || ""),
                        "(06)Price VAT-EXt": parseFloat(priceVatExt).toFixed(2),
                        "Customer List": cleanText(customer),
                        "Start Date": formatDate(r.activityDurationFrom),
                        "End Date": formatDate(r.activityDurationTo),
                    });
                });
            });

            console.log(`🎯 SEPARATED: ${separatedData.length} rows (from ${filteredData.length} approved records)`);

            // Budget validation
            const totalOriginal = filteredData.reduce((sum, r) => sum + parseFloat(r.credit_budget || 0), 0);
            const totalSeparated = separatedData.reduce((sum, row) => sum + parseFloat(row["(06)Price VAT-EXt"]), 0);
            console.log(`💵 Budget verification:`);
            console.log(`   Original total: ₱${totalOriginal.toFixed(2)}`);
            console.log(`   Separated total: ₱${totalSeparated.toFixed(2)}`);
            console.log(`   Difference: ₱${Math.abs(totalOriginal - totalSeparated).toFixed(2)}`);

            // Download as XLSX
            // Download as XLSX
            const worksheet = XLSX.utils.json_to_sheet(separatedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Separated");
            XLSX.writeFile(workbook, `regular_pwp_separated_${formatDate(new Date().toISOString())}.xlsx`);

            // ✅ Save export history
            const exportedCodes = filteredData.map(r => r.regularpwpcode);

            await saveExportHistory(dateFrom, dateTo, exportedCodes);

            console.log("✅ Export completed successfully!");

        } catch (error) {
            console.error("❌ Error:", error);
        } finally {
            setIsPreparingExport(false);
        }
    };

    // 🔥 NEW: Fetch ALL records with batch processing (bypassing 1000 limit)
    // EXPORT RULE: Export ALL APPROVED records from database
    // - Ignores search filter
    // - Ignores today filter
    // - Ignores date range filter
    // - Only exports APPROVED records (has approval date)
    const fetchAllRecordsForExport = async () => {
        setIsPreparingExport(true);

        try {
            // ✅ Helper function - YYYYMMDD format (e.g. 20251109)
            const formatDate = (dateStr) => {
                if (!dateStr) return "";
                const d = new Date(dateStr);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}${mm}${dd}`;
            };

            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            console.log("🔄 Starting to fetch ALL records for export...");
            console.log("📋 Export will include ALL approved records (ignoring view filters)");

            while (hasMore) {
                console.log(`📥 Fetching batch: records ${offset} to ${offset + batchSize - 1}`);

                let query = supabase
                    .from("regular_pwp")
                    .select("*", { count: 'exact' })
                    .order("created_at", { ascending: false })
                    .range(offset, offset + batchSize - 1);

                const { data, error } = await query;

                if (error) {
                    console.error("❌ Error fetching batch:", error);
                    break;
                }

                if (data && data.length > 0) {
                    console.log(`✅ Fetched ${data.length} records`);
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    console.log("🏁 No more data to fetch");
                    hasMore = false;
                }
            }

            console.log(`📊 Total records fetched: ${allData.length}`);
            setTotalRecordsCount(allData.length);

            // 🔥 FILTER: Only APPROVED records (must have approval date)
            // 🔥 FILTER: Only APPROVED records (must have approval date)
            let filteredData = allData.filter(r => approvalMap[r.regularpwpcode]);
            console.log(`✅ Approved records: ${filteredData.length} out of ${allData.length}`);

            // ✅ Filter by date range if set
            if (dateFrom || dateTo) {
                filteredData = filteredData.filter(r => {
                    const activityFrom = r.activityDurationFrom ? new Date(r.activityDurationFrom) : null;
                    const activityTo = r.activityDurationTo ? new Date(r.activityDurationTo) : null;
                    const filterFromDate = dateFrom ? new Date(dateFrom) : null;
                    const filterToDate = dateTo ? new Date(dateTo) : null;

                    if (filterFromDate && filterToDate) {
                        // ✅ activityDurationFrom must be EXACTLY within the selected date range
                        return activityFrom &&
                            activityFrom >= filterFromDate &&
                            activityFrom <= filterToDate;
                    }
                    if (filterFromDate && !filterToDate) {
                        return activityTo && activityTo >= filterFromDate;
                    }
                    if (!filterFromDate && filterToDate) {
                        return activityFrom && activityFrom <= filterToDate;
                    }
                    return true;
                });
                console.log(`📅 After date filter: ${filteredData.length} records`);
            }

            setApprovedRecordsCount(filteredData.length);
            console.log(`🎯 FINAL: ${filteredData.length} approved records ready for export`);

            // Prepare export data
            const csvData = filteredData.map((r) => {
                const cleanText = (text) =>
                    text
                        ? `"${String(text)
                            .replace(/"/g, '""')
                            .replace(/,/g, " ")
                            .replace(/[\r\n]+/g, " ")
                            .replace(/\s+/g, " ")
                            .trim()}"`
                        : "";

                return {
                    "Purchase Order": r.regularpwpcode,
                    "Vendor Name": cleanText(distributorMap[r.distributor]?.name || r.distributor),
                    "SAP Vendor Code": distributorMap[r.distributor]?.sap_vendor_code ?? "",
                    "Suppliers Ref. No.": r.regularpwpcode,
                    "Posting Date": formatDate(approvalMap[r.regularpwpcode]),
                    "PO Date": formatDate(r.created_at),
                    "Remarks (UDF)": cleanText(`${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`),
                    "Buyer": cleanText(userMap[r.createForm] || r.createForm),
                    "Prepared By": cleanText(userMap[r.createForm] || r.createForm),
                    "SLP": distributorMap[r.distributor]?.slp ?? "",
                    "Vendor": r.distributor,
                    "(01)Description": cleanText(activityMap[r.activity]?.name || r.activity),
                    "(02)Account Code": cleanText(activityMap[r.activity]?.glcode || ""),
                    "(06)Price VAT-EXt": r.credit_budget,
                    "Customer List": cleanText(r.branchType || ""),
                    "Start Date": formatDate(r.activityDurationFrom),
                    "End Date": formatDate(r.activityDurationTo),
                };
            });

            setExportData(csvData);

        } catch (error) {
            console.error("❌ Error fetching all records:", error);
        } finally {
            setIsPreparingExport(false);
        }
    };

    // 🔥 FIXED SEARCH FUNCTION
    const fetchRecords = async () => {
        setLoading(true);

        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            console.log("🚀 Starting to fetch all records...");

            while (hasMore) {
                let query = supabase
                    .from("regular_pwp")
                    .select("*", { count: "exact" })
                    .order("created_at", { ascending: false })
                    .range(offset, offset + batchSize - 1);

                // Apply "today" filter
                if (filterToday) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    query = query
                        .gte("created_at", today.toISOString())
                        .lt("created_at", tomorrow.toISOString());
                }

                const { data, error } = await query;

                if (error) {
                    console.error("❌ Error fetching batch:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            console.log(`📊 Total records fetched: ${allData.length}`);

            // 🔍 CLIENT-SIDE FILTERING
            let filteredData = allData;

            // 🔥 FIXED SEARCH: Now searches PWP Code, Activity, Distributor Name, and Branch
            if (search) {
                const searchLower = search.toLowerCase();
                filteredData = filteredData.filter(r => {
                    const pwpCode = (r.regularpwpcode || '').toString().toLowerCase();
                    const activityName = (activityMap[r.activity]?.name || '').toString().toLowerCase();
                    const activityCode = (r.activity || '').toString().toLowerCase();
                    const distributorCode = (r.distributor || '').toString().toLowerCase();
                    // ✅ UPDATED: .name
                    const distributorName = (distributorMap[r.distributor]?.name || '').toString().toLowerCase();
                    const branch = (r.branchType || '').toString().toLowerCase();
                    const objective = (r.objective || '').toString().toLowerCase();
                    const promoScheme = (r.promoScheme || '').toString().toLowerCase();
                    // ✅ DAGDAG: search by sap_vendor_code
                    const sapVendorCode = (distributorMap[r.distributor]?.sap_vendor_code || '').toString().toLowerCase();

                    return (
                        pwpCode.includes(searchLower) ||
                        activityName.includes(searchLower) ||
                        activityCode.includes(searchLower) ||
                        distributorCode.includes(searchLower) ||
                        distributorName.includes(searchLower) ||
                        branch.includes(searchLower) ||
                        objective.includes(searchLower) ||
                        promoScheme.includes(searchLower) ||
                        sapVendorCode.includes(searchLower)
                    );
                });
                console.log(`🔍 Search for "${search}": ${filteredData.length} results found`);
            }

            // Filter by approval
            if (filterApproved) {
                filteredData = filteredData.filter(r => approvalMap[r.regularpwpcode]);
                console.log(`✓ Approved filter: ${filteredData.length} results`);
            }

            // Filter by date range (Activity Duration)
            if (dateFrom || dateTo) {
                filteredData = filteredData.filter(r => {
                    const activityFrom = r.activityDurationFrom ? new Date(r.activityDurationFrom) : null;
                    const activityTo = r.activityDurationTo ? new Date(r.activityDurationTo) : null;

                    if (!activityFrom && !activityTo) return false;

                    const filterFromDate = dateFrom ? new Date(dateFrom) : null;
                    const filterToDate = dateTo ? new Date(dateTo) : null;

                    if (filterFromDate && filterToDate) {
                        // ✅ activityDurationFrom must be EXACTLY within the selected date range
                        return activityFrom &&
                            activityFrom >= filterFromDate &&
                            activityFrom <= filterToDate;
                    }

                    if (filterFromDate && !filterToDate) {
                        return activityTo && activityTo >= filterFromDate;
                    }

                    if (!filterFromDate && filterToDate) {
                        return activityFrom && activityFrom <= filterToDate;
                    }

                    return true;
                });
                console.log(`📅 Date filter: ${filteredData.length} results`);
            }

            console.log(`✅ Total filtered records: ${filteredData.length}`);

            setAllRecords(filteredData);

            // Paginated view
            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            setRecords(filteredData.slice(start, end));
            setTotalPages(Math.ceil(filteredData.length / pageSize) || 1);

        } catch (err) {
            console.error("❌ Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDistributors = async () => {
        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            console.log("🚀 Starting to fetch all distributors...");

            while (hasMore) {
                const { data, error } = await supabase
                    .from("distributors")
                    // ✅ DAGDAG: slp, sap_vendor_code
                    .select("code, name, slp, sap_vendor_code")
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error("❌ Error fetching distributors batch:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                    console.log(`📊 Total distributors so far: ${allData.length}`);
                } else {
                    hasMore = false;
                    console.log("🏁 Finished fetching all distributors");
                }
            }

            // ✅ UPDATED: store as object { name, slp, sap_vendor_code }
            const map = {};
            allData.forEach(d => {
                map[d.code] = { name: d.name, slp: d.slp, sap_vendor_code: d.sap_vendor_code };
            });
            setDistributorMap(map);

            console.log(`✅ Total distributors loaded: ${allData.length}`);

        } catch (err) {
            console.error("❌ Unexpected error fetching distributors:", err);
        }
    };

    const fetchApprovals = async () => {
        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            console.log("🚀 Starting to fetch all approvals...");

            while (hasMore) {
                const { data, error } = await supabase
                    .from("Approval_History")
                    .select("PwpCode, DateResponded")
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error("❌ Error fetching approvals batch:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                    console.log(`📊 Total approvals so far: ${allData.length}`);
                } else {
                    hasMore = false;
                    console.log("🏁 Finished fetching all approvals");
                }
            }

            // Create map from all fetched data (keep latest DateResponded per PwpCode)
            const map = {};
            allData.forEach(a => {
                if (!map[a.PwpCode] || new Date(a.DateResponded) > new Date(map[a.PwpCode])) {
                    map[a.PwpCode] = a.DateResponded;
                }
            });
            setApprovalMap(map);

            console.log(`✅ Total approvals loaded: ${allData.length}`);

        } catch (err) {
            console.error("❌ Unexpected error fetching approvals:", err);
        }
    };

    const fetchActivities = async () => {
        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            console.log("🚀 Starting to fetch all activities...");

            while (hasMore) {
                const { data, error } = await supabase
                    .from("activity")
                    .select("code, name, glcode")
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error("❌ Error fetching activities batch:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                    console.log(`📊 Total activities so far: ${allData.length}`);
                } else {
                    hasMore = false;
                    console.log("🏁 Finished fetching all activities");
                }
            }

            // Create map from all fetched data
            const map = {};
            allData.forEach(a => {
                map[a.code] = {
                    name: a.name,
                    glcode: a.glcode
                };
            });
            setActivityMap(map);

            console.log(`✅ Total activities loaded: ${allData.length}`);

        } catch (err) {
            console.error("❌ Unexpected error fetching activities:", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            console.log("🚀 Starting to fetch all users...");

            while (hasMore) {
                const { data, error } = await supabase
                    .from("Account_Users")
                    .select("UserID, name")
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error("❌ Error fetching users batch:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                    console.log(`📊 Total users so far: ${allData.length}`);
                } else {
                    hasMore = false;
                    console.log("🏁 Finished fetching all users");
                }
            }

            // Create map from all fetched data
            const map = {};
            allData.forEach(u => {
                map[u.UserID] = u.name || '';
            });
            setUserMap(map);

            console.log(`✅ Total users loaded: ${allData.length}`);

        } catch (err) {
            console.error("❌ Unexpected error fetching users:", err);
        }
    };

    useEffect(() => {
        fetchDistributors();
        fetchApprovals();
        fetchActivities();
        fetchUsers();
        loadExportHistory();
    }, []);

    useEffect(() => {
        // ✅ Hintayin muna na ma-load yung maps bago mag-fetch
        if (Object.keys(distributorMap).length > 0 && Object.keys(activityMap).length > 0) {
            fetchRecords();
        }
    }, [page, search, filterToday, filterApproved, approvalMap, distributorMap, activityMap, pageSize, dateFrom, dateTo]);

    // 🔥 Fetch export data ONCE when all maps are loaded
    // Export is INDEPENDENT of view filters - it always exports ALL approved records
    useEffect(() => {
        if (Object.keys(approvalMap).length > 0 &&
            Object.keys(distributorMap).length > 0 &&
            Object.keys(activityMap).length > 0 &&
            Object.keys(userMap).length > 0) {
            fetchAllRecordsForExport();
        }
    }, [approvalMap, distributorMap, activityMap, userMap, dateFrom, dateTo]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handlePrev = () => {
        if (page > 1) setPage(page - 1);
    };

    const handleNext = () => {
        if (page < totalPages) setPage(page + 1);
    };

    const clearDateFilters = () => {
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    return (
        <div style={{
            width: "100%",
            padding: "30px",
            boxSizing: "border-box",
            backgroundColor: "#f0f2f5",
            minHeight: "100vh"
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: "white",
                padding: "25px",
                borderRadius: "12px",
                marginBottom: "25px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
            }}>
                <h2 style={{
                    margin: "0 0 20px 0",
                    color: "#1a202c",
                    fontSize: "28px",
                    fontWeight: "700"
                }}>
                    Regular PWP Records
                </h2>

                {/* Search and Filters */}
                <div style={{
                    display: "flex",
                    gap: "15px",
                    marginBottom: "20px",
                    flexWrap: "wrap",
                    alignItems: "center"
                }}>
                    <div style={{ position: "relative", flexGrow: 1, minWidth: "250px" }}>
                        <span style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#718096",
                            fontSize: "18px"
                        }}>
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Search PWP Code, Activity, Distributor, Branch..."
                            value={search}
                            onChange={handleSearch}
                            style={{
                                padding: "12px 12px 12px 45px",
                                borderRadius: "8px",
                                border: "2px solid #e2e8f0",
                                width: "100%",
                                fontSize: "14px",
                                transition: "all 0.3s",
                                outline: "none"
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#3182ce"}
                            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                        />
                    </div>

                    {/* Filter Buttons */}
                    <button
                        onClick={() => {
                            setFilterToday(!filterToday);
                            setPage(1);
                        }}
                        style={{
                            padding: "12px 20px",
                            borderRadius: "8px",
                            border: "2px solid",
                            borderColor: filterToday ? "#3182ce" : "#e2e8f0",
                            backgroundColor: filterToday ? "#ebf8ff" : "white",
                            color: filterToday ? "#2c5282" : "#4a5568",
                            cursor: "pointer",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.3s",
                            fontSize: "14px"
                        }}
                    >
                        Today
                    </button>

                    <button
                        onClick={() => {
                            setFilterApproved(!filterApproved);
                            setPage(1);
                        }}
                        style={{
                            padding: "12px 20px",
                            borderRadius: "8px",
                            border: "2px solid",
                            borderColor: filterApproved ? "#38a169" : "#e2e8f0",
                            backgroundColor: filterApproved ? "#f0fff4" : "white",
                            color: filterApproved ? "#22543d" : "#4a5568",
                            cursor: "pointer",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.3s",
                            fontSize: "14px"
                        }}
                    >
                        ✓ Approved
                    </button>

                    {/* 🔥 EXPORT BUTTON - Only exports APPROVED records with date filters */}
                    <CSVLink
                        data={exportData}
                        filename={`regular_pwp_approved_${new Date().toISOString().split('T')[0]}.csv`}
                        onClick={async () => {
                            if (exportData.length === 0) return;
                            const exportedCodes = exportData.map(r => r["Purchase Order"]);
                            await saveExportHistory(dateFrom, dateTo, exportedCodes);
                        }}
                        style={{
                            padding: "12px 24px",
                            border: "none",
                            borderRadius: "8px",
                            cursor: isPreparingExport ? "wait" : "pointer",
                            backgroundColor: isPreparingExport ? "#94a3b8" : "#10b981",
                            color: "white",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            textDecoration: "none",
                            transition: "all 0.3s",
                            fontSize: "14px",
                            opacity: isPreparingExport ? 0.7 : 1,
                            pointerEvents: isPreparingExport ? "none" : "auto"
                        }}
                    >
                        {isPreparingExport ? "⏳ Preparing..." : "📥 Export Approved CSV"}
                    </CSVLink>

                    {/* 🆕 NEW EXPORT BUTTON - Separate Customer List */}
                    <button
                        onClick={fetchAllRecordsForSeparateExport}
                        disabled={isPreparingExport}
                        style={{
                            padding: "12px 24px",
                            border: "none",
                            borderRadius: "8px",
                            cursor: isPreparingExport ? "wait" : "pointer",
                            backgroundColor: isPreparingExport ? "#94a3b8" : "#8b5cf6",
                            color: "white",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.3s",
                            fontSize: "14px",
                            opacity: isPreparingExport ? 0.7 : 1
                        }}
                    >
                        {isPreparingExport ? "⏳ Preparing..." : "📋 Export Separate Customer List"}
                    </button>

                    {/* Export Info Badge - Shows Total and Approved counts */}
                    {totalRecordsCount > 0 && (
                        <div style={{
                            padding: "8px 16px",
                            backgroundColor: isPreparingExport ? "#fef3c7" : "#f0fdf4",
                            color: isPreparingExport ? "#92400e" : "#166534",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: "600",
                            border: `2px solid ${isPreparingExport ? "#fcd34d" : "#86efac"}`,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.3s"
                        }}>
                            {isPreparingExport ? (
                                <>
                                    <span style={{ animation: "spin 1s linear infinite" }}>⏳</span>
                                    <span>Fetching all data...</span>
                                </>
                            ) : (
                                <>
                                    <span style={{
                                        backgroundColor: "#dbeafe",
                                        color: "#1e40af",
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        fontWeight: "700",
                                        fontSize: "12px"
                                    }}>
                                        All PWP: {totalRecordsCount.toLocaleString()}
                                    </span>
                                    <span style={{ color: "#64748b", fontWeight: "500" }}>→</span>
                                    <span style={{
                                        backgroundColor: "#d1fae5",
                                        color: "#065f46",
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        fontWeight: "700",
                                        fontSize: "12px"
                                    }}>
                                        ✓ {approvedRecordsCount.toLocaleString()} Approved Ready
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Date Range Filter */}
                <div style={{
                    display: "flex",
                    gap: "15px",
                    marginBottom: "15px",
                    flexWrap: "wrap",
                    alignItems: "center",
                    padding: "15px",
                    backgroundColor: "#f7fafc",
                    borderRadius: "8px",
                    border: "2px solid #e2e8f0"
                }}>
                    <span style={{
                        fontWeight: "600",
                        color: "#2d3748",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }}>
                        📆 Activity Duration Filter:
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "13px", color: "#4a5568", fontWeight: "500" }}>From:</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setPage(1);
                            }}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "6px",
                                border: "2px solid #e2e8f0",
                                fontSize: "13px",
                                outline: "none",
                                cursor: "pointer"
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "13px", color: "#4a5568", fontWeight: "500" }}>To:</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setPage(1);
                            }}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "6px",
                                border: "2px solid #e2e8f0",
                                fontSize: "13px",
                                outline: "none",
                                cursor: "pointer"
                            }}
                        />
                    </div>

                    {(dateFrom || dateTo) && (
                        <button
                            onClick={clearDateFilters}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "6px",
                                border: "none",
                                backgroundColor: "#e53e3e",
                                color: "white",
                                fontSize: "13px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.3s"
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = "#c53030"}
                            onMouseLeave={(e) => e.target.style.backgroundColor = "#e53e3e"}
                        >
                            ✕ Clear Dates
                        </button>
                    )}
                </div>
                {/* Last Export Info */}
                {exportHistory && (
                    <div style={{
                        marginTop: "12px",
                        padding: "12px 16px",
                        backgroundColor: "#fefce8",
                        border: "2px solid #facc15",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        fontSize: "13px",
                    }}>
                        <span style={{ fontSize: "18px" }}>📤</span>
                        <span style={{ fontWeight: "700", color: "#854d0e" }}>Last Export:</span>
                        <span style={{
                            backgroundColor: "#fde68a",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            fontWeight: "600",
                            color: "#78350f"
                        }}>
                            {exportHistory.dateFrom
                                ? `${exportHistory.dateFrom} → ${exportHistory.dateTo || "N/A"}`
                                : "All Records"}
                        </span>
                        <span style={{ color: "#92400e" }}>
                            {exportHistory.totalRecords} records exported
                        </span>
                        <span style={{ color: "#a16207", fontSize: "12px" }}>
                            exported on {new Date(exportHistory.exportedAt).toLocaleString()}
                        </span>
                        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{
                                padding: "3px 10px",
                                backgroundColor: "#fef08a",
                                borderRadius: "6px",
                                color: "#854d0e",
                                fontWeight: "600",
                                fontSize: "12px"
                            }}>
                                🟡 Yellow rows = included in last export
                            </span>
                            <button
                                onClick={() => {
                                    fetchAllExportHistory();
                                    setShowHistoryModal(true);
                                }}
                                style={{
                                    padding: "4px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: "#854d0e",
                                    color: "white",
                                    fontWeight: "600",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                }}
                            >
                                📋 View History
                            </button>
                        </div>
                    </div>
                )}
                {/* Active Filters Display */}
                {(filterToday || filterApproved || dateFrom || dateTo) && (
                    <div style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        fontSize: "13px",
                        color: "#4a5568"
                    }}>
                        <span style={{ fontSize: "16px" }}>🔽</span>
                        <span style={{ fontWeight: "600" }}>Active Filters:</span>
                        {filterToday && (
                            <span style={{
                                padding: "4px 12px",
                                backgroundColor: "#ebf8ff",
                                color: "#2c5282",
                                borderRadius: "6px",
                                fontWeight: "500"
                            }}>
                                Today
                            </span>
                        )}
                        {filterApproved && (
                            <span style={{
                                padding: "4px 12px",
                                backgroundColor: "#f0fff4",
                                color: "#22543d",
                                borderRadius: "6px",
                                fontWeight: "500"
                            }}>
                                Approved
                            </span>
                        )}
                        {(dateFrom || dateTo) && (
                            <span style={{
                                padding: "4px 12px",
                                backgroundColor: "#fef5e7",
                                color: "#744210",
                                borderRadius: "6px",
                                fontWeight: "500"
                            }}>
                                Date Range: {dateFrom || "Start"} → {dateTo || "End"}
                            </span>
                        )}
                    </div>
                )}
  </div>

            {/* Export History Modal */}
            {showHistoryModal && (
                <div style={{
                    position: "fixed",
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    zIndex: 1000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <div style={{
                        backgroundColor: "white",
                        borderRadius: "12px",
                        padding: "24px",
                        width: "700px",
                        maxHeight: "80vh",
                        overflowY: "auto",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "20px",
                        }}>
                            <h3 style={{ margin: 0, color: "#1a202c" }}>📋 Export History</h3>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                style={{
                                    border: "none",
                                    background: "#e2e8f0",
                                    borderRadius: "6px",
                                    padding: "6px 12px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                }}
                            >
                                ✕ Close
                            </button>
                        </div>

                        {/* History List */}
                        {allExportHistory.length === 0 ? (
                            <p style={{ textAlign: "center", color: "#718096" }}>No export history found.</p>
                        ) : (
                            allExportHistory.map((h, idx) => (
                                <div
                                    key={h.id}
                                    onClick={() => {
                                        // ✅ Load this export as active highlight
                                        setExportHistory({
                                            dateFrom: h.date_from,
                                            dateTo: h.date_to,
                                            exportedAt: h.exported_at,
                                            totalRecords: h.total_records,
                                            exportedCodes: h.pwp_codes || [],
                                        });
                                        setExportedCodesSet(new Set(h.pwp_codes || []));
                                        setShowHistoryModal(false);
                                    }}
                                    style={{
                                        padding: "14px 16px",
                                        borderRadius: "8px",
                                        marginBottom: "10px",
                                        border: "2px solid",
                                        borderColor: idx === 0 ? "#facc15" : "#e2e8f0",
                                        backgroundColor: idx === 0 ? "#fefce8" : "#f7fafc",
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#edf2f7"}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx === 0 ? "#fefce8" : "#f7fafc"}
                                >
                                    <div>
                                        {idx === 0 && (
                                            <span style={{
                                                fontSize: "11px",
                                                backgroundColor: "#facc15",
                                                color: "#78350f",
                                                padding: "2px 8px",
                                                borderRadius: "4px",
                                                fontWeight: "700",
                                                marginBottom: "6px",
                                                display: "inline-block",
                                            }}>
                                                LATEST
                                            </span>
                                        )}
                                        <div style={{ fontWeight: "700", color: "#2d3748", fontSize: "15px" }}>
                                            {h.date_from && h.date_to
                                                ? `${h.date_from} → ${h.date_to}`
                                                : "All Records"}
                                        </div>
                                        <div style={{ fontSize: "13px", color: "#718096", marginTop: "4px" }}>
                                            {new Date(h.exported_at).toLocaleString()} • by {h.exported_by || "Unknown"}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{
                                            fontSize: "20px",
                                            fontWeight: "700",
                                            color: "#2d3748",
                                        }}>
                                            {(h.total_records || 0).toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#718096" }}>records</div>
                                        <div style={{
                                            marginTop: "6px",
                                            fontSize: "12px",
                                            color: "#3182ce",
                                            fontWeight: "600",
                                        }}>
                                            Click to highlight →
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div style={{
                width: "100%",
                overflowX: "auto",
                borderRadius: "12px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                backgroundColor: "#fff"
            }}>
                <table style={{
                    width: "100%",
                    minWidth: "1600px",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                    <thead>
                        <tr>
                            {[
                                "Purchase Order",
                                "Vendor Name",
                                "SAP Vendor Code",
                                "Suppliers Ref. No.",
                                "Posting Date",
                                "PO Date",
                                "Remarks (UDF)",
                                "Buyer",
                                "Prepared By",
                                "SLP",
                                "Vendor Code",
                                "Activity",
                                "Activity Code",
                                "PWP Amount",
                                "Branch",
                                "Activity Duration From",
                                "Activity Duration To",
                            ].map((col) => (
                                <th
                                    key={col}
                                    style={{
                                        backgroundColor: "#0d6efd",
                                        color: "white",
                                        padding: "16px 12px",
                                        textAlign: "left",
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 10,
                                        whiteSpace: "nowrap",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                        borderBottom: "3px solid #3182ce"
                                    }}
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={17} style={{
                                    textAlign: "center",
                                    padding: "40px",
                                    color: "#718096",
                                    fontSize: "15px"
                                }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan={17} style={{
                                    textAlign: "center",
                                    padding: "40px",
                                    color: "#718096",
                                    fontSize: "15px"
                                }}>
                                    No records found
                                </td>
                            </tr>


                        ) : (() => {
                            const isExported = (r) => {
                                if (!exportHistory) return false;
                                if (!exportHistory.dateFrom && !exportHistory.dateTo) return true;
                                if (exportHistory.dateFrom && exportHistory.dateTo) {
                                    const from = r.activityDurationFrom || "";
                                    return from >= exportHistory.dateFrom && from <= exportHistory.dateTo;
                                }
                                return false;
                            };

                            return records.map((r, idx) => (
                                <tr
                                    key={r.id}
                                    style={{
                                        backgroundColor: isExported(r) ? "#fefce8" : idx % 2 === 0 ? "#ffffff" : "#f7fafc",
                                        transition: "all 0.2s",
                                        outline: isExported(r) ? "2px solid #facc15" : "none",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#edf2f7"}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isExported(r)
                                            ? "#fefce8"
                                            : idx % 2 === 0 ? "#ffffff" : "#f7fafc";
                                    }}
                                >
                                    {/* 1. Purchase Order */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.regularpwpcode}
                                    </td>

                                    {/* 2. Vendor Name */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {distributorMap[r.distributor]?.name || r.distributor}
                                    </td>

                                    {/* 3. SAP Vendor Code */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {distributorMap[r.distributor]?.sap_vendor_code ?? "-"}
                                    </td>

                                    {/* 4. Suppliers Ref. No. */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.regularpwpcode}
                                    </td>

                                    {/* 5. Posting Date */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {approvalMap[r.regularpwpcode] ? (
                                            <span style={{
                                                padding: "4px 10px",
                                                backgroundColor: "#c6f6d5",
                                                color: "#22543d",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                fontWeight: "500"
                                            }}>
                                                {new Date(approvalMap[r.regularpwpcode]).toLocaleDateString()}
                                            </span>
                                        ) : (
                                            <span style={{
                                                padding: "4px 10px",
                                                backgroundColor: "#fed7d7",
                                                color: "#742a2a",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                fontWeight: "500"
                                            }}>
                                                N/A
                                            </span>
                                        )}
                                    </td>

                                    {/* 6. PO Date */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                                    </td>

                                    {/* 7. Remarks (UDF) - combined objective + promoScheme */}
                                    <td
                                        style={{
                                            padding: "14px 12px",
                                            fontSize: "14px",
                                            color: "#2d3748",
                                            borderBottom: "1px solid #e2e8f0",
                                            cursor: "default",
                                            position: "relative",
                                            maxWidth: "200px",
                                        }}
                                        title={`${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{
                                                display: "inline-block",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                maxWidth: "100%",
                                            }}>
                                                {(() => {
                                                    const combined = `${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`;
                                                    return combined.length > 100 ? combined.slice(0, 100) + "..." : combined || "-";
                                                })()}
                                            </span>
                                            {(`${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`).length > 100 && (
                                                <span style={{
                                                    flexShrink: 0,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: "18px",
                                                    height: "18px",
                                                    borderRadius: "50%",
                                                    backgroundColor: "#e2e8f0",
                                                    color: "#718096",
                                                    fontSize: "11px",
                                                    fontWeight: "600",
                                                    cursor: "help",
                                                }} title="Text truncated - hover to see full text">
                                                    ...
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 8. Buyer */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {userMap[r.createForm] || r.createForm}
                                    </td>

                                    {/* 9. Prepared By */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {userMap[r.createForm] || r.createForm}
                                    </td>

                                    {/* 10. SLP */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {distributorMap[r.distributor]?.slp ?? "-"}
                                    </td>

                                    {/* 11. Vendor Code */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.distributor}
                                    </td>

                                    {/* 12. Activity */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {activityMap[r.activity]?.name || r.activity}
                                    </td>

                                    {/* 13. Activity Code */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {activityMap[r.activity]?.glcode || r.activity}
                                    </td>

                                    {/* 14. PWP Amount */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        fontWeight: "600",
                                        borderBottom: "1px solid #e2e8f0",
                                    }}>
                                        ₱{r.credit_budget
                                            ? parseFloat(r.credit_budget).toLocaleString("en-PH", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })
                                            : "0.00"}
                                    </td>

                                    {/* 15. Branch */}
                                    <td
                                        style={{
                                            padding: "14px 12px",
                                            fontSize: "14px",
                                            color: "#2d3748",
                                            borderBottom: "1px solid #e2e8f0",
                                            cursor: "default",
                                            position: "relative",
                                            maxWidth: "300px",
                                        }}
                                        title={r.branchType || ""}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{
                                                display: "inline-block",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                maxWidth: "100%",
                                                fontWeight: (r.branchType?.length || 0) > 100 ? "500" : "400",
                                            }}>
                                                {r.branchType && r.branchType.length > 100
                                                    ? r.branchType.slice(0, 100) + "..."
                                                    : r.branchType || "-"}
                                            </span>
                                            {(r.branchType?.length || 0) > 100 && (
                                                <span style={{
                                                    flexShrink: 0,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: "18px",
                                                    height: "18px",
                                                    borderRadius: "50%",
                                                    backgroundColor: "#e2e8f0",
                                                    color: "#718096",
                                                    fontSize: "11px",
                                                    fontWeight: "600",
                                                    cursor: "help",
                                                }} title="Text truncated - hover to see full text">
                                                    ...
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 16. Activity Duration From */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.activityDurationFrom ? new Date(r.activityDurationFrom).toLocaleDateString() : ""}
                                    </td>

                                    {/* 17. Activity Duration To */}
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.activityDurationTo ? new Date(r.activityDurationTo).toLocaleDateString() : ""}
                                    </td>

                                </tr>

                            ))
                        })()}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "25px",
                flexWrap: "wrap",
                gap: "15px",
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
            }}>
                <span style={{
                    fontWeight: "600",
                    color: "#2d3748",
                    fontSize: "14px"
                }}>
                    Page {page} of {totalPages}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{
                        marginRight: "5px",
                        fontWeight: "600",
                        color: "#4a5568",
                        fontSize: "14px"
                    }}>
                        Rows per page:
                    </label>
                    <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "2px solid #e2e8f0",
                            fontSize: "14px",
                            fontWeight: "500",
                            cursor: "pointer",
                            outline: "none"
                        }}
                    >
                        {[5, 10, 20, 50, 100].map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={handleFirst}
                        disabled={page === 1}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === 1 ? "not-allowed" : "pointer",
                            backgroundColor: page === 1 ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        First
                    </button>
                    <button
                        onClick={handlePrev}
                        disabled={page === 1}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === 1 ? "not-allowed" : "pointer",
                            backgroundColor: page === 1 ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        Prev
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={page === totalPages}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === totalPages ? "not-allowed" : "pointer",
                            backgroundColor: page === totalPages ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        Next
                    </button>
                    <button
                        onClick={handleLast}
                        disabled={page === totalPages}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === totalPages ? "not-allowed" : "pointer",
                            backgroundColor: page === totalPages ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        Last
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadExportRegularPWP;
