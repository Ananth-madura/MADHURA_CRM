const { createProxyMiddleware } = require("http-proxy-middleware");

const BACKEND = process.env.REACT_APP_API_PROXY || "http://localhost:5000";

module.exports = function (app) {
  // Proxy all /api requests to the backend
  app.use(
    "/api",
    createProxyMiddleware({
      target: BACKEND,
      changeOrigin: true,
      logLevel: "warn",
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