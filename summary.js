// DeepSeek Recap — pagina dei risultati.
// Legge il testo salvato dal service worker, chiama l'API DeepSeek
// e mostra il riassunto.

const API_URL = "https://api.deepseek.com/chat/completions";

const els = {
  header: document.getElementById("recap-header"),
  pageLink: document.getElementById("page-link"),
  body: document.getElementById("recap-body"),
  loading: document.getElementById("loading"),
  summary: document.getElementById("summary"),
  error: document.getElementById("error"),
  empty: document.getElementById("empty"),
  copyBtn: document.getElementById("btn-copy"),
  retryBtn: document.getElementById("btn-retry"),
  openPageBtn: document.getElementById("btn-open-page")
};

let current = null;

async function init() {
  const { recap } = await chrome.storage.local.get("recap");

  if (!recap || (!recap.text && !recap.summary && !recap.error)) {
    showOnly("empty");
    return;
  }

  current = recap;
  renderHeader(recap);

  if (recap.status === "done" && recap.summary) {
    renderSummary(recap.summary);
  } else if (recap.status === "error") {
    renderError(recap.error || "Errore sconosciuto");
  } else {
    showOnly("loading");
    await run();
  }
}

function renderHeader(r) {
  if (r.tabTitle) document.title = `Riassunto — ${r.tabTitle}`;
  els.header.textContent = r.tabTitle || "Riassunto";
  if (r.tabUrl) {
    els.pageLink.href = r.tabUrl;
    els.openPageBtn.classList.remove("hidden");
  }
}

// Avvia (o riavvia) la richiesta di riassunto.
async function run() {
  const { settings = {} } = await chrome.storage.local.get("settings");

  if (!settings.apiKey) {
    const msg =
      "Nessuna chiave API configurata. Apri le Impostazioni dell'estensione e inserisci la tua chiave DeepSeek (platform.deepseek.com/api_keys).";
    current = { ...current, status: "error", error: msg };
    await chrome.storage.local.set({ recap: current });
    renderError(msg);
    return;
  }

  showOnly("loading");
  try {
    const summary = await callDeepSeek(settings, current.text);
    current = { ...current, status: "done", summary, error: "" };
    await chrome.storage.local.set({ recap: current });
    renderSummary(summary);
  } catch (err) {
    current = { ...current, status: "error", error: err.message };
    await chrome.storage.local.set({ recap: current });
    renderError(err.message);
  }
}

async function callDeepSeek(settings, text) {
  const language =
    settings.language === "auto"
      ? "la stessa lingua del contenuto originale"
      : settings.language || "italiano";
  const model = ["deepseek-v4-flash", "deepseek-v4-pro"].includes(settings.model)
    ? settings.model
    : "deepseek-v4-flash";

  const system =
    "Sei un assistente esperto nella creazione di riassunti. " +
    `Scrivi il riassunto in ${language}. ` +
    "Inizia con un riepilogo generale di 2-3 frasi, poi elenca i punti chiave. " +
    "Sii conciso, fedele al contenuto originale e non inventare informazioni.";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text }
      ],
      temperature: 0.3,
      max_tokens: 2048,
      stream: false
    })
  });

  if (!res.ok) {
    let msg = `Errore API DeepSeek (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error && data.error.message) msg += `: ${data.error.message}`;
      else msg += `: ${JSON.stringify(data)}`;
    } catch (_) {
      msg += `: ${(await res.text()).slice(0, 300)}`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const content =
    data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
  if (!content) throw new Error("Risposta vuota da DeepSeek.");
  return content;
}

// ----- Render -----

function showOnly(name) {
  els.loading.classList.toggle("hidden", name !== "loading");
  els.summary.classList.toggle("hidden", name !== "summary");
  els.error.classList.toggle("hidden", name !== "error");
  els.empty.classList.toggle("hidden", name !== "empty");
  els.copyBtn.classList.toggle("hidden", name !== "summary");
  els.retryBtn.classList.toggle("hidden", name !== "error");
}

function renderSummary(md) {
  els.summary.innerHTML = mdToHtml(md);
  showOnly("summary");
}

function renderError(msg) {
  els.error.textContent = msg;
  showOnly("error");
}

// Minima conversione Markdown → HTML, senza dipendenze esterne.
function mdToHtml(md) {
  const esc = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = esc.split("\n");
  let html = "";
  let listType = "";

  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = "";
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^#{1,4}\s/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      html += `<h${level}>${line.replace(/^#+\s/, "")}</h${level}>`;
    } else if (/^[-*]\s/.test(line)) {
      if (listType !== "ul") {
        closeList();
        html += "<ul>";
        listType = "ul";
      }
      html += `<li>${line.replace(/^[-*]\s/, "")}</li>`;
    } else if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") {
        closeList();
        html += "<ol>";
        listType = "ol";
      }
      html += `<li>${line.replace(/^\d+\.\s/, "")}</li>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${line}</p>`;
    }
  }
  closeList();

  return html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

// ----- Azioni -----

els.copyBtn.addEventListener("click", async () => {
  if (!current || !current.summary) return;
  const text = current.summary;
  try {
    await navigator.clipboard.writeText(text);
    els.copyBtn.textContent = "✅ Copiato!";
  } catch (_) {
    // Fallback per contesti in cui l'API clipboard non è disponibile.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    els.copyBtn.textContent = "✅ Copiato!";
  }
  setTimeout(() => (els.copyBtn.textContent = "📋 Copia riassunto"), 2000);
});

els.retryBtn.addEventListener("click", () => {
  if (current) run();
});

els.openPageBtn.addEventListener("click", () => {
  if (current && current.tabUrl) window.open(current.tabUrl, "_blank");
});

init();
