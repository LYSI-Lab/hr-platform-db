import { eq, and, desc, sql, count, ne, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  jobOffers,
  jobResumes,
  jobAnalysisResults,
  jobAnalysisRuns,
  candidateInvites,
  type JobOffer,
  type JobResume,
  type JobAnalysisResult,
  type JobAnalysisRun,
  type CandidateInvite,
  type ParsedResumeData,
} from '../schema';
import type { Actor } from './permissions';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB OFFERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createJobOffer(data: {
  userId: string;
  organizationId?: string | null;
  title: string;
  department?: string;
  description: string;
  requirements?: string[];
  mustHaveCriteria?: string[];
  hiringManagerId?: string;
  status?: 'draft' | 'open' | 'closed';
}): Promise<JobOffer> {
  const [job] = await db
    .insert(jobOffers)
    .values({
      userId: data.userId,
      organizationId: data.organizationId ?? null,
      title: data.title,
      department: data.department,
      description: data.description,
      requirements: data.requirements ?? [],
      mustHaveCriteria: data.mustHaveCriteria ?? [],
      hiringManagerId: data.hiringManagerId,
      status: data.status ?? 'draft',
    })
    .returning();

  return job;
}

export async function getJobOffersByUser(params: {
  userId: string;
  organizationId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<JobOffer[]> {
  const { userId, organizationId, limit = 50, offset = 0 } = params;

  const conditions = [eq(jobOffers.userId, userId)];

  if (organizationId !== undefined) {
    if (organizationId === null) {
      conditions.push(sql`${jobOffers.organizationId} IS NULL`);
    } else {
      conditions.push(eq(jobOffers.organizationId, organizationId));
    }
  }

  return db
    .select()
    .from(jobOffers)
    .where(and(...conditions))
    .orderBy(desc(jobOffers.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * List job offers visible to the actor in their active workspace.
 *
 * Workspaces are exclusive: personal mode returns only the actor's personal
 * jobs (organization is null), organization mode returns only jobs belonging
 * to the active organization. Personal jobs never bleed into an organization
 * view and vice versa, which mirrors how teams expect Slack-style workspaces
 * to behave. Ordered by newest first.
 */
export async function getJobOffersForActor(params: {
  actor: Actor;
  limit?: number;
  offset?: number;
}): Promise<JobOffer[]> {
  const { actor, limit = 50, offset = 0 } = params;

  const inPersonalMode = actor.clerkOrgIds.length === 0;

  const where = inPersonalMode
    ? and(sql`${jobOffers.organizationId} IS NULL`, eq(jobOffers.userId, actor.userId))
    : inArray(jobOffers.organizationId, [...actor.clerkOrgIds]);

  return db
    .select()
    .from(jobOffers)
    .where(where)
    .orderBy(desc(jobOffers.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getJobOfferById(id: string): Promise<JobOffer | null> {
  const [job] = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.id, id))
    .limit(1);

  return job ?? null;
}

export async function updateJobOffer(
  id: string,
  data: Partial<{
    title: string;
    department: string | null;
    description: string;
    requirements: string[];
    mustHaveCriteria: string[];
    hiringManagerId: string | null;
    status: 'draft' | 'open' | 'closed';
  }>
): Promise<JobOffer | null> {
  const [updated] = await db
    .update(jobOffers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(jobOffers.id, id))
    .returning();

  return updated ?? null;
}

export async function deleteJobOffer(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(jobOffers)
    .where(eq(jobOffers.id, id))
    .returning({ id: jobOffers.id });

  return !!deleted;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESUMES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createJobResume(data: {
  jobOfferId: string;
  uploadedByUserId?: string;
  originalFileName: string;
  fileStorageUrl: string;
  mimeType: string;
  fileSize: number;
}): Promise<JobResume> {
  const [resume] = await db
    .insert(jobResumes)
    .values(data)
    .returning();

  return resume;
}

export async function getResumesByJobId(jobOfferId: string): Promise<JobResume[]> {
  return db
    .select()
    .from(jobResumes)
    .where(eq(jobResumes.jobOfferId, jobOfferId))
    .orderBy(desc(jobResumes.createdAt));
}

export async function getResumeById(id: string): Promise<JobResume | null> {
  const [resume] = await db
    .select()
    .from(jobResumes)
    .where(eq(jobResumes.id, id))
    .limit(1);

  return resume ?? null;
}

export async function updateResumeStatus(
  id: string,
  status: 'uploaded' | 'parsing' | 'parsed' | 'analyzing' | 'scored' | 'error',
  errorMessage?: string
): Promise<void> {
  await db
    .update(jobResumes)
    .set({ status, errorMessage: errorMessage ?? null })
    .where(eq(jobResumes.id, id));
}

export async function updateResumeParsedData(
  id: string,
  data: {
    rawText: string;
    parsedData: ParsedResumeData;
    candidateName?: string;
    candidateEmail?: string;
  }
): Promise<void> {
  await db
    .update(jobResumes)
    .set({
      rawText: data.rawText,
      parsedData: data.parsedData,
      candidateName: data.candidateName ?? null,
      candidateEmail: data.candidateEmail ?? null,
      status: 'parsed',
    })
    .where(eq(jobResumes.id, id));
}

export async function deleteResume(id: string): Promise<JobResume | null> {
  const [deleted] = await db
    .delete(jobResumes)
    .where(eq(jobResumes.id, id))
    .returning();

  return deleted ?? null;
}

export async function countResumesByJobId(jobOfferId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(jobResumes)
    .where(eq(jobResumes.jobOfferId, jobOfferId));

  return result?.total ?? 0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYSIS RESULTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function upsertAnalysisResult(data: {
  jobOfferId: string;
  resumeId: string;
  analysisRunId?: string;
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
  mustHaveResults: Array<{ criterion: string; met: boolean; evidence: string }>;
}): Promise<JobAnalysisResult> {
  const [result] = await db
    .insert(jobAnalysisResults)
    .values(data)
    .onConflictDoUpdate({
      target: [jobAnalysisResults.jobOfferId, jobAnalysisResults.resumeId],
      set: {
        analysisRunId: data.analysisRunId,
        overallScore: data.overallScore,
        skillsMatchScore: data.skillsMatchScore,
        experienceMatchScore: data.experienceMatchScore,
        educationMatchScore: data.educationMatchScore,
        matchedSkills: data.matchedSkills,
        missingSkills: data.missingSkills,
        highlights: data.highlights,
        gaps: data.gaps,
        reasoning: data.reasoning,
        recommendation: data.recommendation,
        mustHavesMet: data.mustHavesMet,
        mustHaveResults: data.mustHaveResults,
        createdAt: new Date(),
      },
    })
    .returning();

  return result;
}

export async function getAnalysisResultsByJob(
  jobOfferId: string,
  sortBy: 'rank' | 'score' = 'rank'
): Promise<(JobAnalysisResult & { candidateName: string | null; candidateEmail: string | null; originalFileName: string })[]> {
  const orderCol = sortBy === 'rank' ? jobAnalysisResults.rank : jobAnalysisResults.overallScore;
  const orderDir = sortBy === 'rank' ? jobAnalysisResults.rank : desc(jobAnalysisResults.overallScore);

  return db
    .select({
      id: jobAnalysisResults.id,
      jobOfferId: jobAnalysisResults.jobOfferId,
      resumeId: jobAnalysisResults.resumeId,
      analysisRunId: jobAnalysisResults.analysisRunId,
      overallScore: jobAnalysisResults.overallScore,
      skillsMatchScore: jobAnalysisResults.skillsMatchScore,
      experienceMatchScore: jobAnalysisResults.experienceMatchScore,
      educationMatchScore: jobAnalysisResults.educationMatchScore,
      matchedSkills: jobAnalysisResults.matchedSkills,
      missingSkills: jobAnalysisResults.missingSkills,
      highlights: jobAnalysisResults.highlights,
      gaps: jobAnalysisResults.gaps,
      reasoning: jobAnalysisResults.reasoning,
      recommendation: jobAnalysisResults.recommendation,
      rank: jobAnalysisResults.rank,
      mustHavesMet: jobAnalysisResults.mustHavesMet,
      mustHaveResults: jobAnalysisResults.mustHaveResults,
      createdAt: jobAnalysisResults.createdAt,
      // Joined from resumes
      candidateName: jobResumes.candidateName,
      candidateEmail: jobResumes.candidateEmail,
      originalFileName: jobResumes.originalFileName,
    })
    .from(jobAnalysisResults)
    .innerJoin(jobResumes, eq(jobAnalysisResults.resumeId, jobResumes.id))
    .where(eq(jobAnalysisResults.jobOfferId, jobOfferId))
    .orderBy(orderDir);
}

export async function getAnalysisResultById(id: string): Promise<
  (JobAnalysisResult & { candidateName: string | null; candidateEmail: string | null; originalFileName: string; fileStorageUrl: string }) | null
> {
  const [result] = await db
    .select({
      id: jobAnalysisResults.id,
      jobOfferId: jobAnalysisResults.jobOfferId,
      resumeId: jobAnalysisResults.resumeId,
      analysisRunId: jobAnalysisResults.analysisRunId,
      overallScore: jobAnalysisResults.overallScore,
      skillsMatchScore: jobAnalysisResults.skillsMatchScore,
      experienceMatchScore: jobAnalysisResults.experienceMatchScore,
      educationMatchScore: jobAnalysisResults.educationMatchScore,
      matchedSkills: jobAnalysisResults.matchedSkills,
      missingSkills: jobAnalysisResults.missingSkills,
      highlights: jobAnalysisResults.highlights,
      gaps: jobAnalysisResults.gaps,
      reasoning: jobAnalysisResults.reasoning,
      recommendation: jobAnalysisResults.recommendation,
      rank: jobAnalysisResults.rank,
      mustHavesMet: jobAnalysisResults.mustHavesMet,
      mustHaveResults: jobAnalysisResults.mustHaveResults,
      createdAt: jobAnalysisResults.createdAt,
      candidateName: jobResumes.candidateName,
      candidateEmail: jobResumes.candidateEmail,
      originalFileName: jobResumes.originalFileName,
      fileStorageUrl: jobResumes.fileStorageUrl,
    })
    .from(jobAnalysisResults)
    .innerJoin(jobResumes, eq(jobAnalysisResults.resumeId, jobResumes.id))
    .where(eq(jobAnalysisResults.id, id))
    .limit(1);

  return result ?? null;
}

export async function updateResultRanks(
  jobOfferId: string,
  rankedIds: string[]
): Promise<void> {
  // Update ranks in a single transaction-safe batch
  for (let i = 0; i < rankedIds.length; i++) {
    await db
      .update(jobAnalysisResults)
      .set({ rank: i + 1 })
      .where(
        and(
          eq(jobAnalysisResults.id, rankedIds[i]),
          eq(jobAnalysisResults.jobOfferId, jobOfferId)
        )
      );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYSIS RUNS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createAnalysisRun(data: {
  jobOfferId: string;
  resumeIds: string[];
  totalResumes: number;
}): Promise<JobAnalysisRun> {
  const [run] = await db
    .insert(jobAnalysisRuns)
    .values({
      jobOfferId: data.jobOfferId,
      resumeIds: data.resumeIds,
      totalResumes: data.totalResumes,
      status: 'queued',
      progress: 0,
      processedResumes: 0,
    })
    .returning();

  return run;
}

/**
 * Find an active (non-terminal) analysis run for a job.
 * Used for idempotency — prevents duplicate runs.
 */
export async function getActiveAnalysisRun(
  jobOfferId: string
): Promise<JobAnalysisRun | null> {
  const [run] = await db
    .select()
    .from(jobAnalysisRuns)
    .where(
      and(
        eq(jobAnalysisRuns.jobOfferId, jobOfferId),
        ne(jobAnalysisRuns.status, 'completed'),
        ne(jobAnalysisRuns.status, 'failed')
      )
    )
    .orderBy(desc(jobAnalysisRuns.createdAt))
    .limit(1);

  return run ?? null;
}

export async function getLatestAnalysisRun(
  jobOfferId: string
): Promise<JobAnalysisRun | null> {
  const [run] = await db
    .select()
    .from(jobAnalysisRuns)
    .where(eq(jobAnalysisRuns.jobOfferId, jobOfferId))
    .orderBy(desc(jobAnalysisRuns.createdAt))
    .limit(1);

  return run ?? null;
}

export async function getAnalysisRunById(id: string): Promise<JobAnalysisRun | null> {
  const [run] = await db
    .select()
    .from(jobAnalysisRuns)
    .where(eq(jobAnalysisRuns.id, id))
    .limit(1);

  return run ?? null;
}

export async function updateAnalysisRunProgress(
  id: string,
  data: {
    processedResumes: number;
    progress: number;
    status?: 'queued' | 'parsing' | 'analyzing' | 'ranking' | 'completed' | 'failed';
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    processedResumes: data.processedResumes,
    progress: data.progress,
  };

  if (data.status) {
    updateData.status = data.status;
  }

  // Set startedAt on first progress update
  if (data.processedResumes === 0 && data.status && data.status !== 'queued') {
    updateData.startedAt = new Date();
  }

  await db
    .update(jobAnalysisRuns)
    .set(updateData)
    .where(eq(jobAnalysisRuns.id, id));
}

export async function completeAnalysisRun(
  id: string,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  await db
    .update(jobAnalysisRuns)
    .set({
      status,
      progress: status === 'completed' ? 100 : undefined,
      completedAt: new Date(),
      errorMessage: errorMessage ?? null,
    })
    .where(eq(jobAnalysisRuns.id, id));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CANDIDATE INVITES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createCandidateInvite(data: {
  jobOfferId: string;
  analysisResultId: string;
  candidateEmail: string;
  candidateName?: string;
  type: 'new' | 'resend';
  subject: string;
  body: string;
  companyName?: string;
  interviewDate?: string;
  interviewLink?: string;
  slotDate?: string;
  slotStartTime?: string;
  slotEndTime?: string;
  meetLink?: string;
  calendarEventId?: string;
  status?: 'sent' | 'failed';
  errorMessage?: string;
}): Promise<CandidateInvite> {
  const [invite] = await db
    .insert(candidateInvites)
    .values({
      jobOfferId: data.jobOfferId,
      analysisResultId: data.analysisResultId,
      candidateEmail: data.candidateEmail,
      candidateName: data.candidateName ?? null,
      type: data.type,
      subject: data.subject,
      body: data.body,
      companyName: data.companyName ?? null,
      interviewDate: data.interviewDate ?? null,
      interviewLink: data.interviewLink ?? null,
      slotDate: data.slotDate ?? null,
      slotStartTime: data.slotStartTime ?? null,
      slotEndTime: data.slotEndTime ?? null,
      meetLink: data.meetLink ?? null,
      calendarEventId: data.calendarEventId ?? null,
      status: data.status ?? 'sent',
      errorMessage: data.errorMessage ?? null,
    })
    .returning();

  return invite;
}

export async function getInvitesByJobId(jobOfferId: string): Promise<CandidateInvite[]> {
  return db
    .select()
    .from(candidateInvites)
    .where(eq(candidateInvites.jobOfferId, jobOfferId))
    .orderBy(desc(candidateInvites.sentAt));
}

export async function getInvitesByResultId(analysisResultId: string): Promise<CandidateInvite[]> {
  return db
    .select()
    .from(candidateInvites)
    .where(eq(candidateInvites.analysisResultId, analysisResultId))
    .orderBy(desc(candidateInvites.sentAt));
}

export async function getLatestInvitePerCandidate(
  jobOfferId: string
): Promise<Map<string, CandidateInvite>> {
  const invites = await db
    .select()
    .from(candidateInvites)
    .where(eq(candidateInvites.jobOfferId, jobOfferId))
    .orderBy(desc(candidateInvites.sentAt));

  // Keep only the most recent invite per analysisResultId
  const map = new Map<string, CandidateInvite>();
  for (const invite of invites) {
    if (!map.has(invite.analysisResultId)) {
      map.set(invite.analysisResultId, invite);
    }
  }
  return map;
}
