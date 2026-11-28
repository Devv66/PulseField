import { doc, setDoc, updateDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { before, after, beforeEach, test } from 'node:test';

const PROJECT_ID = 'demo-pulsefield-rules';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const incident = (uid, id = 'internal-incident-id') => ({
  id, status: 'open', createdAt: '2026-11-26T00:00:00.000Z',
  updatedAt: '2026-11-26T00:00:00.000Z', narrative: 'Observed situation',
  triage: { level: 'WATCH', score: 0 }, timeline: [],
  ownerUid: uid, savedAt: Timestamp.now(),
});

test('owner can create incident using generated document id', async () => {
  const db = env.authenticatedContext('owner-1').firestore();
  await assertSucceeds(setDoc(doc(db, 'users/owner-1/incidents/generated-id'), incident('owner-1')));
});
test('rejects cross-user create and ownerUid mismatch', async () => {
  const db = env.authenticatedContext('user-1').firestore();
  await assertFails(setDoc(doc(db, 'users/user-2/incidents/generated-id'), incident('user-1')));
  await assertFails(setDoc(doc(db, 'users/user-1/incidents/generated-id'), incident('other-user')));
});
test('rejects unknown fields and excessive narrative', async () => {
  const db = env.authenticatedContext('user-1').firestore();
  await assertFails(setDoc(doc(db, 'users/user-1/incidents/x'), { ...incident('user-1'), extra: true }));
  await assertFails(setDoc(doc(db, 'users/user-1/incidents/y'), { ...incident('user-1'), narrative: 'x'.repeat(4001) }));
});
test('owner can read; other users cannot read', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/user-1/incidents/x'), incident('user-1'));
  });
  await assertSucceeds(getDoc(doc(env.authenticatedContext('user-1').firestore(), 'users/user-1/incidents/x')));
  await assertFails(getDoc(doc(env.authenticatedContext('user-2').firestore(), 'users/user-1/incidents/x')));
});
test('updates cannot alter owner, id, or createdAt; valid update allowed', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/user-1/incidents/x'), incident('user-1'));
  });
  const ref = doc(env.authenticatedContext('user-1').firestore(), 'users/user-1/incidents/x');
  await assertSucceeds(updateDoc(ref, { narrative: 'Updated observed facts' }));
  await assertFails(updateDoc(ref, { ownerUid: 'user-2' }));
  await assertFails(updateDoc(ref, { id: 'changed-id' }));
  await assertFails(updateDoc(ref, { createdAt: 'changed' }));
});
test('owner can delete own incident but not another users incident', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/user-1/incidents/x'), incident('user-1'));
  });
  await assertSucceeds(deleteDoc(doc(env.authenticatedContext('user-1').firestore(), 'users/user-1/incidents/x')));
  await assertFails(deleteDoc(doc(env.authenticatedContext('user-2').firestore(), 'users/user-1/incidents/x')));
});
