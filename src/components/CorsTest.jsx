import React, { useState } from 'react';

const CorsTest = () => {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testCors = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      // Test OPTIONS request
      console.log('Testing OPTIONS request...');
      const optionsResponse = await fetch('https://vixter-react-llyd.vercel.app/api/centrifugo/publish', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://vixter-react.vercel.app',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      
      console.log('OPTIONS Response:', optionsResponse);
      console.log('OPTIONS Headers:', Object.fromEntries(optionsResponse.headers.entries()));
      
      // Test POST request
      console.log('Testing POST request...');
      const postResponse = await fetch('https://vixter-react-llyd.vercel.app/api/centrifugo/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://vixter-react.vercel.app'
        },
        body: JSON.stringify({
          channel: 'test-channel',
          data: { message: 'test message' }
        })
      });
      
      console.log('POST Response:', postResponse);
      console.log('POST Headers:', Object.fromEntries(postResponse.headers.entries()));
      
      const data = await postResponse.json();
      console.log('POST Data:', data);
      
      setResult(`SUCCESS! Status: ${postResponse.status}, Data: ${JSON.stringify(data)}`);
      
    } catch (error) {
      console.error('CORS Test Error:', error);
      setResult(`ERROR: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '2px solid #ccc', 
      padding: '10px', 
      borderRadius: '5px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>CORS Test</h4>
      <button onClick={testCors} disabled={loading}>
        {loading ? 'Testing...' : 'Test CORS'}
      </button>
      <div style={{ marginTop: '10px', fontSize: '12px' }}>
        {result}
      </div>
    </div>
  );
};

export default CorsTest;
