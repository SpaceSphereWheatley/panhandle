// Vitest setup: extends expect() with jest-dom's DOM matchers (toBeInTheDocument, etc).
import "@testing-library/jest-dom/vitest";

// Testing Library's auto-cleanup-after-each relies on detecting a global
// afterEach; this repo runs Vitest with `globals: false` (explicit imports
// everywhere else), so register it explicitly instead, or rendered trees
// from one test leak into the next.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
