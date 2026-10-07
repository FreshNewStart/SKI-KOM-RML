import { withBase } from "./config";

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

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("organisation");

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("organisation");

  window.location.href = withBase("/login");
}
