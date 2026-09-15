(() => {
  "use strict";

  /* ======================================================================
     ELEMENTS
     ====================================================================== */
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBarFill = document.getElementById('loading-bar-fill');
  const introScreen = document.getElementById('intro-screen');
  const app = document.getElementById('app');

  const hallBg = document.getElementById('hall-bg');
  const sceneViewport = document.getElementById('scene-viewport');

  const nyTimeEl = document.getElementById('ny-time');
  const localTimeEl = document.getElementById('local-time');
  const marketStatusEl = document.getElementById('market-status');
  const sessionStatusEl = document.getElementById('session-status');

  const welcomeModal = document.getElementById('welcome-modal');
  const enterBtn = document.getElementById('enter-btn');

  const btnWalk = document.getElementById('btn-walk');
  const btnBack = document.getElementById('btn-back');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnVault = document.getElementById('btn-vault');
  const btnLobby = document.getElementById('btn-lobby');
  const btnSound = document.getElementById('btn-sound');
  const soundIcon = document.getElementById('sound-icon');
  const btnConnect = document.getElementById('btn-connect');

  const counterPanel = document.getElementById('counter-panel');
  const counterPanelTitle = document.getElementById('counter-panel-title');
  const counterPanelBody = document.getElementById('counter-panel-body');
  const counterPanelClose = document.getElementById('counter-panel-close');
  const counterAskInput = document.getElementById('counter-ask-input');
  const counterAskBtn = document.getElementById('counter-ask-btn');

  /* ======================================================================
     LOADING SEQUENCE
     ====================================================================== */
  let progress = 0;
  const loadingInterval = setInterval(() => {
    progress += Math.random() * 18 + 6;
    if (progress >= 100) {
      progress = 100;
      loadingBarFill.style.width = '100%';
      clearInterval(loadingInterval);
      setTimeout(showIntro, 350);
      return;
    }
    loadingBarFill.style.width = progress + '%';
  }, 180);

  function showIntro() {
    loadingScreen.classList.add('hidden');
    introScreen.classList.remove('hidden');
  }

  function enterHall() {
    if (introScreen.classList.contains('hidden')) return;
    introScreen.classList.add('hidden');
    app.classList.remove('hidden');
    startClocks();
  }

  // Any scroll, swipe/touch, click or keypress on the intro screen opens the doors
  introScreen.addEventListener('click', enterHall);
  introScreen.addEventListener('wheel', enterHall, { passive: true });
  introScreen.addEventListener('touchmove', enterHall, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (!introScreen.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
      enterHall();
    }
  });

  /* ======================================================================
     WELCOME MODAL
     ====================================================================== */
  enterBtn.addEventListener('click', () => {
    welcomeModal.classList.add('hidden');
  });

  /* ======================================================================
     LIVE CLOCKS / MARKET SESSION
     ====================================================================== */
  function pad(n) { return n.toString().padStart(2, '0'); }

  function getNYParts(date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const parts = fmt.formatToParts(date);
    const map = {};
    parts.forEach(p => map[p.type] = p.value);
    return {
      weekday: map.weekday,
      hour: parseInt(map.hour, 10) % 24,
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10)
    };
  }

  const WEEKDAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function marketOpenMinutes() { return 9 * 60 + 30; }   // 9:30 ET
  function marketCloseMinutes() { return 16 * 60; }      // 16:00 ET

  function updateClocks() {
    const now = new Date();

    // New York
    const ny = getNYParts(now);
    nyTimeEl.textContent = `${pad(ny.hour)}:${pad(ny.minute)}:${pad(ny.second)}`;

    // Local
    localTimeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // Market status
    const dayIdx = WEEKDAY_ORDER.indexOf(ny.weekday);
    const nowMins = ny.hour * 60 + ny.minute;
    const isWeekday = dayIdx >= 1 && dayIdx <= 5;
    const isOpen = isWeekday && nowMins >= marketOpenMinutes() && nowMins < marketCloseMinutes();

    marketStatusEl.textContent = isOpen ? 'OPEN' : 'CLOSED';
    marketStatusEl.classList.toggle('open', isOpen);
    marketStatusEl.classList.toggle('closed', !isOpen);

    // Session countdown
    let diffSeconds;
    let label;
    if (isOpen) {
      const closeSecs = marketCloseMinutes() * 60;
      const nowSecs = nowMins * 60 + ny.second;
      diffSeconds = closeSecs - nowSecs;
      label = 'CLOSES IN';
    } else {
      // find seconds until next 9:30 ET on a weekday
      let daysAhead = 0;
      let d = dayIdx;
      const nowSecs = nowMins * 60 + ny.second;
      const openSecs = marketOpenMinutes() * 60;

      if (isWeekday && nowSecs < openSecs) {
        daysAhead = 0;
      } else {
        daysAhead = 1;
        d = (d + 1) % 7;
        while (d === 0 || d === 6) { daysAhead++; d = (d + 1) % 7; }
      }
      const secondsToday = (daysAhead === 0)
        ? (openSecs - nowSecs)
        : (86400 - nowSecs) + (daysAhead - 1) * 86400 + openSecs;
      diffSeconds = secondsToday;
      label = 'OPENS IN';
    }

    const h = Math.floor(diffSeconds / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    sessionStatusEl.textContent = `${label} ${h}H ${pad(m)}M`;
  }

  let clockInterval = null;
  function startClocks() {
    updateClocks();
    if (!clockInterval) clockInterval = setInterval(updateClocks, 1000);
  }

  /* ======================================================================
     SCENE NAVIGATION — pan (drag / arrows) + zoom (walk / back)
     ====================================================================== */
  const view = { x: 0, y: 0, scale: 1 };
  const PAN_LIMIT = 18;      // % of viewport
  const ZOOM_STEP = 0.14;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 1.55;

  function applyView() {
    hallBg.style.transform =
      `translate(-50%,-50%) translate(${view.x}%, ${view.y}%) scale(${view.scale})`;
  }

  function clampPan() {
    const limit = PAN_LIMIT * (view.scale);
    view.x = Math.max(-limit, Math.min(limit, view.x));
    view.y = Math.max(-limit * 0.4, Math.min(limit * 0.4, view.y));
  }

  btnWalk.addEventListener('click', () => {
    view.scale = Math.min(ZOOM_MAX, view.scale + ZOOM_STEP);
    clampPan();
    applyView();
    flashActive(btnWalk);
  });
  btnBack.addEventListener('click', () => {
    view.scale = Math.max(ZOOM_MIN, view.scale - ZOOM_STEP);
    if (view.scale === ZOOM_MIN) { view.x = 0; view.y = 0; }
    clampPan();
    applyView();
    flashActive(btnBack);
  });
  btnLeft.addEventListener('click', () => {
    view.x += 6;
    clampPan();
    applyView();
    flashActive(btnLeft);
  });
  btnRight.addEventListener('click', () => {
    view.x -= 6;
    clampPan();
    applyView();
    flashActive(btnRight);
  });

  function flashActive(btn) {
    btn.classList.add('active-state');
    setTimeout(() => btn.classList.remove('active-state'), 150);
  }

  // Drag to look around
  let dragging = false;
  let startPX = 0, startPY = 0, startVX = 0, startVY = 0;

  function dragStart(px, py) {
    dragging = true;
    startPX = px; startPY = py;
    startVX = view.x; startVY = view.y;
  }
  function dragMove(px, py) {
    if (!dragging) return;
    const dx = (px - startPX) / sceneViewport.clientWidth * 100;
    const dy = (py - startPY) / sceneViewport.clientHeight * 100;
    view.x = startVX + dx * 1.4;
    view.y = startVY + dy * 1.4;
    clampPan();
    applyView();
  }
  function dragEnd() { dragging = false; }

  sceneViewport.addEventListener('mousedown', (e) => dragStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => dragMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', dragEnd);

  sceneViewport.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    dragStart(t.clientX, t.clientY);
  }, { passive: true });
  sceneViewport.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    dragMove(t.clientX, t.clientY);
  }, { passive: true });
  sceneViewport.addEventListener('touchend', dragEnd);

  /* ======================================================================
     SOUND TOGGLE
     ====================================================================== */
  let muted = false;
  btnSound.addEventListener('click', () => {
    muted = !muted;
    soundIcon.className = muted ? 'ri-volume-mute-line' : 'ri-volume-up-line';
    btnSound.classList.toggle('active-state', muted);
  });

  /* ======================================================================
     VAULT DESK / LOBBY (placeholders for future routing)
     ====================================================================== */
  btnVault.addEventListener('click', () => flashActive(btnVault));
  btnLobby.addEventListener('click', () => flashActive(btnLobby));

  /* ======================================================================
     COUNTER HOTSPOTS
     ====================================================================== */
  const COUNTERS = [
    { ticker: '$AAPL', name: 'COUNTER 01', x: 6, y: 46, w: 18, h: 22 },
    { ticker: '$MSFT', name: 'COUNTER 02', x: 30, y: 46, w: 14, h: 20 },
    { ticker: '$NVDA', name: 'COUNTER 03', x: 46, y: 42, w: 16, h: 24 },
    { ticker: '$AMZN', name: 'COUNTER 04', x: 64, y: 46, w: 14, h: 20 },
    { ticker: '$TSLA', name: 'COUNTER 05', x: 78, y: 46, w: 18, h: 22 },
  ];

  const hotspotLayer = document.createElement('div');
  hotspotLayer.style.position = 'absolute';
  hotspotLayer.style.inset = '0';
  hotspotLayer.style.zIndex = '15';
  sceneViewport.appendChild(hotspotLayer);

  COUNTERS.forEach(c => {
    const el = document.createElement('button');
    el.setAttribute('aria-label', `${c.ticker} counter`);
    el.style.position = 'absolute';
    el.style.left = c.x + '%';
    el.style.top = c.y + '%';
    el.style.width = c.w + '%';
    el.style.height = c.h + '%';
    el.style.background = 'transparent';
    el.style.border = 'none';
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openCounterPanel(c);
    });
    hotspotLayer.appendChild(el);
  });

  function openCounterPanel(c) {
    counterPanelTitle.textContent = `${c.ticker} \u00B7 ${c.name}`;
    counterPanelBody.innerHTML = '<p class="agent-msg">Ask the Mechanica agent at this counter anything.</p>';
    counterPanel.classList.add('visible');
  }
  counterPanelClose.addEventListener('click', () => counterPanel.classList.remove('visible'));

  function sendAsk() {
    const text = counterAskInput.value.trim();
    if (!text) return;
    const userMsg = document.createElement('p');
    userMsg.className = 'agent-msg user';
    userMsg.textContent = text;
    counterPanelBody.appendChild(userMsg);
    counterAskInput.value = '';
    counterPanelBody.scrollTop = counterPanelBody.scrollHeight;

    setTimeout(() => {
      const reply = document.createElement('p');
      reply.className = 'agent-msg';
      reply.textContent = 'The agent is not yet wired up — this is a visual preview of the Exchange Hall.';
      counterPanelBody.appendChild(reply);
      counterPanelBody.scrollTop = counterPanelBody.scrollHeight;
    }, 400);
  }
  counterAskBtn.addEventListener('click', sendAsk);
  counterAskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAsk(); });

})();

