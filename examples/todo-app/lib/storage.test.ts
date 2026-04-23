import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadTodos, saveTodos } from "./storage";
import type { Todo } from "./types";

const KEY = "todo-app:v1:items";

const sample: Todo = {
  id: "a1",
  text: "write docs",
  done: false,
  createdAt: 1700000000000,
};

describe("loadTodos", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns [] when no entry exists", () => {
    expect(loadTodos()).toEqual([]);
  });

  it("returns stored todos when valid JSON array", () => {
    window.localStorage.setItem(KEY, JSON.stringify([sample]));
    expect(loadTodos()).toEqual([sample]);
  });

  it("returns [] on broken JSON and warns (regression guard — E1-S3 AC-3)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem(KEY, "{not-json");
    expect(loadTodos()).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("returns [] when stored value is not an array", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem(KEY, JSON.stringify({ not: "an array" }));
    expect(loadTodos()).toEqual([]);
    warn.mockRestore();
  });

  it("filters out malformed items while keeping valid ones", () => {
    const mixed = [
      sample,
      { id: "x", text: 123, done: false, createdAt: 0 }, // wrong type
      { id: "y", text: "ok", done: "nope", createdAt: 0 }, // wrong type
      { ...sample, id: "b2", text: "valid 2" },
    ];
    window.localStorage.setItem(KEY, JSON.stringify(mixed));
    const result = loadTodos();
    expect(result.map((t) => t.id)).toEqual(["a1", "b2"]);
  });
});

describe("saveTodos", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists the array as JSON", () => {
    saveTodos([sample]);
    const raw = window.localStorage.getItem(KEY);
    expect(raw).toBe(JSON.stringify([sample]));
  });

  it("overwrites previous value", () => {
    saveTodos([sample]);
    saveTodos([]);
    expect(window.localStorage.getItem(KEY)).toBe("[]");
  });
});
