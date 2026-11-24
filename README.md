# PulseField

> **The field tool that still works before the network does.**

**PulseField** is an offline-first incident triage and emergency handoff web app built for **Google #BuildHybridAI 2026**. It always runs a transparent, deterministic local safety screen first; then, when Firebase is connected, it uses **Firebase AI Logic hybrid inference** to prefer **Gemini Nano on-device** in Chrome Desktop and seamlessly fall back to a Gemini cloud model when on-device inference is unavailable.

<p align="center">
  <img src="public/pulsefield-mark.svg" width="96" alt="PulseField logo" />
</p>

> [!IMPORTANT]
> PulseField is **decision support, not a medical device**. It does not diagnose, prescribe, or replace emergency dispatch or trained responders. If there is immediate danger, call local emergency services. In Pakistan, Rescue 1122 is available in many areas.

## Why this matters

In an incident, the first useful tool cannot depend on a sign-in screen, an API roundtrip, or whether a device has an AI model. PulseField has two distinct layers:

| Layer | What it does | Availability |
|---|---|---|
| **Local Safety Engine** | Detects reported red flags, extracts entered vital values, gives general escalation steps, writes a timestamped timeline | Always — no AI, login, or network required |
| **Firebase Hybrid Handoff** | Turns the field narrative into concise responder handoff notes | Gemini Nano on capable Chrome Desktop; otherwise Gemini Cloud through Firebase AI Logic |

The UI never pretends a demo template is AI output. A generated handoff visibly says **ON-DEVICE · GEMINI NANO**, **CLOUD · FIREBASE AI LOGIC**, or **DEMONSTRATION LOCAL TEMPLATE**.

## Firebase AI Logic: the core innovation

`src/firebase.js` creates a hybrid model using Firebase AI Logic:

```js
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: {
    model: 'gemini-3.5-flash-lite',
    systemInstruction: SYSTEM_INSTRUCTION,
  },
  onDeviceParams: {
    createOptions: {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: [/* PulseField safety instruction */],
    },
  },
});

// Called only from the user's "Prepare on-device model" interaction.
await model.initializeDeviceModel(onProgress);
const result = await model.generateContent(prompt);
```

- `PREFER_ON_DEVICE` makes Firebase AI Logic attempt the Chrome Prompt API / **Gemini Nano** first and use the configured cloud Gemini model only when necessary.
- `initializeDeviceModel()` is deliberately called from a human click, as required for the browser on-device model flow.
- `response.inferenceSource` is carried through to an explicit UI badge and timeline event. PulseField does not infer or fabricate the route.
- A deterministic local safety engine runs separately. It is a safety backstop, not an AI fallback dressed up as Gemini.

## Firebase products used

| Firebase product | PulseField implementation |
|---|---|
| **Firebase AI Logic** | Hybrid Gemini Nano / cloud Gemini responder handoff in `src/firebase.js` |
| **Firebase App Check** | Required reCAPTCHA Enterprise attestation for the live Firebase path; the app does not report Firebase as connected without the site key |
| **Firebase Authentication** | Anonymous sign-in creates a private user namespace without delaying a first response |
| **Cloud Firestore** | Incident snapshots stored at `users/{uid}/incidents/{incidentId}` with persistent local cache |
| **Remote Config** | A live `cloud_model` setting and `ai_enabled` operational kill switch |
| **Firebase Hosting** | Production SPA hosting configuration in `firebase.json` |

## Privacy and safety by design

1. **No AI gate for urgent guidance.** The local rules run before any model call.
2. **Minimal cloud eligibility.** Obvious emails, phone numbers, government-ID labels, and self-declared names are redacted locally before a cloud-eligible prompt. This is a best-effort minimization layer, not a guarantee of de-identification.
3. **Human confirmation.** AI turns narrative into handoff notes; it is not authorized to diagnose or direct clinical care.
4. **Source transparency.** On-device, cloud, and demo-template routes have different visible labels.
5. **Owner-only storage.** Firestore rules require Anonymous Auth and restrict each user to their own incident namespace.
6. **Remote shutdown.** Remote Config can set `ai_enabled=false`; local safety triage stays available.

## Architecture

```text
 ┌───────────────────────────────────────────────────────────────────┐
 │                       FIELD RESPONDER / BROWSER                   │
 │  capture facts ──► Local Safety Engine ──► escalation + timeline │
 │                         │                                         │
 │                         │ (after user chooses Generate handoff)   │
 │                         ▼                                         │
 │               local identifier minimization                       │
 └─────────────────────────┬─────────────────────────────────────────┘
                           │
          Firebase AI Logic hybrid model (PREFER_ON_DEVICE)
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
 Gemini Nano via Chrome Prompt API    Gemini cloud fallback
 on capable Chrome Desktop            when online / needed
          └────────────────┬────────────────┘
                           ▼
              visible source badge + timeline
                           │
     Anonymous Auth ──► Firestore persistent local cache / sync
     App Check    ───► request attestation
     Remote Config ──► model and AI kill-switch policy
```

## Run locally

### 1. Prerequisites

- Node.js 24.12+ (matches the current Firebase JS SDK engine requirement)
- npm 10+
- A Firebase project for the real AI and sync path
- Recent Chrome Desktop for Gemini Nano testing (availability varies by device/browser configuration)

### 2. Install and start

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. The live Firebase path requires all core Web App values plus `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`; the optional cloud model defaults to `gemini-3.5-flash-lite`.
```

Without `.env.local`, PulseField intentionally starts in **offline demo mode**. The complete local safety engine, UI, export, and browser-only save still work. It will not claim that its demo handoff came from Gemini.

### 3. Connect Firebase (required for a live hybrid demo)

1. In the [Firebase console](https://console.firebase.google.com/), create a project and register a **Web app**.
2. In **AI Services → AI Logic**, choose **Get started** and select the **Gemini Developer API** backend. Complete its guided App Check setup.
3. Enable **Authentication → Sign-in method → Anonymous**.
4. Create a **Cloud Firestore** database.
5. In **App Check**, register the web app with **reCAPTCHA Enterprise**. Copy the site key to `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
6. Copy the Firebase Web config values into `.env.local` (see `.env.example`). Never commit this file.
7. Deploy `firestore.rules` and publish the Remote Config template:

```bash
npm i -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
firebase remoteconfig:get > remoteconfig.backup.json
firebase remoteconfig:versions:list
# In Firebase Console > Remote Config, import remoteconfig.template.json,
# publish it, then deploy Hosting below.
```

### 4. Test actual on-device / cloud routing

1. Use **Chrome Desktop** that exposes the built-in Prompt API / Gemini Nano according to the current Firebase AI Logic hybrid setup instructions.
2. Click **Prepare on-device model** from PulseField. The deliberate interaction starts the model download/initialization. This can take several minutes on first use.
3. Submit a short field report. The result badge and timeline show the SDK's actual `inferenceSource`.
4. On a device without Nano, stay online and repeat: Firebase AI Logic should return a source-labelled **CLOUD** result.
5. For strict offline behavior, use only the Local Safety Engine; never imply a cloud fallback is available offline.

## Validate

```bash
npm test        # deterministic safety, parsing, privacy and export tests
npm run build   # production Vite build
npm run check   # both
```

## Deploy Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

Before a public launch, configure the Chrome Prompt API / Firebase AI Logic web rollout as required by Firebase's current hybrid inference documentation. On-device availability is a browser-and-device capability, not a promise for every visitor.

## Repository map

```text
src/
  main.js           Accessible single-page field UI and honest demo behavior
  triage-core.js    Pure deterministic local safety engine (unit-tested)
  firebase.js       App Check, Auth, Firestore cache, Remote Config, AI Logic
  styles.css        Responsive visual system
public/
  sw.js             Offline app-shell service worker
  manifest.webmanifest
firestore.rules     Owner-only Firestore security model
remoteconfig.template.json
firebase.json
tests/              Node native test suite
```

## Demo-ready flows

| Flow | What the reviewer sees |
|---|---|
| **No network / no Firebase config** | Immediate local escalation, timeline, browser-only save and honest local demo template |
| **Chrome Desktop with Nano ready** | `ON-DEVICE · GEMINI NANO` badge after a live Firebase AI Logic call |
| **No Nano but online** | `CLOUD · FIREBASE AI LOGIC` badge after automatic hybrid fallback |
| **Remote incident policy change** | Remote Config selects a cloud model or sets `ai_enabled=false` without redeploying |

## Open source

Released under [Apache-2.0](LICENSE).

---

Built with care for the **#BuildHybridAI 2026** hackathon.
