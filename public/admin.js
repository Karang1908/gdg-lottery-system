(function () {
  'use strict';

  const PASSWORD_KEY = 'gdg-lottery-admin-password';
  const loginForm = document.getElementById('login-form');
  const loginButton = document.getElementById('login-button');
  const passwordInput = document.getElementById('password-input');
  const loginError = document.getElementById('login-error');
  const lock = document.getElementById('admin-lock');
  const consolePanel = document.getElementById('admin-console');
  const actionError = document.getElementById('action-error');
  const drawButton = document.getElementById('draw-button');
  const advanceButton = document.getElementById('advance-button');
  const returnButton = document.getElementById('return-button');
  const syncState = document.getElementById('sync-state');
  const toast = document.getElementById('toast');
  const searchInput = document.getElementById('roster-search');
  const wheel = new window.LotteryWheel({
    canvas: document.getElementById('wheel'),
    empty: document.getElementById('wheel-empty'),
    tooltip: document.getElementById('wheel-tooltip'),
  });

  let password = '';
  let state = null;
  let spinning = false;
  let polling = false;
  let toastTimer = null;

  function showLoginError(message) {
    loginError.textContent = message || '';
    loginError.classList.toggle('hidden', !message);
    passwordInput.setAttribute('aria-invalid', String(Boolean(message)));
  }

  function showActionError(message) {
    actionError.textContent = message || '';
    actionError.classList.toggle('hidden', !message);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove('hidden');
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  }

  async function fetchJson(url, options = {}) {
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'x-admin-password': password,
      ...(options.headers || {}),
    };
    const response = await fetch(url, { cache: 'no-store', ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'The request could not be completed.');
      error.code = payload.code;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function adminAction(action, extra = {}) {
    showActionError('');
    return fetchJson('/api/admin', {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    });
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
    const output = document.getElementById('admin-countdown');
    if (!state?.countdownEndsAt) {
      output.textContent = 'Not scheduled';
      return;
    }
    output.textContent = formatRemaining(
      new Date(state.countdownEndsAt).getTime() - Date.now()
    );
  }

  function renderRoster() {
    const query = searchInput.value.trim().toLowerCase();
    const entries = (state?.entries || []).filter(
      (entry) =>
        !query ||
        entry.name.toLowerCase().includes(query) ||
        entry.email.toLowerCase().includes(query)
    );
    const list = document.getElementById('admin-roster');
    const fragment = document.createDocumentFragment();
    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      item.classList.toggle('is-selected', Boolean(entry.selectedAt));

      const swatch = document.createElement('span');
      swatch.className = 'roster-swatch';
      swatch.style.background = entry.selectedAt
        ? 'var(--text-3)'
        : ['#4285f4', '#ea4335', '#fbbc04', '#34a853'][index % 4];

      const person = document.createElement('span');
      person.className = 'roster-person';
      const name = document.createElement('strong');
      name.textContent = entry.name;
      const email = document.createElement('span');
      email.textContent = entry.email;
      person.append(name, email);

      const actions = document.createElement('span');
      actions.className = 'roster-actions';
      if (entry.selectedAt) {
        const selected = document.createElement('span');
        selected.className = 'selected-label';
        selected.textContent = 'Selected';
        actions.appendChild(selected);
      }
      const remove = document.createElement('button');
      remove.className = 'remove-entry';
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${entry.name}`);
      remove.innerHTML = '<svg class="icon icon-small"><use href="#i-close" /></svg>';
      remove.addEventListener('click', () => removeEntry(entry));
      actions.appendChild(remove);

      item.append(swatch, person, actions);
      fragment.appendChild(item);
    });
    list.replaceChildren(fragment);
    const empty = document.getElementById('roster-empty');
    empty.textContent = query ? 'No entrants match that search.' : 'No one has joined yet.';
    empty.classList.toggle('hidden', entries.length > 0);
  }

  function renderHistory() {
    const list = document.getElementById('history-list');
    const history = state?.history || [];
    const fragment = document.createDocumentFragment();
    history.forEach((winner) => {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = winner.name;
      const time = document.createElement('time');
      time.dateTime = winner.drawnAt;
      time.textContent = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(winner.drawnAt));
      item.append(name, time);
      fragment.appendChild(item);
    });
    list.replaceChildren(fragment);
    document.getElementById('history-empty').classList.toggle('hidden', history.length > 0);
  }

  function render(next) {
    state = next;
    wheel.setEntries(next.entries);
    document.getElementById('admin-total').textContent = String(next.totalCount);
    document.getElementById('admin-eligible').textContent = String(next.eligibleCount);
    document.getElementById('roster-count').textContent = String(next.totalCount);

    const hasWinner = Boolean(next.winner);
    document.getElementById('winner-empty').classList.toggle('hidden', hasWinner);
    document.getElementById('winner-result').classList.toggle('hidden', !hasWinner);
    if (hasWinner) document.getElementById('winner-name').textContent = next.winner.name;

    drawButton.classList.toggle('hidden', hasWinner);
    advanceButton.classList.toggle('hidden', !hasWinner);
    returnButton.classList.toggle('hidden', !hasWinner);
    drawButton.disabled = spinning || !next.eligibleCount;
    drawButton.textContent = spinning
      ? 'Drawing…'
      : next.eligibleCount
        ? 'Draw a winner'
        : next.totalCount
          ? 'Everyone has been selected'
          : 'Waiting for entries';

    renderRoster();
    renderHistory();
    updateCountdown();
  }

  async function unlock(candidate, quiet = false) {
    password = candidate;
    loginButton.disabled = true;
    loginButton.textContent = 'Checking…';
    try {
      const next = await fetchJson('/api/state?admin=1');
      sessionStorage.setItem(PASSWORD_KEY, password);
      showLoginError('');
      lock.classList.add('hidden');
      consolePanel.classList.remove('hidden');
      render(next);
      try {
        if (sessionStorage.getItem(PRESENT_KEY) === '1') setPresenting(true);
      } catch (_) {}
      syncState.classList.remove('is-offline');
      syncState.lastChild.textContent = 'Live';
    } catch (error) {
      password = '';
      sessionStorage.removeItem(PASSWORD_KEY);
      if (!quiet) {
        showLoginError(error.message);
        passwordInput.focus();
        passwordInput.select();
      }
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Unlock console';
    }
  }

  async function refresh() {
    if (!password || polling || spinning || document.hidden) return;
    polling = true;
    try {
      const next = await fetchJson('/api/state?admin=1');
      if (!state || next.revision !== state.revision) render(next);
      syncState.classList.remove('is-offline');
      syncState.lastChild.textContent = 'Live';
    } catch (error) {
      syncState.classList.add('is-offline');
      syncState.lastChild.textContent = 'Offline';
      if (error.status === 401) {
        password = '';
        sessionStorage.removeItem(PASSWORD_KEY);
        consolePanel.classList.add('hidden');
        lock.classList.remove('hidden');
        showLoginError('Your admin session expired. Enter the password again.');
      }
    } finally {
      polling = false;
    }
  }

  async function drawWinner() {
    if (spinning || !state) return;
    spinning = true;
    drawButton.disabled = true;
    drawButton.textContent = 'Committing fair draw…';
    showActionError('');
    try {
      const before = state.entries.map((entry) => ({ ...entry }));
      const next = await adminAction('draw');
      const winnerId = next.winnerId || next.winner?.id;
      const index = before.findIndex((entry) => entry.id === winnerId);
      if (index === -1) throw new Error('The selected winner was not found on this wheel.');
      wheel.setEntries(before);
      drawButton.textContent = 'Drawing…';
      await wheel.spinTo(index);
      render(next);
    } catch (error) {
      showActionError(error.message);
      if (state) render(state);
    } finally {
      spinning = false;
      if (state) render(state);
    }
  }

  async function runAndRender(action, message, extra) {
    try {
      const next = await adminAction(action, extra);
      render(next);
      if (message) showToast(message);
    } catch (error) {
      showActionError(error.message);
    }
  }

  async function removeEntry(entry) {
    if (!confirm(`Remove ${entry.name} from this lottery?`)) return;
    await runAndRender('remove', `${entry.name} was removed.`, { entryId: entry.id });
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    showLoginError('');
    const candidate = passwordInput.value;
    if (!candidate) {
      showLoginError('Enter the admin password.');
      passwordInput.focus();
      return;
    }
    unlock(candidate);
  });

  drawButton.addEventListener('click', drawWinner);
  advanceButton.addEventListener('click', () => runAndRender('advance'));
  returnButton.addEventListener('click', () =>
    runAndRender('return', 'The winner is eligible again.')
  );
  searchInput.addEventListener('input', renderRoster);

  /* Presentation mode. The console doubles as the screen the room watches, so
     the operator's half — roster, emails, schedule, reset controls — is hidden
     behind one toggle. Kept in sessionStorage so an accidental refresh in front
     of the room comes back presenting rather than exposing the entrant list. */
  const PRESENT_KEY = 'gdg-lottery-presenting';

  function setPresenting(on) {
    document.body.classList.toggle('is-presenting', on);
    try {
      if (on) sessionStorage.setItem(PRESENT_KEY, '1');
      else sessionStorage.removeItem(PRESENT_KEY);
    } catch (_) {
      // A blocked storage API must not stop the toggle itself working.
    }
  }

  document
    .getElementById('present-button')
    .addEventListener('click', () => setPresenting(true));
  document
    .getElementById('present-exit')
    .addEventListener('click', () => setPresenting(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('is-presenting')) {
      setPresenting(false);
    }
  });

  document.getElementById('countdown-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.getElementById('countdown-input').value;
    const endsAt = new Date(value).getTime();
    if (!Number.isFinite(endsAt)) {
      showActionError('Choose a valid date and time for the next draw.');
      return;
    }
    runAndRender('setCountdown', 'Countdown scheduled.', { endsAt });
  });

  document.querySelectorAll('[data-minutes]').forEach((button) => {
    button.addEventListener('click', () => {
      const minutes = Number(button.dataset.minutes);
      runAndRender('setCountdown', `Countdown set for ${button.textContent}.`, {
        endsAt: Date.now() + minutes * 60 * 1000,
      });
    });
  });

  document.getElementById('cancel-countdown').addEventListener('click', () =>
    runAndRender('cancelCountdown', 'Countdown cancelled.')
  );

  document.getElementById('reset-pool').addEventListener('click', () => {
    if (!confirm('Make every entrant eligible again and clear winner history?')) return;
    runAndRender('resetPool', 'Everyone is eligible again.');
  });

  document.getElementById('reset-all').addEventListener('click', () => {
    const count = state?.totalCount || 0;
    if (
      !confirm(
        `Clear all ${count} entr${count === 1 ? 'y' : 'ies'}, winner history, and the countdown? This cannot be undone.`
      )
    )
      return;
    runAndRender('resetAll', 'The lottery has been cleared.');
  });

  const initialPassword = sessionStorage.getItem(PASSWORD_KEY);
  if (initialPassword) unlock(initialPassword, true);
  const input = document.getElementById('countdown-input');
  input.min = new Date(Date.now() + 60_000).toISOString().slice(0, 16);
  setInterval(updateCountdown, 500);
  setInterval(refresh, 1500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();
