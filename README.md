Color Contrast Analyzer Extension for Chrome and Firefox
=========================================================

This was based on the Color Contrast Analyzer Extension for Google Chrome created by Greg Kraus of NC State University IT Accessibility Resources.  Since it hadn't been updated for Google Chrome's Manifest v3, it was abandoned.  This project took that code, updated it to support Manifest v3, and added Firefox Extension support as well.

This extension allows you to analyze text color contrast problems on a web page according to the WCAG 2 color contrast requirements.

Why use this tool?
------------------

*   Analyze text over top of background images or gradients
*   Analyze text in images
*   Get a visual overview of the contrast of your page

How to use the tool
-------------------

1.  Go to the page to analyze.
2.  Choose to either analyze a section of the page, the visible portion of the page, or the entire page.
3.  Once the results page appears, adjust the WCAG level to evaluate a different conformance level or text size. In general,
    *   For regular-sized text, choose WCAG AA, Small Non-Bold (4.5:1). This is for text smaller than 18pt. or approximately 1.5em.
    *   For larger text, like headings, choose WCAG AA, Medium-Bold and Large Non-Bold Text (3:1). This is for bold text larger than 14pt or non-bold text larger than 18pt, or approximately 1.2em and 1.5 em, respectively.
4.  Also, you can adjust the pixel analysis radius to better handle anti-aliasing of text where the transition from one color to another is more gradual. Note, increasing the pixel radius will increase the computation time.
5.  Text which passes the given conformance level will be outlined in white.
6.  Toggle the mask on and off to see what elements on the underlying page lack enough contrast.

Things to keep in mind when using this tool
-------------------------------------------

*   You must understand the size of the text you are trying to analyze, because it matters which WCAG criteria you choose.

Tips and Tricks
---------------

*   Almost any type of file you can open in your browser, including image and PDF files, can be evaluated for text color contrast too. For PDF files you will only be able to evaluate the visible portion of the PDF. **To analyze local files you will need to go to your Extensions page and check "Allow access to file URLs" for this extension.**
*   When first installing the extension, you may need to refresh the webpage you wish to analyze for all of the selection options to be available.

Note, when installing the extension it will ask you for permission to access your data on all of your websites and your tabs and browsing activity. We are not using or collecting this data in any way. In order to get permission to take screenshots of your browser window this is the level of access we must request. You can view the [source code for the project](https://web.archive.org/web/20191019190253/https://github.com/gdkraus/color-contrast-chrome).


Notes on the Code
-----------------

Some of this code is from another project from Google.

https://chrome.google.com/webstore/detail/screen-capture-by-google/cpngackimfmofbokmjmljamhdncknpmg

I used the code from this project for creating the draggable selection box. This code has lots of other functionality, most of which I have removed. There could still be some remnants of this code that is basically dormant in the Color Contrast Analyzer at this point.

Versions
--------

This repository:

2.0 
* Added Google Manifest v3 support 
* Added Firefox Support
* Added support for Retina and High Density Displays.

The original NC State University IT Accessibility Resources repository:

1.1.2
* adjusted z-index for the draggable area to the maximum allowed value of 2147483647 to help ensure it will not be positioned underneath other elements

1.1.1
* adjusted CSS for Windows buttons

1.1.0
* added ability to download the image analysis to a local file

1.03
* fixed a bug where the WCAG 2 and pixel radius settings were not sticking once you clicked the rescan button

1.02
* added better support for processing local files within Chrome

1.01
* added keyboard support for the popup window
* increased the z-index value of the draggable area

1.00
* compressed icon images and removed unused images

0.60
* fixed problem with extension not loading when the page was idle for too long
* made the layout screen more fluid
* added WCAG contrast ratio levels to the conformance level selector
* added the link to the help file

0.53
* initial commit



## Cross-browser builds

Run `python3 build.py` to generate Chrome and Firefox builds from shared source. See [CROSS-BROWSER.md](CROSS-BROWSER.md).
