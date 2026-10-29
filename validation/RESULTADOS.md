# Validação técnica — comparativo de cotação

Data: 29/10/2026 (America/Sao_Paulo).

## Resultado da execução final

- TypeScript, Oxlint e build otimizado de demonstração: aprovados.
- **144 testes aprovados em 5,1 minutos**, com dois workers, no build final de demonstração.
- Viewports: 390 × 844, 768 × 1024 e 1440 × 1000.
- As 30 comparações visuais existentes passaram sem atualizar baselines.
- Conferência visual adicional do comparativo em desktop e mobile, com ajuste da apresentação em blocos no celular e verificação de ausência de overflow horizontal.
- Node v24.22.1, Chromium 153.0.8010.0, Playwright 1.64.1, Linux.

Relatório HTML da execução final: `report/index.html`. Não houve falhas nessa execução. Traces continuam configurados para retenção em falha.

## Cobertura

Foram executados todos os testes de checkout, tempo real e regressão visual. Sete novos cenários, repetidos nas três larguras, verificam:

1. Precisão de um wei, múltiplas unidades e redução em relação à última revisão.
2. Taxa alterada sem atribuir mudança ao preço do NFT.
3. Desconto perdido por expiração do cupom e seu efeito no total.
4. Estoque reduzido sem mudança no valor.
5. Vencimento da revisão sem mudança de cotação.
6. Quantidade alterada separadamente do preço por unidade.
7. Itens adicionados e removidos durante a revisão.

O cenário existente de aumento de preço passou a verificar também os valores anterior/atual, diferença, taxa sem alteração, ausência de overflow, desaparecimento do comparativo após nova revisão e necessidade de novo aceite. A cobertura exercita REST/MSW e atualizações por Socket.IO na interface, sem alterações diretas no cache para simular o resultado.

A suíte completa contém 333 verificações após a inclusão dos novos cenários. Nesta revisão, foram executadas as 144 descritas acima; os demais testes de autenticação, conta, catálogo, detalhe e carrinho não foram repetidos integralmente. As imagens de referência registram a aplicação, sem comprovar equivalência pixel a pixel ao Figma.

## Implementação

`src/features/checkout/quote-comparison.tsx` compara a revisão ainda aberta com a cotação REST atual. Deltas monetários usam BigInt em wei; descontos são apresentados como valores abatidos, com o efeito final separado no total. Identificadores de NFT/edição associam os itens entre as duas versões.

O checkout distingue mudança do fingerprint e vencimento da revisão. Seus bloqueios de confirmação foram preservados, assim como os contratos e a revalidação no servidor. A comparação aguarda a atualização da cotação e não é apresentada como atual durante erro de consulta. Nova revisão substitui a referência e exige marcar novamente a confirmação. A tabela mantém semântica acessível e se reorganiza em blocos em telas menores.

A melhoria e sua reprodução manual estão documentadas no README e suas decisões técnicas em ARCHITECTURE.md.

## Reproduzir

```bash
npm run typecheck
npm run lint
npm run build:demo
E2E_PREVIEW=true PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/kurio-chromium npm run test:e2e -- tests/checkout.spec.ts tests/realtime.spec.ts tests/visual.spec.ts --workers=2
```

O executável acima é específico deste ambiente. Localmente, instalar Chromium com `npx playwright install chromium` e omitir a variável do executável. Para a suíte completa, usar `npm run test:e2e`.

## Auditorias e entrega externa

As 12 auditorias em `lighthouse/` são registros da etapa de performance anterior às trocas de contas e a este comparativo; não foram repetidas nesta revisão. Suas medianas mobile de performance ficaram em 84, abaixo da meta de 90. Não representam uma nova medição do build atual.

Deploy público e validação na origem publicada permanecem pendentes. Fonte e cores substituídas estão documentadas em ARCHITECTURE.md. Carteiras, pagamentos e transações são simulados.
