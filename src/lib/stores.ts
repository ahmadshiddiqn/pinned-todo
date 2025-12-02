import { writable, derived } from 'svelte/store';
import type { Todo, Project, SortBy, GroupBy } from './types';

function createTodosStore() {
  const { subscribe, set, update } = writable<Todo[]>([]);

  return {
    subscribe,
    set,
    load: () => {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('todos');
        if (stored) {
          set(JSON.parse(stored));
        }
      }
    },
    save: (todos: Todo[]) => {
      set(todos);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('todos', JSON.stringify(todos));
      }
    },
    add: (todo: Todo) => {
      update(todos => {
        const updated = [...todos, todo];
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('todos', JSON.stringify(updated));
        }
        return updated;
      });
    },
    update: (id: number, updates: Partial<Todo>) => {
      update(todos => {
        const updated = todos.map(t => 
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        );
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('todos', JSON.stringify(updated));
        }
        return updated;
      });
    },
    delete: (id: number) => {
      update(todos => {
        const updated = todos.filter(t => t.id !== id);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('todos', JSON.stringify(updated));
        }
        return updated;
      });
    },
    deleteByProject: (projectId: string) => {
      update(todos => {
        const updated = todos.filter(t => t.projectId !== projectId);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('todos', JSON.stringify(updated));
        }
        return updated;
      });
    }
  };
}

function createProjectsStore() {
  const defaultProjects: Project[] = [
    { id: 'personal', name: 'Personal', color: '#3B82F6', isPersonal: true }
  ];

  const { subscribe, set, update } = writable<Project[]>(defaultProjects);

  return {
    subscribe,
    set,
    getById: (id: string) => {
        if (typeof localStorage === 'undefined') return null;
        const stored = localStorage.getItem('projects');
        if (stored) {
          const projects: Project[] = JSON.parse(stored);
          return projects.find(p => p.id === id) || null;
        }
    },
    load: () => {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('projects');
        if (stored) {
          set(JSON.parse(stored));
        } else {
          set(defaultProjects);
        }
      }
    },
    save: (projects: Project[]) => {
      set(projects);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('projects', JSON.stringify(projects));
      }
    },
    add: (project: Project) => {
      update(projects => {
        const updated = [...projects, project];
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('projects', JSON.stringify(updated));
        }
        return updated;
      });
    },
    delete: (id: string) => {
      update(projects => {
        const updated = projects.filter(p => p.id !== id);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('projects', JSON.stringify(updated));
        }
        return updated;
      });
    }
  };
}

export const todos = createTodosStore();
export const projects = createProjectsStore();
export const currentProjectId = writable<string>('personal');
export const sortBy = writable<SortBy>('createdAt');
export const groupBy = writable<GroupBy>('none');

export const filteredTodos = derived(
  [todos, currentProjectId, groupBy],
  ([$todos, $currentProjectId, $groupBy]) => {
    let filtered = $todos.filter(t => t.projectId === $currentProjectId);
    
    if ($groupBy === 'today') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(t => t.dueDate === today);
    } else if ($groupBy === 'week') {
      const today = new Date();
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due >= today && due <= weekFromNow;
      });
    } else if ($groupBy === 'overdue') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(t => 
        t.dueDate && t.dueDate < today && t.status !== 'done'
      );
    }
    
    return filtered;
  }
);

export const sortedTodos = derived(
  [filteredTodos, sortBy],
  ([$filteredTodos, $sortBy]) => {
    const sorted = [...$filteredTodos];
    
    if ($sortBy === 'dueDate') {
      sorted.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else if ($sortBy === 'weight') {
      sorted.sort((a, b) => b.weight - a.weight);
    } else if ($sortBy === 'status') {
      const statusOrder = { 'not-started': 0, 'in-progress': 1, 'done': 2 };
      sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    } else if ($sortBy === 'createdAt') {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    
    return sorted;
  }
);
