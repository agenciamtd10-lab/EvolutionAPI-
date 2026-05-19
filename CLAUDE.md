# Evolution API — Briefing para Claude Code
> Manutenção, Bugfixes e Extensão do Projeto | v2.3.7 | Fevereiro 2026

---

## 1. Contexto e Objetivo

Este projeto é a **Evolution API** instalada nesta VM. O time original parou o desenvolvimento ativo em Dezembro de 2025 (última release: v2.3.7, 5 Dez 2025). O objetivo é manter a API funcionando, aplicar bugfixes críticos da comunidade e estender funcionalidades para N8N.

Esta API é o backbone de atendimento ao cliente da **DGGirl** (e-commerce de moda feminina, Nordeste do Brasil). Os workflows N8N processam mensagens de clientes, acionam agentes de IA com **Google Gemini** para responder sobre produtos, rastrear pedidos e processar pagamentos PIX. Qualquer downtime impacta diretamente o atendimento ao cliente em tempo real.

---

## 2. Stack Tecnológico

- **Runtime:** Node.js (CommonJS)
- **Linguagem:** TypeScript (strict)
- **Framework:** Express.js
- **ORM:** Prisma (PostgreSQL ou MySQL)
- **WhatsApp:** Baileys (`@whiskeysockets/baileys`)
- **Cache:** Redis + local cache
- **Storage:** S3 / MinIO
- **Message Queue:** RabbitMQ / SQS
- **Process Manager:** PM2 (`pm2 restart ApiEvolution`)
- **Build:** tsup + tsc
- **Lint:** ESLint
- **Commits:** Commitizen (`npm run commit`)

---

## 3. Arquitetura do Código

### 3.1 Estrutura de Diretórios

```
evolution-api/
├── src/
│   ├── main.ts                       # Entry point — inicializa Express na porta 8080
│   ├── api/
│   │   ├── server.module.ts          # DI container — instancia todos os serviços
│   │   ├── routes/index.router.ts    # 14 routers organizados por domínio
│   │   ├── guards/
│   │   │   ├── auth.guard.ts         # Valida API key global + token por instância
│   │   │   └── instance.guard.ts     # Verifica se instância existe e conectada
│   │   ├── controllers/              # Thin layer HTTP — recebe req, chama service
│   │   ├── services/
│   │   │   ├── monitor.service.ts    # WAMonitoringService — mapa waInstances
│   │   │   └── channel.service.ts    # ChannelStartupService — classe base abstrata
│   │   ├── dto/                      # Data Transfer Objects (class-validator)
│   │   ├── integrations/
│   │   │   ├── channel/whatsapp/
│   │   │   │   └── whatsapp.baileys.service.ts  # ★ ARQUIVO MAIS CRÍTICO
│   │   │   ├── chatbot/              # OpenAI, Dify, Typebot, Chatwoot
│   │   │   ├── event/event.manager.ts # Distribui eventos: Webhook/RabbitMQ/SQS/WS
│   │   │   └── storage/              # S3, MinIO
│   │   └── repository/              # Prisma ORM — data access layer
│   ├── config/                       # Configuração via .env
│   ├── cache/                        # Redis + local cache
│   └── exceptions/                   # Classes de exceção HTTP
├── prisma/
│   ├── postgresql-schema.prisma
│   └── mysql-schema.prisma
├── CLAUDE.md                         # ★ Este arquivo
├── package.json
└── tsconfig.json
```

### 3.2 Fluxo — Mensagem Recebida

```
WhatsApp (protocolo WebSocket)
  ↓  Baileys Library
  ↓  BaileysStartupService (whatsapp.baileys.service.ts)
  ↓  BaileysMessageProcessor (retry logic + deduplicação)
  ↓  EventManager (event.manager.ts)
  ↓  ↓  ↓  ↓
Webhook  WebSocket  RabbitMQ  SQS
  ↓
N8N (processa, chama IA, responde)
```

### 3.3 Fluxo — Envio de Mensagem via N8N

```
N8N (trigger workflow)
  ↓  HTTP POST → Evolution API :8080
  ↓  authGuard → instanceExistsGuard → instanceLoggedGuard
  ↓  Controller (roteia) → Service (lógica)
  ↓  BaileysStartupService.sendMessage()
  ↓  WhatsApp (entrega ao destinatário)
```

---

## 4. Bugs Conhecidos e PRs Pendentes

### 4.1 Bug CRÍTICO — Loop Infinito de QR Code (PR #2365)

**Arquivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts`
**Método:** `connectionUpdate()` — aproximadamente linhas 421-440

**Fix — adicionar ANTES da lógica de reconexão existente:**
```typescript
const isInitialConnection = !this.instance.wuid && this.instance.qrcode.count === 0;
if (isInitialConnection) {
  this.logger.info('Initial connection closed, waiting for QR code generation...');
  return; // Impede o loop infinito
}
// ... lógica de reconexão existente para instâncias autenticadas continua abaixo
```

### 4.2 Bug CRÍTICO — LID (Linked Identity Device)

**Sintoma no log:**
```
{ remoteJid: '28952559136882@lid', remoteJidAlt: '5519989881838@s.whatsapp.net' }
ERROR: { jid: '28952559136882@s.whatsapp.net', exists: false }
```

**Estratégia de fix:** Sempre que encontrar `@lid`, usar `remoteJidAlt` (`@s.whatsapp.net`) para operações de envio e verificação de número.

**Arquivos a inspecionar:**
- `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts`
- `src/api/services/channel.service.ts`
- `src/api/integrations/chatbot/` — todos os services de chatbot

### 4.3 Bug MÉDIO — Multi-Device: Desconexão com Android Ativo (PR #2332)

Investigar desconexões quando dispositivo Android está ativo simultaneamente.

### 4.4 Bug MÉDIO — findContacts (PR #2120)

Aplicar se a busca de contatos não estiver funcionando.

---

## 5. Comandos Essenciais

```bash
# Rebuild da imagem Docker a partir do código-fonte local (obrigatório após qualquer mudança no src/)
docker compose build api && docker compose up -d api

# Desenvolvimento (hot reload)
npm run dev:server

# Build TypeScript (tsc --noEmit tem erro pré-existente em terminateCall — usar tsup direto)
./node_modules/.bin/tsup

# Iniciar produção
npm run start:prod

# Lint + fix automático
npm run lint

# Verificar lint sem alterar
npm run lint:check

# Commit semântico interativo
npm run commit

# Após alterar schema Prisma
npx prisma migrate dev
npx prisma generate

# Verificar status do serviço
pm2 status
pm2 logs ApiEvolution --err --lines 100

# Reiniciar em produção
pm2 restart ApiEvolution
```

---

## 6. Workflow para Aplicar um Bugfix

1. Identificar o arquivo exato pelo mapa da Seção 3
2. Criar branch: `git checkout -b fix/nome-do-bug`
3. Aplicar o fix — **mínimo de alterações necessárias**
4. Build: `npm run build`
5. Lint: `npm run lint`
6. Commit: `npm run commit` (escolha `fix:` ou `feat:`)
7. Reiniciar: `pm2 restart ApiEvolution`

---

## 7. Integração com N8N

### 7.1 Endpoints Mais Usados

- `POST /message/sendText/{instanceName}` — Enviar texto
- `POST /message/sendMedia/{instanceName}` — Enviar mídia
- `POST /message/sendButtons/{instanceName}` — Enviar botões
- `GET /instance/connectionState/{instanceName}` — Status da conexão
- `GET /chat/findContacts/{instanceName}` — Buscar contatos

### 7.2 Configuração do Webhook para N8N

```http
POST http://localhost:8080/webhook/set/{instanceName}
Headers: { apikey: SUA_API_KEY }
```

```json
{
  "enabled": true,
  "url": "https://seu-n8n.dominio.com/webhook/evolution",
  "webhookByEvents": false,
  "webhookBase64": false,
  "events": [
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "CONNECTION_UPDATE",
    "SEND_MESSAGE"
  ]
}
```

### 7.3 Padrão para Novo Endpoint

```typescript
// 1. DTO em: src/api/dto/meu-recurso.dto.ts
export class MeuRecursoDto {
  instanceName: string;
  parametro: string;
}

// 2. Service em: src/api/services/meu-recurso.service.ts
// Nunca coloque lógica no Controller
export class MeuRecursoService {
  constructor(private readonly prismaRepository: PrismaRepository) {}
  async meuMetodo(instance: string, data: MeuRecursoDto) {
    // lógica aqui — use this.logger, nunca console.log
  }
}

// 3. Controller em: src/api/controllers/meu-recurso.controller.ts
// Thin layer — só roteia e trata exceções

// 4. Registrar em: src/api/routes/index.router.ts
```

---

## 8. Regras de Desenvolvimento

### Fazer
- Seguir o padrão **Controller → Service → Repository** sem exceções
- Usar `this.logger` — nunca `console.log` em código de produção
- Manter tipagem TypeScript estrita — evitar `any`
- Commits via `npm run commit` (commitizen)
- Após alterar schema Prisma: `npx prisma migrate dev && npx prisma generate`
- Sempre `npm run build` antes de aplicar em produção
- **Mínimo de alterações necessárias** — não refatorar o que não está quebrando

### Não Fazer
- Não alterar o `.env` diretamente — documentar as variáveis necessárias
- Não colocar lógica de negócio nos controllers
- Não quebrar compatibilidade de API — os contratos existentes são usados pelo N8N
- Não atualizar Baileys sem verificar breaking changes no CHANGELOG da lib
- Não remover campos de DTOs existentes — apenas adicionar novos
- Não desabilitar o `authGuard` — toda rota precisa de autenticação
- Não usar `console.log` — usar `this.logger` do projeto

---

## 9. Checklist de Manutenção Prioritária

### Verificação Inicial
- [ ] `pm2 status` — checar se o serviço está rodando
- [ ] `pm2 logs ApiEvolution --err --lines 100` — ver erros recentes
- [ ] `cat package.json | grep baileys` — checar versão do Baileys
- [ ] Verificar se há erros `@lid` nos logs

### Bugs para Aplicar (Por Prioridade)
- [ ] **[CRÍTICO]** Fix loop infinito QR Code — PR #2365
- [ ] **[CRÍTICO]** Fix LID — garantir uso de `remoteJidAlt` para envio
- [ ] **[MÉDIO]** Fix Multi-Device — PR #2332 se houver desconexões
- [ ] **[MÉDIO]** Fix findContacts — PR #2120 se busca não funciona
- [ ] **[BAIXO]** Atualizar Baileys para versão estável mais recente

---

## 10. Como Atualizar o Baileys

```bash
# Ver versão atual
cat package.json | grep baileys

# Atualizar para versão mais recente
npm install @whiskeysockets/baileys@latest

# OU usar o fork da EvolutionAPI (patches específicos)
npm install github:EvolutionAPI/Baileys

# Após atualizar — verificar breaking changes no build
npm run build
# Corrigir erros TypeScript antes de testar em produção
```

---

*Evolution API Briefing — Jean Lima / DGGirl — Fevereiro 2026*
