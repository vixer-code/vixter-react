import React, { useState } from 'react';
import { uploadDefaultImages, DEFAULT_IMAGES } from '../utils/defaultImages';

const DefaultImageUploader = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState({});
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    setIsUploading(true);
    setError(null);
    
    try {
      const urls = await uploadDefaultImages();
      setUploadedUrls(urls);
      alert('Default images uploaded successfully! Check the console for URLs.');
    } catch (err) {
      setError(err.message);
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Upload Default Profile Pictures to Firebase</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p>This will upload the default profile pictures (defpfp1.png, defpfp2.png, defpfp3.png) to Firebase Storage.</p>
        <p><strong>Note:</strong> After uploading, copy the URLs from the console and update the DEFAULT_IMAGES object in the code.</p>
      </div>

      <button 
        onClick={handleUpload}
        disabled={isUploading}
        style={{
          padding: '10px 20px',
          backgroundColor: isUploading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: isUploading ? 'not-allowed' : 'pointer'
        }}
      >
        {isUploading ? 'Uploading...' : 'Upload Default Images'}
      </button>

      {error && (
        <div style={{ 
          marginTop: '10px', 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '5px' 
        }}>
          Error: {error}
        </div>
      )}

      {Object.keys(uploadedUrls).length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Uploaded URLs:</h3>
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '10px', 
            borderRadius: '5px',
            overflow: 'auto'
          }}>
            {JSON.stringify(uploadedUrls, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '5px' }}>
        <h4>Next Steps:</h4>
        <ol>
          <li>Click "Upload Default Images" above</li>
          <li>Check the browser console for the Firebase URLs</li>
          <li>Copy those URLs and update the DEFAULT_IMAGES object in the code</li>
          <li>Update your components to use the new Firebase URLs</li>
        </ol>
      </div>
    </div>
  );
};

export default DefaultImageUploader; 