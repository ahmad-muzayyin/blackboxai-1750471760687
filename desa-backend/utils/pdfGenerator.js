const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const logger = require('./logger');

class PDFGenerator {
  constructor() {
    this.defaultOptions = {
      size: 'A4',
      margin: 50,
      info: {
        Creator: 'Desa Digital System',
        Producer: 'Desa Digital'
      }
    };
  }

  // Helper to add header to document
  async addHeader(doc, desaProfile) {
    // Add logo if exists
    if (desaProfile.logo) {
      const logoPath = path.join(__dirname, '../uploads/logo', desaProfile.logo);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 50 });
      }
    }

    // Add letterhead
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('PEMERINTAH KABUPATEN ' + desaProfile.kabupaten.toUpperCase(), 50, 50, { align: 'center' })
      .fontSize(14)
      .text('KECAMATAN ' + desaProfile.kecamatan.toUpperCase(), { align: 'center' })
      .fontSize(16)
      .text('DESA ' + desaProfile.namaDesa.toUpperCase(), { align: 'center' })
      .fontSize(10)
      .font('Helvetica')
      .text(desaProfile.alamatKantor, { align: 'center' })
      .text(`Email: ${desaProfile.email} - Telp: ${desaProfile.telepon}`, { align: 'center' });

    // Add line
    doc
      .moveTo(50, 150)
      .lineTo(545, 150)
      .lineWidth(2)
      .stroke();

    // Reset position for content
    doc.moveDown(2);
  }

  // Generate Surat Keterangan Domisili
  async generateSuratDomisili(suratRequest, penduduk, desaProfile) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const filename = `surat_domisili_${suratRequest.id}_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, '../uploads/surat', filename);

        // Pipe output to file
        doc.pipe(fs.createWriteStream(outputPath));

        // Add header
        this.addHeader(doc, desaProfile);

        // Add title
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('SURAT KETERANGAN DOMISILI', { align: 'center' })
          .text(`Nomor: ${suratRequest.nomorSurat}`, { align: 'center' });

        // Add content
        doc
          .fontSize(12)
          .font('Helvetica')
          .moveDown()
          .text('Yang bertanda tangan di bawah ini, Kepala Desa ' + desaProfile.namaDesa + ' menerangkan bahwa:')
          .moveDown();

        // Add resident details
        doc
          .text('Nama\t\t: ' + penduduk.nama)
          .text('NIK\t\t: ' + penduduk.nik)
          .text('Tempat/Tgl Lahir\t: ' + `${penduduk.tempatLahir}, ${moment(penduduk.tanggalLahir).format('DD MMMM YYYY')}`)
          .text('Jenis Kelamin\t: ' + (penduduk.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'))
          .text('Agama\t\t: ' + penduduk.agama)
          .text('Status\t\t: ' + penduduk.statusPerkawinan.replace('_', ' '))
          .text('Pekerjaan\t: ' + penduduk.pekerjaan)
          .text('Alamat\t\t: ' + penduduk.alamat)
          .moveDown();

        // Add declaration
        doc
          .text('Adalah benar-benar warga yang berdomisili di alamat tersebut di atas. Surat keterangan ini dibuat untuk ' + suratRequest.keperluan + '.')
          .moveDown(2);

        // Add signature section
        const today = moment().format('DD MMMM YYYY');
        doc
          .text(desaProfile.namaDesa + ', ' + today, { align: 'right' })
          .text('Kepala Desa ' + desaProfile.namaDesa, { align: 'right' })
          .moveDown(4)
          .font('Helvetica-Bold')
          .text('__________________________', { align: 'right' });

        // Finalize document
        doc.end();

        resolve(filename);
      } catch (error) {
        logger.error('Error generating domisili letter:', error);
        reject(error);
      }
    });
  }

  // Generate Surat Keterangan Tidak Mampu
  async generateSuratTidakMampu(suratRequest, penduduk, desaProfile) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const filename = `surat_tidak_mampu_${suratRequest.id}_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, '../uploads/surat', filename);

        doc.pipe(fs.createWriteStream(outputPath));

        // Add header
        this.addHeader(doc, desaProfile);

        // Add title
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('SURAT KETERANGAN TIDAK MAMPU', { align: 'center' })
          .text(`Nomor: ${suratRequest.nomorSurat}`, { align: 'center' });

        // Add content
        doc
          .fontSize(12)
          .font('Helvetica')
          .moveDown()
          .text('Yang bertanda tangan di bawah ini, Kepala Desa ' + desaProfile.namaDesa + ' menerangkan dengan sebenarnya bahwa:')
          .moveDown();

        // Add resident details
        doc
          .text('Nama\t\t: ' + penduduk.nama)
          .text('NIK\t\t: ' + penduduk.nik)
          .text('Tempat/Tgl Lahir\t: ' + `${penduduk.tempatLahir}, ${moment(penduduk.tanggalLahir).format('DD MMMM YYYY')}`)
          .text('Jenis Kelamin\t: ' + (penduduk.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'))
          .text('Agama\t\t: ' + penduduk.agama)
          .text('Status\t\t: ' + penduduk.statusPerkawinan.replace('_', ' '))
          .text('Pekerjaan\t: ' + penduduk.pekerjaan)
          .text('Alamat\t\t: ' + penduduk.alamat)
          .moveDown();

        // Add declaration
        doc
          .text('Adalah benar-benar warga yang tergolong keluarga tidak mampu/miskin. Surat keterangan ini dibuat untuk ' + suratRequest.keperluan + '.')
          .moveDown(2);

        // Add signature section
        const today = moment().format('DD MMMM YYYY');
        doc
          .text(desaProfile.namaDesa + ', ' + today, { align: 'right' })
          .text('Kepala Desa ' + desaProfile.namaDesa, { align: 'right' })
          .moveDown(4)
          .font('Helvetica-Bold')
          .text('__________________________', { align: 'right' });

        doc.end();

        resolve(filename);
      } catch (error) {
        logger.error('Error generating surat tidak mampu:', error);
        reject(error);
      }
    });
  }

  // Generate other types of letters...
  // You can add more methods for different types of letters

  // Helper method to get letter generator based on type
  getGeneratorForType(type) {
    const generators = {
      'SURAT_KETERANGAN_DOMISILI': this.generateSuratDomisili.bind(this),
      'SURAT_KETERANGAN_TIDAK_MAMPU': this.generateSuratTidakMampu.bind(this),
      // Add more letter types here
    };

    return generators[type];
  }

  // Main method to generate any type of letter
  async generateSurat(suratRequest, penduduk, desaProfile) {
    const generator = this.getGeneratorForType(suratRequest.jenisSurat);
    if (!generator) {
      throw new Error(`No generator found for letter type: ${suratRequest.jenisSurat}`);
    }

    return await generator(suratRequest, penduduk, desaProfile);
  }
}

module.exports = new PDFGenerator();
