module.exports = (sequelize, DataTypes) => {
  const BantuanSosialPenerima = sequelize.define('BantuanSosialPenerima', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    bantuanId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'bantuan_sosial',
        key: 'id'
      }
    },
    pendudukId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'penduduk',
        key: 'id'
      }
    },
    tanggalTerima: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    status: {
      type: DataTypes.ENUM('qualified', 'distributed', 'rejected'),
      allowNull: false,
      defaultValue: 'qualified'
    },
    nilaiDiterima: {
      type: DataTypes.DECIMAL(15, 2),
      validate: {
        min: 0
      }
    },
    keterangan: {
      type: DataTypes.TEXT
    },
    dokumenPendukung: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    verifiedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    verifiedAt: {
      type: DataTypes.DATE
    },
    distributedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    distributedAt: {
      type: DataTypes.DATE
    },
    buktiDistribusi: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: true
      }
    }
  }, {
    tableName: 'bantuan_sosial_penerima',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['bantuanId', 'pendudukId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['tanggalTerima']
      }
    ],
    hooks: {
      beforeValidate: async (penerima) => {
        // Validate if bantuan is still active
        const bantuan = await penerima.getBantuan();
        if (!bantuan.isActive()) {
          throw new Error('Program bantuan sosial tidak aktif');
        }
      },
      beforeCreate: async (penerima) => {
        // Check quota availability
        const bantuan = await penerima.getBantuan();
        const kuotaTersedia = await bantuan.getKuotaTersedia();
        
        if (bantuan.kuota && kuotaTersedia <= 0) {
          throw new Error('Kuota bantuan sosial telah penuh');
        }
      }
    }
  });

  // Instance Methods
  BantuanSosialPenerima.prototype.verify = async function(userId, status = 'qualified', keterangan = '') {
    this.status = status;
    this.keterangan = keterangan;
    this.verifiedBy = userId;
    this.verifiedAt = new Date();
    return this.save();
  };

  BantuanSosialPenerima.prototype.distribute = async function(userId, buktiDistribusi = null) {
    if (this.status !== 'qualified') {
      throw new Error('Penerima bantuan belum terverifikasi atau telah ditolak');
    }

    this.status = 'distributed';
    this.distributedBy = userId;
    this.distributedAt = new Date();
    if (buktiDistribusi) {
      this.buktiDistribusi = buktiDistribusi;
    }
    return this.save();
  };

  BantuanSosialPenerima.prototype.reject = async function(userId, keterangan) {
    return this.verify(userId, 'rejected', keterangan);
  };

  // Class Methods
  BantuanSosialPenerima.findByPenduduk = async function(pendudukId) {
    return await this.findAll({
      where: { pendudukId },
      include: ['bantuan']
    });
  };

  BantuanSosialPenerima.findByBantuan = async function(bantuanId) {
    return await this.findAll({
      where: { bantuanId },
      include: ['penduduk']
    });
  };

  // Define associations
  BantuanSosialPenerima.associate = function(models) {
    BantuanSosialPenerima.belongsTo(models.BantuanSosial, {
      foreignKey: 'bantuanId',
      as: 'bantuan'
    });

    BantuanSosialPenerima.belongsTo(models.Penduduk, {
      foreignKey: 'pendudukId',
      as: 'penduduk'
    });

    BantuanSosialPenerima.belongsTo(models.User, {
      foreignKey: 'verifiedBy',
      as: 'verifier'
    });

    BantuanSosialPenerima.belongsTo(models.User, {
      foreignKey: 'distributedBy',
      as: 'distributor'
    });
  };

  return BantuanSosialPenerima;
};
