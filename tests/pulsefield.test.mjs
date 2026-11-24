import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTimelineEvent, createIncident, extractVitals, normalizeNarrative,
  redactForCloud, runLocalTriage, safeExport,
} from '../src/triage-core.js';
import { hasFirebaseConfig, normalizeInferenceSource } from '../src/firebase.js';


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

test('flags a breathing emergency as critical without an AI call', () => {
  const result = runLocalTriage('The patient is not breathing after a fall.', { now: '2026-11-16T00:00:00Z' });
  assert.equal(result.level, 'CRITICAL');
  assert.ok(result.flags.some((item) => item.id === 'breathing'));
  assert.match(result.actions[0], /emergency services/i);
});


test('does not mistake a collapsed structure for an unresponsive person', () => {
  const result = runLocalTriage('The warehouse roof partly collapsed after a storm. Two people are outside and safe.');
  assert.equal(result.level, 'WATCH');
  assert.equal(result.flags.some((item) => item.id === 'unresponsive'), false);
});

test('flags a person explicitly reported as collapsed', () => {
  const result = runLocalTriage('A worker has collapsed near the entrance.');
  assert.equal(result.level, 'CRITICAL');
  assert.ok(result.flags.some((item) => item.id === 'unresponsive'));
});

test('flags severe bleeding as critical', () => {
  const result = runLocalTriage('Heavy bleeding will not stop from a leg wound.');
  assert.equal(result.level, 'CRITICAL');
  assert.ok(result.flags.some((item) => item.id === 'bleeding'));
});

test('flags stroke language as critical escalation', () => {
  const result = runLocalTriage('Sudden weakness on one side and slurred speech.');
  assert.equal(result.level, 'CRITICAL');
  assert.ok(result.flags.some((item) => item.id === 'stroke'));
});

test('hazard language can independently raise a critical scene alert', () => {
  const result = runLocalTriage('There is a gas leak and fumes inside the room.');
  assert.equal(result.level, 'CRITICAL');
  assert.ok(result.flags.some((item) => item.id === 'chemical'));
});

test('fracture report becomes urgent rather than diagnosing', () => {
  const result = runLocalTriage('Possible broken bone and obvious deformity.');
  assert.equal(result.level, 'URGENT');
  assert.match(result.disclaimer, /not a diagnosis/i);
});

test('ordinary scene notes remain at watch level', () => {
  const result = runLocalTriage('Rain is falling. Three people are sheltering in a safe building.');
  assert.equal(result.level, 'WATCH');
  assert.equal(result.flags.length, 0);
});

test('extracts field vital values from free text', () => {
  assert.deepEqual(extractVitals('Pulse 132, SpO2 88%, RR: 32, BP 88 over 56, temp 38.2 C'), {
    pulse: 132,
    oxygen: 88,
    respiratoryRate: 32,
    bloodPressure: { systolic: 88, diastolic: 56 },
    temperature: { value: 38.2, unit: 'C' },
  });
});

test('critical entered vital values raise escalation', () => {
  const result = runLocalTriage('Person is alert. SpO2 87 percent and pulse 144.');
  assert.equal(result.level, 'CRITICAL');
  assert.ok(result.cues.some((cue) => /Low oxygen/.test(cue)));
});

test('redacts basic emails, phone numbers, names, and identity labels', () => {
  const input = 'My name is Ayesha Khan. Call +92 300 1234567 or email a@b.com. CNIC number 42101-1234567-1.';
  const result = redactForCloud(input);
  assert.match(result, /\[NAME\]/);
  assert.match(result, /\[PHONE\]/);
  assert.match(result, /\[EMAIL\]/);
  assert.match(result, /\[GOVERNMENT_ID\]/);
  assert.doesNotMatch(result, /a@b\.com/);
});

test('creates an incident with a deterministic local timeline entry', () => {
  const incident = createIncident('chest pain', '2026-11-16T12:00:00.000Z');
  assert.equal(incident.createdAt, '2026-11-16T12:00:00.000Z');
  assert.equal(incident.timeline.length, 1);
  assert.equal(incident.triage.level, 'CRITICAL');
});

test('adds an append-only timeline event without mutating prior incident', () => {
  const original = createIncident('burn', '2026-11-16T12:00:00.000Z');
  const updated = addTimelineEvent(original, 'save', 'Saved locally.', '2026-11-16T12:01:00.000Z');
  assert.equal(original.timeline.length, 1);
  assert.equal(updated.timeline.length, 2);
  assert.equal(updated.timeline[1].type, 'save');
});

test('exports a portable JSON envelope with a safety notice', () => {
  const incident = createIncident('safe observation', '2026-11-16T12:00:00.000Z');
  const exportObject = JSON.parse(safeExport(incident));
  assert.equal(exportObject.incident.id, incident.id);
  assert.match(exportObject.safetyNotice, /not a medical record/i);
});
