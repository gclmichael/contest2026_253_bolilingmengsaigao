import velaclaw from '@system.velaclaw';
import protocol from './agent_protocol.js';

const ASK_TIMEOUT_MS = 25000;

function ask(query, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('AI service timed out'));
    }, timeoutMs || ASK_TIMEOUT_MS);

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    }

    let request;
    try {
      request = velaclaw.ask({
        query,
        success: function (result) { finish(resolve, (result && result.reply) || ''); },
        fail: function (message, code) {
          finish(reject, new Error(`${code}: ${message || 'AI service unavailable'}`));
        },
        complete: function () {},
      });
    } catch (error) {
      finish(reject, error);
      return;
    }

    if (request && typeof request.then === 'function') {
      request.then(
        function (result) { finish(resolve, (result && result.reply) || ''); },
        function (error) {
          const reason = error instanceof Error ? error : new Error(String(error || 'AI service unavailable'));
          finish(reject, reason);
        },
      );
    }
  });
}

async function createPlan(topic, minutes) {
  const now = Date.now();
  try {
    const reply = await ask(protocol.planPrompt(topic, minutes, now));
    return protocol.normalizePlan(protocol.extractPayload(reply), topic, minutes, now);
  } catch (error) {
    console.log('FocusLoop agent fallback:', error);
    return protocol.fallbackPlan(topic, minutes, now);
  }
}

async function importPlan(minutes) {
  const now = Date.now();
  try {
    const reply = await ask(protocol.importPrompt(minutes), 60000);
    const payload = protocol.extractPayload(reply);
    return protocol.normalizePlan(payload, payload.topic || '导入材料', minutes, now, 'document');
  } catch (error) {
    console.log('FocusLoop import fallback:', error);
    const fallback = protocol.fallbackPlan('导入材料', minutes, now);
    fallback.source = 'document';
    return fallback;
  }
}

async function startVoiceInput() {
  const reply = await ask('[AGENT:VOICE_START]', 8000);
  return protocol.extractVoiceResult(reply, 'started');
}

async function stopVoiceInput() {
  const reply = await ask('[AGENT:VOICE_STOP]', 35000);
  return protocol.extractVoiceResult(reply, 'result');
}

async function scheduleLaunch(plan, atMillis) {
  const atEpoch = Math.floor(atMillis / 1000);
  const reply = await ask(protocol.schedulePrompt(plan, atEpoch));
  return protocol.extractScheduleResult(reply, atEpoch);
}

function recordReview(plan, card, correct, nextDueAt) {
  return ask(protocol.reviewPrompt(plan, card, correct, Math.floor(nextDueAt / 1000)));
}

module.exports = {
  ASK_TIMEOUT_MS,
  ask,
  createPlan,
  importPlan,
  startVoiceInput,
  stopVoiceInput,
  scheduleLaunch,
  recordReview,
};
