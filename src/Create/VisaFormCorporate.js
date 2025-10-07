// import React, { useState, useEffect, useRef } from 'react';
// import 'bootstrap/dist/css/bootstrap.min.css';
// import Swal from 'sweetalert2';  // SweetAlert2 import
// import { ref as storageRef, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
// import { collection, addDoc } from 'firebase/firestore';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
// import { supabase } from '../supabaseClient';

// const VisaForm = () => {
//     const today = new Date().toISOString().split('T')[0];

//     const [formData, setFormData] = useState({
//         visaCode: '',
//         outlet: '',
//         existingStores: '',
//         storesToOpen: '',
//         salesDivision: '',
//         accountType: '',
//         account: '',
//         activity: '',
//         visaType: 'CORPORATE',
//         fromDate: today,
//         toDate: today,
//         sellInDate: '',
//         Notification: false
//     });



//     const getEmptyRow = () => ({
//         checked: false,
//         salesVisa: '',
//         brand: '',
//         sales2024: '',
//         target2025: '',
//         diff: '',
//         percentCont: '',
//         fixedSupport: '',
//         variableSupport: '',
//         totalSupport: '',
//         totalFixedSupportVAT: '',
//         yagoSupport: '',
//         supportDiff: '',
//         cts: '',
//     });

//     const [tableData, setTableData] = useState([getEmptyRow()]);
//     const [currentStep, setCurrentStep] = useState(1); // 1 = form, 2 = table, 3 = approval/attachment


//     const handleSubmit = async () => {
//         const storedUser = JSON.parse(localStorage.getItem('user'));
//         if (!storedUser) {
//             Swal.fire({
//                 icon: 'error',
//                 title: 'User not found',
//                 text: 'Please log in again.',
//             });
//             return;
//         }
//         const { data, error } = await supabase
//             .from('Corporate_Visa')
//             .insert([{
//                 visaCode: formData.visaCode,
//                 outlet: formData.outlet,
//                 existingStores: formData.existingStores,
//                 storesToOpen: formData.storesToOpen,
//                 salesDivision: formData.salesDivision,
//                 accountType: formData.accountType,
//                 account: formData.account,
//                 activity: formData.activity,
//                 visaType: formData.visaType,
//                 fromDate: formData.fromDate,
//                 toDate: formData.toDate,
//                 sellInDate: formData.sellInDate,
//                 start: formData.fromDate,
//                 end: formData.toDate,
//                 Notification: formData.Notification,
//                 CreatedForm: storedUser.name


//             }]);

//         if (error) {
//             console.error('Error inserting data:', error);
//         } else {
//             console.log('Data inserted:', data);
//         }
//     };






//     function handleChange(e) {
//         const { name, value } = e.target;
//         setFormData(prev => ({ ...prev, [name]: value }));

//         if (name === 'account') {
//             console.log('Account selected:', value);
//         }
//     }


//     const handleAddRow = () => {
//         setTableData((prev) => [...prev, getEmptyRow()]);
//     };

//     const handleDeleteRow = (index) => {
//         const updated = [...tableData];
//         updated.splice(index, 1);
//         setTableData(updated);
//     };

//     const handleTableChange = (index, e) => {
//         const { name, type, checked, value } = e.target;
//         const updated = [...tableData];
//         updated[index][name] = type === 'checkbox' ? checked : value;
//         setTableData(updated);
//     };

//     const handleNext = (e) => {
//         e.preventDefault();
//         if (currentStep < 3) {
//             setCurrentStep(currentStep + 1);
//         }
//     };

//     const handlePrevious = () => {
//         if (currentStep > 1) {
//             setCurrentStep(currentStep - 1);
//         }
//     };



//     const [files, setFiles] = useState([]);
//     const fileInputRef = useRef();

//     const handleFiles = (selectedFiles) => {
//         const newFiles = Array.from(selectedFiles).map(file => {
//             // Create preview URL for images
//             if (file.type.startsWith('image/')) {
//                 file.preview = URL.createObjectURL(file);
//             }
//             return file;
//         });
//         setFiles(prev => [...prev, ...newFiles]);
//     };

//     const handleDrop = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
//             handleFiles(e.dataTransfer.files);
//             e.dataTransfer.clearData();
//         }
//     };

//     const handleDragOver = (e) => {
//         e.preventDefault();
//         e.stopPropagation();
//     };

//     const handleFileInputChange = (e) => {
//         handleFiles(e.target.files);
//     };

//     const removeFile = (index) => {
//         const updated = [...files];
//         // Revoke preview URL to avoid memory leaks
//         if (updated[index].preview) {
//             URL.revokeObjectURL(updated[index].preview);
//         }
//         updated.splice(index, 1);
//         setFiles(updated);
//     };



//     const handleSubmitToApprovers = async () => {
//         if (!formData.visaCode) {
//             Swal.fire({
//                 icon: 'warning',
//                 title: 'Missing Visa Code',
//                 text: 'Visa Code is required before submitting!',
//             });
//             return;
//         }

//         try {
//             console.log("📂 Preparing files for optional upload...");

//             let encodedFiles = [];

//             if (files.length > 0) {
//                 const filePromises = files.map((file) => {
//                     return new Promise((resolve, reject) => {
//                         const reader = new FileReader();
//                         reader.onload = () => {
//                             resolve({
//                                 visaCode: formData.visaCode,
//                                 name: file.name,
//                                 type: file.type,
//                                 size: file.size,
//                                 content: reader.result,
//                                 uploadedAt: new Date().toISOString(),
//                             });
//                         };
//                         reader.onerror = (error) => reject(error);
//                         reader.readAsDataURL(file);
//                     });
//                 });

//                 encodedFiles = await Promise.all(filePromises);
//                 console.log("✅ Files encoded:", encodedFiles);

//                 // ✅ Save to Firebase Firestore
//                 console.log("✅ Files uploaded to Firestore");

//                 // ✅ Save to Supabase table
//                 const { data, error } = await supabase
//                     .from('Corporate_Visa_Attachments')
//                     .insert(encodedFiles);

//                 if (error) {
//                     console.error("❌ Supabase attachment upload error:", error);
//                 } else {
//                     console.log("✅ Attachments uploaded to Supabase:", data);
//                 }
//             } else {
//                 console.log("ℹ️ No files uploaded. Skipping Firestore & Supabase attachment update.");
//             }

//             // Continue submission process
//             await handleSubmitTable();   // Firebase + Supabase table data

//             await postToFirebase();      // Custom logic
//             await handleSubmit();        // Supabase main form insert

//             Swal.fire({
//                 icon: 'success',
//                 title: 'Submitted!',
//                 text: files.length > 0
//                     ? 'Form and attachments uploaded successfully.'
//                     : 'Form submitted without attachments.',
//             }).then((result) => {
//                 if (result.isConfirmed) {
//                     window.location.reload();
//                 }
//             });

//             setFiles([]);
//             if (fileInputRef.current) fileInputRef.current.value = '';

//         } catch (error) {
//             console.error("❌ Upload Error:", error);
//             Swal.fire({
//                 icon: 'error',
//                 title: 'Submission Failed',
//                 text: 'There was a problem during submission. Check the console for details.',
//             });
//         }
//     };




//     // Post data to Firestore inside Corporate_Visa collection, document = visaCode
//     const postToFirebase = async () => {
//         try {
//             await handleSubmitFirebase(formData);
//         } catch (error) {
//             console.error('Error in postToFirebase:', error);
//         }
//     };


//     const saveRecentActivity = async ({ UserId }) => {
//         try {
//             // 1. Get public IP
//             const ipRes = await fetch('https://api.ipify.org?format=json');
//             const { ip } = await ipRes.json();

//             // 2. Get geolocation info
//             const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
//             const geo = await geoRes.json();

//             // 3. Build activity entry
//             const activity = {
//                 Device: navigator.userAgent || 'Unknown Device',
//                 Location: `${geo.city || 'Unknown'}, ${geo.region || 'Unknown'}, ${geo.country_name || 'Unknown'}`,
//                 IP: ip,
//                 Time: new Date().toISOString(),
//                 Action: 'Create Form Corporate',
//             };

//             // ✅ 4. Save to Supabase
//             const { error } = await supabase
//                 .from('RecentActivity')
//                 .insert([{
//                     userId: UserId,
//                     device: activity.Device,
//                     location: activity.Location,
//                     ip: activity.IP,
//                     time: activity.Time,
//                     action: activity.Action,
//                 }]);

//             if (error) {
//                 console.error('❌ Supabase insert error:', error.message);
//             } else {
//                 console.log('✅ Activity saved to Supabase');
//             }

//             // ✅ 5. Send SMS notification

//             try {
//             } catch (smsError) {
//                 console.error('❌ SMS error:', smsError.message);
//             }

//         } catch (err) {
//             console.error('❌ Failed to log activity:', err.message || err);
//         }
//     };

//     const handleSubmitTable = async () => {
//         if (!formData.visaCode) {
//             alert("Visa Code is required to submit the table data.");
//             return;
//         }

//         console.log("Submitting table data to Supabase:");
//         console.log("Visa Code:", formData.visaCode);
//         console.log("Table data:", tableData);

//         try {
//             // Prepare the data for Supabase
//             const supabaseRows = tableData.map((row, index) => ({
//                 visaCode: formData.visaCode,
//                 index, // if this field exists in your schema
//                 ...row
//             }));

//             // Optional: delete old rows before inserting new ones (to avoid duplicates)
//             await supabase
//                 .from("Corporate_Visa_Details")
//                 .delete()
//                 .eq("visaCode", formData.visaCode);

//             // Insert new rows
//             const { data, error } = await supabase
//                 .from("Corporate_Visa_Details")
//                 .insert(supabaseRows);

//             if (error) {
//                 console.error("❌ Supabase insert error:", error);
//                 alert("Failed to submit table data to Supabase.");
//             } else {
//                 console.log("✅ Table data submitted to Supabase!", data);
//                 alert("Table data submitted successfully.");
//             }

//         } catch (error) {
//             console.error("❌ Unexpected error:", error);
//             alert("Failed to submit table data.");
//         }
//     };



//     useEffect(() => {
//         const generateVisaCodeIfNeeded = async () => {
//             if (formData.visaCode) return; // already have visaCode, skip

//             const year = new Date().getFullYear();
//             const prefix = `C${year}-`;
//             const startNumber = 1;

//             try {
//                 // Get all existing visaCodes
//                 const { data, error } = await supabase
//                     .from('Corporate_Visa')
//                     .select('visaCode');

//                 if (error) throw error;

//                 const existingCodes = new Set(data.map(row => row.visaCode).filter(Boolean));

//                 // Find next unused number
//                 let nextNumber = startNumber;
//                 let candidateCode;

//                 do {
//                     candidateCode = `${prefix}${nextNumber}`;
//                     // If candidateCode already exists, increment and try again
//                     nextNumber++;
//                     // If all codes up to some high number exist, break (to avoid infinite loop)
//                     if (nextNumber > 10000) {
//                         console.warn('Too many visaCodes exist, stopping generation');
//                         candidateCode = null;
//                         break;
//                     }
//                 } while (existingCodes.has(candidateCode));

//                 // Only set if candidateCode is NOT null and not in existingCodes
//                 if (candidateCode && !existingCodes.has(candidateCode)) {
//                     setFormData(prev => ({ ...prev, visaCode: candidateCode }));
//                     console.log(`Generated new visaCode: ${candidateCode}`);
//                 } else {
//                     console.log('Did not generate visaCode because it already exists.');
//                 }

//             } catch (err) {
//                 console.error('Error generating visaCode:', err.message || err);
//             }
//         };

//         generateVisaCodeIfNeeded();
//     }, []);

//     // Function to post form data to Firestore
//     const handleSubmitFirebase = async (formData) => {
//         if (!formData.visaCode) {
//             Swal.fire({
//                 icon: 'warning',
//                 title: 'Oops...',
//                 text: 'Visa Code is required before submitting!',
//             });
//             return;
//         }

//         const storedUser = JSON.parse(localStorage.getItem('user'));
//         if (!storedUser) {
//             Swal.fire({
//                 icon: 'error',
//                 title: 'User not found',
//                 text: 'Please log in again.',
//             });
//             return;
//         }

//         try {

//             const dataToUpdate = {
//                 ...formData,
//                 DateCreated: formData.DateCreated || new Date().toISOString(),
//                 visaType: 'CORPORATE',
//                 Notification: false,
//                 CreatedForm: {
//                     UserId: storedUser.name,
//                 },
//             };

//             // Save activity log
//             await saveRecentActivity({ UserId: storedUser.id });

//             // Update Firebase

//             Swal.fire({
//                 icon: 'success',
//                 title: 'Success!',
//                 text: 'Form data saved successfully without overwriting attachments or table!',
//             });
//         } catch (error) {
//             console.error('Error saving to Firebase:', error);
//             Swal.fire({
//                 icon: 'error',
//                 title: 'Failed!',
//                 text: 'Failed to save data to Firebase.',
//             });
//         }
//     };

//     const handleSubmits = async (e) => {
//         e.preventDefault();
//         const buttonClicked = e.nativeEvent.submitter.name;
//         if (buttonClicked === 'next') {
//             handleNext();
//         } else if (buttonClicked === 'submit') {
//             await handleSubmitFirebase(formData); // your Firebase saving function
//         }
//     };

//     const [salesDivisions, setSalesDivisions] = useState([]);
//     const [accountTypes, setAccountTypes] = useState([]);
//     const [accounts, setAccounts] = useState([]);
//     const [visaTypes, setVisaTypes] = useState([]);
//     const [activity, setActvity] = useState([]);



//     const [groupAccount, setGroupAccount] = useState([]);



//     useEffect(() => {
//         let isMounted = true;

//         const fetchSalesDivisions = async () => {
//             const { data, error } = await supabase
//                 .from("References")           // your table name with correct casing and quotes handled by supabase client
//                 .select("*")
//                 .eq("reference_type", "SalesDivision");

//             if (error) {
//                 console.error("Error fetching SalesDivision:", error);
//             } else if (isMounted) {
//                 setSalesDivisions(data); // set state with the array of results
//             }
//         };

//         fetchSalesDivisions();

//         return () => {
//             isMounted = false; // cleanup to avoid setting state if unmounted
//         };
//     }, []);



//     useEffect(() => {
//         if (!formData.accountType) {
//             setGroupAccount([]); // clear when no accountType selected
//             return;
//         }

//         let isMounted = true;

//         const fetchGroupAccountsByParentName = async () => {
//             // Get the AccountType's name by id
//             const { data: accountTypeData, error: accountTypeError } = await supabase
//                 .from("References")
//                 .select("name")
//                 .eq("id", formData.accountType)
//                 .single();

//             if (accountTypeError) {
//                 console.error("Error fetching AccountType name:", accountTypeError);
//                 if (isMounted) setGroupAccount([]);
//                 return;
//             }

//             if (!accountTypeData) {
//                 if (isMounted) setGroupAccount([]);
//                 return;
//             }

//             const parentName = accountTypeData.name;

//             // Fetch GroupAccounts where parent_id = AccountType name
//             const { data: groupAccounts, error: groupAccountError } = await supabase
//                 .from("References")
//                 .select("*")
//                 .eq("reference_type", "GroupAccount")
//                 .eq("parent_id", parentName);

//             if (groupAccountError) {
//                 console.error("Error fetching GroupAccounts:", groupAccountError);
//                 if (isMounted) setGroupAccount([]);
//                 return;
//             }

//             if (isMounted) setGroupAccount(groupAccounts || []);
//         };

//         fetchGroupAccountsByParentName();

//         return () => {
//             isMounted = false;
//         };
//     }, [formData.accountType]);





//     // Load group account list when accountType is selected
//     useEffect(() => {
//         let isMounted = true;

//         const fetchAccountTypes = async () => {
//             const { data, error } = await supabase
//                 .from("References")
//                 .select("*")
//                 .eq("reference_type", "AccountType");

//             if (error) {
//                 console.error("Error fetching AccountTypes:", error);
//             } else if (isMounted) {
//                 setAccountTypes(data);
//             }
//         };

//         fetchAccountTypes();

//         return () => {
//             isMounted = false;
//         };
//     }, []);




//     useEffect(() => {
//         let isMounted = true;

//         const fetchActivities = async () => {
//             const { data, error } = await supabase
//                 .from("References")
//                 .select("*")
//                 .eq("reference_type", "Activity");

//             if (error) {
//                 console.error("Error fetching Activity data:", error);
//             } else if (isMounted) {
//                 setActvity(data); // or setActivity if that’s the correct spelling
//             }
//         };

//         fetchActivities();

//         return () => {
//             isMounted = false;
//         };
//     }, []);

//     const [brands, setBrands] = useState({});

//     useEffect(() => {
//         let isMounted = true;

//         const fetchBrands = async () => {
//             const { data, error } = await supabase
//                 .from("Branddetails")
//                 .select("name, parentname")
//                 .not("parentname", "is", null)
//                 .neq("parentname", ""); // Exclude rows with null or empty parentname

//             if (error) {
//                 console.error("Error fetching brands:", error);
//                 return;
//             }

//             if (isMounted && data) {
//                 const grouped = {};

//                 data.forEach(({ name }) => {
//                     if (!name) return;
//                     const key = name[0].toLowerCase();
//                     if (!grouped[key]) grouped[key] = [];
//                     grouped[key].push({ name });
//                 });

//                 console.log("Grouped Brands from Branddetails:", grouped);
//                 setBrands(grouped);
//             }
//         };

//         fetchBrands();

//         return () => {
//             isMounted = false;
//         };
//     }, []);





//     return (
//         <div style={{ padding: '30px', overflowX: 'auto' }} className="containers">
//             {currentStep === 1 && (
//                 <>
//                     <div style={{ padding: '10px' }} className="row align-items-center justify-content-between">
//                         <div className="col-12 col-md-6">
//                             <div
//                                 className="card p-4 animate-fade-slide-up shadow-sm"
//                                 style={{
//                                     background: 'linear-gradient(135deg,rgb(255, 168, 168),rgb(247, 217, 217))', // gentle blue gradient
//                                     borderRadius: '12px',
//                                     border: '1px solidrgb(230, 85, 85)',
//                                     color: '#1a3e72',
//                                     boxShadow: '0 4px 8px rgba(26, 62, 114, 0.15)',
//                                 }}
//                             >
//                                 <h3
//                                     className="mb-0"
//                                     style={{
//                                         fontWeight: '700',
//                                         letterSpacing: '2px',
//                                         textTransform: 'uppercase',
//                                         fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
//                                         textShadow: '1px 1px 2px rgba(21, 31, 46, 0.3)',
//                                     }}
//                                 >
//                                     coporate
//                                 </h3>
//                             </div>
//                         </div>

//                     </div>

//                     <form style={{ marginTop: '50px' }} className="card-body mt-8" onSubmit={handleSubmits}>
//                         <h2
//                             className="fw-bold mb-0"
//                             style={{
//                                 letterSpacing: '1px',
//                                 fontSize: '24px',
//                                 marginBottom: '50px',
//                                 textAlign: 'right',  // <-- added this line
//                             }}
//                         >
//                             {' '}
//                             <span className={formData.visaCode ? 'text-danger' : 'text-muted'}>
//                                 {formData.visaCode || 'N/A'}
//                             </span>
//                         </h2>


//                         <div className="row g-3">
//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label">Outlet</label>
//                                 <input
//                                     type="text"
//                                     name="outlet"
//                                     value={formData.outlet}
//                                     onChange={handleChange}
//                                     className="form-control"
//                                     required
//                                 />
//                                 {formData.outlet !== '' && (
//                                     <span style={checkStyle}>✓</span>
//                                 )}
//                             </div>

//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label"># of Existing Stores</label>
//                                 <input
//                                     type="number"
//                                     name="existingStores"
//                                     value={formData.existingStores}
//                                     onChange={handleChange}
//                                     className="form-control"
//                                 />
//                                 {formData.existingStores !== '' && (
//                                     <span style={checkStyle}>✓</span>
//                                 )}
//                             </div>

//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label"># of Stores to Open</label>
//                                 <input
//                                     type="number"
//                                     name="storesToOpen"
//                                     value={formData.storesToOpen}
//                                     onChange={handleChange}
//                                     className="form-control"
//                                 />
//                                 {formData.storesToOpen !== '' && (
//                                     <span style={checkStyle}>✓</span>
//                                 )}
//                             </div>

//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label">Sales Division</label>
//                                 <select
//                                     name="salesDivision"
//                                     className="form-control"
//                                     value={formData.salesDivision}
//                                     onChange={handleChange}
//                                     style={{ paddingRight: '30px' }}
//                                 >
//                                     <option value="">Select Sales Division</option>
//                                     {salesDivisions.map((opt, index) => (
//                                         <option key={index} value={opt.name || opt}>
//                                             {opt.name || opt}
//                                         </option>
//                                     ))}

//                                 </select>
//                                 <span
//                                     style={{
//                                         position: "absolute",
//                                         top: "75%",
//                                         right: "20px",
//                                         transform: "translateY(-50%)",
//                                         pointerEvents: "none",
//                                         fontSize: "0.8rem",
//                                         color: "#666",
//                                     }}
//                                 >
//                                     ▼

//                                 </span>
//                                 {formData.salesDivision !== '' && (
//                                     <span style={checkStyle}>✓</span>
//                                 )}
//                             </div>
//                             {/* Account Type */}
//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label">Account Type</label>
//                                 <select
//                                     name="accountType"
//                                     className="form-control"
//                                     value={formData.accountType}
//                                     onChange={handleChange}
//                                     style={{ paddingRight: '30px', transition: 'border-color 0.3s' }}
//                                 >
//                                     <option value="">Select Account Type</option>
//                                     {accountTypes.map(opt => (
//                                         <option key={opt.id} value={opt.id}>{opt.name}</option>
//                                     ))}
//                                 </select>
//                                 <span style={{ ...dropdownIconStyle }}>▼</span>
//                                 {formData.accountType && <span style={{ ...checkIconStyle }}>✓</span>}
//                             </div>

//                             {/* Account */}
//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label">Account</label>
//                                 <select
//                                     name="account"
//                                     className="form-control"
//                                     value={formData.account}
//                                     onChange={handleChange}
//                                     disabled={!formData.accountType}
//                                     style={{
//                                         paddingRight: '30px',
//                                         transition: 'border-color 0.3s',
//                                         cursor: formData.accountType ? "pointer" : "not-allowed"
//                                     }}
//                                 >
//                                     <option value="">Select Group Account</option>
//                                     {groupAccount.map(opt => (
//                                         <option key={opt.id} value={opt.id}>{opt.name}</option>
//                                     ))}
//                                 </select>
//                                 <span style={{ ...dropdownIconStyle }}>▼</span>
//                                 {formData.account && <span style={{ ...checkIconStyle }}>✓</span>}


//                             </div>
//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label">Activity</label>
//                                 <div style={{ position: 'relative' }}>
//                                     <select
//                                         name="activity"
//                                         className="form-control"
//                                         value={formData.activity}
//                                         onChange={handleChange}
//                                         style={{ appearance: 'none', paddingRight: '30px' }}
//                                     >
//                                         <option value="">Select Activity</option>
//                                         {activity.map((opt, index) => (
//                                             <option key={index} value={opt.name || opt}>
//                                                 {opt.name || opt}
//                                             </option>
//                                         ))}
//                                     </select>
//                                     <span
//                                         style={{
//                                             position: "absolute",
//                                             top: "50%",
//                                             right: "10px",
//                                             transform: "translateY(-50%)",
//                                             pointerEvents: "none",
//                                             fontSize: "0.8rem",
//                                             color: "#666",
//                                         }}
//                                     >
//                                         ▼

//                                     </span>
//                                 </div>
//                                 {formData.activity !== '' && (
//                                     <span style={checkStyle}>✓</span>
//                                 )}
//                             </div>
//                             <div className="col-12 col-md-6 position-relative">
//                                 <label className="form-label" >
//                                     Marketing Type
//                                 </label>
//                                 <select
//                                     name="visaType"
//                                     className="form-control"
//                                     value={formData.visaType}
//                                     onChange={handleChange}
//                                     style={{ paddingRight: '30px', textTransform: 'uppercase' }}
//                                     disabled // Make it readonly if needed
//                                 >
//                                     <option value="CORPORATE">Corporate</option>
//                                 </select>

//                                 {formData.visaType !== '' && (
//                                     <span
//                                         style={{
//                                             position: 'absolute',
//                                             right: '20px',
//                                             top: '50%',
//                                             transform: 'translateY(-20%)',
//                                             color: 'green',
//                                             fontWeight: 'bold',
//                                             fontSize: '25px',
//                                             pointerEvents: 'none',
//                                             userSelect: 'none',
//                                         }}
//                                     >
//                                         ✓
//                                     </span>
//                                 )}
//                             </div>


//                         </div>

//                         <h5 className="mt-4">Duration</h5>
//                         <div className="row g-3">
//                             <div className="col-12 col-md-6 col-lg-4 position-relative">
//                                 <label className="form-label">From Date</label>
//                                 <input
//                                     type="date"
//                                     name="fromDate"
//                                     value={formData.fromDate}
//                                     onChange={handleChange}
//                                     className="form-control"
//                                 />
//                                 {formData.fromDate !== '' && (
//                                     <span style={checkStyle}>✓</span>
//                                 )}
//                             </div>

//                             <div className="col-12 col-md-6 col-lg-4 position-relative">
//                                 <label className="form-label">To Date</label>
//                                 <input
//                                     type="date"
//                                     name="toDate"
//                                     value={formData.toDate}
//                                     onChange={handleChange}
//                                     className="form-control"
//                                 />
//                                 {formData.toDate !== '' && (
//                                     <span style={checkStyle}>✓</span>
//                                 )}
//                             </div>
//                         </div>

//                         <div className="mt-4 text-end">
//                             <button className="btn btn-primary" onClick={handleNext}>
//                                 Next →
//                             </button>
//                         </div>
//                     </form>

//                 </>
//             )
//             }

//             {
//                 currentStep === 2 && (
//                     <div className="card shadow-sm">
//                         <div className="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
//                             <h5 className="mb-0">Sales Visa Table</h5>
//                         </div>

//                         <div
//                             className="responsive-table-container"
//                             style={{
//                                 maxHeight: '650px',
//                                 overflowY: 'auto',
//                                 overflowX: 'auto', // Enable horizontal scroll

//                             }}
//                         >

//                             <table
//                                 className="table table-bordered table-striped"
//                                 style={{
//                                     whiteSpace: 'nowrap',
//                                     borderCollapse: 'separate',
//                                     borderSpacing: 0,
//                                     minWidth: '1000px', // Optional: force min width so horizontal scroll appears on smaller screens
//                                 }}
//                             >
//                                 <thead
//                                     className="table-dark"
//                                     style={{ position: 'sticky', top: 0, zIndex: 10 }}
//                                 >
//                                     <tr>
//                                         <th style={{ backgroundColor: '#00B34A' }}></th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>Sales Visa #</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>Brand</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>2025 Sales</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>2026 Target</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>+ / -</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>% Cont</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>Fixed Support</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>Variable Support</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>Total Support</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>
//                                             Total Fixed Support W/VAT
//                                         </th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>YAGO Support</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>+ / - (support)</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}>CTS</th>
//                                         <th style={{ backgroundColor: '#00B34A' }}></th>
//                                     </tr>
//                                 </thead>
//                                 <tbody>
//                                     {tableData.map((row, index) => (
//                                         <tr key={index}>
//                                             <td>
//                                                 <input
//                                                     type="checkbox"
//                                                     name="checked"
//                                                     checked={row.checked}
//                                                     onChange={(e) => handleTableChange(index, e)}
//                                                 />
//                                             </td>
//                                             {Object.entries(row).map(([key, value]) => {
//                                                 if (key === 'checked') return null;

//                                                 return (
//                                                     <td key={key} style={key === 'brand' ? { position: 'relative' } : {}}>
//                                                         {key === 'brand' ? (
//                                                             <>
//                                                                 <select
//                                                                     name={key}
//                                                                     value={value}
//                                                                     onChange={(e) => handleTableChange(index, e)}
//                                                                     className="form-control"
//                                                                     style={{
//                                                                         width: '200px',
//                                                                         paddingRight: '30px',
//                                                                         appearance: 'none',
//                                                                         WebkitAppearance: 'none',
//                                                                         MozAppearance: 'none',
//                                                                     }}
//                                                                 >
//                                                                     <option value="">Select Brand</option>
//                                                                     {Object.values(brands).flat().map((brand, idx) => (
//                                                                         <option key={idx} value={brand.name}>
//                                                                             {` ${brand.name}`}
//                                                                         </option>
//                                                                     ))}

//                                                                 </select>

//                                                                 {/* Custom arrow */}
//                                                                 <span
//                                                                     style={{
//                                                                         position: 'absolute',
//                                                                         right: '20px',
//                                                                         top: '50%',
//                                                                         transform: 'translateY(-50%)',
//                                                                         pointerEvents: 'none',
//                                                                         color: '#555',
//                                                                         fontSize: '14px',
//                                                                         userSelect: 'none',
//                                                                     }}
//                                                                 >
//                                                                     ▼
//                                                                 </span>
//                                                             </>
//                                                         ) : (
//                                                             <input
//                                                                 type="text"
//                                                                 name={key}
//                                                                 value={value}
//                                                                 onChange={(e) => handleTableChange(index, e)}
//                                                                 className="form-control"
//                                                                 style={key === 'brand' ? { width: '200px' } : {}}
//                                                             />
//                                                         )}
//                                                     </td>

//                                                 );
//                                             })}

//                                             <td className="text-center">
//                                                 <button
//                                                     className="btn btn-danger btn-sm"
//                                                     onClick={() => handleDeleteRow(index)}
//                                                 >
//                                                     <i className="fas fa-trash-alt"></i>
//                                                 </button>
//                                             </td>
//                                         </tr>
//                                     ))}
//                                 </tbody>
//                             </table>
//                             <button style={{ marginLeft: '10px' }} className="btn btn-outline-success" onClick={handleAddRow}>
//                                 + Add Row
//                             </button>
//                         </div>

//                         {/* <button className="btn btn-success mt-3" onClick={handleSubmitTable}>
//                         Submit Table Data
//                     </button> */}

//                         <div
//                             className="d-flex justify-content-between"
//                             style={{
//                                 position: "fixed",
//                                 bottom: 0,
//                                 right: 0,          // Align right instead of left 0
//                                 width: "auto",     // Let width shrink to content
//                                 padding: "0.5rem 1rem",
//                                 display: "flex",
//                                 justifyContent: "flex-end",  // Align buttons right inside footer
//                                 alignItems: "center",
//                                 backdropFilter: "blur(1px)",  // Optional: add blur behind for better readability
//                                 zIndex: 1000,
//                             }}
//                         >
//                             <div>
//                                 <button className="btn btn-outline-secondary me-2" onClick={handlePrevious}>
//                                     ← Previous
//                                 </button>

//                             </div>
//                             <div>
//                                 <button className="btn btn-primary" onClick={handleNext}>
//                                     Next →
//                                 </button>
//                             </div>

//                         </div>
//                     </div>

//                 )
//             }

//             {
//                 currentStep === 3 && (
//                     <div className="card shadow-sm p-4">
//                         <div className="col-12 col-md-6">
//                             <div
//                                 className="card p-4 animate-fade-slide-up shadow-sm"
//                                 style={{
//                                     background: 'linear-gradient(135deg,rgb(255, 168, 168),rgb(247, 217, 217))', // gentle blue gradient
//                                     borderRadius: '12px',
//                                     border: '1px solidrgb(230, 85, 85)',
//                                     color: '#1a3e72',
//                                     boxShadow: '0 4px 8px rgba(26, 62, 114, 0.15)',
//                                 }}
//                             >
//                                 <h3
//                                     className="mb-0"
//                                     style={{
//                                         fontWeight: '700',
//                                         letterSpacing: '2px',
//                                         textTransform: 'uppercase',
//                                         fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
//                                         textShadow: '1px 1px 2px rgba(21, 31, 46, 0.3)',
//                                     }}
//                                 >
//                                     coporate
//                                 </h3>
//                             </div>
//                         </div>
//                         <h4 className="mb-3">Approval List</h4>

//                         <div className="table-responsive">
//                             <table className="table table-bordered table-striped table-hover">
//                                 <thead className="table-success">
//                                     <tr>
//                                         <th>Approver</th>
//                                         <th>Position</th>
//                                         <th>Status</th>
//                                         <th>Date Approved</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody>
//                                     <tr>
//                                         <td>John Doe</td>
//                                         <td>Manager</td>
//                                         <td><span className="badge bg-warning text-dark">Pending</span></td>
//                                         <td>-</td>
//                                     </tr>
//                                     <tr>
//                                         <td>Jane Smith</td>
//                                         <td>Supervisor</td>
//                                         <td><span className="badge bg-success">Approved</span></td>
//                                         <td>2024-12-01</td>
//                                     </tr>
//                                     <tr>
//                                         <td>Michael Reyes</td>
//                                         <td>HR Head</td>
//                                         <td><span className="badge bg-danger">Rejected</span></td>
//                                         <td>2024-11-28</td>
//                                     </tr>
//                                 </tbody>
//                             </table>



//                             <h4 className="mt-4">Attachments</h4>

//                             <div
//                                 onDrop={handleDrop}
//                                 onDragOver={handleDragOver}
//                                 onClick={() => fileInputRef.current.click()}
//                                 className="border border-primary rounded p-4 mb-3"
//                                 style={{
//                                     cursor: 'pointer',
//                                     minHeight: '150px',
//                                     display: 'flex',
//                                     flexWrap: 'wrap',
//                                     gap: '10px',
//                                     alignItems: 'center',
//                                     justifyContent: files.length === 0 ? 'center' : 'flex-start',
//                                     backgroundColor: '#f8f9fa',
//                                     position: 'relative',
//                                     transition: 'background-color 0.3s',
//                                 }}
//                             >
//                                 {files.length === 0 && <p className="text-muted">Drag & Drop files here or click to upload</p>}

//                                 {files.map((file, index) => (
//                                     <div
//                                         key={index}
//                                         className="position-relative"
//                                         style={{
//                                             width: '100px',
//                                             height: '100px',
//                                             border: '1px solid #ddd',
//                                             borderRadius: '6px',
//                                             overflow: 'hidden',
//                                             textAlign: 'center',
//                                             padding: '5px',
//                                             backgroundColor: 'white',
//                                             boxShadow: '0 0 4px rgba(0,0,0,0.1)',
//                                         }}
//                                     >
//                                         {file.type.startsWith('image/') ? (
//                                             <img
//                                                 src={file.preview}
//                                                 alt={file.name}
//                                                 style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
//                                             />
//                                         ) : (
//                                             <div style={{ fontSize: '12px', wordWrap: 'break-word', marginTop: '30px' }}>
//                                                 <i className="bi bi-file-earmark" style={{ fontSize: '28px', color: '#0d6efd' }}></i>
//                                                 <div>{file.name.length > 15 ? file.name.slice(0, 15) + '...' : file.name}</div>
//                                             </div>
//                                         )}
//                                         <button
//                                             type="button"
//                                             onClick={(e) => {
//                                                 e.stopPropagation();
//                                                 removeFile(index);
//                                             }}
//                                             className="btn btn-sm btn-danger position-absolute top-0 end-0"
//                                             style={{ borderRadius: '0 0 0 6px' }}
//                                             title="Remove file"
//                                         >
//                                             &times;
//                                         </button>
//                                     </div>
//                                 ))}

//                                 <input
//                                     type="file"
//                                     multiple
//                                     ref={fileInputRef}
//                                     onChange={handleFileInputChange}
//                                     style={{ display: 'none' }}

//                                 />
//                             </div>
//                         </div>

//                         <div className="mt-4 d-flex justify-content-between">
//                             <button className="btn btn-outline-secondary" onClick={handlePrevious}>
//                                 ← Previous
//                             </button>
//                             <button
//                                 type="button"
//                                 className="btn btn-success"
//                                 onClick={handleSubmitToApprovers}
//                             >
//                                 Submit To Approvers
//                             </button>
//                         </div>
//                     </div >
//                 )
//             }
//         </div >
//     );
// };
// const checkStyle = {
//     position: 'absolute',
//     right: '50px',
//     top: '30px',
//     color: 'green',
//     fontWeight: 'bold',
//     fontSize: '25px',
//     pointerEvents: 'none',
//     userSelect: 'none',
// };
// const dropdownIconStyle = {
//     position: 'absolute',
//     right: '20px',
//     top: '70%',
//     transform: 'translateY(-50%)',
//     pointerEvents: 'none',
//     color: '#555',
//     fontSize: '14px',
//     userSelect: 'none',
// };

// const checkIconStyle = {
//     position: 'absolute',
//     right: '40px',
//     top: '50%',
//     transform: 'translateY(-20%)',
//     color: 'green',
//     fontWeight: 'bold',
//     fontSize: '25px',
//     pointerEvents: 'none',
//     userSelect: 'none',
// };

// export default VisaForm;
