import React, { useState, useEffect } from "react";
import "../Styles/tailwind.css";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { Plus, Edit2, Trash2, Ban, Unlock, Search, X, Key } from "lucide-react";

import { API } from "../config";

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    user_password: "",
    emp_id: "",
    job_title: "",
    emp_role: "",
    system_role: "employee",
    mobile_number: "",
    emp_address: "",
  });

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.users || res.data);
    } catch (err) {
      console.error("Fetch users error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetFormData = () => ({
    first_name: "",
    last_name: "",
    email: "",
    user_password: "",
    emp_id: "",
    job_title: "",
    emp_role: "",
    system_role: "employee",
    mobile_number: "",
    emp_address: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/auth/create-user`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      setFormData(resetFormData());
      fetchUsers();
      alert("Employee created successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create user");
    }
  };

  const handleEdit = (u) => {
    setSelectedUser(u);
    setFormData({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      emp_id: u.emp_id || "",
      job_title: u.job_title || "",
      emp_role: u.emp_role || "",
      system_role: u.role || "employee",
      mobile_number: u.mobile_number || "",
      emp_address: u.emp_address || ""
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      // Update user info
      await axios.put(`${API}/api/auth/update-user/${selectedUser.id}`, {
        ...formData,
        role: formData.system_role
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // If role changed, call change-role too (only admin can)
      if (formData.system_role && formData.system_role !== selectedUser.role) {
        try {
          await axios.put(`${API}/api/auth/change-role/${selectedUser.id}`, { role: formData.system_role }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (roleErr) {
          console.log("Role update note:", roleErr.response?.data?.message);
        }
      }

      setShowEditModal(false);
      fetchUsers();
      alert("Employee updated successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update user");
    }
  };

  const handleBan = async (userId, currentStatus) => {
    const newStatus = currentStatus === "banned" ? "active" : "banned";
    if (!window.confirm(`Are you sure you want to ${newStatus === "banned" ? "ban" : "unban"} this user?`)) return;
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/auth/ban-user/${userId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      alert("Failed to update user status");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/auth/delete-user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt("Enter new password for this user (min. 6 chars):");
    if (!newPassword) return;
    if (newPassword.length < 6) return alert("Password must be at least 6 characters");
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/auth/reset-password/${userId}`, { new_password: newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Password reset successfully");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reset password");
    }
  };

  const filteredUsers = users.filter(u =>
    u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>;
      case "banned":
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Banned</span>;
      case "pending":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Pending</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  const getRoleBadge = (role) => (
    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
      role === "subadmin" ? "bg-orange-100 text-orange-700" :
      role === "admin" ? "bg-purple-100 text-purple-700" :
      "bg-gray-100 text-gray-600"
    }`}>
      {role || "employee"}
    </span>
  );

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading users...</div>;
  }

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1694CE]">User Management</h2>
          <span className="text-sm text-gray-500">Dashboard &gt; User Management</span>
        </div>
        <button
          onClick={() => { setFormData(resetFormData()); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={18} /> Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl shadow mb-6">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg w-full max-w-md">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              className="bg-transparent outline-none flex-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Emp ID</th>
                <th className="px-4 py-3 text-left">Job Title</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, index) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{u.first_name} {u.last_name || ""}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">{u.emp_id || "-"}</td>
                  <td className="px-4 py-3">{u.job_title || "-"}</td>
                  <td className="px-4 py-3">{getRoleBadge(u.role)}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(u.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {u.email?.toLowerCase() === "kk@achmecommunication.com" ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                          🔒 Primary Admin
                        </span>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleBan(u.id, u.status)} className={`p-2 rounded ${u.status === "banned" ? "text-green-600 hover:bg-green-50" : "text-orange-600 hover:bg-orange-50"}`} title={u.status === "banned" ? "Unban" : "Ban"}>
                            {u.status === "banned" ? <Unlock size={16} /> : <Ban size={16} />}
                          </button>
                          <button onClick={() => handleResetPassword(u.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded" title="Reset Password">
                            <Key size={16} />
                          </button>
                          <button onClick={() => handleDelete(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-500">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">Add New Employee</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">First Name *</label>
                  <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full border rounded-lg p-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                  <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full border rounded-lg p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full border rounded-lg p-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Password *</label>
                  <input type="password" value={formData.user_password} onChange={(e) => setFormData({ ...formData, user_password: e.target.value })} className="w-full border rounded-lg p-2" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Employee ID</label>
                  <input type="text" value={formData.emp_id} onChange={(e) => setFormData({ ...formData, emp_id: e.target.value })} className="w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Mobile Number</label>
                  <input type="text" value={formData.mobile_number} onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })} className="w-full border rounded-lg p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Job Title</label>
                  <input type="text" value={formData.job_title} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} placeholder="e.g. Sales Manager" className="w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Department / Role</label>
                  <input type="text" value={formData.emp_role} onChange={(e) => setFormData({ ...formData, emp_role: e.target.value })} placeholder="e.g. BDM, Admin, Service" className="w-full border rounded-lg p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">System Role</label>
                <select value={formData.system_role} onChange={(e) => setFormData({ ...formData, system_role: e.target.value })} className="w-full border rounded-lg p-2">
                  <option value="employee">Employee (Create/Read Only)</option>
                  <option value="subadmin">Sub-Admin (Full Access Except Users)</option>
                  {user?.role === "admin" && (
                    <option value="admin">Admin (Full Access)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                <textarea value={formData.emp_address} onChange={(e) => setFormData({ ...formData, emp_address: e.target.value })} className="w-full border rounded-lg p-2" rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Create Employee</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">Edit Employee</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">First Name *</label>
                  <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full border rounded-lg p-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                  <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full border rounded-lg p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full border rounded-lg p-2" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Employee ID</label>
                  <input type="text" value={formData.emp_id} onChange={(e) => setFormData({ ...formData, emp_id: e.target.value })} className="w-full border rounded-lg p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Job Title</label>
                  <input type="text" value={formData.job_title} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} placeholder="e.g. Sales Manager" className="w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Department / Role</label>
                  <input type="text" value={formData.emp_role} onChange={(e) => setFormData({ ...formData, emp_role: e.target.value })} placeholder="e.g. BDM, Admin, Service" className="w-full border rounded-lg p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Mobile Number</label>
                  <input type="text" value={formData.mobile_number} onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })} className="w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">System Role</label>
                  <select value={formData.system_role} onChange={(e) => setFormData({ ...formData, system_role: e.target.value })} className="w-full border rounded-lg p-2">
                    <option value="employee">Employee</option>
                    <option value="subadmin">Sub-Admin</option>
                    {user?.role === "admin" && (
                      <option value="admin">Admin</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                <textarea value={formData.emp_address} onChange={(e) => setFormData({ ...formData, emp_address: e.target.value })} className="w-full border rounded-lg p-2" rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Update Employee</button>
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;