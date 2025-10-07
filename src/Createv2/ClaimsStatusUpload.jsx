import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

import './ClaimsStatusUpload.css';


const ClaimsStatusUpload = () => {
    const [poFile, setPoFile] = useState(null);
    const [implementationFile, setImplementationFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploads, setUploads] = useState([]);
    const [selectedTab, setSelectedTab] = useState('upload');
    const [selectedFile, setSelectedFile] = useState(null);

   const fetchUploads = async () => {
    const { data, error } = await supabase
        .from('claim_uploads')
        .select('*')
        .order('created_at', { ascending: false });

    if (!error && data) {
        // Remove duplicates by ID (in case real-time and fetch overlap)
        const uniqueMap = new Map();
        data.forEach(item => uniqueMap.set(item.id, item));
        setUploads(Array.from(uniqueMap.values()));
    } else {
        console.error('Error fetching uploads:', error);
    }
};


    useEffect(() => {
        if (selectedTab === 'view') {
            fetchUploads();
        }
    }, [selectedTab]);
useEffect(() => {
    let channel;

    if (selectedTab === 'view') {
        fetchUploads();

        channel = supabase
            .channel('claim_uploads_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'claim_uploads',
            }, payload => {
                console.log('Change received!', payload);
                fetchUploads(); // re-fetch after insert, update, or delete
            })
            .subscribe();
    }

    return () => {
        if (channel) {
            supabase.removeChannel(channel);
        }
    };
}, [selectedTab]);

    const onDropPO = useCallback((acceptedFiles) => {
        setPoFile(acceptedFiles[0]);
    }, []);

    const onDropImplementation = useCallback((acceptedFiles) => {
        setImplementationFile(acceptedFiles[0]);
    }, []);

    const { getRootProps: getRootPOProps, getInputProps: getInputPOProps } = useDropzone({ onDrop: onDropPO });
    const { getRootProps: getRootImplProps, getInputProps: getInputImplProps } = useDropzone({ onDrop: onDropImplementation });

    const toBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
        });


const handleSave = async () => {
    if (!poFile && !implementationFile) {
        console.log("No files selected. Triggering swal...");
        Swal.fire("Oops!", "Please upload at least one file.", "warning");
        return;
    }

    try {
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
        const createdName = loggedInUser?.name || 'Unknown';

        const poData = poFile ? await toBase64(poFile) : null;
        const implData = implementationFile ? await toBase64(implementationFile) : null;

        const { error } = await supabase.from('claim_uploads').insert({
            po_file_name: poFile?.name || null,
            po_file_data: poData,
            implementation_file_name: implementationFile?.name || null,
            implementation_file_data: implData,
            CreatedName: createdName,
        });

        if (error) {
            console.log("Insert error. Triggering swal...");
            Swal.fire("Error", "Failed to save to Supabase.", "error");
        } else {
            console.log("Success. Triggering swal...");
            Swal.fire("Success!", "Files saved successfully!", "success");
            setPoFile(null);
            setImplementationFile(null);
        }
    } catch (err) {
        console.error('Catch error:', err);
        Swal.fire("Error", "Failed to save data.", "error");
    }
};





    const handlePreview = (fileName, base64Data) => {
        if (!base64Data) return;

        let mimeType = 'application/octet-stream';

        try {
            mimeType = base64Data.split(';')[0].split(':')[1];
        } catch {
            // fallback mimeType remains
        }

        setSelectedFile({
            name: fileName,
            data: base64Data,
            type: mimeType,
        });
    };

    const closeModal = () => setSelectedFile(null);
    // Add this function inside your ClaimsStatusUpload component
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this record?')) {
            return;
        }
        try {
            const { error } = await supabase
                .from('claim_uploads')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Failed to delete record.');
                console.error('Delete error:', error);
            } else {
                alert('Record deleted successfully.');
                fetchUploads(); // Refresh list after delete
            }
        } catch (err) {
            alert('Error deleting record.');
            console.error('Error:', err);
        }
    };

    return (
        <div className="claims-container">
            <div className="tab-buttons">
                <button className={selectedTab === 'upload' ? 'active' : ''} onClick={() => setSelectedTab('upload')}>Upload</button>
                <button className={selectedTab === 'view' ? 'active' : ''} onClick={() => setSelectedTab('view')}>View Records</button>
            </div>

            {selectedTab === 'upload' && (
                <>
                    {/* P.O Dropzone */}
                    <div className="upload-section">
                        <h3>Upload P.O / Purchase Order</h3>
                        <div {...getRootPOProps({ className: 'dropzone' })} style={{ position: 'relative', minHeight: 180 }}>
                            <input {...getInputPOProps()} />
                            {poFile ? (
                                <>
                                    <p>{poFile.name}</p>
                                    {poFile.type.startsWith('image/') && (
                                        <div style={{
                                            position: 'relative',
                                            width: 150,
                                            height: 150,
                                            borderRadius: 8,
                                            overflow: 'hidden',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                            display: 'inline-block',
                                            marginTop: 10,
                                        }}>
                                            <button
                                                onClick={e => { e.stopPropagation(); setPoFile(null); }}
                                                style={{
                                                    position: 'absolute',
                                                    top: 5,
                                                    right: 5,
                                                    background: 'rgba(0,0,0,0.6)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    width: 24,
                                                    height: 24,
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    lineHeight: 1,
                                                }}
                                                aria-label="Remove P.O file"
                                            >×</button>
                                            <img
                                                src={URL.createObjectURL(poFile)}
                                                alt={poFile.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p>Drag and drop or click to upload</p>
                            )}
                        </div>
                    </div>

                    {/* Implementation Dropzone */}
                    <div className="upload-section">
                        <h3>Upload Implementation</h3>
                        <div {...getRootImplProps({ className: 'dropzone' })} style={{ position: 'relative', minHeight: 180 }}>
                            <input {...getInputImplProps()} />
                            {implementationFile ? (
                                <>
                                    <p>{implementationFile.name}</p>
                                    {implementationFile.type.startsWith('image/') && (
                                        <div style={{
                                            position: 'relative',
                                            width: 150,
                                            height: 150,
                                            borderRadius: 8,
                                            overflow: 'hidden',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                            display: 'inline-block',
                                            marginTop: 10,
                                        }}>
                                            <button
                                                onClick={e => { e.stopPropagation(); setImplementationFile(null); }}
                                                style={{
                                                    position: 'absolute',
                                                    top: 5,
                                                    right: 5,
                                                    background: 'rgba(0,0,0,0.6)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    width: 24,
                                                    height: 24,
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    lineHeight: 1,
                                                }}
                                                aria-label="Remove Implementation file"
                                            >×</button>
                                            <img
                                                src={URL.createObjectURL(implementationFile)}
                                                alt={implementationFile.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p>Drag and drop or click to upload</p>
                            )}
                        </div>
                    </div>

                    <button className="save-button" onClick={handleSave}>
                        Save All Data
                    </button>

                </>
            )}

            {selectedTab === 'view' && (
                <table className="uploads-table">
                    <thead>
                        <tr>
                            <th style={{ padding: '14px 16px', textAlign: 'left', backgroundColor: '#007bff', color: 'white' }}>PO File</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', backgroundColor: '#007bff', color: 'white' }}>Implementation File</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', backgroundColor: '#007bff', color: 'white' }}>Uploaded At</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', backgroundColor: '#007bff', color: 'white' }}>Delete</th> {/* New column */}
                        </tr>
                    </thead>

                    <tbody>
                        {uploads.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    {item.po_file_name ? (
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePreview(item.po_file_name, item.po_file_data); }}>
                                            {item.po_file_name}
                                        </a>
                                    ) : '-'}
                                </td>
                                <td>
                                    {item.implementation_file_name ? (
                                        <a href="#" onClick={(e) => { e.preventDefault(); handlePreview(item.implementation_file_name, item.implementation_file_data); }}>
                                            {item.implementation_file_name}
                                        </a>
                                    ) : '-'}
                                </td>
                                <td>{new Date(item.created_at).toLocaleString()}</td>
                                <td>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        style={{
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 12px',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                        }}
                                        aria-label={`Delete record ${item.id}`}
                                        title="Delete"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>

                </table>
            )}

            {selectedFile && (
                <div
                    className="modal"
                    onClick={closeModal}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white', padding: 50, borderRadius: 10, maxWidth: '80%', maxHeight: '90%', overflow: 'auto'
                        }}
                    >
                        <h3
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',  // centers horizontally
                                gap: 12,
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                marginBottom: 20,
                            }}
                        >
                            <img
                                src={getFileIcon(selectedFile.name, selectedFile.type)}
                                alt="File icon"
                                style={{ width: 48, height: 48 }}  // larger icon size
                            />
                            {selectedFile.name}
                        </h3>

                        {selectedFile.type.startsWith('image/') && (
                            <img src={selectedFile.data} alt={selectedFile.name} style={{ maxWidth: '100%', maxHeight: '50%' }} />
                        )}

                        {selectedFile.type === 'application/pdf' && (
                            <iframe
                                src={selectedFile.data}
                                title="PDF Preview"
                                width="50%"
                                height="50%"
                                style={{ border: 'none' }}
                            />
                        )}

                        {selectedFile.type.startsWith('text/') && (
                            <iframe
                                src={selectedFile.data}
                                title="Text Preview"
                                width="50%"
                                height="50%"
                                style={{ border: 'none' }}
                            />
                        )}

                        {!selectedFile.type.startsWith('image/') &&
                            selectedFile.type !== 'application/pdf' &&
                            !selectedFile.type.startsWith('text/') && (
                                <p>Preview not available for this file type.</p>
                            )}

                        {/* Download button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: '10px' }}>
                            <button
                                style={{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = selectedFile.data;
                                    link.download = selectedFile.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                aria-label="Download file"
                                title="Download"
                            >
                                {/* Download icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M.5 9.9v2.6A1.5 1.5 0 002 14h12a1.5 1.5 0 001.5-1.5v-2.6h-1v2.6a.5.5 0 01-.5.5H2a.5.5 0 01-.5-.5v-2.6h-1z" />
                                    <path d="M7.5 1v7.793L5.354 7.146l-.708.708L8 10.207l3.354-3.354-.708-.708L8.5 8.793V1h-1z" />
                                </svg>
                                Download
                            </button>

                            <button
                                style={{ flex: 1, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                                onClick={closeModal}
                                aria-label="Close modal"
                                title="Close"
                            >
                                {/* Close (X) icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 11.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
                                </svg>
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}


        </div>
    );
};
function getFileIcon(fileName, fileType) {
    const ext = fileName.split('.').pop().toLowerCase();

    // Icons from icons8 (you can replace with your own icons)
    const icons = {
        pdf: 'https://img.icons8.com/color/24/000000/pdf.png',
        doc: 'https://img.icons8.com/color/24/000000/ms-word.png',
        docx: 'https://img.icons8.com/color/24/000000/ms-word.png',
        xls: 'https://img.icons8.com/color/24/000000/ms-excel.png',
        xlsx: 'https://img.icons8.com/color/24/000000/ms-excel.png',
        ppt: 'https://img.icons8.com/color/24/000000/ms-powerpoint.png',
        pptx: 'https://img.icons8.com/color/24/000000/ms-powerpoint.png',
        txt: 'https://img.icons8.com/color/24/000000/txt.png',
    };

    // Image files get a generic image icon
    if (fileType.startsWith('image/')) {
        return 'https://img.icons8.com/color/24/000000/image.png';
    }

    return icons[ext] || 'https://img.icons8.com/color/24/000000/file.png'; // default icon
}

export default ClaimsStatusUpload;
