# 📊 Evolution Dashboard

Painel interativo com IA para análise profunda de mensagens do WhatsApp via Evolution API.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)

## ✨ Funcionalidades

### 📈 Dashboard Completo
- **Métricas em Tempo Real**: Total de mensagens, contatos ativos, tempo médio de resposta
- **Gráficos Interativos**: Visualização de mensagens por dia com Recharts
- **Análise de Sentimento**: Distribuição de sentimentos (positivo, negativo, neutro)
- **Top Contatos**: Ranking dos contatos mais ativos
- **Timeline de Mensagens**: Visualização cronológica das mensagens recentes
- **Filtros Avançados**: Por instância, data, tipo de mensagem

### 🤖 Chat Interativo com IA
- **Análise Inteligente**: Faça perguntas em linguagem natural sobre seus dados
- **Respostas Contextuais**: IA analisa o banco de dados em tempo real
- **Sugestões de Perguntas**: Templates prontos para análises comuns
- **Análise de Sentimento**: Detecta automaticamente o humor das mensagens
- **Insights Automáticos**: Recomendações baseadas nos padrões identificados

### 📊 Análises Disponíveis
- ⏰ **Horários de Pico**: Identifica quando há mais mensagens
- 😊 **Análise de Sentimento**: Mede satisfação dos clientes
- 📈 **Tendências**: Detecta padrões de crescimento/declínio
- 👥 **Análise de Contatos**: Rankings e estatísticas por contato
- 🔍 **Detecção de Padrões**: Identifica temas recorrentes nas mensagens

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+ instalado
- PostgreSQL com banco Evolution API configurado
- npm ou yarn

### Passo a Passo

1. **Navegue até a pasta do dashboard**
```bash
cd dashboard
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o arquivo .env**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/evolution"
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
```

4. **Gere o Prisma Client**
```bash
npx prisma generate
```

5. **Execute em modo desenvolvimento**
```bash
npm run dev
```

6. **Acesse o painel**
Abra seu navegador em: `http://localhost:3000`

## 📁 Estrutura do Projeto

```
dashboard/
├── app/                      # App directory do Next.js 14
│   ├── api/                  # API Routes
│   │   ├── stats/           # Estatísticas gerais
│   │   ├── messages/        # Busca de mensagens
│   │   ├── sentiment/       # Análise de sentimento
│   │   └── chat/            # Chat com IA
│   ├── globals.css          # Estilos globais
│   ├── layout.tsx           # Layout principal
│   └── page.tsx             # Página inicial
├── components/               # Componentes React
│   ├── Dashboard.tsx        # Dashboard principal
│   ├── ChatInterface.tsx    # Interface de chat
│   ├── StatsCards.tsx       # Cards de estatísticas
│   ├── MessageChart.tsx     # Gráfico de mensagens
│   ├── SentimentChart.tsx   # Gráfico de sentimentos
│   ├── TopContactsTable.tsx # Tabela de top contatos
│   └── MessageTimeline.tsx  # Timeline de mensagens
├── lib/                      # Bibliotecas e utilitários
│   └── prisma.ts            # Cliente Prisma
├── prisma/                   # Prisma ORM
│   └── schema.prisma        # Schema do banco
├── public/                   # Arquivos estáticos
├── .env.example             # Exemplo de variáveis de ambiente
├── next.config.js           # Configuração do Next.js
├── tailwind.config.ts       # Configuração do Tailwind
├── tsconfig.json            # Configuração do TypeScript
└── package.json             # Dependências do projeto
```

## 🎯 Como Usar

### Dashboard
1. **Acesse a aba "Dashboard"** no topo da página
2. **Aplique filtros** para refinar sua análise:
   - Selecione uma instância específica
   - Escolha um período de datas
3. **Visualize as métricas**:
   - Cards com estatísticas principais
   - Gráfico de mensagens por dia
   - Distribuição de sentimentos
   - Top contatos mais ativos
   - Timeline de mensagens recentes
4. **Exporte os dados** clicando no botão "Exportar"

### Chat IA
1. **Acesse a aba "Chat IA"** no topo da página
2. **Faça perguntas** sobre seus dados, como:
   - "Quais são os horários de pico de mensagens?"
   - "Mostre-me o sentimento geral das conversas"
   - "Quantas mensagens recebi hoje?"
   - "Quais são meus principais contatos?"
3. **Use as sugestões** no painel lateral para começar
4. **Receba análises detalhadas** em tempo real

### Exemplos de Perguntas

**Horários e Padrões:**
- "Qual o horário com mais mensagens?"
- "Em que dia da semana recebo mais mensagens?"
- "Mostre os padrões de conversação"

**Análise de Sentimento:**
- "Como está o sentimento geral dos clientes?"
- "Quantas mensagens negativas recebi?"
- "Qual a satisfação dos clientes este mês?"

**Estatísticas:**
- "Quantas mensagens tenho no total?"
- "Quantos contatos ativos tenho?"
- "Qual a média de mensagens por dia?"

## 🔌 API Endpoints

### GET /api/stats
Retorna estatísticas gerais.

**Query Parameters:**
- `instanceId` (opcional): Filtrar por instância
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)

**Resposta:**
```json
{
  "totalMessages": 45823,
  "totalContacts": 1253,
  "avgResponseTime": "2.5min",
  "activeConversations": 342,
  "totalChats": 856
}
```

### GET /api/messages
Retorna lista de mensagens.

**Query Parameters:**
- `instanceId` (opcional): Filtrar por instância
- `limit` (opcional, default: 100): Limite de mensagens
- `offset` (opcional, default: 0): Offset para paginação
- `startDate` (opcional): Data inicial
- `endDate` (opcional): Data final
- `fromMe` (opcional): Filtrar por mensagens enviadas/recebidas

### GET /api/sentiment
Analisa sentimento das mensagens.

**Query Parameters:**
- `instanceId` (opcional): Filtrar por instância
- `limit` (opcional, default: 1000): Limite de mensagens a analisar

**Resposta:**
```json
{
  "total": 4823,
  "avgScore": "0.45",
  "distribution": {
    "very_positive": 850,
    "positive": 1240,
    "neutral": 2130,
    "negative": 420,
    "very_negative": 183
  }
}
```

### POST /api/chat
Chat interativo com IA.

**Body:**
```json
{
  "message": "Quais são os horários de pico?",
  "instanceId": "uuid-opcional"
}
```

**Resposta:**
```json
{
  "response": "📊 Análise de Horários de Pico...",
  "timestamp": "2025-11-14T12:00:00Z"
}
```

## 🎨 Personalização

### Cores do Tema
Edite `tailwind.config.ts` para personalizar as cores:

```typescript
colors: {
  primary: {
    50: '#f0fdf4',
    500: '#22c55e',
    900: '#14532d',
  },
}
```

### Componentes
Todos os componentes estão em `components/` e podem ser personalizados individualmente.

### Gráficos
Os gráficos usam Recharts. Customize em:
- `components/MessageChart.tsx`
- `components/SentimentChart.tsx`

## 🔧 Tecnologias

- **[Next.js 14](https://nextjs.org/)** - Framework React com App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Tipagem estática
- **[Tailwind CSS](https://tailwindcss.com/)** - Framework CSS utilitário
- **[Prisma](https://www.prisma.io/)** - ORM para PostgreSQL
- **[Recharts](https://recharts.org/)** - Biblioteca de gráficos
- **[Lucide Icons](https://lucide.dev/)** - Ícones modernos
- **[date-fns](https://date-fns.org/)** - Manipulação de datas
- **[Sentiment](https://www.npmjs.com/package/sentiment)** - Análise de sentimento
- **[Natural](https://www.npmjs.com/package/natural)** - NLP em JavaScript

## 📝 Scripts Disponíveis

```bash
npm run dev        # Inicia em modo desenvolvimento
npm run build      # Cria build de produção
npm start          # Inicia em modo produção
npm run lint       # Executa linter
```

## 🚀 Deploy

### Vercel (Recomendado)
1. Faça push do código para o GitHub
2. Conecte seu repositório na [Vercel](https://vercel.com)
3. Configure as variáveis de ambiente
4. Deploy automático!

### Docker
```bash
docker build -t evolution-dashboard .
docker run -p 3000:3000 evolution-dashboard
```

### Manual
```bash
npm run build
npm start
```

## 🔒 Segurança

- ✅ Validação de entrada em todas as APIs
- ✅ Sanitização de dados do banco
- ✅ CORS configurado
- ✅ Rate limiting recomendado para produção
- ✅ Variáveis de ambiente para credenciais

## 🐛 Troubleshooting

### Erro de conexão com o banco
```bash
# Verifique se o PostgreSQL está rodando
sudo systemctl status postgresql

# Teste a conexão
psql -h localhost -U usuario -d evolution
```

### Erro ao gerar Prisma Client
```bash
# Limpe e regenere
rm -rf node_modules/.prisma
npx prisma generate
```

### Porta 3000 já está em uso
```bash
# Use outra porta
PORT=3001 npm run dev
```

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

## 📧 Suporte

Para dúvidas e suporte:
- Abra uma issue no GitHub
- Consulte a documentação do Evolution API

---

**Desenvolvido com ❤️ usando Next.js e TypeScript**
