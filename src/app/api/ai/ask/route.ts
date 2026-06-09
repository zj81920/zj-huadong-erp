import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getEmbedding, callAIModelStream } from '@/lib/ai';

const SYSTEM_PROMPT = `你是一个 ERP 系统的智能助手。请基于以下检索到的文件内容回答用户问题。
要求：
1. 只基于提供的内容回答，不要编造信息
2. 如果内容不足以回答问题，如实说"未找到相关信息"
3. 回答要简洁、准确
4. 涉及金额、日期等数据时，引用原文`;

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: '请输入问题' }, { status: 400 });
    }

    // 1. 问题转 embedding
    const queryVector = await getEmbedding(question);

    // 2. pgvector 相似度搜索
    const results = await prisma.$queryRaw<Array<{
      id: string; chunk_text: string; file_key: string;
      file_name: string; file_type: string; score: number;
    }>>`
      SELECT fc.id, fc.chunk_text, fir.file_key, fir.file_name, fir.file_type,
             1 - (fc.embedding <=> ${JSON.stringify(queryVector)}::vector) AS score
      FROM file_chunks fc
      JOIN file_index_records fir ON fir.id = fc.record_id
      WHERE fir.status = 'completed'
      ORDER BY fc.embedding <=> ${JSON.stringify(queryVector)}::vector
      LIMIT 5
    `;

    if (results.length === 0) {
      return NextResponse.json({ answer: '未找到相关文件信息，请换个问题试试。', sources: [] });
    }

    // 3. 组装 RAG prompt
    const context = results.map(r => `[${r.file_name}]\n${r.chunk_text}`).join('\n\n---\n\n');
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: `检索到的文件内容：\n\n${context}\n\n用户问题：${question}` },
    ];

    // 4. 生成来源文件（去重）
    const seen = new Set<string>();
    const sources = results
      .filter(r => {
        if (seen.has(r.file_key)) return false;
        seen.add(r.file_key);
        return true;
      })
      .map(r => ({
        fileKey: r.file_key, fileName: r.file_name, fileType: r.file_type,
        score: Math.round(r.score * 100) / 100,
        previewUrl: `/api/file/preview?key=${encodeURIComponent(r.file_key)}`,
      }));

    // 5. 流式返回 AI 回答
    const aiStream = await callAIModelStream(messages);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // 先发 sources
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'sources', data: sources }) + '\n'));

        try {
          const reader = aiStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'token', data: value }) + '\n'));
          }
        } catch (e: any) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', data: e.message }) + '\n'));
        } finally {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('AI 问答失败:', error);
    return NextResponse.json({ error: '问答失败，请稍后重试' }, { status: 500 });
  }
}
