import health from '@service.health';
import sensor from '@system.sensor';
import vibrator from '@system.vibrator';
import store from './store.js';
import contextEngine from './context.js';

let monitoring = false;
let evaluating = false;
let state = null;
let stress = null;
let accelSamples = [];
let decision = '智能推荐未开启';
let ready = false;
const listeners = [];

function safeVibrate() {
  try {
    if (vibrator && typeof vibrator.vibrate === 'function') {
      vibrator.vibrate({ mode: 'short', complete() {} });
    }
  } catch (error) {
    console.log('FocusLoop context vibration unavailable:', error);
  }
}

function snapshot() {
  return {
    enabled: !!(state && state.settings.smartReviewEnabled),
    monitoring,
    stress,
    stressText: Number.isFinite(stress) ? `${Math.round(stress)}` : '--',
    motionText: accelSamples.length >= contextEngine.MIN_ACCEL_SAMPLES
      ? (contextEngine.isStationary(accelSamples) ? '静止' : '活动')
      : '等待数据',
    decision,
    ready,
    stressMax: state ? state.settings.stressMax : contextEngine.DEFAULT_STRESS_MAX,
    acceptanceRate: state ? Number(state.context.acceptanceRate || 0) : 0,
  };
}

function emit() {
  const value = snapshot();
  listeners.slice().forEach((listener) => {
    try { listener(value); } catch (error) {}
  });
}

async function evaluate() {
  if (evaluating || !state) return;
  evaluating = true;
  try {
    const result = contextEngine.evaluateReviewWindow({
      settings: state.settings,
      plan: state.plan,
      stress,
      accelSamples,
      lastRecommendationAt: state.context.lastRecommendationAt,
      now: Date.now(),
    });
    if (result.reason === 'cooldown') {
      const gates = contextEngine.evaluateReviewWindow({
        settings: state.settings,
        plan: state.plan,
        stress,
        accelSamples,
        lastRecommendationAt: 0,
        now: Date.now(),
      });
      if (state.context.lastReason === 'ready' && gates.ready) {
        ready = true;
        decision = '本轮推荐已经送达';
        emit();
        return;
      }
      ready = false;
      decision = contextEngine.reasonLabel(gates.ready ? 'cooldown' : gates.reason);
      emit();
      return;
    }
    ready = result.ready;
    decision = contextEngine.reasonLabel(result.reason);
    if (result.ready && state.context.lastReason !== 'ready') {
      state.context.lastReason = 'ready';
      state.context.lastRecommendationAt = Date.now();
      state.context.shown = Number(state.context.shown || 0) + 1;
      await store.save(state);
      safeVibrate();
    } else if (!result.ready && state.context.lastReason !== result.reason) {
      state.context.lastReason = result.reason;
      await store.save(state);
    }
    emit();
  } finally {
    evaluating = false;
  }
}

function applyStress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return;
  stress = number;
  evaluate();
}

function applyMotion(sample) {
  accelSamples = accelSamples.concat([sample]).slice(-12);
  evaluate();
  emit();
}

function readRecentStress() {
  try {
    const request = health.getRecentSamples({ dataTypes: [health.DATA_TYPES.STRESS] });
    if (request && typeof request.then === 'function') {
      request.then((items) => {
        const match = (items || []).find((item) => item.dataType === health.DATA_TYPES.STRESS);
        if (match && match.data) applyStress(match.data.value);
      }).catch(() => {});
    }
  } catch (error) {}
}

async function start() {
  state = await store.load();
  if (!state.settings.smartReviewEnabled || monitoring) {
    decision = state.settings.smartReviewEnabled ? decision : '智能推荐未开启';
    emit();
    return snapshot();
  }
  monitoring = true;
  decision = '正在读取设备状态';
  readRecentStress();
  try {
    health.subscribeSample({
      dataType: health.DATA_TYPES.STRESS,
      callback: (sample) => applyStress(sample && sample.value),
      fail: () => {
        stress = null;
        decision = '当前设备不支持压力数据';
        emit();
      },
    });
  } catch (error) {
    decision = '当前设备不支持压力数据';
  }
  try {
    sensor.subscribeAccelerometer({
      callback: applyMotion,
      fail: () => {
        accelSamples = [];
        decision = '当前设备不支持活动数据';
        emit();
      },
    });
  } catch (error) {
    decision = '当前设备不支持活动数据';
  }
  emit();
  return snapshot();
}

function stop() {
  if (monitoring) {
    try { health.unsubscribeSample({ dataType: health.DATA_TYPES.STRESS }); } catch (error) {}
    try { sensor.unsubscribeAccelerometer(); } catch (error) {}
  }
  monitoring = false;
  stress = null;
  accelSamples = [];
  ready = false;
  emit();
}

async function setEnabled(enabled) {
  state = await store.load();
  state.settings.smartReviewEnabled = !!enabled;
  if (!enabled) {
    state.context.lastReason = 'disabled';
    decision = '智能推荐未开启';
  }
  await store.save(state);
  if (enabled) return start();
  stop();
  return snapshot();
}

async function recordFeedback(accepted) {
  state = await store.load();
  state = contextEngine.recordRecommendationFeedback(state, !!accepted, stress, Date.now());
  await store.save(state);
  ready = false;
  decision = contextEngine.reasonLabel(state.context.lastReason);
  emit();
  return snapshot();
}

function subscribe(listener) {
  if (typeof listener !== 'function') return function () {};
  listeners.push(listener);
  listener(snapshot());
  return function () {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

module.exports = { start, stop, setEnabled, recordFeedback, subscribe, snapshot };
