const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('./logger');

// Define allowed file types and their corresponding MIME types
const ALLOWED_FILE_TYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  
  // Others
  'text/plain': '.txt',
  'application/json': '.json'
};

// Maximum file size (5MB)
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || 5 * 1024 * 1024;

// Create storage configuration for different file types
const createStorage = (destination) => {
  // Ensure upload directory exists
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destination);
    },
    filename: (req, file, cb) => {
      // Generate random filename to prevent collisions
      const randomString = crypto.randomBytes(16).toString('hex');
      const extension = ALLOWED_FILE_TYPES[file.mimetype];
      cb(null, `${randomString}${extension}`);
    }
  });
};

// File filter function
const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: ' + Object.keys(ALLOWED_FILE_TYPES).join(', ')), false);
  }
};

// Create multer instances for different upload types
const createUploader = (destination) => {
  return multer({
    storage: createStorage(destination),
    fileFilter: fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE
    }
  });
};

// Create specific uploaders for different purposes
const uploaders = {
  // For profile pictures and avatars
  avatar: createUploader('uploads/avatars'),
  
  // For letter attachments
  surat: createUploader('uploads/surat'),
  
  // For social assistance program documents
  bantuanSosial: createUploader('uploads/bantuan-sosial'),
  
  // For village budget documents
  apbdes: createUploader('uploads/apbdes'),
  
  // For village profile documents (logo, structure, etc.)
  desaProfile: createUploader('uploads/desa-profile')
};

// Utility functions for file management
const fileUtils = {
  // Delete a file
  deleteFile: async (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info(`File deleted successfully: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  },

  // Move a file
  moveFile: async (oldPath, newPath) => {
    try {
      await fs.promises.rename(oldPath, newPath);
      logger.info(`File moved successfully from ${oldPath} to ${newPath}`);
      return true;
    } catch (error) {
      logger.error('Error moving file:', error);
      throw error;
    }
  },

  // Get file information
  getFileInfo: async (filePath) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(filePath),
        filename: path.basename(filePath)
      };
    } catch (error) {
      logger.error('Error getting file info:', error);
      throw error;
    }
  },

  // Check if file exists
  fileExists: (filePath) => {
    return fs.existsSync(filePath);
  },

  // Create directory if it doesn't exist
  ensureDirectory: (dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  },

  // Clean temporary files
  cleanTemp: async () => {
    const tempDir = 'uploads/temp';
    try {
      if (fs.existsSync(tempDir)) {
        const files = await fs.promises.readdir(tempDir);
        for (const file of files) {
          const filePath = path.join(tempDir, file);
          const stats = await fs.promises.stat(filePath);
          // Delete files older than 24 hours
          if (Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
            await fs.promises.unlink(filePath);
            logger.info(`Deleted temporary file: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error cleaning temporary files:', error);
      throw error;
    }
  }
};

// Error handler middleware for multer errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File size should not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next(error);
};

module.exports = {
  uploaders,
  fileUtils,
  handleUploadError,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE
};
