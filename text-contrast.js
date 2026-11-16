/* HTML text contrast audit, kept separate from screenshot-based analysis.
 * WCAG 2.x contrast: direct foreground/background colours only.
 * Does not claim to test text on image/gradient or more complex stacking.
 */
(() => {
  'use strict';
  if (window.__ccaTextContrastInstalled) return;
  window.__ccaTextContrastInstalled = true;

  const MAX_NODES = 12000;
  const MAX_FAILURES = 250;
  const MAX_LIST_ITEMS = 100;
  const IGNORE = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'HEAD', 'META', 'TITLE', 'IFRAME']);
  let rootHost = null;
  let shadow = null;
  let overlay = null;
  let panel = null;
  let violations = [];
  let scheduled = 0;
  let lastFocused = null;
  let lastStandard = 'AA';
  let lastTotal = 0;
  let lastUnknown = 0;
  let lastPassed = 0;
  let lastTruncated = false;
  const colorCache = new Map();
  const pixel = document.createElement('canvas');
  pixel.width = pixel.height = 1;
  const ctx = pixel.getContext('2d', {willReadFrequently: true});

  function rgba(css) {
    if (!ctx || !css) return null;
    if (colorCache.has(css)) return colorCache.get(css);
    ctx.fillStyle = '#010203';
    ctx.fillStyle = css;
    // If parsing failed, canvas silently preserves the previous fillStyle.
    if (ctx.fillStyle === '#010203' && css.toLowerCase() !== '#010203') {
      colorCache.set(css, null);
      return null;
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const pixels = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    const result = pixels.map((value, i) => i === 3 ? value / 255 : value);
    colorCache.set(css, result);
    return result;
  }

  function over(front, back) {
    const a = front[3] + back[3] * (1 - front[3]);
    if (!a) return [0, 0, 0, 0];
    return [0, 1, 2].map(i => Math.round((front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / a)).concat(a);
  }

  function luminance(rgb) {
    const c = rgb.slice(0, 3).map(v => {
      const x = v / 255;
      return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
    });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }

  function ratio(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }

  function isRendered(el) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.contentVisibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    return true;
  }

  function backgroundAndStyle(el) {
    const path = [];
    for (let curr = el; curr; curr = curr.parentElement) {
      if (!isRendered(curr)) return {skip: true, reason: 'hidden'};
      const style = getComputedStyle(curr);
      if (style.backgroundImage && style.backgroundImage !== 'none') return {skip: true, reason: 'image or gradient'};
      if (style.mixBlendMode !== 'normal' || style.filter !== 'none' || (style.backdropFilter || 'none') !== 'none' || Number(style.opacity) !== 1) {
        return {skip: true, reason: 'visual effects or opacity'};
      }
      const bg = rgba(style.backgroundColor);
      if (!bg) return {skip: true, reason: 'unsupported colour'};
      path.push(bg);
    }
    // CSS canvas base defaults to white; ancestor backgrounds are painted in order.
    let background = [255, 255, 255, 1];
    for (const bg of path.reverse()) background = over(bg, background);
    return {background};
  }

  function threshold(el, standard) {
    const st = getComputedStyle(el);
    const size = parseFloat(st.fontSize);
    const weight = st.fontWeight === 'bold' ? 700 : parseInt(st.fontWeight, 10);
    const isLarge = size >= 24 || (size >= (14 * 96 / 72) && weight >= 700);
    return standard === 'AAA' ? (isLarge ? 4.5 : 7) : (isLarge ? 3 : 4.5);
  }

  function textNodes() {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (nodes.length >= MAX_NODES) break;
      if (!node.textContent || !/\S/u.test(node.textContent)) continue;
      const owner = node.parentElement;
      if (!owner || IGNORE.has(owner.tagName) || owner.closest('script,style,noscript,template,svg,canvas,iframe')) continue;
      if (rootHost && rootHost.contains(node)) continue;
      nodes.push(node);
    }
    return {nodes, capped: Boolean(node)};
  }

  function audit(standard) {
    let total = 0, unknown = 0, passed = 0;
    const issues = [];
    let truncated = false;
    const {nodes, capped} = textNodes();
    for (const node of nodes) {
      const el = node.parentElement;
      // Even hidden ancestors have no visible text.
      if (!el || !isRendered(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects()).filter(r => r.width > 0.5 && r.height > 0.5);
      if (!rects.length) continue;
      const result = backgroundAndStyle(el);
      if (result.skip && result.reason === 'hidden') continue;
      total++;
      if (result.skip) {
        unknown++;
        continue;
      }
      const foreground = rgba(getComputedStyle(el).color);
      if (!foreground) { unknown++; continue; }
      const compositeForeground = over(foreground, result.background);
      const actual = ratio(compositeForeground, result.background);
      const minimum = threshold(el, standard);
      if (actual + 1e-9 >= minimum) { passed++; continue; }
      if (issues.length < MAX_FAILURES) issues.push({node, element: el, range, actual, minimum, snippet: node.textContent.trim().replace(/\s+/gu, ' ').slice(0, 95)});
      else truncated = true;
    }
    return {issues, total, unknown, passed, capped: capped || truncated};
  }

  const panelCSS = `
    :host { all: initial; color-scheme: light; font: 14px/1.4 system-ui, sans-serif; }
    #cca-panel { position: fixed; top: 12px; right: 12px; width: min(360px, calc(100vw - 24px)); max-height: min(620px, calc(100vh - 24px)); overflow: auto; background: #fff; color: #141414; border: 2px solid #212121; border-radius: 8px; box-shadow: 0 6px 24px #0008; pointer-events: auto; font: 14px/1.45 system-ui,sans-serif; z-index: 2; }
    #cca-panel * { box-sizing: border-box; }
    #cca-panel header { padding: 12px 14px 8px; border-bottom: 1px solid #777; }
    #cca-panel h2 { font: 700 18px/1.3 system-ui,sans-serif; margin: 0 36px 6px 0; color: #151515; }
    #cca-panel button, #cca-panel select { color: #141414; border-radius: 4px; border: 1px solid #555; background: #fff; padding: 5px 8px; font: inherit; cursor: pointer; }
    #cca-panel button:hover { background: #e5edff; }
    #cca-panel :is(button,select,input):focus-visible { outline: 3px solid #075bbe; outline-offset: 2px; }
    #cca-close { position: absolute; top: 8px; right: 8px; }
    #cca-controls { padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    #cca-summary { padding: 0 14px; margin: 4px 0 12px; }
    #cca-note { padding: 0 14px 8px; color: #333; margin: 0; font-size: 12px; }
    #cca-issues { list-style: decimal; padding: 0 12px 0 35px; margin: 4px 0 14px; }
    #cca-issues li { padding: 5px 0; border-top: 1px solid #ddd; overflow-wrap: anywhere; }
    #cca-issues button { max-width: 100%; text-align: left; border: none; background: transparent; color: #064cb1; text-decoration: underline; padding: 1px; }
    .cca-box { position: fixed; box-sizing: border-box; pointer-events: none; background: #ffdd0038; outline: 3px solid #d1220e; outline-offset: 1px; }
    .cca-box-focus { outline-width: 5px; background: #ff99005e; }
  `;

  function close() {
    window.removeEventListener('scroll', refreshOnScroll, true);
    window.removeEventListener('resize', refreshOnScroll);
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = 0;
    if (rootHost) rootHost.remove();
    rootHost = shadow = overlay = panel = null;
    violations = [];
    if (lastFocused?.isConnected && typeof lastFocused.focus === 'function') lastFocused.focus({preventScroll: true});
  }

  function createUI() {
    lastFocused = document.activeElement;
    rootHost = document.createElement('div');
    rootHost.id = 'cca-text-contrast-host';
    rootHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    shadow = rootHost.attachShadow({mode:'open'});
    const style = document.createElement('style');
    style.textContent = panelCSS;
    overlay = document.createElement('div');
    overlay.id = 'cca-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    panel = document.createElement('aside');
    panel.id = 'cca-panel';
    panel.setAttribute('aria-label', 'HTML text contrast analysis');
    panel.innerHTML = `<header><h2>HTML text contrast</h2><button type="button" id="cca-close" aria-label="Close text contrast analysis">Close</button></header>
      <div id="cca-controls"><label for="cca-level">WCAG level</label><select id="cca-level"><option value="AA">AA</option><option value="AAA">AAA</option></select>
      <button type="button" id="cca-rescan">Rescan</button><label><input type="checkbox" id="cca-show" checked> Highlight failures</label></div>
      <p id="cca-summary" role="status" aria-live="polite"></p>
      <p id="cca-note">Computed CSS colours only. Images, gradients and complex effects cannot be reliably assessed.</p>
      <ol id="cca-issues" aria-label="Text contrast failures"></ol>`;
    shadow.append(style, overlay, panel);
    (document.body || document.documentElement).append(rootHost);
    shadow.getElementById('cca-close').addEventListener('click', close);
    shadow.getElementById('cca-rescan').addEventListener('click', () => scan(lastStandard));
    shadow.getElementById('cca-level').addEventListener('change', event => scan(event.target.value));
    shadow.getElementById('cca-show').addEventListener('change', renderOverlays);
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    window.addEventListener('scroll', refreshOnScroll, true);
    window.addEventListener('resize', refreshOnScroll);
    shadow.getElementById('cca-close').focus();
  }

  function refreshOnScroll() {
    if (!scheduled && rootHost) scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      renderOverlays();
    });
  }

  function renderOverlays(focused) {
    if (!overlay || !rootHost) return;
    overlay.replaceChildren();
    if (!shadow.getElementById('cca-show').checked) return;
    const fragment = document.createDocumentFragment();
    let count = 0;
    for (const item of violations) {
      if (!item.node.isConnected) continue;
      for (const rect of item.range.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;
        const box = document.createElement('div');
        box.className = 'cca-box' + (focused === item ? ' cca-box-focus' : '');
        box.style.cssText = `left:${Math.max(0,rect.left)}px;top:${Math.max(0,rect.top)}px;width:${rect.width}px;height:${rect.height}px`;
        fragment.append(box);
        if (++count >= 600) break;
      }
      if (count >= 600) break;
    }
    overlay.append(fragment);
  }

  function scan(standard) {
    if (!rootHost) return;
    lastStandard = standard;
    shadow.getElementById('cca-level').value = standard;
    shadow.getElementById('cca-summary').textContent = 'Scanning page text…';
    // Timeout gives the status an opportunity to be announced and rendered.
    setTimeout(() => {
      if (!rootHost) return;
      const result = audit(standard);
      violations = result.issues;
      lastTotal = result.total;
      lastUnknown = result.unknown;
      lastPassed = result.passed;
      lastTruncated = result.capped;
      const flagged = result.total - result.passed - result.unknown;
      shadow.getElementById('cca-summary').textContent = `${flagged} failing text runs; ${result.passed} passing; ${result.unknown} not assessed. ${result.total} rendered text runs examined.${result.capped ? ' Partial results: analysis limit reached.' : ''}`;
      const list = shadow.getElementById('cca-issues');
      list.replaceChildren();
      for (let i = 0; i < Math.min(violations.length, MAX_LIST_ITEMS); i++) {
        const issue = violations[i];
        const li = document.createElement('li');
        const jump = document.createElement('button');
        jump.type = 'button';
        jump.textContent = `${issue.snippet || 'Text'} — ${issue.actual.toFixed(2)}:1 (minimum ${issue.minimum}:1)`;
        jump.setAttribute('aria-label', `Go to failure ${i+1}: ${jump.textContent}`);
        jump.addEventListener('click', () => {
          issue.element.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'});
          shadow.getElementById('cca-show').checked = true;
          requestAnimationFrame(() => renderOverlays(issue));
        });
        li.append(jump);
        list.append(li);
      }
      renderOverlays();
    }, 0);
  }

  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg?.msg !== 'cca_toggle_text_contrast') return false;
    try {
      if (rootHost) { close(); respond({ok:true, visible:false}); }
      else { createUI(); scan('AA'); respond({ok:true, visible:true}); }
    } catch (error) { console.error('[CCA] Text contrast analysis failed', error); respond({ok:false,error:String(error?.message||error)}); }
    return false;
  });
})();
