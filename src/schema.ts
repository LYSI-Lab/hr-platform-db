import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  uuid,
  text,
  boolean,
  integer,
  index,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER TABLE REFERENCE (from Integriverse — needed for FK relationships)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Minimal user table reference for foreign key constraints.
 * The full User table is owned by Integriverse — this only defines
 * enough for Drizzle to create valid FK references.
 */
export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  clerk_id: text('clerk_id').unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESUME ANALYSIS & CANDIDATE SELECTION MODULE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ---------- Enums ----------

export const jobOfferStatusEnum = pgEnum('job_offer_status', [
  'draft', 'open', 'closed',
]);

export const resumeStatusEnum = pgEnum('resume_status', [
  'uploaded', 'parsing', 'parsed', 'analyzing', 'scored', 'error',
]);

export const analysisJobStatusEnum = pgEnum('analysis_job_status', [
  'queued', 'parsing', 'analyzing', 'ranking', 'completed', 'failed',
]);

export const candidateRecommendationEnum = pgEnum('candidate_recommendation', [
  'strong', 'good', 'partial', 'weak',
]);

// ---------- Types for JSONB columns ----------

export interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    duration?: string;
    description: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year?: string;
  }>;
  certifications: string[];
  languages: string[];
}

export interface MustHaveResult {
  criterion: string;
  met: boolean;
  evidence: string;
}

// ---------- Tables ----------

/**
 * Job Offers — role definitions that resumes are matched against.
 * Scoped to user (personal) or organization (shared).
 */
export const jobOffers = pgTable('job_offers', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id'), // null = personal, 'org_xxx' = organization
  title: varchar('title', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }),
  description: text('description').notNull(),
  requirements: text('requirements').array().notNull().default([]),
  mustHaveCriteria: text('must_have_criteria').array().notNull().default([]),
  hiringManagerId: uuid('hiring_manager_id'),
  status: jobOfferStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
}, (table) => ({
  userIdIdx: index('job_offers_user_id_idx').on(table.userId),
  orgIdIdx: index('job_offers_org_id_idx').on(table.organizationId),
  statusIdx: index('job_offers_status_idx').on(table.status),
  createdAtIdx: index('job_offers_created_at_idx').on(table.createdAt),
}));

export type JobOffer = InferSelectModel<typeof jobOffers>;

/**
 * Resumes — uploaded candidate files linked to a specific job offer.
 * Status tracks the processing pipeline: uploaded → parsing → parsed → analyzing → scored.
 */
export const jobResumes = pgTable('job_resumes', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  jobOfferId: uuid('job_offer_id').notNull().references(() => jobOffers.id, { onDelete: 'cascade' }),
  candidateName: varchar('candidate_name', { length: 255 }),
  candidateEmail: varchar('candidate_email', { length: 255 }),
  originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
  fileStorageUrl: text('file_storage_url').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(), // bytes
  rawText: text('raw_text'),
  parsedData: jsonb('parsed_data').$type<ParsedResumeData>(),
  status: resumeStatusEnum('status').notNull().default('uploaded'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  jobOfferIdIdx: index('job_resumes_job_offer_id_idx').on(table.jobOfferId),
  statusIdx: index('job_resumes_status_idx').on(table.status),
  candidateEmailIdx: index('job_resumes_candidate_email_idx').on(table.candidateEmail),
}));

export type JobResume = InferSelectModel<typeof jobResumes>;

/**
 * Analysis Results — AI-generated scores and reasoning per resume per job.
 * Unique constraint on (job_offer_id, resume_id) enables UPSERT on re-analysis.
 */
export const jobAnalysisResults = pgTable('job_analysis_results', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  jobOfferId: uuid('job_offer_id').notNull().references(() => jobOffers.id, { onDelete: 'cascade' }),
  resumeId: uuid('resume_id').notNull().references(() => jobResumes.id, { onDelete: 'cascade' }),
  analysisRunId: uuid('analysis_run_id'),
  overallScore: integer('overall_score').notNull(), // 0-100
  skillsMatchScore: integer('skills_match_score').notNull(), // 0-100
  experienceMatchScore: integer('experience_match_score').notNull(), // 0-100
  educationMatchScore: integer('education_match_score').notNull(), // 0-100
  matchedSkills: text('matched_skills').array().notNull().default([]),
  missingSkills: text('missing_skills').array().notNull().default([]),
  highlights: text('highlights').array().notNull().default([]),
  gaps: text('gaps').array().notNull().default([]),
  reasoning: text('reasoning').notNull(),
  recommendation: candidateRecommendationEnum('recommendation').notNull(),
  rank: integer('rank'),
  mustHavesMet: boolean('must_haves_met').notNull().default(false),
  mustHaveResults: jsonb('must_have_results').$type<MustHaveResult[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  jobOfferIdIdx: index('jar_job_offer_id_idx').on(table.jobOfferId),
  resumeIdIdx: index('jar_resume_id_idx').on(table.resumeId),
  overallScoreIdx: index('jar_overall_score_idx').on(table.overallScore),
  recommendationIdx: index('jar_recommendation_idx').on(table.recommendation),
  rankIdx: index('jar_rank_idx').on(table.rank),
  jobResumeUnique: unique('jar_job_resume_unique').on(table.jobOfferId, table.resumeId),
}));

export type JobAnalysisResult = InferSelectModel<typeof jobAnalysisResults>;

/**
 * Analysis Runs — tracks each background pipeline execution.
 * Analogous to workflowExecutions in Integriverse.
 * Progress tracking enables real-time progress bar in the UI.
 */
export const jobAnalysisRuns = pgTable('job_analysis_runs', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  jobOfferId: uuid('job_offer_id').notNull().references(() => jobOffers.id, { onDelete: 'cascade' }),
  resumeIds: uuid('resume_ids').array().notNull(),
  status: analysisJobStatusEnum('status').notNull().default('queued'),
  progress: integer('progress').notNull().default(0), // 0-100
  totalResumes: integer('total_resumes').notNull(),
  processedResumes: integer('processed_resumes').notNull().default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  upstashRunId: varchar('upstash_run_id', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  jobOfferIdIdx: index('jar_runs_job_offer_id_idx').on(table.jobOfferId),
  statusIdx: index('jar_runs_status_idx').on(table.status),
  createdAtIdx: index('jar_runs_created_at_idx').on(table.createdAt),
}));

export type JobAnalysisRun = InferSelectModel<typeof jobAnalysisRuns>;
