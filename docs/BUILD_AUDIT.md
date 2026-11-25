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
- [ ] If on-device hardware is unavailable for the video, never claim it ran; demo the live cloud fallback and state that fact plainly.
- [ ] Never claim that cloud fallback works offline; it does not.

## Video and Devpost

- [ ] 2560×1440 or higher capture; final is less than 3 minutes.
- [ ] Video is Public on YouTube and opens in an incognito browser.
- [ ] Video shows the working app, a real local first-response run, and an actual source-labelled Firebase hybrid result.
- [ ] Devpost project title, tagline, links, built-with tags, and narrative match `docs/DEVPOST_COPY.md`.
- [ ] Public source repo opens in an incognito browser, contains Apache-2.0 license, setup documentation, test instructions, and no credentials.

## 2026-11-25 follow-up verification

- [x] Local triage remains usable with the browser forced offline (Chromium smoke test).
- [x] Current service-worker update strategy is covered by automated regression tests: cache version migration, old-cache deletion, network-first navigation, offline HTML fallback, pre-caching of hashed JS/CSS bundles from the deployed index, missing-asset handling, and bypassing cross-origin/non-GET requests.
- [x] npm run check passes after the service-worker changes: 23 tests passed; production build succeeded.
- [ ] Production Firebase initialization is not yet verified. The live Vercel browser currently falls back to local demo mode. A production-configured build reproduced a Firebase Authentication API_KEY_INVALID response during anonymous sign-in. Do not label Auth, Firestore persistence, or AI Logic as live until the Firebase Web API key/project association, key restrictions, Identity Toolkit API, and Anonymous provider are verified in Firebase/Google Cloud Console.
- [ ] Real Gemini Nano and cloud inference, App Check enforcement, and cross-user Firestore isolation remain unverified; no live model response or cloud Firestore write is claimed by this audit.

## 2026-11-25 Firebase integration follow-up

- [x] Deduplicated `@firebase/app`, `@firebase/component`, and `@firebase/util` in Vite so App Check registers against the same Firebase component registry as the app and other products.
- [x] Removed the unsupported `additionalProperties` field from the Firebase AI Logic response schema; the live Gemini endpoint previously rejected it with HTTP 400.
- [x] Added a fail-closed App Check token check. The app does not show `Firebase Connected` until the browser obtains a real App Check token.
- [x] Clean `npm ci` completed with 0 reported vulnerabilities; `npm run check` passed 26 tests and the production build.
- [x] Actual browser test identified the remaining Google-side blocker: the configured reCAPTCHA Enterprise site key fails `grecaptcha.enterprise.execute()` with `Invalid site key or not loaded in api.js`. A subsequent Gemini request was rejected with HTTP 401 `Firebase App Check token is invalid`.
- [ ] Replace the invalid/mismatched key with a Web-type, score-based reCAPTCHA Enterprise key created in the Google Cloud project linked to `pulsefield-6087e`; enable the reCAPTCHA Enterprise API, allowlist `pulsefield-omega.vercel.app`, then register that key for the matching Web app in Firebase Console → Security → App Check and update Vercel `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
- [ ] Re-run browser attestation, anonymous Auth, Firestore write/read-isolation, and Gemini cloud inference after the corrected key is deployed. Until then, the app deliberately remains in local-only mode.
