# MEVA V6

## Recursos
- Qwen2.5-Coder-3B-Instruct Q4_K_M.
- GitHub Pages como interface.
- Histórico por conversa.
- Pesquisa pública na Internet.
- Leitura de páginas externas.
- Anexos de código, documentos e ZIPs.
- Extração segura de arquivos ZIP.
- Leitura, escrita, substituição e organização de arquivos.
- Compilação e testes em Python, JavaScript, C, C++, CMake, Make, Rust, Go, Java e .NET.
- Exportação de arquivos editados e resultados.
- Cache do modelo e do llama.cpp.

## Modos
- chat: conversa e pesquisa na Internet, com ferramentas de leitura.
- agent: programação, edição, extração, compilação, testes e exportação.
- self_test: teste do carregamento do modelo.
- install: instalação do painel e preparação do modelo.

## Instalação
Execute este workflow na branch padrão com mode=install.
O GitHub Pages é habilitado pela ação de configuração.

## Acesso
Use um Fine-grained Personal Access Token restrito ao repositório:
- Actions: Read and write.
- Contents: Read and write.
- Metadata: Read-only.

## Anexos
Até 5 arquivos por envio, 200 MB por arquivo e 500 MB no total.
Os arquivos são publicados temporariamente como ativos de uma GitHub Release.
ZIPs podem ser extraídos de forma controlada pelo agente.
Os anexos e os arquivos de saída são públicos enquanto publicados.

## Internet
A MEVA pode fazer pesquisas públicas e consultar páginas externas.
O acesso usa serviços públicos e não exige uma chave de API.
Algumas páginas podem bloquear consultas automatizadas.

## Compilação
O agente utiliza ferramentas compatíveis instaladas no runner.
Builds podem executar scripts do próprio projeto. Por isso, não envie
códigos desconhecidos ou maliciosos. O ambiente é temporário, mas não
é uma sandbox de segurança perfeita.

## Limitações
O modelo não treina os próprios pesos. A memória é o histórico salvo.
Cada mensagem inicia uma nova execução do GitHub Actions.
O cache reduz downloads e compilações repetidas, mas não mantém o modelo
permanentemente carregado.
