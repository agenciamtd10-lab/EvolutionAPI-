#!/usr/bin/env node

/**
 * Evolution API MCP Server
 *
 * Servidor MCP (Model Context Protocol) para análise de mensagens e dados
 * do Evolution API através do PostgreSQL.
 *
 * Ferramentas disponíveis:
 * - list_instances: Lista todas as instâncias WhatsApp
 * - get_messages: Busca mensagens com filtros avançados
 * - search_messages: Busca mensagens por texto
 * - get_conversation: Obtém conversa completa entre contatos
 * - get_message_stats: Estatísticas de mensagens por instância
 * - get_contacts: Lista contatos de uma instância
 * - get_chats: Lista chats ativos
 * - get_instance_details: Detalhes completos de uma instância
 * - execute_query: Executa query SQL personalizada (uso avançado)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
import * as dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_CONNECTION_URI,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Validar conexão ao iniciar
pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
  process.exit(-1);
});

// Definição das ferramentas disponíveis
const TOOLS: Tool[] = [
  {
    name: "list_instances",
    description: "Lista todas as instâncias WhatsApp cadastradas no Evolution API com status de conexão e informações básicas",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["open", "close", "connecting"],
          description: "Filtrar por status de conexão (opcional)",
        },
        limit: {
          type: "number",
          description: "Número máximo de resultados (padrão: 50)",
        },
      },
    },
  },
  {
    name: "get_messages",
    description: "Busca mensagens com filtros avançados (instância, período, contato, tipo de mensagem, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        instanceName: {
          type: "string",
          description: "Nome da instância (obrigatório se não especificar instanceId)",
        },
        instanceId: {
          type: "string",
          description: "ID da instância (obrigatório se não especificar instanceName)",
        },
        remoteJid: {
          type: "string",
          description: "JID do contato/grupo (ex: 5511999999999@s.whatsapp.net)",
        },
        messageType: {
          type: "string",
          description: "Tipo de mensagem (conversation, imageMessage, videoMessage, audioMessage, documentMessage, etc.)",
        },
        startDate: {
          type: "string",
          description: "Data inicial no formato ISO 8601 (ex: 2024-01-01T00:00:00Z)",
        },
        endDate: {
          type: "string",
          description: "Data final no formato ISO 8601",
        },
        limit: {
          type: "number",
          description: "Número máximo de mensagens (padrão: 100, máximo: 1000)",
        },
        offset: {
          type: "number",
          description: "Deslocamento para paginação (padrão: 0)",
        },
        orderBy: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Ordenação por timestamp (padrão: desc - mais recentes primeiro)",
        },
      },
    },
  },
  {
    name: "search_messages",
    description: "Busca mensagens pelo conteúdo de texto. Suporta busca em mensagens de texto, legendas de mídia e mensagens extendidas",
    inputSchema: {
      type: "object",
      properties: {
        searchText: {
          type: "string",
          description: "Texto a ser buscado nas mensagens (obrigatório)",
        },
        instanceName: {
          type: "string",
          description: "Nome da instância para filtrar (opcional)",
        },
        remoteJid: {
          type: "string",
          description: "JID do contato/grupo para filtrar (opcional)",
        },
        caseSensitive: {
          type: "boolean",
          description: "Busca case-sensitive (padrão: false)",
        },
        limit: {
          type: "number",
          description: "Número máximo de resultados (padrão: 50, máximo: 500)",
        },
      },
      required: ["searchText"],
    },
  },
  {
    name: "get_conversation",
    description: "Obtém uma conversa completa entre a instância e um contato/grupo, ordenada cronologicamente",
    inputSchema: {
      type: "object",
      properties: {
        instanceName: {
          type: "string",
          description: "Nome da instância (obrigatório se não especificar instanceId)",
        },
        instanceId: {
          type: "string",
          description: "ID da instância (obrigatório se não especificar instanceName)",
        },
        remoteJid: {
          type: "string",
          description: "JID do contato/grupo (obrigatório)",
        },
        limit: {
          type: "number",
          description: "Número de mensagens recentes (padrão: 50, máximo: 500)",
        },
        beforeTimestamp: {
          type: "number",
          description: "Carregar mensagens anteriores a este timestamp (para paginação)",
        },
      },
      required: ["remoteJid"],
    },
  },
  {
    name: "get_message_stats",
    description: "Obtém estatísticas detalhadas de mensagens: total, por tipo, por período, mensagens enviadas/recebidas",
    inputSchema: {
      type: "object",
      properties: {
        instanceName: {
          type: "string",
          description: "Nome da instância (obrigatório se não especificar instanceId)",
        },
        instanceId: {
          type: "string",
          description: "ID da instância (obrigatório se não especificar instanceName)",
        },
        startDate: {
          type: "string",
          description: "Data inicial para análise (formato ISO 8601)",
        },
        endDate: {
          type: "string",
          description: "Data final para análise (formato ISO 8601)",
        },
        groupBy: {
          type: "string",
          enum: ["day", "hour", "type"],
          description: "Agrupar estatísticas por dia, hora ou tipo de mensagem",
        },
      },
    },
  },
  {
    name: "get_contacts",
    description: "Lista os contatos de uma instância com informações de nome e foto de perfil",
    inputSchema: {
      type: "object",
      properties: {
        instanceName: {
          type: "string",
          description: "Nome da instância (obrigatório se não especificar instanceId)",
        },
        instanceId: {
          type: "string",
          description: "ID da instância (obrigatório se não especificar instanceName)",
        },
        search: {
          type: "string",
          description: "Buscar por nome ou número",
        },
        limit: {
          type: "number",
          description: "Número máximo de contatos (padrão: 100)",
        },
      },
    },
  },
  {
    name: "get_chats",
    description: "Lista os chats ativos de uma instância com informações de última mensagem e mensagens não lidas",
    inputSchema: {
      type: "object",
      properties: {
        instanceName: {
          type: "string",
          description: "Nome da instância (obrigatório se não especificar instanceId)",
        },
        instanceId: {
          type: "string",
          description: "ID da instância (obrigatório se não especificar instanceName)",
        },
        onlyUnread: {
          type: "boolean",
          description: "Mostrar apenas chats com mensagens não lidas (padrão: false)",
        },
        limit: {
          type: "number",
          description: "Número máximo de chats (padrão: 50)",
        },
      },
    },
  },
  {
    name: "get_instance_details",
    description: "Obtém informações detalhadas de uma instância incluindo configurações, integrações e webhooks",
    inputSchema: {
      type: "object",
      properties: {
        instanceName: {
          type: "string",
          description: "Nome da instância (obrigatório se não especificar instanceId)",
        },
        instanceId: {
          type: "string",
          description: "ID da instância (obrigatório se não especificar instanceName)",
        },
      },
    },
  },
  {
    name: "execute_query",
    description: "Executa uma query SQL personalizada no banco de dados (uso avançado). ATENÇÃO: Apenas queries SELECT são permitidas por segurança",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Query SQL a ser executada (apenas SELECT)",
        },
        params: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Parâmetros para a query (opcional, para queries parametrizadas)",
        },
      },
      required: ["query"],
    },
  },
];

// Classe do servidor MCP
class EvolutionMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "evolution-api-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // Handler para listar ferramentas
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // Handler para executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "list_instances":
            return await this.listInstances(args);
          case "get_messages":
            return await this.getMessages(args);
          case "search_messages":
            return await this.searchMessages(args);
          case "get_conversation":
            return await this.getConversation(args);
          case "get_message_stats":
            return await this.getMessageStats(args);
          case "get_contacts":
            return await this.getContacts(args);
          case "get_chats":
            return await this.getChats(args);
          case "get_instance_details":
            return await this.getInstanceDetails(args);
          case "execute_query":
            return await this.executeQuery(args);
          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Erro ao executar a ferramenta: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async listInstances(args: any) {
    const { status, limit = 50 } = args;

    let query = `
      SELECT
        id,
        name,
        "connectionStatus",
        "ownerJid",
        "profileName",
        "profilePicUrl",
        integration,
        number,
        "clientName",
        "createdAt",
        "updatedAt",
        "disconnectionAt"
      FROM "Instance"
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`"connectionStatus" = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: result.rowCount,
              instances: result.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getMessages(args: any) {
    const {
      instanceName,
      instanceId,
      remoteJid,
      messageType,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
      orderBy = "desc",
    } = args;

    if (!instanceName && !instanceId) {
      throw new Error("É necessário fornecer instanceName ou instanceId");
    }

    // Primeiro, obter o instanceId se foi fornecido instanceName
    let finalInstanceId = instanceId;
    if (instanceName) {
      const instanceResult = await pool.query(
        'SELECT id FROM "Instance" WHERE name = $1',
        [instanceName]
      );
      if (instanceResult.rows.length === 0) {
        throw new Error(`Instância não encontrada: ${instanceName}`);
      }
      finalInstanceId = instanceResult.rows[0].id;
    }

    let query = `
      SELECT
        m.id,
        m.key,
        m."pushName",
        m.participant,
        m."messageType",
        m.message,
        m."contextInfo",
        m.source,
        m."messageTimestamp",
        m.status,
        m."createdAt",
        med.id as "mediaId",
        med."fileName" as "mediaFileName",
        med.type as "mediaType",
        med.mimetype as "mediaMimetype"
      FROM "Message" m
      LEFT JOIN "Media" med ON med."messageId" = m.id
      WHERE m."instanceId" = $1
    `;

    const params: any[] = [finalInstanceId];
    let paramIndex = 2;

    if (remoteJid) {
      query += ` AND m.key->>'remoteJid' = $${paramIndex}`;
      params.push(remoteJid);
      paramIndex++;
    }

    if (messageType) {
      query += ` AND m."messageType" = $${paramIndex}`;
      params.push(messageType);
      paramIndex++;
    }

    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      query += ` AND m."messageTimestamp" >= $${paramIndex}`;
      params.push(startTimestamp);
      paramIndex++;
    }

    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      query += ` AND m."messageTimestamp" <= $${paramIndex}`;
      params.push(endTimestamp);
      paramIndex++;
    }

    query += ` ORDER BY m."messageTimestamp" ${orderBy.toUpperCase()}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Math.min(limit, 1000), offset);

    const result = await pool.query(query, params);

    // Contar total de mensagens que correspondem aos filtros
    let countQuery = `SELECT COUNT(*) as total FROM "Message" m WHERE m."instanceId" = $1`;
    const countParams: any[] = [finalInstanceId];
    let countParamIndex = 2;

    if (remoteJid) {
      countQuery += ` AND m.key->>'remoteJid' = $${countParamIndex}`;
      countParams.push(remoteJid);
      countParamIndex++;
    }

    if (messageType) {
      countQuery += ` AND m."messageType" = $${countParamIndex}`;
      countParams.push(messageType);
      countParamIndex++;
    }

    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      countQuery += ` AND m."messageTimestamp" >= $${countParamIndex}`;
      countParams.push(startTimestamp);
      countParamIndex++;
    }

    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      countQuery += ` AND m."messageTimestamp" <= $${countParamIndex}`;
      countParams.push(endTimestamp);
    }

    const countResult = await pool.query(countQuery, countParams);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: parseInt(countResult.rows[0].total),
              count: result.rowCount,
              offset,
              limit,
              messages: result.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async searchMessages(args: any) {
    const {
      searchText,
      instanceName,
      remoteJid,
      caseSensitive = false,
      limit = 50,
    } = args;

    if (!searchText) {
      throw new Error("searchText é obrigatório");
    }

    let query = `
      SELECT
        m.id,
        m.key,
        m."pushName",
        m."messageType",
        m.message,
        m."messageTimestamp",
        i.name as "instanceName"
      FROM "Message" m
      INNER JOIN "Instance" i ON i.id = m."instanceId"
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (instanceName) {
      query += ` AND i.name = $${paramIndex}`;
      params.push(instanceName);
      paramIndex++;
    }

    if (remoteJid) {
      query += ` AND m.key->>'remoteJid' = $${paramIndex}`;
      params.push(remoteJid);
      paramIndex++;
    }

    // Busca no conteúdo da mensagem (conversation, extendedTextMessage, imageMessage caption, etc.)
    const searchOperator = caseSensitive ? "LIKE" : "ILIKE";
    query += ` AND (
      m.message->>'conversation' ${searchOperator} $${paramIndex} OR
      m.message->'extendedTextMessage'->>'text' ${searchOperator} $${paramIndex} OR
      m.message->'imageMessage'->>'caption' ${searchOperator} $${paramIndex} OR
      m.message->'videoMessage'->>'caption' ${searchOperator} $${paramIndex} OR
      m.message->'documentMessage'->>'caption' ${searchOperator} $${paramIndex}
    )`;
    params.push(`%${searchText}%`);
    paramIndex++;

    query += ` ORDER BY m."messageTimestamp" DESC LIMIT $${paramIndex}`;
    params.push(Math.min(limit, 500));

    const result = await pool.query(query, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: result.rowCount,
              searchText,
              messages: result.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getConversation(args: any) {
    const {
      instanceName,
      instanceId,
      remoteJid,
      limit = 50,
      beforeTimestamp,
    } = args;

    if (!remoteJid) {
      throw new Error("remoteJid é obrigatório");
    }

    if (!instanceName && !instanceId) {
      throw new Error("É necessário fornecer instanceName ou instanceId");
    }

    let finalInstanceId = instanceId;
    if (instanceName) {
      const instanceResult = await pool.query(
        'SELECT id FROM "Instance" WHERE name = $1',
        [instanceName]
      );
      if (instanceResult.rows.length === 0) {
        throw new Error(`Instância não encontrada: ${instanceName}`);
      }
      finalInstanceId = instanceResult.rows[0].id;
    }

    let query = `
      SELECT
        m.id,
        m.key,
        m."pushName",
        m.participant,
        m."messageType",
        m.message,
        m."contextInfo",
        m.source,
        m."messageTimestamp",
        m.status,
        med."fileName" as "mediaFileName",
        med.type as "mediaType"
      FROM "Message" m
      LEFT JOIN "Media" med ON med."messageId" = m.id
      WHERE m."instanceId" = $1
        AND m.key->>'remoteJid' = $2
    `;

    const params: any[] = [finalInstanceId, remoteJid];
    let paramIndex = 3;

    if (beforeTimestamp) {
      query += ` AND m."messageTimestamp" < $${paramIndex}`;
      params.push(beforeTimestamp);
      paramIndex++;
    }

    query += ` ORDER BY m."messageTimestamp" DESC LIMIT $${paramIndex}`;
    params.push(Math.min(limit, 500));

    const result = await pool.query(query, params);

    // Inverter para ordem cronológica
    const messages = result.rows.reverse();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              remoteJid,
              count: result.rowCount,
              messages,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getMessageStats(args: any) {
    const { instanceName, instanceId, startDate, endDate, groupBy } = args;

    if (!instanceName && !instanceId) {
      throw new Error("É necessário fornecer instanceName ou instanceId");
    }

    let finalInstanceId = instanceId;
    if (instanceName) {
      const instanceResult = await pool.query(
        'SELECT id FROM "Instance" WHERE name = $1',
        [instanceName]
      );
      if (instanceResult.rows.length === 0) {
        throw new Error(`Instância não encontrada: ${instanceName}`);
      }
      finalInstanceId = instanceResult.rows[0].id;
    }

    const params: any[] = [finalInstanceId];
    let paramIndex = 2;
    const conditions: string[] = [`"instanceId" = $1`];

    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      conditions.push(`"messageTimestamp" >= $${paramIndex}`);
      params.push(startTimestamp);
      paramIndex++;
    }

    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      conditions.push(`"messageTimestamp" <= $${paramIndex}`);
      params.push(endTimestamp);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Total de mensagens
    const totalQuery = `SELECT COUNT(*) as total FROM "Message" WHERE ${whereClause}`;
    const totalResult = await pool.query(totalQuery, params);

    // Mensagens enviadas vs recebidas
    const sentReceivedQuery = `
      SELECT
        key->>'fromMe' as "fromMe",
        COUNT(*) as count
      FROM "Message"
      WHERE ${whereClause}
      GROUP BY key->>'fromMe'
    `;
    const sentReceivedResult = await pool.query(sentReceivedQuery, params);

    // Por tipo de mensagem
    const byTypeQuery = `
      SELECT
        "messageType",
        COUNT(*) as count
      FROM "Message"
      WHERE ${whereClause}
      GROUP BY "messageType"
      ORDER BY count DESC
    `;
    const byTypeResult = await pool.query(byTypeQuery, params);

    let groupedStats = null;
    if (groupBy === "day") {
      const byDayQuery = `
        SELECT
          DATE(to_timestamp("messageTimestamp")) as date,
          COUNT(*) as count
        FROM "Message"
        WHERE ${whereClause}
        GROUP BY DATE(to_timestamp("messageTimestamp"))
        ORDER BY date DESC
        LIMIT 30
      `;
      const byDayResult = await pool.query(byDayQuery, params);
      groupedStats = { byDay: byDayResult.rows };
    } else if (groupBy === "hour") {
      const byHourQuery = `
        SELECT
          EXTRACT(HOUR FROM to_timestamp("messageTimestamp")) as hour,
          COUNT(*) as count
        FROM "Message"
        WHERE ${whereClause}
        GROUP BY EXTRACT(HOUR FROM to_timestamp("messageTimestamp"))
        ORDER BY hour
      `;
      const byHourResult = await pool.query(byHourQuery, params);
      groupedStats = { byHour: byHourResult.rows };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: parseInt(totalResult.rows[0].total),
              sentReceived: sentReceivedResult.rows,
              byType: byTypeResult.rows,
              ...groupedStats,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getContacts(args: any) {
    const { instanceName, instanceId, search, limit = 100 } = args;

    if (!instanceName && !instanceId) {
      throw new Error("É necessário fornecer instanceName ou instanceId");
    }

    let finalInstanceId = instanceId;
    if (instanceName) {
      const instanceResult = await pool.query(
        'SELECT id FROM "Instance" WHERE name = $1',
        [instanceName]
      );
      if (instanceResult.rows.length === 0) {
        throw new Error(`Instância não encontrada: ${instanceName}`);
      }
      finalInstanceId = instanceResult.rows[0].id;
    }

    let query = `
      SELECT
        id,
        "remoteJid",
        "pushName",
        "profilePicUrl",
        "createdAt",
        "updatedAt"
      FROM "Contact"
      WHERE "instanceId" = $1
    `;

    const params: any[] = [finalInstanceId];
    let paramIndex = 2;

    if (search) {
      query += ` AND ("pushName" ILIKE $${paramIndex} OR "remoteJid" ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY "updatedAt" DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: result.rowCount,
              contacts: result.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getChats(args: any) {
    const { instanceName, instanceId, onlyUnread = false, limit = 50 } = args;

    if (!instanceName && !instanceId) {
      throw new Error("É necessário fornecer instanceName ou instanceId");
    }

    let finalInstanceId = instanceId;
    if (instanceName) {
      const instanceResult = await pool.query(
        'SELECT id FROM "Instance" WHERE name = $1',
        [instanceName]
      );
      if (instanceResult.rows.length === 0) {
        throw new Error(`Instância não encontrada: ${instanceName}`);
      }
      finalInstanceId = instanceResult.rows[0].id;
    }

    let query = `
      SELECT
        c.id,
        c."remoteJid",
        c.name,
        c."unreadMessages",
        c.labels,
        c."updatedAt",
        c."createdAt"
      FROM "Chat" c
      WHERE c."instanceId" = $1
    `;

    const params: any[] = [finalInstanceId];
    let paramIndex = 2;

    if (onlyUnread) {
      query += ` AND c."unreadMessages" > 0`;
    }

    query += ` ORDER BY c."updatedAt" DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: result.rowCount,
              chats: result.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getInstanceDetails(args: any) {
    const { instanceName, instanceId } = args;

    if (!instanceName && !instanceId) {
      throw new Error("É necessário fornecer instanceName ou instanceId");
    }

    let query = `
      SELECT
        i.*,
        w.url as "webhookUrl",
        w.enabled as "webhookEnabled",
        w.events as "webhookEvents",
        s."rejectCall",
        s."groupsIgnore",
        s."alwaysOnline",
        s."readMessages",
        s."readStatus"
      FROM "Instance" i
      LEFT JOIN "Webhook" w ON w."instanceId" = i.id
      LEFT JOIN "Setting" s ON s."instanceId" = i.id
    `;

    const params: any[] = [];

    if (instanceId) {
      query += ` WHERE i.id = $1`;
      params.push(instanceId);
    } else {
      query += ` WHERE i.name = $1`;
      params.push(instanceName);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      throw new Error("Instância não encontrada");
    }

    // Buscar informações de integrações
    const instance = result.rows[0];
    const integrations: any = {};

    // Chatwoot
    const chatwootResult = await pool.query(
      'SELECT enabled, url, "accountId", "nameInbox" FROM "Chatwoot" WHERE "instanceId" = $1',
      [instance.id]
    );
    if (chatwootResult.rows.length > 0) {
      integrations.chatwoot = chatwootResult.rows[0];
    }

    // Typebot
    const typebotResult = await pool.query(
      'SELECT COUNT(*) as count, SUM(CASE WHEN enabled THEN 1 ELSE 0 END) as enabled FROM "Typebot" WHERE "instanceId" = $1',
      [instance.id]
    );
    if (typebotResult.rows[0].count > 0) {
      integrations.typebot = {
        total: parseInt(typebotResult.rows[0].count),
        enabled: parseInt(typebotResult.rows[0].enabled),
      };
    }

    // OpenAI
    const openaiResult = await pool.query(
      'SELECT COUNT(*) as count FROM "OpenaiBot" WHERE "instanceId" = $1 AND enabled = true',
      [instance.id]
    );
    if (parseInt(openaiResult.rows[0].count) > 0) {
      integrations.openai = { enabledBots: parseInt(openaiResult.rows[0].count) };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              instance,
              integrations,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async executeQuery(args: any) {
    const { query, params = [] } = args;

    // Validação de segurança: apenas SELECT
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery.startsWith("select")) {
      throw new Error(
        "Por segurança, apenas queries SELECT são permitidas"
      );
    }

    // Verificar se não contém palavras-chave perigosas
    const dangerousKeywords = [
      "insert",
      "update",
      "delete",
      "drop",
      "create",
      "alter",
      "truncate",
      "grant",
      "revoke",
    ];

    for (const keyword of dangerousKeywords) {
      if (normalizedQuery.includes(keyword)) {
        throw new Error(
          `Por segurança, a palavra-chave '${keyword}' não é permitida`
        );
      }
    }

    const result = await pool.query(query, params);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              rowCount: result.rowCount,
              rows: result.rows,
              fields: result.fields.map((f) => ({
                name: f.name,
                dataTypeID: f.dataTypeID,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Evolution API MCP Server rodando em stdio");
  }
}

// Inicializar e executar o servidor
const server = new EvolutionMCPServer();
server.run().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
