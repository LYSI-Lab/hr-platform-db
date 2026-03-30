import { db } from '../src/db';
import { jobAnalysisRuns } from '../src/schema';
import { eq, and, ne } from 'drizzle-orm';

async function cancelStuckRuns() {
  const runs = await db
    .select()
    .from(jobAnalysisRuns)
    .where(
      and(
        ne(jobAnalysisRuns.status, 'completed'),
        ne(jobAnalysisRuns.status, 'failed')
      )
    );

  console.log(`Found ${runs.length} active run(s)`);

  for (const run of runs) {
    await db
      .update(jobAnalysisRuns)
      .set({
        status: 'failed',
        errorMessage: 'Cancelled manually',
        completedAt: new Date(),
      })
      .where(eq(jobAnalysisRuns.id, run.id));

    console.log(`Cancelled: ${run.id} (was: ${run.status})`);
  }

  process.exit(0);
}

cancelStuckRuns();
