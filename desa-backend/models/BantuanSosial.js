module.exports = (sequelize, DataTypes) => {
  const BantuanSosial = sequelize.define('BantuanSosial', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    namaProgram: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    jenisBantuan: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    deskripsi: {
      type: DataTypes.TEXT
    },
    periodeMulai: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        periodeMulaiValid(value) {
          if (value > this.periodeSelesai) {
            throw new Error('Periode mulai tidak boleh lebih besar dari periode selesai');
          }
        }
      }
    },
    periodeSelesai: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'completed'),
      allowNull: false,
      defaultValue: 'active'
    },
    kuota: {
      type: DataTypes.INTEGER,
      validate: {
        min: 0
      }
    },
    nilaiManfaat: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    kriteria: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    dokumenRequired: {
      type: DataTypes.JSON,
      defaultValue: []
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
    }
  }, {
    tableName: 'bantuan_sosial',
    timestamps: true,
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['periodeMulai', 'periodeSelesai']
      },
      {
        fields: ['namaProgram']
      }
    ],
    hooks: {
      beforeValidate: (bantuan) => {
        if (bantuan.namaProgram) {
          bantuan.namaProgram = bantuan.namaProgram.trim();
        }
      },
      beforeUpdate: async (bantuan) => {
        // Auto complete program if period has ended
        if (bantuan.periodeSelesai < new Date() && bantuan.status !== 'completed') {
          bantuan.status = 'completed';
        }
      }
    }
  });

  // Instance Methods
  BantuanSosial.prototype.isActive = function() {
    const now = new Date();
    return this.status === 'active' && 
           this.periodeMulai <= now && 
           this.periodeSelesai >= now;
  };

  BantuanSosial.prototype.getKuotaTersedia = async function() {
    const totalPenerima = await this.countPenerima({
      where: { status: 'qualified' }
    });
    return this.kuota ? this.kuota - totalPenerima : null;
  };

  BantuanSosial.prototype.addPenerima = async function(pendudukId, data = {}) {
    const kuotaTersedia = await this.getKuotaTersedia();
    
    if (this.kuota && kuotaTersedia <= 0) {
      throw new Error('Kuota bantuan sosial telah penuh');
    }

    return await this.createPenerima({
      pendudukId,
      ...data
    });
  };

  // Class Methods
  BantuanSosial.findActive = function() {
    const now = new Date();
    return this.findAll({
      where: {
        status: 'active',
        periodeMulai: {
          [sequelize.Op.lte]: now
        },
        periodeSelesai: {
          [sequelize.Op.gte]: now
        }
      }
    });
  };

  // Define associations
  BantuanSosial.associate = function(models) {
    BantuanSosial.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });

    BantuanSosial.belongsTo(models.User, {
      foreignKey: 'updatedBy',
      as: 'updater'
    });

    BantuanSosial.hasMany(models.BantuanSosialPenerima, {
      foreignKey: 'bantuanId',
      as: 'penerima'
    });

    BantuanSosial.belongsToMany(models.Penduduk, {
      through: models.BantuanSosialPenerima,
      foreignKey: 'bantuanId',
      otherKey: 'pendudukId',
      as: 'pendudukPenerima'
    });
  };

  return BantuanSosial;
};
