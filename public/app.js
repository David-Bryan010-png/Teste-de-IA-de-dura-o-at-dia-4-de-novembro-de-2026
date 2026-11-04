"use strict";

const TOKEN_KEY = "meva_github_token";
const REPO_KEY = "meva_repository";
const CONVERSATION_KEY = "meva_conversation_id";
const WORKFLOW = "MEVA-INSTALADOR.yml";
const $ = (id) => document.getElementById(id);
let repository = "";
let defaultBranch = "main";
let conversationId = "";
let busy = false;
let messages = [];

function repoFromLocation() {
  const saved = sessionStorage.getItem(REPO_KEY);
  if (saved && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(saved)) return saved;
  const host = location.hostname;
  if (host.endsWith(".github.io")) {
    const owner = host.slice(0, -".github.io".length);
    const first = location.pathname.split("/").filter(Boolean)[0];
    const repo = first || `${owner}.github.io`;
    const value = `${owner}/${repo}`;
    sessionStorage.setItem(REPO_KEY, value);
    return value;
  }
  return "";
}

function repoParts() {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Repositório não identificado.");
  return parts;
}

function setNotice(id, text, kind = "") {
  const el = $(id);
  el.textContent = text;
  el.className = `notice ${kind}`.trim();
}

async function api(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Conecte seu token do GitHub.");
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const raw = await response.text();
  if (!response.ok) {
    let detail = raw;
    try { detail = JSON.parse(raw).message || raw; } catch (_) {}
    throw new Error(`${response.status}: ${String(detail).slice(0, 240)}`);
  }
  return raw ? JSON.parse(raw) : null;
}

function renderMessages() {
  const area = $("messages");
  area.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "welcome";
    const mark = document.createElement("div"); mark.className = "welcome-symbol"; mark.textContent = "M";
    const title = document.createElement("h2"); title.textContent = "MEVA pronta para conversar";
    const desc = document.createElement("p"); desc.textContent = "Envie uma mensagem para começar.";
    empty.append(mark, title, desc); area.appendChild(empty); return;
  }
  for (const item of messages) {
    const wrap = document.createElement("article");
    wrap.className = `message ${item.role === "user" ? "user-message" : "assistant-message"}`;
    const who = document.createElement("div"); who.className = "message-role";
    who.textContent = item.role === "user" ? "VOCÊ" : "MEVA";
    const body = document.createElement("div"); body.className = "message-body";
    body.textContent = String(item.content || "");
    wrap.append(who, body); area.appendChild(wrap);
  }
  area.scrollTop = area.scrollHeight;
}

function newConversation() {
  conversationId = crypto.randomUUID();
  localStorage.setItem(CONVERSATION_KEY, conversationId);
  messages = [];
  renderMessages();
  setNotice("taskStatus", `Nova conversa criada: ${conversationId}`);
}

async function loadConversation() {
  if (!conversationId) return;
  const [owner, repo] = repoParts();
  const branch = $("branchInput").value.trim() || defaultBranch;
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/meva-data/conversations/${conversationId}.json?t=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) { messages = []; renderMessages(); return; }
  if (!response.ok) throw new Error(`Não foi possível ler o histórico (${response.status}).`);
  const data = await response.json();
  messages = Array.isArray(data.messages) ? data.messages : [];
  renderMessages();
}

async function connect() {
  const [owner, repo] = repoParts();
  const data = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  defaultBranch = data.default_branch || "main";
  repository = data.full_name;
  $("repoLabel").textContent = `${repository} · branch padrão: ${defaultBranch}`;
  $("branchInput").value = new URLSearchParams(location.search).get("branch") || defaultBranch;
  conversationId = localStorage.getItem(CONVERSATION_KEY) || "";
  const sharedId = new URLSearchParams(location.search).get("conversation");
  if (sharedId && /^[A-Za-z0-9_-]{8,80}$/.test(sharedId)) conversationId = sharedId;
  if (!conversationId) newConversation(); else localStorage.setItem(CONVERSATION_KEY, conversationId);
  $("connectionState").textContent = "CONECTADA";
  $("connectionState").classList.add("online");
  $("loginPanel").classList.add("hidden");
  $("chatPanel").classList.remove("hidden");
  await loadConversation();
}

$("tokenForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const token = $("tokenInput").value.trim();
  if (!token) return;
  button.disabled = true; button.textContent = "Verificando...";
  sessionStorage.setItem(TOKEN_KEY, token);
  try { await connect(); $("tokenInput").value = ""; }
  catch (error) { sessionStorage.removeItem(TOKEN_KEY); setNotice("loginMessage", `Falha: ${error.message}`, "error"); }
  finally { button.disabled = false; button.textContent = "Conectar"; }
});

async function recentRuns() {
  const [owner, repo] = repoParts();
  const data = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/runs?event=workflow_dispatch&per_page=30`);
  return data.workflow_runs || [];
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForRun(beforeIds, branch, startedAt) {
  const [owner, repo] = repoParts();
  let run = null;
  const deadline = Date.now() + 50 * 60 * 1000;
  while (Date.now() < deadline) {
    const runs = await recentRuns();
    run = runs.find(item => !beforeIds.has(item.id) && item.head_branch === branch && Date.parse(item.created_at) >= startedAt - 15000 && String(item.display_title || "").includes(conversationId));
    if (!run) run = runs.find(item => !beforeIds.has(item.id) && item.head_branch === branch && Date.parse(item.created_at) >= startedAt - 15000);
    if (run) {
      const current = await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${run.id}`);
      setNotice("taskStatus", `MEVA está trabalhando · execução #${run.run_number} · ${current.status}${current.status === "completed" ? ` (${current.conclusion})` : ""}`);
      if (current.status === "completed") {
        if (current.conclusion !== "success") throw new Error(`A execução terminou com estado: ${current.conclusion}. Abra a execução #${run.run_number} no GitHub para ver o log.`);
        return;
      }
    } else {
      setNotice("taskStatus", "Solicitação enviada. Aguardando o GitHub iniciar a execução...");
    }
    await sleep(9000);
  }
  throw new Error("Tempo de espera do painel esgotado. A execução pode continuar no GitHub Actions.");
}

$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const text = $("messageInput").value.trim();
  if (!text) return;
  if (text.length > 5000) return setNotice("taskStatus", "A mensagem ultrapassa 5.000 caracteres.", "error");
  const branch = $("branchInput").value.trim() || defaultBranch;
  const mode = $("modeSelect").value;
  const button = $("sendBtn");
  busy = true; button.disabled = true; button.textContent = "Executando...";
  const startedAt = Date.now();
  try {
    const before = await recentRuns();
    const beforeIds = new Set(before.map(item => item.id));
    $("messageInput").value = "";
    messages.push({ role: "user", content: text }); renderMessages();
    setNotice("taskStatus", mode === "agent" ? "Agente iniciado. Ele vai analisar os arquivos e só poderá alterar arquivos fora de .github." : "Preparando o modelo de IA no GitHub Actions...");
    const [owner, repo] = repoParts();
    await api(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: branch, inputs: { mode, message: text, conversation_id: conversationId, branch, max_steps: "6" } })
    });
    await waitForRun(beforeIds, branch, startedAt);
    await loadConversation();
    setNotice("Resposta recebida e histórico salvo no repositório público.", "success");
  } catch (error) {
    setNotice(`Não foi possível concluir: ${error.message}`, "error");
    messages.push({ role: "assistant", content: `A execução não foi concluída pelo painel. Detalhe: ${error.message}` }); renderMessages();
  } finally {
    busy = false; button.disabled = false; button.textContent = "Enviar ↗";
  }
});

$("newChatBtn").addEventListener("click", newConversation);
$("refreshConversationBtn").addEventListener("click", async () => {
  try { await loadConversation(); setNotice("Histórico atualizado.", "success"); }
  catch (error) { setNotice(error.message, "error"); }
});
$("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(REPO_KEY); location.reload();
});
$("messageInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("messageForm").requestSubmit(); }
});

async function init() {
  repository = repoFromLocation();
  if (!repository) { setNotice("loginMessage", "Não consegui identificar o repositório a partir do endereço do Pages.", "error"); return; }
  if (sessionStorage.getItem(TOKEN_KEY)) {
    try { await connect(); }
    catch (error) { sessionStorage.removeItem(TOKEN_KEY); setNotice("loginMessage", `Sessão inválida: ${error.message}`, "error"); }
  }
}
init();
