import { TypeSafeClient, choice, score, noul } from "@typesafe-ai/sdk";
import fs from "fs";
import path from "path";

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

// Lazy initialization of TypeSafe client with dynamic environment fallback
let clientInstance: TypeSafeClient | null = null;

function getApiKey(): string | null {
  if (process.env.JEV_API_KEY) return process.env.JEV_API_KEY;
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;

  // Fallback: read .env file directly if process.env hasn't loaded it yet
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^(?:JEV_API_KEY|TYPESAFE_API_KEY)=["']?([^"'\r\n]+)["']?/m);
      if (match && match[1]) {
        process.env.JEV_API_KEY = match[1].trim();
        return process.env.JEV_API_KEY;
      }
    }
  } catch {
    // Non-fatal fallback read error
  }
  return null;
}

function getTypeSafeClient(): TypeSafeClient | null {
  const apiKey = getApiKey();
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
 * Formats message history into a clean dialogue string for Jev evaluation.
 * Windows to the most recent `maxMessages` (default 12) turns to minimize tokens
 * and focus on the current conversational status.
 */
export function formatDialogueForJev(
  history: EvaluationMessage[],
  maxMessages = 12
): string {
  const filtered = history.filter((m) => m.role === "user" || m.role === "assistant");
  const sliced = filtered.slice(-maxMessages);

  return sliced
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

  const dialogue = formatDialogueForJev(history, 12);

  try {
    const { answers } = await client.systemOne({
      state: {
        product_name: productName,
        product_offering: productDescription,
        sales_dialogue: dialogue,
      },
      questions: {
        outcome: choice(
          "In this B2B/B2C sales practice simulation, has this conversation reached a conclusive outcome?",
          {
            deal_won:
              "The customer agreed to purchase, start a trial or pilot program, sign a contract, schedule a closing call, or accepted handover to the onboarding/pilot team.",
            deal_lost:
              "The customer explicitly refused to buy, terminated the conversation, expressed severe hostility, reported/threatened legal or police action, or the sales rep used abusive profanity/threats ruining the opportunity.",
            in_progress:
              "The conversation is ongoing. The prospect has normal questions, is actively reviewing details, presenting objections to overcome, or exploring fit.",
          }
        ),
        rep_score: score(
          "Rate the sales representative's professionalism, objection handling, and pitch quality (1 to 5)",
          [
            "1: Extremely poor, offensive, hostile, abusive, or complete failure",
            "2: Struggling, missed objections, or defensive attitude",
            "3: Competent, standard polite pitch with adequate explanation",
            "4: Strong objection handling, persuasive value, and proactive closing",
            "5: Masterful salesmanship, rapport building, and seamless close",
          ]
        ),
        lead_lost: noul(
          "Has this sales opportunity fallen through, been terminated, or decisively rejected?"
        ),
      },
    });

    const choiceVal = answers.outcome.choice;
    const confidence = answers.outcome.confidence ?? 0.8;
    const repScoreIndex = answers.rep_score.score ?? 2; // 0-indexed (0 to 4)
    const normalizedScore = Math.min(Math.max(Number((repScoreIndex + 1).toFixed(1)), 1), 5); // 1-5 scale
    const leadLostProb = answers.lead_lost.noul ?? 0.0;

    let finalOutcome: "in_progress" | "deal_won" | "deal_lost" = "in_progress";

    // Loosened decision logic: decisive choice with >=0.40 confidence or high lead_lost probability
    if (choiceVal === "deal_won" && confidence >= 0.4) {
      finalOutcome = "deal_won";
    } else if (
      (choiceVal === "deal_lost" && confidence >= 0.4) ||
      leadLostProb >= 0.7
    ) {
      finalOutcome = "deal_lost";
    }

    // Single-line console log for developer visibility and monitoring
    const pWon = answers.outcome.probabilities?.deal_won?.toFixed(2) ?? "-";
    const pLost = answers.outcome.probabilities?.deal_lost?.toFixed(2) ?? "-";
    console.log(
      `[Jev Eval] Outcome: ${finalOutcome} (choice: ${choiceVal}, conf: ${confidence.toFixed(2)}, p_won: ${pWon}, p_lost: ${pLost}) | Score: ${normalizedScore} | LeadLostProb: ${leadLostProb.toFixed(2)}`
    );

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
