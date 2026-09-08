import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastProvider, useToast } from "./components/Toast";
import { InAppToastContainer } from "./components/InAppToast";
import ReminderPopup from "./components/ReminderPopup";
import EnableNotificationsBanner from "./components/EnableNotificationsBanner";
import { useEffect } from "react";
import axios from "axios";
import Login from "./auth/login";
import LoginAdmin from "./auth/LoginAdmin";
import Register from "./auth/register";
import DashboardLayout from "./layout/dashboarlayout";
import AdminDashboard from "./dashboards/admindashboard";
import UserDashboard from "./dashboards/userdashboard";
import Telecall from "./pages/telecalling";
import Walkins from "./pages/walkins";
import Fields from "./pages/field";
import Proposals from "./pages/proposal";
import Quotation from "./pages/quotation";
import Task from "./pages/task";
import Targets from "./pages/target";
import Invoicepage from "./pages/invoice";
import Payments from "./pages/payment";
import Estimate from "./pages/estimate";
import EstimateInvoice from "./pages/estimateinvoice";
import ServiceEstimation from "./pages/serviceestimation";
import CallReport from "./pages/callreport";
import Contracts from "./pages/contract";
import Team from "./pages/teammember";
import Products from "./pages/products";
import FollowupList from "./components/followuplist";
import Clients from "./pages/clients";
import PerformaInvoice from "./pages/performainvoice";
import Reports from "./pages/reports";
import InvoicePreview from "./pages/invoicepreview";
import Notifications from "./pages/notifications";
import AMCService from "./pages/amc";
import WhatsAppPage from "./pages/whatsapp";
import WATemplates from "./pages/whatsappTemplates";
import WAGroups from "./pages/whatsappGroups";
import WACampaigns from "./pages/whatsappCampaigns";
import WAAnalytics from "./pages/whatsappAnalytics";
import WAContacts from "./pages/whatsappContacts";
import WAAutomations from "./pages/whatsappAutomations";
import WAFlows from "./pages/whatsappFlows";
import WAAccounts from "./pages/whatsappAccounts";
import WAReminders from "./pages/whatsappReminders";
import Profile from "./pages/profile";
import Settings from "./pages/settings";
import UserManagement from "./pages/usermanagement";
import InstallPrompt from "./components/InstallPrompt";
import PwaManager from "./components/PwaManager";
import NetworkSetupBanner from "./components/NetworkSetupBanner";
import { Agentation } from "agentation";

const getApiBackend = () => {
  if (typeof window !== "undefined" && window.location.port !== "3000") {
    return window.location.origin;
  }
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5000`;
};

const API_BACKEND = getApiBackend();

axios.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => Promise.reject(error));
const CHECK_INTERVAL_ONLINE = 2 * 60 * 60 * 1000; // 2 hours when online
const CHECK_INTERVAL_OFFLINE = 5 * 60 * 1000; // 5 minutes when offline
let lastConnectionStatus = null;
let checkIntervalId = null;

function DBConnectionChecker() {
  const { error, info } = useToast();

  useEffect(() => {
    const checkConnection = async () => {
      const timeout = 3000;
      let connected = false;
      let connectedViaProxy = false;

      try {
        await axios.get(`${API_BACKEND}/api/health`, { timeout });
        connected = true;
      } catch (err) {
        try {
          await axios.get("/api/health", { timeout });
          connectedViaProxy = true;
        } catch (err2) {
          connected = false;
        }
      }

      if (connected || connectedViaProxy) {
        if (lastConnectionStatus === false || lastConnectionStatus === null) {
          info(connectedViaProxy ? "Server connected (via proxy)" : "Server connected");
        }
        lastConnectionStatus = true;
      } else {
        if (lastConnectionStatus !== false) {
          error("Cannot connect to server! Start backend on port 5000");
        }
        lastConnectionStatus = false;
      }

      // Reset interval based on connection status
      if (checkIntervalId) clearInterval(checkIntervalId);
      const intervalTime = lastConnectionStatus ? CHECK_INTERVAL_ONLINE : CHECK_INTERVAL_OFFLINE;
      checkIntervalId = setInterval(checkConnection, intervalTime);
    };

    checkConnection();
    return () => {
      if (checkIntervalId) clearInterval(checkIntervalId);
    };
  }, []);

  return null;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return user.role === "admin" ? <AdminDashboard /> : <UserDashboard />;
}

function ProtectedFlowBuilder() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return <WAFlows />;
}

function FlowParamRedirect() {
  const { flowId } = useParams();
  return <Navigate to={flowId ? `/dashboard/whatsapp/flows/build/${flowId}` : "/dashboard/whatsapp/flows/build"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastProvider>
          <InAppToastContainer />
          <ReminderPopup />
          <EnableNotificationsBanner />
          <DBConnectionChecker />
          <NetworkSetupBanner />
          <InstallPrompt />
          <PwaManager />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/login/admin" element={<LoginAdmin />} />
              <Route path="/register" element={<Register />} />
              <Route path="/invoice-preview/:type/:id" element={<InvoicePreview />} />
              <Route path="/flows" element={<Navigate to="/dashboard/whatsapp/flows" replace />} />
              <Route path="/flows/build" element={<Navigate to="/dashboard/whatsapp/flows/build" replace />} />
              <Route path="/flows/build/:flowId" element={<FlowParamRedirect />} />
              <Route path="/flows/builder" element={<Navigate to="/dashboard/whatsapp/flows/build" replace />} />
              <Route path="/flows/builder/:flowId" element={<FlowParamRedirect />} />
              <Route path="/notification" element={<Navigate to="/dashboard/notifications" replace />} />
              <Route path="/notifications" element={<Navigate to="/dashboard/notifications" replace />} />
              <Route path="/dashboard/notification" element={<Navigate to="/dashboard/notifications" replace />} />
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<DashboardRouter />} />
                <Route path="telecalling" element={<Telecall />} />
                <Route path="walkins" element={<Walkins />} />
                <Route path="field" element={<Fields />} />
                <Route path="products" element={<Products />} />
                <Route path="proposal" element={<Proposals />} />
                <Route path="quotation" element={<Quotation />} />
                <Route path="task" element={<Task />} />
                <Route path="invoice" element={<Invoicepage />} />
                <Route path="payments" element={<Payments />} />
                <Route path="estimates" element={<Estimate />} />
                <Route path="contracts" element={<Contracts />} />
                <Route path="team" element={<Team />} />
                <Route path="followupslist" element={<FollowupList />} />
                <Route path="clients" element={<Clients />} />
                <Route path="performainvoice" element={<PerformaInvoice />} />
                <Route path="estimateinvoice" element={<EstimateInvoice />} />
                <Route path="serviceestimation" element={<ServiceEstimation />} />
                <Route path="call-report" element={<CallReport />} />
                <Route path="reports" element={<Reports />} />
                <Route path="targets" element={<Targets />} />
                <Route path="amc" element={<AMCService />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="notification" element={<Navigate to="/dashboard/notifications" replace />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="whatsapp" element={<WhatsAppPage />} />
                <Route path="whatsapp/contacts" element={<WAContacts />} />
                <Route path="whatsapp/templates" element={<WATemplates />} />
                <Route path="whatsapp/groups" element={<WAGroups />} />
                <Route path="whatsapp/campaigns" element={<WACampaigns />} />
                <Route path="whatsapp/automations" element={<WAAutomations />} />
                <Route path="whatsapp/flows" element={<WAFlows />} />
                <Route path="whatsapp/flows/build" element={<WAFlows />} />
                <Route path="whatsapp/flows/build/:flowId" element={<WAFlows />} />
                <Route path="whatsapp/flows/builder" element={<WAFlows />} />
                <Route path="whatsapp/flows/builder/:flowId" element={<WAFlows />} />
                <Route path="whatsapp/analytics" element={<WAAnalytics />} />
                <Route path="whatsapp/accounts" element={<WAAccounts />} />
                <Route path="whatsapp/reminders" element={<WAReminders />} />
              </Route>
            </Routes>
          </BrowserRouter>
          {process.env.NODE_ENV === "development" && <Agentation />}
        </ToastProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}