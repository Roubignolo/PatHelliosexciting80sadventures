// =====================================================================
// PAT HELLIO'S EXCITING 80s ADVENTURES
// Vanilla HTML5 canvas. Aucune dépendance. Tout est dessiné en code.
// =====================================================================

const W = 480;
const H = 270;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const SCENE_NAME_EL = document.getElementById("scene-name");
const SCORE_EL = document.getElementById("score");

// --- Palette ---
const PAL = {
  black: "#0a0420",
  ink: "#1a0a3a",
  pink: "#ff3aa3",
  cyan: "#29e7ff",
  purple: "#9b3aff",
  yellow: "#ffe347",
  green: "#5cff7c",
  red: "#ff5e5e",
  skin: "#f3c39a",
  hair: "#3a1b08",
  shirt: "#ff3aa3",
  pants: "#2a4ad8",
  shoe: "#1a1a2a",
  brick: "#5a2a5a",
  brickDark: "#3a163a",
  wood: "#7a4a2a",
  metal: "#7a7a90",
  metalLite: "#a0a0b8",
  white: "#fefefe",
  gray: "#3a3a4a",
};

// =====================================================================
// STATE
// =====================================================================

const state = {
  scene: "TITLE",
  nextScene: null,
  inv: [],
  score: 0,
  flags: {},
  paused: false,
  showInv: false,
  // dialog: { lines: [{speaker, text}], idx, charIdx, onEnd, choices?, choiceIdx? }
  dialog: null,
  // toast: { text, t }
  toast: null,
  // transition: { t, dir: 'out'|'in', after: fn }
  transition: null,
  // floating score popups
  pops: [],
  // CRT flicker phase
  flicker: 0,
  t: 0,
};

const input = {
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0, down: false },
  click: null, // {x, y} the last click in canvas coords
};

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
  if (!input.keys.has(e.code)) input.pressed.add(e.code);
  input.keys.add(e.code);
});
window.addEventListener("keyup", (e) => {
  input.keys.delete(e.code);
});

function canvasCoords(evt) {
  const r = canvas.getBoundingClientRect();
  const x = ((evt.clientX - r.left) / r.width) * W;
  const y = ((evt.clientY - r.top) / r.height) * H;
  return { x: Math.round(x), y: Math.round(y) };
}

canvas.addEventListener("mousemove", (e) => {
  const c = canvasCoords(e);
  input.mouse.x = c.x;
  input.mouse.y = c.y;
});
canvas.addEventListener("mousedown", (e) => {
  const c = canvasCoords(e);
  input.mouse.down = true;
  input.click = c;
});
canvas.addEventListener("mouseup", () => {
  input.mouse.down = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// =====================================================================
// AUDIO (synthé minimaliste pour bleeps rétro)
// =====================================================================

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audioCtx = null;
    }
  }
}
function beep(freq = 440, dur = 0.08, type = "square", gain = 0.06) {
  ensureAudio();
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}
const SFX = {
  blip: () => beep(880, 0.05, "square", 0.04),
  pickup: () => {
    beep(660, 0.06, "square", 0.05);
    setTimeout(() => beep(990, 0.08, "square", 0.05), 60);
  },
  jump: () => beep(520, 0.1, "square", 0.05),
  land: () => beep(180, 0.06, "square", 0.04),
  door: () => {
    beep(330, 0.08, "sawtooth", 0.05);
    setTimeout(() => beep(220, 0.12, "sawtooth", 0.04), 90);
  },
  bad: () => beep(120, 0.18, "sawtooth", 0.07),
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => beep(f, 0.14, "square", 0.07), i * 120)
    );
  },
  dialog: () => beep(740, 0.02, "square", 0.025),
};

// =====================================================================
// PLAYER
// =====================================================================

const player = {
  x: 80,
  y: 200,
  w: 14,
  h: 26,
  vx: 0,
  vy: 0,
  facing: 1,
  onGround: true,
  walkPhase: 0,
  walking: false,
  // click-to-walk target X (null if none)
  walkTo: null,
  walkArrive: null,
};

function resetPlayer(x = 80, y = 200) {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.walkTo = null;
  player.walkArrive = null;
}

// Draw Pat: short brown hair, glasses, bright shirt
function drawPat(x, y, facing, phase, jumping = false) {
  ctx.save();
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x - 8, y + 26, 16, 2);

  const fx = facing < 0 ? -1 : 1;
  ctx.translate(x, y);
  if (fx < 0) ctx.scale(-1, 1);

  // legs
  const swing = jumping ? -2 : Math.sin(phase) * 2;
  ctx.fillStyle = PAL.pants;
  ctx.fillRect(-5, 16, 4, 8 + swing);
  ctx.fillRect(1, 16, 4, 8 - swing);
  // shoes
  ctx.fillStyle = PAL.shoe;
  ctx.fillRect(-6, 24 + swing, 5, 2);
  ctx.fillRect(1, 24 - swing, 5, 2);

  // body
  ctx.fillStyle = PAL.shirt;
  ctx.fillRect(-6, 7, 12, 10);
  // collar
  ctx.fillStyle = PAL.white;
  ctx.fillRect(-2, 7, 4, 2);

  // arms
  ctx.fillStyle = PAL.shirt;
  const armA = jumping ? -3 : Math.sin(phase + Math.PI) * 1.5;
  ctx.fillRect(-7, 8 + armA, 2, 7);
  ctx.fillRect(5, 8 - armA, 2, 7);
  // hands
  ctx.fillStyle = PAL.skin;
  ctx.fillRect(-7, 14 + armA, 2, 2);
  ctx.fillRect(5, 14 - armA, 2, 2);

  // head
  ctx.fillStyle = PAL.skin;
  ctx.fillRect(-4, -1, 8, 8);
  // hair (top + sides)
  ctx.fillStyle = PAL.hair;
  ctx.fillRect(-5, -2, 10, 3);
  ctx.fillRect(-5, 0, 2, 2);
  ctx.fillRect(3, 0, 2, 2);
  // glasses
  ctx.fillStyle = PAL.black;
  ctx.fillRect(-4, 2, 3, 2);
  ctx.fillRect(0, 2, 3, 2);
  ctx.fillRect(-1, 3, 1, 1);
  // mouth
  ctx.fillStyle = "#5a2020";
  ctx.fillRect(-1, 5, 2, 1);

  ctx.restore();
}

function updatePlayerSimple(dt) {
  // For point-and-click scenes: horizontal walk only, no gravity
  let dx = 0;
  if (input.keys.has("ArrowLeft") || input.keys.has("KeyA")) dx -= 1;
  if (input.keys.has("ArrowRight") || input.keys.has("KeyD")) dx += 1;

  if (dx !== 0) {
    player.walkTo = null; // cancel autowalk on manual input
    player.facing = dx;
    player.x += dx * 1.4 * (dt / 16.67);
    player.walking = true;
  } else if (player.walkTo !== null) {
    const diff = player.walkTo - player.x;
    if (Math.abs(diff) < 2) {
      player.x = player.walkTo;
      player.walkTo = null;
      player.walking = false;
      if (player.walkArrive) {
        const cb = player.walkArrive;
        player.walkArrive = null;
        cb();
      }
    } else {
      player.facing = diff > 0 ? 1 : -1;
      player.x += player.facing * 1.4 * (dt / 16.67);
      player.walking = true;
    }
  } else {
    player.walking = false;
  }

  // clamp to scene bounds
  const sc = scenes[state.scene];
  const lo = (sc && sc.bounds && sc.bounds.x0) ?? 10;
  const hi = (sc && sc.bounds && sc.bounds.x1) ?? W - 10;
  if (player.x < lo) player.x = lo;
  if (player.x > hi) player.x = hi;

  if (player.walking) player.walkPhase += (dt / 16.67) * 0.4;
}

function updatePlayerPlatform(dt, platforms) {
  const step = dt / 16.67;
  let dx = 0;
  if (input.keys.has("ArrowLeft") || input.keys.has("KeyA")) dx -= 1;
  if (input.keys.has("ArrowRight") || input.keys.has("KeyD")) dx += 1;

  player.vx = dx * 1.6;
  if (dx !== 0) player.facing = dx;

  // jump (with variable height: short tap = small hop, hold = full jump)
  if (
    (input.pressed.has("Space") ||
      input.pressed.has("ArrowUp") ||
      input.pressed.has("KeyW")) &&
    player.onGround
  ) {
    player.vy = -7;
    player.onGround = false;
    SFX.jump();
  }
  // cut jump short if player releases
  const jumpHeld =
    input.keys.has("Space") ||
    input.keys.has("ArrowUp") ||
    input.keys.has("KeyW");
  if (!jumpHeld && player.vy < -3.5) {
    player.vy = -3.5;
  }

  // gravity
  player.vy += 0.32 * step;
  if (player.vy > 8) player.vy = 8;

  // X movement w/ horizontal collision
  player.x += player.vx * step;
  for (const p of platforms) {
    if (rectOverlap(player.x - player.w / 2, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) {
      if (player.vx > 0) player.x = p.x - player.w / 2;
      else if (player.vx < 0) player.x = p.x + p.w + player.w / 2;
      player.vx = 0;
    }
  }

  // Y movement w/ vertical collision
  const prevOnGround = player.onGround;
  player.onGround = false;
  player.y += player.vy * step;
  for (const p of platforms) {
    if (rectOverlap(player.x - player.w / 2, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) {
      if (player.vy > 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }
  if (!prevOnGround && player.onGround) SFX.land();

  // walk anim
  if (Math.abs(player.vx) > 0.1 && player.onGround) {
    player.walkPhase += step * 0.5;
    player.walking = true;
  } else {
    player.walking = false;
  }

  // bounds
  const sc = scenes[state.scene];
  const lo = (sc && sc.bounds && sc.bounds.x0) ?? 10;
  const hi = (sc && sc.bounds && sc.bounds.x1) ?? W - 10;
  if (player.x < lo) player.x = lo;
  if (player.x > hi) player.x = hi;

  // Pit death (fell off)
  if (player.y > H + 40) {
    SFX.bad();
    resetPlayer(60, 160);
    showToast("Aïe ! On reprend.");
  }
}

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// =====================================================================
// INVENTORY
// =====================================================================

function addItem(id, name, draw) {
  if (state.inv.some((it) => it.id === id)) return;
  state.inv.push({ id, name, draw });
  SFX.pickup();
  showToast(`+ ${name}`);
}
function hasItem(id) {
  return state.inv.some((it) => it.id === id);
}
function removeItem(id) {
  state.inv = state.inv.filter((it) => it.id !== id);
}

// Tiny pixel icons for items
const ITEM = {
  walkman: (cx, cy) => {
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(cx - 7, cy - 4, 14, 9);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(cx - 5, cy - 2, 4, 4);
    ctx.fillRect(cx + 1, cy - 2, 4, 4);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(cx - 6, cy + 3, 2, 1);
  },
  cassette: (cx, cy) => {
    ctx.fillStyle = PAL.pink;
    ctx.fillRect(cx - 8, cy - 5, 16, 10);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(cx - 6, cy - 3, 12, 3);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(cx - 4, cy + 1, 3, 3);
    ctx.fillRect(cx + 1, cy + 1, 3, 3);
  },
  keys: (cx, cy) => {
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(cx - 1, cy - 5, 2, 7);
    ctx.fillRect(cx, cy + 1, 4, 1);
    ctx.fillRect(cx, cy + 3, 3, 1);
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(cx - 4, cy - 6, 6, 3);
    ctx.fillStyle = PAL.gray;
    ctx.fillRect(cx - 3, cy - 5, 2, 1);
  },
  vhs: (cx, cy) => {
    ctx.fillStyle = PAL.black;
    ctx.fillRect(cx - 8, cy - 5, 16, 10);
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(cx - 5, cy - 2, 4, 3);
    ctx.fillRect(cx + 1, cy - 2, 4, 3);
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(cx - 6, cy + 2, 12, 2);
  },
  cartouche: (cx, cy) => {
    ctx.fillStyle = PAL.gray;
    ctx.fillRect(cx - 6, cy - 5, 12, 10);
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(cx - 4, cy - 3, 8, 3);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(cx - 5, cy + 2, 10, 2);
  },
  micro: (cx, cy) => {
    ctx.fillStyle = PAL.black;
    ctx.fillRect(cx - 2, cy - 5, 5, 7);
    ctx.fillStyle = PAL.metalLite;
    ctx.fillRect(cx - 1, cy - 4, 3, 4);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(cx, cy + 2, 1, 5);
  },
};

function drawInventoryOverlay() {
  // semi opaque bg
  ctx.fillStyle = "rgba(10, 4, 32, 0.86)";
  ctx.fillRect(0, 0, W, H);

  // border
  drawNeonRect(40, 36, W - 80, H - 72, PAL.pink, PAL.cyan);

  textCenter("INVENTAIRE", W / 2, 56, PAL.yellow, "12px 'Press Start 2P'");

  if (state.inv.length === 0) {
    textCenter("(vide)", W / 2, H / 2, PAL.cyan, "12px 'Press Start 2P'");
  } else {
    const cols = 4;
    const cellW = 80, cellH = 56;
    const totalW = cols * cellW;
    const startX = (W - totalW) / 2 + cellW / 2;
    state.inv.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * cellW;
      const cy = 100 + row * cellH;
      // cell box
      ctx.strokeStyle = PAL.cyan;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 28, cy - 22, 56, 44);
      it.draw(cx, cy - 2);
      textCenter(it.name, cx, cy + 18, PAL.white, "6px 'Press Start 2P'");
    });
  }
  textCenter("I pour fermer", W / 2, H - 50, PAL.cyan, "8px 'Press Start 2P'");
}

// =====================================================================
// DIALOG SYSTEM
// =====================================================================

function startDialog(lines, onEnd, choices = null) {
  state.dialog = {
    lines: lines.map((l) =>
      typeof l === "string" ? { speaker: "PAT", text: l } : l
    ),
    idx: 0,
    charIdx: 0,
    onEnd,
    choices,
    choiceIdx: 0,
  };
}

function updateDialog(dt) {
  const d = state.dialog;
  if (!d) return;
  const line = d.lines[d.idx];
  if (d.charIdx < line.text.length) {
    d.charIdx += Math.max(1, Math.floor(dt / 12));
    if (d.charIdx > line.text.length) d.charIdx = line.text.length;
    if (d.charIdx % 3 === 0) SFX.dialog();
  }

  // advance
  const advancePressed =
    input.pressed.has("Space") ||
    input.pressed.has("Enter") ||
    input.pressed.has("KeyE");
  const isLast = d.idx === d.lines.length - 1;
  const lineFinished = d.charIdx >= line.text.length;
  const hasChoices = d.choices && isLast;

  if (advancePressed) {
    if (!lineFinished) {
      d.charIdx = line.text.length;
    } else if (hasChoices) {
      const pick = d.choices[d.choiceIdx];
      const cb = d.onEnd;
      state.dialog = null;
      if (cb) cb(pick);
    } else if (!isLast) {
      d.idx++;
      d.charIdx = 0;
    } else {
      const cb = d.onEnd;
      state.dialog = null;
      if (cb) cb(null);
    }
  }

  // choice nav
  if (hasChoices && lineFinished) {
    if (input.pressed.has("ArrowUp") || input.pressed.has("KeyW")) {
      d.choiceIdx = (d.choiceIdx - 1 + d.choices.length) % d.choices.length;
      SFX.blip();
    }
    if (input.pressed.has("ArrowDown") || input.pressed.has("KeyS")) {
      d.choiceIdx = (d.choiceIdx + 1) % d.choices.length;
      SFX.blip();
    }
  }
}

function drawDialog() {
  const d = state.dialog;
  if (!d) return;
  const box = { x: 16, y: H - 90, w: W - 32, h: 78 };
  // background
  ctx.fillStyle = "rgba(10, 4, 32, 0.92)";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  drawNeonRect(box.x, box.y, box.w, box.h, PAL.cyan, PAL.pink);

  const line = d.lines[d.idx];
  ctx.font = "8px 'Press Start 2P'";
  ctx.fillStyle = PAL.pink;
  ctx.fillText(line.speaker + " :", box.x + 10, box.y + 16);
  ctx.fillStyle = PAL.white;
  const text = line.text.slice(0, d.charIdx);
  wrapText(text, box.x + 10, box.y + 30, box.w - 20, 11);

  // choices
  const isLast = d.idx === d.lines.length - 1;
  if (d.choices && isLast && d.charIdx >= line.text.length) {
    d.choices.forEach((c, i) => {
      const sel = i === d.choiceIdx;
      ctx.fillStyle = sel ? PAL.yellow : PAL.cyan;
      ctx.fillText(
        (sel ? "> " : "  ") + c.label,
        box.x + 14,
        box.y + 56 + i * 11
      );
    });
  } else if (d.charIdx >= line.text.length) {
    // blinking arrow
    if (Math.floor(state.t / 300) % 2 === 0) {
      ctx.fillStyle = PAL.yellow;
      ctx.fillText("▼", box.x + box.w - 18, box.y + box.h - 10);
    }
  }
}

function wrapText(str, x, y, maxW, lineH) {
  const words = str.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

// =====================================================================
// UI HELPERS
// =====================================================================

function showToast(text, dur = 1600) {
  state.toast = { text, t: dur };
}
function drawToast() {
  if (!state.toast) return;
  const a = Math.min(1, state.toast.t / 400);
  ctx.font = "8px 'Press Start 2P'";
  const w = ctx.measureText(state.toast.text).width + 16;
  const x = (W - w) / 2;
  ctx.fillStyle = `rgba(10,4,32,${0.85 * a})`;
  ctx.fillRect(x, 18, w, 16);
  ctx.strokeStyle = `rgba(255,58,163,${a})`;
  ctx.strokeRect(x + 0.5, 18.5, w - 1, 15);
  ctx.fillStyle = `rgba(255,227,71,${a})`;
  ctx.fillText(state.toast.text, x + 8, 30);
}

function drawNeonRect(x, y, w, h, c1, c2) {
  ctx.strokeStyle = c2;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.strokeStyle = c1;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function textCenter(str, cx, y, color, font) {
  ctx.font = font;
  ctx.fillStyle = color;
  const w = ctx.measureText(str).width;
  ctx.fillText(str, cx - w / 2, y);
}

function addScore(n, x, y) {
  state.score += n;
  state.pops.push({ x, y, vy: -0.6, t: 800, text: "+" + n });
}

function updatePops(dt) {
  for (const p of state.pops) {
    p.y += p.vy * (dt / 16.67);
    p.t -= dt;
  }
  state.pops = state.pops.filter((p) => p.t > 0);
}
function drawPops() {
  ctx.font = "6px 'Press Start 2P'";
  for (const p of state.pops) {
    const a = Math.min(1, p.t / 400);
    ctx.fillStyle = `rgba(255,227,71,${a})`;
    ctx.fillText(p.text, p.x, p.y);
  }
}

// =====================================================================
// HOTSPOTS — point and click
// =====================================================================

function hoveredHotspot() {
  const sc = scenes[state.scene];
  if (!sc || !sc.hotspots) return null;
  for (const h of sc.hotspots) {
    if (h.hidden && h.hidden()) continue;
    const x = typeof h.x === "function" ? h.x() : h.x;
    const y = typeof h.y === "function" ? h.y() : h.y;
    if (
      input.mouse.x >= x &&
      input.mouse.x <= x + h.w &&
      input.mouse.y >= y &&
      input.mouse.y <= y + h.h
    ) {
      return h;
    }
  }
  return null;
}

function clickedHotspot() {
  if (!input.click) return null;
  const sc = scenes[state.scene];
  if (!sc || !sc.hotspots) return null;
  for (const h of sc.hotspots) {
    if (h.hidden && h.hidden()) continue;
    const x = typeof h.x === "function" ? h.x() : h.x;
    const y = typeof h.y === "function" ? h.y() : h.y;
    if (
      input.click.x >= x &&
      input.click.x <= x + h.w &&
      input.click.y >= y &&
      input.click.y <= y + h.h
    ) {
      return h;
    }
  }
  return null;
}

function tryInteractWith(h) {
  if (!h) return;
  // anchor x to walk to
  const anchorX = h.anchorX ?? h.x + h.w / 2;
  const dist = Math.abs(player.x - anchorX);
  const reach = h.reach ?? 28;
  if (dist <= reach) {
    h.onClick();
    SFX.blip();
  } else {
    player.walkTo = anchorX;
    player.walkArrive = () => h.onClick();
  }
}

// =====================================================================
// TRANSITIONS
// =====================================================================

function goToScene(name) {
  state.transition = {
    t: 0,
    dur: 500,
    midpoint: () => {
      state.scene = name;
      const sc = scenes[name];
      if (sc && sc.init) sc.init();
      SCENE_NAME_EL.textContent = sc.title || name;
    },
    onDone: () => {
      const sc = scenes[name];
      if (sc && sc.onShown) sc.onShown();
    },
  };
}

function updateTransition(dt) {
  if (!state.transition) return;
  state.transition.t += dt;
  if (state.transition.t > state.transition.dur / 2 && state.transition.midpoint) {
    state.transition.midpoint();
    state.transition.midpoint = null;
  }
  if (state.transition.t >= state.transition.dur) {
    const done = state.transition.onDone;
    state.transition = null;
    if (done) done();
  }
}
function drawTransition() {
  if (!state.transition) return;
  const t = state.transition.t / state.transition.dur;
  // wipe vertical bars
  const bars = 12;
  const bw = W / bars;
  for (let i = 0; i < bars; i++) {
    const phase = i / bars;
    let h;
    if (t < 0.5) {
      h = Math.max(0, Math.min(1, (t * 2 - phase) * 2.4)) * H;
    } else {
      h = Math.max(0, Math.min(1, (1 - (t - 0.5) * 2 - phase) * 2.4)) * H;
    }
    ctx.fillStyle = i % 2 === 0 ? PAL.pink : PAL.cyan;
    ctx.fillRect(i * bw, (H - h) / 2, bw, h);
  }
}

// =====================================================================
// BACKGROUND HELPERS
// =====================================================================

function drawSunsetSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1b0a4a");
  grad.addColorStop(0.4, "#5a1a7a");
  grad.addColorStop(0.7, "#ff3aa3");
  grad.addColorStop(1, "#ffb04a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // sun
  ctx.fillStyle = "#ffe347";
  ctx.beginPath();
  ctx.arc(W / 2, 150, 50, 0, Math.PI, true);
  ctx.fill();
  // sun stripes
  ctx.fillStyle = "#5a1a7a";
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(W / 2 - 55, 110 + i * 8, 110, 2);
  }
  // grid floor
  ctx.strokeStyle = "#ff3aa3";
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const yy = 170 + i * (100 / 12);
    ctx.globalAlpha = 1 - i / 14;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(W, yy);
    ctx.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2, 170);
    ctx.lineTo(W / 2 + i * 80, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawStars(seed = 1, count = 40) {
  for (let i = 0; i < count; i++) {
    const x = ((i * 73 + seed * 13) % W);
    const y = ((i * 41 + seed * 7) % 100);
    const tw = Math.sin(state.t / 400 + i) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.5})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

// =====================================================================
// SCENES
// =====================================================================

const scenes = {};

// ------------------- TITLE -------------------
scenes.TITLE = {
  title: "INSEREZ UNE PIECE",
  init() {
    resetPlayer(W / 2, 220);
  },
  update(dt) {
    if (input.pressed.has("Space") || input.pressed.has("Enter")) {
      SFX.blip();
      goToScene("INTRO");
    }
  },
  render() {
    drawSunsetSky();
    drawStars(2, 60);
    // title
    const blink = Math.sin(state.t / 200) * 4;
    textCenter(
      "PAT HELLIO'S",
      W / 2,
      62 + blink * 0.2,
      PAL.cyan,
      "20px 'Press Start 2P'"
    );
    textCenter(
      "EXCITING 80s ADVENTURES",
      W / 2,
      90 + blink * 0.2,
      PAL.pink,
      "12px 'Press Start 2P'"
    );
    if (Math.floor(state.t / 400) % 2 === 0) {
      textCenter(
        "APPUYEZ SUR ESPACE",
        W / 2,
        200,
        PAL.yellow,
        "8px 'Press Start 2P'"
      );
    }
    textCenter(
      "(c) 1986 MEGA-LEVEL ENTERTAINMENT",
      W / 2,
      H - 12,
      PAL.cyan,
      "6px 'Press Start 2P'"
    );
  },
};

// ------------------- INTRO (cutscene) -------------------
scenes.INTRO = {
  title: "PROLOGUE",
  init() {
    resetPlayer(W / 2, 200);
  },
  onShown() {
    startDialog(
      [
        { speaker: "NARRATEUR", text: "Paris, 1985. Pat Hellio se reveille." },
        { speaker: "NARRATEUR", text: "Sa redaction l'attend pour LA chronique du siecle." },
        { speaker: "PAT", text: "Bon. Mon Walkman, ma cassette de notes, et mes cles. Ensuite : le studio." },
        { speaker: "PAT", text: "Niveau 1 : retrouver mon barda. Allez, en piste !" },
      ],
      () => goToScene("APPART")
    );
  },
  update(dt) {},
  render() {
    drawSunsetSky();
    drawStars(3, 50);
    drawPat(W / 2, 200, 1, 0);
  },
};

// ------------------- SCENE 1 : APPART (point and click) -------------------
scenes.APPART = {
  title: "L'APPART - 1985",
  bounds: { x0: 20, x1: 460 },
  init() {
    resetPlayer(60, 200);
    state.flags.appart_intro = state.flags.appart_intro || false;
    if (!state.flags.appart_intro) {
      state.flags.appart_intro = true;
      showToast("Clic ou fleches pour explorer");
    }
  },
  update(dt) {
    updatePlayerSimple(dt);
    // try door condition
    if (
      hasItem("walkman") &&
      hasItem("cassette") &&
      hasItem("keys") &&
      !state.flags.appart_ready
    ) {
      state.flags.appart_ready = true;
      showToast("La porte va pouvoir s'ouvrir !");
    }
  },
  render() {
    // wall
    ctx.fillStyle = "#3a1a5a";
    ctx.fillRect(0, 0, W, 200);
    // floor (wood)
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(0, 200, W, H - 200);
    for (let i = 0; i < W; i += 32) {
      ctx.fillStyle = "#5a3a1a";
      ctx.fillRect(i, 200, 1, H - 200);
    }
    // wallpaper pattern (geometric 80s)
    ctx.fillStyle = "#5a2a7a";
    for (let y = 10; y < 200; y += 24) {
      for (let x = 10; x < W; x += 24) {
        ctx.fillRect(x, y, 6, 2);
        ctx.fillRect(x + 2, y - 2, 2, 6);
      }
    }

    // window left
    ctx.fillStyle = "#1a0a3a";
    ctx.fillRect(40, 30, 80, 60);
    ctx.fillStyle = PAL.metalLite;
    ctx.fillRect(36, 26, 88, 4);
    ctx.fillRect(36, 90, 88, 4);
    ctx.fillRect(36, 26, 4, 68);
    ctx.fillRect(120, 26, 4, 68);
    // pixel city skyline through window
    ctx.fillStyle = PAL.purple;
    for (let i = 0; i < 8; i++) {
      const h = 10 + ((i * 13) % 20);
      ctx.fillRect(44 + i * 10, 90 - h, 8, h);
    }
    drawStars(7, 14);
    // moon
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(95, 45, 8, 8);

    // poster Megaman-ish
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(160, 30, 50, 70);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(164, 34, 42, 8);
    ctx.fillStyle = PAL.black;
    ctx.font = "5px 'Press Start 2P'";
    ctx.fillText("MEGA HERO", 167, 40);
    // little hero
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(178, 50, 14, 18);
    ctx.fillStyle = PAL.skin;
    ctx.fillRect(180, 46, 10, 6);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(181, 48, 2, 2);
    ctx.fillRect(186, 48, 2, 2);
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(176, 60, 4, 4);

    // shelf with VHS
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(240, 80, 90, 4);
    ctx.fillRect(240, 110, 90, 4);
    // VHS tapes
    const tapes = ["#ff3aa3", "#29e7ff", "#9b3aff", "#5cff7c", "#ffe347", "#ff5e5e"];
    tapes.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(244 + i * 14, 56, 12, 24);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(245 + i * 14, 62, 10, 3);
    });

    // TV CRT
    ctx.fillStyle = PAL.black;
    ctx.fillRect(340, 130, 80, 60);
    ctx.fillStyle = "#202028";
    ctx.fillRect(346, 134, 68, 48);
    // tv image
    if (Math.floor(state.t / 250) % 2 === 0) {
      ctx.fillStyle = PAL.cyan;
      ctx.fillRect(348, 136, 64, 44);
      ctx.fillStyle = PAL.pink;
      ctx.fillText("PUB", 365, 162);
    } else {
      ctx.fillStyle = "#1a1a3a";
      ctx.fillRect(348, 136, 64, 44);
      ctx.fillStyle = PAL.green;
      ctx.fillText("LIVE", 363, 162);
    }
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(338, 188, 84, 4);

    // NES console on a small commode
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(20, 175, 60, 25);
    ctx.fillStyle = "#dadada";
    ctx.fillRect(24, 165, 52, 12);
    ctx.fillStyle = PAL.red;
    ctx.fillRect(28, 170, 4, 2);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(34, 170, 36, 4);

    // walkman on the floor (only if not picked)
    if (!hasItem("walkman")) {
      const wx = 200, wy = 215;
      ctx.fillStyle = PAL.metal;
      ctx.fillRect(wx, wy, 18, 12);
      ctx.fillStyle = PAL.black;
      ctx.fillRect(wx + 3, wy + 2, 5, 5);
      ctx.fillRect(wx + 10, wy + 2, 5, 5);
      ctx.fillStyle = PAL.red;
      ctx.fillRect(wx + 2, wy + 9, 2, 1);
    }

    // cassette near the TV
    if (!hasItem("cassette")) {
      const cx = 330, cy = 218;
      ctx.fillStyle = PAL.pink;
      ctx.fillRect(cx, cy, 18, 11);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(cx + 2, cy + 2, 14, 3);
    }

    // keys on top of the NES
    if (!hasItem("keys")) {
      const kx = 50, ky = 162;
      ctx.fillStyle = PAL.yellow;
      ctx.fillRect(kx, ky, 2, 6);
      ctx.fillRect(kx - 3, ky - 2, 8, 3);
      ctx.fillRect(kx + 1, ky + 5, 3, 1);
    }

    // door right
    ctx.fillStyle = PAL.brick;
    ctx.fillRect(420, 110, 40, 90);
    ctx.fillStyle = PAL.brickDark;
    ctx.fillRect(424, 114, 32, 82);
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(450, 152, 2, 4);
    // EXIT sign blinking when ready
    if (state.flags.appart_ready && Math.floor(state.t / 300) % 2 === 0) {
      ctx.fillStyle = PAL.green;
      ctx.font = "6px 'Press Start 2P'";
      ctx.fillText("SORTIE", 422, 106);
    }

    // hover highlight
    const hov = hoveredHotspot();
    if (hov) {
      ctx.strokeStyle = PAL.yellow;
      ctx.lineWidth = 1;
      const x = typeof hov.x === "function" ? hov.x() : hov.x;
      const y = typeof hov.y === "function" ? hov.y() : hov.y;
      ctx.strokeRect(x + 0.5, y + 0.5, hov.w - 1, hov.h - 1);
      // label
      ctx.font = "6px 'Press Start 2P'";
      ctx.fillStyle = PAL.black;
      const lw = ctx.measureText(hov.label).width + 6;
      ctx.fillRect(input.mouse.x - lw / 2, input.mouse.y - 14, lw, 9);
      ctx.fillStyle = PAL.yellow;
      ctx.fillText(hov.label, input.mouse.x - lw / 2 + 3, input.mouse.y - 7);
    }

    drawPat(player.x, player.y, player.facing, player.walkPhase);
  },
  hotspots: [
    {
      label: "Walkman",
      x: 198, y: 213, w: 22, h: 16,
      anchorX: 210,
      hidden: () => hasItem("walkman"),
      onClick: () => {
        addItem("walkman", "Walkman", ITEM.walkman);
        addScore(100, 210, 210);
      },
    },
    {
      label: "Cassette",
      x: 328, y: 216, w: 22, h: 14,
      anchorX: 340,
      hidden: () => hasItem("cassette"),
      onClick: () => {
        addItem("cassette", "Cassette de notes", ITEM.cassette);
        addScore(100, 340, 214);
      },
    },
    {
      label: "Cles",
      x: 44, y: 158, w: 16, h: 12,
      anchorX: 56,
      hidden: () => hasItem("keys"),
      onClick: () => {
        addItem("keys", "Cles", ITEM.keys);
        addScore(100, 50, 156);
      },
    },
    {
      label: "Etagere VHS",
      x: 240, y: 50, w: 90, h: 60,
      anchorX: 285,
      onClick: () => {
        startDialog([
          "Mon mur de VHS. Que des perles : Megaman, Castlevania, Bubble Bobble...",
          "Un jour je ferai une retro complete la-dessus. Niveau bonus garanti.",
        ]);
      },
    },
    {
      label: "Console NES",
      x: 20, y: 165, w: 60, h: 25,
      anchorX: 50,
      onClick: () => {
        startDialog([
          "La NES. Toujours branchee. Toujours prete.",
          "Si je m'assois je suis bon pour 4 heures de Zelda, donc... NON.",
        ]);
      },
    },
    {
      label: "Television",
      x: 338, y: 130, w: 84, h: 62,
      anchorX: 380,
      onClick: () => {
        startDialog([
          "La tele tourne en boucle sur le bouquet jeunesse.",
          "Un jour, j'animerai mon propre creneau ici. Promis.",
        ]);
      },
    },
    {
      label: "Poster Mega Hero",
      x: 158, y: 28, w: 56, h: 72,
      anchorX: 186,
      onClick: () => {
        startDialog([
          "Mega Hero. Mon idole de plateforme.",
          "Sauter, tirer, recommencer. Toute une philosophie.",
        ]);
      },
    },
    {
      label: "Fenetre",
      x: 36, y: 26, w: 88, h: 68,
      anchorX: 80,
      onClick: () => {
        startDialog([
          "Paris la nuit. Les neons des arcades qui clignotent au loin.",
          "On a quand meme bien fait de naitre dans cette decennie.",
        ]);
      },
    },
    {
      label: "Porte",
      x: 420, y: 110, w: 40, h: 90,
      anchorX: 432,
      reach: 30,
      onClick: () => {
        if (state.flags.appart_ready) {
          SFX.door();
          goToScene("RUE");
        } else {
          const missing = [];
          if (!hasItem("walkman")) missing.push("Walkman");
          if (!hasItem("cassette")) missing.push("Cassette");
          if (!hasItem("keys")) missing.push("Cles");
          startDialog([
            "Je ne peux pas sortir sans mon barda.",
            "Il me manque : " + missing.join(", ") + ".",
          ]);
        }
      },
    },
  ],
};

// ------------------- SCENE 2 : RUE (platformer) -------------------
scenes.RUE = {
  title: "LA RUE - 1988",
  bounds: { x0: 0, x1: 1800 },
  init() {
    resetPlayer(40, 100);
    state.flags.rue_coins = 0;
    state.flags.rue_total_coins = 5;
    this.coins = [
      { x: 320, y: 175, taken: false }, // bonus dans le 1er trou
      { x: 460, y: 130, taken: false }, // au-dessus d'une plateforme basse
      { x: 740, y: 110, taken: false }, // un peu plus haut
      { x: 1050, y: 125, taken: false }, // chemin du milieu
      { x: 1470, y: 75, taken: false }, // le plus dur, fin de niveau
    ];
    this.platforms = [
      // ground segments (with gaps = pits)
      { x: -40, y: 220, w: 280, h: 60 },
      { x: 340, y: 220, w: 200, h: 60 },
      { x: 620, y: 220, w: 240, h: 60 },
      { x: 940, y: 220, w: 200, h: 60 },
      { x: 1240, y: 220, w: 260, h: 60 },
      { x: 1580, y: 220, w: 280, h: 60 },
      // Stepping stones LARGES au ras du sol : le chemin "facile"
      // Gap 1 (240->340, 100 px) : 2 stones
      { x: 248, y: 205, w: 42, h: 10 },
      { x: 300, y: 205, w: 42, h: 10 },
      // Gap 2 (540->620, 80 px) : 1 stone wide
      { x: 548, y: 205, w: 72, h: 10 },
      // Gap 3 (860->940, 80 px) : 1 stone wide
      { x: 868, y: 205, w: 72, h: 10 },
      // Gap 4 (1140->1240, 100 px) : 2 stones
      { x: 1148, y: 205, w: 42, h: 10 },
      { x: 1200, y: 205, w: 42, h: 10 },
      // Gap 5 (1500->1580, 80 px) : 1 stone wide
      { x: 1508, y: 205, w: 72, h: 10 },
      // BONUS : plateformes hautes pour les cartouches (chemin optionnel)
      { x: 430, y: 165, w: 60, h: 10 },
      { x: 710, y: 150, w: 60, h: 10 },
      { x: 1030, y: 165, w: 60, h: 10 },
      { x: 1380, y: 160, w: 60, h: 10 },
      { x: 1450, y: 125, w: 60, h: 10 },
    ];
    this.cameraX = 0;
    if (!state.flags.rue_intro) {
      state.flags.rue_intro = true;
      showToast("Espace pour sauter !");
    }
  },
  update(dt) {
    updatePlayerPlatform(dt, this.platforms);
    // camera follow
    this.cameraX = Math.max(0, Math.min(player.x - W / 2 + 40, 1800 - W));
    // coin collection
    for (const c of this.coins) {
      if (c.taken) continue;
      if (
        Math.abs(player.x - (c.x + 8)) < 14 &&
        Math.abs(player.y + 14 - c.y) < 18
      ) {
        c.taken = true;
        state.flags.rue_coins++;
        addScore(50, c.x, c.y);
        SFX.pickup();
      }
    }
    // reach the door
    if (player.x > 1740 && player.y < 210) {
      if (state.flags.rue_coins >= 3) {
        addScore(state.flags.rue_coins * 20, player.x, player.y);
        SFX.door();
        goToScene("STUDIO");
      } else if (!state.flags.rue_warned) {
        state.flags.rue_warned = true;
        showToast("Encore quelques cartouches avant la redac' !");
      }
    }
  },
  render() {
    // sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a0a3a");
    grad.addColorStop(0.5, "#5a1a7a");
    grad.addColorStop(1, "#ff3aa3");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    drawStars(5, 30);

    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // far parallax buildings (move at 0.3x)
    const parallaxShift = this.cameraX * 0.3;
    const period = 70;
    const periodIdx = Math.floor(parallaxShift / period);
    const tilesAcross = Math.ceil(W / period) + 2;
    for (let i = -1; i < tilesAcross; i++) {
      const screenX = i * period - (parallaxShift - periodIdx * period);
      const worldX = screenX + this.cameraX;
      const buildingIdx = i + periodIdx;
      const bh = 60 + (((buildingIdx * 17) % 50) + 50) % 50;
      ctx.fillStyle = "#2a1050";
      ctx.fillRect(worldX, 220 - bh, 56, bh);
      // windows (deterministic on/off via hash)
      for (let wy = 220 - bh + 8; wy < 220; wy += 10) {
        for (let dx = 4; dx < 52; dx += 8) {
          const h = (buildingIdx * 31 + wy * 7 + dx * 11) % 7;
          ctx.fillStyle = h === 0 ? PAL.yellow : "#1a0a30";
          ctx.fillRect(worldX + dx, wy, 3, 4);
        }
      }
    }

    // ground & platforms
    for (const p of this.platforms) {
      if (p.y >= 220) {
        ctx.fillStyle = PAL.brick;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // sidewalk top
        ctx.fillStyle = PAL.metalLite;
        ctx.fillRect(p.x, p.y, p.w, 3);
      } else {
        // a TV / arcade as a platform
        ctx.fillStyle = PAL.gray;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = PAL.cyan;
        ctx.fillRect(p.x + 4, p.y + 2, p.w - 8, 6);
        ctx.fillStyle = PAL.black;
        if (Math.floor(state.t / 200) % 2 === 0) {
          for (let i = 0; i < p.w; i += 4) ctx.fillRect(p.x + 4 + i, p.y + 3, 2, 1);
        }
      }
    }

    // building at the end (rédaction)
    ctx.fillStyle = "#4a2a6a";
    ctx.fillRect(1670, 60, 160, 160);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(1700, 70, 100, 18);
    ctx.fillStyle = PAL.black;
    ctx.font = "8px 'Press Start 2P'";
    ctx.fillText("LEVEL ONE", 1708, 84);
    // door
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(1740, 160, 24, 40);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(1758, 178, 2, 3);

    // coins
    for (const c of this.coins) {
      if (c.taken) continue;
      const bob = Math.sin(state.t / 200 + c.x) * 2;
      ITEM.cartouche(c.x + 6, c.y + bob);
    }

    drawPat(player.x, player.y, player.facing, player.walkPhase, !player.onGround);

    ctx.restore();

    // HUD overlay coins
    ctx.fillStyle = PAL.yellow;
    ctx.font = "8px 'Press Start 2P'";
    ctx.fillText(
      `CARTOUCHES ${state.flags.rue_coins}/${state.flags.rue_total_coins}`,
      10,
      14
    );
  },
  hotspots: [],
};

// ------------------- SCENE 3 : STUDIO TV -------------------
scenes.STUDIO = {
  title: "LE STUDIO - 1995",
  bounds: { x0: 20, x1: 460 },
  init() {
    resetPlayer(60, 200);
    if (!state.flags.studio_intro) {
      state.flags.studio_intro = true;
      addItem("micro", "Micro", ITEM.micro);
      showToast("Tu as recupere ton micro !");
    }
  },
  update(dt) {
    updatePlayerSimple(dt);
  },
  render() {
    // studio wall
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, "#1a0a3a");
    grad.addColorStop(1, "#3a1a5a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 200);
    // floor checker
    for (let y = 200; y < H; y += 10) {
      for (let x = 0; x < W; x += 20) {
        const c = ((x / 20 + (y - 200) / 10) % 2) | 0;
        ctx.fillStyle = c === 0 ? "#2a2a3a" : "#3a3a4a";
        ctx.fillRect(x, y, 20, 10);
      }
    }
    // big logo on wall
    ctx.fillStyle = PAL.pink;
    ctx.fillRect(60, 24, 120, 32);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(64, 28, 112, 24);
    ctx.fillStyle = PAL.black;
    ctx.font = "10px 'Press Start 2P'";
    ctx.fillText("STOP OU ENCORE", 70, 44);

    // stage lights
    for (let i = 0; i < 5; i++) {
      const lx = 50 + i * 90;
      ctx.fillStyle = PAL.metal;
      ctx.fillRect(lx, 0, 14, 12);
      ctx.fillStyle = i % 2 === 0 ? PAL.yellow : PAL.cyan;
      ctx.fillRect(lx + 2, 12, 10, 2);
      // beam
      ctx.fillStyle = `rgba(255,227,71,${0.04 + 0.02 * Math.sin(state.t / 300 + i)})`;
      ctx.beginPath();
      ctx.moveTo(lx + 7, 14);
      ctx.lineTo(lx - 30, 200);
      ctx.lineTo(lx + 44, 200);
      ctx.closePath();
      ctx.fill();
    }

    // arcade cabinet (left)
    ctx.fillStyle = PAL.gray;
    ctx.fillRect(30, 130, 50, 80);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(36, 140, 38, 28);
    ctx.fillStyle = PAL.green;
    if (Math.floor(state.t / 200) % 2 === 0) {
      ctx.fillRect(38, 142, 34, 24);
      ctx.fillStyle = PAL.black;
      ctx.font = "5px 'Press Start 2P'";
      ctx.fillText("HI 999", 42, 155);
    }
    ctx.fillStyle = PAL.red;
    ctx.fillRect(40, 174, 6, 6);
    ctx.fillStyle = PAL.yellow;
    ctx.fillRect(54, 174, 6, 6);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(68, 174, 6, 6);

    // canape orange (right)
    ctx.fillStyle = "#ff8a3a";
    ctx.fillRect(350, 180, 100, 30);
    ctx.fillRect(340, 160, 20, 50);
    ctx.fillRect(440, 160, 20, 50);
    ctx.fillStyle = "#cc6028";
    ctx.fillRect(350, 200, 100, 4);

    // animateur NPC (sur le canapé)
    const npcX = 400, npcY = 162;
    drawAnimateur(npcX, npcY);

    // VHS finale sur l'arcade (si pas pris)
    if (!hasItem("vhs")) {
      const vx = 50, vy = 122;
      ctx.fillStyle = PAL.black;
      ctx.fillRect(vx, vy, 18, 8);
      ctx.fillStyle = PAL.yellow;
      ctx.fillRect(vx + 1, vy + 1, 16, 2);
      if (Math.floor(state.t / 250) % 2 === 0) {
        ctx.fillStyle = PAL.yellow;
        ctx.font = "5px 'Press Start 2P'";
        ctx.fillText("! VHS !", vx - 4, vy - 4);
      }
    }

    // hover highlight
    const hov = hoveredHotspot();
    if (hov) {
      ctx.strokeStyle = PAL.yellow;
      ctx.lineWidth = 1;
      const x = typeof hov.x === "function" ? hov.x() : hov.x;
      const y = typeof hov.y === "function" ? hov.y() : hov.y;
      ctx.strokeRect(x + 0.5, y + 0.5, hov.w - 1, hov.h - 1);
      ctx.font = "6px 'Press Start 2P'";
      ctx.fillStyle = PAL.black;
      const lw = ctx.measureText(hov.label).width + 6;
      ctx.fillRect(input.mouse.x - lw / 2, input.mouse.y - 14, lw, 9);
      ctx.fillStyle = PAL.yellow;
      ctx.fillText(hov.label, input.mouse.x - lw / 2 + 3, input.mouse.y - 7);
    }

    drawPat(player.x, player.y, player.facing, player.walkPhase);
  },
  hotspots: [
    {
      label: "VHS finale",
      x: 46, y: 118, w: 30, h: 18,
      anchorX: 70,
      hidden: () => hasItem("vhs"),
      onClick: () => {
        addItem("vhs", "VHS finale", ITEM.vhs);
        addScore(200, 70, 120);
        showToast("La VHS du siecle est a toi !");
      },
    },
    {
      label: "Arcade",
      x: 30, y: 130, w: 50, h: 80,
      anchorX: 55,
      onClick: () => {
        startDialog([
          "Une borne d'arcade Final Smash. Toujours quelqu'un sur le score.",
          "Aujourd'hui c'est pas le moment. Faut bosser.",
        ]);
      },
    },
    {
      label: "Logo Stop ou Encore",
      x: 60, y: 24, w: 120, h: 32,
      anchorX: 120,
      onClick: () => {
        startDialog([
          "L'emission qui m'a fait connaitre. Stop ou Encore.",
          "Bon, on continue.",
        ]);
      },
    },
    {
      label: "Animateur",
      x: 380, y: 130, w: 50, h: 75,
      anchorX: 380,
      onClick: () => {
        if (!hasItem("vhs")) {
          startDialog([
            { speaker: "ANIMATEUR", text: "Pat ! T'as la VHS du siecle ?" },
            { speaker: "PAT", text: "Pas encore. Elle traine quelque part par ici." },
          ]);
          return;
        }
        startDialog(
          [
            { speaker: "ANIMATEUR", text: "Bon Pat, on est en direct dans 30 secondes." },
            { speaker: "ANIMATEUR", text: "Stop ou Encore : c'est quoi ton verdict sur le retrogaming ?" },
            { speaker: "PAT", text: "..." },
          ],
          (pick) => {
            if (!pick) return;
            state.flags.ending = pick.id;
            goToScene("FIN");
          },
          [
            { id: "encore", label: "ENCORE ! On reedite, on celebre, on transmet." },
            { id: "stop", label: "STOP. On passe a autre chose, faut innover." },
            { id: "bonus", label: "NIVEAU BONUS : on fait LES DEUX." },
          ]
        );
      },
    },
    {
      label: "Canape",
      x: 340, y: 160, w: 120, h: 50,
      anchorX: 350,
      onClick: () => {
        startDialog([
          "Le mythique canape orange du plateau.",
          "Combien de chroniqueurs s'y sont assis... J'en pleure rien que d'y penser.",
        ]);
      },
    },
  ],
};

function drawAnimateur(x, y) {
  // body (yellow blazer)
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(x - 8, y + 10, 16, 16);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(x - 1, y + 12, 2, 14);
  // legs (black pants)
  ctx.fillStyle = PAL.black;
  ctx.fillRect(x - 6, y + 26, 5, 12);
  ctx.fillRect(x + 1, y + 26, 5, 12);
  // head
  ctx.fillStyle = PAL.skin;
  ctx.fillRect(x - 5, y, 10, 10);
  // hair (slicked back)
  ctx.fillStyle = "#2a1a08";
  ctx.fillRect(x - 6, y - 2, 12, 4);
  ctx.fillRect(x - 6, y + 2, 2, 4);
  ctx.fillRect(x + 4, y + 2, 2, 4);
  // sunglasses
  ctx.fillStyle = PAL.black;
  ctx.fillRect(x - 4, y + 4, 8, 2);
  // mouth (sourire pro)
  ctx.fillStyle = "#5a2020";
  ctx.fillRect(x - 2, y + 8, 4, 1);
}

// ------------------- FIN (ending) -------------------
scenes.FIN = {
  title: "GENERIQUE DE FIN",
  init() {
    SFX.win();
  },
  update(dt) {
    if (input.pressed.has("Space") || input.pressed.has("Enter")) {
      // restart
      state.inv = [];
      state.score = 0;
      state.flags = {};
      goToScene("TITLE");
    }
  },
  render() {
    drawSunsetSky();
    drawStars(9, 80);

    textCenter("EXCELLENT !", W / 2, 50, PAL.yellow, "20px 'Press Start 2P'");

    ctx.font = "8px 'Press Start 2P'";
    const endingId = state.flags.ending || "encore";
    let endingLines;
    if (endingId === "encore") {
      endingLines = [
        "Pat repart avec la VHS du siecle.",
        "Une retro grand format pour la nouvelle saison.",
        "Le public en redemande. ENCORE.",
      ];
    } else if (endingId === "stop") {
      endingLines = [
        "Pat range la VHS. Cap sur la suivante.",
        "Il invente une nouvelle emission. Plus moderne. Plus fraiche.",
        "Le rideau tombe sur une epoque, le suivant se leve.",
      ];
    } else {
      endingLines = [
        "Pat sort SA chronique double-niveau.",
        "Une retro qui regarde l'avenir.",
        "Le retrogaming devient un classique en vie.",
      ];
    }
    endingLines.forEach((l, i) => textCenter(l, W / 2, 100 + i * 14, PAL.cyan, "8px 'Press Start 2P'"));

    textCenter(
      "SCORE FINAL : " + String(state.score).padStart(4, "0"),
      W / 2,
      180,
      PAL.pink,
      "12px 'Press Start 2P'"
    );

    if (Math.floor(state.t / 400) % 2 === 0) {
      textCenter("ESPACE POUR REJOUER", W / 2, 240, PAL.yellow, "8px 'Press Start 2P'");
    }
  },
};

// =====================================================================
// MAIN LOOP
// =====================================================================

let lastT = performance.now();
function loop(t) {
  const dt = Math.min(50, t - lastT);
  lastT = t;
  update(dt);
  render();
  // reset transient input
  input.pressed.clear();
  input.click = null;
  requestAnimationFrame(loop);
}

function update(dt) {
  state.t += dt;
  state.flicker = (state.flicker + dt) % 1000;

  // Global keys
  if (input.pressed.has("Escape")) {
    state.paused = !state.paused;
    SFX.blip();
  }
  if (input.pressed.has("KeyI")) {
    state.showInv = !state.showInv;
    SFX.blip();
  }

  if (state.paused || state.showInv) return;

  // Dialog blocks scene update
  if (state.dialog) {
    updateDialog(dt);
    return;
  }

  // Transition blocks input but still advances
  updateTransition(dt);
  if (state.transition && state.transition.t < state.transition.dur / 2) {
    return;
  }

  // Run current scene
  const sc = scenes[state.scene];
  if (sc && sc.update) sc.update(dt);

  // Click-on-hotspot
  if (input.click && sc && sc.hotspots) {
    const h = clickedHotspot();
    if (h) {
      tryInteractWith(h);
    } else {
      // walk to click X
      if (state.scene === "APPART" || state.scene === "STUDIO") {
        player.walkTo = Math.max(20, Math.min(W - 20, input.click.x));
        player.walkArrive = null;
      }
    }
  }
  // E to interact with nearest hotspot
  if (input.pressed.has("KeyE") && sc && sc.hotspots) {
    let nearest = null;
    let bestD = Infinity;
    for (const h of sc.hotspots) {
      if (h.hidden && h.hidden()) continue;
      const ax = h.anchorX ?? h.x + h.w / 2;
      const d = Math.abs(player.x - ax);
      if (d < bestD) {
        bestD = d;
        nearest = h;
      }
    }
    if (nearest && bestD < (nearest.reach ?? 28)) {
      nearest.onClick();
      SFX.blip();
    }
  }

  updatePops(dt);
  if (state.toast) {
    state.toast.t -= dt;
    if (state.toast.t <= 0) state.toast = null;
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  const sc = scenes[state.scene];
  if (sc && sc.render) sc.render();

  drawPops();
  // Wipe goes between the scene and the UI so dialogs/toasts stay on top
  drawTransition();
  drawToast();
  if (state.dialog) drawDialog();
  if (state.showInv) drawInventoryOverlay();
  if (state.paused && !state.showInv) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    textCenter("PAUSE", W / 2, H / 2, PAL.yellow, "20px 'Press Start 2P'");
    textCenter("ECHAP POUR REPRENDRE", W / 2, H / 2 + 20, PAL.cyan, "8px 'Press Start 2P'");
  }

  // CRT flicker line
  const fy = (state.flicker / 1000) * H;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, fy, W, 2);

  // update HUD
  SCORE_EL.textContent = String(state.score).padStart(4, "0");
  if (sc && sc.title) SCENE_NAME_EL.textContent = sc.title;
}

// boot
scenes.TITLE.init();
SCENE_NAME_EL.textContent = scenes.TITLE.title;
requestAnimationFrame((t) => {
  lastT = t;
  loop(t);
});
