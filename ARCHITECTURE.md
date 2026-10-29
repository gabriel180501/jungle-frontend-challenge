# Arquitetura

## Separação de responsabilidades

React apresenta os dados; Router controla páginas e URL; Query gerencia estado remoto; Axios envia HTTP; MSW responde na camada de rede. Fixtures não são importadas por componentes, hooks ou pelo cliente Axios. A mesma simulação atende desenvolvimento, demonstração e testes.

## Catálogo e URL

`CatalogSearch` define busca, coleções, redes, faixa de preço, ordenação, aba, página e cenário. O Router valida entradas desconhecidas, aplica padrões e limita páginas a inteiros positivos. Valores de preço inválidos na URL são descartados; o formulário apresenta erros antes de navegar. Arrays são serializados pelo TanStack Router em JSON na URL. As chamadas REST usam parâmetros repetidos (`collection` e `network`), sem depender dessa serialização.

Filtros de uma mesma dimensão usam OR; dimensões distintas usam AND. Busca, filtros, aba e ordenação reiniciam a página em 1. Alterar página preserva os demais parâmetros. Mudanças criam entradas no histórico e não deslocam a rolagem; links de exploração usam a âncora do catálogo. Não há armazenamento paralelo da busca em localStorage: a URL é a fonte do estado aplicado. Inputs de busca e preço são rascunhos até envio do formulário.

## Contratos REST implementados

### GET /api/nfts

Parâmetros opcionais:

- `q`: trecho do nome, até 100 caracteres, sem distinção de maiúsculas.
- `collection`: repetível; valores de `collectionOptions`.
- `network`: repetível; Ethereum, Polygon, Solana.
- `minPrice`, `maxPrice`: strings decimais ETH, inclusivas.
- `sort`: recent, price-asc, price-desc, name.
- `tab`: all, new, trending.
- `page`: inteiro positivo, padrão 1. Tamanho de página fixo em 9.
- `scenario`: seleção exclusiva da simulação documentada no README.

Resposta: `{ items: Nft[], page, pageSize, total, totalPages, facets: { collections, networks } }`. Facets contam o conjunto completo de fixtures, não a página atual. Os números diferem dos exemplos decorativos do design porque refletem dados reais da simulação. Página além do intervalo retorna lista vazia com total preservado e uma ação para voltar à primeira página.

### GET /api/nfts/:id

Retorna `NftDetail`, que estende `Nft` com resumo, descrição, token, coleção, criador, direitos autorais, contrato, padrão, atributos, mídia, edições, edição padrão, avaliações e recomendações. IDs inexistentes retornam 404 `{ code: "NOT_FOUND", message }`.

`NftEdition` contém `id`, `label`, `price` (string ETH), `available` e `maxPerOrder`. O limite apresentado é o menor entre estoque e limite de pedido, recebido da API. O default de preço/disponibilidade da listagem corresponde à edição padrão do detalhe. Edições 1/1 têm estoque de uma unidade. Outras edições podem ter preços e limites distintos.

`detailScenario` aceita default, slow, error-once e offline. O parâmetro é exclusivo do mock e compõe a chave da consulta. Resposta de detalhe inclui cinco recomendações disponíveis da série Kurio Apes; o campo `collection` da listagem continua representando as categorias de filtro, enquanto `collectionName` representa a série.

Os 19 reviews fictícios têm datas e notas fixas. A média é derivada das notas recebidas. A interface revela mais avaliações localmente porque a resposta já contém a lista completa.

### GET /api/health

Retorna `{ status: "ok", service }` após 400 ms. Restrito à tela técnica de diagnóstico.

### POST /api/demo/reset

Limpa o registro de falhas transitórias de catálogo e detalhe e retorna 204. A fixture de catálogo é imutável. O reset restaura as contas fictícias, remove contas criadas e sessões locais; o cliente limpa dados privados e reinicia consultas públicas.

Erros de demonstração: 503 `{ code: "TRANSIENT_FAILURE", message }` e falha de conexão via `HttpResponse.error()`. Os demais contratos de conta/compra serão implementados com as respectivas funcionalidades.

## Cache e concorrência

Chave de listagem: `["nfts", "list", search]`; detalhe: `["nfts", "detail", id, detailScenario]`. Todos os parâmetros que mudam o resultado participam da chave. AbortSignal do Query é encaminhado ao Axios. Ao mudar a busca, uma resposta antiga não pode substituir a consulta atual. Não usamos placeholder de outra busca para evitar apresentar itens incompatíveis com os filtros aplicados.

Stale time de 30 s. Consultas do catálogo não fazem retry automático, permitindo observar falhas e tentar novamente explicitamente. O padrão global é uma repetição de consulta; mutations não repetem automaticamente. Há feedback de atualização em segundo plano e refetch padrão ao recuperar foco. Eventos de negócio invalidam os recursos ativos e reconciliam com REST, conforme a seção de tempo real.

Preços trafegam como strings. Comparações de filtro/ordenação convertem para unidades inteiras com BigInt e 18 casas decimais. Apresentação é uma transformação de strings, sem usar Number para dinheiro.

## Socket.IO

`socket.io-client` usa WebSocket, path `/socket.io/` e namespace padrão. MSW 2.10.5 e `@mswjs/socket.io-binding` 0.2.0 estão compatíveis. O binding publicado usa `toSocketIo`, diferente da branch main do repositório. Nessa versão, MSW remove `/socket.io/` durante o match; o handler usa a origem terminada em `/`.

A aplicação é importada depois da inicialização do worker, para que o cliente capture o WebSocket interceptado. O hook abre uma conexão própria e libera listeners e conexão ao desmontar, inclusive com StrictMode. `diagnostics.ping` recebe `{ id, message }` e responde com `diagnostics.pong`, preservando id. Heartbeat Engine.IO a cada 20 s é cancelado no fechamento.

Limitações: simulação WebSocket sem polling, salas, namespaces customizados ou anexos binários. A integração passa pelo cliente Socket.IO, sem setters diretos no mock. `nft.updated`, `order.updated`, ordenação de eventos e reconciliação REST ainda serão implementados.

## Design, acessibilidade e assets

Referência: PDF e captura do Figma fornecidos. As quatro imagens foram extraídas do PDF: Emerald Ape (xref 2457), Sage Nomad (2433), Ivory Baron (2419) e Golden Beat (2409). Convertidas para WebP 640×640; a mesma arte é reutilizada em nomes diferentes no material original e nas fixtures. Assets do template inicial foram removidos. O favicon K é um SVG simples do projeto.

Fonte substituta: DejaVu Sans Mono local, normal e negrito, em WOFF2, com licença em `public/fonts/LICENSE.txt`. Não afirmamos que é a fonte original do Figma. Cores aproximadas; confirmação dos tokens originais permanece pendente.

Desktop tem sidebar e três colunas de NFTs; mobile tem duas colunas e navegação inferior. Tablet/mobile usam filtros em diálogo nativo, com foco modal, Escape e retorno ao gatilho. Labels, fieldsets, estados de erro, foco visível e avisos live são explícitos. Shimmer respeita prefers-reduced-motion. Imagens têm dimensões e aspect-ratio definidos. Imagens secundárias usam lazy loading; imagem do hero tem prioridade alta.

Busca e filtros foram acrescentados/adaptados para os comportamentos exigidos. Login/cadastro possuem rotas próprias com apresentação sobreposta ao catálogo em desktop e tela dedicada em mobile. Páginas editoriais não foram criadas; cards são estáticos com indicação de conteúdo demonstrativo. Newsletter está desabilitada; ações não implementadas explicam sua indisponibilidade num diálogo. O detalhe tem galeria, edições, quantidade, compartilhamento e avaliações; Comprar NFT adiciona ao carrinho; favoritos persistem por usuário autenticado. Pedidos são criados somente após revisão e confirmação explícita no checkout.

## Verificação e próximos passos

E2E exercita MSW e Socket.IO em Chromium, em 390, 768 e 1440 pixels. Cobre combinações de filtro, preço com 18 casas, histórico, refresh, paginação, falha e recuperação, resultados vazios, respostas antigas, navegação para detalhe, foco de diálogo e overflow. A corrida usa relógio controlado no navegador. Baselines do início e do detalhe ficam no projeto. Relatórios HTML acompanham a entrega; traces são retidos em falhas.

Auditorias Lighthouse e revisão técnica estão registradas em `validation`. Permanecem pendentes o deploy público e sua validação na origem publicada. As contas são fictícias, com credenciais de teste no README.

## Seleção de edição e quantidade

`DetailSearch` estende a busca do catálogo com `edition` e `detailScenario`. Ao retornar à listagem, esses campos são removidos para preservar apenas o estado do catálogo. A edição aplicada é mantida no histórico/refresh. Identificador de edição desconhecido ou esgotado não é trocado silenciosamente: a tela informa o estado e exige uma seleção disponível. A quantidade é um rascunho local, inteira e positiva, revalidada contra os limites da edição em cada render. Trocar edição reinicia em 1; trocar NFT também reinicia a galeria e a aba. Valores inválidos permanecem editáveis, com erro associado ao campo e ação desabilitada.

A consulta retorna todas as edições, então alternar edição não exige outra requisição. Quantidade não participa da URL e reinicia após refresh. Subtotal usa multiplicação de unidades inteiras com BigInt e retorna string decimal; não é uma cotação para finalizar compra. Taxas, descontos e validação final pertencem às etapas de carrinho e checkout.

Se uma atualização em segundo plano falhar, os dados já apresentados são preservados, uma mensagem permite refazer a consulta e a ação fica bloqueada. NFT inexistente (404) tem estado próprio, diferente de falha recuperável (rede/503). Skeletons preservam espaço aproximado de galeria e informações e respeitam movimento reduzido.

## Galeria, abas e compartilhamento

A galeria tem quatro enquadramentos CSS da mesma arte local, sem inventar imagens ausentes do PDF. Miniaturas e setas mudam o enquadramento; a imagem ampliada usa diálogo nativo com Escape, foco modal e retorno ao botão. Alterar o NFT remonta o conteúdo para evitar seleção da peça anterior.

As abas usam primitives Radix no padrão de componentes locais shadcn/ui, com navegação por setas, papéis ARIA e associação entre tabs/painéis. Selecionar a nota abre a aba de avaliações.

Compartilhar abre um diálogo com link canônico da peça e edição; exclui filtros anteriores e parâmetros de simulação. Copiar usa Clipboard API. Se houver bloqueio de permissão ou API indisponível, a interface seleciona o endereço e orienta cópia manual. Não envia mensagens a redes sociais ou a terceiros.

As rotas de detalhe e diagnóstico são carregadas sob demanda pelo Router. Radix Tabs e Socket.IO de diagnóstico não fazem parte do código inicial do catálogo. O CSS de detalhe permanece local e compartilhado para evitar conteúdo sem estilo ao abrir a rota.

## Autenticação e sessão

`AuthProvider` compartilha a consulta `["session"]` entre a interface e o Router. Um layout sem caminho (`_authenticated`) executa `beforeLoad` e consulta a API antes de liberar `/account`, perfil, carteiras ou checkout. Verificações de rota exigem uma leitura atual da sessão; falha de rede não é interpretada como login bem-sucedido. O componente privado também verifica a presença do usuário antes de apresentar qualquer dado.

Login e cadastro usam mutations sem retry automático e bloqueiam envio repetido. Sucesso substitui a sessão e limpa consultas/mutations privadas. Cada operação tem uma geração; respostas de autenticação substituídas não podem aplicar sessão antiga. O mock também controla a ordem das operações para que um login pendente não reabra sessão encerrada por logout/reset.

Chaves privadas começam com `["private", userId, ...]`. A consulta de conta inclui cenário de latência e encaminha AbortSignal; também descarta resposta de usuário diferente do esperado. Logout, expiração e troca de usuário cancelam/removem essas consultas e limpam o cache de mutations. Dados públicos do catálogo são preservados no logout. O reset da demonstração também reinicia as consultas públicas.

Cookie opaco identifica uma sessão simulada de 15 minutos. A API valida usuário e expiração em cada acesso privado. Um timer do provider reconsulta a sessão no vencimento; navegação privada e recuperação de foco também a verificam. Respostas 401 com código de sessão invalidam a identidade e o cache privado. Credenciais incorretas no login usam código distinto e não disparam logout global.

O parâmetro `redirect` preserva caminho, busca e hash do fluxo anterior. A aplicação aceita apenas destinos locais das rotas previstas, rejeitando URL externa, prefixo //, barras invertidas e loops para login/cadastro. Depois de entrar, navega com replace para retomar o contexto. O carrinho visitante é unido ao autenticar; o pagamento retoma somente após conferência do carrinho.

BroadcastChannel comunica apenas mudança de sessão, sem dados pessoais ou tokens. Outras abas cancelam/removem dados privados e consultam a API novamente. A conexão Socket.IO de diagnóstico é encerrada e recriada quando a identidade muda; eventos de negócio vinculados a usuário estão implementados.

## Contratos de conta implementados

- `POST /api/auth/register`: `{ username, email, password, confirmPassword }`; retorna sessão e usuário público com status 201. Validação 422 e conflito de e-mail/nome 409.
- `POST /api/auth/login`: `{ email, password }`; retorna sessão. Dados inválidos 422; credenciais incorretas 401 `INVALID_CREDENTIALS`.
- `GET /api/session`: `{ user, expiresAt }`; visitante recebe ambos null. Cookie inválido/expirado recebe 401 `SESSION_EXPIRED` e é removido.
- `POST /api/auth/logout`: revoga a sessão atual e retorna 204; pode ser repetido.
- `GET /api/account?accountScenario=default|slow`: usuário público da sessão. O cenário slow atrasa 1800 ms. Se a identidade mudar durante a consulta, retorna 409 `SESSION_CHANGED` em vez de dados antigos.
- `POST /api/demo/session/expire`: expira a sessão para demonstração e retorna 204.
- `POST /api/demo/reset`: restaura catálogo/cenários/contas, limpa sessões e retorna 204.

Usuário público: `{ id, username, email, createdAt }`. Hash, salt e identificador de sessão não são devolvidos na representação do usuário. Erros: `{ code, message, fields? }`, com associação de erro aos campos quando aplicável.

## Persistência e limites da simulação

Somente a camada de mocks lê/escreve `kurio.mock.database.v1` no localStorage. Contém usuários, hashes/salts, sessões, favoritos e carteiras. A leitura migra bases anteriores acrescentando os mapas ausentes, preservando contas existentes. Cadastro gera salt aleatório e deriva hash com PBKDF2/SHA-256, 120.000 iterações e 256 bits. As duas fixtures também contêm apenas hashes e salts. Senhas trafegam no corpo da requisição simulada e permanecem temporariamente no formulário; não são persistidas em claro. Logging de requests do MSW foi desativado para evitar imprimir credenciais.

Por ser um servidor simulado em JavaScript, o cookie é escrito pela camada de mocks com Path=/ e SameSite=Strict (Secure em HTTPS), sem HttpOnly. O banco e a autorização local podem ser alterados pelo usuário nas ferramentas do navegador. Essa arquitetura cumpre a simulação do desafio e não representa autenticação pronta para produção. Um backend real deve manter credenciais, sessões e autorização no servidor e emitir cookie HttpOnly. Não há integrações reais de login social, recuperação por e-mail, carteiras ou blockchain.

A persistência é do mesmo navegador/origem, não é sincronizada com servidor. BroadcastChannel coordena a interface entre abas, mas localStorage não oferece transações distribuídas entre elas. Reset remove integralmente a base simulada e restaura as duas contas fixas.

## Telas privadas nesta versão

A área da conta apresenta e edita os dados da API simulada. Perfil/avatar/senha, carteiras e favoritos estão implementados. Checkout já tem proteção de rota e retorno de sessão, com envio de pedido implementado. Os controles auxiliares de login social estão desabilitados e recuperação de senha informa indisponibilidade.


## Perfil, carteiras e favoritos

Consultas privadas de perfil, carteiras e favoritos usam chaves com userId, verificam a identidade da resposta e encaminham AbortSignal. Mutations também verificam a geração da autenticação antes de aplicar respostas. O servidor determina o proprietário pela sessão, nunca por um userId enviado pelo formulário. Operações com latência verificam novamente a sessão antes de persistir.

- `GET /api/profile` e `PUT /api/profile`: perfil com versão. Atualizações concorrentes ou e-mail/usuário duplicados retornam 409; campos inválidos retornam 422. Salvar atualiza a identidade e comunica a mudança às outras abas.
- `PUT /api/profile/password`: confere hash da senha atual, valida confirmação, cria novo salt/hash e revoga as outras sessões do usuário. Mantém a sessão atual. Senha não integra o cache de perfil.
- `GET /api/wallets`, `POST /api/wallets` e `PUT /api/wallets/:id`: principal antes da secundária, um registro por papel, versão para edição e endereço único por rede no usuário. Carteira de outro usuário retorna 403, inexistente retorna 404.
- `GET /api/favorites`, `PUT /api/favorites/:id` e `DELETE /api/favorites/:id`: lista por usuário, alterações idempotentes e versão monotônica.
- `POST /api/demo/favorites/scenario`: simulações default, slow e fail-once, separadas por usuário.

O favorito altera imediatamente o cache compartilhado por cards, detalhe e lista. Cada operação guarda o estado anterior somente do seu NFT: rollback não restaura uma cópia antiga da lista inteira. Respostas com versão antiga são descartadas; operações ainda pendentes são sobrepostas à lista recebida. O mesmo botão fica bloqueado durante seu envio, enquanto outros NFTs podem ser alterados. Logout/troca de identidade limpam as operações pendentes e o cache privado.

Avatar aceita PNG/JPEG/WebP até 512 KB, com verificação de assinatura no mock e decodificação no cliente. A imagem é persistida como data URL na simulação. Falha de quota retorna 507 e preserva o estado anterior. Isso não substitui validação e armazenamento de uploads em um backend real.

As telas usam salvamentos separados para perfil e senha, com mensagens de erro/sucesso e foco no primeiro campo inválido. ENS é opcional. Copiar identidade da carteira principal não copia o endereço. Esses ajustes permitem usar os formulários sem inventar uma integração de carteira. Conexão e compra simuladas estão implementadas. Integrações reais continuam fora do escopo.


## Carrinho e cotação

O carrinho é público para visitante, identificado por cookie opaco `kurio.mock.guest`, e privado quando há sessão. A API resolve o proprietário: `guest:<uuid>` ou `user:<id>`. Não aceita owner enviado pelo cliente. Os dados ficam somente na camada de mocks, em `kurio.mock.carts.v1`, separados da base de autenticação. Login/cadastro unem o visitante ao usuário, somam linhas de mesma peça/edição e limitam a quantidade com aviso. Excluem o carrinho visitante consumido e removem seu cookie. Logout deixa o carrinho da conta persistido; o próximo acesso anônimo cria identidade visitante nova. Não transfere o carrinho privado para outro usuário.

Contratos:

- `GET /api/cart`: `{owner, version, items, coupon, notices}`. Linhas contêm nftId/editionId, quantidade inteira, preço unitário/total em strings ETH, disponibilidade/limite e problema de disponibilidade.
- `POST /api/cart/items`: `{nftId, editionId, quantity, version}`, soma a quantidade à linha existente.
- `PUT /api/cart/items`: mesmo corpo, substitui a quantidade da linha.
- `DELETE /api/cart/items`: `{nftId, editionId, version}` no corpo, remove a linha; ausência pode ser repetida com versão atual.
- `PUT /api/cart/coupon`: `{coupon, version}`; string vazia remove. KURIO10 concede 10%; EXPIRADO retorna erro de expiração; outros códigos são inválidos. Cupom inválido não altera o anterior.
- `POST /api/cart/quote`: recalcula o carrinho atual; retorna `{owner, cartVersion, fingerprint, expiresAt, subtotal, discount, networkFee, total, coupon, couponError, valid, problems}`. Nenhum valor enviado pelo cliente é aceito como preço ou total.
- `POST /api/demo/cart/scenario`: `{mode: default|slow|fail-once|offline}`. fail-once afeta a próxima mutation de item/cupom, não é consumido por polling de leitura.
- `POST /api/demo/market`: `{nftId, editionId, price?, available?}` persiste alterações demonstrativas de mercado em `kurio.mock.market.v1` e notifica as abas.

Respostas de escrita retornam o carrinho atualizado. Quantidade inválida gera 422, NFT/edição inexistente 404, estoque/limite e versão antiga 409, sessão vencida 401, falha transitória 503 e falta de espaço 507. Após a latência, a API revalida proprietário e cookie antes de gravar. Mutations usam a versão lida para evitar que uma requisição atrasada substitua edição mais nova. Como nos outros mocks, o armazenamento local não fornece transações distribuídas entre abas.

Cotação calcula em BigInt/wei. Subtotal é a soma dos totais das linhas; desconto é 10% truncado para um wei quando aplicável; taxa simulada é 0,016 ETH por rede distinta; total = subtotal − desconto + taxa. Carrinho vazio não tem taxa e não pode continuar. Não há conversões de rede reais. Snapshot reflete preço/estoque atual, preservando linhas indisponíveis com erro em vez de apagá-las.

TanStack Query usa chaves `['cart', identidade]`, incluindo versão e assinatura dos itens na chave de cotação. Respostas conferem geração da autenticação e proprietário antes de aplicar dados. Logout/troca de conta cancelam e removem o cache de carrinho. Mutations são serializadas por identidade, sem retry automático, e controles ficam bloqueados durante escrita. Após sucesso/falha, carrinho e cotação são reconsultados; a atualização otimista com rollback permanece nos favoritos.

Notificação BroadcastChannel `kurio-commerce` não transporta dados pessoais, somente o sinal de atualização. O cliente invalida somente o carrinho do owner atual para mensagens de carrinho; alterações de mercado/pedido seguem o Socket.IO. A página aberta também reconsulta a cada 30 segundos e ao recuperar foco para cobrir notificações perdidas; Socket.IO de negócio está integrado. A cotação tem TTL de 60 segundos, erro/expiração bloqueiam avanço. Alteração de fingerprint exige uma nova conferência dos itens/valores. O checkout revalida os valores antes de criar o pedido, conforme a seção Checkout e pedidos.

Tela reproduz a composição do carrinho do PDF em desktop e adapta linhas/resumo ao mobile. Limites inconsistentes das quantidades ilustrativas do layout são substituídos pelos limites reais dos dados simulados. Recomendações vêm da API pública. O carrinho encaminha ao checkout; somente o pedido confirmado gera recibo de sucesso. Não há conexão de extensão nem pagamento real.


## Checkout e pedidos

Rotas privadas: `/checkout`, `/orders` e `/orders/:orderId`. O checkout usa perfil e carteiras persistidos. Campos do colecionador são validados no cliente e na API. Endereço/tipo são da carteira cadastrada, não aceitos como carteira arbitrária no envio. ENS e referência secundária são opcionais; nota tem limite de 500 caracteres. Os dados do formulário integram o snapshot sem editar implicitamente o perfil da conta.

A seleção de rede limita a compra aos NFTs dessa rede; o resumo informa as unidades restantes de outras redes. Taxa e cupom são calculados no servidor para esse subconjunto. Uma conexão pertence ao usuário, cookie de sessão, ID/versão da carteira e rede, com validade de 15 minutos. Mudança da carteira, rede, sessão, desconexão ou expiração invalida a conexão para novos envios. A perda de conexão depois do aceite não cancela um pedido já recebido.

### Contratos

- `POST /api/wallet-connections`: `{walletId, network}` → Connection, 201. Recusa de simulação retorna 403; rede incompatível ou carteira ausente retorna 422.
- `GET /api/wallet-connections/:id`: conexão pública da própria conta, incluindo connected atual, sem cookie/token. `DELETE` desconecta; idempotente para ID ausente.
- `POST /api/checkout/quote`: `{network}` → `{userId, items, otherItems, quote}`. Valores são strings ETH; não aceita preços enviados pelo cliente.
- `POST /api/checkout/review`: `{collector, connectionId}` → Review, 201: ID, dono, validade, conexão e snapshot da compra. Erros de campos 422; carteira desconectada ou cotação indisponível 409.
- `POST /api/orders`: `{reviewId}` com cabeçalho `Idempotency-Key`. Retorna Order 201 no aceite e 200 no reenvio idempotente. Mesma chave com outra reviewId gera 409. Revisão expirada, usada, cotação alterada, conexão inválida ou outro pedido pendente também geram 409. Não há retry automático de mutation.
- `GET /api/orders/by-key/:key`: recupera a tentativa da conta atual; 404 quando ainda não aceita.
- `GET /api/orders` e `GET /api/orders/:id`: listagem e snapshot/estado. Pedido alheio recebe 403 e inexistente 404. Visitante/sessão inválida recebe 401. A API não usa userId enviado pelo cliente para escolher proprietário.

Review inclui validade de 60 segundos e fingerprint de versão do carrinho, IDs/quantidades, preço, disponibilidade, cupom, desconto e taxa. Na criação, a API recalcula os valores, confere conexão, dono, validade e fingerprint dentro de uma seção exclusiva. Alteração exige nova revisão e nova confirmação. A idempotência é verificada antes da revisão: um pedido já aceito continua recuperável mesmo depois de vencer a revisão ou desconectar a carteira.

### Persistência, concorrência e recuperação

`kurio.mock.orders.v1` guarda conexões/revisões/pedidos/cenários da API simulada. O cookie de sessão só integra a representação interna da conexão, nunca a resposta. Pedidos guardam chave de tentativa, revisão, estado, resultado agendado e snapshot imutável. A listagem é sempre filtrada pelo usuário e consultas/mutations do cliente verificam dono e geração da autenticação.

Web Locks usa a exclusão `kurio-commerce` entre abas para operações de pedido, escrita do carrinho, alterações de mercado e reset. Uma operação síncrona guarda os valores anteriores das três bases de comércio e restaura-os se a persistência falhar. Isso mantém a simulação coerente durante falhas comuns, mas não fornece durabilidade de banco transacional em caso de queda do processo entre escritas: um backend real precisa de transação e restrição única por usuário/chave.

Reservas ficam no estado de mercado e são descontadas da disponibilidade pública. Aceite reserva uma vez, sem retirar itens do carrinho. O agendador da simulação avança pedidos após cerca de 3 segundos; consultas também recuperam uma transição vencida. Confirmação consome a reserva e subtrai somente as quantidades compradas do carrinho atual; não apaga itens adicionados depois ou de outra rede. Recusa libera a reserva e mantém o carrinho. Estado terminal não é aplicado novamente. Um pedido pendente por usuário evita tentativas independentes concorrentes da mesma conta. O cenário manual permanece pendente até resolução explícita.

O cliente guarda `{key, reviewId}` em sessionStorage, separado por userId, antes de enviar. Se não conseguir guardar, bloqueia envio. Timeout de 2 segundos ou resposta incerta consulta by-key; pedido encontrado é retomado. Caso não tenha sido aceito, Recuperar tentativa reutiliza o mesmo corpo/chave, inclusive após refresh. Erro definitivo de validação/conflito permite revisar novamente. Logout não apaga uma tentativa incerta; a mesma conta pode recuperá-la ao voltar. Reset apaga as tentativas locais e o estado do mock.

Consultas de pedido usam namespace privado, cancelamento, refetch no foco/reconexão e eventos order.updated e polling de segurança de 30 segundos enquanto pendentes. A lista também tem polling de segurança de 30 segundos. A comunicação entre os servidores simulados das abas utiliza BroadcastChannel; no cliente, eventos de negócio chegam pelo Socket.IO, conforme a seção Eventos de negócio e reconciliação. Erro de consulta preserva o último estado conhecido e nunca mostra confirmação sem estado confirmed retornado pela API. Novos envios exigem nova revisão; não há envio automático após reconectar.

Recibo usa exclusivamente snapshot: itens/imagens/edições/quantidades/preços, cupom, totais, dados do colecionador, carteira/rede e data do pedido. Referência `SIM-...` abre um explorador local explicitamente simulado. Não há links que aparentem apontar para uma transação real.

### Diagnóstico

`POST /api/demo/orders/scenario` aceita wallet connect/refuse/disconnect e order confirm/reject/pending/timeout-confirm/fail-once/offline. Cenários persistem por usuário. Offline simula falha na consulta/envio; timeout-confirm aceita e atrasa a resposta além do timeout do cliente; fail-once falha antes de criar pedido. `POST /api/demo/orders/:id/resolve` recebe status confirmed/rejected, apenas para pedido da própria conta. `POST /api/demo/pricing` recebe networkFee string e couponExpired boolean, alterando cotação global da simulação. O reset restaura taxa 0,016 ETH, validade do cupom e remove reservas, pedidos, revisões e conexões.


## Eventos de negócio e reconciliação

Há uma conexão global de negócio por aplicação/aba e um socket adicional de ping apenas quando a página de diagnóstico está montada. Ambos usam `socket.io-client` com transporte WebSocket, namespace padrão e `forceNew`. MSW intercepta a conexão e `@mswjs/socket.io-binding` codifica/decodifica Engine.IO/Socket.IO. O cliente emite session.subscribe somente depois do evento connect; o mock valida a sessão/cookie e responde sync.ready antes de emitir eventos de negócio dessa subscription.

### Envelope e versões

Envelope: `{eventId, type, streamId, resourceId, version, occurredAt, audience, status?}`. A entrega inclui subscriptionId. eventId é estável ao repetir o evento; streamId identifica o cenário persistido e muda no reset. resourceId identifica o NFT/pedido; version é inteiro monotônico por recurso. audience é public para NFT/taxa e o userId autorizado para pedido. Eventos não contêm recibo, endereço, e-mail, token de sessão ou dados do colecionador.

- `nft.updated`: emitido ao alterar uma edição ou reservar/consumir/liberar estoque. Atualiza catálogo, detalhe, recomendações, favoritos, carrinho e cotação por invalidação e leitura REST. Nft.version é o mesmo contador no evento e nas representações REST. Uma alteração em qualquer edição incrementa a versão do NFT inteiro.
- `order.updated`: emitido no aceite e na transição terminal, com recurso, versão e status. Novos pedidos têm versão 1; confirmação/recusa incrementam para 2. Bases anteriores recebem versão compatível na leitura. O cliente consulta a API antes de apresentar o estado, sem fabricar confirmação a partir do envelope.
- `pricing.updated`: evento adicional para mudança de taxa e validade do cupom, usando a revisão do mercado como versão. Invalida as cotações; a revisão do checkout precisa ser refeita quando o fingerprint mudar.

Eventos são publicados após a persistência bem-sucedida do negócio. O agendador do mock usa a mesma exclusão Web Locks dos endpoints, verifica pedidos vencidos e publica a transição uma única vez. Reservas/consumo alteram as versões dos NFTs. A resposta REST e os eventos leem o mesmo armazenamento; nenhum componente conhece fixtures de negócio.

### Subscriptions e isolamento

session.subscribe envia `{subscriptionId, userId}`. O servidor resolve usuário/token pelo cookie; nunca confia apenas no userId enviado. Cada entrega privada verifica novamente a sessão capturada e filtra audience. O binding não oferece rooms completas: a seleção dos destinatários é implementada explicitamente no mock. Um novo connect gera subscriptionId novo, mesmo se o Manager reconectar a mesma instância do cliente.

O cliente confere a geração da autenticação, subscriptionId, streamId, tipo, formato, versão e audience. Logout/expiração/troca de sessão desconectam imediatamente o socket e removem listeners; o provider inicia outro ciclo para a identidade atual. Callbacks e consultas antigas verificam geração antes de atualizar a interface. O cache continua separado por usuário. A conexão de diagnóstico também é liberada ao desmontar a página.

### Duplicatas, ordem e reconciliação

O cliente mantém versões máximas por tipo/recurso e um conjunto limitado aos últimos 256 eventIds aceitos. Versões iguais/menores ou IDs repetidos não invalidam consultas nem repetem avisos. Versões já vistas em respostas REST também alimentam esse controle. Evento pendente não substitui um estado terminal conhecido. Consultas individuais de pedido preservam um cache terminal/mais recente se uma resposta REST antiga chegar.

Eventos aceitos avisam a interface e agendam uma reconciliação. A implementação agrupa eventos recebidos durante uma leitura, cancela consultas relevantes pendentes e invalida os recursos da identidade atual. A API fornece os dados completos; payload não é aplicado como se fosse um recibo. Na primeira conexão, consultas iniciais sem dados seguem seu próprio ciclo; cache já existente é revalidado sem reiniciar a consulta inicial e consumir cenários de erro uma vez. Após reconectar, há reconciliação completa mesmo sem receber evento, cobrindo mensagens perdidas durante interrupção. Reset troca streamId e permite reiniciar as versões com um estado conhecido.

Reconciliação invalida dados de NFTs e somente carrinho/favoritos/cotação/pedidos da identidade atual. Refetch ativo, foco/reconexão e polling lento de 30 segundos permanecem como segurança. O checkout bloqueia confirmação enquanto a conexão/reconciliação não está pronta e continua bloqueando erros de cotação/versão. Uma conexão pronta não substitui a validação de erros REST nem a revalidação final do servidor.

### Limites e controles da simulação

`kurio.mock.events.v1` guarda streamId, últimos 100 envelopes e bloqueios do diagnóstico. `BroadcastChannel('kurio-mock-events')` distribui envelopes entre os *servidores simulados* das abas; cada servidor entrega um pacote Socket.IO ao seu cliente. A aplicação não escuta esse canal para alterar cache. O canal anterior kurio-commerce permanece apenas para escritas de carrinho, com filtragem de proprietário, e não fornece um atalho para nft.updated/order.updated.

O binding 0.2.0 não é um servidor Socket.IO de produção: não implementa todas as funções de rooms/namespaces/polling/ack/recovery. Usamos WebSocket e o namespace padrão, heartbeat Engine.IO de 20 segundos e backoff de reconexão de 500–2000 ms. O mock não abre porta de rede e os dados continuam locais à origem/navegador. Um backend real deverá autenticar a conexão, autorizar subscriptions e emitir os eventos no servidor.

`POST /api/demo/realtime/control` recebe action interrupt/resume/duplicate/stale/drop-next/foreign/old-session e type opcional (nft.updated/order.updated/pricing.updated). Os controles operam apenas sobre a identidade atual; os cenários foreign/old-session geram envelopes artificiais mínimos para testar o descarte, sem conteúdo privado de outra conta. `GET /api/demo/realtime/stats` informa contagem de conexões/subscriptions locais da identidade, sem listar sessões/tokens. O log é limitado e não promete replay completo; a recuperação correta vem da API.

O agendador existe enquanto há sockets locais e é encerrado com a última conexão. Se a aplicação estiver fechada/interrompida, pedidos com prazo vencido são recuperados na reconexão/consulta, sem novo envio. Callbacks de conexão, heartbeat, temporizador de bloqueio, listeners de autenticação e sockets são removidos no encerramento do ciclo. O receptor de eventos do mock tem vida útil do módulo/aba, sem crescimento por navegação.


O cenário de teste de troca de sessão também usa `POST /api/demo/cart/scenario` com mode hold, que retorna um gateId aleatório e retém somente mutations. `GET /api/demo/cart/hold/:gateId` informa quando a requisição já está retida; `POST /api/demo/cart/release` com esse gateId libera a resposta. Isso permite garantir que a autenticação em outra aba terminou antes de liberar a requisição antiga, sem depender da velocidade da máquina ou pausar os timers do Service Worker. A liberação não ignora as verificações de sessão/versão; o reset libera e remove todos os gates. É um controle de teste da camada de mocks.

## Auditoria e entrega

Lighthouse participa da solução como dependência de desenvolvimento com execução Node reproduzível, configuração versionada, três medições por página/perfil e relatórios completos. Os perfis são os presets mobile e desktop do Lighthouse; os viewports dos testes Playwright continuam 390/768/1440. Não foi criada uma variante simplificada para auditoria: a inicialização do MSW, o protocolo Socket.IO, as chamadas REST, os assets e a interface são os mesmos do build publicado.

A execução em contêiner Linux/headless com renderização por software pode divergir de Chrome em hardware real. As medianas locais são evidência de laboratório, sem equivalência a métricas de campo ou ao deploy. Resultados abaixo das metas e seus principais custos são registrados em `validation/lighthouse/RESULTADOS.md`.

Os cards passaram a usar seu conteúdo visível (nome, preço e indicação de oferta/estoque) como nome acessível do link; um aria-label abreviado omitia partes desse conteúdo. A seção do catálogo ganhou um h2 acessível sem alteração da composição visual. As duas primeiras imagens do catálogo têm carregamento prioritário; as demais continuam lazy. `robots.txt` passou a ser um arquivo estático válido, evitando que o fallback SPA respondesse HTML a essa requisição.

A configuração da Vercel publica o modo de demonstração explicitamente. O fallback das rotas não fornece backend real; as APIs são interceptadas pelo MSW após o bootstrap. A publicação deve usar HTTPS, servir o service worker original e ser conferida na origem pública. O README documenta os requisitos de publicação; o deploy público ainda não foi realizado.

## Comparação de cotações

`features/checkout/quote-comparison.tsx` compara o snapshot da revisão ainda aberta com a cotação REST atual. Os itens são associados pelo identificador composto de NFT/edição; preço unitário, quantidade, total das unidades, estoque, limite e disponibilidade são apresentados separadamente para não atribuir toda variação do subtotal a uma mudança de preço. Cupom, subtotal, desconto, taxa e total completam a comparação. Deltas monetários são calculados com ethToWei/weiToEth e BigInt, sem conversão para Number.

O checkout distingue alteração do fingerprint de expiração da revisão, preservando a condição de bloqueio que já existia. Cotação indisponível, revisão alterada ou vencida, desconexão e sincronização pendente continuam impedindo a confirmação. A tabela aguarda o término da atualização da cotação e não é mostrada como atual durante erro de leitura. Uma nova revisão substitui o snapshot e exige nova marcação de aceite. Não há um histórico de comparação persistido após encerrar essa revisão; o recibo continua usando exclusivamente o snapshot efetivamente enviado. Contratos de rede, mutations de compra e revalidação no servidor foram preservados.
