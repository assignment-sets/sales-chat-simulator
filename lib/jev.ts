import { TypeSafeClient, choice, score } from "@typesafe-ai/sdk";
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
 * Returns structured classification and performance score (1-5).
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
        evaluation_context:
          "This is a sales-training SIMULATION. The Potential Customer is an AI persona that cannot actually sign or purchase, so the best achievable result is a committed next step. " +
          "Mark the deal WON when the prospect accepts any concrete next step: requests or agrees to receive a quote, proposal, pricing, or email; agrees to (or says they will) book a meeting, demo, or calendar slot; agrees to a follow-up call, trial, or pilot. " +
          "Normal buying-process hedges do NOT block a win once a next step is accepted, e.g. 'need to run it by my COO/boss', 'will review the numbers', 'will check my calendar', 'will let you know'. " +
          "If goodbyes were exchanged after a next step was accepted, the conversation is OVER, not in progress.",
        sales_dialogue: dialogue,
      },
      questions: {
        outcome: choice(
          "What is the current status of this sales conversation?",
          {
            deal_won:
              "Won: The prospect accepted a concrete next step (quote/proposal/pricing via email, meeting, demo, calendar booking, follow-up call, trial, pilot, or purchase). Still Won even if they mention internal approval, budget review, or will 'get back to you', and even if goodbyes have not been exchanged yet.",
            deal_lost:
              "Lost: The prospect explicitly refused, disengaged, rejected the offer, or the conversation ended due to hostility, profanity, or impasse with no next step.",
            in_progress:
              "In Progress: Still in discovery or objection handling. The prospect is asking questions or raising concerns and has NOT yet accepted any next step.",
          }
        ),
        rep_score: score(
          "Rate the sales representative's overall performance from 1 to 5",
          [
            "1: Poor, rude, offensive, or unprofessional",
            "2: Below average, struggled with basic objections",
            "3: Good, answered questions and maintained professionalism",
            "4: Great, effectively handled objections and demonstrated value",
            "5: Excellent, closed the deal or secured next meeting seamlessly",
          ]
        ),
      },
    });

    const choiceVal = answers.outcome.choice;
    const confidence = answers.outcome.confidence ?? 0.5;
    const probs = answers.outcome.probabilities;

    const pWon = probs?.deal_won ?? (choiceVal === "deal_won" ? confidence : 0.0);
    const pLost = probs?.deal_lost ?? (choiceVal === "deal_lost" ? confidence : 0.0);
    const pProg = probs?.in_progress ?? (choiceVal === "in_progress" ? confidence : 0.0);

    let finalOutcome: "in_progress" | "deal_won" | "deal_lost" = "in_progress";

    // Decisive resolution: inspect both choice and highest probability
    if (choiceVal === "deal_won" || (pWon > pProg && pWon >= 0.35)) {
      finalOutcome = "deal_won";
    } else if (choiceVal === "deal_lost" || (pLost > pProg && pLost >= 0.35) || pLost >= 0.6) {
      finalOutcome = "deal_lost";
    }

    const repScoreIndex = answers.rep_score?.score ?? 2; // 0-indexed (0 to 4)
    let normalizedScore = Math.min(Math.max(Number((repScoreIndex + 1).toFixed(1)), 1), 5);

    // If deal is closed successfully, guarantee at least an above-average score
    if (finalOutcome === "deal_won" && normalizedScore < 3.5) {
      normalizedScore = 4.0;
    }

    console.log(
      `[Jev Eval] Outcome: ${finalOutcome} (choice: ${choiceVal}, conf: ${confidence.toFixed(2)}, p_won: ${pWon.toFixed(2)}, p_lost: ${pLost.toFixed(2)}, p_prog: ${pProg.toFixed(2)}) | Score: ${normalizedScore}`
    );

    return {
      outcome: finalOutcome,
      confidence,
      score: normalizedScore,
      leadLostProbability: pLost,
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
