// Turns a failed API response into a message in the user's language.
//
// Every error the Worker returns carries both a human-readable `error` string
// (canonical Norwegian) and a stable `code` (shared/errorCodes.js). Prefer the
// code — that's the whole point of it — and fall back to the raw `error`
// string when there isn't one, which covers two real cases: a response from a
// Worker deploy older than the code rollout, and any future error that hasn't
// been given a code yet. Falling back to the server's own wording is always
// better than showing a bare code or an empty toast.
//
// `res` is the parsed JSON body, not a Response. Returns null when the body
// isn't an error at all, so a caller can use it as the failure test.
export function apiErrorMessage(res, t) {
  if (!res?.error && !res?.code) return null;
  if (res.code) {
    const translated = t(`error.${res.code}`);
    // translate() echoes the key back when it's unknown — a code this bundle
    // doesn't know about yet. Prefer the server's string over showing
    // "error.SOMETHING_NEW".
    if (translated !== `error.${res.code}`) return translated;
  }
  return res.error || null;
}
