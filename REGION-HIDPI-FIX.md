# High-density selected-region capture fix

The selection is tracked in CSS document pixels. `captureVisibleTab()` returns a screenshot bitmap in physical pixels. The selected-region compositor now uses measured bitmap/CSS-viewport scale factors on each axis and clips the selection against the actual scrolled viewport before drawing, with source and destination rectangles expressed in the appropriate coordinate systems. This also handles scroll-clamped selections near the page edges and does not affect the whole-page capture branch.

Test in both Firefox and Chrome on standard-DPI and Retina displays. Test a region near the top-left, a region near the bottom-right of a long page, and one extending across viewport boundaries. End-to-end browser testing has not been performed.
