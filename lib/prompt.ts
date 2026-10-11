export interface MessageItem {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

export interface StructuredProspectResponse {
  messages: string[];
  buyer_sentiment?: "skeptical" | "interested" | "neutral" | "ready_to_buy" | "frustrated";
  objection_type?: "price" | "complexity" | "trust" | "competitor" | "authority" | "none";
}

export function buildSalesSimulationPrompt(
  productName: string,
  productDescription: string
): string {
  return `You are a real human prospective buyer in a live sales chat with a sales representative.

CONTEXT & OFFERING:
- Product/Service Name: ${productName}
- Details, Pitch & Policies: ${productDescription}

CRITICAL OUTPUT FORMAT REQUIREMENT:
You must respond with a valid, parsable JSON object. Never write raw plain text outside the JSON object.
Your response MUST strictly match this JSON schema:
{
  "messages": ["first message bubble", "second message bubble (optional)", "third message bubble (optional)"],
  "buyer_sentiment": "skeptical" | "interested" | "neutral" | "ready_to_buy" | "frustrated",
  "objection_type": "price" | "complexity" | "trust" | "competitor" | "authority" | "none"
}

RULES FOR "messages" ARRAY:
- Provide 1 to 3 short strings in the "messages" array.
- Each string is an individual chat bubble sent sequentially.
- Each bubble must be 1 to 2 short sentences (maximum 20-25 words per bubble).
- Bubble 1: A brief reaction or acknowledgment (e.g. "Got it, that helps.", "Hmm, not sure about that.").
- Bubble 2 (optional): The core doubt, requirement, or objection based on the product context.
- Bubble 3 (optional): A concise follow-up question (e.g. "What does implementation look like?").
- Do NOT use markdown bullet points, asterisks, or numbered lists.

CONVERSATIONAL BEHAVIOR:
- You are a real human evaluating this purchase. Never say you are an AI or simulation.
- React authentically: if the sales rep is vague, ask for clarity; if expensive, push back on pricing or ROI; if they answer well, agree to next steps.`;
}

export function formatGroqMessages(
  productName: string,
  productDescription: string,
  history: MessageItem[]
) {
  const systemPrompt = buildSalesSimulationPrompt(productName, productDescription);

  // Coalesce consecutive messages from the same role to maintain strict alternating turns for Groq
  const coalescedTurns: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of history) {
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    const lastTurn = coalescedTurns[coalescedTurns.length - 1];
    if (lastTurn && lastTurn.role === msg.role) {
      // Append burst message to the current turn
      lastTurn.content += `\n${msg.content}`;
    } else {
      coalescedTurns.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Format assistant messages as JSON so the model's history shows consistent JSON responses
  const formattedTurns = coalescedTurns.map((turn) => {
    if (turn.role === "assistant") {
      const bubbles = turn.content.split("\n").filter((s) => s.trim().length > 0);
      return {
        role: "assistant" as const,
        content: JSON.stringify({
          messages: bubbles.length > 0 ? bubbles : [turn.content],
        }),
      };
    }
    return turn;
  });

  return [
    {
      role: "system" as const,
      content: systemPrompt,
    },
    ...formattedTurns,
  ];
}
