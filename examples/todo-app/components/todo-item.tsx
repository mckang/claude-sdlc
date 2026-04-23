"use client";

import type { Todo } from "@/lib/types";

type Props = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TodoItem({ todo, onToggle, onDelete }: Props) {
  return (
    <li className="group flex items-center gap-3 border-b border-slate-200 py-3 last:border-b-0">
      <input
        id={`todo-${todo.id}`}
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
        aria-label={todo.done ? "미완료로 변경" : "완료로 표시"}
        className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-900/20"
      />
      <label
        htmlFor={`todo-${todo.id}`}
        className={`flex-1 cursor-pointer break-words text-sm ${
          todo.done ? "text-slate-400 line-through" : "text-slate-800"
        }`}
      >
        {todo.text}
      </label>
      <button
        type="button"
        onClick={() => onDelete(todo.id)}
        aria-label={`"${todo.text}" 삭제`}
        className="rounded px-2 py-1 text-xs text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
      >
        삭제
      </button>
    </li>
  );
}
