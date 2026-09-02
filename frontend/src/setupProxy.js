const { createProxyMiddleware } = require("http-proxy-middleware");

const BACKEND = process.env.REACT_APP_API_PROXY || "http://127.0.0.1:5000";

module.exports = function (app) {
  // Proxy all /api requests to the backend
  app.use(
    "/api",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
      logLevel: "warn",
      onError: (err, req, res) => {
        console.warn(`[Proxy Error] ${req.method} ${req.url} -> ${err.message}`);
        if (!res.headersSent) {
          res.status(502).json({ error: `Backend proxy error (${err.message})` });
        }
      },
    })
  );

  // Proxy /uploads (static files served by backend)
  app.use(
    "/uploads",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
    })
  );

  // Proxy socket.io for real-time features
  app.use(
    "/socket.io",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
      ws: true, // enable WebSocket proxying
    })
  );
};