const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:7600', 'http://127.0.0.1:7600'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy all requests to Manticore Search
app.use('/api', createProxyMiddleware({
  target: 'http://127.0.0.1:9308',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Remove /api prefix when forwarding to Manticore
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`Proxying ${req.method} ${req.url} to Manticore Search`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
}));

app.listen(port, () => {
  console.log(`CORS proxy server running on port ${port}`);
  console.log(`Proxying requests to Manticore Search at http://127.0.0.1:9308`);
});
