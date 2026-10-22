# Firefox capture repair

* Pass the MouseEvent argument explicitly to region drag and resize handlers. Firefox does not provide a global `event` for these callbacks.
* Use documentElement/body scroll and client dimensions instead of non-standard `document.width` and `document.height` for the region overlay and whole-page capture.
* Retain the originating sender tab when a content-script region selection triggers capture.

## Testing

Use an ordinary http/https page. Test visible capture, whole-page capture on a page taller than one viewport, and region capture by dragging and clicking OK. Test Firefox and Chrome, on Retina and standard displays. Whole-page captures of dynamic/sticky pages may still exhibit stitching artifacts.
