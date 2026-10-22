/* Manifest V3 screenshot coordinator. No background DOM or eval. */
let job = null;
let selectionTab = null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function activeTab() { const tabs = await chrome.tabs.query({active:true,currentWindow:true}); if (!tabs[0]) throw new Error('No active tab'); return tabs[0]; }
async function messageTab(msg) { return chrome.tabs.sendMessage(job.tab.id,msg); }
// Measure the CSS viewport in the webpage rather than using tabs.Tab.width,
// which is not a dependable measure of the captured CSS pixel dimensions.
async function getViewportMetrics(tabId) {
 try {
  const results = await chrome.scripting.executeScript({
   target: {tabId},
   func: () => ({width: window.innerWidth, height: window.innerHeight,
                dpr: window.devicePixelRatio})
  });
  return results?.[0]?.result || null;
 } catch (error) {
  console.warn('Unable to read viewport dimensions; using screenshot fallback:', error);
  return null;
 }
}
async function capture() { await delay(550); const url = await chrome.tabs.captureVisibleTab(job.tab.windowId,{format:'png'}); return createImageBitmap(await (await fetch(url)).blob()); }
async function save() {
 const blob = await job.canvas.convertToBlob({type:'image/png'});
 // FileReaderSync is unavailable in extension service workers.
 // Convert the PNG Blob to a data URL using supported ArrayBuffer APIs.
 const bytes = new Uint8Array(await blob.arrayBuffer());
 const chunks = [];
 for (let i = 0; i < bytes.length; i += 32768) {
   chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
 }
 const dataUrl = `data:image/png;base64,${btoa(chunks.join(''))}`;
 await chrome.storage.local.set({lastCapture:{dataUrl,title:job.tab.title,cssWidth:job.cssWidth,cssHeight:job.cssHeight}});
 await chrome.tabs.create({url:chrome.runtime.getURL('contrast-analyzer.html')});
 job=null;
}
async function begin(kind, sourceTab) {
 if(job) throw new Error('Capture already in progress');
 const tab=sourceTab || await activeTab(); job={tab};
 try {
   if(kind==='capture_area') {
     // Displaying the selector is not a screenshot capture. Release the lock
     // *before* messaging the content script, so Firefox cannot leave it
     // occupied if the content script fails to acknowledge the request.
     job = null;
     selectionTab = tab;
     try {
       await chrome.tabs.sendMessage(tab.id, {msg:'show_selection_area'});
     } catch (error) {
       selectionTab = null;
       throw error;
     }
     return;
   }
   if(kind==='capture_screen') throw new Error('Screen capture is not supported');
   if(kind==='capture_window' || kind==='capture_special_page') {
     const viewport=await getViewportMetrics(tab.id);
     const bitmap=await capture(); const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
     canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();job.canvas=canvas;
     // Chrome screenshots use device pixels; tab dimensions are CSS pixels.
     const dpr = (viewport?.dpr > 0 && Number.isFinite(viewport.dpr)) ? viewport.dpr : 1;
     job.cssWidth = (viewport?.width > 0) ? viewport.width : Math.round(bitmap.width / dpr);
     job.cssHeight = (viewport?.height > 0) ? viewport.height : Math.round(bitmap.height / dpr);
     await save();return;
   }
   if(kind==='capture_webpage' || kind==='capture_selected') {
     const start=await messageTab({msg:kind==='capture_selected'?'capture_selected':'scroll_init'});
     if(!start || start.msg!=='scroll_init_done') throw new Error('Unable to prepare scroll capture');
     job.start=start;
     let bitmap=await capture();
     const scaleX=bitmap.width/(kind === 'capture_selected' ? (start.screenWidth || start.visibleWidth) : start.visibleWidth),
           scaleY=bitmap.height/(kind === 'capture_selected' ? (start.screenHeight || start.visibleHeight) : start.visibleHeight);
     const canvas=new OffscreenCanvas(Math.max(1,Math.round(start.canvasWidth*scaleX)),Math.max(1,Math.round(start.canvasHeight*scaleY)));
     job.canvas=canvas;
     job.cssWidth=start.canvasWidth; job.cssHeight=start.canvasHeight;
     // Selection is expressed in CSS document coordinates. A screenshot, however,
     // is a bitmap in physical pixels (often 2x on Retina). Crop each captured
     // viewport using its *actual* scroll position, rather than assuming the
     // selection begins at screenshot pixel (0, 0).
     const selected = kind === 'capture_selected';
     const screenWidth = start.screenWidth || start.visibleWidth;
     const screenHeight = start.screenHeight || start.visibleHeight;
     const cropTile = (bitmap, scrollX, scrollY) => {
       const pixelX = bitmap.width / screenWidth;
       const pixelY = bitmap.height / screenHeight;
       const left = Math.max(start.startX, scrollX);
       const top = Math.max(start.startY, scrollY);
       const right = Math.min(start.startX + start.canvasWidth, scrollX + start.visibleWidth);
       const bottom = Math.min(start.startY + start.canvasHeight, scrollY + start.visibleHeight);
       if (right <= left || bottom <= top) return;
       const sourceX = (left - scrollX) * pixelX;
       const sourceY = (top - scrollY) * pixelY;
       const width = (right - left) * pixelX;
       const height = (bottom - top) * pixelY;
       // The canvas scale is derived from captureVisibleTab, not from a
       // presumed devicePixelRatio (which can differ under browser zoom).
       const destX = (left - start.startX) * scaleX;
       const destY = (top - start.startY) * scaleY;
       const destWidth = (right - left) * scaleX;
       const destHeight = (bottom - top) * scaleY;
       canvas.getContext('2d').drawImage(bitmap, sourceX, sourceY,
         width, height, destX, destY, destWidth, destHeight);
     };
     let currentScrollX=start.scrollX, currentScrollY=start.scrollY;
     let indexX=0,indexY=0;
     for(let i=0;i<500;i++) {
       const x=Math.round(indexY*start.visibleWidth*scaleX),y=Math.round(indexX*start.visibleHeight*scaleY);
       const w=Math.min(bitmap.width,canvas.width-x),h=Math.min(bitmap.height,canvas.height-y);
       if(selected) cropTile(bitmap, currentScrollX, currentScrollY);
       else if(w>0&&h>0) canvas.getContext('2d').drawImage(bitmap,0,0,w,h,x,y,w,h);
       bitmap.close();
       const next=await messageTab({msg:'scroll_next',visibleWidth:start.visibleWidth,visibleHeight:start.visibleHeight});
       if(!next || next.msg==='scroll_finished') break;
       if(next.msg!=='scroll_next_done') throw new Error('Scroll capture interrupted');
       indexX=next.scrollXCount;indexY=next.scrollYCount;
       currentScrollX=next.scrollX;currentScrollY=next.scrollY;
       bitmap=await capture();
     }
     await save(); return;
   }
 } catch(err) { console.error('Capture failed:',err); job=null; throw err; }
}
chrome.runtime.onMessage.addListener((request,sender,respond)=>{
 if(request.msg==='capture_selected' && sender.tab) {
   const tab = sender.tab;
   // Explicitly acknowledge the content-script request instead of silently
   // discarding errors from a detached background capture promise.
   if(job) {
     respond({ok:false,error:'Another screenshot capture is already in progress'});
     return false;
   }
   console.info('[CCA] Region confirmed; starting capture', tab.id);
   respond({ok:true});
   selectionTab=null;
   begin('capture_selected',tab).then(() => {
     console.info('[CCA] Region capture completed');
   }).catch(error => {
     console.error('[CCA] Region capture failed',error);
     chrome.tabs.sendMessage(tab.id,{msg:'capture_error',error:String(error?.message||error)})
       .catch(() => {});
   });
   return false;
 }
 if(request.msg==='capture_selected') {
   const tab = selectionTab;
   if(!tab) {
     respond({ok:false,error:'Cannot identify the tab containing the selected region'});
     return false;
   }
   respond({ok:true});
   selectionTab=null;
   begin('capture_selected',tab).catch(error => {
     console.error('[CCA] Region capture failed',error);
     chrome.tabs.sendMessage(tab.id,{msg:'capture_error',error:String(error?.message||error)})
       .catch(() => {});
   });
   return false;
 }
 if(request.msg==='capture_hot_key') return false;
 if(request.msg==='start_capture') {
   begin(request.kind).then(()=>respond({ok:true})).catch(err=>respond({ok:false,error:err.message}));
   return true;
 }
 return false;
});
