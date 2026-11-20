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

const REQUIRED_CONFIG = ['apiKey', 'authDomain', 'projectId', 'appId'];
const SYSTEM_INSTRUCTION = `You are PulseField's incident handoff assistant. You are not a clinician and you never diagnose, prescribe, or tell someone not to call emergency services. Convert the de-identified responder narrative into concise observational handoff notes. Return valid JSON only with keys summary, hazards, observations, questionsForResponder, and handoff. Use arrays of short strings for hazards, observations, and questionsForResponder. If a life threat may exist, say to contact emergency services immediately.`;
const HANDOFF_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    hazards: { type: 'array', items: { type: 'string' } },
    observations: { type: 'array', items: { type: 'string' } },
    questionsForResponder: { type: 'array', items: { type: 'string' } },
    handoff: { type: 'string' },
  },
  required: ['summary', 'hazards', 'observations', 'questionsForResponder', 'handoff'],
  additionalProperties: false,
};

function configFromEnv() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
}

export function hasFirebaseConfig(config = configFromEnv()) {
  return REQUIRED_CONFIG.every((key) => Boolean(config[key]));
}

function parseJsonReply(text) {
  const clean = String(text || '').replace(/^```json\s*|\s*```$/gim, '').trim();
  const value = JSON.parse(clean);
  if (!value || typeof value !== 'object') throw new Error('AI response was not an object.');
  return {
    summary: String(value.summary || '').slice(0, 900),
    hazards: Array.isArray(value.hazards) ? value.hazards.map(String).slice(0, 6) : [],
    observations: Array.isArray(value.observations) ? value.observations.map(String).slice(0, 8) : [],
    questionsForResponder: Array.isArray(value.questionsForResponder) ? value.questionsForResponder.map(String).slice(0, 5) : [],
    handoff: String(value.handoff || '').slice(0, 1200),
  };
}

export class PulseFieldFirebase {
  constructor() {
    this.ready = false;
    this.firebaseMode = 'demo';
    this.remotePolicy = { cloudModel: import.meta.env.VITE_CLOUD_MODEL || 'gemini-3.5-flash-lite', aiEnabled: true };
    this.uid = null;
    this.sdk = null;
  }

  async init() {
    const config = configFromEnv();
    if (!hasFirebaseConfig(config)) return this.status();

    this.sdk = await loadFirebaseProducts();
    const { initializeApp } = this.sdk.app;
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = this.sdk.appCheck;
    const { getAuth, signInAnonymously } = this.sdk.auth;
    const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } = this.sdk.firestore;
    const { getRemoteConfig, fetchAndActivate, getValue } = this.sdk.remoteConfig;
    const { getAI, GoogleAIBackend } = this.sdk.ai;

    this.app = initializeApp(config);
    const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    if (appCheckSiteKey) {
      initializeAppCheck(this.app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
    }

    this.auth = getAuth(this.app);
    const authResult = await signInAnonymously(this.auth);
    this.uid = authResult.user.uid;
    this.db = initializeFirestore(this.app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
    this.remoteConfig = getRemoteConfig(this.app);
    this.remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
    this.remoteConfig.defaultConfig = { cloud_model: this.remotePolicy.cloudModel, ai_enabled: 'true' };
    try {
      await fetchAndActivate(this.remoteConfig);
      this.remotePolicy = {
        cloudModel: getValue(this.remoteConfig, 'cloud_model').asString() || this.remotePolicy.cloudModel,
        aiEnabled: getValue(this.remoteConfig, 'ai_enabled').asString() !== 'false',
      };
    } catch (error) {
      console.warn('Remote Config unavailable; using safe defaults.', error);
    }
    this.ai = getAI(this.app, { backend: new GoogleAIBackend() });
    this.ready = true;
    this.firebaseMode = 'connected';
    return this.status();
  }

  status() {
    return { connected: this.ready, mode: this.firebaseMode, uid: this.uid, policy: this.remotePolicy };
  }

  createHybridModel() {
    if (!this.ready || !this.remotePolicy.aiEnabled) throw new Error('Firebase AI Logic is not configured or has been disabled by Remote Config.');
    const { getGenerativeModel, InferenceMode } = this.sdk.ai;
    return getGenerativeModel(this.ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: {
        model: this.remotePolicy.cloudModel,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: HANDOFF_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 700,
        },
      },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: 'text', languages: ['en'] }],
          initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SYSTEM_INSTRUCTION }] }],
        },
        promptOptions: { responseConstraint: HANDOFF_SCHEMA },
      },
    });
  }

  /** Must only be called from a deliberate user gesture. */
  async prepareOnDevice(onProgress = () => {}) {
    const model = this.createHybridModel();
    await model.initializeDeviceModel((progress) => onProgress(Math.round(Number(progress) * 100)));
    return { prepared: true };
  }

  async generateHandoff(narrative) {
    const model = this.createHybridModel();
    const deidentified = redactForCloud(narrative);
    const prompt = `${SYSTEM_INSTRUCTION}\n\nDe-identified field narrative:\n${deidentified}\n\nReturn the JSON object now.`;
    const started = performance.now();
    const result = await model.generateContent(prompt);
    const response = result.response;
    return {
      ...parseJsonReply(response.text()),
      source: response.inferenceSource === 'on_device' ? 'on_device' : 'in_cloud',
      latencyMs: Math.round(performance.now() - started),
      cloudInputWasRedacted: deidentified !== narrative,
    };
  }

  async saveIncident(incident) {
    if (!this.ready) return { stored: 'local-demo' };
    const { addDoc, collection, serverTimestamp } = this.sdk.firestore;
    const doc = await addDoc(collection(this.db, 'users', this.uid, 'incidents'), {
      ...incident,
      ownerUid: this.uid,
      savedAt: serverTimestamp(),
    });
    return { stored: 'firestore', id: doc.id };
  }
}
