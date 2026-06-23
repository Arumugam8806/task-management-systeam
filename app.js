/* ==========================================
   TASKFLOW — app.js
   Full CRUD + LocalStorage + Search/Filter
   ========================================== */

'use strict';

// ─── State ───────────────────────────────
let tasks        = [];
let currentFilter = 'all';
let editingId     = null;
let deletingId    = null;

const STORAGE_KEY = 'taskflow_tasks';

// ─── Category / Priority helpers ─────────
const priorityLabels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
const categoryLabels = {
  general: '📁 General', work: '💼 Work',
  personal: '🏠 Personal', study: '📚 Study', health: '💪 Health'
};

// ─── Load / Save ─────────────────────────
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function generateId() {
  return 'tf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ─── Render ───────────────────────────────
function render() {
  updateStats();
  renderTaskList();
}

function getFilteredTasks() {
  const query   = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const sortVal = document.getElementById('sort-select')?.value || 'newest';

  let list = [...tasks];

  // Filter by status
  if (currentFilter === 'completed') list = list.filter(t => t.completed);
  if (currentFilter === 'pending')   list = list.filter(t => !t.completed);

  // Search
  if (query) {
    list = list.filter(t =>
      t.name.toLowerCase().includes(query) ||
      (t.desc && t.desc.toLowerCase().includes(query))
    );
  }

  // Sort
  switch (sortVal) {
    case 'oldest':   list.sort((a, b) => a.createdAt - b.createdAt); break;
    case 'az':       list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'za':       list.sort((a, b) => b.name.localeCompare(a.name)); break;
    case 'priority': {
      const order = { high: 0, medium: 1, low: 2 };
      list.sort((a, b) => order[a.priority] - order[b.priority]);
      break;
    }
    default: list.sort((a, b) => b.createdAt - a.createdAt); // newest
  }

  return list;
}

function renderTaskList() {
  const container  = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const bulkLabel  = document.getElementById('bulk-label');
  if (!container) return;

  const list = getFilteredTasks();

  if (bulkLabel) bulkLabel.textContent = `${list.length} task${list.length !== 1 ? 's' : ''} shown`;

  if (list.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = list.map(task => taskCard(task)).join('');
}

function taskCard(task) {
  const date = new Date(task.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const priorityCls = `badge-${task.priority}`;
  const statusBadge = task.completed
    ? `<span class="badge badge-done"><i class="fa-solid fa-circle-check"></i> Done</span>`
    : `<span class="badge badge-pending"><i class="fa-solid fa-hourglass-half"></i> Pending</span>`;

  return `
  <div class="task-card ${task.completed ? 'completed' : ''}" id="task-${task.id}">
    <div class="task-checkbox" onclick="toggleComplete('${task.id}')" title="Mark as ${task.completed ? 'pending' : 'done'}">
      <i class="fa-solid fa-check"></i>
    </div>
    <div class="task-body">
      <div class="task-top">
        <div class="task-name">${escapeHtml(task.name)}</div>
      </div>
      ${task.desc ? `<div class="task-desc">${escapeHtml(task.desc)}</div>` : ''}
      <div class="task-meta">
        <span class="badge ${priorityCls}">${priorityLabels[task.priority]}</span>
        <span class="badge badge-cat">${categoryLabels[task.category] || task.category}</span>
        ${statusBadge}
        <span class="task-date"><i class="fa-regular fa-calendar"></i> ${date}</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="task-btn" onclick="openEditModal('${task.id}')" title="Edit">
        <i class="fa-solid fa-pen-to-square"></i>
      </button>
      <button class="task-btn delete" onclick="openDeleteModal('${task.id}')" title="Delete">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  </div>`;
}

// ─── Stats ────────────────────────────────
function updateStats() {
  const total     = tasks.length;
  const done      = tasks.filter(t => t.completed).length;
  const pending   = total - done;
  const rate      = total > 0 ? Math.round((done / total) * 100) : 0;

  setEl('stat-total',   total);
  setEl('stat-done',    done);
  setEl('stat-pending', pending);
  setEl('stat-rate',    rate + '%');
  setEl('stat-rate',    rate + '%');
  setEl('header-total', total);

  // Progress bar
  const fill = document.getElementById('progress-fill');
  const pct  = document.getElementById('progress-pct');
  if (fill) fill.style.width = rate + '%';
  if (pct)  pct.textContent  = rate + '%';
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── CRUD ─────────────────────────────────

// ADD / EDIT
function openModal() {
  editingId = null;
  setEl('modal-title', 'Add New Task');
  setEl('modal-save-btn', '<i class="fa-solid fa-floppy-disk"></i> Save Task');
  document.getElementById('task-input').value     = '';
  document.getElementById('task-desc').value      = '';
  document.getElementById('task-priority').value  = 'medium';
  document.getElementById('task-category').value  = 'general';
  setEl('char-used', '0');

  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Task';

  openOverlay('modal-overlay');
  setTimeout(() => document.getElementById('task-input')?.focus(), 100);
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;

  setEl('modal-title', 'Edit Task');

  document.getElementById('task-input').value    = task.name;
  document.getElementById('task-desc').value     = task.desc  || '';
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-category').value = task.category;
  setEl('char-used', task.name.length);

  const saveBtn = document.getElementById('modal-save-btn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Task';

  openOverlay('modal-overlay');
  setTimeout(() => document.getElementById('task-input')?.focus(), 100);
}

function saveTask() {
  const name     = document.getElementById('task-input').value.trim();
  const desc     = document.getElementById('task-desc').value.trim();
  const priority = document.getElementById('task-priority').value;
  const category = document.getElementById('task-category').value;

  if (!name) {
    shake(document.getElementById('task-input'));
    showToast('Task name is required!', 'error');
    return;
  }

  if (editingId) {
    const idx = tasks.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], name, desc, priority, category, updatedAt: Date.now() };
      showToast('Task updated!', 'success');
    }
  } else {
    const task = {
      id: generateId(), name, desc, priority, category,
      completed: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    tasks.unshift(task);
    showToast('Task added!', 'success');
  }

  saveTasks();
  closeModal();
  render();
}

// TOGGLE COMPLETE
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed  = !task.completed;
  task.updatedAt  = Date.now();
  saveTasks();
  render();
  showToast(
    task.completed ? '✅ Marked as done!' : '↩️ Moved back to pending',
    task.completed ? 'success' : 'info'
  );
}

// DELETE
function openDeleteModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  deletingId = id;
  const nameEl = document.getElementById('delete-task-name');
  if (nameEl) nameEl.textContent = `"${task.name}"`;
  openOverlay('delete-overlay');
}

function confirmDelete() {
  tasks = tasks.filter(t => t.id !== deletingId);
  saveTasks();
  closeDeleteModal();
  render();
  showToast('Task deleted.', 'info');
  deletingId = null;
}

// BULK
function markAllDone() {
  const list = getFilteredTasks();
  list.forEach(t => {
    const idx = tasks.findIndex(x => x.id === t.id);
    if (idx !== -1) tasks[idx].completed = true;
  });
  saveTasks(); render();
  showToast(`Marked ${list.length} task${list.length !== 1 ? 's' : ''} as done!`, 'success');
}

function clearCompleted() {
  const before = tasks.length;
  tasks = tasks.filter(t => !t.completed);
  const removed = before - tasks.length;
  saveTasks(); render();
  showToast(`Removed ${removed} completed task${removed !== 1 ? 's' : ''}.`, 'info');
}

// ─── Search / Filter / Sort ───────────────
function filterTasks() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');
  if (clear) clear.style.display = input?.value ? 'flex' : 'none';
  renderTaskList();
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) { input.value = ''; input.focus(); }
  const clear = document.getElementById('search-clear');
  if (clear) clear.style.display = 'none';
  renderTaskList();
}

function setFilter(btn, filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTaskList();
}

function sortTasks() { renderTaskList(); }

// ─── Modal Helpers ────────────────────────
function openOverlay(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; setTimeout(() => el.classList.add('open'), 10); }
  document.body.style.overflow = 'hidden';
}
function closeOverlay(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); setTimeout(() => el.style.display = 'none', 180); }
  document.body.style.overflow = '';
}
function closeModal()            { closeOverlay('modal-overlay'); }
function closeDeleteModal()      { closeOverlay('delete-overlay'); }
function closeModalOnOverlay(e)  { if (e.target.id === 'modal-overlay')  closeModal(); }
function closeDeleteOnOverlay(e) { if (e.target.id === 'delete-overlay') closeDeleteModal(); }

// ─── Toast ────────────────────────────────
function showToast(msg, type = 'info') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} toast-icon"></i><span>${msg}</span>`;
  wrap.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(60px)'; }, 2800);
  setTimeout(() => toast.remove(), 3200);
}

// ─── Utils ────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function shake(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
}

// Inject shake keyframe once
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60%  { transform: translateX(-6px); }
  40%, 80%  { transform: translateX(6px); }
}`;
document.head.appendChild(shakeStyle);

// ─── Keyboard Shortcuts ───────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault(); openModal();
  }
});

// ─── Char Counter ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const input   = document.getElementById('task-input');
  const counter = document.getElementById('char-used');
  if (input && counter) {
    input.addEventListener('input', () => counter.textContent = input.value.length);
  }
});

// ─── Init ─────────────────────────────────
loadTasks();
render();
