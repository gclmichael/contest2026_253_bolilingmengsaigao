const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function gradeCard(card, correct, now) {
  const next = Object.assign({}, card);
  const safeNow = finiteNumber(now, Date.now());
  if (!correct) {
    next.repetitions = 0;
    next.intervalDays = 0;
    next.dueAt = safeNow + RETRY_MS;
    return next;
  }

  next.repetitions = Math.max(0, finiteNumber(card.repetitions, 0)) + 1;
  if (next.repetitions === 1) next.intervalDays = 1;
  else if (next.repetitions === 2) next.intervalDays = 3;
  else next.intervalDays = Math.min(30, Math.round(Math.max(3, finiteNumber(card.intervalDays, 3)) * 2.2));
  next.dueAt = safeNow + next.intervalDays * DAY_MS;
  return next;
}

function nextDueCard(plan, now) {
  const cards = (plan && plan.cards) || [];
  if (!cards.length) return null;
  const safeNow = finiteNumber(now, Date.now());
  const sorted = cards.slice().sort((a, b) => finiteNumber(a.dueAt, 0) - finiteNumber(b.dueAt, 0));
  const due = sorted.find((card) => finiteNumber(card.dueAt, 0) <= safeNow);
  return due || sorted[0];
}

function recalculatePlan(plan) {
  const cards = (plan.cards || []).slice();
  const nextDueAt = cards.length
    ? Math.min.apply(null, cards.map((card) => finiteNumber(card.dueAt, Date.now())))
    : Date.now();
  return Object.assign({}, plan, { cards, nextDueAt });
}

function progressPercent(plan) {
  const total = Math.max(0, finiteNumber(plan && plan.totalAnswers, 0));
  const correct = Math.max(0, finiteNumber(plan && plan.correctAnswers, 0));
  if (total <= 0) return 0;
  return Math.min(100, Math.round((correct / total) * 100));
}

function relativeTime(timestamp, now) {
  const delta = finiteNumber(timestamp, 0) - finiteNumber(now, Date.now());
  if (delta <= 0) return '现在可复习';
  const minutes = Math.ceil(delta / 60000);
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.ceil(hours / 24)} 天后`;
}

module.exports = {
  DAY_MS,
  RETRY_MS,
  gradeCard,
  nextDueCard,
  recalculatePlan,
  progressPercent,
  relativeTime,
};
