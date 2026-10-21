
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { secureFetch } from "./auth";
import GoogleAdsPanel from "./GoogleAdsPanel";
import "./App.css";

type Section =
  | "Dashboard"
  | "Businesses"
  | "Create Post"
  | "Content Templates"
  | "Post Management"
  | "Schedule"
  | "Advertising"
  | "Analytics";

type Business = {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  createdAt: string | null;
};

type Post = {
  id: number;
  businessName: string;
  platform: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  processingStartedAt: string | null;
  publishedAt: string | null;
  lastAttemptAt: string | null;
  publishAttempts: number;
  publishError: string | null;
};

type SortOrder =
  | "newest"
  | "oldest"
  | "scheduled_asc"
  | "scheduled_desc";

type AdPlatform = "Google Ads" | "Meta Ads";
type AdPlacement =
  | "Facebook"
  | "Instagram"
  | "Facebook & Instagram";

type CampaignDraft = {
  id: number;
  businessName: string;
  platform: AdPlatform;
  updatedAt: string;
  businessId: number;
  name: string;
  objective: string;
  dailyBudget: number;
  targetLocation: string;
  status: "DRAFT";
  createdAt: string;
  placement: AdPlacement | null;
};

type LegacyCampaignDraft = {
  id: string;
  businessId: number;
  name: string;
  objective: string;
  dailyBudget: number;
  targetLocation: string;
  status: "DRAFT";
  createdAt: string;
  placement?: AdPlacement;
};

type CampaignSort =
  | "newest"
  | "oldest"
  | "name"
  | "budget_high"
  | "budget_low";

const platforms = ["Facebook", "Instagram", "LinkedIn"];

const statuses = [
  "DRAFT",
  "SCHEDULED",
  "PROCESSING",
  "PUBLISHED",
  "FAILED",
  "REVIEW_REQUIRED",
];

const GOOGLE_KEY = "marketflow_google_campaign_drafts_v1";
const META_KEY = "marketflow_meta_campaign_drafts_v1";

const inputStyle = {
  display: "block" as const,
  padding: "10px",
  margin: "10px 0 20px",
  width: "100%",
  maxWidth: "400px",
  boxSizing: "border-box" as const,
};

const buttonRowStyle = {
  display: "flex" as const,
  flexWrap: "wrap" as const,
  alignItems: "center" as const,
  gap: "10px",
};

const postRowStyle = {
  borderBottom: "1px solid #ddd",
  padding: "15px 0",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

function parseIST(value: string): Date {
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
    return new Date(value);
  }

  return new Date(`${value.slice(0, 19)}+05:30`);
}

function isFutureIST(value: string): boolean {
  if (!value) return false;

  const date = parseIST(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() > Date.now()
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not available";

  const date = parseIST(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date) + " IST"
  );
}

function formatCampaignDate(value: string): string {
  if (!value) return "Unknown date";
  return value.replace("T", " ").slice(0, 19) + " (server time)";
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

async function checkResponse(
  response: Response,
  message: string
) {
  if (response.status === 401) {
    throw new Error(
      "Session expired. Refresh and sign in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "Security verification failed. Refresh and retry."
    );
  }

  if (!response.ok) {
    throw new Error(message);
  }
}

function BusinessSelector({
  id,
  value,
  businesses,
  onChange,
  includeAll = true,
  disabled = false,
}: {
  id: string;
  value: string;
  businesses: Business[];
  onChange: (value: string) => void;
  includeAll?: boolean;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      style={inputStyle}
      disabled={disabled}
    >
      {includeAll && (
        <option value="all">All Businesses</option>
      )}

      {!includeAll && businesses.length === 0 && (
        <option value="">
          No registered businesses
        </option>
      )}

      {businesses.map((business) => (
        <option
          key={business.id}
          value={String(business.id)}
        >
          {business.name}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const colors: Record<
    string,
    { bg: string; text: string }
  > = {
    DRAFT: {
      bg: "#e5e7eb",
      text: "#374151",
    },
    SCHEDULED: {
      bg: "#dbeafe",
      text: "#1d4ed8",
    },
    PROCESSING: {
      bg: "#fef3c7",
      text: "#92400e",
    },
    PUBLISHED: {
      bg: "#dcfce7",
      text: "#166534",
    },
    FAILED: {
      bg: "#fee2e2",
      text: "#991b1b",
    },
    REVIEW_REQUIRED: {
      bg: "#fce7f3",
      text: "#9d174d",
    },
  };

  const color =
    colors[status] ?? colors.DRAFT;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: "999px",
        background: color.bg,
        color: color.text,
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PostDetails({
  post,
}: {
  post: Post;
}) {
  return (
    <>
      <p>
        <strong>
          {post.platform} — Post #{post.id}
        </strong>
      </p>

      <p>Business: {post.businessName}</p>

      <p style={{ whiteSpace: "pre-wrap" }}>
        {post.content}
      </p>

      <p>
        Status:{" "}
        <StatusBadge status={post.status} />
      </p>

      {post.scheduledAt && (
        <p>
          Scheduled for:{" "}
          {formatDateTime(post.scheduledAt)}
        </p>
      )}

      {post.publishedAt && (
        <p>
          Published at:{" "}
          {formatDateTime(post.publishedAt)}
        </p>
      )}

      <p>
        Publishing attempts:{" "}
        {post.publishAttempts ?? 0}
      </p>

      {post.publishError && (
        <p style={{ color: "#dc2626" }}>
          Publishing error:{" "}
          {post.publishError}
        </p>
      )}
    </>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="card">
      <h3>{label}</h3>
      <strong>{value}</strong>
    </div>
  );
}

function isCampaignDraft(
  item: unknown
): item is LegacyCampaignDraft {
  if (
    typeof item !== "object" ||
    item === null
  ) {
    return false;
  }

  const draft = item as Record<
    string,
    unknown
  >;

  return (
    typeof draft.id === "string" &&
    typeof draft.businessId === "number" &&
    typeof draft.name === "string" &&
    typeof draft.objective === "string" &&
    typeof draft.dailyBudget === "number" &&
    Number.isFinite(draft.dailyBudget) &&
    typeof draft.targetLocation === "string" &&
    typeof draft.createdAt === "string" &&
    draft.status === "DRAFT"
  );
}

function readCampaignStorage(
  storageKey: string
): LegacyCampaignDraft[] {
  const stored =
    localStorage.getItem(storageKey);

  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Invalid campaign storage format."
    );
  }

  if (!parsed.every(isCampaignDraft)) {
    throw new Error(
      "Campaign storage contains invalid records."
    );
  }

  return parsed;
}

function AdvertisingPanel({
  business,
  businesses,
  platform,
  refreshVersion,
}: {
  business: Business;
  businesses: Business[];
  platform: AdPlatform;
  refreshVersion: number;
}) {
  const [campaigns, setCampaigns] = useState<CampaignDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportBusinessId, setReportBusinessId] = useState(String(business.id));
  const [reportPlatform, setReportPlatform] = useState("all");
  const [reportObjective, setReportObjective] = useState("all");
  const [reportDurationDays, setReportDurationDays] = useState(30);
  const [reportBudgetLimit, setReportBudgetLimit] = useState("");

  useEffect(() => {
    setReportBusinessId(String(business.id));
  }, [business.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    secureFetch("/api/ad-campaigns")
      .then(async (response) => {
        await checkResponse(response, "Unable to load advertising summary.");
        return response.json() as Promise<CampaignDraft[]>;
      })
      .then((data) => {
        if (!cancelled) setCampaigns(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCampaigns([]);
          setError(getErrorMessage(err, "Unable to load advertising summary."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [business.id, platform, refreshVersion]);

  const businessCampaigns = campaigns.filter(
    (campaign) => campaign.businessId === business.id
  );
  const platformCampaigns = businessCampaigns.filter(
    (campaign) => campaign.platform === platform
  );
  const googleCount = businessCampaigns.filter(
    (campaign) => campaign.platform === "Google Ads"
  ).length;
  const metaCount = businessCampaigns.filter(
    (campaign) => campaign.platform === "Meta Ads"
  ).length;
  const platformBudget = platformCampaigns.reduce(
    (total, campaign) => total + Number(campaign.dailyBudget), 0
  );
  const combinedBudget = businessCampaigns.reduce(
    (total, campaign) => total + Number(campaign.dailyBudget), 0
  );
  const showValue = (value: string | number) => loading || error ? "—" : value;

  const filteredReport = campaigns.filter((campaign) =>
    (reportBusinessId === "all" || String(campaign.businessId) === reportBusinessId) &&
    (reportPlatform === "all" || campaign.platform === reportPlatform) &&
    (reportObjective === "all" || campaign.objective === reportObjective)
  ).sort((a, b) => b.id - a.id);
  const filteredBudget = filteredReport.reduce(
    (total, campaign) => total + Math.round(Number(campaign.dailyBudget) * 100), 0
  ) / 100;
  const estimatedTotalBudget = filteredReport.reduce(
    (total, campaign) => total + Math.round(Number(campaign.dailyBudget) * 100) * reportDurationDays,
    0
  ) / 100;
  const hasBudgetLimit = reportBudgetLimit.trim() !== "";
  const budgetLimitValue = Number(reportBudgetLimit);
  const validBudgetLimit = hasBudgetLimit &&
    Number.isFinite(budgetLimitValue) &&
    budgetLimitValue >= 0 &&
    budgetLimitValue <= 999999999999.99 &&
    Math.abs(budgetLimitValue * 100 - Math.round(budgetLimitValue * 100)) < 0.00001;
  const budgetDifferenceCents = validBudgetLimit
    ? Math.round(budgetLimitValue * 100) - Math.round(estimatedTotalBudget * 100)
    : 0;
  const budgetDifference = Math.abs(budgetDifferenceCents) / 100;
  const budgetStatus = !validBudgetLimit
    ? "Not Set"
    : budgetDifferenceCents >= 0 ? "Within Budget" : "Over Budget";
  // Utilization is based on the combined estimate for the filtered report.
  // A zero limit cannot have a finite utilization percentage.
  const utilizationAvailable = validBudgetLimit && budgetLimitValue > 0;
  const budgetUtilizationPercent = utilizationAvailable
    ? (estimatedTotalBudget / budgetLimitValue) * 100
    : null;
  const utilizationLabel = budgetUtilizationPercent === null
    ? "Not available"
    : `${budgetUtilizationPercent.toFixed(1)}%`;

  // Recommendations are calculated in integer paise to avoid rounding overspend.
  // They are read-only and never update saved PostgreSQL campaign drafts.
  const plannedDailyCents = filteredReport.reduce(
    (sum, campaign) => sum + Math.round(Number(campaign.dailyBudget) * 100), 0
  );
  const allowedDailyCents = validBudgetLimit
    ? Math.floor(Math.round(budgetLimitValue * 100) / reportDurationDays)
    : plannedDailyCents;
  const recommendedDailyCents = Math.min(plannedDailyCents, allowedDailyCents);
  const requiredReductionCents = plannedDailyCents - recommendedDailyCents;
  const recommendationById = new Map<number, number>();
  if (plannedDailyCents > 0 && requiredReductionCents > 0) {
    const allocations = filteredReport.map((campaign) => {
      const original = Math.round(Number(campaign.dailyBudget) * 100);
      const numerator = original * recommendedDailyCents;
      return { id: campaign.id, base: Math.floor(numerator / plannedDailyCents), remainder: numerator % plannedDailyCents };
    });
    const allocated = allocations.reduce((sum, item) => sum + item.base, 0);
    let remaining = recommendedDailyCents - allocated;
    allocations.sort((a, b) => b.remainder - a.remainder || a.id - b.id);
    for (const item of allocations) {
      recommendationById.set(item.id, item.base + (remaining > 0 ? 1 : 0));
      if (remaining > 0) remaining -= 1;
    }
  } else {
    filteredReport.forEach((campaign) => recommendationById.set(campaign.id, Math.round(Number(campaign.dailyBudget) * 100)));
  }
  const recommendedTotalBudget = recommendedDailyCents * reportDurationDays / 100;

  function exportReportCsv() {
    if (loading || error || filteredReport.length === 0) return;
    const headers = [
      "Campaign ID", "Business", "Platform", "Campaign", "Objective",
      "Placement", "Target Location", "Planned Daily Budget (INR)",
      "Duration (Days)", "Estimated Total Budget (INR)", "Budget Limit (INR)", "Budget Status", "Budget Difference (INR)", "Budget Utilization (%)", "Recommended Daily Budget (INR)", "Required Daily Reduction (INR)", "Recommended Total Budget (INR)", "Status", "Created At", "Updated At"
    ];
    // Escape spreadsheet formulas as well as CSV quotes and newlines.
    const csvCell = (value: string | number) => {
      let text = String(value ?? "");
      if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text) && typeof value === "string") {
        text = "'" + text;
      }
      return '"' + text.replace(/"/g, '""') + '"';
    };
    // The limit and difference compare against the whole filtered report,
    // so these summary values repeat on each exported campaign row.
    const rows = filteredReport.map((campaign) => [
      campaign.id, campaign.businessName, campaign.platform, campaign.name,
      campaign.objective, campaign.placement ?? "", campaign.targetLocation,
      Number(campaign.dailyBudget).toFixed(2), reportDurationDays,
      (Math.round(Number(campaign.dailyBudget) * 100) * reportDurationDays / 100).toFixed(2),
      validBudgetLimit ? budgetLimitValue.toFixed(2) : "",
      budgetStatus,
      validBudgetLimit ? budgetDifference.toFixed(2) : "",
      budgetUtilizationPercent === null ? "" : budgetUtilizationPercent.toFixed(2),
      validBudgetLimit ? ((recommendationById.get(campaign.id) ?? 0) / 100).toFixed(2) : "",
      validBudgetLimit ? ((Math.round(Number(campaign.dailyBudget) * 100) - (recommendationById.get(campaign.id) ?? 0)) / 100).toFixed(2) : "",
      validBudgetLimit ? ((recommendationById.get(campaign.id) ?? 0) * reportDurationDays / 100).toFixed(2) : "",
      campaign.status, campaign.createdAt, campaign.updatedAt
    ]);
    const csv = "﻿" + [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `marketflow-campaign-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <div className="card">
        <h2>{platform} Overview</h2>
        <p>Business: <strong>{business.name}</strong></p>
        {platform === "Meta Ads" && <p>Account connection: <strong style={{ color: "#b45309" }}>Not connected</strong></p>}
        <p>These figures come from PostgreSQL campaign drafts. They are planning figures, not live advertising performance.</p>
        {loading && <p role="status">Loading advertising summary...</p>}
        {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}
      </div>

      <div className="cards">
        <MetricCard label={`${platform} Draft Campaigns`} value={showValue(platformCampaigns.length)} />
        <MetricCard label="Google Ads Drafts" value={showValue(googleCount)} />
        <MetricCard label="Meta Ads Drafts" value={showValue(metaCount)} />
        <MetricCard label="All Platform Drafts" value={showValue(businessCampaigns.length)} />
        <MetricCard label={`${platform} Planned Daily Budget`} value={showValue(currencyFormatter.format(platformBudget))} />
        <MetricCard label="Combined Planned Daily Budget" value={showValue(currencyFormatter.format(combinedBudget))} />
      </div>

      <div className="card">
        <h2>Campaign Planning Report</h2>
        <p>Filter PostgreSQL campaign drafts by business, advertising platform, and objective. Export only the visible results.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "end" }}>
          <div>
            <label htmlFor="report-business">Report Business</label>
            <select id="report-business" style={inputStyle} value={reportBusinessId} onChange={(event) => setReportBusinessId(event.target.value)}>
              <option value="all">All Businesses</option>
              {businesses.map((item) => (
                <option key={item.id} value={String(item.id)}>{item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-platform">Advertising Platform</label>
            <select id="report-platform" style={inputStyle} value={reportPlatform} onChange={(event) => setReportPlatform(event.target.value)}>
              <option value="all">All Platforms</option>
              <option value="Google Ads">Google Ads</option>
              <option value="Meta Ads">Meta Ads</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-objective">Campaign Objective</label>
            <select id="report-objective" style={inputStyle} value={reportObjective} onChange={(event) => setReportObjective(event.target.value)}>
              <option value="all">All Objectives</option>
              <option value="Website Traffic">Website Traffic</option>
              <option value="Leads">Leads</option>
              <option value="Sales">Sales</option>
              <option value="Brand Awareness">Brand Awareness</option>
              <option value="Engagement">Engagement</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-duration">Planned Duration (Days)</label>
            <input
              id="report-duration"
              type="number"
              min={1}
              max={365}
              step={1}
              style={inputStyle}
              value={reportDurationDays}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  setReportDurationDays(Math.max(1, Math.min(365, Math.trunc(value))));
                }
              }}
            />
          </div>
          <div>
            <label htmlFor="report-budget-limit">Maximum Total Budget (INR)</label>
            <input
              id="report-budget-limit"
              type="number"
              min={0}
              max={999999999999.99}
              step="0.01"
              placeholder="Optional budget limit"
              style={inputStyle}
              value={reportBudgetLimit}
              onChange={(event) => setReportBudgetLimit(event.target.value)}
            />
          </div>
        </div>
        <div style={buttonRowStyle}>
          <button type="button" onClick={() => {
            setReportBusinessId(String(business.id));
            setReportPlatform("all");
            setReportObjective("all");
            setReportDurationDays(30);
            setReportBudgetLimit("");
          }}>Reset Report Filters</button>
          <button type="button" className="primary" disabled={loading || !!error || filteredReport.length === 0 || (hasBudgetLimit && !validBudgetLimit)} onClick={exportReportCsv}>
            Export Filtered CSV
          </button>
        </div>
        {loading ? (
          <p>Loading campaign report...</p>
        ) : error ? (
          <p role="alert" style={{ color: "#dc2626" }}>Report unavailable: {error}</p>
        ) : (
          <>
            <div className="cards">
              <MetricCard label="Filtered Campaign Drafts" value={filteredReport.length} />
              <MetricCard label="Filtered Planned Daily Budget" value={currencyFormatter.format(filteredBudget)} />
              <MetricCard label={`Estimated ${reportDurationDays}-Day Budget`} value={currencyFormatter.format(estimatedTotalBudget)} />
              <MetricCard label="Budget Limit" value={validBudgetLimit ? currencyFormatter.format(budgetLimitValue) : "Not set"} />
              <MetricCard label="Budget Status" value={budgetStatus} />
              <MetricCard label="Budget Utilization" value={utilizationLabel} />
              <MetricCard label="Recommended Combined Daily Budget" value={validBudgetLimit ? currencyFormatter.format(recommendedDailyCents / 100) : "Set a budget limit"} />
              <MetricCard label="Required Daily Reduction" value={validBudgetLimit ? currencyFormatter.format(requiredReductionCents / 100) : "—"} />
              <MetricCard label="Recommended Total Budget" value={validBudgetLimit ? currencyFormatter.format(recommendedTotalBudget) : "—"} />
              <MetricCard
                label={budgetDifferenceCents >= 0 ? "Remaining Budget" : "Over Budget By"}
                value={validBudgetLimit ? currencyFormatter.format(budgetDifference) : "—"}
              />
            </div>
            {validBudgetLimit && (
              <div style={{ margin: "18px 0 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8, fontWeight: 700 }}>
                  <span>Planned Budget Utilization</span>
                  <span>{utilizationLabel}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Planned budget utilization"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={budgetUtilizationPercent === null ? undefined : Math.min(100, budgetUtilizationPercent)}
                  aria-valuetext={budgetUtilizationPercent === null ? "Not available: budget limit is zero" : utilizationLabel}
                  style={{ width: "100%", height: 16, borderRadius: 999, overflow: "hidden", background: "#e5e7eb" }}
                >
                  <div style={{
                    width: `${budgetUtilizationPercent === null ? 0 : Math.min(100, Math.max(0, budgetUtilizationPercent))}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: budgetDifferenceCents < 0 ? "#dc2626" : "#2563eb",
                    transition: "width 150ms ease"
                  }} />
                </div>
                <p style={{ marginTop: 8, color: budgetDifferenceCents < 0 ? "#b91c1c" : "#475569" }}>
                  {budgetUtilizationPercent === null
                    ? "A positive budget limit is needed to calculate a utilization percentage."
                    : budgetDifferenceCents < 0
                      ? "Warning: the estimated budget exceeds the planned limit."
                      : "The estimated budget is within the planned limit."}
                </p>
              </div>
            )}
            {hasBudgetLimit && !validBudgetLimit && (
              <p role="alert" style={{ color: "#dc2626" }}>
                Enter a valid non-negative budget limit (up to two decimal places).
              </p>
            )}
            {validBudgetLimit && (
              <p role="status" style={{ color: budgetDifferenceCents >= 0 ? "#166534" : "#b91c1c", fontWeight: 700 }}>
                {budgetStatus}: {currencyFormatter.format(budgetDifference)} {budgetDifferenceCents >= 0 ? "remaining" : "above your limit"}.
                This comparison applies to the combined estimated budget of the filtered campaigns.
              </p>
            )}
            {validBudgetLimit && filteredReport.length > 0 && (
              <div className="card" style={{ margin: "16px 0", borderLeft: `4px solid ${requiredReductionCents > 0 ? "#b45309" : "#15803d"}` }}>
                <h3>Budget Recommendations (Planning Only)</h3>
                <p>Maximum combined daily budget within your limit: <strong>{currencyFormatter.format(allowedDailyCents / 100)}</strong>.</p>
                <p>Recommended combined daily budget: <strong>{currencyFormatter.format(recommendedDailyCents / 100)}</strong>.</p>
                <p>Required combined daily reduction: <strong>{currencyFormatter.format(requiredReductionCents / 100)}</strong>.</p>
                <p>Recommended {reportDurationDays}-day total: <strong>{currencyFormatter.format(recommendedTotalBudget)}</strong>.</p>
                <p>{requiredReductionCents > 0
                  ? "Campaign recommendations are reduced proportionally, rounded to the nearest paise without exceeding the limit."
                  : "Current campaign budgets already fit within the selected limit. No reduction is needed."}</p>
                <p>Recommendations do not change saved drafts. Some suggested daily budgets may be ₹0.00; review them before manually editing campaigns.</p>
              </div>
            )}
            {filteredReport.length === 0 ? (
              <p>No campaign drafts match these report filters.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr>
                      {["Business", "Campaign", "Platform", "Objective", "Placement", "Target Location", "Planned Daily Budget", "Duration (Days)", "Estimated Total Budget", "Recommended Daily Budget", "Daily Reduction", "Recommended Total Budget", "Status"].map((heading) => (
                        <th key={heading} scope="col" style={{ padding: "12px 10px", borderBottom: "2px solid #d1d5db", whiteSpace: "nowrap" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReport.map((campaign) => (
                      <tr key={campaign.id}>
                        {[campaign.businessName, campaign.name, campaign.platform, campaign.objective, campaign.placement || "—", campaign.targetLocation].map((value, index) => (
                          <td key={index} style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb" }}>{value}</td>
                        ))}
                        <td style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                          {currencyFormatter.format(Number(campaign.dailyBudget))}
                        </td>
                        <td style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb" }}>
                          {reportDurationDays}
                        </td>
                        <td style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                          {currencyFormatter.format(Math.round(Number(campaign.dailyBudget) * 100) * reportDurationDays / 100)}
                        </td>
                        <td style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                          {validBudgetLimit ? currencyFormatter.format((recommendationById.get(campaign.id) ?? 0) / 100) : "—"}
                        </td>
                        <td style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                          {validBudgetLimit ? currencyFormatter.format((Math.round(Number(campaign.dailyBudget) * 100) - (recommendationById.get(campaign.id) ?? 0)) / 100) : "—"}
                        </td>
                        <td style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                          {validBudgetLimit ? currencyFormatter.format((recommendationById.get(campaign.id) ?? 0) * reportDurationDays / 100) : "—"}
                        </td>
                        <td style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb" }}>
                          <StatusBadge status={campaign.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={6} scope="row" style={{ padding: "12px 10px", textAlign: "right" }}>
                        Total estimated budget ({filteredReport.length} drafts)
                      </th>
                      <td style={{ padding: "12px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {currencyFormatter.format(filteredBudget)}
                      </td>
                      <td style={{ padding: "12px 10px" }}>{reportDurationDays}</td>
                      <td style={{ padding: "12px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {currencyFormatter.format(estimatedTotalBudget)}
                      </td>
                      <td style={{ padding: "12px 10px", fontWeight: 700 }}>{validBudgetLimit ? currencyFormatter.format(recommendedDailyCents / 100) : "—"}</td>
                      <td style={{ padding: "12px 10px", fontWeight: 700 }}>{validBudgetLimit ? currencyFormatter.format(requiredReductionCents / 100) : "—"}</td>
                      <td style={{ padding: "12px 10px", fontWeight: 700 }}>{validBudgetLimit ? currencyFormatter.format(recommendedTotalBudget) : "—"}</td>
                      <td style={{ padding: "12px 10px" }}>Planning only</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p>Estimates assume each selected campaign runs for the same number of days at its planned daily budget. These are not actual charges or advertising performance.</p>
          </>
        )}
      </div>

      {platform === "Meta Ads" && (
        <div className="card">
          <h2>Live Advertising Performance</h2>
          <p>Meta Ads account integration is not connected yet.</p>
          <button disabled>Connect Meta Ads — Coming Soon</button>
        </div>
      )}

      <div className="card">
        <h2>Advertising Safety</h2>
        <p>Campaign activation and spending are disabled. Saving drafts does not create advertisements on Google, Facebook or Instagram.</p>
        <p>Advertising eligibility depends on products and platform policies. Fireworks advertising may be prohibited.</p>
      </div>
    </>
  );
}

function CampaignDraftManager({
  business,
  platform,
  onCampaignChange,
}: {
  business: Business;
  platform: AdPlatform;
  onCampaignChange: () => void;
}) {
  const isMeta = platform === "Meta Ads";
  const storageKey = isMeta ? META_KEY : GOOGLE_KEY;
  const migrationKey = `${storageKey}_imported_ids_v1`;
  const [drafts, setDrafts] = useState<CampaignDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [legacyDrafts, setLegacyDrafts] = useState<LegacyCampaignDraft[]>([]);
  const [legacyError, setLegacyError] = useState("");
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("Website Traffic");
  const [dailyBudget, setDailyBudget] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [placement, setPlacement] = useState<AdPlacement>("Facebook & Instagram");
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [campaignSort, setCampaignSort] = useState<CampaignSort>("newest");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [showAllBusinesses, setShowAllBusinesses] = useState(false);

  const loadCampaigns = useCallback(async () => {
    const response = await secureFetch(
      `/api/ad-campaigns?platform=${encodeURIComponent(platform)}`
    );
    await checkResponse(response, "Unable to load campaign drafts from PostgreSQL.");
    const data: CampaignDraft[] = await response.json();
    setDrafts(data);
    onCampaignChange();
  }, [platform, onCampaignChange]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadFailed(false);
    setError("");
    setMessage("");
    secureFetch(`/api/ad-campaigns?platform=${encodeURIComponent(platform)}`)
      .then(async (response) => {
        await checkResponse(response, "Unable to load campaign drafts from PostgreSQL.");
        return response.json() as Promise<CampaignDraft[]>;
      })
      .then((data) => { if (!cancelled) setDrafts(data); })
      .catch((err: unknown) => {
        if (!cancelled) { setLoadFailed(true); setError(getErrorMessage(err, "Campaign loading failed.")); }
      })
      .finally(() => { if (!cancelled) setLoaded(true); });
    try {
      const oldDrafts = readCampaignStorage(storageKey);
      const storedIds = JSON.parse(localStorage.getItem(migrationKey) || "[]") as unknown;
      if (!Array.isArray(storedIds) || !storedIds.every((id) => typeof id === "string")) {
        throw new Error("Invalid import tracking data.");
      }
      setLegacyDrafts(oldDrafts);
      setImportedIds(storedIds);
      setLegacyError("");
    } catch {
      setLegacyDrafts([]);
      setImportedIds([]);
      setLegacyError("Older browser drafts could not be read. Their original data has not been changed.");
    }
    return () => { cancelled = true; };
  }, [platform, storageKey, migrationKey]);

  useEffect(() => {
    setCampaignName("");
    setObjective("Website Traffic");
    setDailyBudget("");
    setTargetLocation([business.city, business.state, business.country].filter(Boolean).join(", "));
    setPlacement("Facebook & Instagram");
    setEditingCampaignId(null);
    setMessage("");
  }, [business.id, business.city, business.state, business.country, platform]);

  function resetForm() {
    setEditingCampaignId(null);
    setCampaignName("");
    setObjective("Website Traffic");
    setDailyBudget("");
    setPlacement("Facebook & Instagram");
    setTargetLocation([business.city, business.state, business.country].filter(Boolean).join(", "));
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !loaded || loadFailed) return;
    const budget = Number(dailyBudget);
    if (!campaignName.trim() || !targetLocation.trim() || !dailyBudget.trim() ||
        !Number.isFinite(budget) || budget <= 0 || budget > 9999999999.99 ||
        Math.round(budget * 100) !== budget * 100) {
      setError("Enter a name, location, and a valid positive daily budget (up to two decimals).");
      return;
    }
    const payload = {
      businessId: business.id,
      platform,
      name: campaignName.trim(),
      objective,
      dailyBudget: budget,
      targetLocation: targetLocation.trim(),
      placement: isMeta ? placement : null,
    };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await secureFetch(
        editingCampaignId === null ? "/api/ad-campaigns" : `/api/ad-campaigns/${editingCampaignId}`,
        {
          method: editingCampaignId === null ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      await checkResponse(response, "Unable to save campaign draft. Check the form values.");
      await loadCampaigns();
      resetForm();
      setMessage("Campaign draft saved in PostgreSQL.");
    } catch (err) {
      setError(getErrorMessage(err, "Campaign save failed."));
    } finally {
      setBusy(false);
    }
  }

  function editCampaign(draft: CampaignDraft) {
    if (draft.businessId !== business.id) {
      setError("Select the campaign's business before editing.");
      return;
    }
    setEditingCampaignId(draft.id);
    setCampaignName(draft.name);
    setObjective(draft.objective);
    setDailyBudget(String(draft.dailyBudget));
    setTargetLocation(draft.targetLocation);
    setPlacement(draft.placement || "Facebook & Instagram");
    setError("");
    setMessage(`Editing "${draft.name}".`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function duplicateCampaign(draft: CampaignDraft) {
    if (busy || loadFailed) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await secureFetch(`/api/ad-campaigns/${draft.id}/duplicate`, { method: "POST" });
      await checkResponse(response, "Unable to duplicate campaign.");
      await loadCampaigns();
      setMessage("Campaign duplicated in PostgreSQL.");
    } catch (err) {
      setError(getErrorMessage(err, "Campaign duplication failed."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampaign(id: number) {
    if (busy || loadFailed || !window.confirm("Permanently delete this campaign draft from PostgreSQL?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await secureFetch(`/api/ad-campaigns/${id}`, { method: "DELETE" });
      await checkResponse(response, "Unable to delete campaign.");
      await loadCampaigns();
      if (editingCampaignId === id) resetForm();
      setMessage("Campaign draft deleted from PostgreSQL.");
    } catch (err) {
      setError(getErrorMessage(err, "Campaign deletion failed."));
    } finally {
      setBusy(false);
    }
  }

  const remainingLegacy = legacyDrafts.filter((draft) => !importedIds.includes(draft.id));

  async function importLegacyDrafts() {
    if (busy || loadFailed || remainingLegacy.length === 0) return;
    if (!window.confirm(`Import ${remainingLegacy.length} browser draft(s) into PostgreSQL? Browser copies will be kept.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    let imported = 0;
    const completed = [...importedIds];
    try {
      for (const draft of remainingLegacy) {
        const response = await secureFetch("/api/ad-campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: draft.businessId,
            platform,
            name: draft.name,
            objective: draft.objective,
            dailyBudget: draft.dailyBudget,
            targetLocation: draft.targetLocation,
            placement: isMeta ? (draft.placement || "Facebook & Instagram") : null,
          }),
        });
        await checkResponse(response, `Import stopped at "${draft.name}". Verify that the business still exists and the campaign values are valid.`);
        completed.push(draft.id);
        localStorage.setItem(migrationKey, JSON.stringify(completed));
        setImportedIds([...completed]);
        imported += 1;
      }
      await loadCampaigns();
      setMessage(`${imported} browser draft(s) imported. Original browser copies were kept.`);
    } catch (err) {
      try { await loadCampaigns(); } catch { /* Keep previous data and show the import error. */ }
      setError(getErrorMessage(err, "Import stopped. Previously imported drafts remain saved."));
    } finally {
      setBusy(false);
    }
  }

  const businessDrafts = drafts.filter((draft) => draft.businessId === business.id);
  const plannedDailyBudget = businessDrafts.reduce((sum, draft) => sum + Number(draft.dailyBudget), 0);
  const visibleDrafts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return drafts.filter((draft) =>
      (showAllBusinesses || draft.businessId === business.id) &&
      (objectiveFilter === "all" || draft.objective === objectiveFilter) &&
      (!search || [draft.name, draft.objective, draft.targetLocation].some((value) => value.toLowerCase().includes(search)))
    ).sort((a, b) => {
      if (campaignSort === "name") return a.name.localeCompare(b.name);
      if (campaignSort === "budget_high") return b.dailyBudget - a.dailyBudget;
      if (campaignSort === "budget_low") return a.dailyBudget - b.dailyBudget;
      if (campaignSort === "oldest") return a.id - b.id;
      return b.id - a.id;
    });
  }, [drafts, business.id, showAllBusinesses, objectiveFilter, searchTerm, campaignSort]);

  return (
    <>
      <div className="card">
        <h2>{platform} Campaign Management</h2>
        <p>Business: <strong>{business.name}</strong></p>
        <div className="cards">
          <MetricCard label="Saved Campaign Drafts" value={businessDrafts.length} />
          <MetricCard label="Combined Planned Daily Budget" value={currencyFormatter.format(plannedDailyBudget)} />
        </div>
        <p>These are planning figures only, not actual advertising spend.</p>
      </div>

      <div className="card">
        <h2>{editingCampaignId === null ? `Create ${platform} Campaign Draft` : `Edit ${platform} Campaign`}</h2>
        <p>Campaign drafts are saved in PostgreSQL. Saving does not activate advertising.</p>
        <form onSubmit={(event) => void saveCampaign(event)}>
          <label htmlFor="campaign-name">Campaign Name *</label>
          <input id="campaign-name" style={inputStyle} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} maxLength={150} required />
          <label htmlFor="campaign-objective">Campaign Objective *</label>
          <select id="campaign-objective" style={inputStyle} value={objective} onChange={(event) => setObjective(event.target.value)}>
            <option value="Website Traffic">Website Traffic</option>
            <option value="Leads">Leads</option>
            <option value="Sales">Sales</option>
            <option value="Brand Awareness">Brand Awareness</option>
            {isMeta && <option value="Engagement">Engagement</option>}
          </select>
          {isMeta && <>
            <label htmlFor="campaign-placement">Facebook / Instagram Placement *</label>
            <select id="campaign-placement" style={inputStyle} value={placement} onChange={(event) => setPlacement(event.target.value as AdPlacement)}>
              <option value="Facebook & Instagram">Facebook & Instagram</option>
              <option value="Facebook">Facebook Only</option>
              <option value="Instagram">Instagram Only</option>
            </select>
          </>}
          <label htmlFor="campaign-budget">Planned Daily Budget (INR) *</label>
          <input id="campaign-budget" type="number" min="0.01" max="9999999999.99" step="0.01" style={inputStyle} value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value)} required />
          <label htmlFor="campaign-location">Target Location *</label>
          <input id="campaign-location" style={inputStyle} value={targetLocation} onChange={(event) => setTargetLocation(event.target.value)} maxLength={255} required />
          <div style={buttonRowStyle}>
            <button className="primary" type="submit" disabled={!loaded || busy || loadFailed}>{busy ? "Working..." : editingCampaignId === null ? "Save Campaign Draft" : "Save Campaign Changes"}</button>
            {editingCampaignId !== null && <button type="button" disabled={busy} onClick={() => { resetForm(); setMessage("Campaign editing cancelled."); }}>Cancel Editing</button>}
          </div>
        </form>
        {error && <p role="alert" style={{ color: "#dc2626" }}>{error}</p>}
        {message && <p role="status">{message}</p>}
      </div>

      <div className="card">
        <h2>Search and Filter Campaigns</h2>
        <label htmlFor="campaign-search">Search Campaigns</label>
        <input id="campaign-search" type="search" style={inputStyle} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name, objective, or location" />
        <label htmlFor="campaign-objective-filter">Filter by Objective</label>
        <select id="campaign-objective-filter" style={inputStyle} value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)}>
          <option value="all">All Objectives</option>
          <option value="Website Traffic">Website Traffic</option>
          <option value="Leads">Leads</option>
          <option value="Sales">Sales</option>
          <option value="Brand Awareness">Brand Awareness</option>
          {isMeta && <option value="Engagement">Engagement</option>}
        </select>
        <label htmlFor="campaign-sort">Sort Campaigns</label>
        <select id="campaign-sort" style={inputStyle} value={campaignSort} onChange={(event) => setCampaignSort(event.target.value as CampaignSort)}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Campaign Name</option>
          <option value="budget_high">Highest Budget First</option>
          <option value="budget_low">Lowest Budget First</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <input type="checkbox" checked={showAllBusinesses} onChange={(event) => setShowAllBusinesses(event.target.checked)} />
          Show campaigns from all businesses
        </label>
        <button onClick={() => { setSearchTerm(""); setObjectiveFilter("all"); setCampaignSort("newest"); setShowAllBusinesses(false); }}>Clear Campaign Filters</button>
      </div>

      <div className="card">
        <h2>Saved {platform} Drafts ({visibleDrafts.length})</h2>
        {!loaded ? <p>Loading campaign drafts from PostgreSQL...</p> : visibleDrafts.length === 0 ? <p>No campaigns match your filters.</p> :
          visibleDrafts.map((draft) => <div key={draft.id} style={postRowStyle}>
            <h3>{draft.name}</h3>
            <p>Business: {draft.businessName} (ID: {draft.businessId})</p>
            <p>Objective: {draft.objective}</p>
            {isMeta && <p>Placement: {draft.placement || "Not set"}</p>}
            <p>Planned Daily Budget: {currencyFormatter.format(draft.dailyBudget)}</p>
            <p>Target Location: {draft.targetLocation}</p>
            <p>Status: <StatusBadge status={draft.status} /></p>
            <p>Created: {formatCampaignDate(draft.createdAt)}</p>
            <div style={buttonRowStyle}>
              <button className="primary" disabled={busy || loadFailed || draft.businessId !== business.id} onClick={() => editCampaign(draft)}>Edit Campaign</button>
              <button disabled={busy || loadFailed} onClick={() => void duplicateCampaign(draft)}>Duplicate</button>
              <button disabled={busy || loadFailed} style={{ background: "#b91c1c", color: "#fff" }} onClick={() => void deleteCampaign(draft.id)}>Delete</button>
            </div>
          </div>)}
      </div>

      <div className="card">
        <h3>Browser Draft Migration</h3>
        <p>New campaigns are stored in PostgreSQL. Older browser drafts remain untouched unless you choose to import them.</p>
        {legacyError && <p role="alert" style={{ color: "#dc2626" }}>{legacyError}</p>}
        <p>Browser drafts waiting for import: <strong>{remainingLegacy.length}</strong></p>
        <button disabled={busy || !loaded || loadFailed || !!legacyError || remainingLegacy.length === 0} onClick={() => void importLegacyDrafts()}>
          {busy ? "Working..." : `Import ${remainingLegacy.length} Browser Draft(s)`}
        </button>
        <p>Original browser drafts are kept as a backup. Imported drafts will appear on other devices using this backend.</p>
      </div>
    </>
  );
}

type CalendarView = "month" | "week" | "day";

function calendarKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftCalendarDate(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function ContentCalendar({ posts, loading }: { posts: Post[]; loading: boolean }) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => calendarKey(new Date()));
  const [selected, setSelected] = useState(() => calendarKey(new Date()));
  const [platformFilter, setPlatformFilter] = useState("all");

  const scheduled = useMemo(() => posts.filter((post) =>
    post.status === "SCHEDULED" && post.scheduledAt &&
    (platformFilter === "all" || post.platform === platformFilter) &&
    !Number.isNaN(parseIST(post.scheduledAt).getTime())
  ), [posts, platformFilter]);

  const grouped = useMemo(() => {
    const result = new Map<string, Post[]>();
    for (const post of scheduled) {
      const key = calendarKey(parseIST(post.scheduledAt!));
      const group = result.get(key) ?? [];
      group.push(post);
      result.set(key, group);
    }
    for (const group of result.values()) {
      group.sort((a, b) => parseIST(a.scheduledAt!).getTime() - parseIST(b.scheduledAt!).getTime());
    }
    return result;
  }, [scheduled]);

  const monthStart = `${anchor.slice(0, 7)}-01`;
  const monthFirstWeekday = new Date(`${monthStart}T12:00:00Z`).getUTCDay();
  const weekStart = shiftCalendarDate(anchor, -new Date(`${anchor}T12:00:00Z`).getUTCDay());
  const dates = view === "month"
    ? Array.from({ length: 42 }, (_, i) => shiftCalendarDate(monthStart, i - monthFirstWeekday))
    : view === "week"
      ? Array.from({ length: 7 }, (_, i) => shiftCalendarDate(weekStart, i))
      : [anchor];
  const heading = view === "month"
    ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthStart}T12:00:00Z`))
    : view === "week" ? `Week of ${weekStart}` : anchor;
  const today = calendarKey(new Date());
  const selectedPosts = grouped.get(selected) ?? [];

  function navigate(direction: number) {
    if (view === "month") {
      const date = new Date(`${monthStart}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + direction);
      const next = date.toISOString().slice(0, 10);
      setAnchor(next);
      setSelected(next);
    } else {
      const next = shiftCalendarDate(anchor, direction * (view === "week" ? 7 : 1));
      setAnchor(next);
      setSelected(next);
    }
  }

  return (
    <div className="card">
      <h2>Content Calendar</h2>
      <p>Scheduled content is shown in Indian Standard Time (IST). This is a planning calendar only; automatic publishing is disabled.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <label htmlFor="calendar-view">View</label>
        <select id="calendar-view" value={view} onChange={(event) => setView(event.target.value as CalendarView)}>
          <option value="month">Month</option><option value="week">Week</option><option value="day">Day</option>
        </select>
        <label htmlFor="calendar-platform">Platform</label>
        <select id="calendar-platform" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
          <option value="all">All Platforms</option>
          {platforms.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" onClick={() => navigate(-1)} aria-label="Previous calendar period">Previous</button>
        <button type="button" onClick={() => { const current = calendarKey(new Date()); setAnchor(current); setSelected(current); }}>Today</button>
        <button type="button" onClick={() => navigate(1)} aria-label="Next calendar period">Next</button>
      </div>
      <h3>{heading}</h3>
      {loading ? <p>Loading calendar...</p> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: view === "day" ? "1fr" : "repeat(7, minmax(0, 1fr))", gap: 5 }}>
            {view !== "day" && ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) =>
              <strong key={day} style={{ textAlign: "center", fontSize: 12 }}>{day}</strong>
            )}
            {dates.map((day) => {
              const count = grouped.get(day)?.length ?? 0;
              const isSelected = selected === day;
              return (
                <button key={day} type="button" onClick={() => { setSelected(day); if (view === "day") setAnchor(day); }}
                  aria-pressed={isSelected}
                  aria-label={`${day}: ${count} scheduled post${count === 1 ? "" : "s"}`}
                  style={{ minHeight: view === "month" ? 78 : 96, padding: 6, textAlign: "left", border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1", borderRadius: 8, background: isSelected ? "#dbeafe" : day === today ? "#f0fdf4" : "#fff", color: "#111827", opacity: view === "month" && day.slice(0, 7) !== anchor.slice(0, 7) ? 0.55 : 1, overflowWrap: "anywhere" }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 12 }}>{Number(day.slice(-2))}</span>
                  {count > 0 && <span style={{ fontSize: 12 }}>{count} post{count === 1 ? "" : "s"}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 18 }}>
            <h3>Scheduled for {selected} ({selectedPosts.length})</h3>
            {selectedPosts.length === 0 ? <p>No scheduled posts on this date.</p> : selectedPosts.map((post) => (
              <div key={post.id} style={postRowStyle}>
                <PostDetails post={post} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type ContentTemplate = {
  id: number;
  businessId: number;
  businessName: string;
  name: string;
  platform: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function ContentTemplatesManager({ businesses, onUse }: {
  businesses: Business[];
  onUse: (template: ContentTemplate) => void;
}) {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("Facebook");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterBusiness, setFilterBusiness] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    if (businesses.length > 0 && !businesses.some(b => String(b.id) === businessId)) {
      setBusinessId(String(businesses[0].id));
    }
  }, [businesses, businessId]);

  const load = useCallback(async () => {
    const response = await secureFetch("/api/content-templates");
    await checkResponse(response, "Unable to load content templates.");
    const result: ContentTemplate[] = await response.json();
    setTemplates(result);
  }, []);

  useEffect(() => {
    let active = true;
    secureFetch("/api/content-templates")
      .then(async response => {
        await checkResponse(response, "Unable to load content templates.");
        return response.json() as Promise<ContentTemplate[]>;
      })
      .then(result => { if (active) setTemplates(result); })
      .catch(err => { if (active) setError(getErrorMessage(err, "Loading failed.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function clearForm() {
    setEditingId(null);
    setName("");
    setPlatform("Facebook");
    setContent("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || loading) return;
    if (!businessId || !name.trim() || !content.trim() || name.trim().length > 150 || content.trim().length > 10000) {
      setError("Choose a business and enter a template name and content.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await secureFetch(editingId === null ? "/api/content-templates" : `/api/content-templates/${editingId}`, {
        method: editingId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: Number(businessId), name: name.trim(), platform, content: content.trim() }),
      });
      await checkResponse(response, "Unable to save content template.");
      await load();
      clearForm();
      setMessage("Template saved in PostgreSQL.");
    } catch (err) {
      setError(getErrorMessage(err, "Template save failed."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function edit(template: ContentTemplate) {
    setEditingId(template.id);
    setBusinessId(String(template.businessId));
    setName(template.name);
    setPlatform(template.platform);
    setContent(template.content);
    setError("");
    setMessage(`Editing template: ${template.name}`);
  }

  async function remove(template: ContentTemplate) {
    if (pending.current || !window.confirm(`Delete template "${template.name}" permanently?`)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await secureFetch(`/api/content-templates/${template.id}`, { method: "DELETE" });
      await checkResponse(response, "Unable to delete content template.");
      await load();
      if (editingId === template.id) clearForm();
      setMessage("Template deleted.");
    } catch (err) {
      setError(getErrorMessage(err, "Template deletion failed."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const visible = templates.filter(template =>
    (filterBusiness === "all" || String(template.businessId) === filterBusiness) &&
    (filterPlatform === "all" || template.platform === filterPlatform) &&
    (!search.trim() || [template.name, template.content, template.businessName].some(value =>
      value.toLowerCase().includes(search.trim().toLowerCase())))
  );

  return <>
    <div className="card">
      <h2>{editingId === null ? "Create Content Template" : "Edit Content Template"}</h2>
      <p>Templates are saved in PostgreSQL. They never publish automatically.</p>
      <form onSubmit={event => void save(event)}>
        <label htmlFor="template-business">Business</label>
        <BusinessSelector id="template-business" value={businessId} businesses={businesses}
          includeAll={false} disabled={busy} onChange={setBusinessId} />
        <label htmlFor="template-name">Template Name</label>
        <input id="template-name" style={inputStyle} value={name} onChange={event => setName(event.target.value)} maxLength={150} required />
        <label htmlFor="template-platform">Platform</label>
        <select id="template-platform" style={inputStyle} value={platform} onChange={event => setPlatform(event.target.value)}>
          {platforms.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <label htmlFor="template-content">Content</label>
        <textarea id="template-content" value={content} maxLength={10000} required
          onChange={event => setContent(event.target.value)} placeholder="Write reusable marketing content..." />
        <p>{content.length} / 10000 characters</p>
        <div style={buttonRowStyle}>
          <button className="primary" type="submit" disabled={busy || loading || !businessId}>
            {busy ? "Working..." : editingId === null ? "Save Template" : "Save Changes"}
          </button>
          {editingId !== null && <button type="button" disabled={busy} onClick={clearForm}>Cancel Editing</button>}
        </div>
      </form>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
    <div className="card">
      <h2>Saved Content Templates ({visible.length})</h2>
      <label htmlFor="template-search">Search Templates</label>
      <input id="template-search" type="search" style={inputStyle} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or content" />
      <label htmlFor="template-filter-business">Filter Business</label>
      <BusinessSelector id="template-filter-business" value={filterBusiness} businesses={businesses} onChange={setFilterBusiness} />
      <label htmlFor="template-filter-platform">Filter Platform</label>
      <select id="template-filter-platform" style={inputStyle} value={filterPlatform} onChange={event => setFilterPlatform(event.target.value)}>
        <option value="all">All Platforms</option>
        {platforms.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      {loading ? <p>Loading templates...</p> : visible.length === 0 ? <p>No matching templates.</p> :
        visible.map(template => <div key={template.id} style={postRowStyle}>
          <h3>{template.name}</h3>
          <p>{template.businessName} — {template.platform}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{template.content}</p>
          <div style={buttonRowStyle}>
            <button type="button" className="primary" disabled={busy} onClick={() => onUse(template)}>Use in Create Post</button>
            <button type="button" disabled={busy} onClick={() => edit(template)}>Edit</button>
            <button type="button" disabled={busy} onClick={() => void remove(template)}>Delete</button>
          </div>
        </div>)}
    </div>
  </>;
}

function TemplatePicker({ businessId, platform, onUse }: {
  businessId: string;
  platform: string;
  onUse: (template: ContentTemplate) => void;
}) {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setSelectedId("");
    setError("");
    if (!businessId) { setTemplates([]); return; }
    secureFetch(`/api/content-templates?businessId=${encodeURIComponent(businessId)}&platform=${encodeURIComponent(platform)}`)
      .then(async response => {
        await checkResponse(response, "Unable to load templates for this post.");
        return response.json() as Promise<ContentTemplate[]>;
      })
      .then(result => { if (active) setTemplates(result); })
      .catch(err => { if (active) { setTemplates([]); setError(getErrorMessage(err, "Unable to load templates.")); } });
    return () => { active = false; };
  }, [businessId, platform, reload]);
  return <div style={{ marginBottom: 18 }}>
    <label htmlFor="post-template-picker">Use Saved Template (optional)</label>
    <select id="post-template-picker" style={inputStyle} value={selectedId} onChange={event => setSelectedId(event.target.value)}>
      <option value="">Select a template</option>
      {templates.map(template => <option key={template.id} value={String(template.id)}>{template.name}</option>)}
    </select>
    <div style={buttonRowStyle}>
      <button type="button" disabled={!selectedId} onClick={() => {
        const template = templates.find(item => String(item.id) === selectedId);
        if (template) onUse(template);
      }}>Use Template</button>
      <button type="button" onClick={() => setReload(value => value + 1)}>Refresh Templates</button>
    </div>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
  </div>;
}

function App() {
  const [section, setSection] =
    useState<Section>("Dashboard");

  const [posts, setPosts] =
    useState<Post[]>([]);

  const [businesses, setBusinesses] =
    useState<Business[]>([]);

  const [loadingPosts, setLoadingPosts] =
    useState(true);

  const [
    loadingBusinesses,
    setLoadingBusinesses,
  ] = useState(true);

  const [backendStatus, setBackendStatus] =
    useState("Checking...");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    dashboardBusinessId,
    setDashboardBusinessId,
  ] = useState("all");

  const [
    scheduleBusinessId,
    setScheduleBusinessId,
  ] = useState("all");

  const [
    advertisingBusinessId,
    setAdvertisingBusinessId,
  ] = useState("");

  const [
    advertisingPlatform,
    setAdvertisingPlatform,
  ] = useState<AdPlatform>(
    "Google Ads"
  );

  const [dashboardCampaigns, setDashboardCampaigns] = useState<CampaignDraft[]>([]);
  const [dashboardCampaignLoading, setDashboardCampaignLoading] = useState(true);
  const [dashboardCampaignError, setDashboardCampaignError] = useState("");
  const [dashboardReloadVersion, setDashboardReloadVersion] = useState(0);

  useEffect(() => {
    if (section !== "Dashboard") return;
    let cancelled = false;
    setDashboardCampaignLoading(true);
    setDashboardCampaignError("");
    secureFetch("/api/ad-campaigns")
      .then(async (response) => {
        await checkResponse(response, "Unable to load dashboard campaign data.");
        return response.json() as Promise<CampaignDraft[]>;
      })
      .then((data) => { if (!cancelled) setDashboardCampaigns(data); })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDashboardCampaigns([]);
          setDashboardCampaignError(getErrorMessage(err, "Campaign data unavailable."));
        }
      })
      .finally(() => { if (!cancelled) setDashboardCampaignLoading(false); });
    return () => { cancelled = true; };
  }, [section, dashboardReloadVersion]);

  const [advertisingRefreshVersion, setAdvertisingRefreshVersion] = useState(0);
  const refreshAdvertising = useCallback(() => {
    setAdvertisingRefreshVersion((version) => version + 1);
  }, []);

  const [postSearch, setPostSearch] =
    useState("");

  const [
    postBusinessId,
    setPostBusinessId,
  ] = useState("all");

  const [postStatus, setPostStatus] =
    useState("all");

  const [sortOrder, setSortOrder] =
    useState<SortOrder>("newest");

  const [pageSize, setPageSize] =
    useState(5);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [
    selectedPostIds,
    setSelectedPostIds,
  ] = useState<number[]>([]);

  const [bulkWorking, setBulkWorking] =
    useState(false);

  // Synchronous locks prevent repeated clicks before React rerenders.
  const pendingPostActions = useRef<Set<number>>(new Set());
  const schedulingLock = useRef(false);
  const reschedulingLock = useRef(false);
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null);

  function lockPost(id: number): boolean {
    if (pendingPostActions.current.has(id) || bulkWorking) return false;
    pendingPostActions.current.add(id);
    return true;
  }

  function unlockPost(id: number) {
    pendingPostActions.current.delete(id);
  }


  const [businessName, setBusinessName] =
    useState("");

  const [businessCity, setBusinessCity] =
    useState("");

  const [businessState, setBusinessState] =
    useState("");

  const [
    businessCountry,
    setBusinessCountry,
  ] = useState("India");

  const [
    registeringBusiness,
    setRegisteringBusiness,
  ] = useState(false);

  const [
    editingBusinessId,
    setEditingBusinessId,
  ] = useState<number | null>(null);

  const [
    editBusinessCity,
    setEditBusinessCity,
  ] = useState("");

  const [
    editBusinessState,
    setEditBusinessState,
  ] = useState("");

  const [
    editBusinessCountry,
    setEditBusinessCountry,
  ] = useState("India");

  const [
    updatingBusiness,
    setUpdatingBusiness,
  ] = useState(false);

  const [
    selectedBusinessId,
    setSelectedBusinessId,
  ] = useState("");

  const [platform, setPlatform] =
    useState("Facebook");

  const [content, setContent] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [
    editingPostId,
    setEditingPostId,
  ] = useState<number | null>(null);

  const [
    editPlatform,
    setEditPlatform,
  ] = useState("Facebook");

  const [
    editContent,
    setEditContent,
  ] = useState("");

  const [updating, setUpdating] =
    useState(false);

  const [
    selectedPostId,
    setSelectedPostId,
  ] = useState("");

  const [
    scheduledAt,
    setScheduledAt,
  ] = useState("");

  const [
    scheduling,
    setScheduling,
  ] = useState(false);

  const [
    reschedulingPostId,
    setReschedulingPostId,
  ] = useState<number | null>(null);

  const [
    newScheduledAt,
    setNewScheduledAt,
  ] = useState("");

  const [
    rescheduling,
    setRescheduling,
  ] = useState(false);

  const [
    cancellingPostId,
    setCancellingPostId,
  ] = useState<number | null>(null);

  const selectedBusiness =
    businesses.find(
      (business) =>
        String(business.id) ===
        selectedBusinessId
    );

  const advertisingBusiness =
    businesses.find(
      (business) =>
        String(business.id) ===
        advertisingBusinessId
    );

  function filterByBusiness(
    items: Post[],
    id: string
  ): Post[] {
    if (id === "all") {
      return items;
    }

    const business =
      businesses.find(
        (item) =>
          String(item.id) === id
      );

    return business
      ? items.filter(
          (post) =>
            post.businessName ===
            business.name
        )
      : [];
  }

  const dashboardPosts =
    filterByBusiness(
      posts,
      dashboardBusinessId
    );

  const dashboardBusinesses =
    dashboardBusinessId === "all"
      ? businesses
      : businesses.filter(
          (business) =>
            String(business.id) ===
            dashboardBusinessId
        );

  const drafts = posts.filter(
    (post) =>
      post.status === "DRAFT"
  );

  const scheduledPosts =
    posts.filter(
      (post) =>
        post.status === "SCHEDULED"
    );

  const businessDrafts =
    selectedBusiness
      ? drafts.filter(
          (post) =>
            post.businessName ===
            selectedBusiness.name
        )
      : [];

  const filteredDrafts =
    filterByBusiness(
      drafts,
      scheduleBusinessId
    );

  const filteredScheduledPosts =
    filterByBusiness(
      scheduledPosts,
      scheduleBusinessId
    );

  const filteredManagementPosts =
    filterByBusiness(
      posts,
      postBusinessId
    )
      .filter((post) => {
        const matchesStatus =
          postStatus === "all" ||
          post.status === postStatus;

        const search =
          postSearch
            .trim()
            .toLowerCase();

        return (
          matchesStatus &&
          (!search ||
            String(post.id).includes(
              search
            ) ||
            post.content
              .toLowerCase()
              .includes(search) ||
            post.platform
              .toLowerCase()
              .includes(search) ||
            post.businessName
              .toLowerCase()
              .includes(search))
        );
      })
      .sort((a, b) => {
        if (
          sortOrder === "newest"
        ) {
          return b.id - a.id;
        }

        if (
          sortOrder === "oldest"
        ) {
          return a.id - b.id;
        }

        const aTime =
          a.scheduledAt
            ? parseIST(
                a.scheduledAt
              ).getTime()
            : null;

        const bTime =
          b.scheduledAt
            ? parseIST(
                b.scheduledAt
              ).getTime()
            : null;

        if (
          aTime === null &&
          bTime === null
        ) {
          return b.id - a.id;
        }

        if (aTime === null) {
          return 1;
        }

        if (bTime === null) {
          return -1;
        }

        return sortOrder ===
          "scheduled_asc"
          ? aTime - bTime
          : bTime - aTime;
      });

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredManagementPosts.length /
          pageSize
      )
    );

  const safePage =
    Math.min(
      currentPage,
      totalPages
    );

  const startIndex =
    (safePage - 1) *
    pageSize;

  const paginatedPosts =
    filteredManagementPosts.slice(
      startIndex,
      startIndex + pageSize
    );

  const visibleIds =
    paginatedPosts.map(
      (post) => post.id
    );

  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) =>
      selectedPostIds.includes(id)
    );

  const selectedPosts =
    posts.filter((post) =>
      selectedPostIds.includes(
        post.id
      )
    );

  const selectedDrafts =
    selectedPosts.filter(
      (post) =>
        post.status === "DRAFT"
    );

  const selectedSchedules =
    selectedPosts.filter(
      (post) =>
        post.status === "SCHEDULED"
    );

  const dashboardFilteredCampaigns = dashboardCampaigns.filter(
    (campaign) => dashboardBusinessId === "all" ||
      String(campaign.businessId) === dashboardBusinessId
  );
  const dashboardGoogleDrafts = dashboardFilteredCampaigns.filter(
    (campaign) => campaign.platform === "Google Ads"
  );
  const dashboardMetaDrafts = dashboardFilteredCampaigns.filter(
    (campaign) => campaign.platform === "Meta Ads"
  );
  const dashboardBudgetCents = dashboardFilteredCampaigns.reduce(
    (total, campaign) => total + Math.round(Number(campaign.dailyBudget) * 100), 0
  );
  const dashboardAttentionPosts = dashboardPosts.filter(
    (post) => ["FAILED", "REVIEW_REQUIRED"].includes(post.status)
  );
  const dashboardUpcomingPosts = dashboardPosts
    .filter((post) => post.status === "SCHEDULED" && !!post.scheduledAt)
    .sort((a, b) => parseIST(a.scheduledAt!).getTime() - parseIST(b.scheduledAt!).getTime())
    .slice(0, 5);

  const dashboardStats = [
    [
      "Businesses",
      dashboardBusinesses.length,
    ],
    [
      "Draft Posts",
      dashboardPosts.filter(
        (post) =>
          post.status === "DRAFT"
      ).length,
    ],
    [
      "Scheduled Posts",
      dashboardPosts.filter(
        (post) =>
          post.status === "SCHEDULED"
      ).length,
    ],
    [
      "Processing",
      dashboardPosts.filter(
        (post) =>
          post.status === "PROCESSING"
      ).length,
    ],
    [
      "Failed Posts",
      dashboardPosts.filter(
        (post) =>
          post.status === "FAILED"
      ).length,
    ],
    [
      "Published Posts",
      dashboardPosts.filter(
        (post) =>
          post.status === "PUBLISHED"
      ).length,
    ],
    [
      "Review Required",
      dashboardPosts.filter(
        (post) =>
          post.status ===
          "REVIEW_REQUIRED"
      ).length,
    ],
  ] as const;

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetSelection() {
    setSelectedPostIds([]);
  }

  function togglePostSelection(
    id: number
  ) {
    setSelectedPostIds(
      (current) =>
        current.includes(id)
          ? current.filter(
              (item) =>
                item !== id
            )
          : [
              ...current,
              id,
            ]
    );
  }

  function toggleVisibleSelection() {
    setSelectedPostIds(
      (current) =>
        allVisibleSelected
          ? current.filter(
              (id) =>
                !visibleIds.includes(
                  id
                )
            )
          : [
              ...new Set([
                ...current,
                ...visibleIds,
              ]),
            ]
    );
  }

  const loadBusinesses =
    useCallback(async () => {
      setLoadingBusinesses(
        true
      );

      try {
        const response =
          await secureFetch(
            "/api/businesses"
          );

        await checkResponse(
          response,
          "Unable to load businesses."
        );

        const data: Business[] =
          await response.json();

        setBusinesses(data);

        const keepSelected = (
          current: string
        ) =>
          data.some(
            (business) =>
              String(
                business.id
              ) === current
          )
            ? current
            : data.length > 0
              ? String(
                  data[0].id
                )
              : "";

        const keepFilter = (
          current: string
        ) =>
          current === "all" ||
          data.some(
            (business) =>
              String(
                business.id
              ) === current
          )
            ? current
            : "all";

        setSelectedBusinessId(
          keepSelected
        );

        setAdvertisingBusinessId(
          keepSelected
        );

        setDashboardBusinessId(
          keepFilter
        );

        setScheduleBusinessId(
          keepFilter
        );

        setPostBusinessId(
          keepFilter
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Could not load businesses."
          )
        );
      } finally {
        setLoadingBusinesses(
          false
        );
      }
    }, []);

  const loadPosts =
    useCallback(async () => {
      setLoadingPosts(true);

      try {
        const response =
          await secureFetch(
            "/api/posts"
          );

        await checkResponse(
          response,
          "Unable to load posts."
        );

        const data: Post[] =
          await response.json();

        setPosts(data);

        setSelectedPostIds(
          (current) =>
            current.filter(
              (id) =>
                data.some(
                  (post) =>
                    post.id ===
                    id
                )
            )
        );
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Could not load posts."
          )
        );
      } finally {
        setLoadingPosts(
          false
        );
      }
    }, []);

  useEffect(() => {
    async function checkBackend() {
      try {
        const response =
          await fetch(
            "/api/health"
          );

        const message =
          await response.text();

        setBackendStatus(
          response.ok &&
            message.includes(
              "MarketFlow Backend is Running!"
            )
            ? "Online"
            : "Offline"
        );
      } catch {
        setBackendStatus(
          "Offline"
        );
      }
    }

    void checkBackend();
    void loadBusinesses();
    void loadPosts();
  }, [
    loadBusinesses,
    loadPosts,
  ]);

  async function registerBusiness() {
    if (
      !businessName.trim() ||
      registeringBusiness
    ) {
      return;
    }

    setRegisteringBusiness(
      true
    );

    clearMessages();

    try {
      const response =
        await secureFetch(
          "/api/businesses",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: businessName.trim(),
              city: businessCity.trim(),
              state: businessState.trim(),
              country:
                businessCountry.trim() ||
                "India",
            }),
          }
        );

      if (
        response.status ===
        409
      ) {
        throw new Error(
          "A business with this name already exists."
        );
      }

      await checkResponse(
        response,
        "Unable to register business."
      );

      const created: Business =
        await response.json();

      setBusinessName("");
      setBusinessCity("");
      setBusinessState("");
      setBusinessCountry(
        "India"
      );

      await loadBusinesses();

      setSelectedBusinessId(
        String(created.id)
      );

      setSuccess(
        `Business "${created.name}" registered successfully!`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to register business."
        )
      );
    } finally {
      setRegisteringBusiness(
        false
      );
    }
  }

  function startEditingBusiness(
    business: Business
  ) {
    setEditingBusinessId(
      business.id
    );

    setEditBusinessCity(
      business.city ?? ""
    );

    setEditBusinessState(
      business.state ?? ""
    );

    setEditBusinessCountry(
      business.country ??
        "India"
    );

    clearMessages();
  }

  function cancelEditingBusiness() {
    setEditingBusinessId(
      null
    );

    setEditBusinessCity("");
    setEditBusinessState("");
    setEditBusinessCountry(
      "India"
    );
  }

  async function updateBusiness() {
    if (
      editingBusinessId ===
        null ||
      updatingBusiness
    ) {
      return;
    }

    const business =
      businesses.find(
        (item) =>
          item.id ===
          editingBusinessId
      );

    if (!business) {
      setError(
        "Business not found."
      );
      return;
    }

    setUpdatingBusiness(
      true
    );

    clearMessages();

    try {
      const response =
        await secureFetch(
          `/api/businesses/${editingBusinessId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: business.name,
              city: editBusinessCity.trim(),
              state: editBusinessState.trim(),
              country:
                editBusinessCountry.trim() ||
                "India",
            }),
          }
        );

      await checkResponse(
        response,
        "Unable to update business."
      );

      cancelEditingBusiness();

      await loadBusinesses();

      setSuccess(
        "Business updated successfully!"
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to update business."
        )
      );
    } finally {
      setUpdatingBusiness(
        false
      );
    }
  }

  async function saveDraft() {
    if (
      !content.trim() ||
      saving
    ) {
      return;
    }

    if (
      !selectedBusiness
    ) {
      setError(
        "Please select a registered business."
      );
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const response =
        await secureFetch(
          "/api/posts",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              businessName:
                selectedBusiness.name,
              platform,
              content:
                content.trim(),
            }),
          }
        );

      await checkResponse(
        response,
        "Unable to save draft."
      );

      setContent("");

      await loadPosts();

      setSuccess(
        "Draft saved successfully!"
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to save draft."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(
    post: Post
  ) {
    setEditingPostId(
      post.id
    );

    setEditPlatform(
      post.platform
    );

    setEditContent(
      post.content
    );

    clearMessages();
  }

  function cancelEditing() {
    setEditingPostId(
      null
    );

    setEditPlatform(
      "Facebook"
    );

    setEditContent("");
  }

  async function updateDraft() {
    if (
      editingPostId ===
        null ||
      !editContent.trim() ||
      updating
    ) {
      return;
    }

    setUpdating(true);
    clearMessages();

    try {
      const response =
        await secureFetch(
          `/api/posts/${editingPostId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              platform:
                editPlatform,
              content:
                editContent.trim(),
            }),
          }
        );

      await checkResponse(
        response,
        "Unable to update draft."
      );

      cancelEditing();

      await loadPosts();

      setSuccess(
        "Draft updated successfully!"
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to update draft."
        )
      );
    } finally {
      setUpdating(false);
    }
  }

  async function deleteDraft(id: number) {
    const post = posts.find((item) => item.id === id);
    if (!post || post.status !== "DRAFT" || pendingPostActions.current.has(id) || bulkWorking) return;
    if (!window.confirm(`Permanently delete draft #${id}? This cannot be undone.`)) return;
    if (!lockPost(id)) return;
    setDeletingDraftId(id);
    clearMessages();
    try {
      const response = await secureFetch(`/api/posts/${id}`, { method: "DELETE" });
      await checkResponse(response, `Unable to delete draft #${id}.`);
      if (editingPostId === id) cancelEditing();
      setSelectedPostIds((current) => current.filter((item) => item !== id));
      await loadPosts();
      setSuccess(`Draft #${id} deleted successfully.`);
    } catch (err) {
      setError(getErrorMessage(err, `Failed to delete draft #${id}.`));
    } finally {
      unlockPost(id);
      setDeletingDraftId(null);
    }
  }

  async function schedulePost() {
    if (schedulingLock.current || bulkWorking) return;
    if (!selectedPostId || !scheduledAt) {
      setError("Select a draft, date, and time.");
      return;
    }
    if (!isFutureIST(scheduledAt)) {
      setError("Choose a future date and time in IST.");
      return;
    }
    const post = filteredDrafts.find((item) => String(item.id) === selectedPostId);
    if (!post || post.status !== "DRAFT") {
      setError("Select an available draft from the chosen business.");
      return;
    }
    if (!lockPost(post.id)) return;
    schedulingLock.current = true;
    setScheduling(true);
    clearMessages();
    try {
      const response = await secureFetch(`/api/posts/${post.id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      await checkResponse(response, `Unable to schedule post #${post.id}.`);
      setSelectedPostId("");
      setScheduledAt("");
      await loadPosts();
      setSuccess(`Post #${post.id} scheduled successfully for ${formatDateTime(scheduledAt)}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to schedule post."));
    } finally {
      unlockPost(post.id);
      schedulingLock.current = false;
      setScheduling(false);
    }
  }

  function startRescheduling(
    post: Post
  ) {
    setReschedulingPostId(
      post.id
    );

    setNewScheduledAt(
      post.scheduledAt?.slice(
        0,
        16
      ) ?? ""
    );

    clearMessages();
  }

  function cancelRescheduling() {
    setReschedulingPostId(
      null
    );

    setNewScheduledAt("");
  }

  async function reschedulePost() {
    if (reschedulingLock.current || bulkWorking || reschedulingPostId === null) return;
    if (!newScheduledAt || !isFutureIST(newScheduledAt)) {
      setError("Choose a future date and time in IST.");
      return;
    }
    const post = posts.find((item) => item.id === reschedulingPostId);
    if (!post || post.status !== "SCHEDULED") {
      setError("Scheduled post not found. Refresh the posts and try again.");
      return;
    }
    if (!lockPost(post.id)) return;
    reschedulingLock.current = true;
    setRescheduling(true);
    clearMessages();
    try {
      const response = await secureFetch(`/api/posts/${post.id}/reschedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: newScheduledAt }),
      });
      await checkResponse(response, `Unable to reschedule post #${post.id}.`);
      const chosenDate = newScheduledAt;
      cancelRescheduling();
      await loadPosts();
      setSuccess(`Post #${post.id} rescheduled for ${formatDateTime(chosenDate)}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reschedule post."));
    } finally {
      unlockPost(post.id);
      reschedulingLock.current = false;
      setRescheduling(false);
    }
  }

  async function cancelScheduledPost(id: number) {
    const post = posts.find((item) => item.id === id);
    if (!post || post.status !== "SCHEDULED" || pendingPostActions.current.has(id) || bulkWorking) return;
    if (!window.confirm(`Cancel the schedule for post #${id} and return it to drafts?`)) return;
    if (!lockPost(id)) return;
    setCancellingPostId(id);
    clearMessages();
    try {
      const response = await secureFetch(`/api/posts/${id}/cancel`, { method: "PUT" });
      await checkResponse(response, `Unable to cancel schedule for post #${id}.`);
      if (reschedulingPostId === id) cancelRescheduling();
      setSelectedPostIds((current) => current.filter((item) => item !== id));
      await loadPosts();
      setSuccess(`Schedule for post #${id} cancelled. Post returned to drafts.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to cancel schedule."));
    } finally {
      unlockPost(id);
      setCancellingPostId(null);
    }
  }

  async function runBulkAction(
    action:
      | "delete"
      | "cancel"
  ) {
    if (bulkWorking || pendingPostActions.current.size > 0 || schedulingLock.current || reschedulingLock.current) return;

    const eligible =
      action === "delete"
        ? selectedDrafts
        : selectedSchedules;

    if (
      eligible.length === 0
    ) {
      return;
    }

    const question =
      action === "delete"
        ? `Permanently delete ${eligible.length} selected draft(s)?`
        : `Cancel ${eligible.length} schedule(s) and return them to drafts?`;

    if (
      !window.confirm(
        question
      )
    ) {
      return;
    }

    setBulkWorking(true);
    clearMessages();

    let completed = 0;
    const failedIds: number[] =
      [];

    try {
      for (
        const post of eligible
      ) {
        try {
          const response =
            await secureFetch(
              action ===
                "delete"
                ? `/api/posts/${post.id}`
                : `/api/posts/${post.id}/cancel`,
              {
                method:
                  action ===
                  "delete"
                    ? "DELETE"
                    : "PUT",
              }
            );

          await checkResponse(
            response,
            `Unable to update post #${post.id}.`
          );

          completed++;
        } catch {
          failedIds.push(
            post.id
          );
        }
      }

      resetSelection();
      cancelEditing();
      cancelRescheduling();

      await loadPosts();

      if (
        failedIds.length >
        0
      ) {
        setError(
          `${completed} completed. Failed post IDs: ${failedIds.join(", ")}.`
        );
      } else {
        setSuccess(
          `${completed} post(s) ${
            action ===
            "delete"
              ? "deleted"
              : "returned to drafts"
          } successfully.`
        );
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Bulk operation failed."
        )
      );
    } finally {
      setBulkWorking(
        false
      );
    }
  }

  function renderDraftActions(
    post: Post
  ) {
    if (
      editingPostId ===
      post.id
    ) {
      return (
        <div>
          <h3>
            Edit Draft #{post.id}
          </h3>

          <label
            htmlFor={`edit-platform-${post.id}`}
          >
            Platform
          </label>

          <select
            id={`edit-platform-${post.id}`}
            value={editPlatform}
            onChange={(event) =>
              setEditPlatform(
                event.target.value
              )
            }
            style={inputStyle}
          >
            {platforms.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          <label
            htmlFor={`edit-content-${post.id}`}
          >
            Post Content
          </label>

          <textarea
            id={`edit-content-${post.id}`}
            value={editContent}
            onChange={(event) =>
              setEditContent(
                event.target.value
              )
            }
          />

          <div
            style={buttonRowStyle}
          >
            <button
              className="primary"
              onClick={() =>
                void updateDraft()
              }
              disabled={
                updating ||
                bulkWorking ||
                !editContent.trim()
              }
            >
              {updating
                ? "Updating..."
                : "Save Changes"}
            </button>

            <button
              onClick={
                cancelEditing
              }
              disabled={
                updating
              }
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        style={buttonRowStyle}
      >
        <button
          className="primary"
          onClick={() =>
            startEditing(
              post
            )
          }
          disabled={
            bulkWorking
          }
        >
          Edit Draft
        </button>

        <button
          onClick={() =>
            void deleteDraft(
              post.id
            )
          }
          disabled={bulkWorking || deletingDraftId === post.id}
        >
          {deletingDraftId === post.id ? "Deleting..." : "Delete Draft"}
        </button>
      </div>
    );
  }

  function renderScheduledActions(
    post: Post
  ) {
    if (
      reschedulingPostId ===
      post.id
    ) {
      return (
        <div>
          <label
            htmlFor={`reschedule-${post.id}`}
          >
            New Date and Time (IST)
          </label>

          <input
            id={`reschedule-${post.id}`}
            type="datetime-local"
            value={
              newScheduledAt
            }
            onChange={(event) =>
              setNewScheduledAt(
                event.target.value
              )
            }
            style={inputStyle}
          />

          <div
            style={buttonRowStyle}
          >
            <button
              className="primary"
              onClick={() =>
                void reschedulePost()
              }
              disabled={
                rescheduling ||
                bulkWorking ||
                !newScheduledAt ||
                !isFutureIST(newScheduledAt)
              }
            >
              {rescheduling
                ? "Saving..."
                : "Save New Date"}
            </button>

            <button
              onClick={
                cancelRescheduling
              }
              disabled={
                rescheduling
              }
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        style={buttonRowStyle}
      >
        <button
          className="primary"
          onClick={() =>
            startRescheduling(
              post
            )
          }
          disabled={
            bulkWorking
          }
        >
          Reschedule
        </button>

        <button
          onClick={() =>
            void cancelScheduledPost(
              post.id
            )
          }
          disabled={
            bulkWorking ||
            rescheduling ||
            cancellingPostId === post.id
          }
        >
          {cancellingPostId ===
          post.id
            ? "Cancelling..."
            : "Cancel Schedule"}
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>MarketFlow</h2>

        <p>
          Marketing Automation
        </p>

        {(
          [
            "Dashboard",
            "Businesses",
            "Create Post",
            "Content Templates",
            "Post Management",
            "Schedule",
            "Advertising",
            "Analytics",
          ] as Section[]
        ).map(
          (item) => (
            <button
              key={item}
              className={
                section ===
                item
                  ? "active"
                  : ""
              }
              onClick={() => {
                setSection(
                  item
                );
                clearMessages();
              }}
            >
              {item}
            </button>
          )
        )}
      </aside>

      <main className="main">
        <header>
          <h1>
            {section}
          </h1>

          <span>
            Development MVP
          </span>
        </header>

        {error && (
          <div className="card">
            <p
              role="alert"
              style={{
                color:
                  "#dc2626",
              }}
            >
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="card">
            <p
              role="status"
              style={{
                color:
                  "#15803d",
              }}
            >
              {success}
            </p>
          </div>
        )}

        {section ===
          "Dashboard" && (
          <>
            <h2>
              Welcome to MarketFlow
            </h2>

            <div className="card">
              <h3>
                Select Business
              </h3>

              <label
                htmlFor="dashboard-business"
              >
                View dashboard for
              </label>

              <BusinessSelector
                id="dashboard-business"
                value={
                  dashboardBusinessId
                }
                businesses={
                  businesses
                }
                onChange={
                  setDashboardBusinessId
                }
                disabled={
                  loadingBusinesses
                }
              />
            </div>

            <div className="cards">
              {dashboardStats.map(
                ([
                  label,
                  value,
                ]) => (
                  <MetricCard
                    key={
                      label
                    }
                    label={
                      label
                    }
                    value={
                      value
                    }
                  />
                )
              )}
            </div>

            <div className="card">
              <h3>Advertising Draft Summary</h3>
              <p>PostgreSQL planning figures only. No live ad spending or performance data.</p>
              <button type="button" disabled={dashboardCampaignLoading}
                onClick={() => setDashboardReloadVersion((value) => value + 1)}>
                Refresh Advertising Summary
              </button>
              {dashboardCampaignLoading ? <p role="status">Loading campaign drafts...</p> :
                dashboardCampaignError ? <p role="alert" style={{ color: "#dc2626" }}>{dashboardCampaignError}</p> :
                <div className="cards">
                  <MetricCard label="Google Ads Drafts" value={dashboardGoogleDrafts.length} />
                  <MetricCard label="Meta Ads Drafts" value={dashboardMetaDrafts.length} />
                  <MetricCard label="All Advertising Drafts" value={dashboardFilteredCampaigns.length} />
                  <MetricCard label="Combined Planned Daily Budget" value={currencyFormatter.format(dashboardBudgetCents / 100)} />
                </div>}
            </div>

            <div className="card">
              <h3>Posts Requiring Attention</h3>
              {loadingPosts ? <p>Loading posts...</p> : dashboardAttentionPosts.length === 0 ?
                <p>No failed or review-required posts in this business view.</p> :
                <>
                  <p><strong>{dashboardAttentionPosts.length}</strong> post(s) need attention.</p>
                  {dashboardAttentionPosts.slice(0, 5).map((post) =>
                    <div key={post.id} style={postRowStyle}>
                      <strong>Post #{post.id} — {post.platform}</strong>
                      <p>{post.businessName}</p>
                      <StatusBadge status={post.status} />
                    </div>
                  )}
                  <button type="button" onClick={() => setSection("Post Management")}>Open Post Management</button>
                </>}
            </div>

            <div className="card">
              <h3>Upcoming Scheduled Posts</h3>
              {loadingPosts ? <p>Loading schedules...</p> : dashboardUpcomingPosts.length === 0 ?
                <p>No scheduled posts in this business view.</p> :
                dashboardUpcomingPosts.map((post) =>
                  <div key={post.id} style={postRowStyle}>
                    <strong>Post #{post.id} — {post.platform}</strong>
                    <p>{post.businessName} — {formatDateTime(post.scheduledAt)}</p>
                  </div>
                )}
            </div>

            <div className="card">
              <h3>
                Registered Businesses
              </h3>

              {loadingBusinesses ? (
                <p>
                  Loading businesses...
                </p>
              ) : dashboardBusinesses.length ===
                0 ? (
                <p>
                  No businesses found.
                </p>
              ) : (
                dashboardBusinesses.map(
                  (
                    business
                  ) => (
                    <div
                      key={
                        business.id
                      }
                      style={
                        postRowStyle
                      }
                    >
                      <p>
                        <strong>
                          {
                            business.name
                          }
                        </strong>
                      </p>

                      <p>
                        {[
                          business.city,
                          business.state,
                          business.country,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ", "
                          )}
                      </p>

                      <small>
                        Business ID:{" "}
                        {
                          business.id
                        }
                      </small>
                    </div>
                  )
                )
              )}
            </div>

            <div className="card">
              <h3>
                Backend Connection
              </h3>

              <p>
                Spring Boot API:{" "}
                <strong>
                  {
                    backendStatus
                  }
                </strong>
              </p>
            </div>

            <div className="card">
              <h3>
                Publishing Status
              </h3>

              <p>
                Automatic social media
                publishing is not
                connected yet.
              </p>
            </div>

            <div className="card">
              <h3>
                Advertising Status
              </h3>

              <p>
                Google Ads and Meta Ads
                campaign drafting and
                management are available.
              </p>

              <p>
                Advertising account
                connections are not active.
              </p>

              <button
                className="primary"
                onClick={() =>
                  setSection(
                    "Advertising"
                  )
                }
              >
                Open Advertising
              </button>
            </div>

            <div className="card">
              <h3>
                Recent Post Status
              </h3>

              {loadingPosts ? (
                <p>
                  Loading posts...
                </p>
              ) : dashboardPosts.length ===
                0 ? (
                <p>
                  No posts available
                  for this business.
                </p>
              ) : (
                dashboardPosts.map(
                  (post) => (
                    <div
                      key={
                        post.id
                      }
                      style={
                        postRowStyle
                      }
                    >
                      <PostDetails
                        post={
                          post
                        }
                      />
                    </div>
                  )
                )
              )}

              <button
                onClick={() =>
                  void loadPosts()
                }
                disabled={
                  loadingPosts
                }
              >
                Refresh Posts
              </button>
            </div>
          </>
        )}

        {section ===
          "Businesses" && (
          <>
            <div className="card">
              <h2>
                Register New Business
              </h2>

              <form
                onSubmit={(
                  event
                ) => {
                  event.preventDefault();
                  void registerBusiness();
                }}
              >
                <label
                  htmlFor="business-name"
                >
                  Business Name *
                </label>

                <input
                  id="business-name"
                  value={
                    businessName
                  }
                  onChange={(
                    event
                  ) =>
                    setBusinessName(
                      event
                        .target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                  maxLength={
                    255
                  }
                  required
                />

                <label
                  htmlFor="business-city"
                >
                  City
                </label>

                <input
                  id="business-city"
                  value={
                    businessCity
                  }
                  onChange={(
                    event
                  ) =>
                    setBusinessCity(
                      event
                        .target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                  maxLength={
                    255
                  }
                />

                <label
                  htmlFor="business-state"
                >
                  State
                </label>

                <input
                  id="business-state"
                  value={
                    businessState
                  }
                  onChange={(
                    event
                  ) =>
                    setBusinessState(
                      event
                        .target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                  maxLength={
                    255
                  }
                />

                <label
                  htmlFor="business-country"
                >
                  Country
                </label>

                <input
                  id="business-country"
                  value={
                    businessCountry
                  }
                  onChange={(
                    event
                  ) =>
                    setBusinessCountry(
                      event
                        .target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                  maxLength={
                    255
                  }
                />

                <button
                  className="primary"
                  type="submit"
                  disabled={
                    registeringBusiness ||
                    !businessName.trim()
                  }
                >
                  {registeringBusiness
                    ? "Registering..."
                    : "Register Business"}
                </button>
              </form>
            </div>

            <div className="card">
              <h2>
                Registered Businesses (
                {
                  businesses.length
                }
                )
              </h2>

              {loadingBusinesses ? (
                <p>
                  Loading businesses...
                </p>
              ) : businesses.length ===
                0 ? (
                <p>
                  No businesses
                  registered yet.
                </p>
              ) : (
                businesses.map(
                  (
                    business
                  ) => (
                    <div
                      key={
                        business.id
                      }
                      style={
                        postRowStyle
                      }
                    >
                      <p>
                        <strong>
                          {
                            business.name
                          }
                        </strong>
                      </p>

                      <p>
                        {[
                          business.city,
                          business.state,
                          business.country,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ", "
                          )}
                      </p>

                      <small>
                        Business ID:{" "}
                        {
                          business.id
                        }
                      </small>

                      {editingBusinessId ===
                      business.id ? (
                        <div
                          style={{
                            marginTop:
                              "20px",
                          }}
                        >
                          <h3>
                            Edit Business
                          </h3>

                          <label>
                            Business Name
                            (Read Only)
                          </label>

                          <input
                            value={
                              business.name
                            }
                            disabled
                            style={
                              inputStyle
                            }
                          />

                          <label
                            htmlFor={`city-${business.id}`}
                          >
                            City
                          </label>

                          <input
                            id={`city-${business.id}`}
                            value={
                              editBusinessCity
                            }
                            onChange={(
                              event
                            ) =>
                              setEditBusinessCity(
                                event
                                  .target
                                  .value
                              )
                            }
                            style={
                              inputStyle
                            }
                          />

                          <label
                            htmlFor={`state-${business.id}`}
                          >
                            State
                          </label>

                          <input
                            id={`state-${business.id}`}
                            value={
                              editBusinessState
                            }
                            onChange={(
                              event
                            ) =>
                              setEditBusinessState(
                                event
                                  .target
                                  .value
                              )
                            }
                            style={
                              inputStyle
                            }
                          />

                          <label
                            htmlFor={`country-${business.id}`}
                          >
                            Country
                          </label>

                          <input
                            id={`country-${business.id}`}
                            value={
                              editBusinessCountry
                            }
                            onChange={(
                              event
                            ) =>
                              setEditBusinessCountry(
                                event
                                  .target
                                  .value
                              )
                            }
                            style={
                              inputStyle
                            }
                          />

                          <div
                            style={
                              buttonRowStyle
                            }
                          >
                            <button
                              className="primary"
                              onClick={() =>
                                void updateBusiness()
                              }
                              disabled={
                                updatingBusiness
                              }
                            >
                              {updatingBusiness
                                ? "Saving..."
                                : "Save Changes"}
                            </button>

                            <button
                              onClick={
                                cancelEditingBusiness
                              }
                              disabled={
                                updatingBusiness
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="primary"
                          onClick={() =>
                            startEditingBusiness(
                              business
                            )
                          }
                        >
                          Edit Business
                        </button>
                      )}
                    </div>
                  )
                )
              )}

              <button
                onClick={() =>
                  void loadBusinesses()
                }
                disabled={
                  loadingBusinesses
                }
                style={{
                  marginTop:
                    "20px",
                }}
              >
                Refresh Businesses
              </button>
            </div>
          </>
        )}

        {section === "Content Templates" && (
          <ContentTemplatesManager businesses={businesses} onUse={(template) => {
            setSelectedBusinessId(String(template.businessId));
            setPlatform(template.platform);
            setContent(template.content);
            setSection("Create Post");
            clearMessages();
          }} />
        )}

        {section ===
          "Create Post" && (
          <div className="card">
            <h2>
              Create a Post
            </h2>

            <label
              htmlFor="create-business"
            >
              Select Business
            </label>

            <BusinessSelector
              id="create-business"
              value={
                selectedBusinessId
              }
              businesses={
                businesses
              }
              includeAll={
                false
              }
              disabled={
                loadingBusinesses
              }
              onChange={(
                value
              ) => {
                setSelectedBusinessId(
                  value
                );
                cancelEditing();
                clearMessages();
              }}
            />

            <label
              htmlFor="create-platform"
            >
              Social Media Platform
            </label>

            <select
              id="create-platform"
              value={
                platform
              }
              onChange={(
                event
              ) =>
                setPlatform(
                  event
                    .target
                    .value
                )
              }
              style={
                inputStyle
              }
            >
              {platforms.map(
                (item) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {item}
                  </option>
                )
              )}
            </select>

            <TemplatePicker businessId={selectedBusinessId} platform={platform}
              onUse={(template) => { setContent(template.content); clearMessages(); }} />

            <textarea
              placeholder="Write your social media content..."
              value={
                content
              }
              onChange={(
                event
              ) =>
                setContent(
                  event
                    .target
                    .value
                )
              }
            />

            <button
              className="primary"
              onClick={() =>
                void saveDraft()
              }
              disabled={
                saving ||
                !selectedBusiness ||
                !content.trim()
              }
            >
              {saving
                ? "Saving..."
                : "Save Draft"}
            </button>

            <h3>
              Saved Drafts (
              {
                businessDrafts.length
              }
              )
            </h3>

            <p>
              Showing drafts for:{" "}
              <strong>
                {selectedBusiness?.name ??
                  "No business selected"}
              </strong>
            </p>

            {loadingPosts ? (
              <p>
                Loading posts...
              </p>
            ) : businessDrafts.length ===
              0 ? (
              <p>
                No drafts saved for
                this business yet.
              </p>
            ) : (
              businessDrafts.map(
                (post) => (
                  <div
                    key={
                      post.id
                    }
                    style={
                      postRowStyle
                    }
                  >
                    <PostDetails
                      post={
                        post
                      }
                    />

                    {renderDraftActions(
                      post
                    )}
                  </div>
                )
              )
            )}
          </div>
        )}

        {section ===
          "Post Management" && (
          <>
            <div className="card">
              <h2>
                Search and Filter Posts
              </h2>

              <label
                htmlFor="post-search"
              >
                Search
              </label>

              <input
                id="post-search"
                type="search"
                placeholder="Search content, platform, business, or post ID"
                value={
                  postSearch
                }
                onChange={(
                  event
                ) => {
                  setPostSearch(
                    event
                      .target
                      .value
                  );
                  setCurrentPage(
                    1
                  );
                  resetSelection();
                }}
                style={{
                  ...inputStyle,
                  maxWidth:
                    "650px",
                }}
              />

              <label
                htmlFor="management-business"
              >
                Business
              </label>

              <BusinessSelector
                id="management-business"
                value={
                  postBusinessId
                }
                businesses={
                  businesses
                }
                onChange={(
                  value
                ) => {
                  setPostBusinessId(
                    value
                  );
                  setCurrentPage(
                    1
                  );
                  resetSelection();
                  cancelEditing();
                  cancelRescheduling();
                }}
              />

              <label
                htmlFor="management-status"
              >
                Status
              </label>

              <select
                id="management-status"
                value={
                  postStatus
                }
                onChange={(
                  event
                ) => {
                  setPostStatus(
                    event
                      .target
                      .value
                  );
                  setCurrentPage(
                    1
                  );
                  resetSelection();
                }}
                style={
                  inputStyle
                }
              >
                <option
                  value="all"
                >
                  All Statuses
                </option>

                {statuses.map(
                  (
                    status
                  ) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {status.replaceAll(
                        "_",
                        " "
                      )}
                    </option>
                  )
                )}
              </select>

              <label
                htmlFor="post-sort"
              >
                Sort Posts
              </label>

              <select
                id="post-sort"
                value={
                  sortOrder
                }
                onChange={(
                  event
                ) => {
                  setSortOrder(
                    event
                      .target
                      .value as SortOrder
                  );
                  setCurrentPage(
                    1
                  );
                  resetSelection();
                }}
                style={
                  inputStyle
                }
              >
                <option
                  value="newest"
                >
                  Newest First
                </option>

                <option
                  value="oldest"
                >
                  Oldest First
                </option>

                <option
                  value="scheduled_asc"
                >
                  Scheduled Date:
                  Earliest First
                </option>

                <option
                  value="scheduled_desc"
                >
                  Scheduled Date:
                  Latest First
                </option>
              </select>

              <label
                htmlFor="page-size"
              >
                Posts Per Page
              </label>

              <select
                id="page-size"
                value={
                  pageSize
                }
                onChange={(
                  event
                ) => {
                  setPageSize(
                    Number(
                      event
                        .target
                        .value
                    )
                  );
                  setCurrentPage(
                    1
                  );
                  resetSelection();
                }}
                style={
                  inputStyle
                }
              >
                {[
                  5,
                  10,
                  20,
                ].map(
                  (
                    size
                  ) => (
                    <option
                      key={
                        size
                      }
                      value={
                        size
                      }
                    >
                      {size} Posts
                    </option>
                  )
                )}
              </select>

              <div
                style={
                  buttonRowStyle
                }
              >
                <button
                  onClick={() => {
                    setPostSearch(
                      ""
                    );
                    setPostBusinessId(
                      "all"
                    );
                    setPostStatus(
                      "all"
                    );
                    setSortOrder(
                      "newest"
                    );
                    setPageSize(
                      5
                    );
                    setCurrentPage(
                      1
                    );
                    resetSelection();
                  }}
                >
                  Clear Filters
                </button>

                <button
                  onClick={() =>
                    void loadPosts()
                  }
                  disabled={
                    loadingPosts ||
                    bulkWorking
                  }
                >
                  Refresh Posts
                </button>
              </div>
            </div>

            <div className="card">
              <h2>
                Bulk Actions
              </h2>

              <p>
                <strong>
                  {
                    selectedPostIds.length
                  }
                </strong>{" "}
                post(s) selected
              </p>

              <p>
                Eligible drafts:{" "}
                <strong>
                  {
                    selectedDrafts.length
                  }
                </strong>
                {" | "}
                Eligible scheduled
                posts:{" "}
                <strong>
                  {
                    selectedSchedules.length
                  }
                </strong>
              </p>

              <div
                style={
                  buttonRowStyle
                }
              >
                <button
                  onClick={
                    toggleVisibleSelection
                  }
                  disabled={
                    bulkWorking ||
                    visibleIds.length ===
                      0
                  }
                >
                  {allVisibleSelected
                    ? "Deselect Current Page"
                    : "Select Current Page"}
                </button>

                <button
                  onClick={
                    resetSelection
                  }
                  disabled={
                    bulkWorking ||
                    selectedPostIds.length ===
                      0
                  }
                >
                  Clear Selection
                </button>

                <button
                  onClick={() =>
                    void runBulkAction(
                      "delete"
                    )
                  }
                  disabled={
                    bulkWorking ||
                    selectedDrafts.length ===
                      0
                  }
                  style={{
                    background:
                      "#b91c1c",
                    color:
                      "#fff",
                  }}
                >
                  {bulkWorking
                    ? "Processing..."
                    : `Delete ${selectedDrafts.length} Draft(s)`}
                </button>

                <button
                  onClick={() =>
                    void runBulkAction(
                      "cancel"
                    )
                  }
                  disabled={
                    bulkWorking ||
                    selectedSchedules.length ===
                      0
                  }
                >
                  {bulkWorking
                    ? "Processing..."
                    : `Cancel ${selectedSchedules.length} Schedule(s)`}
                </button>
              </div>

              <p
                style={{
                  fontSize:
                    "13px",
                  marginTop:
                    "15px",
                }}
              >
                Only drafts can be
                deleted. Only scheduled
                posts can have schedules
                cancelled.
              </p>
            </div>

            <div className="card">
              <h2>
                Posts (
                {
                  filteredManagementPosts.length
                }{" "}
                of{" "}
                {
                  posts.length
                }
                )
              </h2>

              {filteredManagementPosts.length >
                0 && (
                <p>
                  Showing{" "}
                  {startIndex +
                    1}
                  -
                  {Math.min(
                    startIndex +
                      pageSize,
                    filteredManagementPosts.length
                  )}{" "}
                  of{" "}
                  {
                    filteredManagementPosts.length
                  }
                </p>
              )}

              {loadingPosts ? (
                <p>
                  Loading posts...
                </p>
              ) : paginatedPosts.length ===
                0 ? (
                <p>
                  No posts match your
                  filters.
                </p>
              ) : (
                paginatedPosts.map(
                  (
                    post
                  ) => (
                    <div
                      key={
                        post.id
                      }
                      style={
                        postRowStyle
                      }
                    >
                      <label
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap:
                            "10px",
                          marginBottom:
                            "12px",
                          fontWeight:
                            600,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPostIds.includes(
                            post.id
                          )}
                          onChange={() =>
                            togglePostSelection(
                              post.id
                            )
                          }
                          disabled={
                            bulkWorking
                          }
                          style={{
                            width:
                              "18px",
                            height:
                              "18px",
                          }}
                        />

                        Select Post #
                        {
                          post.id
                        }
                      </label>

                      <PostDetails
                        post={
                          post
                        }
                      />

                      {post.status ===
                        "DRAFT" &&
                        renderDraftActions(
                          post
                        )}

                      {post.status ===
                        "SCHEDULED" &&
                        renderScheduledActions(
                          post
                        )}
                    </div>
                  )
                )
              )}

              {totalPages >
                1 && (
                <div
                  style={{
                    ...buttonRowStyle,
                    marginTop:
                      "20px",
                  }}
                >
                  <button
                    onClick={() =>
                      setCurrentPage(
                        (
                          page
                        ) =>
                          Math.max(
                            1,
                            page -
                              1
                          )
                      )
                    }
                    disabled={
                      safePage ===
                        1 ||
                      bulkWorking
                    }
                  >
                    Previous
                  </button>

                  <strong>
                    Page{" "}
                    {
                      safePage
                    }{" "}
                    of{" "}
                    {
                      totalPages
                    }
                  </strong>

                  <button
                    onClick={() =>
                      setCurrentPage(
                        (
                          page
                        ) =>
                          Math.min(
                            totalPages,
                            page +
                              1
                          )
                      )
                    }
                    disabled={
                      safePage ===
                        totalPages ||
                      bulkWorking
                    }
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {section ===
          "Schedule" && (
          <>
            <div className="card">
              <h3>
                Select Business
              </h3>

              <label
                htmlFor="schedule-business"
              >
                View scheduled content
                for
              </label>

              <BusinessSelector
                id="schedule-business"
                value={
                  scheduleBusinessId
                }
                businesses={
                  businesses
                }
                onChange={(
                  value
                ) => {
                  setScheduleBusinessId(
                    value
                  );
                  setSelectedPostId(
                    ""
                  );
                  cancelRescheduling();
                  clearMessages();
                }}
              />
            </div>

            <ContentCalendar posts={filteredScheduledPosts} loading={loadingPosts} />

            <div className="card">
              <h2>
                Schedule a Post
              </h2>

              <p>
                Select a saved draft
                and choose a future
                date in IST. Scheduling saves a plan only;
                automatic publishing remains disabled.
              </p>

              <label
                htmlFor="draft-select"
              >
                Select Draft
              </label>

              <select
                id="draft-select"
                value={
                  selectedPostId
                }
                onChange={(
                  event
                ) =>
                  setSelectedPostId(
                    event
                      .target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              >
                <option
                  value=""
                >
                  Choose a draft
                </option>

                {filteredDrafts.map(
                  (
                    draft
                  ) => (
                    <option
                      key={
                        draft.id
                      }
                      value={
                        String(
                          draft.id
                        )
                      }
                    >
                      #
                      {
                        draft.id
                      }{" "}
                      -{" "}
                      {
                        draft.businessName
                      }{" "}
                      -{" "}
                      {
                        draft.platform
                      }{" "}
                      -{" "}
                      {draft.content.slice(
                        0,
                        50
                      )}
                    </option>
                  )
                )}
              </select>

              <label
                htmlFor="schedule-date"
              >
                Date and Time (IST)
              </label>

              <input
                id="schedule-date"
                type="datetime-local"
                value={
                  scheduledAt
                }
                onChange={(
                  event
                ) =>
                  setScheduledAt(
                    event
                      .target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              />

              <button
                className="primary"
                onClick={() =>
                  void schedulePost()
                }
                disabled={
                  scheduling ||
                  bulkWorking ||
                  !selectedPostId ||
                  !isFutureIST(scheduledAt)
                }
              >
                {scheduling
                  ? "Scheduling..."
                  : "Schedule Post"}
              </button>
            </div>

            <div className="card">
              <h2>
                Scheduled Posts (
                {
                  filteredScheduledPosts.length
                }
                )
              </h2>

              {loadingPosts ? (
                <p>
                  Loading scheduled posts...
                </p>
              ) : filteredScheduledPosts.length ===
                0 ? (
                <p>
                  No scheduled posts
                  for this business.
                </p>
              ) : (
                [...filteredScheduledPosts].sort((a, b) =>
                  (a.scheduledAt ? parseIST(a.scheduledAt).getTime() : Infinity) -
                  (b.scheduledAt ? parseIST(b.scheduledAt).getTime() : Infinity)
                ).map(
                  (
                    post
                  ) => (
                    <div
                      key={
                        post.id
                      }
                      style={
                        postRowStyle
                      }
                    >
                      <PostDetails
                        post={
                          post
                        }
                      />

                      {renderScheduledActions(
                        post
                      )}
                    </div>
                  )
                )
              )}
            </div>
          </>
        )}

        {section ===
          "Advertising" && (
          <>
            <div className="card">
              <h2>
                Advertising Management
              </h2>

              <p>
                Manage Google Ads and
                Meta Ads campaign drafts
                for registered client
                businesses.
              </p>

              <label
                htmlFor="advertising-business"
              >
                Select Client Business
              </label>

              <BusinessSelector
                id="advertising-business"
                value={
                  advertisingBusinessId
                }
                businesses={
                  businesses
                }
                includeAll={
                  false
                }
                disabled={
                  loadingBusinesses
                }
                onChange={(
                  value
                ) => {
                  setAdvertisingBusinessId(
                    value
                  );
                  clearMessages();
                }}
              />

              <label
                htmlFor="advertising-platform"
              >
                Advertising Platform
              </label>

              <select
                id="advertising-platform"
                value={
                  advertisingPlatform
                }
                onChange={(
                  event
                ) =>
                  setAdvertisingPlatform(
                    event
                      .target
                      .value as AdPlatform
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="Google Ads">
                  Google Ads
                </option>

                <option value="Meta Ads">
                  Meta Ads (Facebook
                  & Instagram)
                </option>
              </select>
            </div>

            {advertisingBusiness ? (
              <>
                {advertisingPlatform === "Google Ads" && (
                  <GoogleAdsPanel />
                )}

                <AdvertisingPanel
                  business={advertisingBusiness}
                  businesses={businesses}
                  platform={advertisingPlatform}
                  refreshVersion={advertisingRefreshVersion}
                />

                <CampaignDraftManager
                  key={advertisingPlatform}
                  business={advertisingBusiness}
                  platform={advertisingPlatform}
                  onCampaignChange={refreshAdvertising}
                />
              </>
            ) : (
              <div className="card">
                <p>
                  Register or select
                  a business to view
                  its advertising dashboard.
                </p>
              </div>
            )}
          </>
        )}

        {section ===
          "Analytics" && (
          <div className="card">
            <h2>
              Analytics
            </h2>

            <p>
              Organic social media
              performance metrics
              will be available after
              supported account
              integrations are connected.
            </p>

            <p>
              Google Ads and Meta Ads
              reporting will appear
              in the Advertising module
              after authorized account
              connections.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
