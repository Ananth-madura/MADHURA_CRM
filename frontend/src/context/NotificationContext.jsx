import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { notificationSocket as notifSocket } from "../socket/socket";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config/api";
import {
  showPushNotification,
  isPushSupported,
  getPushPreference,
  requestPushPermission,
  savePushPreference,
  playNotificationSound,
} from "../utils/pushNotifications";
import { showInAppToast } from "../components/InAppToast";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

const normalizeNotif = (n, source) => ({
  ...n,
  message: n.message || n.description || n.data?.message || "",
  _source: source,
});

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  // Fetch initial notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const loadCached = () => {
      try {
        const cachedNotifs = localStorage.getItem("cached_notifications");
        const cachedAdminNotifs = localStorage.getItem(
          "cached_admin_notifications",
        );
        const cachedUnread = localStorage.getItem("cached_unread_count");
        const cachedAdminUnread = localStorage.getItem(
          "cached_admin_unread_count",
        );
        if (cachedNotifs) setNotifications(JSON.parse(cachedNotifs));
        if (cachedAdminNotifs)
          setAdminNotifications(JSON.parse(cachedAdminNotifs));
        if (cachedUnread) setUnreadCount(Number(cachedUnread) || 0);
        if (cachedAdminUnread)
          setAdminUnreadCount(Number(cachedAdminUnread) || 0);
      } catch (e) {
        console.error(e);
      }
    };

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [notifRes, countRes] = await Promise.all([
        axios.get(`${API}/api/notifications?limit=50`, { headers }),
        axios.get(`${API}/api/notifications/unread-count`, { headers }),
      ]);
      const empNotifs = (notifRes.data || []).map((n) =>
        normalizeNotif(n, "employee"),
      );
      const empUnread = countRes.data?.count || 0;
      setNotifications(empNotifs);
      setUnreadCount(empUnread);

      localStorage.setItem("cached_notifications", JSON.stringify(empNotifs));
      localStorage.setItem("cached_unread_count", String(empUnread));

      if (user.role === "admin") {
        const [adminRes, adminCountRes] = await Promise.all([
          axios.get(`${API}/api/notifications/admin?limit=50`, { headers }),
          axios.get(`${API}/api/notifications/admin/unread-count`, { headers }),
        ]);
        const adminNotifs = (adminRes.data || []).map((n) =>
          normalizeNotif(n, "admin"),
        );
        const adminUnread = adminCountRes.data?.count || 0;
        setAdminNotifications(adminNotifs);
        setAdminUnreadCount(adminUnread);

        localStorage.setItem(
          "cached_admin_notifications",
          JSON.stringify(adminNotifs),
        );
        localStorage.setItem("cached_admin_unread_count", String(adminUnread));
      }
    } catch (err) {
      console.error("Fetch notifications error, loading cache:", err);
      loadCached();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Instant offline/cached startup before network call resolves
    try {
      const cachedNotifs = localStorage.getItem("cached_notifications");
      const cachedAdminNotifs = localStorage.getItem(
        "cached_admin_notifications",
      );
      const cachedUnread = localStorage.getItem("cached_unread_count");
      const cachedAdminUnread = localStorage.getItem(
        "cached_admin_unread_count",
      );
      if (cachedNotifs) setNotifications(JSON.parse(cachedNotifs));
      if (cachedAdminNotifs)
        setAdminNotifications(JSON.parse(cachedAdminNotifs));
      if (cachedUnread) setUnreadCount(Number(cachedUnread) || 0);
      if (cachedAdminUnread)
        setAdminUnreadCount(Number(cachedAdminUnread) || 0);
    } catch (e) {
      console.error(e);
    }

    fetchNotifications();

    // Request push notification permission on first load
    if (
      isPushSupported() &&
      Notification.permission === "default" &&
      !getPushPreference()
    ) {
      requestPushPermission().then((granted) => {
        if (granted) savePushPreference(true);
      });
    }

    // Join appropriate notifSocket rooms based on role
    if (user.role === "admin") {
      notifSocket.emit("join_admin");
      notifSocket.emit("join", { userId: user.id, role: "admin" });
    } else {
      notifSocket.emit("join_notifications", user.id);
      notifSocket.emit("join", { userId: user.id, role: user.role });
    }

    // Listen for new notifications
    notifSocket.on("new_notification", (notification) => {
      const normalized = normalizeNotif(
        notification,
        user.role === "admin" ? "admin" : "employee",
      );
      const targetUserId =
        notification.data?.user_id || notification.data?.userId;

      // Employees: only see their own notifications
      if (user.role === "employee") {
        if (targetUserId && Number(targetUserId) !== Number(user.id)) return;
        setNotifications((prev) => {
          const exists = prev.some(
            (n) =>
              n.dbId === normalized.dbId ||
              (n.id === normalized.id && n._source === "employee"),
          );
          if (exists) return prev;
          return [normalized, ...prev].slice(0, 50);
        });
        setUnreadCount((prev) => prev + 1);
      }

      // Admins: add to both employee and admin arrays (deduped)
      if (user.role === "admin") {
        // Admin notifications always land here (from admin_notifications room)
        setAdminNotifications((prev) => {
          const exists = prev.some(
            (n) =>
              n.dbId === normalized.dbId ||
              (n.id === normalized.id && n._source === "admin"),
          );
          if (exists) return prev;
          return [normalized, ...prev].slice(0, 50);
        });
        setAdminUnreadCount((prev) => prev + 1);

        // Also add to employee array if it targets a specific user
        if (targetUserId) {
          setNotifications((prev) => {
            const exists = prev.some(
              (n) =>
                n.dbId === normalized.dbId ||
                (n.id === normalized.id && n._source === "employee"),
            );
            if (exists) return prev;
            return [normalized, ...prev].slice(0, 50);
          });
          setUnreadCount((prev) => prev + 1);
        }
      }

      // Show in-app toast push notification for ALL types
      const toastTitle =
        notification.data?.title || getPushTitle(notification.type);
      const toastBody =
        notification.data?.message || notification.message || "";
      showInAppToast(notification.type, toastBody.substring(0, 120), {
        title: toastTitle,
        subtitle: notification.data?.customerName
          ? `Client: ${notification.data.customerName}`
          : "",
        duration: notification.type === "reminder_due" ? 10000 : 6000,
        onClick: () => {
          window.location.href = "/dashboard/notifications";
        },
      });

      // Play pleasant audio chime
      playNotificationSound();

      // Also show browser push notification if supported & granted
      if (isPushSupported() && Notification.permission === "granted") {
        showPushNotification(toastTitle, {
          body: toastBody.substring(0, 150),
          tag:
            notification.type +
            "-" +
            (notification.id || notification.dbId || Date.now()),
          requireInteraction: true,
          onClick: () => {
            window.focus();
            window.location.href = "/dashboard/notifications";
          },
        });
      }
    });

    notifSocket.on("notification_read", ({ notificationId }) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.dbId === notificationId || n.id === notificationId
            ? { ...n, is_read: 1 }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setAdminNotifications((prev) =>
        prev.map((n) =>
          n.dbId === notificationId || n.id === notificationId
            ? { ...n, is_read: 1 }
            : n,
        ),
      );
      setAdminUnreadCount((prev) => Math.max(0, prev - 1));
    });

    return () => {
      notifSocket.off("new_notification");
      notifSocket.off("notification_read");
    };
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    notifSocket.emit("mark_read", notificationId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.dbId === notificationId || n.id === notificationId
          ? { ...n, is_read: 1 }
          : n,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    const token = localStorage.getItem("token");
    if (token) {
      try {
        await axios.put(
          `${API}/api/notifications/${notificationId}/read`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (e) {
        /* non-critical */
      }
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    [...notifications, ...adminNotifications].forEach((n) => {
      if (!n.is_read) notifSocket.emit("mark_read", n.dbId || n.id);
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setAdminNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
    setAdminUnreadCount(0);

    const token = localStorage.getItem("token");
    if (token) {
      try {
        await axios.put(
          `${API}/api/notifications/read-all`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (e) {
        /* non-critical */
      }
    }
  }, [notifications, adminNotifications]);

  const markAdminAsRead = useCallback(async (notificationId) => {
    setAdminNotifications((prev) =>
      prev.map((n) =>
        n.dbId === notificationId || n.id === notificationId
          ? { ...n, is_read: 1 }
          : n,
      ),
    );
    setAdminUnreadCount((prev) => Math.max(0, prev - 1));

    const token = localStorage.getItem("token");
    if (token) {
      try {
        await axios.put(
          `${API}/api/notifications/admin/${notificationId}/read`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (e) {
        /* non-critical */
      }
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const archiveNotification = useCallback(async (notificationId) => {
    setNotifications((prev) =>
      prev.filter((n) => n.dbId !== notificationId && n.id !== notificationId),
    );
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await axios.put(
          `${API}/api/notifications/${notificationId}/archive`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (e) {
        /* non-critical */
      }
    }
  }, []);

  const unarchiveNotification = useCallback(
    async (notificationId) => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          await axios.put(
            `${API}/api/notifications/${notificationId}/unarchive`,
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          fetchNotifications();
        } catch (e) {
          /* non-critical */
        }
      }
    },
    [fetchNotifications],
  );

  const deleteNotification = useCallback(async (notificationId) => {
    setNotifications((prev) =>
      prev.filter((n) => n.dbId !== notificationId && n.id !== notificationId),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await axios.delete(`${API}/api/notifications/${notificationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        /* non-critical */
      }
    }
  }, []);

  const archiveAdminNotification = useCallback(async (notificationId) => {
    setAdminNotifications((prev) =>
      prev.filter((n) => n.dbId !== notificationId && n.id !== notificationId),
    );
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await axios.put(
          `${API}/api/notifications/admin/${notificationId}/archive`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (e) {
        /* non-critical */
      }
    }
  }, []);

  const unarchiveAdminNotification = useCallback(
    async (notificationId) => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          await axios.put(
            `${API}/api/notifications/admin/${notificationId}/unarchive`,
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          fetchNotifications();
        } catch (e) {
          /* non-critical */
        }
      }
    },
    [fetchNotifications],
  );

  const deleteAdminNotification = useCallback(async (notificationId) => {
    setAdminNotifications((prev) =>
      prev.filter((n) => n.dbId !== notificationId && n.id !== notificationId),
    );
    setAdminUnreadCount((prev) => Math.max(0, prev - 1));
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await axios.delete(`${API}/api/notifications/admin/${notificationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        /* non-critical */
      }
    }
  }, []);

  const getNotificationIcon = (type) => {
    switch (type) {
      case "missed_reminder_alert":
        return "⚠️";
      case "target_completed":
        return "🎉";
      case "new_target":
        return "🎯";
      case "target_updated":
        return "📈";
      case "target_achieved":
        return "🏆";
      case "task_assigned":
        return "📋";
      case "task_assigned_to_employee":
        return "📋";
      case "task_completed":
        return "✅";
      case "task_completed_by_employee":
        return "✅";
      case "task_updated":
        return "🔄";
      case "task_not_completed":
        return "⏰";
      case "task_overdue":
        return "⏰";
      case "task_overdue_warning":
        return "⚠️";
      case "daily_task_summary":
        return "📊";
      case "new_lead":
        return "📞";
      case "lead_converted":
        return "🎉";
      case "lead_updated":
        return "✏️";
      case "missed_calls":
        return "⚠️";
      case "escalation_created":
        return "🚨";
      case "escalation_resolved":
        return "✅";
      case "contract_created":
        return "📝";
      case "proposal_created":
        return "📄";
      case "service_created":
        return "🔧";
      case "lead_missed_reminder":
        return "⏰";
      case "reminder_due":
        return "⏰";
      default:
        return "🔔";
    }
  };

  const getPushTitle = (type) => {
    switch (type) {
      case "missed_reminder_alert":
        return "⚠️ Missed Reminder Alert";
      case "target_completed":
        return "🎉 Target Completed!";
      case "lead_converted":
        return "🎉 Lead Converted to Client";
      case "lead_missed_reminder":
        return "⚠️ Lead Missed 3+ Reminders";
      case "task_completed":
        return "✅ Task Completed";
      case "task_completed_by_employee":
        return "✅ Task Completed";
      case "target_achieved":
        return "🏆 Target Achieved";
      case "target_updated":
        return "📈 Target Updated";
      case "task_not_completed":
        return "⏰ Task Not Completed";
      case "missed_calls":
        return "⚠️ Missed Calls Alert";
      case "reminder_due":
        return "⏰ Reminder Due Soon";
      case "new_target":
        return "🎯 New Target Assigned";
      case "task_assigned":
        return "📋 New Task Assigned";
      default:
        return "🔔 New Notification";
    }
  };

  const getNotificationColor = (type) => {
    if (type === "missed_reminder_alert")
      return "border-l-orange-500 bg-orange-50";
    if (type === "target_completed") return "border-l-green-500 bg-green-50";
    if (
      [
        "missed_calls",
        "task_not_completed",
        "task_overdue",
        "escalation_created",
      ].includes(type)
    )
      return "border-l-red-500 bg-red-50";
    if (type === "task_overdue_warning")
      return "border-l-orange-500 bg-orange-50";
    if (
      [
        "target_achieved",
        "lead_converted",
        "task_completed",
        "task_completed_by_employee",
        "escalation_resolved",
      ].includes(type)
    )
      return "border-l-green-500 bg-green-50";
    if (
      [
        "new_lead",
        "proposal_created",
        "contract_created",
        "task_assigned",
        "task_assigned_to_employee",
      ].includes(type)
    )
      return "border-l-blue-500 bg-blue-50";
    if (type === "daily_task_summary")
      return "border-l-purple-500 bg-purple-50";
    return "border-l-yellow-500 bg-yellow-50";
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        adminNotifications,
        unreadCount,
        adminUnreadCount,
        showPanel,
        setShowPanel,
        markAsRead,
        markAllAsRead,
        markAdminAsRead,
        clearNotifications,
        archiveNotification,
        unarchiveNotification,
        deleteNotification,
        archiveAdminNotification,
        unarchiveAdminNotification,
        deleteAdminNotification,
        getNotificationIcon,
        getNotificationColor,
        refreshNotifications: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
