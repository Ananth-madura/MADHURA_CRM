const PUSH_NOTIFICATIONS_KEY = "pushNotificationsEnabled";

export const isPushSupported = () => {
  return "Notification" in window;
};

export const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    const playTone = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + duration);
    };
    
    // Pleasant dual-tone chime
    playTone(523.25, now, 0.3); // C5
    playTone(659.25, now + 0.08, 0.4); // E5
  } catch (e) {
    console.warn("AudioContext playback blocked or failed:", e);
  }
};

export const requestPushPermission = async () => {
  if (!isPushSupported()) return false;
  
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
};

export const getPushPermissionStatus = () => {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
};

export const showPushNotification = (title, options = {}) => {
  if (!isPushSupported() || Notification.permission !== "granted") return null;
  
  const notification = new Notification(title, {
    icon: "/Madhura-logo.png",
    badge: "/Madhura-logo.png",
    tag: options.tag || "app-notification",
    renotify: true,
    ...options
  });
  
  notification.onclick = () => {
    window.focus();
    notification.close();
    if (options.onClick) options.onClick();
  };
  
  return notification;
};

export const savePushPreference = (enabled) => {
  localStorage.setItem(PUSH_NOTIFICATIONS_KEY, enabled ? "true" : "false");
};

export const getPushPreference = () => {
  return localStorage.getItem(PUSH_NOTIFICATIONS_KEY) === "true";
};