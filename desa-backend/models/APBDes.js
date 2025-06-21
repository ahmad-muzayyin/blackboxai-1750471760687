module.exports = (sequelize, DataTypes) => {
  const APBDes = sequelize.define('APBDes', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tahun: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2000,
        max: 9999
      }
    },
    jenis: {
      type: DataTypes.ENUM('pendapatan', 'belanja', 'pembiayaan'),
      allowNull: false
    },
    kategori: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    subKategori: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    uraian: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    nilaiAnggaran: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    nilaiRealisasi: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      validate: {
        min: 0,
        realisasiValid(value) {
          if (value > this.nilaiAnggaran) {
            throw new Error('Nilai realisasi tidak boleh melebihi nilai anggaran');
          }
        }
      }
    },
    sumberDana: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'approved', 'revised'),
      allowNull: false,
      defaultValue: 'draft'
    },
    keterangan: {
      type: DataTypes.TEXT
    },
    buktiDokumen: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: true
      }
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approvedAt: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'apbdes',
    timestamps: true,
    indexes: [
      {
        fields: ['tahun', 'jenis']
      },
      {
        fields: ['status']
      },
      {
        fields: ['kategori', 'subKategori']
      }
    ],
    hooks: {
      beforeValidate: (apbdes) => {
        if (apbdes.uraian) {
          apbdes.uraian = apbdes.uraian.trim();
        }
      }
    }
  });

  // Instance Methods
  APBDes.prototype.approve = async function(userId) {
    this.status = 'approved';
    this.approvedBy = userId;
    this.approvedAt = new Date();
    return this.save();
  };

  APBDes.prototype.revise = async function(userId, newData) {
    this.status = 'revised';
    this.updatedBy = userId;
    Object.assign(this, newData);
    return this.save();
  };

  APBDes.prototype.updateRealisasi = async function(userId, nilaiRealisasi, buktiDokumen = null) {
    if (this.status !== 'approved') {
      throw new Error('Hanya anggaran yang telah disetujui yang dapat direalisasikan');
    }

    this.nilaiRealisasi = nilaiRealisasi;
    this.updatedBy = userId;
    if (buktiDokumen) {
      this.buktiDokumen = buktiDokumen;
    }
    return this.save();
  };

  APBDes.prototype.getPersentaseRealisasi = function() {
    return (this.nilaiRealisasi / this.nilaiAnggaran) * 100;
  };

  // Class Methods
  APBDes.getTotalAnggaran = async function(tahun, jenis) {
    const result = await this.findOne({
      where: { tahun, jenis },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('nilaiAnggaran')), 'total']
      ],
      raw: true
    });
    return result.total || 0;
  };

  APBDes.getTotalRealisasi = async function(tahun, jenis) {
    const result = await this.findOne({
      where: { tahun, jenis },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('nilaiRealisasi')), 'total']
      ],
      raw: true
    });
    return result.total || 0;
  };

  APBDes.getLaporanRealisasi = async function(tahun) {
    const jenis = ['pendapatan', 'belanja', 'pembiayaan'];
    const laporan = {};

    for (const j of jenis) {
      laporan[j] = {
        anggaran: await this.getTotalAnggaran(tahun, j),
        realisasi: await this.getTotalRealisasi(tahun, j)
      };
      laporan[j].persentase = (laporan[j].realisasi / laporan[j].anggaran) * 100;
    }

    return laporan;
  };

  // Define associations
  APBDes.associate = function(models) {
    APBDes.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });

    APBDes.belongsTo(models.User, {
      foreignKey: 'updatedBy',
      as: 'updater'
    });

    APBDes.belongsTo(models.User, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });
  };

  return APBDes;
};
