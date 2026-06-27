/**
 * Unit tests for pure helper functions exported from web/image_profile.js.
 *
 * Run with:
 *   npm test
 * or directly:
 *   node --test web/__tests__/*.test.mjs
 *
 * How the ComfyUI app import is stubbed
 * -------------------------------------
 * image_profile.js (in web/) does:
 *   import { app } from "../../scripts/app.js";
 *   app.registerExtension(...);   <-- top-level side effect
 *
 * In a real ComfyUI install that specifier resolves (over HTTP, in the
 * browser) to ComfyUI's own frontend bundle. There is no such file on disk
 * here, so importing the module under Node would throw ERR_MODULE_NOT_FOUND.
 *
 * We install a synchronous in-thread resolve hook (module.registerHooks,
 * stable in Node >=24) that redirects any ".../scripts/app.js" specifier to a
 * tiny in-repo stub (./app-stub.mjs). This keeps the test fully self-contained
 * and reproducible on a clean clone — no files outside the repo, no
 * experimental flags.
 *
 * No production logic is modified beyond appending named exports at the very
 * bottom of image_profile.js — ComfyUI ignores extra named exports.
 */

import { registerHooks } from "node:module";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const APP_STUB_URL = new URL("./app-stub.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("scripts/app.js")) {
      return { url: APP_STUB_URL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

// ---------------------------------------------------------------------------
// Import the module under test. The resolve hook above redirects its
// "../../scripts/app.js" import to the in-repo stub so registerExtension()
// is a no-op instead of throwing.
// ---------------------------------------------------------------------------
let clamp, sanitizeDimension, sanitizeSteps, parseResolution;

before(async () => {
  const mod = await import("../image_profile.js");
  clamp = mod.clamp;
  sanitizeDimension = mod.sanitizeDimension;
  sanitizeSteps = mod.sanitizeSteps;
  parseResolution = mod.parseResolution;
});

// ===========================================================================
// clamp
// ===========================================================================
describe("clamp", () => {
  it("returns value when within range", () => {
    assert.equal(clamp(50, 1, 100), 50);
  });

  it("clamps to minimum when value is below", () => {
    assert.equal(clamp(0, 8, 16384), 8);
  });

  it("clamps to maximum when value is above", () => {
    assert.equal(clamp(99999, 8, 16384), 16384);
  });

  it("returns minimum when value equals minimum", () => {
    assert.equal(clamp(8, 8, 16384), 8);
  });

  it("returns maximum when value equals maximum", () => {
    assert.equal(clamp(16384, 8, 16384), 16384);
  });

  it("handles negative values below minimum", () => {
    assert.equal(clamp(-100, 1, 150), 1);
  });
});

// ===========================================================================
// sanitizeDimension
// ===========================================================================
// Constants from image_profile.js:
//   DIM_MULTIPLE = 8,  DIM_MIN = 8,  DIM_MAX = 16384
// Canonical reference: nodes.py  _sanitize_dimension()

describe("sanitizeDimension", () => {
  // ---- already-valid multiples of 8 ----

  it("returns exact multiple of 8, no correction", () => {
    const result = sanitizeDimension(1152);
    assert.equal(result.value, 1152);
    assert.equal(result.corrected, false);
  });

  it("handles 512 (multiple of 8), no correction", () => {
    const result = sanitizeDimension(512);
    assert.equal(result.value, 512);
    assert.equal(result.corrected, false);
  });

  it("handles DIM_MIN (8), no correction", () => {
    const result = sanitizeDimension(8);
    assert.equal(result.value, 8);
    assert.equal(result.corrected, false);
  });

  it("handles DIM_MAX (16384), no correction", () => {
    const result = sanitizeDimension(16384);
    assert.equal(result.value, 16384);
    assert.equal(result.corrected, false);
  });

  // ---- rounding to nearest multiple of 8 ----

  it("rounds up when closer to upper multiple", () => {
    // 1155: lower=1152, upper=1160, distance-to-lower=3, distance-to-upper=5 => rounds down to 1152
    // 1157: lower=1152, upper=1160, distance-to-lower=5, distance-to-upper=3 => rounds up to 1160
    const result = sanitizeDimension(1157);
    assert.equal(result.value, 1160);
    assert.equal(result.corrected, true);
  });

  it("rounds down when closer to lower multiple", () => {
    const result = sanitizeDimension(1153);
    assert.equal(result.value, 1152);
    assert.equal(result.corrected, true);
  });

  it("tie-break at midpoint rounds UP (integer - lower >= upper - integer)", () => {
    // Midpoint between 1152 and 1160 is 1156.
    // At 1156: lower=1152, upper=1160, 1156-1152=4, 1160-1156=4 => 4 >= 4 => pick upper=1160
    const result = sanitizeDimension(1156);
    assert.equal(result.value, 1160);
    assert.equal(result.corrected, true);
  });

  it("tie-break at multiples of 8 boundary (e.g. 512+4=516)", () => {
    // 516: lower=512, upper=520, 516-512=4, 520-516=4 => tie => upper=520
    const result = sanitizeDimension(516);
    assert.equal(result.value, 520);
    assert.equal(result.corrected, true);
  });

  // ---- clamping at boundaries ----

  it("clamps value below DIM_MIN to DIM_MIN", () => {
    const result = sanitizeDimension(1);
    assert.equal(result.value, 8);
    assert.equal(result.corrected, true);
  });

  it("clamps zero to DIM_MIN", () => {
    const result = sanitizeDimension(0);
    assert.equal(result.value, 8);
    assert.equal(result.corrected, true);
  });

  it("clamps negative value to DIM_MIN", () => {
    const result = sanitizeDimension(-100);
    assert.equal(result.value, 8);
    assert.equal(result.corrected, true);
  });

  it("clamps value above DIM_MAX to DIM_MAX", () => {
    const result = sanitizeDimension(99999);
    assert.equal(result.value, 16384);
    assert.equal(result.corrected, true);
  });

  it("clamps DIM_MAX+1 to DIM_MAX", () => {
    const result = sanitizeDimension(16385);
    assert.equal(result.value, 16384);
    assert.equal(result.corrected, true);
  });

  // ---- NaN / non-numeric fallbacks ----

  it("falls back to DIM_MIN for NaN (empty string)", () => {
    const result = sanitizeDimension("");
    assert.equal(result.value, 8);
    assert.equal(result.corrected, true);
  });

  it("falls back to DIM_MIN for NaN (non-numeric string)", () => {
    const result = sanitizeDimension("abc");
    assert.equal(result.value, 8);
    assert.equal(result.corrected, true);
  });

  it("falls back to DIM_MIN for null", () => {
    const result = sanitizeDimension(null);
    assert.equal(result.value, 8);
    // parseInt(null, 10) is NaN, so corrected against NaN is true
    assert.equal(result.corrected, true);
  });

  it("falls back to DIM_MIN for undefined", () => {
    const result = sanitizeDimension(undefined);
    assert.equal(result.value, 8);
    assert.equal(result.corrected, true);
  });

  it("parses numeric string correctly", () => {
    const result = sanitizeDimension("864");
    assert.equal(result.value, 864);
    assert.equal(result.corrected, false);
  });

  it("truncates float string (parseInt behavior)", () => {
    // parseInt("1153.9") = 1153
    const result = sanitizeDimension("1153.9");
    assert.equal(result.value, 1152);
    assert.equal(result.corrected, true);
  });

  // ---- real profile values from DEFAULT_PROFILES (these are NOT multiples of 8) ----

  it("corrects default low-res width 404 to nearest multiple", () => {
    // 404: lower=400, upper=408, 404-400=4, 408-404=4 => tie => upper=408
    const result = sanitizeDimension(404);
    assert.equal(result.value, 408);
    assert.equal(result.corrected, true);
  });

  it("corrects default low-res height 204 to nearest multiple", () => {
    // 204: lower=200, upper=208, 204-200=4, 208-204=4 => tie => upper=208
    const result = sanitizeDimension(204);
    assert.equal(result.value, 208);
    assert.equal(result.corrected, true);
  });

  // ---- values that match Python reference implementation ----

  it("matches Python: sanitize_dimension(1024) = 1024, not corrected", () => {
    const result = sanitizeDimension(1024);
    assert.equal(result.value, 1024);
    assert.equal(result.corrected, false);
  });

  it("matches Python: sanitize_dimension(1000) = 1000 — wait, 1000 is a multiple of 8", () => {
    // 1000 / 8 = 125 exactly, so 1000 is a multiple of 8
    const result = sanitizeDimension(1000);
    assert.equal(result.value, 1000);
    assert.equal(result.corrected, false);
  });

  it("matches Python: sanitize_dimension(1001) rounds to 1000", () => {
    // 1001: lower=1000, upper=1008, dist=1 vs 7 => lower=1000
    const result = sanitizeDimension(1001);
    assert.equal(result.value, 1000);
    assert.equal(result.corrected, true);
  });

  it("matches Python: sanitize_dimension(1007) rounds to 1008", () => {
    // 1007: lower=1000, upper=1008, dist=7 vs 1 => upper=1008
    const result = sanitizeDimension(1007);
    assert.equal(result.value, 1008);
    assert.equal(result.corrected, true);
  });
});

// ===========================================================================
// sanitizeSteps
// ===========================================================================
// Constants: STEPS_MIN=1, STEPS_MAX=150
// No rounding — just clamping to integer via parseInt.

describe("sanitizeSteps", () => {
  it("returns exact value within range, no correction", () => {
    const result = sanitizeSteps(8);
    assert.equal(result.value, 8);
    assert.equal(result.corrected, false);
  });

  it("returns STEPS_MIN (1) with no correction", () => {
    const result = sanitizeSteps(1);
    assert.equal(result.value, 1);
    assert.equal(result.corrected, false);
  });

  it("returns STEPS_MAX (150) with no correction", () => {
    const result = sanitizeSteps(150);
    assert.equal(result.value, 150);
    assert.equal(result.corrected, false);
  });

  it("clamps below STEPS_MIN to 1", () => {
    const result = sanitizeSteps(0);
    assert.equal(result.value, 1);
    assert.equal(result.corrected, true);
  });

  it("clamps negative value to STEPS_MIN", () => {
    const result = sanitizeSteps(-5);
    assert.equal(result.value, 1);
    assert.equal(result.corrected, true);
  });

  it("clamps above STEPS_MAX to 150", () => {
    const result = sanitizeSteps(999);
    assert.equal(result.value, 150);
    assert.equal(result.corrected, true);
  });

  it("clamps STEPS_MAX+1 to STEPS_MAX", () => {
    const result = sanitizeSteps(151);
    assert.equal(result.value, 150);
    assert.equal(result.corrected, true);
  });

  it("falls back to STEPS_MIN for NaN (empty string)", () => {
    const result = sanitizeSteps("");
    assert.equal(result.value, 1);
    assert.equal(result.corrected, true);
  });

  it("falls back to STEPS_MIN for NaN (non-numeric string)", () => {
    const result = sanitizeSteps("abc");
    assert.equal(result.value, 1);
    assert.equal(result.corrected, true);
  });

  it("falls back to STEPS_MIN for null", () => {
    const result = sanitizeSteps(null);
    assert.equal(result.value, 1);
    assert.equal(result.corrected, true);
  });

  it("falls back to STEPS_MIN for undefined", () => {
    const result = sanitizeSteps(undefined);
    assert.equal(result.value, 1);
    assert.equal(result.corrected, true);
  });

  it("parses numeric string '20' correctly", () => {
    const result = sanitizeSteps("20");
    assert.equal(result.value, 20);
    assert.equal(result.corrected, false);
  });

  it("parseInt truncates float '8.9' to 8", () => {
    const result = sanitizeSteps("8.9");
    assert.equal(result.value, 8);
    assert.equal(result.corrected, false);
  });

  it("corrected flag is false for exact boundary STEPS_MIN=1", () => {
    const result = sanitizeSteps(1);
    assert.equal(result.corrected, false);
  });

  it("corrected flag is false for exact boundary STEPS_MAX=150", () => {
    const result = sanitizeSteps(150);
    assert.equal(result.corrected, false);
  });
});

// ===========================================================================
// parseResolution
// ===========================================================================
describe("parseResolution", () => {
  // ---- valid "WxH" strings ----

  it("parses basic WxH string", () => {
    const result = parseResolution("1152x864");
    assert.deepEqual(result, { width: 1152, height: 864 });
  });

  it("parses WxH with spaces around x", () => {
    const result = parseResolution("1152 x 864");
    assert.deepEqual(result, { width: 1152, height: 864 });
  });

  it("parses WxH with leading/trailing whitespace", () => {
    const result = parseResolution("  1024x1024  ");
    assert.deepEqual(result, { width: 1024, height: 1024 });
  });

  it("parses case-insensitively (uppercase X)", () => {
    const result = parseResolution("1280X720");
    assert.deepEqual(result, { width: 1280, height: 720 });
  });

  // ---- preset format "WxH ( ratio )" ----

  it("parses preset string with ratio suffix", () => {
    const result = parseResolution("1024x1024 ( 1:1 )");
    assert.deepEqual(result, { width: 1024, height: 1024 });
  });

  it("parses preset with non-square ratio suffix", () => {
    const result = parseResolution("1280x720 ( 16:9 )");
    assert.deepEqual(result, { width: 1280, height: 720 });
  });

  it("parses preset with 21:9 ratio suffix", () => {
    const result = parseResolution("1344x576 ( 21:9 )");
    assert.deepEqual(result, { width: 1344, height: 576 });
  });

  it("parses portrait preset with ratio suffix", () => {
    const result = parseResolution("1152x2048 ( 9:16 )");
    assert.deepEqual(result, { width: 1152, height: 2048 });
  });

  // ---- malformed / invalid inputs ----

  it("returns null for empty string", () => {
    assert.equal(parseResolution(""), null);
  });

  it("returns null for null", () => {
    assert.equal(parseResolution(null), null);
  });

  it("returns null for undefined", () => {
    assert.equal(parseResolution(undefined), null);
  });

  it("returns null for plain number", () => {
    assert.equal(parseResolution(1024), null);
  });

  it("returns null for string with only width", () => {
    assert.equal(parseResolution("1024"), null);
  });

  it("returns null for missing separator", () => {
    assert.equal(parseResolution("1024 864"), null);
  });

  it("returns null for wrong separator", () => {
    assert.equal(parseResolution("1024,864"), null);
  });

  it("returns null for letters-only string", () => {
    assert.equal(parseResolution("widthxheight"), null);
  });

  it("returns null for string starting with letters before digits", () => {
    assert.equal(parseResolution("abcx123"), null);
  });

  it("returns integers (not floats or strings) for width/height", () => {
    const result = parseResolution("1152x864");
    assert.ok(Number.isInteger(result.width), "width should be integer");
    assert.ok(Number.isInteger(result.height), "height should be integer");
  });

  // ---- values must be non-negative integers ----

  it("does not match negative dimensions (regex requires \\d+)", () => {
    // -1x-1 won't match because \d+ doesn't include -
    assert.equal(parseResolution("-1x-1"), null);
  });
});
