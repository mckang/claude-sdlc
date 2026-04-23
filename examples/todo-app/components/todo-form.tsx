"use client";

import { useState, type FormEvent } from "react";

const MAX_LEN = 200;

export function TodoForm({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <label htmlFor="todo-input" className="sr-only">
        할 일 입력
      </label>
      <div className="flex gap-2">
        <input
          id="todo-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
          placeholder="무엇을 할까요?"
          autoFocus
          maxLength={MAX_LEN}
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          추가
        </button>
      </div>
    </form>
  );
}
