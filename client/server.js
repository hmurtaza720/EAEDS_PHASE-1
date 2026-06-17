const next = require('next');
const http = require('http');
const httpProxy = require('http-proxy');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const BACKEND_URL = 'http://127.0.0.1:8000';

// Create a reusable proxy instance
const proxy = httpProxy.createProxyServer({
    target: BACKEND_URL,
    ws: true
});

proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
});

app.prepare().then(() => {
    const server = http.createServer((req, res) => {
        handle(req, res);
    });

    // Proxy WebSocket upgrades to the backend
    server.on('upgrade', (req, socket, head) => {
        if (req.url && req.url.startsWith('/ws/')) {
            console.log('Proxying WebSocket:', req.url, '->', BACKEND_URL + req.url);
            proxy.ws(req, socket, head);
        }
        // Otherwise let Next.js handle it (HMR)
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`> Custom server ready on http://localhost:${PORT}`);
        console.log(`> WebSocket proxy: /ws/* -> ${BACKEND_URL}`);
    });
});
