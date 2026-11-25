import { redactForCloud } from './triage-core.js';

// Firebase product modules are loaded only for a configured deployment. This
// keeps the app's no-network local safety path small, quick, and independent.
async function loadFirebaseProducts() {
  const [app, appCheck, auth, ai, firestore, remoteConfig] = await Promise.all([
    import('firebase/app'),
    import('firebase/app-check'),
    import('firebase/auth'),
    import('firebase/ai'),
    import('firebase/firestore'),
    import('firebase/remote-config'),
  ]);
  return { app, appCheck, auth, ai, firestore, remoteConfig };
}

const REQUIRED_CONFIG = ['apiKey', 'authDomain', 'projectId', 'appId', 'appCheckSiteKey'];
const SYSTEM_INSTRUCTION = `You are PulseField's incident handoff assistant. You are not a clinician and you never diagnose, prescribe, or tell someone not to call emergency services. Convert the de-identified responder narrative into concise observational handoff notes. Return valid JSON only with keys summary, hazards, observations, questionsForResponder, and handoff. Use arrays of short strings for hazards, observations, and questionsForResponder. If a life threat may exist, say to contact emergency services immediately.`;
export const HANDOFF_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    hazards: { type: 'array', items: { type: 'string' } },
    observations: { type: 'array', items: { type: 'string' } },
    questionsForResponder: { type: 'array', items: { type: 'string' } },
    handoff: { type: 'string' },
  },
  required: ['summary', 'hazards', 'observations', 'questionsForResponder', 'handoff'],
};

export function assertAppCheckAttestation(attestation) {
  if (!attestation || typeof attestation.token !== 'string' || !attestation.token.trim()) {
    throw new Error('Firebase App Check did not return an attestation token.');
  }
  return attestation;
}

function configFromEnv() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomai...[truncated]