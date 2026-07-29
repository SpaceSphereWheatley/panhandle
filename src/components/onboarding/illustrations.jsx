import { motion } from "framer-motion";

// Stylized previews of the real app UI, one per onboarding slide — a little
// phone frame with recognizable shapes (list rows, a week strip, a
// notification banner) rather than generic standalone icons. Deliberately
// NOT real screenshots: a screenshot would need manual regeneration every
// time the UI changes (and this app changes often — see CLAUDE.md's
// Versioning section), across two themes, two languages and two layouts.
// These are simple enough to redraw in minutes and never go stale.
//
// The little UI text inside each frame ("Milk", "This week", "Panhandle"...)
// is illustrative chrome, not translated strings — same reasoning CLAUDE.md
// gives for never translating meal names/ingredients: the app is English
// first (canonical stored values, e.g. item/category names, are always
// English), so these mockups stay English regardless of the active UI
// language rather than being run through t().
//
// Each is a small stagger-in animation (container variants + child variants)
// rather than a single fade, so the preview reads as "arriving" when its
// slide becomes active — driven by OnboardingFlow passing `animate="visible"`
// only to the active slide's illustration.

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const pop = {
  hidden: { opacity: 0, scale: 0.85, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.2, 0, 0, 1] },
  },
};

const ILLUSTRATION_SIZE = 168;

// Phone-frame geometry shared by every slide, so the four previews read as
// one consistent "this is the app" motif rather than four unrelated icons.
const FRAME = { x: 30, y: 10, width: 108, height: 148, rx: 20 };
const TAB_DOTS_Y = 148;
const TAB_DOTS_X = [64, 84, 104];

function PhoneFrame({ clipId, headerFill, headerLabel, activeTab, children }) {
  return (
    <>
      <rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.width}
        height={FRAME.height}
        rx={FRAME.rx}
        fill="var(--surface-page)"
        stroke="var(--border-strong)"
        strokeWidth="3"
      />
      <clipPath id={clipId}>
        <rect x={FRAME.x} y={FRAME.y} width={FRAME.width} height={FRAME.height} rx={FRAME.rx} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x={FRAME.x} y={FRAME.y} width={FRAME.width} height="28" fill={headerFill} />
        <text
          x={FRAME.x + 10}
          y={FRAME.y + 19}
          style={{ font: "700 9px var(--font-sans)", fill: "var(--md-on-primary)" }}
        >
          {headerLabel}
        </text>
        {children}
      </g>
      {/* Bottom tab-bar hint — a stand-in for the real TabBar, with the
          slide's relevant tab (list / meals / settings) picked out. */}
      {TAB_DOTS_X.map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={TAB_DOTS_Y}
          r={i === activeTab ? 4 : 3}
          fill={i === activeTab ? "var(--accent-primary)" : "var(--border-default)"}
        />
      ))}
    </>
  );
}

function Frame({ children }) {
  return (
    <svg width={ILLUSTRATION_SIZE} height={ILLUSTRATION_SIZE} viewBox="0 0 168 168" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

// Slide 1 — the shared list: list rows with category dots, plus two
// "presence" avatars overlapping the frame's corner to sell "everyone sees
// the same list."
export function ShareIllustration() {
  const rows = [
    { checked: true, dot: "var(--accent-primary)", label: "Milk" },
    { checked: false, dot: "var(--accent-secondary)", label: "Eggs" },
    { checked: false, dot: "var(--accent-tertiary)", label: "Bread" },
  ];
  return (
    <Frame>
      <PhoneFrame clipId="clip-share" headerFill="var(--accent-primary)" headerLabel="Shopping list" activeTab={0}>
        {rows.map((row, i) => {
          const cy = 52 + i * 20;
          return (
          <motion.g key={row.label} variants={pop}>
            <circle
              cx={44}
              cy={cy}
              r={5}
              fill={row.checked ? "var(--accent-primary)" : "none"}
              stroke={row.checked ? "none" : "var(--border-strong)"}
              strokeWidth="2"
            />
            {row.checked && (
              <path
                d={`M41.3 ${cy} L43.4 ${cy + 2.2} L47.2 ${cy - 3.4}`}
                stroke="var(--md-on-primary)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            <circle cx={60} cy={cy} r={3.5} fill={row.dot} />
            <text
              x={70}
              y={cy + 3}
              style={{
                font: "500 9px var(--font-sans)",
                fill: row.checked ? "var(--text-tertiary)" : "var(--text-primary)",
                textDecoration: row.checked ? "line-through" : "none",
              }}
            >
              {row.label}
            </text>
          </motion.g>
          );
        })}
      </PhoneFrame>
      <motion.circle variants={pop} cx={126} cy={24} r={11} fill="var(--accent-secondary)" />
      <motion.circle variants={pop} cx={142} cy={36} r={9} fill="var(--accent-tertiary)" />
    </Frame>
  );
}

// Slide 2 — meal planning: the real MealsTab is a vertical agenda list, one
// row per day (day-abbr/date column, meal name, an accent-highlighted "today"
// row with a caption underneath, a dashed "+ Add meal" row for an unplanned
// day) — not a horizontal week strip. Mirrors that row shape at small scale
// rather than inventing a calendar-grid look the app doesn't have.
const MEALS_ROWS = [
  { abbr: "MON", date: 12, meal: null },
  { abbr: "TUE", date: 13, meal: "Pasta" },
  { abbr: "WED", date: 14, meal: "Tacos", today: true },
];
const ROW_X = 36;
const ROW_W = 96;
const ROW_H = 28;
const ROW_GAP = 6;
const ROWS_TOP = 40;

export function MealsIllustration() {
  return (
    <Frame>
      <PhoneFrame clipId="clip-meals" headerFill="var(--accent-secondary)" headerLabel="This week" activeTab={1}>
        {MEALS_ROWS.map((row, i) => {
          const y = ROWS_TOP + i * (ROW_H + ROW_GAP);
          return (
            <motion.g key={row.abbr} variants={pop}>
              <rect
                x={ROW_X}
                y={y}
                width={ROW_W}
                height={ROW_H}
                rx={8}
                fill={row.today ? "var(--accent-primary-subtle)" : row.meal ? "var(--surface-card)" : "none"}
                stroke={row.meal || row.today ? "none" : "var(--border-default)"}
                strokeWidth="1.5"
                strokeDasharray={row.meal || row.today ? undefined : "3 2"}
              />
              {row.today && <rect x={ROW_X} y={y} width={3} height={ROW_H} rx={1.5} fill="var(--accent-primary)" />}
              <text
                x={ROW_X + 16}
                y={y + 11}
                textAnchor="middle"
                style={{
                  font: "700 5px var(--font-sans)",
                  letterSpacing: "0.04em",
                  fill: row.today ? "var(--accent-primary)" : "var(--text-tertiary)",
                }}
              >
                {row.abbr}
              </text>
              <text
                x={ROW_X + 16}
                y={y + 23}
                textAnchor="middle"
                style={{
                  font: "700 11px var(--font-sans)",
                  fill: row.today ? "var(--accent-primary)" : "var(--text-primary)",
                }}
              >
                {row.date}
              </text>
              {row.meal ? (
                <>
                  <text
                    x={ROW_X + 30}
                    y={y + (row.today ? 14 : 17)}
                    style={{
                      font: "700 8.5px var(--font-sans)",
                      fill: row.today ? "var(--accent-primary)" : "var(--text-primary)",
                    }}
                  >
                    {row.meal}
                  </text>
                  {row.today && (
                    <text
                      x={ROW_X + 30}
                      y={y + 24}
                      style={{ font: "600 6px var(--font-sans)", letterSpacing: "0.03em", fill: "var(--text-tertiary)" }}
                    >
                      TODAY
                    </text>
                  )}
                </>
              ) : (
                <>
                  <circle cx={ROW_X + 34} cy={y + 14} r={5} fill="var(--surface-sunken)" />
                  <path
                    d={`M${ROW_X + 32} ${y + 14}h4M${ROW_X + 34} ${y + 12}v4`}
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <text x={ROW_X + 44} y={y + 17} style={{ font: "600 8px var(--font-sans)", fill: "var(--text-secondary)" }}>
                    Add meal
                  </text>
                </>
              )}
            </motion.g>
          );
        })}
      </PhoneFrame>
    </Frame>
  );
}

// Slide 3 — offline safety: the same list rows, plus an "Offline" banner
// showing the app still works with no signal.
export function OfflineIllustration() {
  const rows = [
    { dot: "var(--accent-primary)", label: "Milk" },
    { dot: "var(--accent-secondary)", label: "Eggs" },
  ];
  return (
    <Frame>
      <PhoneFrame clipId="clip-offline" headerFill="var(--accent-primary)" headerLabel="Shopping list" activeTab={0}>
        <motion.g variants={pop}>
          <rect x={FRAME.x + 6} y={36} width={FRAME.width - 12} height={16} rx={8} fill="var(--accent-tertiary-subtle)" />
          <path
            d="M46 43a8 8 0 0 1 11 0M49 46a4 4 0 0 1 5 0"
            stroke="var(--accent-tertiary)"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={44.5} cy={49.5} r={0.9} fill="var(--accent-tertiary)" />
          <text x={58} y={47} style={{ font: "600 7.5px var(--font-sans)", fill: "var(--t-20)" }}>
            Offline – saved
          </text>
        </motion.g>
        {rows.map((row, i) => (
          <motion.g key={row.label} variants={pop}>
            <circle cx={44} cy={72 + i * 20} r={5} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
            <circle cx={60} cy={72 + i * 20} r={3.5} fill={row.dot} />
            <text x={70} y={75 + i * 20} style={{ font: "500 9px var(--font-sans)", fill: "var(--text-primary)" }}>
              {row.label}
            </text>
          </motion.g>
        ))}
      </PhoneFrame>
    </Frame>
  );
}

// Slide 4 — notifications: a native-style push banner dropping in over the
// (slightly muted) app.
export function NotifyIllustration() {
  return (
    <Frame>
      <g opacity="0.55">
        <PhoneFrame clipId="clip-notify" headerFill="var(--accent-primary)" headerLabel="Shopping list" activeTab={2}>
          {[0, 1].map((i) => (
            <motion.g key={i} variants={pop}>
              <circle cx={44} cy={64 + i * 20} r={5} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
              <rect x={58} y={61 + i * 20} width={44} height={6} rx={3} fill="var(--border-default)" />
            </motion.g>
          ))}
        </PhoneFrame>
      </g>
      <motion.g variants={pop}>
        <rect x={19} y={26} width={130} height={34} rx={12} fill="var(--surface-page)" stroke="var(--border-strong)" strokeWidth="2" />
        <circle cx={40} cy={43} r={9} fill="var(--accent-primary-subtle)" />
        <path
          d="M40 37c-4 0-6 3-6 7v3l-2 3h16l-2-3v-3c0-4-2-7-6-7z"
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <text x={54} y={40} style={{ font: "700 8px var(--font-sans)", fill: "var(--text-primary)" }}>
          Panhandle
        </text>
        <text x={54} y={51} style={{ font: "500 7px var(--font-sans)", fill: "var(--text-secondary)" }}>
          Plan tomorrow's meal
        </text>
      </motion.g>
    </Frame>
  );
}

export const containerVariants = container;
