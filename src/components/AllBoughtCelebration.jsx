import { useEffect } from "react";
import { createPortal } from "react-dom";

// Full-screen, one-shot "you finished shopping" animation, shown over the
// shopping list the moment the last item is checked off (ShoppingListTab.jsx
// mounts it only for a genuine transition, never for a list that's simply
// found fully bought). Three variants, picked at random by
// `pickCelebration`; keyframes live in motion.css under `ph-cel-*`. Purely
// decorative: aria-hidden and pointer-events none, so it never blocks taps,
// and the caller doesn't mount it at all under reduced motion / classic
// intensity. The small "Nothing left to buy" row stays underneath as the
// lasting, accessible confirmation.
export const CELEBRATION_MS = 3000;

const SPARKS = [
  { left: 6, top: 14, d: 1.5 },
  { right: 4, top: 30, d: 1.6 },
  { left: 22, top: 108, d: 1.7, small: true },
  { right: 14, top: 116, d: 1.65, small: true },
];

function Sparkles({ offset = 0 }) {
  return SPARKS.map((s, i) => (
    <span
      key={i}
      className="ph-cel-spark"
      style={{ left: s.left, right: s.right, top: s.top, fontSize: s.small ? 16 : 22, "--d": `${s.d + offset}s` }}
    >
      ✦
    </span>
  ));
}

function Bag() {
  return (
    <>
      <svg viewBox="0 0 200 170" width="200" height="170" className="ph-cel-bag-svg">
        <g className="ph-cel-item" style={{ "--d": ".1s" }}><circle cx="70" cy="62" r="17" fill="#B23B3B" /><path d="M70 46c0-7 5-10 9-10" stroke="#5B7156" strokeWidth="4" fill="none" strokeLinecap="round" /><ellipse cx="82" cy="40" rx="7" ry="4" fill="#5B7156" transform="rotate(-25 82 40)" /></g>
        <g className="ph-cel-item" style={{ "--d": ".4s" }}><path d="M110 40l24 34-8 5z" fill="#E07B2F" transform="rotate(8 120 60)" /><path d="M104 38l-8-10M110 36l0-12M116 38l7-9" stroke="#5B7156" strokeWidth="4" strokeLinecap="round" /></g>
        <g className="ph-cel-item" style={{ "--d": ".7s" }}><rect x="86" y="30" width="30" height="42" rx="4" fill="#F6E7C1" stroke="#5B4E39" strokeWidth="2.5" /><path d="M86 42h30" stroke="#5B4E39" strokeWidth="2.5" /><circle cx="101" cy="57" r="6" fill="#5B7156" /></g>
        <g className="ph-cel-item" style={{ "--d": "1s" }}><rect x="132" y="48" width="38" height="24" rx="12" fill="#E0A537" /><path d="M142 54l4 12M152 53l4 13M162 54l-1 11" stroke="#B98228" strokeWidth="2.5" strokeLinecap="round" /></g>
        <g className="ph-cel-bag">
          <path d="M52 78h96l8 76q0 8-8 8H52q-8 0-8-8z" fill="#E4A57C" />
          <path d="M52 78h96l8 76q0 8-8 8h-28l-4-84z" fill="#C1592A" opacity=".18" />
          <path d="M44 78h112" stroke="#A2461F" strokeWidth="3" strokeLinecap="round" />
          <g className="ph-cel-face" style={{ "--d": "1.5s" }}>
            <circle cx="84" cy="118" r="4.5" fill="#2B2621" /><circle cx="116" cy="118" r="4.5" fill="#2B2621" />
            <path d="M88 130q12 12 24 0" stroke="#2B2621" strokeWidth="4" fill="none" strokeLinecap="round" />
            <ellipse cx="72" cy="128" rx="6" ry="4" fill="#C1592A" opacity=".35" /><ellipse cx="128" cy="128" rx="6" ry="4" fill="#C1592A" opacity=".35" />
          </g>
        </g>
      </svg>
      <Sparkles />
    </>
  );
}

function Cart() {
  return (
    <>
      <svg viewBox="0 0 200 170" width="200" height="170" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g className="ph-cel-lines" stroke="#B3C4A4" strokeWidth="4" strokeLinecap="round"><path d="M10 70h30M0 90h36M14 110h26" /></g>
      </svg>
      <div className="ph-cel-cartwrap">
        <svg viewBox="0 0 124 96" width="124" height="96" style={{ overflow: "visible" }}>
          <g className="ph-cel-bob" style={{ "--d": ".1s" }}><circle cx="40" cy="26" r="13" fill="#B23B3B" /></g>
          <g className="ph-cel-bob" style={{ "--d": ".25s" }}><rect x="56" y="10" width="24" height="32" rx="4" fill="#F6E7C1" stroke="#5B4E39" strokeWidth="2.5" /></g>
          <g className="ph-cel-bob" style={{ "--d": ".4s" }}><path d="M86 14l20 28-6 4z" fill="#E07B2F" /><path d="M84 12l-6-8M90 10v-9" stroke="#5B7156" strokeWidth="4" strokeLinecap="round" /></g>
          <path d="M6 8h16l8 50h68l10-34H34" fill="#E4EBDD" fillOpacity=".9" stroke="#5B7156" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <g className="ph-cel-cface"><circle cx="54" cy="38" r="3.5" fill="#2B2621" /><circle cx="82" cy="38" r="3.5" fill="#2B2621" /><path d="M57 46q11 9 22 0" stroke="#2B2621" strokeWidth="3.5" fill="none" strokeLinecap="round" /></g>
          <g className="ph-cel-wheel"><circle cx="40" cy="78" r="9" fill="#5B4E39" /><path d="M40 70v16M32 78h16" stroke="#E7DCC5" strokeWidth="2.5" /></g>
          <g className="ph-cel-wheel"><circle cx="88" cy="78" r="9" fill="#5B4E39" /><path d="M88 70v16M80 78h16" stroke="#E7DCC5" strokeWidth="2.5" /></g>
        </svg>
      </div>
      <Sparkles offset={0.05} />
    </>
  );
}

function Fridge() {
  return (
    <>
      <svg viewBox="0 0 200 170" width="200" height="170" style={{ overflow: "visible" }}>
        <g className="ph-cel-fridge">
          <rect x="58" y="8" width="84" height="154" rx="12" fill="#E4EBDD" stroke="#5B7156" strokeWidth="5" />
          <rect x="66" y="16" width="68" height="138" rx="7" fill="#FAF6EF" />
          <path d="M66 62h68M66 108h68" stroke="#B3C4A4" strokeWidth="4" />
          <g className="ph-cel-fitem" style={{ "--d": ".35s" }}><circle cx="84" cy="48" r="11" fill="#B23B3B" /><path d="M84 37q0-6 5-7" stroke="#5B7156" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
          <g className="ph-cel-fitem" style={{ "--d": ".55s" }}><rect x="104" y="30" width="20" height="28" rx="3" fill="#F6E7C1" stroke="#5B4E39" strokeWidth="2.5" /></g>
          <g className="ph-cel-fitem" style={{ "--d": ".75s" }}><path d="M76 98l30-16 4 8z" fill="#E07B2F" /><path d="M106 84l8-6M108 90l9-1" stroke="#5B7156" strokeWidth="3" strokeLinecap="round" /></g>
          <g className="ph-cel-fitem" style={{ "--d": ".95s" }}><rect x="100" y="140" width="28" height="14" rx="7" fill="#E0A537" /></g>
          <g className="ph-cel-fitem" style={{ "--d": "1.1s" }}><circle cx="82" cy="142" r="11" fill="#5B7156" /></g>
          <g className="ph-cel-door">
            <rect x="58" y="8" width="84" height="154" rx="12" fill="#B3C4A4" stroke="#5B7156" strokeWidth="5" />
            <rect x="126" y="60" width="6" height="40" rx="3" fill="#5B7156" />
            <g className="ph-cel-fface">
              <circle cx="82" cy="72" r="4.5" fill="#2B2621" /><circle cx="110" cy="72" r="4.5" fill="#2B2621" />
              <path d="M82 86q14 13 28 0" stroke="#2B2621" strokeWidth="4" fill="none" strokeLinecap="round" />
              <ellipse cx="72" cy="84" rx="6" ry="4" fill="#C1592A" opacity=".3" /><ellipse cx="120" cy="84" rx="6" ry="4" fill="#C1592A" opacity=".3" />
            </g>
          </g>
        </g>
      </svg>
      <Sparkles offset={-0.05} />
    </>
  );
}

const SCENES = { bag: Bag, cart: Cart, fridge: Fridge };

export function AllBoughtCelebration({ variant, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, CELEBRATION_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  const Scene = SCENES[variant] || Bag;
  // Portaled to <body>: a tab pane's enter animation puts a transform on an
  // ancestor, which would turn this `position: fixed` into pane-relative.
  return createPortal(
    <div className="ph-cel" aria-hidden="true" data-variant={variant}>
      <div className="ph-cel-art">
        <Scene />
      </div>
    </div>,
    document.body,
  );
}
