(() => {
      "use strict";

      // Estado e persistência
      const STORAGE_KEY = "meu-kanban-tarefas-v1";
      const statuses = ["todo", "doing", "done"];
      const examples = [
        {
          id: "exemplo-1",
          title: "Planejar a semana",
          description: "Definir prioridades e organizar as próximas entregas.",
          status: "todo"
        },
        {
          id: "exemplo-2",
          title: "Revisar referências do projeto",
          description: "Separar materiais e anotações importantes.",
          status: "doing"
        }
      ];

      let tasks = [];
      let draggedTaskId = null;
      let dropCommitted = false;
      let storageAvailable = true;

      const board = document.querySelector("#board");
      const dialog = document.querySelector("#task-dialog");
      const form = document.querySelector("#task-form");
      const titleInput = document.querySelector("#task-title-input");
      const descriptionInput = document.querySelector("#task-description-input");
      const storageNotice = document.querySelector("#storage-notice");

      function isValidTask(task) {
        return task !== null
          && typeof task === "object"
          && typeof task.id === "string"
          && task.id.length > 0
          && typeof task.title === "string"
          && typeof task.description === "string"
          && statuses.includes(task.status);
      }

      function loadTasks() {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);

          if (saved === null) {
            tasks = examples.map((task) => ({ ...task }));
            return;
          }

          const parsed = JSON.parse(saved);
          if (!Array.isArray(parsed) || !parsed.every(isValidTask)) {
            throw new Error("Os dados salvos não têm o formato esperado.");
          }

          const ids = new Set(parsed.map((task) => task.id));
          if (ids.size !== parsed.length) {
            throw new Error("Foram encontrados identificadores duplicados.");
          }

          tasks = parsed;
        } catch (error) {
          tasks = examples.map((task) => ({ ...task }));
          storageAvailable = false;
          storageNotice.hidden = false;
          console.warn("Não foi possível carregar as tarefas salvas.", error);
        }
      }

      function saveTasks() {
        try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        storageAvailable = true;
        storageNotice.hidden = true;
        } catch (error) {
        storageAvailable = false;
          storageNotice.hidden = false;
          console.warn("Não foi possível salvar as tarefas.", error);
        }
      }

      // Renderização
      function createTaskCard(task) {
        const card = document.createElement("article");
        card.className = "task-card";
        card.draggable = true;
        card.tabIndex = 0;
        card.dataset.taskId = task.id;
        card.setAttribute("aria-label", `Tarefa: ${task.title}. Arraste para mover entre colunas.`);

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description;

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const statusIndex = statuses.indexOf(task.status);
        const previousButton = document.createElement("button");
        previousButton.type = "button";
        previousButton.className = "move-button";
        previousButton.dataset.action = "previous";
        previousButton.textContent = "←";
        previousButton.disabled = statusIndex === 0;
        previousButton.setAttribute("aria-label", `Mover "${task.title}" para a coluna anterior`);
        previousButton.title = "Mover para a coluna anterior";

        const nextButton = document.createElement("button");
        nextButton.type = "button";
        nextButton.className = "move-button";
        nextButton.dataset.action = "next";
        nextButton.textContent = "→";
        nextButton.disabled = statusIndex === statuses.length - 1;
        nextButton.setAttribute("aria-label", `Mover "${task.title}" para a próxima coluna`);
        nextButton.title = "Mover para a próxima coluna";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.dataset.action = "delete";
        deleteButton.textContent = "Excluir";
        deleteButton.setAttribute("aria-label", `Excluir a tarefa "${task.title}"`);

        actions.append(previousButton, nextButton, deleteButton);
        card.append(title, description, actions);
        return card;
      }

      function render() {
        for (const status of statuses) {
          const list = board.querySelector(`[data-list="${status}"]`);
          const columnTasks = tasks.filter((task) => task.status === status);
          const fragment = document.createDocumentFragment();

          for (const task of columnTasks) {
            fragment.append(createTaskCard(task));
          }

          list.replaceChildren(fragment);

          const count = board.querySelector(`[data-count="${status}"]`);
          count.textContent = String(columnTasks.length);
          count.setAttribute(
            "aria-label",
            `${columnTasks.length} ${columnTasks.length === 1 ? "tarefa" : "tarefas"}`
          );

          board.querySelector(`[data-empty="${status}"]`).hidden = columnTasks.length > 0;
        }
      }

      // Ações
      function createTask(title, description) {
        const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `tarefa-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        tasks.unshift({
          id,
          title,
          description,
          status: "todo"
        });

        saveTasks();
        render();
      }

      function moveTask(taskId, direction) {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;

        const currentIndex = statuses.indexOf(task.status);
        const nextIndex = currentIndex + direction;

        if (nextIndex < 0 || nextIndex >= statuses.length) return;

        task.status = statuses[nextIndex];
        saveTasks();
        render();
      }

      function deleteTask(taskId) {
        tasks = tasks.filter((task) => task.id !== taskId);
        saveTasks();
        render();
      }

      board.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const card = button.closest(".task-card");
        if (!card) return;

        const { taskId } = card.dataset;

        if (button.dataset.action === "previous") {
          moveTask(taskId, -1);
        } else if (button.dataset.action === "next") {
          moveTask(taskId, 1);
        } else if (button.dataset.action === "delete") {
          deleteTask(taskId);
        }
      });

      // Arrastar e soltar
      board.addEventListener("dragstart", (event) => {
        const card = event.target.closest(".task-card");
        if (!card) return;

        draggedTaskId = card.dataset.taskId;
        dropCommitted = false;
        card.classList.add("is-dragging");

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedTaskId);
      });

      board.addEventListener("dragover", (event) => {
        const column = event.target.closest(".kanban-column");
        if (!column || !draggedTaskId) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        column.classList.add("is-drag-over");

        const list = column.querySelector(".task-list");
        const targetCard = event.target.closest(".task-card");

        if (!targetCard || targetCard.dataset.taskId === draggedTaskId) {
          if (!targetCard) list.append(document.querySelector(`[data-task-id="${CSS.escape(draggedTaskId)}"]`));
          return;
        }

        const draggedCard = document.querySelector(`[data-task-id="${CSS.escape(draggedTaskId)}"]`);
        if (!draggedCard) return;

        const bounds = targetCard.getBoundingClientRect();
        const insertAfter = event.clientY > bounds.top + bounds.height / 2;
        list.insertBefore(draggedCard, insertAfter ? targetCard.nextSibling : targetCard);
      });

      board.addEventListener("dragleave", (event) => {
        const column = event.target.closest(".kanban-column");
        if (column && !column.contains(event.relatedTarget)) {
          column.classList.remove("is-drag-over");
        }
      });

      board.addEventListener("drop", (event) => {
        const column = event.target.closest(".kanban-column");
        if (!column || !draggedTaskId) return;

        event.preventDefault();
        dropCommitted = true;

        const tasksById = new Map(tasks.map((task) => [task.id, task]));
        const updatedTasks = [];

        for (const status of statuses) {
          const list = board.querySelector(`[data-list="${status}"]`);
          for (const card of list.querySelectorAll(".task-card")) {
            const task = tasksById.get(card.dataset.taskId);
            if (task) {
              updatedTasks.push({ ...task, status });
            }
          }
        }

        tasks = updatedTasks;
        saveTasks();
        render();
      });

      board.addEventListener("dragend", () => {
        draggedTaskId = null;
        board.querySelectorAll(".is-drag-over").forEach((column) => {
          column.classList.remove("is-drag-over");
        });

        if (!dropCommitted) render();
      });

      // Modal
      document.querySelector("#add-task-button").addEventListener("click", () => {
        dialog.showModal();
        titleInput.focus();
      });

      document.querySelector("#cancel-button").addEventListener("click", () => {
        dialog.close();
      });

      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          dialog.close();
        }
      });

      dialog.addEventListener("close", () => {
        form.reset();
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();

        const title = titleInput.value.trim();
        if (!title) {
          titleInput.setCustomValidity("Informe um título para a tarefa.");
          titleInput.reportValidity();
          titleInput.addEventListener("input", () => titleInput.setCustomValidity(""), { once: true });
          return;
        }

        createTask(title, descriptionInput.value.trim());
        dialog.close();
      });

      loadTasks();
      render();
    })();
