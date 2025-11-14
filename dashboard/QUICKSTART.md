# 🚀 Guia Rápido - Evolution Dashboard

## Instalação em 5 Minutos

### 1. Instale as dependências
```bash
cd dashboard
npm install
```

### 2. Configure o banco de dados
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite com suas credenciais
nano .env
```

Cole a string de conexão do seu PostgreSQL:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/evolution"
```

### 3. Gere o Prisma Client
```bash
npx prisma generate
```

### 4. Inicie o servidor
```bash
npm run dev
```

### 5. Acesse o painel
Abra: **http://localhost:3000**

## ✨ Primeiro Uso

### Dashboard
1. Clique na aba **"Dashboard"**
2. Veja suas métricas em tempo real
3. Use os filtros para refinar a análise

### Chat IA
1. Clique na aba **"Chat IA"**
2. Faça perguntas como:
   - "Quais são os horários de pico?"
   - "Mostre o sentimento geral"
   - "Quantas mensagens tenho hoje?"

## 🎯 Perguntas Frequentes

**P: Não vejo dados no dashboard**
R: Verifique se o banco Evolution API está populado e a string de conexão está correta.

**P: Erro ao conectar no banco**
R: Confirme que o PostgreSQL está rodando: `sudo systemctl status postgresql`

**P: Porta 3000 já está em uso**
R: Use outra porta: `PORT=3001 npm run dev`

## 📊 Dicas

- Use filtros por data para análises específicas
- O chat IA aprende com suas perguntas
- Exporte relatórios para análise offline
- Dark mode automático baseado no sistema

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build
npm start

# Verificar problemas
npm run lint
```

## 💡 Próximos Passos

1. ✅ Explore o dashboard completo
2. ✅ Teste o chat IA com diferentes perguntas
3. ✅ Configure filtros personalizados
4. ✅ Exporte seus primeiros relatórios

---

**Pronto! Seu painel está funcionando** 🎉

Para mais detalhes, consulte o [README.md](./README.md)
