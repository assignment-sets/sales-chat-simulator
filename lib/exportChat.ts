export interface ExportChatPayload {
  product_name: string;
  product_description: string;
  created_at?: string;
  messages: Array<{
    role: string;
    content: string;
    created_at?: string;
  }>;
}

function formatTimestamp(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatTimeOnly(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function exportChatAsMarkdown(data: ExportChatPayload) {
  const exportTime = formatTimestamp(new Date().toISOString());
  const chatCreatedTime = data.created_at ? formatTimestamp(data.created_at) : exportTime;

  let markdown = `# Sales Chat Simulation Transcript\n\n`;
  markdown += `- **Product / Service**: ${data.product_name}\n`;
  markdown += `- **Session Started**: ${chatCreatedTime}\n`;
  markdown += `- **Exported At**: ${exportTime}\n`;
  markdown += `- **Total Messages**: ${data.messages.length}\n\n`;

  markdown += `---\n\n`;
  markdown += `## Pitch, Pricing & Policies Context\n\n`;
  markdown += `${data.product_description.trim()}\n\n`;

  markdown += `---\n\n`;
  markdown += `## Conversation Log\n\n`;

  if (data.messages.length === 0) {
    markdown += `*(No messages recorded in this simulation session)*\n`;
  } else {
    data.messages.forEach((msg) => {
      const isRep = msg.role === "user";
      const sender = isRep ? "You (Sales Rep)" : "Potential Customer";
      const time = msg.created_at ? `[${formatTimeOnly(msg.created_at)}] ` : "";

      markdown += `### ${time}${sender}\n\n`;
      markdown += `${msg.content.trim()}\n\n`;
    });
  }

  // Create blob and trigger client download
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  
  const slug = data.product_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dateStr = new Date().toISOString().split("T")[0];

  anchor.href = url;
  anchor.download = `saleschat-${slug || "simulation"}-${dateStr}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
