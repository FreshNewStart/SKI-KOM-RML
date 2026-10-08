import { withBase } from "./config";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_ACTIVITY_KEY = "auth.lastActivity";
const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;

export function getAuth() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  const userStorage =
    localStorage.getItem("user") ||
    sessionStorage.getItem("user");

  const organisationStorage =
    localStorage.getItem("organisation") ||
    sessionStorage.getItem("organisation");

  let user = null;
  let organisation = null;

  if (userStorage) {
    try {
      user = JSON.parse(userStorage);
    } catch {
      user = null;
    }
  }

  if (organisationStorage) {
    try {
      organisation = JSON.parse(organisationStorage);
    } catch {
      organisation = organisationStorage;
    }
  }

  return {
    token,
    user,
    organisation,
    isAuthenticated: !!token,
  };
}

export function getAuthHeaders() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function hasActiveSession() {
  if (!getAuth().isAuthenticated) {
    return false;
  }

  let lastActivity = Number(localStorage.getItem(IDLE_ACTIVITY_KEY));

  if (!Number.isFinite(lastActivity) || lastActivity <= 0) {
    lastActivity = Date.now();
    localStorage.setItem(IDLE_ACTIVITY_KEY, String(lastActivity));
  }

  if (lastActivity > Date.now()) {
    lastActivity = Date.now();
    localStorage.setItem(IDLE_ACTIVITY_KEY, String(lastActivity));
  }

  return Date.now() - lastActivity < IDLE_TIMEOUT_MS;
}

export function logout() {
  localStorage.removeItem(IDLE_ACTIVITY_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("organisation");

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("organisation");

  window.location.href = withBase("/login");
}

export function startIdleLogout() {
  let lastActivity = Number(localStorage.getItem(IDLE_ACTIVITY_KEY));
  let timer;
  let lastActivityWrite = 0;

  if (!Number.isFinite(lastActivity) || lastActivity <= 0) {
    lastActivity = Date.now();
    localStorage.setItem(IDLE_ACTIVITY_KEY, String(lastActivity));
  }

  const checkIdleTime = () => {
    const storedActivity = Number(localStorage.getItem(IDLE_ACTIVITY_KEY));

    if (
      !Number.isFinite(storedActivity) ||
      storedActivity <= 0 ||
      Date.now() - storedActivity >= IDLE_TIMEOUT_MS
    ) {
      logout();
      return;
    }

    lastActivity = storedActivity;
    clearTimeout(timer);
    timer = window.setTimeout(
      checkIdleTime,
      IDLE_TIMEOUT_MS - (Date.now() - lastActivity)
    );
  };

  const recordActivity = () => {
    const now = Date.now();

    if (now - lastActivityWrite >= ACTIVITY_WRITE_INTERVAL_MS) {
      lastActivity = now;
      lastActivityWrite = now;
      localStorage.setItem(IDLE_ACTIVITY_KEY, String(now));
    }
  };

  const onStorageChange = (event) => {
    if (event.key === IDLE_ACTIVITY_KEY) {
      if (!event.newValue) {
        logout();
        return;
      }

      lastActivity = Number(event.newValue);
      checkIdleTime();
    }

    if (event.key === "token" && !event.newValue) {
      logout();
    }
  };

  const activityEvents = [
    "pointerdown",
    "keydown",
    "scroll",
    "touchstart",
  ];

  activityEvents.forEach((eventName) => {
    document.addEventListener(eventName, recordActivity, { passive: true });
  });

  document.addEventListener("visibilitychange", checkIdleTime);
  window.addEventListener("focus", checkIdleTime);
  window.addEventListener("storage", onStorageChange);
  checkIdleTime();
}
