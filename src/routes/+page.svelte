<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  
  let todos: { id: number; text: string; done: boolean }[] = [];
  let newTodo = '';
  let nextId = 1;
  let isAlwaysOnTop = false;

  // Load from localStorage
  onMount(async () => {
    const stored = localStorage.getItem('todos');
    if (stored) {
      todos = JSON.parse(stored);
      nextId = Math.max(...todos.map(t => t.id), 0) + 1;
    }
    
    // Get initial always on top state
    isAlwaysOnTop = await getCurrentWindow().isAlwaysOnTop();
  });

  function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
  }

  function addTodo() {
    if (newTodo.trim()) {
      todos = [...todos, { id: nextId++, text: newTodo, done: false }];
      newTodo = '';
      saveTodos();
    }
  }

  function toggleTodo(id: number) {
    todos = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    saveTodos();
  }

  function deleteTodo(id: number) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
  }

  async function toggleAlwaysOnTop() {
    isAlwaysOnTop = !isAlwaysOnTop;
    await getCurrentWindow().setAlwaysOnTop(isAlwaysOnTop);
  }

  async function minimizeWindow() {
    await getCurrentWindow().minimize();
  }

  async function closeWindow() {
    await getCurrentWindow().close();
  }
</script>

<div class="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
  <!-- Custom Title Bar -->
  <div data-tauri-drag-region class="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
    <h1 class="text-lg font-bold text-gray-800 select-none">My Todos</h1>
    <div class="flex gap-1">
      <button
        on:click={toggleAlwaysOnTop}
        class="px-3 py-1 text-sm rounded hover:bg-gray-100 transition {isAlwaysOnTop ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}"
        title="Toggle Always on Top"
      >
        📌
      </button>
      <button
        on:click={minimizeWindow}
        class="px-3 py-1 text-sm rounded hover:bg-gray-100 transition text-gray-600"
        title="Minimize"
      >
        −
      </button>
      <button
        on:click={closeWindow}
        class="px-3 py-1 text-sm rounded hover:bg-red-100 hover:text-red-600 transition text-gray-600"
        title="Close"
      >
        ×
      </button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 p-4 overflow-auto">
    <form on:submit|preventDefault={addTodo} class="mb-4">
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newTodo}
          placeholder="Add a new todo..."
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          Add
        </button>
      </div>
    </form>

    <div class="space-y-2">
      {#each todos as todo (todo.id)}
        <div class="flex items-center gap-2 p-3 bg-white rounded-lg shadow-sm">
          <input
            type="checkbox"
            checked={todo.done}
            on:change={() => toggleTodo(todo.id)}
            class="w-5 h-5 text-blue-500"
          />
          <span class="flex-1 {todo.done ? 'line-through text-gray-400' : 'text-gray-700'}">
            {todo.text}
          </span>
          <button
            on:click={() => deleteTodo(todo.id)}
            class="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded transition"
          >
            Delete
          </button>
        </div>
      {/each}
    </div>

    {#if todos.length === 0}
      <p class="text-center text-gray-400 mt-8">No todos yet. Add one above!</p>
    {/if}
  </div>
</div>