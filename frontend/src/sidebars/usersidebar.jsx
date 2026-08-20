import React, { useState } from "react";
import {
  Home,
  Users,
  ListTodo,
  Phone,
  FileText,
  Headphones,
  TargetIcon,
  Settings,
  User,
  ChevronDown,
  ShoppingCart,
  Wrench,
  ShieldCheck,
  Bell,
  MessageCircle,
  BarChart3,
  Send
} from "lucide-react";
import "../Styles/tailwind.css"
import { Link } from "react-router-dom";


const UserSidebar = ({ onNavigate, collapsed, onExpand }) => {
  const [openMenu, setOpenMenu] = useState(null);

  const menu = [
    { icon: <Home size={20} />, title: "Dashboard", path: "/dashboard" },
    { icon: <Bell size={20} />, title: "Notifications", path: "/dashboard/notifications" },
    {
      icon: <Wrench size={20} />, title: "Services", subitems: [
        { label: "Products", path: "/dashboard/products" },
        { label: "Service Estimation", path: "/dashboard/serviceestimation" },
        { label: "Call Report", path: "/dashboard/call-report" }
      ]
    },
    {
      icon: <Phone size={20} />, title: "Leads",
      subitems: [
        { label: "Telecalling", path: "/dashboard/telecalling" },
        { label: "Walkins", path: "/dashboard/walkins" },
        { label: "Field Work", path: "/dashboard/field" },
      ]
    },
    {
      icon: <ShoppingCart size={20} />, title: "Sales", subitems: [
        // { label: "Estimation", path: "/dashboard/estimateinvoice" },
        { label: "Proforma Invoice", path: "/dashboard/performainvoice" },
      ]
    },
    { icon: <FileText size={20} />, title: "Proposals", path: "/dashboard/proposal" },
    { icon: <FileText size={20} />, title: "Contracts", subitems: [{ label: "Contracts", path: "/dashboard/amc" }] },
    {
      icon: <Users size={20} />, title: "Customers", subitems: [
        { label: "Clients", path: "/dashboard/clients" }
      ]
    },
    { icon: <ListTodo size={20} />, title: "Tasks", path: "/dashboard/task" },
    {
      icon: <MessageCircle size={20} />, title: "WhatsApp CRM",
      subitems: [
        { label: "Live Inbox", path: "/dashboard/whatsapp" },
        { label: "Contacts", path: "/dashboard/whatsapp/contacts" },
        { label: "Templates", path: "/dashboard/whatsapp/templates" },
        { label: "Contact Groups", path: "/dashboard/whatsapp/groups" },
        { label: "Broadcast Campaigns", path: "/dashboard/whatsapp/campaigns" },
        { label: "Automations", path: "/dashboard/whatsapp/automations" },
        { label: "Chatbot Flows", path: "/dashboard/whatsapp/flows" },
        { label: "Analytics", path: "/dashboard/whatsapp/analytics" },
        { label: "Accounts & Settings", path: "/dashboard/whatsapp/accounts" },
      ]
    },
    // { icon: <TargetIcon size={20} />, title: "Targets", path: "/dashboard/targets" },
    // { icon: <User size={20} />, title: "Profile", path: "/dashboard/profile" },
    // { icon: <Settings size={20} />, title: "Settings", path: "/dashboard/settings" }
  ];

  const handleMenuClick = (i) => {
    if (collapsed) {
      if (onExpand) onExpand();
      setOpenMenu(i);
    } else {
      setOpenMenu(openMenu === i ? null : i);
    }
  };

  return (
    <aside className={`side-mainbar bg-canvas ${collapsed ? "px-1" : "pl-[10px]"}`}>
      <ul className="space-y-1">
        {menu.map((item, i) => (
          <li key={i}>

            {/* MAIN ITEM → With direct path (Dashboard) */}
            {item.path ? (
              <Link
                to={item.path}
                onClick={onNavigate}
                className={`sidebar-item flex items-center ${collapsed ? "justify-center px-1" : "gap-3 px-3"} py-2 rounded-lg transition-all duration-200 text-ink`}
                title={collapsed ? item.title : ""}
              >
                <div className="relative flex items-center justify-center">
                  {item.icon}
                  {collapsed && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                {!collapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-medium">{item.title}</span>
                    {item.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ) : (
              <>
                {/* MAIN ITEM → With sub menu (Projects, Sales, etc.) */}
                <button
                  onClick={() => handleMenuClick(i)}
                  className={`w-full flex items-center ${collapsed ? "justify-center px-1" : "justify-between px-3"} py-2 text-ink hover:text-primary transition-all duration-200`}
                  title={collapsed ? item.title : ""}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      {item.icon}
                    </div>
                    {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                  </div>

                  {!collapsed && item.subitems && (
                    <ChevronDown
                      size={18}
                      className={`${openMenu === i ? "rotate-180" : ""} transition text-slate`}
                    />
                  )}
                </button>

                {/* SUBMENU */}
                {!collapsed && openMenu === i && item.subitems && (
                  <ul className="ml-9 mt-1 space-y-1">
                    {item.subitems.map((s, j) => (
                      <li key={j}>
                        <Link
                          to={s.path}
                          onClick={onNavigate}
                          className="text-sm text-slate hover:text-primary block submenu"
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

          </li>
        ))}
      </ul>
    </aside>

  );
};

export default UserSidebar;
