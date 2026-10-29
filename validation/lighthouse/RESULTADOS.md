# Lighthouse — etapa 10

Data: 29/10/2026 (America/Sao_Paulo).

Build otimizado (`npm run build:demo`), cenário padrão dos mocks, visitante, perfis limpos a cada execução. Foram realizadas **12 medições válidas**, três por combinação de página/perfil. As medianas são calculadas separadamente para cada categoria e métrica; não se escolhe a execução com melhor pontuação.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | 84 | 96 | 100 | 100 | 2.75 s | 0.0014 | 504 ms |
| inicio | desktop | 99 | 96 | 100 | 100 | 0.86 s | 0.0001 | 1 ms |
| detalhe | mobile | 84 | 97 | 100 | 100 | 2.96 s | 0.0000 | 440 ms |
| detalhe | desktop | 99 | 97 | 100 | 100 | 0.88 s | 0.0001 | 55 ms |

Metas: performance ≥90, accessibility ≥95, best practices ≥95 e SEO ≥90. **As duas medianas mobile de performance ficaram abaixo de 90.** As demais combinações/categorias atingiram as metas. A entrega não deve ser apresentada como aprovada em todas as metas de performance.

## Condições e versões

- Node v24.22.1; Lighthouse 13.6.0.
- Navegador: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.0 Safari/537.36`.
- Linux 6.18.55 x64; INTEL(R) XEON(R) PLATINUM 8573C; 9 CPUs lógicas e 10 GiB de memória reportados pelo contêiner. Recursos compartilhados, sem garantia de exclusividade da máquina.

- URL local `http://127.0.0.1:4173`, Vite preview. O resultado não inclui latência real de hospedagem/CDN nem representa dados de usuários reais.
- Chrome headless com SwiftShader e GPU desabilitada neste ambiente Linux. Os flags estão versionados no script.
- Perfis mobile/desktop e throttling simulado padrão do Lighthouse, sem redução artificial de CPU/rede. `configSettings` de cada JSON contém os parâmetros efetivos; o viewport mobile de Lighthouse difere dos 390 px usados no Playwright.
- Nenhuma imagem, fonte, simulação REST, inicialização de MSW ou conexão Socket.IO foi excluída para auditar. As funcionalidades são as mesmas do build de demonstração. Não foram executados testes Playwright simultaneamente.

## Causas e limites

Os relatórios `bootup-time`, `long-tasks` e `mainthread-work-breakdown` apontam custos de avaliação de JavaScript na inicialização do MSW e da aplicação React/Router. O bootstrap precisa aguardar a interceptação de rede antes de abrir a aplicação e o Socket.IO; sua ordem preserva a correção dos mocks. Com limitação simulada de CPU no mobile, esses custos aumentam o TBT. A cadeia crítica inclui bootstrap → handlers/MSW → renderização → resposta REST → imagem do catálogo/detalhe, elevando o LCP. A atribuição por bundle aponta onde investigar, sem provar que uma única biblioteca seja a causa exclusiva.

A maioria das telas privadas já usa importação sob demanda; imagens são WebP com dimensões explícitas, e imagens secundárias são lazy. Nesta revisão, as duas primeiras imagens do catálogo receberam prioridade. Foram corrigidos o arquivo robots.txt (antes respondido como HTML pelo fallback), o nome acessível dos cards e a hierarquia de títulos do catálogo. Preload simultâneo das duas fontes foi experimentado e removido após piorar o LCP mobile; os relatórios entregues correspondem à versão final sem esse preload.

Há variação de TBT entre execuções no contêiner. Isso não invalida nem substitui as medianas reportadas. Próximas melhorias demandam profiling dos custos de bootstrap/handlers e avaliação de divisão de bundles, preservando a inicialização correta dos mocks e a reconciliação de sessão. Reduzir cobertura funcional ou desligar MSW para obter nota maior não corresponde à entrega exigida.

Acessibilidade acima da meta não significa conformidade integral: os relatórios ainda apontam tamanho/espaçamento de alguns links do rodapé e, no detalhe, diferença entre texto e nome acessível do botão de avaliações. Navegação por teclado e foco também são exercitados pelo Playwright. As referências visuais não comprovam equivalência pixel a pixel ao Figma; fontes e cores substituídas estão documentadas em ARCHITECTURE.md.

## Reproduzir

```bash
npm ci
npm run build:demo
npm run audit:lighthouse
```

É necessário Chrome/Chromium instalado. Neste ambiente foi informado `CHROME_PATH=/tmp/kurio-chromium`; esse caminho não é portátil. Em uma máquina local, use a detecção automática ou informe o caminho real. Para auditar a publicação, defina `AUDIT_BASE_URL` como a URL pública e use outra pasta em `AUDIT_OUTPUT` para preservar a evidência local.

A configuração e a execução estão em `scripts/lighthouse.config.mjs`, `scripts/lighthouse.mjs` e `scripts/audit.mjs`. Cada medição entrega HTML e JSON; `summary.json` contém valores de todas as execuções, medianas e ambiente. As notas e métricas podem variar em outra máquina. O deploy público ainda precisa ser realizado e validado, conforme README.md.
