import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// @ts-ignore
import Sentiment from 'sentiment';

const sentiment = new Sentiment();

function extractMessageText(messageObj: any): string {
  if (typeof messageObj === 'string') return messageObj;
  if (!messageObj || typeof messageObj !== 'object') return '';

  const msg = messageObj.message || messageObj;

  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;

  return '';
}

function categorizeSentiment(score: number): string {
  if (score > 2) return 'very_positive';
  if (score > 0) return 'positive';
  if (score < -2) return 'very_negative';
  if (score < 0) return 'negative';
  return 'neutral';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceId = searchParams.get('instanceId');
    const limit = parseInt(searchParams.get('limit') || '1000');

    // Construir where clause
    const where: any = {
      fromMe: false, // Apenas mensagens recebidas
    };
    if (instanceId) {
      where.instanceId = instanceId;
    }

    // Buscar mensagens
    const messages = await prisma.message.findMany({
      where,
      take: limit,
      orderBy: { messageTimestamp: 'desc' },
    });

    // Analisar sentimento
    const analyzed = messages.map((msg: any) => {
      const text = extractMessageText(msg.message);
      if (!text) return null;

      const analysis = sentiment.analyze(text);
      const category = categorizeSentiment(analysis.score);

      return {
        id: msg.id,
        text,
        sentiment: {
          score: analysis.score,
          comparative: analysis.comparative,
          category,
          positive: analysis.positive,
          negative: analysis.negative,
        },
        timestamp: msg.messageTimestamp,
      };
    }).filter(Boolean);

    // Calcular distribuição
    const distribution = analyzed.reduce((acc: any, item: any) => {
      const cat = item.sentiment.category;
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    // Calcular score médio
    const avgScore = analyzed.length > 0
      ? analyzed.reduce((sum: number, item: any) => sum + item.sentiment.score, 0) / analyzed.length
      : 0;

    // Obter paginação dos query params
    const { searchParams } = req.nextUrl;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : 100;

    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;

    const paginatedMessages = analyzed.slice(startIdx, endIdx);
    const totalPages = Math.ceil(analyzed.length / pageSize);

    return NextResponse.json({
      total: analyzed.length,
      avgScore: avgScore.toFixed(2),
      distribution,
      messages: paginatedMessages,
      pagination: {
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        note: "A lista de mensagens é paginada. Use os parâmetros 'page' e 'pageSize' na query string para navegar."
      }
    });
  } catch (error) {
    console.error('Erro ao analisar sentimento:', error);
    return NextResponse.json(
      { error: 'Erro ao analisar sentimento' },
      { status: 500 }
    );
  }
}
