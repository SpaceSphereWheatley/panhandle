import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Badge, Input, FabMenu, EmptyState, Skeleton, Button, cardComponent } from "../design-system/index.js";
import { useTranslation } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { api } from "../lib/api.js";
import { apiErrorMessage } from "../lib/apiError.js";
import { haptic } from "../lib/shoppingUtils.js";
import { formatBoxNumber, matchesQuery, groupByLocation } from "../lib/storageBoxes.js";
import { BoxEditModal } from "../components/storage/BoxEditModal.jsx";
import { QrScanModal } from "../components/storage/QrScanModal.jsx";
import { BoxLabelsModal } from "../components/storage/BoxLabelsModal.jsx";

const ITEM_PREVIEW_LIMIT = 4;

// The number is the identifier that matters (it's what's on the physical
// sticker), so it leads. An earlier version put a 48px QR thumbnail here
// instead: unscannable at that size, near-identical between boxes, and the
// highest-contrast thing on the card — it out-competed the box *name*, which
// is what the eye is actually hunting for down a list. The real QR lives
// where it's useful: on the printed label and in the box's own editor.
function BoxCard({ box, onClick, t, shouldAnimate, transition }) {
  const shown = box.items.slice(0, ITEM_PREVIEW_LIMIT);
  const extra = box.items.length - shown.length;
  const CardComponent = cardComponent(shouldAnimate);
  // Same base enter/exit shape as ItemCard.jsx's non-resolving/non-evicting
  // case — Storage has neither of those concepts (no "just bought" hold), so
  // a plain fade+layout is enough for a box appearing, being deleted, or
  // dropping out of a search filter.
  const motionProps = shouldAnimate
    ? {
        layout: true,
        transition,
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9 },
      }
    : {};
  // Long-press opens the same editor tap does (TODO #145) — deliberately
  // redundant with tap, not a replacement for it.
  const longPress = useLongPress(onClick);
  return (
    <CardComponent interactive onClick={onClick} {...longPress} {...motionProps}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color: "var(--text-tertiary)",
            lineHeight: 1.2,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatBoxNumber(box.number)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            title={box.name}
            style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "var(--text-md)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {box.name}
          </div>
          {box.notes ? (
            <div
              title={box.notes}
              style={{ marginTop: 2, color: "var(--text-tertiary)", fontSize: "var(--text-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {box.notes}
            </div>
          ) : null}
        </div>
        <Badge tone="neutral">{t("storage.itemCount", { count: box.items.length })}</Badge>
      </div>
      {box.items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {shown.map((item) => (
            <span
              key={item}
              title={item}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-sunken)",
                color: "var(--text-secondary)",
                fontSize: "var(--text-xs)",
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item}
            </span>
          ))}
          {extra > 0 && (
            <span style={{ padding: "4px 10px", color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
              {t("storage.moreItems", { count: extra })}
            </span>
          )}
        </div>
      )}
    </CardComponent>
  );
}

/** Storage/box-organization tab — available to every list member; see
 * AppShell.jsx / StorageSubpage.jsx for the one remaining per-device
 * show/hide toggle (docs/storage-module-plan.md). Boxes are real
 * household-shared data (GET/POST/PATCH/DELETE /storage/boxes), not
 * localStorage. Unlike
 * ShoppingListTab/MealsTab there's no 7s poll — read-mostly reference data,
 * so this loads once when the tab first becomes active and again after any
 * write, rather than continuously.
 *
 * `pendingBoxNumber`/`onConsumedPendingBoxNumber`: a scanned box's deep link
 * (.../b/{number}, see App.jsx and worker/index.js's ROUTING section) lands
 * here already switched to this tab by AppShell. Resolved the same way as
 * an in-app camera scan (see `openBoxByNumber` below) — no intermediate
 * "is this the right one?" step (the scan itself is the confirmation, per
 * the doc), independent of whether the full box list has loaded yet. */
export function StorageTab({ active, pendingBoxNumber, onConsumedPendingBoxNumber }) {
  const t = useTranslation();
  const toast = useToast();
  const { shouldAnimate, transition } = useMotionConfig();
  const [boxes, setBoxes] = useState([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  // Distinct from `loadedOnce`, which only records that the fetch was
  // *started*. Without this the first render (boxes still []) fell straight
  // through to the empty state, so opening the tab flashed "no boxes yet"
  // before the real list arrived.
  const [loaded, setLoaded] = useState(false);
  // A failed load must not render as "no boxes yet" — that's indistinguishable
  // from an actually-empty household and, if the toast below is missed, reads
  // as "your boxes are gone" for data people rely on being durable. Kept
  // separate from `boxes` (left untouched on failure) so a retry that
  // succeeds after a stale cache isn't needed — there's nothing to preserve,
  // the tab has no offline cache unlike ShoppingListTab.
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [editingBox, setEditingBox] = useState(null); // { mode: "new" | "edit", box?, claimNumber? }
  const [scanning, setScanning] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  async function loadBoxes() {
    try {
      const res = await api("/storage/boxes");
      if (Array.isArray(res)) {
        setBoxes(res);
        setLoadError(false);
      } else {
        // A reachable server that rejected the request (e.g. a 500) — same
        // "couldn't load" outcome as a network throw below, just without an
        // exception, so it needs the same toast + error-state handling.
        toast(apiErrorMessage(res, t), { error: true });
        setLoadError(true);
      }
    } catch {
      toast(t("storage.toast.loadFailed"), { error: true });
      setLoadError(true);
    } finally {
      // Set even on failure: the error is surfaced as a toast, and leaving
      // the skeleton up forever would read as a permanent hang.
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (active && !loadedOnce) {
      setLoadedOnce(true);
      loadBoxes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loadedOnce]);

  // Shared by both entry points that resolve a scanned/deep-linked number —
  // the in-app camera scanner and the .../b/{number} URL below. A number
  // with no box yet (STORAGE_BOX_NOT_FOUND) isn't necessarily an error: it's
  // also what a reserved-but-unfilled number looks like (POST
  // /storage/boxes/reserve), or a deleted box's old sticker — the doc calls
  // for the same "set it up?" screen in every one of those cases, so this
  // opens a new-box editor pre-targeting that exact number (via
  // BoxEditModal's claimNumber prop / POST /storage/boxes's claim_number)
  // rather than surfacing the 404 as a toast.
  async function openBoxByNumber(number) {
    // Instant path: this tab already holds every box in the list (one
    // request, 300-box cap) and GET /storage/boxes returns the exact same
    // per-box shape the by-number lookup does, so a scan of an
    // already-loaded box opens its editor synchronously — no round trip to
    // wait through, and no glimpse of the box list in between. Deliberately
    // no freshness concern: it's the same data a tap on that box's card
    // already opens, and this tab doesn't poll.
    const known = boxes.find((b) => b.number === Number(number));
    if (known) {
      setEditingBox({ mode: "edit", box: known });
      return;
    }
    try {
      const res = await api(`/storage/boxes/by-number/${number}`);
      if (res.error) {
        if (res.code === "STORAGE_BOX_NOT_FOUND") {
          setEditingBox({ mode: "new", claimNumber: Number(number) });
        } else {
          toast(apiErrorMessage(res, t), { error: true });
        }
      } else {
        setEditingBox({ mode: "edit", box: res });
      }
    } catch {
      toast(t("storage.toast.loadFailed"), { error: true });
    }
  }

  useEffect(() => {
    if (!pendingBoxNumber) return;
    let cancelled = false;
    openBoxByNumber(pendingBoxNumber).finally(() => {
      if (!cancelled) onConsumedPendingBoxNumber?.();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBoxNumber]);

  const filtered = useMemo(() => boxes.filter((box) => matchesQuery(box, query)), [boxes, query]);

  const grouped = useMemo(
    () => groupByLocation(filtered, t("storage.unplacedLocation")),
    [filtered, t]
  );

  const existingLocations = useMemo(
    () => [...new Set(boxes.map((b) => b.location).filter(Boolean))].sort(),
    [boxes]
  );

  return (
    <div style={{ padding: "var(--space-4)", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Input
        icon="magnifying-glass"
        placeholder={t("storage.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!loaded ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* Varied heights, not one repeated block: a real card's height swings
              with whether it has notes/item pills, so three identical placeholders
              all snapping to one different height on load reads as a bigger jump
              than three that already look like plausible, differently-sized cards. */}
          {[64, 100, 78].map((h, i) => <Skeleton key={i} height={h} />)}
        </div>
      ) : loadError ? (
        <EmptyState
          icon="cloud-slash"
          title={t("storage.error.title")}
          description={t("storage.error.description")}
          action={<Button variant="outline" onClick={loadBoxes}>{t("common.retry")}</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="package"
          title={t(boxes.length === 0 ? "storage.emptyNoBoxesTitle" : "storage.emptyTitle")}
          description={t(boxes.length === 0 ? "storage.emptyNoBoxes" : "storage.emptyDescription")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {grouped.map((group) => (
            <section key={group.location}>
              {/* Deliberately normal text flow, not a flex row: a long
                  location ("Kitchen cupboard (top shelf, behind the big
                  pots)") wraps to two lines, and as flex items the count
                  was pushed to the far right of the second line, reading as
                  though it belonged to something else. Inline, it just
                  follows the last word wherever that lands. */}
              <h3
                style={{
                  margin: "0 0 8px 2px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                <i className="ph ph-map-pin" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-1px" }} />
                {group.location}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  {" "}({group.boxes.length})
                </span>
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <AnimatePresence initial={false} mode="popLayout">
                  {group.boxes.map((box) => (
                    <BoxCard
                      key={box.id}
                      box={box}
                      t={t}
                      shouldAnimate={shouldAnimate}
                      transition={transition}
                      onClick={() => setEditingBox({ mode: "edit", box })}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      <FabMenu
        label={t("storage.fab.label")}
        haptic={haptic}
        actions={[
          { icon: "plus", label: t("storage.fab.addBox"), onClick: () => setEditingBox({ mode: "new" }) },
          { icon: "qr-code", label: t("storage.fab.scan"), onClick: () => setScanning(true) },
          { icon: "printer", label: t("storage.fab.labels"), onClick: () => setShowLabels(true) },
        ]}
      />

      {editingBox && (
        <BoxEditModal
          box={editingBox.box || null}
          claimNumber={editingBox.claimNumber}
          existingLocations={existingLocations}
          onClose={() => setEditingBox(null)}
          onSaved={() => {
            // BoxEditModal shares this one callback for both a successful
            // save and a successful delete (see its own requestClose(onSaved)
            // calls) — one haptic covers "saving a box, deleting a box" (TODO
            // #146), matching how loud the shopping list already is for its
            // own writes.
            haptic();
            setEditingBox(null);
            loadBoxes();
          }}
        />
      )}

      {scanning && (
        <QrScanModal
          onClose={() => setScanning(false)}
          onFound={(number) => {
            // A recognized scan, not a server write — same reasoning as
            // useLongPress firing haptic on gesture recognition rather than
            // on the request it triggers.
            haptic();
            // Both state updates land in one commit, so for an already-loaded
            // box (openBoxByNumber's instant path) the scanner is replaced by
            // that box's editor directly, without the tab showing through in
            // between.
            setScanning(false);
            openBoxByNumber(number);
          }}
        />
      )}

      {showLabels && <BoxLabelsModal boxes={boxes} onClose={() => setShowLabels(false)} />}
    </div>
  );
}
