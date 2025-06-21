const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const logger = require('../utils/logger');

// Load environment variables
require('dotenv').config();

// Backup configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'desa_digital',
  backupDir: path.join(__dirname, '../backups'),
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10)
};

// Ensure backup directory exists
if (!fs.existsSync(config.backupDir)) {
  fs.mkdirSync(config.backupDir, { recursive: true });
}

// Create backup filename with timestamp
const getBackupFilename = () => {
  const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
  return path.join(config.backupDir, `backup_${timestamp}.sql`);
};

// Create database backup
const createBackup = () => {
  const filename = getBackupFilename();
  const command = `mysqldump -h ${config.host} -P ${config.port} -u ${config.user} ${
    config.password ? `-p${config.password}` : ''
  } ${config.database} > ${filename}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      logger.error('Database backup failed:', error);
      return;
    }

    if (stderr) {
      logger.warn('Database backup warning:', stderr);
    }

    logger.info(`Database backup created successfully: ${filename}`);
    cleanOldBackups();
  });
};

// Restore database from backup
const restoreBackup = (backupFile) => {
  if (!fs.existsSync(backupFile)) {
    logger.error(`Backup file not found: ${backupFile}`);
    return;
  }

  const command = `mysql -h ${config.host} -P ${config.port} -u ${config.user} ${
    config.password ? `-p${config.password}` : ''
  } ${config.database} < ${backupFile}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      logger.error('Database restoration failed:', error);
      return;
    }

    if (stderr) {
      logger.warn('Database restoration warning:', stderr);
    }

    logger.info(`Database restored successfully from: ${backupFile}`);
  });
};

// Clean old backups
const cleanOldBackups = () => {
  fs.readdir(config.backupDir, (err, files) => {
    if (err) {
      logger.error('Error reading backup directory:', err);
      return;
    }

    const now = moment();
    files.forEach(file => {
      const filePath = path.join(config.backupDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = moment().diff(moment(stats.mtime), 'days');

      if (fileAge > config.retentionDays) {
        fs.unlink(filePath, (err) => {
          if (err) {
            logger.error(`Error deleting old backup ${file}:`, err);
            return;
          }
          logger.info(`Deleted old backup: ${file}`);
        });
      }
    });
  });
};

// List available backups
const listBackups = () => {
  fs.readdir(config.backupDir, (err, files) => {
    if (err) {
      logger.error('Error reading backup directory:', err);
      return;
    }

    const backups = files
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(config.backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created);

    logger.info('Available backups:', backups);
  });
};

// Command line interface
const [,, command, ...args] = process.argv;

switch (command) {
  case 'create':
    createBackup();
    break;

  case 'restore':
    if (!args[0]) {
      logger.error('Please specify backup file to restore');
      process.exit(1);
    }
    restoreBackup(args[0]);
    break;

  case 'list':
    listBackups();
    break;

  case 'clean':
    cleanOldBackups();
    break;

  default:
    logger.info(`
Usage:
  node backup.js create              Create new backup
  node backup.js restore [filename]  Restore from backup
  node backup.js list               List available backups
  node backup.js clean              Clean old backups
    `);
    process.exit(0);
}

// Export functions for programmatic use
module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  cleanOldBackups
};
