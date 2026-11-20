// The save file: one JSON object in localStorage holding the career — cash,
// story progress, hidden packages found and lifetime stats. Written whenever
// something worth keeping happens; read by the title screen's Continue.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    money: 0,
    storyDone: 0, // missions of Mara's story completed, in order
    packages: [], // ids of hidden packages already collected
    stats: {
      earned: 0,
      fares: 0,
      carsJacked: 0,
      timesBusted: 0,
      timesWasted: 0,
      shotsFired: 0,
    },
    muted: false,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    const fresh = defaultSave();
    return {
      ...fresh,
      ...parsed,
      stats: { ...fresh.stats, ...(parsed.stats ?? {}) },
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
    };
  } catch {
    return null;
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable (private windows): the career then lasts
    // only for this visit, which the game tolerates silently.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
