export async function processFile(file: File): Promise<string[]> {
  try {
    const text = await file.text();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Simple URL extraction - look for URLs in each line
    const urls: string[] = [];

    for (const line of lines) {
      // Extract URLs using a simple regex
      const urlMatches = line.match(/https?:\/\/[^\s,]+/g);
      if (urlMatches) {
        urls.push(...urlMatches);
      }
    }

    return urls;
  } catch (error) {
    console.error('Error in processFile:', error);
    throw error;
  }
}

export function normalizeHeaders(headers: string[]): string[] {
  let hasCommission = false;
  return headers
    .map((h) => {
      if (h === "佣金") {
        hasCommission = true;
        return "Commission";
      }
      return h;
    })
    .filter(
      (h, idx, arr) =>
        h !== "佣金" &&
        (h !== "Commission" || arr.indexOf("Commission") === idx),
    );
}