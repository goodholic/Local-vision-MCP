import { keyboard, Key } from "@nut-tree-fork/nut-js";

// Map string key names to nut-js Key enum
const KEY_MAP = {
  // Modifiers
  control: Key.LeftControl, ctrl: Key.LeftControl,
  shift: Key.LeftShift, alt: Key.LeftAlt,
  meta: Key.LeftWin, win: Key.LeftWin, command: Key.LeftWin,
  // Navigation
  enter: Key.Return, return: Key.Return,
  tab: Key.Tab, escape: Key.Escape, esc: Key.Escape,
  space: Key.Space, backspace: Key.Backspace, delete: Key.Delete,
  home: Key.Home, end: Key.End,
  pageup: Key.PageUp, pagedown: Key.PageDown,
  up: Key.Up, down: Key.Down, left: Key.Left, right: Key.Right,
  // Function keys
  f1: Key.F1, f2: Key.F2, f3: Key.F3, f4: Key.F4,
  f5: Key.F5, f6: Key.F6, f7: Key.F7, f8: Key.F8,
  f9: Key.F9, f10: Key.F10, f11: Key.F11, f12: Key.F12,
  // Letters
  a: Key.A, b: Key.B, c: Key.C, d: Key.D, e: Key.E,
  f: Key.F, g: Key.G, h: Key.H, i: Key.I, j: Key.J,
  k: Key.K, l: Key.L, m: Key.M, n: Key.N, o: Key.O,
  p: Key.P, q: Key.Q, r: Key.R, s: Key.S, t: Key.T,
  u: Key.U, v: Key.V, w: Key.W, x: Key.X, y: Key.Y, z: Key.Z,
  // Numbers
  "0": Key.Num0, "1": Key.Num1, "2": Key.Num2, "3": Key.Num3,
  "4": Key.Num4, "5": Key.Num5, "6": Key.Num6, "7": Key.Num7,
  "8": Key.Num8, "9": Key.Num9,
};

function resolveKey(name) {
  const key = KEY_MAP[name.toLowerCase()];
  if (!key) throw new Error(`Unknown key: ${name}`);
  return key;
}

// Predefined shortcuts
const SHORTCUTS = {
  copy: [Key.LeftControl, Key.C],
  paste: [Key.LeftControl, Key.V],
  cut: [Key.LeftControl, Key.X],
  undo: [Key.LeftControl, Key.Z],
  redo: [Key.LeftControl, Key.Y],
  save: [Key.LeftControl, Key.S],
  save_all: [Key.LeftControl, Key.LeftShift, Key.S],
  select_all: [Key.LeftControl, Key.A],
  find: [Key.LeftControl, Key.F],
  find_replace: [Key.LeftControl, Key.H],
  new_file: [Key.LeftControl, Key.N],
  close_tab: [Key.LeftControl, Key.W],
  switch_tab: [Key.LeftControl, Key.Tab],
  delete_line: [Key.LeftControl, Key.LeftShift, Key.K],
  comment_line: [Key.LeftControl, Key.Slash],
  format_document: [Key.LeftShift, Key.LeftAlt, Key.F],
};

export const keyboardHandlers = {
  async keyboard_type(params) {
    if (params.delayMs) {
      keyboard.config.autoDelayMs = params.delayMs;
    }
    await keyboard.type(params.text);
    keyboard.config.autoDelayMs = 0;
    return {};
  },

  async keyboard_press(params) {
    const keys = params.keys.map(resolveKey);
    await keyboard.pressKey(...keys);
    await keyboard.releaseKey(...keys.reverse());
    return {};
  },

  async keyboard_shortcut(params) {
    const keys = SHORTCUTS[params.name];
    if (!keys) throw new Error(`Unknown shortcut: ${params.name}`);
    await keyboard.pressKey(...keys);
    await keyboard.releaseKey(...keys.reverse());
    return {};
  },
};
