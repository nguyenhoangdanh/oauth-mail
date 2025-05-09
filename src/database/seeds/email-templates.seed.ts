// src/database/seeds/email-templates.seed.ts
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed email templates from filesystem to database
 */
export const seedEmailTemplates = async (
  dataSource: DataSource,
): Promise<void> => {
  const logger = console;
  logger.log('Starting to seed email templates...');

  try {
    // Path to email templates directory
    const templateDir = path.join(process.cwd(), 'templates/emails');
    logger.log(`Looking for templates in: ${templateDir}`);

    // Check if directory exists
    if (!fs.existsSync(templateDir)) {
      logger.error(`Template directory not found: ${templateDir}`);
      return;
    }

    // Get list of template files
    const files = fs.readdirSync(templateDir);
    logger.log(`Found ${files.length} template files`);

    // Process each template file
    for (const file of files) {
      try {
        // Skip non-hbs files and partials
        if (!file.endsWith('.hbs') || file.startsWith('partial-')) {
          continue;
        }

        const templateName = file.replace('.hbs', '');
        const filePath = path.join(templateDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Generate appropriate subject line based on template name
        let subject = '';
        let description = '';
        let category = 'notification';

        switch (templateName) {
          case 'magic-link':
            subject = 'Sign in to your account';
            description = 'Template for magic link authentication emails';
            category = 'authentication';
            break;
          case 'verification':
            subject = 'Verify Your Email';
            description = 'Template for email verification';
            category = 'authentication';
            break;
          case 'welcome':
            subject = 'Welcome to our platform';
            description = 'Template for welcome emails';
            category = 'onboarding';
            break;
          case 'password-reset':
            subject = 'Reset Your Password';
            description = 'Template for password reset emails';
            category = 'authentication';
            break;
          case 'login-notification':
            subject = 'New Login to Your Account';
            description = 'Template for login notification emails';
            category = 'security';
            break;
          case '2fa-backup-codes':
            subject = 'Your Two-Factor Authentication Backup Codes';
            description = 'Template for 2FA backup codes emails';
            category = 'security';
            break;
          default:
            subject = `Notification from ${process.env.APP_NAME || 'SecureMail'}`;
            description = `Template for ${templateName.replace(/-/g, ' ')} emails`;
            category = 'general';
        }

        // Check if the template exists in database
        const existingTemplate = await dataSource.query(
          'SELECT id, version FROM email_templates WHERE name = $1',
          [templateName],
        );

        if (existingTemplate.length === 0) {
          // Insert new template
          await dataSource.query(
            `INSERT INTO email_templates 
            (id, name, subject, content, description, is_active, version, category, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              uuidv4(),
              templateName,
              subject,
              content,
              description,
              true,
              1,
              category,
            ],
          );
          logger.log(`Created email template: ${templateName}`);
        } else if (process.env.FORCE_UPDATE_TEMPLATES === 'true') {
          // Update existing template if FORCE_UPDATE_TEMPLATES is set
          const nextVersion = existingTemplate[0].version + 1;
          await dataSource.query(
            `UPDATE email_templates 
             SET content = $1, subject = $2, is_active = true, version = $3, updated_at = NOW() 
             WHERE name = $4`,
            [content, subject, nextVersion, templateName],
          );
          logger.log(
            `Updated email template: ${templateName} to version ${nextVersion}`,
          );
        } else {
          // Just ensure the template is active
          await dataSource.query(
            `UPDATE email_templates SET is_active = true WHERE name = $1 AND is_active = false`,
            [templateName],
          );
          logger.log(`Verified email template exists: ${templateName}`);
        }
      } catch (error) {
        logger.error(`Error processing template ${file}: ${error.message}`);
      }
    }

    logger.log('Email templates seeding completed');
  } catch (error) {
    logger.error(`Failed to seed email templates: ${error.message}`);
    throw error;
  }
};
