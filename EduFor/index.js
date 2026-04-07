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
  } catch (e) {}
}

// ── Add ─────────────────────────────────────────────────────
function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function addTask() {
  const input = document.getElementById('task-input');
  const texto = capitalizeFirst(input.value.trim());
  if (!texto) { showToast('empty'); return; }
  if (tasks.length >= 10) { showToast('limit'); return; }

  tasks.push({ id: Date.now(), text: texto, done: false, completedAt: null });
  saveTasks();
  input.value = '';
  updateCharCounter(0);
  renderTasks();
  updateProgress();
}

function updateCharCounter(length) {
  const counter = document.getElementById('char-counter');
  if (!counter) return;
  counter.textContent = length + '/450';
  counter.classList.toggle('char-counter-warning', length >= 400);
  counter.classList.toggle('char-counter-limit', length === 450);
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

  textSpan.innerHTML = `<input class="edit-input" type="text" value="${escapeAttr(task.text)}" maxlength="120">`;
  const editInput = textSpan.querySelector('.edit-input');
  editInput.focus();
  editInput.select();

  let saved = false;

  function confirmEdit() {
    if (saved) return;
    saved = true;

    let novo = editInput.value.trim();

    // 🔹 Deixa a primeira letra maiúscula se for uma letra
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

  editInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confirmEdit();
    if (e.key === 'Escape') { saved = true; item.classList.remove('editing'); renderTasks(); }
    e.stopPropagation();
  });
  editInput.addEventListener('blur', confirmEdit);
  editInput.addEventListener('mousedown', e => e.stopPropagation());
}

// ── Drag & Drop ──────────────────────────────────────────────
function attachDragListeners(item) {
  item.addEventListener('mousedown', onMouseDown);
}

function onMouseDown(e) {
  if (e.target.closest('button') || e.target.closest('input')) return;

  const item = e.currentTarget;
  const lista = document.getElementById('task-list');
  const rect = item.getBoundingClientRect();
  const offsetY = e.clientY - rect.top;
  const offsetX = e.clientX - rect.left;

  const ghost = item.cloneNode(true);
  ghost.id = 'drag-ghost';
  ghost.style.cssText = `
    position: fixed;
    z-index: 9999;
    width: ${rect.width}px;
    left: ${rect.left}px;
    top: ${rect.top}px;
    opacity: 0.92;
    pointer-events: none;
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.18);
    transform: rotate(1.2deg) scale(1.02);
    background: #fff;
    padding: 14px 12px;
  `;
  document.body.appendChild(ghost);

  item.classList.add('dragging');
  dragSrc = item;

  function onMouseMove(e) {
    ghost.style.top = (e.clientY - offsetY) + 'px';
    ghost.style.left = (e.clientX - offsetX) + 'px';

    lista.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));

    const els = lista.querySelectorAll('.task-item:not(.dragging)');
    let target = null;
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) target = el;
    });

    if (target) {
      const r = target.getBoundingClientRect();
      target.classList.add('drag-over');
      if (e.clientY > r.top + r.height / 2) target.classList.add('drag-over-bottom');
      dragOverEl = { el: target, below: e.clientY > r.top + r.height / 2 };
    } else {
      dragOverEl = null;
    }
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

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

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// ── Render ────────────────────────────────────────────────────
function renderTasks() {
  const lista = document.getElementById('task-list');
  lista.innerHTML = '';

  if (tasks.length === 0) {
    lista.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon"><i class="bi bi-emoji-neutral"></i></span>
        <p>Nenhuma tarefa ainda.<br>Adicione uma acima!</p>
      </div>`;
    return;
  }

  let filtered = tasks;

  if (currentTab === 'done') {
    filtered = tasks.filter(t => t.done);
  }

  if (filtered.length === 0) {
    const mensagem = currentTab === 'done'
      ? 'Nenhuma tarefa concluída.<br>Marque uma tarefa como concluída!'
      : 'Nenhuma tarefa ainda.<br>Adicione uma acima!';

    lista.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon"><i class="bi bi-emoji-neutral"></i></span>
        <p>${mensagem}</p>
      </div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => a.done - b.done);

  sorted.forEach((task, index) => {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.done ? ' done' : '');
    item.dataset.id = task.id;
    item.style.animationDelay = (index * 0.04) + 's';

    item.innerHTML = `
      <span class="drag-handle">${dragHandleIcon()}</span>
      <button class="task-check" onclick="toggleTask(${task.id})" aria-label="Marcar como concluída">
        ${task.done ? checkIcon() : ''}
      </button>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <div class="task-actions">
        <button class="task-edit" onclick="startEdit(${task.id})" aria-label="Editar tarefa">
          ${pencilIcon()}
        </button>
        <button class="task-delete" onclick="deleteTask(${task.id})" aria-label="Remover tarefa">
          ${trashIcon()}
        </button>
      </div>
    `;

    attachDragListeners(item);
    lista.appendChild(item);
  });
}

// ── Icons ─────────────────────────────────────────────────────
function checkIcon() {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function pencilIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function trashIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-.867 13.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function dragHandleIcon() {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="4.5" cy="3.5" r="1.2" fill="currentColor"/><circle cx="9.5" cy="3.5" r="1.2" fill="currentColor"/><circle cx="4.5" cy="7" r="1.2" fill="currentColor"/><circle cx="9.5" cy="7" r="1.2" fill="currentColor"/><circle cx="4.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="9.5" cy="10.5" r="1.2" fill="currentColor"/></svg>`;
}

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(text) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(text));
  return d.innerHTML;
}
function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// ── Toast notifications ───────────────────────────────────────
let toastTimer = null;
function showToast(type) {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const messages = {
    limit: { 
      icon: '<i class="bi bi-x-circle"></i>', 
      text: 'Limite atingido! Exclua uma tarefa para adicionar outra.' 
    },
    empty: { 
      icon: '<i class="bi bi-pencil"></i>', 
      text: 'A tarefa não pode ser vazia.' 
    }
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

// ── Confirm modal ─────────────────────────────────────────────
function showConfirm(id) {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();

  const task = tasks.find(t => t.id === id);
  const preview = task ? `"${task.text.length > 40 ? task.text.slice(0, 40) + '…' : task.text}"` : 'esta tarefa';

  const overlay = document.createElement('div');
  overlay.id = 'confirm-modal';
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon"><i class="bi bi-trash"></i></div>
      <p class="confirm-title">Excluir tarefa?</p>
      <p class="confirm-desc">${escapeHtml(preview)} será removida permanentemente.</p>
      <div class="confirm-buttons">
        <button class="confirm-btn confirm-btn--cancel" id="confirm-cancel">Cancelar</button>
        <button class="confirm-btn confirm-btn--delete" id="confirm-ok">Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('confirm-overlay--visible'));

  function close() {
    overlay.classList.remove('confirm-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  }

  document.getElementById('confirm-cancel').addEventListener('click', close);
  document.getElementById('confirm-ok').addEventListener('click', () => {
    close();
    confirmDelete(id);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    if (e.key === 'Enter') { close(); confirmDelete(id); document.removeEventListener('keydown', onKey); }
  });
}
function updateProgress() {
  const total = tasks.length;
  const concluidas = tasks.filter(t => t.done).length;

  const fill = document.getElementById('progresso-fill');
  const texto = document.getElementById('progresso-texto');
  const clearBtn = document.getElementById('clear-completed');

  if (total === 0) {
    fill.style.width = '0%';
    texto.textContent = 'Nenhuma tarefa concluída';
  } else {
    fill.style.width = ((concluidas / total) * 100) + '%';
    texto.textContent = `${concluidas} de ${total} tarefas concluídas`;
  }

  if (clearBtn) {
    clearBtn.textContent = `Limpar concluídas (${concluidas})`;
    clearBtn.style.display = concluidas > 0 ? 'block' : 'none';
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

  document.querySelector('.add-task-button').addEventListener('click', addTask);

  const input = document.getElementById('task-input');
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter') addTask();
  });
  input.addEventListener('input', () => updateCharCounter(input.value.length));

  // 🔥 AQUI DENTRO
  const indicator = document.querySelector('.tab-indicator');

  document.querySelectorAll('.tab').forEach((btn, index) => {
    btn.addEventListener('click', () => {

      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentTab = btn.dataset.tab;
      renderTasks();

      // 🔥 move o indicador
      indicator.style.transform = `translateX(${index * 100}%)`;
    });
  });

  document.getElementById('clear-completed').addEventListener('click', clearCompleted);

  renderTasks();
  updateProgress();
});


// Escrever de qualquer lugar da pagina

document.addEventListener('keydown', function (e) {
  const input = document.getElementById('task-input');

  // ❌ NÃO ativar se já estiver digitando em algum input
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
    return;
  }

  // ❌ Ignora teclas especiais
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // ✅ Só reage a teclas que geram caractere
  if (e.key.length === 1) {
    input.focus();

    // coloca o caractere digitado dentro do input
    input.value += e.key;

    // atualiza contador
    updateCharCounter(input.value.length);

    e.preventDefault();
  }
});

// Seção do Clear das concluidas

const clearBtn = document.getElementById('clear-completed');
clearBtn.textContent = `Limpar concluídas (${concluidas})`;
clearBtn.style.display = concluidas > 0 ? 'block' : 'none';

function clearCompleted() {
  const concluidas = tasks.filter(t => t.done);

  if (concluidas.length === 0) return;

  showConfirmClear();
}

function showConfirmClear() {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();

  const total = tasks.filter(t => t.done).length;

  const overlay = document.createElement('div');
  overlay.id = 'confirm-modal';
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon"><i class="bi bi-trash"></i></div>
      <p class="confirm-title">Limpar concluídas?</p>
      <p class="confirm-desc">${total} tarefa(s) serão removidas.</p>
      <div class="confirm-buttons">
        <button class="confirm-btn confirm-btn--cancel" id="confirm-cancel">Cancelar</button>
        <button class="confirm-btn confirm-btn--delete" id="confirm-ok">Limpar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('confirm-overlay--visible'));

  function close() {
    overlay.classList.remove('confirm-overlay--visible');
    setTimeout(() => overlay.remove(), 250);
  }

  document.getElementById('confirm-cancel').onclick = close;
  document.getElementById('confirm-ok').onclick = () => {
    tasks = tasks.filter(t => !t.done);
    saveTasks();
    renderTasks();
    updateProgress();
    close();
  };
}

document.getElementById('clear-completed').addEventListener('click', clearCompleted);


// Fim da sessao do botao de clear

// Botao Switch

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentTab = btn.dataset.tab;
    renderTasks();
  });
});