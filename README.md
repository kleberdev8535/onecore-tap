# OneCore Tap

Plataforma SaaS B2B da **OneCore Business** para restaurantes, hamburguerias, pizzarias, cafeterias e bares. O cliente faz o pedido direto da mesa, aproximando o celular do NFC ou escaneando o QR Code de uma plaquinha física. O estabelecimento acompanha pedidos, mesas, cardápio, equipe e faturamento em um painel próprio.

Um único sistema atende todos os restaurantes (multi-tenant). Os dados de cada estabelecimento ficam isolados, e a OneCore Business administra a operação pelo painel **Super Admin**.

> **Status:** Fases 1 (Fundação), 2 (Super Admin), 3 (Painel do restaurante), 4 (Pedidos) e 5 (Comercial) concluídas. Veja [Roadmap](#roadmap) para saber o que já funciona e o que vem a seguir.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Executar localmente](#executar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Testes](#testes)
- [Segurança e multi-tenancy](#segurança-e-multi-tenancy)
- [Fluxos operacionais](#fluxos-operacionais)
- [Deploy](#deploy)
- [Decisões técnicas](#decisões-técnicas)
- [Roadmap](#roadmap)

---

## Arquitetura

```text
onecore-tap/
├── backend/                 Spring Boot 4.1 (Java 21) - monólito modular
│   └── src/main/java/com/onecore/tap/
│       ├── auth/            login, sessão, /me, redefinição de senha
│       ├── security/        Spring Security, permissões, rate limit
│       ├── tenancy/         resolução do restaurante (Hibernate @TenantId)
│       ├── users/           usuários, perfis, bootstrap do Super Admin
│       ├── restaurants/     cadastro e implantação (Super Admin), personalização e horários (restaurante)
│       ├── categories/      categorias do cardápio (entidade isolada por restaurante)
│       ├── products/        cardápio: produtos, categorias, adicionais e variações
│       ├── tables/          mesas (Super Admin e restaurante)
│       ├── orders/          pedidos, cálculo de preço, Kanban, cozinha, atendimento das mesas e chamados
│       ├── notifications/   tempo real (Server-Sent Events) por restaurante
│       ├── plates/          plaquinhas NFC + QR Code
│       ├── plans/           planos de assinatura e módulos por plano
│       ├── payments/        pagamentos dos pedidos, financeiro e relatórios (CSV) do restaurante
│       ├── billing/         assinaturas, cobranças, rotina diária, venda de plaquinhas e receita da OneCore
│       ├── dashboard/       indicadores globais e do restaurante
│       ├── audit/           trilha de auditoria
│       ├── common/          erros padronizados (ProblemDetail), base de entidades
│       └── config/          propriedades e OpenAPI
│   └── src/main/resources/db/migration/   migrações Flyway
├── frontend/                React 19 + TypeScript + Vite
│   └── src/
│       ├── components/      design system (ui/) e marca (brand/)
│       ├── features/        auth, admin, restaurant, plates, plans... (por domínio)
│       ├── layouts/         shell dos painéis (sidebar recolhível + drawer), Super Admin e restaurante
│       ├── services/        cliente HTTP (sessão + CSRF)
│       ├── styles/          tokens de design (Tailwind v4)
│       └── types/           contratos da API
├── docker-compose.yml       PostgreSQL (+ backend opcional)
└── .env.example
```

| Camada | Tecnologias |
|---|---|
| Backend | Java 21, Spring Boot 4.1.1 (Web MVC, Security, Data JPA, Validation, WebSocket, Actuator), Hibernate 7, Flyway, springdoc OpenAPI |
| Banco | PostgreSQL 17+ (UUIDs, constraints, índices, migrações versionadas) |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, componentes no padrão shadcn/ui (Radix), Lucide, Motion, TanStack Query, React Hook Form + Zod, React Router |
| Testes | JUnit 5, Spring Security Test, Testcontainers / PostgreSQL embarcado, Vitest, Testing Library |

**Fluxo de requisição:** o navegador acessa somente o domínio do frontend, e `/api/*` é encaminhado ao backend (proxy do Vite em desenvolvimento, rewrite da Vercel em produção). Assim o cookie de sessão fica *same-site*, sem CORS com credenciais entre domínios.

## Pré-requisitos

| Ferramenta | Versão |
|---|---|
| JDK | 21 (ex.: Eclipse Temurin 21) |
| Node.js | 20.19+ ou 22+ (testado com 24) |
| PostgreSQL | 17 ou 18 (local ou via Docker) |
| Docker | Opcional: sobe o banco e roda os testes com Testcontainers |

O Maven não precisa ser instalado: o projeto usa o Maven Wrapper (`./mvnw`).

## Executar localmente

### 1. Banco de dados

**Opção A: Supabase (sem servidor próprio).** Crie um projeto em supabase.com e copie a connection string em *Project Settings > Database* (use a do *Session pooler*, porta 5432). Configure:

```bash
DB_URL=jdbc:postgresql://<host-do-pooler>:5432/postgres?sslmode=require
DB_USERNAME=postgres.<ref-do-projeto>
DB_PASSWORD=<senha-do-banco>
```

Nenhuma mudança de código é necessária: o Supabase é PostgreSQL e o Flyway cria as tabelas no primeiro boot. Use somente o banco (não as APIs/Auth do Supabase): toda regra de acesso continua no backend.

**Opção B: Docker:**


```bash
docker compose up -d db
```

Sem Docker, use um PostgreSQL local e crie o banco:

```sql
CREATE USER onecore WITH PASSWORD 'onecore';
CREATE DATABASE onecore_tap OWNER onecore;
```

As tabelas são criadas automaticamente pelo Flyway na primeira inicialização do backend.

### 2. Backend

```bash
cd backend
# Linux/macOS
export SUPERADMIN_EMAIL=admin@onecorebusiness.com.br
export SUPERADMIN_PASSWORD='uma-senha-forte-com-12+'
./mvnw spring-boot:run

# Windows (PowerShell)
$env:SUPERADMIN_EMAIL="admin@onecorebusiness.com.br"
$env:SUPERADMIN_PASSWORD="uma-senha-forte-com-12+"
.\mvnw.cmd spring-boot:run
```

- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Health check: `http://localhost:8080/actuator/health`

No primeiro boot o Super Admin é criado a partir de `SUPERADMIN_EMAIL` e `SUPERADMIN_PASSWORD`. Nos boots seguintes essas variáveis são ignoradas e o Super Admin existente nunca é sobrescrito.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173` e entre com o Super Admin.

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (proxy `/api` para `localhost:8080`) |
| `npm run build` | type-check + build de produção |
| `npm test` | testes (Vitest) |
| `npm run lint` | lint (oxlint) |

## Variáveis de ambiente

Todas estão documentadas em [.env.example](.env.example). As principais:

| Variável | Uso |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | conexão PostgreSQL |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | cria o primeiro Super Admin (somente se não existir) |
| `APP_URL` | URL pública do frontend (links de e-mail) |
| `CORS_ALLOWED_ORIGINS` | origens permitidas, separadas por vírgula |
| `SESSION_COOKIE_SECURE` | `true` em produção (HTTPS) |
| `API_DOCS_ENABLED` | liga/desliga o Swagger |
| `MAIL_LOG_CONTENT` | **somente dev**: escreve o conteúdo dos e-mails no log |
| `PLATE_PUBLIC_BASE_URL` | base da URL gravada nas plaquinhas (padrão `https://tap.onecorebusiness.com.br/t/`). **Defina antes de produzir as plaquinhas**: ela fica impressa no QR e gravada no NFC. Em dev: `http://localhost:5173/t/` |

Nenhum segredo é usado no frontend.

## Testes

```bash
cd backend && ./mvnw test        # 90 testes (unitários + integração com PostgreSQL real)
cd frontend && npm test          # 32 testes
```

Os testes de integração rodam contra **PostgreSQL real**:

- com Docker disponível: Testcontainers (`postgres:17-alpine`);
- sem Docker: PostgreSQL embarcado (binários oficiais via `io.zonky.test:embedded-postgres`).

Para forçar um modo: `./mvnw test -Donecore.test.db=docker` ou `-Donecore.test.db=embedded`.

O que está coberto:

| Suíte | Verifica |
|---|---|
| `AuthIntegrationTest` | login/sessão, mensagem genérica para e-mail inexistente ou senha errada, bloqueio após 5 falhas, exigência de CSRF, logout invalidando a sessão, restaurante suspenso bloqueando a equipe, fluxo completo de redefinição de senha com token de uso único, política de senha |
| `AuthorizationIntegrationTest` | proprietário sem acesso ao Super Admin, Super Admin sem acesso aos endpoints operacionais do restaurante, permissões de cozinha e garçom, validação de entrada |
| `TenantIsolationIntegrationTest` | restaurante B não lista nem lê (por ID direto) dados do A, `restaurantId` enviado no corpo é ignorado, nomes únicos por restaurante, consultas sem contexto não retornam nada, troca de tenant dentro de transação aberta é recusada |
| `MenuIntegrationTest` | produto com variação e adicionais, esgotar, exclusão de grupo removendo o vínculo, preservação dos IDs das opções ao editar, validação de preço e de regras de escolha, nome duplicado na categoria, categoria com produtos não pode ser excluída, reordenação exige a lista completa, **restaurante não usa nem vê categoria, grupo ou produto de outro**, permissões de gerente, garçom e cozinha |
| `StaffIntegrationTest` | convite de funcionário até o login com a nova senha, proprietário não cria outro proprietário nem Super Admin, troca de perfil encerra a sessão aberta e fica no histórico, limite de usuários do plano no convite e na reativação, **funcionário de outro restaurante é invisível (404)**, gerente sem acesso à equipe |
| `RestaurantPanelIntegrationTest` | mesas com limite do plano, renomear e desativar, outro restaurante não altera a mesa, garçom sem acesso a configurações e dashboard, personalização, contato, horários (com faixa que vira a noite e recusa de sobreposição), confirmação de pedidos, dashboard com contagens reais |
| `OrderIntegrationTest` | preço calculado no servidor ignorando valores do navegador, preço histórico preservado após mudar o cardápio, regras de variação/adicionais e disponibilidade, produto de outro restaurante recusado, fluxo do Kanban com permissões (cozinha só prepara, caixa não move), conflito de edição simultânea, cancelamento com motivo e histórico, atendimento da mesa, chamados sem duplicar, pedir a conta não marca pago, encerramento da mesa, **isolamento de pedidos entre restaurantes**, modo de teste da implantação, horário fechado, confirmação opcional, 12 pedidos simultâneos com números únicos, eventos em tempo real só para o restaurante dono |
| `PaymentIntegrationTest` | caixa fecha a mesa dividindo Pix e dinheiro com troco, **garçom e cozinha não registram**, soma precisa bater com o total, pedido não é pago duas vezes nem antes de confirmado, pedido pago só é cancelado depois do estorno (com motivo), **outro restaurante não paga, não estorna e não vê o financeiro**, indicadores por método/produto/categoria/mesa, CSV de pedidos e de produtos, **módulos do plano** bloqueando Financeiro, Relatórios e o perfil só de cozinha (pagamentos continuam liberados) |
| `BillingIntegrationTest` | ativação cria a assinatura e a primeira cobrança, atraso vira inadimplência, **suspensão automática após a carência derruba a sessão da equipe**, recebimento quita e **reativa** o restaurante, suspensão manual nunca é desfeita pela cobrança, teste vira assinatura paga ao terminar, renovação idempotente (uma cobrança por período), upgrade vale na próxima cobrança, receita da OneCore separada das vendas dos restaurantes, venda de plaquinhas com preço congelado, cancelamento |
| `FinanceRulesTest` | CSV seguro contra injeção de fórmula, divisão de métodos, validação de período |
| `OrderRulesTest` | cálculo de preço, máquina de estados, horário com faixa que vira a noite |
| `IpRateLimiterTest`, `RestaurantServiceTest` | rate limit por janela, slug, regras de bloqueio e de tenant do usuário |
| Frontend | redirecionamento por perfil e proteção contra *open redirect*, cliente HTTP (CSRF, erros ProblemDetail, falha de rede), validação e erros da tela de login, menu do restaurante por permissão, regras de horário, regras de escolha de adicionais |

## Segurança e multi-tenancy

- **Sessão** em cookie `HttpOnly`, `SameSite=Lax` (`Secure` em produção). Nada sensível vai para o `localStorage`.
- **CSRF**: cookie `XSRF-TOKEN` lido pelo SPA e reenviado no header `X-XSRF-TOKEN` em toda requisição que altera estado (inclusive o login).
- **Senhas** com BCrypt (via `DelegatingPasswordEncoder`, permite migrar o algoritmo depois). Tokens de redefinição guardam somente o hash SHA-256, expiram em 30 minutos e valem uma vez.
- **Força bruta**: bloqueio da conta por 15 minutos após 5 falhas (persistido no banco) + limite por IP.
- **Isolamento entre restaurantes**: entidades do restaurante usam `@TenantId` do Hibernate. O tenant vem **exclusivamente** do usuário autenticado, resolvido em um único ponto (`TenantIdentifierResolver`). O Hibernate filtra todas as consultas e preenche os inserts automaticamente. Sem contexto, nenhuma linha é retornada.
- **Permissões** granulares por perfil (`Permission`), aplicadas no backend com `@PreAuthorize` e por rota.
- **Auditoria** de logins, falhas, bloqueios, logout, redefinições de senha e ações do Super Admin (`audit_logs`).
- Cabeçalhos: CSP restritiva na API, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.

## Fluxos operacionais

| Fluxo | Situação |
|---|---|
| Cadastrar um restaurante | **Disponível.** Super Admin, menu *Restaurantes*, botão *Novo restaurante*. O restaurante nasce com status *Em implantação*. |
| Criar usuário proprietário | Restaurante > aba *Proprietário* > *Gerar convite*. O link (uso único, 72h) aparece para o Super Admin enviar, porque o e-mail ainda não está configurado. |
| Criar mesas | Restaurante > aba *Mesas*: em sequência (1 a 12) ou por nome. Respeita o limite do plano. |
| Gerar plaquinhas | *Estoque* > *Novo lote*. Cada uma recebe serial (OCT-000123) e token aleatório de 8 caracteres. Baixe o **PDF de impressão** com os QR Codes, ou SVG/PNG individual pelo menu da plaquinha. |
| Vincular NFC e QR Code | Grave no chip NFC (app NFC Tools, registro *URL*) a mesma URL do QR: veja em *Link e histórico*. Depois vincule a plaquinha à mesa (aba *Plaquinhas* do restaurante). Para trocar de mesa ou restaurante, use *Transferir*: O chip NFC e o QR Code da mesma plaquinha recebem a **mesma URL permanente**. Trocar de restaurante ou mesa é só uma mudança de vínculo no painel, sem reimprimir nem regravar. |

### Comercial (Fase 5)

**Pagamentos dos pedidos (restaurante).** Registro operacional: a equipe confirma o que recebeu no caixa. Não é cobrança online e nenhum dado de cartão é coletado (só o método).

| Onde | O que faz | Perfis |
|---|---|---|
| Mesas > mesa ocupada | Link do cardápio da mesa (copiar/abrir), valor a receber do atendimento atual e **Receber da mesa** | Caixa, gerente e proprietário registram; garçom vê a mesa sem registrar |
| Pedidos > detalhe | **Registrar pagamento** de um pedido aceito | Caixa, gerente, proprietário |
| Financeiro | Vendido x recebido x a receber, ticket médio e cancelamentos com comparação ao período anterior; vendas por dia; recebido por método; vendas por categoria, produto e mesa; pedidos a receber de qualquer data; histórico de registros com **estorno com motivo** | Caixa, gerente, proprietário (módulo Financeiro do plano) |
| Relatórios | Período livre comparado com outro período; produtos; exportação **CSV** de pedidos e de vendas por produto (separador ";", abre no Excel) | Idem (módulo Relatórios do plano) |

Regras: o pagamento pode ser dividido em até 4 métodos e a soma precisa fechar com o total; no dinheiro, o valor recebido calcula o troco; pedidos de teste e aguardando confirmação não recebem pagamento; **pedido pago não pode ser cancelado** sem antes estornar o registro.

**Assinaturas e financeiro da OneCore (Super Admin).**

| Tela | O que faz |
|---|---|
| Restaurante > aba Cobrança | Assinatura (situação, plano, período, atraso), cobranças mensais com **registrar recebimento** (método, data, comprovante) e anular, **venda de plaquinhas** (preço de Configurações congelado na venda) |
| Assinaturas | Todas as assinaturas com filtro por situação, próximo vencimento e atraso; **Executar rotina agora** |
| Financeiro | MRR, recebido no período (assinaturas e plaquinhas separados), inadimplência, plaquinhas vendidas e a receber, receita recebida por mês. **Não usa os pedidos dos restaurantes** |
| Planos | Valor, limites e **módulos** (Cozinha, Financeiro, Relatórios) |
| Configurações | Preço da plaquinha e **carência** antes da suspensão automática |

Ciclo da assinatura: ativar o restaurante cria a assinatura e a primeira cobrança (vence no início do período); iniciar teste cria a assinatura em teste. A **rotina diária (06:00, horário de Brasília)** converte testes encerrados, emite as cobranças de cada novo período, marca "em atraso" e, passada a carência, **suspende** o restaurante. Registrar o recebimento que quita o atraso **reativa automaticamente** quando a suspensão foi da rotina; suspensões manuais nunca são desfeitas por ela. Trocar de plano vale a partir da próxima cobrança (sem pró-rata).

### Pedidos pela plaquinha (Fase 4)

1. O cliente aproxima o celular do NFC ou lê o QR Code e abre `/t/{token}`: cardápio com as cores do restaurante, mesa identificada, busca, categorias, destaques, produtos esgotados como indisponíveis e horários.
2. Escolhe produtos, variações (obrigatórias) e adicionais, quantidade e observações, e envia o pedido. **Sem conta**: o aparelho guarda só um identificador anônimo para listar "meus pedidos".
3. O servidor recalcula tudo pelo cardápio atual (preços enviados pelo navegador são ignorados), grava o nome e o preço praticados em cada item e numera o pedido (#0001...).
4. Por padrão o pedido entra como **aguardando confirmação** (um QR Code pode ser fotografado); a equipe confirma no Kanban e ele vai para a cozinha. Desligável em *Configurações*.
5. O cliente acompanha o status em `/t/{token}/pedido/{código}`, vê o valor parcial da mesa, chama o garçom ou pede a conta (pedir a conta não marca nada como pago).
6. A mesa fica **ocupada** a partir do primeiro pedido e é liberada quando a equipe **encerra o atendimento** em *Mesas* (pedidos entregues são concluídos).

| Tela da equipe | O que faz | Perfis |
|---|---|---|
| Pedidos (Kanban) | Novos, em preparo, prontos, entregues, concluídos e cancelados; arrastar e soltar no desktop e botão do próximo passo (alternativa acessível); detalhe com histórico; cancelamento com motivo; chamados das mesas; histórico paginado com filtros; alertas sonoros configuráveis por aparelho | Proprietário, gerente e garçom movem; caixa consulta |
| Cozinha | Pedidos confirmados por ordem de chegada, fonte e botões grandes, tempo desde a confirmação, alerta de atraso (15 e 25 min), filtros, tela cheia | Cozinha (inicia preparo e marca pronto), proprietário, gerente |
| Dashboard | Vendas, pedidos, ticket médio e cancelamentos por período (hoje, 7 ou 30 dias) com comparação ao período anterior, operação ao vivo, vendas por dia, horários de pico e mais vendidos | Proprietário, gerente |

**Testar antes de ativar:** com o restaurante em implantação, abra a URL da plaquinha estando logado como Super Admin ou como equipe do restaurante. O pedido fica marcado como teste, conclui a etapa "Pedido de teste" do checklist e não entra nas vendas.

### Painel do restaurante (Fase 3)

O proprietário entra em `/app` com o acesso criado pelo convite. A sidebar mostra só o que o perfil permite (o backend valida de novo em cada requisição).

| Tela | O que faz | Perfis |
|---|---|---|
| Dashboard | Produtos, categorias, mesas e equipe com números reais, checklist de configuração e pontos de atenção. A área de vendas fica vazia até existirem pedidos (Fase 4): nada é simulado. | Proprietário, gerente |
| Cardápio | Produtos com preço, foto (URL https), descrição, destaque, ativo/inativo e disponível/esgotado; ordem de exibição; aba de **adicionais e variações** (variação = escolha obrigatória de 1 opção, ex.: Tamanho; adicionais = opcionais com mínimo e máximo). | Proprietário e gerente editam; caixa e garçom consultam |
| Categorias | Criar, renomear, ocultar, reordenar e excluir (somente sem produtos). | Idem |
| Mesas | Cadastrar em sequência ou por nome (limite do plano), renomear, capacidade, ativar/desativar; mostra a plaquinha vinculada. Trocar a plaquinha continua com a OneCore Business. | Proprietário e gerente editam; caixa e garçom consultam |
| Funcionários | Convidar (link de 72h, uso único), editar nome e perfil, ativar/desativar, novo convite e histórico de ações. Respeita o limite de usuários do plano. Mudar o perfil ou desativar encerra as sessões abertas. | Proprietário |
| Personalização | Cores (com checagem de contraste), logotipo, imagem de capa, descrição e horário de funcionamento, com prévia no celular. | Proprietário |
| Configurações | Contato e endereço, confirmação de pedidos antes da cozinha (ligada por padrão), dados comerciais e plano (somente leitura). | Proprietário |

Módulos que o plano não inclui (Cozinha, Financeiro, Relatórios) aparecem no menu com o selo "Plano" e abrem uma explicação; o backend recusa com 403 e o código `PLAN_MODULE_NOT_INCLUDED`.

## Deploy

**Backend (Railway):** use o [backend/Dockerfile](backend/Dockerfile). Configure as variáveis do `.env.example`, com `SESSION_COOKIE_SECURE=true`. A porta vem de `PORT`. O Railway expõe `/actuator/health` para health check.

**Frontend (Vercel):** projeto apontando para `frontend/`, build `npm run build`, saída `dist`. Edite [frontend/vercel.json](frontend/vercel.json) e troque `SEU-BACKEND.up.railway.app` pelo domínio real do backend. Esse rewrite mantém `/api` na mesma origem do app.

**Banco:** PostgreSQL gerenciado com backups automáticos ativos.

## Decisões técnicas

1. **Monólito modular** organizado por domínio. Microsserviços não se justificam neste estágio.
2. **Multi-tenancy por discriminador (`restaurant_id`) com `@TenantId` do Hibernate**, em vez de schema por cliente. É mais simples de operar com centenas de restaurantes e o filtro é automático, o que evita esquecimentos em consultas manuais. `TenantContext.callAs` existe para fluxos sem usuário logado (ex.: cardápio público resolvido pela plaquinha) e só é aceito fora de uma transação aberta.
3. **Sessão com cookie + CSRF em vez de JWT** no navegador: revogação imediata no logout e nenhum token acessível por JavaScript.
4. **Usuários sem `@TenantId`:** o login precisa encontrar o usuário antes de saber o restaurante. Consultas de funcionários sempre filtram explicitamente pelo restaurante da sessão.
5. **Erros padronizados** em RFC 9457 (`ProblemDetail`) com mensagens em português prontas para a interface e erros por campo em `fields`.
6. **Testes contra PostgreSQL real**, nunca H2. A máquina de desenvolvimento original não tem Docker, por isso existe o modo embarcado.
7. **Módulos ainda não entregues aparecem no menu com a fase de entrega** e abrem uma página que descreve o escopo planejado. Nenhum indicador ou dado é simulado.
8. **Chaves estrangeiras compostas `(id, restaurant_id)` no cardápio.** Produto, categoria, grupo de adicionais e opção só se referenciam dentro do mesmo restaurante, garantido pelo próprio PostgreSQL, além do filtro `@TenantId` da aplicação.
9. **Variações como grupos de escolha obrigatória.** Tamanho e similares usam o mesmo modelo dos adicionais (mínimo = máximo = 1), o que mantém um único cálculo de preço no servidor para a Fase 4.
10. **Tempo real com Server-Sent Events, não WebSocket.** O deploy coloca a API atrás do rewrite da Vercel para manter o cookie de sessão na mesma origem, e esse rewrite não repassa WebSocket. SSE usa HTTP comum, o mesmo cookie e a mesma autorização, reconecta sozinho e basta para o fluxo servidor -> painel (as ações seguem por REST). Os eventos são só avisos: o painel recarrega da API ao receber um evento e a cada reconexão; o PostgreSQL continua a fonte de verdade. As conexões expiram a cada 5 minutos para revalidar a sessão.
11. **Concorrência nos pedidos.** Número do pedido incrementado atomicamente no banco (`INSERT ... ON CONFLICT ... RETURNING`), um atendimento aberto por mesa garantido por índice único parcial, e transições com a etapa de origem + versão otimista: se duas pessoas movem o mesmo pedido, a segunda recebe 409 e a tela se atualiza.

12. **Pagamento do pedido é registro operacional**, com estorno em vez de exclusão: o histórico financeiro nunca perde informação. Divisão por método em `payment_entries`; o pedido aponta para o registro (`orders.payment_id`) com uma constraint que mantém status e vínculo coerentes.
13. **Cobrança da assinatura sem provedor**: a interface `BillingGateway` define o contrato (criar a cobrança, confirmar por webhook consultando a API do provedor). Sem implementação, os recebimentos são registrados manualmente e nada é marcado como pago sozinho.
14. **Rotina de cobrança idempotente e única**: índice único por período de cobrança e lock consultivo do PostgreSQL (`pg_try_advisory_xact_lock`), seguro com mais de uma instância. Valores congelados (preço da assinatura e da plaquinha) preservam o histórico.
15. **Módulos por plano** verificados no backend (`PlanFeatures`); restaurante sem plano, ainda em implantação, não sofre restrição. Pagamentos, cardápio, mesas e pedidos fazem parte de todos os planos.

### Limitações conhecidas

- **E-mail:** ainda não há provedor configurado. A redefinição de senha gera o token, mas o e-mail **não é enviado** (fica registrado no log; com `MAIL_LOG_CONTENT=true`, o link aparece no log em desenvolvimento). Um provedor (SMTP, Resend, SES...) será plugado na interface `MailGateway`.
- **Rate limit por IP** em memória, por instância. O bloqueio por conta vale globalmente.
- **Sessões em memória:** com mais de uma instância do backend, será necessário Spring Session JDBC/Redis.
- **Logotipo** é informado por URL https; o upload direto entra quando o armazenamento de imagens (Cloudinary/S3) for configurado.
- **Tempo real** em memória por instância: com mais de uma instância do backend, distribuir os eventos (PostgreSQL LISTEN/NOTIFY ou Redis).
- **Sessão temporária de mesa / código de validação** para pedidos (além da confirmação pelo restaurante) fica para uma etapa posterior, como previsto no escopo.
- **Pagamento online** (Pix dinâmico, link de pagamento, maquininha integrada) e **cobrança automática da assinatura** dependem da integração com um provedor (ex.: Mercado Pago), ainda não implementada. Hoje tudo é registro manual confirmado.
- **Sem pró-rata** na troca de plano e **sem nota fiscal**: a cobrança é mensal cheia.
- **Relatórios da plataforma** (uso por restaurante, exportação de receita) ficam para a Fase 6; a receita já está no Financeiro do Super Admin.
- **Fotos de produtos e capa** também são informadas por URL https até o armazenamento de imagens ser configurado.
- O **proprietário** é criado e gerenciado pela OneCore Business; pela tela de funcionários ele gerencia os demais perfis.

## Roadmap

| Fase | Escopo | Situação |
|---|---|---|
| 1 - Fundação | Projetos, banco, Flyway, autenticação, permissões, multi-tenancy, design system, login, estrutura do Super Admin, cadastro e listagem de restaurantes | **Concluída** |
| 2 - Super Admin | Implantação com checklist real, identidade visual com checagem de contraste, convite do proprietário, mesas, estoque e lotes de plaquinhas, vinculação/transferência/suspensão com histórico, QR SVG/PNG/PDF, URL pública /t/{token}, planos, usuários, auditoria, configurações, revogação imediata de sessão | **Concluída** |
| 3 - Restaurante | Painel do restaurante: dashboard com dados reais, produtos, categorias, adicionais e variações, mesas, funcionários com convite e histórico, personalização (marca, capa, descrição, horários), configurações | **Concluída** |
| 4 - Pedidos | Cardápio público, carrinho, pedidos com preço calculado no servidor, confirmação pelo restaurante, Kanban com arrastar e soltar, cozinha, tempo real (SSE), acompanhamento pelo cliente, atendimento das mesas, chamados, dashboard de vendas | **Concluída** |
| 5 - Comercial | Registro de pagamentos (dividido, troco, estorno), financeiro e relatórios com CSV do restaurante, assinaturas com cobranças e rotina diária (atraso, suspensão e reativação automáticas), venda de plaquinhas, financeiro da OneCore, módulos por plano | **Concluída** |
| 6 - Finalização | Testes E2E, revisão de segurança, otimização e responsividade final, deploy (Vercel + Railway), armazenamento de imagens, provedor de e-mail, relatórios da plataforma, ambiente de demonstração | Próxima |
