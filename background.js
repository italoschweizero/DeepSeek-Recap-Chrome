// DeepSeek Recap — background service worker (Manifest V3)
// Gestisce il menu contestuale (tasto destro), l'estrazione del testo e la
// chiamata all'API DeepSeek. Il risultato viene mostrato in un popup
// (overlay) nella stessa pagina, senza aprire nuove schede.

const API_URL = "https://api.deepseek.com/chat/completions";
const MAX_TEXT_CHARS = 60000;
const MAX_SUMMARY_CHARS = 500;
const VALID_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];

// ---- Menu contestuale ----

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "recap-selection", title: "Riassumi la selezione con DeepSeek", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "recap-page", title: "Riassumi la pagina con DeepSeek", contexts: ["page"] });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "recap-selection") {
    const text = (info.selectionText || "").trim();
    if (text) startRecap({ text, tab });
  } else if (info.menuItemId === "recap-page") {
    extractPageAndStart(tab);
  }
});

// ---- Messaggi ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "summarize-page") {
    // Richiesta dal popup dell'estensione.
    extractPageAndStart({ id: msg.tabId, title: msg.title, url: msg.url });
    sendResponse({ ok: true });
    return false;
  }

  if (msg && msg.type === "deepseek-recap-fetch") {
    // Chiamata all'API DeepSeek richiesta dal content script.
    // `return true` mantiene il service worker attivo finché rispondiamo.
    runRecapFetch(msg.text)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
});

// ---- Estrazione del testo della pagina ----

function extractPageAndStart(tab) {
  if (!tab || !tab.id) return;
  chrome.scripting
    .executeScript({ target: { tabId: tab.id }, func: extractPageText })
    .then(([{ result }]) => {
      const text = (result || "").trim();
      if (text) startRecap({ text, tab });
      else showNotification("Non è stato possibile estrarre testo dalla pagina.");
    })
    .catch(() =>
      showNotification("Impossibile leggere questa pagina (chrome://, Web Store, ecc. non sono supportati).")
    );
}

// Funzione iniettata nella pagina: restituisce il testo visibile del body.
function extractPageText() {
  const body = document.body;
  if (!body) return "";
  const clone = body.cloneNode(true);
  clone
    .querySelectorAll("script, style, noscript, template, iframe, svg, canvas, video, audio, textarea, input, button, nav, footer")
    .forEach((el) => el.remove());
  return (clone.innerText || "").replace(/[ \t]+\n/g, "\n").trim();
}

// ---- Avvio del riassunto nella pagina corrente ----

async function startRecap({ text, tab }) {
  if (!tab || !tab.id) return;
  const payload = {
    type: "deepseek-recap",
    status: "loading",
    text: truncate(text),
    tabTitle: (tab && tab.title) || "",
    tabUrl: (tab && tab.url) || ""
  };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, payload);
  } catch (_) {
    showNotification("Impossibile mostrare il riassunto in questa pagina (chrome://, Web Store, ecc.).");
  }
}

// ---- Chiamata all'API DeepSeek (richiesta dal content script) ----

async function runRecapFetch(text) {
  const { settings = {} } = await chrome.storage.local.get("settings");
  if (!settings.apiKey) {
    chrome.runtime.openOptionsPage();
    throw new Error("Nessuna chiave API configurata: apri le Impostazioni dell'estensione.");
  }
  return callDeepSeek(settings, text);
}

async function callDeepSeek(settings, text) {
  const language =
    settings.language === "auto"
      ? "la stessa lingua del contenuto originale"
      : settings.language || "italiano";
  const model = VALID_MODELS.includes(settings.model) ? settings.model : "deepseek-v4-flash";

  const system =
    "Sei un assistente esperto nella creazione di riassunti. " +
    `Scrivi il riassunto in ${language}. ` +
    `Il riassunto NON deve superare ${MAX_SUMMARY_CHARS} caratteri (mai di più). ` +
    "Inizia con un riepilogo generale di 2-3 frasi, poi elenca i punti chiave. " +
    "Sii conciso, fedele al contenuto originale e non inventare informazioni.";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      stream: false
    })
  });

  if (!res.ok) {
    let msg = `Errore API DeepSeek (HTTP ${res.status})`;
    try {
      const data = await res.json();
      msg += data && data.error && data.error.message ? `: ${data.error.message}` : `: ${JSON.stringify(data)}`;
    } catch (_) {
      msg += `: ${(await res.text()).slice(0, 300)}`;
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const content =
    data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  if (!content) throw new Error("Risposta vuota da DeepSeek.");
  return content;
}

// ---- Utility ----

function truncate(text) {
  return text.length <= MAX_TEXT_CHARS
    ? text
    : text.slice(0, MAX_TEXT_CHARS) + "\n… [contenuto troncato perché troppo lungo]";
}

function showNotification(message) {
  try {
    chrome.notifications
      .create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "DeepSeek Recap",
        message: String(message).slice(0, 250)
      })
      .catch(() => {});
  } catch (_) {
    /* il permesso "notifications" evita errori qui */
  }
}
