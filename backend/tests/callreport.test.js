const request = require("supertest");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const app = require("../server");

const mockDb = mysql._mockDb;
const adminToken = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);

const mockResolve = (result) => (sql, values, cb) => {
  if (typeof values === "function") { cb = values; values = []; }
  cb(null, result);
};

beforeEach(() => { mockDb.query.mockReset(); });

describe("Call Report Routes", () => {
  describe("GET /api/call-reports", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/call-reports");
      expect(res.statusCode).toBe(401);
    });
    it("should list call reports", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Caller" }]));
      const res = await request(app).get("/api/call-reports").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/call-reports validation", () => {
    it("should block creation of Closed call report without Step 2 completion", async () => {
      const res = await request(app)
        .post("/api/call-reports")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Closed", step2_completed: 0 });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("Cannot close call report");
    });
  });

  describe("PUT /api/call-reports/:id validation", () => {
    it("should block updating to Closed status if Step 2 is not completed", async () => {
      mockDb.query.mockImplementation((sql, values, cb) => {
        if (typeof values === "function") { cb = values; values = []; }
        if (sql.includes("SELECT step2_completed")) {
          cb(null, [{ step2_completed: 0 }]);
        } else {
          cb(null, { affectedRows: 1 });
        }
      });
      const res = await request(app)
        .put("/api/call-reports/1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Closed", step2_completed: 0 });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("Cannot close call report");
    });
  });
});
