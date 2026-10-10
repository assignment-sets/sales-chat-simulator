import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("GROQ_API_KEY is not defined in environment variables");
}

export const groq = new Groq({
  apiKey,
});

export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
