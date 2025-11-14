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

export async function POST(request: NextRequest) {
  try {
    const { message, instanceId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    const lower = message.toLowerCase();

    // Análise baseada em consultas ao banco
    let response = '';

    // Horários de pico
    if (lower.includes('horário') || lower.includes('pico') || lower.includes('hora')) {
      const where: any = {};
      if (instanceId) where.instanceId = instanceId;

      const messages = await prisma.message.findMany({
        where,
        select: { messageTimestamp: true },
      });

      // Agrupar por hora
      const hourCounts: { [key: number]: number } = {};
      messages.forEach((msg: any) => {
        const hour = new Date(Number(msg.messageTimestamp)).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      // Encontrar top 3 horários
      const topHours = Object.entries(hourCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3);

      response = '📊 **Análise de Horários de Pico:**\n\n';
      topHours.forEach(([hour, count], index) => {
        const percentage = ((count as number) / messages.length * 100).toFixed(1);
        response += `${index + 1}. **${hour}h**: ${count} mensagens (${percentage}%)\n`;
      });

      response += `\n💡 **Total analisado**: ${messages.length.toLocaleString('pt-BR')} mensagens`;
    }

    // Análise de sentimento
    else if (lower.includes('sentimento') || lower.includes('humor') || lower.includes('satisfação')) {
      const where: any = { fromMe: false };
      if (instanceId) where.instanceId = instanceId;

      const messages = await prisma.message.findMany({
        where,
        take: 1000,
        select: { message: true },
      });

      const sentiments = { very_positive: 0, positive: 0, neutral: 0, negative: 0, very_negative: 0 };

      messages.forEach((msg: any) => {
        const text = extractMessageText(msg.message);
        if (!text) return;

        const analysis = sentiment.analyze(text);
        const score = analysis.score;

        if (score > 2) sentiments.very_positive++;
        else if (score > 0) sentiments.positive++;
        else if (score < -2) sentiments.very_negative++;
        else if (score < 0) sentiments.negative++;
        else sentiments.neutral++;
      });

      const total = Object.values(sentiments).reduce((a, b) => a + b, 0);

      response = '😊 **Análise de Sentimento:**\n\n';
      response += `• **Muito Positivo**: ${((sentiments.very_positive / total) * 100).toFixed(1)}% (${sentiments.very_positive} mensagens)\n`;
      response += `• **Positivo**: ${((sentiments.positive / total) * 100).toFixed(1)}% (${sentiments.positive} mensagens)\n`;
      response += `• **Neutro**: ${((sentiments.neutral / total) * 100).toFixed(1)}% (${sentiments.neutral} mensagens)\n`;
      response += `• **Negativo**: ${((sentiments.negative / total) * 100).toFixed(1)}% (${sentiments.negative} mensagens)\n`;
      response += `• **Muito Negativo**: ${((sentiments.very_negative / total) * 100).toFixed(1)}% (${sentiments.very_negative} mensagens)\n`;

      const positiveTotal = sentiments.very_positive + sentiments.positive;
      const negativeTotal = sentiments.negative + sentiments.very_negative;

      response += `\n✅ **Conclusão**: ${((positiveTotal / total) * 100).toFixed(1)}% das mensagens são positivas, `;
      response += `${((negativeTotal / total) * 100).toFixed(1)}% são negativas.`;
    }

    // Estatísticas gerais
    else if (lower.includes('total') || lower.includes('quantas') || lower.includes('estatística')) {
      const where: any = {};
      if (instanceId) where.instanceId = instanceId;

      const [totalMessages, totalContacts, totalChats] = await Promise.all([
        prisma.message.count({ where }),
        prisma.contact.count({ where: instanceId ? { instanceId } : {} }),
        prisma.chat.count({ where: instanceId ? { instanceId } : {} }),
      ]);

      response = '📈 **Estatísticas Gerais:**\n\n';
      response += `• **Total de Mensagens**: ${totalMessages.toLocaleString('pt-BR')}\n`;
      response += `• **Total de Contatos**: ${totalContacts.toLocaleString('pt-BR')}\n`;
      response += `• **Total de Chats**: ${totalChats.toLocaleString('pt-BR')}\n`;
      response += `• **Média de mensagens/chat**: ${(totalMessages / (totalChats || 1)).toFixed(1)}`;
    }

    // Resposta padrão
    else {
      response = `Entendi sua pergunta sobre "${message}". Posso ajudar com:\n\n`;
      response += `• **Horários de pico**: "Quais são os horários de maior movimento?"\n`;
      response += `• **Análise de sentimento**: "Como está o sentimento geral?"\n`;
      response += `• **Estatísticas**: "Quantas mensagens tenho no total?"\n`;
      response += `• **Contatos**: "Quais são meus principais contatos?"\n\n`;
      response += `💬 Faça uma pergunta mais específica para obter análises detalhadas!`;
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro no chat:', error);
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    );
  }
}
