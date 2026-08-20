const request = require("supertest");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const app = require("../server");

const mockDb = mysql._mockDb;
const adminToken = jwt.sign({ id: 1, role: "admin", first_name: "Admin" }, process.env.JWT_SECRET);
const employeeToken = jwt.sign({ id: 2, role: "employee", first_name: "Emp" }, process.env.JWT_SECRET);
const subadminToken = jwt.sign({ id: 3, role: "subadmin", first_name: "Sub" }, process.env.JWT_SECRET);

const mockResolve = (result) => (sql, values, cb) => {
  if (typeof values === "function") { cb = values; values = []; }
  cb(null, result);
};
const mockError = (errMsg) => (sql, values, cb) => {
  if (typeof values === "function") { cb = values; values = []; }
  cb(new Error(errMsg));
};

const defaultQueryImpl = (sql, values, cb) => {
  if (typeof values === "function") { cb = values; values = []; }
  if (cb) cb(null, []);
};
beforeEach(() => {
  mockDb.query.mockReset();
  mockDb.query.mockImplementation(defaultQueryImpl);
});

// ─── HEALTH ───────────────────────────────────────────────────────────────
describe("Health", () => {
  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  it("GET /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─── AUTH ROUTES /api/auth ────────────────────────────────────────────────
describe("Auth /api/auth", () => {
  describe("POST /api/auth/send-email-otp (public)", () => {
    it("should fail if email missing", async () => {
      const res = await request(app).post("/api/auth/send-email-otp").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Email required");
    });
    it("should succeed", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 1 }));
      const res = await request(app).post("/api/auth/send-email-otp").send({ email: "test@test.com" });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("OTP sent to email");
    });
  });

  describe("POST /api/auth/register (public)", () => {
    it("should fail if missing fields", async () => {
      const res = await request(app).post("/api/auth/register").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("All fields required");
    });
    it("should fail if OTP invalid", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).post("/api/auth/register").send({ first_name: "A", email: "a@b.com", otp: "1234", user_password: "pass", emp_id: "E1" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid or expired OTP");
    });
    it("should succeed", async () => {
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        if (sql.includes("SELECT * FROM email_otp")) {
          return callback(null, [{ email: "a@b.com", otp: "1234", expires_at: new Date(Date.now() + 99999) }]);
        }
        if (sql.includes("INSERT INTO users")) {
          return callback(null, { insertId: 99 });
        }
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).post("/api/auth/register").send({ first_name: "A", email: "a@b.com", otp: "1234", user_password: "pass", emp_id: "E1" });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain("Registration successful");
    });
  });

  describe("POST /api/auth/login (public)", () => {
    it("should fail if email missing", async () => {
      const res = await request(app).post("/api/auth/login").send({ password: "x" });
      expect(res.statusCode).toBe(400);
    });
    it("should fail if account pending", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A", email: "a@b.com", role: "employee", status: "pending" }]));
      const res = await request(app).post("/api/auth/login").send({ email: "a@b.com", password: "x" });
      expect(res.statusCode).toBe(403);
    });
    it("should fail if banned", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A", email: "a@b.com", role: "employee", status: "banned" }]));
      const res = await request(app).post("/api/auth/login").send({ email: "a@b.com", password: "x" });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/auth/admin-login (public)", () => {
    it("should fail if email missing", async () => {
      const res = await request(app).post("/api/auth/admin-login").send({});
      expect(res.statusCode).toBe(400);
    });
    it("should fail if not admin", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A", role: "employee", status: "active" }]));
      const res = await request(app).post("/api/auth/admin-login").send({ email: "a@b.com", password: "x" });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/auth/users", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/auth/users");
      expect(res.statusCode).toBe(401);
    });
    it("should list users", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A", email: "a@b.com", role: "admin", status: "active" }]));
      const res = await request(app).get("/api/auth/users").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.users).toBeDefined();
    });
  });

  // BUG: create-user uses isAdmin WITHOUT verifyToken, so req.user is never set → always 403
  describe("POST /api/auth/create-user (BUG: missing verifyToken)", () => {
    it("should return 403 without token (isAdmin without verifyToken)", async () => {
      const res = await request(app).post("/api/auth/create-user").send({});
      expect(res.statusCode).toBe(403);
    });
    it("should return 403 for employee (isAdmin without verifyToken)", async () => {
      const res = await request(app).post("/api/auth/create-user").set("Authorization", `Bearer ${employeeToken}`).send({});
      expect(res.statusCode).toBe(403);
    });
    it("should return 403 even for admin (isAdmin without verifyToken)", async () => {
      const res = await request(app).post("/api/auth/create-user").set("Authorization", `Bearer ${adminToken}`).send({ first_name: "A", email: "a@b.com", user_password: "pass" });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("PUT /api/auth/change-role/:id", () => {
    it("should fail with invalid role", async () => {
      const res = await request(app).put("/api/auth/change-role/1").set("Authorization", `Bearer ${adminToken}`).send({ role: "invalid" });
      expect(res.statusCode).toBe(400);
    });
    it("should succeed", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/auth/change-role/1").set("Authorization", `Bearer ${adminToken}`).send({ role: "subadmin" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/auth/ban-user/:id", () => {
    it("should fail with invalid status", async () => {
      const res = await request(app).put("/api/auth/ban-user/1").set("Authorization", `Bearer ${adminToken}`).send({ status: "invalid" });
      expect(res.statusCode).toBe(400);
    });
    it("should succeed", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/auth/ban-user/1").set("Authorization", `Bearer ${adminToken}`).send({ status: "banned" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/auth/delete-user/:id", () => {
    it("should succeed", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, [{ email: "a@b.com" }]);
        if (call === 2) return callback(null, {});
        if (call >= 3) {
          if (typeof callback === "function") callback(null, {});
        }
      });
      const res = await request(app).delete("/api/auth/delete-user/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/auth/approve/:userId", () => {
    it("should fail with invalid action", async () => {
      const res = await request(app).put("/api/auth/approve/1").set("Authorization", `Bearer ${adminToken}`).send({ action: "bad" });
      expect(res.statusCode).toBe(400);
    });
    it("should approve", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, {});
        if (call >= 2) {
          if (typeof callback === "function") callback(null, [{ id: 1, first_name: "A", email: "a@b.com" }]);
        }
      });
      const res = await request(app).put("/api/auth/approve/1").set("Authorization", `Bearer ${adminToken}`).send({ action: "active" });
      expect(res.statusCode).toBe(200);
    });
  });

  // BUG: reset-password uses isAdmin WITHOUT verifyToken → always 403
  describe("POST /api/auth/reset-password/:id (BUG: missing verifyToken)", () => {
    it("should return 403 even without password (isAdmin without verifyToken)", async () => {
      const res = await request(app).post("/api/auth/reset-password/1").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/auth/notifications", () => {
    it("should list notifications", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, type: "registration", message: "test" }]));
      const res = await request(app).get("/api/auth/notifications").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/auth/profile-change-requests", () => {
    it("should list requests", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, field: "email", status: "pending" }]));
      const res = await request(app).get("/api/auth/profile-change-requests").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/auth/handle-change-request/:id", () => {
    it("should fail with invalid action", async () => {
      const res = await request(app).put("/api/auth/handle-change-request/1").set("Authorization", `Bearer ${adminToken}`).send({ action: "bad" });
      expect(res.statusCode).toBe(400);
    });
    it("should approve", async () => {
      let calls = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        calls++;
        if (calls === 1) return callback(null, [{ id: 1, user_id: 1, field: "email", new_value: "new@b.com" }]);
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).put("/api/auth/handle-change-request/1").set("Authorization", `Bearer ${adminToken}`).send({ action: "approved" });
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── TEAM ROUTES /api/teammember ───────────────────────────────────────────
describe("Team /api/teammember", () => {
  describe("GET /api/teammember (public)", () => {
    it("should list team", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A" }]));
      const res = await request(app).get("/api/teammember");
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/teammember/admin", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/teammember/admin");
      expect(res.statusCode).toBe(401);
    });
    it("should list for admin", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A" }]));
      const res = await request(app).get("/api/teammember/admin").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/teammember/new", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).post("/api/teammember/new").send({});
      expect(res.statusCode).toBe(401);
    });
    it("should fail if missing fields", async () => {
      const res = await request(app).post("/api/teammember/new").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("All Field Required");
    });
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 1 }));
      const res = await request(app).post("/api/teammember/new").set("Authorization", `Bearer ${adminToken}`).send({ first_name: "A", last_name: "B", emp_email: "a@b.com", mobile: "12345", job_title: "Dev", emp_role: "Sales" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/teammember/by-user/:userId", () => {
    it("should get by user id", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A", user_id: 2 }]));
      const res = await request(app).get("/api/teammember/by-user/2").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/teammember/:id", () => {
    it("should return 404 if not found", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).get("/api/teammember/999").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
    it("should get single", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A" }]));
      const res = await request(app).get("/api/teammember/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/teammember/:id", () => {
    it("should update", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/teammember/1").set("Authorization", `Bearer ${adminToken}`).send({ first_name: "A" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/teammember/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/teammember/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── TELECALL ROUTES /api/Telecalls ────────────────────────────────────────
describe("Telecall /api/Telecalls", () => {
  describe("GET /api/Telecalls", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/Telecalls");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "T" }]));
      const res = await request(app).get("/api/Telecalls").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/Telecalls/:id", () => {
    it("should get single", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "T", created_by: 1 }]));
      const res = await request(app).get("/api/Telecalls/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/Telecalls", () => {
    it("should create", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, { insertId: 5 });
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).post("/api/Telecalls").set("Authorization", `Bearer ${adminToken}`).send({ customer_name: "Test", mobile_number: "123" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/Telecalls/:id", () => {
    it("should return 403 for employee", async () => {
      const res = await request(app).put("/api/Telecalls/1").set("Authorization", `Bearer ${employeeToken}`).send({});
      expect(res.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/Telecalls/:id", () => {
    it("should delete for admin", async () => {
      mockDb.query.mockImplementation(mockResolve([{ created_by: 1 }]));
      const res = await request(app).delete("/api/Telecalls/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── WALKIN ROUTES /api/Walkins ────────────────────────────────────────────
describe("Walkin /api/Walkins", () => {
  describe("GET /api/Walkins", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/Walkins");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "W" }]));
      const res = await request(app).get("/api/Walkins").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/Walkins", () => {
    it("should create", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, { insertId: 5 });
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).post("/api/Walkins").set("Authorization", `Bearer ${adminToken}`).send({ customer_name: "Test", mobile_number: "123" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/Walkins/:id", () => {
    it("should get single", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "W", created_by: 1 }]));
      const res = await request(app).get("/api/Walkins/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── FIELD ROUTES /api/Fields ──────────────────────────────────────────────
describe("Field /api/Fields", () => {
  describe("GET /api/Fields", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/Fields");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "F" }]));
      const res = await request(app).get("/api/Fields").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/Fields/new", () => {
    it("should fail without customer_name", async () => {
      const res = await request(app).post("/api/Fields/new").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
    it("should create", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, { insertId: 5 });
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).post("/api/Fields/new").set("Authorization", `Bearer ${adminToken}`).send({ customer_name: "Test", visit_date: "2025-01-01" });
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── CLIENT ROUTES /api/client ─────────────────────────────────────────────
describe("Client /api/client", () => {
  describe("GET /api/client/search", () => {
    it("should search", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, name: "C" }]));
      const res = await request(app).get("/api/client/search?name=test").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/client", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/client");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, name: "C" }]));
      const res = await request(app).get("/api/client").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/client", () => {
    it("should fail without name", async () => {
      const res = await request(app).post("/api/client").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Name is required");
    });
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 5 }));
      const res = await request(app).post("/api/client").set("Authorization", `Bearer ${adminToken}`).send({ name: "Client1" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/client/:id", () => {
    it("should get single", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, name: "C" }]));
      const res = await request(app).get("/api/client/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
    it("should return 404", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).get("/api/client/999").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("PUT /api/client/:id", () => {
    it("should update", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/client/1").set("Authorization", `Bearer ${adminToken}`).send({ name: "Updated" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/client/:id", () => {
    it("should delete", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, [{ created_by: 1 }]);
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).delete("/api/client/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/client/converted-from/:leadType/:leadId", () => {
    it("should get converted", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, name: "C" }]));
      const res = await request(app).get("/api/client/converted-from/telecall/5").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── CONTRACT ROUTES /api/contract ─────────────────────────────────────────
describe("Contract /api/contract", () => {
  describe("GET /api/contract", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/contract");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, client_company: "Acme" }]));
      const res = await request(app).get("/api/contract").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/contract/new", () => {
    it("should error if posting empty body", async () => {
      const res = await request(app).post("/api/contract/new").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 42 }));
      const res = await request(app).post("/api/contract/new").set("Authorization", `Bearer ${adminToken}`).send({ client_company: "Acme", contract_title: "Support", amount_value: 50000, service_type: "AMC" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/contract/by-type/:type", () => {
    it("should list by type", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, contract_type: "AMC" }]));
      const res = await request(app).get("/api/contract/by-type/AMC").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/contract/with-usage", () => {
    it("should list with usage", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, amount_value: 1000 }]));
      const res = await request(app).get("/api/contract/with-usage").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/contract/usage/:id", () => {
    it("should return 404 if not found", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).get("/api/contract/usage/999").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
    it("should get usage", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, amount_value: 1000 }]));
      const res = await request(app).get("/api/contract/usage/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/contract/:id", () => {
    it("should update", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/contract/1").set("Authorization", `Bearer ${adminToken}`).send({ client_company: "Acme" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/contract/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/contract/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── QUOTATION ROUTES /api/quotations ──────────────────────────────────────
describe("Quotation /api/quotations", () => {
  describe("GET /api/quotations/from-addresses", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/quotations/from-addresses");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, label: "Office", address: "123 St" }]));
      const res = await request(app).get("/api/quotations/from-addresses").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/quotations/from-addresses", () => {
    it("should fail if label missing", async () => {
      const res = await request(app).post("/api/quotations/from-addresses").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 5 }));
      const res = await request(app).post("/api/quotations/from-addresses").set("Authorization", `Bearer ${adminToken}`).send({ label: "Warehouse", address: "456 Ave" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/quotations/from-addresses/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({ affectedRows: 1 }));
      const res = await request(app).delete("/api/quotations/from-addresses/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/quotations", () => {
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Test", grand_total: 1000 }]));
      const res = await request(app).get("/api/quotations").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/quotations/customer-history/:id", () => {
    it("should get history", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Test" }]));
      const res = await request(app).get("/api/quotations/customer-history/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/quotations/:id", () => {
    it("should get single", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Test" }]));
      const res = await request(app).get("/api/quotations/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/quotations/create", () => {
    it("should fail validation", async () => {
      const res = await request(app).post("/api/quotations/create").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
    it("should create", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, { insertId: 10 });   // INSERT customers
        if (call === 2) return callback(null, []);                  // SELECT clients
        if (call === 3) return callback(null, { insertId: 20 });   // INSERT quotations
        if (call === 4) return callback(null, {});                  // INSERT quotation_items
        if (call === 5) return callback(null, {});                  // COMMIT
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).post("/api/quotations/create").set("Authorization", `Bearer ${adminToken}`).send({
        customer: { customer_name: "Test", mobile_number: "123", email: "t@t.com" },
        quotation: { quotation_date: "2025-01-01", subtotal: 100, grand_total: 118 },
        items: [{ description: "Item1", price: 100, quantity: 1, subtotal: 100 }]
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe("PUT /api/quotations/:id", () => {
    it("should fail validation", async () => {
      const res = await request(app).put("/api/quotations/1").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
  });
});

// ─── PERFORMA INVOICE ROUTES /api/performainvoice ──────────────────────────
describe("Performa Invoice /api/performainvoice", () => {
  describe("GET /api/performainvoice", () => {
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Test" }]));
      const res = await request(app).get("/api/performainvoice").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/performainvoice/version-history/:id", () => {
    it("should get history", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Test" }]));
      const res = await request(app).get("/api/performainvoice/version-history/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/performainvoice/:id", () => {
    it("should get single", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, quotation_id: 1 }]));
      const res = await request(app).get("/api/performainvoice/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/performainvoice/from-addresses", () => {
    it("should list addresses", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, label: "Office", address: "St" }]));
      const res = await request(app).get("/api/performainvoice/from-addresses").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/performainvoice/from-addresses", () => {
    it("should fail without label", async () => {
      const res = await request(app).post("/api/performainvoice/from-addresses").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/performainvoice/from-addresses/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({ affectedRows: 1 }));
      const res = await request(app).delete("/api/performainvoice/from-addresses/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/performainvoice/download-pdf/:id", () => {
    it("should return 404 if not found (no pdf generated without real db)", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).get("/api/performainvoice/download-pdf/999").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
  });
});

// ─── ESTIMATE INVOICE ROUTES /api/estimate-invoice ─────────────────────────
describe("Estimate Invoice /api/estimate-invoice", () => {
  describe("GET /api/estimate-invoice", () => {
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Est" }]));
      const res = await request(app).get("/api/estimate-invoice").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/estimate-invoice/create", () => {
    it("should fail validation", async () => {
      const res = await request(app).post("/api/estimate-invoice/create").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
  });
});

// ─── SERVICE ESTIMATION ROUTES /api/service-estimation ─────────────────────
describe("Service Estimation /api/service-estimation", () => {
  describe("GET /api/service-estimation", () => {
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Serv" }]));
      const res = await request(app).get("/api/service-estimation").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/service-estimation/create", () => {
    it("should fail validation", async () => {
      const res = await request(app).post("/api/service-estimation/create").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
  });
});

// ─── ESTIMATE ROUTES /api/estimate ─────────────────────────────────────────
describe("Estimate /api/estimate", () => {
  describe("GET /api/estimate", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/estimate");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/estimate").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/estimate/new", () => {
    it("should fail if missing fields", async () => {
      const res = await request(app).post("/api/estimate/new").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("required");
    });
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 5 }));
      const res = await request(app).post("/api/estimate/new").set("Authorization", `Bearer ${adminToken}`).send({ client_company: "Acme", project_names: "Proj", Estimate_date: "2025-01-01", Expiry_date: "2025-02-01" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/estimate/:id", () => {
    it("should update", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/estimate/1").set("Authorization", `Bearer ${adminToken}`).send({ client_company: "Acme" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/estimate/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/estimate/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── INVOICE ROUTES /api/invoice ───────────────────────────────────────────
describe("Invoice /api/invoice", () => {
  describe("POST /api/invoice/new", () => {
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 5 }));
      const res = await request(app).post("/api/invoice/new").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/invoice/:id", () => {
    it("should return 404 if not found", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).get("/api/invoice/999").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/invoice/with-payments", () => {
    it("should list with payments", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/invoice/with-payments").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── PAYMENT ROUTES /api/payments (no auth) ────────────────────────────────
describe("Payment /api/payments (public)", () => {
  describe("POST /api/payments/new", () => {
    it("should fail if invoice_id missing", async () => {
      const res = await request(app).post("/api/payments/new").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Invoice ID");
    });
    it("should fail if amount invalid", async () => {
      const res = await request(app).post("/api/payments/new").send({ invoice_id: 1, amount: -5, payment_method: "Cash" });
      expect(res.statusCode).toBe(400);
    });
    it("should fail if payment_method missing", async () => {
      const res = await request(app).post("/api/payments/new").send({ invoice_id: 1, amount: 100 });
      expect(res.statusCode).toBe(400);
    });
    it("should succeed", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 10 }));
      const res = await request(app).post("/api/payments/new").send({ invoice_id: 1, amount: 100, payment_date: "2025-01-01", payment_method: "Cash" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/payments", () => {
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, invoice_id: 1, amount: 100 }]));
      const res = await request(app).get("/api/payments");
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/payments/:id", () => {
    it("should update", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/payments/1").send({ invoice_id: 1, amount: 200, payment_method: "Bank" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/payments/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/payments/1");
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── ESTIMATE CLIENT ROUTES /api/estimate-client (no auth) ─────────────────
describe("Estimate Client /api/estimate-client (public)", () => {
  describe("POST /api/estimate-client/new", () => {
    it("should fail if fields missing", async () => {
      const res = await request(app).post("/api/estimate-client/new").send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("filed required");
    });
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 5 }));
      const res = await request(app).post("/api/estimate-client/new").send({ company_name: "C", client_firstname: "F", client_lastname: "L", client_email: "c@c.com" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/estimate-client/search", () => {
    it("should search", async () => {
      mockDb.query.mockImplementation(mockResolve([{ company_name: "C" }]));
      const res = await request(app).get("/api/estimate-client/search?name=C");
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── CALL REPORT ROUTES /api/call-reports ──────────────────────────────────
describe("Call Report /api/call-reports", () => {
  describe("GET /api/call-reports", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/call-reports");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer_name: "Caller" }]));
      const res = await request(app).get("/api/call-reports").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/call-reports/sessions", () => {
    it("should list sessions", async () => {
      mockDb.query.mockImplementation(mockResolve([{ session_id: "SES-1", customer: "C" }]));
      const res = await request(app).get("/api/call-reports/sessions").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/call-reports/performance", () => {
    it("should get performance stats", async () => {
      mockDb.query.mockImplementation(mockResolve([{ staff_name: "A", total_calls: 5 }]));
      const res = await request(app).get("/api/call-reports/performance").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/call-reports/customers", () => {
    it("should search customers", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, customer: "C" }]));
      const res = await request(app).get("/api/call-reports/customers?q=test").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/call-reports/contracts/:type", () => {
    it("should list contracts by type", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, contract_title: "AMC" }]));
      const res = await request(app).get("/api/call-reports/contracts/AMC").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/call-reports/session/:sessionId", () => {
    it("should get by session", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, session_id: "SES-1" }]));
      const res = await request(app).get("/api/call-reports/session/SES-1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/call-reports/:id", () => {
    it("should return 404 if not found", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).get("/api/call-reports/999").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
    it("should get single", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/call-reports/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/call-reports", () => {
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 10 }));
      const res = await request(app).post("/api/call-reports").set("Authorization", `Bearer ${adminToken}`).send({ customer_name: "Test", mobile_number: "123" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/call-reports/:id", () => {
    it("should update", async () => {
      mockDb.query.mockImplementation(mockResolve([{ step2_completed: 0 }]));
      const res = await request(app).put("/api/call-reports/1").set("Authorization", `Bearer ${adminToken}`).send({ customer_name: "Updated" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/call-reports/:id", () => {
    it("should return 403 for employee delete", async () => {
      const res = await request(app).delete("/api/call-reports/1").set("Authorization", `Bearer ${employeeToken}`);
      expect(res.statusCode).toBe(403);
    });
    it("should delete for admin", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/call-reports/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── SERVICE ROUTES /api/services ─────────────────────────────────────────
describe("Service /api/services", () => {
  describe("GET /api/services", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/services");
      expect(res.statusCode).toBe(401);
    });
    it("should list", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, client: "Test" }]));
      const res = await request(app).get("/api/services").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/services", () => {
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 5 }));
      const res = await request(app).post("/api/services").set("Authorization", `Bearer ${adminToken}`).field("client", "Test").field("material", "Mat").field("date", "2025-01-01");
      expect(res.statusCode).toBe(201);
    });
  });

  describe("DELETE /api/services/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/services/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/services/send-email/:id", () => {
    it("should return 404 if service not found", async () => {
      mockDb.query.mockImplementation(mockResolve([]));
      const res = await request(app).post("/api/services/send-email/999").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(404);
    });
    it("should fail if no email", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).post("/api/services/send-email/1").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("No email address provided");
    });
  });
});

// ─── AMC ROUTES /api/amc ──────────────────────────────────────────────────
describe("AMC /api/amc", () => {
  describe("POST /api/amc/amc-alc", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).post("/api/amc/amc-alc").send({});
      expect(res.statusCode).toBe(401);
    });
    it("should fail if missing required", async () => {
      const res = await request(app).post("/api/amc/amc-alc").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("required");
    });
    it("should create", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, { insertId: 5 });
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).post("/api/amc/amc-alc").set("Authorization", `Bearer ${adminToken}`).send({ contract_id: 1, service_type: "AMC", service_date: "2025-01-01" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/amc/amc-alc/:contract_id", () => {
    it("should list by contract", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/amc/amc-alc/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/amc/amc-alc", () => {
    it("should list all", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/amc/amc-alc").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/amc/expenses", () => {
    it("should get expenses", async () => {
      mockDb.query.mockImplementation(mockResolve([{ total: 1000 }]));
      const res = await request(app).get("/api/amc/expenses").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/amc/person-performance", () => {
    it("should get performance", async () => {
      mockDb.query.mockImplementation(mockResolve([{ name: "A", count: 5 }]));
      const res = await request(app).get("/api/amc/person-performance").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/amc/activity", () => {
    it("should get activity", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, activity_type: "Created" }]));
      const res = await request(app).get("/api/amc/activity").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/amc/amc-alc/:id", () => {
    it("should update", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).put("/api/amc/amc-alc/1").set("Authorization", `Bearer ${adminToken}`).send({ service_type: "AMC", customer_name: "Test" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/amc/amc-alc/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/amc/amc-alc/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── TARGET ROUTES /api/targets ────────────────────────────────────────────
describe("Target /api/targets", () => {
  describe("GET /api/targets", () => {
    it("should return 403 for employee", async () => {
      const res = await request(app).get("/api/targets").set("Authorization", `Bearer ${employeeToken}`);
      expect(res.statusCode).toBe(403);
    });
    it("should list for admin", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, user_id: 1, monthly_target: 100000 }]));
      const res = await request(app).get("/api/targets").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/targets/my", () => {
    it("should get my targets", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, monthly_target: 100000 }]));
      const res = await request(app).get("/api/targets/my").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/targets", () => {
    it("should fail if missing fields", async () => {
      const res = await request(app).post("/api/targets").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
    it("should create", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 5 }));
      const res = await request(app).post("/api/targets").set("Authorization", `Bearer ${adminToken}`).send({ user_name: "Emp1", yearly_target: 1200000 });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/targets/update", () => {
    it("should fail if missing fields", async () => {
      const res = await request(app).post("/api/targets/update").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/targets/history", () => {
    it("should get history", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, amount: 50000 }]));
      const res = await request(app).get("/api/targets/history").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/targets/graph", () => {
    it("should get graph data", async () => {
      mockDb.query.mockImplementation(mockResolve([{ month: "Jan", achieved: 50000 }]));
      const res = await request(app).get("/api/targets/graph").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── LEAD MANAGEMENT ROUTES /api/leads ─────────────────────────────────────
describe("Leads /api/leads", () => {
  describe("GET /api/leads/reminders/:leadType/:leadId", () => {
    it("should list reminders", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, reminder_date: "2025-01-01" }]));
      const res = await request(app).get("/api/leads/reminders/telecall/5").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/leads/reminders", () => {
    it("should create reminder", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, { insertId: 10 });
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).post("/api/leads/reminders").set("Authorization", `Bearer ${adminToken}`).send({ lead_id: 5, lead_type: "telecall", reminder_date: "2025-01-10" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/leads/reminders/:id", () => {
    it("should update", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/leads/reminders/1").set("Authorization", `Bearer ${adminToken}`).send({ status: "Completed" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/leads/reminders/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/leads/reminders/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/leads/check-missed", () => {
    it("should check missed", async () => {
      mockDb.query.mockImplementation(mockResolve({ affectedRows: 0 }));
      const res = await request(app).post("/api/leads/check-missed").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/leads/escalations", () => {
    it("should list escalations", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/leads/escalations").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/leads/escalations/:id/resolve", () => {
    it("should resolve", async () => {
      let call = 0;
      mockDb.query.mockImplementation((sql, values, cb) => {
        const callback = typeof values === "function" ? values : cb;
        call++;
        if (call === 1) return callback(null, [{ id: 1, employee_id: null }]);
        if (typeof callback === "function") callback(null, {});
      });
      const res = await request(app).put("/api/leads/escalations/1/resolve").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/leads/activity/:leadType/:leadId", () => {
    it("should list activity", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, action: "Called" }]));
      const res = await request(app).get("/api/leads/activity/telecall/5").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/leads/activity", () => {
    it("should create activity", async () => {
      mockDb.query.mockImplementation(mockResolve({ insertId: 1 }));
      const res = await request(app).post("/api/leads/activity").set("Authorization", `Bearer ${adminToken}`).send({ lead_id: 5, lead_type: "telecall", action: "Called" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/leads/notifications", () => {
    it("should list notifications", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/leads/notifications").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/leads/missed-counts/:leadType", () => {
    it("should get counts", async () => {
      mockDb.query.mockImplementation(mockResolve([{ missed: 3 }]));
      const res = await request(app).get("/api/leads/missed-counts/telecall").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/leads/converted", () => {
    it("should list converted leads", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/leads/converted").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/leads/telecall/:id", () => {
    it("should update telecall lead", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/leads/telecall/1").set("Authorization", `Bearer ${adminToken}`).send({ call_outcome: "Converted" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/leads/walkin/:id", () => {
    it("should update walkin lead", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/leads/walkin/1").set("Authorization", `Bearer ${adminToken}`).send({ walkin_status: "Converted" });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/leads/field/:id", () => {
    it("should update field lead", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/leads/field/1").set("Authorization", `Bearer ${adminToken}`).send({ field_outcome: "Converted" });
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── NOTIFICATION ROUTES /api/notifications ────────────────────────────────
describe("Notifications /api/notifications", () => {
  describe("GET /api/notifications", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.statusCode).toBe(401);
    });
    it("should list notifications", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, message: "test" }]));
      const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("should get count", async () => {
      mockDb.query.mockImplementation(mockResolve([{ count: 3 }]));
      const res = await request(app).get("/api/notifications/unread-count").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/notifications/:id/read", () => {
    it("should mark read", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/notifications/1/read").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/notifications/read-all", () => {
    it("should mark all read", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/notifications/read-all").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/notifications/:id", () => {
    it("should delete", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/notifications/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/notifications/admin", () => {
    it("should list admin notifications", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/notifications/admin").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/notifications/admin/unread-count", () => {
    it("should get admin unread count", async () => {
      mockDb.query.mockImplementation(mockResolve([{ count: 2 }]));
      const res = await request(app).get("/api/notifications/admin/unread-count").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/notifications/admin/:id/read", () => {
    it("should mark admin notification read", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/notifications/admin/1/read").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/notifications/admin/read-all", () => {
    it("should mark all admin read", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/notifications/admin/read-all").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /api/notifications/admin/:id", () => {
    it("should delete admin notification", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).delete("/api/notifications/admin/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/notifications/:id/archive", () => {
    it("should archive", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/notifications/1/archive").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("PUT /api/notifications/:id/unarchive", () => {
    it("should unarchive", async () => {
      mockDb.query.mockImplementation(mockResolve({}));
      const res = await request(app).put("/api/notifications/1/unarchive").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/notifications/employees", () => {
    it("should list employees", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, first_name: "A" }]));
      const res = await request(app).get("/api/notifications/employees").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/notifications/employee/:userId", () => {
    it("should get employee notifications", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/notifications/employee/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/notifications/admin/employee/:userId", () => {
    it("should get admin notifications for employee", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/notifications/admin/employee/1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── REPORT ROUTES /api/reports ────────────────────────────────────────────
describe("Reports /api/reports", () => {
  describe("GET /api/reports/overview", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/reports/overview");
      expect(res.statusCode).toBe(401);
    });
    it("should get overview", async () => {
      mockDb.promise = jest.fn(() => ({
        query: jest.fn(() => Promise.resolve([[{ total: 1000 }], [{ telecalls: 5, walkins: 3, fields: 2, tc_conv: 1, wk_conv: 1, fld_conv: 1 }], [{ count: 10, revenue: 5000 }]])),
      }));
      const res = await request(app).get("/api/reports/overview").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/reports/employee-comparison", () => {
    it("should get comparison", async () => {
      mockDb.promise().query.mockResolvedValue([[{ id: 1, first_name: "A", last_name: "", job_title: "Dev", emp_email: "a@b.com" }]]);
      const res = await request(app).get("/api/reports/employee-comparison").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/reports/breakdown", () => {
    it("should get breakdown", async () => {
      const res = await request(app).get("/api/reports/breakdown?filter=month").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/reports/trends", () => {
    it("should get trends", async () => {
      const res = await request(app).get("/api/reports/trends").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

// ─── TASK ROUTES /api/task ─────────────────────────────────────────────────
describe("Task /api/task", () => {
  describe("GET /api/task", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/task");
      expect(res.statusCode).toBe(401);
    });
    it("should list tasks", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1, task_name: "Test" }]));
      const res = await request(app).get("/api/task").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/task/dashboard/tasks", () => {
    it("should get dashboard tasks", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/task/dashboard/tasks").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/task/overdue", () => {
    it("should list overdue for admin", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/task/overdue").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/task/targets", () => {
    it("should list targets for admin", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/task/targets").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/task/targets/my", () => {
    it("should require user_id query param", async () => {
      const res = await request(app).get("/api/task/targets/my?user_id=1").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/task/targets/user", () => {
    it("should require user_name", async () => {
      const res = await request(app).get("/api/task/targets/user").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/task/notifications", () => {
    it("should list notifications", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/task/notifications").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/task/activity", () => {
    it("should list activity", async () => {
      mockDb.query.mockImplementation(mockResolve([{ id: 1 }]));
      const res = await request(app).get("/api/task/activity").set("Authorization", `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("POST /api/task", () => {
    it("should fail for employee (isAdmin required)", async () => {
      const res = await request(app).post("/api/task").set("Authorization", `Bearer ${employeeToken}`).send({});
      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/task/assign", () => {
    it("should fail if missing user", async () => {
      const res = await request(app).post("/api/task/assign").set("Authorization", `Bearer ${adminToken}`).send({});
      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /api/task/assignment/:id/respond", () => {
    it("should fail with invalid action", async () => {
      const res = await request(app).put("/api/task/assignment/1/respond").set("Authorization", `Bearer ${adminToken}`).send({ action: "invalid" });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("PUT /api/task/assignment/:id/status", () => {
    it("should fail with invalid status", async () => {
      const res = await request(app).put("/api/task/assignment/1/status").set("Authorization", `Bearer ${adminToken}`).send({ status: "invalid" });
      expect(res.statusCode).toBe(400);
    });
  });
});
