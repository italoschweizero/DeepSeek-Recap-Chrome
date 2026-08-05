// DeepSeek Recap — popup dell'estensione.

const els = {
  status: document.getElementById("status"),
  btnPage: document.getElementById("btn-page"),
  btnOptions: document.getElementById("btn-options")
};

async function init() {
  const { settings = {} } = await chrome.storage.local.get("settings");
  if (settings.apiKey) {
    els.status.textContent = "Chiave API configurata ✓";
    els.status.classList.add("ok");
  } else {
    els.status.textContent = "Chiave API non configurata — apri le Impostazioni";
    els.status.classList.add("warn");
  }
}

els.btnPage.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  await chrome.runtime.sendMessage({
    type: "summarize-page",
    tabId: tab.id,
    title: tab.title,
    url: tab.url
  });
  window.close();
});

els.btnOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

init();
