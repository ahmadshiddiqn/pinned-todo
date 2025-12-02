<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { todos, projects, currentProjectId, sortedTodos, sortBy, groupBy } from '$lib/stores';
  import type { Todo, Project, TodoStatus } from '$lib/types';
  
  let newTodoText = '';
  let nextTodoId = 1;
  let nextSubTaskId = 1;
  let isAlwaysOnTop = false;
  let editingTodo: Todo | null = null;
  let showEditModal = false;
  let showProjectModal = false;
  let newProjectName = '';
  let newProjectColor = '#3B82F6';
  let showProjectDropdown = false;// Custom dialog
  let projectContextMenu = { visible: false, x: 0, y: 0, projectId: null as string | null };
  let dialogVisible = false;
  let dialogMessage = '';
  let dialogType: 'alert' | 'confirm' = 'alert';
  let dialogResolve: ((value: boolean) => void) | null = null;
  
  function showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      dialogMessage = message;
      dialogType = 'alert';
      dialogVisible = true;
      dialogResolve = () => { resolve(); return true; };
    });
  }
  
  function showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      dialogMessage = message;
      dialogType = 'confirm';
      dialogVisible = true;
      dialogResolve = resolve;
    });
  }
  
  function handleDialogConfirm() {
    if (dialogResolve) {
      dialogResolve(true);
    }
    dialogVisible = false;
    dialogResolve = null;
  }
  
  function handleDialogCancel() {
    if (dialogResolve) {
      dialogResolve(false);
    }
    dialogVisible = false;
    dialogResolve = null;
  }

  onMount(async () => {
    projects.load();
    todos.load();
    
    const appWindow = getCurrentWindow();
    isAlwaysOnTop = await appWindow.isAlwaysOnTop();
    
    todos.subscribe(ts => {
      if (ts.length > 0) {
        nextTodoId = Math.max(...ts.map(t => t.id)) + 1;
      }
    });
  });

  function addTodo() {
    if (!newTodoText.trim()) return;
    
    const now = new Date().toISOString();
    const newTodo: Todo = {
      id: nextTodoId++,
      text: newTodoText,
      description: '',
      status: 'not-started',
      weight: 3,
      projectId: $currentProjectId,
      dueDate: null,
      expectedStartDate: null,
      expectedEndDate: null,
      actualStartDate: null,
      actualEndDate: null,
      subTasks: [],
      createdAt: now,
      updatedAt: now,
      expanded: false
    };
    
    todos.add(newTodo);
    newTodoText = '';
  }
  
  function toggleTodoStatus(e: Event, todo: Todo) {
    const hasIncompleteSubtasks = todo.subTasks.some(st => !st.done);
    
    if (hasIncompleteSubtasks && todo.status !== 'done') {
      showConfirm('This todo has incomplete subtasks. Mark all as complete?').then(confirmed => {
        if (confirmed) {
          todos.update(todo.id, {
            status: 'done',
            subTasks: todo.subTasks.map(st => ({ ...st, done: true }))
          });
        } else {
          (e.target as HTMLInputElement).checked = false;
          todos.update(todo.id, { status: todo.status });
        }
      });
    } else {
      const newStatus: TodoStatus = todo.status === 'done' ? 'not-started' : 'done';
      todos.update(todo.id, { status: newStatus });
    }
  }

  function cycleStatus(todo: Todo) {
    const statusCycle: TodoStatus[] = ['not-started', 'in-progress', 'done'];
    const currentIndex = statusCycle.indexOf(todo.status);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    if (nextStatus === 'done' && todo.subTasks.some(st => !st.done)) {
      showConfirm('This todo has incomplete subtasks. Mark all as complete?').then(confirmed => {
        if (confirmed) {
          todos.update(todo.id, {
            status: 'done',
            subTasks: todo.subTasks.map(st => ({ ...st, done: true }))
          });
        }
      });
      return;
    }
    
    todos.update(todo.id, { status: nextStatus });
  }

  function toggleExpanded(todo: Todo) {
    todos.update(todo.id, { expanded: !todo.expanded });
  }

  function deleteTodo(id: number) {
    showConfirm('Delete this todo?').then(confirmed => {
      if (confirmed) {
        todos.delete(id);
      }
    });
  }

  function openEditModal(todo: Todo) {
    showEditModal = true;
    editingTodo = { ...todo };
  }

  function saveEditedTodo() {
    if (!editingTodo) return;
    editingTodo.subTasks = editingTodo.subTasks.filter(st => st.text.trim() !== '');
    
    if (editingTodo.expanded && editingTodo.subTasks.length === 0 && !editingTodo.description) {
      editingTodo.expanded = false;
    }

    todos.update(editingTodo.id, editingTodo);
    editingTodo = null;
    showEditModal = false;
  }

  function addSubTask() {
    if (!editingTodo) return;
    
    editingTodo.subTasks = [
      ...editingTodo.subTasks,
      { id: nextSubTaskId++, text: '', done: false }
    ];
  }

  function removeSubTask(index: number) {
    if (!editingTodo) return;
    editingTodo.subTasks = editingTodo.subTasks.filter((_, i) => i !== index);
  }

  function toggleSubTask(index: number, autoSave: boolean = false) {
    if (!editingTodo) return;
    editingTodo.subTasks = editingTodo.subTasks.map((st, i) => 
      i === index ? { ...st, done: !st.done } : st
    );
    if (autoSave) {
      saveEditedTodo();
    }
  }

  function openNewProjectModal() {
    showProjectDropdown = false;
    // randomize for every time modal shown
    newProjectColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    showProjectModal = true;
  }

  function addProject() {
    if (!newProjectName.trim()) return;
    
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: newProjectName,
      color: newProjectColor,
      isPersonal: false
    };
    
    projects.add(newProject);
    newProjectName = '';
    showProjectModal = false;

    selectProject(newProject.id);
  }

  function selectProject(projectId: string) {
    currentProjectId.set(projectId);
    showProjectDropdown = false;
  }

  function handleProjectContextMenu(event: MouseEvent, projectId: string) {
    event.preventDefault();
    if (projectId === 'personal') return; // cannot delete personal project
    const menuWidth = 135;
    const menuHeight = 40;

    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    projectContextMenu = { visible: true, x, y, projectId };
  }

  function closeProjectContextMenu() {
    projectContextMenu.visible = false;
  }

  function removeProject(projectId: string) {
    closeProjectContextMenu()
    showConfirm(`Delete <br><b class="break-all">${projects.getById(projectId)?.name}</b><br> project? All associated todos will also be deleted.`).then(confirmed => {
      if (confirmed) {
        projects.delete(projectId);
        todos.deleteByProject(projectId);
        if ($currentProjectId === projectId) {
          currentProjectId.set('personal');
        }
      }
    });
  }

  async function toggleAlwaysOnTop() {
    const appWindow = getCurrentWindow();
    isAlwaysOnTop = !isAlwaysOnTop;
    await appWindow.setAlwaysOnTop(isAlwaysOnTop);
  }

  async function minimizeWindow() {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  }

  async function closeWindow() {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  }

  function getStatusColor(status: TodoStatus): string {
    switch (status) {
      case 'not-started': return 'bg-gray-200 text-gray-700';
      case 'in-progress': return 'bg-yellow-200 text-yellow-700';
      case 'done': return 'bg-green-200 text-green-700';
    }
  }

  function getStatusLabel(status: TodoStatus): string {
    switch (status) {
      case 'not-started': return 'Not Started';
      case 'in-progress': return 'In Progress';
      case 'done': return 'Done';
    }
  }

  function isOverdue(todo: Todo): boolean {
    if (!todo.dueDate || todo.status === 'done') return false;
    const today = new Date().toISOString().split('T')[0];
    return todo.dueDate < today;
  }

  $: currentProject = $projects.find(p => p.id === $currentProjectId);
  $: isPersonalProject = currentProject?.isPersonal || false;
</script>

<div class="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col" >
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
  <div class="flex-1 p-4 overflow-auto" on:click={() => { if (showProjectDropdown) showProjectDropdown = false } }>
    <!-- Quick Add -->
    <form on:submit|preventDefault={addTodo} class="mb-4">
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newTodoText}
          placeholder="What do you need to do?"
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

    <!-- Todo List -->
    <div class="space-y-2">
      {#each $sortedTodos as todo (todo.id)}
        <div class="bg-white rounded-lg shadow-sm border-l-4" style="border-color: {currentProject?.color}">
          <!-- Main Todo Row -->
          <div class="flex items-start gap-2 p-3">
            <input
              type="checkbox"
              checked={todo.status === 'done'}
              on:change={(e) => toggleTodoStatus(e, todo)}
              class="w-5 h-5 text-blue-500 mt-1 flex-shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="{todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'} {isOverdue(todo) ? 'text-red-600 font-medium' : ''}">
                  {todo.text}
                </span>
                {#if todo.weight >= 4}
                  <span class="text-red-500 text-xs">⭐</span>
                {/if}
              </div>
              
              <div class="flex gap-2 items-center flex-wrap">
                <button
                  on:click={() => cycleStatus(todo)}
                  class="text-xs px-2 py-1 rounded {getStatusColor(todo.status)}"
                >
                  {getStatusLabel(todo.status)}
                </button>
                
                {#if todo.dueDate}
                  <span class="text-xs {isOverdue(todo) ? 'text-red-600 font-medium' : 'text-gray-600'}">
                    📅 {todo.dueDate}
                  </span>
                {/if}
                
                {#if todo.subTasks.length > 0}
                  <span class="text-xs text-gray-500">
                    ✓ {todo.subTasks.filter(st => st.done).length}/{todo.subTasks.length}
                  </span>
                {/if}
              </div>
            </div>
            
            <div class="flex gap-1 flex-shrink-0">
              {#if todo.description || todo.subTasks.length > 0}
                <button
                  on:click={() => toggleExpanded(todo)}
                  class="px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded"
                >
                  {todo.expanded ? '▼' : '▲'}
                </button>
              {/if}
              <button
                on:click={() => openEditModal(todo)}
                class="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
              >
                Edit
              </button>
              <button
                on:click={() => deleteTodo(todo.id)}
                class="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
              >
                Del
              </button>
            </div>
          </div>
          
          <!-- Accordion Content -->
          {#if todo.expanded}
            <div class="px-3 pb-3 border-t border-gray-100 pt-3">
              {#if todo.description}
                <div class="mb-3">
                  <p class="text-xs font-medium text-gray-600 mb-1">Description:</p>
                  <p class="text-sm text-gray-700 whitespace-pre-wrap">{todo.description}</p>
                </div>
              {/if}
              
              {#if todo.subTasks.length > 0}
                <div>
                  <p class="text-xs font-medium text-gray-600 mb-2">Subtasks:</p>
                  <div class="space-y-1">
                    {#each todo.subTasks as subtask, i}
                      <div class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={subtask.done}
                          on:change={() => { editingTodo = { ...todo }; toggleSubTask(i, true); }}
                          class="w-4 h-4"
                        />
                        <span class="{subtask.done ? 'line-through text-gray-400' : 'text-gray-700'}">
                          {subtask.text}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if $sortedTodos.length === 0}
      <p class="text-center text-gray-400 mt-8">No todos yet. Add one above!</p>
    {/if}
  </div>

  <!-- Footer Status Bar (VSCode-like) -->
  <div class="bg-gray-800 text-gray-300 text-xs px-3 py-1 flex items-center gap-0">
    <!-- Project Dropdown -->
    <div class="relative" title="{currentProject?.name}">
      <button
        on:click={() => showProjectDropdown = !showProjectDropdown}
        class="flex items-center gap-1 hover:bg-gray-700 px-2 py-1 rounded"
      >
        <span class="w-2 h-2 rounded-full" style="background-color: {currentProject?.color}"></span>
        <span class="truncate max-w-[48px] overflow-hidden whitespace-nowrap">
          {currentProject?.name || 'Select Project'}
        </span>
        <span class="text-[10px]">{showProjectDropdown ? '▼' : '▲'}</span>
      </button>
      
      {#if showProjectDropdown}
        <div class="absolute bottom-full left-0 mb-1 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-[150px]">
          <button
            on:click={openNewProjectModal}
            class="w-full text-left px-3 py-2 hover:bg-gray-700 text-blue-400 border-b border-gray-700"
          >
            + New Project
          </button>
          {#each $projects as project}
          <div role="menu" tabindex="0" on:contextmenu={(e) => handleProjectContextMenu(e, project.id)}>
            <button
              on:click={() => selectProject(project.id)}
              class="w-full text-left px-3 py-2 hover:bg-gray-700 flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full" style="background-color: {project.color}"></span>
              <span>{project.name}</span>
            </button>
          </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <div class="h-4 w-px bg-gray-600"></div>
    
    <!-- Group By -->
    <div class="flex items-center gap-1">
      <span class="text-gray-500">Group:</span>
      <select bind:value={$groupBy} class="bg-transparent border-none focus:outline-none cursor-pointer">
        <option value="none">All</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="overdue">Overdue</option>
      </select>
    </div>
    
    <div class="h-4 w-px bg-gray-600"></div>
    
    <!-- Sort By -->
    <div class="flex items-center gap-1">
      <span class="text-gray-500">Sort:</span>
      <select bind:value={$sortBy} class="bg-transparent border-none focus:outline-none cursor-pointer">
        <option value="createdAt">Created</option>
        <option value="dueDate">Due Date</option>
        <option value="weight">Priority</option>
        <option value="status">Status</option>
      </select>
    </div>
    
    <div class="ml-auto text-gray-500">
      {$sortedTodos.length} {$sortedTodos.length === 1 ? 'task' : 'tasks'}
    </div>
  </div>

  
  <!-- Context Menu -->
  {#if projectContextMenu.visible}
    <div class="fixed inset-0 z-50" on:click={closeProjectContextMenu}>
      <div 
        class="absolute bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-[135px] h-[40px]"
        style="left: {projectContextMenu.x}px; top: {projectContextMenu.y}px;"
        on:click|stopPropagation
      >
        <!-- <button class="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm">
          Edit
        </button> -->
        <button class="w-full text-left px-2 py-1 hover:bg-gray-100 text-sm text-red-600" on:click={() => removeProject(projectContextMenu.projectId!)}>
          Delete
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Edit Modal (Fullscreen Mobile-like) -->
{#if showEditModal && editingTodo}
  <div class="fixed inset-0 bg-white mt-[45px] z-50 flex flex-col">
    <!-- Modal Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <h2 class="text-lg font-bold">Edit Todo</h2>
      <div class="flex gap-2">
        <button on:click={saveEditedTodo} class="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
          Save
        </button>
        <button on:click={() => { editingTodo = null; showEditModal = false }} class="px-4 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
          Cancel
        </button>
      </div>
    </div>
    
    <!-- Modal Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <label class="block mb-4">
        <span class="text-sm font-medium text-gray-700">Title</span>
        <input type="text" bind:value={editingTodo.text} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
      </label>
      
      <label class="block mb-4">
        <span class="text-sm font-medium text-gray-700">Description</span>
        <textarea bind:value={editingTodo.description} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" rows="3"></textarea>
      </label>
      
      <label class="block mb-4">
        <span class="text-sm font-medium text-gray-700">Project</span>
        <select bind:value={editingTodo.projectId} class="w-full px-3 py-2 border border-gray-300 rounded mt-1">
          {#each $projects as project}
            <option value={project.id}>{project.name}</option>
          {/each}
        </select>
      </label>
      
      <label class="block mb-4">
        <span class="text-sm font-medium text-gray-700">Priority (1-5)</span>
        <input type="number" min="1" max="5" bind:value={editingTodo.weight} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
      </label>
      
      {#if isPersonalProject}
        <label class="block mb-4">
          <span class="text-sm font-medium text-gray-700">Due Date</span>
          <input type="date" bind:value={editingTodo.dueDate} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
        </label>
      {:else}
        <label class="block mb-4">
          <span class="text-sm font-medium text-gray-700">Expected Start Date</span>
          <input type="date" bind:value={editingTodo.expectedStartDate} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
        </label>
        
        <label class="block mb-4">
          <span class="text-sm font-medium text-gray-700">Expected End Date</span>
          <input type="date" bind:value={editingTodo.expectedEndDate} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
        </label>
        
        <label class="block mb-4">
          <span class="text-sm font-medium text-gray-700">Actual Start Date</span>
          <input type="date" bind:value={editingTodo.actualStartDate} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
        </label>
        
        <label class="block mb-4">
          <span class="text-sm font-medium text-gray-700">Actual End Date</span>
          <input type="date" bind:value={editingTodo.actualEndDate} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
        </label>
      {/if}
      
      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700">Subtasks</span>
          <button on:click={addSubTask} class="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">+ Add</button>
        </div>
        {#each editingTodo.subTasks as subtask, i}
          <div class="flex gap-2 mb-2">
            <input
              type="checkbox"
              checked={subtask.done}
              on:change={() => toggleSubTask(i)}
              class="w-5 h-5 flex-shrink-0 mt-1"
            />
            <input
              type="text"
              bind:value={subtask.text}
              class="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="Subtask..."
            />
            <button on:click={() => removeSubTask(i)} class="text-red-500 text-sm px-2 hover:bg-red-50 rounded">Del</button>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Custom Dialog Modal -->
{#if dialogVisible}
  <div class="fixed inset-0 bg-black/75  mt-[45px] z-[100] flex items-center justify-center p-4" on:click={handleDialogCancel}>
    <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" on:click|stopPropagation>
      <p class="text-gray-800 mb-6 text-center">{@html dialogMessage}</p>
      <div class="flex gap-2 justify-end">
        {#if dialogType === 'confirm'}
          <button
            on:click={handleDialogCancel}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        {/if}
        <button
          on:click={handleDialogConfirm}
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          {dialogType === 'confirm' ? 'OK' : 'OK'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Project Modal (Fullscreen Mobile-like) -->
{#if showProjectModal}
  <div class="fixed inset-0 bg-white mt-[45px] z-50 flex flex-col">
    <!-- Modal Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <h2 class="text-lg font-bold">New Project</h2>
      <div class="flex gap-2">
        <button on:click={addProject} class="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
          Create
        </button>
        <button on:click={() => showProjectModal = false} class="px-4 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
          Cancel
        </button>
      </div>
    </div>
    
    <!-- Modal Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <label class="block mb-4">
        <span class="text-sm font-medium text-gray-700">Project Name</span>
        <input type="text" bind:value={newProjectName} class="w-full px-3 py-2 border border-gray-300 rounded mt-1" />
      </label>
      
      <label class="block mb-4">
        <span class="text-sm font-medium text-gray-700">Color</span>
        <input type="color" bind:value={newProjectColor} class="w-full h-12 border border-gray-300 rounded mt-1" />
      </label>
    </div>
  </div>
{/if}