
import { useEffect, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import {
  getCurrentUser,
  login,
  logout,
  SESSION_EXPIRED_EVENT,
} from "./auth";
import "./AuthGate.css";

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({
  children,
}: AuthGateProps) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((user) => {
        if (!active) return;

        setAuthenticated(Boolean(user?.authenticated));
        setAdminEmail(user?.email ?? "");
      })
      .catch(() => {
        if (active) {
          setError(
            "Unable to connect to MarketFlow backend."
          );
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      setAuthenticated(false);
      setAdminEmail("");
      setPassword("");
      setShowPassword(false);
      setBusy(false);
      setChecking(false);
      setError(
        "Your administrator session has expired. Please sign in again."
      );
    }

    window.addEventListener(
      SESSION_EXPIRED_EVENT,
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        SESSION_EXPIRED_EVENT,
        handleSessionExpired
      );
    };
  }, []);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await login(email.trim(), password);

      const user = await getCurrentUser();

      if (!user?.authenticated) {
        throw new Error(
          "Unable to verify administrator session."
        );
      }

      setAdminEmail(user.email);
      setPassword("");
      setShowPassword(false);
      setAuthenticated(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await logout();

      const user = await getCurrentUser();

      if (user?.authenticated) {
        throw new Error(
          "The administrator session is still active."
        );
      }

      setAuthenticated(false);
      setAdminEmail("");
      setPassword("");
      setEmail("");
      setShowPassword(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Logout failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="mf-loading-screen">
        <div className="mf-loading-logo">M</div>
        <div className="mf-spinner" />
        <h2>MarketFlow</h2>
        <p>Preparing your workspace...</p>
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="mf-authenticated">
        <div className="mf-admin-bar">
          <div className="mf-admin-bar-brand">
            <span className="mf-admin-brand-icon">M</span>
            <span>MarketFlow Workspace</span>
          </div>

          <div className="mf-admin-actions">
            <div className="mf-admin-profile">
              <span className="mf-admin-avatar">
                {adminEmail.charAt(0).toUpperCase() || "A"}
              </span>

              <div className="mf-admin-details">
                <strong>Administrator</strong>
                <small>{adminEmail}</small>
              </div>
            </div>

            <button
              className="mf-logout-button"
              type="button"
              onClick={() => void handleLogout()}
              disabled={busy}
            >
              {busy ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mf-session-error" role="alert">
            {error}
          </div>
        )}

        {children}
      </div>
    );
  }

  return (
    <div className="mf-login-page">
      <div className="mf-login-shell">
        <section className="mf-brand-panel">
          <div className="mf-brand-heading">
            <div className="mf-brand-logo">M</div>
            <span>MarketFlow</span>
          </div>

          <div className="mf-brand-content">
            <span className="mf-brand-eyebrow">
              YOUR MARKETING WORKSPACE
            </span>

            <h1>
              Manage your marketing.
              <span> All in one place.</span>
            </h1>

            <p>
              Plan content, organize your social media
              posts, and manage your publishing workflow
              from one powerful dashboard.
            </p>

            <div className="mf-brand-features">
              <div className="mf-brand-feature">
                <span className="mf-feature-icon">✓</span>
                <span>Organize your content</span>
              </div>

              <div className="mf-brand-feature">
                <span className="mf-feature-icon">✓</span>
                <span>Manage your post schedule</span>
              </div>

              <div className="mf-brand-feature">
                <span className="mf-feature-icon">✓</span>
                <span>Track your publishing workflow</span>
              </div>
            </div>
          </div>

          <div className="mf-brand-footer">
            MarketFlow · Marketing Management Platform
          </div>

          <div className="mf-brand-orb mf-brand-orb-one" />
          <div className="mf-brand-orb mf-brand-orb-two" />
        </section>

        <section className="mf-form-panel">
          <div className="mf-form-content">
            <div className="mf-mobile-brand">
              <span className="mf-brand-logo">M</span>
              <strong>MarketFlow</strong>
            </div>

            <div className="mf-welcome-icon">✦</div>

            <div className="mf-form-heading">
              <span className="mf-form-eyebrow">
                ADMINISTRATOR ACCESS
              </span>
              <h2>Welcome back</h2>
              <p>
                Sign in to continue to your MarketFlow
                workspace.
              </p>
            </div>

            <form onSubmit={(event) => void handleLogin(event)}>
              <div className="mf-field">
                <label htmlFor="admin-email">
                  Email address
                </label>

                <input
                  id="admin-email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  autoComplete="username"
                  disabled={busy}
                />
              </div>

              <div className="mf-field">
                <label htmlFor="admin-password">
                  Password
                </label>

                <div className="mf-password-wrapper">
                  <input
                    id="admin-password"
                    type={
                      showPassword ? "text" : "password"
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    required
                    autoComplete="current-password"
                    disabled={busy}
                  />

                  <button
                    type="button"
                    className="mf-password-toggle"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="mf-login-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                className="mf-login-button"
                type="submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="mf-button-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to MarketFlow
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="mf-form-security">
              <span aria-hidden="true">◆</span>
              Protected administrator workspace
            </div>
          </div>

          <div className="mf-form-footer">
            © 2026 MarketFlow. All rights reserved.
          </div>
        </section>
      </div>
    </div>
  );
}
