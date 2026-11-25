import { Stage } from './toon/stage.js';
import { WORLDS } from './toon/worlds.js';

/* ==========================================================================
   The cockpit: windows on the inside of a curved wall (a CSS 3D drum).
   Markup: .cockpit > .cockpit__track > .window[data-world]  (+ optional dots)
   - 9 slots around the drum = 3 copies of the windows → it never runs out.
     Only the originals render WebGL; copies mirror their pixels (2D canvas).
   - With { auto: ms } it glides to the next window on its own, looping forever
     (a calm 1.4s ease-in-out). It holds while the cursor is on a window's
     button or the wall has focus; dragging, swiping, keys or clicks restart its
     wait. setAuto(false) parks it (e.g. while it's off screen).
     Drag, a sideways wheel/trackpad swipe, arrow keys, dots or the side arrow
     cursor move it.
     Timings are the reference's: button moves 1000ms easeOutCubic, the snap
     after a drag or swipe 750ms easeOutCubic.
   - arrive() plays the entrance drift (the wall slides into place, 2.5s).
   - The whole wall leans a little toward the mouse (parallax).
   ========================================================================== */
export function mountCockpit(cockpit, { dots, start = 0, auto = 0 } = {}) {
  const track = cockpit.querySelector('.cockpit__track');
  track.classList.add('cockpit__drum');
  const originals = [...track.querySelectorAll('.window')];
  const N = originals.length, COPIES = Math.max(3, Math.ceil(9 / N)), SLOTS = N * COPIES;
  const STEP = 360 / SLOTS;                       // degrees between windows

  const stages = originals.map((win) => {
    const s = new Stage(win.querySelector('canvas'), { dpr: 1.5 });
    s.setWorld(WORLDS[win.dataset.world]({ pod: false }));   // you are inside the pod here
    return s;
  });

  // copies, each mirroring its original's canvas
  const mirrors = [];
  for (let c = 1; c < COPIES; c++) originals.forEach((w, i) => {
    const cp = w.cloneNode(true);
    cp.dataset.copy = ''; cp.setAttribute('aria-hidden', 'true');
    cp.querySelectorAll('a, button').forEach((el) => { el.tabIndex = -1; });
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    cp.querySelector('canvas').replaceWith(cv);
    mirrors.push({ cv, ctx: cv.getContext('2d'), i });
    track.appendChild(cp);
  });
  stages.forEach((s, i) => {
    const prev = s.onFrame;
    s.onFrame = (st) => {
      prev?.(st);
      for (const m of mirrors) if (m.i === i) {
        if (m.cv.width !== st.canvas.width || m.cv.height !== st.canvas.height) { m.cv.width = st.canvas.width; m.cv.height = st.canvas.height; }
        m.ctx.drawImage(st.canvas, 0, 0);
      }
    };
  });
  const slots = [...track.querySelectorAll('.window')];     // slot k shows window k % N
  slots.forEach((w, k) => w.style.setProperty('--a', `${k * STEP}deg`));

  if (dots) originals.forEach((win, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', win.querySelector('h3')?.textContent || `Window ${i + 1}`);
    b.addEventListener('click', () => go(i));
    dots.appendChild(b);
  });

  // the side arrow cursor (like the reference)
  const cursor = document.createElement('div');
  cursor.className = 'cockpit__cursor'; cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i></i><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></b>';
  cockpit.appendChild(cursor);

  // drum geometry from the viewport: window width, radius, perspective
  const layout = () => {
    const vw = cockpit.clientWidth, vh = cockpit.clientHeight || innerHeight;
    const W = Math.min(vw * (vw < 700 ? 0.84 : 0.5), 900, vh * 0.98);
    const pitch = W * 1.1;
    const R = pitch / (2 * Math.sin((STEP * Math.PI) / 360));
    cockpit.style.setProperty('--W', `${W}px`);
    cockpit.style.setProperty('--R', `${R}px`);
    cockpit.style.setProperty('--persp', `${Math.max(1000, R * 1.05)}px`);   // stronger curve, like the reference
  };

  let angle = start * STEP, vel = 0, current = -1, wheelAt = 0;
  // every move is a fixed-length eased tween (the reference's pacing), never a spring
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tw = { from: angle, to: angle, t0: 0, dur: 1, ease: easeOut };
  let idleSince = performance.now(), autoOn = true, hover = false, focused = false;
  const tweenTo = (a, dur = 1, delay = 0, ease = easeOut) => { tw.from = angle; tw.to = a; tw.t0 = performance.now() + delay; tw.dur = dur; tw.ease = ease; idleSince = tw.t0 + dur * 1000; };
  const hold = (a) => { angle = tw.from = tw.to = a; tw.t0 = 0; };
  let dragX = null, dragOff = 0, lastX = 0;
  const px = { x: 0, y: 0 }, pxS = { x: 0, y: 0 };
  const go = (i) => {
    // shortest way round to the nearest slot showing window i
    const cur = Math.round(angle / STEP);
    let best = null;
    for (let k = cur - SLOTS; k <= cur + SLOTS; k++) if (((k % N) + N) % N === ((i % N) + N) % N && (best === null || Math.abs(k - cur) < Math.abs(best - cur))) best = k;
    tweenTo(best * STEP, 1);
  };
  const step = (d) => tweenTo((Math.round(tw.to / STEP) + d) * STEP, 1);

  cockpit.addEventListener('pointerover', (e) => { hover = !!e.target.closest('a, button'); });
  cockpit.addEventListener('pointerleave', () => { hover = false; cursor.classList.remove('on'); px.x = px.y = 0; });
  cockpit.addEventListener('focusin', () => { focused = true; });
  cockpit.addEventListener('focusout', () => { focused = false; idleSince = performance.now(); });
  // a sideways wheel / trackpad swipe scrolls the wall freely, then it snaps (vertical scroll stays the page's)
  cockpit.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !cockpit.classList.contains('is-live')) return;
    e.preventDefault();
    hold(angle + e.deltaX * (STEP / (cockpit.clientWidth * 0.5)));
    wheelAt = performance.now();
  }, { passive: false });
  cockpit.addEventListener('pointermove', (e) => {
    const r = cockpit.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    px.x = fx * 2 - 1; px.y = fy * 2 - 1;
    const side = fx < 0.3 ? -1 : fx > 0.7 ? 1 : 0;
    const overUI = !!e.target.closest('a, button, .console');
    cursor.classList.toggle('on', side !== 0 && !overUI && dragX === null);
    cursor.classList.toggle('next', side > 0);
    cursor.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
    cockpit.classList.toggle('has-arrow', side !== 0 && !overUI);
    if (dragX === null) return;
    const dx = e.clientX - lastX; lastX = e.clientX; dragOff += dx;
    const perPx = STEP / (cockpit.clientWidth * 0.5);
    hold(angle - dx * perPx); vel = -dx * perPx * 60;
  });
  cockpit.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a,button')) return;
    dragX = lastX = e.clientX; dragOff = 0; vel = 0;
    cockpit.classList.add('is-dragging'); cockpit.setPointerCapture(e.pointerId);
  });
  const endDrag = (e) => {
    if (dragX === null) return;
    dragX = null; cockpit.classList.remove('is-dragging');
    if (Math.abs(dragOff) < 6) {                     // a click: side arrows step, else nothing
      const r = cockpit.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
      if (fx < 0.3) step(-1); else if (fx > 0.7) step(1);
      return;
    }
    tweenTo(Math.round((angle + vel * 0.25) / STEP) * STEP, 0.75); vel = 0;
  };
  cockpit.addEventListener('pointerup', endDrag);
  cockpit.addEventListener('pointercancel', endDrag);
  cockpit.tabIndex = 0;
  cockpit.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  addEventListener('resize', layout);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (cockpit.offsetParent === null) return;
    if (wheelAt && now - wheelAt > 120) { wheelAt = 0; tweenTo(Math.round(angle / STEP) * STEP, 0.75); }
    // the loop: glide on to the next window after a rest, unless you're looking or touching
    if (auto && autoOn && !hover && !focused && dragX === null && !wheelAt && now - idleSince > auto) tweenTo((Math.round(tw.to / STEP) + 1) * STEP, 1.4, 0, easeInOut);
    if (dragX !== null || wheelAt) idleSince = now;
    if (dragX === null && !wheelAt) { const k = Math.min(1, Math.max(0, (now - tw.t0) / 1000 / tw.dur)); angle = tw.from + (tw.to - tw.from) * tw.ease(k); }
    pxS.x += (px.x - pxS.x) * (1 - Math.exp(-dt * 4)); pxS.y += (px.y - pxS.y) * (1 - Math.exp(-dt * 4));
    track.style.transform = `translateZ(var(--R)) rotateX(${pxS.y * 2.2}deg) rotateY(${-angle + pxS.x * -3.5}deg)`;
    cockpit.style.setProperty('--lean-x', pxS.x.toFixed(3)); cockpit.style.setProperty('--lean-y', pxS.y.toFixed(3));
    const k = Math.round(angle / STEP), i = ((k % N) + N) % N;
    if (k !== current) {
      const kk = ((k % SLOTS) + SLOTS) % SLOTS;
      slots.forEach((w, j) => w.setAttribute('aria-current', j === kk));
      originals.forEach((w, j) => w.querySelectorAll('a, button').forEach((el) => { el.tabIndex = j === i ? 0 : -1; }));
      if (dots) [...dots.children].forEach((d, j) => d.setAttribute('aria-current', j === i));
      current = k;
    }
  }
  layout();
  requestAnimationFrame(frame);
  return {
    go, stages,
    jump: (i) => { hold(i * STEP); vel = 0; },
    setAuto: (on) => { if (on && !autoOn) idleSince = performance.now(); autoOn = on; },
    // the entrance: the wall slides in from half a window away (reference: camera x -5 → 0, 2.5s easeOutCubic, after 1s)
    arrive: (delay = 1000) => { const to = Math.round(angle / STEP) * STEP; hold(to - STEP * 0.5); tweenTo(to, 2.5, delay); },
  };
}
