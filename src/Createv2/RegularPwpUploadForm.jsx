// import React, { useState, useEffect } from 'react';
// import { supabase } from '../supabaseClient';
// import { FaSearch } from 'react-icons/fa';

// export default function RegularPwpUploadForm() {
//   const generateCode = () => {
//     const year = new Date().getFullYear();
//     const random = Math.floor(Math.random() * 1000) + 1;
//     return `PWP${year}-${random}`;
//   };

//   const [form, setForm] = useState({
//     pwpREGCode: generateCode(),
//     pwpCode: '',
//     distributor: '',
//     brand: '',
//     account: '',
//     supportType: '',
//     accountGroup: '',
//     activity: '',
//     marketingType: ' Uploading Regular',
//     imageUrl: '',
//   });

//   const [loading, setLoading] = useState(false);
//   const [modalOpen, setModalOpen] = useState(false);
//   const [modalData, setModalData] = useState({ coverVisa: [], regularVisa: [] });
//   const [imageFile, setImageFile] = useState(null);

//   // Responsive state
//   const [isMobile, setIsMobile] = useState(false);

//   useEffect(() => {
//     const checkMobile = () => {
//       setIsMobile(window.innerWidth <= 600);
//     };
//     checkMobile();
//     window.addEventListener('resize', checkMobile);
//     return () => window.removeEventListener('resize', checkMobile);
//   }, []);

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setForm((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleFileChange = (e) => {
//     const file = e.target.files[0];
//     if (file) setImageFile(file);
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     const storedUser = JSON.parse(localStorage.getItem('user'));
//     if (!storedUser?.name) return alert('User not found.');

//     setLoading(true);

//     let uploadedFileName = '';
//     if (imageFile) {
//       uploadedFileName = imageFile.name;
//     }

//     const { error } = await supabase.from('regular_pwp_uploads').insert([
//       {
//         pwpcode: form.pwpCode,
//         distributor: form.distributor,
//         brand: form.brand,
//         account: form.account,
//         support_type: form.supportType,
//         account_group: form.accountGroup,
//         activity: form.activity,
//         marketing_type: form.marketingType,
//         imageFile: uploadedFileName || null,
//         created_user: storedUser.name,
//         pwpregcode: form.pwpREGCode,
//       },
//     ]);

//     setLoading(false);

//     if (error) {
//       alert('Upload failed');
//     } else {
//       alert('Uploaded successfully');
//       setForm({
//         pwpCode: '',
//         distributor: '',
//         brand: '',
//         account: '',
//         supportType: '',
//         accountGroup: '',
//         activity: '',
//         marketingType: ' Uploading Regular',
//         imageUrl: '',
//       });
//       setImageFile(null);
//     }
//   };

//   const showVisaDetails = async () => {
//     setModalOpen(true);
//     const [coverVisaRes, regularVisaRes] = await Promise.all([
//       supabase.from('Cover_Visa').select('*'),
//       supabase.from('Regular_Visa').select('*'),
//     ]);

//     setModalData({
//       coverVisa: coverVisaRes.data || [],
//       regularVisa: regularVisaRes.data || [],
//     });
//   };

//   const handleRowClick = (row) => {
//     const updatedForm = {
//       pwpCode: row.visaCode || '',
//       distributor: row.principal || '',
//       brand: row.brand || row.principal || '',
//       account: row.account || '',
//       supportType: row.supportType || '',
//       accountGroup: row.accountGroup || '',
//       activity: row.activity || '',
//       marketingType: ' Uploading Regular',
//       imageUrl: '',
//     };

//     setForm((prev) => ({
//       ...updatedForm,
//       pwpREGCode: generateCode(), // regenerate
//     }));

//     setModalOpen(false);
//   };

//   return (
//     <>
//       <form
//         onSubmit={handleSubmit}
//         style={{
//           ...styles.form,
//           padding: isMobile ? '20px 10px' : styles.form.padding,
//         }}
//       >
//         <h2 style={styles.title}>Upload Regular PWP</h2>
//         <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
//           <h3 style={styles.generatedTitle}>{form.pwpREGCode}</h3>
//         </div>

//         <div style={isMobile ? { display: 'block' } : styles.grid}>
//           <div style={styles.inputGroup}>
//             <label htmlFor="pwpCode">PWP Code</label>
//             <div style={{ display: 'flex', alignItems: 'center' }}>
//               <input
//                 id="pwpCode"
//                 type="text"
//                 name="pwpCode"
//                 value={form.pwpCode}
//                 onChange={handleChange}
//                 required
//                 style={{
//                   ...styles.input,
//                   flex: '1',
//                   minWidth: 0,
//                   marginRight: '6px',
//                   fontSize: isMobile ? 16 : 14,
//                 }}
//                 placeholder="Enter PWP Code"
//               />
//               <button type="button" onClick={showVisaDetails} style={styles.searchBtn}>
//                 <FaSearch color="#10b981" size={isMobile ? 20 : 16} />
//               </button>
//             </div>
//           </div>

//           {[
//             { label: 'Distributor', name: 'distributor' },
//             { label: 'Brand', name: 'brand' },
//             { label: 'Account', name: 'account' },
//             { label: 'Support Type', name: 'supportType' },
//             { label: 'Account Group', name: 'accountGroup' },
//             { label: 'Activity', name: 'activity' },
//           ].map((field) => (
//             <div
//               key={field.name}
//               style={{
//                 ...styles.inputGroup,
//                 marginBottom: isMobile ? '1rem' : 0,
//               }}
//             >
//               <label htmlFor={field.name}>{field.label}</label>
//               <input
//                 id={field.name}
//                 type="text"
//                 name={field.name}
//                 value={form[field.name]}
//                 onChange={handleChange}
//                 required
//                 style={{
//                   ...styles.input,
//                   fontSize: isMobile ? 16 : 14,
//                 }}
//                 placeholder={`Enter ${field.label}`}
//               />
//             </div>
//           ))}

//           <div style={{ ...styles.inputGroup, marginBottom: isMobile ? '1rem' : 0 }}>
//             <label htmlFor="marketingType">Marketing Type</label>
//             <input
//               id="marketingType"
//               type="text"
//               name="marketingType"
//               value={form.marketingType}
//               readOnly
//               style={{
//                 ...styles.input,
//                 backgroundColor: '#f3f3f3',
//                 cursor: 'not-allowed',
//                 fontSize: isMobile ? 16 : 14,
//               }}
//             />
//           </div>

//           <div
//             onDrop={(e) => {
//               e.preventDefault();
//               setImageFile(e.dataTransfer.files[0]);
//             }}
//             onDragOver={(e) => e.preventDefault()}
//             style={{
//               marginTop: '2rem',
//               padding: '1.5rem',
//               border: '2px dashed #10b981',
//               borderRadius: '8px',
//               textAlign: 'center',
//               backgroundColor: '#f9fefb',
//               cursor: 'pointer',
//               transition: 'background 0.3s ease',
//             }}
//           >
//             <label htmlFor="fileUpload" style={{ cursor: 'pointer' }}>
//               <strong>Drop your file here</strong> or click to browse
//               <br />
//               <span style={{ fontSize: 12, color: '#666' }}>Accepted: All file types</span>
//             </label>
//             <input
//               id="fileUpload"
//               type="file"
//               accept="*/*"
//               onChange={handleFileChange}
//               style={{ display: 'none' }}
//             />

//             {imageFile && (
//               <div style={{ marginTop: '1rem' }}>
//                 {imageFile.type.startsWith('image/') ? (
//                   <img
//                     src={URL.createObjectURL(imageFile)}
//                     alt="Preview"
//                     style={{
//                       width: '100%',
//                       maxHeight: 160,
//                       objectFit: 'contain',
//                       border: '1px solid #ccc',
//                       borderRadius: 6,
//                     }}
//                   />
//                 ) : (
//                   <div
//                     style={{
//                       padding: '10px',
//                       backgroundColor: '#f3f3f3',
//                       borderRadius: 6,
//                       fontStyle: 'italic',
//                       fontSize: '14px',
//                       color: '#333',
//                       textAlign: 'center',
//                       border: '1px solid #ccc',
//                     }}
//                   >
//                     📎 {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>
//         </div>

//         <button
//           type="submit"
//           disabled={loading}
//           style={{
//             ...styles.submitBtn,
//             width: isMobile ? '100%' : 'auto',
//             float: isMobile ? 'none' : 'right',
//             fontSize: isMobile ? 18 : 16,
//           }}
//         >
//           {loading ? 'Uploading...' : 'Submit'}
//         </button>
//       </form>

//       {modalOpen && (
//         <div style={styles.modalBackdrop} onClick={() => setModalOpen(false)}>
//           <div
//             style={{
//               ...styles.modalContent,
//               maxWidth: isMobile ? '95%' : styles.modalContent.maxWidth,
//               maxHeight: isMobile ? '90vh' : styles.modalContent.maxHeight,
//               padding: isMobile ? '1rem' : styles.modalContent.padding,
//             }}
//             onClick={(e) => e.stopPropagation()}
//           >


//             <h3 style={{ ...styles.modalTitle, marginTop: '2rem' }}>Regular Visa</h3>
//             {modalData.regularVisa.length > 0 ? (
//               <table style={styles.table}>
//                 <thead>
//                   <tr>
//                     <th style={styles.th}>Visa Code</th>
//                     <th style={styles.th}>Principal</th>
//                     <th style={styles.th}>Account</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {modalData.regularVisa.map((row) => (
//                     <tr
//                       key={row.id}
//                       style={styles.tr}
//                       onClick={() => handleRowClick(row)}
//                       onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dafbe9')}
//                       onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
//                     >
//                       <td style={styles.td}>{row.visaCode}</td>
//                       <td style={styles.td}>{row.principal}</td>
//                       <td style={styles.td}>{row.account}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             ) : (
//               <p style={styles.noData}>No Regular Visa Data Available</p>
//             )}

//             <button
//               onClick={() => setModalOpen(false)}
//               style={{
//                 ...styles.closeBtn,
//                 width: isMobile ? '100%' : 'auto',
//                 float: isMobile ? 'none' : 'right',
//               }}
//             >
//               Close
//             </button>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// // Your styles object with no changes but usage improved for mobile
// const styles = {
//   form: {
//     width: '100%',
//     maxWidth: '1400px',
//     margin: '0 auto',
//     padding: '80px',
//     fontFamily: 'sans-serif',
//     boxSizing: 'border-box',
//   },

//   generatedTitle: {
//     margin: 0,
//     padding: '10px 20px',
//     backgroundColor: '#f3f3f3',
//     borderRadius: 6,
//     fontSize: '1.25rem',
//     fontWeight: '600',
//     color: '#0f172a',
//     textAlign: 'right',
//     width: '220px',
//     userSelect: 'text',
//   },

//   title: {
//     fontSize: '2rem',
//     marginBottom: '2rem',
//     fontWeight: '700',
//     color: '#0f172a',
//     textAlign: 'left',
//     paddingLeft: '12px',
//     borderLeft: '4px solid #10b981',
//     letterSpacing: '0.5px',
//   },

//   grid: {
//     display: 'grid',
//     gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
//     gap: '1.5rem',
//   },

//   inputGroup: {
//     display: 'flex',
//     flexDirection: 'column',
//   },

//   input: {
//     padding: '10px',
//     border: '1px solid #ccc',
//     borderRadius: 6,
//     fontSize: 14,
//     outline: 'none',
//   },

//   searchBtn: {
//     background: 'transparent',
//     border: 'none',
//     marginLeft: 6,
//     cursor: 'pointer',
//   },

//   submitBtn: {
//     marginTop: '2rem',
//     padding: '10px 28px',
//     backgroundColor: '#10b981',
//     color: '#fff',
//     border: 'none',
//     borderRadius: 6,
//     fontSize: 16,
//     cursor: 'pointer',
//     float: 'right',
//   },

//   modalBackdrop: {
//     position: 'fixed',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     background: 'rgba(0,0,0,0.5)',
//     display: 'flex',
//     justifyContent: 'center',
//     alignItems: 'center',
//     zIndex: 1000,
//     padding: '1rem',
//     overflowY: 'auto',
//   },

//   modalContent: {
//     background: '#fff',
//     padding: '1.5rem',
//     borderRadius: 8,
//     maxWidth: '1000px',
//     width: '100%',
//     maxHeight: '85vh',
//     overflowY: 'auto',
//     boxSizing: 'border-box',
//   },

//   modalTitle: {
//     marginBottom: '1rem',
//     color: '#065f46',
//     fontWeight: '700',
//     fontSize: '1.5rem',
//     borderBottom: '2px solid #10b981',
//     paddingBottom: '0.5rem',
//   },

//   table: {
//     width: '100%',
//     borderCollapse: 'collapse',
//     marginTop: '1rem',
//     boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
//   },

//   th: {
//     padding: '12px 15px',
//     borderBottom: '2px solid #10b981',
//     backgroundColor: '#dafbe9',
//     color: '#065f46',
//     fontWeight: '600',
//     textTransform: 'capitalize',
//     textAlign: 'left',
//     userSelect: 'none',
//   },

//   td: {
//     padding: '12px 15px',
//     borderBottom: '1px solid #ddd',
//     color: '#0f172a',
//     fontSize: '14px',
//   },

//   tr: {
//     cursor: 'pointer',
//     transition: 'background-color 0.25s ease',
//   },

//   noData: {
//     marginTop: '1.5rem',
//     fontStyle: 'italic',
//     color: '#777',
//     textAlign: 'center',
//   },

//   closeBtn: {
//     marginTop: '1.5rem',
//     padding: '10px 20px',
//     backgroundColor: '#ef4444',
//     color: '#fff',
//     border: 'none',
//     borderRadius: '6px',
//     cursor: 'pointer',
//     fontWeight: '600',
//     fontSize: '14px',
//     float: 'right',
//     boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)',
//     transition: 'background-color 0.3s ease',
//   },
// };





import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';  // <---- import sweetalert2
import { supabase } from '../supabaseClient';
import { Modal, Button } from 'react-bootstrap'; // Ensure react-bootstrap is installed
import { FaExclamationTriangle } from 'react-icons/fa'; // Make sure react-icons is installed

const RegularPwpUploadForm = () => {

  const [singleApprovals, setSingleApprovals] = useState([]);
  const [userApprovers, setUserApprovers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch singleapprovals
      const { data: approvalsData, error: approvalsError } = await supabase
        .from('singleapprovals')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch user approvers
      const { data: userApproversData, error: userApproversError } = await supabase
        .from('User_Approvers')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch users for name lookup
      const { data: usersData, error: usersError } = await supabase
        .from('Account_Users')
        .select('UserID, name');

      if (approvalsError) console.error('Error fetching approvals:', approvalsError);
      if (userApproversError) console.error('Error fetching user approvers:', userApproversError);
      if (usersError) console.error('Error fetching users:', usersError);

      setSingleApprovals(approvalsData || []);
      setUserApprovers(userApproversData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Helper: get name from user_id
  const getUserName = (user_id) => {
    const user = users.find((u) => u.UserID === user_id);
    return user ? user.name || 'No Name' : 'Unknown User';
  };

  // Combine and normalize data into one array for the table
  const combinedData = [
    ...singleApprovals.map((a) => ({
      id: a.id,
      approver: getUserName(a.user_id),
      position: a.position,
      status: a.allowed_to_approve ? 'Approved' : 'Pending',
      type: '',
      created_at: a.created_at,
      isSingleApproval: true,
    })),
    ...userApprovers.map((u) => ({
      id: u.id,
      approver: u.Approver_Name || 'No Name',
      position: '',
      status: '',
      type: u.Type || '',
      created_at: u.created_at,
      isSingleApproval: false,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // newest first




  const today = new Date().toISOString().split('T')[0];

  // Step 0: Form data
  const [formData, setFormData] = useState({
    visaCode: "",
    company: "MEGASOFT",
    principal: "",
    brand: "",
    accountType: "",
    account: "",
    activity: "",
    visaType: "Regular", // ✅ Set default
    Notification: false,
    objective: "",
    promoScheme: "",
    leadTimeFrom: today,
    leadTimeTo: today,
    activityDurationFrom: today,
    activityDurationTo: today,
    isPartOfCoverVisa: null, // null = no selection yet, true/false
    coverVisaCode: "",
    supportType: "",
    RegularPwpCode: "",
  });

  // Step control: 0 = form, 1 = promoted sales, 2 = cost details, 3 = upload
  const [step, setStep] = useState(0);

  // Promoted sales rows
  const [promoRows, setPromoRows] = useState([
    {
      promotedSKU: "",
      listPrice: "",
      nonPromoAvgSales: "",
      UM: "Cases", // default UM
      nonPromoAvgSalesAmount: "",
      projectedAvgSales: "",
      projectedAvgSalesAmount: "",
      increasePercent: "",
    },
  ]);

  // Cost details rows
  const [costRows, setCostRows] = useState([
    {
      costDetails: "",
      quantity: "",
      unitCost: "",
      discount: "",
      chargeTo: "Company", // default option
    },
  ]);

  // Handle input change for form fields
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === "accountType" ? { account: "" } : {}) // reset groupAccount if accountType changed
    }));
  };


  // Handle toggle change for Is Part of Cover Visa
  const [coverVisas, setCoverVisas] = useState([]);

  const handleToggleChange = (value) => {
    setFormData({ ...formData, isPartOfCoverVisa: value, coverVisaCode: "" });
    setShowCoverVisaCode(false);
  };


  useEffect(() => {
    let isMounted = true;

    const fetchCoverVisas = async () => {
      const { data, error } = await supabase
        .from("Cover_Visa") // ✅ Fixed table name
        .select("*");

      if (error) {
        console.error("❌ Error fetching Cover Visas from Supabase:", error);
        if (isMounted) setCoverVisas([]);
        return;
      }

      if (data && isMounted) {
        const parsedList = data.map((item) => ({
          coverVisaCode: item.visaCode || item.id, // ✅ Correct key
          ...item,
        }));
        console.log("✅ Supabase Cover Visas:", parsedList);
        setCoverVisas(parsedList);
      }
    };

    fetchCoverVisas();

    return () => {
      isMounted = false;
    };
  }, []);




  const handleSubmitToSupabase = async () => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (!storedUser) {
      Swal.fire({
        icon: 'error',
        title: 'User not found',
        text: 'Please log in again.',
      });
      return;
    }

    // Insert data into Regular_Visa table
    const { data: insertData, error: insertError } = await supabase
      .from('RegularUpload')
      .insert([{
        visaCode: formData.visaCode,
        RegularPwpCode: formData.RegularPwpCode,


        company: formData.company,
        principal: formData.principal,
        brand: formData.brand,
        accountType: formData.accountType,
        account: formData.account,
        activity: formData.activity,
        visaType: formData.visaType,
        objective: formData.objective,
        promoScheme: formData.promoScheme,
        activityDurationFrom: formData.activityDurationFrom,
        activityDurationTo: formData.activityDurationTo,
        isPartOfCoverVisa: formData.isPartOfCoverVisa,
        coverVisaCode: formData.coverVisaCode || 'No',
        Notification: formData.Notification,
        CreatedForm: storedUser.name,
        supportType: formData.supportType,
        UploadRegular: true,
        Regular: false,
      }])
      .select()
      .single();

    if (insertError) {
      console.error("❌ Failed to insert into Supabase:", insertError);
      return;
    }

    console.log("✅ Data successfully posted to Supabase:", insertData);

    // Calculate remaining balance
    const remainingBalance = Math.abs(totalCostSum - (amountBadget ?? 0));

    // Update remaining balance in amount_badget table
    const { data: updateData, error: updateError } = await supabase
      .from('amount_badget')
      .update({ remainingbalance: remainingBalance })
      .eq('visacode', formData.coverVisaCode)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update remaining balance:', updateError);
      return;
    }

    console.log('✅ Remaining balance updated:', updateData);

    // Insert into amount_badget_history table
    const { error: historyError } = await supabase
      .from('amount_badget_history')
      .insert([{
        original_id: updateData.id,
        visacode: updateData.visacode,
        amountbadget: updateData.amountbadget,
        createduser: updateData.createduser,
        remainingbalance: remainingBalance,
        RegularID: insertData.id,
        action_type: 'update',
        action_user: storedUser.name,
        TotalCost: totalCostSum, // ✅ Corrected casing
      }]);


    if (historyError) {
      console.error("❌ Failed to insert history record:", historyError);
    } else {
      console.log("✅ History record added to amount_badget_history.");
    }
  };






  // Auto-select first Cover Visa when toggled ON
  useEffect(() => {
    if (formData.isPartOfCoverVisa && coverVisas.length > 0) {
      setFormData((prev) => ({
        ...prev,
        coverVisaCode: coverVisas[0].coverVisaCode || coverVisas[0].code || '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        coverVisaCode: '',
      }));
    }
  }, [formData.isPartOfCoverVisa, coverVisas]);


  const formatCurrency = (num) =>
    `PHP ${Number(num || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;


  // Handle promo table row change
  const handlePromoChange = (index, e) => {
    const { name, value } = e.target;
    setPromoRows((prevRows) => {
      const newRows = [...prevRows];
      const row = { ...newRows[index], [name]: value };

      // Convert strings to numbers for calculation, default to 0 if NaN
      const listPrice = parseFloat(row.listPrice) || 0;
      const nonPromoAvgSales = parseFloat(row.nonPromoAvgSales) || 0;
      const projectedAvgSales = parseFloat(row.projectedAvgSales) || 0;

      // Calculate dependent fields
      row.nonPromoAvgSalesAmount = (nonPromoAvgSales * listPrice).toFixed(2);
      row.projectedAvgSalesAmount = (projectedAvgSales * listPrice).toFixed(2);

      if (nonPromoAvgSales > 0) {
        row.increasePercent = (
          ((projectedAvgSales - nonPromoAvgSales) / nonPromoAvgSales) *
          100
        ).toFixed(2);
      } else {
        row.increasePercent = "0.00";
      }

      newRows[index] = row;
      return newRows;
    });
  };


  // Add promo row
  const addPromoRow = () => {
    setPromoRows((prev) => [
      ...prev,
      {
        promotedSKU: "",
        listPrice: "",
        nonPromoAvgSales: "",
        UM: "Cases",
        nonPromoAvgSalesAmount: "",
        projectedAvgSales: "",
        projectedAvgSalesAmount: "",
        increasePercent: "",
      },
    ]);
  };

  // Handle cost table row change
  const handleCostChange = (index, e) => {
    const { name, value } = e.target;
    const newRows = [...costRows];
    newRows[index][name] = value;
    setCostRows(newRows);
  };

  // Add cost row
  const addCostRow = () => {
    setCostRows((prev) => [
      ...prev,
      {
        costDetails: "",
        quantity: "",
        unitCost: "",
        discount: "",
        chargeTo: "Company",
      },
    ]);
  };




  useEffect(() => {
    const generateVisaCodeIfNeeded = async () => {
      const year = new Date().getFullYear();
      const prefix = `U${year}-`;
      const startNumber = 1;

      try {
        if (formData.visaCode) {
          // If visaCode already exists, verify if it's in Supabase
          const { data: existingCodes, error } = await supabase
            .from('RegularUpload')
            .select('visaCode')
            .ilike('visaCode', `${prefix}%`);

          if (error) throw error;

          const codesSet = new Set(existingCodes.map(item => item.visaCode));
          if (codesSet.has(formData.visaCode)) {
            // visaCode already exists in DB, keep it
            setFormData(prev => ({ ...prev, visaCode: formData.visaCode }));
            return;
          }
        }

        // If no visaCode or code not found, generate a new one
        const { data: allCodes, error: fetchError } = await supabase
          .from('RegularUpload')
          .select('visaCode')
          .ilike('visaCode', `${prefix}%`);

        if (fetchError) throw fetchError;

        const existingNumbers = new Set();

        allCodes.forEach(({ visaCode }) => {
          const numPart = visaCode.substring(prefix.length);
          const num = parseInt(numPart, 10);
          if (!isNaN(num)) {
            existingNumbers.add(num);
          }
        });

        // Find next available number
        let nextNumber = startNumber;
        while (existingNumbers.has(nextNumber)) {
          nextNumber++;
        }

        const newVisaCode = `${prefix}${nextNumber}`;
        setFormData(prev => ({ ...prev, visaCode: newVisaCode }));

      } catch (err) {
        console.error('Error checking/generating visa code:', err);
      }
    };

    generateVisaCodeIfNeeded();
  }, [formData.visaCode]);

  const totalNonPromoSalesAmount = promoRows.reduce((sum, row) => sum + parseFloat(row.nonPromoAvgSalesAmount || 0), 0);
  const totalProjectedSalesAmount = promoRows.reduce((sum, row) => sum + parseFloat(row.projectedAvgSalesAmount || 0), 0);
  const avgIncreasePercent = promoRows.length > 0
    ? promoRows.reduce((sum, row) => sum + parseFloat(row.increasePercent || 0), 0) / promoRows.length
    : 0;



  // Assume totalSales is defined somewhere in your component, e.g.:
  const totalSales = 200000; // example value

  const totalQuantity = costRows.reduce(
    (sum, row) => sum + (parseFloat(row.quantity) || 0),
    0
  );

  const totalCostSum = costRows.reduce((sum, row) => {
    const quantity = parseFloat(row.quantity) || 0;
    const unitCost = parseFloat(row.unitCost) || 0;
    const discount = parseFloat(row.discount) || 0;
    const rowTotal = quantity * unitCost * (1 - discount / 100);
    return sum + rowTotal;
  }, 0);

  const costToSales = totalSales > 0 ? (totalCostSum / totalSales) * 100 : 0;




  const [files, setFiles] = useState([]);
  const fileInputRef = useRef();

  const handleFiles = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).map(file => {
      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        file.preview = URL.createObjectURL(file);
      }
      return file;
    });
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInputChange = (e) => {
    handleFiles(e.target.files);
  };

  const removeFile = (index) => {
    const updated = [...files];
    // Revoke preview URL to avoid memory leaks
    if (updated[index].preview) {
      URL.revokeObjectURL(updated[index].preview);
    }
    updated.splice(index, 1);
    setFiles(updated);
  };



  const handlePrevious = () => {
    setStep((prev) => Math.max(prev - 1, 0)); // prevents going below 0
  };


  const handleAddRow = () => {
    setCostRows((prev) => [
      ...prev,
      {
        costDetails: '',
        quantity: '',
        unitCost: '',
        discount: '',
        chargeTo: 'Company'
      }
    ]);
  };

  const handleDeleteRow = (index) => {
    setCostRows((prev) => prev.filter((_, i) => i !== index));
  };
  const handleDeletePromoRow = (index) => {
    setPromoRows((prevRows) => prevRows.filter((_, i) => i !== index));
  };


  const postCostAndVolumeToSupabase = async () => {
    if (!formData.visaCode) {
      Swal.fire({
        icon: 'warning',
        title: 'Visa Code Required',
        text: 'Please enter Visa Code before submitting.',
      });
      return;
    }

    try {
      // Calculate totals for Volume Plan
      const totalListPrice = promoRows.reduce((sum, row) => sum + parseFloat(row.listPrice || 0), 0);
      const totalNonPromoAvgSales = promoRows.reduce((sum, row) => sum + parseFloat(row.nonPromoAvgSales || 0), 0);
      const totalNonPromoAvgSalesAmount = promoRows.reduce((sum, row) => sum + parseFloat(row.nonPromoAvgSalesAmount || 0), 0);
      const totalProjectedAvgSales = promoRows.reduce((sum, row) => sum + parseFloat(row.projectedAvgSales || 0), 0);
      const totalProjectedAvgSalesAmount = promoRows.reduce((sum, row) => sum + parseFloat(row.projectedAvgSalesAmount || 0), 0);
      const avgIncreasePercent = promoRows.reduce((sum, row) => sum + parseFloat(row.increasePercent || 0), 0) / (promoRows.length || 1);

      // Calculate totals for Cost Details
      const totalQuantity = costRows.reduce((sum, row) => sum + (parseFloat(row.quantity) || 0), 0);
      const totalCostSum = costRows.reduce((sum, row) => {
        const quantity = parseFloat(row.quantity) || 0;
        const unitCost = parseFloat(row.unitCost) || 0;
        const discount = parseFloat(row.discount) || 0;
        return sum + quantity * unitCost * (1 - discount / 100);
      }, 0);
      const costToSalesValue = parseFloat(costToSales) || 0;

      // Insert Volume Plan
      const { error: volumeError } = await supabase
        .from('Regular_Visa_VolumePlan')
        .insert([{
          visaCode: formData.visaCode,
          rows: promoRows,
          totalListPrice: parseFloat(totalListPrice.toFixed(2)),
          totalNonPromoAvgSales: parseFloat(totalNonPromoAvgSales.toFixed(2)),
          totalNonPromoAvgSalesAmount: parseFloat(totalNonPromoAvgSalesAmount.toFixed(2)),
          totalProjectedAvgSales: Math.round(totalProjectedAvgSales),
          totalProjectedAvgSalesAmount: parseFloat(totalProjectedAvgSalesAmount.toFixed(2)),
          avgIncreasePercent: parseFloat(avgIncreasePercent.toFixed(2)),
        }]);

      if (volumeError) throw volumeError;

      // Insert Cost Details
      const { error: costError } = await supabase
        .from('Regular_Visa_CostDetails')
        .insert([{
          visaCode: formData.visaCode,
          rows: costRows,
          totalQuantity: parseFloat(totalQuantity.toFixed(2)),
          totalCostSum: parseFloat(totalCostSum.toFixed(2)),
          costToSales: parseFloat(costToSalesValue.toFixed(2)),
          remarks: formData.remarks || '',
        }]);

      if (costError) throw costError;

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Volume Plan and Cost Details saved to Supabase successfully!',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Supabase Submission Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: 'Could not save data to Supabase. Please try again.',
      });
    }
  };



  const postToFirebase = async () => {
    try {
    } catch (error) {
      console.error('Error in postToFirebase:', error);
    }
  };

  const postCostAndVolumeDetails = async () => {
    try {
      await postCostAndVolumeToSupabase();
      console.log("✅ Cost details and volume plan submitted.");
    } catch (error) {
      console.error("❌ Error submitting cost/volume details:", error);
      throw error; // Rethrow to handle it where called
    }
  };

  const saveRecentActivity = async ({ UserId }) => {
    try {
      // 1. Get public IP
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipRes.json();

      // 2. Get geolocation info
      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();

      // 3. Build activity entry
      const activity = {
        Device: navigator.userAgent || 'Unknown Device',
        Location: `${geo.city || 'Unknown'}, ${geo.region || 'Unknown'}, ${geo.country_name || 'Unknown'}`,
        IP: ip,
        Time: new Date().toISOString(),
        Action: 'Create Form Regular Upload',
      };

      // 4. Save to Supabase only
      const { error } = await supabase
        .from('RecentActivity')
        .insert([{
          userId: UserId,
          device: activity.Device,
          location: activity.Location,
          ip: activity.IP,
          time: activity.Time,
          action: activity.Action
        }]);

      if (error) {
        console.error('❌ Supabase insert error:', error.message);
      } else {
        console.log('✅ Activity saved to Supabase');
      }

    } catch (err) {
      console.error('❌ Failed to log activity:', err.message || err);
    }
  };


  const handleSubmit = async () => {
    if (!formData.visaCode) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Visa Code',
        text: 'Visa Code is required before submitting!',
      });
      return;
    }

    try {
      if (files.length > 0) {
        console.log("📂 Preparing files for upload...");

        const filePromises = files.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                visaCode: formData.visaCode,
                name: file.name,
                type: file.type,
                size: file.size,
                content: reader.result, // 🔥 base64 content
                uploadedAt: new Date().toISOString(),
              });
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
          });
        });

        const encodedFiles = await Promise.all(filePromises);
        console.log("✅ Files encoded:", encodedFiles);

        // Save attachments metadata to Supabase table only (removed Firestore)
        const { data: supaData, error: supaError } = await supabase
          .from('Regular_Visa_Attachments')
          .insert(encodedFiles);

        if (supaError) {
          console.error("❌ Supabase metadata insert error:", supaError);
        } else {
          console.log("✅ Metadata inserted into Supabase DB:", supaData);
        }
      } else {
        console.log("ℹ️ No files selected. Skipping file upload.");
      }

      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (!storedUser) {
        Swal.fire({
          icon: 'error',
          title: 'User not found',
          text: 'Please log in again.',
        });
        return;
      }

      // Update the database with new data
      await saveRecentActivity({ UserId: storedUser.id });

      // Removed postToFirebase() call
      await postCostAndVolumeDetails();

      await handleSubmitToSupabase();

      Swal.fire({
        icon: 'success',
        title: 'Submitted!',
        text: 'Your data has been successfully submitted.',
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.reload(); // 🔄 Reload page after user clicks OK
        }
      });

      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      console.error("❌ Submission Error:", error);
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: 'There was a problem during submission. Check console for details.',
      });
    }
  };




  const [submitAction, setSubmitAction] = useState(null);

  const handleSubmits = async (e) => {
    e.preventDefault();

    if (submitAction === 'submit') {
    } else {
    }

    setSubmitAction(null); // reset state after action
  };
  const [options, setOptions] = useState([]);

  const [showCoverVisaCode, setShowCoverVisaCode] = useState(false);

  const [hovered, setHovered] = useState(false);

  const borderColor = formData.company ? 'green' : hovered ? '#ccc' : '';
  const [company, setCompany] = useState([]);
  const [salesDivisions, setSalesDivisions] = useState([]);
  const [groupAccount, setGroupAccount] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [visaTypes, setVisaTypes] = useState([]);
  const [activity, setActvity] = useState([]);
  const [principal, setPrincipal] = useState([]);





  const [supportType, setSupportType] = useState([]);


  useEffect(() => {
    let isMounted = true;

    const fetchSupportType = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "CustomerGroup");

      if (error) {
        console.error("Error fetching CustomerGroup data:", error);
      } else if (isMounted) {
        setSupportType(data || []);
      }
    };

    fetchSupportType();

    return () => {
      isMounted = false;
    };
  }, []);
  useEffect(() => {
    let isMounted = true;

    const fetchCompanies = async () => {
      const { data, error } = await supabase
        .from("References")           // your table name
        .select("*")
        .eq("reference_type", "Company");

      if (error) {
        console.error("Error fetching Company:", error);
      } else if (isMounted) {
        setCompany(data); // set state with the array of results
      }
    };

    fetchCompanies();

    return () => {
      isMounted = false; // cleanup to avoid setting state if unmounted
    };
  }, []);


  useEffect(() => {
    let isMounted = true;

    const fetchSalesDivisions = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "SalesDivision");

      if (error) {
        console.error("Error fetching SalesDivisions:", error);
        if (isMounted) setSalesDivisions([]);
      } else if (isMounted) {
        setSalesDivisions(data || []);
      }
    };

    fetchSalesDivisions();

    return () => {
      isMounted = false;
    };
  }, []);
  useEffect(() => {
    if (!formData.accountType) {
      setGroupAccount([]); // clear when no accountType selected
      return;
    }

    let isMounted = true;

    const fetchGroupAccountsByParentName = async () => {
      // Get the AccountType's name by id
      const { data: accountTypeData, error: accountTypeError } = await supabase
        .from("References")
        .select("name")
        .eq("id", formData.accountType)
        .single();

      if (accountTypeError) {
        console.error("Error fetching AccountType name:", accountTypeError);
        if (isMounted) setGroupAccount([]);
        return;
      }

      if (!accountTypeData) {
        if (isMounted) setGroupAccount([]);
        return;
      }

      const parentName = accountTypeData.name;

      // Fetch GroupAccounts where parent_id = AccountType name
      const { data: groupAccounts, error: groupAccountError } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "GroupAccount")
        .eq("parent_id", parentName);

      if (groupAccountError) {
        console.error("Error fetching GroupAccounts:", groupAccountError);
        if (isMounted) setGroupAccount([]);
        return;
      }

      if (isMounted) setGroupAccount(groupAccounts || []);
    };

    fetchGroupAccountsByParentName();

    return () => {
      isMounted = false;
    };
  }, [formData.accountType]);





  // Load group account list when accountType is selected
  useEffect(() => {
    let isMounted = true;

    const fetchAccountTypes = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "AccountType");

      if (error) {
        console.error("Error fetching AccountTypes:", error);
      } else if (isMounted) {
        setAccountTypes(data);
      }
    };

    fetchAccountTypes();

    return () => {
      isMounted = false;
    };
  }, []);



  useEffect(() => {
    let isMounted = true;

    const fetchActivities = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "Activity");

      if (error) {
        console.error("Error fetching Activity data:", error);
      } else if (isMounted) {
        setActvity(data); // or setActivity if that’s the correct spelling
      }
    };

    fetchActivities();

    return () => {
      isMounted = false;
    };
  }, []);




  useEffect(() => {
    let isMounted = true;

    const fetchPrincipals = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "Principals");

      if (error) {
        console.error("Error fetching Activity data:", error);
      } else if (isMounted) {
        setPrincipal(data); // or setActivity if that’s the correct spelling
      }
    };

    fetchPrincipals();

    return () => {
      isMounted = false;
    };
  }, []);


  const [chargeTo, setChargeTo] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetcChargeTo = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "ChargeTo");

      if (error) {
        console.error("Error fetching AccountTypes:", error);
      } else if (isMounted) {
        setChargeTo(data);
      }
    };

    fetcChargeTo();

    return () => {
      isMounted = false;
    };
  }, []);
  const [promotedSKUs, setPromotedSKUs] = useState([]);
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [tableData, setTableData] = useState([
    { promotedSKU: '' }, // Example row
    // You can dynamically populate this depending on your case
  ]);
  const [skuSearch, setSkuSearch] = useState('');

  const [currentRowIndex, setCurrentRowIndex] = useState(null);

  const handleOpenSkuModal = (index) => {
    setCurrentRowIndex(index);
    setShowSkuModal(true);
  };

  const handleCloseSkuModal = () => {
    setShowSkuModal(false);
    setSkuSearch('');
  };

  const handleSelectSku = (skuName) => {
    const updatedRows = [...promoRows];
    updatedRows[currentRowIndex].promotedSKU = skuName;
    setPromoRows(updatedRows);
    handleCloseSkuModal();
  };

  useEffect(() => {
    let isMounted = true;

    const fetchPromotedSKUs = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("id, name") // only fetch what you need
        .eq("reference_type", "Promoted-SKU/s");

      if (error) {
        console.error("Error fetching Promoted SKUs:", error);
      } else if (isMounted) {
        setPromotedSKUs(data);
      }
    };

    fetchPromotedSKUs();

    return () => {
      isMounted = false;
    };
  }, []);


  const [brands, setBrands] = React.useState({});
  // State to hold filtered brands for selected principal
  const [filteredBrands, setFilteredBrands] = useState([]); // Always an array

  useEffect(() => {
    if (!formData.principal) {
      setFilteredBrands([]);
      return;
    }

    let isMounted = true;

    const fetchBrands = async () => {
      const { data, error } = await supabase
        .from("Branddetails")
        .select("*")
        .eq("parentname", formData.principal); // Match selected principal

      if (error) {
        console.error("Error fetching Branddetails:", error);
        if (isMounted) setFilteredBrands([]);
        return;
      }

      if (isMounted) {
        setFilteredBrands(data || []); // Always an array
      }
    };

    fetchBrands();

    return () => {
      isMounted = false;
    };
  }, [formData.principal]);

  const [Costdetails, setCostdetails] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchAccountTypes = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "CostDetail");

      if (error) {
        console.error("Error fetching AccountTypes:", error);
      } else if (isMounted) {
        setCostdetails(data);
      }
    };

    fetchAccountTypes();

    return () => {
      isMounted = false;
    };
  }, []);
  // When principal changes, filter brands
  const [amountBadget, setAmountBadget] = useState(null);

  useEffect(() => {
    const fetchAmount = async () => {
      if (!formData.coverVisaCode) {
        setAmountBadget(null);
        return;
      }

      const { data, error } = await supabase
        .from('amount_badget')
        .select('remainingbalance')
        .eq('visacode', formData.coverVisaCode)
        .single();

      if (error) {
        console.error('Supabase error:', error.message);
        setAmountBadget(null);
      } else {
        console.log('Fetched remainingbalance:', data?.remainingbalance);
        setAmountBadget(data?.remainingbalance ?? null);
      }
    };

    fetchAmount();
  }, [formData.coverVisaCode]);
  const remaining = (amountBadget ?? 0) - totalCostSum;

  const [coverVisasWithStatus, setCoverVisasWithStatus] = React.useState([]);
  const [selectedBalance, setSelectedBalance] = React.useState(null);

  React.useEffect(() => {
    async function fetchApprovalStatus() {
      try {
        const visaCodes = coverVisas.map(cv => cv.coverVisaCode);

        const { data, error } = await supabase
          .from('amount_badget')
          .select('visacode, Approved, remainingbalance')  // <-- exact field name here
          .in('visacode', visaCodes);

        if (error) {
          console.error('Error fetching amount_badget data:', error);
          return;
        }

        const approvalMap = {};
        data.forEach(item => {
          approvalMap[item.visacode] = {
            Approved: item.Approved,
            remainingBalance: item.remainingbalance,  // note camelCase mapping
          };
        });

        const merged = coverVisas.map(cv => ({
          ...cv,
          Approved: approvalMap[cv.coverVisaCode]?.Approved ?? null,
          remainingBalance: approvalMap[cv.coverVisaCode]?.remainingBalance ?? null,
        }));

        setCoverVisasWithStatus(merged);
      } catch (err) {
        console.error('Failed to fetch or merge approval status:', err);
      }
    }

    fetchApprovalStatus();
  }, [coverVisas]);
  // runs whenever coverVisas changes
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleBrandSelect = (brand) => {
    setFormData(prev => ({ ...prev, brand }));
    setShowModal(false);
  };

  const handleInputClick = () => {
    if (formData.principal) {
      setShowModal(true);
    }
  };

  const filteredList = filteredBrands.filter(brand =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const [showAccountSearchModal, setShowAccountSearchModal] = useState(false);
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [showSupportTypeModal, setShowSupportTypeModal] = useState(false);
  const [supportSearch, setSupportSearch] = useState('');
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverVisaSearch, setCoverVisaSearch] = useState('');
  const [showModalst, setShowModalst] = useState(false);
  const [visaList, setVisaList] = useState([]);
  const [searchTerms, setSearchTerms] = useState('');

  useEffect(() => {
    if (showModalst) {
      fetchVisaCodes();
    }
  }, [showModalst]);

  const fetchVisaCodes = async () => {
    const { data, error } = await supabase
      .from('Regular_Visa')
      .select('visaCode')
      .order('visaCode', { ascending: true });

    if (error) {
      console.error('Failed to fetch visa codes:', error.message);
    } else {
      setVisaList(data);
    }
  };

  const handleSelectVisas = (code) => {
    setFormData({ ...formData, RegularPwpCode: code });
    setShowModalst(false);
  };
  // Render steps content
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          // ...inside the Step 0 case in renderStepContent function:

          <div >
            <form onSubmit={handleSubmits}>

              <div style={{ padding: '30px', overflowX: 'auto' }} className="containers">
                <div className="row align-items-center mb-4">

                  <div className="col-12 col-md-6">
                    <div
                      className="card p-4 animate-fade-slide-up shadow-sm"
                      style={{
                        background: 'linear-gradient(135deg,rgba(12, 39, 128, 1), #004d74ff)', // gentle blue gradient
                        borderRadius: '12px',
                        border: '1px solid #031f38ff',
                        color: '#ffff',
                        boxShadow: '0 4px 8px rgba(26, 62, 114, 0.15)',
                      }}
                    >
                      <h3
                        className="mb-0"
                        style={{
                          fontWeight: '700',
                          letterSpacing: '2px',
                          textTransform: 'uppercase',
                          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                          textShadow: '1px 1px 2px rgba(0, 58, 139, 0.75)',
                        }}
                      >
                        Upload Regular PWP
                      </h3>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 text-md-end pt-3 pt-md-0">
                    <h2
                      className="fw-bold mb-0"
                      style={{
                        letterSpacing: '1px',
                        fontSize: '24px',
                        marginBottom: '50px',
                        textAlign: 'right',  // <-- added this line
                      }}
                    >
                      {' '}
                      <span className={formData.visaCode ? 'text-danger' : 'text-muted'}>
                        {formData.visaCode || 'N/A'}
                      </span>
                    </h2>
                  </div>



                </div>
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label style={{ transform: 'translateX(-25%)' }}>Regular Code <span style={{color:'red'}}>*</span></label>

                  <div style={{ position: 'relative', transform: 'translateX(-15%)', width: '200px' }}>
                    <input
                      type="text"
                      className="form-control"
                      readOnly
                      value={formData.RegularPwpCode || ''}
                      placeholder="Select Visa Code"
                      style={{
                        paddingRight: '40px',
                        borderColor: '#ccc',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setShowModalst(true)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        color: '#333',
                      }}
                      title="Search Visa Code"
                    >
                      🔍
                    </button>
                  </div>

                  {showModalst && (
                    <div
                      className="modal show fade d-block"
                      tabIndex="-1"
                      role="dialog"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        overflowY: 'auto',
                        paddingTop: '100px',
                      }}
                    >
                      <div
                        className="modal-dialog modal-dialog-centered"
                        role="document"
                        style={{ maxWidth: '500px' }}
                      >
                        <div className="modal-content">
                          <div className="modal-header">
                            <h5 className="modal-title">Select Visa Code</h5>
                            <button
                              type="button"
                              onClick={() => setShowModalst(false)}
                              className="close"
                              style={{ border: 'none', background: 'transparent' }}
                            >
                              &times;
                            </button>
                          </div>
                          <div className="modal-body">
                            <input
                              type="text"
                              className="form-control mb-3"
                              placeholder="Search visa code..."
                              value={searchTerms}
                              onChange={(e) => setSearchTerms(e.target.value)}
                            />

                            <ul className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {visaList
                                .filter((item) =>
                                  item.visaCode.toLowerCase().includes(searchTerms.toLowerCase())
                                )
                                .map((item) => (
                                  <li
                                    key={item.visaCode}
                                    className="list-group-item list-group-item-action"
                                    onClick={() => handleSelectVisas(item.visaCode)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {item.visaCode}
                                  </li>
                                ))}

                              {visaList.length === 0 && (
                                <li className="list-group-item text-muted text-center">
                                  No visa codes found
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div className="row g-3">
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label>Company</label>
                  <div
                    className="form-control"
                    style={{
                      backgroundColor: '#e6e6e6ff',
                      transition: 'border-color 0.3s',
                      paddingRight: '50px', // space for checkmark
                      paddingRight: '30px',
                      borderColor: borderColor,
                    }}
                  >
                    {formData.company || 'MEGASOFT'}
                  </div>

                  <span
                    style={{
                      position: 'absolute',
                      right: '20px',
                      top: '70%',
                      transform: 'translateY(-50%)',
                      color: 'green',
                      fontWeight: 'bold',
                      fontSize: '25px',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    ✓
                  </span>
                </div>


                {/* Principal */}
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label>Distributor</label>

                  <select
                    name="principal"
                    className="form-control"
                    value={formData.principal}
                    onChange={handleFormChange}
                    style={{
                      paddingRight: '30px',
                      borderColor: formData.principal ? 'green' : '',
                      transition: 'border-color 0.3s',
                    }}
                    onMouseEnter={e => {
                      if (formData.principal) e.currentTarget.style.borderColor = 'green';
                    }}
                    onMouseLeave={e => {
                      if (formData.principal) e.currentTarget.style.borderColor = 'green';
                      else e.currentTarget.style.borderColor = '';
                    }}
                  >
                    <option value="">Select Distributor</option>
                    {principal.map((opt, index) => (
                      <option key={index} value={opt.name || opt}>
                        {opt.name || opt}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      position: 'absolute',
                      right: '20px',
                      top: '70%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: '#555',
                      fontSize: '14px',
                      userSelect: 'none',
                    }}
                  >
                    ▼
                  </span>
                  {formData.principal && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '40px',
                        top: '50%',
                        transform: 'translateY(-20%)',
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: '25px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>

                {/* Brand */}
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label>Brand</label>

                  <input
                    type="text"
                    readOnly
                    className="form-control"
                    value={formData.brand || ''}
                    onClick={handleInputClick}
                    placeholder="Select Brand"
                    style={{
                      cursor: formData.principal ? 'pointer' : 'not-allowed',
                      borderColor: formData.brand ? 'green' : '',
                      transition: 'border-color 0.3s',
                      paddingRight: '35px'
                    }}
                  />

                  {/* Magnifying Glass Icon */}
                  <span
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '70%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: '#555',
                      fontSize: '18px',
                      userSelect: 'none',
                    }}
                  >
                    🔍
                  </span>

                  {/* Checkmark if selected */}
                  {formData.brand && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '35px',
                        top: '50%',
                        transform: 'translateY(-20%)',
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: '25px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ✓
                    </span>
                  )}

                  {/* Modal */}
                  <Modal show={showModal} onHide={() => setShowModal(false)} centered>


                    <Modal.Header
                      closeButton
                      style={{
                        background: "rgb(70, 137, 166)",
                        color: "white",
                      }}
                    >
                      <Modal.Title style={{ color: 'white' }} className="w-100 text-center">
                        🧾 Select a Brand
                      </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                      <input
                        type="text"
                        className="form-control mb-3"
                        placeholder="Search brand..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />

                      <ul className="list-group" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredList.length > 0 ? (
                          filteredList.map((brand, idx) => (
                            <li
                              key={idx}
                              className="list-group-item list-group-item-action"
                              onClick={() => handleBrandSelect(brand.name)}
                              style={{ cursor: 'pointer' }}
                            >
                              {brand.name}
                            </li>
                          ))
                        ) : (
                          <li className="list-group-item text-muted">No brands found</li>
                        )}
                      </ul>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={() => setShowModal(false)}>
                        Close
                      </Button>
                    </Modal.Footer>
                  </Modal>
                </div>


                {/* Sales Division */}
                {/* <div className="col-md-4" style={{ position: 'relative', marginTop: '25px' }}>
                                    <label>Sales Division</label>
                                    <select
                                        name="salesDivision"
                                        className="form-control"
                                        value={formData.salesDivision}
                                        onChange={handleFormChange}
                                        onMouseEnter={() => setHovered(true)}
                                        onMouseLeave={() => setHovered(false)}
                                        style={{
                                            paddingRight: '30px',
                                            borderColor: borderColor,
                                            transition: 'border-color 0.3s',
                                        }}
                                    >
                                        <option value="">Select Sales Division</option>
                                        {salesDivisions.map((opt, index) => (
                                            <option key={index} value={opt.name || opt}>
                                                {opt.name || opt}
                                            </option>
                                        ))}

                                    </select>
                                    <span
                                        style={{
                                            position: 'absolute',
                                            right: '20px',
                                            top: '70%',
                                            transform: 'translateY(-50%)',
                                            pointerEvents: 'none',
                                            color: '#555',
                                            fontSize: '14px',
                                            userSelect: 'none',
                                        }}
                                    >
                                        ▼
                                    </span>
                                    {formData.salesDivision && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                right: '40px',
                                                top: '50%',
                                                transform: 'translateY(-20%)',
                                                color: 'green',
                                                fontWeight: 'bold',
                                                fontSize: '25px',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            }}
                                        >
                                            ✓
                                        </span>
                                    )}
                                </div> */}

                {/* Account Type */}
                {/* Account Type */}
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label className="form-label">Account Group</label>
                  <select
                    name="accountType"
                    className="form-control"
                    value={formData.accountType}
                    onChange={handleFormChange}
                    style={{
                      paddingRight: '30px',
                      transition: 'border-color 0.3s',
                    }}
                  >
                    <option value="">Select Account </option>
                    {accountTypes.map(opt => (
                      <option key={opt.name} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                  <span style={{ ...dropdownIconStyle }}>▼</span>
                  {formData.accountType && <span style={{ ...checkIconStyle }}>✓</span>}
                </div>


                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label className="form-label">Account</label>

                  <input
                    type="text"
                    className="form-control"
                    readOnly
                    value={formData.account || ''}
                    onClick={() => {
                      if (formData.accountType) setShowAccountSearchModal(true);
                    }}
                    placeholder="Search Group Account..."
                    style={{
                      paddingRight: '80px',
                      cursor: formData.accountType ? 'pointer' : 'not-allowed',
                      borderColor: formData.account ? 'green' : '',
                      transition: 'border-color 0.3s',
                    }}
                    disabled={!formData.accountType}
                  />

                  {/* Magnifying Glass */}
                  <span
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '70%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: '#555',
                      fontSize: '18px',
                      userSelect: 'none',
                    }}
                  >
                    🔍
                  </span>

                  {/* Checkmark */}
                  {formData.account && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '35px',
                        top: '60%',
                        transform: 'translateY(-20%)',
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: '25px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ✓
                    </span>
                  )}

                  {/* Modal for Account Selection */}
                  <Modal
                    show={showAccountSearchModal}
                    onHide={() => setShowAccountSearchModal(false)}
                    centered
                  >
                    <Modal.Header
                      closeButton
                      style={{
                        background: "rgb(70, 137, 166)",
                        color: "white",
                      }}
                    >
                      <Modal.Title style={{ color: 'white' }} className="w-100 text-center">
                        🧾 Search  Account
                      </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                      <input
                        type="text"
                        className="form-control mb-3"
                        placeholder="Search account..."
                        value={accountSearchTerm}
                        onChange={(e) => setAccountSearchTerm(e.target.value)}
                      />

                      <ul className="list-group" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {groupAccount
                          .filter((opt) =>
                            opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase())
                          )
                          .map((opt, idx) => (
                            <li
                              key={idx}
                              className="list-group-item list-group-item-action"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  account: opt.name,
                                  accountName: opt.name,
                                }));
                                setShowAccountSearchModal(false);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {opt.name}
                            </li>
                          ))}
                        {groupAccount.filter((opt) =>
                          opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase())
                        ).length === 0 && (
                            <li className="list-group-item text-muted">No accounts found</li>
                          )}
                      </ul>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={() => setShowAccountSearchModal(false)}>
                        Close
                      </Button>
                    </Modal.Footer>
                  </Modal>
                </div>




                {/* Activity */}
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label style={{ marginBottom: '8px' }} >Activity</label>
                  <select
                    name="activity"
                    className="form-control"
                    value={formData.activity}
                    onChange={handleFormChange}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    style={{
                      paddingRight: '30px',
                      borderColor: borderColor,
                      transition: 'border-color 0.3s',
                    }}
                  >
                    <option value="">Select Activity</option>
                    {activity.map((opt, index) => (
                      <option key={index} value={opt.name || opt}>
                        {opt.name || opt}
                      </option>
                    ))}

                  </select>
                  <span
                    style={{
                      position: 'absolute',
                      right: '20px',
                      top: '70%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: '#555',
                      fontSize: '14px',
                      userSelect: 'none',
                    }}
                  >
                    ▼
                  </span>
                  {formData.activity && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '40px',
                        top: '55%',
                        transform: 'translateY(-20%)',
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: '25px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div className="col-md-4" style={{ position: "relative" }}>
                  <label >Support Type</label>

                  <input
                    type="text"
                    className="form-control"
                    readOnly
                    value={formData.supportType || ""}
                    placeholder="Select Support Type"
                    onClick={() => setShowSupportTypeModal(true)}
                    style={{
                      paddingRight: "35px",
                      borderColor: formData.supportType ? "green" : borderColor,
                      transition: "border-color 0.3s",
                      cursor: "pointer",
                    }}
                  />

                  {/* Magnifying glass icon */}
                  <span
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#555",
                      fontSize: "18px",
                    }}
                  >
                    🔍
                  </span>

                  {/* Checkmark if selected */}
                  {formData.supportType && (
                    <span
                      style={{
                        position: "absolute",
                        right: "35px",
                        top: "40%",
                        transform: "translateY(-20%)",
                        color: "green",
                        fontWeight: "bold",
                        fontSize: "25px",
                        pointerEvents: "none",
                      }}
                    >
                      ✓
                    </span>
                  )}

                  {/* Support Type Modal */}
                  <Modal
                    show={showSupportTypeModal}
                    onHide={() => setShowSupportTypeModal(false)}
                    centered
                  >
                    <Modal.Header
                      closeButton
                      style={{
                        background: "rgb(70, 137, 166)",
                        color: "white",
                      }}
                    >
                      <Modal.Title style={{ color: 'white' }} className="w-100 text-center">
                        🛠️ Select Support Type
                      </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                      <input
                        type="text"
                        className="form-control mb-3"
                        placeholder="Search support type..."
                        value={supportSearch}
                        onChange={(e) => setSupportSearch(e.target.value)}
                      />

                      <ul className="list-group" style={{ maxHeight: "200px", overflowY: "auto" }}>
                        {supportType
                          .filter((opt) =>
                            opt.name.toLowerCase().includes(supportSearch.toLowerCase())
                          )
                          .map((opt, idx) => (
                            <li
                              key={idx}
                              className="list-group-item list-group-item-action"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  supportType: opt.name,
                                }));
                                setShowSupportTypeModal(false);
                              }}
                              style={{ cursor: "pointer" }}
                            >
                              {opt.name}
                            </li>
                          ))}
                        {supportType.filter((opt) =>
                          opt.name.toLowerCase().includes(supportSearch.toLowerCase())
                        ).length === 0 && (
                            <li className="list-group-item text-muted">No support types found</li>
                          )}
                      </ul>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={() => setShowSupportTypeModal(false)}>
                        Close
                      </Button>
                    </Modal.Footer>
                  </Modal>
                </div>


                {/* Visa Type */}
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label>Marketing Type</label>
                  <select
                    name="visaType"
                    className="form-control"
                    value={formData.visaType}
                    disabled
                    style={{
                      paddingRight: '30px',
                      borderColor: borderColor,
                      transition: 'border-color 0.3s',
                    }}
                  >
                    <option value="REGULAR">REGULAR</option>
                  </select>

                  {formData.visaType && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '20px',
                        top: '40%',
                        transform: 'translateY(-20%)',
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: '25px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>


                {/* Visa Title */}
                {/* <div className="col-md-4" style={{ position: 'relative' }}>
                                    <label>Marketing Title</label>
                                    <input
                                        type="text"
                                        name="visaTitle"
                                        className="form-control"
                                        value={formData.visaTitle}
                                        onChange={handleFormChange}
                                        style={{
                                            paddingRight: '30px',
                                            borderColor: formData.visaTitle ? 'green' : '',
                                            transition: 'border-color 0.3s',
                                        }}
                                        onMouseEnter={e => {
                                            if (formData.visaTitle) e.currentTarget.style.borderColor = 'green';
                                        }}
                                        onMouseLeave={e => {
                                            if (formData.visaTitle) e.currentTarget.style.borderColor = 'green';
                                            else e.currentTarget.style.borderColor = '';
                                        }}
                                    />
                                    {formData.visaTitle && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                right: '20px',
                                                top: '50%',
                                                transform: 'translateY(-20%)',
                                                color: 'green',
                                                fontWeight: 'bold',
                                                fontSize: '25px',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            }}
                                        >
                                            ✓
                                        </span>
                                    )}
                                </div> */}

                {/* Objective (textarea) */}
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label>Objective</label>
                  <textarea
                    name="objective"
                    className="form-control"
                    value={formData.objective}
                    onChange={handleFormChange}
                    style={{
                      paddingRight: '30px',
                      borderColor: formData.objective ? 'green' : '',
                      transition: 'border-color 0.3s',
                      resize: 'vertical',
                    }}
                    onMouseEnter={e => {
                      if (formData.objective) e.currentTarget.style.borderColor = 'green';
                    }}
                    onMouseLeave={e => {
                      if (formData.objective) e.currentTarget.style.borderColor = 'green';
                      else e.currentTarget.style.borderColor = '';
                    }}
                  />
                  {formData.objective && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '20px',
                        top: '50%',
                        transform: 'translateY(-20%)',
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: '25px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>

                {/* Promo Scheme (textarea) */}
                <div className="col-md-4" style={{ position: 'relative' }}>
                  <label>Promo Scheme</label>
                  <textarea
                    type="text"
                    name="promoScheme"
                    className="form-control"
                    value={formData.promoScheme}
                    onChange={handleFormChange}
                    style={{
                      paddingRight: '30px',
                      borderColor: formData.promoScheme ? 'green' : '',
                      transition: 'border-color 0.3s',
                      resize: 'vertical',
                    }}
                    onMouseEnter={e => {
                      if (formData.promoScheme) e.currentTarget.style.borderColor = 'green';
                    }}
                    onMouseLeave={e => {
                      if (formData.promoScheme) e.currentTarget.style.borderColor = 'green';
                      else e.currentTarget.style.borderColor = '';
                    }}
                  />
                  {formData.promoScheme && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '20px',
                        top: '50%',
                        transform: 'translateY(-20%)',
                        color: 'green',
                        fontWeight: 'bold',
                        fontSize: '25px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              </div>

              <div className="card mt-4 shadow-sm">
                <style>{`
                                    .card-header {
                                    background: linear-gradient(135deg,rgb(11, 48, 168),rgb(255, 255, 255));
                                    color: white;
                                    font-weight: 700;
                                    padding: 1rem 1.5rem;
                                    border-radius: 0.75rem 0.75rem 0 0;
                                    
                                    }
                                    .card-header h3 {
                                    margin-bottom: 0;
                                    }   
                                `}</style>

                <div className="card-header">
                  <h3 className="mb-0">Timeline</h3>
                </div>

                <div className="card-body">
                  <div className="row g-3">

                    {/* <div className="col-md-3" style={{ position: 'relative' }}>
                                            <label htmlFor="leadTimeFrom" className="form-label">Lead Time From</label>
                                            <input
                                                type="date"
                                                id="leadTimeFrom"
                                                name="leadTimeFrom"
                                                className="form-control"
                                                value={formData.leadTimeFrom}
                                                onChange={handleFormChange}
                                                style={{ paddingRight: '35px' }} // add right padding so icon doesn’t overlap text
                                            />
                                            {formData.leadTimeFrom && (
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        right: '20px',
                                                        top: '50%',
                                                        transform: 'translateY(-20%)',
                                                        color: 'green',
                                                        fontWeight: 'bold',
                                                        fontSize: '25px',
                                                        pointerEvents: 'none',
                                                        userSelect: 'none',
                                                    }}
                                                >
                                                    ✓
                                                </span>
                                            )}
                                        </div> */}

                    {/* Lead Time To */}
                    {/* <div className="col-md-3" style={{ position: 'relative' }}>
                                            <label htmlFor="leadTimeTo" className="form-label">Lead Time To</label>
                                            <input
                                                type="date"
                                                id="leadTimeTo"
                                                name="leadTimeTo"
                                                className="form-control"
                                                value={formData.leadTimeTo}
                                                onChange={handleFormChange}
                                                style={{ paddingRight: '35px' }}
                                            />
                                            {formData.leadTimeTo && (
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        right: '20px',
                                                        top: '50%',
                                                        transform: 'translateY(-20%)',
                                                        color: 'green',
                                                        fontWeight: 'bold',
                                                        fontSize: '25px',
                                                        pointerEvents: 'none',
                                                        userSelect: 'none',
                                                    }}
                                                >
                                                    ✓
                                                </span>
                                            )}
                                        </div> */}

                    {/* Activity Duration From */}
                    <div className="col-md-3" style={{ position: 'relative' }}>
                      <label htmlFor="activityDurationFrom" className="form-label">Activity Duration From</label>
                      <input
                        type="date"
                        id="activityDurationFrom"
                        name="activityDurationFrom"
                        className="form-control"
                        value={formData.activityDurationFrom}
                        onChange={handleFormChange}
                        style={{ paddingRight: '35px' }}
                      />
                      {formData.activityDurationFrom && (
                        <span
                          style={{
                            position: 'absolute',
                            right: '20px',
                            top: '50%',
                            transform: 'translateY(-20%)',
                            color: 'green',
                            fontWeight: 'bold',
                            fontSize: '25px',
                            pointerEvents: 'none',
                            userSelect: 'none',
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    {/* Activity Duration To */}
                    <div className="col-md-3" style={{ position: 'relative' }}>
                      <label htmlFor="activityDurationTo" className="form-label">Activity Duration To</label>
                      <input
                        type="date"
                        id="activityDurationTo"
                        name="activityDurationTo"
                        className="form-control"
                        value={formData.activityDurationTo}
                        onChange={handleFormChange}
                        style={{ paddingRight: '35px' }}
                      />
                      {formData.activityDurationTo && (
                        <span
                          style={{
                            position: 'absolute',
                            right: '20px',
                            top: '50%',
                            transform: 'translateY(-20%)',
                            color: 'green',
                            fontWeight: 'bold',
                            fontSize: '25px',
                            pointerEvents: 'none',
                            userSelect: 'none',
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              </div>


              <style>{`
                                .card-3d {
                                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                                    cursor: pointer;
                                    will-change: transform;
                                    border-radius: 0.75rem;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                    padding: 1rem 1.5rem; /* add consistent padding */
                                }

                                .card-3d .card-header {
                                    background: 'linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)', // gentle blue gradient
                                    color: white;
                                    font-weight: 700;
                                    font-size: 1.25rem;
                                    border-radius: 0.75rem 0.75rem 0 0;
                                    padding: 1rem 1.5rem;
                                    margin: -1rem -1.5rem 1rem; /* offset to align with card padding */
                                }

                                .toggle-group {
                                    display: flex;
                                    gap: 1rem;
                                }

                                .toggle-checkbox {
                                    display: none;
                                }

                                .toggle-label {
                                    padding: 0.5rem 1.25rem;
                                    border-radius: 50px;
                                    border: 2px solid #007bff;
                                    color: #007bff;
                                    font-weight: 600;
                                    cursor: pointer;
                                    user-select: none;
                                    transition: all 0.25s ease;
                                    box-shadow: 0 0 8px transparent;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    min-width: 70px; /* consistent button width */
                                    text-align: center;
                                }

                                .toggle-checkbox:checked + .toggle-label {
                                    background-color: #007bff;
                                    color: white;
                                    box-shadow: 0 0 12px #007bff;
                                }

                                .toggle-label:hover {
                                    background-color: #e6f0ff;
                                }

                                /* Fix input field container for better alignment */
                                .cover-visa-code-container {
                                    margin-top: 1rem;
                                    max-width: 320px;
                                }

                                .cover-visa-code-container label {
                                    font-weight: 600;
                                }
                                `}</style>

              <div className="card card-3d mt-4">
                <div className="card-header">IS PART OF COVER PWP?</div>

                <div className="toggle-group mb-3" role="group" aria-label="Cover Visa Toggle">
                  <input
                    type="radio"
                    id="coverYes"
                    name="isPartOfCoverVisa"
                    className="toggle-checkbox"
                    checked={formData.isPartOfCoverVisa === true}
                    onChange={() => {
                      handleToggleChange(true);
                      setShowCoverVisaCode(false);
                      setFormData(prev => ({ ...prev, coverVisaCode: '' }));
                    }}
                  />
                  <label htmlFor="coverYes" className="toggle-label">YES</label>

                  <input
                    type="radio"
                    id="coverNo"
                    name="isPartOfCoverVisa"
                    className="toggle-checkbox"
                    checked={formData.isPartOfCoverVisa === false}
                    onChange={() => {
                      handleToggleChange(false);
                      setShowCoverVisaCode(false);
                      setFormData(prev => ({ ...prev, coverVisaCode: '' }));
                    }}
                  />
                  <label htmlFor="coverNo" className="toggle-label">NO</label>
                </div>

                {formData.isPartOfCoverVisa && !showCoverVisaCode && (
                  <div className="form-group">
                    <label htmlFor="coverStep" className="form-label text-uppercase">Select Cover Option</label>
                    <select
                      id="coverStep"
                      className="form-control"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value === "continue") setShowCoverVisaCode(true);
                      }}
                    >
                      <option value="">-- Select to Continue --</option>
                      <option value="continue">Yes, Show COVER PWP CODE</option>
                    </select>
                  </div>
                )}

                {formData.isPartOfCoverVisa && showCoverVisaCode && (
                  <div className="form-group mt-3" style={{ position: 'relative' }}>
                    <label className="form-label text-uppercase">Cover PWP Code</label>
                    <input
                      type="text"
                      readOnly
                      className="form-control"
                      value={formData.coverVisaCode || ''}
                      placeholder="Select Cover Visa Code"
                      onClick={() => setShowCoverModal(true)}
                      style={{
                        cursor: 'pointer',
                        paddingRight: '40px',
                        borderColor: formData.coverVisaCode ? 'green' : '',
                        transition: 'border-color 0.3s',
                      }}
                    />
                    {/* Checkmark */}
                    {formData.coverVisaCode && (
                      <span
                        style={{
                          position: 'absolute',
                          right: '40px',
                          top: '38px',
                          color: 'green',
                          fontWeight: 'bold',
                          fontSize: '25px',
                          pointerEvents: 'none',
                        }}
                      >
                        ✓
                      </span>
                    )}
                    {/* Magnifying glass */}
                    <span
                      style={{
                        position: 'absolute',
                        right: '15px',
                        top: '40px',
                        color: '#555',
                        fontSize: '16px',
                        pointerEvents: 'none',
                      }}
                    >
                      🔍
                    </span>
                  </div>
                )}

                {/* Cover Visa Modal */}
                <Modal show={showCoverModal} onHide={() => setShowCoverModal(false)} centered>
                  <Modal.Header
                    closeButton
                    style={{ background: 'linear-gradient(to right, #0d6efd, #6610f2)', color: 'white' }}
                  >
                    <Modal.Title style={{ color: 'white' }} className="w-100 text-center">🎫 Select COVER PWP Code</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder="Search PWP code..."
                      value={coverVisaSearch}
                      onChange={(e) => setCoverVisaSearch(e.target.value)}
                    />

                    <ul className="list-group" style={{ maxHeight: "250px", overflowY: "auto" }}>
                      {coverVisasWithStatus
                        .filter(cv =>
                          cv.coverVisaCode.toLowerCase().includes(coverVisaSearch.toLowerCase())
                        )
                        .map((cv, idx) => {
                          const isPending = !cv.Approved;

                          return (
                            <li
                              key={idx}
                              onClick={() => {
                                if (isPending) return;
                                setFormData(prev => ({
                                  ...prev,
                                  coverVisaCode: cv.coverVisaCode,
                                }));
                                setSelectedBalance(cv.remainingBalance);
                                setShowCoverModal(false);
                              }}
                              className={`list-group-item d-flex justify-content-between align-items-center ${isPending ? 'disabled' : 'list-group-item-action'}`}
                              title={isPending ? 'Pending: Not Approved' : ''}
                              style={{
                                backgroundColor: isPending ? 'yellow' : 'inherit',
                                color: isPending ? '#555' : 'inherit',
                                cursor: isPending ? 'not-allowed' : 'pointer',
                                fontFamily: 'monospace',
                                opacity: isPending ? 0.8 : 1,
                              }}
                            >
                              {cv.coverVisaCode.toUpperCase().padEnd(20)}{" "}
                              <span className="badge bg-secondary">
                                {cv.remainingBalance !== null
                                  ? cv.remainingBalance.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                  : "-"}
                              </span>
                            </li>
                          );
                        })}

                      {coverVisasWithStatus.filter(cv =>
                        cv.coverVisaCode.toLowerCase().includes(coverVisaSearch.toLowerCase())
                      ).length === 0 && (
                          <li className="list-group-item text-muted">No codes found</li>
                        )}
                    </ul>
                  </Modal.Body>

                  <Modal.Footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid yellow',
                        borderRadius: '6px',
                        padding: '8px',
                        marginRight: '8px',
                        width: '40px',
                        height: '40px',
                        boxSizing: 'border-box',
                        backgroundColor: '#222'
                      }}>
                        <FaExclamationTriangle style={{ color: 'yellow', fontSize: '24px' }} />
                      </div>
                      <span style={{ fontWeight: 'bold' }}>Yellow-Pending</span>
                    </div>

                    <Button variant="secondary" onClick={() => setShowCoverModal(false)}>
                      Close
                    </Button>
                  </Modal.Footer>

                </Modal>
              </div>






              <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-primary mt-3"
                  onClick={() => setStep(1)}
                  style={{ width: '85px' }}
                >
                  Next
                </button>

              </div>
            </form>
          </div >

        );

      case 1:
        // Promoted sales table
        return (
          <div>


            <h3 style={{ marginBottom: '1rem' }}>Volume Plan | Cost Implication</h3>
            {formData.isPartOfCoverVisa &&
              showCoverVisaCode &&
              formData.coverVisaCode &&
              amountBadget !== null && (
                <>
                  <style>
                    {`
          @media (max-width: 600px) {
            .card-body {
              flex-direction: column !important;
              align-items: flex-start !important;
              padding: 1rem !important;
            }

            .card-body > div:first-child {
              font-size: 1rem !important;
              margin-bottom: 1rem;
            }

            .card-body > div:last-child h3 {
              font-size: 1.5rem !important;
              white-space: normal !important;
              margin-bottom: 0.5rem;
            }

            .card-body > div:last-child > div {
              min-width: 100% !important;
              box-sizing: border-box;
            }
          }
        `}
                  </style>

                  <div
                    className="card"
                    style={{
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      marginTop: '1rem',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      className="card-header"
                      style={{
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        backgroundColor: '#f8f9fa',
                        padding: '1rem 1.5rem',
                        fontSize: '1rem',
                        borderBottom: '1px solid #dee2e6',
                      }}
                    >
                      Amount Badget Remaining
                    </div>

                    <div
                      className="card-body"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1.5rem 2rem',
                        backgroundColor: '#fff',
                      }}
                    >
                      {/* Left side */}
                      <div style={{ fontSize: '1.2rem', color: '#333' }}>
                        COVER PWP Code:{' '}
                        <strong style={{ textTransform: 'uppercase' }}>
                          {formData.coverVisaCode}
                        </strong>
                      </div>

                      {/* Right side */}
                      <div>
                        <h3
                          style={{
                            color: '#28a745',
                            fontSize: '2rem',
                            margin: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {Number(amountBadget).toLocaleString('en-PH', {
                            style: 'currency',
                            currency: 'PHP',
                          })}
                        </h3>

                        <div
                          style={{
                            marginTop: '1rem',
                            padding: '0.75rem 1rem',
                            backgroundColor: '#f8f9fa',
                            border: `2px solid ${remaining < 0 ? '#dc3545' : '#28a745'}`,
                            borderRadius: '8px',
                            display: 'inline-block',
                            minWidth: '220px',
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              color: remaining < 0 ? '#dc3545' : '#28a745',
                              fontWeight: 'bold',
                              fontSize: '1.2rem',
                              textAlign: 'center',
                            }}
                          >
                            Remaining:{' '}
                            {(remaining < 0 ? '-' : '') +
                              Math.abs(remaining).toLocaleString('en-PH', {
                                style: 'currency',
                                currency: 'PHP',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}


            <div
              className="table-responsive"

            >
              <table style={{
                marginTop: '1rem',
                maxWidth: '100%',      // or set e.g. '800px' for fixed width
                overflowX: 'auto',    // enables horizontal scroll if needed
                whiteSpace: 'nowrap', // keeps table cells in one line to prevent wrapping
              }} className="table table-bordered">
                <thead style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', border: '2px solid #add8e6' }}>
                  <tr>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }} >Promoted, SKU/s</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>List Price</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>Non-Promo Average Sales</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>U M</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }} >Non-Promo Average Sales Amount</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }} >Projected Average Sales</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }} >Projected Average Sales Amount</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }} >Increase %</th>

                    <th></th> {/* For delete icon */}
                  </tr>
                </thead>

                <tbody>
                  {promoRows.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            className="form-control"
                            value={row.promotedSKU || ""}
                            placeholder="Select SKU"
                            style={{ width: '150px' }}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary ml-2"
                            onClick={() => handleOpenSkuModal(i)}
                            title="Select SKU"
                          >
                            🔍
                          </button>
                        </div>
                      </td>
                      {showSkuModal && (
                        <div
                          className="modal show fade d-block"
                          tabIndex="-1"
                          role="dialog"
                          style={{
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            overflowY: "auto",
                            paddingTop: "100px",
                            paddingBottom: "100px",
                          }}
                        >
                          <div
                            className="modal-dialog modal-lg modal-dialog-centered"
                            role="document"
                            style={{ maxWidth: "600px" }}
                          >
                            <div className="modal-content shadow-lg rounded">
                              <div className="modal-header border-bottom-0 d-flex justify-content-between align-items-center">
                                <h5
                                  className="modal-title font-weight-bold"
                                  style={{
                                    background: "rgb(70, 137, 166)",
                                    color: "white",
                                    fontWeight: '700',
                                    fontSize: '1.4rem',
                                    marginBottom: '1.25rem',
                                    padding: '10px',
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                    borderBottom: '3px solid #4689A6', // match border to the same tone
                                    paddingBottom: '0.4rem',
                                    boxShadow: '0 3px 6px rgba(70, 137, 166, 0.3)', // updated to match background
                                  }}
                                >
                                  Select Promoted SKU
                                </h5>

                                <button
                                  type="button"
                                  onClick={handleCloseSkuModal}
                                  aria-label="Close"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '1.8rem',
                                    fontWeight: 'bold',
                                    color: '#555',
                                    cursor: 'pointer',
                                    padding: '0',
                                    lineHeight: '1',
                                    transition: 'color 0.3s ease',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.color = '#e74c3c')} // red on hover
                                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                                >
                                  ×
                                </button>

                              </div>

                              <div className="modal-body">
                                <input
                                  type="text"
                                  className="form-control mb-4"
                                  placeholder="Search SKU..."
                                  value={skuSearch}
                                  onChange={(e) => setSkuSearch(e.target.value)}
                                  style={{ fontSize: "1.1rem", padding: "12px 15px" }}
                                />
                                <ul
                                  className="list-group"
                                  style={{ maxHeight: "350px", overflowY: "auto", cursor: "pointer" }}
                                >
                                  {promotedSKUs.length === 0 && (
                                    <li className="list-group-item text-center text-muted">
                                      No SKUs found
                                    </li>
                                  )}
                                  {promotedSKUs
                                    .filter((sku) =>
                                      sku.name.toLowerCase().includes(skuSearch.toLowerCase())
                                    )
                                    .map((sku) => (
                                      <li
                                        key={sku.id}
                                        className="list-group-item list-group-item-action"
                                        onClick={() => handleSelectSku(sku.name)}
                                        style={{ fontSize: "1rem" }}
                                      >
                                        {sku.name}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}


                      <td style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>PHP</span>
                        <input
                          type="number"

                          name="listPrice"
                          min="0"
                          step="0.01"
                          className="form-control"
                          value={row.listPrice}
                          onChange={(e) => handlePromoChange(i, e)}
                          style={{ textAlign: 'left', width: '150px' }}
                        />
                      </td>


                      <td>
                        <input
                          type="number"
                          name="nonPromoAvgSales"
                          min="0"
                          step="0.01"
                          className="form-control"
                          value={row.nonPromoAvgSales}
                          onChange={(e) => handlePromoChange(i, e)}
                        />
                      </td>
                      <td style={{ position: 'relative' }}>
                        <select
                          style={{
                            width: '100px',
                            paddingRight: '25px',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                          }}
                          name="UM"
                          className="form-control"
                          value={row.UM}
                          onChange={(e) => handlePromoChange(i, e)}
                        >
                          <option value="Cases">Cases</option>
                          <option value="Ibx">Ibx</option>
                          <option value="pc">pc</option>
                        </select>

                        <span
                          style={{
                            position: 'absolute',
                            right: '20px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                            color: '#555',
                            fontSize: '14px',
                            userSelect: 'none',
                          }}
                        >
                          ▼
                        </span>
                      </td>

                      <td style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>PHP</span>
                        <input
                          type="number"
                          name="nonPromoAvgSalesAmount"
                          min="0"
                          step="0.01"
                          className="form-control"
                          value={row.nonPromoAvgSalesAmount}
                          onChange={(e) => handlePromoChange(i, e)}

                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          name="projectedAvgSales"
                          min="0"
                          step="0.01"
                          className="form-control"
                          value={row.projectedAvgSales}
                          onChange={(e) => handlePromoChange(i, e)}
                        />
                      </td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>PHP</span>
                        <input
                          type="number"
                          name="projectedAvgSalesAmount"
                          min="0"
                          step="0.01"
                          className="form-control"
                          value={row.projectedAvgSalesAmount}
                          onChange={(e) => handlePromoChange(i, e)}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          name="increasePercent"
                          min="0"
                          max="100"
                          step="0.01"
                          className="form-control"
                          value={row.increasePercent}
                          onChange={(e) => handlePromoChange(i, e)}
                        />
                      </td>

                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-link text-danger"
                          onClick={() => handleDeletePromoRow(i)}
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fw-bold">
                    <td className="text-end">Total:</td>
                    <td>
                      {formatCurrency(
                        promoRows.reduce(
                          (sum, row) => sum + parseFloat(row.listPrice || 0),
                          0
                        )
                      )}
                    </td>
                    <td>
                      {promoRows
                        .reduce(
                          (sum, row) => sum + parseFloat(row.nonPromoAvgSales || 0),
                          0
                        )
                        .toFixed(2)}
                    </td>
                    <td></td>
                    <td>
                      {formatCurrency(
                        promoRows.reduce(
                          (sum, row) =>
                            sum + parseFloat(row.nonPromoAvgSalesAmount || 0),
                          0
                        )
                      )}
                    </td>
                    <td>
                      {promoRows
                        .reduce(
                          (sum, row) => sum + parseFloat(row.projectedAvgSales || 0),
                          0
                        )
                        .toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                    </td>
                    <td>
                      {formatCurrency(
                        promoRows.reduce(
                          (sum, row) =>
                            sum + parseFloat(row.projectedAvgSalesAmount || 0),
                          0
                        )
                      )}
                    </td>

                    {/* ✅ Total Average Increase % across all rows */}
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        readOnly
                        value={
                          promoRows.filter(
                            (row) => parseFloat(row.projectedAvgSalesAmount || 0) !== 0
                          ).length > 0
                            ? (
                              promoRows.reduce((sum, row) => {
                                const nonPromo = parseFloat(row.nonPromoAvgSalesAmount || 0);
                                const projected = parseFloat(row.projectedAvgSalesAmount || 0);
                                if (projected === 0) return sum;
                                return sum + (nonPromo / projected) * 100;
                              }, 0) /
                              promoRows.filter(
                                (row) => parseFloat(row.projectedAvgSalesAmount || 0) !== 0
                              ).length
                            ).toFixed(2) + '%'
                            : '0.00%'
                        }
                      />
                    </td>


                    <td></td>
                  </tr>
                </tfoot>


              </table>



            </div>
            <button
              type="button"
              className="btn btn-secondary me-2"
              onClick={addPromoRow}
            >
              Add Row
            </button>

            <div className="table-responsive" style={{ marginTop: '50px' }}>
              <table className="table table-bordered table-striped table-hover">
                <thead className="table-success">
                  <tr>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>Cost Details</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>Quantity</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>Unit Cost</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>Discount %</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>Total Cost</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}>ChargeTo</th>
                    <th style={{ backgroundColor: 'rgba(173, 216, 230, 0.2)', color: '#ffff', border: '2px solid #add8e6' }}></th> {/* Delete icon column */}
                  </tr>
                </thead>
                <tbody>
                  {costRows.map((row, i) => {
                    const quantity = parseFloat(row.quantity) || 0;
                    const unitCost = parseFloat(row.unitCost) || 0;
                    const discount = parseFloat(row.discount) || 0;
                    const rowTotalCost = quantity * unitCost * (1 - discount / 100);

                    return (
                      <tr key={i}>
                        <select
                          name="costDetails"
                          className="form-control"
                          value={row.costDetails || ''}
                          onChange={(e) => handleCostChange(i, e)}
                          style={{
                            appearance: "none",
                            WebkitAppearance: "none",
                            MozAppearance: "none",
                            paddingRight: "30px"
                          }}
                        >
                          <option value="">-- Select Cost Detail --</option>
                          {Costdetails.map((item, index) => (
                            <option key={index} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <td>
                          <input
                            type="number"
                            min="0"
                            name="quantity"
                            className="form-control"
                            value={row.quantity}
                            onChange={(e) => handleCostChange(i, e)}
                          />
                        </td>

                        <td style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>

                          <span style={{ whiteSpace: 'nowrap' }}>PHP</span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            name="unitCost"
                            className="form-control"
                            value={row.unitCost}
                            onChange={(e) => handleCostChange(i, e)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            name="discount"
                            className="form-control"
                            value={row.discount}
                            onChange={(e) => handleCostChange(i, e)}
                          />
                        </td>
                        <td style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>PHP</span>

                          <input
                            type="text"
                            className="form-control"
                            value={`PHP ${rowTotalCost.toFixed(2)}`}
                            disabled
                          />
                        </td>
                        <td style={{ position: 'relative' }}>
                          <select
                            name="chargeTo"
                            className="form-control"
                            value={formData.chargeTo}
                            onChange={handleFormChange}
                            style={{
                              paddingRight: '30px',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                            }}
                          >
                            <option value="">Select Visa Type</option>
                            {chargeTo.map((opt, index) => (
                              <option key={index} value={opt.name || opt}>
                                {opt.name || opt}
                              </option>
                            ))}
                          </select>

                          {/* Custom Arrow */}
                          <span
                            style={{
                              position: 'absolute',
                              right: '20px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              pointerEvents: 'none',
                              color: '#555',
                              fontSize: '14px',
                              userSelect: 'none',
                            }}
                          >
                            ▼
                          </span>
                        </td>

                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-link text-danger"
                            onClick={() => handleDeleteRow(i)}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="fw-bold">
                    <td>Total:</td>
                    <td>{totalQuantity}</td>
                    <td></td>
                    <td></td>
                    <td>PHP {totalCostSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>Cost to Sales: {costToSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                    <td></td>
                  </tr>
                </tfoot>
              </table>

              {/* Add Button (icon only) */}
              <div className="mt-2 text-end">
                <button
                  type="button"
                  className="btn btn-link text-success"
                  onClick={handleAddRow}
                >
                  <i className="fas fa-plus-circle fa-lg"></i>
                </button>
              </div>
            </div>


            <button type="button" className="btn btn-secondary me-2" onClick={addCostRow}>
              Add Row
            </button>
            <div className="mb-3">
              <label className="form-label">Remarks</label>
              <textarea
                name="remarks"
                className="form-control"
                value={formData.remarks}
                onChange={handleFormChange}
                rows={4}
              />
            </div>
            <div className="d-flex justify-content-between">
              <button className="btn btn-outline-secondary" onClick={handlePrevious}>
                ← Previous
              </button>                            <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-primary mt-3"
                  onClick={() => setStep(2)}
                  style={{ width: '85px' }}
                >
                  Next
                </button>

              </div>                    </div>
          </div>


        );

      case 2:
        // Cost Details table
        return (
          <div className="card shadow-sm p-4">
            <div className="col-12 col-md-6">
              <div
                className="card p-4 animate-fade-slide-up shadow-sm"
                style={{
                  background: 'linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)', // gentle blue gradient
                  borderRadius: '12px',
                  border: '1px solid #99cfff',
                  color: '#ffff',
                  boxShadow: '0 4px 8px rgba(26, 62, 114, 0.15)',
                }}
              >
                <h3
                  className="mb-0"
                  style={{
                    fontWeight: '700',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                    textShadow: '1px 1px 2px rgba(26, 62, 114, 0.3)',
                  }}
                >
                  Regular PWP
                </h3>
              </div>
            </div>
            <h4 className="mb-3">Your Approval </h4>

            <div className="table-responsive">
              {loading ? (
                <p>Loading approvals...</p>
              ) : (
                <table className="table table-bordered table-striped table-hover">
                  <thead className="table-success">
                    <tr>
                      <th>Approver</th>
                      <th>Position</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Date Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedData.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center">
                          No data found.
                        </td>
                      </tr>
                    ) : (
                      combinedData.map(({ id, approver, position, status, type, created_at }) => (
                        <tr key={id}>
                          <td>{approver}</td>
                          <td>{position || '-'}</td>
                          <td>
                            {status ? (
                              <span
                                className={`badge ${status === 'Allowed' ? 'bg-success' : 'bg-warning text-dark'
                                  }`}
                              >
                                {status}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{type || '-'}</td>
                          <td>{created_at ? new Date(created_at).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}


              <h4 className="mt-4">Attachments</h4>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current.click()}
                className="border border-primary rounded p-4 mb-3"
                style={{
                  cursor: 'pointer',
                  minHeight: '150px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  alignItems: 'center',
                  justifyContent: files.length === 0 ? 'center' : 'flex-start',
                  backgroundColor: '#f8f9fa',
                  position: 'relative',
                  transition: 'background-color 0.3s',
                }}
              >
                {files.length === 0 && <p className="text-muted">Drag & Drop files here or click to upload</p>}

                {files.map((file, index) => (
                  <div
                    key={index}
                    className="position-relative"
                    style={{
                      width: '100px',
                      height: '100px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      textAlign: 'center',
                      padding: '5px',
                      backgroundColor: 'white',
                      boxShadow: '0 0 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ fontSize: '12px', wordWrap: 'break-word', marginTop: '30px' }}>
                        <i className="bi bi-file-earmark" style={{ fontSize: '28px', color: '#0d6efd' }}></i>
                        <div>{file.name.length > 15 ? file.name.slice(0, 15) + '...' : file.name}</div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="btn btn-sm btn-danger position-absolute top-0 end-0"
                      style={{ borderRadius: '0 0 0 6px' }}
                      title="Remove file"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div >

            <div className="mt-4 d-flex justify-content-between">
              <button className="btn btn-outline-secondary" onClick={handlePrevious}>
                ← Previous
              </button>

              <button className="btn btn-success" onClick={handleSubmit}>
                Submit To Approvers
              </button>                    </div>
          </div >

        );

      case 3:
        // File upload step
        return (
          <div>
            <h3>Upload File</h3>
            <input type="file" className="form-control" />
            <br />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => alert("Submit your data here")}
            >
              Submit
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return <div style={{ padding: '30px', overflowX: 'auto' }} className="containes">{renderStepContent()}</div>;
};
const dropdownIconStyle = {
  position: 'absolute',
  right: '20px',
  top: '70%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: '#555',
  fontSize: '14px',
  userSelect: 'none',
};

const checkIconStyle = {
  position: 'absolute',
  right: '40px',
  top: '50%',
  transform: 'translateY(-20%)',
  color: 'green',
  fontWeight: 'bold',
  fontSize: '25px',
  pointerEvents: 'none',
  userSelect: 'none',
};

export default RegularPwpUploadForm;
