> Historical audit for commit 182d0a0. The current gentler deformation is documented in [../torus-gentle/README.md](../torus-gentle/README.md).

# Independent torus controls and fixed views

This audit supersedes the deformation tests in `audit/torus`, which describe
commit a8305e8. The paused genus-two/genus-three work is not in this change.

## Local deformation

Let b(s)=exp(-s²/(1-s²)) for |s|<1, and b(s)=0 otherwise.
This function is smooth, including at ±1. For each cardinal outer point, the
support box has radial half-width 0.58, tangential half-width 0.26 and y
half-width 0.25. Its center is at radius 1.17. The four boxes are disjoint:
the nearest radial coordinate is 0.59, whereas the tangential coordinate
has absolute value less than 0.26. The inner equatorial circle (radius 0.53)
is outside every box.

Each control composes twelve maps that fix the two transverse coordinates
and add (sign*depth/12) times the product of the three bumps to the radial
coordinate. The depth range remains [-0.55,0.55]. Since |b'| <= 8/e, each
stage has radial derivative at least

    1 - (0.55/12) * 8/(e*0.58) > 0.

The stage is a smooth global diffeomorphism. It fixes the boundary of its
support box and maps that box onto itself. Thus the boxes remain disjoint
under every stage. At any point at most one control acts, and the composed
determinant is bounded below by the twelfth power of the expression above,
about 0.0417333. The torus stays embedded and its hole stays open.

This gives exact independence, not just small far-field influence: points
outside a selected box are unchanged, including every point in the other
three boxes. Controls commute because their supports are disjoint. The
16,000-point audit includes all sixteen endpoint combinations, inverse
reconstruction, numerical determinants, boundary derivatives, and the
same map in both pages. A torus mesh additionally checks that a combined
setting equals the sum of its independent single-control displacements.

## Fixed views and markers

The Morse torus uses the initial world-to-screen scale and a fixed center,
including while previewing, after the calculation finishes, and after manual
zoom. It no longer derives scale or center from deformed bounds or critical
heights. The contour page retains its existing fixed 2.35-radius envelope.
The new support boxes fit inside radius hypot(1.75,0.26,0.25)<1.8. Only the
existing manual zoom and camera controls change the views.

Both pages draw torus and sphere control markers in gray (#7e817b), in their
existing deformation views and deformation mode. Sphere mathematics and
interaction rules are unchanged. No new controls or explanatory text were
added to the UI. The Morse torus drawing mesh uses level 5 to resolve the
local indentations; critical-point solving remains independent of this mesh.

## Numerical checks and limitations

The report verifies the three seed resolutions 32², 52², 76², root indices,
Euler characteristic zero, contour mesh levels 4/5/6, cusp parity, component
rotation numbers, trajectory positions/heights and inverse-image residuals.
With the initial Morse direction, right depth -0.4 gives (2,4,2), compared
with (1,2,1) at zero. Depth -0.19491107434023613 is a separately located fold;
it is unconfirmed and has an unclassified root. Vertical height remains
degenerate. Numerical convergence is not an interval completeness certificate
for every parameter and direction. The sampled deformed trajectory state has
16 displayed curves and two unresolved branches omitted by the existing
validation/budget policy; no connection is invented. Near transitions the UI may remain
unconfirmed; it must not accept an answer as a confirmed count in that state.

PC and mobile Chromium-emulation tests cover drags, bars, reselection, reset,
surface switching, gray sphere/torus marks, full-width input, component
selection, fixed views, and preservation of manual zoom. Mobile hardware and
other browser engines were not tested. PNGs were also visually inspected.

Run from the repository root, with Playwright and Chromium available:

    node audit/torus-local/independence.cjs
    node audit/torus-local/numerics.cjs
    node audit/torus-local/fold.cjs
    python -m http.server 8001
    node audit/torus-local/ui.cjs
    node audit/torus-local/fixed-view.cjs
