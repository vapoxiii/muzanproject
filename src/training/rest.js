// Minuteur de repos, partagé par la barre de repos et l'écran de repos de Ren.
// Il garde une heure de fin, jamais un décompte : le temps restant se recalcule à chaque lecture
// (now()), donc rien ne dérive si l'app ralentit, si l'écran se met en veille ou si l'on passe un
// moment dans une autre app. En pause, il garde le temps restant.

export function createRestTimer(now = () => Date.now()) {
  let total = 0, end = 0, left = 0, paused = false, running = false;
  const t = {
    // lance un repos de ms millisecondes
    start(ms) { total = Math.max(1000, ms); end = now() + total; left = 0; paused = false; running = true; return t; },
    pause() { if (running && !paused) { left = Math.max(0, end - now()); paused = true; } return t; },
    resume() { if (running && paused) { end = now() + left; paused = false; } return t; },
    toggle() { return paused ? t.resume() : t.pause(); },
    // recommencer : le même repos, depuis le début, en marche
    restart() { if (total) { end = now() + total; paused = false; running = true; } return t; },
    // ±15 s : jamais sous une seconde
    add(ms) {
      if (!running) return t;
      if (paused) left = Math.max(1000, left + ms); else end = Math.max(now() + 1000, end + ms);
      total = Math.max(1000, total + ms);
      return t;
    },
    stop() { running = false; paused = false; left = 0; return t; },
    left() { return !running ? 0 : paused ? left : Math.max(0, end - now()); },
    // part du repos qui reste, de 1 (début) à 0 (fini)
    progress() { return total ? Math.min(1, t.left() / total) : 0; },
    // depuis combien de temps le repos est fini (0 s'il ne l'est pas)
    overdue() { return running && !paused ? Math.max(0, now() - end) : 0; },
    get total() { return total; },
    get paused() { return paused; },
    get running() { return running; },
    get done() { return running && !paused && now() >= end; },
  };
  return t;
}

// 90 000 ms → « 01:30 » ; une seconde entamée compte (00:01 jusqu'au bout)
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

// heure du téléphone, « 19:24 »
export function fmtClock(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
