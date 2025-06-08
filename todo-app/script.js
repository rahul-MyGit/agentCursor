const todoList = document.getElementById('todoList');
const newTodoInput = document.getElementById('newTodo');
const addTodoButton = document.getElementById('addTodo');

let todos = [];

function loadTodos() {
  const storedTodos = localStorage.getItem('todos');
  if (storedTodos) {
    todos = JSON.parse(storedTodos);
    renderTodos();
  }
}

function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function addTodo() {
  const todoText = newTodoInput.value.trim();
  if (todoText) {
    todos.push({ text: todoText, completed: false });
    saveTodos();
    renderTodos();
    newTodoInput.value = '';
  }
}

function toggleTodo(index) {
  todos[index].completed = !todos[index].completed;
  saveTodos();
  renderTodos();
}

function removeTodo(index) {
  todos.splice(index, 1);
  saveTodos();
  renderTodos();
}

function renderTodos() {
  todoList.innerHTML = '';
  todos.forEach((todo, index) => {
    const li = document.createElement('li');
    li.classList.toggle('completed', todo.completed);
    li.innerHTML = `
      <span>${todo.text}</span>
      <div>
        <button onclick="toggleTodo(${index})">Toggle</button>
        <button onclick="removeTodo(${index})">Remove</button>
      </div>
    `;
    todoList.appendChild(li);
  });
}

loadTodos();
addTodoButton.addEventListener('click', addTodo);