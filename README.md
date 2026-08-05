# ⚡ DeepSeek Recap

Estensione per Google Chrome (Manifest V3) che permette di **riassumere testo selezionato o pagine intere** con **DeepSeek** usando il **tasto destro** del mouse.

## Funzionalità

- 📝 **Tasto destro su una selezione** → *"Riassumi la selezione con DeepSeek"*
- 📄 **Tasto destro su una pagina** → *"Riassumi la pagina con DeepSeek"*
- 🚀 Azione rapida dal **popup** dell'estensione ("Riassumi questa pagina")
- 🪟 **Popup nella pagina corrente** — nessuna nuova scheda aperta
- 🎯 **Riassunto limitato a 500 caratteri**
- ⚙️ **Impostazioni** per chiave API, lingua del riassunto e modello
- 📋 Copia del riassunto con un clic

## Installazione (sviluppo)

1. Scarica o clona questo repository.
2. Apri Chrome e vai su `chrome://extensions`.
3. Attiva **Modalità sviluppatore** (in alto a destra).
4. Clicca **Carica estensione non pacchettizzata** e seleziona la cartella del progetto.
5. Ottieni una chiave API su [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).
6. Apri le **Impostazioni** dell'estensione, incolla la chiave e premi **Salva**.

## Utilizzo

1. Su qualsiasi pagina web seleziona del testo (o non selezionare nulla per riassumere l'intera pagina).
2. Fai **tasto destro** e scegli la voce **DeepSeek Recap**.
3. Nella stessa pagina apparirà un **popup** con il riassunto generato (massimo **500 caratteri**), con pulsanti per **copiare**, **riprovare** e aprire la **pagina originale**.

## Limite di lunghezza

Il riassunto viene sempre troncato a un massimo di **500 caratteri**. Anche il prompt inviato a DeepSeek chiede esplicitamente di non superare questo limite.

## Configurazione

| Opzione | Descrizione |
|---|---|
| Chiave API | Chiave personale da `platform.deepseek.com/api_keys` (salvata solo in locale) |
| Lingua | Italiano, Inglese, ecc., oppure "stessa lingua del contenuto" |
| Modello | `deepseek-v4-flash` (V4 Flash) o `deepseek-v4-pro` (V4 Pro) |

## Struttura del progetto

```
DeepSeek-Recap-Chrome/
├── manifest.json      # Configurazione Manifest V3
├── background.js      # Service worker: menu contestuale, estrazione testo, chiamata all'API
├── content.js         # Content script: popup overlay nella pagina (Shadow DOM)
├── popup.html|css|js  # Popup rapido dell'estensione
├── options.html|css|js # Impostazioni (chiave API, lingua, modello)
├── icons/             # Icone dell'estensione
├── tools/             # Script per rigenerare le icone
└── README.md
```

## Note di sicurezza

- La chiave API viene conservata **solo sul tuo computer** tramite `chrome.storage.local`.
- Le richieste vanno direttamente a `https://api.deepseek.com` (il testo selezionato viene inviato a DeepSeek per il riassunto).
- Per le pagine protette (`chrome://`, Web Store, ecc.) l'estensione non può leggere il contenuto.
- Il riassunto viene mostrato in un **popup (overlay)** all'interno della pagina corrente; non vengono aperte nuove schede.
