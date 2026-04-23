"use client";

import { useMemo, useState } from "react";
import { useTodos } from "@/lib/use-todos";
import type { Filter } from "@/lib/types";
import { TodoForm } from "./todo-form";
import { TodoList } from "./todo-list";
import { TodoFilter } from "./todo-filter";
import { TodoFooter } from "./todo-footer";

export function TodoApp() {
  const { todos, addTodo, toggleTodo, deleteTodo, clearCompleted } = useTodos();
  const [filter, setFilter] = useState<Filter>("all");

  const visibleTodos = useMemo(() => {
    if (filter === "active") return todos.filter((t) => !t.done);
    if (filter === "completed") return todos.filter((t) => t.done);
    return todos;
  }, [todos, filter]);

  const remaining = useMemo(() => todos.filter((t) => !t.done).length, [todos]);
  const completed = todos.length - remaining;

  const isEmpty = todos.length === 0;

  return (
    <section>
      <TodoForm onAdd={addTodo} />

      {!isEmpty && <TodoFilter value={filter} onChange={setFilter} />}

      {isEmpty ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-400">
          아직 할 일이 없습니다. 위에서 추가하세요.
        </p>
      ) : visibleTodos.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
          이 필터에 해당하는 항목이 없습니다.
        </p>
      ) : (
        <TodoList
          todos={visibleTodos}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
        />
      )}

      {!isEmpty && (
        <TodoFooter
          remaining={remaining}
          completed={completed}
          onClearCompleted={clearCompleted}
        />
      )}
    </section>
  );
}
