export interface ChunkResult {
  text: string;
  index: number;
}

export function chunkText(
  text: string,
  chunkSize: number = 700,
  overlap: number = 100
): ChunkResult[] {
  if (!text || text.trim().length === 0) return [];

  const results: ChunkResult[] = [];
  const lines = text.split('\n');

  // ① 先按自然段落分块
  const paragraphs: string[] = [];
  let currentPara = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || /^#{1,6}\s/.test(trimmed) || /^第[一二三四五六七八九十]/.test(trimmed)) {
      if (currentPara) {
        paragraphs.push(currentPara.trim());
        currentPara = '';
      }
      if (trimmed) paragraphs.push(trimmed);
    } else {
      currentPara += (currentPara ? '\n' : '') + trimmed;
    }
  }
  if (currentPara.trim()) paragraphs.push(currentPara.trim());

  // ② 合并短段落，切分长段落
  const merged: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      if (buffer) { merged.push(buffer); buffer = ''; }
      // 先尝试按句号切分
      const sentences = para.split(/(?<=[。！？；.!?])/);
      // 如果只有一段（无标点），强制硬切分
      if (sentences.length === 1 && sentences[0].length > chunkSize) {
        for (let start = 0; start < sentences[0].length; start += chunkSize) {
          merged.push(sentences[0].slice(start, start + chunkSize).trim());
        }
      } else {
        let sentBuf = '';
        for (const sent of sentences) {
          if ((sentBuf + sent).length > chunkSize) {
            if (sentBuf) merged.push(sentBuf.trim());
            // 单句超长时硬切分
            if (sent.length > chunkSize) {
              for (let start = 0; start < sent.length; start += chunkSize) {
                merged.push(sent.slice(start, start + chunkSize).trim());
              }
              sentBuf = '';
            } else {
              sentBuf = sent;
            }
          } else {
            sentBuf += sent;
          }
        }
        if (sentBuf.trim()) merged.push(sentBuf.trim());
      }
    } else if (buffer.length + para.length <= chunkSize) {
      buffer += (buffer ? '\n' : '') + para;
    } else {
      merged.push(buffer.trim());
      buffer = para;
    }
  }
  if (buffer.trim()) merged.push(buffer.trim());

  // ③ 添加 overlap
  for (let i = 0; i < merged.length; i++) {
    let chunk = merged[i];
    if (i > 0 && overlap > 0) {
      const prevChunk = merged[i - 1];
      chunk = prevChunk.slice(-overlap) + chunk;
    }
    results.push({ text: chunk, index: i });
  }

  return results;
}
