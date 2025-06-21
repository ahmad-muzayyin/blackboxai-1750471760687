const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const logger = require('./logger');
const config = require('./config');
const i18n = require('./i18n');
const transformer = require('./transformer');

class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../reports');
    this.templatesDir = path.join(__dirname, '../templates');
    this.initialize();
  }

  // Initialize report generator
  async initialize() {
    try {
      // Create reports directory if it doesn't exist
      await fs.promises.mkdir(this.reportsDir, { recursive: true });
      logger.info('Report generator initialized successfully');
    } catch (error) {
      logger.error('Report generator initialization error:', error);
      throw error;
    }
  }

  /**
   * Excel Report Generation
   */

  // Generate Excel report
  async generateExcelReport(data, options) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(options.sheetName || 'Report');

      // Set workbook properties
      workbook.creator = 'Desa Digital';
      workbook.lastModifiedBy = 'Desa Digital';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Add header row
      worksheet.columns = options.columns.map(column => ({
        header: column.header,
        key: column.key,
        width: column.width || 15
      }));

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Add data rows
      data.forEach(item => {
        const row = {};
        options.columns.forEach(column => {
          row[column.key] = this.formatCellValue(item[column.key], column.type);
        });
        worksheet.addRow(row);
      });

      // Style data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.alignment = { vertical: 'middle' };
        }
      });

      // Generate file name
      const fileName = `${options.fileName || 'report'}-${moment().format('YYYYMMDD-HHmmss')}.xlsx`;
      const filePath = path.join(this.reportsDir, fileName);

      // Save workbook
      await workbook.xlsx.writeFile(filePath);
      logger.info(`Excel report generated: ${fileName}`);

      return {
        fileName,
        filePath,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } catch (error) {
      logger.error('Error generating Excel report:', error);
      throw error;
    }
  }

  /**
   * PDF Report Generation
   */

  // Generate PDF report
  async generatePDFReport(data, options) {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // Generate file name
      const fileName = `${options.fileName || 'report'}-${moment().format('YYYYMMDD-HHmmss')}.pdf`;
      const filePath = path.join(this.reportsDir, fileName);

      // Create write stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add header
      this.addPDFHeader(doc, options);

      // Add content
      await this.addPDFContent(doc, data, options);

      // Add footer
      this.addPDFFooter(doc);

      // Finalize document
      doc.end();

      // Wait for stream to finish
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      logger.info(`PDF report generated: ${fileName}`);

      return {
        fileName,
        filePath,
        mimeType: 'application/pdf'
      };
    } catch (error) {
      logger.error('Error generating PDF report:', error);
      throw error;
    }
  }

  /**
   * Report Generation Helpers
   */

  // Format cell value based on type
  formatCellValue(value, type) {
    if (value === null || value === undefined) return '';

    switch (type) {
      case 'date':
        return moment(value).format('DD/MM/YYYY');
      case 'datetime':
        return moment(value).format('DD/MM/YYYY HH:mm:ss');
      case 'currency':
        return i18n.formatCurrency(value);
      case 'number':
        return i18n.formatNumber(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value;
    }
  }

  // Add PDF header
  addPDFHeader(doc, options) {
    // Add logo
    if (options.logo) {
      doc.image(options.logo, 50, 45, { width: 50 });
    }

    // Add title
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text(options.title || 'Report', 120, 50)
       .moveDown();

    // Add subtitle if provided
    if (options.subtitle) {
      doc.fontSize(12)
         .font('Helvetica')
         .text(options.subtitle)
         .moveDown();
    }

    // Add metadata
    doc.fontSize(10)
       .text(`Generated: ${moment().format('DD/MM/YYYY HH:mm:ss')}`)
       .moveDown();
  }

  // Add PDF content
  async addPDFContent(doc, data, options) {
    switch (options.type) {
      case 'table':
        await this.addPDFTable(doc, data, options);
        break;
      case 'list':
        await this.addPDFList(doc, data, options);
        break;
      default:
        await this.addPDFText(doc, data, options);
    }
  }

  // Add PDF table
  async addPDFTable(doc, data, options) {
    const { columns } = options;
    const tableTop = doc.y;
    const cellPadding = 5;
    const colWidths = this.calculateColumnWidths(doc, columns);

    // Draw headers
    let x = 50;
    doc.font('Helvetica-Bold');
    columns.forEach((column, i) => {
      doc.text(column.header, x, tableTop, {
        width: colWidths[i],
        align: column.align || 'left'
      });
      x += colWidths[i] + cellPadding;
    });

    // Draw rows
    doc.font('Helvetica');
    let y = tableTop + 20;
    data.forEach(row => {
      x = 50;
      columns.forEach((column, i) => {
        const value = this.formatCellValue(row[column.key], column.type);
        doc.text(value, x, y, {
          width: colWidths[i],
          align: column.align || 'left'
        });
        x += colWidths[i] + cellPadding;
      });
      y += 20;
    });
  }

  // Add PDF list
  async addPDFList(doc, data, options) {
    data.forEach((item, index) => {
      doc.fontSize(10)
         .text(`${index + 1}. ${item}`)
         .moveDown(0.5);
    });
  }

  // Add PDF text
  async addPDFText(doc, data, options) {
    doc.fontSize(10)
       .text(data)
       .moveDown();
  }

  // Add PDF footer
  addPDFFooter(doc) {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Add page number
      doc.fontSize(8)
         .text(
           `Page ${i + 1} of ${pageCount}`,
           50,
           doc.page.height - 50,
           { align: 'center' }
         );
    }
  }

  // Calculate column widths for PDF table
  calculateColumnWidths(doc, columns) {
    const totalWidth = doc.page.width - 100; // Margins: 50 each side
    const totalParts = columns.reduce((sum, col) => sum + (col.width || 1), 0);
    return columns.map(col => (col.width || 1) * totalWidth / totalParts);
  }

  /**
   * Report Templates
   */

  // Generate penduduk report
  async generatePendudukReport(data, type = 'excel') {
    const options = {
      fileName: 'penduduk-report',
      title: 'Laporan Data Penduduk',
      sheetName: 'Data Penduduk',
      columns: [
        { header: 'NIK', key: 'nik', width: 20 },
        { header: 'Nama', key: 'nama', width: 30 },
        { header: 'Tempat Lahir', key: 'tempatLahir', width: 20 },
        { header: 'Tanggal Lahir', key: 'tanggalLahir', width: 15, type: 'date' },
        { header: 'Jenis Kelamin', key: 'jenisKelamin', width: 15 },
        { header: 'Agama', key: 'agama', width: 15 },
        { header: 'Status Perkawinan', key: 'statusPerkawinan', width: 20 },
        { header: 'Pekerjaan', key: 'pekerjaan', width: 25 },
        { header: 'Alamat', key: 'alamat', width: 40 }
      ]
    };

    return type === 'excel' 
      ? this.generateExcelReport(data, options)
      : this.generatePDFReport(data, { ...options, type: 'table' });
  }

  // Generate surat report
  async generateSuratReport(data, type = 'excel') {
    const options = {
      fileName: 'surat-report',
      title: 'Laporan Permohonan Surat',
      sheetName: 'Data Surat',
      columns: [
        { header: 'Nomor Surat', key: 'nomorSurat', width: 20 },
        { header: 'Jenis Surat', key: 'jenisSurat', width: 25 },
        { header: 'Pemohon', key: 'pemohon.nama', width: 30 },
        { header: 'Keperluan', key: 'keperluan', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Tanggal Pengajuan', key: 'createdAt', width: 20, type: 'date' }
      ]
    };

    return type === 'excel'
      ? this.generateExcelReport(data, options)
      : this.generatePDFReport(data, { ...options, type: 'table' });
  }

  // Generate bantuan sosial report
  async generateBantuanReport(data, type = 'excel') {
    const options = {
      fileName: 'bantuan-report',
      title: 'Laporan Bantuan Sosial',
      sheetName: 'Data Bantuan',
      columns: [
        { header: 'Program', key: 'namaProgram', width: 30 },
        { header: 'Jenis', key: 'jenisProgram', width: 20 },
        { header: 'Tahun', key: 'tahunAnggaran', width: 10 },
        { header: 'Nilai Manfaat', key: 'nilaiManfaat', width: 20, type: 'currency' },
        { header: 'Total Anggaran', key: 'totalAnggaran', width: 20, type: 'currency' },
        { header: 'Jumlah Penerima', key: 'jumlahPenerima', width: 15, type: 'number' },
        { header: 'Status', key: 'status', width: 15 }
      ]
    };

    return type === 'excel'
      ? this.generateExcelReport(data, options)
      : this.generatePDFReport(data, { ...options, type: 'table' });
  }
}

// Create singleton instance
const reportGenerator = new ReportGenerator();

// Export instance
module.exports = reportGenerator;
