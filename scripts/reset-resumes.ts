import { db } from '../src/db';
import { jobResumes } from '../src/schema';
import { eq } from 'drizzle-orm';

async function resetResumes() {
  const updated = await db
    .update(jobResumes)
    .set({ status: 'uploaded', errorMessage: null })
    .where(eq(jobResumes.status, 'error'))
    .returning({ id: jobResumes.id });

  console.log(`Reset ${updated.length} resume(s) back to 'uploaded'`);
  process.exit(0);
}

resetResumes();
