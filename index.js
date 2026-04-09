let tasks = loadTasks();
let currentTab = 'all';

// ── Drag state ──────────────────────────────────────────────
let dragSrc = null;
let dragOverEl = null;

// ── Storage ─────────────────────────────────────────────────
function loadTasks() {
  try {
    const dados = localStorage.getItem('tasks');
    return dados ? JSON.parse(dados) : [];
  } catch (e) {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  } catch (e) { }
}

// ── Helpers ─────────────────────────────────────────────────
function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(text));
  return d.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatCompletionDate(isoString) {
  if (!isoString) return '';
  const data = new Date(isoString);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ── Add ─────────────────────────────────────────────────────
function addTask() {
  const input = document.getElementById('task-input');
  const texto = capitalizeFirst(input.value.trim());
  if (!texto) { showToast('empty'); return; }
  if (tasks.length >= 10) { showToast('limit'); return; }

  tasks.unshift({
    id: Date.now(),
    text: texto,
    done: false,
    completedAt: null
  });

  saveTasks();
  input.value = '';
  updateCharCounter(0);
  renderTasks();
  updateProgress();
}

function updateCharCounter(length) {
  const counter = document.getElementById('char-counter');
  if (!counter) return;
  counter.textContent = length + '/200';
  counter.classList.toggle('char-counter-warning', length >= 180);
  counter.classList.toggle('char-counter-limit', length === 200);
}

// ── Toggle done ─────────────────────────────────────────────
function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;

  t.done = !t.done;
  t.completedAt = t.done ? new Date().toISOString() : null;

  saveTasks();
  renderTasks();
  updateProgress();
}

// ── Delete ───────────────────────────────────────────────────
function deleteTask(id) {
  showConfirm(id);
}

function confirmDelete(id) {
  const el = document.querySelector(`.task-item[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('removing');
  setTimeout(() => {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    updateProgress();
  }, 280);
}

// ── Edit ─────────────────────────────────────────────────────
function startEdit(id) {
  const item = document.querySelector(`.task-item[data-id="${id}"]`);
  if (!item || item.classList.contains('editing')) return;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  item.classList.add('editing');
  const textSpan = item.querySelector('.task-text');

  textSpan.innerHTML = `<input class="edit-input" type="text" value="${escapeAttr(task.text)}" maxlength="200">`;
  const editInput = textSpan.querySelector('.edit-input');
  editInput.focus();
  editInput.select();

  let saved = false;

  function confirmEdit() {
    if (saved) return;
    saved = true;
    let novo = editInput.value.trim();
    if (novo.length > 0 && /[a-zA-ZÀ-ÿ]/.test(novo[0])) {
      novo = novo[0].toUpperCase() + novo.slice(1);
    }
    if (novo && novo !== task.text) {
      task.text = novo;
      saveTasks();
    }
    item.classList.remove('editing');
    renderTasks();
  }

  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmEdit();
    if (e.key === 'Escape') { saved = true; renderTasks(); }
    e.stopPropagation();
  });
  editInput.addEventListener('blur', confirmEdit);
}

// ── UNIVERSAL DRAG HANDLER (Mouse & Touch) ──────────────────
function attachDragListeners(item) {
  item.addEventListener('mousedown', startDrag);
  item.addEventListener('touchstart', startDrag, { passive: false });
}

function startDrag(e) {
  // Ignora se clicar em botões internos
  if (e.target.closest('button') || e.target.closest('input')) return;

  const isTouch = e.type === 'touchstart';
  const eventObj = isTouch ? e.touches[0] : e;
  const item = e.currentTarget;
  const lista = document.getElementById('task-list');
  const rect = item.getBoundingClientRect();

  const offsetY = eventObj.clientY - rect.top;
  const offsetX = eventObj.clientX - rect.left;

  // Ghost element para feedback visual
  const ghost = item.cloneNode(true);
  ghost.id = 'drag-ghost';
  ghost.style.cssText = `position: fixed; z-index: 9999; width: ${rect.width}px; left: ${rect.left}px; top: ${rect.top}px; opacity: 0.92; pointer-events: none; transform: rotate(1.2deg) scale(1.02); background: #fff; padding: 16px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.18);`;
  document.body.appendChild(ghost);

  item.classList.add('dragging');
  dragSrc = item;

  // Se for touch, impede o scroll da página enquanto arrasta
  if (isTouch) e.preventDefault();

  function moveDrag(moveEvent) {
    const moveObj = moveEvent.type === 'touchmove' ? moveEvent.touches[0] : moveEvent;

    ghost.style.top = (moveObj.clientY - offsetY) + 'px';
    ghost.style.left = (moveObj.clientX - offsetX) + 'px';

    lista.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));

    const els = lista.querySelectorAll('.task-item:not(.dragging)');
    let target = null;

    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (moveObj.clientY >= r.top && moveObj.clientY <= r.bottom) target = el;
    });

    if (target) {
      const r = target.getBoundingClientRect();
      target.classList.add('drag-over');
      if (moveObj.clientY > r.top + r.height / 2) target.classList.add('drag-over-bottom');
      dragOverEl = { el: target, below: moveObj.clientY > r.top + r.height / 2 };
    } else {
      dragOverEl = null;
    }
  }

  function endDrag() {
    // Remove listeners globais
    window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', moveDrag);
    window.removeEventListener(isTouch ? 'touchend' : 'mouseup', endDrag);

    ghost.remove();
    dragSrc.classList.remove('dragging');
    lista.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));

    if (dragOverEl) {
      const srcId = parseInt(dragSrc.dataset.id);
      const tgtId = parseInt(dragOverEl.el.dataset.id);
      if (srcId !== tgtId) {
        const srcIdx = tasks.findIndex(t => t.id === srcId);
        const [moved] = tasks.splice(srcIdx, 1);
        const newTgtIdx = tasks.findIndex(t => t.id === tgtId);
        tasks.splice(dragOverEl.below ? newTgtIdx + 1 : newTgtIdx, 0, moved);
        saveTasks();
        renderTasks();
      }
    }
    dragSrc = null;
    dragOverEl = null;
  }

  window.addEventListener(isTouch ? 'touchmove' : 'mousemove', moveDrag, { passive: false });
  window.addEventListener(isTouch ? 'touchend' : 'mouseup', endDrag);
}

// ── Render ──────────────────────────────────────────────────
function renderTasks() {
  const lista = document.getElementById('task-list');
  lista.innerHTML = '';

  if (tasks.length === 0) {
    lista.innerHTML = `<div class="empty-state"><span class="empty-icon"><i class="bi bi-emoji-neutral"></i></span><p>Nenhuma tarefa ainda.<br>Adicione uma acima!</p></div>`;
    return;
  }

  let filtered = currentTab === 'done' ? tasks.filter(t => t.done) : tasks;

  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return new Date(b.completedAt) - new Date(a.completedAt);
    return 0;
  });

  sorted.forEach((task, index) => {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.done ? ' done' : '');
    item.dataset.id = task.id;
    item.style.animationDelay = (index * 0.04) + 's';

    item.innerHTML = `
            <span class="drag-handle">${dragHandleIcon()}</span>
            
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                <span class="task-text">${escapeHtml(task.text)}</span>
                ${task.done && task.completedAt ?
        `<small style="font-size: 11px; color: #8ab8c2; margin-top: 4px;">
                        Concluída em: ${formatCompletionDate(task.completedAt)}
                    </small>` : ''
      }
            </div>

            <div class="task-actions">
    ${task.done
        ? `<button class="btn-edit" onclick="toggleTask(${task.id})" title="Reverter tarefa">
               <i class="bi bi-arrow-counterclockwise"></i>
           </button>`
        : `<button class="btn-done" onclick="toggleTask(${task.id})">
               <i class="bi bi-check"></i>
           </button>
           <button class="btn-edit" onclick="startEdit(${task.id})">
               <i class="bi bi-pencil"></i>
           </button>`
    }

    <button class="btn-delete" onclick="deleteTask(${task.id})">
        <i class="bi bi-trash"></i>
    </button>
</div>
        `;

    attachDragListeners(item);
    lista.appendChild(item);
  });
}

// ── Icons (SVG) ───────────────────────────────────────────────
function pencilIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
function trashIcon() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-.867 13.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
function dragHandleIcon() { return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="4.5" cy="3.5" r="1.2" fill="currentColor"/><circle cx="9.5" cy="3.5" r="1.2" fill="currentColor"/><circle cx="4.5" cy="7" r="1.2" fill="currentColor"/><circle cx="9.5" cy="7" r="1.2" fill="currentColor"/><circle cx="4.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="9.5" cy="10.5" r="1.2" fill="currentColor"/></svg>`; }

// ── UI Feedbacks ─────────────────────────────────────────────
let toastTimer = null;
function showToast(type) {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const messages = {
    limit: { icon: '<i class="bi bi-x-circle"></i>', text: 'Limite de 10 atingido!' },
    empty: { icon: '<i class="bi bi-pencil"></i>', text: 'A tarefa não pode ser vazia.' }
  };

  const { icon, text } = messages[type];
  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = 'app-toast app-toast--' + type;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${text}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('app-toast--visible'));
  toastTimer = setTimeout(() => {
    toast.classList.remove('app-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showConfirm(id) {
  const task = tasks.find(t => t.id === id);
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `<div class="confirm-box"><p class="confirm-title">Excluir?</p><p class="confirm-desc">"${escapeHtml(task.text.slice(0, 20))}..."</p><div class="confirm-buttons"><button class="confirm-btn confirm-btn--cancel" id="c-cancel">Não</button><button class="confirm-btn confirm-btn--delete" id="c-ok">Sim</button></div></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('confirm-overlay--visible'));

  overlay.querySelector('#c-cancel').onclick = () => { overlay.classList.remove('confirm-overlay--visible'); setTimeout(() => overlay.remove(), 250); };
  overlay.querySelector('#c-ok').onclick = () => { overlay.remove(); confirmDelete(id); };
}

function showClearConfirm() {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `<div class="confirm-box"><p class="confirm-title">Limpar concluídas?</p><p class="confirm-desc">Isso removerá todas as tarefas concluídas permanentemente.</p><div class="confirm-buttons"><button class="confirm-btn confirm-btn--cancel" id="c-cancel">Não</button><button class="confirm-btn confirm-btn--delete" id="c-ok">Sim</button></div></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('confirm-overlay--visible'));

  overlay.querySelector('#c-cancel').onclick = () => { overlay.classList.remove('confirm-overlay--visible'); setTimeout(() => overlay.remove(), 250); };
  overlay.querySelector('#c-ok').onclick = () => { overlay.remove(); clearCompleted(); };
}

function updateProgress() {
  const total = tasks.length;
  const concluidas = tasks.filter(t => t.done).length;
  const fill = document.getElementById('progresso-fill');
  const texto = document.getElementById('progresso-texto');
  const clearBtn = document.getElementById('clear-completed');

  fill.style.width = total === 0 ? '0%' : ((concluidas / total) * 100) + '%';
  texto.textContent = total === 0 ? 'Nenhuma tarefa' : `${concluidas} de ${total} concluídas`;

  if (clearBtn) {
    clearBtn.textContent = `Limpar concluídas (${concluidas})`;
    clearBtn.style.display = concluidas > 0 ? 'block' : 'none';
  }
}

function clearCompleted() {
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  renderTasks();
  updateProgress();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.add-task-button').addEventListener('click', addTask);
  const input = document.getElementById('task-input');
  input.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });
  input.addEventListener('input', () => updateCharCounter(input.value.length));

  const indicator = document.querySelector('.tab-indicator');
  document.querySelectorAll('.tab').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      indicator.style.transform = `translateX(${index * 100}%)`;
      renderTasks();
    });
  });

  document.getElementById('clear-completed').addEventListener('click', showClearConfirm);

  renderTasks();
  updateProgress();
});