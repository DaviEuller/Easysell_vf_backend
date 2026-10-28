# CLAUDE.md — EasySell backend

Projeto NestJS (TypeScript) que implementa a API backend da EasySell. O frontend
consume estas rotas via JWT. Trabalha sobre MongoDB (Mongoose) e usa
[@nestjs/observe](https://observe.nestjs.com) para observabilidade.

## Estado atual

- Branch `main`, working tree com modificações não committedes.
- Novo módulo `src/easybot/` implementado (controller, service, DTOs, entidades).
- `src/ai/ai.service.ts` ampliado: ferramenta `list_employees`, ação
  `create_employee` (pendente de confirmação), método `replyForWhatsApp` e
  refatoração do `requestModel` para aceitar `systemPrompt`/`tools` customizados.
- `src/app.module.ts` registra `EasyBotModule`; `src/ai/ai.module.ts` importa
  `Employee` e exporta `AiService`.
- `package.json` ganha `qrcode` + `whatsapp-web.js` e `@types/qrcode`.
- `.env.example` ganha `WHATSAPP_SESSION_PATH` e `PUPPETEER_EXECUTABLE_PATH`.
- `agent.json` atualizado: nome "Sell IA", modelo `Gemma 4 31B (free)`,
  `systemPrompt` ampliado, ferramentas `list_employees`/`create_employee` e
  `create_employee` incluída em `WRITE_ACTIONS`.

### O que está faltando / não concluído

1. **CLAUDE.md** — este arquivo não existia. Criado com o contexto do projeto.
2. **`.prettierrc` usa aspas simples e trailing comma `all`** (já configurado em
   `.prettierrc`, mas ainda não aplicado com `npm run format`). Rode
   `npm run format` antes de commitar para seguir o estilo do repositório.
3. **`ObserveModule` não está registrado** em `AppModule`. O código importa
   `createObserveModule` de `@nestjs/observe` e expõe `ObserveModule` /
   `ObserveInstrument`, e `main.ts` passa `instrument: ObserveInstrument`. O
   README orienta a colar chave/segredo do Observe no `forRoot()`, mas o módulo
   não é importado em `AppModule.imports` — logo observabilidade está ativa só
   se `@nestjs/observe` auto-registrar. Precisa confirmar: importar
   `ObserveModule` em `AppModule` (com `APP_OBSERVE_KEY`/`APP_OBSERVE_SECRET`
   via env) ou explicitamente não usar.
4. **Testes unitários falham por ambiente** (não por regressão):
   - `test/app.e2e-spec.ts` importa `supertest/types` (`App`) e espera
     `GET /` retornar `"Hello World!"` — mas o backend não tem controller raiz
     nem rota `GET /` retornando texto. O e2e precisa de um MongoDB real ou de
   mock de providers; o erro de importação do tipo do `supertest` também vale
   conferir (instalado, mas falta export).
   - `src/auth/...` e `src/users/...` specs e `_controller_`/`_service_` specs
     falham com "Nest can't resolve dependencies" — providers de modelo Mongoose
     não são fornecidos no módulo de teste. Precisa de `useValue`/`useClass`
     mocks para `UserModel`, `ProdutoModel`, `ClienteModel`.
   - `src/ai/ai.service.spec.ts`: 1 teste falha porque `agent.json` agora usa
     modelo `"Gemma 4 31B (free)"`, mas o teste ainda hardcodeia
     `"openai/gpt-oss-120b"`. Teste precisa ler o default de `agent.json`.
   - 4 testes de controller/service falham no `main` (sem MongoDB) — são
     pré-existentes (também falham no `main` committed).
5. **`src/Easysell/opencollection.yml`** — diretório/objeto coleção Bruno
   (OpenAPI-like) deixado no `src/`; não está ligado ao build. Considerar
   mover para raiz ou `.claude/`.
6. **`git` (arquivo vazio)** na raiz — artefato acidental, remover.
7. **CI** — não há workflow. Adicionar `.github/workflows/ci.yml` (install,
   lint `oxlint --type-aware`, build `nest build`, `npm run test`).

## Stack & scripts

- Node 24 (`@types/node: ^24`), TypeScript `nodenext`, Nest 12.
- Build: `npm run build` (`nest build`), assets copiados: `src/ai/agent.json` →
  `dist/ai/agent.json` (via `nest-cli.json` assets).
- Dev: `npm run start:dev`.
- Testes: `npm test` (unit, Vitest), `npm run test:e2e`, `npm run test:cov`.
- Lint/format: `npm run lint` (oxlint --type-aware), `npm run format` (prettier).

## Arquitetura de módulos

```
AppModule
├── ConfigModule (global)
├── AuthModule      (JWT login, passport-jwt, JwtAuthGuard)
├── UsersModule     (CRUD usuário/equipe)
├── MongooseModule  (forRootAsync via MONGODB_URI)
├── ProdutosModule  (CRUD produto)
├── ClientesModule  (CRUD cliente/venda)
├── CompanyModule   (empresa + funcionário)
├── EquipeModule    (tarefas)
├── AiModule        (Sell IA — chat, conversas, ações)
├── FaturasModule   (parcelamento, faturas, WhatsApp de cobrança)
└── EasyBotModule   (WhatsApp Web via whatsapp-web.js)
```

Convenção: cada módulo em `src/<modulo>/` com `.controller.ts`, `.service.ts`,
`.module.ts`, `dto/`, `entities|schemas/`. Controllers usam
`@UseGuards(JwtAuthGuard)` e resolvem a empresa via `request.user.companyId`.

## Auth

- `AuthController`: `POST /auth/login` (devolve `{ accessToken, ... }`).
- `JwtStrategy`: payload `{ sub, email, role, empresaId }`; `validate` devolve
  `{ userId, email, role, companyId, empresaid }`.
- `JwtAuthGuard`: `AuthGuard('jwt')`; injeta `req.user` como
  `{ userId, companyId?, empresaid? }`.
- Segurança: `passwordHash` nunca serializado (`select: false`).

## Env vars (.env.example)

| Var | Uso |
|-----|-----|
| `MONGODB_URI` | Conexão Mongo (Atlas replica set recomendado para transações). |
| `JWT_SECRET` | Segredo do JWT (longo e aleatório). |
| `AI_API_BASE_URL` | Base URL do provedor OpenAI-compatible (padrão Groq). |
| `GROQ_API_KEY` | Chave do provedor (padrão no agent.json). |
| `AI_MODEL` | Override do modelo (padrão `Gemma 4 31B (free)` em agent.json). |
| `WHATSAPP_SESSION_PATH` | Pasta de sessão LocalAuth do WhatsApp (persistir em volume). |
| `PUPPETEER_EXECUTABLE_PATH` | Chrome/Chromium para o whatsapp-web.js. |
| `OBSERVE_KEY` / `OBSERVE_SECRET` | (quando habilitado) credenciais do @nestjs/observe. |

## Rotas da API

### Auth
- `POST /auth/login` → `{ accessToken }`

### Produtos (`User` role livre)
- `GET /produtos`, `GET /produtos/:id`, `POST /produtos`,
  `PATCH /produtos/:id`, `DELETE /produtos/:id`
- Escopo: filtra/cria por `companyId` do usuário autenticado.

### Clientes / vendas
- `GET /clientes`, `POST /clientes`, `PATCH /clientes/:id`,
  `DELETE /clientes/:id`
- Venda com parcelamento: `parcelas`, `valorPago`,
  `dataPrimeiroVencimento` (ISO). `saldoPendente` calculado no backend.

### Empresa / funcionários
- CRUD empresa e funcionário; CPF único por empresa via `Employee` schema.

### Equipe
- `GET /equipe`, `POST /equipe`, `PATCH /equipe/:id`, `DELETE /equipe/:id`
  (tarefas).

### Sell IA (`GET /ai/*`, JWT)
- `GET /ai/conversations` — lista (`_id, title, updatedAt, lastMessage,
  pendingAction`).
- `GET /ai/conversations/:id` — detalhe (mensagens sem role tool).
- `POST /ai/chat` — body `{ message, conversationId? }`.
- `POST /ai/conversations/:id/actions/:actionId/confirm|reject`.
- Regras: leitura sem confirmação (produtos, vendas, funcionários); escrita
  (`create_product`, `create_employee`, `create_sale`, `update_product`,
  `set_product_stock`, `update_customer`, `update_sale`) pende de confirmação
  de administrador. `create_product` executa imediatamente.
- Transações Mongo (`create_sale`, `update_sale`) exigem replica set.

### Faturas (`GET|POST|PATCH /faturas*`, JWT)
- `GET /faturas`, `GET /faturas/vendas-disponiveis`, `POST /faturas`
  (`{ saleId, dueDate? }`).
- `PATCH /faturas/:id/status` (`{ status, installmentNumber? }`).
- `GET /faturas/:id/whatsapp` — telefone, mensagem e link `wa.me` para cobrança
  do saldo restante (não envia automaticamente). Uma venda → uma fatura.

### EasyBot (WhatsApp) (`GET|POST|PATCH|DELETE /easybot/*`, JWT, admin)
- `GET /easybot/status`, `POST /easybot/connect`, `POST /easybot/disconnect`.
- `GET|POST /easybot/contacts`, `PATCH|DELETE /easybot/contacts/:contactId`.
- `GET /easybot/contacts/:contactId/messages`.
- `POST /easybot/messages` — envio para contato cadastrado.
- Sessão salva localmente (`LocalAuth`), uma instância por pasta de sessão.
- Mensagens recebidas respondem automaticamente (contatos com
  `autoReplyEnabled`) usando `AiService.replyForWhatsApp` (read-only tools).
- Respostas automáticas: filtra contatos com `autoReplyEnabled: true`,
  histórico de 20 mensagens, limite de 4096 chars/round, envia como contato
  do administrador da empresa.

## Schema / entidades relevantes

- `EasyBotAccount`: `{ companyId (único), status, phoneNumber?, lastError?,
  connectedAt? }`.
- `EasyBotContact`: `{ companyId, name, phone (único por empresa),
  autoReplyEnabled (default true) }`. Índice `{ companyId, phone }` único.
- `EasyBotMessage`: `{ companyId, contactId, phone, direction
  (incoming|outgoing), content, status (received|sending|sent|failed),
  error? }`. Índice `{ companyId, contactId, createdAt: -1 }`.
- `AiConversation`: `{ userId, companyId, title, messages[], pendingAction?,
  createdAt, updatedAt }`. Mensagens: role `user|assistant|tool`,
  `tool_calls`, `tool_call_id`, `name`, `timestamp`.

## Pendências abertas

- [ ] Registrar `ObserveModule.forRootAsync` em `AppModule` (ou remover a
  importação não usada).
- [ ] `src/ai/ai.service.spec.ts`: o assert de modelo deve ler
  `openai/gpt-oss-120b` de `agent.json` em vez de hardcode.
- [ ] Fixtures de provider (`UserModel`, `ProdutoModel`, `ClienteModel`) nos
  specs de controller/service para resolver "Nest can't resolve dependencies".
- [ ] Revisar `test/app.e2e-spec.ts` (rota `/` não existe) e o import de
  `supertest/types`.
- [ ] Remover `git` (arquivo vazio) e rehomear
  `src/Easysell/opencollection.yml`.
- [ ] CI em `.github/workflows`.

## Observação sobre o modelo

O `.env` local aponta `AI_API_BASE_URL=http://127.0.0.1:31415/v1` (um proxy
local). Em dev, garantir que esse serviço esteja ativo ou sobrescrever para
Groq. Nunca commitar chaves reais em `.env` (já está no `.gitignore`).
