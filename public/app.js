"use strict";

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = "meva_pat_session";
const REPO_KEY = "meva_repo";
const CHAT_KEY = "meva_chat_id";
const WORKFLOW = "MEVA-INSTALADOR.yml";
const MAX_WAIT_MS = 48 * 60 * 1000;
let repo = "";
let owner = "";
let repoName = "";
let defaultBranch = "main";
let chatId = "";
let chatMessages = [];
let busy = false;

function repoFromPage() {
  const cached = sessionStorage.getItem(REPO_KEY);
  if (cached && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cached)) return cached;
  const host = location.hostname;
  if (!host.endsWith(".github.io")) return "";
  const user = host.slice(0, -".github.io".length);
  const firstPath = location.pathname.split("/").filter(Boolean)[0];
  const project = firstPath || `${user}.github.io`;
  const found = `${user}/${project}`;
  sessionStorage.setItem(REPO_KEY, found);
  return found;
}

function parts() {
  if (!owner || !repoName) throw new Error("Repositório não identificado.");
  return [owner, repoName];
}

function status(text, kind = "") {
  const el = $("taskStatus");
  el.textContent = text;
  el.className = `task-status ${kind}`.trim();
}

function loginStatus(text, kind = "") {
  const el = $("loginStatus");
  el.textContent = text;
  el.className = `status-text ${kind}`.trim();
}

async function github(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Sessão desconectada. Conecte novamente.");
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

function render() {
  const root = $("messages");
  root.replaceChildren();
  if (!chatMessages.length) {
    const box = document.createElement("div"); box.className = "welcome";
    const icon = document.createElement("div"); icon.className = "welcome-icon"; icon.textContent = "M";
    const title = document.createElement("h2"); title.textContent = "Como posso ajudar?";
    const description = document.createElement("p"); description.textContent = "A conversa começa quando você enviar a primeira mensagem.";
    box.append(icon, title, description); root.appendChild(box); return;
  }
  for (const item of chatMessages) {
    const article = document.createElement("article");
    article.className = `bubble ${item.role === "user" ? "from-user" : "from-meva"}`;
    const role = document.createElement("div"); role.className = "bubble-role";
    role.textContent = item.role === "user" ? "VOCÊ" : "MEVA";
    const content = document.createElement("div"); content.className = "bubble-content";
    content.textContent = String(item.content || "");
    article.append(role, content); root.appendChild(article);
  }
  root.scrollTop = root.scrollHeight;
}

function validChatId(value) { return /^[A-Za-z0-9_-]{8,80}$/.test(value); }
function newConversation() {
  chatId = crypto.randomUUID();
  localStorage.setItem(CHAT_KEY, chatId);
  const url = new URL(location.href);
  url.searchParams.set("conversation", chatId);
  history.replaceState({}, "", url);
  chatMessages = [];
  render();
  status("Nova conversa criada. Envie uma mensagem para começar.");
}

async function loadConversationList() {
  const [o, r] = parts();
  const branch = $("branch").value.trim() || defaultBranch;
  const select = $("savedChats");
  const current = chatId;
  const data = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/contents/meva-data/conversations?ref=${encodeURIComponent(branch)}`);
  select.replaceChildren();
  const first = document.createElement("option"); first.value = ""; first.textContent = "Selecione uma conversa…"; select.appendChild(first);
  const files = Array.isArray(data) ? data.filter(x => x.type === "file" && /^[-A-Za-z0-9_]{8,80}\.json$/.test(x.name)).slice(0, 100) : [];
  for (const file of files) {
    const option = document.createElement("option");
    option.value = file.name.slice(0, -5);
    option.textContent = file.name.slice(0, -5);
    select.appendChild(option);
  }
  select.value = current;
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function loadConversation() {
  if (!validChatId(chatId)) { chatMessages = []; render(); return; }
  const [o, r] = parts();
  const branch = $("branch").value.trim() || defaultBranch;
  const path = `meva-data/conversations/${chatId}.json`;
  let data;
  try {
    data = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  } catch (error) {
    if (String(error.message).startsWith("404:")) {
      chatMessages = [];
      render();
      return;
    }
    throw error;
  }
  const parsed = JSON.parse(decodeBase64Utf8(data.content));
  chatMessages = Array.isArray(parsed.messages) ? parsed.messages.filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string") : [];
  render();
  await loadConversationList().catch(() => {});
}

async function connect() {
  const [o, r] = parts();
  const info = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`);
  defaultBranch = info.default_branch || "main";
  repo = info.full_name;
  owner = info.owner.login;
  repoName = info.name;
  $("repoInfo").textContent = `${repo} · branch padrão: ${defaultBranch}`;
  const query = new URLSearchParams(location.search);
  const shared = query.get("conversation");
  chatId = validChatId(shared) ? shared : (localStorage.getItem(CHAT_KEY) || "");
  if (!validChatId(chatId)) newConversation(); else localStorage.setItem(CHAT_KEY, chatId);
  $("branch").value = query.get("branch") || defaultBranch;
  $("actionsLink").href = `https://github.com/${owner}/${repo}/actions/workflows/${WORKFLOW}`;
  $("connection").textContent = "CONECTADA";
  $("connection").classList.add("online");
  $("login").classList.add("hidden");
  $("workspace").classList.remove("hidden");
  await loadConversation().catch(error => status(`Histórico ainda não disponível: ${error.message}`));
  await loadConversationList().catch(() => {});
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const token = $("token").value.trim();
  if (!token) return;
  button.disabled = true; button.textContent = "Verificando…";
  sessionStorage.setItem(TOKEN_KEY, token);
  try { await connect(); $("token").value = ""; }
  catch (error) { sessionStorage.removeItem(TOKEN_KEY); loginStatus(`Falha na conexão: ${error.message}`, "error"); }
  finally { button.disabled = false; button.textContent = "Conectar"; }
});

async function getRuns() {
  const [o, r] = parts();
  const result = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/runs?event=workflow_dispatch&per_page=50`);
  return result.workflow_runs || [];
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function waitForCurrentRun(previousIds, startedAt) {
  const [o, r] = parts();
  const end = Date.now() + MAX_WAIT_MS;
  let run = null;
  while (Date.now() < end) {
    const runs = await getRuns();
    const targetBranch = $("branch").value.trim() || defaultBranch;
    run = runs.find(item => !previousIds.has(item.id) && item.head_branch === targetBranch && Date.parse(item.created_at) >= startedAt - 20000 && String(item.display_title || "").includes(chatId));
    if (run) {
      const detail = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/runs/${run.id}`);
      status(`MEVA está trabalhando · execução #${run.run_number} · ${detail.status}${detail.status === "completed" ? ` / ${detail.conclusion}` : ""}`);
      if (detail.status === "completed") {
        if (detail.conclusion !== "success") throw new Error(`Execução #${run.run_number} terminou com ${detail.conclusion}. Abra os logs em GitHub → Actions.`);
        return run;
      }
    } else status("Solicitação enviada. Esperando o GitHub iniciar o modelo…");
    await wait(9000);
  }
  throw new Error("O painel deixou de esperar. A execução pode continuar; use Atualizar conversa ou Ver execuções.");
}

$("composer").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const text = $("message").value.trim();
  if (!text) return;
  if (text.length > 6000) return status("A mensagem excede 6.000 caracteres.", "error");
  const branch = $("branch").value.trim() || defaultBranch;
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..")) return status("Nome de branch inválido.", "error");
  const mode = $("mode").value;
  const button = $("send");
  busy = true; button.disabled = true; button.textContent = "Executando…";
  const startedAt = Date.now();
  try {
    const before = await getRuns();
    const previousIds = new Set(before.map(run => run.id));
    $("message").value = "";
    chatMessages.push({ role: "user", content: text }); render();
    status(mode === "agent" ? "Agente de programação iniciado. Ele vai inspecionar os arquivos antes de alterá-los." : "Preparando Qwen e gerando sua resposta…");
    const [o, r] = parts();
    await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: branch, inputs: { mode, message: text, conversation_id: chatId, branch, max_actions: "8" } })
    });
    await waitForCurrentRun(previousIds, startedAt);
    await loadConversation();
    status("Resposta concluída. O histórico foi salvo no repositório público.", "success");
  } catch (error) {
    status(`Não foi possível concluir: ${error.message}`, "error");
    await loadConversation().catch(() => {});
  } finally {
    busy = false; button.disabled = false; button.textContent = "Enviar ↗";
  }
});

$("newChat").addEventListener("click", async () => { newConversation(); await loadConversationList().catch(() => {}); });
$("savedChats").addEventListener("change", async () => {
  const selected = $("savedChats").value;
  if (!validChatId(selected)) return;
  chatId = selected; localStorage.setItem(CHAT_KEY, chatId);
  const url = new URL(location.href); url.searchParams.set("conversation", chatId); history.replaceState({}, "", url);
  try { await loadConversation(); status("Conversa aberta.", "success"); }
  catch (error) { status(error.message, "error"); }
});
$("shareChat").addEventListener("click", async () => {
  const url = new URL(location.href); url.searchParams.set("conversation", chatId); url.searchParams.set("branch", $("branch").value.trim() || defaultBranch);
  try { await navigator.clipboard.writeText(url.href); status("Link público da conversa copiado.", "success"); }
  catch (_) { status(url.href); }
});
$("refresh").addEventListener("click", async () => {
  try { await loadConversation(); status("Histórico atualizado.", "success"); }
  catch (error) { status(`Não foi possível atualizar: ${error.message}`, "error"); }
});
$("logout").addEventListener("click", () => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(REPO_KEY); location.reload(); });
$("message").addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("composer").requestSubmit(); } });

async function init() {
  const detected = repoFromPage();
  if (!detected) { loginStatus("Não consegui identificar o repositório a partir do endereço do Pages.", "error"); return; }
  [owner, repoName] = detected.split("/");
  if (sessionStorage.getItem(TOKEN_KEY)) {
    try { await connect(); }
    catch (error) { sessionStorage.removeItem(TOKEN_KEY); loginStatus(`Sessão inválida: ${error.message}`, "error"); }
  }
}
init();
