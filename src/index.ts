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
  // Enums
  jobOfferStatusEnum,
  resumeStatusEnum,
  analysisJobStatusEnum,
  candidateRecommendationEnum,
  // Table types
  type User,
  type JobOffer,
  type JobResume,
  type JobAnalysisResult,
  type JobAnalysisRun,
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
} from './types';
