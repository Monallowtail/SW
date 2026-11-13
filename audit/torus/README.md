# Torus deformation audit

The two standalone HTML pages contain the same torus map in the main thread
and worker. The older root-level JavaScript modules are not the sources of these
standalone bundles. Sphere deformation and the other surface maps are unchanged.

## Map and global safety

Start with the embedded torus of major radius 0.85 and minor radius 0.32.
Compose four ambient maps, in the order right, top, left, bottom, then apply the
existing rotation. Each map fixes two Cartesian coordinates and changes the
remaining coordinate t by

    t -> t + sign * depth * exp(-(t-sign*1.17)^2-s^2/0.25^2-y^2/0.22^2).

Here t is x or z, s is the other coordinate, sign is +1 or -1, and every depth
lies in [-0.55,0.55]. For fixed s,y the derivative with respect to t is at least
1 - 0.55 sqrt(2/e) = 0.5282298632. The displacement is bounded and the map tends
to the identity at either end of the t-axis. Thus each stage is a smooth global
diffeomorphism, and the composed determinant is at least 0.07785594867.
This is a global bound, not an inference from the sampled surface. The
composition preserves embedding and the torus hole. Gaussian tails avoid cutoff
joins; periodic parameter seams inherit smoothness from the original torus.

A conservative fixed radius is 2.35. The two same-axis centers are 2.34 apart;
the first stage moves that coordinate by at most 0.55. At least one of the two
longitudinal distances is at least 0.895, so each coordinate's total displacement
is at most 0.55(1+exp(-0.895^2)). The Euclidean radius is consequently at most
1.17 + sqrt(2)*0.55(1+exp(-0.895^2)) < 2.35. The screen and view scales use this
fixed envelope, with only manual zoom changing their scale.

## Calculations and limits

While dragging, mesh previews update immediately; old critical points and
trajectories are hidden until the matching calculation finishes.

All mesh points, normals, critical points, Hessians, gradient trajectories,
contours, cusps, rotation numbers, and inverse images use this same map.
The undeformed torus retains its analytic census. A deformed torus uses two
Newton seed grids (32 by 32 and 52 by 52), root-position/index agreement, a
Hessian eigenvalue exclusion band, and the Euler check. The audit adds a 76 by 76
seed grid. A vertical height remains degenerate even after deformation because
the ambient maps preserve y; the analytic critical circles are retained.

The tests include a numerically located birth at depth 0.10576477176013312 in
the initial Morse direction. This state must be unconfirmed, with an unclassified
critical point. Contour counts require the existing mesh convergence and
nondegeneracy checks before input answers are accepted. These are numerical
checks, not an interval-arithmetic completeness certificate for every possible
slider setting and direction. Near a transition, an unconfirmed result is
intentional. Unresolved trajectory branches remain omitted, with diagnostics;
there is no invented connection across a critical point.

On the initial Morse direction, the right handle at -0.4 gives counts (3,4,1),
compared with (1,2,1) at zero. Returning the slider to zero reverses the change.
On the initial contour direction (yaw 0.13, pitch 0.21), right depth -0.2 already
produces a pair of cusps. Actual cusp counts appear only in this audit, not in
the user-facing question.

## Reproduction

From the repository root:

    node audit/torus/ambient.cjs
    node audit/torus/numerics.cjs
    python -m http.server 8000
    node audit/torus/ui.cjs

The browser test requires Playwright and Chromium (override CHROMIUM if needed).
JSON files record results. The four PNGs show desktop and mobile renderings.
The browser tests cover real mouse and emulated touch drags, slider changes,
region reselection, rotation mode, reset, switching through sphere and Klein,
full-width answer input, component selection/reselection, and fixed contour
framing across deformation. Screenshots were also visually inspected. Mobile
coverage uses Chromium emulation, not physical iOS/Android hardware.
