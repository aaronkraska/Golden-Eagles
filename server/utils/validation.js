import { z } from "zod";
// Shared field types keep stored business facts and structured model responses consistent.
const text = z.string();
const list = z.array(text);
const rating = z.number().min(0).max(10);
// Unknown scalar facts are null; multi-value facts use arrays, including empty arrays.
export const Profile = z.object({
  organization: text.nullable(),
  industry: text.nullable(),
  department: text.nullable(),
  role: text.nullable(),
  process: text.nullable(),
  painPoints: list,
  repetitiveTasks: list,
  taskVolume: text.nullable(),
  timeSpent: text.nullable(),
  systemsUsed: list,
  dataAvailable: list,
  sensitiveData: list,
  decisionMaking: text.nullable(),
  desiredOutcomes: list,
  constraints: list,
  currentAutomation: list,
});
// Derive initial values from the schema so new profile fields are initialized automatically.
export const emptyProfile = () =>
  Object.fromEntries(
    Object.entries(Profile.shape).map(([key, value]) => [
      key,
      value instanceof z.ZodArray ? [] : null,
    ]),
  );
// Each interview reply includes the whole evolving profile and the model's readiness decision.
export const InterviewResponse = z.object({
  message: text,
  profile: Profile,
  missingInformation: list,
  understandingScore: z.number().min(0).max(100),
  interviewComplete: z.boolean(),
});
// AI supplies evidence and bounded ratings; IDs, scores, and change logs are added by the app.
export const UseCase = z.object({
  title: text,
  aiRecommended: z.boolean(),
  problem: text,
  solution: text,
  whyAI: text,
  technology: list,
  benefits: list,
  businessImpact: rating,
  timeSavingPotential: rating,
  repetition: rating,
  dataReadiness: rating,
  implementationComplexity: rating,
  risk: rating,
  ratingRationale: text,
  estimatedTimeSavings: text,
  estimateBasis: text,
  assumptions: list,
  requirements: list,
  integrations: list,
  risks: list,
  mitigations: list,
  pilotRecommendation: text,
  successMetrics: list,
  implementationSteps: list,
  architecture: list,
});
export const RecommendationResponse = z.object({
  summary: text,
  useCases: z.array(UseCase).min(1).max(5),
});
// A discussion always returns a profile but may leave the selected recommendation unchanged.
export const DiscussionResponse = z.object({
  message: text,
  profile: Profile,
  updatedRecommendation: UseCase.nullable(),
  changeReason: text.nullable(),
  otherRecommendationsAffected: z.boolean(),
});
// Strict input rejects unknown keys; routes decide whether the optional message is required.
export const RequestBody = z
  .object({
    sessionId: z.string().uuid(),
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(12000).optional(),
  })
  .strict();
