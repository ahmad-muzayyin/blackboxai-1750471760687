const crypto = require('crypto');
const moment = require('moment');
const path = require('path');

class Helpers {
  // String manipulation
  static formatString = {
    // Capitalize first letter of each word
    titleCase: (str) => {
      return str.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
    },

    // Convert snake_case to camelCase
    snakeToCamel: (str) => {
      return str.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    },

    // Convert camelCase to snake_case
    camelToSnake: (str) => {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    },

    // Slugify string
    slugify: (str) => {
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    },

    // Remove special characters
    removeSpecialChars: (str) => {
      return str.replace(/[^a-zA-Z0-9 ]/g, '');
    }
  };

  // Number manipulation
  static formatNumber = {
    // Format currency in IDR
    toRupiah: (number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(number);
    },

    // Format number with thousand separator
    withCommas: (number) => {
      return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    // Round to specific decimal places
    round: (number, decimals = 2) => {
      return Number(Math.round(number + 'e' + decimals) + 'e-' + decimals);
    },

    // Convert number to percentage
    toPercentage: (number, decimals = 2) => {
      return `${(number * 100).toFixed(decimals)}%`;
    }
  };

  // Date manipulation
  static formatDate = {
    // Format date to Indonesian format
    toIndonesian: (date) => {
      return moment(date).locale('id').format('DD MMMM YYYY');
    },

    // Format date and time
    withTime: (date) => {
      return moment(date).format('DD/MM/YYYY HH:mm:ss');
    },

    // Get age from birthdate
    getAge: (birthDate) => {
      return moment().diff(moment(birthDate), 'years');
    },

    // Check if date is weekend
    isWeekend: (date) => {
      const day = moment(date).day();
      return day === 0 || day === 6;
    },

    // Get date range
    getDateRange: (startDate, endDate) => {
      const dates = [];
      let currentDate = moment(startDate);
      const lastDate = moment(endDate);

      while (currentDate <= lastDate) {
        dates.push(currentDate.format('YYYY-MM-DD'));
        currentDate = moment(currentDate).add(1, 'days');
      }

      return dates;
    }
  };

  // Array manipulation
  static arrayHelpers = {
    // Group array by key
    groupBy: (array, key) => {
      return array.reduce((result, item) => {
        (result[item[key]] = result[item[key]] || []).push(item);
        return result;
      }, {});
    },

    // Remove duplicates from array
    unique: (array, key = null) => {
      if (key) {
        return Array.from(new Map(array.map(item => [item[key], item])).values());
      }
      return [...new Set(array)];
    },

    // Chunk array into smaller arrays
    chunk: (array, size) => {
      return array.reduce((chunks, item, index) => {
        if (index % size === 0) {
          chunks.push([item]);
        } else {
          chunks[chunks.length - 1].push(item);
        }
        return chunks;
      }, []);
    },

    // Shuffle array
    shuffle: (array) => {
      return array.sort(() => Math.random() - 0.5);
    }
  };

  // Object manipulation
  static objectHelpers = {
    // Remove null and undefined values
    clean: (obj) => {
      return Object.entries(obj)
        .filter(([_, value]) => value != null)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    },

    // Flatten nested object
    flatten: (obj, prefix = '') => {
      return Object.keys(obj).reduce((acc, key) => {
        const pre = prefix.length ? `${prefix}.` : '';
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(acc, Helpers.objectHelpers.flatten(obj[key], pre + key));
        } else {
          acc[pre + key] = obj[key];
        }
        return acc;
      }, {});
    },

    // Pick specific keys from object
    pick: (obj, keys) => {
      return keys.reduce((acc, key) => {
        if (key in obj) {
          acc[key] = obj[key];
        }
        return acc;
      }, {});
    },

    // Omit specific keys from object
    omit: (obj, keys) => {
      return Object.keys(obj)
        .filter(key => !keys.includes(key))
        .reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {});
    }
  };

  // Security helpers
  static security = {
    // Generate random string
    generateRandomString: (length = 32) => {
      return crypto.randomBytes(length).toString('hex');
    },

    // Generate random number
    generateRandomNumber: (min, max) => {
      return Math.floor(Math.random() * (max - min + 1) + min);
    },

    // Hash string
    hashString: (str) => {
      return crypto.createHash('sha256').update(str).digest('hex');
    },

    // Generate file hash
    generateFileHash: (buffer) => {
      return crypto.createHash('md5').update(buffer).digest('hex');
    }
  };

  // File helpers
  static fileHelpers = {
    // Get file extension
    getExtension: (filename) => {
      return path.extname(filename).toLowerCase();
    },

    // Get file name without extension
    getBaseName: (filename) => {
      return path.basename(filename, path.extname(filename));
    },

    // Convert bytes to human readable size
    formatFileSize: (bytes) => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 Byte';
      const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
      return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    },

    // Get MIME type from extension
    getMimeType: (extension) => {
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
  };

  // Validation helpers
  static validation = {
    // Check if string is valid email
    isEmail: (email) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    },

    // Check if string is valid NIK
    isNIK: (nik) => {
      return /^\d{16}$/.test(nik);
    },

    // Check if string is valid phone number
    isPhone: (phone) => {
      return /^[0-9+\-() ]{10,15}$/.test(phone);
    },

    // Check if string contains only letters and spaces
    isAlphaSpace: (str) => {
      return /^[a-zA-Z ]+$/.test(str);
    },

    // Check if string contains only numbers
    isNumeric: (str) => {
      return /^\d+$/.test(str);
    }
  };

  // Common data transformations
  static transform = {
    // Transform Sequelize model to plain object
    modelToJson: (model) => {
      return model ? model.toJSON() : null;
    },

    // Transform array of models to plain objects
    modelsToJson: (models) => {
      return models ? models.map(model => model.toJSON()) : [];
    },

    // Transform error to plain object
    errorToJson: (error) => {
      return {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        errors: error.errors
      };
    }
  };
}

module.exports = Helpers;
