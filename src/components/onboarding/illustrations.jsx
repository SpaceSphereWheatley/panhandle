import { motion } from "framer-motion";

// Simple line-art illustrations for the onboarding slides, one per feature
// being introduced. Deliberately not the hand-drawn wobble-filter style from
// itemIcons.js (that's specific to grocery-item icons) — these are flat,
// geometric, and built from the same M3 accent tokens as the rest of the app
// so they don't need their own color palette.
//
// Each is a small stagger-in animation (container variants + child variants)
// rather than a single fade, so the icon reads as "arriving" when its slide
// becomes active — driven by OnboardingFlow passing `animate="visible"` only
// to the active slide's illustration.

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const pop = {
  hidden: { opacity: 0, scale: 0.6, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.2, 0, 0, 1] },
  },
};

const ILLUSTRATION_SIZE = 168;

function Frame({ children }) {
  return (
    <svg
      width={ILLUSTRATION_SIZE}
      height={ILLUSTRATION_SIZE}
      viewBox="0 0 168 168"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Slide 1 — the shared list: a phone with list lines, plus two "presence"
// dots to sell "everyone sees the same list."
export function ShareIllustration() {
  return (
    <Frame>
      <motion.circle variants={pop} cx="84" cy="84" r="76" fill="var(--accent-primary-subtle)" />
      <motion.g variants={pop}>
        <rect x="52" y="34" width="64" height="100" rx="14" fill="var(--surface-page)" stroke="var(--accent-primary)" strokeWidth="4" />
        <rect x="66" y="50" width="36" height="6" rx="3" fill="var(--accent-primary)" />
      </motion.g>
      {[0, 1, 2].map((i) => (
        <motion.rect
          key={i}
          variants={pop}
          x="66"
          y={68 + i * 16}
          width={i === 1 ? 28 : 36}
          height="6"
          rx="3"
          fill="var(--border-strong)"
        />
      ))}
      <motion.circle variants={pop} cx="128" cy="46" r="16" fill="var(--accent-secondary)" />
      <motion.circle variants={pop} cx="34" cy="120" r="14" fill="var(--accent-tertiary)" />
    </Frame>
  );
}

// Slide 2 — meal planning: a calendar with one day highlighted.
export function MealsIllustration() {
  return (
    <Frame>
      <motion.circle variants={pop} cx="84" cy="84" r="76" fill="var(--accent-secondary-subtle)" />
      <motion.g variants={pop}>
        <rect x="38" y="42" width="92" height="82" rx="12" fill="var(--surface-page)" stroke="var(--accent-secondary)" strokeWidth="4" />
        <rect x="38" y="42" width="92" height="22" rx="12" fill="var(--accent-secondary)" />
        <rect x="58" y="30" width="6" height="20" rx="3" fill="var(--accent-secondary)" />
        <rect x="104" y="30" width="6" height="20" rx="3" fill="var(--accent-secondary)" />
      </motion.g>
      {[0, 1, 2, 3].map((col) => (
        <motion.rect
          key={col}
          variants={pop}
          x={52 + col * 20}
          y="80"
          width="14"
          height="14"
          rx="4"
          fill={col === 2 ? "var(--accent-tertiary)" : "var(--surface-sunken)"}
        />
      ))}
      {[0, 1, 2, 3].map((col) => (
        <motion.rect
          key={`b${col}`}
          variants={pop}
          x={52 + col * 20}
          y="102"
          width="14"
          height="14"
          rx="4"
          fill="var(--surface-sunken)"
        />
      ))}
    </Frame>
  );
}

// Slide 3 — offline safety: a cloud with a checkmark, no wifi bars needed.
export function OfflineIllustration() {
  return (
    <Frame>
      <motion.circle variants={pop} cx="84" cy="84" r="76" fill="var(--accent-tertiary-subtle)" />
      <motion.path
        variants={pop}
        d="M52 96c-11 0-20-9-20-20s9-20 20-20c2-14 14-24 28-24 15 0 27 11 29 25 12 1 21 11 21 23 0 13-10 23-23 23H52z"
        fill="var(--surface-page)"
        stroke="var(--accent-tertiary)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <motion.path
        variants={pop}
        d="M66 92l12 12 24-26"
        stroke="var(--accent-primary)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

// Slide 4 — notifications: a bell with a "ping" ring.
export function NotifyIllustration() {
  return (
    <Frame>
      <motion.circle variants={pop} cx="84" cy="84" r="76" fill="var(--accent-primary-subtle)" />
      <motion.path
        variants={pop}
        d="M84 40c-16 0-26 12-26 28v14l-8 14h68l-8-14V68c0-16-10-28-26-28z"
        fill="var(--surface-page)"
        stroke="var(--accent-primary)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <motion.path
        variants={pop}
        d="M74 104a10 10 0 0 0 20 0"
        stroke="var(--accent-primary)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <motion.circle variants={pop} cx="118" cy="46" r="9" fill="var(--status-danger)" />
    </Frame>
  );
}

export const containerVariants = container;
