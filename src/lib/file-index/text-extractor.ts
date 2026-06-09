import fs from 'fs';
import pdfParse from 'pdf-parse';

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  if (!fs.existsSync(filePath)) return '';

  try {
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      return fs.readFileSync(filePath, 'utf-8');
    }

    if (mimeType === 'application/pdf') {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth');
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(filePath);
      const texts: string[] = [];
      workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv) texts.push(`[${name}]\n${csv}`);
      });
      return texts.join('\n\n');
    }

    return '';
  } catch (error) {
    console.error(`Text extraction failed for ${filePath}:`, error);
    return '';
  }
}

export function getSupportMimeTypes(): string[] {
  return [
    'text/plain', 'text/csv', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
}
