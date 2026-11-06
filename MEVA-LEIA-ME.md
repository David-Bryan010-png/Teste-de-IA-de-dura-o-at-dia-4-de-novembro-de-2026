# MEVA V8
- Chat leve: Qwen2.5-0.5B-Instruct Q4_K_M (~491 MB), qualidade menor que modelos maiores.
- Programação: Qwen2.5-Coder-3B-Instruct Q4_K_M.
- llama.cpp com backend detectado automaticamente: CUDA, HIP/ROCm, Vulkan ou CPU/OpenMP/OpenBLAS.
- Inspeção de ZIP sem extração, leitura de entradas e extração segura com limites.
- Terminal Bash integral sob demanda no runner efêmero, sem variáveis de segredo do GitHub no subprocesso.
- Chromium/Playwright headless sob demanda; ler, clicar, preencher, screenshot e download.
- Criação, leitura, edição, busca, compilação, testes, pesquisa web e exportação de projeto.
## Instalação
Execute este workflow na branch padrão com mode=install.
## Token
Fine-grained PAT restrito a este repositório: Actions Read and write, Contents Read and write, Metadata Read-only.
## Limites e privacidade
Até 5 anexos, 200 MB por arquivo, 500 MB por envio; ZIP até 1 GB expandido. Este repositório é público: Releases, histórico e arquivos anexados podem ficar públicos. Nunca envie segredos.
## Acelerador
Runner padrão ubuntu-24.04 normalmente não tem GPU. A V8 detecta dispositivos realmente expostos; sem GPU, usa CPU. OpenBLAS pode acelerar processamento de prompt, mas não garante aumento de tokens/segundo. GPU requer runner e driver compatíveis.
## Terminal e navegador
Comandos rodam na VM temporária do GitHub Actions, não no celular/PC do usuário. Browser usa Chromium headless e não herda logins do seu navegador. Não contorna CAPTCHA/MFA.
