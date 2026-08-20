const request = require("supertest");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const app = require("../server");

const mockDb = mysql._mockDb;
const adminToken = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);

const employeeToken = jwt.sign({ id: 2, role: "guest" }, process.env.JWT_SECRET);

const mockResolve = (result) => (sql, values, cb) => {
  if (typeof values === "function") { cb = values; values = []; }
  cb(null, result);
};

beforeEach(() => { mockDb.query.mockReset(); });

describe("Client Routes", () => {
  describe("GET /api/client", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/client");
      expect(res.statusCode).toBe(401);
    });
    it("should list clients", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, company_name: "ClientCo" }]));
      const res = await request(app).get("/api/client").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/client/export", () => {
    it("should return 403 for non-admin", async () => {
      const res = await request(app)
        .get("/api/client/export")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(res.statusCode).toBe(403);
    });

    it("should export client CSV data for admin", async () => {
      mockDb.query.mockImplementation(mockResolve([
        { id: 1, name: "John Doe", company_name: "JD Corp", email: "john@example.com" }
      ]));
      const res = await request(app)
        .get("/api/client/export")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/csv/);
      expect(res.text).toContain("Customer name,Company Name");
      expect(res.text).toContain("John Doe,JD Corp");
    });
  });

  describe("POST /api/client/import", () => {
    it("should return 403 for non-admin", async () => {
      const res = await request(app)
        .post("/api/client/import")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ clients: [{ name: "New Client" }] });
      expect(res.statusCode).toBe(403);
    });

    it("should return 400 for empty client list", async () => {
      const res = await request(app)
        .post("/api/client/import")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ clients: [] });
      expect(res.statusCode).toBe(400);
    });

    it("should import client records", async () => {
      // Mock db query for lookup (first check returns empty so it inserts)
      mockDb.query.mockImplementation((sql, params, cb) => {
        if (typeof params === "function") { cb = params; params = []; }
        cb(null, []); // No duplicates found
      });

      const res = await request(app)
        .post("/api/client/import")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          clients: [
            { name: "Imported Client", phone: "1234567890", email: "import@example.com" }
          ]
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.imported).toBe(1);
      expect(res.body.failed).toBe(0);
    });
  });
});
