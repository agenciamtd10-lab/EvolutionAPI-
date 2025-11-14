# 🚀 Guia Rápido - Evolution API MCP Server

Este é um guia rápido para configurar o MCP Server em **5 minutos**.

## Passo 1: Instalar Dependências

```bash
cd mcp-server
npm install
```

## Passo 2: Configurar Banco de Dados

Crie o arquivo `.env`:

```bash
cp .env.example .env
```

Edite `.env` e configure sua string de conexão PostgreSQL:

```env
DATABASE_CONNECTION_URI=postgresql://postgres:senha@localhost:5432/evolution
```

## Passo 3: Compilar

```bash
npm run build
```

## Passo 4: Configurar Claude Desktop

### macOS/Linux

1. Abra o arquivo de configuração:
   ```bash
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Cole esta configuração (ajuste o caminho):
   ```json
   {
     "mcpServers": {
       "evolution-api": {
         "command": "node",
         "args": [
           "/home/user/evolution-api/mcp-server/dist/index.js"
         ],
         "env": {
           "DATABASE_CONNECTION_URI": "postgresql://postgres:senha@localhost:5432/evolution"
         }
       }
     }
   }
   ```

### Windows

1. Abra o arquivo de configuração:
   ```
   notepad %APPDATA%\Claude\claude_desktop_config.json
   ```

2. Cole esta configuração (ajuste o caminho):
   ```json
   {
     "mcpServers": {
       "evolution-api": {
         "command": "node",
         "args": [
           "C:\\Users\\SeuUsuario\\evolution-api\\mcp-server\\dist\\index.js"
         ],
         "env": {
           "DATABASE_CONNECTION_URI": "postgresql://postgres:senha@localhost:5432/evolution"
         }
       }
     }
   }
   ```

## Passo 5: Reiniciar Claude Desktop

Feche completamente o Claude Desktop e abra novamente.

## ✅ Testar

Abra o Claude Desktop e digite:

```
Liste todas as instâncias do Evolution API
```

Se funcionar, você verá a lista de instâncias! 🎉

## 🔍 Exemplos de Comandos

Experimente estes comandos no Claude Desktop:

```
Mostre as últimas 10 mensagens da instância "minha-instancia"
```

```
Busque mensagens contendo "pedido" nas últimas 24 horas
```

```
Mostre estatísticas de mensagens da instância "vendas" agrupadas por dia
```

```
Liste os contatos da instância "suporte"
```

```
Mostre a conversa completa com o número 5511999999999@s.whatsapp.net
```

## 🐛 Problemas?

### Claude Desktop não mostra o MCP

1. Verifique se o caminho no `claude_desktop_config.json` está correto (use caminho ABSOLUTO)
2. Verifique se o arquivo foi compilado: `ls mcp-server/dist/index.js`
3. Reinicie o Claude Desktop completamente
4. Veja os logs: Menu > Help > Show Logs

### Erro de conexão com banco

1. Teste a conexão manualmente:
   ```bash
   psql "postgresql://postgres:senha@localhost:5432/evolution"
   ```
2. Verifique se o PostgreSQL está rodando
3. Verifique usuário, senha e nome do banco

### Para testar localmente (sem Claude Desktop)

```bash
cd mcp-server
npm run dev
```

Isso iniciará o servidor MCP em modo stdio (você verá uma mensagem no console).

## 📚 Documentação Completa

Para mais detalhes, consulte o [README.md](README.md) completo.

---

**Pronto!** Agora você pode analisar suas mensagens do WhatsApp com o poder do Claude! 🚀
