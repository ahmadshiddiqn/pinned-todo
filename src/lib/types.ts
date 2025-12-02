export type TodoStatus = 'not-started' | 'in-progress' | 'done';

export interface SubTask {
  id: number;
  text: string;
  done: boolean;
}

export interface Todo {
  id: number;
  text: string;
  description: string;
  status: TodoStatus;
  weight: number; // 1-5
  projectId: string;
  dueDate: string | null; // For personal project
  expectedStartDate: string | null; // For other projects
  expectedEndDate: string | null; // For other projects
  actualStartDate: string | null; // For other projects
  actualEndDate: string | null; // For other projects
  subTasks: SubTask[];
  createdAt: string;
  updatedAt: string;
  expanded?: boolean; // For accordion
}

export interface Project {
  id: string;
  name: string;
  color: string;
  isPersonal: boolean; // True for "Personal" project
}

export type SortBy = 'dueDate' | 'weight' | 'createdAt' | 'status';
export type GroupBy = 'none' | 'today' | 'week' | 'overdue';