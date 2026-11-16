# Region capture scrolling fix

When **Capture Page Region** was confirmed, `page.scrollInit()` ran
`window.scrollTo(startX, startY)`. The values were the rectangle's document
coordinates, so this repositioned the webpage immediately before the screenshot.
`scrollNext()` also restored the viewport to `page.startX/page.startY` rather
than the capture's original scroll position.

For `captureSelected`, the initial forced scroll has been removed. The capture
compositor already uses the actual viewport scroll coordinates to crop images.
At completion, the viewport is restored to the scroll position recorded when
`scrollInit()` began (`page.scrollX/page.scrollY`). Whole-page capture retains
its existing scroll-to-origin behavior.

## Manual regression test

In Firefox and Chrome, scroll halfway down a long webpage, draw a region wholly
visible in the viewport and press OK. The page should not visibly jump upward;
the cropped screenshot should match the selected region. Also test a region
spanning more than one viewport, a selection near a page edge, and normal
whole-page capture. Those may involve scrolling as part of screenshot stitching.
