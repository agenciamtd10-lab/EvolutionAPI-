# Evolution API MCP Server

**MCP Server** (Model Context Protocol) para análise de mensagens e dados do Evolution API através do PostgreSQL.

Este servidor permite que o Claude (e outros clientes MCP) consultem e analisem mensagens do WhatsApp armazenadas no banco de dados do Evolution API de forma segura e eficiente.

## 🚀 Funcionalidades

### Ferramentas Disponíveis

1. **`list_instances`** - Lista todas as instâncias WhatsApp cadastradas
   - Filtra por status de conexão (open, close, connecting)
   - Retorna informações básicas de cada instância

2. **`get_messages`** - Busca mensagens com filtros avançados
   - Filtra por instância, período, contato, tipo de mensagem
   - Suporta paginação e ordenação
   - Inclui informações de mídia associada

3. **`search_messages`** - Busca mensagens por conteúdo de texto
   - Pesquisa em mensagens de texto, legendas de mídia
   - Suporta busca case-sensitive ou case-insensitive
   - Filtra por instância e contato

4. **`get_conversation`** - Obtém conversa completa entre contatos
   - Retorna histórico de mensagens ordenado cronologicamente
   - Suporta paginação para conversas longas
   - Inclui contexto completo da conversa

5. **`get_message_stats`** - Estatísticas detalhadas de mensagens
   - Total de mensagens, enviadas vs recebidas
   - Distribuição por tipo de mensagem
   - Agrupamento por dia, hora ou tipo

6. **`get_contacts`** - Lista contatos de uma instância
   - Busca por nome ou número
   - Inclui foto de perfil e última atualização

7. **`get_chats`** - Lista chats ativos
   - Filtra chats com mensagens não lidas
   - Informações de última atividade

8. **`get_instance_details`** - Detalhes completos de uma instância
   - Configurações, webhooks, integrações
   - Status de chatbots (Typebot, OpenAI, etc.)

9. **`execute_query`** - Executa query SQL personalizada (avançado)
   - Apenas queries SELECT (segurança)
   - Para análises complexas e customizadas

## 📦 Instalação

### Pré-requisitos

- Node.js 18+ ou 20+
- PostgreSQL com Evolution API rodando
- Acesso à string de conexão do banco de dados

### Passo 1: Instalar dependências

```bash
cd mcp-server
npm install
```

### Passo 2: Configurar variáveis de ambiente

Copie o arquivo de exemplo e configure:

```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure a string de conexão:

```env
DATABASE_CONNECTION_URI=postgresql://usuario:senha@localhost:5432/evolution
```

### Passo 3: Compilar o projeto

```bash
npm run build
```

### Passo 4: Testar localmente

```bash
npm run dev
```

## 🔧 Configuração no Claude Desktop

Para usar este MCP server com o Claude Desktop, adicione a configuração no arquivo de configuração do Claude:

### No macOS/Linux

Edite o arquivo: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "evolution-api": {
      "command": "node",
      "args": [
        "/caminho/completo/para/evolution-api/mcp-server/dist/index.js"
      ],
      "env": {
        "DATABASE_CONNECTION_URI": "postgresql://usuario:senha@localhost:5432/evolution"
      }
    }
  }
}
```

### No Windows

Edite o arquivo: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "evolution-api": {
      "command": "node",
      "args": [
        "C:\\caminho\\completo\\para\\evolution-api\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "DATABASE_CONNECTION_URI": "postgresql://usuario:senha@localhost:5432/evolution"
      }
    }
  }
}
```

**Importante:** Substitua `/caminho/completo/para` pelo caminho real onde o projeto está instalado.

## 📖 Exemplos de Uso

Depois de configurado, você pode interagir com o Claude Desktop usando comandos naturais:

### Listar instâncias

```
Mostre todas as instâncias WhatsApp ativas
```

### Buscar mensagens

```
Busque as últimas 50 mensagens da instância "minha-instancia" recebidas hoje
```

### Pesquisar por conteúdo

```
Procure mensagens que contenham "orçamento" na instância "vendas"
```

### Obter conversa

```
Mostre a conversa completa com o contato 5511999999999@s.whatsapp.net
```

### Estatísticas

```
Mostre estatísticas de mensagens da instância "suporte" agrupadas por hora
```

### Análise avançada

```
Execute uma query para contar mensagens por tipo de mídia na última semana
```

## 🛠️ Desenvolvimento

### Estrutura do projeto

```
mcp-server/
├── src/
│   └── index.ts          # Código principal do servidor MCP
├── dist/                 # Código compilado (gerado pelo build)
├── package.json          # Dependências e scripts
├── tsconfig.json         # Configuração TypeScript
├── .env                  # Variáveis de ambiente (não commitar!)
├── .env.example          # Exemplo de configuração
└── README.md             # Esta documentação
```

### Scripts disponíveis

- `npm run build` - Compila o TypeScript para JavaScript
- `npm run dev` - Roda em modo desenvolvimento com hot reload
- `npm start` - Executa o servidor compilado
- `npm run watch` - Modo watch para desenvolvimento

### Adicionando novas ferramentas

1. Adicione a definição da ferramenta no array `TOOLS`
2. Implemente o método correspondente na classe `EvolutionMCPServer`
3. Adicione o case no switch do `CallToolRequestSchema` handler
4. Compile e teste

## 🔒 Segurança

- **Queries SQL**: Apenas queries SELECT são permitidas na ferramenta `execute_query`
- **Validação**: Palavras-chave perigosas (INSERT, UPDATE, DELETE, etc.) são bloqueadas
- **Conexão**: Use sempre variáveis de ambiente para credenciais
- **Pool de conexões**: Limite de 10 conexões simultâneas ao PostgreSQL

## 📊 Schema do Banco de Dados

O servidor trabalha com as seguintes tabelas principais:

- `Instance` - Instâncias WhatsApp
- `Message` - Mensagens enviadas e recebidas
- `Contact` - Contatos sincronizados
- `Chat` - Conversas ativas
- `Media` - Arquivos de mídia
- `Webhook` - Configurações de webhook
- `Setting` - Configurações de instância
- E outras tabelas de integrações (Chatwoot, Typebot, OpenAI, etc.)

Para mais detalhes, consulte o schema Prisma em `prisma/postgresql-schema.prisma`.

## 🐛 Troubleshooting

### Erro de conexão com o banco

```
Erro: password authentication failed for user "postgres"
```

**Solução**: Verifique se a string de conexão está correta no arquivo `.env` ou na configuração do Claude Desktop.

### Servidor não aparece no Claude Desktop

1. Verifique se o arquivo de configuração está no local correto
2. Certifique-se de que o caminho para o `index.js` está correto (absoluto)
3. Reinicie o Claude Desktop completamente
4. Verifique os logs do Claude Desktop (Menu > Help > Show Logs)

### Timeout nas queries

Se as queries estão demorando muito:

1. Crie índices no banco de dados para campos frequentemente consultados
2. Reduza o `limit` das queries
3. Use filtros mais específicos (datas, instâncias)

## 📝 Licença

Apache-2.0 - Mesma licença do Evolution API

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'feat: Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para problemas e dúvidas:

- Abra uma issue no repositório do Evolution API
- Consulte a documentação do MCP: https://modelcontextprotocol.io/
- Comunidade Evolution API: https://evolution-api.com/

---

**Desenvolvido para o Evolution API** - A melhor API REST para WhatsApp
