import { z } from "zod";
const text = z.string();
const list = z.array(text);
const rating = z.number().min(0).max(10);
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
export const emptyProfile = () =>
  Object.fromEntries(
    Object.entries(Profile.shape).map(([key, value]) => [
      key,
      value instanceof z.ZodArray ? [] : null,
    ]),
  );
export const InterviewResponse = z.object({
  message: text,
  profile: Profile,
  missingInformation: list,
  understandingScore: z.number().min(0).max(100),
  interviewComplete: z.boolean(),
});
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
export const DiscussionResponse = z.object({
  message: text,
  profile: Profile,
  updatedRecommendation: UseCase.nullable(),
  changeReason: text.nullable(),
  otherRecommendationsAffected: z.boolean(),
});
export const RequestBody = z
  .object({
    sessionId: z.string().uuid(),
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(12000).optional(),
  })
  .strict();
