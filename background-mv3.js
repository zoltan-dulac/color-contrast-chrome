/* Manifest V3 screenshot coordinator. No background DOM or eval. */
let job = null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function activeTab() { const tabs = await chrome.tabs.query({active:true,currentWindow:true}); if (!tabs[0]) throw new Error('No active tab'); return tabs[0]; }
async function messageTab(msg) { return chrome.tabs.sendMessage(job.tab.id,msg); }
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
 await chrome.storage.local.set({lastCapture:{dataUrl,title:job.tab.title}});
 await chrome.tabs.create({url:chrome.runtime.getURL('contrast-analyzer.html')});
 job=null;
}
async function begin(kind) {
 if(job) throw new Error('Capture already in progress');
 const tab=await activeTab(); job={tab};
 try {
   if(kind==='capture_area') { await messageTab({msg:'show_selection_area'}); job=null; return; }
   if(kind==='capture_screen') throw new Error('Screen capture is not supported');
   if(kind==='capture_window' || kind==='capture_special_page') {
     const bitmap=await capture(); const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
     canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();job.canvas=canvas;await save();return;
   }
   if(kind==='capture_webpage' || kind==='capture_selected') {
     const start=await messageTab({msg:kind==='capture_selected'?'capture_selected':'scroll_init'});
     if(!start || start.msg!=='scroll_init_done') throw new Error('Unable to prepare scroll capture');
     job.start=start;
     let bitmap=await capture();
     const scaleX=bitmap.width/start.visibleWidth,scaleY=bitmap.height/start.visibleHeight;
     const canvas=new OffscreenCanvas(Math.max(1,Math.round(start.canvasWidth*scaleX)),Math.max(1,Math.round(start.canvasHeight*scaleY)));
     job.canvas=canvas;
     let indexX=0,indexY=0;
     for(let i=0;i<500;i++) {
       const x=Math.round(indexY*start.visibleWidth*scaleX),y=Math.round(indexX*start.visibleHeight*scaleY);
       const w=Math.min(bitmap.width,canvas.width-x),h=Math.min(bitmap.height,canvas.height-y);
       if(w>0&&h>0) canvas.getContext('2d').drawImage(bitmap,0,0,w,h,x,y,w,h);
       bitmap.close();
       const next=await messageTab({msg:'scroll_next',visibleWidth:start.visibleWidth,visibleHeight:start.visibleHeight});
       if(!next || next.msg==='scroll_finished') break;
       if(next.msg!=='scroll_next_done') throw new Error('Scroll capture interrupted');
       indexX=next.scrollXCount;indexY=next.scrollYCount;
       bitmap=await capture();
     }
     await save(); return;
   }
 } catch(err) { console.error('Capture failed:',err); job=null; throw err; }
}
chrome.runtime.onMessage.addListener((request,sender,respond)=>{
 if(request.msg==='capture_selected' && sender.tab) {
   if(!job) begin('capture_selected').catch(console.error);
   return;
 }
 if(request.msg==='capture_hot_key') return;
 if(request.msg==='start_capture') {
   begin(request.kind).then(()=>respond({ok:true})).catch(err=>respond({ok:false,error:err.message}));
   return true;
 }
});
