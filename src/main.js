import './styles.css';
import { addTimelineEvent, createIncident, redactForCloud, runLocalTriage, safeExport } from './triage-core.js';

const DEMO_NARRATIVE = 'Warehouse roof partly collapsed after a storm. One adult is conscious with severe bleeding from the lower leg. Pulse 132. Two people are outside and safe. Power lines may be down near the north entrance.';
const app = document.querySelector('#app');
// Firebase is loaded only for a configured deployment. The offline safety path
// remains fast, usable, and free of third-party SDK loading in demo/offline mode.
let firebase = null;

let currentIncident = null;
let firebaseStatus = { connected: false, mode: 'initializing', policy: { cloudModel: 'gemini-3.5-flash-lite' } };
let uiMessage = { tone: 'neutral', text: 'Loading local safety tools…' };
let busy = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function sourceBadge(source) {
  if (source === 'on_device') return '<span class="source-badge device"><span>●</span> ON-DEVICE · GEMINI NANO</span>';
  if (source === 'in_cloud') return '<span class="source-badge cloud"><span>●</span> CLOUD · FIREBASE AI LOGIC</span>';
  return '<span class="source-badge local"><span>●</span> LOCAL SAFETY ENGINE</span>';
}

function levelClass(level = 'WATCH') { return String(level).toLowerCase(); }

function renderTriage(incident) {
  const triage = incident.triage;
  const findings = triage.cues.length ? triage.cues : ['No specific high-risk cue detected from the entered narrative. Continue to observe and use local protocols.'];
  const vitals = Object.entries(triage.vitals).map(([key, value]) => {
    const display = typeof value === 'object' ? `${value.systolic}/${value.diastolic}` : value;
    return `<div class="metric"><span>${escapeHtml(key.replace(/([A-Z])/g, ' $1'))}</span><strong>${escapeHtml(display)}</strong></div>`;
  }).join('');
  return `
    <section class="triage-output" aria-live="polite">
      <div class="result-topline">
        <div><p class="eyebrow">OFFLINE SAFETY ASSESSMENT</p><h2>Field escalation</h2></div>
        <div class="severity ${levelClass(triage.level)}"><span>LEVEL</span><strong>${triage.level}</strong></div>
      </div>
      <div class="result-grid">
        <article class="finding-card"><p class="label">Signals detected</p><ul>${findings.map((cue) => `<li>${escapeHtml(cue)}</li>`).join('')}</ul></article>
        <article class="actions-card"><p class="label">Do now</p><ol>${triage.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol></article>
        ${vitals ? `<article class="vitals-card"><p class="label">Observed values</p><div class="metrics">${vitals}</div></article>` : ''}
      </div>
      <p class="safety-note">${escapeHtml(triage.disclaimer)}</p>
    </section>`;
}

function renderAIAugment(incident) {
  const augmentation = incident?.ai;
  if (!augmentation) return `
    <section class="ai-augment empty"><div class="section-heading"><div><p class="eyebrow">HYBRID INFERENCE</p><h2>Build a handoff note</h2></div>${sourceBadge('local')}</div>
    <p>Local safety triage is complete. Generate a concise, de-identified responder handoff with Firebase AI Logic after you configure Firebase.</p>
    <div class="ai-actions"><button class="button secondary" data-action="prepare-device" ${firebaseStatus.connected ? '' : 'disabled'}>Prepare on-device model</button><button class="button primary" data-action="generate-handoff" ${busy ? 'disabled' : ''}>${busy ? 'Generating…' : 'Generate handoff'}</button></div>
    <p class="microcopy">${firebaseStatus.connected ? 'Gemini Nano is preferred on Chrome Desktop; the Firebase SDK transparently falls back to Gemini Cloud when unavailable.' : 'Demo mode is intentionally not presented as AI. Add Firebase environment values to activate the real hybrid model.'}</p>
    </section>`;
  return `
    <section class="ai-augment"><div class="section-heading"><div><p class="eyebrow">HYBRID INFERENCE</p><h2>Responder handoff</h2></div>${sourceBadge(augmentation.source)}</div>
    <div class="handoff-grid"><div><p class="label">Summary</p><p>${escapeHtml(augmentation.summary)}</p></div><div><p class="label">Handoff</p><p>${escapeHtml(augmentation.handoff)}</p></div></div>
    <div class="ai-lists"><div><p class="label">Hazards</p><ul>${augmentation.hazards.map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None specified</li>'}</ul></div><div><p class="label">Confirm next</p><ul>${augmentation.questionsForResponder.map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>Follow local protocol and emergency dispatch guidance.</li>'}</ul></div></div>
    <div class="ai-meta"><span>${augmentation.source === 'demo_template' ? 'DEMONSTRATION LOCAL TEMPLATE — not AI output' : `Returned in ${augmentation.latencyMs}ms`}</span><span>${augmentation.cloudInputWasRedacted ? 'Identifiers were redacted before cloud eligibility.' : 'No obvious identifiers were detected by the local redactor.'}</span></div>
    </section>`;
}

function renderTimeline(incident) {
  if (!incident) return '';
  return `<section class="timeline"><div class="section-heading"><div><p class="eyebrow">INCIDENT LOG</p><h2>Immutable-feeling timeline</h2></div><button class="text-button" data-action="export">Export JSON</button></div><div class="timeline-list">${incident.timeline.slice().reverse().map((entry) => `<div class="timeline-row"><span class="timeline-dot"></span><div><strong>${escapeHtml(entry.type.replace(/-/g, ' '))}</strong><p>${escapeHtml(entry.message)}</p></div><time>${new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('')}</div></section>`;
}

function appMarkup() {
  const hasIncident = Boolean(currentIncident);
  const connectionText = firebaseStatus.connected ? `Firebase connected · anonymous session` : firebaseStatus.mode === 'unavailable' ? 'Firebase unavailable · Local safety active' : 'Offline demo · Firebase not configured';
  const policyText = firebaseStatus.connected ? `Cloud fallback: ${firebaseStatus.policy.cloudModel}` : firebaseStatus.mode === 'unavailable' ? 'Firebase initialization failed · Local deterministic triage active' : 'Local deterministic triage active';
  return `
    <div class="shell">
      <header class="topbar"><a class="brand" href="#top" aria-label="PulseField home"><img src="/pulsefield-mark.svg" alt=""/><span>Pulse<span>Field</span></span></a><div class="connection"><span class="status-light ${firebaseStatus.connected ? 'online' : 'local'}"></span><div><strong>${escapeHtml(connectionText)}</strong><small>${escapeHtml(policyText)}</small></div></div></header>
      <main id="top">
        <section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="live-dot"></span> RESILIENT DECISION SUPPORT</p><h1>Act in the <em>first minutes.</em><br/>Keep working in the last mile.</h1><p class="lede">PulseField turns a field narrative into a transparent safety escalation and responder handoff — locally first, with Firebase AI Logic hybrid inference when it is safe to use.</p><div class="hero-chips"><span>Offline-first</span><span>Privacy-aware</span><span>Human stays in control</span></div></div><aside class="mission-card"><p class="eyebrow">READY STATE</p><div class="pulse-orb"><i></i><i></i><i></i></div><strong>Local safety engine armed</strong><p>Never waits for a model, a login, or a network before showing escalation guidance.</p><a href="#triage">Start incident <span>↓</span></a></aside></section>
        <section class="notice ${uiMessage.tone}" role="status">${escapeHtml(uiMessage.text)}</section>
        <section class="triage-workspace" id="triage"><div class="composer"><div class="composer-head"><div><p class="eyebrow">01 · CAPTURE</p><h2>What is happening?</h2></div><span class="secure-note">◈ Remains in this browser until you choose to save</span></div><label for="narrative">Observable facts, hazards, symptoms, people affected, and any values you know.</label><textarea id="narrative" maxlength="4000" placeholder="Example: Two people are outside after a vehicle crash. One is awake with chest pain and trouble breathing. Fuel is leaking.">${escapeHtml(currentIncident?.narrative || '')}</textarea><div class="quick-row"><span>Try a safe demo:</span><button class="chip" data-action="load-demo">Storm collapse</button><button class="chip" data-action="clear">Clear</button></div><div class="composer-foot"><p>Do not delay calling emergency services for this tool.</p><button class="button emergency" data-action="run-triage">Run local safety check <span>→</span></button></div></div>
          <aside class="side-rail"><p class="eyebrow">PROTOCOL</p><div class="protocol-item"><span>01</span><div><strong>Scene safety first</strong><p>Do not become another casualty.</p></div></div><div class="protocol-item"><span>02</span><div><strong>Escalate early</strong><p>Call local emergency services when in doubt.</p></div></div><div class="protocol-item"><span>03</span><div><strong>Hand off clearly</strong><p>Record facts, time, hazards, and changes.</p></div></div><a class="emergency-link" href="tel:1122">Pakistan emergency line <b>1122 ↗</b></a></aside>
        </section>
        ${hasIncident ? `<div class="results-stack">${renderTriage(currentIncident)}${renderAIAugment(currentIncident)}${renderTimeline(currentIncident)}<div class="record-actions"><button class="button secondary" data-action="save">Save incident snapshot</button><button class="button secondary" data-action="new">New incident</button></div></div>` : `<section class="empty-state"><div class="empty-icon">+</div><h2>One field report. Two reliable layers.</h2><p>A deterministic local engine handles immediate red flags. Firebase AI Logic then prefers Gemini Nano on a capable Chrome desktop and automatically uses cloud Gemini when on-device inference is unavailable.</p><div><span>LOCAL RULES</span><i></i><span>HYBRID AI</span><i></i><span>FIRESTORE HANDOFF</span></div></section>`}
        <section class="principles"><article><span>01</span><h3>Never block a first response</h3><p>The initial escalation is deterministic code that works without JavaScript AI support, an account, or connectivity.</p></article><article><span>02</span><h3>Show where the answer ran</h3><p>Every AI-generated handoff carries a visible inference source. No silent cloud route, no made-up badge.</p></article><article><span>03</span><h3>Store the minimum</h3><p>Anonymous Auth isolates records. Firestore persists incident snapshots offline-first under strict owner-only rules.</p></article></section>
      </main>
      <footer><span>PulseField · Built for #BuildHybridAI 2026</span><span>Decision support only. In an emergency, call local emergency services.</span></footer>
    </div>`;
}

function render() {
  app.innerHTML = appMarkup();
}

function demoHandoff(triage) {
  return {
    source: 'demo_template', latencyMs: 0, cloudInputWasRedacted: false,
    summary: `Local demonstration handoff: ${triage.level} field escalation. ${triage.cues.join('; ') || 'No high-risk cue entered.'}`,
    hazards: triage.flags.filter((flag) => ['fire', 'chemical'].includes(flag.id)).map((flag) => flag.cue).concat(['Confirm scene safety before approach.']),
    observations: triage.cues,
    questionsForResponder: ['What is the exact location and safest access point?', 'How many people are affected?', 'Has emergency dispatch been contacted?'],
    handoff: 'This local template is displayed only for the unconfigured demo. It is not Gemini output. Configure Firebase to use real, source-labelled hybrid inference.',
  };
}

function getNarrative() { return document.querySelector('#narrative')?.value || ''; }

async function runTriage() {
  const narrative = getNarrative().trim();
  if (!narrative) { uiMessage = { tone: 'warning', text: 'Add a short field narrative first. If there is immediate danger, call emergency services now.' }; render(); return; }
  currentIncident = createIncident(narrative);
  uiMessage = { tone: currentIncident.triage.level === 'CRITICAL' ? 'danger' : 'success', text: `Local ${currentIncident.triage.level} escalation calculated without an AI or network request.` };
  render();
}

async function generateHandoff() {
  if (!currentIncident) return;
  busy = true; uiMessage = { tone: 'neutral', text: 'Preparing a source-labelled responder handoff…' }; render();
  try {
    let ai;
    if (firebaseStatus.connected) ai = await firebase.generateHandoff(currentIncident.narrative);
    else ai = demoHandoff(currentIncident.triage);
    currentIncident = addTimelineEvent({ ...currentIncident, ai }, ai.source === 'demo_template' ? 'local-demo-template' : `hybrid-${ai.source}`, ai.source === 'demo_template' ? 'Shown clearly-labelled local demo template; no model request was sent.' : `Firebase AI Logic returned a ${ai.source === 'on_device' ? 'Gemini Nano on-device' : 'Gemini Cloud'} handoff.`);
    uiMessage = { tone: ai.source === 'demo_template' ? 'warning' : 'success', text: ai.source === 'demo_template' ? 'Demo handoff added. It is not an AI claim — add Firebase settings to activate hybrid inference.' : `Hybrid handoff complete via ${ai.source === 'on_device' ? 'Gemini Nano on-device' : 'Firebase Cloud'}.` };
  } catch (error) {
    currentIncident = addTimelineEvent(currentIncident, 'ai-error', `Hybrid generation did not complete: ${error.message}`);
    uiMessage = { tone: 'danger', text: `Hybrid inference was not available: ${error.message}. Local triage remains available.` };
  } finally { busy = false; render(); }
}

async function prepareDevice() {
  try {
    if (!firebaseStatus.connected || !firebase) throw new Error('Firebase is not configured for this deployment.');
    uiMessage = { tone: 'neutral', text: 'Starting Gemini Nano preparation. The first model download can take a few minutes.' }; render();
    await firebase.prepareOnDevice((progress) => { uiMessage = { tone: 'neutral', text: `Preparing on-device model: ${progress}%` }; render(); });
    uiMessage = { tone: 'success', text: 'On-device model is ready. This does not guarantee every task can run locally; the app will show the actual source.' };
  } catch (error) { uiMessage = { tone: 'warning', text: `On-device preparation unavailable: ${error.message}. Hybrid calls can still use their documented cloud fallback when online.` }; }
  render();
}

async function saveIncident() {
  if (!currentIncident) return;
  try {
    const result = firebaseStatus.connected && firebase
      ? await firebase.saveIncident(currentIncident)
      : { stored: 'local-demo' };
    if (!firebaseStatus.connected) localStorage.setItem(`pulsefield:${currentIncident.id}`, JSON.stringify(currentIncident));
    currentIncident = addTimelineEvent(currentIncident, 'save', result.stored === 'firestore' ? 'Saved privately to this anonymous user’s Firestore collection.' : 'Saved in this browser only; Firebase demo mode is active.');
    uiMessage = { tone: 'success', text: result.stored === 'firestore' ? 'Incident snapshot saved to owner-protected Firestore.' : 'Incident snapshot saved only in this browser.' };
  } catch (error) { uiMessage = { tone: 'danger', text: `Could not save incident: ${error.message}` }; }
  render();
}

function downloadExport() {
  if (!currentIncident) return;
  const blob = new Blob([safeExport(currentIncident)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${currentIncident.id}.json`; link.click();
  URL.revokeObjectURL(url);
  uiMessage = { tone: 'success', text: 'Portable incident JSON exported. Do not upload personal information to a public service.' }; render();
}

app.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'load-demo') { const textarea = document.querySelector('#narrative'); textarea.value = DEMO_NARRATIVE; textarea.focus(); }
  if (action === 'clear') { const textarea = document.querySelector('#narrative'); textarea.value = ''; textarea.focus(); }
  if (action === 'run-triage') await runTriage();
  if (action === 'generate-handoff') await generateHandoff();
  if (action === 'prepare-device') await prepareDevice();
  if (action === 'save') await saveIncident();
  if (action === 'export') downloadExport();
  if (action === 'new') { currentIncident = null; uiMessage = { tone: 'neutral', text: 'New incident ready. Local safety engine remains armed.' }; render(); }
});

(async function bootstrap() {
  render();
  const hasFirebaseEnvironment = [
    import.meta.env.VITE_FIREBASE_API_KEY,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    import.meta.env.VITE_FIREBASE_APP_ID,
    import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
  ].every(Boolean);
  if (!hasFirebaseEnvironment) {
    firebaseStatus = { connected: false, mode: 'demo', policy: { cloudModel: 'gemini-3.5-flash-lite' } };
    uiMessage = { tone: 'neutral', text: 'Local demo ready. Configure Firebase to enable App Check, Auth, Firestore, Remote Config, and real hybrid AI inference.' };
  } else {
    try {
      const { PulseFieldFirebase } = await import('./firebase.js');
      firebase = new PulseFieldFirebase();
      firebaseStatus = await firebase.init();
      uiMessage = { tone: 'success', text: 'Firebase services connected: App Check, anonymous Auth, offline Firestore, Remote Config, and AI Logic are ready.' };
    } catch (error) {
      firebaseStatus = { ...(firebase?.status?.() || {}), connected: false, mode: 'unavailable', policy: firebase?.status?.()?.policy || { cloudModel: 'gemini-3.5-flash-lite' } };
      uiMessage = { tone: 'warning', text: `Firebase initialization skipped: ${error.message}. Local safety tools remain active.` };
    }
  }
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed.', error));
})();

export { demoHandoff, redactForCloud };
