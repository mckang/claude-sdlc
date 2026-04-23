import type { Todo } from "./types";

const STORAGE_KEY = "todo-app:v1:items";

export function loadTodos(): Todo[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed.filter(isTodo);
  } catch (err) {
    console.warn(`[todo-app] failed to parse localStorage, falling back to []`, err);
    return [];
  }
}

export function saveTodos(todos: Todo[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (err) {
    console.error(`[todo-app] failed to write localStorage`, err);
  }
}

function isTodo(value: unknown): value is Todo {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.text === "string" &&
    typeof v.done === "boolean" &&
    typeof v.createdAt === "number"
  );
}
