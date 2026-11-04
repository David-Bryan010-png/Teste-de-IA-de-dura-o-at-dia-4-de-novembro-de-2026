"use strict";

const TOKEN_KEY = "meva_github_token";
const REPO_KEY = "meva_repository";
const WORKFLOW = "MEVA-INSTALADOR.yml";

function resolveRepository() {
  const saved = sessionStorage.getItem(REPO_KEY);

  if (saved && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(saved)) {
    return saved;
  }

  const queryRepo = new URLSearchParams(location.search).get("repo");

  if (queryRepo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(queryRepo)) {
    sessionStorage.setItem(REPO_KEY, queryRepo);
    return queryRepo;
  }

  const host = location.hostname;

  if (host.endsWith(".github.io")) {
    const owner = host.slice(0, -".github.io".length);
    const parts = location.pathname.split("/").filter(Boolean);
    const repo = parts[0] || `${owner}.github.io`;
    const result = `${owner}/${repo}`;

    sessionStorage.setItem(REPO_KEY, result);
    return result;
  }

  const manual = prompt(
    "Informe o repositório no formato owner/repo:"
  );

  if (manual && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(manual.trim())) {
    sessionStorage.setItem(REPO_KEY, manual.trim());
    return manual.trim();
  }

  return "";
}

const REPOSITORY = resolveRepository();

function repositoryParts() {
  const parts = REPOSITORY.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Repositório não identificado.");
  }
  return parts;
}

function show(id) {
  document.getElementById(id).classList.remove("hidden");
}

function hide(id) {
  document.getElementById(id).classList.add("hidden");
}

function message(id, value, success = false) {
  const element = document.getElementById(id);
  element.textContent = value;
  element.className = success
    ? "form-message success"
    : "form-message error";
}

async function github(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Token não configurado.");
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(
    `https://api.github.com${path}`,
    { ...options, headers }
  );

  if (response.status === 204) {
    return null;
  }

  const body = await response.text();

  if (!response.ok) {
    let detail = body;

    try {
      detail = JSON.parse(body).message || body;
    } catch (_) {}

    throw new Error(`${response.status}: ${detail.slice(0, 220)}`);
  }

  return body ? JSON.parse(body) : null;
}

async function getRepository() {
  const [owner, repo] = repositoryParts();

  return github(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  );
}

async function connect() {
  const repository = await getRepository();

  if (!repository.default_branch) {
    throw new Error("Não foi possível identificar a branch padrão.");
  }

  hide("tokenPanel");
  show("appPanel");
  message(
    "taskMessage",
    `Conectado a ${repository.full_name}. Branch padrão: ${repository.default_branch}.`,
    true
  );

  await loadJobs();
}

document.getElementById("tokenForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = event.submitter;
  const token = document.getElementById("tokenInput").value.trim();

  if (!token) return;

  button.disabled = true;
  button.textContent = "Verificando...";

  sessionStorage.setItem(TOKEN_KEY, token);

  try {
    await connect();
    document.getElementById("tokenInput").value = "";
  } catch (error) {
    sessionStorage.removeItem(TOKEN_KEY);
    message("tokenMessage", `Falha na conexão: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Conectar";
  }
});

document.getElementById("taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = document.getElementById("runBtn");
  const task = document.getElementById("taskInput").value.trim();
  const branchTyped = document.getElementById("branchInput").value.trim();
  const maxSteps = Number(document.getElementById("stepsInput").value);

  if (!task) {
    return message("taskMessage", "Descreva a tarefa.");
  }

  if (!Number.isInteger(maxSteps) || maxSteps < 8 || maxSteps > 20) {
    return message("taskMessage", "Use um limite entre 8 e 20.");
  }

  button.disabled = true;
  button.textContent = "Enviando...";

  try {
    const repository = await getRepository();
    const branch = branchTyped || repository.default_branch;
    const [owner, repo] = repositoryParts();

    await github(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify({
          ref: branch,
          inputs: {
            mode: "agent",
            task,
            branch,
            max_steps: String(maxSteps)
          }
        })
      }
    );

    message(
      "taskMessage",
      "Solicitação enviada ao GitHub Actions. Consulte as execuções abaixo.",
      true
    );

    document.getElementById("taskInput").value = "";
    setTimeout(loadJobs, 2500);
  } catch (error) {
    message("taskMessage", `Erro ao enviar: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Enviar tarefa";
  }
});

async function loadJobs() {
  const list = document.getElementById("jobsList");
  list.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "muted";
  loading.textContent = "Carregando execuções...";
  list.appendChild(loading);

  try {
    const [owner, repo] = repositoryParts();

    const data = await github(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/runs?per_page=8`
    );

    list.replaceChildren();

    const runs = data.workflow_runs || [];

    if (runs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Nenhuma execução encontrada.";
      list.appendChild(empty);
      return;
    }

    for (const run of runs) {
      const url = new URL(run.html_url);

      if (url.hostname !== "github.com") continue;

      const link = document.createElement("a");
      link.className = "job";
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const title = document.createElement("strong");
      title.textContent = `#${run.run_number} — ${run.display_title || run.name}`;

      const status = document.createElement("span");
      status.className = `status ${run.conclusion || run.status}`;
      status.textContent = run.conclusion || run.status;

      link.append(title, status);
      list.appendChild(link);
    }
  } catch (error) {
    list.replaceChildren();

    const failure = document.createElement("p");
    failure.className = "muted";
    failure.textContent = `Erro ao carregar: ${error.message}`;
    list.appendChild(failure);
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadJobs);

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REPO_KEY);
  location.reload();
});

async function initialize() {
  if (!REPOSITORY) {
    message("tokenMessage", "Não foi possível identificar o repositório.");
    return;
  }

  if (sessionStorage.getItem(TOKEN_KEY)) {
    try {
      await connect();
    } catch (error) {
      sessionStorage.removeItem(TOKEN_KEY);
      show("tokenPanel");
      hide("appPanel");
      message("tokenMessage", `Sessão inválida: ${error.message}`);
    }
  }
}

initialize();
