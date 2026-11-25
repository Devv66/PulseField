# Release audit — PulseField

Run this checklist just before publishing. Every item is deliberately testable.


## Latest automated evidence

- GitHub Actions run: https://github.com/Devv66/PulseField/actions/runs/45453530614
- Commit: `49a6ced664d9ad810be6f8b908155b9401f55ab1`
- Result: **success** — `npm ci` and `npm run check` completed successfully on Node.js 24.12.0.

## Code integrity

- [x] `npm ci` succeeds from a clean clone (verified by GitHub Actions).
- [x] `npm run check` passes (tests plus production build; verified by GitHub Actions).
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
- [...[truncated]