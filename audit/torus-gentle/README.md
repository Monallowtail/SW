# Gentler torus controls and persistent gray markers

Baseline: `182d0a09d9387f19ac87b5be7d51f7c806e48c52`. The paused genus2/genus3 draft is excluded.

Both standalone pages and their embedded Workers use the same revised torus map. No exercise prose, input rules, sphere deformation kernel, or other surface maps changed. Gray material control markers now draw in rotation mode too; hit testing and interaction modes are unchanged. The contour torus uses a fixed radius-1.8 framing envelope instead of 2.35; it is never refitted on rotation/deformation. Manual zoom remains available.

## Shape and independence

The four cardinal controls retain the ±0.55 range and twelve monotone stages. The compact taper is now `b(s)=(1-s²)² exp(-0.1 s²/(1-s²))` for |s|<1, zero otherwise. Support half-widths are radial 0.62, tangential 0.52, and transverse 0.60. These broaden the transition without moving another control's region: the nearest radial coordinate is 1.17−0.62=0.55>0.52, so the four open boxes are disjoint.

The taper is C∞ and flat at its boundary. Its derivative is bounded by 4.2. Each stage has positive axial derivative at least `1−(.55/12)*4.2/.62`; the full map's determinant is at least 0.0115487. Each stage fixes the box boundary, maps its interior onto itself, and is invertible. Thus these are ambient diffeomorphisms preserving embedding and the hole, with exact independence and unchanged points outside the selected box. This proof covers the whole allowed depth interval; sampled numerical results alone would not establish it.

At most one control acts on a point and its total displacement is at most .55. The base torus lies in radius 1.17, so all allowed deformations lie in radius 1.72. The fixed 1.8 envelope has margin and remains valid under rotation.

`independence.json`: 16,000 samples across all 16 extreme sign combinations; minimum sampled determinant 0.2498, inverse error <5.4e−15, exactly zero cross-control/outside displacement, and identical maps in both pages. Boundary derivative error <6.6e−12.

## Curvature and visual comparison

`curvature.cjs` compares the old and new embedded surface maps at the same slider settings using the first and second fundamental forms. It samples 120² and 240² grids, then refines the sampled maximum locally and checks finite-difference steps 2e−4, 1e−4, 5e−5. The search is numerical, not a certified global curvature bound.

| Depth | Old maximum | New maximum | Old/new handle displacement magnitude |
|---|---:|---:|---:|
| −0.40 | 138.20 | 14.43 | .3465 / .3257 |
| −0.55 | 176.17 | 22.27 | .4206 / .3934 |
| +0.55 | 61.54 | 7.41 | .4206 / .3934 |

No amplitude multiplier was added. The handle displacement changes by about 6%, while peak curvature drops about 87–90%. This is a change of transition shape, not merely a reduced slider limit. Sphere's existing depth-dependent support widening was inspected; its deformation code is unchanged.

`morse-before.png` / `morse-after.png` and `contour-before.png` / `contour-after.png` show depth −.55. The old sharp rim is replaced with a broader smooth depression. The contour comparison includes the requested larger fixed initial framing. `initial-*.png` compares undeformed sphere and torus at the same desktop viewport.

## Numerical and UI checks

Run scripts from the repository root with Node; browser scripts require Playwright and `/usr/bin/chromium`, and serve this checkout on port 8001. Baseline screenshots/framing comparison use baseline 182d0a0 served on port 8002.

- `numerics.cjs`: deformed Morse root agreement using 32²/52²/76² seeds for eight configurations, Euler total 0, positive immersion area and periodic seams; contour levels 4/5/6 agree in tested cases; trajectories and inverse images use the deformed map.
- Default direction at depth 0 has Morse counts (1,2,1); right control −.4 and −.55 gives (1,3,2). Contour default direction changes from 0 to 2 cusps while total projective rotation number remains 0. Cusp counts here are audit data, not exposed numerically in the exercise UI.
- `fold.cjs`: depth −.37523931706512426 gives an unclassified critical point and invalid census; vertical critical circles also remain invalid. Transition states are not accepted as a correct count.
- `ui.cjs`, `marks.cjs`: desktop and mobile-emulated mouse/touch dragging, sliders, selection/reselection, reset, surface switching, full-width input, feedback, component toggles; gray markers persist during rotation for sphere and torus, rotate with the surface, and do not change deformation depths.
- `fixed-view.cjs`, `feedback.cjs`: fixed scale/center, unchanged other handles, preservation of manual zoom, “正解！” then “値は変わった？”.
- `regression.cjs`: unchanged sphere computation modules and identical sampled maps for six other surfaces.

Limits: these are sampled convergence checks, not certification of all views/depths. Near singular transitions the existing uncertainty fallback is retained. Mobile checks emulate touch in Chromium, not physical devices. Public Pages URLs cannot be fetched from this environment (proxy CONNECT 403); GitHub deployment confirmation is reported separately.
