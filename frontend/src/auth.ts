
export type AdminUser = {
  email: string;
  authenticated: boolean;
};

type CsrfToken = {
  headerName: string;
  parameterName: string;
  token: string;
};

export const SESSION_EXPIRED_EVENT = "marketflow:session-expired";

function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

async function request(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    return await fetch(url, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    throw new Error(
      "Unable to connect to MarketFlow backend. Check that the server is running."
    );
  }
}

export async function getCsrfToken(): Promise<CsrfToken> {
  const response = await request("/api/auth/csrf");

  if (!response.ok) {
    throw new Error("Unable to obtain security token.");
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !("headerName" in data) ||
    !("token" in data) ||
    !("parameterName" in data) ||
    typeof data.headerName !== "string" ||
    typeof data.token !== "string" ||
    typeof data.parameterName !== "string" ||
    !data.headerName ||
    !data.token
  ) {
    throw new Error("Invalid security token response.");
  }

  return data as CsrfToken;
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  const response = await request("/api/auth/me", {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to verify administrator session.");
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !("authenticated" in data) ||
    !("email" in data) ||
    typeof data.authenticated !== "boolean" ||
    typeof data.email !== "string"
  ) {
    throw new Error("Invalid administrator session response.");
  }

  return data as AdminUser;
}

export async function login(
  email: string,
  password: string
): Promise<void> {
  const csrf = await getCsrfToken();

  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);

  const response = await request("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      [csrf.headerName]: csrf.token,
    },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Incorrect administrator email or password."
        : "Unable to sign in."
    );
  }
}

export async function logout(): Promise<void> {
  const csrf = await getCsrfToken();

  const response = await request("/logout", {
    method: "POST",
    headers: {
      [csrf.headerName]: csrf.token,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to sign out.");
  }
}

export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    const csrf = await getCsrfToken();
    headers.set(csrf.headerName, csrf.token);
  }

  const response = await request(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    notifySessionExpired();
  }

  return response;
}
