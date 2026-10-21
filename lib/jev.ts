import { TypeSafeClient, choice, score, noul } from "@typesafe-ai/sdk";

export interface EvaluationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SimulationEvaluationResult {
  outcome: "in_progress" | "deal_won" | "deal_lost";
  confidence: number;
  score: number; // 1 to 5 scale
  leadLostProbability: number;
  decisionReason?: string;
}

// Lazy initialization of TypeSafe client
let clientInstance: TypeSafeClient | null = null;

function getTypeSafeClient(): TypeSafeClient | null {
  const apiKey = process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = new TypeSafeClient({
      apiKey,
      timeout: 8000, // 8-second timeout per attempt
    });
  }
  return clientInstance;
}

/**
 * Formats full message history into a clean dialogue string for Jev evaluation.
 * Omits timestamps to save tokens and focus purely on conversational semantics.
 */
export function formatDialogueForJev(history: EvaluationMessage[]): string {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const speaker = m.role === "user" ? "Sales Rep" : "Potential Customer";
      return `${speaker}: ${m.content.trim()}`;
    })
    .join("\n\n");
}

/**
 * Evaluates the current state of a sales simulation turn using TypeSafe AI's Jev model.
 * Returns structured classification, performance score (1-5), and rejection probability.
 */
export async function evaluateSimulationTurn(params: {
  productName: string;
  productDescription: string;
  history: EvaluationMessage[];
}): Promise<SimulationEvaluationResult> {
  const { productName, productDescription, history } = params;

  // Need at least 1 turn each from user and prospect to evaluate meaningful outcomes
  const hasUserMsg = history.some((m) => m.role === "user");
  const hasAssistantMsg = history.some((m) => m.role === "assistant");

  if (!hasUserMsg || !hasAssistantMsg) {
    return {
      outcome: "in_progress",
      confidence: 1.0,
      score: 3,
      leadLostProbability: 0.0,
    };
  }

  const client = getTypeSafeClient();
  if (!client) {
    console.warn("[Jev] JEV_API_KEY not configured. Skipping automated evaluation.");
    return {
      outcome: "in_progress",
      confidence: 1.0,
      score: 3,
      leadLostProbability: 0.0,
    };
  }

  const dialogue = formatDialogueForJev(history);

  try {
    const { answers } = await client.systemOne({
      state: {
        product_name: productName,
        product_offering: productDescription,
        sales_dialogue: dialogue,
      },
      questions: {
        outcome: choice("Has this sales conversation reached a conclusive outcome?", {
          in_progress: "The conversation is ongoing. The prospect is still asking questions, considering, or evaluating.",
          deal_won: "The prospect explicitly agrees to buy, start a pilot, schedule a demo, or move forward with the purchase.",
          deal_lost: "The prospect decisively refuses, terminates contact, or states clearly they will not purchase.",
        }),
        rep_score: score("Rate the sales representative's objection handling and value proposition so far", [
          "Extremely poor or abrasive",
          "Struggling, failed to answer core doubts",
          "Competent and polite",
          "Persuasive, handles objections well",
          "Masterful closing and value communication",
        ]),
        lead_lost: noul("Has the customer decisively walked away or rejected the sales rep with no intent to proceed?"),
      },
    });

    const choiceVal = answers.outcome.choice;
    const confidence = answers.outcome.confidence ?? 0.8;
    const repScoreIndex = answers.rep_score.score ?? 2; // 0-indexed (0 to 4)
    const normalizedScore = Math.min(Math.max(repScoreIndex + 1, 1), 5); // 1-5 scale
    const leadLostProb = answers.lead_lost.noul ?? 0.0;

    let finalOutcome: "in_progress" | "deal_won" | "deal_lost" = "in_progress";

    if (choiceVal === "deal_won" && confidence >= 0.65) {
      finalOutcome = "deal_won";
    } else if (
      (choiceVal === "deal_lost" && confidence >= 0.65) ||
      leadLostProb >= 0.85
    ) {
      finalOutcome = "deal_lost";
    }

    return {
      outcome: finalOutcome,
      confidence,
      score: normalizedScore,
      leadLostProbability: leadLostProb,
    };
  } catch (err) {
    console.warn("[Jev] Evaluation request error (proceeding with in_progress):", err);
    return {
      outcome: "in_progress",
      confidence: 0.5,
      score: 3,
      leadLostProbability: 0.0,
    };
  }
}
