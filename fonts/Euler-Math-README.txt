Euler Math v0.77 — unmodified webfont transfer bundle
====================================================

Purpose
-------
This bundle supplies the original Euler-Math.otf font for integration into
an existing static site. It is not a modified, subsetted, renamed, or
converted font. The OTF bytes are unchanged from the verified CTAN mirror.
No Noto font or unrelated TeX package files are included.

Contents
--------
Euler-Math.otf             Original unmodified font, 445708 bytes.
OFL.txt                    Exact copyright notices from the font's name
                           table, followed by the full official SIL OFL 1.1.
ORIGINAL-FONT-NOTICES.json  Verbatim name-table notice fields extracted
                           from the included original font.
README.txt                 This handoff and provenance document.
SHA256SUMS                 SHA-256 checksums for the other bundle files.

Provenance
----------
Font download source (downloaded and inspected 2026-10-25):
https://mirrors.ibiblio.org/CTAN/fonts/euler-math/Euler-Math.otf

Upstream package identification:
https://ctan.org/pkg/euler-math

Upstream license declaration independently verified from:
https://mirrors.ibiblio.org/CTAN/fonts/euler-math/README.md
The README assigns SIL OFL 1.1 to Euler-Math.otf and LPPL to the package's
other files. Those other upstream files are not redistributed here.

Full official license text source, inspected through the web tool:
https://openfontlicense.org/documents/OFL.txt
https://openfontlicense.org/open-font-license-official-text/
The official license body is reproduced in full and unchanged. Its
example placeholder copyright/RFN header is replaced with the actual,
unmodified copyright notices extracted from the included font. This
OFL.txt is a distribution notice assembled for this bundle, not a claim
that the upstream archive supplied an identically named standalone file.

The source font itself already contains its original copyright notices,
OFL 1.1 declaration, and license URL. All font metadata is preserved.

License and redistribution
-------------------------
The font remains under SIL OFL 1.1. Keep OFL.txt and the original notices
with the deployed/distributed font. This bundle does not change the
license of the site or its content. No permissions from a commercial
font service are claimed or needed for this OFL font. This README and
checksum manifest are handoff materials; they add no license restrictions.

Identity
--------
Font family from name table: Euler Math
Version from name table: Version 0.77
SHA-256:
c7eefad6f80150033c980b37e7472aa719c6d62a1001cb431fa576bd21b6c8c2

Rendering caveat
----------------
Unicode superscript/subscript characters such as U+00B2 (2 superscript),
U+2082 (2 subscript), and U+1D62 (i subscript) are not in this font's cmap.
Use ordinary Euler digits/letters positioned as scripts in HTML/MathML,
or positioned/scaled as separate runs on canvas, to avoid silent fallback.
Load the font before canvas drawing and redraw once loading completes.
