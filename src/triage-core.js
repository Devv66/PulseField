/**
 * PulseField's deterministic safety layer.
 * It is intentionally independent from AI: a connection, an account, or an
 * AI model must never be a prerequisite for showing basic escalation guidance.
 */

export const TRIAGE_VERSION = '1.0.0';

const RED_FLAG_RULES = [
  {
    id: 'breathing',
    label: 'Breathing emergency',
    pattern: /\b(not breathing|no breathing|can'?t breathe|cannot breathe|gasping|blue lips|choking)\b/i,
    weight: 100,
    cue: 'Breathing concern reported',
  },
  {
    id: 'unresponsive',
    label: 'Unresponsive person',
    pattern: /\b(unconscious|unresponsive|passed out|not responding|collapsed)\b/i,
    weight: 100,
    cue: 'Responsiveness concern reported',
  },
  {
    id: 'bleeding',
    label: 'Severe bleeding',
    pattern: /\b(severe bleeding|heavy bleeding|won'?t stop bleeding|spurting blood|hemorrhag)/i,
    weight: 95,
    cue: 'Potential severe bleeding reported',
  },
  {
    id: 'chest',
    label: 'Possible cardiac emergency',
    pattern: /\b(chest pain|chest pressure|heart attack)\b/i,
    weight: 85,
    cue: 'Chest symptoms reported',
  },
  {
    id: 'stroke',
    label: 'Possible stroke signs',
    pattern: /\b(face droop|slurred speech|one.side weak|sudden weakness|stroke)\b/i,
    weight: 85,
    cue: 'Stroke signs reported',
  },
  {
    id: 'chemical',
    label: 'Hazmat / chemical exposure',
    pattern: /\b(chemical exposure|gas leak|fumes|poison|toxic)\b/i,
    weight: 80,
    cue: 'Potential hazardous exposure reported',
  },
  {
    id: 'fire',
    label: 'Immediate scene danger',
    pattern: /\b(fire|smoke|building collapse|electrical hazard|live wire|explosion)\b/i,
    weight: 80,
    cue: 'Immediate scene danger reported',
  },
];

const URGENT_RULES = [
  { id: 'burn', pattern: /\b(burn|scald)\b/i, cue: 'Burn reported' },
  { id: 'fracture', pattern: /\b(fracture|broken bone|deformity)\b/i, cue: 'Possible fracture reported' },
  { id: 'heat', pattern: /\b(heatstroke|heat exhaustion|overheating)\b/i, cue: 'Heat illness concern reported' },
  { id: 'hypothermia', pattern: /\b(hypothermia|very cold|frostbite)\b/i, cue: 'Cold exposure concern reported' },
  { id: 'seizure', pattern: /\b(seizure|convulsion)\b/i, cue: 'Seizure reported' },
  { id: 'allergy', pattern: /\b(anaphylaxis|allergic reaction|swollen throat)\b/i, cue: 'Severe allergy concern reported' },
];

const DEFAULT_ACTIONS = [
  'Check that the scene is safe before approaching.',
  'Call local emergency services if you believe someone may be in danger.',
  'Stay with the person when it is safe to do so and monitor changes.',
  'Follow directions from trained responders or emergency dispatch.',
];

const CRITICAL_ACTIONS = [
  'Call emergency services now — in Pakistan, Rescue 1122. If elsewhere, use your local emergency number.',
  'State the exact location, number of people affected, and the red flag observed.',
  'Do not enter an unsafe scene or move the person unless there is immediate danger.',
  'Follow dispatcher instructions; give trained first aid only when it is safe and within your training.',
];

const URGENT_ACTIONS = [
  'Arrange prompt in-person medical evaluation or contact local emergency services if symptoms worsen.',
  'Keep the person safe, still, and observed; do not give medication or food unless directed by a professional.',
  'Record the time, observed changes, and any care already given for handoff.',
];

export function normalizeNarrative(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export function extractVitals(text = '') {
  const normalized = normalizeNarrative(text);
  const findings = {};
  const pulse = normalized.match(/(?:pulse|heart\s*rate|hr)\s*(?:is|:|=)?\s*(\d{2,3})\b/i);
  const oxygen = normalized.match(/(?:spo2|o2|oxygen(?:\s*saturation)?)\s*(?:is|:|=)?\s*(\d{2,3})\s*%?/i);
  const respiratory = normalized.match(/(?:resp(?:iratory)?\s*rate|rr)\s*(?:is|:|=)?\s*(\d{1,2})\b/i);
  const systolic = normalized.match(/(?:bp|blood pressure)\s*(?:is|:|=)?\s*(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/i);
  const temperature = normalized.match(/(?:temp(?:erature)?)\s*(?:is|:|=)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:°?\s*([fc]))?/i);

  if (pulse) findings.pulse = Number(pulse[1]);
  if (oxygen) findings.oxygen = Number(oxygen[1]);
  if (respiratory) findings.respiratoryRate = Number(respiratory[1]);
  if (systolic) findings.bloodPressure = { systolic: Number(systolic[1]), diastolic: Number(systolic[2]) };
  if (temperature) findings.temperature = { value: Number(temperature[1]), unit: (temperature[2] || 'c').toUpperCase() };
  return findings;
}

function vitalCues(vitals) {
  const cues = [];
  if (vitals.oxygen !== undefined && vitals.oxygen < 90) cues.push('Low oxygen value entered');
  if (vitals.pulse !== undefined && (vitals.pulse > 130 || vitals.pulse < 45)) cues.push('Pulse value outside typical adult range');
  if (vitals.respiratoryRate !== undefined && (vitals.respiratoryRate > 30 || vitals.respiratoryRate < 8)) cues.push('Respiratory rate outside typical adult range');
  if (vitals.bloodPressure?.systolic !== undefined && vitals.bloodPressure.systolic < 90) cues.push('Low systolic blood pressure entered');
  return cues;
}

/** Returns escalation guidance, never a diagnosis. */
export function runLocalTriage(narrative = '', options = {}) {
  const text = normalizeNarrative(narrative);
  const flags = [];
  let score = 0;
  for (const rule of RED_FLAG_RULES) {
    if (rule.pattern.test(text)) {
      flags.push({ id: rule.id, label: rule.label, cue: rule.cue, level: 'critical' });
      score = Math.max(score, rule.weight);
    }
  }
  for (const rule of URGENT_RULES) {
    if (rule.pattern.test(text)) {
      flags.push({ id: rule.id, label: rule.id === 'burn' ? 'Burn or scald' : rule.cue, cue: rule.cue, level: 'urgent' });
      score = Math.max(score, 55);
    }
  }

  const vitals = extractVitals(text);
  const cues = vitalCues(vitals);
  if (cues.length) score = Math.max(score, 80);
  const level = score >= 80 ? 'CRITICAL' : score >= 50 ? 'URGENT' : 'WATCH';
  const actions = level === 'CRITICAL' ? CRITICAL_ACTIONS : level === 'URGENT' ? URGENT_ACTIONS : DEFAULT_ACTIONS;

  return {
    version: TRIAGE_VERSION,
    createdAt: options.now || new Date().toISOString(),
    level,
    score,
    flags,
    vitals,
    cues: [...flags.map((flag) => flag.cue), ...cues],
    actions,
    disclaimer: 'Decision support only — not a diagnosis or a replacement for emergency dispatch or trained clinicians.',
  };
}

/** Minimise obvious identifiers before a cloud-eligible request. */
export function redactForCloud(value = '') {
  let text = normalizeNarrative(value);
  text = text.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
  text = text.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[PHONE]');
  text = text.replace(/\b(my name is|patient(?: name)? is|i am)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/gi, '$1 [NAME]');
  text = text.replace(/\b(?:cnic|national id|passport)\s*(?:number|no\.?|#)?\s*[:=-]?\s*[A-Za-z0-9-]{5,}\b/gi, '[GOVERNMENT_ID]');
  return text;
}

export function createIncident(narrative, now = new Date().toISOString()) {
  const id = `pf-${now.replace(/[^0-9]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 7)}`;
  const triage = runLocalTriage(narrative, { now });
  return {
    id,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    narrative: normalizeNarrative(narrative),
    triage,
    timeline: [{ at: now, type: 'local-triage', message: `Deterministic offline triage completed: ${triage.level}.` }],
  };
}

export function addTimelineEvent(incident, type, message, at = new Date().toISOString()) {
  return { ...incident, updatedAt: at, timeline: [...incident.timeline, { at, type, message }] };
}

export function safeExport(incident) {
  return JSON.stringify({
    exportedBy: 'PulseField',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    incident,
    safetyNotice: 'This record is observational decision support, not a medical record or diagnosis.',
  }, null, 2);
}
