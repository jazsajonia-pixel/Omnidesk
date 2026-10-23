/**
 * Pure helpers for moving tasks on the board. Kept free of React so they can be
 * unit-tested and shared by drag-and-drop and keyboard moves.
 */

export type BoardTask = { id: string; status: string; position: number };
export type BoardColumn<T extends BoardTask = BoardTask> = { value: string; tasks: T[] };

/** What the server needs to place a task: target column plus a neighbour anchor. */
export type MovePlan = { status: string; beforeId: string | null; afterId: string | null; index: number };

/**
 * Plan a move of `taskId` to slot `visibleIndex` of column `status`, where the
 * index counts only the visible cards in that column with the moving task removed.
 * Returns null when the task would stay where it is.
 */
export function planMove(columns: BoardColumn[], taskId: string, status: string, visibleIndex: number): MovePlan | null {
  const source = columns.find((c) => c.tasks.some((t) => t.id === taskId));
  const target = columns.find((c) => c.value === status);
  if (!source || !target) return null;
  const others = target.tasks.filter((t) => t.id !== taskId);
  const index = Math.max(0, Math.min(visibleIndex, others.length));
  if (source.value === status && source.tasks.findIndex((t) => t.id === taskId) === index) return null;
  const before = others[index] ?? null;
  const after = before ? null : others.at(-1) ?? null;
  return { status, beforeId: before?.id ?? null, afterId: after?.id ?? null, index };
}

export type MoveKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

/**
 * Keyboard alternative to dragging: Alt+Left/Right moves a card to the
 * neighbouring column (keeping its row where possible), Alt+Up/Down reorders it
 * within its column, and Alt+Home/End sends it to the top/bottom.
 */
export function keyboardMove(columns: BoardColumn[], taskId: string, key: MoveKey): MovePlan | null {
  const col = columns.findIndex((c) => c.tasks.some((t) => t.id === taskId));
  if (col === -1) return null;
  const row = columns[col].tasks.findIndex((t) => t.id === taskId);
  const last = columns[col].tasks.length - 1;
  switch (key) {
    case "ArrowLeft":
    case "ArrowRight": {
      const next = columns[col + (key === "ArrowLeft" ? -1 : 1)];
      return next ? planMove(columns, taskId, next.value, row) : null;
    }
    case "ArrowUp": return row > 0 ? planMove(columns, taskId, columns[col].value, row - 1) : null;
    case "ArrowDown": return row < last ? planMove(columns, taskId, columns[col].value, row + 1) : null;
    case "Home": return planMove(columns, taskId, columns[col].value, 0);
    case "End": return planMove(columns, taskId, columns[col].value, last);
  }
}

/** Apply a plan locally for an optimistic update; positions are renumbered per touched column. */
export function applyMove<T extends BoardTask>(tasks: T[], columns: BoardColumn<T>[], taskId: string, plan: MovePlan): T[] {
  const task = tasks.find((t) => t.id === taskId);
  const target = columns.find((c) => c.value === plan.status);
  if (!task || !target) return tasks;
  const reordered = target.tasks.filter((t) => t.id !== taskId);
  reordered.splice(plan.index, 0, { ...task, status: plan.status });
  const untouched = tasks.filter((t) => t.status !== plan.status && t.id !== taskId);
  return [...untouched, ...reordered.map((t, i) => ({ ...t, position: i }))];
}
