import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTodos } from "./use-todos";
import type { Todo } from "./types";

const KEY = "todo-app:v1:items";

function seed(todos: Todo[]) {
  window.localStorage.setItem(KEY, JSON.stringify(todos));
}

describe("useTodos", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads nothing on first render, then populates from localStorage after mount", () => {
    const stored: Todo = {
      id: "seed-1",
      text: "from storage",
      done: false,
      createdAt: 1,
    };
    seed([stored]);
    const { result } = renderHook(() => useTodos());
    expect(result.current.todos).toEqual([stored]);
  });

  it("addTodo prepends trimmed text and generates id", () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo("  buy milk  "));
    expect(result.current.todos).toHaveLength(1);
    expect(result.current.todos[0].text).toBe("buy milk");
    expect(result.current.todos[0].done).toBe(false);
    expect(typeof result.current.todos[0].id).toBe("string");
  });

  it("addTodo ignores whitespace-only input (regression guard — E1-S1 AC-2)", () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo("    "));
    expect(result.current.todos).toHaveLength(0);
  });

  it("addTodo truncates to 200 chars (regression guard — E1-S1 AC-4)", () => {
    const { result } = renderHook(() => useTodos());
    const long = "x".repeat(300);
    act(() => result.current.addTodo(long));
    expect(result.current.todos[0].text).toHaveLength(200);
  });

  it("toggleTodo flips done for the matching id only", () => {
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.addTodo("a");
      result.current.addTodo("b");
    });
    const targetId = result.current.todos[0].id;
    act(() => result.current.toggleTodo(targetId));
    const after = result.current.todos;
    expect(after.find((t) => t.id === targetId)?.done).toBe(true);
    expect(after.find((t) => t.id !== targetId)?.done).toBe(false);
  });

  it("deleteTodo removes the matching id", () => {
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.addTodo("a");
      result.current.addTodo("b");
    });
    const targetId = result.current.todos[0].id;
    act(() => result.current.deleteTodo(targetId));
    expect(result.current.todos.find((t) => t.id === targetId)).toBeUndefined();
    expect(result.current.todos).toHaveLength(1);
  });

  it("clearCompleted removes only done items", () => {
    const { result } = renderHook(() => useTodos());
    act(() => {
      result.current.addTodo("keep me");
      result.current.addTodo("clear me");
    });
    const toDoneId = result.current.todos[0].id;
    act(() => result.current.toggleTodo(toDoneId));
    act(() => result.current.clearCompleted());
    expect(result.current.todos.every((t) => !t.done)).toBe(true);
    expect(result.current.todos).toHaveLength(1);
  });

  it("writes through to localStorage after state changes", () => {
    const { result } = renderHook(() => useTodos());
    act(() => result.current.addTodo("persisted"));
    const raw = window.localStorage.getItem(KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Todo[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toBe("persisted");
  });

  it("does not clobber existing localStorage on initial mount (regression guard — loadedRef)", () => {
    const existing: Todo = {
      id: "existing",
      text: "already there",
      done: false,
      createdAt: 0,
    };
    seed([existing]);
    const { result } = renderHook(() => useTodos());
    expect(result.current.todos).toEqual([existing]);
    const raw = window.localStorage.getItem(KEY);
    expect(raw).toBe(JSON.stringify([existing]));
  });
});
