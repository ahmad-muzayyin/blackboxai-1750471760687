const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker/locale/id_ID');
const logger = require('./logger');
const models = require('../models');
const constants = require('./constants');
const config = require('./config');

class Seeder {
  constructor() {
    this.models = models;
    this.defaultPassword = 'password123';
  }

  // Run all seeders
  async seedAll() {
    try {
      if (!config.isDevelopment()) {
        throw new Error('Seeding only allowed in development environment');
      }

      logger.info('Starting database seeding...');

      await this.seedUsers();
      await this.seedPenduduk();
      await this.seedSuratRequests();
      await this.seedBantuanSosial();
      await this.seedAPBDes();

      logger.info('Database seeding completed successfully');
    } catch (error) {
      logger.error('Database seeding failed:', error);
      throw error;
    }
  }

  // Seed users
  async seedUsers() {
    try {
      logger.info('Seeding users...');

      const hashedPassword = await bcrypt.hash(this.defaultPassword, 10);

      // Create admin user
      await this.models.User.create({
        username: 'admin',
        email: 'admin@desadigital.com',
        password: hashedPassword,
        role: constants.AUTH.ROLES.ADMIN,
        isActive: true
      });

      // Create staff user
      await this.models.User.create({
        username: 'staff',
        email: 'staff@desadigital.com',
        password: hashedPassword,
        role: constants.AUTH.ROLES.STAFF,
        isActive: true
      });

      // Create regular users
      for (let i = 0; i < 5; i++) {
        await this.models.User.create({
          username: faker.internet.userName(),
          email: faker.internet.email(),
          password: hashedPassword,
          role: constants.AUTH.ROLES.USER,
          isActive: true
        });
      }

      logger.info('Users seeded successfully');
    } catch (error) {
      logger.error('Error seeding users:', error);
      throw error;
    }
  }

  // Seed penduduk
  async seedPenduduk() {
    try {
      logger.info('Seeding penduduk...');

      const users = await this.models.User.findAll({
        where: { role: constants.AUTH.ROLES.USER }
      });

      for (const user of users) {
        await this.models.Penduduk.create({
          nik: faker.random.numeric(16),
          nama: faker.name.fullName(),
          tempatLahir: faker.address.city(),
          tanggalLahir: faker.date.past(50),
          jenisKelamin: faker.helpers.arrayElement(['L', 'P']),
          golonganDarah: faker.helpers.arrayElement(['A', 'B', 'AB', 'O', '-']),
          agama: faker.helpers.arrayElement(constants.MODELS.PENDUDUK.AGAMA),
          statusPerkawinan: faker.helpers.arrayElement(constants.MODELS.PENDUDUK.STATUS_PERKAWINAN),
          pekerjaan: faker.name.jobTitle(),
          alamat: faker.address.streetAddress(),
          rt: faker.random.numeric(3),
          rw: faker.random.numeric(3),
          kelurahanDesa: 'Desa Digital',
          kecamatan: faker.address.county(),
          status: 'AKTIF',
          userId: user.id
        });
      }

      // Create additional penduduk without users
      for (let i = 0; i < 20; i++) {
        await this.models.Penduduk.create({
          nik: faker.random.numeric(16),
          nama: faker.name.fullName(),
          tempatLahir: faker.address.city(),
          tanggalLahir: faker.date.past(50),
          jenisKelamin: faker.helpers.arrayElement(['L', 'P']),
          golonganDarah: faker.helpers.arrayElement(['A', 'B', 'AB', 'O', '-']),
          agama: faker.helpers.arrayElement(constants.MODELS.PENDUDUK.AGAMA),
          statusPerkawinan: faker.helpers.arrayElement(constants.MODELS.PENDUDUK.STATUS_PERKAWINAN),
          pekerjaan: faker.name.jobTitle(),
          alamat: faker.address.streetAddress(),
          rt: faker.random.numeric(3),
          rw: faker.random.numeric(3),
          kelurahanDesa: 'Desa Digital',
          kecamatan: faker.address.county(),
          status: 'AKTIF'
        });
      }

      logger.info('Penduduk seeded successfully');
    } catch (error) {
      logger.error('Error seeding penduduk:', error);
      throw error;
    }
  }

  // Seed surat requests
  async seedSuratRequests() {
    try {
      logger.info('Seeding surat requests...');

      const penduduk = await this.models.Penduduk.findAll();

      for (const p of penduduk) {
        const numRequests = faker.datatype.number({ min: 0, max: 3 });
        
        for (let i = 0; i < numRequests; i++) {
          await this.models.SuratRequest.create({
            jenisSurat: faker.helpers.arrayElement(constants.MODELS.SURAT.JENIS),
            pemohonId: p.id,
            keperluan: faker.lorem.sentence(),
            status: faker.helpers.arrayElement(constants.MODELS.SURAT.STATUS),
            keterangan: faker.lorem.sentence(),
            nomorSurat: `${faker.random.numeric(3)}/SR/${faker.date.recent().getFullYear()}`
          });
        }
      }

      logger.info('Surat requests seeded successfully');
    } catch (error) {
      logger.error('Error seeding surat requests:', error);
      throw error;
    }
  }

  // Seed bantuan sosial
  async seedBantuanSosial() {
    try {
      logger.info('Seeding bantuan sosial...');

      // Create bantuan programs
      for (let i = 0; i < 5; i++) {
        const bantuan = await this.models.BantuanSosial.create({
          namaProgram: faker.company.catchPhrase(),
          jenisProgram: faker.helpers.arrayElement(constants.MODELS.BANTUAN_SOSIAL.JENIS_PROGRAM),
          deskripsi: faker.lorem.paragraph(),
          tahunAnggaran: faker.date.recent().getFullYear(),
          sumberDana: faker.helpers.arrayElement(constants.MODELS.BANTUAN_SOSIAL.SUMBER_DANA),
          nilaiManfaat: parseFloat(faker.finance.amount(100000, 1000000)),
          totalAnggaran: parseFloat(faker.finance.amount(10000000, 100000000)),
          tanggalMulai: faker.date.recent(),
          tanggalSelesai: faker.date.future(),
          status: faker.helpers.arrayElement(constants.MODELS.BANTUAN_SOSIAL.STATUS)
        });

        // Add random penerima
        const penduduk = await this.models.Penduduk.findAll({
          order: this.models.sequelize.random(),
          limit: faker.datatype.number({ min: 5, max: 15 })
        });

        for (const p of penduduk) {
          await this.models.BantuanSosialPenerima.create({
            bantuanSosialId: bantuan.id,
            pendudukId: p.id,
            status: faker.helpers.arrayElement(constants.MODELS.BANTUAN_SOSIAL.STATUS_PENERIMA),
            nilaiDiterima: parseFloat(faker.finance.amount(100000, bantuan.nilaiManfaat)),
            keterangan: faker.lorem.sentence()
          });
        }
      }

      logger.info('Bantuan sosial seeded successfully');
    } catch (error) {
      logger.error('Error seeding bantuan sosial:', error);
      throw error;
    }
  }

  // Seed APBDes
  async seedAPBDes() {
    try {
      logger.info('Seeding APBDes...');

      const currentYear = new Date().getFullYear();

      // Create APBDes entries for current year
      const categories = [
        { jenis: 'PENDAPATAN', items: 10 },
        { jenis: 'BELANJA', items: 20 },
        { jenis: 'PEMBIAYAAN', items: 5 }
      ];

      for (const category of categories) {
        for (let i = 0; i < category.items; i++) {
          const nilaiAnggaran = parseFloat(faker.finance.amount(1000000, 100000000));
          
          await this.models.APBDes.create({
            tahunAnggaran: currentYear,
            jenis: category.jenis,
            kategori: faker.helpers.arrayElement(['Kategori A', 'Kategori B', 'Kategori C']),
            subKategori: faker.helpers.arrayElement(['Sub A', 'Sub B', 'Sub C']),
            uraian: faker.lorem.sentence(),
            nilaiAnggaran: nilaiAnggaran,
            nilaiRealisasi: parseFloat(faker.finance.amount(0, nilaiAnggaran)),
            waktuPelaksanaan: faker.date.future().toISOString().split('T')[0],
            lokasiKegiatan: faker.address.streetAddress(),
            sumberDana: faker.helpers.arrayElement(constants.MODELS.APBDES.SUMBER_DANA)
          });
        }
      }

      logger.info('APBDes seeded successfully');
    } catch (error) {
      logger.error('Error seeding APBDes:', error);
      throw error;
    }
  }

  // Clear all data
  async clearAll() {
    try {
      if (!config.isDevelopment()) {
        throw new Error('Database clearing only allowed in development environment');
      }

      logger.info('Clearing database...');

      await this.models.sequelize.sync({ force: true });

      logger.info('Database cleared successfully');
    } catch (error) {
      logger.error('Error clearing database:', error);
      throw error;
    }
  }

  // Reset and reseed
  async reset() {
    try {
      await this.clearAll();
      await this.seedAll();
    } catch (error) {
      logger.error('Error resetting database:', error);
      throw error;
    }
  }
}

// Create singleton instance
const seeder = new Seeder();

// Export instance
module.exports = seeder;
