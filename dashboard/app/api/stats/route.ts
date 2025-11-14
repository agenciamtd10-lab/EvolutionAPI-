import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const {searchParams} = request.nextUrl;
    const instanceId = searchParams.get('instanceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Construir where clause
    const where: any = {};
    if (instanceId) {
      where.instanceId = instanceId;
    }
    if (startDate && endDate) {
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime();
      where.messageTimestamp = {
        gte: startTimestamp,
        lte: endTimestamp,
      };
    }

    // Buscar estatísticas
    const [totalMessages, totalContacts, totalChats, recentMessages] = await Promise.all([
      prisma.message.count({ where }),
      prisma.contact.count({ where: instanceId ? { instanceId } : {} }),
      prisma.chat.count({ where: instanceId ? { instanceId } : {} }),
      prisma.message.findMany({
        where,
        take: 100,
        orderBy: { messageTimestamp: 'desc' },
      }),
    ]);

    // Calcular tempo médio de resposta (simplificado)
    let avgResponseTime = '2.5min';
    if (recentMessages.length > 0) {
      const conversations = recentMessages.reduce((acc: any, msg: any) => {
        const key = JSON.stringify(msg.key);
        if (!acc[key]) acc[key] = [];
        acc[key].push(msg);
        return acc;
      }, {});

      let totalResponseTimes = 0;
      let responseCount = 0;

      Object.values(conversations).forEach((msgs: any) => {
        for (let i = 1; i < msgs.length; i++) {
          if (msgs[i].fromMe !== msgs[i - 1].fromMe) {
            const diff = Number(msgs[i].messageTimestamp) - Number(msgs[i - 1].messageTimestamp);
            totalResponseTimes += diff;
            responseCount++;
          }
        }
      });

      if (responseCount > 0) {
        const avgMs = totalResponseTimes / responseCount;
        const avgMinutes = Math.round(avgMs / 60000);
        avgResponseTime = `${avgMinutes}min`;
      }
    }

    // Contar conversas ativas (últimas 24h)
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const activeConversations = await prisma.chat.count({
      where: {
        ...(instanceId ? { instanceId } : {}),
        lastMessageTime: {
          gte: yesterday,
        },
      },
    });

    return NextResponse.json({
      totalMessages,
      totalContacts,
      avgResponseTime,
      activeConversations,
      totalChats,
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}
