import { GoogleGenAI } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  InterviewResponse,
  RecommendationResponse,
  DiscussionResponse,
} from "../utils/validation.js";
import { interviewer } from "../prompts/interviewer.js";
import { analyst, discussion } from "../prompts/recommendationAnalyst.js";
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const responseSchema = (schema) => {
  const { $schema, ...jsonSchema } = zodToJsonSchema(schema, { $refStrategy: "none" });
  return jsonSchema;
};
async function request(schema, name, instructions, state, analysis = false) {
  if (
    !process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
  )
    throw new AppError(
      503,
      "Gemini is not configured. Add GEMINI_API_KEY to server/.env and restart the backend.",
    );
  const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 90000 },
  });
  try {
    const response = await client.models.generateContent({
      model:
        (analysis && process.env.GEMINI_ANALYSIS_MODEL) ||
        process.env.GEMINI_MODEL ||
        "gemini-3.8-flash",
      contents: JSON.stringify(state),
      config: {
        systemInstruction: instructions,
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema(schema),
        maxOutputTokens: 14000,
      },
    });
    if (response.candidates?.[0]?.finishReason !== "STOP" || !response.text)
      throw new AppError(
        502,
        "The model returned an incomplete response or declined the request. Rephrase or retry; your saved analysis is unchanged.",
      );
    return schema.parse(JSON.parse(response.text));
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.status === 401 || error.status === 403)
      throw new AppError(
        503,
        "Gemini authentication or permission failed. Check GEMINI_API_KEY and project access on the backend.",
      );
    if (error.status === 429)
      throw new AppError(
        429,
        "Gemini rate limit or quota reached. Check API billing or wait before retrying.",
      );
    if (error.status === 400 || error.status === 404)
      throw new AppError(
        502,
        "Gemini rejected the request. Check GEMINI_API_KEY, model access, and GEMINI_MODEL in server/.env.",
      );
    if (error.name === "AbortError" || error.name === "TimeoutError" || error.status === 504)
      throw new AppError(
        504,
        "Gemini timed out. Your analysis is saved; please retry.",
      );
    if (error instanceof TypeError)
      throw new AppError(
        502,
        "Unable to reach Gemini. Check the backend network connection and retry.",
      );
    throw new AppError(
      502,
      "The AI response could not be validated or the service is unavailable. Please retry.",
    );
  }
}
export const runBusinessInterview = (state) =>
  request(InterviewResponse, "business_interview", interviewer, state);
export const generateRecommendations = (state) =>
  request(RecommendationResponse, "opportunities", analyst, state, true);
export const discussRecommendation = (state) =>
  request(DiscussionResponse, "discussion", discussion, state);
export const reanalyzeRecommendation = (state) =>
  request(
    DiscussionResponse,
    "reanalysis",
    discussion,
    { ...state, reanalyze: true },
    true,
  );
