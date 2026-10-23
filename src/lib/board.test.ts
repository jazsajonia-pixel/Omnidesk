import { describe, expect, it } from "vitest";
import { applyMove, keyboardMove, planMove, type BoardColumn } from "./board";

const t = (id: string, status: string, position: number) => ({ id, status, position });
// Positions deliberately have gaps, like a real column after deletes.
const columns = (): BoardColumn[] => [
  { value: "todo", tasks: [t("a", "todo", 0), t("c", "todo", 2), t("d", "todo", 5)] },
  { value: "in_progress", tasks: [t("x", "in_progress", 1)] },
  { value: "done", tasks: [] },
];
const order = (cols: BoardColumn[], plan: NonNullable<ReturnType<typeof planMove>>, id: string) => {
  const all = cols.flatMap((c) => c.tasks);
  return applyMove(all, cols, id, plan).filter((x) => x.status === plan.status).sort((p, q) => p.position - q.position).map((x) => x.id);
};

describe("board move planning", () => {
  it("anchors to the visible neighbour instead of stored positions", () => {
    expect(planMove(columns(), "d", "todo", 1)).toEqual({ status: "todo", beforeId: "c", afterId: null, index: 1 });
  });

  it("anchors after the last card when dropped at the end", () => {
    expect(planMove(columns(), "a", "in_progress", 5)).toEqual({ status: "in_progress", beforeId: null, afterId: "x", index: 1 });
  });

  it("sends no anchor when the target column is empty", () => {
    expect(planMove(columns(), "a", "done", 0)).toEqual({ status: "done", beforeId: null, afterId: null, index: 0 });
  });

  it("ignores drops that leave the task in place", () => {
    expect(planMove(columns(), "c", "todo", 1)).toBeNull();
  });
});

describe("keyboard moves", () => {
  it("reorders within a column with Alt+Up/Down", () => {
    const cols = columns();
    const down = keyboardMove(cols, "a", "ArrowDown")!;
    expect(order(cols, down, "a")).toEqual(["c", "a", "d"]);
    const up = keyboardMove(cols, "d", "ArrowUp")!;
    expect(order(cols, up, "d")).toEqual(["a", "d", "c"]);
  });

  it("moves to neighbouring columns and keeps the row where possible", () => {
    const cols = columns();
    const right = keyboardMove(cols, "c", "ArrowRight")!;
    expect(right.status).toBe("in_progress");
    expect(order(cols, right, "c")).toEqual(["x", "c"]);
    expect(keyboardMove(cols, "a", "ArrowLeft")).toBeNull();
    expect(keyboardMove(cols, "x", "ArrowLeft")).toMatchObject({ status: "todo", beforeId: "a", index: 0 });
  });

  it("jumps to the top or bottom with Alt+Home/End and stops at edges", () => {
    const cols = columns();
    expect(order(cols, keyboardMove(cols, "d", "Home")!, "d")).toEqual(["d", "a", "c"]);
    expect(order(cols, keyboardMove(cols, "a", "End")!, "a")).toEqual(["c", "d", "a"]);
    expect(keyboardMove(cols, "a", "ArrowUp")).toBeNull();
    expect(keyboardMove(cols, "d", "ArrowDown")).toBeNull();
    expect(keyboardMove(cols, "a", "Home")).toBeNull();
  });
});
