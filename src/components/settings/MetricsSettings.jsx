import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useTranslation } from "../../context/LanguageContext.jsx";

// Site-wide usage metrics, across every list — not just the caller's own.
// Gated server-side by GET /admin/metrics (is_admin + a superadmin allowlist);
// a non-superadmin admin just sees the error message below.
export function MetricsSettings() {
  const t = useTranslation();
  const [data, setData] = useState(null);
  // The raw error body, not a resolved message — so a language switch
  // re-renders it (see CLAUDE.md's Language support notes).
  const [errorRes, setErrorRes] = useState(null);

  useEffect(() => {
    api("/admin/metrics").then((res) => {
      if (res.error) setErrorRes(res);
      else setData(res);
    });
  }, []);

  if (errorRes) {
    return <div className="setrow" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{apiErrorMessage(errorRes, t)}</div>;
  }
  if (!data) {
    return <div className="setrow" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{t("settings.metrics.loading")}</div>;
  }

  const boughtPct = data.shopping.total_items
    ? Math.round((data.shopping.bought_items / data.shopping.total_items) * 100)
    : 0;
  const planFillPct = data.meals.plan_total
    ? Math.round((data.meals.plan_filled / data.meals.plan_total) * 100)
    : 0;

  return (
    <div>
      <div className="setrow"><div className="k">{t("settings.metrics.lists")}</div><div className="v">{data.overview.lists}</div></div>
      <div className="setrow"><div className="k">{t("settings.metrics.users")}</div><div className="v">{data.overview.users}</div></div>
      <div className="setrow"><div className="k">{t("settings.metrics.adminsOwners")}</div><div className="v">{data.overview.admins} / {data.overview.owners}</div></div>
      <div className="setrow"><div className="k">{t("settings.metrics.failedLogins")}</div><div className="v">{data.failed_logins_24h}</div></div>

      <MetricSection title={t("settings.metrics.signupsPerWeek")}>
        <TrendBars data={data.signups_by_week} />
      </MetricSection>

      <MetricSection title={t("settings.metrics.listsPerWeek")}>
        <TrendBars data={data.lists_by_week} />
      </MetricSection>

      <MetricSection title={t("settings.metrics.shoppingActivity")}>
        <div className="setrow"><div className="k">{t("settings.metrics.totalItems")}</div><div className="v">{data.shopping.total_items}</div></div>
        <div className="setrow"><div className="k">{t("settings.metrics.bought")}</div><div className="v">{data.shopping.bought_items} ({boughtPct}%)</div></div>
        <div style={{ marginTop: 12 }}>
          <div className="k" style={{ marginBottom: 8 }}>{t("settings.metrics.itemsPerWeek")}</div>
          <TrendBars data={data.shopping.items_by_week} />
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="k" style={{ marginBottom: 8 }}>{t("settings.metrics.topItems")}</div>
          <RankedBars data={data.shopping.top_items} />
        </div>
      </MetricSection>

      <MetricSection title={t("settings.metrics.mealPlanning")}>
        <div className="setrow"><div className="k">{t("settings.metrics.daysPlanned")}</div><div className="v">{data.meals.plan_filled} / {data.meals.plan_total} ({planFillPct}%)</div></div>
        <div style={{ marginTop: 16 }}>
          <div className="k" style={{ marginBottom: 8 }}>{t("settings.metrics.topMeals")}</div>
          <RankedBars data={data.meals.top_meals} />
        </div>
      </MetricSection>

      <MetricSection title={t("settings.metrics.lists")}>
        <div className="metrics-table">
          <div className="metrics-table-row metrics-table-head">
            <span>{t("settings.metrics.table.list")}</span><span>{t("settings.metrics.users")}</span><span>{t("settings.metrics.table.items")}</span><span>{t("settings.metrics.bought")}</span>
          </div>
          {data.per_list.map((l) => (
            <div className="metrics-table-row" key={l.list_id}>
              <span>#{l.list_id}</span><span>{l.users}</span><span>{l.items}</span><span>{l.bought}</span>
            </div>
          ))}
        </div>
      </MetricSection>
    </div>
  );
}

function MetricSection({ title, children }) {
  return (
    <div className="setrow">
      <div className="k" style={{ marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// Vertical bar chart over time (weekly buckets, e.g. `{week: "2026-27", n: 3}`).
// Single series → sequential single hue, no legend. Only the first/last week
// are labeled on the axis (a full weekly tick label per bar would collide);
// the per-bar tooltip carries the rest.
function TrendBars({ data }) {
  const t = useTranslation();
  const [hover, setHover] = useState(null);
  if (!data || data.length === 0) {
    return <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{t("settings.metrics.noData")}</div>;
  }
  const max = Math.max(...data.map((d) => d.n), 1);
  const barW = 16;
  const gap = 4;
  const height = 64;
  const width = data.length * (barW + gap) - gap;

  return (
    <div style={{ position: "relative" }}>
      <svg width={width} height={height + 16} role="img" aria-label={t("settings.metrics.trendAria", { from: data[0].week, to: data[data.length - 1].week })}>
        <line x1={0} y1={height} x2={width} y2={height} stroke="var(--border-default)" strokeWidth={1} />
        {data.map((d, i) => {
          const h = Math.max((d.n / max) * (height - 4), d.n > 0 ? 3 : 0);
          const x = i * (barW + gap);
          const y = height - h;
          return (
            <rect
              key={d.week}
              x={x} y={y} width={barW} height={h} rx={4}
              fill="var(--accent-primary)"
              opacity={hover === i ? 1 : 0.85}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h2) => (h2 === i ? null : h2))}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)" }}>
        <span>{data[0].week}</span>
        <span>{data[data.length - 1].week}</span>
      </div>
      {hover !== null && (
        <div
          style={{
            position: "absolute", top: 0, left: hover * (barW + gap),
            transform: "translate(-25%, -100%)", background: "var(--surface-inverse)",
            color: "var(--text-on-accent)", borderRadius: "var(--radius-md, 6px)",
            padding: "4px 8px", fontSize: 12, whiteSpace: "nowrap", pointerEvents: "none",
          }}
        >
          <strong>{data[hover].n}</strong> <span style={{ opacity: 0.8 }}>{t("settings.metrics.week", { week: data[hover].week })}</span>
        </div>
      )}
    </div>
  );
}

// Horizontal ranked bar list for a small top-N (named categories, so every
// bar is directly labeled with its name; value sits at the bar's tip).
function RankedBars({ data }) {
  const t = useTranslation();
  if (!data || data.length === 0) {
    return <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{t("settings.metrics.noData")}</div>;
  }
  const max = Math.max(...data.map((d) => d.n), 1);
  return (
    <div>
      {data.map((d) => (
        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 120, fontSize: 13, color: "var(--text-secondary)", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.name}
          </div>
          <div style={{ flex: 1, background: "var(--surface-sunken)", borderRadius: 4, height: 14 }}>
            <div
              style={{
                width: `${Math.max((d.n / max) * 100, 4)}%`, height: "100%",
                background: "var(--accent-primary)", borderRadius: 4,
              }}
            />
          </div>
          <div style={{ width: 28, fontSize: 12, color: "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>{d.n}</div>
        </div>
      ))}
    </div>
  );
}
