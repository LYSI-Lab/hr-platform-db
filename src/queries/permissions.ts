import { eq } from 'drizzle-orm';
import { db } from '../db';
import { jobOffers, jobResumes, type JobOffer, type JobResume } from '../schema';

/**
 * Authorization context for a permission check.
 *
 * Populated by the calling service from the Clerk session before dispatching
 * a request, so this package stays free of Clerk SDK dependencies.
 */
export interface Actor {
  /** Internal database user id (uuid, not Clerk id). */
  userId: string;
  /** Clerk organization ids the actor currently belongs to. */
  clerkOrgIds: readonly string[];
  /** Subset of {@link clerkOrgIds} where the actor has the `admin` role. */
  adminClerkOrgIds: readonly string[];
}

/** Permission flags for a specific job, computed without additional queries. */
export interface JobPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canUpload: boolean;
  canAnalyze: boolean;
}

/** Permission flags for a specific resume, computed without additional queries. */
export interface ResumePermissions {
  canDelete: boolean;
}

function isAdminOfJobOrg(actor: Actor, job: JobOffer): boolean {
  return job.organizationId !== null && actor.adminClerkOrgIds.includes(job.organizationId);
}

function isJobCreator(actor: Actor, job: JobOffer): boolean {
  return job.userId === actor.userId;
}

/**
 * True when the job belongs to the actor's active workspace.
 *
 * Workspaces are exclusive: a personal job is only visible in personal mode,
 * and an organization job is only visible while that organization is active.
 * This prevents cross-workspace bleed when a user has both personal jobs
 * and organization memberships.
 */
function isJobInActiveWorkspace(actor: Actor, job: JobOffer): boolean {
  const inPersonalMode = actor.clerkOrgIds.length === 0;

  if (inPersonalMode) {
    return job.organizationId === null && isJobCreator(actor, job);
  }

  return job.organizationId !== null && actor.clerkOrgIds.includes(job.organizationId);
}

async function loadJob(jobId: string): Promise<JobOffer | null> {
  const [job] = await db.select().from(jobOffers).where(eq(jobOffers.id, jobId)).limit(1);
  return job ?? null;
}

/**
 * Compute every permission for a job in one pass, given the pre-loaded row.
 *
 * Useful for list endpoints where the caller already holds the job and wants
 * to avoid N extra database round-trips.
 */
export function computeJobPermissions(actor: Actor, job: JobOffer): JobPermissions {
  const visible = isJobInActiveWorkspace(actor, job);
  const creator = isJobCreator(actor, job);
  const admin = isAdminOfJobOrg(actor, job);

  return {
    canView: visible,
    canEdit: visible && creator,
    canDelete: visible && (creator || admin),
    canInvite: visible && creator,
    canUpload: visible,
    canAnalyze: visible,
  };
}

/**
 * Compute resume-level permissions given the pre-loaded resume and parent job.
 */
export function computeResumePermissions(
  actor: Actor,
  resume: JobResume,
  job: JobOffer,
): ResumePermissions {
  if (resume.uploadedByUserId === actor.userId) return { canDelete: true };
  return { canDelete: computeJobPermissions(actor, job).canDelete };
}

/**
 * True if the actor can view a job and its resumes.
 *
 * Creators always have access. For org-scoped jobs, any member of the owning
 * organization has access. Personal (unassigned) jobs are creator-only.
 */
export async function canViewJob(actor: Actor, jobId: string): Promise<boolean> {
  const job = await loadJob(jobId);
  if (!job) return false;
  return computeJobPermissions(actor, job).canView;
}

/** True if the actor can edit a job's details. Restricted to the creator. */
export async function canEditJob(actor: Actor, jobId: string): Promise<boolean> {
  const job = await loadJob(jobId);
  if (!job) return false;
  return computeJobPermissions(actor, job).canEdit;
}

/**
 * True if the actor can delete a job.
 *
 * The creator can always delete. For org-scoped jobs, organization admins
 * can also delete so teams can clean up after a member leaves.
 */
export async function canDeleteJob(actor: Actor, jobId: string): Promise<boolean> {
  const job = await loadJob(jobId);
  if (!job) return false;
  return computeJobPermissions(actor, job).canDelete;
}

/**
 * True if the actor can send interview invites for a job.
 *
 * Restricted to the creator since invites are sent from the creator's
 * personal Gmail and scheduled on their personal calendar.
 */
export async function canInviteForJob(actor: Actor, jobId: string): Promise<boolean> {
  const job = await loadJob(jobId);
  if (!job) return false;
  return computeJobPermissions(actor, job).canInvite;
}

/** True if the actor can upload resumes to a job. Any viewer may upload. */
export async function canUploadToJob(actor: Actor, jobId: string): Promise<boolean> {
  return canViewJob(actor, jobId);
}

/** True if the actor can trigger resume analysis. Any viewer may analyze. */
export async function canAnalyzeJob(actor: Actor, jobId: string): Promise<boolean> {
  return canViewJob(actor, jobId);
}

/**
 * True if the actor can delete a resume.
 *
 * The uploader can delete their own uploads. The job creator and org admins
 * can delete any resume on the job as a safety net for cleanup.
 */
export async function canDeleteResume(actor: Actor, resumeId: string): Promise<boolean> {
  const [resume] = await db
    .select()
    .from(jobResumes)
    .where(eq(jobResumes.id, resumeId))
    .limit(1);

  if (!resume) return false;
  if (resume.uploadedByUserId === actor.userId) return true;

  return canDeleteJob(actor, resume.jobOfferId);
}
