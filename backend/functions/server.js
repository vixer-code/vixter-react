const express = require('express');
const cors = require('cors');
const { packUploadVideo } = require('./src/packUploadVideo');

const app = express();

// Configure CORS
const corsOptions = {
  origin: [
    'https://vixter-react.vercel.app',
    'https://vixter.com.br',
    'https://www.vixter.com.br',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Increase payload limit
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount the function
app.all('*', (req, res) => {
  // Create a mock request/response that matches Firebase Functions format
  const mockReq = {
    ...req,
    method: req.method,
    headers: req.headers,
    body: req.body,
    pipe: (stream) => {
      if (req.method === 'POST' && req.headers['content-type']?.includes('multipart/form-data')) {
        return req.pipe(stream);
      }
      return stream;
    }
  };

  const mockRes = {
    ...res,
    status: (code) => ({ ...res, statusCode: code, json: (data) => res.json(data) }),
    set: (key, value) => res.set(key, value),
    end: () => res.end()
  };

  // Call the Firebase Function
  packUploadVideo(mockReq, mockRes);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});