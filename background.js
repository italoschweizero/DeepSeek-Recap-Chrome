// DeepSeek Recap — background service worker (Manifest V3)
// Gestisce il menu contestuale (tasto destro) e l'estrazione del testo.

const MAX_TEXT_CHARS = 60000;

// Crea le voci del menu contestuale all'installazione/avvio.
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "recap-selection",
      title: "Riassumi la selezione con DeepSeek",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "recap-page",
      title: "Riassumi la pagina con DeepSeek",
      contexts: ["page"]
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

// Click sulle voci del menu contestuale.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "recap-selection") {
    const text = (info.selectionText || "").trim();
    if (text) openRecapTab({ text, tab });
  } else if (info.menuItemId === "recap-page") {
    summarizePageTab(tab);
  }
});

// Messaggio inviato dal popup ("Riassumi questa pagina").
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "summarize-page") {
    summarizePageTab({ id: msg.tabId, title: msg.title, url: msg.url });
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

// Estrae il testo del corpo della pagina corrente.
function summarizePageTab(tab) {
  if (!tab || !tab.id) return;
  chrome.scripting
    .executeScript({ target: { tabId: tab.id }, func: extractPageText })
    .then(([{ result }]) => {
      const text = (result || "").trim();
      if (text) openRecapTab({ text, tab });
      else notifyError("Non è stato possibile estrarre testo dalla pagina.");
    })
    .catch(() =>
      notifyError(
        "Impossibile leggere questa pagina. Le pagine speciali (chrome://, Web Store, pagine aziendali protette) non sono supportate."
      )
    );
}

// Funzione iniettata nella pagina: clona il body, rimuove elementi non testuali
// e restituisce il testo visibile.
function extractPageText() {
  const body = document.body;
  if (!body) return "";
  const clone = body.cloneNode(true);
  clone
    .querySelectorAll(
      "script, style, noscript, template, iframe, svg, canvas, video, audio, textarea, input, button, nav, footer"
    )
    .forEach((el) => el.remove());
  return (clone.innerText || "").replace(/[ \t]+\n/g, "\n").trim();
}

function truncate(text, max = MAX_TEXT_CHARS) {
  if (text.length <= max) return text;
  return (
    text.slice(0, max) +
    "\n… [contenuto troncato perché troppo lungo per la richiesta]"
  );
}

// Salva il testo estratto e apre la pagina dei risultati.
async function openRecapTab({ text, tab }) {
  const recap = {
    status: "loading",
    text: truncate(text),
    tabTitle: (tab && tab.title) || "",
    tabUrl: (tab && tab.url) || "",
    summary: "",
    error: "",
    requestedAt: Date.now()
  };
  await chrome.storage.local.set({ recap });
  const url = chrome.runtime.getURL("summary.html");
  if (tab && tab.windowId != null) {
    chrome.tabs.create({ url, index: (tab.index || 0) + 1, active: true });
  } else {
    chrome.tabs.create({ url, active: true });
  }
}

// Salva un errore e apre la pagina dei risultati per mostrarlo.
function notifyError(message) {
  chrome.storage.local.set({
    recap: {
      status: "error",
      error: message,
      text: "",
      tabTitle: "",
      tabUrl: "",
      summary: "",
      requestedAt: Date.now()
    }
  });
  chrome.tabs.create({ url: chrome.runtime.getURL("summary.html"), active: true });
}
