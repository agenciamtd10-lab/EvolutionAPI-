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

    return NextResponse.json({
      total: analyzed.length,
      avgScore: avgScore.toFixed(2),
      distribution,
      messages: analyzed.slice(0, 100), // Retornar apenas as primeiras 100
    });
  } catch (error) {
    console.error('Erro ao analisar sentimento:', error);
    return NextResponse.json(
      { error: 'Erro ao analisar sentimento' },
      { status: 500 }
    );
  }
}
