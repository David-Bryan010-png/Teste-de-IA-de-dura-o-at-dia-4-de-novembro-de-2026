# MEVA — modelo real, chat, memória e agente

## Arquitetura
- **Interface:** GitHub Pages (site estático responsivo).
- **Execução:** GitHub Actions sob demanda; não é um servidor permanente.
- **Modelo:** Qwen2.5-Coder-3B-Instruct GGUF, quantização Q4_K_M, servido por llama.cpp.
- **Memória:** histórico JSON por conversa em `meva-data/conversations/`.
- **Personalidade e prompts:** arquivos editáveis em `meva-config/`.
- **Agente:** ferramentas controladas para listar, ler, buscar, criar/editar arquivos e executar verificações específicas.

## Instalação
Em GitHub → Actions, execute este workflow na branch padrão com `mode = install`. O repositório precisa ter GitHub Pages configurado para GitHub Actions em Settings → Pages.

## Uso
Cada usuário conecta seu próprio Fine-grained Personal Access Token, limitado a este repositório, com Actions: Read and write, Contents: Read and write e Metadata: Read-only. O envio de anexos cria uma GitHub Release e publica os arquivos como ativos. A pessoa também precisa ter permissão no repositório para disparar Actions; o token não concede acesso que a conta não possui. Não compartilhe tokens.

- **Conversa normal:** pergunta e resposta com o histórico daquela conversa.
- **Agente de programação:** analisa arquivos, solicita ferramentas limitadas, altera arquivos permitidos e executa verificações.
- **Anexos:** até 5 arquivos por envio, 200 MB por arquivo e 500 MB no total. Apenas texto UTF-8; arquivos binários são recusados. São enviados como ativos de uma GitHub Release pré-lançada e baixados pelo runner; não são gravados no histórico Git.
- **Self-test:** verifica se o runner consegue iniciar o modelo e gerar uma resposta curta.

## Personalizar as instruções da MEVA
Edite os arquivos em `meva-config/`:
- `IDENTITY.md`: identidade e objetivo central.
- `RESPONSE_RULES.md`: como interpretar e responder às mensagens.
- `USER_PREFERENCES.md`: estilo e preferências de uso.
- `PROJECT_CONTEXT.md`: contexto factual do projeto.
- `AGENT_RULES.md`: limites e método do agente de código.
- Arquivos anexados no painel são publicados como ativos de uma GitHub Release pré-lançada e baixados temporariamente em `meva-inbox/<conversa>/` durante a execução. Não entram no commit do projeto.

A instalação inicial cria esses arquivos sem sobrescrever personalizações futuras. Mudanças nos prompts são aplicadas na execução seguinte.

## Atualizar o modelo futuramente
No início do YAML, altere `MODEL_REPO`, `MODEL_FILE`, `MODEL_ID` e `MODEL_CACHE_VERSION`. Escolha um GGUF compatível com llama.cpp. Aumente `MODEL_CACHE_VERSION` para forçar novo cache. Verifique a licença do modelo escolhido.

## Público e segurança
Este repositório é público: mensagens, respostas, prompts, histórico, alterações, commits, Releases e anexos podem ser vistos por terceiros. Não envie dados privados, senhas, tokens ou chaves. O PAT fica temporariamente em sessionStorage; um script malicioso na mesma página poderia lê-lo. Use token restrito, não o compartilhe e desconecte ao terminar.

O agente não tem shell arbitrário, não pode editar `.github/`, não recebe o token de push durante a inferência e usa somente ferramentas de arquivo/teste explicitamente permitidas. Anexos são temporários no runner e excluídos dos commits; os ativos da Release continuam públicos até serem removidos manualmente. Mesmo assim, revise as alterações antes de utilizá-las.

## Limites reais
O modelo não treina nem altera os próprios pesos. A memória é contexto persistido, não aprendizado dos parâmetros. Cada mensagem usa um runner temporário; o primeiro uso pode demorar por causa do download do modelo e da compilação do llama.cpp. Limites, minutos e disponibilidade dependem do GitHub Actions.
