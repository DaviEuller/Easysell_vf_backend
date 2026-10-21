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

## Sellia (IA)

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

## Vendas parceladas e faturas

Ao criar uma venda em `POST /clientes`, podem ser informados `parcelas`,
`valorPago` e `dataPrimeiroVencimento` (data ISO). O backend calcula
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
  "dataPrimeiroVencimento": "2026-11-21"
}
```

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
