const AVATAR_COLORS = [
  "#5B8DEF",
  "#F97316",
  "#10B981",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
  "#F59E0B",
  "#EF4444",
];

const PRESENCE_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const PRESENCE_ONLINE_GRACE_MS = 5 * 60 * 1000;

export const getInitials = (name = "", email = "") => {
  const source = name.trim() || email.trim() || "User";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

export const getAvatarColor = (seed = "") => {
  const source = seed || "default";
  const hash = source
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const getConversationPreview = (user) => {
  const previews = [
    "Vua gui mot sticker",
    "Toi nay minh goi nhe",
    "Da xem tin nhan cua ban",
    "Hen gap luc 7:30 nha",
    "Minh dang tren duong roi",
  ];

  const seed = user?.uid || user?.email || user?.name || "preview";
  const hash = seed
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return previews[hash % previews.length];
};

export const toDateValue = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate();
  }

  if (timestamp instanceof Date) {
    return timestamp;
  }

  return null;
};

const getElapsedMinutes = (date, now) =>
  Math.max(1, Math.floor((now - date.getTime()) / (60 * 1000)));

export const isUserOnline = (user, now = Date.now()) => {
  if (!user?.online) {
    return false;
  }

  const lastActive = toDateValue(user.lastActive);
  if (!lastActive) {
    return true;
  }

  return now - lastActive.getTime() <= PRESENCE_ACTIVE_WINDOW_MS;
};

export const getStatusLabel = (user, now = Date.now()) => {
  const lastActive = toDateValue(user?.lastActive);

  if (isUserOnline(user, now)) {
    return "Dang hoat dong";
  }

  if (user?.online && lastActive) {
    const elapsedMs = now - lastActive.getTime();
    if (elapsedMs <= PRESENCE_ONLINE_GRACE_MS) {
      return "Online";
    }
  }

  if (!lastActive) {
    return "Offline";
  }

  const elapsedMinutes = getElapsedMinutes(lastActive, now);
  if (elapsedMinutes < 60) {
    return `Hoat dong ${elapsedMinutes} phut truoc`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Hoat dong ${elapsedHours} gio truoc`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Hoat dong ${elapsedDays} ngay truoc`;
};

export const formatMessageTime = (timestamp) => {
  const date = toDateValue(timestamp);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};
