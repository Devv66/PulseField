# PulseField — Devpost submission copy

> Source repository is public. Add a demo video and hosted URL only after those destinations are genuinely published and verified. This copy deliberately does not claim a live on-device result until one is recorded from a compatible Chrome Desktop device.

## Project name

PulseField

## Tagline

Field triage that works before the network does — local safety guidance first, then Gemini Nano or Gemini Cloud through Firebase AI Logic hybrid inference.

## Built with

Firebase AI Logic · Gemini Nano · Gemini Developer API · Firebase App Check · Firebase Authentication · Cloud Firestore · Firebase Remote Config · Firebase Hosting · JavaScript · Vite · PWA

## Inspiration

During a storm, roadside crash, or building incident, the most important minutes are often the least connected. Yet most AI tools assume a reliable connection, a completed sign-in, and a cloud roundtrip before they can be useful. That creates the exact wrong dependency for a field responder.

PulseField asks a different question: **what must still work if every intelligent service is unavailable right now?** Its answer is a small, transparent local safety engine that immediately turns observable facts into escalation cues, general next actions, a timestamped incident log, and an exportable handoff record. Only after that baseline is established does AI help make the handoff clearer.

## What it does

PulseField is an offline-first incident triage and emergency handoff web app.

1. A responder records factual observations: hazards, symptoms, people affected, and entered vital values.
2. A deterministic local safety engine immediately detects reported high-risk cues such as breathing emergencies, severe bleeding, chest symptoms, stroke signs, hazards, and concerning entered values. It works with no account, network, or AI model.
3. When the responder chooses **Generate handoff**, Firebase AI Logic uses hybrid inference with `PREFER_ON_DEVICE`: it prefers Gemini Nano on a compatible Chrome Desktop device, and automatically falls back to a configured Gemini cloud model when the on-device path is not available.
4. The generated responder note visibly states where it actually ran: **ON-DEVICE · GEMINI NANO** or **CLOUD · FIREBASE AI LOGIC**. A demo template is separately labelled and never presented as AI output.
5. Anonymous Auth and owner-only Firestore rules let a field record save privately; Firestore persistent cache makes the save path offline-aware. Remote Config controls the cloud model and an AI kill switch without a redeploy.

PulseField is decision support — not a medical device, diagnosis engine, or replacement for emergency dispatch and trained care.

## How we built it

### A safety architecture that does not wait for AI

`src/triage-core.js` is pure, unit-tested JavaScript. It normalizes a report, parses entered vital values, identifies explicit high-risk language, chooses a transparent `CRITICAL`, `URGENT`, or `WATCH` escalation level, and writes a timeline event. It has no Firebase import and no network dependency.

### Firebase AI Logic hybrid inference

`src/firebase.js` creates a Firebase AI Logic model with `InferenceMode.PREFER_ON_DEVICE`. On Chrome Desktop with the Prompt API / Gemini Nano available, the SDK uses the on-device model. Otherwise the same call can transparently use the configured Gemini cloud model. `initializeDeviceModel()` is only called after a responder clicks **Prepare on-device model**, and `response.inferenceSource` drives the source badge and incident timeline.

### Firebase as the operational layer

- **App Check**: reCAPTCHA Enterprise protects Firebase requests.
- **Anonymous Authentication**: removes a sign-up barrier while isolating each browser's data.
- **Cloud Firestore**: persistent local cache plus strict owner-only rules at `users/{uid}/incidents/{incidentId}`.
- **Remote Config**: `cloud_model` config selects the fallback model; `ai_enabled` is a live operational kill switch.
- **Hosting / PWA**: Firebase Hosting config and a service worker support a resilient field experience.

### Privacy choices

The local safety engine does not transmit a report. For an AI request, PulseField runs a local best-effort minimizer for obvious email addresses, telephone numbers, government-ID labels, and self-declared names before the prompt can become cloud-eligible. It explicitly calls this minimization—not a guarantee of de-identification. The responder stays in control of saving records.

## Challenges we ran into

The difficult product problem was not simply making an LLM return a summary. It was making the UX truthful across three very different runtime conditions:

1. **No model and no connection:** a responder still needs useful output immediately.
2. **Gemini Nano available locally:** the app must show an actual on-device outcome instead of assuming it.
3. **On-device unavailable but network available:** the app must make cloud fallback visible and safe.

We separated deterministic safety guidance from generative handoff language, used the Firebase SDK's actual inference source for route badges, and refused to label the demo template as Gemini output. We also designed the model-initialization action around the browser's user-gesture requirement.

## Accomplishments that we're proud of

- An immediate local safety path that does not depend on AI, authentication, or a network.
- A real Firebase AI Logic hybrid implementation—not a simulated router—with a source-labelled result.
- Honest demo behavior: no Firebase configuration means a clearly marked local template, never a fake AI result.
- Owner-only Firestore rules, anonymous authentication, App Check configuration, Remote Config controls, and persistent client cache.
- An accessible, responsive PWA interface designed for cognitive clarity under stress.
- A native Node test suite covering local triage, vital parsing, privacy minimization, timeline immutability, and export behavior.

## What we learned

Hybrid AI is not just a reliability feature. It is a product-contract feature. A great hybrid experience tells people what stayed local, what went to the cloud, and what happens when neither is possible. The safest fallback is not another model; it is clear, deterministic behavior that has been intentionally designed for the edge case.

We also learned that source transparency, user-gesture model preparation, offline cache behavior, and production protections such as App Check are not implementation footnotes. They decide whether a field tool is trustworthy.

## What's next for PulseField

- Add multilingual local protocol packs reviewed by qualified regional responders.
- Add encrypted, consent-based team handoff workflows and expiring incident retention controls.
- Validate the wording and workflow with emergency-response organizations; keep all clinical protocol content under expert review.
- Extend source and policy telemetry with privacy-preserving operational metrics.
- Add media capture only after a dedicated privacy, consent, retention, and on-device capability review.

## Links

- **Source code:** https://github.com/Devv66/PulseField
- **Demo video:** Not published yet; add the public YouTube URL after recording and verifying the final demo.
- **Live demo:** Not deployed yet; add the Firebase Hosting URL after deployment and smoke testing.
