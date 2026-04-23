"use client";

type Props = {
  remaining: number;
  completed: number;
  onClearCompleted: () => void;
};

export function TodoFooter({ remaining, completed, onClearCompleted }: Props) {
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
      <span aria-live="polite">{remaining}개 남음</span>
      <button
        type="button"
        onClick={onClearCompleted}
        disabled={completed === 0}
        className="rounded px-2 py-1 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:text-slate-300"
      >
        완료 {completed}개 지우기
      </button>
    </div>
  );
}
