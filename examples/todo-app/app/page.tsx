import { TodoApp } from "@/components/todo-app";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Todo</h1>
        <p className="mt-1 text-sm text-slate-500">
          브라우저 localStorage 에만 저장됩니다. 서버·계정 없음.
        </p>
      </header>
      <TodoApp />
      <footer className="mt-auto pt-10 text-center text-xs text-slate-400">
        built with the{" "}
        <a
          href="https://github.com/mckang/claude-sdlc"
          className="underline hover:text-slate-600"
        >
          sdlc Claude Code plugin
        </a>
      </footer>
    </main>
  );
}
