import storage from '@system.storage';

const STATE_KEY = 'focusloop.state.v1';

function emptyState() {
  return {
    version: 3,
    plan: null,
    currentCardId: '',
    lastSessionAt: 0,
    settings: {
      smartReviewEnabled: false,
      stressMax: 25,
    },
    context: {
      lastRecommendationAt: 0,
      lastReason: '',
      shown: 0,
      accepted: 0,
      dismissed: 0,
      acceptanceRate: 0,
    },
  };
}

function normalizeState(value) {
  const base = emptyState();
  const input = value || {};
  return Object.assign({}, base, input, {
    version: 3,
    settings: Object.assign({}, base.settings, input.settings || {}),
    context: Object.assign({}, base.context, input.context || {}),
  });
}

function load() {
  return new Promise((resolve) => {
    storage.get({
      key: STATE_KEY,
      default: '',
      success(value) {
        if (!value) return resolve(emptyState());
        try {
          resolve(normalizeState(JSON.parse(value)));
        } catch (error) {
          console.log('FocusLoop state parse failed:', error);
          resolve(emptyState());
        }
      },
      fail() {
        resolve(emptyState());
      },
      complete() {},
    });
  });
}

function save(state) {
  return new Promise((resolve, reject) => {
    storage.set({
      key: STATE_KEY,
      value: JSON.stringify(state),
      success() { resolve(state); },
      fail(message, code) { reject(new Error(`${code}: ${message}`)); },
      complete() {},
    });
  });
}

module.exports = { STATE_KEY, emptyState, normalizeState, load, save };
