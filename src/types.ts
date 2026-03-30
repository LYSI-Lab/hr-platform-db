import { z } from 'zod';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST VALIDATION SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /api/jobs — create a new job offer */
export const CreateJobOfferSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  department: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required'),
  requirements: z.array(z.string()).default([]),
  mustHaveCriteria: z.array(z.string()).default([]),
  hiringManagerId: z.string().uuid().optional(),
  status: z.enum(['draft', 'open', 'closed']).default('draft'),
});

export type CreateJobOfferInput = z.infer<typeof CreateJobOfferSchema>;

/** PUT /api/jobs/[id] — update a job offer */
export const UpdateJobOfferSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  department: z.string().max(100).nullable().optional(),
  description: z.string().min(1).optional(),
  requirements: z.array(z.string()).optional(),
  mustHaveCriteria: z.array(z.string()).optional(),
  hiringManagerId: z.string().uuid().nullable().optional(),
  status: z.enum(['draft', 'open', 'closed']).optional(),
});

export type UpdateJobOfferInput = z.infer<typeof UpdateJobOfferSchema>;

/** File upload validation */
export const ResumeUploadSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: 'File size must be less than 10MB',
    })
    .refine(
      (file) =>
        [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ].includes(file.type),
      {
        message: 'Only PDF and DOCX files are accepted',
      }
    ),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI SCORING SCHEMAS (used by generateObject in Integriverse)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** AI extracts structured data from raw resume text.
 * Uses .nullable() instead of .optional() because OpenAI/Azure structured
 * output requires all properties in 'required' — nullable fields are always
 * present in the JSON but can have a null value. */
export const ParsedResumeDataSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      duration: z.string().nullable(),
      description: z.string(),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.string().nullable(),
    })
  ),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
});

export type ParsedResumeDataInput = z.infer<typeof ParsedResumeDataSchema>;

/** AI scores a resume against a job offer */
export const ResumeScoreSchema = z.object({
  overallScore: z.number().min(0).max(100),
  skillsMatchScore: z.number().min(0).max(100),
  experienceMatchScore: z.number().min(0).max(100),
  educationMatchScore: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  highlights: z.array(z.string()).max(5),
  gaps: z.array(z.string()).max(5),
  reasoning: z.string().min(1).max(1000),
  recommendation: z.enum(['strong', 'good', 'partial', 'weak']),
  mustHaveResults: z.array(
    z.object({
      criterion: z.string(),
      met: z.boolean(),
      evidence: z.string(),
    })
  ),
});

export type ResumeScoreInput = z.infer<typeof ResumeScoreSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API RESPONSE TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface JobOfferWithCounts {
  id: string;
  title: string;
  department: string | null;
  status: 'draft' | 'open' | 'closed';
  resumeCount: number;
  latestRunStatus: string | null;
  createdAt: Date;
}

export interface AnalysisStatusResponse {
  runId: string;
  status: 'queued' | 'parsing' | 'analyzing' | 'ranking' | 'completed' | 'failed';
  progress: number;
  totalResumes: number;
  processedResumes: number;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface RankedCandidateResult {
  id: string;
  rank: number | null;
  candidateName: string | null;
  candidateEmail: string | null;
  originalFileName: string;
  overallScore: number;
  skillsMatchScore: number;
  experienceMatchScore: number;
  educationMatchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  highlights: string[];
  gaps: string[];
  reasoning: string;
  recommendation: 'strong' | 'good' | 'partial' | 'weak';
  mustHavesMet: boolean;
  mustHaveResults: Array<{
    criterion: string;
    met: boolean;
    evidence: string;
  }> | null;
}

/** Webhook payload sent from HR app to Integriverse */
export interface AnalysisTriggerPayload {
  jobOfferId: string;
  resumeIds: string[];
  analysisRunId: string;
  callbackUrl?: string;
}
