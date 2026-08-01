const DEFAULT_STRESS_MAX = 25;
const MIN_ACCEL_SAMPLES = 6;
const STATIONARY_DELTA_MAX = 0.35;
const DUE_LOOKAHEAD_MS = 30 * 60 * 1000;
const RECOMMENDATION_COOLDOWN_MS = 30 * 60 * 1000;
const MIN_STRESS_MAX = 15;
const MAX_STRESS_MAX = 35;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isStationary(samples) {
  const points = (samples || []).slice(-12).filter((sample) => sample
    && Number.isFinite(Number(sample.x))
    && Number.isFinite(Number(sample.y))
    && Number.isFinite(Number(sample.z)));
  if (points.length < MIN_ACCEL_SAMPLES) return false;

  let movement = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = Number(points[i].x) - Number(points[i - 1].x);
    const dy = Number(points[i].y) - Number(points[i - 1].y);
    const dz = Number(points[i].z) - Number(points[i - 1].z);
    movement += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return movement / (points.length - 1) <= STATIONARY_DELTA_MAX;
}

function evaluateReviewWindow(input) {
  const settings = (input && input.settings) || {};
  if (!settings.smartReviewEnabled) return { ready: false, reason: 'disabled' };

  const plan = input && input.plan;
  if (!plan || Number(plan.sessionsCompleted || 0) <= 0) {
    return { ready: false, reason: 'no_review' };
  }

  const stress = finiteNumber(input && input.stress, NaN);
  if (!Number.isFinite(stress)) return { ready: false, reason: 'waiting_health' };
  if (stress > finiteNumber(settings.stressMax, DEFAULT_STRESS_MAX)) {
    return { ready: false, reason: 'high_stress' };
  }
  if (!isStationary(input && input.accelSamples)) {
    return { ready: false, reason: 'moving' };
  }

  const now = finiteNumber(input && input.now, Date.now());
  const dueAt = finiteNumber(plan.nextDueAt, now);
  if (dueAt > now + DUE_LOOKAHEAD_MS) return { ready: false, reason: 'not_due' };

  const last = finiteNumber(input && input.lastRecommendationAt, 0);
  if (last > 0 && now - last < RECOMMENDATION_COOLDOWN_MS) {
    return { ready: false, reason: 'cooldown' };
  }

  return {
    ready: true,
    reason: 'ready',
    stress,
    dueAt,
  };
}

function reasonLabel(reason) {
  const labels = {
    disabled: '智能推荐未开启',
    no_review: '完成首次学习后开始判断',
    waiting_health: '正在读取压力数据',
    high_stress: '当前压力较高，暂不打扰',
    moving: '检测到活动，等待安静时刻',
    not_due: '还未进入复习窗口',
    cooldown: '本轮推荐已经送达',
    ready: '当前状态适合短时复习',
    accepted: '已接受，本次反馈会优化后续时机',
    dismissed: '已稍后处理，后续会减少打扰',
  };
  return labels[reason] || '正在判断复习窗口';
}

function recordRecommendationFeedback(state, accepted, stress, now) {
  const input = state || {};
  const settings = Object.assign({ stressMax: DEFAULT_STRESS_MAX }, input.settings || {});
  const context = Object.assign({
    lastRecommendationAt: 0,
    lastReason: '',
    shown: 0,
    accepted: 0,
    dismissed: 0,
  }, input.context || {});
  const sample = finiteNumber(stress, settings.stressMax);
  const target = accepted
    ? Math.max(settings.stressMax, sample + 2)
    : Math.min(settings.stressMax, sample - 2);
  settings.stressMax = Math.round(clamp(
    settings.stressMax * 0.8 + target * 0.2,
    MIN_STRESS_MAX,
    MAX_STRESS_MAX,
  ));
  if (accepted) context.accepted += 1;
  else context.dismissed += 1;
  context.lastReason = accepted ? 'accepted' : 'dismissed';
  context.lastRecommendationAt = finiteNumber(now, Date.now());
  const total = context.accepted + context.dismissed;
  context.acceptanceRate = total > 0 ? Math.round(context.accepted * 100 / total) : 0;
  return Object.assign({}, input, { settings, context });
}

module.exports = {
  DEFAULT_STRESS_MAX,
  MIN_ACCEL_SAMPLES,
  DUE_LOOKAHEAD_MS,
  RECOMMENDATION_COOLDOWN_MS,
  MIN_STRESS_MAX,
  MAX_STRESS_MAX,
  isStationary,
  evaluateReviewWindow,
  reasonLabel,
  recordRecommendationFeedback,
};
