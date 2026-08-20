const mockDb = {
  connect: jest.fn((cb) => {
    if (cb) cb(null);
  }),
  query: jest.fn((sql, values, cb) => {
    if (typeof values === "function") {
      cb = values;
      values = [];
    }
    if (cb) {
      cb(null, []);
    } else {
      return { on: jest.fn(), emit: jest.fn() };
    }
  }),
  changeUser: jest.fn((opts, cb) => {
    if (cb) cb(null);
  }),
  ping: jest.fn((cb) => {
    if (cb) cb(null);
  }),
  end: jest.fn((cb) => {
    if (cb) cb(null);
  }),
  on: jest.fn(),
  beginTransaction: jest.fn((cb) => {
    if (cb) cb(null);
  }),
  commit: jest.fn((cb) => {
    if (cb) cb(null);
  }),
  rollback: jest.fn((cb) => {
    if (cb) cb(null);
  }),
  promise: jest.fn(() => ({
    query: jest.fn((sql, params) => Promise.resolve([[], []])),
  })),
  escape: jest.fn((val) => {
    if (val === undefined || val === null) return "NULL";
    if (typeof val === "number") return String(val);
    if (typeof val === "boolean") return val ? "true" : "false";
    if (val instanceof Date) return `'${val.toISOString()}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
  }),
};

module.exports = {
  createConnection: jest.fn(() => mockDb),
  _mockDb: mockDb,
  escape: jest.fn((val) => {
    if (val === undefined || val === null) return "NULL";
    if (typeof val === "number") return String(val);
    if (typeof val === "boolean") return val ? "true" : "false";
    if (val instanceof Date) return `'${val.toISOString()}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
  }),
};
