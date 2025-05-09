// src/database/seeds/seed.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedEmailTemplates } from './email-templates.seed';
import { AppDataSource } from '../data-source';

// Load environment variables
config();

/**
 * Main seed function
 */
async function seed() {
  let dataSource: DataSource | null = null;

  try {
    console.log('Starting database seed process...');

    // Initialize data source
    if (!AppDataSource.isInitialized) {
      console.log('Initializing data source...');
      dataSource = await AppDataSource.initialize();
    } else {
      dataSource = AppDataSource;
    }

    // Run seed functions
    await seedEmailTemplates(dataSource);

    console.log('✅ Seed process completed successfully!');
  } catch (error) {
    console.error('❌ Seed process failed:', error);
    process.exit(1);
  } finally {
    // Close connection if we created one
    if (dataSource && dataSource !== AppDataSource) {
      await dataSource.destroy();
    }
  }
}

// Automatically run if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seed;
