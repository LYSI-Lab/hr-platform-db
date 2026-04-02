// Database connection
export { db, pgClient } from './db';

// Schema (tables, enums, types)
export {
  // Tables
  user,
  jobOffers,
  jobResumes,
  jobAnalysisResults,
  jobAnalysisRuns,
  candidateInvites,
  // Enums
  jobOfferStatusEnum,
  resumeStatusEnum,
  analysisJobStatusEnum,
  candidateRecommendationEnum,
  inviteTypeEnum,
  // Table types
  type User,
  type JobOffer,
  type JobResume,
  type JobAnalysisResult,
  type JobAnalysisRun,
  type CandidateInvite,
  // JSONB types
  type ParsedResumeData,
  type MustHaveResult,
} from './schema';

// Query functions
export * from './queries';

// Zod schemas and API types
export {
  CreateJobOfferSchema,
  UpdateJobOfferSchema,
  ResumeUploadSchema,
  ParsedResumeDataSchema,
  ResumeScoreSchema,
  type CreateJobOfferInput,
  type UpdateJobOfferInput,
  type ParsedResumeDataInput,
  type ResumeScoreInput,
  type JobOfferWithCounts,
  type AnalysisStatusResponse,
  type RankedCandidateResult,
  type AnalysisTriggerPayload,
  type SendInvitesPayload,
} from './types';
