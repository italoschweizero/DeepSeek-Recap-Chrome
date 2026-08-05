// DeepSeek Recap — content script.
// Mostra un popup (overlay) nella pagina corrente, isolato con Shadow DOM.
// La chiamata all'API DeepSeek avviene tramite il service worker.

(() => {
  if (window.__deepseekRecapLoaded) return;
  window.__deepseekRecapLoaded = true;

  const MAX_SUMMARY_CHARS = 2000;

  const STYLE = `
.overlay{position:fixed;top:20px;right:20px;width:420px;max-width:calc(100vw - 40px);max-height:calc(100vh - 40px);display:flex;flex-direction:column;background:#fff;color:#1a2333;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;border:1px solid #dbe1ec;border-radius:12px;box-shadow:0 12px 40px rgba(15,23,42,.28);z-index:2147483647;overflow:hidden}
.head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #e6eaf2;background:#f7f9fd}
.brand{font-weight:700;font-size:13px}
.link{margin-left:auto;font-size:12px;color:#2d5bff;text-decoration:none}
.close{margin-left:8px;border:0;background:transparent;color:#66707f;font-size:16px;cursor:pointer;line-height:1;padding:2px 6px;border-radius:6px}
.close:hover{background:#e6eaf2;color:#1a2333}
.title{padding:10px 14px 0;font-weight:600;font-size:13px;word-break:break-word;max-height:3.2em;overflow:hidden}
.body{padding:10px 14px 14px;overflow-y:auto;min-height:80px}
.foot{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid #e6eaf2;background:#f7f9fd}
.foot button{border:1px solid #dbe1ec;background:#fff;color:#1a2333;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer}
.foot button:hover{background:#eef2fa}
.count{margin-left:auto;font-size:11px;color:#66707f}
.loading{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 0;color:#66707f}
.spinner{width:26px;height:26px;border:3px solid #e6eaf2;border-top-color:#2d5bff;border-radius:50%;animation:dr-spin .9s linear infinite}
@keyframes dr-spin{to{transform:rotate(360deg)}}
.body h2,.body h3,.body h4{margin:12px 0 6px;line-height:1.3}
.body p{margin:8px 0}
.body ul,.body ol{margin:8px 0;padding-left:20px}
.body li{margin:3px 0}
.body strong{font-weight:600}
.body code{background:#eef1f7;border-radius:4px;padding:1px 5px;font-family:Menlo,Consolas,monospace;font-size:12px}
.error{color:#c62828;background:#fdecec;border:1px solid #f5c2c2;border-radius:8px;padding:12px 14px;font-size:13px}
.hidden{display:none !important}
`;

  let host = null;
  let els = {};
  let lastText = "", lastTitle = "", lastUrl = "", lastSummary = "";

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "deepseek-recap") return;
    if (msg.status === "loading") {
      lastText = msg.text || "";
      lastTitle = msg.tabTitle || "";
      lastUrl = msg.tabUrl || "";
      openOverlay();
      showLoading();
      requestRecap();
    }
  });

  // Chiede al service worker di chiamare l'API DeepSeek.
  function requestRecap() {
    chrome.runtime.sendMessage({ type: "deepseek-recap-fetch", text: lastText }, (resp) => {
      if (chrome.runtime.lastError) {
        showError("Errore di comunicazione con l'estensione. Ricarica l'estensione e riprova.");
        return;
      }
      if (!resp || !resp.ok) {
        showError((resp && resp.error) || "Errore sconosciuto.");
        return;
      }
      showSummary(truncate(resp.summary));
    });
  }

  function truncate(text) {
    const s = text || "";
    return s.length <= MAX_SUMMARY_CHARS ? s : s.slice(0, MAX_SUMMARY_CHARS - 1) + "…";
  }

  function openOverlay() {
    if (host && host.isConnected) return;
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      `<style>${STYLE}</style>` +
      `<div class="overlay" role="dialog" aria-label="Riassunto DeepSeek">` +
      `<header class="head"><span class="brand">⚡ DeepSeek Recap</span>` +
      `<a class="link hidden" href="#" target="_blank" rel="noopener">Pagina originale ↗</a>` +
      `<button class="close" type="button" aria-label="Chiudi">✕</button></header>` +
      `<div class="title"></div><div class="body"></div>` +
      `<footer class="foot"><button class="copy hidden" type="button">📋 Copia riassunto</button>` +
      `<button class="retry hidden" type="button">🔄 Riprova</button><span class="count hidden"></span></footer>` +
      `</div>`;
    (document.body || document.documentElement).appendChild(host);

    els = {
      title: shadow.querySelector(".title"),
      body: shadow.querySelector(".body"),
      count: shadow.querySelector(".count"),
      copy: shadow.querySelector(".copy"),
      retry: shadow.querySelector(".retry"),
      close: shadow.querySelector(".close"),
      link: shadow.querySelector(".link")
    };
    els.close.addEventListener("click", closeOverlay);
    els.copy.addEventListener("click", copySummary);
    els.retry.addEventListener("click", () => { showLoading(); requestRecap(); });
    if (lastUrl) { els.link.href = lastUrl; els.link.classList.remove("hidden"); }
  }

  function showLoading() {
    if (els.title) els.title.textContent = lastTitle || "Riassunto";
    hideButtons();
    els.body.innerHTML = `<div class="loading"><div class="spinner"></div><p>DeepSeek sta riassumendo…</p></div>`;
  }

  function showSummary(md) {
    lastSummary = md;
    if (els.title) els.title.textContent = lastTitle || "Riassunto";
    els.body.innerHTML = mdToHtml(md);
    els.count.textContent = `${md.length} / ${MAX_SUMMARY_CHARS} caratteri`;
    els.count.classList.remove("hidden");
    els.copy.classList.remove("hidden");
    els.retry.classList.add("hidden");
  }

  function showError(msg) {
    if (els.title) els.title.textContent = lastTitle || "Errore";
    els.body.innerHTML = `<div class="error">${escapeHtml(msg)}</div>`;
    els.count.classList.add("hidden");
    els.copy.classList.add("hidden");
    els.retry.classList.remove("hidden");
  }

  function hideButtons() {
    els.count.classList.add("hidden");
    els.copy.classList.add("hidden");
    els.retry.classList.add("hidden");
  }

  function closeOverlay() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    els = {};
  }

  function copySummary() {
    if (!lastSummary) return;
    const original = els.copy.textContent;
    const done = () => {
      els.copy.textContent = "✅ Copiato!";
      setTimeout(() => (els.copy.textContent = original), 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastSummary).then(done).catch(() => fallbackCopy(done));
    } else {
      fallbackCopy(done);
    }
  }

  function fallbackCopy(done) {
    const ta = document.createElement("textarea");
    ta.value = lastSummary;
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
    (document.body || document.documentElement).appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    ta.remove();
    done();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function mdToHtml(md) {
    const lines = escapeHtml(md).split("\n");
    let html = "", listType = "";
    const closeList = () => { if (listType) { html += `</${listType}>`; listType = ""; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^#{1,4}\s/.test(line)) {
        closeList();
        const level = line.match(/^#+/)[0].length;
        html += `<h${level}>${line.replace(/^#+\s/, "")}</h${level}>`;
      } else if (/^[-*]\s/.test(line)) {
        if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
        html += `<li>${line.replace(/^[-*]\s/, "")}</li>`;
      } else if (/^\d+\.\s/.test(line)) {
        if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; }
        html += `<li>${line.replace(/^\d+\.\s/, "")}</li>`;
      } else if (line.trim() === "") {
        closeList();
      } else {
        closeList();
        html += `<p>${line}</p>`;
      }
    }
    closeList();
    return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
  }
})();
