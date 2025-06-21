const moment = require('moment');
const logger = require('./logger');
const config = require('./config');
const i18n = require('./i18n');

class Transformer {
  /**
   * Model Transformers
   */

  // Transform User model
  static transformUser(user, options = {}) {
    if (!user) return null;

    try {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: this.formatDate(user.lastLogin),
        createdAt: this.formatDate(user.createdAt),
        updatedAt: this.formatDate(user.updatedAt),
        ...(!options.hideProfile && user.profile && {
          profile: this.transformProfile(user.profile)
        })
      };
    } catch (error) {
      logger.error('Error transforming user:', error);
      throw error;
    }
  }

  // Transform Penduduk model
  static transformPenduduk(penduduk, options = {}) {
    if (!penduduk) return null;

    try {
      return {
        id: penduduk.id,
        nik: penduduk.nik,
        nama: penduduk.nama,
        tempatLahir: penduduk.tempatLahir,
        tanggalLahir: this.formatDate(penduduk.tanggalLahir),
        usia: this.calculateAge(penduduk.tanggalLahir),
        jenisKelamin: penduduk.jenisKelamin,
        golonganDarah: penduduk.golonganDarah,
        agama: penduduk.agama,
        statusPerkawinan: penduduk.statusPerkawinan,
        pekerjaan: penduduk.pekerjaan,
        alamat: penduduk.alamat,
        rt: penduduk.rt,
        rw: penduduk.rw,
        kelurahanDesa: penduduk.kelurahanDesa,
        kecamatan: penduduk.kecamatan,
        status: penduduk.status,
        createdAt: this.formatDate(penduduk.createdAt),
        updatedAt: this.formatDate(penduduk.updatedAt),
        ...(!options.hideUser && penduduk.user && {
          user: this.transformUser(penduduk.user, { hideProfile: true })
        })
      };
    } catch (error) {
      logger.error('Error transforming penduduk:', error);
      throw error;
    }
  }

  // Transform SuratRequest model
  static transformSuratRequest(surat, options = {}) {
    if (!surat) return null;

    try {
      return {
        id: surat.id,
        nomorSurat: surat.nomorSurat,
        jenisSurat: surat.jenisSurat,
        keperluan: surat.keperluan,
        status: surat.status,
        keterangan: surat.keterangan,
        lampiran: this.transformAttachments(surat.lampiran),
        tanggalPengajuan: this.formatDate(surat.createdAt),
        tanggalSelesai: this.formatDate(surat.tanggalSelesai),
        createdAt: this.formatDate(surat.createdAt),
        updatedAt: this.formatDate(surat.updatedAt),
        ...(!options.hidePemohon && surat.pemohon && {
          pemohon: this.transformPenduduk(surat.pemohon, { hideUser: true })
        })
      };
    } catch (error) {
      logger.error('Error transforming surat request:', error);
      throw error;
    }
  }

  // Transform BantuanSosial model
  static transformBantuanSosial(bantuan, options = {}) {
    if (!bantuan) return null;

    try {
      return {
        id: bantuan.id,
        namaProgram: bantuan.namaProgram,
        jenisProgram: bantuan.jenisProgram,
        deskripsi: bantuan.deskripsi,
        tahunAnggaran: bantuan.tahunAnggaran,
        sumberDana: bantuan.sumberDana,
        nilaiManfaat: this.formatCurrency(bantuan.nilaiManfaat),
        totalAnggaran: this.formatCurrency(bantuan.totalAnggaran),
        tanggalMulai: this.formatDate(bantuan.tanggalMulai),
        tanggalSelesai: this.formatDate(bantuan.tanggalSelesai),
        status: bantuan.status,
        createdAt: this.formatDate(bantuan.createdAt),
        updatedAt: this.formatDate(bantuan.updatedAt),
        ...(!options.hidePenerima && bantuan.penerima && {
          penerima: bantuan.penerima.map(p => 
            this.transformBantuanPenerima(p, { hideBantuan: true })
          )
        })
      };
    } catch (error) {
      logger.error('Error transforming bantuan sosial:', error);
      throw error;
    }
  }

  // Transform BantuanPenerima model
  static transformBantuanPenerima(penerima, options = {}) {
    if (!penerima) return null;

    try {
      return {
        id: penerima.id,
        status: penerima.status,
        nilaiDiterima: this.formatCurrency(penerima.nilaiDiterima),
        keterangan: penerima.keterangan,
        tanggalTerima: this.formatDate(penerima.tanggalTerima),
        createdAt: this.formatDate(penerima.createdAt),
        updatedAt: this.formatDate(penerima.updatedAt),
        ...(!options.hideBantuan && penerima.bantuanSosial && {
          bantuanSosial: this.transformBantuanSosial(penerima.bantuanSosial, { hidePenerima: true })
        }),
        ...(!options.hidePenduduk && penerima.penduduk && {
          penduduk: this.transformPenduduk(penerima.penduduk, { hideUser: true })
        })
      };
    } catch (error) {
      logger.error('Error transforming bantuan penerima:', error);
      throw error;
    }
  }

  // Transform APBDes model
  static transformAPBDes(apbdes, options = {}) {
    if (!apbdes) return null;

    try {
      return {
        id: apbdes.id,
        tahunAnggaran: apbdes.tahunAnggaran,
        jenis: apbdes.jenis,
        kategori: apbdes.kategori,
        subKategori: apbdes.subKategori,
        uraian: apbdes.uraian,
        nilaiAnggaran: this.formatCurrency(apbdes.nilaiAnggaran),
        nilaiRealisasi: this.formatCurrency(apbdes.nilaiRealisasi),
        persentaseRealisasi: this.calculatePercentage(
          apbdes.nilaiRealisasi,
          apbdes.nilaiAnggaran
        ),
        waktuPelaksanaan: apbdes.waktuPelaksanaan,
        lokasiKegiatan: apbdes.lokasiKegiatan,
        sumberDana: apbdes.sumberDana,
        createdAt: this.formatDate(apbdes.createdAt),
        updatedAt: this.formatDate(apbdes.updatedAt)
      };
    } catch (error) {
      logger.error('Error transforming APBDes:', error);
      throw error;
    }
  }

  /**
   * Helper Methods
   */

  // Format date
  static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    if (!date) return null;
    return moment(date).format(format);
  }

  // Calculate age
  static calculateAge(birthDate) {
    if (!birthDate) return null;
    return moment().diff(moment(birthDate), 'years');
  }

  // Format currency
  static formatCurrency(amount, currency = 'IDR') {
    if (amount === null || amount === undefined) return null;
    return i18n.formatCurrency(amount, currency);
  }

  // Calculate percentage
  static calculatePercentage(value, total) {
    if (!value || !total) return 0;
    return ((value / total) * 100).toFixed(2);
  }

  // Transform attachments
  static transformAttachments(attachments) {
    if (!attachments) return [];
    
    return attachments.map(attachment => ({
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: this.formatFileSize(attachment.size),
      url: this.getFileUrl(attachment.filename)
    }));
  }

  // Format file size
  static formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  // Get file URL
  static getFileUrl(filename) {
    if (!filename) return null;
    return `${config.get('app.apiUrl')}/uploads/${filename}`;
  }

  // Transform pagination
  static transformPagination(data) {
    return {
      total: data.count,
      perPage: data.limit,
      currentPage: data.page,
      lastPage: Math.ceil(data.count / data.limit),
      from: (data.page - 1) * data.limit + 1,
      to: Math.min(data.page * data.limit, data.count)
    };
  }

  // Transform error
  static transformError(error) {
    return {
      message: error.message,
      code: error.code,
      errors: error.errors,
      stack: config.isDevelopment() ? error.stack : undefined
    };
  }
}

module.exports = Transformer;
