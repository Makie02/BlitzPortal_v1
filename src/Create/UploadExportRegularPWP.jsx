import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from 'xlsx-js-style';

const PAGE_SIZE = 10;

// ============================================================
// TEMPLATE COLUMN MAPPINGS (outside component - no re-render)
// ============================================================
const OPOR_COL = {
    "DocDate": 5,
    "DocDueDate": 6,
    "CardCode": 7,
    "CardName": 8,
    "NumAtCard": 10,
    "SlpCode": 20,
    "TaxDate": 28,
    "U_AP_APVNO": 141,
    "U_G_PREPBY": 148,
    "U_G_REMARKS": 152,
};

const POR1_COL = {
    "NumAtCard": 2,
    "Dscription": 5,
    "AcctCode": 19,
    "PriceBefDi": 80,
    "U_U_Customers": 145,
    "U_Start_Date": 152,
    "U_End_Date": 153,
};

const OPOR_TOTAL_COLS = 244;
const POR1_TOTAL_COLS = 170;

// ============================================================
// PURE HELPERS (outside component)
// ============================================================
const formatDateYYYYMMDD = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
};

const cleanText = (text, maxLen = 32767) => {
    if (!text) return "";
    const cleaned = String(text).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
};

const blankRow = (totalCols) => Array(totalCols).fill(null);

const buildOporRows = (filteredData, freshApprovalMap, distributorMap, userMap) => {
    return filteredData.map((r) => {
        const row = blankRow(OPOR_TOTAL_COLS);
        row[OPOR_COL["DocDate"] - 1] = formatDateYYYYMMDD(freshApprovalMap[r.regularpwpcode]?.date);
        row[OPOR_COL["DocDueDate"] - 1] = formatDateYYYYMMDD(freshApprovalMap[r.regularpwpcode]?.date);
        row[OPOR_COL["CardCode"] - 1] = distributorMap[r.distributor]?.sap_vendor_code ?? "";
        row[OPOR_COL["CardName"] - 1] = cleanText(distributorMap[r.distributor]?.name || r.distributor);
        row[OPOR_COL["NumAtCard"] - 1] = r.regularpwpcode;
        row[OPOR_COL["SlpCode"] - 1] = distributorMap[r.distributor]?.slp ?? "";
        row[OPOR_COL["TaxDate"] - 1] = formatDateYYYYMMDD(r.created_at);
        row[OPOR_COL["U_AP_APVNO"] - 1] = r.regularpwpcode;
        row[OPOR_COL["U_G_PREPBY"] - 1] = cleanText(userMap[r.createForm] || r.createForm);
        row[OPOR_COL["U_G_REMARKS"] - 1] = cleanText(
            `${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`
        );
        return row;
    });
};

const buildPor1Rows = (filteredData, activityMap, accountBudgetMap, skuMap, separate = false) => {
    const rows = [];
    filteredData.forEach((r) => {
        let customerList = [];
        if (r.branchType) {
            try {
                const parsed = JSON.parse(r.branchType);
                customerList = Array.isArray(parsed) ? parsed : [r.branchType];
            } catch {
                customerList = r.branchType.split(/[\n,;]/).map(c => c.trim()).filter(c => c.length > 0);
                if (customerList.length === 0) customerList = [r.branchType];
            }
        } else {
            customerList = ["-"];
        }

        const customers = separate ? customerList : [customerList.join(", ")];

        customers.forEach((customer) => {
            let priceVatExt = parseFloat(r.credit_budget || 0);
            if (separate) {
                const accountBudgets = accountBudgetMap?.[r.regularpwpcode];
                const skuBudgets = skuMap?.[r.regularpwpcode];
                if (skuBudgets && skuBudgets[customer]) {
                    priceVatExt = skuBudgets[customer];
                } else if (accountBudgets && accountBudgets[customer]) {
                    priceVatExt = accountBudgets[customer];
                } else if (customerList.length > 1) {
                    priceVatExt = parseFloat(r.credit_budget || 0) / customerList.length;
                }
            }
            const row = blankRow(POR1_TOTAL_COLS);
            row[POR1_COL["NumAtCard"] - 1] = r.regularpwpcode;
            row[POR1_COL["Dscription"] - 1] = cleanText(activityMap[r.activity]?.name || r.activity);
            row[POR1_COL["AcctCode"] - 1] = cleanText(activityMap[r.activity]?.glcode || "");
            row[POR1_COL["PriceBefDi"] - 1] = parseFloat(priceVatExt) || 0;
            row[POR1_COL["U_U_Customers"] - 1] = cleanText(customer);
            row[POR1_COL["U_Start_Date"] - 1] = formatDateYYYYMMDD(r.activityDurationFrom);
            row[POR1_COL["U_End_Date"] - 1] = formatDateYYYYMMDD(r.activityDurationTo);
            rows.push(row);
        });
    });
    return rows;
};

const styleHeaderRows = (worksheet, totalCols) => {
    for (let c = 0; c < totalCols; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        if (!worksheet[ref]) continue;
        worksheet[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "1E40AF" } }, font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 }, alignment: { horizontal: "center" } };
    }
    for (let c = 0; c < totalCols; c++) {
        const ref = XLSX.utils.encode_cell({ r: 1, c });
        if (!worksheet[ref]) continue;
        worksheet[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "DBEAFE" } }, font: { bold: true, sz: 10 }, alignment: { horizontal: "center" } };
    }
    for (let c = 0; c < totalCols; c++) {
        const ref = XLSX.utils.encode_cell({ r: 2, c });
        if (!worksheet[ref]) continue;
        worksheet[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "FEF9C3" } }, font: { bold: true, color: { rgb: "854D0E" }, sz: 10 }, alignment: { horizontal: "center" } };
    }
};

const buildAndDownloadWorkbook = (oporTemplateRows, oporDataRows, por1TemplateRows, por1DataRows, fileName) => {
    const workbook = XLSX.utils.book_new();

    const oporSheet = XLSX.utils.aoa_to_sheet([...oporTemplateRows, ...oporDataRows]);
    styleHeaderRows(oporSheet, OPOR_TOTAL_COLS);
    oporDataRows.forEach((_, rowIdx) => {
        const excelRow = 3 + rowIdx;
        Object.values(OPOR_COL).forEach((colNum) => {
            const ref = XLSX.utils.encode_cell({ r: excelRow, c: colNum - 1 });
            if (!oporSheet[ref] || oporSheet[ref].v === null || oporSheet[ref].v === "") return;
            oporSheet[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "F0FFF4" } }, font: { sz: 10 }, alignment: { horizontal: "left" } };
        });
    });
    XLSX.utils.book_append_sheet(workbook, oporSheet, "OPOR");

    const por1Sheet = XLSX.utils.aoa_to_sheet([...por1TemplateRows, ...por1DataRows]);
    styleHeaderRows(por1Sheet, POR1_TOTAL_COLS);
    por1DataRows.forEach((_, rowIdx) => {
        const excelRow = 3 + rowIdx;
        Object.values(POR1_COL).forEach((colNum) => {
            const ref = XLSX.utils.encode_cell({ r: excelRow, c: colNum - 1 });
            if (!por1Sheet[ref] || por1Sheet[ref].v === null || por1Sheet[ref].v === "") return;
            por1Sheet[ref].s = { fill: { patternType: "solid", fgColor: { rgb: "F0FFF4" } }, font: { sz: 10 }, alignment: { horizontal: "left" } };
        });
    });
    XLSX.utils.book_append_sheet(workbook, por1Sheet, "POR1");

    XLSX.writeFile(workbook, fileName);
};

// ── Header row builders ──────────────────────────────────────
function buildOporHeaderRow1() {
    const row = Array(OPOR_TOTAL_COLS).fill(null);
    ["DocNum", "DocType", "HandWritten", "Printed", "DocDate", "DocDueDate", "CardCode", "CardName", "Address", "NumAtCard", "DocCurrency", "DocRate", "DocTotal", "Reference1", "Reference2", "Comments", "JournalMemo", "PaymentGroupCode", "DocTime", "SalesPersonCode", "TransportationCode", "Confirmed", "ImportFileNum", "SummeryType", "ContactPersonCode", "ShowSCN", "Series", "TaxDate", "PartialSupply", "DocObjectCode", "ShipToCode", "Indicator", "FederalTaxID", "DiscountPercent", "PaymentReference", "DocTotalFc", "Form1099", "Box1099", "RevisionPo", "RequriedDate", "CancelDate", "BlockDunning", "Pick", "PaymentMethod", "PaymentBlock", "PaymentBlockEntry", "CentralBankIndicator", "MaximumCashDiscount", "Project", "ExemptionValidityDateFrom", "ExemptionValidityDateTo", "WareHouseUpdateType", "Rounding", "ExternalCorrectedDocNum", "InternalCorrectedDocNum", "DeferredTax", "TaxExemptionLetterNum", "AgentCode", "NumberOfInstallments", "ApplyTaxOnFirstInstallment", "VatDate", "DocumentsOwner", "FolioPrefixString", "FolioNumber", "DocumentSubType", "BPChannelCode", "BPChannelContact", "Address2", "PayToCode", "ManualNumber", "UseShpdGoodsAct", "IsPayToBank", "PayToBankCountry", "PayToBankCode", "PayToBankAccountNo", "PayToBankBranch", "BPL_IDAssignedToInvoice", "DownPayment", "ReserveInvoice", "LanguageCode", "TrackingNumber", "PickRemark", "ClosingDate", "SequenceCode", "SequenceSerial", "SeriesString", "SubSeriesString", "SequenceModel", "UseCorrectionVATGroup", "DownPaymentAmount", "DownPaymentPercentage", "DownPaymentType", "DownPaymentAmountSC", "DownPaymentAmountFC", "VatPercent", "ServiceGrossProfitPercent", "OpeningRemarks", "ClosingRemarks", "RoundingDiffAmount", "ControlAccount", "InsuranceOperation347", "ArchiveNonremovableSalesQuotation", "GTSChecker", "GTSPayee", "ExtraMonth", "ExtraDays", "CashDiscountDateOffset", "StartFrom", "NTSApproved", "ETaxWebSite", "ETaxNumber", "NTSApprovedNumber", "EDocGenerationType", "EDocSeries", "EDocExportFormat", "EDocStatus", "EDocErrorCode", "EDocErrorMessage", "DownPaymentStatus", "GroupSeries", "GroupNumber", "GroupHandWritten", "ReopenOriginalDocument", "ReopenManuallyClosedOrCanceledDocument", "CreateOnlineQuotation", "POSEquipmentNumber", "POSManufacturerSerialNumber", "POSCashierNumber", "ApplyCurrentVATRatesForDownPaymentsToDraw", "ClosingOption", "SpecifiedClosingDate", "OpenForLandedCosts", "RelevantToGTS", "AnnualInvoiceDeclarationReference", "Supplier", "Releaser", "Receiver", "BlanketAgreementNumber", "IsAlteration", "U_PO_PONo", "U_RR_RRNo", "U_AP_APVNO", "U_AP_CMNO", "U_SO_SONo", "U_DR_DRNo", "U_AR_INVOICENO", "U_AR_CMNO", "U_G_PREPBY", "U_G_NOTEBY", "U_G_CHECKBY", "U_G_APPBY", "U_G_REMARKS", "U_SO_Entity", "U_SO_Division", "U_SO_DelType", "U_SO_3plDiv", "U_SO_Disc", "U_SO_AddDisc", "U_SO_Brand", "U_INV_TransType", "U_PrI_Mach", "U_PrI_Shift", "U_PrI_Operators", "U_PrR_ProdDate", "U_PrR_Box", "U_PO_PurchType", "U_PO_TransType", "U_G_DelDate", "U_G_CountDate", "U_PO_Loc", "U_SO_3plDivCode", "U_DocWizard", "U_TransType", "U_SI_DRPrnt", "U_SI_SIPrnt", "U_AP_PCVNO", "U_DR_ChckPnt", "U_DR_SealNo", "U_DR_Container", "U_AP_PCVTrackNote", "U_RR_PCKL", "U_RR_BIL", "U_WONo", "U_TrckNo", "U_AR_SalesType", "U_CM_Trnstype", "U_IT_TransType", "U_IT_WONo", "U_IT_Issuedby", "U_IT_Receivedby", "U_Prn_Start", "U_Prn_End", "U_GR_FsPlastic", "U_GR_FsBasket", "U_IT_CBM", "U_IT_ArrvlDte", "U_IT_ArrvlTme", "U_Prn_Estmteqty", "U_DR_DRprnt", "U_Prn_Dwntme", "U_Prn_Efficiency", "U_BatchSetup", "U_CM_Type", "U_Document_Reference", "U_2307", "U_PO_Month", "U_IssueTo", "U_PWPNo", "U_Agent", "U_SI_CountrRcptNo", "U_PickList", "U_Customer", "U_AR_InvoiceNo_Old", "U_DR_DRNo_Old", "U_DR_GRNo", "U_ProdFGCode", "U_Branch", "U_PO_Type", "U_CUAdd", "U_Pdate", "U_EADate", "U_Value", "U_WBSeries", "U_LoadingDate", "U_ATTNT", "U_Expense_Type", "U_BDec_Ref", "U_BDate_Vat", "U_BOR_Num", "U_BName_Seller", "U_BImp_Date", "U_B_Orig", "U_U_PODate", "U_ML_Branch"].forEach((v, i) => { row[i] = v; });
    return row;
}
function buildOporHeaderRow2() {
    const row = Array(OPOR_TOTAL_COLS).fill(null);
    ["DocNum", "DocType", "Handwrtten", "Printed", "DocDate", "DocDueDate", "CardCode", "CardName", "Address", "NumAtCard", "DocCur", "DocRate", "DocTotal", "Ref1", "Ref2", "Comments", "JrnlMemo", "GroupNum", "DocTime", "SlpCode", "TrnspCode", "Confirmed", "ImportEnt", "SummryType", "CntctCode", "ShowSCN", "Series", "TaxDate", "PartSupply", "ObjType", "ShipToCode", "Indicator", "LicTradNum", "DiscPrcnt", "PaymentRef", "DocTotalFC", "Form1099", "Box1099", "RevisionPo", "ReqDate", "CancelDate", "BlockDunn", "Pick", "PeyMethod", "PayBlock", "PayBlckRef", "CntrlBnk", "MaxDscn", "Project", "FromDate", "ToDate", "UpdInvnt", "Rounding", "CorrExt", "CorrInv", "DeferrTax", "LetterNum", "AgentCode", "Installmnt", "VATFirst", "VatDate", "OwnerCode", "FolioPref", "FolioNum", "DocSubType", "BPChCode", "BPChCntc", "Address2", "PayToCode", "ManualNum", "UseShpdGd", "IsPaytoBnk", "BnkCntry", "BankCode", "BnkAccount", "BnkBranch", "BPLId", "DpmPrcnt", "isIns", "LangCode", "TrackNo", "PickRmrk", "ClsDate", "SeqCode", "Serial", "SeriesStr", "SubStr", "Model", "UseCorrVat", "DpmAmnt", "DpmPrcnt", "Posted", "DpmAmntSC", "DpmAmntFC", "VatPercent", "SrvGpPrcnt", "Header", "Footer", "RoundDif", "SignMsg", "SignDigest", "CertifNum", "KeyVersion", "CtlAccount", "InsurOp347", "IgnRelDoc", "Checker", "Payee", "ExtraMonth", "ExtraDays", "CdcOffset", "PayDuMonth", "NTSApprov", "NTSWebSite", "NTSeTaxNo", "NTSApprNo", "EDocGenTyp", "ESeries", "EDocNum", "EDocExpFrm", "EDocStatus", "EDocErrCod", "EDocErrMsg", "DpmStatus", "PQTGrpSer", "PQTGrpNum", "PQTGrpHW", "ReopOriDoc", "ReopManCls", "OnlineQuo", "POSEqNum", "POSManufSN", "POSCashN", "DpmAsDscnt", "ClosingOpt", "SpecDate", "OpenForLaC", "WddStatus", "DiscSumFC", "DiscSumSy", "GTSRlvnt", "BPLName", "VATRegNum", "AnnInvDecR", "Supplier", "Releaser", "Receiver", "AgrNo", "IsAlt", "U_PO_PONo", "U_RR_RRNo", "U_AP_APVNO", "U_AP_CMNO", "U_SO_SONo", "U_DR_DRNo", "U_AR_INVOICENO", "U_AR_CMNO", "U_G_PREPBY", "U_G_NOTEBY", "U_G_CHECKBY", "U_G_APPBY", "U_G_REMARKS", "U_SO_Entity", "U_SO_Division", "U_SO_DelType", "U_SO_3plDiv", "U_SO_Disc", "U_SO_AddDisc", "U_SO_Brand", "U_INV_TransType", "U_PrI_Mach", "U_PrI_Shift", "U_PrI_Operators", "U_PrR_ProdDate", "U_PrR_Box", "U_PO_PurchType", "U_PO_TransType", "U_G_DelDate", "U_G_CountDate", "U_PO_Loc", "U_SO_3plDivCode", "U_DocWizard", "U_TransType", "U_SI_DRPrnt", "U_SI_SIPrnt", "U_AP_PCVNO", "U_DR_ChckPnt", "U_DR_SealNo", "U_DR_Container", "U_AP_PCVTrackNote", "U_RR_PCKL", "U_RR_BIL", "U_WONo", "U_TrckNo", "U_AR_SalesType", "U_CM_Trnstype", "U_IT_TransType", "U_IT_WONo", "U_IT_Issuedby", "U_IT_Receivedby", "U_Prn_Start", "U_Prn_End", "U_GR_FsPlastic", "U_GR_FsBasket", "U_IT_CBM", "U_IT_ArrvlDte", "U_IT_ArrvlTme", "U_Prn_Estmteqty", "U_DR_DRprnt", "U_Prn_Dwntme", "U_Prn_Efficiency", "U_BatchSetup", "U_CM_Type", "U_Document_Reference", "U_2307", "U_PO_Month", "U_IssueTo", "U_PWPNo", "U_Agent", "U_SI_CountrRcptNo", "U_PickList", "U_Customer", "U_AR_InvoiceNo_Old", "U_DR_DRNo_Old", "U_DR_GRNo", "U_ProdFGCode", "U_Branch", "U_PO_Type", "U_CUAdd", "U_Pdate", "U_EADate", "U_Value", "U_WBSeries", "U_LoadingDate", "U_ATTNT", "U_Expense_Type", "U_BDec_Ref", "U_BDate_Vat", "U_BOR_Num", "U_BName_Seller", "U_BImp_Date", "U_B_Orig", "U_U_PODate", "U_ML_Branch"].forEach((v, i) => { row[i] = v; });
    return row;
}
function buildOporHeaderRow3() {
    const row = Array(OPOR_TOTAL_COLS).fill(null);
    row[OPOR_COL["DocDate"] - 1] = "Posting Date";
    row[OPOR_COL["DocDueDate"] - 1] = "Posting Date";
    row[OPOR_COL["CardCode"] - 1] = "SAP Vendor Code";
    row[OPOR_COL["CardName"] - 1] = "Vendor Name";
    row[OPOR_COL["NumAtCard"] - 1] = "Purchase Order";
    row[OPOR_COL["SlpCode"] - 1] = "SLP";
    row[OPOR_COL["TaxDate"] - 1] = "PO Date";
    row[OPOR_COL["U_AP_APVNO"] - 1] = "Suppliers Ref. No.";
    row[OPOR_COL["U_G_PREPBY"] - 1] = "Prepared By";
    row[153] = "Default";
    row[OPOR_COL["U_G_REMARKS"] - 1] = "Remarks (UDF)";
    return row;
}
function buildPor1HeaderRow1() {
    const row = Array(POR1_TOTAL_COLS).fill(null);
    ["ParentKey", "NumAtCard", "LineNum", "ItemCode", "ItemDescription", "Quantity", "ShipDate", "Price", "PriceAfterVAT", "Currency", "Rate", "DiscountPercent", "VendorNum", "SerialNum", "WarehouseCode", "SalesPersonCode", "CommisionPercent", "TreeType", "AccountCode", "UseBaseUnits", "SupplierCatNum", "CostingCode", "ProjectCode", "BarCode", "VatGroup", "Height1", "Hight1Unit", "Height2", "Height2Unit", "Lengh1", "Lengh1Unit", "Lengh2", "Lengh2Unit", "Weight1", "Weight1Unit", "Weight2", "Weight2Unit", "Factor1", "Factor2", "Factor3", "Factor4", "BaseType", "BaseEntry", "BaseLine", "Volume", "VolumeUnit", "Width1", "Width1Unit", "Width2", "Width2Unit", "Address", "TaxCode", "TaxType", "TaxLiable", "BackOrder", "FreeText", "ShippingMethod", "CorrectionInvoiceItem", "CorrInvAmountToStock", "CorrInvAmountToDiffAcct", "WTLiable", "DeferredTax", "MeasureUnit", "UnitsOfMeasurment", "LineTotal", "TaxPercentagePerRow", "TaxTotal", "ConsumerSalesForecast", "ExciseAmount", "CountryOrg", "SWW", "TransactionType", "DistributeExpense", "ShipToCode", "RowTotalFC", "CFOPCode", "CSTCode", "Usage", "TaxOnly", "UnitPrice", "LineStatus", "LineType", "COGSCostingCode", "COGSAccountCode", "ChangeAssemlyBoMWarehouse", "GrossBuyPrice", "GrossBase", "GrossProfitTotalBasePrice", "CostingCode2", "CostingCode3", "CostingCode4", "CostingCode5", "ItemDetails", "LocationCode", "ActualDeliveryDate", "ExLineNo", "RequiredDate", "RequiredQuantity", "COGSCostingCode2", "COGSCostingCode3", "COGSCostingCode4", "COGSCostingCode5", "CSTforIPI", "CSTforPIS", "CSTforCOFINS", "CreditOriginCode", "WithoutInventoryMovement", "AgreementNo", "AgreementRowNumber", "ShipToDescription", "ActualBaseEntry", "ActualBaseLine", "Surpluses", "DefectAndBreakup", "Shortages", "U_PO_QTY", "U_SO_QTY", "U_BIRVALID", "U_API_VENDOR", "U_API_TIN", "U_API_ADDRESS", "U_INV_Type", "U_IT_PalTag", "U_InvUOM", "U_SO_Brand", "U_dAddlDisc", "U_BPDisc", "U_Type", "U_QtyPack", "U_IT_Purp", "U_IT_Mach", "U_IT_Parker", "U_PO_Price", "U_PrI_Packer", "U_IT_VolCBM", "U_DR_SItemCode", "U_DR_UPrice", "U_SO_GrsPrce", "U_ItemDesc2", "U_ForeignDesc", "U_CM_Type", "U_FGCode", "U_Expense_Category", "U_Delivery_Name", "U_U_Customers", "U_Expense_Type", "U_BDuty_Value", "U_BLand_cost", "U_PriorityQty", "U_U_PCV", "U_Note", "U_Start_Date", "U_End_Date", "U_RefNo", "U_Amt_Bill", "U_Trans_Date", "U_Rcvd_Date", "U_Claim_Type", "U_U_ML", "U_Remarks", "U_Sync_Stat", "U_Per_Cov", "U_Clm_Remarks", "U_Period_Covered", "U_Batch", "U_Expiry", "U_PlateNo", "U_ODOMETER", "U_StoredLoc", "U_Pro_Date"].forEach((v, i) => { row[i] = v; });
    return row;
}
function buildPor1HeaderRow2() {
    const row = Array(POR1_TOTAL_COLS).fill(null);
    ["DocNum", "NumAtCard", "LineNum", "ItemCode", "Dscription", "Quantity", "ShipDate", "Price", "PriceAfVAT", "Currency", "Rate", "DiscPrcnt", "VendorNum", "SerialNum", "WhsCode", "SlpCode", "Commission", "TreeType", "AcctCode", "UseBaseUn", "SubCatNum", "OcrCode", "Project", "CodeBars", "VatGroup", "Height1", "Hght1Unit", "Height2", "Hght2Unit", "Length1", "Len1Unit", "length2", "Len2Unit", "Weight1", "Wght1Unit", "Weight2", "Wght2Unit", "Factor1", "Factor2", "Factor3", "Factor4", "BaseType", "BaseEntry", "BaseLine", "Volume", "VolUnit", "Width1", "Wdth1Unit", "Width2", "Wdth2Unit", "Address", "TaxCode", "TaxType", "TaxStatus", "BackOrdr", "FreeTxt", "TrnsCode", "CEECFlag", "ToStock", "ToDiff", "WtLiable", "DeferrTax", "unitMsr", "NumPerMsr", "LineTotal", "VatPrcnt", "VatSum", "ConsumeFCT", "ExciseAmt", "CountryOrg", "SWW", "TranType", "DistribExp", "ShipToCode", "TotalFrgn", "CFOPCode", "CSTCode", "Usage", "TaxOnly", "PriceBefDi", "LineStatus", "LineType", "CogsOcrCod", "CogsAcct", "ChgAsmBoMW", "GrossBuyPr", "GrossBase", "GPTtlBasPr", "OcrCode2", "OcrCode3", "OcrCode4", "OcrCode5", "Text", "LocCode", "ActDelDate", "ExLineNo", "PQTReqDate", "PQTReqQty", "CogsOcrCo2", "CogsOcrCo3", "CogsOcrCo4", "CogsOcrCo5", "CSTfIPI", "CSTfPIS", "CSTfCOFINS", "CredOrigin", "NoInvtryMv", "AgrNo", "AgrLnNum", "ShipToDesc", "ActBaseEnt", "ActBaseLn", "DocEntry", "Surpluses", "DefBreak", "Shortages", "U_PO_QTY", "U_SO_QTY", "U_BIRVALID", "U_API_VENDOR", "U_API_TIN", "U_API_ADDRESS", "U_INV_Type", "U_IT_PalTag", "U_InvUOM", "U_SO_Brand", "U_dAddlDisc", "U_BPDisc", "U_Type", "U_QtyPack", "U_IT_Purp", "U_IT_Mach", "U_IT_Parker", "U_PO_Price", "U_PrI_Packer", "U_IT_VolCBM", "U_DR_SItemCode", "U_DR_UPrice", "U_SO_GrsPrce", "U_ItemDesc2", "U_ForeignDesc", "U_CM_Type", "U_FGCode", "U_Expense_Category", "U_Delivery_Name", "U_U_Customers", "U_Expense_Type", "U_BDuty_Value", "U_BLand_cost", "U_PriorityQty", "U_U_PCV", "U_Note", "U_Start_Date", "U_End_Date", "U_RefNo", "U_Amt_Bill", "U_Trans_Date", "U_Rcvd_Date", "U_Claim_Type", "U_U_ML", "U_Remarks", "U_Sync_Stat", "U_Per_Cov", "U_Clm_Remarks", "U_Period_Covered", "U_Batch", "U_Expiry", "U_PlateNo", "U_ODOMETER", "U_StoredLoc"].forEach((v, i) => { row[i] = v; });
    return row;
}
function buildPor1HeaderRow3() {
    const row = Array(POR1_TOTAL_COLS).fill(null);
    row[POR1_COL["NumAtCard"] - 1] = "Purchase Order";
    row[POR1_COL["Dscription"] - 1] = "(01)Description";
    row[POR1_COL["AcctCode"] - 1] = "(02)Account Code";
    row[51] = "default";
    row[POR1_COL["PriceBefDi"] - 1] = "(06)Price VAT-EXt";
    row[POR1_COL["U_U_Customers"] - 1] = "Customer List";
    row[POR1_COL["U_Start_Date"] - 1] = "Start Date";
    row[POR1_COL["U_End_Date"] - 1] = "End Date";
    return row;
}

// ============================================================
// COMPONENT
// ============================================================
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
    const [isPreparingExport, setIsPreparingExport] = useState(false);
    const [totalRecordsCount, setTotalRecordsCount] = useState(0);
    const [approvedRecordsCount, setApprovedRecordsCount] = useState(0);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [exportHistory, setExportHistory] = useState(null);
    const [exportedCodesSet, setExportedCodesSet] = useState(new Set());
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [allExportHistory, setAllExportHistory] = useState([]);

    // ============================================================
    // SHARED: Fresh fetch ng approvals from DB
    // ============================================================
    const fetchFreshApprovals = async (batchSize = 1000) => {
        let freshApprovalMap = {};
        let approvalOffset = 0;
        let hasApprovalMore = true;
        while (hasApprovalMore) {
            const { data: approvalData, error: approvalError } = await supabase
                .from("Approval_History")
                .select("PwpCode, DateResponded, Response")
                .range(approvalOffset, approvalOffset + batchSize - 1);
            if (approvalError || !approvalData || approvalData.length === 0) { hasApprovalMore = false; break; }
            approvalData.forEach(a => {
                const status = a.Response?.trim() || "";
                if (!status) return;
                if (!freshApprovalMap[a.PwpCode] || new Date(a.DateResponded) > new Date(freshApprovalMap[a.PwpCode]?.date)) {
                    freshApprovalMap[a.PwpCode] = { date: a.DateResponded, status };
                }
            });
            approvalOffset += batchSize;
            hasApprovalMore = approvalData.length === batchSize;
        }
        return freshApprovalMap;
    };

    // ============================================================
    // SHARED: Fetch all PWP records in batches
    // ============================================================
    const fetchAllPwpRecords = async (batchSize = 1000) => {
        let allData = [];
        let hasMore = true;
        let offset = 0;
        while (hasMore) {
            const { data, error } = await supabase
                .from("regular_pwp")
                .select("*")
                .order("created_at", { ascending: false })
                .range(offset, offset + batchSize - 1);
            if (error || !data?.length) { hasMore = false; break; }
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
        }
        return allData;
    };

    // ============================================================
    // SHARED: Apply date range filter
    // ============================================================
    const applyDateFilter = (data, dateFrom, dateTo, approvalMap = {}) => {
        if (!dateFrom && !dateTo) return data;
        return data.filter(r => {
            const postingDate = approvalMap[r.regularpwpcode]?.date
                ? new Date(approvalMap[r.regularpwpcode].date)
                : null;
            if (!postingDate) return false;
            const fFrom = dateFrom ? new Date(dateFrom) : null;
            const fTo = dateTo ? new Date(dateTo) : null;
            if (fFrom && fTo) return postingDate >= fFrom && postingDate <= fTo;
            if (fFrom && !fTo) return postingDate >= fFrom;
            if (!fFrom && fTo) return postingDate <= fTo;
            return true;
        });
    };

    const fetchAllExportHistory = async () => {
        try {
            const { data, error } = await supabase.from("export_history").select("*").order("exported_at", { ascending: false }).limit(20);
            if (error || !data) return;
            setAllExportHistory(data);
        } catch (err) { console.error("❌ Error fetching export history:", err); }
    };

    const loadExportHistory = async () => {
        try {
            const { data, error } = await supabase.from("export_history").select("*").order("exported_at", { ascending: false }).limit(1).single();
            if (error || !data) return;
            setExportHistory({ dateFrom: data.date_from, dateTo: data.date_to, exportedCodes: data.pwp_codes || [], exportedAt: data.exported_at, totalRecords: data.total_records });
            setExportedCodesSet(new Set(data.pwp_codes || []));
        } catch (err) { console.error("❌ Error loading export history:", err); }
    };

    const saveExportHistory = async (dateFrom, dateTo, exportedCodes) => {
        try {
            const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
            const exportedBy = currentUser?.name || "Unknown";
            setExportHistory({ dateFrom, dateTo, exportedCodes, exportedAt: new Date().toISOString(), totalRecords: exportedCodes.length });
            setExportedCodesSet(new Set(exportedCodes));
            await supabase.from("export_history").insert([{ date_from: dateFrom, date_to: dateTo, pwp_codes: exportedCodes, exported_by: exportedBy, total_records: exportedCodes.length }]);
        } catch (err) { console.error("❌ Error saving export history:", err); }
    };

    const handlePageSizeChange = (e) => { setPageSize(Number(e.target.value)); setPage(1); };
    const handleFirst = () => setPage(1);
    const handleLast = () => setPage(totalPages);

    // ============================================================
    // ✅ EXPORT 1: Export Approved — ONE FILE, TWO SHEETS
    // ============================================================
    const fetchAllRecordsForExport = async () => {
        setIsPreparingExport(true);
        try {
            const batchSize = 1000;
            const freshApprovalMap = await fetchFreshApprovals(batchSize);
            const allData = await fetchAllPwpRecords(batchSize);
            setTotalRecordsCount(allData.length);

            let filteredData = allData.filter(r =>
                freshApprovalMap[r.regularpwpcode]?.status?.toLowerCase() === "approved"
            );
            filteredData = applyDateFilter(filteredData, dateFrom, dateTo, freshApprovalMap);

            setApprovedRecordsCount(filteredData.length);

            if (filteredData.length === 0) {
                alert("No approved records found for the selected date range.");
                return;
            }

            const oporDataRows = buildOporRows(filteredData, freshApprovalMap, distributorMap, userMap);
            const por1DataRows = buildPor1Rows(filteredData, activityMap, null, null, false);
            const dateStamp = formatDateYYYYMMDD(new Date().toISOString());

            buildAndDownloadWorkbook(
                [buildOporHeaderRow1(), buildOporHeaderRow2(), buildOporHeaderRow3()],
                oporDataRows,
                [buildPor1HeaderRow1(), buildPor1HeaderRow2(), buildPor1HeaderRow3()],
                por1DataRows,
                `regular_pwp_approved_${dateStamp}.xlsx`
            );

            await saveExportHistory(dateFrom, dateTo, filteredData.map(r => r.regularpwpcode));
            console.log("✅ Export Approved done! (OPOR + POR1 sheets)");
        } catch (err) {
            console.error("❌ Export error:", err);
        } finally {
            setIsPreparingExport(false);
        }
    };

    // ============================================================
    // ✅ EXPORT 2: Export Separate Customer List — ONE FILE, TWO SHEETS
    // ============================================================
    const fetchAllRecordsForSeparateExport = async () => {
        setIsPreparingExport(true);
        try {
            const batchSize = 1000;
            const freshApprovalMap = await fetchFreshApprovals(batchSize);
            const allData = await fetchAllPwpRecords(batchSize);

            let filteredData = allData.filter(r =>
                freshApprovalMap[r.regularpwpcode]?.status?.toLowerCase() === "approved"
            );
            filteredData = applyDateFilter(filteredData, dateFrom, dateTo);

            if (filteredData.length === 0) {
                alert("No approved records found for the selected date range.");
                return;
            }

            // Fetch account budget data
            let accountBudgetMap = {};
            let budgetOffset = 0;
            let hasBudgetMore = true;
            while (hasBudgetMore) {
                const { data: budgetData, error } = await supabase.from("regular_accountlis_badget").select("regularcode, account_name, budget").range(budgetOffset, budgetOffset + batchSize - 1);
                if (error || !budgetData?.length) { hasBudgetMore = false; break; }
                budgetData.forEach(b => {
                    if (!accountBudgetMap[b.regularcode]) accountBudgetMap[b.regularcode] = {};
                    accountBudgetMap[b.regularcode][b.account_name] = parseFloat(b.budget || 0);
                });
                budgetOffset += batchSize;
                hasBudgetMore = budgetData.length === batchSize;
            }

            // Fetch SKU data
            let skuMap = {};
            let skuOffset = 0;
            let hasSkuMore = true;
            while (hasSkuMore) {
                const { data: skuData, error } = await supabase.from("regular_sku").select("regular_code, account_name, total_amount").range(skuOffset, skuOffset + batchSize - 1);
                if (error || !skuData?.length) { hasSkuMore = false; break; }
                skuData.forEach(s => {
                    if (!skuMap[s.regular_code]) skuMap[s.regular_code] = {};
                    skuMap[s.regular_code][s.account_name] = (skuMap[s.regular_code][s.account_name] || 0) + parseFloat(s.total_amount || 0);
                });
                skuOffset += batchSize;
                hasSkuMore = skuData.length === batchSize;
            }

            const oporDataRows = buildOporRows(filteredData, freshApprovalMap, distributorMap, userMap);
            const por1DataRows = buildPor1Rows(filteredData, activityMap, accountBudgetMap, skuMap, true);

            const totalOriginal = filteredData.reduce((s, r) => s + parseFloat(r.credit_budget || 0), 0);
            const totalSeparated = por1DataRows.reduce((s, row) => s + parseFloat(row[POR1_COL["PriceBefDi"] - 1] || 0), 0);
            console.log(`💵 Original: ₱${totalOriginal.toFixed(2)} | Separated: ₱${totalSeparated.toFixed(2)} | Diff: ₱${Math.abs(totalOriginal - totalSeparated).toFixed(2)}`);

            const dateStamp = formatDateYYYYMMDD(new Date().toISOString());

            buildAndDownloadWorkbook(
                [buildOporHeaderRow1(), buildOporHeaderRow2(), buildOporHeaderRow3()],
                oporDataRows,
                [buildPor1HeaderRow1(), buildPor1HeaderRow2(), buildPor1HeaderRow3()],
                por1DataRows,
                `regular_pwp_separated_${dateStamp}.xlsx`
            );

            await saveExportHistory(dateFrom, dateTo, filteredData.map(r => r.regularpwpcode));
            console.log("✅ Separate Export done! (OPOR + POR1 sheets)");
        } catch (err) {
            console.error("❌ Separate export error:", err);
        } finally {
            setIsPreparingExport(false);
        }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            while (hasMore) {
                let query = supabase.from("regular_pwp").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + batchSize - 1);
                if (filterToday) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    query = query.gte("created_at", today.toISOString()).lt("created_at", tomorrow.toISOString());
                }
                const { data, error } = await query;
                if (error) { console.error("❌ Error:", error); break; }
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                } else { hasMore = false; }
            }

            let filteredData = allData.filter(r =>
                approvalMap[r.regularpwpcode]?.status?.toLowerCase() === "approved"
            );
            if (search) {
                const searchLower = search.toLowerCase();
                filteredData = filteredData.filter(r => {
                    return (
                        (r.regularpwpcode || '').toString().toLowerCase().includes(searchLower) ||
                        (activityMap[r.activity]?.name || '').toString().toLowerCase().includes(searchLower) ||
                        (r.activity || '').toString().toLowerCase().includes(searchLower) ||
                        (r.distributor || '').toString().toLowerCase().includes(searchLower) ||
                        (distributorMap[r.distributor]?.name || '').toString().toLowerCase().includes(searchLower) ||
                        (r.branchType || '').toString().toLowerCase().includes(searchLower) ||
                        (r.objective || '').toString().toLowerCase().includes(searchLower) ||
                        (r.promoScheme || '').toString().toLowerCase().includes(searchLower) ||
                        (distributorMap[r.distributor]?.sap_vendor_code || '').toString().toLowerCase().includes(searchLower)
                    );
                });
            }

            if (filterApproved) {
                filteredData = filteredData.filter(r => approvalMap[r.regularpwpcode]?.status?.toLowerCase() === "approved");
            }
            if (dateFrom || dateTo) {
                filteredData = applyDateFilter(filteredData, dateFrom, dateTo, approvalMap);
            }

            setAllRecords(filteredData);
            const start = (page - 1) * pageSize;
            setRecords(filteredData.slice(start, start + pageSize));
            setTotalPages(Math.ceil(filteredData.length / pageSize) || 1);
        } catch (err) {
            console.error("❌ Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDistributors = async () => {
        try {
            const batchSize = 1000; let allData = []; let hasMore = true; let offset = 0;
            while (hasMore) {
                const { data, error } = await supabase.from("distributors").select("code, name, slp, sap_vendor_code").range(offset, offset + batchSize - 1);
                if (error || !data?.length) { hasMore = false; break; }
                allData = [...allData, ...data]; offset += batchSize; hasMore = data.length === batchSize;
            }
            const map = {};
            allData.forEach(d => { map[d.code] = { name: d.name, slp: d.slp, sap_vendor_code: d.sap_vendor_code }; });
            setDistributorMap(map);
        } catch (err) { console.error("❌ Error fetching distributors:", err); }
    };

    const fetchApprovals = async () => {
        try {
            const batchSize = 1000; let allData = []; let hasMore = true; let offset = 0;
            while (hasMore) {
                const { data, error } = await supabase.from("Approval_History").select("PwpCode, DateResponded, Response").range(offset, offset + batchSize - 1);
                if (error || !data?.length) { hasMore = false; break; }
                allData = [...allData, ...data]; offset += batchSize; hasMore = data.length === batchSize;
            }
            const map = {};
            allData.forEach(a => {
                const status = a.Response?.trim() || "";
                if (!status) return;
                if (!map[a.PwpCode] || new Date(a.DateResponded) > new Date(map[a.PwpCode]?.date)) {
                    map[a.PwpCode] = { date: a.DateResponded, status };
                }
            });
            setApprovalMap(map);
        } catch (err) { console.error("❌ Error fetching approvals:", err); }
    };

    const fetchActivities = async () => {
        try {
            const batchSize = 1000; let allData = []; let hasMore = true; let offset = 0;
            while (hasMore) {
                const { data, error } = await supabase.from("activity").select("code, name, glcode").range(offset, offset + batchSize - 1);
                if (error || !data?.length) { hasMore = false; break; }
                allData = [...allData, ...data]; offset += batchSize; hasMore = data.length === batchSize;
            }
            const map = {};
            allData.forEach(a => { map[a.code] = { name: a.name, glcode: a.glcode }; });
            setActivityMap(map);
        } catch (err) { console.error("❌ Error fetching activities:", err); }
    };

    const fetchUsers = async () => {
        try {
            const batchSize = 1000; let allData = []; let hasMore = true; let offset = 0;
            while (hasMore) {
                const { data, error } = await supabase.from("Account_Users").select("UserID, name").range(offset, offset + batchSize - 1);
                if (error || !data?.length) { hasMore = false; break; }
                allData = [...allData, ...data]; offset += batchSize; hasMore = data.length === batchSize;
            }
            const map = {};
            allData.forEach(u => { map[u.UserID] = u.name || ''; });
            setUserMap(map);
        } catch (err) { console.error("❌ Error fetching users:", err); }
    };

    useEffect(() => {
        fetchDistributors();
        fetchApprovals();
        fetchActivities();
        fetchUsers();
        loadExportHistory();
    }, []);

    useEffect(() => {
        if (Object.keys(distributorMap).length > 0 && Object.keys(activityMap).length > 0) {
            fetchRecords();
        }
    }, [page, search, filterToday, filterApproved, approvalMap, distributorMap, activityMap, pageSize, dateFrom, dateTo]);

    const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
    const handlePrev = () => { if (page > 1) setPage(page - 1); };
    const handleNext = () => { if (page < totalPages) setPage(page + 1); };
    const clearDateFilters = () => { setDateFrom(""); setDateTo(""); setPage(1); };

    return (
        <div style={{ width: "100%", padding: "30px", boxSizing: "border-box", backgroundColor: "#f0f2f5", minHeight: "100vh" }}>
            {/* Header */}
            <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "12px", marginBottom: "25px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                <h2 style={{ margin: "0 0 20px 0", color: "#1a202c", fontSize: "28px", fontWeight: "700" }}>
                    Regular PWP Records
                </h2>

                {/* Search and Filters */}
                <div style={{ display: "flex", gap: "15px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ position: "relative", flexGrow: 1, minWidth: "250px" }}>
                        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#718096", fontSize: "18px" }}>🔍</span>
                        <input type="text" placeholder="Search PWP Code, Activity, Distributor, Branch..." value={search} onChange={handleSearch}
                            style={{ padding: "12px 12px 12px 45px", borderRadius: "8px", border: "2px solid #e2e8f0", width: "100%", fontSize: "14px", outline: "none" }}
                            onFocus={(e) => e.target.style.borderColor = "#3182ce"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                    </div>
                    <button onClick={() => { setFilterToday(!filterToday); setPage(1); }}
                        style={{ padding: "12px 20px", borderRadius: "8px", border: "2px solid", borderColor: filterToday ? "#3182ce" : "#e2e8f0", backgroundColor: filterToday ? "#ebf8ff" : "white", color: filterToday ? "#2c5282" : "#4a5568", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>
                        Today
                    </button>
                    <button onClick={() => { setFilterApproved(!filterApproved); setPage(1); }}
                        style={{ padding: "12px 20px", borderRadius: "8px", border: "2px solid", borderColor: filterApproved ? "#38a169" : "#e2e8f0", backgroundColor: filterApproved ? "#f0fff4" : "white", color: filterApproved ? "#22543d" : "#4a5568", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>
                        ✓ Approved
                    </button>
                    <button onClick={fetchAllRecordsForExport} disabled={isPreparingExport}
                        style={{ padding: "12px 24px", border: "none", borderRadius: "8px", cursor: isPreparingExport ? "wait" : "pointer", backgroundColor: isPreparingExport ? "#94a3b8" : "#10b981", color: "white", fontWeight: "600", fontSize: "14px", opacity: isPreparingExport ? 0.7 : 1 }}>
                        {isPreparingExport ? "⏳ Preparing..." : "📥 Export Approved XLSX"}
                    </button>
                    <button onClick={fetchAllRecordsForSeparateExport} disabled={isPreparingExport}
                        style={{ padding: "12px 24px", border: "none", borderRadius: "8px", cursor: isPreparingExport ? "wait" : "pointer", backgroundColor: isPreparingExport ? "#94a3b8" : "#8b5cf6", color: "white", fontWeight: "600", fontSize: "14px", opacity: isPreparingExport ? 0.7 : 1 }}>
                        {isPreparingExport ? "⏳ Preparing..." : "📋 Export Separate Customer List"}
                    </button>
                    {totalRecordsCount > 0 && (
                        <div style={{ padding: "8px 16px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "8px", fontSize: "13px", fontWeight: "600", border: "2px solid #86efac", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ backgroundColor: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: "6px", fontWeight: "700", fontSize: "12px" }}>All PWP: {totalRecordsCount.toLocaleString()}</span>
                            <span style={{ color: "#64748b" }}>→</span>
                            <span style={{ backgroundColor: "#d1fae5", color: "#065f46", padding: "4px 10px", borderRadius: "6px", fontWeight: "700", fontSize: "12px" }}>✓ {approvedRecordsCount.toLocaleString()} Approved Ready</span>
                        </div>
                    )}
                </div>

                {/* Date Range Filter */}
                <div style={{ display: "flex", gap: "15px", marginBottom: "15px", flexWrap: "wrap", alignItems: "center", padding: "15px", backgroundColor: "#f7fafc", borderRadius: "8px", border: "2px solid #e2e8f0" }}>
                    <span style={{ fontWeight: "600", color: "#2d3748", fontSize: "14px" }}>📆 Posting Date Filter:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "13px", color: "#4a5568", fontWeight: "500" }}>From:</label>
                        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                            style={{ padding: "8px 12px", borderRadius: "6px", border: "2px solid #e2e8f0", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label style={{ fontSize: "13px", color: "#4a5568", fontWeight: "500" }}>To:</label>
                        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                            style={{ padding: "8px 12px", borderRadius: "6px", border: "2px solid #e2e8f0", fontSize: "13px", outline: "none" }} />
                    </div>
                    {(dateFrom || dateTo) && (
                        <button onClick={clearDateFilters}
                            style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "#e53e3e", color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                            ✕ Clear Dates
                        </button>
                    )}
                </div>

                {/* Last Export Info */}
                {exportHistory && (
                    <div style={{ marginTop: "12px", padding: "12px 16px", backgroundColor: "#fefce8", border: "2px solid #facc15", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "13px" }}>
                        <span style={{ fontSize: "18px" }}>📤</span>
                        <span style={{ fontWeight: "700", color: "#854d0e" }}>Last Export:</span>
                        <span style={{ backgroundColor: "#fde68a", padding: "3px 10px", borderRadius: "6px", fontWeight: "600", color: "#78350f" }}>
                            {exportHistory.dateFrom ? `${exportHistory.dateFrom} → ${exportHistory.dateTo || "N/A"}` : "All Records"}
                        </span>
                        <span style={{ color: "#92400e" }}>{exportHistory.totalRecords} records exported</span>
                        <span style={{ color: "#a16207", fontSize: "12px" }}>exported on {new Date(exportHistory.exportedAt).toLocaleString()}</span>
                        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ padding: "3px 10px", backgroundColor: "#fef08a", borderRadius: "6px", color: "#854d0e", fontWeight: "600", fontSize: "12px" }}>🟡 Yellow rows = included in last export</span>
                            <button onClick={() => { fetchAllExportHistory(); setShowHistoryModal(true); }}
                                style={{ padding: "4px 12px", borderRadius: "6px", border: "none", backgroundColor: "#854d0e", color: "white", fontWeight: "600", fontSize: "12px", cursor: "pointer" }}>
                                📋 View History
                            </button>
                        </div>
                    </div>
                )}

                {/* Active Filters */}
                {(filterToday || filterApproved || dateFrom || dateTo) && (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "13px", color: "#4a5568", marginTop: "12px" }}>
                        <span>🔽</span>
                        <span style={{ fontWeight: "600" }}>Active Filters:</span>
                        {filterToday && <span style={{ padding: "4px 12px", backgroundColor: "#ebf8ff", color: "#2c5282", borderRadius: "6px" }}>Today</span>}
                        {filterApproved && <span style={{ padding: "4px 12px", backgroundColor: "#f0fff4", color: "#22543d", borderRadius: "6px" }}>Approved</span>}
                        {(dateFrom || dateTo) && <span style={{ padding: "4px 12px", backgroundColor: "#fef5e7", color: "#744210", borderRadius: "6px" }}>Date Range: {dateFrom || "Start"} → {dateTo || "End"}</span>}
                    </div>
                )}
            </div>

            {/* Export History Modal */}
            {showHistoryModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "24px", width: "700px", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <h3 style={{ margin: 0, color: "#1a202c" }}>📋 Export History</h3>
                            <button onClick={() => setShowHistoryModal(false)} style={{ border: "none", background: "#e2e8f0", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "600" }}>✕ Close</button>
                        </div>
                        {allExportHistory.length === 0 ? (
                            <p style={{ textAlign: "center", color: "#718096" }}>No export history found.</p>
                        ) : (
                            allExportHistory.map((h, idx) => (
                                <div key={h.id}
                                    onClick={() => { setExportHistory({ dateFrom: h.date_from, dateTo: h.date_to, exportedAt: h.exported_at, totalRecords: h.total_records, exportedCodes: h.pwp_codes || [] }); setExportedCodesSet(new Set(h.pwp_codes || [])); setShowHistoryModal(false); }}
                                    style={{ padding: "14px 16px", borderRadius: "8px", marginBottom: "10px", border: "2px solid", borderColor: idx === 0 ? "#facc15" : "#e2e8f0", backgroundColor: idx === 0 ? "#fefce8" : "#f7fafc", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        {idx === 0 && <span style={{ fontSize: "11px", backgroundColor: "#facc15", color: "#78350f", padding: "2px 8px", borderRadius: "4px", fontWeight: "700", marginBottom: "6px", display: "inline-block" }}>LATEST</span>}
                                        <div style={{ fontWeight: "700", color: "#2d3748", fontSize: "15px" }}>{h.date_from && h.date_to ? `${h.date_from} → ${h.date_to}` : "All Records"}</div>
                                        <div style={{ fontSize: "13px", color: "#718096", marginTop: "4px" }}>{new Date(h.exported_at).toLocaleString()} • by {h.exported_by || "Unknown"}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: "20px", fontWeight: "700", color: "#2d3748" }}>{(h.total_records || 0).toLocaleString()}</div>
                                        <div style={{ fontSize: "12px", color: "#718096" }}>records</div>
                                        <div style={{ marginTop: "6px", fontSize: "12px", color: "#3182ce", fontWeight: "600" }}>Click to highlight →</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div style={{ width: "100%", overflowX: "auto", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", backgroundColor: "#fff" }}>
                <table style={{ width: "100%", minWidth: "1600px", borderCollapse: "separate", borderSpacing: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
                    <thead>
                        <tr>
                            {["Status", "Purchase Order", "Vendor Name", "SAP Vendor Code", "Suppliers Ref. No.", "Posting Date", "PO Date", "Remarks (UDF)", "Buyer", "Prepared By", "SLP", "Vendor Code", "Activity", "Activity Code", "PWP Amount", "Branch", "Activity Duration From", "Activity Duration To"].map((col) => (
                                <th key={col} style={{ backgroundColor: "#0d6efd", color: "white", padding: "16px 12px", textAlign: "left", position: "sticky", top: 0, zIndex: 10, whiteSpace: "nowrap", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "3px solid #3182ce" }}>
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={18} style={{ textAlign: "center", padding: "40px", color: "#718096" }}>Loading...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={18} style={{ textAlign: "center", padding: "40px", color: "#718096" }}>No records found</td></tr>
                        ) : (() => {
                            const isExported = (r) => {
                                if (!exportHistory) return false;
                                if (approvalMap[r.regularpwpcode]?.status?.toLowerCase() !== "approved") return false;
                                return exportedCodesSet.has(r.regularpwpcode);
                            };
                            return records.map((r, idx) => (
                                <tr key={r.id}
                                    style={{ backgroundColor: isExported(r) ? "#fefce8" : idx % 2 === 0 ? "#ffffff" : "#f7fafc", transition: "all 0.2s", outline: isExported(r) ? "2px solid #facc15" : "none" }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#edf2f7"}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isExported(r) ? "#fefce8" : idx % 2 === 0 ? "#ffffff" : "#f7fafc"; }}>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", borderBottom: "1px solid #e2e8f0" }}>
                                        {(() => {
                                            const status = approvalMap[r.regularpwpcode]?.status;
                                            if (!status) return <span style={{ padding: "4px 12px", backgroundColor: "#e2e8f0", color: "#4a5568", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>⏳ Pending</span>;
                                            const statusLower = status.toLowerCase();
                                            const styles = { approved: { bg: "#c6f6d5", color: "#22543d", icon: "✅" }, disapproved: { bg: "#fed7d7", color: "#742a2a", icon: "❌" }, cancelled: { bg: "#feebc8", color: "#7b341e", icon: "🚫" } };
                                            const s = styles[statusLower] || { bg: "#e2e8f0", color: "#4a5568", icon: "❓" };
                                            return <span style={{ padding: "4px 12px", backgroundColor: s.bg, color: s.color, borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>{s.icon} {status}</span>;
                                        })()}
                                    </td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{r.regularpwpcode}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{distributorMap[r.distributor]?.name || r.distributor}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{distributorMap[r.distributor]?.sap_vendor_code ?? "-"}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{r.regularpwpcode}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", borderBottom: "1px solid #e2e8f0" }}>
                                        {approvalMap[r.regularpwpcode]?.date
                                            ? <span style={{ padding: "4px 10px", backgroundColor: "#c6f6d5", color: "#22543d", borderRadius: "6px", fontSize: "13px" }}>{new Date(approvalMap[r.regularpwpcode].date).toLocaleDateString()}</span>
                                            : <span style={{ padding: "4px 10px", backgroundColor: "#fed7d7", color: "#742a2a", borderRadius: "6px", fontSize: "13px" }}>N/A</span>}
                                    </td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
                                    <td style={{ padding: "14px 12px", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0", maxWidth: "200px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}
                                        title={`${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`}>
                                        {(() => { const c = `${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`; return c.length > 100 ? c.slice(0, 100) + "..." : c || "-"; })()}
                                    </td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{userMap[r.createForm] || r.createForm}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{userMap[r.createForm] || r.createForm}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{distributorMap[r.distributor]?.slp ?? "-"}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{r.distributor}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{activityMap[r.activity]?.name || r.activity}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{activityMap[r.activity]?.glcode || r.activity}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", fontWeight: "600", borderBottom: "1px solid #e2e8f0" }}>
                                        ₱{r.credit_budget ? parseFloat(r.credit_budget).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                                    </td>
                                    <td style={{ padding: "14px 12px", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0", maxWidth: "300px" }} title={r.branchType || ""}>
                                        {r.branchType && r.branchType.length > 100 ? r.branchType.slice(0, 100) + "..." : r.branchType || "-"}
                                    </td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{r.activityDurationFrom ? new Date(r.activityDurationFrom).toLocaleDateString() : ""}</td>
                                    <td style={{ padding: "14px 12px", whiteSpace: "nowrap", fontSize: "14px", color: "#2d3748", borderBottom: "1px solid #e2e8f0" }}>{r.activityDurationTo ? new Date(r.activityDurationTo).toLocaleDateString() : ""}</td>
                                </tr>
                            ));
                        })()}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "25px", flexWrap: "wrap", gap: "15px", backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                <span style={{ fontWeight: "600", color: "#2d3748", fontSize: "14px" }}>Page {page} of {totalPages}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{ fontWeight: "600", color: "#4a5568", fontSize: "14px" }}>Rows per page:</label>
                    <select value={pageSize} onChange={handlePageSizeChange} style={{ padding: "8px 12px", borderRadius: "8px", border: "2px solid #e2e8f0", fontSize: "14px", cursor: "pointer", outline: "none" }}>
                        {[5, 10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    {[["First", handleFirst, page === 1], ["Prev", handlePrev, page === 1], ["Next", handleNext, page === totalPages], ["Last", handleLast, page === totalPages]].map(([label, fn, disabled]) => (
                        <button key={label} onClick={fn} disabled={disabled}
                            style={{ padding: "10px 16px", borderRadius: "8px", border: "none", fontWeight: "600", cursor: disabled ? "not-allowed" : "pointer", backgroundColor: disabled ? "#cbd5e0" : "#3182ce", color: "#fff", fontSize: "14px" }}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UploadExportRegularPWP;
