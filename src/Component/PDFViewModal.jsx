
import React, { useState, useEffect } from 'react';
import { supabase } from "../supabaseClient";
import logomega from '../Assets/logomega.png';

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { saveAs } from "file-saver";


function PDFViewModal({ record, onClose }) {

    const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [fullRecord, setFullRecord] = useState(null);
    const [loading, setLoading] = useState(true);

    const [accountList, setAccountList] = useState([]);
const [skuProductMap, setSkuProductMap] = useState({});

    useEffect(() => {
        const fetchAccountList = async () => {
            const source = fullRecord || record;
            if (!source?.accounts || source.source !== "regular_pwp") return;

            const { data: accountData, error } = await supabase
                .from("regular_accountlis_badget")
                .select("account_name, budget, total_budget")
                .eq("regularcode", source.regularpwpcode || source.code);

            if (error) {
                console.error("Error fetching account list:", error.message);
            } else {
                setAccountList(accountData || []);
            }
        };

        fetchAccountList();
    }, [fullRecord, record]);

    const [creatorName, setCreatorName] = useState("");
    useEffect(() => {
        const fetchCreatorName = async () => {
            // Use fullRecord first if available, otherwise record
            const source = fullRecord || record;
            if (!source?.createForm) return;

            // Fetch user name based on matching UserID
            const { data: userData, error } = await supabase
                .from("Account_Users")
                .select("name")
                .eq("UserID", source.createForm)
                .single();

            if (error) {
                console.error("Error fetching user name:", error.message);
            } else {
                setCreatorName(userData?.name || "Unknown");
            }
        };

        fetchCreatorName();
    }, [fullRecord, record]);
    const [distributorName, setDistributorName] = useState("");

    useEffect(() => {
        const fetchDistributorName = async () => {
            const source = fullRecord || record;
            if (!source?.distributor) return;

            const { data: distData, error } = await supabase
                .from("distributors")
                .select("name")
                .eq("code", source.distributor)
                .single();

            if (error) {
                console.error("Error fetching distributor name:", error.message);
            } else {
                setDistributorName(distData?.name || "Unknown");
            }
        };

        fetchDistributorName();
    }, [fullRecord, record]);
    const [activityName, setActivityName] = useState("");

    useEffect(() => {
        const fetchActivityName = async () => {
            const source = fullRecord || record;
            if (!source?.activity) return;

            const { data: actData, error } = await supabase
                .from("activity")
                .select("name")
                .eq("code", source.activity)
                .single();

            if (error) {
                console.error("Error fetching activity name:", error.message);
            } else {
                setActivityName(actData?.name || "Unknown");
            }
        };

        fetchActivityName();
    }, [fullRecord, record]);
 const [skuList, setSkuList] = useState([]);
useEffect(() => {
    const fetchProductNames = async () => {
        // First check if we already have the map from RecordsPage
        if (record?.sku_product_map) {
            setSkuProductMap(record.sku_product_map);
            console.log("✅ Using SKU map from RecordsPage:", record.sku_product_map);
            return;
        }

        // Otherwise fetch from category_listing
        if (skuList.length === 0) return;

        const skuCodes = skuList.map(item => item.sku_code).filter(Boolean);
        if (skuCodes.length === 0) return;

        try {
            const { data: productData, error } = await supabase
                .from("category_listing")
                .select("sku_code, name")
                .in("sku_code", skuCodes);

            if (error) {
                console.error("Error fetching product names:", error);
                return;
            }

            const map = {};
            productData?.forEach(item => {
                map[String(item.sku_code)] = item.name;
            });
            
            setSkuProductMap(map);
            console.log("✅ SKU Product Map loaded:", map);
        } catch (err) {
            console.error("Failed to fetch product names:", err);
        }
    };

    fetchProductNames();
}, [skuList, record]);
   

    useEffect(() => {
        const fetchSKUList = async () => {
            const source = fullRecord || record;
            if (!source?.sku || source.source !== "regular_pwp") return;

            const { data: skuData, error } = await supabase
                .from("regular_sku")
                .select("sku_code, account_name, srp, qty, uom, billing_amount, discount, total_amount, remaining_balance")
                .eq("regular_code", source.regularpwpcode || source.code);

            if (error) {
                console.error("Error fetching SKU list:", error.message);
            } else {
                setSkuList(skuData || []);
            }
        };

        fetchSKUList();
    }, [fullRecord, record]);
    useEffect(() => {
        const fetchFullRecord = async () => {
            if (!record) return;

            try {
                setLoading(true);
                let data = null;

                if (record.source === 'regular_pwp') {
                    // Fetch ALL columns from regular_pwp
                    const { data: regularData, error } = await supabase
                        .from('regular_pwp')
                        .select('*')
                        .eq('id', record.id)
                        .single();

                    if (error) throw error;
                    data = regularData;
                } else if (record.source === 'cover_pwp') {
                    // Fetch ALL columns from cover_pwp
                    const { data: coverData, error } = await supabase
                        .from('cover_pwp')
                        .select('*')
                        .eq('id', record.id)
                        .single();

                    if (error) throw error;
                    data = coverData;
                }

                setFullRecord({ ...data, source: record.source, approval_status: record.approval_status });
            } catch (err) {
                console.error('Error fetching full record:', err);
                setFullRecord(record); // Fallback to passed record
            } finally {
                setLoading(false);
            }
        };

        fetchFullRecord();
    }, [record]);

    if (!record) return null;

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            });
        } catch {
            return dateString;
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    const formatCurrency = (value) => {
        if (!value && value !== 0) return '-';
        return `₱ ${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatArray = (arr) => {
        if (!arr) return '-';
        if (Array.isArray(arr)) {
            return arr.length > 0 ? arr.join(', ') : '-';
        }
        return String(arr);
    };

    const getStatusColor = (status) => {
        const statusLower = status ? status.toLowerCase() : 'pending';
        switch (statusLower) {
            case 'approved': return '#2e7d32';
            case 'declined': return '#c62828';
            case 'sent back for revision':
            case 'sent back': return '#e65100';
            case 'cancelled': return '#7b1fa2';
            default: return '#8a6d3b';
        }
    };



const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    try {
        const data = fullRecord || record || {};
        const pwpCode = data.regularpwpcode || data.cover_code || data.code || 'N/A';
        const recordType = data.source === 'cover_pwp' ? 'Cover PWP' : 'Regular PWP';

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = 10;

        // ===== Header Section with Logo and Info Box =====
        try {
            // Add logo image to PDF (left side)
            doc.addImage(logomega, 'PNG', margin, yPos, 60, 18);
        } catch (error) {
            console.warn('Could not add logo to PDF:', error);
        }

        // PWP Code, Type, and Status Box on the right side
        const boxX = pageWidth - margin - 65;
        const boxY = yPos;
        const boxWidth = 65;
        const boxHeight = 24;

        // Draw rounded border for info box
        doc.setDrawColor(25, 118, 210);
        doc.setLineWidth(0.5);
        doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2);

        // Add light background
        doc.setFillColor(240, 248, 255);
        doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');
        doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'S');

        let rightY = boxY + 6;
        const labelX = boxX + 3;
        const valueX = boxX + 22;

        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        
        // PWP Code
        doc.setFont('helvetica', 'bold');
        doc.text('PWP Code:', labelX, rightY);
        doc.setFont('helvetica', 'normal');
        doc.text(pwpCode, valueX, rightY);
        rightY += 6;

        // Type
        doc.setFont('helvetica', 'bold');
        doc.text('Type:', labelX, rightY);
        doc.setFont('helvetica', 'normal');
        doc.text(recordType, valueX, rightY);
        rightY += 6;

        // Status with colored badge
        doc.setFont('helvetica', 'bold');
        doc.text('Status:', labelX, rightY);
        
        const statusText = data.approval_status || 'Pending';
        const statusColors = {
            'Approved': [46, 125, 50],
            'Pending': [255, 152, 0],
            'Declined': [211, 47, 47],
            'Sent Back': [245, 124, 0]
        };
        const statusColor = statusColors[statusText] || [138, 109, 59];
        
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(statusText, valueX, rightY);

        yPos += 30;

        // ===== Horizontal line separator =====
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;



        // Helper function to check if we need a new page
        const checkPageBreak = (requiredHeight) => {
            if (yPos + requiredHeight > pageHeight - 20) {
                doc.addPage();
                yPos = 20;
                return true;
            }
            return false;
        };

        // Helper to sanitize text for PDF (remove special characters that cause encoding issues)
        const sanitizeForPDF = (text) => {
            if (!text) return '-';
            return String(text)
                .replace(/₱/g, 'PHP ')
                .replace(/[^\x00-\x7F]/g, '')
                .trim();
        };

        // Helper to draw a simple table
        const drawTable = (headers, rows, colWidths) => {
            const rowHeight = 10;
            const headerHeight = 12;
            
            // Draw header with gradient effect
            doc.setFillColor(25, 118, 210);
            doc.roundedRect(margin, yPos, pageWidth - 2 * margin, headerHeight, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            
            let xPos = margin + 4;
            headers.forEach((header, i) => {
                doc.text(String(header), xPos, yPos + 8);
                xPos += colWidths[i];
            });
            
            yPos += headerHeight;
            
            // Draw rows with alternating colors
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            rows.forEach((row, rowIndex) => {
                checkPageBreak(rowHeight + 2);
                
                // Alternating row colors
                if (rowIndex % 2 === 0) {
                    doc.setFillColor(248, 249, 250);
                } else {
                    doc.setFillColor(255, 255, 255);
                }
                doc.rect(margin, yPos, pageWidth - 2 * margin, rowHeight, 'F');
                
                // Draw subtle row border
                doc.setDrawColor(230, 230, 230);
                doc.setLineWidth(0.1);
                doc.line(margin, yPos + rowHeight, pageWidth - margin, yPos + rowHeight);
                
                xPos = margin + 4;
                row.forEach((cell, i) => {
                    const text = sanitizeForPDF(cell);
                    const maxWidth = colWidths[i] - 6;
                    
                    // Bold for TOTAL row
                    if (String(cell).toUpperCase() === 'TOTAL') {
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(25, 118, 210);
                    }
                    
                    const lines = doc.splitTextToSize(text, maxWidth);
                    doc.text(lines[0], xPos, yPos + 7);
                    
                    // Reset font
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(0, 0, 0);
                    
                    xPos += colWidths[i];
                });
                
                yPos += rowHeight;
            });
            
            // Draw table border
            doc.setDrawColor(25, 118, 210);
            doc.setLineWidth(0.5);
            doc.rect(margin, yPos - (rows.length * rowHeight) - headerHeight, pageWidth - 2 * margin, (rows.length * rowHeight) + headerHeight);
            
            yPos += 8;
        };

        // ===== Basic Info Section =====
        checkPageBreak(40);
        doc.setFontSize(13);
        doc.setFillColor(25, 118, 210);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 1, 1, 'F');
        doc.text('BASIC INFORMATION', margin + 5, yPos + 7);
        yPos += 14;

        const basicInfo = [];
        
        if (data.source === 'regular_pwp') {
            basicInfo.push(
                ['PWP Type', data.pwptype || data.pwp_type || '-'],
                ['Branch Type', data.branchType || '-'],
                ['Distributor', distributorName || data.distributor || '-'],
                ['Account Type', formatArray(data.accountType)],
                ['Activity', activityName || data.activity || '-'],
                ['Promo Scheme', data.promoScheme || '-'],
                ['Duration From', formatDate(data.activityDurationFrom)],
                ['Duration To', formatDate(data.activityDurationTo)],
                ['Credit Budget', formatCurrency(data.credit_budget)],
                ['Remaining Balance', formatCurrency(data.remaining_balance)]
            );
        } else {
            basicInfo.push(
                ['Cover Code', data.cover_code || '-'],
                ['Distributor Code', data.distributor_code || '-'],
                ['PWP Type', data.pwp_type || '-'],
                ['Amount Budget', formatCurrency(data.amount_badget)],
                ['Notification', data.notification ? 'Enabled' : 'Disabled']
            );
        }

        drawTable(['Field', 'Value'], basicInfo, [60, 120]);

        // ===== Objective (if exists) =====
        if (data.source === 'regular_pwp' && data.objective) {
            checkPageBreak(30);
            
            // Objective box
            doc.setFillColor(250, 250, 250);
            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 8, 1, 1, 'FD');
            
            doc.setFontSize(11);
            doc.setTextColor(25, 118, 210);
            doc.setFont('helvetica', 'bold');
            doc.text('Objective:', margin + 3, yPos + 6);
            yPos += 12;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            const splitObjective = doc.splitTextToSize(data.objective, pageWidth - 2 * margin - 6);
            
            // Draw background for objective text
            const objHeight = splitObjective.length * 5 + 4;
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin, yPos - 2, pageWidth - 2 * margin, objHeight, 1, 1, 'F');
            
            doc.text(splitObjective, margin + 3, yPos);
            yPos += splitObjective.length * 5 + 8;
        }

        // ===== Account List =====
        if (accountList && accountList.length > 0) {
            checkPageBreak(40);
            doc.setFontSize(13);
            doc.setFillColor(25, 118, 210);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 1, 1, 'F');
            doc.text('ACCOUNTS BUDGET', margin + 5, yPos + 7);
            yPos += 14;

            const accountTableData = accountList.map(item => [
                item.account_name || '-',
                formatCurrency(item.budget),
                formatCurrency(item.total_budget)
            ]);

            const totalBudget = accountList.reduce(
                (sum, item) => sum + Number(item.total_budget || 0),
                0
            );
            accountTableData.push(['TOTAL', '', formatCurrency(totalBudget)]);

            drawTable(['Account Name', 'Budget', 'Total Budget'], accountTableData, [70, 55, 55]);
        }

        // ===== SKU List =====
     if (skuList && skuList.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(13);
    doc.setFillColor(25, 118, 210);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 1, 1, 'F');
    doc.text('SKU INFORMATION', margin + 5, yPos + 7);
    yPos += 14;

    const skuTableData = skuList.map(item => {
        const productName = skuProductMap[String(item.sku_code)] || '-';
        return [
            item.sku_code || '-',
            productName,  // ✅ ADD PRODUCT NAME HERE
            item.account_name || '-',
            formatCurrency(item.srp),
            item.qty || '-',
            item.uom || '-',
            formatCurrency(item.billing_amount),
            formatCurrency(item.discount),
            formatCurrency(item.total_amount)
        ];
    });

    const totalAmount = skuList.reduce(
        (sum, item) => sum + Number(item.total_amount || 0),
        0
    );
    skuTableData.push(['', '', '', '', '', '', '', 'TOTAL', formatCurrency(totalAmount)]);

    drawTable(
        ['SKU', 'Product Name', 'Account', 'SRP', 'Qty', 'UOM', 'Billing', 'Disc', 'Total'],
        skuTableData,
        [18, 35, 22, 18, 12, 12, 18, 18, 22]  // ✅ Adjusted column widths
    );
}
        // ===== System Information =====
        checkPageBreak(30);
        doc.setFontSize(13);
        doc.setFillColor(25, 118, 210);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 10, 1, 1, 'F');
        doc.text('SYSTEM INFORMATION', margin + 5, yPos + 7);
        yPos += 14;

        const systemInfo = [
            ['Assigned By', creatorName || 'Unknown'],
            ['Created Date', formatDateTime(data.created_at)]
        ];

        drawTable(['Field', 'Value'], systemInfo, [60, 120]);

        // ===== Footer on all pages =====
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Footer line
            doc.setDrawColor(25, 118, 210);
            doc.setLineWidth(0.5);
            doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
            
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            
            // Page number
            doc.text(
                `Page ${i} of ${pageCount}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
            
            // Generated date
            doc.text(
                `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
                margin,
                pageHeight - 10
            );
            
            // Company/System name
            doc.text(
                'PWP System',
                pageWidth - margin,
                pageHeight - 10,
                { align: 'right' }
            );
        }

        // ===== Save File =====
        doc.save(`PWP_${pwpCode}_${new Date().toISOString().split('T')[0]}.pdf`);
        console.log('✅ PDF generated successfully');
    } catch (error) {
        console.error('❌ PDF generation failed:', error);
        alert('Error generating PDF: ' + error.message);
    } finally {
        setIsGeneratingPDF(false);
    }
};
    // NEW: Excel Export
    const handleExportExcel = () => {
        setIsGeneratingExcel(true);

        try {
            const data = fullRecord || record;
            const pwpCode = data.regularpwpcode || data.cover_code || data.code || 'N/A';

            const workbook = XLSX.utils.book_new();

            // Sheet 1: Basic Information
            const basicData = [];
            basicData.push(['PWP RECORD DETAILS']);
            basicData.push(['PWP Code', pwpCode]);
            basicData.push(['Type', data.source === 'cover_pwp' ? 'Cover PWP' : 'Regular PWP']);
            basicData.push(['Status', data.approval_status || 'Pending']);
            basicData.push([]);

            if (data.source === 'regular_pwp') {
                basicData.push(['BASIC INFORMATION']);
                basicData.push(['PWP Type', data.pwptype || data.pwp_type || '-']);
                basicData.push(['Branch Type', data.branchType || '-']);
                basicData.push(['Distributor', distributorName || data.distributor || '-']);
                basicData.push(['Account Type', formatArray(data.accountType)]);
                basicData.push([]);

                basicData.push(['ACTIVITY DETAILS']);
                basicData.push(['Activity', activityName || data.activity || '-']);
                basicData.push(['Promo Scheme', data.promoScheme || '-']);
                basicData.push(['Duration From', formatDate(data.activityDurationFrom)]);
                basicData.push(['Duration To', formatDate(data.activityDurationTo)]);
                basicData.push(['Objective', data.objective || '-']);
                basicData.push([]);

                basicData.push(['BUDGET INFORMATION']);
                basicData.push(['Credit Budget', data.credit_budget || 0]);
                basicData.push(['Remaining Balance', data.remaining_balance || 0]);
                basicData.push([]);

                basicData.push(['CATEGORY INFORMATION']);
                basicData.push(['Category Code', data.categoryCode || '-']);
                basicData.push(['Category Name', data.categoryName || '-']);
            } else {
                basicData.push(['COVER PWP INFORMATION']);
                basicData.push(['Cover Code', data.cover_code || '-']);
                basicData.push(['Distributor Code', data.distributor_code || '-']);
                basicData.push(['PWP Type', data.pwp_type || '-']);
                basicData.push(['Amount Budget', data.amount_badget || 0]);
                basicData.push(['Notification', data.notification ? 'Enabled' : 'Disabled']);
            }

            basicData.push([]);
            basicData.push(['SYSTEM INFORMATION']);
            basicData.push(['Assigned By', creatorName || 'Unknown']);
            basicData.push(['Created Date', formatDateTime(data.created_at)]);

            const ws1 = XLSX.utils.aoa_to_sheet(basicData);
            XLSX.utils.book_append_sheet(workbook, ws1, 'Basic Info');

            // Sheet 2: Account List (if available)
            if (data.source === 'regular_pwp' && data.accounts && accountList.length > 0) {
                const accountData = [
                    ['Account Name', 'Budget', 'Total Budget']
                ];

                accountList.forEach(item => {
                    accountData.push([
                        item.account_name,
                        Number(item.budget),
                        Number(item.total_budget)
                    ]);
                });

                const totalBudget = accountList.reduce((sum, item) => sum + Number(item.total_budget || 0), 0);
                accountData.push(['TOTAL', '', totalBudget]);

                const ws2 = XLSX.utils.aoa_to_sheet(accountData);
                XLSX.utils.book_append_sheet(workbook, ws2, 'Accounts');
            }

            // Sheet 3: SKU List (if available)
            if (data.source === 'regular_pwp' && data.sku && skuList.length > 0) {
                const skuData = [
                    ['SKU Code', 'Account Name', 'SRP', 'Qty', 'UOM', 'Billing Amount', 'Discount', 'Total Amount']
                ];

                skuList.forEach(item => {
                    skuData.push([
                        item.sku_code,
                        item.account_name,
                        Number(item.srp),
                        item.qty,
                        item.uom,
                        Number(item.billing_amount),
                        Number(item.discount),
                        Number(item.total_amount)
                    ]);
                });

                const totalAmount = skuList.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
                skuData.push(['', '', '', '', '', '', 'TOTAL', totalAmount]);

                const ws3 = XLSX.utils.aoa_to_sheet(skuData);
                XLSX.utils.book_append_sheet(workbook, ws3, 'SKU List');
            }

            // Save Excel file
            XLSX.writeFile(workbook, `PWP_${pwpCode}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Error generating Excel:', error);
            alert('Error generating Excel. Please try again.');
        } finally {
            setIsGeneratingExcel(false);
        }
    };

    const handlePrintPDF = () => {
        setIsGeneratingPDF(true);
        setTimeout(() => {
            window.print();
            setIsGeneratingPDF(false);
        }, 100);
    };

    if (!record) return null;

    if (loading) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 9998,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div style={{
                    backgroundColor: 'white',
                    padding: '40px',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #e3f2fd',
                        borderTop: '4px solid #1976d2',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }}></div>
                    <p style={{ margin: 0, color: '#333' }}>Loading full record...</p>
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    const data = fullRecord || record;
    const pwpCode = data.regularpwpcode || data.cover_code || data.code || 'N/A';
    const recordType = data.source === 'cover_pwp' ? 'Cover PWP' : 'Regular PWP';




    return (
        <>
            {/* Modal Overlay */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 9998,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px',
                    animation: 'fadeIn 0.3s ease'
                }}
                onClick={onClose}
            >
                <div
                    style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        maxWidth: '1200px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.3s ease'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Control Buttons (Hidden in Print) */}
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            maxWidth: '1200px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            animation: 'slideUp 0.3s ease'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="no-print" style={{
                            padding: '20px 30px',
                            borderBottom: '2px solid #e0e0e0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#f8f9fa'
                        }}>
                            <h2 style={{ margin: 0, color: '#1976d2', fontSize: '20px' }}>
                                📄 Document Preview
                            </h2>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={handleExportPDF}
                                    disabled={isGeneratingPDF}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#d32f2f',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: isGeneratingPDF ? 0.6 : 1
                                    }}
                                >
                                    📄 {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    disabled={isGeneratingExcel}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#217346',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isGeneratingExcel ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: isGeneratingExcel ? 0.6 : 1
                                    }}
                                >
                                    📊 {isGeneratingExcel ? 'Generating...' : 'Export Excel'}
                                </button>
                                <button
                                    onClick={handlePrintPDF}
                                    disabled={isGeneratingPDF}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#ff9800',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: isGeneratingPDF ? 0.6 : 1
                                    }}
                                >
                                    🖨️ Print
                                </button>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#757575',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600'
                                    }}
                                >
                                    ✕ Close
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* PDF Content */}
                    <div id="pdf-content" style={{
                        padding: '40px',
                        backgroundColor: 'white'
                    }}>
                        {/* Header with Logo and PWP Code */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '30px',
                            paddingBottom: '20px',
                            borderBottom: '3px solid #1976d2'
                        }}>
                            {/* Left: Logo */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <img
                                    src={logomega}
                                    alt="Logo"
                                    style={{
                                        width: '280px',
                                        height: 'auto',
                                        objectFit: 'contain',
                                    }}
                                />
                                <p
                                    style={{
                                        marginTop: '6px',
                                        fontSize: '12px',
                                        color: '#666',
                                        fontStyle: 'italic',
                                    }}
                                >
                                    Price Without Price System
                                </p>
                            </div>

                            {/* Right: PWP Code and Info */}
                            <div
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    textAlign: 'right',
                                    gap: '12px',
                                }}
                            >
                                {/* PWP Code Box */}
                                <div
                                    style={{
                                        backgroundColor: '#e3f2fd',
                                        padding: '14px 28px',
                                        borderRadius: '10px',
                                        border: '2px solid #1976d2',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: '13px',
                                            color: '#555',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.8px',
                                        }}
                                    >
                                        PWP Code
                                    </p>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: '26px',
                                            fontWeight: '700',
                                            color: '#1976d2',
                                            marginTop: '4px',
                                        }}
                                    >
                                        {pwpCode}
                                    </p>
                                </div>

                                {/* Status Badge */}
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '10px 30px',
                                        borderRadius: '30px',
                                        fontSize: '15px',
                                        fontWeight: '700',
                                        backgroundColor: `${getStatusColor(data.approval_status)}15`,
                                        color: getStatusColor(data.approval_status),
                                        border: `2px solid ${getStatusColor(data.approval_status)}`,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.8px',
                                        minWidth: '180px',
                                        textAlign: 'center',
                                    }}
                                >
                                    Status: {data.approval_status || 'Pending'}
                                </div>

                                {/* Generated Date */}
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: '12px',
                                        color: '#777',
                                        marginTop: '6px',
                                        fontStyle: 'italic',
                                    }}
                                >
                                    Generated: {new Date().toLocaleDateString()}
                                </p>
                            </div>

                        </div>

                        {/* Status Badge */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: '30px'
                        }}>

                        </div>

                        {/* Document Title */}
                        <h1 style={{
                            textAlign: 'center',
                            color: '#1976d2',
                            fontSize: '28px',
                            fontWeight: '700',
                            marginBottom: '40px',
                            textTransform: 'uppercase',
                            letterSpacing: '2px'
                        }}>
                            PWP Record Details
                        </h1>

                        {/* Basic Information - Regular PWP Only */}
                        {data.source === 'regular_pwp' && (
                            <>
                                <SectionHeader title="Basic Information" />
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '30px'
                                }}>
                                    <DetailItem label="PWP Type" value={data.pwptype || data.pwp_type} />
                                    <DetailItem label="Branch Type" value={data.branchType} />
                                    <DetailItem label="Distributor" value={distributorName || data.distributor} />
                                    <DetailItem label="Account Type" value={formatArray(data.accountType)} />
                                </div>
                            </>
                        )}

                        {/* Activity Details - Regular PWP Only */}
                        {data.source === 'regular_pwp' && (
                            <>
                                <SectionHeader title="Activity Details" />
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '30px'
                                }}>
                                    <DetailItem label="Activity" value={activityName || data.activity} />
                                    <DetailItem label="Promo Scheme" value={data.promoScheme} />
                                    <DetailItem label="Activity Duration From" value={formatDate(data.activityDurationFrom)} />
                                    <DetailItem label="Activity Duration To" value={formatDate(data.activityDurationTo)} />
                                </div>

                                {/* Objective */}
                                {data.objective && (
                                    <div style={{ marginBottom: '30px' }}>
                                        <DetailItemFull label="Objective" value={data.objective} />
                                    </div>
                                )}

                                {/* Budget Information */}
                                <SectionHeader title="Budget Information" />
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '30px'
                                }}>
                                    <DetailItem label="Credit Budget" value={data.credit_budget ? formatCurrency(data.credit_budget) : '-'} />
                                    <DetailItem label="Remaining Balance" value={data.remaining_balance ? formatCurrency(data.remaining_balance) : '-'} />
                                </div>

                                {/* Category Information */}
                                <SectionHeader title="Category Information" />
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '30px'
                                }}>
                                    <DetailItem label="Category Code" value={data.categoryCode} />
                                    <DetailItem label="Category Name" value={data.categoryName} />
                                </div>

                                {/* Cover PWP Link */}
                                {data.isPartOfCoverPwp && (
                                    <>
                                        <SectionHeader title="Cover PWP Link" />
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '20px',
                                            marginBottom: '30px'
                                        }}>
                                            <DetailItem label="Is Part of Cover PWP" value={data.isPartOfCoverPwp ? 'Yes' : 'No'} />
                                            <DetailItem label="Cover PWP Code" value={data.coverPwpCode} />
                                        </div>
                                    </>
                                )}

                                {/* Display Settings */}
                                <SectionHeader title="Display Settings" />
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '30px'
                                }}>
                                    <DetailItem label="SKU Enabled" value={data.sku ? 'Yes' : 'No'} />
                                    <DetailItem label="Accounts Enabled" value={data.accounts ? 'Yes' : 'No'} />
                                    <DetailItem label="Amount Display" value={data.amount_display ? 'Yes' : 'No'} />
                                    <DetailItem label="Notification" value={data.notification ? 'Enabled' : 'Disabled'} />
                                </div>

                                {/* Remarks */}
                                {data.remarks && (
                                    <div style={{ marginBottom: '30px' }}>
                                        <DetailItemFull label="Remarks" value={data.remarks} />
                                    </div>
                                )}
                            </>
                        )}
                        {/* SKU TABLE - Only for Regular PWP */}



                        {/* Cover PWP Specific Information */}
                        {data.source === 'cover_pwp' && (
                            <>
                                <SectionHeader title="Cover PWP Information" />
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '30px'
                                }}>
                                    <DetailItem label="Cover Code" value={data.cover_code} />
                                    <DetailItem label="Distributor Code" value={data.distributor_code} />
                                    <DetailItem label="PWP Type" value={data.pwp_type} />
                                    <DetailItem label="Amount Budget" value={data.amount_badget ? formatCurrency(data.amount_badget) : '-'} />
                                    <DetailItem label="Notification" value={data.notification ? 'Enabled' : 'Disabled'} />
                                </div>

                                {/* Cover PWP Remarks */}
                                {data.remarks && (
                                    <div style={{ marginBottom: '30px' }}>
                                        <DetailItemFull label="Remarks" value={data.remarks} />
                                    </div>
                                )}
                            </>
                        )}

                        {/* System Information */}
                        <SectionHeader title="System Information" />
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '20px',
                            marginBottom: '30px'
                        }}>
                            <DetailItem label="Assigne By" value={creatorName || "Loading..."} />
                            <DetailItem label="Created Date" value={formatDateTime(data.created_at)} />
                        </div>

                        {data.source === "regular_pwp" && data.accounts && accountList.length > 0 && (
                            <>
                                <SectionHeader title="Accounts Budget Information" />
                                <div style={{ overflowX: "auto", marginBottom: "30px" }}>
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            fontSize: "14px",
                                        }}
                                    >
                                        <thead>
                                            <tr
                                                style={{
                                                    backgroundColor: "#1976d2",
                                                    color: "white",
                                                    textAlign: "left",
                                                }}
                                            >
                                                <th style={{ padding: "10px", border: "1px solid #ddd" }}>Account Name</th>
                                                <th style={{ padding: "10px", border: "1px solid #ddd" }}>Budget</th>
                                                <th style={{ padding: "10px", border: "1px solid #ddd" }}>Total Budget</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {accountList.map((item, idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        backgroundColor: idx % 2 === 0 ? "#fafafa" : "#ffffff",
                                                    }}
                                                >
                                                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{item.account_name}</td>
                                                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                                                        ₱{Number(item.budget).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                                                        ₱{Number(item.total_budget).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Total Row */}
                                            <tr style={{ backgroundColor: "#e3f2fd", fontWeight: "bold" }}>
                                                <td
                                                    colSpan="2"
                                                    style={{ padding: "10px", border: "1px solid #ddd", textAlign: "right" }}
                                                >
                                                    TOTAL:
                                                </td>
                                                <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                                                    ₱
                                                    {accountList
                                                        .reduce((sum, item) => sum + Number(item.total_budget || 0), 0)
                                                        .toLocaleString()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}


                       {data.source === "regular_pwp" && data.sku && skuList.length > 0 && (
    <>
        <SectionHeader title="SKU Information" />
        <div style={{ overflowX: "auto", marginBottom: "30px" }}>
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14px",
                }}
            >
                <thead>
                    <tr
                        style={{
                            backgroundColor: "#1976d2",
                            color: "white",
                            textAlign: "left",
                        }}
                    >
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>SKU Code</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Product Name</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Account Name</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>SRP</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Qty</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>UOM</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Billing Amount</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Discount</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Total Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {skuList.map((item, idx) => {
                        const productName = skuProductMap[String(item.sku_code)] || '-';
                        
                        return (
                            <tr
                                key={idx}
                                style={{
                                    backgroundColor: idx % 2 === 0 ? "#fafafa" : "#ffffff",
                                }}
                            >
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>{item.sku_code}</td>
                                <td style={{ padding: "8px", border: "1px solid #ddd", fontWeight: "500" }}>
                                    {productName}
                                </td>
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>{item.account_name}</td>
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>₱{Number(item.srp).toLocaleString()}</td>
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>{item.qty}</td>
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>{item.uom}</td>
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>₱{Number(item.billing_amount).toLocaleString()}</td>
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>₱{Number(item.discount).toLocaleString()}</td>
                                <td style={{ padding: "8px", border: "1px solid #ddd" }}>₱{Number(item.total_amount).toLocaleString()}</td>
                            </tr>
                        );
                    })}

                    {/* Total Row */}
                    <tr style={{ backgroundColor: "#e3f2fd", fontWeight: "bold" }}>
                        <td
                            colSpan="8"
                            style={{ padding: "10px", border: "1px solid #ddd", textAlign: "right" }}
                        >
                            TOTAL:
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                            ₱
                            {skuList
                                .reduce((sum, item) => sum + Number(item.total_amount || 0), 0)
                                .toLocaleString()}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </>
)}

                        {/* Footer */}
                        <div style={{
                            marginTop: '60px',
                            paddingTop: '20px',
                            borderTop: '2px solid #e0e0e0',
                            textAlign: 'center'
                        }}>
                            <p style={{
                                margin: 0,
                                fontSize: '12px',
                                color: '#999'
                            }}>
                                This is a system-generated document. No signature required.
                            </p>
                            <p style={{
                                margin: '8px 0 0 0',
                                fontSize: '11px',
                                color: '#bbb'
                            }}>
                                © {new Date().getFullYear()} PWP System. All rights reserved.
                            </p>
                        </div>




                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #pdf-content, #pdf-content * {
            visibility: visible;
          }
          #pdf-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 40px !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0.5in;
            size: A4;
          }
        }
      `}</style>
        </>
    );
}


// Section Header Component
function SectionHeader({ title }) {
    return (
        <div style={{
            backgroundColor: '#1976d2',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontWeight: '700',
            fontSize: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
        }}>
            {title}
        </div>
    );
}

// Helper Component for Detail Items
function DetailItem({ label, value, small }) {
    return (
        <div style={{
            padding: small ? '12px' : '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
        }}>
            <p style={{
                margin: '0 0 6px 0',
                fontSize: small ? '11px' : '12px',
                color: '#666',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                {label}
            </p>
            <p style={{
                margin: 0,
                fontSize: small ? '13px' : '15px',
                color: '#333',
                fontWeight: '500',
                wordBreak: 'break-word'
            }}>
                {value || '-'}
            </p>
        </div>
    );
}

// Full Width Detail Item (for long text like Objective/Remarks)
function DetailItemFull({ label, value }) {
    return (
        <div style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
        }}>
            <p style={{
                margin: '0 0 10px 0',
                fontSize: '12px',
                color: '#666',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                {label}
            </p>
            <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#333',
                fontWeight: '400',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            }}>
                {value || '-'}
            </p>
        </div>
    );
}

export default PDFViewModal;
