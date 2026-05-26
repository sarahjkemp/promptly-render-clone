import cron from 'node-cron';
import { fetchNewsForAllCompanies } from './news-fetcher.js';
import { storage } from './storage.js';

/**
 * Sets up scheduled tasks for automated news fetching
 */
export async function initializeScheduledTasks() {
  // Schedule automated news fetch every Sunday at 7 PM UK time
  // Cron format: second minute hour day month dayOfWeek
  // 0 19 * * 0 = every Sunday at 7 PM
  const cronExpression = '0 19 * * 0';
  
  console.log('Initializing scheduled news fetch task...');
  console.log('Schedule: Every Sunday at 7:00 PM UK time');

  // Initialize or get the cron job record
  await initializeCronJobRecord();

  cron.schedule(cronExpression, async () => {
    console.log('🤖 Starting scheduled weekly news fetch...');
    
    try {
      // Check if the cron job is enabled before running
      const cronJob = await storage.getCronJob('weekly_news_fetch');
      
      if (!cronJob || !cronJob.enabled) {
        console.log('⏸️ Scheduled news fetch is disabled, skipping...');
        return;
      }

      // Update status to running
      await storage.updateCronJob('weekly_news_fetch', {
        lastStatus: 'running'
      });

      await fetchNewsForAllCompanies();
      
      // Update status to success
      await storage.updateCronJob('weekly_news_fetch', {
        lastRun: new Date(),
        lastStatus: 'success',
        lastError: null,
        nextRun: getNextSundayAt7PM()
      });
      
      console.log('✅ Scheduled news fetch completed successfully');
    } catch (error) {
      console.error('❌ Scheduled news fetch failed:', error);
      
      // Update status to error
      await storage.updateCronJob('weekly_news_fetch', {
        lastRun: new Date(),
        lastStatus: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        nextRun: getNextSundayAt7PM()
      });
    }
  }, {
    timezone: 'Europe/London' // UK timezone
  });

  console.log('✅ Scheduled tasks initialized successfully');
}

/**
 * Initialize the cron job record in the database
 */
async function initializeCronJobRecord() {
  try {
    const existingJob = await storage.getCronJob('weekly_news_fetch');
    
    if (!existingJob) {
      await storage.createCronJob({
        name: 'weekly_news_fetch',
        enabled: true,
        nextRun: getNextSundayAt7PM()
      });
      console.log('Created weekly news fetch cron job record');
    }
  } catch (error) {
    console.error('Error initializing cron job record:', error);
  }
}

/**
 * Calculate the next Sunday at 7 PM UK time
 */
function getNextSundayAt7PM(): Date {
  const now = new Date();
  const nextSunday = new Date(now);
  
  // Set to next Sunday
  const daysUntilSunday = 7 - now.getDay();
  nextSunday.setDate(now.getDate() + (daysUntilSunday === 7 ? 7 : daysUntilSunday));
  
  // Set to 7 PM UK time
  nextSunday.setHours(19, 0, 0, 0);
  
  return nextSunday;
}

/**
 * Manual trigger for testing scheduled tasks
 * Only use for development/testing purposes
 */
export async function triggerManualFetch() {
  console.log('🔧 Manual trigger: Starting news fetch for all companies...');
  try {
    await fetchNewsForAllCompanies();
    console.log('✅ Manual fetch completed successfully');
  } catch (error) {
    console.error('❌ Manual fetch failed:', error);
    throw error;
  }
}