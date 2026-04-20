import { eq } from 'drizzle-orm';
import { db } from '../db';
import { jobOffers, jobResumes, type JobOffer } from '../schema';

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

function isMemberOfJobOrg(actor: Actor, job: JobOffer): boolean {
  return job.organizationId !== null && actor.clerkOrgIds.includes(job.organizationId);
}

function isAdminOfJobOrg(actor: Actor, job: JobOffer): boolean {
  return job.organizationId !== null && actor.adminClerkOrgIds.includes(job.organizationId);
}

function isJobCreator(actor: Actor, job: JobOffer): boolean {
  return job.userId === actor.userId;
}

async function loadJob(jobId: string): Promise<JobOffer | null> {
  const [job] = await db.select().from(jobOffers).where(eq(jobOffers.id, jobId)).limit(1);
  return job ?? null;
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
  return isJobCreator(actor, job) || isMemberOfJobOrg(actor, job);
}

/** True if the actor can edit a job's details. Restricted to the creator. */
export async function canEditJob(actor: Actor, jobId: string): Promise<boolean> {
  const job = await loadJob(jobId);
  if (!job) return false;
  return isJobCreator(actor, job);
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
  return isJobCreator(actor, job) || isAdminOfJobOrg(actor, job);
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
  return isJobCreator(actor, job);
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
