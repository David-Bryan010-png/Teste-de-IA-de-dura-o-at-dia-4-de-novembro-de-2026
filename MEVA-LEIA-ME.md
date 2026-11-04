# MEVA — IA executada pelo GitHub Actions

## Como funciona
- GitHub Pages hospeda a interface web.
- GitHub Actions inicia o modelo quando alguém envia uma mensagem.
- O motor usa llama.cpp e o modelo Qwen2.5-Coder-3B-Instruct GGUF Q4_K_M.
- O histórico de cada conversa fica em `meva-data/conversations/`.
- O modo Agente pode listar e ler arquivos, criar/editar arquivos fora de `.github` e executar verificações permitidas.

## Conectar
Cada pessoa usa seu próprio Fine-grained Personal Access Token, limitado a este repositório, com **Actions: Read and write**. O token é mantido apenas na sessão do navegador. Nunca compartilhe seu token.

## Atenção: repositório público
Mensagens, respostas, arquivos de memória e alterações confirmadas pelo agente são públicos. Não envie senhas, chaves, tokens, dados pessoais ou conteúdo privado.

## Instalar ou atualizar o painel
Em Actions, execute `MEVA — IA, chat, memória e agente de programação` com `mode = install` na branch padrão. O GitHub Pages precisa estar habilitado em Settings → Pages → Build and deployment → GitHub Actions.

## Atualizar o modelo futuramente
Edite `MODEL_REPO`, `MODEL_FILE` e `MODEL_CACHE_VERSION` no topo do workflow. Use um modelo GGUF compatível com llama.cpp. Incrementar `MODEL_CACHE_VERSION` força um novo cache para o modelo.

## Limites reais
O modelo não fica ligado continuamente. Cada mensagem inicia um workflow e pode levar alguns minutos, especialmente quando o cache ainda não existe. A MEVA é um protótipo de agente: o modelo pode errar e alterações devem ser revisadas. O agente não pode editar workflows em `.github` nem acessar tokens do GitHub durante a inferência.
