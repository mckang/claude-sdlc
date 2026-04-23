"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadTodos, saveTodos } from "./storage";
import type { Todo } from "./types";

const MAX_LEN = 200;

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    setTodos(loadTodos());
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveTodos(todos);
  }, [todos]);

  const addTodo = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, MAX_LEN);
    if (!trimmed) return;
    const todo: Todo = {
      id: crypto.randomUUID(),
      text: trimmed,
      done: false,
      createdAt: Date.now(),
    };
    setTodos((prev) => [todo, ...prev]);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTodos((prev) => prev.filter((t) => !t.done));
  }, []);

  return { todos, addTodo, toggleTodo, deleteTodo, clearCompleted };
}
