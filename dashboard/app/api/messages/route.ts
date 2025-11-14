import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceId = searchParams.get('instanceId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const fromMe = searchParams.get('fromMe');

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
    if (fromMe !== null && fromMe !== undefined) {
      where.fromMe = fromMe === 'true';
    }

    // Buscar mensagens
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { messageTimestamp: 'desc' },
        include: {
          Instance: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    return NextResponse.json({
      messages,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar mensagens' },
      { status: 500 }
    );
  }
}
