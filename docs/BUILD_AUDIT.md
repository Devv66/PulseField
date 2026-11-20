# Release audit — PulseField

Run this checklist just before publishing. Every item is deliberately testable.

## Code integrity

- [ ] `npm ci` succeeds from a clean clone.
- [ ] `npm run check` passes (tests plus production build).
- [ ] `git status` has no `.env.local`, credential, token, or generated video file staged.
- [ ] All UI demo flows label demo/local output honestly; no simulation is labelled Gemini.
- [ ] `src/firebase.js` uses Firebase AI Logic `InferenceMode.PREFER_ON_DEVICE` and renders the SDK-provided `response.inferenceSource`.
- [ ] `initializeDeviceModel()` is reachable only from a deliberate UI click.
- [ ] The local safety engine remains functional when Firebase is not configured and when offline.

## Firebase production checks

- [ ] AI Services → AI Logic guided setup is complete for the project.
- [ ] Firebase App Check is configured for the Web app and enforcement is enabled as required by the current Firebase guidance.
- [ ] Anonymous Authentication is enabled.
- [ ] `firebase deploy --only firestore:rules,firestore:indexes` succeeds.
- [ ] A second anonymous browser session cannot read the first session's incident document.
- [ ] Remote Config contains `cloud_model` and `ai_enabled`; test `ai_enabled=false` to ensure AI requests stop while local triage remains available.
- [ ] Site is deployed to Firebase Hosting over HTTPS.

## Hybrid evidence

- [ ] On a Nano-ready Chrome Desktop environment, prepare the model from the button and record an `ON-DEVICE · GEMINI NANO` result plus its timeline row.
- [ ] On a browser/device where Nano is unavailable but network is available, record a `CLOUD · FIREBASE AI LOGIC` result.
- [ ] If on-device hardware is unavailable for the video, never claim it ran; demo the live cloud fallback and state that fact plainly.
- [ ] Never claim that cloud fallback works offline; it does not.

## Video and Devpost

- [ ] 2560×1440 or higher capture; final is less than 3 minutes.
- [ ] Video is Public on YouTube and opens in an incognito browser.
- [ ] Video shows the working app, a real local first-response run, and an actual source-labelled Firebase hybrid result.
- [ ] Devpost project title, tagline, links, built-with tags, and narrative match `docs/DEVPOST_COPY.md`.
- [ ] Public source repo opens in an incognito browser, contains Apache-2.0 license, setup documentation, test instructions, and no credentials.
