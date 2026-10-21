
import { useCallback, useEffect, useState } from "react";
import { secureFetch } from "./auth";

type ConnectionStatus = {
  connected: boolean;
  provider?: string;
  storage?: string;
  readOnlyApplication?: boolean;
  message?: string;
};

type AccountListResponse = {
  connected?: boolean;
  result?: {
    resourceNames?: string[];
  };
  message?: string;
};

type AccountDetailsResponse = {
  success?: boolean;
  result?: {
    results?: Array<{
      customer?: {
        id?: string;
        descriptiveName?: string;
        currencyCode?: string;
        timeZone?: string;
      };
    }>;
  };
  googleMessage?: string;
  googleErrorDetail?: string;
};

const MANAGER_ID = "3723446468";
const CLIENT_ID = "1547578748";

const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  marginBottom: 20,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  marginRight: 10,
  marginTop: 10,
  cursor: "pointer",
};

const accountStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  marginTop: 12,
};

async function readJson<T>(
  response: Response
): Promise<T> {
  const data: unknown = await response.json();

  if (!response.ok) {
    const error = data as {
      message?: string;
      googleMessage?: string;
      googleErrorDetail?: string;
    };

    throw new Error(
      error.googleErrorDetail ||
        error.googleMessage ||
        error.message ||
        `Request failed: HTTP ${response.status}`
    );
  }

  return data as T;
}

export default function GoogleAdsPanel() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);

  const [managerDetails, setManagerDetails] =
    useState<AccountDetailsResponse | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    setAccountIds([]);
    setManagerDetails(null);

    try {
      const statusResponse = await secureFetch(
        "/api/google-ads/status"
      );

      const status =
        await readJson<ConnectionStatus>(statusResponse);

      setConnected(status.connected === true);

      if (!status.connected) {
        setMessage(
          "Google Ads is disconnected. Connect your Google account."
        );
        return;
      }

      const accountsResponse = await secureFetch(
        "/api/google-ads/accounts"
      );

      const accounts =
        await readJson<AccountListResponse>(accountsResponse);

      const ids = (
        accounts.result?.resourceNames ?? []
      ).map((resource) =>
        resource.replace("customers/", "")
      );

      setAccountIds(ids);

      if (ids.includes(MANAGER_ID)) {
        try {
          const detailsResponse = await secureFetch(
            `/api/google-ads/account-details?customerId=${MANAGER_ID}`
          );

          const details =
            await readJson<AccountDetailsResponse>(
              detailsResponse
            );

          setManagerDetails(details);
        } catch (detailsError) {
          setError(
            detailsError instanceof Error
              ? detailsError.message
              : "Unable to retrieve manager details."
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Google Ads connection."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connectGoogle() {
    setBusy(true);
    setError("");

    try {
      const response = await secureFetch(
        "/api/google-ads/connect"
      );

      const data = await readJson<{
        authorizationUrl?: string;
      }>(response);

      if (!data.authorizationUrl) {
        throw new Error(
          "Google authorization URL was not returned."
        );
      }

      // Use the current tab so the OAuth session is preserved.
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start Google authorization."
      );
      setBusy(false);
    }
  }

  const manager =
    managerDetails?.result?.results?.[0]?.customer;

  return (
    <section className="card" style={panelStyle}>
      <h2>Google Ads API Connection</h2>

      <p>
        Live Google Ads account information.
        Campaign activation and spending are disabled.
      </p>

      {loading ? (
        <p role="status">
          Checking Google Ads connection...
        </p>
      ) : (
        <>
          <p>
            Connection:{" "}
            <strong
              style={{
                color: connected ? "#15803d" : "#b45309",
              }}
            >
              {connected ? "Connected" : "Not connected"}
            </strong>
          </p>

          <p>
            API access: Read-only application operations
          </p>

          <div>
            {!connected && (
              <button
                type="button"
                className="primary"
                style={buttonStyle}
                disabled={busy}
                onClick={() => void connectGoogle()}
              >
                {busy
                  ? "Connecting..."
                  : "Connect Google Ads"}
              </button>
            )}

            <button
              type="button"
              style={buttonStyle}
              disabled={busy || loading}
              onClick={() => void refresh()}
            >
              Refresh Connection
            </button>
          </div>

          {connected && (
            <>
              <h3>Accessible Google Ads Accounts</h3>

              {accountIds.length === 0 ? (
                <p>No accounts were returned.</p>
              ) : (
                <p>
                  {accountIds.length} account(s) accessible
                  through Google Ads API.
                </p>
              )}

              {accountIds.includes(MANAGER_ID) && (
                <div style={accountStyle}>
                  <h3>
                    {manager?.descriptiveName ||
                      "MarketFlow Manager"}
                  </h3>

                  <p>
                    Customer ID:{" "}
                    <strong>372-344-6468</strong>
                  </p>

                  <p>Account type: Manager</p>

                  <p>
                    Currency:{" "}
                    {manager?.currencyCode ||
                      "Not available"}
                  </p>

                  <p>
                    Time zone:{" "}
                    {manager?.timeZone ||
                      "Not available"}
                  </p>

                  <p style={{ color: "#15803d" }}>
                    Manager account accessible
                  </p>

                  <p>
                    Campaign performance metrics must
                    be requested from enabled client
                    accounts, not manager accounts.
                  </p>
                </div>
              )}

              {accountIds.includes(CLIENT_ID) && (
                <div style={accountStyle}>
                  <h3>Google Ads Client Account</h3>

                  <p>
                    Customer ID:{" "}
                    <strong>154-757-8748</strong>
                  </p>

                  <p style={{ color: "#15803d" }}>
                    Account detected — manager link approved
                  </p>

                  <p>
                    Google Ads account setup has been
                    completed, and the manager linking
                    request has been approved.
                  </p>

                  <p>
                    Campaign reporting access has not
                    yet been verified through the API.
                  </p>

                  <p>
                    No advertising campaigns need to be
                    created to test the account connection.
                  </p>
                </div>
              )}

              {accountIds
                .filter(
                  (id) =>
                    id !== MANAGER_ID &&
                    id !== CLIENT_ID
                )
                .map((id) => (
                  <div key={id} style={accountStyle}>
                    <h3>Google Ads Account</h3>

                    <p>Customer ID: {id}</p>

                    <p>
                      Account details not yet loaded.
                    </p>
                  </div>
                ))}
            </>
          )}
        </>
      )}

      {message && (
        <p role="status">{message}</p>
      )}

      {error && (
        <p role="alert" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      <p style={{ fontSize: 13, color: "#64748b" }}>
        Account visibility is based on the Google Ads
        API account list. Manager linking was confirmed
        separately in Google Ads. Campaign reporting
        access has not yet been verified. This panel
        does not create, activate, or modify advertisements.
      </p>
    </section>
  );
}
