// DeepSeek Recap — pagina delle impostazioni.

const els = {
  form: document.getElementById("settings-form"),
  key: document.getElementById("api-key"),
  language: document.getElementById("language"),
  model: document.getElementById("model"),
  test: document.getElementById("btn-test"),
  status: document.getElementById("status")
};

const VALID_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];

async function load() {
  const { settings = {} } = await chrome.storage.local.get("settings");
  els.key.value = settings.apiKey || "";
  els.language.value = settings.language || "italiano";
  els.model.value = VALID_MODELS.includes(settings.model)
    ? settings.model
    : "deepseek-v4-flash";
}

async function save() {
  const settings = {
    apiKey: els.key.value.trim(),
    language: els.language.value,
    model: VALID_MODELS.includes(els.model.value) ? els.model.value : "deepseek-v4-flash"
  };
  await chrome.storage.local.set({ settings });
  flash("Impostazioni salvate ✓", "ok");
}

function flash(msg, kind) {
  els.status.textContent = msg;
  els.status.className = "status " + (kind || "");
  setTimeout(() => {
    if (els.status.textContent === msg) els.status.textContent = "";
  }, 4000);
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  save();
});

els.test.addEventListener("click", async () => {
  const apiKey = els.key.value.trim();
  if (!apiKey) {
    flash("Inserisci prima la chiave API.", "error");
    return;
  }

  els.test.disabled = true;
  els.test.textContent = "Test in corso…";
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: els.model.value,
        messages: [{ role: "user", content: "Rispondi solo con: OK" }],
        max_tokens: 5,
        stream: false
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    flash("Connessione riuscita ✓", "ok");
  } catch (err) {
    flash(`Test fallito: ${err.message}. Controlla la chiave API.`, "error");
  } finally {
    els.test.disabled = false;
    els.test.textContent = "Testa connessione";
  }
});

load();
