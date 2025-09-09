import React, { useState, useEffect, useMemo } from "react";
import './ManageVisa.css'
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { MdPictureAsPdf, MdGridOn } from "react-icons/md";
import excelIcon from '../Assets/exel.png'; // adjust path as needed
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // ✅ IMPORTANT: import it like this


const PAGE_SIZE = 8; // rows per page

const visaRecordsData = [
    {
        visaCode: "V001",
        visaTitle: "Work Visa",
        visaType: "Type A",
        company: "ABC Corp",
        principal: "John Doe",
        brand: "Brand X",
        status: "Active",
        approver: "Jane Smith",
        ownerName: "Owner 1",
        dateCreated: "2023-01-15",
    },
    {
        visaCode: "V002",
        visaTitle: "Student Visa",
        visaType: "Type B",
        company: "DEF Corp",
        principal: "Mary Jane",
        brand: "Brand Y",
        status: "Pending",
        approver: "John Smith",
        ownerName: "Owner 2",
        dateCreated: "2023-02-10",
    },
    // add more sample data for testing pagination
    { visaCode: "V003", visaTitle: "Tourist Visa", visaType: "Type C", company: "GHI Inc", principal: "Tom", brand: "Brand Z", status: "Expired", approver: "Alice", ownerName: "Owner 3", dateCreated: "2023-03-12" },
    { visaCode: "V004", visaTitle: "Work Visa", visaType: "Type A", company: "JKL Ltd", principal: "Bob", brand: "Brand X", status: "Active", approver: "Jane", ownerName: "Owner 4", dateCreated: "2023-04-15" },
    { visaCode: "V005", visaTitle: "Student Visa", visaType: "Type B", company: "MNO LLC", principal: "Carol", brand: "Brand Y", status: "Pending", approver: "John", ownerName: "Owner 5", dateCreated: "2023-05-20" },
    { visaCode: "V006", visaTitle: "Tourist Visa", visaType: "Type C", company: "PQR Inc", principal: "David", brand: "Brand Z", status: "Expired", approver: "Alice", ownerName: "Owner 6", dateCreated: "2023-06-01" },
];



const coverVisaRecordsData = [
    {
        visaCode: "CV001",
        visaTitle: "Cover Visa 1",
        visaType: "Type B",
        company: "XYZ Inc",
        principal: "Alice",
        brand: "Brand Y",
        createdBy: "Manager",
        dateCreated: "2023-03-01",
    },
    {
        visaCode: "CV002",
        visaTitle: "Cover Visa 2",
        visaType: "Type A",
        company: "XYZ Inc",
        principal: "Eve",
        brand: "Brand Y",
        createdBy: "Manager",
        dateCreated: "2023-04-05",
    },
    // Add more if you want
];


function RecordsPage() {
    const [activeTab, setActiveTab] = useState("visa");

    const [selectedDetail, setSelectedDetail] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const [visaData, setVisaData] = useState([]);






    // Get current page data depending on activeTab
    const getData = () => {
        switch (activeTab) {
            case "visa":
                return visaRecordsData;

            case "coverVisa":
                return coverVisaRecordsData;

            default:
                return [];
        }
    };



const [currentDatas, setCurrentDatas] = useState([]);

useEffect(() => {
  const fetchAllData = async () => {
    // Fetch Regular_Visa
    const { data: visaData, error: visaError } = await supabase.from('Regular_Visa').select('*');
    if (visaError) {
      console.error('Error fetching Regular_Visa:', visaError);
      return;
    }

    // Fetch RegularUpload
    const { data: uploadData, error: uploadError } = await supabase.from('RegularUpload').select('*');
    if (uploadError) {
      console.error('Error fetching RegularUpload:', uploadError);
      return;
    }

    // Format Regular_Visa data
    const formattedVisaData = (visaData || []).map(row => ({
      id: row.id,
      visaCode: row.visaCode || 'N/A',
      visaTitle: row.visaTitle || 'N/A',
      visaType: row.visaType || 'N/A',
      company: row.company || 'N/A',
      principal: row.principal || 'N/A',
      brand: row.brand || 'N/A',
      status: row.status || (row.approved ? 'Approved' : row.declined ? 'Declined' : 'Pending'),
      approver: row.approver || 'N/A',
      ownerName: row.ownerName || 'N/A',
      dateCreated: row.created_at ? row.created_at.split('T')[0] : '—',
      // add other fields you need from Regular_Visa
      source: 'Regular_Visa',  // mark source
    }));

    // Format RegularUpload data
    const formattedUploadData = (uploadData || []).map(row => ({
      id: row.id,
      visaCode: row.visaCode || 'N/A',
      company: row.company || 'N/A',
      principal: row.principal || 'N/A',
      brand: row.brand || 'N/A',
      accountType: row.accountType || 'N/A',
      account: row.account || 'N/A',
      activity: row.activity || 'N/A',
      visaType: row.visaType || 'N/A',
      Notification: row.Notification || false,
      objective: row.objective || '',
      promoScheme: row.promoScheme || '',
      activityDurationFrom: row.activityDurationFrom ? new Date(row.activityDurationFrom).toLocaleDateString() : '',
      activityDurationTo: row.activityDurationTo ? new Date(row.activityDurationTo).toLocaleDateString() : '',
      isPartOfCoverVisa: row.isPartOfCoverVisa || false,
      coverVisaCode: row.coverVisaCode || '',
      created_at: row.created_at ? new Date(row.created_at).toLocaleString() : '',
      CreatedForm: row.CreatedForm || '',
      supportType: row.supportType || '',
      Regular: row.Regular || false,
      UploadRegular: row.UploadRegular || false,
      RegularPwpCode: row.RegularPwpCode || '',
      source: 'RegularUpload',  // mark source
    }));

    // Combine arrays (or keep separate if you want)
    const combined = [...formattedVisaData, ...formattedUploadData];
    setCurrentDatas(combined);
  };

  fetchAllData();
}, []);




    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Apply filters to currentDatas
    const filteredData = currentDatas.filter(row => {
        const matchesSearch =
            row.visaCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.visaTitle.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "" || row.status === statusFilter;

        const rowDate = new Date(row.dateCreated);
        const isAfterFrom = fromDate ? rowDate >= new Date(fromDate) : true;
        const isBeforeTo = toDate ? rowDate <= new Date(toDate) : true;

        return matchesSearch && matchesStatus && isAfterFrom && isBeforeTo;
    });





    const data = getData(); // your data source

    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(data.length / PAGE_SIZE);

    // Get current page data slice (8 rows per page)
    const currentData = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    // When tab changes, reset page to 1
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setCurrentPage(1);
    };


    const [regularVisaData, setRegularVisaData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch all Regular Visa data from Supabase
    useEffect(() => {
        async function fetchRegularVisa() {
            setLoading(true);
            const { data, error } = await supabase.from("Regular_Visa").select("*");

            if (error) {
                console.error("Error fetching Regular_Visa:", error);
                setError(error);
            } else {
                setRegularVisaData(data);
            }
            setLoading(false);
        }

        fetchRegularVisa();
    }, []);
    const [coverVisaCosts, setCoverVisaCosts] = useState([]);

    useEffect(() => {
        const fetchCoverVisaCosts = async () => {
            if (regularVisaData?.visaCode) {
                const { data, error } = await supabase
                    .from('Cover_Visa_CostDetails')
                    .select('*')
                    .eq('visaCode', regularVisaData.visaCode);

                if (!error) {
                    setCoverVisaCosts(data);
                } else {
                    console.error('Error fetching Cover_Visa_CostDetails:', error);
                    setCoverVisaCosts([]);
                }
            }
        };

        fetchCoverVisaCosts();
    }, [regularVisaData]);


    const generateExcel = () => {
        const sheetData = regularVisaData.map((row) => ({
            ID: row.id,
            "Visa Code": row.visaCode,
            Company: row.company,
            Principal: row.principal,
            Brand: row.brand,
            "Account Type": row.accountType,
            Account: row.account,
            Activity: row.activity,
            "Visa Type": row.visaType,
            Notification: row.Notification ? "Yes" : "No",
            Objective: row.objective,
            "Promo Scheme": row.promoScheme,
            "Lead Time From": row.leadTimeFrom,
            "Lead Time To": row.leadTimeTo,
            "Activity Duration From": row.activityDurationFrom,
            "Activity Duration To": row.activityDurationTo,
            "Is Part of Cover Visa": row.isPartOfCoverVisa ? "Yes" : "No",
            "Cover Visa Code": row.coverVisaCode,
            "Created At": row.created_at,
            "Created Form": row.CreatedForm,
            "Support Type": row.supportType,
            Status: row.status,
            Approver: row.approver,
            "Owner Name": row.ownerName,
            "Created By": row.createdBy,
            "Date Created": row.dateCreated,
        }));

        const worksheet = XLSX.utils.json_to_sheet(sheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Regular Visa Records");

        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        saveAs(
            new Blob([wbout], { type: "application/octet-stream" }),
            "Regular_Visa.xlsx"
        );
    };
    const generatePDF = () => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const columnGap = 10;
        const columnWidth = (pageWidth - margin * 2 - columnGap) / 2;
        const lineHeight = 7;

        let y = margin;

        const title = "REGULAR PWP LIST";

        // Function to add page number footer
        const addPageNumber = () => {
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(
                    `Page ${i} of ${pageCount}`,
                    pageWidth / 2,
                    pageHeight - 10,
                    { align: "center" }
                );
            }
        };

        // Add title on current page
        const addTitle = () => {
            doc.setFontSize(16);
            doc.setTextColor("#2E86C1"); // nice blue color
            doc.setFont("helvetica", "bold");
            doc.text(title, pageWidth / 2, y, { align: "center" });

            // Underline
            const textWidth = doc.getTextWidth(title);
            const underlineY = y + 2;
            doc.setDrawColor("#2E86C1");
            doc.setLineWidth(0.7);
            doc.line((pageWidth - textWidth) / 2, underlineY, (pageWidth + textWidth) / 2, underlineY);

            y += 12; // space after title
        };

        addTitle();

        regularVisaData.forEach((row, index) => {
            const fields = [
                { label: "ID", value: row.id },
                { label: "Visa Code", value: row.visaCode },
                { label: "Company", value: row.company },
                { label: "Principal", value: row.principal },
                { label: "Brand", value: row.brand },
                { label: "Account Type", value: row.accountType },
                { label: "Account", value: row.account },
                { label: "Activity", value: row.activity },
                { label: "Visa Type", value: row.visaType },
                { label: "Notification", value: row.Notification ? "Yes" : "No" },
                { label: "Objective", value: row.objective },
                { label: "Promo Scheme", value: row.promoScheme },
                { label: "Lead Time From", value: row.leadTimeFrom },
                { label: "Lead Time To", value: row.leadTimeTo },
                { label: "Activity Duration From", value: row.activityDurationFrom },
                { label: "Activity Duration To", value: row.activityDurationTo },
                { label: "Is Part of Cover Visa", value: row.isPartOfCoverVisa ? "Yes" : "No" },
                { label: "Cover Visa Code", value: row.coverVisaCode },
                { label: "Created At", value: row.created_at },
                { label: "Created Form", value: row.CreatedForm },
                { label: "Support Type", value: row.supportType },
                { label: "Status", value: row.status },
                { label: "Approver", value: row.approver },
                { label: "Owner Name", value: row.ownerName },
                { label: "Created By", value: row.createdBy },
                { label: "Date Created", value: row.dateCreated },
            ];

            const colChunks = [
                fields.slice(0, Math.ceil(fields.length / 2)),
                fields.slice(Math.ceil(fields.length / 2)),
            ];

            const recordHeight = Math.max(
                colChunks[0].length,
                colChunks[1].length
            ) * lineHeight + 8;

            // Add new page if content exceeds page height
            if (y + recordHeight > pageHeight - margin - 15) {
                addPageNumber(); // add page numbers to current pages before adding new
                doc.addPage();
                y = margin;
                addTitle();
            }

            // Draw rectangle box around record for clear separation
            doc.setDrawColor("#A6A6A6");
            doc.setFillColor(index % 2 === 0 ? "#F0F5F9" : "#FFFFFF"); // alternate row colors
            doc.rect(margin, y - 4, pageWidth - margin * 2, recordHeight - 2, "FD");

            // Draw columns
            colChunks.forEach((chunk, colIndex) => {
                const x = margin + colIndex * (columnWidth + columnGap);
                let yOffset = y;

                chunk.forEach((field, idx) => {
                    // Label - bold and dark
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor("#34495E");
                    doc.text(`${field.label}:`, x, yOffset);

                    // Value - normal and slightly lighter color, indent a bit
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor("#5D6D7E");
                    const labelWidth = doc.getTextWidth(`${field.label}: `);
                    doc.text(`${field.value ?? "-"}`, x + labelWidth + 1, yOffset);

                    yOffset += lineHeight;
                });
            });

            y += recordHeight; // move y down for next record
        });

        addPageNumber(); // final page number on last page

        doc.save("Regular_PWP_List_Styled.pdf");
    };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);

    // Now safe to reference isModalOpen
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeModal();
            }
        };

        if (isModalOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isModalOpen]);
    const handleViewDetails = async (row) => {
        try {
            const { data, error } = await supabase
                .from('Cover_Visa')
                .select('*')
                .eq('visaCode', row.visaCode)
                .single();

            if (error) {
                console.error("Error fetching full Cover Visa details:", error);
                return;
            }

            const formatted = {
                visaCode: data.visaCode || data.id,
                visaTitle: data.visaTitle || 'N/A',
                visaType: data.visaType || 'N/A',
                company: data.company || 'MEGASOFT',
                principal: data.principal || 'N/A',
                brand: data.brand || 'N/A',
                createdBy: data.createdBy || 'N/A',
                dateCreated: data.created_at ? data.created_at.split('T')[0] : '—',
                account: data.account || 'N/A',
                accountType: data.accountType || 'N/A',
                details: data.details || 'N/A',
                objective: data.objective || 'N/A',
                amountbadget: data.amountbadget || 'N/A',
                promoScheme: data.promoScheme || 'N/A',
                remarks: data.remarks || 'N/A',
                salesDivision: data.salesDivision || 'N/A',
                approved: data.approved || false,
                declined: data.declined || false,
                status: data.status || (data.approved ? 'Approved' : data.declined ? 'Declined' : 'Pending'),
                approver: data.approver || 'N/A',
                ownerName: data.ownerName || 'N/A',
                activityDurationTo: data.activityDurationTo || '',
                isPartOfCoverVisa: data.isPartOfCoverVisa || false,
                leadTimeFrom: data.leadTimeFrom || '',
                leadTimeTo: data.leadTimeTo || '',
                responseDate: data.responseDate || '',
            };

            setSelectedRow(formatted);
            setIsModalOpen(true);
            // Fetch cost details
            const { data: costData } = await supabase
                .from("Cover_Visa_CostDetails")
                .select("*")
                .eq("visaCode", row.visaCode);

            const formattedCost = (costData || []).map((item) => ({
                ...item,
                quantity: formatNumber(item.quantity),
                unitCost: formatNumber(item.unitCost),
                discount: formatNumber(item.discount),
                totalCostSum: formatNumber(item.totalCostSum),
                costToSales: formatNumber(item.costToSales),
            }));

            setCostDetailsRows(formattedCost);

            const { data: volumeData } = await supabase
                .from("Cover_Visa_VolumePlan")
                .select("*")
                .eq("visaCode", row.visaCode);

            const formattedVolume = (volumeData || []).map((item) => ({
                ...item,
                projectedAvgSales: formatNumber(item.projectedAvgSales),
                projectedAvgSalesAmount: formatNumber(item.projectedAvgSalesAmount),
                totalProjectedAvgSales: formatNumber(item.totalProjectedAvgSales),
                totalProjectedAvgSalesAmount: formatNumber(item.totalProjectedAvgSalesAmount),
            }));

            setVolumePlanRows(formattedVolume);
        } catch (err) {
            console.error("Unexpected error fetching Cover Visa details:", err);
        }
    };
    const formatNumber = (num) =>
        typeof num === "number" ? num.toLocaleString("en-US") : num;



    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRow(null);
    };

    const [fontSize, setFontSize] = useState('1.8rem');

    useEffect(() => {
        function handleResize() {
            if (window.innerWidth <= 600) {
                setFontSize('1.2rem'); // smaller font on phones
            } else {
                setFontSize('1.8rem'); // default font on bigger screens
            }
        }

        handleResize(); // set initial size
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const formatDate = (isoDate) => {
        if (!isoDate) return 'N/A';
        const date = new Date(isoDate);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };
    const [costDetailsRows, setCostDetailsRows] = useState([]);
    const [costDetailsTotals, setCostDetailsTotals] = useState(null);
    const [volumePlanRows, setVolumePlanRows] = useState([]);
    const [volumePlanTotals, setVolumePlanTotals] = useState(null);
    const [costKeyUsed, setCostKeyUsed] = useState(null);
    const [volumeKeyUsed, setVolumeKeyUsed] = useState(null);
    const [formData, setFormData] = useState({});

    const [selectedVisa, setSelectedVisa] = useState(null);

    // Extract visaCode from selectedVisa for useEffect dependency
    const visaCode = selectedVisa ? selectedVisa.visaCode : null;
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Filtered data based on search and date range
    const filteredDatas = useMemo(() => {
        return visaData.filter((row) => {
            const searchText = searchTerm.toLowerCase();

            const matchesSearch =
                row.visaCode?.toLowerCase().includes(searchText) ||
                row.visaType?.toLowerCase().includes(searchText) ||
                row.principal?.toLowerCase().includes(searchText) ||
                row.brand?.toLowerCase().includes(searchText);

            if (!row.created_at) return matchesSearch; // skip date filtering if no date

            // Convert created_at to Date object
            const createdDate = new Date(row.created_at);

            // Convert dateFrom and dateTo strings to Date objects, at local start of day
            const fromDate = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
            const toDate = dateTo ? new Date(dateTo + "T23:59:59.999") : null;

            // Compare timestamps (milliseconds)
            const createdTime = createdDate.getTime();
            const fromTime = fromDate ? fromDate.getTime() : null;
            const toTime = toDate ? toDate.getTime() : null;

            const matchesDate =
                (!fromTime || createdTime >= fromTime) &&
                (!toTime || createdTime <= toTime);

            return matchesSearch && matchesDate;
        });
    }, [visaData, searchTerm, dateFrom, dateTo]);

    const [volumePlanData, setVolumePlanData] = useState(null);
    const [loadingVolumePlan, setLoadingVolumePlan] = useState(false);
    useEffect(() => {
        if (!visaCode) return;

        const fetchRelatedData = async () => {
            try {
                // Fetch cost details
                const { data: costData, error: costError } = await supabase
                    .from('CostDetails')
                    .select('rows, totals')
                    .eq('visaCode', visaCode)
                    .single();

                if (costError && costError.code !== 'PGRST116') throw costError;

                // Fetch volume plan
                const { data: volumeData, error: volumeError } = await supabase
                    .from('VolumePlans')
                    .select('rows, totals')
                    .eq('visaCode', visaCode)
                    .single();

                if (volumeError && volumeError.code !== 'PGRST116') throw volumeError;

                // Update state
                setCostDetailsRows(costData?.rows || []);
                setCostDetailsTotals(costData?.totals || null);
                setVolumePlanRows(volumeData?.rows || []);
                setVolumePlanTotals(volumeData?.totals || null);

                setVolumePlanData(volumeData || null);
                setFormData(selectedRow || {});
            } catch (error) {
                console.error("Error fetching related tables:", error);
                setCostDetailsRows([]);
                setCostDetailsTotals(null);
                setVolumePlanRows([]);
                setVolumePlanTotals(null);
                setVolumePlanData(null);
                setFormData(selectedRow || {});
            }
        };

        fetchRelatedData();
    }, [visaCode, selectedRow]);


    const fetchCoverVisaData = async () => {
        try {
            const { data, error } = await supabase.from('Cover_Visa').select('*');

            if (error) {
                console.error('Error fetching Cover_Visa data:', error);
                return [];
            }

            const formattedData = data.map((row) => ({
                visaCode: row.visaCode || row.id,
                visaTitle: row.visaTitle || 'N/A',
                visaType: row.visaType || 'N/A',
                company: row.company || 'N/A',
                principal: row.principal || 'N/A',
                amountbadget: row.amountbadget || 'N/A',
                created_at: row.created_at || 'N/A',


                brand: row.brand || 'N/A',
                status: row.status || (row.approved ? 'Approved' : row.declined ? 'Declined' : 'Pending'),
                approver: row.approver || 'N/A',
                ownerName: row.ownerName || 'N/A',
                dateCreated: row.created_at ? row.created_at.split('T')[0] : '—',

                activityDurationTo: row.activityDurationTo || '',
                approved: row.approved || false,
                declined: row.declined || false,
                isPartOfCoverVisa: row.isPartOfCoverVisa || false,
                leadTimeFrom: row.leadTimeFrom || '',
                leadTimeTo: row.leadTimeTo || '',
                objective: row.objective || '',
                promoScheme: row.promoScheme || '',
                remarks: row.remarks || '',
                responseDate: row.responseDate || '',
                salesDivision: row.salesDivision || '',
            }));

            return formattedData;
        } catch (error) {
            console.error('Unexpected error fetching Cover_Visa data:', error);
            return [];
        }
    };
    useEffect(() => {
        const el = document.querySelector(".filter-container");
        if (el) {
            el.style.opacity = 0;
            el.style.transform = "translateY(-10px)";
            setTimeout(() => {
                el.style.transition = "all 0.5s ease";
                el.style.opacity = 1;
                el.style.transform = "translateY(0)";
            }, 50);
        }
    }, []);
    const [showModal, setShowModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [selectedVisaCode, setSelectedVisaCode] = useState('');

    const handleViewHistory = async (visaCode) => {
        setSelectedVisaCode(visaCode);
        setShowModal(true);
        setHistoryData([]); // reset before fetch

        const { data, error } = await supabase
            .from('amount_badget_history')
            .select('*')
            .eq('visacode', visaCode)
            .order('action_date', { ascending: false });

        if (error) {
            console.error('Supabase fetch error:', error.message);
            setHistoryData([]);
        } else {
            setHistoryData(data || []);
        }
    };

    useEffect(() => {
        const fetchRegularVisa = async () => {
            if (selectedDetail?.RegularID) {
                const { data, error } = await supabase
                    .from('Regular_Visa')
                    .select('*')
                    .eq('id', selectedDetail.RegularID)
                    .single();

                if (!error) {
                    setRegularVisaData(data);
                } else {
                    console.error('Error fetching Regular_Visa:', error);
                    setRegularVisaData(null);
                }
            } else {
                setRegularVisaData(null);
            }
        };

        if (showDetailModal && selectedDetail) {
            fetchRegularVisa();
        }
    }, [showDetailModal, selectedDetail]);

    useEffect(() => {
        const loadCoverVisa = async () => {
            const data = await fetchCoverVisaData();
            setVisaData(data); // Replace with your actual state setter
        };

        loadCoverVisa();
    }, []);

    const fetchCostAndPlan = async (visaCode) => {
        try {
            const [{ data: costRes }, { data: planRes }] = await Promise.all([
                supabase.from('Regular_Visa_CostDetails').select('rows, totalQuantity, totalCostSum, costToSales, remarks').eq('visaCode', visaCode).single(),
                supabase.from('Regular_Visa_VolumePlan').select('rows, totalListPrice, totalNonPromoAvgSales, totalNonPromoAvgSalesAmount, totalProjectedAvgSales, totalProjectedAvgSalesAmount, avgIncreasePercent').eq('visaCode', visaCode).single(),
            ]);
            return { cost: costRes, plan: planRes };
        } catch (err) {
            console.error("Fetch Cost/Plan error:", err);
            return { cost: null, plan: null };
        }
    };
    const [viewing, setViewing] = useState(false);
    const [viewVisaCode, setViewVisaCode] = useState(null);
    const [costPlanData, setCostPlanData] = useState({ cost: null, plan: null });
    const [amountBadgetHistory, setAmountBadgetHistory] = useState([]);

    const handleView = async (visaCode) => {
        try {
            // 1. Get Regular_Visa id
            const { data: visaData, error: visaError } = await supabase
                .from('Regular_Visa')
                .select('id')
                .eq('visaCode', visaCode)
                .single();

            if (visaError) throw visaError;

            const regularId = visaData.id;
            console.log('Regular_Visa ID:', regularId);

            // 2. Fetch cost and plan
            const data = await fetchCostAndPlan(visaCode);

            // 3. Fetch amount_badget_history by RegularID
            const { data: badgetData, error: badgetError } = await supabase
                .from('amount_badget_history')
                .select('*')
                .eq('RegularID', regularId);

            if (badgetError) throw badgetError;

            // 4. Update states
            setViewVisaCode(visaCode);
            setCostPlanData(data);
            setAmountBadgetHistory(badgetData);
            setViewing(true);

        } catch (error) {
            console.error('Error fetching data:', error.message);
            alert('Failed to load visa data');
        }
    };




    const styles = {
        modalBackdrop: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '1rem', zIndex: 1000,
        },
        modalContent: {
            background: '#fff', padding: '1.5rem', borderRadius: 8,
            maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto',
        },
        closeBtn: {
            marginTop: '1rem', padding: '8px 16px', backgroundColor: '#ef4444',
            color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
            float: 'right'
        },
    };
    const renderJsonTable = (jsonRows) => {
        if (!jsonRows || !Array.isArray(jsonRows) || jsonRows.length === 0)
            return <p>No rows</p>;

        const cols = Object.keys(jsonRows[0]);
        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                    <tr>
                        {cols.map(c => <th key={c} style={{ borderBottom: '1px solid #aaa', padding: '4px' }}>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {jsonRows.map((r, i) => (
                        <tr key={i}>
                            {cols.map(c => <td key={c} style={{ padding: '4px' }}>{r[c]}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };




    const renderFixedTable = (columns, rows) => (
        <div style={{ overflowX: "auto" }}>
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "20px",
                    minWidth: "600px",
                }}
            >
                <thead>
                    <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
                        {columns.map(({ key, label }) => (
                            <th key={key} style={{ padding: "10px", border: "1px solid #ddd" }}>
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                style={{
                                    padding: "15px",
                                    textAlign: "center",
                                    fontStyle: "italic",
                                }}
                            >
                                No data found.
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, idx) => (
                            <tr
                                key={idx}
                                style={{ backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "white" }}
                            >
                                {columns.map(({ key }) => (
                                    <td key={key} style={{ padding: "10px", border: "1px solid #ddd" }}>
                                        {row[key] !== undefined && row[key] !== null ? row[key] : "-"}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderTotals = (totals) => {
        if (!totals) return null;

        return (
            <div
                style={{
                    marginBottom: "30px",
                    overflowX: "auto",
                    display: "flex",
                    justifyContent: "flex-end",
                }}
            >
                <div style={{ minWidth: "50px" }}>
                    <h4 style={{ marginBottom: "10px" }}>Totals</h4>
                    <table
                        style={{
                            overflowX: "auto",
                            borderCollapse: "collapse",
                        }}
                    >
                        <tbody>
                            {Object.entries(totals).map(([key, value]) => (
                                <tr key={key}>
                                    <td
                                        style={{
                                            fontWeight: "bold",
                                            backgroundColor: "#f4f4f4",
                                        }}
                                    >
                                        {key}
                                    </td>
                                    <td style={{ border: "1px solid #ccc" }}>
                                        {typeof value === "object" ? JSON.stringify(value) : value}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };





    const costDetailsColumns = [
        { key: "costDetails", label: "Cost Details" },
        { key: "costRemark", label: "Cost Remark" },
        { key: "quantity", label: "Quantity" },
        { key: "unitCost", label: "Unit Cost" },
        { key: "discount", label: "Discount" },
        { key: "chargeTo", label: "Charge To" },
        { key: "totalCostSum", label: "Total Cost Sum" },
        { key: "costToSales", label: "Cost to Sales" },
    ];

    const volumePlanColumns = [
        { key: "itemCode", label: "Item Code" },
        { key: "projectedAvgSales", label: "Projected Avg. Sales" },
        { key: "UM", label: "UM" },
        { key: "projectedAvgSalesAmount", label: "Projected Sales Amount" },
        { key: "totalProjectedAvgSales", label: "Total Projected Sales" },
        { key: "totalProjectedAvgSalesAmount", label: "Total Projected Amount" },
    ];

    // Local data fallback for CostDetails and VolumePlan from selectedVisa props
    const localCostDetails = Object.entries(selectedVisa || {}).find(([key]) =>
        key.startsWith("CostDetails_")
    );
    const localVolumePlan = Object.entries(selectedVisa || {}).find(([key]) =>
        key.startsWith("VolumePlan_")
    );

    let localCostRows = [];
    let localCostTotals = null;
    if (localCostDetails) {
        try {
            const parsed =
                typeof localCostDetails[1] === "string"
                    ? JSON.parse(localCostDetails[1])
                    : localCostDetails[1];
            localCostRows = Array.isArray(parsed.rows) ? parsed.rows : [];
            localCostTotals = parsed.totals || null;
        } catch { }
    }

    let localVolumeRows = [];
    let localVolumeTotals = null;
    if (localVolumePlan) {
        try {
            const parsed =
                typeof localVolumePlan[1] === "string"
                    ? JSON.parse(localVolumePlan[1])
                    : localVolumePlan[1];
            localVolumeRows = Array.isArray(parsed.rows) ? parsed.rows : [];
            localVolumeTotals = parsed.totals || null;
        } catch { }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "90vh", padding: "15px" }}>
            <div style={{ padding: "1rem" }}>
                <h1>Records</h1>

                {/* Tab Buttons */}
                <>
                    <style>
                        {`
      .tabButton {
        border: none;
        cursor: pointer;
        border-radius: 4px;
        flex: 1 1 45%;
        min-width: 100px;
        transition: all 0.3s ease;
      }

      /* Default small style (mobile first) */
      .tabButton {
        padding: 0.3rem 0.8rem;
        font-size: 0.85rem;
      }

      /* Larger styles for desktop */
      @media (min-width: 768px) {
        .tabButton {
          padding: 0.6rem 1.2rem;
          font-size: 1rem;
          min-width: 140px;
          flex: 0 0 auto; /* prevent shrinking on desktop */
        }
      }
    `}
                    </style>

                    <div
                        style={{
                            marginBottom: "1rem",
                            display: "flex",
                            justifyContent: "flex-start",
                            gap: "8px",
                            flexWrap: "wrap",
                        }}
                    >
                        {["visa", "coverVisa"].map((tabKey, idx) => {
                            const labelMap = {
                                visa: "Regular Records",
                                coverVisa: "Cover Records",
                            };

                            return (
                                <button
                                    key={tabKey}
                                    onClick={() => handleTabChange(tabKey)}
                                    className="tabButton"
                                    style={{
                                        backgroundColor: activeTab === tabKey ? "#007bff" : "#eee",
                                        color: activeTab === tabKey ? "#fff" : "#000",
                                        textAlign: idx === 0 ? "left" : "right",
                                    }}
                                >
                                    {labelMap[tabKey]}
                                </button>
                            );
                        })}
                    </div>
                </>



                {/* Table with scroll */}
                <div
                    style={{
                        flexGrow: 1,
                        overflowY: "auto",
                        border: "1px solid #ccc",
                        borderRadius: 4,
                    }}
                >

                    <>
                        <style>
                            {`
                            /* Container wrapping filters */
                            .filterBar {
                                display: flex;
                                justify-content: space-between;
                                flex-wrap: wrap;
                                align-items: center;
                                gap: 12px;
                                margin-bottom: 1rem;
                                animation: fadeSlideIn 0.5s ease forwards;
                            }

                            .filterLeft {
                                display: flex;
                                flex-wrap: wrap;
                                gap: 12px;
                                flex: 1 1 auto;
                                min-width: 300px;
                            }

                            .filterRight {
                                display: flex;
                                align-items: center;
                                gap: 10px;
                                flex-wrap: nowrap;
                                min-width: 350px;
                                justify-content: flex-end;
                            }

                            /* Responsive styles */
                            @media (max-width: 600px) {
                                .filterBar {
                                flex-direction: column;
                                align-items: stretch;
                                }
                                .filterLeft,
                                .filterRight {
                                min-width: 100%;
                                justify-content: space-between;
                                gap: 8px;
                                margin-bottom: 8px;
                                }
                                .filterRight {
                                justify-content: flex-start;
                                flex-wrap: wrap;
                                }

                                /* Smaller inputs and buttons on mobile */
                                input[type="text"],
                                select,
                                input[type="date"],
                                button {
                                font-size: 0.85rem !important;
                                padding: 0.3rem 0.5rem !important;
                                }

                                /* Table wrapper for horizontal scroll */
                                .tableWrapper {
                                overflow-x: auto;
                                -webkit-overflow-scrolling: touch;
                                }

                                /* Smaller button row spacing */
                                .buttonRow {
                                flex-direction: column !important;
                                gap: 8px !important;
                                }

                                /* Center buttons in column */
                                .buttonRow button {
                                width: 100% !important;
                                justify-content: center !important;
                                }
                            }
                            `}
                        </style>

                        {activeTab === "visa" && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    height: "66vh",
                                    padding: "1rem",
                                }}
                            >
                                <h2 style={{ marginBottom: "1rem" }}>Regular PwP Records</h2>

                                {/* Filters */}
                                <div className="filterBar">
                                    <div className="filterLeft">
                                        <input
                                            type="text"
                                            placeholder="Search by Code or Title"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{
                                                padding: "0.6rem 0.75rem",
                                                border: "1px solid #ccc",
                                                borderRadius: "8px",
                                                fontSize: "0.95rem",
                                                flex: "1 1 200px",
                                                transition: "all 0.3s ease",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                                backgroundColor: "#fff",
                                                outline: "none",
                                            }}
                                            onFocus={(e) =>
                                                (e.target.style.boxShadow = "0 0 0 3px rgba(66, 133, 244, 0.2)")
                                            }
                                            onBlur={(e) =>
                                                (e.target.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")
                                            }
                                        />

                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            style={{
                                                padding: "0.6rem 0.75rem",
                                                border: "1px solid #ccc",
                                                borderRadius: "8px",
                                                fontSize: "0.95rem",
                                                flex: "1 1 160px",
                                                transition: "all 0.3s ease",
                                                backgroundColor: "#fff",
                                                appearance: "none",
                                                backgroundImage:
                                                    "url('data:image/svg+xml;utf8,<svg fill=\"%23333\" height=\"16\" viewBox=\"0 0 24 24\" width=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
                                                backgroundRepeat: "no-repeat",
                                                backgroundPosition: "right 10px center",
                                                backgroundSize: "12px",
                                                outline: "none",
                                            }}
                                            onFocus={(e) =>
                                                (e.target.style.boxShadow = "0 0 0 3px rgba(66, 133, 244, 0.2)")
                                            }
                                            onBlur={(e) => (e.target.style.boxShadow = "none")}
                                        >
                                            <option value="">All Statuses</option>
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                    </div>

                                    <div className="filterRight">
                                        <label
                                            style={{
                                                fontSize: "0.95rem",
                                                fontWeight: "500",
                                                whiteSpace: "nowrap",
                                                color: "#333",
                                            }}
                                        >
                                            Date:
                                        </label>

                                        <input
                                            type="date"
                                            value={fromDate}
                                            onChange={(e) => setFromDate(e.target.value)}
                                            style={{
                                                padding: "0.6rem",
                                                border: "1px solid #ccc",
                                                borderRadius: "8px",
                                                fontSize: "0.95rem",
                                                width: "150px",
                                                transition: "all 0.3s ease",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                                outline: "none",
                                            }}
                                            onFocus={(e) =>
                                                (e.target.style.boxShadow = "0 0 0 3px rgba(66, 133, 244, 0.2)")
                                            }
                                            onBlur={(e) =>
                                                (e.target.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")
                                            }
                                        />

                                        <span
                                            style={{ fontWeight: 500, fontSize: "1rem", color: "#666" }}
                                        >
                                            /
                                        </span>

                                        <input
                                            type="date"
                                            value={toDate}
                                            onChange={(e) => setToDate(e.target.value)}
                                            style={{
                                                padding: "0.6rem",
                                                border: "1px solid #ccc",
                                                borderRadius: "8px",
                                                fontSize: "0.95rem",
                                                width: "160px",
                                                transition: "all 0.3s ease",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                                outline: "none",
                                            }}
                                            onFocus={(e) =>
                                                (e.target.style.boxShadow = "0 0 0 3px rgba(66, 133, 244, 0.2)")
                                            }
                                            onBlur={(e) =>
                                                (e.target.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)")
                                            }
                                        />
                                    </div>
                                </div>

                                {/* Button Row */}
                                <div
                                    className="buttonRow"
                                    style={{ marginBottom: "1rem", display: "flex", gap: '15px' }}
                                >
                                    <button
                                        onClick={generatePDF}
                                        style={{
                                            padding: "0.5rem 1rem",
                                            backgroundColor: "#d9534f",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                        }}
                                    >
                                        <MdPictureAsPdf size={20} />
                                        Generate PDF
                                    </button>
                                    <button
                                        onClick={generateExcel}
                                        style={{
                                            padding: "0.5rem 1rem",
                                            background:
                                                "linear-gradient(90deg, rgba(87, 199, 133, 1) 50%, rgba(237, 221, 83, 1) 100%)",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "5px",
                                        }}
                                    >
                                        <img
                                            src={excelIcon}
                                            alt="Excel icon"
                                            style={{ width: 20, height: 20 }}
                                        />
                                        Generate Excel
                                    </button>
                                </div>

                                {/* Table */}
                                <div
                                    className="tableWrapper"
                                    style={{
                                        flex: 1,
                                        overflowY: "auto",
                                        border: "1px solid #ddd",
                                        borderRadius: 6,
                                    }}
                                >
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            backgroundColor: "#fff",
                                            minWidth: "600px",
                                        }}
                                    >
                                        <thead
                                            style={{
                                                backgroundColor: "#f4f4f4",
                                                position: "sticky",
                                                top: 0,
                                                zIndex: 1,
                                            }}
                                        >
                                            <tr>
                                                <th style={{ textAlign: "center" }}>Code</th>
                                                <th style={{ textAlign: "center" }}>Type</th>
                                                <th style={{ textAlign: "center" }}>Distributor</th>
                                                <th style={{ textAlign: "center" }}>Brand</th>
                                                <th style={{ textAlign: "center" }}>Company</th>
                                                <th style={{ textAlign: "center" }}>Status</th>
                                                <th style={{ textAlign: "center" }}>Created Date</th>
                                                <th style={{ textAlign: "center" }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData.map((row, index) => (
                                                <tr key={index}>
                                                    <td style={{ textAlign: "center" }}>{row.visaCode}</td>
                                                    <td style={{ textAlign: "center" }}>{row.visaType}</td>
                                                    <td style={{ textAlign: "center" }}>{row.principal}</td>
                                                    <td style={{ textAlign: "center" }}>{row.brand}</td>
                                                    <td style={{ textAlign: "center" }}>{row.company}</td>
                                                    <td style={{ textAlign: "center" }}>{row.status}</td>
                                                    <td style={{ textAlign: "center" }}>{row.dateCreated}</td>
                                                    <td style={thTdStyle}>
                                                        <button
                                                            style={buttonBaseStyle}
                                                            onClick={() => handleView(row.visaCode)}
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>


                    {viewing && (
                        <>
                            <style>{`
                            /* Responsive modal width */
                            .modalContent {
                                width: 100vw;
                                max-width: 1400px;
                                max-height: 90vh;
                                overflow-y: auto;
                                background: white;
                                border-radius: 10px;
                                padding: 1.5rem 2rem;
                                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                                position: relative;
                            }
                            @media (max-width: 600px) {
                                .modalContent {
                                width: 95vw;
                                padding: 1rem 1rem;
                                }
                            }

                            /* Flex container for tables and details */
                            .tableDetailsContainer {
                                display: flex;
                                gap: 1.5rem;
                                align-items: flex-start;
                                justify-content: space-between;
                            }
                            @media (max-width: 600px) {
                                .tableDetailsContainer {
                                flex-direction: column;
                                gap: 1rem;
                                }
                            }

                            /* Make tables scroll horizontally on small screens */
                            .tableWrapper {
                                flex: 1;
                                overflow-x: auto;
                            }
                            /* Details text container */
                            .detailsText {
                                flex: 1;
                                text-align: right;
                            }
                            @media (max-width: 600px) {
                                .detailsText {
                                text-align: left;
                                }
                            }
                            `}</style>

                            <div style={styles.modalBackdrop} onClick={() => setViewing(false)}>
                                <div
                                    className="modalContent"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <h3
                                        style={{
                                            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                            fontWeight: '700',
                                            fontSize: fontSize,
                                            color: '#2c3e50',
                                            borderBottom: '3px solid #2980b9',
                                            paddingBottom: '0.5rem',
                                            marginBottom: '1.5rem',
                                            letterSpacing: '1px',
                                            textTransform: 'uppercase',
                                            textAlign: 'center',
                                            backgroundColor: '#ecf0f1',
                                            borderRadius: '8px',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        Cost & Plan Details for {viewVisaCode}
                                    </h3>

                                    {costPlanData.plan ? (
                                        <>
                                            <h4 style={{ marginTop: '1rem' }}>Volume Plan</h4>
                                            <div style={{ overflowX: 'auto', width: '100%' }}>
                                                {renderJsonTable(costPlanData.plan.rows)}
                                            </div>
                                            <div
                                                className="detailsText"
                                                style={{
                                                    padding: '1rem',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                                    fontWeight: '600',
                                                    color: '#2c3e50',
                                                    lineHeight: '1.6',
                                                    marginTop: '1rem',
                                                    maxWidth: '400px',
                                                    marginLeft: 'auto',  // push block to right
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr',
                                                    columnGap: '1.5rem',
                                                    rowGap: '0.75rem',
                                                }}
                                            >
                                                <div style={{ textAlign: 'left' }}>Total List Price:</div>
                                                <div style={{ textAlign: 'right' }}>{Number(costPlanData.plan.totalListPrice).toLocaleString()}</div>

                                                <div style={{ textAlign: 'left' }}>Projected Avg Sales Units:</div>
                                                <div style={{ textAlign: 'right' }}>{Number(costPlanData.plan.totalProjectedAvgSales).toLocaleString()}</div>

                                                <div style={{ textAlign: 'left' }}>Projected Avg Sales Amount:</div>
                                                <div style={{ textAlign: 'right' }}>{Number(costPlanData.plan.totalProjectedAvgSalesAmount).toLocaleString()}</div>

                                                <div style={{ textAlign: 'left' }}>Average Increase %:</div>
                                                <div style={{ textAlign: 'right' }}>{Number(costPlanData.plan.avgIncreasePercent).toLocaleString()}</div>
                                            </div>


                                        </>
                                    ) : (
                                        <p>No volume plan data.</p>
                                    )}

                                    {costPlanData.cost ? (
                                        <>
                                            <h4 style={{ marginTop: '1rem' }}>Cost Details</h4>
                                            <div style={{ overflowX: 'auto', width: '100%' }}>
                                                <div className="tableWrapper">
                                                    {renderJsonTable(costPlanData.cost.rows)}
                                                </div>
                                                <div
                                                    className="detailsText"
                                                    style={{
                                                        marginTop: '1rem',
                                                        padding: '1rem',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                                        fontWeight: '600',
                                                        color: '#2c3e50',
                                                        lineHeight: '1.6',
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr 1fr',
                                                        rowGap: '0.75rem',
                                                        columnGap: '2rem',
                                                        justifyContent: 'end',   // This pushes the whole grid container to the right
                                                        maxWidth: '400px',       // Optional: limit the width so it doesn't stretch full width
                                                        marginLeft: 'auto',      // Another way to push container right in a flex/grid parent
                                                    }}
                                                >
                                                    <div style={{ textAlign: 'left' }}>Total Quantity:</div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        {costPlanData.cost.totalQuantity !== null
                                                            ? Number(costPlanData.cost.totalQuantity).toLocaleString()
                                                            : '-'}
                                                    </div>

                                                    <div style={{ textAlign: 'left' }}>Total Cost Sum:</div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        {costPlanData.cost.totalCostSum !== null
                                                            ? Number(costPlanData.cost.totalCostSum).toLocaleString()
                                                            : '-'}
                                                    </div>

                                                    <div style={{ textAlign: 'left' }}>Cost To Sales:</div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        {costPlanData.cost.costToSales !== null
                                                            ? Number(costPlanData.cost.costToSales).toLocaleString()
                                                            : '-'}
                                                    </div>

                                                    <div style={{ textAlign: 'left' }}>Remarks:</div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        {costPlanData.cost.remarks || '-'}
                                                    </div>
                                                </div>


                                            </div>
                                        </>
                                    ) : (
                                        <p>No cost details data.</p>
                                    )}


                                    {amountBadgetHistory.length > 0 ? (
                                        <>
                                            <h4 style={{ marginTop: '1.5rem' }}>Amount Badget </h4>
                                            <div
                                                style={{
                                                    maxHeight: '300px',
                                                    overflowY: 'auto',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '1rem',
                                                    padding: '0.5rem 0',
                                                }}
                                            >
                                                {amountBadgetHistory.map((item) => (
                                                    <div
                                                        key={item.history_id}
                                                        style={{
                                                            border: '1px solid #ddd',
                                                            borderRadius: '10px',
                                                            padding: '1rem',
                                                            backgroundColor: '#f9fafb',
                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                                            gap: '0.75rem',
                                                            fontSize: '0.9rem',
                                                        }}
                                                    >
                                                        <div>
                                                            <strong>Amount Badget:</strong>
                                                            <div>{Number(item.amountbadget).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <strong>Created User:</strong>
                                                            <div>{item.createduser}</div>
                                                        </div>

                                                        <div>
                                                            <strong>Remaining Balance:</strong>
                                                            <div>{Number(item.remainingbalance).toLocaleString()}</div>
                                                        </div>
                                                        <div>
                                                            <strong>Action Type:</strong>
                                                            <div>{item.action_type}</div>
                                                        </div>
                                                        <div>
                                                            <strong>Total Cost:</strong>
                                                            <div>{item.TotalCost ? Number(item.TotalCost).toLocaleString() : '-'}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p style={{ marginTop: '1rem' }}>No amount badget history data available.</p>
                                    )}



                                    <button onClick={() => setViewing(false)} style={styles.closeBtn}>Close</button>
                                </div>
                            </div>
                        </>
                    )}






                    {activeTab === 'coverVisa' && (
                        <div style={{ padding: '1rem', height: '66vh', display: 'flex', flexDirection: 'column' }}>
                            <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>All Cover VISA Records</h2>

                            {/* Search and Date Filters */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    marginBottom: '1rem',
                                }}
                            >
                                {/* 🔍 Search bar (left side) */}
                                <input
                                    type="text"
                                    placeholder="Search by Code, Type, Brand"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '6px',
                                        border: '1px solid #ccc',
                                        flex: '1 1 200px',
                                        maxWidth: '100%',
                                        minWidth: '100px',
                                    }}
                                />

                                {/* 📅 Filters (right side) */}
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        flexWrap: 'wrap',
                                        justifyContent: 'flex-end',
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label htmlFor="dateFrom" style={{ marginBottom: '0.25rem' }}>From:</label>
                                        <input
                                            id="dateFrom"
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            style={{
                                                padding: '0.3rem',
                                                borderRadius: '6px',
                                                border: '1px solid #ccc',
                                                minWidth: '160px',
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <label htmlFor="dateTo" style={{ marginBottom: '0.25rem' }}>To:</label>
                                        <input
                                            id="dateTo"
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            style={{
                                                padding: '0.3rem',
                                                borderRadius: '6px',
                                                border: '1px solid #ccc',
                                                minWidth: '160px',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div
                                style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    borderRadius: '10px',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                                }}
                            >
                                <table
                                    style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        backgroundColor: '#fff',
                                        textAlign: 'center',
                                    }}
                                >
                                    <thead>
                                        <tr style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                            <th style={thStyle}>Code</th>
                                            <th style={thStyle}>Type</th>
                                            <th style={thStyle}>Distributor</th>

                                            <th style={thStyle}>Brand</th>
                                            <th style={thStyle}>Create</th>

                                            <th style={thStyle}>Amount Badget</th>
                                            <th style={thStyle}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDatas.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '1rem' }}>
                                                    No records found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredDatas.map((row) => (
                                                <tr key={row.visaCode}>
                                                    <td
                                                        style={{ ...tdStyle, cursor: 'pointer', color: '#1e40af', textDecoration: 'underline' }}
                                                        onClick={() => handleViewHistory(row.visaCode)}
                                                        title="Click to view history"
                                                    >
                                                        {row.visaCode}
                                                    </td>

                                                    <td style={tdStyle}>{row.visaType}</td>
                                                    <td style={tdStyle}>{row.principal}</td>

                                                    <td style={tdStyle}>{row.brand}</td>
                                                    <td style={tdStyle}>
                                                        {row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : 'N/A'}
                                                    </td>

                                                    <td style={tdStyle}>
                                                        {row.amountbadget ? `₱${Number(row.amountbadget).toLocaleString()}` : 'N/A'}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => handleViewDetails(row)}
                                                            title="View Details"
                                                            style={buttonStyle}
                                                            onMouseEnter={handleMouseEnter}
                                                            onMouseLeave={handleMouseLeave}
                                                            onMouseDown={handleMouseDown}
                                                            onMouseUp={handleMouseUp}
                                                        >
                                                            🔍
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

                    {showModal && (
                        <div style={modalOverlayStyle}>
                            <div style={modalContentStyle}>
                                <h2>History for Visa Code: {selectedVisaCode}</h2>
                                <button style={closeButtonStyle} onClick={() => setShowModal(false)}>✖</button>
                                {historyData.length === 0 ? (
                                    <p>No history found.</p>
                                ) : (
                                    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                                            <thead>
                                                <tr>
                                                    <th>Action Type</th>
                                                    <th>Amount</th>
                                                    <th>Remaining</th>
                                                    <th>User</th>
                                                    <th>Date</th>
                                                    <th>View</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyData.map((item) => (
                                                    <tr key={item.history_id}>
                                                        <td>{item.action_type}</td>
                                                        <td>₱{Number(item.amountbadget).toLocaleString()}</td>
                                                        <td>₱{Number(item.remainingbalance).toLocaleString()}</td>
                                                        <td>{item.action_user}</td>
                                                        <td>{new Date(item.action_date).toLocaleString()}</td>
                                                        <td>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedDetail(item);
                                                                    setShowDetailModal(true);
                                                                }}
                                                                style={{
                                                                    backgroundColor: '#3b82f6',
                                                                    color: '#fff',
                                                                    padding: '6px 16px',
                                                                    fontSize: '14px',
                                                                    fontWeight: 500,
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                                                    transition: 'background-color 0.2s ease-in-out',
                                                                }}
                                                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#2563eb'}
                                                                onMouseOut={e => e.currentTarget.style.backgroundColor = '#3b82f6'}
                                                            >
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}

                    {showDetailModal && selectedDetail && (
                        <div style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}>
                            <div style={{
                                backgroundColor: '#fff',
                                padding: '30px',
                                borderRadius: '10px',
                                maxWidth: '500px',
                                width: '90%',
                                position: 'relative',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                            }}>
                                <button
                                    style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        background: 'transparent',
                                        border: 'none',
                                        fontSize: '20px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setShowDetailModal(false)}
                                >
                                    ✖
                                </button>

                                <div style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '10px',
                                    padding: '25px',
                                    backgroundColor: '#fafafa'
                                }}>
                                    <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Full History Details</h2>
                                    <div style={{ marginBottom: '10px', fontSize: '15px' }}><strong>Regular ID:</strong> {selectedDetail.RegularID ?? '—'}</div>


                                    <div style={{ marginBottom: '10px', fontSize: '15px' }}><strong>Visa Code:</strong> {selectedDetail.visacode}</div>
                                    <div style={{ marginBottom: '10px', fontSize: '15px' }}><strong>Amount:</strong> ₱{Number(selectedDetail.amountbadget).toLocaleString()}</div>
                                    <div style={{ marginBottom: '10px', fontSize: '15px' }}><strong>Remaining Balance:</strong> ₱{Number(selectedDetail.remainingbalance).toLocaleString()}</div>
                                    <div style={{ marginBottom: '10px', fontSize: '15px' }}>
                                        <strong>Total Cost:</strong> {selectedDetail.TotalCost !== null ? `₱${Number(selectedDetail.TotalCost).toLocaleString()}` : '—'}
                                    </div>

                                    {regularVisaData && (
                                        <div style={{
                                            marginTop: '30px',
                                            paddingTop: '20px',
                                            borderTop: '1px solid #ccc'
                                        }}>
                                            <h3 style={{ marginBottom: '15px' }}>Linked Regular Visa Info</h3>
                                            <div style={{ marginBottom: '10px', fontSize: '15px' }}><strong>Visa Code:</strong> {regularVisaData.visaCode}</div>
                                            <div style={{ marginBottom: '10px', fontSize: '15px' }}><strong>Account Type:</strong> {regularVisaData.accountType}</div>
                                            <div style={{ marginBottom: '10px', fontSize: '15px' }}>
                                                <strong>Activity Duration:</strong> {regularVisaData.activityDurationFrom} to {regularVisaData.activityDurationTo}
                                            </div>
                                            <div style={{ marginBottom: '10px', fontSize: '15px' }}>
                                                <strong>Is Part of Cover Visa:</strong> {regularVisaData.isPartOfCoverVisa ? 'Yes' : 'No'}
                                            </div>

                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    )}


                    {isModalOpen && selectedRow && (
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100vw',
                                height: '100vh',
                                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: "1000",
                                padding: '1rem',
                            }}
                        >
                            <div
                                style={{
                                    backgroundColor: '#ffffff',
                                    padding: '2rem 2.5rem',
                                    borderRadius: '12px',
                                    width: '90%',
                                    maxWidth: '1500px',
                                    maxHeight: '80vh',
                                    overflowY: 'auto',
                                    boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                }}
                            >
                                <h3
                                    style={{
                                        marginBottom: '1.5rem',
                                        fontWeight: '700',
                                        color: '#fff',
                                        borderBottom: '2px solid #4a90e2',
                                        padding: '0.5rem 1rem',
                                        textShadow: '1px 1px 2px rgba(0,0,0,0.4)', // subtle dark shadow
                                        backgroundColor: '#4a90e2', // a stronger blue for better contrast
                                        borderRadius: '6px 6px 0 0', // rounded corners on top
                                    }}
                                >
                                    COVER VISA DETAILS
                                </h3>

                                {/* Form with details */}
                                <form
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '1.25rem 1.75rem',
                                        color: '#444',
                                        fontSize: '1rem',
                                        marginBottom: '2rem',
                                    }}
                                >
                                    {[
                                        [' Code', selectedRow.visaCode],
                                        [' Type', selectedRow.visaType],
                                        ['Company', selectedRow.company],
                                        ['Principal', selectedRow.principal],
                                        ['Brand', selectedRow.brand],

                                        ['Account', selectedRow.account],
                                        ['Account Type', selectedRow.accountType],
                                        ['Details', selectedRow.details],
                                        ['Objective', selectedRow.objective],
                                        ['Amount Budget', selectedRow.amountbadget ? Number(selectedRow.amountbadget).toLocaleString() : 'N/A'],
                                        ['Promo Scheme', selectedRow.promoScheme],
                                        ['Remarks', selectedRow.remarks],
                                    ].map(([label, value], idx) => (
                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label
                                                htmlFor={label.replace(/\s+/g, '').toLowerCase()}
                                                style={{ fontWeight: '600', marginBottom: '0.4rem', color: '#555' }}
                                            >
                                                {label}
                                            </label>
                                            <input
                                                id={label.replace(/\s+/g, '').toLowerCase()}
                                                type="text"
                                                value={value || 'N/A'}
                                                disabled
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '6px',
                                                    border: '1.5px solid #ccc',
                                                    backgroundColor: '#f7f9fc',
                                                    color: '#333',
                                                    fontWeight: '600',
                                                    cursor: 'not-allowed',
                                                    outline: 'none',
                                                    transition: 'border-color 0.2s',
                                                }}
                                            />
                                        </div>
                                    ))}
                                </form>
                                <h3>Cost Details {costKeyUsed ? `(from DB key: ${costKeyUsed})` : "(local data)"}</h3>
                                {renderFixedTable(costDetailsColumns, costDetailsRows)}
                                {renderTotals(costDetailsTotals)}

                                <h3>Volume Plan {volumeKeyUsed ? `(from DB key: ${volumeKeyUsed})` : "(local data)"}</h3>
                                {renderFixedTable(volumePlanColumns, volumePlanRows)}
                                {renderTotals(volumePlanTotals)}



                                <button
                                    onClick={closeModal}
                                    style={{
                                        marginTop: '2rem',
                                        backgroundColor: '#4a90e2',
                                        color: '#fff',
                                        fontWeight: '700',
                                        fontSize: '1.1rem',
                                        padding: '0.75rem 1.5rem',
                                        border: 'none',
                                        borderRadius: '8px',
                                        float: 'right',
                                        cursor: 'pointer',
                                        boxShadow: '0 6px 15px rgba(74, 144, 226, 0.5)',
                                        transition: 'background-color 0.3s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#357ABD')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4a90e2')}
                                    aria-label="Close Modal"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}






                </div>

                {/* Fixed footer pagination */}
                <footer
                    style={{
                        padding: "0.5rem 1rem",
                        display: "flex",
                        gap: "10px",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        marginTop: "10px",
                        borderTop: "1px solid #ccc",
                    }}
                >
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: currentPage === 1 ? "#ccc" : "#1976d2",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        }}
                    >
                        Prev
                    </button>

                    <span style={{ margin: "0 10px" }}>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                            padding: "6px 12px",
                            backgroundColor: currentPage === totalPages ? "#ccc" : "#1976d2",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                        }}
                    >
                        Next
                    </button>
                </footer>



            </div>
        </div>
    );
}


const buttonStyle = {
    border: "none",
    background: "none",
    cursor: "pointer",
    padding: "8px",
    color: "#d32f2f",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    outline: "none",
};

const handleMouseEnter = (e) => {
    e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
    e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.5)";
};

const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = "scale(1) rotateX(0) rotateY(0)";
    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
};

const handleMouseDown = (e) => {
    e.currentTarget.style.transform = "scale(0.95) rotateX(5deg) rotateY(5deg)";
    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
};

const handleMouseUp = (e) => {
    e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
    e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.5)";
};

const thStyle = {
    border: "1px solid #ccc",
    padding: "8px",
    textAlign: "left",
};

const tdStyle = {
    border: "1px solid #ccc",
    padding: "8px",
};
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
};

const modalContentStyle = {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '1200px', // set a max width for readability
    maxHeight: '85vh',
    overflowY: 'auto',
    position: 'relative',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
};

const closeButtonStyle = {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    background: 'transparent',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer'
};
const thTdStyle = {
    borderBottom: "1px solid #ddd",
    padding: "8px",
    verticalAlign: "top",
    textAlign: "center",
};

const buttonBaseStyle = {
    cursor: "pointer",
    border: "none",
    borderRadius: 4,
    padding: "6px 12px",
    backgroundColor: "#2196f3",
    color: "#fff",
    fontSize: 14,
    transition: "background-color 0.3s ease",
};


export default RecordsPage;
