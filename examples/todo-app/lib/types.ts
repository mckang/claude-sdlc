export type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

export type Filter = "all" | "active" | "completed";

export const FILTERS: readonly Filter[] = ["all", "active", "completed"] as const;

export const FILTER_LABELS: Record<Filter, string> = {
  all: "전체",
  active: "미완료",
  completed: "완료",
};
