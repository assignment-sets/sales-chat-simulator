import { describe, it, expect } from "vitest";
import { extractBubbles } from "@/lib/prompt";
import { parseFeedbackMarkdown } from "@/lib/feedback-parser";

describe("prompt.ts (extractBubbles Parsing & Normalization)", () => {
  it("extracts bubbles from a direct string array", () => {
    const input = ["Hey there", "Can you explain pricing?"];
    expect(extractBubbles(input)).toEqual(["Hey there", "Can you explain pricing?"]);
  });

  it("extracts bubbles from an object containing 'messages'", () => {
    const input = {
      messages: ["First point", "Second point"],
      buyer_sentiment: "interested",
    };
    expect(extractBubbles(input)).toEqual(["First point", "Second point"]);
  });

  it("extracts bubbles from an object containing 'reply' or 'message'", () => {
    expect(extractBubbles({ reply: "That sounds good." })).toEqual(["That sounds good."]);
    expect(extractBubbles({ message: "Send a proposal." })).toEqual(["Send a proposal."]);
  });

  it("decodes JSON string wrapped in markdown code fences", () => {
    const jsonWithFences = "```json\n{\"messages\": [\"Fence 1\", \"Fence 2\"]}\n```";
    expect(extractBubbles(jsonWithFences)).toEqual(["Fence 1", "Fence 2"]);
  });

  it("recovers single string message via regex fallback if JSON is truncated", () => {
    const malformedJson = '{"message": "Recovered single message", "broken":}';
    const result = extractBubbles(malformedJson);
    expect(result).toEqual(["Recovered single message"]);
  });

  it("returns empty array for null, undefined, or empty string", () => {
    expect(extractBubbles(null)).toEqual([]);
    expect(extractBubbles(undefined)).toEqual([]);
    expect(extractBubbles("")).toEqual([]);
    expect(extractBubbles("   ")).toEqual([]);
  });
});

describe("feedback-parser.ts (Markdown Coaching Parser)", () => {
  const sampleMarkdown = `
### Executive Summary
The sales rep demonstrated solid product knowledge but rushed past budget qualification.

### Message-Specific Critique
- **Turn Quoted**: "Our product costs $50k upfront."
  **Issue**: Introduced high price tag before establishing value.
  **Recommended Script**: "Typically implementations range based on seat count. What is your team size?"

- **Turn Quoted**: "Do you have the budget right now?"
  **Issue**: Overly aggressive early close.
  **Recommended Script**: "How is your company currently allocating budget for sales tech?"

### Key Action Items
- Qualify budget gently using discovery questions
- Always anchor on ROI before naming contract value
- Confirm stakeholder buy-in before presenting commercials
`;

  it("parses executive summary cleanly", () => {
    const parsed = parseFeedbackMarkdown(sampleMarkdown);
    expect(parsed.summary).toContain("The sales rep demonstrated solid product knowledge");
    expect(parsed.summary).not.toContain("### Executive Summary");
  });

  it("parses individual turn critiques accurately", () => {
    const parsed = parseFeedbackMarkdown(sampleMarkdown);
    expect(parsed.turns.length).toBe(2);

    expect(parsed.turns[0].quote).toBe("Our product costs $50k upfront.");
    expect(parsed.turns[0].issue).toContain("Introduced high price tag");
    expect(parsed.turns[0].script).toContain("Typically implementations range based on seat count");

    expect(parsed.turns[1].quote).toBe("Do you have the budget right now?");
    expect(parsed.turns[1].issue).toContain("Overly aggressive early close");
  });

  it("parses key action items as clean bullet points", () => {
    const parsed = parseFeedbackMarkdown(sampleMarkdown);
    expect(parsed.actionItems).toEqual([
      "Qualify budget gently using discovery questions",
      "Always anchor on ROI before naming contract value",
      "Confirm stakeholder buy-in before presenting commercials",
    ]);
  });

  it("handles empty or non-string inputs safely without crashing", () => {
    expect(parseFeedbackMarkdown("")).toEqual({
      summary: "",
      turns: [],
      actionItems: [],
      isParsed: false,
    });
    expect(parseFeedbackMarkdown(null as any)).toEqual({
      summary: "",
      turns: [],
      actionItems: [],
      isParsed: false,
    });
  });
});
