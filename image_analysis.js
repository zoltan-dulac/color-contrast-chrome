/*
 
 Read license.txt for licensing information.
 
 */


var w = 0; // Set after the captured screenshot is drawn
var h = 0;
var image = []; // a container to receive the resulting image

function draw() {
    // create a canvas element to draw the resulting image on
    var canv = document.createElement('canvas');
    canv.id = 'contrastMask';
    canv.width = w;
    canv.height = h;
    // Match the display size of the underlying screenshot canvas; the backing
    // bitmap remains at native physical-pixel resolution.
    canv.style.width = document.getElementById('canvas').style.width;
    canv.style.height = document.getElementById('canvas').style.height;

    document.getElementById('photo').appendChild(canv); // adds the canvas to the body element

    var myContext = document.getElementById('contrastMask').getContext('2d');
    var id = myContext.createImageData(w, h);
    var d = id.data;

    var pixelData; // the value for the RGB of the pixel
    var pixelLocation; // the location to draw the pixel to

    // get the original image
    var cv = document.getElementById('canvas');
    var cvContext = cv.getContext("2d");
    var cvImage = cvContext.getImageData(0, 0, w, h);
    var cvData = cvImage.data;

    // merge the mask (75%) and the original image (25%)
    for (var m = 0; m < h; m += 1) {
        for (var n = 0; n < w; n += 1) {
            pixelData = image[m * (w) + n];
            pixelLocation = (m * (w) + n) * 4
            id.data[pixelLocation + 0] = pixelData * .75 + cvData[pixelLocation + 0] * .25;
            id.data[pixelLocation + 1] = pixelData * .75 + cvData[pixelLocation + 1] * .25;
            id.data[pixelLocation + 2] = pixelData * .75 + cvData[pixelLocation + 2] * .25;
            id.data[pixelLocation + 3] = 255;
        }
        // draw the pixel
    }
    myContext.putImageData(id, 0, 0);

    var bb = dataURItoBlob(canv.toDataURL("image/png"));

    var a = document.getElementById('downloadButton');
    a.download = 'contrast-'+$('levelEvaluated-options').value.toLowerCase() + '.png';
    a.href = window.URL.createObjectURL(bb);

}


function dataURItoBlob(dataURI, callback) {
    // adapted from http://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata/5100158
    // 
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    var bb = new Blob([ab]);
    return bb;
}
;

// launch the analysis as a separate thread
var myWorker = new Worker("background-image-analysis.js");

myWorker.onmessage = function(oEvent) {

    if (oEvent.data.status !== undefined) {
        // update the status of the process
        if (oEvent.data.status == 'done') {
            document.getElementById('percentComplete').innerHTML = "Rendering...";
        } else {
            document.getElementById('percentComplete').innerHTML = oEvent.data.status + '%';
        }
    }

    if (oEvent.data.data !== undefined) {
        // receive the resulting image
        image = new Uint8Array(oEvent.data.data);

        draw();

        myWorker.terminate();
        document.getElementById('percentComplete').innerHTML = 'Complete';
        enableMaskButton(true);
        enableDownloadButton(true);
    }

    try {
        obj = JSON.parse(oEvent.data);
        if (obj.status !== undefined) {
            document.getElementById('percentComplete').innerHTML = obj.status + '%';

        }
    } catch (e) {
    }

};

// This must run AFTER the asynchronous screenshot has been loaded and painted.
// At script evaluation time the canvas still has its default 300x150 size.
function beginContrastAnalysis() {
    const sourceCanvas = document.getElementById('canvas');
    w = sourceCanvas.width;
    h = sourceCanvas.height;
    if (!w || !h) {
        console.error('Contrast analysis cannot start: screenshot canvas is empty');
        return;
    }
    image = new Array(w * h);
    const ctx = sourceCanvas.getContext('2d');
    const imgd = ctx.getImageData(0, 0, w, h);
    const pixView = new Uint8Array(imgd.data);
    const myVars = ['contrastLevel', 'pixelRadius'];
    document.getElementById('percentComplete').textContent = 'Starting...';
    chrome.storage.sync.get(myVars, function(obj) {
        const levelMap = {'WCAG-aa-small': 4.5, 'WCAG-aa-large': 3.0,
                          'WCAG-aaa-small': 7.0, 'WCAG-aaa-large': 4.5};
        const level = levelMap[obj.contrastLevel] || 4.5;
        const parsedRadius = Number(obj.pixelRadius);
        const radius = Number.isInteger(parsedRadius) && parsedRadius >= 1 && parsedRadius <= 3 ? parsedRadius : 2;
        startAnalysis(level, radius, pixView);
    });
}

myWorker.onerror = function(event) {
    console.error('Contrast analysis worker failed:', event.message, event);
    document.getElementById('percentComplete').textContent = 'Analysis failed';
};

function startAnalysis(level, radius, pixView) {
    // send the image and parameters to the thread
    myWorker.postMessage({
        "width": w,
        "height": h,
        "iterations": radius,
        "contrastLevel": level,
        "img": pixView.buffer
    }, [pixView.buffer]);
}
