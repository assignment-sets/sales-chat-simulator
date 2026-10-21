export interface ParsedTurn {
  turnIndex: number;
  quote: string;
  issue: string;
  script: string;
}

export interface ParsedFeedback {
  summary: string;
  turns: ParsedTurn[];
  actionItems: string[];
  isParsed: boolean;
}

/**
 * Robust parser to extract structured coaching components from raw Markdown.
 * Operates safely with fallback defaults if formatting is partially streamed or altered.
 */
export function parseFeedbackMarkdown(raw: string): ParsedFeedback {
  if (!raw || typeof raw !== "string") {
    return { summary: "", turns: [], actionItems: [], isParsed: false };
  }

  let summary = "";
  const turns: ParsedTurn[] = [];
  const actionItems: string[] = [];

  // 1. Extract Executive Summary
  const summaryPart = raw.split(/### Message-Specific Critique/i)[0];
  if (summaryPart) {
    summary = summaryPart
      .replace(/### Executive Summary/i, "")
      .trim();
  }

  // 2. Extract Action Items (Takeaways)
  const actionsPart = raw.split(/### Key Action Items/i)[1];
  if (actionsPart) {
    const lines = actionsPart.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        actionItems.push(trimmed.substring(2).trim());
      } else if (/^\d+\.\s/.test(trimmed)) {
        actionItems.push(trimmed.replace(/^\d+\.\s*/, "").trim());
      }
    }
  }

  // 3. Extract Message-Specific Turns
  const critiquePart = raw
    .split(/### Message-Specific Critique/i)[1]
    ?.split(/### Key Action Items/i)[0];

  if (critiquePart) {
    // Split turns starting with "- **Turn Quoted**" or "- **Turn" or "- **Quoted"
    const turnBlocks = critiquePart
      .split(/(?:^|\n)[-*]\s+\*\*(?:Turn\s+)?Quoted(?:\*\*)?:?\s*/i)
      .slice(1);

    turnBlocks.forEach((block, idx) => {
      const lines = block.split("\n");
      // The first line after "Turn Quoted:" contains the quote
      const quote = (lines[0] || "").trim().replace(/^["“]|["”]$/g, "");

      let issue = "";
      let script = "";

      const issueMatch = block.match(/[-*]?\s*\*\*Issue\*\*:\s*([^\n\r]+)/i);
      if (issueMatch) {
        issue = issueMatch[1].trim();
      }

      const scriptMatch = block.match(
        /[-*]?\s*\*\*Recommended Script\*\*:\s*([^\n\r]+)/i
      );
      if (scriptMatch) {
        script = scriptMatch[1].trim().replace(/^["“]|["”]$/g, "");
      }

      if (quote || issue || script) {
        turns.push({
          turnIndex: idx + 1,
          quote,
          issue,
          script,
        });
      }
    });
  }

  // Considered parsed if we successfully extracted at least one key section
  const isParsed = turns.length > 0 || (summary.length > 0 && actionItems.length > 0);

  return {
    summary,
    turns,
    actionItems,
    isParsed,
  };
}
