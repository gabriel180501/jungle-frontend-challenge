# Kurio

Marketplace de NFTs em React e TypeScript, com catálogo, detalhes dos NFTs, autenticação e área da conta. Inclui busca, filtros, ordenação, paginação, galeria, edições, quantidade, favoritos, edição de perfil, avatar, senha e carteiras principal/secundária. Inclui carrinho, cupons e cotação. Pagamento com carteira simulada, revisão, envio idempotente, acompanhamento e recibo de pedidos estão implementados. Eventos de negócio via Socket.IO sincronizam preço, disponibilidade, cotação e estado dos pedidos, com reconciliação após reconexão.

## Executar

Use Node.js 24 LTS e npm. Na pasta do projeto:

```bash
npm ci
npm run dev:mocks
```

Abra o endereço indicado pelo Vite, normalmente http://localhost:5173. Os mocks estão disponíveis em desenvolvimento e no build de demonstração. Não há backend externo. As contas e sessões são simuladas com MSW e persistem localmente no navegador.

## Comandos

| Comando                           | Finalidade                                   |
| --------------------------------- | -------------------------------------------- |
| `npm run dev:mocks`               | Desenvolvimento com MSW                      |
| `npm run dev`                     | Desenvolvimento segundo as variáveis locais  |
| `npm run typecheck`               | Verificação de tipos                         |
| `npm run lint`                    | Verificação com Oxlint                       |
| `npm run build:demo`              | Build otimizado com mocks                    |
| `npm run build`                   | Build segundo as variáveis locais            |
| `npm run preview`                 | Servir o último build                        |
| `npx playwright install chromium` | Instalar o navegador dos testes              |
| `npm run test:e2e`                | Executar os testes em 390, 768 e 1440 pixels |
| `npm run test:e2e:report`         | Abrir o relatório de testes                  |
| `npm run audit:lighthouse`       | Auditar início/detalhe, mobile/desktop       |

Para habilitar mocks com `npm run dev`, copie `.env.example` para `.env`. A flag pública é `VITE_ENABLE_MOCKS=true`; não coloque segredos em variáveis VITE.

## Contas fictícias

| Nome de exibição | E-mail | Senha | Usuário |
| --- | --- | --- | --- |
| Gabriel | `gabriel@kurio.test` | `GoldoBotafogo18*` | `gabriel_usuario` |
| Mario Bros | `mario@kurio.test` | `GoldoBotafogo18*` | `super_mario` |

Depois de atualizar de uma versão anterior, use **Restaurar cenário inicial** em `/diagnostico` para carregar as novas contas. O reset apaga os dados simulados do navegador.

Essas credenciais são públicas e exclusivamente fictícias. Também é possível criar uma conta em `/register`. O banco simulado guarda hashes PBKDF2 com salt; não persiste senhas em claro. O cadastro cria uma sessão automaticamente.

## Conferência manual de conta e sessão

1. Acesse `/account/profile` sem entrar: você deve ser levado a `/login`.
2. Entre com uma conta fictícia: a aplicação deve retomar `/account/profile`.
3. Atualize a página: a sessão e os dados da conta permanecem.
4. Saia e entre com a outra conta. O e-mail e o nome anteriores não devem reaparecer.
5. Cadastre uma conta nova, saia e entre novamente com ela.
6. Tente cadastrar o mesmo e-mail ou nome de usuário: a API deve responder com conflito e o formulário deve associar o erro ao campo.
7. Em `/diagnostico`, clique em Expirar sessão. Ao acessar uma área privada, entre novamente para retomá-la. A expiração automática acontece após 15 minutos.
8. Abra a conta em duas abas e saia em uma delas. A outra deve perder o acesso privado.
9. Use Restaurar cenário inicial em `/diagnostico` para apagar os cadastros locais e restaurar as duas contas de exemplo.

`/account`, `/account/profile`, `/account/wallets`, `/account/favorites`, `/checkout`, `/orders` e `/orders/:id` exigem sessão. Perfil, carteiras e favoritos são editáveis e persistem no navegador. Checkout permite compra simulada, sem extensão, gateway ou transação real. As telas de autenticação têm composição sobre o catálogo em desktop e página dedicada em mobile. Login social e recuperação por e-mail não estão implementados.

## Perfil, carteiras e favoritos

1. Entre com uma conta e clique no coração de um NFT. O coração muda imediatamente e fica bloqueado enquanto a API responde. Abra Minha conta → Lista de interesse e atualize a página: a peça permanece salva.
2. Em `/diagnostico`, aplique o cenário de favoritos `fail-once`. Ao favoritar, a primeira requisição falha, a alteração é desfeita e surge uma mensagem. A tentativa seguinte funciona. O cenário `slow` permite observar a atualização otimista.
3. Em Perfil do colecionador, altere nome, usuário, e-mail, apelido e ENS. Salve e atualize. E-mail e usuário não podem repetir outra conta; ENS é opcional.
4. Escolha um avatar PNG, JPEG ou WebP de até 512 KB. A prévia só é persistida ao salvar o perfil. Teste também remover e salvar.
5. Em Alterar senha, informe a senha atual, uma nova senha e sua confirmação. Saia: a senha antiga deixa de funcionar. Use Restaurar cenário inicial para recuperar as credenciais públicas.
6. Em Carteiras, preencha e salve a principal. Para um exemplo fictício Ethereum, use o endereço `0x1111111111111111111111111111111111111111`, tipo MetaMask e código de indicação `KURIO2026`. Complete os demais campos obrigatórios.
7. Adicione a secundária. Copiar dados da principal preenche a identidade, mas exige outro endereço. É permitido somente um registro por papel; editar mantém esse registro. Endereços duplicados na mesma rede são rejeitados.
8. Saia e entre com a outra conta: favoritos, avatar e carteiras são separados por usuário.

A validação de endereço verifica o formato, sem consultar blockchain ou provar a posse da carteira. O favorito de um visitante leva ao login e retorna à página de origem; clique novamente no coração após entrar.


## Carrinho e cotação

1. Abra um NFT, selecione edição e quantidade e clique em Comprar NFT. O botão adiciona ao carrinho e abre `/cart`. O pedido é criado somente na confirmação explícita do checkout.
2. Altere a quantidade pelos botões ou digitando e pressionando Enter/saindo do campo. Remova um item. Edições da mesma peça ocupam linhas distintas; adicionar novamente a mesma edição soma as quantidades, respeitando o limite.
3. Atualize a página como visitante: os itens permanecem. Entre na conta: o carrinho visitante é unido ao já salvo na conta. A soma é limitada por estoque/limite, com aviso quando houver ajuste. Um item que perdeu todo o estoque permanece visível com conflito até ser removido.
4. Aplique `KURIO10`: desconto de 10% no subtotal. Use `ERRADO` para código inválido ou `EXPIRADO` para cupom expirado. Falhas não removem itens nem substituem um cupom já válido. Remover cupom recalcula os totais.
5. Com duas unidades Emerald Ape 1/50 a 1,19 ETH: subtotal 2,38; desconto 0,238 com KURIO10; taxa 0,016; total 2,158 ETH.
6. Em outra aba, abra `/diagnostico`. Em Carrinho e cotação, atualize `emerald-ape-042`, edição 1/50, preço `1.5` e estoque `2`. O carrinho aberto recebe os dados, recalcula e pede conferir os valores atualizados. Estoque menor que a quantidade bloqueia o avanço até ajuste/remoção.
7. Use Próxima alteração falha para testar recuperação sem perder itens. Sem conexão mostra erro e permite tentar novamente depois de aplicar Padrão. Resposta lenta permite observar os controles bloqueados.
8. Saia da conta: o carrinho da conta continua salvo e um novo carrinho visitante começa vazio. Outra conta não recebe o carrinho privado anterior. Duas abas da mesma sessão recebem mudanças por notificação e reconsulta.
9. Entrar e continuar leva ao login e retorna ao carrinho unido, para nova conferência. Continuar para pagamento abre o checkout privado, com seleção de carteira e revisão antes do envio.
10. Restaurar cenário inicial em `/diagnostico` apaga carrinhos, contas locais, alterações de mercado e cenários de falha.

A cotação usa apenas respostas da API. Taxa demonstrativa: 0,016 ETH por rede distinta, sem conversão para moedas reais. Todos os valores trafegam como strings decimais, com cálculo em wei/BigInt. A validade da cotação é de 60 segundos; ela é atualizada por eventos Socket.IO, tem reconsulta de segurança a cada 30 segundos enquanto a página está ativa e é revalidada no envio do pedido.


## Checkout e pedidos

1. Entre na conta e cadastre a carteira principal em Minha conta → Carteiras. Para o exemplo Ethereum use MetaMask, endereço fictício `0x1111111111111111111111111111111111111111` e código `KURIO2026`; complete os campos obrigatórios.
2. Adicione Emerald Ape 1/50 ao carrinho e escolha Continuar para pagamento. O perfil preenche os campos do colecionador; a carteira cadastrada fornece endereço e tipo. Esses dois campos são somente leitura; altere-os em Gerenciar carteiras.
3. Selecione a carteira e sua rede. Conectar carteira simulada não abre extensão. Revise os dados e clique em Revisar compra. Confira o resumo, marque a caixa de conferência e confirme explicitamente.
4. Acompanhe Pedido em processamento. No cenário padrão, o simulador conclui o pedido após cerca de 3 segundos e publica order.updated; somente então aparece Compra confirmada e o recibo. Atualize a página: o mesmo pedido e snapshot permanecem. Meus pedidos está no checkout e na visão geral da conta.
5. A compra inclui somente os NFTs da rede escolhida. Itens de outras redes, itens adicionados enquanto o pedido está pendente e quantidades excedentes ao snapshot permanecem no carrinho.
6. Ver referência simulada abre um explorador local demonstrativo. A referência SIM não corresponde a uma transação real. O recibo usa os valores, dados do colecionador e carteira registrados no envio, mesmo que catálogo, taxa ou perfil mudem depois.
7. Em outra aba, abra `/diagnostico` → Pagamento e pedidos. Recusar conexão mostra erro e impede revisão. Desconectar após conectar simula perda de conexão; reconecte e faça nova revisão para continuar.
8. Selecione Recusar como resultado do pedido e aplique. Depois de enviar, aparece Compra recusada; itens permanecem e o estoque reservado é liberado. Volte ao carrinho para uma nova tentativa.
9. Timeout após aceitar simula resposta atrasada: o cliente procura a tentativa pela mesma chave e recupera o pedido, sem duplicá-lo. Falhar antes de aceitar uma vez oferece Recuperar tentativa, inclusive após atualizar o checkout; mantém a chave do envio anterior.
10. Manter pendente permite testar refresh e recuperação. Copie o ID do pedido e use os botões Confirmar/Recusar pedido pendente no diagnóstico. Falhar consulta e envio mostra erro ao consultar o pedido; use Consultar estado para reproduzir imediatamente, retorne ao cenário padrão e consulte novamente.
11. Depois de revisar e antes de enviar, altere preço/estoque no diagnóstico ou atualize taxa/validade do cupom. A revisão deve ser refeita. O servidor também rejeita o envio antigo, mesmo se a tela ainda não tiver recebido a mudança. Uma revisão vence após 60 segundos.
12. Sair e entrar com outra conta não permite consultar pedidos anteriores. Restaurar cenário inicial limpa pedidos, reservas, revisões, conexões, alterações de mercado, carrinhos e contas locais.


## Tempo real e reconexão

1. Abra `/diagnostico`. Em Eventos de negócio e reconexão, aguarde `connected`. O painel mostra eventos aceitos/ignorados e ciclos de reconciliação. O teste de ping continua separado, mas usa o mesmo protocolo Socket.IO/MSW.
2. Abra outra aba com um NFT no carrinho. No diagnóstico, altere preço/estoque de `emerald-ape-042`, edição 1/50. Catálogo, detalhe e carrinho abertos recebem `nft.updated`, mostram aviso acessível e consultam a API. A cotação acompanha o novo valor.
3. Escolha `nft.updated` no painel e clique em Repetir evento duplicado ou Enviar evento antigo. Ignorados aumenta; valores e efeitos não são reaplicados. Os contadores ficam na aba do diagnóstico, que tem sua própria conexão de negócio.
4. Clique em Interromper tempo real. Mude o preço em outra aba e depois use Retomar tempo real. A reconexão consulta os recursos ativos na API e recupera o estado mesmo sem replay das mensagens perdidas. Como segurança, consultas de comércio também têm reconsulta lenta de 30 segundos.
5. Perder próximo evento descarta uma mensagem por conexão local. Faça uma mudança de mercado e interrompa/retome para recuperar a atualização pela API.
6. No checkout, revise a compra e marque a conferência. Interromper tempo real bloqueia a confirmação. Se preço, estoque, cupom ou taxa mudarem durante a interrupção, retomar traz a cotação atual e exige nova revisão. O servidor mantém a validação final de qualquer envio.
7. Crie um pedido no cenário Manter pendente. Interrompa o tempo real e resolva o pedido no diagnóstico. Ao retomar, o estado confirmado/recusado é recuperado sem novo POST de compra. Refresh também recupera pela URL do pedido.
8. Escolha `order.updated` e repita mensagens. Um pedido terminal não volta para pendente nem retira itens do carrinho novamente. O recibo permanece baseado no snapshot.
9. Testar evento de outra conta e Testar subscription anterior enviam envelopes de falha intencional pelo socket, sem dados pessoais. São descartados pelo cliente; não carregam pedido alheio. Logout/expiração/troca de conta encerram a subscription anterior.
10. Navegue entre diagnóstico e catálogo: o socket de diagnóstico é encerrado ao sair; a conexão de negócio global permanece. Há uma subscription de negócio por aplicação/aba, sem acumular listeners.


## Conferência manual do catálogo

1. Busque `Emerald` e clique em Buscar ou pressione Enter.
2. Marque Arte digital e Ethereum. No mobile e tablet, abra o botão Filtros.
3. Aplique mínimo `1` e máximo `2` ETH. Ordene por Maior preço: aparecem duas peças.
4. Atualize a página. A busca, os filtros e a ordenação devem permanecer.
5. Limpe tudo, vá para a página 2, aplique um filtro e use voltar/avançar do navegador.
6. Abra um card e retorne ao catálogo: a busca será preservada. A tela do NFT tem galeria, edições e limites de quantidade.
7. Visite `/diagnostico` para verificar REST/Socket.IO ou abrir cenários de demonstração.

## Cenários reproduzíveis

Acrescente `?scenario=...` à URL ou use os links em `/diagnostico`:

| Cenário        | Comportamento                                            |
| -------------- | -------------------------------------------------------- |
| `default`      | 36 NFTs, nove por página, latência fixa de 250 ms        |
| `empty`        | Resposta sem itens                                       |
| `slow`         | Latência de 1800 ms para conferir os skeletons           |
| `error-once`   | Primeira consulta retorna 503; Tentar novamente recupera |
| `offline`      | Falha de conexão em todas as consultas                   |
| `out-of-order` | Busca com Sage leva 1500 ms; demais levam 120 ms         |

Em `out-of-order`, busque Sage e, antes de terminar, busque Golden. O resultado antigo não deve substituir o novo. O estado dos cenários é da camada de mocks. Recarregar a página reinicia a falha transitória; `POST /api/demo/reset` também limpa seu registro. A fixture inicial do catálogo é determinística; preço e estoque podem mudar na camada de mercado. o reset também remove cadastros e sessões locais da simulação.

## Conferência manual do detalhe

1. Abra o primeiro card do catálogo ou acesse `/nfts/emerald-ape-042` diretamente.
2. Troque as quatro miniaturas e abra a imagem ampliada. Setas esquerda/direita mudam a imagem; Escape fecha e devolve o foco.
3. A edição padrão é `1/50`, por `1,19 ETH`, com limite de três unidades por pedido. Duas unidades totalizam `2,38 ETH`; três, `3,57 ETH`.
4. Troque para `1/1`: o preço passa a `3,57 ETH` e o limite passa a uma unidade. Recarregue a página: a edição continua selecionada. Quantidade reinicia em 1.
5. Confira a edição `1/10` esgotada. Para abrir diretamente esse estado, use `?edition=limited-10`.
6. Digite uma quantidade inválida (zero, fracionária ou maior que o limite): o formulário deve informar o erro e bloquear a ação.
7. Explore as abas de detalhes e avaliações pelo teclado e abra mais avaliações.
8. Abra Compartilhar e copie o link. Ele inclui a edição, sem a busca anterior ou os cenários de teste.
9. Acesse `/nfts/inexistente` e `/nfts/nft-035` para conferir NFT inexistente e todas as edições esgotadas.
10. Comprar NFT adiciona a seleção ao carrinho. Favoritos exigem login e aparecem em Lista de interesse.

### Cenários do detalhe

Use `?detailScenario=slow` para skeletons, `?detailScenario=error-once` para falha 503 seguida de recuperação e `?detailScenario=offline` para falha de conexão. Há links em `/diagnostico`. O cenário da listagem (`scenario`) é separado do cenário do detalhe (`detailScenario`), para reproduzir cada falha sem alterar o estado da busca.


## Testes e referências visuais

Playwright usa os handlers reais do MSW, sem substituir dados na interface. Há cenários funcionais e imagens de referência em `tests/visual-baselines`. Estas referências registram a versão atual da aplicação; não comprovam equivalência pixel a pixel com o Figma.

As imagens foram geradas em Linux/Chromium 153 com fonte local. Em outro sistema ou versão de Chromium pode haver diferenças de rasterização. Antes de aceitar uma atualização de baseline, examine o diff. Para gerar referências aprovadas no ambiente escolhido, use `npm run test:e2e -- --update-snapshots`.

O relatório da validação desta revisão está em `validation/report/index.html`. Os resultados detalhados estão em `validation/RESULTADOS.md`. Novas execuções geram `playwright-report`. Neste ambiente foi usado `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para apontar para Chromium alternativo; normalmente basta instalar o navegador pelo comando acima. Em Linux, o Playwright pode solicitar dependências do sistema.

## Assets e limitações

As quatro artes foram extraídas do PDF fornecido e convertidas em WebP. A galeria reutiliza cada arte com enquadramentos CSS (completa, rosto, acessórios e vestimenta); não são fotografias ou arquivos novos. A fonte local DejaVu Sans Mono é uma substituição provisória, acompanhada de sua licença. As cores foram aproximadas visualmente pelo PDF. Ainda precisamos confirmar os tokens e a família tipográfica originais no Figma.

Busca e controles de filtro foram adaptados aos requisitos funcionais. Blocos editoriais são demonstrativos; a ação Comprar NFT adiciona ao carrinho, e o checkout cria pedidos simulados somente após revisão e confirmação. Newsletter está desabilitada. Auditorias Lighthouse e revisão técnica estão documentadas nesta versão; a publicação pública permanece pendente. Carteiras, conexões e pedidos são simulados, sem extensão, assinatura ou cobrança real.

Para testar o build de demonstração em vez do servidor de desenvolvimento, execute `npm run build:demo` e depois `E2E_PREVIEW=true npm run test:e2e` (sintaxe de variável em Linux/macOS).

## Resultado desta versão

Typecheck, lint e build de demonstração aprovados. O resultado da validação desta revisão está em `validation/RESULTADOS.md`, com regressão visual de início, detalhe, login, cadastro, perfil, carteiras, favoritos, carrinho, pagamento e recibo nas três larguras. Consulte `validation/RESULTADOS.md` para ambiente e comandos.

O resultado atualizado e os comandos desta entrega estão em `validation/RESULTADOS.md`.

## Auditorias Lighthouse

Use Node 24 e Google Chrome/Chromium instalado. O script usa o build otimizado, inicia um preview temporário na porta 4173 e o encerra ao terminar:

```bash
npm ci
npm run build:demo
npm run audit:lighthouse
```

Serão executadas 12 medições em sequência: início e detalhe, perfis mobile e desktop, três vezes cada. Cada medição usa um novo perfil de navegador, sem sessão/carrinho prévios, com os mocks padrão, imagens, fontes e tempo real habilitados. São preservadas a emulação e a limitação simulada de CPU/rede dos presets do Lighthouse. Não execute Playwright ou outros trabalhos pesados em paralelo.

Os relatórios ficam em `validation/lighthouse`: HTML e JSON de cada execução, além de `summary.json` com medianas por categoria, LCP, CLS, TBT, ferramentas e ambiente. A configuração está em `scripts/lighthouse.config.mjs`. `validation/lighthouse/RESULTADOS.md` explica os resultados desta entrega e limitações da medição local.

Se Chrome não for detectado, informe o executável em `CHROME_PATH`. Para auditar um servidor externo, defina `AUDIT_BASE_URL`; nesse caso o script não inicia preview. `AUDIT_PAGE=inicio` ou `detalhe` e `AUDIT_PROFILE=mobile` ou `desktop` permitem selecionar uma combinação, sempre com três execuções. Use `AUDIT_OUTPUT` para outra pasta de resultados, evitando sobrescrever a evidência completa com uma execução parcial. No PowerShell, defina variáveis com `$env:NOME="valor"` antes do comando.

## Publicação

- Node.js 24; instalação: `npm ci`; build: `npm run build:demo`; saída: `dist`.
- A raiz do projeto é o diretório que contém `package.json`. O modo mock usa `.env.mock` e habilita MSW.
- Vercel: build e fallback SPA configurados em `vercel.json`. Netlify: fallback em `public/_redirects`.
- A hospedagem precisa de HTTPS e deve servir `/mockServiceWorker.js` como JavaScript.
- Validação após publicação: acesso direto e refresh das rotas, diagnóstico REST/Socket.IO, login, compra, recibo e reconexão em duas abas da mesma origem.

O deploy público ainda não foi realizado. Os dados simulados pertencem ao navegador e à origem; não são compartilhados por dispositivos diferentes.

## Comparativo de cotação no checkout

Enquanto há uma revisão aberta, alterações recebidas durante a compra exibem **O que mudou na sua compra**. O quadro compara a última revisão com a cotação atual: NFT e edição afetados, preço por unidade, diferenças de quantidade/estoque, subtotal, desconto, taxa de rede e total. Itens adicionados ou removidos também são identificados. No celular, cada linha é reorganizada em um bloco com os rótulos Antes, Agora e Diferença, preservando a leitura sem rolagem horizontal da página.

As colunas **Antes**, **Agora** e **Diferença** mostram aumentos com `+`, reduções com `−` e valores iguais como **Sem alteração**. As diferenças monetárias usam wei com BigInt, preservando até 18 casas decimais. Na linha de desconto, aumento significa maior abatimento; a linha Total mostra o efeito final da compra.

O vencimento da revisão tem um aviso próprio. Se a cotação continua igual, a interface informa que a revisão expirou sem alteração dos valores, sem apresentar uma mudança de preço inexistente. Mudança e vencimento podem ser informados juntos quando ambos ocorrerem.

A confirmação permanece bloqueada até uma nova revisão válida. **Revisar compra** atualiza a referência do comparativo e exige marcar novamente a conferência dos dados. A comparação é informativa; a API continua revalidando a compra e protegendo o envio por idempotência.

Para reproduzir:

1. Entre na conta, cadastre uma carteira, adicione um NFT da rede correspondente e abra o checkout.
2. Conecte a carteira simulada e clique em **Revisar compra**.
3. Em outra aba da mesma origem, use `/diagnostico` para alterar o preço ou estoque do NFT, a taxa ou a validade do cupom.
4. Confira o comparativo e o bloqueio da confirmação. Faça uma nova revisão para aceitar os dados atualizados.

Para uma unidade de Emerald Ape, sem cupom, passar de 1,19 para 1,50 ETH com taxa de 0,016 ETH altera o total de 1,206 para 1,516 ETH: diferença de +0,31 ETH.

Os testes de checkout cobrem aumento/redução, precisão de um wei, taxa, perda de desconto por cupom expirado, estoque, quantidade, entrada/remoção de itens, vencimento sem mudança e nova confirmação nas larguras de 390, 768 e 1440 px. Os resultados executados estão em `validation/RESULTADOS.md`.
