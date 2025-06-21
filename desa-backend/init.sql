-- Create database if not exists
CREATE DATABASE IF NOT EXISTS desa_digital CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE desa_digital;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin_desa', 'perangkat_desa', 'warga') NOT NULL DEFAULT 'warga',
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
);

-- Desa Profile table
CREATE TABLE IF NOT EXISTS desa_profile (
    id VARCHAR(36) PRIMARY KEY,
    nama_desa VARCHAR(100) NOT NULL,
    kode_desa VARCHAR(20) UNIQUE NOT NULL,
    kecamatan VARCHAR(100) NOT NULL,
    kabupaten VARCHAR(100) NOT NULL,
    provinsi VARCHAR(100) NOT NULL,
    kode_pos VARCHAR(10),
    alamat TEXT NOT NULL,
    telepon VARCHAR(20),
    email VARCHAR(100),
    website VARCHAR(100),
    logo_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Penduduk table
CREATE TABLE IF NOT EXISTS penduduk (
    id VARCHAR(36) PRIMARY KEY,
    nik VARCHAR(16) UNIQUE NOT NULL,
    no_kk VARCHAR(16) NOT NULL,
    nama VARCHAR(100) NOT NULL,
    tempat_lahir VARCHAR(100) NOT NULL,
    tanggal_lahir DATE NOT NULL,
    jenis_kelamin ENUM('L', 'P') NOT NULL,
    agama VARCHAR(20) NOT NULL,
    status_perkawinan ENUM('belum_kawin', 'kawin', 'cerai_hidup', 'cerai_mati') NOT NULL,
    pekerjaan VARCHAR(100),
    pendidikan_terakhir VARCHAR(50),
    golongan_darah ENUM('A', 'B', 'AB', 'O', 'tidak_tahu'),
    alamat TEXT NOT NULL,
    rt VARCHAR(3) NOT NULL,
    rw VARCHAR(3) NOT NULL,
    status_tinggal ENUM('tetap', 'tidak_tetap') NOT NULL DEFAULT 'tetap',
    status_hidup ENUM('hidup', 'meninggal') NOT NULL DEFAULT 'hidup',
    kewarganegaraan ENUM('WNI', 'WNA') NOT NULL DEFAULT 'WNI',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nik (nik),
    INDEX idx_no_kk (no_kk)
);

-- Surat Requests table
CREATE TABLE IF NOT EXISTS surat_requests (
    id VARCHAR(36) PRIMARY KEY,
    jenis_surat VARCHAR(100) NOT NULL,
    nomor_surat VARCHAR(100) UNIQUE,
    pemohon_id VARCHAR(36) NOT NULL,
    keperluan TEXT NOT NULL,
    status ENUM('pending', 'processing', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
    tanggal_pengajuan DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tanggal_selesai DATETIME,
    keterangan TEXT,
    attachment_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pemohon_id) REFERENCES penduduk(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_tanggal_pengajuan (tanggal_pengajuan)
);

-- Bantuan Sosial table
CREATE TABLE IF NOT EXISTS bantuan_sosial (
    id VARCHAR(36) PRIMARY KEY,
    nama_program VARCHAR(100) NOT NULL,
    jenis_bantuan VARCHAR(50) NOT NULL,
    deskripsi TEXT,
    periode_mulai DATE NOT NULL,
    periode_selesai DATE NOT NULL,
    status ENUM('active', 'inactive', 'completed') NOT NULL DEFAULT 'active',
    kuota INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_periode (periode_mulai, periode_selesai)
);

-- Bantuan Sosial Penerima table
CREATE TABLE IF NOT EXISTS bantuan_sosial_penerima (
    id VARCHAR(36) PRIMARY KEY,
    bantuan_id VARCHAR(36) NOT NULL,
    penduduk_id VARCHAR(36) NOT NULL,
    tanggal_terima DATETIME NOT NULL,
    status ENUM('qualified', 'distributed', 'rejected') NOT NULL DEFAULT 'qualified',
    keterangan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bantuan_id) REFERENCES bantuan_sosial(id) ON DELETE CASCADE,
    FOREIGN KEY (penduduk_id) REFERENCES penduduk(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bantuan_penduduk (bantuan_id, penduduk_id),
    INDEX idx_status (status)
);

-- APBDes table
CREATE TABLE IF NOT EXISTS apbdes (
    id VARCHAR(36) PRIMARY KEY,
    tahun YEAR NOT NULL,
    jenis ENUM('pendapatan', 'belanja', 'pembiayaan') NOT NULL,
    kategori VARCHAR(100) NOT NULL,
    sub_kategori VARCHAR(100) NOT NULL,
    uraian TEXT NOT NULL,
    nilai_anggaran DECIMAL(15,2) NOT NULL,
    nilai_realisasi DECIMAL(15,2) DEFAULT 0.00,
    sumber_dana VARCHAR(50) NOT NULL,
    status ENUM('draft', 'approved', 'revised') NOT NULL DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tahun_jenis (tahun, jenis),
    INDEX idx_status (status)
);

-- Arsip Dokumen table
CREATE TABLE IF NOT EXISTS arsip_dokumen (
    id VARCHAR(36) PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    nomor_dokumen VARCHAR(100) UNIQUE,
    jenis_dokumen VARCHAR(50) NOT NULL,
    tanggal_dokumen DATE NOT NULL,
    deskripsi TEXT,
    file_url VARCHAR(255) NOT NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_jenis (jenis_dokumen),
    INDEX idx_tanggal (tanggal_dokumen)
);

-- Pengaduan table
CREATE TABLE IF NOT EXISTS pengaduan (
    id VARCHAR(36) PRIMARY KEY,
    pelapor_id VARCHAR(36) NOT NULL,
    judul VARCHAR(255) NOT NULL,
    isi TEXT NOT NULL,
    kategori VARCHAR(50) NOT NULL,
    prioritas ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    status ENUM('open', 'processing', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    tanggal_lapor DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tanggal_selesai DATETIME,
    attachment_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pelapor_id) REFERENCES penduduk(id),
    INDEX idx_status (status),
    INDEX idx_kategori (kategori)
);

-- Pengaduan Response table
CREATE TABLE IF NOT EXISTS pengaduan_response (
    id VARCHAR(36) PRIMARY KEY,
    pengaduan_id VARCHAR(36) NOT NULL,
    responder_id VARCHAR(36) NOT NULL,
    response TEXT NOT NULL,
    attachment_url VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pengaduan_id) REFERENCES pengaduan(id) ON DELETE CASCADE,
    FOREIGN KEY (responder_id) REFERENCES users(id)
);

-- Create views
CREATE OR REPLACE VIEW vw_surat_status AS
SELECT 
    DATE(tanggal_pengajuan) as tanggal,
    jenis_surat,
    status,
    COUNT(*) as jumlah
FROM surat_requests
GROUP BY DATE(tanggal_pengajuan), jenis_surat, status;

CREATE OR REPLACE VIEW vw_penduduk_summary AS
SELECT 
    COUNT(*) as total_penduduk,
    SUM(CASE WHEN jenis_kelamin = 'L' THEN 1 ELSE 0 END) as total_laki_laki,
    SUM(CASE WHEN jenis_kelamin = 'P' THEN 1 ELSE 0 END) as total_perempuan,
    COUNT(DISTINCT no_kk) as total_kk
FROM penduduk
WHERE status_hidup = 'hidup' AND status_tinggal = 'tetap';

CREATE OR REPLACE VIEW vw_apbdes_realization AS
SELECT 
    tahun,
    jenis,
    SUM(nilai_anggaran) as total_anggaran,
    SUM(nilai_realisasi) as total_realisasi,
    (SUM(nilai_realisasi) / SUM(nilai_anggaran)) * 100 as persentase_realisasi
FROM apbdes
GROUP BY tahun, jenis;
