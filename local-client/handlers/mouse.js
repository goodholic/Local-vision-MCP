import {
  mouse,
  straightTo,
  Point,
  Button,
  centerOf,
} from "@nut-tree-fork/nut-js";

function getButton(name) {
  switch (name) {
    case "right": return Button.RIGHT;
    case "middle": return Button.MIDDLE;
    default: return Button.LEFT;
  }
}

export const mouseHandlers = {
  async mouse_move(params) {
    await mouse.move(straightTo(new Point(params.x, params.y)));
    return { x: params.x, y: params.y };
  },

  async mouse_click(params) {
    if (params.x != null && params.y != null) {
      await mouse.move(straightTo(new Point(params.x, params.y)));
    }
    const btn = getButton(params.button);
    if (params.doubleClick) {
      await mouse.doubleClick(btn);
    } else {
      await mouse.click(btn);
    }
    return {};
  },

  async mouse_drag(params) {
    const duration = params.duration || 500;
    await mouse.move(straightTo(new Point(params.startX, params.startY)));
    await mouse.pressButton(getButton(params.button));
    // Move to end position
    await mouse.move(straightTo(new Point(params.endX, params.endY)));
    await mouse.releaseButton(getButton(params.button));
    return {};
  },

  async mouse_scroll(params) {
    if (params.x != null && params.y != null) {
      await mouse.move(straightTo(new Point(params.x, params.y)));
    }
    if (params.amount > 0) {
      await mouse.scrollDown(Math.abs(params.amount));
    } else {
      await mouse.scrollUp(Math.abs(params.amount));
    }
    return {};
  },

  async get_mouse_position(params) {
    const pos = await mouse.getPosition();
    return { x: pos.x, y: pos.y };
  },
};
