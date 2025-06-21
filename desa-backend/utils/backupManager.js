const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const archiver = require('archiver');
const logger = require('./loggerManager');
const config = require('./configManager');
const metrics = require('./metricsManager');
const eventManager = require('./eventManager');

class BackupManager {
  constructor() {
    this.backupPath = '';
    this.retentionDays = 30;
    this.initialize();
  }

  // Initialize backup manager
  initialize() {
    try {
      this.setupConfig();
      this.ensureBackupDirectory();
      logger.info('Backup manager initialized successfully');
    } catch (error) {
      logger.error('Backup manager initialization error:', error);
      throw error;
    }
  }

  /**
   * Configuration
   */

  // Setup backup configuration
  setupConfig() {
    const backupConfig = config.get('backup', {});
    this.backupPath = backupConfig.path || path.join(process.cwd(), 'backups');
    this.retentionDays = backupConfig.retentionDays || 30;
  }

  // Ensure backup directory exists
  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupPath, { recursive: true });
    } catch (error) {
      logger.error('Error creating backup directory:', error);
      throw error;
    }
  }

  /**
   * Backup Operations
   */

  // Create backup
  async createBackup(options = {}) {
    const startTime = process.hrtime();
    const timestamp = this.getTimestamp();
    const backupName = options.name || `backup_${timestamp}`;

    try {
      logger.info(`Starting backup: ${backupName}`);

      // Create backup directory
      const backupDir = path.join(this.backupPath, backupName);
      await fs.mkdir(backupDir, { recursive: true });

      // Backup database
      await this.backupDatabase(backupDir);

      // Backup files
      await this.backupFiles(backupDir);

      // Create archive
      const archivePath = await this.createArchive(backupDir, backupName);

      // Cleanup temporary directory
      await this.cleanup(backupDir);

      // Apply retention policy
      await this.applyRetentionPolicy();

      this.trackBackup('success', startTime);
      eventManager.emitEvent('backup:created', { name: backupName });

      logger.info(`Backup completed: ${backupName}`);
      return archivePath;
    } catch (error) {
      this.trackBackup('error', startTime);
      logger.error(`Backup failed: ${backupName}`, error);
      throw error;
    }
  }

  // Restore from backup
  async restoreFromBackup(backupPath, options = {}) {
    const startTime = process.hrtime();
    
    try {
      logger.info(`Starting restore from: ${backupPath}`);

      // Extract archive
      const extractDir = await this.extractArchive(backupPath);

      // Restore database
      await this.restoreDatabase(extractDir);

      // Restore files
      await this.restoreFiles(extractDir);

      // Cleanup temporary directory
      await this.cleanup(extractDir);

      this.trackRestore('success', startTime);
      eventManager.emitEvent('backup:restored', { path: backupPath });

      logger.info('Restore completed successfully');
    } catch (error) {
      this.trackRestore('error', startTime);
      logger.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * Database Backup
   */

  // Backup database
  async backupDatabase(backupDir) {
    const dbConfig = config.get('database');
    const dumpFile = path.join(backupDir, 'database.sql');

    try {
      const command = this.getDatabaseDumpCommand(dbConfig, dumpFile);
      await execAsync(command);
      logger.info('Database backup completed');
    } catch (error) {
      logger.error('Database backup failed:', error);
      throw error;
    }
  }

  // Restore database
  async restoreDatabase(restoreDir) {
    const dbConfig = config.get('database');
    const dumpFile = path.join(restoreDir, 'database.sql');

    try {
      const command = this.getDatabaseRestoreCommand(dbConfig, dumpFile);
      await execAsync(command);
      logger.info('Database restore completed');
    } catch (error) {
      logger.error('Database restore failed:', error);
      throw error;
    }
  }

  /**
   * File Backup
   */

  // Backup files
  async backupFiles(backupDir) {
    try {
      const filesToBackup = config.get('backup.files', []);
      
      for (const file of filesToBackup) {
        const destination = path.join(backupDir, 'files', file.replace(/^\//, ''));
        await this.copyFile(file, destination);
      }

      logger.info('Files backup completed');
    } catch (error) {
      logger.error('Files backup failed:', error);
      throw error;
    }
  }

  // Restore files
  async restoreFiles(restoreDir) {
    try {
      const filesDir = path.join(restoreDir, 'files');
      const files = await this.listFiles(filesDir);

      for (const file of files) {
        const destination = path.join(process.cwd(), file.replace(filesDir, ''));
        await this.copyFile(file, destination);
      }

      logger.info('Files restore completed');
    } catch (error) {
      logger.error('Files restore failed:', error);
      throw error;
    }
  }

  /**
   * Archive Management
   */

  // Create archive
  async createArchive(sourceDir, name) {
    return new Promise((resolve, reject) => {
      const archivePath = path.join(this.backupPath, `${name}.zip`);
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(archivePath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  // Extract archive
  async extractArchive(archivePath) {
    const extractDir = path.join(this.backupPath, 'temp_restore');
    await fs.mkdir(extractDir, { recursive: true });

    try {
      await execAsync(`unzip "${archivePath}" -d "${extractDir}"`);
      return extractDir;
    } catch (error) {
      logger.error('Archive extraction failed:', error);
      throw error;
    }
  }

  /**
   * Retention Policy
   */

  // Apply retention policy
  async applyRetentionPolicy() {
    try {
      const files = await fs.readdir(this.backupPath);
      const now = new Date();

      for (const file of files) {
        const filePath = path.join(this.backupPath, file);
        const stats = await fs.stat(filePath);
        const ageInDays = (now - stats.mtime) / (1000 * 60 * 60 * 24);

        if (ageInDays > this.retentionDays) {
          await fs.unlink(filePath);
          logger.info(`Deleted old backup: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error applying retention policy:', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */

  // Get timestamp
  getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  // Get database dump command
  getDatabaseDumpCommand(dbConfig, dumpFile) {
    switch (dbConfig.dialect) {
      case 'postgres':
        return `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -U ${dbConfig.username} -d ${dbConfig.name} > "${dumpFile}"`;
      case 'mysql':
        return `mysqldump -h ${dbConfig.host} -u ${dbConfig.username} -p${dbConfig.password} ${dbConfig.name} > "${dumpFile}"`;
      default:
        throw new Error(`Unsupported database dialect: ${dbConfig.dialect}`);
    }
  }

  // Get database restore command
  getDatabaseRestoreCommand(dbConfig, dumpFile) {
    switch (dbConfig.dialect) {
      case 'postgres':
        return `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -U ${dbConfig.username} -d ${dbConfig.name} < "${dumpFile}"`;
      case 'mysql':
        return `mysql -h ${dbConfig.host} -u ${dbConfig.username} -p${dbConfig.password} ${dbConfig.name} < "${dumpFile}"`;
      default:
        throw new Error(`Unsupported database dialect: ${dbConfig.dialect}`);
    }
  }

  // Copy file
  async copyFile(source, destination) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }

  // List files recursively
  async listFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.listFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  // Cleanup directory
  async cleanup(dir) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      logger.error(`Error cleaning up directory ${dir}:`, error);
    }
  }

  /**
   * Metrics Tracking
   */

  // Track backup metrics
  trackBackup(status, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('backup_duration_seconds', duration, {
      status
    });

    metrics.incrementCounter('backups_total', {
      status
    });
  }

  // Track restore metrics
  trackRestore(status, startTime) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    metrics.observeHistogram('restore_duration_seconds', duration, {
      status
    });

    metrics.incrementCounter('restores_total', {
      status
    });
  }

  /**
   * Status Information
   */

  // Get backup status
  async getStatus() {
    try {
      const files = await fs.readdir(this.backupPath);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(this.backupPath, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            name: file,
            size: stats.size,
            created: stats.mtime
          });
        }
      }

      return {
        totalBackups: backups.length,
        backups: backups.sort((a, b) => b.created - a.created),
        backupPath: this.backupPath,
        retentionDays: this.retentionDays
      };
    } catch (error) {
      logger.error('Error getting backup status:', error);
      throw error;
    }
  }
}

// Create singleton instance
const backupManager = new BackupManager();

// Export instance
module.exports = backupManager;
