# PulseField 2:40 demo script

**Goal:** Demonstrate the actual core technology live, end to end. Record in 2560×1440 or higher, export 1440p/2K, keep the final public YouTube video below **3:00**.

> Do not fake an inference source. Record the `ON-DEVICE` branch only from a Chrome Desktop device where Gemini Nano is actually available. If Nano is unavailable, record the live Firebase Cloud fallback and say so. The app's transparent route badge is part of the proof.

## Preflight (not in final video)

1. Deploy with genuine Firebase configuration and verify App Check, Anonymous Auth, Firestore, and Remote Config are active.
2. Run `npm run check` and confirm it passes.
3. Open the deployed Firebase Hosting URL in Chrome Desktop.
4. For Nano proof: follow the current Firebase AI Logic / Chrome hybrid setup. Click **Prepare on-device model**, wait for it to complete, and run one short report. Verify the app displays `ON-DEVICE · GEMINI NANO` and logs it in the timeline.
5. For cloud fallback proof: use a browser/device without Nano but online, or a suitably configured environment where the SDK chooses cloud. Verify `CLOUD · FIREBASE AI LOGIC`.
6. Pre-stage one neutral demo narrative. Do not use real personal or patient data.

## Final timeline

### 0:00–0:12 — Problem and promise

**Screen:** PulseField title / dashboard. Keep the Ready State card and "Local safety engine armed" visible.

**Voiceover:**

> In an emergency, the first useful tool cannot wait for a login, a network, or a cloud model. PulseField is an offline-first field triage tool built with Firebase AI Logic hybrid inference.

### 0:12–0:35 — Prove the no-network safety layer

**Screen:** Open browser DevTools Network tab and select Offline. Enter the provided **Storm collapse** demo narrative, then click **Run local safety check**.

**Voiceover:**

> I am offline. I enter observable field facts, including a scene hazard, severe bleeding, and a pulse value. The local safety engine immediately produces a critical escalation, actions, and an incident timeline. This layer uses no AI request and still works with no connection.

**Required visual proof:** The `CRITICAL` result, `Local safety engine`, and the offline Network panel must be visibly on screen.

### 0:35–0:48 — Show transparent demo discipline

**Screen:** Click **Generate handoff** while in intentional demo/no-Firebase configuration only if you need to demonstrate this state; otherwise skip straight to 0:48.

**Voiceover:**

> In demo mode, PulseField deliberately labels its local handoff as a demonstration template. It never falsely claims that this is Gemini output.

### 0:48–1:07 — Bring Firebase services online

**Screen:** Switch DevTools back to Online. Reload the deployed configured app. Show the green connection label: `Firebase connected · anonymous session`.

**Voiceover:**

> With Firebase connected, App Check protects requests, anonymous authentication creates a private session, Firestore is ready with persistent local cache, and Remote Config controls the cloud model and an AI kill switch.

### 1:07–1:40 — Prove hybrid inference live

**Screen:** Use a short non-identifying field narrative. Click **Prepare on-device model** if it is not already ready, then click **Generate handoff**. Keep the visible result badge and timeline in frame.

**Voiceover — choose exactly one truthful path:**

**Path A — Gemini Nano result:**
> On this Chrome Desktop device, Firebase AI Logic prefers the on-device Gemini Nano path. The response badge and timeline report the SDK's actual on-device source. The report stays local for this inference.

**Path B — cloud fallback result:**
> This device does not expose a ready on-device model, so Firebase AI Logic automatically falls back to the configured Gemini cloud model. PulseField clearly reports Cloud rather than pretending that Nano ran.

**Required visual proof:** Result badge must say either `ON-DEVICE · GEMINI NANO` or `CLOUD · FIREBASE AI LOGIC`; do not edit over this.

### 1:40–2:02 — Explain the privacy boundary and source visibility

**Screen:** Highlight source badge, incident timeline, and the safety note. Optionally type a fake phone number in a test narrative and show the app's disclosure that identifiers are minimized before cloud eligibility—do not show actual sensitive data.

**Voiceover:**

> The generative feature is a concise responder handoff, not a diagnosis. Before a cloud-eligible prompt, PulseField performs best-effort local minimization for obvious identifiers. Every generated result exposes its true inference source.

### 2:02–2:24 — Save / offline-resilient data path

**Screen:** Click **Save incident snapshot**, show success confirmation, then optionally show Firestore console collection with a synthetic record only.

**Voiceover:**

> A responder can save the incident. Firestore stores it under the anonymous user's owner-only namespace, while the persistent local cache supports a resilient sync path. The local safety output is always available even if that save cannot reach the network yet.

### 2:24–2:40 — Close

**Screen:** Return to a clean full app view. Show `Local safety engine armed` and an actual source-tagged handoff if available.

**Voiceover:**

> PulseField makes hybrid AI useful where it matters most: a local response first, an intelligent handoff when available, and complete transparency about where the answer came from.

## Editing rules

- Final duration target: **2:40** (hard maximum: **2:59**).
- Publish as **Public** on YouTube before Devpost submission.
- Keep audio clear and captions on. Use only royalty-free audio or no music.
- Do not show API keys, reCAPTCHA keys, Firebase config, tokens, real personal data, or a real emergency.
- Avoid implying the tool provides medical diagnosis or replaces emergency professionals.
