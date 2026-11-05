"use strict";
const $ = id => document.getElementById(id);
const TOKEN_KEY = "meva_pat_session";
const REPO_KEY = "meva_repo";
const CHAT_KEY = "meva_chat_id";
const WORKFLOW = "MEVA-INSTALADOR.yml";
const MAX_FILE = 200 * 1024 * 1024;
const MAX_TOTAL = 500 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_WAIT = 110 * 60 * 1000;
let owner = "", repoName = "", repo = "", defaultBranch = "main";
let chatId = "", chatMessages = [], busy = false;

function status(message, kind = "") {
  $("taskStatus").textContent = message;
  $("taskStatus").className = `task-status ${kind}`.trim();
}
function loginStatus(message, kind = "") {
  $("loginStatus").textContent = message;
  $("loginStatus").className = `status ${kind}`.trim();
}
function repoFromPage() {
  const cached = sessionStorage.getItem(REPO_KEY);
  if (cached && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cached)) return cached;
  if (!location.hostname.endsWith(".github.io")) return "";
  const user = location.hostname.slice(0, -".github.io".length);
  const project = location.pathname.split("/").filter(Boolean)[0] || `${user}.github.io`;
  const found = `${user}/${project}`;
  sessionStorage.setItem(REPO_KEY, found);
  return found;
}
function parts() {
  if (!owner || !repoName) throw new Error("Repositório não identificado.");
  return [owner, repoName];
}
async function github(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Sessão desconectada.");
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.body ? {"Content-Type": "application/json"} : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`https://api.github.com${path}`, {...options, headers});
  if (response.status === 204) return null;
  const raw = await response.text();
  if (!response.ok) {
    let detail = raw;
    try { detail = JSON.parse(raw).message || raw; } catch (_) {}
    throw new Error(`${response.status}: ${String(detail).slice(0, 240)}`);
  }
  return raw ? JSON.parse(raw) : null;
}
function validChatId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value);
}
function newConversation() {
  chatId = crypto.randomUUID();
  localStorage.setItem(CHAT_KEY, chatId);
  const url = new URL(location.href);
  url.searchParams.set("conversation", chatId);
  history.replaceState({}, "", url);
  chatMessages = [];
  render();
  status("Nova conversa criada.");
}
function render() {
  const root = $("messages");
  root.replaceChildren();
  if (!chatMessages.length) {
    const box = document.createElement("div"); box.className = "welcome";
    const logo = document.createElement("div"); logo.className = "welcome-logo"; logo.textContent = "M";
    const title = document.createElement("h2"); title.textContent = "Como posso ajudar?";
    const p = document.createElement("p"); p.textContent = "Faça uma pergunta, pesquise um assunto ou envie um projeto.";
    box.append(logo, title, p); root.appendChild(box); return;
  }
  for (const item of chatMessages) {
    const article = document.createElement("article");
    article.className = `bubble ${item.role === "user" ? "from-user" : "from-meva"}`;
    const role = document.createElement("div"); role.className = "bubble-role";
    role.textContent = item.role === "user" ? "VOCÊ" : "MEVA";
    const content = document.createElement("div"); content.className = "bubble-content";
    const value = String(item.content || "");
    const pattern = /https:\/\/[^\s<>"']+/g;
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      const raw = match[0], clean = raw.replace(/[.,;:!?)}\]]+$/, ""), start = match.index;
      if (start > cursor) content.appendChild(document.createTextNode(value.slice(cursor, start)));
      try {
        const parsed = new URL(clean);
        if (parsed.protocol === "https:") {
          const link = document.createElement("a");
          link.href = parsed.href; link.target = "_blank"; link.rel = "noopener noreferrer";
          link.textContent = clean; content.appendChild(link);
          content.appendChild(document.createTextNode(raw.slice(clean.length)));
        } else content.appendChild(document.createTextNode(raw));
      } catch (_) { content.appendChild(document.createTextNode(raw)); }
      cursor = start + raw.length;
    }
    if (cursor < value.length) content.appendChild(document.createTextNode(value.slice(cursor)));
    article.append(role, content); root.appendChild(article);
  }
  root.scrollTop = root.scrollHeight;
}
function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
async function loadConversation() {
  if (!validChatId(chatId)) { chatMessages = []; render(); return; }
  const [o, r] = parts(), branch = $("branch").value.trim() || defaultBranch;
  const path = `meva-data/conversations/${chatId}.json`;
  let data;
  try {
    data = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/contents/${path}?ref=${encodeURIComponent(branch)}`);
  } catch (error) {
    if (String(error.message).startsWith("404:")) { chatMessages = []; render(); return; }
    throw error;
  }
  const parsed = JSON.parse(decodeBase64Utf8(data.content));
  chatMessages = Array.isArray(parsed.messages) ? parsed.messages.filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string") : [];
  render();
  await loadConversationList().catch(() => {});
}
async function loadConversationList() {
  const [o, r] = parts(), branch = $("branch").value.trim() || defaultBranch;
  const data = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/contents/meva-data/conversations?ref=${encodeURIComponent(branch)}`);
  const select = $("savedChats"), current = chatId;
  select.replaceChildren();
  const first = document.createElement("option"); first.value = ""; first.textContent = "Selecione uma conversa…"; select.appendChild(first);
  const files = Array.isArray(data) ? data.filter(x => x.type === "file" && /^[-A-Za-z0-9_]{8,80}\.json$/.test(x.name)).slice(0, 100) : [];
  for (const file of files) {
    const option = document.createElement("option"); option.value = file.name.slice(0, -5); option.textContent = file.name.slice(0, -5); select.appendChild(option);
  }
  select.value = current;
}
async function connect() {
  const [o, r] = parts();
  const info = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`);
  owner = info.owner.login; repoName = info.name; repo = info.full_name; defaultBranch = info.default_branch || "main";
  $("repoInfo").textContent = `${repo} · branch padrão: ${defaultBranch}`;
  const query = new URLSearchParams(location.search), shared = query.get("conversation");
  chatId = validChatId(shared) ? shared : (localStorage.getItem(CHAT_KEY) || "");
  if (!validChatId(chatId)) newConversation(); else localStorage.setItem(CHAT_KEY, chatId);
  $("branch").value = query.get("branch") || defaultBranch;
  $("actionsLink").href = `https://github.com/${owner}/${repo}/actions/workflows/${WORKFLOW}`;
  $("connection").textContent = "CONECTADA"; $("connection").classList.add("online");
  $("login").classList.add("hidden"); $("workspace").classList.remove("hidden");
  await loadConversation().catch(error => status(`Histórico: ${error.message}`, "error"));
  await loadConversationList().catch(() => {});
}
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter, token = $("token").value.trim();
  if (!token) return;
  button.disabled = true; button.textContent = "Verificando…"; sessionStorage.setItem(TOKEN_KEY, token);
  try { await connect(); $("token").value = ""; }
  catch (error) { sessionStorage.removeItem(TOKEN_KEY); loginStatus(`Falha: ${error.message}`, "error"); }
  finally { button.disabled = false; button.textContent = "Conectar"; }
});
async function getRuns() {
  const [o, r] = parts();
  const result = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/runs?event=workflow_dispatch&per_page=50`);
  return result.workflow_runs || [];
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForRun(previousIds, startedAt) {
  const [o, r] = parts(), end = Date.now() + MAX_WAIT;
  let polls = 0;
  while (Date.now() < end) {
    const runs = await getRuns(), branch = $("branch").value.trim() || defaultBranch;
    const run = runs.find(item => !previousIds.has(item.id) && item.head_branch === branch && Date.parse(item.created_at) >= startedAt - 30000 && String(item.display_title || "").includes(chatId));
    if (run) {
      const detail = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/runs/${run.id}`);
      status(`MEVA trabalhando · execução #${run.run_number} · ${detail.status}${detail.status === "completed" ? ` / ${detail.conclusion}` : ""}`);
      if (detail.status === "completed") {
        if (detail.conclusion !== "success") throw new Error(`Execução #${run.run_number} terminou com ${detail.conclusion}. Consulte os logs no GitHub Actions.`);
        return run;
      }
    } else status("Execução enviada. Aguardando o runner iniciar…");
    polls++;
    await sleep(polls < 12 ? 3000 : 8000);
  }
  throw new Error("O painel atingiu o limite de espera. A execução pode continuar; use Atualizar ou Ver execuções.");
}
function safeName(name) {
  const original = String(name || "file.bin").normalize("NFKC");
  if (/^(\.env|id_rsa|id_ed25519|credentials|secrets?\.|.*private[_-]?key)/i.test(original) || /(token|credential|secret)/i.test(original)) {
    throw new Error(`Arquivo potencialmente secreto bloqueado: ${name}`);
  }
  const cleaned = original.replace(/[/\\]/g, "_").replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 100);
  if (!cleaned || cleaned === "." || cleaned === ".." || cleaned.endsWith(".")) throw new Error(`Nome inválido: ${name}`);
  return cleaned;
}
async function createAttachmentRelease(files) {
  const [o, r] = parts(), stamp = Date.now(), tag = `meva-upload-${chatId}-${stamp}`;
  const release = await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/releases`, {
    method: "POST",
    body: JSON.stringify({tag_name: tag, name: `MEVA anexos ${chatId}`, body: "Anexos da conversa MEVA. Conteúdo público.", draft: false, prerelease: true})
  });
  const assets = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i], name = `${String(i + 1).padStart(2, "0")}-${safeName(file.name)}`;
    const uploadBase = String(release.upload_url || "").replace(/\{\?name,label\}$/, "");
    if (!uploadBase.startsWith("https://uploads.github.com/")) throw new Error("URL de upload do GitHub inválida.");
    const token = sessionStorage.getItem(TOKEN_KEY), uploadUrl = `${uploadBase}?name=${encodeURIComponent(name)}`;
    const raw = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open("POST", uploadUrl, true);
      xhr.setRequestHeader("Accept", "application/vnd.github+json"); xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("X-GitHub-Api-Version", "2022-11-28"); xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.addEventListener("progress", event => { if (event.lengthComputable) status(`Enviando ${i + 1}/${files.length}: ${file.name} · ${Math.round(event.loaded / event.total * 100)}%`); });
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText) : reject(new Error(`GitHub HTTP ${xhr.status}: ${xhr.responseText.slice(0, 220)}`));
      xhr.onerror = () => reject(new Error("Falha de rede ao enviar anexo.")); xhr.onabort = () => reject(new Error("Envio cancelado.")); xhr.send(file);
    });
    const asset = JSON.parse(raw);
    assets.push({name, size: file.size, url: asset.browser_download_url});
  }
  return {tag, assets};
}
$("attachments").addEventListener("change", () => {
  const files = Array.from($("attachments").files || []), total = files.reduce((s, f) => s + f.size, 0);
  let text = files.map(f => `${f.name} · ${(f.size / 1048576).toFixed(2)} MB`).join("\n");
  text += `\nTotal: ${(total / 1048576).toFixed(2)} MB`;
  if (files.length > MAX_FILES) text += "\nERRO: máximo de 5 arquivos.";
  if (files.some(f => !f.size || f.size > MAX_FILE)) text += "\nERRO: máximo de 200 MB por arquivo.";
  if (total > MAX_TOTAL) text += "\nERRO: máximo de 500 MB no total.";
  $("attachmentList").textContent = text || "Nenhum arquivo selecionado.";
});
async function uploadAttachments() {
  const files = Array.from($("attachments").files || []);
  if (!files.length) return null;
  if (files.length > MAX_FILES) throw new Error("Máximo de 5 anexos.");
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL) throw new Error("Total dos anexos acima de 500 MB.");
  for (const file of files) { safeName(file.name); if (!file.size || file.size > MAX_FILE) throw new Error(`${file.name}: vazio ou acima de 200 MB.`); }
  const result = await createAttachmentRelease(files);
  $("attachments").value = ""; $("attachmentList").textContent = `${files.length} arquivo(s) enviado(s).`;
  return result;
}
$("composer").addEventListener("submit", async event => {
  event.preventDefault(); if (busy) return;
  const text = $("message").value.trim(), files = Array.from($("attachments").files || []);
  if (!text && !files.length) return;
  if (text.length > 5500) return status("Mensagem acima de 5.500 caracteres.", "error");
  const branch = $("branch").value.trim() || defaultBranch;
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..")) return status("Branch inválida.", "error");
  const mode = files.length ? "agent" : $("mode").value;
  if (files.length) $("mode").value = "agent";
  const button = $("send"), startedAt = Date.now();
  busy = true; button.disabled = true; button.textContent = "Executando…";
  try {
    const before = await getRuns(), previousIds = new Set(before.map(run => run.id));
    status(files.length ? "Enviando anexos…" : (mode === "agent" ? "Iniciando agente…" : "Preparando resposta…"));
    const uploaded = await uploadAttachments();
    const task = text || "Analise os arquivos enviados, identifique o projeto e descreva seu conteúdo e estrutura.";
    $("message").value = "";
    chatMessages.push({role: "user", content: task}); render();
    const [o, r] = parts();
    await github(`/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ref: branch, inputs: {mode, message: task, conversation_id: chatId, branch, max_actions: "16", attachments: uploaded ? JSON.stringify(uploaded.assets) : ""}})
    });
    status(mode === "agent" ? "Agente iniciado. Analisando arquivos e preparando ferramentas…" : "Solicitação recebida. Gerando resposta…");
    await waitForRun(previousIds, startedAt);
    await loadConversation(); status("Resposta concluída. Histórico atualizado.", "success");
  } catch (error) {
    status(`Falha: ${error.message}`, "error");
    await loadConversation().catch(() => {});
  } finally { busy = false; button.disabled = false; button.textContent = "Enviar ↗"; }
});
$("newChat").addEventListener("click", async () => { newConversation(); await loadConversationList().catch(() => {}); });
$("savedChats").addEventListener("change", async () => {
  const selected = $("savedChats").value; if (!validChatId(selected)) return;
  chatId = selected; localStorage.setItem(CHAT_KEY, chatId);
  const url = new URL(location.href); url.searchParams.set("conversation", chatId); history.replaceState({}, "", url);
  try { await loadConversation(); status("Conversa aberta.", "success"); } catch (error) { status(error.message, "error"); }
});
$("shareChat").addEventListener("click", async () => {
  const url = new URL(location.href); url.searchParams.set("conversation", chatId); url.searchParams.set("branch", $("branch").value.trim() || defaultBranch);
  try { await navigator.clipboard.writeText(url.href); status("Link copiado.", "success"); } catch (_) { status(url.href); }
});
$("refresh").addEventListener("click", async () => { try { await loadConversation(); status("Histórico atualizado.", "success"); } catch (error) { status(error.message, "error"); } });
$("logout").addEventListener("click", () => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(REPO_KEY); location.reload(); });
$("message").addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("composer").requestSubmit(); } });
async function init() {
  const detected = repoFromPage();
  if (!detected) { loginStatus("Não consegui identificar o repositório do Pages.", "error"); return; }
  [owner, repoName] = detected.split("/");
  if (sessionStorage.getItem(TOKEN_KEY)) {
    try { await connect(); } catch (error) { sessionStorage.removeItem(TOKEN_KEY); loginStatus(`Sessão inválida: ${error.message}`, "error"); }
  }
}
init();
