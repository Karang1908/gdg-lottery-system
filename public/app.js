(function () {
  'use strict';

  const RECEIPT_KEY = 'gdg-lottery-receipt';
  const form = document.getElementById('join-form');
  const joinPanel = document.getElementById('join-panel');
  const successPanel = document.getElementById('join-success');
  const nameInput = document.getElementById('name-input');
  const emailInput = document.getElementById('email-input');
  const joinButton = document.getElementById('join-button');
  const joinError = document.getElementById('join-error');
  const connectionBanner = document.getElementById('connection-banner');
  const countdown = document.getElementById('countdown');
  const nameList = document.getElementById('public-name-list');
  const publicWinner = document.getElementById('public-winner');
  const wheel = new window.LotteryWheel({
    canvas: document.getElementById('wheel'),
    empty: document.getElementById('wheel-empty'),
    tooltip: document.getElementById('wheel-tooltip'),
  });

  let state = null;
  let receipt = readReceipt();
  let failures = 0;
  let polling = false;

  function readReceipt() {
    try {
      return JSON.parse(localStorage.getItem(RECEIPT_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function storeReceipt(value) {
    receipt = value;
    try {
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(value));
    } catch {
      // The server remains authoritative even if private browsing blocks storage.
    }
  }

  function clearReceipt() {
    receipt = null;
    try {
      localStorage.removeItem(RECEIPT_KEY);
    } catch {}
  }

  function showError(message) {
    joinError.textContent = message || '';
    joinError.classList.toggle('hidden', !message);
    nameInput.setAttribute('aria-invalid', String(Boolean(message && nameInput.value.trim().length < 2)));
    emailInput.setAttribute('aria-invalid', String(Boolean(message && !emailInput.validity.valid)));
  }

  function setConfirmed(entry, duplicate) {
    document.getElementById('confirmed-name').textContent = entry.name;
    document.getElementById('receipt-status').textContent = duplicate
      ? 'You were already entered—your original entry is still active'
      : 'Entry confirmed and saved';
    joinPanel.classList.add('hidden');
    successPanel.classList.remove('hidden');
  }

  function setJoinVisible() {
    successPanel.classList.add('hidden');
    joinPanel.classList.remove('hidden');
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'The request could not be completed.');
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  function render(next) {
    state = next;
    wheel.setEntries(next.entries);
    document.getElementById('entrant-count').textContent = String(next.totalCount);
    document.getElementById('eligible-count').textContent = String(next.eligibleCount);

    publicWinner.classList.toggle('hidden', !next.winner);
    if (next.winner) {
      document.getElementById('public-winner-name').textContent = next.winner.name;
    }

    const fragment = document.createDocumentFragment();
    next.entries.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = entry.name;
      item.classList.toggle('is-selected', entry.selected);
      fragment.appendChild(item);
    });
    nameList.replaceChildren(fragment);

    if (receipt) {
      const existing = next.entries.find((entry) => entry.id === receipt.id);
      if (existing) {
        setConfirmed({ id: existing.id, name: existing.name }, receipt.duplicate);
      } else {
        clearReceipt();
        setJoinVisible();
      }
    }
    updateCountdown();
  }

  function formatRemaining(milliseconds) {
    if (milliseconds <= 0) return 'Ready to draw';
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const clock = [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
    return days ? `${days}d ${clock}` : clock;
  }

  function updateCountdown() {
    if (!state?.countdownEndsAt) {
      countdown.textContent = 'Not scheduled';
      return;
    }
    countdown.textContent = formatRemaining(
      new Date(state.countdownEndsAt).getTime() - Date.now()
    );
  }

  async function refresh() {
    if (polling || document.hidden) return;
    polling = true;
    try {
      const next = await fetchJson('/api/state', { cache: 'no-store' });
      failures = 0;
      connectionBanner.classList.add('hidden');
      if (!state || next.revision !== state.revision) render(next);
      else state.countdownEndsAt = next.countdownEndsAt;
    } catch {
      failures += 1;
      if (failures >= 2) connectionBanner.classList.remove('hidden');
    } finally {
      polling = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (name.length < 2) {
      showError('Enter your full name using at least 2 characters.');
      nameInput.focus();
      return;
    }
    if (!emailInput.validity.valid || !email) {
      showError('Enter a valid email address, such as name@example.com.');
      emailInput.focus();
      return;
    }

    joinButton.disabled = true;
    joinButton.textContent = 'Saving your entry…';
    try {
      const result = await fetchJson('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      storeReceipt({
        id: result.entry.id,
        name: result.entry.name,
        duplicate: result.alreadyJoined,
      });
      setConfirmed(result.entry, result.alreadyJoined);
      render(result.state);
    } catch (error) {
      showError(error.message);
    } finally {
      joinButton.disabled = false;
      joinButton.textContent = 'Join the wheel';
    }
  });

  if (receipt) setConfirmed(receipt, receipt.duplicate);
  setInterval(updateCountdown, 500);
  setInterval(refresh, 1800);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  refresh();
})();
