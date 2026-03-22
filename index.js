let tasks = loadTasks();    
let currentTab = 'all';     

function loadTasks() {
  try {
    const dados = localStorage.getItem('tasks');
    if (dados === null) return [];
    return JSON.parse(dados);
  } catch (erro) {
    console.error('Erro ao carregar tarefas:', erro);
    return [];
  }
}

function saveTasks() {       
  try {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  } catch (erro) {
    console.error('Erro ao salvar tarefas:', erro);
  }
}

function addTask() {
  const input = document.getElementById('task-input');
  const texto = input.value.trim();

  if (texto === '') {
    console.log('Tarefa vazia!');
    return;
  }
  if (tasks.length >= 10) {
    console.log('Limite de 10 tarefas atingido!');
    return;
  }

  const newTask = {
    id: Date.now(),
    text: texto,
    done: false,
    completedAt: null
  };

  tasks.push(newTask);
  saveTasks();
  input.value = '';
  console.log('Tarefa adicionada:', newTask);
  console.log('Total de tarefas:', tasks.length);
}

// Conecta o botao do html a função
document.addEventListener('DOMContentLoaded', function() {
  const button = document.querySelector('.add-task-button');
  button.addEventListener('click', addTask);
  
  // Permite adicionar tarefa pressionando Enter
  const input = document.getElementById('task-input');
  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addTask();
    }
  });
  
  console.log('Página carregada e botão conectado!');
});