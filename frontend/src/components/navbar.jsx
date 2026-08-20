import React, { useState, useEffect, useRef } from "react";
import {
  Menu,
  Search,
  User,
  Lock,
  LogOut
} from "lucide-react";
import "../Styles/tailwind.css";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import backheadImage from "../layout/Madhura-logo.png";

const Topbar = ({ onHamburgerClick, showSearch, onSearch, reminderData, reminderNotes, escalationCount = 0, escalations = [] }) => {
  const [openProfile, setOpenProfile] = useState(false);
  const profileRef = useRef(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setOpenProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <header className="flex items-center justify-between px-3 md:px-6 h-[68px] z-50 bg-shell text-shell-text">
      {/* Left: hamburger + brand */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          className="text-gray-600 p-2 cursor-pointer hover:bg-gray-100 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={onHamburgerClick}
          aria-label="Toggle sidebar"
        >
          <Menu size={22} />
        </button>
        <img
          src={backheadImage}
          alt="Madhura Softwares"
          className="object-contain"
          style={{ height: "47px", width: "auto", maxWidth: "190px" }}
        />
      </div>

      {/* Search bar - only on Dashboard */}
      {showSearch && (
        <div className="hidden sm:flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search dashboard..."
            className="bg-transparent outline-none text-sm w-32 md:w-48"
            value={searchValue}
            onChange={handleSearchChange}
          />
        </div>
      )}

      {/* User profile */}
      <div ref={profileRef} className="flex items-center gap-2 border-l pl-2 md:pl-4 relative">
        <div
          onClick={() => setOpenProfile(!openProfile)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <User size={18} />
          </div>
          <span className="hidden sm:block text-sm text-primary-text">
            {user?.name || "Customer"}
          </span>
        </div>

        {openProfile && (
          <div className="absolute right-[-20px] top-12 w-52 bg-white shadow-lg rounded-lg border z-50 animate-doorOpen">
            <div className="px-4 py-3 border-b">
              <p className="font-semibold text-gray-800">{user?.name || "Customer"}</p>
              <p className="text-xs text-gray-500">{user?.email || "info@email.com"}</p>
            </div>
            <ul className="py-2 text-sm text-primary-text">
              <li onClick={() => { navigate("/dashboard/profile"); setOpenProfile(false); }} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 cursor-pointer">
                <User size={16} /> My Profile
              </li>
              <li onClick={() => { navigate("/dashboard/profile"); setOpenProfile(false); }} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 cursor-pointer">
                <Lock size={16} /> Change Password
              </li>
              <hr />
              <li
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <LogOut size={16} /> Logout
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
