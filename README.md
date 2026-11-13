<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Sell IA

Copie `.env.example` para `.env` e configure `AI_API_BASE_URL` e a variável
de chave indicada por `apiKeyEnv` no `agent.json` (atualmente `GROQ_API_KEY`)
e, opcionalmente, `AI_MODEL`. A chave fica somente no ambiente do backend. As
instruções do agente, o modelo padrão, os limites e as ferramentas ficam em
`src/ai/agent.json`, que também é copiado para `dist/ai` durante o build.
O endpoint é compatível com a API de Chat Completions da OpenAI e com provedores
que aceitam o mesmo formato e chamadas de ferramentas. O modelo padrão Groq é
`openai/gpt-oss-120b`; se `AI_MODEL` estiver definido no ambiente, ele substitui
esse padrão. O modelo Llama 3.3 anterior foi desativado pela Groq em 16/08/2026.

O recurso NestJS `ai` protege as rotas com JWT, restringe conversas e consultas
à empresa do usuário autenticado e armazena o histórico no MongoDB existente.
Ferramentas de leitura consultam produtos e vendas. Criação e edição de produtos,
estoque, dados de cliente e vendas sempre ficam pendentes até uma confirmação
explícita no frontend. A criação e a edição de vendas usam transações MongoDB;
para essas ações, o MongoDB precisa operar com replica set (como no Atlas).

Rotas: `GET /ai/conversations`, `GET /ai/conversations/:id`,
`POST /ai/chat` e `POST /ai/conversations/:id/actions/:actionId/confirm|reject`.

## EasyBot (WhatsApp)

O EasyBot conecta uma sessão WhatsApp Web por empresa usando
[`whatsapp-web.js`](https://github.com/pedroslopez/whatsapp-web.js). Um
administrador conecta o número lendo o QR Code na aba EasyBot do frontend.
Os contatos e mensagens ficam no MongoDB e são sempre limitados à empresa do
usuário autenticado. A sessão WhatsApp é salva localmente pela estratégia
`LocalAuth`; configure `WHATSAPP_SESSION_PATH` para um volume persistente no
servidor. Execute apenas uma instância do backend por pasta de sessão.

O EasyBot registra mensagens recebidas de contatos cadastrados e responde
automaticamente aos contatos com resposta automática ativada. Essas respostas
usam a Sell IA para consultar produtos e vendas, sem ferramentas de escrita.
No chat `/ai/chat`, a Sell IA também pode preparar mensagens para contatos do
WhatsApp cadastrados; um administrador precisa confirmar a ação pendente antes
do envio, e a sessão WhatsApp da empresa deve estar conectada. Configure
`GROQ_API_KEY` como no recurso Sell IA. O Chrome/Chromium precisa
estar instalado no servidor; instale o Chrome gerenciado pelo Puppeteer com
`npx puppeteer browsers install chrome` ou configure
`PUPPETEER_EXECUTABLE_PATH` com o caminho de um navegador instalado.

Rotas protegidas por JWT: `GET /easybot/status`, `POST /easybot/connect`,
`POST /easybot/disconnect`, `GET|POST /easybot/contacts`,
`PATCH|DELETE /easybot/contacts/:contactId`,
`GET /easybot/contacts/:contactId/messages` e `POST /easybot/messages`.
O envio exige uma conexão ativa e um contato cadastrado.

## Mercado Livre — compras

A integração conecta uma conta compradora por OAuth. Configure
`MERCADOLIVRE_CLIENT_ID`, `MERCADOLIVRE_CLIENT_SECRET`,
`MERCADOLIVRE_REDIRECT_URI` (a mesma URL cadastrada na aplicação do Mercado
Livre, terminando em `/mercadolivre/oauth/callback`) e
`MERCADOLIVRE_TOKEN_ENCRYPTION_KEY` (chave Base64 de 32 bytes). Gere a chave
com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
Tokens OAuth são criptografados antes de serem salvos no MongoDB. Configure
essas variáveis somente no ambiente do servidor; nunca use `.env.example` para
guardar credenciais reais.

Um administrador usa `POST /mercadolivre/connect` e abre a `authorizationUrl`
retornada para autorizar a conta. Pedidos de compra e documentos fiscais
disponíveis são sincronizados imediatamente após a conexão e a cada 15 minutos.
Também é possível iniciar a sincronização com `POST /mercadolivre/sync`.
Compras ficam separadas das faturas a receber em
`GET /mercadolivre/purchases`; o estado de documento fiscal pode ser
`available`, `not_available` ou `unavailable` (quando o Mercado Livre não
permite a consulta). O arquivo fiscal, quando disponível, pode ser baixado em
`GET /mercadolivre/purchases/:purchaseId/fiscal-documents/:documentId`.
`GET /mercadolivre/status` mostra a conexão e o resultado da última
sincronização; `DELETE /mercadolivre/connect` revoga localmente a conexão e
remove os tokens guardados.

Para publicar produtos, a conta autorizada também precisa ter permissão de
vendedor. Produtos EasySell aceitam `mercadoLivreListing` com `categoryId`,
`condition`, `listingTypeId`, URLs públicas em `pictures`, `shippingMode`,
`freeShipping`, `localPickup` e, quando a categoria solicitar, `attributes`.
Quando esses dados estiverem completos, o cadastro/edição do produto inicia a
publicação automática; produtos configurados antes de conectar a conta ficam
pendentes e são tentados novamente durante a sincronização periódica.
Alternativamente, `POST /mercadolivre/products/:productId/publish` grava os
dados de anúncio e publica um produto existente. Use
`GET /mercadolivre/categories/:categoryId/attributes` para consultar os
atributos exigidos para uma categoria. O ID do anúncio, permalink e erro de
publicação ficam em `mercadoLivreListing` no produto. Atualizações de preço e
estoque em `PATCH /produtos/:id` são propagadas para um anúncio já publicado.

A Sell IA também pode propor o cadastro de um produto com anúncio no Mercado
Livre. Informe nome, categoria EasySell, preço, estoque, categoria/condição/tipo
de anúncio, URLs HTTPS das imagens, frete e atributos necessários. A ação exige
confirmação explícita de um administrador; sem conta conectada, o produto é
cadastrado e a publicação permanece pendente para nova tentativa.

## Importação de vendas por nota fiscal

`POST /invoice-imports` recebe um único arquivo multipart no campo `file`
(NF-e XML, PDF ou foto PNG/JPG/WEBP, até 10 MB). O XML NF-e é lido diretamente;
PDFs e imagens usam OCR Tesseract local em português. Na primeira utilização,
o Tesseract pode baixar os dados de idioma português no servidor. PDFs com
camada de texto inválida ou insuficiente também passam pelo OCR. O arquivo
original não é armazenado, mas os campos extraídos e o texto OCR ficam salvos
para conferência.

Cada envio cria uma importação `pending_review`, sem registrar venda nem alterar
estoque. Consulte `GET /invoice-imports?status=pending_review` e use
`POST /invoice-imports/:invoiceId/assist` para solicitar a análise da Sell IA.
Ela extrai linhas candidatas dos PDFs/imagens, sugere correspondências do
catálogo da empresa e valores legíveis; uma pergunta opcional no corpo permite
tirar dúvidas sobre a nota. O endpoint não registra vendas.

A IA recebe somente linhas candidatas de itens e dados do catálogo da empresa,
nunca o OCR completo nem os dados cadastrais do cliente. As sugestões, com
confiança e possíveis dúvidas, são editáveis e devem ser conferidas por uma
pessoa. Itens e preços não identificados podem ser preenchidos manualmente.
Para preparar uma revisão sem nota, use `POST /invoice-imports/manual` com o
cliente e os itens escolhidos no catálogo da própria empresa. Esse endpoint cria
uma revisão pendente, sem registrar venda nem alterar estoque:

```json
{
  "customerName": "João da Silva",
  "customerPhone": "+5511999999999",
  "items": [
    {
      "productId": "665f1a2b3c4d5e6f7a8b9c0d",
      "quantity": 2,
      "unitPrice": 79.9
    }
  ]
}
```

Confirme com
`POST /invoice-imports/:invoiceId/confirm` e um corpo como:

```json
{
  "confirmAsSale": true,
  "customerName": "João da Silva",
  "customerPhone": "+5511999999999",
  "items": [
    {
      "productId": "665f1a2b3c4d5e6f7a8b9c0d",
      "quantity": 2,
      "unitPrice": 79.9
    }
  ]
}
```

O nome pode vir da NF-e; informe-o se estiver ausente. O telefone é opcional
para vendas importadas. A confirmação cria uma venda EasySell por item, baixa o
estoque e marca a importação como `imported` dentro de uma transação MongoDB.
O campo `confirmAsSale: true` confirma que a nota representa uma saída/venda;
NF-e XML identificada como entrada é recusada automaticamente.
NF-e com chave de acesso repetida na mesma empresa não pode ser importada de
novo. Uma importação pendente pode ser recusada em
`POST /invoice-imports/:invoiceId/reject`. Notas em PDF/imagem não têm as linhas
de produto confirmadas automaticamente: revise as sugestões, corrija os valores
ou preencha os itens manualmente antes de confirmar.

## Vendas parceladas e faturas

Ao criar uma venda em `POST /clientes`, podem ser informados `parcelas`,
`valorPago`, `dataPrimeiroVencimento` (data ISO), `funcionarioId` e `status`
(`Concluída`, `Pendente` ou `Cancelada`). O funcionário e o status são
persistidos e retornados junto com a venda; vendas sem status começam como
`Pendente`. O backend calcula
`saldoPendente`; o pagamento inicial deve estar entre zero e o valor total da
venda. Vendas existentes sem esses campos são interpretadas como uma parcela e
nenhum valor pago inicialmente.

Exemplo de venda com entrada e saldo parcelado:

```json
{
  "name": "Maria Silva",
  "Numero": "11999999999",
  "IdProduto": "ID_DO_PRODUTO",
  "idcompany": "ID_DA_EMPRESA",
  "Preco_gasto": 300,
  "Quantidade": 2,
  "parcelas": 3,
  "valorPago": 60,
  "funcionarioId": "ID_DO_FUNCIONARIO",
  "status": "Concluída",
  "dataPrimeiroVencimento": "2026-11-21"
}
```

No cadastro, crie a conta com `POST /user` e o papel desejado; em seguida,
`POST /company/bootstrap/:userId` cria a empresa e associa o usuário como
administrador. O corpo do bootstrap contém `name`, `categoria`, `cnpj` e
`cpfResponsavel`. A equipe pode ser gerenciada em `POST /company/employees`,
`PATCH /company/employees/:id` e `DELETE /company/employees/:id`; o status do
funcionário aceita `Ativo` ou `Férias` e, por padrão, inicia como `Ativo`.

Para gerar uma fatura, use `POST /faturas` com `saleId`; pode enviar
`dueDate` para substituir a data de primeiro vencimento salva na venda. Se a
venda tiver saldo pendente, o backend divide o saldo em parcelas mensais,
distribuindo diferenças de centavos, e cria uma única fatura com a lista de
parcelas. O vencimento seguinte é calculado a partir do primeiro.

As rotas exigem JWT e usam a empresa do usuário autenticado:
`GET /faturas`, `GET /faturas/vendas-disponiveis`, `POST /faturas`,
`PATCH /faturas/:id/status` e `GET /faturas/:id/whatsapp`. Atualize uma parcela
individual enviando `installmentNumber` junto com `status` (`pendente` ou
`paga`) para `PATCH /faturas/:id/status`. Para cobrar o saldo restante, a rota
de WhatsApp retorna telefone, mensagem e link `wa.me`; ela não envia a mensagem
automaticamente. Uma venda só pode ter uma fatura.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
"# Easysell_vf_backend"

https://easy-sell-vf.vercel.app/ VICTOR-silva300
ThalesRangon

https://github.com/DaviEuller/Easysell_vf_backend

JWT_SECRET = "YUEWEWHIGWEIUGFEWhbduwguegcywgcyuFUDCWUEGCUYGygUGYQUFYGCEWUGFVCWQYHIQUHguygdvcuewgcwgcugw3879y48u2iej"
MONGODB_URI="mongodb+srv://davieuller01_db_user:hWXVhvPcM3mCUETD@easysell.4ryznpa.mongodb.net/Easysell"
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# EasySell — Backend (API REST)

API REST do sistema **EasySell**, desenvolvida em **NestJS**, responsável por gerenciar produtos, estoque, vendas, financeiro, equipe, assistente de IA (Sell IA) e integração com WhatsApp (EasyBot).

Esta API é consumida tanto pelo aplicativo mobile (Flutter) quanto pelo frontend web (React).

---

## Tecnologias

- **NestJS 12** + Node.js + TypeScript
- **MongoDB** (Atlas) com Mongoose
- **JWT** + Passport + bcrypt
- **Swagger** (documentação da API)
- **Vitest** + Supertest (testes)
- Integrações:
  - Groq (Chat Completions) — Sell IA
  - EmailJS — recuperação de senha
  - whatsapp-web.js — EasyBot

---

## Funcionalidades principais

- Autenticação (login, cadastro e recuperação de senha)
- Gestão de empresa, produtos e estoque
- Registro de vendas e clientes (incluindo vendas parceladas)
- Controle de faturas e parcelas
- Gestão de equipe e tarefas
- Assistente de IA (Sell IA) com ferramentas de leitura e escrita (com confirmação)
- EasyBot (WhatsApp) com resposta automática
- Isolamento de dados por empresa
- Controle de perfis (administrador, atendente e funcionário)

---

## Pré-requisitos

- Node.js 24+
- npm
- Conta no MongoDB Atlas (ou MongoDB com replica set)
- (Opcional) Chave de API do Groq, conta no EmailJS e Chrome/Chromium (para o EasyBot)

---

## Instalação e execução

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd Easysell_vf_backend

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com seus valores

# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod

A API sobe em: http://localhost:3000

Documentação Swagger: http://localhost:3000/api

Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| MONGODB_URI | String de conexão com o MongoDB |
| JWT_SECRET | Segredo para assinar os tokens JWT |
| AI_API_BASE_URL | URL base do provedor de IA |
| GROQ_API_KEY | Chave da API do Groq |
| AI_MODEL | Modelo de IA utilizado |
| EMAILJS_PUBLIC_KEY | Chave pública do EmailJS |
| EMAILJS_PRIVATE_KEY | Chave privada do EmailJS |
| EMAILJS_SERVICE_ID | ID do serviço EmailJS |
| EMAILJS_TEMPLATE_ID | ID do template de e-mail |
| WHATSAPP_SESSION_PATH | Caminho da sessão do WhatsApp |
| PUPPETEER_EXECUTABLE_PATH | Caminho do Chrome/Chromium |
| PORT | Porta do servidor (padrão: 3000) |



Segurança
Senhas armazenadas com bcrypt
Autenticação via JWT (validade de 1 dia)
Isolamento de dados por empresa (companyId do token)
Ações de escrita da IA exigem confirmação do administrador
Credenciais e segredos apenas em variáveis de ambiente
```
