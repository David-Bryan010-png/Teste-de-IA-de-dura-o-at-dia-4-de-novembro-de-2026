# MEVA V7
- Chat rápido com Qwen2.5-1.5B-Instruct Q4_K_M.
- Agente de programação com Qwen2.5-Coder-3B-Instruct Q4_K_M.
- Pesquisa pública na Internet e leitura de páginas.
- Anexos binários, ZIP, PDF, documentos e código.
- Extração ZIP segura para `meva-workspace/`.
- Criação, leitura, edição e remoção controlada de arquivos.
- Compilação e testes para Python, Node/npm, C/C++, CMake, Make, Rust, Go, Java/Gradle/Maven e .NET.
- Diagnóstico de Internet e interfaces de rede do runner.
- Exportação do projeto e dos arquivos modificados por GitHub Release e Actions Artifact.
- Histórico JSON por conversa.

## Instalação
Execute este workflow na branch padrão com `mode=install`.

## Token
Fine-grained PAT restrito ao repositório: Actions Read and write, Contents Read and write, Metadata Read-only. O painel precisa de acesso para publicar anexos em Releases e iniciar Actions.

## Limites
Até 5 anexos por envio, 200 MB por arquivo e 500 MB no total. O ZIP extraído pode ocupar até 1 GB no runner. O runner é temporário. O modelo não treina os próprios pesos.

## Rede e Wi-Fi
A MEVA executa em uma VM hospedada na nuvem. Ela pode usar a Internet do runner e diagnosticar interfaces existentes, mas não controla o Wi-Fi do celular ou do computador do usuário. Runners hospedados normalmente não possuem placa de rádio Wi-Fi acessível.

## Privacidade
Este repositório é público. Não envie dados privados, segredos, tokens ou chaves. Builds executam código do projeto e devem ser feitos somente com fontes confiáveis.
