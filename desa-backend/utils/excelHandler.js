const excel = require('excel4node');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const logger = require('./logger');

class ExcelHandler {
  constructor() {
    this.workbook = new excel.Workbook({
      defaultFont: {
        size: 11,
        name: 'Calibri'
      }
    });

    // Common styles
    this.styles = {
      header: this.workbook.createStyle({
        font: {
          bold: true,
          color: '#FFFFFF'
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          fgColor: '#4472C4'
        },
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        }
      }),
      cell: this.workbook.createStyle({
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        }
      }),
      date: this.workbook.createStyle({
        numberFormat: 'DD/MM/YYYY',
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        }
      }),
      currency: this.workbook.createStyle({
        numberFormat: '#,##0.00',
        border: {
          left: { style: 'thin' },
          right: { style: 'thin' },
          top: { style: 'thin' },
          bottom: { style: 'thin' }
        }
      })
    };
  }

  // Export Penduduk Data
  async exportPenduduk(data) {
    try {
      const worksheet = this.workbook.addWorksheet('Data Penduduk');
      
      // Define headers
      const headers = [
        'NIK', 'Nama', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Kelamin',
        'Golongan Darah', 'Alamat', 'RT', 'RW', 'Kelurahan/Desa',
        'Kecamatan', 'Agama', 'Status Perkawinan', 'Pekerjaan', 'Kewarganegaraan',
        'Berlaku Hingga', 'Status'
      ];

      // Write headers
      headers.forEach((header, index) => {
        worksheet.cell(1, index + 1).string(header).style(this.styles.header);
      });

      // Write data
      data.forEach((row, rowIndex) => {
        worksheet.cell(rowIndex + 2, 1).string(row.nik).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 2).string(row.nama).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 3).string(row.tempatLahir).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 4).date(new Date(row.tanggalLahir)).style(this.styles.date);
        worksheet.cell(rowIndex + 2, 5).string(row.jenisKelamin).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 6).string(row.golonganDarah).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 7).string(row.alamat).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 8).string(row.rt).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 9).string(row.rw).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 10).string(row.kelurahanDesa).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 11).string(row.kecamatan).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 12).string(row.agama).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 13).string(row.statusPerkawinan).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 14).string(row.pekerjaan).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 15).string(row.kewarganegaraan).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 16).date(new Date(row.berlakuHingga)).style(this.styles.date);
        worksheet.cell(rowIndex + 2, 17).string(row.status).style(this.styles.cell);
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.setWidth(20);
      });

      const filename = `penduduk_export_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
      const filepath = path.join(__dirname, '../uploads/exports', filename);

      await this.workbook.write(filepath);
      return filename;

    } catch (error) {
      logger.error('Error exporting penduduk data:', error);
      throw error;
    }
  }

  // Export Bantuan Sosial Data
  async exportBantuanSosial(data) {
    try {
      const worksheet = this.workbook.addWorksheet('Data Bantuan Sosial');

      // Define headers
      const headers = [
        'Program', 'Jenis', 'Tahun Anggaran', 'Sumber Dana',
        'Nilai Manfaat', 'Total Anggaran', 'Jumlah Penerima',
        'Tanggal Mulai', 'Tanggal Selesai', 'Status'
      ];

      // Write headers
      headers.forEach((header, index) => {
        worksheet.cell(1, index + 1).string(header).style(this.styles.header);
      });

      // Write data
      data.forEach((row, rowIndex) => {
        worksheet.cell(rowIndex + 2, 1).string(row.namaProgram).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 2).string(row.jenisProgram).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 3).number(row.tahunAnggaran).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 4).string(row.sumberDana).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 5).number(row.nilaiManfaat).style(this.styles.currency);
        worksheet.cell(rowIndex + 2, 6).number(row.totalAnggaran).style(this.styles.currency);
        worksheet.cell(rowIndex + 2, 7).number(row.jumlahPenerima).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 8).date(new Date(row.tanggalMulai)).style(this.styles.date);
        worksheet.cell(rowIndex + 2, 9).date(new Date(row.tanggalSelesai)).style(this.styles.date);
        worksheet.cell(rowIndex + 2, 10).string(row.status).style(this.styles.cell);
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.setWidth(15);
      });

      const filename = `bantuan_sosial_export_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
      const filepath = path.join(__dirname, '../uploads/exports', filename);

      await this.workbook.write(filepath);
      return filename;

    } catch (error) {
      logger.error('Error exporting bantuan sosial data:', error);
      throw error;
    }
  }

  // Export APBDes Data
  async exportAPBDes(data) {
    try {
      const worksheet = this.workbook.addWorksheet('Data APBDes');

      // Define headers
      const headers = [
        'Tahun Anggaran', 'Jenis', 'Kategori', 'Sub Kategori',
        'Uraian', 'Nilai Anggaran', 'Nilai Realisasi', 'Sumber Dana',
        'Status'
      ];

      // Write headers
      headers.forEach((header, index) => {
        worksheet.cell(1, index + 1).string(header).style(this.styles.header);
      });

      // Write data
      data.forEach((row, rowIndex) => {
        worksheet.cell(rowIndex + 2, 1).number(row.tahunAnggaran).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 2).string(row.jenis).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 3).string(row.kategori).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 4).string(row.subKategori || '').style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 5).string(row.uraian).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 6).number(row.nilaiAnggaran).style(this.styles.currency);
        worksheet.cell(rowIndex + 2, 7).number(row.nilaiRealisasi || 0).style(this.styles.currency);
        worksheet.cell(rowIndex + 2, 8).string(row.sumberDana).style(this.styles.cell);
        worksheet.cell(rowIndex + 2, 9).string(row.status).style(this.styles.cell);
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.setWidth(15);
      });

      const filename = `apbdes_export_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
      const filepath = path.join(__dirname, '../uploads/exports', filename);

      await this.workbook.write(filepath);
      return filename;

    } catch (error) {
      logger.error('Error exporting APBDes data:', error);
      throw error;
    }
  }

  // Helper method to ensure export directory exists
  ensureExportDirectory() {
    const exportDir = path.join(__dirname, '../uploads/exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
  }

  // Clean up old export files
  async cleanupExports() {
    const exportDir = path.join(__dirname, '../uploads/exports');
    try {
      const files = await fs.promises.readdir(exportDir);
      const now = moment();

      for (const file of files) {
        const filepath = path.join(exportDir, file);
        const stats = await fs.promises.stat(filepath);
        const fileAge = moment().diff(moment(stats.mtime), 'hours');

        // Delete files older than 24 hours
        if (fileAge > 24) {
          await fs.promises.unlink(filepath);
          logger.info(`Deleted old export file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up export files:', error);
    }
  }
}

module.exports = new ExcelHandler();
