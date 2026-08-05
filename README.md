# ⚡ DeepSeek Recap

Estensione per Google Chrome (Manifest V3) che permette di **riassumere testo selezionato o pagine intere** con **DeepSeek** usando il **tasto destro** del mouse.

## Funzionalità

- 📝 **Tasto destro su una selezione** → *"Riassumi la selezione con DeepSeek"*
- 📄 **Tasto destro su una pagina** → *"Riassumi la pagina con DeepSeek"*
- 🚀 Azione rapida dal **popup** dell'estensione ("Riassumi questa pagina")
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
3. Si aprirà una scheda con il riassunto generato.

## Configurazione

| Opzione | Descrizione |
|---|---|
| Chiave API | Chiave personale da `platform.deepseek.com/api_keys` (salvata solo in locale) |
| Lingua | Italiano, Inglese, ecc., oppure "stessa lingua del contenuto" |
| Modello | `deepseek-chat` (V3) o `deepseek-reasoner` (R1) |

## Struttura del progetto

```
DeepSeek-Recap-Chrome/
├── manifest.json      # Configurazione Manifest V3
├── background.js      # Service worker: menu contestuale ed estrazione testo
├── summary.html|css|js # Pagina dei risultati (chiamata all'API DeepSeek)
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
