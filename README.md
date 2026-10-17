# Ask your notes with Gemma

A tiny Node.js web app that answers questions about your own notes using **Gemma 4**. Paste your notes, ask a question, and get a concise answer grounded only in what you supplied — with the option to run **entirely on your own computer** through [Ollama](https://ollama.com).

Two interchangeable modes:

| Mode | Model | Where it runs | Needs a key? |
| --- | --- | --- | --- |
| **Local** | Gemma 4 E2B (`gemma4:e2b`) | On your machine via Ollama | No |
| **Google API** | Gemma 4 26B A4B (`gemma-4-26b-a4b-it`) | Google Gemini API | Yes (`GEMINI_API_KEY`) |

The model only sees the notes and question you type. In Local mode nothing leaves your computer.

---

## What it does

- **Your notes** — paste up to 6,000 characters of notes. These become the reference context.
- **Your question** — ask anything about those notes.
- **Ask Gemma** — sends the notes + question to the selected model and streams back a short answer. If the answer isn't in your notes, it tells you so instead of guessing.

Each request uses only the current notes and question, so the newest answer replaces the previous one. Refreshing the page clears everything.

---

## Prerequisites

- [Node.js](https://nodejs.org/en/download) **22 or later** (`node --version` to check).
- [Ollama](https://ollama.com/download) — only for **Local** mode.
- A Google AI Studio API key — only for **Google API** mode.

No `npm install` is required; the app uses only the Node.js standard library.

---

## Run it locally, step by step

### 1. Install Node.js

Download and install Node.js 22+ from <https://nodejs.org/en/download>, then confirm it:

```bash
node --version   # should print v22.x or newer
```

### 2. Install Ollama

Download and install Ollama from <https://ollama.com/download> and make sure the Ollama app/service is running.

- **macOS / Windows:** open the installed **Ollama** app — that starts the background server.
- **Linux:** the installer sets up a `systemd` service that starts automatically. If it isn't running, start it:

  ```bash
  sudo systemctl start ollama     # or run: ollama serve
  ```

Confirm Ollama is up:

```bash
curl http://127.0.0.1:11434/api/version
```

### 3. Download the Gemma model

Pull the small Gemma 4 E2B model once (roughly **7.2 GB**):

```bash
ollama pull gemma4:e2b
```

### 4. Start the app

From inside this project folder:

```bash
npm start
```

You should see:

```
Gemma notes: http://localhost:5200
Choose Google API or Local in the app.
```

### 5. Use it

1. Open <http://localhost:5200> in your browser.
2. At the top, select the **Local** radio button.
3. Paste your notes into **Your notes**.
4. Type a question in **Your question** and click **Ask Gemma**.

That's it — no API key or internet connection is needed for Local mode. You can even turn off Wi-Fi.

> Keep the app and Ollama running while you use it. The first question may take a little longer while the model loads into memory.

---

## Optional: Google API mode

Use Google's larger hosted Gemma 4 26B A4B model instead of the local one.

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a file named `.env` in this folder with:

   ```
   GEMINI_API_KEY=your_key_here
   ```

3. Restart the app (`npm start`).
4. On the page, select the **Google API** radio button.

This mode requires an internet connection and a valid key. If the key is missing or invalid, the app tells you so instead of hanging.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **"The answer took too long."** | Usually the model is still cold-loading, or Ollama isn't reachable. Wait and retry, or confirm `curl http://127.0.0.1:11434/api/version` responds. |
| **"Open Ollama and download gemma4:e2b…"** | Ollama isn't running or the model isn't pulled. Start Ollama, then run `ollama pull gemma4:e2b`. |
| **"Google API returned …"** | Your `GEMINI_API_KEY` is missing, invalid, or out of quota. Fix the key in `.env`, or switch to **Local**. |
| **"Add GEMINI_API_KEY to this app's .env file…"** | You picked **Google API** without a key. Add it, or switch to **Local**. |
| **"Gemma is answering another question…"** | Only one request is processed at a time; wait a moment and retry. |
| **"Add some notes first…"** | The notes box is empty or over 6,000 characters. |

---

## Project structure

```
.
├── public/
│   ├── index.html      # page markup
│   ├── app.js          # front-end: form handling + streaming
│   └── style.css       # styling
├── server.mjs          # request validation, Ollama + Google API calls
├── start.mjs           # loads .env, optionally starts bundled Ollama, serves the app
├── package.json        # metadata and the `npm start` script
└── README.md
```

The server listens on `127.0.0.1` only and rejects requests that don't come from `localhost`, so the demo isn't exposed to your network.

---

## License

[MIT](LICENSE) © Major League Hacking
