# Direct contour selection, first-use hint, and mobile controls

Baseline: `f99fd77f4ada6499fe8a072e0beddd86d3a58b1c`.

Only the two standalone HTML pages are changed. The paused genus2/genus3 deformation draft is not included. The mathematical Worker bundles are byte-for-byte unchanged.

- In the contour page, a click/tap within 8 CSS pixels (mouse) or 14 CSS pixels (touch) of the nearest projected contour segment toggles that component. The same existing single-component highlight is shared with the numeric buttons in the equation. Tapping another component changes the selection. The brown point still follows clicks and drags.
- Selection happens only on pointerup after movement of at most 6 CSS pixels, and only if the geometry is the same as at pointerdown. Once a gesture exceeds that distance it stays a drag even if it returns to its starting point. Pinching, pointer cancellation, and lost capture do not select. No new mode or button was added.
- Both pages show one short `輪をドラッグ` hint beside the first material control point. It is pointer-transparent, shown only in deformation mode, and dismissed by a deformation drag, arrow-key action, or slider input. Dismissal lasts for that page in the current tab's session; reset/reload does not restore it. When session storage is unavailable it lasts until reload. Gray markers themselves remain visible in rotation mode.
- On portrait widths up to 650px, the existing footer with results and controls sticks to the bottom of the viewport. Canvas sizes are unchanged; the diagrams can be scrolled behind it, and either diagram can be brought fully above the controls. This does not put both full-size diagrams on one phone screen. For heights below 600px (including small keyboard/landscape viewports), normal scrolling is retained so the footer does not consume the usable view. No new buttons or duplicate controls were added.
- The contour help now switches only left/right spatial words to up/down on phones, matching the user's previously authored instruction. Morse already had this responsive wording, which is preserved. The mathematical text and formulas are unchanged.

## Validation

Run the scripts from the repository root, serving it on localhost:8001; they use Playwright with `/usr/bin/chromium`.

`selection.cjs` / `selection.json`: mouse and emulated touch, torus inner/outer components, toggle/reselection and formula buttons, drag-out-and-back, cancellation, manual zoom, touch pinch, fixed screen geometry, full-width numeric input, and no JavaScript errors.

`hints-layout.cjs` / `hints-layout.json`: both pages at 1440×1000 and 390×844, actual mouse/CDP touch deformation through the hint, hide/show on mode changes before dismissal, dismissal persistence on reset/reload/surface change, responsive help text, unchanged canvas sizes during scrolling, and visible mobile controls. An emulated touch swipe in each view's caption also scrolls the diagrams while the footer remains visible.

`small-screens.json`: 320×568, 375×667, 430×932, 844×390, no horizontal overflow, reachable full-width sliders and answer inputs. Images include mobile views after scrolling the lower diagram into view. The former torus UI regression script was also run against this checkout: desktop/mobile drag and slider, shape switch/reselection/reset, full-width input and green feedback, component buttons, fixed deformation scale/center, and no page errors.

The selected-component screenshots show the direct selection result. Hint screenshots show the only added text. The main diagrams, contour viewport/frame, gray markers, brown point sizes, and existing exercise wording are preserved.

Limits: mobile tests emulate touch in Chromium rather than physical devices. Public Pages URLs are blocked by the environment's proxy; GitHub Pages deployment status is verified separately. On phones the diagrams still require scrolling to compare them; the improvement is keeping the existing results and controls available during that comparison without shrinking the diagrams.
