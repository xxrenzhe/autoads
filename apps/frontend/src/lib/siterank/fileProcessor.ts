import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { UrlValidator } from '@/lib/utils/url/UrlValidator';
import { DOMAIN_HEADER_CANDIDATES } from './types';
import ExcelJS from 'exceljs';
import { EnhancedError } from '@/lib/utils/error-handling';
import { validateBatchQueryCount, defaultSiteRankConfig } from '@/lib/config/siterank';

const logger = createClientLogger('FileProcessor');

export interface ProcessedFileData {
  domains: string[];
  columns: string[];
  rows: Record<string, string>[];
}

function getDomainCol(headers: string[]): string | null {
  for (const candidate of DOMAIN_HEADER_CANDIDATES) {
    const found = headers.find((header: any) => 
      header.toLowerCase().includes(candidate.toLowerCase())
    );
    if (found) {
      return found;
    }
  }
  return null as any;
}

export async function processFile(
  file: File,
  locale: string = "en",
  batchLimit: number = 100
): Promise<ProcessedFileData> {
  const data = await file.arrayBuffer();
  let headers: string[] = [];
  let rows: unknown[][] = [];

  if (file.name.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(data);
    const lines = text.split(/\r?\n/).filter(Boolean);
    headers = lines[0].split(",")?.filter(Boolean)?.map((h: any) => h.trim());
    rows = lines.slice(1)?.filter(Boolean)?.map((line: any) => line.split(","));
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const worksheet = workbook.worksheets[0];
    
    // Get headers properly - don't filter out empty cells to maintain column positions
    const headerRow = worksheet.getRow(1);
    for (let col = 1; col <= worksheet.columnCount; col++) {
      const cell = headerRow.getCell(col);
      const value = cell.value?.toString() || '';
      headers.push(value);
    }
    
    // Process data rows properly - maintain column positions
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData: string[] = [];
      
      for (let col = 1; col <= headers.length; col++) {
        const cell = row.getCell(col);
        const value = cell.value?.toString() || '';
        rowData.push(value);
      }
      
      // Only add rows that have some non-empty data
      if (rowData.some(cell => cell.trim())) {
        rows.push(rowData);
      }
    }
  }

  if (headers.length === 0 || rows.length === 0) {
    throw new Error(
      locale === "zh"
        ? "文件至少需要包含标题行和一行数据"
        : "File must contain at least a header row and one data row",
    );
  }

  const domainCol = getDomainCol(headers);
  if (!domainCol) {
    throw new Error(
      locale === "zh"
        ? `未找到域名列，请确保文件包含以下列名之一：${DOMAIN_HEADER_CANDIDATES.join(", ")}`
        : `Domain column not found, please ensure the file contains one of the following column names: ${DOMAIN_HEADER_CANDIDATES.join(", ")}`,
    );
  }

  const domainColIndex = headers.indexOf(domainCol);
  const processedRows: Record<string, string>[] = [];
  const extractedDomains: string[] = [];

  rows.forEach((row, rowIndex: any) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index: any) => { 
      obj[header] = row[index]?.toString() || ""; 
    });
    
    const urlValue = row[domainColIndex]?.toString();
    logger.info(`Row ${rowIndex + 1}: Processing URL from column ${domainColIndex} (${domainCol}): "${urlValue}"`);
    
    if (urlValue && typeof urlValue === "string" && urlValue.trim()) {
      const extractedDomain = UrlValidator.extractDomain(urlValue);
      logger.info(`Row ${rowIndex + 1}: Original URL="${urlValue}" -> Extracted Domain="${extractedDomain}"`);
      obj['extractedDomain'] = extractedDomain;
      processedRows.push(obj);
      extractedDomains.push(extractedDomain);
    } else {
      logger.warn(`Row ${rowIndex + 1}: Missing or invalid URL value:`, { data: urlValue, type: typeof urlValue });
    }
  });

  // 验证域名数量是否超过限制
  if (extractedDomains.length > batchLimit) {
    throw new Error(
      locale === "zh"
        ? `文件包含的域名数量超过限制（最多${batchLimit}个）`
        : `The file contains more domains than the allowed limit (maximum ${batchLimit})`
    );
  }

  logger.info(`Processed ${processedRows.length} rows with domains`);

  return {
    domains: extractedDomains,
    columns: headers,
    rows: processedRows
  };
}