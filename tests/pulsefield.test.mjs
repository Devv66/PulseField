import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTimelineEvent, createIncident, extractVitals, normalizeNarrative,
  redactForCloud, runLocalTriage, safeExport,
} from '../src/triage-core.js';
import { HANDOFF_SCHEMA, assertAppCheckAttestation, hasFirebaseConfig, normalizeInferenceSource } from '../src/firebase.js';
import viteConfig from '../vite.config.js';


test('Firebase live configuration requires the App Check site key', () => {
  const config = {
    apiKey: 'api-key',
    authDomain: 'example.firebaseapp.com',
    projectId: 'pulsefield-test',
    appId: 'app-id',
    appCheckSiteKey: 'recaptcha-enterprise-site-key',
  };
  assert.equal(hasFirebaseConfig(config), true);
  assert.equal(hasFirebaseConfig({ ...config, appCheckSiteKey: '' }), false);
});

test('rejects a missing or empty App Check attestation token', () => {
  assert.deepEqual(assertAppCheckAttestation({ token: 'opaque-app-check-token' }), { token: 'opaque-app-check-token' });
  assert.throws(() => assertAppCheckAttestation(null), /did not return an attestation token/i);
  assert.throws(() => assertAppCheckAttestation({ token: '' }), /did not return an attestation token/i);
});

test('normalizes the official Firebase AI Logic inference source enums', () => {
  assert.equal(normalizeInferenceSource('ON_DEVICE'), 'on_device');
  assert.equal(normalizeInferenceSource('IN_CLOUD'), 'in_cloud');
  assert.equal(normalizeInferenceSource('on_device'), 'on_device');
  assert.equal(normalizeInferenceSource('in_cloud'), 'in_cloud');
  assert.throws(() => normalizeInferenceSource(undefined), /unknown inference source/i);
  assert.throws(() => normalizeInferenceSource('UNKNOWN'), /unknown inference source/i);
});

test('normalizes whitespace and caps narratives safely', () => {
  assert.equal(normalizeNarrative('  one\n\n two  '), 'one two');
  assert.equal(normalizeNarrative('x'.repeat(5000)).length, 4000);
});

test('flags a breathing emergency as critical without an AI ...[truncated]