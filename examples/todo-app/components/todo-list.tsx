"use client";

import type { Todo } from "@/lib/types";
import { TodoItem } from "./todo-item";

type Props = {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TodoList({ todos, onToggle, onDelete }: Props) {
  if (todos.length === 0) return null;

  return (
    <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white px-4 shadow-sm">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
